# 梅花易数起卦（`meihua`）

梅花易数起卦 - 根据时间、字占、物数、报数等方式起卦，输出起卦信息、卦盘与体用推演。

## 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `question` | string | 是 | — | 占卜问题 |
| `date` | string | 是 | — | 起卦日期时间（YYYY-MM-DDTHH:MM[:SS]） |
| `method` | enum | 否 | — | 起卦方式（time=时间，count_with_time=物数或声数，text_split=字占，measure=丈尺尺寸，classifier_pair=类象对，select=指定卦，number_pair/number_triplet=报数）；可选值: `time` / `count_with_time` / `text_split` / `measure` / `classifier_pair` / `select` / `number_pair` / `number_triplet` |
| `count` | number | 否 | — | 物数或声数起卦的数量 |
| `countCategory` | enum | 否 | — | 数量来源（item=物数，sound=声数）；可选值: `item` / `sound` |
| `text` | string | 否 | — | 字占文本。 |
| `textSplitMode` | enum | 否 | — | 字占拆分方式（auto=自动，count=按字数，sentence_pair=按句，stroke=按笔画）；可选值: `auto` / `count` / `sentence_pair` / `stroke` |
| `multiSentenceStrategy` | enum | 否 | — | 多句文本的取句方式（first=首句，last=末句）；可选值: `first` / `last` |
| `sentences` | string[] | 否 | — | 上下卦对应的两句文本 |
| `leftStrokeCount` | number | 否 | — | 左半边或上半边笔画数 |
| `rightStrokeCount` | number | 否 | — | 右半边或下半边笔画数 |
| `measureKind` | enum | 否 | — | 量法（丈尺=丈尺，尺寸=尺寸）；可选值: `丈尺` / `尺寸` |
| `majorValue` | number | 否 | — | 大单位数值 |
| `minorValue` | number | 否 | — | 小单位数值 |
| `upperCue` | string | 否 | — | 上卦类象提示词 |
| `upperCueCategory` | enum | 否 | — | 上卦类象类别；可选值: `direction` / `color` / `weather` / `person` / `body` / `animal` / `object` / `shape` / `trigram` |
| `lowerCue` | string | 否 | — | 下卦类象提示词 |
| `lowerCueCategory` | enum | 否 | — | 下卦类象类别；可选值: `direction` / `color` / `weather` / `person` / `body` / `animal` / `object` / `shape` / `trigram` |
| `hexagramName` | string | 否 | — | 指定本卦卦名或卦码 |
| `upperTrigram` | string | 否 | — | 指定上卦 |
| `lowerTrigram` | string | 否 | — | 指定下卦 |
| `movingLine` | number | 否 | — | 指定动爻 (1-6) |
| `numbers` | number[] | 否 | — | 报数序列 |
| `detailLevel` | enum | 否 | `"default"` | 输出细节级别。；可选值: `default` / `full` |

## 调用示例

```bash
echo '{"question":"这次合作能否谈成？","method":"time","date":"2026-04-04T10:30:00"}' | node "$TB/scripts/taibu.mjs" call meihua -
```

```bash
echo '{"question":"丢失物品能否找回？","method":"count_with_time","count":7,"countCategory":"item","date":"2026-04-04T10:30:00"}' | node "$TB/scripts/taibu.mjs" call meihua -
```

```bash
echo '{"question":"这件事进展如何？","method":"measure","measureKind":"丈尺","majorValue":2,"minorValue":3,"date":"2026-04-04T10:30:00"}' | node "$TB/scripts/taibu.mjs" call meihua -
```

```bash
echo '{"question":"此事后续如何？","method":"number_pair","numbers":[3,8],"date":"2026-04-04T10:30:00"}' | node "$TB/scripts/taibu.mjs" call meihua -
```

## 输出结构（structuredContent 顶层键）

- `起卦信息`
- `卦盘`
- `干支时间`
- `体用分析`
- `阶段推演`
- `判断参考`

