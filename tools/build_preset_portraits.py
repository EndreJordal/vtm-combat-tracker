#!/usr/bin/env python3
"""Build the preset portraits from the pictures in portrait-sources/<preset-id> (<name>)/.

Each folder's picture becomes two JPEGs: a 3:4 full portrait (300x400) of the whole picture, and a
head-and-shoulders thumbnail for the small card and list views. On a plain background the figure is
found automatically and the thumbnail zooms in on its head. Plain light backgrounds and transparency
are replaced with the tracker's dark panel colour.

Output (commit these):
  images/presets/<preset-id>.jpg          full portrait
  images/presets/<preset-id>.thumb.jpg    thumbnail
  js/preset-portraits.js                  the presets that have a portrait

portrait-sources/ itself (the original pictures) is git-ignored: it's only source material.

Usage (from the repo root):  python -I tools/build_preset_portraits.py
"""
import glob
import hashlib
import io
import json
import os
import re

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SOURCES = os.path.join(ROOT, 'portrait-sources')
OUT_DIR = os.path.join(ROOT, 'images', 'presets')
OUT_JS = os.path.join(ROOT, 'js', 'preset-portraits.js')
W, H = 300, 400          # full portrait
TW, TH = 156, 180        # thumbnail (cards show it at 52x60)
BG = (21, 18, 23)        # dark panel colour behind transparent or removed backgrounds
FOCUS = 0.15             # how far down to centre a crop of a tall picture (0 = top, 0.5 = middle)
EXTS = ('.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp')

# Light backgrounds are replaced with BG, except where that would spoil the picture:
# ink drawings (white is part of the art) and textured or gradient backgrounds.
KEEP_BACKGROUND = {'dog', 'big_cat', 'alligator', 'bear', 'were_elder'}
# How different from the background a pixel must be to count as the figure. Higher also removes pale
# floor shadows, but can eat pale skin that touches the background.
DEFAULT_TOLERANCE = 58
BG_TOLERANCE = {'enforcer': 36}

# Hand-placed thumbnail boxes where the automatic head finder can't work (wings, hair or a hunched back
# reach higher than the head, or the figure is small). Fractions of the picture: (head centre x, box top, box height).
THUMB_FOCUS = {
    'pooka': (0.27, 0.15, 0.25),
    'redcap': (0.40, 0.12, 0.35),
    'sidhe': (0.21, 0.01, 0.28),
    'were_elder': (0.17, 0.10, 0.40),
    'were_vet': (0.38, 0.20, 0.30),
    'arcanum': (0.55, 0.05, 0.27),
    'inquisitor': (0.48, 0.00, 0.24),
}


def md5(path):
    with open(path, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()


def load_rgb(path):
    with Image.open(path) as im:
        im.load()
        if im.mode in ('RGBA', 'LA', 'P'):
            im = im.convert('RGBA')
            bg = Image.new('RGBA', im.size, BG + (255,))
            bg.alpha_composite(im)
            im = bg
        return im.convert('RGB')


def darken_background(im, tolerance=DEFAULT_TOLERANCE):
    """Replace a plain, light background (connected to the picture's edges) with BG. Returns (image, changed)."""
    a = np.asarray(im).astype(int)
    h, w, _ = a.shape
    edge = np.concatenate([a[:3].reshape(-1, 3), a[-3:].reshape(-1, 3), a[:, :3].reshape(-1, 3), a[:, -3:].reshape(-1, 3)])
    bg = np.median(edge, axis=0)
    if bg.mean() < 170:                                     # not a light background
        return im, False
    near = np.abs(a - bg).max(axis=2) < tolerance
    if near[[0, -1], :].mean() < 0.6 and near[:, [0, -1]].mean() < 0.6:   # the border itself isn't plain
        return im, False
    m = Image.fromarray(np.where(near, 255, 0).astype(np.uint8)).copy()  # copy: flood fill must edit its own pixels
    px = m.load()
    for x in range(w):                                      # flood fill from every background pixel on the border
        for y in (0, h - 1):
            if px[x, y] == 255:
                ImageDraw.floodfill(m, (x, y), 128)
    for y in range(h):
        for x in (0, w - 1):
            if px[x, y] == 255:
                ImageDraw.floodfill(m, (x, y), 128)
    filled = np.asarray(m) == 128
    if filled.mean() < 0.05:
        return im, False
    # Clean the light fringe: also take pale pixels right next to the filled area.
    grown = np.asarray(Image.fromarray((filled * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
    mask = filled | (grown & (np.abs(a - bg).max(axis=2) < 90))
    out = a.copy()
    out[mask] = BG
    return Image.fromarray(out.astype(np.uint8)), True


def jpeg(im, size):
    buf = io.BytesIO()
    im.resize(size, Image.LANCZOS).save(buf, 'JPEG', quality=80, optimize=True, progressive=True)
    return buf.getvalue()


def ratio_crop(w, h, target, focus=FOCUS):
    """Largest box of the given aspect ratio: sides trimmed evenly, or the upper part kept."""
    if w / h > target:
        cw = round(h * target)
        return ((w - cw) // 2, 0, (w - cw) // 2 + cw, h)
    ch = round(w / target)
    top = round((h - ch) * focus)
    return (0, top, w, top + ch)


def head_box(im):
    """If the picture is a figure on a plain background, return a head-and-shoulders box; else None."""
    a = np.asarray(im).astype(int)
    h, w, _ = a.shape
    edge = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    bg = np.median(edge, axis=0)
    if np.abs(edge - bg).max(axis=1).mean() > 18:           # busy border: a photo, not a cut-out figure
        return None
    mask = np.abs(a - bg).max(axis=2) > 32
    rows = np.where(mask.sum(axis=1) > max(2, w * 0.01))[0]
    cols = np.where(mask.sum(axis=0) > max(2, h * 0.01))[0]
    if len(rows) < 10 or len(cols) < 10:
        return None
    top, bottom = rows[0], rows[-1]
    bh = bottom - top
    if bh < h * 0.55:                                       # not a tall figure: leave it to the normal crop
        return None
    band = mask[top:top + max(4, int(bh * 0.10))]
    xs = np.where(band.any(axis=0))[0]
    cx = int(xs.mean()) if len(xs) else w // 2
    th = int(bh * 0.34)                                     # head and shoulders
    tw = int(th * TW / TH)
    y0 = max(0, top - int(bh * 0.03))
    x0 = min(max(0, cx - tw // 2), max(0, w - tw))
    return (x0, y0, min(w, x0 + tw), min(h, y0 + th))


def focus_box(w, h, focus):
    cx, top, height = focus
    th = round(h * height)
    tw = round(th * TW / TH)
    x0 = min(max(0, round(w * cx) - tw // 2), max(0, w - tw))
    y0 = min(max(0, round(h * top)), max(0, h - th))
    return (x0, y0, min(w, x0 + tw), min(h, y0 + th))


def portrait_pair(path, pid):
    im = load_rgb(path)
    darkened = False
    if pid not in KEEP_BACKGROUND:
        im, darkened = darken_background(im, BG_TOLERANCE.get(pid, DEFAULT_TOLERANCE))
    w, h = im.size
    full = jpeg(im.crop(ratio_crop(w, h, W / H)), (W, H))
    hb = focus_box(w, h, THUMB_FOCUS[pid]) if pid in THUMB_FOCUS else head_box(im)
    thumb_src = im.crop(hb) if hb else im.crop(ratio_crop(w, h, TW / TH))
    if hb:                                                  # make the head box the thumbnail's aspect ratio
        thumb_src = thumb_src.crop(ratio_crop(*thumb_src.size, TW / TH, 0))
    return full, jpeg(thumb_src, (TW, TH)), bool(hb), darkened


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    folders = sorted(d for d in glob.glob(os.path.join(SOURCES, '*')) if os.path.isdir(d))
    files = {d: sorted(f for f in glob.glob(os.path.join(d, '*')) if f.lower().endswith(EXTS)) for d in folders}
    # A file that also appears (byte for byte) in another folder is probably a stray copy; prefer the others.
    seen = {}
    for d, fs in files.items():
        for f in fs:
            seen.setdefault(md5(f), set()).add(d)
    done, report = [], []
    for d in folders:
        pid = re.match(r'^([^ (]+)', os.path.basename(d)).group(1)
        fs = files[d]
        if not fs:
            report.append(f'{pid:16} — empty')
            continue
        unique = [f for f in fs if len(seen[md5(f)]) == 1]
        pick = (unique or fs)[0]
        full, thumb, zoomed, darkened = portrait_pair(pick, pid)
        with open(os.path.join(OUT_DIR, f'{pid}.jpg'), 'wb') as f:
            f.write(full)
        with open(os.path.join(OUT_DIR, f'{pid}.thumb.jpg'), 'wb') as f:
            f.write(thumb)
        done.append(pid)
        note = f' (chose 1 of {len(fs)})' if len(fs) > 1 else ''
        report.append(f'{pid:16} {"head zoom" if zoomed else "top crop ":9}  {"dark bg" if darkened else "       "}  {os.path.basename(pick)}{note}')
    # Drop portraits whose source folder is now empty or gone.
    for f in glob.glob(os.path.join(OUT_DIR, '*.jpg')):
        if os.path.basename(f).split('.')[0] not in done:
            os.remove(f)
    with open(OUT_JS, 'w', encoding='utf-8', newline='\n') as f:
        f.write('/* Generated by tools/build_preset_portraits.py: presets with a portrait in images/presets/. */\n')
        f.write("'use strict';\nconst PRESET_PORTRAITS = new Set(" + json.dumps(sorted(done)) + ');\n')
    print('\n'.join(report))
    size = sum(os.path.getsize(f) for f in glob.glob(os.path.join(OUT_DIR, '*.jpg')))
    print(f'\n{len(done)} portraits -> images/presets/ ({size / 1024:.0f} KB) and js/preset-portraits.js')


if __name__ == '__main__':
    main()
