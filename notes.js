// 更新说明：开花园的时候弹一张奶油色卡片，每个存档每个版本只弹一回（diarytown_seen_ver）。
// 头一回来的新玩家不弹：这个文件要在 day.js 之前导入（main.js 第一行），趁别的模块还没往 localStorage 里写东西，先看有没有老存档。
// 说明的字只放在 NOTES 这一处。
export const NOTES = {
  ver: '1.3.0',
  title: '1.3.0 · 秋天上桌了',
  lines: [
    '厨房生火之前能先挑菜了，想放哪几样自己选。',
    '南瓜、栗子、柿子有了自己的样子，还多了六道秋天的菜。',
    '果子会挂在枝上了，栗子还带着刺壳。有一颗栗子飘在半空，它自己乐意，随它去吧。',
    '听说有人把钱花光了，这回每人送 200 块。',
  ],
  sign: '—— 克莱尔',
};
const SEEN = 'diarytown_seen_ver';
const NOT_SAVE = new Set(['diarytown_a2hs', 'diarytown_lowpower', SEEN]);
let hadSave = false;
try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('diarytown_') && !NOT_SAVE.has(k)) { hadSave = true; break; } } } catch (e) {}
try { if (!hadSave && !localStorage.getItem(SEEN)) localStorage.setItem(SEEN, NOTES.ver); } catch (e) {}

const CSS = `
#notes{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-.6deg);z-index:46;width:calc(100% - 40px);max-width:340px;background:rgba(255,252,246,.97);border-radius:18px;padding:18px 18px 14px;color:#5b4a44;font:13px/1.7 "MaoKenTangYuan (beta)",-apple-system,"PingFang SC",sans-serif;box-shadow:0 14px 40px -16px rgba(80,50,40,.45),0 0 0 .5px rgba(90,60,50,.15)}
#notes[hidden],#notesVeil[hidden]{display:none}
#notesVeil{position:fixed;inset:0;z-index:45;background:rgba(60,40,30,.12)}
#notes h3{font-size:15px;font-weight:400;letter-spacing:.12em;margin:0 0 6px}
#notes p{margin:0;padding:6px 0;font-size:13px;line-height:1.75;border-bottom:.5px dashed rgba(90,60,50,.2)}
#notes p:last-of-type{border-bottom:0}
#notes .sign{text-align:right;font-size:12px;color:#a8968c;margin-top:4px}
#notes .ok{display:block;margin:10px auto 0;padding:7px 34px;border:0;border-radius:20px;background:#5b4a44;color:#f6efe3;font:inherit;font-size:14px;letter-spacing:.3em;text-indent:.3em;cursor:pointer}
`;
let el = null, veil = null;
function build() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  veil = document.createElement('div'); veil.id = 'notesVeil'; veil.hidden = true;
  el = document.createElement('div'); el.id = 'notes'; el.hidden = true;
  const h = document.createElement('h3'); h.textContent = NOTES.title; el.appendChild(h);
  for (const t of NOTES.lines) { const p = document.createElement('p'); p.textContent = t; el.appendChild(p); }
  const s = document.createElement('div'); s.className = 'sign'; s.textContent = NOTES.sign; el.appendChild(s);
  const b = document.createElement('button'); b.className = 'ok'; b.type = 'button'; b.textContent = '好'; b.onclick = hide; el.appendChild(b);
  veil.onclick = hide;
  document.body.append(veil, el);
}
export function show() { if (!el) build(); el.hidden = false; veil.hidden = false; try { localStorage.setItem(SEEN, NOTES.ver); } catch (e) {} }
export function hide() { if (el) { el.hidden = true; veil.hidden = true; } }
/* 进了园子以后调一下：这个版本没看过就弹 */
export function showIfNew() { let v = null; try { v = localStorage.getItem(SEEN); } catch (e) {} if (v !== NOTES.ver) show(); }
