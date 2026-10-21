import { useEffect, useRef, useState } from "react";
import curriculumData from "../curriculum.json";

/**
 * The interactive pieces of the ArchitectIQ story: a played-back interview, the real curriculum, a scorecard and
 * the five interviewers. The transcript is an illustration of the engine's behaviour (its lines come from the
 * project's README); the curriculum is the repository's own curriculum.json.
 */

const SCRIPT = [
  { who: "interviewer", text: "Let's design a URL shortener. Before we start, what questions do you have about the requirements?" },
  { who: "you", text: "Reads matter more than writes, so I'd use eventual consistency everywhere and put Kafka in front of the database." },
  { who: "interviewer", text: "You said Kafka. Why Kafka and not RabbitMQ? What's the partition strategy?", tag: "Probes the name you dropped" },
  { who: "you", text: "Partition by short code. And after creating a link, the user is redirected to its stats page right away." },
  { who: "interviewer", text: "Earlier you said eventual consistency is fine. But this design requires reading your own writes. Which is it?", tag: "Catches the contradiction" },
] as const;

export function Transcript() {
  const [shown, setShown] = useState(0);
  const [typed, setTyped] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting && !started.current) { started.current = true; setShown(1); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (shown === 0 || shown > SCRIPT.length) return;
    const line = SCRIPT[shown - 1]!.text;
    let i = 0;
    setTyped("");
    const id = setInterval(() => {
      i += 2;
      setTyped(line.slice(0, i));
      if (i >= line.length) {
        clearInterval(id);
        if (shown < SCRIPT.length) setTimeout(() => setShown((s) => s + 1), 650);
      }
    }, 16);
    return () => clearInterval(id);
  }, [shown]);

  return (
    <div ref={box} className="grid gap-3" aria-live="polite">
      {SCRIPT.slice(0, shown).map((m, i) => {
        const current = i === shown - 1;
        const text = current ? typed : m.text;
        const me = m.who === "you";
        return (
          <div key={i} className={`flex ${me ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-[18px] border px-4 py-3 backdrop-blur-md ${me ? "border-line bg-white/[0.04]" : "tag" in m ? "border-accent/60 bg-accent/[0.08]" : "border-line-strong bg-bg/70"}`}>
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">{me ? "You" : "Interviewer"}{"tag" in m && !current && <span className="ml-2 text-accent">· {m.tag}</span>}</p>
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink/90">{text}{current && <span className="ml-0.5 inline-block h-[1em] w-[0.5ch] translate-y-[0.15em] animate-pulse bg-accent" aria-hidden />}</p>
            </div>
          </div>
        );
      })}
      {shown >= SCRIPT.length && typed.length >= SCRIPT[SCRIPT.length - 1]!.text.length && (
        <button type="button" onClick={() => { setShown(1); }} className="mt-2 self-start font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted hover:text-ink">↺ Replay</button>
      )}
    </div>
  );
}

type Lesson = { id: string; title: string };
type Module = { id: string; title: string; description?: string; lessons: Lesson[] };
type Tier = { id: string; title: string; modules: Module[] };
export const TIERS = (curriculumData as { tiers: Tier[] }).tiers;
export const TIER_SHAPE = TIERS.map((t) => t.modules.map((m) => m.lessons.length));

export function Curriculum() {
  const [tier, setTier] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const t = TIERS[tier]!;
  return (
    <div className="rounded-[22px] border border-line bg-bg/60 p-2 backdrop-blur-md">
      <div role="tablist" aria-label="Tiers" className="flex gap-1 overflow-x-auto p-1 [scrollbar-width:none]">
        {TIERS.map((x, i) => (
          <button key={x.id} role="tab" aria-selected={i === tier} type="button" onClick={() => { setTier(i); setOpen(null); }}
            className={`whitespace-nowrap rounded-[12px] px-3.5 py-2 font-mono text-[0.75rem] uppercase tracking-[0.1em] transition-colors ${i === tier ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>
            Tier {i}
          </button>
        ))}
      </div>
      <div className="px-4 pb-3 pt-4">
        <p className="title text-[1.5rem]">{t.title}</p>
        <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted">{t.modules.length} modules · {t.modules.reduce((n, m) => n + m.lessons.length, 0)} lessons</p>
      </div>
      <ul className="max-h-[46vh] divide-y divide-line overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
        {t.modules.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => setOpen(open === m.id ? null : m.id)} className="flex w-full items-center justify-between gap-4 px-2 py-3 text-left">
              <span className="text-[0.9375rem] text-ink">{m.title}</span>
              <span className="shrink-0 font-mono text-[0.6875rem] text-muted">{m.lessons.length} {open === m.id ? "−" : "+"}</span>
            </button>
            {open === m.id && (
              <ol className="mb-3 grid gap-1.5 px-2">
                {m.lessons.map((l, i) => <li key={l.id} className="text-[0.8125rem] text-muted"><span className="mr-2 font-mono text-dim">{String(i + 1).padStart(2, "0")}</span>{l.title}</li>)}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const SCORES = [
  ["Requirements gathering", 8], ["Capacity estimation", 10], ["API design", 6], ["Database design", 8],
  ["Caching strategy", 8], ["Scalability", 10], ["Failure handling", 8], ["Communication", 8],
] as const;

export function Scorecard() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setOn(true), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="rounded-[22px] border border-line bg-bg/60 p-6 backdrop-blur-md">
      <p className="label">Scorecard · Staff bar 75</p>
      <ul className="mt-5 grid gap-3">
        {SCORES.map(([k, v], i) => (
          <li key={k} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5">
            <span className="text-[0.875rem] text-ink/85">{k}</span>
            <span className="font-mono text-[0.75rem] tabular-nums text-muted">{v}/10</span>
            <span className="col-span-2 h-1 overflow-hidden rounded-full bg-line">
              <span className="block h-full rounded-full bg-accent transition-[width] duration-[1400ms] ease-out-expo" style={{ width: on ? `${v * 10}%` : "0%", transitionDelay: `${i * 80}ms` }} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-6 flex items-baseline justify-between border-t border-line pt-4">
        <span className="title text-[2.4rem] tabular-nums">82<span className="text-[1rem] text-muted">/100</span></span>
        <span className="font-mono text-[0.75rem] uppercase tracking-[0.14em] text-accent">Passed</span>
      </p>
      <p className="mt-2 text-[0.75rem] text-dim">Example scorecard, from the project README.</p>
    </div>
  );
}

const PERSONAS = [
  { level: "SDE2", who: "The Mentor", tone: "Warm, patient", minutes: 30, bar: "A basic working design. Trade-offs are a bonus." },
  { level: "Senior", who: "The Tech Lead", tone: "Friendly but rigorous", minutes: 40, bar: "Drive the design. Do the capacity math. Discuss trade-offs." },
  { level: "Staff", who: "The Principal Engineer", tone: "Direct, no hand-holding", minutes: 45, bar: "Drive everything. Go two or three levels deep. Production-grade failure handling." },
  { level: "Principal", who: "The VP of Engineering", tone: "A peer conversation", minutes: 50, bar: "Architecture across teams. Cost analysis. Migration strategy." },
  { level: "VP", who: "The CTO", tone: "Strategic, business-aligned", minutes: 55, bar: "Business context first. Regulation. Org design. A three-year vision." },
];

export function Personas() {
  const [i, setI] = useState(2);
  const p = PERSONAS[i]!;
  return (
    <div className="rounded-[22px] border border-line bg-bg/60 p-2 backdrop-blur-md">
      <div role="tablist" aria-label="Career level" className="grid grid-cols-5 gap-1 p-1">
        {PERSONAS.map((x, k) => (
          <button key={x.level} role="tab" aria-selected={k === i} type="button" onClick={() => setI(k)}
            className={`rounded-[12px] px-2 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.08em] transition-colors ${k === i ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>{x.level}</button>
        ))}
      </div>
      <div className="p-5">
        <p className="title text-[1.75rem]">{p.who}</p>
        <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-accent">{p.tone} · {p.minutes} min</p>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink/80">{p.bar}</p>
      </div>
    </div>
  );
}
