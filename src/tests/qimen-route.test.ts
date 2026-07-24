import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { ensureRouteTestEnv, mockAIFeatureState } from './helpers/route-mock';
import { createMockUIMessageResult } from './helpers/ui-message-result';

ensureRouteTestEnv();

function mockQimenUserContext(
    t: import('node:test').TestContext,
    client: Record<string, unknown> = {},
) {
    const apiUtilsModule = require('../lib/api-utils') as typeof import('../lib/api-utils');
    const routePath = require.resolve('../app/api/qimen/route');
    const pipelinePath = require.resolve('../lib/api/divination-pipeline');
    const originalRequireUserContext = apiUtilsModule.requireUserContext;

    apiUtilsModule.requireUserContext = async () => ({
        user: { id: 'user-1' },
        db: client,
        supabase: client,
        accessToken: 'test-token',
    }) as Awaited<ReturnType<typeof import('../lib/api-utils').requireUserContext>>;

    delete require.cache[routePath];
    delete require.cache[pipelinePath];

    t.after(() => {
        apiUtilsModule.requireUserContext = originalRequireUserContext;
        delete require.cache[routePath];
        delete require.cache[pipelinePath];
    });
}

test('qimen route persists analysis after streaming completes', async (t) => {
  mockAIFeatureState(t);
    const credits = require('../lib/user/credits') as any;
    const aiAccessModule = require('../lib/ai/ai-access') as any;
    const aiModule = require('../lib/ai/ai') as any;
    const aiAnalysisModule = require('../lib/ai/ai-analysis') as any;
    const chartPromptDetailModule = require('../lib/ai/chart-prompt-detail') as any;
    const supabaseModule = require('../lib/auth') as any;

    const originalGetUserAuthInfo = credits.getUserAuthInfo;
    const originalAttemptCreditUse = credits.attemptCreditUse;
    const originalResolveModelAccessAsync = aiAccessModule.resolveModelAccessAsync;
    const originalCallAIUIMessageResult = aiModule.callAIUIMessageResult;
    const originalCreateConversation = aiAnalysisModule.createAIAnalysisConversation;
    const originalLoadResolvedChartPromptDetailLevel = chartPromptDetailModule.loadResolvedChartPromptDetailLevel;
    const originalGetUser = supabaseModule.supabase.auth.getUser;

    let createArgs: Record<string, unknown> | null = null;

    mockQimenUserContext(t, {
        from() {
            throw new Error('qimen history test should not query tables directly');
        },
        rpc() {
            throw new Error('qimen history test should not call rpc directly');
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
    supabaseModule.supabase.auth.getUser = async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
    });

    t.after(() => {
        credits.getUserAuthInfo = originalGetUserAuthInfo;
        credits.attemptCreditUse = originalAttemptCreditUse;
        aiAccessModule.resolveModelAccessAsync = originalResolveModelAccessAsync;
        aiModule.callAIUIMessageResult = originalCallAIUIMessageResult;
        aiAnalysisModule.createAIAnalysisConversation = originalCreateConversation;
        chartPromptDetailModule.loadResolvedChartPromptDetailLevel = originalLoadResolvedChartPromptDetailLevel;
        supabaseModule.supabase.auth.getUser = originalGetUser;
    });

    const { POST } = await import('../app/api/qimen/route');
    const request = new NextRequest('http://localhost/api/qimen', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
            action: 'interpret',
            stream: true,
            chartId: 'chart-1',
            question: '测试问题',
            year: 2025,
            month: 1,
            day: 15,
            hour: 10,
            minute: 30,
            timezone: 'Asia/Shanghai',
            panType: 'zhuan',
            juMethod: 'chaibu',
            zhiFuJiGong: 'jiLiuYi',
        }),
    });

    const response = await POST(request);
    await response.text();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(response.headers.get('x-vercel-ai-ui-message-stream'), 'v1');
    assert.ok(createArgs);
    assert.equal((createArgs as Record<string, unknown>).sourceType, 'qimen');
    assert.equal((createArgs as Record<string, unknown>).historyBinding?.type, 'qimen');
    assert.equal((createArgs as Record<string, unknown>).historyBinding?.payload?.chart_id, 'chart-1');
});

test('qimen route surfaces SSE error when stream persistence fails after content generation', async (t) => {
  mockAIFeatureState(t);
    const credits = require('../lib/user/credits') as any;
    const aiAccessModule = require('../lib/ai/ai-access') as any;
    const aiModule = require('../lib/ai/ai') as any;
    const aiAnalysisModule = require('../lib/ai/ai-analysis') as any;
    const chartPromptDetailModule = require('../lib/ai/chart-prompt-detail') as any;
    const supabaseModule = require('../lib/auth') as any;
    const originalGetUserAuthInfo = credits.getUserAuthInfo;
    const originalAttemptCreditUse = credits.attemptCreditUse;
    const originalResolveModelAccessAsync = aiAccessModule.resolveModelAccessAsync;
    const originalCallAIUIMessageResult = aiModule.callAIUIMessageResult;
    const originalCreateConversation = aiAnalysisModule.createAIAnalysisConversation;
    const originalLoadResolvedChartPromptDetailLevel = chartPromptDetailModule.loadResolvedChartPromptDetailLevel;
    const originalGetUser = supabaseModule.supabase.auth.getUser;
    const originalConsoleError = console.error;

    mockQimenUserContext(t, {
        from() {
            throw new Error('qimen history test should not query tables directly');
        },
        rpc() {
            throw new Error('qimen history test should not call rpc directly');
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
    supabaseModule.supabase.auth.getUser = async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
    });
    console.error = () => {};

    t.after(() => {
        credits.getUserAuthInfo = originalGetUserAuthInfo;
        credits.attemptCreditUse = originalAttemptCreditUse;
        aiAccessModule.resolveModelAccessAsync = originalResolveModelAccessAsync;
        aiModule.callAIUIMessageResult = originalCallAIUIMessageResult;
        aiAnalysisModule.createAIAnalysisConversation = originalCreateConversation;
        chartPromptDetailModule.loadResolvedChartPromptDetailLevel = originalLoadResolvedChartPromptDetailLevel;
        supabaseModule.supabase.auth.getUser = originalGetUser;
        console.error = originalConsoleError;
    });

    const { POST } = await import('../app/api/qimen/route');
    const request = new NextRequest('http://localhost/api/qimen', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
            action: 'interpret',
            stream: true,
            chartId: 'chart-1',
            question: '测试问题',
            year: 2025,
            month: 1,
            day: 15,
            hour: 10,
            minute: 30,
            timezone: 'Asia/Shanghai',
            panType: 'zhuan',
            juMethod: 'chaibu',
            zhiFuJiGong: 'jiLiuYi',
        }),
    });

    const response = await POST(request);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-vercel-ai-ui-message-stream'), 'v1');
    assert.match(body, /"type":"text-delta","id":"text-1","delta":"analysis"/u);
    assert.match(body, /"type":"error","errorText":"保存结果失败，请稍后重试"/u);
});

test('qimen save persists base inputs instead of chart_data', async (t) => {
    let insertedPayload: Record<string, unknown> | null = null;
    const authClient = {
        from: (table: string) => {
            assert.equal(table, 'qimen_charts');
            return {
                insert: (payload: Record<string, unknown>) => {
                    insertedPayload = payload;
                    return {
                        select: () => ({
                            single: async () => ({
                                data: { id: 'chart-1' },
                                error: null,
                            }),
                        }),
                    };
                },
            };
        },
    };

    mockQimenUserContext(t, authClient);

    const { POST } = await import('../app/api/qimen/route');
    const request = new NextRequest('http://localhost/api/qimen', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
            action: 'save',
            question: '测试问题',
            year: 2025,
            month: 1,
            day: 15,
            hour: 10,
            minute: 30,
            timezone: 'Asia/Shanghai',
            panType: 'zhuan',
            juMethod: 'chaibu',
            zhiFuJiGong: 'jiLiuYi',
        }),
    });

    const response = await POST(request);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.data.chartId, 'chart-1');
    assert.ok(insertedPayload);
    const insertedRecord = insertedPayload as Record<string, unknown>;
    assert.equal(insertedRecord.question, '测试问题');
    assert.equal(insertedRecord.year, 2025);
    assert.equal(insertedRecord.month, 1);
    assert.equal(insertedRecord.day, 15);
    assert.equal(insertedRecord.hour, 10);
    assert.equal(insertedRecord.minute, 30);
    assert.equal(insertedRecord.timezone, 'Asia/Shanghai');
    assert.equal(insertedRecord.pan_type, 'zhuan');
    assert.equal(insertedRecord.ju_method, 'chaibu');
    assert.equal(insertedRecord.zhi_fu_ji_gong, 'ji_liuyi');
    assert.equal(typeof insertedRecord.chart_time, 'string');
    assert.ok(!('chart_data' in insertedRecord));
});

test('qimen route rejects unsupported juMethod before auth', async () => {
    const { POST } = await import('../app/api/qimen/route');
    const request = new NextRequest('http://localhost/api/qimen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'calculate',
            year: 2025,
            month: 1,
            day: 15,
            hour: 10,
            minute: 30,
            juMethod: 'zhirun',
        }),
    });

    const response = await POST(request);
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, '定局法无效');
});

test('qimen route rejects unsupported zhiFuJiGong before auth', async () => {
    const { POST } = await import('../app/api/qimen/route');
    const request = new NextRequest('http://localhost/api/qimen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'calculate',
            year: 2025,
            month: 1,
            day: 15,
            hour: 10,
            minute: 30,
            zhiFuJiGong: 'invalid-value',
        }),
    });

    const response = await POST(request);
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, '直符寄宫配置无效');
});
