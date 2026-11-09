/* 花谱的库：插花台存进 diarytown-vase 的每一盆，插花台的花谱和园子里长按都从这儿读、从这儿卖。
   库版本 1 定死，跟 ikebana.js / main.js 打包那边一样，以后别升。
   卖价跟店里一盘菜差不多（一样菜 44、两样 56）：底价 12，每枝花 10，稀有的和园子里配出来的 16；
   有送的花不卖；样例花插的那盆不值钱，只能扔。
   1.3.5 堵刷钱：配叶不值钱；一朵花只能卖一回（卖过的记在 localStorage diarytown_sold，换一盆再插也不算钱）；
   插花台「园子里配出来的」那排点了就有、不限量，同一种一天只算一回钱；一盆里没有值钱的花，底价也不给 */
import * as Day from './day.js';
import * as Hy from './hybrid.js';

export function vaseDb() {
  return new Promise((ok, no) => {
    const r = indexedDB.open('diarytown-vase', 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('vases')) r.result.createObjectStore('vases', { keyPath: 'id' }); };
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
}
export async function vaseAll() {
  try {
    const d = await vaseDb(), l = await new Promise((ok) => { const q = d.transaction('vases').objectStore('vases').getAll(); q.onsuccess = () => ok(q.result || []); q.onerror = () => ok([]); });
    d.close(); return l.filter((r) => r && r.stems && r.stems.length).sort((a, b) => b.at - a.at);
  } catch (e) { return []; }
}
export async function vaseGet(id) { return (await vaseAll()).find((r) => r.id === id) || null; }
export async function vaseDelete(id) {
  try {
    const d = await vaseDb();
    await new Promise((ok, no) => { const t = d.transaction('vases', 'readwrite'); t.objectStore('vases').delete(id); t.oncomplete = ok; t.onerror = () => no(t.error); });
    d.close(); return true;
  } catch (e) { return false; }
}

export const isSampleStem = (s) => !s.filler && /^s\d+$/.test(s.fid || '');
const spOf = (s) => s.species || Hy.speciesIdOf({ moods: s.moods || [] });
/* 插花台「园子里配出来的」那排插的：id 是 h种:时间，不是园子里真长的那朵 */
const isFreeHybrid = (s) => /^h.+:\d+$/.test(s.fid || '');
const SOLD_KEY = 'diarytown_sold';
function soldBook() {
  try { const b = JSON.parse(localStorage.getItem(SOLD_KEY) || '{}'); return { fids: Array.isArray(b.fids) ? b.fids : [], h: b.h && typeof b.h === 'object' ? b.h : {} }; }
  catch (e) { return { fids: [], h: {} }; }
}
/* 这盆里哪些枝能算钱：真花没卖过、同一朵只算一枝；配出来的那排同一种只算一枝，今天卖过就不算 */
function earning(st, book = soldBook()) {
  const sold = new Set(book.fids), today = Day.dayKey(), seen = new Set(), out = [];
  for (const s of st) {
    if (s.filler || isSampleStem(s)) continue;
    const id = spOf(s), base = Hy.SPECIES[id], v = !base || base.rare ? 16 : 10;   /* 不在基础种里的就是园子里配出来的 */
    if (isFreeHybrid(s)) { const k = 'h:' + id; if (seen.has(k) || book.h[id] === today) continue; seen.add(k); out.push({ hy: id, v }); continue; }
    if (!s.fid || sold.has(s.fid) || seen.has(s.fid)) continue;
    seen.add(s.fid); out.push({ fid: s.fid, v });
  }
  return out;
}
/* 报价：{ price, gift, sample }。gift 为真就不能卖 */
export function quote(rec) {
  const st = (rec && rec.stems) || [];
  if (st.some(isSampleStem)) return { price: 0, gift: false, sample: true };
  const gift = st.some((s) => { if (s.filler) return false; const b = Hy.SPECIES[spOf(s)]; return !!(b && b.gift); });
  const ok = earning(st), price = ok.length ? 12 + ok.reduce((a, e) => a + e.v, 0) : 0;
  return { price, gift, sample: false };
}
/* 卖掉（或扔掉样例那盆）：库里删掉、花位上拿下来、加花币，卖过的花记下来。成功返回卖了多少，送的花返回 null */
export async function sell(rec) {
  const q = quote(rec); if (q.gift) return null;
  const book = soldBook(), ok = q.sample ? [] : earning(rec.stems || [], book);
  await vaseDelete(rec.id);
  Day.unplaceVase(rec.id);
  if (ok.length) {
    const today = Day.dayKey();
    ok.forEach((e) => { if (e.fid) book.fids.push(e.fid); else book.h[e.hy] = today; });
    try { localStorage.setItem(SOLD_KEY, JSON.stringify(book)); } catch (e) {}
  }
  if (q.price) Day.setCoins(Day.coins() + q.price);
  return q.price;
}

/* 剪花改成要自己剪之后：以前插过的花（花谱里存着的每一枝）当作已经剪下来了，剪的时间记成这一刻，
   免得插花台一下子空了。只跑一回，记在 localStorage diarytown_cut_mig；put(f) 由调的页面给（园子用 store.put，插花台自己开库写） */
export async function migrateCuts(list, put) {
  try { if (localStorage.getItem('diarytown_cut_mig')) return 0; } catch (e) { return 0; }
  const used = new Set(), now = Date.now(); let n = 0;
  (await vaseAll()).forEach((r) => r.stems.forEach((s) => { if (!s.filler && s.fid) used.add(s.fid); }));
  for (const f of list) if (!f.wild && !f.cut && used.has(f.id)) { f.cut = now; n++; try { await put(f); } catch (e) {} }
  try { localStorage.setItem('diarytown_cut_mig', String(now)); } catch (e) {}
  return n;
}
