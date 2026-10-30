// 基因走 hybrid.js 的 paramsOf，所以跟插花台、杂交花长得一样。自己开一个小渲染器，不碰 garden.js。
// 三种摆法：hero 一枝特写、bunch 一小把三到五枝、flat 平铺在纸上
// 颜色洗干净提成粉彩、微透，枝细而嫩绿，不打光（只留花瓣根深梢浅那一点），整株压扁正对着看，没有投影，只描一圈 1–2px 的柔边像粘在纸上；可选一截和纸胶带
import * as THREE from 'three';
import * as Hy from './hybrid.js';

/* 压花的材质：不吃光，顶点色只当花瓣里那一点深浅；略透 */
const MC = new Map();
function mat(color, o = {}) {
  const k = color + ':' + (o.vertexColors ? 1 : 0) + ':' + (o.opacity || 1);
  if (!MC.has(k)) MC.set(k, new THREE.MeshBasicMaterial({ color, vertexColors: !!o.vertexColors, side: THREE.DoubleSide, transparent: (o.opacity || 1) < 1, opacity: o.opacity || 1 }));
  return MC.get(k);
}
const PRESS = new THREE.Vector3(0, 0, 1);   /* 压扁的方向：正对镜头 */
/* 心情色提成干净的粉彩：灰的、橄榄的拉饱和，太深的提亮，不出浑色 */
function pastel(hex) {
  const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl, THREE.SRGBColorSpace);
  let { h, s, l } = hsl; if (h > .1 && h < .2 && s < .5) h = .09;   /* 土黄、橄榄 → 杏 */
  s = Math.min(.82, Math.max(.6, s * 1.1)); l = Math.min(.82, Math.max(.7, l + .06));
  return '#' + new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace).getHexString(THREE.SRGBColorSpace);
}

const rng = (seed) => { let k = (seed * 9301 + 49297) % 233280; return () => ((k = (k * 9301 + 49297) % 233280) / 233280); };
const UP = new THREE.Vector3(0, 1, 0);
/* 参数曲面：fn(u,v) 给 [x,y,z,shade]，shade 进顶点色（材质颜色乘它，根深梢浅就靠这个），两面都画 */
function surf(NU, NV, fn) {
  const pos = [], col = [], uv = [], idx = [];
  for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
    const [x, y, z, s] = fn(i / NU, -1 + 2 * j / NV); pos.push(x, y, z); col.push(s, s, s); uv.push(i / NU, j / NV);
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
const skin = (c, o = {}) => mat(c, { vertexColors: true, opacity: .9, ...o });

// ---------- 花瓣：u 沿瓣长 0 根→1 梢，v 横向 -1..1 ----------
const petalCache = new Map();
function petalGeo({ L = .16, Wd = .12, cup = 1, reflex = 1, ruffle = 1, notch: notch0 = null, seed = 0, key = '' }) {
  const k = key + ':' + seed + ':' + L + ':' + Wd + ':' + cup + ':' + reflex + ':' + ruffle + ':' + notch0; if (petalCache.has(k)) return petalCache.get(k);
  const r = rng(seed + 11), ph1 = r() * 6.28, ph2 = r() * 6.28, nr = .06 + r() * .04, notch = notch0 == null ? nr : notch0, crease = .7 + r() * .5, skew = (r() - .5) * .1, foldMid = r() * .06;
  const width = (u) => Wd * .5 * (.1 + .9 * Math.pow(Math.sin(Math.min(1, u / .6) * Math.PI / 2), 1.1));
  const g = surf(20, 10, (u0, v) => {
    const uend = .8 + .2 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(v), 2.2))) - notch * Math.exp(-Math.pow(v / .14, 2)), u = u0 * uend, w = width(u);
    const x = v * w + skew * u * u * L, y = u * L;
    let z = cup * .45 * w * v * v * (1 - .4 * u);
    z += reflex * (.12 * L * Math.sin(u * Math.PI * .8) - .06 * L * Math.pow(Math.max(0, u - .7), 2) / .09);
    const edge = Math.max(0, Math.abs(v) - .55) / .45;
    z += ruffle * .03 * w * edge * edge * Math.sin(5 * u * Math.PI + ph1 + v * 3) + ruffle * .04 * L * Math.pow(Math.max(0, u - .75), 1.5) * Math.sin(v * 9 + ph2);
    const side = Math.max(0, Math.abs(v) - .35) / .65;
    z += .09 * w * Math.pow(side, 1.8) * Math.sin(u * (9 + 3 * Math.abs(v)) + ph1 + (v > 0 ? 2.1 : 0)) * (.4 + u) + .015 * w * Math.pow(side, 2.5) * Math.sin(u * 15 + ph2 + v * 4);
    z -= foldMid * w * Math.exp(-Math.pow(v / .18, 2)) * u;
    const fl = .58 + .06 * Math.sin(u * 4 + ph1), past = Math.max(0, Math.abs(v) - fl) / (1 - fl);
    z += crease * .32 * w * Math.pow(past, 1.3) * Math.pow(Math.sin(Math.min(1, u / .85) * Math.PI), .7);
    return [x, y, z, .74 + .34 * u];   // 根深梢浅
  });
  petalCache.set(k, g); return g;
}

// ---------- 叶：披针 / 卵形 / 圆叶，中脉折一点，往梢垂头，各自歪 ----------
const leafCache = new Map();
function leafGeo({ L = .16, W = .06, kind = 'lance', seed = 0 }) {
  const k = kind + L + W + ':' + seed; if (leafCache.has(k)) return leafCache.get(k);
  const r = rng(seed + 37), ph = r() * 6.28, droop = .25 + r() * .35, fold = .18 + r() * .14, twist = (r() - .5) * .3;
  const width = (u) => kind === 'round' ? Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2))) * .95 + .05 : kind === 'ovate' ? Math.pow(Math.sin(Math.min(1, u / .55) * Math.PI / 2), .8) * Math.pow(1 - Math.max(0, u - .55) / .45, .9) : Math.pow(Math.sin(Math.min(1, u / .45) * Math.PI / 2), .9) * Math.pow(1 - Math.max(0, u - .45) / .55, 1.6);
  const g = surf(14, 6, (u, v) => {
    const w = width(u) * W * .5, x = v * w + Math.sin(u * 3 + ph) * .006 * L * u, y = u * L;
    let z = Math.abs(v) * w * fold * 1.6;           // 中脉两边往上折
    z -= droop * u * u * L * .9;                     // 往梢垂下去
    z += twist * v * u * w;                          // 轻轻拧一下
    z += .012 * L * Math.max(0, Math.abs(v) - .6) * Math.sin(u * 11 + ph);   // 叶缘一点小波
    return [x, y, z, .78 + .3 * u];
  });
  leafCache.set(k, g); return g;
}
const LEAF_C = ['#8ccb72', '#9fd585', '#7fc06a', '#aedb94'];
const EUCA_C = ['#8aa48c', '#9cb3a0', '#7c9681'];
/* 把一片叶挂在枝上某点：pos 位置，tg 枝的切线，ang 绕枝的方位，s 大小 */
function hangLeaf(host, geo, c, pos, tg, ang, s, lift = .35) {
  const l = new THREE.Mesh(geo, skin(c)); l.userData.noLine = true;
  const side = new THREE.Vector3().crossVectors(tg, PRESS).normalize(); if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
  const n2 = new THREE.Vector3().crossVectors(tg, side).normalize();
  const out = side.clone().multiplyScalar(Math.cos(ang)).add(n2.clone().multiplyScalar(Math.sin(ang))).lerp(tg, lift).normalize();
  l.position.copy(pos); l.quaternion.setFromUnitVectors(UP, out);
  const z = new THREE.Vector3(0, 0, 1).applyQuaternion(l.quaternion), want = out.clone().cross(PRESS).cross(out).normalize().negate();   // 压花：叶面朝镜头
  const rot = Math.atan2(new THREE.Vector3().crossVectors(z, want).dot(out), z.dot(want)); l.rotateY(rot);
  l.scale.setScalar(s); host.add(l); return l;
}

// ---------- 枝：渐细的弯管（顶点色根深梢浅） ----------
function tube(curve, r0, r1, N = 28, M = 7, c0 = .72, c1 = 1) {
  const pos = [], col = [], idx = [], fr = curve.computeFrenetFrames(N, false);
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPointAt(t), rad = r0 + (r1 - r0) * t, s = c0 + (c1 - c0) * t;
    for (let j = 0; j <= M; j++) { const a = j / M * Math.PI * 2, n = fr.normals[i], b = fr.binormals[i]; pos.push(p.x + (n.x * Math.cos(a) + b.x * Math.sin(a)) * rad, p.y + (n.y * Math.cos(a) + b.y * Math.sin(a)) * rad, p.z + (n.z * Math.cos(a) + b.z * Math.sin(a)) * rad); col.push(s, s, s); }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const STEM_C = '#86c46c', TWIG_C = '#93c67a';
function stemMesh(curve, r0, r1, c = STEM_C) { const m = new THREE.Mesh(tube(curve, r0, r1), mat(c, { vertexColors: true })); m.userData.lineW = .0018; return m; }
/* 一段弯枝：从 a 往 d 走 len，中段微微侧弯，越斜越垂 */
function bend(a, d, len, tilt, r, lateral = .05, pre = null) {
  const side = new THREE.Vector3().crossVectors(d, UP).normalize(); if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
  const wob = (r() - .5) * 2 * lateral * len;
  const p1 = a.clone().addScaledVector(d, len * .33).addScaledVector(side, wob * .6);
  const p2 = a.clone().addScaledVector(d, len * .7).addScaledVector(side, wob).add(new THREE.Vector3(0, -tilt * len * .05, 0));
  const tip = a.clone().addScaledVector(d, len).add(new THREE.Vector3(0, -tilt * len * .11, 0)).addScaledVector(side, wob * .4);
  return new THREE.CatmullRomCurve3(pre ? [pre, a, p1, p2, tip] : [a, p1, p2, tip], false, 'centripetal', .6);
}
/* 整根枝：口下面一截竖直（在瓶子里、在水里），到口才按方向弯出去。截图：细颈瓶的配叶从肩膀穿出来，就是原来从底下起笔就斜着走 */
function stemPath(root, a, d, len, tilt, r, lateral) {
  const a0 = a.clone().add(new THREE.Vector3(0, -.04, 0)), path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(root, a0)); path.add(bend(a, d, len, tilt, r, lateral, a0));
  path.tin = path.curves[0].getLength() / path.getLength();   // 露在口外那段从 t=tin 起
  return path;
}

// ---------- 花心、一朵花 ----------
const stamenG = new THREE.CylinderGeometry(.002, .0028, .05, 4); stamenG.translate(0, .025, 0);
const antherG = new THREE.SphereGeometry(.006, 6, 4); antherG.scale(1, .7, 1);
function center(s, c = '#e9d27a') {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.SphereGeometry(.02 * s, 10, 8), mat('#cfd88e')); pad.scale.y = .5; pad.userData.lineW = .0012; g.add(pad);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + (i % 2) * .2, lean = .45 + (i % 3) * .12, st = new THREE.Mesh(stamenG, mat('#f6f2e6')); st.userData.noLine = true;
    st.position.set(Math.cos(a) * .008 * s, .004 * s, Math.sin(a) * .008 * s); st.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean); st.scale.setScalar(s); g.add(st);
    const an = new THREE.Mesh(antherG, mat(c)); an.userData.noLine = true; const L = .05 * s;
    an.position.set(Math.cos(a) * (.008 * s + Math.sin(lean) * L), .004 * s + Math.cos(lean) * L, Math.sin(a) * (.008 * s + Math.sin(lean) * L)); an.scale.setScalar(s); g.add(an);
  }
  return g;
}
/* 五瓣一朵，外圈五片张开、里圈五片错位半开（花才有厚度）；每片各自歪、各自的褶 */
function blossom(cs, s, seed, open = .95, P = null) {
  const r = rng(seed), g = new THREE.Group();
  const ring = (n, sc, op, off, lift) => {
    for (let i = 0; i < n; i++) {
      const pv = new THREE.Group(); pv.rotation.y = i / n * Math.PI * 2 + off + (r() - .5) * .18;
      const m = new THREE.Mesh(petalGeo({ ...(P ? P.petal : {}), seed: seed * 7 + i + (off ? 50 : 0), key: 'p' }), skin(cs[i % cs.length])); m.userData.noLine = true;
      m.rotation.x = -Math.PI / 2 + op + (r() - .5) * .22; m.position.y = lift; m.scale.setScalar(s * sc * (.92 + r() * .16)); pv.add(m); g.add(pv);
    }
  };
  const n = P ? P.n : 5;
  ring(n, 1, open, 0, 0); ring(n, .68, open * .62, Math.PI / n, .004 * s);
  if (P && P.dbl) ring(n, .46, open * .38, Math.PI / n * .5 + .2, .008 * s);   /* 重瓣：里面再挤一圈 */
  g.add(center(s));
  return g;
}
/* 花萼：五片小尖叶抱着根 */
function calyx(s, host) {
  const g = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.SphereGeometry(.018 * s, 8, 6), mat('#86a05a')); cup.scale.y = 1.2; cup.position.y = -.01 * s; cup.userData.lineW = .0012; g.add(cup);
  for (let i = 0; i < 5; i++) { const pv = new THREE.Group(); pv.rotation.y = i / 5 * Math.PI * 2 + .3; const l = new THREE.Mesh(leafGeo({ L: .05, W: .018, kind: 'lance', seed: i }), skin('#86a05a')); l.userData.noLine = true; l.rotation.x = -Math.PI / 2 + 1.1; l.position.y = -.008 * s; l.scale.setScalar(s); pv.add(l); g.add(pv); }
  host.add(g); return g;
}

// ---------- 蓝雪花（平静）：松散一小枝，枝梢几团小五瓣，叶是小卵形 ----------
function plumbago(cs, seed, s = 1, P = null) {
  const pp = P ? { Wd: .036 * P.petal.Wd / .12, ruffle: .3 * P.petal.ruffle, notch: P.petal.notch * .4 } : {}, nn = P ? P.n : 5;
  const r = rng(seed), g = new THREE.Group();
  const tiny = (i) => {
    const f = new THREE.Group();
    for (let k = 0; k < nn; k++) { const pv = new THREE.Group(); pv.rotation.y = k / nn * Math.PI * 2 + (r() - .5) * .2; const m = new THREE.Mesh(petalGeo({ L: .042, Wd: .036, cup: .4, reflex: .3, ruffle: .3, ...pp, seed: 300 + (i % 4), key: 'q' }), skin(cs[k % cs.length])); m.userData.noLine = true; m.rotation.x = -Math.PI / 2 + 1.2 + (r() - .5) * .2; pv.add(m); f.add(pv); }
    const th = new THREE.Mesh(new THREE.CylinderGeometry(.003, .0035, .02, 5), mat('#b8d2e6')); th.position.y = -.01; th.userData.noLine = true; f.add(th);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.004, 6, 4), mat('#f6f6f2')); eye.position.y = .003; eye.userData.noLine = true; f.add(eye);
    return f;
  };
  const cluster = (at, dir, n) => {
    const c = new THREE.Group(); c.position.copy(at); c.quaternion.setFromUnitVectors(UP, dir);
    for (let i = 0; i < n; i++) {
      const u = (i + .5) / n, th = Math.acos(1 - u * .9), ph = i * 2.4 + r() * .5, rr = .028 + r() * .01;
      const f = tiny(i); f.position.set(Math.sin(th) * Math.cos(ph) * rr, Math.cos(th) * rr, Math.sin(th) * Math.sin(ph) * rr);
      f.quaternion.setFromUnitVectors(UP, f.position.clone().normalize().lerp(UP, .3).normalize()); c.add(f);
    }
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.0045, 6, 4), mat('#c9d9e8')); b.scale.y = 1.8; b.position.set((r() - .5) * .05, .03 + r() * .015, (r() - .5) * .05); b.userData.noLine = true; c.add(b); }
    return c;
  };
  g.userData.plumbago = { cluster, r, s };
  return g;
}


// ---------- 一枝花（没有花器）：从 root 往 d 方向长 len，整株在 XY 平面里，花脸朝镜头 ----------
const BIG = 1.45; 
function stemOf(f, root, d, len, tilt, seed) {
  const P = Hy.paramsOf(Hy.genesOf(f)), cs = Hy.colorsOf(f).map(pastel), r = rng(seed), g = new THREE.Group(), face = PRESS.clone().multiplyScalar(3);
  len *= P.height;
  const curve = bend(root, d, len, tilt, r, .04), tip = curve.getPointAt(1), tg = curve.getTangentAt(1);
  const sample = (t) => ({ p: curve.getPointAt(t), tg: curve.getTangentAt(t) });
  if (P.cluster) {
    g.add(stemMesh(curve, .0034, .002, TWIG_C));
    const pb = plumbago(cs, seed, 1, P), { cluster } = pb.userData.plumbago; g.add(pb);
    const cl = (at, dir, n) => { const c = cluster(at, dir.clone().lerp(PRESS, .6).normalize(), n); c.scale.setScalar(BIG); return c; };
    g.add(cl(tip, tg, 9));
    for (const [t, ang, L] of [[.62, 1.3, .2], [.8, -1.6, .15]]) {
      const { p, tg: tt } = sample(t), side = new THREE.Vector3().crossVectors(tt, PRESS).normalize(), dd = tt.clone().lerp(side.multiplyScalar(Math.sign(ang)), .55).normalize();
      const c2 = bend(p, dd, L, .4, r, .03); g.add(stemMesh(c2, .002, .0013, TWIG_C)); g.add(cl(c2.getPointAt(1), c2.getTangentAt(1), 6));
      hangLeaf(g, leafGeo({ L: .06, W: .03, kind: 'ovate', seed: 7 }), LEAF_C[0], c2.getPointAt(.5), c2.getTangentAt(.5), 0, .9, .3);
    }
    for (let i = 0; i < 4; i++) { const t = .3 + i * .12, { p, tg } = sample(t); hangLeaf(g, leafGeo({ L: .065, W: .032, kind: 'ovate', seed: i }), LEAF_C[i % 2], p, tg, i % 2 ? Math.PI : 0, 1 + r() * .3, .3); }
  } else {
    g.add(stemMesh(curve, .0042, .0026));
    const n = 2 + (r() * 2 | 0);
    for (let i = 0; i < n; i++) { const t = .22 + i / n * .4 + r() * .06, { p, tg } = sample(t); hangLeaf(g, leafGeo({ L: .2, W: .075, kind: i % 3 === 2 ? 'ovate' : 'lance', seed: seed + i }), LEAF_C[(r() * 4) | 0], p, tg, (i % 2 ? Math.PI : 0) + (r() - .5) * .5, (1.1 - t * .5) * (.9 + r() * .3), .35); }
    const head = blossom(cs, P.scale * BIG, seed, 1.15 + r() * .2, P); head.position.copy(tip);
    head.quaternion.setFromUnitVectors(UP, tg.clone().lerp(UP, .25).add(face).normalize()); head.rotateY(r() * 6.28);
    calyx(P.scale * BIG, head); g.add(head);
  }
  g.userData.tip = tip; g.userData.tape = curve.getPointAt(.26); g.userData.tapeTg = curve.getTangentAt(.26);
  return g;
}

// ---------- 渲染：自己一个小画布（透明底），用完留着下次接着用 ----------
let RR = null;
function renderer() {
  if (RR) return RR;
  const cv = document.createElement('canvas');
  RR = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  RR.outputColorSpace = THREE.SRGBColorSpace; RR.setClearColor(0x000000, 0);
  return RR;
}
/* list：第一枝是这天的花（按心情一枝一色），后面跟一两枝前几天的。paper 为空就透明底（直接落在明信片纸上）。返回 dataURL */
export function shoot(kind, list, w, h, paper, seed = 1) {
  const R = renderer(), S = new THREE.Scene(), all = new THREE.Group(), r = rng(seed + 5);
  let tapes = [];
  const T = (g, holder) => tapes.push({ g, p: g.userData.tape, tg: g.userData.tapeTg, holder });
  if (kind === 'hero') {
    const f0 = list[0].species || list[0].genes || !list[0].moods ? list[0] : { ...list[0], moods: list[0].moods.slice(0, 1) };   /* 特写只用一个颜色，两色轮着上在大花上发花 */
    const s = stemOf(f0, new THREE.Vector3(0, 0, 0), new THREE.Vector3(.06, 1, 0).normalize(), .78, .05, seed); all.add(s);
  } else if (kind === 'bunch') {
    /* 手扎的一小把：枝在中间偏下交叉扎住，花头在上面散开，枝尾在下面露出来 */
    const A = [0, -.42, .44, -.78, .8], Lr = [.52, .45, .48, .38, .41], EXT = .62;
    list.forEach((f, i) => {
      const a = A[i] + (r() - .5) * .06, d = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0).normalize();
      const root = d.clone().multiplyScalar(-EXT * (.85 + r() * .3));
      all.add(stemOf(f, root, d, Lr[i] * (.96 + r() * .08) + EXT, Math.abs(a) * .6, seed + i * 17));
    });
    tapes.push({ world: new THREE.Vector3(0, .01, 0), ang: .12 });
  } else {
    /* 平铺：几枝并排斜着，花头前后错开，像刚剪下来摆在桌上 */
    const n = list.length, ang = -.5, dir = new THREE.Vector2(-Math.sin(ang), Math.cos(ang)), per = new THREE.Vector2(Math.cos(ang), Math.sin(ang));
    list.forEach((f, i) => {
      const L = i === 0 ? .66 : .5 + r() * .12, s = stemOf(f, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), L, .05, seed + i * 17);
      const k = [0, -1, 1, -2, 2][i], along = [.1, -.2, 0, -.3, -.12][i] - L * .5;
      s.rotation.z = ang + (r() - .5) * .16 + k * .04;
      s.position.set(per.x * k * .34 + dir.x * along, per.y * k * .34 + dir.y * along, i * .01);
      all.add(s); if (i === 0) T(s, s);
    });
  }
  if (kind === 'hero') T(all.children[0], all.children[0]);
  all.scale.z = .32;   /* 压扁 */
  S.add(all); all.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(all, true), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  let hw, cy = c.y;
  if (kind === 'hero') { const vh = sz.y * .64; hw = vh / 2; cy = box.max.y - vh * .44; }     /* 贴近花头，枝从底边出去 */
  else hw = Math.max(sz.y, sz.x * h / w) / 2 * (kind === 'flat' ? 1.1 : 1.08);
  const cam = new THREE.OrthographicCamera(-hw * w / h, hw * w / h, hw, -hw, .01, 50);
  cam.position.set(kind === 'hero' ? 0 : c.x, cy, 10); cam.lookAt(kind === 'hero' ? 0 : c.x, cy, 0);
  R.setPixelRatio(1); R.setSize(w, h, false); R.render(S, cam);
  // 贴到纸上：底下一圈很淡的柔边，像胶水粘住；再按一截和纸胶带
  const out = document.createElement('canvas'); out.width = w; out.height = h; const g = out.getContext('2d'), u = w / 800;
  if (paper) { g.fillStyle = paper; g.fillRect(0, 0, w, h); }
  g.save(); g.shadowColor = 'rgba(96,74,56,.2)'; g.shadowBlur = 2.5 * u; g.shadowOffsetX = .8 * u; g.shadowOffsetY = 1.2 * u; g.drawImage(R.domElement, 0, 0); g.restore();
  const px = (v) => { const q = v.clone().project(cam); return [(q.x + 1) / 2 * w, (1 - q.y) / 2 * h]; };
  for (const t of tapes) {
    let at, ang;
    if (t.world) { at = px(t.world); ang = t.ang; }
    else { const p = t.g.localToWorld(t.p.clone()), q = t.g.localToWorld(t.p.clone().add(t.tg)); at = px(p); const b = px(q); ang = Math.atan2(b[1] - at[1], b[0] - at[0]) + Math.PI / 2; }
    tape(g, at[0], at[1], ang + (r() - .5) * .12, (t.world ? 120 : 92) * u, 26 * u, r);
  }
  return out.toDataURL('image/png');
}
/* 和纸胶带：半透明米杏色，两头手撕的小锯齿，横向几道很淡的纤维 */
function tape(g, x, y, a, L, H, r) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.beginPath(); g.moveTo(-L / 2, -H / 2);
  for (let i = 0; i <= 6; i++) g.lineTo(-L / 2 + (i % 2 ? 2.5 : 0) * (H / 26) + r() * 1.5, -H / 2 + i * H / 6);
  g.lineTo(L / 2, H / 2);
  for (let i = 6; i >= 0; i--) g.lineTo(L / 2 - (i % 2 ? 2.5 : 0) * (H / 26) - r() * 1.5, -H / 2 + i * H / 6);
  g.closePath(); g.fillStyle = 'rgba(238,216,196,.62)'; g.fill();
  g.globalAlpha = .18; g.strokeStyle = '#fff'; g.lineWidth = 1;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-L / 2 + 3, -H / 2 + i * H / 4); g.lineTo(L / 2 - 3, -H / 2 + i * H / 4 + (r() - .5) * 2); g.stroke(); }
  g.restore();
}
