import {
  LoadSound,
  LoadMusicStream,
  PlaySound,
  PlayMusicStream,
  UnloadMusicStream,
  StopMusicStream,
  PauseMusicStream,
  ResumeMusicStream,
  SeekMusicStream,
  IsMusicStreamPlaying,
  SetMusicVolume,
  SetMusicPitch,
  SetSoundVolume,
  UpdateMusicStream,
  GetMusicTimePlayed,
  GetMusicTimeLength,
  Sound,
  Music,
} from "raylib";
import { ConfigManager } from "./configManager";
import { logger } from "./logger";

const soundCache = new Map<string, Sound>();

const musicCache = new Map<string, Music>();

let currentMusic: Music | null = null;
let currentMusicPath: string | null = null;

let masterVolume = 1.0;
let musicVolume = 0.7;
let fxVolume = 0.8;
let musicPitch = 1.0;

export function initializeVolumes(): void {
  const config = ConfigManager.get();
  masterVolume = config.masterVolume ?? 1.0;
  musicVolume = config.musicVolume ?? 0.7;
  fxVolume = config.fxVolume ?? 0.8;
  logger(
    `Loaded volumes from config - Master: ${masterVolume}, Music: ${musicVolume}, FX: ${fxVolume}`,
  );
}

export function playFx(path: string, volume?: number): void {
  try {
    let sound = soundCache.get(path);

    if (!sound) {
      sound = LoadSound("./public" + path);

      if (!sound) {
        console.error(`Failed to load sound: ${path}`);
        return;
      }

      soundCache.set(path, sound);
      logger(`Loaded and cached sound: ${path}`);
    }

    const finalVolume = (volume ?? fxVolume) * masterVolume;
    SetSoundVolume(sound, finalVolume);

    PlaySound(sound);
  } catch (error) {
    console.error(`Failed to play sound effect: ${path}`, error);

    soundCache.delete(path);
  }
}

function loadMusic(path: string, fresh: boolean): Music | null {
  try {
    if (fresh) {
      const cached = musicCache.get(path);
      if (cached) {
        try {
          UnloadMusicStream(cached);
        } catch {}
        musicCache.delete(path);
      }
    }
    let music = musicCache.get(path);
    if (!music) {
      music = LoadMusicStream(path);
      if (!music) return null;
      musicCache.set(path, music);
      logger(`Loaded and cached music: ${path}`);
    }
    return music;
  } catch (e) {
    console.error(`Failed to load music: ${path}`, e);
    return null;
  }
}

function playMusicInternal(
  path: string,
  opts?: { volume?: number; fromStart?: boolean },
): void {
  const volume = opts?.volume;
  const fromStart = opts?.fromStart === true;
  try {
    if (currentMusic && IsMusicStreamPlaying(currentMusic)) {
      logger(
        `Stopping currently playing music before play: ${currentMusicPath || "<unknown>"}`,
      );
      StopMusicStream(currentMusic);
    }

    const music = loadMusic(path, fromStart);
    if (!music) {
      console.error(`Failed to load music: ${path}`);
      return;
    }

    const finalVolume = (volume ?? musicVolume) * masterVolume;
    SetMusicVolume(music, finalVolume);
    try {
      SetMusicPitch(music, musicPitch);
    } catch (error) {
      console.error("Failed to apply music pitch", error);
    }
    if (fromStart) {
      try {
        SeekMusicStream(music, 0);
      } catch {}
    }
    PlayMusicStream(music);
    currentMusic = music;
    currentMusicPath = path;
    logger(`Now playing music${fromStart ? " from start" : ""}: ${path}`);
  } catch (error) {
    console.error(`Failed to play music: ${path}`, error);
    musicCache.delete(path);
  }
}

export function playMusic(path: string, volume?: number): void {
  playMusicInternal(path, { volume });
}

export function seek(position: number): void {
  if (currentMusic) {
    try {
      SeekMusicStream(currentMusic, position);
      logger(`Seeked to ${position}s in current music`);
    } catch (error) {
      console.error(`Failed to seek music to ${position}s`, error);
    }
  } else {
    console.warn("No music currently loaded to seek");
  }
}

export function pause(): void {
  if (currentMusic) {
    try {
      PauseMusicStream(currentMusic);
      logger("Paused current music");
    } catch (error) {
      console.error("Failed to pause music", error);
    }
  } else {
    console.warn("No music currently loaded to pause");
  }
}

export function play(): void {
  if (currentMusic) {
    try {
      if (IsMusicStreamPlaying(currentMusic)) {
        logger("Music is already playing");
      } else {
        ResumeMusicStream(currentMusic);
        logger("Resumed current music");
      }
    } catch (error) {
      console.error("Failed to resume music", error);
    }
  } else {
    console.warn("No music currently loaded to play");
  }
}

export function stopMusic(): void {
  if (currentMusic) {
    try {
      StopMusicStream(currentMusic);
      logger("Stopped current music");
    } catch (error) {
      console.error("Failed to stop music", error);
    }
  }
}

export function playMusicFromStart(path: string, volume?: number): void {
  playMusicInternal(path, { volume, fromStart: true });
}

export function isMusicPlaying(): boolean {
  return currentMusic ? IsMusicStreamPlaying(currentMusic) : false;
}

export function getCurrentMusicPath(): string | null {
  return currentMusicPath;
}

export function setMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));

  if (currentMusic) {
    SetMusicVolume(currentMusic, musicVolume * masterVolume);
  }

  logger(`Set master volume to ${masterVolume}`);
}

export function setMusicVolume(volume: number): void {
  musicVolume = Math.max(0, Math.min(1, volume));
  if (currentMusic) {
    SetMusicVolume(currentMusic, musicVolume * masterVolume);
  }
  logger(`Set music volume to ${musicVolume}`);
}

export function setFxVolume(volume: number): void {
  fxVolume = Math.max(0, Math.min(1, volume));
  logger(`Set FX volume to ${fxVolume}`);
}

export function setMusicPitch(pitch: number): void {
  const previousPitch = musicPitch;
  const clamped = Math.max(0.001, pitch);
  musicPitch = clamped;
  if (currentMusic) {
    try {
      SetMusicPitch(currentMusic, clamped);
      if (Math.abs(clamped - previousPitch) >= 0.05) {
        logger(`Set music pitch to ${clamped}`);
      }
    } catch (error) {
      console.error("Failed to set music pitch", error);
    }
  } else {
    logger(`Stored music pitch ${clamped} (will apply on next play)`);
  }
}

export function getMusicPitch(): number {
  return musicPitch;
}

export function getVolumes(): { master: number; music: number; fx: number } {
  return {
    master: masterVolume,
    music: musicVolume,
    fx: fxVolume,
  };
}

export function clearCache(): void {
  try {
    const handled = new Set<Music>();
    const safeUnload = (m: Music | null) => {
      if (!m) return;
      if (handled.has(m)) return;
      try { StopMusicStream(m); } catch {}
      try { UnloadMusicStream(m); } catch {}
      handled.add(m);
    };
    const cur = currentMusic;
    currentMusic = null;
    currentMusicPath = null;
    safeUnload(cur);
    for (const m of musicCache.values()) safeUnload(m);
  } catch {}
  soundCache.clear();
  musicCache.clear();
  logger("Cleared audio cache");
}

export function updateAudio(): void {
  if (currentMusic) {
    UpdateMusicStream(currentMusic);
  }
}

export function getMusicTime(): number {
  if (currentMusic && IsMusicStreamPlaying(currentMusic)) {
    try {
      return GetMusicTimePlayed(currentMusic);
    } catch (error) {
      console.error("Failed to get music time", error);
      return 0;
    }
  }
  return 0;
}

export function getMusicLength(): number {
  if (currentMusic) {
    try {
      return GetMusicTimeLength(currentMusic);
    } catch (error) {
      console.error("Failed to get music length", error);
      return 0;
    }
  }
  return 0;
}

export function getCacheStats(): { sounds: number; music: number } {
  return {
    sounds: soundCache.size,
    music: musicCache.size,
  };
}
