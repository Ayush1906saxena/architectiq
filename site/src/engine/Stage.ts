import * as THREE from "three/webgpu";
import { pass } from "three/tsl";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import type { Shape } from "../shapes";
import { cloud } from "../shapes";
import { Particles, type Pose } from "./Particles";

/**
 * The 3D layer: WebGPU (WebGL 2 where it isn't), one particle field that becomes each chapter's shape. Chapters are
 * the page's [data-scene] sections in order; the morph to the next shape runs while the boundary between two
 * chapters crosses the middle of the screen, so the shape always matches the words in view.
 */
export type Placement = { desk: Pose & { spin: number }; phone: Pose & { spin: number } };
export const P = (x: number, y: number, scale: number, yaw = 0, spin = 0, tilt = 0) => ({ x, y, scale, yaw, spin, tilt });

export type Engine = { backend: "WebGPU" | "WebGL 2"; count: number; onChapter(cb: (i: number) => void): void; dispose(): void };

export async function startEngine(canvas: HTMLCanvasElement, opts: {
  reduced: boolean;
  accent: string;
  shapes: ((count: number) => Shape)[];
  placements: Placement[];
  onProgress(p: number): void;
}): Promise<Engine> {
  const forceWebGL = new URLSearchParams(location.search).get("gl") === "webgl";
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, powerPreference: "high-performance", forceWebGL });
  await renderer.init();
  const webgpu = Boolean((renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend);
  const phone = window.innerWidth < 768 || matchMedia("(pointer: coarse)").matches;
  const count = phone ? 50_000 : webgpu ? 240_000 : 100_000;
  renderer.setClearColor(0x050506, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0, 8);

  const start = cloud(count);
  const field = new Particles(count, start);
  const c = new THREE.Color(opts.accent);
  field.u.accent.value.set(c.r, c.g, c.b);
  scene.add(field.object);

  const pipeline = new THREE.RenderPipeline(renderer);
  const color = pass(scene, camera).getTextureNode("output");
  pipeline.outputNode = phone ? color : color.add(bloom(color, 0.3, 0.25, 0.5));

  const shapes: Shape[] = [];
  for (let i = 0; i < opts.shapes.length; i++) {
    shapes.push(opts.shapes[i]!(count));
    opts.onProgress((i + 1) / opts.shapes.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  shapes.push(start);
  const CLOUD = shapes.length - 1;

  const ndc = new THREE.Vector2(0, 0);
  let pushTarget = 0;
  const ray = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    pushTarget = 1;
  };
  const onLeave = () => { pushTarget = 0; };
  window.addEventListener("pointermove", onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);

  let centers: number[] = [];
  const measure = () => {
    centers = [...document.querySelectorAll<HTMLElement>("[data-scene]")].map((el) => {
      const r = el.getBoundingClientRect();
      return r.top + window.scrollY + r.height / 2;
    });
  };
  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, phone ? 1.5 : 1.75));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    field.u.size.value = phone ? 0.02 : webgpu ? 0.0125 : 0.016;
    field.u.alpha.value = 0.5 * Math.sqrt(60_000 / count);
    measure();
  };
  resize();
  window.addEventListener("resize", resize);
  const ro = new ResizeObserver(measure);
  ro.observe(document.body);

  const u = field.u;
  u.calm.value = opts.reduced ? 0.12 : 1;
  let chapterCb: (i: number) => void = () => {};
  let lastChapter = -1;
  const t0 = performance.now();
  let last = t0;
  let introStart = -1;
  let raf = 0;

  const pose = (i: number, t: number): Pose => {
    const s = opts.placements[Math.min(i, opts.placements.length - 1)]!;
    const p = window.innerWidth < 768 ? s.phone : s.desk;
    const facing = Math.atan2(p.x, camera.position.z);
    return { x: p.x, y: p.y, scale: p.scale, tilt: p.tilt, yaw: p.yaw + facing + (opts.reduced ? 0 : t * p.spin) };
  };

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const t = (now - t0) / 1000;
    u.dt.value = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    u.time.value = opts.reduced ? 0 : t;

    camera.updateMatrixWorld();
    const here = pose(Math.max(0, lastChapter), 0);
    centre.set(here.x, here.y, 0).project(camera);
    const dx = ndc.x - centre.x, dy = ndc.y - centre.y;
    const near = pushTarget * Math.max(0, 1 - Math.hypot(dx * camera.aspect, dy) / 0.9);
    u.look.value.x += (dx * 0.4 * near - u.look.value.x) * 0.06;
    u.look.value.y += (-dy * 0.18 * near - u.look.value.y) * 0.06;
    if (!Number.isFinite(u.look.value.x) || !Number.isFinite(u.look.value.y)) u.look.value.set(0, 0);
    ray.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(camera.position).normalize();
    u.mouse.value.lerp(ray.multiplyScalar(-camera.position.z / ray.z).add(camera.position), 0.2);
    u.push.value += ((opts.reduced ? 0 : pushTarget) - u.push.value) * 0.06;

    if (introStart < 0) introStart = t;
    const intro = opts.reduced ? 1 : Math.min(1, (t - introStart) / 2.4);

    const mid = window.scrollY + window.innerHeight / 2;
    let i = 0;
    while (i < centers.length - 2 && mid >= centers[i + 1]!) i++;
    const span = Math.max(1, (centers[i + 1] ?? centers[i]! + 1) - centers[i]!);
    const f = Math.max(0, Math.min(1, (mid - centers[i]!) / span));
    const m = f < 0.3 ? 0 : f > 0.7 ? 1 : (f - 0.3) / 0.4;
    const chapter = m > 0.5 ? i + 1 : i;
    if (chapter !== lastChapter) { lastChapter = chapter; chapterCb(chapter); }

    const ia = Math.min(i, shapes.length - 2), ib = Math.min(i + 1, shapes.length - 2);
    if (intro < 1 && i === 0 && m === 0) {
      field.setPair(CLOUD, 0, shapes);
      field.setPoses(pose(0, t), pose(0, t));
      u.mix.value = intro;
    } else {
      field.setPair(ia, ib, shapes);
      field.setPoses(pose(ia, t), pose(ib, t));
      u.mix.value = m;
    }
    camera.position.z = 8 - Math.sin(Math.PI * m) * 0.6;

    field.step(renderer);
    pipeline.render();
  };
  raf = requestAnimationFrame(frame);

  return {
    backend: webgpu ? "WebGPU" : "WebGL 2",
    count,
    onChapter(cb) { chapterCb = cb; },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
      ro.disconnect();
      renderer.dispose();
    },
  };
}
