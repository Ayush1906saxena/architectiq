import { useEffect, useRef, useState, type ReactNode } from "react";

/** Shared pieces of the project site: loading screen, cursor, the bar, a terminal block. */

export function Preloader({ progress, done, label }: { progress: number; done: boolean; label: string }) {
  return (
    <div aria-hidden={done} className={`fixed inset-0 z-[60] flex flex-col justify-between bg-bg/85 p-6 transition-opacity duration-1000 ease-out-expo md:p-10 ${done ? "pointer-events-none opacity-0" : "opacity-100"}`}>
      <p className="label">{label}</p>
      <p className="mega self-end font-mono text-[clamp(4rem,14vw,11rem)] !tracking-[-0.06em] tabular-nums">{String(Math.round(progress * 100)).padStart(3, "0")}</p>
      <div className="absolute inset-x-0 bottom-0 h-px bg-line"><div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${progress * 100}%` }} /></div>
    </div>
  );
}

export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, big = 0, bigT = 0, raf = 0;
    const move = (e: PointerEvent) => { x = e.clientX; y = e.clientY; bigT = (e.target as HTMLElement).closest("a,button,[data-hover]") ? 1 : 0; };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      rx += (x - rx) * 0.16; ry += (y - ry) * 0.16; big += (bigT - big) * 0.15;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%) scale(${1 - big})`;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%) scale(${1 + big * 1.6})`;
    };
    addEventListener("pointermove", move, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => { removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] hidden mix-blend-difference [@media(hover:hover)_and_(pointer:fine)]:block">
      <div ref={dot} className="absolute left-0 top-0 size-1.5 rounded-full bg-white" />
      <div ref={ring} className="absolute left-0 top-0 size-9 rounded-full border border-white/70" />
    </div>
  );
}

export function Bar({ name, chapters, chapter, progress, repo }: { name: string; chapters: string[]; chapter: number; progress: number; repo: string }) {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-5 mix-blend-difference md:px-10 md:py-7">
        <a href="#top" className="font-mono text-[0.8125rem] font-medium tracking-[0.08em] text-white">{name.toUpperCase()}</a>
        <nav aria-label="Links" className="flex items-center gap-5 font-mono text-[0.75rem] uppercase tracking-[0.12em] text-white md:gap-8">
          <a href="#run" className="hidden sm:inline">Run it</a>
          <a href={repo} target="_blank" rel="noreferrer">GitHub ↗</a>
          <a href="https://ayush1906saxena.github.io/" className="hidden md:inline">By Ayush Saxena ↗</a>
        </nav>
      </header>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-end justify-between px-5 pb-5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-white mix-blend-difference md:px-10 md:pb-7">
        <p className="tabular-nums"><span className="text-white/50">{String(chapter + 1).padStart(2, "0")} / {String(chapters.length).padStart(2, "0")}</span><span className="ml-3">{chapters[chapter]}</span></p>
        <span className="relative block h-px w-24 bg-white/25 md:w-40"><span className="absolute inset-y-0 left-0 bg-white" style={{ width: `${progress * 100}%` }} /></span>
      </div>
    </>
  );
}

/** A terminal block with a copy button. */
export function Terminal({ lines, title = "terminal" }: { lines: string[]; title?: string }) {
  const [copied, setCopied] = useState(false);
  const text = lines.filter((l) => !l.startsWith("#")).join("\n");
  return (
    <div className="overflow-hidden rounded-[18px] border border-line-strong bg-[#0b0c0e]/90 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-white/15" />)}</span>
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted">{title}</span>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
          className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink">{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[0.8125rem] leading-relaxed"><code>
        {lines.map((l, i) => <span key={i} className={`block ${l.startsWith("#") ? "text-dim" : "text-ink"}`}>{l.startsWith("#") ? l : <><span className="text-accent">$ </span>{l}</>}</span>)}
      </code></pre>
    </div>
  );
}

export function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return <section id={id} data-scene className={`relative px-5 md:px-10 ${className}`}>{children}</section>;
}
