// 日记花园 · 店里面：走进自己那栋店，玻璃柜摆厨房做的吃的，打烊结算看卖得怎么样，挣花币（念之外的另一种钱）
// 墙上软木板钉日记花园的明信片，门边信箱有镇上居民的纸条。画法同记忆小镇：卡通光、深棕描边、水彩后期
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mat, washTex, outline, lights, shadowAll } from './shop/look.js';
import { makeLook } from './town/look2.js';
import { C, archWindow, DECOR } from './shop/house.js';
import * as K from './town/food.js';
import { SPECIES, dishOf, useSpecies } from './town/mem.js';
import * as Day from './day.js';   /* 一天开一次店、结一次账、补一次货；种子铺 */
import './bag.js';   /* 背包 */
useSpecies(Day.seasonSpecs());   /* 应季菜（南瓜、栗子、柿子）登记进小镇的菜谱，后厨端出来的应季菜柜子里才摆得出来 */

const $ = (s) => document.querySelector(s);
const MOOD_C = { happy: '#f2c14e', sweet: '#e98aa4', calm: '#9ec5e6', coax: '#f3b9a0', down: '#b9a3de', messy: '#c9b38a', cross: '#e36a5a' };
const MAINS = ['heartberry', 'thoughtleaf', 'boltbean', 'palettemelon', 'tiderice', 'velvetgrape', 'lanternplant', 'twinpeach', 'bloom'];
const FOLKS = ['兔子阿灰', '松鼠栗栗', '刺猬老墨', '狐狸小满', '邮差小鸭', '鼹鼠土豆', '猫头鹰阿夜', '小羊棉棉', '獾子大福', '麻雀豆豆'];
const NOTES = [
  ['今天路过你家门口，玻璃柜里那盘闻着好香。', '兔子阿灰'],
  ['下雨那天你窗台的花开了，我站在屋檐下看了一会儿。', '邮差小鸭'],
  ['上次买的点心分给我妹妹了，她说下回要自己来挑。', '松鼠栗栗'],
  ['你店里的灯一直是暖的，晚上从这儿走过去，路都不黑了。', '刺猬老墨'],
  ['借了你门口那把伞，明天还你，伞骨我顺手修好了。', '狐狸小满'],
  ['我田里的番茄红了，下回给你捎两个，做菜试试。', '鼹鼠土豆'],
  ['听说你每天往花园里种一句话，我也想试试，就是不知道写什么。', '猫头鹰阿夜'],
  ['你柜子上那朵蓝色的小花是什么？我找了半个镇子都没找到一样的。', '小羊棉棉'],
];
let seed = 11; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ---------- 渲染 ----------
const R = new THREE.WebGLRenderer({ canvas: $('#cv'), antialias: true });
R.setPixelRatio(Math.min(1.5, devicePixelRatio)); R.outputColorSpace = THREE.SRGBColorSpace;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.setSize(innerWidth, innerHeight, false);
const S = new THREE.Scene(); S.background = new THREE.Color('#fbf8f2');
const CAM = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .1, 60);
const CTL = new OrbitControls(CAM, R.domElement);
CTL.target.set(0, 1.05, -.3); CTL.enableDamping = true; CTL.enablePan = false;
CTL.minDistance = 4.2; CTL.maxDistance = 16; CTL.minPolarAngle = .78; CTL.maxPolarAngle = 1.38;
CTL.minAzimuthAngle = -.7; CTL.maxAzimuthAngle = .7;
const SUN = lights(S, { sun: [1.5, 7, 6], range: 5, target: [0, 0, -.5] }); SUN.shadow.mapSize.set(1024, 1024);
let dirty = 3; function markDirty() { dirty = 2; }
const LOOK = makeLook(R, '#fbf8f2'); LOOK.setTilt(.22, .55); LOOK.setWarm(.3);
/* 一盏偏冷的补光，阴影别发黄 */
const cool = new THREE.DirectionalLight('#dfe8f5', .55); cool.position.set(-4, 5, 3); S.add(cool);
function resize() {
  markDirty();
  const w = innerWidth, h = innerHeight; R.setSize(w, h, false); LOOK.resize(); CAM.aspect = w / h; CAM.updateProjectionMatrix();
  const d = w < h ? 11 : 7, el = w < h ? .4 : .3; CAM.position.set(0, CTL.target.y + d * el, CTL.target.z + d);
}
addEventListener('resize', resize);

const wash = (c, o = {}) => mat('#ffffff', { map: washTex(c, { blots: 36, seed: o.seed || 3, rep: o.rep || [2, 2] }) });
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof m === 'string' ? mat(m) : m);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

// ---------- 屋子：一面开着的小咖啡甜品店，像过家家的娃娃屋 ----------
const W = 4.8, D = 4.4, H = 3;
/* 后墙：拱窗中心 WIN_X，后厨门中心 KIT_X */
const WIN_X = -1.5, KIT_X = -.2;
const room = new THREE.Group();
function buildRoom() {
  /* 地板：默认原木；?floor=light 浅色洗白橡木；?floor=tile 奶油配鼠尾草绿的棋盘砖 */
  const FLOOR = new URLSearchParams(location.search).get('floor');
  if (FLOOR === 'tile') {
    const n = 8, sz = W / n, rows = Math.ceil(D / sz);
    for (let i = 0; i < n; i++) for (let j = 0; j < rows; j++) { const t = box(sz - .015, .08, Math.min(sz, D - j * sz) - .015, (i + j) % 2 ? '#f3ecdc' : '#a9bea0'); at(t, -W / 2 + (i + .5) * sz, -.04, -D / 2 + j * sz + Math.min(sz, D - j * sz) / 2); t.userData.lineW = .003; room.add(t); }
  } else {
    const pal = FLOOR === 'light' ? ['#e4d8c4', '#ddd0bb', '#e9dfcd'] : ['#ae8357', '#a77d58', '#b88a5e'];
    for (let i = 0; i < 12; i++) { const p = box(W / 12 - .01, .08, D, pal[i % 3]); at(p, -W / 2 + (i + .5) * W / 12, -.04, 0); p.userData.lineW = .004; room.add(p); }
  }
  const wallM = wash('#f6f1e8', { rep: [3, 2], seed: 4 });
  const back = at(box(W + .24, H, .12, wallM), 0, H / 2, -D / 2 - .06); room.add(back);
  const left = at(box(.12, H, D, wallM), -W / 2 - .06, H / 2, 0); left.userData.side = 'L'; room.add(left);
  const right = at(box(.12, H, D, wallM), W / 2 + .06, H / 2, 0); right.userData.side = 'R'; room.add(right);
  /* 墙裙：墨绿护墙板一圈，上沿一道木线 */
  for (const [w, d, x, z, sd] of [[W, .04, 0, -D / 2 + .02, ''], [.04, D, -W / 2 + .02, 0, 'L'], [.04, D, W / 2 - .02, 0, 'R']]) {
    const a = at(box(w, .95, d, C.teal), x, .475, z), b = at(box(w + (d > .1 ? 0 : .02), .05, d + (d > .1 ? .02 : 0) + .03, C.trim), x, .97, z);
    a.userData.side = b.userData.side = sd; room.add(a, b);
  }
  for (let i = 0; i < 7; i++) { const pnl = box(.5, .55, .02, C.tealD); at(pnl, -1.95 + i * .65, .47, -D / 2 + .05); pnl.userData.lineW = .004; room.add(pnl); }
  /* 后墙左边一扇拱窗，亮着 */
  const win = archWindow(1.05, 1.5, { frame: C.teal, lit: true, surround: C.trim }); at(win, WIN_X, 1.1, -D / 2 + .01); room.add(win);
  /* 左墙一扇窗，窗下一张小圆桌两把椅子 */
  const win2 = archWindow(.9, 1.3, { frame: C.teal, lit: true, surround: C.trim }); win2.rotation.y = Math.PI / 2; at(win2, -W / 2 + .01, 1.15, 1.15); win2.userData.side = 'L'; room.add(win2);
  room.add(table(-1.6, 1.15));
  /* 右墙：门，门上半截玻璃 */
  const door = new THREE.Group();
  door.add(at(box(.08, 2.1, 1.05, C.teal), 0, 1.05, 0));
  const dg = at(box(.09, .8, .7, mat(C.glass, { emissive: new THREE.Color('#e8b866'), emissiveIntensity: .3 })), 0, 1.5, 0); dg.userData.noLine = true; door.add(dg);
  door.add(at(box(.1, .06, 1.15, C.trim), 0, 2.13, 0));
  const knob = at(new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 6), mat('#c9a24a')), -.07, 1.0, -.38); door.add(knob);
  at(door, W / 2 - .04, 0, 1.2); door.userData.side = 'R'; room.add(door);
  const mat1 = at(box(.9, .02, .6, '#9f3726'), W / 2 - .55, .01, 1.2); room.add(mat1);
  /* 柜台：靠后墙右边，墨绿柜身木台面，上面咖啡机、收银机、一罐饼干 */
  const ctr = new THREE.Group();
  ctr.add(at(box(2.0, 1.0, .7, C.teal), 0, .5, 0));
  for (let i = 0; i < 3; i++) { const p = box(.52, .6, .02, C.tealD); at(p, -.64 + i * .64, .5, .36); p.userData.lineW = .004; ctr.add(p); }
  ctr.add(at(box(2.12, .07, .8, '#9a6b4c'), 0, 1.035, 0));
  const cm = new THREE.Group(); cm.add(at(box(.42, .5, .35, '#c9ced6'), 0, .25, 0)); cm.add(at(box(.3, .06, .2, '#3c3432'), 0, .1, .12)); cm.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.05, .04, .08, 10), mat('#fbf6ec')), 0, .05, .14));
  ctr.add(at(cm, .6, 1.07, -.1));
  const reg = new THREE.Group(); reg.add(at(box(.36, .2, .3, '#8e3434'), 0, .1, 0)); const scr = at(box(.24, .14, .03, '#f3e7d1'), 0, .27, -.06); scr.rotation.x = -.4; reg.add(scr);
  ctr.add(at(reg, -.6, 1.07, 0));
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .26, 14), mat('#e8f0f0', { transparent: true, opacity: .5 })); jar.userData.noLine = true; ctr.add(at(jar, -.05, 1.2, .05));
  for (let i = 0; i < 5; i++) { const ck = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .015, 10), mat('#d9a25e')); ck.userData.noLine = true; ctr.add(at(ck, -.05 + (i % 2 - .5) * .05, 1.1 + i * .035, .05)); }
  at(ctr, 1.3, 0, -D / 2 + .55); room.add(ctr);
  /* 柜台上方：黄白条的布檐子，墙上一排小架子放罐子 */
  const val = new THREE.Group();
  for (let i = 0; i < 8; i++) { const st = box(.25, .32, .04, i % 2 ? C.white : C.butter); at(st, -.875 + i * .25, 0, 0); st.userData.lineW = .004; val.add(st); const sc = new THREE.Mesh(new THREE.CylinderGeometry(.125, .125, .04, 12, 1, false, 0, Math.PI), mat(i % 2 ? C.white : C.butter)); sc.rotation.set(Math.PI / 2, 0, Math.PI / 2); at(sc, -.875 + i * .25, -.16, 0); sc.userData.lineW = .004; val.add(sc); }
  at(val, 1.3, 2.55, -D / 2 + .1); room.add(val);
  const shelf = at(box(1.8, .05, .25, '#9a6b4c'), 1.3, 1.95, -D / 2 + .14); room.add(shelf);
  ['#e98aa4', '#f2c14e', '#9ec5e6', '#b9a3de', '#8fae5a'].forEach((c, i) => { const j = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .2, 10), mat(c)); at(j, .62 + i * .34, 2.08, -D / 2 + .15); room.add(j); const lid = new THREE.Mesh(new THREE.CylinderGeometry(.085, .085, .04, 10), mat('#9a6b4c')); at(lid, .62 + i * .34, 2.2, -D / 2 + .15); room.add(lid); });
  /* 壁灯两盏：没有天花板的娃娃屋里吊灯是飘着的，改成从墙上伸出一根铁臂挑着灯罩 */
  for (const [x, z, ry, sd] of [[.15, -D / 2, 0, ''], [-W / 2, 1.15, Math.PI / 2, 'L']]) {
    const g = new THREE.Group();
    g.add(at(box(.14, .2, .04, C.iron), 0, 0, .02));
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .42, 6), mat(C.iron)); arm.rotation.x = Math.PI / 2; arm.userData.noLine = true; g.add(at(arm, 0, .05, .23));
    const drop = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .14, 5), mat(C.iron)); drop.userData.noLine = true; g.add(at(drop, 0, -.02, .43));
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.18, .17, 16, 1, true), mat(C.teal, { side: THREE.DoubleSide })); g.add(at(shade, 0, -.15, .43));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.06, 10, 8), mat('#fff3c8', { emissive: new THREE.Color('#ffd27a'), emissiveIntensity: .9 })); bulb.userData.noLine = true; g.add(at(bulb, 0, -.23, .43));
    const pl = new THREE.PointLight('#fff0dc', 1.1, 4, 1.6); g.add(at(pl, 0, -.4, .55));
    g.rotation.y = ry; at(g, x, 2.35, z); g.userData.side = sd; g.traverse(o => { if (sd) o.userData.side = sd; }); room.add(g);
  }
  /* 角落两盆植物 */
  for (const [x, z, s] of [[-2.0, -1.75, 1], [2.0, 1.85, .85]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.2 * s, .15 * s, .3 * s, 12), mat('#c4846a')); room.add(at(pot, x, .15 * s, z));
    for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(.16 * s, 0), mat(i % 2 ? C.leaf : C.leafD)); room.add(at(l, x + Math.cos(i) * .12 * s, (.45 + (i % 3) * .14) * s, z + Math.sin(i) * .12 * s)); }
  }
}
function teacup() {
  const g = new THREE.Group();
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.075, .065, .012, 16), mat(C.white)), 0, .006, 0));
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(.045, .032, .055, 14), mat(C.white)); g.add(at(cup, 0, .04, 0));
  const tea = new THREE.Mesh(new THREE.CircleGeometry(.04, 14), mat('#b8743a')); tea.rotation.x = -Math.PI / 2; tea.userData.noLine = true; g.add(at(tea, 0, .066, 0));
  const hd = new THREE.Mesh(new THREE.TorusGeometry(.018, .005, 5, 10), mat(C.white)); g.add(at(hd, .05, .042, 0));
  const band = new THREE.Mesh(new THREE.TorusGeometry(.043, .004, 4, 18), mat('#7fa6c9')); band.rotation.x = Math.PI / 2; band.userData.noLine = true; g.add(at(band, 0, .055, 0));
  return g;
}
function teapot() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(.1, 16, 12), mat(C.white)); body.scale.y = .8; g.add(at(body, 0, .085, 0));
  const band = new THREE.Mesh(new THREE.TorusGeometry(.1, .006, 4, 24), mat('#7fa6c9')); band.rotation.x = Math.PI / 2; band.userData.noLine = true; g.add(at(band, 0, .085, 0));
  const lid = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.white)); g.add(at(lid, 0, .15, 0));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), mat('#7fa6c9')), 0, .205, 0));
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(.012, .022, .1, 8), mat(C.white)); sp.rotation.z = -.9; g.add(at(sp, .12, .1, 0));
  const hd = new THREE.Mesh(new THREE.TorusGeometry(.045, .01, 6, 14, Math.PI * 1.2), mat(C.white)); hd.rotation.z = Math.PI / 2 - .3; g.add(at(hd, -.1, .09, 0));
  return g;
}
function table(x, z) {
  const g = new THREE.Group();
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, .045, 20), mat(C.white)), 0, .74, 0));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.03, .06, .74, 8), mat(C.iron)), 0, .37, 0));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.2, .22, .03, 14), mat(C.iron)), 0, .015, 0));
  g.add(at(teapot(), .1, .765, .02));
  for (const [cx, cz] of [[-.2, .16], [.24, -.18]]) g.add(at(teacup(), cx, .765, cz));
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, .14, 10), mat('#9ec5e6')); g.add(at(vase, -.1, .83, -.08));
  for (let i = 0; i < 3; i++) { const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(.035, 0), mat(['#e98aa4', '#fbf6ec', '#f2c14e'][i])); g.add(at(fl, -.1 + (i - 1) * .04, .95 + (i % 2) * .03, -.08)); }
  for (const s of [-1, 1]) {
    const ch = new THREE.Group();
    ch.add(at(box(.36, .04, .36, '#9a6b4c'), 0, .45, 0));
    const bk = at(box(.36, .42, .04, '#9a6b4c'), 0, .68, -.17); ch.add(bk);
    for (const [a, b] of [[-.15, -.15], [.15, -.15], [-.15, .15], [.15, .15]]) ch.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .45, 5), mat(C.iron)), a, .225, b));
    ch.rotation.y = s > 0 ? 0 : Math.PI; at(ch, 0, 0, s * .55); g.add(ch);
  }
  return at(g, x, 0, z);
}

// ---------- 玻璃展示柜：三层，一层三格 ----------
const CASE = { x: .15, z: -.3, w: 2.0, d: .8 }, SHELF_Y = [.42, .78, 1.14], COL_X = [-.62, 0, .62];
const slotsG = new THREE.Group(); const hits = [];
function buildCase() {
  const g = new THREE.Group();
  g.add(at(box(CASE.w, .3, CASE.d, C.teal), 0, .15, 0));
  g.add(at(box(CASE.w + .06, .04, CASE.d + .06, '#9a6b4c'), 0, .32, 0));
  const glassM = new THREE.MeshPhysicalMaterial({ color: '#eef6f6', transparent: true, opacity: .14, roughness: .05, metalness: 0, depthWrite: false });
  const gl = new THREE.Mesh(new THREE.BoxGeometry(CASE.w, 1.12, CASE.d), glassM); gl.userData.noLine = true; at(gl, 0, .9, 0); g.add(gl);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(box(.04, 1.12, .04, '#c9a24a'), x * CASE.w / 2, .9, z * CASE.d / 2));
  for (const [w, d, x, z] of [[CASE.w + .04, .04, 0, -CASE.d / 2], [CASE.w + .04, .04, 0, CASE.d / 2], [.04, CASE.d, -CASE.w / 2, 0], [.04, CASE.d, CASE.w / 2, 0]]) g.add(at(box(w, .04, d, '#c9a24a'), x, 1.47, z));
  for (const y of SHELF_Y.slice(1)) { const sh = new THREE.Mesh(new THREE.BoxGeometry(CASE.w - .06, .02, CASE.d - .06), new THREE.MeshPhysicalMaterial({ color: '#f4f8f8', transparent: true, opacity: .35, depthWrite: false })); sh.userData.noLine = true; at(sh, 0, y - .01, 0); g.add(sh); }
  at(g, CASE.x, 0, CASE.z); return g;
}
/* 下午茶：三层点心架、切块蛋糕、司康、手指三明治、马卡龙 */
const TEA = {
  stand:    ['三层下午茶', '最下层三明治，中间司康，顶上马卡龙和小奶油花，从下往上吃。', 95],
  slice:    ['切块蛋糕', '一角海绵夹奶油，顶上一颗莓。', 50],
  scone:    ['司康配果酱', '掰开抹一层奶油，再抹果酱，顺序别弄反。', 42],
  sandwich: ['手指三明治', '去了边，切成细条，一口一个。', 38],
  macaron:  ['马卡龙一碟', '几种颜色各来一个。', 46],
};
const SLICE_C = [['#f3d9a6', '#f2a8a0', '草莓'], ['#c9dca0', '#fbf3e6', '抹茶'], ['#7a5236', '#f3e7d1', '可可']];
function teaDish(sd) {
  seed = sd; const kinds = Object.keys(TEA), t = kinds[Math.floor(rnd() * kinds.length)], [nm, about, price] = TEA[t];
  const fl = t === 'slice' ? SLICE_C[Math.floor(rnd() * 3)] : null;
  return { tea: t, seed: sd, name: fl ? fl[2] + nm : nm, about, price, keys: [], form: 'tea' };
}
const ball = (r, c, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), mat(c)); m.scale.set(sx, sy, sz); m.userData.lineW = .004; return m; };
function scone() { const g = new THREE.Group(); g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.11, .12, .1, 14), mat('#e2b57e')), 0, .05, 0)); g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.1, .11, .02, 14), mat('#c98f52')), 0, .105, 0)); return g; }
function sandwich(c) { const g = new THREE.Group(); g.add(at(box(.26, .03, .08, '#f6eedf'), 0, .015, 0)); const f = at(box(.26, .02, .08, c), 0, .04, 0); f.userData.noLine = true; g.add(f); g.add(at(box(.26, .03, .08, '#f6eedf'), 0, .065, 0)); return g; }
function macaron(c) { const g = new THREE.Group(); for (const y of [0, .045]) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.055, .06, .032, 16), mat(c)), 0, .016 + y, 0)); const fl = at(new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .014, 16), mat('#fbf3e6')), 0, .039, 0); fl.userData.noLine = true; g.add(fl); return g; }
const MAC_C = ['#efb3bf', '#b9cf8f', '#f3e1b0', '#b9a3de', '#9ec5e6'];
function plate(r = .42) { const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * .7, .04, 28), mat(C.white)); p.position.y = .02; const rim = new THREE.Mesh(new THREE.TorusGeometry(r * .97, .008, 4, 40), mat('#7fa6c9')); rim.rotation.x = Math.PI / 2; rim.position.y = .042; rim.userData.noLine = true; const g = new THREE.Group(); g.add(p, rim); return g; }
function teaMesh(d) {
  seed = d.seed; const g = new THREE.Group(), t = d.tea;
  if (t === 'stand') {
    const v = K.vessel('heartberry', 'stand'); g.add(v);
    const cs = []; v.traverse((o) => { if (o.userData && o.userData.catch) cs.push(o); }); cs.sort((a, b) => a.position.y - b.position.y);
    const fill = [(i) => sandwich(['#8fae5a', '#e9a3a8', '#f2c94c'][i % 3]), () => scone(), (i) => i % 2 ? macaron(MAC_C[i % 5]) : K.piece('cream', i)];
    cs.forEach((c, lv) => { const n = lv === 2 ? 4 : 5; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + lv, r = c.userData.disc * .55, it = fill[lv](i); it.position.set(Math.cos(a) * r, c.position.y, Math.sin(a) * r); it.rotation.y = -a; it.scale.setScalar(lv === 2 && i % 2 === 0 ? 2.2 : 1.6); g.add(it); } });
  } else if (t === 'slice') {
    const fl = SLICE_C.find((f) => d.name.startsWith(f[2])) || SLICE_C[0];
    g.add(plate());
    const sl = new THREE.Group();
    [[0, .09, fl[0]], [.09, .025, fl[1]], [.115, .09, fl[0]], [.205, .03, '#fbf3e6']].forEach(([y, h, c]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, h, 20, 1, false, 0, .75), mat(c)); m.position.y = .045 + y + h / 2; sl.add(m); });
    sl.position.x = -.12; sl.rotation.y = .6; g.add(sl);
    const b = ball(.045, '#d8343c'); b.position.set(.02, .3, -.05); g.add(b);
    const cr = K.piece('cream', d.seed); cr.scale.setScalar(1.6); cr.position.set(.1, .26, .05); g.add(cr);
  } else if (t === 'scone') {
    g.add(plate());
    for (const [x, z] of [[-.13, .02], [.12, -.06]]) { const s2 = scone(); s2.position.set(x, .04, z); g.add(s2); }
    const jam = new THREE.Mesh(new THREE.CylinderGeometry(.06, .05, .05, 12), mat('#b8323c')); jam.position.set(.05, .065, .2); g.add(jam);
    const cr = ball(.06, '#fbf3e6', 1, .7, 1); cr.position.set(-.1, .2, .02); g.add(cr);
  } else if (t === 'sandwich') {
    const bd = box(.62, .04, .36, '#a77d58'); bd.position.y = .02; g.add(bd);
    for (let i = 0; i < 4; i++) { const s2 = sandwich(['#8fae5a', '#e9a3a8', '#f2c94c', '#8fae5a'][i]); s2.rotation.y = Math.PI / 2; s2.position.set(-.21 + i * .14, .04, 0); g.add(s2); }
  } else {
    g.add(plate());
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, m = macaron(MAC_C[i]); m.position.set(Math.cos(a) * .2, .04, Math.sin(a) * .2); m.scale.setScalar(1.4); g.add(m); }
    const m = macaron(MAC_C[(d.seed % 5)]); m.scale.setScalar(1.4); m.position.set(0, .12, 0); m.rotation.z = .4; g.add(m);
  }
  return g;
}
/* 物价跟种子一起涨：一样菜 44、两样 56、三样 68，隐藏菜 +20、做成蛋糕 +14，卖一盘差不多换一包种子 */
function priceOf(keys, special, form) { return 32 + keys.length * 12 + (special ? 20 : 0) + (form === 'cake' ? 14 : 0); }
function newDish(sd) {
  seed = sd; if (rnd() < .45) return teaDish(sd + 1); seed = sd; const n = 1 + Math.floor(rnd() * 3), keys = [];
  while (keys.length < n) { const k = MAINS[Math.floor(rnd() * MAINS.length)]; if (!keys.includes(k)) keys.push(k); }
  const form = rnd() < .3 ? 'cake' : 'plain', d = dishOf(keys);
  const name = form === 'cake' ? d.name + '蛋糕' : d.name;
  return { keys, form, seed: sd, name, about: d.about, special: !!d.special, price: priceOf(keys, d.special, form) };
}
function dishMesh(dsh) {
  if (dsh.tea) { const tg = teaMesh(dsh); outline(tg, { w: .006 }); shadowAll(tg); return fitDish(tg, dsh.tea === 'stand' ? .3 : .22); }
  const g = new THREE.Group(); seed = dsh.seed;
  const v = Day.tintVessel(K.vessel(Day.seasonVessel(dsh.keys[0]), dsh.form), dsh.keys[0], dsh.form); g.add(v);
  const catches = []; v.traverse((o) => { if (o.userData && o.userData.catch) catches.push(o); });
  const list = dsh.keys.flatMap((k) => [k, k, k]).concat(K.EXTRA[dsh.form] || []);
  list.forEach((k, i) => {
    const c = catches[i % catches.length], u = c.userData, p = K.piece(k, dsh.seed + i);
    let x = c.position.x, z = c.position.z;
    if (u.disc) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * u.disc * .65; x += Math.cos(a) * r; z += Math.sin(a) * r; }
    else { x += (rnd() - .5) * u.rect[0] * .7; z += (rnd() - .5) * u.rect[1] * .7; }
    p.position.set(x, c.position.y, z); p.rotation.y = rnd() * 6.28; p.scale.setScalar(2.2); g.add(p);
  });
  outline(g, { w: .006 }); shadowAll(g);
  return fitDish(g, .24);
}
/* 一格宽 .62：吃的最宽 .4，留出空隙不挤 */
function fitDish(g, maxH) {
  const bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3());
  g.scale.setScalar(Math.min(.4 / Math.max(sz.x, sz.z), maxH / Math.max(.01, sz.y))); return g;
}
function tagTex(text, price) {
  const c = document.createElement('canvas'); c.width = 336; c.height = 120; const x = c.getContext('2d');
  x.fillStyle = '#fffdf8'; x.fillRect(0, 0, 336, 120); x.strokeStyle = '#9f3726'; x.lineWidth = 4; x.strokeRect(5, 5, 326, 110);
  x.fillStyle = '#4a3c37'; x.font = '38px "MaoKenTangYuan (beta)","PingFang SC",sans-serif'; x.textAlign = 'center';
  const t = text.length > 6 ? text.slice(0, 5) + '…' : text; x.fillText(t, 168, 52); x.fillStyle = '#9f3726'; x.font = '34px "MaoKenTangYuan (beta)","PingFang SC",sans-serif'; x.fillText(price + ' 花币', 168, 98);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
let STATE = null;
function loadState() {
  try { STATE = JSON.parse(localStorage.getItem('diarytown_case') || 'null'); } catch (e) { STATE = null; }
  /* 柜子起步是空的，不再自己变出菜来 */
  if (!Array.isArray(STATE) || STATE.length !== 9) { STATE = Array(9).fill(null); saveState(); return; }
  /* 换了物价：柜子里早就摆着的按新价钱重算 */
  STATE = STATE.map((d) => !d ? null : { ...d, price: d.tea ? (TEA[d.tea] ? TEA[d.tea][2] : d.price) : priceOf(d.keys || [], d.special, d.form) }); saveState();
}
const saveState = () => { try { localStorage.setItem('diarytown_case', JSON.stringify(STATE)); } catch (e) {} };
const tagsEl = $('#tags'), TAGS = [];
function placeTags() { const r = R.domElement.getBoundingClientRect(), v = new THREE.Vector3(); for (const t of TAGS) { v.copy(t.p).project(CAM); t.el.style.transform = `translate(${(v.x + 1) / 2 * r.width}px,${(1 - v.y) / 2 * r.height}px) translate(-50%,-60%)`; } }
function renderCase() {
  slotsG.clear(); hits.length = 0; tagsEl.replaceChildren(); TAGS.length = 0;
  STATE.forEach((dsh, i) => {
    const row = Math.floor(i / 3), col = i % 3, x = CASE.x + COL_X[col], y = SHELF_Y[row], z = CASE.z;
    if (!dsh) return;
    const m = dishMesh(dsh); m.position.set(x, y, z - .06); slotsG.add(m);
    /* 价签用网页字浮在格子前沿，手机上 3D 贴图字太小看不清 */
    const lb = document.createElement('div'); lb.className = 'tag'; lb.innerHTML = '<i></i>' + dsh.price; tagsEl.appendChild(lb); TAGS.push({ el: lb, p: new THREE.Vector3(x - .22, y + .01, z + CASE.d / 2) });
    const hit = new THREE.Mesh(new THREE.BoxGeometry(.6, .32, CASE.d), new THREE.MeshBasicMaterial({ visible: false })); at(hit, x, y + .15, z); hit.userData = { slot: i, noLine: true }; slotsG.add(hit); hits.push(hit);
  });
  dayBar();
  markDirty();
}

// ---------- 软木板：钉日记花园的明信片 ----------
const board = new THREE.Group(); const cardHits = [];
function cardTex(f) {
  return new Promise((ok) => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 210; const x = c.getContext('2d');
    x.fillStyle = '#fbf6ec'; x.fillRect(0, 0, 300, 210);
    const ids = f.moods && f.moods.length ? f.moods : [f.mood], cols = ids.map((id) => MOOD_C[id] || '#e98aa4');
    const finish = () => {
      x.strokeStyle = 'rgba(91,74,68,.25)'; x.beginPath(); x.moveTo(160, 22); x.lineTo(160, 188); x.stroke();
      const d = new Date(f.at); x.fillStyle = '#a8968c'; x.font = '15px "MaoKenTangYuan (beta)","PingFang SC",sans-serif'; x.fillText(`${d.getMonth() + 1}.${d.getDate()}`, 172, 40);
      x.fillStyle = '#5b4a44'; x.font = '19px "MaoKenTangYuan (beta)","PingFang SC",sans-serif';
      let ln = '', y = 72; for (const ch of (f.text || '')) { if (x.measureText(ln + ch).width > 112) { x.fillText(ln, 172, y); y += 26; ln = ch; if (y > 176) break; } else ln += ch; } if (y <= 176 && ln) x.fillText(ln, 172, y);
      cols.forEach((cc, i) => { x.fillStyle = cc; x.beginPath(); x.arc(270 - i * 14, 186, 6, 0, 7); x.fill(); });
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; ok({ t, url: c.toDataURL('image/jpeg', .9) });
    };
    if (f.photo) { const im = new Image(); im.onload = () => { const k = Math.max(140 / im.width, 170 / im.height); x.save(); x.beginPath(); x.rect(14, 20, 140, 170); x.clip(); x.drawImage(im, 14 + (140 - im.width * k) / 2, 20 + (170 - im.height * k) / 2, im.width * k, im.height * k); x.restore(); finish(); }; im.onerror = () => { flowerBlock(x, cols); finish(); }; im.src = f.photo; }
    else { flowerBlock(x, cols); finish(); }
  });
}
function flowerBlock(x, cols) {
  x.fillStyle = '#e9e2cf'; x.fillRect(14, 20, 140, 170);
  x.fillStyle = '#7f9a6a'; x.fillRect(82, 105, 4, 70);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2; x.fillStyle = cols[i % cols.length]; x.beginPath(); x.ellipse(84 + Math.cos(a) * 20, 92 + Math.sin(a) * 20, 15, 11, a, 0, 7); x.fill(); }
  x.fillStyle = '#f2d27a'; x.beginPath(); x.arc(84, 92, 9, 0, 7); x.fill();
}
const SAMPLES = [
  { at: Date.now() - 2 * 864e5, mood: 'happy', text: '下午的光很好，想把它留下来' },
  { at: Date.now() - 5 * 864e5, mood: 'calm', moods: ['calm', 'sweet'], text: '走路回家看见晚霞' },
  { at: Date.now() - 9 * 864e5, mood: 'down', text: '有点累，但还行' },
  { at: Date.now() - 12 * 864e5, mood: 'sweet', text: '路边的猫让我摸了' },
];
function readFlowers() {
  /* 只读：库不存在就别建，onupgradeneeded 里直接 abort，免得建出一个空库把花园那边的版本占了 */
  return new Promise((ok) => {
    let r; try { r = indexedDB.open('diarytown', 1); } catch (e) { return ok([]); }
    r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) {} };
    r.onerror = () => ok([]); r.onblocked = () => ok([]);
    r.onsuccess = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('flowers')) { d.close(); return ok([]); }
      const q = d.transaction('flowers', 'readonly').objectStore('flowers').getAll();
      q.onsuccess = () => { d.close(); ok(q.result || []); }; q.onerror = () => { d.close(); ok([]); };
    };
  });
}
async function buildBoard() {
  const g = board;
  g.add(at(box(1.9, 1.2, .06, '#9a6b4c'), 0, 0, 0));
  g.add(at(box(1.78, 1.08, .07, wash('#c99a66', { rep: [1, 1], seed: 8 })), 0, 0, .01));
  let list = (await readFlowers()).filter((f) => !f.wild && (f.text || f.photo)).sort((a, b) => b.at - a.at).slice(0, 6);
  if (!list.length) list = SAMPLES;
  const spots = [[-.58, .25], [0, .28], [.58, .22], [-.55, -.27], [.03, -.25], [.6, -.29]];
  for (let i = 0; i < list.length; i++) {
    const { t, url } = await cardTex(list[i]);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(.5, .35), new THREE.MeshToonMaterial({ map: t }));
    const [x, y] = spots[i]; at(card, x, y, .06); card.rotation.z = (i % 2 ? 1 : -1) * (.04 + (i * .013) % .06); card.userData = { noLine: true, card: list[i], url };
    g.add(card); cardHits.push(card);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), mat(['#9f3726', '#efcb68', '#3e786f'][i % 3])); at(pin, x, y + .14, .08); g.add(pin);
  }
  g.rotation.y = Math.PI / 2; at(g, -W / 2 + .05, 1.85, -.95);
  outline(g, { w: .006 }); shadowAll(g); S.add(g);
  markDirty();
}

// ---------- 信箱：门边一只小红信箱 ----------
const mailbox = new THREE.Group();
function buildMailbox() {
  const post = at(box(.08, 1.0, .08, '#9a6b4c'), 0, .5, 0); mailbox.add(post);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .42, 16, 1, false, 0, Math.PI), mat(C.red)); body.rotation.set(0, 0, Math.PI / 2); body.rotation.y = Math.PI / 2; at(body, 0, 1.05, 0); mailbox.add(body);
  mailbox.add(at(box(.36, .2, .42, C.red), 0, .96, 0));
  const flag = at(box(.03, .22, .06, '#efcb68'), .2, 1.15, .1); mailbox.add(flag);
  const slot = at(box(.2, .03, .01, C.iron), 0, 1.0, .215); slot.userData.noLine = true; mailbox.add(slot);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(.5, .6, .6), new THREE.MeshBasicMaterial({ visible: false })); at(hit, 0, 1.0, 0); hit.userData = { mail: true, noLine: true }; mailbox.add(hit);
  mailbox.rotation.y = -Math.PI / 2 + .35; at(mailbox, W / 2 - .42, 0, .3);
  outline(mailbox, { w: .008 }); shadowAll(mailbox); S.add(mailbox);
}

// ---------- 点东西 ----------
const ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
let down = null;
R.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
R.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
  down = null; const r = R.domElement.getBoundingClientRect();
  v2.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(v2, CAM);
  const h = ray.intersectObjects([...hits, ...cardHits, mailbox.children[mailbox.children.length - 1], kitDoor], false)[0];
  closeAll();
  if (!h) return;
  const u = h.object.userData;
  if (u.slot !== undefined) showDish(STATE[u.slot]);
  else if (u.card) showCard(u.card, u.url);
  else if (u.mail) showNote();
  else if (u.kitchen) location.href = 'kitchen.html';
});
function closeAll() { document.querySelectorAll('.sheet').forEach((s) => { s.hidden = true; }); }
document.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => { b.parentElement.hidden = true; });
function showDish(d) {
  if (!d) return;
  $('#dName').textContent = d.name;
  $('#dMeta').textContent = d.tea ? `${d.price} 花币 · 下午茶` : `${d.price} 花币 · 用了 ${d.keys.map((k) => SPECIES[k]?.zh || k).join('、')}${d.form === 'cake' ? ' · 做成蛋糕' : ''}`;
  $('#dAbout').textContent = d.about || ''; $('#dish').hidden = false;
}
function showCard(f, url) { $('#pcImg').src = url; const d = new Date(f.at); $('#pcMeta').textContent = `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 从花园寄回来的`; $('#pcBig').hidden = false; }
let lastNote = -1;
function showNote() { let i; do { i = Math.floor(Math.random() * NOTES.length); } while (i === lastNote && NOTES.length > 1); lastNote = i; $('#nTxt').textContent = NOTES[i][0]; $('#nSign').textContent = '—— ' + NOTES[i][1]; $('#note').hidden = false; }

// ---------- 花币、打烊结算、补货 ----------
const getCoins = () => { try { return +(localStorage.getItem('diarytown_coins') || 0) || 0; } catch (e) { return 0; } };
const setCoins = (n) => { try { localStorage.setItem('diarytown_coins', String(n)); } catch (e) {} $('#coins').innerHTML = `花币 <b>${n}</b>`; };
setCoins(getCoins());
$('#close').onclick = () => {
  closeAll(); if (!Day.once('settle')) { dayBar(); return; }
  /* 一天只卖掉一盘。改成柜子里的七成到全部都卖掉，隐藏菜和蛋糕先被挑走，剩下的随机 */
  const sold = []; let sum = 0;
  const full = STATE.map((d, i) => d ? i : -1).filter((i) => i >= 0);
  const n = Math.max(1, Math.round(full.length * (.7 + Math.random() * .3)));
  const want = (d) => (d.special ? 2 : 0) + (d.form === 'cake' ? 1 : 0) + Math.random() * 1.5;
  full.map((i) => [i, want(STATE[i])]).sort((a, b) => b[1] - a[1]).slice(0, n).forEach(([i]) => {
    const d = STATE[i]; sold.push({ d, who: pick(FOLKS) }); sum += d.price; STATE[i] = null;
  });
  saveState(); renderCase(); setCoins(getCoins() + sum);
  const left = STATE.filter(Boolean).length;
  $('#bDate').textContent = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }) + ' 打烊';
  $('#bList').innerHTML = sold.length ? sold.map((s) => `<li><span>${s.who} 买走了 ${s.d.name}</span><b>+${s.d.price}</b></li>`).join('') : '<li><span>今天没人进门，柜子里的明天接着摆</span></li>';
  $('#bLeft').textContent = left ? `还剩 ${left} 样` : '柜子卖空了';
  $('#bSum').textContent = sum + ' 花币';
  $('#bill').hidden = false; dayBar();
};
/* 补货：打开后厨做好的那摞盘子（diarytown_dishes），挑一盘点空格摆上去；点有菜的格子收回来。
   打烊结算以后柜子锁到明天 */
const bag = () => { try { return JSON.parse(localStorage.getItem('diarytown_dishes') || '[]') || []; } catch (e) { return []; } };
const saveBag = (l) => { try { localStorage.setItem('diarytown_dishes', JSON.stringify(l)); } catch (e) {} };
function plateToCase(pl) {
  const keys = (pl.species || []).filter((k) => SPECIES[k]).slice(0, 3); if (!keys.length) keys.push('tiderice');
  const form = pl.form || 'plain';
  return { keys, form, seed: Math.floor(pl.at % 9973), name: pl.name, about: pl.about, special: !!pl.special, price: priceOf(keys, pl.special, form), plate: pl };
}
let pickAt = -1;
function renderStock() {
  const l = bag(), shut = Day.done('settle');
  if (pickAt >= l.length) pickAt = -1;
  $('#stGrid').replaceChildren(...STATE.map((d, i) => {
    const b = document.createElement('button'); b.className = d ? 'full' : '';
    b.innerHTML = d ? (d.plate && d.plate.thumb ? `<img src="${d.plate.thumb}" alt="">` : '') + `<span>${d.name}</span>` : '<span>空</span>';
    b.onclick = () => {
      if (shut) return;
      if (d) { if (d.plate) { l.push(d.plate); saveBag(l); } STATE[i] = null; }
      else if (pickAt >= 0) { STATE[i] = plateToCase(l[pickAt]); l.splice(pickAt, 1); saveBag(l); pickAt = -1; }
      else return;
      saveState(); renderCase(); renderStock();
    };
    return b;
  }));
  $('#stBag').replaceChildren(...l.map((pl, i) => {
    const b = document.createElement('button'); b.className = i === pickAt ? 'on' : '';
    b.innerHTML = (pl.thumb ? `<img src="${pl.thumb}" alt="">` : '') + `<span>${pl.name}</span><small>${plateToCase(pl).price} 花币</small>`;
    b.onclick = () => { pickAt = i === pickAt ? -1 : i; renderStock(); };
    return b;
  }));
  $('#stTip').textContent = shut ? '今天打过烊了，柜子明天再摆' : !l.length && STATE.some(Boolean) ? '后厨做好的都摆上了 · 点有菜的格子收回来' : !l.length ? '后厨还没有做好的菜。柜台旁边那扇小门进去，做几盘再来摆' : pickAt >= 0 ? '点一个空格摆上去' : '先挑一盘，再点空格 · 点有菜的格子收回来';
}
$('#restock').onclick = () => { closeAll(); pickAt = -1; renderStock(); $('#stock').hidden = false; };

// ---------- 店面：花币买墙色、底色、遮阳篷、爬藤、门口小摊，买过的随便换（花园里那栋店读 Day.decor()） ----------
const DECOR_PARTS = [['wall', '墙'], ['base', '底'], ['awning', '遮阳篷'], ['ivy', '爬藤'], ['stall', '门口小摊']];
const IVY_ZH = { '0': '不爬', '0.5': '爬一半', '1': '爬满' };
function swatch(part, opt) {
  const c = part === 'wall' ? DECOR.wall[opt] : part === 'base' ? DECOR.base[opt] : part === 'awning' ? `linear-gradient(90deg,${DECOR.awning[opt][0]} 50%,${DECOR.awning[opt][1]} 50%)` : null;
  return c ? `<i style="background:${c}"></i>` : '';
}
function renderDecor() {
  const cur = Day.decor(), coins = Day.coins();
  $('#dcCoins').textContent = coins + ' 花币';
  $('#dcList').replaceChildren(...DECOR_PARTS.map(([part, zh]) => {
    const sec = document.createElement('div'); sec.innerHTML = `<div class="sh">${zh}</div>`;
    const row = document.createElement('div'); row.className = 'chips';
    for (const [opt, price] of Object.entries(Day.DECOR_PRICE[part]).sort((x, y) => x[1] - y[1])) {   /* 按价钱排，爬藤 0/0.5/1 的键会被排乱 */
      const own = Day.decorOwned(part, opt), on = String(cur[part]) === opt, b = document.createElement('button');
      b.className = on ? 'on' : ''; b.disabled = !own && coins < price;
      b.innerHTML = swatch(part, opt) + (part === 'ivy' ? IVY_ZH[opt] : opt) + `<small>${on ? '用着' : own ? '换上' : price + ' 花币'}</small>`;
      b.onclick = () => { if (Day.buyDecor(part, opt)) { setCoins(Day.coins()); renderDecor(); } };
      row.appendChild(b);
    }
    sec.appendChild(row); return sec;
  }));
}
$('#decorBtn').onclick = () => { closeAll(); renderDecor(); $('#decor').hidden = false; };
/* 怎么玩：一张短纸条，再点一下问号就收起来 */
$('#helpBtn').onclick = () => { const h = $('#help').hidden; closeAll(); $('#help').hidden = !h; };

/* 结过账、补过货就等明天：按钮变灰，顶上换一句（日子按手机本地时间换） */
function dayBar() {
  const shut = Day.done('settle'), empty = !STATE.some(Boolean);
  $('#close').disabled = shut || empty; $('#close').textContent = shut ? '今 天 打 烊 了' : '打 烊 结 算';
  $('#restock').textContent = shut ? '明 天 再 摆' : '补 货'; $('#restock').disabled = shut;
  $('#hint').textContent = shut ? '今天打过烊了，门口挂上了牌子，明天再开门' : empty ? '柜子还空着。柜台旁边的小门是后厨，做几盘菜再来补货' : '拖动转着看 · 点柜子里的吃的、软木板上的明信片、门边的信箱、柜台旁的后厨门';
}

// ---------- 种子铺：花种子拿去园子里种，菜种子进口袋、去田里种，熟了收进厨房 ----------
function seedRow(id, it, owned, unit, buy) {
  const li = document.createElement('li'), c = Day.coins(), b = document.createElement('button'), grow = buy === Day.buyCropSeed ? ` · ${Day.GROW_H[id] || 4} 小时熟` : '';
  li.innerHTML = `<span>${it.c ? `<i style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;background:${it.c};box-shadow:0 0 0 .5px rgba(90,60,50,.3)"></i>` : ''}${it.season ? `<em class="stag ${it.season}">${Day.SEASON_ZH[it.season]}</em>` : ''}${it.zh}${it.hybrid ? '<small> 园子里配的</small>' : ''}<small>${grow}${owned ? (grow ? ' · 有 ' : ' 有 ') + owned + unit : ''}</small></span>`;
  b.className = 'buy'; b.disabled = c < it.p; b.textContent = it.p + ' 花币';
  b.onclick = () => { if (buy(id)) { setCoins(Day.coins()); renderSeeds(); } };
  li.appendChild(b); return li;
}
function renderSeeds() {
  const fl = $('#sFlower'), cr = $('#sCrop'), s = Day.seeds(), p = Day.cropSeeds();   /* 菜种子进口袋（粒），去田里种 */
  /* 应季：当季的花和菜排最顶上，过季这一栏整个藏起来 */
  const sf = Object.entries(Day.seasonFlowerSeeds()), sc = Object.entries(Day.seasonCropSeeds());
  $('#sSeason').replaceChildren(...sf.map(([id, it]) => seedRow(id, it, s[id], ' 粒', Day.buyFlowerSeed)), ...sc.map(([id, it]) => seedRow(id, it, p[id], ' 粒', Day.buyCropSeed)));
  $('#sSeason').hidden = $('#sSeasonH').hidden = !(sf.length + sc.length);
  fl.replaceChildren(...Object.entries(Day.flowerSeeds()).map(([id, it]) => seedRow(id, it, s[id], ' 粒', Day.buyFlowerSeed)));
  cr.replaceChildren(...Object.entries(Day.CROP_SEEDS).map(([id, it]) => seedRow(id, it, p[id], ' 粒', Day.buyCropSeed)));
  $('#sCoins').textContent = Day.coins() + ' 花币';
}
$('#seedsBtn').onclick = () => { closeAll(); renderSeeds(); $('#seeds').hidden = false; };
if (/[?&]seeds\b/.test(location.search)) setTimeout(() => $('#seedsBtn').onclick(), 400);

// ---------- 开门 ----------
/* 后厨小门：后墙柜台左边，门上挂块小牌子，点了进厨房。
   门贴着拱窗了。门往柜台那边挪、拱窗往左挪，中间空出一截墙 */
const kitDoor = (() => {
  const g = new THREE.Group(), z = -D / 2 + .07, X = KIT_X;
  g.add(at(box(.68, 1.82, .06, C.tealD), 0, .91, 0));
  for (const y of [.5, 1.3]) { const p = at(box(.5, .55, .02, C.teal), 0, y, .035); p.userData.lineW = .004; g.add(p); }
  g.add(at(box(.78, .06, .1, C.trim), 0, 1.85, 0));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), mat('#c9a24a')), .25, .95, .06));
  const c = document.createElement('canvas'); c.width = 200; c.height = 80; const x = c.getContext('2d');
  const FONT = '44px "MaoKenTangYuan (beta)","PingFang SC",sans-serif', paint = () => { x.fillStyle = '#fbf6ec'; x.fillRect(0, 0, 200, 80); x.fillStyle = '#9f3726'; x.font = FONT; x.textAlign = 'center'; x.fillText('后 厨', 100, 56); };
  paint(); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  /* 字体按字分片懒加载，画布不会自己去拉「厨」那一片：拉完再画一遍 */
  document.fonts.load(FONT, '后厨').then(() => { paint(); tx.needsUpdate = true; markDirty(); }).catch(() => {});
  const sign = at(new THREE.Mesh(new THREE.BoxGeometry(.4, .16, .02), [mat('#9a6b4c'), mat('#9a6b4c'), mat('#9a6b4c'), mat('#9a6b4c'), new THREE.MeshBasicMaterial({ map: tx }), mat('#9a6b4c')]), 0, 1.62, .08); sign.userData.noLine = true; g.add(sign);
  outline(g, { w: .008 }); shadowAll(g); at(g, X, 0, z); S.add(g);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(.8, 2, .3), new THREE.MeshBasicMaterial({ visible: false })); at(hit, X, 1, z + .1); hit.userData = { kitchen: true, noLine: true }; S.add(hit);
  return hit;
})();
buildRoom(); outline(room); shadowAll(room); S.add(room);
const cs = buildCase(); outline(cs, { w: .008 }); shadowAll(cs); S.add(cs); S.add(slotsG);
buildMailbox(); loadState(); renderCase(); resize();
buildBoard().catch(() => {});
/* 娃娃屋：镜头转到哪边墙外面，就把那面墙藏起来，别挡视线 */
const sideL = room.children.filter((o) => o.userData.side === 'L').concat([board]), sideR = room.children.filter((o) => o.userData.side === 'R');
/* 手机省电：只在镜头动了或东西变了才重画 */
CTL.addEventListener('change', markDirty);
R.setAnimationLoop(() => { CTL.update(); if (!dirty) return; dirty--; const l = CAM.position.x > -W / 2 + .3, r = CAM.position.x < W / 2 - .3; sideL.forEach((o) => { o.visible = l; }); sideR.forEach((o) => { o.visible = r; }); LOOK.render(S, CAM); placeTags(); });
setTimeout(() => $('#veil').classList.add('out'), 300);
