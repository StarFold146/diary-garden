// 日记花园 demo：进门两页照暮园资料页——先挑心情写一句，再翻到跑酷页等小螃蟹到家，后面在盖花园
// 数据全在浏览器 IndexedDB，库版本定死 1，以后别升
import * as Notes from './notes.js';   /* 更新说明：要排在 day.js 前面，先看有没有老存档 */
import * as Day from './day.js';   /* 一天只给一次花和菜，换天的判断都在 day.js */
import * as Hy from './hybrid.js';   /* 杂交出来的新花：卡片和图鉴用 */
import './bag.js';   /* 背包：顶栏小包，看手上的种子、菜、做好的菜 */
const $ = (s) => document.querySelector(s);
export const MOODS = [
  { id: 'happy', zh: '开心', c: '#f2c14e' },
  { id: 'sweet', zh: '心动', c: '#e98aa4' },
  { id: 'calm', zh: '平静', c: '#9ec5e6' },
  { id: 'coax', zh: '想被哄', c: '#f3b9a0', bad: 1 },
  { id: 'down', zh: '有点丧', c: '#b9a3de', bad: 1 },
  { id: 'messy', zh: '乱糟糟', c: '#c9b38a', bad: 1 },
  { id: 'cross', zh: '烦', c: '#e36a5a', bad: 1 },
];
const DAY = 86400e3;
const dayKey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const moodOf = (id) => MOODS.find((m) => m.id === id) || MOODS[0];

// ---------- 存储 ----------
let dbP = null;
function db() {
  if (!dbP) dbP = new Promise((ok, no) => {
    const r = indexedDB.open('diarytown', 1);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('flowers')) d.createObjectStore('flowers', { keyPath: 'id' }); };
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  return dbP;
}
async function tx(mode, fn) { const d = await db(); return new Promise((ok, no) => { const t = d.transaction('flowers', mode), s = t.objectStore('flowers'); const out = fn(s); t.oncomplete = () => ok(out && out.result !== undefined ? out.result : out); t.onerror = () => no(t.error); }); }
const store = {
  all: () => tx('readonly', (s) => s.getAll()),
  put: (f) => tx('readwrite', (s) => s.put(f)),
  clear: () => tx('readwrite', (s) => s.clear()),
};

// ---------- 第一页：心情（最多三个）+ 一句 + 图 ----------
const go = (n) => document.querySelectorAll('.scr').forEach((s) => s.classList.toggle('on', s.id === 's' + n));
let pick = [], photo = null;
/* 开场那个框（暮园原样搬）：点不要它就躲，躲够四回只剩「……好」 */
let nos = 0;
$('#yes').onclick = () => { go(1); setTimeout(gardenGo, 600); };   /* 心情页淡入完了再开始盖，别卡住那半秒 */
$('#no').onclick = () => {
  const pop = $('#pop');
  if (++nos < 5) { pop.style.left = (60 + Math.random() * (innerWidth - 120)) + 'px'; pop.style.top = (120 + Math.random() * (innerHeight - 240)) + 'px'; return; }
  pop.style.left = '50%'; pop.style.top = '46%';
  $('#popTxt').innerHTML = '来都来了<br>玩一下ᗜ𖥦ᗜ';
  $('#popRow').innerHTML = '<button class="yes" id="ok">……好</button>'; $('#ok').onclick = () => { go(1); setTimeout(gardenGo, 600); };
};
const moodsEl = $('#moods');
MOODS.forEach((m) => {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = m.zh;
  b.onclick = (e) => {
    const i = pick.indexOf(m.id);
    if (i >= 0) pick.splice(i, 1);
    else if (pick.length >= 3) { moodsEl.classList.remove('full'); void moodsEl.offsetWidth; moodsEl.classList.add('full'); return; }
    else { pick.push(m.id); if (m.bad) for (let j = 0; j < 3; j++) fly(e.clientX, e.clientY); }
    b.classList.toggle('on', pick.includes(m.id)); check();
  };
  moodsEl.appendChild(b);
});
const KAO = ['૮₍･᷄-･᷅₎ა', 'UTｪTU'];
function fly(x, y) {
  const d = document.createElement('div'); d.className = 'kao'; d.textContent = KAO[Math.floor(Math.random() * KAO.length)]; document.body.appendChild(d);
  const a = -Math.PI / 2 + (Math.random() - .5) * 1.8, r = 180 + Math.random() * 140, rot = (Math.random() - .5) * 70, dx = Math.cos(a) * r, dy = Math.sin(a) * r;
  d.style.left = x + 'px'; d.style.top = y + 'px';
  d.animate([
    { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
    { transform: `translate(calc(-50% + ${dx * .55}px),calc(-50% + ${dy * .55}px)) scale(1.15) rotate(${rot * .5}deg)`, opacity: 1, offset: .35 },
    { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1) rotate(${rot}deg)`, opacity: 0 },
  ], { duration: 1300 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).onfinish = () => d.remove();
}
const line = $('#line');
line.addEventListener('input', check);
function check() { $('#plant').disabled = !(pick.length && line.value.trim()); }
$('#photo').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  photo = await shrinkPhoto(f); const t = $('#thumb'); t.src = photo; t.hidden = false;
});
function shrinkPhoto(file) {
  return new Promise((ok) => {
    const img = new Image(); img.onload = () => {
      const k = Math.min(1, 1000 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); ok(c.toDataURL('image/jpeg', .82));
    }; img.onerror = () => ok(null); img.src = URL.createObjectURL(file);
  });
}
(async () => {   // 第二天来，门口换句话
  try {
    const all = await store.all(), y = dayKey(Date.now() - DAY), t = dayKey(Date.now());
    /* 今天的花和菜领过了：还能写，字夹进今天那朵花里，不再多给 */
    if (Day.done('diary') || todayFlower(all)) { $('#greet').textContent = '今天来过了，再写几句？'; $('#once').hidden = false; $('#plant').textContent = '记 下'; }
    else if (all.some((f) => f.text && dayKey(f.at) === y)) $('#greet').textContent = '昨天那朵还开着。今天呢？';
  } catch (e) {}
})();

// ---------- 第二页：跑酷。黑螃蟹白眼睛，像断网的小恐龙 ----------
const run = $('#run'), rc = run.getContext('2d'), INK = '#2b2523', PX = 4;
rc.imageSmoothingEnabled = false;
const CRAB = [   // 1 黑 2 白眼睛；两帧腿
  ['1000000000001', '1100000000011', '0111111111110', '0111111111110', '0112211112210', '0112211112210', '0111111111110', '0111111111110', '0010100001010', '0100010010001'],
  ['1000000000001', '1100000000011', '0111111111110', '0111111111110', '0112211112210', '0112211112210', '0111111111110', '0111111111110', '0101000000101', '0010100101000'],
];
const ROCK = ['0011100', '0111110', '1111111', '1111111'];
const POT = ['0010100', '0001000', '0111110', '0111110', '0011100'];
const BLOOM = ['01010', '10101', '01010', '00100', '00100'];
function sprite(rows, x, y, map = { 1: INK, 2: '#fbf7ef' }) {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const v = rows[j][i]; if (v === '0') continue; rc.fillStyle = map[v] || INK; rc.fillRect(Math.round(x + i * PX), Math.round(y + j * PX), PX, PX); }
}
const GY = 88;
const R = { on: false, x: 34, y: 0, vy: 0, fall: 0, dist: 0, items: [], basket: 0, ready: false, done: false, gateX: null, next: 1, t0: 0, prog: 0 };
function jump() { if (R.y === 0 && R.fall <= 0 && !R.done) R.vy = 280; }
run.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
let last = 0;
function runLoop(now) {
  const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
  const W = run.width, sp = R.done ? 0 : 120;
  R.dist += sp * dt;
  if (R.fall > 0) R.fall -= dt; else { R.vy -= 720 * dt; R.y = Math.max(0, R.y + R.vy * dt); if (R.y === 0) R.vy = 0; }
  R.next -= dt;
  if (R.next <= 0 && R.gateX === null) { const r = Math.random(); R.items.push({ x: W + 10, k: r < .35 ? 'rock' : r < .55 ? 'pot' : 'bloom', hit: false }); R.next = .9 + Math.random() * 1.2; }
  const el = (now - R.t0) / 1000;
  R.prog = Math.min(R.ready ? 1 : .9, el / 6);
  $('#barI').style.width = (R.done ? 100 : R.prog * 100) + '%';
  if (R.ready && R.gateX === null && el > 5) R.gateX = W + 10;
  rc.clearRect(0, 0, W, run.height);
  rc.fillStyle = INK; for (let x = -(R.dist % 9); x < W; x += 9) rc.fillRect(Math.round(x), GY + 1, 5, 1);
  for (let i = 0; i < 6; i++) { const x = ((i * 67 - R.dist * .5) % (W + 30) + W + 30) % (W + 30) - 15; rc.fillRect(Math.round(x), GY + 6 + (i % 2) * 5, 2, 1); }
  for (const it of R.items) {
    it.x -= sp * dt;
    const spr = it.k === 'rock' ? ROCK : it.k === 'pot' ? POT : BLOOM, h = spr.length * PX;
    if (!(it.k === 'bloom' && it.hit)) sprite(spr, it.x, GY - h + (it.k === 'bloom' ? -22 : 0));
    if (!it.hit && Math.abs(it.x + 12 - (R.x + 26)) < 24) {
      if (it.k === 'bloom') { if (R.y > 4) { it.hit = true; R.basket++; $('#tip').textContent = `捡了 ${R.basket} 朵，到家种篱笆边`; } }
      else if (R.y < 10 && R.fall <= 0) { it.hit = true; R.fall = .8; }
    }
  }
  R.items = R.items.filter((i) => i.x > -30);
  if (R.gateX !== null) {
    R.gateX -= sp * dt; if (R.gateX < R.x + 60) { R.gateX = R.x + 46; R.done = true; }
    rc.fillStyle = INK; rc.fillRect(Math.round(R.gateX), GY - 56, 4, 57); rc.fillRect(Math.round(R.gateX) + 36, GY - 56, 4, 57); rc.fillRect(Math.round(R.gateX) - 4, GY - 60, 48, 4);
    for (let i = 0; i < 5; i++) rc.fillRect(Math.round(R.gateX) + 4 + i * 7, GY - 28, 3, 29);
  }
  const frame = R.y > 0 || R.done ? 0 : Math.floor(now / 110) % 2;
  const cx = R.done ? R.x + 18 : R.x, cy = GY - 40 - R.y;
  if (R.fall > 0) { rc.save(); rc.translate(cx + 26, cy + 20); rc.rotate(Math.sin((.8 - R.fall) / .8 * Math.PI) * 2.6); sprite(CRAB[0], -26, -20); rc.restore(); }
  else sprite(CRAB[frame], cx, cy);
  if (R.done) { $('#tip').textContent = R.basket ? `到家了，篮子里 ${R.basket} 朵` : '到家了'; }
  if (!R.stop) requestAnimationFrame(runLoop);
}

// ---------- 花园在后面盖 ----------
/* 模块先下载，盖园子等她点了「要」（或者从游戏里回来）才开始——盖的那几秒主线程很忙，开场框点不动 */
let gardenGo; const gardenGate = new Promise((ok) => { gardenGo = ok; });
const gardenP = import('./garden.js').then(async (G) => { await gardenGate; await G.init($('#cv'), MOODS); return G; });
gardenP.then(() => { R.ready = true; }).catch((e) => { $('#tip').textContent = '花园没盖起来：' + e.message; });

let entering = false;
async function enter(write) {
  if (entering) return; entering = true;
  if (write) {
    /* 一天一朵花、一份菜：今天已经有花了，这几句夹进那朵花的 more 里，不再种新的 */
    const old = todayFlower(await store.all());
    if (old) { (old.more = old.more || []).push({ at: Date.now(), moods: pick.slice(), text: line.value.trim(), photo }); await store.put(old); }
    else { await store.put({ id: 'f' + Date.now(), at: Date.now(), mood: pick[0], moods: pick.slice(), species: Hy.pickForMood(pick[0]), text: line.value.trim(), photo, x: 0, z: 1.75 + Math.random() * .3 }); Day.claimDiary(pick); }   /* 领到哪种花按第一个心情抽，六成常见、各两成少见（Hy.pickForMood），记在 species；老花没这个字段照旧按心情 */
  }
  go(2); R.on = true; R.t0 = performance.now(); requestAnimationFrame(runLoop);
  const G = await gardenP;
  await waitFor(() => R.done); await new Promise((ok) => setTimeout(ok, 700));
  const basket = R.basket && Day.once('basket') ? Math.min(R.basket, 5) : 0;   /* 路上捡的野花也一天只收一篮 */
  for (let i = 0; i < basket; i++) await store.put({ id: 'w' + Date.now() + i, at: Date.now() - 5 * DAY, mood: MOODS[Math.floor(Math.random() * MOODS.length)].id, wild: true, x: null, z: null });
  await G.load(await store.all()); G.start(); setTimeout(Notes.showIfNew, 1200);
  R.stop = true; go(-1); $("#hint").hidden = false;
}
const todayFlower = (all) => all.find((f) => !f.wild && f.text && Day.isToday(f.at));
const waitFor = (f) => new Promise((ok) => { const t = () => f() ? ok() : setTimeout(t, 120); t(); });
$('#plant').onclick = () => enter(true);
$('#skip').onclick = () => enter(false);

// ---------- 花园里的面板 ----------
document.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => { b.parentElement.hidden = true; });
$('#addBtn').onclick = () => { location.href = './'; };
$('#vaseBtn').onclick = () => { location.href = 'ikebana.html'; };
$('#shopBtn').onclick = () => { location.href = 'shop.html'; };
/* 从游戏里面回来（店、后厨、插花台、种子铺，所有回花园都带 ?home）：不弹「要玩吗」、不进心情页，
   只有「回家中」和进度条，不跑螃蟹；花园盖好就进。头一回来不带参数，照旧 */
if (/[?&]home\b/.test(location.search)) {
  go(2); entering = true; gardenGo();
  const t0 = performance.now(); let ready = false;
  (function bar() { if (ready) return; $('#barI').style.width = Math.min(90, (performance.now() - t0) / 60) + '%'; requestAnimationFrame(bar); })();
  gardenP.then(async (G) => {
    await G.load(await store.all()); ready = true; $('#barI').style.width = '100%';
    await new Promise((ok) => setTimeout(ok, 350)); G.start(); setTimeout(Notes.showIfNew, 1200); go(-1); document.documentElement.classList.remove('home'); $('#hint').hidden = false;
  });
}
$('#menuBtn').onclick = () => { $('#card').hidden = true; $('#post').hidden = true; $('#menu').hidden = false; };
let cur = null;
addEventListener('flower-pick', (e) => {
  const f = e.detail; cur = f; $('#post').hidden = true; $('#menu').hidden = true;
  const d = new Date(f.at), names = (f.moods || [f.mood]).map((id) => moodOf(id).zh).join(' · ');
  const rareSp = !f.hybrid && isRare(f.species) ? ' · ' + Hy.nameOf(f.species) + '（少见）' : '';   /* 抽到少见的那种，卡片上报个名 */
  $('#cDate').textContent = `${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${names}${rareSp}${f.wild ? ' · 路上捡的野花' : ''}`;
  $('#cTxt').textContent = f.wild ? '小螃蟹跑回家路上捡的，没写字。' : [f.text, ...(f.more || []).map((m) => m.text)].join('\n\n');   /* 同一天后来再写的几句跟在后面 */
  const img = $('#cImg'); if (f.photo) { img.src = f.photo; img.hidden = false; } else img.hidden = true;
  $('#cPost').hidden = !!f.wild; $('#card').hidden = false;
  /* 盆边冒出来的新花没写字：换成它的名字和爸妈 */
  if (f.hybrid) { const sp = Hy.speciesById(f.species); $('#cDate').textContent = `${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${Hy.nameOf(f.species)} · 盆边冒出来的`; $('#cTxt').textContent = sp && sp.parents ? `${sp.parents.map(Hy.nameOf).join(' × ')}，两盆挨着过了一夜。` : '两盆花挨着过了一夜。'; $('#cPost').hidden = true; }
});
addEventListener('flower-moved', (e) => store.put(e.detail));
addEventListener('flower-none', () => { $('#card').hidden = true; });

// ---------- 明信片 ----------
const PC = { paper: '#f6f1e7', plate: '#ede6d8', ink: '#4a3f3a', soft: '#a39488', line: 'rgba(74,63,58,.28)',
  hand: '"MaoKenTangYuan (beta)","PingFang SC",sans-serif', latin: '"Cormorant Garamond","Noto Serif SC",serif' };
const STY_NP = ['A:bunch', 'B:bunch', 'A:hero', 'B:hero', 'A:flat', 'B:flat'], STY_PH = ['A', 'B'];
let pcI = 0;
const styOf = (f) => (f.photo ? STY_PH : STY_NP)[pcI % (f.photo ? STY_PH : STY_NP).length];
/* 这把花：这天一个心情一枝，再配前几天的一两枝，凑三到五枝 */
/* 日记花带的 species 是底子花，照旧一个心情一枝，领到的那种打头；杂交花才整朵拿 */
const isRare = (id) => !!(id && Hy.SPECIES[id] && Hy.SPECIES[id].rare);
const ownSp = (f) => f.genes || (f.species && !Hy.isBase(f.species));
async function bunchOf(f) {
  const own = ownSp(f) ? [f] : (f.moods || [f.mood]).map((m, i) => i || !f.species ? { mood: m, moods: [m] } : { mood: m, moods: [m], species: f.species });
  const before = (await store.all()).filter((x) => !x.wild && x.id !== f.id && x.at < f.at).sort((a, b) => b.at - a.at);
  const seen = new Set(own.map((x) => x.species || x.mood)), out = own.slice();
  for (const x of before) { if (out.length >= Math.max(3, own.length + 2) || out.length >= 5) break; const k = x.species || (x.moods || [x.mood])[0]; if (seen.has(k)) continue; seen.add(k); out.push(ownSp(x) ? x : x.species ? { mood: (x.moods || [x.mood])[0], moods: [(x.moods || [x.mood])[0]], species: x.species } : { mood: k, moods: [k] }); }
  while (out.length < 3) out.push({ ...own[out.length % own.length] });
  return out.slice(0, 5);
}
/* 特写那一枝：杂交花整朵；日记花领到哪种就用哪种，只上它那一个色 */
const heroOf = (f, ms) => ownSp(f) ? f : f.species ? { mood: ms[0].id, moods: [ms[0].id], species: f.species } : { mood: ms[0].id, moods: ms.map((m) => m.id) };
const seedOf = (f) => [...String(f.id || 'x')].reduce((a, ch) => a * 31 + ch.charCodeAt(0) | 0, 7) & 1023;
async function drawCard(f, v) {
  const [lay0, kind = 'bunch'] = v.split(':'); v = lay0;
  const FL = await import('./postcard-flora.js'), ms = (f.moods || [f.mood]).map(moodOf), d = new Date(f.at), text = (f.text || '').trim() || '今天没写字。';
  const pc = $('#pc'), A = v !== 'B', W = A ? 1000 : 1400, H = A ? 1400 : 1000; pc.width = W; pc.height = H;
  const c = pc.getContext('2d');
  const ds = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  await Promise.all([`40px ${PC.hand}`, `500 30px ${PC.latin}`, `italic 500 30px ${PC.latin}`].map((ft) => document.fonts.load(ft, text + ds + ms.map((m) => m.zh).join('') + '日记花园 Diary Garden').catch(() => {})));
  // 纸：暖白，极淡的一层纤维颗粒，别的不加
  c.fillStyle = PC.paper; c.fillRect(0, 0, W, H);
  const N = c.getImageData(0, 0, W, H), px = N.data; for (let i = 0; i < px.length; i += 4) { const r = (Math.random() - .5) * 7; px[i] += r; px[i + 1] += r; px[i + 2] += r * .9; } c.putImageData(N, 0, 0);
  const M = A ? 96 : 100, IW = A ? W - M * 2 : 640, IH = A ? IW : H - M * 2;   // A 正方形横满版心；B 竖的 4:5
  const ix = M, iy = M;
  if (f.photo) {
    const pic = await loadImg(f.photo); c.save(); c.beginPath(); c.rect(ix, iy, IW, IH); c.clip();
    const k = Math.max(IW / pic.width, IH / pic.height); c.drawImage(pic, ix + (IW - pic.width * k) / 2, iy + (IH - pic.height * k) / 2, pic.width * k, pic.height * k); c.restore();
  } else {
    // 没照片：那朵花就是主图，放在一块略深的纸上，像标本卡
    const list = kind === 'hero' ? [heroOf(f, ms)] : await bunchOf(f);
    const fl = await loadImg(FL.shoot(kind, list, IW, IH, null, seedOf(f))); c.drawImage(fl, ix, iy, IW, IH);   // 夜：压花直接贴在明信片纸上，不要底板
  }
  // 字的区域
  const tx = A ? M : M + IW + 100, tw = A ? W - M * 2 : W - tx - M, top = A ? iy + IH + 92 : M + 4;
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  c.fillStyle = PC.soft; c.font = `500 26px ${PC.latin}`; spaced(c, ds, tx, top + 18, 5);
  c.fillStyle = PC.ink; c.font = `${A ? 37 : 36}px ${PC.hand}`;
  const lines = lay(c, text, A ? tw - 150 : tw).slice(0, A ? 3 : 7), lh = A ? 62 : 60, ty = top + (A ? 96 : 220);
  lines.forEach((l, i) => c.fillText(l, tx, ty + i * lh));
  // 心情：色点 + 小字，压在最底下一行
  const my = A ? H - M - 4 : M + IH - 6; let mx = tx;
  c.font = `24px ${PC.hand}`;
  ms.forEach((m) => { c.fillStyle = m.c; c.beginPath(); c.arc(mx + 9, my - 8, 9, 0, 7); c.fill(); c.fillStyle = PC.soft; c.fillText(m.zh, mx + 28, my); mx += 28 + c.measureText(m.zh).width + 34; });
  if (A) { c.fillStyle = PC.soft; c.font = `italic 500 24px ${PC.latin}`; c.textAlign = 'right'; c.fillText('Diary Garden', W - M, my); c.textAlign = 'left'; }
  // 唯一的小细节
  if (f.photo) {   // 细线邮票框，里面是那天那朵花
    const sw = A ? 112 : 120, sh = sw * 1.22, sx = W - M - sw, sy = A ? top - 6 : M;
    c.fillStyle = PC.plate; c.fillRect(sx, sy, sw, sh);
    const fl = await loadImg(FL.shoot('hero', [heroOf(f, ms)], Math.round(sw * 2), Math.round(sh * 2), PC.plate, seedOf(f))); c.drawImage(fl, sx, sy, sw, sh);
    c.strokeStyle = PC.line; c.lineWidth = 1.5; c.strokeRect(sx - 7.5, sy - 7.5, sw + 15, sh + 15);
  } else {         // 一圈细邮戳，月日在里面
    const r = A ? 62 : 66, cx = W - M - r, cy = A ? top + r - 20 : M + r;
    c.save(); c.translate(cx, cy); c.rotate(-.18); c.strokeStyle = PC.line; c.lineWidth = 1.5;
    c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, r - 9, 0, 7); c.stroke();
    c.fillStyle = 'rgba(74,63,58,.42)'; c.textAlign = 'center'; c.font = `500 20px ${PC.latin}`; c.fillText(`${d.getMonth() + 1} · ${d.getDate()}`, 0, 7);
    c.font = `15px ${PC.hand}`; c.fillText('日 记 花 园', 0, -24); c.fillText(String(d.getFullYear()), 0, 38); c.restore();
  }
}
function spaced(c, t, x, y, sp) { for (const ch of t) { c.fillText(ch, x, y); x += c.measureText(ch).width + sp; } }
function lay(c, t, w) { const out = []; let l = ''; for (const ch of t) { if (ch === '\n') { out.push(l); l = ''; continue; } if (c.measureText(l + ch).width > w && l) { if ('，。、！？；：,.!?）」'.includes(ch)) { out.push(l + ch); l = ''; continue; } out.push(l); l = ch; } else l += ch; } if (l) out.push(l); return out; }
const loadImg = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
let pcQ = Promise.resolve();
const pcDraw = (v) => (window.__pcP = pcQ = pcQ.then(() => drawCard(cur, v)).catch((e) => console.error(e)));
$('#cPost').onclick = async () => {
  pcI = 0; const v = window.__pcVariant || styOf(cur);
  await pcDraw(v); $('#card').hidden = true; $('#post').hidden = false;
};
$('#pFlip').onclick = () => { pcI++; pcDraw(styOf(cur)); };
$('#pSave').onclick = async () => {
  const blob = await new Promise((ok) => $('#pc').toBlob(ok, 'image/jpeg', .92));
  const file = new File([blob], '明信片.jpg', { type: 'image/jpeg' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '明信片.jpg'; a.click();
};

// ---------- 打包带走 ----------
/* 整个打包：花、localStorage 里所有 diarytown_ 开头的（花币、种子、菜篮子、柜子、菜谱、花位、新花……）、插花库 diarytown-vase。
   v2 文件；只有 flowers 的老文件照样能搬回来 */
function vaseStore(mode, fn) {
  return new Promise((ok) => {
    let r; try { r = indexedDB.open('diarytown-vase', 1); } catch (e) { ok([]); return; }
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('vases')) r.result.createObjectStore('vases', { keyPath: 'id' }); };
    r.onerror = () => ok([]);
    r.onsuccess = () => { const d = r.result, t = d.transaction('vases', mode), s = t.objectStore('vases'), q = fn(s); t.oncomplete = () => { d.close(); ok(q && q.result || []); }; t.onerror = () => { d.close(); ok([]); }; };
  });
}
$('#mExport').onclick = async () => {
  const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('diarytown_')) ls[k] = localStorage.getItem(k); }
  const blob = new Blob([JSON.stringify({ app: 'diarytown', v: 2, flowers: await store.all(), local: ls, vases: await vaseStore('readonly', (s) => s.getAll()) })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '我的花园-' + dayKey(Date.now()) + '.json'; a.click();
};
$('#mImport').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text()); for (const x of j.flowers || []) await store.put(x);
    for (const [k, v] of Object.entries(j.local || {})) if (k.startsWith('diarytown_') && typeof v === 'string') localStorage.setItem(k, v);
    /* 前打的包是老物价，钱少：去掉换物价的记号，重进时 day.js 再补到 500 */
    if (j.local && !j.local.diarytown_econ_v2) localStorage.removeItem('diarytown_econ_v2');
    if (j.vases && j.vases.length) await vaseStore('readwrite', (s) => { j.vases.forEach((v) => s.put(v)); });
    if (j.local) { location.href = './?home'; return; }   /* 钱、种子、花位都换了，重进一遍花园 */
    (await gardenP).load(await store.all()); $('#menu').hidden = true;
  } catch (err) { alert('这个文件读不了'); }
};
$('#mDemo').onclick = async () => {
  const lines = ['下午的光很好', '实验又重做了一遍', '吃到一碗很好吃的面', '有点想家', '把房间收拾干净了', '雨下了一整天', '听了一首老歌', '什么都不想干', '跟朋友打了很久电话', '风好大', '买到了想要的书', '睡了一个长长的午觉', '走路回家看见晚霞', '有点累，但还行', '今天话很少', '画了一张小画', '路边的猫让我摸了', '被夸了一句', '心里闷闷的', '又是平平常常的一天'];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + .2, r = 2 + (i % 3) * .42, ms = [MOODS[i * 3 % 7].id]; if (i % 4 === 1) ms.push(MOODS[(i * 5 + 2) % 7].id);
    await store.put({ id: 'd' + i, at: Date.now() - (19 - i) * .95 * DAY - 3600e3, mood: ms[0], moods: ms, text: lines[i], photo: null, x: Math.cos(a) * r, z: Math.sin(a) * r });
  }
  (await gardenP).load(await store.all()); $('#menu').hidden = true;
};
$('#mClear').onclick = async () => { if (!confirm('花园里的花全清掉？')) return; await store.clear(); (await gardenP).load([]); $('#menu').hidden = true; };

// ---------- 图鉴：园子里配出来的新花，点名字改名 ----------
/* 起日记花按心情抽，少见的那几种抽到过的也记在这儿，排在配出来的新花前面，不能改名 */
async function renderBook() {
  const hs = Hy.hybrids(), ul = $('#bookList');
  const got = new Set((await store.all()).filter((f) => !f.hybrid && isRare(f.species)).map((f) => f.species));
  const rs = Object.values(Hy.SPECIES).filter((s) => got.has(s.id));
  ul.innerHTML = hs.length || rs.length ? '' : '<li class="empty">还没有。两盆不一样的插花挨着摆一夜，第二天盆边会冒苗。</li>';
  for (const s of rs) {
    const li = document.createElement('li'), m = MOODS.find((x) => x.id === s.id.replace(/\d+$/, ''));
    li.innerHTML = `<i style="background:${s.c}"></i><b></b><small>${m ? m.zh + '那天' : ''}抽到的 · 少见</small>`;
    li.querySelector('b').textContent = s.zh; li.style.cursor = 'default'; ul.appendChild(li);
  }
  for (const s of hs) {
    const li = document.createElement('li');
    li.innerHTML = `<i style="background:${Hy.hexOf(s.genes)}"></i><b></b><small>${(s.parents || []).map(Hy.nameOf).join(' × ')}${s.genes.mut ? ' · 变了一点' : ''}</small>`;
    li.querySelector('b').textContent = s.name;
    li.onclick = () => { const nm = prompt('给它起个名字', s.name); if (nm && Hy.rename(s.id, nm)) renderBook(); };
    ul.appendChild(li);
  }
}
$('#mExpand').onclick = async () => { $('#menu').hidden = true; (await gardenP).openExpand(); };
$('#mNotes').onclick = () => { $('#menu').hidden = true; Notes.show(); };
$('#mBook').onclick = () => { $('#menu').hidden = true; renderBook(); $('#book').hidden = false; };
