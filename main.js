// 日记花园 demo：进门两页沿用暮园资料页——先挑心情写一句，再翻到跑酷页等小螃蟹到家，后面在盖花园
// 数据全在浏览器 IndexedDB，库版本定死 1，以后别升
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
/* 开场那个框：点不要它就躲，躲够四回只剩「……好」 */
let nos = 0;
$('#yes').onclick = () => go(1);
$('#no').onclick = () => {
  const pop = $('#pop');
  if (++nos < 5) { pop.style.left = (60 + Math.random() * (innerWidth - 120)) + 'px'; pop.style.top = (120 + Math.random() * (innerHeight - 240)) + 'px'; return; }
  pop.style.left = '50%'; pop.style.top = '46%';
  $('#popTxt').innerHTML = '来都来了<br>玩一下ᗜ𖥦ᗜ';
  $('#popRow').innerHTML = '<button class="yes" id="ok">……好</button>'; $('#ok').onclick = () => go(1);
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
/* 小巧思：选想被哄、有点丧、乱糟糟、烦，点的地方飞出三个颜文字 */
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
    if (all.some((f) => f.text && dayKey(f.at) === t)) $('#greet').textContent = '今天来过了，再种一朵？';
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
const gardenP = import('./garden.js').then(async (G) => { await G.init($('#cv'), MOODS); return G; });
gardenP.then(() => { R.ready = true; }).catch((e) => { $('#tip').textContent = '花园没盖起来：' + e.message; });

let entering = false;
async function enter(write) {
  if (entering) return; entering = true;
  if (write) await store.put({ id: 'f' + Date.now(), at: Date.now(), mood: pick[0], moods: pick.slice(), text: line.value.trim(), photo, x: 0, z: 1.75 + Math.random() * .3 });
  go(2); R.on = true; R.t0 = performance.now(); requestAnimationFrame(runLoop);
  const G = await gardenP;
  await waitFor(() => R.done); await new Promise((ok) => setTimeout(ok, 700));
  for (let i = 0; i < Math.min(R.basket, 5); i++) await store.put({ id: 'w' + Date.now() + i, at: Date.now() - 5 * DAY, mood: MOODS[Math.floor(Math.random() * MOODS.length)].id, wild: true, x: null, z: null });
  await G.load(await store.all()); G.start();
  R.stop = true; go(-1); $("#hint").hidden = false;
}
const waitFor = (f) => new Promise((ok) => { const t = () => f() ? ok() : setTimeout(t, 120); t(); });
$('#plant').onclick = () => enter(true);
$('#skip').onclick = () => enter(false);

// ---------- 花园里的面板 ----------
document.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => { b.parentElement.hidden = true; });
$('#addBtn').onclick = () => { location.href = './'; };
$('#vaseBtn').onclick = () => { location.href = 'ikebana.html'; };
$('#shopBtn').onclick = () => { location.href = 'shop.html'; };
$('#kitBtn').onclick = () => { location.href = 'kitchen.html'; };
/* 从插花台、店里回来带 ?home：不再进门写一句，直接回花园 */
if (/[?&]home\b/.test(location.search)) {
  go(-1); entering = true;
  gardenP.then(async (G) => { await G.load(await store.all()); G.start(); $('#hint').hidden = false; });
}
$('#menuBtn').onclick = () => { $('#card').hidden = true; $('#post').hidden = true; $('#menu').hidden = false; };
let cur = null;
addEventListener('flower-pick', (e) => {
  const f = e.detail; cur = f; $('#post').hidden = true; $('#menu').hidden = true;
  const d = new Date(f.at), names = (f.moods || [f.mood]).map((id) => moodOf(id).zh).join(' · ');
  $('#cDate').textContent = `${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${names}${f.wild ? ' · 路上捡的野花' : ''}`;
  $('#cTxt').textContent = f.wild ? '小螃蟹跑回家路上捡的，没写字。' : f.text;
  const img = $('#cImg'); if (f.photo) { img.src = f.photo; img.hidden = false; } else img.hidden = true;
  $('#cPost').hidden = !!f.wild; $('#card').hidden = false;
});
addEventListener('flower-moved', (e) => store.put(e.detail));
addEventListener('flower-none', () => { $('#card').hidden = true; });

// ---------- 明信片 ----------
$('#cPost').onclick = async () => {
  const G = await gardenP, f = cur, ms = (f.moods || [f.mood]).map(moodOf);
  const pc = $('#pc'), c = pc.getContext('2d'), W = pc.width, H = pc.height, FONT = '"MaoKenTangYuan (beta)","PingFang SC",sans-serif';
  c.fillStyle = '#fbf6ec'; c.fillRect(0, 0, W, H);
  const pic = await loadImg(f.photo || G.snapshot());
  const pw = 640, ph = H - 120; c.save(); c.beginPath(); c.rect(60, 60, pw, ph); c.clip();
  const k = Math.max(pw / pic.width, ph / pic.height); c.drawImage(pic, 60 + (pw - pic.width * k) / 2, 60 + (ph - pic.height * k) / 2, pic.width * k, pic.height * k); c.restore();
  c.strokeStyle = 'rgba(91,74,68,.2)'; c.beginPath(); c.moveTo(760, 90); c.lineTo(760, H - 90); c.stroke();
  const d = new Date(f.at);
  c.fillStyle = '#a8968c'; c.font = '26px ' + FONT; c.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, 800, 120);
  c.fillStyle = '#5b4a44'; c.font = '36px ' + FONT; wrap(c, f.text, 800, 200, 340, 56);
  c.save(); c.translate(W - 150, 150); c.rotate(-.12); c.strokeStyle = '#9f3726'; c.lineWidth = 4; c.setLineDash([6, 5]);
  c.beginPath(); c.arc(0, 0, 62, 0, 7); c.stroke(); c.setLineDash([]);
  ms.forEach((m, i) => { c.fillStyle = m.c; c.beginPath(); c.arc((i - (ms.length - 1) / 2) * 22, 26, 8, 0, 7); c.fill(); });
  c.fillStyle = '#9f3726'; c.font = '22px ' + FONT; c.textAlign = 'center'; c.fillText('日记花园', 0, -2); c.restore();
  $('#card').hidden = true; $('#post').hidden = false;
};
function wrap(c, t, x, y, w, lh) { let l = ''; for (const ch of t) { if (ch === '\n' || c.measureText(l + ch).width > w) { c.fillText(l, x, y); y += lh; l = ch === '\n' ? '' : ch; } else l += ch; } if (l) c.fillText(l, x, y); }
const loadImg = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
$('#pSave').onclick = async () => {
  const blob = await new Promise((ok) => $('#pc').toBlob(ok, 'image/jpeg', .92));
  const file = new File([blob], '明信片.jpg', { type: 'image/jpeg' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '明信片.jpg'; a.click();
};

// ---------- 打包带走 ----------
$('#mExport').onclick = async () => {
  const blob = new Blob([JSON.stringify({ app: 'diarytown', v: 1, flowers: await store.all() })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '我的花园-' + dayKey(Date.now()) + '.json'; a.click();
};
$('#mImport').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { const j = JSON.parse(await f.text()); for (const x of j.flowers || []) await store.put(x); (await gardenP).load(await store.all()); $('#menu').hidden = true; } catch (err) { alert('这个文件读不了'); }
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
