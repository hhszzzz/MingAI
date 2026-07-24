import { Solar } from 'lunar-javascript';
import {
  calculateXiaoliurenData,
  toXiaoliurenJson,
  toXiaoliurenText,
  type XiaoliurenCanonicalJSON,
  type XiaoliurenOutput,
} from 'taibu-core/xiaoliuren';

export type { XiaoliurenCanonicalJSON, XiaoliurenOutput };

export type XiaoliurenWebInput = {
  date: string;
  question?: string;
};

export type XiaoliurenLunarDate = {
  lunarMonth: number;
  lunarDay: number;
  lunarMonthName?: string;
  lunarDayName?: string;
  isLeapMonth: boolean;
};

export type XiaoliurenWebBundle = XiaoliurenLunarDate & {
  input: XiaoliurenWebInput;
  solarDateTime: string;
  result: XiaoliurenOutput;
  canonicalJson: XiaoliurenCanonicalJSON;
  canonicalText: string;
};

type WallClockParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Convert a local wall-clock hour to the core's 1-12 shichen index. */
export function wallClockHourToShichenIndex(hour: number): number {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error('小时必须是 0-23 的整数');
  }
  if (hour === 0 || hour === 23) return 1;
  return Math.floor((hour + 1) / 2) + 1;
}

function parseWallClockDateTime(value: unknown): WallClockParts {
  if (typeof value !== 'string') throw new Error('请提供公历日期时间');
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    throw new Error('小六壬日期仅支持本地墙上时间，不接受时区偏移');
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) throw new Error('日期格式无效，请使用 YYYY-MM-DDTHH:mm[:ss]');

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const parts: WallClockParts = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
    second: Number(secondText ?? 0),
  };
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  const valid = date.getUTCFullYear() === parts.year
    && date.getUTCMonth() === parts.month - 1
    && date.getUTCDate() === parts.day
    && date.getUTCHours() === parts.hour
    && date.getUTCMinutes() === parts.minute
    && date.getUTCSeconds() === parts.second;
  if (!valid) throw new Error('日期无效，请检查年月日时分');
  return parts;
}

function formatWallClock(parts: WallClockParts): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

export function calculateXiaoliurenBundle(input: XiaoliurenWebInput): XiaoliurenWebBundle {
  const parts = parseWallClockDateTime(input.date);
  const question = input.question?.trim() || undefined;
  const solar = Solar.fromYmdHms(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
  const lunar = solar.getLunar();
  const rawLunarMonth = lunar.getMonth();
  const lunarMonth = Math.abs(rawLunarMonth);
  const lunarDay = lunar.getDay();
  const result = calculateXiaoliurenData({
    lunarMonth,
    lunarDay,
    hour: wallClockHourToShichenIndex(parts.hour),
    question,
  });

  return {
    input: { date: formatWallClock(parts), question },
    solarDateTime: formatWallClock(parts),
    lunarMonth,
    lunarDay,
    lunarMonthName: lunar.getMonthInChinese(),
    lunarDayName: lunar.getDayInChinese(),
    isLeapMonth: rawLunarMonth < 0,
    result,
    canonicalJson: toXiaoliurenJson(result, { detailLevel: 'full' }),
    canonicalText: toXiaoliurenText(result, { detailLevel: 'full' }),
  };
}

export function buildXiaoliurenCanonicalJson(result: XiaoliurenOutput): XiaoliurenCanonicalJSON {
  return toXiaoliurenJson(result, { detailLevel: 'full' });
}

export function buildXiaoliurenCanonicalText(result: XiaoliurenOutput): string {
  return toXiaoliurenText(result, { detailLevel: 'full' });
}
