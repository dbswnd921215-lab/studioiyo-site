/* studioiyo site script — 언어 전환, 캐릭터 슬라이드, 오늘의 처방전, 메일 복사, 공지 배너 */
(function () {
  'use strict';
  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k, s) { try { return (s ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } },
    set: function (k, v, s) { try { (s ? sessionStorage : localStorage).setItem(k, v); } catch (e) {} }
  };
  var state = $('copy-state');

  /* 공지 배너: 기간(한국 시간 기준) 안에서만 표시, 닫으면 이번 방문 동안 숨김 */
  var bar = $('notice-bar');
  if (bar) {
    var today;
    try { today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { var d0 = new Date(); today = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0'); }
    var st = bar.getAttribute('data-start'), en = bar.getAttribute('data-end');
    var inRange = (!st || today >= st) && (!en || today <= en);
    var closedKey = 'iyo-bar-' + bar.getAttribute('data-key');
    if (inRange && store.get(closedKey, true) !== '1') bar.hidden = false; else bar.hidden = true;
    var x = bar.querySelector('.notice-x');
    if (x) x.addEventListener('click', function () { bar.hidden = true; store.set(closedKey, '1', true); });
  }

  /* 캐릭터 슬라이드 */
  var cast = $('cast'), prog = $('cast-progress');
  if (cast) {
    var upd = function () {
      if (!prog) return;
      var max = cast.scrollWidth - cast.clientWidth, vis = cast.clientWidth / cast.scrollWidth;
      var p = max > 0 ? cast.scrollLeft / max : 1;
      prog.style.width = Math.max(vis, 0.12) * 100 + (1 - vis) * 100 * p + '%';
    };
    cast.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    upd();
    var step = function (d) {
      var card = cast.querySelector('.card');
      var w = card ? card.getBoundingClientRect().width + 16 : 280;
      cast.scrollBy({ left: d * w, behavior: 'smooth' });
    };
    if ($('cast-prev')) $('cast-prev').addEventListener('click', function () { step(-1); });
    if ($('cast-next')) $('cast-next').addEventListener('click', function () { step(1); });
  }

  /* 오늘의 처방전 — 처방 = 캐릭터별 성장 문장 */
  var slip = $('slip'), castData = $('cast-data');
  if (slip && castData) {
    var CAST = [];
    try { CAST = JSON.parse(castData.textContent) || []; } catch (e) {}
    var both = function (el, o) {
      el.textContent = '';
      if (!o.en || o.en === o.ko) { el.textContent = o.ko || o.en || ''; return; }
      ['ko', 'en'].forEach(function (l) { var s = document.createElement('span'); s.className = l; s.textContent = o[l]; el.appendChild(s); });
    };
    var today2 = function () { var d = new Date(); return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0'); };
    var cur = 0;
    var render = function (i) {
      var c = CAST[i]; if (!c) return;
      var img = $('rx-img'); if (img) { img.src = c.img; img.alt = c.name.ko; }
      if ($('rx-type')) both($('rx-type'), { ko: c.name.ko + ' · ' + c.type.ko, en: c.name.en + ' · ' + c.type.en });
      if ($('rx-text')) both($('rx-text'), c.grow);
      if ($('rx-no')) $('rx-no').textContent = String(1000 + Math.floor(Math.random() * 9000));
      if ($('rx-date')) $('rx-date').textContent = today2();
    };
    render(cur);
    var draw = $('rx-draw');
    if (draw && CAST.length > 1) draw.addEventListener('click', function () {
      var n; do { n = Math.floor(Math.random() * CAST.length); } while (n === cur);
      cur = n; render(n);
      slip.classList.remove('shake'); void slip.offsetWidth; slip.classList.add('shake');
    });
  }

  /* 메일 주소 복사 */
  var copy = $('mail-copy'), addr = $('mail-addr');
  if (copy && addr) copy.addEventListener('click', function () {
    var t = addr.textContent, isEn = root.dataset.lang === 'en';
    var fallback = function () {
      var r = document.createRange(); r.selectNodeContents(addr);
      var s = getSelection(); s.removeAllRanges(); s.addRange(r);
      if (state) state.textContent = isEn ? 'Selected. Press Ctrl+C to copy.' : '주소를 선택했어요. Ctrl+C로 복사하세요.';
    };
    try { navigator.clipboard.writeText(t).then(function () { if (state) state.textContent = isEn ? 'Copied.' : '복사했어요.'; }, fallback); }
    catch (e) { fallback(); }
  });

  /* 언어 전환 (KO / EN) */
  function setLang(l) {
    root.dataset.lang = l; root.lang = l;
    document.querySelectorAll('[data-set-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.setLang === l)); });
    if (state) state.textContent = '';
    store.set('iyo-lang', l);
  }
  document.querySelectorAll('[data-set-lang]').forEach(function (b) { b.addEventListener('click', function () { setLang(b.dataset.setLang); }); });
  var saved = store.get('iyo-lang');
  var def = root.dataset.defaultLang;
  var auto = (navigator.language || 'ko').toLowerCase().indexOf('ko') === 0 ? 'ko' : 'en';
  setLang(saved === 'ko' || saved === 'en' ? saved : (def === 'ko' || def === 'en' ? def : auto));
})();
