import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MCP_PUBLIC_URL,
  MCP_PUBLIC_TOOLS,
  MCP_STDIO_GLOBAL_COMMAND,
  MCP_STDIO_PACKAGE_NAME,
  buildMcpPublicHttpConfig,
  buildMcpStdioGlobalConfig,
  buildMcpStdioNpxConfig,
} from '../lib/mcp-service-config';

test('stdio config snippets match the documented local MCP usage', () => {
  const npxConfig = JSON.parse(buildMcpStdioNpxConfig()) as {
    mcpServers: { taibu: { command: string; args: string[] } };
  };
  const globalConfig = JSON.parse(buildMcpStdioGlobalConfig()) as {
    mcpServers: { taibu: { command: string } };
  };

  assert.deepEqual(npxConfig, {
    mcpServers: {
      taibu: {
        command: 'npx',
        args: ['-y', MCP_STDIO_PACKAGE_NAME],
      },
    },
  });
  assert.deepEqual(globalConfig, {
    mcpServers: {
      taibu: {
        command: MCP_STDIO_GLOBAL_COMMAND,
      },
    },
  });
});

test('public config snippet keeps the anonymous remote streamable-http entry', () => {
  const publicConfig = JSON.parse(buildMcpPublicHttpConfig()) as {
    mcpServers: { taibu: { type: string; url: string } };
  };

  assert.deepEqual(publicConfig, {
    mcpServers: {
      taibu: {
        type: 'streamable-http',
        url: MCP_PUBLIC_URL,
      },
    },
  });
});

test('public MCP tools list stays aligned with the current package README surface', () => {
  const toolIds = MCP_PUBLIC_TOOLS.map((tool) => tool.id);

  assert.equal(MCP_PUBLIC_TOOLS.length, 15);
  assert.deepEqual(toolIds, [
    'bazi',
    'bazi_pillars_resolve',
    'bazi_dayun',
    'ziwei',
    'ziwei_horoscope',
    'ziwei_flying_star',
    'liuyao',
    'meihua',
    'tarot',
    'almanac',
    'astrology',
    'qimen',
    'taiyi',
    'daliuren',
    'xiaoliuren',
  ]);
  assert.equal(toolIds.includes('fortune'), false);
});
