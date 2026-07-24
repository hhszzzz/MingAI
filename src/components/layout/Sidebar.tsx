/**
 * 左侧导航栏组件
 *
 * 设计说明：
 * - 包含所有命理体系入口（八字、紫微、塔罗等）
 * - AI 区域下方内嵌对话列表（新聊天/搜索/对话列表）
 * - 桌面端显示在左侧，移动端隐藏（使用 MobileNav 代替）
 * - 侧边栏固定展开，顶部入口改为公告中心
 * - 底部包含用户信息
 */
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { Bell, LogIn } from 'lucide-react';
import { useState, useCallback, useMemo, Suspense } from 'react';
import { AuthModal } from '@/components/auth/AuthModal';
import { SidebarUserCard } from '@/components/layout/UserMenu';
import { SidebarConversations } from '@/components/layout/SidebarConversations';
import { useSessionSafe } from '@/components/providers/ClientProviders';
import { useAnnouncementCenterSafe } from '@/components/providers/AnnouncementPopupHost';
import { useFeatureToggles } from '@/lib/hooks/useFeatureToggles';
import { useNotificationUnreadCount } from '@/lib/hooks/useNotificationUnreadCount';
import { getSidebarNavItems, getSidebarToolItems } from '@/lib/navigation/registry';
import { useConversationList } from '@/lib/chat/ConversationListContext';

// Derive from registry once at module level
const navItems = getSidebarNavItems();
const toolItems = getSidebarToolItems();

export function Sidebar() {
    return (
        <Suspense fallback={<SidebarSkeleton />}>
            <SidebarInner />
        </Suspense>
    );
}

function SidebarSkeleton() {
    return (
        <aside className="
            hidden lg:flex flex-col h-screen sticky top-0 z-20
            bg-[#f7f6f3] dark:bg-[#181715] border-r border-gray-200 dark:border-white/10
            transition-all duration-150 ease-in-out
            w-[var(--sidebar-width)]
        ">
            <div className="flex items-center h-16 px-4 border-b border-gray-200 dark:border-white/10 justify-between">
                <Link href="/" className="flex items-center gap-2 min-w-0">
                    <Image src="/Logo.svg" alt="太卜 Logo" width={28} height={28} className="rounded-md flex-shrink-0 dark:invert" />
                    <span className="font-bold text-base text-[#37352f] dark:text-[#f5f3ee] whitespace-nowrap">太卜</span>
                </Link>
                <div className="w-8 h-8 rounded-md bg-[#efedea] dark:bg-white/10 animate-pulse" />
            </div>
            <div className="flex-1 py-4 px-2 space-y-3">
                {Array.from({ length: 9 }).map((_, index) => (
                    <div key={index} className="rounded-md bg-[#efedea] dark:bg-white/10 animate-pulse h-10 w-full" />
                ))}
            </div>
        </aside>
    );
}

function SidebarLoadError({ onRetry }: { onRetry: () => void }) {
    return (
        <aside className="
            hidden lg:flex flex-col h-screen sticky top-0 z-20
            bg-[#f7f6f3] dark:bg-[#181715] border-r border-gray-200 dark:border-white/10
            w-[var(--sidebar-width)]
        ">
            <div className="flex items-center h-16 px-4 border-b border-gray-200 dark:border-white/10">
                <Link href="/" className="flex items-center gap-2 min-w-0">
                    <Image src="/Logo.svg" alt="太卜 Logo" width={28} height={28} className="rounded-md flex-shrink-0 dark:invert" />
                    <span className="font-bold text-base text-[#37352f] dark:text-[#f5f3ee] whitespace-nowrap">太卜</span>
                </Link>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-sm text-[#37352f]/60 dark:text-[#f5f3ee]/60">导航状态加载失败</p>
                <button
                    type="button"
                    onClick={onRetry}
                    className="rounded-md bg-[#37352f] px-3 py-2 text-sm text-white transition-colors hover:bg-[#2b2925] dark:bg-[#f5f3ee] dark:text-[#181715] dark:hover:bg-[#e8e4dd]"
                >
                    重试
                </button>
            </div>
        </aside>
    );
}

function SidebarInner() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user } = useSessionSafe();
    const { isFeatureEnabled, isLoading: featureLoading, loaded: featureLoaded, error: featureError, refresh: refreshFeatures } = useFeatureToggles();
    const { handleNewChat } = useConversationList();
    const { openAnnouncementCenter, announcementPromptCount } = useAnnouncementCenterSafe();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const isNavLoading = featureLoading;
    const notificationsEnabled = isFeatureEnabled('notifications');
    const unreadCount = useNotificationUnreadCount(user?.id ?? null, {
        enabled: notificationsEnabled,
    });
    const badgeCount = (notificationsEnabled ? (unreadCount ?? 0) : 0) + announcementPromptCount;

    // 当前是否在具体某个对话中
    const activeConvId = searchParams.get('id');

    // 根据 feature toggle 过滤导航项
    const filteredNavItems = useMemo(() => navItems
        .filter((item) => isFeatureEnabled(item.id)), [isFeatureEnabled]);

    const chatItem = useMemo(() => toolItems
        .find((item) => item.id === 'chat' && isFeatureEnabled('chat')), [isFeatureEnabled]);

    const filteredToolItems = useMemo(() => toolItems
        .filter((item) => item.id !== 'chat' && isFeatureEnabled(item.id)), [isFeatureEnabled]);

    const toggleAnnouncementCenter = useCallback(() => {
        openAnnouncementCenter({
            tab: user && notificationsEnabled ? 'notifications' : 'announcements',
        });
    }, [notificationsEnabled, openAnnouncementCenter, user]);

    if (isNavLoading) {
        return <SidebarSkeleton />;
    }

    if (featureError && !featureLoading) {
        return <SidebarLoadError onRetry={() => { void refreshFeatures(); }} />;
    }

    if (!featureLoaded) {
        return <SidebarSkeleton />;
    }

    return (
        <>
            <aside
                className="
                    hidden lg:flex flex-col h-screen sticky top-0 z-20
                    bg-[#f7f6f3] dark:bg-[#181715] border-r border-gray-200 dark:border-white/10
                    transition-all duration-150 ease-in-out
                    w-[var(--sidebar-width)]
                "
            >
                <div className="flex items-center h-16 px-4 border-b border-gray-200 dark:border-white/10 justify-between transition-all duration-150 flex-shrink-0">
                    <Link href="/" className="flex items-center gap-2 min-w-0">
                        <Image
                            src="/Logo.svg"
                            alt="太卜 Logo"
                            width={28}
                            height={28}
                            className="rounded-md flex-shrink-0 dark:invert"
                        />
                        <span className="font-bold text-base text-[#37352f] dark:text-[#f5f3ee] whitespace-nowrap">
                            太卜
                        </span>
                    </Link>
                    <button
                        onClick={toggleAnnouncementCenter}
                        className="relative p-1.5 rounded-md flex-shrink-0 transition-all duration-150 text-[#37352f]/60 dark:text-[#f5f3ee]/60 hover:bg-[#efedea] dark:hover:bg-white/8 hover:text-[#37352f] dark:hover:text-[#f5f3ee]"
                        aria-label="打开公告中心"
                    >
                        <Bell className="w-5 h-5" />
                        {badgeCount > 0 ? (
                            <span className="absolute -right-0.5 -top-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-[#2383e2] text-white text-[10px] font-bold leading-none flex items-center justify-center">
                                {badgeCount > 99 ? '99+' : badgeCount}
                            </span>
                        ) : null}
                    </button>
                </div>

                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="pt-4 px-2 flex-shrink-0 border-b border-gray-100/50 dark:border-white/6">
                        <div className="px-3 text-[11px] font-semibold text-[#37352f]/50 dark:text-[#f5f3ee]/45 uppercase tracking-wider mb-1">
                            命理体系
                        </div>
                        <ul className="space-y-0.5">
                            {filteredNavItems.map((item) => {
                                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                                const Icon = item.icon;

                                return (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            className={`
                                                flex items-center px-3 gap-2 py-1.5 rounded-md
                                                transition-colors duration-150
                                                ${isActive
                                                    ? 'bg-[#e3e1db] dark:bg-white/8 text-[#37352f] dark:text-[#f5f3ee]'
                                                    : 'text-[#37352f] dark:text-[#f5f3ee] hover:bg-[#efedea] dark:hover:bg-white/6'
                                                }
                                            `}
                                        >
                                            <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-[#37352f] dark:text-[#f5f3ee]' : 'text-[#37352f]/70 dark:text-[#f5f3ee]/70'}`} />
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium truncate">{item.label}</div>
                                            </div>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-white/10 px-2">
                        {chatItem && (
                            <div>
                                <div className="sticky top-0 z-30 bg-[#f7f6f3] dark:bg-[#181715] px-3 pt-3 pb-1.5 text-[11px] font-semibold text-[#37352f]/50 dark:text-[#f5f3ee]/45 uppercase tracking-wider">
                                    AI
                                </div>
                                <ul className="space-y-0.5">
                                    <li>
                                        <Link
                                            href={chatItem.href}
                                            className={`flex items-center px-3 gap-2 py-1.5 rounded-md transition-colors duration-150 ${pathname === chatItem.href && !activeConvId ? 'bg-[#e3e1db] dark:bg-white/8 text-[#37352f] dark:text-[#f5f3ee]' : 'text-[#37352f] dark:text-[#f5f3ee] hover:bg-[#efedea] dark:hover:bg-white/6'}`}
                                            onClick={(event) => {
                                                event.preventDefault();
                                                handleNewChat().then(() => router.push('/chat'));
                                            }}
                                        >
                                            <chatItem.icon className="w-4.5 h-4.5 flex-shrink-0 text-[#37352f]/70 dark:text-[#f5f3ee]/70" />
                                            <span className="text-sm font-medium whitespace-nowrap">{chatItem.label}</span>
                                        </Link>
                                        {user ? <SidebarConversations /> : null}
                                    </li>
                                </ul>
                            </div>
                        )}

                        {filteredToolItems.length > 0 && <div className="sticky top-0 z-20 bg-[#f7f6f3] dark:bg-[#181715] px-3 pt-3 pb-1.5 text-[11px] font-semibold text-[#37352f]/50 dark:text-[#f5f3ee]/45 uppercase tracking-wider">工具</div>}
                        <ul className="space-y-0.5">
                            {filteredToolItems.map((item) => {
                                const isActive = pathname === item.href;
                                const Icon = item.icon;

                                return (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            className={`
                                                flex items-center px-3 gap-2 py-1.5 rounded-md
                                                transition-colors duration-150
                                                ${isActive
                                                    ? 'bg-[#e3e1db] dark:bg-white/8 text-[#37352f] dark:text-[#f5f3ee]'
                                                    : 'text-[#37352f] dark:text-[#f5f3ee] hover:bg-[#efedea] dark:hover:bg-white/6'
                                                }
                                            `}
                                        >
                                            <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-[#37352f] dark:text-[#f5f3ee]' : 'text-[#37352f]/70 dark:text-[#f5f3ee]/70'}`} />
                                            <span className="text-sm font-medium whitespace-nowrap">
                                                {item.label}
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                </div>

                <div className="border-t border-gray-200 dark:border-white/10 p-2 flex-shrink-0">
                    {user ? (
                        <SidebarUserCard user={user} />
                    ) : (
                        <button
                            onClick={() => setShowAuthModal(true)}
                            className="
                                flex items-center gap-1.5 px-3 py-2 justify-center rounded-md w-full
                                text-sm font-medium
                                bg-[#2383e2] text-white
                                hover:bg-[#2383e2]/90 active:bg-[#1a65b0]
                                transition-colors duration-150
                            "
                        >
                            <LogIn className="w-4 h-4 flex-shrink-0" />
                            <span>登录</span>
                        </button>
                    )}
                </div>
            </aside>
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
            />
        </>
    );
}
