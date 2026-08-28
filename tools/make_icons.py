#!/usr/bin/env python3
"""Generate the Vortex Tawla PWA icons.

Draws the Vortex brand mark -- a purple-to-cyan diagonal gradient square
with a dark square cut out of the middle -- and writes real PNGs. Pure
standard library: no Pillow, no build step, so this runs anywhere Python
does and the icons stay reproducible from source.

Edges are antialiased analytically from a rounded-rectangle signed
distance field rather than by supersampling, which keeps a 512px icon
well under a second in plain Python.

    python tools/make_icons.py
"""

import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "icons")

PURPLE = (0xA8, 0x55, 0xF7)
CYAN = (0x67, 0xE8, 0xF9)
DARK = (0x06, 0x06, 0x0A)


def sd_round_rect(px, py, cx, cy, hw, hh, r):
    """Signed distance to a rounded rectangle; negative means inside."""
    dx = abs(px - cx) - (hw - r)
    dy = abs(py - cy) - (hh - r)
    ax, ay = max(dx, 0.0), max(dy, 0.0)
    return math.hypot(ax, ay) + min(max(dx, dy), 0.0) - r


def coverage(d):
    """1px analytic antialiasing from the distance field."""
    return min(max(0.5 - d, 0.0), 1.0)


def render(size, outer_radius_frac, inset_frac, inner_radius_frac):
    """RGBA bytes for one icon.

    outer_radius_frac=0 gives a full-bleed square, which is what a
    maskable icon wants -- the launcher applies its own mask, so baking
    in our own rounding would show up as a double-rounded corner.
    """
    px = bytearray(size * size * 4)
    n = size - 1.0
    half = size / 2.0
    outer_r = outer_radius_frac * size
    inset = inset_frac * size
    inner_hw = half - inset
    inner_r = min(inner_radius_frac * size, inner_hw)

    for y in range(size):
        for x in range(size):
            a_out = coverage(sd_round_rect(x + 0.5, y + 0.5, half, half, half, half, outer_r))
            if a_out <= 0.0:
                continue

            # 135deg gradient: constant along the anti-diagonal
            t = (x + y) / (2.0 * n)
            r = PURPLE[0] + (CYAN[0] - PURPLE[0]) * t
            g = PURPLE[1] + (CYAN[1] - PURPLE[1]) * t
            b = PURPLE[2] + (CYAN[2] - PURPLE[2]) * t

            a_in = coverage(
                sd_round_rect(x + 0.5, y + 0.5, half, half, inner_hw, inner_hw, inner_r)
            )
            if a_in > 0.0:
                r = r + (DARK[0] - r) * a_in
                g = g + (DARK[1] - g) * a_in
                b = b + (DARK[2] - b) * a_in

            i = (y * size + x) * 4
            px[i] = int(r + 0.5)
            px[i + 1] = int(g + 0.5)
            px[i + 2] = int(b + 0.5)
            px[i + 3] = int(a_out * 255 + 0.5)
    return px


def chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path, size, px):
    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)                       # filter type 0 (None)
        raw += px[y * stride:(y + 1) * stride]
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as fh:
        fh.write(png)
    return len(png)


ICONS = [
    # name,                     size, outer radius, inset, inner radius
    ("icon-192.png",             192, 0.22, 0.17, 0.11),
    ("icon-512.png",             512, 0.22, 0.17, 0.11),
    ("apple-touch-icon-180.png", 180, 0.00, 0.17, 0.11),   # iOS masks it itself
    # Maskable: full bleed, and the mark pulled well inside the 80% safe
    # zone so no launcher shape can crop it.
    ("icon-maskable-512.png",    512, 0.00, 0.30, 0.08),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, size, orad, inset, irad in ICONS:
        px = render(size, orad, inset, irad)
        path = os.path.normpath(os.path.join(OUT, name))
        n = write_png(path, size, px)
        print("%-28s %4dpx  %6d bytes" % (name, size, n))


if __name__ == "__main__":
    main()
