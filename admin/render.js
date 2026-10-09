/*!
 * studioiyo site renderer
 * data/*.json  ->  정적 HTML 파일들 (index.html, 게시판, 게시글, 추가 페이지, sitemap, robots, 404)
 *
 * 관리자 페이지(admin)가 저장할 때 이 파일로 사이트 전체 HTML을 다시 만들어 GitHub에 올립니다.
 * 디자인 구조(HTML 틀)를 바꾸려면 이 파일의 템플릿 함수를 고치면 됩니다.
 * 브라우저와 Node 양쪽에서 동작합니다 (Node: require('./render.js')).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IYORender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 기본 도구                                                            */
  /* ------------------------------------------------------------------ */
  var RESERVED = ['admin', 'assets', 'data', '404', 'index', 'sitemap', 'robots', 'api', 'cname'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escNl(s) { return esc(s).replace(/\r?\n/g, '<br>'); }
  function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  function ko(o) { return o == null ? '' : (typeof o === 'string' ? o : (o.ko || o.en || '')); }
  function en(o) { return o == null ? '' : (typeof o === 'string' ? o : (o.en || o.ko || '')); }
  function has(o) { return !!(ko(o) || en(o)); }

  /**
   * 한/영 텍스트 출력. 영어가 비어 있거나 한국어와 같으면 한 번만 출력합니다.
   * tag: 감쌀 태그(기본 span), cls: 공통 클래스, lc: 언어별 추가 클래스 {ko:'ko-d', en:'en-d'}, nl: 줄바꿈 → <br>
   */
  function T(o, opt) {
    opt = opt || {};
    var tag = opt.tag || 'span';
    var f = opt.nl ? escNl : esc;
    if (o == null) return '';
    if (typeof o === 'string') o = { ko: o, en: '' };
    var k = o.ko || '', e = o.en || '';
    var lc = opt.lc || {};
    var cls = function (lang) {
      var c = [];
      if (lang) c.push(lang);
      if (opt.cls) c.push(opt.cls);
      if (lang && lc[lang]) c.push(lc[lang]);
      if (!lang && lc[k ? 'ko' : 'en']) c.push(lc[k ? 'ko' : 'en']);
      return c.length ? ' class="' + c.join(' ') + '"' : '';
    };
    if (!e || e === k || !k) {
      var one = k || e;
      if (!one) return '';
      if (!opt.cls && !opt.forceTag && !(lc.ko || lc.en)) return f(one);
      return '<' + tag + cls('') + '>' + f(one) + '</' + tag + '>';
    }
    return '<' + tag + cls('ko') + '>' + f(k) + '</' + tag + '><' + tag + cls('en') + '>' + f(e) + '</' + tag + '>';
  }

  /** 링크 주소 정리: http(s), mailto, tel, /경로, #앵커만 허용 */
  function safeUrl(u) {
    u = String(u == null ? '' : u).trim();
    if (!u) return '';
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    if (/^[\/#?]/.test(u)) return u;
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return 'https://' + u; // studioiyo.com 처럼 입력한 경우
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ''; // javascript: 등 차단
    return '/' + u.replace(/^\.?\//, '');
  }
  /** 홈 화면에서는 '/#about' → '#about' (페이지 이동 없이 스크롤) */
  function link(u, isHome) {
    u = safeUrl(u);
    if (isHome && u.indexOf('/#') === 0) return u.slice(1);
    return u;
  }
  function ext(u) { return /^https?:/i.test(u) ? ' target="_blank" rel="noopener"' : ''; }
  function asset(p) {
    p = String(p || '').trim();
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    return '/' + p.replace(/^\.?\//, '');
  }
  function absUrl(site, p) {
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    return String(site.siteUrl || '').replace(/\/$/, '') + (p.charAt(0) === '/' ? p : '/' + p);
  }
  function hexOk(c) { return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(c || '')); }
  function luminance(hex) {
    if (!hexOk(hex)) return 1;
    var h = hex.slice(1);
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    var rgb = [0, 2, 4].map(function (i) {
      var v = parseInt(h.substr(i, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }
  function num(v, d, min, max) {
    var n = parseFloat(v);
    if (!isFinite(n)) n = d;
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    return n;
  }
  function fmtDate(d) { return String(d || '').slice(0, 10).replace(/-/g, '.'); }
  function slugOk(s) { return /^[a-z0-9][a-z0-9-]{0,60}$/.test(String(s || '')); }
  function jsonScript(o) { return JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026'); }
  function stripMd(s) {
    return String(s || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '').replace(/^\s*([-*_])(\s*\1){2,}\s*$/gm, '')
      .replace(/[*_~`]+/g, '').replace(/\s+/g, ' ').trim();
  }

  /* ------------------------------------------------------------------ */
  /* 마크다운 (게시글·페이지 본문). HTML 태그는 그대로 글자로 보입니다(안전). */
  /* ------------------------------------------------------------------ */
  function mdInline(text) {
    var keep = [];
    var hold = function (html) { keep.push(html); return '\u0000' + (keep.length - 1) + '\u0000'; };
    var s = String(text);
    s = s.replace(/`([^`]+)`/g, function (_, c) { return hold('<code>' + esc(c) + '</code>'); });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (_, alt, src) {
      var u = safeUrl(src);
      return u ? hold('<img src="' + esc(u) + '" alt="' + esc(alt) + '" loading="lazy">') : '';
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, href) {
      var u = safeUrl(href);
      if (!u) return esc(label);
      return hold('<a href="' + esc(u) + '"' + ext(u) + '>' + mdInlineSimple(label) + '</a>');
    });
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (_, pre, u) {
      return pre + hold('<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u) + '</a>');
    });
    s = mdInlineSimple(s);
    return s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return keep[+i]; });
  }
  function mdInlineSimple(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  }
  function md(src) {
    var lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    var out = [], para = [], list = null, quote = [];
    function flushPara() {
      if (para.length) { out.push('<p>' + para.map(mdInline).join('<br>') + '</p>'); para = []; }
    }
    function flushList() {
      if (list) { out.push('<' + list.tag + '>' + list.items.map(function (i) { return '<li>' + mdInline(i) + '</li>'; }).join('') + '</' + list.tag + '>'); list = null; }
    }
    function flushQuote() {
      if (quote.length) { out.push('<blockquote>' + md(quote.join('\n')) + '</blockquote>'); quote = []; }
    }
    function flushAll() { flushPara(); flushList(); flushQuote(); }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i], m;
      if (/^\s*>\s?/.test(line)) { flushPara(); flushList(); quote.push(line.replace(/^\s*>\s?/, '')); continue; }
      else if (quote.length) flushQuote();
      if (!line.trim()) { flushPara(); flushList(); continue; }
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
        flushAll();
        var lvl = m[1].length + 1;
        out.push('<h' + lvl + '>' + mdInline(m[2].trim()) + '</h' + lvl + '>');
        continue;
      }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushAll(); out.push('<hr>'); continue; }
      if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
        flushPara();
        if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; }
        list.items.push(m[1]); continue;
      }
      if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        flushPara();
        if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; }
        list.items.push(m[1]); continue;
      }
      if (list && /^\s{2,}\S/.test(line)) { list.items[list.items.length - 1] += ' ' + line.trim(); continue; }
      flushList();
      para.push(line);
    }
    flushAll();
    return out.join('\n');
  }

  /* ------------------------------------------------------------------ */
  /* 테마 (색·글꼴·크기)                                                   */
  /* ------------------------------------------------------------------ */
  var COLOR_KEYS = ['sand', 'paper', 'ink', 'ink_soft', 'coral', 'coral_line', 'card', 'slate', 'lavender', 'butter', 'sky', 'peach', 'seaglass', 'lilac', 'deep'];
  var DEFAULT_COLORS = {
    sand: '#F4ECDC', paper: '#FBF7EF', ink: '#2A2420', ink_soft: '#6E625A', coral: '#C8533D', coral_line: '#D98A77',
    card: '#8194B1', slate: '#34445F', lavender: '#C9BCE8', butter: '#F3CC7E', sky: '#BCDDEA', peach: '#F5C9A3',
    seaglass: '#CFE2CF', lilac: '#DDB9D7', deep: '#17324A'
  };
  /* Google Fonts 목록. spec = fonts.googleapis.com/css2 의 family 값 */
  var FONTS = {
    'League Spartan': { spec: 'League+Spartan:wght@400..800', group: 'en' },
    'Montserrat': { spec: 'Montserrat:wght@400..800', group: 'en' },
    'Poppins': { spec: 'Poppins:wght@400;500;600;700', group: 'en' },
    'DM Sans': { spec: 'DM+Sans:wght@400..700', group: 'en' },
    'Outfit': { spec: 'Outfit:wght@400..700', group: 'en' },
    'Fraunces': { spec: 'Fraunces:wght@400..700', group: 'en' },
    'Noto Sans KR': { spec: 'Noto+Sans+KR:wght@400;500;700', group: 'ko' },
    'Sunflower': { spec: 'Sunflower:wght@300;500;700', group: 'ko' },
    'Gothic A1': { spec: 'Gothic+A1:wght@400;500;700', group: 'ko' },
    'IBM Plex Sans KR': { spec: 'IBM+Plex+Sans+KR:wght@400;500;700', group: 'ko' },
    'Nanum Gothic': { spec: 'Nanum+Gothic:wght@400;700;800', group: 'ko' },
    'Nanum Myeongjo': { spec: 'Nanum+Myeongjo:wght@400;700;800', group: 'ko' },
    'Noto Serif KR': { spec: 'Noto+Serif+KR:wght@400;500;700', group: 'ko' },
    'Gowun Dodum': { spec: 'Gowun+Dodum', group: 'ko' },
    'Gowun Batang': { spec: 'Gowun+Batang:wght@400;700', group: 'ko' },
    'Jua': { spec: 'Jua', group: 'ko' },
    'Do Hyeon': { spec: 'Do+Hyeon', group: 'ko' },
    'Black Han Sans': { spec: 'Black+Han+Sans', group: 'ko' },
    'Dongle': { spec: 'Dongle:wght@300;400;700', group: 'ko' },
    'Gaegu': { spec: 'Gaegu:wght@300;400;700', group: 'ko' },
    'Nanum Pen Script': { spec: 'Nanum+Pen+Script', group: 'ko' }
  };
  function fontName(n, d) { return FONTS[n] ? n : d; }

  function themeCss(theme) {
    theme = theme || {};
    var c = theme.colors || {}, f = theme.fonts || {}, z = theme.size || {};
    var v = [];
    COLOR_KEYS.forEach(function (k) {
      var val = hexOk(c[k]) ? c[k] : DEFAULT_COLORS[k];
      v.push('--' + k.replace(/_/g, '-') + ':' + val);
    });
    var fe = fontName(f.en, 'League Spartan'), fk = fontName(f.ko, 'Sunflower'), fb = fontName(f.body, 'Noto Sans KR');
    v.push('--f-en:"' + fe + '","Noto Sans KR",system-ui,sans-serif');
    v.push('--f-ko:"' + fk + '","Noto Sans KR","Apple SD Gothic Neo",sans-serif');
    v.push('--f-body:"' + fb + '","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif');
    var base = num(z.base, 16, 13, 22);
    v.push('--k:' + +(base / 16).toFixed(4));
    v.push('--hs:' + num(z.heading, 1, 0.7, 1.5));
    v.push('--gk:' + num(z.gap, 1, 0.5, 1.6));
    v.push('--maxw:' + Math.round(num(z.maxWidth, 1280, 960, 1600)) + 'px');
    v.push('--r-lg:' + Math.round(num(z.radius, 26, 0, 48)) + 'px');
    v.push('--r-md:' + Math.round(num(z.radiusSm, 18, 0, 36)) + 'px');
    return ':root{' + v.join(';') + '}';
  }
  function fontsHref(theme) {
    var f = (theme && theme.fonts) || {};
    var names = [fontName(f.en, 'League Spartan'), 'Noto Sans KR', fontName(f.ko, 'Sunflower'), fontName(f.body, 'Noto Sans KR')];
    var seen = {}, fam = [];
    names.forEach(function (n) { if (!seen[n]) { seen[n] = 1; fam.push('family=' + FONTS[n].spec); } });
    return 'https://fonts.googleapis.com/css2?' + fam.join('&') + '&display=swap';
  }

  /* ------------------------------------------------------------------ */
  /* 공통 틀: head, 공지 배너, 헤더, 푸터                                    */
  /* ------------------------------------------------------------------ */
  function logoSvg() {
    return '<svg class="logo-svg" viewBox="0 0 574 350" role="img" aria-label="Studio iyo"><use href="#iyo-logo"/></svg>';
  }

  function head(D, ctx, p) {
    var site = D.site, seo = site.seo || {};
    var title = p.isHome ? (seo.title || site.siteName) : (p.title + ' | ' + (site.siteName || seo.title));
    var desc = p.description || seo.description || '';
    var ogDesc = p.isHome ? (seo.ogDescription || desc) : desc;
    var url = absUrl(site, p.path);
    var img = absUrl(site, asset(p.image || seo.ogImage || ''));
    var h = [];
    h.push('<meta charset="utf-8">');
    h.push('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
    h.push('<title>' + esc(title) + '</title>');
    h.push('<script>(function(){var r=document.documentElement,s=null,d=r.getAttribute("data-default-lang");try{s=localStorage.getItem("iyo-lang")}catch(e){}r.lang=r.dataset.lang=(s==="ko"||s==="en")?s:(d==="ko"||d==="en")?d:((navigator.language||"ko").toLowerCase().indexOf("ko")===0?"ko":"en")})()</script>');
    if (desc) h.push('<meta name="description" content="' + esc(desc) + '">');
    if (seo.indexable === false || p.noindex) h.push('<meta name="robots" content="noindex, nofollow">');
    if (url && !p.noindex) h.push('<link rel="canonical" href="' + esc(url) + '">');
    h.push('<meta property="og:title" content="' + esc(p.isHome ? (seo.title || site.siteName) : p.title) + '">');
    if (ogDesc) h.push('<meta property="og:description" content="' + esc(ogDesc) + '">');
    if (url) h.push('<meta property="og:url" content="' + esc(url) + '">');
    h.push('<meta property="og:type" content="' + (p.ogType || 'website') + '">');
    h.push('<meta property="og:site_name" content="' + esc(site.siteName || '') + '">');
    if (img) { h.push('<meta property="og:image" content="' + esc(img) + '">'); h.push('<meta name="twitter:card" content="summary_large_image">'); }
    if (seo.naverVerification) h.push('<meta name="naver-site-verification" content="' + esc(seo.naverVerification) + '">');
    if (seo.googleVerification) h.push('<meta name="google-site-verification" content="' + esc(seo.googleVerification) + '">');
    h.push('<link rel="icon" type="image/png" href="/assets/favicon.png">');
    h.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
    h.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
    h.push('<link rel="stylesheet" href="' + esc(fontsHref(D.theme)) + '">');
    h.push('<link rel="stylesheet" href="/assets/css/site.css' + (ctx.versions && ctx.versions.css ? '?v=' + ctx.versions.css : '') + '">');
    h.push('<style id="theme">' + themeCss(D.theme) + '</style>');
    if (p.isHome) {
      var org = {
        '@context': 'https://schema.org', '@type': 'Organization', name: site.siteName, url: site.siteUrl,
        logo: absUrl(site, '/assets/favicon.png')
      };
      if (site.contact && site.contact.email) org.email = site.contact.email;
      if (site.contact && site.contact.instagram) org.sameAs = ['https://www.instagram.com/' + site.contact.instagram + '/'];
      h.push('<script type="application/ld+json">' + jsonScript(org) + '</script>');
    }
    var an = site.analytics || {};
    if (/^G-[A-Z0-9]{4,20}$/i.test(an.ga4 || '')) {
      h.push('<script async src="https://www.googletagmanager.com/gtag/js?id=' + an.ga4 + '"></script>');
      h.push('<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","' + an.ga4 + '");</script>');
    }
    if (/^[a-z0-9]{6,40}$/i.test(an.naver || '')) {
      h.push('<script src="https://wcs.naver.net/wcslog.js"></script>');
      h.push('<script>if(!window.wcs_add)window.wcs_add={};wcs_add["wa"]="' + an.naver + '";if(window.wcs){wcs_do();}</script>');
    }
    if (site.customHead && String(site.customHead).trim()) h.push('<!-- custom head (admin) -->\n' + String(site.customHead).trim());
    return h.join('\n');
  }

  function banner(D) {
    var b = D.site.banner || {};
    if (!b.enabled || !has(b.text)) return '';
    var tone = ['coral', 'deep', 'butter', 'slate', 'card'].indexOf(b.tone) >= 0 ? b.tone : 'coral';
    var dated = !!(b.start || b.end);
    var u = safeUrl(b.link);
    var key = (ko(b.text) + '|' + (b.start || '') + '|' + (b.end || '')).length + '-' + hash(ko(b.text) + en(b.text));
    var s = '<div class="notice-bar tone-' + tone + '" id="notice-bar" data-key="' + key + '"' +
      (b.start ? ' data-start="' + esc(b.start) + '"' : '') + (b.end ? ' data-end="' + esc(b.end) + '"' : '') +
      (dated ? ' hidden' : '') + ' role="region" aria-label="Notice">';
    s += '<p>' + T(b.text) + (u ? ' <a href="' + esc(u) + '"' + ext(u) + '>' + T(b.linkLabel || { ko: '자세히 보기', en: 'Details' }) + ' →</a>' : '') + '</p>';
    if (b.closable !== false) s += '<button type="button" class="notice-x" aria-label="Close">×</button>';
    return s + '</div>';
  }
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  function header(D, isHome) {
    var m = D.site.menu || {};
    var nav = (m.header || []).filter(function (i) { return has(i.label) && i.href; }).map(function (i) {
      var u = link(i.href, isHome);
      return '      <a href="' + esc(u) + '"' + ext(u) + '>' + T(i.label, { forceTag: true, cls: '' }) + '</a>';
    });
    var cta = m.cta && has(m.cta.label) && m.cta.href ? m.cta : null;
    var s = '  <header class="top">\n';
    s += '    <a class="logo" href="' + (isHome ? '#top' : '/') + '" aria-label="Studio iyo">' + logoSvg() + '</a>\n';
    s += '    <nav class="nav" aria-label="Main">\n' + nav.join('\n') + '\n    </nav>\n';
    s += '    <div class="top-right">\n';
    s += '      <div class="lang" role="group" aria-label="Language">\n';
    s += '        <button type="button" id="lang-ko" data-set-lang="ko" aria-pressed="true">KO</button>\n';
    s += '        <button type="button" id="lang-en" data-set-lang="en" aria-pressed="false">EN</button>\n';
    s += '      </div>\n';
    if (cta) { var cu = link(cta.href, isHome); s += '      <a class="btn sm" href="' + esc(cu) + '"' + ext(cu) + '>' + T(cta.label) + '</a>\n'; }
    s += '    </div>\n  </header>';
    return s;
  }

  function footer(D, isHome) {
    var site = D.site, m = site.menu || {}, st = site.store || {}, co = site.company || {}, ct = site.contact || {};
    var f = site.footer || {};
    var s = '  <footer class="foot" aria-label="Footer">\n';
    if (f.lampImage) s += '    <div class="lamp" aria-hidden="true"><img src="' + esc(asset(f.lampImage)) + '" alt=""></div>\n';
    s += '    <div>\n      <div class="foot-word">' + logoSvg() + '</div>\n';
    if (has(f.line)) s += '      <p class="foot-line">' + T(f.line, { forceTag: true }) + '</p>\n';
    s += '    </div>\n    <div class="foot-grid">\n';
    // Menu
    s += '      <div>\n        <h3>Menu</h3>\n        <ul>\n';
    (m.footer || []).forEach(function (i) {
      if (!has(i.label) || !i.href) return;
      var u = link(i.href, isHome);
      s += '          <li><a href="' + esc(u) + '"' + ext(u) + '>' + T(i.label) + '</a></li>\n';
    });
    s += '        </ul>\n      </div>\n';
    // Visit
    s += '      <div>\n        <h3>Visit</h3>\n        <ul>\n';
    if (has(st.name)) s += '          <li>' + T(st.name) + '</li>\n';
    if (has(st.addressFull || st.address)) s += '          <li>' + T(st.addressFull || st.address) + '</li>\n';
    if (st.hours) s += '          <li>' + T({ ko: '운영 ' + st.hours, en: 'Open ' + st.hours }) + '</li>\n';
    if (has(st.closed)) s += '          <li>' + T({ ko: '휴무 ' + ko(st.closed), en: 'Closed ' + en(st.closed) }) + '</li>\n';
    if (ct.email) s += '          <li>' + esc(ct.email) + '</li>\n';
    if (ct.instagram) s += '          <li><a href="https://www.instagram.com/' + esc(ct.instagram) + '/" target="_blank" rel="noopener">Instagram @' + esc(ct.instagram) + '</a></li>\n';
    s += '        </ul>\n      </div>\n';
    // Company
    s += '      <div>\n        <h3>Company</h3>\n        <ul>\n';
    var kv = function (k, v) { return '          <li><span class="k">' + T(k) + '</span>' + v + '</li>\n'; };
    if (has(co.name)) s += kv({ ko: '상호', en: 'Company' }, T(co.name, { forceTag: true }));
    if (co.ceo) s += kv({ ko: '대표', en: 'CEO' }, esc(co.ceo));
    if (co.bizNo) s += kv({ ko: '사업자등록번호', en: 'Business reg. no.' }, esc(co.bizNo));
    if (has(co.address)) s += kv({ ko: '주소', en: 'Address' }, T(co.address, { forceTag: true }));
    s += '        </ul>\n      </div>\n    </div>\n';
    s += '    <div class="foot-bottom">\n      <span>' + esc(co.copyright || '') + '</span>\n      <span>' + esc(co.slogan || '') + '</span>\n    </div>\n';
    s += '  </footer>';
    return s;
  }

  function layout(D, ctx, p, mainHtml, tail) {
    var s = '<!doctype html>\n<html lang="ko" data-lang="ko" data-default-lang="' + esc(D.site.defaultLang || 'auto') + '">\n<head>\n';
    s += head(D, ctx, p) + '\n</head>\n<body' + (p.bodyClass ? ' class="' + p.bodyClass + '"' : '') + '>\n';
    s += banner(D) + '\n';
    s += '<div class="frame">\n';
    s += '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + String(ctx.logoSymbol || '').trim() + '</svg>\n\n';
    s += header(D, p.isHome) + '\n\n';
    s += '  <main id="top"' + (p.isHome ? '' : ' class="sub"') + '>\n' + mainHtml + '\n  </main>\n\n';
    s += footer(D, p.isHome) + '\n</div>\n';
    if (tail) s += tail + '\n';
    s += '<script src="/assets/js/site.js' + (ctx.versions && ctx.versions.js ? '?v=' + ctx.versions.js : '') + '" defer></script>\n';
    s += '</body>\n</html>\n';
    return s;
  }

  function eyebrow(pill, label) {
    return '<p class="eyebrow">' + (pill ? '<span class="pill">' + esc(pill) + '</span>' : '') + (has(label) ? '<b>' + T(label, { forceTag: true }) + '</b>' : '') + '</p>';
  }
  function bgStyle(sec, D) {
    var key = sec && sec.bg;
    if (!key || COLOR_KEYS.indexOf(key) < 0) return '';
    var col = (D.theme.colors || {})[key] || DEFAULT_COLORS[key];
    var dark = luminance(col) < 0.2;
    return ' style="background:var(--' + key.replace(/_/g, '-') + ');color:var(--' + (dark ? 'paper' : 'ink') + ')"';
  }

  /* ------------------------------------------------------------------ */
  /* 홈 화면 섹션                                                          */
  /* ------------------------------------------------------------------ */
  var SECTIONS = {};

  SECTIONS.hero = function (D, sec) {
    var h = D.home.hero || {}, chars = D.characters;
    var s = '    <section class="hero" aria-labelledby="hero-title"' + bgStyle(sec, D) + '>\n';
    s += '      <div class="hero-meta label">\n' + (h.meta || []).filter(Boolean).map(function (m) { return '        <span>' + esc(m) + '</span>'; }).join('\n') + '\n      </div>\n';
    s += '      <h1 id="hero-title" class="hero-logo">' + logoSvg() + '</h1>\n';
    if (h.showCutouts !== false) {
      s += '      <div class="cutouts" aria-hidden="true">\n' +
        '        <img src="/assets/brand/fish.png" alt="" style="--h:clamp(30px,4vw,48px)">\n' +
        '        <img src="/assets/brand/jelly.png" alt="" style="--h:clamp(38px,5vw,60px)">\n' +
        '        <img src="/assets/brand/urchin.png" alt="" style="--h:clamp(34px,4.6vw,54px)">\n      </div>\n';
    }
    if (has(h.tagline)) s += '      <p class="hero-tag">\n        ' + T(h.tagline, { nl: true, lc: { ko: 'ko-d', en: 'en-d' } }) + '\n      </p>\n';
    var btns = (h.buttons || []).filter(function (b) { return has(b.label) && b.href; });
    if (btns.length) {
      s += '      <div class="hero-cta">\n' + btns.map(function (b) {
        var u = link(b.href, true);
        return '        <a class="btn' + (b.style === 'ghost' ? ' ghost' : '') + '" href="' + esc(u) + '"' + ext(u) + '>' + T(b.label, { forceTag: true }) + (b.arrow ? ' →' : '') + '</a>';
      }).join('\n') + '\n      </div>\n';
    }
    s += '      <div class="beach" aria-hidden="true">\n' +
      '        <svg viewBox="0 0 1200 46" preserveAspectRatio="none">\n' +
      '          <path d="M0 26 C 60 10, 120 10, 180 24 S 300 40, 360 24 S 480 6, 540 22 S 660 42, 720 26 S 840 8, 900 22 S 1020 40, 1080 24 S 1170 12, 1200 20 L1200 46 L0 46 Z" style="fill:var(--sand)"/>\n' +
      '          <path d="M0 26 C 60 10, 120 10, 180 24 S 300 40, 360 24 S 480 6, 540 22 S 660 42, 720 26 S 840 8, 900 22 S 1020 40, 1080 24 S 1170 12, 1200 20" fill="none" style="stroke:var(--ink)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>\n' +
      '        </svg>\n        <div class="sand-band"></div>\n';
    if (h.showParade !== false && chars.length) {
      var imgs = '';
      for (var k = 0; k < 2; k++) chars.forEach(function (c) { imgs += '<img src="' + esc(asset(c.image)) + '" alt=""' + (c.wide ? ' class="wide"' : '') + '>'; });
      s += '        <div class="parade"><div class="parade-track" id="parade">' + imgs + '</div></div>\n';
    }
    s += '      </div>\n    </section>';
    return s;
  };

  SECTIONS.about = function (D, sec) {
    var a = D.home.about || {};
    var s = '    <section class="about" id="about" aria-labelledby="about-title"' + bgStyle(sec, D) + '>\n      <div>\n';
    s += '        ' + eyebrow(a.pill, a.eyebrow) + '\n';
    s += '        <h2 id="about-title">\n          ' + T(a.title, { nl: true, lc: { ko: 'ko-d', en: 'en-d' } }) + '\n        </h2>\n';
    if (has(a.lead)) s += '        <p class="about-lead">\n          ' + T(a.lead, { nl: true, forceTag: true }) + '\n        </p>\n';
    var iyo = (a.iyo || []).filter(function (i) { return i.key || has(i.text); });
    if (iyo.length) s += '        <ol class="iyo">\n' + iyo.map(function (i) { return '          <li><b>' + esc(i.key) + '</b><span>' + T(i.text, { forceTag: true }) + '</span></li>'; }).join('\n') + '\n        </ol>\n';
    s += '      </div>\n      <div class="about-side">\n';
    var facts = (a.facts || []).filter(function (f) { return has(f.k) || has(f.v); });
    if (facts.length) {
      s += '        <h3>' + esc(a.factsTitle || 'Company') + '</h3>\n        <ul class="facts">\n';
      s += facts.map(function (f) { return '          <li><span class="k">' + T(f.k) + '</span><span>' + T(f.v) + '</span></li>'; }).join('\n') + '\n        </ul>\n';
    }
    var ms = (a.milestones || []).filter(has);
    if (ms.length) {
      s += '        <h3>' + esc(a.milestonesTitle || 'Milestones') + '</h3>\n        <ul class="facts plain">\n';
      s += ms.map(function (m) { return '          <li><span>' + T(m) + '</span></li>'; }).join('\n') + '\n        </ul>\n';
    }
    s += '      </div>\n    </section>';
    return s;
  };

  SECTIONS.characters = function (D, sec) {
    var c = D.home.characters || {}, chars = D.characters;
    var s = '    <section id="nine" aria-labelledby="nine-title"' + bgStyle(sec, D) + '>\n      <div class="sec-head">\n        <div>\n';
    s += '          ' + eyebrow(c.pill, c.eyebrow) + '\n';
    s += '          <h2 id="nine-title">' + T(c.title, { lc: { ko: 'ko-d', en: 'en-d' } }) + '</h2>\n        </div>\n';
    s += '        <div style="display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap">\n';
    s += '          <p>' + T(c.desc, { forceTag: true }) + '</p>\n';
    s += '          <div class="arrows">\n            <button class="arrow" type="button" id="cast-prev" aria-label="Previous">←</button>\n            <button class="arrow" type="button" id="cast-next" aria-label="Next">→</button>\n          </div>\n';
    s += '        </div>\n      </div>\n';
    s += '      <div class="cast" id="cast" tabindex="0" aria-label="Characters">\n';
    s += chars.map(function (ch) {
      var tint = hexOk(ch.tint) ? ch.tint : '#F0E9D0';
      return '        <article class="card" style="--tint:' + tint + '">' +
        '<div class="card-img"><img src="' + esc(asset(ch.image)) + '" alt="' + esc(ko(ch.name) + ' · ' + ko(ch.type)) + '" loading="lazy"></div>' +
        '<div class="card-title"><strong class="ko">' + esc(ko(ch.name)) + '</strong><strong class="en">' + esc(en(ch.name)) + '</strong>' +
        '<small class="ko">' + esc(en(ch.name)) + '</small><small class="en">' + esc(en(ch.species)) + '</small></div>' +
        '<span class="card-type">' + T(ch.type, { forceTag: true }) + '</span>' +
        '<p>' + T(ch.line, { forceTag: true }) + '</p></article>';
    }).join('\n') + '\n      </div>\n';
    s += '      <div class="progress" aria-hidden="true"><span id="cast-progress"></span></div>\n    </section>';
    return s;
  };

  SECTIONS.visit = function (D, sec) {
    var v = D.home.visit || {}, st = D.site.store || {}, chars = D.characters;
    var s = '    <section class="brand" id="visit" aria-labelledby="visit-title"' + bgStyle(sec, D) + '>\n      <div class="brand-copy">\n        <div>\n';
    s += '          ' + eyebrow(v.pill, v.eyebrow) + '\n';
    s += '          <h2 id="visit-title">' + T(st.name, { lc: { ko: 'ko-d', en: 'en-d' } }) + '</h2>\n';
    if (has(v.story)) s += '          ' + T(v.story, { tag: 'p', nl: true, forceTag: true }) + '\n';
    s += '        </div>\n';
    var steps = (v.steps || []).filter(has);
    if (steps.length) s += '        <ol class="steps">\n' + steps.map(function (x) { return '          <li>' + T(x, { forceTag: true }) + '</li>'; }).join('\n') + '\n        </ol>\n';
    s += '        <div class="visit">\n';
    if (has(st.address)) s += '          <strong>' + T(st.address, { forceTag: true }) + '</strong>\n';
    if (has(st.note)) s += '          <small>' + T(st.note, { forceTag: true }) + '</small>\n';
    s += '          <dl>\n';
    if (st.hours) s += '            <dt>' + T({ ko: '운영 시간', en: 'Hours' }) + '</dt><dd>' + esc(st.hours) + '</dd>\n';
    if (has(st.closed)) s += '            <dt>' + T({ ko: '휴무일', en: 'Closed' }) + '</dt><dd>' + T(st.closed, { forceTag: true }) + '</dd>\n';
    if (has(st.price)) s += '            <dt>' + T({ ko: '체험 요금', en: 'Programs' }) + '</dt><dd>' + T(st.price, { forceTag: true }) + '</dd>\n';
    s += '          </dl>\n';
    var maps = [];
    if (st.naverMap) maps.push('            <a class="btn sm" href="' + esc(safeUrl(st.naverMap)) + '" target="_blank" rel="noopener">' + T({ ko: '네이버 지도', en: 'Naver Map' }) + '</a>');
    if (st.googleMap) maps.push('            <a class="btn sm ghost" href="' + esc(safeUrl(st.googleMap)) + '" target="_blank" rel="noopener">Google Maps</a>');
    if (maps.length) s += '          <div class="row">\n' + maps.join('\n') + '\n          </div>\n';
    s += '        </div>\n      </div>\n';
    if (v.showSlip !== false && chars.length) {
      var sl = v.slip || {}, c0 = chars[0];
      s += '\n      <div class="slip" id="slip" aria-live="polite">\n';
      s += '        <div class="slip-head">\n          <strong>' + T(sl.title, { forceTag: true }) + '</strong>\n';
      s += '          <span>No. <b id="rx-no">0412</b> · <span id="rx-date"></span></span>\n        </div>\n';
      s += '        <div class="slip-body">\n          <img id="rx-img" src="' + esc(asset(c0.image)) + '" alt="">\n          <dl class="rx">\n';
      s += '            <div><dt>' + T({ ko: '체질', en: 'Type' }) + '</dt><dd class="big" id="rx-type">' + T({ ko: ko(c0.name) + ' · ' + ko(c0.type), en: en(c0.name) + ' · ' + en(c0.type) }) + '</dd></div>\n';
      s += '            <div><dt>' + T({ ko: '처방', en: 'Rx' }) + '</dt><dd id="rx-text">' + T(c0.grow, { forceTag: true }) + '</dd></div>\n';
      if (has(sl.dose)) s += '            <div><dt>' + T({ ko: '용법', en: 'Dose' }) + '</dt><dd>' + T(sl.dose, { forceTag: true }) + '</dd></div>\n';
      s += '          </dl>\n        </div>\n';
      s += '        <div class="stamp" aria-hidden="true">' + escNl(sl.stamp || '') + '</div>\n';
      s += '        <div class="slip-foot">\n          <small>' + T(sl.foot, { forceTag: true }) + '</small>\n';
      s += '          <button class="btn sm" type="button" id="rx-draw">' + T(sl.button || { ko: '다시 뽑기', en: 'Draw again' }, { forceTag: true }) + '</button>\n        </div>\n      </div>\n';
    }
    s += '    </section>';
    return s;
  };

  SECTIONS.work = function (D, sec) {
    var w = D.home.work || {};
    var s = '    <section id="work" aria-labelledby="work-title"' + bgStyle(sec, D) + '>\n      <div class="sec-head">\n';
    s += '        <div>' + eyebrow(w.pill, w.eyebrow) + '\n        <h2 id="work-title">' + T(w.title, { lc: { ko: 'ko-d', en: 'en-d' } }) + '</h2></div>\n';
    if (has(w.desc)) s += '        <p>' + T(w.desc, { forceTag: true }) + '</p>\n';
    s += '      </div>\n      <div class="bars">\n';
    s += (w.items || []).filter(function (i) { return has(i.title); }).map(function (it) {
      var key = COLOR_KEYS.indexOf(it.color) >= 0 ? it.color : 'sky';
      var col = (D.theme.colors || {})[key] || DEFAULT_COLORS[key];
      var st = '--c:var(--' + key.replace(/_/g, '-') + ')' + (luminance(col) < 0.2 ? ';--fc:var(--paper)' : '');
      var r = '        <details class="bar" style="' + st + '"' + (it.open ? ' open' : '') + '>\n';
      r += '          <summary><span>' + T(it.title, { lc: { ko: 'ko-d', en: 'en-d' } }) + '</span><span class="plus" aria-hidden="true">+</span></summary>\n';
      r += '          <div class="bar-body">\n            <div>\n';
      r += '              <p>' + T(it.body, { forceTag: true, nl: true }) + '</p>\n';
      var tags = (it.tags || []).filter(has);
      if (tags.length) r += '              <ul>' + tags.map(function (t) { return '<li>' + T(t, { forceTag: true }) + '</li>'; }).join('') + '</ul>\n';
      r += '            </div>\n';
      if (it.image) r += '            <div class="thumb"><img src="' + esc(asset(it.image)) + '" alt=""></div>\n';
      r += '          </div>\n        </details>';
      return r;
    }).join('\n') + '\n      </div>\n    </section>';
    return s;
  };

  SECTIONS.news = function (D, sec) {
    var n = D.home.news || {};
    var board = boardById(D, n.board) || D.site.boards[0];
    if (!board) return '';
    var list = boardPosts(D, board.id).slice(0, Math.max(1, Math.min(12, +n.count || 3)));
    if (!list.length && n.hideWhenEmpty !== false) return '';
    var s = '    <section class="news" id="news" aria-labelledby="news-title"' + bgStyle(sec, D) + '>\n      <div class="sec-head">\n';
    s += '        <div>' + eyebrow(n.pill, n.eyebrow) + '\n        <h2 id="news-title">' + T(n.title || board.name, { lc: { ko: 'ko-d', en: 'en-d' } }) + '</h2></div>\n';
    s += '        <a class="btn sm ghost" href="/' + board.id + '/">' + T({ ko: '전체 보기', en: 'View all' }) + ' →</a>\n      </div>\n';
    s += postList(D, board, list) + '\n    </section>';
    return s;
  };

  SECTIONS.contact = function (D, sec) {
    var c = D.home.contact || {}, ct = D.site.contact || {};
    var s = '    <section class="contact" id="contact" aria-labelledby="contact-title"' + bgStyle(sec, D) + '>\n      <div class="contact-copy">\n';
    s += '        ' + eyebrow(c.pill, c.eyebrow) + '\n';
    s += '        <h2 id="contact-title">' + T(c.title, { lc: { ko: 'ko-d', en: 'en-d' } }) + '</h2>\n';
    if (has(c.body)) s += '        <p>' + T(c.body, { forceTag: true, nl: true }) + '</p>\n';
    if (ct.email) {
      s += '        <div class="mail">\n          <code id="mail-addr">' + esc(ct.email) + '</code>\n';
      s += '          <button class="btn sm ghost" type="button" id="mail-copy">' + T({ ko: '주소 복사', en: 'Copy' }) + '</button>\n';
      s += '          <a class="btn sm" href="mailto:' + esc(ct.email) + '">' + T({ ko: '메일 쓰기', en: 'Write' }) + '</a>\n        </div>\n';
    }
    if (ct.instagram) s += '        <p><a class="insta" href="https://www.instagram.com/' + esc(ct.instagram) + '/" target="_blank" rel="noopener">Instagram @' + esc(ct.instagram) + ' ↗</a></p>\n';
    s += '        <p class="copy-state" id="copy-state" role="status"></p>\n      </div>\n';
    var imgs = (c.images || []).filter(Boolean);
    if (imgs.length) {
      var wide = {};
      D.characters.forEach(function (ch) { if (ch.wide) wide[asset(ch.image)] = 1; });
      s += '      <div class="contact-art" aria-hidden="true">\n' + imgs.map(function (i) {
        var u = asset(i);
        return '        <img src="' + esc(u) + '" alt=""' + (wide[u] ? ' class="wide"' : '') + '>';
      }).join('\n') + '\n      </div>\n';
    }
    s += '    </section>';
    return s;
  };

  /* 직접 추가하는 섹션: 제목 + 본문(마크다운) + 이미지 + 버튼 */
  SECTIONS.custom = function (D, sec) {
    var c = sec.data || {};
    var anchor = slugOk(sec.anchor) ? sec.anchor : sec.id;
    var u = safeUrl(c.buttonHref);
    var s = '    <section class="block' + (c.image ? ' has-img' : '') + (c.align === 'center' ? ' center' : '') + '" id="' + esc(anchor) + '"' + bgStyle(sec, D) + '>\n';
    s += '      <div class="block-copy">\n';
    if (c.pill || has(c.eyebrow)) s += '        ' + eyebrow(c.pill, c.eyebrow) + '\n';
    if (has(c.title)) s += '        <h2>' + T(c.title, { nl: true, lc: { ko: 'ko-d', en: 'en-d' } }) + '</h2>\n';
    if (has(c.body)) {
      var bk = md(ko(c.body)), be = md(en(c.body));
      s += (c.body.en && c.body.ko && c.body.en !== c.body.ko)
        ? '        <div class="prose ko">' + bk + '</div><div class="prose en">' + be + '</div>\n'
        : '        <div class="prose">' + bk + '</div>\n';
    }
    if (u && has(c.buttonLabel)) s += '        <p><a class="btn" href="' + esc(link(u, true)) + '"' + ext(u) + '>' + T(c.buttonLabel, { forceTag: true }) + '</a></p>\n';
    s += '      </div>\n';
    if (c.image) s += '      <div class="block-img"><img src="' + esc(asset(c.image)) + '" alt="" loading="lazy"></div>\n';
    s += '    </section>';
    return s;
  };

  /* ------------------------------------------------------------------ */
  /* 게시판                                                               */
  /* ------------------------------------------------------------------ */
  function boardById(D, id) { return (D.site.boards || []).filter(function (b) { return b.id === id; })[0]; }
  function boardPosts(D, id) {
    return D.posts.filter(function (p) { return p.board === id && p.published !== false && slugOk(p.slug); })
      .slice().sort(function (a, b) {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
        return String(b.date || '').localeCompare(String(a.date || '')) || String(b.slug).localeCompare(String(a.slug));
      });
  }
  function postUrl(p) { return '/' + p.board + '/' + p.slug + '/'; }
  function postList(D, board, list) {
    if (!list.length) return '      <p class="empty">' + T({ ko: '아직 등록된 글이 없어요.', en: 'Nothing posted yet.' }) + '</p>';
    return '      <ul class="post-list">\n' + list.map(function (p) {
      var sum = has(p.summary) ? p.summary : { ko: stripMd(ko(p.body)).slice(0, 90), en: stripMd(en(p.body)).slice(0, 120) };
      return '        <li><a href="' + postUrl(p) + '">' +
        (p.image ? '<span class="pl-img"><img src="' + esc(asset(p.image)) + '" alt="" loading="lazy"></span>' : '') +
        '<span class="pl-body"><span class="pl-meta">' + (p.pinned ? '<em class="pin">' + T({ ko: '고정', en: 'Pinned' }) + '</em>' : '') +
        '<time datetime="' + esc(p.date) + '">' + esc(fmtDate(p.date)) + '</time></span>' +
        '<strong class="pl-title">' + T(p.title) + '</strong>' +
        (has(sum) ? '<span class="pl-sum">' + T(sum) + '</span>' : '') + '</span><span class="pl-go" aria-hidden="true">→</span></a></li>';
    }).join('\n') + '\n      </ul>';
  }
  function pageHead(pill, title, desc, extra) {
    var s = '    <section class="page-head">\n';
    s += '      ' + eyebrow(pill, null) + '\n';
    s += '      <h1>' + T(title, { lc: { ko: 'ko-d', en: 'en-d' } }) + '</h1>\n';
    if (has(desc)) s += '      <p>' + T(desc, { forceTag: true, nl: true }) + '</p>\n';
    if (extra) s += extra;
    return s + '    </section>';
  }
  function bodyBlocks(body) {
    body = body || {};
    var k = body.ko || '', e = body.en || '';
    if (e && k && e !== k) return '<div class="prose ko">\n' + md(k) + '\n</div>\n<div class="prose en">\n' + md(e) + '\n</div>';
    return '<div class="prose">\n' + md(k || e) + '\n</div>';
  }

  function boardPage(D, ctx, board) {
    var list = boardPosts(D, board.id);
    var main = pageHead(board.pill || 'Board', board.name, board.desc) + '\n';
    main += '    <section class="board">\n' + postList(D, board, list) + '\n    </section>';
    return layout(D, ctx, { path: '/' + board.id + '/', title: ko(board.name), description: ko(board.desc), bodyClass: 'is-sub' }, main);
  }

  function postPage(D, ctx, board, p, list) {
    var chron = list.slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || '')) || String(b.slug).localeCompare(String(a.slug));
    });
    var i = chron.indexOf(p);
    var newer = i > 0 ? chron[i - 1] : null;
    var older = i < chron.length - 1 ? chron[i + 1] : null;
    var main = '    <article class="post">\n';
    main += '      <p class="crumb"><a href="/' + board.id + '/">← ' + T(board.name) + '</a></p>\n';
    main += '      <header class="post-head">\n        <p class="pl-meta">' + (p.pinned ? '<em class="pin">' + T({ ko: '고정', en: 'Pinned' }) + '</em>' : '') + '<time datetime="' + esc(p.date) + '">' + esc(fmtDate(p.date)) + '</time></p>\n';
    main += '        <h1>' + T(p.title, { lc: { ko: 'ko-d', en: 'en-d' } }) + '</h1>\n      </header>\n';
    if (p.image) main += '      <figure class="post-cover"><img src="' + esc(asset(p.image)) + '" alt=""></figure>\n';
    main += '      ' + bodyBlocks(p.body) + '\n';
    main += '      <nav class="post-nav" aria-label="Posts">\n';
    main += older ? '        <a href="' + postUrl(older) + '"><small>' + T({ ko: '이전 글', en: 'Older' }) + '</small>' + T(older.title, { forceTag: true }) + '</a>\n' : '        <span></span>\n';
    main += '        <a class="btn sm ghost" href="/' + board.id + '/">' + T({ ko: '목록', en: 'All posts' }) + '</a>\n';
    main += newer ? '        <a class="next" href="' + postUrl(newer) + '"><small>' + T({ ko: '다음 글', en: 'Newer' }) + '</small>' + T(newer.title, { forceTag: true }) + '</a>\n' : '        <span></span>\n';
    main += '      </nav>\n    </article>';
    var desc = ko(p.summary) || stripMd(ko(p.body)).slice(0, 140);
    return layout(D, ctx, { path: postUrl(p), title: ko(p.title), description: desc, image: p.image, ogType: 'article', bodyClass: 'is-sub' }, main);
  }

  function customPage(D, ctx, pg) {
    var main = pageHead(pg.pill || '', pg.title, pg.desc) + '\n';
    main += '    <article class="post page-body">\n';
    if (pg.image) main += '      <figure class="post-cover"><img src="' + esc(asset(pg.image)) + '" alt=""></figure>\n';
    main += '      ' + bodyBlocks(pg.body) + '\n    </article>';
    return layout(D, ctx, { path: '/' + pg.slug + '/', title: ko(pg.title), description: ko(pg.desc) || stripMd(ko(pg.body)).slice(0, 140), image: pg.image, bodyClass: 'is-sub' }, main);
  }

  function notFoundPage(D, ctx) {
    var img = D.characters[3] ? asset(D.characters[3].image) : '';
    var main = '    <section class="lost">\n' + (img ? '      <img src="' + esc(img) + '" alt="">\n' : '') +
      '      <p class="label">404 · Page not found</p>\n' +
      '      <h1>' + T({ ko: '용궁에서 길을 잃었어요', en: 'Lost under the sea' }, { lc: { ko: 'ko-d', en: 'en-d' } }) + '</h1>\n' +
      '      <p>' + T({ ko: '주소가 바뀌었거나 없는 페이지예요.', en: 'This page has moved or does not exist.' }) + '</p>\n' +
      '      <p><a class="btn" href="/">' + T({ ko: '처음으로', en: 'Back home' }) + '</a></p>\n    </section>';
    return layout(D, ctx, { path: '/404.html', title: '404', noindex: true, bodyClass: 'is-sub' }, main);
  }

  /* ------------------------------------------------------------------ */
  /* 전체 렌더링                                                           */
  /* ------------------------------------------------------------------ */
  function normalize(data) {
    data = data || {};
    var site = data.site || {};
    if (!Array.isArray(site.boards)) site.boards = [];
    return {
      site: site,
      theme: data.theme || {},
      home: data.home || { sections: [] },
      characters: ((data.characters && data.characters.characters) || []).filter(function (c) { return c && c.image; }),
      posts: (data.posts && data.posts.posts) || [],
      pages: (data.pages && data.pages.pages) || []
    };
  }

  function homePage(D, ctx) {
    var parts = (D.home.sections || []).filter(function (s) { return s.visible !== false && SECTIONS[s.type || s.id]; })
      .map(function (s) {
        var html = SECTIONS[s.type || s.id](D, s);
        return html ? '    <!-- ' + esc(s.type || s.id).toUpperCase() + ' -->\n' + html : '';
      }).filter(Boolean);
    var cast = D.characters.map(function (c) {
      return { img: asset(c.image), name: { ko: ko(c.name), en: en(c.name) }, type: { ko: ko(c.type), en: en(c.type) }, grow: { ko: ko(c.grow), en: en(c.grow) } };
    });
    var tail = '<script type="application/json" id="cast-data">' + jsonScript(cast) + '</script>';
    return layout(D, ctx, { path: '/', isHome: true }, parts.join('\n\n'), tail);
  }

  /**
   * validate(data) → 저장하면 안 되는 문제 목록(errors)과 참고용 경고(warnings)
   */
  function validate(data) {
    var D = normalize(data), errors = [], warnings = [];
    var used = {};
    (D.site.boards || []).forEach(function (b) {
      if (!slugOk(b.id)) errors.push('게시판 주소 "' + b.id + '"는 영문 소문자·숫자·하이픈만 쓸 수 있어요.');
      else if (RESERVED.indexOf(b.id) >= 0) errors.push('게시판 주소 "' + b.id + '"는 시스템에서 쓰는 이름이라 사용할 수 없어요.');
      else if (used[b.id]) errors.push('주소 "/' + b.id + '/"가 겹쳐요.');
      used[b.id] = 'board';
    });
    D.pages.forEach(function (p) {
      if (!slugOk(p.slug)) errors.push('페이지 "' + ko(p.title) + '"의 주소는 영문 소문자·숫자·하이픈만 쓸 수 있어요.');
      else if (RESERVED.indexOf(p.slug) >= 0) errors.push('페이지 주소 "' + p.slug + '"는 시스템에서 쓰는 이름이라 사용할 수 없어요.');
      else if (used[p.slug]) errors.push('주소 "/' + p.slug + '/"가 다른 페이지·게시판과 겹쳐요.');
      used[p.slug] = 'page';
      if (!has(p.title)) errors.push('제목이 없는 페이지가 있어요.');
    });
    var seen = {};
    D.posts.forEach(function (p) {
      if (!slugOk(p.slug)) errors.push('게시글 "' + ko(p.title) + '"의 주소가 올바르지 않아요.');
      var k = p.board + '/' + p.slug;
      if (seen[k]) errors.push('게시글 주소 "/' + k + '/"가 겹쳐요.');
      seen[k] = 1;
      if (!boardById(D, p.board)) warnings.push('게시글 "' + ko(p.title) + '"의 게시판(' + p.board + ')이 없어 사이트에 보이지 않아요.');
      if (!has(p.title)) errors.push('제목이 없는 게시글이 있어요.');
    });
    var b = D.site.banner || {};
    if (b.enabled && !has(b.text)) warnings.push('공지 배너가 켜져 있지만 문구가 비어 있어 표시되지 않아요.');
    if (b.start && b.end && b.start > b.end) errors.push('공지 배너의 시작일이 종료일보다 늦어요.');
    if (!D.characters.length) warnings.push('캐릭터가 하나도 없어요. 캐릭터 영역과 처방전이 비어 보여요.');
    return { errors: errors, warnings: warnings };
  }

  function renderSite(data, ctx) {
    ctx = ctx || {};
    var D = normalize(data);
    var files = {};
    files['index.html'] = homePage(D, ctx);
    files['404.html'] = notFoundPage(D, ctx);
    var urls = [{ loc: '/', pri: '1.0' }];
    (D.site.boards || []).forEach(function (board) {
      if (!slugOk(board.id) || RESERVED.indexOf(board.id) >= 0) return;
      var list = boardPosts(D, board.id);
      files[board.id + '/index.html'] = boardPage(D, ctx, board);
      urls.push({ loc: '/' + board.id + '/', pri: '0.6' });
      list.forEach(function (p) {
        files[board.id + '/' + p.slug + '/index.html'] = postPage(D, ctx, board, p, list);
        urls.push({ loc: postUrl(p), lastmod: p.updated || p.date, pri: '0.5' });
      });
    });
    D.pages.forEach(function (pg) {
      if (pg.published === false || !slugOk(pg.slug) || RESERVED.indexOf(pg.slug) >= 0) return;
      if (files[pg.slug + '/index.html']) return;
      files[pg.slug + '/index.html'] = customPage(D, ctx, pg);
      urls.push({ loc: '/' + pg.slug + '/', lastmod: pg.updated, pri: '0.7' });
    });
    var base = String(D.site.siteUrl || '').replace(/\/$/, '');
    files['sitemap.xml'] = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map(function (u) {
        return '  <url><loc>' + esc(base + u.loc) + '</loc>' + (u.lastmod ? '<lastmod>' + esc(String(u.lastmod).slice(0, 10)) + '</lastmod>' : '') + '<priority>' + u.pri + '</priority></url>';
      }).join('\n') + '\n</urlset>\n';
    var idx = !D.site.seo || D.site.seo.indexable !== false;
    files['robots.txt'] = 'User-agent: *\n' + (idx ? 'Disallow: /admin/\n' : 'Disallow: /\n') + 'Sitemap: ' + base + '/sitemap.xml\n';
    var gen = Object.keys(files).sort();
    files['data/manifest.json'] = JSON.stringify({ note: '관리자 페이지가 자동으로 만든 파일 목록입니다. 직접 고치지 마세요.', generated: gen }, null, 2) + '\n';
    return { files: files, urls: urls.map(function (u) { return u.loc; }) };
  }

  return {
    renderSite: renderSite,
    validate: validate,
    md: md,
    esc: esc,
    themeCss: themeCss,
    fontsHref: fontsHref,
    safeUrl: safeUrl,
    slugOk: slugOk,
    luminance: luminance,
    FONTS: FONTS,
    COLOR_KEYS: COLOR_KEYS,
    DEFAULT_COLORS: DEFAULT_COLORS,
    RESERVED: RESERVED,
    SECTION_TYPES: Object.keys(SECTIONS)
  };
});
