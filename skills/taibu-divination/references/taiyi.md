# 太乙九星观测（`taiyi`）

太乙九星观测 - 根据问卜时间生成时空底盘、九星阵列与核心关系。

## 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `mode` | enum | 是 | — | 观测尺度（year=年，month=月，day=日，hour=时，minute=分钟）；可选值: `year` / `month` / `day` / `hour` / `minute` |
| `date` | string | 是 | — | 观测日期 (YYYY-MM-DD) |
| `hour` | number | 否 | `12` | 小时 (0-23) |
| `minute` | number | 否 | `0` | 分钟 (0-59) |
| `timezone` | string | 否 | `"Asia/Shanghai"` | IANA 时区 |
| `question` | string | 否 | — | 占问事项 |
| `detailLevel` | enum | 否 | `"default"` | 输出细节级别。；可选值: `default` / `full` |

## 调用示例

```bash
echo '{"mode":"day","date":"2026-04-10","timezone":"Asia/Shanghai","question":"此事能否顺利推进？"}' | node "$TB/scripts/taibu.mjs" call taiyi -
```

```bash
echo '{"mode":"minute","date":"2026-04-10","hour":13,"minute":37,"timezone":"Asia/Shanghai"}' | node "$TB/scripts/taibu.mjs" call taiyi -
```

## 输出结构（structuredContent 顶层键）

- `问卜与时空底盘`
- `外部时空环境`
- `核心物理关系`
- `九星阵列`：九星阵列列表
- `古典参考`

