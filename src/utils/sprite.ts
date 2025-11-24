import {
  Color,
  DrawTexturePro,
  LoadTexture,
  LoadTextureFromImage,
  LoadImageFromMemory,
  rlPopMatrix,
  rlPushMatrix,
  rlTranslatef,
  Vector2,
  Vector3,
  LoadImageAnimFromMemory,
  SetTextureFilter,
  TEXTURE_FILTER_BILINEAR,
  TEXTURE_FILTER_ANISOTROPIC_16X,
  TEXTURE_FILTER_TRILINEAR,
} from "raylib";
import * as path from "path";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as crypto from "crypto";
import { logger } from "./logger";

import { UnloadTexture } from "raylib";

const textureMap = new Map<string, any>();
const loadingMap = new Map(); 
const excludeList = new Set(); 
export let spriteCount = 0;

const CACHE_DIR = "./cache/images";
(async () => {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {}
})();

export function resetSpriteCount() {
  spriteCount = 0;
}

export function clearTextureCache(): void {
  try {
    for (const [key, tex] of textureMap.entries()) {
      try {
        if (tex) UnloadTexture(tex);
      } catch (e) {}
      textureMap.delete(key);
    }
  } finally {
    loadingMap.clear();
    excludeList.clear();
  }
}

export function removeTextureFromCache(cacheKey: string): void {
  const tex = textureMap.get(cacheKey);
  if (tex) {
    try {
      UnloadTexture(tex);
    } catch {}
    textureMap.delete(cacheKey);
  }
}

function isUrl(path: string): boolean {
  return path.startsWith("http://") || path.startsWith("https://");
}

function getFileExtension(url: string): string {
  const cleanUrl = url.split("?")[0]; 
  const extension = path.extname(cleanUrl).toLowerCase();
  return extension || ".png"; 
}

function getCacheFilename(
  url: string,
  format: string,
  cacheKey?: string
): string {
  const identifier = cacheKey || url;
  const hash = crypto.createHash("md5").update(identifier).digest("hex");
  return path.join(CACHE_DIR, `${hash}${format}`);
}

async function getCachedImagePath(
  url: string,
  cacheKey?: string
): Promise<string | null> {
  const formats = [".png", ".jpg", ".jpeg", ".gif", ".bmp"];
  for (const format of formats) {
    const cachePath = getCacheFilename(url, format, cacheKey);
    try {
      await fs.access(cachePath);
      return cachePath;
    } catch {}
  }
  return null;
}

function encodeImageUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    return urlObj.toString();
  } catch (error) {
    console.warn(`Invalid URL format: ${url}`, error);
    return encodeURI(url);
  }
}

async function loadTextureFromUrl(
  url: string,
  cacheKey?: string
): Promise<any> {
  try {
    const cachedPath = await getCachedImagePath(url, cacheKey);
    if (cachedPath) {
      logger(`Loading cached image for: ${cacheKey || url}`);
      const texture = LoadTexture(cachedPath);
      
      try { SetTextureFilter(texture, TEXTURE_FILTER_TRILINEAR); } catch {}
      return texture;
    }

    const encodedUrl = encodeImageUrl(url);
    const response = await fetch(encodedUrl);
    if (!response.ok) {
      if (response.status >= 400) {
        const excludeKey = cacheKey || url;
        excludeList.add(excludeKey);
        logger(`Added ${excludeKey} to exclude list (HTTP ${response.status})`);
      }
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const contentType = response.headers.get("content-type");
    let format = ".png"; 

    if (contentType) {
      if (contentType.includes("jpeg") || contentType.includes("jpg")) {
        format = ".jpg";
      } else if (contentType.includes("png")) {
        format = ".png";
      } else if (contentType.includes("gif")) {
        format = ".gif";
      } else if (contentType.includes("bmp")) {
        format = ".bmp";
      }
    } else {
      const extension = getFileExtension(url);
      if (extension) {
        format = extension;
      }
    }

    const cachePath = getCacheFilename(url, format, cacheKey);
    await fs.writeFile(cachePath, buffer);
    logger(
      `Saved image to cache: ${cachePath} (key: ${cacheKey || "url-hash"})`
    );

    const texture = LoadTexture(cachePath);
    
    try { SetTextureFilter(texture, TEXTURE_FILTER_TRILINEAR); } catch {}
    logger(`Loaded texture from URL: ${encodedUrl}`);
    return texture;
  } catch (error) {
    console.error(`Failed to load texture from URL ${url}:`, error);

    const excludeKey = cacheKey || url;
    excludeList.add(excludeKey);
    logger(`Added ${excludeKey} to exclude list due to error`);
    return null;
  }
}

export async function preCacheImage(
  url: string,
  cacheKey: string
): Promise<boolean> {
  try {
    const cachedPath = await getCachedImagePath(url, cacheKey);
    if (cachedPath) {
      logger(`Image already cached with key: ${cacheKey}`);
      return true;
    }

    const texture = await loadTextureFromUrl(url, cacheKey);
    if (texture) {
      textureMap.set(cacheKey, texture);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Failed to pre-cache image: ${error}`);
    return false;
  }
}

export function isImageCached(cacheKey: string): boolean {
  if (textureMap.has(cacheKey)) {
    return true;
  }

  const formats = [".png", ".jpg", ".jpeg", ".gif", ".bmp"];
  for (const format of formats) {
    const cachePath = getCacheFilename("", format, cacheKey);
    if (fsSync.existsSync(cachePath)) {
      return true;
    }
  }
  return false;
}

export function drawImageFromCache(
  cacheKey: string,
  position: Vector2,
  size: Vector2,
  color: Color
) {
  let targetTexture = textureMap.get(cacheKey);

  if (!targetTexture) {
    const formats = [".png", ".jpg", ".jpeg", ".gif", ".bmp"];
    for (const format of formats) {
      const cachePath = getCacheFilename("", format, cacheKey);

      if (fsSync.existsSync(cachePath)) {
        targetTexture = LoadTexture(cachePath);
        try { SetTextureFilter(targetTexture, TEXTURE_FILTER_TRILINEAR); } catch {}
        textureMap.set(cacheKey, targetTexture);
        logger(`Loaded cached image with key: ${cacheKey}`);
        break;
      }
    }
  }

  if (targetTexture) {
    spriteCount += 1;
    DrawTexturePro(
      targetTexture,
      { x: 0, y: 0, height: targetTexture.height, width: targetTexture.width },
      { x: position.x, y: position.y, height: size.y, width: size.x },
      { x: 0, y: 0 },
      0,
      color
    );
  }
}

export function drawSprite(
  path: string,
  position: Vector2,
  size: Vector2,
  color: Color,
  cacheKey?: string,
  skipPublicPrefix: boolean = false,
  smoothFiltering: boolean = true,
  rotation: number = 0,
  origin?: Vector2
) {
  const textureMapKey = cacheKey || path;
  let targetTexture = textureMap.get(textureMapKey);

  if (!targetTexture) {
    if (isUrl(path)) {
      const excludeKey = cacheKey || path;
      if (excludeList.has(excludeKey)) {
        return;
      }

      const loadingKey = cacheKey || path;
      if (loadingMap.get(loadingKey)) {
        return;
      }

      loadingMap.set(loadingKey, true);
      loadTextureFromUrl(path, cacheKey)
        .then((texture) => {
          if (texture) {
            textureMap.set(textureMapKey, texture);
          }
          loadingMap.delete(loadingKey);
        })
        .catch((error) => {
          loadingMap.delete(loadingKey);
        });

      return;
    } else {
      const texturePath = skipPublicPrefix ? path : "./public" + path;
      targetTexture = LoadTexture(texturePath);

      SetTextureFilter(targetTexture, TEXTURE_FILTER_TRILINEAR);

      textureMap.set(textureMapKey, targetTexture); 
    }
  }

  if (targetTexture) {
    spriteCount += 1;
    DrawTexturePro(
      targetTexture,
      { x: 0, y: 0, height: targetTexture.height, width: targetTexture.width },
      { x: position.x, y: position.y, height: size.y, width: size.x },
      origin ?? { x: 0, y: 0 },
      rotation,
      color
    );
  }
}

export function drawSpriteCropped(
  path: string,
  position: Vector2,
  size: Vector2,
  color: Color,
  crop: { left?: number; top?: number; right?: number; bottom?: number } = {},
  cacheKey?: string,
  skipPublicPrefix: boolean = false,
  smoothFiltering: boolean = true,
  rotation: number = 0,
  origin?: Vector2
) {
  const textureMapKey = cacheKey || path;
  let targetTexture = textureMap.get(textureMapKey);

  if (!targetTexture) {
    if (isUrl(path)) {
      const excludeKey = cacheKey || path;
      if (excludeList.has(excludeKey)) {
        return;
      }

      const loadingKey = cacheKey || path;
      if (loadingMap.get(loadingKey)) {
        return;
      }

      loadingMap.set(loadingKey, true);
      loadTextureFromUrl(path, cacheKey)
        .then((texture) => {
          if (texture) {
            textureMap.set(textureMapKey, texture);
          }
          loadingMap.delete(loadingKey);
        })
        .catch(() => {
          loadingMap.delete(loadingKey);
        });

      return;
    } else {
      const texturePath = skipPublicPrefix ? path : "./public" + path;
      targetTexture = LoadTexture(texturePath);
      try { SetTextureFilter(targetTexture, TEXTURE_FILTER_TRILINEAR); } catch {}
      textureMap.set(textureMapKey, targetTexture);
    }
  }

  if (targetTexture) {
    const left = Math.max(0, Math.floor(crop.left ?? 0));
    const top = Math.max(0, Math.floor(crop.top ?? 0));
    const right = Math.max(0, Math.floor(crop.right ?? 0));
    const bottom = Math.max(0, Math.floor(crop.bottom ?? 0));

    const srcW = Math.max(1, targetTexture.width - left - right);
    const srcH = Math.max(1, targetTexture.height - top - bottom);

    spriteCount += 1;
    DrawTexturePro(
      targetTexture,
      { x: left, y: top, height: srcH, width: srcW },
      { x: position.x, y: position.y, height: size.y, width: size.x },
      origin ?? { x: 0, y: 0 },
      rotation,
      color
    );
  }
}
