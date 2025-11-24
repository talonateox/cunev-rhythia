import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { rgb } from "./colors";

const BLUR_CACHE_DIR = path.join(process.cwd(), "cache", "blurred");
const COLOR_CACHE_DIR = path.join(process.cwd(), "cache", "colors");

if (!fs.existsSync(BLUR_CACHE_DIR)) {
  fs.mkdirSync(BLUR_CACHE_DIR, { recursive: true });
}

if (!fs.existsSync(COLOR_CACHE_DIR)) {
  fs.mkdirSync(COLOR_CACHE_DIR, { recursive: true });
}

export interface AccentColor {
  r: number;
  g: number;
  b: number;
}

function getBlurredImagePath(imagePath: string, blurRadius: number): string {
  const hash = crypto
    .createHash("md5")
    .update(`${imagePath}-blur-${blurRadius}`)
    .digest("hex");
  const filename = `blurred-${hash}.png`;
  return path.join(BLUR_CACHE_DIR, filename);
}

function getColorCachePath(imagePath: string): string {
  const hash = crypto
    .createHash("md5")
    .update(`${imagePath}-color`)
    .digest("hex");
  return path.join(COLOR_CACHE_DIR, `${hash}.json`);
}

function calculateSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  if (max === 0) return 0;
  return diff / max;
}

async function extractAccentColor(
  imageInput: Buffer | string
): Promise<AccentColor> {
  try {
    const { data, info } = await sharp(imageInput)
      .resize(20, 20) 
      .raw()
      .toBuffer({ resolveWithObject: true });

    let bestColor = { r: 100, g: 100, b: 100 };
    let bestSaturation = 0;

    for (let i = 0; i < data.length; i += info.channels * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const brightness = (r + g + b) / 3;
      if (brightness < 30 || brightness > 220) continue;

      const saturation = calculateSaturation(r, g, b);

      if (saturation > bestSaturation) {
        bestSaturation = saturation;
        bestColor = { r, g, b };
      }
    }

    if (bestSaturation < 0.1) {
      return { r: 120, g: 120, b: 160 }; 
    }

    return bestColor;
  } catch (error) {
    console.error("Failed to extract accent color:", error);
    return { r: 120, g: 120, b: 160 }; 
  }
}

export async function getBlurredImageWithColor(
  imagePath: string,
  blurRadius: number = 20
): Promise<{ path: string; accentColor: AccentColor }> {
  const blurredPath = getBlurredImagePath(imagePath, blurRadius);
  const colorCachePath = getColorCachePath(imagePath);

  if (fs.existsSync(blurredPath) && fs.existsSync(colorCachePath)) {
    const cachedColor = JSON.parse(fs.readFileSync(colorCachePath, "utf-8"));
    return { path: blurredPath, accentColor: cachedColor };
  }

  try {
    let imageInput: Buffer | string;

    if (imagePath.startsWith("http")) {
      const response = await fetch(imagePath);
      const arrayBuffer = await response.arrayBuffer();
      imageInput = Buffer.from(arrayBuffer);
    } else {
      const resolvedPath = path.resolve(imagePath);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Image file not found: ${resolvedPath}`);
      }
      imageInput = resolvedPath;
    }

    const accentColor = await extractAccentColor(imageInput);

    fs.writeFileSync(colorCachePath, JSON.stringify(accentColor));

    if (!fs.existsSync(blurredPath)) {
      await sharp(imageInput)
        .resize(480, 270, {
          fit: "cover",
          position: "center",
        })
        .blur(Math.max(5, blurRadius / 4))
        .png({ quality: 70 })
        .toFile(blurredPath);
    }

    return { path: blurredPath, accentColor };
  } catch (error) {
    console.error(`Failed to process image ${imagePath}:`, error);
    return {
      path: imagePath,
      accentColor: { r: 100, g: 100, b: 100 },
    };
  }
}

export async function getBlurredImage(
  imagePath: string,
  blurRadius: number = 20
): Promise<string> {
  const blurredPath = getBlurredImagePath(imagePath, blurRadius);

  if (fs.existsSync(blurredPath)) {
    return blurredPath;
  }

  try {
    let imageInput: Buffer | string;

    if (imagePath.startsWith("http")) {
      const response = await fetch(imagePath);
      const arrayBuffer = await response.arrayBuffer();
      imageInput = Buffer.from(arrayBuffer);
    } else {
      const resolvedPath = path.resolve(imagePath);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Image file not found: ${resolvedPath}`);
      }
      imageInput = resolvedPath;
    }

    await sharp(imageInput)
      .resize(480, 270, {
        fit: "cover",
        position: "center",
      })
      .blur(Math.max(5, blurRadius / 4)) 
      .png({ quality: 70 }) 
      .toFile(blurredPath);

    return blurredPath;
  } catch (error) {
    console.error(`Failed to blur image ${imagePath}:`, error);
    return imagePath;
  }
}

export async function preloadBlurredImage(
  imagePath: string,
  blurRadius: number = 20
): Promise<void> {
  try {
    await getBlurredImage(imagePath, blurRadius);
  } catch (error) {
    console.error(`Failed to preload blurred image:`, error);
  }
}

export function clearBlurCache(): void {
  if (fs.existsSync(BLUR_CACHE_DIR)) {
    const files = fs.readdirSync(BLUR_CACHE_DIR);
    files.forEach((file) => {
      fs.unlinkSync(path.join(BLUR_CACHE_DIR, file));
    });
  }
}
