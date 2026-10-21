import * as THREE from "three/webgpu";
import {
  Fn, PI, abs, clamp, dot, exp, float, hash, instanceIndex, instancedArray, ivec2, length, max, mix, normalize,
  smoothstep, sin, cos, textureLoad, triNoise3D, uniform, uv, vec2, vec3, vec4,
} from "three/tsl";
import type { Shape } from "../shapes";

/**
 * The particle field, simulated on the GPU (TSL compute: WebGPU where it exists, WebGL 2 otherwise). Every particle
 * is a little mass on a spring toward its place in the current shape; the place itself moves between two shapes as
 * the page scrolls, each particle leaving at its own moment. Noise, the cursor and the voice push on top.
 *
 * Only three buffers are written (position, velocity, look): on WebGL 2 each storage buffer becomes a transform
 * feedback output and only four are guaranteed. So the shapes are read from textures and each particle's random
 * seed is a hash of its index.
 */
/** A colour as a linear-space vector, so the shader can mix it like any vec3. */
function rgb(hex: string) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

export type Pose = { x: number; y: number; scale: number; yaw: number; tilt: number };

export class Particles {
  readonly object: THREE.Sprite;
  readonly pos;
  private readonly vel;
  private readonly look;
  private readonly a: THREE.DataTexture;
  private readonly b: THREE.DataTexture;
  private readonly update;
  readonly u = {
    mix: uniform(0), time: uniform(0), dt: uniform(1 / 60), calm: uniform(1), push: uniform(0), speak: uniform(0),
    mouse: uniform(new THREE.Vector3(99, 99, 0)), look: uniform(new THREE.Vector2()),
    poseA: uniform(new THREE.Vector4(0, 0, 1, 0)), poseB: uniform(new THREE.Vector4(0, 0, 1, 0)),
    tilt: uniform(new THREE.Vector2()), size: uniform(0.016), mouth: uniform(new THREE.Vector3(99, 99, 0)),
    base: uniform(rgb("#e9ecf2")), accent: uniform(rgb("#ff5b2e")), alpha: uniform(1),
  };

  constructor(readonly count: number, start: Shape) {
    this.pos = instancedArray(count, "vec4"); // vec4: no padding questions between compute and vertex reads
    this.vel = instancedArray(count, "vec4");
    this.look = instancedArray(count, "vec2"); // tone, accent
    const side = Math.ceil(Math.sqrt(count));
    const texture = () => {
      const t = new THREE.DataTexture(new Float32Array(side * side * 4), side, side, THREE.RGBAFormat, THREE.FloatType);
      t.minFilter = t.magFilter = THREE.NearestFilter;
      return t;
    };
    this.a = texture();
    this.b = texture();

    const p0 = this.pos.value.array as Float32Array;
    for (let i = 0; i < count; i++) {
      p0[i * 4] = start[i * 4]!; p0[i * 4 + 1] = start[i * 4 + 1]!; p0[i * 4 + 2] = start[i * 4 + 2]!;
    }
    this.load(this.a, start);
    this.load(this.b, start);

    // A particle's four random numbers, from its index alone.
    const seedOf = (i: typeof instanceIndex) => vec4(hash(i), hash(i.add(count)), hash(i.add(count * 2)), hash(i.add(count * 3)));
    const texel = (i: typeof instanceIndex) => ivec2(i.mod(side).toInt(), i.div(side).toInt());

    const u = this.u;
    // TSL nodes are loosely typed across three versions; these two helpers take any node of the right shape.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type N = any;
    const rot = (p: N, ang: N) =>
      vec2(p.x.mul(cos(ang)).sub(p.y.mul(sin(ang))), p.x.mul(sin(ang)).add(p.y.mul(cos(ang))));
    const place = (q: N, pose: N, tilt: N) => {
      const yz1 = rot(vec2(q.y, q.z), tilt);
      const p1 = vec3(q.x, yz1.x, yz1.y);
      const xz = rot(vec2(p1.x, p1.z), pose.w.add(u.look.x));
      const p2 = vec3(xz.x, p1.y, xz.y);
      const yz2 = rot(vec2(p2.y, p2.z), u.look.y);
      return vec3(p2.x, yz2.x, yz2.y).mul(pose.z).add(vec3(pose.x, pose.y, 0));
    };

    this.update = Fn(() => {
      const i = instanceIndex;
      const s = seedOf(i);
      const A = textureLoad(this.a, texel(i));
      const B = textureLoad(this.b, texel(i));
      const e0 = clamp(u.mix.mul(1.7).sub(s.x.mul(0.7)), 0, 1);
      const e = e0.mul(e0).mul(float(3).sub(e0.mul(2)));
      const target = mix(place(A.xyz, u.poseA, u.tilt.x), place(B.xyz, u.poseB, u.tilt.y), e);

      const P = this.pos.element(i);
      const V = this.vel.element(i);
      const p = P.xyz.toVar();
      const v = V.xyz.toVar();
      const flight = sin(e.mul(PI));
      const nIn = p.mul(0.35).add(s.yzw.mul(4));
      const n = vec3(
        triNoise3D(nIn, float(0.15), u.time),
        triNoise3D(nIn.add(vec3(31.4, 7.1, 2.7)), float(0.15), u.time),
        triNoise3D(nIn.add(vec3(-9.2, 17.3, 41.0)), float(0.15), u.time),
      ).sub(0.5);

      // Spring toward the place, a stiff one at rest and a loose one in flight, so shapes hold crisp but travel soft.
      const k = mix(float(46), float(9), flight).mul(mix(float(0.7), float(1.3), s.w));
      const force = target.sub(p).mul(k);
      force.addAssign(n.mul(mix(float(0.35), float(9), flight)).mul(u.calm));

      // The cursor parts the particles like a hand through smoke, and lifts them toward the camera.
      const d = p.xy.sub(u.mouse.xy);
      const near = exp(dot(d, d).mul(-10)).mul(u.push);
      force.addAssign(vec3(normalize(d.add(1e-5)).mul(near.mul(16)), near.mul(10)));

      // Speaking: a ripple out from the mouth.
      const m = p.sub(u.mouth);
      const ring = exp(abs(length(m).sub(u.time.mul(3.0).fract().mul(1.2))).mul(-12)).mul(u.speak);
      force.addAssign(normalize(m.add(1e-5)).mul(ring.mul(18)));

      const damp = exp(u.dt.mul(-7.5));
      v.assign(v.mul(damp).add(force.mul(u.dt)));
      p.addAssign(v.mul(u.dt));
      V.assign(vec4(v, 0));
      P.assign(vec4(p, 1));

      const ta = A.w.greaterThan(1.5).select(A.w.sub(2), A.w);
      const tb = B.w.greaterThan(1.5).select(B.w.sub(2), B.w);
      const speed = length(v);
      this.look.element(i).assign(vec2(mix(ta, tb, e).add(near.mul(0.6)).add(speed.mul(0.04)),
        mix(A.w.greaterThan(1.5).select(float(1), float(0)), B.w.greaterThan(1.5).select(float(1), float(0)), e)));
    })().compute(count);

    const material = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    const look = this.look.toAttribute();
    const s = seedOf(instanceIndex);
    material.positionNode = this.pos.toAttribute().xyz;
    // vec2 on purpose: a float scale isn't widened to both axes, which drew every particle as a thin dash.
    const size = u.size.mul(look.x.mul(0.9).add(0.5)).mul(s.w.mul(0.5).add(0.75));
    material.scaleNode = vec2(size, size);
    const r = uv().sub(0.5).length();
    const glow = smoothstep(0.5, 0.0, r).pow(2);
    // Additive light stacks up, so brightness follows tone steeply: dark cloth stays dark, the face's light reads.
    const tone = max(look.x, 0.0).pow(1.8).mul(1.25).add(0.04);
    material.colorNode = vec4(mix(u.base, u.accent, look.y).mul(tone).mul(glow).mul(u.alpha), 1);

    this.object = new THREE.Sprite(material);
    this.object.count = count;
    this.object.frustumCulled = false;
  }

  private load(tex: THREE.DataTexture, shape: Shape) {
    (tex.image.data as Float32Array).set(shape.subarray(0, this.count * 4));
    tex.needsUpdate = true;
  }

  /** Shows the morph between two shapes (scroll decides `mix`); uploads them only when the pair changes. */
  private pair = [-1, -1];
  setPair(ia: number, ib: number, shapes: Shape[]) {
    if (this.pair[0] === ia && this.pair[1] === ib) return;
    if (this.pair[0] !== ia) this.load(this.a, shapes[ia]!);
    if (this.pair[1] !== ib) this.load(this.b, shapes[ib]!);
    this.pair = [ia, ib];
  }

  setPoses(a: Pose, b: Pose) {
    this.u.poseA.value.set(a.x, a.y, a.scale, a.yaw);
    this.u.poseB.value.set(b.x, b.y, b.scale, b.yaw);
    this.u.tilt.value.set(a.tilt, b.tilt);
  }

  step(renderer: THREE.WebGPURenderer) {
    renderer.compute(this.update);
  }
}
