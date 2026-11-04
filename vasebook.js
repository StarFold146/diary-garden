/* 花谱的库：插花台存进 diarytown-vase 的每一盆，插花台的花谱和园子里长按都从这儿读、从这儿卖。
   库版本 1 定死，跟 ikebana.js / main.js 打包那边一样，以后别升。
   卖价跟店里一盘菜差不多（一样菜 44、两样 56）：底价 12，每枝花 10，稀有的和园子里配出来的 16，配叶 3；
   有送的花不卖；样例花插的那盆不值钱，只能扔 */
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
/* 报价：{ price, gift, sample }。gift 为真就不能卖 */
export function quote(rec) {
  const st = (rec && rec.stems) || [];
  if (st.some(isSampleStem)) return { price: 0, gift: false, sample: true };
  let price = 12, gift = false;
  for (const s of st) {
    if (s.filler) { price += 3; continue; }
    const id = spOf(s), base = Hy.SPECIES[id];
    if (base && base.gift) gift = true;
    price += !base || base.rare ? 16 : 10;   /* 不在基础种里的就是园子里配出来的 */
  }
  return { price, gift, sample: false };
}
/* 卖掉（或扔掉样例那盆）：库里删掉、花位上拿下来、加花币。成功返回卖了多少，送的花返回 null */
export async function sell(rec) {
  const q = quote(rec); if (q.gift) return null;
  await vaseDelete(rec.id);
  Day.unplaceVase(rec.id);
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
