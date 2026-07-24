import type { DataSourceType } from '@/lib/data-sources/types';

export const DATA_SUBCATEGORY_MAP: Record<string, DataSourceType[]> = {
    命盘: ['bazi_chart', 'ziwei_chart'],
    占卜记录: ['tarot_reading', 'liuyao_divination', 'face_reading', 'palm_reading', 'mbti_reading', 'qimen_chart', 'daliuren_divination', 'meihua_divination', 'xiaoliuren_divination'],
    合盘记录: ['hepan_chart'],
    命理记录: ['ming_record'],
    运势: ['daily_fortune', 'monthly_fortune'],
};

export const DATA_SUBCATEGORY_DIVIDE = new Set(['命盘', '占卜记录', '合盘记录']);
