/**
 * サイト全体の設定。
 *
 * ロゴの差し替え:
 *   1. 元画像を assets-src/logo.png（jpg なども可）として置き、同期.bat を実行する
 *      → 余白の切り落とし、白背景の透過、縮小をして images/logo.webp ができる
 *   2. 下の logo.src がそのパスを指していれば、ヘッダーに表示される
 *   src が空、または読み込みに失敗した場合は、HTML内の仮ロゴ（SVG）がそのまま表示されます。
 */
export const site = {
  logo: {
    src: 'images/logo.webp',
    alt: 'InspireHigh × 神奈川歯科大学系属 緑ヶ丘女子中学校・高等学校',
    height: 36, // 表示する高さ(px)。幅は自動。スマホ幅では自動で小さくなります
  },
  data: 'data/programs.json',
};
