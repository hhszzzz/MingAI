# 塔罗抽牌（`tarot`）

塔罗抽牌 - 根据问题与牌阵抽取塔罗牌，输出牌面结果及占卜参考信息。

## 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `spreadType` | enum | 否 | `"single"` | 牌阵类型（single=单牌，three-card=三牌，love=爱情，celtic-cross=凯尔特十字，horseshoe=马蹄，decision=抉择，mind-body-spirit=身心灵，situation=处境，yes-no=是否）；可选值: `single` / `three-card` / `love` / `celtic-cross` / `horseshoe` / `decision` / `mind-body-spirit` / `situation` / `yes-no` |
| `question` | string | 否 | — | 占卜问题 |
| `allowReversed` | boolean | 否 | `true` | 是否允许逆位 |
| `seed` | string | 否 | — | 随机种子 |
| `birthYear` | number | 否 | — | 出生年，用于人格牌/灵魂牌/年度牌 |
| `birthMonth` | number | 否 | — | 出生月 (1-12)，用于人格牌/灵魂牌/年度牌 |
| `birthDay` | number | 否 | — | 出生日 (1-31)，用于人格牌/灵魂牌/年度牌 |
| `detailLevel` | enum | 否 | `"default"` | 输出细节级别。；可选值: `default` / `full` |

## 调用示例

```bash
echo '{"spreadType":"three-card","question":"本月运势如何？"}' | node "$TB/scripts/taibu.mjs" call tarot -
```

```bash
echo '{"spreadType":"love","question":"我和他的未来发展？","allowReversed":true}' | node "$TB/scripts/taibu.mjs" call tarot -
```

```bash
echo '{"spreadType":"celtic-cross","question":"事业发展","birthYear":1990,"birthMonth":5,"birthDay":15}' | node "$TB/scripts/taibu.mjs" call tarot -
```

## 输出结构（structuredContent 顶层键）

- `问卜设定`
- `牌阵展开`
- `求问者生命数字`

