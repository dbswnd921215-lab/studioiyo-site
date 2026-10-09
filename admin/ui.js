/*!
 * studioiyo 관리자 — ui
 * 입력 폼 만들기(스키마 기반), 마크다운 편집기, 이미지 선택창, 실시간 미리보기
 */
(function () {
  'use strict';
  var A = window.IYOAdmin, S = A.S, el = A.el, R = A.R;

  function upd(path, v, def) {
    A.setP(S.data, path, v);
    A.changed('edit');
    if (def && def.onChange) def.onChange(v, path);
  }
  function val(path) { return A.getP(S.data, path); }
  function P(base, k) { return base.concat(k === '' || k == null ? [] : String(k).split('.')); }
  var uid = 0;
  function id() { return 'f' + (++uid); }

  function label(def, forId) {
    if (!def.label) return null;
    return el(forId ? 'label' : 'div', { class: forId ? '' : 'lbl', for: forId || null }, def.label, def.help ? el('span', { class: 'help' }, def.help) : null);
  }
  function wrap(def, control, forId) {
    return el('div', { class: 'field' }, label(def, forId), control, def.note ? el('div', { class: 'help' }, def.note) : null);
  }

  /* ---------------- 필드 종류 ---------------- */
  var T = {};
  T.text = function (def, path) {
    var i = id();
    var inp = el('input', { id: i, class: 'in' + (def.mono ? ' mono' : ''), type: def.type || 'text', placeholder: def.ph || '', value: val(path) == null ? '' : val(path), maxlength: def.max || null, inputmode: def.inputmode || null, autocomplete: 'off', spellcheck: def.mono ? 'false' : null });
    inp.addEventListener('input', function () { upd(path, def.number ? (inp.value === '' ? '' : +inp.value) : inp.value, def); });
    if (def.clean) inp.addEventListener('change', function () { var c = def.clean(inp.value); if (c !== inp.value) { inp.value = c; upd(path, c, def); } });
    return wrap(def, inp, i);
  };
  T.area = function (def, path) {
    var i = id();
    var ta = el('textarea', { id: i, class: 'in' + (def.mono ? ' code' : ''), rows: def.rows || 3, placeholder: def.ph || '', spellcheck: def.mono ? 'false' : null });
    ta.value = val(path) == null ? '' : val(path);
    ta.addEventListener('input', function () { upd(path, ta.value, def); });
    return wrap(def, ta, i);
  };
  T.i18n = function (def, path) {
    var cur = val(path);
    if (cur == null || typeof cur !== 'object') { cur = { ko: typeof cur === 'string' ? cur : '', en: '' }; A.setP(S.data, path, cur); }
    var mk = function (lang) {
      var tag = def.area ? 'textarea' : 'input';
      var n = el(tag, { class: 'in', rows: def.area ? (def.rows || 3) : null, placeholder: lang === 'ko' ? (def.ph || '한국어') : (def.phEn || 'English (비우면 한국어로 표시)'), lang: lang });
      n.value = cur[lang] || '';
      n.addEventListener('input', function () {
        var o = val(path); if (!o || typeof o !== 'object') o = {};
        o = Object.assign({}, o); o[lang] = n.value; upd(path, o, def);
      });
      return el('div', { class: 'lang-in ' + lang }, el('span', { class: 'tag' }, lang.toUpperCase()), n);
    };
    return wrap(def, el('div', { class: 'i18n' }, mk('ko'), def.koOnly ? null : mk('en')));
  };
  T.toggle = function (def, path) {
    var inp = el('input', { type: 'checkbox', checked: def.invert ? !val(path) : !!val(path) });
    inp.addEventListener('change', function () { upd(path, def.invert ? !inp.checked : inp.checked, def); });
    return el('div', { class: 'field' }, el('label', { class: 'switch' }, inp, el('span', { class: 'track' }), el('span', {}, def.label)), def.help ? el('div', { class: 'help' }, def.help) : null);
  };
  T.select = function (def, path) {
    var i = id();
    var opts = typeof def.options === 'function' ? def.options() : def.options;
    var cur = val(path);
    var s = el('select', { id: i, class: 'in' }, opts.map(function (o) { return el('option', { value: o.v, selected: String(o.v) === String(cur == null ? '' : cur) }, o.l); }));
    s.addEventListener('change', function () { upd(path, def.number ? +s.value : s.value, def); });
    return wrap(def, s, i);
  };
  T.color = function (def, path) {
    var cur = val(path) || def.default || '#000000';
    var pick = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#000000', 'aria-label': def.label || '색' });
    var hex = el('input', { class: 'in', value: cur, maxlength: 7, spellcheck: 'false', 'aria-label': (def.label || '') + ' 색 코드' });
    pick.addEventListener('input', function () { hex.value = pick.value.toUpperCase(); upd(path, hex.value, def); });
    hex.addEventListener('input', function () {
      var v = hex.value.trim(); if (v && v[0] !== '#') v = '#' + v;
      if (/^#[0-9a-f]{6}$/i.test(v)) { pick.value = v; upd(path, v.toUpperCase(), def); }
    });
    var reset = def.default ? el('button', { type: 'button', class: 'b ghost sm', title: '처음 색으로', onclick: function () { pick.value = def.default; hex.value = def.default; upd(path, def.default, def); } }, '↺') : null;
    return wrap(def, el('div', { class: 'color-in' }, pick, hex, reset));
  };
  T.range = function (def, path) {
    var i = id();
    var cur = val(path); if (cur == null || cur === '') cur = def.default;
    var out = el('output', {}, fmtR(def, cur));
    var r = el('input', { id: i, type: 'range', min: def.min, max: def.max, step: def.step || 1, value: cur });
    r.addEventListener('input', function () { out.textContent = fmtR(def, +r.value); upd(path, +r.value, def); });
    return wrap(def, el('div', { class: 'range-in' }, r, out), i);
  };
  function fmtR(def, v) { return def.fmt ? def.fmt(+v) : (v + (def.unit || '')); }
  T.date = function (def, path) {
    var i = id();
    var d = el('input', { id: i, class: 'in', type: 'date', value: val(path) || '' });
    d.addEventListener('input', function () { upd(path, d.value, def); });
    var x = el('button', { type: 'button', class: 'b ghost sm', onclick: function () { d.value = ''; upd(path, '', def); } }, '지우기');
    return wrap(def, el('div', { class: 'btn-row', style: { flexWrap: 'nowrap' } }, d, x), i);
  };
  T.image = function (def, path) {
    var thumb = el('div', { class: 'thumb' });
    var pth = el('div', { class: 'path' });
    function draw() {
      var v = val(path);
      A.clear(thumb);
      if (v) thumb.appendChild(el('img', { src: A.imgUrl(v), alt: '', onerror: function () { if (!this.dataset.r) { this.dataset.r = 1; this.src = A.rawUrl(v); } } }));
      else thumb.textContent = '없음';
      pth.textContent = v || (def.ph || '이미지를 고르지 않았어요');
    }
    draw();
    var meta = el('div', { class: 'meta' }, pth, el('div', { class: 'btn-row' },
      el('button', { type: 'button', class: 'b sm', onclick: function () { pickImage().then(function (p) { if (p) { upd(path, '/' + p, def); draw(); } }); } }, val(path) ? '바꾸기' : '이미지 고르기'),
      def.noClear ? null : el('button', { type: 'button', class: 'b ghost sm', onclick: function () { upd(path, '', def); draw(); } }, '지우기')));
    return wrap(def, el('div', { class: 'img-in' }, thumb, meta));
  };
  T.link = function (def, path) {
    var i = id(), dl = id();
    var inp = el('input', { id: i, class: 'in', list: dl, value: val(path) || '', placeholder: def.ph || '/#about, /notice/, https://…', spellcheck: 'false', autocomplete: 'off' });
    inp.addEventListener('input', function () { upd(path, inp.value.trim(), def); });
    var list = el('datalist', { id: dl }, linkOptions().map(function (o) { return el('option', { value: o.v }, o.l); }));
    return wrap(Object.assign({ help: '목록에서 고르거나 주소를 직접 입력' }, def), el('div', {}, inp, list), i);
  };
  T.note = function (def) { return el('div', { class: 'note' + (def.kind ? ' ' + def.kind : '') }, def.text); };
  T.row = function (def, base) { return el('div', { class: def.cols === 3 ? 'grid-3' : 'grid-2' }, def.fields.map(function (f) { return field(f, base); })); };
  T.group = function (def, base) {
    return el('div', { class: 'stack' }, el('div', { class: 'hr' }), el('div', {}, el('h3', { style: { fontSize: '15px' } }, def.title), def.desc ? el('p', { class: 'muted small' }, def.desc) : null), def.fields.map(function (f) { return field(f, base); }));
  };
  T.custom = function (def, path) { return def.render(path); };
  T.md = function (def, path) { return wrap(def, mdEditor(path, def)); };
  T.list = function (def, path) { return wrap(def, listEditor(def, path)); };

  function field(def, base) {
    var f = T[def.t || 'text'];
    if (!f) throw new Error('unknown field ' + def.t);
    if (def.t === 'row' || def.t === 'group' || def.t === 'note') return f(def, base);
    if (def.when && !def.when()) return null;
    return f(def, P(base, def.k));
  }
  function form(fields, base) {
    return el('div', { class: 'stack' }, fields.map(function (f) { return field(f, base || []); }));
  }

  /* ---------------- 반복 목록 ---------------- */
  function listEditor(def, path) {
    var box = el('div', { class: 'list' });
    var opened = {};
    function arr() { var a = val(path); if (!Array.isArray(a)) { a = []; A.setP(S.data, path, a); } return a; }
    function summary(item, i) {
      if (def.summary) return def.summary(item, i);
      if (typeof item === 'string') return item || '(비어 있음)';
      if (item && (item.ko != null || item.en != null)) return item.ko || item.en || '(비어 있음)';
      return '항목 ' + (i + 1);
    }
    function draw() {
      A.clear(box);
      var a = arr();
      a.forEach(function (item, i) {
        var isOpen = def.open || opened[i];
        var li = el('div', { class: 'li' + (isOpen ? '' : ' closed') });
        var tt = el('div', { class: 't', role: 'button', tabindex: '0' });
        var setT = function () { A.clear(tt); var s = summary(arr()[i], i); A.add(tt, s); };
        setT();
        var body = el('div', { class: 'li-body' });
        var built = false;
        var build = function () {
          if (built) return; built = true;
          var base = path.concat([String(i)]);
          if (def.primitive) body.appendChild(field(Object.assign({ t: def.primitive }, def.itemDef || {}, { k: '' }), base));
          else body.appendChild(form(def.item, base));
          body.addEventListener('input', setT); body.addEventListener('change', setT);
        };
        if (isOpen) build();
        var toggle = function () { opened[i] = !opened[i]; li.classList.toggle('closed', !opened[i]); if (opened[i]) build(); };
        tt.addEventListener('click', toggle);
        tt.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
        var move = function (d) {
          var a2 = arr(), j = i + d;
          if (j < 0 || j >= a2.length) return;
          var t = a2[i]; a2[i] = a2[j]; a2[j] = t;
          var o = opened[i]; opened[i] = opened[j]; opened[j] = o;
          A.changed('edit'); if (def.onChange) def.onChange(); draw();
        };
        var thumb = def.thumb ? def.thumb(item) : null;
        li.appendChild(el('div', { class: 'li-head' },
          el('span', { class: 'num' }, i + 1),
          thumb ? el('img', { src: A.imgUrl(thumb), alt: '' }) : null,
          tt,
          el('div', { class: 'li-tools' },
            el('button', { type: 'button', class: 'b ghost icon', title: '위로', 'aria-label': '위로', disabled: i === 0, onclick: function () { move(-1); } }, '↑'),
            el('button', { type: 'button', class: 'b ghost icon', title: '아래로', 'aria-label': '아래로', disabled: i === a.length - 1, onclick: function () { move(1); } }, '↓'),
            def.fixed ? null : el('button', {
              type: 'button', class: 'b ghost icon', title: '삭제', 'aria-label': '삭제', disabled: def.min && a.length <= def.min,
              onclick: async function () {
                if (def.confirmDelete !== false && !(await A.confirmBox('삭제할까요?', '"' + A.i18nText(tt.textContent) + '" 항목을 지웁니다. 저장하기 전에는 [변경 취소]로 되돌릴 수 있어요.', '삭제', true))) return;
                arr().splice(i, 1); opened = {}; A.changed('edit'); if (def.onChange) def.onChange(); draw();
              }
            }, '✕'))));
        li.appendChild(body);
        box.appendChild(li);
      });
      if (!def.fixed && !(def.max && a.length >= def.max)) {
        box.appendChild(el('div', {}, el('button', {
          type: 'button', class: 'b sm', onclick: function () {
            var a2 = arr(); a2.push(def.newItem ? def.newItem() : (def.primitive === 'i18n' ? { ko: '', en: '' } : ''));
            opened = {}; opened[a2.length - 1] = true; A.changed('edit'); if (def.onChange) def.onChange(); draw();
          }
        }, '+ ' + (def.addLabel || '추가'))));
      }
    }
    draw();
    box.redraw = draw;
    return box;
  }

  /* ---------------- 링크 추천 ---------------- */
  function linkOptions() {
    var o = [
      { v: '/', l: '홈 맨 위' }, { v: '/#about', l: '홈 > 회사 소개' }, { v: '/#nine', l: '홈 > 캐릭터' }, { v: '/#visit', l: '홈 > 용궁건강원' },
      { v: '/#work', l: '홈 > 하는 일' }, { v: '/#news', l: '홈 > 소식' }, { v: '/#contact', l: '홈 > 문의' }
    ];
    ((S.data.home && S.data.home.sections) || []).forEach(function (s) { if (s.type === 'custom') o.push({ v: '/#' + (s.anchor || s.id), l: '홈 > ' + A.i18nText(s.data && s.data.title) }); });
    ((S.data.site && S.data.site.boards) || []).forEach(function (b) { o.push({ v: '/' + b.id + '/', l: '게시판: ' + A.i18nText(b.name) }); });
    ((S.data.pages && S.data.pages.pages) || []).forEach(function (p) { o.push({ v: '/' + p.slug + '/', l: '페이지: ' + A.i18nText(p.title) }); });
    var ct = (S.data.site && S.data.site.contact) || {};
    if (ct.email) o.push({ v: 'mailto:' + ct.email, l: '메일 보내기' });
    if (ct.instagram) o.push({ v: 'https://www.instagram.com/' + ct.instagram + '/', l: '인스타그램' });
    return o;
  }

  /* ---------------- 마크다운 편집기 ---------------- */
  function mdEditor(path, def) {
    var cur = val(path);
    if (!cur || typeof cur !== 'object') { cur = { ko: typeof cur === 'string' ? cur : '', en: '' }; A.setP(S.data, path, cur); }
    var lang = 'ko', mode = 'write';
    var ta = el('textarea', { class: 'in', rows: def.rows || 12, placeholder: '내용을 쓰세요. 빈 줄로 문단을 나눕니다.' });
    var pv = el('div', { class: 'md-preview prose', hidden: true });
    function load() { ta.value = (val(path) || {})[lang] || ''; ta.placeholder = lang === 'en' ? 'English (비우면 한국어 본문이 영어 화면에도 보여요)' : '내용을 쓰세요. 빈 줄로 문단을 나눕니다.'; }
    function push() { var o = Object.assign({}, val(path) || {}); o[lang] = ta.value; upd(path, o, def); }
    ta.addEventListener('input', push);
    load();
    function wrapSel(a, b, ph) {
      var s = ta.selectionStart, e = ta.selectionEnd, t = ta.value.slice(s, e) || ph || '';
      ta.setRangeText(a + t + b, s, e, 'select');
      ta.selectionStart = s + a.length; ta.selectionEnd = s + a.length + t.length;
      ta.focus(); push();
    }
    function prefix(p) {
      var s = ta.selectionStart, v = ta.value;
      var ls = v.lastIndexOf('\n', s - 1) + 1;
      var e = ta.selectionEnd, le = v.indexOf('\n', e); if (le < 0) le = v.length;
      var lines = v.slice(ls, le).split('\n').map(function (l, i) { return (typeof p === 'function' ? p(i) : p) + l.replace(/^(#{1,3}\s|[-*]\s|\d+\.\s|>\s)/, ''); });
      ta.setRangeText(lines.join('\n'), ls, le, 'end'); ta.focus(); push();
    }
    function insert(txt) { var s = ta.selectionStart; ta.setRangeText(txt, s, ta.selectionEnd, 'end'); ta.focus(); push(); }
    async function linkDlg() {
      var u = el('input', { class: 'in', placeholder: 'https://…', spellcheck: 'false' });
      var t = el('input', { class: 'in', placeholder: '보일 글자', value: ta.value.slice(ta.selectionStart, ta.selectionEnd) });
      var ok = await A.modal({ title: '링크 넣기', body: el('div', { class: 'stack' }, el('div', { class: 'field' }, el('div', { class: 'lbl' }, '주소'), u), el('div', { class: 'field' }, el('div', { class: 'lbl' }, '보일 글자'), t)), actions: [{ label: '취소', value: false }, { label: '넣기', kind: 'primary', value: true }], onOpen: function () { setTimeout(function () { u.focus(); }, 30); } });
      if (ok && u.value.trim()) { var label = t.value.trim() || u.value.trim(); var s = ta.selectionStart; ta.setRangeText('[' + label + '](' + u.value.trim() + ')', s, ta.selectionEnd, 'end'); ta.focus(); push(); }
    }
    var langSeg = el('span', { class: 'seg' }, ['ko', 'en'].map(function (l) {
      return el('button', { type: 'button', 'aria-pressed': String(l === lang), onclick: function () { lang = l; langSeg.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.textContent.toLowerCase() === l)); }); load(); if (mode === 'preview') showPv(); } }, l.toUpperCase());
    }));
    var modeBtn = el('button', { type: 'button', class: 'b', onclick: function () { mode = mode === 'write' ? 'preview' : 'write'; modeBtn.textContent = mode === 'write' ? '미리보기' : '쓰기'; if (mode === 'preview') showPv(); ta.hidden = mode === 'preview'; pv.hidden = mode !== 'preview'; } }, '미리보기');
    function showPv() { A.clear(pv); var tmp = document.createElement('div'); tmp.innerHTML = R.md(ta.value); pv.appendChild(tmp); pv.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src'); im.src = A.imgUrl(s); }); }
    var tb = function (label, title, fn) { return el('button', { type: 'button', class: 'b', title: title, 'aria-label': title, onclick: fn }, label); };
    var bar = el('div', { class: 'md-bar' },
      tb('B', '굵게', function () { wrapSel('**', '**', '굵은 글씨'); }),
      tb('제목', '제목 (큰 글씨)', function () { prefix('# '); }),
      tb('소제목', '소제목', function () { prefix('## '); }),
      el('span', { class: 'sep' }),
      tb('• 목록', '글머리 목록', function () { prefix('- '); }),
      tb('1. 목록', '번호 목록', function () { prefix(function (i) { return (i + 1) + '. '; }); }),
      tb('“ 인용', '인용', function () { prefix('> '); }),
      tb('― 구분선', '구분선', function () { insert('\n\n---\n\n'); }),
      el('span', { class: 'sep' }),
      tb('🔗 링크', '링크 넣기', linkDlg),
      tb('🖼 이미지', '이미지 넣기', function () { pickImage().then(function (p) { if (p) insert('\n\n![](/' + p + ')\n\n'); }); }),
      el('span', { class: 'grow' }), langSeg, modeBtn);
    // 편집기 안에서 Ctrl+B
    ta.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); wrapSel('**', '**', '굵은 글씨'); } });
    return el('div', { class: 'md' }, bar, ta, pv);
  }

  /* ---------------- 이미지 선택창 ---------------- */
  function uploader(onDone, compact) {
    var resize = el('input', { type: 'checkbox', checked: true });
    var input = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml', multiple: true, hidden: true });
    var status = el('span', { class: 'small muted' });
    async function handle(files) {
      files = Array.prototype.slice.call(files || []);
      if (!files.length) return;
      var paths = [];
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (!/^image\//.test(f.type)) { A.toast(f.name + ': 이미지 파일만 올릴 수 있어요.', 'warn'); continue; }
        if (f.size > 15 * 1048576) { A.toast(f.name + ': 15MB보다 큰 파일은 올릴 수 없어요.', 'warn'); continue; }
        status.textContent = '준비 중… ' + (i + 1) + '/' + files.length;
        try { paths.push(await A.prepareUpload(f, { resize: resize.checked })); }
        catch (e) { A.toast(f.name + ': 이미지를 읽지 못했어요.', 'err'); }
      }
      status.textContent = paths.length ? paths.length + '개 준비됨 · [저장]을 누르면 올라가요' : '';
      if (paths.length && onDone) onDone(paths);
    }
    input.addEventListener('change', function () { handle(input.files); input.value = ''; });
    var dz = el('div', { class: 'dropzone' },
      el('p', {}, el('button', { type: 'button', class: 'b primary', onclick: function () { input.click(); } }, '이미지 올리기'), ' 또는 여기로 끌어다 놓기'),
      el('p', { class: 'small', style: { marginTop: '8px' } }, el('label', { class: 'switch' }, resize, el('span', { class: 'track' }), el('span', {}, '웹용으로 줄이기 (긴 변 1600px, 권장)'))),
      el('p', { class: 'small', style: { marginTop: '6px' } }, status), input);
    ['dragenter', 'dragover'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); }); });
    dz.addEventListener('drop', function (e) { handle(e.dataTransfer.files); });
    return dz;
  }

  function mediaGrid(opts) {
    var grid = el('div', { class: 'media-grid' });
    var filter = opts.filter || '';
    function draw() {
      A.clear(grid);
      var list = A.images().filter(function (m) { return !filter || m.path.indexOf(filter) === 0; });
      if (!list.length) grid.appendChild(el('p', { class: 'muted small' }, '이미지가 없어요.'));
      list.forEach(function (m) {
        var b = el('button', { type: 'button', class: 'media-item', title: m.path, onclick: function () { opts.onPick(m); } },
          el('div', { class: 'im' }, el('img', { src: A.imgUrl(m.path), alt: '', loading: 'lazy', onerror: function () { if (!this.dataset.r) { this.dataset.r = 1; this.src = A.rawUrl(m.path); } } })),
          el('div', { class: 'cap' }, (m.pending ? '● ' : '') + m.path.replace(/^assets\//, '')));
        grid.appendChild(b);
      });
    }
    draw();
    grid.setFilter = function (f) { filter = f; draw(); };
    grid.redraw = draw;
    return grid;
  }

  function pickImage() {
    return new Promise(function (resolve) {
      var picked = null, closeFn;
      var grid = mediaGrid({ filter: '', onPick: function (m) { picked = m.path; closeFn && closeFn(true); } });
      var sel = el('select', { class: 'in', style: { maxWidth: '220px' } },
        [['', '전체'], ['assets/uploads/', '올린 이미지'], ['assets/characters/', '캐릭터'], ['assets/brand/', '브랜드']].map(function (o) { return el('option', { value: o[0] }, o[1]); }));
      sel.addEventListener('change', function () { grid.setFilter(sel.value); });
      var up = uploader(function (paths) { grid.redraw(); if (paths.length === 1) { picked = paths[0]; closeFn && closeFn(true); } });
      A.modal({
        title: '이미지 고르기', wide: true, actions: [{ label: '닫기', value: false }],
        body: el('div', { class: 'stack' }, up, el('div', { class: 'btn-row' }, el('b', {}, '보관함'), sel), grid),
        onOpen: function (close) { closeFn = close; }
      }).then(function () { resolve(picked); });
    });
  }

  /* ---------------- 실시간 미리보기 ---------------- */
  function previewPane(opts) {
    opts = opts || {};
    var device = window.innerWidth < 700 ? 'm' : 'pc', lang = 'ko', y = 0, anchor = '';
    var frame = el('iframe', { title: '미리보기', sandbox: 'allow-scripts', referrerpolicy: 'no-referrer' });
    var stage = el('div', { class: 'pv-stage' }, frame);
    var seg = function (items, cur, onPick) {
      var box = el('span', { class: 'seg2' });
      items.forEach(function (it) {
        box.appendChild(el('button', { type: 'button', 'aria-pressed': String(it[0] === cur), onclick: function () { box.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === this)); }, this); onPick(it[0]); } }, it[1]));
      });
      return box;
    };
    var pane = el('div', { class: 'preview-pane' },
      el('div', { class: 'pv-bar' }, el('span', { class: 't' }, opts.title || '미리보기'),
        seg([['pc', 'PC'], ['m', '모바일']], device, function (d) { device = d; layout(); }),
        seg([['ko', 'KO'], ['en', 'EN']], lang, function (l) { lang = l; refresh(); }),
        el('button', { type: 'button', class: 'b sm', title: '새로 고침', onclick: function () { refresh(); } }, '↻'),
        el('button', { type: 'button', class: 'b sm pv-close', onclick: function () { pane.classList.remove('open'); } }, '닫기')),
      stage,
      el('div', { class: 'pv-note' }, '저장 전 모습이에요. 실제 사이트는 [저장] 후 1~2분 뒤 바뀌어요.'));
    function layout() {
      var w = device === 'm' ? 390 : 1280;
      var sw = stage.clientWidth || 600, sh = stage.clientHeight || 600;
      var sc = Math.min(1, sw / w);
      frame.style.width = w + 'px';
      frame.style.height = Math.ceil(sh / sc) + 'px';
      frame.style.transform = 'scale(' + sc + ')';
      frame.style.left = Math.max(0, (sw - w * sc) / 2) + 'px';
    }
    function refresh() {
      var data = A.clone(opts.data ? opts.data() : S.data);
      if (data.site) { data.site.analytics = {}; data.site.customHead = ''; }
      var out;
      try { out = R.renderSite(data, A.ctx()); } catch (e) { console.error(e); return; }
      var page = (opts.page ? opts.page() : 'index.html');
      var html = out.files[page] || out.files['index.html'];
      // 아직 올리지 않은 이미지는 data: 주소로 바꿔서 보여 줌
      Object.keys(S.uploads).forEach(function (p) {
        var u = S.uploads[p];
        if (!u.dataUrl) u.dataUrl = 'data:' + (u.type || 'image/png') + ';base64,' + A.bytesToB64(u.bytes);
        html = html.split('/' + p).join(u.dataUrl);
      });
      html = html.replace(/data-default-lang="[^"]*"/, 'data-default-lang="' + lang + '"');
      var inject = '<script>(function(){var y=' + (y | 0) + ',an=' + JSON.stringify(anchor || '') + ';var touched=0;["wheel","touchstart","keydown","mousedown"].forEach(function(e){addEventListener(e,function(){touched=1},{passive:true})});function go(){if(touched)return;if(y<0&&an){var t=document.getElementById(an);if(t)t.scrollIntoView();}else scrollTo(0,Math.max(0,y))}addEventListener("load",function(){go();setTimeout(go,150);setTimeout(go,600)});addEventListener("scroll",function(){parent.postMessage({iyoPv:1,y:scrollY},"*")},{passive:true});document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a");if(a&&(a.getAttribute("href")||"").charAt(0)!=="#"){e.preventDefault()}},true)})()</script>';
      if (!A.sameSite()) inject = '<base href="' + A.CFG.siteUrl.replace(/\/$/, '') + '/">' + inject;
      html = html.replace('<head>', '<head>' + inject);
      frame.srcdoc = html;
    }
    window.addEventListener('message', function (e) { if (e.source === frame.contentWindow && e.data && e.data.iyoPv) y = e.data.y; });
    if (window.ResizeObserver) new ResizeObserver(layout).observe(stage);
    var dRefresh = A.debounce(refresh, 350);
    var off = A.on(function (src) { if (src === 'edit' || src === 'upload' || src === 'discard' || src === 'load') dRefresh(); });
    pane.refresh = refresh;
    pane.dispose = off;
    pane.openBtn = el('button', { type: 'button', class: 'b sm dark pv-open', onclick: function () { pane.classList.add('open'); setTimeout(layout, 30); refresh(); } }, '미리보기 보기');
    pane.setAnchor = function (a) { if (a === anchor) return; anchor = a || ''; y = -1; dRefresh(); };
    setTimeout(function () { layout(); refresh(); }, 0);
    return pane;
  }

  A.ui = { field: field, form: form, listEditor: listEditor, mdEditor: mdEditor, pickImage: pickImage, uploader: uploader, mediaGrid: mediaGrid, previewPane: previewPane, linkOptions: linkOptions };
})();
