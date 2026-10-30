/* 秋天三样菜的长相：南瓜、栗子、柿子原来借 town/species.js 的圆球蛋形，看不出是什么，这里一样样单画。
   田里长着的（挂果、熟了）、厨房切好的小件和盛器、店里柜子摆的，都从这儿拿；town/ 那边一行没动。
   只管长什么样，价钱、长多久、菜名还在 day.js。每个函数返回 Group，底面在 y=0，画法照 food.js：卡通光、平色、描边 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat } from './shop/look.js';

export const AUTUMN = ['pumpkin', 'chestnut', 'persimmon'];
export const has = (k) => AUTUMN.includes(k);

const R = (s) => { s = (Math.abs(Math.floor(s)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const C = {
  pk: '#e0954a', pkG: '#a9b46a', pkStem: '#86743f', pkLeaf: '#7f9a6a', pkVine: '#7c9a5a', pkFlower: '#f2c14e', pkFlesh: '#f2b05a', pkRind: '#8f9a4e',
  nut: '#7a4a2e', nutR: '#5e3a24', nutHi: '#b88a62', nutBase: '#e2cfa0', meat: '#e9c46e', burr: '#a9b65e', burrR: '#b8a45a',
  ps: '#e2793e', psG: '#c9a24a', calyx: '#6b7f45', psFlesh: '#f6c58a', psStar: '#fbe2b4', psLeaf: '#c98a4a', psLeaf2: '#8a9a5c',
  bark: '#8a6a48', crown: '#7f9f6a', crownD: '#6f8f5a',
  plate: '#fbf7ef', rim: '#9f3726', wood: '#a77d58', woodD: '#7a5236', cream: '#fbf3e6',
};
const mesh = (geo, c, lw = .003) => { const o = new THREE.Mesh(geo, typeof c === 'string' ? mat(c) : c); o.userData.lineW = lw; return o; };
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const quiet = (o) => { o.userData.noLine = true; return o; };
const ball = (r, c, sx = 1, sy = 1, sz = 1) => { const o = mesh(new THREE.SphereGeometry(r, 12, 9), c); o.scale.set(sx, sy, sz); return o; };
const lathe = (pts, c, seg = 32, lw = .004) => mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), c, lw);
/* 两点之间一根棍：树枝、叶柄 */
function limb(a, b, r0, r1, c) {
  const d = new THREE.Vector3().subVectors(b, a), o = quiet(mesh(new THREE.CylinderGeometry(r1, r0, d.length(), 6), c));
  o.position.copy(a).addScaledVector(d, .5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o;
}
/* 星形嘴挤的奶油（照 food.js 的 rosette，那边没导出，抄一份小的） */
function rosette(Rr, H, c, ridges = 8) {
  const N = ridges * 6, M = 16, pos = [], idx = [];
  for (let j = 0; j <= M; j++) { const t = j / M, env = Rr * Math.pow(1 - Math.pow(t, 1.5), .75) * (1 + .1 * Math.sin(t * Math.PI)), tw = t * Math.PI * .9; for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, rr = env * (1 + .2 * (1 - t * .5) * Math.cos(ridges * (a + tw))); pos.push(Math.cos(a) * rr, H * t, Math.sin(a) * rr); } }
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + N + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return mesh(geo, c, .002);
}

/* —— 南瓜：扁扁的，一瓣一瓣的棱，顶上凹进去一个窝，插一截短梗 —— */
function pumpkinGeo(r, sq = .7, ribs = 8) {
  const g = new THREE.SphereGeometry(r, 32, 16), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x), lobe = .86 + .14 * Math.pow(Math.abs(Math.cos(a * ribs / 2)), .6);
    x *= lobe; z *= lobe; const d = Math.min(1, Math.hypot(x, z) / r);
    y *= sq; y += (y > 0 ? -.3 : .15) * r * sq * Math.pow(1 - d, 2);
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); return g;
}
function pumpkin(r, c = C.pk, seed = 1) {
  const g = new THREE.Group(), sq = .7, body = mesh(pumpkinGeo(r, sq), c); body.position.y = .85 * r * sq; g.add(body);
  const st = mesh(new THREE.CylinderGeometry(r * .09, r * .15, r * .5, 6), C.pkStem, .002); st.position.set(0, r * sq * 1.55 + r * .2, 0); st.rotation.set(.1, 0, .3); g.add(st);
  g.rotation.y = seed * 1.3; return g;
}
/* 南瓜叶：五个圆裂片，薄薄一片，叶柄立起来托着 */
function pumpkinLeaf(Rr) {
  const sh = new THREE.Shape();
  for (let i = 0; i <= 50; i++) { const a = i / 50 * Math.PI * 2, rr = Rr * (.72 + .28 * Math.abs(Math.cos(a * 5 / 2))); sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr * .9); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Rr * .06, bevelEnabled: true, bevelThickness: Rr * .03, bevelSize: Rr * .03, bevelSegments: 1, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2); return geo;
}
function pumpkinPlant(stage, seed) {
  const g = new THREE.Group(), rnd = R(seed * 13 + 5), turn = rnd() * 6.28;
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8, a = turn + t * 3.4; pts.push(new THREE.Vector3(Math.cos(a) * (.03 + t * .2), .012, Math.sin(a) * (.03 + t * .2))); }
  g.add(quiet(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, .009, 5), C.pkVine)));   /* 一根贴地绕着走的藤 */
  const nl = stage === 3 ? 5 : 4;
  for (let i = 0; i < nl; i++) {
    const t = (i + .5) / nl, a = turn + t * 3.4, x = Math.cos(a) * (.03 + t * .2), z = Math.sin(a) * (.03 + t * .2), h = .07 + rnd() * .06, s = .07 + rnd() * .025;
    g.add(limb(new THREE.Vector3(x, .01, z), new THREE.Vector3(x * .8, h, z * .8), .006, .005, C.pkVine));
    const lf = mesh(pumpkinLeaf(s), i % 2 ? C.pkLeaf : '#73905f'); lf.position.set(x * .8, h, z * .8); lf.rotation.set(-.25 + rnd() * .3, rnd() * 6.28, .2, 'YXZ'); g.add(lf);
  }
  const tip = pts[8]; const curl = []; for (let i = 0; i <= 10; i++) { const a = i * .9; curl.push(new THREE.Vector3(tip.x + Math.cos(a) * .015 * (1 - i / 14), .02 + i * .004, tip.z + Math.sin(a) * .015 * (1 - i / 14))); }
  g.add(quiet(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curl), 16, .003, 4), C.pkVine)));   /* 藤梢一圈小卷须 */
  if (stage === 3) {
    const a = turn + 1.2, p1 = pumpkin(.085, C.pk, seed); p1.position.set(Math.cos(a) * .1, 0, Math.sin(a) * .1); g.add(p1);
    const b = turn + 2.9, p2 = pumpkin(.06, '#e6a25a', seed + 3); p2.position.set(Math.cos(b) * .19, 0, Math.sin(b) * .19); g.add(p2);
  } else {
    const a = turn + 1.6, p1 = pumpkin(.045, C.pkG, seed); p1.position.set(Math.cos(a) * .12, 0, Math.sin(a) * .12); g.add(p1);
    const fl = mesh(new THREE.ConeGeometry(.024, .045, 5, 1, true), mat(C.pkFlower, { side: THREE.DoubleSide }), .002); fl.rotation.x = Math.PI; fl.position.set(-Math.cos(a) * .06, .06, -Math.sin(a) * .06); g.add(fl);   /* 一朵黄喇叭花 */
  }
  return g;
}

/* —— 栗子：上尖下圆、扁一点，油亮的深棕，底下一块浅色的「屁股」，尖上一撮小毛 —— */
const NUT = [[0, 0], [.6, .02], [.9, .13], [1, .36], [.95, .62], [.78, .92], [.5, 1.2], [.22, 1.42], [.07, 1.53], [0, 1.56]];
function nutGeo(r, seg = 16, phiStart = 0, phiLen = Math.PI * 2) {
  const g = new THREE.LatheGeometry(NUT.map(([a, b]) => new THREE.Vector2(a * r, b * r)), seg, phiStart, phiLen); g.scale(1, 1, .64); g.computeVertexNormals(); return g;
}
function nutBase(r) {
  const g = new THREE.LatheGeometry([[0, -.004], [.6, .012], [.9, .11], [.99, .2], [0, .2]].map(([a, b]) => new THREE.Vector2(a * r * 1.03, b * r)), 16); g.scale(1, 1, .64); g.computeVertexNormals();
  return quiet(mesh(g, C.nutBase));
}
function chestnut(r, seed = 1) {
  const g = new THREE.Group();
  g.add(mesh(nutGeo(r), C.nut), nutBase(r));
  g.add(quiet(at(ball(r * .16, C.nutHi, 1, 1.8, .5), -r * .32, r * .85, r * .55)));   /* 亮的那一道 */
  g.add(at(mesh(new THREE.ConeGeometry(r * .09, r * .2, 5), C.nutBase, .002), 0, r * 1.6, 0));
  g.rotation.y = seed * 1.7; return g;
}
/* 糖炒栗子：壳炒得更深，顶上爆开一圈参差的口子，露出里面金黄的栗子肉尖 */
function roasted(r, seed = 1) {
  const g = new THREE.Group(), pts = NUT.filter(([, y]) => y < 1.1).concat([[.6, 1.1]]);
  const geo = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a * r, b * r)), 14), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > r * 1.09) { const a = Math.atan2(p.getX(i), p.getZ(i)); p.setY(i, p.getY(i) + r * .09 * Math.sin(a * 5 + seed)); }   /* 口子一高一低，像炒裂的 */
  geo.scale(1, 1, .64); geo.computeVertexNormals();
  g.add(mesh(geo, mat(C.nutR, { side: THREE.DoubleSide })));
  g.add(quiet(at(ball(r * .13, '#9a6a48', 1, 1.7, .5), -r * .4, r * .65, r * .56)));
  const meat = mesh(nutGeo(r * .93), C.meat, .002); meat.position.y = r * .05; g.add(meat);
  g.add(nutBase(r));
  g.rotation.y = seed * 1.7; return g;
}
/* 剥好的栗子肉：炖菜和糕上用 */
function peeled(r, seed = 1) { const g = new THREE.Group(), m = mesh(nutGeo(r), C.meat); m.scale.z = 1.15; g.add(m); g.rotation.y = seed * 1.7; return g; }
/* 带刺的壳：一颗球上插一圈短刺，合成一个网格（刺多了分开画太费）；open 时顶上秃一块，蹲着两颗栗子 */
function burrGeo(r, open, seed) {
  const parts = [new THREE.IcosahedronGeometry(r, 1)], up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), d = new THREE.Vector3(), n = 46;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i + .5) / n * 2, rr = Math.sqrt(1 - y * y), a = i * 2.39996 + seed; if (open && y > .45) continue;
    d.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
    const c = new THREE.ConeGeometry(r * .11, r * .62, 4).toNonIndexed(); c.deleteAttribute('uv'); c.translate(0, r * 1.08, 0); q.setFromUnitVectors(up, d); c.applyQuaternion(q); parts.push(c);
  }
  parts[0].deleteAttribute('uv');
  const g = mergeGeometries(parts); parts.forEach((p) => p.dispose()); return g;
}
function burr(r, open = false, seed = 1) {
  const g = new THREE.Group(), b = mesh(burrGeo(r, open, seed), open ? C.burrR : C.burr, .002); b.position.y = r * 1.4; g.add(b);
  if (open) for (const x of [-.32, .32]) { const nt = chestnut(r * .62, seed + x * 10); nt.position.set(x * r, r * 1.75, 0); nt.rotation.set(0, Math.PI / 2, x * .7); g.add(nt); }
  return g;
}
function chestnutTree(stage, seed) {
  const g = new THREE.Group(), rnd = R(seed * 17 + 3), H = .46, cr1 = stage === 3 ? '#9aa864' : C.crown, cr2 = stage === 3 ? '#86985a' : C.crownD;
  g.add(quiet(at(mesh(new THREE.CylinderGeometry(.016, .026, H * .62, 6), C.bark), 0, H * .31, 0)));
  for (const [x, y, z, r0, c] of [[0, H * .8, 0, .125, cr1], [.075, H * .76, .03, .085, cr2], [-.075, H * .77, -.02, .09, cr2], [.01, H * .86, -.06, .08, cr1]]) { const cr = mesh(new THREE.IcosahedronGeometry(r0, 1), c, .004); cr.position.set(x, y, z); cr.scale.y = .8; g.add(cr); }   /* 几团挤成一个树冠 */
  const n = stage === 3 ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + rnd() * .5 + .3, b = burr(stage === 3 ? .048 : .036, stage === 3 && i % 2 === 0, seed + i);
    const r = stage === 3 ? .048 : .036, c = Math.cos(a), sn = Math.sin(a), el = new THREE.Vector3(c * .1, H * .64, sn * .1), top = new THREE.Vector3(c * .17, H * .3 + r * 2.6, sn * .17);
    b.position.set(c * .17, H * .3, sn * .17); g.add(b);
    g.add(limb(new THREE.Vector3(0, H * .52, 0), el, .009, .006, C.bark), limb(el, top, .005, .003, C.bark));   /* 从树干伸出一根小枝，刺壳吊在枝梢上 */
  }
  if (stage === 3) {   /* 树底下落了一个裂开的壳、一颗栗子 */
    const a = rnd() * 6.28, f = burr(.04, true, seed + 9); f.position.set(Math.cos(a) * .17, -.03, Math.sin(a) * .17); g.add(f);
    const nt = chestnut(.03, seed); nt.position.set(Math.cos(a + .9) * .2, 0, Math.sin(a + .9) * .2); nt.rotation.z = 1.3; nt.position.y = .09; g.add(nt);   /* 这颗栗子侧着悬在半空，是故意的 */
  }
  return g;
}

/* —— 柿子：扁圆、微微四方，顶上一朵四片的柿蒂 —— */
function persimmonGeo(r) {
  const g = new THREE.SphereGeometry(r, 20, 12), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + .06 * Math.cos(4 * Math.atan2(z, x)); x *= k; z *= k; y *= y > 0 ? .62 : .8; p.setXYZ(i, x, y, z); }
  g.computeVertexNormals(); return g;
}
function calyx(r, g, y) {
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, s = ball(1, C.calyx, r * .5, r * .09, r * .3); s.position.set(Math.cos(a) * r * .32, y, Math.sin(a) * r * .32); s.rotation.set(0, -a, .25); s.userData.lineW = .002; g.add(s); }
  g.add(at(mesh(new THREE.CylinderGeometry(r * .07, r * .09, r * .26, 5), '#6b5a3a', .002), 0, y + r * .12, 0));
}
function persimmon(r, c = C.ps, seed = 1) {
  const g = new THREE.Group(), b = mesh(persimmonGeo(r), c); b.position.y = r * .8; g.add(b);
  calyx(r, g, r * 1.4);
  g.rotation.y = seed * 1.3; return g;
}
/* 柿子叶：尖头的长圆叶，叶面微微兜起来，叶尖往下垂一点；长度沿 +x，底在原点 */
function persimmonLeafGeo(L) {
  const w = L * .3, sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(L * .4, w * 1.3, L, 0); sh.quadraticCurveTo(L * .4, -w * 1.3, 0, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: L * .05, bevelEnabled: false, curveSegments: 8 }); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) - .3 * x * x / L + .9 * z * z / w); }
  geo.computeVertexNormals(); return geo;
}
function persimmonTree(stage, seed) {
  const g = new THREE.Group(), rnd = R(seed * 19 + 7), V = (x, y, z) => new THREE.Vector3(x, y, z);
  const fork = V(0, .22, 0); g.add(limb(V(0, 0, 0), fork, .028, .02, C.bark));
  const tips = [];
  for (let i = 0; i < 4; i++) {
    const a = i * 1.57 + rnd() * .5 + seed, mid = V(Math.cos(a) * .07, .3 + rnd() * .03, Math.sin(a) * .07), tip = V(Math.cos(a) * .16, .38 + rnd() * .05, Math.sin(a) * .16);
    g.add(limb(fork, mid, .016, .011, C.bark), limb(mid, tip, .011, .006, C.bark)); tips.push({ p: tip, a });
  }
  /* 叶子长在枝梢、挨着果子：每片一根小叶柄连在枝上。挂果那阵绿的多几片，熟了只剩几片橙红黄的 */
  const cols = stage === 3 ? ['#c9573a', '#e08a3a', '#e2b04a'] : [C.crown, C.psLeaf2, '#9aa864'], per = stage === 3 ? [2, 2, 2, 1] : [3, 2, 3, 2];
  let ci = 0;
  tips.forEach(({ p: t, a }, ti) => {
    for (let j = 0; j < per[ti]; j++) {
      const la = a + (j - (per[ti] - 1) / 2) * 1.1 + (rnd() - .5) * .3, base = V(t.x + Math.cos(la) * .018, t.y + .006 + rnd() * .01, t.z + Math.sin(la) * .018);
      g.add(limb(t, base, .003, .002, C.bark));
      const lf = mesh(persimmonLeafGeo(.085 + rnd() * .02), cols[ci++ % 3], .002); lf.position.copy(base); lf.rotation.set(0, -la, .25 + rnd() * .35, 'YXZ'); g.add(lf);
    }
  });
  const n = stage === 3 ? 5 : 2;
  for (let i = 0; i < n; i++) { const tp = tips[i % 4].p, r = stage === 3 ? .036 : .026, f = persimmon(r, stage === 3 ? C.ps : C.psG, seed + i), k = i >= 4 ? .55 : 1; f.position.set(tp.x * k, tp.y - r * 1.75 - (i >= 4 ? .03 : 0), tp.z * k); g.add(f); }
  if (stage === 3) { const a = rnd() * 6.28, l = mesh(persimmonLeafGeo(.06), '#c9573a', .002); l.position.set(Math.cos(a) * .15, .008, Math.sin(a) * .15); l.rotation.y = a; g.add(l); }   /* 地上一片落叶 */
  return g;
}

/* —— 田里：只画挂果（2）和熟了（3），小苗还是 garden.js 自己那根绿苗 —— */
export function plant(k, stage = 3, seed = 0) {
  const st = stage >= 3 ? 3 : 2, g = k === 'pumpkin' ? pumpkinPlant(st, seed) : k === 'chestnut' ? chestnutTree(st, seed) : persimmonTree(st, seed);
  g.scale.setScalar(st === 3 ? 1.05 : .92); return g;
}
/* 收下来的一整颗 */
export function whole(k, seed = 1) { return k === 'pumpkin' ? pumpkin(.07, C.pk, seed) : k === 'chestnut' ? chestnut(.04, seed) : persimmon(.045, C.ps, seed); }

/* —— 厨房切好的小件（盘里一个个摆的就是这些，厨房和店里都放大 2.2 倍） —— */
export const PIECE_NAME = { pumpkin: '南瓜块', chestnut: '炒栗子', persimmon: '柿子片' };
export const pieceName = (k) => PIECE_NAME[k] || null;
function pumpkinChunk(seed) {
  const g = new THREE.Group(), w = .075, h = .05, d = .06;
  g.add(at(mesh(new RoundedBoxGeometry(w, h, d, 2, .012), C.pkFlesh), 0, h / 2, 0));
  g.add(quiet(at(mesh(new RoundedBoxGeometry(w * 1.02, h * 1.02, d * .14, 2, .006), C.pkRind), 0, h / 2, -d * .45)));   /* 背面留一条皮，切面朝上是橙的 */
  g.rotation.y = seed * 1.7; return g;
}
function persimmonSlice(seed) {
  const g = new THREE.Group(), r = .058, th = .026;
  g.add(at(mesh(new THREE.CylinderGeometry(r, r * .96, th, 20), C.ps), 0, th / 2, 0));
  g.add(quiet(at(new THREE.Mesh(new THREE.CylinderGeometry(r * .9, r * .9, .002, 20), mat(C.psFlesh)), 0, th + .001, 0)));
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, s = quiet(ball(1, C.psStar, r * .34, .002, r * .07)); s.position.set(Math.cos(a) * r * .32, th + .003, Math.sin(a) * r * .32); s.rotation.y = -a; g.add(s); }   /* 横切开中间一朵八瓣的浅色花纹 */
  g.add(quiet(at(ball(r * .12, '#d9a25a', 1, .2, 1), 0, th + .003, 0)));
  g.rotation.y = seed * 1.7; return g;
}
export function piece(k, seed = 1) {
  if (!has(k)) return null;
  const g = k === 'pumpkin' ? pumpkinChunk(seed) : k === 'chestnut' ? roasted(.05, seed) : persimmonSlice(seed);
  const outer = new THREE.Group(); outer.add(g); outer.userData.piece = k; return outer;
}

/* —— 盛器：单做一样、或者两样凑成隐藏菜的时候，换成这道菜自己的样子 ——
   排位照 kitchen.js 的 ORDER（应季菜插在心跳莓前面），第一样是主菜 */
const ORDER = ['tiderice', 'thoughtleaf', 'boltbean', 'twinpeach', 'velvetgrape', 'palettemelon', 'lanternplant', 'pumpkin', 'chestnut', 'persimmon', 'heartberry', 'bloom'];
export const mainOf = (keys) => [...new Set(keys)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0];
export const VESSEL_NAME = { pksoup: '汤碗', bag: '纸袋', pudding: '布丁碟', pot: '砂锅', slice: '点心碟', geng: '小瓷碗' };
const catchDisc = (g, r, y, x = 0, z = 0) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial()); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.visible = false; m.userData = { catch: true, noLine: true, disc: r }; g.add(m); return m; };
const catchRect = (g, w, d, y, x = 0, z = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial()); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.visible = false; m.userData = { catch: true, noLine: true, rect: [w, d] }; g.add(m); return m; };
const flat = (r, c, y, x = 0, z = 0) => { const m = quiet(new THREE.Mesh(new THREE.CircleGeometry(r, 40), mat(c))); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); return m; };
function plate(g) {
  g.add(lathe([[0, 0], [.5, 0], [.55, .03], [.58, .05], [.85, .085], [.95, .11], [.94, .125], [.83, .1], [.55, .07], [0, .07]], C.plate, 64));
  const ring = quiet(new THREE.Mesh(new THREE.TorusGeometry(.9, .006, 6, 80), mat(C.rim))); ring.rotation.x = Math.PI / 2; ring.position.y = .118; g.add(ring);
}
const big = (o, s = 2.2) => { o.scale.setScalar(s); return o; };

/* 南瓜汤：宽口浅碗搁在小碟上，一碗橙黄的浓汤，奶油画一圈旋，撒几粒南瓜子 */
function pumpkinSoup(rnd) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.42, 0], [.46, .03], [.5, .045], [.8, .07], [.86, .09], [.85, .1], [.78, .085], [.46, .06], [0, .06]], C.plate, 56));
  const b = lathe([[0, 0], [.3, 0], [.33, .04], [.6, .2], [.72, .34], [.74, .37], [.7, .375], [.6, .24], [.32, .1], [0, .1]], '#f3ead8', 48); b.position.y = .06; g.add(b);
  const ring = quiet(new THREE.Mesh(new THREE.TorusGeometry(.73, .008, 4, 60), mat(C.rim))); ring.rotation.x = Math.PI / 2; ring.position.y = .43; g.add(ring);
  const y = .36; g.add(flat(.64, '#e89a48', y));
  const sp = []; for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 3.4, rr = .04 + t * .34; sp.push(new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr)); }
  const swirl = quiet(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp), 80, .022, 5), C.cream)); swirl.scale.y = .35; swirl.position.set(-.04, y + .004, .02); g.add(swirl);   /* 淋一圈淡奶油 */
  for (let i = 0; i < 7; i++) { const a = rnd() * 6.28, d = .2 + rnd() * .3, s = ball(1, i % 3 ? '#8ea05a' : '#d9cf9a', .04, .012, .022); s.position.set(Math.cos(a) * d, y + .012, Math.sin(a) * d); s.rotation.y = rnd() * 6; s.userData.lineW = .002; g.add(s); }
  for (const [x, z, ry] of [[.2, -.18, .4], [.25, -.12, 1.6]]) { const l = ball(1, '#6f8f4a', .05, .01, .028); l.position.set(x, y + .014, z); l.rotation.y = ry; g.add(l); }
  catchDisc(g, .5, y);
  g.userData = { kind: 'pksoup', top: y, r: .5, round: true, camY: .25 };
  return g;
}
/* 糖炒栗子：木板上一只软塌塌的牛皮纸袋，上口宽下面窄，袋身皱巴巴，口往外翻了一道；栗子堆出袋口，滚出来几颗 */
function paperBag(pts, c, seed, jag = 0) {
  const geo = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 28), p = geo.attributes.position, top = Math.max(...pts.map((q) => q[1]));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z), k = 1 + .045 * Math.sin(a * 6 + y * 19 + seed) + .025 * Math.sin(a * 11 - y * 33);
    p.setXYZ(i, x * k * 1.12, y + (jag && y < top - .01 ? jag * Math.sin(a * 9 + seed) : 0), z * k * .84);
  }
  geo.computeVertexNormals(); return mesh(geo, mat(c, { side: THREE.DoubleSide }), .004);
}
function chestnutBag(rnd) {
  const g = new THREE.Group(), bx = -.28;
  g.add(at(mesh(new THREE.BoxGeometry(1.55, .06, .95), C.wood, .004), 0, .03, 0));
  for (let i = 0; i < 4; i++) g.add(quiet(at(mesh(new THREE.BoxGeometry(1.45, .002, .006), C.woodD), 0, .061, -.33 + i * .22)));
  const bag = paperBag([[0, 0], [.28, 0], [.3, .03], [.33, .15], [.37, .28], [.4, .37]], '#c9a274', 1); bag.position.set(bx, .06, 0); g.add(bag);
  const lip = paperBag([[.4, .37], [.43, .375], [.445, .33], [.44, .29]], '#b3875a', 2, .012); lip.position.set(bx, .06, 0); g.add(lip);   /* 袋口往外翻了一道，边参差 */
  const st = quiet(mesh(new THREE.BoxGeometry(.13, .1, .004), '#9f3726')); st.position.set(bx, .23, .3); st.rotation.x = -.2; g.add(st);   /* 袋子上一个红戳 */
  const st2 = quiet(mesh(new THREE.BoxGeometry(.08, .014, .004), '#fbf3e6')); st2.position.set(bx, .23, .303); st2.rotation.x = -.2; g.add(st2);
  const heap = [[6, .19, .36], [4, .1, .45], [1, 0, .54]];
  let s = 1; for (const [n, d, y] of heap) for (let i = 0; i < n; i++) { const a = i / n * 6.28 + y * 5, nt = big(roasted(.05, s++)); nt.position.set(bx + Math.cos(a) * d * 1.1, y, Math.sin(a) * d * .85); nt.rotation.set((rnd() - .5) * .8, rnd() * 6, (rnd() - .5) * .8); g.add(nt); }
  for (const [x, y, z, rz] of [[.16, .4, .08, -1.1], [.12, .36, -.12, -.9]]) { const nt = big(roasted(.05, s++)); nt.position.set(bx + x + .2, y, z); nt.rotation.set(.2, rnd() * 6, rz); g.add(nt); }   /* 两颗挂在袋口往外掉 */
  for (const [x, z] of [[.3, .24], [.5, -.02], [.44, .32], [.12, .34]]) { const nt = big(roasted(.05, s++)); nt.position.set(x, .06, z); nt.rotation.set(0, rnd() * 6, (rnd() - .5) * .5); g.add(nt); }
  catchDisc(g, .12, .58, bx, 0); catchRect(g, .5, .65, .06, .45, 0);
  g.userData = { kind: 'bag', top: .06, r: .7, round: false, camY: .3 };
  return g;
}
/* 柿子布丁：盘子里一块橙色的布丁，顶上焦糖往下淌，旁边一朵奶油，盘底一摊柿子酱 */
function persimmonPudding(rnd) {
  const g = new THREE.Group(); plate(g);
  g.add(flat(.5, '#e2793e', .072, .08, .05));
  const pd = lathe([[0, .07], [.37, .07], [.38, .09], [.33, .36], [.3, .38], [0, .38]], '#eda25e', 40); g.add(pd);
  const top = lathe([[0, .375], [.305, .375], [.31, .39], [.29, .4], [0, .4]], '#c45e2c', 40, .002); g.add(top);
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + rnd() * .4, h = .05 + rnd() * .06, d = quiet(ball(1, '#c45e2c', .035, h, .02)); d.position.set(Math.cos(a) * .32, .38 - h * .55, Math.sin(a) * .32); d.rotation.set(0, -a, -.13); g.add(d); }   /* 焦糖往下淌 */
  const cr = rosette(.09, .11, C.cream); cr.position.set(.14, .4, .06); g.add(cr);
  const lf = ball(1, '#6f8f4a', .05, .01, .028); lf.position.set(.06, .42, .14); lf.rotation.y = .7; g.add(lf);
  catchDisc(g, .16, .4, -.08, -.05); catchDisc(g, .17, .075, .52, .4);
  g.userData = { kind: 'pudding', top: .4, r: .3, round: true, camY: .25 };
  return g;
}
/* 栗子南瓜煲：草垫上一只砂锅，深色的锅沿，两只小耳朵，锅里炖得起沙的南瓜块、栗子肉，撒一点葱花 */
function clayPot(rnd) {
  const g = new THREE.Group();
  g.add(at(mesh(new THREE.CylinderGeometry(.86, .86, .04, 40), '#c9a77a'), 0, .02, 0));
  for (const r of [.3, .55, .78]) { const t = quiet(new THREE.Mesh(new THREE.TorusGeometry(r, .008, 4, 48), mat('#a8865a'))); t.rotation.x = Math.PI / 2; t.position.y = .041; g.add(t); }
  g.add(lathe([[0, .04], [.4, .04], [.5, .09], [.6, .24], [.63, .36], [.6, .46], [.57, .5], [0, .5]], '#b07a56', 48));
  g.add(lathe([[.57, .49], [.62, .5], [.63, .55], [.6, .57], [.54, .57], [.53, .52], [.5, .5]], '#4a2e24', 48, .003));   /* 釉过的深色锅沿 */
  for (const s of [-1, 1]) { const h = mesh(new THREE.TorusGeometry(.07, .022, 6, 14, Math.PI), '#9a6446', .003); h.position.set(s * .62, .42, 0); h.rotation.set(0, s > 0 ? 0 : Math.PI, -Math.PI / 2); g.add(h); }
  const y = .51; g.add(flat(.54, '#d98a44', y));
  const put = [[pumpkinChunk(1), .2, .1], [pumpkinChunk(2), -.25, .2], [pumpkinChunk(3), .05, -.28], [peeled(.045, 4), -.12, -.08], [peeled(.045, 5), .3, -.15], [peeled(.045, 6), -.05, .32]];
  for (const [o, x, z] of put) { big(o); o.position.set(x, y - .03, z); o.rotation.y = rnd() * 6; g.add(o); }
  for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, d = rnd() * .45, t = quiet(new THREE.Mesh(new THREE.TorusGeometry(.018, .007, 4, 10), mat('#8fae5a'))); t.rotation.x = Math.PI / 2; t.position.set(Math.cos(a) * d, y + .006, Math.sin(a) * d); g.add(t); }
  catchDisc(g, .42, y);
  g.userData = { kind: 'pot', top: y, r: .45, round: true, camY: .3 };
  return g;
}
/* 柿饼栗子糕：一角切开的糕，一层柿饼一层栗子泥，橙黄相间；顶上一颗栗子、一片柿饼，撒点糖粉 */
function layerCake(rnd) {
  const g = new THREE.Group(); plate(g);
  const sl = new THREE.Group(), Rr = .74, th = .85, layers = [[.08, '#e0874a'], [.06, '#efd592'], [.08, '#e0874a'], [.06, '#efd592'], [.08, '#e0874a'], [.03, '#c9622e']];
  let y = .07; for (const [h, c] of layers) { sl.add(at(mesh(new THREE.CylinderGeometry(Rr, Rr, h, 24, 1, false, Math.PI / 2 - th / 2, th), c, .003), 0, y + h / 2, 0)); y += h; }
  for (let i = 0; i < 16; i++) { const d = .15 + rnd() * .4, a = (rnd() - .5) * th * .8, s = quiet(mesh(new THREE.BoxGeometry(.012, .006, .012), '#fbf6ec')); s.position.set(Math.cos(a) * d, y + .004, -Math.sin(a) * d); sl.add(s); }
  const nt = big(peeled(.045, 2), 2); nt.position.set(.5, y, 0); nt.rotation.z = .2; sl.add(nt);
  const dp = ball(.07, '#c45e2c', 1, .3, 1); dp.position.set(.24, y + .015, .04); sl.add(dp); calyx(.07, sl, y + .036); sl.children.slice(-5).forEach((o) => { o.position.x += .24; o.position.z += .04; });   /* 一片压扁的柿饼，蒂还在 */
  sl.position.set(-.36, 0, -.1); sl.rotation.y = .3; g.add(sl);
  catchDisc(g, .18, .072, .2, .5); catchDisc(g, .1, y, .02, -.24);
  g.userData = { kind: 'slice', top: y, r: .3, round: true, camY: .2 };
  return g;
}
/* 南瓜柿子羹：深一点的青花小碗，金橙色的羹，漂着柿子丁、桂花和两颗枸杞，搭一把瓷勺 */
function sweetSoup(rnd) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.4, 0], [.44, .03], [.48, .045], [.7, .07], [.75, .09], [.74, .1], [.68, .085], [.44, .06], [0, .06]], C.plate, 56));
  const b = lathe([[0, 0], [.22, 0], [.24, .04], [.42, .16], [.52, .36], [.54, .46], [.5, .465], [.47, .36], [.38, .18], [.22, .1], [0, .1]], '#f6f2ea', 48); b.position.y = .06; g.add(b);
  for (const [r, y, w] of [[.535, .5, .012], [.46, .27, .008]]) { const t = quiet(new THREE.Mesh(new THREE.TorusGeometry(r, w, 4, 60), mat('#7fa6c9'))); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); }
  const y = .46; g.add(flat(.49, '#f0a858', y));
  for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, d = rnd() * .36, c = mesh(new THREE.BoxGeometry(.045, .03, .045), i % 2 ? C.ps : '#e8a04a', .002); c.position.set(Math.cos(a) * d, y + .008, Math.sin(a) * d); c.rotation.y = rnd() * 3; g.add(c); }
  for (let i = 0; i < 14; i++) { const a = rnd() * 6.28, d = rnd() * .42, s = quiet(mesh(new THREE.BoxGeometry(.012, .004, .012), '#f2c14e')); s.position.set(Math.cos(a) * d, y + .003, Math.sin(a) * d); s.rotation.y = rnd() * 3; g.add(s); }
  for (const [x, z] of [[-.15, .12], [.08, -.2]]) g.add(at(ball(.018, '#c9402e', 1.5, .8, 1), x, y + .01, z));
  const sp = new THREE.Group(), white = mat('#f6f2ea', { side: THREE.DoubleSide });
  const bowl = mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), white, .002); bowl.scale.set(.1, .05, .15); sp.add(bowl);
  const hd = mesh(new RoundedBoxGeometry(.06, .026, .34, 2, .01), '#fbf8f1', .002); hd.position.set(0, .09, -.27); hd.rotation.x = .5; sp.add(hd);
  sp.position.set(.1, y + .03, .12); sp.rotation.y = 2.4; g.add(sp);   /* 一把瓷勺，柄搭在碗沿上 */
  catchDisc(g, .34, y);
  g.userData = { kind: 'geng', top: y, r: .36, round: true, camY: .3 };
  return g;
}
const SPECIAL = { 'chestnut+pumpkin': clayPot, 'chestnut+persimmon': layerCake, 'persimmon+pumpkin': sweetSoup };
const SINGLE = { pumpkin: pumpkinSoup, chestnut: chestnutBag, persimmon: persimmonPudding };
/* 这盘该不该换成秋天的盛器：原样（plain）才换；两样凑成隐藏菜按隐藏菜，不然看主菜是不是秋天的。不换返回 null */
export function vessel(keys, form = 'plain', seed = 7) {
  if (form !== 'plain' || !keys || !keys.length) return null;
  const set = [...new Set(keys)].sort().join('+'), rnd = R(seed * 31 + 11);
  if (SPECIAL[set]) return SPECIAL[set](rnd);
  const m = mainOf(keys); return SINGLE[m] ? SINGLE[m](rnd) : null;
}
