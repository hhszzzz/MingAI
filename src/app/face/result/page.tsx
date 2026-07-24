/**
 * 面相分析结果页
 * 
 * 显示面相分析结果，支持从历史记录加载
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ScanFace, MessageCircle } from 'lucide-react';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { readSessionJSON } from '@/lib/cache/session-storage';
import { FACE_ANALYSIS_TYPES, FACE_DISCLAIMER } from '@/lib/divination/face';
import { AddToKnowledgeBaseModal } from '@/components/knowledge-base/AddToKnowledgeBaseModal';
import { useKnowledgeBaseFeatureEnabled } from '@/components/knowledge-base/useKnowledgeBaseFeatureEnabled';
import { useHeaderMenu } from '@/components/layout/HeaderMenuContext';
import { useAnalysisSnapshot } from '@/lib/hooks/useAnalysisSnapshot';
import { useFeatureToggles } from '@/lib/hooks/useFeatureToggles';

interface FaceResultData {
    readingId?: string;
    conversationId?: string | null;
    analysisType: string;
    analysis?: string;
    createdAt?: string;
    isTemporary?: boolean;
}

export default function FaceResultPage() {
    const router = useRouter();
    const { setMenuItems, clearMenuItems } = useHeaderMenu();
    const { knowledgeBaseEnabled } = useKnowledgeBaseFeatureEnabled();
    const { loaded: aiFeatureLoaded, isFeatureEnabled } = useFeatureToggles();
    const aiEnabled = aiFeatureLoaded && isFeatureEnabled('chat');
    const [loading, setLoading] = useState(true);
    const [resultData, setResultData] = useState<FaceResultData | null>(null);
    const [analysis, setAnalysis] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [kbModalOpen, setKbModalOpen] = useState(false);
    const [awaitingSnapshot, setAwaitingSnapshot] = useState(false);
    const snapshotCallbacks = useMemo(() => ({
        onAnalysis: (nextAnalysis: string) => setAnalysis(nextAnalysis),
        onConversationIdResolved: (conversationId: string) => {
            setResultData((prev) => (prev ? { ...prev, conversationId } : prev));
        },
        onComplete: () => setAwaitingSnapshot(false),
    }), []);
    const snapshotLoading = useAnalysisSnapshot({
        conversationId: resultData?.conversationId,
        recordId: resultData?.readingId,
        divinationType: 'face',
        sessionKey: 'face_result',
        hasExistingAnalysis: !!analysis,
        skip: !resultData || !aiEnabled,
        callbacks: snapshotCallbacks,
    });

    // 设置移动端 Header 菜单项
    useEffect(() => {
        const items = [];
        if (!aiEnabled) {
            clearMenuItems();
            return;
        }
        if (knowledgeBaseEnabled && resultData?.readingId) {
            items.push({
                id: 'add-to-kb',
                label: '加入知识库',
                onClick: () => setKbModalOpen(true),
            });
        }
        if (resultData?.conversationId) {
            items.push({
                id: 'continue-chat',
                label: '继续对话',
                icon: <MessageCircle className="w-4 h-4" />,
                onClick: () => router.push(`/chat?id=${resultData.conversationId}`),
            });
        }
        items.push({
            id: 'reanalyze',
            label: '再次分析',
            icon: <ScanFace className="w-4 h-4" />,
            onClick: () => router.push('/face'),
        });
        setMenuItems(items);
        return () => clearMenuItems();
    }, [aiEnabled, knowledgeBaseEnabled, resultData?.readingId, resultData?.conversationId, router, setMenuItems, clearMenuItems]);

    useEffect(() => {
        const loadResult = async () => {
            setLoading(true);
            setError(null);

            // 尝试从 sessionStorage 获取
            const parsed = readSessionJSON<FaceResultData>('face_result');
            if (parsed) {
                try {
                    setResultData(parsed);
                    if (parsed.analysis) {
                        setAnalysis(parsed.analysis);
                        setAwaitingSnapshot(false);
                    } else {
                        setAwaitingSnapshot(Boolean(parsed.conversationId || parsed.readingId));
                    }
                    setLoading(false);
                    return;
                } catch {
                }
            }

            // 没有数据，显示错误
            setAwaitingSnapshot(false);
            setError('未找到分析结果，请重新进行分析');
            setLoading(false);
        };

        loadResult();
    }, []);

    const getAnalysisTypeName = (typeId: string) => {
        const type = FACE_ANALYSIS_TYPES.find(t => t.id === typeId);
        return type?.name || '面相分析';
    };

    const handleContinueChat = () => {
        if (resultData?.conversationId) {
            router.push(`/chat?id=${resultData.conversationId}`);
        }
    };

    if (!aiEnabled) return null;

    if (loading || awaitingSnapshot || snapshotLoading) {
        return (
            <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
                {/* Background Effects Removed */}
                <div className="relative z-10 text-center animate-fade-in p-8 rounded-3xl bg-background/5 border border-white/10 backdrop-blur-md">
                    <div className="relative mb-6 mx-auto w-16 h-16 flex items-center justify-center">
                        <div className="absolute inset-0 bg-purple-500/20 rounded-full animate-ping opacity-75" />
                        <div className="relative z-10 bg-purple-500/10 p-4 rounded-full border border-purple-500/20">
                            <ScanFace className="w-8 h-8 text-purple-400" />
                        </div>
                    </div>
                    <SoundWaveLoader variant="inline" />
                    <p className="text-foreground-secondary font-medium">正在解读您的面相...</p>
                </div>
            </div>
        );
    }

    if (error || !resultData) {
        return (
            <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
                {/* Background Effects Removed */}
                <div className="relative z-10 max-w-md w-full mx-4 text-center p-8 rounded-3xl bg-background/5 border border-white/10 backdrop-blur-md shadow-2xl">
                    <div className="w-16 h-16 bg-background/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10">
                        <ScanFace className="w-8 h-8 text-purple-400/50" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">未找到分析结果</h3>
                    <p className="text-foreground-secondary mb-8 leading-relaxed">{error || '似乎没有找到刚才的分析记录，请尝试重新分析'}</p>
                    <button
                        onClick={() => router.push('/face')}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg shadow-purple-600/20 transition-all hover:scale-[1.02] active:scale-95"
                    >
                        <ScanFace className="w-5 h-5" />
                        开始面相分析
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="min-h-screen bg-background relative overflow-x-hidden">
                {/* Background Effects */}
                {/* Background Effects Removed */}

                <div className="max-w-3xl mx-auto px-4 py-4 md:py-8 relative z-10 animate-fade-in">
                    {/* 返回按钮 - 仅桌面端显示 */}
                    <button
                        onClick={() => router.push('/face')}
                        className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-background/5 transition-all mb-6"
                    >
                        <span className="text-sm font-medium">返回</span>
                    </button>

                    {/* 标题 */}
                    <div className="flex items-center gap-5 mb-8">
                        <div className="p-4 rounded-2xl bg-purple-500/10 ring-1 ring-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)] flex items-center justify-center">
                            <ScanFace className="w-8 h-8 text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground mb-1">
                                {getAnalysisTypeName(resultData.analysisType)}
                            </h1>
                            {resultData.createdAt && (
                                <p className="text-sm text-foreground-secondary flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500/50"></span>
                                    {new Date(resultData.createdAt).toLocaleString('zh-CN')}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 临时结果警告 */}
                    {resultData.isTemporary && (
                        <div className="mb-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl backdrop-blur-sm">
                            <div className="flex gap-2 text-sm text-foreground-secondary">
                                <span className="font-bold text-amber-500 shrink-0">注意：</span>
                                <p>由于网络原因，本次分析结果未能保存到历史记录，但您仍可在此查看结果。</p>
                            </div>
                        </div>
                    )}

                    {/* 免责声明 */}
                    <div className="bg-background/[0.02] border border-white/5 rounded-xl p-4 mb-8 backdrop-blur-sm">
                        <p className="text-xs text-foreground-secondary/70 whitespace-pre-line leading-relaxed text-center">
                            {FACE_DISCLAIMER}
                        </p>
                    </div>

                    {/* 分析结果 */}
                    <div className="bg-background/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 mb-8 shadow-xl">
                        {analysis ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground-secondary prose-strong:text-purple-300">
                                <MarkdownContent
                                    content={analysis}
                                />
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <ScanFace className="w-12 h-12 text-white/10 mx-auto mb-4" />
                                <p className="text-foreground-secondary">暂无分析内容</p>
                            </div>
                        )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex flex-wrap gap-4 justify-center">
                        {knowledgeBaseEnabled && !!resultData.readingId && (
                            <button
                                type="button"
                                onClick={() => setKbModalOpen(true)}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-background/5 hover:bg-background/10 border border-white/10 hover:border-white/20 text-foreground transition-all hover:scale-[1.02] active:scale-95"
                            >
                                加入知识库
                            </button>
                        )}
                        {resultData.conversationId && (
                            <button
                                onClick={handleContinueChat}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg shadow-purple-600/20 transition-all hover:scale-[1.02] active:scale-95"
                            >
                                <MessageCircle className="w-5 h-5" />
                                继续对话
                            </button>
                        )}
                        <button
                            onClick={() => router.push('/face')}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-background/5 hover:bg-background/10 border border-white/10 hover:border-white/20 text-foreground transition-all hover:scale-[1.02] active:scale-95"
                        >
                            <ScanFace className="w-5 h-5" />
                            再次分析
                        </button>
                    </div>
                </div>
            </div>

            {knowledgeBaseEnabled && resultData.readingId && (
                <AddToKnowledgeBaseModal
                    open={kbModalOpen}
                    onClose={() => setKbModalOpen(false)}
                    sourceTitle={getAnalysisTypeName(resultData.analysisType)}
                    sourceType="face_reading"
                    sourceId={resultData.readingId}
                />
            )}
        </>
    );
}
