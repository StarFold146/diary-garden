/* 果子挂上枝
   田里那些老作物（双生桃、心跳莓、绒绒果、灯笼茄、潮汐稻）是 town/mem.js 画的，新品种照说明长的是 town/species.js 画的，
   那边两个文件跟小镇共用，一行不动。这里等整株画好以后再补一手：
   树上的果子挪到树冠底下，从树冠里垂一根果柄下来；双生桃从树干上伸一根小枝，两颗并排吊在枝头；
   潮汐稻的穗子套回秆尖；矮丛和藤上没碰着叶子、秆子的果子，拉一根小果柄连到最近的那片叶子或那根藤上。
   秋天三样（autumn.js）自己画好了，cropModel 在前面就返回了，走不到这里 */
import * as THREE from 'three';
import { mat } from './shop/look.js';
import * as TM from './town/mem.js';

const UP = new THREE.Vector3(0, 1, 0);
const STALK = '#7d6a44', TWIG = '#8a6a48';

/* 两点之间一根小棍，粗细 r0 到 r1；细的不描边，粗的描一道细边，跟树枝一个画法 */
function rod(a, b, r0, r1, c, line = 0) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, Math.max(len, 1e-4), 5), typeof c === 'string' ? mat(c) : c);
  o.position.copy(a).addScaledVector(d, .5); o.quaternion.setFromUnitVectors(UP, d.normalize());
  if (line) o.userData.lineW = line; else o.userData.noLine = true;
  return o;
}
/* 一片小叶子，压扁的球，跟 mem.js 的叶子一样 */
function leaflet(p, ry, c, s = 1) {
  const l = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), mat(c)); l.scale.set(.03 * s, .008 * s, .018 * s); l.position.copy(p); l.rotation.set(0, ry, .4); l.userData.lineW = .002; return l;
}

/* 子物体在整株坐标里的矩阵（整株自己可能缩放过，算的都是整株里面的位置） */
function localM(g, o) { g.updateMatrixWorld(true); return new THREE.Matrix4().copy(g.matrixWorld).invert().multiply(o.matrixWorld); }
const geoKind = (o) => o.geometry && o.geometry.type;
const isBall = (o) => o.isMesh && geoKind(o) === 'SphereGeometry' && o.geometry.parameters.radius < .5;   /* mem.js 的果子是小半径的球，叶子是半径 1 再压扁 */
const isLeaf = (o) => o.isMesh && geoKind(o) === 'SphereGeometry' && o.geometry.parameters.radius === 1;
const isStick = (o) => o.isMesh && geoKind(o) === 'CylinderGeometry';
const isCrown = (o) => o.isMesh && geoKind(o) === 'IcosahedronGeometry';

/* 支撑物（叶子、秆、树冠）到一个点的大概距离，负的就是扎进去了；再给一个扎在里面的落点，果柄连到那儿 */
function support(g, o) {
  const M = localM(g, o), inv = M.clone().invert();
  if (isLeaf(o) || isCrown(o)) {
    const k = isCrown(o) ? o.geometry.parameters.radius * .88 : 1;   /* 二十面体的面比外接球往里收一点 */
    const sc = new THREE.Vector3().setFromMatrixScale(M), smin = Math.min(sc.x, sc.y, sc.z) * k;
    return {
      dist: (p) => (p.clone().applyMatrix4(inv).length() / k - 1) * smin,
      anchor: (p, into = .55) => p.clone().applyMatrix4(inv).normalize().multiplyScalar(k * into).applyMatrix4(M),
    };
  }
  const h = o.geometry.parameters.height, r = Math.max(o.geometry.parameters.radiusTop, o.geometry.parameters.radiusBottom);
  const a = new THREE.Vector3(0, -h / 2, 0).applyMatrix4(M), b = new THREE.Vector3(0, h / 2, 0).applyMatrix4(M), ab = b.clone().sub(a);
  const near = (p) => { const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), .05, .95); return a.clone().addScaledVector(ab, t); };
  return { dist: (p) => p.distanceTo(near(p)) - r, anchor: (p) => near(p) };
}

/* 果子在整株里的球心和半径 */
function fruitBall(g, o) {
  const box = new THREE.Box3(), M = localM(g, o);
  o.traverse((m) => { if (m.isMesh && !m.userData.hull) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().applyMatrix4(localM(g, m))); } });
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  return { c, r: Math.max(s.x, s.z) / 2, top: box.max.y, M };
}

/* 双生桃：树干上伸出一根小枝，枝头两颗桃并排吊着 */
function twinpeach(g) {
  const balls = g.children.filter(isBall), crown = g.children.find(isCrown), trunk = g.children.find(isStick);
  if (balls.length < 2 || !crown || !trunk) return;
  const cr = crown.geometry.parameters.radius, cy = crown.position.y, mid = new THREE.Vector3();
  balls.forEach((b) => mid.add(b.position)); mid.divideScalar(balls.length);
  const dir = new THREE.Vector3(mid.x, 0, mid.z).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x);
  const tipR = cr * 1.3, tipY = cy - cr * .62;   /* 枝头伸出树冠外面，从上往下看也看得见桃 */
  const base = new THREE.Vector3(0, cy - cr * 1.08, 0), tip = dir.clone().multiplyScalar(tipR).setY(tipY);
  g.add(rod(base, tip, .011, .006, trunk.material, .003));
  g.add(leaflet(tip.clone().addScaledVector(dir, .012).setY(tipY + .008), Math.atan2(-dir.z, dir.x), crown.material.color.getStyle(), 1));
  balls.slice(0, 2).forEach((b, i) => {
    const r = b.geometry.parameters.radius, s = i ? 1 : -1;
    const top = tip.clone().addScaledVector(side, s * r * .8).addScaledVector(dir, -.004); top.y = tipY - .022;
    b.position.copy(top).setY(top.y - r * .92);
    g.add(rod(tip, top, .004, .003, STALK));
  });
}

/* 潮汐稻：秆子原来斜着搭成个尖顶，穗子在秆尖外面一圈悬着；穗子不动，把每根秆子从根上掰过去，秆尖顶到自己那颗穗子的底 */
function tiderice(g) {
  const stalks = g.children.filter(isStick), ears = g.children.filter(isBall), used = new Set();
  ears.forEach((e) => {
    const half = e.geometry.parameters.radius * e.scale.y, foot = e.position.clone().setY(e.position.y - half * .75);
    let best = null, bd = 1e9;
    for (const s of stalks) { if (used.has(s)) continue; const h = s.geometry.parameters.height, root = new THREE.Vector3(0, -h / 2, 0).applyMatrix4(localM(g, s)), d = Math.hypot(root.x - foot.x, root.z - foot.z); if (d < bd) { bd = d; best = [s, root, h]; } }
    if (!best) return;
    const [s, root, h] = best, d = foot.clone().sub(root); used.add(s);
    s.position.copy(root).addScaledVector(d, .5); s.quaternion.setFromUnitVectors(UP, d.clone().normalize()); s.scale.y = d.length() / h;
    e.quaternion.copy(s.quaternion);
  });
}

/* 照说明长的小树：果子原来挂在树冠边上一圈，顶上什么都没有。位置不动，往下放到树冠底下，
   从树干顶上给每颗伸一根小枝到它头顶，再垂一根果柄，跟柿子树一个意思 */
function specTree(g) {
  const crown = g.children.find(isCrown), trunk = g.children.find(isStick); if (!crown || !trunk) return;
  const R = crown.geometry.parameters.radius * .88, cy = crown.position.y, tTop = trunk.position.y + trunk.geometry.parameters.height / 2;
  const fruits = g.children.filter((o) => o.isGroup && o.children.some((m) => m.userData.body || (m.isGroup && m.children.some((n) => n.userData.body))));
  fruits.forEach((f) => {
    const fb = fruitBall(g, f), rho = Math.hypot(fb.c.x, fb.c.z), dir = new THREE.Vector3(fb.c.x, 0, fb.c.z).normalize();
    const out = Math.max(rho, R * 1.12), elbowY = cy - R * .7;   /* 枝头伸到树冠外沿下面一点 */
    const elbow = dir.clone().multiplyScalar(out).setY(elbowY), top = elbow.clone().setY(elbowY - .022);
    f.position.x += top.x - fb.c.x; f.position.z += top.z - fb.c.z; f.position.y += top.y - fb.top;
    g.add(rod(new THREE.Vector3(0, Math.min(tTop, cy - R * .5), 0), elbow, .008, .005, trunk.material, .003));
    g.add(rod(elbow, top, .004, .003, STALK));
  });
}

/* 矮丛、藤、别的：果子要是一片叶子、一根秆都没挨着，拉一根小果柄到最近的那个上 */
function looseFruit(g, fruits) {
  const sup = g.children.filter((o) => (isLeaf(o) || isStick(o) || isCrown(o)) && !fruits.includes(o)).map((o) => support(g, o));
  if (!sup.length) return;
  for (const f of fruits) {
    const fb = fruitBall(g, f);
    let best = null, bd = 1e9;
    for (const s of sup) { const d = s.dist(fb.c); if (d < bd) { bd = d; best = s; } }
    if (bd < -fb.r * .15) continue;   /* 扎进叶子里了，算挂着 */
    const q = best.anchor(fb.c), from = fb.c.clone().add(q.clone().sub(fb.c).setLength(fb.r * .8));
    if (from.y < fb.c.y) from.copy(fb.c).setY(fb.top - fb.r * .1);   /* 果柄从果子上半边出来，别从底下钻 */
    g.add(rod(from, q, .0045, .003, STALK));
  }
}

/* garden.js 的 cropModel 画完整株以后叫这个，原地改，返回同一个 Group */
export function hang(g, kind) {
  try {
    const sp = TM.SPECIES[kind];
    if (sp && sp.spec) {
      const habit = sp.spec.plant && sp.spec.plant.habit;
      if (habit === 'tree') specTree(g);
      else if (habit === 'bush' || habit === 'vine') looseFruit(g, g.children.filter((o) => o.isGroup));
    } else if (kind === 'twinpeach') twinpeach(g);
    else if (kind === 'tiderice') tiderice(g);
    else if (kind === 'heartberry' || kind === 'velvetgrape' || kind === 'lanternplant') looseFruit(g, g.children.filter(isBall));
  } catch (e) { console.error(e); }
  return g;
}
