export type ChartTextDetailLevel = 'default' | 'more' | 'full';

export type ChartTextDetailTool =
  | 'bazi'
  | 'ziwei'
  | 'liuyao'
  | 'qimen'
  | 'daliuren'
  | 'meihua'
  | 'xiaoliuren'
  | 'tarot'
  | 'almanac';

export const CHART_TEXT_DETAIL_OPTIONS: Array<{
  value: ChartTextDetailLevel;
  label: string;
}> = [
  { value: 'default', label: '默认' },
  { value: 'more', label: '扩展' },
  { value: 'full', label: '完整' },
];

const TRUE_MORE_TOOLS = new Set<ChartTextDetailTool>(['liuyao']);

export function resolveChartTextDetailLevel(
  tool: ChartTextDetailTool,
  requested: ChartTextDetailLevel | undefined,
): ChartTextDetailLevel {
  const level = requested ?? 'default';
  if (level === 'more' && !TRUE_MORE_TOOLS.has(tool)) {
    return 'full';
  }
  return level;
}
