# 紫微斗数命盘（`ziwei`）

紫微斗数命盘 - 根据出生信息计算紫微命盘，输出十二宫位、星曜分布、四化、大限等信息。

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
| `detailLevel` | enum | 否 | `"default"` | 输出细节级别。；可选值: `default` / `full` |

## 调用示例

```bash
echo '{"gender":"male","birthYear":1990,"birthMonth":1,"birthDay":15,"birthHour":9}' | node "$TB/scripts/taibu.mjs" call ziwei -
```

```bash
echo '{"gender":"female","birthYear":1995,"birthMonth":6,"birthDay":20,"birthHour":23,"calendarType":"lunar"}' | node "$TB/scripts/taibu.mjs" call ziwei -
```

```bash
echo '{"gender":"male","birthYear":1990,"birthMonth":1,"birthDay":15,"birthHour":9,"longitude":116.4}' | node "$TB/scripts/taibu.mjs" call ziwei -
```

## 输出结构（structuredContent 顶层键）

- `基本信息`
- `十二宫位`：十二宫位列表
- `小限`：小限列表

