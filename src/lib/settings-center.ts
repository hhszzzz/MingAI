export const SETTINGS_CENTER_NAMESPACE = 'settings';

export const SETTINGS_CENTER_TABS = [
  'general',
  'profile',
  'upgrade',
  'personalization',
  'byok',
  'charts',
  'knowledge-base',
  'mcp-service',
  'admin-announcements',
  'admin-features',
  'admin-ai-services',
  'help',
] as const;

export type SettingsCenterTab = (typeof SETTINGS_CENTER_TABS)[number];
export type SettingsCenterTabGroup = 'account' | 'extensions' | 'management';

export type SettingsCenterFlags = {
  upgradeEnabled: boolean;
  chartsEnabled: boolean;
  knowledgeBaseEnabled: boolean;
  mcpServiceEnabled: boolean;
  personalizationEnabled: boolean;
  helpEnabled: boolean;
  isAdmin: boolean;
};

export type SettingsCenterTabState = {
  id: SettingsCenterTab;
  label: string;
  group: SettingsCenterTabGroup;
  disabled: boolean;
};

export type SettingsCenterDisabledState = {
  title: string;
  description: string;
};

export const SETTINGS_CENTER_GROUP_LABELS: Record<SettingsCenterTabGroup, string> = {
  account: '账户',
  extensions: '扩展',
  management: '管理',
};

const SETTINGS_CENTER_TAB_META: Record<SettingsCenterTab, Omit<SettingsCenterTabState, 'disabled'>> = {
  profile: { id: 'profile', label: '账户', group: 'account' },
  general: { id: 'general', label: '常规', group: 'account' },
  upgrade: { id: 'upgrade', label: '订阅', group: 'account' },
  help: { id: 'help', label: '帮助', group: 'account' },
  personalization: { id: 'personalization', label: '个性化', group: 'extensions' },
  byok: { id: 'byok', label: '自定义模型', group: 'extensions' },
  charts: { id: 'charts', label: '命盘', group: 'extensions' },
  'knowledge-base': { id: 'knowledge-base', label: '知识库', group: 'extensions' },
  'mcp-service': { id: 'mcp-service', label: 'MCP', group: 'extensions' },
  'admin-announcements': { id: 'admin-announcements', label: '公告', group: 'management' },
  'admin-features': { id: 'admin-features', label: '功能与激活码', group: 'management' },
  'admin-ai-services': { id: 'admin-ai-services', label: 'AI 服务', group: 'management' },
};

function isSettingsCenterTabDisabled(tab: SettingsCenterTab, flags: SettingsCenterFlags) {
  switch (tab) {
    case 'upgrade':
      return !flags.upgradeEnabled;
    case 'personalization':
      return !flags.personalizationEnabled;
    case 'byok':
      return !flags.personalizationEnabled;
    case 'charts':
      return !flags.chartsEnabled;
    case 'knowledge-base':
      return !flags.knowledgeBaseEnabled;
    case 'mcp-service':
      return !flags.mcpServiceEnabled;
    case 'help':
      return !flags.helpEnabled;
    default:
      return false;
  }
}

export function getSettingsCenterTabs(flags: SettingsCenterFlags): SettingsCenterTabState[] {
  return SETTINGS_CENTER_TABS
    .filter((tab) => flags.isAdmin || SETTINGS_CENTER_TAB_META[tab].group !== 'management')
    .map((tab) => ({
      ...SETTINGS_CENTER_TAB_META[tab],
      disabled: isSettingsCenterTabDisabled(tab, flags),
    }));
}

export function getSettingsCenterDisabledState(
  tab: SettingsCenterTab,
  flags: SettingsCenterFlags,
): SettingsCenterDisabledState | null {
  if (!isSettingsCenterTabDisabled(tab, flags)) {
    return null;
  }

  switch (tab) {
    case 'upgrade':
      return {
        title: '暂未开放',
        description: '当前订阅不可用。',
      };
    case 'knowledge-base':
      return {
        title: '暂未开放',
        description: '当前知识库不可用。',
      };
    case 'mcp-service':
      return {
        title: '暂未开放',
        description: '当前 MCP 服务入口不可用。',
      };
    case 'charts':
      return {
        title: '暂未开放',
        description: '当前命盘不可用。',
      };
    case 'personalization':
      return {
        title: '暂未开放',
        description: '当前个性化不可用。',
      };
    case 'byok':
      return {
        title: '暂未开放',
        description: '当前 BYOK 不可用。',
      };
    case 'help':
      return {
        title: '暂未开放',
        description: '当前帮助不可用。',
      };
    default:
      return null;
  }
}

export const SETTINGS_CENTER_EVENT = 'taibu:settings-center:change';
const SETTINGS_CENTER_STATE_KEY = '__taibuSettingsCenter';
export type SettingsCenterCloseMode = 'back' | 'replace';

export function isSettingsCenterTab(value: unknown): value is SettingsCenterTab {
  return typeof value === 'string' && SETTINGS_CENTER_TABS.includes(value as SettingsCenterTab);
}

export function isAdminSettingsCenterTab(tab: SettingsCenterTab | null | undefined): boolean {
  return tab?.startsWith('admin-') === true;
}

function normalizeSettingsCenterSubpath(subpath?: string | null): string | null {
  if (!subpath) return null;
  const normalized = subpath.split('/').filter(Boolean).join('/');
  return normalized || null;
}

function parseSettingsCenterHashParts(hash: string | null | undefined): {
  namespace: string | null;
  tab: string | null;
  subpath: string | null;
} {
  if (!hash) {
    return { namespace: null, tab: null, subpath: null };
  }

  const normalized = hash.replace(/^#/, '').trim();
  if (!normalized) {
    return { namespace: null, tab: null, subpath: null };
  }

  const [namespace, tab, ...rest] = normalized.split('/');
  return {
    namespace: namespace || null,
    tab: tab || null,
    subpath: rest.length > 0 ? rest.join('/') : null,
  };
}

export function buildSettingsCenterHash(tab: SettingsCenterTab, options?: { subpath?: string | null }): string {
  const normalizedSubpath = normalizeSettingsCenterSubpath(options?.subpath);
  return `#${SETTINGS_CENTER_NAMESPACE}/${tab}${normalizedSubpath ? `/${normalizedSubpath}` : ''}`;
}

export function parseSettingsCenterHash(hash: string | null | undefined): SettingsCenterTab | null {
  const { namespace, tab } = parseSettingsCenterHashParts(hash);
  if (namespace !== SETTINGS_CENTER_NAMESPACE) {
    return null;
  }

  return isSettingsCenterTab(tab) ? tab : null;
}

export function parseSettingsCenterHashSubpath(hash: string | null | undefined): string | null {
  const { namespace, tab, subpath } = parseSettingsCenterHashParts(hash);
  if (namespace !== SETTINGS_CENTER_NAMESPACE) {
    return null;
  }
  if (!isSettingsCenterTab(tab)) {
    return null;
  }
  return subpath;
}

export function readSettingsCenterHashFromWindow(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.hash;
}

export function readSettingsCenterTabFromWindow(): SettingsCenterTab | null {
  return parseSettingsCenterHash(readSettingsCenterHashFromWindow());
}

export function readSettingsCenterSubpathFromWindow(): string | null {
  return parseSettingsCenterHashSubpath(readSettingsCenterHashFromWindow());
}

export function subscribeSettingsCenterLocation(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener('hashchange', listener);
  window.addEventListener('popstate', listener);
  window.addEventListener(SETTINGS_CENTER_EVENT, listener as EventListener);
  return () => {
    window.removeEventListener('hashchange', listener);
    window.removeEventListener('popstate', listener);
    window.removeEventListener(SETTINGS_CENTER_EVENT, listener as EventListener);
  };
}

function emitSettingsCenterChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SETTINGS_CENTER_EVENT));
}

export function getSettingsCenterCloseMode(
  state: unknown = typeof window !== 'undefined' ? window.history.state : null,
): SettingsCenterCloseMode {
  const currentState = state as Record<string, unknown> | null;
  return currentState?.[SETTINGS_CENTER_STATE_KEY] === true ? 'back' : 'replace';
}

function buildCurrentUrlWithoutHash() {
  const url = new URL(window.location.href);
  return `${url.pathname}${url.search}`;
}

function normalizeSettingsCenterBasePath(pathname?: string | null): string {
  const normalized = pathname?.trim();
  if (!normalized) {
    return '/bazi';
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export function getSettingsCenterRouteTargetForPath(
  pathname: string | null | undefined,
  tab: SettingsCenterTab,
  options?: {
    subpath?: string | null;
    search?: string | null;
  },
): string {
  const search = options?.search?.trim() || '';
  return `${normalizeSettingsCenterBasePath(pathname)}${search}${buildSettingsCenterHash(tab, options)}`;
}

export function getCurrentSettingsCenterRouteTarget(
  tab: SettingsCenterTab,
  options?: {
    subpath?: string | null;
    search?: string | null;
  },
): string {
  if (typeof window === 'undefined') {
    return getSettingsCenterRouteTarget(tab, options);
  }

  return getSettingsCenterRouteTargetForPath(window.location.pathname, tab, {
    subpath: options?.subpath,
    search: options?.search ?? window.location.search,
  });
}

export function openSettingsCenter(
  tab: SettingsCenterTab,
  options?: {
    replace?: boolean;
    subpath?: string | null;
  },
) {
  if (typeof window === 'undefined') return;

  const nextState = {
    ...(window.history.state ?? {}),
    [SETTINGS_CENTER_STATE_KEY]: true,
  };
  const method = options?.replace ? 'replaceState' : 'pushState';
  window.history[method](nextState, '', getCurrentSettingsCenterRouteTarget(tab, {
    subpath: options?.subpath,
  }));
  emitSettingsCenterChange();
}

export function closeSettingsCenter() {
  if (typeof window === 'undefined') return;

  const currentState = window.history.state as Record<string, unknown> | null;
  if (getSettingsCenterCloseMode(currentState) === 'back') {
    window.history.back();
    return;
  }

  const nextState = currentState ? { ...currentState } : null;
  if (nextState && SETTINGS_CENTER_STATE_KEY in nextState) {
    delete nextState[SETTINGS_CENTER_STATE_KEY];
  }
  if (nextState && 'tab' in nextState) {
    delete nextState.tab;
  }
  if (nextState && 'subpath' in nextState) {
    delete nextState.subpath;
  }
  window.history.replaceState(nextState, '', buildCurrentUrlWithoutHash());
  emitSettingsCenterChange();
}

export function getSettingsCenterRouteTarget(
  tab: SettingsCenterTab,
  options?: {
    subpath?: string | null;
    search?: string | null;
  },
): string {
  return getSettingsCenterRouteTargetForPath('/bazi', tab, options);
}

export function getSettingsCenterTabFromRouteTarget(href: string): SettingsCenterTab | null {
  const hashIndex = href.indexOf('#');
  if (hashIndex < 0) {
    return null;
  }

  return parseSettingsCenterHash(href.slice(hashIndex));
}
