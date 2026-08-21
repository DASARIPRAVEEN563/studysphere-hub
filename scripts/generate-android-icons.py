#!/usr/bin/env python3
"""
Generate Android launcher icons from public/logo-3d.png.
Run this from the project root folder.
"""

from pathlib import Path
try:
    from PIL import Image
except ImportError:
    print("Pillow is not installed. Run: pip install Pillow")
    raise SystemExit(1)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE = PROJECT_ROOT / "public" / "logo-3d.png"
RES_DIR = PROJECT_ROOT / "android" / "app" / "src" / "main" / "res"

# Foreground icon sizes for each density
DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

# Background layer sizes for adaptive icons
BACKGROUND_DENSITIES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

BACKGROUND_COLOR = (11, 16, 32)  # #0b1020 dark splash background


def make_square(img: Image.Image, size: int, padding_ratio: float = 0.12) -> Image.Image:
    """Resize image to fit inside a square with a little padding."""
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # Leave some transparent padding around the logo
    target = int(size * (1 - padding_ratio * 2))
    resized = img.copy()
    resized.thumbnail((target, target), Image.LANCZOS)
    x = (size - resized.width) // 2
    y = (size - resized.height) // 2
    out.paste(resized, (x, y), resized)
    return out


def main():
    if not SOURCE.exists():
        print(f"Source logo not found: {SOURCE}")
        print("Please place your logo at public/logo-3d.png")
        raise SystemExit(1)

    if not RES_DIR.exists():
        print(f"Android res folder not found: {RES_DIR}")
        print("Did you run 'npx cap add android' first?")
        raise SystemExit(1)

    logo = Image.open(SOURCE).convert("RGBA")

    for folder, size in DENSITIES.items():
        target_dir = RES_DIR / folder
        target_dir.mkdir(parents=True, exist_ok=True)

        # Foreground (the logo)
        foreground = make_square(logo, size)
        foreground.save(target_dir / "ic_launcher_foreground.png")

        # Simple legacy icon (same as foreground on dark background)
        legacy = Image.new("RGBA", (size, size), BACKGROUND_COLOR)
        legacy.paste(foreground, (0, 0), foreground)
        legacy.save(target_dir / "ic_launcher.png")

        print(f"Generated {folder}/ic_launcher_foreground.png ({size}x{size})")
        print(f"Generated {folder}/ic_launcher.png ({size}x{size})")

    for folder, size in BACKGROUND_DENSITIES.items():
        target_dir = RES_DIR / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        background = Image.new("RGBA", (size, size), BACKGROUND_COLOR)
        background.save(target_dir / "ic_launcher_background.png")
        print(f"Generated {folder}/ic_launcher_background.png ({size}x{size})")

    print("\nDone! Now rebuild the APK:")
    print("  cd android")
    print("  ./gradlew assembleDebug   (Windows: gradlew.bat assembleDebug)")


if __name__ == "__main__":
    main()
