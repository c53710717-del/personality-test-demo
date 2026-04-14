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

function ShareBanner({ code, name, tagline, note }) {
  return (
    <div className="share-poster">
      <div className="share-poster-code">{code}</div>
      <div>
        <h3>{name}</h3>
        <p>{tagline}</p>
      </div>
      {note ? (
        <div className="share-poster-meta">
          <span>{note}</span>
        </div>
      ) : null}
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

const generationLoadingSteps = [
  {
    title: "正在生成测试问题",
    body: "把这个主题里最有意思、最能区分人的问题先写出来。"
  },
  {
    title: "正在命名人格类型",
    body: "给这套测试长出更像话题名片、也更容易被记住的结果名。"
  },
  {
    title: "正在包装分享结果",
    body: "把结果卡打磨成更适合截图、转发和讨论的版本。"
  }
];

function GenerationProgressCard({ currentStep, stage }) {
  return (
    <section className="panel generation-progress-card">
      <div className="generation-progress-hero">
        <div>
          <div className="system-badge">生成中</div>
          <h2>{generationLoadingSteps[currentStep].title}</h2>
          <p className="sub">{generationLoadingSteps[currentStep].body}</p>
        </div>
        <div className="generation-visual" aria-hidden="true">
          <div className="generation-orbit generation-orbit-a" />
          <div className="generation-orbit generation-orbit-b" />
          <div className="generation-orbit generation-orbit-c" />
          <div className="generation-core">
            <span>TEST</span>
          </div>
          <div className="generation-spark generation-spark-a">题目</div>
          <div className="generation-spark generation-spark-b">人格</div>
          <div className="generation-spark generation-spark-c">结果卡</div>
        </div>
      </div>
      <div className="progress-rail top-gap">
        <i style={{ width: `${((currentStep + 1) / generationLoadingSteps.length) * 100}%` }} />
      </div>
      <div className="generation-step-list">
        {generationLoadingSteps.map((item, index) => (
          <article key={item.title} className={`generation-step${index <= currentStep ? " active" : ""}`}>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
      {stage ? <div className="generation-stage-note">当前进展：{stage}</div> : null}
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
  const [generationPulse, setGenerationPulse] = useState(0);
  const generated = useMemo(
    () => buildGenerated(generatedConfig || config, getBaseUrl(), generatedDemoId ? { demoId: generatedDemoId } : {}),
    [config, generatedConfig, generatedDemoId]
  );

  const generationStepIndex = useMemo(() => {
    if (generationStatus === "ready") return generationLoadingSteps.length - 1;
    if (generationStage === "copy") return 2;
    if (generationStage === "skeleton") return 1;
    return generationPulse % generationLoadingSteps.length;
  }, [generationPulse, generationStage, generationStatus]);

  useEffect(() => {
    setIsGenerated(false);
    setShowLogic(false);
    setGeneratedConfig(null);
    setGeneratedDemoId("");
    setGenerationError("");
    setGenerationStatus("idle");
    setGenerationStage("");
  }, [config]);

  useEffect(() => {
    if (!isGenerating) return undefined;
    const timer = window.setInterval(() => {
      setGenerationPulse((value) => value + 1);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

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

  async function handleGenerate() {
    setIsGenerating(true);
    setGenerationError("");
    setGenerationStatus("drafting");
    setGenerationStage("skeleton");
    const nextConfig = normalizeConfig(config);

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
    } catch (error) {
      setIsGenerated(false);
      setGenerationStatus("failed");
      setGenerationError(error.message || "生成失败，请稍后再试。");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Shell
      eyebrow="Create Test"
      title="生成一套适合被转发的测试。"
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
            currentStep={generationStepIndex}
            stage={generationStage === "copy" ? "正在润色分享结果" : generationStage === "skeleton" ? "正在写出测试雏形" : "正在生成"}
          />
        )}

        {isGenerated && (
          <section className="panel generate-focus">
            <div className="generate-focus-head compact">
              <div>
                <div className="system-badge">已生成</div>
                <h2>测试入口已经准备好了</h2>
                <p className="sub">
                  {generationStatus === "drafting"
                    ? "现在就能把它发出去。测试题和人格结果已经可用，分享页正在后台继续打磨。"
                    : "现在就能把它发出去。别人点开后会直接开始测试，不会先被一堆解释劝退。"}
                </p>
              </div>
            </div>

            <div className="generate-summary-row">
              <span>{generated.types.length} 种人格</span>
              <span>{generated.questions.length} 道题</span>
              <span>{generationStatus === "drafting" ? "结果卡补全中" : "已生成分型逻辑"}</span>
            </div>

            {generationStatus === "drafting" ? (
              <div className="generation-inline-note">
                <strong>结果卡还在继续打磨。</strong>
                <span>你现在可以先预览或分享测试入口，页面会自动拿到后续补全后的更完整版本。</span>
              </div>
            ) : null}

            {generationStatus === "failed" ? (
              <div className="generation-inline-note warning">
                <strong>完整版结果卡补全失败了。</strong>
                <span>基础测试仍然可用，你也可以稍后再重新生成一次。</span>
              </div>
            ) : null}

            <div className="actions">
              <button type="button" className="secondary" onClick={() => onOpenTest(generated.shareLink)}>预览测试</button>
              <button type="button" className="primary" onClick={() => onCopyLink(generated.shareLink)}>{copyLabel === "复制测试入口" ? "分享测试" : copyLabel}</button>
              <button type="button" className="ghost" onClick={() => setShowLogic((value) => !value)}>
                {showLogic ? "收起生成逻辑" : "查看生成逻辑"}
              </button>
            </div>

            {showLogic && (
              <section className="logic-panel top-gap">
                <div className="logic-head">
                  <h3>{generated.logicTitle}</h3>
                  <p>{generated.logicIntro}</p>
                </div>

                <div className="logic-axis-grid">
                  {generated.logicAxes.map((axis) => (
                    <article key={axis.id} className="logic-axis-card">
                      <strong>{axis.label}</strong>
                      <div className="logic-axis-sides">
                        <div>
                          <span>{axis.left}</span>
                          <p>{axis.leftDescription}</p>
                        </div>
                        <div>
                          <span>{axis.right}</span>
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
                      <div className="logic-type-code">{type.code}</div>
                      <strong>{type.name}</strong>
                      <p>{type.tagline}</p>
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
  const resultPayload = showResult && primaryType && narrative
    ? {
        viewerName: participantName.trim() || "这位测试者",
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
        footerLine: narrative.footerLine
      }
    : null;
  const resultShareLink = resultPayload ? `${getBaseUrl()}?result=${safeEncode(resultPayload)}` : "";
  const copyLabel = copyState === "success" ? "已复制" : copyState === "error" ? "复制失败" : "复制结果页";

  if (isLoading) {
    return (
      <Shell
        eyebrow="Take Test"
        title="正在加载这套测试。"
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
        eyebrow="Take Test"
        title="这套测试暂时打不开。"
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
      eyebrow="Take Test"
      title="用几分钟完成这组问题。"
      description="你只需要专注回答这些陈述。完成之后，系统会基于人格维度结果生成一张适合分享的结果卡。"
      mode="compact"
      navMeta={null}
    >
      <section className="single-column top-gap test-layout">
        <section className="panel test-panel">
          <div className="title-wrap">
            <div>
              <div className="system-badge">开始测试</div>
              <h2>用几分钟完成这组问题</h2>
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
                <h2>{participantName.trim() ? `${participantName.trim()}，你的结果已经生成了` : "你的结果已经生成了"}</h2>
                <p className="sub">这张结果卡更适合被分享。页面不会展示你的作答过程。</p>
              </div>
            </div>

            <ShareBanner
              code={primaryType.code}
              name={primaryType.name}
              tagline={narrative.wittySummary}
            />

            <div className="answer-grid top-gap">
              <div className="result-card">
                <h3>{narrative.lensTitle}</h3>
                <p>{narrative.lensBody}</p>
              </div>
              <div className="result-card">
                <h3>{narrative.adviceTitle}</h3>
                <p>{narrative.adviceBody}</p>
              </div>
            </div>

            <div className="answer-grid small-gap">
              <div className="result-card">
                <h3>{narrative.riskTitle}</h3>
                <p>{narrative.riskBody}</p>
              </div>
              <div className="result-card">
                <h3>{narrative.matchTitle}</h3>
                <p>{narrative.matchBody}</p>
              </div>
            </div>

            <section className="top-gap">
              <div className="section-title">{narrative.storyTitle}</div>
              <div className="story-grid">
                {narrative.examples.map((item) => (
                  <StoryCard key={item.name} item={item} />
                ))}
              </div>
            </section>

            <div className="result-footer-note">{narrative.footerLine}</div>

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
  const resultHeadline = viewerName ? `${viewerName} 的结果卡` : payload.headline;

  return (
    <Shell
      eyebrow="Share Result"
      title="这是一张可以直接转发的结果卡。"
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
              {viewerName ? <p className="sub">{viewerName} 做完这套测试后，拿到的是这张结果卡。</p> : null}
              <p className="sub">适合直接截图、转发、继续扩散。</p>
            </div>
          </div>

          <ShareBanner
            code={payload.type.code}
            name={payload.type.name}
            tagline={payload.summary}
          />

          <div className="answer-grid top-gap">
            <div className="result-card">
              <h3>你给人的感觉</h3>
              <p>{payload.lens}</p>
            </div>
            <div className="result-card">
              <h3>你更适合的方式</h3>
              <p>{payload.advice}</p>
            </div>
          </div>

          <div className="answer-grid small-gap">
            <div className="result-card">
              <h3>这类人格的盲点</h3>
              <p>{payload.risk}</p>
            </div>
            <div className="result-card">
              <h3>{payload.matchTitle || "更直白一点说"}</h3>
              <p>{payload.matchBody || payload.summary}</p>
            </div>
          </div>

          <section className="top-gap">
            <div className="section-title">{payload.storyTitle || "这类人会让你想到谁"}</div>
            <div className="story-grid">
              {(payload.examples || []).map((item) => (
                <StoryCard key={item.name} item={item} />
              ))}
            </div>
          </section>

          <div className="result-footer-note">{payload.footerLine}</div>

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
