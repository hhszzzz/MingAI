/**
 * 对话分组共享常量
 *
 * 从 ConversationSidebar 提取的 SOURCE_TYPE_CONFIG / SOURCE_TYPE_ORDER，
 * 供侧边栏、移动端抽屉等多处复用。
 */
import {
  MessageSquare, Orbit, Gem, Dices, Brain, Sparkles,
  HeartHandshake, Hand, User, Compass, ScrollText, Flower2, Waypoints,
} from 'lucide-react';
import type { ConversationSourceType } from '@/types';

export const SOURCE_TYPE_CONFIG: Record<ConversationSourceType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  chat: { label: '普通对话', icon: MessageSquare, color: 'text-foreground-secondary' },
  bazi_wuxing: { label: '八字五行/人格分析', icon: Orbit, color: 'text-foreground-secondary' },
  bazi_personality: { label: '八字五行/人格分析', icon: Orbit, color: 'text-foreground-secondary' },
  ziwei: { label: '紫微斗数', icon: Sparkles, color: 'text-foreground-secondary' },
  tarot: { label: '塔罗占卜', icon: Gem, color: 'text-foreground-secondary' },
  liuyao: { label: '六爻占卜', icon: Dices, color: 'text-foreground-secondary' },
  mbti: { label: 'MBTI 分析', icon: Brain, color: 'text-foreground-secondary' },
  hepan: { label: '合盘分析', icon: HeartHandshake, color: 'text-foreground-secondary' },
  palm: { label: '手相分析', icon: Hand, color: 'text-foreground-secondary' },
  face: { label: '面相分析', icon: User, color: 'text-foreground-secondary' },
  qimen: { label: '奇门遁甲', icon: Compass, color: 'text-foreground-secondary' },
  daliuren: { label: '大六壬', icon: ScrollText, color: 'text-foreground-secondary' },
  meihua: { label: '梅花易数', icon: Flower2, color: 'text-foreground-secondary' },
  xiaoliuren: { label: '小六壬', icon: Waypoints, color: 'text-foreground-secondary' },
  dream: { label: '周公解梦', icon: MessageSquare, color: 'text-foreground-secondary' },
};

/** 显示顺序 — bazi_personality 合并到 bazi_wuxing */
export const SOURCE_TYPE_ORDER: ConversationSourceType[] = [
  'chat', 'dream', 'bazi_wuxing', 'ziwei', 'tarot', 'liuyao', 'qimen', 'daliuren', 'meihua', 'xiaoliuren', 'mbti', 'hepan', 'palm', 'face',
];
