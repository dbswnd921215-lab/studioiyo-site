/*!
 * studioiyo 관리자 — core
 * 도구 함수, GitHub API 연결, 데이터 상태, 저장(한 번의 커밋으로 데이터+HTML 동시 반영)
 */
(function () {
  'use strict';
  var R = window.IYORender;
  var CFG = Object.assign({ owner: '', repo: '', branch: 'main', siteUrl: '' }, window.IYO_ADMIN_CONFIG || {});

  /* GitHub API 주소. 테스트용 ?api= 는 내 컴퓨터(localhost)에서 열었을 때만 허용합니다. */
  var API = 'https://api.github.com';
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  (function () {
    var q = new URLSearchParams(location.search).get('api');
    if (!q || !LOCAL) return;
    try { var u = new URL(q); if (/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) API = q.replace(/\/$/, ''); } catch (e) {}
  })();

  var DATA = {
    site: 'data/site.json', theme: 'data/theme.json', home: 'data/home.json',
    characters: 'data/characters.json', posts: 'data/posts.json', pages: 'data/pages.json'
  };
  var PATHS = { logo: 'assets/brand/logo-symbol.svg', css: 'assets/css/site.css', js: 'assets/js/site.js', manifest: 'data/manifest.json' };
  var IMG_RE = /\.(png|jpe?g|webp|gif|svg|avif)$/i;

  /* ------------------------------------------------------------------ */
  /* DOM · 공용 도구                                                       */
  /* ------------------------------------------------------------------ */
  function el(tag, props) {
    var n = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k.indexOf('on') === 0 && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'value') n.value = v;
      else if (k === 'checked') n.checked = !!v;
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) add(n, arguments[i]);
    return n;
  }
  function add(n, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(n, x); }); return; }
    n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function debounce(fn, ms) {
    var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); };
  }
  function getP(o, path) {
    var p = Array.isArray(path) ? path : String(path).split('.').filter(Boolean);
    for (var i = 0; i < p.length; i++) { if (o == null) return undefined; o = o[p[i]]; }
    return o;
  }
  function setP(o, path, v) {
    var p = Array.isArray(path) ? path : String(path).split('.').filter(Boolean);
    for (var i = 0; i < p.length - 1; i++) {
      if (o[p[i]] == null || typeof o[p[i]] !== 'object') o[p[i]] = /^\d+$/.test(p[i + 1]) ? [] : {};
      o = o[p[i]];
    }
    o[p[p.length - 1]] = v;
  }
  function i18nText(o) { return o == null ? '' : (typeof o === 'string' ? o : (o.ko || o.en || '')); }

  /* 바이트 · base64 · git blob sha */
  var enc = new TextEncoder(), dec = new TextDecoder();
  function bytesToB64(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  function b64ToBytes(b64) {
    var s = atob(String(b64).replace(/\s/g, '')), u8 = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  }
  async function blobSha(u8) {
    var head = enc.encode('blob ' + u8.length + '\0');
    var all = new Uint8Array(head.length + u8.length);
    all.set(head); all.set(u8, head.length);
    var d = await crypto.subtle.digest('SHA-1', all);
    return Array.prototype.map.call(new Uint8Array(d), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function todayKST() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso), diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return '방금 전';
    if (diff < 3600) return Math.floor(diff / 60) + '분 전';
    if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
    try {
      return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    } catch (e) { return d.toLocaleString(); }
  }
  function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'; }
  function canonical(o) { return JSON.stringify(o, null, 2) + '\n'; }

  /* 알림 · 대화상자 */
  function toast(msg, kind, ms) {
    var box = document.getElementById('toasts');
    var t = el('div', { class: 'toast' + (kind ? ' ' + kind : ''), role: kind === 'err' ? 'alert' : 'status' }, msg);
    box.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || (kind === 'err' ? 7000 : 3500));
  }
  function modal(opt) {
    return new Promise(function (resolve) {
      var prev = document.activeElement;
      var bg = el('div', { class: 'modal-bg' });
      var close = function (v) { bg.remove(); document.removeEventListener('keydown', key); if (prev && prev.focus) prev.focus(); resolve(v); };
      var key = function (e) { if (e.key === 'Escape') close(undefined); };
      var foot = el('div', { class: 'modal-foot' }, (opt.actions || [{ label: '확인', kind: 'primary', value: true }]).map(function (a) {
        return el('button', { type: 'button', class: 'b ' + (a.kind || ''), onclick: function () { close(a.value); } }, a.label);
      }));
      var m = el('div', { class: 'modal' + (opt.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opt.title || '' },
        el('div', { class: 'modal-head' }, el('h3', { text: opt.title || '' }), el('button', { type: 'button', class: 'b ghost icon', 'aria-label': '닫기', onclick: function () { close(undefined); } }, '✕')),
        el('div', { class: 'modal-body' }, typeof opt.body === 'string' ? el('p', { text: opt.body }) : opt.body),
        opt.actions === null ? null : foot);
      bg.appendChild(m);
      bg.addEventListener('mousedown', function (e) { if (e.target === bg) close(undefined); });
      document.addEventListener('keydown', key);
      document.body.appendChild(bg);
      if (opt.onOpen) opt.onOpen(close);
      var f = m.querySelector('.modal-foot .primary, .modal-foot .danger') || m.querySelector('button');
      if (f) f.focus();
    });
  }
  function confirmBox(title, body, okLabel, danger) {
    return modal({ title: title, body: body, actions: [{ label: '취소', value: false }, { label: okLabel || '확인', kind: danger ? 'danger' : 'primary', value: true }] })
      .then(function (v) { return !!v; });
  }

  /* ------------------------------------------------------------------ */
  /* 접근 키(토큰) 보관                                                    */
  /* ------------------------------------------------------------------ */
  var TK = 'iyo-admin-token', mem = null;
  function getToken() {
    try { return sessionStorage.getItem(TK) || localStorage.getItem(TK) || mem; } catch (e) { return mem; }
  }
  function setToken(t, remember) {
    mem = t;
    try {
      (remember ? localStorage : sessionStorage).setItem(TK, t);
      (remember ? sessionStorage : localStorage).removeItem(TK);
    } catch (e) {}
  }
  function clearToken() { mem = null; try { localStorage.removeItem(TK); sessionStorage.removeItem(TK); } catch (e) {} }

  /* ------------------------------------------------------------------ */
  /* GitHub API                                                          */
  /* ------------------------------------------------------------------ */
  function GHError(status, msg, raw) { var e = new Error(msg); e.status = status; e.raw = raw; return e; }
  function explain(status, data, res) {
    var m = (data && data.message) || '';
    if (status === 401) return '접근 키가 올바르지 않거나 만료됐어요. 새 키를 만들어 다시 연결해 주세요.';
    if (status === 403 && res && res.headers.get('x-ratelimit-remaining') === '0') return 'GitHub 요청 한도를 넘었어요. 몇 분 뒤 다시 시도해 주세요.';
    if (status === 403) return '이 키에는 필요한 권한이 없어요. 키를 만들 때 Contents를 "Read and write"로 골랐는지 확인해 주세요. (' + m + ')';
    if (status === 404) return '저장소를 찾을 수 없어요. 키를 만들 때 Repository access에서 "' + CFG.repo + '"를 선택했는지 확인해 주세요.';
    if (status === 409) return '저장소 상태가 충돌했어요. 새로고침 후 다시 시도해 주세요. (' + m + ')';
    if (status === 422) return /fast.forward/i.test(m) ? '그사이 다른 곳에서 저장소가 바뀌었어요. 다시 저장을 눌러 주세요.' : 'GitHub가 요청을 거절했어요: ' + m;
    if (status >= 500) return 'GitHub 서버에 일시적인 문제가 있어요. 잠시 후 다시 시도해 주세요.';
    return 'GitHub 오류(' + status + '): ' + m;
  }
  function GH(token) {
    this.token = token;
    this.repoBase = API + '/repos/' + encodeURIComponent(CFG.owner) + '/' + encodeURIComponent(CFG.repo);
  }
  GH.prototype.req = async function (method, url, body) {
    var full = /^https?:/.test(url) ? url : (url.charAt(0) === '/' ? API + url : this.repoBase + (url ? '/' + url : ''));
    var headers = { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + this.token, 'X-GitHub-Api-Version': '2022-11-28' };
    if (body) headers['Content-Type'] = 'application/json';
    var res;
    try { res = await fetch(full, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); }
    catch (e) { throw GHError(0, '인터넷 연결을 확인해 주세요. GitHub에 연결할 수 없어요.'); }
    if (res.status === 204) return null;
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw GHError(res.status, explain(res.status, data, res), data);
    return data;
  };
  GH.prototype.user = function () { return this.req('GET', '/user'); };
  GH.prototype.repo = function () { return this.req('GET', ''); };
  GH.prototype.head = async function () { return (await this.req('GET', 'git/ref/heads/' + CFG.branch)).object.sha; };
  GH.prototype.commit = function (sha) { return this.req('GET', 'git/commits/' + sha); };
  GH.prototype.tree = async function (sha) {
    var t = await this.req('GET', 'git/trees/' + sha + '?recursive=1');
    var map = {};
    (t.tree || []).forEach(function (e) { if (e.type === 'blob') map[e.path] = { sha: e.sha, size: e.size, mode: e.mode }; });
    if (t.truncated) console.warn('tree truncated');
    return map;
  };
  GH.prototype.blob = async function (sha) { var b = await this.req('GET', 'git/blobs/' + sha); return b64ToBytes(b.content); };
  GH.prototype.createBlob = async function (u8) { return (await this.req('POST', 'git/blobs', { content: bytesToB64(u8), encoding: 'base64' })).sha; };
  GH.prototype.createTree = function (base, entries) { return this.req('POST', 'git/trees', { base_tree: base, tree: entries }); };
  GH.prototype.createCommit = function (msg, tree, parent) { return this.req('POST', 'git/commits', { message: msg, tree: tree, parents: [parent] }); };
  GH.prototype.updateRef = function (sha) { return this.req('PATCH', 'git/refs/heads/' + CFG.branch, { sha: sha, force: false }); };
  GH.prototype.commits = function (n) { return this.req('GET', 'commits?sha=' + CFG.branch + '&per_page=' + (n || 30)); };
  GH.prototype.pagesLatest = function () { return this.req('GET', 'pages/builds/latest'); };

  /* ------------------------------------------------------------------ */
  /* 상태                                                                 */
  /* ------------------------------------------------------------------ */
  var S = {
    gh: null, user: null, head: null, treeSha: null, tree: {}, data: {}, base: {}, manifest: [], logo: '',
    uploads: {}, deletes: {}, saving: false, deploy: null, pagesApi: null, lastSave: null
  };
  var listeners = [];
  function on(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }
  function changed(src) { listeners.forEach(function (f) { try { f(src || 'data'); } catch (e) { console.error(e); } }); }

  async function connect(token) {
    var gh = new GH(token);
    var info = await gh.repo();
    var user = null;
    try { user = await gh.user(); } catch (e) {}
    S.gh = gh; S.user = user; S.repoInfo = info;
    await loadAll();
    return true;
  }

  async function readText(path, tree) {
    var e = (tree || S.tree)[path];
    if (!e) return null;
    return dec.decode(await S.gh.blob(e.sha));
  }

  async function loadAll() {
    var head = await S.gh.head();
    var c = await S.gh.commit(head);
    var tree = await S.gh.tree(c.tree.sha);
    var missing = Object.keys(DATA).filter(function (k) { return !tree[DATA[k]]; });
    if (missing.length) {
      var err = new Error('관리자용 데이터 파일(data 폴더)이 저장소에 없어요: ' + missing.map(function (k) { return DATA[k]; }).join(', '));
      err.code = 'NO_DATA';
      throw err;
    }
    var keys = Object.keys(DATA);
    var texts = await Promise.all(keys.map(function (k) { return readText(DATA[k], tree); }));
    var data = {}, base = {};
    keys.forEach(function (k, i) {
      try { data[k] = JSON.parse(texts[i]); }
      catch (e) { throw new Error(DATA[k] + ' 파일의 형식이 깨져 있어요. 변경 이력에서 이전 버전으로 되돌려 주세요.'); }
      base[k] = canonical(data[k]);
    });
    var logo = await readText(PATHS.logo, tree);
    var man = [];
    try { man = JSON.parse((await readText(PATHS.manifest, tree)) || '{}').generated || []; } catch (e) {}
    S.head = head; S.treeSha = c.tree.sha; S.tree = tree; S.data = data; S.base = base; S.logo = logo || ''; S.manifest = man;
    S.uploads = {}; S.deletes = {};
    changed('load');
  }

  /* 무엇이 바뀌었는지: 사람이 읽을 수 있는 이름으로 */
  var AREAS = [
    ['site', 'banner', '공지 배너'], ['site', 'menu', '메뉴'], ['site', 'boards', '게시판 설정'],
    ['site', ['seo', 'analytics', 'customHead', 'defaultLang'], '검색·공유 설정'],
    ['site', ['company', 'contact', 'store', 'footer', 'siteName', 'siteUrl'], '기본 정보'],
    ['theme', null, '디자인'], ['home', null, '홈 화면'], ['characters', null, '캐릭터'], ['posts', null, '게시글'], ['pages', null, '페이지']
  ];
  function dirtyAreas() {
    var out = [];
    var baseObj = {};
    Object.keys(DATA).forEach(function (k) {
      if (canonical(S.data[k]) === S.base[k]) return;
      baseObj[k] = baseObj[k] || JSON.parse(S.base[k]);
      AREAS.forEach(function (a) {
        if (a[0] !== k) return;
        if (!a[1]) { out.push(a[2]); return; }
        var keys = Array.isArray(a[1]) ? a[1] : [a[1]];
        var diff = keys.some(function (kk) { return JSON.stringify(S.data[k][kk]) !== JSON.stringify(baseObj[k][kk]); });
        if (diff) out.push(a[2]);
      });
    });
    var up = Object.keys(S.uploads).length, del = Object.keys(S.deletes).length;
    if (up) out.push('이미지 ' + up + '개 추가');
    if (del) out.push('파일 ' + del + '개 삭제');
    return out;
  }
  function isDirty() { return dirtyAreas().length > 0; }
  function dirtyKey(k) { return canonical(S.data[k]) !== S.base[k]; }

  function discard() {
    Object.keys(S.base).forEach(function (k) { S.data[k] = JSON.parse(S.base[k]); });
    Object.keys(S.uploads).forEach(function (p) { try { URL.revokeObjectURL(S.uploads[p].url); } catch (e) {} });
    S.uploads = {}; S.deletes = {};
    changed('discard');
  }

  function ctx(tree) {
    tree = tree || S.tree;
    return {
      logoSymbol: S.logo,
      versions: {
        css: tree[PATHS.css] ? tree[PATHS.css].sha.slice(0, 8) : '',
        js: tree[PATHS.js] ? tree[PATHS.js].sha.slice(0, 8) : ''
      }
    };
  }
  function render(data) { return R.renderSite(data || S.data, ctx()); }

  async function pool(items, n, fn) {
    var out = new Array(items.length), i = 0;
    async function worker() { while (i < items.length) { var j = i++; out[j] = await fn(items[j], j); } }
    var ws = []; for (var k = 0; k < Math.min(n, items.length); k++) ws.push(worker());
    await Promise.all(ws);
    return out;
  }

  /**
   * 저장: 데이터 + 다시 만든 HTML + 새 이미지를 한 번의 커밋으로 올립니다.
   * opts.force: 바뀐 데이터가 없어도 HTML 전체를 다시 만들어 올림
   * opts.message: 커밋 메시지
   */
  async function save(opts) {
    opts = opts || {};
    if (S.saving) return false;
    var v = R.validate(S.data);
    if (v.errors.length) {
      await modal({ title: '저장할 수 없어요', body: el('div', { class: 'stack' }, el('p', { text: '아래 내용을 먼저 고쳐 주세요.' }), el('ul', {}, v.errors.map(function (e) { return el('li', { text: e }); }))) });
      return false;
    }
    S.saving = true; changed('saving');
    try {
      var gh = S.gh;
      var head = await gh.head();
      if (head !== S.head) {
        var c2 = await gh.commit(head);
        var t2 = await gh.tree(c2.tree.sha);
        var remote = Object.keys(DATA).filter(function (k) { return (t2[DATA[k]] || {}).sha !== (S.tree[DATA[k]] || {}).sha; });
        var both = remote.filter(dirtyKey);
        if (both.length) {
          var ok = await confirmBox('다른 곳에서 바뀐 내용이 있어요',
            '이 관리자 페이지를 연 뒤에 다른 곳(GitHub Desktop, 다른 브라우저 등)에서 같은 항목이 바뀌었어요: ' + both.map(function (k) { return DATA[k]; }).join(', ') +
            '\n\n덮어쓰면 그쪽 변경이 사라져요. 취소하고 새로고침하면 최신 내용을 불러옵니다(지금 변경은 사라짐).', '내 변경으로 덮어쓰기', true);
          if (!ok) return false;
        }
        // 내가 안 건드린 데이터는 원격 최신본으로 맞춤
        for (var r = 0; r < remote.length; r++) {
          var k = remote[r];
          if (dirtyKey(k)) continue;
          var txt = dec.decode(await gh.blob(t2[DATA[k]].sha));
          S.data[k] = JSON.parse(txt); S.base[k] = canonical(S.data[k]);
        }
        if ((t2[PATHS.logo] || {}).sha !== (S.tree[PATHS.logo] || {}).sha && t2[PATHS.logo]) S.logo = dec.decode(await gh.blob(t2[PATHS.logo].sha));
        if ((t2[PATHS.manifest] || {}).sha !== (S.tree[PATHS.manifest] || {}).sha) {
          try { S.manifest = JSON.parse(dec.decode(await gh.blob(t2[PATHS.manifest].sha))).generated || []; } catch (e) {}
        }
        S.head = head; S.treeSha = c2.tree.sha; S.tree = t2;
      }

      var out = R.renderSite(S.data, ctx());
      var files = {};
      Object.keys(DATA).forEach(function (k) { files[DATA[k]] = enc.encode(canonical(S.data[k])); });
      Object.keys(out.files).forEach(function (p) { files[p] = enc.encode(out.files[p]); });
      Object.keys(S.uploads).forEach(function (p) { files[p] = S.uploads[p].bytes; });

      var entries = [], changedPaths = [];
      var paths = Object.keys(files);
      var shas = await Promise.all(paths.map(function (p) { return blobSha(files[p]); }));
      var toUpload = [];
      paths.forEach(function (p, i) {
        if (S.tree[p] && S.tree[p].sha === shas[i]) return;
        toUpload.push({ path: p, bytes: files[p], sha: shas[i] });
      });
      await pool(toUpload, 4, async function (f) {
        var sha = await gh.createBlob(f.bytes);
        entries.push({ path: f.path, mode: '100644', type: 'blob', sha: sha });
        changedPaths.push({ path: f.path, sha: sha });
      });
      var dels = {};
      S.manifest.forEach(function (p) { if (!out.files[p] && S.tree[p]) dels[p] = 1; });
      Object.keys(S.deletes).forEach(function (p) { if (S.tree[p] && !files[p]) dels[p] = 1; });
      Object.keys(dels).forEach(function (p) { entries.push({ path: p, mode: '100644', type: 'blob', sha: null }); });

      if (!entries.length) {
        S.base = {}; Object.keys(DATA).forEach(function (k) { S.base[k] = canonical(S.data[k]); });
        S.uploads = {}; S.deletes = {};
        toast('바뀐 내용이 없어서 그대로 두었어요.', '');
        return true;
      }
      var areas = dirtyAreas();
      var msg = opts.message || ('관리자: ' + (areas.length ? areas.join(', ') : '페이지 다시 만들기') + ' 수정');
      var tree = await gh.createTree(S.treeSha, entries);
      var commit = await gh.createCommit(msg, tree.sha, S.head);
      await gh.updateRef(commit.sha);

      // 로컬 상태 갱신
      entries.forEach(function (e) {
        if (e.sha === null) delete S.tree[e.path];
        else S.tree[e.path] = { sha: e.sha, size: (files[e.path] || []).length, mode: '100644' };
      });
      S.head = commit.sha; S.treeSha = tree.sha;
      Object.keys(DATA).forEach(function (k) { S.base[k] = canonical(S.data[k]); });
      S.manifest = JSON.parse(out.files[PATHS.manifest]).generated;
      Object.keys(S.uploads).forEach(function (p) { S.uploads[p].saved = true; });
      S.savedUploads = Object.assign(S.savedUploads || {}, S.uploads);
      S.uploads = {}; S.deletes = {};
      S.lastSave = { at: Date.now(), sha: commit.sha, msg: msg, count: entries.length };
      var check = changedPaths.filter(function (c) { return /\.(html|xml|txt)$/.test(c.path); })[0];
      watchDeploy(commit.sha, check);
      toast('저장했어요. 1~2분 뒤 사이트에 반영돼요.', 'ok', 5000);
      return true;
    } catch (e) {
      console.error(e);
      await modal({ title: '저장하지 못했어요', body: e.message || String(e) });
      return false;
    } finally {
      S.saving = false; changed('saved');
    }
  }

  /* 배포 확인: GitHub Pages 빌드 상태 + 실제 사이트 파일 비교 */
  var deployRun = 0;
  function siteOrigin() { try { return new URL(CFG.siteUrl).origin; } catch (e) { return ''; } }
  function sameSite() { return location.origin === siteOrigin() || LOCAL; }
  async function watchDeploy(commitSha, check) {
    var run = ++deployRun;
    S.deploy = { state: 'pending', since: Date.now(), sha: commitSha }; changed('deploy');
    for (var i = 0; i < 60 && run === deployRun; i++) {
      await sleep(i === 0 ? 4000 : 6000);
      if (run !== deployRun) return;
      var built = false;
      if (S.pagesApi !== false) {
        try {
          var b = await S.gh.pagesLatest();
          S.pagesApi = true;
          if (b && b.commit === commitSha && b.status === 'errored') {
            S.deploy = { state: 'error', msg: (b.error && b.error.message) || '', sha: commitSha }; changed('deploy'); return;
          }
          if (b && b.commit === commitSha && b.status === 'built') built = true;
        } catch (e) { if (e.status === 403 || e.status === 404) S.pagesApi = false; }
      }
      if (check && sameSite()) {
        try {
          var res = await fetch('/' + check.path + '?_=' + Date.now(), { cache: 'no-store' });
          if (res.ok && (await blobSha(new Uint8Array(await res.arrayBuffer()))) === check.sha) {
            S.deploy = { state: 'done', at: Date.now(), sha: commitSha }; changed('deploy'); return;
          }
        } catch (e) {}
      } else if (built) {
        S.deploy = { state: 'done', at: Date.now(), sha: commitSha }; changed('deploy'); return;
      }
    }
    if (run === deployRun) { S.deploy = { state: 'slow', sha: commitSha }; changed('deploy'); }
  }

  /* 이미지 URL (관리자 화면 표시용) */
  function rawUrl(path) {
    return 'https://raw.githubusercontent.com/' + CFG.owner + '/' + CFG.repo + '/' + CFG.branch + '/' + String(path).replace(/^\//, '');
  }
  function imgUrl(p) {
    if (!p) return '';
    if (/^https?:/.test(p)) return p;
    var path = String(p).replace(/^\//, '');
    if (S.uploads[path]) return S.uploads[path].url;
    if (S.savedUploads && S.savedUploads[path]) return S.savedUploads[path].url;
    return sameSite() ? '/' + path : rawUrl(path);
  }
  function images() {
    var list = [];
    Object.keys(S.tree).forEach(function (p) {
      if (IMG_RE.test(p) && p.indexOf('assets/') === 0 && !S.deletes[p] && p !== PATHS.logo) list.push({ path: p, size: S.tree[p].size, pending: false });
    });
    Object.keys(S.uploads).forEach(function (p) { if (!S.tree[p]) list.push({ path: p, size: S.uploads[p].size, pending: true }); });
    return list.sort(function (a, b) { return a.path.localeCompare(b.path); });
  }
  function usage(path) {
    var needle = '/' + String(path).replace(/^\//, '');
    var where = [];
    Object.keys(DATA).forEach(function (k) { if (JSON.stringify(S.data[k]).indexOf(needle) >= 0) where.push(k); });
    return where;
  }

  /* 이미지 올리기: 큰 사진은 웹용으로 줄임 */
  async function prepareUpload(file, opt) {
    opt = opt || {};
    var name = String(file.name || 'image').toLowerCase();
    var ext = (name.match(/\.([a-z0-9]+)$/) || [])[1] || 'png';
    var stem = name.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    var bytes, outExt = ext, type = file.type;
    var resizable = /^image\/(png|jpeg|webp)$/.test(file.type) && opt.resize !== false;
    if (resizable) {
      var bmp = await createImageBitmap(file);
      var max = opt.max || 1600;
      var scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      if (scale < 1 || file.size > 600 * 1024) {
        var cv = document.createElement('canvas');
        cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
        cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
        var blob = await new Promise(function (r) { cv.toBlob(r, 'image/webp', 0.86); });
        if (blob && blob.type === 'image/webp' && blob.size < file.size) { bytes = new Uint8Array(await blob.arrayBuffer()); outExt = 'webp'; type = 'image/webp'; }
      }
    }
    if (!bytes) bytes = new Uint8Array(await file.arrayBuffer());
    var d = todayKST();
    var rand = Math.random().toString(36).slice(2, 6);
    var path = 'assets/uploads/' + d.slice(0, 4) + '/' + d.slice(5, 7) + '/' + (stem || 'img') + '-' + rand + '.' + (outExt === 'jpeg' ? 'jpg' : outExt);
    var url = URL.createObjectURL(new Blob([bytes], { type: type || 'application/octet-stream' }));
    S.uploads[path] = { bytes: bytes, url: url, size: bytes.length, type: type, original: file.size };
    changed('upload');
    return path;
  }

  window.IYOAdmin = {
    R: R, CFG: CFG, API: API, LOCAL: LOCAL, DATA: DATA, PATHS: PATHS, S: S,
    el: el, add: add, clear: clear, clone: clone, sleep: sleep, debounce: debounce, getP: getP, setP: setP, i18nText: i18nText,
    toast: toast, modal: modal, confirmBox: confirmBox, todayKST: todayKST, fmtTime: fmtTime, fmtSize: fmtSize, canonical: canonical,
    getToken: getToken, setToken: setToken, clearToken: clearToken, GH: GH,
    on: on, changed: changed, connect: connect, loadAll: loadAll, readText: readText, dirtyAreas: dirtyAreas, isDirty: isDirty, discard: discard,
    render: render, ctx: ctx, save: save, watchDeploy: watchDeploy, imgUrl: imgUrl, rawUrl: rawUrl, images: images, usage: usage,
    prepareUpload: prepareUpload, blobSha: blobSha, bytesToB64: bytesToB64, b64ToBytes: b64ToBytes, enc: enc, dec: dec, sameSite: sameSite
  };
})();
