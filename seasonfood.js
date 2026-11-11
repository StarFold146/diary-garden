/* 应季菜的长相合在一处：秋天三样（autumn.js）、冬天三样（winter.js）。garden / kitchen / shop-in 都从这儿拿，
   接口照 autumn.js：has、plant、whole、piece、pieceName、vessel、VESSEL_NAME。以后春夏照样加一个文件接进 MODS */
import * as AU from './autumn.js';
import * as WI from './winter.js';
const MODS = [AU, WI];
const of = (k) => MODS.find((m) => m.has(k));
export const has = (k) => !!of(k);
export const plant = (k, stage, seed) => of(k).plant(k, stage, seed);
export const whole = (k, seed) => of(k).whole(k, seed);
export const piece = (k, seed) => { const m = of(k); return m ? m.piece(k, seed) : null; };
export const pieceName = (k) => { const m = of(k); return m ? m.pieceName(k) : null; };
export const vessel = (keys, form, seed) => { for (const m of MODS) { const v = m.vessel(keys, form, seed); if (v) return v; } return null; };
export const VESSEL_NAME = Object.assign({}, ...MODS.map((m) => m.VESSEL_NAME));
