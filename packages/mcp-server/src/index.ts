/** TaiBu public MCP Server (MCP 2026-07-28 HTTP, no authentication). */
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFileDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentFileDir, '../../..', '.env'), override: false });

import { createRequire } from 'node:module';
import express from 'express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import {
  McpServer,
  createMcpHandler,
  fromJsonSchema,
  type CallToolResult,
  type JsonSchemaType,
} from '@modelcontextprotocol/server';
import {
  buildListToolsPayload,
  buildToolSuccessPayload,
  executeTool,
  normalizeTransportDetailLevel,
} from 'taibu-core/mcp';
import {
  asyncRequestHandler,
  getClientIp,
  hostValidationMiddleware,
  mcpErrorMiddleware,
  originValidationMiddleware,
  rateLimitMiddleware,
  readPositiveIntEnv,
  subscriptionConnectionLimitMiddleware,
} from './middleware.js';
import {
  attachPlaceResolutionInfoToResult,
  attachPlaceResolutionNoteToPayload,
  decorateToolListPayloadForRuntime,
  preprocessToolArgsForRuntimePlace,
} from './place-resolution.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };
const app = express();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SEED_SCOPED_TOOLS = new Set(['liuyao', 'tarot']);
const PRIVATE_CLIENT_IP_HEADER = 'x-taibu-client-ip';
const MODERN_PROTOCOL_VERSION = '2026-07-28';
const PUBLIC_CACHE_TTL_MS = 5 * 60_000;
const runtimeTools = decorateToolListPayloadForRuntime(buildListToolsPayload()).tools;

if (process.env.MCP_TRUST_PROXY === 'true') app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

if (process.env.MCP_REQUEST_LOG === 'true') {
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      console.log(`[MCP] ${req.method} ${req.path} status=${res.statusCode} ip=${getClientIp(req)} duration=${Date.now() - startedAt}ms`);
    });
    next();
  });
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/info', (_req, res) => {
  res.json({
    name: 'TaiBu MCP Server',
    version,
    status: 'ok',
    transport: 'streamable-http',
    protocol_version: MODERN_PROTOCOL_VERSION,
    legacy_compatibility: 'stateless',
    auth: 'none',
    mcp_endpoint: '/mcp',
  });
});

function withSeedScope(name: string, args: unknown, seedScope: string): unknown {
  if (!SEED_SCOPED_TOOLS.has(name)) return args === undefined ? {} : args;
  if (args === undefined) return { seedScope };
  if (!args || typeof args !== 'object' || Array.isArray(args)) return args;
  return { ...(args as Record<string, unknown>), seedScope };
}

function logMcpError(context: string, error: Error): void {
  console.error(`[MCP] ${context}: ${error.message}`);
}

function createMcpServer(seedScope: string): McpServer {
  const server = new McpServer(
    { name: 'taibu-mcp-online', version },
    {
      capabilities: { tools: {} },
      instructions: '太卜提供命理、术数与占卜计算工具。工具结果同时包含规范文本与 canonical JSON。',
      cacheHints: {
        'server/discover': { ttlMs: PUBLIC_CACHE_TTL_MS, cacheScope: 'public' },
        'tools/list': { ttlMs: PUBLIC_CACHE_TTL_MS, cacheScope: 'public' },
      },
    },
  );

  for (const tool of runtimeTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: fromJsonSchema<Record<string, unknown>>(tool.inputSchema as JsonSchemaType),
        outputSchema: fromJsonSchema(tool.outputSchema as JsonSchemaType),
        annotations: tool.annotations,
      },
      async (args): Promise<CallToolResult> => {
        const scopedArgs = withSeedScope(tool.name, args, seedScope);
        const { toolArgs, placeResolutionInfo } = await preprocessToolArgsForRuntimePlace(tool.name, scopedArgs);

        try {
          const rawResult = await executeTool(tool.name, toolArgs);
          const result = attachPlaceResolutionInfoToResult(rawResult, placeResolutionInfo);
          const detailLevel = normalizeTransportDetailLevel(args.detailLevel);
          const payload = buildToolSuccessPayload(tool.name, result, { detailLevel }) as Record<string, unknown>;
          return attachPlaceResolutionNoteToPayload(payload, placeResolutionInfo) as CallToolResult;
        } catch (error) {
          const internalMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{
              type: 'text',
              text: IS_PRODUCTION ? 'Tool execution failed' : `Error: ${internalMessage}`,
            }],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}

const mcpHandler = createMcpHandler(
  ({ requestInfo }) => {
    const clientIp = requestInfo?.headers.get(PRIVATE_CLIENT_IP_HEADER) || 'unknown';
    return createMcpServer(`anonymous:${clientIp}`);
  },
  {
    legacy: 'stateless',
    responseMode: 'auto',
    maxSubscriptions: readPositiveIntEnv('MCP_MAX_SUBSCRIPTIONS', 1000),
    onerror: (error) => logMcpError('Protocol error', error),
  },
);
const handleNodeMcp = toNodeHandler(mcpHandler, {
  onerror: (error) => logMcpError('Node adapter error', error),
});

const handleMcpPost: express.RequestHandler = async (req, res) => {
  // Always overwrite this private transport header so clients cannot choose the random seed scope.
  req.headers[PRIVATE_CLIENT_IP_HEADER] = getClientIp(req);
  await handleNodeMcp(req, res, req.body);
};

const networkGuards = [originValidationMiddleware, hostValidationMiddleware, rateLimitMiddleware];
app.post(
  ['/', '/mcp'],
  ...networkGuards,
  subscriptionConnectionLimitMiddleware,
  asyncRequestHandler(handleMcpPost),
);
app.use(mcpErrorMiddleware);

const PORT = Number.parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.MCP_HOST || '127.0.0.1';
const httpServer = app.listen(PORT, HOST, () => {
  console.log(`TaiBu MCP Server (MCP ${MODERN_PROTOCOL_VERSION}, public HTTP) running on ${HOST}:${PORT} at /mcp`);
});

let shuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[${signal}] Shutting down MCP server...`);
  await mcpHandler.close().catch(() => {});
  const forceExitTimer = setTimeout(() => process.exit(0), 3000);
  httpServer.close(() => {
    clearTimeout(forceExitTimer);
    console.log('HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });
process.on('SIGINT', () => { void gracefulShutdown('SIGINT'); });
