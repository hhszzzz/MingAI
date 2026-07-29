#!/usr/bin/env node
/** TaiBu local MCP Server (stdio, MCP 2026-07-28 with legacy compatibility). */

import { createRequire } from 'node:module';
import {
  McpServer,
  fromJsonSchema,
  type CallToolResult,
  type JsonSchemaType,
} from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import {
  buildToolSuccessPayload,
  executeTool,
  listToolDefinitions,
  normalizeTransportDetailLevel,
} from 'taibu-core/mcp';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };
const PUBLIC_CACHE_TTL_MS = 5 * 60_000;

function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'taibu-mcp', version },
    {
      capabilities: { tools: {} },
      instructions: '太卜提供命理、术数与占卜计算工具。工具结果同时包含规范文本与 canonical JSON。',
      cacheHints: {
        'server/discover': { ttlMs: PUBLIC_CACHE_TTL_MS, cacheScope: 'public' },
        'tools/list': { ttlMs: PUBLIC_CACHE_TTL_MS, cacheScope: 'public' },
      },
    },
  );

  for (const tool of listToolDefinitions()) {
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
        try {
          const result = await executeTool(tool.name, args);
          const detailLevel = normalizeTransportDetailLevel(args.detailLevel);
          return buildToolSuccessPayload(tool.name, result, { detailLevel });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: 'text', text: `Error: ${message}` }],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}

serveStdio(createMcpServer, {
  legacy: 'serve',
  onerror: (error) => console.error('[MCP stdio]', error),
});
