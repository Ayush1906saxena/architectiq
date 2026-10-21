import gsap from "gsap";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { useEffect, useRef, useState } from "react";
import type { Engine } from "./engine/Stage";
import { Bar, Cursor, Preloader, Section, Terminal } from "./ui/Kit";
import { Curriculum, Personas, SCORES, Scorecard, TIERS, TIER_SHAPE, Transcript } from "./ui/Demos";

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

const REPO = "https://github.com/Ayush1906saxena/architectiq";
const ACCENT = "#4f8cff";
const CHAPTERS = ["ArchitectIQ", "The interview", "The curriculum", "The engine", "The scorecard", "The interviewers", "Run it"];
const LESSONS = TIERS.reduce((n, t) => n + t.modules.reduce((k, m) => k + m.lessons.length, 0), 0);
const MODULES = TIERS.reduce((n, t) => n + t.modules.length, 0);
const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [scroll, setScroll] = useState(0);
  const [stats, setStats] = useState<{ backend: string; count: number } | null>(null);

  useEffect(() => {
    let alive = true;
    let engine: Engine | null = null;
    Promise.all([import("./engine/Stage"), import("./shapes")]).then(async ([{ startEngine, P }, s]) => {
      engine = await startEngine(canvas.current!, {
        reduced, accent: ACCENT, onProgress: (p) => alive && setProgress(p),
        shapes: [
          (n) => s.system(n), (n) => s.dialogue(n), (n) => s.curriculum(n, TIER_SHAPE), (n) => s.layers(n),
          (n) => s.radar(n, SCORES.map(([, v]) => v / 10)), (n) => s.personas(n), (n) => s.word(n, "ARCHITECTIQ", "'Archivo Variable', sans-serif"),
        ],
        placements: [
          { desk: P(1.75, 0, 0.74, -0.25, 0, 0.12), phone: P(0, 1.65, 0.3, -0.2, 0, 0.12) },
          { desk: P(-1.7, 0, 0.95, 0.15), phone: P(0, 1.3, 0.55) },
          { desk: P(1.75, -0.05, 0.62, -0.35, 0.05, 0.3), phone: P(0, 1.3, 0.34, -0.3, 0.05, 0.3) },
          { desk: P(-1.7, 0, 0.82, 0.5, 0.1, 0.45), phone: P(0, 1.3, 0.5, 0.5, 0.1, 0.45) },
          { desk: P(1.8, 0, 0.88), phone: P(0, 1.35, 0.52) },
          { desk: P(-1.75, 0, 1.25, 0, 0.12, 0.5), phone: P(0, 1.35, 0.75, 0, 0.12, 0.5) },
          { desk: P(0, 1.25, 0.6), phone: P(0, 1.5, 0.4) },
        ],
      });
      if (!alive) return engine.dispose();
      engine.onChapter(setChapter);
      setStats({ backend: engine.backend, count: engine.count });
      setTimeout(() => alive && setReady(true), 300);
    }).catch(() => { if (alive) setReady(true); });
    return () => { alive = false; engine?.dispose(); };
  }, []);

  useEffect(() => {
    if (reduced) {
      const on = () => setScroll(scrollY / Math.max(1, document.body.scrollHeight - innerHeight));
      addEventListener("scroll", on, { passive: true });
      return () => removeEventListener("scroll", on);
    }
    const lenis = new Lenis({ lerp: 0.085 });
    lenis.on("scroll", (l: Lenis) => { ScrollTrigger.update(); setScroll(l.progress); });
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
      a.addEventListener("click", (e) => { e.preventDefault(); lenis.scrollTo(a.getAttribute("href")!, { duration: 1.6 }); }));
    return () => { gsap.ticker.remove(tick); lenis.destroy(); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const ctx = gsap.context(() => {
      document.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
        const split = SplitText.create(el, { type: "lines,words", mask: "lines", linesClass: "split-line" });
        gsap.from(split.words, { yPercent: 115, duration: reduced ? 0 : 1.2, ease: "expo.out", stagger: 0.035,
          scrollTrigger: el.dataset.split === "now" ? undefined : { trigger: el, start: "top 85%" }, delay: el.dataset.split === "now" ? 0.1 : 0 });
      });
      document.querySelectorAll<HTMLElement>("[data-scramble]").forEach((el) =>
        gsap.from(el, { duration: reduced ? 0 : 1, scrambleText: { text: el.textContent ?? "", chars: "01#/<>_", speed: 0.6 }, scrollTrigger: { trigger: el, start: "top 90%" } }));
      document.querySelectorAll<HTMLElement>("[data-rise]").forEach((el) =>
        gsap.from(el, { opacity: 0, y: 40, filter: "blur(8px)", duration: reduced ? 0 : 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } }));
      document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
        const o = { v: 0 };
        gsap.to(o, { v: Number(el.dataset.count), duration: reduced ? 0 : 1.6, ease: "power3.out", onUpdate: () => { el.textContent = String(Math.round(o.v)); }, scrollTrigger: { trigger: el, start: "top 90%" } });
      });
    });
    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [ready]);

  return (
    <>
      <canvas ref={canvas} aria-hidden className="fixed inset-0 z-0 h-[100lvh] w-full" />
      <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-[5] h-[64svh] bg-gradient-to-t from-bg from-45% via-bg/85 to-transparent md:hidden" />
      <Preloader progress={progress} done={ready} label="ArchitectIQ · drawing the system" />
      <Cursor />
      <Bar name="ArchitectIQ" chapters={CHAPTERS} chapter={chapter} progress={scroll} repo={REPO} />

      <main id="top" className="relative z-10">
        <Section className="flex min-h-[100svh] flex-col justify-end pb-24 pt-28 md:justify-center md:pb-16">
          <div className="max-w-[640px]">
            <p className="label legible" data-scramble>Open source · system design academy</p>
            <h1 className="title legible mt-5 text-[clamp(1.9rem,4.3vw,4.2rem)]" data-split="now">The system design interviewer that actually interviews you.</h1>
            <p className="legible mt-6 max-w-[46ch] text-[clamp(1.05rem,1.4vw,1.25rem)] leading-snug text-ink/85" data-rise>
              {LESSONS} lessons from first principles, then a live mock interview that never gives you the answer, catches your
              contradictions and scores you on 8 dimensions.
            </p>
            <div className="mt-9 flex flex-wrap gap-3" data-rise>
              <a href="#run" className="rounded-full bg-ink px-6 py-3.5 text-[0.9375rem] font-semibold text-bg">Run it in one command</a>
              <a href={REPO} target="_blank" rel="noreferrer" className="rounded-full border border-line-strong px-6 py-3.5 text-[0.9375rem] font-medium hover:border-ink">Source on GitHub ↗</a>
            </div>
            <dl className="mt-12 hidden max-w-[560px] grid-cols-4 gap-4 border-t border-line pt-6 sm:grid" data-rise>
              {[[LESSONS, "lessons"], [MODULES, "modules"], [10, "problems"], [8, "dimensions"]].map(([v, l]) => (
                <div key={l}><dt className="sr-only">{l}</dt><dd className="title text-[clamp(1.6rem,2.6vw,2.2rem)]"><span data-count={v}>{v}</span></dd><dd className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted">{l}</dd></div>
              ))}
            </dl>
          </div>
        </Section>

        <Section className="flex min-h-[120svh] items-end pb-28 pt-[56svh] md:items-center md:py-32">
          <div className="grid w-full max-w-[1400px] md:grid-cols-12">
            <div className="md:col-span-6 md:col-start-7 lg:col-span-5 lg:col-start-8">
              <p className="label" data-scramble>01 / The interview</p>
              <h2 className="title legible mt-5 text-[clamp(2rem,3.6vw,3.3rem)]" data-split>It never gives you the answer.</h2>
              <p className="legible mt-5 text-[1rem] leading-relaxed text-ink/80" data-rise>It asks the question that reveals whether you know it. Name-drop a technology and it asks why. Contradict yourself and it notices.</p>
              <div className="mt-8" data-rise><Transcript /></div>
              <p className="mt-3 text-[0.75rem] text-dim">An illustration of the engine's behaviour; the interviewer's lines are from the project README.</p>
            </div>
          </div>
        </Section>

        <Section className="flex min-h-[130svh] items-end pb-28 pt-[56svh] md:items-center md:py-32">
          <div className="grid w-full max-w-[1400px] md:grid-cols-12">
            <div className="md:col-span-6 lg:col-span-5">
              <p className="label" data-scramble>02 / The curriculum</p>
              <h2 className="title legible mt-5 text-[clamp(2rem,3.6vw,3.3rem)]" data-split>From "what is a computer" to ML systems.</h2>
              <p className="legible mt-5 text-[1rem] leading-relaxed text-ink/80" data-rise>Seven tiers, {MODULES} modules, {LESSONS} lessons. Every point of light beside this text is one real lesson, floor by floor. Explore them:</p>
              <div className="mt-8" data-rise><Curriculum /></div>
            </div>
          </div>
        </Section>

        <Section className="flex min-h-[120svh] items-end pb-28 pt-[56svh] md:items-center md:py-32">
          <div className="grid w-full max-w-[1400px] md:grid-cols-12">
            <div className="md:col-span-6 md:col-start-7 lg:col-span-5 lg:col-start-8">
              <p className="label" data-scramble>03 / The engine</p>
              <h2 className="title legible mt-5 text-[clamp(2rem,3.6vw,3.3rem)]" data-split>Only the voice is an LLM.</h2>
              <p className="legible mt-5 text-[1rem] leading-relaxed text-ink/80" data-rise>Four layers. Three of them are deterministic code, so the interviewer always catches contradictions, always probes shallow claims and always moves on at the right time, whatever the model. You can't talk it into a better grade.</p>
              <ol className="mt-8 grid gap-2" data-rise>
                {[["4", "Speaker", "Turns actions into natural dialogue", true], ["3", "Strategist", "Picks the next move from 11 priority tiers", false], ["2", "Tracker", "Coverage, contradictions, depth, phase, rubric", false], ["1", "Analyzer", "Concepts, numbers and depth from your words", false]].map(([n, k, v, llm]) => (
                  <li key={k as string} className={`flex items-center gap-4 rounded-[16px] border px-4 py-3 backdrop-blur-md ${llm ? "border-accent/60 bg-accent/[0.08]" : "border-line bg-bg/60"}`}>
                    <span className="font-mono text-[0.75rem] text-muted">{n}</span>
                    <span className="min-w-[6.5rem] font-semibold">{k}</span>
                    <span className="flex-1 text-[0.875rem] text-ink/75">{v}</span>
                    <span className={`font-mono text-[0.625rem] uppercase tracking-[0.12em] ${llm ? "text-accent" : "text-dim"}`}>{llm ? "LLM" : "Code"}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Section>

        <Section className="flex min-h-[120svh] items-end pb-28 pt-[56svh] md:items-center md:py-32">
          <div className="grid w-full max-w-[1400px] md:grid-cols-12">
            <div className="md:col-span-6 lg:col-span-5">
              <p className="label" data-scramble>04 / The scorecard</p>
              <h2 className="title legible mt-5 text-[clamp(2rem,3.6vw,3.3rem)]" data-split>Not pass or fail. Exactly where you're weak.</h2>
              <p className="legible mt-5 text-[1rem] leading-relaxed text-ink/80" data-rise>Every interview ends with a rubric across eight dimensions, against the bar for the level you chose.</p>
              <div className="mt-8" data-rise><Scorecard /></div>
            </div>
          </div>
        </Section>

        <Section className="flex min-h-[110svh] items-end pb-28 pt-[56svh] md:items-center md:py-32">
          <div className="grid w-full max-w-[1400px] md:grid-cols-12">
            <div className="md:col-span-6 md:col-start-7 lg:col-span-5 lg:col-start-8">
              <p className="label" data-scramble>05 / The interviewers</p>
              <h2 className="title legible mt-5 text-[clamp(2rem,3.6vw,3.3rem)]" data-split>Warm for SDE2. Unforgiving for Staff.</h2>
              <p className="legible mt-5 text-[1rem] leading-relaxed text-ink/80" data-rise>Five personas, each with its own time limit, tone and bar.</p>
              <div className="mt-8" data-rise><Personas /></div>
            </div>
          </div>
        </Section>

        <Section id="run" className="flex min-h-[110svh] flex-col justify-end pb-28 pt-[48svh] md:pt-[44svh]">
          <div className="mx-auto w-full max-w-[1100px]">
            <p className="label text-center" data-scramble>06 / Run it</p>
            <h2 className="title legible mx-auto mt-5 max-w-[20ch] text-center text-[clamp(2rem,4.4vw,4rem)]" data-split>One command. No API key.</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2" data-rise>
              <Terminal title="docker" lines={["# prebuilt images from GitHub Packages", "git clone https://github.com/Ayush1906saxena/architectiq.git", "cd architectiq", "docker compose pull && docker compose up", "# open http://localhost:3000"]} />
              <div className="grid content-start gap-3 text-[0.9375rem] text-ink/80">
                <p>The interviewer runs on the bundled Ollama (llama3.2, pulled on first start). Add a free Groq key for faster answers.</p>
                <ul className="grid gap-2 font-mono text-[0.75rem] text-muted">
                  <li>ghcr.io/ayush1906saxena/architectiq-frontend</li>
                  <li>ghcr.io/ayush1906saxena/architectiq-backend</li>
                </ul>
                <div className="mt-3 flex flex-wrap gap-3">
                  <a href={REPO} target="_blank" rel="noreferrer" className="rounded-full bg-ink px-6 py-3 text-[0.875rem] font-semibold text-bg">GitHub ↗</a>
                  <a href={`${REPO}#readme`} target="_blank" rel="noreferrer" className="rounded-full border border-line-strong px-6 py-3 text-[0.875rem] hover:border-ink">Read the docs ↗</a>
                </div>
              </div>
            </div>
            <p className="mx-auto mt-16 max-w-[70ch] text-center font-mono text-[0.6875rem] uppercase leading-relaxed tracking-[0.12em] text-dim">
              Built by <a href="https://ayush1906saxena.github.io/" className="underline underline-offset-4 hover:text-ink">Ayush Saxena</a> · Next.js, FastAPI, Groq or Ollama · this page: three.js TSL compute{stats ? ` on ${stats.backend}, ${stats.count.toLocaleString("en-US")} particles` : ""}
            </p>
          </div>
        </Section>
      </main>
    </>
  );
}
