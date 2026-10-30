// 店是背景不是主角：放大一倍，靠后排、左三分之一处，花园从它脚下往前往两边长，前面留一片空草坪
// 三大团花境（左篱笆一长条、店脚下、池边）堆满溢出，篱笆大半被灌木和藤吃掉；一条细细弯弯的石板路从拱门进来到店门，半路岔去花架，侧边小路出篱笆是田
// 配色清透：纸白地、干净的绿、粉色点缀；低角度太阳，受光面暖、影子冷而淡；后期水彩减半（look.js 是本目录自己那份）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, washTex, outline, shadowAll } from './shop/look.js';
import { makeLook } from './look.js';
import { buildHouse, C, archShape } from './shop/house.js';
import * as TM from './town/mem.js';
import * as LAND from './town/land.js';
import * as FR from './town/fr.js';
import * as SP from './town/species.js';   /* 应季菜（南瓜、栗子、柿子）照说明长，田里用 */
import * as AU from './autumn.js';   /* 秋天三样：南瓜趴在藤上、栗子挂刺壳、柿子顶着柿蒂，不再是圆球 */
import * as Day from './day.js';   /* 种子、花位、换天 */
import * as Hy from './hybrid.js';   /* 杂交：两盆挨着过一夜冒苗 */
import { buildFarHills } from './hills.js';   /* 远山 */
import { hang } from './hang.js';   /* 你的果树果子都悬着。小镇画完整株，这边给果子补枝补果柄（hang.js） */

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
  CTL = new OrbitControls(CAM, canvas); CTL.target.set(3.3, .3, -.6); CTL.enableDamping = true;
  CTL.minDistance = 9; CTL.maxDistance = 52; CTL.minPolarAngle = .45; CTL.maxPolarAngle = 1.05;
  /* 照 Hesperides：一指拖=贴着地面挪，双指=捏合缩放+转；鼠标左键挪、右键转、滚轮缩放 */
  CTL.enablePan = true; CTL.screenSpacePanning = false; CTL.panSpeed = 1;
  /* 斜着看地，屏幕上下一指对应的地面更长：前后那一截按俯角放大，手指底下那块地大致跟着手走 */
  { const up0 = CTL._panUp; if (up0) CTL._panUp = function (d, m) { const o = this.object.position, t = this.target, s = (o.y - t.y) / Math.max(1e-3, o.distanceTo(t)); return up0.call(this, d / Math.max(.35, s), m); }; }
  CTL.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  CTL.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  CTL.addEventListener('change', clampTarget);
  /* 低角度太阳：受光面暖，天光偏冷，影子长而淡 */
  HEMI = new THREE.HemisphereLight('#eef3ff', '#c7d3b4', 1.25); S.add(HEMI);
  const sun = SUN = new THREE.DirectionalLight('#ffeccf', 2.7); sun.position.set(-9, 6.5, 3.5); sun.target.position.set(1, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = sc.bottom = -12; sc.right = sc.top = 12; sc.near = .5; sc.far = 40;
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .02; sun.shadow.radius = 4; sun.shadow.intensity = .5; S.add(sun, sun.target);
  LOOK = makeLook(R, G.paper); LOOK.setTilt(.45, .5); LOOK.setWarm(.5);
  T.mark('setup'); stage = '盖园子';
  settleExpand();   /* 扩建：过了早上六点的先建好，田几排、花位几个都定下来再盖 */
  await buildWorld();
  flowerRoot = new THREE.Group(); S.add(flowerRoot);
  await yieldUI(); stage = '天色'; setupSky(); applySky(); setInterval(applySky, 60000); setupZones();
  await yieldUI(); stage = '种的花'; addHybridSp(); addSeasonalSp(); loadBeds(); setupPlantUI(); setupPowerUI(); loadVases(); breed(); setupField();
  addEventListener('resize', resize); resize();
  flushGlints(); applyPower(); shadowsDirty();
  await yieldUI(); stage = '编着色器'; try { if (R.extensions.has('KHR_parallel_shader_compile')) await R.compileAsync(S, CAM); } catch (e) {}   /* 能并行编的手机上不占主线程 */
  await yieldUI(); stage = '第一次画'; LOOK.render(S, CAM);   /* 先编一遍着色器，进门那一下不卡 */
  if (Q.has('perf')) window.__G = { R, S, CAM, LOOK, CTL, hat: (x, z) => HAT(x, z) };   /* 量性能用：?perf 才挂出来 */
  T.mark('render'); console.log('garden init', JSON.stringify(T.out), 'calls', R.info.render.calls, 'tris', R.info.render.triangles, 'geos', R.info.memory.geometries);
}
export function start() {
  started = true; wake(2000); if (!document.hidden) R.setAnimationLoop(loop);
  if (newSprouts) setTimeout(() => toast('盆边冒了一株苗'), 600);
  EXP_DONE.forEach((e, i) => setTimeout(() => toast(expDoneText(e)), 600 + (newSprouts ? 1900 : 0) + i * 1900));   /* 扩建好了，只说这一回 */
  if (Q.has('farm')) { const z = ZONES.find((m) => m.userData.zone.name === 'farm'); if (z) setTimeout(() => goZone(z.userData.zone), 400); }   /* 后厨「去田里收一收」带 ?farm 进来，直接飞到田边 */
}
/* —— 省电：最多 30 帧；切到后台整个停。手机 60/120Hz 的 rAF 都按时间取整。
   再凉一档：没人碰的时候，刚松手那二十秒 8 帧、再往后 5 帧（花晃、波光、水圈都是慢动作，看不出卡）；
   下雨 20 帧（以前一直 30）；面板盖着园子时 4 帧；省电档里没人碰就不画，有东西变了才补一帧 —— */
const PHONE = (() => { try { return matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 600; } catch (e) { return false; } })();
/* 省电档：localStorage diarytown_lowpower，'1' 自己开的、'0' 自己关的（不再自动开）、'a' 自动开的、没有就看手机吃不吃力 */
const LP_KEY = 'diarytown_lowpower';
let LP = (() => { try { return localStorage.getItem(LP_KEY) || ''; } catch (e) { return ''; } })();
if (!LP && !/[?&]perf\b/.test(location.search)) { try { if ((navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2)) LP = 'a'; } catch (e) {} }
const lowOn = () => LP === '1' || LP === 'a';
/* 手机上像素比 1.1（以前 1.25；水彩后期本来就有纸纹和晃动，看不出糊），省电档 0.9 */
function PIXEL_RATIO() { return Math.min(lowOn() ? (PHONE ? .9 : 1) : (PHONE ? 1.1 : 1.5), devicePixelRatio || 1); }
let started = false, lastT = 0, wakeUntil = 0, dragging = false, lastWindShadow = 0, lastAct = 0, needFrame = true;
const camPrev = new THREE.Vector3(), tgtPrev = new THREE.Vector3();
function wake(ms = 1500) { const n = performance.now(); wakeUntil = Math.max(wakeUntil, n + ms); lastAct = n; needFrame = true; }
function shadowsDirty() { if (R) R.shadowMap.needsUpdate = true; needFrame = true; }
const sheetOpen = () => !!document.querySelector('.sheet:not([hidden])');
function idleFps(now) {
  if (lowOn()) return 0;
  if (WX === 'wind') return 10;   /* 起风花晃得大，帧太少会一顿一顿 */
  if (sheetOpen()) return 4;
  return now - lastAct < 20000 ? 8 : 5;
}
function setLow(v) {
  LP = v; try { localStorage.setItem(LP_KEY, v); } catch (e) {}
  if (R && LOOK) applyPower();
}
/* 省电档：像素比降一档、后期少采几次样、不做 MSAA，波光、水圈、雨溅的小圈收起来，影子贴图 512、起风不跟着重算影子 */
const GLINT_PTS = [];
function applyPower() {
  const low = lowOn();
  R.setPixelRatio(PIXEL_RATIO()); R.setSize(innerWidth, innerHeight, false); LOOK.setLow(low); LOOK.resize();
  GLINT_PTS.forEach((p) => { p.visible = !low; p.material.uniforms.sz.value = R.getPixelRatio(); });
  if (RIPPLES) RIPPLES.forEach((r) => r.visible = !low);
  HILLS.forEach((h) => h.mist.visible = !low);   /* 山脚那圈雾纱是透明的大环，省电档收起来 */
  SPLASH.forEach((r) => r.visible = !low && WX === 'rain');
  const ms = low ? 512 : 1024;
  if (SUN && SUN.shadow.mapSize.x !== ms) { SUN.shadow.mapSize.set(ms, ms); if (SUN.shadow.map) { SUN.shadow.map.dispose(); SUN.shadow.map = null; } }
  shadowsDirty(); syncLowBtn();
}
/* 自动省电：拖着镜头的时候连着几秒都画不到 20 帧（或者一帧 JS 就要 28ms 以上），就换省电档，提醒一句 */
const PW = { n: 0, slow: 0 };
function perfWatch(dt, cost) {
  if (LP || Q.has('perf') || !dt || dt > 400) return;
  PW.n++; if (dt > 50 || cost > 28) PW.slow++;
  if (PW.n >= 90) { const slow = PW.slow > PW.n * .6; PW.n = PW.slow = 0; if (slow) { setLow('a'); toast('手机有点吃力，先换省电模式了（··· 里能关）'); } }
}
let lowBtn = null;
function syncLowBtn() { if (lowBtn) lowBtn.textContent = lowOn() ? '省电模式 · 开' : '省电模式 · 关'; }
function setupPowerUI() {
  const menu = document.getElementById('menu'); if (!menu) return;
  lowBtn = document.createElement('button'); lowBtn.className = 'go ghost'; lowBtn.id = 'mLow';
  lowBtn.onclick = () => { setLow(lowOn() ? '0' : '1'); toast(lowOn() ? '省电模式开了：画得省一点，手机凉一点' : '省电模式关了'); };
  const before = document.getElementById('mClear'); if (before) menu.insertBefore(lowBtn, before); else menu.appendChild(lowBtn);
  syncLowBtn();
}
/* 挪镜头的边：园子、店、田、村子、池子都在里面，再往外就是海，拖不出去；相机跟着平移同样一截，不跳 */
const PAN_BOX = { x0: -5, x1: 14.5, z0: -10, z1: 5.5 }, clampD = new THREE.Vector3();
function clampTarget() {
  if (fly || !CTL) return;
  const t = CTL.target, x = Math.min(PAN_BOX.x1, Math.max(PAN_BOX.x0, t.x)), z = Math.min(PAN_BOX.z1, Math.max(PAN_BOX.z0, t.z));
  if (x === t.x && z === t.z) return;
  clampD.set(x - t.x, 0, z - t.z); t.add(clampD); CAM.position.add(clampD);
}
function loop(now) {
  const busy = now < wakeUntil || fly || dragging, fps = busy ? 30 : RAIN && RAIN.visible ? (lowOn() ? 12 : 20) : idleFps(now);
  if (fps ? lastT && now - lastT < 1000 / fps - 3 : !needFrame) return;
  const dt = lastT ? now - lastT : 0, steps = lastT ? Math.min(4, Math.max(1, Math.round(dt / (1000 / 60)))) : 1;   /* 阻尼照 60 帧的手感走 */
  lastT = now; needFrame = false;
  const t0 = performance.now(); tick(steps); if (busy) perfWatch(dt, performance.now() - t0);
}
document.addEventListener('visibilitychange', () => {
  if (!started || !R) return;
  if (document.hidden) R.setAnimationLoop(null);
  else { lastT = 0; wake(1000); R.setAnimationLoop(loop); }
});
function resize() {
  const w = innerWidth, h = innerHeight; R.setSize(w, h, false); LOOK.resize(); needFrame = true;
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
  if (RAIN && RAIN.visible) { RAIN.material.uniforms.uT.value = t; SPLASH.forEach((r) => r.material.uniforms.uT.value = t); }
  for (const m of GLINTS) m.uniforms.t.value = t;
  if (RIPPLES) RIPPLES.forEach((r, i) => { const k = (t * .35 + i * .5) % 1; r.scale.setScalar(.3 + k * .9); r.material.opacity = .45 * (1 - k); });
  if (fly) { const k = Math.min(1, (performance.now() - fly.t0) / 1300), e = ease(k); CTL.target.lerpVectors(fly.a, fly.b, e); CAM.position.lerpVectors(fly.pa, fly.pb, e); if (k >= 1) { const f = fly; fly = null; f.after && f.after(); } }
  for (let i = 0; i < steps; i++) CTL.update();
  /* 松手以后阻尼还在滑：镜头还在动就继续 30 帧 */
  if (CAM.position.distanceToSquared(camPrev) > 1e-8 || CTL.target.distanceToSquared(tgtPrev) > 1e-8) { wake(250); camPrev.copy(CAM.position); tgtPrev.copy(CTL.target); }
  if (WX === 'wind' && !lowOn() && t - lastWindShadow > 1) { lastWindShadow = t; shadowsDirty(); }   /* 起风时花晃得大，影子一秒跟一回（省电档不跟） */
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
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 3; S.add(p); GLINTS.push(m); GLINT_PTS.push(p);
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
  for (let i = 0; i < n; i++) { const t = i / (n - 1), r = r0 * (1 - t * .6); const f = new THREE.OctahedronGeometry(r, 0); f.translate(Math.sin(i * 2.4) * r * .35, h * (.4 + t * .6), Math.cos(i * 2.4) * r * .35); parts.push(nonIdx(f)); }
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
  const dots = (n, r, spread, y, flat = .4, seed = 1) => { let k = seed * 97; const R = () => ((k = (k * 9301 + 49297) % 233280) / 233280); const a = []; for (let i = 0; i < n; i++) { const t = R() * 6.28, rr = Math.sqrt(R()) * spread, g = new THREE.OctahedronGeometry(r * (.8 + R() * .4), 0); g.translate(Math.cos(t) * rr, y + (1 - rr / spread) * spread * flat, Math.sin(t) * rr); a.push(NI(g)); } return M(a); };
  const disc = (r, h) => { const g = NI(new THREE.CylinderGeometry(r, r * .85, .012, 12)); g.rotateX(-.25); g.translate(0, h, 0); return g; };
  const cup = (r, h, sy = .72) => { const g = NI(new THREE.IcosahedronGeometry(r, 1)); g.scale(1, sy, 1); g.translate(0, h, 0); return g; };
  const tulipCup = (h) => { const pts = [[0, 0], [.03, .01], [.045, .04], [.042, .075], [.034, .095]].map(([x, y]) => new THREE.Vector2(x, y)); const g = NI(new THREE.LatheGeometry(pts, 7)); g.translate(0, h, 0); return g; };
  const blade = (h) => { const g = bladeTuft(h, 2); return g; };
  FORMS = {
    daisy: { parts: [[stem(.24), 'stem'], [disc(.05, .24), 'c'], [NI(new THREE.OctahedronGeometry(.018, 0).translate(0, .25, 0)), 'center']], w: .9 },
    cosmos: { parts: [[stem(.34, .08), 'stem'], [disc(.055, .34).translate(-.014, 0, 0), 'c'], [NI(new THREE.OctahedronGeometry(.016, 0).translate(-.014, .35, 0)), 'center']], w: .9 },
    rose: { parts: [[stem(.2), 'stem'], [cup(.055, .22), 'c'], [cup(.035, .245, .8), 'cD']], w: 1 },
    peony: { parts: [[stem(.18), 'stem'], [cup(.085, .2, .66), 'c'], [cup(.05, .235, .8), 'cL']], w: 1.1 },
    mound: { parts: [[NI(new THREE.IcosahedronGeometry(.12, 1).scale(1, .7, 1).translate(0, .08, 0)), 'leaf'], [dots(14, .03, .1, .14, .35, 3), 'c'], [dots(6, .028, .08, .17, .3, 7), 'cL']], w: 1.3 },
    tulip: { parts: [[stem(.22), 'stem'], [blade(.16), 'leaf'], [tulipCup(.21), 'c']], w: .8 },
    umbel: { parts: [[stem(.3), 'stem'], [dots(10, .016, .06, .3, .12, 5), 'c']], w: .9 },
    ground: { parts: [[NI(new THREE.IcosahedronGeometry(.1, 1).scale(1.3, .35, 1.3).translate(0, .025, 0)), 'leaf'], [dots(14, .016, .12, .05, .2, 9), 'c']], w: 1.4 },
    airy: { parts: [[M([stem(.62, .05), stem(.38, -.35).translate(0, .22, 0), stem(.3, .4).translate(0, .3, 0)]), 'stem'], [M([NI(new THREE.OctahedronGeometry(.018, 0).translate(-.03, .62, 0)), NI(new THREE.OctahedronGeometry(.016, 0).translate(.13, .55, 0)), NI(new THREE.OctahedronGeometry(.016, 0).translate(-.12, .56, 0))]), 'c']], w: .7 },
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
const plantOK = (x, z) => inPoly(x, z) ? okSpot(x, z) : (HAT(x, z) > .03 && pathDist(x, z) > .3 && !(x > 7.4 && x < 14.4 && z > -3.4 && z < 1.6) && !(x > 3.2 && x < 11.6 && z > -10 && z < -5.2) && !expBlockers().some((f) => f(x, z)));
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
/* 季节花（hybrid.js 里带 season 的底子）也能种：手上有种子就能种 */
function addSeasonalSp() {
  for (const s of Object.values(Hy.SPECIES)) {
    if (!s.season || PLANT_SP.some((x) => x.id === s.id)) continue;
    PLANT_SP.push({ id: s.id, zh: s.zh, c: [s.c], kind: 'cosmos', seasonal: true });
  }
  /* 送的花（hybrid.js 里带 gift 的）：口袋里有它的种子才出现在种花面板里，颜色取渐变的头一个 */
  let planted = []; try { planted = (JSON.parse(localStorage.getItem('diarytown_beds') || '[]') || []).map((b) => b.sp); } catch (e) {}   /* 种子用完了，已经种下的那几丛照样认得 */
  for (const s of Object.values(Hy.SPECIES)) {
    if (!s.gift || PLANT_SP.some((x) => x.id === s.id) || !(Day.seedCount(s.id) > 0 || planted.includes(s.id))) continue;
    let kind = 'cosmos'; try { const P = Hy.paramsOf(s.genes); kind = P.cluster ? 'mound' : P.dbl ? (P.scale > 1.2 ? 'peony' : 'rose') : P.n >= 7 ? 'daisy' : 'cosmos'; } catch (e) {}
    PLANT_SP.push({ id: s.id, zh: s.zh, c: [s.grad && s.grad[0] || s.c], kind, gift: true });
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
function goHome() { if (!HOME) return; hideFarmCard(); away = false; if (backBtn) backBtn.hidden = true; LOOK.setTilt(.45, .5); flyTo(HOME.t, HOME.d, HOME.dir); }
function goZone(z) {
  away = true; if (backBtn) backBtn.hidden = false; LOOK.setTilt(.7, .5);
  flyTo(z.at, z.dist, z.dir || new THREE.Vector3(-.6, .75, .55), z.after || null);
}
function addZone(name, x, y, z, sx, sy, sz, at, dist, after) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ visible: false })); m.position.set(x, y, z); m.userData.zone = { name, at: new THREE.Vector3(...at), dist, after }; S.add(m); ZONES.push(m);
}
function setupZones() {
  { const ex = (FIELD_G.rows - 3) * FIELD_G.TS; addZone('farm', 10.6, .3, -.45 + ex / 2, 6.6, .8, 4.2 + ex, [10.6, .1, -.45 + ex / 2], 10); }
  addZone('shop', SHOP.x, 1.4, SHOP.z - .3, 2.3, 2.8, 2.2, [SHOP.x, .9, SHOP.z + .4], 7.5, () => setTimeout(() => { location.href = 'shop.html'; }, 250));
  addZone('deck', DECK.x, .5, DECK.z, DECK.w + .2, 1.1, DECK.d + .2, [DECK.x, .4, DECK.z], 7);
  addZone('pond', POND.x, .2, POND.z, POND.r * 2.4, .5, POND.r * 2.4, [POND.x, .1, POND.z], 6.5);
  addZone('village', 7.9, 1, -7.7, 7.5, 2, 4.2, [7.9, .5, -7.7], 11);
  for (const e of EXP) if (e.at && expState(e.id) === 'built') addZone(e.id, e.at[0], .5, e.at[1], e.r * 1.8, 1.2, e.r * 1.8, [e.at[0], .35, e.at[1]], 6.5);   /* 建好的花架、水池这些，点一下也飞过去看看 */
  backBtn = document.createElement('button'); backBtn.textContent = '回园子'; backBtn.hidden = true;
  backBtn.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 40px);z-index:6;padding:7px 18px;border-radius:20px;border:0;background:rgba(255,252,246,.92);color:#5b4a44;font:inherit;font-size:13px;letter-spacing:.2em;box-shadow:0 4px 14px -8px rgba(80,50,40,.35)';
  backBtn.onclick = goHome; document.body.appendChild(backBtn);
}
const HILLS = [];
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
  /* 雨：短、细、淡的蓝灰小划痕，长短快慢各不一样，带一点斜和一点点风；
     凑到镜头跟前的和太远的都淡掉。位置全在 shader 里按时间算，每帧只改一个 uT，不再 CPU 挪 650 根线 */
  const n = 760, pos = new Float32Array(n * 6), end = new Float32Array(n * 2), rr = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const x = -6 + rnd() * 18, y = rnd() * 9, z = -6 + rnd() * 13, a = rnd(), b = rnd(); pos.set([x, y, z, x, y, z], i * 6); end.set([0, 1], i * 2); rr.set([a, b, a, b], i * 4); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1)); g.setAttribute('aR', new THREE.BufferAttribute(rr, 2));
  RAIN = new THREE.LineSegments(g, new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color('#93a4b8') }, uA: { value: .3 }, uWind: { value: new THREE.Vector2(.13, .05) } },
    vertexShader: `uniform float uT; uniform vec2 uWind; attribute float aEnd; attribute vec2 aR; varying float vA;
      void main(){
        float sp = 5.2 * (.7 + .6 * aR.x), len = .22 * (.55 + .9 * aR.y);
        float y = mod(position.y - uT * sp, 9.);
        vec2 w = uWind * (.8 + .4 * aR.y) + .025 * vec2(sin(uT * .6 + position.z), cos(uT * .45 + position.x));
        vec3 p = vec3(position.x + w.x * y, y, position.z + w.y * y) - vec3(w.x, 1., w.y) * len * aEnd;
        float d = distance(p, cameraPosition);
        vA = mix(.3, 1., aEnd) * smoothstep(1.2, 4.5, d) * (1. - .55 * smoothstep(30., 70., d)) * smoothstep(0., .4, y) * (1. - smoothstep(7.8, 9., y)) * (.75 + .25 * aR.x);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: `uniform vec3 uCol; uniform float uA; varying float vA;
      void main(){ gl_FragColor = vec4(uCol, uA * vA);
      #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  })); RAIN.visible = false; RAIN.frustumCulled = false; S.add(RAIN);
  /* 雨点溅起来的小圈：池子里和路上，冒一个小点再散成一圈淡掉；每一圈落的地方每回挪一点，有的回合空着不落。
     全部并成一张网格、一次画完 */
  const spots = [...Array(14)].map(() => { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * (POND.r - .12); return [POND.x + Math.cos(a) * r, .15, POND.z + Math.sin(a) * r, 1]; })
    .concat(PATH_MAIN.getSpacedPoints(20).concat(PATH_DECK.getSpacedPoints(10), PATH_POND.getSpacedPoints(4)).map((p) => [p.x, .14, p.z, 0]));
  const m = spots.length, sp = new Float32Array(m * 12), sc = new Float32Array(m * 12), sq = new Float32Array(m * 16), idx = [];
  spots.forEach(([x, y, z, pond], i) => {
    const ph = rnd(), rate = .7 + rnd() * .6;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v], j) => { sp.set([u, v, 0], i * 12 + j * 3); sc.set([x, y, z], i * 12 + j * 3); sq.set([ph, rate, pond ? .1 : .06, pond], i * 16 + j * 4); });
    idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2);
  });
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aC', new THREE.BufferAttribute(sc, 3)); sg.setAttribute('aP', new THREE.BufferAttribute(sq, 4)); sg.setIndex(idx);
  const splash = new THREE.Mesh(sg, new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color('#dfe7f0') }, uA: { value: .7 } },
    vertexShader: `uniform float uT; attribute vec3 aC; attribute vec4 aP; varying vec2 vQ; varying float vK; varying float vOn; varying float vPond;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        float c = uT * aP.y + aP.x, id = floor(c + aC.x * 7.13);
        vK = fract(c); vPond = aP.w; vOn = step(.35, h(id * 1.7 + aC.z * 3.1));
        vec2 j = (vec2(h(id + aC.x), h(id * 2.3 + aC.z)) - .5) * 2. * aP.z;
        float R = aP.w > .5 ? .2 : .13;
        vQ = position.xy * R;
        vec3 p = aC + vec3(j.x + vQ.x, 0., j.y + vQ.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: `uniform vec3 uCol; uniform float uA; varying vec2 vQ; varying float vK; varying float vOn; varying float vPond;
      void main(){
        float d = length(vQ), R = vPond > .5 ? .18 : .11, r = .015 + vK * R, w = .011 + .007 * vK;
        float ring = 1. - smoothstep(0., w, abs(d - r));
        float ring2 = vPond * .6 * (1. - smoothstep(0., w, abs(d - r * .55))) * step(.15, vK);
        float dt = (1. - smoothstep(.0, .18, vK)) * (1. - smoothstep(.016, .028, d));
        float a = ((ring + ring2) * pow(1. - vK, 1.6) + dt) * vOn * uA;
        if (a < .01) discard;
        gl_FragColor = vec4(uCol, a);
      #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  })); splash.visible = false; splash.frustumCulled = false; splash.userData.noLine = true; S.add(splash); SPLASH.push(splash);
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
  HILLS.forEach((h) => h.setPhase(k, S.fog.color, WX));
  LAMPS.forEach((l) => { l.intensity = t.lamp; l.visible = t.lamp > 0; });   /* 白天灯不亮就整盏关掉：着色器里少算四盏点光（换时辰时重编一次） */
  if (k + WX !== skyKey) { skyKey = k + WX; shadowsDirty(); }   /* 太阳换了位置才重算影子 */
  glowM.forEach((m) => m.emissiveIntensity = m.userData.base * t.glow);
  EXP_GLOW.forEach((g) => { g.visible = k === 'night' || k === 'dusk'; g.material.opacity = k === 'night' ? .55 : .3; });   /* 施工的马灯、花架上的灯：夜里脚下一团暖光 */
  FARM_SOIL.forEach((m, i) => { m.emissive = m.emissive || new THREE.Color(); m.emissive.set('#5a3a24'); m.emissiveIntensity = (k === 'night' ? .5 : k === 'dusk' ? .12 : 0) * (i === 3 ? .3 : 1); });
  if (RAIN) { RAIN.visible = WX === 'rain'; RAIN.material.uniforms.uCol.value.set(k === 'night' ? '#a3b0d4' : k === 'dusk' ? '#c3c6da' : '#c9d5e2'); RAIN.material.uniforms.uA.value = k === 'night' ? .3 : .35; }
  SPLASH.forEach((r) => r.material.uniforms.uCol.value.set(k === 'night' ? '#aab5d6' : '#e6edf4'));
  SPLASH.forEach((r) => r.visible = WX === 'rain' && !lowOn());
  needFrame = true;
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
  const g = new THREE.Group(); g.position.set(x, inPoly(x, z) || (ROOM_ON && inRoom(x, z)) ? .08 : Math.max(.0, HAT(x, z)) + .02, z);
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
  const land = LAND.island(isleRects(), { grass: '#a9cf86', grassD: '#94bf74', sand: '#ecdcb0', deep: '#93c9c6', seed: 4, carve: ROOM_ON ? roomCarve : null, tone: (x, z, h, c) => { if (h < -.1 || inPoly(x, z)) return; const dd = edgeDist(x, z); if (dd < 3) c.lerp(lawnC, .75 * (1 - dd / 3) * (1 - dd / 3)); } });
  HAT = land.userData.heightAt; OUTER_M = land.material; land.userData.keep = true; world.add(land);
  T.mark('b-island'); await yieldUI();
  const sea = LAND.water(90); sea.position.y = -.5; sea.userData.keep = true; world.add(sea);
  HILLS.push(buildFarHills(THREE, { cx: 4.5, cz: -2.5, gradientMap: mat('#ffffff').gradientMap })); S.add(HILLS[0].mesh);
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
  const gap = (mx, mz) => (Math.abs(mx - GATE.x) < GATE.half && mz > 2.9) || (Math.abs(mz - SIDE.z) < SIDE.half && mx > 3.8) || (ROOM_ON && Math.abs(mx - ARCH.x) < ARCH.half && mz > 2.9);   /* 有了新园子，老池子正南开一道拱门 */
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
    const sb = shrub(p.x + n.x * out, p.y + n.y * out, .32 + rnd() * .22, [G.leaf, G.leafD, G.leafL], fl);
    if (!(ROOM_ON && Math.hypot(p.x - ARCH.x, p.y - ARCH.z) < .85)) world.add(sb);   /* 拱门口不压灌木；照样盖一丛再扔掉，随机数不乱 */
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
  /* 去花架那条路两头接实：店那头顺着路的方向伸进石板台子底下，花架那头伸进木平台底下，
     砖沿一路包到台子边、平台边才停，不在草里断开；随机数用完还回去，别把后面的花草排布打乱 */
  { const s0 = seed, em = mat('#b49a80'), ext = (a, b, skip0) => { const c = new THREE.LineCurve3(a, b); gravel(c, .28); const n = Math.max(1, Math.round(a.distanceTo(b) / .12)), tg = c.getTangentAt(0), nx = -tg.z, nz = tg.x, ry = Math.atan2(tg.x, tg.z);
      for (let i = skip0 ? 1 : 0; i <= (skip0 ? n : n - 1); i++) { const p = c.getPointAt(i / n); for (const sd of [-1, 1]) { const ex = p.x + nx * .3 * sd, ez = p.z + nz * .3 * sd; if (inShop(ex, ez, .04) || nearDeck(ex, ez, .03)) continue; const br = new THREE.Mesh(new THREE.BoxGeometry(.05, .045, .115), em); br.position.set(ex, .115, ez); br.rotation.y = ry; br.userData.lineW = .003; world.add(br); } } };
    const p0 = PATH_DECK.getPointAt(0), t0 = PATH_DECK.getTangentAt(0), p1 = PATH_DECK.getPointAt(1), t1 = PATH_DECK.getTangentAt(1);
    ext(p0.clone().addScaledVector(t0, -.4), p0, false); ext(p1, p1.clone().addScaledVector(t1, .45), true);
    const st = new THREE.Mesh(flagGeo(.42, .36, 6), mat(STONE_C[1])); st.position.set(p0.x - t0.x * .2, .1, p0.z - t0.z * .2); st.rotation.y = Math.atan2(t0.x, t0.z); st.userData.lineW = .005; world.add(st);
    seed = s0; }
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
  buildExpand(world);
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
  /* 扩建加的排接在南边（+z）：老的 18 块按列编号不动，第 19 块起一排一排往后数（plotCR） */
  const { COLS, ROWS, TS, FX, FZ, rows } = FIELD_G, fw = COLS * TS, fd0 = ROWS * TS, fd = rows * TS, zTop = FZ - fd0 / 2;
  /* 田底下那块土：圆角、比田大一圈，颜色跟小镇田边的地一样偏土黄 */
  const pad = new THREE.Mesh(new RoundedBoxGeometry(fw + 1.6, .04, fd + 1.4, 3, .3), wash('#cdbb8a', { rep: [2, 1], seed: 21, blots: 20 })); pad.position.set(FX + .25, .02, zTop + fd / 2); pad.userData.noLine = true; farm.add(pad);
  /* 夜里田别洗成灰：土用自己的材质，夜里加一点暖棕的自发光（applySky 里调） */
  const soilA = mat('#8a6a4c', { name: 'farmA' }), soilB = mat('#957459', { name: 'farmB' }), furrow = mat('#6e5238', { name: 'farmF' });
  FARM_SOIL.push(soilA, soilB, furrow, pad.material);
  for (let k = 0; k < COLS * rows; k++) {
    /* 按列排：同一种作物竖着挨在一起 */
    const [c, r] = plotCR(k), x = FX - fw / 2 + TS / 2 + c * TS, z = zTop + TS / 2 + r * TS;
    const tile = new THREE.Mesh(new RoundedBoxGeometry(TS - .07, .1, TS - .07, 2, .03), (c + r) % 2 ? soilA : soilB); tile.position.set(x, .07, z); tile.userData.lineW = .006; farm.add(tile);
    for (const dz of [-.2, 0, .2]) { const f = new THREE.Mesh(new THREE.BoxGeometry(TS - .2, .012, .03), furrow); f.position.set(x, .125, z + dz); f.userData.noLine = true; farm.add(f); }
    FIELD_G.xz[k] = [x, z];   /* 作物不在这儿画了：setupField 按 diarytown_field 一块块长 */
  }
  const x0 = FX - fw / 2 - .2, x1 = FX + fw / 2 + .2, z0 = zTop - .2, z1 = zTop + fd + .2;
  const gt = (FZ - z0) / (z1 - z0), gh = .07 * (fd0 + .4) / (fd + .4);   /* 西边栅栏的口子一直对着田口土路（FZ），田变长了口子不跟着跑 */
  FIELD_G.x0 = x0; FIELD_G.z1 = z1;
  for (const [ax, az, bx, bz, gap] of [[x0, z0, x1, z0, 0], [x1, z0, x1, z1, 0], [x0, z1, x1, z1, 0], [x0, z0, x0, z1, 1]]) {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(len / .45));
    for (let i = 0; i <= n; i++) { const t = i / n; if (gap && Math.abs(t - gt) < gh) continue; const p = new THREE.Mesh(new THREE.BoxGeometry(.05, .26, .05), mat('#c9a77a')); p.position.set(ax + (bx - ax) * t, .15, az + (bz - az) * t); p.userData.lineW = .003; farm.add(p); }
    for (const seg of gap ? [[0, gt - gh], [gt + gh, 1]] : [[0, 1]]) {
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

/* —— 田能种能收——
   18 块地存 diarytown_field（day.js），买来的菜种子在口袋 diarytown_cropseeds 里。走到田边（点田飞过去）以后：
   点空地挑一粒种子种下；点长着的看还要多久；点熟了的收进菜篮子（1–3 份）；长按一块问拔不拔（种子不退）。
   长三段：小芽 → 小苗 → 挂果 → 熟了，熟了的头上闪几颗金点（省电档收起来），田口一块小木牌写熟了几块。
   作物整片合成一份网格再描边（跟原来烤进园子里一样省），哪块变了就整片重盖一次 —— */
const FIELD_G = { COLS: 6, ROWS: 3, TS: .9, FX: 10.85, FZ: -.45, xz: [], x0: 0, z1: 0, rows: 3, rowsLand: 3 };
/* 第 k 块地在第几列第几排：老 18 块按列（3 排），扩建加的从第 19 块起按排（6 块一排） */
const plotCR = (k) => k < 18 ? [Math.floor(k / 3), k % 3] : [(k - 18) % 6, 3 + Math.floor((k - 18) / 6)];
/* 老田里画着的作物（按小镇主题排的），第一次进来照这个搬成熟了的地，看上去跟以前一样 */
const FARM_KINDS = ['心动', '心动', '心动', '远方', '远方', '远方', '朋友', '朋友', '游戏', '游戏', '游戏', '创作', '创作', '工作', '工作', '居家', '居家', '居家'];
/* 小镇作物按主题长：给一种作物找回它的主题，好借 TM.plant 画 */
const DOMAIN_OF = { heartberry: '心动', thoughtleaf: '未分类', boltbean: '工作', palettemelon: '创作', tiderice: '远方', velvetgrape: '游戏', lanternplant: '居家', twinpeach: '朋友' };
let FIELD = [], cropsRoot = null, fieldSig = '', sparkPts = null, signTex = null, signPaint = null;
const PLOT_HITS = [];
const cropName = (k) => (TM.SPECIES[k] || {}).zh || Day.cropZh(k);
/* -1 空地、0 小芽、1 小苗、2 挂果、3 熟了 */
function plotStage(p, now = Date.now()) { if (!p) return -1; const g = Day.plotProgress(p, now); return g >= 1 ? 3 : g < .25 ? 0 : g < .6 ? 1 : 2; }
function leftText(p) {
  const ms = p.plantedAt + p.growMs - Date.now(); if (ms <= 0) return '熟了，点一下收';
  const m = Math.ceil(ms / 60000), h = Math.floor(m / 60);
  return m < 2 ? '马上就熟了' : h ? `还要 ${h} 小时${m % 60 ? ' ' + (m % 60) + ' 分' : ''}` : `还要 ${m} 分`;
}
function sproutModel(stage, k) {
  const g = new THREE.Group(), sp = TM.SPECIES[k] || {}, lc = stage ? '#8fb862' : '#a3c873', h = stage ? .2 : .07;
  const st = new THREE.Mesh(new THREE.CylinderGeometry(.007, .009, h, 5), mat(lc)); st.position.y = h / 2; st.userData.noLine = true; g.add(st);
  const n = stage ? 4 : 2;
  for (let i = 0; i < n; i++) { const a = i / n * 6.28 + k, l = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), mat(lc)); l.scale.set(.045, .012, .026); l.position.set(Math.cos(a) * .035, h * (stage ? .35 + i * .15 : .95), Math.sin(a) * .035); l.rotation.set(0, -a, .35); l.userData.lineW = .003; g.add(l); }
  if (stage === 2) { const b = new THREE.Mesh(new THREE.SphereGeometry(.026, 8, 6), mat(sp.fruit || '#e98aa4')); b.position.y = h + .02; b.scale.set(1, 1.2, 1); b.userData.lineW = .003; g.add(b); }
  return g;
}
function cropModel(p, k) {
  const st = plotStage(p), kind = p.kind, sp = TM.SPECIES[kind];
  if (st <= 1) return sproutModel(st, k);   /* 小镇作物的「小苗」是褪了色的样子（那边是记忆快忘了），田里自己画一根绿苗 */
  if (AU.has(kind)) return AU.plant(kind, st, k);   /* 秋天三样用自己的样子（autumn.js） */
  if (sp && sp.spec) return hang(SP.plant(sp.spec, st, k), kind);
  if (kind === 'bloom' && st < 3) return sproutModel(st, k); 
  if (!DOMAIN_OF[kind] && kind !== 'bloom') return sproutModel(Math.min(st, 2), k);
  return hang(TM.plant({ kind: kind === 'bloom' ? 'feel' : 'mem', w: st === 2 ? 7 : 10 + (k % 3) * 1.5, domain: [DOMAIN_OF[kind]], id: 'farm' + k }, k), kind);   /* 双生桃吊在小枝上、潮汐稻穗子回到秆尖、矮丛的果子连上叶子 */
}
function setupField() {
  TM.useSpecies(Day.seasonSpecs());   /* 南瓜、栗子、柿子登记进小镇的作物表，田里才画得出来 */
  const nPlots = FIELD_G.COLS * FIELD_G.rows;
  FIELD = Day.field(nPlots);
  if (!FIELD) { FIELD = FARM_KINDS.map((d) => ({ kind: TM.cropOf({ kind: 'mem', domain: [d] }), plantedAt: 0, growMs: 0, old: 1 })); Day.saveField(FIELD); while (FIELD.length < nPlots) FIELD.push(null); }
  const { TS, xz } = FIELD_G;
  xz.forEach(([x, z], k) => { const h = new THREE.Mesh(new THREE.BoxGeometry(TS - .04, .6, TS - .04), new THREE.MeshBasicMaterial({ visible: false })); h.position.set(x, .3, z); h.userData.plot = k; S.add(h); PLOT_HITS.push(h); });
  /* 熟了的地头上三颗金点，一闪一闪；一个 Points 画完，省电档跟波光一起收 */
  const pos = [], ph = [], on = [];
  xz.forEach(([x, z], k) => { for (let j = 0; j < 3; j++) { const a = k * 2.1 + j * 2.09; pos.push(x + Math.cos(a) * .2, .5 + j * .09, z + Math.sin(a) * .2); ph.push(k * 3.7 + j * 1.9); on.push(0); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.Float32BufferAttribute(ph, 1)); g.setAttribute('on', new THREE.Float32BufferAttribute(on, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, c: { value: new THREE.Color('#ffe7a0') }, sz: { value: R.getPixelRatio() } }, transparent: true, depthWrite: false,
    vertexShader: 'attribute float ph, on; uniform float t, sz; varying float a; void main(){ float s = sin(t * 1.3 + ph); a = on * (.35 + .65 * pow(max(s, 0.), 3.)); vec4 mv = modelViewMatrix * vec4(position + vec3(0., .03 * sin(t * .9 + ph), 0.), 1.); gl_PointSize = on * 7. * sz * (.6 + a) * (30. / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 c; varying float a; void main(){ vec2 d = gl_PointCoord - .5; float r = abs(d.x) + abs(d.y); float k = smoothstep(.5, .0, r) + smoothstep(.06, .0, abs(d.y)) * smoothstep(.5, .1, abs(d.x)) * .6 + smoothstep(.06, .0, abs(d.x)) * smoothstep(.5, .1, abs(d.y)) * .6; gl_FragColor = vec4(c, min(.9, k * a)); }' });
  sparkPts = new THREE.Points(g, m); sparkPts.frustumCulled = false; sparkPts.renderOrder = 3; sparkPts.visible = !lowOn(); S.add(sparkPts); GLINTS.push(m); GLINT_PTS.push(sparkPts);
  fieldSign();
  rebuildField();
  setInterval(() => { if (!document.hidden) rebuildField(); }, 30000);   /* 长到下一段了才重盖，没变就什么都不做 */
}
/* 田口一块小木牌：熟了几块 / 在长几块 */
function fieldSign() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 112; const x = c.getContext('2d');
  const FONT = '40px "MaoKenTangYuan (beta)","PingFang SC",sans-serif';
  signTex = new THREE.CanvasTexture(c); signTex.colorSpace = THREE.SRGBColorSpace;
  signPaint = (txt, ripe) => { signPaint.last = [txt, ripe]; x.fillStyle = '#f3e6c8'; x.fillRect(0, 0, 256, 112); x.fillStyle = ripe ? '#9f3726' : '#6e5238'; x.font = FONT; x.textAlign = 'center'; x.fillText(txt, 128, 70); signTex.needsUpdate = true; needFrame = true; };
  const g = new THREE.Group(), wood = mat('#9a6b4c');
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(.04, .42, .04), wood), 0, .21, 0));
  const board = at(new THREE.Mesh(new THREE.BoxGeometry(.5, .22, .025), [wood, wood, wood, wood, new THREE.MeshBasicMaterial({ map: signTex }), wood]), 0, .42, .022); board.userData.noLine = true; g.add(board);
  outline(g, { w: .004 }); shadowAll(g);
  const sx = FIELD_G.x0 - .62, sz = FIELD_G.FZ + .7; g.position.set(sx, HAT(sx, sz), sz); g.rotation.y = -.95; g.scale.setScalar(1.3); S.add(g);
  document.fonts.load(FONT, '熟了在长块空地0123456789').then(() => { if (signPaint.last) signPaint(...signPaint.last); }).catch(() => {});   /* 字体按字分片懒加载，拉完再写一遍 */
}
function rebuildField() {
  const now = Date.now(), stages = FIELD.map((p) => plotStage(p, now)), sig = FIELD.map((p, k) => p ? p.kind + stages[k] : '-').join(',');
  if (sig === fieldSig) return; fieldSig = sig;
  if (cropsRoot) { S.remove(cropsRoot); dropGeos(cropsRoot); }
  cropsRoot = new THREE.Group();
  FIELD.forEach((p, k) => {
    if (!p) return; const [x, z] = FIELD_G.xz[k];
    try { const pl = cropModel(p, k); pl.position.set(x, .12, z); pl.scale.multiplyScalar(1.35); cropsRoot.add(pl); } catch (e) { console.error(e); }
  });
  bake(cropsRoot); outline(cropsRoot); shadowAll(cropsRoot); S.add(cropsRoot);
  const on = sparkPts.geometry.attributes.on; stages.forEach((st, k) => { for (let j = 0; j < 3; j++) on.setX(k * 3 + j, st === 3 ? 1 : 0); }); on.needsUpdate = true;
  const ripe = stages.filter((s) => s === 3).length, grow = stages.filter((s) => s >= 0 && s < 3).length;
  signPaint(ripe ? `熟了 ${ripe} 块` : grow ? `在长 ${grow} 块` : '空 地', ripe > 0);
  shadowsDirty();
}
/* 走到田边才能动地：镜头对着田、离得不远（点田先飞过去，飞到了再点地） */
function nearField() { const t = CTL.target; return Math.abs(t.x - 10.7) < 5 && Math.abs(t.z + .45) < 4 && CAM.position.distanceTo(t) < 17; }
const saveField = () => Day.saveField(FIELD);
function tapPlot(k) {
  const p = FIELD[k], st = plotStage(p);
  if (st < 0) { seedCard(k); return; }
  hideFarmCard();
  if (st < 3) { toast(`${cropName(p.kind)} · ${leftText(p)}`); return; }
  /* 一成的机会大丰收，一块收 5 个；老田搬过来的那些照旧 1 个 */
  const big = !p.old && Math.random() < .1, n = p.old ? 1 : big ? 5 : 1 + Math.floor(Math.random() * 3);
  Day.addPantry(p.kind, n); FIELD[k] = null; saveField(); rebuildField(); wake();
  toast(big ? `大丰收！收了 5 个${cropName(p.kind)}` : `收了 ${n} 个${cropName(p.kind)}`);
}
let farmCard = null;
function hideFarmCard() { if (farmCard) farmCard.hidden = true; }
function farmCardEl() {
  if (farmCard) return farmCard;
  const st = document.createElement('style');
  st.textContent = `#farmCard{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom) + 86px);z-index:8;background:rgba(255,252,246,.95);border-radius:18px;padding:10px 12px 10px;box-shadow:0 14px 40px -16px rgba(80,50,40,.45),0 0 0 .5px rgba(90,60,50,.15);transform:rotate(.3deg);color:#5b4a44;max-height:46vh;overflow-y:auto}
#farmCard[hidden]{display:none}
#farmCard h3{font-size:11px;font-weight:400;letter-spacing:.3em;color:#a8968c;margin:2px 2px 6px}
#farmCard .row{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;margin:0 0 6px;border:0;border-radius:14px;background:#fff;color:#5b4a44;font:inherit;font-size:13px;box-shadow:0 0 0 .5px rgba(90,60,50,.18);text-align:left}
#farmCard .row i{display:inline-block;width:9px;height:9px;border-radius:50%;box-shadow:0 0 0 .5px rgba(90,60,50,.25)}
#farmCard .row small{margin-left:auto;font-size:11px;color:#a8968c}
#farmCard p{font-size:12px;color:#a8968c;letter-spacing:.08em;margin:2px 2px 6px}
#farmCard .btns{display:flex;gap:10px;justify-content:flex-end}
#farmCard .btns button{padding:6px 16px;border-radius:16px;border:0;background:#fff;color:#5b4a44;font:inherit;font-size:13px;box-shadow:0 0 0 .5px rgba(90,60,50,.18)}
#farmCard .btns button.yes{background:#9f3726;color:#fbf7ef}
#farmCard .x{position:absolute;right:8px;top:4px;border:0;background:none;color:#a8968c;font-size:18px}`;
  document.head.appendChild(st);
  farmCard = document.createElement('div'); farmCard.id = 'farmCard'; farmCard.hidden = true; document.body.appendChild(farmCard);
  return farmCard;
}
/* 点空地：口袋里有什么菜种子，点一样种一粒 */
function seedCard(k) {
  const el = farmCardEl(), bag = Day.cropSeeds(), ks = Object.keys(bag).filter((x) => bag[x] > 0);
  el.innerHTML = '<button class="x">×</button><h3>种 一 粒</h3>';
  el.querySelector('.x').onclick = hideFarmCard;
  if (!ks.length) el.insertAdjacentHTML('beforeend', '<p>口袋里没有菜种子。<a href="shop.html?seeds" style="color:#9f3726">去店里买</a>，买来的种子进口袋，再来这儿种</p>');
  for (const id of ks) {
    const b = document.createElement('button'); b.className = 'row';
    b.innerHTML = `<i style="background:${(TM.SPECIES[id] || {}).fruit || '#b9cf8f'}"></i>${cropName(id)} <span style="opacity:.6">× ${bag[id]}</span><small>${Day.GROW_H[id] || 4} 小时熟</small>`;
    b.onclick = () => {
      if (FIELD[k] || !Day.useCropSeed(id)) { hideFarmCard(); return; }
      FIELD[k] = { kind: id, plantedAt: Date.now(), growMs: Day.growMs(id) }; saveField(); rebuildField(); wake(); hideFarmCard();
      toast(`种下一粒${cropName(id)}，${Day.GROW_H[id] || 4} 小时后熟`);
    };
    el.appendChild(b);
  }
  el.hidden = false;
}
/* 长按一块：问一声再拔，种子不退 */
function pullCard(k) {
  const p = FIELD[k]; if (!p) { seedCard(k); return; }
  const el = farmCardEl();
  el.innerHTML = `<h3>拔 掉 ？</h3><p>${cropName(p.kind)} · ${leftText(p)}。拔了种子不退</p><div class="btns"><button>算了</button><button class="yes">拔掉</button></div>`;
  const [no, yes] = el.querySelectorAll('.btns button');
  no.onclick = hideFarmCard;
  yes.onclick = () => { FIELD[k] = null; saveField(); rebuildField(); wake(); hideFarmCard(); toast('拔掉了，地空出来了'); };
  el.hidden = false;
}

const EXPAND_KEY = 'diarytown_expand';
const EXP = [
  { id: 'vase3', zh: '花瓶位 +1', about: '花架前沿再留一个花位，能摆第三盆', p: 600, lv: 1, vase: 3 },
  { id: 'field1', zh: '田加一排', about: '田往南多翻一排，六块地', p: 900, lv: 1, row: 1 },
  { id: 'sink', zh: '洗手台', about: '田口栅栏边一座石头洗手台，收完菜洗洗手', p: 1100, lv: 2, at: [7.7, -1.3], rot: -Math.PI / 2, r: .55, box: [7.2, 8.0, -1.8, -.8] },
  { id: 'vase4', zh: '花瓶位 +1', about: '小桌边的木平台上再留一个花位', p: 1200, lv: 2, vase: 4, need: 'vase3' },
  { id: 'basin', zh: '小水池', about: '园子往东南扩出去一块，新园子路中间一口圆石沿的小池子，养几片睡莲', p: 1400, lv: 2, at: [3.7, 4.4], rot: 0, r: .8, room: 1 },
  { id: 'field2', zh: '田再加一排', about: '再翻一排六块，一共三十块地', p: 1600, lv: 3, row: 2, need: 'field1' },
  { id: 'pergola', zh: '花架', about: '园子往东南扩出去一块，新园子尽头爬满玫瑰的木花架，底下一张长椅', p: 2200, lv: 3, at: [5.25, 2.85], rot: 0, r: 1, room: 1 },
  { id: 'vase5', zh: '花瓶位 +1', about: '小桌边再一个，五盆摆满', p: 2600, lv: 4, vase: 5, need: 'vase4' },
  { id: 'swing', zh: '秋千墙', about: '园子往东南扩出去一块，新园子尽头一面爬着常春藤的白花砖墙，挂一架木秋千', p: 3000, lv: 5, at: [5.97, 4.4], rot: -Math.PI / 2, r: 1.15, room: 1 },
];
const SIGN = { x: .25, z: 3.85 };
/* 新园子：老园子东南角外一块圆角方地，北边和西北边贴着老园子的篱笆；拱门开在老池子正南，跟老池子一条线 */
const ROOM = { x0: 1.8, x1: 6.3, z0: 2.2, z1: 6.1, c: .5, top: .09 };
const ARCH = { x: POND.x, z: 3.3, half: .36 };
const AXIS_Z = 4.4;   /* 进门往南走到这儿往东拐，池子、石子地、秋千都在这条线上 */
const SQUARE = { x0: 4.7, x1: 5.8, z0: 3.7, z1: 5.1 };
let ROOM_ON = false;
const inRoom = (x, z, pad = 0) => x > ROOM.x0 - pad && x < ROOM.x1 + pad && z > ROOM.z0 - pad && z < ROOM.z1 + pad && !inPoly(x, z);
/* 新园子底下的地压平：方地里和边上 .6 以内不高过 0，再往外慢慢接回原来的坡，网格粗也顶不穿草皮板 */
function roomCarve(x, z) { const dx = Math.max(0, ROOM.x0 - x, x - ROOM.x1), dz = Math.max(0, ROOM.z0 - z, z - ROOM.z1), d = Math.hypot(dx, dz); return d < .6 ? 0 : (d - .6) * .4; }
function roomShape() {
  const s = new THREE.Shape(), { x0, x1, z0, z1, c } = ROOM;
  s.moveTo(x0, 3.3); s.lineTo(3.0, 3.3); s.quadraticCurveTo(4.1, 3.3, 4.1, 2.2);
  s.lineTo(x1 - c, z0); s.quadraticCurveTo(x1, z0, x1, z0 + c); s.lineTo(x1, z1 - c); s.quadraticCurveTo(x1, z1, x1 - c, z1);
  s.lineTo(x0 + c, z1); s.quadraticCurveTo(x0, z1, x0, z1 - c); s.lineTo(x0, 3.3);
  return s;
}
/* 新园子自己的篱笆：从老园子东篱笆的拐角绕一圈到老园子前篱笆，跟老篱笆接上 */
function roomFencePath() {
  const p = new THREE.Path(), { x0, x1, z0, z1, c } = ROOM;
  p.moveTo(4.1, z0); p.lineTo(x1 - c, z0); p.quadraticCurveTo(x1, z0, x1, z0 + c); p.lineTo(x1, z1 - c); p.quadraticCurveTo(x1, z1, x1 - c, z1);
  p.lineTo(x0 + c, z1); p.quadraticCurveTo(x0, z1, x0, z1 - c); p.lineTo(x0, 3.3);
  return p;
}
let EXPS = {}, EXP_DONE = [], DIARY_DAYS = 0, expSheet = null;
const EXP_HITS = [], EXP_GLOW = [];
const expQ = () => Q.get('expand') || '';
const expState = (id) => { const q = expQ(); if (q === 'all') return 'built'; if (q === 'site') return 'building'; if (q) return q.split(',').includes(id) ? 'built' : null; return EXPS[id] && EXPS[id].state || null; };
const expSave = () => { if (expQ()) return; try { localStorage.setItem(EXPAND_KEY, JSON.stringify(EXPS)); } catch (e) {} };
/* 进门先对一遍：过了早上六点的算建好；花位个数、田几排跟着定 */
function settleExpand() {
  try { EXPS = JSON.parse(localStorage.getItem(EXPAND_KEY) || '{}') || {}; } catch (e) { EXPS = {}; }
  const now = Date.now();
  if (!expQ()) for (const e of EXP) { const s = EXPS[e.id]; if (s && s.state === 'building' && now >= s.doneAt) { s.state = 'built'; s.builtAt = now; EXP_DONE.push(e); } }
  if (EXP_DONE.length) expSave();
  const n = 2 + EXP.filter((e) => e.vase && expState(e.id) === 'built').length;
  if (!expQ()) { try { if ((+localStorage.getItem('diarytown_vase_slots') || 0) < n) localStorage.setItem('diarytown_vase_slots', String(n)); } catch (e) {} }
  FIELD_G.rows = 3 + EXP.filter((e) => e.row && expState(e.id) === 'built').length;
  FIELD_G.rowsLand = 3 + EXP.filter((e) => e.row && expState(e.id)).length;   /* 在施工的那排也先把地压平 */
  ROOM_ON = EXP.some((e) => e.room && expState(e.id));
  if (ROOM_ON) {
    PAN_BOX.z1 = 6.6;   /* 镜头能拖到新园子底下 */
    for (let z = 2.3; z <= 3.3; z += .1) PATH_PTS.push(new THREE.Vector3(ARCH.x, 0, z));   /* 老池子到拱门那几块踏步石，种花让开 */
  }
}
const expDoneText = (e) => e.vase ? `花瓶位建好了，园子里能摆 ${e.vase} 盆` : e.row ? '田加了一排，多了 6 块地' : `${e.zh}建好了`;
/* 岛上的田那块平地：加了几排就往南多压平几排 */
function isleRects() { const ex = FIELD_G.rowsLand > 3 ? (FIELD_G.rowsLand - 3) * FIELD_G.TS + .6 : 0; return ISLE_RECTS.map((r, i) => i === 1 ? [r[0], r[1] + ex / 2, r[2], r[3] + ex / 2] : r); }   /* 多压 .6，田底下那块土垫的南边也落在平地上 */
/* 写过日记的天数（野花、盆边冒的苗不算）；七天一级 */
function countDiaryDays(list) { DIARY_DAYS = new Set((list || []).filter((f) => !f.wild && !f.hybrid && f.mood && f.at).map((f) => Day.dayKey(f.at))).size; }
const gardenLevel = () => Math.floor(DIARY_DAYS / 7);
/* 田加的那一排在哪儿：[x0, x1, z0, z1] */
function rowBox(row) { const { COLS, ROWS, TS, FX, FZ } = FIELD_G, z0 = FZ - ROWS * TS / 2 + (2 + row) * TS; return [FX - COLS * TS / 2, FX + COLS * TS / 2, z0, z0 + TS]; }
/* 一样东西占的地，园子外面的野花草丛、自己种的花丛都让开 */
function expFoot(e) {
  if (e.room) return (x, z) => inRoom(x, z, .35);   /* 新园子整块（连篱笆外一圈）都让开 */
  if (e.box) { const [a, b, c, d] = e.box; return (x, z) => x > a && x < b && z > c && z < d; }
  if (e.at) { const [cx, cz] = e.at; return (x, z) => Math.hypot(x - cx, z - cz) < e.r; }
  if (e.row) { const [a, b, c, d] = rowBox(e.row); return (x, z) => x > a - .65 && x < b + 1.1 && z > c - .1 && z < d + .8; }   /* 连田底下那块土垫 */
  return null;
}
function expBlockers() { const out = [(x, z) => Math.hypot(x - SIGN.x, z - SIGN.z) < .32]; for (const e of EXP) if (expState(e.id)) { const f = expFoot(e); if (f) out.push(f); } return out; }

/* —— 样子：都是小件拼的，盖好以后跟园子一起 bake 成几张网格 —— */
const EXP_C = { wood: '#b98d62', woodD: '#9a6b4c', stone: '#e6dccb', stoneD: '#d2c6b0', cream: '#f1e8d8', cushion: '#f3e7d1', terra: '#c8714a' };
let GLOW_TEX = null;
function glowTex() {
  if (GLOW_TEX) return GLOW_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return GLOW_TEX = new THREE.CanvasTexture(c);
}
/* 夜里灯脚下一团暖光：不加点光源（着色器不重编），一张淡淡的加色圆片 */
function glowDisc(g, x, y, z, r) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ map: glowTex(), color: '#ffb468', transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.userData.noLine = true; m.userData.noCast = true; m.visible = false; m.renderOrder = 2; g.add(m); EXP_GLOW.push(m);
}
const lampGlassM = () => mat('#fff3d6', { emissive: new THREE.Color('#ffb060'), emissiveIntensity: .25 });   /* 跟园子里那几盏灯同一份材质，夜里一起亮 */
function lantern(g, x, y, z, s = 1) {
  const gl = new THREE.Mesh(new THREE.BoxGeometry(.08 * s, .1 * s, .08 * s), lampGlassM()); gl.position.set(x, y, z); gl.userData.lineW = .004; g.add(gl);
  g.add(at(new THREE.Mesh(new THREE.ConeGeometry(.075 * s, .05 * s, 4), mat(C.iron)), x, y + .075 * s, z));
}
/* 施工的地方：四角木桩拉一圈橙白相间的施工带，一摞木板、一小堆土，一根桩上挂马灯 */
function buildSite(g, w, d, s = 1) {
  const post = mat('#c9a77a'), tapeA = mat('#eda23e'), tapeB = mat('#fbf6ec');
  const cs = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  cs.forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(.045 * s, .5 * s, .045 * s), post); p.position.set(x, .25 * s, z); p.userData.lineW = .003; g.add(p); });
  cs.forEach(([ax, az], i) => {
    const [bx, bz] = cs[(i + 1) % 4], len = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(len / (.12 * s))), ang = Math.atan2(bz - az, bx - ax);
    for (let j = 0; j < n; j++) { const t = (j + .5) / n, sag = Math.sin(t * Math.PI) * .04 * s, tp = new THREE.Mesh(new THREE.BoxGeometry(len / n + .002, .035 * s, .006), j % 2 ? tapeA : tapeB); tp.position.set(ax + (bx - ax) * t, .4 * s - sag, az + (bz - az) * t); tp.rotation.y = -ang; tp.userData.noLine = true; g.add(tp); }
  });
  const px = -w / 2 + .38 * s, pz = d / 2 - .2 * s;
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.6 * s, .03 * s, .1 * s), mat(i % 2 ? '#c99d70' : '#b98d62')); b.position.set(px + (i - 1) * .015 * s, .016 * s + i * .031 * s, pz - i * .02 * s); b.rotation.y = (i - 1) * .12; b.userData.lineW = .003; g.add(b); }
  const dirt = new THREE.Mesh(new THREE.IcosahedronGeometry(.16 * s, 1), mat('#bfa57a')); dirt.scale.set(1.2, .4, 1); dirt.position.set(w / 2 - .25 * s, .03 * s, -d / 2 + .25 * s); dirt.userData.lineW = .004; g.add(dirt);
  const sh = new THREE.Mesh(new THREE.BoxGeometry(.03 * s, .34 * s, .012 * s), mat(C.wood)); sh.position.set(w / 2 - .15 * s, .2 * s, -d / 2 + .3 * s); sh.rotation.z = .35; sh.userData.lineW = .003; g.add(sh);   /* 插在土里的一把铲子 */
  const lp = new THREE.Mesh(new THREE.BoxGeometry(.045 * s, .72 * s, .045 * s), post); lp.position.set(w / 2, .36 * s, d / 2); lp.userData.lineW = .003; g.add(lp);
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(.18 * s, .03 * s, .03 * s), post), w / 2 - .07 * s, .7 * s, d / 2));
  lantern(g, w / 2 - .13 * s, .6 * s, d / 2, s);
  glowDisc(g, w / 2 - .13 * s, .02, d / 2, .75 * Math.max(s, .6));
}
/* 花架：原木四根柱、两道梁、一排椽子，上头和前面两根柱爬满玫瑰，底下一张铺了垫子的长椅，梁下吊一盏灯 */
function buildPergola(g) {
  const wd = mat(EXP_C.wood), W = 1.3, D = .9, H = 1.05;
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + .3, .02, D + .3), mat('#e9e1d2')); base.position.y = .01; base.userData.noLine = true; g.add(base);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(.08, H, .08), wd), x * W / 2, H / 2, z * D / 2));
  for (const z of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(W + .3, .07, .07), wd), 0, H + .035, z * D / 2));
  for (let i = 0; i < 7; i++) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(.045, .05, D + .3), wd), -W / 2 - .05 + i * (W + .1) / 6, H + .095, 0));
  let k = 5; const r = () => ((k = (k * 9301 + 49297) % 233280) / 233280);
  const ROSE = ['#f2a7bd', '#e9839f', '#f7c6d3', '#fbf6ec'];
  const clump = (x, y, z, rad, fl) => { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 0), mat(r() < .5 ? G.leaf : G.leafD)); l.position.set(x, y, z); l.scale.y = .8; l.userData.lineW = .004; g.add(l); for (let j = 0; j < fl; j++) { const a = r() * 6.28, e = r() * 1.2 - .2, f = new THREE.Mesh(new THREE.IcosahedronGeometry(.032 + r() * .014, 0), mat(ROSE[Math.floor(r() * ROSE.length)])); f.position.set(x + Math.cos(a) * Math.cos(e) * rad, y + Math.sin(e) * rad * .8, z + Math.sin(a) * Math.cos(e) * rad); f.userData.noLine = true; g.add(f); } };
  for (let i = 0; i < 22; i++) { const x = (r() - .5) * (W + .25), z = (r() - .5) * (D + .2); clump(x, H + .13 + r() * .05, z, .07 + r() * .06, 2); }
  for (const sx of [-1, 1]) for (let i = 0; i < 7; i++) { const y = .12 + i * .14; clump(sx * W / 2 + (r() - .5) * .08, y, D / 2 + (r() - .5) * .08, .055 + r() * .03, i % 2 ? 2 : 1); }
  for (let i = 0; i < 6; i++) clump(W / 2 - .1 - r() * .3, H - .05 - r() * .15, D / 2 + .02, .05, 1);   /* 从梁上垂下来几枝 */
  const bench = new THREE.Group(); bench.position.set(0, 0, -.18);
  bench.add(at(new THREE.Mesh(new THREE.BoxGeometry(.82, .045, .26), mat(EXP_C.woodD)), 0, .24, 0));
  bench.add(at(new THREE.Mesh(new THREE.BoxGeometry(.82, .22, .035), mat(EXP_C.woodD)), 0, .4, -.12));
  for (const x of [-.36, .36]) bench.add(at(new THREE.Mesh(new THREE.BoxGeometry(.045, .24, .24), mat('#7c5639')), x, .12, 0));
  bench.add(at(new THREE.Mesh(new RoundedBoxGeometry(.74, .045, .22, 2, .015), mat(EXP_C.cushion)), 0, .285, .01));
  for (const x of [-.24, .24]) { const pl = new THREE.Mesh(new RoundedBoxGeometry(.17, .14, .05, 2, .02), mat(x < 0 ? '#e9b8c4' : '#f3e7d1')); pl.position.set(x, .37, -.08); pl.rotation.x = -.2; bench.add(pl); }
  g.add(bench);
  lantern(g, .35, H - .14, D / 2 - .05, .9); g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .1, 4), mat(C.iron)), .35, H - .04, D / 2 - .05));
  glowDisc(g, .35, .03, D / 2 - .05, .8);
}
/* 小水池：一圈圆石沿，浅水渐变，三片睡莲两朵花，后沿一丛鸢尾 */
function buildBasin(g, wx, wz) {
  const R0 = .42, n = 14, cm = [mat(EXP_C.stone), mat(EXP_C.stoneD)];
  for (let i = 0; i < n; i++) { const a = (i + .5) / n * 6.28, w = R0 * 6.28 / n * 1.04, st = new THREE.Mesh(new RoundedBoxGeometry(w, .13, .15, 2, .025), cm[i % 2]); st.position.set(Math.cos(a) * (R0 + .06), .065, Math.sin(a) * (R0 + .06)); st.rotation.y = -a + Math.PI / 2; st.userData.lineW = .004; g.add(st); }
  const wc = document.createElement('canvas'); wc.width = wc.height = 64; const x = wc.getContext('2d'), gr = x.createRadialGradient(32, 32, 4, 32, 32, 32);
  gr.addColorStop(0, '#5fa9b6'); gr.addColorStop(.6, '#7fc2c6'); gr.addColorStop(.88, '#bfe3dc'); gr.addColorStop(1, '#e4f2ea'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const wt = new THREE.CanvasTexture(wc); wt.colorSpace = THREE.SRGBColorSpace;
  const water = new THREE.Mesh(new THREE.CircleGeometry(R0 + .01, 28), new THREE.MeshBasicMaterial({ map: wt })); water.rotation.x = -Math.PI / 2; water.position.y = .1; water.userData.noLine = true; g.add(water);
  for (const [a, d, r0, fl] of [[.6, .2, .08, '#fbf6ec'], [2.5, .24, .07, '#f6b8c8'], [4.1, .18, .06, null]]) {
    const lp = new THREE.Mesh(new THREE.CircleGeometry(r0, 12, .3, 5.8), mat('#5f9a52', { side: THREE.DoubleSide })); lp.rotation.x = -Math.PI / 2; lp.rotation.z = a; lp.position.set(Math.cos(a) * d, .108, Math.sin(a) * d); lp.userData.noLine = true; g.add(lp);
    if (fl) for (let j = 0; j < 5; j++) { const pt = new THREE.Mesh(new THREE.IcosahedronGeometry(.022, 0), mat(fl)); pt.scale.set(1, .55, 1.6); const b = j / 5 * 6.28; pt.position.set(Math.cos(a) * d + Math.cos(b) * .022, .13, Math.sin(a) * d + Math.sin(b) * .022); pt.rotation.y = -b; pt.userData.noLine = true; g.add(pt); }
  }
  const iris = bladeTuft(.32, 7);
  for (const a of [-1.9, -1.4]) { const m = new THREE.Mesh(iris, mat('#5f9a6a', { side: THREE.DoubleSide })); m.position.set(Math.cos(a) * (R0 + .2), .02, Math.sin(a) * (R0 + .2)); g.add(m); for (let j = 0; j < 2; j++) { const h = new THREE.Mesh(IcoG(.026), mat('#6f5fd0')); h.position.set(m.position.x + (j - .5) * .05, .3 + j * .03, m.position.z); h.userData.noLine = true; g.add(h); } }
  const pts = []; for (let i = 0; i < 6; i++) { const a = i * 1.7 + .4, d = (i % 3 + 1) * .1; pts.push(wx + Math.cos(a) * d, ROOM.top + .13, wz + Math.sin(a) * d); } glints(pts, 5);
}
const IcoG = (r) => new THREE.IcosahedronGeometry(r, 0);
/* 秋千墙：一面白花砖墙（参考图那种镂空砖，左边一截实心墙垛），木压顶往前挑出两根托梁，挂一架带软垫的木秋千；
   墙上两头爬常春藤、右边开白蔷薇，墙脚一只陶罐几支薰衣草，秋千底下一块石板 */
function breezeTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = '#f3ece0'; x.fillRect(0, 0, 256, 160);
  const bw = 32, bh = 32, x0 = 64;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) {
    const px = x0 + i * bw, py = j * bh; x.fillStyle = '#ddd2bf';
    x.fillRect(px + 5, py + 5, 9, 9); x.fillRect(px + 18, py + 5, 9, 9); x.fillRect(px + 5, py + 18, 9, 9); x.fillRect(px + 18, py + 18, 9, 9);
    x.fillStyle = '#c9bca5'; x.fillRect(px + 7, py + 7, 5, 5); x.fillRect(px + 20, py + 7, 5, 5); x.fillRect(px + 7, py + 20, 5, 5); x.fillRect(px + 20, py + 20, 5, 5);
  }
  x.fillStyle = 'rgba(160,140,110,.25)'; x.fillRect(x0 - 2, 0, 2, 160);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildSwing(g) {
  const W = 1.7, H = 1.05, T0 = .18, wood = mat(EXP_C.woodD);
  const wallM = mat('#ffffff', { map: breezeTex() }), plain = mat(EXP_C.cream);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(W, H, T0), [plain, plain, plain, plain, wallM, plain]); wall.position.y = H / 2; wall.userData.lineW = .006; wall.userData.keep = true; g.add(wall);
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(W + .12, .06, T0 + .1), wood), 0, H + .03, 0));
  const sx = .38, out = .62;
  for (const s of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(.06, .07, out + .1), wood), s * sx + .15, H + .02, out / 2));
  const ropeM = mat('#c9b48a');
  for (const s of [-1, 1]) { const rp = new THREE.Mesh(new THREE.CylinderGeometry(.007, .007, .58, 4), ropeM); rp.position.set(s * (sx - .04) + .15, H - .29, out - .02); rp.userData.noLine = true; g.add(rp); }
  const seat = new THREE.Group(); seat.position.set(.15, .42, out - .02);
  seat.add(at(new THREE.Mesh(new THREE.BoxGeometry(.72, .045, .28), mat(EXP_C.wood)), 0, 0, 0));
  seat.add(at(new THREE.Mesh(new THREE.BoxGeometry(.72, .2, .03), mat(EXP_C.wood)), 0, .13, -.13));
  for (const s of [-1, 1]) seat.add(at(new THREE.Mesh(new THREE.BoxGeometry(.03, .1, .26), mat(EXP_C.wood)), s * .35, .07, 0));
  seat.add(at(new THREE.Mesh(new RoundedBoxGeometry(.64, .05, .24, 2, .02), mat(EXP_C.cushion)), 0, .045, .01));
  g.add(seat);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(1.0, .025, .62), mat('#e2dccd')); pad.position.set(.15, .012, out - .02); pad.userData.lineW = .004; g.add(pad);
  let k = 11; const r = () => ((k = (k * 9301 + 49297) % 233280) / 233280);
  const leafy = (x, y, rad, fl) => { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 0), mat(r() < .55 ? G.leafD : G.leaf)); l.scale.z = .55; l.position.set(x, y, T0 / 2 + .02); l.userData.noLine = true; g.add(l); if (fl) { const f = new THREE.Mesh(IcoG(.03), mat('#fbfaf4')); f.position.set(x + (r() - .5) * .06, y + .02, T0 / 2 + .07); f.userData.noLine = true; g.add(f); } };
  for (let i = 0; i < 26; i++) { const y = Math.pow(r(), .7) * (H + .05); leafy(-W / 2 + r() * .4, y, .06 + r() * .04, false); }   /* 左边墙垛上的常春藤 */
  for (let i = 0; i < 22; i++) { const y = .1 + r() * (H - .05); leafy(W / 2 - r() * .35, y, .06 + r() * .04, r() < .6); }   /* 右边爬白蔷薇 */
  for (let i = 0; i < 10; i++) leafy(-W / 2 + .3 + r() * (W - .5), H - .02 - r() * .18, .05 + r() * .03, false);   /* 压顶下垂一溜 */
  const terra = mat(EXP_C.terra), urnPts = [[0, 0], [.08, 0], [.12, .06], [.15, .16], [.13, .27], [.08, .32], [.1, .36], [0, .36]].map(([a, b]) => new THREE.Vector2(a * .9, b * .9));
  const urn = new THREE.Mesh(new THREE.LatheGeometry(urnPts, 12), terra); urn.position.set(-W / 2 + .12, 0, .32); urn.userData.lineW = .005; g.add(urn);
  const lav = floretSpike(.3, .022, 6);
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(lav, mat(i % 2 ? '#9a86c4' : '#8a74b8')); m.position.set(W / 2 - .15 + (i % 3 - 1) * .08, 0, .3 + Math.floor(i / 3) * .1); m.rotation.set((r() - .5) * .3, r() * 3, (r() - .5) * .3); g.add(m); }
}
/* 洗手台：米白石板做背墙，挖一道拱形的龛，龛里一根黑铁水龙头；底下一整块粗石墩，上面一只深色石盆；旁边一只陶罐、一把喷壶 */
function buildSink(g) {
  const back = new THREE.Mesh(new THREE.BoxGeometry(.66, 1.0, .12), mat(EXP_C.cream)); back.position.set(0, .5, -.12); back.userData.lineW = .006; g.add(back);
  const niche = new THREE.Mesh(new THREE.ShapeGeometry(archShape(.38, .5), 12), mat('#d9cbb3')); niche.position.set(0, .42, -.058); niche.userData.noLine = true; g.add(niche);
  const block = new THREE.Mesh(new RoundedBoxGeometry(.52, .42, .34, 2, .03), mat('#ffffff', { map: washTex('#e3d6bd', { blots: 18, seed: 9 }) })); block.position.set(0, .21, .04); block.userData.lineW = .006; g.add(block);
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.08, 0], [.15, .035], [.18, .075], [.175, .085], [.15, .05], [0, .04]].map(([a, b]) => new THREE.Vector2(a, b)), 16), mat('#3e3835', { side: THREE.DoubleSide })); bowl.position.set(0, .42, .04); bowl.userData.lineW = .004; g.add(bowl);
  const iron = mat(C.iron);
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.011, .011, .22, 6), iron), 0, .72, -.045));
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, .11, 6), iron); sp.rotation.x = Math.PI / 2; sp.position.set(0, .61, .005); g.add(sp);
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, .05, 6), iron), 0, .585, .055));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .015, 8), iron), 0, .84, -.045));
  const urnPts = [[0, 0], [.08, 0], [.12, .06], [.15, .16], [.13, .27], [.08, .32], [.1, .36], [0, .36]].map(([a, b]) => new THREE.Vector2(a * .75, b * .75));
  const urn = new THREE.Mesh(new THREE.LatheGeometry(urnPts, 12), mat(EXP_C.terra)); urn.position.set(-.42, 0, .02); urn.userData.lineW = .005; g.add(urn);
  const can = new THREE.Group(); can.position.set(.38, 0, .22); can.rotation.y = -.6;
  can.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .13, 10), mat('#8fa9a4')), 0, .065, 0));
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(.008, .012, .16, 5), mat('#8fa9a4')); spout.rotation.z = -.9; spout.position.set(.1, .1, 0); can.add(spout);
  const hd = new THREE.Mesh(new THREE.TorusGeometry(.045, .008, 4, 10, Math.PI), mat('#8fa9a4')); hd.position.set(0, .13, 0); can.add(hd);
  g.add(can);
}
/* 大门左边篱笆外那块木牌 */
function expSign(world) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 112; const x = c.getContext('2d');
  const FONT = '46px "MaoKenTangYuan (beta)","PingFang SC",sans-serif', tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const paint = () => { x.fillStyle = '#f3e6c8'; x.fillRect(0, 0, 256, 112); x.fillStyle = '#9f3726'; x.font = FONT; x.textAlign = 'center'; x.fillText('扩 建', 128, 72); tex.needsUpdate = true; needFrame = true; };
  paint(); document.fonts.load(FONT, '扩建').then(paint).catch(() => {});
  const g = new THREE.Group(), wood = mat('#9a6b4c');
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(.04, .46, .04), wood), 0, .23, 0));
  const board = at(new THREE.Mesh(new THREE.BoxGeometry(.46, .2, .025), [wood, wood, wood, wood, new THREE.MeshBasicMaterial({ map: tex }), wood]), 0, .44, .022); board.userData.noLine = true; g.add(board);
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(.5, .03, .06), wood), 0, .555, .02));
  const y0 = HAT(SIGN.x, SIGN.z); g.position.set(SIGN.x, Math.max(0, y0), SIGN.z); g.rotation.y = -1.0; g.scale.setScalar(1.3); world.add(g);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, 1, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(SIGN.x, .5, SIGN.z); S.add(hit); EXP_HITS.push(hit);
}
/* 一样东西摆到它的地方：建好了画本体，在施工画工地 */
function expPlace(e, st) {
  const g = new THREE.Group();
  if (e.vase) {
    const [x, z] = Day.VASE_SPOTS[e.vase - 1]; g.position.set(x, x > 0 ? .145 : .14, z);
    if (st === 'building') buildSite(g, .38, .34, .45);
  } else if (e.row) {
    const [a, b, c, d] = rowBox(e.row); g.position.set((a + b) / 2, HAT((a + b) / 2, (c + d) / 2), (c + d) / 2);
    if (st === 'building') { const soil = new THREE.Mesh(new THREE.BoxGeometry(b - a - .1, .03, d - c - .1), mat('#a2805c')); soil.position.y = .03; soil.userData.lineW = .004; g.add(soil); buildSite(g, b - a + .1, d - c + .1, 1); }
  } else {
    const [x, z] = e.at; g.rotation.y = e.rot || 0;
    if (e.room) g.position.set(x, ROOM.top, z);   /* 新园子的草皮板是平的 */
    else {
      /* 不在平地上的（洗手台）：量一遍脚下一圈的高低，按最高处放，底下垫一块往下伸到最低处的石板，接缝藏在石板里 */
      const [a, b, c, d] = e.box; let hi = -1, lo = 1;
      for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) { const h = HAT(a + (b - a) * i / 6, c + (d - c) * j / 6); hi = Math.max(hi, h); lo = Math.min(lo, h); }
      const y0 = Math.max(hi, .045) + .005, th = y0 - lo + .06;
      g.position.set(x, y0, z);
      const pl = new THREE.Mesh(new THREE.BoxGeometry(.9, th, .7), mat('#e2dccd')); pl.position.set(.05, .025 - th / 2, .05); pl.userData.lineW = .004; g.add(pl);
      g.userData.lift = .025;
    }
    if (st === 'building') buildSite(g, e.r * 1.35, e.r * 1.1, 1);
    else if (e.id === 'pergola') buildPergola(g);
    else if (e.id === 'basin') buildBasin(g, x, z);
    else if (e.id === 'swing') buildSwing(g);
    else if (e.id === 'sink') { const k = new THREE.Group(); k.position.y = g.userData.lift || 0; buildSink(k); g.add(k); }
  }
  g.userData.exp = e.id; return g;
}
/* 新园子：草皮板、自己的白篱笆、老池子正南的拱门、路（进门往南，拐弯往东过池子到石子地）、沿边一圈灌木 */
function buildRoom(world) {
  let k = 37; const r = () => ((k = (k * 9301 + 49297) % 233280) / 233280);
  const T0 = ROOM.top;
  const lg = new THREE.ExtrudeGeometry(roomShape(), { depth: .22, bevelEnabled: false, curveSegments: 16 }); lg.rotateX(Math.PI / 2); lg.translate(0, T0, 0);
  const lawn = new THREE.Mesh(lg, wash(G.grass, { rep: [.11, .11], seed: 2, blots: 22 })); lawn.userData.lineW = .01; world.add(lawn);
  /* 篱笆：跟老园子前面那段一样的白尖桩，两道横杆 */
  const pk = [], FP = roomFencePath().getSpacedPoints(90);
  for (let i = 0; i < FP.length - 1; i++) {
    const a = FP[i], b = FP[i + 1], mx = (a.x + b.x) / 2, mz = (a.y + b.y) / 2, len = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    const g = new THREE.BoxGeometry(.055, .38, .045); g.translate(0, T0 + .19, 0); g.rotateY(-ang); g.translate(mx, 0, mz); pk.push(g);
    for (const y of [.22, .37]) { const rl = new THREE.BoxGeometry(len + .02, .028, .028); rl.rotateY(-ang); rl.translate(mx, T0 - .09 + y, mz); pk.push(rl); }
  }
  const fence = new THREE.Mesh(mergeGeometries(pk), mat(C.white)); fence.userData.lineW = .006; world.add(fence);
  /* 篱笆外沿稀稀落落几丛灌木，压住一半篱笆 */
  for (let i = 3; i < FP.length - 3; i += 4) { if (Math.sin(i * .37) > .45) continue; const p = FP[i], q = FP[i + 1], tx = q.x - p.x, tz = q.y - p.y, tl = Math.hypot(tx, tz) || 1, nx = tz / tl, nz = -tx / tl, o = .08 + r() * .14; const sb = shrub(p.x + nx * o, p.y + nz * o, .26 + r() * .14, [G.leaf, G.leafD, G.leafL], r() < .35 ? [G.pink, C.white] : null); sb.position.y = Math.max(0, HAT(sb.position.x, sb.position.z)) + .02; world.add(sb); }
  /* 拱门：跟大门一样的白柱子、半圈白拱，拱上爬玫瑰 */
  for (const sd of [-1, 1]) world.add(at(new THREE.Mesh(new THREE.BoxGeometry(.1, .66, .1), mat(C.white)), ARCH.x + sd * ARCH.half, .42, ARCH.z));
  const arch = new THREE.Mesh(new THREE.TorusGeometry(ARCH.half, .035, 6, 18, Math.PI), mat(C.white)); arch.position.set(ARCH.x, .74, ARCH.z); world.add(arch);
  for (let i = 0; i < 12; i++) { const a = i / 11 * Math.PI, rs = new THREE.Mesh(new THREE.IcosahedronGeometry(.05 + (i % 3) * .014, 0), mat(i % 3 ? G.pink : (i % 2 ? G.leaf : C.white))); rs.position.set(ARCH.x + Math.cos(a) * ARCH.half, .74 + Math.sin(a) * ARCH.half, ARCH.z + (r() - .5) * .07); rs.userData.lineW = .004; world.add(rs); }
  /* 路：碎石带 + 两边矮砖沿 + 横铺的石板，全是直的，跟篱笆平行 */
  const STONE = ['#9aa8b2', '#8e9ca6', '#a9b4bb', '#b3bcc0'], grav = mat('#e9e1d2'), brick = mat('#b49a80'), Y = T0 + .007;
  const flat = (x0, x1, z0, z1, m, y) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); o.userData.noLine = true; o.receiveShadow = true; world.add(o); };
  const bricks = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / .12)), ry = Math.atan2(bx - ax, bz - az); for (let i = 0; i < n; i++) { const t = (i + .5) / n, b = new THREE.Mesh(new THREE.BoxGeometry(.05, .045, L / n - .008), brick); b.position.set(ax + (bx - ax) * t, T0 + .022, az + (bz - az) * t); b.rotation.y = ry; b.userData.lineW = .003; world.add(b); } };
  const slab = (x, z, w, d) => { const st = new THREE.Mesh(new RoundedBoxGeometry(w, .04, d, 1, .012), mat(STONE[Math.floor(r() * 4)])); st.position.set(x + (r() - .5) * .02, T0 + .02, z + (r() - .5) * .02); st.rotation.y = (r() - .5) * .06; st.userData.lineW = .005; world.add(st); };
  const W = .25, rimR = .9, PX = EXP.find((e) => e.id === 'basin').at[0];
  /* 进门往南：拱门到拐角 */
  flat(ARCH.x - W, ARCH.x + W, ARCH.z, AXIS_Z + W, grav, Y);
  bricks(ARCH.x - W - .03, ARCH.z + .08, ARCH.x - W - .03, AXIS_Z + W + .03); bricks(ARCH.x + W + .03, ARCH.z + .08, ARCH.x + W + .03, AXIS_Z - W - .03);
  for (let z = ARCH.z + .2; z < AXIS_Z - .1; z += .3) slab(ARCH.x, z, W * 1.6, .24);
  /* 拐角往东：到池子那圈石子地，过了池子接着到坐的那块石子地 */
  flat(ARCH.x - W, PX, AXIS_Z - W, AXIS_Z + W, grav, Y);
  bricks(ARCH.x - W - .03, AXIS_Z + W + .03, PX - Math.sqrt(rimR * rimR - (W + .03) ** 2), AXIS_Z + W + .03);
  bricks(ARCH.x + W + .03, AXIS_Z - W - .03, PX - Math.sqrt(rimR * rimR - (W + .03) ** 2), AXIS_Z - W - .03);
  for (let x = ARCH.x + .05; x < PX - rimR - .12; x += .3) slab(x, AXIS_Z, .24, W * 1.6);
  flat(PX, SQUARE.x0, AXIS_Z - W, AXIS_Z + W, grav, Y);
  for (const sd of [-1, 1]) bricks(PX + Math.sqrt(rimR * rimR - (W + .03) ** 2), AXIS_Z + sd * (W + .03), SQUARE.x0 - .03, AXIS_Z + sd * (W + .03));
  for (let x = PX + rimR + .15; x < SQUARE.x0 - .05; x += .3) slab(x, AXIS_Z, .24, W * 1.6);
  /* 池子外面一圈石子地，砖沿收边 */
  { const rg = new THREE.Mesh(new THREE.CircleGeometry(rimR, 40), grav); rg.rotation.x = -Math.PI / 2; rg.position.set(PX, Y + .001, AXIS_Z); rg.userData.noLine = true; rg.receiveShadow = true; world.add(rg);
    const nb = 36; for (let i = 0; i < nb; i++) { const a = (i + .5) / nb * 6.28; if (Math.abs(Math.sin(a)) * rimR < W + .02) continue; const b = new THREE.Mesh(new THREE.BoxGeometry(.05, .045, rimR * 6.28 / nb * .9), brick); b.position.set(PX + Math.cos(a) * (rimR + .02), T0 + .022, AXIS_Z + Math.sin(a) * (rimR + .02)); b.rotation.y = -a; b.userData.lineW = .003; world.add(b); } }
  /* 坐的那块石子地：花架和秋千墙围着，四边砖沿（西边留路口） */
  { const Q = SQUARE; flat(Q.x0, Q.x1, Q.z0, Q.z1, grav, Y);
    bricks(Q.x0 - .03, Q.z0 - .03, Q.x1 + .03, Q.z0 - .03); bricks(Q.x0 - .03, Q.z1 + .03, Q.x1 + .03, Q.z1 + .03); bricks(Q.x1 + .03, Q.z0, Q.x1 + .03, Q.z1);
    bricks(Q.x0 - .03, Q.z0, Q.x0 - .03, AXIS_Z - W - .03); bricks(Q.x0 - .03, AXIS_Z + W + .03, Q.x0 - .03, Q.z1);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) slab(Q.x0 + .2 + i * .35, Q.z0 + .2 + j * .33, .3, .28);
    /* 两只陶罐守着路口 */
    const urnPts = [[0, 0], [.08, 0], [.12, .06], [.15, .16], [.13, .27], [.08, .32], [.1, .36], [0, .36]].map(([a, b]) => new THREE.Vector2(a * .7, b * .7));
    for (const sd of [-1, 1]) { const u = new THREE.Mesh(new THREE.LatheGeometry(urnPts, 12), mat(EXP_C.terra)); u.position.set(Q.x0 + .12, T0, AXIS_Z + sd * (W + .2)); u.userData.lineW = .005; world.add(u); const top = new THREE.Mesh(new THREE.IcosahedronGeometry(.1, 1), mat(G.leafD)); top.position.set(Q.x0 + .12, T0 + .3, AXIS_Z + sd * (W + .2)); top.scale.y = .8; top.userData.lineW = .005; world.add(top); } }
  /* 老园子里：老池子南沿到拱门三块踏步石 */
  for (const [z, w] of [[2.55, .3], [2.85, .28], [3.15, .32]]) { const st = new THREE.Mesh(new RoundedBoxGeometry(w, .04, .2, 1, .012), mat(STONE[Math.floor(r() * 4)])); st.position.set(ARCH.x + (r() - .5) * .03, .105, z); st.rotation.y = (r() - .5) * .08; st.userData.lineW = .005; world.add(st); }
  /* 进门两边一对修剪圆球 */
  for (const sd of [-1, 1]) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.13, 1), mat(G.leafD)); b.position.set(ARCH.x + sd * (W + .2), T0 + .12, ARCH.z + .3); b.userData.lineW = .006; world.add(b); }
}
function buildExpand(world) {
  expSign(world);
  if (ROOM_ON) { const s0 = seed; buildRoom(world); seed = s0; }
  for (const e of EXP) { const st = expState(e.id); if (st && !(st === 'built' && (e.vase || e.row))) world.add(expPlace(e, st)); }
}
/* 开工以后当场把工地摆上（单独一组，自己 bake） */
function addSiteLive(e) {
  const g = expPlace(e, 'building'), root = new THREE.Group(); root.add(g); bake(root); outline(root); shadowAll(root); S.add(root);
  applySky(); shadowsDirty(); wake();
}

/* —— 扩建单子 —— */
function expSheetEl() {
  if (expSheet) return expSheet;
  const st = document.createElement('style');
  st.textContent = `#expand{max-height:72vh;display:flex;flex-direction:column;padding-bottom:10px}
#expand[hidden]{display:none}
#expand h3{font-size:11px;font-weight:400;letter-spacing:.3em;color:var(--soft);margin:0 2px 2px}
#expand .lv{display:flex;align-items:baseline;gap:8px;font-size:14px;margin:0 2px 8px;letter-spacing:.06em}
#expand .lv small{font-size:11px;color:var(--soft);letter-spacing:.08em}
#expand .lv b{margin-left:auto;font-weight:400;font-size:12px;color:var(--brick)}
#expand .xl{overflow-y:auto;margin:0 -4px;padding:0 4px;scrollbar-width:none}
#expand .xl::-webkit-scrollbar{display:none}
#expand .xr{display:flex;align-items:center;gap:10px;padding:6px 10px;margin:0 0 5px;border-radius:14px;background:#fff;box-shadow:0 0 0 .5px rgba(90,60,50,.16)}
#expand .xr:nth-child(odd){transform:rotate(-.3deg)}
#expand .xr:nth-child(2n){transform:rotate(.3deg)}
#expand .xr.lock{opacity:.6}
#expand .xm{flex:1;min-width:0}
#expand .xm b{font-weight:400;font-size:14px}
#expand .xm p{font-size:11px;line-height:1.5;color:var(--soft);margin:1px 0 1px}
#expand .xm small{font-size:11px;color:var(--ink);opacity:.75;letter-spacing:.04em}
#expand .xs{flex:0 0 auto;text-align:right;font-size:12px;line-height:1.4}
#expand .xs i{display:block;font-style:normal;font-size:10px;color:var(--soft)}
#expand .xs .ok{color:#5f8a52}
#expand .xs .busy{color:#c07a2c}
#expand .xs .no{color:var(--soft)}
#expand .xs button{padding:5px 12px;border-radius:14px;background:var(--brick);color:#fbf7ef;font-size:12px;letter-spacing:.1em}
#expand .xs button.sure{background:#5b4a44}
#expand .xs button:disabled{background:rgba(90,60,50,.14);color:var(--soft)}
#expand .ft{font-size:10px;color:var(--soft);letter-spacing:.08em;margin:6px 2px 0;text-align:center}`;
  document.head.appendChild(st);
  expSheet = document.createElement('div'); expSheet.className = 'sheet'; expSheet.id = 'expand'; expSheet.hidden = true; document.body.appendChild(expSheet);
  return expSheet;
}
function hideExpand() { if (expSheet) expSheet.hidden = true; }
export function openExpand() {
  const el = expSheetEl(); document.querySelectorAll('.sheet').forEach((s) => { if (s !== el) s.hidden = true; }); hideFarmCard();
  renderExpand(); el.hidden = false; el.openedAt = performance.now(); wake();   /* 点木牌那一下手指抬起来还会补一个 click，落到刚弹出来的按钮上：开头 .4 秒不认 */
}
function renderExpand() {
  const el = expSheetEl(), lv = gardenLevel(), left = 7 - DIARY_DAYS % 7, coins = Day.coins();
  el.innerHTML = `<button class="x">×</button><h3>扩 建</h3><div class="lv">花园 ${lv} 级<small>· 再写 ${left} 天升级</small><b>花币 ${coins}</b></div><div class="xl"></div><p class="ft">付了当场开工，第二天早上六点建好 · 写满七天日记升一级</p>`;
  el.querySelector('.x').onclick = hideExpand;
  const box = el.querySelector('.xl');
  for (const e of EXP) {
    const st = expState(e.id), needOk = !e.need || expState(e.need) === 'built', row = document.createElement('div');
    let right;
    if (st === 'built') right = '<span class="ok">已建好</span>';
    else if (st === 'building') right = '<span class="busy">施工中</span><i>明早六点好</i>';
    else if (lv < e.lv || !needOk) right = `<span class="no">未解锁</span><i>${lv < e.lv ? e.lv + ' 级能建' : '先建好上一个'}</i>`;
    else right = coins < e.p ? '<button disabled>可以建</button><i>花币还差 ' + (e.p - coins) + '</i>' : '<button>可以建</button>';
    row.className = 'xr' + (!st && (lv < e.lv || !needOk) ? ' lock' : '');
    row.innerHTML = `<div class="xm"><b>${e.zh}</b><p>${e.about}</p><small>${e.p} 花币 · ${e.lv} 级</small></div><div class="xs">${right}</div>`;
    const b = row.querySelector('button:not(:disabled)');
    if (b) b.onclick = () => { if (performance.now() - (el.openedAt || 0) < 400) return; if (!b.classList.contains('sure')) { box.querySelectorAll('button.sure').forEach((o) => { o.classList.remove('sure'); o.textContent = '可以建'; }); b.classList.add('sure'); b.textContent = `付 ${e.p} 开工`; return; } buyExpand(e); };   /* 点一下变「付多少开工」，再点才扣钱 */
    box.appendChild(row);
  }
}
function buyExpand(e) {
  if (expState(e.id) || gardenLevel() < e.lv || (e.need && expState(e.need) !== 'built')) return;
  const fp = expFoot(e); if (fp && BEDS.some((b) => !inPoly(b.x, b.z) && fp(b.x, b.z))) { toast('那块地上种着花，先拔掉再建'); return; }
  if (expQ()) { toast('测试模式，不扣花币'); return; }
  if (!Day.spend(e.p)) { toast('花币不够'); renderExpand(); return; }
  const now = Date.now(); EXPS[e.id] = { state: 'building', startedAt: now, doneAt: Day.nextMorning(now) }; expSave();
  addSiteLive(e); renderExpand(); toast(`${e.zh}开工了，明早六点建好`);
}

/* 花境：三大团，每团自己的几种颜色，高低三层（后面高的毛地黄/飞燕草、中间薰衣草绣球、前面贴地小花），堆满溢出；前面那片草坪留空 */
function fillBeds() {
  const d = new THREE.Object3D();
  const spike = floretSpike(.36, .024, 7);
  const tall = floretSpike(.58, .036, 9);
  const ball = new THREE.IcosahedronGeometry(.1, 1);
  const dot = new THREE.OctahedronGeometry(.038, 0);
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
  /* 同一种形不分颜色并成一个 InstancedMesh，颜色走每个实例自己的 instanceColor（白材质 × 实例色 = 原来的颜色），draw call 少一百多个 */
  /* 扩建占的地（木牌、建好的和在施工的）：园子外面那些野花草丛让开，不动随机数，盖完再筛 */
  const blk = expBlockers();
  for (const it of lists.values()) it.m = it.m.filter((mm) => { const x = mm.elements[12], z = mm.elements[14]; return inPoly(x, z) || !blk.some((f) => f(x, z)); });
  /* 新园子的花境：南篱笆一长条、西篱笆一短条，高的靠篱笆、矮的朝路；一段一个饱和色，白色只当隔断 */
  if (ROOM_ON) {
    const s0 = seed; seed = 53;
    const putF = (fname, c, x, z, y, sc) => { const f = F[fname], ry = rnd() * 6.28, tl = (rnd() - .5) * .18; for (const [geo, role] of f.parts) { d.position.set(x, y, z); d.rotation.set(tl, ry, 0); d.scale.setScalar(sc * f.w); d.updateMatrix(); const col = partColor(role, c), key = geo.uuid + col; if (!lists.has(key)) lists.set(key, { geo, color: col, m: [] }); lists.get(key).m.push(d.matrix.clone()); } };
    const putB = (geo, color, x, z, y, sc) => { d.position.set(x, y, z); d.rotation.set(0, rnd() * 3, 0); d.scale.setScalar(sc); d.updateMatrix(); const key = geo.uuid + color; if (!lists.has(key)) lists.set(key, { geo, color, m: [] }); lists.get(key).m.push(d.matrix.clone()); };
    const COLS = ['#ff4f8b', '#ffc21a', '#8a4fd8', '#fbf6ec', '#ee3340', '#ff7aa8', '#fbf6ec', '#6f93e8'];
    const BEDS_R = [
      { a: [ROOM.x0 + .35, ROOM.z1 - .32], b: [ROOM.x1 - .35, ROOM.z1 - .32], back: [0, 1], w: .26 },
      { a: [ROOM.x0 + .26, 3.75], b: [ROOM.x0 + .26, ROOM.z1 - .6], back: [-1, 0], w: .16 },
    ];
    const Y = ROOM.top + .01;
    let ci = 0;
    for (const B of BEDS_R) {
      const L = Math.hypot(B.b[0] - B.a[0], B.b[1] - B.a[1]), n = Math.round(L / .1);
      for (let i = 0; i <= n; i++) {
        const t = i / n, px = B.a[0] + (B.b[0] - B.a[0]) * t, pz = B.a[1] + (B.b[1] - B.a[1]) * t;
        if (i % 7 === 0) ci++;
        const block = COLS[ci % COLS.length], nextC = COLS[(ci + 1) % COLS.length];
        for (let j = 0; j < 9; j++) {
          const u = rnd() * 2 - 1, x = px + B.back[0] * u * B.w + (rnd() - .5) * .05 * (1 - Math.abs(B.back[0])), z = pz + B.back[1] * u * B.w + (rnd() - .5) * .05 * (1 - Math.abs(B.back[1]));
          const layer = u > .3 ? 'back' : u < -.35 ? 'front' : 'mid'; let f = pickForm(LAYER[layer], rnd()); if (f === 'cypress' || f === 'silver' || f === 'lemon') f = 'mound';
          if (layer !== 'front' && j % 3 === 0) putB(bush, rnd() < .5 ? G.leaf : G.leafD, x, z, Y + .02, .6 + rnd() * .4);
          const cf = COLOR_FOR[f]; putF(f, cf ? cf[Math.floor(rnd() * cf.length)] : (rnd() < .9 ? block : nextC), x, z, Y, layer === 'back' ? 1 + rnd() * .3 : .85 + rnd() * .35);
        }
      }
    }
    seed = s0;
  }
  const byGeo = new Map();
  for (const { geo, color, m } of lists.values()) { if (!byGeo.has(geo)) byGeo.set(geo, []); byGeo.get(geo).push({ color, m }); }
  const ic = new THREE.Color();
  for (const [geo, arr] of byGeo) {
    const n = arr.reduce((k, a) => k + a.m.length, 0); if (!n) continue;
    const im = new THREE.InstancedMesh(geo, geo === tuft ? mat('#ffffff', { side: THREE.DoubleSide }) : mat('#ffffff'), n);
    let i = 0; for (const { color, m } of arr) { ic.set(color); for (const mm of m) { im.setMatrixAt(i, mm); im.setColorAt(i, ic); i++; } }
    im.castShadow = geo !== tuft; im.receiveShadow = true; S.add(im);
  }
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
  if (!P && f.species && Hy.SPECIES[f.species] && Hy.SPECIES[f.species].rare) cs[0] = vivid(Hy.colorsOf(f)[0]);   /* 心情抽到少见的那种：打头那个色换成它的（Hy.colorsOf），常见的和老花照旧 */
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
  WX = weatherOf(list); applySky(); countDiaryDays(list);
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
  let press = null, cand = null; const ptrs = new Set();
  const cancelPress = () => { if (press) { clearTimeout(press); press = null; } cand = null; };
  /* 以前手指一落在花上就抓花、把镜头关掉，园子里花一多，一指拖几乎全被花吃了。
     现在落在花上先当挪镜头，按住不动 .35 秒才拎起来；点一下照旧看那天；第二根手指一落下就只管镜头 */
  const endDrag = () => { if (!drag) return; drag.o.position.y = .09; drag = null; CTL.enabled = true; dragging = false; shadowsDirty(); };
  for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault());   /* iOS：双指别把整页放大，交给镜头 */
  el.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); cancelPress(); endDrag(); down = null; });
  el.addEventListener('pointerdown', (e) => {
    if (e.isPrimary) { ptrs.clear(); cancelPress(); endDrag(); }   /* 新的一下：上一下要是漏了 pointerup（iOS 偶尔吞），别让镜头一直关着 */
    ptrs.add(e.pointerId);
    if (ptrs.size > 1) { cancelPress(); down = null; return; }
    down = { x: e.clientX, y: e.clientY }; pick(e);
    const h = ray.intersectObjects(flowers.map((f) => f.userData.hit))[0];
    if (h) {
      const o = h.object.userData.root, id = e.pointerId; cand = o;
      press = setTimeout(() => { press = null; if (cand !== o || !ptrs.has(id)) return; cand = null; drag = { o, moved: false }; dragging = true; CTL.enabled = false; o.position.y = .17; shadowsDirty(); wake(); try { el.setPointerCapture(id); } catch (err) {} }, 350);
      return;
    }
    const hv = ray.intersectObjects(VASE_HITS)[0];   /* 长按园子里的一盆插花收回去，腾出花位 */
    if (hv) { const v = hv.object.userData.vase; press = setTimeout(() => { press = null; down = null; takeVase(v); }, 650); return; }
    const hc = ray.intersectObjects(CLUMP_HITS)[0];
    if (hc) { const b = hc.object.userData.bed; press = setTimeout(() => { press = null; down = null; removeBed(b); }, 650); return; }
    const hp = nearField() && ray.intersectObjects(PLOT_HITS)[0];   /* 田边长按一块地：问拔不拔 */
    if (hp && FIELD[hp.object.userData.plot]) { const k = hp.object.userData.plot; press = setTimeout(() => { press = null; down = null; pullCard(k); }, 650); }
  });
  el.addEventListener('pointermove', (e) => { if (press && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) cancelPress(); });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) return;
    drag.moved = true; pick(e);
    if (ray.ray.intersectPlane(groundPlane, p) && okSpot(p.x, p.z)) { drag.o.position.set(p.x, .17, p.z); shadowsDirty(); }
  });
  el.addEventListener('pointerup', (e) => {
    ptrs.delete(e.pointerId);
    if (drag) {
      const o = drag.o, f = o.userData.f, moved = drag.moved; endDrag();
      if (moved) { f.x = o.position.x; f.z = o.position.z; dispatchEvent(new CustomEvent('flower-moved', { detail: f })); }
      else dispatchEvent(new CustomEvent('flower-pick', { detail: f }));
      return;
    }
    const tapped = cand; cancelPress();
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
      if (tapped) { down = null; dispatchEvent(new CustomEvent('flower-pick', { detail: tapped.userData.f })); return; }
      dispatchEvent(new CustomEvent('flower-none'));
      pick(e);
      const hp = nearField() && ray.intersectObjects(PLOT_HITS)[0];
      if (hp) { down = null; tapPlot(hp.object.userData.plot); return; }
      if (ray.intersectObjects(EXP_HITS)[0]) { down = null; openExpand(); return; }   /* 大门边那块「扩建」木牌 */
      hideFarmCard(); hideExpand();
      if (plantMode) { if (ray.ray.intersectPlane(groundPlane, p)) plantAt(p.x, p.z); down = null; return; }
      const hz = ray.intersectObjects(ZONES)[0];
      if (hz) goZone(hz.object.userData.zone); else if (away) goHome();
    }
    down = null;
  });
}
