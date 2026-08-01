# 西方占星命盘（`astrology`）

西方占星命盘 - 根据出生信息计算本命盘与流运盘，输出基础坐标、命盘锚点、本命主星与流运触发。

## 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `birthYear` | number | 是 | — | 出生年 (> 0) |
| `birthMonth` | number | 是 | — | 出生月 (1-12) |
| `birthDay` | number | 是 | — | 出生日 (1-31) |
| `birthHour` | number | 是 | — | 出生时 (0-23) |
| `birthMinute` | number | 否 | `0` | 出生分 (0-59) |
| `latitude` | number | 否 | — | 出生地纬度 (-90 到 90) |
| `longitude` | number | 否 | — | 出生地经度 (-180 到 180) |
| `birthPlace` | string | 否 | — | 出生地点文本 |
| `transitDateTime` | string | 否 | — | 流运时刻（YYYY-MM-DDTHH:mm[:ss] 或带时区偏移的 ISO 时间；省略时取当前时刻） |
| `houseSystem` | enum | 否 | `"placidus"` | 宫制类型（placidus）；可选值: `placidus` |
| `detailLevel` | enum | 否 | `"default"` | 输出细节级别。；可选值: `default` / `more` / `full` |

## 调用示例

```bash
echo '{"birthYear":1990,"birthMonth":1,"birthDay":1,"birthHour":12,"birthMinute":30,"latitude":40.7128,"longitude":-74.006,"transitDateTime":"2026-04-10T09:30:00"}' | node "$TB/scripts/taibu.mjs" call astrology -
```

## 输出结构（structuredContent 顶层键）

- `基础坐标`
- `命盘锚点`
- `本命主星`：本命主要因素列表
- `当前流运触发`：当前流运触发列表
- `扩展信息`

