import { writeFileSync, existsSync, mkdirSync } from "fs";
import * as path from "path";
import type { SoundSpaceMemoryMap } from "./ssmm";
import { type SSPMParsedMap, SSPMParser } from "./sspmParser";
import { type SSPMMap, V1SSPMParser } from "./sspmv1Parser";
import { Buffer } from "buffer";
import { logger } from "../logger";

function detectAudioFormat(audioBuffer: Buffer): string {
  if (audioBuffer.length < 12) {
    return ".mp3";
  }

  const header = audioBuffer.subarray(0, 12);

  if (
    header.subarray(0, 4).toString() === "RIFF" &&
    header.subarray(8, 12).toString() === "WAVE"
  ) {
    return ".wav";
  }

  if (
    header.subarray(0, 3).toString() === "ID3" ||
    (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)
  ) {
    return ".mp3";
  }

  if (header.subarray(0, 4).toString() === "OggS") {
    return ".ogg";
  }

  if (header.subarray(0, 4).toString() === "fLaC") {
    return ".flac";
  }

  if (header.subarray(4, 8).toString() === "ftyp") {
    return ".m4a";
  }

  logger(
    `Unknown audio format, defaulting to .mp3. Header:`,
    Array.from(header.subarray(0, 8))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" "),
  );
  return ".mp3";
}

function detectImageFormat(imageBuffer: Buffer): string {
  if (imageBuffer.length < 12) return ".png";
  const header = imageBuffer.subarray(0, 12);

  if (
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return ".png";
  }

  if (header[0] === 0xff && header[1] === 0xd8) {
    return ".jpg";
  }

  if (
    header[0] === 0x47 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x38
  ) {
    return ".gif";
  }

  if (header[0] === 0x42 && header[1] === 0x4d) {
    return ".bmp";
  }

  if (
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50
  ) {
    return ".webp";
  }
  return ".png";
}

export async function addSSPMMap(
  mapBytes: Buffer,
  onlineData?: {
    starRating: number;
    status: string;
    onlineId: string;
    onlineImage: string;
  },
) {
  let map: SSPMParsedMap | SSPMMap;
  try {
    map = new SSPMParser(mapBytes).parse();
  } catch (error) {
    map = new V1SSPMParser(mapBytes).parse();
  }

  if (!map) return;

  let generatedMap: SoundSpaceMemoryMap = {
    id: "",
    mappers: [],
    title: "",
    duration: 0,
    noteCount: 0,
    difficulty: 0,
    starRating: 0,
    onlineStatus: "UNRANKED",
    notes: [],
    onlineImage: "",
    audioFileName: "",
  };
  let notes: [number, number, number][] = [];

  if ("markers" in map) {
    generatedMap.title = map.strings.mapName;
    generatedMap.id = map.strings.mapID;
    generatedMap.mappers = map.strings.mappers;
    generatedMap.difficulty = map.metadata.difficulty;
    try {
      const f = map.customData.fields.find((x) => x.id === "difficulty_name");
      if (f && f.value) generatedMap.customDifficultyName = Buffer.isBuffer(f.value) ? f.value.toString("utf-8") : String(f.value);
    } catch {}
    map.markers.sort((a, b) => a.position - b.position);
    notes = map.markers
      .filter((marker) => marker.type === 0)
      .map((marker) => [
        marker.position,
        (marker.data as any)["field0"].x,
        (marker.data as any)["field0"].y,
      ]);
    generatedMap.notes = notes;
  } else {
    generatedMap.title = map.name;
    generatedMap.id = map.id;
    generatedMap.mappers = [map.creator];
    generatedMap.difficulty = map.difficulty;
    map.notes.sort((a, b) => a.position - b.position);
    notes = map.notes.map((marker) => [marker.position, marker.x, marker.y]);
    generatedMap.notes = notes;
  }

  if (map.audio) {
    const audioFormat = detectAudioFormat(map.audio);
    const fallbackId = (
      onlineData?.onlineId ||
      generatedMap.id ||
      "local"
    ).toString();
    const sanitizedId = fallbackId.replace(/[\\/:*?"<>|]/g, "_");
    const audioFileName = `${sanitizedId}${audioFormat}`;
    generatedMap.audioFileName = audioFileName;

    const audioPath = `./cache/audio/${audioFileName}`;
    try {
      if (!existsSync(audioPath)) {
        writeFileSync(audioPath, map.audio);
        logger(
          `Saved audio with detected format: ${audioFormat} as ${audioFileName}`,
        );
      } else {
        logger(`Audio already exists, skipping write: ${audioFileName}`);
      }
    } catch (err) {
      logger(
        `Audio write failed (${audioFileName}), continuing without overwrite:`,
        err,
      );
    }
  }
  generatedMap.noteCount = notes.length;
  generatedMap.duration = notes[notes.length - 1][0];

  if (onlineData) {
    generatedMap.starRating = onlineData.starRating;
    generatedMap.onlineStatus = onlineData.status;
    generatedMap.onlineImage = onlineData.onlineImage;
  }

  if (!generatedMap.onlineImage) {
    try {
      const cover: Buffer | null | undefined = (map as any).cover || null;
      if (cover && cover.length > 0) {
        const outId = (
          onlineData?.onlineId ||
          generatedMap.id ||
          `local_${Date.now()}`
        ).toString();
        const sanitizedId = outId.replace(/[\\/:*?"<>|]/g, "_");
        const ext = detectImageFormat(cover);
        const publicDir = path.join(process.cwd(), "cache", "sspm_covers");
        try {
          mkdirSync(publicDir, { recursive: true });
        } catch {}
        const filename = `${sanitizedId}${ext}`;
        const filePath = path.join(publicDir, filename);
        if (!existsSync(filePath)) {
          writeFileSync(filePath, cover);
        }
        generatedMap.onlineImage = `./cache/sspm_covers/${filename}`;
      }
    } catch (e) {
      logger("Cover save failed (continuing without cover):", e);
    }
  }

  const outId = (
    onlineData?.onlineId ||
    generatedMap.id ||
    `local_${Date.now()}`
  ).toString();
  generatedMap.id = outId;
  try {
    writeFileSync(
      `./cache/parsed/${outId}`,
      JSON.stringify(generatedMap, null, 2),
    );
  } catch (err) {
    const altId = `${outId}_dup_${Date.now()}`;
    generatedMap.id = altId;
    try {
      writeFileSync(
        `./cache/parsed/${altId}`,
        JSON.stringify(generatedMap, null, 2),
      );
      logger(`Parsed map write retry succeeded with id ${altId}`);
    } catch (err2) {
      logger(`Parsed map write failed for id ${outId} and fallback ${altId}`);
      throw err2;
    }
  }

  logger("PROCESSED: ", generatedMap, map.audio);
  return generatedMap;
}
