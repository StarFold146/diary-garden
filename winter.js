/* 冬天三样菜的长相：白萝卜、大白菜、冬笋，照 autumn.js 的路子一样样单画。
   田里长着的（挂果、熟了）、厨房切好的小件和盛器、店里柜子摆的，都从这儿拿。
   只管长什么样，价钱、长多久、菜名还在 day.js。每个函数返回 Group，底面在 y=0，画法照 food.js：卡通光、平色、描边 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat } from './shop/look.js';

export const WINTER = ['radish', 'napa', 'bamboo'];
export const has = (k) => WINTER.includes(k);

const R = (s) => { s = (Math.abs(Math.floor(s)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const C = {
  rd: '#f1ece0', rdTop: '#b9c98a', rdLeaf: '#6f9a5a', rdLeaf2: '#5f8a4e', rdRing: '#e2dccb',
  nOut: '#7fa863', nOut2: '#93b872', nIn: '#dfe7b0', nRib: '#f4f1e0', nHead: '#e9eec4',
  sh: '#c39a5c', sh2: '#a97f48', shTip: '#7a5a36', shBase: '#e6d6a8', bFlesh: '#f1e6c2', bRing: '#dccb98', braise: '#b9773e', soil: '#6e5238',
  bark: '#7f6248', plate: '#fbf7ef', rim: '#9f3726', cream: '#fbf3e6', scal: '#8fae5a', chili: '#c9402e',
};
const mesh = (geo, c, lw = .003) => { const o = new THREE.Mesh(geo, typeof c === 'string' ? mat(c) : c); o.userData.lineW = lw; return o; };
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const quiet = (o) => { o.userData.noLine = true; return o; };
const ball = (r, c, sx = 1, sy = 1, sz = 1) => { const o = mesh(new THREE.SphereGeometry(r, 12, 9), c); o.scale.set(sx, sy, sz); return o; };
const lathe = (pts, c, seg = 32, lw = .004) => mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), c, lw);
function limb(a, b, r0, r1, c) {
  const d = new THREE.Vector3().subVectors(b, a), o = quiet(mesh(new THREE.CylinderGeometry(r1, r0, d.length(), 6), c));
  o.position.copy(a).addScaledVector(d, .5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o;
}

/* 一片长叶：叶片沿 +x，底在原点，边上起几道波，叶面微兜。萝卜叶和白菜外叶共用 */
function longLeafGeo(L, w, lobes = 0) {
  const sh = new THREE.Shape(), N = 24;
  sh.moveTo(0, 0);
  for (let i = 1; i <= N; i++) { const t = i / N, ww = w * Math.sin(Math.PI * Math.pow(t, .8)) * (1 + (lobes ? .22 * Math.sin(t * Math.PI * lobes * 2) : 0)); sh.lineTo(t * L, ww); }
  for (let i = N - 1; i >= 1; i--) { const t = i / N, ww = w * Math.sin(Math.PI * Math.pow(t, .8)) * (1 + (lobes ? .22 * Math.sin(t * Math.PI * lobes * 2 + 1) : 0)); sh.lineTo(t * L, -ww); }
  sh.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: L * .03, bevelEnabled: false, curveSegments: 4 }); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) - .35 * x * x / L + .6 * z * z / w); }
  geo.computeVertexNormals(); return geo;
}

/* —— 白萝卜：胖胖的长圆身子，顶上一圈浅绿的肩，底下拖一根细须 —— */
function radishGeo(r, h) {
  const pts = [[0, -h * .12], [r * .08, -h * .08], [r * .35, h * .05], [r * .75, h * .25], [r * .95, h * .5], [r, h * .72], [r * .93, h * .9], [r * .7, h * .99], [r * .3, h * 1.02], [0, h * 1.02]];
  return new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 20);
}
function radishBody(r, h) {
  const g = new THREE.Group();
  g.add(mesh(radishGeo(r, h), C.rd));
  const sh = lathe([[r * .97, h * .78], [r * .93, h * .9], [r * .7, h * .99], [r * .3, h * 1.02], [0, h * 1.03], [0, h * 1.035], [r * .31, h * 1.025], [r * .71, h * 1], [r * .94, h * .905], [r * .98, h * .78]], C.rdTop, 20, .002); g.add(quiet(sh));   /* 顶上那圈晒到太阳的浅绿 */
  g.add(quiet(at(mesh(new THREE.CylinderGeometry(.002, r * .06, h * .2, 5), C.rdRing), 0, -h * .2, 0)));   /* 底下一根细须 */
  return g;
}
function radishLeaves(g, n, L, top, rnd, cols) {
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + rnd() * .4, lf = mesh(longLeafGeo(L * (.8 + rnd() * .3), L * .17, 3), cols[i % cols.length], .002);
    lf.position.set(0, top, 0); lf.rotation.set(0, -a, .9 + rnd() * .35, 'YXZ'); g.add(lf);
  }
}
function radishPlant(stage, seed) {
  const g = new THREE.Group(), rnd = R(seed * 13 + 3), r = stage === 3 ? .05 : .032, h = stage === 3 ? .15 : .09;
  const b = radishBody(r, h); b.position.y = -h * .45; g.add(b);   /* 半截埋在土里 */
  radishLeaves(g, stage === 3 ? 7 : 5, stage === 3 ? .16 : .11, h * .55, rnd, [C.rdLeaf, C.rdLeaf2]);
  return g;
}
function radishWhole(seed = 1) {
  const g = new THREE.Group(), rnd = R(seed * 7 + 1), r = .04, h = .13, b = radishBody(r, h);
  b.rotation.z = Math.PI / 2; b.position.set(-h * .3, r, 0); g.add(b);
  for (let i = 0; i < 3; i++) { const lf = mesh(longLeafGeo(.09, .016, 3), i % 2 ? C.rdLeaf : C.rdLeaf2, .002); lf.position.set(-h * 1.3, r * 1.05, (i - 1) * .01); lf.rotation.set(0, Math.PI + (i - 1) * .35, .15 + rnd() * .15, 'YXZ'); g.add(lf); }   /* 叶子长在萝卜顶上那头（转过去以后在 -x） */
  g.rotation.y = seed * 1.3; return g;
}

/* —— 大白菜：里面一棵包得紧紧的浅黄绿菜心，外面四五片绿叶子张着包住，叶子中间一道白梗 —— */
function napaShell(r, h, c, a, open) {
  const w = new THREE.Group(), hinge = new THREE.Group(); w.rotation.y = -a; w.add(hinge); hinge.rotation.z = -open;   /* 叶子朝外的那一面在 +x，绕底边往外张一点 */
  const o = mesh(new THREE.SphereGeometry(1, 16, 10, Math.PI - .85, 1.7, 0, Math.PI * .6), mat(c, { side: THREE.DoubleSide }), .002);
  o.scale.set(r, h, r); o.position.y = h * .31; hinge.add(o);
  const rib = quiet(mesh(new THREE.BoxGeometry(r * .2, h * .7, r * .04), C.nRib)); rib.position.set(r * 1.01, h * .55, 0); rib.rotation.z = -.18; hinge.add(rib);   /* 叶子中间一道白梗 */
  return w;
}
function napaHead(r, h, open, seed) {
  const g = new THREE.Group(), rnd = R(seed * 11 + 5);
  const head = ball(1, C.nHead, r * .82, h * .5, r * .82); head.position.y = h * .5; g.add(head);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + .4, t = quiet(ball(1, i % 2 ? '#cfdc8e' : '#dbe5a4', r * .36, h * .1, r * .3)); t.position.set(Math.cos(a) * r * .32, h * .95, Math.sin(a) * r * .32); t.rotation.set(0, -a, .5); g.add(t); }   /* 顶上叶尖皱皱地收拢 */
  const n = 6;
  for (let i = 0; i < n; i++) { const a = i / n * 6.28 + rnd() * .3, w = napaShell(r * (.95 + (i % 2) * .08), h * (.78 - (i % 2) * .1), i % 2 ? C.nOut : C.nOut2, a, open * (.8 + rnd() * .4)); g.add(w); }
  return g;
}
function napaPlant(stage, seed) {
  const g = new THREE.Group(), s = stage === 3 ? 1 : .68; g.add(napaHead(.08 * s, .2 * s, stage === 3 ? .22 : .4, seed));
  return g;
}
function napaWhole(seed = 1) { const g = napaHead(.05, .14, .18, seed); g.rotation.y = seed * 1.3; return g; }

/* —— 冬笋：胖胖的尖锥，外面一层层棕黄的笋壳交错裹着，壳尖往外翘一点，底下一圈浅色的笋根 —— */
function shoot(r, h, seed = 1) {
  const g = new THREE.Group(), rnd = R(seed * 7 + 3);
  const core = lathe([[0, 0], [r * .9, 0], [r, h * .12], [r * .92, h * .35], [r * .7, h * .6], [r * .4, h * .82], [r * .12, h * .97], [0, h]], C.sh2, 18, .003); g.add(core);
  g.add(quiet(lathe([[0, -.001], [r * 1.02, -.001], [r * 1.03, h * .07], [r * .95, h * .08], [0, h * .08]], C.shBase, 18)));   /* 底下一圈浅色的根 */
  const n = 5;
  for (let i = 0; i < n; i++) {   /* 一片片笋壳：半圈尖头的壳，左右交错着一层压一层往上裹 */
    const y0 = h * (.06 + i * .17), hh = h * (.42 - i * .04), rr = r * (1.04 - i * .15), a0 = i * 2.2 + rnd() * .5;
    const geo = new THREE.CylinderGeometry(rr * .25, rr, hh, 14, 4, true, a0, Math.PI * 1.15), p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k), t = (y / hh) + .5, ang = Math.atan2(x, z) - a0, mid = Math.abs(ang / (Math.PI * 1.15) - .5) * 2; p.setY(k, y + (1 - mid) * hh * .18 * t); const sp = 1 + .12 * t * t; p.setX(k, x * sp); p.setZ(k, z * sp); }   /* 壳的中间拉成尖，越往上越翘开 */
    geo.computeVertexNormals();
    const shell = mesh(geo, mat(i % 2 ? C.sh : '#cfa866', { side: THREE.DoubleSide }), .002); shell.position.y = y0 + hh / 2; g.add(shell);
  }
  g.add(at(mesh(new THREE.ConeGeometry(r * .14, h * .16, 6), C.shTip, .002), 0, h * .99, 0));   /* 笋尖一点深棕 */
  g.rotation.y = seed * 1.3; return g;
}
function bambooPlant(stage, seed) {
  const g = new THREE.Group(), rnd = R(seed * 19 + 7);
  const mound = mesh(new THREE.SphereGeometry(.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), C.soil, .003); mound.scale.y = .32; g.add(mound);   /* 一小堆拱起来的土 */
  const list = stage === 3 ? [[0, 0, .065, .26, 0], [.085, .045, .045, .17, .3]] : [[0, 0, .045, .15, 0]];
  list.forEach(([x, z, r, h, tilt], i) => { const s = shoot(r, h, seed + i); s.position.set(x, -h * .18, z); s.rotation.z = -tilt; g.add(s); });   /* 半截还埋在土里 */
  for (let i = 0; i < 4; i++) { const a = rnd() * 6.28, d = .1 + rnd() * .05, l = quiet(ball(1, '#8a6a42', .02, .004, .01)); l.position.set(Math.cos(a) * d, .012, Math.sin(a) * d); l.rotation.y = rnd() * 6; g.add(l); }   /* 几片落下来的枯竹叶 */
  return g;
}
function bambooWhole(seed = 1) { const s = shoot(.035, .12, seed), g = new THREE.Group(); s.rotation.z = .3; g.add(s); g.rotation.y = seed * 1.3; return g; }   /* 挖出来的一颗，斜斜立着 */

/* —— 田里：只画挂果（2）和熟了（3），小苗还是 garden.js 自己那根绿苗 —— */
export function plant(k, stage = 3, seed = 0) {
  const st = stage >= 3 ? 3 : 2, g = k === 'radish' ? radishPlant(st, seed) : k === 'napa' ? napaPlant(st, seed) : bambooPlant(st, seed);
  g.scale.setScalar(st === 3 ? 1.05 : .92); return g;
}
export function whole(k, seed = 1) { return k === 'radish' ? radishWhole(seed) : k === 'napa' ? napaWhole(seed) : bambooWhole(seed); }

/* —— 厨房切好的小件 —— */
export const PIECE_NAME = { radish: '萝卜片', napa: '白菜叶', bamboo: '笋片' };
export const pieceName = (k) => PIECE_NAME[k] || null;
function radishRing(seed) {
  const g = new THREE.Group(), r = .055, th = .02;
  g.add(at(mesh(new THREE.CylinderGeometry(r, r, th, 22), C.rd), 0, th / 2, 0));
  const ring = quiet(new THREE.Mesh(new THREE.TorusGeometry(r * .78, .0015, 3, 30), mat(C.rdRing))); ring.rotation.x = Math.PI / 2; ring.position.y = th + .001; g.add(ring);   /* 切面一圈淡淡的纹 */
  g.rotation.y = seed * 1.7; return g;
}
function napaPiece(seed) {
  const g = new THREE.Group(), rnd = R(seed * 5 + 2);
  const rib = mesh(new RoundedBoxGeometry(.075, .014, .03, 2, .006), C.nRib); rib.position.y = .007; g.add(rib);
  const lf = mesh(new RoundedBoxGeometry(.07, .008, .045, 2, .004), C.nOut2, .002); lf.position.set(.004, .006, .034); lf.rotation.y = (rnd() - .5) * .3; g.add(lf);   /* 一段白梗带一边绿叶 */
  g.rotation.y = seed * 1.7; return g;
}
/* 笋片：纵切的一片，外头尖尖的轮廓，切面上一格一格的笋节 */
function bambooSlice(seed) {
  const g = new THREE.Group(), w = .034, h = .06, sh = new THREE.Shape();
  sh.moveTo(-w, 0); sh.quadraticCurveTo(-w * .95, h * .55, 0, h); sh.quadraticCurveTo(w * .95, h * .55, w, 0); sh.lineTo(-w, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: .014, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 2, curveSegments: 10 }); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, h * .45);
  g.add(at(mesh(geo, C.bFlesh, .002), 0, .004, 0));
  for (let i = 1; i <= 4; i++) { const t = i / 5, ww = w * (1 - t * t) * 1.7, b = quiet(mesh(new THREE.BoxGeometry(ww, .002, .003), C.bRing)); b.position.set(0, .023, h * .45 - h * t); g.add(b); }   /* 一道道笋节 */
  g.rotation.y = seed * 1.7; return g;
}
export function piece(k, seed = 1) {
  if (!has(k)) return null;
  const g = k === 'radish' ? radishRing(seed) : k === 'napa' ? napaPiece(seed) : bambooSlice(seed);
  const outer = new THREE.Group(); outer.add(g); outer.userData.piece = k; return outer;
}

/* —— 盛器：单做一样、或者两样凑成隐藏菜，换成这道菜自己的样子 —— */
const ORDER = ['tiderice', 'thoughtleaf', 'boltbean', 'twinpeach', 'velvetgrape', 'palettemelon', 'lanternplant', 'radish', 'napa', 'bamboo', 'heartberry', 'bloom'];
export const mainOf = (keys) => [...new Set(keys)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0];
export const VESSEL_NAME = { rdsoup: '汤碗', napaplate: '菜盘', braise: '菜盘', wpot: '砂锅', bsoup: '汤碗', stirfry: '菜盘' };
const catchDisc = (g, r, y, x = 0, z = 0) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial()); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.visible = false; m.userData = { catch: true, noLine: true, disc: r }; g.add(m); return m; };
const flat = (r, c, y, x = 0, z = 0) => { const m = quiet(new THREE.Mesh(new THREE.CircleGeometry(r, 40), mat(c))); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); return m; };
function plate(g) {
  g.add(lathe([[0, 0], [.5, 0], [.55, .03], [.58, .05], [.85, .085], [.95, .11], [.94, .125], [.83, .1], [.55, .07], [0, .07]], C.plate, 64));
  const ring = quiet(new THREE.Mesh(new THREE.TorusGeometry(.9, .006, 6, 80), mat(C.rim))); ring.rotation.x = Math.PI / 2; ring.position.y = .118; g.add(ring);
}
const big = (o, s = 2.2) => { o.scale.setScalar(s); return o; };
const scallions = (g, rnd, n, y, R0) => { for (let i = 0; i < n; i++) { const a = rnd() * 6.28, d = rnd() * R0, t = quiet(new THREE.Mesh(new THREE.TorusGeometry(.018, .007, 4, 10), mat(C.scal))); t.rotation.x = Math.PI / 2; t.position.set(Math.cos(a) * d, y + .006, Math.sin(a) * d); g.add(t); } };

/* 萝卜汤：青花小汤碗，清亮的汤，漂着几片萝卜、一撮葱花 */
function radishSoup(rnd) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.42, 0], [.46, .03], [.5, .045], [.8, .07], [.86, .09], [.85, .1], [.78, .085], [.46, .06], [0, .06]], C.plate, 56));
  const b = lathe([[0, 0], [.3, 0], [.33, .04], [.6, .2], [.72, .34], [.74, .37], [.7, .375], [.6, .24], [.32, .1], [0, .1]], '#f3ead8', 48); b.position.y = .06; g.add(b);
  const ring = quiet(new THREE.Mesh(new THREE.TorusGeometry(.73, .008, 4, 60), mat('#7fa6c9'))); ring.rotation.x = Math.PI / 2; ring.position.y = .43; g.add(ring);
  const y = .36; g.add(flat(.64, '#e8d6a8', y));
  for (const [x, z] of [[.15, .1], [-.2, .05], [.02, -.22], [-.05, .25]]) { const p = big(radishRing(rnd() * 9), 2); p.position.set(x, y - .02, z); p.rotation.set((rnd() - .5) * .2, rnd() * 6, (rnd() - .5) * .2); g.add(p); }
  scallions(g, rnd, 7, y, .5);
  catchDisc(g, .5, y);
  g.userData = { kind: 'rdsoup', top: y, r: .5, round: true, camY: .25 };
  return g;
}
/* 醋溜白菜：盘里一堆翻炒过的白菜片，白梗绿叶，夹几段红辣椒 */
function napaPlate(rnd) {
  const g = new THREE.Group(); plate(g);
  const y = .07;
  for (let i = 0; i < 16; i++) { const a = rnd() * 6.28, d = rnd() * .45, p = big(napaPiece(rnd() * 9), 2.8); p.position.set(Math.cos(a) * d, y + (.45 - d) * .3 + rnd() * .04, Math.sin(a) * d); p.rotation.set((rnd() - .5) * .5, rnd() * 6, (rnd() - .5) * .5); g.add(p); }
  for (let i = 0; i < 5; i++) { const a = rnd() * 6.28, d = rnd() * .4, c = mesh(new THREE.CylinderGeometry(.018, .018, .08, 6), C.chili, .002); c.rotation.set(Math.PI / 2, 0, rnd() * 3); c.position.set(Math.cos(a) * d, y + .1, Math.sin(a) * d); g.add(c); }
  catchDisc(g, .45, y + .05);
  g.userData = { kind: 'napaplate', top: y + .05, r: .45, round: true, camY: .25 };
  return g;
}
/* 油焖冬笋：盘里一堆焖得酱色油亮的笋块，撒一撮葱花 */
function braised(rnd) {
  const g = new THREE.Group(); plate(g);
  const y = .07;
  for (let i = 0; i < 14; i++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * .4, c = mesh(new THREE.ConeGeometry(.085, .19, 5), i % 3 ? C.braise : '#a8662f', .002); c.position.set(Math.cos(a) * d, y + .09 + (.4 - d) * .3, Math.sin(a) * d); c.rotation.set(Math.PI / 2 + (rnd() - .5) * .5, rnd() * 6, 0); g.add(c); }   /* 滚刀切的笋块 */
  g.add(flat(.48, '#c98a4e', y + .002));
  scallions(g, rnd, 8, y + .2, .3);
  catchDisc(g, .4, y + .1);
  g.userData = { kind: 'braise', top: y + .1, r: .42, round: true, camY: .25 };
  return g;
}
/* 萝卜白菜煲：草垫上一只砂锅，萝卜块炖得透亮，白菜软在汤里 */
function clayPot(rnd) {
  const g = new THREE.Group();
  g.add(at(mesh(new THREE.CylinderGeometry(.86, .86, .04, 40), '#c9a77a'), 0, .02, 0));
  for (const r of [.3, .55, .78]) { const t = quiet(new THREE.Mesh(new THREE.TorusGeometry(r, .008, 4, 48), mat('#a8865a'))); t.rotation.x = Math.PI / 2; t.position.y = .041; g.add(t); }
  g.add(lathe([[0, .04], [.4, .04], [.5, .09], [.6, .24], [.63, .36], [.6, .46], [.57, .5], [0, .5]], '#b07a56', 48));
  g.add(lathe([[.57, .49], [.62, .5], [.63, .55], [.6, .57], [.54, .57], [.53, .52], [.5, .5]], '#4a2e24', 48, .003));
  for (const s of [-1, 1]) { const h = mesh(new THREE.TorusGeometry(.07, .022, 6, 14, Math.PI), '#9a6446', .003); h.position.set(s * .62, .42, 0); h.rotation.set(0, s > 0 ? 0 : Math.PI, -Math.PI / 2); g.add(h); }
  const y = .51; g.add(flat(.54, '#ece2c6', y));
  for (const [x, z] of [[.2, .1], [-.25, .2], [.05, -.28], [-.2, -.12]]) { const c = mesh(new RoundedBoxGeometry(.11, .07, .1, 2, .02), '#f4ecd8'); c.position.set(x, y + .01, z); c.rotation.y = rnd() * 6; g.add(c); }   /* 萝卜块 */
  for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, d = .1 + rnd() * .35, p = big(napaPiece(rnd() * 9), 2.2); p.position.set(Math.cos(a) * d, y - .01, Math.sin(a) * d); p.rotation.set((rnd() - .5) * .3, rnd() * 6, 0); g.add(p); }
  scallions(g, rnd, 6, y, .45);
  catchDisc(g, .42, y);
  g.userData = { kind: 'wpot', top: y, r: .45, round: true, camY: .3 };
  return g;
}
/* 冬笋萝卜汤：青花汤碗里清汤，萝卜片和笋片漂着 */
function bambooSoup(rnd) {
  const g = radishSoup(rnd), y = g.userData.top;
  for (const [x, z] of [[-.18, -.18], [.22, -.08], [-.02, .02]]) { const p = big(bambooSlice(rnd() * 9), 2.2); p.position.set(x, y - .015, z); p.rotation.set((rnd() - .5) * .2, rnd() * 6, (rnd() - .5) * .2); g.add(p); }
  g.userData.kind = 'bsoup'; return g;
}
/* 冬笋炒白菜：盘里白菜片和笋片炒在一块，油亮 */
function stirFry(rnd) {
  const g = napaPlate(rnd), y = g.userData.top;
  for (let i = 0; i < 8; i++) { const a = rnd() * 6.28, d = rnd() * .4, p = big(bambooSlice(rnd() * 9), 2.4); p.position.set(Math.cos(a) * d, y + (.4 - d) * .25, Math.sin(a) * d); p.rotation.set((rnd() - .5) * .6, rnd() * 6, (rnd() - .5) * .6); g.add(p); }
  g.userData.kind = 'stirfry'; return g;
}
const SPECIAL = { 'napa+radish': clayPot, 'bamboo+radish': bambooSoup, 'bamboo+napa': stirFry };
const SINGLE = { radish: radishSoup, napa: napaPlate, bamboo: braised };
/* 这盘该不该换成冬天的盛器：原样（plain）才换；两样凑成隐藏菜按隐藏菜，不然看主菜是不是冬天的。不换返回 null */
export function vessel(keys, form = 'plain', seed = 7) {
  if (form !== 'plain' || !keys || !keys.length) return null;
  const set = [...new Set(keys)].sort().join('+'), rnd = R(seed * 31 + 11);
  if (SPECIAL[set]) return SPECIAL[set](rnd);
  const m = mainOf(keys); return SINGLE[m] ? SINGLE[m](rnd) : null;
}
