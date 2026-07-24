/**
 * MentionPopover 共享类型、常量与工具函数
 */
import type { ReactNode } from 'react';
import {
    ChevronRight, Folder, BookOpenText, BookOpen,
    Orbit, Sparkles, Gem, Dices, ScanFace, Hand, Brain, Flower2, Waypoints,
    HeartHandshake, Heart, Briefcase, Users,
    Calendar, CalendarDays, FileText, Compass,
} from 'lucide-react';
import type { MentionType } from '@/types';
import { getDataSourceNavIcon } from '@/lib/data-sources/icon-catalog';
import type { DataSourceSummary, DataSourceLoadError } from '@/lib/data-sources/types';
import type { KnowledgeBaseSummary } from '@/components/chat/composer/useComposerState';

export type { DataSourceSummary, DataSourceLoadError, KnowledgeBaseSummary };

// ---- Data types ----

export type ViewItem = {
    key: string;
    label: string;
    hint?: string;
    icon: ReactNode;
    raw?: DataSourceSummary | KnowledgeBaseSummary;
    disabled?: boolean;
};

export type ViewModel = {
    title: string;
    items: ViewItem[];
};

export type { MentionNavigationLevel as Level, MentionNavigationState as MentionPopoverState } from './mention-navigation';

// ---- Config maps ----

export const TYPE_LABELS: Record<MentionType, string> = {
    knowledge_base: '知识库',
    bazi_chart: '八字',
    ziwei_chart: '紫微',
    tarot_reading: '塔罗',
    liuyao_divination: '六爻',
    face_reading: '面相',
    palm_reading: '手相',
    mbti_reading: 'MBTI',
    hepan_chart: '合盘',
    ming_record: '命理记录',
    daily_fortune: '今日运势',
    monthly_fortune: '月运',
    qimen_chart: '奇门遁甲',
    daliuren_divination: '大六壬',
    meihua_divination: '梅花易数',
    xiaoliuren_divination: '小六壬',
};

const renderDataSourceNavIcon = (type: Exclude<MentionType, 'knowledge_base'>, fallback: ReactNode) => {
    const Icon = getDataSourceNavIcon(type);
    return Icon ? <Icon className="w-4 h-4" /> : fallback;
};

export const TYPE_ICONS: Record<MentionType, ReactNode> = {
    knowledge_base: <BookOpenText className="w-4 h-4" />,
    bazi_chart: renderDataSourceNavIcon('bazi_chart', <Orbit className="w-4 h-4" />),
    ziwei_chart: renderDataSourceNavIcon('ziwei_chart', <Sparkles className="w-4 h-4" />),
    tarot_reading: renderDataSourceNavIcon('tarot_reading', <Gem className="w-4 h-4" />),
    liuyao_divination: renderDataSourceNavIcon('liuyao_divination', <Dices className="w-4 h-4" />),
    face_reading: renderDataSourceNavIcon('face_reading', <ScanFace className="w-4 h-4" />),
    palm_reading: renderDataSourceNavIcon('palm_reading', <Hand className="w-4 h-4" />),
    mbti_reading: renderDataSourceNavIcon('mbti_reading', <Brain className="w-4 h-4" />),
    hepan_chart: renderDataSourceNavIcon('hepan_chart', <HeartHandshake className="w-4 h-4" />),
    ming_record: renderDataSourceNavIcon('ming_record', <FileText className="w-4 h-4" />),
    daily_fortune: renderDataSourceNavIcon('daily_fortune', <Calendar className="w-4 h-4" />),
    monthly_fortune: renderDataSourceNavIcon('monthly_fortune', <CalendarDays className="w-4 h-4" />),
    qimen_chart: renderDataSourceNavIcon('qimen_chart', <Compass className="w-4 h-4" />),
    daliuren_divination: renderDataSourceNavIcon('daliuren_divination', <BookOpen className="w-4 h-4" />),
    meihua_divination: renderDataSourceNavIcon('meihua_divination', <Flower2 className="w-4 h-4" />),
    xiaoliuren_divination: renderDataSourceNavIcon('xiaoliuren_divination', <Waypoints className="w-4 h-4" />),
};

export const HEPAN_TYPE_LABELS: Record<string, string> = {
    love: '情侣合婚',
    business: '商业合伙',
    family: '亲子关系',
};

export const HEPAN_TYPE_ICONS: Record<string, ReactNode> = {
    love: <Heart className="w-4 h-4" />,
    business: <Briefcase className="w-4 h-4" />,
    family: <Users className="w-4 h-4" />,
};

export const FOLDER_ICON = <Folder className="w-4 h-4" />;
export const KB_ICON = <BookOpenText className="w-4 h-4" />;
export const CHEVRON_ICON = <ChevronRight className="w-4 h-4 opacity-50" />;

// ---- Helpers ----

export const getHepanSubtype = (item: DataSourceSummary): 'love' | 'business' | 'family' | null => {
    if (item.hepanType === 'love' || item.hepanType === 'business' || item.hepanType === 'family') {
        return item.hepanType;
    }
    return null;
};

export const shouldShowHint = (item: DataSourceSummary) => {
    if (item.type === 'bazi_chart' || item.type === 'ziwei_chart') return false;
    if (item.type === 'tarot_reading' || item.type === 'liuyao_divination') {
        return item.preview.startsWith('问题：');
    }
    return true;
};

export function normalizeQuery(raw: string) {
    const q = raw.trim().toLowerCase();
    if (!q) return '';
    return q
        .replace(/^(?:d|data|数|数据)\s*/i, '')
        .replace(/^(?:k|kb|knowledge|知|知识库)\s*/i, '');
}

export function getQueryHint(raw: string): 'data' | 'knowledge' | null {
    const q = raw.trim().toLowerCase();
    if (!q) return null;
    if (/^(?:d|data|数|数据)\b/i.test(q)) return 'data';
    if (/^(?:k|kb|knowledge|知|知识库)\b/i.test(q)) return 'knowledge';
    return null;
}
