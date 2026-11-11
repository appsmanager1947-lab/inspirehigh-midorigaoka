"""
同期：「サムネイル」フォルダの中身に合わせて、公開用の画像と一覧データを作り直します。
（ふだんはプロジェクト直下の「同期.bat」をダブルクリックして実行します）

  サムネイル/Class1/xxx.jpg  →  images/programs/<id>.webp        （詳細ページ用・幅1280px）
                                images/programs/<id>.thumb.webp  （一覧カード用・幅640px）
  assets-src/banner.jpg      →  images/banner.webp              （アクティビティのバナー・幅1200px）
  → data/programs.json を、フォルダの中身に合わせて書き直す

- 「サムネイル」直下のフォルダが、そのままクラスのタブになります（フォルダ名＝タブ名）
- タイトルの初期値はファイル名です。programs.json で書き換えた title や description などは、
  同期しても保持されます（画像のファイル名かクラスを変えた場合は、別の画像として扱われます）
- フォルダから消した画像は、一覧からも公開用画像からも消えます
- 画像の中身が前回と同じなら変換を省きます（中身で判定するので、古い日付の画像で置き換えても正しく変換されます。--force で全件やり直し）

必要なもの: Python 3 と Pillow（pip install pillow）
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "サムネイル"
BANNER_SRC_DIR = ROOT / "assets-src"
OUT_DIR = ROOT / "images" / "programs"
BANNER_OUT = ROOT / "images" / "banner.webp"
DATA = ROOT / "data" / "programs.json"
FORCE = "--force" in sys.argv
# 変換できる画像の拡張子（大文字・小文字は区別しない）
EXTS = {
    ".jpg", ".jpeg", ".jpe", ".jfif", ".jif",  # JPEG
    ".png", ".gif", ".webp", ".avif",
    ".bmp", ".tif", ".tiff",
}
IGNORE = {".gitkeep", "desktop.ini", "thumbs.db", ".ds_store"}  # 画像以外で、警告を出さないファイル

VARIANTS = [("", 1280, 80), (".thumb", 640, 76)]  # (接尾辞, 最大幅, 画質)

# 同期のたびに作り直す項目。これ以外（title, description, tags, href など）は手で書き換えたものを残す
GENERATED_KEYS = ("id", "class", "source", "hash", "image", "thumb")


def file_hash(path: Path) -> str:
    """画像の中身から作る目印。中身が変われば必ず変わる（更新日時には左右されない）"""
    h = hashlib.sha1()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:10]


def natural_key(s: str):
    """'2.jpg' が '10.jpg' より前に来る並べ方"""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def short_hash(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:8]


def class_id(folder: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", folder.lower()).strip("-")
    return slug or f"c-{short_hash(folder)}"


def convert(src: Path, dst: Path, width: int, quality: int) -> None:
    with Image.open(src) as im:
        im.seek(0)  # アニメーションGIFなどは1コマ目を使う
        im = ImageOps.exif_transpose(im)  # 撮影時の向きを反映
        if im.mode not in ("RGB", "RGBA"):
            has_alpha = "A" in im.getbands() or "transparency" in im.info
            im = im.convert("RGBA" if has_alpha else "RGB")
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        dst.parent.mkdir(parents=True, exist_ok=True)
        im.save(dst, "WEBP", quality=quality, method=6)


def is_fresh(dst: Path, src: Path) -> bool:
    return not FORCE and dst.exists() and dst.stat().st_mtime > src.stat().st_mtime


def load_existing() -> dict[str, dict]:
    try:
        data = json.loads(DATA.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as e:
        sys.exit(f"[エラー] {DATA.relative_to(ROOT)} の書式が壊れています（{e}）。直してから再実行してください。")
    items = data if isinstance(data, list) else data.get("programs", [])
    return {p["id"]: p for p in items if isinstance(p, dict) and "id" in p}


def sync_banner() -> None:
    srcs = [p for p in BANNER_SRC_DIR.glob("banner.*") if p.suffix.lower() in EXTS] if BANNER_SRC_DIR.is_dir() else []
    if srcs and not is_fresh(BANNER_OUT, srcs[0]):
        convert(srcs[0], BANNER_OUT, 1200, 82)
        print("  バナーを更新しました")


LOGO_OUT = ROOT / "images" / "logo.webp"
LOGO_HEIGHT = 120  # 出力する高さ(px)。ヘッダーでは36px前後で表示するので、高精細画面でも十分な大きさ


def make_logo(src: Path, dst: Path) -> None:
    """ヘッダー用ロゴ：余白を切り落として縮小し、白背景を透過にする"""
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGBA")
    # 1) 余白（白または透明）を切り落とす
    flat = Image.new("RGB", im.size, (255, 255, 255))
    flat.paste(im, mask=im.getchannel("A"))
    ink = ImageOps.invert(flat.convert("L")).point(lambda v: 255 if v > 8 else 0)
    bbox = ink.getbbox()
    if bbox:
        pad = max(2, (bbox[3] - bbox[1]) // 40)
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(im.width, bbox[2] + pad), min(im.height, bbox[3] + pad))
        flat = flat.crop(bbox)
    # 2) 縮小
    if flat.height > LOGO_HEIGHT:
        flat = flat.resize((round(flat.width * LOGO_HEIGHT / flat.height), LOGO_HEIGHT), Image.LANCZOS)
    im = flat.convert("RGBA")
    # 3) 白に近いほど透明にする（文字の縁のなめらかさを保つ「白→透過」変換）
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            alpha = 255 - min(r, g, b)
            if alpha <= 0:
                px[x, y] = (0, 0, 0, 0)
                continue
            f = 255 / alpha
            px[x, y] = (
                round(255 - (255 - r) * f), round(255 - (255 - g) * f), round(255 - (255 - b) * f),
                alpha * a // 255,
            )
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=90, method=6)
    print(f"  ロゴを更新しました（{im.width}x{im.height}）")


def sync_logo() -> None:
    srcs = [p for p in BANNER_SRC_DIR.glob("logo.*") if p.suffix.lower() in EXTS] if BANNER_SRC_DIR.is_dir() else []
    if srcs and not is_fresh(LOGO_OUT, srcs[0]):
        make_logo(srcs[0], LOGO_OUT)


def main() -> None:
    if not SRC_DIR.is_dir():
        sys.exit(f"[エラー] 「{SRC_DIR.name}」フォルダが見つかりません。")

    existing = load_existing()
    classes, programs, keep_files = [], [], set()
    converted = 0

    folders = sorted(
        (d for d in SRC_DIR.iterdir() if d.is_dir() and not d.name.startswith((".", "_"))),
        key=lambda d: natural_key(d.name),
    )
    for folder in folders:
        cid = class_id(folder.name)
        classes.append({"id": cid, "label": folder.name})
        files = [f for f in folder.iterdir() if f.is_file() and f.name.lower() not in IGNORE]
        for f in files:
            if f.suffix.lower() not in EXTS:
                print(f"  [スキップ] 対応していない形式です: {f.relative_to(ROOT).as_posix()}")
        images = sorted((f for f in files if f.suffix.lower() in EXTS), key=lambda f: natural_key(f.name))
        ok = 0
        for src in images:
            pid = f"{cid}-{short_hash(src.name)}"
            try:
                digest = file_hash(src)
                # 前回と中身が同じで、変換済みファイルもそろっていれば変換を省く
                same = not FORCE and existing.get(pid, {}).get("hash") == digest
                for suffix, width, quality in VARIANTS:
                    dst = OUT_DIR / f"{pid}{suffix}.webp"
                    if not (same and dst.exists()):
                        convert(src, dst, width, quality)
                        converted += 1
            except Exception as e:  # 壊れた画像などは飛ばして続行
                print(f"  [スキップ] 画像を読み込めませんでした: {src.relative_to(ROOT).as_posix()}（{e}）")
                continue
            keep_files.update(f"{pid}{suffix}.webp" for suffix, _, _ in VARIANTS)
            ok += 1

            entry = {k: v for k, v in existing.get(pid, {}).items() if k not in GENERATED_KEYS}
            entry.setdefault("title", src.stem)
            programs.append({
                "id": pid,
                "class": cid,
                **entry,
                "source": src.relative_to(ROOT).as_posix(),
                "hash": digest,
                # ?v= は、画像を置き換えたときにブラウザの古いキャッシュを使わせないための目印
                "image": f"images/programs/{pid}.webp?v={digest}",
                "thumb": f"images/programs/{pid}.thumb.webp?v={digest}",
            })
        print(f"  {folder.name}: {ok} 件")

    # フォルダから消えた画像の公開用ファイルを削除
    removed = 0
    if OUT_DIR.is_dir():
        for f in OUT_DIR.iterdir():
            if f.is_file() and f.suffix == ".webp" and f.name not in keep_files:
                f.unlink()
                removed += 1

    sync_banner()
    sync_logo()

    DATA.parent.mkdir(parents=True, exist_ok=True)
    DATA.write_text(
        json.dumps({"classes": classes, "programs": programs}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    dropped = len(set(existing) - {p["id"] for p in programs})
    print(f"\n同期しました：全 {len(programs)} 件（画像の変換 {converted} 件、削除 {removed} 件、一覧から外した {dropped} 件）")


if __name__ == "__main__":
    main()
