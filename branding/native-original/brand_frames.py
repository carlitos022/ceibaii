"""Render reliable Android animation-list frames from the company SVG geometry.

Usage: python brand_frames.py PATH_TO_APKTOOL_DECODED_DIR
Run after brand_v2.py created the splash and title backgrounds without the C.
"""
from pathlib import Path
from math import sin, pi
import sys
from PIL import Image, ImageDraw, ImageFilter

root = Path(sys.argv[1]) / "res"
steps = 24
duration_ms = 125


def cubic(p0, p1, p2, p3, count=80):
    return [((1-t)**3*p0[0]+3*(1-t)**2*t*p1[0]+3*(1-t)*t*t*p2[0]+t**3*p3[0],
             (1-t)**3*p0[1]+3*(1-t)**2*t*p1[1]+3*(1-t)*t*t*p2[1]+t**3*p3[1])
            for t in (i/count for i in range(count+1))]


# Exact cubic geometry from ceiba_logo_animado.svg (viewBox 0 0 1024 1024).
path = (cubic((720,512),(720,626.9),(626.9,720),(512,720)) +
        cubic((512,720),(397.1,720),(304,626.9),(304,512))[1:] +
        cubic((304,512),(304,397.1),(397.1,304),(512,304))[1:] +
        cubic((512,304),(557.4,304),(599.4,318.6),(633.7,343.3))[1:])


def symbol(size, progress):
    # Supersampling keeps the stroke smooth at both native display sizes.
    scale = size * 2 / 1024
    canvas = Image.new("RGBA", (size*2, size*2))
    glow = Image.new("RGBA", canvas.size)
    draw = ImageDraw.Draw(canvas)
    dots = [(round(x*scale), round(y*scale)) for x,y in path]
    width = round(80*scale)
    base = (2, 154, 229, 225)
    # La curva empieza vacia, como stroke-dasharray del SVG web.
    # Evitar dibujar dos capas completas sobre el mismo fotograma.

    count = max(2, round(len(dots)*progress))
    shine = ImageDraw.Draw(glow)
    trace = dots[:count]
    shine.line(trace, fill=(0,229,255,180), width=width+round(14*scale), joint="curve")
    bright = glow.filter(ImageFilter.GaussianBlur(max(2,round(14*scale))))
    canvas.alpha_composite(bright)
    draw = ImageDraw.Draw(canvas)
    draw.line(trace, fill=(0,215,255,245), width=width, joint="curve")
    dot_x = round(650*scale)
    dot_y = round((350-20*sin(2*pi*progress))*scale)
    radius = round(100*scale)
    draw.ellipse((dot_x-radius,dot_y-radius,dot_x+radius,dot_y+radius), fill=(255,175,0,255))
    draw.ellipse((dot_x-radius//2,dot_y-radius//2,dot_x,dot_y), fill=(255,198,18,255))
    return canvas.resize((size,size), Image.Resampling.LANCZOS)


def overlay(background, logo, center_x, center_y):
    output = background.copy().convert("RGBA")
    output.alpha_composite(logo, (center_x-logo.width//2, center_y-logo.height//2))
    return output


def animation_xml(names):
    lines = ['<?xml version="1.0" encoding="utf-8"?>',
             '<animation-list xmlns:android="http://schemas.android.com/apk/res/android" android:oneshot="true">']
    lines += [f'    <item android:drawable="@drawable/{name}" android:duration="{duration_ms}" />' for name in names]
    return "\n".join(lines + ['</animation-list>', ''])


splash_base = Image.open(root / "drawable-nodpi" / "csrs_splash.png").convert("RGBA")
login_base = Image.open(root / "drawable-xxhdpi" / "login_title.png").convert("RGBA")
splash_names, login_names = [], []
for number in range(steps):
    progress = (number+1)/steps
    # The full silhouette is visible in frame zero; the glow travels along it.
    splash_name = f"csrs_splash_frame_{number:02d}"
    login_name = f"csrs_login_frame_{number:02d}"
    splash_names.append(splash_name)
    login_names.append(login_name)
    overlay(splash_base, symbol(320,progress),540,787).convert("RGB").resize(
        (540,960),Image.Resampling.LANCZOS).save(
        root / "drawable-nodpi" / (splash_name+".png"), optimize=True)
    overlay(login_base, symbol(300,1.0),450,82).save(
        root / "drawable-xxhdpi" / (login_name+".png"), optimize=True)

(root / "drawable-nodpi" / "csrs_splash_anim.xml").write_text(animation_xml(splash_names), encoding="utf-8")
(root / "drawable-xxhdpi" / "login_title.png").unlink()
(root / "drawable-xxhdpi" / "login_title.xml").write_text(animation_xml(login_names), encoding="utf-8")
Image.open(root / "drawable-nodpi" / "csrs_splash_frame_00.png").resize(
    (1080,1920),Image.Resampling.BICUBIC).save(
        root / "drawable-xxhdpi" / "startup_bg.png", optimize=True)
print(f"Rendered {steps} full-logo splash and login frames")
