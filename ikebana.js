// 插花台：从花园剪开着的花来插，五种花器换着用；镜头近、花少，所以花和花器都比花园里细
// 画法跟花园同一套：shop/look.js 的卡通光+描边，town/look2.js 的水彩后期
// 细节：
//   花瓣参数化（倒卵形、勺子兜、梢缺口、翻边、裙边褶、两侧折痕、每片各自歪），根深梢浅用顶点色；
//   枝是渐细的弯管，叶有中脉有垂头；蓝雪花是一枝松散的小枝，枝梢几团小五瓣；配叶换成尤加利和真蕨两种；
//   花器重车：矮陶钵、玉壶春白瓷、玻璃杯、编织篮、粗陶壶；插法按真插花三主枝：主枝高、副枝中、客枝低，配叶贴口。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';   /* 碎雾那种几十根小枝并成一个 mesh */
import { mat, washTex, outline, shadowAll } from './shop/look.js';
import { makeLook } from './town/look2.js';
import { C } from './shop/house.js';
import * as Day from './day.js';   /* 插好的摆进园子的花位 */
import * as Hy from './hybrid.js';   /* 杂交：花按基因捏，新花在面板里能插、长按改名 */

const $ = (s) => document.querySelector(s);
const DAY = 86400e3, MAX = 7;
/* 跟 main.js 的 MOODS 一样的颜色；旧 demo 的几个 id 也认 */
const MOODS = { happy: ['开心', '#f2c14e'], sweet: ['心动', '#e98aa4'], calm: ['平静', '#9ec5e6'], coax: ['想被哄', '#f3b9a0'], down: ['有点丧', '#b9a3de'], messy: ['乱糟糟', '#c9b38a'], cross: ['烦', '#e36a5a'], tired: ['累', '#b9a3de'], blue: ['难过', '#f4f0e8'] };
const colorOf = (id) => (MOODS[id] || MOODS.sweet)[1];
const nameOf = (id) => (MOODS[id] || ['', ''])[0];
const toast = (t) => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 1600); };

// ---------- 读花园（只读：库不存在就别建，免得花园那边开库时少了表） ----------
function readFlowers() {
  return new Promise((ok) => {
    let r; try { r = indexedDB.open('diarytown', 1); } catch (e) { return ok([]); }
    r.onupgradeneeded = () => { r.transaction.abort(); };
    r.onerror = () => ok([]);
    r.onsuccess = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('flowers')) { d.close(); return ok([]); }
      const q = d.transaction('flowers').objectStore('flowers').getAll();
      q.onsuccess = () => { d.close(); ok(q.result || []); }; q.onerror = () => { d.close(); ok([]); };
    };
  });
}
const SAMPLES = [['sweet'], ['calm'], ['happy', 'coax'], ['down'], ['calm'], ['cross', 'sweet'], ['messy']].map((ms, i) => ({ id: 's' + i, at: Date.now() - (4 + i) * DAY, mood: ms[0], moods: ms, text: '样例', sample: true }));

// ---------- 场景 ----------
const cv = $('#cv');
const R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
R.setPixelRatio(Math.min(1.5, devicePixelRatio)); R.outputColorSpace = THREE.SRGBColorSpace;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.setSize(innerWidth, innerHeight, false);
const S = new THREE.Scene(); S.background = new THREE.Color('#fbfaf6'); S.fog = new THREE.Fog('#fbfaf6', 7, 16);
const CAM = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, .05, 40);
/* 白纸底、中性白光，影子偏一点冷，粉是粉、蓝是蓝 */
S.add(new THREE.HemisphereLight('#ffffff', '#c3ced8', 1.5));
const SUN = new THREE.DirectionalLight('#ffffff', 1.9); SUN.position.set(-2.5, 5, 3.5); SUN.target.position.set(0, .4, 0);
SUN.castShadow = true; SUN.shadow.mapSize.set(1024, 1024); Object.assign(SUN.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: .5, far: 20 });
SUN.shadow.bias = -.0006; SUN.shadow.normalBias = .02; SUN.shadow.radius = 4; S.add(SUN, SUN.target);
const LOOK = makeLook(R, '#fbfaf6'); LOOK.setTilt(.25, .55); LOOK.setWarm(0);
const wash = (c, o = {}) => mat('#ffffff', { map: washTex(c, { blots: o.blots || 40, seed: o.seed || 3, rep: o.rep || [1, 1] }) });

/* 桌子和后面一扇窗，给近景一点底 */
const room = new THREE.Group();
const top = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, .08, 48), wash('#e4d6c2', { rep: [2, 2], seed: 4 })); top.position.y = -.04; top.userData.lineW = .006; room.add(top);
const cloth = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, .012, 40), wash('#fdfcf8', { seed: 8 })); cloth.position.y = .006; cloth.userData.lineW = .003; room.add(cloth);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), wash('#f5f3ee', { rep: [3, 2], seed: 2 })); wall.position.set(0, 2, -2.2); wall.userData.noLine = true; room.add(wall);
const win = new THREE.Group(); win.position.set(.9, 1.55, -2.18);
const glassW = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), mat('#eef5f8', { emissive: new THREE.Color('#ffffff'), emissiveIntensity: .25 })); glassW.userData.noLine = true; win.add(glassW);
for (const [w, h, x, y] of [[1.2, .06, 0, .67], [1.2, .06, 0, -.67], [.06, 1.4, .57, 0], [.06, 1.4, -.57, 0], [1.1, .035, 0, .1], [.035, 1.3, 0, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .04), mat(C.white)); b.position.set(x, y, .02); win.add(b); }
room.add(win);
outline(room, { w: .006 }); shadowAll(room); wall.receiveShadow = true; S.add(room);

const CTL = new OrbitControls(CAM, cv); CTL.target.set(0, .5, 0); CTL.enableDamping = true; CTL.enablePan = false;
CTL.minDistance = 1.6; CTL.maxDistance = 5.5; CTL.minPolarAngle = .5; CTL.maxPolarAngle = 1.45;
CTL.minAzimuthAngle = -1.2; CTL.maxAzimuthAngle = 1.2;
/* 底下面板盖住一截，画面整体往上挪一点 */
function resize() { dirty = true; const w = innerWidth, h = innerHeight; R.setSize(w, h, false); LOOK.resize(); CAM.aspect = w / h; CAM.setViewOffset(w, h, 0, h * .1, w, h); CAM.updateProjectionMatrix(); }
addEventListener('resize', resize);
CAM.position.set(0, 1.5, innerWidth < innerHeight ? 4.6 : 3.2);

// ---------- 小工具：带种子的随机、参数曲面 ----------
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
const skin = (c, o = {}) => mat(c, { side: THREE.DoubleSide, vertexColors: true, ...o });

// ---------- 花瓣：u 沿瓣长 0 根→1 梢，v 横向 -1..1 ----------
const petalCache = new Map();
function petalGeo({ L = .16, Wd = .12, cup = 1, reflex = 1, ruffle = 1, notch: notch0 = null, tipPt = 0, waist = .6, seed = 0, key = '' }) {
  const k = key + ':' + seed + ':' + L + ':' + Wd + ':' + cup + ':' + reflex + ':' + ruffle + ':' + notch0 + ':' + tipPt + ':' + waist; if (petalCache.has(k)) return petalCache.get(k);
  const r = rng(seed + 11), ph1 = r() * 6.28, ph2 = r() * 6.28, nr = .06 + r() * .04, notch = notch0 == null ? nr : notch0, crease = .7 + r() * .5, skew = (r() - .5) * .1, foldMid = r() * .06;
  const width = (u) => Wd * .5 * (.1 + .9 * Math.pow(Math.sin(Math.min(1, u / waist) * Math.PI / 2), 1.1)) * (1 - tipPt * Math.pow(Math.max(0, u - waist) / (1 - waist), 2.2) * .85);   /* 收尖集中在最后一截，梢头是圆的不是针 */
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

/* 一片瓣根→梢换色：顶点色乘上去，材质给白 */
const gradCache = new Map();
function gradGeo(geo, c0, c1, pw = .9) {
  const k = geo.uuid + c0 + c1 + pw; if (gradCache.has(k)) return gradCache.get(k);
  const g = geo.clone(), uv = g.getAttribute('uv'), col = g.getAttribute('color'), A = new THREE.Color(c0), B = new THREE.Color(c1), c = new THREE.Color();
  for (let i = 0; i < col.count; i++) { const u = uv.getX(i), sh = col.getX(i); c.copy(A).lerp(B, Math.pow(u, pw)); col.setXYZ(i, c.r * sh, c.g * sh, c.b * sh); }
  col.needsUpdate = true; gradCache.set(k, g); return g;
}
const lerpHex = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

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
const LEAF_C = ['#6f9a4c', '#7fa857', '#5f8743', '#8ab35f'];
const EUCA_C = ['#8aa48c', '#9cb3a0', '#7c9681'];
/* 把一片叶挂在枝上某点：pos 位置，tg 枝的切线，ang 绕枝的方位，s 大小 */
function hangLeaf(host, geo, c, pos, tg, ang, s, lift = .35) {
  const l = new THREE.Mesh(geo, skin(c)); l.userData.noLine = true;
  const side = new THREE.Vector3().crossVectors(tg, UP).normalize(); if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
  const n2 = new THREE.Vector3().crossVectors(tg, side).normalize();
  const out = side.clone().multiplyScalar(Math.cos(ang)).add(n2.clone().multiplyScalar(Math.sin(ang))).lerp(tg, lift).normalize();
  l.position.copy(pos); l.quaternion.setFromUnitVectors(UP, out);
  const z = new THREE.Vector3(0, 0, 1).applyQuaternion(l.quaternion), want = out.clone().cross(UP).cross(out).normalize().negate();   // 叶面朝上
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
const STEM_C = '#6b8c47', TWIG_C = '#7d7458';
function stemMesh(curve, r0, r1, c = STEM_C) { const m = new THREE.Mesh(tube(curve, r0, r1), mat(c, { vertexColors: true })); m.userData.lineW = .0018; return m; }
/* 一段弯枝：从 a 往 d 走 len，两个方向各一个轻轻的 S（每株随机，幅度小，别像面条），越斜越垂。
   「去哪来这么笔直一根茎啊」，原来只有一边一个小弯 */
function bend(a, d, len, tilt, r, lateral = .05, pre = null) {
  const side = new THREE.Vector3().crossVectors(d, UP).normalize(); if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
  const n2 = new THREE.Vector3().crossVectors(d, side).normalize();
  const wob = (r() - .5) * 2 * lateral * len, wob2 = (r() - .5) * 2 * lateral * len * .8, ph = r();
  const at = (t, sw, fw, drop) => a.clone().addScaledVector(d, len * t).addScaledVector(side, sw).addScaledVector(n2, fw).add(new THREE.Vector3(0, -tilt * len * drop, 0));
  const p1 = at(.3, wob * .9, wob2 * .7, .01), pk = at(.55, wob * .1 + (ph - .5) * .02 * len, -wob2 * .2, .03), p2 = at(.78, -wob * .45, -wob2 * .5, .07), tip = at(1, wob * .15, wob2 * .1, .12);
  return new THREE.CatmullRomCurve3(pre ? [pre, a, p1, pk, p2, tip] : [a, p1, pk, p2, tip], false, 'centripetal', .6);
}
/* 整根枝：口下面一截竖直（在瓶子里、在水里），到口才按方向弯出去。截图：细颈瓶的配叶从肩膀穿出来，就是原来从底下起笔就斜着走 */
function stemPath(root, a, d, len, tilt, r, lateral) {
  const a0 = a.clone().add(new THREE.Vector3(0, -.04, 0)), path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(root, a0)); path.add(bend(a, d, len, tilt, r, lateral, a0));
  path.tin = path.curves[0].getLength() / path.getLength();   // 露在口外那段从 t=tin 起
  return path;
}

/* 垂铃的茎：钓竿那样，口上先直起一截，上半段弯成弧，梢头低过最高点；tilt 越大弓得越平 */
function archPath(root, a, d, len, tilt, r) {
  const h = new THREE.Vector3(d.x, 0, d.z); if (h.lengthSq() < 1e-4) h.set(1, 0, 0); h.normalize();
  const k = Math.min(1, tilt / 1.2), up = 1 - .3 * k, fw = .8 + .5 * k, wob = (r() - .5) * .08 * len, side = new THREE.Vector3().crossVectors(h, UP);
  const Q = (u, f, sd) => a.clone().addScaledVector(UP, u * len * up).addScaledVector(h, f * len * fw).addScaledVector(side, sd * wob);
  const a0 = a.clone().add(new THREE.Vector3(0, -.04, 0)), path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(root, a0));
  path.add(new THREE.CatmullRomCurve3([a0, a, Q(.3, .03, .3), Q(.52, .18, .7), Q(.6, .38, 1), Q(.54, .56, .9), Q(.4, .68, .7)], false, 'centripetal', .5));
  path.tin = path.curves[0].getLength() / path.getLength();
  path.h = h; path.side = side;
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
function faceHead(head, tg, r, up = .25, toward = .45, nod = .2) {
  const aim = tg.clone().lerp(UP, up).add(new THREE.Vector3(0, 0, toward)).normalize();
  const side = new THREE.Vector3().crossVectors(aim, UP).normalize(); if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
  aim.applyAxisAngle(side, nod * (.5 + r())).applyAxisAngle(aim.clone(), 0).applyAxisAngle(new THREE.Vector3().crossVectors(side, aim).normalize(), (r() - .5) * .5).normalize();
  head.quaternion.setFromUnitVectors(UP, aim); head.rotateY(r() * 6.28);
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


// ---------- 另外五副骨架：按 hybrid.js 的 form 挑 ----------
/* 2 垂铃：小铃铛，挂点在上、口朝下。R 口半径、H 高、n 口上几个齿、flare 口外翻、ruffle 口沿一点皱 */
const bellCache = new Map();
function bellGeo({ R = .02, H = .03, n = 6, flare = .5, ruffle = .3, seed = 0 }) {
  const k = [R, H, n, flare, ruffle, seed].join(':'); if (bellCache.has(k)) return bellCache.get(k);
  const r = rng(seed + 5), ph = r() * 6.28;
  const g = surf(24, 8, (u, v) => {
    const a = u * Math.PI * 2, t = (v + 1) / 2, lip = Math.max(0, t - .74) / .26, tooth = .5 + .5 * Math.cos(a * n + ph);
    let rad = R * (.3 + .7 * Math.pow(Math.sin(Math.min(1, t / .82) * Math.PI / 2), .9));   // 肚子
    rad += R * (flare * .4 * lip * lip + .13 * lip * lip * tooth + ruffle * .05 * lip * Math.sin(a * n * 2.3 + ph));   // 口外翻、齿、皱
    const y = -t * H - H * .12 * lip * lip * tooth;   // 齿尖再往下探一点
    return [Math.cos(a) * rad, y, Math.sin(a) * rad, .78 + .3 * t];
  });
  bellCache.set(k, g); return g;
}
/* 3 佛焰苞（马蹄莲）：一片苞卷成漏斗，卷一圈多，口斜着开，一侧拉出个尖 */
const spatheCache = new Map();
function spatheGeo({ R = .09, H = .2, ruffle = .5, seed = 0 }) {
  const k = [R, H, ruffle, seed].join(':'); if (spatheCache.has(k)) return spatheCache.get(k);
  const r = rng(seed + 9), tipA = 2.4 + (r() - .5) * .6, ph = r() * 6.28, TURN = 1.3;
  const g = surf(20, 30, (u, v) => {
    const w = (v + 1) / 2, a = w * Math.PI * 2 * TURN, lift = Math.exp(-Math.pow((a - tipA) / .75, 2));
    let rad = R * (.07 + .93 * Math.pow(u, 1.5)) * (1 + .2 * w);   // 越外圈半径越大，卷得上
    rad *= 1 + .32 * Math.pow(u, 4) * (1 - lift) + .2 * u * u * lift;   // 口沿外翻，尖那一侧往后仰
    rad += R * ruffle * .03 * Math.pow(u, 3) * Math.sin(a * 5 + ph);
    const y = u * H * (.82 + .18 * Math.cos(a - tipA)) + .55 * H * u * u * lift;   // 口斜着开，尖拉高
    return [Math.cos(a) * rad, y, Math.sin(a) * rad, .8 + .3 * u];   // 喉深口浅
  });
  spatheCache.set(k, g); return g;
}
function spathe(cs, s, seed, P) {
  const r = rng(seed), g = new THREE.Group();
  const m = new THREE.Mesh(spatheGeo({ R: .06 * (.8 + .4 * P.petal.Wd / .12), H: .15 * (.9 + .2 * P.petal.cup / 1.6), ruffle: P.petal.ruffle, seed: seed % 7 }), skin(cs[0])); m.userData.lineW = .0022; m.scale.setScalar(s); g.add(m);
  /* 肉穗：一根黄的，上面一粒粒 */
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(.006 * s, .009 * s, .1 * s, 8), mat('#e9c25a')); sp.position.y = .058 * s; sp.userData.lineW = .0014; g.add(sp);
  for (let i = 0; i < 18; i++) { const a = i * 2.4, y = .025 + (i / 18) * .08, rr = .0088 - i / 18 * .003; const b = new THREE.Mesh(new THREE.SphereGeometry(.0025 * s, 5, 4), mat('#d9ad3c')); b.position.set(Math.cos(a) * rr * s, y * s, Math.sin(a) * rr * s); b.userData.noLine = true; g.add(b); }
  const base = new THREE.Mesh(new THREE.SphereGeometry(.014 * s, 8, 6), mat('#86a05a')); base.scale.y = 1.4; base.position.y = -.004 * s; base.userData.lineW = .0012; g.add(base);
  return g;
}
/* 4 包心：一圈圈螺旋裹着，外松内紧，没有露出来的花心 */
function packed(cs, s, seed, open, P, grad = null) {
  const r = rng(seed), g = new THREE.Group(), K = P.n * 3 + 6, GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < K; i++) {
    const t = i / (K - 1), pv = new THREE.Group(); pv.rotation.y = i * GA + (r() - .5) * .15;
    const pc = grad ? lerpHex(grad[0], grad[1], Math.pow(t, 1.2)) : cs[i % cs.length];   /* 渐变：里深外浅，自己带点亮，背光面不发紫 */
    const m = new THREE.Mesh(petalGeo({ ...P.petal, cup: P.petal.cup * .6 + .4 + 1.3 * (1 - t), reflex: .3 + .9 * t, seed: seed * 7 + i, key: 'r' }), grad ? skin(pc, { emissive: pc, emissiveIntensity: .3 }) : skin(pc)); m.userData.noLine = true;
    m.rotation.x = -Math.PI / 2 + .12 + (open * .8 - .12) * Math.pow(t, 1.7) + (r() - .5) * .1;   // 里面直立、外面摊开
    m.position.set(0, (1 - t) * .02 * s, -.006 * s * t);
    m.scale.setScalar(s * (.42 + .62 * Math.pow(t, .8)) * (.94 + r() * .12)); pv.add(m); g.add(pv);
  }
  return g;
}
/* 6 头状：中间凸起的花心盘，一圈细长舌瓣摊平；浅色花配黄心，深色花配褐心 */
function capitulum(cs, s, seed, open, P) {
  const r = rng(seed), g = new THREE.Group(), K = P.n * 3, hsl = {}; new THREE.Color(cs[0]).getHSL(hsl);
  const dc = hsl.l > .64 ? ['#e3b64c', '#c99a35'] : ['#5b4336', '#443128'];
  const ring = (n, sc, op, off, lift) => {
    for (let i = 0; i < n; i++) {
      const pv = new THREE.Group(); pv.rotation.y = i / n * Math.PI * 2 + off + (r() - .5) * .1;
      const m = new THREE.Mesh(petalGeo({ L: .19, Wd: Math.min(.09, P.petal.Wd) * .7, cup: P.petal.cup * .35, reflex: .7, ruffle: P.petal.ruffle * .5, notch: P.petal.notch, seed: seed * 7 + i + (off ? 50 : 0), key: 'd' }), skin(cs[i % cs.length])); m.userData.noLine = true;
      m.rotation.x = -Math.PI / 2 + op + (r() - .5) * .14; m.position.y = lift; m.position.z = -.018 * s; m.scale.setScalar(s * sc * (.92 + r() * .16)); pv.add(m); g.add(pv);
    }
  };
  ring(K, 1, .2 + (open - 1) * .3, 0, 0);
  if (P.dbl) ring(K, .78, .42, Math.PI / K, .004 * s);
  const disc = new THREE.Mesh(new THREE.SphereGeometry(.03 * s, 14, 10), mat(dc[0])); disc.scale.y = .42; disc.position.y = .004 * s; disc.userData.lineW = .0014; g.add(disc);
  for (let i = 0; i < 22; i++) { const a = i * 2.4, rr = Math.sqrt(i / 22) * .025 * s, b = new THREE.Mesh(new THREE.SphereGeometry(.0032 * s, 5, 4), mat(dc[1])); b.position.set(Math.cos(a) * rr, .004 * s + Math.sqrt(Math.max(0, 1 - Math.pow(rr / (.03 * s), 2))) * .0126 * s, Math.sin(a) * rr); b.userData.noLine = true; g.add(b); }
  return g;
}
/* 7 风花：五六片宽圆瓣微微兜着，瓣背一丝粉（里外两层皮，外面那层淡粉）；
   中间一颗青绿圆芯，外头一圈金黄花蕊往外撑开 */
const anStamG = new THREE.CylinderGeometry(.0011, .0015, .03, 4); anStamG.translate(0, .015, 0);
function anemone(cs, s, seed, P, grad = null) {
  const r = rng(seed), g = new THREE.Group(), n = seed % 3 === 0 ? Math.max(5, P.n - 1) : P.n;   /* 五片六片都有 */
  const hsl = {}; new THREE.Color(cs[0]).getHSL(hsl);
  const back = hsl.l > .8 ? '#f6e2e7' : new THREE.Color(cs[0]).offsetHSL(0, .08, -.06).getStyle();   /* 白花的背面偏粉，有色的花背面略深 */
  for (let i = 0; i < n; i++) {
    const pv = new THREE.Group(); pv.rotation.y = i / n * Math.PI * 2 + (r() - .5) * .24;
    const geo = petalGeo({ L: .15, Wd: Math.min(.105, P.petal.Wd * .8), cup: .25 + P.petal.cup * .15, reflex: .4, ruffle: .15 + P.petal.ruffle * .2, notch: P.petal.notch * .5, seed: seed * 7 + i, key: 'a' });   /* 瓣别太宽，六片之间要看得出是六片，不然叠成一个盘 */
    const ang = -Math.PI / 2 + .36 + (r() - .5) * .16, sc = s * (.94 + r() * .12);   /* 摊得开，只微微兜 */
    const m = new THREE.Mesh(geo, mat(back, { side: THREE.FrontSide, vertexColors: true, emissive: back, emissiveIntensity: .42 }));   /* 瓣背自己带点亮，背光时还是淡粉，不发灰 */ m.userData.noLine = true; m.rotation.x = ang; m.scale.setScalar(sc); pv.add(m);   /* surf 的正面朝外，是瓣背 */
    const m2 = grad ? new THREE.Mesh(gradGeo(geo, grad[0], grad[1]), mat('#ffffff', { side: THREE.BackSide, vertexColors: true })) : new THREE.Mesh(geo, mat(cs[0], { side: THREE.BackSide, vertexColors: true }));   /* 渐变：根→梢 */
    m2.userData.noLine = true; m2.rotation.x = ang; m2.scale.setScalar(sc); pv.add(m2);
    g.add(pv);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(.015 * s, 12, 9), mat('#a9c25c')); core.scale.y = .78; core.position.y = .01 * s; core.userData.lineW = .0012; g.add(core);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.009 * s, 8, 6), mat('#8aa65a')); knob.scale.y = 1.3; knob.position.y = -.002 * s; knob.userData.lineW = .001; g.add(knob);   /* 背面一点绿托 */
  for (let i = 0; i < 14; i++) { const a = i * 2.4, rr = Math.sqrt(i / 14) * .011 * s, b = new THREE.Mesh(new THREE.SphereGeometry(.0022 * s, 5, 4), mat('#94ae49')); b.position.set(Math.cos(a) * rr, .01 * s + Math.sqrt(Math.max(0, 1 - Math.pow(rr / (.015 * s), 2))) * .0117 * s, Math.sin(a) * rr); b.userData.noLine = true; g.add(b); }
  const K = 30;
  for (let i = 0; i < K; i++) {
    const a = i / K * Math.PI * 2 + (i % 2) * .1 + (r() - .5) * .08, lean = .62 + (i % 3) * .14 + (r() - .5) * .1, L = .036 * s * (.8 + r() * .35), b0 = .015 * s;   /* 站得直些、长些，花蕊才探到瓣上头 */
    const st = new THREE.Mesh(anStamG, mat('#f1d98e')); st.userData.noLine = true; st.position.set(Math.cos(a) * b0, .009 * s, Math.sin(a) * b0); st.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean); st.scale.set(s, L / .03, s); g.add(st);
    const an = new THREE.Mesh(antherG, mat('#eea230')); an.userData.noLine = true; an.scale.setScalar(s * .75);
    an.position.set(Math.cos(a) * (b0 + Math.sin(lean) * L), .009 * s + Math.cos(lean) * L, Math.sin(a) * (b0 + Math.sin(lean) * L)); g.add(an);
  }
  return g;
}

function lily(cs, s, seed, P, grad) {
  const r = rng(seed), g = new THREE.Group(), n = P.n, c0 = grad ? grad[0] : cs[0], c1 = grad ? grad[1] : lerpHex(cs[0], '#ffffff', .4);
  const petal = (o, c0, c1) => { const geo = petalGeo({ ...o, key: 'l' }); return new THREE.Mesh(gradGeo(geo, c0, c1, 1.7), mat('#ffffff', { side: THREE.DoubleSide, vertexColors: true, emissive: c1, emissiveIntensity: .18 })); };
  for (let i = 0; i < n; i++) {
    const pv = new THREE.Group(); pv.rotation.y = i / n * Math.PI * 2 + (r() - .5) * .1;
    /* 「不是花瓣变宽，是花瓣的顶头软一点」。瓣还是窄长的，只有梢头最后一截收成圆钝的小尖，像被捏过 */
    const m = petal({ L: .2, Wd: .075 * P.petal.Wd / .07, cup: .75 + P.petal.cup * .2, reflex: .7, ruffle: .12 + P.petal.ruffle * .2, notch: 0, tipPt: .68, waist: .42, seed: 70 + i }, c0, c1); m.userData.noLine = true;
    m.rotation.x = -Math.PI / 2 + .58 + (r() - .5) * .1; m.scale.setScalar(s * 1.1 * (.95 + r() * .1)); pv.add(m); g.add(pv);   /* 斜朝上张开成喇叭 */
  }
  for (let i = 0; i < n; i++) {
    const pv = new THREE.Group(); pv.rotation.y = i / n * Math.PI * 2 + Math.PI / n;
    const m = petal({ L: .07, Wd: .036, cup: .9, reflex: .3, ruffle: 0, notch: 0, tipPt: .68, waist: .45, seed: 90 + i }, lerpHex(c0, c1, .25), lerpHex(c0, c1, .9)); m.userData.noLine = true;
    m.rotation.x = -Math.PI / 2 + .95; m.position.y = .003 * s; m.scale.setScalar(s); pv.add(m); g.add(pv);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(.014 * s, 16, 10), mat('#f4f8f6')); eye.scale.y = .6; eye.position.y = .006 * s; eye.userData.noLine = true; g.add(eye);
  const stG = new THREE.CylinderGeometry(.0009 * s, .0012 * s, .062 * s, 4); stG.translate(0, .031 * s, 0);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + .3, lean = .36, L = .062 * s;
    const st = new THREE.Mesh(stG, mat('#ffffff')); st.userData.noLine = true; st.position.set(Math.cos(a) * .006 * s, .008 * s, Math.sin(a) * .006 * s); st.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean); g.add(st);
    const an = new THREE.Mesh(antherG, mat('#f1dca4')); an.userData.noLine = true; an.scale.set(s * .9, s * .7, s * .55);
    an.position.set(Math.cos(a) * (.006 * s + Math.sin(lean) * L), .008 * s + Math.cos(lean) * L, Math.sin(a) * (.006 * s + Math.sin(lean) * L)); g.add(an);
  }
  return g;
}
function lilyBud(c0, c1, s) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) { const pv = new THREE.Group(); pv.rotation.y = i / 5 * Math.PI * 2; const m = new THREE.Mesh(gradGeo(petalGeo({ L: .06, Wd: .04, cup: 1.6, reflex: 0, ruffle: 0, notch: 0, tipPt: .6, waist: .5, seed: 120 + i, key: 'l' }), c0, c1, 1.7), mat('#ffffff', { side: THREE.DoubleSide, vertexColors: true })); m.userData.noLine = true; m.rotation.x = -Math.PI / 2 + 1.42; m.scale.setScalar(s); pv.add(m); g.add(pv); }
  return g;
}

// ---------- 花器：五种，车床转出来；mouth 口高、r 口里锚点半径、spread 张开度、h 器高、Lb 主枝基准长、depth 枝从口下多深起 ----------
function lathe(pts, m, seg = 48) { const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg); return new THREE.Mesh(g, m); }
function weaveTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#c29a66'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) for (let x = 0; x < 128; x += 16) { const o = ((x + y) / 16) % 2; g.fillStyle = o ? '#d1a873' : '#b08656'; g.fillRect(x + 1, y + 2, 14, 12); g.fillStyle = 'rgba(80,50,30,.3)'; g.fillRect(x, y + (o ? 13 : 1), 16, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 2); return t;
}
const water = (rad, y, c = '#5a6d6b') => { const w = new THREE.Mesh(new THREE.CircleGeometry(rad, 40), mat(c)); w.rotation.x = -Math.PI / 2; w.position.y = y; w.userData.noLine = true; return w; };
const VASES = {
  bowl: { zh: '矮陶钵', make() {
    const g = new THREE.Group();
    const body = lathe([[0, 0], [.22, 0], [.3, .02], [.36, .07], [.385, .14], [.375, .2], [.355, .235], [.345, .24], [.335, .23], [.325, .18], [.28, .12], [0, .11]], wash('#8c6a5a', { seed: 11, blots: 70 })); g.add(body);
    const glaze = lathe([[.327, .17], [.332, .2], [.336, .23], [.344, .238]], mat('#6f8f88')); glaze.userData.lineW = .002; g.add(glaze);
    g.add(water(.326, .215));
    const kenzan = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .02, 20), mat(C.iron)); kenzan.position.set(.06, .222, -.03); g.add(kenzan);
    return { g, mouth: .225, r: .16, spread: 1.25, h: .24, Lb: .72, depth: .06 };
  } },
  bottle: { zh: '玉壶春瓶', make() {
    const g = new THREE.Group();
    const body = lathe([[0, 0], [.12, 0], [.19, .03], [.235, .12], [.24, .22], [.215, .32], [.155, .4], [.095, .47], [.068, .56], [.062, .66], [.078, .74], [.094, .775], [.084, .78], [.064, .75], [.052, .66], [.05, .6], [0, .6]], mat('#f7f4ee')); g.add(body);
    const band = lathe([[.2405, .2], [.2415, .22], [.2405, .24]], mat('#6d86a8')); band.userData.lineW = .0015; g.add(band);
    const band2 = lathe([[.0625, .62], [.0635, .635], [.0625, .65]], mat('#6d86a8')); band2.userData.lineW = .0015; g.add(band2);
    return { g, mouth: .775, r: .026, spread: .7, h: .78, Lb: .62, depth: .3 };
  } },
  glass: { zh: '玻璃杯', make() {
    const g = new THREE.Group();
    const gl = lathe([[0, 0], [.15, 0], [.17, .015], [.178, .46], [.184, .475], [.172, .475], [.162, .03], [0, .03]], mat('#e8f2f2', { transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide })); gl.userData.lineW = .0025; gl.renderOrder = 2; g.add(gl);
    const wat = lathe([[0, .03], [.16, .03], [.166, .3], [0, .3]], mat('#c2e0e4', { transparent: true, opacity: .36, depthWrite: false })); wat.userData.noLine = true; wat.renderOrder = 1; g.add(wat);
    return { g, mouth: .475, r: .1, spread: 1, h: .48, Lb: .6, depth: .33, glass: true };
  } },
  basket: { zh: '编织篮', make() {
    const g = new THREE.Group(), pts = [[0, 0], [.2, 0]];
    for (let i = 0; i <= 16; i++) { const t = i / 16, y = .005 + t * .255, rr = .225 + .07 * Math.sin(t * Math.PI * .5) + .006 * Math.sin(t * 40); pts.push([rr, y]); }
    pts.push([.27, .265], [0, .265]);
    const body = lathe(pts, mat('#ffffff', { map: weaveTex() })); g.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.295, .02, 8, 48), mat('#a87a48')); rim.rotation.x = Math.PI / 2; rim.position.y = .262; g.add(rim);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.3, .016, 8, 36, Math.PI), mat('#a87a48')); handle.position.y = .262; handle.rotation.y = .55; g.add(handle);
    const moss = new THREE.Mesh(new THREE.SphereGeometry(.27, 24, 10, 0, Math.PI * 2, 0, .55), mat('#7d9a52')); moss.position.y = .02; moss.scale.y = .62; moss.userData.lineW = .003; g.add(moss);
    return { g, mouth: .2, r: .2, spread: 1.3, h: .27, Lb: .68, depth: .02 };
  } },
  jug: { zh: '粗陶壶', make() {
    const g = new THREE.Group();
    const body = lathe([[0, 0], [.14, 0], [.2, .04], [.232, .18], [.215, .3], [.15, .36], [.112, .42], [.1, .5], [.117, .545], [.102, .55], [.088, .5], [.085, .42], [0, .42]], wash('#a39080', { seed: 21, blots: 90 })); g.add(body);
    const hd = new THREE.Mesh(new THREE.TorusGeometry(.085, .014, 8, 24, Math.PI * .9), mat('#8e7b6a')); hd.position.set(.2, .38, 0); hd.rotation.set(0, 0, -.35); g.add(hd);
    const band = lathe([[.2321, .17], [.2335, .19], [.232, .21]], mat('#6b5f55')); band.userData.lineW = .0015; g.add(band);
    return { g, mouth: .55, r: .05, spread: .9, h: .55, Lb: .62, depth: .22 };
  } },
};
let vaseKey = 'bottle', vase = null;
function setVase(k) {
  vaseKey = k; if (vase) S.remove(vase.g);
  vase = VASES[k].make(); outline(vase.g, { w: .005 }); shadowAll(vase.g);
  if (vase.glass) vase.g.traverse((o) => { if (o.isMesh && o.material.transparent) o.castShadow = false; });
  S.add(vase.g); dirty = true;
  CTL.target.set(0, vase.mouth * .5 + .42, 0);
  stems.forEach(build);
  document.querySelectorAll('#vases button').forEach((b) => b.classList.toggle('on', b.dataset.k === k));
}

// ---------- 花枝：锚在花器口里，按主枝/副枝/客枝/配叶分高低 ----------
let stems = [], sel = null, dirty = true;
/* 三主枝：主枝最高近乎直立，副枝七成高往一侧斜，客枝一半高往另一侧前倾；再加的花在中低之间，配叶贴着口 */
const TIERS = { shin: { len: 1, tilt: .1 }, soe: { len: .72, tilt: .5 }, hikae: { len: .46, tilt: .75 }, mid: { len: .62, tilt: .42 }, low: { len: .42, tilt: .65 }, filler: { len: .4, tilt: .8 } };
const tiltOf = (st) => Math.min(1.2, st.tilt * vase.spread + (vase.spread - .7) * .25 * st.off);
function dirOf(st) { const t = tiltOf(st); return new THREE.Vector3(Math.sin(t) * Math.cos(st.phi), Math.cos(t), Math.sin(t) * Math.sin(st.phi)); }
function anchorOf(st) { const r = vase.r * st.off; return new THREE.Vector3(Math.cos(st.phi) * r, vase.mouth, Math.sin(st.phi) * r); }
function build(st) {
  if (st.obj) S.remove(st.obj);
  st.sway = null;
  const P = st.f.filler ? null : Hy.paramsOf(Hy.genesOf(st.f));   /* 基因 → 瓣数瓣形兜褶、花头大小、枝高 */
  const g = new THREE.Group(), a = anchorOf(st), d = dirOf(st), len = st.len * vase.Lb * (P ? P.height : 1), tilt = tiltOf(st);
  st.seed = st.seed || (Math.random() * 1000 | 0); const r = rng(st.seed);
  const root = a.clone().add(new THREE.Vector3(0, -vase.depth - .05, 0));   // 从口下面起，像真插在水里
  const curve = P && P.form === 2 ? archPath(root, a, d, len, tilt, r) : stemPath(root, a, d, len, tilt, r, st.f.filler ? .04 : .075), tip = curve.getPointAt(1), tg = curve.getTangentAt(1);
  const sample = (t) => { const u = curve.tin + t * (1 - curve.tin); return { p: curve.getPointAt(u), tg: curve.getTangentAt(u) }; };   // t 只数口外那段
  if (st.f.filler) {
    g.add(stemMesh(curve, .0045, .0025, st.seed % 2 ? TWIG_C : STEM_C));
    if (st.seed % 2) {
      /* 尤加利：一对对圆叶，灰绿，越往梢越小 */
      for (let i = 0; i < 9; i++) { const t = .38 + i / 9 * .6, { p, tg } = sample(t), s = (1 - t * .5) * (.9 + r() * .25); for (const side of [1, -1]) hangLeaf(g, leafGeo({ L: .075, W: .06, kind: 'round', seed: i * 2 + (side > 0) }), EUCA_C[(i + (side > 0)) % 3], p, tg, side * 1.5708 + (r() - .5) * .5, s, .25); }
    } else {
      /* 蕨：一根弓着的叶轴，两边一排排小羽片，往梢越短，整片往下垂 */
      for (let i = 0; i < 22; i++) { const t = .26 + i / 22 * .72, { p, tg } = sample(t), s = Math.sin(Math.min(1, (t - .26) / .5) * Math.PI * .5 + .35) * (1 - t * .4) * 1.1; for (const side of [1, -1]) hangLeaf(g, leafGeo({ L: .09, W: .02, kind: 'lance', seed: 90 + i % 3 }), LEAF_C[(i + (side > 0)) % 2 + 1], p, tg, side * 1.4, s, .5); }
      hangLeaf(g, leafGeo({ L: .07, W: .016, kind: 'lance', seed: 93 }), LEAF_C[2], tip, tg, 0, .3, .95);
    }
  } else if (P.cluster) {
    /* 蓝雪花（和攒球那一支基因的杂交花）：木质细枝，分两叉，每个枝梢一团七八朵小五瓣，枝上小卵叶 */
    const cs = Hy.colorsOf(st.f);
    g.add(stemMesh(curve, .006, .0035, TWIG_C));
    const pb = plumbago(cs, st.seed, 1, P), { cluster } = pb.userData.plumbago; g.add(pb);
    g.add(cluster(tip, tg, 9));
    for (const [t, ang, L] of [[.62, 1.3, .22], [.8, -1.6, .17]]) {
      const { p, tg: tt } = sample(t), side = new THREE.Vector3().crossVectors(tt, UP).normalize(), dd = tt.clone().lerp(side.multiplyScalar(Math.sign(ang)), .55).normalize();
      const c2 = bend(p, dd, L, .4, r, .03); g.add(stemMesh(c2, .0035, .002, TWIG_C)); g.add(cluster(c2.getPointAt(1), c2.getTangentAt(1), 6));
      hangLeaf(g, leafGeo({ L: .06, W: .03, kind: 'ovate', seed: 7 }), LEAF_C[0], c2.getPointAt(.5), c2.getTangentAt(.5), 1.2, .8, .3);
    }
    for (let i = 0; i < 4; i++) { const t = .35 + i * .12, { p, tg } = sample(t); hangLeaf(g, leafGeo({ L: .065, W: .032, kind: 'ovate', seed: i }), LEAF_C[i % 2], p, tg, i * 2.3, .85 + r() * .3, .3); }
  } else if (P.form === 2) {
    /* 垂铃（铃兰那种）：弓着的茎，弧那一段单侧排开一串小铃铛，每个挂在小弯梗上朝下垂，越往梢越小，最末几个是没开的圆苞；
       两片宽叶从基部包上来，跟花茎差不多高 */
    const cs = Hy.colorsOf(st.f);
    g.add(stemMesh(curve, .006, .0028));
    const K = 4 + P.n, R0 = .033 * P.scale * Math.sqrt(P.petal.Wd / .12), H0 = .044 * P.scale * (1 + P.petal.cup * .12), sg = st.seed % 2 ? 1 : -1;
    const budC = '#' + new THREE.Color(cs[0]).lerp(new THREE.Color('#f4f1e6'), .35).getHexString();
    for (let i = 0; i < K; i++) {
      const u = i / (K - 1), t = .28 + u * .7, { p, tg: tt } = sample(t), sc = (1 - u * .3) * (.95 + r() * .1), bud = i >= K - 2; 
      const S = curve.side.clone().multiplyScalar(sg * (.8 + (i % 2 ? .2 : -.2))).addScaledVector(curve.h, .25).normalize();   // 都挂在弧的同一侧
      const L = (bud ? .02 : .036) * (.55 + sc * .6), e = p.clone().addScaledVector(S, L * .7).add(new THREE.Vector3(0, -L * .9, 0));
      const ped = new THREE.CatmullRomCurve3([p, p.clone().addScaledVector(S, L * .45).add(new THREE.Vector3(0, L * .12, 0)), p.clone().addScaledVector(S, L * .7).add(new THREE.Vector3(0, -L * .35, 0)), e]);
      g.add(stemMesh(ped, .0016, .0012, '#86a05a'));
      if (bud) { const b = new THREE.Mesh(new THREE.SphereGeometry(R0 * sc * .8, 8, 6), mat(budC)); b.scale.y = 1.2; b.position.copy(e).add(new THREE.Vector3(0, -R0 * sc * .6, 0)); b.userData.lineW = .0012; g.add(b); continue; }
      const b = new THREE.Mesh(bellGeo({ R: R0 * sc, H: H0 * sc, n: P.n, flare: .25 + P.petal.cup * .3, ruffle: P.petal.ruffle, seed: i % 3 }), skin(cs[i % cs.length])); b.userData.lineW = .0014;
      b.position.copy(e).add(new THREE.Vector3(0, .004 * sc, 0)); b.rotation.set((r() - .5) * .25 + .12 * curve.h.z, r() * 6.28, (r() - .5) * .25 - .12 * curve.h.x); g.add(b);
    }
    const az = Math.atan2(-curve.h.z, curve.h.x), base = a.clone().add(new THREE.Vector3(0, -.012, 0));
    for (const [da, L, c] of [[1.05, .5, LEAF_C[0]], [-1.35, .44, LEAF_C[2]]]) hangLeaf(g, leafGeo({ L: L * len / .6, W: L * .3, kind: 'ovate', seed: st.seed + (da > 0 ? 1 : 2) }), c, base, UP, az + da, 1, .86);
  } else if (P.form === 3) {
    /* 佛焰苞（马蹄莲那种）：一根挺的茎，一片卷起的苞，中间一根肉穗；下面一片大叶 */
    const cs = Hy.colorsOf(st.f);
    g.add(stemMesh(curve, .009, .006));
    const head = spathe(cs, P.scale, st.seed, P); head.position.copy(tip);
    faceHead(head, tg, r, .35, .6, .1); g.add(head);   // 苞口朝着人，不然背面像个纸风筝
    { const { p, tg: tt } = sample(.22); hangLeaf(g, leafGeo({ L: .26, W: .12, kind: 'ovate', seed: st.seed }), LEAF_C[0], p, tt, 1.3 + r(), 1, .55); }
  } else if (P.form === 4) {
    /* 包心（玫瑰芍药那种）：枝和叶照单朵，花头换成螺旋裹的 */
    g.add(stemMesh(curve, .0085, .0045));
    const n = 3 + (r() * 2 | 0);
    for (let i = 0; i < n; i++) { const t = .32 + i / n * .5 + r() * .06, { p, tg } = sample(t); hangLeaf(g, leafGeo({ L: .18, W: .08, kind: 'ovate', seed: st.seed + i }), LEAF_C[(r() * 4) | 0], p, tg, i * 2.4 + r() * .8, (1.1 - t * .5) * (.9 + r() * .3), .3); }
    const head = packed(Hy.colorsOf(st.f), P.scale * .88, st.seed, 1.05 + r() * .25, P, Hy.gradOf(st.f)); head.position.copy(tip);
    faceHead(head, tg, r, .2, .55, -.3);   // 包心的头沉，往下点头（nod 为负才是低头）
    calyx(P.scale, head); g.add(head);
  } else if (P.form === 5) {
    /* 碎雾（满天星那种）：细枝一叉再叉三四级，枝细到看不太清，每个梢头一小团大小不一的极小白花（带一点花色），
       整体是一团蓬松的半球雾。枝全并成一个 mesh、花并成一个 mesh。之前像枯枝粘米色珠子 */
    const cs = Hy.colorsOf(st.f), twigs = [], dots = [];
    g.add(stemMesh(curve, .004, .0022, TWIG_C));
    const white = new THREE.Color('#fbf8f1'), tint = cs.map((c) => new THREE.Color(c));
    const dotG = new THREE.SphereGeometry(1, 6, 4), col = [];
    const dot = (p, rad, k) => { const m = dotG.clone(); m.scale(rad, rad * .8, rad); m.translate(p.x, p.y, p.z); dots.push(m); const c = tint[k % tint.length].clone().lerp(white, .5 + r() * .3); for (let i = 0; i < m.attributes.position.count; i++) col.push(c.r, c.g, c.b); };
    const fork = (p, d, L, depth, w) => {
      const c = bend(p, d, L, .15, r, .12); twigs.push(tube(c, w, w * .7, 6, 4, .95, 1));
      const e = c.getPointAt(1), te = c.getTangentAt(1);
      if (depth === 0) {
        /* 梢头一小团：三到六粒，中间大边上小 */
        const n = 4 + (r() * 4 | 0), R0 = .0068 * P.scale;
        for (let i = 0; i < n; i++) { const a = r() * 6.28, b = r() * 2 - 1, rr = i ? R0 * (1.1 + r() * .8) : 0; dot(e.clone().add(new THREE.Vector3(Math.cos(a) * rr, b * rr * .7, Math.sin(a) * rr)), R0 * (i ? .45 + r() * .5 : .9 + r() * .4), i); }
        return;
      }
      const sd = new THREE.Vector3().crossVectors(te, UP).normalize(); if (sd.lengthSq() < 1e-4) sd.set(1, 0, 0);
      const n2 = new THREE.Vector3().crossVectors(te, sd), k = 2 + (r() * 2.5 | 0);
      for (let i = 0; i < k; i++) { const ang = i / k * 6.28 + r() * 1.2, dd = te.clone().lerp(sd.clone().multiplyScalar(Math.cos(ang)).add(n2.clone().multiplyScalar(Math.sin(ang))), .5 + r() * .3).lerp(UP, .1).normalize(); fork(e, dd, L * .58, depth - 1, w * .7); }
    };
    /* 主枝上半截均匀发出七八根一级枝，越靠梢越短、越往上撑，撑出一个半球 */
    const B = 6 + (P.n >> 1);
    for (let i = 0; i < B; i++) { const t = .42 + i / B * .56, { p, tg: tt } = sample(t), sd = new THREE.Vector3().crossVectors(tt, UP).normalize(), ang = i * 2.4 + r(); fork(p, tt.clone().lerp(sd.multiplyScalar(Math.cos(ang)).add(UP.clone().cross(sd).multiplyScalar(Math.sin(ang))), .7 - i / B * .3).normalize(), .13 * (1 - i / B * .45), 3, .0012); }
    const tw = new THREE.Mesh(mergeGeometries(twigs), mat('#c6c3b1', { vertexColors: true })); tw.userData.noLine = true; g.add(tw);
    const dg = mergeGeometries(dots); dg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const dm = new THREE.Mesh(dg, mat('#ffffff', { vertexColors: true })); dm.userData.noLine = true; g.add(dm);
  } else if (P.form === 6) {
    /* 头状（雏菊非洲菊那种）：枝和叶照单朵，花头换成花心盘加一圈舌瓣，脸更朝着人 */
    g.add(stemMesh(curve, .0085, .0045));
    const n = 2 + (r() * 2 | 0);
    for (let i = 0; i < n; i++) { const t = .3 + i / n * .45 + r() * .06, { p, tg } = sample(t); hangLeaf(g, leafGeo({ L: .2, W: .06, kind: 'lance', seed: st.seed + i }), LEAF_C[(r() * 4) | 0], p, tg, i * 2.4 + r() * .8, (1.1 - t * .5) * (.9 + r() * .3), .3); }
    const head = capitulum(Hy.colorsOf(st.f), P.scale, st.seed, 1.05 + r() * .25, P); head.position.copy(tip);
    faceHead(head, tg, r, .15, .6, .38);   // 头状也低头
    calyx(P.scale, head); g.add(head);
  } else if (P.form === 7) {
    /* 风花（秋晃晃）：茎很长很细、细到像要断，花头微低；叶在下面三出裂（一处长三片小叶）；整株挂在口上，风一吹轻轻晃（见 sway） */
    g.add(stemMesh(curve, .0048, .0026, '#7a9450'));
    const nl = 1 + (r() * 2 | 0);
    for (let i = 0; i < nl; i++) {
      const t = .16 + i * .15 + r() * .05, { p, tg } = sample(t), az = i * 2.6 + r() * .8, sz = (1 - i * .2) * (.9 + r() * .2);
      for (const k of [-1, 0, 1]) hangLeaf(g, leafGeo({ L: .12, W: .075, kind: 'ovate', seed: st.seed + i * 3 + k + 1 }), LEAF_C[(i * 2 + k + 5) % 4], p, tg, az + k * .62, (k ? .78 : 1) * sz, .22);
    }
    const head = anemone(Hy.colorsOf(st.f), P.scale, st.seed, P, Hy.gradOf(st.f)); head.position.copy(tip);
    faceHead(head, tg, r, .2, .75, -.4);   // 脸朝人，再往下点一点头（nod 为负才是低头）
    g.add(head);
    st.sway = { ph: r() * 6.28, amp: .028 + r() * .018, sp: .8 + r() * .4, ax: new THREE.Vector3(Math.cos(st.phi + 1.2), 0, Math.sin(st.phi + 1.2)).normalize() };
  } else if (P.form === 8) {
    /* 百合：细茎，两片窄长叶，一根细侧枝挑一个花苞，花头斜朝上的喇叭 */
    g.add(stemMesh(curve, .0055, .0032, '#6f9e5a'));
    for (const [t, ang, sz] of [[.36, .8, .7], [.52, 3.7, .6]]) { const { p, tg } = sample(t); hangLeaf(g, leafGeo({ L: .2, W: .03, kind: 'lance', seed: Math.round(t * 100) + 3 }), LEAF_C[1], p, tg, ang + r() * .3, sz, .45); }
    const grad = Hy.gradOf(st.f), cs = Hy.colorsOf(st.f);
    { const { p, tg: tt } = sample(.66), side = new THREE.Vector3().crossVectors(tt, UP).normalize().multiplyScalar(r() < .5 ? 1 : -1), dd = tt.clone().lerp(side, .6).normalize();
      const c2 = bend(p, dd, .12, .3, r, .03); g.add(stemMesh(c2, .0026, .0018, '#7aa863'));
      const b = lilyBud(grad ? grad[0] : cs[0], grad ? grad[1] : lerpHex(cs[0], '#ffffff', .5), P.scale * 1.3); b.position.copy(c2.getPointAt(1)); b.quaternion.setFromUnitVectors(UP, c2.getTangentAt(1)); calyx(P.scale * .5, b); g.add(b); }
    const head = lily(cs, P.scale, st.seed, P, grad); head.position.copy(tip);
    faceHead(head, tg, r, .25, .7, -.15);
    calyx(P.scale * .9, head); g.add(head);
  } else {
    g.add(stemMesh(curve, .0085, .0045));
    /* 叶：下面两三片大的，上面一两片小的，交互着生，各自歪 */
    const n = 3 + (r() * 2 | 0);
    for (let i = 0; i < n; i++) { const t = .32 + i / n * .5 + r() * .06, { p, tg } = sample(t); hangLeaf(g, leafGeo({ L: .2, W: .075, kind: i % 3 === 2 ? 'ovate' : 'lance', seed: st.seed + i }), LEAF_C[(r() * 4) | 0], p, tg, i * 2.4 + r() * .8, (1.1 - t * .5) * (.9 + r() * .3), .3); }
    const cs = Hy.colorsOf(st.f);
    const head = blossom(cs, P.scale, st.seed, 1.05 + r() * .25, P); head.position.copy(tip);
    faceHead(head, tg, r, .3, .6, .1);   // 花脸微微朝看的人，像朝着窗，再歪一点点头
    calyx(P.scale, head); g.add(head);
  }
  const hit = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.copy(tip); hit.userData.noLine = true; hit.userData.st = st; g.add(hit);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.085, .005, 6, 32), mat('#9f3726')); ring.position.copy(tip); ring.quaternion.setFromUnitVectors(UP, d); ring.rotateX(Math.PI / 2); ring.visible = st === sel; ring.userData.noLine = true; g.add(ring);
  outline(g, { w: .003 }); shadowAll(g);
  /* 整株挂在口上那一点（obj 在口，g 退回原点），风花摇起来就是转 obj */
  const obj = new THREE.Group(); obj.position.copy(a); g.position.copy(a).negate(); obj.add(g);
  st.obj = obj; st.hit = hit; st.ring = ring; S.add(obj); dirty = true;
}
function addStem(f) {
  const fl = stems.filter((x) => !x.f.filler).length, fi = stems.length - fl;
  if (f.filler ? fi >= 5 : fl >= MAX) { toast(f.filler ? '配叶够多了' : '插满七枝了'); return; }
  /* 第一枝主枝、第二枝副枝、第三枝客枝，再来的中低错开；方位：主枝略往左后，副枝左前，客枝右前 */
  const tier = f.filler ? 'filler' : fl === 0 ? 'shin' : fl === 1 ? 'soe' : fl === 2 ? 'hikae' : fl % 2 ? 'mid' : 'low', T = TIERS[tier];
  const phi = f.filler ? Math.random() * 6.28 : tier === 'shin' ? 2.3 : tier === 'soe' ? 3.6 + Math.random() * .4 : tier === 'hikae' ? .6 + Math.random() * .4 : (fl * 2.39) % 6.28;
  const st = { f: f.filler ? { ...f, id: 'g' + Date.now() } : f, tier, phi, tilt: T.tilt * (.85 + Math.random() * .3), len: T.len * (.9 + Math.random() * .2), off: tier === 'shin' ? .15 : .4 + Math.random() * .55 };
  stems.push(st); select(st); build(st); refresh();
}
function removeStem(st) { S.remove(st.obj); dirty = true; stems = stems.filter((x) => x !== st); if (sel === st) select(null); refresh(); }
function select(st) { dirty = true; const old = sel; sel = st; if (old && old.ring) old.ring.visible = false; if (st && st.ring) st.ring.visible = true; $('#pull').disabled = !st; }

// ---------- 点花头、拖花头 ----------
const ray = new THREE.Raycaster(), v2 = new THREE.Vector2(), plane = new THREE.Plane(), hitP = new THREE.Vector3();
let drag = null;
const aim = (e) => { const r = cv.getBoundingClientRect(); v2.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(v2, CAM); };
cv.addEventListener('pointerdown', (e) => {
  aim(e); const h = ray.intersectObjects(stems.map((s) => s.hit))[0];
  if (!h) { drag = { none: true, x: e.clientX, y: e.clientY }; return; }
  const st = h.object.userData.st; select(st);
  const n = new THREE.Vector3(); CAM.getWorldDirection(n); plane.setFromNormalAndCoplanarPoint(n, st.hit.position);
  drag = { st, x: e.clientX, y: e.clientY, moved: false, out: false }; CTL.enabled = false; cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', (e) => {
  if (!drag || drag.none) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
  drag.moved = true; aim(e);
  if (!ray.ray.intersectPlane(plane, hitP)) return;
  const st = drag.st, a = new THREE.Vector3(0, vase.mouth, 0), v = hitP.clone().sub(a), L = v.length();
  drag.out = L > 1.45;
  st.len = Math.min(1.3, Math.max(.22, L)) / vase.Lb; const want = Math.min(1.3, Math.acos(Math.max(-1, Math.min(1, v.y / L)))); st.tilt = Math.max(0, (want - (vase.spread - .7) * .25 * st.off) / vase.spread); st.phi = Math.atan2(v.z, v.x);
  build(st); st.obj.traverse((o) => { if (o.isMesh && o.material && 'opacity' in o.material && !o.userData.hull) o.visible = !drag.out || o === st.hit; });
});
const up = (e) => {
  if (!drag) return;
  if (drag.none) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) select(null); drag = null; return; }
  CTL.enabled = true;
  if (drag.out) { toast('拔出来了'); removeStem(drag.st); }
  drag = null;
};
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

// ---------- 面板 ----------
let pool = [];
function refresh() {
  const used = new Set(stems.filter((s) => !s.f.filler).map((s) => s.f.id));
  document.querySelectorAll('#flowers button').forEach((b) => b.classList.toggle('used', used.has(b.dataset.id)));
}
function fillPanel() {
  const vb = $('#vases');
  Object.entries(VASES).forEach(([k, v]) => { const b = document.createElement('button'); b.textContent = v.zh; b.dataset.k = k; b.onclick = () => setVase(k); vb.appendChild(b); });
  const fb = $('#flowers');
  { const b = document.createElement('button'); b.innerHTML = '<i style="background:#6f9a4c"></i>配叶<small>不限</small>'; b.onclick = () => addStem({ filler: true, id: 'g', at: Date.now(), mood: 'calm' }); fb.appendChild(b); }
  pool.forEach((f) => {
    const b = document.createElement('button'), d = new Date(f.at), ids = f.moods && f.moods.length ? f.moods : [f.mood];
    b.dataset.id = f.id;
    b.innerHTML = Hy.colorsOf(f).map((c) => `<i style="background:${c}"></i>`).join('') + Hy.nameOf(Hy.speciesIdOf(f)) + `<small>${f.sample ? '样例' : (d.getMonth() + 1) + '.' + d.getDate()}</small>`;
    b.onclick = () => { const st = stems.find((s) => s.f.id === f.id); if (st) { select(st); return; } addStem(f); };
    fb.appendChild(b);
  });
  /* 园子里配出来的新花：点了插一枝（同一种能插几枝），长按改名 */
  const hs = Hy.hybrids();
  if (hs.length) {
    const t = document.createElement('h3'); t.textContent = '园 子 里 配 出 来 的（长 按 改 名）'; const hb = document.createElement('div'); hb.className = 'chips'; hb.id = 'hybrids'; fb.after(t); t.after(hb);
    hs.forEach((sp) => {
      const b = document.createElement('button'), pn = (sp.parents || []).map(Hy.nameOf).join('×') + (sp.genes.form ? ' · ' + Hy.formOf(sp.genes).zh : '');
      const draw = () => { b.innerHTML = `<i style="background:${Hy.hexOf(sp.genes)}"></i>${sp.name}<small>${pn}</small>`; }; draw();
      let hold = 0, held = false;
      b.onpointerdown = () => { held = false; hold = setTimeout(() => { held = true; const nm = prompt('给它起个名字', sp.name); if (nm && Hy.rename(sp.id, nm)) { sp.name = nm.trim().slice(0, 6); draw(); toast('记下了'); } }, 600); };
      const cancel = () => clearTimeout(hold); b.onpointerup = cancel; b.onpointerleave = cancel; b.onpointercancel = cancel;
      b.onclick = () => { if (held) return; addStem({ id: 'h' + sp.id + ':' + Date.now(), species: sp.id, at: Date.now(), mood: 'sweet', hybrid: true }); };
      hb.appendChild(b);
    });
  }
}
$('#pull').onclick = () => { if (sel) { removeStem(sel); toast('拔出来了'); } };

/* 摆到店里：存进自己的库，版本 1 定死，以后别升 */
function vaseDb() { return new Promise((ok, no) => { const r = indexedDB.open('diarytown-vase', 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('vases')) r.result.createObjectStore('vases', { keyPath: 'id' }); }; r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }); }
$('#save').onclick = async () => {
  if (!stems.length) { toast('还一枝都没插'); return; }
  try {
    const d = await vaseDb(), rec = { id: 'v' + Date.now(), at: Date.now(), vase: vaseKey, stems: stems.map((s) => ({ fid: s.f.id, filler: !!s.f.filler, moods: s.f.filler ? [] : s.f.moods || [s.f.mood], tier: s.tier, phi: s.phi, tilt: s.tilt, len: s.len, off: s.off, seed: s.seed, species: s.f.filler ? null : Hy.speciesIdOf(s.f) })) };
    await new Promise((ok, no) => { const t = d.transaction('vases', 'readwrite'); t.objectStore('vases').put(rec); t.oncomplete = ok; t.onerror = () => no(t.error); });
    d.close();
    /* 摆进园子：找空花位（起步两个），满了就先收在库里 */
    const put = Day.placeVase({ id: rec.id, vase: rec.vase, at: rec.at, colors: rec.stems.map((s) => s.filler ? 'leaf' : Hy.hexOf(Hy.genesOf({ species: s.species }))), species: rec.stems.map((s) => s.species) });   /* species 给杂交认爸妈 */
    toast(put ? `摆到园子里了，第 ${put.slot + 1} 个花位` : `园子里 ${Day.vaseSlots()} 个花位都摆满了，这盆先收着`);
  } catch (e) { toast('没存上'); }
};
$('#png').onclick = async () => {
  select(null); LOOK.render(S, CAM);
  const url = R.domElement.toDataURL('image/png'), blob = await (await fetch(url)).blob(), file = new File([blob], '插花.png', { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = url; a.download = '插花.png'; a.click();
};

// ---------- 开张 ----------
(async () => {
  const all = await readFlowers(), now = Date.now();
  pool = all.filter((f) => !f.wild && now - f.at >= 3 * DAY && now - f.at < 14 * DAY).sort((a, b) => b.at - a.at);
  if (!pool.length) { pool = SAMPLES; $('#flTitle').textContent = '花 园 里 还 没 开 花，先 拿 样 例 插'; }
  fillPanel(); setVase('bottle'); resize();
  /* 只在有变化的时候画 */
  CTL.addEventListener('change', () => { dirty = true; });
  /* 风花在台上才一直画（轻轻晃），三十帧够了；没有就照旧只在有变化时画 */
  let lastSway = 0;
  R.setAnimationLoop((t) => {
    CTL.update();
    if (t - lastSway > 33) for (const s of stems) { const w = s.sway; if (!w || !s.obj) continue; lastSway = t; const q = Math.sin(t * .0011 * w.sp + w.ph) * w.amp + Math.sin(t * .0027 * w.sp + w.ph * 2.3) * w.amp * .35; s.obj.quaternion.setFromAxisAngle(w.ax, q); dirty = true; }
    if (dirty) { dirty = false; LOOK.render(S, CAM); }
  });
  window.__ike = { addStem, Hy, pool: () => pool, setVase, stems: () => stems, sel: select, screen: (st) => { const v = st.hit.getWorldPosition(new THREE.Vector3()).project(CAM); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; } };
})();
