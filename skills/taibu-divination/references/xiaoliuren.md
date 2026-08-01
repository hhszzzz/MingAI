# 小六壬占测（`xiaoliuren`）

小六壬占测 - 根据农历月日时辰起课，输出起课信息、推演链与结果信息。

## 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `lunarMonth` | number | 是 | — | 农历月（1-12） |
| `lunarDay` | number | 是 | — | 农历日（1-30） |
| `hour` | number | 是 | — | 时辰序号（子=1, 丑=2, ..., 亥=12）或0-23的小时数 |
| `question` | string | 否 | — | 占问事项 |
| `detailLevel` | enum | 否 | `"default"` | 输出细节级别。；可选值: `default` / `full` |

## 调用示例

```bash
echo '{"lunarMonth":3,"lunarDay":15,"hour":8,"question":"今日运势如何"}' | node "$TB/scripts/taibu.mjs" call xiaoliuren -
```

```bash
echo '{"lunarMonth":1,"lunarDay":1,"hour":1}' | node "$TB/scripts/taibu.mjs" call xiaoliuren -
```

## 输出结构（structuredContent 顶层键）

- `起课信息`
- `推演链`
- `结果`

