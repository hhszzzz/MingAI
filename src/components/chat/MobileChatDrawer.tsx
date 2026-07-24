/**
 * 移动端对话抽屉
 *
 * 在 /chat 页面的移动端显示，提供滑入式侧边栏展示对话列表。
 * 桌面端由全局 Sidebar 的 SidebarConversations 组件负责。
 *
 * 'use client' 标记说明：
 * - 使用 React hooks 和交互状态
 */
'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Search, SquarePen, Trash2, Archive, ArrowLeft,
    PanelLeftClose, PanelLeft,
} from 'lucide-react';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';
import type { ConversationListItem, ConversationSourceType } from '@/types';
import { useConversationList } from '@/lib/chat/ConversationListContext';
import { useKnowledgeBaseFeatureEnabled } from '@/components/knowledge-base/useKnowledgeBaseFeatureEnabled';
import { AddToKnowledgeBaseModal } from '@/components/knowledge-base/AddToKnowledgeBaseModal';
import { ConversationGroup } from '@/components/chat/sidebar/ConversationGroup';
import { SOURCE_TYPE_CONFIG, SOURCE_TYPE_ORDER } from '@/lib/chat/conversation-groups';
import { formatConversationMenuTitle as formatMenuTitle } from '@/lib/chat/conversation-title-display';

export function MobileChatDrawer() {
    const router = useRouter();
    const {
        conversations,
        conversationsLoading,
        loadingMoreConversations,
        hasLoadedConversations,
        hasMoreConversations,
        conversationListError,
        pendingSidebarTitle,
        retryConversationListLoad,
        handleDeleteConversation,
        handleRenameConversation,
        handleNewChat,
        triggerConversationListLoad,
        loadMoreConversations,
    } = useConversationList();
    const { knowledgeBaseEnabled } = useKnowledgeBaseFeatureEnabled();

    const [isOpen, setIsOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<ConversationSourceType>>(new Set());
    const [actionConv, setActionConv] = useState<ConversationListItem | null>(null);
    const [actionView, setActionView] = useState<'menu' | 'rename' | 'delete'>('menu');
    const [actionMenuPos, setActionMenuPos] = useState<{ top: number; left: number } | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [archiveTarget, setArchiveTarget] = useState<ConversationListItem | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [hasUserScrolled, setHasUserScrolled] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

    // Determine active conversation from URL
    const activeId = useMemo(() => {
        if (typeof window === 'undefined') return undefined;
        const url = new URL(window.location.href);
        return url.searchParams.get('id') ?? undefined;
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps -- re-derive on open/close

    const groupedConversations = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        const filtered = query
            ? conversations.filter(conv => (conv.title ?? '').toLowerCase().includes(query))
            : conversations;

        const groups: Record<ConversationSourceType, ConversationListItem[]> = {
            chat: [], dream: [], bazi_wuxing: [], bazi_personality: [],
            tarot: [], liuyao: [], ziwei: [], mbti: [], hepan: [],
            palm: [], face: [], qimen: [], daliuren: [],
            meihua: [], xiaoliuren: [],
        };

        filtered.forEach(conv => {
            let type = conv.sourceType || 'chat';
            if (type === 'bazi_personality') type = 'bazi_wuxing';
            if (groups[type]) groups[type].push(conv);
            else groups.chat.push(conv);
        });

        return groups;
    }, [conversations, searchQuery]);

    const toggleGroup = useCallback((type: ConversationSourceType) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });
    }, []);

    const handleSelect = useCallback((id: string) => {
        router.push(`/chat?id=${id}`);
        setIsOpen(false);
        setHasUserScrolled(false);
    }, [router]);

    const handleNew = useCallback(async () => {
        await handleNewChat();
        router.push('/chat');
        setIsOpen(false);
        setHasUserScrolled(false);
    }, [handleNewChat, router]);

    const closeDrawer = useCallback(() => {
        setIsOpen(false);
        setHasUserScrolled(false);
    }, []);

    const handleToggle = useCallback(() => {
        if (isOpen) {
            closeDrawer();
            return;
        }

        setIsOpen(true);
        triggerConversationListLoad();
    }, [closeDrawer, isOpen, triggerConversationListLoad]);

    // Action menu helpers
    const closeActionSheet = useCallback(() => {
        setActionConv(null);
        setActionView('menu');
        setActionMenuPos(null);
    }, []);

    const openActionSheet = useCallback((conv: ConversationListItem, e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setActionMenuPos({ top: rect.bottom + 4, left: rect.left });
        setActionConv(conv);
        setActionView('menu');
    }, []);

    const startInlineRename = useCallback(() => {
        if (!actionConv || actionConv.sourceType !== 'chat') return;
        setEditingId(actionConv.id);
        setEditTitle(actionConv.title);
        closeActionSheet();
    }, [actionConv, closeActionSheet]);

    const saveRename = useCallback(() => {
        if (editingId && editTitle.trim()) {
            handleRenameConversation(editingId, editTitle.trim());
            setEditingId(null);
            setEditTitle('');
        }
    }, [editingId, editTitle, handleRenameConversation]);

    const cancelRename = useCallback(() => {
        setEditingId(null);
        setEditTitle('');
    }, []);

    const confirmDelete = useCallback(() => {
        if (!actionConv) return Promise.resolve();

        setDeleteLoading(true);
        return handleDeleteConversation(actionConv.id).finally(() => {
            setDeleteLoading(false);
            closeActionSheet();
        });
    }, [actionConv, closeActionSheet, handleDeleteConversation]);

    const openArchive = useCallback(() => {
        if (!actionConv) return;
        setArchiveTarget(actionConv);
        closeActionSheet();
    }, [actionConv, closeActionSheet]);

    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) {
            return;
        }

        const handleScroll = () => {
            setHasUserScrolled(scrollContainer.scrollTop > 0);
        };

        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            scrollContainer.removeEventListener('scroll', handleScroll);
        };
    }, []);

    useEffect(() => {
        if (
            !isOpen
            || !hasLoadedConversations
            || !hasUserScrolled
            || !hasMoreConversations
            || loadingMoreConversations
            || !loadMoreSentinelRef.current
            || !scrollContainerRef.current
        ) {
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                void loadMoreConversations();
            }
        }, {
            root: scrollContainerRef.current,
            rootMargin: '120px 0px',
        });

        observer.observe(loadMoreSentinelRef.current);
        return () => observer.disconnect();
    }, [
        hasLoadedConversations,
        hasUserScrolled,
        hasMoreConversations,
        isOpen,
        loadMoreConversations,
        loadingMoreConversations,
    ]);

    return (
        <>
            {/* 遮罩层 - 移动端 */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={closeDrawer}
                />
            )}

            {/* 侧边栏 */}
            <aside
                className={`
                    lg:hidden fixed top-15 bottom-15 left-0 z-50
                    flex flex-row items-center
                    transition-transform duration-300 ease-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-[calc(100%-40px)]'}
                `}
            >
                {/* 内容区域 */}
                <div className="h-full w-64 border-r border-border bg-background flex flex-col shadow-lg rounded-r-lg">
                    {/* 操作按钮 */}
                    <div className="px-2 py-2 space-y-1">
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleNew}
                                className="flex items-center gap-3 px-3 py-2.5 h-12 rounded-md hover:bg-background-secondary active:bg-background-tertiary transition-colors duration-150 text-sm flex-1"
                                title="新聊天"
                            >
                                <SquarePen className="w-5 h-5 flex-shrink-0" />
                                <span className="whitespace-nowrap">新聊天</span>
                            </button>
                        </div>

                        <button
                            onClick={() => setIsSearching(!isSearching)}
                            className={`flex items-center gap-3 px-3 py-2.5 h-12 rounded-md transition-colors duration-150 text-sm ${isSearching ? 'bg-background-secondary' : 'hover:bg-background-secondary'} w-full`}
                            title="搜索聊天"
                        >
                            <Search className="w-5 h-5 flex-shrink-0" />
                            <span className="whitespace-nowrap">搜索聊天</span>
                        </button>
                    </div>

                    {/* 搜索框 */}
                    {isSearching && (
                        <div className="px-3 pb-3">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="搜索对话标题..."
                                className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-accent/10 focus:border-accent"
                                autoFocus
                            />
                        </div>
                    )}

                    {/* 分组对话列表 */}
                    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-2 pb-2">
                        {conversationListError && !hasLoadedConversations && !conversationsLoading ? (
                            <div className="rounded-lg border border-[#ead9bf] bg-[#fcf8ee] px-4 py-4 text-sm text-[#946c21]">
                                <div>{conversationListError}</div>
                                <button
                                    type="button"
                                    onClick={() => { void retryConversationListLoad(); }}
                                    className="mt-3 rounded-md px-3 py-1.5 font-medium text-[#7c5f1c] transition-colors hover:bg-[#f4ead3]"
                                >
                                    重试
                                </button>
                            </div>
                        ) : !hasLoadedConversations || conversationsLoading ? (
                            <div className="flex flex-col items-center justify-center text-foreground-secondary text-sm py-8 gap-2">
                                {hasLoadedConversations ? (
                                    <>
                                        <SoundWaveLoader variant="inline" />
                                    </>
                                ) : (
                                    <div className="w-full px-3 space-y-3">
                                        <div className="h-4 w-24 rounded-md bg-background-secondary animate-pulse" />
                                        <div className="space-y-2">
                                            <div className="h-9 rounded-md bg-background-secondary animate-pulse" />
                                            <div className="h-9 rounded-md bg-background-secondary animate-pulse" />
                                            <div className="h-9 rounded-md bg-background-secondary animate-pulse" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : conversations.length === 0 && !pendingSidebarTitle ? (
                            <div className="text-center text-foreground-secondary text-sm py-8">
                                暂无对话记录
                            </div>
                        ) : (
                            <>
                                {conversationListError ? (
                                    <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-[#ead9bf] bg-[#fcf8ee] px-3 py-2 text-xs text-[#946c21]">
                                        <span className="min-w-0 flex-1">{conversationListError}</span>
                                        <button
                                            type="button"
                                            onClick={() => { void retryConversationListLoad(); }}
                                            className="shrink-0 rounded-md px-2 py-1 font-medium text-[#7c5f1c] transition-colors hover:bg-[#f4ead3]"
                                        >
                                            重试
                                        </button>
                                    </div>
                                ) : null}
                                {SOURCE_TYPE_ORDER.map(type => {
                                    const items = groupedConversations[type];
                                    const showPendingInGroup = type === 'chat' && !!pendingSidebarTitle;
                                    if (items.length === 0 && !showPendingInGroup) return null;

                                    const config = SOURCE_TYPE_CONFIG[type];
                                    const isGroupCollapsed = collapsedGroups.has(type);

                                    return (
                                        <ConversationGroup
                                            key={type}
                                            type={type}
                                            label={config.label}
                                            items={items}
                                            showLabel={type !== 'chat'}
                                            isGroupCollapsed={isGroupCollapsed}
                                            onToggleGroup={toggleGroup}
                                            activeId={activeId}
                                            actionConvId={actionConv?.id}
                                            isSidebarCollapsed={false}
                                            onSelect={handleSelect}
                                            onOpenAction={openActionSheet}
                                            editingId={editingId}
                                            editTitle={editTitle}
                                            onEditTitleChange={setEditTitle}
                                            onSaveRename={saveRename}
                                            onCancelRename={cancelRename}
                                            pendingTitle={pendingSidebarTitle}
                                            showPendingInGroup={showPendingInGroup}
                                        />
                                    );
                                })}
                                {hasLoadedConversations && hasMoreConversations && (
                                    <div ref={loadMoreSentinelRef} className="py-3">
                                        {loadingMoreConversations ? (
                                            <div className="flex items-center justify-center gap-2 text-xs text-foreground-secondary">
                                                <SoundWaveLoader variant="inline" />
                                            </div>
                                        ) : (
                                            <div className="text-center text-xs text-foreground-secondary">
                                                上滑加载更多
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* 手机端把手 */}
                <div
                    className="group relative flex flex-col items-start z-20 cursor-pointer -ml-[1px]"
                    onClick={handleToggle}
                >
                    <button
                        className="relative flex items-center justify-center w-10 h-16 bg-background rounded-r-lg border border-l-0 border-border shadow-md transition-colors duration-150"
                        title={isOpen ? "收起" : "打开"}
                    >
                        <div className="text-foreground-secondary group-hover:text-foreground transition-colors duration-150">
                            {isOpen ? (
                                <PanelLeftClose className="w-5 h-5" />
                            ) : (
                                <PanelLeft className="w-5 h-5" />
                            )}
                        </div>
                    </button>
                </div>
            </aside>

            {/* Action menu */}
            {actionConv && actionMenuPos && (
                <div className="fixed inset-0 z-[60]" onClick={closeActionSheet}>
                    <div className="absolute inset-0 bg-black/10 dark:bg-black/30" />
                    <div
                        className={`fixed z-[61] bg-background rounded-md border border-border shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left text-foreground ${actionView === 'delete' ? 'min-w-[260px] max-w-[320px]' : 'min-w-[160px] max-w-[240px]'}`}
                        style={{
                            top: Math.min(actionMenuPos.top, window.innerHeight - (actionView === 'delete' ? 280 : 200)),
                            left: Math.max(16, Math.min(actionMenuPos.left, window.innerWidth - (actionView === 'delete' ? 320 : 240))),
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {actionView === 'menu' && (
                            <div className="p-1.5">
                                <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground-secondary truncate border-b border-border mb-1">
                                    {formatMenuTitle(actionConv)}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    {actionConv.sourceType === 'chat' && (
                                        <button
                                            type="button"
                                            onClick={startInlineRename}
                                            className="w-full text-left px-2 py-1.5 rounded-md hover:bg-background-secondary active:bg-background-tertiary transition-colors duration-150 text-sm font-bold flex items-center gap-2"
                                        >
                                            <SquarePen className="w-4 h-4 text-foreground-secondary" />
                                            <span>重命名</span>
                                        </button>
                                    )}
                                    {knowledgeBaseEnabled && (
                                        <button
                                            type="button"
                                            onClick={openArchive}
                                            className="w-full text-left px-2 py-1.5 rounded-md hover:bg-background-secondary active:bg-background-tertiary transition-colors duration-150 text-sm font-bold flex items-center gap-2"
                                        >
                                            <Archive className="w-4 h-4 text-foreground-secondary" />
                                            <span>{actionConv.isArchived ? '已归档' : '归档'}</span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setActionView('delete')}
                                        className="w-full text-left px-2 py-1.5 rounded-md hover:bg-destructive/10 transition-colors duration-150 text-destructive text-sm font-bold flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>删除</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {actionView === 'delete' && actionConv && (
                            <div className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setActionView('menu')}
                                        disabled={deleteLoading}
                                        className="p-1 rounded-md hover:bg-background-secondary transition-colors duration-150 disabled:opacity-50"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                    </button>
                                    <div className="font-bold text-sm text-destructive">确认删除对话</div>
                                </div>

                                <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-3 mb-4">
                                    <div className="text-sm font-semibold text-foreground truncate">
                                        {formatMenuTitle(actionConv)}
                                    </div>
                                    <p className="mt-1 text-xs text-foreground-secondary leading-relaxed">
                                        删除后无法恢复，相关对话内容将一起移除。
                                    </p>
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setActionView('menu')}
                                        disabled={deleteLoading}
                                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-background-secondary transition-colors disabled:opacity-50"
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="button"
                                        onClick={confirmDelete}
                                        disabled={deleteLoading}
                                        className="px-3 py-1.5 text-xs font-bold rounded-md bg-destructive text-white hover:bg-destructive/90 transition-all duration-150 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {deleteLoading && <SoundWaveLoader variant="inline" />}
                                        确认删除
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Knowledge base archive modal */}
            {knowledgeBaseEnabled && archiveTarget && (
                <AddToKnowledgeBaseModal
                    open={true}
                    onClose={() => setArchiveTarget(null)}
                    sourceTitle={archiveTarget.title}
                    sourceType="conversation"
                    sourceId={archiveTarget.id}
                />
            )}
        </>
    );
}
