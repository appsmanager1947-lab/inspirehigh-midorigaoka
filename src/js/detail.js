import {
  initCommon, loadData, createThumbImg, programHref, saveRecent,
} from './common.js';

initCommon();

const root = document.getElementById('detail');
const pager = document.getElementById('pager');

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function pagerLink(p, label, cls) {
  return el('a', { className: `text-link ${cls}`, href: programHref(p) }, [label]);
}

function renderNotFound() {
  document.title = 'プログラムが見つかりません';
  root.replaceChildren(
    el('h1', { textContent: 'プログラムが見つかりません' }),
    el('p', { className: 'detail-desc muted', textContent: 'URLが正しいか確認してください。' }),
  );
}

function render(p, programs, classes) {
  document.title = `${p.title || p.id} | プログラム一覧`;

  // 「← プログラム一覧」で、このプログラムのクラスのタブに戻る
  const cls = classes.find((c) => c.id === p.class);
  if (cls) document.querySelector('.back a')?.setAttribute('href', `./#${encodeURIComponent(cls.id)}`);

  const hero = el('div', { className: 'thumb detail-hero' }, [
    createThumbImg({ ...p, thumb: p.image }, { eager: true, alt: p.title || '' }),
  ]);

  const body = el('div', { className: 'detail-body' }, [
    el('h1', { textContent: p.title || p.id }),
  ]);
  const labels = [...(cls ? [cls.label] : []), ...(p.tags ?? [])];
  if (labels.length) {
    body.append(el('div', { className: 'pills' }, labels.map((t) => el('span', { className: 'pill', textContent: t }))));
  }
  if (p.description) {
    body.append(el('p', { className: 'detail-desc', textContent: p.description }));
  }

  root.replaceChildren(hero, body);
  root.setAttribute('aria-busy', 'false');

  // 前へ / 次へ
  const i = programs.indexOf(p);
  const prev = programs[i - 1];
  const next = programs[i + 1];
  pager.replaceChildren(
    ...(prev ? [pagerLink(prev, '← 前のプログラム', 'prev')] : []),
    ...(next ? [pagerLink(next, '次のプログラム →', 'next')] : []),
  );
  pager.hidden = !prev && !next;

  saveRecent(p.id);
}

async function main() {
  const id = new URLSearchParams(location.search).get('id');
  try {
    const { classes, programs } = await loadData();
    const p = programs.find((x) => x.id === id);
    if (p) render(p, programs, classes);
    else renderNotFound();
  } catch (err) {
    console.error(err);
    root.replaceChildren(el('p', { className: 'notice muted', textContent: 'データを読み込めませんでした。時間をおいて再読み込みしてください。' }));
  }
}

main();
