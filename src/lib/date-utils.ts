/**
 * 日期相关工具函数
 */

import { LunarMonth } from 'lunar-javascript';
import type { CalendarType } from '@/types';

/**
 * Format a local wall-clock value for an HTML datetime-local input.
 * Deliberately avoids UTC conversion so the browser-visible time is preserved.
 */
export function toDateTimeLocalValue(date = new Date()): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 获取指定年月的天数
 * 支持公历和农历（含闰月）
 */
export function getDayCount(calendarType: CalendarType, year: number, month: number, isLeapMonth?: boolean): number {
    if (calendarType === 'lunar') {
        try {
            const lunarMonth = isLeapMonth ? -Math.abs(month) : month;
            return LunarMonth.fromYm(year, lunarMonth).getDayCount();
        } catch (e) {
            console.warn('农历月天数查询失败，使用默认值30:', e);
            return 30;
        }
    }
    return new Date(year, month, 0).getDate();
}

/**
 * 将日期限制在有效范围内
 */
export function clampDay(calendarType: CalendarType, year: number, month: number, day: number, isLeapMonth?: boolean): number {
    const maxDay = getDayCount(calendarType, year, month, isLeapMonth);
    if (day < 1) return 1;
    if (day > maxDay) return maxDay;
    return day;
}
