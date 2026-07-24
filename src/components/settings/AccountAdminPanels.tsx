'use client';

import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { useSettingsCenterSubpath } from '@/lib/hooks/useSettingsCenterRouteState';
import { openSettingsCenter } from '@/lib/settings-center';
import {
  Bot,
  GitBranch,
  Key,
  Settings2,
} from 'lucide-react';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';

const LazyAnnouncementManagementPanel = lazy(async () => ({
  default: (await import('@/components/admin/AnnouncementManagementPanel')).AnnouncementManagementPanel,
}));
const LazyFeatureTogglePanel = lazy(async () => ({
  default: (await import('@/components/admin/FeatureTogglePanel')).FeatureTogglePanel,
}));
const LazyKeyManagementPanel = lazy(async () => ({
  default: (await import('@/components/admin/KeyManagementPanel')).KeyManagementPanel,
}));
const LazyAIModelPanel = lazy(async () => ({
  default: (await import('@/components/admin/AIModelPanel')).AIModelPanel,
}));
const LazyAIGatewayPanel = lazy(async () => ({
  default: (await import('@/components/admin/AIGatewayPanel')).AIGatewayPanel,
}));

function PanelFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-border bg-background">
      <SoundWaveLoader variant="inline" />
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {description ? <p className="text-sm text-foreground-secondary">{description}</p> : null}
      </header>
      {children}
    </div>
  );
}

function SubtabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-150 ${
        active
          ? 'border-border bg-[#e3e1db] text-[#37352f] dark:bg-background-tertiary dark:text-foreground'
          : 'border-border bg-background text-foreground-secondary hover:bg-[#efedea] dark:hover:bg-background-secondary'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function AdminAnnouncementsContent() {
  return (
    <Suspense fallback={<PanelFallback />}>
      <div className="min-h-0 bg-background">
        <LazyAnnouncementManagementPanel />
      </div>
    </Suspense>
  );
}

type AdminFeatureTab = 'toggles' | 'keys';
type AdminAITab = 'models' | 'gateways';

function resolveAdminFeatureTab(value: string | null | undefined): AdminFeatureTab {
  switch (value) {
    case 'keys':
      return value;
    default:
      return 'toggles';
  }
}

function resolveAdminAITab(value: string | null | undefined): AdminAITab {
  switch (value) {
    case 'gateways':
      return 'gateways';
    default:
      return 'models';
  }
}

function useResolvedSettingsCenterSubtab<T extends string>(
  resolveTab: (value: string | null | undefined) => T,
) {
  const subpath = useSettingsCenterSubpath();
  return resolveTab(subpath);
}

export function AdminFeaturesContent() {
  const activeTab = useResolvedSettingsCenterSubtab(resolveAdminFeatureTab);

  const switchTab = (nextTab: AdminFeatureTab) => {
    openSettingsCenter('admin-features', {
      replace: true,
      subpath: nextTab === 'toggles' ? null : nextTab,
    });
  };

  return (
    <Section title="功能与激活码" description="统一管理功能开关与激活码发放。">
      <div className="flex flex-wrap gap-2">
        <SubtabButton active={activeTab === 'toggles'} onClick={() => switchTab('toggles')} icon={<Settings2 className="h-4 w-4" />} label="功能开关" />
        <SubtabButton active={activeTab === 'keys'} onClick={() => switchTab('keys')} icon={<Key className="h-4 w-4" />} label="激活码" />
      </div>

      <Suspense fallback={<PanelFallback />}>
        <div className="rounded-lg border border-border bg-background p-4">
          {activeTab === 'toggles' && <LazyFeatureTogglePanel />}
          {activeTab === 'keys' && <LazyKeyManagementPanel />}
        </div>
      </Suspense>
    </Section>
  );
}

export function AdminAIServicesContent() {
  const activeTab = useResolvedSettingsCenterSubtab(resolveAdminAITab);

  const switchTab = (nextTab: AdminAITab) => {
    openSettingsCenter('admin-ai-services', {
      replace: true,
      subpath: nextTab === 'models' ? null : nextTab,
    });
  };

  return (
    <Section title="AI 服务" description="管理模型配置、来源绑定和网关可用性。">
      <div className="flex flex-wrap gap-2">
        <SubtabButton active={activeTab === 'models'} onClick={() => switchTab('models')} icon={<Bot className="h-4 w-4" />} label="模型管理" />
        <SubtabButton active={activeTab === 'gateways'} onClick={() => switchTab('gateways')} icon={<GitBranch className="h-4 w-4" />} label="网关管理" />
      </div>

      <Suspense fallback={<PanelFallback />}>
        <div className="rounded-lg border border-border bg-background p-4">
          {activeTab === 'models' && <LazyAIModelPanel />}
          {activeTab === 'gateways' && <LazyAIGatewayPanel />}
        </div>
      </Suspense>
    </Section>
  );
}
