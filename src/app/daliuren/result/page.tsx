/**
 * 大六壬排盘结果页
 *
 * 对齐 Notion 风格：极简布局、线性图表、文档流解读
 */
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Brain, RotateCcw, RefreshCw, Sparkles, Copy, Check, Info } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { readSessionJSON, updateSessionJSON } from '@/lib/cache/session-storage';
import { TianDiPanGrid } from '@/components/daliuren/TianDiPanGrid';
import { ModelSelector } from '@/components/ui/ModelSelector';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';
import { ThinkingBlock } from '@/components/chat/ThinkingBlock';
import { useStreamingResponse, isCreditsError } from '@/lib/hooks/useStreamingResponse';
import { AuthModal } from '@/components/auth/AuthModal';
import { CreditsModal } from '@/components/ui/CreditsModal';
import { useHeaderMenu } from '@/components/layout/HeaderMenuContext';
import { useAnalysisSnapshot } from '@/lib/hooks/useAnalysisSnapshot';
import { useAdminJsonCopy } from '@/lib/admin/useAdminJsonCopy';
import { DEFAULT_MODEL_ID } from '@/lib/ai/ai-config';
import { runSharedAnalysisFlow } from '@/lib/ai/analysis-runner';
import { useSessionMembership } from '@/lib/hooks/useSessionMembership';
import { CopyTextModal } from '@/components/divination/CopyTextModal';
import { AIFeatureGate } from '@/components/ai/AIFeatureGate';
import type { ChartTextDetailLevel } from '@/lib/divination/detail-level';
import { saveDivinationAction } from '@/lib/divination/save-client';
import {
    buildDaliurenCanonicalJSON,
    generateDaliurenChartText,
    type DaliurenOutput,
} from '@/lib/divination/daliuren';

type DaliurenSessionParams = Record<string, unknown> & {
    date?: string;
    divinationId?: string;
    conversationId?: string;
};

export default function DaliurenResultPage() {
    const router = useRouter();
    const { setMenuItems, clearMenuItems } = useHeaderMenu();
    const { showToast } = useToast();
    const [result, setResult] = useState<DaliurenOutput | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);
    const [reasoningEnabled, setReasoningEnabled] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showCreditsModal, setShowCreditsModal] = useState(false);
    const [divinationId, setDivinationId] = useState<string | undefined>();
    const [conversationId, setConversationId] = useState<string | undefined>();
    const [interpretation, setInterpretation] = useState<string | null>(null);
    const [interpretationReasoning, setInterpretationReasoning] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [copyDetailLevel, setCopyDetailLevel] = useState<ChartTextDetailLevel>('default');
    const [showCopyModal, setShowCopyModal] = useState(false);
    const hasAutoSavedRef = useRef(false);

    const streaming = useStreamingResponse();
    const { userId, membershipInfo, sessionLoading, membershipLoading, membershipResolved } = useSessionMembership();
    const membershipPending = membershipLoading || !membershipResolved;
    const membershipType = membershipResolved ? (membershipInfo?.type ?? 'free') : 'free';
    const canonicalResult = useMemo(
        () => (result ? buildDaliurenCanonicalJSON(result) : null),
        [result],
    );
    const { isAdmin, jsonCopied, copyJson } = useAdminJsonCopy(canonicalResult);

    const persistSessionIds = useCallback((next: { divinationId?: string; conversationId?: string; }) => {
        updateSessionJSON('daliuren_params', (prev) => ({ ...(prev || {}), ...next }));
    }, []);

    const saveDivinationRecord = useCallback(async (params: DaliurenSessionParams, nextResult: DaliurenOutput) => {
        const result = await saveDivinationAction({
            endpoint: '/api/daliuren',
            body: { ...params, resultData: nextResult },
            idKey: 'divinationId',
            fallbackMessage: '保存排盘记录失败',
        });
        if (!result.ok) {
            console.error('[daliuren/result] 保存排盘记录失败:', result.error.message);
            return undefined;
        }
        if (result.id) { setDivinationId(result.id); persistSessionIds({ divinationId: result.id }); return result.id; }
        return undefined;
    }, [persistSessionIds]);

    useEffect(() => {
        if (sessionLoading) return;
        const init = async () => {
            const params = readSessionJSON<DaliurenSessionParams>('daliuren_params');
            if (!params?.date) { router.replace('/daliuren'); return; }
            try {
                const response = await fetch('/api/daliuren', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'calculate', ...params }) });
                const payload = await response.json();
                if (payload?.data) {
                    setResult(payload.data); if (params.divinationId) setDivinationId(params.divinationId); if (params.conversationId) setConversationId(params.conversationId);
                    if (!params.divinationId && userId && !hasAutoSavedRef.current) { hasAutoSavedRef.current = true; await saveDivinationRecord(params, payload.data); }
                }
            } catch (e) { console.error(e); } finally { setIsLoading(false); }
        };
        void init();
    }, [router, saveDivinationRecord, sessionLoading, userId]);

    const handleCopy = async () => {
        setShowCopyModal(true);
    };

    const handleConfirmCopy = async (level: ChartTextDetailLevel) => {
        if (!result) return;
        try {
            setCopyDetailLevel(level);
            await navigator.clipboard.writeText(generateDaliurenChartText(result, { detailLevel: level }));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            showToast('success', '结果已复制到剪贴板');
            setShowCopyModal(false);
        } catch {
            showToast('error', '复制失败，请重试');
        }
    };

    useEffect(() => {
        if (!result) return;
        setMenuItems([
            { id: 'restart', label: '重新起课', icon: <RotateCcw className="w-4 h-4" />, onClick: () => router.push('/daliuren') },
            ...(isAdmin && canonicalResult ? [{ id: 'copy-json', label: jsonCopied ? 'JSON 已复制' : 'JSON', icon: jsonCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />, onClick: () => { void copyJson(); } }] : []),
        ]);
        return () => clearMenuItems();
    }, [result, isAdmin, canonicalResult, jsonCopied, copyJson, router, setMenuItems, clearMenuItems]);

    useAnalysisSnapshot({
        conversationId,
        recordId: divinationId,
        divinationType: 'daliuren',
        sessionKey: 'daliuren_params',
        hasExistingAnalysis: !!interpretation || !!streaming.content,
        skip: !result || (!conversationId && !divinationId),
        callbacks: {
            onAnalysis: setInterpretation,
            onReasoning: setInterpretationReasoning,
            onReasoningEnabled: setReasoningEnabled,
            onModelId: setModelId,
            onConversationIdResolved: (resolvedConversationId) => {
                setConversationId(resolvedConversationId);
                persistSessionIds({ conversationId: resolvedConversationId });
            },
        },
    });

    const handleInterpret = useCallback(async () => {
        if (!result || !userId) { if (!userId) setShowAuthModal(true); return; }
        setError(null);
        setInterpretation(null);
        setInterpretationReasoning(null);
        streaming.reset();
        try {
            const analysisResult = await runSharedAnalysisFlow({
                endpoint: '/api/daliuren',
                streaming,
                isCreditsError,
                direct: {
                    prepareBody: { action: 'interpret_prepare', resultData: result, divinationId },
                    persistBody: { action: 'interpret_persist', resultData: result, divinationId },
                },
                streamBody: {
                    action: 'interpret',
                    resultData: result,
                    divinationId,
                    modelId,
                    reasoning: reasoningEnabled,
                    stream: true,
                },
            });
            if (analysisResult.requiresCredits) {
                setShowCreditsModal(true);
            } else {
                if (analysisResult.error) {
                    setError(analysisResult.error);
                }
                if (analysisResult.content) {
                    setInterpretation(analysisResult.content);
                }
                if (analysisResult.reasoning) {
                    setInterpretationReasoning(analysisResult.reasoning);
                }
                if (analysisResult.conversationId) {
                    setConversationId(analysisResult.conversationId);
                    persistSessionIds({ conversationId: analysisResult.conversationId });
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '解读失败');
        }
    }, [divinationId, modelId, persistSessionIds, reasoningEnabled, result, streaming, userId]);

    if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><SoundWaveLoader variant="block" text="正在起课" /></div>;
    if (!result) return <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center"><p className="text-sm text-foreground/40 mb-6">排盘失败</p><button onClick={() => router.back()} className="px-4 py-2 bg-[#2383e2] text-white text-sm font-medium rounded-md transition-colors">返回重试</button></div>;

    const { 基本信息: coreInfo, 四课: siKe, 三传: sanChuan } = canonicalResult!;
    const [keNameLabel, keTypeLabel] = coreInfo.课式.split(' / ');

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in space-y-8">
                {/* 头部导航 */}
                <div className="hidden md:flex items-center justify-between border-b border-border/60 pb-6">
                    <div className="flex items-center gap-4">
                        <Link href="/daliuren" className="text-sm font-medium text-foreground/40 hover:text-foreground hover:bg-background-secondary px-2 py-1 rounded-md transition-colors">返回</Link>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold">{keNameLabel}</span>
                            {keTypeLabel && <span className="text-[10px] font-bold text-[#2eaadc] uppercase tracking-wider">{keTypeLabel}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => router.push('/daliuren')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border hover:bg-background-secondary transition-colors"><RotateCcw className="w-3.5 h-3.5" />重新起课</button>
                        <button onClick={handleCopy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border hover:bg-background-secondary transition-colors">{copied ? <Check className="w-3.5 h-3.5 text-[#0f7b6c]" /> : <Copy className="w-3.5 h-3.5" />}复制</button>
                    </div>
                </div>

                {/* 基础参数 */}
                <div className="bg-background-secondary/30 border border-border rounded-md p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <Info className="w-4 h-4 text-foreground/30" />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/60">排盘参数</h2>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[ { label: '公历时间', value: coreInfo.占测时间 }, { label: '农历时间', value: result.dateInfo.lunarDate || coreInfo.农历 || '-' }, { label: '四柱干支', value: coreInfo.四柱 }, { label: '月将信息', value: `${coreInfo.月将} (空亡：${coreInfo.关键状态.空亡.join('')})` } ].map(item => (
                            <div key={item.label} className="bg-background border border-border/60 rounded-md p-3">
                                <div className="text-[10px] font-bold text-foreground/30 uppercase mb-1">{item.label}</div>
                                <div className="text-xs font-medium text-foreground/80">{item.value}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 三传四课 */}
                <div className="grid gap-8 lg:grid-cols-2">
                    <section className="bg-background border border-border rounded-md p-6">
                        <h3 className="text-[11px] font-bold text-foreground/30 uppercase tracking-widest mb-6">三传分析</h3>
                        <div className="grid grid-cols-3 gap-3">
                            {sanChuan.map((data: typeof sanChuan[number], i: number) => (
                                <div key={i} className="flex flex-col items-center p-3 rounded-md bg-background-secondary/30 border border-border/60">
                                    <span className="text-[10px] text-foreground/40 font-bold mb-2">{['初传', '中传', '末传'][i]}</span>
                                    <span className="text-xl font-bold mb-1">{data?.地支}</span>
                                    <span className="text-xs font-medium text-foreground/60">{data?.天将}</span>
                                    <span className="text-[10px] font-bold text-[#2eaadc] uppercase">{data?.六亲}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section className="bg-background border border-border rounded-md p-6">
                        <h3 className="text-[11px] font-bold text-foreground/30 uppercase tracking-widest mb-6">四课排布</h3>
                        <div className="grid grid-cols-4 gap-2">
                            {['四课', '三课', '二课', '一课'].map(label => {
                                const data = siKe.find((item: typeof siKe[number]) => item.课别.startsWith(label));
                                return (
                                    <div key={label} className="flex flex-col items-center p-2 rounded-md bg-background-secondary/30 border border-border/60">
                                        <span className="text-[10px] font-bold text-[#2eaadc] mb-1">{data?.乘将}</span>
                                        <span className="text-lg font-bold">{data?.上神}</span>
                                        <div className="w-4 h-px bg-background-secondary my-1" />
                                        <span className="text-xs font-medium text-foreground/60">{data?.下神}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>

                {/* 天地盘 */}
                <section className="bg-background border border-border rounded-md p-6">
                    <h3 className="text-[11px] font-bold text-foreground/30 uppercase tracking-widest mb-6">天地盘九宫</h3>
                    <TianDiPanGrid result={canonicalResult!} />
                </section>

                {/* AI 解读 */}
                <AIFeatureGate><div className="bg-background border border-border rounded-md p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-border/60 pb-4">
                        <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-foreground/60"><Brain className="w-4 h-4 text-[#2eaadc]" />AI 深度解读</h2>
                        <div className="flex items-center gap-2">
                            <ModelSelector compact selectedModel={modelId} onModelChange={setModelId} reasoningEnabled={reasoningEnabled} onReasoningChange={setReasoningEnabled} userId={userId} membershipType={membershipType} disabled={membershipPending} />
                            {interpretation && <button onClick={handleInterpret} disabled={streaming.isStreaming} className="p-1.5 rounded-md hover:bg-background-secondary transition-colors"><RefreshCw className={`w-3.5 h-3.5 ${streaming.isStreaming ? 'animate-spin' : ''}`} /></button>}
                        </div>
                    </div>
                    {error && (
                        <div className="p-3 bg-red-50 text-[#eb5757] text-xs rounded-md border border-red-100">
                            {error}
                        </div>
                    )}
                    {interpretation || streaming.content ? (
                        <div className="prose prose-sm max-w-none">
                            {(interpretationReasoning || streaming.reasoning) && <ThinkingBlock content={interpretationReasoning || streaming.reasoning || ''} isStreaming={streaming.isStreaming && !interpretation} />}
                            <MarkdownContent content={interpretation || streaming.content || ''} className="text-sm text-foreground leading-relaxed" />
                        </div>
                    ) : (
                        <div className="py-12 text-center space-y-6">
                            {sessionLoading || membershipPending ? <SoundWaveLoader variant="inline" /> : !userId ? <button onClick={() => setShowAuthModal(true)} className="px-8 py-2.5 bg-[#2383e2] text-white text-sm font-bold rounded-md hover:bg-[#2383e2]/90 transition-colors">登录解锁 AI 解读</button> : <button onClick={handleInterpret} disabled={membershipPending} className="px-8 py-2.5 bg-[#2383e2] text-white text-sm font-bold rounded-md hover:bg-[#2383e2]/90 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 mx-auto"><Sparkles className="w-4 h-4" />获取 AI 解读</button>}
                        </div>
                    )}
                </div></AIFeatureGate>
            </div>
            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
            <CreditsModal isOpen={showCreditsModal} onClose={() => setShowCreditsModal(false)} />
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
