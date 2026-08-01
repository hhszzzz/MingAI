# 紫微斗数运限（`ziwei_horoscope`）

紫微斗数运限 - 根据出生信息与目标日期计算大限、小限、流年、流月、流日、流时等运限信息。

## 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `gender` | enum | 是 | — | 性别；可选值: `male` / `female` |
| `birthYear` | number | 是 | — | 出生年 (1900-2100) |
| `birthMonth` | number | 是 | — | 出生月 (1-12) |
| `birthDay` | number | 是 | — | 出生日 (1-31) |
| `birthHour` | number | 是 | — | 出生时 (0-23) |
| `birthMinute` | number | 否 | `0` | 出生分 (0-59) |
| `calendarType` | enum | 否 | `"solar"` | 历法类型（solar=公历，lunar=农历）；可选值: `solar` / `lunar` |
| `isLeapMonth` | boolean | 否 | `false` | 农历闰月标记 |
| `longitude` | number | 否 | — | 出生地经度 |
| `targetDate` | string | 否 | — | 目标日期 (YYYY-MM-DD，省略时取当前日期) |
| `targetTimeIndex` | number | 否 | — | 目标流时时段序号 (0-12) |
| `detailLevel` | enum | 否 | `"default"` | 输出细节级别。；可选值: `default` / `full` |

## 调用示例

```bash
echo '{"gender":"male","birthYear":1990,"birthMonth":1,"birthDay":15,"birthHour":9,"targetDate":"2026-03-13"}' | node "$TB/scripts/taibu.mjs" call ziwei_horoscope -
```

## 输出结构（structuredContent 顶层键）

- `基本信息`
- `运限叠宫`
- `流年星曜`
- `岁前十二星`：岁前十二星列表
- `将前十二星`：将前十二星列表

