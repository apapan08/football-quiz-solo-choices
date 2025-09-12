// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { questions as DATA_QUESTIONS } from "./data/questions";
import ResultsTableResponsive from "./components/ResultsTableResponsive";

// NEW imports for auto-marking + inputs
import AutoCompleteAnswer from "./components/AutoCompleteAnswer";
import ScoreInput from "./components/ScoreInput";
import { validate as baseValidate } from "./lib/validators";

// ✅ NEW: import Media as a separate, memoized component
import Media from "./components/Media";

/**
 * Football Quiz — SOLO MODE (single player)
 * Auto-marking:
 * - Catalogs (players/countries/coaches/teams/stadiums) → autocomplete + auto mark
 * - Scoreline → stepper input + auto mark
 * - Numeric → number input + auto mark (NEW)
 * - Plain text (answerMode omitted or "text") → manual mark (unchanged)
 */

const SOLO = true;

// ——— Brand font wiring ———
const FONT_LINK_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Noto+Sans:wght@400;700&display=swap&subset=greek";

const FONT_FAMILIES = {
  display:
    '"Noto Sans", Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  ui: '"Noto Sans",Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
};

// ——— Theme ———
const THEME = {
  gradientFrom: "#223B57",
  gradientTo: "#2F4E73",
  accent: "#F11467",
  card: "rgba(17, 24, 39, 0.55)",
  border: "rgba(255,255,255,0.08)",
  badgeGradient: "linear-gradient(90deg,#BA1ED3,#F11467)", // pink/purple pill
  positiveGrad: "linear-gradient(90deg,#22C55E,#10B981)", // green
  negativeGrad: "linear-gradient(90deg,#F43F5E,#EF4444)", // red
};

// ——— Game constants ———
const STORAGE_KEY = "quiz_prototype_state_v2_solo";
const STAGES = {
  NAME: "name",          // ⬅️ NEW: first stage
  INTRO: "intro",
  CATEGORY: "category",
  QUESTION: "question",
  ANSWER: "answer",
  FINALE: "finale",
  RESULTS: "results",
};

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}
function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState];
}

// ——— Helpers for numeric validation (local) ———
function normalizeNumber(val) {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}
async function validateAny(q, value) {
  const mode = q.answerMode || "text";
  if (mode === "numeric") {
    // Accept either a single number in q.acceptNumber or an array q.acceptNumbers
    const got = normalizeNumber(
      typeof value === "object" && value !== null ? value.value ?? value : value
    );
    if (got === null) return { correct: false, canonical: null };
    const allowed =
      Array.isArray(q.acceptNumbers) && q.acceptNumbers.length
        ? q.acceptNumbers.map((x) => normalizeNumber(x)).filter((x) => x !== null)
        : [normalizeNumber(q.acceptNumber ?? q.answer)];
    const correct = allowed.includes(got);
    return { correct, canonical: String(got) };
  }
  // Delegate other types to shared validators (catalog/scoreline/text)
  return baseValidate(q, value);
}

export default function QuizPrototype() {
  // ——— Inject brand fonts + base CSS once ———
  useEffect(() => {
    let linkEl;
    let styleEl;
    if (FONT_LINK_HREF) {
      linkEl = document.createElement("link");
      linkEl.rel = "stylesheet";
      linkEl.href = FONT_LINK_HREF;
      document.head.appendChild(linkEl);
    }
    styleEl = document.createElement("style");
    styleEl.innerHTML = `
      :root { 
        --brand-grad-from: ${THEME.gradientFrom}; 
        --brand-grad-to: ${THEME.gradientTo}; 
        --brand-accent: ${THEME.accent}; 
        --brand-card: ${THEME.card}; 
        --brand-border: ${THEME.border};
        --howto-bg: rgba(15,23,42,0.95);
      }
      .font-display { font-family: ${FONT_FAMILIES.display}; }
      .font-ui { font-family: ${FONT_FAMILIES.ui}; }
      .font-mono { font-family: ${FONT_FAMILIES.mono}; }
      .btn { @apply rounded-2xl px-5 py-2 font-semibold shadow; }
      .btn-accent { background: var(--brand-accent); color: white; }
      .btn-accent:hover { filter: brightness(1.06); }
      .btn-neutral { background: rgba(148,163,184,0.15); color: white; }
      .btn-neutral:hover { background: rgba(148,163,184,0.25); }
      .card { background: var(--brand-card); border:1px solid var(--brand-border); border-radius: 1.5rem; padding:1.5rem; box-shadow: 0 10px 24px rgba(0,0,0,.35); }
      .pill { border-radius: 999px; padding: .25rem .6rem; font-weight: 700; }

      /* HowTo modal helpers */
      .scroll-area { overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
      .scroll-area::-webkit-scrollbar { width:10px; }
      .scroll-area::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.18); border-radius:999px; }
      .howto-shadow { position: sticky; bottom: 0; height: 24px; background: linear-gradient(to top, var(--howto-bg), transparent); pointer-events: none; }

      /* HowTo-like surfaces for Intro/Name */
      .surface-howto { background: var(--howto-bg); border:1px solid rgba(255,255,255,0.10); border-radius:1.5rem; padding:1.5rem; box-shadow: 0 10px 24px rgba(0,0,0,.35); }
      .subcard-howto { background: rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.10); border-radius:1rem; padding:1rem; }

      /* Results horizontal scroll (iOS momentum + nicer thumb) */
      .results-scroll::-webkit-scrollbar { height: 10px; }
      .results-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 999px; }

      /* HUD micro-interactions */
      @keyframes hudPop { 0%{transform:scale(.92);opacity:.8} 60%{transform:scale(1.06)} 100%{transform:scale(1);opacity:1} }
      @keyframes hudPulse { 0%{transform:scale(.98)} 50%{transform:scale(1.04)} 100%{transform:scale(1)} }
      @keyframes hudShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-2px)} 75%{transform:translateX(2px)} }
      .hud-score-pop { animation: hudPop 300ms ease-out; will-change: transform,opacity; }
      .hud-streak-pulse { animation: hudPulse 320ms ease-out; will-change: transform; }
      .hud-streak-shake { animation: hudShake 360ms ease-in-out; will-change: transform; }
    `;
    document.head.appendChild(styleEl);
    return () => {
      if (linkEl) document.head.removeChild(linkEl);
      if (styleEl) document.head.removeChild(styleEl);
    };
  }, []);

  // ——— Load & order questions ———
  const QUESTIONS = useMemo(
    () => [...DATA_QUESTIONS].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    []
  );

  // ——— Category summary for Intro ———
  const CATEGORY_SUMMARY = useMemo(() => {
    const map = new Map();
    for (const q of QUESTIONS) {
      const key = q.category || "—";
      if (!map.has(key)) map.set(key, { category: key, points: new Set(), count: 0 });
      const e = map.get(key);
      e.points.add(q.points || 1);
      e.count += 1;
    }
    return Array.from(map.values()).map((e) => ({
      category: e.category,
      count: e.count,
      points: Array.from(e.points).sort((a, b) => a - b),
    }));
  }, [QUESTIONS]);

  // ——— Core game state ———
  const [index, setIndex] = usePersistentState(`${STORAGE_KEY}:index`, 0);
  const [stage, setStage] = usePersistentState(
    `${STORAGE_KEY}:stage`,
    STAGES.NAME   // start at Name stage
  );

  const lastIndex = QUESTIONS.length - 1;
  const isFinalIndex = index === lastIndex;
  const q = QUESTIONS[index] ?? QUESTIONS[0];

  const finalCategoryName = useMemo(
    () => (QUESTIONS.length ? QUESTIONS[QUESTIONS.length - 1].category : null),
    [QUESTIONS]
  );

  // Categories to show on Intro (exclude the final question's category)
  const INTRO_CATEGORIES = useMemo(() => {
    return CATEGORY_SUMMARY.filter((c) => c.category !== finalCategoryName);
  }, [CATEGORY_SUMMARY, finalCategoryName]);

  // Clean topic label for the final row (remove leading "Τελική ερώτηση —/–/-/: ")
  const finalTopicLabel = useMemo(() => {
    const raw = finalCategoryName || "";
    return raw.replace(/^\s*Τελική\s+ερώτηση\s*[—–\-:]\s*/i, "").trim() || raw;
  }, [finalCategoryName]);

  // Safety: if persisted index is out-of-range
  useEffect(() => {
    if (index > lastIndex) setIndex(lastIndex < 0 ? 0 : lastIndex);
  }, [index, lastIndex, setIndex]);

  // ——— X2 help (single player) ———
  const [x2, setX2] = usePersistentState(`${STORAGE_KEY}:x2`, {
    p1: { available: true, armedIndex: null },
  });

  // Player
  const [p1, setP1] = usePersistentState(`${STORAGE_KEY}:p1`, {
    name: "",
    score: 0,
    streak: 0,
    maxStreak: 0,
  });

  const [lastCorrect, setLastCorrect] = usePersistentState(
    `${STORAGE_KEY}:lastCorrect`,
    null
  );

  // Track if this question has been marked on the Answer stage
  const [answered, setAnswered] = usePersistentState(
    `${STORAGE_KEY}:answered`,
    {} // { [index]: 'correct' | 'wrong' | 'final-correct' | 'final-wrong' }
  );

  // Finale wager (only Player)
  const [wager, setWager] = usePersistentState(`${STORAGE_KEY}:wager`, { p1: 0 });
  const [finalResolved, setFinalResolved] = usePersistentState(
    `${STORAGE_KEY}:finalResolved`,
    { p1: false }
  );

  // Player's typed answers (committed on submit / don't know)
  const [playerAnswers, setPlayerAnswers] = usePersistentState(
    `${STORAGE_KEY}:playerAnswers`,
    {} // { [index]: string | {home,away} | {value:number} }
  );

  // How-to modal (default closed to avoid covering Name stage)
  const [showHowTo, setShowHowTo] = useState(false);

  // NEW: ephemeral HUD flags
  const [justScored, setJustScored] = usePersistentState(`${STORAGE_KEY}:hud:justScored`, false);
  const [justLostStreak, setJustLostStreak] = usePersistentState(`${STORAGE_KEY}:hud:justLost`, false);
  useEffect(() => {
    if (justScored) {
      const t = setTimeout(() => setJustScored(false), 320);
      return () => clearTimeout(t);
    }
  }, [justScored, setJustScored]);
  useEffect(() => {
    if (justLostStreak) {
      const t = setTimeout(() => setJustLostStreak(false), 380);
      return () => clearTimeout(t);
    }
  }, [justLostStreak, setJustLostStreak]);

  // ——— Results reconstruction ———
  const RESULT_ROWS = useMemo(() => {
    if (!QUESTIONS.length) return [];
    const last = QUESTIONS.length - 1;

    let running = 0;
    let streak = 0;

    const rows = QUESTIONS.map((qi, i) => {
      const outcomeKey = answered[i];
      const isFinal = i === last;
      const base = qi.points || 1;
      const x2Applied = !isFinal && x2?.p1?.armedIndex === i;
      const userAnswer = (playerAnswers && playerAnswers[i]) || "";

      let delta = 0;
      let bonus = 0;
      let outcome = "—";

      if (isFinal) {
        if (outcomeKey === "final-correct") {
          outcome = "Σωστό";
          delta = wager?.p1 || 0;
        } else if (outcomeKey === "final-wrong") {
          outcome = "Λάθος";
          delta = -(wager?.p1 || 0);
        } else {
          outcome = "—";
        }
      } else {
        if (outcomeKey === "correct") {
          outcome = "Σωστό";
          streak = streak + 1;
          bonus = streak >= 3 ? 1 : 0;
          delta = base * (x2Applied ? 2 : 1) + bonus;
        } else if (outcomeKey === "wrong") {
          outcome = "Λάθος";
          streak = 0;
          delta = 0;
        } else {
          outcome = "—";
          streak = 0;
          delta = 0;
        }
      }

      running += delta;

      return {
        idx: i + 1,
        category: qi.category || "—",
        prompt: qi.prompt,
        base,
        x2Applied,
        bonus,
        outcome,
        userAnswer,
        delta,
        running,
        isFinal,
      };
    });

    return rows;
  }, [QUESTIONS, answered, x2, wager, playerAnswers]);

  // On entering Category: reset finale flags
  useEffect(() => {
    if (stage !== STAGES.CATEGORY) return;
    setFinalResolved({ p1: false });
    setWager({ p1: 0 });
  }, [stage, index]);

  // X2 helpers
  function canArmX2(side) {
    const player = x2[side];
    return player?.available && !isFinalIndex && stage === STAGES.CATEGORY;
  }
  function armX2(side) {
    if (!canArmX2(side)) return;
    setX2((s) => ({
      ...s,
      [side]: { available: false, armedIndex: index },
    }));
  }
  function isX2ActiveFor(side) {
    const player = x2[side];
    return player?.armedIndex === index;
  }

  // Award base uses category points × (X2 if active), plus streak logic
  function awardToP1(base = 1, { useMultiplier = true } = {}) {
    const baseMult =
      (q.points || 1) * (useMultiplier ? (isX2ActiveFor("p1") ? 2 : 1) : 1);
    const baseDelta = base * baseMult;

    setP1((s) => {
      const newStreak = lastCorrect === "p1" ? s.streak + 1 : 1;
      const streakBonus = newStreak >= 3 ? 1 : 0; // not multiplied
      return {
        ...s,
        score: s.score + baseDelta + streakBonus,
        streak: newStreak,
        maxStreak: Math.max(s.maxStreak, newStreak),
      };
    });
    setLastCorrect("p1");
    setJustScored(true);
    setJustLostStreak(false);
  }

  function noAnswer() {
    setLastCorrect(null);
    setP1((s) => {
      if (s.streak > 0) setJustLostStreak(true);
      return { ...s, streak: 0 };
    });
  }

  function finalizeOutcomeP1(outcome) {
    const bet = wager.p1;
    if (finalResolved.p1) return; // allow 0 wager to proceed
    if (outcome === "correct") {
      setP1((s) => ({ ...s, score: s.score + bet }));
    } else {
      setP1((s) => ({ ...s, score: s.score - bet }));
    }
    setFinalResolved({ p1: true });
    setAnswered((a) => ({ ...a, [index]: outcome === "correct" ? "final-correct" : "final-wrong" }));
  }

  function next() {
    if (stage === STAGES.NAME) {
      setIndex(0);
      setStage(STAGES.INTRO);
    } else if (stage === STAGES.INTRO) {
      setIndex(0);
      setStage(STAGES.CATEGORY);
    } else if (stage === STAGES.CATEGORY) setStage(STAGES.QUESTION);
    else if (stage === STAGES.FINALE) setStage(STAGES.QUESTION);
    else if (stage === STAGES.QUESTION) setStage(STAGES.ANSWER);
    else if (stage === STAGES.ANSWER) {
      if (index < lastIndex) {
        setIndex((i) => i + 1);
        setStage(STAGES.CATEGORY);
      } else setStage(STAGES.RESULTS);
    }
  }
  function previous() {
    // Kept for completeness; not used by current UI (single next button)
    if (stage === STAGES.QUESTION) setStage(STAGES.CATEGORY);
    else if (stage === STAGES.ANSWER) setStage(STAGES.QUESTION);
    else if (stage === STAGES.FINALE) setStage(STAGES.CATEGORY);
    else if (stage === STAGES.RESULTS) setStage(STAGES.ANSWER);
    else if (stage === STAGES.CATEGORY) {
      if (index > 0) {
        setIndex((i) => i - 1);
        setStage(STAGES.ANSWER);
      } else {
        setStage(STAGES.INTRO); // back to Intro from first Category
      }
    }
  }

  function resetGame() {
    setIndex(0);
    setStage(STAGES.NAME); // go to Name after reset
    setP1({ name: p1.name, score: 0, streak: 0, maxStreak: 0 });
    setWager({ p1: 0 });
    setFinalResolved({ p1: false });
    setLastCorrect(null);
    setX2({ p1: { available: true, armedIndex: null } });
    setAnswered({});
    setPlayerAnswers({});
  }

  async function exportShareCard() {
    const w = 1080, h = 1350;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch {}
    }
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, THEME.gradientFrom);
    g.addColorStop(1, THEME.gradientTo);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = `800 64px Inter, Noto Sans, system-ui, sans-serif`;
    ctx.fillText("Ποδοσφαιρικό Κουίζ — Αποτελέσματα Σόλο", w / 2, 140);
    ctx.font = `700 52px Inter, Noto Sans, system-ui, sans-serif`;
    ctx.fillText(`${p1.name}: ${p1.score}`, w / 2, 300);
    ctx.font = `800 76px Inter, Noto Sans, system-ui, sans-serif`;
    ctx.fillText(`Τελικό σκορ: ${p1.score}`, w / 2, 520);
    ctx.font = `600 42px Inter, Noto Sans, system-ui, sans-serif`;
    ctx.fillText(`Μεγαλύτερο σερί — ${p1.maxStreak}`, w / 2, 680);
    ctx.font = `500 30px Inter, Noto Sans, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText("onlyfootballfans • σόλο παιχνίδι", w / 2, h - 80);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "quiz-results.png";
    a.click();
  }

  // ——— UI subcomponents ———
  function HUDHeader({ current, total, score, streak, justScored, justLostStreak }) {
    const pct = total > 0 ? ((current + 1) / total) * 100 : 0;

    return (
      <div className="px-3 pt-4">
        <div className="sticky top-0 z-40">
          <div
            className="mx-auto max-w-4xl rounded-2xl backdrop-blur bg-slate-900/40 ring-1 ring-white/10 px-4 py-3"
            style={{ boxShadow: "0 10px 24px rgba(0,0,0,.25)" }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Left: Progress */}
              <div className="min-w-0 sm:flex-1">
                <div
                  className="text-sm font-semibold text-slate-200"
                  aria-label={`Ερώτηση ${current + 1} από ${total}`}
                >
                  Ερ. {current + 1} από {total}
                </div>
                <div
                  className="mt-1 h-2 w-full rounded-full bg-white/10 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={current + 1}
                  aria-valuemin={0}
                  aria-valuemax={total}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${pct}%`, background: THEME.accent }}
                  />
                </div>
              </div>

              {/* Right: Score & Streak */}
              <div className="flex items-end justify-between gap-8 sm:justify-end">
                <div
                  className={`text-right ${justScored ? "hud-score-pop" : ""}`}
                  aria-label={`Σκορ ${score}`}
                >
                  <div className="text-xs uppercase tracking-wide text-slate-300">Σκορ</div>
                  <div className="text-2xl md:text-3xl font-extrabold text-white">{score}</div>
                </div>

                {streak > 0 && (
                  <div
                    className={`text-right ${justLostStreak ? "hud-streak-shake" : "hud-streak-pulse"}`}
                    aria-label={`Σειρά ${streak}`}
                  >
                    <div className="text-xs uppercase tracking-wide text-slate-300">Σειρά</div>
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-base">🔥</span>
                      <span className="text-lg font-bold text-white">{streak}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function StageCard({ children, variant = "default" }) {
    if (variant === "howto") {
      return <div className="surface-howto text-slate-100">{children}</div>;
    }
    return <div className="card">{children}</div>;
  }

  // ——— NEW: Name Stage ———
  function NameStage() {
    const [tempName, setTempName] = useState(p1.name || "");
    const canProceed = tempName.trim().length >= 2;

    return (
      <StageCard variant="howto">
        <div className="text-center">
          <h1 className="font-display text-3xl font-extrabold">Καλώς ήρθες!</h1>
          <p className="mt-2 text-slate-300 font-ui">
            Γράψε το όνομά σου — θα εμφανίζεται στο σκορ και στα αποτελέσματα.
          </p>
        </div>

        <div className="mt-5 max-w-md mx-auto">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">👤</span>
            <input
              className="w-full rounded-xl bg-slate-900/60 px-3 py-3 pl-9 text-slate-100 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-pink-400"
              placeholder="π.χ. Goat"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              maxLength={18}
              autoFocus
            />
          </div>

          <div className="mt-5 flex justify-center">
            <button
              className="btn btn-accent px-6 py-3 text-base disabled:opacity-50"
              onClick={() => {
                setP1((s) => ({ ...s, name: tempName.trim() }));
                setStage(STAGES.INTRO);
              }}
              disabled={!canProceed}
            >
              Προχώρα
            </button>
          </div>
        </div>
      </StageCard>
    );
  }

  // ——— Intro Stage ———
  function IntroStage() {
    const formatPoints = (ptsArr = []) => {
      const pts = [...ptsArr].sort((a, b) => a - b);
      if (pts.length <= 1) return `×${pts[0] ?? 1}`;
      if (pts.length === 2) return `×${pts[0]} / ×${pts[1]}`;
      return `×${pts[0]}–×${pts[pts.length - 1]}`;
    };

    return (
      <StageCard variant="howto">
        <div className="text-center">
          <h1 className="font-display text-3xl font-extrabold">Ποδοσφαιρικό Κουίζ</h1>
          <p className="mt-2 text-slate-300 font-ui">
            Δες τις κατηγορίες και πάτα «Ας παίξουμε» για να ξεκινήσεις.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800/60 bg-slate-900/40">
          <ul className="divide-y divide-slate-800/60">
            {INTRO_CATEGORIES.map((c) => (
              <li key={c.category} className="px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold">{c.category}</div>
                  {c.count > 1 && (
                    <div className="text-xs text-slate-400 mt-0.5">x{c.count} ερωτήσεις</div>
                  )}
                </div>
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset
                                  bg-fuchsia-600/20 text-fuchsia-300 ring-fuchsia-500/30">
                  {formatPoints(c.points)}
                </span>
              </li>
            ))}

            {/* Final row — keep wager range */}
            {finalCategoryName && (
              <li className="px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold">
                    Τελική ερώτηση — {finalTopicLabel}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">στοίχημα 0×–3×</div>
                </div>
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset
                                  bg-fuchsia-600/20 text-fuchsia-300 ring-fuchsia-500/30">
                  0×–3×
                </span>
              </li>
            )}
          </ul>
        </div>

        <div className="mt-6 flex justify-center">
          <button onClick={next} className="btn btn-accent px-6 py-3 text-base">
            Ας παίξουμε
          </button>
        </div>
      </StageCard>
    );
  }

  function CategoryStage() {
    return (
      <StageCard>
        <div className="flex items-center justify-between">
          <div className="text-rose-400 text-4xl">🏆</div>
          <div className="flex items-center gap-2">
            <div className="pill text-white bg-slate-700/70">
              {isFinalIndex ? "Τελικός 0×–3×" : `Κατηγορία ×${q.points || 1}`}
            </div>
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold tracking-wide font-display">
          {q.category}
        </h2>
        <p className="mt-2 text-center font-ui" style={{ color: THEME.accent }}>
          {isFinalIndex ? "0×–3× Πόντοι" : `x${q.points || 1} Πόντοι`}
        </p>

        {/* X2 (single button) — HIDDEN on Final */}
        {!isFinalIndex && (
          <div className="mt-5 rounded-2xl bg-slate-900/50 p-4">
            <div className="mb-2 text-center text-sm text-slate-300 font-ui">Βοήθεια Χ2</div>
            <div className="max-w-2xl mx-auto flex justify-center">
              <X2Control
                label={p1.name}
                side="p1"
                armed={isX2ActiveFor("p1")}
                available={x2.p1.available}
                onArm={() => armX2("p1")}
                isFinal={isFinalIndex}
              />
            </div>
          </div>
        )}

        {/* Final betting UI on last question */}
        {isFinalIndex && (
          <div className="mt-5 rounded-2xl bg-slate-900/50 p-4">
            <div className="mb-2 text-center text-sm text-slate-300 font-ui">
              Τελικός — Τοποθέτησε το ποντάρισμά σου (0–3) και πάτησε Επόμενο.
            </div>
            <div className="max-w-2xl mx-auto flex justify-center">
              <WagerControl
                label={p1.name}
                value={wager.p1}
                onChange={(n) => setWager({ p1: clamp(n, 0, 3) })}
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <NavButtons />
        </div>
      </StageCard>
    );
  }

  function QuestionStage() {
    const mode = q.answerMode || "text";

    // Local state for CATALOG
    const [catPicked, setCatPicked] = useState(null);
    const [catText, setCatText] = useState("");

    // Local state for TEXT/NUMERIC
    const [inputValue, setInputValue] = useState(() => playerAnswers[index] ?? "");

    // Local state for SCORELINE (keep edits local; persist on submit only)
    const [scoreValue, setScoreValue] = useState(() =>
      typeof playerAnswers[index] === "object" && playerAnswers[index] !== null
        ? playerAnswers[index]
        : { home: 0, away: 0 }
    );

    useEffect(() => {
      setInputValue(playerAnswers[index] ?? "");
      setScoreValue(
        typeof playerAnswers[index] === "object" && playerAnswers[index] !== null
          ? playerAnswers[index]
          : { home: 0, away: 0 }
      );
      setCatPicked(null);
      setCatText("");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index]);

    const submitAndReveal = async (value) => {
      // Build the stored value once, and only persist here
      let stored;
      if (mode === "scoreline") {
        stored = value; // {home, away}
      } else if (mode === "numeric") {
        // If user clicked "Δεν γνωρίζω" pass null to avoid accidental 0 being correct
        if (value === "" || value === null || value === undefined) {
          stored = { value: null };
        } else {
          const n = Number(value);
          stored = { value: Number.isFinite(n) ? n : null };
        }
      } else {
        stored = value; // text or catalog
      }

      setPlayerAnswers((prev) => ({
        ...prev,
        [index]: typeof stored === "object" && stored?.name ? stored.name : stored,
      }));

      setStage(STAGES.ANSWER);

      // Auto-marking for non-text modes
      if (mode !== "text") {
        const result = await validateAny(q, stored?.name ? stored : stored);
        if (!isFinalIndex) {
          setAnswered((a) => ({ ...a, [index]: result.correct ? "correct" : "wrong" }));
          if (result.correct) awardToP1(1);
          else noAnswer();
        } else {
          finalizeOutcomeP1(result.correct ? "correct" : "wrong");
        }
      }
    };

    return (
      <StageCard>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-slate-700/70 px-3 py-1 text-xs font-semibold">
            {isFinalIndex ? "Τελικός 0×–3×" : `Κατηγορία ×${q.points || 1}`}
          </div>
          {isX2ActiveFor("p1") && !isFinalIndex && (
            <div
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ background: THEME.badgeGradient }}
            >
              ×2
            </div>
          )}
        </div>

        <h3 className="mt-4 font-display text-2xl font-bold leading-snug">{q.prompt}</h3>

        {/* Media */}
        <div className="mt-4">
          <Media media={q.media} />
        </div>

        {/* CATALOG */}
        {mode === "catalog" && (
          <div className="mt-5">
            <AutoCompleteAnswer
              catalog={q.catalog}
              placeholder="Άρχισε να πληκτρολογείς…"
              onSelect={(item) => setCatPicked(item)}
              onChangeText={(t) => setCatText(t)}
            />
            <div className="flex flex-wrap gap-3 justify-center mt-3">
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => {
                  const toSubmit = (catPicked && catPicked.name) ? catPicked : catText;
                  submitAndReveal(toSubmit);
                }}
                disabled={!((catPicked && catPicked.name) || (catText && catText.trim().length > 0))}
              >
                Υποβολή
              </button>
              <button type="button" className="btn btn-neutral" onClick={() => submitAndReveal("")}>
                Δεν γνωρίζω
              </button>
            </div>
          </div>
        )}

        {/* SCORELINE */}
        {mode === "scoreline" && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <ScoreInput
              value={scoreValue}
              onChange={(v) => {
                // keep edits local to avoid parent re-render (prevents video restart)
                setScoreValue(v);
              }}
            />
            <div className="flex flex-wrap gap-3 justify-center">
              <button type="button" className="btn btn-accent" onClick={() => submitAndReveal(scoreValue)}>
                Υποβολή σκορ
              </button>
              <button type="button" className="btn btn-neutral" onClick={() => submitAndReveal("")}>
                Δεν γνωρίζω
              </button>
            </div>
          </div>
        )}

        {/* NUMERIC */}
        {mode === "numeric" && (
          <form
            className="mt-5 flex flex-col items-stretch gap-3"
            onSubmit={(e) => { e.preventDefault(); submitAndReveal(inputValue); }}
          >
            <input
              type="number"
              inputMode="numeric"
              className="w-full rounded-xl bg-slate-900/60 px-4 py-3 text-slate-100 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-pink-400"
              placeholder="Πληκτρολόγησε αριθμό…"
              value={inputValue ?? ""}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <div className="flex flex-wrap gap-3 justify-center">
              <button type="submit" className="btn btn-accent">Υποβολή</button>
              <button type="button" className="btn btn-neutral" onClick={() => submitAndReveal("")}>
                Δεν γνωρίζω
              </button>
            </div>
          </form>
        )}

        {/* TEXT */}
        {mode === "text" && (
          <form
            className="mt-5 flex flex-col items-stretch gap-3"
            onSubmit={(e) => { e.preventDefault(); submitAndReveal(inputValue); }}
          >
            <input
              className="w-full rounded-xl bg-slate-900/60 px-4 py-3 text-slate-100 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-pink-400"
              placeholder="Γράψε την απάντησή σου…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoComplete="off"
              autoCapitalize="sentences"
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-3 justify-center">
              <button type="submit" className="btn btn-accent">Υποβολή</button>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => submitAndReveal("")}
                title="Μετάβαση στην απάντηση χωρίς να δοθεί λύση"
              >
                Δεν γνωρίζω
              </button>
            </div>
          </form>
        )}
      </StageCard>
    );
  }

  function AnswerStage() {
    const mode = q.answerMode || "text";
    const rawUser = (playerAnswers && playerAnswers[index]) ?? "";

    // Pretty-print the user's answer
    let userAnswerStr = "—";
    if (mode === "scoreline" && rawUser && typeof rawUser === "object") {
      userAnswerStr = `${rawUser.home ?? 0} - ${rawUser.away ?? 0}`;
    } else if (mode === "numeric" && rawUser && typeof rawUser === "object") {
      userAnswerStr = rawUser.value != null ? String(rawUser.value) : "—";
    } else {
      userAnswerStr = rawUser ? String(rawUser) : "—";
    }

    // correctness & delta for this question
    const outcomeKey = answered[index];
    const currentRow = RESULT_ROWS[index] || null;
    const isCorrect = outcomeKey === "correct" || outcomeKey === "final-correct";
    const isWrong   = outcomeKey === "wrong"   || outcomeKey === "final-wrong";
    const deltaPts  = currentRow ? currentRow.delta : 0;

    return (
      <StageCard>
        <div className="text-center">
          <div className="font-display text-3xl font-extrabold">{q.answer}</div>

          {/* Player answer — colored and with badge */}
          <div className="mt-3 font-ui text-sm">
            <div
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2"
              style={{
                background: isCorrect
                  ? "rgba(16,185,129,0.15)" // green tint
                  : isWrong
                  ? "rgba(244,63,94,0.15)"  // red tint
                  : "rgba(148,163,184,0.10)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <span style={{ opacity: 0.85 }}>Απάντηση Παίκτη:</span>
              <span className="italic text-slate-100">{userAnswerStr}</span>

              {(isCorrect || isWrong) && (
                <span
                  className="ml-2 rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                  style={{ background: isCorrect ? THEME.positiveGrad : THEME.negativeGrad }}
                  title={isCorrect ? "Σωστό" : "Λάθος"}
                >
                  {isCorrect ? "✔" : "✘"} {deltaPts >= 0 ? `+${deltaPts}` : `${deltaPts}`}
                </span>
              )}
            </div>
          </div>

          {q.fact && <div className="mt-2 font-ui text-sm text-slate-300">ℹ️ {q.fact}</div>}
        </div>

        {/* X2 status reminder */}
        <div className="mt-3 text-center text-xs text-slate-400 font-ui">
          {isX2ActiveFor("p1") && !isFinalIndex && <span>(×2 ενεργό)</span>}
        </div>

        {/* Manual awarding controls (only for text mode) */}
        {!isFinalIndex && mode === "text" && (
          <div className="mt-6 flex flex-col items-center gap-3 font-ui">
            <div className="flex flex-wrap justify-center gap-2">
              <button
                className="btn text-white"
                style={{ background: THEME.positiveGrad }}
                onClick={() => { awardToP1(1); setAnswered((a) => ({ ...a, [index]: "correct" })); next(); }}
                title="Σωστό"
              >
                Σωστό
              </button>
              <button
                className="btn text-white"
                style={{ background: THEME.negativeGrad }}
                onClick={() => { noAnswer(); setAnswered((a) => ({ ...a, [index]: "wrong" })); next(); }}
                title="Λάθος / Καμία απάντηση — μηδενίζει το σερί"
              >
                Λάθος / Καμία απάντηση
              </button>
            </div>
          </div>
        )}

        {/* Final scoring controls on last question (text mode only) */}
        {isFinalIndex && mode === "text" && (
          <div className="card font-ui mt-6 text-center">
            <div className="mb-2 text-sm text-slate-300">
              Τελικός — Απονέμονται πόντοι βάσει πονταρίσματος
            </div>
            <div className="text-xs text-slate-400 mb-3">Το Χ2 δεν ισχύει στον Τελικό.</div>
            <div className="space-y-2">
              <div className="text-sm text-slate-300">{p1.name}</div>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  disabled={finalResolved.p1}
                  onClick={() => { finalizeOutcomeP1("correct"); next(); }}
                  className="btn text-white disabled:opacity-50"
                  style={{ background: THEME.positiveGrad }}
                >
                  Σωστό +{wager.p1}
                </button>
                <button
                  disabled={finalResolved.p1}
                  onClick={() => { finalizeOutcomeP1("wrong"); next(); }}
                  className="btn text-white disabled:opacity-50"
                  style={{ background: THEME.negativeGrad }}
                >
                  Λάθος −{wager.p1}
                </button>
                {finalResolved.p1 && <span className="text-xs text-emerald-300">Ολοκληρώθηκε ✔</span>}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <NavButtons />
        </div>
      </StageCard>
    );
  }

  function ResultsStage() {
    // map internal RESULT_ROWS -> ResultsTableResponsive rows
    const rows = useMemo(
      () =>
        RESULT_ROWS.map((r) => ({
          i: r.idx,
          category: r.category,
          points: r.base ?? 0,
          isFinal: r.isFinal,
          correct: r.outcome === "Σωστό" ? true : r.outcome === "Λάθος" ? false : null,
          x2: !!r.x2Applied,
          answerText:
            typeof r.userAnswer === "object" && r.userAnswer
              ? (r.userAnswer.home != null && r.userAnswer.away != null)
                ? `${r.userAnswer.home} - ${r.userAnswer.away}`
                : (r.userAnswer.value != null ? String(r.userAnswer.value) : "")
              : (r.userAnswer || ""),
          streakPoints: !r.isFinal && r.bonus ? 1 : 0,
          delta: r.delta,
          total: r.running,
        })),
      [RESULT_ROWS]
    );

    return (
      <ResultsTableResponsive
        rows={rows}
        title="Αποτελέσματα"
        playerName={p1.name}
        totalScore={p1.score}
        maxStreak={p1.maxStreak}
        onReset={resetGame}
        lang="el"
      />
    );
  }

  // ——— Single-button X2 control ———
  function X2Control({ label, side, available, armed, onArm, isFinal }) {
    const status = available ? "Χ2 διαθέσιμο" : armed ? "Χ2 ενεργό" : "Χ2 χρησιμοποιήθηκε";
    const clickable = available && !isFinal && canArmX2(side);

    return (
      <div className="card font-ui mx-auto text-center">
        <div className="mb-3 text-sm text-slate-300">{label}</div>
        <button
          className="rounded-full px-4 py-2 text-white font-extrabold shadow"
          style={{ background: THEME.badgeGradient }}
          onClick={() => clickable && onArm()}
          disabled={!clickable}
          title={
            isFinal
              ? "Δεν επιτρέπεται στον Τελικό"
              : available
              ? "Ενεργοποίηση Χ2 για αυτόν τον γύρο"
              : "Δεν απομένει Χ2"
          }
        >
          {status}
        </button>
        <div className="mt-2 text-xs text-slate-400">Μπορεί να χρησιμοποιηθεί μόνο μία φορά.</div>
      </div>
    );
  }

  function WagerControl({ label, value, onChange }) {
    return (
      <div className="card font-ui text-center flex flex-col items-center">
        <div className="mb-3 text-sm text-slate-300">{label}</div>
        <div className="flex items-center gap-2 justify-center">
          <button className="btn btn-neutral" onClick={() => onChange(value - 1)}>−</button>
          <div className="pill text-white text-xl px-5 py-2" style={{ background: THEME.badgeGradient }}>
            {value}
          </div>
          <button className="btn btn-neutral" onClick={() => onChange(value + 1)}>+</button>
        </div>
        <div className="mt-2 text-xs text-slate-400">Ποντάρισμα 0–3 πόντοι</div>
      </div>
    );
  }

  // ——— Single-forward Nav ———
  function NavButtons() {
    const nextDisabled =
      stage === STAGES.ANSWER
        ? (!isFinalIndex ? !answered[index] : !finalResolved.p1)
        : false;

    const isFinalAnswerStage = stage === STAGES.ANSWER && isFinalIndex;

    // On the last question's Answer stage: show one CTA to go to results
    if (isFinalAnswerStage) {
      return (
        <div className="flex items-center justify-center">
          <button
            onClick={() => setStage(STAGES.RESULTS)}
            className="btn btn-accent disabled:opacity-50"
            disabled={nextDisabled}
            title={nextDisabled ? "Καταχώρισε πρώτα την απάντηση" : "Προβολή αποτελεσμάτων"}
          >
            Δες πώς τα πήγες →
          </button>
        </div>
      );
    }

    const label =
      stage === STAGES.CATEGORY
        ? "επόμενη ερώτηση"
        : stage === STAGES.ANSWER
        ? "Επόμενη κατηγορία"
        : "Επόμενο →";

    const title =
      stage === STAGES.ANSWER && nextDisabled
        ? "Καταχώρισε πρώτα την απάντηση"
        : "Επόμενο";

    return (
      <div className="flex items-center justify-center">
        <button
          onClick={next}
          className="btn btn-accent disabled:opacity-50"
          disabled={nextDisabled}
          title={title}
        >
          {label}
        </button>
      </div>
    );
  }

  // ——— Lightweight self-tests ———
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#selftest") return;
    try {
      const applyFinal = (score, bet, outcome) =>
        outcome === "correct" ? score + bet : score - bet;
      console.assert(
        applyFinal(10, 3, "correct") === 13,
        "Final: +bet on correct"
      );
      console.assert(applyFinal(10, 2, "wrong") === 8, "Final: -bet on wrong");
      const streakBonus = (prev, same) =>
        (same ? prev + 1 : 1) >= 3 ? 1 : 0;
      console.assert(
        streakBonus(2, true) === 1 && streakBonus(1, true) === 0,
        "Streak bonus from 3rd correct"
      );
      console.log("%cSelf-tests passed (solo)", "color: #10b981");
    } catch (e) {
      console.warn("Self-tests failed", e);
    }
  }, []);

  return (
    <div
      className="min-h-screen w-full flex justify-center items-start p-4"
      style={{
        background: `linear-gradient(180deg, ${THEME.gradientFrom}, ${THEME.gradientTo})`,
      }}
    >
      <div className="w-full max-w-4xl space-y-4 text-slate-100">
        {/* NEW HUD header */}
        <HUDHeader
          current={index}
          total={QUESTIONS.length}
          score={p1.score}
          streak={p1.streak}
          justScored={justScored}
          justLostStreak={justLostStreak}
        />

        {/* Optional HowTo modal trigger if needed in future:
            <button onClick={() => setShowHowTo(true)} className="pill bg-white text-black">Οδηγίες</button>
        */}
        {showHowTo && <HowToModal onClose={() => setShowHowTo(false)} />}

        {stage === STAGES.NAME && <NameStage />}
        {stage === STAGES.INTRO && <IntroStage />}
        {stage === STAGES.CATEGORY && <CategoryStage />}
        {stage === STAGES.QUESTION && <QuestionStage />}
        {stage === STAGES.ANSWER && <AnswerStage />}
        {stage === STAGES.RESULTS && <ResultsStage />}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-300 font-ui">
          <div>Στάδιο: {stageLabel(stage)}</div>
          <div className="flex items-center gap-3">
            <button className="btn btn-neutral" onClick={resetGame}>
              Επαναφορά παιχνιδιού
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function stageLabel(stage) {
  switch (stage) {
    case STAGES.NAME:
      return "Όνομα παίκτη";
    case STAGES.INTRO:
      return "Εισαγωγή";
    case STAGES.CATEGORY:
      return "Στάδιο Κατηγορίας";
    case STAGES.QUESTION:
      return "Στάδιο Ερώτησης";
    case STAGES.ANSWER:
      return "Στάδιο Απάντησης";
    case STAGES.FINALE:
      return "Τελικός (Στοίχημα)";
    case STAGES.RESULTS:
      return "Αποτελέσματα";
    default:
      return "";
  }
}

function HowToModal({ onClose, totalQuestions = 9 }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="min-h-full flex items-start sm:items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="relative w-full max-w=[680px] max-w-[680px] font-ui rounded-2xl shadow-xl ring-1 ring-white/10 bg-[var(--howto-bg)] text-slate-100 flex flex-col overflow-hidden max-h-[clamp(420px,85dvh,760px)]">
          <div className="sticky top-0 z-10 px-6 py-4 bg-[var(--howto-bg)] backdrop-blur-sm rounded-t-2xl flex items-center justify-between border-b border-white/10">
            <h2 className="font-display text-2xl font-extrabold">Πώς παίζεται</h2>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="btn btn-neutral">Κλείσιμο ✕</button>
            </div>
          </div>

          <div className="scroll-area px-6 pb-6 pt-2 flex-1 min-h-0 text-slate-100 text-sm md:text-base leading-relaxed">
            <ul className="mt-2 list-disc pl-5 space-y-2">
              <li><strong>{totalQuestions} ερωτήσεις.</strong> Κάθε μία έχει συγκεκριμένους πόντους (ανάλογα με τη δυσκολία).</li>
              <li><strong>Στόχος:</strong> μάζεψε όσο περισσότερους πόντους μπορείς.</li>
              <li><strong>Ροή:</strong> Όνομα → Εισαγωγή → Κατηγορία → Ερώτηση → Απάντηση.</li>
              <li><strong>Χ2:</strong> Στο στάδιο Κατηγορίας μπορείς να ενεργοποιήσεις το Χ2. Αυτό γίνεται <strong>μία φορά</strong> ανά παιχνίδι.</li>
              <li><strong>Σερί:</strong> Από την <strong>3η συνεχόμενη σωστή</strong> και μετά, παίρνεις έξτρα <strong>+1</strong> (δεν διπλασιάζεται).</li>
              <li><strong>Τελική ερώτηση (στοίχημα 0–3):</strong> Πριν την τελευταία ερώτηση, διάλεξε πόσους πόντους θα ρισκάρεις (0–3). Αν απαντήσεις σωστά, <strong>κερδίζεις</strong> τόσους πόντους· αν απαντήσεις λάθος/δεν απαντήσεις, <strong>χάνεις</strong> τους ίδιους. <em>Το Χ2 δεν ισχύει στον Τελικό.</em></li>
            </ul>
            <div className="howto-shadow" />
          </div>
        </div>
      </div>
    </div>
  );
}
