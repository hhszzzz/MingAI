import type { FeatureModuleId } from '@/lib/app-settings';
import { DATA_SOURCE_TYPES } from '@/lib/data-sources/types';
import type { DataSourceSummary, DataSourceType } from '@/lib/data-sources/types';
import type { Mention } from '@/types';

type DataSourceCatalogEntry = {
    featureId: FeatureModuleId;
    navId: string;
};

const DATA_SOURCE_CATALOG: Record<DataSourceType, DataSourceCatalogEntry> = {
    bazi_chart: { featureId: 'bazi', navId: 'bazi' },
    ziwei_chart: { featureId: 'ziwei', navId: 'ziwei' },
    tarot_reading: { featureId: 'tarot', navId: 'tarot' },
    liuyao_divination: { featureId: 'liuyao', navId: 'liuyao' },
    mbti_reading: { featureId: 'mbti', navId: 'mbti' },
    hepan_chart: { featureId: 'hepan', navId: 'hepan' },
    face_reading: { featureId: 'face', navId: 'face' },
    palm_reading: { featureId: 'palm', navId: 'palm' },
    ming_record: { featureId: 'records', navId: 'records' },
    daily_fortune: { featureId: 'daily', navId: 'daily' },
    monthly_fortune: { featureId: 'monthly', navId: 'monthly' },
    qimen_chart: { featureId: 'qimen', navId: 'qimen' },
    daliuren_divination: { featureId: 'daliuren', navId: 'daliuren' },
    meihua_divination: { featureId: 'meihua', navId: 'meihua' },
    xiaoliuren_divination: { featureId: 'xiaoliuren', navId: 'xiaoliuren' },
};

export function getDataSourceFeatureId(type: DataSourceType): FeatureModuleId {
    return DATA_SOURCE_CATALOG[type].featureId;
}

export function getDataSourceNavId(type: DataSourceType): string {
    return DATA_SOURCE_CATALOG[type].navId;
}

export function filterDataSourceItemsByFeature<T extends Pick<DataSourceSummary, 'type'>>(
    items: T[],
    isFeatureEnabled: (featureId: FeatureModuleId) => boolean
): T[] {
    return items.filter((item) => isFeatureEnabled(getDataSourceFeatureId(item.type)));
}

export function getEnabledDataSourceTypes(
    isFeatureEnabled: (featureId: FeatureModuleId) => boolean
): DataSourceType[] {
    return DATA_SOURCE_TYPES.filter((type) => isFeatureEnabled(getDataSourceFeatureId(type)));
}

export function filterMentionsByFeature(
    mentions: Mention[],
    options: {
        knowledgeBaseEnabled: boolean;
        enabledDataSourceTypes: readonly DataSourceType[];
    }
): Mention[] {
    const enabledTypeSet = new Set(options.enabledDataSourceTypes);
    return mentions.filter((mention) => {
        if (mention.type === 'knowledge_base') {
            return options.knowledgeBaseEnabled;
        }
        return enabledTypeSet.has(mention.type);
    });
}
