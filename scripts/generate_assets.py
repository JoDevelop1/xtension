from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ICONS = ASSETS / "icons"
STORE = ROOT / "store-assets"
LOGO_COLORS = ("#4285f4", "#ea4335", "#fbbc05", "#34a853")
LOGO_OUTER_PATH = [
    (62, 0), (276, 304), (20, 714), (223, 714), (384, 456), (565, 714),
    (630, 714), (414, 407), (669, 0), (466, 0), (307, 254), (127, 0)
]
LOGO_INNER_PATH = [(495, 53), (574, 53), (194, 661), (115, 661)]
LOGO_TRANSFORM_TRANSLATE = (77.756303, 962.0)
LOGO_TRANSFORM_SCALE = (1.260504, -1.260504)


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
    scale_factor = 4 if size <= 128 else 2
    canvas_size = size * scale_factor
    mask = Image.new("L", (canvas_size, canvas_size), 0)
    d = ImageDraw.Draw(mask)

    d.polygon(scale_logo_path(LOGO_OUTER_PATH, canvas_size), fill=255)
    d.polygon(scale_logo_path(LOGO_INNER_PATH, canvas_size), fill=0)

    outline_radius = max(2, round(canvas_size * 18 / 1024))
    outline_mask = expand_mask(mask, outline_radius)
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    outline = Image.new("RGBA", (canvas_size, canvas_size), "#050505")
    img.alpha_composite(Image.composite(outline, img, outline_mask))

    color_layer = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    color_draw = ImageDraw.Draw(color_layer)
    c = canvas_size / 2
    color_draw.polygon([(0, 0), (c, 0), (c, c), (0, c)], fill=LOGO_COLORS[0])
    color_draw.polygon([(c, 0), (canvas_size, 0), (canvas_size, c), (c, c)], fill=LOGO_COLORS[1])
    color_draw.polygon([(0, c), (c, c), (c, canvas_size), (0, canvas_size)], fill=LOGO_COLORS[2])
    color_draw.polygon([(c, c), (canvas_size, c), (canvas_size, canvas_size), (c, canvas_size)], fill=LOGO_COLORS[3])
    colored = Image.composite(color_layer, Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0)), mask)
    img.alpha_composite(colored)

    if size != canvas_size:
        img = img.resize((size, size), Image.Resampling.LANCZOS)

    return img


def scale_logo_path(points, canvas_size):
    scale = canvas_size / 1024
    translate_x, translate_y = LOGO_TRANSFORM_TRANSLATE
    scale_x, scale_y = LOGO_TRANSFORM_SCALE

    return [
        (
            (translate_x + x * scale_x) * scale,
            (translate_y + y * scale_y) * scale
        )
        for x, y in points
    ]


def expand_mask(mask, radius):
    if radius <= 0:
        return mask

    expanded = mask
    remaining = radius

    while remaining > 0:
        step = min(4, remaining)
        expanded = expanded.filter(ImageFilter.MaxFilter(step * 2 + 1))
        remaining -= step

    return expanded


def pdf_menu_icon(size):
    scale = size / 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def s(v):
        return round(v * scale)

    black = "#0f1419"
    white = "#ffffff"

    page = [
        (s(54), s(30)),
        (s(316), s(30)),
        (s(452), s(166)),
        (s(452), s(486)),
        (s(54), s(486)),
    ]
    d.polygon(page, fill=white)
    d.line(page + [page[0]], fill=black, width=s(24), joint="curve")
    d.line([(s(316), s(30)), (s(316), s(166)), (s(452), s(166))], fill=black, width=s(18), joint="curve")
    d.polygon([(s(316), s(30)), (s(452), s(166)), (s(316), s(166))], fill=white)
    d.line([(s(316), s(30)), (s(452), s(166))], fill=black, width=s(18))

    text = "PDF"
    text_font = font(s(156), True)
    bbox = d.textbbox((0, 0), text, font=text_font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    d.text(
        (s(252) - text_w / 2, s(318) - text_h / 2 - bbox[1]),
        text,
        fill=black,
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
