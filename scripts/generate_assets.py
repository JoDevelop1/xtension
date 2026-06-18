from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

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


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def crop_cover(source, size, crop=None, centering=(0.5, 0.5)):
    img = source.crop(crop) if crop else source.copy()
    return ImageOps.fit(img, size, method=Image.Resampling.LANCZOS, centering=centering)


def paste_rounded_image(base, image, xy, radius, outline="#d6e0e6", shadow=True):
    x, y = xy
    w, h = image.size

    if shadow:
        shadow_layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow_layer)
        sd.rounded_rectangle((x, y + 12, x + w, y + h + 12), radius=radius, fill=(15, 20, 25, 34))
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(18))
        base.alpha_composite(shadow_layer)

    card = Image.new("RGBA", image.size, (0, 0, 0, 0))
    card.alpha_composite(image.convert("RGBA"))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, outline=outline, width=2)
    base.paste(card, xy, rounded_mask(image.size, radius))


def draw_wrapped(draw, text, xy, max_width, text_font, fill, line_gap=8):
    x, y = xy
    lines = []
    line = ""

    for word in text.split():
        candidate = word if not line else f"{line} {word}"
        bbox = draw.textbbox((0, 0), candidate, font=text_font)
        if bbox[2] - bbox[0] <= max_width:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = word

    if line:
        lines.append(line)

    cursor_y = y
    for line in lines:
        draw.text((x, cursor_y), line, fill=fill, font=text_font)
        bbox = draw.textbbox((0, 0), line, font=text_font)
        cursor_y += bbox[3] - bbox[1] + line_gap

    return cursor_y


def draw_chip(draw, xy, label, color):
    x, y = xy
    chip_font = font(17, True)
    bbox = draw.textbbox((0, 0), label, font=chip_font)
    w = bbox[2] - bbox[0] + 46
    h = 38
    draw.rounded_rectangle((x, y, x + w, y + h), radius=19, fill="#ffffff", outline="#d8e0e5", width=1)
    draw.ellipse((x + 14, y + 13, x + 24, y + 23), fill=color)
    draw.text((x + 32, y + 8), label, fill="#0f1419", font=chip_font)
    return w


def load_store_screenshot():
    source = STORE / "screenshot-1-1280x800.png"
    if source.exists():
        return Image.open(source).convert("RGB")

    fallback = Image.new("RGB", (1280, 800), "#f7f9f9")
    d = ImageDraw.Draw(fallback)
    d.text((80, 80), "X/Twitter menu", fill="#0f1419", font=font(42, True))
    d.rounded_rectangle((580, 80, 1120, 730), radius=28, fill="#ffffff", outline="#d8e0e5", width=2)
    for i, label in enumerate(["Boost", "Pin to your profile", "View post activity", "Download as PDF", "Embed post"]):
        y = 150 + i * 110
        d.text((680, y), label, fill="#0f1419", font=font(30, True))
    d.rounded_rectangle((600, 478, 1030, 590), radius=0, outline="#e53935", width=8)
    return fallback


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
    img = Image.new("RGBA", (width, height), "#f5f8fa")
    d = ImageDraw.Draw(img)
    source = load_store_screenshot()

    stripe_h = 8 if marquee else 6
    stripe_w = width // 4
    for i, color in enumerate(LOGO_COLORS):
        d.rectangle((i * stripe_w, 0, (i + 1) * stripe_w if i < 3 else width, stripe_h), fill=color)

    if marquee:
        screenshot_img = crop_cover(source, (742, 490), crop=(70, 0, 1240, 800), centering=(0.53, 0.55))
        paste_rounded_image(img, screenshot_img, (612, 34), 28)

        mark = icon(92)
        img.alpha_composite(mark, (58, 44))
        d.text((168, 46), "Xtension", fill="#0f1419", font=font(46, True))
        d.text((170, 105), "Improve your X/Twitter experience", fill="#536471", font=font(25))

        d.text((62, 190), "Useful tools,", fill="#0f1419", font=font(58, True))
        d.text((62, 255), "inside the post menu.", fill="#0f1419", font=font(58, True))
        draw_wrapped(
            d,
            "Add practical actions to X/Twitter where you already work with posts, threads, articles, and media.",
            (66, 344),
            470,
            font(24),
            "#536471",
            9,
        )

        chip_x = 66
        for label, color in [("Posts", "#4285f4"), ("Threads", "#34a853"), ("Articles", "#fbbc05")]:
            chip_x += draw_chip(d, (chip_x, 462), label, color) + 12

        d.rounded_rectangle((648, 444, 905, 492), radius=24, fill="#0f1419")
        d.text((676, 454), "New action in the menu", fill="#ffffff", font=font(20, True))
    else:
        mark = icon(58)
        img.alpha_composite(mark, (26, 22))
        d.text((96, 27), "Xtension", fill="#0f1419", font=font(29, True))
        d.text((98, 66), "Improve your X/Twitter experience", fill="#536471", font=font(16))

        d.text((28, 114), "Tools in the X menu", fill="#0f1419", font=font(30, True))

        screenshot_img = crop_cover(source, (392, 100), crop=(565, 555, 1225, 730), centering=(0.5, 0.56))
        paste_rounded_image(img, screenshot_img, (24, 170), 18, shadow=True)

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
    d.text((836, 314), "PDF saved by the browser.", fill="#536471", font=font(15))

    if variant == 2:
        rounded_rectangle(d, (760, 470, 1136, 710), 18, "#ffffff", "#d8e0e5", 2)
        d.text((804, 512), "PDF generated", fill="#0f1419", font=font(26, True))
        d.text((804, 560), "Headings, paragraphs, lists, and images.", fill="#536471", font=font(18))
        d.rectangle((804, 612, 1090, 634), fill="#e53935")

    img.save(path)


def main():
    save_icons()
    if not (STORE / "screenshot-1-1280x800.png").exists():
        screenshot(STORE / "screenshot-1-1280x800.png", 1)
    if not (STORE / "screenshot-2-1280x800.png").exists():
        screenshot(STORE / "screenshot-2-1280x800.png", 2)
    promo(440, 280, STORE / "promo-small-440x280.png", marquee=False)
    promo(1400, 560, STORE / "promo-marquee-1400x560.png", marquee=True)


if __name__ == "__main__":
    main()
