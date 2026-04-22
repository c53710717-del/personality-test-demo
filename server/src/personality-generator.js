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

const axisSchema = {
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
};

const questionsByAxisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["axisId", "left", "right"],
  properties: {
    axisId: { type: "string" },
    left: { type: "array", items: { type: "string" } },
    right: { type: "array", items: { type: "string" } }
  }
};

const exampleSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "why", "story"],
  properties: {
    name: { type: "string" },
    why: { type: "string" },
    story: { type: "string" }
  }
};

const skeletonArchetypeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "code", "name", "tagline", "traits", "signatureSides"],
  properties: {
    id: { type: "string" },
    code: { type: "string" },
    name: { type: "string" },
    tagline: { type: "string" },
    traits: { type: "array", items: { type: "string" } },
    signatureSides: {
      type: "array",
      items: {
        type: "string",
        enum: ["left", "right"]
      }
    }
  }
};

const copyPatchArchetypeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "name", "tagline", "lens", "advice", "risk"],
  properties: {
    code: { type: "string" },
    name: { type: "string" },
    tagline: { type: "string" },
    lens: { type: "string" },
    advice: { type: "string" },
    risk: { type: "string" }
  }
};

const examplesPatchArchetypeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "examples"],
  properties: {
    code: { type: "string" },
    examples: {
      type: "array",
      items: exampleSchema
    }
  }
};

const fullArchetypeSchema = {
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
      items: exampleSchema
    }
  }
};

const skeletonOutputSchema = {
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
      items: axisSchema
    },
    questionsByAxis: {
      type: "array",
      items: questionsByAxisSchema
    },
    archetypes: {
      type: "array",
      items: skeletonArchetypeSchema
    }
  }
};

const copyPatchSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "intro",
    "logicTitle",
    "logicIntro",
    "resultNoun",
    "playfulLine",
    "storyTitle",
    "matchTitle",
    "archetypes"
  ],
  properties: {
    title: { type: "string" },
    intro: { type: "string" },
    logicTitle: { type: "string" },
    logicIntro: { type: "string" },
    resultNoun: { type: "string" },
    playfulLine: { type: "string" },
    storyTitle: { type: "string" },
    matchTitle: { type: "string" },
    archetypes: {
      type: "array",
      items: copyPatchArchetypeSchema
    }
  }
};

const examplesPatchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["playfulLine", "storyTitle", "matchTitle", "archetypes"],
  properties: {
    playfulLine: { type: "string" },
    storyTitle: { type: "string" },
    matchTitle: { type: "string" },
    archetypes: {
      type: "array",
      items: examplesPatchArchetypeSchema
    }
  }
};

const fullOutputSchema = {
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
      items: axisSchema
    },
    questionsByAxis: {
      type: "array",
      items: questionsByAxisSchema
    },
    archetypes: {
      type: "array",
      items: fullArchetypeSchema
    }
  }
};

function getAxisCount(typeCount) {
  if (Number(typeCount) >= 32) return 5;
  if (Number(typeCount) >= 16) return 4;
  if (Number(typeCount) >= 8) return 3;
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

const formalArchetypeTemplate = `
正式写作模板（所有完整文案都要尽量贴近这个顺序）：
1. 先用一个真实锚点开场：优先是真实原句、名场面、代表作、公开事件、典型行为，而不是先下定义
2. 立刻解释为什么这个锚点会被记住：它戳穿了什么、照亮了什么、为什么直到今天还会被引用
3. 再落回“你像它/她/他的哪一面”：不要停留在人物介绍，必须把原型的武器、判断路径、说话方式映射到用户身上
4. 再写这种人现实中怎么出手：怎么说话、怎么反击、怎么让别人记住、怎么让场面变掉
5. 最后写这种人的代价或翻车点：这种锋利会伤到谁，也会怎么反噬自己

写作重点：
- 不要概括“特点”，要讲“故事如何说明特点”
- 不要先说“你很敏锐/很锋利”，要先让读者看到她为什么会被记住
- 如果是人物原型，优先抓她最被记住的一句话、一段演讲、一本代表作、一个公共场面
- 如果是动物/职业/角色原型，优先抓最典型的真实行为和大众公共记忆
- 每一段都要像在讲一个活人或活物，不像在解释测试结果
`.trim();

function buildSystemPrompt() {
  return `
你是一名高级人格测试策划师，擅长把“心理学框架 + 圈层文化 + 可传播内容”结合成一套真正可分享的人格测试。

你的工作不是解释系统原理，而是生成一套让用户愿意做、做完愿意转发、结果看起来像在说自己的测试系统。
你不是在发明抽象人格标签，而是在从现实世界中提取真正有生命力的原型。

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

二、所有类型都必须真实存在
- 每个类型都必须对应现实世界中真实存在的单位
- 允许的类型单位包括：真实人物、真实动物品种、真实作品角色、真实职业角色、真实组织位置、真实游戏角色、真实思想或文化流派
- 禁止现场发明不存在的类型名
- 禁止生成“高敏感理性共情者”“独立觉察型执行者”这类AI拼装标签
- 禁止只把轴线标签重命名后冒充一个类型
- 如果主题天然适合真实人物（如女性主义、哲学），优先使用真实人物或公认称呼
- 如果主题不适合人物命名，也必须使用真实单位，例如橘猫、狸花猫、边牧、班主任、产品经理、一号位、卡坦岛玩家

三、心理流派决定“解释框架”
- 心理流派不改变主题本身，但会改变结果解释的角度
- 积极心理学：强调优势、资源感、天赋位置、激活方式
- CBT：强调判断路径、自动化思维、决策偏差
- 系统式：强调组织位置、关系张力、补位方式
- ACT：强调价值、行动选择、心理灵活性
- 荣格原型 / 叙事：强调角色原型、故事位置、阴影面

四、人格数量决定维度数量
- 4种人格 => 2条轴线
- 8种人格 => 3条轴线
- 16种人格 => 4条轴线
- 32种人格 => 5条轴线
- 每个人格都必须是若干轴线两端取值的组合结果

五、题目必须服务于分型
- 每道题只能主要测一个维度
- 题目语气要自然，像真测试，不要学术，也不要像段子
- 题目数量要尽量平均分布到各条轴线
- 题目不能直接泄露人格名

六、结果文案必须有传播感
- 结果命名要像社交货币
- summary 要像“别人会转发的内容”
- blunt_truth 要更直接一点，有一点幽默感
- examples 要尽量使用用户一眼能认出来的人物、作品、品种、角色、组织位置、游戏名
- 不能只是好听，必须像

七、每个类型都必须有真实可讲的过去
- 每个类型至少自带一个真实、具体、可复述的故事锚点
- 故事锚点必须来自：代表作、公开经历、名场面、被广泛记住的一句话、公共事件、该物种/角色/职业最典型的真实行为
- 禁止只有“她很锋利”“它很黏人”“这种人很敏锐”这种空洞总结
- 必须先给出故事、事实、场景，再解释它说明了什么
- 解释一个类型时，优先采用“真实故事/原句 -> 为什么会被记住 -> 你像它/她/他的哪一面 -> 你在现实中会怎么表现”的顺序

八、文风必须减少 AI 味
- 禁止写万能正确话，例如“善于平衡”“拥有韧性”“值得被看见”“兼具理性与感性”
- 禁止咨询腔、讲义腔、科普腔，不要像老师总结，也不要像心理报告
- 禁止堆抽象词，例如“边界感、掌控感、能量感、价值感、稳定感”连着出现
- 禁止把结果名写成标签拼盘，例如“高敏感共情型执行者”“理性独立觉察者”
- 禁止把每种类型写得太圆满，每种类型都要有明显偏心、惯性和会被吐槽的一面
- 禁止写成通用人格套皮，必须长出这个主题内部的人物、黑话、场面和识别方式
- 句子宁可短、准、狠，也不要面面俱到；优先写具体动作、具体场景、具体口头禅
- 每句话都要让人感觉“像在说一个活人”，而不是“像在总结一类人”
- 如果主题天然适合真实人物（如女性主义、哲学），优先用真实人物名、代表作、名场面来建立识别感，不要硬造绰号
- 解释结果时，优先采用“人物锚点 -> 代表性经历/作品 -> 你像她的哪一面”的顺序

九、输出前必须自检
- 这个类型在现实中是否真实存在？
- 这个类型是否有可讲述的真实故事、名场面、代表作或典型行为？
- 如果删掉类型名称，只看正文，读者还能否通过故事认出它是谁？
- 如果不能，说明这个类型太空，必须重写
- 如果你发现自己在发明标签，而不是提取现实原型，说明本次输出失败，必须重写

十、正式模板
${formalArchetypeTemplate}

十一、输出要求
- 输出必须是合法 JSON
- 不要输出 markdown
- 不要输出任何前言、解释、总结
- 如果数量不符，必须先自我修正，再输出最终 JSON
		`.trim();
}

function buildExistingSystemSummary(generatedSystem) {
  if (!generatedSystem || typeof generatedSystem !== "object") return "";

  const summary = {
    title: generatedSystem.title || "",
    resultNoun: generatedSystem.resultNoun || "",
    axes: Array.isArray(generatedSystem.axes)
      ? generatedSystem.axes.map((axis) => ({
          id: axis.id,
          label: axis.label,
          left: {
            code: axis.left?.code || axis.left?.key || "",
            label: axis.left?.label || ""
          },
          right: {
            code: axis.right?.code || axis.right?.key || "",
            label: axis.right?.label || ""
          }
        }))
      : [],
    archetypes: Array.isArray(generatedSystem.archetypes)
      ? generatedSystem.archetypes.map((type) => ({
          code: type.code || "",
          name: type.name || "",
          signature: type.signature || {}
        }))
      : []
  };

  return JSON.stringify(summary, null, 2);
}

function buildUserPrompt(input, mode = "full") {
  const directionId = Array.isArray(input.directionIds) ? input.directionIds[0] : input.directionIds;
  const school = schoolFrames[input.schoolId] || schoolFrames.act;
  const builtInDirection = directionGuides[directionId];
  const themeHint = input.customDirection
    ? "这是用户自定义主题。你需要先判断这个圈层最适合用什么识别单位分类，再长出结果。"
    : builtInDirection?.hint || "请先找到这个主题里圈内人一眼能懂的识别单位。";

  const typeCount = Number(input.typeCount) || 16;
  const questionCount = Number(input.questionCount) || 20;
  const axisCount = getAxisCount(typeCount);
  const existingSystemSummary = mode === "quick" ? "" : buildExistingSystemSummary(input.generatedSystem);
  const baseContext = `
输入参数：
{
  "psychology_school": "${school.label}",
  "direction_theme": "${builtInDirection?.label || ""}",
  "custom_theme": "${(input.customDirection || "").trim()}",
  "type_count": ${typeCount},
  "question_count": ${questionCount},
  "axis_count": ${axisCount},
  "language": "zh-CN"
}

共同要求：
1. 如果 custom_theme 不为空，以 custom_theme 为准。
2. 如果 direction_theme 是内置主题，必须使用该主题对应的圈层识别单位。
3. 同一主题的人格解释框架要体现「${school.label}」的视角差异：${school.frame}
4. 当前主题提示：${themeHint}
5. leftKey / rightKey 请尽量使用 1 到 3 个大写英文字母缩写；leftLabel / rightLabel 再写完整中文名。
6. archetype 的 name 不能直接把轴线两端标签硬拼在一起，也不要写成“结果 1 / 类型 1”。
7. 每种 archetype 都必须像一个能被朋友拿来调侃、认领、转发的具体角色，而不是抽象人格标签。
8. 每种 archetype 必须来自真实存在的单位；如果是猫，就必须是现实存在的猫；如果是人物，就必须是真实人物或被广泛认知的真实角色。
9. name 应优先直接、清楚地指向该真实原型，例如“波伏娃型”“上野型”“橘猫型”“狸花猫型”，不要为了新鲜感硬造昵称。
10. 每个 archetype 必须带上至少一个真实的故事、原句、名场面、代表作、公开经历或典型行为。
11. 对真实人物的引用不能只报名字，必须带上代表作、关键经历、公开姿态或名场面。
12. 每次引用真实原型，最终都要落回“你像它/她/他的哪一面”，而不是把背景资料写完就结束。
13. 禁止写空泛好词，优先写具体行为、具体关系位置、具体反应速度、具体说话方式。
14. lens / advice / risk 要像熟人锐评，不像咨询建议；允许轻微幽默，但不要油腻。
15. examples 里的 why / story 要让用户一眼就懂，不要写成文艺散文或抽象金句。
16. 如果输出数量不符，视为失败，请自行修正后再输出。
17. 完整写作请尽量遵循这条顺序：真实原句/名场面/代表作/典型行为 -> 为什么会被记住 -> 你像它/她/他的哪一面 -> 你现实中怎么出手 -> 你的代价或翻车点。
18. 如果某个原型没有足够强的真实故事支撑，不要硬写，换一个更有公共记忆的真实原型。
19. 对人物型 archetype，优先抓“最有传播力的一句话或一个场面”，不要写成生平简介。
		`.trim();

  if (mode === "quick") {
    return `
请先生成一套“可预览版骨架”。目标是尽快产出可分享、可做题、可预览的测试骨架，不要把时间花在长文案和例子上。

${baseContext}

这一阶段只做这些事：
1. 产出完整的测试标题和基础简介。
2. 产出 ${axisCount} 条轴线。
3. 每条轴线左右各写 3 道题。
4. 产出 ${typeCount} 个 archetypes，但只保留骨架字段：id / code / name / tagline / traits / signatureSides。
5. tagline 只要 1 句短的，traits 只要 2 到 3 个词。
6. 不要输出 lens / advice / risk / examples，这些留到后续补全阶段。
7. title、intro、logicTitle、logicIntro、resultNoun、playfulLine、storyTitle、matchTitle 都可以简短，但要能直接给用户看。
8. 骨架阶段也必须使用真实原型，不允许用抽象标签占位。
9. 骨架阶段的 name / tagline 要尽量先把真实原型立住；如果主题适合真实人物，优先先把人物原型和被记住的故事原型立住。
10. quick 阶段虽然不写长文，但也要让 archetype 的 name / tagline 能隐约看出后续可以承接哪句原话、哪段故事、哪种名场面。

请严格按下面这个 JSON 结构输出，不要改字段名：
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
      "signatureSides": ["left", "right"]
    }
  ]
}

校验：
- axes 数量必须等于 ${axisCount}
- questionsByAxis 数量必须等于 ${axisCount}
- archetypes 数量必须等于 ${typeCount}
- 每条轴线左右各 3 道题
- signatureSides 必须和 axes 顺序一一对应
`.trim();
  }

  if (mode === "copy") {
    return `
请基于下面这份已经可用的“测试骨架摘要”，只补全结果页文案，不要推翻已有分型体系，不要改 code / signature 对应关系。

${baseContext}

当前骨架摘要：
${existingSystemSummary}

这一阶段只做这些事：
1. 补 title、intro、logicTitle、logicIntro、resultNoun、playfulLine、storyTitle、matchTitle 的正式文案。
2. 为每个 archetype 补 name、tagline、lens、advice、risk。
3. 文案要更像用户会分享出去的结果卡，但仍然保持和骨架一致。
4. 不要输出 axes 和 questionsByAxis。
5. 不要输出 examples，这一块留到下一阶段。
6. lens 要像一句“这个人到底怎么运转”的判断；advice 要像对朋友说的人话；risk 要像朋友会吐槽的翻车点。
7. 如果使用真实人物原型：name 尽量直接、清楚，不要乱起外号。
8. tagline 要像这位人物的短识别句，不要像抽象人格定义。
9. lens 必须严格优先采用这条顺序：真实原句/名场面/代表作/关键经历 -> 为什么这件事会被记住 -> 你像她/它/他的哪一面 -> 你现实中会怎么出手。
10. lens 不要写成人物简介，也不要只讲故事；必须把故事变成对用户的判断。
11. advice / risk 也要从这个真实原型的行事风格里长出来：advice 更像“这把武器怎么用得更准”，risk 更像“这把武器会怎么反噬你”。
12. 不要只给特点，要给论据；不允许“没有故事的结果卡”。
13. 文风更接近锋利专栏，而不是测试说明书；句子可以有力，但不要故意炫技。
14. 能引用真实金句时优先引用真实金句；如果不直接引用，也要用明确可识别的真实事件替代。
15. 每个 archetype 的 lens / advice / risk 合起来，必须能让用户感觉自己认识这个人，也认识这种人。

请严格按下面这个 JSON 结构输出：
{
  "title": "",
  "intro": "",
  "logicTitle": "",
  "logicIntro": "",
  "resultNoun": "",
  "playfulLine": "",
  "storyTitle": "",
  "matchTitle": "",
  "archetypes": [
    {
      "code": "",
      "name": "",
      "tagline": "",
      "lens": "",
      "advice": "",
      "risk": ""
    }
  ]
}

校验：
- archetypes 数量必须等于 ${typeCount}
- 每个 code 必须能和骨架里的 archetype 一一对应
`.trim();
  }

  if (mode === "examples") {
    return `
请基于下面这份已经可用的“测试骨架摘要”，只补全 examples 和分享增强文案，不要改分型结构。

${baseContext}

当前骨架摘要：
${existingSystemSummary}

这一阶段只做这些事：
1. 微调 playfulLine、storyTitle、matchTitle，让分享表达更顺。
2. 为每个 archetype 补 2 到 3 个 examples。
3. examples 必须是用户一眼能认出来的人物、角色、品种、作品或组织位置。
4. 不要输出 axes、questionsByAxis，也不要重写 lens / advice / risk。
5. why 要短而准，像一句识别理由；story 要像朋友补刀，不要写成人物小传。
6. 如果 example 是真实人物，story 必须尽量提到她的代表作、代表性经历、原句或名场面，再落回“你像她的哪一面”。
7. 如果 example 是动物、职业、角色、流派，也必须写出它最典型的真实行为、公共记忆或现实场景。
8. 每条 story 尽量遵循这条迷你模板：一个真实锚点 -> 为什么这很像它/她/他 -> 你像它/她/他的哪一面。
9. examples 不是名人列表，必须形成“原型证据链”，让用户一看就明白为什么会被归到这型。
10. 尽量避免三个 examples 都是同一种写法，允许一个偏原句、一个偏故事、一个偏典型行为。

请严格按下面这个 JSON 结构输出：
{
  "playfulLine": "",
  "storyTitle": "",
  "matchTitle": "",
  "archetypes": [
    {
      "code": "",
      "examples": [
        { "name": "", "why": "", "story": "" },
        { "name": "", "why": "", "story": "" }
      ]
    }
  ]
}

校验：
- archetypes 数量必须等于 ${typeCount}
- 每个 code 必须能和骨架里的 archetype 一一对应
`.trim();
  }

  return `
请生成一套完整的人格测试系统。

${baseContext}

下面会给你一份已经生成好的骨架。完整模式下请优先保留这套骨架的轴线结构、题目方向、类型 code / signature 对应关系，只把文案补得更完整、更适合分享，不要整体推翻重做。

这是已经可用的骨架摘要，请沿着它润色：
${existingSystemSummary}

完整模式写作时，请把这套模板贯彻到每个 archetype：
${formalArchetypeTemplate}

补全文案时还要特别注意：
1. archetype 的 lens 负责“故事 + 洞察 + 映射到你”
2. advice 负责“这把武器怎么用得更准”
3. risk 负责“这把武器会怎么反噬你”
4. examples 负责补充真实证据链，不是凑名人名单
5. 如果主题适合真实人物，优先使用真实人物的原句、代表作、名场面，而不是自己编一个更花的比喻

请严格按完整 JSON 结构输出，补齐 title、intro、logicTitle、logicIntro、resultNoun、playfulLine、storyTitle、matchTitle、axes、questionsByAxis、archetypes、examples 全部字段。
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

function getSchemaForMode(mode) {
  if (mode === "quick") return skeletonOutputSchema;
  if (mode === "copy") return copyPatchSchema;
  if (mode === "examples") return examplesPatchSchema;
  return fullOutputSchema;
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

const fallbackArchetypePrefixes = [
  "开路",
  "定盘",
  "穿透",
  "稳场",
  "探路",
  "控局",
  "织网",
  "破局"
];

const fallbackArchetypeRoles = [
  "引擎",
  "灯塔",
  "信号员",
  "校准者",
  "架桥人",
  "操盘手",
  "观察者",
  "编排者"
];

function resolveExpectedAxisCount(raw) {
  const explicitTypeCount = Number(raw?.typeCount);
  if (explicitTypeCount) {
    return getAxisCount(explicitTypeCount);
  }

  const rawAxisCount = Array.isArray(raw?.axes) ? raw.axes.length : 0;
  if (rawAxisCount >= 2 && rawAxisCount <= 5) {
    return rawAxisCount;
  }

  const rawArchetypeCount = Array.isArray(raw?.archetypes) ? raw.archetypes.length : 0;
  if (rawArchetypeCount) {
    return getAxisCount(rawArchetypeCount);
  }

  return getAxisCount(16);
}

function resolveExpectedTypeCount(raw, axisCount) {
  const explicitTypeCount = Number(raw?.typeCount);
  if (explicitTypeCount) {
    return getExpectedTypeCount(explicitTypeCount, axisCount);
  }

  const rawArchetypeCount = Array.isArray(raw?.archetypes) ? raw.archetypes.length : 0;
  if (rawArchetypeCount) {
    return getExpectedTypeCount(rawArchetypeCount, axisCount);
  }

  return getExpectedTypeCount(2 ** axisCount, axisCount);
}

function buildFallbackAxisCode(index, side) {
  const leftCodes = ["A", "C", "E", "G", "J"];
  const rightCodes = ["B", "D", "F", "H", "K"];
  return side === "right" ? rightCodes[index] || `R${index + 1}` : leftCodes[index] || `L${index + 1}`;
}

function deriveAxisCode(rawValue, label, fallbackCode) {
  const source = String(rawValue || "").trim();
  const upperSource = source.toUpperCase();
  if (/^[A-Z0-9]{1,3}$/.test(upperSource)) {
    return upperSource;
  }

  const asciiChunks = source.match(/[A-Za-z0-9]+/g);
  if (asciiChunks?.length) {
    const initials = asciiChunks.map((part) => part[0]).join("").slice(0, 3).toUpperCase();
    if (initials) return initials;
    return asciiChunks.join("").slice(0, 3).toUpperCase();
  }

  const labelSource = String(label || "").trim();
  const labelAsciiChunks = labelSource.match(/[A-Za-z0-9]+/g);
  if (labelAsciiChunks?.length) {
    const labelInitials = labelAsciiChunks.map((part) => part[0]).join("").slice(0, 3).toUpperCase();
    if (labelInitials) return labelInitials;
  }

  return fallbackCode;
}

function normalizeAxis(axis = {}, index = 0) {
  const leftLabel = axis.leftLabel || `左侧 ${index + 1}`;
  const rightLabel = axis.rightLabel || `右侧 ${index + 1}`;
  let leftCode = deriveAxisCode(axis.leftKey, leftLabel, buildFallbackAxisCode(index, "left"));
  let rightCode = deriveAxisCode(axis.rightKey, rightLabel, buildFallbackAxisCode(index, "right"));

  if (leftCode === rightCode) {
    rightCode = buildFallbackAxisCode(index, "right");
    if (leftCode === rightCode) {
      rightCode = `${rightCode}${index + 1}`;
    }
  }

  return {
    id: axis.id || `axis_${index + 1}`,
    label: axis.label || `维度 ${index + 1}`,
    left: {
      key: axis.leftKey || leftCode.toLowerCase(),
      code: leftCode,
      label: leftLabel,
      description: axis.leftDescription || `更偏向 ${leftLabel}`
    },
    right: {
      key: axis.rightKey || rightCode.toLowerCase(),
      code: rightCode,
      label: rightLabel,
      description: axis.rightDescription || `更偏向 ${rightLabel}`
    }
  };
}

function splitTypeCodeTokens(typeCode, axes = []) {
  const rawCode = String(typeCode || "").trim();
  if (!rawCode) return [];

  const separated = rawCode
    .split(/[\s\-_/|·]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (separated.length === axes.length) {
    return separated;
  }

  const compact = rawCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!compact) return [];

  const tokens = [];
  let cursor = 0;

  for (const axis of axes) {
    const options = [axis.left.code, axis.right.code]
      .filter(Boolean)
      .map((token) => String(token).toUpperCase())
      .sort((a, b) => b.length - a.length);
    const matched = options.find((option) => compact.slice(cursor).startsWith(option));
    if (!matched) {
      return [];
    }
    tokens.push(matched);
    cursor += matched.length;
  }

  return cursor === compact.length ? tokens : [];
}

function buildArchetypeCode(signatureSides = [], axes = []) {
  return axes
    .map((axis, index) => (signatureSides[index] === "right" ? axis.right.code : axis.left.code))
    .filter(Boolean)
    .join("-");
}

function resolveSignatureSides(type = {}, axes = [], fallbackSignatureKey = "") {
  const fallbackSides = fallbackSignatureKey
    ? fallbackSignatureKey.split("").map((value) => (value === "R" ? "right" : "left"))
    : Array.from({ length: axes.length }, () => "left");
  const resolved = Array.from({ length: axes.length }, (_, index) => {
    if (type.signatureSides?.[index] === "left" || type.signatureSides?.[index] === "right") {
      return type.signatureSides[index];
    }

    const signatureValue = type.signature?.[axes[index]?.id];
    if (signatureValue === "left" || signatureValue === "right") {
      return signatureValue;
    }

    return null;
  });

  const codeTokens = splitTypeCodeTokens(type.code, axes);
  if (codeTokens.length === axes.length) {
    codeTokens.forEach((token, index) => {
      if (resolved[index]) return;
      resolved[index] = token.toUpperCase() === axes[index].right.code.toUpperCase() ? "right" : "left";
    });
  }

  return resolved.map((value, index) => value || fallbackSides[index] || "left");
}

function buildFallbackArchetypeName(signatureKey, index) {
  const compactKey = String(signatureKey || "");
  const splitIndex = Math.max(1, Math.ceil(compactKey.length / 2));
  const prefixBits = compactKey
    .slice(0, splitIndex)
    .replaceAll("L", "0")
    .replaceAll("R", "1");
  const roleBits = compactKey
    .slice(splitIndex)
    .replaceAll("L", "0")
    .replaceAll("R", "1");
  const prefixIndex = prefixBits ? parseInt(prefixBits, 2) % fallbackArchetypePrefixes.length : index % fallbackArchetypePrefixes.length;
  const roleIndex = roleBits ? parseInt(roleBits, 2) % fallbackArchetypeRoles.length : index % fallbackArchetypeRoles.length;
  return `${fallbackArchetypePrefixes[prefixIndex]}${fallbackArchetypeRoles[roleIndex]}`;
}

function shouldReplaceArchetypeName(name, pickedLabels = []) {
  const nextName = String(name || "").trim();
  if (!nextName) return true;
  if (/^结果\s*\d+$/i.test(nextName) || /^类型\s*\d+$/i.test(nextName)) return true;
  if (/(左侧|右侧|人格|类型|组合|维度)/.test(nextName)) return true;
  const labelHits = pickedLabels.filter((label) => label && nextName.includes(label)).length;
  return labelHits >= Math.min(2, pickedLabels.length);
}

function reserveArchetypeName(preferredName, fallbackName, usedNames) {
  let candidate = String(preferredName || "").trim();
  if (!candidate || usedNames.has(candidate)) {
    candidate = String(fallbackName || "").trim() || "未命名人格";
  }

  if (!usedNames.has(candidate)) {
    usedNames.add(candidate);
    return candidate;
  }

  let suffix = 2;
  while (usedNames.has(`${candidate}${suffix}`)) {
    suffix += 1;
  }

  const uniqueName = `${candidate}${suffix}`;
  usedNames.add(uniqueName);
  return uniqueName;
}

function synthesizeArchetype({ signatureKey, axes, index, title, resultNoun }) {
  const signatureSides = signatureKey.split("").map((value) => (value === "R" ? "right" : "left"));
  const pickedLabels = axes.map((axis, axisIndex) =>
    signatureSides[axisIndex] === "right" ? axis.right.label : axis.left.label
  );
  const traits = pickedLabels.slice(0, 3);
  const fallbackName = buildFallbackArchetypeName(signatureKey, index);

  return {
    id: `type-${signatureKey.toLowerCase()}`,
    code: buildArchetypeCode(signatureSides, axes),
    name: fallbackName,
    tagline: `${fallbackName}这一型，通常会把 ${pickedLabels.join(" / ")} 这组倾向同时带在身上。`,
    traits,
    lens: "",
    advice: "",
    risk: "",
    examples: [],
    signature: Object.fromEntries(
      axes.map((axis, axisIndex) => [axis.id, signatureSides[axisIndex] === "right" ? "right" : "left"])
    )
  };
}

function normalizeGeneratedSystem(raw) {
  const expectedAxisCount = resolveExpectedAxisCount(raw);
  const expectedTypeCount = resolveExpectedTypeCount(raw, expectedAxisCount);

  const axes = Array.from({ length: expectedAxisCount }, (_, index) => normalizeAxis(raw.axes?.[index], index));
  const questionEntries = Array.isArray(raw.questionsByAxis)
    ? raw.questionsByAxis
    : raw.questionsByAxis && typeof raw.questionsByAxis === "object"
      ? Object.entries(raw.questionsByAxis).map(([axisId, item]) => ({
          axisId,
          ...(item && typeof item === "object" ? item : {})
        }))
      : [];

  const questionMap = new Map(
    questionEntries.map((item, index) => [
      item.axisId || axes[index]?.id,
      {
        left: Array.isArray(item.left) ? item.left.slice(0, 3) : [],
        right: Array.isArray(item.right) ? item.right.slice(0, 3) : []
      }
    ])
  );

  const allSignatureKeys = getAllSignatureKeys(expectedAxisCount, expectedTypeCount);
  const archetypeMap = new Map();
  const usedNames = new Set();

  (raw.archetypes || []).forEach((type, index) => {
    const fallbackSignatureKey = allSignatureKeys[index] || allSignatureKeys[archetypeMap.size] || "L".repeat(expectedAxisCount);
    const signatureSides = resolveSignatureSides(type, axes, fallbackSignatureKey);
    const signatureKey = buildSignatureKey(signatureSides, expectedAxisCount);
    if (!signatureKey || archetypeMap.has(signatureKey)) return;
    const pickedLabels = axes.map((axis, axisIndex) =>
      signatureSides[axisIndex] === "right" ? axis.right.label : axis.left.label
    );
    const fallbackName = buildFallbackArchetypeName(signatureKey, index);
    const nextName = reserveArchetypeName(
      shouldReplaceArchetypeName(type.name, pickedLabels) ? "" : type.name,
      fallbackName,
      usedNames
    );

    archetypeMap.set(signatureKey, {
      id: type.id || `${slugify(nextName || type.code || `type-${index + 1}`)}`,
      code: buildArchetypeCode(signatureSides, axes),
      name: nextName,
      tagline: type.tagline || `${nextName}这型人，通常会把 ${pickedLabels.join(" / ")} 这组特征同时拉到台前。`,
      traits: Array.isArray(type.traits) ? type.traits.slice(0, 3) : [],
      lens: typeof type.lens === "string" ? type.lens.trim() : "",
      advice: typeof type.advice === "string" ? type.advice.trim() : "",
      risk: typeof type.risk === "string" ? type.risk.trim() : "",
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

function mapPatchArchetypesByCode(rawArchetypes = []) {
  return new Map(
    (Array.isArray(rawArchetypes) ? rawArchetypes : [])
      .map((item, index) => [String(item?.code || "").trim() || `index-${index}`, item])
  );
}

function mergeCopyPatch(baseSystem, rawPatch = {}) {
  const base = normalizeGeneratedSystem(baseSystem || {});
  const patchMap = mapPatchArchetypesByCode(rawPatch.archetypes);

  return {
    ...base,
    title: rawPatch.title || base.title,
    intro: rawPatch.intro || base.intro,
    logicTitle: rawPatch.logicTitle || base.logicTitle,
    logicIntro: rawPatch.logicIntro || base.logicIntro,
    resultNoun: rawPatch.resultNoun || base.resultNoun,
    playfulLine: rawPatch.playfulLine || base.playfulLine,
    storyTitle: rawPatch.storyTitle || base.storyTitle,
    matchTitle: rawPatch.matchTitle || base.matchTitle,
    archetypes: base.archetypes.map((type, index) => {
      const patch = patchMap.get(type.code) || patchMap.get(`index-${index}`) || {};
      return {
        ...type,
        name: patch.name || type.name,
        tagline: patch.tagline || type.tagline,
        lens: patch.lens || type.lens,
        advice: patch.advice || type.advice,
        risk: patch.risk || type.risk
      };
    })
  };
}

function mergeExamplesPatch(baseSystem, rawPatch = {}) {
  const base = normalizeGeneratedSystem(baseSystem || {});
  const patchMap = mapPatchArchetypesByCode(rawPatch.archetypes);

  return {
    ...base,
    playfulLine: rawPatch.playfulLine || base.playfulLine,
    storyTitle: rawPatch.storyTitle || base.storyTitle,
    matchTitle: rawPatch.matchTitle || base.matchTitle,
    archetypes: base.archetypes.map((type, index) => {
      const patch = patchMap.get(type.code) || patchMap.get(`index-${index}`) || {};
      return {
        ...type,
        examples: Array.isArray(patch.examples) && patch.examples.length
          ? patch.examples.slice(0, 3)
          : type.examples || []
      };
    })
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

async function requestOpenAIResponses({ model, mode = "full", systemPrompt, userPrompt, reasoningEffort = "low" }) {
  const schema = getSchemaForMode(mode);
  const response = await fetch(`${OPENAI_BASE_URL}/v1/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: reasoningEffort },
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
          schema
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
  const reasoningEffort = "low";

  const tryModels = fallbackModel && fallbackModel !== primaryModel
    ? [primaryModel, fallbackModel]
    : [primaryModel];

  let lastError = null;

  for (const model of tryModels) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const attemptStartedAt = Date.now();
      try {
        const output = await requestFn({ model, mode, systemPrompt, userPrompt, reasoningEffort });
        console.log(
          `[personality-generator] model-ready mode=${mode} model=${model} attempt=${attempt} duration_ms=${Date.now() - attemptStartedAt}`
        );
        return output;
      } catch (error) {
        lastError = error;
        const message = error?.message || "AI generation request failed.";
        const canRetry = isRetryableProviderError(message) && attempt < 3;
        console.warn(
          `[personality-generator] request failed model=${model} attempt=${attempt} mode=${mode} duration_ms=${Date.now() - attemptStartedAt}: ${message}`
        );
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
  const requestStartedAt = Date.now();
  const outputText = await requestModel({ mode, systemPrompt, userPrompt });
  const requestDuration = Date.now() - requestStartedAt;
  const parseStartedAt = Date.now();
  const parsed = await parseModelJson(outputText, mode);
  const parseDuration = Date.now() - parseStartedAt;

  const normalizeStartedAt = Date.now();
  let normalized;
  if (mode === "quick" || mode === "full") {
    normalized = normalizeGeneratedSystem(parsed);
  } else if (mode === "copy") {
    normalized = mergeCopyPatch(input.generatedSystem, parsed);
  } else if (mode === "examples") {
    normalized = mergeExamplesPatch(input.generatedSystem, parsed);
  } else {
    normalized = normalizeGeneratedSystem(parsed);
  }
  const normalizeDuration = Date.now() - normalizeStartedAt;
  console.log(
    `[personality-generator] success mode=${mode} model=${getModelForMode(mode)} axes=${normalized.axes.length} archetypes=${normalized.archetypes.length} duration_ms=${Date.now() - startedAt} request_ms=${requestDuration} parse_ms=${parseDuration} normalize_ms=${normalizeDuration}`
  );
  return normalized;
}
