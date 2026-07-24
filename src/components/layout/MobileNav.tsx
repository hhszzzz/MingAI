/**
 * 移动端底部导航组件
 *
 * 设计说明：
 * - 仅在移动端显示（lg 以下屏幕）
 * - 固定在底部，提供主要入口
 * - 第五个是"更多"按钮，点击展开抽屉显示所有入口
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Plus,
    X,
} from 'lucide-react';
import { useFeatureToggles } from '@/lib/hooks/useFeatureToggles';
import { useActiveSettingsCenterTab } from '@/lib/hooks/useSettingsCenterRouteState';
import { DEFAULT_MOBILE_MAIN_ITEMS, DEFAULT_MOBILE_DRAWER_ORDER } from '@/lib/user/settings';
import { getMobileItemsRecord, toFeatureId } from '@/lib/navigation/registry';
import {
    getSettingsCenterTabFromRouteTarget,
    openSettingsCenter,
} from '@/lib/settings-center';

const ALL_NAV_ITEMS = getMobileItemsRecord();

function isMergedMembershipNavEnabled(id: string, isFeatureEnabled: (featureId: string) => boolean) {
    if (id === 'settings-personalization') {
        return isFeatureEnabled('chat') && isFeatureEnabled('ai-personalization');
    }
    return isFeatureEnabled(toFeatureId(id));
}

const GRID_COLS_CLASS: Record<number, string> = {
    0: 'grid-cols-1',
    1: 'grid-cols-2',
    2: 'grid-cols-3',
    3: 'grid-cols-4',
};

export function MobileNav() {
    const pathname = usePathname();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const { isFeatureEnabled, isLoading: featureLoading, loaded: featureLoaded, error: featureError, refresh: refreshFeatures } = useFeatureToggles();
    const isNavLoading = featureLoading;
    const activeSettingsTab = useActiveSettingsCenterTab();

    // 底部导航栏项目（硬编码默认顺序）
    const mainNavItems = useMemo(() => {
        return [...DEFAULT_MOBILE_MAIN_ITEMS]
            .filter(id => isMergedMembershipNavEnabled(id, isFeatureEnabled))
            .map(id => ALL_NAV_ITEMS[id])
            .filter((item): item is typeof ALL_NAV_ITEMS[string] => !!item);
    }, [isFeatureEnabled]);

    // 抽屉中的项目（硬编码默认顺序）
    const drawerNavItems = useMemo(() => {
        const mainSet = new Set<string>(DEFAULT_MOBILE_MAIN_ITEMS);
        return [...DEFAULT_MOBILE_DRAWER_ORDER]
            .filter(id => !mainSet.has(id) && isMergedMembershipNavEnabled(id, isFeatureEnabled))
            .map(id => ALL_NAV_ITEMS[id])
            .filter((item): item is typeof ALL_NAV_ITEMS[string] => !!item);
    }, [isFeatureEnabled]);

    // 点击外部或链接时关闭抽屉
    const closeDrawer = useCallback(() => {
        setIsDrawerOpen(false);
    }, []);

    // 打开抽屉时禁止背景滚动
    useEffect(() => {
        if (isDrawerOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isDrawerOpen]);

    if (isNavLoading) {
        return (
            <nav
                className="
                    lg:hidden fixed bottom-0 left-0 right-0 z-40
                    bg-background/95 backdrop-blur-md
                    border-t border-border
                "
            >
                <div className="grid grid-cols-5 gap-1 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="flex flex-col items-center gap-2 py-2">
                            <div className="w-10 h-10 rounded-full bg-background-secondary animate-pulse" />
                            <div className="w-8 h-3 rounded bg-background-secondary animate-pulse" />
                        </div>
                    ))}
                </div>
            </nav>
        );
    }

    if (featureError && !featureLoading) {
        return (
            <nav
                className="
                    lg:hidden fixed bottom-0 left-0 right-0 z-40
                    bg-background/95 backdrop-blur-md
                    border-t border-border
                "
            >
                <div className="flex items-center justify-between px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                    <span className="text-xs text-foreground-secondary">导航状态加载失败</span>
                    <button
                        type="button"
                        onClick={() => { void refreshFeatures(); }}
                        className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background"
                    >
                        重试
                    </button>
                </div>
            </nav>
        );
    }

    if (!featureLoaded) {
        return (
            <nav
                className="
                    lg:hidden fixed bottom-0 left-0 right-0 z-40
                    bg-background/95 backdrop-blur-md
                    border-t border-border
                "
            >
                <div className="grid grid-cols-5 gap-1 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="flex flex-col items-center gap-2 py-2">
                            <div className="w-10 h-10 rounded-full bg-background-secondary animate-pulse" />
                            <div className="w-8 h-3 rounded bg-background-secondary animate-pulse" />
                        </div>
                    ))}
                </div>
            </nav>
        );
    }

    return (
        <>
            {/* 抽屉遮罩 */}
            {isDrawerOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
                    onClick={closeDrawer}
                />
            )}

            {/* 抽屉内容 */}
            <div
                className={`
                    lg:hidden fixed left-0 right-0 bottom-0 z-50
                    bg-background rounded-t-2xl
                    transform transition-transform duration-300 ease-out
                    ${isDrawerOpen ? 'translate-y-0' : 'translate-y-full'}
                    max-h-[70vh] overflow-hidden flex flex-col
                `}
            >
                {/* 抽屉头部 */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="font-medium text-foreground">全部功能</h3>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={closeDrawer}
                            className="p-2 rounded-full hover:bg-background-secondary text-foreground-secondary"
                            aria-label="关闭抽屉"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 抽屉内容网格 */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-4 gap-3">
                        {drawerNavItems.map((item) => {
                            const settingsTab = getSettingsCenterTabFromRouteTarget(item.href);
                            // 精确匹配：只有完全匹配或者是该路径的直接子页面才高亮
                            const isActive = settingsTab
                                ? activeSettingsTab === settingsTab
                                : pathname === item.href ||
                                (pathname?.startsWith(item.href + '/') && !drawerNavItems.some(other =>
                                    other.href !== item.href &&
                                    other.href.startsWith(item.href + '/') &&
                                    (pathname === other.href || pathname?.startsWith(other.href + '/'))
                                ));
                            const Icon = item.icon;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl
                                        transition-colors duration-200
                                        ${isActive
                                            ? 'bg-accent/10 text-accent'
                                            : 'bg-background-secondary hover:bg-accent/5 text-foreground-secondary'
                                        }`}
                                    onClick={(event) => {
                                        if (settingsTab) {
                                            event.preventDefault();
                                            closeDrawer();
                                            openSettingsCenter(settingsTab);
                                            return;
                                        }
                                        closeDrawer();
                                    }}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2
                                        ${isActive ? 'bg-accent/20' : 'bg-background'}`}>
                                        <Icon className={`w-5 h-5 ${isActive ? 'text-accent' : ''}`} />
                                    </div>
                                    <span className="text-xs text-center">{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 底部导航栏 */}
            <nav
                className={`
                    lg:hidden fixed bottom-0 left-0 right-0 z-40
                    bg-background/95 backdrop-blur-md
                    border-t border-border
                    safe-area-inset-bottom
                    transition-transform duration-300
                    ${isDrawerOpen ? 'translate-y-full' : 'translate-y-0'}
                `}
            >
                <ul className={`grid px-2 py-1 ${
                    GRID_COLS_CLASS[mainNavItems.length] ?? 'grid-cols-5'
                }`}>
                    {mainNavItems.map((item) => {
                        const settingsTab = getSettingsCenterTabFromRouteTarget(item.href);
                        const isActive = settingsTab
                            ? activeSettingsTab === settingsTab
                            : pathname === item.href || pathname?.startsWith(item.href + '/');
                        const Icon = item.icon;

                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    onClick={(event) => {
                                        if (!settingsTab) {
                                            return;
                                        }

                                        event.preventDefault();
                                        openSettingsCenter(settingsTab);
                                    }}
                                    className={`
                                        flex flex-col items-center justify-center
                                        w-full h-14
                                        transition-colors duration-200
                                        ${isActive ? 'text-accent' : 'text-foreground-secondary'}
                                    `}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}

                    {/* 更多按钮 */}
                    <li>
                        <button
                            onClick={() => setIsDrawerOpen(true)}
                            className={`
                                flex flex-col items-center justify-center
                                w-full h-14
                                transition-all duration-200
                                text-foreground-secondary
                            `}
                            aria-label="展开更多功能"
                        >
                            <div className="w-6 h-6 rounded-full flex items-center justify-center">
                                <Plus className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] mt-1 font-medium">更多</span>
                        </button>
                    </li>
                </ul>
            </nav>
        </>
    );
}
