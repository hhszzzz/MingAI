# 六爻排卦（`liuyao`）

六爻排卦 - 根据问题与起卦信息排出六爻盘面，输出卦象、爻位、用神体系、关系判断与时机提示。

## 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `question` | string | 是 | — | 占卜问题 |
| `yongShenTargets` | string[] | 是 | — | 用神目标列表，由调用方按占问主题选择 |
| `method` | enum | 否 | `"auto"` | 起卦方式（auto=自动，select=指定卦，time=时间，number=数字）；可选值: `auto` / `select` / `time` / `number` |
| `numbers` | number[] | 否 | — | 数字起卦使用的数字序列 |
| `hexagramName` | string | 否 | — | 选卦模式下的本卦卦名或卦码 |
| `changedHexagramName` | string | 否 | — | 选卦模式下的变卦卦名或卦码 |
| `date` | string | 是 | — | 占卜日期时间（YYYY-MM-DDTHH:MM[:SS] 或 YYYY-MM-DD HH:MM[:SS]） |
| `detailLevel` | enum | 否 | `"default"` | 输出细节级别。；可选值: `default` / `more` / `full` |

## 调用示例

```bash
echo '{"question":"本月事业运势如何？","yongShenTargets":["官鬼"],"method":"auto","date":"2026-02-10T09:30:00"}' | node "$TB/scripts/taibu.mjs" call liuyao -
```

```bash
echo '{"question":"财运怎么样？","yongShenTargets":["妻财"],"hexagramName":"天火同人","date":"2026-02-10 14:00:00"}' | node "$TB/scripts/taibu.mjs" call liuyao -
```

## 输出结构（structuredContent 顶层键）

- `卦盘`
- `六爻全盘`
- `全局互动`
- `元信息`

