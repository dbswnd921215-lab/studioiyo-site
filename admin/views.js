/*!
 * studioiyo 관리자 — 화면(views)과 시작
 */
(function () {
  'use strict';
  var A = window.IYOAdmin, S = A.S, el = A.el, R = A.R, U = A.ui, CFG = A.CFG;

  var TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new?name=studioiyo-admin' +
    '&description=' + encodeURIComponent('studioiyo.com 관리자 페이지용') +
    '&target_name=' + encodeURIComponent(CFG.owner) + '&expires_in=366&contents=write&pages=read';

  var COLOR_INFO = {
    sand: ['바탕', '페이지 전체 배경 (모래색)'], paper: ['종이', '카드 안쪽, 진한 배경 위 글자'], ink: ['먹색', '기본 글자, 테두리, 캐릭터 선'],
    ink_soft: ['연한 글자', '보조 설명 글자'], coral: ['코랄', '주요 버튼, 회사 소개 배경'], coral_line: ['코랄 선', '사이트 바깥 테두리 선'],
    card: ['명함 블루', '첫 화면(히어로) 배경, 하위 페이지 머리'], slate: ['슬레이트', '섹션 제목 글자'], lavender: ['라벤더', '라벨(알약) 배경'],
    butter: ['버터', '용궁건강원 배경'], sky: ['하늘', '하는 일 1번 막대'], peach: ['복숭아', '하는 일 2번 막대'],
    seaglass: ['바다유리', '하는 일 4번 막대'], lilac: ['라일락', '하는 일 5번 막대'], deep: ['심해', '푸터 배경']
  };
  var SECTION_NAME = {
    hero: '첫 화면 (히어로)', about: '회사 소개', characters: '캐릭터', visit: '용궁건강원', work: '하는 일', news: '소식 (최근 게시글)', contact: '문의', custom: '직접 만든 섹션'
  };
  function colorOptions(withDefault) {
    var o = withDefault ? [{ v: '', l: '기본 색 그대로' }] : [];
    return o.concat(R.COLOR_KEYS.map(function (k) { return { v: k, l: COLOR_INFO[k][0] + ' (' + ((S.data.theme.colors || {})[k] || '') + ')' }; }));
  }
  function i18n(o) { return A.i18nText(o); }
  function uidPost() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  /* ------------------------------------------------------------------ */
  /* 화면 틀                                                              */
  /* ------------------------------------------------------------------ */
  var NAV = [
    { g: '운영', items: [['dashboard', '대시보드'], ['banner', '공지 배너'], ['posts', '게시판'], ['pages', '페이지']] },
    { g: '콘텐츠', items: [['home', '홈 화면 구성'], ['characters', '캐릭터'], ['info', '기본 정보'], ['menu', '메뉴']] },
    { g: '디자인', items: [['design', '색 · 글꼴 · 크기']] },
    { g: '설정', items: [['seo', '검색 · 공유'], ['media', '이미지 보관함'], ['history', '변경 이력'], ['settings', '연결 · 백업']] }
  ];
  var DIRTY_MAP = {
    banner: ['공지 배너'], posts: ['게시글', '게시판 설정'], pages: ['페이지'], home: ['홈 화면'], characters: ['캐릭터'],
    info: ['기본 정보'], menu: ['메뉴'], design: ['디자인'], seo: ['검색·공유 설정'], media: [/^이미지/, /^파일/]
  };
  var app = document.getElementById('app');
  var shell = null, mainEl, titleEl, subEl, chipEl, sideEl, scrimEl, saveBar, navBtns = {};
  var cleanup = [];

  function buildShell() {
    A.clear(app); app.className = '';
    sideEl = el('aside', { class: 'side', 'aria-label': '관리 메뉴' },
      el('div', { class: 'brand-mark' }, 'Studio iyo', el('small', {}, '홈페이지 관리자')),
      NAV.map(function (g) {
        return el('nav', { class: 'nav-group', 'aria-label': g.g }, el('h4', {}, g.g), g.items.map(function (it) {
          var b = el('button', { type: 'button', class: 'nav-item', onclick: function () { go(it[0]); } }, el('span', {}, it[1]));
          navBtns[it[0]] = b;
          return b;
        }));
      }),
      el('div', { class: 'side-foot' },
        el('a', { href: CFG.siteUrl, target: '_blank', rel: 'noopener' }, '사이트 열기 ↗'),
        el('span', { id: 'who' }, S.user ? '연결: ' + S.user.login : '')));
    scrimEl = el('div', { class: 'scrim', onclick: closeSide });
    titleEl = el('h1'); subEl = el('p', { class: 'sub' });
    chipEl = el('span', { class: 'deploy-chip' });
    var top = el('div', { class: 'topbar' },
      el('div', { class: 'btn-row', style: { flexWrap: 'nowrap', alignItems: 'flex-start' } },
        el('button', { type: 'button', class: 'b icon menu-btn', 'aria-label': '메뉴 열기', onclick: function () { sideEl.classList.add('open'); scrimEl.classList.add('open'); } }, '☰'),
        el('div', {}, titleEl, subEl)),
      el('div', { class: 'btn-row' }, chipEl, el('a', { class: 'b sm', href: CFG.siteUrl, target: '_blank', rel: 'noopener' }, '사이트 보기 ↗')));
    mainEl = el('div', { id: 'view' });
    saveBar = el('div', { class: 'savebar', hidden: true });
    shell = el('div', { class: 'shell' }, sideEl, scrimEl, el('main', { class: 'main' }, top, mainEl), saveBar);
    app.appendChild(shell);
    var dChrome = A.debounce(refreshChrome, 150);
    A.on(function (src) { if (src === 'edit') dChrome(); else refreshChrome(src); });
    refreshChrome();
  }
  function closeSide() { sideEl.classList.remove('open'); scrimEl.classList.remove('open'); }

  function refreshChrome() {
    if (!shell) return;
    var areas = A.dirtyAreas();
    Object.keys(navBtns).forEach(function (k) {
      var m = DIRTY_MAP[k] || [];
      var d = areas.some(function (a) { return m.some(function (x) { return x instanceof RegExp ? x.test(a) : x === a; }); });
      var dot = navBtns[k].querySelector('.dot');
      if (d && !dot) navBtns[k].appendChild(el('span', { class: 'dot', title: '저장하지 않은 변경' }));
      if (!d && dot) dot.remove();
    });
    // 저장 막대
    A.clear(saveBar);
    if (areas.length || S.saving) {
      saveBar.hidden = false;
      saveBar.appendChild(el('div', { class: 'savebar-in' },
        el('div', { class: 'txt' }, S.saving ? '저장하는 중…' : '저장하지 않은 변경이 있어요', el('small', {}, S.saving ? '창을 닫지 마세요' : areas.join(' · '))),
        el('div', { class: 'btn-row' },
          el('button', { type: 'button', class: 'b sm', disabled: S.saving, onclick: async function () { if (await A.confirmBox('변경을 취소할까요?', '마지막으로 저장한 상태로 돌아갑니다. 이 작업은 되돌릴 수 없어요.', '변경 취소', true)) { A.discard(); route(); } } }, '변경 취소'),
          el('button', { type: 'button', class: 'b primary', disabled: S.saving, onclick: doSave }, S.saving ? el('span', { class: 'spinner' }) : null, S.saving ? '저장 중' : '저장하고 사이트에 반영'))));
    } else saveBar.hidden = true;
    // 배포 상태
    A.clear(chipEl);
    var d = S.deploy;
    if (d) {
      var map = {
        pending: ['warn', '사이트에 반영 중…'], done: ['ok', '사이트 반영 완료'], error: ['err', '반영 실패 · 변경 이력 확인'], slow: ['warn', '반영 확인이 늦어요 · 잠시 후 새로고침']
      };
      var m = map[d.state];
      if (m) chipEl.appendChild(el('span', { class: 'pill-tag ' + m[0], title: d.msg || '' }, d.state === 'pending' ? el('span', { class: 'spinner', style: { width: '11px', height: '11px', borderWidth: '2px' } }) : null, m[1]));
    }
  }
  async function doSave() {
    var ok = await A.save();
    if (ok) route();
  }

  /* ------------------------------------------------------------------ */
  /* 라우터                                                               */
  /* ------------------------------------------------------------------ */
  function go(path) { if (location.hash !== '#/' + path) location.hash = '#/' + path; else route(); closeSide(); }
  function route() {
    if (!shell) return;
    cleanup.forEach(function (f) { try { f(); } catch (e) {} }); cleanup = [];
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var name = parts[0] || 'dashboard';
    if (!V[name]) name = 'dashboard';
    Object.keys(navBtns).forEach(function (k) { if (k === name) navBtns[k].setAttribute('aria-current', 'page'); else navBtns[k].removeAttribute('aria-current'); });
    A.clear(mainEl);
    subEl.textContent = '';
    window.scrollTo(0, 0);
    try { V[name](mainEl, parts.slice(1)); }
    catch (e) { console.error(e); mainEl.appendChild(el('div', { class: 'note err' }, '화면을 그리다 오류가 났어요: ' + e.message)); }
    closeSide();
  }
  function setTitle(t, s) { titleEl.textContent = t; subEl.textContent = s || ''; document.title = t + ' · studioiyo 관리자'; }
  function card(title, desc) {
    var c = el('section', { class: 'card' });
    if (title) c.appendChild(el('h2', {}, title));
    if (desc) c.appendChild(el('p', { class: 'desc' }, desc));
    for (var i = 2; i < arguments.length; i++) A.add(c, arguments[i]);
    return c;
  }
  function withPreview(container, left, pvOpts) {
    var pv = U.previewPane(pvOpts);
    cleanup.push(pv.dispose);
    container.appendChild(el('div', { class: 'with-preview' }, el('div', { class: 'stack' }, el('div', { class: 'pv-open-row' }, pv.openBtn), left), pv));
    return pv;
  }

  var V = {};

  /* ------------------------------------------------------------------ */
  /* 대시보드                                                             */
  /* ------------------------------------------------------------------ */
  V.dashboard = function (root) {
    setTitle('대시보드', 'studioiyo.com 운영 현황');
    var posts = (S.data.posts.posts || []);
    var pub = posts.filter(function (p) { return p.published !== false; }).length;
    var b = S.data.site.banner || {};
    var bs = bannerState(b);
    var siteStat = el('div', { class: 'v' }, el('span', { class: 'spinner' }));
    var siteSub = el('div', { class: 's' }, '확인 중…');
    var lastV = el('div', { class: 'v', style: { fontSize: '16px' } }, '…'), lastS = el('div', { class: 's' });
    root.appendChild(el('div', { class: 'stats' },
      el('div', { class: 'stat' }, el('div', { class: 'k' }, '사이트 상태'), siteStat, siteSub),
      el('div', { class: 'stat' }, el('div', { class: 'k' }, '공지 배너'), el('div', { class: 'v' }, el('span', { class: 'pill-tag ' + bs[0] }, bs[1])), el('div', { class: 's' }, bs[2])),
      el('div', { class: 'stat' }, el('div', { class: 'k' }, '게시글'), el('div', { class: 'v' }, pub + '개 공개'), el('div', { class: 's' }, (posts.length - pub) + '개 임시저장 · 게시판 ' + (S.data.site.boards || []).length + '개')),
      el('div', { class: 'stat' }, el('div', { class: 'k' }, '마지막 변경'), lastV, lastS)));
    var q = function (to, t, s) { return el('button', { type: 'button', onclick: function () { go(to); } }, el('b', {}, t), el('span', {}, s)); };
    root.appendChild(card('빠른 작업', null, el('div', { class: 'quick' },
      q('posts/new', '새 공지 쓰기', '공지사항 게시판에 글 올리기'),
      q('banner', '공지 배너', '임시 휴무 · 이벤트 띠 공지'),
      q('info', '운영 정보', '운영 시간 · 휴무일 · 요금 · 연락처'),
      q('design', '디자인', '색 · 글꼴 · 글자 크기'))));
    var hist = el('ul', { class: 'hist' }, el('li', {}, el('span', { class: 'muted small' }, '불러오는 중…')));
    root.appendChild(card('최근 변경', '저장할 때마다 기록이 남고, [변경 이력]에서 예전 상태로 되돌릴 수 있어요.', hist, el('p', { style: { marginTop: '10px' } }, el('button', { type: 'button', class: 'b sm', onclick: function () { go('history'); } }, '변경 이력 전체 보기'))));
    root.appendChild(card('이렇게 동작해요', null, el('ol', { class: 'steps-guide' },
      el('li', {}, el('div', {}, el('b', {}, '고치기'), ' — 왼쪽 메뉴에서 바꿀 곳을 찾아 고쳐요. 오른쪽 미리보기에 바로 보여요.')),
      el('li', {}, el('div', {}, el('b', {}, '저장'), ' — 화면 아래 검은 막대의 [저장하고 사이트에 반영]을 눌러요. (단축키 Ctrl+S)')),
      el('li', {}, el('div', {}, el('b', {}, '반영'), ' — 1~2분 뒤 studioiyo.com에 반영돼요. 안 바뀌어 보이면 Ctrl+F5로 새로고침하세요.')))));
    // 비동기 정보
    S.gh.commits(5).then(function (list) {
      A.clear(hist);
      list.forEach(function (c) { hist.appendChild(histItem(c, false)); });
      if (list[0]) { lastV.textContent = A.fmtTime(list[0].commit.author.date); lastS.textContent = list[0].commit.message.split('\n')[0]; }
    }).catch(function (e) { A.clear(hist); hist.appendChild(el('li', {}, el('span', { class: 'muted small' }, e.message))); });
    S.gh.pagesLatest().then(function (bd) {
      S.pagesApi = true;
      A.clear(siteStat);
      var m = { built: ['ok', '정상 공개 중'], building: ['warn', '반영 중'], queued: ['warn', '반영 대기'], errored: ['err', '반영 실패'] }[bd.status] || ['', bd.status];
      siteStat.appendChild(el('span', { class: 'pill-tag ' + m[0] }, m[1]));
      siteSub.textContent = '마지막 반영 ' + A.fmtTime(bd.updated_at || bd.created_at);
    }).catch(function (e) {
      if (e.status === 403 || e.status === 404) S.pagesApi = false;
      A.clear(siteStat); siteStat.appendChild(el('span', { class: 'pill-tag ok' }, '공개 중'));
      siteSub.textContent = e.status === 403 ? '자세한 반영 상태는 키에 Pages 읽기 권한이 있으면 보여요' : '';
    });
  };
  function bannerState(b) {
    if (!b.enabled) return ['', '꺼짐', '사이트에 보이지 않아요'];
    if (!i18n(b.text)) return ['warn', '문구 없음', '문구를 입력해야 보여요'];
    var t = A.todayKST();
    if (b.start && t < b.start) return ['warn', '예약됨', b.start.replace(/-/g, '.') + '부터 표시'];
    if (b.end && t > b.end) return ['', '기간 지남', b.end.replace(/-/g, '.') + '에 끝남'];
    return ['ok', '표시 중', b.end ? b.end.replace(/-/g, '.') + '까지' : '기간 제한 없음'];
  }
  function histItem(c, withRestore) {
    var when = A.fmtTime(c.commit.author.date);
    return el('li', {},
      el('div', {}, el('div', { class: 'msg' }, c.commit.message.split('\n')[0]),
        el('div', { class: 'meta' }, el('span', {}, when), el('span', {}, c.commit.author.name || ''), el('span', { class: 'mono' }, c.sha.slice(0, 7)))),
      el('div', { class: 'btn-row' },
        withRestore ? el('button', { type: 'button', class: 'b sm', onclick: function () { restore(c); } }, '이 시점 내용 불러오기') : null,
        el('a', { class: 'b sm ghost', href: c.html_url, target: '_blank', rel: 'noopener' }, 'GitHub에서 보기 ↗')));
  }

  /* ------------------------------------------------------------------ */
  /* 공지 배너                                                            */
  /* ------------------------------------------------------------------ */
  V.banner = function (root) {
    setTitle('공지 배너', '사이트 맨 위에 띠 모양으로 보이는 알림이에요. 임시 휴무, 이벤트, 새 소식 안내에 써요.');
    var st = el('div');
    function drawState() { A.clear(st); var s = bannerState(S.data.site.banner || {}); st.appendChild(el('div', { class: 'btn-row' }, el('b', {}, '지금 상태'), el('span', { class: 'pill-tag ' + s[0] }, s[1]), el('span', { class: 'muted small' }, s[2]))); }
    drawState();
    cleanup.push(A.on(function (src) { if (src === 'edit' || src === 'discard') drawState(); }));
    var left = [
      card(null, null, st),
      card('배너 내용', null, U.form([
        { t: 'toggle', k: 'enabled', label: '배너 켜기' },
        { t: 'i18n', k: 'text', label: '문구', area: true, rows: 2, ph: '예) 10월 15일(목)은 내부 정비로 쉬어요.', phEn: 'e.g. Closed on Thu, Oct 15 for maintenance.' },
        { t: 'row', fields: [{ t: 'link', k: 'link', label: '눌렀을 때 이동할 주소 (선택)' }, { t: 'i18n', k: 'linkLabel', label: '링크 글자', koOnly: false }] }
      ], ['site', 'banner'])),
      card('표시 기간과 모양', '기간은 한국 시간 기준이에요. 비워 두면 켜져 있는 동안 계속 보여요.', U.form([
        { t: 'row', fields: [{ t: 'date', k: 'start', label: '시작일' }, { t: 'date', k: 'end', label: '종료일 (이날까지 표시)' }] },
        { t: 'select', k: 'tone', label: '색', options: [{ v: 'coral', l: '코랄 (기본)' }, { v: 'deep', l: '심해 네이비' }, { v: 'slate', l: '슬레이트' }, { v: 'card', l: '명함 블루' }, { v: 'butter', l: '버터 노랑' }] },
        { t: 'toggle', k: 'closable', label: '방문자가 닫을 수 있게 (× 버튼)' }
      ], ['site', 'banner']))
    ];
    withPreview(root, left, { title: '홈 미리보기' });
  };

  /* ------------------------------------------------------------------ */
  /* 게시판                                                               */
  /* ------------------------------------------------------------------ */
  var postState = { board: null, q: '' };
  V.posts = function (root, args) {
    if (args[0] === 'new') return newPost(args[1]);
    if (args[0] === 'edit') return editPost(root, args[1]);
    var boards = S.data.site.boards || [];
    if (!postState.board || !boards.some(function (b) { return b.id === postState.board; })) postState.board = boards[0] ? boards[0].id : null;
    setTitle('게시판', '공지사항 같은 글을 올리고 관리해요. 글마다 주소(studioiyo.com/게시판/글주소)가 생겨요.');
    var tabs = el('div', { class: 'tabs', role: 'tablist' }, boards.map(function (b) {
      return el('button', { type: 'button', role: 'tab', 'aria-selected': String(b.id === postState.board), onclick: function () { postState.board = b.id; route(); } }, i18n(b.name) || b.id);
    }));
    var search = el('input', { class: 'in', placeholder: '제목 검색', value: postState.q, style: { maxWidth: '260px' } });
    var tbody = el('tbody');
    function draw() {
      A.clear(tbody);
      var list = (S.data.posts.posts || []).map(function (p, i) { return { p: p, i: i }; })
        .filter(function (x) { return x.p.board === postState.board && (!postState.q || (i18n(x.p.title) + ' ' + (x.p.title && x.p.title.en || '')).toLowerCase().indexOf(postState.q.toLowerCase()) >= 0); })
        .sort(function (a, b) { return (!!b.p.pinned - !!a.p.pinned) || String(b.p.date || '').localeCompare(String(a.p.date || '')); });
      if (!list.length) tbody.appendChild(el('tr', {}, el('td', { colspan: 4, class: 'muted', style: { textAlign: 'center', padding: '28px' } }, postState.q ? '찾는 글이 없어요.' : '아직 글이 없어요. [새 글 쓰기]로 첫 글을 올려 보세요.')));
      list.forEach(function (x) {
        var p = x.p;
        tbody.appendChild(el('tr', { class: 'click', onclick: function () { go('posts/edit/' + p.id); } },
          el('td', { class: 'title-cell' }, (p.pinned ? '📌 ' : ''), i18n(p.title) || '(제목 없음)', el('small', {}, '/' + p.board + '/' + p.slug + '/')),
          el('td', { class: 'hide-m' }, (p.date || '').replace(/-/g, '.')),
          el('td', {}, p.published === false ? el('span', { class: 'pill-tag' }, '임시저장') : el('span', { class: 'pill-tag ok' }, '공개')),
          el('td', { style: { textAlign: 'right' } }, el('span', { class: 'muted' }, '›'))));
      });
    }
    search.addEventListener('input', function () { postState.q = search.value; draw(); });
    draw();
    root.appendChild(card(null, null,
      boards.length ? tabs : el('div', { class: 'note warn' }, '게시판이 없어요. 아래 [게시판 관리]에서 먼저 만들어 주세요.'),
      el('div', { class: 'btn-row', style: { justifyContent: 'space-between', marginBottom: '10px' } }, search,
        boards.length ? el('button', { type: 'button', class: 'b primary', onclick: function () { go('posts/new/' + postState.board); } }, '+ 새 글 쓰기') : null),
      el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, el('th', {}, '제목'), el('th', { class: 'hide-m' }, '날짜'), el('th', {}, '상태'), el('th', {}))), tbody)));
    // 게시판 관리
    root.appendChild(card('게시판 관리', '게시판을 추가하면 studioiyo.com/주소/ 에 목록 페이지가 생겨요. 메뉴에 넣으려면 [메뉴]에서 추가하세요.', U.form([
      {
        t: 'list', k: '', addLabel: '게시판 추가', summary: function (b) { return (i18n(b.name) || '(이름 없음)') + '  /' + (b.id || '') + '/'; },
        newItem: function () { var n = 1; while ((S.data.site.boards || []).some(function (b) { return b.id === 'board' + n; })) n++; return { id: 'board' + n, name: { ko: '새 게시판', en: 'New board' }, desc: { ko: '', en: '' } }; },
        item: [
          { t: 'custom', k: 'id', render: boardIdField },
          { t: 'i18n', k: 'name', label: '게시판 이름' },
          { t: 'i18n', k: 'desc', label: '설명 (목록 페이지 위에 보임)', area: true, rows: 2 },
          { t: 'text', k: 'pill', label: '라벨 (영문, 선택)', ph: 'Notice' }
        ]
      }
    ], ['site', 'boards'])));
  };
  function boardIdField(path) {
    var old = A.getP(S.data, path);
    var inp = el('input', { class: 'in mono', value: old || '', spellcheck: 'false' });
    var msg = el('div', { class: 'help' }, '주소에 쓰여요. 영문 소문자·숫자·하이픈(-)만. 바꾸면 이 게시판의 글도 함께 옮겨지고, 예전 주소는 없어져요.');
    inp.addEventListener('focus', function () { old = A.getP(S.data, path); });
    inp.addEventListener('input', function () {
      var v = inp.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (v !== inp.value) inp.value = v;
    });
    inp.addEventListener('change', function () {
      var v = inp.value;
      if (!R.slugOk(v) || R.RESERVED.indexOf(v) >= 0) { A.toast('쓸 수 없는 주소예요.', 'warn'); inp.value = old; return; }
      (S.data.posts.posts || []).forEach(function (p) { if (p.board === old) p.board = v; });
      ((S.data.home.news) || {}).board === old && (S.data.home.news.board = v);
      A.setP(S.data, path, v); old = v; A.changed('edit');
    });
    return el('div', { class: 'field' }, el('div', { class: 'lbl' }, '주소 (영문)'), inp, msg);
  }
  function newPost(board) {
    board = board || ((S.data.site.boards || [])[0] || {}).id;
    var d = A.todayKST(), base = d.replace(/-/g, ''), n = 1;
    var posts = S.data.posts.posts = S.data.posts.posts || [];
    while (posts.some(function (p) { return p.board === board && p.slug === base + '-' + n; })) n++;
    var p = { id: uidPost(), board: board, slug: base + '-' + n, title: { ko: '', en: '' }, summary: { ko: '', en: '' }, body: { ko: '', en: '' }, date: d, image: '', pinned: false, published: true };
    posts.push(p);
    A.changed('edit');
    location.replace('#/posts/edit/' + p.id);
  }
  function findPost(id) { return (S.data.posts.posts || []).findIndex(function (p) { return p.id === id; }); }
  function editPost(root, id) {
    var idx = findPost(id);
    if (idx < 0) { setTitle('게시판'); root.appendChild(el('div', { class: 'note warn' }, '글을 찾을 수 없어요. ', el('a', { href: '#/posts' }, '목록으로'))); return; }
    var p = S.data.posts.posts[idx];
    setTitle(i18n(p.title) ? '글 수정' : '새 글', '/' + p.board + '/' + p.slug + '/');
    var base = ['posts', 'posts', String(idx)];
    cleanup.push(function () {
      // 아무것도 안 쓰고 나가면 빈 글은 지움
      var j = findPost(id);
      if (j >= 0) { var q = S.data.posts.posts[j]; if (!i18n(q.title) && !i18n(q.body) && !q.image) { S.data.posts.posts.splice(j, 1); A.changed('edit'); } }
    });
    var urlHelp = el('span');
    var drawUrl = function () { var q = S.data.posts.posts[findPost(id)]; if (q) { urlHelp.textContent = CFG.siteUrl.replace(/^https?:\/\//, '') + '/' + q.board + '/' + q.slug + '/'; subEl.textContent = '/' + q.board + '/' + q.slug + '/'; } };
    drawUrl();
    var left = [
      el('div', { class: 'btn-row', style: { justifyContent: 'space-between' } },
        el('button', { type: 'button', class: 'b sm', onclick: function () { go('posts'); } }, '← 목록'),
        el('div', { class: 'btn-row' }, null,
          el('button', {
            type: 'button', class: 'b sm danger', onclick: async function () {
              if (!(await A.confirmBox('이 글을 삭제할까요?', '저장하면 사이트에서 사라져요. 저장 전에는 [변경 취소]로 되돌릴 수 있어요.', '삭제', true))) return;
              S.data.posts.posts.splice(findPost(id), 1); A.changed('edit'); go('posts');
            }
          }, '삭제'))),
      card('글', null, U.form([
        { t: 'i18n', k: 'title', label: '제목', ph: '예) 10월 휴무 안내', phEn: 'English title (선택)' },
        { t: 'md', k: 'body', label: '본문', help: '툴바로 굵게·목록·이미지를 넣을 수 있어요. KO/EN 전환으로 영어 본문을 따로 쓸 수 있어요.' },
        { t: 'i18n', k: 'summary', label: '요약 (선택)', help: '목록과 검색 결과에 보이는 한두 문장. 비우면 본문 앞부분을 씁니다.', area: true, rows: 2 }
      ], base)),
      card('설정', null, U.form([
        { t: 'row', fields: [
          { t: 'select', k: 'board', label: '게시판', options: function () { return (S.data.site.boards || []).map(function (b) { return { v: b.id, l: i18n(b.name) }; }); }, onChange: drawUrl },
          { t: 'date', k: 'date', label: '날짜' }] },
        { t: 'text', k: 'slug', label: '글 주소', mono: true, help: '영문 소문자·숫자·하이픈', clean: function (v) { return v.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'post'; }, onChange: drawUrl },
        { t: 'custom', render: function () { return el('p', { class: 'small muted mono' }, urlHelp); } },
        { t: 'image', k: 'image', label: '대표 이미지 (선택)', help: '목록 썸네일과 공유 미리보기에 쓰여요' },
        { t: 'toggle', k: 'pinned', label: '목록 맨 위에 고정' },
        { t: 'toggle', k: 'published', label: '공개 (끄면 임시저장 — 사이트에 안 보임)' }
      ], base))
    ];
    withPreview(root, left, {
      title: '글 미리보기',
      page: function () { var q = S.data.posts.posts[findPost(id)]; return q ? q.board + '/' + q.slug + '/index.html' : 'index.html'; },
      data: function () { var d = A.clone(S.data); var q = d.posts.posts[findPost(id)]; if (q) { q.published = true; if (!i18n(q.title)) q.title = { ko: '(제목)', en: '' }; } return d; }
    });
  }

  /* ------------------------------------------------------------------ */
  /* 페이지 (브랜드 스토리 등 추가 페이지)                                    */
  /* ------------------------------------------------------------------ */
  V.pages = function (root, args) {
    if (args[0] === 'edit') return editPage(root, args[1]);
    setTitle('페이지', '브랜드 스토리, 캐릭터 IP 소개처럼 따로 열리는 페이지를 만들어요. (studioiyo.com/주소/)');
    var pages = S.data.pages.pages = S.data.pages.pages || [];
    var tbody = el('tbody');
    if (!pages.length) tbody.appendChild(el('tr', {}, el('td', { colspan: 3, class: 'muted', style: { textAlign: 'center', padding: '28px' } }, '아직 만든 페이지가 없어요.')));
    pages.forEach(function (p, i) {
      tbody.appendChild(el('tr', { class: 'click', onclick: function () { go('pages/edit/' + i); } },
        el('td', { class: 'title-cell' }, i18n(p.title) || '(제목 없음)', el('small', {}, '/' + p.slug + '/')),
        el('td', {}, p.published === false ? el('span', { class: 'pill-tag' }, '숨김') : el('span', { class: 'pill-tag ok' }, '공개')),
        el('td', { style: { textAlign: 'right' } }, el('span', { class: 'muted' }, '›'))));
    });
    root.appendChild(card(null, null,
      el('div', { class: 'btn-row', style: { justifyContent: 'flex-end', marginBottom: '10px' } },
        el('button', {
          type: 'button', class: 'b primary', onclick: function () {
            var n = 1; while (pages.some(function (p) { return p.slug === 'page-' + n; })) n++;
            pages.push({ slug: 'page-' + n, pill: '', title: { ko: '', en: '' }, desc: { ko: '', en: '' }, body: { ko: '', en: '' }, image: '', published: true });
            A.changed('edit'); go('pages/edit/' + (pages.length - 1));
          }
        }, '+ 새 페이지')),
      el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, el('th', {}, '페이지'), el('th', {}, '상태'), el('th', {}))), tbody)));
    root.appendChild(el('div', { class: 'note', style: { marginTop: '14px' } }, '예시 주소: brand-story (브랜드 스토리), character-ip (캐릭터 IP). 만든 뒤 [메뉴에 추가]를 누르면 상단 메뉴에 들어가요.'));
  };
  function editPage(root, i) {
    var pages = S.data.pages.pages || [];
    var p = pages[+i];
    if (!p) { setTitle('페이지'); root.appendChild(el('div', { class: 'note warn' }, '페이지를 찾을 수 없어요.')); return; }
    setTitle(i18n(p.title) ? '페이지 수정' : '새 페이지', '/' + p.slug + '/');
    var base = ['pages', 'pages', String(i)];
    var left = [
      el('div', { class: 'btn-row', style: { justifyContent: 'space-between' } },
        el('button', { type: 'button', class: 'b sm', onclick: function () { go('pages'); } }, '← 목록'),
        el('div', { class: 'btn-row' },
          el('button', {
            type: 'button', class: 'b sm', onclick: function () {
              var href = '/' + p.slug + '/', m = S.data.site.menu.header = S.data.site.menu.header || [];
              if (m.some(function (x) { return x.href === href; })) { A.toast('이미 메뉴에 있어요.'); return; }
              m.push({ label: A.clone(p.title), href: href }); A.changed('edit'); A.toast('상단 메뉴 맨 끝에 추가했어요. 순서는 [메뉴]에서 바꿀 수 있어요.', 'ok');
            }
          }, '메뉴에 추가'),
          el('button', {
            type: 'button', class: 'b sm danger', onclick: async function () {
              if (!(await A.confirmBox('이 페이지를 삭제할까요?', '저장하면 사이트에서 사라져요. 메뉴에 넣었다면 [메뉴]에서도 지워 주세요.', '삭제', true))) return;
              pages.splice(+i, 1); A.changed('edit'); go('pages');
            }
          }, '삭제'))),
      card('내용', null, U.form([
        { t: 'i18n', k: 'title', label: '페이지 제목', ph: '예) 브랜드 스토리', phEn: 'Brand story' },
        { t: 'i18n', k: 'desc', label: '한 줄 소개 (제목 아래)', area: true, rows: 2 },
        { t: 'md', k: 'body', label: '본문' },
        { t: 'image', k: 'image', label: '대표 이미지 (본문 위, 선택)' }
      ], base)),
      card('설정', null, U.form([
        { t: 'row', fields: [
          { t: 'text', k: 'slug', label: '주소 (영문)', mono: true, help: '예) brand-story', clean: function (v) { return v.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'page'; }, onChange: function (v) { subEl.textContent = '/' + v + '/'; } },
          { t: 'text', k: 'pill', label: '라벨 (영문, 선택)', ph: 'Brand' }] },
        { t: 'toggle', k: 'published', label: '공개' }
      ], base))
    ];
    withPreview(root, left, { title: '페이지 미리보기', page: function () { return (pages[+i] || {}).slug + '/index.html'; }, data: function () { var d = A.clone(S.data); var q = d.pages.pages[+i]; if (q) { q.published = true; if (!i18n(q.title)) q.title = { ko: '(제목)', en: '' }; } return d; } });
  }

  /* ------------------------------------------------------------------ */
  /* 홈 화면 구성                                                          */
  /* ------------------------------------------------------------------ */
  var homeSel = 0;
  var SECTION_FORMS = {
    hero: [
      { t: 'i18n', k: 'tagline', label: '한 줄 문구', area: true, rows: 2, help: '줄바꿈 그대로 보여요' },
      { t: 'list', k: 'buttons', label: '버튼', max: 3, addLabel: '버튼 추가', summary: function (b) { return i18n(b.label) || '(버튼)'; }, newItem: function () { return { label: { ko: '', en: '' }, href: '/#contact', style: 'ghost', arrow: false }; },
        item: [{ t: 'i18n', k: 'label', label: '버튼 글자' }, { t: 'link', k: 'href', label: '이동할 곳' },
          { t: 'row', fields: [{ t: 'select', k: 'style', label: '모양', options: [{ v: 'primary', l: '코랄 (강조)' }, { v: 'ghost', l: '흰색' }] }, { t: 'toggle', k: 'arrow', label: '→ 화살표' }] }] },
      { t: 'list', k: 'meta', label: '맨 위 작은 글자 (영문 3개)', primitive: 'text', max: 3, fixed: false, confirmDelete: false },
      { t: 'toggle', k: 'showCutouts', label: '종이 오림 장식 (물고기·해파리·성게) 보이기' },
      { t: 'toggle', k: 'showParade', label: '걷는 캐릭터 행렬 보이기' }
    ],
    about: [
      { t: 'row', fields: [{ t: 'text', k: 'pill', label: '라벨 (영문)' }, { t: 'i18n', k: 'eyebrow', label: '라벨 옆 글자' }] },
      { t: 'i18n', k: 'title', label: '큰 제목', area: true, rows: 2 },
      { t: 'i18n', k: 'lead', label: '소개 글', area: true, rows: 5 },
      { t: 'list', k: 'iyo', label: 'I · YOU · OUR', summary: function (x) { return (x.key || '') + '  ' + i18n(x.text); }, newItem: function () { return { key: '', text: { ko: '', en: '' } }; }, item: [{ t: 'text', k: 'key', label: '큰 글자' }, { t: 'i18n', k: 'text', label: '설명' }] },
      { t: 'text', k: 'factsTitle', label: '오른쪽 위 제목' },
      { t: 'list', k: 'facts', label: '회사 정보 표', summary: function (x) { return i18n(x.k) + ' — ' + i18n(x.v); }, newItem: function () { return { k: { ko: '', en: '' }, v: { ko: '', en: '' } }; }, item: [{ t: 'i18n', k: 'k', label: '항목' }, { t: 'i18n', k: 'v', label: '내용' }] },
      { t: 'text', k: 'milestonesTitle', label: '오른쪽 아래 제목' },
      { t: 'list', k: 'milestones', label: '주요 성과', primitive: 'i18n', addLabel: '성과 추가' }
    ],
    characters: [
      { t: 'note', text: '캐릭터 이름·설명·이미지는 왼쪽 메뉴 [캐릭터]에서 고쳐요.' },
      { t: 'row', fields: [{ t: 'text', k: 'pill', label: '라벨 (영문)' }, { t: 'i18n', k: 'eyebrow', label: '라벨 옆 글자' }] },
      { t: 'i18n', k: 'title', label: '제목' },
      { t: 'i18n', k: 'desc', label: '설명', area: true, rows: 3 }
    ],
    visit: [
      { t: 'note', text: '주소·운영 시간·휴무일·요금·지도 링크는 [기본 정보]에서 고쳐요. 제목은 매장 이름을 씁니다.' },
      { t: 'row', fields: [{ t: 'text', k: 'pill', label: '라벨 (영문)' }, { t: 'i18n', k: 'eyebrow', label: '라벨 옆 글자' }] },
      { t: 'i18n', k: 'story', label: '이야기', area: true, rows: 4 },
      { t: 'list', k: 'steps', label: '체험 단계', primitive: 'i18n', addLabel: '단계 추가' },
      { t: 'toggle', k: 'showSlip', label: '오늘의 처방전 카드 보이기' },
      { t: 'group', title: '처방전 카드 글자', fields: [
        { t: 'i18n', k: 'slip.title', label: '카드 제목' }, { t: 'i18n', k: 'slip.dose', label: '용법' },
        { t: 'i18n', k: 'slip.foot', label: '아래 안내', area: true, rows: 2 }, { t: 'i18n', k: 'slip.button', label: '버튼' },
        { t: 'area', k: 'slip.stamp', label: '도장 글자', rows: 2 }] }
    ],
    work: [
      { t: 'row', fields: [{ t: 'text', k: 'pill', label: '라벨 (영문)' }, { t: 'i18n', k: 'eyebrow', label: '라벨 옆 글자' }] },
      { t: 'i18n', k: 'title', label: '제목' },
      { t: 'i18n', k: 'desc', label: '설명', area: true, rows: 2 },
      { t: 'list', k: 'items', label: '사업 분야 막대', addLabel: '분야 추가', summary: function (x) { return i18n(x.title) || '(분야)'; }, thumb: function (x) { return x.image; },
        newItem: function () { return { title: { ko: '', en: '' }, body: { ko: '', en: '' }, tags: [], color: 'sky', image: '', open: false }; },
        item: [{ t: 'i18n', k: 'title', label: '분야 이름' }, { t: 'i18n', k: 'body', label: '설명', area: true, rows: 4 },
          { t: 'list', k: 'tags', label: '태그', primitive: 'i18n', addLabel: '태그 추가', confirmDelete: false },
          { t: 'row', fields: [{ t: 'select', k: 'color', label: '막대 색', options: function () { return colorOptions(false); } }, { t: 'toggle', k: 'open', label: '처음부터 펼쳐 두기' }] },
          { t: 'image', k: 'image', label: '오른쪽 그림' }] }
    ],
    news: [
      { t: 'note', text: '선택한 게시판의 최근 글을 홈에 보여 줘요. 글이 하나도 없으면 이 영역은 숨겨져요.' },
      { t: 'row', fields: [{ t: 'text', k: 'pill', label: '라벨 (영문)' }, { t: 'i18n', k: 'eyebrow', label: '라벨 옆 글자' }] },
      { t: 'i18n', k: 'title', label: '제목' },
      { t: 'row', fields: [
        { t: 'select', k: 'board', label: '게시판', options: function () { return (S.data.site.boards || []).map(function (b) { return { v: b.id, l: i18n(b.name) }; }); } },
        { t: 'range', k: 'count', label: '보여 줄 글 수', min: 1, max: 6, default: 3, unit: '개' }] }
    ],
    contact: [
      { t: 'note', text: '메일 주소와 인스타그램은 [기본 정보]에서 고쳐요.' },
      { t: 'row', fields: [{ t: 'text', k: 'pill', label: '라벨 (영문)' }, { t: 'i18n', k: 'eyebrow', label: '라벨 옆 글자' }] },
      { t: 'i18n', k: 'title', label: '제목', area: true, rows: 2 },
      { t: 'i18n', k: 'body', label: '안내 글', area: true, rows: 3 },
      { t: 'list', k: 'images', label: '오른쪽 캐릭터 그림', primitive: 'image', max: 4, addLabel: '그림 추가', confirmDelete: false, thumb: function (x) { return x; }, summary: function (x) { return String(x || '(그림)').split('/').pop(); } }
    ],
    custom: [
      { t: 'row', fields: [{ t: 'text', k: 'pill', label: '라벨 (영문, 선택)' }, { t: 'i18n', k: 'eyebrow', label: '라벨 옆 글자 (선택)' }] },
      { t: 'i18n', k: 'title', label: '제목', area: true, rows: 2 },
      { t: 'md', k: 'body', label: '본문', rows: 8 },
      { t: 'image', k: 'image', label: '그림 (선택, 오른쪽에 보임)' },
      { t: 'row', fields: [{ t: 'i18n', k: 'buttonLabel', label: '버튼 글자 (선택)' }, { t: 'link', k: 'buttonHref', label: '버튼 이동할 곳' }] },
      { t: 'select', k: 'align', label: '정렬', options: [{ v: 'left', l: '왼쪽' }, { v: 'center', l: '가운데' }] }
    ]
  };
  function secName(s) { return s.type === 'custom' ? (i18n(s.data && s.data.title) || '직접 만든 섹션') : (SECTION_NAME[s.type] || s.type); }
  var ANCHOR = { hero: 'top', about: 'about', characters: 'nine', visit: 'visit', work: 'work', news: 'news', contact: 'contact' };
  V.home = function (root) {
    setTitle('홈 화면 구성', '섹션 순서·보이기·배경색·문구를 바꿔요. 위아래 화살표로 순서를 옮겨요.');
    var secs = S.data.home.sections;
    if (homeSel >= secs.length) homeSel = 0;
    var listBox = el('div', { class: 'sec-list' });
    var formBox = el('div');
    var pv;
    function drawList() {
      A.clear(listBox);
      secs.forEach(function (s, i) {
        var vis = el('input', { type: 'checkbox', checked: s.visible !== false });
        vis.addEventListener('click', function (e) { e.stopPropagation(); });
        vis.addEventListener('change', function () { s.visible = vis.checked; A.changed('edit'); drawList(); });
        var mv = function (d, e) { e.stopPropagation(); var j = i + d; if (j < 0 || j >= secs.length) return; var t = secs[i]; secs[i] = secs[j]; secs[j] = t; if (homeSel === i) homeSel = j; else if (homeSel === j) homeSel = i; A.changed('edit'); drawList(); };
        listBox.appendChild(el('div', { class: 'sec-row' + (i === homeSel ? ' on' : '') + (s.visible === false ? ' off' : ''), onclick: function () { homeSel = i; drawList(); drawForm(); } },
          el('label', { class: 'switch', title: '보이기', onclick: function (e) { e.stopPropagation(); } }, vis, el('span', { class: 'track' })),
          el('div', { class: 'nm' }, secName(s), el('small', {}, s.visible === false ? '숨김' : (s.bg ? '배경: ' + (COLOR_INFO[s.bg] || [s.bg])[0] : '기본 배경'))),
          el('button', { type: 'button', class: 'b ghost icon', 'aria-label': '위로', disabled: i === 0, onclick: function (e) { mv(-1, e); } }, '↑'),
          el('button', { type: 'button', class: 'b ghost icon', 'aria-label': '아래로', disabled: i === secs.length - 1, onclick: function (e) { mv(1, e); } }, '↓')));
      });
    }
    function drawForm() {
      A.clear(formBox);
      var s = secs[homeSel]; if (!s) return;
      var isCustom = s.type === 'custom';
      var base = isCustom ? ['home', 'sections', String(homeSel), 'data'] : ['home', s.type];
      if (!isCustom && !S.data.home[s.type]) S.data.home[s.type] = {};
      var c = card(secName(s), null,
        U.form([{ t: 'select', k: 'bg', label: '배경색', options: function () { return colorOptions(true); }, onChange: drawList }].concat(isCustom ? [{ t: 'text', k: 'anchor', label: '섹션 주소 (영문, 메뉴에서 /#주소 로 연결)', mono: true, clean: function (v) { return v.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, ''); } }] : []), ['home', 'sections', String(homeSel)]),
        el('div', { class: 'hr', style: { margin: '16px 0' } }),
        U.form(SECTION_FORMS[s.type] || [], base),
        isCustom ? el('p', { style: { marginTop: '16px' } }, el('button', {
          type: 'button', class: 'b sm danger', onclick: async function () {
            if (!(await A.confirmBox('이 섹션을 삭제할까요?', '저장 전에는 [변경 취소]로 되돌릴 수 있어요.', '삭제', true))) return;
            secs.splice(homeSel, 1); homeSel = 0; A.changed('edit'); drawList(); drawForm();
          }
        }, '이 섹션 삭제')) : null);
      formBox.appendChild(c);
      if (pv) pv.setAnchor(isCustom ? (s.anchor || s.id) : ANCHOR[s.type]);
    }
    drawList(); drawForm();
    var addBtn = el('button', {
      type: 'button', class: 'b sm', onclick: function () {
        var id = 's' + Date.now().toString(36);
        secs.splice(Math.max(1, secs.length - 1), 0, { id: id, type: 'custom', visible: true, bg: '', anchor: '', data: { pill: '', eyebrow: { ko: '', en: '' }, title: { ko: '새 섹션 제목', en: '' }, body: { ko: '내용을 입력하세요.', en: '' }, image: '', buttonLabel: { ko: '', en: '' }, buttonHref: '', align: 'left' } });
        homeSel = Math.max(1, secs.length - 2); A.changed('edit'); drawList(); drawForm();
      }
    }, '+ 섹션 추가');
    var left = [card('섹션', '체크를 끄면 그 섹션이 홈에서 숨겨져요. 이름을 누르면 아래에서 내용을 고칠 수 있어요.', listBox, el('p', { style: { marginTop: '10px' } }, addBtn)), formBox];
    pv = withPreview(root, left, { title: '홈 미리보기' });
    var s0 = secs[homeSel]; if (s0 && homeSel > 0) pv.setAnchor(s0.type === 'custom' ? (s0.anchor || s0.id) : ANCHOR[s0.type]);
  };

  /* ------------------------------------------------------------------ */
  /* 캐릭터                                                               */
  /* ------------------------------------------------------------------ */
  V.characters = function (root) {
    setTitle('캐릭터', '아홉 가지 용궁체질 카드, 걷는 행렬, 오늘의 처방전에 함께 쓰여요. 순서도 여기서 바꿔요.');
    var left = [card(null, null, U.form([{
      t: 'list', k: 'characters', addLabel: '캐릭터 추가', thumb: function (c) { return c.image; },
      summary: function (c) { return el('span', {}, el('span', { class: 'swatch', style: { background: c.tint || '#eee', marginRight: '8px', verticalAlign: '-2px' } }), (i18n(c.name) || '(이름)'), el('small', {}, i18n(c.type))); },
      newItem: function () { return { id: 'char' + Date.now().toString(36), image: '', wide: false, tint: '#F0E9D0', name: { ko: '', en: '' }, species: { ko: '', en: '' }, type: { ko: '', en: '' }, line: { ko: '', en: '' }, grow: { ko: '', en: '' } }; },
      item: [
        { t: 'image', k: 'image', label: '캐릭터 그림', help: '배경이 투명한 PNG/WebP 권장', noClear: true },
        { t: 'i18n', k: 'name', label: '이름', ph: '옥돔인' },
        { t: 'i18n', k: 'species', label: '바다 생물', ph: '옥돔' },
        { t: 'i18n', k: 'type', label: '유형 이름', ph: '고운 완성러' },
        { t: 'i18n', k: 'line', label: '한 줄 소개 (카드)', area: true, rows: 2 },
        { t: 'i18n', k: 'grow', label: '처방 문장 (오늘의 처방전)', area: true, rows: 2 },
        { t: 'row', fields: [{ t: 'color', k: 'tint', label: '카드 배경색' }, { t: 'toggle', k: 'wide', label: '가로로 긴 그림 (행렬에서 조금 작게)' }] }
      ]
    }], ['characters']))];
    var pv = withPreview(root, left, { title: '홈 미리보기' });
    pv.setAnchor('nine');
  };

  /* ------------------------------------------------------------------ */
  /* 기본 정보                                                            */
  /* ------------------------------------------------------------------ */
  V.info = function (root) {
    setTitle('기본 정보', '매장·연락처·회사 정보예요. 홈, 푸터, 모든 페이지에 함께 반영돼요.');
    root.appendChild(card('용궁건강원 (매장)', '홈의 용궁건강원 영역과 푸터에 보여요.', U.form([
      { t: 'i18n', k: 'name', label: '매장 이름' },
      { t: 'row', fields: [{ t: 'i18n', k: 'address', label: '주소 (짧게, 홈)' }, { t: 'i18n', k: 'addressFull', label: '주소 (전체, 푸터)' }] },
      { t: 'row', fields: [{ t: 'text', k: 'hours', label: '운영 시간', ph: '11:00 – 20:00' }, { t: 'i18n', k: 'closed', label: '휴무일 (선택)', ph: '매주 월요일', phEn: 'Mondays' }] },
      { t: 'i18n', k: 'price', label: '체험 요금' },
      { t: 'i18n', k: 'note', label: '한 줄 안내', ph: '모든 체험 1시간 이내 · 4개 국어 지원' },
      { t: 'row', fields: [{ t: 'text', k: 'naverMap', label: '네이버 지도 링크', mono: true }, { t: 'text', k: 'googleMap', label: '구글 지도 링크', mono: true }] }
    ], ['site', 'store'])));
    root.appendChild(card('연락처', null, U.form([
      { t: 'row', fields: [{ t: 'text', k: 'email', label: '문의 메일', type: 'email', mono: true }, { t: 'text', k: 'instagram', label: '인스타그램 아이디 (@ 빼고)', mono: true, clean: function (v) { return v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '').trim(); } }] }
    ], ['site', 'contact'])));
    root.appendChild(card('회사 정보 (푸터)', '사업자 정보는 전자상거래 등에서 표시 의무가 있을 수 있으니 정확하게 적어 주세요.', U.form([
      { t: 'row', fields: [{ t: 'i18n', k: 'name', label: '상호' }, { t: 'text', k: 'ceo', label: '대표' }] },
      { t: 'text', k: 'bizNo', label: '사업자등록번호', mono: true },
      { t: 'i18n', k: 'address', label: '사업장 주소', area: true, rows: 2 },
      { t: 'row', fields: [{ t: 'text', k: 'copyright', label: '저작권 표기' }, { t: 'text', k: 'slogan', label: '맨 아래 오른쪽 문구' }] }
    ], ['site', 'company'])));
    root.appendChild(card('푸터', null, U.form([
      { t: 'i18n', k: 'line', label: '로고 아래 문장' },
      { t: 'image', k: 'lampImage', label: '오른쪽 위 캐릭터 (선택)' }
    ], ['site', 'footer'])));
  };

  /* ------------------------------------------------------------------ */
  /* 메뉴                                                                 */
  /* ------------------------------------------------------------------ */
  V.menu = function (root) {
    setTitle('메뉴', '맨 위 메뉴와 푸터 메뉴를 고쳐요. 새 페이지·게시판을 만들었다면 여기서 연결하세요.');
    var item = [{ t: 'i18n', k: 'label', label: '메뉴 이름' }, { t: 'link', k: 'href', label: '이동할 곳' }];
    var sum = function (x) { return el('span', {}, i18n(x.label) || '(이름 없음)', el('small', {}, x.href || '')); };
    var nu = function () { return { label: { ko: '', en: '' }, href: '/' }; };
    var left = [
      card('맨 위 메뉴', 'PC 화면에서 보여요. (휴대폰에서는 공간이 좁아 숨겨지고, 아래 버튼만 보여요)', U.form([{ t: 'list', k: 'header', item: item, summary: sum, newItem: nu, addLabel: '메뉴 추가', max: 7 }], ['site', 'menu'])),
      card('오른쪽 위 버튼', null, U.form([{ t: 'row', fields: item }], ['site', 'menu', 'cta'])),
      card('푸터 메뉴', null, U.form([{ t: 'list', k: 'footer', item: item, summary: sum, newItem: nu, addLabel: '메뉴 추가' }], ['site', 'menu']))
    ];
    withPreview(root, left, { title: '홈 미리보기' });
  };

  /* ------------------------------------------------------------------ */
  /* 디자인                                                               */
  /* ------------------------------------------------------------------ */
  var fontsLoaded = false;
  V.design = function (root) {
    setTitle('색 · 글꼴 · 크기', '사이트 전체에 적용되는 디자인 값이에요. 오른쪽 미리보기로 확인하며 바꿔 보세요.');
    if (!fontsLoaded) {
      fontsLoaded = true;
      var fam = Object.keys(R.FONTS).map(function (n) { return 'family=' + R.FONTS[n].spec; }).join('&');
      document.head.appendChild(el('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?' + fam + '&display=swap' }));
    }
    var th = S.data.theme;
    th.colors = th.colors || {}; th.fonts = th.fonts || {}; th.size = th.size || {};
    var pal = el('div', { class: 'palette' }, R.COLOR_KEYS.map(function (k) {
      return el('div', { class: 'pal' }, el('div', { class: 'nm' }, COLOR_INFO[k][0], el('small', {}, COLOR_INFO[k][1])),
        U.field({ t: 'color', k: k, default: R.DEFAULT_COLORS[k] }, ['theme', 'colors']));
    }));
    var fontOpts = function (grp) {
      return Object.keys(R.FONTS).filter(function (n) { return grp === 'any' || R.FONTS[n].group === grp || (grp === 'en' && R.FONTS[n].group === 'ko'); }).map(function (n) { return { v: n, l: n }; });
    };
    var sample = function (key, txt) {
      var s = el('div', { class: 'font-sample' }, txt);
      var upd = function () { s.style.fontFamily = '"' + (th.fonts[key] || '') + '", sans-serif'; };
      upd(); cleanup.push(A.on(function () { upd(); }));
      return s;
    };
    var fontWarn = el('div', { hidden: true, class: 'note warn' });
    var checkFonts = A.debounce(function () {
      fetch(R.fontsHref(S.data.theme)).then(function (r) { fontWarn.hidden = r.ok; fontWarn.textContent = r.ok ? '' : '글꼴을 불러오지 못했어요. 다른 글꼴을 골라 주세요.'; }).catch(function () {});
    }, 600);
    var left = [
      card('색', '각 색이 어디에 쓰이는지 적어 두었어요. ↺ 를 누르면 처음 색으로 돌아가요.', pal),
      card('글꼴', 'Google Fonts의 무료 글꼴이에요. 고르면 아래 견본과 미리보기가 바뀌어요.', U.form([
        { t: 'select', k: 'en', label: '로고·영문 제목', options: fontOpts('en'), onChange: checkFonts },
        { t: 'custom', render: function () { return sample('en', 'Studio iyo · Character IP 2026'); } },
        { t: 'select', k: 'ko', label: '국문 제목', options: fontOpts('ko'), onChange: checkFonts },
        { t: 'custom', render: function () { return sample('ko', '제주에서 내 캐릭터를 만나는 가장 유쾌한 방법'); } },
        { t: 'select', k: 'body', label: '본문', options: fontOpts('ko'), onChange: checkFonts },
        { t: 'custom', render: function () { return sample('body', '질문과 캐릭터로 자기 기준의 삶을 응원합니다. 0123456789'); } }
      ], ['theme', 'fonts']), fontWarn),
      card('크기 · 모양', null, U.form([
        { t: 'range', k: 'base', label: '본문 글자 크기', min: 13, max: 22, step: 0.5, default: 16, unit: 'px', help: '기본 16px. 모든 글자가 같은 비율로 커지고 작아져요.' },
        { t: 'range', k: 'heading', label: '제목 크기 배율', min: 0.7, max: 1.5, step: 0.05, default: 1, fmt: function (v) { return Math.round(v * 100) + '%'; } },
        { t: 'range', k: 'radius', label: '큰 상자 모서리 둥글기', min: 0, max: 48, default: 26, unit: 'px' },
        { t: 'range', k: 'radiusSm', label: '작은 카드 모서리 둥글기', min: 0, max: 36, default: 18, unit: 'px' },
        { t: 'range', k: 'maxWidth', label: '사이트 최대 폭 (PC)', min: 960, max: 1600, step: 20, default: 1280, unit: 'px' },
        { t: 'range', k: 'gap', label: '섹션 사이 간격', min: 0.5, max: 1.6, step: 0.05, default: 1, fmt: function (v) { return Math.round(v * 100) + '%'; } }
      ], ['theme', 'size'])),
      card(null, null, el('div', { class: 'btn-row', style: { justifyContent: 'space-between' } }, el('span', { class: 'muted small' }, '처음(지금 공개된 디자인) 값으로 모두 되돌리기'),
        el('button', {
          type: 'button', class: 'b sm danger', onclick: async function () {
            if (!(await A.confirmBox('디자인을 처음 값으로 되돌릴까요?', '색·글꼴·크기가 처음 값으로 바뀌어요. 저장해야 사이트에 반영돼요.', '되돌리기', true))) return;
            S.data.theme = { colors: Object.assign({}, R.DEFAULT_COLORS), fonts: { en: 'League Spartan', ko: 'Sunflower', body: 'Noto Sans KR' }, size: { base: 16, heading: 1, radius: 26, radiusSm: 18, maxWidth: 1280, gap: 1 } };
            A.changed('edit'); route();
          }
        }, '전체 되돌리기')))
    ];
    withPreview(root, left, { title: '홈 미리보기' });
  };

  /* ------------------------------------------------------------------ */
  /* 검색 · 공유                                                           */
  /* ------------------------------------------------------------------ */
  V.seo = function (root) {
    setTitle('검색 · 공유', '네이버·구글 검색 결과와 카카오톡·인스타 공유 미리보기에 보이는 정보예요.');
    var serp = el('div', { class: 'serp' });
    function drawSerp() {
      var s = S.data.site.seo || {};
      A.clear(serp);
      serp.appendChild(el('div', { class: 'u' }, CFG.siteUrl.replace(/^https?:\/\//, '')));
      serp.appendChild(el('div', { class: 't' }, s.title || S.data.site.siteName));
      serp.appendChild(el('div', { class: 'd' }, (s.description || '').slice(0, 160) + ((s.description || '').length > 160 ? '…' : '')));
    }
    drawSerp(); cleanup.push(A.on(function (src) { if (src === 'edit') drawSerp(); }));
    var desc = el('span');
    var drawLen = function () { var n = ((S.data.site.seo || {}).description || '').length; desc.textContent = n + '자 (80~160자 권장)'; };
    drawLen(); cleanup.push(A.on(drawLen));
    root.appendChild(card('검색 결과 미리보기', '실제 모습은 검색엔진마다 조금 달라요.', serp));
    root.appendChild(card('기본 정보', null, U.form([
      { t: 'text', k: 'title', label: '사이트 제목', help: '브라우저 탭과 검색 결과 제목' },
      { t: 'area', k: 'description', label: '사이트 설명', rows: 3, help: '' },
      { t: 'custom', render: function () { return el('p', { class: 'small muted' }, desc); } },
      { t: 'text', k: 'ogDescription', label: '공유할 때 설명 (카카오톡 등)', help: '비우면 사이트 설명을 씀' },
      { t: 'image', k: 'ogImage', label: '공유 이미지', help: '1200×630 크기 권장. 비우면 공유 미리보기에 이미지가 없어요.' },
      { t: 'toggle', k: 'indexable', label: '검색엔진에 노출 허용', help: '끄면 검색 결과에 나오지 않도록 요청해요' }
    ], ['site', 'seo'])));
    root.appendChild(card('검색엔진 등록', '네이버 서치어드바이저·구글 서치 콘솔에서 "HTML 태그" 방식으로 소유 확인할 때, 받은 코드의 content 값만 넣어 주세요.', U.form([
      { t: 'row', fields: [
        { t: 'text', k: 'naverVerification', label: '네이버 사이트 확인 코드', mono: true, clean: cleanMeta },
        { t: 'text', k: 'googleVerification', label: '구글 사이트 확인 코드', mono: true, clean: cleanMeta }] },
      { t: 'note', text: '사이트맵 주소: ' + CFG.siteUrl + '/sitemap.xml — 소유 확인 후 두 곳 모두에 이 주소를 제출하면 새 글이 더 빨리 검색돼요. (저장할 때마다 자동으로 갱신돼요)' }
    ], ['site', 'seo'])));
    root.appendChild(card('방문자 분석', '측정 ID를 넣으면 모든 페이지에 분석 코드가 자동으로 들어가요.', U.form([
      { t: 'row', fields: [
        { t: 'text', k: 'ga4', label: 'Google Analytics 4 측정 ID', mono: true, ph: 'G-XXXXXXXXXX' },
        { t: 'text', k: 'naver', label: '네이버 애널리틱스 사이트 ID', mono: true, ph: '영문·숫자' }] }
    ], ['site', 'analytics'])));
    root.appendChild(card('언어 · 고급', null, U.form([
      { t: 'select', k: 'defaultLang', label: '처음 보여 줄 언어', options: [{ v: 'auto', l: '자동 (방문자 브라우저 언어)' }, { v: 'ko', l: '항상 한국어' }, { v: 'en', l: '항상 영어' }] },
      { t: 'area', k: 'customHead', label: '<head>에 추가할 코드 (고급)', rows: 4, mono: true, help: '픽셀·채팅 위젯 등 외부 서비스가 준 코드를 넣는 곳. 잘못 넣으면 사이트가 깨질 수 있어요.' }
    ], ['site'])));
  };
  function cleanMeta(v) { var m = String(v).match(/content=["']([^"']+)["']/); return (m ? m[1] : v).trim(); }

  /* ------------------------------------------------------------------ */
  /* 이미지 보관함                                                         */
  /* ------------------------------------------------------------------ */
  V.media = function (root) {
    setTitle('이미지 보관함', '사이트에 쓰는 이미지예요. 새로 올린 이미지는 [저장]을 눌러야 실제로 올라가요.');
    var detail = el('div');
    var grid;
    function show(m) {
      A.clear(detail);
      var used = A.usage(m.path);
      var url = '/' + m.path;
      detail.appendChild(card(m.path.split('/').pop(), null,
        el('div', { class: 'img-in' }, el('div', { class: 'thumb', style: { width: '120px', height: '120px' } }, el('img', { src: A.imgUrl(m.path), alt: '' })),
          el('div', { class: 'meta' }, el('div', { class: 'path' }, url), el('div', { class: 'small muted' }, A.fmtSize(m.size || 0) + (m.pending ? ' · 저장 대기' : '') + (used.length ? ' · 사용 중' : ' · 사용하지 않음')),
            el('div', { class: 'btn-row' },
              el('button', { type: 'button', class: 'b sm', onclick: function () { navigator.clipboard && navigator.clipboard.writeText(url).then(function () { A.toast('주소를 복사했어요: ' + url); }); } }, '주소 복사'),
              el('a', { class: 'b sm ghost', href: A.imgUrl(m.path), target: '_blank', rel: 'noopener' }, '원본 보기 ↗'),
              el('button', {
                type: 'button', class: 'b sm danger', onclick: async function () {
                  var warn = used.length ? '이 이미지는 사이트에서 쓰이고 있어요. 지우면 그 자리에 그림이 안 보여요.' : '저장하면 저장소에서 지워져요. (변경 이력으로 되살릴 수 있어요)';
                  if (!(await A.confirmBox('이미지를 삭제할까요?', warn, '삭제', true))) return;
                  if (S.uploads[m.path]) { URL.revokeObjectURL(S.uploads[m.path].url); delete S.uploads[m.path]; } else S.deletes[m.path] = true;
                  A.changed('edit'); A.clear(detail); grid.redraw();
                }
              }, '삭제'))))));
    }
    grid = U.mediaGrid({ filter: '', onPick: show });
    var sel = el('select', { class: 'in', style: { maxWidth: '220px' } }, [['', '전체'], ['assets/uploads/', '올린 이미지'], ['assets/characters/', '캐릭터'], ['assets/brand/', '브랜드']].map(function (o) { return el('option', { value: o[0] }, o[1]); }));
    sel.addEventListener('change', function () { grid.setFilter(sel.value); });
    root.appendChild(card('올리기', '큰 사진은 자동으로 웹용(긴 변 1600px, WebP)으로 줄여서 사이트가 빨라져요.', U.uploader(function () { grid.redraw(); })));
    root.appendChild(detail);
    root.appendChild(card('보관함', null, el('div', { class: 'btn-row', style: { marginBottom: '12px' } }, sel), grid));
  };

  /* ------------------------------------------------------------------ */
  /* 변경 이력                                                            */
  /* ------------------------------------------------------------------ */
  V.history = function (root) {
    setTitle('변경 이력', '저장할 때마다 기록이 남아요. 예전 상태로 되돌리고 싶으면 [이 시점 내용 불러오기] → 확인 → [저장].');
    var list = el('ul', { class: 'hist' }, el('li', {}, el('span', { class: 'muted small' }, '불러오는 중…')));
    root.appendChild(card(null, null, list));
    S.gh.commits(40).then(function (cs) { A.clear(list); cs.forEach(function (c) { list.appendChild(histItem(c, true)); }); })
      .catch(function (e) { A.clear(list); list.appendChild(el('li', {}, el('span', { class: 'note err' }, e.message))); });
  };
  async function restore(c) {
    if (A.isDirty() && !(await A.confirmBox('저장하지 않은 변경이 있어요', '불러오면 지금 화면의 변경은 사라져요. 계속할까요?', '불러오기', true))) return;
    try {
      var cm = await S.gh.commit(c.sha);
      var tree = await S.gh.tree(cm.tree.sha);
      var got = 0;
      for (var k in A.DATA) {
        var e = tree[A.DATA[k]];
        if (!e) continue;
        S.data[k] = JSON.parse(A.dec.decode(await S.gh.blob(e.sha)));
        got++;
      }
      if (!got) { A.toast('이 시점에는 관리자 데이터가 없어요 (관리자 페이지를 만들기 전 기록).', 'warn'); return; }
      A.changed('edit');
      A.toast(A.fmtTime(c.commit.author.date) + ' 시점 내용을 불러왔어요. 확인한 뒤 [저장하고 사이트에 반영]을 누르면 되돌려져요.', 'ok', 8000);
      go('dashboard');
    } catch (e) { A.toast(e.message, 'err'); }
  }

  /* ------------------------------------------------------------------ */
  /* 연결 · 백업                                                           */
  /* ------------------------------------------------------------------ */
  V.settings = function (root) {
    setTitle('연결 · 백업', '저장소 연결, 데이터 백업, 사이트 다시 만들기');
    var repoUrl = 'https://github.com/' + CFG.owner + '/' + CFG.repo;
    root.appendChild(card('연결 정보', null, el('div', { class: 'stack' },
      el('div', { class: 'grid-2' },
        el('div', {}, el('div', { class: 'small muted' }, '저장소'), el('a', { href: repoUrl, target: '_blank', rel: 'noopener', class: 'mono' }, CFG.owner + '/' + CFG.repo + ' ↗')),
        el('div', {}, el('div', { class: 'small muted' }, '연결된 GitHub 계정'), el('div', {}, S.user ? S.user.login : '확인 불가'))),
      el('div', { class: 'btn-row' },
        el('a', { class: 'b sm', href: 'https://github.com/settings/personal-access-tokens', target: '_blank', rel: 'noopener' }, '내 접근 키 관리 (GitHub) ↗'),
        el('button', {
          type: 'button', class: 'b sm danger', onclick: async function () {
            if (A.isDirty() && !(await A.confirmBox('저장하지 않은 변경이 있어요', '연결을 끊으면 변경이 사라져요.', '연결 끊기', true))) return;
            A.clearToken(); location.reload();
          }
        }, '이 기기에서 연결 끊기')),
      el('p', { class: 'small muted' }, '접근 키는 1년마다 만료돼요. 만료되면 연결 화면이 다시 나오니, 같은 방법으로 새 키를 만들어 넣으면 됩니다.'))));
    var file = el('input', { type: 'file', accept: 'application/json', hidden: true });
    file.addEventListener('change', async function () {
      var f = file.files[0]; file.value = '';
      if (!f) return;
      try {
        var j = JSON.parse(await f.text());
        var keys = Object.keys(A.DATA).filter(function (k) { return j[k]; });
        if (!keys.length) throw new Error('studioiyo 백업 파일이 아니에요.');
        if (!(await A.confirmBox('백업을 불러올까요?', keys.length + '개 항목(' + keys.join(', ') + ')을 백업 내용으로 바꿔요. 확인한 뒤 [저장]해야 사이트에 반영돼요.', '불러오기'))) return;
        keys.forEach(function (k) { S.data[k] = j[k]; });
        A.changed('edit'); A.toast('백업을 불러왔어요. 확인 후 저장하세요.', 'ok');
      } catch (e) { A.toast('불러오지 못했어요: ' + e.message, 'err'); }
    });
    root.appendChild(card('백업', '모든 문구·설정·게시글을 파일 하나로 내려받아요. 이미지는 포함되지 않아요(저장소에 그대로 있어요).', el('div', { class: 'btn-row' },
      el('button', {
        type: 'button', class: 'b', onclick: function () {
          var o = { exportedAt: new Date().toISOString(), site: CFG.siteUrl };
          Object.keys(A.DATA).forEach(function (k) { o[k] = S.data[k]; });
          var a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' })), download: 'studioiyo-backup-' + A.todayKST() + '.json' });
          document.body.appendChild(a); a.click(); a.remove();
        }
      }, '백업 내려받기'),
      el('button', { type: 'button', class: 'b', onclick: function () { file.click(); } }, '백업 불러오기'), file)));
    root.appendChild(card('사이트 다시 만들기', '사이트의 HTML 틀(admin/render.js)이나 스타일을 고친 뒤, 모든 페이지에 새 틀을 적용할 때 써요. 평소에는 누를 필요 없어요.', el('button', {
      type: 'button', class: 'b', disabled: A.isDirty(), title: A.isDirty() ? '먼저 변경을 저장하거나 취소하세요' : '', onclick: async function () {
        await A.save({ message: '관리자: 전체 페이지 다시 만들기' });
      }
    }, '전체 페이지 다시 만들기')));
    root.appendChild(card('알아 두면 좋은 것', null, el('ul', { class: 'stack small', style: { paddingLeft: '18px', margin: 0 } },
      el('li', {}, '관리자 페이지에서 저장하면 GitHub 저장소에 바로 기록돼요. 내 PC의 studioiyo-site 폴더를 직접 고치기 전에는 GitHub Desktop에서 먼저 ', el('b', {}, 'Fetch origin → Pull origin'), '을 눌러 최신으로 맞추세요.'),
      el('li', {}, 'index.html, 게시판 폴더, sitemap.xml 등은 저장할 때 자동으로 다시 만들어져요. 이 파일들을 직접 고치면 다음 저장 때 덮어써져요. 문구는 관리자에서, 틀은 admin/render.js에서 고치세요.'),
      el('li', {}, '저장소는 공개라서 data 폴더의 내용(임시저장 글 포함)은 누구나 볼 수 있어요. 비밀 내용은 넣지 마세요.'),
      el('li', {}, '공용 PC에서 썼다면 [이 기기에서 연결 끊기]를 눌러 주세요.'))));
  };

  /* ------------------------------------------------------------------ */
  /* 로그인 (접근 키 연결)                                                  */
  /* ------------------------------------------------------------------ */
  function loginView(errMsg) {
    A.clear(app); app.className = ''; shell = null;
    var inp = el('input', { class: 'in mono', type: 'password', placeholder: 'github_pat_…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'GitHub 접근 키' });
    var showBtn = el('button', { type: 'button', class: 'b sm ghost', onclick: function () { inp.type = inp.type === 'password' ? 'text' : 'password'; showBtn.textContent = inp.type === 'password' ? '보기' : '숨기기'; } }, '보기');
    var remember = el('input', { type: 'checkbox', checked: true });
    var err = el('div', { class: 'note err', hidden: !errMsg }, errMsg || '');
    var btn = el('button', { type: 'submit', class: 'b primary lg' }, '연결하기');
    var f = el('form', { class: 'stack', onsubmit: async function (e) {
      e.preventDefault();
      var t = inp.value.trim();
      if (!t) { err.hidden = false; err.textContent = '접근 키를 붙여 넣어 주세요.'; return; }
      btn.disabled = true; btn.textContent = '연결 중…'; err.hidden = true;
      try {
        await A.connect(t);
        A.setToken(t, remember.checked);
        start();
      } catch (e2) {
        err.hidden = false; err.textContent = e2.message || String(e2);
        btn.disabled = false; btn.textContent = '연결하기';
      }
    } },
      el('div', { class: 'field' }, el('label', {}, '접근 키 붙여 넣기'), el('div', { class: 'btn-row', style: { flexWrap: 'nowrap' } }, inp, showBtn)),
      el('label', { class: 'switch' }, remember, el('span', { class: 'track' }), el('span', {}, '이 기기에서 기억하기 (공용 PC면 끄세요)')),
      err, btn);
    app.appendChild(el('div', { class: 'login' }, el('div', { class: 'login-card' },
      el('div', { class: 'brand-mark' }, 'Studio iyo', el('small', {}, '홈페이지 관리자')),
      el('p', {}, '처음 한 번, GitHub에서 ', el('b', {}, '접근 키'), '를 만들어 연결해요. 이 키는 이 브라우저에만 저장되고, studioiyo-site 저장소만 고칠 수 있어요.'),
      el('ol', { class: 'steps-guide' },
        el('li', {}, el('div', {}, el('b', {}, '키 만들기 화면 열기'), ' — 이름·권한이 미리 채워져 있어요. (GitHub 로그인 필요)', el('div', { style: { marginTop: '8px' } }, el('a', { class: 'b sm dark', href: TOKEN_URL, target: '_blank', rel: 'noopener' }, 'GitHub 키 만들기 화면 열기 ↗')))),
        el('li', {}, el('div', {}, el('b', {}, 'Repository access'), '에서 ', el('span', { class: 'kbd' }, 'Only select repositories'), ' → ', el('span', { class: 'kbd' }, CFG.repo), ' 선택. Permissions에 ', el('span', { class: 'kbd' }, 'Contents: Read and write'), ', ', el('span', { class: 'kbd' }, 'Pages: Read-only'), '가 있는지 확인.')),
        el('li', {}, el('div', {}, '맨 아래 ', el('b', {}, 'Generate token'), ' → 나온 키(github_pat_로 시작)를 복사해 아래에 붙여 넣기. 키는 이때 한 번만 보여요.'))),
      f)));
    setTimeout(function () { inp.focus(); }, 50);
  }

  /* ------------------------------------------------------------------ */
  /* 시작                                                                 */
  /* ------------------------------------------------------------------ */
  function start() {
    buildShell();
    if (!location.hash || location.hash === '#' || location.hash === '#/') location.replace('#/dashboard');
    route();
  }
  window.addEventListener('hashchange', function () { if (shell) route(); });
  window.addEventListener('beforeunload', function (e) { if (shell && A.isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && shell) { e.preventDefault(); if (A.isDirty()) doSave(); else A.toast('저장할 변경이 없어요.'); }
  });

  async function boot() {
    if (!window.crypto || !crypto.subtle) { A.clear(app); app.appendChild(el('div', { class: 'login' }, el('div', { class: 'note err' }, '이 브라우저에서는 관리자 페이지를 쓸 수 없어요. https 주소로 열었는지 확인하거나 최신 Chrome·Edge·Safari를 써 주세요.'))); return; }
    var t = A.getToken();
    if (!t) return loginView();
    try { await A.connect(t); start(); }
    catch (e) {
      if (e.status === 401) { A.clearToken(); loginView('저장된 접근 키가 만료됐거나 취소됐어요. 새 키를 만들어 연결해 주세요.'); }
      else if (e.code === 'NO_DATA') { A.clear(app); app.appendChild(el('div', { class: 'login' }, el('div', { class: 'login-card' }, el('h2', {}, '아직 준비가 안 됐어요'), el('p', {}, e.message), el('p', { class: 'muted small' }, '관리자 기능용 파일을 저장소에 올린(Push) 뒤 다시 열어 주세요.')))); }
      else loginView(e.message);
    }
  }
  A.views = V; A.route = route; A.go = go;
  boot();
})();
