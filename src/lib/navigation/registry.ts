/**
 * Navigation Registry — single source of truth for all navigation items.
 *
 * Every consumer (Sidebar, MobileNav, FeatureTogglePanel) imports helpers from this module instead of maintaining
 * its own duplicated item arrays.
 */
import {
  Dices,
  HeartHandshake,
  BotMessageSquare,
  Brain,
  Sun,
  User,
  ScanFace,
  Hand,
  CalendarRange,
  Aperture,
  Tags,
  Settings,
  CircleStar,
  Bell,
  MessageCircleHeart,
  BookOpenText,
  Scroll,
  CircleQuestionMark,
  Telescope,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import { YinYangIcon, CheckerboardIcon, CompassRoseIcon, StarOfDavidIcon, FlowerLotusIcon } from '@phosphor-icons/react';
import { createElement, type ComponentType } from 'react';
import { getSettingsCenterRouteTarget } from '@/lib/settings-center';

/** Icon type that accepts both Lucide and Phosphor icon components. */
export type NavIcon = ComponentType<{ className?: string; size?: number | string }>;

/**
 * Wrap a Phosphor icon so it visually matches Lucide's stroke weight.
 * Phosphor regular paths are thinner than Lucide's default strokeWidth=2,
 * so we scale up ~115% while keeping the bounding box unchanged.
 */
function phosphor(Icon: ComponentType<Record<string, unknown>>): NavIcon {
  const Wrapped: NavIcon = (props) =>
    createElement(Icon, {
      ...props,
      style: { transform: 'scale(1.1)' },
    });
  Wrapped.displayName = `Phosphor(${Icon.displayName ?? Icon.name})`;
  return Wrapped;
}

const PYinYang = phosphor(YinYangIcon);
const PCheckerboard = phosphor(CheckerboardIcon);
const PCompassRose = phosphor(CompassRoseIcon);
const PStarOfDavid = phosphor(StarOfDavidIcon);

export type { LucideIcon };

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type NavCategory = 'divination' | 'tool' | 'user';

export interface NavItemDef {
  /** Unique identifier — matches route segment or user-settings key */
  id: string;
  /** Route path */
  href: string;
  /** Display label (Chinese) */
  label: string;
  /** Icon component (Lucide or Phosphor) */
  icon: NavIcon;
  /** Optional emoji for sidebar tooltip / share cards */
  emoji?: string;
  /** Short description */
  description?: string;
  /**
   * Feature-toggle ID used by `useFeatureToggles().isFeatureEnabled()`.
   * When omitted the `id` itself is used as the feature ID.
   */
  featureId?: string;
  /** Logical grouping */
  category: NavCategory;
}

// ---------------------------------------------------------------------------
// Registry data
// ---------------------------------------------------------------------------

export const NAV_REGISTRY: readonly NavItemDef[] = [
  // ── Divination ──────────────────────────────────────────────────────────
  { id: 'bazi', href: '/bazi', label: '八字', icon: PYinYang, emoji: '🔮', description: '四柱八字精批', category: 'divination' },
  { id: 'hepan', href: '/hepan', label: '八字合盘', icon: HeartHandshake, emoji: '💑', description: '八字合盘', category: 'divination' },
  { id: 'ziwei', href: '/ziwei', label: '紫微斗数', icon: PCompassRose, emoji: '⭐', description: '紫微命盘', category: 'divination' },
  { id: 'tarot', href: '/tarot', label: '塔罗', icon: PStarOfDavid, emoji: '🃏', description: '塔罗占卜', category: 'divination' },
  { id: 'liuyao', href: '/liuyao', label: '六爻', icon: Dices, emoji: '☯️', description: '六爻占卜', category: 'divination' },
  { id: 'qimen', href: '/qimen', label: '奇门遁甲', icon: PCheckerboard, emoji: '🧭', description: '奇门遁甲', category: 'divination' },
  { id: 'daliuren', href: '/daliuren', label: '大六壬', icon: Telescope, emoji: '📜', description: '大六壬', category: 'divination' },
  { id: 'meihua', href: '/meihua', label: '梅花易数', icon: FlowerLotusIcon, description: '梅花易数', category: 'divination' },
  { id: 'xiaoliuren', href: '/xiaoliuren', label: '小六壬', icon: Waypoints, description: '小六壬', category: 'divination' },
  { id: 'face', href: '/face', label: '面相', icon: ScanFace, emoji: '👤', description: '面相分析', category: 'divination' },
  { id: 'palm', href: '/palm', label: '手相', icon: Hand, emoji: '🖐️', description: '手相分析', category: 'divination' },
  { id: 'mbti', href: '/mbti', label: 'MBTI', icon: Brain, emoji: '🧩', description: '性格测试', category: 'divination' },

  { id: 'daily', href: '/daily', label: '日运', icon: Sun, category: 'divination' },
  { id: 'monthly', href: '/monthly', label: '月运', icon: CalendarRange, category: 'divination' },

  // ── Tools ───────────────────────────────────────────────────────────────
  { id: 'chat', href: '/chat', label: '新聊天', icon: BotMessageSquare, category: 'tool' },
  { id: 'records', href: '/records', label: '命理记录', icon: Tags, category: 'tool' },
  { id: 'community', href: '/community', label: '社区', icon: Aperture, category: 'tool' },

  // ── User ────────────────────────────────────────────────────────────────
  { id: 'settings-profile', href: getSettingsCenterRouteTarget('profile'), label: '我的', icon: User, category: 'user' },
  { id: 'settings-general', href: getSettingsCenterRouteTarget('general'), label: '设置', icon: Settings, category: 'user' },
  { id: 'settings-upgrade', href: getSettingsCenterRouteTarget('upgrade'), label: '订阅', icon: CircleStar, featureId: 'upgrade', category: 'user' },
  { id: 'settings-charts', href: getSettingsCenterRouteTarget('charts'), label: '命盘', icon: Scroll, featureId: 'charts', category: 'user' },
  { id: 'notifications', href: '/user/notifications', label: '通知', icon: Bell, featureId: 'notifications', category: 'user' },
  { id: 'settings-personalization', href: getSettingsCenterRouteTarget('personalization'), label: '个性化', icon: MessageCircleHeart, featureId: 'ai-personalization', category: 'user' },
  { id: 'settings-knowledge-base', href: getSettingsCenterRouteTarget('knowledge-base'), label: '知识库', icon: BookOpenText, featureId: 'knowledge-base', category: 'user' },
  { id: 'settings-help', href: getSettingsCenterRouteTarget('help'), label: '帮助中心', icon: CircleQuestionMark, featureId: 'help', category: 'user' },
] as const;

// ---------------------------------------------------------------------------
// Lookup helpers (built once, reused by every consumer)
// ---------------------------------------------------------------------------

const _byId = new Map<string, NavItemDef>(NAV_REGISTRY.map(n => [n.id, n]));

/** Resolve the feature-toggle ID for a given nav item ID. */
export function toFeatureId(navId: string): string {
  return _byId.get(navId)?.featureId ?? navId;
}

// ---------------------------------------------------------------------------
// Consumer-specific projections
// ---------------------------------------------------------------------------

/** Sidebar "命理体系" items (divination category). */
export function getSidebarNavItems() {
  return NAV_REGISTRY.filter(n => n.category === 'divination');
}

/** Sidebar "工具" items (tool category). */
export function getSidebarToolItems() {
  return NAV_REGISTRY.filter((n) => n.category === 'tool');
}

/** MobileNav — all items keyed by id. */
export function getMobileItemsRecord(): Record<string, { href: string; label: string; icon: NavIcon }> {
  const record: Record<string, { href: string; label: string; icon: NavIcon }> = {};
  for (const n of NAV_REGISTRY) {
    record[n.id] = { href: n.href, label: n.label, icon: n.icon };
  }
  return record;
}

/** FeatureTogglePanel — modules list with admin-specific labels. */
export function getFeatureModules(): { id: string; label: string }[] {
  // Admin panel shows all toggleable features, including some that don't
  // appear in navigation (mcp-service). We derive what we can from the
  // registry and append admin-only entries.
  const fromRegistry: { id: string; label: string }[] = NAV_REGISTRY
    .filter(n => n.category !== 'user' || n.featureId)
    .map(n => ({
      id: n.featureId ?? n.id,
      label: adminLabelOverride[n.featureId ?? n.id] ?? n.label,
    }));

  // Deduplicate by id (some featureIds map to the same toggle)
  const seen = new Set<string>();
  const result: { id: string; label: string }[] = [];
  for (const item of fromRegistry) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }

  // Admin-only entries not in the nav registry
  for (const extra of ADMIN_ONLY_FEATURES) {
    if (!seen.has(extra.id)) {
      seen.add(extra.id);
      result.push(extra);
    }
  }

  return result;
}

/** Label overrides for the admin feature-toggle panel. */
const adminLabelOverride: Record<string, string> = {
  chat: 'AI 功能',
  community: '社区',
  records: '命理记录',
  daily: '日运',
  monthly: '月运',
  'knowledge-base': '知识库',
  'ai-personalization': '个性化',
  notifications: '消息通知',
  upgrade: '订阅',
  help: '帮助',
  charts: '我的命盘',
};

/** Features that only appear in the admin toggle panel. */
const ADMIN_ONLY_FEATURES: { id: string; label: string }[] = [
  { id: 'checkin', label: '签到' },
  { id: 'mcp-service', label: 'MCP 服务' },
];

/** Lookup a single registry entry by id. */
export function getNavItemById(id: string): NavItemDef | undefined {
  return _byId.get(id);
}
