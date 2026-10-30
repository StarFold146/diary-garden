(function () {
  var KEY = 'diarytown_a2hs', WEEK = 7 * 864e5;
  var ua = navigator.userAgent || '';
  var iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // 真 Safari：有 Version/ 和 Safari/，排除 iOS 上的 Chrome / Firefox / Edge / 各家 app 内置浏览器
  var safari = /Version\/[\d.]+.*Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|MicroMessenger|Weibo|QQ\/|Line\/|FBAN|FBAV|Instagram|XiaoHongShu|discover/i.test(ua);
  var android = /Android/.test(ua);
  var inApp = /MicroMessenger|Weibo|QQ\/|Line\/|FBAN|FBAV|Instagram|XiaoHongShu|discover|; wv\)/i.test(ua);
  var androidChrome = android && /Chrome\/[\d.]+/.test(ua) && !/EdgA|OPR\/|SamsungBrowser|Firefox|YaBrowser|UCBrowser|HuaweiBrowser|MiuiBrowser|HeyTapBrowser|VivoBrowser/.test(ua) && !inApp;
  if (!(iOS && safari) && !(android && !inApp)) return;
  var standalone = navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (standalone) return;
  try { if (window.top !== window.self) return; } catch (e) { return; }

  var st = null;
  try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (st && (st.ok || Date.now() - (st.later || 0) < WEEK)) return;
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }

  // 安卓：先把安装提示收起来，等花园露出来再自己出卡
  var bip = null, el = null, fill = null;
  if (android) {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      bip = e;
      if (fill) fill();
    });
    window.addEventListener('appinstalled', function () { save({ ok: 1, at: Date.now() }); });
  }

  // 花园露出来了：没有哪一屏盖着，也不在「回家中」
  function gardenUp() {
    var hud = document.getElementById('hud');
    if (!hud || document.querySelector('.scr.on') || document.documentElement.classList.contains('home')) return false;
    return hud.getBoundingClientRect().height > 0;
  }

  var t0 = Date.now(), seen = 0;
  (function wait() {
    if (gardenUp()) { if (!seen) seen = Date.now(); }
    else seen = 0;
    // 花园露出来再等一小会儿，开门那一下先让她看花；页面没有这几屏（结构改了）就最多等 4 秒
    var noScreens = !document.querySelector('.scr') && Date.now() - t0 > 4000;
    if ((seen && Date.now() - seen > 1200) || noScreens) return ready();
    setTimeout(wait, 400);
  })();

  // 安卓上两样都没有（不是 Chrome、安装提示也没来）就先不出，安装提示晚到了再出
  function ready() {
    if (!android || bip || androidChrome) return show();
    fill = function () { fill = null; show(); };
  }

  function show() {
    var css = document.createElement('style');
    css.textContent =
      '#a2hs{position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 60px);z-index:7;width:calc(100% - 40px);max-width:340px;' +
      'transform:translateX(-50%) rotate(-1.2deg);background:rgba(255,252,246,.95);border-radius:16px;padding:12px 14px 4px;' +
      'box-shadow:0 10px 30px -14px rgba(80,50,40,.45),0 0 0 .5px rgba(90,60,50,.15);color:#5b4a44;' +
      'font:13px/1.7 "MaoKenTangYuan (beta)",-apple-system,"PingFang SC",sans-serif;text-align:center;' +
      'opacity:0;translate:0 -10px;transition:opacity .4s ease,translate .4s cubic-bezier(.3,1.4,.5,1)}' +
      '#a2hs.on{opacity:1;translate:0 0}' +
      '#a2hs p{margin:0;text-wrap:balance}#a2hs .l1{font-size:13px;letter-spacing:.04em}' +
      '#a2hs .l2{font-size:12px;color:#a8968c;margin-top:2px}' +
      '#a2hs .sh{display:inline-block;width:11px;height:14px;vertical-align:-2px;margin:0 2px;color:#9f3726}' +
      '#a2hs .row{display:flex;margin-top:8px;border-top:.5px solid rgba(90,60,50,.18)}' +
      '#a2hs button{flex:1;padding:8px 0 6px;font:inherit;font-size:13px;color:inherit;border:0;background:0 0;cursor:pointer}' +
      '#a2hs button+button{border-left:.5px solid rgba(90,60,50,.18);color:#a8968c}' +
      '#a2hs .ok{color:#9f3726}';
    document.head.appendChild(css);
    var share = '<svg class="sh" viewBox="0 0 11 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M5.5 1v8M3 3.4 5.5 1 8 3.4"/><path d="M3.6 5.5H1.6v7.4h7.8V5.5h-2"/></svg>';
    el = document.createElement('div');
    el.id = 'a2hs';
    el.setAttribute('role', 'status');
    if (!android) {
      el.innerHTML = '<p class="l1">把花园放到主屏幕，存档才不会被 Safari 清掉</p>' +
        '<p class="l2">点底下的 分享' + share + '→ 添加到主屏幕</p>' +
        '<div class="row"><button class="ok">好</button><button class="later">以后再说</button></div>';
    }
    fill = android ? function () {
      el.innerHTML = '<p class="l1">把花园放到主屏幕，点开就到，存档也更稳</p>' +
        (bip ? '' : '<p class="l2">点右上角 ⋮ → 添加到主屏幕</p>') +
        '<div class="row"><button class="ok">' + (bip ? '安装' : '好') + '</button><button class="later">以后再说</button></div>';
      wire();
    } : null;
    if (fill) fill(); else wire();
    document.body.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('on'); }); });
    function close(v) {
      fill = null;
      save(v);
      el.classList.remove('on');
      setTimeout(function () { el.remove(); css.remove(); }, 450);
    }
    function wire() {
      el.querySelector('.ok').onclick = function () {
        if (!bip) return close({ ok: 1, at: Date.now() });
        var p = bip;
        bip = null;
        p.prompt();
        p.userChoice.then(function (r) {
          close(r && r.outcome === 'accepted' ? { ok: 1, at: Date.now() } : { later: Date.now() });
        }, function () { close({ later: Date.now() }); });
      };
      el.querySelector('.later').onclick = function () { close({ later: Date.now() }); };
    }
  }
})();
