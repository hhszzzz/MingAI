# 黄历查询（`almanac`）

黄历查询 - 查询指定日期的黄历、宜忌、冲煞、值星、方位与时辰吉凶等信息。

## 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `dayMaster` | enum | 否 | — | 日主天干；可选值: `甲` / `乙` / `丙` / `丁` / `戊` / `己` / `庚` / `辛` / `壬` / `癸` |
| `birthYear` | number | 否 | — | 出生年，用于推导日主 |
| `birthMonth` | number | 否 | — | 出生月，用于推导日主 |
| `birthDay` | number | 否 | — | 出生日，用于推导日主 |
| `birthHour` | number | 否 | — | 出生时，用于推导日主 |
| `date` | string | 否 | — | 目标日期 (YYYY-MM-DD，省略时取当前日期) |

## 调用示例

```bash
echo '{"birthYear":1990,"birthMonth":1,"birthDay":15,"birthHour":9,"date":"2026-02-14"}' | node "$TB/scripts/taibu.mjs" call almanac -
```

```bash
echo '{"dayMaster":"丙","date":"2026-02-14"}' | node "$TB/scripts/taibu.mjs" call almanac -
```

## 输出结构（structuredContent 顶层键）

- `基础与个性化坐标`
- `传统黄历基调`
- `择日宜忌`
- `神煞参考`
- `方位信息`
- `值日信息`
- `时辰吉凶`

