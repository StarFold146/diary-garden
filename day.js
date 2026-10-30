// 日记花园的一天和钱包：店一天只开一次、结一次账、补一次货；日记一天只给一次花和菜；
// 别的都拿花币买。所有「今天做过没有」都在这儿判，按手机本地时间零点换天。
// 存 localStorage：diarytown_daily（每件事最后做的那天）、diarytown_coins、diarytown_seeds（花种子，粒）、
// diarytown_pantry（厨房的菜，份）、diarytown_cropseeds（菜种子，粒）、diarytown_field（田里 18 块地）、diarytown_vase_slots、diarytown_vases_placed
import * as Hy from './hybrid.js';   /* 杂交出来的新花也上种子铺 */
const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

/* —— 换天：本地日历日，YYYY-MM-DD —— */
export const dayKey = (t = Date.now()) => { const d = new Date(t), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
export const isToday = (t) => dayKey(t) === dayKey();
/* 今天做过没有：diary 写日记领花和菜、basket 跑酷捡的野花、settle 打烊结算、restock 补货 */
export const done = (what) => get('diarytown_daily', {})[what] === dayKey();
export function mark(what) { const m = get('diarytown_daily', {}); m[what] = dayKey(); put('diarytown_daily', m); }
/* 今天第一次就记下并返回 true，做过了返回 false */
export function once(what) { if (done(what)) return false; mark(what); return true; }

/* —— 花币 —— */
export const coins = () => +get('diarytown_coins', 0) || 0;
export const setCoins = (n) => put('diarytown_coins', Math.max(0, Math.round(n)));
export function spend(n) { const c = coins(); if (c < n) return false; setCoins(c - n); return true; }
/* 换了物价：起步 500。老存档第一次打开时不够 500 的补到 500，只补这一回（diarytown_econ_v2） */
export const START_COINS = 500;
if (!get('diarytown_econ_v2', false)) { if (coins() < START_COINS) setCoins(START_COINS); put('diarytown_econ_v2', 1); }
export const GIFT_130 = 200;
if (!get('diarytown_gift130', false)) { setCoins(coins() + GIFT_130); put('diarytown_gift130', 1); }

/* —— 种子铺的价钱：花种子一包 3 粒，种一丛稀 1 粒、中 2 粒、密 3 粒；菜种子一包 2 粒，田里一粒收 1–3 份 ——
   200 起步一包都买不起。现在卖一盘菜（四五十到七八十）差不多换一包种子，一天做两三盘、打烊能买一到三包 */
export const PACK = 3, CROP_PACK = 2;
export const FLOWER_SEEDS = {
  daisy: { zh: '雏菊', p: 35 }, lav: { zh: '薰衣草', p: 35 }, thyme: { zh: '百里香', p: 35 }, yarrow: { zh: '蓍草', p: 35 }, mari: { zh: '金盏花', p: 35 },
  cosmos: { zh: '波斯菊', p: 50 }, plum: { zh: '蓝雪花', p: 50 }, fox: { zh: '毛地黄', p: 50 }, tulip: { zh: '郁金香', p: 50 },
  rose: { zh: '玫瑰', p: 70 }, peony: { zh: '芍药', p: 70 }, hyd: { zh: '绣球', p: 70 },
};
export const CROP_SEEDS = {
  thoughtleaf: { zh: '杂思菜', p: 30 }, tiderice: { zh: '潮汐稻', p: 30 }, boltbean: { zh: '向光葵', p: 30 },
  heartberry: { zh: '心跳莓', p: 45 }, lanternplant: { zh: '灯笼茄', p: 45 }, twinpeach: { zh: '双生桃', p: 45 }, palettemelon: { zh: '调色瓜', p: 45 },
  bloom: { zh: '心绪花', p: 60 },
};
/* 种子铺里的花：底下这十二种 + 园子里配出来的新花（键是新花 id）。
   hybrid.js 给新花标的是老价钱 18，这里按新物价换算，比玫瑰再贵一点（最少 85） */
const HY_PRICE = (p) => Math.max(85, Math.round((+p || 18) * 4.7 / 5) * 5);
export const flowerSeeds = () => {
  const hy = Hy.seedItems();
  for (const k in hy) hy[k] = { ...hy[k], p: HY_PRICE(hy[k].p) };
  return { ...FLOWER_SEEDS, ...hy };
};
/* —— 应季：种子铺顶上一栏「应季」，过季就下架。花的季节写在 hybrid.js（SPECIES 的 season 月份，Hy.seasonal 读），
   菜写在下面这张 SEASONAL 表里，一季一格，冬春夏以后往空格里填就行。下架只是不卖了，手上剩的种子和菜照样能种能做 —— */
export const SEASONS = { spring: [3, 4, 5], summer: [6, 7, 8], autumn: [9, 10, 11], winter: [12, 1, 2] };
export const SEASON_ZH = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
const monthOf = (now) => (now instanceof Date ? now : new Date(now || Date.now())).getMonth() + 1;
export const seasonOf = (now) => Object.keys(SEASONS).find((k) => SEASONS[k].includes(monthOf(now)));
export const SEASON_FLOWER_PRICE = 70;
/* 应季菜：zh、p 照 CROP_SEEDS；spec 是记忆小镇新品种那套说明（town/species.js 的 RULES），厨房和店里拿它长样子、切小件、起菜名；
   vessel 借哪样老菜的盛器（南瓜汤用杂思菜那只汤碗，柿子布丁用调色瓜的高脚杯，栗子用潮汐稻的小木板） */
export const SEASONAL = {
  spring: {}, summer: {}, winter: {},
  autumn: {
    pumpkin: { zh: '南瓜', p: 50, vessel: 'thoughtleaf', soup: '#efb262', spec: { id: 'pumpkin', zh: '南瓜', pre: '南瓜', cooked: '南瓜汤', about: '藤上趴着扁扁的橙南瓜，打过霜更甜。', fruit: '#e0954a', leaf: '#7f9a6a', flesh: '#f4c983',
      plant: { habit: 'vine', height: .4 }, fruitShape: { shape: 'ball', size: .05, count: 2, squash: .75 }, piece: { cut: 'wedge' } } },
    chestnut: { zh: '栗子', p: 45, vessel: 'tiderice', spec: { id: 'chestnut', zh: '栗子', pre: '栗香', cooked: '糖炒栗子', about: '小树上挂着带刺的壳，一裂开掉出油亮的栗子。', fruit: '#8a5a3c', leaf: '#7f9f6a', flesh: '#f0d9a4',
      plant: { habit: 'tree', height: .45 }, fruitShape: { shape: 'egg', size: .032, count: 5, squash: .85 }, piece: { cut: 'half' } } },
    persimmon: { zh: '柿子', p: 60, vessel: 'palettemelon', spec: { id: 'persimmon', zh: '柿子', pre: '柿香', cooked: '柿子布丁', about: '叶子掉光了，枝头还挂着一盏盏橙红的小柿子。', fruit: '#e2793e', leaf: '#8a9a5c', flesh: '#f6c58a',
      plant: { habit: 'tree', height: .45 }, fruitShape: { shape: 'ball', size: .036, count: 5, squash: .8 }, piece: { cut: 'dollop' } } },
  },
};
/* 应季菜凑对的隐藏菜（键按字母排好用 + 连） */
export const SEASON_SPECIAL = {
  'chestnut+pumpkin': ['栗子南瓜煲', '南瓜炖得起沙，栗子一咬就酥，一锅都是秋天。'],
  'chestnut+persimmon': ['柿饼栗子糕', '柿子晒成饼，夹一层栗子泥，切开一圈橙一圈黄。'],
  'persimmon+pumpkin': ['南瓜柿子羹', '两样橙色煮一锅，甜得很安静。'],
};
const allSeasonCrops = () => Object.assign({}, ...Object.values(SEASONAL));
/* 这会儿上架的应季花 / 菜：{ id: { zh, p, c?, season } } */
export const seasonFlowerSeeds = (now) => Object.fromEntries(Hy.seasonal(now).map((s) => [s.id, { zh: s.zh || s.name, p: SEASON_FLOWER_PRICE, c: s.c, season: seasonOf(now) }]));
export const seasonCropSeeds = (now) => { const se = seasonOf(now), t = SEASONAL[se] || {}; return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { zh: v.zh, p: v.p, season: se }])); };
/* 所有季节的应季菜说明，不管当不当季（手上剩的照样能做）：给 town/mem.js 的 useSpecies 吃 */
export const seasonSpecs = () => Object.values(allSeasonCrops()).map((v) => ({ spec: v.spec }));
export const seasonVessel = (k) => (allSeasonCrops()[k] || {}).vessel || k;
/* 借来的汤碗里那层汤是杂思菜的青绿，南瓜汤换成橙的（只改这只碗自己的材质，不碰共用的） */
export function tintVessel(v, k, form = 'plain') {
  const c = (allSeasonCrops()[k] || {}).soup; if (!c || form !== 'plain' || v.userData.kind !== 'bowl') return v;
  v.traverse((o) => { if (o.isMesh && !o.userData.catch && o.geometry.type === 'CircleGeometry' && Math.abs(o.position.y - .3) < .001) { o.material = o.material.clone(); o.material.color.set(c); } });
  return v;
}
export const seasonDish = (keys) => { const sp = SEASON_SPECIAL[[...new Set(keys)].sort().join('+')]; return sp ? { name: sp[0], about: sp[1], special: true } : null; };
/* 菜叫什么：老菜看 CROP_SEEDS，应季菜看 SEASONAL */
export const cropZh = (k) => (CROP_SEEDS[k] || allSeasonCrops()[k] || {}).zh || k;

/* 疏密 → 一丛要几粒 */
export const seedCost = (n) => n <= 6 ? 1 : n <= 11 ? 2 : 3;

/* —— 花种子（粒） —— */
export const seeds = () => get('diarytown_seeds', {});
export const seedCount = (sp) => +seeds()[sp] || 0;
export function useSeeds(sp, n) { const s = seeds(); if ((+s[sp] || 0) < n) return false; s[sp] -= n; put('diarytown_seeds', s); return true; }
export function buyFlowerSeed(sp) { const it = flowerSeeds()[sp] || seasonFlowerSeeds()[sp]; if (!it || !spend(it.p)) return false; const s = seeds(); s[sp] = (+s[sp] || 0) + PACK; put('diarytown_seeds', s); return true; }

/* —— 厨房的菜（份）：日记心情给的和田里收的放一起 —— */
export const CROP_OF = { happy: 'heartberry', sweet: 'twinpeach', calm: 'tiderice', coax: 'bloom', down: 'lanternplant', messy: 'thoughtleaf', cross: 'boltbean' };
export const pantry = () => get('diarytown_pantry', {});
export function addPantry(k, n) { const p = pantry(); p[k] = (+p[k] || 0) + n; put('diarytown_pantry', p); }
export function usePantry(ks) { const p = pantry(); for (const k of ks) if (p[k] > 0) p[k]--; put('diarytown_pantry', p); }
/* —— 菜种子：买来的菜种子进口袋 diarytown_cropseeds（粒），
   去田里点空地种一粒，按真时间长几个钟头，熟了点一下收进菜篮子，一粒收 1–3 份。
   日记心情给的菜还是现成的，直接进菜篮子（一天一次照旧），田里只种买来的种子 —— */
export const cropSeeds = () => get('diarytown_cropseeds', {});
export const cropSeedCount = (k) => +cropSeeds()[k] || 0;
export function useCropSeed(k) { const s = cropSeeds(); if (!(s[k] > 0)) return false; s[k]--; put('diarytown_cropseeds', s); return true; }
export function buyCropSeed(k) { const it = CROP_SEEDS[k] || seasonCropSeeds()[k]; if (!it || !spend(it.p)) return false; const s = cropSeeds(); s[k] = (+s[k] || 0) + CROP_PACK; put('diarytown_cropseeds', s); return true; }
/* 长多久（钟头）：便宜的快，贵的慢，应季的再慢一点 */
export const GROW_H = { thoughtleaf: 2, tiderice: 3, boltbean: 3, heartberry: 4, lanternplant: 5, twinpeach: 6, palettemelon: 6, velvetgrape: 5, bloom: 8, chestnut: 9, pumpkin: 10, persimmon: 10 };
export const growMs = (k) => (GROW_H[k] || 4) * 3600e3;
/* 田：18 块地，diarytown_field 存 [{ kind, plantedAt, growMs } | null]；没有这个键时返回 null，让 garden.js 按老田里画着的作物搬过来。
   扩建能给田加一排两排（一排 6 块，最多 30 块）：garden.js 按建好了几排传 n，新加的地接在 18 块后面 */
export const FIELD_N = 18;
export function field(n = FIELD_N) { const f = get('diarytown_field', null); if (!Array.isArray(f)) return null; const out = []; for (let i = 0; i < n; i++) out.push(f[i] && f[i].kind ? f[i] : null); return out; }
export const saveField = (f) => put('diarytown_field', f);
/* 这一块熟没熟：0 刚种 → 1 熟了 */
export const plotProgress = (p, now = Date.now()) => !p ? 0 : !p.growMs ? 1 : Math.max(0, Math.min(1, (now - p.plantedAt) / p.growMs));
/* 今天第一篇日记：每个心情的菜各给 2 份。一天只给一次，返回给了没有 */
export function claimDiary(moods) {
  if (!once('diary')) return false;
  for (const k of new Set((moods || []).map((m) => CROP_OF[m]).filter(Boolean))) addPantry(k, 2);
  return true;
}

/* —— 扩建：付钱那一刻往后的第一个早上六点建好（凌晨三点付的，当天六点就好），garden.js 进门时对一下 —— */
export const MORNING_H = 6;
export function nextMorning(t = Date.now()) { const d = new Date(t); d.setHours(MORNING_H, 0, 0, 0); if (d.getTime() <= t) d.setDate(d.getDate() + 1); return d.getTime(); }

/* —— 插花摆进园子：起步两个花位，扩建到五个——
   花位在 garden.js 坐标里：0–2 在右后木平台花架前沿一排，3–4 在左前小桌边的木平台上；挨着的花位以后能杂交 */
export const VASE_SPOTS = [[2.25, -1.98], [2.68, -1.98], [3.11, -1.98], [-2.3, 2.62], [-1.98, 2.42]];
export function vaseSlots() { let n = +get('diarytown_vase_slots', 0); if (!n) { n = 2; put('diarytown_vase_slots', n); } return Math.min(5, n); }
export const placedVases = () => get('diarytown_vases_placed', []);
/* 摆一盆：找第一个空花位，记下花位号和坐标（以后杂交按坐标算挨不挨着）；满了返回 null */
export function placeVase(v) {
  const list = placedVases(), n = vaseSlots();
  for (let i = 0; i < n; i++) if (!list.some((x) => x.slot === i)) {
    const [x, z] = VASE_SPOTS[i], rec = { ...v, slot: i, x, z, placedAt: Date.now() };
    list.push(rec); put('diarytown_vases_placed', list); return rec;
  }
  return null;
}
export function unplaceVase(id) { put('diarytown_vases_placed', placedVases().filter((x) => x.id !== id)); }

/* —— 店面外观：shop/house.js 的 DECOR 选项按名字标价，买过的随便换 ——
   店面要难换。起一天卖菜一两百花币，跟着菜价一起涨到两倍半：墙/底/遮阳篷还是攒一个礼拜左右，
   爬藤和门口小摊再贵一点。起步的样子（花园里那栋）不要钱 */
export const DECOR_START = { wall: '奶油', base: '墨绿', awning: '粉白', ivy: 0, stall: '不摆' };
export const DECOR_PRICE = {
  wall: { 奶油: 0, 豆沙: 950, 雾蓝: 950, 薄荷: 950, 红砖: 1300 },
  base: { 墨绿: 0, 酒红: 800, 藏青: 800, 黑: 900 },
  awning: { 粉白: 0, 黄白: 850, 红白: 850, 绿白: 850 },
  ivy: { '0': 0, '0.5': 1750, '1': 2450 },   /* 爬藤：不爬 / 爬一半 / 爬满 */
  stall: { 不摆: 0, 糖葫芦: 1900, 烤肠: 1900, 煎饼果子: 2050, 冰粉: 2050 },
};
const decorKey = (part, opt) => part + ':' + opt;
const optKey = (part, opt) => part === 'ivy' ? String(+opt) : String(opt);
const priceOf = (part, opt) => (DECOR_PRICE[part] || {})[optKey(part, opt)];
export const decorOwned = (part, opt) => { opt = optKey(part, opt); return priceOf(part, opt) === 0 || get('diarytown_decor_owned', []).includes(decorKey(part, opt)); };
/* 现在的店面：花园里那栋店读这个（garden.js 的 buildHouse(Day.decor())） */
export const decor = () => ({ ...DECOR_START, ...get('diarytown_decor', {}) });
export function setDecor(part, opt) {
  opt = optKey(part, opt); if (priceOf(part, opt) == null || !decorOwned(part, opt)) return false;
  const d = get('diarytown_decor', {}); d[part] = part === 'ivy' ? +opt : opt; put('diarytown_decor', d); return true;
}
/* 买下就换上；钱不够返回 false */
export function buyDecor(part, opt) {
  opt = optKey(part, opt); const p = priceOf(part, opt); if (p == null) return false;
  if (decorOwned(part, opt)) return setDecor(part, opt);
  if (!spend(p)) return false;
  const o = get('diarytown_decor_owned', []); o.push(decorKey(part, opt)); put('diarytown_decor_owned', o);
  return setDecor(part, opt);
}
