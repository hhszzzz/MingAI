/**
 * MBTI 测试结果页面
 * 
 * 对齐 Notion 风格：极简卡片、文档流分析、线性图标
 */
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RotateCw, Sparkles, RefreshCw, ChevronLeft, BookOpenText } from 'lucide-react';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';
import { PersonalityCard } from '@/components/mbti/PersonalityCard';
import { buildViewResult, type TestResult } from '@/lib/divination/mbti';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { ModelSelector } from '@/components/ui/ModelSelector';
import { DEFAULT_MODEL_ID } from '@/lib/ai/ai-config';
import { useSessionMembership } from '@/lib/hooks/useSessionMembership';
import { ThinkingBlock } from '@/components/chat/ThinkingBlock';
import { AuthModal } from '@/components/auth/AuthModal';
import { AddToKnowledgeBaseModal } from '@/components/knowledge-base/AddToKnowledgeBaseModal';
import { AIFeatureGate } from '@/components/ai/AIFeatureGate';
import { useKnowledgeBaseFeatureEnabled } from '@/components/knowledge-base/useKnowledgeBaseFeatureEnabled';
import { readSessionJSON } from '@/lib/cache/session-storage';
import { useHeaderMenu } from '@/components/layout/HeaderMenuContext';
import { CreditsModal } from '@/components/ui/CreditsModal';
import { useStreamingResponse, isCreditsError } from '@/lib/hooks/useStreamingResponse';
import { useAnalysisSnapshot } from '@/lib/hooks/useAnalysisSnapshot';
import { runSharedAnalysisFlow } from '@/lib/ai/analysis-runner';
type MBTIResultSession = TestResult & {
    conversationId?: string | null;
    readingId?: string | null;
};

function MBTIResultContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setMenuItems, clearMenuItems } = useHeaderMenu();
    const { knowledgeBaseEnabled } = useKnowledgeBaseFeatureEnabled();
    const viewType = searchParams.get('type');
    const isViewMode = searchParams.get('view') === 'true';

    const [result, setResult] = useState<MBTIResultSession | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [analysisReasoning, setAnalysisReasoning] = useState<string | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
    const [reasoningEnabled, setReasoningEnabled] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [kbModalOpen, setKbModalOpen] = useState(false);
    const [showCreditsModal, setShowCreditsModal] = useState(false);
    const streaming = useStreamingResponse();
    const { user, userId, sessionLoading, membershipInfo, membershipLoading, membershipResolved } = useSessionMembership();
    const membershipPending = membershipLoading || !membershipResolved;
    const membershipType = membershipResolved ? (membershipInfo?.type ?? 'free') : 'free';
    const checkingAuth = sessionLoading || membershipPending;

    useEffect(() => {
        const stored = readSessionJSON<MBTIResultSession>('mbti_result');
        if (stored) {
            setResult(stored);
            setConversationId(stored.conversationId || null);
        } else if (isViewMode && viewType) {
            const viewResult = buildViewResult(viewType.toUpperCase());
            if (viewResult) setResult(viewResult);
            else router.push('/mbti');
        } else router.push('/mbti');
    }, [router, isViewMode, viewType]);

    useAnalysisSnapshot({
        conversationId,
        recordId: result?.readingId,
        divinationType: 'mbti',
        sessionKey: 'mbti_result',
        hasExistingAnalysis: !!aiAnalysis,
        skip: !result || !user,
        callbacks: {
            onAnalysis: setAiAnalysis,
            onReasoning: setAnalysisReasoning,
            onModelId: setSelectedModel,
            onReasoningEnabled: setReasoningEnabled,
            onConversationIdResolved: setConversationId,
        },
    });

    const handleGetAIAnalysis = async () => {
        if (!result || !user) { if (!user) setShowAuthModal(true); return; }
        setLoadingAI(true); streaming.reset(); setError(null); setAnalysisReasoning(null); setAiAnalysis(null);
        try {
            const baseBody = { type: result.type, scores: result.scores, percentages: result.percentages, readingId: result.readingId };
            const analysisResult = await runSharedAnalysisFlow({
                endpoint: '/api/mbti',
                streaming,
                isCreditsError,
                direct: {
                    prepareBody: { action: 'analyze_prepare', ...baseBody },
                    persistBody: { action: 'analyze_persist', ...baseBody },
                },
                streamBody: {
                    action: 'analyze',
                    ...baseBody,
                    modelId: selectedModel,
                    reasoning: reasoningEnabled,
                    stream: true,
                },
            });
            if (analysisResult.requiresCredits) setShowCreditsModal(true);
            else {
                if (analysisResult.error) setError(analysisResult.error);
                if (analysisResult.content) setAiAnalysis(analysisResult.content);
                if (analysisResult.reasoning) setAnalysisReasoning(analysisResult.reasoning);
                if (analysisResult.conversationId) setConversationId(analysisResult.conversationId);
            }
        } catch (err) { setError(err instanceof Error ? err.message : '分析失败'); } finally { setLoadingAI(false); }
    };

    const isTestMode = result ? (!isViewMode && result.scores && result.percentages) : false;
    const readingId = result?.readingId;

    useEffect(() => {
        if (!result) return;
        const items = [];
        if (isTestMode) items.push({ id: 'retest', label: '重新测试', icon: <RotateCw className="w-4 h-4" />, onClick: () => router.push('/mbti') });
        if (knowledgeBaseEnabled && readingId) items.push({ id: 'add-to-kb', label: '收藏', icon: <BookOpenText className="w-4 h-4" />, onClick: () => setKbModalOpen(true) });
        setMenuItems(items);
        return () => clearMenuItems();
    }, [knowledgeBaseEnabled, readingId, isTestMode, result, router, setMenuItems, clearMenuItems]);

    if (!result) return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <SoundWaveLoader variant="block" text="" />
        </div>
    );

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in space-y-8">
                {/* 头部导航 */}
                <div className="hidden md:flex items-center justify-between border-b border-border/60 pb-6">
                    <Link href="/mbti" className="text-sm font-medium text-foreground/40 hover:text-foreground hover:bg-background-secondary px-2 py-1 rounded-md transition-colors flex items-center gap-1"><ChevronLeft className="w-4 h-4" />返回 MBTI 首页</Link>
                    <div className="flex items-center gap-2">
                        {isTestMode && <button onClick={() => router.push('/mbti')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border hover:bg-background-secondary transition-colors"><RotateCw className="w-3.5 h-3.5" />重新测试</button>}
                    </div>
                </div>

                {/* 性格卡片 */}
                <PersonalityCard result={result} showDimensions={!!isTestMode} />

                {/* AI 深度分析 */}
                {isTestMode && (<AIFeatureGate>
                    <div className="bg-background border border-border rounded-md p-6 space-y-6">
                        <div className="flex items-center justify-between border-b border-border/60 pb-4">
                            <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-foreground/60"><Sparkles className="w-4 h-4 text-[#2eaadc]" />AI 深度分析</h3>
                            <div className="flex items-center gap-3">
                                <ModelSelector compact selectedModel={selectedModel} onModelChange={setSelectedModel} reasoningEnabled={reasoningEnabled} onReasoningChange={setReasoningEnabled} userId={userId} membershipType={membershipType} disabled={membershipPending} />
                                {aiAnalysis && <button onClick={handleGetAIAnalysis} disabled={loadingAI} className="p-1.5 rounded-md hover:bg-background-secondary transition-colors"><RefreshCw className={`w-3.5 h-3.5 ${loadingAI ? 'animate-spin' : ''}`} /></button>}
                            </div>
                        </div>

                        {error && <p className="text-red-500 text-xs px-1">{error}</p>}

                        {aiAnalysis || streaming.content ? (
                            <div className="prose prose-sm max-w-none">
                                {(analysisReasoning || streaming.reasoning) && <ThinkingBlock content={analysisReasoning || streaming.reasoning || ''} isStreaming={streaming.isStreaming && !aiAnalysis} />}
                                <MarkdownContent content={aiAnalysis || streaming.content || ''} className="text-sm text-foreground leading-relaxed" />
                            </div>
                        ) : (
                            <div className="py-12 text-center space-y-6">
                                {checkingAuth ? <SoundWaveLoader variant="inline" /> : !user ? (
                                    <div className="max-w-sm mx-auto space-y-4">
                                        <p className="text-sm text-foreground/40">登录后即可获取基于您性格维度的专属 AI 深度分析</p>
                                        <button onClick={() => setShowAuthModal(true)} className="w-full py-2 bg-[#2383e2] text-white text-sm font-medium rounded-md hover:bg-[#2383e2]/90 transition-colors">立即登录</button>
                                    </div>
                                ) : (
                                    <button onClick={handleGetAIAnalysis} disabled={loadingAI} className="inline-flex items-center gap-2 px-8 py-2.5 bg-[#2383e2] text-white text-sm font-bold rounded-md hover:bg-[#2383e2]/90 transition-all active:scale-95"><Sparkles className="w-4 h-4" />获取 AI 深度分析</button>
                                )}
                            </div>
                        )}
                    </div>
                </AIFeatureGate>)}

                {/* 底部收藏操作 */}
                {knowledgeBaseEnabled && !!readingId && (
                    <div className="flex justify-center pt-4">
                        <button onClick={() => setKbModalOpen(true)} className="flex items-center gap-2 px-6 py-2 rounded-md border border-border text-sm font-medium hover:bg-background-secondary transition-colors text-foreground/60"><BookOpenText className="w-4 h-4" />收藏至知识库</button>
                    </div>
                )}

                {/* 查看模式：开始测试按钮 */}
                {!isTestMode && (
                    <div className="text-center pt-8">
                        <Link href="/mbti" className="inline-flex items-center gap-2 px-8 py-2.5 bg-[#2383e2] text-white text-sm font-bold rounded-md hover:bg-[#2383e2]/90 transition-all shadow-sm"><Sparkles className="w-4 h-4" />开始 MBTI 测试</Link>
                    </div>
                )}
            </div>

            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
            <CreditsModal isOpen={showCreditsModal} onClose={() => setShowCreditsModal(false)} />
            {knowledgeBaseEnabled && readingId && <AddToKnowledgeBaseModal open={kbModalOpen} onClose={() => setKbModalOpen(false)} sourceTitle={`MBTI - ${result.type}`} sourceType="mbti_reading" sourceId={readingId} />}
        </div>
    );
}

export default function MBTIResultPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><SoundWaveLoader variant="block" /></div>}>
            <MBTIResultContent />
        </Suspense>
    );
}
