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

const SITE_TITLE = "可分享人格测试";

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

function OptionCard({ active, title, description, onClick }) {
  return (
    <button type="button" className={`option-card${active ? " active" : ""}`} onClick={onClick}>
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  );
}

function DirectionChip({ active, label, onClick }) {
  return (
    <button type="button" className={`chip${active ? " active" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

function AnswerQuestionCard({ question, index, value, onAnswer }) {
  return (
    <article className="question-card">
      <div className="question-head">
        <div className="question-index">{index + 1}</div>
        <div className="question-title">
          <strong>{question.label}</strong>
        </div>
      </div>
      <div className="likert">
        {scaleLabels.map((scale) => (
          <button
            key={scale.value}
            type="button"
            className={`scale${value === scale.value ? " active" : ""}`}
            onClick={() => onAnswer(question.id, scale.value)}
          >
            <strong>{scale.short}</strong>
            <span>{scale.text}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

function buildTypeCodeLegend(typeCode, logicAxes = []) {
  if (!typeCode || !logicAxes.length) return [];

  const separatedTokens = typeCode
    .split(/[\s\-_/|·]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const tokens = separatedTokens.length === logicAxes.length
    ? separatedTokens
    : (() => {
        const compactCode = typeCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        if (!compactCode) return [];

        const compactTokens = [];
        let cursor = 0;

        for (const axis of logicAxes) {
          const options = [axis.leftCode, axis.rightCode]
            .filter(Boolean)
            .map((token) => String(token).toUpperCase())
            .sort((a, b) => b.length - a.length);
          const matched = options.find((option) => compactCode.slice(cursor).startsWith(option));
          if (!matched) return [];
          compactTokens.push(matched);
          cursor += matched.length;
        }

        return cursor === compactCode.length ? compactTokens : [];
      })();

  if (tokens.length !== logicAxes.length) return [];

  return logicAxes
    .map((axis, index) => {
      const token = tokens[index];
      const normalizedToken = String(token).toUpperCase();
      if (!token) return null;

      if (normalizedToken === String(axis.leftCode || "").toUpperCase()) {
        return { code: axis.leftCode, label: axis.left, description: axis.leftDescription };
      }

      if (normalizedToken === String(axis.rightCode || "").toUpperCase()) {
        return { code: axis.rightCode, label: axis.right, description: axis.rightDescription };
      }

      return null;
    })
    .filter(Boolean);
}

function AxisCodeGuide({ logicAxes = [], title = "字母缩写说明", description = "结果字母不是黑话，每一位都对应一条清晰维度。" }) {
  const rows = logicAxes.filter((axis) => axis.leftCode || axis.rightCode);
  if (!rows.length) return null;

  return (
    <section className="code-guide-card">
      <div className="code-guide-head">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className="code-guide-grid">
        {rows.map((axis) => (
          <article key={axis.id} className="code-guide-axis">
            <span>{axis.label}</span>
            <div className="code-guide-pairs">
              <div>
                <strong>{axis.leftCode}</strong>
                <b>{axis.left}</b>
                <p>{axis.leftDescription}</p>
              </div>
              <div>
                <strong>{axis.rightCode}</strong>
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

function ShareBanner({ name, tagline, code = "", codeLegend = [] }) {
  return (
    <div className="share-poster">
      <div>
        {code ? <span className="type-code">{code}</span> : null}
        <h3>{name}</h3>
        <p>{tagline}</p>
        {codeLegend.length ? (
          <div className="result-code-legend">
            {codeLegend.map((item) => (
              <span key={`${item.code}-${item.label}`}>
                <strong>{item.code}</strong>
                {item.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
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

const generationMilestones = ["写出测试标题", "长出第一道题", "生成结果卡"];

function getExpectedPreviewTimeMs(configLike) {
  const typeCount = Number(configLike?.typeCount) || 16;
  const questionCount = Number(configLike?.questionCount) || 20;
  const typeWeight = { 4: 12000, 8: 22000, 16: 45000, 32: 70000 };
  const questionOffset = Math.max(0, questionCount - 12) * 500;
  return (typeWeight[typeCount] || 45000) + questionOffset;
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
  if (totalSeconds < 60) return `通常约 ${totalSeconds} 秒`;
  const minutes = Math.round(totalSeconds / 60);
  return `通常约 ${minutes} 分钟`;
}

function getDraftingSummaryLabel(stage) {
  if (stage === "examples") return "示例内容补齐中";
  if (stage === "retrying") return "正在重新补齐";
  return "结果文案补齐中";
}

function getDraftingNote(stage, configLike) {
  if (stage === "examples") {
    return {
      title: "你现在已经可以先预览、先分享。",
      body: `测试题和结果主文案已经可用；人物示例和分享表达还在继续补齐，${formatExpectedLabel(getExpectedCompletionTimeMs(configLike) * 0.35)}。`
    };
  }

  return {
    title: "可预览版已经生成好了。",
    body: `你现在就能预览、先分享；结果页文案还会继续补齐，完整版${formatExpectedLabel(getExpectedCompletionTimeMs(configLike))}。`
  };
}

function getGeneratedSubcopy(status, stage, configLike) {
  if (status !== "drafting") {
    return "现在就能把它发出去，也可以先直接看看这套测试生成出来的结果框架。";
  }

  if (stage === "examples") {
    return `现在就能把它发出去。测试题和结果主文案已经可用；人物示例和分享表达还在继续补齐，完整版${formatExpectedLabel(getExpectedCompletionTimeMs(configLike) * 0.35)}。`;
  }

  return `现在就能把它发出去。测试题和人格结果已经可用；结果页文案还在后台继续补齐，完整版${formatExpectedLabel(getExpectedCompletionTimeMs(configLike))}。`;
}

function getProgressPercent(elapsedMs, expectedMs) {
  const normalized = Math.max(0, elapsedMs) / Math.max(expectedMs, 1);

  if (normalized < 0.25) {
    return 8 + normalized * 80;
  }

  if (normalized < 0.75) {
    return 28 + ((normalized - 0.25) / 0.5) * 32;
  }

  if (normalized < 1.15) {
    return 60 + ((normalized - 0.75) / 0.4) * 16;
  }

  return 76 + Math.min(8, ((normalized - 1.15) / 0.8) * 8);
}

function buildGenerationPreviewContent(configLike) {
  const directionLabel = resolveDirectionLabel(configLike).replace(/人格测试$/, "");

  if (directionLabel.includes("职场")) {
    return {
      question: "“当协作里出现分歧时，你更像先稳住场面，还是先拉回目标？”",
      resultName: "稳场协作者",
      resultDescription: "既能接住现场气氛，也能把讨论慢慢带回真正要解决的问题。"
    };
  }

  if (directionLabel.includes("关系")) {
    return {
      question: "“关系里出现误会时，你更像先安抚情绪，还是先把话说清楚？”",
      resultName: "关系点灯人",
      resultDescription: "很会找到对话里的转折点，让尴尬的场面重新亮起来。"
    };
  }

  if (directionLabel.includes("情绪")) {
    return {
      question: "“情绪上头的时候，你更像先把感受说出来，还是先把自己稳住？”",
      resultName: "情绪翻译者",
      resultDescription: "能把模糊的心情说清楚，也能帮别人看见自己真正卡住的地方。"
    };
  }

  return {
    question: `“在${directionLabel || "这个主题"}里，别人最容易因你身上的哪种反应记住你？”`,
    resultName: "共情控场者",
    resultDescription: "很会接人、稳住场面，也让别人愿意继续把话说下去。"
  };
}

function GenerationPreviewMock({ testName, configLike, revealLevel }) {
  const typeCount = Number(configLike?.typeCount) || 16;
  const questionCount = Number(configLike?.questionCount) || 20;
  const previewContent = buildGenerationPreviewContent(configLike);
  const showTitle = revealLevel >= 1;
  const showQuestion = revealLevel >= 2;
  const showResult = revealLevel >= 3;

  return (
    <aside className="generation-preview-shell" aria-label="生成预览">
      <div className="generation-preview-window">
        <div className="generation-preview-toolbar">
          <span />
          <span />
          <span />
        </div>
        <div className="generation-preview-topline">
          <b className={showTitle ? "generation-reveal is-visible" : "generation-reveal"}>
            {showTitle ? testName : " "}
          </b>
          <em>{typeCount} 型</em>
        </div>
        <div className="generation-preview-canvas">
          <section className={`generation-preview-question${showQuestion ? "" : " is-pending"}`}>
            <span className="generation-preview-tag">Question</span>
            <strong className={showQuestion ? "generation-reveal is-visible" : "generation-reveal"}>
              {showQuestion ? previewContent.question : " "}
            </strong>
            <div className="generation-preview-scale">
              {["1", "2", "3", "4", "5"].map((item) => (
                <i key={item}>{item}</i>
              ))}
            </div>
          </section>

          <section className={`generation-preview-result${showResult ? "" : " is-pending"}`}>
            <span className="generation-preview-tag neutral">Result</span>
            <strong className={showResult ? "generation-reveal is-visible" : "generation-reveal"}>
              {showResult ? previewContent.resultName : " "}
            </strong>
            <p className={showResult ? "generation-reveal is-visible" : "generation-reveal"}>
              {showResult ? previewContent.resultDescription : " "}
            </p>
            <div className="generation-preview-code">
              <span>E</span>
              <span>A</span>
              <span>C</span>
              <span>S</span>
            </div>
          </section>
        </div>
        <div className="generation-preview-footer">
          <span>{questionCount} 题</span>
          <span>生成中</span>
        </div>
      </div>
    </aside>
  );
}

function GenerationProgressCard({ testName, configLike }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 400);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const expectedPreviewTimeMs = getExpectedPreviewTimeMs(configLike);
  const progressWidth = getProgressPercent(elapsedMs, expectedPreviewTimeMs);
  const revealLevel = progressWidth >= 68 ? 3 : progressWidth >= 42 ? 2 : progressWidth >= 18 ? 1 : 0;
  const activeMilestoneIndex = revealLevel >= generationMilestones.length ? generationMilestones.length - 1 : revealLevel;
  const expectedCompletionTimeMs = getExpectedCompletionTimeMs(configLike);

  return (
    <section className="panel generation-progress-card">
      <div className="generation-progress-hero">
        <div>
          <div className="system-badge">人格测试</div>
          <h2>正在生成「{testName}」</h2>
          <p className="sub">
            先生成可预览版，{formatExpectedLabel(expectedPreviewTimeMs)}；完整版会继续在后台补齐，{formatExpectedLabel(expectedCompletionTimeMs)}。
          </p>
          <div className="generation-milestone-row" aria-label="生成进度">
            {generationMilestones.map((label, index) => {
              const status = index < revealLevel ? "done" : index === activeMilestoneIndex ? "active" : "pending";
              return (
                <div key={label} className={`generation-milestone ${status}`}>
                  <span className="generation-milestone-dot" aria-hidden="true" />
                  <strong>{label}</strong>
                </div>
              );
            })}
          </div>
        </div>
        <GenerationPreviewMock testName={testName} configLike={configLike} revealLevel={revealLevel} />
      </div>
      <div className="progress-rail top-gap">
        <i style={{ width: `${progressWidth}%` }} />
      </div>
      <div className="progress-meta">
        <span>{formatWaitLabel(elapsedMs)}</span>
        <span>可预览版{formatExpectedLabel(expectedPreviewTimeMs)}</span>
      </div>
    </section>
  );
}

function Shell({ eyebrow, title, description, children, mode = "hero", navMeta = "生成测试 · 完成测试 · 分享结果", hideHead = false }) {
  return (
    <main className="demo-page">
      {navMeta ? (
        <nav className="top-nav">
          <button type="button" className="top-nav-link" onClick={() => { navigateTo(getBaseUrl()); window.location.reload(); }}>
            发起测试
          </button>
          <span className="top-nav-meta">{navMeta}</span>
        </nav>
      ) : null}

      {!hideHead && mode === "hero" ? (
        <section className="hero simple-hero">
          <div className="hero-grid hero-grid-simple">
            <div>
              <div className="eyebrow">{eyebrow}</div>
              <h1>{title}</h1>
              <p className="hero-copy">{description}</p>
            </div>
            <aside className="hero-stage hero-stage-simple">
              <div className="step-card">
                <span className="step-index">01</span>
                <strong>选择元素</strong>
                <p>先定主题，决定这套测试要让人记住什么。</p>
              </div>
              <div className="step-card">
                <span className="step-index">02</span>
                <strong>生成测试</strong>
                <p>一键生成入口，立刻就能发给别人去玩。</p>
              </div>
              <div className="step-card">
                <span className="step-index">03</span>
                <strong>分享结果</strong>
                <p>做完的人会拿到一张像话题名片一样的结果卡。</p>
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      {!hideHead && mode !== "hero" ? (
        <section className="page-head">
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p className="hero-copy">{description}</p>
        </section>
      ) : null}

      {children}
    </main>
  );
}

function BuilderPage({ config, setConfig, copyState, onCopyLink, onOpenTest }) {
  const [isGenerated, setIsGenerated] = useState(false);
  const [showLogic, setShowLogic] = useState(false);
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
  const draftTestName = useMemo(() => buildTestName(config), [config]);
  const generatedTestName = useMemo(() => buildTestName(generatedConfig || config), [config, generatedConfig]);

  useEffect(() => {
    document.title = buildDocumentTitle(isGenerated ? generatedTestName : "可分享人格测试生成器");
  }, [generatedTestName, isGenerated]);

  useEffect(() => {
    setIsGenerated(false);
    setShowLogic(false);
    setGeneratedConfig(null);
    setGeneratedDemoId("");
    setGenerationError("");
    setGenerationStatus("idle");
    setGenerationStage("");
    setRetryCount(0);
    setIsRetrying(false);
  }, [config]);

  useEffect(() => {
    if (!isGenerated || !generatedDemoId || generationStatus !== "drafting") return undefined;

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
          setGenerationError((current) => current || "结果卡补全时断了一下，稍后再刷新看看。");
        }
      }
    };

    poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [generatedDemoId, generationStatus, isGenerated]);

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

  const copyLabel = copyState === "success" ? "已复制" : copyState === "error" ? "复制失败" : "复制测试入口";

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

      setIsGenerated(true);
      setShowLogic(true);
      setRetryCount(0);
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

    return () => {
      window.clearTimeout(timer);
    };
  }, [config, generatedConfig, generationStatus, isGenerating, retryCount]);

  useEffect(() => {
    if (generationStatus !== "failed") return undefined;

    if (generatedConfig || generatedDemoId) {
      setIsGenerated(true);
      setShowLogic(true);
    }
    return undefined;
  }, [generatedConfig, generatedDemoId, generationStatus]);

  return (
    <Shell
      eyebrow="人格测试生成器"
      title="生成一套适合被转发的人格测试。"
      description="选一个你想要的主题，我们会把它变成一套有记忆点、有讨论度、也有分享冲动的测试。做完的人拿到的不是冷冰冰的结论，而是一句会让人想立刻转发出去的自我介绍。"
      navMeta="选择内容 · 生成测试"
    >
      <section className="single-column top-gap">
        <section className="panel builder-panel">
          <div className="builder-header">
            <div>
              <h2>测试生成器</h2>
              <p className="sub">先定主题，再生成入口。你要的不是一份说明书，而是一套别人做完会想讨论、想截图、想转发的测试。</p>
            </div>
          </div>

          <div className="section-title">心理流派</div>
          <div className="card-grid">
            {schools.map((school) => (
              <OptionCard
                key={school.id}
                active={config.schoolId === school.id}
                title={school.label}
                description={school.pitch}
                onClick={() => updateConfig({ schoolId: school.id })}
              />
            ))}
          </div>

          <div className="section-title">方向主题</div>
          <div className="chip-row">
            {directionCatalog.map((direction) => (
              <DirectionChip
                key={direction.id}
                active={config.directionIds.includes(direction.id)}
                label={direction.label}
                onClick={() => selectDirection(direction.id)}
              />
            ))}
          </div>

          <div className="section-title">自定义方向</div>
          <div className="field">
            <label htmlFor="customDirection">方向主题单选；如果不用内置标签，可以自己输入一个</label>
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

          <div className="section-title">生成参数</div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="typeCount">人格类型数量</label>
              <select
                id="typeCount"
                value={config.typeCount}
                onChange={(event) => updateConfig({ typeCount: Number(event.target.value) })}
              >
                <option value={4}>4 种</option>
                <option value={8}>8 种</option>
                <option value={16}>16 种</option>
                <option value={32}>32 种</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="questionCount">题目数量</label>
              <select
                id="questionCount"
                value={config.questionCount}
                onChange={(event) => updateConfig({ questionCount: Number(event.target.value) })}
              >
                <option value={12}>12 题</option>
                <option value={20}>20 题</option>
                <option value={32}>32 题</option>
                <option value={40}>40 题</option>
              </select>
            </div>
          </div>

          <div className="actions top-gap">
            <button type="button" className="primary" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? "正在生成..." : "生成测试"}
            </button>
          </div>
          {generationError ? <p className="error-note">{generationError}</p> : null}
        </section>

        {isGenerating && (
          <GenerationProgressCard
            testName={draftTestName}
            configLike={config}
          />
        )}

        {isGenerated && (
          <section className="panel generate-focus">
            <div className="generate-focus-head compact">
              <div>
                <div className="system-badge">人格测试</div>
                <h2>「{generatedTestName}」已经准备好了</h2>
                <p className="sub">
                  {getGeneratedSubcopy(generationStatus, generationStage, generatedConfig || config)}
                </p>
              </div>
            </div>

            <div className="generate-summary-row">
              <span>{generated.types.length} 种人格</span>
              <span>{generated.questions.length} 道题</span>
              <span>{generationStatus === "drafting" ? getDraftingSummaryLabel(generationStage) : "完整版已就绪"}</span>
            </div>

            {generationStatus === "drafting" ? (
              <div className="generation-inline-note">
                <strong>{getDraftingNote(generationStage, generatedConfig || config).title}</strong>
                <span>{getDraftingNote(generationStage, generatedConfig || config).body}</span>
              </div>
            ) : null}

            {generationStatus === "retrying" ? (
              <div className="generation-inline-note">
                <strong>结果卡补全刚刚断了一下，正在自动重试。</strong>
                <span>不用重新填写参数，我们先帮你再补一轮；如果还是失败，你也可以手动再试一次。</span>
              </div>
            ) : null}

            {generationStatus === "failed" ? (
              <div className="generation-inline-note warning">
                <strong>完整版结果卡暂时没有补全成功。</strong>
                <span>基础测试仍然可用。我们已经自动重试 {retryCount} 次，你也可以手动再试一次。</span>
              </div>
            ) : null}

            <div className="actions">
              <button type="button" className="secondary" onClick={() => onOpenTest(generated.shareLink)}>预览测试</button>
              <button type="button" className="primary" onClick={() => onCopyLink(generated.shareLink)}>{copyLabel === "复制测试入口" ? "分享测试" : copyLabel}</button>
              {generationStatus === "failed" ? (
                <button type="button" className="secondary" onClick={handleRetry} disabled={isGenerating || isRetrying}>
                  {isGenerating || isRetrying ? "正在重试..." : "重新补全结果卡"}
                </button>
              ) : null}
              <button type="button" className="ghost" onClick={() => setShowLogic((value) => !value)}>
                {showLogic ? "收起生成结果" : "查看生成结果"}
              </button>
            </div>

            {showLogic && (
              <section className="logic-panel top-gap">
                <div className="logic-head">
                  <h3>这是「{generatedTestName}」生成出来的结果框架</h3>
                  <p>{generated.logicIntro}</p>
                </div>

                <div className="logic-axis-grid">
                  {generated.logicAxes.map((axis) => (
                    <article key={axis.id} className="logic-axis-card">
                      <strong>{axis.label}</strong>
                      <div className="logic-axis-sides">
                        <div>
                          <div className="axis-side-heading">
                            {axis.leftCode ? <span className="axis-code-pill">{axis.leftCode}</span> : null}
                            <span>{axis.left}</span>
                          </div>
                          <p>{axis.leftDescription}</p>
                        </div>
                        <div>
                          <div className="axis-side-heading">
                            {axis.rightCode ? <span className="axis-code-pill">{axis.rightCode}</span> : null}
                            <span>{axis.right}</span>
                          </div>
                          <p>{axis.rightDescription}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="section-title">这套测试会产出的结果卡</div>
                <div className="logic-type-grid">
                  {generated.logicTypes.map((type) => (
                    <article key={type.id} className="logic-type-card">
                      {type.code ? <span className="type-code">{type.code}</span> : null}
                      <strong>{type.name}</strong>
                      <p>{type.tagline}</p>
                      {type.lens ? <p className="logic-type-detail">{type.lens}</p> : null}
                      {type.advice ? <p className="logic-type-note">{type.advice}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </section>
        )}
      </section>
    </Shell>
  );
}

function TestPage({ initialConfig = null, demoId = "", copyState, onCopyLink }) {
  const [config, setConfig] = useState(initialConfig);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(demoId && !initialConfig));
  const [participantName, setParticipantName] = useState("");
  const [answers, setAnswers] = useState({});
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
  const result = useMemo(() => (generated ? buildResult(generated, answers) : null), [generated, answers]);
  const answeredCount = useMemo(
    () => (generated ? generated.questions.filter((question) => answers[question.id]).length : 0),
    [generated, answers]
  );
  const progressPercent = generated
    ? Math.round((answeredCount / Math.max(generated.questions.length, 1)) * 100)
    : 0;
  const primaryType = result?.primary?.type || null;
  const narrative = useMemo(
    () => (generated && result ? buildResultNarrative(generated, result, participantName.trim() || "这位测试者") : null),
    [generated, result, participantName]
  );
  const resultCodeLegend = useMemo(
    () => (primaryType && generated ? buildTypeCodeLegend(primaryType.code, generated.logicAxes) : []),
    [generated, primaryType]
  );
  const narrativeCards = useMemo(
    () => {
      if (!narrative) return [];
      return [
        narrative.lensBody ? { title: narrative.lensTitle, body: narrative.lensBody } : null,
        narrative.adviceBody ? { title: narrative.adviceTitle, body: narrative.adviceBody } : null,
        narrative.riskBody ? { title: narrative.riskTitle, body: narrative.riskBody } : null,
        narrative.matchBody ? { title: narrative.matchTitle, body: narrative.matchBody } : null
      ].filter(Boolean);
    },
    [narrative]
  );
  const resultPayload = showResult && primaryType && narrative
    ? {
        viewerName: participantName.trim() || "这位测试者",
        testName,
        type: primaryType,
        secondary: result.secondary?.type || null,
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
        logicAxes: generated.logicAxes
      }
    : null;
  const resultShareLink = resultPayload ? `${getBaseUrl()}?result=${safeEncode(resultPayload)}` : "";
  const copyLabel = copyState === "success" ? "已复制" : copyState === "error" ? "复制失败" : "复制结果页";

  useEffect(() => {
    if (isLoading) {
      document.title = buildDocumentTitle(`正在加载「${demoId ? "这套人格测试" : buildTestName(initialConfig)}」`);
      return;
    }

    if (loadError || !config) {
      document.title = buildDocumentTitle(`「${testName}」暂时打不开`);
      return;
    }

    if (showResult && primaryType) {
      document.title = buildDocumentTitle(`「${testName}」结果：${primaryType.name}`);
      return;
    }

    document.title = buildDocumentTitle(`开始做「${testName}」`);
  }, [config, demoId, initialConfig, isLoading, loadError, primaryType, showResult, testName]);

  if (isLoading) {
    return (
      <Shell
        eyebrow="人格测试"
        title={`正在加载「${demoId ? "这套人格测试" : buildTestName(initialConfig)}」`}
        description="马上就好，我们正在把这套结果卡对应的题目和类型取回来。"
        mode="compact"
        navMeta={null}
      >
        <section className="single-column top-gap">
          <section className="panel">
            <p className="sub">正在准备题目...</p>
          </section>
        </section>
      </Shell>
    );
  }

  if (!config || loadError) {
    return (
      <Shell
        eyebrow="人格测试"
        title={`「${testName}」暂时打不开。`}
        description={loadError || "链接可能已经失效，或者这套测试还没准备完整。"}
        mode="compact"
        navMeta={null}
      >
        <section className="single-column top-gap">
          <section className="panel">
            <p className="sub">{loadError || "请返回重新生成一套测试。"}</p>
          </section>
        </section>
      </Shell>
    );
  }

  function handleAnswer(questionId, value) {
    setShowResult(false);
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function revealResult() {
    if (answeredCount !== generated.questions.length) {
      window.alert(`还有 ${generated.questions.length - answeredCount} 道题没答完，先补齐再看结果。`);
      return;
    }
    setShowResult(true);
  }

  return (
    <Shell
      eyebrow="人格测试"
      title={`开始做「${testName}」`}
      description="你只需要专注回答这些陈述。完成之后，系统会基于人格维度结果生成一张适合分享的结果卡。"
      mode="compact"
      navMeta={null}
    >
      <section className="single-column top-gap test-layout">
        <section className="panel test-panel">
          <div className="title-wrap">
              <div>
                <div className="system-badge">开始测试</div>
                <h2>开始做「{testName}」</h2>
                <p className="sub">按照“像不像你”的程度作答即可。</p>
              </div>
            </div>

          <div className="progress-card">
            <div className="progress-meta">
              <strong>答题进度</strong>
              <span>{answeredCount} / {generated.questions.length} 题</span>
            </div>
            <div className="progress-bar">
              <i style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="participantName">你的名字或昵称</label>
              <input
                id="participantName"
                type="text"
                value={participantName}
                placeholder="比如：Anny、Momo、Sage"
                onChange={(event) => setParticipantName(event.target.value)}
              />
            </div>
            <div className="field">
              <label>答题说明</label>
              <div className="helper">请按直觉回答。1 分表示很不像，5 分表示非常像。</div>
            </div>
          </div>

          <div className="answer-list">
            {generated.questions.map((question, index) => (
              <AnswerQuestionCard
                key={question.id}
                question={question}
                index={index}
                value={answers[question.id]}
                onAnswer={handleAnswer}
              />
            ))}
          </div>

          <div className="actions">
            <button type="button" className="primary" onClick={revealResult}>提交结果，获得答案</button>
          </div>
        </section>

        {showResult && (
          <section className="panel top-gap">
            <div className="title-wrap">
              <div>
                <div className="system-badge">测试结果</div>
                <h2>{participantName.trim() ? `${participantName.trim()}，你的「${testName}」结果已经生成了` : `你的「${testName}」结果已经生成了`}</h2>
                <p className="sub">这张结果卡更适合被分享。页面不会展示你的作答过程。</p>
              </div>
            </div>

            <ShareBanner
              name={primaryType.name}
              tagline={`${narrative.wittySummary}${narrative.footerLine ? ` ${narrative.footerLine}` : ""}`}
              code={primaryType.code}
              codeLegend={resultCodeLegend}
            />

            <AxisCodeGuide
              logicAxes={generated.logicAxes}
              title="结果字母怎么读"
              description="每个缩写都对应你在这套测试里更偏向的一侧，分享时别人也能一眼看懂。"
            />

            {narrativeCards.length ? (
              <div className="answer-grid top-gap">
                {narrativeCards.map((item) => (
                  <div key={item.title} className="result-card">
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <section className="top-gap">
              <div className="section-title">{narrative.storyTitle}</div>
              <div className="story-grid">
                {narrative.examples.map((item) => (
                  <StoryCard key={item.name} item={item} />
                ))}
              </div>
            </section>
            <div className="actions top-gap">
              <button type="button" className="primary" onClick={() => onCopyLink(resultShareLink)}>{copyLabel === "复制结果页" ? "分享结果" : copyLabel}</button>
            </div>
          </section>
        )}
      </section>
    </Shell>
  );
}

function PublicResultPage({ payload, currentHref, copyState, onCopyLink }) {
  const shareLabel = copyState === "success" ? "已复制" : copyState === "error" ? "复制失败" : "分享结果";
  const viewerName = payload.viewerName && payload.viewerName !== "这位测试者" ? payload.viewerName : "";
  const publicTestName = payload.testName || "人格测试";
  const resultHeadline = viewerName ? `${viewerName} 的「${publicTestName}」结果` : payload.headline;
  const publicCodeLegend = buildTypeCodeLegend(payload.type.code, payload.logicAxes || []);
  const publicNarrativeCards = [
    payload.lens ? { title: "你给人的感觉", body: payload.lens } : null,
    payload.advice ? { title: "你更适合的方式", body: payload.advice } : null,
    payload.risk ? { title: "这类人格的盲点", body: payload.risk } : null,
    payload.matchBody ? { title: payload.matchTitle || "更直白一点说", body: payload.matchBody } : null
  ].filter(Boolean);

  useEffect(() => {
    document.title = buildDocumentTitle(viewerName ? `${viewerName} 的「${publicTestName}」结果卡` : `「${publicTestName}」结果卡`);
  }, [publicTestName, viewerName]);

  return (
    <Shell
      eyebrow="人格测试结果"
      title={`这是一张「${publicTestName}」的结果卡。`}
      description="这里不会展示作答过程，只保留结果本身。看完之后，也可以继续生成自己的测试。"
      mode="compact"
      navMeta={null}
      hideHead
    >
      <section className="single-column top-gap">
        <section className="panel">
          <div className="title-wrap">
            <div>
              <div className="system-badge">分享结果</div>
              <h2>{resultHeadline}</h2>
              {viewerName ? <p className="sub">{viewerName} 做完「{publicTestName}」后，拿到的是这张结果卡。</p> : null}
              <p className="sub">适合直接截图、转发、继续扩散。</p>
            </div>
          </div>

          <ShareBanner
            name={payload.type.name}
            tagline={`${payload.summary}${payload.footerLine ? ` ${payload.footerLine}` : ""}`}
            code={payload.type.code}
            codeLegend={publicCodeLegend}
          />

          <AxisCodeGuide
            logicAxes={payload.logicAxes || []}
            title="结果字母怎么读"
            description="这张结果卡里的每个字母，都对应这套测试的一条判断维度。"
          />

          {publicNarrativeCards.length ? (
            <div className="answer-grid top-gap">
              {publicNarrativeCards.map((item) => (
                <div key={item.title} className="result-card">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          ) : null}

          <section className="top-gap">
            <div className="section-title">{payload.storyTitle || "这类人会让你想到谁"}</div>
            <div className="story-grid">
              {(payload.examples || []).map((item) => (
                <StoryCard key={item.name} item={item} />
              ))}
            </div>
          </section>
          <div className="actions top-gap">
            <button type="button" className="primary" onClick={() => onCopyLink(currentHref)}>{shareLabel}</button>
          </div>
        </section>
      </section>
    </Shell>
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

  if (route.view === "public-result") {
    return <PublicResultPage payload={route.payload} currentHref={currentHref} copyState={copyState} onCopyLink={copyLink} />;
  }

  if (route.view === "test") {
    return (
      <TestPage
        initialConfig={route.config}
        demoId={route.demoId || ""}
        copyState={copyState}
        onCopyLink={copyLink}
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
    />
  );
}
