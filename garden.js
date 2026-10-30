// 店是背景不是主角：放大一倍，靠后排、左三分之一处，花园从它脚下往前往两边长，前面留一片空草坪
// 三大团花境（左篱笆一长条、店脚下、池边）堆满溢出，篱笆大半被灌木和藤吃掉；一条细细弯弯的石板路从拱门进来到店门，半路岔去花架，侧边小路出篱笆是田
// 配色清透：纸白地、干净的绿、粉色点缀；低角度太阳，受光面暖、影子冷而淡；后期水彩减半（look.js 是本目录自己那份）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, washTex, outline, shadowAll } from './shop/look.js';
import { makeLook } from './look.js';
import { buildHouse, C } from './shop/house.js';
import * as TM from './town/mem.js';
import * as LAND from './town/land.js';
import * as FR from './town/fr.js';
import * as Day from './day.js';   /* 种子、花位、换天 */
import * as Hy from './hybrid.js';   /* 杂交：两盆挨着过一夜冒苗 */

/* 量 init 每一步花多久 */
let stage = '';
/* 出事了写在跑酷页底下一行（tip 那行会被「捡了几朵」盖掉，所以自己挂一个） */
function status(msg) {
  let el = document.getElementById('gstat');
  if (!el) { el = document.createElement('p'); el.id = 'gstat'; el.style.cssText = 'position:fixed;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom) + 64px);z-index:30;text-align:center;font-size:11px;color:#9f3726;pointer-events:none'; document.body.appendChild(el); }
  el.textContent = msg;
}
const T = { t: performance.now(), out: {}, mark(k) { const n = performance.now(); this.out[k] = Math.round(n - this.t); this.t = n; } };
let R, S, CAM, CTL, LOOK, COLORS = {}, flowers = [], flowerRoot;
const ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const DAY = 86400e3;
let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const G = { grass: '#8fc46c', grassD: '#6fa858', mown: '#a6d283', leaf: '#6fae5a', leafD: '#4f8f48', leafL: '#9ccc6e', paper: '#f5f2ea', pink: '#eea3b8', pinkD: '#d9789a' };

/* —— 园子的形：圆角矩形，左前方往外鼓一块 —— */
const PLOT = (() => {
  const s = new THREE.Shape();
  s.moveTo(-3.4, -3.5);
  s.lineTo(3.3, -3.5); s.quadraticCurveTo(4.1, -3.5, 4.1, -2.7);
  s.lineTo(4.1, 2.2); s.quadraticCurveTo(4.1, 3.3, 3.0, 3.3);
  s.lineTo(1.6, 3.3); s.lineTo(.2, 3.3);
  s.bezierCurveTo(-1.6, 4.6, -4.2, 4.0, -4.4, 1.6);
  s.lineTo(-4.3, -2.6); s.quadraticCurveTo(-4.2, -3.5, -3.4, -3.5);
  return s;
})();
const EDGE = PLOT.getSpacedPoints(260);
const inPoly = (x, z) => { let c = false; for (let i = 0, j = EDGE.length - 1; i < EDGE.length; j = i++) { const a = EDGE[i], b = EDGE[j]; if ((a.y > z) !== (b.y > z) && x < (b.x - a.x) * (z - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
const edgeDist = (x, z) => { let m = 1e9; for (const p of EDGE) m = Math.min(m, Math.hypot(p.x - x, p.y - z)); return m; };
const GATE = { x: 1.05, z: 3.3, half: .55 };
const SIDE = { x: 4.1, z: -.55, half: .5 };
const SHOP = { x: -1.3, z: -1.38, s: .9 };
const DOOR = { x: SHOP.x + .7 * SHOP.s, z: SHOP.z + 2.0 * SHOP.s };
const POND = { x: 2.55, z: 1.75, r: .52 };
const DECK = { x: 2.65, z: -2.35, w: 1.5, d: 1.15 };
const TABLE = { x: -2.55, z: 2.05, r: .4 };
const V = (pts) => pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
const PATH_MAIN = new THREE.CatmullRomCurve3(V([[GATE.x, 3.75], [GATE.x, 3.05], [.75, 2.4], [.05, 1.95], [-.45, 1.45], [DOOR.x, DOOR.z + .05]]));
/* 岔路不做硬 Y 字：去花架的路顺着主路的方向分出来，慢慢弯开，接口处两条碎石带连成一片 */
const LANDING = { x: 0, z: 0, r: 0 };
/* 去花架的路不再从主路半中间分岔：从店前石板台子东边起步，弯一弯到花架木平台 */
const PATH_DECK = new THREE.CatmullRomCurve3(V([[.92, -.2], [1.4, -.38], [1.85, -.72], [2.2, -1.15], [2.45, -1.62]]));
/* 侧路出篱笆，在草地上弯一段才到田 */
/* 侧路从花架平台东头出发去侧门，也不从路中间岔 */
const PATH_SIDE = new THREE.CatmullRomCurve3(V([[3.45, -2.05], [3.75, -1.35], [SIDE.x, SIDE.z], [5.0, -.2], [6.0, .35], [7.1, .1], [7.95, -.35]]));
const PATH_OUT = new THREE.CatmullRomCurve3(V([[GATE.x, 3.85], [.8, 4.9], [.3, 5.9], [-.4, 6.6], [-1.0, 7.0]]));
/* 池边小岔：主路边上几块踏步石走到池沿（草地里的踏步，不是碎石路分叉） */
const PATH_POND = new THREE.CatmullRomCurve3(V([[.95, 2.2], [1.35, 2.05], [1.72, 1.92]]));
const PATH_PTS = [...PATH_POND.getSpacedPoints(8), ...PATH_MAIN.getSpacedPoints(70), ...PATH_DECK.getSpacedPoints(60), ...PATH_SIDE.getSpacedPoints(30)];
const pathDist = (x, z) => { let m = 1e9; for (const p of PATH_PTS) m = Math.min(m, Math.hypot(p.x - x, p.z - z)); return m; };
const inShop = (x, z, pad = 0) => Math.abs(x - SHOP.x) < 2.07 + pad && z > SHOP.z - 2 - pad && z < SHOP.z + 1.98 + pad;
const nearDeck = (x, z, pad = 0) => Math.abs(x - DECK.x) < DECK.w / 2 + pad && Math.abs(z - DECK.z) < DECK.d / 2 + pad;
/* 花能落的地方：园子里、离边一点、不进店的台子、水池、花架、桌子，不踩路 */
export function okSpot(x, z) {
  return inPoly(x, z) && edgeDist(x, z) > .3 && !inShop(x, z, .05) && Math.hypot(x - POND.x, z - POND.z) > POND.r + .22
    && !nearDeck(x, z, .12) && Math.hypot(x - TABLE.x, z - TABLE.z) > TABLE.r + .25 && pathDist(x, z) > .32;
}
/* 三大团花境：左篱笆里一长条、店脚下、池边；日记花默认落在这里面 */
const MASSES = [
  { name: 'left', col: ['#7a5fd0', '#f0689a', '#fbf6ec', '#5f7fd8'], back: 1, pts: () => { const out = []; for (const p of EDGE) { if (!(p.x < -2.0 && p.y > -1.8) && !(p.y > 2.9 && p.x < .2)) continue; const n = new THREE.Vector2(-p.x, -p.y).normalize(); out.push([p.x + n.x * .35, p.y + n.y * .35]); } return out; }, w: .6 },
  { name: 'shop', col: ['#fbf6ec', '#f48fb1', '#ff7a6b', '#ffd23a'], back: -1, pts: () => { const out = []; for (let x = -3.35; x <= .85; x += .12) out.push([x, SHOP.z + 2.0 * SHOP.s + .38]); return out; }, w: .38 },
  { name: 'pond', col: ['#6f93e8', '#ffc21a', '#fbf6ec', '#b48ee0'], back: 1, pts: () => { const out = []; for (let a = -1.05; a < .95; a += .1) out.push([POND.x + Math.cos(a) * (POND.r + .55), POND.z + Math.sin(a) * (POND.r + .55)]); return out; }, w: .32 },
];
MASSES.forEach((m) => m.P = m.pts());
function bedSpot(i) {
  for (let t = 0; t < 60; t++) { const m = MASSES[(i + t) % 3], p = m.P[Math.floor(rnd() * m.P.length)], a = rnd() * 6.28, r = rnd() * m.w; const x = p[0] + Math.cos(a) * r, z = p[1] + Math.sin(a) * r; if (okSpot(x, z)) return [x, z]; }
  return [-1.6, 2.8];
}

export async function init(canvas, moods) {
  stage = '开始'; const dog = setTimeout(() => status(`花园卡在「${stage}」这一步了`), 12000);
  try { await initInner(canvas, moods); const el = document.getElementById('gstat'); if (el && el.textContent.startsWith('花园卡在')) el.remove(); }   /* 分段盖以后慢手机上看门狗会先叫，盖完了就把那句收掉 */
  catch (e) { console.error(e); status(`花园在「${stage}」这一步出错：${e && e.message || e}`); }
  clearTimeout(dog);
}
async function initInner(canvas, moods) {
  T.mark('before-init');
  moods.forEach((m) => COLORS[m.id] = m.c);
  R = new THREE.WebGLRenderer({ canvas, antialias: false });
  /* 省电：手机（粗指针或小屏）像素比封顶 1.25，别处 1.5；后期的渲染目标跟着 drawingBuffer 走 */
  R.setPixelRatio(PIXEL_RATIO()); R.outputColorSpace = THREE.SRGBColorSpace;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.shadowMap.autoUpdate = false;   /* 影子只在盖好、换天色、种花拔花、挪花的时候重算一次（shadowsDirty） */
  R.setSize(innerWidth, innerHeight, false);
  S = new THREE.Scene(); S.background = new THREE.Color(G.paper); S.fog = new THREE.Fog(G.paper, 42, 85);
  CAM = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, .8, 140);   /* near 拉到 .8：iPhone 深度精度差，地面会闪 */
  bindPointer(canvas);
  CTL = new OrbitControls(CAM, canvas); CTL.target.set(3.3, .3, -.6); CTL.enableDamping = true; CTL.enablePan = false;
  CTL.minDistance = 9; CTL.maxDistance = 52; CTL.minPolarAngle = .45; CTL.maxPolarAngle = 1.2;
  /* 低角度太阳：受光面暖，天光偏冷，影子长而淡 */
  HEMI = new THREE.HemisphereLight('#eef3ff', '#c7d3b4', 1.25); S.add(HEMI);
  const sun = SUN = new THREE.DirectionalLight('#ffeccf', 2.7); sun.position.set(-9, 6.5, 3.5); sun.target.position.set(1, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = sc.bottom = -12; sc.right = sc.top = 12; sc.near = .5; sc.far = 40;
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .02; sun.shadow.radius = 4; sun.shadow.intensity = .5; S.add(sun, sun.target);
  LOOK = makeLook(R, G.paper); LOOK.setTilt(.45, .5); LOOK.setWarm(.5);
  T.mark('setup'); stage = '盖园子';
  await buildWorld();
  flowerRoot = new THREE.Group(); S.add(flowerRoot);
  await yieldUI(); stage = '天色'; setupSky(); applySky(); setInterval(applySky, 60000); setupZones();
  await yieldUI(); stage = '种的花'; addHybridSp(); loadBeds(); setupPlantUI(); loadVases(); breed();
  addEventListener('resize', resize); resize();
  flushGlints(); shadowsDirty();
  await yieldUI(); stage = '编着色器'; try { if (R.extensions.has('KHR_parallel_shader_compile')) await R.compileAsync(S, CAM); } catch (e) {}   /* 能并行编的手机上不占主线程 */
  await yieldUI(); stage = '第一次画'; LOOK.render(S, CAM);   /* 先编一遍着色器，进门那一下不卡 */
  if (Q.has('perf')) window.__G = { R, S, CAM, LOOK };   /* 量性能用：?perf 才挂出来 */
  T.mark('render'); console.log('garden init', JSON.stringify(T.out), 'calls', R.info.render.calls, 'tris', R.info.render.triangles, 'geos', R.info.memory.geometries);
}
export function start() {
  started = true; wake(2000); if (!document.hidden) R.setAnimationLoop(loop);
  if (newSprouts) setTimeout(() => toast('盆边冒了一株苗'), 600);
}
/* —— 省电：最多 30 帧；没人碰、镜头不飞不晃、不下雨的时候降到 10 帧，
   花照样晃、波光照样闪、池子的水圈照样散，只是慢一点刷；切到后台整个停。手机 60/120Hz 的 rAF 都按时间取整 —— */
const PHONE = (() => { try { return matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 600; } catch (e) { return false; } })();
function PIXEL_RATIO() { return Math.min(PHONE ? 1.25 : 1.5, devicePixelRatio || 1); }
let started = false, lastT = 0, wakeUntil = 0, dragging = false, lastWindShadow = 0;
const camPrev = new THREE.Vector3(), tgtPrev = new THREE.Vector3();
function wake(ms = 1500) { wakeUntil = Math.max(wakeUntil, performance.now() + ms); }
function shadowsDirty() { if (R) R.shadowMap.needsUpdate = true; }
function loop(now) {
  const busy = now < wakeUntil || fly || dragging || (RAIN && RAIN.visible);
  if (lastT && now - lastT < (busy ? 1000 / 30 : 100) - 3) return;
  const steps = lastT ? Math.min(4, Math.max(1, Math.round((now - lastT) / (1000 / 60)))) : 1;   /* 阻尼照 60 帧的手感走 */
  lastT = now; tick(steps);
}
document.addEventListener('visibilitychange', () => {
  if (!started || !R) return;
  if (document.hidden) R.setAnimationLoop(null);
  else { lastT = 0; wake(1000); R.setAnimationLoop(loop); }
});
function resize() {
  const w = innerWidth, h = innerHeight; R.setSize(w, h, false); LOOK.resize();
  CAM.aspect = w / h; CAM.updateProjectionMatrix();
  if (!away) CTL.target.copy(HOME_T); const d = w < h ? 36 : 26, dir = (w < h ? new THREE.Vector3(-.82, .86, .42) : new THREE.Vector3(-.55, .82, .62)).normalize();
  HOME = { t: CTL.target.clone(), d, dir };
  if (!away) CAM.position.copy(CTL.target).addScaledVector(dir, d);
  if (Q.get('cam') === 'wide') { CTL.target.set(3, .3, -1); CAM.position.set(-21, 9, 8); }   /* 测试：低一点的广角，看园子→外面→远山 */
  if (Q.get('cam') === 'farm') { CTL.target.set(10.85, 0, -.45); CAM.position.set(10.85 - 6.5, 7.5, -.45 + 8); }   /* 测试：跟小镇田一样的近景 */
  if (Q.get('cam') === 'deck') { CTL.target.set(2.55, .2, -1.85); CAM.position.set(2.55 - 2.6, 2.3, -1.85 + 2.9); }   /* 测试：凑近花架前的两盆和盆边的苗 */
  if (Q.get('cam') === 'close') { CTL.target.set(GATE.x - .3, .2, GATE.z - .6); CAM.position.set(GATE.x - 5.5, 4.2, GATE.z + 6.5); } 
}
const clock = new THREE.Clock();
function tick(steps = 1) {
  const t = clock.getElapsedTime();
  const amp = WX === 'wind' ? .16 : .045, sp = WX === 'wind' ? 2.6 : 1.2;
  for (const f of flowers) f.userData.sway.rotation.z = Math.sin(t * sp + f.userData.ph) * amp + (WX === 'wind' ? .06 : 0);
  if (RAIN && RAIN.visible) { const a = RAIN.geometry.attributes.position, n = a.count / 2; for (let i = 0; i < n; i++) { let y = a.getY(i * 2) - .36; if (y < 0) y += 9; a.setY(i * 2, y); a.setY(i * 2 + 1, y - .6); a.setX(i * 2 + 1, a.getX(i * 2) - .1); } a.needsUpdate = true; SPLASH.forEach((r) => { const k = (t * .9 + r.userData.ph) % 1; r.scale.setScalar(.4 + k * 2.2); r.material.opacity = .85 * (1 - k); }); }
  for (const m of GLINTS) m.uniforms.t.value = t;
  if (RIPPLES) RIPPLES.forEach((r, i) => { const k = (t * .35 + i * .5) % 1; r.scale.setScalar(.3 + k * .9); r.material.opacity = .45 * (1 - k); });
  if (fly) { const k = Math.min(1, (performance.now() - fly.t0) / 1300), e = ease(k); CTL.target.lerpVectors(fly.a, fly.b, e); CAM.position.lerpVectors(fly.pa, fly.pb, e); if (k >= 1) { const f = fly; fly = null; f.after && f.after(); } }
  for (let i = 0; i < steps; i++) CTL.update();
  /* 松手以后阻尼还在滑：镜头还在动就继续 30 帧 */
  if (CAM.position.distanceToSquared(camPrev) > 1e-8 || CTL.target.distanceToSquared(tgtPrev) > 1e-8) { wake(250); camPrev.copy(CAM.position); tgtPrev.copy(CTL.target); }
  if (WX === 'wind' && t - lastWindShadow > .5) { lastWindShadow = t; shadowsDirty(); }   /* 起风时花晃得大，影子一秒跟两回 */
  LOOK.render(S, CAM);
}
let RIPPLES = null;
/* 波光粼粼：不做反射，水面上撒一把小亮点，各自按自己的节奏一闪一闪；一个 Points 一次画完，手机也轻 */
/* 海上和池子里两把并成一把画（各点自带大小），少一次 draw */
let GLINTS = [];
const GLINT_BUF = { pos: [], ph: [], sz: [] };
function glints(pts, size) {
  const n = pts.length / 3; let k = 91; const r2 = () => ((k = (k * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) { GLINT_BUF.ph.push(r2() * 40); GLINT_BUF.sz.push(size); }
  GLINT_BUF.pos.push(...pts);
}
function flushGlints(color = '#fffaf0') {
  if (!GLINT_BUF.sz.length) return;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(GLINT_BUF.pos, 3)); g.setAttribute('ph', new THREE.Float32BufferAttribute(GLINT_BUF.ph, 1)); g.setAttribute('psz', new THREE.Float32BufferAttribute(GLINT_BUF.sz, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, c: { value: new THREE.Color(color) }, sz: { value: R.getPixelRatio() } }, transparent: true, depthWrite: false,
    vertexShader: 'attribute float ph, psz; uniform float t, sz; varying float a; void main(){ float s = sin(t * (.65 + fract(ph) * .8) + ph); a = pow(max(s, 0.), 5.); vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = psz * sz * (.4 + a) * (30. / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 c; varying float a; void main(){ vec2 d = gl_PointCoord - .5; float r = abs(d.x) + abs(d.y); float k = smoothstep(.5, .0, r) + smoothstep(.06, .0, abs(d.y)) * smoothstep(.5, .1, abs(d.x)) * .6; gl_FragColor = vec4(c, min(.55, k * a * .9)); }' });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 3; S.add(p); GLINTS.push(m);
  GLINT_BUF.pos = GLINT_BUF.ph = GLINT_BUF.sz = null;
}
/* 软一点的草和花穗：草是几片弯弯的细叶，薰衣草和高花是一根细茎上一串越往上越小的小花球，没有锥子 */
const nonIdx = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; };
function bladeTuft(h = .17, n = 4) {
  const parts = [];
  for (let b = 0; b < n; b++) {
    const seg = 3, pos = [], idx = [], w = .022, bend = .05 + (b % 2) * .03, hb = h * (.75 + (b % 3) * .15);
    for (let i = 0; i <= seg; i++) { const t = i / seg, ww = w * (1 - t * .92), x = bend * t * t, y = hb * t; pos.push(-ww / 2 + x, y, 0, ww / 2 + x, y, 0); }
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2)); g.setIndex(idx); g.computeVertexNormals();
    g.rotateY(b / n * Math.PI * 2 + .4); parts.push(nonIdx(g));
  }
  return mergeGeometries(parts);
}
function floretSpike(h, r0, n) {
  const parts = [nonIdx(new THREE.CylinderGeometry(.005, .007, h * .62, 4).translate(0, h * .31, 0))];
  for (let i = 0; i < n; i++) { const t = i / (n - 1), r = r0 * (1 - t * .6); const f = new THREE.IcosahedronGeometry(r, 0); f.translate(Math.sin(i * 2.4) * r * .35, h * (.4 + t * .6), Math.cos(i * 2.4) * r * .35); parts.push(nonIdx(f)); }
  return mergeGeometries(parts);
}
/* 岛上三块平地 [cx, cz, 半宽, 半深]：园子、侧门外的田、门外小路边的小村 */
const ISLE_RECTS = [[-.15, .55, 4.65, 4.35], [10.8, -.75, 3.4, 2.3], [7.4, -7.6, 4.0, 2.2]];
let HAT = () => 0, SEEDLING = null, LANE = null;
/* —— 花的样子：穗子只当点缀，加平脸雏菊/波斯菊、碗状玫瑰芍药、
   一团小花攒的绣球、郁金香杯、伞形的蓍草/蕾丝花、贴地的小花垫、高高细细的点头花。
   每种是几块预先拼好的几何（茎/叶、花色、花心），实例化或合并都按块走 —— */
let FORMS = null;
function forms() {
  if (FORMS) return FORMS;
  const NI = nonIdx, M = mergeGeometries;
  const stem = (h, lean = 0) => NI(new THREE.CylinderGeometry(.005, .007, h, 4).translate(0, h / 2, 0).rotateZ(lean));
  const dots = (n, r, spread, y, flat = .4, seed = 1) => { let k = seed * 97; const R = () => ((k = (k * 9301 + 49297) % 233280) / 233280); const a = []; for (let i = 0; i < n; i++) { const t = R() * 6.28, rr = Math.sqrt(R()) * spread, g = new THREE.IcosahedronGeometry(r * (.8 + R() * .4), 0); g.translate(Math.cos(t) * rr, y + (1 - rr / spread) * spread * flat, Math.sin(t) * rr); a.push(NI(g)); } return M(a); };
  const disc = (r, h) => { const g = NI(new THREE.CylinderGeometry(r, r * .85, .012, 12)); g.rotateX(-.25); g.translate(0, h, 0); return g; };
  const cup = (r, h, sy = .72) => { const g = NI(new THREE.IcosahedronGeometry(r, 1)); g.scale(1, sy, 1); g.translate(0, h, 0); return g; };
  const tulipCup = (h) => { const pts = [[0, 0], [.03, .01], [.045, .04], [.042, .075], [.034, .095]].map(([x, y]) => new THREE.Vector2(x, y)); const g = NI(new THREE.LatheGeometry(pts, 7)); g.translate(0, h, 0); return g; };
  const blade = (h) => { const g = bladeTuft(h, 2); return g; };
  FORMS = {
    daisy: { parts: [[stem(.24), 'stem'], [disc(.05, .24), 'c'], [NI(new THREE.SphereGeometry(.018, 6, 4).translate(0, .25, 0)), 'center']], w: .9 },
    cosmos: { parts: [[stem(.34, .08), 'stem'], [disc(.055, .34).translate(-.014, 0, 0), 'c'], [NI(new THREE.SphereGeometry(.016, 6, 4).translate(-.014, .35, 0)), 'center']], w: .9 },
    rose: { parts: [[stem(.2), 'stem'], [cup(.055, .22), 'c'], [cup(.035, .245, .8), 'cD']], w: 1 },
    peony: { parts: [[stem(.18), 'stem'], [cup(.085, .2, .66), 'c'], [cup(.05, .235, .8), 'cL']], w: 1.1 },
    mound: { parts: [[NI(new THREE.IcosahedronGeometry(.12, 1).scale(1, .7, 1).translate(0, .08, 0)), 'leaf'], [dots(14, .03, .1, .14, .35, 3), 'c'], [dots(6, .028, .08, .17, .3, 7), 'cL']], w: 1.3 },
    tulip: { parts: [[stem(.22), 'stem'], [blade(.16), 'leaf'], [tulipCup(.21), 'c']], w: .8 },
    umbel: { parts: [[stem(.3), 'stem'], [dots(10, .016, .06, .3, .12, 5), 'c']], w: .9 },
    ground: { parts: [[NI(new THREE.IcosahedronGeometry(.1, 1).scale(1.3, .35, 1.3).translate(0, .025, 0)), 'leaf'], [dots(14, .016, .12, .05, .2, 9), 'c']], w: 1.4 },
    airy: { parts: [[M([stem(.62, .05), stem(.38, -.35).translate(0, .22, 0), stem(.3, .4).translate(0, .3, 0)]), 'stem'], [M([NI(new THREE.SphereGeometry(.018, 6, 4).translate(-.03, .62, 0)), NI(new THREE.SphereGeometry(.016, 6, 4).translate(.13, .55, 0)), NI(new THREE.SphereGeometry(.016, 6, 4).translate(-.12, .56, 0))]), 'c']], w: .7 },
    spike: { parts: [[floretSpike(.36, .024, 7), 'c']], w: 1 },
    /* 南法花境的骨架和前景：窄锥形柏、修剪的圆球、标准型柠檬树；银叶垫、羽毛草、迷迭香 */
    cypress: { parts: [[M([NI(new THREE.IcosahedronGeometry(.2, 1).translate(0, .25, 0)), NI(new THREE.IcosahedronGeometry(.15, 1).translate(0, .5, 0))]), 'cyB'], [NI(new THREE.IcosahedronGeometry(.1, 1).translate(0, .72, 0)), 'cyT']], w: 1 },
    topiary: { parts: [[NI(new THREE.IcosahedronGeometry(.17, 2).translate(0, .16, 0)), 'c']], w: 1 },
    lemon: { parts: [[NI(new THREE.CylinderGeometry(.012, .018, .5, 5).translate(0, .25, 0)), 'trunk'], [NI(new THREE.IcosahedronGeometry(.2, 1).translate(0, .62, 0)), 'leaf'], [dots(9, .03, .17, .55, .6, 13), 'c']], w: 1 },
    silver: { parts: [[NI(new THREE.IcosahedronGeometry(.11, 1).scale(1.2, .55, 1.2).translate(0, .05, 0)), 'c']], w: 1 },
    feather: { parts: [[bladeTuft(.3, 7), 'c']], w: 1 },
    rosemary: { parts: [[bladeTuft(.24, 9), 'c']], w: 1 },
    carnation: { parts: [[stem(.2), 'stem'], [cup(.04, .21, .8), 'c']], w: 1 },
    tall: { parts: [[floretSpike(.58, .036, 9), 'c']], w: 1 },
  };
  return FORMS;
}
const shadeC = (c, k) => '#' + new THREE.Color(c).offsetHSL(0, 0, k).getHexString();
function partColor(role, c) { return role === 'cyB' ? '#5d8a6a' : role === 'cyT' ? '#7aa07c' : role === 'trunk' ? '#8a6a52' : role === 'stem' ? G.leafD : role === 'leaf' ? G.leaf : role === 'center' ? '#f2c14e' : role === 'cD' ? shadeC(c, -.12) : role === 'cL' ? shadeC(c, .1) : c; }
/* 每团花境里各种样子的比例：穗子（spike/tall）合起来不超过两成多 */
const MIX = {
  left: [['spike', .14], ['tall', .08], ['daisy', .16], ['cosmos', .12], ['airy', .1], ['umbel', .12], ['ground', .16], ['tulip', .12]],
  shop: [['rose', .24], ['peony', .16], ['mound', .14], ['tulip', .12], ['daisy', .1], ['ground', .12], ['tall', .08], ['airy', .04]],
  pond: [['mound', .24], ['daisy', .16], ['umbel', .14], ['ground', .16], ['spike', .1], ['tall', .06], ['tulip', .08], ['airy', .06]],
};
const pickForm = (mix, r) => { let t = r; for (const [f, w] of mix) { t -= w; if (t <= 0) return f; } return mix[0][0]; };

/* —— 种花：挑一种、挑疏密，点地上种一丛；长按一丛拔掉。存 localStorage 'diarytown_beds'，不动 diarytown 库 —— */
const PLANT_SP = [
  { id: 'lav', zh: '薰衣草', c: ['#9a86c4', '#b4a2d8'], kind: 'spike' },
  { id: 'fox', zh: '毛地黄', c: ['#e58fb5', '#f2b6cd'], kind: 'tall' },
  { id: 'plum', zh: '蓝雪花', c: ['#8fb4ea', '#b6cdf2'], kind: 'mound' },
  { id: 'daisy', zh: '雏菊', c: ['#fbfaf4'], kind: 'daisy' },
  { id: 'cosmos', zh: '波斯菊', c: ['#ff8fb0', '#f6c7d3', '#fbfaf4'], kind: 'cosmos' },
  { id: 'mari', zh: '金盏花', c: ['#ffb72e', '#ffcf4a'], kind: 'daisy' },
  { id: 'rose', zh: '玫瑰', c: ['#ff4f8b', '#ee3340', '#ff7aa8'], kind: 'rose' },
  { id: 'peony', zh: '芍药', c: ['#f6b8c8', '#ff7aa8', '#fbfaf4'], kind: 'peony' },
  { id: 'tulip', zh: '郁金香', c: ['#ee3340', '#ffc21a', '#ff7aa8'], kind: 'tulip' },
  { id: 'hyd', zh: '绣球', c: ['#9fb8e0', '#e8a9c0', '#c9b6e8'], kind: 'mound' },
  { id: 'yarrow', zh: '蓍草', c: ['#fbfaf4', '#f6c7d3'], kind: 'umbel' },
  { id: 'thyme', zh: '百里香', c: ['#c9b6e8', '#f6a8c4'], kind: 'ground' },
];
const DENS = [['稀', 6], ['中', 11], ['密', 18]];
let plantMode = false, plantSp = PLANT_SP[0], plantN = 11, BEDS = [], clumpRoot = null;
const CLUMP_HITS = [];
const PG = {};
function plantGeos() {
  if (PG.dot) return PG;
  PG.spike = floretSpike(.36, .024, 7); PG.tall = floretSpike(.58, .036, 9);
  PG.dot = new THREE.IcosahedronGeometry(.04, 0); PG.ball = new THREE.IcosahedronGeometry(.065, 1); PG.big = new THREE.IcosahedronGeometry(.13, 1);
  PG.leaf = new THREE.IcosahedronGeometry(.1, 1); PG.stem = new THREE.CylinderGeometry(.006, .008, .2, 4).translate(0, .1, 0);
  return PG;
}
function makeClump(b) {
  const g = new THREE.Group(), sp = PLANT_SP.find((x) => x.id === b.sp) || PLANT_SP[0], P = plantGeos();
  let k = b.seed * 9301 + 7; const r = () => ((k = (k * 9301 + 49297) % 233280) / 233280);
  const R0 = .16 + .045 * Math.sqrt(b.n);
  const add = (geo, c, x, y, z, sc) => { const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); m.scale.setScalar(sc); m.rotation.y = r() * 6; g.add(m); };
  for (let i = 0; i < b.n; i++) {
    const a = r() * 6.28, rr = Math.sqrt(r()) * R0, x = Math.cos(a) * rr, z = Math.sin(a) * rr, c = sp.c[Math.floor(r() * sp.c.length)];
    if (sp.kind !== 'ground' && sp.kind !== 'mound') add(P.leaf, r() < .5 ? G.leaf : G.leafD, x, .05, z, .6 + r() * .4);
    const f = forms()[sp.kind], sc = (.9 + r() * .4) * f.w, ry = r() * 6.28;
    for (const [geo, role] of f.parts) { const m = new THREE.Mesh(geo, mat(partColor(role, c))); m.position.set(x, 0, z); m.rotation.y = ry; m.scale.setScalar(sc); g.add(m); }
  }
  bake(g); shadowAll(g);
  g.position.set(b.x, inPoly(b.x, b.z) ? .09 : HAT(b.x, b.z), b.z);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(R0 + .08, R0 + .08, .5, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .25; hit.userData.bed = b; g.add(hit); CLUMP_HITS.push(hit);
  g.userData.bed = b; return g;
}
const saveBeds = () => { try { localStorage.setItem('diarytown_beds', JSON.stringify(BEDS)); } catch (e) {} };
function loadBeds() {
  clumpRoot = new THREE.Group(); S.add(clumpRoot);
  try { BEDS = JSON.parse(localStorage.getItem('diarytown_beds') || '[]') || []; } catch (e) { BEDS = []; }
  for (const b of BEDS) { try { clumpRoot.add(makeClump(b)); } catch (e) { console.error(e); } }
}
const plantOK = (x, z) => inPoly(x, z) ? okSpot(x, z) : (HAT(x, z) > .03 && pathDist(x, z) > .3 && !(x > 7.4 && x < 14.4 && z > -3.4 && z < 1.6) && !(x > 3.2 && x < 11.6 && z > -10 && z < -5.2));
function plantAt(x, z) {
  if (!plantOK(x, z)) { toast('这儿种不了'); return; }
  /* 一丛要几粒种子看疏密，种子去店里买 */
  const need = Day.seedCost(plantN), have = Day.seedCount(plantSp.id);
  if (!Day.useSeeds(plantSp.id, need)) { toast(`${plantSp.zh}种子不够，这一丛要 ${need} 粒，手上 ${have} 粒`); return; }
  const b = { id: 'b' + Date.now(), sp: plantSp.id, n: plantN, x, z, seed: Math.floor(Math.random() * 9999) };
  BEDS.push(b); saveBeds(); clumpRoot.add(makeClump(b)); shadowsDirty(); toast(`种了一丛${plantSp.zh}，用了 ${need} 粒`); seedLabels();
}
function removeBed(b) {
  BEDS = BEDS.filter((x) => x.id !== b.id); saveBeds();
  const g = clumpRoot.children.find((c) => c.userData.bed && c.userData.bed.id === b.id);
  if (g) { const i = CLUMP_HITS.findIndex((h) => h.userData.bed.id === b.id); if (i >= 0) CLUMP_HITS.splice(i, 1); clumpRoot.remove(g); dropGeos(g); shadowsDirty(); }
  toast('拔掉了');
}
function toast(t) {
  let e = document.getElementById('gtoast');
  if (!e) { e = document.createElement('div'); e.id = 'gtoast'; e.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 64px);transform:translateX(-50%);z-index:12;padding:6px 16px;border-radius:16px;background:rgba(91,74,68,.88);color:#fbf7ef;font-size:12px;letter-spacing:.1em;opacity:0;transition:opacity .25s;pointer-events:none'; document.body.appendChild(e); }
  e.textContent = t; e.style.opacity = 1; clearTimeout(toast.t); toast.t = setTimeout(() => { e.style.opacity = 0; }, 1500);
}
function setupPlantUI() {
  /* 省电：进门只摆「种花」按钮，面板第一次点开才盖 */
  const btn = document.createElement('button'); btn.id = 'plantBtn'; btn.textContent = '种花';
  btn.style.cssText = 'position:fixed;left:16px;bottom:calc(env(safe-area-inset-bottom) + 40px);z-index:6;padding:7px 16px;border-radius:20px;border:0;background:rgba(255,252,246,.92);color:#5b4a44;font:inherit;font-size:13px;letter-spacing:.2em;box-shadow:0 4px 14px -8px rgba(80,50,40,.35)';
  document.body.appendChild(btn);
  let pn = null;
  btn.onclick = () => { if (!pn) pn = buildPlantPanel(btn); plantMode = !plantMode; btn.classList.toggle('on', plantMode); btn.textContent = plantMode ? '好了' : '种花'; pn.hidden = !plantMode; };
  if (Q.get('plant') === '1') btn.onclick();
}
function buildPlantPanel(btn) {
  btn.style.cssText = '';
  const st = document.createElement('style');
  st.textContent = `#plantBtn{position:fixed;left:16px;bottom:calc(env(safe-area-inset-bottom) + 40px);z-index:6;padding:7px 16px;border-radius:20px;border:0;background:rgba(255,252,246,.92);color:#5b4a44;font:inherit;font-size:13px;letter-spacing:.2em;box-shadow:0 4px 14px -8px rgba(80,50,40,.35)}
#plantBtn.on{background:#9f3726;color:#fbf7ef}
#plantPanel{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom) + 86px);z-index:7;background:rgba(255,252,246,.94);border-radius:18px;padding:10px 12px 8px;box-shadow:0 14px 40px -16px rgba(80,50,40,.45),0 0 0 .5px rgba(90,60,50,.15);transform:rotate(-.4deg)}
#plantPanel[hidden]{display:none}
#plantPanel h3{font-size:11px;font-weight:400;letter-spacing:.3em;color:#a8968c;margin:2px 2px 6px}
#plantPanel .chips{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 8px;scrollbar-width:none}
#plantPanel .chips::-webkit-scrollbar{display:none}
#plantPanel .chips button{flex:0 0 auto;padding:6px 12px;border-radius:16px;border:0;background:#fff;color:#5b4a44;font:inherit;font-size:13px;box-shadow:0 0 0 .5px rgba(90,60,50,.18);white-space:nowrap}
#plantPanel .chips button:nth-child(odd){transform:rotate(-1.5deg)}
#plantPanel .chips button:nth-child(2n){transform:rotate(1.5deg)}
#plantPanel .chips button.on{background:#9f3726;color:#fbf7ef}
#plantPanel .chips button i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:-1px;box-shadow:0 0 0 .5px rgba(90,60,50,.25)}
#plantPanel .chips button small{font-size:10px;opacity:.7}
#plantPanel p{font-size:11px;color:#a8968c;letter-spacing:.1em;margin:0 2px 2px}`;
  document.head.appendChild(st);
  const pn = document.createElement('div'); pn.id = 'plantPanel'; pn.hidden = true;
  pn.innerHTML = '<h3>种 什 么</h3><div class="chips" id="pSp"></div><h3>疏 密</h3><div class="chips" id="pDen"></div><p>点地上种一丛 · 长按一丛拔掉 · 稀 1 粒 中 2 粒 密 3 粒 · <a href="shop.html?seeds" style="color:#9f3726">去店里买种子</a></p>';
  document.body.appendChild(pn);
  const spBox = pn.querySelector('#pSp'), dBox = pn.querySelector('#pDen');
  PLANT_SP.forEach((sp) => { const b = document.createElement('button'); b.dataset.sp = sp.id; b.innerHTML = `<i style="background:${sp.c[0]}"></i>${sp.zh}<small></small>`; b.onclick = () => { plantSp = sp; [...spBox.children].forEach((x) => x.classList.toggle('on', x === b)); }; if (sp === plantSp) b.classList.add('on'); spBox.appendChild(b); });
  DENS.forEach(([zh, n]) => { const b = document.createElement('button'); b.textContent = zh; b.onclick = () => { plantN = n; [...dBox.children].forEach((x) => x.classList.toggle('on', x === b)); }; if (n === plantN) b.classList.add('on'); dBox.appendChild(b); });
  seedLabels();
  return pn;
}
/* 每种花后面写手上还有几粒种子 */
function seedLabels() { document.querySelectorAll('#pSp button').forEach((b) => { const n = Day.seedCount(b.dataset.sp); b.querySelector('small').textContent = ' ' + n; b.style.opacity = n ? 1 : .55; }); }

/* —— 插花摆进园子：插花台「摆到园子」记进 diarytown_vases_placed，这里在固定花位上摆一只小盆；
   起步两个花位，最多五个（day.js 的 VASE_SPOTS）；挨着的以后能杂交，现在只摆着 —— */
const VASE_HITS = []; let vaseRoot = null;
const POT_LOOK = { bowl: ['#8c6a5a', [[0, 0], [.1, 0], [.15, .04], [.16, .08], [.14, .1]]], bottle: ['#f4f1ea', [[0, 0], [.06, 0], [.08, .06], [.07, .14], [.03, .2], [.035, .24]]],
  glass: ['#cfe3ea', [[0, 0], [.07, 0], [.075, .18]]], jug: ['#a77a5c', [[0, 0], [.08, 0], [.11, .08], [.09, .17], [.06, .2], [.065, .22]]], basket: ['#b98d5c', [[0, 0], [.1, 0], [.13, .1], [.13, .12]]] };
function makePot(v) {
  const g = new THREE.Group(), [col, prof] = POT_LOOK[v.vase] || POT_LOOK.bowl, top = prof[prof.length - 1];
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 14), mat(col, v.vase === 'glass' ? { side: THREE.DoubleSide, transparent: true, opacity: .55 } : { side: THREE.DoubleSide }));
  g.add(body);
  if (v.vase === 'bottle') g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.081, .081, .02, 14), mat('#5f7fd8')), 0, .09, 0));
  const cs = (v.colors && v.colors.length ? v.colors : ['#e98aa4']).slice(0, 7);
  cs.forEach((c, i) => {   /* 几枝花：细茎往外张，顶上一团颜色；配叶是绿的 */
    const a = i / cs.length * 6.28 + .4, lean = .1 + (i % 3) * .06, h = .2 + ((i * 37) % 10) / 60, x = Math.cos(a) * lean, z = Math.sin(a) * lean;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.005, .006, h, 4), mat(G.leafD)); st.position.set(x / 2, top[1] + h / 2, z / 2); st.rotation.set(z * 2.2, 0, -x * 2.2); st.userData.noLine = true; g.add(st);
    const hd = new THREE.Mesh(new THREE.IcosahedronGeometry(c === 'leaf' ? .035 : .045, 1), mat(c === 'leaf' ? G.leaf : c)); hd.position.set(x, top[1] + h, z); g.add(hd);
  });
  outline(g, { w: .004 }); shadowAll(g);
  const [x, z] = [v.x + (v.slot === 0 ? .1 : 0), v.z], y = x > 0 ? .145 : .14;   /* 第一个花位往右让 .1，别被灯挡住 */   /* 花架木平台 / 桌下小木平台的面 */
  g.position.set(x, y, z); g.scale.setScalar(1.15);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .55, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .25; hit.userData.vase = v; g.add(hit); VASE_HITS.push(hit);
  return g;
}
/* 拆下来的网格：几何都是各自独有的（bake 合并出来的、描边壳、点选用的圆柱），还给显卡；材质是 mat() 缓存里共用的，不动 */
function dropGeos(root) { root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
function loadVases() {
  if (vaseRoot) { S.remove(vaseRoot); dropGeos(vaseRoot); }
  shadowsDirty();
  vaseRoot = new THREE.Group(); S.add(vaseRoot); VASE_HITS.length = 0;
  for (const v of Day.placedVases()) { try { vaseRoot.add(makePot(v)); } catch (e) { console.error(e); } }
}
function takeVase(v) { Day.unplaceVase(v.id); loadVases(); toast('收回去了，花位空出来一个'); }

/* —— 杂交：进园子时看挨着的两盆过没过夜，过了就盆边冒苗；苗先按 Hy.seedlings() 画，
   满两天开花时变成花园库里的一朵（带 species，插花台认得），从苗表里拿掉 —— */
let newSprouts = 0;
function breed() { try { newSprouts = Hy.breedOvernight(Day.placedVases()).length; } catch (e) { console.error(e); } }
function sproutsInto(list) {
  const keep = [];
  for (const sd of Hy.seedlings()) {
    const f = { id: 'f' + sd.id, at: sd.born, mood: 'sweet', moods: [], species: sd.species, hybrid: true, x: sd.x, z: sd.z };
    if (Date.now() - sd.born < 2 * DAY) {   /* 还是苗：只画，不进库、不能拖 */
      try { flowerRoot.add(makeFlower(f)); } catch (e) { console.error(e); }
      keep.push(sd); continue;
    }
    if (!list.some((x) => x.id === f.id)) { list.push(f); dispatchEvent(new CustomEvent('flower-moved', { detail: f })); }   /* main.js 收到就存进库 */
  }
  if (keep.length !== Hy.seedlings().length) { try { localStorage.setItem('diarytown_seedlings', JSON.stringify(keep)); } catch (e) {} }
}
/* 种花模式里也能种买来的新花种子：形照基因挑一个最像的 */
function addHybridSp() {
  for (const h of Hy.hybrids()) {
    if (PLANT_SP.some((x) => x.id === h.id)) continue;
    const P = Hy.paramsOf(h.genes), kind = P.cluster ? 'mound' : P.dbl ? (P.scale > 1.2 ? 'peony' : 'rose') : P.n >= 7 ? 'daisy' : 'cosmos';
    PLANT_SP.push({ id: h.id, zh: h.name, c: [P.hex], kind, hybrid: true });
  }
}

/* —— 点哪儿飞哪儿，照记忆小镇的 flyTo：目标和机位一起缓动 —— */
const HOME_T = new THREE.Vector3(3.3, .3, -.6);
let fly = null, HOME = null, away = false, backBtn = null;
const ZONES = [];
const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function flyTo(to, dist, dir = null, after = null) {
  const d = dir ? dir.clone().normalize() : CAM.position.clone().sub(CTL.target).normalize();
  wake(1600); fly = { t0: performance.now(), a: CTL.target.clone(), b: to.clone(), pa: CAM.position.clone(), pb: to.clone().addScaledVector(d, dist), after };
}
function goHome() { if (!HOME) return; away = false; if (backBtn) backBtn.hidden = true; LOOK.setTilt(.45, .5); flyTo(HOME.t, HOME.d, HOME.dir); }
function goZone(z) {
  away = true; if (backBtn) backBtn.hidden = false; LOOK.setTilt(.7, .5);
  flyTo(z.at, z.dist, z.dir || new THREE.Vector3(-.6, .75, .55), z.after || null);
}
function addZone(name, x, y, z, sx, sy, sz, at, dist, after) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ visible: false })); m.position.set(x, y, z); m.userData.zone = { name, at: new THREE.Vector3(...at), dist, after }; S.add(m); ZONES.push(m);
}
function setupZones() {
  addZone('farm', 10.6, .3, -.45, 6.6, .8, 4.2, [10.6, .1, -.45], 10);
  addZone('shop', SHOP.x, 1.4, SHOP.z - .3, 2.3, 2.8, 2.2, [SHOP.x, .9, SHOP.z + .4], 7.5, () => setTimeout(() => { location.href = 'shop.html'; }, 250));
  addZone('deck', DECK.x, .5, DECK.z, DECK.w + .2, 1.1, DECK.d + .2, [DECK.x, .4, DECK.z], 7);
  addZone('pond', POND.x, .2, POND.z, POND.r * 2.4, .5, POND.r * 2.4, [POND.x, .1, POND.z], 6.5);
  addZone('village', 7.9, 1, -7.7, 7.5, 2, 4.2, [7.9, .5, -7.7], 11);
  backBtn = document.createElement('button'); backBtn.textContent = '回园子'; backBtn.hidden = true;
  backBtn.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 40px);z-index:6;padding:7px 18px;border-radius:20px;border:0;background:rgba(255,252,246,.92);color:#5b4a44;font:inherit;font-size:13px;letter-spacing:.2em;box-shadow:0 4px 14px -8px rgba(80,50,40,.35)';
  backBtn.onclick = goHome; document.body.appendChild(backBtn);
}
/* 远山：三层矮矮的山影立在岛后面，越远越淡、化进背景（简化版，参考 town/scroll.js 的远山） */
const HILLS = [];
function farHills() {
  let sd = 11; const r = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
  [[-13, 3.8, .35], [-16.5, 5.2, .5], [-21, 7, .66]].forEach(([z, h, fade], li) => {
    const sh = new THREE.Shape(); sh.moveTo(-90, -2); let x = -90;
    while (x < 90) { const w = 8 + r() * 14; sh.lineTo(x + w * .45, h * (.45 + r() * .55)); x += w; sh.lineTo(x, h * (.15 + r() * .25)); }
    sh.lineTo(90, -2); sh.closePath();
    const m = new THREE.MeshBasicMaterial({ color: '#9fb2b8', fog: false, transparent: true, opacity: 1, depthWrite: false });
    m.userData.fade = fade; const mesh = new THREE.Mesh(new THREE.ShapeGeometry(sh, 2), m); mesh.position.set(-z + 4, -.6, -6 + li * 5); mesh.rotation.y = -Math.PI / 2 + .25; mesh.renderOrder = -1; mesh.userData.keep = true; mesh.userData.noLine = true;
    S.add(mesh); HILLS.push(mesh);
  });
}
/* 小村：门外小路两边几户人家，借小镇法式的房子，缩小当邻居 */
function village(world) {
  const spots = [[5.2, -6.4, Math.PI / 2 + .1, 'paris'], [6.9, -8.7, Math.PI / 2 - .15, 'farm'], [9.4, -6.2, -Math.PI / 2 + .2, 'paris'], [10.6, -8.6, -Math.PI / 2, 'farm'], [8.0, -9.6, 0, 'paris']];
  const proto = { paris: FR.paris(), farm: FR.farmhouse() };   /* 两种房子各盖一栋，其余复制（共用网格和贴图，省时间） */
  for (const [x, z, ry, kind] of spots) { const h = proto[kind].clone(); h.scale.setScalar(.5); h.position.set(x, HAT(x, z), z); h.rotation.y = ry; world.add(h); }
  /* 去邻居家的小路：跟园子里的路一样弯弯绕绕、石板大小不一 */
  LANE = new THREE.CatmullRomCurve3(V([[5.4, -.45], [5.9, -1.6], [6.9, -2.5], [6.4, -3.7], [7.3, -4.8], [8.3, -5.5], [7.7, -6.9], [8.4, -8.1], [8.0, -9.6], [8.6, -11]]));
}
/* 外面草地的软边：一张中间实、边上淡掉的圆形 alphaMap，草地化进纸里，夜里化进黑里 */
let SOFT = null;
function softEdge() {
  if (SOFT) return SOFT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 18, 64, 64, 64);
  g.addColorStop(0, '#fff'); g.addColorStop(.55, '#fff'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return SOFT = new THREE.CanvasTexture(c);
}
function meadowTex() {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
  x.fillStyle = G.paper; x.fillRect(0, 0, N, N);
  const g = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2); g.addColorStop(0, '#cfe6b0'); g.addColorStop(.32, '#d3e8b6'); g.addColorStop(.5, '#e2eecd'); g.addColorStop(.72, G.paper); g.addColorStop(1, G.paper);
  x.fillStyle = g; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 70; i++) { const a = rnd() * 6.28, r = rnd() * N * .3, px = N / 2 + Math.cos(a) * r, py = N / 2 + Math.sin(a) * r, rr = 10 + rnd() * 34, gg = x.createRadialGradient(px, py, 0, px, py, rr), col = rnd() < .5 ? '190,222,150' : '220,238,196'; gg.addColorStop(0, `rgba(${col},.55)`); gg.addColorStop(1, `rgba(${col},0)`); x.fillStyle = gg; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function fitUV(g) { g.computeBoundingBox(); const b = g.boundingBox, p = g.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - b.min.x) / (b.max.x - b.min.x); uv[i * 2 + 1] = (p.getY(i) - b.min.y) / (b.max.y - b.min.y); } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
/* 鲜一点的花：日记花和几丛点睛的花用，其余照旧柔 */
const VIVID = ['#ff4f8b', '#ffc21a', '#ee3340', '#8a4fd8', '#ff7aa8'];
function vivid(c) { const col = new THREE.Color(c), h = {}; col.getHSL(h); if (h.s < .08) return c; col.setHSL(h.h, Math.max(h.s, .82), Math.min(.62, Math.max(.5, h.l))); return '#' + col.getHexString(); }

/* —— 天色和天气：时辰跟手机的钟走，照记忆小镇那套（同样只换光、天、地的颜色，不加新后期） ——
   早上 5–9、白天 9–16、黄昏 16–19、夜里 19–5；夜里店的窗和园子里几盏灯亮起来。
   天气看今天最近一条日记的第一个心情：开心晴、平静起薄雾、有点丧/想被哄下小雨（偏冷）、烦/乱糟糟阴天起风（花晃得厉害）、心动黄昏天边多一点粉。
   测试：?t=21&w=rain（w 可填 clear/mist/rain/wind/pink） */
const FARM_SOIL = [], FARM_LAMP = { x: 13.55, z: -2.65 };
let HEMI, SUN, OUTER_M, RAIN = null, LAMPS = [], WX = 'clear';
const SPLASH = [];
const MEADOW = [];
const glowM = new Set();
const Q = new URLSearchParams(location.search);
const SKY = {
  morning: { bg: '#f3f2ee', hemi: ['#eef4ff', '#c9d6c0', 1.3], sun: ['#ffe3c4', 2.3, [-10, 4.5, 6]], warm: .45, glow: .8, lamp: 0, ground: '#ffffff' },
  day: { bg: '#f5f2ea', hemi: ['#fff6ea', '#9d96b4', .95], sun: ['#ffe9c6', 3.3, [-9, 9, 4.5]], warm: .62, glow: 1, lamp: 0, ground: '#ffffff' },
  /* 黄昏：太阳低、金色暖光斜着打，影子长，影子里是冷的淡紫蓝；
     天和背景从蜜桃渐到淡紫；草还是绿、花还是原色、白还是暖白——不给整张上色，warm 和雾都收着 */
  dusk: { bg: '#f1ddd3', sky: ['#f6c9a6', '#e9d4d6', '#cfc6e6'], hemi: ['#c9c4f0', '#b5c6a4', 1.35], sun: ['#ffd29c', 2.3, [-12, 7.5, 6]], warm: .3, glow: 2.0, lamp: 1.4, ground: '#fbf5ee', fog: ['#ece0e4', 60, 120] },
  /* 夜里照记忆小镇 */
  night: { bg: '#2e3352', hemi: ['#7d86c0', '#2a2440', .8], sun: ['#b9c4ff', .6, [8, 14, 10]], warm: .7, glow: 3.2, lamp: 2.0, ground: '#4a5070' },
};
const phase = () => { const h = Q.has('t') ? +Q.get('t') : new Date().getHours(); return h >= 5 && h < 9 ? 'morning' : h >= 9 && h < 16 ? 'day' : h >= 16 && h < 19 ? 'dusk' : 'night'; };
function setupSky() {
  S.traverse((o) => { if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.emissive && o.material.emissive.getHex() && o.material.emissiveIntensity > 0) glowM.add(o.material); });
  glowM.forEach((m) => m.userData.base = m.emissiveIntensity);
  /* 夜里的灯：点光源只放三盏，手机上便宜 */
  for (const [x, z] of [[GATE.x - 1.15, GATE.z - .75], [POND.x - .75, POND.z - .45], [DECK.x - .6, DECK.z + .7], [FARM_LAMP.x, FARM_LAMP.z]]) { const l = new THREE.PointLight('#ffb468', 0, 2.4, 1.8);   /* 范围收小，拱门的玫瑰夜里别像着火 */ l.position.set(x, .75, z); S.add(l); LAMPS.push(l); }
  /* 雨：一把细线，落到地上从头再落 */
  const n = 650, pos = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) { const x = -6 + rnd() * 18, y = rnd() * 9, z = -6 + rnd() * 13; pos.set([x, y, z, x - .1, y - .6, z], i * 6); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  /* 雨点溅在池子和路上的小圈，一圈圈冒出来散掉 */
  const spots = [...Array(5)].map(() => { const a = rnd() * 6.28, r = rnd() * (POND.r - .1); return [POND.x + Math.cos(a) * r, .15, POND.z + Math.sin(a) * r]; }).concat(PATH_MAIN.getSpacedPoints(9).concat(PATH_DECK.getSpacedPoints(6)).map((p) => [p.x, .14, p.z]));
  const ringG = new THREE.RingGeometry(.06, .075, 20);
  spots.forEach(([x, y, z], i) => { const r = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.set(x, y, z); r.userData.ph = rnd(); r.visible = false; S.add(r); SPLASH.push(r); });
  RAIN = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#e4edf7', transparent: true, opacity: .8, depthWrite: false, fog: false })); RAIN.visible = false; RAIN.frustumCulled = false; S.add(RAIN);
}
function weatherOf(list) {
  if (Q.has('w')) return Q.get('w');
  const today = new Date().toDateString(), mine = (list || []).filter((f) => f.text && new Date(f.at).toDateString() === today).sort((a, b) => b.at - a.at)[0];
  const m = mine && ((mine.moods && mine.moods[0]) || mine.mood);
  return { calm: 'mist', down: 'rain', coax: 'rain', cross: 'wind', messy: 'wind', sweet: 'pink' }[m] || 'clear';
}
/* 黄昏的天：竖着一条蜜桃→淡紫的渐变（心动那天上头多一抹粉） */
const skyCache = {};
function skyTex(cols, pink) {
  const key = cols.join() + pink; if (skyCache[key]) return skyCache[key];
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, pink ? '#f4b8cc' : cols[0]); g.addColorStop(.45, cols[1]); g.addColorStop(1, cols[2]); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return skyCache[key] = t;
}
let skyKey = '';
export function applySky() {
  if (!HEMI) return;
  const k = phase(), t = SKY[k], bg = new THREE.Color(t.bg), gr = new THREE.Color(t.ground);
  HEMI.color.set(t.hemi[0]); HEMI.groundColor.set(t.hemi[1]); HEMI.intensity = t.hemi[2];
  SUN.color.set(t.sun[0]); SUN.intensity = t.sun[1]; SUN.position.set(...t.sun[2]);
  let warm = t.warm, fogN = k === 'night' ? 26 : t.fog ? t.fog[1] : 42, fogF = k === 'night' ? 62 : t.fog ? t.fog[2] : 85;
  if (WX === 'rain') { SUN.intensity *= .6; HEMI.color.lerp(new THREE.Color('#dfe8f5'), .5); bg.lerp(new THREE.Color(k === 'night' ? '#262c44' : '#d9dee4'), .35); gr.lerp(new THREE.Color(k === 'night' ? '#3a4058' : '#e6eaee'), .3); warm *= .4; }
  else if (WX === 'wind') { SUN.intensity *= .7; bg.lerp(new THREE.Color(k === 'night' ? '#2a2e40' : '#dfe0de'), .3); gr.lerp(new THREE.Color(k === 'night' ? '#40465c' : '#eeeeea'), .25); warm *= .7; }
  else if (WX === 'mist') { bg.lerp(new THREE.Color(k === 'night' ? '#4a5272' : '#ffffff'), .35); fogN = 20; fogF = 52; }
  else if (WX === 'pink' && k === 'dusk') { HEMI.color.lerp(new THREE.Color('#f0c6dc'), .3); }
  S.background = t.sky && WX !== 'rain' && WX !== 'wind' ? skyTex(t.sky, WX === 'pink') : bg; S.fog.color.copy(t.fog && WX !== 'mist' ? new THREE.Color(t.fog[0]) : bg); S.fog.near = fogN; S.fog.far = fogF;
  if (OUTER_M) OUTER_M.color.copy(gr);
  MEADOW.forEach((m) => m.color.copy(m.userData.base).lerp(gr, k === 'night' ? .85 : 0));   /* 外面那几块草地跟着天色暗下去，夜里别一块块发白 */
  LOOK.setWarm(warm);
  HILLS.forEach((h) => h.material.color.set(k === 'night' ? '#3c4366' : k === 'dusk' ? '#a9a7c8' : '#88a7bb').lerp(bg, h.material.userData.fade));   /* 远山跟着天色走，越远越蓝越淡 */
  LAMPS.forEach((l) => l.intensity = t.lamp);
  if (k + WX !== skyKey) { skyKey = k + WX; shadowsDirty(); }   /* 太阳换了位置才重算影子 */
  glowM.forEach((m) => m.emissiveIntensity = m.userData.base * t.glow);
  FARM_SOIL.forEach((m, i) => { m.emissive = m.emissive || new THREE.Color(); m.emissive.set('#5a3a24'); m.emissiveIntensity = (k === 'night' ? .5 : k === 'dusk' ? .12 : 0) * (i === 3 ? .3 : 1); });
  if (RAIN) { RAIN.visible = WX === 'rain'; RAIN.material.color.set(k === 'night' ? '#b3bfe0' : '#e4edf7'); }
  SPLASH.forEach((r) => r.visible = WX === 'rain');
}
const wash = (c, o = {}) => mat('#ffffff', { map: washTex(c, { blots: o.blots || 30, seed: o.seed || 3, rep: o.rep || [2, 2] }) });
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

/* 合并：同一种材质、同一种描边粗细的静态网格并成一个，再描边——原来几百个网格各套一层描边壳，手机上盖不完 */
function bake(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map(), drop = [], m = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep || Array.isArray(o.material) || o.material.visible === false || o.material.transparent) return;
    const g = o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.morphAttributes = {}; g.clearGroups();
    m.multiplyMatrices(inv, o.matrixWorld); g.applyMatrix4(m);
    const lw = o.userData.noLine ? 'none' : (o.userData.lineW ?? 'd'), key = o.material.uuid + '|' + lw + '|' + !!g.index;
    if (!groups.has(key)) groups.set(key, { mat: o.material, lw, list: [] });
    groups.get(key).list.push(g); drop.push(o);
  });
  for (const o of drop) o.parent && o.parent.remove(o);
  for (const { mat: mt, lw, list } of groups.values()) {
    const mg = mergeGeometries(list); if (!mg) continue;
    const me = new THREE.Mesh(mg, mt); if (lw === 'none') me.userData.noLine = true; else if (lw !== 'd') me.userData.lineW = lw;
    root.add(me);
  }
}
/* 树：叉开的树干，树冠是几团大小不一、错开的叶团，不对称 */
function tree2(h, sd, { lean = 0, bloom = null } = {}) {
  const g = new THREE.Group(); let s = sd * 97 + 13; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const bark = mat('#8a6a52');
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.05 * h, .09 * h, h * .5, 7), bark); trunk.position.y = h * .25; trunk.rotation.z = lean; g.add(trunk);
  const tops = [];
  const nb = 2 + Math.floor(r() * 2);
  for (let i = 0; i < nb; i++) {
    const a = i / nb * 6.28 + r(), tilt = .5 + r() * .4, len = h * (.3 + r() * .2);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.025 * h, .045 * h, len, 6), bark);
    const dir = new THREE.Vector3(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt));
    const base = new THREE.Vector3(0, h * (.42 + r() * .08), 0);
    b.position.copy(base).addScaledVector(dir, len / 2); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.add(b);
    tops.push(base.clone().addScaledVector(dir, len));
  }
  tops.push(new THREE.Vector3(r() * .1, h * .62, r() * .1));
  tops.forEach((p, i) => {
    const n = 2 + Math.floor(r() * 2);
    for (let j = 0; j < n; j++) {
      const rad = h * (.13 + r() * .12), b = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 1), mat(bloom ? (r() < .72 ? bloom[Math.floor(r() * bloom.length)] : G.leafL) : [G.leaf, G.leafD, G.leafL][Math.floor(r() * 3)]));
      b.position.set(p.x + (r() - .5) * h * .22, p.y + (r() - .2) * h * .14, p.z + (r() - .5) * h * .22); b.scale.set(1, .8 + r() * .2, 1); b.userData.lineW = .01; g.add(b);
    }
  });
  return g;
}
/* 开花的树：照真樱花树的样子，树干露出来、枝往两边平着伸、再分叉，
   花是枝头一簇簇的小团（压扁的、有棱角），底面一档深色、顶上浅色，中间漏几点叶绿，树下落一圈花瓣 */
function bloomTree(h, sd, cols) {
  const g = new THREE.Group(); let s = sd * 131 + 7; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const bark = mat('#6f5444'), deep = new THREE.Color(cols[0]).lerp(new THREE.Color('#7a5a78'), .28).getStyle();
  const lean = (r() - .5) * .16;
  const trunkH = h * .46, trunk = new THREE.Mesh(new THREE.CylinderGeometry(.035 * h, .07 * h, trunkH, 7), bark);
  trunk.position.set(Math.sin(lean) * trunkH / 2, trunkH / 2, 0); trunk.rotation.z = -lean; g.add(trunk);
  const top = new THREE.Vector3(Math.sin(lean) * trunkH, trunkH * .96, 0), tips = [];
  const limb = (from, dir, len, rad, depth) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(rad * .6, rad, len, 6), bark);
    b.position.copy(from).addScaledVector(dir, len / 2); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); b.userData.lineW = .006; g.add(b);
    const end = from.clone().addScaledVector(dir, len);
    if (depth > 0) for (let k = 0; k < 2; k++) {
      const a = Math.atan2(dir.z, dir.x) + (k ? .5 : -.5) + (r() - .5) * .3, el = Math.asin(Math.min(.95, dir.y)) + (r() - .3) * .35;
      const d2 = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).normalize();
      limb(end, d2, len * (.55 + r() * .15), rad * .6, depth - 1);
    } else tips.push(end);
    if (depth === 1) tips.push(end.clone().add(new THREE.Vector3(0, h * .05, 0)));
  };
  const nb = 4 + Math.floor(r() * 2);
  for (let i = 0; i < nb; i++) {
    const a = i / nb * 6.28 + r() * .6, el = .35 + r() * .45;
    limb(top, new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)), h * (.26 + r() * .1), .03 * h, 1);
  }
  tips.forEach((p) => {
    const n = 3 + Math.floor(r() * 3);
    for (let j = 0; j < n; j++) {
      const rad = h * (.06 + r() * .05), dy = (r() - .45) * h * .1;
      const c = dy < -h * .015 ? deep : r() < .12 ? G.leafL : cols[Math.floor(r() * cols.length)];
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 0), mat(c));
      b.position.set(p.x + (r() - .5) * h * .16, p.y + dy, p.z + (r() - .5) * h * .16); b.scale.set(1.15, .62, 1.15); b.rotation.y = r() * 6; b.userData.lineW = .006; g.add(b);
    }
  });
  const petal = mat(cols[cols.length - 1]);
  for (let i = 0; i < 26; i++) {
    const a = r() * 6.28, d = h * (.15 + r() * .6), pt = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .006, 5), petal);
    pt.position.set(Math.cos(a) * d, .03, Math.sin(a) * d); pt.userData.noLine = true; g.add(pt);
  }
  return g;
}
/* 一丛灌木：几团挤在一起，可选开小花 */
function shrub(x, z, size, colors, flowersOn = null) {
  const g = new THREE.Group(); g.position.set(x, inPoly(x, z) ? .08 : Math.max(.0, HAT(x, z)) + .02, z);
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const r = size * (.45 + rnd() * .45), b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat(colors[Math.floor(rnd() * colors.length)]));
    b.position.set((rnd() - .5) * size * 1.2, r * .7 + rnd() * size * .25, (rnd() - .5) * size * 1.2); b.scale.y = .82; b.userData.lineW = .008; g.add(b);
    if (flowersOn && rnd() < .8) for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(.035 + rnd() * .02, 0), mat(flowersOn[k % flowersOn.length])); const a = rnd() * 6.28, e = rnd() * 1.2; f.position.copy(b.position).add(new THREE.Vector3(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r * .82, Math.sin(a) * Math.cos(e) * r)); f.userData.noLine = true; g.add(f); }
  }
  return g;
}

// ---------- 地、店、围边、路、分区、田、外面 ----------
/* 让一下：点按和跑酷那一帧先过去 */
const yieldUI = () => new Promise((ok) => setTimeout(ok, 0));
async function buildWorld() {
  const world = new THREE.Group();
  /* 环境：照记忆小镇用 land.js 的岛和水，园子、田、小村各一块平地 */
  const lawnC = new THREE.Color(G.grass);
  /* 篱笆外的地贴着园子先接园子的绿，往外两三步才慢慢变成岛上的浅草绿，没有硬色边 */
  const land = LAND.island(ISLE_RECTS, { grass: '#a9cf86', grassD: '#94bf74', sand: '#ecdcb0', deep: '#93c9c6', seed: 4, tone: (x, z, h, c) => { if (h < -.1 || inPoly(x, z)) return; const dd = edgeDist(x, z); if (dd < 3) c.lerp(lawnC, .75 * (1 - dd / 3) * (1 - dd / 3)); } });
  HAT = land.userData.heightAt; OUTER_M = land.material; land.userData.keep = true; world.add(land);
  T.mark('b-island'); await yieldUI();
  const sea = LAND.water(90); sea.position.y = -.5; sea.userData.keep = true; world.add(sea);
  farHills();
  { const pts = []; let k = 17; const r2 = () => ((k = (k * 9301 + 49297) % 233280) / 233280); for (let i = 0; pts.length < 900 && i < 12000; i++) { const a = r2() * 6.28, d = 6 + Math.sqrt(r2()) * 16, x = 2 + Math.cos(a) * d, z = Math.sin(a) * d; if (HAT(x, z) < -.4) pts.push(x, -.47, z); } glints(pts, 8); }
  T.mark('b-sea'); await yieldUI();
  village(world); T.mark('b-village'); await yieldUI();
  /* 园子的地：照 PLOT 的形挤一块厚草皮 */
  const lawnG = new THREE.ExtrudeGeometry(PLOT, { depth: .09, bevelEnabled: false, curveSegments: 24 }); lawnG.rotateX(Math.PI / 2); lawnG.translate(0, .09, 0);
  const lawn = new THREE.Mesh(lawnG, wash(G.grass, { rep: [.11, .11], seed: 2, blots: 22 })); lawn.userData.lineW = .01; world.add(lawn);
  /* 前面那片留空的草坪：浅一点的弯月形 */
  const mown = new THREE.Shape(); mown.moveTo(-3.3, 2.5); mown.bezierCurveTo(-2.4, 3.3, -.6, 3.0, -.3, 2.4); mown.bezierCurveTo(-.1, 1.9, -1.4, 1.7, -2.6, 1.75); mown.quadraticCurveTo(-3.6, 1.9, -3.3, 2.5);
  const mg = new THREE.ShapeGeometry(mown, 20); mg.rotateX(-Math.PI / 2); const mw = new THREE.Mesh(mg, wash(G.mown, { rep: [.4, .4], seed: 8, blots: 14 })); mw.position.y = .1; mw.userData.noLine = true; world.add(mw);
  T.mark('b-lawn'); await yieldUI();
  /* 店：放大一倍，靠后排左三分之一 */
  const shop = buildHouse(Day.decor());   /* 店面装修跟 day.js 走（门口小摊落在石板台子上，离花境还有一截） */ shop.scale.setScalar(SHOP.s); shop.position.set(SHOP.x, .11, SHOP.z);   /* 石板台子比草皮高一截，别跟草共面闪 */ world.add(shop);
  T.mark('b-shop'); await yieldUI();
  /* 围边：前面和左边白篱笆（大门、侧门留口），后面右边是绿篱；大半段被灌木和藤吃掉 */
  const pk = [], hg = [];
  const gap = (mx, mz) => (Math.abs(mx - GATE.x) < GATE.half && mz > 2.9) || (Math.abs(mz - SIDE.z) < SIDE.half && mx > 3.8);
  for (let i = 0; i < EDGE.length - 1; i++) {
    const a = EDGE[i], b = EDGE[i + 1], mx = (a.x + b.x) / 2, mz = (a.y + b.y) / 2, len = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    if (gap(mx, mz)) continue;
    const front = mz > 2.4 || (mx < -3.9 && mz > -.5) || (mx > 3.8 && mz > -1.6);
    if (front) {
      const g = new THREE.BoxGeometry(.055, .38, .045); g.translate(0, .28, 0); g.rotateY(-ang); g.translate(mx, 0, mz); pk.push(g);
      for (const y of [.22, .37]) { const r = new THREE.BoxGeometry(len + .02, .028, .028); r.rotateY(-ang); r.translate(mx, y, mz); pk.push(r); }
    } else { const g = new THREE.BoxGeometry(len + .06, .5 + Math.sin(i * .7) * .06, .36); g.translate(0, .34, 0); g.rotateY(-ang); g.translate(mx, 0, mz); hg.push(g); }
  }
  const fence = new THREE.Mesh(mergeGeometries(pk), mat(C.white)); fence.userData.lineW = .006; world.add(fence);
  const hedge = new THREE.Mesh(mergeGeometries(hg), wash(G.leafD, { rep: [6, 1], seed: 4, blots: 20 })); hedge.userData.lineW = .01; world.add(hedge);
  /* 大门：两根门柱在路两边，拱上爬玫瑰 */
  for (const s of [-1, 1]) world.add(at(new THREE.Mesh(new THREE.BoxGeometry(.11, .66, .11), mat(C.white)), GATE.x + s * GATE.half, .42, GATE.z));
  const arch = new THREE.Mesh(new THREE.TorusGeometry(GATE.half, .04, 6, 18, Math.PI), mat(C.white)); arch.position.set(GATE.x, .74, GATE.z); world.add(arch);
  for (let i = 0; i < 14; i++) { const a = i / 13 * Math.PI, r = new THREE.Mesh(new THREE.IcosahedronGeometry(.06 + (i % 3) * .015, 0), mat(i % 3 ? G.pink : (i % 2 ? G.leaf : C.white))); r.position.set(GATE.x + Math.cos(a) * GATE.half, .74 + Math.sin(a) * GATE.half, GATE.z + (rnd() - .5) * .08); r.userData.lineW = .004; world.add(r); }
  for (const s of [-1, 1]) world.add(at(new THREE.Mesh(new THREE.BoxGeometry(.1, .5, .1), mat(C.white)), SIDE.x, .34, SIDE.z + s * SIDE.half));
  T.mark('b-fence'); await yieldUI();
  /* 吃掉边的灌木：沿篱笆走，大半段压住篱笆、往外溢；门口和几段留出来 */
  for (let i = 0; i < EDGE.length; i += 5) {
    const p = EDGE[i]; if (gap(p.x, p.y) || Math.hypot(p.x - GATE.x, p.y - GATE.z) < 1.0 || Math.hypot(p.x - SIDE.x, p.y - SIDE.z) < .9) continue;
    if (Math.sin(i * .09) > .62) continue;   /* 留几段篱笆露出来 */
    if (p.y > 2.6 && rnd() < .55) continue;   /* 正前方镜头那边少压一点，别挡住池子和路 */
    const n = new THREE.Vector2(p.x, p.y).normalize(), out = (rnd() - .35) * .45;
    const fl = p.y > 2.4 || p.x < -3.8 ? [G.pink, C.white] : rnd() < .3 ? ['#fbf6ec'] : null;
    world.add(shrub(p.x + n.x * out, p.y + n.y * out, .32 + rnd() * .22, [G.leaf, G.leafD, G.leafL], fl));
  }
  T.mark('b-shrubs'); await yieldUI();
  /* 园路：一条细细弯弯的石板路，石板隔得开；拱门到店门，半路岔去花架，岔路上再一条侧路出篱笆去田；门外一段弯出画面 */
  /* 石板大小不一：大块扁平的和小块混着，形状歪一点、各转各的，路边零星几粒小卵石 */
  const STONE_C = ['#9aa8b2', '#8e9ca6', '#a9b4bb', '#b3bcc0'];   /* 灰蓝的石板（参考图），下面垫浅色碎石 */
  const flag = (x, y, z, r, c) => { if (!inPoly(x, z)) y = Math.max(y, HAT(x, z) + .025); const sides = 6 + Math.floor(rnd() * 4), st = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.06, .04 + r * .08, sides), mat(c)); st.scale.set(1 + (rnd() - .5) * .45, 1, 1 + (rnd() - .5) * .45); st.position.set(x, y, z); st.rotation.y = rnd() * 6.28; st.userData.lineW = .005; world.add(st); };
  const stones = (curve, gapLen, w = .14, y = .11) => {
    const L = curve.getLength(), n = Math.max(2, Math.round(L / gapLen)), pts = curve.getSpacedPoints(n);
    pts.forEach((p, i) => {
      const k = rnd(), r = k < .25 ? w * (1.5 + rnd() * .3) : k < .68 ? w * (.9 + rnd() * .25) : w * (.5 + rnd() * .14);   /* 大小不一但别差太多 */
      const tg = curve.getTangentAt(Math.min(1, i / n)), nx = -tg.z, nz = tg.x, side = (rnd() - .5) * .14;
      flag(p.x + nx * side, y, p.z + nz * side, r, STONE_C[Math.floor(rnd() * 4)]);
      if (r < w * .6 && rnd() < .6) flag(p.x + nx * (side + .18), y, p.z + nz * (side + .18), r * .75, STONE_C[Math.floor(rnd() * 4)]);
      if (rnd() < .35) for (let j = 0; j < 1 + Math.floor(rnd() * 3); j++) { const sd = (rnd() < .5 ? -1 : 1) * (Math.max(.26, r + .08) + rnd() * .14), pb = new THREE.Mesh(new THREE.IcosahedronGeometry(.025 + rnd() * .02, 0), mat(STONE_C[Math.floor(rnd() * 4)])); pb.scale.y = .55; { const px = p.x + nx * sd + (rnd() - .5) * .1, pz = p.z + nz * sd + (rnd() - .5) * .1; pb.position.set(px, inPoly(px, pz) ? y - .005 : HAT(px, pz) + .02, pz); } pb.rotation.y = rnd() * 3; pb.userData.lineW = .003; world.add(pb); }
    });
  };
  const gravel = (curve, wd) => { const pts = curve.getSpacedPoints(120), pos = [], idx = []; pts.forEach((p, i) => { const tg = curve.getTangentAt(i / 120), nx = -tg.z, nz = tg.x, w = wd; pos.push(p.x + nx * w, .097, p.z + nz * w, p.x - nx * w, .097, p.z - nz * w); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat('#e9e1d2', { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, side: THREE.DoubleSide })); m.userData.noLine = true; m.receiveShadow = true; world.add(m); };
  gravel(PATH_MAIN, .34); gravel(PATH_DECK, .28);
  /* 人修的园路：碎石带宽度一致、两边一道矮砖沿收边；石板横着铺、一块接一块等距，大小只差一点、顺着路转 */
  const edging = (curve, wd, others = []) => { const n = Math.round(curve.getLength() / .12), em = mat('#b49a80'); for (let i = 0; i <= n; i++) { const t = i / n, p = curve.getPointAt(t), tg = curve.getTangentAt(t), nx = -tg.z, nz = tg.x, ry = Math.atan2(tg.x, tg.z); for (const sd of [-1, 1]) { const ex = p.x + nx * wd * sd, ez = p.z + nz * wd * sd; if (inShop(ex, ez, .04)) continue; if (others.some(([pts, w]) => pts.some((q) => Math.hypot(ex - q.x, ez - q.z) < w))) continue; const b = new THREE.Mesh(new THREE.BoxGeometry(.05, .045, .115), em); b.position.set(ex, .115, ez); b.rotation.y = ry; b.userData.lineW = .003; world.add(b); } } };
  { const mp = PATH_MAIN.getSpacedPoints(160), dp = PATH_DECK.getSpacedPoints(140); edging(PATH_MAIN, .36, [[dp, .29]]); edging(PATH_DECK, .3, [[mp, .35]]); }
  /* 石板：大块不规则的扁石板，5–8 条边、顶点各自歪，宽窄长短不一，缝很窄，偶尔大的旁边塞一块小的 */
  const flagGeo = (L, W, sides) => { const sh = new THREE.Shape(); for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2 + rnd() * .35, rr = .82 + rnd() * .3, x = Math.cos(a) * L / 2 * rr, y = Math.sin(a) * W / 2 * rr; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); } sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: .045, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; };
  const slabs = (curve, _gap, wd) => {
    const len = curve.getLength(); let d = .12;
    while (d < len - .1) {
      const L = .28 + rnd() * .26, W = wd * (1.15 + rnd() * .55), t = Math.min(1, (d + L / 2) / len), p = curve.getPointAt(t), tg = curve.getTangentAt(t), ry = Math.atan2(tg.x, tg.z);
      const st = new THREE.Mesh(flagGeo(W, L, 5 + Math.floor(rnd() * 4)), mat(STONE_C[Math.floor(rnd() * 4)])); st.position.set(p.x + (rnd() - .5) * .04, .1, p.z + (rnd() - .5) * .04); st.rotation.y = ry + (rnd() - .5) * .25; st.userData.lineW = .005; world.add(st);
      if (rnd() < .22) { const sd = rnd() < .5 ? -1 : 1, nx = -tg.z * sd, nz = tg.x * sd, sm = new THREE.Mesh(flagGeo(.13 + rnd() * .06, .1 + rnd() * .05, 5 + Math.floor(rnd() * 3)), mat(STONE_C[Math.floor(rnd() * 4)])); sm.position.set(p.x + nx * (W / 2 - .02), .1, p.z + nz * (W / 2 - .02)); sm.rotation.y = rnd() * 6; sm.userData.lineW = .004; world.add(sm); }
      d += L + .025 + rnd() * .02;
    }
  };
  slabs(PATH_MAIN, .42, .34); slabs(PATH_DECK, .4, .28);
  PATH_POND.getSpacedPoints(3).forEach((p, i) => { const st = new THREE.Mesh(flagGeo(.3 + rnd() * .08, .24 + rnd() * .06, 6 + (i % 2)), mat(STONE_C[i % 4])); st.position.set(p.x, .095, p.z); st.rotation.y = rnd() * 6; st.userData.lineW = .005; world.add(st); });
  if (LANDING.r) { const L = LANDING, disc = new THREE.Mesh(new THREE.CylinderGeometry(L.r, L.r, .02, 40), mat('#e9e1d2', { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); disc.position.set(L.x, .1, L.z); disc.userData.noLine = true; disc.receiveShadow = true; world.add(disc);
    const em = mat('#b49a80'), nb = 30; for (let i = 0; i < nb; i++) { const a = i / nb * 6.28, b = new THREE.Mesh(new THREE.BoxGeometry(.05, .045, L.r * 6.28 / nb * .92), em); b.position.set(L.x + Math.cos(a) * (L.r + .02), .115, L.z + Math.sin(a) * (L.r + .02)); b.rotation.y = -a; b.userData.lineW = .003; world.add(b); }
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(.2, .21, .05, 12), mat(STONE_C[2])); mid.position.set(L.x, .125, L.z); mid.userData.lineW = .005; world.add(mid);
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + .2, st = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.04, .05, 6), mat(STONE_C[i % 4])); st.scale.set(.13, 1, .09); st.position.set(L.x + Math.cos(a) * .38, .125, L.z + Math.sin(a) * .38); st.rotation.y = -a; st.userData.lineW = .005; world.add(st); } }
  stones(PATH_SIDE, .5, .12);
  stones(PATH_OUT, .6, .16, .025);
  if (LANE) stones(LANE, .55, .15, .025);
  T.mark('b-path'); await yieldUI();
  /* 池子：比店小得多，在路边；浅水一圈透亮，两道细涟漪 */
  const pond = new THREE.Group(); pond.position.set(POND.x, .09, POND.z);
  /* 池沿一圈压顶石：一块块扁石首尾挨着 */
  { const n = 16, cm = [mat('#ddd6c8'), mat('#d2cab9')]; for (let i = 0; i < n; i++) { const a = (i + .5) / n * 6.28, w = POND.r * 6.28 / n * 1.02; const st = new THREE.Mesh(new RoundedBoxGeometry(w, .06, .15, 2, .02), cm[i % 2]); st.position.set(Math.cos(a) * (POND.r + .06), .045, Math.sin(a) * (POND.r + .06)); st.rotation.y = -a + Math.PI / 2; st.userData.lineW = .004; pond.add(st); } }
  const wc = document.createElement('canvas'); wc.width = wc.height = 128; const wx = wc.getContext('2d'); const gr = wx.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, '#5fa9b6'); gr.addColorStop(.62, '#7fc2c6'); gr.addColorStop(.86, '#bfe3dc'); gr.addColorStop(1, '#e4f2ea'); wx.fillStyle = gr; wx.fillRect(0, 0, 128, 128);
  const wt = new THREE.CanvasTexture(wc); wt.colorSpace = THREE.SRGBColorSpace;
  const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 32), new THREE.MeshBasicMaterial({ map: wt })); water.rotation.x = -Math.PI / 2; water.position.y = .045; water.userData.noLine = true; pond.add(water);
  RIPPLES = [0, 1].map(() => { const rr = new THREE.Mesh(new THREE.RingGeometry(.2, .215, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .4, depthWrite: false })); rr.rotation.x = -Math.PI / 2; rr.position.set(.05, .05, -.04); rr.userData.noLine = true; rr.userData.keep = true; pond.add(rr); return rr; });
  { const pts = []; let k = 29; const r2 = () => ((k = (k * 9301 + 49297) % 233280) / 233280); for (let i = 0; i < 15; i++) { const a = r2() * 6.28, d = Math.sqrt(r2()) * POND.r * .85; pts.push(POND.x + Math.cos(a) * d, .14, POND.z + Math.sin(a) * d); } glints(pts, 5.5); }
  pond.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.035, .06, .2, 10), mat('#e3ddd0')), 0, .13, 0));
  pond.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.11, .05, .045, 16), mat('#e3ddd0')), 0, .24, 0));
  /* 睡莲叶带缺口，开两朵粉的；东北边水沿一丛鸢尾和细芦苇 */
  for (const [a, d, r0, fl] of [[2.4, .3, .085, 1], [2.9, .2, .07, 0], [.9, .28, .075, 1], [4.4, .25, .065, 0]]) { const lp = new THREE.Mesh(new THREE.CircleGeometry(r0, 12, .3, 5.8), mat('#5f9a52', { side: THREE.DoubleSide })); lp.rotation.x = -Math.PI / 2; lp.rotation.z = a; lp.position.set(Math.cos(a) * d, .055, Math.sin(a) * d); lp.userData.noLine = true; pond.add(lp); if (fl) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.03, 1), mat('#f6b8c8')); b.scale.y = .6; b.position.set(Math.cos(a) * d + .02, .075, Math.sin(a) * d); b.userData.noLine = true; pond.add(b); } }
  { const iris = bladeTuft(.34, 7), reed = bladeTuft(.42, 9); for (const [a, kind] of [[-.6, 'iris'], [-.35, 'reed'], [-.85, 'reed'], [.15, 'iris']]) { const x = Math.cos(a) * (POND.r + .02), z = Math.sin(a) * (POND.r + .02); const m = new THREE.Mesh(kind === 'iris' ? iris : reed, mat(kind === 'iris' ? '#5f9a6a' : '#7fa05a', { side: THREE.DoubleSide })); m.position.set(x, .05, z); m.rotation.y = a; pond.add(m); if (kind === 'iris') for (let j = 0; j < 3; j++) { const h = new THREE.Mesh(new THREE.IcosahedronGeometry(.028, 0), mat('#6f5fd0')); h.position.set(x + (j - 1) * .04, .3 + j * .03, z + (j - 1) * .02); h.userData.noLine = true; pond.add(h); } } }
  { /* 池子西北边一张小长凳，朝着水 */
    const bn = new THREE.Group(); bn.add(at(new THREE.Mesh(new THREE.BoxGeometry(.56, .04, .18), mat('#9a6b4c')), 0, .2, 0)); bn.add(at(new THREE.Mesh(new THREE.BoxGeometry(.56, .16, .03), mat('#9a6b4c')), 0, .33, -.08)); for (const x of [-.22, .22]) bn.add(at(new THREE.Mesh(new THREE.BoxGeometry(.04, .2, .16), mat('#7c5639')), x, .1, 0));
    const ba = -2.25, bx = Math.cos(ba) * (POND.r + .55), bz = Math.sin(ba) * (POND.r + .55); bn.position.set(bx, 0, bz); bn.rotation.y = Math.atan2(-bx, -bz); pond.add(bn); }
  for (let i = 0; i < 0; i++) { const lp = new THREE.Mesh(new THREE.CircleGeometry(.07, 10), mat(G.leaf)); lp.rotation.x = -Math.PI / 2; lp.position.set(Math.cos(i * 2.6 + 2.2) * .32, .05, Math.sin(i * 2.6 + 2.2) * .32); lp.userData.noLine = true; pond.add(lp); }
  world.add(pond);
  /* 前面草坪边：小圆桌、两把椅子、一把粉白条纹伞（v3 的伞像一块白盘子） */
  const tb = new THREE.Group(); tb.position.set(TABLE.x, .14, TABLE.z); tb.rotation.y = .5; tb.scale.setScalar(.85);
  tb.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .035, 20), mat(C.white)), 0, .4, 0));
  tb.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.025, .045, .4, 8), mat(C.iron)), 0, .2, 0));
  tb.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .95, 6), mat(C.iron)), 0, .5, 0));
  for (let i = 0; i < 8; i++) { const sg = new THREE.Mesh(new THREE.ConeGeometry(.5, .2, 3, 1, true, i / 8 * Math.PI * 2, Math.PI * 2 / 8), mat(i % 2 ? G.pink : C.white, { side: THREE.DoubleSide })); sg.position.y = 1.02; tb.add(sg); }
  tb.add(at(new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), mat(C.white)), 0, 1.13, 0));
  for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * Math.PI * 2, tip = new THREE.Mesh(new THREE.SphereGeometry(.015, 6, 4), mat(C.white)); tip.position.set(Math.cos(a) * .5, .92, Math.sin(a) * .5); tip.userData.noLine = true; tb.add(tip); }
  for (const s of [-1, 1]) { const ch = new THREE.Group(); ch.position.set(s * .42, 0, .04 * s); ch.rotation.y = s > 0 ? -.3 : .2; ch.add(at(new THREE.Mesh(new THREE.BoxGeometry(.22, .03, .22), mat("#c9a06a")), 0, .24, 0)); ch.add(at(new THREE.Mesh(new THREE.BoxGeometry(.03, .24, .22), mat("#c9a06a")), s * .11, .37, 0)); for (const [x, z] of [[-.09, -.09], [.09, -.09], [-.09, .09], [.09, .09]]) ch.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, .24, 5), mat(C.iron)), x, .12, z)); tb.add(ch); }
  world.add(tb);
  /* 右后：木平台花架，比例对着店（店一楼门面高 1.2 左右，花架一人高 .95） */
  const dk = new THREE.Group(); dk.position.set(DECK.x, .09, DECK.z); dk.rotation.y = -.08;
  for (let i = 0; i < 6; i++) dk.add(at(new THREE.Mesh(new THREE.BoxGeometry(DECK.w, .05, DECK.d / 6 - .012), mat(i % 2 ? '#c99d70' : '#b98d62')), 0, .025, -DECK.d / 2 + (i + .5) * DECK.d / 6));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) dk.add(at(new THREE.Mesh(new THREE.BoxGeometry(.06, .9, .06), mat(C.white)), x * (DECK.w / 2 - .05), .47, z * (DECK.d / 2 - .05)));
  for (let i = 0; i < 5; i++) dk.add(at(new THREE.Mesh(new THREE.BoxGeometry(.04, .04, DECK.d + .16), mat(C.white)), -DECK.w / 2 + .08 + i * (DECK.w - .16) / 4, .94, 0));
  for (let i = 0; i < 16; i++) { const v = new THREE.Mesh(new THREE.IcosahedronGeometry(.06 + rnd() * .06, 0), mat(rnd() < .55 ? G.leaf : G.leafD)); v.position.set((rnd() - .5) * DECK.w, .96 + rnd() * .05, (rnd() - .5) * DECK.d); v.userData.lineW = .004; dk.add(v); if (i % 2 === 0) { const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(.035, 0), mat(i % 4 ? '#c9b6e4' : G.pink)); fl.position.copy(v.position).add(new THREE.Vector3(0, -.07, 0)); fl.userData.noLine = true; dk.add(fl); } }
  for (const [x, z] of [[-1, -1], [1, 1]]) for (let k = 0; k < 4; k++) { const v = new THREE.Mesh(new THREE.IcosahedronGeometry(.05, 0), mat(G.leaf)); v.position.set(x * (DECK.w / 2 - .05) + (rnd() - .5) * .08, .2 + k * .2, z * (DECK.d / 2 - .05) + (rnd() - .5) * .08); v.userData.noLine = true; dk.add(v); }
  const bench = new THREE.Group(); bench.add(at(new THREE.Mesh(new THREE.BoxGeometry(.7, .045, .22), mat('#9a6b4c')), 0, .22, 0)); bench.add(at(new THREE.Mesh(new THREE.BoxGeometry(.7, .2, .035), mat('#9a6b4c')), 0, .36, -.1)); for (const x of [-.3, .3]) bench.add(at(new THREE.Mesh(new THREE.BoxGeometry(.045, .22, .2), mat('#7c5639')), x, .11, 0)); bench.position.set(0, .05, -.3); dk.add(bench);
  world.add(dk);
  T.mark('b-props'); await yieldUI();
  /* 园子里三盏小灯：白天是灯柱，夜里亮（点光源在 setupSky 里） */
  const lampGlass = mat('#fff3d6', { emissive: new THREE.Color('#ffb060'), emissiveIntensity: .25 });
  for (const [x, z] of [[GATE.x - 1.15, GATE.z - .75], [POND.x - .75, POND.z - .45], [DECK.x - .6, DECK.z + .7]]) {
    world.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.018, .028, .62, 6), mat(C.iron)), x, .4, z));
    const gl = new THREE.Mesh(new THREE.BoxGeometry(.1, .12, .1), lampGlass); gl.position.set(x, .76, z); gl.userData.lineW = .004; world.add(gl);
    world.add(at(new THREE.Mesh(new THREE.ConeGeometry(.09, .06, 4), mat(C.iron)), x, .85, z));
  }
  /* —— 住人的样子：花树探到店和平台上方、店墙爬白蔷薇、蓝色飞燕草三五一丛、
     石子路边大小不一的圆球、门口一棵陶盆柠檬树和几只陶罐、桌子底下一块木平台、藤编椅 —— */
  { const t1 = bloomTree(3.4, 61, ['#f2b8c8', '#f6c9d5', '#fadde5']);   /* 花树只留一种柔粉，两三棵 */ t1.position.set(SHOP.x + 2.0, .09, SHOP.z - .9); world.add(t1);
  }
  { /* 店墙上的白蔷薇：一片叶团里开满小白花，从墙根爬到二楼 */
    const fz = SHOP.z + .64 * SHOP.s + .03, F = forms();
    for (let i = 0; i < 46; i++) { const x = SHOP.x - .95 * SHOP.s + rnd() * .62, y = .25 + Math.pow(rnd(), .8) * 2.0, z = fz + rnd() * .05; const l = new THREE.Mesh(new THREE.IcosahedronGeometry(.07 + rnd() * .05, 0), mat(rnd() < .5 ? G.leaf : G.leafD)); l.position.set(x, y, z); l.userData.noLine = true; world.add(l); if (rnd() < .75) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(.035, 0), mat(rnd() < .85 ? '#fbfaf4' : '#f7dde6')); f.position.set(x + (rnd() - .5) * .06, y + .03, z + .05); f.userData.noLine = true; world.add(f); } }
  }
  { /* 桌子底下一块小木平台，椅子换成藤编色 */
    for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, .05, .2), mat(i % 2 ? '#c99d70' : '#b98d62')); b.position.set(TABLE.x, .115, TABLE.z - .6 + i * .2); b.rotation.y = .5; world.add(b); }
  }
  { /* 路边的修剪圆球，大小不一 */
    [[.35, .2], [.55, .14], [.68, .11], [.82, .17], [.92, .12]].forEach(([t, r0], i) => { const p = PATH_MAIN.getPointAt(t), tg = PATH_MAIN.getTangentAt(t), sd = i % 2 ? 1 : -1, x = p.x - tg.z * sd * (.42 + r0), z = p.z + tg.x * sd * (.42 + r0); if (!inPoly(x, z) || inShop(x, z)) return; const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r0, 2), mat(i % 2 ? '#4f8a48' : '#5a9450')); b.position.set(x, .09 + r0 * .92, z); b.userData.lineW = .006; world.add(b); });
  }
  { /* 陶盆柠檬树（门口）和三只陶罐 */
    const terra = mat('#c8714a'), terraD = mat('#a95a3a');
    const pot = (x, z, s) => { const pts = [[0, 0], [.1, 0], [.12, .03], [.15, .18], [.17, .2], [.17, .22], [0, .22]].map(([a, b]) => new THREE.Vector2(a * s, b * s)); const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 12), terra); m.position.set(x, .1, z); m.userData.lineW = .005; world.add(m); return .1 + .22 * s; };
    const urn = (x, z, s) => { const pts = [[0, 0], [.08, 0], [.12, .06], [.15, .16], [.13, .27], [.08, .32], [.1, .36], [0, .36]].map(([a, b]) => new THREE.Vector2(a * s, b * s)); const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 12), rnd() < .5 ? terra : terraD); m.position.set(x, .1, z); m.userData.lineW = .005; world.add(m); };
    const lx = DOOR.x + .55, lz = DOOR.z + .35, top = pot(lx, lz, 1.1);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(.012, .016, .45, 5), mat('#8a6a52')); tr.position.set(lx, top + .22, lz); world.add(tr);
    const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(.2, 1), mat(G.leafD)); cr.position.set(lx, top + .55, lz); cr.userData.lineW = .006; world.add(cr);
    for (let i = 0; i < 8; i++) { const a = rnd() * 6.28, e = rnd() * 1.3 - .3, f = new THREE.Mesh(new THREE.SphereGeometry(.03, 6, 4), mat('#ffd23a')); f.position.set(lx + Math.cos(a) * Math.cos(e) * .2, top + .55 + Math.sin(e) * .17, lz + Math.sin(a) * Math.cos(e) * .2); f.userData.noLine = true; world.add(f); }
    urn(TABLE.x + .75, TABLE.z - .55, .65); urn(TABLE.x - .7, TABLE.z + .5, .65); urn(DECK.x - .95, DECK.z + .45, .65);   /* 池边那只挪开，别埋进花里 */
  }
  /* 树：店后面一棵大的给纵深；外面一圈矮灌木小树把园子的边吃进去 */
  const big = tree2(3.6, 3); big.position.set(-2.6, .09, -4.15); world.add(big);
  /* 开花的树：樱粉、白、淡紫、金合欢黄，种在园子边和去村子的小路边 */
  for (const [x, z, h, sd, cols] of [[-6.4, -2.4, 2.6, 41, ['#f2b8c8', '#f6c9d5', '#fadde5']]]) { const t = bloomTree(h * 1.1, sd, cols); t.position.set(x, inPoly(x, z) ? .09 : HAT(x, z), z); world.add(t); }
  /* 外面的树减半、聚成三小簇，中间留空；篱笆外留一圈干净的草地 */
  for (const [x, z, h, sd] of [[-6.6, -1.0, 1.7, 21], [-7.2, -.1, 2.1, 22], [-.2, -5.7, 2.3, 26], [.9, -6.1, 1.8, 27], [7.0, 2.8, 1.6, 32]]) { const t = tree2(h, sd); t.position.set(x, HAT(x, z), z); world.add(t); }
  for (const [x, z, s] of [[-6.2, -1.5, .42], [-6.9, .6, .38], [.4, -5.3, .44], [6.6, 2.2, .38], [7.6, -2.6, .34]]) world.add(shrub(x, z, s, [G.leaf, G.leafD, G.leafL], rnd() < .4 ? [G.pink, C.white] : null));
  T.mark('b-trees'); await yieldUI();
  buildFarm(world);
  T.mark('b-farm'); await yieldUI(); stage = '合并网格';
  bake(world); T.mark('bake'); await yieldUI(); stage = '描边';
  outline(world); T.mark('outline'); shadowAll(world); S.add(world);
  await yieldUI(); stage = '花境'; fillBeds(); T.mark('beds');
}

/* —— 侧门出去的田：照记忆小镇的田，但地块大小不一（窄的宽的）、状态不一（新翻的土、出苗、长着小镇作物、歇着的地），土色浅一档，栅栏高低不齐、有缺口 —— */
function buildFarm(world) {
  /* 田照记忆小镇 town/index.html 的田原样画：
     方块地、两色土、三道垄沟、一格一株作物——同一种作物挨在一起、都长得旺（小镇是按主题排的，熟的多）；
     田底下垫一块土地（不是草），田口一条土路接侧路；角上照小镇那口井和一圈花圃、田边一个稻草人、两卷草垛 */
  const farm = new THREE.Group(), P = FR.P;
  const KINDS = ['心动', '心动', '心动', '远方', '远方', '远方', '朋友', '朋友', '游戏', '游戏', '游戏', '创作', '创作', '工作', '工作', '居家', '居家', '居家'];
  const COLS = 6, ROWS = 3, TS = .9, FX = 10.85, FZ = -.45, fw = COLS * TS, fd = ROWS * TS;
  /* 田底下那块土：圆角、比田大一圈，颜色跟小镇田边的地一样偏土黄 */
  const pad = new THREE.Mesh(new RoundedBoxGeometry(fw + 1.6, .04, fd + 1.4, 3, .3), wash('#cdbb8a', { rep: [2, 1], seed: 21, blots: 20 })); pad.position.set(FX + .25, .02, FZ); pad.userData.noLine = true; farm.add(pad);
  /* 夜里田别洗成灰：土用自己的材质，夜里加一点暖棕的自发光（applySky 里调） */
  const soilA = mat('#8a6a4c', { name: 'farmA' }), soilB = mat('#957459', { name: 'farmB' }), furrow = mat('#6e5238', { name: 'farmF' });
  FARM_SOIL.push(soilA, soilB, furrow, pad.material);
  for (let k = 0; k < COLS * ROWS; k++) {
    /* 按列排：同一种作物竖着挨在一起 */
    const c = Math.floor(k / ROWS), r = k % ROWS, x = FX - fw / 2 + TS / 2 + c * TS, z = FZ - fd / 2 + TS / 2 + r * TS;
    const tile = new THREE.Mesh(new RoundedBoxGeometry(TS - .07, .1, TS - .07, 2, .03), (c + r) % 2 ? soilA : soilB); tile.position.set(x, .07, z); tile.userData.lineW = .006; farm.add(tile);
    for (const dz of [-.2, 0, .2]) { const f = new THREE.Mesh(new THREE.BoxGeometry(TS - .2, .012, .03), furrow); f.position.set(x, .125, z + dz); f.userData.noLine = true; farm.add(f); }
    const pl = TM.plant({ kind: 'mem', w: 10 + (k % 3) * 1.5, domain: [KINDS[k]], id: 'farm' + k }, k); pl.position.set(x, .12, z); pl.scale.multiplyScalar(1.35); farm.add(pl);
  }
  const x0 = FX - fw / 2 - .2, x1 = FX + fw / 2 + .2, z0 = FZ - fd / 2 - .2, z1 = FZ + fd / 2 + .2;
  for (const [ax, az, bx, bz, gap] of [[x0, z0, x1, z0, 0], [x1, z0, x1, z1, 0], [x0, z1, x1, z1, 0], [x0, z0, x0, z1, 1]]) {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(len / .45));
    for (let i = 0; i <= n; i++) { const t = i / n; if (gap && Math.abs(t - .5) < .07) continue; const p = new THREE.Mesh(new THREE.BoxGeometry(.05, .26, .05), mat('#c9a77a')); p.position.set(ax + (bx - ax) * t, .15, az + (bz - az) * t); p.userData.lineW = .003; farm.add(p); }
    for (const seg of gap ? [[0, .43], [.57, 1]] : [[0, 1]]) {
      const sx = ax + (bx - ax) * seg[0], sz = az + (bz - az) * seg[0], ex = ax + (bx - ax) * seg[1], ez = az + (bz - az) * seg[1], l2 = Math.hypot(ex - sx, ez - sz);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(l2, .03, .03), mat('#c9a77a')); rail.position.set((sx + ex) / 2, .22, (sz + ez) / 2); rail.rotation.y = -Math.atan2(ez - sz, ex - sx); rail.userData.lineW = .003; farm.add(rail);
    }
  }
  /* 田口土路：从侧路那头接到栅栏口 */
  const dirt = mat('#b39270');
  const pth = new THREE.Mesh(new THREE.BoxGeometry(.9, .03, .8), dirt); pth.position.set(x0 - .35, .045, FZ); pth.userData.lineW = .006; farm.add(pth);
  /* 井和一圈花圃（小镇原样） */
  const WX0 = x1 + .25, WZ0 = z0 - 1.05;
  const bedR = new THREE.Mesh(new THREE.CylinderGeometry(.95, .95, .07, 32), mat('#8a6a4c')); bedR.position.set(WX0, HAT(WX0, WZ0) + .035, WZ0); bedR.userData.lineW = .008; farm.add(bedR);
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28 + .3, x = WX0 + Math.cos(a) * .72, z = WZ0 + Math.sin(a) * .72; const pl = TM.plant({ kind: 'feel', w: 12, id: 'wf' + i }, i); pl.position.set(x, HAT(WX0, WZ0) + .07, z); pl.scale.multiplyScalar(1.4); farm.add(pl); }
  const well = new THREE.Group(); well.position.set(WX0, HAT(WX0, WZ0) + .07, WZ0); farm.add(well);
  const wb = new THREE.Mesh(new THREE.CylinderGeometry(.32, .35, .4, 16, 1, true), mat('#ffffff', { map: washTex(P.stone, { seed: 5, blots: 20 }), side: THREE.DoubleSide })); wb.position.y = .2; well.add(wb);
  const ww = new THREE.Mesh(new THREE.CircleGeometry(.3, 16), mat(P.waterD)); ww.rotation.x = -Math.PI / 2; ww.position.y = .24; ww.userData.noLine = true; well.add(ww);
  for (const sx of [-1, 1]) { const po = new THREE.Mesh(new THREE.BoxGeometry(.05, .7, .05), mat(C.wood)); po.position.set(sx * .31, .55, 0); well.add(po); }
  const wr = new THREE.Mesh(new THREE.ConeGeometry(.48, .26, 4), mat(P.terra)); wr.rotation.y = Math.PI / 4; wr.position.y = 1.02; well.add(wr);
  const bk = new THREE.Mesh(new THREE.CylinderGeometry(.06, .05, .1, 10), mat('#9a6b4c')); bk.position.set(.12, .55, 0); well.add(bk);
  /* 井边一盏小灯，夜里亮 */
  { const lx = FARM_LAMP.x, lz = FARM_LAMP.z, y0 = HAT(lx, lz); farm.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.018, .028, .62, 6), mat(C.iron)), lx, y0 + .31, lz)); const gl = new THREE.Mesh(new THREE.BoxGeometry(.1, .12, .1), mat('#fff3d6', { emissive: new THREE.Color('#ffb060'), emissiveIntensity: .25 })); gl.position.set(lx, y0 + .67, lz); gl.userData.lineW = .004; farm.add(gl); farm.add(at(new THREE.Mesh(new THREE.ConeGeometry(.09, .06, 4), mat(C.iron)), lx, y0 + .76, lz)); }
  /* 稻草人插在田边（小镇原样） */
  const sc = new THREE.Group(); sc.position.set(x1 + .55, .04, FZ + .5); farm.add(sc);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .9, 6), mat(C.wood)); sp.position.y = .45; sc.add(sp);
  const sa = new THREE.Mesh(new THREE.BoxGeometry(.6, .04, .04), mat(C.wood)); sa.position.y = .62; sc.add(sa);
  const sb = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .14), mat('#6d7888')); sb.position.y = .6; sc.add(sb);
  const sh = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), mat('#e9d7a8')); sh.position.y = .88; sc.add(sh);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(.2, .14, 12), mat('#d9b25e')); hat.position.y = 1.0; sc.add(hat);
  /* 两卷草垛 */
  for (const [x, z] of [[x1 + .45, z0 + .2], [x1 + .5, z0 + .55]]) { const hb = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .22, 14), mat('#e2c27a')); hb.rotation.z = Math.PI / 2; hb.position.set(x, .17, z); farm.add(hb); }
  world.add(farm);
}

/* 花境：三大团，每团自己的几种颜色，高低三层（后面高的毛地黄/飞燕草、中间薰衣草绣球、前面贴地小花），堆满溢出；前面那片草坪留空 */
function fillBeds() {
  const d = new THREE.Object3D();
  const spike = floretSpike(.36, .024, 7);
  const tall = floretSpike(.58, .036, 9);
  const ball = new THREE.IcosahedronGeometry(.1, 1);
  const dot = new THREE.IcosahedronGeometry(.038, 0);
  const bush = new THREE.IcosahedronGeometry(.14, 1);
  const tuft = bladeTuft();
  const lists = new Map();
  const put = (geo, color, x, z, y, s, tilt = .35) => {
    if (!inPoly(x, z) || inShop(x, z, -.05) || pathDist(x, z) < .2 || Math.hypot(x - POND.x, z - POND.z) < POND.r + .1 || nearDeck(x, z, -.05)) return;
    d.position.set(x, y, z); d.rotation.set((rnd() - .5) * tilt, rnd() * 3, (rnd() - .5) * tilt); d.scale.setScalar(s); d.updateMatrix();
    const key = geo.uuid + color; if (!lists.has(key)) lists.set(key, { geo, color, m: [] }); lists.get(key).m.push(d.matrix.clone());
  };
  const F = forms();
  const putForm = (fname, c, x, z, y, sc, free = false) => { const f = F[fname]; const ry = rnd() * 6.28, tl = (rnd() - .5) * .18; for (const [geo, role] of f.parts) { if (!free && (!inPoly(x, z) || inShop(x, z, -.05) || pathDist(x, z) < .2 || Math.hypot(x - POND.x, z - POND.z) < POND.r + .1 || nearDeck(x, z, -.05))) return; d.position.set(x, y, z); d.rotation.set(tl, ry, 0); d.scale.setScalar(sc * f.w); d.updateMatrix(); const col = partColor(role, c), key = geo.uuid + col; if (!lists.has(key)) lists.set(key, { geo, color: col, m: [] }); lists.get(key).m.push(d.matrix.clone()); } };
  /* 三层：后面骨架（柏、圆球、偶尔一棵柠檬树）、中间（绣球、鼠尾草和毛地黄的竖线、成片雏菊、白色伞形花、玫瑰石竹）、
     前面（羽毛草、银叶垫、贴地小花垫漫到路上、迷迭香）。颜色成块：顺着花境一段一个颜色 */
  const LAYER = {
    back: [['cypress', .05], ['topiary', .26], ['tall', .14], ['spike', .12], ['lemon', .04], ['mound', .2], ['umbel', .12]],
    mid: [['mound', .2], ['spike', .12], ['daisy', .22], ['umbel', .14], ['rose', .1], ['carnation', .08], ['airy', .06], ['cosmos', .08]],
    front: [['ground', .45], ['daisy', .25], ['silver', .12], ['feather', .1], ['rosemary', .08]],
  };
  const COLOR_FOR = { topiary: ['#4f8a48', '#5a9450'], lemon: ['#ffd23a'], silver: ['#aebfb4'], feather: ['#d8d0a8', '#cfc79a'], rosemary: ['#5f8a63'] };
  MASSES.forEach((M) => {
    const P = M.P;
    /* 色块：一块 11 个点，白色只给 5 个点当隔断 */
    const BLK = []; { let ci = 0; while (BLK.length < P.length) { const c = M.col[ci % 4], n = c === '#fbf6ec' ? 5 : 11; for (let j = 0; j < n; j++) BLK.push([c, M.col[(ci + 1) % 4]]); ci++; } }
    P.forEach(([px, pz], i) => {
      const q = P[Math.min(P.length - 1, i + 1)], o = P[Math.max(0, i - 1)], tx = q[0] - o[0], tz = q[1] - o[1], tl = Math.hypot(tx, tz) || 1;
      let nx = -tz / tl, nz = tx / tl;
      /* 「后面」朝哪边：左篱笆那团朝篱笆外、店脚下那团朝店、池边那团背着池子 */
      const outX = M.name === 'pond' ? px - POND.x : M.name === 'left' ? px : 0, outZ = M.name === 'pond' ? pz - POND.z : M.name === 'left' ? pz : -1;
      if (nx * outX + nz * outZ < 0) { nx = -nx; nz = -nz; }
      const [block, nextC] = BLK[i];
      for (let k = 0; k < 12; k++) {
        const t = k < 9 ? rnd() * 2 - 1 : -.3 + rnd() * .65, along = (rnd() - .5) * .12, x = px + nx * t * M.w + (tx / tl) * along, z = pz + nz * t * M.w + (tz / tl) * along;
        const layer = t > .35 ? 'back' : t < -.3 ? 'front' : 'mid'; let f = pickForm(LAYER[layer], rnd()); if (f === 'cypress' && i % 9 !== 0) f = 'topiary'; if (M.name === 'pond' && (f === 'silver' || f === 'cypress')) f = f === 'silver' ? 'ground' : 'mound';   /* 池子后面别有一块块灰的「石头」 */
        if (layer !== 'front' && k % 3 === 0) put(bush, rnd() < .5 ? G.leaf : G.leafD, x, z, .12, .6 + rnd() * .4, 0);
        const cf = COLOR_FOR[f]; putForm(f, cf ? cf[Math.floor(rnd() * cf.length)] : (rnd() < .92 ? block : nextC), x, z, .1, layer === 'back' ? 1 + rnd() * .35 : .85 + rnd() * .4);
      }
    });
  });
  /* 蓝色飞燕草：三五支一组，高高地立在后排 */
  for (const [gx, gz] of [[-3.75, 1.6], [-3.4, 3.2], [-3.9, -.6], [3.25, 2.25], [1.95, 1.05], [-.2, -.25]]) { const n = 3 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) { const a = rnd() * 6.28, r = rnd() * .16; putForm('tall', ['#5f7fd8', '#7b95e4', '#4f6cc8'][i % 3], gx + Math.cos(a) * r, gz + Math.sin(a) * r, .1, 1.15 + rnd() * .35); } }
  /* 点睛的几丛：每团花境里两三处颜色鲜亮的（苹果 💐 那种饱和度），跟周围柔的对比 */
  const ACC = { left: ['#8a4fd8', '#ff4f8b'], shop: ['#ee3340', '#ff4f8b', '#ffc21a'], pond: ['#ffc21a', '#ff7aa8'] };
  MASSES.forEach((M) => {
    const cols = ACC[M.name];
    for (let j = 0; j < (M.name === 'left' ? 3 : 2); j++) {
      const [px, pz] = M.P[Math.floor((j + .5) / 3 * M.P.length)], c = cols[j % cols.length];
      for (let i = 0; i < 12; i++) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * .2, x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r; put(bush, '#5fae4a', x, z, .12, .6 + rnd() * .3, 0); putForm(['rose', 'tulip', 'daisy', 'peony'][(i + j) % 4], c, x, z, .1, 1 + rnd() * .3); if (i % 5 === 0) put(tall, c, x, z, .1, .9 + rnd() * .4, .1); }
    }
  });
  /* 园子外面的草地：零星野花点和草丛，避开园子、田和路，越往外越稀 */
  const outerOK = (x, z) => !inPoly(x, z) && edgeDist(x, z) > .45 && !(x > 7.4 && x < 14.4 && z > -3.4 && z < 1.6) && !(x > 3.2 && x < 11.6 && z > -10 && z < -5.2) && pathDist(x, z) > .3 && HAT(x, z) > .02;
  for (let i = 0; i < 900; i++) { const a = rnd() * 6.28, r = 4.5 + Math.pow(rnd(), 1.6) * 11, x = Math.cos(a) * r + 1.5, z = Math.sin(a) * r * .9; if (!outerOK(x, z)) continue; const u = rnd(); d.position.set(x, HAT(x, z) + .01, z); d.rotation.set((rnd() - .5) * .4, rnd() * 3, 0); d.scale.setScalar(u < .62 ? .5 + rnd() * .6 : .6 + rnd() * .5); d.updateMatrix(); const key = u < .62 ? 'oT' : 'oD' + Math.floor(rnd() * 4); if (!lists.has(key)) lists.set(key, { geo: u < .62 ? tuft : dot, color: u < .62 ? '#9cc87a' : ['#ffffff', '#ffd75e', '#f6a8c4', '#c9b6e8'][+key.slice(2)], m: [] }); lists.get(key).m.push(d.matrix.clone()); }
  /* 零散的小花：草坪边上和篱笆外一片片不成行的小花，颜色一片一种为主 */
  const DRIFT_C = ['#fbf6ec', '#ffd75e', '#f6a8c4'], DRIFT_F = ['daisy', 'ground', 'umbel', 'tulip', 'cosmos', 'ground', 'daisy'];
  for (let k = 0; k < 34; k++) {
    let cx, cz, t = 0; do { const a = rnd() * 6.28, r = 2.2 + rnd() * 6.5; cx = Math.cos(a) * r + .8; cz = Math.sin(a) * r * .95; t++; } while (t < 20 && !(inPoly(cx, cz) ? false : (HAT(cx, cz) > .03 && pathDist(cx, cz) > .4 && !(cx > 7.6 && cx < 13.2 && cz > -2.4 && cz < 1.4))));
    const c1 = DRIFT_C[k % DRIFT_C.length], c2 = c1, n = 10 + Math.floor(rnd() * 14), sx = .3 + rnd() * .5, sz = .2 + rnd() * .35, rot = rnd() * 3;
    for (let i = 0; i < n; i++) { const u = (rnd() - .5) * 2, w = (rnd() - .5) * 2; const x = cx + (u * sx) * Math.cos(rot) - (w * sz) * Math.sin(rot), z = cz + (u * sx) * Math.sin(rot) + (w * sz) * Math.cos(rot); const inside = inPoly(x, z); if (inside || HAT(x, z) < .03 || edgeDist(x, z) < .4) continue; const y = inside ? .09 : HAT(x, z); putForm(DRIFT_F[(k + Math.floor(rnd() * 2)) % DRIFT_F.length], rnd() < .78 ? c1 : c2, x, z, y, .7 + rnd() * .5, true); }
  }
  /* 草坪上零星草丛，不碰花境 */
  for (let i = 0; i < 360; i++) { const x = (rnd() - .5) * 8.6, z = (rnd() - .5) * 7.8; put(tuft, G.grassD, x, z, .09, .5 + rnd() * .7); }
  for (const { geo, color, m } of lists.values()) { const im = new THREE.InstancedMesh(geo, geo === tuft ? mat(color, { side: THREE.DoubleSide }) : mat(color), m.length); m.forEach((mm, i) => im.setMatrixAt(i, mm)); im.castShadow = geo !== tuft; im.receiveShadow = true; S.add(im); }
}

// ---------- 花：小苗 → 抽枝 → 开花 → 枯萎 ----------
let petalGeo = null;
function petal() {   /* 樱花那样的瓣：根窄梢宽，梢上一个小缺口，往上兜，两侧带一点波 */
  if (petalGeo) return petalGeo;
  const s = new THREE.Shape(); s.moveTo(0, 0);
  s.bezierCurveTo(.05, .03, .075, .1, .06, .15); s.lineTo(.012, .135); s.lineTo(0, .148); s.lineTo(-.012, .135); s.lineTo(-.06, .15); s.bezierCurveTo(-.075, .1, -.05, .03, 0, 0);
  const g = new THREE.ShapeGeometry(s, 6), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, x * x * 6 + Math.sin(y * 40) * .004 * Math.abs(x) * 20); }
  g.computeVertexNormals(); return petalGeo = g;
}
function stageOf(f) { const d = (Date.now() - f.at) / DAY; if (f.hybrid) return d < 1 ? 0 : d < 2 ? 1 : d < 14 ? 2 : 3;   /* 杂交苗长得快一点：第三天就开 */
  return d < 1 ? 0 : d < 3 ? 1 : d < 14 ? 2 : 3; }
function makeFlower(f) {
  const g = new THREE.Group(), sway = new THREE.Group(); g.add(sway);
  /* 杂交花按基因：颜色、瓣数、重瓣、攒球、花头大小（Hy.paramsOf） */
  const P = f.hybrid || (f.species && !Hy.SPECIES[f.species]) ? Hy.paramsOf(Hy.genesOf(f)) : null;
  const ids = f.moods && f.moods.length ? f.moods : [f.mood], cs = P ? [vivid(P.hex)] : ids.map((id) => id === 'calm' ? '#7fa8f0' : vivid(COLORS[id] || '#e98aa4'));
  const st = stageOf(f), wild = !!f.wild, dead = st === 3, calm = P ? P.cluster : ids[0] === 'calm' && !wild;
  const fade = (c) => dead ? '#' + new THREE.Color(c).lerp(new THREE.Color('#a88a68'), .55).getHexString() : c;
  const leafM = mat(dead ? '#a8925e' : C.leaf, { side: THREE.DoubleSide });
  const leaf = (y, a, s = 1) => { const l = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), leafM); l.scale.set(.06 * s, .014, .028 * s); l.position.set(Math.cos(a) * .05 * s, y, Math.sin(a) * .05 * s); l.rotation.y = -a; l.rotation.z = dead ? -.5 : .4; l.userData.lineW = .003; sway.add(l); };
  if (st === 0) { leaf(.03, 0, .8); leaf(.03, Math.PI, .8); const s0 = new THREE.Mesh(new THREE.CylinderGeometry(.006, .008, .06, 5), leafM); s0.position.y = .03; s0.userData.noLine = true; sway.add(s0); }
  else {
    const h = st === 1 ? .22 : dead ? .26 : .34;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.007, .01, h, 5), leafM); stem.position.y = h / 2; stem.userData.noLine = true; sway.add(stem);
    leaf(h * .3, .3); leaf(h * .55, 3.4);
    const head = new THREE.Group(); head.position.y = h; head.scale.setScalar(wild ? 1 : .21 * (P ? P.scale : 1)); sway.add(head);   /* 日记花高一个头可以，花头最多是花境的 1.6 倍 */
    if (st === 1) { const bud = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), mat(cs[0])); bud.scale.y = 1.4; bud.position.y = .02; bud.userData.lineW = .003; head.add(bud); const cal = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), leafM); cal.scale.y = .6; cal.userData.noLine = true; head.add(cal); }
    else {
      if (dead) {
        /* 枯了：花瓣落光，只剩一个干花头和两片卷起来的瓣挂着（v3 那样整朵耷拉着像蛾子） */
        sway.rotation.x = .1; head.rotation.z = .5;
        const sh = new THREE.Mesh(new THREE.SphereGeometry(.026, 8, 6), mat('#8a6e50')); sh.scale.y = .8; sh.userData.lineW = .002; head.add(sh);
        for (let i = 0; i < 2; i++) { const cp = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), mat(fade(cs[i % cs.length]))); cp.scale.set(.012, .03, .008); cp.position.set((i ? -1 : 1) * .02, -.025, 0); cp.rotation.z = (i ? -1 : 1) * .3; cp.userData.noLine = true; head.add(cp); }
      } else {
      /* 几个心情就几种颜色，一瓣一瓣轮着来 */
      const bloom = (host, s, np, k0 = 0) => {
        for (let i = 0; i < np; i++) { const a = i / (P && !dead ? np : 5) * Math.PI * 2 + (dead ? .4 : 0); const pv = new THREE.Group(); pv.rotation.y = a; const m = new THREE.Mesh(petal(), mat(fade(cs[(i + k0) % cs.length]), { side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2 + (dead ? -.15 : .55); m.scale.setScalar(s * (dead ? .85 : 1)); m.userData.noLine = true; pv.add(m); host.add(pv); }
        const ctr = new THREE.Mesh(new THREE.SphereGeometry(.022 * s, 8, 6), mat(dead ? '#8a6e50' : calm ? '#f4f0e8' : C.seed)); ctr.scale.y = .6; ctr.userData.lineW = .002; host.add(ctr);
      };
      if (calm) {
        /* 蓝雪花：七八朵五瓣小花攒成一个球 */
        const n = dead ? 4 : 8;
        for (let i = 0; i < n; i++) { const a = i * 2.4, r = i ? .045 : 0, fl = new THREE.Group(); fl.position.set(Math.cos(a) * r, (i ? 0 : .02) + rnd() * .015, Math.sin(a) * r); fl.rotation.set(Math.sin(a) * .5, 0, Math.cos(a) * .5); bloom(fl, .42, dead ? 4 : 5, i); head.add(fl); }
      } else { bloom(head, 1, dead ? 4 : P ? P.n : 5); if (P && P.dbl && !dead) { const inner = new THREE.Group(); inner.rotation.y = Math.PI / P.n; inner.position.y = .012; inner.scale.setScalar(.68); head.add(inner); bloom(inner, 1, P.n); } }
      }
    }
  }
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .45, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .22; hit.userData.noLine = true; g.add(hit);
  g.scale.setScalar(wild ? 1.5 : 2.3); g.position.set(f.x, .09, f.z);
  g.userData = { f, sway, hit, ph: Math.random() * 6 }; hit.userData.root = g;
  bake(sway); outline(g, { w: .004 }); shadowAll(g);
  return g;
}
/* 拖花：落不下的地方就停在上一个能落的位置 */
export function load(list) {
  if (!flowerRoot) return;
  WX = weatherOf(list); applySky();
  dropGeos(flowerRoot); flowerRoot.clear(); flowers = []; shadowsDirty(); wake(600);
  sproutsInto(list);
  list.forEach((f, i) => {
    if (!f.hybrid && (f.x == null || !okSpot(f.x, f.z))) { const [x, z] = bedSpot(i); f.x = x; f.z = z; dispatchEvent(new CustomEvent('flower-moved', { detail: f })); }
    try { const o = makeFlower(f); flowers.push(o); flowerRoot.add(o); } catch (e) { console.error(e); status('有一朵花没种上：' + (e && e.message || e)); }
  });
}
export function snapshot() { LOOK.render(S, CAM); return R.domElement.toDataURL('image/jpeg', .9); }
/* 明信片上那朵花：单拎出来放在纸上拍一张，按开花那几天的样子，不拍苗也不拍枯的 */
export function flowerShot(f, w, h, paper) {
  const sc = new THREE.Scene(); sc.background = new THREE.Color(paper);
  sc.add(new THREE.HemisphereLight('#f4f6ff', '#d9d2c0', 1.5));
  const sun = new THREE.DirectionalLight('#fff0d8', 2.4); sun.position.set(-1.6, 4.2, 1.2); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 6; sun.shadow.bias = -.0006; sun.shadow.normalBias = .02;
  const scm = sun.shadow.camera; scm.left = scm.bottom = -1.2; scm.right = scm.top = 1.2; scm.near = .1; scm.far = 10; sc.add(sun);
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: .1 })); gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true; sc.add(gr);
  const o = makeFlower({ ...f, wild: false, at: Date.now() - 6 * DAY, x: 0, z: 0 }); o.position.set(0, 0, 0); o.rotation.y = .5; sc.add(o);
  o.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(o.userData.sway, true), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  /* 整株摆在纸上，像博物馆拍器物：居中、四周留空、斜上方看下去，看得见花脸和一道长影子 */
  const vh = Math.max(sz.y * 1.25, sz.x * 1.9 * h / w), cy = c.y + sz.y * .06, dist = vh / 2 / Math.tan(11 * Math.PI / 180);
  const cam = new THREE.PerspectiveCamera(22, w / h, .05, 50); cam.position.set(c.x + dist * .15, cy + dist * .62, c.z + dist * .8); cam.lookAt(c.x, cy, c.z);
  const pr = R.getPixelRatio(); R.setPixelRatio(1); R.setSize(w, h, false); shadowsDirty(); R.render(sc, cam); shadowsDirty();
  const url = R.domElement.toDataURL('image/png');
  R.setPixelRatio(pr); R.setSize(innerWidth, innerHeight, false); LOOK.resize(); return url;
}

// ---------- 点花、拖花 ----------
function bindPointer(el) {
  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'touchstart', 'touchmove']) el.addEventListener(ev, () => wake(), { passive: true });
  let drag = null, down = null; const v = new THREE.Vector2(), p = new THREE.Vector3();
  const pick = (e) => { const r = el.getBoundingClientRect(); v.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(v, CAM); };
  let press = null;
  const cancelPress = () => { if (press) { clearTimeout(press); press = null; } };
  el.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY }; pick(e);
    const h = ray.intersectObjects(flowers.map((f) => f.userData.hit))[0];
    if (h) { drag = { o: h.object.userData.root, moved: false }; dragging = true; CTL.enabled = false; el.setPointerCapture(e.pointerId); return; }
    const hv = ray.intersectObjects(VASE_HITS)[0];   /* 长按园子里的一盆插花收回去，腾出花位 */
    if (hv) { const v = hv.object.userData.vase; press = setTimeout(() => { press = null; down = null; takeVase(v); }, 650); return; }
    const hc = ray.intersectObjects(CLUMP_HITS)[0];
    if (hc) { const b = hc.object.userData.bed; press = setTimeout(() => { press = null; down = null; removeBed(b); }, 650); }
  });
  el.addEventListener('pointermove', (e) => { if (press && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) cancelPress(); });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) return;
    drag.moved = true; pick(e);
    if (ray.ray.intersectPlane(groundPlane, p) && okSpot(p.x, p.z)) { drag.o.position.set(p.x, .17, p.z); shadowsDirty(); }
  });
  el.addEventListener('pointerup', (e) => {
    if (drag) {
      const o = drag.o, f = o.userData.f; o.position.y = .09; CTL.enabled = true; dragging = false; shadowsDirty();
      if (drag.moved) { f.x = o.position.x; f.z = o.position.z; dispatchEvent(new CustomEvent('flower-moved', { detail: f })); }
      else dispatchEvent(new CustomEvent('flower-pick', { detail: f }));
      drag = null; return;
    }
    cancelPress();
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
      dispatchEvent(new CustomEvent('flower-none'));
      pick(e);
      if (plantMode) { if (ray.ray.intersectPlane(groundPlane, p)) plantAt(p.x, p.z); down = null; return; }
      const hz = ray.intersectObjects(ZONES)[0];
      if (hz) goZone(hz.object.userData.zone); else if (away) goHome();
    }
    down = null;
  });
}
