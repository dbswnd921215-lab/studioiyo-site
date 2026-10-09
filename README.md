# studioiyo-site

studioiyo.com 홈페이지 저장소입니다. GitHub Pages(main 브랜치, 루트)로 배포됩니다.

## 내용 고치기

**관리자 페이지: https://studioiyo.com/admin/**

문구, 공지 배너, 게시판, 페이지, 색·글꼴·크기, 메뉴, 검색 설정은 관리자 페이지에서 고치고 [저장하고 사이트에 반영]을 누르면 1~2분 뒤 반영됩니다.

## 폴더 구조

| 경로 | 역할 | 직접 고쳐도 되나요 |
|---|---|---|
| `data/*.json` | 사이트 내용·설정 (관리자 페이지가 읽고 씀) | 관리자 페이지 사용 권장 |
| `admin/` | 관리자 페이지 | 개발자만 |
| `admin/render.js` | HTML 틀(템플릿). 데이터 → HTML | 개발자만 (고친 뒤 관리자 > 연결·백업 > 전체 페이지 다시 만들기) |
| `assets/css/site.css`, `assets/js/site.js` | 사이트 스타일·동작 | 개발자만 |
| `assets/` | 이미지 (관리자에서 올린 이미지는 `assets/uploads/`) | 가능 |
| `index.html`, `404.html`, `notice/`, 추가 페이지 폴더, `sitemap.xml`, `robots.txt` | **자동 생성 파일** | ❌ 직접 고치면 다음 저장 때 덮어써짐 |
| `data/manifest.json` | 자동 생성 파일 목록 | ❌ |
| `CNAME`, `.nojekyll` | 도메인·배포 설정 | ❌ 지우지 말 것 |

## 주의

- 관리자 페이지에서 저장하면 이 저장소에 바로 커밋됩니다. PC에서 파일을 고치기 전에는 GitHub Desktop에서 **Fetch origin → Pull origin**을 먼저 하세요.
- 저장소가 공개라서 `data/` 내용(임시저장 글 포함)은 누구나 볼 수 있습니다. 비밀번호·내부 자료는 넣지 마세요.
