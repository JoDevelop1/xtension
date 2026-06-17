from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ICONS = ASSETS / "icons"
STORE = ROOT / "store-assets"


def font(size, bold=False):
    names = [
        "segoeuib.ttf" if bold else "segoeui.ttf",
        "arialbd.ttf" if bold else "arial.ttf",
    ]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def rounded_rectangle(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def icon(size):
    canvas_size = size * 4
    scale = canvas_size / 1024
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def s(v):
        return round(v * scale)

    black = "#050505"
    clear = (0, 0, 0, 0)

    # Stylized U+1D54F Mathematical Double-Struck Capital X, drawn as vector
    # geometry so the build does not depend on platform emoji fonts.
    d.polygon([(s(240), s(170)), (s(404), s(170)), (s(812), s(854)), (s(648), s(854))], fill=black)
    d.polygon([(s(212), s(854)), (s(382), s(854)), (s(808), s(170)), (s(638), s(170))], fill=black)

    d.polygon([(s(326), s(236)), (s(390), s(236)), (s(724), s(788)), (s(660), s(788))], fill=clear)

    d.rectangle((s(226), s(170), s(456), s(226)), fill=black)
    d.rectangle((s(568), s(170), s(808), s(226)), fill=black)
    d.rectangle((s(214), s(798), s(438), s(854)), fill=black)
    d.rectangle((s(586), s(798), s(812), s(854)), fill=black)

    if size != canvas_size:
        img = img.resize((size, size), Image.Resampling.LANCZOS)

    return img


def pdf_menu_icon(size):
    scale = size / 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def s(v):
        return round(v * scale)

    red = "#ef202b"
    red_dark = "#c91822"
    red_light = "#f26b71"
    white = "#ffffff"

    body = (s(38), s(28), s(420), s(486))
    d.rounded_rectangle(body, radius=s(48), fill=red)
    d.rectangle((s(260), s(28), s(420), s(190)), fill=red)
    d.polygon([(s(300), s(28)), (s(420), s(148)), (s(300), s(148))], fill=red_light)
    d.line([(s(300), s(28)), (s(420), s(148))], fill=red_dark, width=s(4))

    text = "PDF"
    text_font = font(s(112), True)
    bbox = d.textbbox((0, 0), text, font=text_font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    d.text(
        (s(226) - text_w / 2, s(286) - text_h / 2 - bbox[1]),
        text,
        fill=white,
        font=text_font,
    )
    return img


def save_icons():
    ICONS.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    STORE.mkdir(parents=True, exist_ok=True)

    base = icon(1024)
    base.save(ASSETS / "logo-1024.png")
    pdf_menu_icon(512).save(ASSETS / "pdf-menu-icon.png")
    for size in [16, 32, 48, 128, 256, 300, 512, 1024]:
        resized = icon(size)
        target = ICONS / f"icon-{size}.png"
        if size == 300:
            target = STORE / "logo-300.png"
        resized.save(target)


def draw_brand_header(draw, width, title, subtitle):
    draw.rectangle((0, 0, width, 132), fill="#ffffff")
    mark = icon(96)
    draw._image.alpha_composite(mark, (36, 18))
    draw.text((154, 28), title, fill="#0f1419", font=font(34, True))
    draw.text((154, 78), subtitle, fill="#536471", font=font(18))


def promo(width, height, path, marquee=False):
    img = Image.new("RGBA", (width, height), "#f7f9f9")
    d = ImageDraw.Draw(img)
    draw_brand_header(d, width, "Xtension", "Clean PDF exports from X/Twitter")

    left = 56 if marquee else 34
    top = 165 if marquee else 154
    card_w = 600 if marquee else 250
    card_h = 310 if marquee else 96
    rounded_rectangle(d, (left, top, left + card_w, top + card_h), 18, "#ffffff", "#d8e0e5", 2)

    text_x = left + 32
    d.text((text_x, top + 28), "X/Twitter", fill="#0f1419", font=font(26 if marquee else 17, True))
    d.text((text_x, top + 74), "Menu ...  ->  Download as PDF", fill="#536471", font=font(18 if marquee else 12))

    pdf_x = width - (430 if marquee else 132)
    pdf_y = 160 if marquee else 146
    rounded_rectangle(d, (pdf_x, pdf_y, pdf_x + (300 if marquee else 86), pdf_y + (330 if marquee else 105)), 22, "#ffffff", "#cfd9df", 2)
    d.rectangle((pdf_x + 36, pdf_y + 62, pdf_x + (264 if marquee else 70), pdf_y + (86 if marquee else 72)), fill="#0f1419")
    for i in range(6 if marquee else 3):
        y = pdf_y + (118 if marquee else 82) + i * (30 if marquee else 10)
        d.rectangle((pdf_x + 36, y, pdf_x + (264 if marquee else 70), y + (10 if marquee else 3)), fill="#d8e0e5")
    rounded_rectangle(d, (pdf_x + (190 if marquee else 52), pdf_y + (250 if marquee else 78), pdf_x + (286 if marquee else 82), pdf_y + (310 if marquee else 100)), 10, "#e53935")

    if marquee:
        d.text((730, 240), "Text + images", fill="#0f1419", font=font(44, True))
        d.text((730, 304), "A clean PDF from the X menu.", fill="#536471", font=font(24))

    img.convert("RGB").save(path)


def screenshot(path, variant=1):
    width, height = 1280, 800
    img = Image.new("RGB", (width, height), "#edf2f5")
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, width, 70), fill="#ffffff")
    d.text((32, 22), "x.com / twitter.com", fill="#536471", font=font(18))
    d.text((112, 22), "Thread", fill="#0f1419", font=font(18, True))

    rounded_rectangle(d, (90, 110, 690, 710), 22, "#ffffff", "#d8e0e5", 2)
    d.text((134, 150), "Thread X/Twitter", fill="#0f1419", font=font(34, True))
    d.text((134, 205), "Text, images, and same-author posts.", fill="#536471", font=font(18))
    for i in range(8):
        y = 270 + i * 34
        d.rectangle((134, y, 610 - (i % 3) * 60, y + 12), fill="#d8e0e5")
    rounded_rectangle(d, (134, 570, 610, 670), 14, "#e8f5fd", "#9bd4ff", 2)
    d.text((164, 606), "Image embedded in the PDF", fill="#1d4f7a", font=font(20, True))

    rounded_rectangle(d, (760, 138, 1136, 430), 18, "#ffffff", "#d8e0e5", 2)
    d.text((804, 180), "Menu ...", fill="#0f1419", font=font(24, True))
    d.rectangle((804, 238, 1090, 240), fill="#edf2f5")
    d.text((836, 272), "Download as PDF", fill="#0f1419", font=font(22, True))
    d.text((836, 314), "Choose the folder from Save As.", fill="#536471", font=font(15))

    if variant == 2:
        rounded_rectangle(d, (760, 470, 1136, 710), 18, "#ffffff", "#d8e0e5", 2)
        d.text((804, 512), "PDF generated", fill="#0f1419", font=font(26, True))
        d.text((804, 560), "Headings, paragraphs, lists, and images.", fill="#536471", font=font(18))
        d.rectangle((804, 612, 1090, 634), fill="#e53935")

    img.save(path)


def main():
    save_icons()
    promo(440, 280, STORE / "promo-small-440x280.png", marquee=False)
    promo(1400, 560, STORE / "promo-marquee-1400x560.png", marquee=True)
    screenshot(STORE / "screenshot-1-1280x800.png", 1)
    screenshot(STORE / "screenshot-2-1280x800.png", 2)


if __name__ == "__main__":
    main()
