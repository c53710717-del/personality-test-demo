const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com";
const OPENAI_QUICK_MODEL = process.env.OPENAI_QUICK_MODEL || "";
const OPENAI_FULL_MODEL = process.env.OPENAI_FULL_MODEL || "";
const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || "";

const schoolFrames = {
  act: {
    label: "ACT 接纳承诺",
    frame: "用价值感、边界、心理灵活性和行动一致性来解释同一组人格。不要学术化，要像一张很会说话的行动人格卡。"
  },
  positive: {
    label: "积极心理学",
    frame: "用优势识别、资源感、韧性和激活感来解释同一组人格。语气要让人觉得被看见、被点亮、值得发出去。"
  },
  cbt: {
    label: "认知行为取向",
    frame: "用决策偏好、判断路径、思维惯性和认知偏差来解释同一组人格。语气要聪明、犀利，但不能像教科书。"
  },
  systems: {
    label: "系统式视角",
    frame: "用组织位置、接口功能、系统后果和关系回路来解释同一组人格。语气要像懂组织的人在给一个人下判断。"
  },
  jung: {
    label: "荣格原型 / 叙事",
    frame: "用角色原型、投射、剧情功能和阴影面来解释同一组人格。语气要像一张有戏剧张力的角色卡。"
  }
};

const directionGuides = {
  work: {
    label: "职场协作",
    hint: "优先使用职场黑话、协作角色、组织印象词。可以参考 Joker、嫡系、leader、背锅者、推进器、润滑剂这种识别单位。"
  },
  startup: {
    label: "创业团队",
    hint: "优先使用创业角色黑话、组织器官、创始阶段气质。可以参考先跑版、补位、招魂、稳盘、一号位、近道王、共犯者、全都管。"
  },
  feminism: {
    label: "女性主义",
    hint: "优先使用真实人物、表达姿态和结构敏感度来分类。可以参考波伏娃、上野千鹤子、戴锦华、鸟鸟这类能形成传播的识别单位。"
  },
  philosophy: {
    label: "哲学流派",
    hint: "优先使用真实哲学人物或大众文化里一眼能懂的哲学人格单位，不要抽象性格词。"
  },
  boardgame: {
    label: "桌游",
    hint: "优先用具体桌游名来分类，不要写成通用人格。可以参考璀璨宝石、阿瓦隆、卡坦岛、拼布艺术、展翅翱翔、政变疑云这类单位。"
  },
  cat: {
    label: "猫咪",
    hint: "优先使用真实猫咪品种来分类，再写‘你像这种猫的哪一面’。"
  },
  dog: {
    label: "狗狗",
    hint: "优先使用真实狗狗品种来分类，再写‘你像这种狗的哪一面’。"
  },
  relationship: {
    label: "关系沟通",
    hint: "优先使用关系里的识别角色、沟通姿态和情绪分工，不要写成泛人格词。"
  }
};

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "typeCount",
    "title",
    "intro",
    "logicTitle",
    "logicIntro",
    "resultNoun",
    "playfulLine",
    "storyTitle",
    "matchTitle",
    "axes",
    "questionsByAxis",
    "archetypes"
  ],
  properties: {
    typeCount: { type: "integer" },
    title: { type: "string" },
    intro: { type: "string" },
    logicTitle: { type: "string" },
    logicIntro: { type: "string" },
    resultNoun: { type: "string" },
    playfulLine: { type: "string" },
    storyTitle: { type: "string" },
    matchTitle: { type: "string" },
    axes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "leftKey", "leftLabel", "leftDescription", "rightKey", "rightLabel", "rightDescription"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          leftKey: { type: "string" },
          leftLabel: { type: "string" },
          leftDescription: { type: "string" },
          rightKey: { type: "string" },
          rightLabel: { type: "string" },
          rightDescription: { type: "string" }
        }
      }
    },
    questionsByAxis: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["axisId", "left", "right"],
        properties: {
          axisId: { type: "string" },
          left: { type: "array", items: { type: "string" } },
          right: { type: "array", items: { type: "string" } }
        }
      }
    },
    archetypes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "code", "name", "tagline", "traits", "lens", "advice", "risk", "signatureSides", "examples"],
        properties: {
          id: { type: "string" },
          code: { type: "string" },
          name: { type: "string" },
          tagline: { type: "string" },
          traits: { type: "array", items: { type: "string" } },
          lens: { type: "string" },
          advice: { type: "string" },
          risk: { type: "string" },
          signatureSides: {
            type: "array",
            items: {
              type: "string",
              enum: ["left", "right"]
            }
          },
          examples: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "why", "story"],
              properties: {
                name: { type: "string" },
                why: { type: "string" },
                story: { type: "string" }
              }
            }
          }
        }
      }
    }
  }
};

function getAxisCount(typeCount) {
  if (Number(typeCount) >= 32) return 5;
  if (Number(typeCount) >= 16) return 4;
  return 2;
}

function getExpectedTypeCount(typeCount, axisCount) {
  if (Number(typeCount) >= 32 || axisCount >= 5) return 32;
  if (Number(typeCount) >= 16 || axisCount >= 4) return 16;
  if (Number(typeCount) >= 8 || axisCount >= 3) return 8;
  return 4;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "theme";
}

function buildSystemPrompt() {
  return `
你是一名高级人格测试策划师，擅长把“心理学框架 + 圈层文化 + 可传播内容”结合成一套真正可分享的人格测试。

你的工作不是解释系统原理，而是生成一套让用户愿意做、做完愿意转发、结果看起来像在说自己的测试系统。

你必须同时完成四件事：
1. 设计人格类型
2. 设计测试题目
3. 设计题目与人格类型之间的映射逻辑
4. 设计适合传播的结果文案

你必须遵守以下规则：

一、主题优先于通用人格
- 必须先理解“方向主题”是什么，再从主题内部长出人格类型
- 绝不能先生成一套通用人格，再给它贴主题标签
- 每个主题都必须有自己的世界观、命名方式和识别单位
- 创业团队 / 职场协作优先用角色黑话、组织位置、团队器官
- 女性主义优先用真实人物、表达姿态、结构敏感度
- 哲学流派优先用哲学人物、大众文化里的哲学人格或思辨姿态
- 桌游优先用具体桌游名或一眼能懂的牌桌角色
- 猫咪 / 狗狗优先用品种
- 自定义主题时，必须先判断什么是这个圈子里最容易被认出来的“识别单位”

二、心理流派决定“解释框架”
- 心理流派不改变主题本身，但会改变结果解释的角度
- 积极心理学：强调优势、资源感、天赋位置、激活方式
- CBT：强调判断路径、自动化思维、决策偏差
- 系统式：强调组织位置、关系张力、补位方式
- ACT：强调价值、行动选择、心理灵活性
- 荣格原型 / 叙事：强调角色原型、故事位置、阴影面

三、人格数量决定维度数量
- 4种人格 => 2条轴线
- 8种人格 => 3条轴线
- 16种人格 => 4条轴线
- 32种人格 => 5条轴线
- 每个人格都必须是若干轴线两端取值的组合结果

四、题目必须服务于分型
- 每道题只能主要测一个维度
- 题目语气要自然，像真测试，不要学术，也不要像段子
- 题目数量要尽量平均分布到各条轴线
- 题目不能直接泄露人格名

五、结果文案必须有传播感
- 结果命名要像社交货币
- summary 要像“别人会转发的内容”
- blunt_truth 要更直接一点，有一点幽默感
- examples 要尽量使用用户一眼能认出来的人物、作品、品种、角色、组织位置、游戏名
- 不能只是好听，必须像

六、输出要求
- 输出必须是合法 JSON
- 不要输出 markdown
- 不要输出任何前言、解释、总结
- 如果数量不符，必须先自我修正，再输出最终 JSON
`.trim();
}

function buildUserPrompt(input, mode = "full") {
  const directionId = Array.isArray(input.directionIds) ? input.directionIds[0] : input.directionIds;
  const school = schoolFrames[input.schoolId] || schoolFrames.act;
  const builtInDirection = directionGuides[directionId];
  const themeLabel = (input.customDirection || "").trim() || builtInDirection?.label || "自定义主题";
  const themeHint = input.customDirection
    ? "这是用户自定义主题。你需要先判断这个圈层最适合用什么识别单位分类，再长出结果。"
    : builtInDirection?.hint || "请先找到这个主题里圈内人一眼能懂的识别单位。";

  const typeCount = Number(input.typeCount) || 16;
  const questionCount = Number(input.questionCount) || 20;
  const axisCount = getAxisCount(typeCount);
  const isQuickMode = mode === "quick";
  return `
请生成一套完整的人格测试系统。

输入参数：
{
  "psychology_school": "${school.label}",
  "direction_theme": "${builtInDirection?.label || ""}",
  "custom_theme": "${(input.customDirection || "").trim()}",
  "type_count": ${typeCount},
  "question_count": ${questionCount},
  "language": "zh-CN"
}

补充要求：
1. 如果 custom_theme 不为空，以 custom_theme 为准。
2. 如果 direction_theme 是内置主题，必须使用该主题对应的圈层识别单位来设计人格。
3. 人格命名必须有传播感，最好让人一看就想分享。
4. 结果页文案要像面向用户的内容卡，不要像系统说明。
5. 题目必须真的服务于分型，不要为了有趣牺牲区分度。
6. 同一主题的人格解释框架要体现「${school.label}」的视角差异：${school.frame}
7. 请严格按照传入的 type_count 输出人格数量。
8. 请严格按照传入的 question_count 输出题目数量。
9. 题目要覆盖所有维度，尽量平均分布。
10. 当前主题提示：${themeHint}
11. 如果 type_count = 16，则必须输出 4 条轴线、16 个 archetypes。
12. 如果 type_count = 32，则必须输出 5 条轴线、32 个 archetypes。
13. 如果输出数量不符，视为失败，请自行修正后再输出。

生成阶段：
- 当前阶段是：${isQuickMode ? "快速骨架生成" : "完整结果卡补全"}
- ${isQuickMode
    ? "这一阶段优先保证题目、轴线、类型、基础分型逻辑先可用。文案可以短一点，但字段必须完整。每个 archetype 的 lens / advice / risk 各写 1 句，examples 先给 1 个最像的。"
    : "这一阶段要在已经有题目和类型骨架的前提下，把结果卡文案补满。每个 archetype 的 lens / advice / risk 要更完整、更适合分享，examples 要补到 3 个。builder 区域 copy 也要更像营销内容。"}

文案风格附加要求：
- 结果命名要像社交货币
- summary 要像“别人会转发的内容”
- blunt_truth 要更直接一点，有一点幽默感
- examples 要尽量使用用户一眼能认出来的人物、作品、品种、角色
- 不能只是好听，必须像

为了兼容当前前端，请严格按下面这个 JSON 结构输出，不要改字段名：
{
  "typeCount": ${typeCount},
  "title": "",
  "intro": "",
  "logicTitle": "",
  "logicIntro": "",
  "resultNoun": "",
  "playfulLine": "",
  "storyTitle": "",
  "matchTitle": "",
  "axes": [
    {
      "id": "",
      "label": "",
      "leftKey": "",
      "leftLabel": "",
      "leftDescription": "",
      "rightKey": "",
      "rightLabel": "",
      "rightDescription": ""
    }
  ],
  "questionsByAxis": [
    {
      "axisId": "",
      "left": ["", "", ""],
      "right": ["", "", ""]
    }
  ],
  "archetypes": [
    {
      "id": "",
      "code": "",
      "name": "",
      "tagline": "",
      "traits": ["", "", ""],
      "lens": "",
      "advice": "",
      "risk": "",
      "signatureSides": ["left", "right"],
      "examples": [
        { "name": "", "why": "", "story": "" },
        { "name": "", "why": "", "story": "" },
        { "name": "", "why": "", "story": "" }
      ]
    }
  ]
}

额外校验：
- axes 数量必须等于 ${axisCount}
- archetypes 数量必须等于 ${typeCount}
- questionsByAxis 数量必须等于 ${axisCount}
- 每条轴线左右各 3 道题
- signatureSides 必须和 axes 顺序一一对应
`.trim();
}

function extractOutputText(responseJson) {
  if (typeof responseJson.output_text === "string" && responseJson.output_text.trim()) {
    return responseJson.output_text;
  }

  if (Array.isArray(responseJson.output)) {
    for (const item of responseJson.output) {
      if (!Array.isArray(item.content)) continue;
      for (const content of item.content) {
        if (content.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
          return content.text;
        }
      }
    }
  }

  throw new Error("Model returned no structured text.");
}

function extractChatCompletionText(responseJson) {
  const content = responseJson?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .map((item) => (item?.type === "text" ? item.text : ""))
      .join("")
      .trim();
    if (text) return text;
  }
  throw new Error("Model returned no completion text.");
}

function isMoonshotBaseUrl() {
  return /moonshot\.cn/i.test(OPENAI_BASE_URL);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getModelForMode(mode) {
  if (!isMoonshotBaseUrl()) {
    if (mode === "quick") return OPENAI_QUICK_MODEL || OPENAI_MODEL;
    return OPENAI_FULL_MODEL || OPENAI_MODEL;
  }

  if (mode === "quick") {
    return OPENAI_QUICK_MODEL || "kimi-k2-turbo-preview";
  }
  return OPENAI_FULL_MODEL || OPENAI_MODEL || "kimi-k2.5";
}

function getFallbackModel(mode) {
  if (OPENAI_FALLBACK_MODEL) return OPENAI_FALLBACK_MODEL;
  if (!isMoonshotBaseUrl()) return "";
  if (mode === "quick") return "moonshot-v1-32k";
  return "kimi-k2-turbo-preview";
}

function isRetryableProviderError(message = "") {
  return /overloaded|rate limit|temporarily unavailable|timeout|timed out|try again later/i.test(message);
}

function extractJsonObjectString(raw) {
  if (typeof raw !== "string") {
    throw new Error("Model returned non-string JSON payload.");
  }

  const firstBrace = raw.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("Model returned no JSON object.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  let endIndex = -1;

  for (let index = firstBrace; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        endIndex = index + 1;
        break;
      }
    }
  }

  if (endIndex !== -1) {
    return raw.slice(firstBrace, endIndex);
  }

  return raw.slice(firstBrace).trim();
}

async function repairJsonPayload(rawText, mode, requestFn, model) {
  const repairPrompt = `
下面是一段本应为合法 JSON 的文本，但它可能被截断、存在非法转义、引号不闭合或多余文本。

你的任务：
1. 尽最大努力把它修复成合法 JSON
2. 不要改字段名
3. 不要补充说明
4. 只输出修复后的 JSON 对象

待修复内容：
${rawText}
`.trim();

  return requestFn({
    model,
    systemPrompt: "你是一个只负责修复 JSON 的助手。不要解释，只输出修复后的 JSON。",
    userPrompt: repairPrompt,
    jsonMode: true
  });
}

function buildSignatureKey(signatureSides = [], axisCount = 0) {
  return Array.from({ length: axisCount }, (_, index) => (signatureSides[index] === "right" ? "R" : "L")).join("");
}

function getAllSignatureKeys(axisCount, expectedTypeCount) {
  const max = Math.min(2 ** axisCount, expectedTypeCount);
  return Array.from({ length: max }, (_, number) =>
    number
      .toString(2)
      .padStart(axisCount, "0")
      .replaceAll("0", "L")
      .replaceAll("1", "R")
  );
}

function synthesizeArchetype({ signatureKey, axes, index, title, resultNoun }) {
  const signatureSides = signatureKey.split("").map((value) => (value === "R" ? "right" : "left"));
  const pickedLabels = axes.map((axis, axisIndex) =>
    signatureSides[axisIndex] === "right" ? axis.right.label : axis.left.label
  );
  const shortPieces = pickedLabels.slice(0, 2);
  const shortName = shortPieces.join("·") || `结果 ${index + 1}`;
  const fullName = `${shortName}${resultNoun ? ` ${resultNoun}` : ""}`.trim();
  const traits = pickedLabels.slice(0, 3);

  return {
    id: `type-${signatureKey.toLowerCase()}`,
    code: signatureKey,
    name: fullName,
    tagline: `你更像把 ${pickedLabels.join(" / ")} 这组气质揉在一起的那类人。`,
    traits,
    lens: `${title || "这套测试"}里，你会自然站到 ${pickedLabels.join("、")} 这一侧，别人也更容易这样记住你。`,
    advice: `先把 ${pickedLabels[0]} 这面用好，再补足 ${pickedLabels[pickedLabels.length - 1]} 这一侧的弹性。`,
    risk: `当压力上来时，你可能会把 ${pickedLabels.join("、")} 推得太满，反而显得用力过猛。`,
    examples: [],
    signature: Object.fromEntries(
      axes.map((axis, axisIndex) => [axis.id, signatureSides[axisIndex] === "right" ? "right" : "left"])
    )
  };
}

function normalizeGeneratedSystem(raw) {
  const expectedAxisCount = getAxisCount(raw.typeCount || raw.archetypes?.length || 16);
  const expectedTypeCount = getExpectedTypeCount(raw.typeCount, expectedAxisCount);

  const axes = (raw.axes || []).slice(0, expectedAxisCount).map((axis, index) => ({
    id: axis.id || `axis_${index + 1}`,
    label: axis.label || `维度 ${index + 1}`,
    left: {
      key: axis.leftKey || `left_${index + 1}`,
      label: axis.leftLabel || `左侧 ${index + 1}`,
      description: axis.leftDescription || `更偏向 ${axis.leftLabel || `左侧 ${index + 1}`}`
    },
    right: {
      key: axis.rightKey || `right_${index + 1}`,
      label: axis.rightLabel || `右侧 ${index + 1}`,
      description: axis.rightDescription || `更偏向 ${axis.rightLabel || `右侧 ${index + 1}`}`
    }
  }));

  if (axes.length !== expectedAxisCount) {
    throw new Error(`Model did not return ${expectedAxisCount} valid axes.`);
  }

  const questionMap = new Map(
    (raw.questionsByAxis || []).map((item, index) => [
      item.axisId || axes[index]?.id,
      {
        left: Array.isArray(item.left) ? item.left.slice(0, 3) : [],
        right: Array.isArray(item.right) ? item.right.slice(0, 3) : []
      }
    ])
  );

  const allSignatureKeys = getAllSignatureKeys(expectedAxisCount, expectedTypeCount);
  const archetypeMap = new Map();

  (raw.archetypes || []).forEach((type, index) => {
    const signatureSides = Array.from({ length: expectedAxisCount }, (_, axisIndex) =>
      type.signatureSides?.[axisIndex] === "right" ? "right" : "left"
    );
    const signatureKey = buildSignatureKey(signatureSides, expectedAxisCount);
    if (!signatureKey || archetypeMap.has(signatureKey)) return;

    archetypeMap.set(signatureKey, {
      id: type.id || `${slugify(type.code || type.name || `type-${index + 1}`)}`,
      code: type.code || signatureKey,
      name: type.name || `结果 ${index + 1}`,
      tagline: type.tagline || "",
      traits: Array.isArray(type.traits) ? type.traits.slice(0, 3) : [],
      lens: type.lens || "",
      advice: type.advice || "",
      risk: type.risk || "",
      examples: Array.isArray(type.examples) ? type.examples.slice(0, 3) : [],
      signature: Object.fromEntries(
        axes.map((axis, axisIndex) => [axis.id, signatureSides[axisIndex] === "right" ? "right" : "left"])
      )
    });
  });

  for (let index = 0; index < allSignatureKeys.length; index += 1) {
    const signatureKey = allSignatureKeys[index];
    if (!archetypeMap.has(signatureKey)) {
      archetypeMap.set(
        signatureKey,
        synthesizeArchetype({
          signatureKey,
          axes,
          index,
          title: raw.title,
          resultNoun: raw.resultNoun
        })
      );
    }
  }

  const archetypes = allSignatureKeys.map((signatureKey) => archetypeMap.get(signatureKey)).slice(0, expectedTypeCount);

  return {
    id: `ai-${slugify(raw.title)}`,
    title: raw.title || "生成一套适合被转发的测试。",
    intro: raw.intro || "选一个你想让人一眼记住的主题，我们会先生成一套可做、可分享、可讨论的人格测试。",
    logicTitle: raw.logicTitle || "这套测试会怎么识别你的结果走向",
    logicIntro: raw.logicIntro || "它会先看几条核心维度，再把不同侧面的组合拼成人格结果。",
    resultNoun: raw.resultNoun || "人格",
    playfulLine: raw.playfulLine || "测出来的不只是结论，也是一句适合发出去的自我介绍。",
    storyTitle: raw.storyTitle || "你更像哪些人物的一面",
    matchTitle: raw.matchTitle || "谁会一眼认出你这种气质",
    typeCount: expectedTypeCount,
    axes,
    questionsByAxis: Object.fromEntries(
      axes.map((axis) => [
        axis.id,
        {
          left: (() => {
            const current = questionMap.get(axis.id)?.left || [];
            const fallback = [
              `通常来说，我更容易站到“${axis.left.label}”这一侧。`,
              `遇到需要判断的时候，我更像“${axis.left.label}”这边的人。`,
              `在压力上来时，我往往会先表现出“${axis.left.label}”这一面。`
            ];
            return [...current, ...fallback].slice(0, 3);
          })(),
          right: (() => {
            const current = questionMap.get(axis.id)?.right || [];
            const fallback = [
              `通常来说，我更容易站到“${axis.right.label}”这一侧。`,
              `遇到需要判断的时候，我更像“${axis.right.label}”这边的人。`,
              `在压力上来时，我往往会先表现出“${axis.right.label}”这一面。`
            ];
            return [...current, ...fallback].slice(0, 3);
          })()
        }
      ])
    ),
    archetypes
  };
}

async function requestMoonshotChat({ model, systemPrompt, userPrompt, jsonMode = true }) {
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      temperature: 1,
      ...(jsonMode
        ? {
            response_format: {
              type: "json_object"
            }
          }
        : {}),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  const responseJson = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(responseJson.error?.message || "AI generation request failed.");
  }

  return extractChatCompletionText(responseJson);
}

async function requestOpenAIResponses({ model, systemPrompt, userPrompt }) {
  const response = await fetch(`${OPENAI_BASE_URL}/v1/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "medium" },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: systemPrompt
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: userPrompt
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "shareable_personality_test_system",
          strict: true,
          schema: outputSchema
        }
      }
    })
  });

  const responseJson = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(responseJson.error?.message || "AI generation request failed.");
  }

  return extractOutputText(responseJson);
}

async function requestModel({ mode, systemPrompt, userPrompt }) {
  const primaryModel = getModelForMode(mode);
  const fallbackModel = getFallbackModel(mode);
  const requestFn = isMoonshotBaseUrl() ? requestMoonshotChat : requestOpenAIResponses;

  const tryModels = fallbackModel && fallbackModel !== primaryModel
    ? [primaryModel, fallbackModel]
    : [primaryModel];

  let lastError = null;

  for (const model of tryModels) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await requestFn({ model, systemPrompt, userPrompt });
      } catch (error) {
        lastError = error;
        const message = error?.message || "AI generation request failed.";
        const canRetry = isRetryableProviderError(message) && attempt < 3;
        console.warn(`[personality-generator] request failed model=${model} attempt=${attempt} mode=${mode}: ${message}`);
        if (canRetry) {
          await sleep(700 * attempt);
          continue;
        }
        break;
      }
    }
  }

  throw lastError || new Error("AI generation request failed.");
}

async function parseModelJson(rawText, mode) {
  const normalizedText = extractJsonObjectString(rawText);
  try {
    return JSON.parse(normalizedText);
  } catch (error) {
    console.warn(`[personality-generator] json parse failed mode=${mode}, trying repair: ${error.message}`);
    const repaired = await repairJsonPayload(
      normalizedText,
      mode,
      isMoonshotBaseUrl() ? requestMoonshotChat : requestOpenAIResponses,
      getFallbackModel(mode) || getModelForMode(mode)
    );
    return JSON.parse(extractJsonObjectString(repaired));
  }
}

export async function generatePersonalitySystem(input, options = {}) {
  if (!OPENAI_API_KEY) {
    throw new Error("服务器还没有配置 OPENAI_API_KEY，暂时不能生成 AI 主题。");
  }

  const mode = options.mode || "full";
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(input, mode);
  const startedAt = Date.now();
  console.log(
    `[personality-generator] start mode=${mode} school=${input.schoolId || "unknown"} direction=${Array.isArray(input.directionIds) ? input.directionIds[0] || "custom" : input.directionIds || "custom"} typeCount=${input.typeCount || 16} questionCount=${input.questionCount || 20}`
  );
  const outputText = await requestModel({ mode, systemPrompt, userPrompt });
  const normalized = normalizeGeneratedSystem(await parseModelJson(outputText, mode));
  console.log(
    `[personality-generator] success mode=${mode} model=${getModelForMode(mode)} axes=${normalized.axes.length} archetypes=${normalized.archetypes.length} duration_ms=${Date.now() - startedAt}`
  );
  return normalized;
}
