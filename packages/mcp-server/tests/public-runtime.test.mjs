import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const PROTOCOL_VERSION = '2025-06-18';

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function getFreePort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.listen(0, '127.0.0.1', (error) => error ? rejectListen(error) : resolveListen());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to allocate port');
  const port = address.port;
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

async function waitForHealth(port, child) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`MCP server exited with ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await wait(100);
  }
  throw new Error('Timed out waiting for MCP server');
}

async function stopProcess(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolveExit) => child.once('exit', resolveExit)), wait(3_500)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function rpc(url, body, sessionId, extraHeaders = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...(sessionId ? { 'mcp-session-id': sessionId, 'mcp-protocol-version': PROTOCOL_VERSION } : {}),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text.startsWith('event:')
    ? JSON.parse(text.split('\n').find((line) => line.startsWith('data: ')).slice(6))
    : text ? JSON.parse(text) : null;
  return { response, payload };
}

test('public runtime supports anonymous initialize, tool calls, and session deletion', async () => {
  const port = await getFreePort();
  const child = spawn(process.execPath, ['dist/index.js'], {
    cwd: resolve(process.cwd(), 'packages/mcp-server'),
    env: {
      ...process.env,
      NODE_OPTIONS: '',
      NODE_ENV: 'test',
      PORT: String(port),
      MCP_HOST: '127.0.0.1',
      MCP_ALLOWED_HOSTS: `127.0.0.1:${port}`,
      MCP_RATE_LIMIT_PER_MINUTE: '100',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    await waitForHealth(port, child);
    const baseUrl = `http://127.0.0.1:${port}`;
    const info = await fetch(`${baseUrl}/info`).then((response) => response.json());
    assert.equal(info.auth, 'none');
    assert.equal(info.mcp_endpoint, '/mcp');
    assert.equal((await fetch(`${baseUrl}/.well-known/oauth-authorization-server`)).status, 404);

    const malformed = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: '{invalid-json',
    });
    const malformedPayload = await malformed.json();
    assert.equal(malformed.status, 400);
    assert.equal(malformedPayload.error.code, -32700);

    const initialized = await rpc(`${baseUrl}/mcp`, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'public-test', version: '1.0.0' } },
    }, undefined, { authorization: 'Bearer ignored-legacy-token' });
    assert.equal(initialized.response.status, 200, stderr);
    const sessionId = initialized.response.headers.get('mcp-session-id');
    assert.ok(sessionId);
    assert.equal(initialized.payload.result.serverInfo.name, 'taibu-mcp-online');

    const listed = await rpc(`${baseUrl}/mcp`, {
      jsonrpc: '2.0', id: 2, method: 'tools/list', params: {},
    }, sessionId);
    assert.equal(listed.response.status, 200, stderr);
    const toolNames = listed.payload.result.tools.map((tool) => tool.name);
    assert.ok(toolNames.includes('meihua'));
    assert.ok(toolNames.includes('xiaoliuren'));

    const called = await rpc(`${baseUrl}/mcp`, {
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'xiaoliuren', arguments: { lunarMonth: 1, lunarDay: 1, hour: 1, question: '测试' } },
    }, sessionId);
    assert.equal(called.response.status, 200, stderr);
    assert.equal(called.payload.result.isError, undefined);
    assert.equal(called.payload.result.structuredContent.结果.落宫, '大安');

    const deleted = await fetch(`${baseUrl}/mcp`, {
      method: 'DELETE',
      headers: {
        accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId,
        'mcp-protocol-version': PROTOCOL_VERSION,
      },
    });
    assert.equal(deleted.status, 200, stderr);

    const afterDelete = await rpc(`${baseUrl}/mcp`, {
      jsonrpc: '2.0', id: 4, method: 'tools/list', params: {},
    }, sessionId);
    assert.equal(afterDelete.response.status, 404);
  } finally {
    await stopProcess(child);
  }
});

test('public runtime binds an established session to its creating IP', async () => {
  const port = await getFreePort();
  const child = spawn(process.execPath, ['dist/index.js'], {
    cwd: resolve(process.cwd(), 'packages/mcp-server'),
    env: {
      ...process.env,
      NODE_OPTIONS: '',
      NODE_ENV: 'test',
      PORT: String(port),
      MCP_HOST: '127.0.0.1',
      MCP_TRUST_PROXY: 'true',
      MCP_ALLOWED_HOSTS: `127.0.0.1:${port}`,
      MCP_RATE_LIMIT_PER_MINUTE: '100',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    await waitForHealth(port, child);
    const baseUrl = `http://127.0.0.1:${port}`;
    const initialized = await rpc(`${baseUrl}/mcp`, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'ip-test', version: '1.0.0' } },
    }, undefined, { 'x-forwarded-for': '198.51.100.10' });
    assert.equal(initialized.response.status, 200, stderr);
    const sessionId = initialized.response.headers.get('mcp-session-id');
    assert.ok(sessionId);

    const wrongIp = await rpc(`${baseUrl}/mcp`, {
      jsonrpc: '2.0', id: 2, method: 'tools/list', params: {},
    }, sessionId, { 'x-forwarded-for': '198.51.100.11' });
    assert.equal(wrongIp.response.status, 403, stderr);
    assert.equal(wrongIp.payload.error, 'Session IP mismatch');

    const deleted = await fetch(`${baseUrl}/mcp`, {
      method: 'DELETE',
      headers: {
        accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId,
        'mcp-protocol-version': PROTOCOL_VERSION,
        'x-forwarded-for': '198.51.100.10',
      },
    });
    assert.equal(deleted.status, 200, stderr);
  } finally {
    await stopProcess(child);
  }
});

test('public runtime reserves session capacity before concurrent initialization awaits', async () => {
  const port = await getFreePort();
  const child = spawn(process.execPath, ['dist/index.js'], {
    cwd: resolve(process.cwd(), 'packages/mcp-server'),
    env: {
      ...process.env,
      NODE_OPTIONS: '',
      NODE_ENV: 'test',
      PORT: String(port),
      MCP_HOST: '127.0.0.1',
      MCP_TRUST_PROXY: 'true',
      MCP_ALLOWED_HOSTS: `127.0.0.1:${port}`,
      MCP_MAX_SESSIONS: '1',
      MCP_MAX_SESSIONS_PER_IP: '10',
      MCP_RATE_LIMIT_PER_MINUTE: '100',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    await waitForHealth(port, child);
    const baseUrl = `http://127.0.0.1:${port}`;
    const initialize = (id, ip) => rpc(`${baseUrl}/mcp`, {
      jsonrpc: '2.0', id, method: 'initialize',
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: `capacity-${id}`, version: '1.0.0' } },
    }, undefined, { 'x-forwarded-for': ip });
    const attempts = [
      { id: 1, ip: '198.51.100.20' },
      { id: 2, ip: '198.51.100.21' },
    ];
    const results = await Promise.all(attempts.map(({ id, ip }) => initialize(id, ip)));
    assert.deepEqual(results.map(({ response }) => response.status).sort((a, b) => a - b), [200, 503], stderr);

    const winnerIndex = results.findIndex(({ response }) => response.status === 200);
    assert.notEqual(winnerIndex, -1);
    const winner = results[winnerIndex];
    const sessionId = winner.response.headers.get('mcp-session-id');
    assert.ok(sessionId);
    await fetch(`${baseUrl}/mcp`, {
      method: 'DELETE',
      headers: {
        accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId,
        'mcp-protocol-version': PROTOCOL_VERSION,
        'x-forwarded-for': attempts[winnerIndex].ip,
      },
    });
  } finally {
    await stopProcess(child);
  }
});
