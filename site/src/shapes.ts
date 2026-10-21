/**
 * The shapes the particles become, one per chapter. Each fills N points as (x, y, z, tone): tone 0..1 is how bright a
 * particle is; tone + 2 marks it as an accent particle. Everything fits roughly in x -2.6..2.6, y -1.8..1.8.
 */
export type Shape = Float32Array;

/** mulberry32: small, fast, and free of the lattice lines that simple LCGs draw in 2D. */
function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ACCENT = 2;

/** Splits N points across parts by weight, so every shape uses every particle. */
function split(n: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.floor((n * w) / total));
  counts[0]! += n - counts.reduce((a, b) => a + b, 0);
  return counts;
}

function writer(n: number) {
  const out = new Float32Array(n * 4);
  let i = 0;
  return {
    out,
    put(x: number, y: number, z: number, tone: number) {
      if (i >= n) return;
      out[i * 4] = x; out[i * 4 + 1] = y; out[i * 4 + 2] = z; out[i * 4 + 3] = tone;
      i++;
    },
    get done() { return i; },
  };
}

/** A loose sphere of dust: where everything starts before it finds a form. */
export function cloud(n: number): Shape {
  const w = writer(n);
  const r = rng(3);
  for (let k = 0; k < n; k++) {
    const u = r() * 2 - 1, t = r() * Math.PI * 2, rad = 3 + Math.pow(r(), 0.5) * 5;
    const s = Math.sqrt(1 - u * u);
    w.put(Math.cos(t) * s * rad, u * rad * 0.7, Math.sin(t) * s * rad - 2, r() * 0.5);
  }
  return w.out;
}

/** ArchitectIQ: a system design drawn in light. Client, load balancer, three services, a cache, two databases. */
export function system(n: number): Shape {
  const w = writer(n);
  const r = rng(9);
  type Box = { c: [number, number, number]; s: [number, number, number]; kind: "box" | "db"; hot?: boolean };
  const boxes: Box[] = [
    { c: [-2.3, 0, 0], s: [0.42, 0.62, 0.1], kind: "box" },
    { c: [-1.2, 0, 0], s: [0.3, 0.9, 0.3], kind: "box", hot: true },
    { c: [0.1, 0.95, 0], s: [0.55, 0.32, 0.32], kind: "box" },
    { c: [0.1, 0, 0], s: [0.55, 0.32, 0.32], kind: "box" },
    { c: [0.1, -0.95, 0], s: [0.55, 0.32, 0.32], kind: "box" },
    { c: [1.35, 0.95, 0], s: [0.36, 0.22, 0.36], kind: "box" },
    { c: [1.55, -0.2, 0], s: [0.32, 0.4, 0.32], kind: "db" },
    { c: [2.35, -0.2, 0], s: [0.32, 0.4, 0.32], kind: "db" },
  ];
  const links: [number, number][] = [[0, 1], [1, 2], [1, 3], [1, 4], [2, 5], [3, 5], [2, 6], [3, 6], [4, 6], [6, 7]];
  const [onEdges, onLinks, fill] = split(n, [52, 30, 18]);
  const boxEdge = (b: Box) => {
    const [cx, cy, cz] = b.c, [sx, sy, sz] = b.s;
    if (b.kind === "db") {
      // a cylinder: three rings (top, middle, bottom) and its two sides
      if (r() < 0.7) {
        const a = r() * Math.PI * 2;
        const y = (Math.floor(r() * 3) - 1) * sy;
        return [cx + Math.cos(a) * sx, cy + y, cz + Math.sin(a) * sx * 0.9] as const;
      }
      return [cx + (r() < 0.5 ? -sx : sx), cy + (r() * 2 - 1) * sy, cz] as const;
    }
    // one of the 12 edges of the box
    const e = Math.floor(r() * 12), t = r() * 2 - 1;
    const axis = Math.floor(e / 4);
    const a1 = (e & 1 ? 1 : -1), a2 = (e & 2 ? 1 : -1);
    if (axis === 0) return [cx + t * sx, cy + a1 * sy, cz + a2 * sz] as const;
    if (axis === 1) return [cx + a1 * sx, cy + t * sy, cz + a2 * sz] as const;
    return [cx + a1 * sx, cy + a2 * sy, cz + t * sz] as const;
  };
  for (let k = 0; k < onEdges!; k++) {
    const b = boxes[k % boxes.length]!;
    const [x, y, z] = boxEdge(b);
    const tone = 0.55 + r() * 0.45;
    w.put(x + (r() - 0.5) * 0.008, y + (r() - 0.5) * 0.008, z, b.hot ? ACCENT + tone : tone);
  }
  for (let k = 0; k < onLinks!; k++) {
    const [ia, ib] = links[k % links.length]!;
    const a = boxes[ia]!.c, b = boxes[ib]!.c;
    const t = r();
    // a packet: a few bright clumps along each link
    const clump = r() < 0.25;
    const tt = clump ? Math.round(t * 4) / 4 + (r() - 0.5) * 0.03 : t;
    w.put(a[0] + (b[0] - a[0]) * tt, a[1] + (b[1] - a[1]) * tt, (r() - 0.5) * 0.01, clump ? 0.95 : 0.18 + r() * 0.2);
  }
  for (let k = 0; k < fill!; k++) {
    const b = boxes[k % boxes.length]!;
    w.put(b.c[0] + (r() * 2 - 1) * b.s[0] * 0.9, b.c[1] + (r() * 2 - 1) * b.s[1] * 0.9, b.c[2] + (r() * 2 - 1) * b.s[2] * 0.9, 0.08 + r() * 0.12);
  }
  return w.out;
}

/** A word in particles, drawn from the page's own font. */
export function word(n: number, text: string, font: string): Shape {
  const W = 1400, H = 360;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  let size = 300;
  g.font = `800 ${size}px ${font}`;
  while (g.measureText(text).width > W * 0.94 && size > 40) { size -= 8; g.font = `800 ${size}px ${font}`; }
  g.fillText(text, W / 2, H / 2 + size * 0.04);
  const data = g.getImageData(0, 0, W, H).data;
  const w = writer(n);
  const r = rng(19);
  const scale = 5.4 / W;
  let guard = 0;
  while (w.done < n && guard++ < n * 60) {
    const x = Math.floor(r() * W), y = Math.floor(r() * H);
    if (data[(y * W + x) * 4]! > 128) {
      w.put((x - W / 2) * scale, -(y - H / 2) * scale, (r() - 0.5) * 0.08, r() < 0.06 ? ACCENT + 0.9 : 0.55 + r() * 0.45);
    }
  }
  while (w.done < n) w.put((r() - 0.5) * 8, (r() - 0.5) * 5, -1 - r() * 2, r() * 0.15);
  return w.out;
}

/** The interview: chat bubbles stacked left and right; the interviewer's catch glows. */
export function dialogue(n: number): Shape {
  const w = writer(n);
  const r = rng(23);
  const bubbles = [
    { x: -0.7, y: 1.25, w: 1.5, h: 0.32, hot: false },
    { x: 0.75, y: 0.7, w: 1.7, h: 0.42, hot: false },
    { x: -0.6, y: 0.05, w: 1.9, h: 0.5, hot: true },
    { x: 0.8, y: -0.62, w: 1.4, h: 0.32, hot: false },
    { x: -0.75, y: -1.2, w: 1.6, h: 0.38, hot: false },
  ];
  for (let k = 0; k < n; k++) {
    const b = bubbles[k % bubbles.length]!;
    const edge = r() < 0.45;
    let x: number, y: number;
    if (edge) {
      // a rounded rectangle outline
      const t = r() * 4, hw = b.w / 2, hh = b.h / 2;
      if (t < 1) { x = -hw + t * 2 * hw; y = hh; } else if (t < 2) { x = hw; y = hh - (t - 1) * 2 * hh; }
      else if (t < 3) { x = hw - (t - 2) * 2 * hw; y = -hh; } else { x = -hw; y = -hh + (t - 3) * 2 * hh; }
    } else {
      // lines of "text" inside
      const lines = Math.max(1, Math.round(b.h / 0.13));
      const line = Math.floor(r() * lines);
      const len = 0.55 + ((line * 37) % 10) / 25;
      x = (r() - 0.5) * (b.w - 0.25) * len;
      y = (lines === 1 ? 0 : (line / (lines - 1) - 0.5) * (b.h - 0.18));
    }
    const tone = edge ? 0.55 + r() * 0.35 : 0.3 + r() * 0.3;
    w.put(b.x + x, b.y + y, (r() - 0.5) * 0.04, b.hot ? 2 + tone : tone);
  }
  return w.out;
}

/** The curriculum itself: one cluster per real lesson, tiers stacked as floors, modules side by side. */
export function curriculum(n: number, tiers: number[][]): Shape {
  const w = writer(n);
  const r = rng(29);
  const lessons: { x: number; y: number; z: number; tier: number }[] = [];
  tiers.forEach((modules, t) => {
    const y = -1.5 + t * 0.5;
    modules.forEach((count, m) => {
      const x = (m - (modules.length - 1) / 2) * 0.42;
      for (let l = 0; l < count; l++) lessons.push({ x: x + (r() - 0.5) * 0.12, y, z: (l - count / 2) * 0.09, tier: t });
    });
  });
  for (let k = 0; k < n; k++) {
    const L = lessons[k % lessons.length]!;
    // each lesson a small ring of light, so 174 of them read as points, not one glow
    const a = r() * Math.PI * 2, d = 0.055 + (r() - 0.5) * 0.012;
    const top = L.tier === tiers.length - 1;
    w.put(L.x + Math.cos(a) * d, L.y + Math.sin(a) * d * 0.6, L.z + Math.sin(a) * d * 0.4, top ? 2 + 0.35 + r() * 0.2 : 0.16 + L.tier * 0.03 + r() * 0.12);
  }
  return w.out;
}

/** The engine: four stacked layers; only the top one (the speaker) uses a model. */
export function layers(n: number): Shape {
  const w = writer(n);
  const r = rng(31);
  const [planes, streams] = split(n, [78, 22]);
  for (let k = 0; k < planes!; k++) {
    const layer = k % 4;
    const y = -1.2 + layer * 0.8;
    const edge = r() < 0.35;
    const hx = 1.6, hz = 0.9;
    let x = (r() * 2 - 1) * hx, z = (r() * 2 - 1) * hz;
    if (edge) { if (r() < 0.5) x = Math.sign(x) * hx; else z = Math.sign(z) * hz; }
    const tone = edge ? 0.8 : 0.18 + r() * 0.2;
    w.put(x, y + (r() - 0.5) * 0.02, z, layer === 3 ? 2 + tone : tone);
  }
  for (let k = 0; k < streams!; k++) {
    const col = k % 9, x = ((col % 3) - 1) * 0.9, z = (Math.floor(col / 3) - 1) * 0.5;
    w.put(x + (r() - 0.5) * 0.02, -1.2 + r() * 2.4, z, 0.35 + r() * 0.4);
  }
  return w.out;
}

/** The scorecard: an 8-axis radar with its rings and the candidate's shape. */
export function radar(n: number, values: number[]): Shape {
  const w = writer(n);
  const r = rng(37);
  const N = values.length, R = 1.55;
  const at = (i: number, v: number) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(a) * R * v, -Math.sin(a) * R * v] as const;
  };
  const [rings, spokes, shape, fill] = split(n, [26, 14, 34, 26]);
  for (let k = 0; k < rings!; k++) {
    const ring = (1 + (k % 4)) / 4, t = r() * N, i = Math.floor(t), f = t - i;
    const [x0, y0] = at(i, ring), [x1, y1] = at((i + 1) % N, ring);
    w.put(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, 0, 0.18 + r() * 0.12);
  }
  for (let k = 0; k < spokes!; k++) {
    const [x, y] = at(k % N, r());
    w.put(x, y, 0, 0.2 + r() * 0.1);
  }
  for (let k = 0; k < shape!; k++) {
    const t = r() * N, i = Math.floor(t), f = t - i;
    const [x0, y0] = at(i, values[i]!), [x1, y1] = at((i + 1) % N, values[(i + 1) % N]!);
    w.put(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, 0.02, 2 + 0.8 + r() * 0.2);
  }
  for (let k = 0; k < fill!; k++) {
    const t = r() * N, i = Math.floor(t), f = t - i, s = Math.sqrt(r());
    const [x0, y0] = at(i, values[i]!), [x1, y1] = at((i + 1) % N, values[(i + 1) % N]!);
    w.put((x0 + (x1 - x0) * f) * s, (y0 + (y1 - y0) * f) * s, 0, 2 + 0.15 + r() * 0.15);
  }
  return w.out;
}

/** Five interviewers, mentor to CTO: five rings, each wider and brighter. */
export function personas(n: number): Shape {
  const w = writer(n);
  const r = rng(41);
  for (let k = 0; k < n; k++) {
    const ring = k % 5, R = 0.35 + ring * 0.33, a = r() * Math.PI * 2;
    const jitter = (r() - 0.5) * 0.03;
    w.put(Math.cos(a) * (R + jitter), (r() - 0.5) * 0.03, Math.sin(a) * (R + jitter), ring === 4 ? 2 + 0.6 : 0.18 + ring * 0.07 + r() * 0.12);
  }
  return w.out;
}
