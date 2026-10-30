// 日记花园的厨房：照搬暮园资料页（lab/dream/muyuan）的生火中 → 摆盘 → 端上桌 → 再来一盘，
// 3D 盘子、光、描边、水彩后期、点拿/拖摆/轻点转/拖出去扔、做法、清空，逻辑一句句照原样（原页是混淆过的，解出来对着抄）。
// 只换了食材从哪来：今天日记里写的心情，按暮园那张心情→作物的表换食材；不够三样从花园田里的作物补，最多六样。
// 做好的菜存 localStorage diarytown_dishes，给店里展示柜读。
import * as Day from './day.js';   /* 菜篮子：日记一天给一次心情的菜，别的去店里买种子 */
const $ = (id) => document.getElementById(id);

/* 心情→食材，照暮园那张；id 跟日记花园 main.js 的 MOODS 一一对上。烦那句原来说螺丝豆，作物已经换成向光葵，跟着改 */
const MOODS = {
  happy: { m: '开心', k: 'heartberry', line: '今天的甜分超标了。' },
  sweet: { m: '心动', k: 'twinpeach', line: '有人让你心跳了吧。' },
  calm: { m: '平静', k: 'tiderice', line: '潮水退下去，刚刚好。' },
  coax: { m: '想被哄', k: 'bloom', line: '花瓣裹了糖，先甜一口。' },
  down: { m: '有点丧', k: 'lanternplant', line: '灯笼茄夜里自己会亮的。' },
  messy: { m: '乱糟糟', k: 'thoughtleaf', line: '零碎都卷进去，炖一锅就香了。' },
  cross: { m: '烦', k: 'boltbean', line: '向光葵脑袋跟着光转，烦了就跟它一起转过去。' },
};
/* 花园田里种的（garden.js 农场那几块，绒绒果不进公版，不拿） */
const FIELD = ['heartberry', 'tiderice', 'twinpeach', 'palettemelon', 'boltbean', 'lanternplant', 'thoughtleaf'];
const TIPS = ['把心情洗一洗，切一切', '锅热了', '偷偷尝了一口'];

function go(n) {
  $('toast').classList.remove('on');
  document.querySelectorAll('.scr').forEach((s) => s.classList.toggle('on', s.id === 's' + n));
}
function toast(t) {
  const el = $('toast');
  el.textContent = t; el.classList.add('on'); clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('on'), 1600);
}

/* 只读日记花园的库：没有这个库就别建（onupgradeneeded 时放弃），读不到就当今天没写 */
function readDiary() {
  return new Promise((ok) => {
    let r;
    try { r = indexedDB.open('diarytown'); } catch (e) { ok([]); return; }
    r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) {} };
    r.onerror = () => ok([]);
    r.onsuccess = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('flowers')) { d.close(); ok([]); return; }
      const q = d.transaction('flowers').objectStore('flowers').getAll();
      q.onsuccess = () => { d.close(); ok(q.result || []); };
      q.onerror = () => { d.close(); ok([]); };
    };
  });
}
const sameDay = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };

let moodIds = [], species = [];
async function gather() {
  const all = (await readDiary()).filter((f) => !f.wild && f.text);
  let today = all.filter((f) => sameDay(f.at, Date.now()));
  if (!today.length && all.length) { const last = all.reduce((a, b) => (b.at > a.at ? b : a)); today = [last]; }
  const ids = [];
  for (const f of today) for (const id of (f.moods && f.moods.length ? f.moods : [f.mood])) if (MOODS[id] && !ids.includes(id)) ids.push(id);
  moodIds = ids.length ? ids : ['calm'];
  /* 今天第一篇日记的菜还没领（早上在别处写的、或者改版前写的），这里补领一次 */
  const first = all.filter((f) => Day.isToday(f.at)).sort((a, b) => a.at - b.at)[0];
  if (first) Day.claimDiary(first.moods && first.moods.length ? first.moods : [first.mood]);
  /* 食材只从菜篮子里拿：今天心情的排前面，剩下按存货多少，最多六样；田里不再白送 */
  const p = Day.pantry(), ks = [];
  for (const id of moodIds) { const k = MOODS[id].k; if (p[k] > 0 && !ks.includes(k)) ks.push(k); }
  Object.keys(p).filter((k) => p[k] > 0 && !ks.includes(k)).sort((a, b) => p[b] - p[a]).forEach((k) => ks.push(k));
  species = ks.slice(0, 6);
}

let mods = null;
const loadMods = () => mods || (mods = Promise.all([import('three'), import('three/addons/controls/OrbitControls.js'), import('./shop/look.js'), import('./town/look2.js'), import('./town/mem.js'), import('./town/food.js')]));

/* 生火中：进度条 2.1 秒缓出，提示每 0.7 秒换一句，模块到了再进厨房（暮园原样） */
async function fire() {
  go(2);
  const bar = $('barI'), t0 = performance.now(), dur = 2100;
  bar.style.width = '0';
  let ti = 0;
  const tipT = setInterval(() => { ti = (ti + 1) % TIPS.length; $('tip').textContent = TIPS[ti]; }, 700);
  const barDone = new Promise((ok) => { (function f(now) { const p = Math.min(1, (now - t0) / dur); bar.style.width = 100 * (1 - Math.pow(1 - p, 2.2)) + '%'; p < 1 ? requestAnimationFrame(f) : ok(); })(t0); });
  try {
    const m = await loadMods();
    if (!species.length) await gather();
    await barDone; clearInterval(tipT);
    if (!species.length) { $('ld').textContent = '菜 篮 子 空 了'; $('tip').innerHTML = '今天的心情菜用完了。写一篇日记，或者<a href="shop.html?seeds" style="color:var(--brick)">去店里买点种子</a>'; return; }
    kitchen(m, species); go(3);
  } catch (e) {
    clearInterval(tipT); console.error(e); toast('锅没点着，再试一次'); mods = null;
    setTimeout(fire, 1800);
  }
}

let K3 = null;
function kitchen([THREE, { OrbitControls }, L, L2, M, F], picked) {
  const ORDER = ['tiderice', 'thoughtleaf', 'boltbean', 'twinpeach', 'velvetgrape', 'palettemelon', 'lanternplant', 'heartberry', 'bloom'];
  /* 应季菜：登记进小镇菜谱（长样子、切小件、单做的菜名），排位照 mem.js 插在心跳莓前面 */
  M.useSpecies(Day.seasonSpecs());
  for (const { spec } of Day.seasonSpecs()) if (!ORDER.includes(spec.id)) ORDER.splice(ORDER.length - 2, 0, spec.id);
  const FORM_LIST = ['plain', 'cake', 'stand', 'pizza', 'sundae', 'bento'];
  const old = $('cv'), cv = old.cloneNode(); old.replaceWith(cv);
  const W = () => innerWidth, H = () => innerHeight;
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(W(), H(), false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#f6efe3');
  L.lights(scene, { sun: [-3, 7, 4], range: 5 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshToonMaterial({ color: '#f6efe3' }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const cam = new THREE.PerspectiveCamera(32, W() / H(), .1, 100), ctl = new OrbitControls(cam, cv);
  ctl.enableDamping = true; ctl.enablePan = false; ctl.minPolarAngle = .35; ctl.maxPolarAngle = 1.2; ctl.minDistance = 2; ctl.maxDistance = 9;
  const look = L2.makeLook(renderer, '#f6efe3'); look.setWarm(.4);
  let dirty = true, form = 'plain', vessel = null, pieces = [], seedN = 1;
  const group = new THREE.Group(); scene.add(group);
  const kinds = () => [...new Set(picked)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const catchers = () => vessel.children.filter((c) => c.userData.catch);
  const dishName = () => form === 'plain' ? Day.seasonDish(picked) || M.dishOf(picked) : { name: kinds().map((k) => M.PRE[k]).join('') + F.FORMS[form][0], about: F.FORMS[form][1] };
  function frame() {
    const narrow = W() / H() < .8, stand = vessel.userData.kind === 'stand';
    ctl.target.set(0, vessel.userData.camY, .35);
    cam.position.set(0, (narrow ? 5.6 : 3.6) * (stand ? .6 : 1), (narrow ? 5.2 : 3.6) * (stand ? 1.3 : 1));
    dirty = true;
  }
  const down = new THREE.Raycaster();
  function surfaceY(x, z, self, onlyVessel) {
    down.set(new THREE.Vector3(x, 6, z), new THREE.Vector3(0, -1, 0));
    const h = down.intersectObjects(onlyVessel ? catchers() : [...catchers(), ...pieces.filter((p) => p !== self)], true)[0];
    return h ? h.point.y : null;
  }
  function addPiece(k, x, z, rot, seed) {
    const s = seed ?? seedN++, p = F.piece(k, s);
    p.userData.seed = s; L.outline(p, { w: .005 }); L.shadowAll(p);
    let y = x !== undefined ? surfaceY(x, z) : null;
    for (let i = 0; y === null && i < 30; i++) {
      const cs = catchers(), c = cs[Math.floor(Math.random() * cs.length)], u = c.userData;
      if (u.disc) { const a = Math.random() * 6.28, r = .8 * Math.sqrt(Math.random()) * u.disc; x = c.position.x + Math.cos(a) * r; z = c.position.z + Math.sin(a) * r; }
      else { x = c.position.x + (Math.random() - .5) * u.rect[0] * .8; z = c.position.z + (Math.random() - .5) * u.rect[1] * .8; }
      rot = Math.random() * 6.28;
      down.set(new THREE.Vector3(x, c.position.y + .35, z), new THREE.Vector3(0, -1, 0));
      const h = down.intersectObjects(catchers(), true)[0]; y = h ? h.point.y : null;
    }
    p.position.set(x, y ?? vessel.userData.top, z); p.rotation.y = rot || 0; p.scale.setScalar(2.2);
    group.add(p); p.updateMatrixWorld(true); pieces.push(p); dirty = true;
    return p;
  }
  function rebuild() {
    if (vessel) group.remove(vessel);
    vessel = Day.tintVessel(F.vessel(Day.seasonVessel(kinds()[0]), form), kinds()[0], form); L.outline(vessel, { w: .008 }); L.shadowAll(vessel);
    group.add(vessel); group.updateMatrixWorld(true); frame();
    const extra = F.EXTRA[form] || [], keep = pieces.filter((p) => picked.includes(p.userData.piece) || extra.includes(p.userData.piece));
    pieces.forEach((p) => group.remove(p)); pieces = [];
    keep.forEach((p) => addPiece(p.userData.piece, p.position.x, p.position.z, p.rotation.y, p.userData.seed));
    const d = dishName();
    $('dish').innerHTML = '<b>' + d.name + '</b><small>' + F.VESSEL_NAME[vessel.userData.kind] + (d.special ? ' · 隐藏菜' : '') + ' · ' + d.about + '</small>';
    $('pieces').innerHTML = [...extra, ...kinds()].map((k) => '<button class="add" data-k="' + k + '">＋' + F.pieceName(k) + (picked.includes(k) ? '<small style="opacity:.6"> ' + (Day.pantry()[k] || 0) + '</small>' : '') + '</button>').join('');
    document.querySelectorAll('#forms button').forEach((b) => b.classList.toggle('on', b.dataset.f === form));
    dirty = true;
  }
  $('forms').innerHTML = FORM_LIST.map((f) => '<button data-f="' + f + '">' + F.FORMS[f][0] + '</button>').join('');
  $('forms').onclick = (e) => { const b = e.target.closest('button'); if (b) { form = b.dataset.f; rebuild(); } };
  $('pieces').onclick = (e) => { const b = e.target.closest('button'); if (b) addPiece(b.dataset.k); };
  $('clear').onclick = () => { pieces.forEach((p) => group.remove(p)); pieces = []; dirty = true; };

  /* 点一下拿起来：不挪就原地转 45°；拖着沿盘面和别的块走；拖出盘外松手就扔（暮园原样） */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  let drag = null;
  const toNdc = (e) => ndc.set(e.clientX / W() * 2 - 1, -e.clientY / H() * 2 + 1);
  cv.addEventListener('pointerdown', (e) => {
    toNdc(e); ray.setFromCamera(ndc, cam);
    const hs = ray.intersectObjects(pieces, true); if (!hs.length) return;
    let o = hs[0].object; while (o && !o.userData.piece) o = o.parent;
    if (!o) return;
    drag = { o, x0: e.clientX, y0: e.clientY, moved: false, over: true };
    ctl.enabled = false; plane.constant = -o.position.y; cv.setPointerCapture(e.pointerId);
    o.position.y += .08; dirty = true;
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) drag.moved = true;
    if (!drag.moved) return;
    toNdc(e); ray.setFromCamera(ndc, cam);
    const h = ray.intersectObjects([...catchers(), ...pieces.filter((p) => p !== drag.o)], true)[0];
    if (h) { drag.o.position.set(h.point.x, h.point.y + .08, h.point.z); plane.constant = -h.point.y; drag.over = true; }
    else if (ray.ray.intersectPlane(plane, hit)) { drag.o.position.set(hit.x, .08 - plane.constant, hit.z); drag.over = false; }
    drag.o.updateMatrixWorld(true); dirty = true;
  });
  const up = () => {
    if (!drag) return;
    const o = drag.o;
    if (!drag.moved) { o.rotation.y += Math.PI / 4; o.position.y -= .08; }
    else if (!drag.over) { group.remove(o); pieces = pieces.filter((p) => p !== o); }
    else { const y = surfaceY(o.position.x, o.position.z, o); o.position.y = y ?? o.position.y - .08; }
    o.updateMatrixWorld(true); drag = null; ctl.enabled = true; dirty = true;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  ctl.addEventListener('change', () => { dirty = true; });
  const onResize = () => { renderer.setSize(W(), H(), false); look.resize(); cam.aspect = W() / H(); cam.updateProjectionMatrix(); dirty = true; };
  addEventListener('resize', onResize);
  rebuild();
  kinds().forEach((k) => { addPiece(k); addPiece(k); });
  renderer.setAnimationLoop(() => { ctl.update(); if (dirty) { look.render(scene, cam); dirty = false; } });
  K3 = {
    snap(w) {
      look.render(scene, cam);
      if (!w) return cv.toDataURL('image/jpeg', .86);
      const c = document.createElement('canvas'), s = Math.min(cv.width, cv.height); c.width = c.height = w;
      c.getContext('2d').drawImage(cv, (cv.width - s) / 2, (cv.height - s) / 2, s, s, 0, 0, w, w);
      return c.toDataURL('image/jpeg', .8);
    },
    name: dishName, count: () => pieces.length, form: () => form, kinds: () => [...new Set(pieces.map((p) => p.userData.piece))].filter((k) => picked.includes(k)),
    dispose() {
      renderer.setAnimationLoop(null); removeEventListener('resize', onResize); ctl.dispose();
      scene.traverse((o) => { o.geometry?.dispose?.(); (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); });
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
  window.__k = { add: addPiece, setForm: (f) => { form = f; rebuild(); }, cam, count: () => pieces.length };
}

/* 端上桌：空盘不让端；截一张图做卡片，今天的心情、一句话，底下照暮园留出处（「截图给酩取」换成「截图存下来」，这是自己的花园） */
$('serve').onclick = () => {
  if (!K3) return;
  if (!K3.count()) { toast('盘里还空着'); return; }
  const shot = K3.snap(), thumb = K3.snap(256), d = K3.name(), ms = moodIds.map((id) => MOODS[id]), now = new Date(), f = K3.form();
  const used = K3.kinds(); Day.usePantry(used);   /* 盘里用到的菜每样扣一份 */
  K3.dispose(); K3 = null;
  const line = d.special ? d.about : ms[0].line;
  $('card').innerHTML = '<div class="top"><span>日记花园 · 今日一盘</span><span>' + (now.getMonth() + 1) + '.' + now.getDate() + '</span></div>'
    + '<div class="shot" style="background-image:url(' + shot + ')"></div>'
    + '<p class="dname">' + d.name + '</p><p class="mood">今天的心情 · ' + ms.map((m) => m.m).join(' · ') + '</p><p class="line">' + line + '</p>'
    + '<p class="to">截图存下来</p><p class="sig">取自记忆小镇 暮园 · HESPERIDES</p>';
  try {
    const list = JSON.parse(localStorage.getItem('diarytown_dishes') || '[]');
    list.push({ name: d.name, about: d.about, special: !!d.special, form: f, species: used.length ? used : species.slice(0, 1), moods: moodIds.slice(), at: now.getTime(), thumb });
    localStorage.setItem('diarytown_dishes', JSON.stringify(list.slice(-30)));
  } catch (e) {}
  saveRecipe({ name: d.name, about: d.about, special: !!d.special, form: f, crops: used.length ? used : species.slice(0, 1), thumb });
  go(4);
};

/* —— 菜谱：头一回端上桌的菜记成菜谱（名字、做法、每盘要的菜、小图）；菜谱里按菜篮子够做几份，
   点「出盘」直接做好放进后厨那摞盘子，不用再摆一遍。存 localStorage diarytown_recipes —— */
const recipes = () => { try { return JSON.parse(localStorage.getItem('diarytown_recipes') || '[]') || []; } catch (e) { return []; } };
const recipeKey = (r) => r.name + '|' + r.form + '|' + [...r.crops].sort().join('+');
function saveRecipe(r) {
  const l = recipes(); if (l.some((x) => recipeKey(x) === recipeKey(r))) return;
  l.push({ ...r, at: Date.now() }); try { localStorage.setItem('diarytown_recipes', JSON.stringify(l)); } catch (e) {}
}
const cropZh = Day.cropZh;
const canMake = (r) => { const p = Day.pantry(); return Math.min(...r.crops.map((k) => +p[k] || 0)); };
const want = {};
function renderRecipes() {
  const l = recipes(), p = Day.pantry(), box = $('rcList');
  box.innerHTML = l.length ? '' : '<p class="rc-empty">还没有菜谱。在灶台上摆一盘端上桌，就记下来了。</p>';
  l.forEach((r) => {
    const k = recipeKey(r), max = canMake(r), n = want[k] = Math.max(max ? 1 : 0, Math.min(want[k] || 1, max)), el = document.createElement('div');
    const miss = r.crops.filter((c) => !(p[c] > 0));
    el.className = 'rc' + (max ? '' : ' off');
    el.innerHTML = (r.thumb ? '<img src="' + r.thumb + '" alt="">' : '<i></i>') + '<div class="rc-b"><b></b><small></small><div class="need">'
      + r.crops.map((c) => '<span class="' + (p[c] > 0 ? '' : 'no') + '">' + cropZh(c) + ' ' + (+p[c] || 0) + '/1</span>').join('') + '</div>'
      + (max ? '<div class="rc-row"><button data-d="-1">−</button><em>' + n + '</em><button data-d="1">＋</button><button class="mk">出 盘</button></div>' : '<div class="miss">缺 ' + miss.map(cropZh).join('、') + '</div>') + '</div>';
    el.querySelector('b').textContent = r.name; el.querySelector('small').textContent = (F_NAME[r.form] || r.form) + ' · 每盘每样菜各一份';
    el.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { want[k] = Math.max(1, Math.min(max, n + +b.dataset.d)); renderRecipes(); });
    const mk = el.querySelector('.mk'); if (mk) mk.onclick = () => makePlates(r, n);
    box.appendChild(el);
  });
}
const F_NAME = { plain: '家常', cake: '蛋糕', stand: '点心架', pizza: '披萨', sundae: '圣代', bento: '便当' };
function makePlates(r, n) {
  n = Math.min(n, canMake(r)); if (!n) return;
  try {
    const list = JSON.parse(localStorage.getItem('diarytown_dishes') || '[]'), now = Date.now();
    for (let i = 0; i < n; i++) { Day.usePantry(r.crops); list.push({ name: r.name, about: r.about, special: !!r.special, form: r.form, species: r.crops.slice(), moods: moodIds.slice(), at: now + i, thumb: r.thumb }); }
    localStorage.setItem('diarytown_dishes', JSON.stringify(list.slice(-30)));
  } catch (e) {}
  toast('出了 ' + n + ' 盘，放在后厨，去店里补货'); renderRecipes();
}
$('rcBtn').onclick = () => { renderRecipes(); $('rcSheet').hidden = false; };
$('rcClose').onclick = () => { $('rcSheet').hidden = true; };
/* 再来一盘：暮园是回去重挑心情；这里心情是日记定的，就重新生火、同一把食材再摆一盘 */
$('again').onclick = () => { species = []; fire(); };   /* 重新看菜篮子，用完的那样就没了 */

gather().then(fire);
