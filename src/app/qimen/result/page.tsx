/**
 * 奇门遁甲排盘结果页面
 *
 * 对齐 Notion 风格：极简列表、柔和边框、线性图标、去除渐变
 */
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, RotateCw, RefreshCw, Copy, Check, Info } from 'lucide-react';
import { QimenGrid } from '@/components/qimen/QimenGrid';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { ModelSelector } from '@/components/ui/ModelSelector';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';
import { ThinkingBlock } from '@/components/chat/ThinkingBlock';
import { AuthModal } from '@/components/auth/AuthModal';
import { CreditsModal } from '@/components/ui/CreditsModal';
import { AddToKnowledgeBaseModal } from '@/components/knowledge-base/AddToKnowledgeBaseModal';
import { useKnowledgeBaseFeatureEnabled } from '@/components/knowledge-base/useKnowledgeBaseFeatureEnabled';
import { useHeaderMenu } from '@/components/layout/HeaderMenuContext';
import { useStreamingResponse, isCreditsError } from '@/lib/hooks/useStreamingResponse';
import { readSessionJSON, updateSessionJSON } from '@/lib/cache/session-storage';
import { DEFAULT_MODEL_ID } from '@/lib/ai/ai-config';
import { runSharedAnalysisFlow } from '@/lib/ai/analysis-runner';
import { useSessionMembership } from '@/lib/hooks/useSessionMembership';
import { useAnalysisSnapshot } from '@/lib/hooks/useAnalysisSnapshot';
import { useAdminJsonCopy } from '@/lib/admin/useAdminJsonCopy';
import { CopyTextModal } from '@/components/divination/CopyTextModal';
import { AIFeatureGate } from '@/components/ai/AIFeatureGate';
import type { ChartTextDetailLevel } from '@/lib/divination/detail-level';
import { saveDivinationAction } from '@/lib/divination/save-client';
import {
    calculateQimenBundle,
    buildQimenCanonicalJSON,
    generateQimenChartText,
    type QimenInput,
    type QimenOutput,
} from '@/lib/divination/qimen';

/** 五行旺衰图例 */
const PHASE_LEGEND = [
    { label: '木旺', color: 'bg-green-500' },
    { label: '火相', color: 'bg-red-500' },
    { label: '水休', color: 'bg-blue-500' },
    { label: '金囚', color: 'bg-amber-500' },
    { label: '土死', color: 'bg-stone-500' },
];

interface QimenSessionData extends QimenInput {
    output?: QimenOutput;
    createdAt: string;
    chartId?: string;
    conversationId?: string;
}

function pickQimenInput(sessionData: QimenSessionData): QimenInput {
    return {
        year: sessionData.year,
        month: sessionData.month,
        day: sessionData.day,
        hour: sessionData.hour,
        minute: sessionData.minute,
        timezone: sessionData.timezone,
        question: sessionData.question,
        panType: sessionData.panType,
        juMethod: sessionData.juMethod,
        zhiFuJiGong: sessionData.zhiFuJiGong,
    };
}

function buildQimenActionPayload(sessionData: QimenSessionData) {
    return {
        year: sessionData.year,
        month: sessionData.month,
        day: sessionData.day,
        hour: sessionData.hour,
        minute: sessionData.minute,
        timezone: sessionData.timezone,
        question: sessionData.question,
        panType: sessionData.panType,
        juMethod: sessionData.juMethod,
        zhiFuJiGong: sessionData.zhiFuJiGong,
    };
}

export default function QimenResultPage() {
    const router = useRouter();
    const { setMenuItems, clearMenuItems } = useHeaderMenu();
    const { knowledgeBaseEnabled } = useKnowledgeBaseFeatureEnabled();
    const [result, setResult] = useState<QimenSessionData | null>(null);
    const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
    const [reasoningEnabled, setReasoningEnabled] = useState(false);
    const [interpretation, setInterpretation] = useState<string | null>(null);
    const [interpretationReasoning, setInterpretationReasoning] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showCreditsModal, setShowCreditsModal] = useState(false);
    const [showKbModal, setShowKbModal] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copyDetailLevel, setCopyDetailLevel] = useState<ChartTextDetailLevel>('default');
    const [showCopyModal, setShowCopyModal] = useState(false);
    const hasSavedRef = useRef(false);
    const streaming = useStreamingResponse();
    const { user, membershipInfo, sessionLoading, membershipLoading, membershipResolved } = useSessionMembership();
    const membershipPending = membershipLoading || !membershipResolved;
    const membershipType = membershipResolved ? (membershipInfo?.type ?? 'free') : 'free';
    const currentUser = useMemo(() => (user ? { id: user.id } : null), [user]);
    const qimenOutput = result?.output ?? null;
    const canonicalResult = useMemo(
        () => (qimenOutput ? buildQimenCanonicalJSON(qimenOutput) : null),
        [qimenOutput],
    );
    const { isAdmin, jsonCopied, copyJson } = useAdminJsonCopy(canonicalResult);

    useEffect(() => {
        if (sessionLoading) return;
        const init = async () => {
            const parsed = readSessionJSON<QimenSessionData>('qimen_result');
            if (!parsed) { router.push('/qimen'); return; }
            let nextResult = parsed;

            if (!nextResult.output) {
                try {
                    const { output } = await calculateQimenBundle(pickQimenInput(parsed));
                    nextResult = { ...parsed, output };
                    updateSessionJSON('qimen_result', () => nextResult);
                } catch (e) {
                    console.error('[qimen/result] 重新计算命盘失败:', e);
                    router.push('/qimen');
                    return;
                }
            }

            setResult(nextResult);

            if (!nextResult.chartId && currentUser && !hasSavedRef.current) {
                hasSavedRef.current = true;
                try {
                    const saveResult = await saveDivinationAction({
                        endpoint: '/api/qimen',
                        body: buildQimenActionPayload(nextResult),
                        idKey: 'chartId',
                        fallbackMessage: '保存奇门记录失败',
                    });
                    if (!saveResult.ok) {
                        throw new Error(saveResult.error.message || '保存奇门记录失败');
                    }
                    const savedChartId = saveResult.id;
                    if (savedChartId) {
                        updateSessionJSON('qimen_result', (prev) => ({ ...(prev || {}), chartId: savedChartId }));
                        setResult(prev => prev ? { ...prev, chartId: savedChartId } : prev);
                    }
                } catch (e) { console.error(e); }
            }
        };
        void init();
    }, [currentUser, router, sessionLoading]);

    useEffect(() => {
        const items = [
            { id: 'restart', label: '重新起课', icon: <RotateCw className="w-4 h-4" />, onClick: () => router.push('/qimen') },
        ];
        if (isAdmin && canonicalResult) items.push({ id: 'copy-json', label: jsonCopied ? 'JSON 已复制' : 'JSON', icon: jsonCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />, onClick: () => { void copyJson(); } });
        setMenuItems(items);
        return () => clearMenuItems();
    }, [router, isAdmin, canonicalResult, jsonCopied, copyJson, setMenuItems, clearMenuItems]);

    useAnalysisSnapshot({
        conversationId: result?.conversationId,
        recordId: result?.chartId,
        divinationType: 'qimen',
        sessionKey: 'qimen_result',
        hasExistingAnalysis: !!interpretation,
        skip: !result?.conversationId && !result?.chartId,
        callbacks: {
            onAnalysis: setInterpretation,
            onReasoning: setInterpretationReasoning,
            onModelId: setSelectedModel,
            onReasoningEnabled: setReasoningEnabled,
            onConversationIdResolved: (resolvedId) => {
                setResult(prev => prev ? { ...prev, conversationId: resolvedId } : prev);
                updateSessionJSON('qimen_result', (prev) => ({ ...(prev || {}), conversationId: resolvedId }));
            },
        },
    });

    const handleGetInterpretation = async () => {
        if (!result || !currentUser) return;
        setIsLoading(true); streaming.reset(); setError(null); setInterpretationReasoning(null); setInterpretation(null);
        try {
            const baseBody = {
                ...buildQimenActionPayload(result),
                chartId: result.chartId || null,
            };
            const analysisResult = await runSharedAnalysisFlow({
                endpoint: '/api/qimen',
                streaming,
                isCreditsError,
                direct: {
                    prepareBody: {
                        action: 'interpret_prepare',
                        ...baseBody,
                    },
                    persistBody: {
                        action: 'interpret_persist',
                        ...baseBody,
                    },
                },
                streamBody: {
                    action: 'interpret',
                    ...baseBody,
                    modelId: selectedModel,
                    reasoning: reasoningEnabled,
                    stream: true,
                },
            });
            if (analysisResult.requiresCredits) {
                setShowCreditsModal(true);
                return;
            }
            if (analysisResult.error) {
                setError(analysisResult.error);
                return;
            }
            if (analysisResult.content) {
                setInterpretation(analysisResult.content);
            } else {
                setInterpretation('解读失败');
            }
            if (analysisResult.reasoning) {
                setInterpretationReasoning(analysisResult.reasoning);
            }
            if (analysisResult.conversationId) {
                setResult((prev) => prev ? { ...prev, conversationId: analysisResult.conversationId || undefined } : prev);
                updateSessionJSON('qimen_result', (prev) => ({ ...(prev || {}), conversationId: analysisResult.conversationId }));
            }
        } catch (err) { setError(err instanceof Error ? err.message : '解读失败'); } finally { setIsLoading(false); }
    };

    const handleCopy = async () => {
        setShowCopyModal(true);
    };

    const handleConfirmCopy = async (level: ChartTextDetailLevel) => {
        if (!result?.output) return;
        setCopyDetailLevel(level);
        await navigator.clipboard.writeText(generateQimenChartText(result.output, {
            question: result.question,
            detailLevel: level,
        }));
        setCopied(true); setTimeout(() => setCopied(false), 2000);
        setShowCopyModal(false);
    };

    if (!result || !qimenOutput) return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <SoundWaveLoader variant="block" text="正在排盘" />
        </div>
    );

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in space-y-8">
                {/* 头部操作 */}
                <div className="hidden md:flex items-center justify-between border-b border-border/60 pb-6">
                    <Link href="/qimen" className="text-sm font-medium text-foreground/40 hover:text-foreground hover:bg-background-secondary px-2 py-1 rounded-md transition-colors">返回</Link>
                    <div className="flex items-center gap-2">
                        <button onClick={() => router.push('/qimen')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border hover:bg-background-secondary transition-colors"><RotateCw className="w-3.5 h-3.5" />重新起课</button>
                        <button onClick={handleCopy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border hover:bg-background-secondary transition-colors">{copied ? <Check className="w-3.5 h-3.5 text-[#0f7b6c]" /> : <Copy className="w-3.5 h-3.5" />}复制排盘</button>
                    </div>
                </div>

                {/* 占事信息 */}
                {(canonicalResult?.基本信息.占问 || result.question) && (
                    <div className="bg-background border border-border rounded-md p-4 flex items-center gap-3">
                        <Sparkles className="w-4 h-4 text-[#a083ff]" />
                        <span className="text-xs font-bold text-foreground/30 uppercase tracking-widest shrink-0">占事</span>
                        <span className="text-sm font-medium text-foreground">{canonicalResult?.基本信息.占问 || result.question}</span>
                    </div>
                )}

                {/* 排盘参数 */}
                <div className="bg-background-secondary/30 border border-border rounded-md p-6 space-y-4 relative group">
                    <div className="flex items-center gap-3">
                        <Info className="w-4 h-4 text-foreground/30" />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/60">排盘参数</h2>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            { label: '公历时间', value: qimenOutput.dateInfo.solarDate },
                            { label: '农历时间', value: qimenOutput.dateInfo.lunarDate },
                            { label: '四柱干支', value: canonicalResult?.基本信息.四柱 },
                            { label: '起局信息', value: canonicalResult ? `${canonicalResult.基本信息.局式} ${canonicalResult.基本信息.旬首}` : '' }
                        ].map(item => (
                            <div key={item.label} className="bg-background border border-border/60 rounded-md p-3">
                                <div className="text-[10px] font-bold text-foreground/30 uppercase mb-1">{item.label}</div>
                                <div className="text-xs font-medium text-foreground/80">{item.value}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 图例 */}
                <div className="flex items-center justify-center gap-4 py-2 border-y border-gray-50">
                    {PHASE_LEGEND.map(({ label, color }) => (
                        <div key={label} className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${color}`} />
                            <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-tighter">{label}</span>
                        </div>
                    ))}
                </div>

                {/* 九宫格 */}
                <div className="bg-background border border-border rounded-md overflow-hidden">
                    <QimenGrid palaces={canonicalResult?.九宫盘 || []} monthPhaseMap={qimenOutput.monthPhase} ju={canonicalResult?.基本信息.局式 || ''} />
                </div>

                {/* AI 解读 */}
                <AIFeatureGate><div className="bg-background border border-border rounded-md p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-border/60 pb-4">
                        <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-foreground/60"><Sparkles className="w-4 h-4 text-[#a083ff]" />AI 深度解读</h2>
                        <div className="flex items-center gap-2">
                            <ModelSelector compact selectedModel={selectedModel} onModelChange={setSelectedModel} reasoningEnabled={reasoningEnabled} onReasoningChange={setReasoningEnabled} userId={currentUser?.id} membershipType={membershipType} disabled={membershipPending} />
                            {(interpretation || streaming.isStreaming) && <button onClick={handleGetInterpretation} disabled={isLoading} className="p-1.5 rounded-md hover:bg-background-secondary transition-colors"><RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /></button>}
                        </div>
                    </div>
                    {error && (
                        <div className="p-3 bg-red-50 text-[#eb5757] text-xs rounded-md border border-red-100">
                            {error}
                        </div>
                    )}

                    {interpretation ? (
                        <div className="prose prose-sm max-w-none">
                            {interpretationReasoning && <ThinkingBlock content={interpretationReasoning} isStreaming={streaming.isStreaming && !interpretation} startTime={streaming.reasoningStartTime} duration={streaming.reasoningDuration} />}
                            <MarkdownContent content={interpretation} className="text-sm text-foreground leading-relaxed" />
                        </div>
                    ) : (
                        <div className="py-12 text-center space-y-6">
                            {sessionLoading || membershipPending ? (
                                <SoundWaveLoader variant="inline" />
                            ) : !currentUser ? (
                                <button onClick={() => setShowAuthModal(true)} className="px-8 py-2.5 bg-[#2383e2] text-white text-sm font-bold rounded-md hover:bg-[#2383e2]/90 transition-colors">登录解锁 AI 深度解读</button>
                            ) : (
                                <button onClick={handleGetInterpretation} disabled={isLoading || membershipPending} className="inline-flex items-center gap-2 px-8 py-2.5 bg-[#2383e2] text-white text-sm font-bold rounded-md hover:bg-[#2383e2]/90 transition-all active:scale-95 disabled:opacity-50"><Sparkles className="w-4 h-4" />获取 AI 解读</button>
                            )}
                        </div>
                    )}
                </div></AIFeatureGate>
            </div>

            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
            <CreditsModal isOpen={showCreditsModal} onClose={() => setShowCreditsModal(false)} />
            {knowledgeBaseEnabled && result.chartId && <AddToKnowledgeBaseModal open={showKbModal} onClose={() => setShowKbModal(false)} sourceTitle={result.question || '奇门遁甲排盘'} sourceType="qimen_chart" sourceId={result.chartId} />}
            <CopyTextModal
                isOpen={showCopyModal}
                value={copyDetailLevel}
                onChange={setCopyDetailLevel}
                onClose={() => setShowCopyModal(false)}
                onConfirm={handleConfirmCopy}
            />
        </div>
    );
}
