// 杂交：每朵花的「基因」就是插花台捏花的参数。两盆在院子里挨着过一夜，第二天盆边冒一株苗；
// 每条基因随机随一方，颜色取中间往亮的一边偏（不混灰）；约一成变异（重瓣，或色相跳一格）；新花自动起名（各取爸妈名字一个字），玩家点一下能改。
// 这个文件只算不画：garden.js 画苗、ikebana.js 按基因捏花、店按 seedItems() 上架。
// 存 localStorage：diarytown_species（新花图鉴）、diarytown_hybrid_pairs（哪两盆已经结过）、diarytown_seedlings（园子里冒出来的苗）；
// 种子还是走 day.js 的 diarytown_seeds，键就是新花的 id。
const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
export const DAY = 86400e3;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* —— 基因：全是整数档，手机上同一档共用一个模型 ——
   n 外圈瓣数 4–8；dbl 重瓣 0/1；shape 瓣形 0 窄披针…4 圆阔；notch 梢缺口 0–3；cup 兜深 0–3；ruffle 褶密 0–3；
   form 0 单朵、1 攒球（蓝雪花那种一簇小花）；hue 0–35（十度一档）；sat 0–4；lit 0–4；size 0–4 花头大小；height 0–4 枝高 */
export const RANGE = { n: [4, 8], dbl: [0, 1], shape: [0, 4], notch: [0, 3], cup: [0, 3], ruffle: [0, 3], form: [0, 1], hue: [0, 35], sat: [0, 4], lit: [0, 4], size: [0, 4], height: [0, 4] };
const KEYS = Object.keys(RANGE);
const SAT = [.36, .5, .62, .74, .86], LIT = [.5, .58, .66, .74, .82];

/* —— 颜色：基因 ↔ 十六进制 —— */
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToHex(h, s, l) {
  const f = (k) => { const x = (k + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(x - 3, 9 - x, 1)); };
  return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
const nearest = (arr, v) => arr.reduce((bi, x, i) => Math.abs(x - v) < Math.abs(arr[bi] - v) ? i : bi, 0);
export const colorGenes = (hex) => { const [h, s, l] = hexToHsl(hex); return { hue: Math.round(h / 10) % 36, sat: nearest(SAT, s), lit: nearest(LIT, l) }; };
export const hexOf = (g) => hslToHex(g.hue * 10, SAT[clamp(g.sat, 0, 4)], LIT[clamp(g.lit, 0, 4)]);

const base = (id, zh, c, g) => ({ id, zh, c, base: true, genes: { form: 0, dbl: 0, ...colorGenes(c), ...g } });
export const SPECIES = {
  happy: base('happy', '晴铃花', '#f2c14e', { n: 8, shape: 1, notch: 0, cup: 0, ruffle: 1, size: 2, height: 2 }),
  sweet: base('sweet', '怦心兰', '#e98aa4', { n: 5, dbl: 1, shape: 3, notch: 1, cup: 2, ruffle: 2, size: 3, height: 3 }),
  calm: base('calm', '澄水莲', '#9ec5e6', { n: 5, shape: 2, notch: 1, cup: 1, ruffle: 0, form: 1, size: 1, height: 2 }),
  coax: base('coax', '软糖花', '#f3b9a0', { n: 6, dbl: 1, shape: 4, notch: 1, cup: 2, ruffle: 3, size: 4, height: 2 }),
  down: base('down', '垂雨铃', '#b9a3de', { n: 5, shape: 2, notch: 0, cup: 3, ruffle: 0, size: 2, height: 3 }),
  messy: base('messy', '毛线球', '#c9b38a', { n: 8, shape: 2, notch: 2, cup: 0, ruffle: 1, size: 2, height: 4 }),
  cross: base('cross', '炸毛菊', '#e36a5a', { n: 4, shape: 4, notch: 0, cup: 2, ruffle: 3, size: 3, height: 3 }),
};
const ALIAS = { tired: 'down', blue: 'calm' };   /* 旧 demo 的两个心情 id */
export const baseId = (id) => SPECIES[id] ? id : SPECIES[ALIAS[id]] ? ALIAS[id] : 'sweet';

/* —— 图鉴：杂交出来的新花 —— */
export const hybrids = () => get('diarytown_species', []);
export const speciesById = (id) => SPECIES[id] || hybrids().find((s) => s.id === id) || null;
export const speciesList = () => [...Object.values(SPECIES), ...hybrids()];
export function rename(id, name) {
  name = String(name || '').trim().slice(0, 6); if (!name) return false;
  const list = hybrids(), s = list.find((x) => x.id === id); if (!s) return false;
  s.name = name; s.auto = false; put('diarytown_species', list); return true;
}
export const nameOf = (id) => { const s = speciesById(id); return s ? (s.zh || s.name) : '花'; };

/* 一朵花（花园库的记录、插花台的枝、店里的种子）的物种 id 和基因 */
export const speciesIdOf = (f) => f && f.species ? f.species : baseId(f && f.moods && f.moods.length ? f.moods[0] : (f && f.mood) || 'sweet');
export function genesOf(f) {
  if (f && f.genes) return f.genes;
  const s = speciesById(speciesIdOf(f)); return (s && s.genes) || SPECIES.sweet.genes;
}
/* 花瓣颜色：多选心情的日记花轮着上色，杂交花只有自己那一个色 */
export function colorsOf(f) {
  if (f && (f.genes || (f.species && !SPECIES[f.species]))) return [hexOf(genesOf(f))];
  const ids = f && f.moods && f.moods.length ? f.moods : [(f && f.mood) || 'sweet'];
  return ids.map((id) => SPECIES[baseId(id)].c);
}

/* —— 基因 → 捏花参数（插花台的 petalGeo / blossom 吃这个）—— */
const WD = [.07, .095, .12, .15, .18], NOTCH = [0, .05, .09, .14], CUP = [0, .5, 1, 1.6], RUF = [0, .5, 1, 1.7], SIZE = [.85, 1, 1.15, 1.3, 1.5], HGT = [.8, .9, 1, 1.1, 1.2];
export function paramsOf(g) {
  const L = .16, shape = clamp(g.shape, 0, 4);
  return {
    n: clamp(g.n, 4, 8), dbl: !!g.dbl, cluster: g.form === 1,
    petal: { L, Wd: WD[shape], cup: CUP[clamp(g.cup, 0, 3)], reflex: g.cup >= 3 ? .5 : 1, ruffle: RUF[clamp(g.ruffle, 0, 3)], notch: NOTCH[clamp(g.notch, 0, 3)] },
    scale: SIZE[clamp(g.size, 0, 4)], height: HGT[clamp(g.height, 0, 4)], hex: hexOf(g),
  };
}

/* —— 配：每条基因随机随一方；颜色取中间往亮的一边偏；约一成变异 —— */
export function mixColor(a, b, R = Math.random) {
  const bright = (g) => g.sat * 1.2 + g.lit;            /* 谁更亮更饱和，颜色就往谁偏 */
  const [p, q] = bright(a) >= bright(b) ? [a, b] : [b, a];
  let d = ((p.hue - q.hue) % 36 + 54) % 36 - 18;          /* 色环上走短的那条弧 */
  const hue = ((q.hue + d * (.5 + .22 * (R() * .5 + .5)) + 36 * 4) % 36 + 36) % 36;   /* 中点再往亮的一边偏一点 */
  const sat = clamp(Math.round((a.sat + b.sat) / 2 * .4 + Math.max(a.sat, b.sat) * .6), 1, 4);   /* 不混灰 */
  const lit = clamp(Math.round((a.lit + b.lit) / 2 * .7 + Math.max(a.lit, b.lit) * .3), 0, 4);
  return { hue: Math.round(hue) % 36, sat, lit };
}
export function cross(a, b, R = Math.random) {
  const g = {};
  for (const k of KEYS) g[k] = (R() < .5 ? a : b)[k];
  Object.assign(g, mixColor(a, b, R));
  g.mut = null;
  if (R() < .1) {
    if (R() < .5 && !g.form) { if (g.dbl) g.n = clamp(g.n + 1, 4, 8); g.dbl = 1; g.mut = 'dbl'; }
    else { g.hue = (g.hue + (R() < .5 ? 1 : -1) * (6 + Math.floor(R() * 7)) + 36) % 36; g.mut = 'hue'; }
  }
  if (g.form) g.dbl = 0;                                   /* 攒球的小花不重瓣 */
  for (const k of KEYS) g[k] = clamp(Math.round(g[k]), RANGE[k][0], RANGE[k][1]);
  return g;
}

/* —— 起名：爸妈名字各取一个字（晴铃花 × 怦心兰 → 铃怦）：前者取末字、后者取首字。
   只去掉结尾那一个后缀字（花兰莲铃球菊草），中间的不动：晴铃花→晴铃、垂雨铃→垂雨、毛线球→毛线；两字相同的组合不要 —— */
const stem = (n) => { const a = [...(n || '花')]; return a.length > 1 && /[花兰莲铃球菊草]/.test(a[a.length - 1]) ? a.slice(0, -1) : a; };
export function autoName(na, nb, taken = []) {
  const A = stem(na), B = stem(nb);
  const tries = [A[A.length - 1] + B[0], A[0] + B[B.length - 1], B[B.length - 1] + A[0], B[0] + A[A.length - 1]];
  for (const t of tries) if (t[0] !== t[1] && !taken.includes(t)) return t;
  let n = 2; while (taken.includes(tries[0] + n)) n++;
  return tries[0] + n;
}

/* —— 两盆挨着过一夜 → 新花 + 一株苗 ——
   placed 是 day.js 的 diarytown_vases_placed（{id, x, z, placedAt, species?, colors?}），挨着 = 相距不到半格；
   两盆都是昨天以前摆的、而且这对没结过，才结。同一对只结一次。 */
export const ADJ = .5;
export const adjacent = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) <= ADJ;
const moodOfColor = (hex) => { const [h] = hexToHsl(hex); let best = 'sweet', bd = 1e9; for (const s of Object.values(SPECIES)) { const d = Math.min(Math.abs(s.genes.hue * 10 - h), 360 - Math.abs(s.genes.hue * 10 - h)); if (d < bd) { bd = d; best = s.id; } } return best; };
/* 一盆花里的物种（第一枝是主枝）；老记录没存 species 就按颜色认 */
export const vaseSpecies = (v) => (v.species || (v.colors || []).map((c) => c === 'leaf' ? null : moodOfColor(c))).filter(Boolean);
export const seedlings = () => get('diarytown_seedlings', []);
export const bredPairs = () => get('diarytown_hybrid_pairs', {});
export function breedOvernight(placed, now = Date.now(), R = Math.random) {
  const t0 = new Date(now); t0.setHours(0, 0, 0, 0); const today = t0.getTime();
  const pairs = bredPairs(), list = hybrids(), sprouts = seedlings(), out = [];
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j];
    if (!adjacent(a, b) || !(a.placedAt < today && b.placedAt < today)) continue;
    const key = [a.id, b.id].sort().join('|'); if (pairs[key]) continue;
    const sa = vaseSpecies(a), sb = vaseSpecies(b);
    let pa = null, pb = null;
    for (const x of sa) { for (const y of sb) if (x !== y) { pa = x; pb = y; break; } if (pa) break; }
    if (!pa) continue;                                      /* 两盆是同一种花，结不出新的 */
    const A = speciesById(pa), B = speciesById(pb); if (!A || !B) continue;
    const genes = cross(A.genes, B.genes, R), taken = list.map((s) => s.name).concat(Object.values(SPECIES).map((s) => s.zh));
    const sp = { id: 'h' + today.toString(36) + Math.floor(R() * 1296).toString(36).padStart(2, '0'), name: autoName(A.zh || A.name, B.zh || B.name, taken), auto: true, genes, parents: [pa, pb], born: today, gen: 1 + Math.max(A.gen || 0, B.gen || 0), p: 18 };
    list.push(sp); pairs[key] = { species: sp.id, at: today };
    const sd = { id: 's' + sp.id, species: sp.id, x: (a.x + b.x) / 2 + (R() - .5) * .1, z: (a.z + b.z) / 2 + .32, born: today, from: [a.id, b.id] };
    sprouts.push(sd); out.push({ species: sp, seedling: sd });
  }
  if (out.length) { put('diarytown_species', list); put('diarytown_hybrid_pairs', pairs); put('diarytown_seedlings', sprouts); }
  return out;
}

/* —— 店：新花上架，键就是 species id，种子还走 day.js 的 diarytown_seeds —— */
export const seedItems = () => Object.fromEntries(hybrids().map((s) => [s.id, { zh: s.name, p: s.p || 18, hybrid: true, c: hexOf(s.genes) }]));
