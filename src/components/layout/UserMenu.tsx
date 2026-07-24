'use client';

import { createElement, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Bug, ChevronRight, Github, LogOut } from 'lucide-react';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';
import { signOut } from '@/lib/auth';
import { buildMembershipInfo } from '@/lib/user/membership';
import { getUserEmailDisplay } from '@/lib/user-email';
import { useFeatureToggles } from '@/lib/hooks/useFeatureToggles';
import type { User as SupabaseUser } from '@/lib/auth';
import { SettingsCenterLink } from '@/components/settings/SettingsCenterLink';
import { SETTINGS_CENTER_TAB_ICONS } from '@/components/settings/settings-center-icons';
import { useCurrentUserProfile } from '@/lib/hooks/useCurrentUserProfile';
import type { SettingsCenterTab } from '@/lib/settings-center';

interface SidebarUserCardProps {
    user: SupabaseUser;
    collapsed?: boolean;
}

const membershipLabels: Record<string, string> = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
};

function Avatar({ src, alt, size = 32 }: { src: string | null; alt: string; size?: number }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        className="flex flex-shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-[#efedea] font-bold text-[#37352f]/40"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {alt[0]?.toUpperCase() || 'U'}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="flex-shrink-0 rounded-xl border border-gray-200 object-cover"
      style={{ width: size, height: size }}
      onError={() => setError(true)}
    />
  );
}

function useIsDesktopSidebar() {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') {
        return () => {};
      }
      const mediaQuery = window.matchMedia('(min-width: 1024px)');
      mediaQuery.addEventListener('change', onStoreChange);
      return () => mediaQuery.removeEventListener('change', onStoreChange);
    },
    () => (typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false),
    () => false,
  );
}

const MENU_PANEL_CLASS = 'absolute bottom-full mb-2 z-[100] overflow-visible rounded-2xl border border-gray-200/90 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.14)] animate-in fade-in zoom-in-95 duration-100 origin-bottom-left';
const MENU_ITEM_CLASS = 'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[#37352f]/78 transition-colors hover:bg-[#efedea] hover:text-[#37352f]';
const MENU_ICON_CLASS = 'h-[18px] w-[18px] shrink-0 text-[#37352f]/42';
const HELP_SUBMENU_CLASS = 'absolute bottom-0 left-full z-[110] w-[168px] overflow-hidden rounded-2xl border border-gray-200/90 bg-white p-2 shadow-[0_20px_50px_rgba(15,23,42,0.14)] animate-in fade-in zoom-in-95 duration-100 origin-left';
const PROJECT_REPO_URL = 'https://github.com/hhszzzz/taibu';
const PROJECT_ISSUES_URL = 'https://docs.qq.com/smartsheet/DS3JSQ0dHTUdrVWFh';

type UserMenuShortcut = {
  tab: Extract<SettingsCenterTab, 'general' | 'personalization' | 'charts' | 'help'>;
  label: string;
};

function UserMenuShortcutLink({
  tab,
  label,
  onClick,
}: UserMenuShortcut & { onClick: () => void }) {
  return (
    <SettingsCenterLink tab={tab} onClick={onClick} className={MENU_ITEM_CLASS}>
      {createElement(SETTINGS_CENTER_TAB_ICONS[tab], { size: 18, className: MENU_ICON_CLASS })}
      <span>{label}</span>
    </SettingsCenterLink>
  );
}

export function SidebarUserCard({ user, collapsed = false }: SidebarUserCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDesktopSidebar = useIsDesktopSidebar();
  const { isFeatureEnabled } = useFeatureToggles();
  const { profile, loading: profileLoading, resolved: profileResolved, error: profileError } = useCurrentUserProfile({ enabled: isDesktopSidebar });
  const personalizationEnabled = isFeatureEnabled('chat') && isFeatureEnabled('ai-personalization');
  const chartsEnabled = isFeatureEnabled('charts');
  const helpEnabled = isFeatureEnabled('help');

  const membership = profileResolved && !profileError ? buildMembershipInfo(profile ?? null) : null;
  const avatarUrl = profile?.avatar_url ?? null;
  const displayName = profile?.nickname || user.email?.split('@')[0] || '用户';
  const displayEmail = getUserEmailDisplay(user);
  const membershipLabel = profileLoading || !profileResolved
    ? '...'
    : profileError
      ? '加载失败'
      : membershipLabels[membership?.type || 'free'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setIsHelpMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      setIsHelpMenuOpen(false);
      await signOut();
      setIsMenuOpen(false);
      window.location.reload();
    } catch (error) {
      console.error('Sign out error:', error);
      setSigningOut(false);
    }
  };

  const shortcuts: UserMenuShortcut[] = [
    { tab: 'general', label: '设置' },
    ...(personalizationEnabled ? [{ tab: 'personalization', label: '个性化' } as const] : []),
    ...(chartsEnabled ? [{ tab: 'charts', label: '命盘' } as const] : []),
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => {
          setIsMenuOpen((prev) => {
            const next = !prev;
            if (!next) {
              setIsHelpMenuOpen(false);
            }
            return next;
          });
        }}
        className={`flex w-full items-center rounded-2xl transition-colors duration-150 ${
          collapsed ? 'justify-center p-2' : 'px-2.5 py-2'
        } ${
          isMenuOpen ? 'bg-[#e3e1db]' : 'hover:bg-[#efedea]'
        }`}
      >
        <div className="flex w-full items-center gap-2.5">
          <Avatar src={avatarUrl} alt={displayName} size={collapsed ? 28 : 32} />
          {!collapsed ? (
            <div className="flex min-w-0 flex-1 items-center justify-between text-left">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[#37352f]">{displayName}</div>
                <div className="truncate text-[11px] font-medium text-[#37352f]/40">{membershipLabel}</div>
              </div>
            </div>
          ) : null}
        </div>
      </button>

      {isMenuOpen ? (
        <div className={`${MENU_PANEL_CLASS} ${collapsed ? 'left-2 w-[248px]' : 'left-0 right-0'}`}>
          <div className="flex flex-col p-2">
            <div className="flex items-center gap-3 rounded-[1.125rem] px-3 py-2">
              <Avatar src={avatarUrl} alt={displayName} size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-[#37352f]">{displayName}</div>
                <div className="truncate text-[11px] font-medium text-[#37352f]/40">{displayEmail}</div>
              </div>
            </div>

            <div className="mx-1 my-1 h-px bg-gray-100" />

            <div className="flex flex-col gap-1">
              {shortcuts.map((item) => (
                <UserMenuShortcutLink key={item.tab} {...item} onClick={() => setIsMenuOpen(false)} />
              ))}
            </div>

            {helpEnabled ? <div className="mx-1 my-1 h-px bg-gray-100" /> : null}

            {helpEnabled ? (
              <div
                className="relative"
                onMouseLeave={() => setIsHelpMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setIsHelpMenuOpen((prev) => !prev)}
                  onMouseEnter={() => setIsHelpMenuOpen(true)}
                  onFocus={() => setIsHelpMenuOpen(true)}
                  className={`${MENU_ITEM_CLASS} w-full justify-between`}
                >
                  <span className="flex items-center gap-3">
                    {createElement(SETTINGS_CENTER_TAB_ICONS.help, { size: 18, className: MENU_ICON_CLASS })}
                    <span>帮助</span>
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-[#37352f]/35 transition-transform ${isHelpMenuOpen ? 'translate-x-0.5 text-[#37352f]/60' : ''}`}
                  />
                </button>

                {isHelpMenuOpen ? (
                  <div className={HELP_SUBMENU_CLASS}>
                    <div className="flex flex-col gap-1">
                      <SettingsCenterLink tab="help" onClick={() => setIsMenuOpen(false)} className={MENU_ITEM_CLASS}>
                        {createElement(SETTINGS_CENTER_TAB_ICONS.help, { size: 18, className: MENU_ICON_CLASS })}
                        <span>帮助中心</span>
                      </SettingsCenterLink>
                      <a
                        href={PROJECT_REPO_URL}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setIsMenuOpen(false)}
                        className={MENU_ITEM_CLASS}
                      >
                        <Github className={MENU_ICON_CLASS} />
                        <span>GitHub</span>
                      </a>
                      <a
                        href={PROJECT_ISSUES_URL}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setIsMenuOpen(false)}
                        className={MENU_ITEM_CLASS}
                      >
                        <Bug className={MENU_ICON_CLASS} />
                        <span>报告错误/需求</span>
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mx-1 my-1 h-px bg-gray-100" />

            <div className="flex flex-col">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[#37352f]/78 transition-colors hover:bg-[#efedea] hover:text-[#eb5757] disabled:opacity-50"
              >
                {signingOut ? (
                  <SoundWaveLoader variant="inline" />
                ) : (
                  <LogOut className="h-[18px] w-[18px] shrink-0 text-[#37352f]/42 transition-colors group-hover:text-[#eb5757]" />
                )}
                <span>{signingOut ? '退出中...' : '退出登录'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
