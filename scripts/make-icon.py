#!/usr/bin/env python3
"""M15：生成应用图标（resources/icon.icns + resources/icon.png）。

设计：macOS 圆角方块（squircle），蓝→靛渐变背景，
白色「打开的书」+ 一截橙色高亮笔道（呼应 阅读辅助 + AI 高亮 主题）。

用法：python3 scripts/make-icon.py   # 依赖 Pillow；本机已装（python3 -c 'import PIL'）
"""
import os
import subprocess
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "resources")
SIZE = 1024

RADIUS = 185  # squircle 圆角
TOP = (72, 136, 250)      # 渐变顶 #4888FA
BOTTOM = (90, 84, 214)    # 渐变底 #5A54D6


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_icon():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 渐变背景（逐行填充圆角矩形内部）
    for y in range(SIZE):
        t = y / (SIZE - 1)
        d.line([(0, y), (SIZE, y)], fill=lerp(TOP, BOTTOM, t) + (255,))

    # 用 alpha 蒙版抠出圆角方块
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=RADIUS, fill=255)
    img.putalpha(mask)

    d = ImageDraw.Draw(img)

    # ---- 打开的书（白色，左右两页 + 中间书脊）----
    # 比例基准：页面区域大约占宽度 0.64、高度 0.46，居中略偏上
    cx = SIZE / 2
    top_y = SIZE * 0.30
    page_h = SIZE * 0.46
    half_w = SIZE * 0.32
    # 左右页内侧下沉（书脊），外侧略上翘，形成打开感
    left = [
        (cx - half_w, top_y + page_h * 0.06),  # 左页外侧上
        (cx, top_y + page_h * 0.16),           # 左页内侧上（书脊）
        (cx, top_y + page_h * 0.92),           # 左页内侧下
        (cx - half_w, top_y + page_h * 0.84),  # 左页外侧下
    ]
    right = [
        (cx, top_y + page_h * 0.16),           # 右页内侧上
        (cx + half_w, top_y + page_h * 0.06),  # 右页外侧上
        (cx + half_w, top_y + page_h * 0.84),  # 右页外侧下
        (cx, top_y + page_h * 0.92),           # 右页内侧下
    ]
    for poly in (left, right):
        d.polygon(poly, fill=(255, 255, 255, 255))

    # 书脊高光（两页交汇处一道细白线）
    d.line([(cx, top_y + page_h * 0.16), (cx, top_y + page_h * 0.92)], fill=(255, 255, 255, 210), width=6)

    # 页面上的文字行（浅灰蓝横线，营造"书页"感）。页面中心在书脊线上。
    # 定义左右两页内边距：页内左留白 pad_l、右留白 pad_r（相对 half_w）。
    line_col = (214, 224, 248, 200)
    lw = 14
    # 左页：行从 pad_l→(1-pad_r)，页内横坐标范围 [cx-half_w, cx]
    pad_l, pad_r = 0.18, 0.08
    for i in range(3):
        y = top_y + page_h * (0.30 + i * 0.17)
        x0 = cx - half_w + half_w * pad_l
        x1 = cx - half_w * pad_r
        d.rounded_rectangle([x0, y, x1, y + lw], radius=7, fill=line_col)
    # 右页 2 行（第 3 行位置让给高亮笔道）
    for i in range(2):
        y = top_y + page_h * (0.30 + i * 0.17)
        x0 = cx + half_w * pad_l
        x1 = cx + half_w - half_w * pad_r
        d.rounded_rectangle([x0, y, x1, y + lw], radius=7, fill=line_col)

    # 橙色高亮笔道（横跨右页第 3 行，呼应 AI 高亮）
    hl_y = top_y + page_h * (0.30 + 2 * 0.17)
    hl_x0 = cx + half_w * (pad_l - 0.02)
    hl_x1 = cx + half_w * (0.78)
    d.rounded_rectangle([hl_x0, hl_y, hl_x1, hl_y + lw], radius=8, fill=(255, 173, 51, 235))

    # 底部"书页"弧线（书的封底边）——在书下方画一道柔和弧形增强层次
    d.arc(
        [cx - half_w * 0.7, top_y + page_h * 1.04, cx + half_w * 0.7, top_y + page_h * 1.24],
        start=10, end=170, fill=(255, 255, 255, 120), width=10,
    )

    return img


def build_icns(src):
    """用 iconutil 生成 .icns（需要 iconset 目录结构）。"""
    iconset = os.path.join(RES, "icon.iconset")
    if os.path.exists(iconset):
        subprocess.run(["rm", "-rf", iconset], check=True)
    os.makedirs(iconset, exist_ok=True)
    sizes = [(16, "icon_16x16.png", 1), (32, "icon_16x16@2x.png", 2),
             (32, "icon_32x32.png", 1), (64, "icon_32x32@2x.png", 2),
             (128, "icon_128x128.png", 1), (256, "icon_128x128@2x.png", 2),
             (256, "icon_256x256.png", 1), (512, "icon_256x256@2x.png", 2),
             (512, "icon_512x512.png", 1), (1024, "icon_512x512@2x.png", 2)]
    for px, name, scale in sizes:
        img = src.resize((px, px), Image.LANCZOS)
        img.save(os.path.join(iconset, name))
    subprocess.run(["iconutil", "-c", "icns", iconset, "-o", os.path.join(RES, "icon.icns")], check=True)
    subprocess.run(["rm", "-rf", iconset], check=True)
    # 顶层 1024 png 供 dmg / README 引用
    src.save(os.path.join(RES, "icon.png"))
    print(f"→ {os.path.join(RES, 'icon.icns')}  /  icon.png")


if __name__ == "__main__":
    build_icns(draw_icon())
