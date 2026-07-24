/**
 * 八字基本信息区块
 * 
 * 对齐 Notion 风格：极简卡片、移除渐变、标准化边框与按钮
 */
import { User, Save, Sparkles, Info } from 'lucide-react';
import type { BaziCanonicalJSON } from 'taibu-core/bazi';
import { getElementColor } from '@/lib/divination/display-helpers';
import { TenGodKnowledge } from '@/components/bazi/TenGodKnowledge';
import { AIWuxingAnalysis } from '@/components/bazi/result/AIWuxingAnalysis';
import { AIPersonalityAnalysis } from '@/components/bazi/result/AIPersonalityAnalysis';
import { AIFeatureGate } from '@/components/ai/AIFeatureGate';
import type { FiveElement, TenGod } from '@/types';

interface BasicInfoSectionProps {
    canonicalChart: BaziCanonicalJSON;
    dayMasterDescription: string;
    /** 命盘ID（用于AI分析持久化） */
    chartId?: string | null;
    /** 用户ID */
    userId?: string | null;
    /** 用户当前积分 */
    credits?: number | null;
    /** 已保存的五行分析 */
    savedWuxingAnalysis?: string | null;
    /** 已保存的五行推理 */
    savedWuxingReasoning?: string | null;
    /** 已保存的五行模型 */
    savedWuxingModelId?: string | null;
    /** 已保存的人格分析 */
    savedPersonalityAnalysis?: string | null;
    /** 已保存的人格推理 */
    savedPersonalityReasoning?: string | null;
    /** 已保存的人格模型 */
    savedPersonalityModelId?: string | null;
    /** 是否具备有效出生时辰 */
    hasKnownBirthTime?: boolean;
    /** 保存五行分析回调 */
    onSaveWuxingAnalysis?: (analysis: string) => void;
    /** 保存人格分析回调 */
    onSavePersonalityAnalysis?: (analysis: string) => void;
    /** 登录回调 */
    onLoginRequired?: () => void;
}

export function BasicInfoSection({
    canonicalChart,
    dayMasterDescription,
    chartId,
    userId,
    credits,
    savedWuxingAnalysis,
    savedWuxingReasoning,
    savedWuxingModelId,
    savedPersonalityAnalysis,
    savedPersonalityReasoning,
    savedPersonalityModelId,
    hasKnownBirthTime = true,
    onSaveWuxingAnalysis,
    onSavePersonalityAnalysis,
    onLoginRequired,
}: BasicInfoSectionProps) {
    // 获取命盘中出现的十神
    const highlightedTenGods: TenGod[] = [
        canonicalChart.四柱[0]?.天干十神,
        canonicalChart.四柱[1]?.天干十神,
        canonicalChart.四柱[3]?.天干十神,
    ].filter((g): g is TenGod => !!g);
    const dayMasterElement = canonicalChart.基本信息.命主五行?.slice(-1) || '';

    // 是否已保存命盘
    const isSaved = Boolean(chartId);
    return (
        <div className="space-y-8 animate-fade-in">
            {/* 1. 日主特征 - 极简卡片 */}
            <section className="bg-background border border-border rounded-md p-6">
                <div className="flex items-center gap-2 mb-6">
                    <User className="w-4 h-4 text-foreground/30" />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/60">
                        日主特征
                    </h2>
                </div>
                <div className="flex flex-col md:flex-row items-start gap-6">
                    <div
                        className="w-14 h-14 rounded-md flex items-center justify-center text-2xl font-bold text-white shrink-0 shadow-sm"
                        style={{ backgroundColor: getElementColor(dayMasterElement as FiveElement) }}
                    >
                        {canonicalChart.基本信息.日主}
                    </div>
                    <div className="space-y-2">
                        <div className="font-bold text-base">
                            日主「{canonicalChart.基本信息.日主}」，五行属{dayMasterElement}
                        </div>
                        <p className="text-sm text-foreground/60 leading-relaxed max-w-2xl">
                            {dayMasterDescription}
                        </p>
                    </div>
                </div>
            </section>

            {/* 2. AI 专业分析区域 */}
            <AIFeatureGate>
            <div className="space-y-8">
                {/* 五行分析 */}
                {!hasKnownBirthTime ? (
                    <section className="bg-background-secondary/30 border border-border rounded-md p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-2 rounded bg-background border border-border/60 shrink-0">
                                <Info className="w-5 h-5 text-[#dfab01]" />
                            </div>
                            <div className="space-y-4 flex-1">
                                <div>
                                    <h4 className="text-sm font-bold text-foreground/80">AI 专业五行分析</h4>
                                    <p className="text-xs text-foreground/40 mt-1">未知时辰仅支持前端查看，不支持保存与 AI 深度分析</p>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 bg-[#dfab01]/5 border border-[#dfab01]/10 rounded text-xs text-[#dfab01] font-medium">
                                    <Info className="w-3.5 h-3.5" />
                                    请先补全出生时辰并保存命盘，再使用 AI 深度解读
                                </div>
                            </div>
                        </div>
                    </section>
                ) : !isSaved ? (
                    <section className="bg-background-secondary/30 border border-border rounded-md p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-2 rounded bg-background border border-border/60 shrink-0">
                                <Save className="w-5 h-5 text-[#2eaadc]" />
                            </div>
                            <div className="space-y-4 flex-1">
                                <div>
                                    <h4 className="text-sm font-bold text-foreground/80">AI 专业五行分析</h4>
                                    <p className="text-xs text-foreground/40 mt-1">深度洞察五行旺衰与调候建议</p>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 bg-[#dfab01]/5 border border-[#dfab01]/10 rounded text-xs text-[#dfab01] font-medium">
                                    <Info className="w-3.5 h-3.5" />
                                    请先点击页面右上角「保存」命盘，即可解锁 AI 深度解读功能
                                </div>
                            </div>
                        </div>
                    </section>
                ) : !userId ? (
                    <section className="bg-blue-50/30 border border-blue-100 rounded-md p-8 text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                            <Sparkles className="w-6 h-6 text-[#2eaadc]" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-bold">AI 五行分析</h3>
                            <p className="text-sm text-foreground/40 max-w-xs mx-auto leading-relaxed">
                                登录后解锁完整 AI 深度解读，获取更精准的个性化建议
                            </p>
                        </div>
                        <button
                            onClick={onLoginRequired}
                            className="px-6 py-2 bg-[#2383e2] text-white text-sm font-bold rounded-md hover:bg-[#2383e2]/90 transition-all active:bg-[#1a65b0]"
                        >
                            立即登录体验
                        </button>
                    </section>
                ) : (
                    <AIWuxingAnalysis
                        chartId={chartId!}
                        userId={userId}
                        credits={credits}
                        savedAnalysis={savedWuxingAnalysis}
                        savedReasoning={savedWuxingReasoning}
                        savedModelId={savedWuxingModelId}
                        onSaveAnalysis={onSaveWuxingAnalysis || (() => { })}
                        onLoginRequired={onLoginRequired}
                    />
                )}

                {/* 性格分析 */}
                {!hasKnownBirthTime ? (
                    <section className="bg-background-secondary/30 border border-border rounded-md p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-2 rounded bg-background border border-border/60 shrink-0">
                                <Info className="w-5 h-5 text-[#dfab01]" />
                            </div>
                            <div className="space-y-4 flex-1">
                                <div>
                                    <h4 className="text-sm font-bold text-foreground/80">AI 性格特征分析</h4>
                                    <p className="text-xs text-foreground/40 mt-1">未知时辰仅支持前端查看，不支持保存与 AI 深度分析</p>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 bg-[#dfab01]/5 border border-[#dfab01]/10 rounded text-xs text-[#dfab01] font-medium">
                                    <Info className="w-3.5 h-3.5" />
                                    请先补全出生时辰并保存命盘，再使用 AI 性格分析
                                </div>
                            </div>
                        </div>
                    </section>
                ) : !isSaved ? (
                    <section className="bg-background-secondary/30 border border-border rounded-md p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-2 rounded bg-background border border-border/60 shrink-0">
                                <User className="w-5 h-5 text-[#a083ff]" />
                            </div>
                            <div className="space-y-4 flex-1">
                                <div>
                                    <h4 className="text-sm font-bold text-foreground/80">AI 性格特征分析</h4>
                                    <p className="text-xs text-foreground/40 mt-1">基于十神命局的深度性格画像</p>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 bg-[#dfab01]/5 border border-[#dfab01]/10 rounded text-xs text-[#dfab01] font-medium">
                                    <Info className="w-3.5 h-3.5" />
                                    保存命盘后即可开启 AI 性格特征分析
                                </div>
                            </div>
                        </div>
                    </section>
                ) : !userId ? (
                    <section className="bg-[#a083ff]/5 border border-[#a083ff]/10 rounded-md p-8 text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-[#a083ff]/10 flex items-center justify-center mx-auto">
                            <User className="w-6 h-6 text-[#a083ff]" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-bold">AI 性格分析</h3>
                            <p className="text-sm text-foreground/40 max-w-xs mx-auto leading-relaxed">
                                登录后解锁基于您命盘的深度性格倾向与职场建议
                            </p>
                        </div>
                        <button
                            onClick={onLoginRequired}
                            className="px-6 py-2 bg-[#a083ff] text-white text-sm font-bold rounded-md hover:bg-[#a083ff]/90 transition-all"
                        >
                            立即登录体验
                        </button>
                    </section>
                ) : (
                    <AIPersonalityAnalysis
                        chartId={chartId!}
                        userId={userId}
                        credits={credits}
                        savedAnalysis={savedPersonalityAnalysis}
                        savedReasoning={savedPersonalityReasoning}
                        savedModelId={savedPersonalityModelId}
                        onSaveAnalysis={onSavePersonalityAnalysis || (() => { })}
                        onLoginRequired={onLoginRequired}
                    />
                )}
            </div>
            </AIFeatureGate>

            {/* 3. 十神知识库 - 独立区域 */}
            <div className="pt-4">
                <TenGodKnowledge highlightedTenGods={highlightedTenGods} />
            </div>
        </div>
    );
}
