import { site } from '../config.js';

const BASE = './'; // HTML と同じ階層を基準にする（GitHub Pages のサブパスでも動く）

/** JSON内のパス（サイトルート基準）を実際のURLにする。http(s) や / 始まりはそのまま */
export function asset(path) {
  if (!path) return '';
  if (/^(https?:)?\/\//.test(path) || path.startsWith('/') || path.startsWith('data:')) return path;
  return BASE + path;
}

/** プログラムのリンク先。JSON に href があればそれを優先、なければ詳細ページ */
export function programHref(p) {
  return p.href ? asset(p.href) : `${BASE}program.html?id=${encodeURIComponent(p.id)}`;
}

export function isExternal(p) {
  return !!p.href && /^(https?:)?\/\//.test(p.href);
}

let cache;
/**
 * programs.json を読み込む（同じページ内では1回だけ取得）。
 * 戻り値: { classes: [{ id, label }], programs: [...] }
 */
export function loadData() {
  cache ??= fetch(asset(site.data))
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    })
    .then((json) => (Array.isArray(json)
      ? { classes: [], programs: json }
      : { classes: json.classes ?? [], programs: json.programs ?? [] }));
  return cache;
}

/**
 * サムネイル用の <img> を作る。
 * 遅延読み込み・非同期デコードを付け、読み込み完了でフェードイン。
 */
export function createThumbImg(p, { eager = false, alt = '' } = {}) {
  const img = document.createElement('img');
  img.alt = alt;
  img.width = 640;
  img.height = 360;
  img.decoding = 'async';
  img.loading = eager ? 'eager' : 'lazy';
  if (eager) img.fetchPriority = 'high';
  img.classList.add('is-loading');
  const done = () => img.classList.remove('is-loading');
  img.addEventListener('load', done, { once: true });
  img.addEventListener('error', done, { once: true });
  img.src = asset(p.thumb || p.image);
  return img;
}

/** ロゴ：config.js に画像が指定されていれば仮ロゴと差し替える */
function initLogo() {
  const { src, alt, height } = site.logo ?? {};
  const placeholder = document.querySelector('.logo-link .logo');
  if (!src || !placeholder) return;
  const img = new Image();
  img.className = 'logo';
  img.alt = alt || '';
  img.style.setProperty('--logo-h', `${height || 30}px`); // 高さは CSS 側で使う（画面幅で調整）
  img.decoding = 'async';
  placeholder.style.visibility = 'hidden'; // 仮ロゴが一瞬見えるのを防ぐ
  img.onload = () => placeholder.replaceWith(img);
  img.onerror = () => {
    placeholder.style.visibility = '';
    console.warn(`[logo] 読み込めませんでした: ${src}（仮ロゴを表示します）`);
  };
  img.src = asset(src);
}

/* ---------- 最近の視聴（この端末のブラウザにだけ保存） ---------- */
const RECENT_KEY = 'recentProgramId';
export function saveRecent(id) {
  try { localStorage.setItem(RECENT_KEY, id); } catch { /* プライベートモード等では無視 */ }
}
export function getRecent() {
  try { return localStorage.getItem(RECENT_KEY); } catch { return null; }
}

export function initCommon() {
  initLogo();
}
