/**
 * 年度报告系统
 * 
 * 生成用户年度命理使用报告
 */

import { getSystemAdminClient } from '@/lib/api-utils';
import {
    ANNUAL_REPORT_FEATURE_NAMES,
    type AnnualReportData,
} from '@/lib/annual-report-shared';
import { toFeatureUsageBucket } from '@/lib/source-contracts';

// ===== 报告生成 =====

/**
 * 生成年度报告
 */
export async function generateAnnualReport(
    userId: string,
    year: number
): Promise<AnnualReportData | null> {
    const startDate = `${year}-01-01T00:00:00`;
    const endDate = `${year}-12-31T23:59:59`;

    try {
        const supabase = getSystemAdminClient();
        // 1. 获取对话统计
        const { data: conversations } = await supabase
            .from('conversations')
            .select('id, source_type, created_at')
            .eq('user_id', userId)
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        const convList = (conversations || []) as Array<{ id: string; source_type: string | null; created_at: string }>;

        // 2. 计算功能使用分布
        const featureUsage = {
            bazi: 0, ziwei: 0, liuyao: 0, tarot: 0,
            palm: 0, face: 0, mbti: 0, hepan: 0, fortune: 0,
            qimen: 0, daliuren: 0, meihua: 0, xiaoliuren: 0, dream: 0, chat: 0,
        };

        const monthlyUsage: Record<number, number> = {};
        const weekdayDist: Record<number, number> = {};
        const hourDist: Record<number, number> = {};

        for (const conv of convList) {
            const bucket = toFeatureUsageBucket(conv.source_type);
            featureUsage[bucket]++;

            const date = new Date(conv.created_at);
            const month = date.getMonth() + 1;
            const weekday = date.getDay();
            const hour = date.getHours();

            monthlyUsage[month] = (monthlyUsage[month] || 0) + 1;
            weekdayDist[weekday] = (weekdayDist[weekday] || 0) + 1;
            hourDist[hour] = (hourDist[hour] || 0) + 1;
        }

        // 3. 获取签到统计
        const { data: checkins } = await supabase
            .from('daily_checkins')
            .select('reward_credits')
            .eq('user_id', userId)
            .gte('checkin_date', `${year}-01-01`)
            .lte('checkin_date', `${year}-12-31`);

        const checkinList = (checkins || []) as Array<{ reward_credits: number }>;
        const totalCheckinDays = checkinList.length;
        const totalCreditsEarned = checkinList.reduce((sum, c) => sum + c.reward_credits, 0);

        // 4. 计算活跃月份
        const activeMonths = Object.keys(monthlyUsage).length;

        // 5. 找出峰值小时
        const peakHour = Object.entries(hourDist)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || '12';

        // 6. 获取首次和最后使用日期
        const sortedConvs = [...convList].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const firstUseDate = sortedConvs[0]?.created_at || null;
        const lastUseDate = sortedConvs[sortedConvs.length - 1]?.created_at || null;

        // 构建报告数据
        const report: AnnualReportData = {
            year,
            userId,
            generatedAt: new Date().toISOString(),
            usage: {
                totalAnalyses: convList.length,
                totalChats: convList.filter(c => c.source_type === 'chat').length,
                activeMonths,
                firstUseDate,
                lastUseDate,
            },
            featureUsage,
            activity: {
                monthlyUsage: Object.entries(monthlyUsage).map(([month, count]) => ({
                    month: parseInt(month),
                    count,
                })),
                weekdayDistribution: Object.entries(weekdayDist).map(([day, count]) => ({
                    day: parseInt(day),
                    count,
                })),
                peakHour: parseInt(peakHour),
            },
            checkin: {
                totalDays: totalCheckinDays,
                totalCreditsEarned,
            },
        };

        // 缓存报告
        await cacheAnnualReport(userId, year, report);

        return report;
    } catch (error) {
        console.error('[annual-report] 生成报告失败:', error);
        return null;
    }
}

/**
 * 获取缓存的年度报告
 */
export async function getCachedAnnualReport(
    userId: string,
    year: number
): Promise<AnnualReportData | null> {
    const supabase = getSystemAdminClient();
    const { data, error } = await supabase
        .from('annual_reports')
        .select('report_data')
        .eq('user_id', userId)
        .eq('year', year)
        .maybeSingle();

    if (error || !data) {
        return null;
    }

    return data.report_data as AnnualReportData;
}

/**
 * 缓存年度报告
 */
async function cacheAnnualReport(
    userId: string,
    year: number,
    report: AnnualReportData
): Promise<void> {
    const supabase = getSystemAdminClient();
    await supabase
        .from('annual_reports')
        .upsert({
            user_id: userId,
            year,
            report_data: report,
            generated_at: new Date().toISOString(),
        }, {
            onConflict: 'user_id,year'
        });
}

/**
 * 获取报告概要（用于预览）
 */
export async function getReportSummary(
    userId: string,
    year: number
): Promise<{ hasData: boolean; totalAnalyses: number; topFeature: string } | null> {
    const supabase = getSystemAdminClient();
    const report = await getCachedAnnualReport(userId, year);

    if (!report) {
        // 快速检查是否有数据
        const { count } = await supabase
            .from('conversations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', `${year}-01-01`)
            .lte('created_at', `${year}-12-31`);

        return {
            hasData: (count || 0) > 0,
            totalAnalyses: count || 0,
            topFeature: 'unknown',
        };
    }

    // 找出使用最多的功能
    const features = Object.entries(report.featureUsage);
    const topFeature = features.sort((a, b) => b[1] - a[1])[0];

    return {
        hasData: report.usage.totalAnalyses > 0,
        totalAnalyses: report.usage.totalAnalyses,
        topFeature: topFeature?.[0] || 'none',
    };
}

/**
 * 功能名称映射
 */
export type { AnnualReportData } from '@/lib/annual-report-shared';

export const FEATURE_NAMES = ANNUAL_REPORT_FEATURE_NAMES;
