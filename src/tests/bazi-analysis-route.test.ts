import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { mockAIFeatureState } from './helpers/route-mock';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';

function mockBaziUserContext(
    t: import('node:test').TestContext,
    client: Record<string, unknown>,
) {
    const apiUtils = require('../lib/api-utils') as typeof import('../lib/api-utils');
    const routePath = require.resolve('../app/api/bazi/analysis/route');
    const pipelinePath = require.resolve('../lib/api/divination-pipeline');
    const originalRequireUserContext = apiUtils.requireUserContext;
    const originalGetSystemAdminClient = apiUtils.getSystemAdminClient;

    apiUtils.requireUserContext = (async () => ({
        user: { id: 'user-1' },
        db: client,
        supabase: client,
        accessToken: 'test-token',
    })) as unknown as typeof apiUtils.requireUserContext;

    apiUtils.getSystemAdminClient = (() => client) as unknown as typeof apiUtils.getSystemAdminClient;

    delete require.cache[routePath];
    delete require.cache[pipelinePath];

    t.after(() => {
        apiUtils.requireUserContext = originalRequireUserContext;
        apiUtils.getSystemAdminClient = originalGetSystemAdminClient;
        delete require.cache[routePath];
        delete require.cache[pipelinePath];
    });
}

test('bazi analysis route builds prompt from server chart context instead of client chartSummary', async (t) => {
  mockAIFeatureState(t);
    const creditsModule = require('../lib/user/credits') as any;
    const aiAccessModule = require('../lib/ai/ai-access') as any;
    const aiModule = require('../lib/ai/ai') as any;
    const rateLimitModule = require('../lib/rate-limit') as any;
    const aiAnalysisModule = require('../lib/ai/ai-analysis') as any;

    const originalGetUserAuthInfo = creditsModule.getUserAuthInfo;
    const originalAttemptCreditUse = creditsModule.attemptCreditUse;
    const originalRefundCreditsOrLog = creditsModule.refundCreditsOrLog;
    const originalResolveModelAccessAsync = aiAccessModule.resolveModelAccessAsync;
    const originalCallAIWithReasoning = aiModule.callAIWithReasoning;
    const originalCheckRateLimit = rateLimitModule.checkRateLimit;
    const originalGetClientIP = rateLimitModule.getClientIP;
    const originalCreateAIAnalysisConversation = aiAnalysisModule.createAIAnalysisConversation;

    let capturedUserPrompt = '';
    let capturedSystemPrompt = '';
    let capturedSourceData: Record<string, unknown> | null = null;
    const authClient = {
        from(table: string) {
            if (table === 'bazi_charts') {
                return {
                    select() {
                        return {
                            eq() {
                                return {
                                    eq() {
                                        return {
	                                            single: async () => ({
	                                                data: {
	                                                    id: '11111111-1111-1111-1111-111111111111',
	                                                    user_id: 'user-1',
	                                                    name: '张三',
	                                                    gender: 'male',
	                                                    birth_date: '1990-01-01',
	                                                    birth_time: '08:00',
	                                                    birth_place: '北京',
	                                                    calendar_type: 'solar',
	                                                    is_leap_month: false,
	                                                },
	                                                error: null,
	                                            }),
                                        };
                                    },
                                };
                            },
                        };
                    },
                };
            }

            if (table === 'bazi_case_profiles') {
                return {
                    select() {
                        return {
                            eq() {
                                return {
                                    eq() {
                                        return {
                                            maybeSingle: async () => ({
                                                data: {
                                                    id: 'profile-1',
                                                    user_id: 'user-1',
                                                    bazi_chart_id: '11111111-1111-1111-1111-111111111111',
                                                    master_review: {
                                                        strengthLevel: '偏强',
                                                        patterns: ['财格'],
                                                        yongShen: { basic: ['水'], advanced: ['壬'] },
                                                        xiShen: { basic: ['金'], advanced: [] },
                                                        jiShen: { basic: ['火'], advanced: [] },
                                                        xianShen: { basic: ['土'], advanced: [] },
                                                        summary: '财可生官。',
                                                    },
                                                    owner_feedback: {
                                                        occupation: '上班族',
                                                        education: '本科',
                                                        wealthLevel: '小康',
                                                        marriageStatus: '已婚',
                                                        healthStatus: '健康稳定',
                                                        familyStatusTags: ['父母助力'],
                                                        temperamentTags: ['务实'],
                                                        summary: '近年工作稳定。',
                                                    },
                                                    created_at: '2026-03-20T00:00:00.000Z',
                                                    updated_at: '2026-03-20T00:00:00.000Z',
                                                },
                                                error: null,
                                            }),
                                        };
                                    },
                                };
                            },
                        };
                    },
                };
            }

            if (table === 'bazi_case_events') {
                return {
                    select() {
                        return {
                            eq() {
                                return {
                                    order: async () => ({
                                        data: [
                                            {
                                                id: 'event-1',
                                                profile_id: 'profile-1',
                                                bazi_chart_id: '11111111-1111-1111-1111-111111111111',
                                                event_date: '2024-06-01',
                                                category: '事业',
                                                title: '晋升',
                                                detail: '升任主管',
                                                created_at: '2026-03-20T00:00:00.000Z',
                                                updated_at: '2026-03-20T00:00:00.000Z',
                                            },
                                        ],
                                        error: null,
                                    }),
                                };
                            },
                        };
                    },
                };
            }

            if (table === 'user_settings') {
                return {
                    select() {
                        return {
                            eq() {
                                return {
                                    maybeSingle: async () => ({
                                        data: {
                                            expression_style: 'direct',
                                            custom_instructions: '',
                                            user_profile: {},
                                            prompt_kb_ids: [],
                                            visualization_settings: {
                                                selectedDimensions: ['career', 'wealth'],
                                                dayunDisplayCount: 6,
                                                chartStyle: 'classic-chinese',
                                            },
                                        },
                                        error: null,
                                    }),
                                };
                            },
                        };
                    },
                };
            }

            throw new Error(`Unexpected table: ${table}`);
        },
    };

    mockBaziUserContext(t, authClient);

    creditsModule.getUserAuthInfo = async () => ({
        effectiveMembership: 'free',
        hasCredits: true,
    });
    creditsModule.attemptCreditUse = async () => ({ ok: true, remaining: 0 });
    creditsModule.refundCreditsOrLog = async () => true;
    aiAccessModule.resolveModelAccessAsync = async () => ({
        modelId: 'deepseek-v3.2',
        reasoningEnabled: false,
    });
    aiModule.callAIWithReasoning = async (messages: Array<{ content: string }>, _personality: string, _modelId: string, systemPrompt: string) => {
        capturedUserPrompt = messages[0]?.content || '';
        capturedSystemPrompt = systemPrompt;
        return {
            content: '分析结果',
            reasoning: null,
        };
    };
    rateLimitModule.checkRateLimit = async () => ({ allowed: true });
    rateLimitModule.getClientIP = () => '127.0.0.1';
    aiAnalysisModule.createAIAnalysisConversation = async (args: { sourceData: Record<string, unknown> }) => {
        capturedSourceData = args.sourceData;
        return 'conversation-1';
    };

    t.after(() => {
        creditsModule.getUserAuthInfo = originalGetUserAuthInfo;
        creditsModule.attemptCreditUse = originalAttemptCreditUse;
        creditsModule.refundCreditsOrLog = originalRefundCreditsOrLog;
        aiAccessModule.resolveModelAccessAsync = originalResolveModelAccessAsync;
        aiModule.callAIWithReasoning = originalCallAIWithReasoning;
        rateLimitModule.checkRateLimit = originalCheckRateLimit;
        rateLimitModule.getClientIP = originalGetClientIP;
        aiAnalysisModule.createAIAnalysisConversation = originalCreateAIAnalysisConversation;
    });

    const { POST } = await import('../app/api/bazi/analysis/route');
    const request = new NextRequest('http://localhost/api/bazi/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chartId: '11111111-1111-1111-1111-111111111111',
            type: 'wuxing',
            modelId: 'deepseek-v3.2',
            reasoning: false,
            stream: false,
        }),
    });

    const response = await POST(request);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.match(capturedUserPrompt, /断事笔记/u);
    assert.match(capturedUserPrompt, /岗位晋升|晋升/u);
    assert.match(capturedSystemPrompt, /```chart/u);
    assert.match(capturedSystemPrompt, /chartType、title、data/u);
    assert.match(capturedSystemPrompt, /事业\/学业/u);
    assert.match(capturedSystemPrompt, /财富/u);
    assert.match(capturedSystemPrompt, /6 个大运周期/u);
    assert.match(capturedSystemPrompt, /古典中文图表风格/u);
    assert.match(capturedSystemPrompt, /wuxing_energy/u);
    assert.match(capturedSystemPrompt, /fortune_radar/u);
    assert.match(capturedSystemPrompt, /fortune_calendar/u);
    assert.equal(capturedSourceData?.['case_profile_id'], 'profile-1');
    assert.match(String(capturedSourceData?.['case_prompt_snapshot'] || ''), /命主反馈/u);
});

test('bazi analysis route surfaces SSE error when stream persistence returns null after content generation', async (t) => {
  mockAIFeatureState(t);
    const creditsModule = require('../lib/user/credits') as any;
    const aiAccessModule = require('../lib/ai/ai-access') as any;
    const aiModule = require('../lib/ai/ai') as any;
    const rateLimitModule = require('../lib/rate-limit') as any;
    const aiAnalysisModule = require('../lib/ai/ai-analysis') as any;

    const originalGetUserAuthInfo = creditsModule.getUserAuthInfo;
    const originalAttemptCreditUse = creditsModule.attemptCreditUse;
    const originalRefundCreditsOrLog = creditsModule.refundCreditsOrLog;
    const originalResolveModelAccessAsync = aiAccessModule.resolveModelAccessAsync;
    const originalCallAIUIMessageResult = aiModule.callAIUIMessageResult;
    const originalCheckRateLimit = rateLimitModule.checkRateLimit;
    const originalGetClientIP = rateLimitModule.getClientIP;
    const originalCreateAIAnalysisConversation = aiAnalysisModule.createAIAnalysisConversation;
    const originalConsoleError = console.error;

    let refundCalls = 0;
    const authClient = {
        from(table: string) {
            if (table === 'bazi_charts') {
                return {
                    select() {
                        return {
                            eq() {
                                return {
                                    eq() {
                                        return {
	                                            single: async () => ({
	                                                data: {
	                                                    id: '11111111-1111-1111-1111-111111111111',
	                                                    user_id: 'user-1',
	                                                    name: '张三',
	                                                    gender: 'male',
	                                                    birth_date: '1990-01-01',
	                                                    birth_time: '08:00',
	                                                    birth_place: '北京',
	                                                    calendar_type: 'solar',
	                                                    is_leap_month: false,
	                                                },
	                                                error: null,
	                                            }),
                                        };
                                    },
                                };
                            },
                        };
                    },
                };
            }

            if (table === 'bazi_case_profiles') {
                return {
                    select() {
                        return {
                            eq() {
                                return {
                                    eq() {
                                        return {
                                            maybeSingle: async () => ({ data: null, error: null }),
                                        };
                                    },
                                };
                            },
                        };
                    },
                };
            }

            if (table === 'bazi_case_events') {
                return {
                    select() {
                        return {
                            eq() {
                                return {
                                    order: async () => ({ data: [], error: null }),
                                };
                            },
                        };
                    },
                };
            }

            if (table === 'user_settings') {
                return {
                    select() {
                        return {
                            eq() {
                                return {
                                    maybeSingle: async () => ({
                                        data: {
                                            expression_style: 'direct',
                                            custom_instructions: '',
                                            user_profile: {},
                                            prompt_kb_ids: [],
                                            visualization_settings: null,
                                        },
                                        error: null,
                                    }),
                                };
                            },
                        };
                    },
                };
            }

            throw new Error(`Unexpected table: ${table}`);
        },
    };

    mockBaziUserContext(t, authClient);

    creditsModule.getUserAuthInfo = async () => ({
        effectiveMembership: 'free',
        hasCredits: true,
    });
    creditsModule.attemptCreditUse = async () => ({ ok: true, remaining: 0 });
    creditsModule.refundCreditsOrLog = async () => {
        refundCalls += 1;
        return true;
    };
    aiAccessModule.resolveModelAccessAsync = async () => ({
        modelId: 'deepseek-v3.2',
        reasoningEnabled: false,
    });
    aiModule.callAIUIMessageResult = async () => ({
        toUIMessageStream(options?: {
            onFinish?: (event: {
                responseMessage: { parts: Array<Record<string, unknown>> };
                finishReason?: string;
                isAborted: boolean;
                isContinuation: boolean;
                messages: Array<{ parts: Array<Record<string, unknown>> }>;
            }) => PromiseLike<void> | void;
        }) {
            const stream = new ReadableStream<Record<string, unknown>>({
                start(controller) {
                    controller.enqueue({ type: 'reasoning-start', id: 'reasoning-1' });
                    controller.enqueue({ type: 'reasoning-delta', id: 'reasoning-1', delta: 'reason' });
                    controller.enqueue({ type: 'reasoning-end', id: 'reasoning-1' });
                    controller.enqueue({ type: 'text-start', id: 'text-1' });
                    controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'analysis' });
                    controller.enqueue({ type: 'text-end', id: 'text-1' });
                    controller.close();
                },
            });
            queueMicrotask(() => {
                void options?.onFinish?.({
                    responseMessage: {
                        parts: [
                            { type: 'reasoning', text: 'reason', state: 'done' },
                            { type: 'text', text: 'analysis', state: 'done' },
                        ],
                    },
                    finishReason: 'stop',
                    isAborted: false,
                    isContinuation: false,
                    messages: [],
                });
            });
            return stream;
        },
    });
    rateLimitModule.checkRateLimit = async () => ({ allowed: true });
    rateLimitModule.getClientIP = () => '127.0.0.1';
    aiAnalysisModule.createAIAnalysisConversation = async () => null;
    console.error = () => {};

    t.after(() => {
        creditsModule.getUserAuthInfo = originalGetUserAuthInfo;
        creditsModule.attemptCreditUse = originalAttemptCreditUse;
        creditsModule.refundCreditsOrLog = originalRefundCreditsOrLog;
        aiAccessModule.resolveModelAccessAsync = originalResolveModelAccessAsync;
        aiModule.callAIUIMessageResult = originalCallAIUIMessageResult;
        rateLimitModule.checkRateLimit = originalCheckRateLimit;
        rateLimitModule.getClientIP = originalGetClientIP;
        aiAnalysisModule.createAIAnalysisConversation = originalCreateAIAnalysisConversation;
        console.error = originalConsoleError;
    });

    const { POST } = await import('../app/api/bazi/analysis/route');
    const request = new NextRequest('http://localhost/api/bazi/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chartId: '11111111-1111-1111-1111-111111111111',
            type: 'wuxing',
            modelId: 'deepseek-v3.2',
            reasoning: false,
            stream: true,
        }),
    });

    const response = await POST(request);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-vercel-ai-ui-message-stream'), 'v1');
    assert.match(body, /"type":"text-delta","id":"text-1","delta":"analysis"/u);
    assert.match(body, /"type":"error","errorText":"保存结果失败，请稍后重试"/u);
    assert.match(body, /\[DONE\]/u);
    assert.equal(refundCalls, 1);
});
