import type { ComponentType } from 'react';
import { BookOpenText, Bot, KeyRound, Megaphone, Scroll, Wallet } from 'lucide-react';
import {
  CurrencyCircleDollarIcon,
  GearSixIcon,
  type IconWeight,
  MetaLogoIcon,
  QuestionMarkIcon,
  ScribbleIcon,
  UserIcon,
} from '@phosphor-icons/react';
import type { SettingsCenterTab } from '@/lib/settings-center';

export type SettingsCenterIconProps = {
  className?: string;
  size?: number | string;
  weight?: IconWeight;
};

export const SETTINGS_CENTER_ICON_SIZES = {
  sidebar: 18,
  disabled: 20,
  mobile: 14,
} as const;

const SETTINGS_CENTER_PHOSPHOR_WEIGHT: IconWeight = 'bold';

function withDefaultPhosphorSize(Icon: ComponentType<SettingsCenterIconProps>) {
  const Wrapped = ({
    size = SETTINGS_CENTER_ICON_SIZES.sidebar,
    weight = SETTINGS_CENTER_PHOSPHOR_WEIGHT,
    className,
  }: SettingsCenterIconProps) => (
    <Icon size={size} weight={weight} className={className} />
  );
  Wrapped.displayName = `WithDefaultPhosphorSize(${Icon.displayName ?? Icon.name ?? 'Icon'})`;
  return Wrapped;
}

const ProfileIcon = withDefaultPhosphorSize(UserIcon);
const GeneralIcon = withDefaultPhosphorSize(GearSixIcon);
const UpgradeIcon = withDefaultPhosphorSize(CurrencyCircleDollarIcon);
const PersonalizationIcon = withDefaultPhosphorSize(MetaLogoIcon);
const HelpIcon = withDefaultPhosphorSize(QuestionMarkIcon);
const McpServiceIcon = withDefaultPhosphorSize(ScribbleIcon);

export const SETTINGS_CENTER_TAB_ICONS: Record<SettingsCenterTab, ComponentType<SettingsCenterIconProps>> = {
  profile: ProfileIcon,
  general: GeneralIcon,
  upgrade: UpgradeIcon,
  personalization: PersonalizationIcon,
  byok: KeyRound,
  help: HelpIcon,
  charts: Scroll,
  'knowledge-base': BookOpenText,
  'mcp-service': McpServiceIcon,
  'admin-announcements': Megaphone,
  'admin-features': Wallet,
  'admin-ai-services': Bot,
};

export function getSettingsCenterTabIcon(tab: SettingsCenterTab) {
  return SETTINGS_CENTER_TAB_ICONS[tab];
}
