// 日记花园的一天和钱包：店一天只开一次、结一次账、补一次货；日记一天只给一次花和菜；
// 别的都拿花币买。所有「今天做过没有」都在这儿判，按手机本地时间零点换天。
// 存 localStorage：diarytown_daily（每件事最后做的那天）、diarytown_coins、diarytown_seeds（花种子，粒）、
// diarytown_pantry（厨房的菜，份）、diarytown_vase_slots、diarytown_vases_placed
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

/* —— 种子铺的价钱：花种子一包 3 粒，种一丛稀 1 粒、中 2 粒、密 3 粒；菜种子一包够做 2 盘 —— */
export const PACK = 3, CROP_PACK = 2;
export const FLOWER_SEEDS = {
  daisy: { zh: '雏菊', p: 6 }, lav: { zh: '薰衣草', p: 6 }, thyme: { zh: '百里香', p: 6 }, yarrow: { zh: '蓍草', p: 6 }, mari: { zh: '金盏花', p: 6 },
  cosmos: { zh: '波斯菊', p: 9 }, plum: { zh: '蓝雪花', p: 9 }, fox: { zh: '毛地黄', p: 9 }, tulip: { zh: '郁金香', p: 9 },
  rose: { zh: '玫瑰', p: 14 }, peony: { zh: '芍药', p: 14 }, hyd: { zh: '绣球', p: 14 },
};
export const CROP_SEEDS = {
  thoughtleaf: { zh: '杂思菜', p: 8 }, tiderice: { zh: '潮汐稻', p: 8 }, boltbean: { zh: '向光葵', p: 8 },
  heartberry: { zh: '心跳莓', p: 12 }, lanternplant: { zh: '灯笼茄', p: 12 }, twinpeach: { zh: '双生桃', p: 12 }, palettemelon: { zh: '调色瓜', p: 12 },
  bloom: { zh: '心绪花', p: 16 },
};
/* 种子铺里的花：底下这十二种 + 园子里配出来的新花（键是新花 id） */
export const flowerSeeds = () => ({ ...FLOWER_SEEDS, ...Hy.seedItems() });
/* 疏密 → 一丛要几粒 */
export const seedCost = (n) => n <= 6 ? 1 : n <= 11 ? 2 : 3;

/* —— 花种子（粒） —— */
export const seeds = () => get('diarytown_seeds', {});
export const seedCount = (sp) => +seeds()[sp] || 0;
export function useSeeds(sp, n) { const s = seeds(); if ((+s[sp] || 0) < n) return false; s[sp] -= n; put('diarytown_seeds', s); return true; }
export function buyFlowerSeed(sp) { const it = flowerSeeds()[sp]; if (!it || !spend(it.p)) return false; const s = seeds(); s[sp] = (+s[sp] || 0) + PACK; put('diarytown_seeds', s); return true; }

/* —— 厨房的菜（份）：日记心情给的和买种子种出来的放一起 —— */
export const CROP_OF = { happy: 'heartberry', sweet: 'twinpeach', calm: 'tiderice', coax: 'bloom', down: 'lanternplant', messy: 'thoughtleaf', cross: 'boltbean' };
export const pantry = () => get('diarytown_pantry', {});
export function addPantry(k, n) { const p = pantry(); p[k] = (+p[k] || 0) + n; put('diarytown_pantry', p); }
export function usePantry(ks) { const p = pantry(); for (const k of ks) if (p[k] > 0) p[k]--; put('diarytown_pantry', p); }
export function buyCropSeed(k) { const it = CROP_SEEDS[k]; if (!it || !spend(it.p)) return false; addPantry(k, CROP_PACK); return true; }
/* 今天第一篇日记：每个心情的菜各给 2 份。一天只给一次，返回给了没有 */
export function claimDiary(moods) {
  if (!once('diary')) return false;
  for (const k of new Set((moods || []).map((m) => CROP_OF[m]).filter(Boolean))) addPantry(k, 2);
  return true;
}

/* —— 插花摆进园子：起步两个花位，以后扩建到五个（扩建还没做，只存个数）——
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
   一天卖菜七八十花币，墙/底/遮阳篷一样攒一个礼拜左右，爬藤和门口小摊再贵一点。起步的样子（花园里那栋）不要钱 */
export const DECOR_START = { wall: '奶油', base: '墨绿', awning: '粉白', ivy: 0, stall: '不摆' };
export const DECOR_PRICE = {
  wall: { 奶油: 0, 豆沙: 380, 雾蓝: 380, 薄荷: 380, 红砖: 520 },
  base: { 墨绿: 0, 酒红: 320, 藏青: 320, 黑: 360 },
  awning: { 粉白: 0, 黄白: 340, 红白: 340, 绿白: 340 },
  ivy: { '0': 0, '0.5': 700, '1': 980 },   /* 爬藤：不爬 / 爬一半 / 爬满 */
  stall: { 不摆: 0, 糖葫芦: 760, 烤肠: 760, 煎饼果子: 820, 冰粉: 820 },
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
