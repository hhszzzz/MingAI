/**
 * 六爻解卦结果页面
 *
 * 对齐 Notion 风格：极简布局、文档流解读、线性图标
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, RotateCw, AlertCircle, BookOpen, RefreshCw, Copy, Check, BookOpenText, X, Album } from 'lucide-react';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';
import { HexagramDisplay } from '@/components/liuyao/HexagramDisplay';
import { TraditionalAnalysis } from '@/components/liuyao/TraditionalAnalysis';
import { YongShenTargetPicker } from '@/components/liuyao/YongShenTargetPicker';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { ModelSelector } from '@/components/ui/ModelSelector';
import { ThinkingBlock } from '@/components/chat/ThinkingBlock';
import {
    buildLiuyaoCanonicalJSON,
    calculateLiuyaoBundle,
    generateLiuyaoChartText,
    type DivinationResult,
    type LiuQin,
    normalizeYongShenTargets,
} from '@/lib/divination/liuyao';
import {
    resolveResultYongShenState,
    resolveResultYongShenTargets,
    resolveTraditionalYongShenPositions,
} from '@/lib/divination/liuyao-result-state';
import { DEFAULT_MODEL_ID } from '@/lib/ai/ai-config';
import { useSessionMembership } from '@/lib/hooks/useSessionMembership';
import { readSessionJSON, updateSessionJSON } from '@/lib/cache/session-storage';
import { AuthModal } from '@/components/auth/AuthModal';
import { AddToKnowledgeBaseModal } from '@/components/knowledge-base/AddToKnowledgeBaseModal';
import { useKnowledgeBaseFeatureEnabled } from '@/components/knowledge-base/useKnowledgeBaseFeatureEnabled';
import { useHeaderMenu } from '@/components/layout/HeaderMenuContext';
import { CreditsModal } from '@/components/ui/CreditsModal';
import { useStreamingResponse, isCreditsError } from '@/lib/hooks/useStreamingResponse';
import { useAnalysisSnapshot } from '@/lib/hooks/useAnalysisSnapshot';
import { LIU_QIN_TIPS, SHEN_XI_TIPS, TERM_TIPS } from '@/lib/divination/liuyao-term-tips';
import { useAdminJsonCopy } from '@/lib/admin/useAdminJsonCopy';
import { runSharedAnalysisFlow } from '@/lib/ai/analysis-runner';
import { CopyTextModal } from '@/components/divination/CopyTextModal';
import { AIFeatureGate } from '@/components/ai/AIFeatureGate';
import type { ChartTextDetailLevel } from '@/lib/divination/detail-level';

type LiuyaoResultSession = Omit<DivinationResult, 'createdAt'> & {
    createdAt: string;
    divinationId?: string | null;
    conversationId?: string | null;
};

type LiuyaoQuestionSession = {
    yongShenTargets?: LiuQin[];
};

export default function ResultPage() {
    const router = useRouter();
    const { setMenuItems, clearMenuItems } = useHeaderMenu();
    const { knowledgeBaseEnabled } = useKnowledgeBaseFeatureEnabled();
    const [result, setResult] = useState<DivinationResult | null>(null);
    const [divinationId, setDivinationId] = useState<string | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [interpretation, setInterpretation] = useState<string | null>(null);
    const [interpretationReasoning, setInterpretationReasoning] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showTraditional, setShowTraditional] = useState(true);
    const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
    const [reasoningEnabled, setReasoningEnabled] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [kbModalOpen, setKbModalOpen] = useState(false);
    const [showCreditsModal, setShowCreditsModal] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [pendingYongShenTargets, setPendingYongShenTargets] = useState<LiuQin[]>([]);
    const [copyDetailLevel, setCopyDetailLevel] = useState<ChartTextDetailLevel>('default');
    const [showCopyModal, setShowCopyModal] = useState(false);
    const streaming = useStreamingResponse();
    const [copied, setCopied] = useState(false);
    const { user, userId, membershipInfo, membershipLoading, membershipResolved } = useSessionMembership();
    const membershipPending = membershipLoading || !membershipResolved;
    const membershipType = membershipResolved ? (membershipInfo?.type ?? 'free') : 'free';

    const yongShenTargetState = useMemo(() => (
        resolveResultYongShenState(result?.yongShenTargets, pendingYongShenTargets)
    ), [pendingYongShenTargets, result?.yongShenTargets]);
    const appliedYongShenTargets = yongShenTargetState.appliedTargets;
    const requiresYongShenTargets = Boolean(result?.question?.trim());
    const missingYongShenTargets = requiresYongShenTargets && appliedYongShenTargets.length === 0;
    const hasAppliedTargets = appliedYongShenTargets.length > 0;
    const canAnalyze = requiresYongShenTargets && hasAppliedTargets;
    const liuyaoBundle = useMemo(() => {
        if (!result || !canAnalyze) return null;
        return calculateLiuyaoBundle({
            yaos: result.yaos,
            question: result.question,
            date: result.createdAt,
            yongShenTargets: appliedYongShenTargets,
            hexagram: result.hexagram,
            changedHexagram: result.changedHexagram,
        });
    }, [appliedYongShenTargets, canAnalyze, result]);

    const traditionalCanonical = useMemo(() => {
        if (!liuyaoBundle) return null;
        return buildLiuyaoCanonicalJSON(liuyaoBundle.output);
    }, [liuyaoBundle]);
    const { isAdmin, jsonCopied, copyJson } = useAdminJsonCopy(traditionalCanonical);
    const traditionalYongShenPositions = useMemo(() => resolveTraditionalYongShenPositions(traditionalCanonical), [traditionalCanonical]);

    const handleCopy = async () => {
        setShowCopyModal(true);
    };

    const handleConfirmCopy = async (level: ChartTextDetailLevel) => {
        setCopyDetailLevel(level);
        const text = liuyaoBundle
            ? generateLiuyaoChartText(liuyaoBundle.output, { detailLevel: level })
            : '';
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        setShowCopyModal(false);
    };

    useEffect(() => {
        const parsed = readSessionJSON<LiuyaoResultSession>('liuyao_result');
        if (parsed) {
            const questionPayload = readSessionJSON<LiuyaoQuestionSession | string>('liuyao_question');
            const questionSessionTargets = questionPayload && typeof questionPayload !== 'string'
                ? questionPayload.yongShenTargets
                : [];
            const normalizedTargets = resolveResultYongShenTargets(parsed.yongShenTargets, [], questionSessionTargets || []);
            setResult({ ...parsed, createdAt: new Date(parsed.createdAt), yongShenTargets: normalizedTargets });
            setPendingYongShenTargets(normalizedTargets);
            setDivinationId(parsed.divinationId || null);
            setConversationId(parsed.conversationId || null);
        } else router.push('/liuyao');
    }, [router]);

    useEffect(() => {
        const items = [
            { id: 'restart', label: '重新起卦', icon: <RotateCw className="w-4 h-4" />, onClick: () => router.push('/liuyao') },
            { id: 'traditional', label: showTraditional ? '隐藏传统' : '显示传统', icon: <BookOpen className="w-4 h-4" />, onClick: () => setShowTraditional(!showTraditional) },
            { id: 'terms', label: '术语参考', icon: <Album className="w-4 h-4" />, onClick: () => setShowTermsModal(true) },
        ];
        if (knowledgeBaseEnabled && divinationId) items.push({ id: 'add-to-kb', label: '收藏', icon: <BookOpenText className="w-4 h-4" />, onClick: () => setKbModalOpen(true) });
        if (isAdmin && traditionalCanonical) items.push({ id: 'copy-json', label: jsonCopied ? 'JSON 已复制' : 'JSON', icon: jsonCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />, onClick: () => { void copyJson(); } });
        setMenuItems(items);
        return () => clearMenuItems();
    }, [divinationId, knowledgeBaseEnabled, showTraditional, isAdmin, traditionalCanonical, jsonCopied, copyJson, router, setMenuItems, clearMenuItems]);

    useAnalysisSnapshot({
        conversationId,
        recordId: divinationId,
        divinationType: 'liuyao',
        sessionKey: 'liuyao_result',
        hasExistingAnalysis: !!interpretation,
        skip: !result,
        callbacks: {
            onAnalysis: setInterpretation,
            onReasoning: setInterpretationReasoning,
            onModelId: setSelectedModel,
            onReasoningEnabled: setReasoningEnabled,
            onConversationIdResolved: setConversationId,
        },
    });

    const handleGetInterpretation = async () => {
        if (!result || !user || !canAnalyze) return;
        setIsLoading(true); streaming.reset(); setError(null); setInterpretationReasoning(null); setInterpretation(null);
        try {
            const baseBody = {
                question: result.question,
                yongShenTargets: appliedYongShenTargets,
                hexagram: result.hexagram,
                changedHexagram: result.changedHexagram,
                changedLines: result.changedLines,
                yaos: result.yaos,
                divinationId,
            };
            const analysisResult = await runSharedAnalysisFlow({
                endpoint: '/api/liuyao',
                streaming,
                isCreditsError,
                direct: {
                    prepareBody: { action: 'interpret_prepare', ...baseBody },
                    persistBody: { action: 'interpret_persist', ...baseBody },
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
            if (analysisResult.error) throw new Error(analysisResult.error);
            setInterpretation(analysisResult.content || '解读失败');
            if (analysisResult.reasoning) setInterpretationReasoning(analysisResult.reasoning);
            if (analysisResult.conversationId) {
                setConversationId(analysisResult.conversationId);
                updateSessionJSON('liuyao_result', (prev: LiuyaoResultSession | null) => ({ ...(prev || {}), conversationId: analysisResult.conversationId } as LiuyaoResultSession));
            }
        } catch (err) { setError(err instanceof Error ? err.message : '解读失败'); } finally { setIsLoading(false); }
    };

    const handleApplyYongShenTargets = async () => {
        if (!result) return;
        const normalized = normalizeYongShenTargets(pendingYongShenTargets);
        if (normalized.length === 0) { setError('请至少选择一个分析目标'); return; }
        setError(null);
        setResult(prev => prev ? ({ ...prev, yongShenTargets: normalized }) : null);
        updateSessionJSON('liuyao_result', (prev: LiuyaoResultSession | null) => ({ ...(prev || {}), yongShenTargets: normalized } as LiuyaoResultSession));
        if (divinationId && userId) {
            await fetch('/api/liuyao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', divinationId, yongShenTargets: normalized }) });
        }
    };

    if (!result) return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-center animate-fade-in">
                <SoundWaveLoader variant="block" text="正在推演卦象" />
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in space-y-8">
                {/* 头部导航 */}
                <header className="space-y-6">
                    <div className="hidden md:flex items-start justify-between">
                        <div className="space-y-2">
                            <Link href="/liuyao" className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/40 hover:text-foreground transition-colors">返回</Link>
                            <h1 className="text-3xl font-semibold tracking-tight text-foreground">六爻解卦结果</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => router.push('/liuyao')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border hover:bg-background-secondary transition-colors"><RotateCw className="w-3.5 h-3.5" />重新起卦</button>
                            <button onClick={() => setShowTraditional(!showTraditional)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${showTraditional ? 'text-[#2eaadc] bg-blue-50/50 border border-blue-100' : 'border border-border hover:bg-background-secondary'}`}><BookOpen className="w-3.5 h-3.5" />传统分析</button>
                            <button onClick={() => setShowTermsModal(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border hover:bg-background-secondary transition-colors"><Album className="w-3.5 h-3.5" />术语</button>
                        </div>
                    </div>

                    {/* 问题与目标 */}
                    <div className="space-y-3">
                    {result.question && (
                            <div className="flex items-center gap-3 px-1">
                            <Sparkles className="w-4 h-4 text-[#a083ff]" />
                            <span className="text-xs font-bold text-foreground/30 uppercase tracking-widest shrink-0">所问事项</span>
                            <span className="text-sm font-medium text-foreground">{result.question}</span>
                        </div>
                    )}

                        {missingYongShenTargets && (
                            <div className="border border-blue-100 rounded-md p-5 space-y-4 bg-blue-50/30">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-semibold text-[#2eaadc]">选择分析目标</h3>
                                    <p className="text-xs text-foreground/50">先明确本次解卦重点，再进入后续分析。</p>
                                </div>
                                <YongShenTargetPicker value={pendingYongShenTargets} onChange={setPendingYongShenTargets} variant="block" />
                                <div className="flex justify-end">
                                    <button onClick={handleApplyYongShenTargets} disabled={pendingYongShenTargets.length === 0} className="px-4 py-1.5 bg-[#2eaadc] text-white text-sm font-medium rounded-md hover:bg-[#2eaadc]/90 transition-colors disabled:opacity-50">确认</button>
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                {/* 卦象主舞台 */}
                <section className="relative px-2 py-6 md:px-4">
                    <button onClick={handleCopy} className="absolute top-4 right-4 p-2 rounded-md border border-border/60 text-foreground/20 hover:text-foreground hover:bg-background-secondary transition-all" title="复制卦象数据">
                        {copied ? <Check className="w-3.5 h-3.5 text-[#0f7b6c]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <div className="max-w-full overflow-x-auto">
                        <HexagramDisplay yaos={result.yaos} hexagram={result.hexagram} changedHexagram={result.changedHexagram} changedLines={result.changedLines} showDetails={true} fullYaos={traditionalCanonical?.六爻} showTraditional={showTraditional} yongShenPositions={traditionalYongShenPositions} />
                    </div>
                </section>

                {/* 传统分析 */}
                {showTraditional && traditionalCanonical && (
                    <section>
                        <TraditionalAnalysis analysis={traditionalCanonical} />
                    </section>
                )}

                {/* AI 解读 */}
                <AIFeatureGate><div className="bg-background border border-border rounded-md p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-border/60 pb-4">
                        <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-foreground/60"><Sparkles className="w-4 h-4 text-[#a083ff]" />AI 深度解读</h2>
                        <div className="flex items-center gap-2">
                            <ModelSelector compact selectedModel={selectedModel} onModelChange={setSelectedModel} reasoningEnabled={reasoningEnabled} onReasoningChange={setReasoningEnabled} userId={userId} membershipType={membershipType} disabled={membershipPending} />
                            {(interpretation || streaming.isStreaming) && <button onClick={handleGetInterpretation} disabled={isLoading} className="p-1.5 rounded-md hover:bg-background-secondary transition-colors"><RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /></button>}
                        </div>
                    </div>

                    {error && <div className="p-3 bg-red-50 text-[#eb5757] text-xs rounded-md border border-red-100 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5" />{error}</div>}

                    {(interpretation || streaming.isStreaming) ? (
                        <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-headings:text-foreground">
                            {(interpretationReasoning || streaming.reasoning) && <ThinkingBlock content={interpretationReasoning || streaming.reasoning || ''} isStreaming={streaming.isStreaming && !interpretation} startTime={streaming.reasoningStartTime} duration={streaming.reasoningDuration} />}
                            <MarkdownContent content={interpretation || streaming.content || ''} className="text-sm text-foreground leading-relaxed" />
                        </div>
                    ) : (
                        <div className="py-12 text-center space-y-6">
                            {user === null ? (
                                <div className="max-w-sm mx-auto space-y-4">
                                    <p className="text-sm text-foreground/40">登录后解锁 AI 深度解读卦象天机</p>
                                    <button onClick={() => setShowAuthModal(true)} className="w-full py-2 bg-[#2383e2] text-white text-sm font-medium rounded-md hover:bg-[#2383e2]/90 transition-colors">立即登录</button>
                                </div>
                            ) : (
                                <button onClick={handleGetInterpretation} disabled={isLoading || !canAnalyze || membershipPending} className="inline-flex items-center gap-2 px-8 py-2.5 bg-[#2383e2] text-white text-sm font-bold rounded-md hover:bg-[#2383e2]/90 transition-all active:scale-95 disabled:opacity-50"><Sparkles className="w-4 h-4" />获取 AI 解读</button>
                            )}
                        </div>
                    )}
                </div></AIFeatureGate>
            </div>

            {/* 术语弹窗 */}
            {showTermsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20" onClick={() => setShowTermsModal(false)} />
                    <div className="relative w-full max-w-2xl bg-background border border-border rounded-md shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-background-secondary/30">
                            <div className="text-sm font-bold uppercase tracking-widest text-foreground/60">术语参考</div>
                            <button onClick={() => setShowTermsModal(false)} className="p-1 rounded-md hover:bg-background-secondary transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-8">
                            {[ { label: '六亲', data: LIU_QIN_TIPS }, { label: '神系', data: SHEN_XI_TIPS }, { label: '其他', data: TERM_TIPS } ].map(group => (
                                <div key={group.label} className="space-y-3">
                                    <h3 className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest border-b border-gray-50 pb-1">{group.label}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                                        {Object.entries(group.data).map(([name, tip]) => (
                                            <div key={name} className="text-xs leading-relaxed"><span className="font-bold text-foreground/70">{name}</span><span className="text-foreground/40 mx-1">/</span><span className="text-foreground/50">{tip}</span></div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
            <CreditsModal isOpen={showCreditsModal} onClose={() => setShowCreditsModal(false)} />
            {knowledgeBaseEnabled && divinationId && <AddToKnowledgeBaseModal open={kbModalOpen} onClose={() => setKbModalOpen(false)} sourceTitle={result.question || '六爻占卜'} sourceType="liuyao_divination" sourceId={divinationId} />}
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
