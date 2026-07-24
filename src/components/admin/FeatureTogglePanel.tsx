/**
 * 功能模块开关管理面板
 *
 * 'use client' 标记说明：
 * - 使用 React hooks (useState)
 * - 有开关切换交互功能
 */
'use client';

import { useState } from "react";
import { requestBrowserData } from '@/lib/browser-api';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';
import { useFeatureToggles } from "@/lib/hooks/useFeatureToggles";
import { getFeatureModules } from '@/lib/navigation/registry';

const MODULES = getFeatureModules();

export function FeatureTogglePanel() {
    const { isFeatureEnabled, isLoading, refresh } = useFeatureToggles();
    const [savingId, setSavingId] = useState<string | null>(null);
    const [error, setError] = useState("");

    const handleToggle = async (featureId: string, currentlyEnabled: boolean) => {
        if (savingId || isLoading) return;

        setSavingId(featureId);
        setError("");

        try {
            await requestBrowserData(
                "/api/feature-toggles",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ featureId, disabled: currentlyEnabled }),
                },
                { fallbackMessage: "更新失败" },
            );

            await refresh();
        } catch (err) {
            console.error("[feature-toggles] Update failed:", err);
            setError("网络错误，请重试");
        } finally {
            setSavingId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <SoundWaveLoader variant="inline" />
                <span className="ml-2 text-sm text-foreground-secondary">加载功能状态...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-foreground-secondary">
                关闭某个功能后，用户将无法访问对应页面、入口或接入说明。
            </p>

            {error && (
                <div className="text-sm text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">{error}</div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {MODULES.map(({ id, label }) => {
                    const enabled = isFeatureEnabled(id);
                    const isSaving = savingId === id;

                    return (
                        <div
                            key={id}
                            className="flex items-center justify-between rounded-xl border border-border bg-background p-3"
                        >
                            <span className="text-sm font-medium truncate mr-2">{label}</span>
                            <button
                                onClick={() => handleToggle(id, enabled)}
                                disabled={!!savingId || isLoading}
                                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                                    enabled ? "bg-emerald-500" : "bg-rose-400"
                                } ${savingId ? "opacity-60 cursor-not-allowed" : ""}`}
                                aria-pressed={enabled}
                                aria-label={`${label}功能开关`}
                            >
                                {isSaving ? (
                                    <SoundWaveLoader variant="inline" />
                                ) : (
                                    <span
                                        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform ${
                                            enabled ? "translate-x-5" : "translate-x-0"
                                        }`}
                                    />
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
