/** TaiBu public MCP Server (Streamable HTTP, no authentication). */
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFileDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentFileDir, '../../..', '.env'), override: false });

import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
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
  sseConnectionLimitMiddleware,
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

const MAX_TOTAL_SESSIONS = readPositiveIntEnv('MCP_MAX_SESSIONS', 1000);
const MAX_SESSIONS_PER_IP = readPositiveIntEnv('MCP_MAX_SESSIONS_PER_IP', 20);
const SESSION_TTL_MS = readPositiveIntEnv('MCP_SESSION_TTL_MS', 1_800_000);
const SESSION_IDLE_MS = readPositiveIntEnv('MCP_SESSION_IDLE_MS', 600_000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SEED_SCOPED_TOOLS = new Set(['liuyao', 'tarot']);

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
    auth: 'none',
    mcp_endpoint: '/mcp',
  });
});

type SessionContext = {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  clientIp: string;
  createdAt: number;
  lastActivityAt: number;
};

const sessions = new Map<string, SessionContext>();

function withSeedScope(name: string, args: unknown, seedScope: string): unknown {
  if (!SEED_SCOPED_TOOLS.has(name)) return args === undefined ? {} : args;
  if (args === undefined) return { seedScope };
  if (!args || typeof args !== 'object' || Array.isArray(args)) return args;
  return { ...(args as Record<string, unknown>), seedScope };
}

function createMcpServer(seedScope: string) {
  const server = new McpServer(
    { name: 'taibu-mcp-online', version },
    { capabilities: { tools: {} } },
  );

  server.server.setRequestHandler(ListToolsRequestSchema, async () => (
    decorateToolListPayloadForRuntime(buildListToolsPayload())
  ));

  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const scopedArgs = withSeedScope(name, args, seedScope);
    const { toolArgs, placeResolutionInfo } = await preprocessToolArgsForRuntimePlace(name, scopedArgs);

    try {
      const rawResult = await executeTool(name, toolArgs);
      const result = attachPlaceResolutionInfoToResult(rawResult, placeResolutionInfo);
      const detailLevel = normalizeTransportDetailLevel(args?.detailLevel);
      const payload = buildToolSuccessPayload(name, result, { detailLevel }) as Record<string, unknown>;
      return attachPlaceResolutionNoteToPayload(payload, placeResolutionInfo);
    } catch (error) {
      const internalMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: IS_PRODUCTION ? 'Tool execution failed' : `Error: ${internalMessage}` }],
        isError: true,
      };
    }
  });

  return server;
}

function getSessionId(req: express.Request): string | undefined {
  const value = req.headers['mcp-session-id'];
  return typeof value === 'string' && value ? value : undefined;
}

function cleanupSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  void session.server.close().catch(() => {});
}

function countSessionsForIp(ip: string): number {
  let count = 0;
  for (const session of sessions.values()) {
    if (session.clientIp === ip) count += 1;
  }
  return count;
}

function resolveBoundSession(
  req: express.Request,
  res: express.Response,
  sessionId: string,
): SessionContext | undefined {
  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return undefined;
  }
  if (session.clientIp !== getClientIp(req)) {
    res.status(403).json({ error: 'Session IP mismatch' });
    return undefined;
  }
  return session;
}

const sessionCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS || now - session.lastActivityAt > SESSION_IDLE_MS) {
      cleanupSession(id);
    }
  }
}, 60_000);
sessionCleanupTimer.unref?.();

async function handleStatelessRequest(req: express.Request, res: express.Response, parsedBody?: unknown) {
  const server = createMcpServer(`anonymous:${getClientIp(req)}`);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  transport.onclose = () => { void server.close().catch(() => {}); };
  transport.onerror = () => { void server.close().catch(() => {}); };

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
  } catch (error) {
    await server.close().catch(() => {});
    if (!res.headersSent) {
      return res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
    throw error;
  } finally {
    if (req.method === 'GET') res.once('close', () => { void server.close().catch(() => {}); });
    else await server.close().catch(() => {});
  }
}

const handleMcpPost: express.RequestHandler = async (req, res) => {
  const sessionId = getSessionId(req);
  if (sessionId) {
    const session = resolveBoundSession(req, res, sessionId);
    if (!session) return;
    session.lastActivityAt = Date.now();
    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  if (!isInitializeRequest(req.body)) {
    await handleStatelessRequest(req, res, req.body);
    return;
  }

  const clientIp = getClientIp(req);
  if (sessions.size >= MAX_TOTAL_SESSIONS) {
    return res.status(503).json({ error: 'Server at capacity, try again later' });
  }
  if (countSessionsForIp(clientIp) >= MAX_SESSIONS_PER_IP) {
    return res.status(429).json({ error: 'Too many active sessions for this IP' });
  }

  const initializedSessionId = crypto.randomUUID();
  const server = createMcpServer(initializedSessionId);
  const now = Date.now();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => initializedSessionId,
    onsessioninitialized: (id) => {
      const session = sessions.get(id);
      if (session) session.lastActivityAt = Date.now();
    },
    onsessionclosed: cleanupSession,
  });
  transport.onclose = () => { if (transport.sessionId) cleanupSession(transport.sessionId); };
  transport.onerror = () => { if (transport.sessionId) cleanupSession(transport.sessionId); };
  // Reserve the slot before the first await so concurrent initializations see it.
  sessions.set(initializedSessionId, { server, transport, clientIp, createdAt: now, lastActivityAt: now });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    sessions.delete(initializedSessionId);
    await server.close().catch(() => {});
    if (!res.headersSent) {
      return res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
    throw error;
  }
};

const handleMcpGet: express.RequestHandler = async (req, res) => {
  const sessionId = getSessionId(req);
  if (!sessionId) {
    await handleStatelessRequest(req, res);
    return;
  }
  const session = resolveBoundSession(req, res, sessionId);
  if (!session) return;
  session.lastActivityAt = Date.now();
  await session.transport.handleRequest(req, res);
};

const handleMcpDelete: express.RequestHandler = async (req, res) => {
  const sessionId = getSessionId(req);
  if (!sessionId) return res.status(400).json({ error: 'Missing mcp-session-id header' });
  const session = resolveBoundSession(req, res, sessionId);
  if (!session) return;
  await session.transport.handleRequest(req, res, req.body);
  cleanupSession(sessionId);
};

const networkGuards = [originValidationMiddleware, hostValidationMiddleware, rateLimitMiddleware];
app.post(['/', '/mcp'], ...networkGuards, asyncRequestHandler(handleMcpPost));
app.get(['/', '/mcp'], ...networkGuards, sseConnectionLimitMiddleware, asyncRequestHandler(handleMcpGet));
app.delete(['/', '/mcp'], ...networkGuards, asyncRequestHandler(handleMcpDelete));
app.use(mcpErrorMiddleware);

const PORT = Number.parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.MCP_HOST || '127.0.0.1';
const httpServer = app.listen(PORT, HOST, () => {
  console.log(`TaiBu MCP Server (public Streamable HTTP) running on ${HOST}:${PORT} at /mcp`);
});

function gracefulShutdown(signal: string) {
  console.log(`\n[${signal}] Shutting down MCP server...`);
  httpServer.close(() => console.log('HTTP server closed'));
  const sessionCount = sessions.size;
  for (const id of sessions.keys()) cleanupSession(id);
  console.log(`Cleaned up ${sessionCount} sessions`);
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
