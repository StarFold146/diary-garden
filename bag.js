// 背包：花园、店里、厨房、插花台顶上一只小包，点开看手上有什么。只读不写，数都从 localStorage 现读：
// 花币、花种子 diarytown_seeds、菜种子 diarytown_cropseeds、菜篮子 diarytown_pantry、后厨的菜 diarytown_dishes、柜子 diarytown_case、
// 新花 diarytown_species、园子里的苗 diarytown_seedlings、店面 diarytown_decor_owned、扩建 diarytown_expand、插花库 diarytown-vase（只读）。
// 页面里放一个 <button id="bagBtn">，没有就自己往顶栏里塞一个（插花台）。点格子给一句提示和一个去处。
import * as Day from './day.js';
import * as Hy from './hybrid.js';

const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const PAGE = /shop\.html$/.test(location.pathname) ? 'shop' : /kitchen\.html$/.test(location.pathname) ? 'kitchen' : /ikebana\.html$/.test(location.pathname) ? 'ikebana' : 'garden';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* —— 颜色：花照园子种花面板那张表（garden.js PLANT_SP），菜照记忆小镇作物的果色（town/mem.js SPECIES） —— */
const FLOWER_C = { lav: ['#9a86c4', '#b4a2d8'], fox: ['#e58fb5', '#f2b6cd'], plum: ['#8fb4ea', '#b6cdf2'], daisy: ['#fbfaf4', '#f2c14e'], cosmos: ['#ff8fb0', '#f6c7d3'],
  mari: ['#ffb72e', '#ffcf4a'], rose: ['#ee3340', '#ff7aa8'], peony: ['#f6b8c8', '#ff7aa8'], tulip: ['#ee3340', '#ffc21a'], hyd: ['#9fb8e0', '#c9b6e8'], yarrow: ['#fbfaf4', '#f6c7d3'], thyme: ['#c9b6e8', '#f6a8c4'] };
const CROP_C = { heartberry: '#d8343c', thoughtleaf: '#b9cf8f', boltbean: '#ecbd3c', palettemelon: '#e8c45a', tiderice: '#7fb0d0', velvetgrape: '#9a6ac8', lanternplant: '#f0a050', twinpeach: '#f2a8a0', bloom: '#e98aa4' };
const CROP_ZH_MORE = { velvetgrape: '绒绒果' };
const seasonCrop = (k) => { for (const t of Object.values(Day.SEASONAL)) if (t[k]) return t[k]; return null; };
const cropC = (k) => CROP_C[k] || (seasonCrop(k) && seasonCrop(k).spec.fruit) || '#c9b38a';
const cropName = (k) => CROP_ZH_MORE[k] || Day.cropZh(k);
function flowerInfo(k) {
  const it = Day.flowerSeeds()[k] || Day.seasonFlowerSeeds()[k], sp = Hy.speciesById(k);
  const name = (it && it.zh) || (sp && (sp.zh || sp.name)) || k;
  let c = FLOWER_C[k] || (sp && sp.grad && [sp.grad[0], sp.grad[1]]);
  if (!c) { const one = (it && it.c) || (sp && (sp.c || (sp.genes && Hy.hexOf(sp.genes)))) || '#e98aa4'; c = [one, one]; }
  return { name, c };
}
const DECOR_ZH = { wall: '墙', base: '底', awning: '遮阳篷', ivy: '爬藤', stall: '小摊' };
const DECOR_C = { wall: { 豆沙: '#e8c3b9', 雾蓝: '#c8d2d4', 薄荷: '#d3e0cc', 红砖: '#c4846a' }, base: { 酒红: '#8e3434', 藏青: '#344868', 黑: '#33302e' }, awning: { 黄白: '#efcb68', 红白: '#c94a42', 绿白: '#6f9a72' } };
const IVY_ZH = { '0.5': '爬一半', '1': '爬满' };
const EXP_ZH = { vase3: '花瓶位', vase4: '花瓶位', vase5: '花瓶位', field1: '田加一排', field2: '田再加一排', sink: '洗手台', basin: '小水池', pergola: '花架', swing: '秋千墙' };

/* —— 小图：一律细线小 SVG，不用表情 —— */
const LINE = 'rgba(90,60,50,.38)';
const icon = {
  flower: (c) => `<svg viewBox="0 0 32 32"><rect x="5" y="4" width="22" height="25" rx="3.5" fill="#f4e8d2" stroke="${LINE}" stroke-width=".8"/><path d="M5 9.5h22" stroke="${LINE}" stroke-width=".7" stroke-dasharray="1.6 1.4"/>${[0, 72, 144, 216, 288].map((a) => `<circle cx="${16 + 3.4 * Math.cos(a * Math.PI / 180 - 1.57)}" cy="${19 + 3.4 * Math.sin(a * Math.PI / 180 - 1.57)}" r="2.6" fill="${c[0]}" stroke="${LINE}" stroke-width=".4"/>`).join('')}<circle cx="16" cy="19" r="1.9" fill="${c[1]}"/></svg>`,
  crop: (c) => `<svg viewBox="0 0 32 32"><rect x="5" y="4" width="22" height="25" rx="3.5" fill="#efe6d4" stroke="${LINE}" stroke-width=".8"/><path d="M5 9.5h22" stroke="${LINE}" stroke-width=".7" stroke-dasharray="1.6 1.4"/><ellipse cx="13" cy="19.5" rx="2.2" ry="3.2" transform="rotate(-24 13 19.5)" fill="${c}" stroke="${LINE}" stroke-width=".4"/><ellipse cx="19.5" cy="20.5" rx="2" ry="2.9" transform="rotate(20 19.5 20.5)" fill="${c}" stroke="${LINE}" stroke-width=".4"/><path d="M16 14.5c0-2 1.2-3 3-3.2" stroke="#7f9a6a" stroke-width="1" fill="none" stroke-linecap="round"/></svg>`,
  produce: (c) => `<svg viewBox="0 0 32 32"><circle cx="16" cy="18" r="8.5" fill="${c}" stroke="${LINE}" stroke-width=".7"/><ellipse cx="13" cy="15" rx="2.4" ry="1.4" fill="#fff" opacity=".35"/><path d="M16 9.6c.2-1.8 1-3 2.4-3.6" stroke="#6f8a58" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M17.2 8.2c2.6-1.8 5.2-.8 5.6.2-1.8 1.4-4 1.4-5.6-.2z" fill="#8fae6a"/></svg>`,
  plate: () => `<svg viewBox="0 0 32 32"><ellipse cx="16" cy="18" rx="12" ry="8" fill="#fffdf8" stroke="${LINE}" stroke-width=".8"/><ellipse cx="16" cy="17.4" rx="7.5" ry="4.6" fill="none" stroke="${LINE}" stroke-width=".6"/><circle cx="14" cy="16.5" r="2" fill="#e8a9a0"/><circle cx="17.6" cy="17.4" r="1.6" fill="#b9cf8f"/></svg>`,
  swatch: (c) => `<svg viewBox="0 0 32 32"><path d="M6 15 16 7l10 8v11H6z" fill="${c}" stroke="${LINE}" stroke-width=".8" stroke-linejoin="round"/><rect x="13.5" y="18" width="5" height="8" rx="2.5" fill="#fffdf8" stroke="${LINE}" stroke-width=".6"/></svg>`,
  build: (built) => `<svg viewBox="0 0 32 32"><rect x="6" y="11" width="20" height="14" rx="2" fill="${built ? '#e6efd6' : '#f3e3c0'}" stroke="${LINE}" stroke-width=".8"/><path d="M6 11l10-5 10 5" fill="none" stroke="${LINE}" stroke-width=".8" stroke-linejoin="round"/>${built ? '<path d="M12 18l3 3 5-6" stroke="#6f8a58" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : '<path d="M10 22l12-7M10 15l12 7" stroke="#c9a77a" stroke-width="1.2" stroke-linecap="round"/>'}</svg>`,
  vase: (c) => `<svg viewBox="0 0 32 32"><path d="M12 13c-3 3-3.5 8-.5 12h9c3-4 2.5-9-.5-12z" fill="#e9eef0" stroke="${LINE}" stroke-width=".8"/><path d="M16 13V7M13.5 13l-2-4M18.5 13l2-3.5" stroke="#7f9a6a" stroke-width=".9" stroke-linecap="round"/><circle cx="16" cy="6.5" r="2" fill="${c}"/><circle cx="11.3" cy="8.6" r="1.6" fill="${c}" opacity=".8"/><circle cx="20.7" cy="9.3" r="1.6" fill="${c}" opacity=".8"/></svg>`,
  sprout: () => `<svg viewBox="0 0 32 32"><path d="M8 25h16" stroke="#8a6a4c" stroke-width="1.6" stroke-linecap="round"/><path d="M16 25v-8" stroke="#6f8a58" stroke-width="1.2" stroke-linecap="round"/><path d="M16 18c-1-4-4.5-5-7-4.5 1 3 4 5 7 4.5zM16 17c1-3.6 4-4.6 6.6-4-1 2.8-3.8 4.4-6.6 4z" fill="#8fae6a"/></svg>`,
};
const BAG_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 9V7.2a3.5 3.5 0 0 1 7 0V9"/><path d="M5.2 9.2h13.6l-1 10.1a1.6 1.6 0 0 1-1.6 1.4H7.8a1.6 1.6 0 0 1-1.6-1.4z"/><path d="M9.5 13.2h5" opacity=".55"/></svg>';

/* —— 小图：一次性在无头浏览器里画好的静态 webp，放 icons/items/：
   c-菜.webp 一筐收下来的菜（菜篮子）、s-菜.webp 菜种子纸包、f-花.webp 花种子纸包（压花画法照 postcard-flora.js）、dish.webp 没小图的菜。
   ITEM_IMGS 是画好了的那些；没画的照旧用上面的小 SVG。园子里配出来的新花没法事先画，背包打开时画一张静态的，存在内存里 —— */
const IMG_DIR = new URL('./icons/items/', import.meta.url).href;
const ITEM_IMGS = new Set(['c-bloom', 'c-boltbean', 'c-chestnut', 'c-heartberry', 'c-lanternplant', 'c-velvetgrape', 'c-palettemelon', 'c-persimmon', 'c-pumpkin', 'c-thoughtleaf', 'c-tiderice', 'c-twinpeach', 'dish', 'f-anemone', 'f-blue2', 'f-blue3', 'f-calm', 'f-calm2', 'f-calm3', 'f-coax', 'f-coax2', 'f-coax3', 'f-cosmos', 'f-cross', 'f-cross2', 'f-cross3', 'f-daisy', 'f-down', 'f-down2', 'f-down3', 'f-fox', 'f-happy', 'f-happy2', 'f-happy3', 'f-hyd', 'f-lanlan', 'f-lav', 'f-mari', 'f-messy', 'f-messy2', 'f-messy3', 'f-peony', 'f-plum', 'f-rose', 'f-sweet', 'f-sweet2', 'f-sweet3', 'f-thyme', 'f-tired2', 'f-tired3', 'f-tulip', 'f-weiwei', 'f-yarrow', 'f-yinghui', 'f-yinglan', 'f-yingyan', 's-bloom', 's-boltbean', 's-chestnut', 's-heartberry', 's-lanternplant', 's-velvetgrape', 's-palettemelon', 's-persimmon', 's-pumpkin', 's-thoughtleaf', 's-tiderice', 's-twinpeach']);
const imgOf = (name) => ITEM_IMGS.has(name) ? IMG_DIR + name + '.webp' : null;
/* 纸包：奶油色纸，顶上一道锯齿封口，底下一条菜/花颜色的腰封，中间贴图。构建小图和新花现画都用这一个 */
export function packet(img, tint, S = 96) {
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), u = S / 96;
  const x0 = 15 * u, x1 = 81 * u, y0 = 8 * u, y1 = 90 * u, r = 6 * u;
  const body = () => { g.beginPath(); g.moveTo(x0 + r, y0); g.lineTo(x1 - r, y0); g.quadraticCurveTo(x1, y0, x1, y0 + r); g.lineTo(x1, y1 - r); g.quadraticCurveTo(x1, y1, x1 - r, y1); g.lineTo(x0 + r, y1); g.quadraticCurveTo(x0, y1, x0, y1 - r); g.lineTo(x0, y0 + r); g.quadraticCurveTo(x0, y0, x0 + r, y0); g.closePath(); };
  g.save(); g.shadowColor = 'rgba(96,74,56,.22)'; g.shadowBlur = 4 * u; g.shadowOffsetY = 1.5 * u; body(); g.fillStyle = '#f6ecd9'; g.fill(); g.restore();
  g.save(); body(); g.clip();
  g.globalAlpha = .38; g.fillStyle = tint; g.fillRect(x0, y1 - 17 * u, x1 - x0, 17 * u); g.globalAlpha = 1;
  g.fillStyle = '#ead9bb'; g.fillRect(x0, y0, x1 - x0, 12 * u);
  g.restore();
  g.strokeStyle = 'rgba(90,60,50,.35)'; g.lineWidth = .9 * u; body(); g.stroke();
  g.beginPath(); for (let i = 0; i <= 11; i++) g.lineTo(x0 + (x1 - x0) * i / 11, y0 + (i % 2 ? 13.5 : 11) * u); g.strokeStyle = 'rgba(90,60,50,.28)'; g.stroke();
  if (img) { const w = 58 * u; g.drawImage(img, (S - w) / 2, 22 * u, w, w); }
  return cv;
}
const HY_CACHE = new Map();
async function hybridPic(h) {
  if (HY_CACHE.has(h.id)) return HY_CACHE.get(h.id);
  const p = (async () => {
    const PF = await import('./postcard-flora.js');
    const url = PF.shoot('hero', [{ species: h.id, genes: h.genes }], 160, 160, null, 3);
    const im = new Image(); im.src = url; await im.decode();
    return packet(im, Hy.hexOf(h.genes)).toDataURL('image/png');
  })().catch(() => null);
  HY_CACHE.set(h.id, p); return p;
}

/* —— 样式：照店里种子铺那张奶油色单子 —— */
const CSS = `
#bagBtn{pointer-events:auto;flex-shrink:0;width:32px;height:32px;padding:0!important;border-radius:16px;background:var(--card,rgba(255,252,246,.92));color:var(--ink,#5b4a44);display:inline-grid;place-items:center;box-shadow:0 4px 14px -8px rgba(80,50,40,.35),0 0 0 .5px rgba(90,60,50,.12);border:0;cursor:pointer}
#bagBtn svg{display:block}
#bagBtn.kit{position:fixed;right:14px;top:calc(env(safe-area-inset-top) + 52px);z-index:30}
#bagVeil{position:fixed;inset:0;z-index:44;background:rgba(60,40,30,.08)}
#bagVeil[hidden],#bag[hidden]{display:none}
#bag{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 16px);transform:translateX(-50%) rotate(-.6deg);z-index:45;width:calc(100% - 32px);max-width:380px;max-height:calc(100% - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 84px);display:flex;flex-direction:column;background:rgba(255,252,246,.96);border-radius:18px;padding:16px 16px 12px;color:#5b4a44;font:13px/1.7 "MaoKenTangYuan (beta)",-apple-system,"PingFang SC",sans-serif;box-shadow:0 14px 40px -16px rgba(80,50,40,.45),0 0 0 .5px rgba(90,60,50,.15);-webkit-user-select:none;user-select:none}
#bag button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}
#bag .bx{position:absolute;right:12px;top:8px;font-size:18px;color:#a8968c}
#bag h3{font-size:15px;font-weight:400;letter-spacing:.12em;margin:0 0 2px}
#bag .bmeta{font-size:11px;color:#a8968c;letter-spacing:.08em}
#bag .bmeta b{font-weight:400;color:#9f3726}
#bag .btabs{display:flex;gap:5px;margin:10px -2px 4px;overflow-x:auto;padding:2px;scrollbar-width:none}
#bag .btabs::-webkit-scrollbar{display:none}
#bag .btabs button{flex:0 0 auto;padding:3px 9px;border-radius:14px;background:#fff;font-size:12px;box-shadow:0 0 0 .5px rgba(90,60,50,.22);white-space:nowrap}
#bag .btabs button small{font-size:10px;color:#a8968c;margin-left:3px}
#bag .btabs button.on{background:#9f3726;color:#fbf7ef}
#bag .btabs button.on small{color:#f3e2d8}
#bag .bbody{overflow-y:auto;min-height:120px;margin:0 -4px;padding:0 4px}
#bag .bsh{font-size:11px;color:#a8968c;letter-spacing:.2em;margin:8px 0 2px}
#bag .bgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:4px 0 6px}
#bag .bt{position:relative;display:flex;flex-direction:column;align-items:center;gap:1px;padding:7px 2px 5px;border-radius:12px;background:#fff;box-shadow:0 0 0 .5px rgba(90,60,50,.18);min-width:0}
#bag .bt.on{box-shadow:0 0 0 1.5px #9f3726}
#bag .bt svg,#bag .bt img{width:44px;height:44px;display:block}
#bag .bt img{border-radius:8px;object-fit:cover}
#bag .bt span{max-width:100%;font-size:11.5px;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 2px}
#bag .bt em{position:absolute;right:5px;top:3px;font-style:normal;font-size:10.5px;line-height:1.3;color:#9f3726}
#bag .bt small{font-size:10px;line-height:1.3;color:#a8968c;white-space:nowrap}
#bag .bempty{font-size:12px;color:#a8968c;letter-spacing:.06em;padding:18px 0 14px;text-align:center}
#bag .bfoot{display:flex;align-items:center;gap:8px;border-top:.5px dashed rgba(90,60,50,.25);margin-top:4px;padding-top:8px;min-height:38px;font-size:12.5px}
#bag .bfoot[hidden]{display:none}
#bag .bfoot p{flex:1;margin:0;line-height:1.5}
#bag .bred{display:flex;gap:6px;align-items:center;border-top:.5px dashed rgba(90,60,50,.25);margin-top:6px;padding-top:8px}
#bag .bred span{font-size:11px;color:#a8968c;letter-spacing:.2em;white-space:nowrap}
#bag .bred input{flex:1;min-width:0;border:0;border-radius:14px;padding:4px 10px;background:#fff;box-shadow:inset 0 0 0 .5px rgba(90,60,50,.3);font:inherit;font-size:12.5px;color:#5b4a44;outline:none;-webkit-user-select:text;user-select:text}
#bag .bred input::placeholder{color:#c4b5aa}
#bag .bred button{flex:0 0 auto;padding:4px 14px;border-radius:14px;background:#5b4a44;color:#f6efe3;font-size:12px;letter-spacing:.15em}
#bag .bred.shake{animation:bagNope .35s}
@keyframes bagNope{0%,100%{translate:0}25%{translate:-5px}75%{translate:5px}}
#bag .bmsg{font-size:11.5px;color:#9f3726;min-height:0;text-align:right;padding-top:2px}
#bag .bmsg:empty{display:none}
#bag .bgift{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border-radius:18px;background:rgba(255,252,246,.98);text-align:center;padding:18px}
#bag .bgift[hidden]{display:none}
#bag .bgift svg{width:96px;height:96px}
#bag .bgift b{font-weight:400;font-size:16px;letter-spacing:.1em}
#bag .bgift p{margin:0;font-size:12px;color:#a8968c;letter-spacing:.08em}
#bag .bgift .brow{display:flex;gap:10px;margin-top:8px}
#bag .bgift .brow a,#bag .bgift .brow button{padding:5px 18px;border-radius:16px;font-size:12.5px;letter-spacing:.15em;text-decoration:none;color:#5b4a44;box-shadow:inset 0 0 0 .5px rgba(90,60,50,.4)}
#bag .bgift .brow .main{background:#9f3726;color:#fbf7ef;box-shadow:none}
#bag .bfoot a,#bag .bfoot button.bgo{flex:0 0 auto;padding:4px 14px;border-radius:14px;background:#5b4a44;color:#f6efe3;font-size:12px;letter-spacing:.15em;text-decoration:none;white-space:nowrap}
`;

let sheet = null, veil = null, tab = 'flower', pick = null, extra = { lv: null, days: 0, vases: null };

/* —— 读：每个分组一张 [{ key, name, n, icon, note? }] —— */
function readAll() {
  const out = {};
  const s = Day.seeds();
  out.flower = Object.keys(s).filter((k) => +s[k] > 0).map((k) => { const f = flowerInfo(k); return { key: k, name: f.name, n: +s[k], unit: '粒', img: imgOf('f-' + k), hy: !imgOf('f-' + k) && Hy.hybrids().find((h) => h.id === k), svg: icon.flower(f.c) }; });
  const cs = Day.cropSeeds();
  out.cropseed = Object.keys(cs).filter((k) => +cs[k] > 0).map((k) => ({ key: k, name: cropName(k), n: +cs[k], unit: '粒', img: imgOf('s-' + k), svg: icon.crop(cropC(k)) }));
  const p = Day.pantry();
  out.pantry = Object.keys(p).filter((k) => +p[k] > 0).map((k) => ({ key: k, name: cropName(k), n: +p[k], unit: '份', img: imgOf('c-' + k), svg: icon.produce(cropC(k)) }));
  const group = (list, where) => { const m = new Map(); for (const d of list) { if (!d || !d.name) continue; const g = m.get(d.name) || { key: where + ':' + d.name, name: d.name, n: 0, unit: '盘', where, thumb: null }; g.n++; if (!g.thumb && d.thumb) g.thumb = d.thumb; m.set(d.name, g); } return [...m.values()]; };
  const dishes = get('diarytown_dishes', []);
  out.dishes = group(Array.isArray(dishes) ? dishes : [], 'back');
  const cs2 = get('diarytown_case', []);
  out.cased = group((Array.isArray(cs2) ? cs2 : []).filter(Boolean).map((d) => ({ name: d.name, thumb: d.plate && d.plate.thumb })), 'case');
  const own = get('diarytown_decor_owned', []);
  out.decor = (Array.isArray(own) ? own : []).map((x) => { const [part, opt] = String(x).split(':'); const c = (DECOR_C[part] || {})[opt] || (part === 'ivy' ? '#8fae6a' : '#e6d6b8'); return { key: 'decor:' + x, name: (DECOR_ZH[part] || part) + ' · ' + (part === 'ivy' ? IVY_ZH[opt] || opt : opt), n: 0, svg: icon.swatch(c) }; });
  const ex = get('diarytown_expand', {}), now = Date.now();
  out.expand = Object.keys(ex || {}).filter((k) => ex[k] && ex[k].state).map((k) => { const built = ex[k].state === 'built' || (ex[k].doneAt && ex[k].doneAt <= now); return { key: 'exp:' + k, name: EXP_ZH[k] || k, n: 0, sub: built ? '建好了' : '在盖', svg: icon.build(built) }; });
  out.hybrid = Hy.hybrids().map((h) => ({ key: 'hy:' + h.id, name: h.name || '新花', n: 0, sub: '新花', hy: h, svg: icon.flower([Hy.hexOf(h.genes), '#f2d98a']) }));
  const sl = Hy.seedlings();
  if (sl.length) out.hybrid.push({ key: 'sprout', name: '盆边的苗', n: sl.length, unit: '株', svg: icon.sprout() });
  const placed = Day.placedVases().length;
  if (extra.vases != null || placed) out.vases = [{ key: 'vase', name: '插花', n: Math.max(extra.vases || 0, placed), unit: '盆', sub: placed ? '园子里摆了 ' + placed : '', svg: icon.vase('#e98aa4') }];
  else out.vases = [];
  return out;
}

const TABS = [
  ['flower', '花种子', (o) => o.flower],
  ['cropseed', '菜种子', (o) => o.cropseed],
  ['pantry', '菜篮子', (o) => o.pantry],
  ['dishes', '做好的菜', (o) => [...o.dishes, ...o.cased]],
  ['keep', '收藏', (o) => [...o.decor, ...o.expand, ...o.hybrid, ...o.vases]],
];
const EMPTY = {
  flower: '还没有花种子，去店里种子铺看看',
  cropseed: '还没有菜种子，去店里看看',
  pantry: '菜篮子空着，写篇日记或者去田里收一收',
  dishes: '还没做菜，去厨房摆一盘',
  keep: '还没收藏什么，攒攒花币换店面、扩园子',
};

/* —— 点格子：一句提示 + 一个去处 —— */
function actionFor(sec, it) {
  if (sec === 'flower') return PAGE === 'garden' && document.getElementById('plantBtn')
    ? { t: '去园子点种花，挑「' + it.name + '」，点地上种一丛', btn: '去种花', run: () => { close(); const b = document.getElementById('plantBtn'); if (b && !b.classList.contains('on')) b.click(); } }
    : { t: '拿回园子种，稀一粒、中两粒、密三粒', href: './?home&plant=1', btn: '去园子' };
  if (sec === 'cropseed') return { t: PAGE === 'garden' ? '去田里点一块空地种下，熟了点一下收' : '去田里种，一粒能收一到三份', href: './?home&farm', btn: '去田里' };
  if (sec === 'pantry') return PAGE === 'kitchen' ? { t: '就在厨房，点下面的菜摆盘，或者翻菜谱出盘' } : { t: '拿去厨房做菜，一盘里每样用一份', href: './kitchen.html', btn: '去厨房' };
  if (sec === 'dishes') {
    if (it.where === 'case') return { t: '已经摆在柜子里了，打烊的时候卖' };
    return PAGE === 'shop' ? { t: '放在后厨，补货摆进柜子才有人买', btn: '补货', run: () => { close(); const b = document.getElementById('restock'); if (b && !b.disabled) b.click(); } } : { t: '放在后厨，回店里补货摆进柜子', href: './shop.html#bag-restock', btn: '去补货' };
  }
  if (it.key.startsWith('decor:')) return PAGE === 'shop' ? { t: '买过的店面随便换', btn: '换店面', run: () => { close(); const b = document.getElementById('decorBtn'); if (b) b.click(); } } : { t: '买过的店面随便换，在店里点「店面」', href: './shop.html', btn: '去店里' };
  if (it.key.startsWith('exp:')) return { t: it.sub === '建好了' ? '已经盖在园子里了' : '在盖着，下一个早上六点建好' };
  if (it.key === 'vase') return PAGE === 'ikebana' ? { t: '插好的花点「摆到园子」放进花位' } : { t: '去插花台再插一盆', href: './ikebana.html', btn: '去插花' };
  if (it.key === 'sprout') return { t: '两盆挨着过一夜冒出来的，去园子里看看' };
  if (it.key.startsWith('hy:')) return { t: '园子里配出来的新花，种子铺能买到它的种子' };
  return null;
}

function tile(sec, it) {
  const b = document.createElement('button'); b.className = 'bt' + (pick === it.key ? ' on' : '');
  const dish = imgOf('dish');
  const pic = it.thumb ? `<img src="${esc(it.thumb)}" alt="">` : it.img ? `<img src="${esc(it.img)}" alt="" loading="lazy">` : it.where ? (dish ? `<img src="${dish}" alt="" loading="lazy">` : icon.plate()) : it.svg;
  b.innerHTML = pic + `<span>${esc(it.name)}</span>` + (it.n && it.sub ? `<em>${it.n}</em>` : '') + (it.sub ? `<small>${esc(it.sub)}</small>` : it.unit && it.n ? `<small>${it.n} ${it.unit}</small>` : '');
  if (it.hy) hybridPic(it.hy).then((u) => { const s = u && b.querySelector('svg'); if (s) { const im = new Image(); im.src = u; im.alt = ''; s.replaceWith(im); } });
  b.onclick = () => { pick = pick === it.key ? null : it.key; render(); if (pick) foot(actionFor(sec, it)); };
  return b;
}
function foot(a) {
  const f = sheet.querySelector('.bfoot');
  if (!a) { f.hidden = true; return; }
  f.hidden = false; f.replaceChildren();
  const p = document.createElement('p'); p.textContent = a.t; f.appendChild(p);
  if (a.href && a.btn) { const l = document.createElement('a'); l.href = a.href; l.textContent = a.btn; f.appendChild(l); }
  else if (a.run && a.btn) { const b = document.createElement('button'); b.className = 'bgo'; b.textContent = a.btn; b.onclick = a.run; f.appendChild(b); }
}
function grid(sec, list) { const g = document.createElement('div'); g.className = 'bgrid'; for (const it of list) g.appendChild(tile(sec, it)); return g; }
function sh(t) { const d = document.createElement('div'); d.className = 'bsh'; d.textContent = t; return d; }

function render() {
  const o = readAll();
  sheet.querySelector('.bmeta').innerHTML = `花币 <b>${Day.coins()}</b>` + (extra.lv != null ? ` · 花园 ${extra.lv} 级 · 写了 ${extra.days} 天` : '');
  const tabs = sheet.querySelector('.btabs'); tabs.replaceChildren();
  for (const [id, zh, fn] of TABS) {
    const n = fn(o).length, b = document.createElement('button'); b.className = id === tab ? 'on' : '';
    b.innerHTML = esc(zh) + (n ? `<small>${n}</small>` : '');
    b.onclick = () => { tab = id; pick = null; foot(null); render(); };
    tabs.appendChild(b);
  }
  const body = sheet.querySelector('.bbody'); body.replaceChildren();
  const list = TABS.find((t) => t[0] === tab)[2](o);
  if (!list.length) { const e = document.createElement('div'); e.className = 'bempty'; e.textContent = EMPTY[tab]; body.appendChild(e); return; }
  if (tab === 'dishes') {
    if (o.dishes.length) { body.appendChild(sh('后厨做好的')); body.appendChild(grid('dishes', o.dishes)); }
    if (o.cased.length) { body.appendChild(sh('柜子里摆着的')); body.appendChild(grid('dishes', o.cased)); }
  } else if (tab === 'keep') {
    const parts = [['店面', o.decor], ['扩建', o.expand], ['新花和苗', o.hybrid], ['插花', o.vases]];
    for (const [t, l] of parts) if (l.length) { body.appendChild(sh(t)); body.appendChild(grid('keep', l)); }
  } else body.appendChild(grid(tab, list));
}

/* —— 只读两个库：没有就别建（onupgradeneeded 时放弃） —— */
function readStore(name, store) {
  return new Promise((ok) => {
    let r; try { r = indexedDB.open(name); } catch (e) { ok(null); return; }
    r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) {} };
    r.onerror = () => ok(null); r.onblocked = () => ok(null);
    r.onsuccess = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains(store)) { d.close(); ok(null); return; }
      try { const q = d.transaction(store).objectStore(store).getAll(); q.onsuccess = () => { d.close(); ok(q.result || []); }; q.onerror = () => { d.close(); ok(null); }; } catch (e) { d.close(); ok(null); }
    };
  });
}
async function readExtra() {
  const fl = await readStore('diarytown', 'flowers');
  if (fl) { extra.days = new Set(fl.filter((f) => !f.wild && !f.hybrid && f.mood && f.at).map((f) => Day.dayKey(f.at))).size; extra.lv = Math.floor(extra.days / 7); }
  const vs = await readStore('diarytown-vase', 'vases');
  if (vs) extra.vases = vs.length;
  if (sheet && !sheet.hidden) render();
}

function build() {
  veil = document.createElement('div'); veil.id = 'bagVeil'; veil.hidden = true; veil.onclick = close;
  sheet = document.createElement('div'); sheet.id = 'bag'; sheet.hidden = true;
  sheet.innerHTML = '<button class="bx" aria-label="关上">×</button><h3>背 包</h3><div class="bmeta"></div><div class="btabs"></div><div class="bbody"></div><div class="bfoot" hidden></div><div class="bred"><span>兑 换</span><input type="text" placeholder="输一句口令" autocomplete="off" enterkeyhint="done"><button type="button">兑换</button></div><div class="bmsg"></div><div class="bgift" hidden></div>';
  sheet.querySelector('.bx').onclick = close;
  const inp = sheet.querySelector('.bred input');
  sheet.querySelector('.bred button').onclick = () => redeem(inp.value);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') redeem(inp.value); });
  document.body.append(veil, sheet);
}
/* —— 兑换：口令换礼物花种子，每兑一次给十粒，不限次数，diarytown_redeemed 只记最后一次兑的时间。代码里只放口令的 SHA-256（去空白和标点、NFC 以后），
   花名和颜色都从 hybrid.js 的 SPECIES 现读 —— */
const GIFT_SEEDS = 10;
const CODES = { b4a693fc94ee3ced16edfbe1e1bf3d0cc60240fb8468cba655899231d31aa215: 'weiwei', fda2a481a59a17ea479479667d817547a282f53ee7d943e053c8abf12e7f0937: 'lanlan', '27471e5a5770e4c3cd919fda1fd3c4d6596154f8559ec7f65456195a8d61d3a9': 'yingyan' };
const norm = (t) => String(t || '').normalize('NFC').replace(/[\s\p{P}]/gu, '');
async function sha(t) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
function say(t, bad) {
  const m = sheet.querySelector('.bmsg'), r = sheet.querySelector('.bred'); m.textContent = t;
  if (bad) { r.classList.remove('shake'); void r.offsetWidth; r.classList.add('shake'); }
  clearTimeout(say.t); say.t = setTimeout(() => { m.textContent = ''; }, 2600);
}
async function redeem(raw) {
  const t = norm(raw); if (!t) return;
  let h; try { h = await sha(t); } catch (e) { say('这里兑换不了，换个浏览器试试', true); return; }
  const id = CODES[h], sp = id && Hy.SPECIES[id];
  if (!sp) { say('口令不对哦', true); return; }
  const used = get('diarytown_redeemed', {});
  used[h] = Date.now();
  const s = Day.seeds(); s[id] = (+s[id] || 0) + GIFT_SEEDS;
  try { localStorage.setItem('diarytown_seeds', JSON.stringify(s)); localStorage.setItem('diarytown_redeemed', JSON.stringify(used)); } catch (e) {}
  sheet.querySelector('.bred input').value = ''; tab = 'flower'; pick = null; foot(null); render();
  gift(sp);
}
function gift(sp) {
  const g = sheet.querySelector('.bgift'), c = sp.grad || [sp.c, sp.c], name = sp.zh || sp.name;
  const petals = [0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="48" cy="30" rx="11" ry="19" fill="url(#bgG)" stroke="rgba(90,60,50,.25)" stroke-width=".6" transform="rotate(${a} 48 48)"/>`).join('');
  g.innerHTML = `<svg viewBox="0 0 96 96"><defs><radialGradient id="bgG" cx="50%" cy="85%" r="80%"><stop offset="0" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[0]}"/></radialGradient></defs>${petals}<circle cx="48" cy="48" r="8" fill="#f2d98a" stroke="rgba(90,60,50,.25)" stroke-width=".6"/></svg>`
    + `<b>得到 ${GIFT_SEEDS} 粒${esc(name)}种子</b><p>去园子点种花</p><div class="brow"><button type="button" class="bok">收 好</button></div>`;
  const row = g.querySelector('.brow');
  if (PAGE === 'garden' && document.getElementById('plantBtn')) { const b = document.createElement('button'); b.type = 'button'; b.className = 'main'; b.textContent = '去 种 花'; b.onclick = () => { g.hidden = true; close(); const p = document.getElementById('plantBtn'); if (p && !p.classList.contains('on')) p.click(); }; row.appendChild(b); }
  else { const a = document.createElement('a'); a.className = 'main'; a.href = './?home&plant=1'; a.textContent = '去 种 花'; row.appendChild(a); }
  g.querySelector('.bok').onclick = () => { g.hidden = true; };
  g.hidden = false;
}

export function open() { if (!sheet) build(); sheet.querySelector('.bgift').hidden = true; pick = null; foot(null); render(); veil.hidden = false; sheet.hidden = false; readExtra(); }
export function close() { if (!sheet) return; sheet.hidden = true; veil.hidden = true; }
export function toggle() { if (sheet && !sheet.hidden) close(); else open(); }

function mount() {
  if (!document.getElementById('bag-css')) { const st = document.createElement('style'); st.id = 'bag-css'; st.textContent = CSS; document.head.appendChild(st); }
  let b = document.getElementById('bagBtn');
  if (!b) {
    b = document.createElement('button'); b.id = 'bagBtn';
    const top = document.querySelector('.top'), back = top && top.querySelector('a');
    if (top && back) top.insertBefore(b, back);
    else { b.classList.add('kit'); document.body.appendChild(b); }
  }
  b.type = 'button'; b.setAttribute('aria-label', '背包'); b.innerHTML = BAG_SVG;
  b.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  if (PAGE === 'shop' && location.hash === '#bag-restock') {
    history.replaceState(null, '', location.pathname + location.search);
    let tries = 0;
    const t = setInterval(() => { const v = document.getElementById('veil'), r = document.getElementById('restock'); if ((v && v.classList.contains('out') && r) || ++tries > 60) { clearInterval(t); if (r && !r.disabled && tries <= 60) r.click(); } }, 250);
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
