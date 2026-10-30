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
   form 骨架 0–8（见下面 FORMS）；hue 0–35（十度一档）；sat 0–4；lit 0–4；size 0–4 花头大小；height 0–4 枝高 */
export const RANGE = { n: [4, 8], dbl: [0, 1], shape: [0, 4], notch: [0, 3], cup: [0, 3], ruffle: [0, 3], form: [0, 8], hue: [0, 35], sat: [0, 4], lit: [0, 4], size: [0, 4], height: [0, 4] };
/* 骨架：ikebana.js 按 form 挑画法，其余基因在每种骨架上各有各的用处。
   suf 是突变出新骨架时名字后头带的字（铃怦 + 碎雾 → 铃怦雾），老骨架 0/1 不带。 */
export const FORMS = [
  { id: 0, zh: '单朵', suf: '' },           /* 一朵，瓣数瓣形兜褶都照基因 */
  { id: 1, zh: '攒球', suf: '' },           /* 蓝雪花那样一簇小花 */
  { id: 2, zh: '垂铃', suf: '铃' },         /* 铃兰：一根弯茎挂一串小铃铛 */
  { id: 3, zh: '佛焰苞', suf: '盏' },       /* 马蹄莲：一片卷起的苞 + 中间一根肉穗 */
  { id: 4, zh: '包心', suf: '团' },         /* 玫瑰芍药：一圈圈螺旋裹着，外松内紧 */
  { id: 5, zh: '碎雾', suf: '雾' },         /* 满天星：分叉细枝顶一堆极小的点花 */
  { id: 6, zh: '头状', suf: '菊' },         /* 雏菊非洲菊：凸起的花心盘 + 一圈舌状瓣 */
  { id: 7, zh: '风花', suf: '晃' },         /* 秋牡丹：细长茎微低头，几片宽圆瓣，青芯金蕊，风一吹晃 */
  { id: 8, zh: '百合', suf: '合' },         /* 百合：六片窄长尖瓣喇叭/星形张开，尖端外翻，长花丝明显的药，侧枝一个苞 */
];
export const formOf = (g) => FORMS[clamp(Math.round((g && g.form) || 0), 0, 8)];
const fixForm = (g) => { if (g.form === 1 || g.form === 3 || g.form === 5 || g.form === 7 || g.form === 8) g.dbl = 0; if (g.form === 4) g.dbl = 1; return g; };
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
  sweet: base('sweet', '怦心兰', '#e98aa4', { n: 5, shape: 3, notch: 1, cup: 2, ruffle: 2, form: 3, size: 3, height: 3 }),
  calm: base('calm', '澄水莲', '#9ec5e6', { n: 5, shape: 2, notch: 1, cup: 1, ruffle: 0, form: 1, size: 1, height: 2 }),
  coax: base('coax', '软糖花', '#f3b9a0', { n: 6, dbl: 1, shape: 4, notch: 1, cup: 2, ruffle: 3, form: 4, size: 4, height: 2 }),
  down: base('down', '垂雨铃', '#b9a3de', { n: 5, shape: 2, notch: 0, cup: 3, ruffle: 0, form: 2, size: 2, height: 3 }),
  messy: base('messy', '毛线球', '#c9b38a', { n: 8, shape: 2, notch: 2, cup: 0, ruffle: 1, form: 5, size: 2, height: 4 }),
  cross: base('cross', '炸毛菊', '#e36a5a', { n: 4, shape: 4, notch: 0, cup: 2, ruffle: 3, form: 6, size: 3, height: 3 }),
};
/* 「每个心情可以对应的花更多一点，拿到手的随机」。每个心情三种：上面那种常见（六成），下面两种少见（各两成），骨架和颜色都不一样。
   累、难过原来借垂雨铃、澄水莲，常见的照借，少见的各自有。都是底子，都能杂交。 */
const rare = (id, zh, c, g) => ({ ...base(id, zh, c, g), rare: true });
Object.assign(SPECIES, {
  happy2: rare('happy2', '暖阳菊', '#f5c75c', { n: 7, shape: 2, notch: 0, cup: 1, ruffle: 1, form: 6, size: 3, height: 2 }),
  happy3: rare('happy3', '蜜糖铃', '#f0b14f', { n: 5, shape: 2, notch: 0, cup: 2, ruffle: 1, form: 2, size: 2, height: 3 }),
  sweet2: rare('sweet2', '糖心团', '#ee9fb6', { n: 6, dbl: 1, shape: 3, notch: 1, cup: 2, ruffle: 2, form: 4, size: 3, height: 2 }),
  sweet3: rare('sweet3', '甜梦铃', '#ef9ab3', { n: 6, shape: 3, notch: 1, cup: 1, ruffle: 2, form: 2, size: 2, height: 3 }),
  calm2: rare('calm2', '静湖盏', '#a9cfe9', { n: 5, shape: 3, notch: 0, cup: 2, ruffle: 0, form: 3, size: 3, height: 3 }),
  calm3: rare('calm3', '浅波菊', '#b4d4ea', { n: 6, shape: 1, notch: 1, cup: 0, ruffle: 0, form: 6, size: 2, height: 2 }),
  coax2: rare('coax2', '奶糖铃', '#f5c3ad', { n: 5, shape: 4, notch: 1, cup: 2, ruffle: 2, form: 2, size: 2, height: 2 }),
  coax3: rare('coax3', '撒娇球', '#f1b5a3', { n: 5, shape: 3, notch: 1, cup: 1, ruffle: 1, form: 1, size: 2, height: 2 }),
  down2: rare('down2', '雨后莲', '#b3a0d8', { n: 5, shape: 2, notch: 0, cup: 2, ruffle: 0, form: 0, size: 2, height: 2 }),
  down3: rare('down3', '低云雾', '#c3b2e0', { n: 6, shape: 2, notch: 0, cup: 1, ruffle: 0, form: 5, size: 2, height: 3 }),
  messy2: rare('messy2', '乱麻球', '#cdb48e', { n: 6, shape: 2, notch: 2, cup: 0, ruffle: 1, form: 1, size: 2, height: 3 }),
  messy3: rare('messy3', '打结菊', '#c6ad84', { n: 8, shape: 1, notch: 2, cup: 0, ruffle: 2, form: 6, size: 2, height: 3 }),
  cross2: rare('cross2', '火气团', '#e2614f', { n: 5, dbl: 1, shape: 4, notch: 0, cup: 2, ruffle: 3, form: 4, size: 3, height: 2 }),
  cross3: rare('cross3', '冒烟雾', '#e8725f', { n: 6, shape: 3, notch: 0, cup: 1, ruffle: 2, form: 5, size: 2, height: 3 }),
  tired2: rare('tired2', '打盹莲', '#c2ace0', { n: 5, shape: 3, notch: 0, cup: 3, ruffle: 0, form: 0, size: 2, height: 1 }),
  tired3: rare('tired3', '瞌睡球', '#b7a6d6', { n: 5, shape: 2, notch: 0, cup: 1, ruffle: 0, form: 1, size: 1, height: 2 }),
  blue2: rare('blue2', '泪滴铃', '#c9d8ea', { n: 5, shape: 2, notch: 0, cup: 2, ruffle: 0, form: 2, size: 2, height: 3 }),
  blue3: rare('blue3', '雾蓝盏', '#bccfe4', { n: 5, shape: 3, notch: 0, cup: 2, ruffle: 0, form: 3, size: 2, height: 3 }),
});
/* 季节花：不进心情领花，只在种子铺秋天（9–11 月）上架，过季下架；是底子，能杂交，起名规则认它。
   白色写死在 c 里（基因调不出纯白），杂交出来的后代走基因色 */
Object.assign(SPECIES, {
  anemone: { ...base('anemone', '秋晃晃', '#f8f4ec', { n: 6, shape: 4, notch: 0, cup: 1, ruffle: 0, form: 7, size: 2, height: 4 }), rare: true, season: [9, 10, 11] },   /* rare 让园子按 colorsOf 上色（白），不走心情色 */
});
Object.assign(SPECIES, {
  weiwei: { ...base('weiwei', String.fromCharCode(21807, 21807, 33457), '#f6a3c0', { n: 6, dbl: 1, shape: 3, notch: 1, cup: 2, ruffle: 2, form: 4, size: 3, height: 3 }), rare: true, gift: true, grad: ['#ea6b97', '#fde3ec'] },
  lanlan: { ...base('lanlan', String.fromCharCode(23706, 23706, 33457), '#8cc4ec', { n: 6, shape: 0, notch: 0, cup: 1, ruffle: 0, form: 8, size: 2, height: 4 }), rare: true, gift: true, grad: ['#6fb6e8', '#eef7fc'] },
});
export const gifts = () => Object.values(SPECIES).filter((s) => s.gift);
/* 能不能当爸妈：送人的花不参与杂交 */
export const canBreed = (id) => { const s = speciesById(id); return !!s && !s.gift; };
export const gradOf = (f) => { const s = f && f.species && SPECIES[f.species]; return s && s.grad ? s.grad : null; };
const monthOf = (now) => (now instanceof Date ? now : new Date(now || Date.now())).getMonth() + 1;
export const inSeason = (id, now) => { const s = SPECIES[id]; return !!s && (!s.season || s.season.includes(monthOf(now))); };
/* 这会儿当季的季节花（种子铺读这个上架）；now 可传日期或毫秒 */
export const seasonal = (now) => Object.values(SPECIES).filter((s) => s.season && s.season.includes(monthOf(now)));
const ALIAS = { tired: 'down', blue: 'calm' };   /* 累、难过常见的那种借垂雨铃、澄水莲 */
export const MOODS = ['happy', 'sweet', 'calm', 'coax', 'down', 'messy', 'cross', 'tired', 'blue'];
/* 一个心情的三种花：[常见, 少见, 少见]，常见就是旧映射那种，所以没存 species 的老记录照旧 */
export const moodSpecies = (mood) => { const m = MOODS.includes(mood) ? mood : 'sweet'; return [ALIAS[m] || m, m + '2', m + '3'].filter((id) => SPECIES[id]); };
/* 领花时抽一种：六成常见、各两成少见。R 可传带种子的随机数 */
export function pickForMood(mood, R = Math.random) { const [a, b, c] = moodSpecies(mood), u = R(); return u < .6 || !b ? a : u < .8 || !c ? b : c; };
export const baseId = (id) => SPECIES[id] ? id : SPECIES[ALIAS[id]] ? ALIAS[id] : 'sweet';
export const isBase = (id) => !!SPECIES[id];

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
/* 花瓣颜色：多选心情的日记花轮着上色（领到的那种打头，别的心情按常见色补），杂交花只有自己那一个色 */
export function colorsOf(f) {
  if (f && (f.genes || (f.species && !SPECIES[f.species]))) return [hexOf(genesOf(f))];
  const ids = f && f.moods && f.moods.length ? f.moods : [(f && f.mood) || 'sweet'];
  const cs = ids.map((id) => SPECIES[baseId(id)].c);
  if (f && f.species && SPECIES[f.species]) cs[0] = SPECIES[f.species].c;
  return cs;
}

/* —— 基因 → 捏花参数（插花台的 petalGeo / blossom 吃这个）—— */
const WD = [.07, .095, .12, .15, .18], NOTCH = [0, .05, .09, .14], CUP = [0, .5, 1, 1.6], RUF = [0, .5, 1, 1.7], SIZE = [.85, 1, 1.15, 1.3, 1.5], HGT = [.8, .9, 1, 1.1, 1.2];
export function paramsOf(g) {
  const L = .16, shape = clamp(g.shape, 0, 4);
  return {
    n: clamp(g.n, 4, 8), dbl: !!g.dbl, form: formOf(g).id, cluster: g.form === 1,
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
  if (R() < .1) {                                          /* 约一成变异：重瓣 / 色相跳一格 / 换一副骨架 */
    const u = R();
    if (u < .35 && (g.form === 0 || g.form === 6)) { if (g.dbl) g.n = clamp(g.n + 1, 4, 8); g.dbl = 1; g.mut = 'dbl'; }
    else if (u < .7) { g.hue = (g.hue + (R() < .5 ? 1 : -1) * (6 + Math.floor(R() * 7)) + 36) % 36; g.mut = 'hue'; }
    else { const others = FORMS.map((f) => f.id).filter((id) => id !== a.form && id !== b.form); g.form = others[Math.floor(R() * others.length)]; g.mut = 'form'; }
  }
  for (const k of KEYS) g[k] = clamp(Math.round(g[k]), RANGE[k][0], RANGE[k][1]);
  return fixForm(g);
}

/* —— 起名：爸妈名字各取一个字（晴铃花 × 怦心兰 → 铃怦）：前者取末字、后者取首字。
   只去掉结尾那一个后缀字（花兰莲铃球菊草盏团雾晃合），中间的不动：晴铃花→晴铃、垂雨铃→垂雨、毛线球→毛线；两字相同的组合不要。
   突变出爸妈都没有的骨架时，后头带上那骨架的字（铃怦 + 碎雾 → 铃怦雾），一眼看出它换了样子 —— */
const stem = (n) => { const a = [...(n || '花')]; return a.length > 1 && /[花兰莲铃球菊草盏团雾晃合]/.test(a[a.length - 1]) ? a.slice(0, -1) : a; };
export function autoName(na, nb, taken = [], suf = '') {
  const A = stem(na), B = stem(nb);
  const tries = [A[A.length - 1] + B[0], A[0] + B[B.length - 1], B[B.length - 1] + A[0], B[0] + A[A.length - 1]].map((t) => suf && !t.includes(suf) ? t + suf : t);
  for (const t of tries) if (t[0] !== t[1] && !taken.includes(t)) return t;
  let n = 2; while (taken.includes(tries[0] + n)) n++;
  return tries[0] + n;
}

/* —— 两盆挨着过一夜 → 新花 + 一株苗 ——
   placed 是 day.js 的 diarytown_vases_placed（{id, x, z, placedAt, species?, colors?}），挨着 = 相距不到半格；
   两盆都是昨天以前摆的、而且这对没结过，才结。同一对只结一次。 */
export const ADJ = .5;
export const adjacent = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) <= ADJ;
const moodOfColor = (hex) => { const [h] = hexToHsl(hex); let best = 'sweet', bd = 1e9; for (const s of Object.values(SPECIES)) { if (s.rare || s.season) continue; const d = Math.min(Math.abs(s.genes.hue * 10 - h), 360 - Math.abs(s.genes.hue * 10 - h)); if (d < bd) { bd = d; best = s.id; } } return best; };
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
    const sa = vaseSpecies(a).filter(canBreed), sb = vaseSpecies(b).filter(canBreed); 
    let pa = null, pb = null;
    for (const x of sa) { for (const y of sb) if (x !== y) { pa = x; pb = y; break; } if (pa) break; }
    if (!pa) continue;                                      /* 两盆是同一种花，结不出新的 */
    const A = speciesById(pa), B = speciesById(pb); if (!A || !B) continue;
    const genes = cross(A.genes, B.genes, R), taken = list.map((s) => s.name).concat(Object.values(SPECIES).map((s) => s.zh));
    const sp = { id: 'h' + today.toString(36) + Math.floor(R() * 1296).toString(36).padStart(2, '0'), name: autoName(A.zh || A.name, B.zh || B.name, taken, genes.mut === 'form' ? formOf(genes).suf : ''), auto: true, genes, parents: [pa, pb], born: today, gen: 1 + Math.max(A.gen || 0, B.gen || 0), p: 18 };
    list.push(sp); pairs[key] = { species: sp.id, at: today };
    const sd = { id: 's' + sp.id, species: sp.id, x: (a.x + b.x) / 2 + (R() - .5) * .1, z: (a.z + b.z) / 2 + .32, born: today, from: [a.id, b.id] };
    sprouts.push(sd); out.push({ species: sp, seedling: sd });
  }
  if (out.length) { put('diarytown_species', list); put('diarytown_hybrid_pairs', pairs); put('diarytown_seedlings', sprouts); }
  return out;
}

/* —— 店：新花上架，键就是 species id，种子还走 day.js 的 diarytown_seeds —— */
export const seedItems = () => Object.fromEntries(hybrids().map((s) => [s.id, { zh: s.name, p: s.p || 18, hybrid: true, c: hexOf(s.genes) }]));
