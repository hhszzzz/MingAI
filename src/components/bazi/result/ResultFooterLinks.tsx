import Link from 'next/link';
import { SettingsCenterLink } from '@/components/settings/SettingsCenterLink';
import { AIFeatureGate } from '@/components/ai/AIFeatureGate';

export function ResultFooterLinks() {
    return (
        <AIFeatureGate><div className="mt-6 flex justify-center gap-4">
            <Link href="/bazi" className="text-sm text-foreground-secondary hover:text-accent transition-colors">
                新建排盘
            </Link>
            <span className="text-foreground-secondary">•</span>
            <SettingsCenterLink tab="charts" className="text-sm text-foreground-secondary hover:text-accent transition-colors">
                我的命盘
            </SettingsCenterLink>
            <span className="text-foreground-secondary">•</span>
            <Link href="/chat" className="text-sm text-foreground-secondary hover:text-accent transition-colors">
                AI 对话
            </Link>
        </div></AIFeatureGate>
    );
}
