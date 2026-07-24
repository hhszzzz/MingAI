import type { MentionType } from '@/types';

export const mentionStyleMap: Record<MentionType | 'default', { className: string }> = {
    knowledge_base: { className: 'text-emerald-500' },
    bazi_chart: { className: 'text-orange-500' },
    ziwei_chart: { className: 'text-purple-500' },
    tarot_reading: { className: 'text-fuchsia-500' },
    liuyao_divination: { className: 'text-amber-500' },
    mbti_reading: { className: 'text-blue-500' },
    hepan_chart: { className: 'text-rose-500' },
    face_reading: { className: 'text-orange-500' },
    palm_reading: { className: 'text-yellow-600' },
    ming_record: { className: 'text-slate-500' },
    daily_fortune: { className: 'text-lime-600' },
    monthly_fortune: { className: 'text-lime-600' },
    qimen_chart: { className: 'text-indigo-500' },
    daliuren_divination: { className: 'text-cyan-500' },
    meihua_divination: { className: 'text-pink-500' },
    xiaoliuren_divination: { className: 'text-emerald-500' },
    default: { className: 'text-foreground' }
};

export const mentionTypeLabels: Record<MentionType | 'default', string> = {
    knowledge_base: '知识库',
    bazi_chart: '八字命盘',
    ziwei_chart: '紫微命盘',
    tarot_reading: '塔罗占卜',
    liuyao_divination: '六爻占卜',
    mbti_reading: 'MBTI测评',
    hepan_chart: '合盘',
    face_reading: '面相分析',
    palm_reading: '手相分析',
    ming_record: '命理记录',
    daily_fortune: '每日运势',
    monthly_fortune: '每月运势',
    qimen_chart: '奇门遁甲',
    daliuren_divination: '大六壬',
    meihua_divination: '梅花易数',
    xiaoliuren_divination: '小六壬',
    default: '数据'
};
