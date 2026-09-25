"""Create the existing splash/title text without a static C, for animated SVG overlay."""
from pathlib import Path
import sys
from PIL import Image, ImageDraw
from brand_original import grid, font, text_center, CYAN, BLUE, GOLD

root = Path(sys.argv[1]) / "res"


def lettering(image, top, scale, tagline):
    width = image.width
    draw = ImageDraw.Draw(image)
    text_center(draw, round(top + 150 * scale), "CUSTOM", font(round(68 * scale)), "#ffffff", width)
    pieces = (("SERVICIOS", CYAN), ("R", BLUE), ("S", GOLD))
    face = font(round(66 * scale))
    x = (width - sum(draw.textlength(word, font=face) for word, _ in pieces)) / 2
    for word, color in pieces:
        draw.text((x, round(top + 225 * scale)), word, font=face, fill=color)
        x += draw.textlength(word, font=face)
    if tagline:
        text_center(draw, round(top + 320 * scale),
                    "TECNOLOGIA  •  SEGURIDAD  •  CONFIANZA",
                    font(round(22 * scale), False), (151, 172, 192), width)


splash = grid((1080, 1920))
lettering(splash, 690, 1.35, True)
splash.save(root / "drawable-nodpi" / "csrs_splash.png", optimize=True)
splash.save(root / "drawable-xxhdpi" / "startup_bg.png", optimize=True)
title = Image.new("RGBA", (900, 430), (0, 0, 0, 0))
lettering(title, 0, 1, False)
title.save(root / "drawable-xxhdpi" / "login_title.png", optimize=True)
print("Splash and login lettering rendered; animated C uses original SVG")
