/**
 * 知识库管理页面
 *
 * 'use client' 标记说明：
 * - 使用 React hooks (useState, useEffect, useCallback)
 * - 使用 useToast 进行通知
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    BookOpenText, Plus, Trash2,
    ChevronDown, ChevronUp, Unlink2, Save, Upload,
    FileText, Database, Sparkles, AlertCircle
} from 'lucide-react';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';
import { useSessionMembership } from '@/lib/hooks/useSessionMembership';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SettingsLoginRequired } from '@/components/settings/SettingsLoginRequired';
import { KNOWLEDGE_BASE_SYNC_EVENT } from '@/lib/browser-api';
import { MING_RECORD_SOURCE_TYPE } from '@/lib/data-sources/types';
import {
    createKnowledgeBase,
    deleteKnowledgeBase,
    listKnowledgeBaseArchives,
    listKnowledgeBases,
    removeKnowledgeBaseArchive,
    type ArchivedSource,
    type KnowledgeBaseSummary,
    updateKnowledgeBase,
    uploadKnowledgeBaseFile,
} from '@/lib/knowledge-base/browser-client';
import { getCurrentUserSettings, updateCurrentUserSettings } from '@/lib/user/settings';

type KnowledgeBase = KnowledgeBaseSummary & {
    weight: 'low' | 'normal' | 'high';
};

type ArchiveBucket = {
    items: ArchivedSource[];
    hasMore: boolean;
    nextOffset: number | null;
    loaded: boolean;
    loading: boolean;
    error: string | null;
    appendError: string | null;
};

const ARCHIVE_PAGE_SIZE = 20;
const EMPTY_ARCHIVE_BUCKET: ArchiveBucket = {
    items: [],
    hasMore: false,
    nextOffset: null,
    loaded: false,
    loading: false,
    error: null,
    appendError: null,
};

function mergeArchivedSources(current: ArchivedSource[], incoming: ArchivedSource[]) {
    if (incoming.length === 0) {
        return current;
    }

    const merged = new Map(current.map((item) => [item.id, item] as const));
    for (const item of incoming) {
        merged.set(item.id, item);
    }
    return Array.from(merged.values());
}

const weightLabel: Record<KnowledgeBase['weight'], string> = {
    low: '低优先级',
    normal: '默认',
    high: '高优先级',
};

const sourceTypeLabel: Record<string, string> = {
    conversation: '对话',
    record: '命理记录',
    chat_message: '对话回复',
    bazi_chart: '八字命盘',
    ziwei_chart: '紫微命盘',
    tarot_reading: '塔罗占卜',
    liuyao_divination: '六爻占卜',
    hepan_chart: '合盘分析',
    face_reading: '面相分析',
    palm_reading: '手相分析',
    mbti_reading: 'MBTI 分析',
    [MING_RECORD_SOURCE_TYPE]: '命理记录',
    daily_fortune: '今日运势',
    monthly_fortune: '本月运势',
    qimen_chart: '奇门遁甲',
    daliuren_divination: '大六壬',
    meihua_divination: '梅花易数',
    xiaoliuren_divination: '小六壬',
};

export default function KnowledgeBasePanel() {
    const { showToast } = useToast();
    const {
        userId,
        sessionLoading,
        membershipInfo,
        membershipLoading,
        membershipResolved,
    } = useSessionMembership();
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [createError, setCreateError] = useState<string | null>(null);
    const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
    const [expandedKbId, setExpandedKbId] = useState<string | null>(null);
    const [archives, setArchives] = useState<Record<string, ArchiveBucket>>({});
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [savingKbId, setSavingKbId] = useState<string | null>(null);
    const [deletingKbId, setDeletingKbId] = useState<string | null>(null);
    const [removingArchiveId, setRemovingArchiveId] = useState<string | null>(null);
    const [uploadKbId, setUploadKbId] = useState<string | null>(null);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
    const [promptKbIds, setPromptKbIds] = useState<string[]>([]);
    const [promptSavingId, setPromptSavingId] = useState<string | null>(null);
    const [pendingDeleteKbId, setPendingDeleteKbId] = useState<string | null>(null);
    const archiveLoadMoreRef = useRef<HTMLDivElement | null>(null);
    const initializedUserIdRef = useRef<string | null>(null);
    const archivesRef = useRef<Record<string, ArchiveBucket>>({});
    const archiveRequestKeyRef = useRef<Record<string, string>>({});
    const membershipType = membershipResolved ? (membershipInfo?.type ?? 'free') : null;

    useEffect(() => {
        archivesRef.current = archives;
    }, [archives]);

    const loadKnowledgeBases = useCallback(async () => {
        setListError(null);
        try {
            const kbList = await listKnowledgeBases();
            setKbs(kbList as KnowledgeBase[]);
        } catch (loadError) {
            setListError(loadError instanceof Error ? loadError.message : '获取知识库失败');
            setKbs([]);
        }
    }, []);

    const loadPromptKbIds = useCallback(async () => {
        const { settings, error } = await getCurrentUserSettings();
        if (error) {
            showToast('error', error.message || '加载知识库设置失败');
            return;
        }
        setPromptKbIds(settings?.promptKbIds ?? []);
    }, [showToast]);

    useEffect(() => {
        const init = async () => {
            if (sessionLoading) {
                return;
            }
            if (!userId) {
                initializedUserIdRef.current = null;
                setLoading(false);
                return;
            }
            if (initializedUserIdRef.current === userId) {
                return;
            }
            initializedUserIdRef.current = userId;
            setLoading(true);
            await Promise.all([
                loadKnowledgeBases(),
                loadPromptKbIds(),
            ]);
            setLoading(false);
        };
        void init();
    }, [loadKnowledgeBases, loadPromptKbIds, sessionLoading, userId]);

    useEffect(() => {
        if (!uploadKbId && kbs.length > 0) {
            setUploadKbId(kbs[0].id);
        }
    }, [kbs, uploadKbId]);

    const invalidateArchiveBucket = useCallback((kbId: string) => {
        setArchives(prev => {
            const next = { ...prev };
            delete next[kbId];
            return next;
        });
    }, []);

    const loadArchives = useCallback(async (kbId: string, options?: { append?: boolean; offset?: number }) => {
        const append = options?.append === true;
        const current = archivesRef.current[kbId] ?? EMPTY_ARCHIVE_BUCKET;
        const nextOffset = options?.offset ?? (append ? current.nextOffset ?? 0 : 0);
        const requestKey = append ? `append:${nextOffset}` : 'initial:0';
        if (append && archiveRequestKeyRef.current[kbId] === requestKey) {
            return;
        }
        archiveRequestKeyRef.current[kbId] = requestKey;
        setArchives(prev => ({
            ...prev,
            [kbId]: {
                ...(prev[kbId] ?? EMPTY_ARCHIVE_BUCKET),
                loading: true,
                error: append ? (prev[kbId]?.error ?? null) : null,
                appendError: append ? null : (prev[kbId]?.appendError ?? null),
            },
        }));
        try {
            const archivePage = await listKnowledgeBaseArchives(kbId, {
                limit: ARCHIVE_PAGE_SIZE,
                offset: nextOffset,
            });
            setArchives(prev => ({
                ...prev,
                [kbId]: {
                    items: append ? mergeArchivedSources(prev[kbId]?.items ?? [], archivePage.items) : archivePage.items,
                    hasMore: archivePage.hasMore,
                    nextOffset: archivePage.nextOffset,
                    loaded: true,
                    loading: false,
                    error: null,
                    appendError: null,
                },
            }));
        } catch (loadError) {
            const message = loadError instanceof Error ? loadError.message : '获取归档失败';
            setArchives(prev => ({
                ...prev,
                [kbId]: {
                    ...(prev[kbId] ?? EMPTY_ARCHIVE_BUCKET),
                    items: prev[kbId]?.items ?? [],
                    hasMore: prev[kbId]?.hasMore ?? false,
                    nextOffset: prev[kbId]?.nextOffset ?? null,
                    loading: false,
                    loaded: true,
                    error: append ? (prev[kbId]?.error ?? null) : message,
                    appendError: append ? message : null,
                },
            }));
        } finally {
            delete archiveRequestKeyRef.current[kbId];
        }
    }, []);

    const toggleExpand = useCallback(async (kbId: string) => {
        if (expandedKbId === kbId) {
            setExpandedKbId(null);
            return;
        }
        setExpandedKbId(kbId);
        const bucket = archives[kbId];
        if (!bucket?.loaded && !bucket?.loading) {
            await loadArchives(kbId);
        }
    }, [archives, expandedKbId, loadArchives]);

    useEffect(() => {
        const bucket = expandedKbId ? archives[expandedKbId] : null;
        if (
            !expandedKbId
            || !bucket?.loaded
            || bucket.loading
            || !!bucket.appendError
            || !bucket.hasMore
            || bucket.nextOffset == null
            || !archiveLoadMoreRef.current
        ) {
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                void loadArchives(expandedKbId, {
                    append: true,
                    offset: bucket.nextOffset ?? 0,
                });
            }
        }, {
            rootMargin: '160px 0px',
        });

        observer.observe(archiveLoadMoreRef.current);
        return () => observer.disconnect();
    }, [archives, expandedKbId, loadArchives]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const handleArchiveChanged = (event: Event) => {
            const detail = (event as CustomEvent<{
                pathname?: string;
                requestBody?: Record<string, unknown> | null;
                responseData?: Record<string, unknown> | null;
            }>).detail;
            const pathname = detail?.pathname ?? '';
            const kbId = pathname.startsWith('/api/knowledge-base/ingest')
                ? detail.requestBody?.kbId
                : detail?.responseData?.kbId;

            if (typeof kbId !== 'string' || !kbId) {
                if (pathname.startsWith('/api/knowledge-base/archive/') && expandedKbId) {
                    invalidateArchiveBucket(expandedKbId);
                    void loadArchives(expandedKbId);
                }
                return;
            }

            invalidateArchiveBucket(kbId);
            if (expandedKbId === kbId) {
                void loadArchives(kbId);
            }
        };

        window.addEventListener(KNOWLEDGE_BASE_SYNC_EVENT, handleArchiveChanged as EventListener);
        return () => {
            window.removeEventListener(KNOWLEDGE_BASE_SYNC_EVENT, handleArchiveChanged as EventListener);
        };
    }, [expandedKbId, invalidateArchiveBucket, loadArchives]);

    const createKb = useCallback(async () => {
        const name = newName.trim();
        if (!name) {
            setCreateError('请输入知识库名称');
            return;
        }
        setCreating(true);
        setCreateError(null);
        try {
            await createKnowledgeBase({
                name,
                description: newDescription.trim() ? newDescription.trim() : null,
            });
            setNewName('');
            setNewDescription('');
            await loadKnowledgeBases();
            showToast('success', '知识库创建成功');
        } catch (createError) {
            setCreateError(createError instanceof Error ? createError.message : '创建知识库失败');
        } finally {
            setCreating(false);
        }
    }, [loadKnowledgeBases, newDescription, newName, showToast]);

    const togglePromptKb = useCallback(async (kbId: string) => {
        if (!userId) return;
        if (membershipLoading) {
            showToast('info', '会员状态加载中，请稍后重试');
            return;
        }
        if (membershipType === 'free') {
            showToast('info', '仅限 Plus 以上会员使用');
            return;
        }
        const next = promptKbIds.includes(kbId)
            ? promptKbIds.filter(id => id !== kbId)
            : [...promptKbIds, kbId];
        setPromptKbIds(next);
        setPromptSavingId(kbId);
        const saved = await updateCurrentUserSettings({ promptKbIds: next });
        setPromptSavingId(null);
        if (!saved) {
            setPromptKbIds(promptKbIds);
            showToast('error', '保存知识库失败');
            return;
        }
        setPromptKbIds(saved.promptKbIds);
    }, [membershipLoading, membershipType, promptKbIds, showToast, userId]);

    const updateKb = useCallback(async (kb: KnowledgeBase) => {
        setSavingKbId(kb.id);
        try {
            await updateKnowledgeBase(kb.id, {
                name: kb.name,
                description: kb.description,
                weight: kb.weight,
            });
            await loadKnowledgeBases();
            showToast('success', '知识库已更新');
        } catch (saveError) {
            showToast('error', saveError instanceof Error ? saveError.message : '更新知识库失败');
        } finally {
            setSavingKbId(null);
        }
    }, [loadKnowledgeBases, showToast]);

    const deleteKb = useCallback(async (kbId: string) => {
        setDeletingKbId(kbId);
        try {
            await deleteKnowledgeBase(kbId);
            if (expandedKbId === kbId) setExpandedKbId(null);
            invalidateArchiveBucket(kbId);
            await loadKnowledgeBases();
            showToast('success', '知识库已删除');
            setPendingDeleteKbId(null);
        } catch (deleteError) {
            const message = deleteError instanceof Error ? deleteError.message : '删除知识库失败';
            showToast('error', message);
        } finally {
            setDeletingKbId(null);
        }
    }, [expandedKbId, invalidateArchiveBucket, loadKnowledgeBases, showToast]);

    const removeArchive = useCallback(async (archive: ArchivedSource) => {
        setRemovingArchiveId(archive.id);
        try {
            await removeKnowledgeBaseArchive(archive.id);
            if (expandedKbId) {
                invalidateArchiveBucket(expandedKbId);
                await loadArchives(expandedKbId);
            }
            showToast('success', '已取消归档');
        } catch (removeError) {
            const message = removeError instanceof Error ? removeError.message : '取消归档失败';
            showToast('error', message);
        } finally {
            setRemovingArchiveId(null);
        }
    }, [expandedKbId, invalidateArchiveBucket, loadArchives, showToast]);

    const uploadKnowledgeFile = useCallback(async () => {
        if (!uploadKbId) {
            setUploadError('请选择知识库');
            return;
        }
        if (!uploadFile) {
            setUploadError('请选择文件');
            return;
        }
        setUploading(true);
        setUploadError(null);
        setUploadSuccess(null);
        try {
            await uploadKnowledgeBaseFile(uploadKbId, uploadFile);
            setUploadFile(null);
            // Reset file input value
            const fileInput = document.getElementById('kb-file-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

            setUploadSuccess('文件上传成功');
            // Automatically expand the KB to show new content
            if (uploadKbId !== expandedKbId) {
                setExpandedKbId(uploadKbId);
            }
            invalidateArchiveBucket(uploadKbId);
            await loadArchives(uploadKbId);
            showToast('success', '文件上传成功');
        } catch (uploadFailure) {
            setUploadError(uploadFailure instanceof Error ? uploadFailure.message : '上传失败');
        } finally {
            setUploading(false);
        }
    }, [expandedKbId, invalidateArchiveBucket, loadArchives, showToast, uploadFile, uploadKbId]);

    if (!sessionLoading && !userId) {
        return <SettingsLoginRequired title="请先登录后使用知识库" />;
    }

    return (
        <>
            <div className="space-y-6">
                <div className="space-y-6">
                {/* 桌面端 Header */}
                <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2 text-foreground">
                            <BookOpenText className="w-5 h-5 text-emerald-500" />
                            知识库
                        </h1>
                        <p className="text-xs text-foreground-secondary mt-0.5">
                            构建你的个人命理数据库，让 AI 更精准地为你服务
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* 创建新知识库 */}
                    <div className="bg-background rounded-md p-5 border border-border shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <Plus className="w-4 h-4 text-emerald-500" />
                            <h2 className="text-sm font-semibold text-foreground">新建知识库</h2>
                        </div>
                        <div className="space-y-3">
                            <input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-colors duration-150 placeholder:text-foreground-tertiary"
                                placeholder="给知识库起个名字..."
                            />
                            <textarea
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 resize-none transition-colors duration-150 placeholder:text-foreground-tertiary"
                                rows={2}
                                placeholder="描述一下这个知识库的用途（可选）"
                            />
                            <button
                                type="button"
                                onClick={createKb}
                                disabled={creating || !newName.trim()}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-border bg-transparent text-foreground hover:bg-[#efedea] active:bg-[#e3e1db] disabled:opacity-50 transition-colors duration-150 font-medium text-sm"
                            >
                                {creating ? <SoundWaveLoader variant="inline" /> : <Plus className="w-3.5 h-3.5" />}
                                创建知识库
                            </button>
                            {createError && <div className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{createError}</div>}
                        </div>
                    </div>

                    {/* 上传文件 */}
                    <div className="bg-background rounded-md p-5 border border-border shadow-sm lg:col-span-2">
                        <div className="flex items-center gap-3 mb-4">
                            <Upload className="w-4 h-4 text-blue-500" />
                            <h2 className="text-sm font-semibold text-foreground">导入外部资料</h2>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-5">
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-foreground mb-1.5 block">选择目标知识库</label>
                                    <select
                                        value={uploadKbId ?? ''}
                                        onChange={(e) => setUploadKbId(e.target.value)}
                                        className="w-full appearance-none bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-colors duration-150"
                                        disabled={kbs.length === 0}
                                    >
                                        {kbs.length === 0 ? (
                                            <option value="">暂无知识库</option>
                                        ) : (
                                            kbs.map(kb => (
                                                <option key={kb.id} value={kb.id}>{kb.name}</option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-foreground mb-1.5 block">选择文件</label>
                                    <input
                                        id="kb-file-upload"
                                        type="file"
                                        onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                                        className="w-full text-xs text-foreground-secondary
                                        file:mr-3 file:py-2 file:px-3
                                        file:rounded-md file:border file:border-border
                                        file:text-xs file:font-medium
                                        file:bg-transparent file:text-foreground
                                        hover:file:bg-[#efedea]
                                        transition-colors duration-150"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col justify-end space-y-3">
                                <div className="flex-1 bg-background/50 rounded-md border border-dashed border-border p-3 flex flex-col items-center justify-center text-center">
                                    <div className="w-8 h-8 rounded-md bg-background-secondary flex items-center justify-center mb-1.5">
                                        <FileText className="w-4 h-4 text-foreground-secondary" />
                                    </div>
                                    <p className="text-[10px] text-foreground-secondary">
                                        支持 .txt, .md, .pdf 等常见文本格式<br />
                                        单文件最大支持 10MB
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={uploadKnowledgeFile}
                                    disabled={uploading || !uploadKbId || !uploadFile}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-border bg-transparent text-foreground hover:bg-[#efedea] active:bg-[#e3e1db] disabled:opacity-50 transition-colors duration-150 font-medium text-sm"
                                >
                                    {uploading ? <SoundWaveLoader variant="inline" /> : <Upload className="w-3.5 h-3.5" />}
                                    开始上传
                                </button>
                                {uploadError && <div className="text-[10px] text-red-500 text-center">{uploadError}</div>}
                                {uploadSuccess && <div className="text-[10px] text-emerald-500 text-center">{uploadSuccess}</div>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-foreground px-1 flex items-center gap-2">
                        <Database className="w-4 h-4 text-accent" />
                        我的知识库列表
                    </h2>

                    {listError && (
                        <div className="rounded-md border border-red-200/70 bg-red-50/60 px-4 py-3 text-xs text-red-600 flex items-center justify-between gap-3">
                            <span>{listError}</span>
                            <button
                                type="button"
                                onClick={() => { void loadKnowledgeBases(); }}
                                className="rounded-md border border-red-200/70 px-2.5 py-1 text-[11px] font-medium"
                            >
                                重试
                            </button>
                        </div>
                    )}

                    {loading ? (
                        <div className="grid grid-cols-1 gap-3">
                            {/* 骨架屏 - 模拟知识库卡片 */}
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-background rounded-md border border-border p-4 sm:p-5">
                                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                                        <div className="flex-1 space-y-3 min-w-0">
                                            <div className="flex items-start gap-3">
                                                <div className="w-5 h-5 rounded bg-foreground/10 animate-pulse" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-5 w-32 rounded bg-foreground/10 animate-pulse" />
                                                    <div className="h-4 w-48 rounded bg-foreground/5 animate-pulse" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="h-7 w-20 rounded-lg bg-foreground/5 animate-pulse" />
                                            <div className="h-7 w-24 rounded-lg bg-foreground/5 animate-pulse" />
                                            <div className="h-7 w-7 rounded-lg bg-foreground/5 animate-pulse" />
                                            <div className="h-7 w-7 rounded-lg bg-foreground/5 animate-pulse" />
                                            <div className="h-7 w-7 rounded-lg bg-foreground/5 animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : kbs.length === 0 ? (
                        <div className="bg-background rounded-md p-10 text-center border border-border border-dashed">
                            <div className="w-14 h-14 rounded-md bg-background flex items-center justify-center mx-auto mb-3">
                                <BookOpenText className="w-6 h-6 text-foreground-tertiary" />
                            </div>
                            <h3 className="text-sm font-medium text-foreground mb-1">暂无知识库</h3>
                            <p className="text-foreground-secondary text-xs max-w-xs mx-auto">
                                创建一个知识库，开始整理你的命理资料，让 AI 更好地理解你的需求
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {kbs.map(kb => (
                                (() => {
                                    const archiveState = archives[kb.id] ?? EMPTY_ARCHIVE_BUCKET;
                                    return (
                                <div
                                    key={kb.id}
                                    className={`bg-background rounded-md border transition-colors duration-150 overflow-hidden ${expandedKbId === kb.id
                                            ? 'border-emerald-500/30 bg-background-secondary/40'
                                            : 'border-border hover:bg-[#efedea] dark:hover:bg-background-secondary'
                                        }`}
                                >
                                    <div className="p-4 sm:p-5">
                                        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                                            {/* KB Info & Edit */}
                                            <div className="flex-1 space-y-3 min-w-0">
                                                <div className="flex items-start gap-3">
                                                    <BookOpenText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                                    <div className="flex-1 space-y-2 min-w-0">
                                                        <input
                                                            value={kb.name}
                                                            onChange={(e) => setKbs(prev => prev.map(x => x.id === kb.id ? { ...x, name: e.target.value } : x))}
                                                            className="w-full bg-transparent text-base font-semibold text-foreground focus:outline-none focus:bg-background/50 rounded-md px-2 -ml-2 transition-colors duration-150 placeholder:text-foreground-tertiary"
                                                            placeholder="知识库名称"
                                                        />
                                                        <textarea
                                                            value={kb.description ?? ''}
                                                            onChange={(e) => setKbs(prev => prev.map(x => x.id === kb.id ? { ...x, description: e.target.value || null } : x))}
                                                            className="w-full bg-transparent text-xs text-foreground-secondary focus:outline-none focus:bg-background/50 rounded-md px-2 -ml-2 py-1 transition-colors duration-150 resize-none placeholder:text-foreground-tertiary/50"
                                                            rows={1}
                                                            placeholder="添加描述..."
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Controls Toolbar */}
                                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                                <div className="flex items-center gap-1.5 px-1 rounded-md bg-background border border-border">
                                                    <select
                                                        value={kb.weight}
                                                        onChange={(e) => setKbs(prev => prev.map(x => x.id === kb.id ? { ...x, weight: e.target.value as KnowledgeBase['weight'] } : x))}
                                                        className="bg-transparent text-xs font-medium pl-1 pr-2 py-1 rounded focus:outline-none hover:bg-background-secondary transition-colors cursor-pointer"
                                                    >
                                                        <option value="low">{weightLabel.low}</option>
                                                        <option value="normal">{weightLabel.normal}</option>
                                                        <option value="high">{weightLabel.high}</option>
                                                    </select>
                                                </div>

                                                <button
                                                    onClick={() => togglePromptKb(kb.id)}
                                                    disabled={membershipLoading || membershipType === 'free'}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors duration-150 ${promptKbIds.includes(kb.id)
                                                            ? 'bg-[#e3e1db] border-border text-foreground dark:bg-background-tertiary dark:text-foreground'
                                                            : 'bg-background border-border text-foreground-secondary hover:bg-[#efedea] dark:hover:bg-background-secondary'
                                                        } ${(membershipLoading || membershipType === 'free') ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                    title={membershipLoading ? '会员状态加载中' : membershipType === 'free' ? '仅限 Plus 以上会员使用' : '启用知识库搜索'}
                                                >
                                                    <Sparkles className="w-3 h-3" />
                                                    {promptKbIds.includes(kb.id) ? '已启用搜索' : '启用搜索'}
                                                    {promptSavingId === kb.id && <SoundWaveLoader variant="inline" />}
                                                </button>

                                                <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

                                                <button
                                                    type="button"
                                                    onClick={() => updateKb(kb)}
                                                    disabled={savingKbId === kb.id}
                                                    className="p-1.5 rounded-md bg-background border border-border text-foreground-secondary hover:bg-[#efedea] hover:text-foreground disabled:opacity-50 transition-colors duration-150"
                                                    title="保存更改"
                                                >
                                                    {savingKbId === kb.id ? <SoundWaveLoader variant="inline" /> : <Save className="w-3.5 h-3.5" />}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpand(kb.id)}
                                                    className={`p-1.5 rounded-md border transition-colors duration-150 ${expandedKbId === kb.id
                                                            ? 'bg-[#e3e1db] border-border text-foreground dark:bg-background-tertiary dark:text-foreground'
                                                            : 'bg-background border-border text-foreground-secondary hover:bg-[#efedea] dark:hover:bg-background-secondary'
                                                        }`}
                                                    title={expandedKbId === kb.id ? "收起归档" : "查看归档"}
                                                >
                                                    {expandedKbId === kb.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setPendingDeleteKbId(kb.id)}
                                                    disabled={deletingKbId === kb.id}
                                                    className="p-1.5 rounded-md bg-background border border-border text-foreground-secondary hover:bg-red-50 hover:text-red-500 disabled:opacity-50 transition-colors duration-150"
                                                    title="删除知识库"
                                                >
                                                    {deletingKbId === kb.id ? <SoundWaveLoader variant="inline" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Archive View */}
                                    {expandedKbId === kb.id && (
                                        <div className="border-t border-border bg-background/30 p-4 sm:p-5 animation-slide-down">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                                    <Database className="w-3.5 h-3.5 text-emerald-500" />
                                                    已归档数据源
                                                    <span className="text-[10px] font-normal text-foreground-secondary bg-background px-1.5 py-0.5 rounded-md border border-border">
                                                        {archiveState.items.length}
                                                    </span>
                                                </div>
                                            </div>

                                            {archiveState.loading && !archiveState.loaded ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {/* 骨架屏 - 模拟归档数据项 */}
                                                    {[1, 2, 3, 4].map(i => (
                                                        <div key={i} className="p-2.5 rounded-md bg-background border border-border">
                                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                                <div className="h-4 w-16 rounded bg-foreground/10 animate-pulse" />
                                                                <div className="h-3 w-20 rounded bg-foreground/5 animate-pulse" />
                                                            </div>
                                                            <div className="h-4 w-full rounded bg-foreground/5 animate-pulse" />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : archiveState.error && archiveState.items.length === 0 ? (
                                                <div className="text-center py-6 rounded-md border border-dashed border-red-200/70 bg-red-50/60">
                                                    <p className="text-xs text-red-600">{archiveState.error}</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => { void loadArchives(kb.id); }}
                                                        className="mt-2 text-[10px] font-medium text-red-600"
                                                    >
                                                        重试
                                                    </button>
                                                </div>
                                            ) : archiveState.items.length === 0 ? (
                                                <div className="text-center py-6 rounded-md border border-dashed border-border/50">
                                                    <p className="text-xs text-foreground-secondary">暂无归档数据</p>
                                                    <p className="text-[10px] text-foreground-tertiary mt-0.5">
                                                        在对话或其他功能页面点击「加入知识库」即可添加
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {archiveState.items.map(a => (
                                                        <div key={a.id} className="group flex items-start justify-between gap-2 p-2.5 rounded-md bg-background border border-border hover:bg-[#efedea] dark:hover:bg-background-secondary transition-colors duration-150">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-background-secondary text-foreground-secondary border border-border">
                                                                        {sourceTypeLabel[a.source_type] || a.source_type}
                                                                    </span>
                                                                    <span className="text-[10px] text-foreground-tertiary font-mono">
                                                                        {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-foreground-secondary truncate" title={a.preview || a.source_id}>
                                                                    {a.preview ? a.preview : a.source_id}
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeArchive(a)}
                                                                disabled={removingArchiveId === a.id}
                                                                className="p-1.5 rounded-md text-foreground-tertiary hover:text-red-500 hover:bg-red-50 transition-colors duration-150 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                                title="移除归档"
                                                            >
                                                                {removingArchiveId === a.id ? <SoundWaveLoader variant="inline" /> : <Unlink2 className="w-3.5 h-3.5" />}
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {archiveState.error ? (
                                                        <div className="sm:col-span-2 rounded-md border border-red-200/70 bg-red-50/60 px-3 py-2 text-[10px] text-red-600">
                                                            {archiveState.error}
                                                        </div>
                                                    ) : null}
                                                    {archiveState.appendError ? (
                                                        <div className="sm:col-span-2 rounded-md border border-red-200/70 bg-red-50/60 px-3 py-2 text-[10px] text-red-600 flex items-center justify-between gap-3">
                                                            <span>{archiveState.appendError}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => { void loadArchives(kb.id, { append: true, offset: archiveState.nextOffset ?? 0 }); }}
                                                                className="rounded-md border border-red-200/70 px-2.5 py-1 text-[11px] font-medium"
                                                            >
                                                                重试加载更多
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                    {archiveState.hasMore && (
                                                        <div ref={archiveLoadMoreRef} className="sm:col-span-2 py-3 flex justify-center">
                                                            {archiveState.loading ? (
                                                                <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                                                                    <SoundWaveLoader variant="inline" />
                                                                </div>
                                                            ) : archiveState.appendError ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { void loadArchives(kb.id, { append: true, offset: archiveState.nextOffset ?? 0 }); }}
                                                                    className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground-secondary transition-colors hover:bg-background-secondary"
                                                                >
                                                                    重试加载更多
                                                                </button>
                                                            ) : (
                                                                <div className="text-xs text-foreground-secondary">
                                                                    继续下滑加载更多
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                    );
                                })()
                            ))}
                        </div>
                    )}
                </div>

                {!!userId && (
                    <div className="mt-8 p-3 rounded-md bg-background-secondary/50 border border-border/50 text-center">
                        <p className="text-[10px] text-foreground-secondary">
                            💡 提示：在对话、命理记录、塔罗/六爻/合盘/面相/手相/MBTI 结果页面，点击「加入知识库」按钮即可将内容快速归档到指定知识库。
                        </p>
                    </div>
                )}
                </div>
            </div>
            <ConfirmDialog
                isOpen={!!pendingDeleteKbId}
                onClose={() => setPendingDeleteKbId(null)}
                onConfirm={() => pendingDeleteKbId ? deleteKb(pendingDeleteKbId) : undefined}
                title="确认删除"
                description="确定要删除该知识库吗？此操作会移除其下的关联内容。"
                confirmText="确认删除"
                variant="danger"
                loading={!!deletingKbId}
            />
        </>
    );
}
