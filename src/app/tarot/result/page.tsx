/**
 * 塔罗结果页
 *
 * 对齐 Notion 风格：极简卡片、文档流解读、线性图标
 */
'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, RotateCcw, RefreshCw, Send, BookOpenText, Copy, Check, Info } from 'lucide-react';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';
import Image from 'next/image';
import { buildTarotCanonicalJSON, findTarotCardByChineseName, generateTarotReadingText, TAROT_SPREADS, type DrawnCard, type TarotNumerology, type TarotSpread } from '@/lib/divination/tarot';
import { readSessionJSON, updateSessionJSON } from '@/lib/cache/session-storage';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { ModelSelector } from '@/components/ui/ModelSelector';
import { DEFAULT_MODEL_ID } from '@/lib/ai/ai-config';
import { useSessionMembership } from '@/lib/hooks/useSessionMembership';
import { ThinkingBlock } from '@/components/chat/ThinkingBlock';
import { AuthModal } from '@/components/auth/AuthModal';
import { AddToKnowledgeBaseModal } from '@/components/knowledge-base/AddToKnowledgeBaseModal';
import { useKnowledgeBaseFeatureEnabled } from '@/components/knowledge-base/useKnowledgeBaseFeatureEnabled';
import { useHeaderMenu } from '@/components/layout/HeaderMenuContext';
import { useToast } from '@/components/ui/Toast';
import { CreditsModal } from '@/components/ui/CreditsModal';
import { useStreamingResponse, isCreditsError } from '@/lib/hooks/useStreamingResponse';
import { useAnalysisSnapshot } from '@/lib/hooks/useAnalysisSnapshot';
import { CopyTextModal } from '@/components/divination/CopyTextModal';
import { AIFeatureGate } from '@/components/ai/AIFeatureGate';
import type { ChartTextDetailLevel } from '@/lib/divination/detail-level';
import { runSharedAnalysisFlow } from '@/lib/ai/analysis-runner';

type TarotSession = {
    spread?: TarotSpread;
    spreadId?: string;
    cards?: DrawnCard[];
    question?: string;
    birthDate?: string;
    numerology?: TarotNumerology | null;
    seed?: string | null;
    readingId?: string | null;
    conversationId?: string | null;
    createdAt?: string;
};

function TarotResultContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setMenuItems, clearMenuItems } = useHeaderMenu();
    const { showToast } = useToast();
    const { knowledgeBaseEnabled } = useKnowledgeBaseFeatureEnabled();
    const historyTimestamp = searchParams.get('t');
    const spreadId = searchParams.get('spreadId');
    const questionParam = searchParams.get('question');
    const birthDateParam = searchParams.get('birthDate');

    const [selectedSpread, setSelectedSpread] = useState<TarotSpread | null>(null);
    const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
    const [question, setQuestion] = useState(questionParam || '');
    const [birthDate, setBirthDate] = useState(birthDateParam || '');
    const [numerology, setNumerology] = useState<TarotNumerology | null>(null);
    const [seed, setSeed] = useState<string | null>(null);
    const [interpretation, setInterpretation] = useState('');
    const [interpretationReasoning, setInterpretationReasoning] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInterpreting, setIsInterpreting] = useState(false);
    const [revealedCards, setRevealedCards] = useState<number[]>([]);
    const [flippedToInterpretation, setFlippedToInterpretation] = useState<number[]>([]);
    const [readingId, setReadingId] = useState<string | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [historyMissing, setHistoryMissing] = useState(false);
    const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
    const [reasoningEnabled, setReasoningEnabled] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [kbModalOpen, setKbModalOpen] = useState(false);
    const [showCreditsModal, setShowCreditsModal] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copyDetailLevel, setCopyDetailLevel] = useState<ChartTextDetailLevel>('default');
    const [showCopyModal, setShowCopyModal] = useState(false);
    const streaming = useStreamingResponse();
    const { user, userId, membershipInfo, membershipLoading, membershipResolved } = useSessionMembership();
    const membershipPending = membershipLoading || !membershipResolved;
    const membershipType = membershipResolved ? (membershipInfo?.type ?? 'free') : 'free';

    const canonicalReading = useMemo(() => {
        if (!selectedSpread || drawnCards.length === 0) return null;
        return buildTarotCanonicalJSON({ spreadName: selectedSpread.name, spreadId: selectedSpread.id, question, cards: drawnCards, seed: seed || undefined, numerology, birthDate, detailLevel: 'full' });
    }, [birthDate, drawnCards, numerology, question, seed, selectedSpread]);

    // 获取抽牌
    useEffect(() => {
        if (!spreadId) return;
        const drawCards = async () => {
            setIsLoading(true); setRevealedCards([]); setInterpretation(''); setInterpretationReasoning(null);
            try {
                const res = await fetch('/api/tarot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'draw-only', spreadId, allowReversed: true, birthDate: birthDateParam || undefined }) });
                const data = await res.json();
                if (data.success && data.data?.cards) {
                    setSelectedSpread(data.data.spread); setDrawnCards(data.data.cards); setNumerology(data.data.numerology || null); setSeed(data.data.seed);
                }
            } catch (e) { console.error(e); } finally { setIsLoading(false); }
        };
        drawCards();
    }, [birthDateParam, spreadId]);

    // 加载历史
    useEffect(() => {
        if (spreadId) return;
        const parsed = readSessionJSON<TarotSession>('tarot_result');
        if (parsed?.cards) {
            const spread = TAROT_SPREADS.find(s => s.id === (parsed.spreadId || parsed.spread?.id)) || null;
            if (spread) {
                setSelectedSpread(spread); setDrawnCards(parsed.cards); setQuestion(parsed.question || ''); setBirthDate(parsed.birthDate || '');
                setNumerology(parsed.numerology || null); setSeed(parsed.seed || null); setRevealedCards(parsed.cards.map((_: DrawnCard, i: number) => i));
                setReadingId(parsed.readingId || null); setConversationId(parsed.conversationId || null);
                setIsLoading(false); return;
            }
        }
        if (historyTimestamp) { setHistoryMissing(true); setIsLoading(false); return; }
        router.push('/tarot');
    }, [historyTimestamp, router, spreadId]);

    useEffect(() => {
        if (!selectedSpread || drawnCards.length === 0) return;

        updateSessionJSON<TarotSession>('tarot_result', (prev) => ({
            ...(prev || {}),
            spread: selectedSpread,
            spreadId: selectedSpread.id,
            cards: drawnCards,
            question,
            birthDate,
            numerology,
            seed,
            readingId,
            conversationId,
            createdAt: prev?.createdAt || new Date().toISOString(),
        }));
    }, [birthDate, conversationId, drawnCards, numerology, question, readingId, seed, selectedSpread]);

    const handleCopy = useCallback(async () => {
        setShowCopyModal(true);
    }, []);

    const handleConfirmCopy = useCallback(async (level: ChartTextDetailLevel) => {
        if (!canonicalReading) return;
        setCopyDetailLevel(level);
        await navigator.clipboard.writeText(generateTarotReadingText({ spreadName: selectedSpread!.name, spreadId: selectedSpread!.id, question, cards: drawnCards, seed: seed || undefined, numerology, birthDate, detailLevel: level }));
        setCopied(true); setTimeout(() => setCopied(false), 2000);
        setShowCopyModal(false);
    }, [birthDate, canonicalReading, drawnCards, numerology, question, seed, selectedSpread]);

    const handleInterpret = async () => {
        if (drawnCards.length === 0 || !user) { if (!user) setShowAuthModal(true); return; }
        setIsInterpreting(true); streaming.reset(); setInterpretationReasoning(null); setInterpretation('');
        try {
            const baseBody = {
                cards: drawnCards,
                question: question || undefined,
                birthDate: birthDate || undefined,
                numerology: numerology || undefined,
                seed: seed || undefined,
                spreadId: selectedSpread?.id,
                readingId: readingId || undefined,
            };
            const result = await runSharedAnalysisFlow({
                endpoint: '/api/tarot',
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
            if (result.requiresCredits) setShowCreditsModal(true);
            else {
                if (result.error) showToast('error', result.error);
                if (result.content) setInterpretation(result.content);
                if (result.reasoning) setInterpretationReasoning(result.reasoning);
                if (result.conversationId) setConversationId(result.conversationId);
            }
        } catch (e) { console.error(e); } finally { setIsInterpreting(false); }
    };

    useAnalysisSnapshot({
        conversationId,
        recordId: readingId,
        divinationType: 'tarot',
        sessionKey: 'tarot_result',
        hasExistingAnalysis: !!interpretation,
        callbacks: {
            onAnalysis: setInterpretation,
            onReasoning: setInterpretationReasoning,
            onModelId: setSelectedModel,
            onReasoningEnabled: setReasoningEnabled,
            onConversationIdResolved: setConversationId,
        },
    });

    useEffect(() => {
        const items = [
            { id: 'restart', label: '重新抽牌', icon: <RotateCcw className="w-4 h-4" />, onClick: () => router.push('/tarot') },
        ];
        if (drawnCards.length > 0) items.push({ id: 'copy', label: copied ? '已复制' : '复制', icon: copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />, onClick: handleCopy });
        if (knowledgeBaseEnabled && readingId) items.push({ id: 'add-to-kb', label: '收藏', icon: <BookOpenText className="w-4 h-4" />, onClick: () => setKbModalOpen(true) });
        setMenuItems(items);
        return () => clearMenuItems();
    }, [drawnCards.length, copied, readingId, knowledgeBaseEnabled, router, setMenuItems, clearMenuItems, handleCopy]);

    if (isLoading) return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-center animate-fade-in space-y-4">
                <div className="text-4xl">🃏</div>
                <SoundWaveLoader variant="block" text="正在洗牌抽取" />
            </div>
        </div>
    );

    if (historyMissing || !selectedSpread) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
                <p className="text-sm text-foreground/40 mb-6">
                    {historyMissing ? '历史记录加载失败，请从历史列表重新进入' : '未找到牌阵信息'}
                </p>
                <Link
                    href={historyMissing ? '/tarot/history' : '/tarot'}
                    className="px-4 py-2 bg-[#2383e2] text-white text-sm font-medium rounded-md hover:bg-[#2383e2]/90 transition-colors"
                >
                    返回
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in space-y-8">
                {/* 头部操作 */}
                <div className="hidden md:flex items-center justify-between border-b border-border/60 pb-6">
                    <Link href="/tarot" className="text-sm font-medium text-foreground/40 hover:text-foreground hover:bg-background-secondary px-2 py-1 rounded-md transition-colors">返回</Link>
                    <div className="flex items-center gap-2">
                        <button onClick={() => router.push('/tarot')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border hover:bg-background-secondary transition-colors"><RotateCcw className="w-3.5 h-3.5" />重新抽牌</button>
                        <button onClick={handleCopy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border hover:bg-background-secondary transition-colors">{copied ? <Check className="w-3.5 h-3.5 text-[#0f7b6c]" /> : <Copy className="w-3.5 h-3.5" />}复制</button>
                    </div>
                </div>

                {/* 排盘信息 */}
                <div className="bg-background-secondary/30 border border-border rounded-md p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <Info className="w-4 h-4 text-foreground/30" />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/60">占卜信息</h2>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="bg-background border border-border/60 rounded-md p-3">
                            <div className="text-[10px] font-bold text-foreground/30 uppercase mb-1">牌阵名称</div>
                            <div className="text-sm font-medium">{selectedSpread.name}</div>
                        </div>
                        {question && (
                            <div className="bg-background border border-border/60 rounded-md p-3">
                                <div className="text-[10px] font-bold text-foreground/30 uppercase mb-1">所问事项</div>
                                <div className="text-sm font-medium">{question}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 牌面展示 */}
                <div className="bg-background border border-border rounded-md p-8 md:p-12">
                    <div className={`grid gap-12 justify-items-center ${drawnCards.length === 1 ? 'grid-cols-1' : drawnCards.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                        {drawnCards.map((card, index) => {
                            const isRevealed = revealedCards.includes(index);
                            const isFlipped = flippedToInterpretation.includes(index);
                            const canonicalCard = canonicalReading?.牌阵展开[index];
                            return (
                                <div key={index} className="flex flex-col items-center gap-4 group" style={{ perspective: '1000px' }}>
                                    <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">{canonicalCard?.位置 || selectedSpread.positions[index]?.name}</span>

                                    <button
                                        onClick={() => isRevealed ? setFlippedToInterpretation(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]) : setRevealedCards(prev => [...prev, index])}
                                        className="relative w-28 h-48 sm:w-32 sm:h-52 transition-all duration-500"
                                        style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : undefined }}
                                    >
                                        <div className={`absolute inset-0 w-full h-full rounded-md overflow-hidden border border-border shadow-sm transition-all ${isRevealed ? 'opacity-100' : 'bg-background-secondary flex items-center justify-center'}`} style={{ backfaceVisibility: 'hidden' }}>
                                            {isRevealed ? (
                                                <Image src={card.card.image} alt={card.card.nameChinese} fill className={`object-cover ${card.orientation === 'reversed' ? 'rotate-180' : ''}`} />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center opacity-20"><Sparkles className="w-6 h-6" /></div>
                                            )}
                                        </div>
                                        <div className="absolute inset-0 w-full h-full rounded-md bg-background border border-border p-4 flex flex-col shadow-xl" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                                            <h4 className="text-xs font-bold mb-2 truncate">{canonicalCard?.塔罗牌 || card.card.nameChinese}</h4>
                                            <div className="flex-1 overflow-y-auto text-[10px] text-foreground/60 leading-relaxed custom-scrollbar">
                                                {card.orientation === 'reversed' ? card.card.reversedMeaning : card.card.uprightMeaning}
                                            </div>
                                        </div>
                                    </button>
                                    <div className={`text-center transition-opacity ${isRevealed ? 'opacity-100' : 'opacity-0'}`}>
                                        <div className="text-sm font-bold">{canonicalCard?.塔罗牌 || card.card.nameChinese}</div>
                                        <div className={`text-[10px] font-bold mt-1 ${(canonicalCard?.状态 || (card.orientation === 'reversed' ? '逆位' : '正位')) === '逆位' ? 'text-[#eb5757]' : 'text-[#0f7b6c]'}`}>{canonicalCard?.状态 || (card.orientation === 'reversed' ? '逆位' : '正位')}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {revealedCards.length < drawnCards.length && (
                        <div className="mt-12 text-center">
                            <button onClick={() => setRevealedCards(drawnCards.map((_, i) => i))} className="px-8 py-2 bg-[#2383e2] text-white text-sm font-bold rounded-md hover:bg-[#2383e2]/90 transition-all">翻开所有牌面</button>
                        </div>
                    )}
                </div>

                {/* AI 解读 */}
                <AIFeatureGate><div className="bg-background border border-border rounded-md p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-border/60 pb-4">
                        <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-foreground/60"><Sparkles className="w-4 h-4 text-[#a083ff]" />AI 深度解读</h2>
                        <div className="flex items-center gap-2">
                            <ModelSelector compact selectedModel={selectedModel} onModelChange={setSelectedModel} reasoningEnabled={reasoningEnabled} onReasoningChange={setReasoningEnabled} userId={userId} membershipType={membershipType} disabled={membershipPending} />
                            {interpretation && <button onClick={handleInterpret} disabled={isInterpreting} className="p-1.5 rounded-md hover:bg-background-secondary transition-colors"><RefreshCw className={`w-3.5 h-3.5 ${isInterpreting ? 'animate-spin' : ''}`} /></button>}
                        </div>
                    </div>

                    {interpretation ? (
                        <div className="prose prose-sm max-w-none">
                            {interpretationReasoning && <ThinkingBlock content={interpretationReasoning} isStreaming={streaming.isStreaming && !interpretation} startTime={streaming.reasoningStartTime} duration={streaming.reasoningDuration} />}
                            <MarkdownContent content={interpretation} className="text-sm text-foreground leading-relaxed" />
                        </div>
                    ) : (
                        <div className="py-12 text-center space-y-6">
                            {!userId ? (
                                <button onClick={() => setShowAuthModal(true)} className="px-8 py-2.5 bg-[#2383e2] text-white text-sm font-bold rounded-md hover:bg-[#2383e2]/90 transition-colors">登录解锁 AI 深度解读</button>
                            ) : (
                                <button onClick={handleInterpret} disabled={isInterpreting || membershipPending} className="inline-flex items-center gap-2 px-8 py-2.5 bg-[#2383e2] text-white text-sm font-bold rounded-md hover:bg-[#2383e2]/90 transition-all active:scale-95 disabled:opacity-50"><Send className="w-4 h-4" />获取 AI 深度洞察</button>
                            )}
                        </div>
                    )}
                </div></AIFeatureGate>

                {/* 数秘术 */}
                {(birthDate || numerology) && (
                    <section className="bg-background border border-border rounded-md p-6 space-y-6">
                        <div className="flex items-center gap-3 border-b border-border/60 pb-4">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/60">塔罗数秘术</h2>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            {[ { label: '人格牌', card: numerology?.personalityCard }, { label: '灵魂牌', card: numerology?.soulCard }, { label: '年度牌', card: numerology?.yearlyCard } ].map((item, idx) => (
                                <div key={idx} className="flex flex-col items-center gap-3 text-center">
                                    <span className="text-[10px] font-bold text-foreground/30 uppercase">{item.label}</span>
                                    <div className="relative w-full max-w-[100px] aspect-[2/3] rounded-md overflow-hidden border border-border/60 bg-background-secondary/50">
                                        {(() => {
                                            const cardImage = item.card
                                                ? findTarotCardByChineseName(item.card.nameChinese)?.image
                                                : null;
                                            return cardImage ? (
                                                <Image src={cardImage} alt={item.card!.nameChinese} fill className="object-cover" />
                                            ) : null;
                                        })()}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs font-bold">{item.card?.nameChinese || '-'}</div>
                                        <div className="text-[10px] text-foreground/40 italic">{item.card && 'year' in item.card && typeof item.card.year === 'number' ? `年度 ${item.card.year}` : ''}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
            <CreditsModal isOpen={showCreditsModal} onClose={() => setShowCreditsModal(false)} />
            {knowledgeBaseEnabled && readingId && <AddToKnowledgeBaseModal open={kbModalOpen} onClose={() => setKbModalOpen(false)} sourceTitle={question || selectedSpread?.name || '塔罗占卜'} sourceType="tarot_reading" sourceId={readingId} />}
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

export default function TarotResultPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><SoundWaveLoader variant="block" /></div>}>
            <TarotResultContent />
        </Suspense>
    );
}
