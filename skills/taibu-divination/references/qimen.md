# 奇门遁甲排盘（`qimen`）

奇门遁甲排盘 - 根据指定时间排出奇门盘，输出九宫、九星、八门、八神、格局等信息。

## 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `year` | number | 是 | — | 年 (1900-2100) |
| `month` | number | 是 | — | 月 (1-12) |
| `day` | number | 是 | — | 日 (1-31) |
| `hour` | number | 是 | — | 时 (0-23) |
| `minute` | number | 否 | `0` | 分 (0-59) |
| `timezone` | string | 否 | `"Asia/Shanghai"` | IANA 时区 |
| `question` | string | 否 | — | 占问事项 |
| `panType` | enum | 否 | `"zhuan"` | 盘式（zhuan=转盘）；可选值: `zhuan` |
| `juMethod` | enum | 否 | `"chaibu"` | 定局法（chaibu=拆补，maoshan=茅山）；可选值: `chaibu` / `maoshan` |
| `zhiFuJiGong` | enum | 否 | `"ji_liuyi"` | 直符寄宫方式（ji_liuyi=寄六仪，ji_wugong=寄戊宫）；可选值: `ji_liuyi` / `ji_wugong` |
| `detailLevel` | enum | 否 | `"default"` | 输出细节级别。；可选值: `default` / `full` |

## 调用示例

```bash
echo '{"year":2026,"month":3,"day":15,"hour":16,"minute":51,"timezone":"Asia/Shanghai","question":"事业发展如何？"}' | node "$TB/scripts/taibu.mjs" call qimen -
```

## 输出结构（structuredContent 顶层键）

- `基本信息`
- `九宫盘`
- `空亡信息`
- `驿马`
- `十干月令旺衰`：十天干在月令中的旺衰
- `全局格局`：全局格局列表

