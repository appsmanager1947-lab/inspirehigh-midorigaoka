import {
  initCommon, loadData, createThumbImg, programHref, isExternal, asset, getRecent,
} from './common.js';

initCommon();

const grid = document.getElementById('grid');
const tabs = document.getElementById('tabs');
const count = document.getElementById('count');
const recent = document.getElementById('recent');

const ALL = 'all'; // 「セッション」タブ＝全件

function createCard(p) {
  const a = document.createElement('a');
  a.className = 'card thumb';
  a.href = programHref(p);
  a.setAttribute('aria-label', p.title || p.id);
  if (isExternal(p)) {
    a.target = '_blank';
    a.rel = 'noopener';
  }
  a.append(createThumbImg(p));
  return a;
}

function renderGrid(programs) {
  if (!programs.length) {
    grid.innerHTML = '<p class="notice muted">まだプログラムがありません</p>';
  } else {
    const frag = document.createDocumentFragment();
    for (const p of programs) frag.append(createCard(p));
    grid.replaceChildren(frag);
  }
  grid.setAttribute('aria-busy', 'false');
}

/** 最近の視聴：詳細ページで最後に見たもの。まだ無ければ先頭のプログラム */
function renderRecent(programs) {
  const id = getRecent();
  const p = programs.find((x) => x.id === id) ?? programs[0];
  if (!p) return;
  const link = document.createElement('a');
  link.className = 'recent';
  link.href = programHref(p);
  link.setAttribute('aria-label', `最近の視聴: ${p.title || p.id}`);
  const img = document.createElement('img');
  img.className = 'recent-img';
  img.alt = '';
  img.width = 640;
  img.height = 360;
  img.decoding = 'async';
  img.loading = 'lazy';
  img.src = asset(p.thumb || p.image);
  link.append(img);
  recent.replaceChildren(link);
}

/* ---------- タブ ---------- */

/** 「セッション」＋クラスのタブを作る。選択中のタブは URL の #class1 などで保持 */
function setupTabs(classes, programs) {
  const items = [{ id: ALL, label: 'セッション' }, ...classes];
  const buttons = items.map((c) => {
    const b = document.createElement('button');
    b.className = 'tab';
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', 'grid');
    b.dataset.id = c.id;
    b.textContent = c.label;
    return b;
  });
  tabs.replaceChildren(...buttons);

  const select = (id, { focus = false, updateUrl = true } = {}) => {
    const target = buttons.find((b) => b.dataset.id === id) ?? buttons[0];
    for (const b of buttons) {
      const on = b === target;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    if (focus) target.focus();
    const cid = target.dataset.id;
    renderGrid(cid === ALL ? programs : programs.filter((p) => p.class === cid));
    if (updateUrl) history.replaceState(null, '', cid === ALL ? location.pathname + location.search : `#${cid}`);
  };

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (b) select(b.dataset.id);
  });
  // 左右キーでタブを移動
  tabs.addEventListener('keydown', (e) => {
    const i = buttons.indexOf(document.activeElement);
    if (i < 0) return;
    const move = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    let next;
    if (move) next = buttons[(i + move + buttons.length) % buttons.length];
    else if (e.key === 'Home') [next] = buttons;
    else if (e.key === 'End') next = buttons.at(-1);
    if (!next) return;
    e.preventDefault();
    select(next.dataset.id, { focus: true });
  });

  select(decodeURIComponent(location.hash.slice(1)) || ALL, { updateUrl: false });
}

async function main() {
  try {
    const { classes, programs } = await loadData();
    setupTabs(classes, programs);
    renderRecent(programs);
    count.textContent = programs.length;
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<p class="notice muted">プログラム一覧を読み込めませんでした。<br>時間をおいて再読み込みしてください。</p>';
    grid.setAttribute('aria-busy', 'false');
  }
}

main();
