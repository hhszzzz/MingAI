import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const distRoot = resolve(process.cwd(), 'packages/mcp-server/dist');

async function importMiddleware() {
  const url = pathToFileURL(resolve(distRoot, 'middleware.js'));
  url.searchParams.set('t', `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function createResponseRecorder() {
  const handlers = new Map();
  const headers = new Map();
  let statusCode = 200;
  let payload;
  return {
    status(code) { statusCode = code; return this; },
    json(body) { payload = body; return this; },
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    once(event, handler) { handlers.set(event, handler); return this; },
    emit(event) { handlers.get(event)?.(); },
    get statusCode() { return statusCode; },
    get payload() { return payload; },
    getHeader(name) { return headers.get(name.toLowerCase()); },
  };
}

function createRequest(overrides = {}) {
  return {
    method: 'POST',
    headers: {},
    ip: `127.0.0.${Math.floor(Math.random() * 200) + 1}`,
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  };
}

test('origin validation allows non-browser clients and rejects unlisted browser origins', async () => {
  const { originValidationMiddleware } = await importMiddleware();
  const previous = process.env.MCP_ALLOWED_ORIGINS;
  process.env.MCP_ALLOWED_ORIGINS = 'https://app.example.com';
  try {
    for (const [origin, expected] of [[undefined, true], ['https://app.example.com', true], ['https://evil.example.com', false]]) {
      const req = createRequest({ headers: origin ? { origin } : {} });
      const res = createResponseRecorder();
      let nextCalled = false;
      originValidationMiddleware(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled, expected);
      if (!expected) assert.equal(res.statusCode, 403);
    }
  } finally {
    if (previous === undefined) delete process.env.MCP_ALLOWED_ORIGINS;
    else process.env.MCP_ALLOWED_ORIGINS = previous;
  }
});

test('rate limiter keys anonymous traffic by IP and method', async () => {
  const { rateLimitMiddleware } = await importMiddleware();
  const previous = process.env.MCP_RATE_LIMIT_PER_MINUTE;
  process.env.MCP_RATE_LIMIT_PER_MINUTE = '2';
  const ip = `198.51.100.${crypto.randomInt(1, 200)}`;
  try {
    for (let index = 0; index < 2; index += 1) {
      const res = createResponseRecorder();
      let nextCalled = false;
      rateLimitMiddleware(createRequest({ ip }), res, () => { nextCalled = true; });
      assert.equal(nextCalled, true);
    }
    const blocked = createResponseRecorder();
    let blockedNext = false;
    rateLimitMiddleware(createRequest({ ip }), blocked, () => { blockedNext = true; });
    assert.equal(blockedNext, false);
    assert.equal(blocked.statusCode, 429);
    assert.ok(Number(blocked.getHeader('retry-after')) >= 1);

    const otherMethod = createResponseRecorder();
    let otherMethodNext = false;
    rateLimitMiddleware(createRequest({ ip, method: 'DELETE' }), otherMethod, () => { otherMethodNext = true; });
    assert.equal(otherMethodNext, true);
  } finally {
    if (previous === undefined) delete process.env.MCP_RATE_LIMIT_PER_MINUTE;
    else process.env.MCP_RATE_LIMIT_PER_MINUTE = previous;
  }
});

test('SSE limit is per IP and releases the slot exactly once', async () => {
  const { sseConnectionLimitMiddleware } = await importMiddleware();
  const previous = process.env.MCP_MAX_SSE_PER_IP;
  process.env.MCP_MAX_SSE_PER_IP = '1';
  const ip = `203.0.113.${crypto.randomInt(1, 200)}`;
  try {
    const first = createResponseRecorder();
    let firstNext = false;
    sseConnectionLimitMiddleware(createRequest({ ip, method: 'GET' }), first, () => { firstNext = true; });
    assert.equal(firstNext, true);

    const blocked = createResponseRecorder();
    let blockedNext = false;
    sseConnectionLimitMiddleware(createRequest({ ip, method: 'GET' }), blocked, () => { blockedNext = true; });
    assert.equal(blockedNext, false);
    assert.equal(blocked.statusCode, 429);

    first.emit('close');
    first.emit('finish');
    const afterClose = createResponseRecorder();
    let afterCloseNext = false;
    sseConnectionLimitMiddleware(createRequest({ ip, method: 'GET' }), afterClose, () => { afterCloseNext = true; });
    assert.equal(afterCloseNext, true);
    afterClose.emit('close');
  } finally {
    if (previous === undefined) delete process.env.MCP_MAX_SSE_PER_IP;
    else process.env.MCP_MAX_SSE_PER_IP = previous;
  }
});

test('async request wrapper forwards rejected handlers to Express error middleware', async () => {
  const { asyncRequestHandler, mcpErrorMiddleware } = await importMiddleware();
  const expected = new Error('handler failed');
  let received;
  const next = (error) => { received = error; };
  const handler = async () => { throw expected; };

  asyncRequestHandler(handler)(createRequest(), createResponseRecorder(), next);
  await new Promise((resolveTick) => setImmediate(resolveTick));
  assert.equal(received, expected);

  const response = createResponseRecorder();
  mcpErrorMiddleware(expected, createRequest(), response, () => {
    throw new Error('error middleware should have handled a fresh response');
  });
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.payload.error, { code: -32603, message: 'Internal server error' });
});
