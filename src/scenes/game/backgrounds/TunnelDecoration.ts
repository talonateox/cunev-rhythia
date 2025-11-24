import {
  Color,
  Vector2,
  Vector3,
  rlPushMatrix,
  rlPopMatrix,
  rlTranslatef,
  rlRotatef,
} from "raylib";
import { drawSprite } from "../../../utils/sprite";
import { createTween, easings } from "../../../utils/tween";
import { Rhythia } from "../../../atoms/Rhythia";
import {
  registerCustomization,
  type GameSettingDefinition,
} from "../../../utils/settingsRegistry";
import { BackgroundDecoration } from "./BackgroundDecoration";
import { BackgroundRenderContext } from "./types";

export class TunnelDecoration implements BackgroundDecoration {
  private accentColor: Color = { r: 255, g: 255, b: 255, a: 255 };

  private currentTunnelDirection = { center: 9.5, amplitude: 4.5 };
  private nextDirectionChangeTime = 20000;

  private nextWaveTime = Math.random() * 10000 + 10000;
  private waveProgress = -1;
  private waveFadeOut = 0;

  setAccentColor(color: Color): void {
    this.accentColor = color;
  }

  render(context: BackgroundRenderContext): void {
    const { msTime, backgroundOpacity } = context;

    const centerX = Rhythia.gameWidth / 2;
    const centerY = Rhythia.gameHeight / 2;

    if ((context.settings.tunnelEnabled ?? 1) < 0.5) {
      return;
    }

    if (backgroundOpacity <= 0) {
      return;
    }
    this.updateDirection(msTime);
    this.updateWave(msTime);
    const tunnelDepth = 500;
    const startDistance = tunnelDepth;
    const gap = 350;
    const numBorders = 20;

    for (let i = 0; i < numBorders; i++) {
      const z = startDistance + i * gap;
      const maxSize = 4000;
      const minSize = 3000;
      const progress = i / (numBorders - 1);
      const borderSize = maxSize - progress * (maxSize - minSize);
      const rotation = i * this.getRotateRate(msTime);

      const normalizedProgress = progress;
      let baseOpacity = Math.sin(normalizedProgress * Math.PI) * 0.15;

      const waveMultiplier = this.getWaveMultiplier(progress);
      const opacity = baseOpacity * waveMultiplier * backgroundOpacity;

      rlPushMatrix();
      rlTranslatef(centerX, centerY, z);
      rlRotatef(rotation, 0, 0, 1);
      rlTranslatef(-borderSize / 2, -borderSize / 2, 0);

      drawSprite(
        "/border.png",
        Vector3(0, 0, 0),
        Vector2(borderSize, borderSize),
        {
          r: this.accentColor.r,
          g: this.accentColor.g,
          b: this.accentColor.b,
          a: Math.round(255 * opacity),
        }
      );

      const edgeOpacity = opacity * 5.0;
      const edgeWidth = borderSize * 0.02;
      const edgeHeight = borderSize * 0.3;
      const edgeYOffset = borderSize * 0.33;

      drawSprite(
        "/solid.png",
        Vector3(0, edgeYOffset, 0),
        Vector2(edgeWidth, edgeHeight),
        {
          r: this.accentColor.r,
          g: this.accentColor.g,
          b: this.accentColor.b,
          a: Math.round(255 * Math.min(1.0, edgeOpacity)),
        }
      );

      drawSprite(
        "/solid.png",
        Vector3(borderSize - edgeWidth, edgeYOffset, 0),
        Vector2(edgeWidth, edgeHeight),
        {
          r: this.accentColor.r,
          g: this.accentColor.g,
          b: this.accentColor.b,
          a: Math.round(255 * Math.min(1.0, edgeOpacity)),
        }
      );

      rlPopMatrix();
    }
  }

  private updateDirection(msTime: number): void {
    const directionChangeInterval = 20000;
    const transitionTime = 2000;

    if (msTime < this.nextDirectionChangeTime) {
      return;
    }

    const directions = [
      { center: 9.5, amplitude: 4.5 },
      { center: -10, amplitude: 5 },
      { center: 15, amplitude: 3 },
      { center: -18, amplitude: 4 },
      { center: 6, amplitude: 6 },
      { center: -8, amplitude: 7 },
    ];

    const newDirection =
      directions[Math.floor(Math.random() * directions.length)];

    createTween(
      "tunnelCenter",
      this.currentTunnelDirection.center,
      newDirection.center,
      transitionTime / 1000,
      (value: number) => {
        this.currentTunnelDirection.center = value;
      },
      easings.easeInOutSine
    );

    createTween(
      "tunnelAmplitude",
      this.currentTunnelDirection.amplitude,
      newDirection.amplitude,
      transitionTime / 1000,
      (value: number) => {
        this.currentTunnelDirection.amplitude = value;
      },
      easings.easeInOutSine
    );

    this.nextDirectionChangeTime = msTime + directionChangeInterval;
  }

  private updateWave(msTime: number): void {
    if (
      msTime >= this.nextWaveTime &&
      this.waveProgress < 0 &&
      this.waveFadeOut === 0
    ) {
      const waveDuration = 3000;
      const fadeOutDuration = 1500;

      createTween(
        "tunnelWave",
        0,
        1,
        waveDuration / 1000,
        (value: number) => {
          this.waveProgress = value;
        },
        easings.easeInOutSine
      ).onEnd(() => {
        this.waveProgress = -1;
        createTween(
          "tunnelWaveFadeOut",
          0,
          1,
          fadeOutDuration / 1000,
          (value: number) => {
            this.waveFadeOut = value;
          },
          easings.easeOutQuad
        ).onEnd(() => {
          this.waveFadeOut = 0;
        });
      });

      this.nextWaveTime = msTime + Math.random() * 10000 + 10000;
    }
  }

  private getRotateRate(msTime: number): number {
    const slowCycleTime = 40000;
    const rotateRateCenter = this.currentTunnelDirection.center;
    const rotateRateAmplitude = this.currentTunnelDirection.amplitude;

    return (
      rotateRateCenter +
      Math.sin((msTime / slowCycleTime) * 2 * Math.PI) * rotateRateAmplitude
    );
  }

  private getWaveMultiplier(progress: number): number {
    let waveMultiplier = 1.0;

    if (this.waveProgress >= 0) {
      const wavePosition = this.waveProgress;
      const blockPosition = 1 - progress;
      const distanceFromWave = Math.abs(wavePosition - blockPosition);
      const waveWidth = 0.4;

      let waveIntensity = 0;
      if (distanceFromWave < waveWidth) {
        const normalizedDistance = distanceFromWave / waveWidth;
        waveIntensity = (Math.cos(normalizedDistance * Math.PI) + 1) / 2;
      }

      waveMultiplier = 1.0 + waveIntensity * waveIntensity * 5.0;
    } else if (this.waveFadeOut > 0) {
      const fadeOutIntensity = 1.0 - this.waveFadeOut;
      waveMultiplier = 1.0 + fadeOutIntensity * fadeOutIntensity * 3.0;
    }

    return waveMultiplier;
  }
}

registerCustomization(
  "TunnelDecoration",
  {
    id: "item-tunnel",
    name: "Tunnel",
    rarity: "Common",
    description: "",
    settingsCategory: "tunnel",
    iconPath: "/item-tunnel.png",
  } as const,
  [
    {
      key: "tunnelEnabled",
      label: "Enabled",
      defaultValue: 1.0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
      itemCategory: "tunnel",
    },
    {
      key: "backgroundOpacity",
      label: "Tunnel Opacity",
      defaultValue: 0.05,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      category: "Background",
      itemCategory: "tunnel",
    },
  ] as const satisfies readonly GameSettingDefinition[],
  { priority: 20 }
);
