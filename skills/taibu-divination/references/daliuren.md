# 大六壬排盘（`daliuren`）

大六壬排盘 - 根据日期时间起课，输出天地盘、四课、三传、神将、课体与时空信息。

## 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `date` | string | 是 | — | 公历日期 (YYYY-MM-DD) |
| `hour` | number | 是 | — | 小时 (0-23) |
| `minute` | number | 否 | `0` | 分钟 (0-59) |
| `timezone` | string | 否 | `"Asia/Shanghai"` | IANA 时区 |
| `question` | string | 否 | — | 占事 |
| `birthYear` | number | 否 | — | 出生年，用于本命/行年 |
| `gender` | enum | 否 | — | 性别，用于行年；可选值: `male` / `female` |
| `detailLevel` | enum | 否 | `"default"` | 输出细节级别。；可选值: `default` / `full` |

## 调用示例

```bash
echo '{"date":"2026-03-15","hour":16,"minute":53,"timezone":"Asia/Shanghai","question":"今日运势如何"}' | node "$TB/scripts/taibu.mjs" call daliuren -
```

```bash
echo '{"date":"2026-03-15","hour":16,"timezone":"Asia/Shanghai","birthYear":1990,"gender":"male"}' | node "$TB/scripts/taibu.mjs" call daliuren -
```

## 输出结构（structuredContent 顶层键）

- `基本信息`
- `四课`
- `三传`
- `天地盘`

