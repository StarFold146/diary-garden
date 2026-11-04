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


/* 风铃草的铃：形照插花台 ikebana.js 的 campGeo，
   颜色直接写进顶点，挂点在上、口朝下，五个圆裂片梢头微微外翻。「蓝紫色双色不明显」：G = [紫, 天蓝, 边]，
   铃根和五条脉是紫，中段一道过渡带换成天蓝，裂片边再浅一点（跟插花台 campPaint 一个规矩） */
function campGeo(R, H, G, seed) {
  const ph = rng(seed + 11)() * 6.28, [V, B, E] = G.map((x) => new THREE.Color(x)), c = new THREE.Color();
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const g = surf(14, 36, (u, v) => {
    const a = (v + 1) / 2 * Math.PI * 2, lobe = Math.pow((1 + Math.cos(a * 5 + ph)) / 2, .6), lip = Math.max(0, u - .6) / .4;
    let rad = R * (.2 + .8 * Math.pow(Math.sin(Math.min(1, u / .88) * Math.PI / 2), 1.15));
    rad += R * .38 * lip * lip * (.3 + .7 * lobe);
    const y = -H * (u - .22 * lip * lip * (1 - lobe)) + H * .1 * Math.pow(lip, 3) * lobe;
    return [Math.cos(a) * rad, y, Math.sin(a) * rad, 1];
  });
  const uv = g.getAttribute('uv'), col = g.getAttribute('color');
  for (let i = 0; i < col.count; i++) {
    const u = uv.getX(i), cl = (1 + Math.cos(uv.getY(i) * Math.PI * 2 * 5 + ph)) / 2;
    c.copy(V).lerp(B, ss(.38, .62, u)); c.lerp(V, .75 * Math.pow(cl, 22) * (1 - ss(.6, .97, u))); c.lerp(E, .55 * ss(.86, 1, u) * (.4 + .6 * Math.pow(cl, .6)));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  return g;
}
function campanulaStem(f, root, d, len, tilt, seed) {
  const grad = Hy.gradOf(f) || [Hy.colorsOf(f)[0], '#f1f0fb'], G = [grad[0], grad[1], grad[2] || grad[1]], r = rng(seed), g = new THREE.Group();
  const d2 = d.clone().add(new THREE.Vector3(-.16, 0, 0)).normalize();   /* 茎往左偏一点，弧再往右弯回来，整枝落在正中 */
  const curve = bend(root, d2, len, tilt, r, .04), sample = (t) => ({ p: curve.getPointAt(t), tg: curve.getTangentAt(t) });
  g.add(stemMesh(curve, .0042, .0024));
  for (let i = 0; i < 3; i++) { const { p, tg } = sample(.14 + i * .12); hangLeaf(g, leafGeo({ L: .17 - i * .03, W: .026, kind: 'lance', seed: seed + i }), LEAF_C[i % 2], p, tg, i % 2 ? Math.PI : 0, 1, .4); }
  /* 弧顶往一侧弯下去，单侧挂三朵铃、梢头一个长苞 */
  const top = curve.getPointAt(1), arc = new THREE.CatmullRomCurve3([top.clone().add(new THREE.Vector3(0, -.12, 0)), top, top.clone().add(new THREE.Vector3(.08, .05, 0)), top.clone().add(new THREE.Vector3(.17, .02, 0)), top.clone().add(new THREE.Vector3(.23, -.07, 0))]);
  g.add(stemMesh(arc, .0032, .0022));
  for (let i = 0; i < 4; i++) {
    const t = .25 + i * .25, p = arc.getPointAt(Math.min(1, t)), bud = i === 3, e = p.clone().add(new THREE.Vector3(.012, -.03, 0));
    g.add(stemMesh(new THREE.CatmullRomCurve3([p, p.clone().add(new THREE.Vector3(.012, -.006, 0)), e]), .0016, .0012));
    if (bud) { const b = new THREE.Mesh(new THREE.SphereGeometry(.016, 10, 8), mat(grad[0])); b.scale.set(1, 1.8, 1); b.position.copy(e).add(new THREE.Vector3(.004, -.024, 0)); g.add(b); continue; }
    const sc = BIG * .95 * (1 - i * .08), m = new THREE.Mesh(campGeo(.04 * sc, .074 * sc, G, seed + i), mat('#ffffff', { vertexColors: true, opacity: .92 }));
    m.position.copy(e); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(.45, -1, .55).normalize()); g.add(m);
  }
  g.userData.tip = arc.getPointAt(.5); g.userData.tape = curve.getPointAt(.26); g.userData.tapeTg = curve.getTangentAt(.26);
  return g;
}
/* 兰花：压平了正对着看。
   一片瓣：形照 petalGeo，颜色写进顶点（瓣是蓝的，瓣根一截紫，唇瓣浓紫） */
function gradPetal(o, c0, c1, pw, lip = null) {
  const g = petalGeo({ notch: 0, ...o, key: 'o' }).clone(), uv = g.getAttribute('uv'), col = g.getAttribute('color'), A = new THREE.Color(c0), B = new THREE.Color(c1), L = lip && new THREE.Color(lip), c = new THREE.Color();
  for (let i = 0; i < col.count; i++) {
    const u = uv.getX(i);
    if (L) { if (u < .38) c.copy(L).lerp(A, Math.pow(Math.max(0, u - .08) / .3, 1.3)); else c.copy(A).lerp(B, Math.pow((u - .38) / .62, 1.4)); }   /* 瓣根一截紫，往外是蓝，瓣缘只浅一点 */
    else c.copy(A).lerp(B, Math.pow(u, pw));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  return g;
}
/* 一朵：背萼朝上，两片圆圆的宽花瓣在两边，两片侧萼往下撇，正下方唇瓣深一号，喉口一点淡黄，中间白蕊柱 */
/* 蓝紫饱和度有点高。唇瓣的紫和往深、往浅调的两头都褪成雾紫，不再压一块浓紫 */
function orchidHead(c0, c1, s, seed, lip = '#997cb6') {
  const g = new THREE.Group(), r = rng(seed), lipA = '#' + new THREE.Color(lip).lerp(new THREE.Color('#6e558b'), .2).getHexString(), lipB = '#' + new THREE.Color(lip).lerp(new THREE.Color('#cbbcdc'), .35).getHexString();
  const piece = (o, a, ca, cb, pw, z = 0) => { const m = new THREE.Mesh(gradPetal({ ...o, seed: seed * 5 + o.seed }, ca, cb, pw, ca === c0 ? lip : null), mat('#ffffff', { vertexColors: true, opacity: .94 })); m.rotation.z = a + (r() - .5) * .06; m.position.z = z * s; m.scale.setScalar(s); g.add(m); };
  piece({ L: .078, Wd: .066, cup: .3, reflex: .1, ruffle: .05, seed: 1 }, 0, c0, c1, 1.1);
  for (const k of [-1, 1]) piece({ L: .074, Wd: .062, cup: .3, reflex: .1, ruffle: .05, seed: 2 + (k > 0) }, k * 2.45, c0, c1, 1.1);
  for (const k of [-1, 1]) piece({ L: .082, Wd: .11, cup: .25, reflex: .1, ruffle: .08, seed: 4 + (k > 0) }, k * 1.3, c0, c1, 1.25, .004);
  for (const k of [-1, 1]) piece({ L: .03, Wd: .028, cup: .8, reflex: .1, ruffle: 0, seed: 8 }, Math.PI + k * .75, lipA, lipB, .8, .008);
  piece({ L: .05, Wd: .046, cup: 1, reflex: .2, ruffle: .1, seed: 7 }, Math.PI, lipA, lipB, .9, .012);
  const dot = (c, rx, ry, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat(c)); m.scale.set(rx * s, ry * s, .002); m.position.set(x * s, y * s, z * s); g.add(m); };
  dot('#f3d97c', .009, .006, 0, -.008, .016);   /* 喉口淡黄 */
  dot('#fbf6e6', .006, .003, 0, -.015, .017);
  dot('#f8f6fc', .005, .007, 0, .004, .018);    /* 蕊柱 */
  return g;
}
function orchidStem(f, root, d, len, tilt, seed) {
  const grad = Hy.gradOf(f) || [Hy.colorsOf(f)[0], '#efecfc'], r = rng(seed), g = new THREE.Group();
  const d2 = d.clone().add(new THREE.Vector3(-.2, 0, 0)).normalize();   /* 花葶往左偏，弧再往右弯回来，整枝落在正中 */
  const curve = bend(root, d2, len, tilt, r, .03);
  g.add(stemMesh(curve, .004, .0024, '#86b862'));
  /* 基部两片宽叶往两边摊开 */
  for (const [ang, L] of [[1.25, .2], [-1.35, .17]]) { hangLeaf(g, leafGeo({ L, W: .085, kind: 'ovate', seed: seed + (ang > 0 ? 3 : 4) }), '#7fbf68', root.clone().add(new THREE.Vector3(0, .01, 0)), UP, ang > 0 ? .25 : Math.PI - .25, 1, .2); }
  const top = curve.getPointAt(1), arc = new THREE.CatmullRomCurve3([top.clone().add(new THREE.Vector3(0, -.12, 0)), top, top.clone().add(new THREE.Vector3(.1, .05, 0)), top.clone().add(new THREE.Vector3(.22, .03, 0)), top.clone().add(new THREE.Vector3(.33, -.06, 0))]);
  g.add(stemMesh(arc, .003, .002, '#86b862'));
  const T = [.2, .44, .66, .84, .97];
  T.forEach((t, i) => {
    const p = arc.getPointAt(t), bud = i >= 3, e = p.clone().add(new THREE.Vector3(.008, bud ? -.018 : -.03, 0));
    g.add(stemMesh(new THREE.CatmullRomCurve3([p, p.clone().add(new THREE.Vector3(.008, -.008, 0)), e]), .0015, .0011, '#86b862'));
    if (bud) { const b = new THREE.Mesh(new THREE.SphereGeometry(.014 * (i === 3 ? 1 : .75), 12, 10), mat('#' + new THREE.Color(grad[0]).lerp(new THREE.Color(grad[1]), .35).getHexString())); b.position.copy(e).add(new THREE.Vector3(0, -.01, .01)); g.add(b); return; }
    const h = orchidHead(grad[0], grad[1], BIG * .62 * (1 - i * .07), seed + i, Hy.lipOf(f) || '#997cb6'); h.position.copy(e).add(new THREE.Vector3(0, -.05 * (1 - i * .07), .02 + i * .004)); h.rotation.z = (r() - .5) * .2; g.add(h);
  });
  g.userData.tip = arc.getPointAt(.44); g.userData.tape = curve.getPointAt(.3); g.userData.tapeTg = curve.getTangentAt(.3);
  return g;
}
/* 国兰：压平了正对着看。一丛细长的叶往两边拱出去再垂下来，
   中间一根细花葶直直站着、旁边一根矮的，花一朵朵左右错开；三片窄萼摊成星，两片小花瓣兜着蕊柱，唇瓣奶白带几点淡斑 */
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function cymPetal(o, G) {
  const g = petalGeo({ notch: 0, ruffle: 0, ...o, key: 'c' }).clone(), uv = g.getAttribute('uv'), col = g.getAttribute('color'), [A, B, E] = G.map((c) => new THREE.Color(c)), c = new THREE.Color();
  for (let i = 0; i < col.count; i++) {
    const u = uv.getX(i), v = uv.getY(i) * 2 - 1;
    c.copy(A).lerp(B, sm(.3, .82, u)); c.lerp(E, .55 * sm(.82, 1, u)); c.lerp(A, .4 * Math.exp(-Math.pow(v / .18, 2)) * (1 - sm(.55, .95, u)));   /* 瓣根雾紫过到粉蓝，中脉一道淡紫 */
    col.setXYZ(i, c.r, c.g, c.b);
  }
  return g;
}
function cymLipPetal(o, lip) {
  const g = petalGeo({ notch: 0, ...o, key: 'c' }).clone(), uv = g.getAttribute('uv'), col = g.getAttribute('color'), S = new THREE.Color(lip), W = new THREE.Color('#f7f3f4'), c = new THREE.Color();
  const spots = [[.34, 0], [.44, -.42], [.44, .42], [.6, -.18], [.6, .22], [.74, -.46], [.76, .4]];
  for (let i = 0; i < col.count; i++) {
    const u = uv.getX(i), v = uv.getY(i) * 2 - 1; let sp = 0;
    for (const [su, sv] of spots) sp = Math.max(sp, Math.exp(-Math.pow((u - su) / .07, 2) - Math.pow((v - sv) / .17, 2)));
    c.copy(W).lerp(S, .4 * (1 - sm(.05, .3, u))).lerp(S, .8 * sp); col.setXYZ(i, c.r, c.g, c.b);
  }
  return g;
}
function cymHead(G, lip, s, seed) {
  const g = new THREE.Group(), r = rng(seed);
  const piece = (geo, a, z = 0) => { const m = new THREE.Mesh(geo, mat('#ffffff', { vertexColors: true, opacity: .94 })); m.rotation.z = a + (r() - .5) * .08; m.position.z = z * s; m.scale.setScalar(s); g.add(m); };
  piece(cymPetal({ L: .078, Wd: .028, cup: .3, reflex: .1, seed: 1 }, G), 0);
  for (const k of [-1, 1]) piece(cymPetal({ L: .074, Wd: .027, cup: .3, reflex: .1, seed: 2 + (k > 0) }, G), k * 2.05);
  for (const k of [-1, 1]) piece(cymPetal({ L: .04, Wd: .026, cup: .6, reflex: .05, seed: 5 }, G), k * .5, .006);
  piece(cymLipPetal({ L: .036, Wd: .034, cup: .5, reflex: .3, ruffle: .1, seed: 7 }, lip), Math.PI, .01);
  const colm = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat('#f6f2fa')); colm.scale.set(.004 * s, .008 * s, .002); colm.position.set(0, .006 * s, .014 * s); g.add(colm);   /* 蕊柱 */
  return g;
}
function grassRibbon(curve, W, c) {
  const N = 40, V = [-1, 0, 1], pos = [], col = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, p = curve.getPointAt(u), t = curve.getTangentAt(u), sd = new THREE.Vector3().crossVectors(t, PRESS).normalize();
    const w = W * .5 * (.35 + .65 * Math.sin(Math.min(1, u / .14) * Math.PI / 2)) * Math.pow(Math.max(0, 1 - Math.pow(u, 2.4)), .55);
    for (const v of V) { const q = p.clone().addScaledVector(sd, v * w); pos.push(q.x, q.y, q.z); const sh = .82 + .22 * u; col.push(sh, sh, sh); }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < 2; j++) { const a = i * 3 + j, b = a + 3; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
  return new THREE.Mesh(geo, skin(c));
}
function cymbidiumStem(f, root, d, len, tilt, seed) {
  const grad = Hy.gradOf(f) || [Hy.colorsOf(f)[0], '#a9c3e0', '#e2e9f4'], G = [grad[0], grad[1], grad[2] || grad[1]], lip = Hy.lipOf(f) || '#a48ac2', r = rng(seed), g = new THREE.Group();
  const curve = bend(root, d, len, tilt, r, .025);
  g.add(stemMesh(curve, .0028, .0018, '#86b862'));
  const spike = (cv, K, sd0, sc0) => {
    for (let i = 0; i <= K; i++) {
      const t = .42 + i / K * .58, p = cv.getPointAt(t), tg = cv.getTangentAt(t), sg = (i + sd0) % 2 ? 1 : -1, side = new THREE.Vector3().crossVectors(tg, PRESS).normalize().multiplyScalar(sg), bud = i === K, sc = sc0 * (1 - i / K * .15);
      const e = p.clone().addScaledVector(side, (bud ? .01 : .018) * sc).add(new THREE.Vector3(0, .008 * sc, 0));
      g.add(stemMesh(new THREE.CatmullRomCurve3([p, p.clone().addScaledVector(side, .008 * sc).add(new THREE.Vector3(0, .005 * sc, 0)), e]), .0012, .0009, '#86b862'));
      if (bud) { const b = new THREE.Mesh(new THREE.SphereGeometry(.009 * sc, 10, 8), mat('#' + new THREE.Color(G[0]).lerp(new THREE.Color(G[1]), .3).getHexString())); b.scale.set(.75, 1.6, .5); b.position.copy(e).add(new THREE.Vector3(0, .008 * sc, .01)); g.add(b); continue; }
      const h = cymHead(G, lip, BIG * .66 * sc, seed + i * 3 + sd0 * 11); h.position.copy(e).addScaledVector(side, .02 * sc).add(new THREE.Vector3(0, 0, .02 + i * .003)); h.rotation.z = -sg * .3 + (r() - .5) * .15; g.add(h);
    }
  };
  spike(curve, 4, 0, 1);
  const d2 = d.clone().add(new THREE.Vector3(.22, 0, 0)).normalize(), c2 = bend(root.clone().add(new THREE.Vector3(.004, 0, -.004)), d2, len * .66, tilt, r, .02);
  g.add(stemMesh(c2, .0024, .0016, '#86b862')); spike(c2, 3, 1, .9);
  /* 叶：七片，往左右拱出去，高的立着，低的垂下来，梢头慢慢收细 */
  const LC = ['#7fbf68', '#8ccb72', '#72b05e'];
  for (let i = 0; i < 7; i++) {
    const sg = i % 2 ? 1 : -1, k = i < 2 ? 1 + r() * .3 : 1.7 + r() * 1, R = len * (.32 + r() * .3), H = len * (.26 + r() * .22), b0 = root.clone().add(new THREE.Vector3(0, .01, -.01 - i * .001));
    const pts = [0, .12, .3, .5, .7, .85, 1].map((u) => b0.clone().add(new THREE.Vector3(sg * R * u, H * (2 * u - k * u * u), 0)));
    g.add(grassRibbon(new THREE.CatmullRomCurve3(pts, false, 'centripetal', .5), .016 + r() * .006, LC[i % 3]));
  }
  g.userData.tip = curve.getPointAt(.8); g.userData.tape = curve.getPointAt(.22); g.userData.tapeTg = curve.getTangentAt(.22);
  return g;
}

// ---------- 一枝花（没有花器）：从 root 往 d 方向长 len，整株在 XY 平面里，花脸朝镜头 ----------
const BIG = 1.45; 
function stemOf(f, root, d, len, tilt, seed) {
  if (Hy.lookOf(f) === 'campanula') return campanulaStem(f, root, d, len * Hy.paramsOf(Hy.genesOf(f)).height, tilt, seed); 
  if (Hy.lookOf(f) === 'orchid') return orchidStem(f, root, d, len * Hy.paramsOf(Hy.genesOf(f)).height, tilt, seed); 
  if (Hy.lookOf(f) === 'cymbidium') return cymbidiumStem(f, root, d, len * Hy.paramsOf(Hy.genesOf(f)).height, tilt, seed); 
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
