import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getCurrentSettingsCenterRouteTarget,
  getSettingsCenterDisabledState,
  getSettingsCenterRouteTarget,
  getSettingsCenterRouteTargetForPath,
  getSettingsCenterTabs,
  parseSettingsCenterHash,
} from '../lib/settings-center';
import { DEFAULT_MOBILE_DRAWER_ORDER, DEFAULT_TOOL_ORDER } from '../lib/user/settings';

test('settings center keeps only the merged membership tab and rejects removed legacy credits hash', () => {
  const tabs = getSettingsCenterTabs({
    upgradeEnabled: true,
    chartsEnabled: true,
    knowledgeBaseEnabled: true,
    mcpServiceEnabled: true,
    personalizationEnabled: true,
    helpEnabled: true,
    isAdmin: false,
  });
  const registrySource = readFileSync(resolve(process.cwd(), 'src/lib/navigation/registry.ts'), 'utf8');

  assert.equal(tabs.some((tab) => tab.id === 'upgrade' && tab.disabled === false), true);
  assert.equal(registrySource.includes("id: 'settings-upgrade', href: getSettingsCenterRouteTarget('upgrade')"), true);
  assert.equal(parseSettingsCenterHash('#settings/credits'), null);
  assert.equal(
    getSettingsCenterRouteTarget('upgrade', { search: '?claim=ok' }),
    '/bazi?claim=ok#settings/upgrade',
  );
  assert.equal(
    getSettingsCenterRouteTargetForPath('/daliuren', 'upgrade', { search: '?foo=bar' }),
    '/daliuren?foo=bar#settings/upgrade',
  );
  assert.equal(
    getSettingsCenterRouteTargetForPath('/', 'general'),
    '/#settings/general',
  );
  assert.equal(tabs.findIndex((tab) => tab.id === 'byok'), tabs.findIndex((tab) => tab.id === 'personalization') + 1);
  assert.equal(tabs.at(-1)?.id, 'help');
  assert.equal(getSettingsCenterRouteTarget('byok'), '/bazi#settings/byok');
});

test('current-page settings targets preserve the active pathname in the browser', () => {
  const originalWindow = globalThis.window;

  const mockWindow = {
    location: {
      pathname: '/daliuren',
      search: '?step=2',
    },
  } as Window;

  // @ts-expect-error test-only window shim
  globalThis.window = mockWindow;

  assert.equal(
    getCurrentSettingsCenterRouteTarget('general'),
    '/daliuren?step=2#settings/general',
  );

  globalThis.window = originalWindow;
});

test('settings center exposes disabled state for the merged membership tab', () => {
  const flags = {
    upgradeEnabled: false,
    chartsEnabled: true,
    knowledgeBaseEnabled: true,
    mcpServiceEnabled: true,
    personalizationEnabled: true,
    helpEnabled: true,
    isAdmin: false,
  };

  assert.deepEqual(getSettingsCenterDisabledState('upgrade', flags), {
    title: '暂未开放',
    description: '当前订阅不可用。',
  });
});

test('settings center disables merged membership tab when upgrade is disabled', () => {
  const tabs = getSettingsCenterTabs({
    upgradeEnabled: false,
    chartsEnabled: true,
    knowledgeBaseEnabled: true,
    mcpServiceEnabled: true,
    personalizationEnabled: true,
    helpEnabled: true,
    isAdmin: false,
  });

  assert.equal(tabs.some((tab) => tab.id === 'upgrade' && tab.disabled === false), false);
  assert.deepEqual(getSettingsCenterDisabledState('upgrade', {
    upgradeEnabled: false,
    chartsEnabled: true,
    knowledgeBaseEnabled: true,
    mcpServiceEnabled: true,
    personalizationEnabled: true,
    helpEnabled: true,
    isAdmin: false,
  }), {
    title: '暂未开放',
    description: '当前订阅不可用。',
  });
});

test('checkin is removed from default user-facing tool orders', () => {
  const defaultToolOrder = DEFAULT_TOOL_ORDER as readonly string[];
  const defaultMobileDrawerOrder = DEFAULT_MOBILE_DRAWER_ORDER as readonly string[];

  assert.equal(defaultToolOrder.includes('checkin'), false);
  assert.equal(defaultMobileDrawerOrder.includes('checkin'), false);
  assert.equal(defaultMobileDrawerOrder.includes('user/credits'), false);
  assert.equal(defaultMobileDrawerOrder.includes('settings-upgrade'), true);
});

test('shared navigation and admin feature toggles no longer expose legacy credits entry', () => {
  const registrySource = readFileSync(resolve(process.cwd(), 'src/lib/navigation/registry.ts'), 'utf8');
  const headerSource = readFileSync(resolve(process.cwd(), 'src/components/layout/Header.tsx'), 'utf8');

  assert.equal(registrySource.includes("id: 'user/credits'"), false);
  assert.equal(headerSource.includes("'/user/credits'"), false);
  assert.equal(registrySource.includes("{ id: 'credits', label: '积分流水' }"), false);
  assert.equal(registrySource.includes("credits: '积分流水'"), false);
});

test('help navigation uses canonical settings-center route and removes old help shells', () => {
  const registrySource = readFileSync(resolve(process.cwd(), 'src/lib/navigation/registry.ts'), 'utf8');

  assert.equal(registrySource.includes("id: 'settings-help', href: getSettingsCenterRouteTarget('help')"), true);
  assert.equal(registrySource.includes("href: '/help'"), false);
  assert.equal(registrySource.includes("href: '/user/help'"), false);
});

test('personalization navigation uses canonical settings-center route and removes legacy alias page', () => {
  const registrySource = readFileSync(resolve(process.cwd(), 'src/lib/navigation/registry.ts'), 'utf8');
  const settingsLinkSource = readFileSync(resolve(process.cwd(), 'src/components/settings/SettingsCenterLink.tsx'), 'utf8');
  const settingsCenterSource = readFileSync(resolve(process.cwd(), 'src/lib/settings-center.ts'), 'utf8');

  assert.equal(registrySource.includes("id: 'settings-personalization', href: getSettingsCenterRouteTarget('personalization')"), true);
  assert.equal(registrySource.includes("href: '/user/ai-settings'"), false);
  assert.equal(registrySource.includes("id: 'user/settings/ai'"), false);
  assert.equal(settingsLinkSource.includes('getSettingsCenterRouteTarget(tab)'), true);
  assert.equal(settingsCenterSource.includes("window.history[method](nextState, '', getCurrentSettingsCenterRouteTarget(tab,"), true);
});

test('settings center host should load standalone panel modules instead of app route pages', () => {
  const hostSource = readFileSync(resolve(process.cwd(), 'src/components/settings/SettingsCenterHost.tsx'), 'utf8');
  const upgradePanelSource = readFileSync(resolve(process.cwd(), 'src/components/settings/panels/UpgradePanel.tsx'), 'utf8');
  const userMenuSource = readFileSync(resolve(process.cwd(), 'src/components/layout/UserMenu.tsx'), 'utf8');

  assert.equal(hostSource.includes("@/components/settings/panels/GeneralSettingsPanel"), true);
  assert.equal(hostSource.includes("@/components/settings/panels/AISettingsPanel"), true);
  assert.equal(hostSource.includes("@/components/settings/panels/BYOKPanel"), true);
  assert.equal(hostSource.includes("@/components/settings/panels/UpgradePanel"), true);
  assert.equal(hostSource.includes("@/components/settings/panels/ProfilePanel"), true);
  assert.equal(hostSource.includes("@/components/settings/panels/ChartsPanel"), true);
  assert.equal(hostSource.includes("@/components/settings/panels/KnowledgeBasePanel"), true);
  assert.equal(hostSource.includes("@/components/settings/panels/McpServicePanel"), true);
  assert.equal(hostSource.includes("@/components/settings/panels/HelpPanel"), true);
  assert.equal(hostSource.includes("import('@/app/user/settings/page')"), false);
  assert.equal(hostSource.includes("import('@/app/user/profile/page')"), false);
  assert.equal(hostSource.includes("import('@/app/help/page')"), false);
  assert.equal(hostSource.includes('SETTINGS_CENTER_GROUP_LABELS[entry.group]'), false);
  assert.equal(upgradePanelSource.includes("const hasLinuxDoLogin = typeof user?.user_metadata?.linuxdo_sub === 'string'"), true);
  assert.equal(upgradePanelSource.includes('{hasLinuxDoLogin ? ('), true);
  assert.equal(upgradePanelSource.includes("showToast('success', 'Linux.do 月度会员已领取')"), false);
  assert.equal(upgradePanelSource.includes("showToast('success', `恭喜领取 ${planName ?? '会员'} 会员`)"), true);
  assert.equal(upgradePanelSource.includes('const linuxDoClaimDisabled = hasLinuxDoLogin'), true);
  assert.equal(upgradePanelSource.includes("returnTo: getSettingsCenterRouteTargetForPath(pathname, 'upgrade'"), true);
  assert.equal(userMenuSource.includes("`${membershipLabels[membership?.type || 'free']} Plan`"), false);
  assert.equal(userMenuSource.includes("import { getUserEmailDisplay } from '@/lib/user-email';"), true);
  assert.equal(userMenuSource.includes('const displayEmail = getUserEmailDisplay(user);'), true);
  assert.equal(userMenuSource.includes('{user.email}'), false);
});

test('settings center host renders disabled tabs as locked non-clickable controls and falls back to general', () => {
  const hostSource = readFileSync(resolve(process.cwd(), 'src/components/settings/SettingsCenterHost.tsx'), 'utf8');

  assert.equal(hostSource.includes('loaded: featureTogglesLoaded'), true);
  assert.equal(hostSource.includes("openSettingsCenter('general', { replace: true })"), true);
  assert.equal(hostSource.includes('disabled={tab.disabled}'), true);
  assert.equal(hostSource.includes('aria-disabled={tab.disabled}'), true);
  assert.equal(hostSource.includes('cursor-not-allowed'), true);
  assert.equal(hostSource.includes('LockKeyhole'), true);
  assert.equal(hostSource.includes('border-amber-400/60'), false);
  assert.equal(hostSource.includes('bg-amber-500/5'), false);
  assert.equal(hostSource.includes('rounded-md border border-border px-1.5 py-0.5 text-[10px] text-foreground/50'), false);
});

test('settings center host keeps mounted panels alive when closed so tabs do not remount on reopen', () => {
  const hostSource = readFileSync(resolve(process.cwd(), 'src/components/settings/SettingsCenterHost.tsx'), 'utf8');

  assert.equal(hostSource.includes('hidden={!activeTab}'), true);
  assert.equal(hostSource.includes('setMountedTabs([])'), false);
  assert.equal(hostSource.includes('if (!mounted || !activeTab) {'), false);
});

test('general settings panel initializes once per user id instead of refetching on every parent rerender', () => {
  const panelSource = readFileSync(resolve(process.cwd(), 'src/components/settings/panels/GeneralSettingsPanel.tsx'), 'utf8');

  assert.equal(panelSource.includes('const userId = user?.id ?? null;'), true);
  assert.equal(panelSource.includes('const [initializedForUserId, setInitializedForUserId] = useState<string | null | undefined>(undefined);'), true);
  assert.equal(panelSource.includes('if (initializedForUserId === userId) return;'), true);
  assert.equal(panelSource.includes('}, [load]);'), false);
});

test('mcp settings tab follows the public service feature toggle', () => {
  const flags = {
    upgradeEnabled: true,
    chartsEnabled: true,
    knowledgeBaseEnabled: true,
    mcpServiceEnabled: false,
    personalizationEnabled: true,
    helpEnabled: true,
    isAdmin: false,
  };

  const tabs = getSettingsCenterTabs(flags);

  assert.equal(tabs.some((tab) => tab.id === 'mcp-service' && tab.disabled === true), true);
  assert.deepEqual(getSettingsCenterDisabledState('mcp-service', flags), {
    title: '暂未开放',
    description: '当前 MCP 服务入口不可用。',
  });
});

test('mcp service panel exposes public remote access without login or api keys', () => {
  const panelSource = readFileSync(resolve(process.cwd(), 'src/components/settings/panels/McpServicePanel.tsx'), 'utf8');
  const registrySource = readFileSync(resolve(process.cwd(), 'src/lib/navigation/registry.ts'), 'utf8');
  const featureToggleSource = readFileSync(resolve(process.cwd(), 'src/components/admin/FeatureTogglePanel.tsx'), 'utf8');

  assert.equal(panelSource.includes("useState<McpConnectionMode>('remote')"), true);
  assert.equal(panelSource.includes('MCP 接入方式'), true);
  assert.equal(panelSource.includes('可用工具'), true);
  assert.equal(panelSource.includes('公开 Streamable HTTP'), true);
  assert.equal(panelSource.includes('无需认证'), true);
  assert.equal(panelSource.includes('本地 Stdio'), true);
  assert.equal(panelSource.includes('useSessionSafe'), false);
  assert.equal(panelSource.includes('SettingsLoginRequired'), false);
  assert.equal(panelSource.includes('border-amber-500'), false);
  assert.equal(panelSource.includes('bg-amber-500/10'), false);
  assert.equal(panelSource.includes("bg-amber-500/15 px-2 py-0.5 text-[11px]"), false);
  assert.equal(panelSource.includes('API Key 认证'), false);
  assert.equal(panelSource.includes('/api/user/mcp-key'), false);
  assert.equal(panelSource.includes('OAuth'), false);
  assert.equal(registrySource.includes("{ id: 'mcp-service', label: 'MCP 服务' }"), true);
  assert.equal(featureToggleSource.includes('MCP OAuth'), false);
});

test('privacy and terms pages link back to canonical settings help route instead of /help shell', () => {
  const privacySource = readFileSync(resolve(process.cwd(), 'src/app/privacy/page.tsx'), 'utf8');
  const termsSource = readFileSync(resolve(process.cwd(), 'src/app/terms/page.tsx'), 'utf8');

  assert.equal(privacySource.includes('getSettingsCenterRouteTarget(\'help\')'), true);
  assert.equal(privacySource.includes('href="/help"'), false);
  assert.equal(termsSource.includes('getSettingsCenterRouteTarget(\'help\')'), true);
  assert.equal(termsSource.includes('href="/help"'), false);
});

test('header uses canonical settings labels and legal-page back fallback', () => {
  const headerSource = readFileSync(resolve(process.cwd(), 'src/components/layout/Header.tsx'), 'utf8');
  const announcementHostSource = readFileSync(resolve(process.cwd(), 'src/components/providers/AnnouncementPopupHost.tsx'), 'utf8');

  assert.equal(headerSource.includes("'/checkin': '订阅'"), false);
  assert.equal(headerSource.includes("'/user/ai-settings': '个性化'"), false);
  assert.equal(headerSource.includes("'/user/settings': '设置'"), false);
  assert.equal(headerSource.includes("'/user/charts': '命盘'"), false);
  assert.equal(headerSource.includes("'/user/mcp': 'MCP OAuth'"), false);
  assert.equal(headerSource.includes("'/help': '帮助'"), false);
  assert.equal(headerSource.includes("'/privacy': '隐私政策'"), true);
  assert.equal(headerSource.includes("'/terms': '服务条款'"), true);
  assert.equal(headerSource.includes("'/admin/features': '功能与激活码'"), false);
  assert.equal(headerSource.includes("'/admin/announcements': '公告'"), false);
  assert.equal(headerSource.includes("'/privacy': getSettingsCenterRouteTarget('help')"), true);
  assert.equal(headerSource.includes("'/terms': getSettingsCenterRouteTarget('help')"), true);
  assert.equal(headerSource.includes("'/user/settings': '偏好设置'"), false);
  assert.equal(headerSource.includes("'/user/ai-settings': 'AI 个性化'"), false);
  assert.equal(headerSource.includes("'/help': '帮助中心'"), false);
  assert.equal(headerSource.includes("useActiveSettingsCenterTab"), true);
  assert.equal(headerSource.includes("isAdminSettingsCenterTab(activeSettingsTab)"), true);
  assert.equal(announcementHostSource.includes("useActiveSettingsCenterTab"), true);
  assert.equal(announcementHostSource.includes("isAdminSettingsCenterTab(activeSettingsTab)"), true);
});

test('navigation registry no longer carries dead checkin-only tool filtering', () => {
  const registrySource = readFileSync(resolve(process.cwd(), 'src/lib/navigation/registry.ts'), 'utf8');

  assert.equal(registrySource.includes("n.id !== 'checkin'"), false);
});
