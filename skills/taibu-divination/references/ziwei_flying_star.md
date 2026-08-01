# 紫微斗数飞星（`ziwei_flying_star`）

紫微斗数飞星 - 分析命盘中的四化飞布、自化、落宫与三方四正关系。

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
| `queries` | object[] | 是 | — | 查询列表 |
| `queries[].type` | enum | 是 | — | 查询类型（fliesTo=飞到，selfMutaged=自化，mutagedPlaces=四化落宫，surroundedPalaces=三方四正）；可选值: `fliesTo` / `selfMutaged` / `mutagedPlaces` / `surroundedPalaces` |
| `queries[].from` | string | 否 | — | 起飞宫位 |
| `queries[].to` | string | 否 | — | 目标宫位 |
| `queries[].palace` | string | 否 | — | 查询宫位 |
| `queries[].mutagens` | string[] | 否 | — | 四化类型列表 |
| `detailLevel` | enum | 否 | `"default"` | 输出细节级别。；可选值: `default` / `full` |

## 调用示例

```bash
echo '{"gender":"male","birthYear":1990,"birthMonth":1,"birthDay":15,"birthHour":9,"queries":[{"type":"mutagedPlaces","palace":"命宫"},{"type":"surroundedPalaces","palace":"命宫"}]}' | node "$TB/scripts/taibu.mjs" call ziwei_flying_star -
```

## 输出结构（structuredContent 顶层键）

- `查询结果`

