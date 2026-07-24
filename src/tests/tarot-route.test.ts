import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { captureConsoleErrors, ensureRouteTestEnv, mockAIFeatureState } from './helpers/route-mock';
import { createMockUIMessageResult } from './helpers/ui-message-result';

ensureRouteTestEnv();

function createTarotAuthContext(
    client: Record<string, unknown> = {},
    userId: string | null = 'user-1',
) {
    return {
        user: userId ? { id: userId } : null,
        db: client,
        supabase: client,
        accessToken: userId ? 'test-token' : null,
        authError: null,
    };
}

function mockTarotUserContext(
    t: import('node:test').TestContext,
    client: Record<string, unknown> = {},
    userId = 'user-1',
) {
    const apiUtilsModule = require('../lib/api-utils') as typeof import('../lib/api-utils');
    const routePath = require.resolve('../app/api/tarot/route');
    const pipelinePath = require.resolve('../lib/api/divination-pipeline');
    const originalRequireUserContext = apiUtilsModule.requireUserContext;

    apiUtilsModule.requireUserContext = async () =>
        createTarotAuthContext(client, userId) as Awaited<ReturnType<typeof import('../lib/api-utils').requireUserContext>>;

    delete require.cache[routePath];
    delete require.cache[pipelinePath];

    t.after(() => {
        apiUtilsModule.requireUserContext = originalRequireUserContext;
        delete require.cache[routePath];
        delete require.cache[pipelinePath];
    });
}

test('tarot route uses schema column names when inserting history', async (t) => {
  mockAIFeatureState(t);
    const credits = require('../lib/user/credits') as any;
    const aiAccessModule = require('../lib/ai/ai-access') as any;
    const aiModule = require('../lib/ai/ai') as any;
    const aiAnalysisModule = require('../lib/ai/ai-analysis') as any;
    const chartPromptDetailModule = require('../lib/ai/chart-prompt-detail') as any;
    const consoleCapture = captureConsoleErrors();

    const originalGetUserAuthInfo = credits.getUserAuthInfo;
    const originalAttemptCreditUse = credits.attemptCreditUse;
    const originalResolveModelAccessAsync = aiAccessModule.resolveModelAccessAsync;
    const originalCallAIWithReasoning = aiModule.callAIWithReasoning;
    const originalCreateConversation = aiAnalysisModule.createAIAnalysisConversation;
    const originalLoadResolvedChartPromptDetailLevel = chartPromptDetailModule.loadResolvedChartPromptDetailLevel;
    const originalFetch = global.fetch;

    let createArgs: Record<string, unknown> | null = null;

    mockTarotUserContext(t, {
        from() {
            throw new Error('tarot interpret test should not query tables directly');
        },
        rpc() {
            throw new Error('tarot interpret test should not call rpc directly');
        },
    });
    credits.getUserAuthInfo = async () => ({ credits: 10, effectiveMembership: 'free', hasCredits: true });
    credits.attemptCreditUse = async () => ({ ok: true, remaining: 9 });
    aiAccessModule.resolveModelAccessAsync = async () => ({
        modelId: 'test-model',
        modelConfig: { id: 'test-model' },
        reasoningEnabled: false,
    });
    aiModule.callAIWithReasoning = async () => ({
        content: 'analysis',
        reasoning: null,
    });
    aiAnalysisModule.createAIAnalysisConversation = async (params: Record<string, unknown>) => {
        createArgs = params;
        return 'conv-1';
    };
    chartPromptDetailModule.loadResolvedChartPromptDetailLevel = async () => 'default';
    global.fetch = async () => Response.json({
        choices: [{ index: 0, message: { content: 'analysis' } }],
    });

    t.after(() => {
        consoleCapture.restore();
        credits.getUserAuthInfo = originalGetUserAuthInfo;
        credits.attemptCreditUse = originalAttemptCreditUse;
        aiAccessModule.resolveModelAccessAsync = originalResolveModelAccessAsync;
        aiModule.callAIWithReasoning = originalCallAIWithReasoning;
        aiAnalysisModule.createAIAnalysisConversation = originalCreateConversation;
        chartPromptDetailModule.loadResolvedChartPromptDetailLevel = originalLoadResolvedChartPromptDetailLevel;
        global.fetch = originalFetch;
    });

    const { POST } = await import('../app/api/tarot/route');

    const request = new NextRequest('http://localhost/api/tarot', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
            action: 'interpret',
            spreadId: 'single',
            cards: [
                {
                    card: {
                        nameChinese: '测试牌',
                        keywords: ['关键词'],
                        uprightMeaning: '正位',
                        reversedMeaning: '逆位',
                    },
                    orientation: 'upright',
                },
            ],
        }),
    });

    const response = await POST(request);
    const data = await response.json();

    const hasMembershipWarning = consoleCapture.errors.some((line) =>
        line.includes('[membership] Failed') ||
        line.includes('[supabase-server] Missing Supabase service configuration')
    );
    assert.equal(hasMembershipWarning, false);
    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.ok(createArgs);
    assert.equal((createArgs as Record<string, unknown>).sourceType, 'tarot');
    assert.equal((createArgs as Record<string, unknown>).historyBinding?.type, 'tarot');
    assert.equal((createArgs as Record<string, unknown>).historyBinding?.payload?.spread_id, 'single');
    assert.equal('interpretation' in (((createArgs as Record<string, unknown>).historyBinding?.payload as Record<string, unknown>) || {}), false);
    assert.equal('spread_type' in (((createArgs as Record<string, unknown>).historyBinding?.payload as Record<string, unknown>) || {}), false);
    assert.equal('ai_interpretation' in (((createArgs as Record<string, unknown>).historyBinding?.payload as Record<string, unknown>) || {}), false);
});

test('tarot route persists analysis after streaming completes', async (t) => {
  mockAIFeatureState(t);
    const credits = require('../lib/user/credits') as any;
    const aiAccessModule = require('../lib/ai/ai-access') as any;
    const aiModule = require('../lib/ai/ai') as any;
    const aiAnalysisModule = require('../lib/ai/ai-analysis') as any;
    const chartPromptDetailModule = require('../lib/ai/chart-prompt-detail') as any;
    const originalGetUserAuthInfo = credits.getUserAuthInfo;
    const originalAttemptCreditUse = credits.attemptCreditUse;
    const originalResolveModelAccessAsync = aiAccessModule.resolveModelAccessAsync;
    const originalCallAIUIMessageResult = aiModule.callAIUIMessageResult;
    const originalCreateConversation = aiAnalysisModule.createAIAnalysisConversation;
    const originalLoadResolvedChartPromptDetailLevel = chartPromptDetailModule.loadResolvedChartPromptDetailLevel;

    let createArgs: Record<string, unknown> | null = null;

    mockTarotUserContext(t, {
        from() {
            throw new Error('tarot stream test should not query tables directly');
        },
        rpc() {
            throw new Error('tarot stream test should not call rpc directly');
        },
    });
    credits.getUserAuthInfo = async () => ({ credits: 10, effectiveMembership: 'pro', hasCredits: true });
    credits.attemptCreditUse = async () => ({ ok: true, remaining: 9 });
    aiAccessModule.resolveModelAccessAsync = async () => ({
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
    aiModule.callAIUIMessageResult = async () => createMockUIMessageResult();
    aiAnalysisModule.createAIAnalysisConversation = async (params: Record<string, unknown>) => {
        createArgs = params;
        return 'conv-1';
    };
    chartPromptDetailModule.loadResolvedChartPromptDetailLevel = async () => 'default';

    t.after(() => {
        credits.getUserAuthInfo = originalGetUserAuthInfo;
        credits.attemptCreditUse = originalAttemptCreditUse;
        aiAccessModule.resolveModelAccessAsync = originalResolveModelAccessAsync;
        aiModule.callAIUIMessageResult = originalCallAIUIMessageResult;
        aiAnalysisModule.createAIAnalysisConversation = originalCreateConversation;
        chartPromptDetailModule.loadResolvedChartPromptDetailLevel = originalLoadResolvedChartPromptDetailLevel;
    });

    const { POST } = await import('../app/api/tarot/route');

    const request = new NextRequest('http://localhost/api/tarot', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
            action: 'interpret',
            stream: true,
            readingId: 'reading-1',
            cards: [
                {
                    card: {
                        nameChinese: '测试牌',
                        keywords: ['关键词'],
                        uprightMeaning: '正位',
                        reversedMeaning: '逆位',
                    },
                    orientation: 'upright',
                },
            ],
        }),
    });

    const response = await POST(request);
    await response.text();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(response.headers.get('x-vercel-ai-ui-message-stream'), 'v1');
    assert.ok(createArgs);
    assert.equal((createArgs as Record<string, unknown>).sourceType, 'tarot');
    assert.equal((createArgs as Record<string, unknown>).historyBinding?.type, 'tarot');
    assert.equal((createArgs as Record<string, unknown>).historyBinding?.payload?.reading_id, 'reading-1');
});

test('tarot route surfaces SSE error when stream persistence fails after content generation', async (t) => {
  mockAIFeatureState(t);
    const credits = require('../lib/user/credits') as any;
    const aiAccessModule = require('../lib/ai/ai-access') as any;
    const aiModule = require('../lib/ai/ai') as any;
    const aiAnalysisModule = require('../lib/ai/ai-analysis') as any;
    const chartPromptDetailModule = require('../lib/ai/chart-prompt-detail') as any;
    const originalGetUserAuthInfo = credits.getUserAuthInfo;
    const originalAttemptCreditUse = credits.attemptCreditUse;
    const originalResolveModelAccessAsync = aiAccessModule.resolveModelAccessAsync;
    const originalCallAIUIMessageResult = aiModule.callAIUIMessageResult;
    const originalCreateConversation = aiAnalysisModule.createAIAnalysisConversation;
    const originalLoadResolvedChartPromptDetailLevel = chartPromptDetailModule.loadResolvedChartPromptDetailLevel;
    const originalConsoleError = console.error;

    mockTarotUserContext(t, {
        from() {
            throw new Error('tarot stream test should not query tables directly');
        },
        rpc() {
            throw new Error('tarot stream test should not call rpc directly');
        },
    });
    credits.getUserAuthInfo = async () => ({ credits: 10, effectiveMembership: 'pro', hasCredits: true });
    credits.attemptCreditUse = async () => ({ ok: true, remaining: 9 });
    aiAccessModule.resolveModelAccessAsync = async () => ({
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
    aiModule.callAIUIMessageResult = async () => createMockUIMessageResult();
    aiAnalysisModule.createAIAnalysisConversation = async () => {
        throw new Error('persist failed');
    };
    chartPromptDetailModule.loadResolvedChartPromptDetailLevel = async () => 'default';
    console.error = () => {};

    t.after(() => {
        credits.getUserAuthInfo = originalGetUserAuthInfo;
        credits.attemptCreditUse = originalAttemptCreditUse;
        aiAccessModule.resolveModelAccessAsync = originalResolveModelAccessAsync;
        aiModule.callAIUIMessageResult = originalCallAIUIMessageResult;
        aiAnalysisModule.createAIAnalysisConversation = originalCreateConversation;
        chartPromptDetailModule.loadResolvedChartPromptDetailLevel = originalLoadResolvedChartPromptDetailLevel;
        console.error = originalConsoleError;
    });

    const { POST } = await import('../app/api/tarot/route');
    const request = new NextRequest('http://localhost/api/tarot', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
            action: 'interpret',
            stream: true,
            readingId: 'reading-1',
            cards: [
                {
                    card: {
                        nameChinese: '测试牌',
                        keywords: ['关键词'],
                        uprightMeaning: '正位',
                        reversedMeaning: '逆位',
                    },
                    orientation: 'upright',
                },
            ],
        }),
    });

    const response = await POST(request);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-vercel-ai-ui-message-stream'), 'v1');
    assert.match(body, /"type":"text-delta","id":"text-1","delta":"analysis"/u);
    assert.match(body, /"type":"error","errorText":"保存结果失败，请稍后重试"/u);
});

test('tarot route returns 400 for invalid timezone on GET daily requests', async () => {
    const { GET } = await import('../app/api/tarot/route');

    const request = new NextRequest('http://localhost/api/tarot?action=daily&timezone=Bad/Timezone');
    const response = await GET(request);
    const data = await response.json();

    assert.equal(response.status, 400);
    assert.equal(data.success, false);
    assert.equal(data.error, 'timezone 无效');
});

test('tarot route returns numerology on draw-only and persists birth metadata on save', async (t) => {
    const apiUtilsModule = require('../lib/api-utils') as typeof import('../lib/api-utils');
    const routePath = require.resolve('../app/api/tarot/route');
    const pipelinePath = require.resolve('../lib/api/divination-pipeline');
    const originalGetAuthContext = apiUtilsModule.getAuthContext;
    const originalRequireUserContext = apiUtilsModule.requireUserContext;

    let inserted: Record<string, unknown> | null = null;
    const saveClient = {
        from(table: string) {
            assert.equal(table, 'tarot_readings');
            return {
                insert(payload: Record<string, unknown>) {
                    inserted = payload;
                    return {
                        select() {
                            return {
                                single: async () => ({
                                    data: { id: 'reading-1' },
                                    error: null,
                                }),
                            };
                        },
                    };
                },
            };
        },
    };

    apiUtilsModule.getAuthContext = async () =>
        createTarotAuthContext({}, null) as Awaited<ReturnType<typeof import('../lib/api-utils').getAuthContext>>;

    apiUtilsModule.requireUserContext = async () =>
        createTarotAuthContext(saveClient, 'user-1') as Awaited<ReturnType<typeof import('../lib/api-utils').requireUserContext>>;

    delete require.cache[routePath];
    delete require.cache[pipelinePath];

    t.after(() => {
        apiUtilsModule.getAuthContext = originalGetAuthContext;
        apiUtilsModule.requireUserContext = originalRequireUserContext;
        delete require.cache[routePath];
        delete require.cache[pipelinePath];
    });

    const { POST } = await import('../app/api/tarot/route');

    const drawOnlyResponse = await POST(new NextRequest('http://localhost/api/tarot', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'draw-only',
            spreadId: 'single',
            birthDate: '1990-01-01',
        }),
    }));
    const drawOnlyPayload = await drawOnlyResponse.json();

    assert.equal(drawOnlyResponse.status, 200);
    assert.equal(drawOnlyPayload.success, true);
    assert.ok(drawOnlyPayload.data?.numerology);
    assert.equal(typeof drawOnlyPayload.data?.numerology?.personalityCard?.nameChinese, 'string');

    const saveResponse = await POST(new NextRequest('http://localhost/api/tarot', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
            action: 'save',
            spreadId: 'single',
            question: '今天如何',
            birthDate: '1990-01-01',
            numerology: drawOnlyPayload.data?.numerology,
            cards: drawOnlyPayload.data?.cards,
        }),
    }));
    const savePayload = await saveResponse.json();

    assert.equal(saveResponse.status, 200);
    assert.equal(savePayload.success, true);
    assert.ok(inserted);
    assert.deepEqual((inserted as Record<string, unknown>).metadata, {
        birthDate: '1990-01-01',
        numerology: drawOnlyPayload.data?.numerology,
    });
});

test('tarot save should fail fast when metadata column is missing', async (t) => {
    const apiUtilsModule = require('../lib/api-utils') as typeof import('../lib/api-utils');
    const routePath = require.resolve('../app/api/tarot/route');
    const pipelinePath = require.resolve('../lib/api/divination-pipeline');
    const originalRequireUserContext = apiUtilsModule.requireUserContext;

    const inserted: Record<string, unknown>[] = [];
    let insertAttempts = 0;
    const saveClient = {
        from(table: string) {
            assert.equal(table, 'tarot_readings');
            return {
                insert(payload: Record<string, unknown>) {
                    insertAttempts += 1;
                    inserted.push(payload);
                    return {
                        select() {
                            return {
                                single: async () => ({
                                    data: 'metadata' in payload ? null : { id: 'reading-2' },
                                    error: 'metadata' in payload
                                        ? {
                                            message: 'column \"metadata\" of relation \"tarot_readings\" does not exist',
                                            code: 'PGRST204',
                                        }
                                        : null,
                                }),
                            };
                        },
                    };
                },
            };
        },
    };

    apiUtilsModule.requireUserContext = async () =>
        createTarotAuthContext(saveClient, 'user-1') as Awaited<ReturnType<typeof import('../lib/api-utils').requireUserContext>>;

    delete require.cache[routePath];
    delete require.cache[pipelinePath];

    t.after(() => {
        apiUtilsModule.requireUserContext = originalRequireUserContext;
        delete require.cache[routePath];
        delete require.cache[pipelinePath];
    });

    const { POST } = await import('../app/api/tarot/route');

    const response = await POST(new NextRequest('http://localhost/api/tarot', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
            action: 'save',
            spreadId: 'single',
            question: '今天如何',
            birthDate: '1990-01-01',
            numerology: {
                personalityCard: { number: 1, name: 'The Magician', nameChinese: '魔术师' },
                soulCard: { number: 2, name: 'The High Priestess', nameChinese: '女祭司' },
                yearlyCard: { number: 19, name: 'The Sun', nameChinese: '太阳', year: 2026 },
            },
            cards: [
                {
                    card: { nameChinese: '测试牌', keywords: ['关键词'], uprightMeaning: '正位', reversedMeaning: '逆位' },
                    orientation: 'upright',
                },
            ],
        }),
    }));

    const payload = await response.json();

    assert.equal(response.status, 500);
    assert.equal(payload.success, false);
    assert.equal(payload.error, '保存记录失败');
    assert.equal(insertAttempts, 1);
    assert.ok('metadata' in inserted[0]);
});

test('tarot spread persists reading for cookie-authenticated users without bearer header', async (t) => {
    const apiUtilsModule = require('../lib/api-utils') as typeof import('../lib/api-utils');
    const routePath = require.resolve('../app/api/tarot/route');
    const originalGetAuthContext = apiUtilsModule.getAuthContext;

    let inserted: Record<string, unknown> | null = null;
    const persistClient = {
        from(table: string) {
            assert.equal(table, 'tarot_readings');
            return {
                insert(payload: Record<string, unknown>) {
                    inserted = payload;
                    return {
                        select() {
                            return {
                                single: async () => ({
                                    data: { id: 'reading-cookie' },
                                    error: null,
                                }),
                            };
                        },
                    };
                },
            };
        },
    };

    apiUtilsModule.getAuthContext = async () =>
        createTarotAuthContext(persistClient, 'user-cookie') as Awaited<ReturnType<typeof import('../lib/api-utils').getAuthContext>>;

    delete require.cache[routePath];

    t.after(() => {
        apiUtilsModule.getAuthContext = originalGetAuthContext;
        delete require.cache[routePath];
    });

    const { POST } = await import('../app/api/tarot/route');
    const response = await POST(new NextRequest('http://localhost/api/tarot', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'spread',
            spreadId: 'single',
            question: '今天如何',
        }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data?.readingId, 'reading-cookie');
    assert.equal((inserted as Record<string, unknown>)?.user_id, 'user-cookie');
});
