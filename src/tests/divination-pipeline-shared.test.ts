import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import { ensureRouteTestEnv, mockAIFeatureState } from './helpers/route-mock';

ensureRouteTestEnv();

type MutableModule = Record<string, unknown>;

function createUIChunkStream(chunks: Array<Record<string, unknown>>): ReadableStream<Record<string, unknown>> {
  return new ReadableStream<Record<string, unknown>>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function createMockUIMessageResult(
  chunks: Array<Record<string, unknown>>,
  responseMessage: { parts: Array<Record<string, unknown>> },
  finishOptions?: { isAborted?: boolean; finishReason?: string },
) {
  return {
    toUIMessageStream(streamOptions?: {
      onFinish?: (event: {
        responseMessage: { parts: Array<Record<string, unknown>> };
        finishReason?: string;
        isAborted: boolean;
        isContinuation: boolean;
        messages: Array<{ parts: Array<Record<string, unknown>> }>;
      }) => PromiseLike<void> | void;
    }) {
      const stream = createUIChunkStream(chunks);
      queueMicrotask(() => {
        void streamOptions?.onFinish?.({
          responseMessage,
          finishReason: finishOptions?.finishReason ?? 'stop',
          isAborted: finishOptions?.isAborted ?? false,
          isContinuation: false,
          messages: [responseMessage],
        });
      });
      return stream;
    },
  };
}

function setupPipelineMocks(t: TestContext) {
  mockAIFeatureState(t);
  const apiUtils = require('../lib/api-utils') as MutableModule;
  const credits = require('../lib/user/credits') as MutableModule;
  const aiAccess = require('../lib/ai/ai-access') as MutableModule;
  const aiModule = require('../lib/ai/ai') as MutableModule;
  const aiAnalysisModule = require('../lib/ai/ai-analysis') as MutableModule;

  const originals = {
    requireBearerUser: apiUtils.requireBearerUser,
    getUserAuthInfo: credits.getUserAuthInfo,
    attemptCreditUse: credits.attemptCreditUse,
    useCredit: credits.useCredit,
    refundCreditsOrLog: credits.refundCreditsOrLog,
    addCredits: credits.addCredits,
    resolveModelAccessAsync: aiAccess.resolveModelAccessAsync,
    callAIWithReasoning: aiModule.callAIWithReasoning,
    callAIUIMessageResult: aiModule.callAIUIMessageResult,
    callAIVision: aiModule.callAIVision,
    createAIAnalysisConversation: aiAnalysisModule.createAIAnalysisConversation,
  };

  apiUtils.requireBearerUser = async () => ({
    user: { id: 'user-1' },
    supabase: {},
  });
  credits.getUserAuthInfo = async () => ({
    credits: 10,
    effectiveMembership: 'pro',
    hasCredits: true,
  });
  credits.attemptCreditUse = async () => ({
    ok: true,
    remaining: 1,
  });
  credits.useCredit = async () => 1;
  credits.refundCreditsOrLog = async () => true;
  credits.addCredits = async () => 1;
  aiAccess.resolveModelAccessAsync = async () => ({
    modelId: 'test-model',
    modelConfig: {
      id: 'test-model',
      modelKey: 'test-model',
      vendor: 'test',
      usageType: 'chat',
      supportsReasoning: true,
      supportsVision: false,
      requiredTier: 'free',
    },
    reasoningEnabled: false,
  });
  aiModule.callAIUIMessageResult = async () => createMockUIMessageResult([
    { type: 'reasoning-start', id: 'reasoning-1' },
    { type: 'reasoning-delta', id: 'reasoning-1', delta: 'reason' },
    { type: 'reasoning-end', id: 'reasoning-1' },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: 'analysis' },
    { type: 'text-end', id: 'text-1' },
  ], {
    parts: [
      { type: 'reasoning', text: 'reason', state: 'done' },
      { type: 'text', text: 'analysis', state: 'done' },
    ],
  });
  aiModule.callAIWithReasoning = async () => ({
    content: 'analysis',
    reasoning: 'reason',
  });
  aiModule.callAIVision = async () => 'vision-analysis';

  const createCalls: Array<Record<string, unknown>> = [];
  aiAnalysisModule.createAIAnalysisConversation = async (args: Record<string, unknown>) => {
    createCalls.push(args);
    return 'conv-1';
  };

  const pipelinePath = require.resolve('../lib/api/divination-pipeline');
  delete require.cache[pipelinePath];

  t.after(() => {
    apiUtils.requireBearerUser = originals.requireBearerUser;
    credits.getUserAuthInfo = originals.getUserAuthInfo;
    credits.attemptCreditUse = originals.attemptCreditUse;
    credits.useCredit = originals.useCredit;
    credits.refundCreditsOrLog = originals.refundCreditsOrLog;
    credits.addCredits = originals.addCredits;
    aiAccess.resolveModelAccessAsync = originals.resolveModelAccessAsync;
    aiModule.callAIWithReasoning = originals.callAIWithReasoning;
    aiModule.callAIUIMessageResult = originals.callAIUIMessageResult;
    aiModule.callAIVision = originals.callAIVision;
    aiAnalysisModule.createAIAnalysisConversation = originals.createAIAnalysisConversation;
    delete require.cache[pipelinePath];
  });

  return {
    apiUtils,
    credits,
    aiModule,
    aiAnalysisModule,
    createCalls,
    loadPipeline: () => {
      delete require.cache[pipelinePath];
      return require('../lib/api/divination-pipeline') as typeof import('../lib/api/divination-pipeline');
    },
  };
}

function createTestRequest() {
  return new NextRequest('http://localhost/api/test-divination', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token',
    },
  });
}

function createTestHandler(
  createInterpretHandler: typeof import('../lib/api/divination-pipeline').createInterpretHandler,
  persistRecord?: (input: Record<string, unknown>, userId: string, conversationId: string | null) => Promise<void>,
) {
  return createInterpretHandler<Record<string, unknown>>({
    sourceType: 'test_divination',
    tag: 'test-divination',
    parseInput: (body) => (body ?? {}) as Record<string, unknown>,
    buildPrompts: () => ({
      systemPrompt: 'system prompt',
      userPrompt: 'user prompt',
    }),
    buildSourceData: (input, modelId, reasoningEnabled) => ({
      inputId: input.id ?? null,
      modelId,
      reasoningEnabled,
    }),
    generateTitle: () => 'Shared Pipeline Test',
    persistRecord,
  });
}

test('divination pipeline returns 500 when credit deduction fails', async (t) => {
  const { credits, loadPipeline } = setupPipelineMocks(t);
  credits.attemptCreditUse = async () => ({
    ok: false,
    reason: 'deduction_failed',
  });

  const { createInterpretHandler } = loadPipeline();
  const handler = createTestHandler(createInterpretHandler);

  const response = await handler(createTestRequest(), { action: 'interpret' });
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.equal(payload.error, '积分扣减失败，请稍后重试');
});

test('divination pipeline resolves async validation before credit gate', async (t) => {
  const { credits, loadPipeline } = setupPipelineMocks(t);
  let authInfoCalls = 0;
  credits.getUserAuthInfo = async () => {
    authInfoCalls += 1;
    return {
      credits: 0,
      effectiveMembership: 'pro',
      hasCredits: false,
    };
  };

  const { createInterpretHandler } = loadPipeline();
  const handler = createInterpretHandler<Record<string, unknown>, { userId: string; chartPromptDetailLevel: 'full' }>({
    sourceType: 'test_divination',
    tag: 'test-divination',
    parseInput: (body) => (body ?? {}) as Record<string, unknown>,
    resolvePromptContext: async () => ({ error: '缺少前置条件', status: 400 }),
    buildPrompts: () => ({
      systemPrompt: 'system prompt',
      userPrompt: 'user prompt',
    }),
    buildSourceData: () => ({}),
    generateTitle: () => 'Shared Pipeline Test',
  });

  const response = await handler(createTestRequest(), { action: 'interpret' });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error, '缺少前置条件');
  assert.equal(authInfoCalls, 0);
});

test('divination pipeline persists streamed analysis and calls persistRecord after completion', async (t) => {
  const { createCalls, loadPipeline } = setupPipelineMocks(t);
  const persistCalls: Array<{ input: Record<string, unknown>; userId: string; conversationId: string | null }> = [];

  const { createInterpretHandler } = loadPipeline();
  const handler = createTestHandler(createInterpretHandler, async (input, userId, conversationId) => {
    persistCalls.push({ input, userId, conversationId });
  });

  const response = await handler(createTestRequest(), { action: 'interpret', id: 'input-1', stream: true });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-vercel-ai-ui-message-stream'), 'v1');
  assert.match(body, /"type":"text-delta","id":"text-1","delta":"analysis"/u);
  assert.ok(createCalls[0], 'createAIAnalysisConversation should be called');
  assert.equal(createCalls[0]?.sourceType, 'test_divination');
  assert.equal(createCalls[0]?.aiResponse, 'analysis');
  assert.equal((createCalls[0]?.sourceData as Record<string, unknown>)?.reasoning_text, 'reason');
  assert.deepEqual(persistCalls, [
    {
      input: { action: 'interpret', id: 'input-1', stream: true },
      userId: 'user-1',
      conversationId: 'conv-1',
    },
  ]);
});

test('divination pipeline surfaces an SSE error when stream persistence fails after content generation', async (t) => {
  const { loadPipeline } = setupPipelineMocks(t);
  const originalConsoleError = console.error;
  console.error = () => {};
  t.after(() => {
    console.error = originalConsoleError;
  });

  const { createInterpretHandler } = loadPipeline();
  const handler = createTestHandler(createInterpretHandler, async () => {
    throw new Error('persist failed');
  });

  const response = await handler(createTestRequest(), { action: 'interpret', stream: true });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /"type":"text-delta","id":"text-1","delta":"analysis"/u);
  assert.match(body, /"type":"error","errorText":"保存结果失败，请稍后重试"/u);
  assert.match(body, /\[DONE\]/u);
});

test('divination pipeline surfaces an SSE error when stream persistence returns null after content generation', async (t) => {
  const { aiAnalysisModule, credits, loadPipeline } = setupPipelineMocks(t);
  const originalConsoleError = console.error;
  let refundCalls = 0;
  console.error = () => {};
  aiAnalysisModule.createAIAnalysisConversation = async () => null;
  credits.refundCreditsOrLog = async () => {
    refundCalls += 1;
    return true;
  };

  t.after(() => {
    console.error = originalConsoleError;
  });

  const { createInterpretHandler } = loadPipeline();
  const handler = createTestHandler(createInterpretHandler);

  const response = await handler(createTestRequest(), { action: 'interpret', stream: true });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /"type":"text-delta","id":"text-1","delta":"analysis"/u);
  assert.match(body, /"type":"error","errorText":"保存结果失败，请稍后重试"/u);
  assert.match(body, /\[DONE\]/u);
  assert.equal(refundCalls, 1);
});

test('divination pipeline refunds and returns 500 when non-stream persistence returns null', async (t) => {
  const { aiAnalysisModule, credits, loadPipeline } = setupPipelineMocks(t);
  const originalConsoleError = console.error;
  let refundCalls = 0;

  console.error = () => {};
  aiAnalysisModule.createAIAnalysisConversation = async () => null;
  credits.refundCreditsOrLog = async () => {
    refundCalls += 1;
    return true;
  };

  t.after(() => {
    console.error = originalConsoleError;
  });

  const { createInterpretHandler } = loadPipeline();
  const handler = createTestHandler(createInterpretHandler);

  const response = await handler(createTestRequest(), { action: 'interpret' });
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.equal(payload.error, '保存结果失败，请稍后重试');
  assert.equal(refundCalls, 1);
});

test('divination vision pipeline refunds and returns 500 when persistence returns null', async (t) => {
  const { aiAnalysisModule, credits, loadPipeline } = setupPipelineMocks(t);
  const originalConsoleError = console.error;
  let refundCalls = 0;

  console.error = () => {};
  aiAnalysisModule.createAIAnalysisConversation = async () => null;
  credits.refundCreditsOrLog = async () => {
    refundCalls += 1;
    return true;
  };

  t.after(() => {
    console.error = originalConsoleError;
  });

  const { createInterpretHandler } = loadPipeline();
  const handler = createInterpretHandler<Record<string, unknown>>({
    sourceType: 'test_divination',
    tag: 'test-divination',
    isVision: true,
    parseInput: (body) => (body ?? {}) as Record<string, unknown>,
    buildPrompts: () => ({
      systemPrompt: 'system prompt',
      userPrompt: 'user prompt',
    }),
    buildSourceData: () => ({}),
    generateTitle: () => 'Vision Pipeline Test',
    buildVisionOptions: () => ({
      imageBase64: 'ZmFrZQ==',
      imageMimeType: 'image/png',
    }),
  });

  const response = await handler(createTestRequest(), { action: 'interpret' });
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.equal(payload.error, '保存结果失败，请稍后重试');
  assert.equal(refundCalls, 1);
});

test('divination pipeline skips persistence when streamed response is aborted', async (t) => {
  const { aiModule, createCalls, loadPipeline } = setupPipelineMocks(t);
  const persistCalls: Array<{ conversationId: string | null }> = [];

  aiModule.callAIUIMessageResult = async () => createMockUIMessageResult([
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: 'partial-analysis' },
    { type: 'text-end', id: 'text-1' },
  ], {
    parts: [
      { type: 'text', text: 'partial-analysis', state: 'done' },
    ],
  }, {
    isAborted: true,
    finishReason: 'stop',
  });

  const { createInterpretHandler } = loadPipeline();
  const handler = createTestHandler(createInterpretHandler, async (_input, _userId, conversationId) => {
    persistCalls.push({ conversationId });
  });

  const response = await handler(createTestRequest(), { action: 'interpret', stream: true });
  await response.text();

  assert.equal(response.status, 200);
  assert.deepEqual(createCalls, []);
  assert.deepEqual(persistCalls, []);
});

test('divination direct persist reuses server context without rerunning precheck or rebuilding prompts', async (t) => {
  const { createCalls, loadPipeline } = setupPipelineMocks(t);
  let precheckCalls = 0;
  let promptContextCalls = 0;
  let buildPromptsCalls = 0;

  const { createDirectInterpretHandlers } = loadPipeline();
  const handlers = createDirectInterpretHandlers<Record<string, unknown>, { owner: string }>({
    sourceType: 'test_divination',
    tag: 'test-divination',
    parseInput: (body) => (body ?? {}) as Record<string, unknown>,
    precheck: async () => {
      precheckCalls += 1;
      if (precheckCalls > 1) {
        return { error: '请求过于频繁，请稍后再试', status: 429 };
      }
      return null;
    },
    resolvePromptContext: async () => {
      promptContextCalls += 1;
      return { owner: 'server' };
    },
    buildPrompts: async () => {
      buildPromptsCalls += 1;
      if (buildPromptsCalls > 1) {
        throw new Error('buildPrompts should not be called during direct persist');
      }
      return {
        systemPrompt: 'system prompt',
        userPrompt: 'user prompt',
      };
    },
    buildSourceData: (_input, modelId, reasoningEnabled, promptContext) => ({
      modelId,
      reasoningEnabled,
      promptOwner: promptContext?.owner ?? null,
    }),
    generateTitle: () => 'Shared Pipeline Direct Test',
  });

  const prepareResponse = await handlers.handleDirectPrepare(createTestRequest(), {
    action: 'direct_prepare',
    id: 'input-1',
  });
  const preparePayload = await prepareResponse.json();

  assert.equal(prepareResponse.status, 200);
  assert.equal(preparePayload.data.systemPrompt, 'system prompt');
  assert.equal(preparePayload.data.userPrompt, 'user prompt');

  const persistResponse = await handlers.handleDirectPersist(createTestRequest(), {
    action: 'direct_persist',
    id: 'input-1',
    content: 'analysis',
    reasoningText: 'reason',
    customModelId: 'gpt-4.1-mini',
  });
  const persistPayload = await persistResponse.json();

  assert.equal(persistResponse.status, 200);
  assert.equal(persistPayload.data.conversationId, 'conv-1');
  assert.equal(precheckCalls, 1);
  assert.equal(buildPromptsCalls, 1);
  assert.equal(promptContextCalls, 2);
  assert.equal(createCalls.length, 1);
  assert.equal((createCalls[0]?.sourceData as Record<string, unknown>)?.promptOwner, 'server');
  assert.equal((createCalls[0]?.sourceData as Record<string, unknown>)?.custom_provider, true);
  assert.equal((createCalls[0]?.sourceData as Record<string, unknown>)?.custom_provider_model_id, 'gpt-4.1-mini');
  assert.equal((createCalls[0]?.sourceData as Record<string, unknown>)?.reasoning_text, 'reason');
});
