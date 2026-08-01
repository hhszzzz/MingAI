# 四柱反推（`bazi_pillars_resolve`）

四柱反推 - 根据年柱、月柱、日柱、时柱反推出生时间候选列表。

## 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `yearPillar` | string | 是 | — | 年柱干支（如“甲子”） |
| `monthPillar` | string | 是 | — | 月柱干支（如“乙丑”） |
| `dayPillar` | string | 是 | — | 日柱干支（如“丙寅”） |
| `hourPillar` | string | 是 | — | 时柱干支（如“丁卯”） |

## 调用示例

```bash
echo '{"yearPillar":"甲子","monthPillar":"乙丑","dayPillar":"丙寅","hourPillar":"丁卯"}' | node "$TB/scripts/taibu.mjs" call bazi_pillars_resolve -
```

```bash
echo '{"yearPillar":"戊子","monthPillar":"庚丑","dayPillar":"辛卯","hourPillar":"癸巳"}' | node "$TB/scripts/taibu.mjs" call bazi_pillars_resolve -
```

## 输出结构（structuredContent 顶层键）

- `原始四柱`
- `候选数量`：候选数量
- `候选列表`

