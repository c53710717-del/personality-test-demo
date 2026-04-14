# Personality Test AI Prompts

这份文档记录了当前“主题原生人格测试”生成的 prompt 思路，方便继续迭代。

## 当前调用方式

服务端已经改成两层 prompt：

- `system prompt`
  负责约束生成原则、风格、数量规则、主题优先、心理流派改写框架
- `user prompt`
  负责传入本次的：
  - 心理流派
  - 方向主题
  - 自定义主题
  - 人格类型数量
  - 题目数量
  - 当前前端要求的 JSON 输出结构

代码位置：

- prompt 构造：`/Users/anny.chen/Documents/New project/server/src/personality-generator.js`
- 服务端生成接口：`POST /api/personality-tests/generate`

## 核心原则

1. 先找到这个主题里圈内人一眼能懂的识别单位。
2. 不写抽象人格词，不写 AI 味很重的空泛描述。
3. 结果要像社交货币，用户看完会想转发。
4. 允许有一点黑话、讽刺感和判断力，但不能只会玩梗。
5. 心理流派改变的是解释框架，不是把结果写成学术说明。

## 流派改写框架

- `ACT`：价值、边界、心理灵活性、行动一致性
- `积极心理学`：优势、资源感、韧性、激活感
- `CBT`：判断路径、决策偏差、认知惯性
- `系统式`：组织位置、接口功能、系统后果
- `荣格 / 叙事`：角色原型、投射、阴影面、剧情功能

## 主题识别单位示例

- `职场协作`：Joker、嫡系、leader、背锅者、推进器、润滑剂
- `创业团队`：先跑版、补位、招魂、稳盘、一号位、近道王、共犯者、全都管
- `女性主义`：波伏娃、上野千鹤子、戴锦华、鸟鸟
- `桌游`：璀璨宝石、阿瓦隆、卡坦岛、拼布艺术等具体桌游
- `猫咪 / 狗狗`：真实品种
- `哲学流派`：真实哲学人物或大众文化中的哲学人格单位

## Kimi 接入说明

如果使用 Kimi，当前服务端会在 `OPENAI_BASE_URL` 命中 `moonshot.cn` 时自动切换到：

- `POST /chat/completions`
- `messages: [{ role: "system" }, { role: "user" }]`

建议环境变量：

```env
OPENAI_API_KEY=你的 Moonshot API Key
OPENAI_BASE_URL=https://api.moonshot.cn/v1
OPENAI_MODEL=kimi-k2.5
```

如果不是 Kimi，则继续使用 OpenAI 的 `Responses API`，但同样会把 `system prompt` 和 `user prompt` 分开发送。
