import React, { useEffect, useMemo, useState } from "react";
import {
  buildGenerated,
  buildResult,
  buildResultNarrative,
  defaultConfig,
  normalizeConfig,
  safeDecode,
  safeEncode,
  scaleLabels,
  shouldRequestGeneratedSystem,
  schools,
  directionCatalog
} from "./personalityDemoData.js";
import { fetchGeneratedPersonalityTest, generatePersonalityTest } from "./api.js";

const SITE_TITLE = "persona.cards";
const GLYPH_KINDS = ["compass", "lantern", "signal"];
const ROOM_STEPS = [
  { id: "foundation", label: "铺主题地基", detail: "先把流派、方向和语境立起来。" },
  { id: "walls", label: "立分型墙面", detail: "把核心维度和类型骨架搭好。" },
  { id: "desk", label: "摆题目桌面", detail: "让每一道题都能落在可回答的情境里。" },
  { id: "rack", label: "挂人格卡架", detail: "每一种类型都有自己的名字和入口。" },
  { id: "light", label: "点亮结果灯", detail: "把可分享的结果页和预览页一起接上。" }
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hashString(value) {
  return Array.from(String(value || "")).reduce((sum, character, index) => (
    (sum * 31 + character.charCodeAt(0) + index) % 2147483647
  ), 7);
}

function getBaseUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function parseRoute(href) {
  const url = new URL(href);
  const resultParam = url.searchParams.get("result");
  if (resultParam) {
    try {
      return { view: "public-result", payload: safeDecode(resultParam) };
    } catch {
      return { view: "builder" };
    }
  }

  const demoParam = url.searchParams.get("demo");
  if (demoParam) {
    try {
      return { view: "test", config: normalizeConfig(safeDecode(demoParam)) };
    } catch {
      return { view: "builder" };
    }
  }

  const demoIdParam = url.searchParams.get("demoId");
  if (demoIdParam) {
    return { view: "test", demoId: demoIdParam };
  }

  return { view: "builder" };
}

function resolveDirectionLabel(configLike) {
  if (!configLike) return "人格";
  if (configLike.customDirection?.trim()) return configLike.customDirection.trim();
  const primaryDirectionId = configLike.directionIds?.[0];
  const primaryDirection = directionCatalog.find((item) => item.id === primaryDirectionId) || directionCatalog[0];
  return primaryDirection?.label || "人格";
}

function buildTestName(configLike) {
  const directionLabel = resolveDirectionLabel(configLike);
  return directionLabel.includes("人格测试") ? directionLabel : `${directionLabel}人格测试`;
}

function buildDocumentTitle(pageTitle) {
  if (!pageTitle) return SITE_TITLE;
  return `${pageTitle} · ${SITE_TITLE}`;
}

function navigateTo(url, replace = false) {
  if (replace) {
    window.history.replaceState({}, "", url);
  } else {
    window.history.pushState({}, "", url);
  }
}

function normalizeCompactTokens(typeCode) {
  if (Array.isArray(typeCode)) {
    return typeCode.map((token) => String(token).trim()).filter(Boolean);
  }

  return String(typeCode || "")
    .split(/[\s\-_/|·]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function splitTypeCodeTokens(typeCode, logicAxes = []) {
  const separatedTokens = normalizeCompactTokens(typeCode);
  if (!logicAxes.length) {
    if (separatedTokens.length > 1) return separatedTokens;
    return String(typeCode || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .split("")
      .filter(Boolean);
  }

  if (separatedTokens.length === logicAxes.length) return separatedTokens;

  const compactCode = Array.isArray(typeCode)
    ? typeCode.join("")
    : String(typeCode || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!compactCode) return [];

  const compactTokens = [];
  let cursor = 0;

  for (const axis of logicAxes) {
    const options = [axis.leftCode, axis.rightCode]
      .filter(Boolean)
      .map((token) => String(token).toUpperCase())
      .sort((left, right) => right.length - left.length);
    const matched = options.find((option) => compactCode.slice(cursor).startsWith(option));
    if (!matched) return [];
    compactTokens.push(matched);
    cursor += matched.length;
  }

  return cursor === compactCode.length ? compactTokens : [];
}

function buildTypeCodeLegend(typeCode, logicAxes = []) {
  if (!typeCode || !logicAxes.length) return [];
  const tokens = splitTypeCodeTokens(typeCode, logicAxes);
  if (tokens.length !== logicAxes.length) return [];

  return logicAxes.map((axis, index) => {
    const token = String(tokens[index] || "").toUpperCase();

    if (token === String(axis.leftCode || "").toUpperCase()) {
      return {
        code: axis.leftCode,
        label: axis.left,
        description: axis.leftDescription,
        side: "left"
      };
    }

    if (token === String(axis.rightCode || "").toUpperCase()) {
      return {
        code: axis.rightCode,
        label: axis.right,
        description: axis.rightDescription,
        side: "right"
      };
    }

    return null;
  }).filter(Boolean);
}

function buildCardStats(typeCode, logicAxes = []) {
  const legend = buildTypeCodeLegend(typeCode, logicAxes);
  const tokens = legend.length
    ? legend.map((item) => item.code)
    : splitTypeCodeTokens(typeCode, logicAxes);

  return tokens.slice(0, 5).map((token, index) => ({
    label: token,
    value: 54 + ((hashString(`${token}-${index}-${typeCode}`) + index * 11) % 34)
  }));
}

function buildRarity(seed) {
  const score = hashString(seed) % 10;
  if (score < 2) return "RARE";
  if (score < 5) return "UNCOMMON";
  return "COMMON";
}

function getGlyphKind(seed) {
  return GLYPH_KINDS[hashString(seed) % GLYPH_KINDS.length];
}

function getExpectedPreviewTimeMs(configLike) {
  const typeCount = Number(configLike?.typeCount) || 16;
  const questionCount = Number(configLike?.questionCount) || 20;
  const typeWeight = { 4: 14000, 8: 22000, 16: 42000, 32: 70000 };
  const questionOffset = Math.max(0, questionCount - 12) * 600;
  return (typeWeight[typeCount] || 42000) + questionOffset;
}

function getExpectedCompletionTimeMs(configLike) {
  const typeCount = Number(configLike?.typeCount) || 16;
  const questionCount = Number(configLike?.questionCount) || 20;
  const typeWeight = { 4: 42000, 8: 70000, 16: 140000, 32: 220000 };
  const questionOffset = Math.max(0, questionCount - 12) * 1200;
  return (typeWeight[typeCount] || 140000) + questionOffset;
}

function formatWaitLabel(elapsedMs) {
  const totalSeconds = Math.max(1, Math.round(elapsedMs / 1000));
  if (totalSeconds < 60) return `已等待 ${totalSeconds} 秒`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `已等待 ${minutes} 分 ${seconds} 秒`;
}

function formatExpectedLabel(expectedMs) {
  const totalSeconds = Math.round(expectedMs / 1000);
  if (totalSeconds < 60) return `约 ${totalSeconds} 秒`;
  const minutes = Math.round(totalSeconds / 60);
  return `约 ${minutes} 分钟`;
}

function getDraftingSummaryLabel(stage) {
  if (stage === "examples") return "案例内容补齐中";
  if (stage === "retrying") return "结果卡正在重试补齐";
  return "结果文案补齐中";
}

function getDraftingNote(stage, configLike) {
  if (stage === "examples") {
    return {
      title: "可预览版已经出来了。",
      body: `测试题和结果主文案已经可用，人物案例还在继续补齐，完整版${formatExpectedLabel(getExpectedCompletionTimeMs(configLike) * 0.35)}。`
    };
  }

  return {
    title: "测试现在就能预览和分享。",
    body: `结果页的细化文案仍在后台补齐，完整版${formatExpectedLabel(getExpectedCompletionTimeMs(configLike))}。`
  };
}

function getGeneratedSubcopy(status, stage, configLike) {
  if (status !== "drafting" && status !== "retrying") {
    return "现在就能把这套测试发出去，也能先检查所有人格卡、题目和结果框架。";
  }

  if (stage === "examples") {
    return `先发先用没问题，案例和分享表达还在继续补齐，完整版${formatExpectedLabel(getExpectedCompletionTimeMs(configLike) * 0.35)}。`;
  }

  return `测试和结果骨架已经可用，后台仍在补完整结果卡文案，完整版${formatExpectedLabel(getExpectedCompletionTimeMs(configLike))}。`;
}

function buildGenerationPreviewContent(configLike) {
  const directionLabel = resolveDirectionLabel(configLike).replace(/人格测试$/, "");

  if (directionLabel.includes("职场")) {
    return {
      question: "当协作里出现分歧时，你更像先稳住场面，还是先拉回目标？",
      resultName: "稳场协作者",
      resultDescription: "既能接住现场气氛，也能把讨论慢慢带回真正要解决的问题。"
    };
  }

  if (directionLabel.includes("关系")) {
    return {
      question: "关系里出现误会时，你更像先安抚情绪，还是先把话说清楚？",
      resultName: "关系点灯人",
      resultDescription: "很会找到对话里的转折点，让尴尬的场面重新亮起来。"
    };
  }

  if (directionLabel.includes("情绪")) {
    return {
      question: "情绪上头的时候，你更像先把感受说出来，还是先把自己稳住？",
      resultName: "情绪翻译者",
      resultDescription: "能把模糊的心情说清楚，也能帮别人看见真正卡住的地方。"
    };
  }

  return {
    question: `在${directionLabel || "这个主题"}里，别人最容易因你身上的哪种反应记住你？`,
    resultName: "共情控场者",
    resultDescription: "很会接人、稳住场面，也让别人愿意继续把话说下去。"
  };
}

function buildBuilderPreview(configLike) {
  const school = schools.find((item) => item.id === configLike?.schoolId) || schools[0];
  const preview = buildGenerationPreviewContent(configLike);
  const typeCount = Number(configLike?.typeCount) || 16;
  const code = typeCount >= 32 ? "EACSV" : typeCount >= 16 ? "EACS" : typeCount >= 8 ? "EAC" : "EA";

  return {
    code,
    name: preview.resultName,
    tagline: preview.resultDescription,
    question: preview.question,
    school: school.short,
    footerLeft: `${resolveDirectionLabel(configLike)}人格测试`,
    footerRight: `${typeCount} 张 · ${Number(configLike?.questionCount) || 20} 题`,
    rarity: "RARE"
  };
}

function buildLoadingLogs(configLike) {
  const school = schools.find((item) => item.id === configLike?.schoolId) || schools[0];
  const direction = resolveDirectionLabel(configLike).replace(/人格测试$/, "");
  const typeCount = Number(configLike?.typeCount) || 16;
  const questionCount = Number(configLike?.questionCount) || 20;

  return [
    `[00:01] init schema=${school.short} theme=${direction || "通用"} types=${typeCount} q=${questionCount}`,
    `[00:04] axes generated ............ OK (${Math.min(5, Math.max(2, Math.log2(typeCount)))})`,
    `[00:09] minting card #01 ......... "${buildGenerationPreviewContent(configLike).resultName}"`,
    `[00:14] drafting questions ....... ${Math.min(questionCount, Math.max(4, Math.round(questionCount * 0.55)))}/${questionCount}`,
    `[00:19] writing result copy ...... ready for preview`,
    `[00:24] sync share + preview ...... linked`
  ];
}

function buildAxisBreakdown(generated, result, primaryType = null) {
  return generated.axes.map((axis) => {
    const leftCode = axis.left.code || "";
    const leftLabel = axis.left.label || axis.left.name || "左侧";
    const leftDescription = axis.left.description || axis.left.summary || "";
    const rightCode = axis.right.code || "";
    const rightLabel = axis.right.label || axis.right.name || "右侧";
    const rightDescription = axis.right.description || axis.right.summary || "";
    const questionCount = generated.questions.filter((question) => question.axisId === axis.id).length;
    const maxScore = Math.max(1, questionCount * 2);
    const rawScore = result.axisScores[axis.id] || 0;
    const preferredSide = primaryType?.signature?.[axis.id] || "right";
    const resolvedSide = Math.abs(rawScore) < 0.05 ? preferredSide : rawScore >= 0 ? "right" : "left";
    const selectedCode = resolvedSide === "right" ? rightCode : leftCode;
    const selectedLabel = resolvedSide === "right" ? rightLabel : leftLabel;
    const selectedDescription = resolvedSide === "right" ? rightDescription : leftDescription;
    const position = clamp(50 + (rawScore / maxScore) * 50, 8, 92);

    return {
      id: axis.id,
      label: axis.label,
      leftCode,
      left: leftLabel,
      leftDescription,
      rightCode,
      right: rightLabel,
      rightDescription,
      selectedCode,
      selectedLabel,
      selectedDescription,
      position
    };
  });
}

function buildAxisBreakdownFromPayload(typeCode, logicAxes = []) {
  const legend = buildTypeCodeLegend(typeCode, logicAxes);

  return logicAxes.map((axis, index) => {
    const current = legend[index];
    const resolvedSide = current?.side || "left";
    const selectedCode = current?.code || (resolvedSide === "right" ? axis.rightCode : axis.leftCode);
    const selectedLabel = current?.label || (resolvedSide === "right" ? axis.right : axis.left);
    const selectedDescription = current?.description || (resolvedSide === "right" ? axis.rightDescription : axis.leftDescription);

    return {
      id: axis.id || `axis-${index}`,
      label: axis.label,
      leftCode: axis.leftCode,
      left: axis.left,
      leftDescription: axis.leftDescription,
      rightCode: axis.rightCode,
      right: axis.right,
      rightDescription: axis.rightDescription,
      selectedCode,
      selectedLabel,
      selectedDescription,
      position: resolvedSide === "right" ? 70 : 30
    };
  });
}

function AppMark({ subtle = false }) {
  return (
    <div className="app-mark">
      <span className={`app-mark-orb${subtle ? " subtle" : ""}`} />
      <div className="app-mark-copy">
        <strong>persona.cards</strong>
        {!subtle ? <span>会被转发的人格卡</span> : null}
      </div>
    </div>
  );
}

function Pill({ tone = "paper", children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function ActionButton({ kind = "primary", className = "", ...props }) {
  return <button type="button" className={`action-button action-${kind} ${className}`.trim()} {...props} />;
}

function CreatorTopbar({ stage, onGoHome }) {
  const steps = [
    { id: "builder", label: "选择内容" },
    { id: "generating", label: "生成" },
    { id: "preview", label: "预览与分享" }
  ];
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === stage));

  return (
    <header className="topbar topbar-creator">
      <button type="button" className="brand-button" onClick={onGoHome}>
        <AppMark subtle />
      </button>
      <div className="stepper">
        {steps.map((step, index) => {
          const status = index < currentIndex ? "done" : index === currentIndex ? "active" : "pending";
          return (
            <div key={step.id} className={`stepper-item ${status}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step.label}</strong>
            </div>
          );
        })}
      </div>
      <Pill tone="ink">在线运行</Pill>
    </header>
  );
}

function TakerTopbar({ stage, progress = 0, onGoHome }) {
  const stageLabel = stage === "result" ? "你的结果" : stage === "share" ? "分享结果" : "答题中";

  return (
    <header className="topbar topbar-taker">
      <button type="button" className="brand-button" onClick={onGoHome}>
        <AppMark subtle />
      </button>
      <div className="taker-progress">
        <div className="taker-progress-meta">
          <span>{stageLabel}</span>
          <b>{Math.round(progress)}%</b>
        </div>
        <div className="taker-progress-rail">
          <i style={{ width: `${clamp(progress, 0, 100)}%` }} />
        </div>
      </div>
    </header>
  );
}

function PersonaGlyph({ kind = "compass" }) {
  if (kind === "lantern") {
    return (
      <svg viewBox="0 0 100 100" className="persona-glyph" aria-hidden="true">
        <circle cx="50" cy="50" r="31" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="50" cy="50" r="21" fill="var(--accent-soft)" />
        <circle cx="50" cy="50" r="13" fill="var(--accent-strong)" />
        <path d="M 50 10 L 50 22 M 50 78 L 50 90 M 10 50 L 22 50 M 78 50 L 90 50" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }

  if (kind === "signal") {
    return (
      <svg viewBox="0 0 100 100" className="persona-glyph" aria-hidden="true">
        <rect x="28" y="56" width="8" height="24" fill="currentColor" />
        <rect x="41" y="42" width="8" height="38" fill="currentColor" />
        <rect x="54" y="26" width="8" height="54" fill="var(--accent-strong)" />
        <rect x="67" y="14" width="8" height="66" fill="currentColor" />
        <circle cx="18" cy="22" r="4" fill="var(--accent-strong)" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 100" className="persona-glyph" aria-hidden="true">
      <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" />
      <circle cx="50" cy="50" r="29" fill="currentColor" />
      <circle cx="50" cy="50" r="21" fill="none" stroke="var(--accent-strong)" strokeWidth="2" />
      <circle cx="50" cy="50" r="6" fill="var(--accent-strong)" />
      <path d="M 50 9 L 52 18 L 48 18 Z" fill="currentColor" />
    </svg>
  );
}

function PersonaCard({
  code,
  logicAxes = [],
  name,
  tagline,
  schoolLabel,
  rarity = "COMMON",
  footerLeft,
  footerRight,
  glyph,
  rotate = 0,
  scale = 1,
  highlightIndex,
  stats,
  skeleton = false
}) {
  const tokens = splitTypeCodeTokens(code, logicAxes);
  const cardStats = stats?.length ? stats : buildCardStats(code, logicAxes);
  const activeIndex = highlightIndex ?? Math.max(0, tokens.length - 1);
  const style = {
    transform: `rotate(${rotate}deg) scale(${scale})`
  };

  return (
    <div className="persona-card-shell" style={style}>
      <article className={`persona-card${skeleton ? " skeleton" : ""}`}>
        <header className="persona-card-head">
          <span>{schoolLabel || "persona.cards"}</span>
          <b>{rarity}</b>
        </header>

        <div className="persona-illustration">
          <PersonaGlyph kind={glyph} />
        </div>

        <div className="persona-code-row">
          {tokens.map((token, index) => (
            <span key={`${token}-${index}`} className={index === activeIndex ? "active" : ""}>
              {token}
            </span>
          ))}
        </div>

        {skeleton ? (
          <div className="persona-skeleton-copy">
            <i />
            <i />
          </div>
        ) : (
          <div className="persona-copy">
            <h3>{name}</h3>
            <p>{tagline}</p>
          </div>
        )}

        <div className="persona-stats">
          {cardStats.map((item) => (
            <div key={`${item.label}-${item.value}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        <footer className="persona-card-foot">
          <span>{footerLeft}</span>
          <span>{footerRight}</span>
        </footer>
      </article>
    </div>
  );
}

function MiniTypeCard({ type, logicAxes, active, onClick, index, total }) {
  const tokens = splitTypeCodeTokens(type.code, logicAxes);

  return (
    <button type="button" className={`mini-type-card${active ? " active" : ""}`} onClick={onClick}>
      <div className="mini-type-meta">
        <span>{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        <b>{buildRarity(type.name)}</b>
      </div>
      <div className="mini-type-code">
        {tokens.map((token, tokenIndex) => (
          <span key={`${token}-${tokenIndex}`}>{token}</span>
        ))}
      </div>
      <strong>{type.name}</strong>
      <p>{type.tagline}</p>
    </button>
  );
}

function AxisCodeGuide({ logicAxes = [], title, description }) {
  if (!logicAxes.length) return null;

  return (
    <section className="guide-card">
      <div className="section-head">
        <div>
          <span className="micro-label">{title}</span>
          <h3>每一个字母都对应一条清晰维度</h3>
        </div>
        <p>{description}</p>
      </div>

      <div className="axis-guide-grid">
        {logicAxes.map((axis) => (
          <article key={axis.id} className="axis-guide-card">
            <strong>{axis.label}</strong>
            <div className="axis-guide-row">
              <div>
                <span>{axis.leftCode}</span>
                <b>{axis.left}</b>
                <p>{axis.leftDescription}</p>
              </div>
              <div>
                <span>{axis.rightCode}</span>
                <b>{axis.right}</b>
                <p>{axis.rightDescription}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AxisSpectrumCard({ axis }) {
  return (
    <article className="axis-spectrum-card">
      <div className="axis-spectrum-head">
        <div>
          <span>{axis.label}</span>
          <strong>{axis.selectedLabel}</strong>
        </div>
        {axis.selectedCode ? <b>{axis.selectedCode}</b> : null}
      </div>
      <p>{axis.selectedDescription}</p>
      <div className="axis-spectrum-track">
        <i style={{ left: `${axis.position}%` }} />
      </div>
      <div className="axis-spectrum-meta">
        <span>{axis.leftCode} · {axis.left}</span>
        <span>{axis.rightCode} · {axis.right}</span>
      </div>
    </article>
  );
}

function NarrativeCard({ index, title, body }) {
  return (
    <article className="narrative-card">
      <div className="narrative-card-head">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <strong>{title}</strong>
      </div>
      <p>{body}</p>
    </article>
  );
}

function StoryCard({ item }) {
  return (
    <article className="story-card">
      <strong>{item.name}</strong>
      <p>{item.why}</p>
      <span>{item.story}</span>
    </article>
  );
}

function LoadingRoomScene({ revealCount }) {
  return (
    <div className="room-scene">
      <div className={`room-piece room-floor${revealCount >= 1 ? " ready" : ""}`} />
      <div className={`room-piece room-wall left${revealCount >= 2 ? " ready" : ""}`} />
      <div className={`room-piece room-wall right${revealCount >= 2 ? " ready" : ""}`} />
      <div className={`room-piece room-desk${revealCount >= 3 ? " ready" : ""}`} />
      <div className={`room-piece room-rack${revealCount >= 4 ? " ready" : ""}`} />
      <div className={`room-piece room-lamp${revealCount >= 5 ? " ready" : ""}`} />
      <div className={`room-piece room-card card-a${revealCount >= 4 ? " ready" : ""}`} />
      <div className={`room-piece room-card card-b${revealCount >= 4 ? " ready" : ""}`} />
      <div className={`room-piece room-card card-c${revealCount >= 5 ? " ready" : ""}`} />
    </div>
  );
}

function GenerationStudio({ testName, configLike }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const previewCard = useMemo(() => buildBuilderPreview(configLike), [configLike]);
  const cliLogs = useMemo(() => buildLoadingLogs(configLike), [configLike]);
  const expectedPreviewTimeMs = getExpectedPreviewTimeMs(configLike);
  const expectedCompletionTimeMs = getExpectedCompletionTimeMs(configLike);
  const normalized = clamp(elapsedMs / Math.max(expectedPreviewTimeMs, 1), 0, 1.4);
  const revealCount = clamp(Math.floor(normalized * ROOM_STEPS.length) + 1, 1, ROOM_STEPS.length);
  const visibleLogCount = clamp(Math.floor(normalized * cliLogs.length) + 1, 1, cliLogs.length);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 400);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="glass-panel studio-panel">
      <div className="section-head">
        <div>
          <span className="micro-label">拼搭房间 · loading</span>
          <h2>正在搭出「{testName}」的生成空间</h2>
        </div>
      </div>

      <div className="studio-grid">
        <div className="studio-copy">
          <div className="status-row">
            <Pill tone="violet">可预览版 {formatExpectedLabel(expectedPreviewTimeMs)}</Pill>
            <Pill tone="paper">完整版 {formatExpectedLabel(expectedCompletionTimeMs)}</Pill>
          </div>

          <div className="studio-step-list">
            {ROOM_STEPS.map((step, index) => {
              const status = index + 1 < revealCount ? "done" : index + 1 === revealCount ? "active" : "pending";
              return (
                <article key={step.id} className={`studio-step ${status}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{step.label}</strong>
                    <p>{step.detail}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="terminal-panel" aria-label="生成日志">
            <div className="terminal-head">
              <span>stream · stdout</span>
              <b>{schoolLabelForTerminal(configLike)}</b>
            </div>
            <div className="terminal-body">
              {cliLogs.slice(0, visibleLogCount).map((line) => (
                <div key={line} className="terminal-line">{line}</div>
              ))}
              <div className="terminal-cursor-line">
                <span>&gt;</span>
                <i />
              </div>
            </div>
          </div>

          <div className="studio-meta">
            <span>{formatWaitLabel(elapsedMs)}</span>
            <span>已完成 {revealCount} / {ROOM_STEPS.length} 个部件</span>
          </div>
        </div>

        <div className="studio-scene">
          <LoadingRoomScene revealCount={revealCount} />
          <div className="studio-card-preview">
            <PersonaCard
              code={previewCard.code}
              name={previewCard.name}
              tagline={previewCard.tagline}
              schoolLabel={previewCard.school}
              rarity={previewCard.rarity}
              footerLeft={previewCard.footerLeft}
              footerRight={previewCard.footerRight}
              glyph={getGlyphKind(previewCard.name)}
              stats={buildCardStats(previewCard.code)}
              skeleton={revealCount < 4}
              rotate={-4}
              scale={0.92}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function GeneratedHub({
  generated,
  generatedTestName,
  generationStatus,
  generationStage,
  retryCount,
  copyLabel,
  onCopyLink,
  onOpenTest,
  onRetry,
  isRetrying
}) {
  const [tab, setTab] = useState("cards");
  const [selectedTypeId, setSelectedTypeId] = useState(generated.types[0]?.id || "");
  const selectedType = generated.types.find((type) => type.id === selectedTypeId) || generated.types[0];
  const selectedLegend = useMemo(
    () => buildTypeCodeLegend(selectedType?.code, generated.logicAxes),
    [generated.logicAxes, selectedType]
  );
  const selectedStats = useMemo(
    () => buildCardStats(selectedType?.code, generated.logicAxes),
    [generated.logicAxes, selectedType]
  );

  useEffect(() => {
    setSelectedTypeId(generated.types[0]?.id || "");
  }, [generated.types]);

  const summaryTone = generationStatus === "failed"
    ? "danger"
    : generationStatus === "drafting" || generationStatus === "retrying"
      ? "info"
      : "success";
  const summaryNote = generationStatus === "failed"
    ? {
        title: "结果卡补全暂时卡住了。",
        body: `基础测试仍然可用。系统已经自动重试 ${retryCount} 次，你也可以手动再补一次。`
      }
    : generationStatus === "drafting" || generationStatus === "retrying"
      ? getDraftingNote(generationStage, generated.config)
      : {
          title: "整套测试已经完整就绪。",
          body: "题目、人格卡、分型维度和分享入口都已经连上，可以直接预览和传播。"
        };

  return (
    <section className="glass-panel ready-panel">
      <div className="ready-hero">
        <div>
          <Pill tone="orange">测试已就绪</Pill>
          <h2>你的「{generatedTestName}」已经铸造完成</h2>
          <p>{getGeneratedSubcopy(generationStatus, generationStage, generated.config)}</p>
        </div>
        <div className="action-cluster">
          <ActionButton kind="secondary" onClick={() => onOpenTest(generated.shareLink)}>预览测试</ActionButton>
          <ActionButton kind="accent" onClick={() => onCopyLink(generated.shareLink)}>
            {copyLabel === "复制测试入口" ? "分享测试" : copyLabel}
          </ActionButton>
          {generationStatus === "failed" ? (
            <ActionButton kind="ghost" onClick={onRetry} disabled={isRetrying}>
              {isRetrying ? "正在补全..." : "重新补全结果卡"}
            </ActionButton>
          ) : null}
        </div>
      </div>

      <div className="summary-strip">
        <span>{generated.types.length} 张人格卡</span>
        <span>{generated.questions.length} 道题</span>
        <span>
          {generationStatus === "ready"
            ? "完整版已就绪"
            : generationStatus === "failed"
              ? "结果卡待补全"
              : getDraftingSummaryLabel(generationStage)}
        </span>
      </div>

      <div className={`inline-note ${summaryTone}`}>
        <strong>{summaryNote.title}</strong>
        <span>{summaryNote.body}</span>
      </div>

      <div className="share-link-card">
        <div className="share-link-orb" />
        <div>
          <span className="micro-label">测试入口</span>
          <strong>{generated.shareLink.replace(/^https?:\/\//, "")}</strong>
          <p>任何人打开这个链接就能开始答题，结果页只展示结果，不回显作答过程和创建参数。</p>
        </div>
      </div>

      <div className="tab-row">
        {[
          { id: "cards", label: `${generated.types.length} 张人格卡` },
          { id: "questions", label: "题目预览" },
          { id: "axes", label: "分型维度" }
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tab-button${tab === item.id ? " active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "cards" ? (
        <div className="cards-preview-grid">
          <div className="mini-grid">
            {generated.types.map((type, index) => (
              <MiniTypeCard
                key={type.id}
                type={type}
                logicAxes={generated.logicAxes}
                active={selectedType.id === type.id}
                onClick={() => setSelectedTypeId(type.id)}
                index={index}
                total={generated.types.length}
              />
            ))}
          </div>

          <aside className="detail-column">
            <div className="detail-card-stage">
              <PersonaCard
                code={selectedType.code}
                logicAxes={generated.logicAxes}
                name={selectedType.name}
                tagline={selectedType.tagline}
                schoolLabel={generated.school.short}
                rarity={buildRarity(selectedType.name)}
                footerLeft={generatedTestName}
                footerRight={selectedType.code}
                glyph={getGlyphKind(selectedType.name)}
                stats={selectedStats}
                rotate={-2}
                scale={0.92}
              />
            </div>

            <div className="detail-copy">
              <div className="detail-chip-row">
                {selectedLegend.map((item) => (
                  <span key={`${item.code}-${item.label}`}>
                    <strong>{item.code}</strong>
                    {item.label}
                  </span>
                ))}
              </div>

              <div className="detail-copy-block">
                <span className="micro-label">一句话</span>
                <p>{selectedType.tagline}</p>
              </div>

              <div className="detail-copy-block">
                <span className="micro-label">怎么理解它</span>
                <p>{selectedType.lens || selectedType.core}</p>
              </div>

              <div className="detail-copy-block">
                <span className="micro-label">适合怎么写结果页</span>
                <p>{selectedType.advice || selectedType.risk}</p>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {tab === "questions" ? (
        <div className="question-preview-grid">
          {generated.questions.map((question, index) => (
            <article key={question.id} className="question-preview-card">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{question.label}</strong>
              <p>{question.axisLabel}</p>
            </article>
          ))}
        </div>
      ) : null}

      {tab === "axes" ? (
        <div className="axes-tab">
          <div className="axis-guide-grid">
            {generated.logicAxes.map((axis) => (
              <article key={axis.id} className="axis-guide-card">
                <strong>{axis.label}</strong>
                <div className="axis-guide-row">
                  <div>
                    <span>{axis.leftCode}</span>
                    <b>{axis.left}</b>
                    <p>{axis.leftDescription}</p>
                  </div>
                  <div>
                    <span>{axis.rightCode}</span>
                    <b>{axis.right}</b>
                    <p>{axis.rightDescription}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <AxisCodeGuide
            logicAxes={generated.logicAxes}
            title="字母缩写怎么读"
            description="框架页和结果页都会同步展示这份说明，避免只剩字母黑话。"
          />
        </div>
      ) : null}
    </section>
  );
}

function BuilderPage({ config, setConfig, copyState, onCopyLink, onOpenTest, onGoHome }) {
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [generatedDemoId, setGeneratedDemoId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationStatus, setGenerationStatus] = useState("idle");
  const [generationStage, setGenerationStage] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const generated = useMemo(
    () => buildGenerated(generatedConfig || config, getBaseUrl(), generatedDemoId ? { demoId: generatedDemoId } : {}),
    [config, generatedConfig, generatedDemoId]
  );
  const builderPreview = useMemo(() => buildBuilderPreview(config), [config]);
  const draftTestName = useMemo(() => buildTestName(config), [config]);
  const generatedTestName = useMemo(() => buildTestName(generatedConfig || config), [config, generatedConfig]);
  const copyLabel = copyState === "success" ? "已复制" : copyState === "error" ? "复制失败" : "复制测试入口";
  const stage = generatedConfig || generatedDemoId ? "preview" : isGenerating ? "generating" : "builder";

  useEffect(() => {
    document.title = buildDocumentTitle(generatedConfig || generatedDemoId ? generatedTestName : "生成可分享人格测试");
  }, [generatedConfig, generatedDemoId, generatedTestName]);

  useEffect(() => {
    setGeneratedConfig(null);
    setGeneratedDemoId("");
    setGenerationError("");
    setGenerationStatus("idle");
    setGenerationStage("");
    setRetryCount(0);
    setIsRetrying(false);
  }, [config]);

  useEffect(() => {
    if (!generatedDemoId || generationStatus !== "drafting") return undefined;

    let cancelled = false;
    const poll = async () => {
      try {
        const data = await fetchGeneratedPersonalityTest(generatedDemoId);
        if (cancelled) return;
        setGeneratedConfig(normalizeConfig({ ...data.config, generatedSystem: data.generatedSystem }));
        setGenerationStatus(data.generationStatus || "ready");
        setGenerationStage(data.generationStage || "ready");
        if (data.generationStatus === "failed" && data.generationError) {
          setGenerationError(data.generationError);
        }
      } catch {
        if (!cancelled) {
          setGenerationError((current) => current || "结果卡补全时断了一下，稍后刷新看看。");
        }
      }
    };

    poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [generatedDemoId, generationStatus]);

  function updateConfig(nextPartial) {
    setConfig((current) => ({ ...current, ...nextPartial }));
  }

  function selectDirection(directionId) {
    setConfig((current) => ({
      ...current,
      directionIds: [directionId],
      customDirection: ""
    }));
  }

  async function runGeneration(sourceConfig, options = {}) {
    const { retrying = false } = options;
    setIsGenerating(true);
    setIsRetrying(retrying);
    setGenerationError("");
    setGenerationStatus(retrying ? "retrying" : "drafting");
    setGenerationStage(retrying ? "retrying" : "skeleton");
    const nextConfig = normalizeConfig(sourceConfig);

    try {
      if (shouldRequestGeneratedSystem(nextConfig)) {
        const data = await generatePersonalityTest(nextConfig);
        setGeneratedConfig(
          normalizeConfig({
            ...nextConfig,
            generatedSystem: data.generatedSystem
          })
        );
        setGeneratedDemoId(data.id || "");
        setGenerationStatus(data.generationStatus || "drafting");
        setGenerationStage(data.generationStage || "skeleton");
      } else {
        setGeneratedConfig(nextConfig);
        setGeneratedDemoId("");
        setGenerationStatus("ready");
        setGenerationStage("ready");
      }
    } catch (error) {
      setGenerationStatus("failed");
      setGenerationError(error.message || "生成失败，请稍后再试。");
    } finally {
      setIsGenerating(false);
      setIsRetrying(false);
    }
  }

  async function handleGenerate() {
    setRetryCount(0);
    await runGeneration(config);
  }

  async function handleRetry() {
    setRetryCount(0);
    await runGeneration(generatedConfig || config, { retrying: true });
  }

  useEffect(() => {
    if (generationStatus !== "failed" || isGenerating || retryCount >= 2) return undefined;

    const timer = window.setTimeout(() => {
      setRetryCount((current) => current + 1);
      runGeneration(generatedConfig || config, { retrying: true });
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [config, generatedConfig, generationStatus, isGenerating, retryCount]);

  return (
    <div className="aurora-shell">
      <CreatorTopbar stage={stage} onGoHome={onGoHome} />

      <main className="page-shell">
        <section className="hero-copy">
          <Pill tone="violet">测试生成器 · beta</Pill>
          <h1>把一个主题，变成一套会被转发的人格卡。</h1>
          <p>
            选一个主题和心理学流派，我们会把它生成成一套可以直接预览、分享和传播的人格测试。
          </p>
        </section>

        <section className="builder-layout">
          <section className="glass-panel builder-form">
            <div className="section-head">
              <div>
                <span className="micro-label">01 · 选择内容</span>
                <h2>先把这套测试的语境定下来</h2>
              </div>
            </div>

            <div className="field-group">
              <label>心理流派</label>
              <div className="choice-grid">
                {schools.map((school) => (
                  <button
                    key={school.id}
                    type="button"
                    className={`choice-card${config.schoolId === school.id ? " active" : ""}`}
                    onClick={() => updateConfig({ schoolId: school.id })}
                  >
                    <strong>{school.label}</strong>
                    <span>{school.pitch}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <label>方向主题</label>
              <div className="chip-row">
                {directionCatalog.map((direction) => (
                  <button
                    key={direction.id}
                    type="button"
                    className={`theme-chip${config.directionIds.includes(direction.id) ? " active" : ""}`}
                    onClick={() => selectDirection(direction.id)}
                  >
                    {direction.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="customDirection">自定义主题</label>
              <input
                id="customDirection"
                type="text"
                value={config.customDirection}
                placeholder="比如：播客、品牌咨询、脱口秀"
                onChange={(event) => {
                  const nextValue = event.target.value;
                  updateConfig({
                    customDirection: nextValue,
                    directionIds: nextValue.trim()
                      ? []
                      : (config.directionIds.length ? config.directionIds.slice(0, 1) : ["work"])
                  });
                }}
              />
            </div>

            <div className="parameter-grid">
              <div className="parameter-card">
                <label>人格卡数量</label>
                <div className="segmented-row">
                  {[4, 8, 16, 32].map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={`segment-button${config.typeCount === count ? " active" : ""}`}
                      onClick={() => updateConfig({ typeCount: count })}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <div className="parameter-card">
                <label>题目数量</label>
                <div className="segmented-row">
                  {[12, 20, 32, 40].map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={`segment-button${config.questionCount === count ? " active" : ""}`}
                      onClick={() => updateConfig({ questionCount: count })}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="builder-actions">
              <ActionButton kind="accent" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? "正在生成..." : "开始生成"}
              </ActionButton>
              <span>{formatExpectedLabel(getExpectedPreviewTimeMs(config))} 可预览版 · {formatExpectedLabel(getExpectedCompletionTimeMs(config))} 完整版</span>
            </div>

            {generationError && !generatedConfig ? (
              <div className="inline-note danger">
                <strong>生成时断了一下。</strong>
                <span>{generationError}</span>
              </div>
            ) : null}
          </section>

          <aside className="builder-preview">
            <span className="micro-label">// 预览：这套测试会长这样</span>
            <PersonaCard
              code={builderPreview.code}
              name={builderPreview.name}
              tagline={builderPreview.tagline}
              schoolLabel={builderPreview.school}
              rarity={builderPreview.rarity}
              footerLeft={builderPreview.footerLeft}
              footerRight={builderPreview.footerRight}
              glyph={getGlyphKind(builderPreview.name)}
              stats={buildCardStats(builderPreview.code)}
              rotate={-4}
              scale={0.98}
            />
          </aside>
        </section>

        {isGenerating ? (
          <GenerationStudio testName={draftTestName} configLike={config} />
        ) : null}

        {generatedConfig || generatedDemoId ? (
          <GeneratedHub
            generated={generated}
            generatedTestName={generatedTestName}
            generationStatus={generationStatus}
            generationStage={generationStage}
            retryCount={retryCount}
            copyLabel={copyLabel}
            onCopyLink={onCopyLink}
            onOpenTest={onOpenTest}
            onRetry={handleRetry}
            isRetrying={isRetrying || isGenerating}
          />
        ) : null}
      </main>
    </div>
  );
}

function StatusScene({ title, description, actionLabel, onAction, onGoHome }) {
  return (
    <div className="aurora-shell">
      <TakerTopbar stage="test" progress={0} onGoHome={onGoHome} />
      <main className="page-shell">
        <section className="glass-panel status-panel">
          <Pill tone="paper">加载状态</Pill>
          <h1>{title}</h1>
          <p>{description}</p>
          {actionLabel && onAction ? (
            <ActionButton kind="accent" onClick={onAction}>{actionLabel}</ActionButton>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function ResultExperience({
  payload,
  shareHref,
  copyState,
  onCopyLink,
  onSecondaryAction,
  secondaryLabel,
  onGoHome,
  isPublic = false
}) {
  const shareLabel = copyState === "success" ? "已复制" : copyState === "error" ? "复制失败" : "分享结果";
  const axisBreakdown = payload.axisBreakdown?.length
    ? payload.axisBreakdown
    : buildAxisBreakdownFromPayload(payload.type.code, payload.logicAxes || []);
  const narrativeCards = [
    payload.lens ? { title: "你给人的感觉", body: payload.lens } : null,
    payload.advice ? { title: "你更适合的方式", body: payload.advice } : null,
    payload.risk ? { title: "你容易卡住的点", body: payload.risk } : null,
    payload.matchBody ? { title: payload.matchTitle || "更直白一点说", body: payload.matchBody } : null
  ].filter(Boolean);
  const codeLegend = buildTypeCodeLegend(payload.type.code, payload.logicAxes || []);
  const cardStats = buildCardStats(payload.type.code, payload.logicAxes || []);
  const secondaryTone = payload.secondary ? `你身上还带一点「${payload.secondary.name}」的气质。` : payload.footerLine;

  return (
    <div className="aurora-shell">
      <TakerTopbar stage={isPublic ? "share" : "result"} progress={100} onGoHome={onGoHome} />
      <main className="page-shell result-page-shell">
        <section className="result-hero">
          <Pill tone="orange">{isPublic ? "公开结果页" : "结果已生成"}</Pill>
          <h1>{payload.viewerName && payload.viewerName !== "这位测试者" ? `${payload.viewerName} 是「${payload.type.name}」` : `你是「${payload.type.name}」`}</h1>
          <p>{payload.summary}</p>
          {secondaryTone ? <span className="result-footnote">{secondaryTone}</span> : null}
        </section>

        <section className="result-layout">
          <div className="result-card-column">
            <PersonaCard
              code={payload.type.code}
              logicAxes={payload.logicAxes || []}
              name={payload.type.name}
              tagline={payload.tagline || payload.summary}
              schoolLabel={payload.testName}
              rarity={buildRarity(payload.type.name)}
              footerLeft={payload.testName}
              footerRight={payload.type.code}
              glyph={getGlyphKind(payload.type.name)}
              stats={cardStats}
              rotate={-3}
              scale={1}
            />
            <div className="detail-chip-row">
              {codeLegend.map((item) => (
                <span key={`${item.code}-${item.label}`}>
                  <strong>{item.code}</strong>
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="result-copy-column">
            {narrativeCards.map((card, index) => (
              <NarrativeCard key={card.title} index={index} title={card.title} body={card.body} />
            ))}

            <div className="action-cluster">
              <ActionButton kind="accent" onClick={() => onCopyLink(shareHref)}>
                {shareLabel}
              </ActionButton>
              {secondaryLabel && onSecondaryAction ? (
                <ActionButton kind="secondary" onClick={onSecondaryAction}>{secondaryLabel}</ActionButton>
              ) : null}
            </div>
          </div>
        </section>

        <section className="glass-panel result-section">
          <div className="section-head">
            <div>
              <span className="micro-label">字母拆解</span>
              <h2>这张卡为什么是你</h2>
            </div>
          </div>
          <div className="axis-breakdown-grid">
            {axisBreakdown.map((axis) => (
              <AxisSpectrumCard key={axis.id} axis={axis} />
            ))}
          </div>
        </section>

        <section className="glass-panel result-section">
          <div className="section-head">
            <div>
              <span className="micro-label">像哪些人</span>
              <h2>{payload.storyTitle || "你会让人想到谁"}</h2>
            </div>
          </div>
          <div className="story-grid">
            {(payload.examples || []).map((item) => (
              <StoryCard key={item.name} item={item} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function TestPage({ initialConfig = null, demoId = "", copyState, onCopyLink, onGoHome }) {
  const [config, setConfig] = useState(initialConfig);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(demoId && !initialConfig));
  const [participantName, setParticipantName] = useState("");
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!demoId) {
      setConfig(initialConfig);
      setIsLoading(false);
      setLoadError("");
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setLoadError("");
    fetchGeneratedPersonalityTest(demoId)
      .then((data) => {
        if (cancelled) return;
        setConfig(normalizeConfig({ ...data.config, generatedSystem: data.generatedSystem }));
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error.message || "测试加载失败");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [demoId, initialConfig]);

  const generated = useMemo(
    () => (config ? buildGenerated(config, getBaseUrl(), demoId ? { demoId } : {}) : null),
    [config, demoId]
  );
  const testName = useMemo(() => buildTestName(config), [config]);
  const liveResult = useMemo(() => (generated ? buildResult(generated, answers) : null), [generated, answers]);
  const answeredCount = useMemo(
    () => (generated ? generated.questions.filter((question) => answers[question.id]).length : 0),
    [generated, answers]
  );
  const totalQuestions = generated?.questions.length || 0;
  const progressPercent = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const currentQuestion = generated?.questions[currentQuestionIndex] || null;
  const primaryType = liveResult?.primary?.type || null;
  const axisBreakdown = useMemo(
    () => (generated && liveResult && primaryType ? buildAxisBreakdown(generated, liveResult, primaryType) : []),
    [generated, liveResult, primaryType]
  );
  const narrative = useMemo(
    () => (generated && liveResult ? buildResultNarrative(generated, liveResult, participantName.trim() || "这位测试者") : null),
    [generated, liveResult, participantName]
  );

  const resultPayload = showResult && primaryType && narrative
    ? {
        viewerName: participantName.trim() || "这位测试者",
        testName,
        type: primaryType,
        secondary: liveResult.secondary?.type || null,
        headline: narrative.heading,
        summary: narrative.wittySummary,
        tagline: primaryType.tagline,
        lens: narrative.lensBody,
        advice: narrative.adviceBody,
        risk: narrative.riskBody,
        matchTitle: narrative.matchTitle,
        matchBody: narrative.matchBody,
        storyTitle: narrative.storyTitle,
        examples: narrative.examples,
        footerLine: narrative.footerLine,
        logicAxes: generated.logicAxes,
        axisBreakdown
      }
    : null;
  const resultShareLink = resultPayload ? `${getBaseUrl()}?result=${safeEncode(resultPayload)}` : "";

  useEffect(() => {
    if (isLoading) {
      document.title = buildDocumentTitle(`正在加载「${demoId ? "这套人格测试" : buildTestName(initialConfig)}」`);
      return;
    }

    if (loadError || !config) {
      document.title = buildDocumentTitle(`「${testName || "人格测试"}」暂时打不开`);
      return;
    }

    if (showResult && primaryType) {
      document.title = buildDocumentTitle(`「${testName}」结果：${primaryType.name}`);
      return;
    }

    document.title = buildDocumentTitle(`开始做「${testName}」`);
  }, [config, demoId, initialConfig, isLoading, loadError, primaryType, showResult, testName]);

  useEffect(() => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setShowResult(false);
  }, [config]);

  if (isLoading) {
    return (
      <StatusScene
        title={`正在加载「${demoId ? "这套人格测试" : buildTestName(initialConfig)}」`}
        description="题目、人格卡和结果框架正在从线上拉回本地界面。"
        onGoHome={onGoHome}
      />
    );
  }

  if (!config || loadError || !generated) {
    return (
      <StatusScene
        title={`「${testName || "人格测试"}」暂时打不开`}
        description={loadError || "链接可能已失效，或者这套测试还没准备完整。"}
        actionLabel="返回发起页"
        onAction={onGoHome}
        onGoHome={onGoHome}
      />
    );
  }

  function handleAnswer(questionId, value) {
    setShowResult(false);
    setAnswers((current) => ({ ...current, [questionId]: value }));
    if (currentQuestionIndex < totalQuestions - 1) {
      window.setTimeout(() => {
        setCurrentQuestionIndex((current) => Math.min(current + 1, totalQuestions - 1));
      }, 120);
    }
  }

  function revealResult() {
    if (answeredCount !== totalQuestions) {
      window.alert(`还有 ${totalQuestions - answeredCount} 道题没答完，先补齐再看结果。`);
      return;
    }
    setShowResult(true);
  }

  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  const currentAnswered = currentQuestion ? Boolean(answers[currentQuestion.id]) : false;

  if (showResult && resultPayload) {
    return (
      <ResultExperience
        payload={resultPayload}
        shareHref={resultShareLink}
        copyState={copyState}
        onCopyLink={onCopyLink}
        onSecondaryAction={() => setShowResult(false)}
        secondaryLabel="回看题目"
        onGoHome={onGoHome}
      />
    );
  }

  return (
    <div className="aurora-shell">
      <TakerTopbar stage="test" progress={progressPercent} onGoHome={onGoHome} />

      <main className="page-shell">
        <section className="test-layout">
          <section className="glass-panel question-panel">
            <div className="question-panel-head">
              <Pill tone="paper">Q {String(currentQuestionIndex + 1).padStart(2, "0")} / {String(totalQuestions).padStart(2, "0")}</Pill>
              <span>{progressPercent}% 已完成</span>
            </div>

            <h1>{currentQuestion?.label}</h1>
            <p>按直觉回答就好，不需要思考“标准答案”。这套结果会更偏向你真实的反应方式，而不是理想中的自己。</p>

            <div className="scale-grid">
              {scaleLabels.map((scale) => (
                <button
                  key={scale.value}
                  type="button"
                  className={`scale-option${answers[currentQuestion.id] === scale.value ? " active" : ""}`}
                  onClick={() => handleAnswer(currentQuestion.id, scale.value)}
                >
                  <strong>{scale.short}</strong>
                  <span>{scale.text}</span>
                </button>
              ))}
            </div>

            <div className="question-nav">
              <ActionButton
                kind="ghost"
                onClick={() => setCurrentQuestionIndex((current) => Math.max(0, current - 1))}
                disabled={currentQuestionIndex === 0}
              >
                上一题
              </ActionButton>
              {isLastQuestion ? (
                <ActionButton
                  kind="accent"
                  onClick={revealResult}
                  disabled={!currentAnswered}
                >
                  提交并查看结果
                </ActionButton>
              ) : (
                <ActionButton
                  kind="secondary"
                  onClick={() => setCurrentQuestionIndex((current) => Math.min(totalQuestions - 1, current + 1))}
                  disabled={currentQuestionIndex === totalQuestions - 1}
                >
                  下一题
                </ActionButton>
              )}
            </div>

            <div className="question-dots">
              {generated.questions.map((question, index) => (
                <button
                  key={question.id}
                  type="button"
                  className={`question-dot${index === currentQuestionIndex ? " current" : ""}${answers[question.id] ? " answered" : ""}`}
                  onClick={() => setCurrentQuestionIndex(index)}
                  aria-label={`第 ${index + 1} 题`}
                />
              ))}
            </div>
          </section>

          <aside className="glass-panel test-side-panel">
            <div className="field-group compact">
              <label htmlFor="participantName">你的名字或昵称</label>
              <input
                id="participantName"
                type="text"
                value={participantName}
                placeholder="比如：Anny、Momo、Sage"
                onChange={(event) => setParticipantName(event.target.value)}
              />
            </div>

            <div className="test-side-copy">
              <span className="micro-label">答题进度</span>
              <strong>{answeredCount} / {totalQuestions} 已完成</strong>
              <p>{isLastQuestion ? "这是最后一题。选完后直接点提交，就会生成你的结果卡。" : "按直觉作答就好，答完后会一次性生成结果卡。"}</p>
            </div>

            <div className="test-cta">
              <strong>{isLastQuestion ? "最后一步" : `第 ${currentQuestionIndex + 1} / ${totalQuestions} 题`}</strong>
              <p>全部答完后会直接生成一张可分享的结果卡。公开页不会暴露你的作答过程。</p>
              {isLastQuestion ? (
                <ActionButton kind="accent" onClick={revealResult} disabled={!currentAnswered}>
                  提交并查看结果
                </ActionButton>
              ) : (
                <ActionButton
                  kind="secondary"
                  onClick={() => setCurrentQuestionIndex((current) => Math.min(totalQuestions - 1, current + 1))}
                >
                  继续答题
                </ActionButton>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function schoolLabelForTerminal(configLike) {
  const school = schools.find((item) => item.id === configLike?.schoolId) || schools[0];
  return `${school.short} · ${resolveDirectionLabel(configLike)}`;
}

function PublicResultPage({ payload, currentHref, copyState, onCopyLink, onGoHome }) {
  useEffect(() => {
    const viewerName = payload.viewerName && payload.viewerName !== "这位测试者" ? payload.viewerName : "";
    document.title = buildDocumentTitle(viewerName ? `${viewerName} 的结果卡` : `${payload.testName || "人格测试"}结果卡`);
  }, [payload]);

  return (
    <ResultExperience
      payload={payload}
      shareHref={currentHref}
      copyState={copyState}
      onCopyLink={onCopyLink}
      onSecondaryAction={onGoHome}
      secondaryLabel="我也生成一套"
      onGoHome={onGoHome}
      isPublic
    />
  );
}

export default function App() {
  const [currentHref, setCurrentHref] = useState(() => window.location.href);
  const [builderConfig, setBuilderConfig] = useState(defaultConfig);
  const [copyState, setCopyState] = useState("idle");

  useEffect(() => {
    const onPopState = () => setCurrentHref(window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const route = useMemo(() => parseRoute(currentHref), [currentHref]);

  async function copyLink(link) {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState("success");
    } catch {
      setCopyState("error");
    }
    window.setTimeout(() => setCopyState("idle"), 1500);
  }

  function openUrl(link) {
    navigateTo(link);
    setCurrentHref(window.location.href);
  }

  function goHome() {
    navigateTo(getBaseUrl(), true);
    setCurrentHref(window.location.href);
  }

  if (route.view === "public-result") {
    return (
      <PublicResultPage
        payload={route.payload}
        currentHref={currentHref}
        copyState={copyState}
        onCopyLink={copyLink}
        onGoHome={goHome}
      />
    );
  }

  if (route.view === "test") {
    return (
      <TestPage
        initialConfig={route.config}
        demoId={route.demoId || ""}
        copyState={copyState}
        onCopyLink={copyLink}
        onGoHome={goHome}
      />
    );
  }

  return (
    <BuilderPage
      config={builderConfig}
      setConfig={setBuilderConfig}
      copyState={copyState}
      onCopyLink={copyLink}
      onOpenTest={openUrl}
      onGoHome={goHome}
    />
  );
}
