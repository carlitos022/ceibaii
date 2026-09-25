"""Render CustomServiciosRS artwork for the original CEIBA II resource shell.

Usage: python brand_original.py PATH_TO_APKTOOL_DECODED_DIR
Only login, splash, and launcher drawable files are written.
"""
from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(sys.argv[1]) / "res"
NAVY = (2, 12, 23)
CYAN = (19, 190, 234)
BLUE = (0, 123, 255)
GOLD = (255, 176, 0)


def font(size, bold=True):
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    path = Path("C:/Windows/Fonts") / name
    if not path.exists():
        path = Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf")
    return ImageFont.truetype(str(path), size)


def grid(size, strength=15):
    w, h = size
    im = Image.new("RGB", size, NAVY)
    draw = ImageDraw.Draw(im)
    for x in range(0, w, 54):
        draw.line((x, 0, x, h), fill=(11 + strength, 25 + strength, 38 + strength), width=1)
    for y in range(0, h, 54):
        draw.line((0, y, w, y), fill=(11 + strength, 25 + strength, 38 + strength), width=1)
    return im


def text_center(draw, y, label, fnt, color, width):
    box = draw.textbbox((0, 0), label, font=fnt)
    draw.text(((width - (box[2] - box[0])) / 2, y), label, font=fnt, fill=color)


def emblem(im, cx, cy, radius):
    lay = Image.new("RGBA", im.size)
    d = ImageDraw.Draw(lay)
    w = max(7, round(radius * 0.23))
    bbox = (cx - radius, cy - radius, cx + radius, cy + radius)
    d.arc(bbox, 42, 315, fill=(*CYAN, 255), width=w)
    dot = (cx + radius * .63, cy - radius * .73)
    d.ellipse((dot[0] - w * .74, dot[1] - w * .74,
               dot[0] + w * .74, dot[1] + w * .74), fill=(*GOLD, 255))
    glow = lay.filter(ImageFilter.GaussianBlur(max(2, radius * .08)))
    glow.putalpha(glow.getchannel("A").point(lambda x: x // 3))
    im.paste(glow, (0, 0), glow)
    im.paste(lay, (0, 0), lay)


def brand(im, top, scale=1.0, tagline=True):
    w, _ = im.size
    d = ImageDraw.Draw(im)
    emblem(im, w // 2, round(top + 72 * scale), round(62 * scale))
    d = ImageDraw.Draw(im)
    text_center(d, round(top + 150 * scale), "CUSTOM", font(round(68 * scale)), "#ffffff", w)
    f = font(round(66 * scale))
    pieces = (("SERVICIOS", CYAN), ("R", (0, 138, 245)), ("S", GOLD))
    total = sum(d.textlength(t, font=f) for t, _ in pieces)
    x = (w - total) / 2
    for t, color in pieces:
        d.text((x, round(top + 225 * scale)), t, font=f, fill=color)
        x += d.textlength(t, font=f)
    if tagline:
        text_center(d, round(top + 320 * scale), "TECNOLOGIA  •  SEGURIDAD  •  CONFIANZA",
                    font(round(22 * scale), False), (151, 172, 192), w)


def icon(size):
    im = Image.new("RGBA", (size, size), (3, 18, 31, 255))
    emblem(im, size // 2, round(size * .54), round(size * .27))
    return im


def write():
    splash = grid((1080, 1920))
    brand(splash, 690, 1.35)
    out = ROOT / "drawable-nodpi" / "csrs_splash.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    splash.save(out, optimize=True)

    background = grid((1080, 1920), 11)
    for name in ("login_bkg.png", "login_bg.png"):
        background.save(ROOT / "drawable-xxhdpi" / name, optimize=True)

    title = Image.new("RGBA", (900, 430), (0, 0, 0, 0))
    brand(title, 0, 1, tagline=False)
    title.save(ROOT / "drawable-xxhdpi" / "login_title.png", optimize=True)

    for name, color in (("login_btn.png", CYAN), ("login_btn_sel.png", BLUE)):
        btn = Image.new("RGBA", (206, 206), (0, 0, 0, 0))
        d = ImageDraw.Draw(btn)
        d.rounded_rectangle((1, 1, 205, 205), radius=34, fill=(*color, 255))
        d.line(((67, 103), (141, 103), (119, 78)), fill="white", width=9, joint="curve")
        d.line(((141, 103), (119, 128)), fill="white", width=9, joint="curve")
        btn.save(ROOT / "drawable-xxhdpi" / name, optimize=True)

    icon(512).save(ROOT / "drawable-xxhdpi" / "ceibaii_icon.png", optimize=True)
    for density, size in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96),
                          ("xxhdpi", 144), ("xxxhdpi", 192)):
        folder = ROOT / ("mipmap-" + density)
        for name in ("ic_launcher.png", "ic_launcher_round.png"):
            if (folder / name).exists():
                icon(size).save(folder / name, optimize=True)
    splash_xml = ROOT / "layout" / "activity_splash.xml"
    xml = splash_xml.read_text(encoding="utf-8-sig")
    if 'android:src="@drawable/csrs_splash"' not in xml:
        xml = xml.replace('android:id="@id/splash_image"',
                          'android:id="@id/splash_image" android:src="@drawable/csrs_splash" android:scaleType="centerCrop"')
    splash_xml.write_text(xml, encoding="utf-8")
    strings_xml = ROOT / "values" / "strings.xml"
    xml = strings_xml.read_text(encoding="utf-8-sig")
    xml = xml.replace('<string name="app_name">CEIBA II</string>',
                      '<string name="app_name">CustomServiciosRS CEIBA II</string>')
    strings_xml.write_text(xml, encoding="utf-8")
    print("Rendered splash, login, launcher, and resource references")


if __name__ == "__main__":
    write()
