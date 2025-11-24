import { Scene } from "../../atoms/Scene";
import { GameObject } from "../../atoms/Object";
import { Rhythia } from "../../atoms/Rhythia";
import {
  Vector2,
  ClearBackground,
  BLACK,
  IsKeyPressed,
  KEY_ENTER,
  KEY_KP_ENTER,
} from "raylib";
import { drawSprite } from "../../utils/sprite";
import { drawText, measureText } from "../../utils/text";
import { lerpDelta } from "../../utils/lerp";
import { createInputBox, InputBox } from "../menu/atoms/InputBox";
import { createPopup, Popup } from "../menu/atoms/Popup";
import { steamClient } from "../../utils/steam";
import { accentWithHover } from "../../utils/colors";
import type { PlayerSteamId } from "steamworks.js/client";
import { logger } from "../../utils/logger";

type SteamLobby = Awaited<
  ReturnType<typeof steamClient.matchmaking.createLobby>
>;
type P2PPacket = ReturnType<typeof steamClient.networking.readP2PPacket>;

const enum LobbyMemberStateChange {
  Entered = 0,
  Left = 1,
  Disconnected = 2,
  Kicked = 3,
  Banned = 4,
}

interface ChatEntry {
  id: number;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  kind: "chat" | "system";
}

interface LobbyLayout {
  margin: number;
  sidebarWidth: number;
  panelHeight: number;
  chatPanelX: number;
  chatPanelWidth: number;
  messagesHeight: number;
  inputHeight: number;
  inputWidth: number;
  inputX: number;
  inputY: number;
  sendButtonWidth: number;
  sendButtonX: number;
  sendButtonY: number;
  inviteButtonWidth: number;
  inviteButtonHeight: number;
  inviteButtonX: number;
  inviteButtonY: number;
  setMapButtonY: number;
  leaveButtonY: number;
}

interface ButtonRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class LobbyScene extends Scene {
  sceneName: string = "Lobby";
  private popup: Popup | null = null;
  private lobby: SteamLobby | null = null;
  private chatInput: InputBox | null = null;
  private sendButton: GameObject | null = null;
  private inviteButton: GameObject | null = null;
  private leaveButton: GameObject | null = null;
  private chatMessages: ChatEntry[] = [];
  private members: PlayerSteamId[] = [];
  private memberNames: Map<string, string> = new Map();
  private callbackHandles: Array<
    ReturnType<typeof steamClient.callback.register>
  > = [];
  private messageSequence: number = 0;
  private readonly maxMessages: number = 200;
  private readonly maxMembers: number = 8;
  private localSteamId: bigint = 0n;
  private localSteamIdString: string = "";
  private localPlayerName: string = "";
  private lobbyTitle: string = "Lobby";
  private creationFailed: boolean = false;
  private isClosing: boolean = false;
  private lobbyLeft: boolean = false;
  private closeTimer: NodeJS.Timeout | null = null;
  private setterId: string | null = null;
  private setterName: string | null = null;
  private setMapButton: GameObject | null = null;
  private connectionStatus: string = "Checking connection...";
  private displayPing: number | null = null;
  private lastPingSent: number = 0;
  private readonly pingInterval: number = 5000;
  private readonly pingTimeout: number = 15000;
  private pendingPings: Map<string, number> = new Map();
  private pingSamples: Map<string, { rtt: number; updatedAt: number }> = new Map();

  async init(): Promise<void> {
    this.popup = createPopup();
    this.popup.show("Creating lobby...");
    this.localSteamId = steamClient.localplayer.getSteamId().steamId64;
    this.localSteamIdString = this.localSteamId.toString();
    this.localPlayerName = steamClient.localplayer.getName();
    this.memberNames.set(this.localSteamIdString, this.localPlayerName);
    this.registerCallbacks();
    this.setupUi();
    try {
      await this.createLobby();
      this.popup?.hide();
    } catch (error) {
      this.handleCreationError(error);
    }
  }

  render(): void {
    ClearBackground(BLACK);
    this.handleInputShortcuts();
    if (!this.creationFailed) {
      this.pollPackets();
    }
    this.updateNetworkStatus();
    GameObject.updateAll();
    const layout = this.getLayout();
    this.drawPanels(layout);
    GameObject.drawAll();
    this.drawHeader(layout);
    this.drawMembers(layout);
    this.drawChat(layout);
  }

  destroy(): void {
    this.chatInput?.destroy();
    this.chatInput = null;
    this.sendButton?.destroy();
    this.sendButton = null;
    this.inviteButton?.destroy();
    this.inviteButton = null;
    this.leaveButton?.destroy();
    this.leaveButton = null;
    this.setMapButton?.destroy();
    this.setMapButton = null;
    this.popup?.destroy();
    this.popup = null;
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    this.unregisterCallbacks();
    this.leaveLobbyInternal();
  }

  private getLayout(): LobbyLayout {
    const margin = 60;
    const sidebarWidth = 420;
    const panelHeight = Rhythia.gameHeight - margin * 2;
    const chatPanelX = margin + sidebarWidth + 40;
    const chatPanelWidth = Rhythia.gameWidth - chatPanelX - margin;
    const inputHeight = 54;
    const messagesHeight = panelHeight - inputHeight - 40;
    const sendButtonWidth = 120;
    const inputWidth = chatPanelWidth - sendButtonWidth - 40;
    const inputX = chatPanelX + 24;
    const inputY = margin + messagesHeight + 20;
    const sendButtonX = chatPanelX + chatPanelWidth - sendButtonWidth - 12;
    const sendButtonY = inputY;
    const inviteButtonWidth = sidebarWidth - 40;
    const inviteButtonHeight = 52;
    const inviteButtonX = margin + 20;
    const inviteButtonY = margin + panelHeight - inviteButtonHeight * 2 - 32;
    const setMapButtonY = inviteButtonY - inviteButtonHeight - 18;
    const leaveButtonY = inviteButtonY + inviteButtonHeight + 18;
    return {
      margin,
      sidebarWidth,
      panelHeight,
      chatPanelX,
      chatPanelWidth,
      messagesHeight,
      inputHeight,
      inputWidth,
      inputX,
      inputY,
      sendButtonWidth,
      sendButtonX,
      sendButtonY,
      inviteButtonWidth,
      inviteButtonHeight,
      inviteButtonX,
      inviteButtonY,
      setMapButtonY,
      leaveButtonY,
    };
  }

  private handleInputShortcuts(): void {
    if (!this.chatInput) return;
    if (!this.chatInput.isFocusedState()) {
      if (IsKeyPressed(KEY_ENTER) || IsKeyPressed(KEY_KP_ENTER)) {
        this.chatInput.focus();
      }
    }
  }

  private isLocalSetter(): boolean {
    return !!this.setterId && this.setterId === this.localSteamIdString;
  }

  private updateNetworkStatus(): void {
    const now = Date.now();

    if (!this.lobby) {
      this.connectionStatus = this.creationFailed ? "Offline" : "Disconnected";
      this.displayPing = null;
      this.pendingPings.clear();
      this.pingSamples.clear();
      return;
    }

    for (const [memberId, timestamp] of [...this.pendingPings.entries()]) {
      if (now - timestamp > this.pingTimeout) {
        this.pendingPings.delete(memberId);
      }
    }

    for (const [memberId, sample] of [...this.pingSamples.entries()]) {
      if (now - sample.updatedAt > this.pingTimeout) {
        this.pingSamples.delete(memberId);
      }
    }

    const otherMembers = this.members.filter(
      (member) => member.steamId64 !== this.localSteamId
    );

    if (otherMembers.length === 0) {
      this.connectionStatus = "Online";
      this.displayPing = null;
      return;
    }

    if (now - this.lastPingSent >= this.pingInterval) {
      this.lastPingSent = now;
      const payload = {
        type: "ping",
        timestamp: now,
        senderId: this.localSteamIdString,
      };
      const buffer = Buffer.from(JSON.stringify(payload));
      for (const member of otherMembers) {
        const memberId = member.steamId64.toString();
        this.pendingPings.set(memberId, now);
        try {
          steamClient.networking.sendP2PPacket(
            member.steamId64,
            steamClient.networking.SendType.Reliable,
            buffer
          );
        } catch (error) {
          logger("Failed to send ping", error);
        }
      }
    }

    const samples: number[] = [];
    for (const sample of this.pingSamples.values()) {
      samples.push(sample.rtt);
    }

    if (samples.length > 0) {
      const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      this.displayPing = Math.max(1, Math.round(average));
      this.connectionStatus = "Online";
    } else if (this.pendingPings.size > 0) {
      this.connectionStatus = "Checking connection...";
      this.displayPing = null;
    } else {
      this.connectionStatus = "No response";
      this.displayPing = null;
    }
  }

  private setupUi(): void {
    const layout = this.getLayout();
    this.chatInput = createInputBox({
      position: Vector2(layout.inputX, layout.inputY + layout.inputHeight / 2),
      width: layout.inputWidth,
      height: layout.inputHeight,
      placeholder: "Type a message...",
      maxLength: 256,
      fontSize: 26,
      onEnter: () => this.sendChatMessage(),
    });
    const sendRect: ButtonRect = {
      x: layout.sendButtonX,
      y: layout.sendButtonY,
      width: layout.sendButtonWidth,
      height: layout.inputHeight,
    };
    this.sendButton = this.createButton(
      sendRect,
      "Send",
      () => this.sendChatMessage(),
      0.4
    );
    const inviteRect: ButtonRect = {
      x: layout.inviteButtonX,
      y: layout.inviteButtonY,
      width: layout.inviteButtonWidth,
      height: layout.inviteButtonHeight,
    };
    this.inviteButton = this.createButton(
      inviteRect,
      "Invite Friends",
      () => this.openInviteDialog(),
      0.35
    );
    const leaveRect: ButtonRect = {
      x: layout.inviteButtonX,
      y: layout.leaveButtonY,
      width: layout.inviteButtonWidth,
      height: layout.inviteButtonHeight,
    };
    this.leaveButton = this.createButton(
      leaveRect,
      "Leave Lobby",
      () => this.leaveLobby(),
      0.3
    );

    this.refreshSetterUi();
  }

  private refreshSetterUi(): void {
    const shouldShow = this.isLocalSetter();

    if (!shouldShow) {
      if (this.setMapButton) {
        this.setMapButton.destroy();
        this.setMapButton = null;
      }
      return;
    }

    if (this.setMapButton) {
      return;
    }

    const layout = this.getLayout();
    const setMapRect: ButtonRect = {
      x: layout.inviteButtonX,
      y: layout.setMapButtonY,
      width: layout.inviteButtonWidth,
      height: layout.inviteButtonHeight,
    };

    this.setMapButton = this.createButton(
      setMapRect,
      "Set Map (TODO)",
      () => this.handleSetMapClick(),
      0.45
    );
  }

  private handleSetMapClick(): void {
    this.addSystemMessage("Set Map is not implemented yet.");
  }

  private createButton(
    rect: ButtonRect,
    label: string,
    onClick: () => void,
    baseStrength: number
  ): GameObject {
    const button = new GameObject({ zBase: 4 });
    let hoverTarget = 0;
    let hover = 0;
    button.attachRect({
      pos: Vector2(rect.x, rect.y),
      size: Vector2(rect.width, rect.height),
      onClick: () => {
        onClick();
        return true;
      },
      onHoverStart: () => {
        hoverTarget = 1;
      },
      onHoverEnd: () => {
        hoverTarget = 0;
      },
    });
    button.onUpdate = () => {
      hover = lerpDelta(hover, hoverTarget, 0.2);
    };
    button.onDraw = () => {
      const background = accentWithHover(
        { r: 40, g: 60, b: 120 },
        null,
        baseStrength,
        hover
      );
      const rectColor = {
        r: background.r,
        g: background.g,
        b: background.b,
        a: 220,
      };
      drawSprite(
        "/solid.png",
        Vector2(rect.x, rect.y),
        Vector2(rect.width, rect.height),
        rectColor
      );
      const textColor = { r: 245, g: 245, b: 255, a: 255 };
      drawText(
        label,
        Vector2(rect.x + rect.width / 2, rect.y + rect.height / 2 - 16),
        28,
        textColor,
        "center"
      );
    };
    return button;
  }

  private async createLobby(): Promise<void> {
    const lobby = await steamClient.matchmaking.createLobby(
      steamClient.matchmaking.LobbyType.FriendsOnly,
      this.maxMembers
    );
    lobby.setJoinable(true);
    const name = `${this.localPlayerName}'s Lobby`;
    lobby.setData("name", name);
    lobby.setData("host", this.localSteamIdString);
    this.lobby = lobby;
    this.lobbyTitle = name;
    this.updateSetter(this.localSteamIdString, this.localPlayerName, {
      broadcast: true,
      announce: false,
    });
    this.refreshMembers();
    this.addSystemMessage("Lobby created.");
  }

  private handleCreationError(error: unknown): void {
    logger("Failed to create lobby", error);
    this.creationFailed = true;
    if (this.popup) {
      this.popup.show("Failed to create lobby");
    }
    if (this.isClosing) return;
    this.isClosing = true;
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }
    this.closeTimer = setTimeout(() => {
      if (!this.isClosing) return;
      Rhythia.goToPreviousScene();
    }, 1200);
  }

  private leaveLobby(): void {
    if (this.isClosing) return;
    this.isClosing = true;
    this.leaveLobbyInternal();
    Rhythia.goToPreviousScene();
  }

  private leaveLobbyInternal(): void {
    if (this.lobby && !this.lobbyLeft) {
      try {
        this.lobby.leave();
      } catch (error) {
        logger("Failed to leave lobby", error);
      }
      this.lobbyLeft = true;
    }
    this.lobby = null;
    this.pendingPings.clear();
    this.pingSamples.clear();
    this.setterId = null;
    this.setterName = null;
    this.refreshSetterUi();
  }

  private openInviteDialog(): void {
    if (!this.lobby) return;
    try {
      this.lobby.openInviteDialog();
    } catch (error) {
      logger("Invite dialog error", error);
    }
  }

  private sendChatMessage(): void {
    if (!this.chatInput) return;
    const value = this.chatInput.getValue().trim();
    if (!value) return;
    this.chatInput.setValue("");

    if (value.startsWith("/")) {
      if (this.handleCommand(value)) {
        return;
      }
    }

    this.publishChatMessage(value);
  }

  private handleCommand(raw: string): boolean {
    const trimmed = raw.trim();
    const [command, ...rest] = trimmed.split(/\s+/);
    const lower = command.toLowerCase();

    if (lower === "/roll") {
      const roll = Math.floor(Math.random() * 6) + 1;
      this.publishChatMessage(`I rolled ${roll}`);
      return true;
    }

    if (lower === "/make-setter") {
      let targetName = rest.join(" ").trim();
      if (!targetName) {
        this.addSystemMessage("Usage: /make-setter <player name>.");
        return true;
      }

      targetName = targetName.replace(/\s*\((setter|you)\)$/i, "").trim();
      if (!targetName) {
        this.addSystemMessage("Usage: /make-setter <player name>.");
        return true;
      }

      if (!this.isLocalSetter()) {
        this.addSystemMessage("Only the current map setter can use /make-setter.");
        return true;
      }

      const target = this.findMemberByName(targetName);
      if (!target) {
        this.addSystemMessage(`No player found with name \"${targetName}\".`);
        return true;
      }

      const targetId = target.member.steamId64.toString();
      if (this.setterId === targetId) {
        this.addSystemMessage(`${target.name} is already the map setter.`);
        return true;
      }

      this.updateSetter(targetId, target.name, {
        broadcast: true,
        announce: true,
      });
      return true;
    }

    this.addSystemMessage(`Unknown command: ${command}`);
    return true;
  }

  private pollPackets(): void {
    if (!this.lobby) return;
    let size = steamClient.networking.isP2PPacketAvailable();
    while (size > 0) {
      const packet = steamClient.networking.readP2PPacket(size);
      this.processPacket(packet);
      size = steamClient.networking.isP2PPacketAvailable();
    }
  }

  private processPacket(packet: P2PPacket): void {
    if (packet.steamId.steamId64 === this.localSteamId) return;
    const raw = packet.data.toString("utf-8");
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (payload.type === "chat" && typeof payload.text === "string") {
      const senderId =
        typeof payload.senderId === "string"
          ? payload.senderId
          : packet.steamId.steamId64.toString();
      const senderName =
        typeof payload.senderName === "string" && payload.senderName.trim()
          ? payload.senderName
          : `User ${packet.steamId.accountId}`;
      const timestamp =
        typeof payload.timestamp === "number"
          ? payload.timestamp
          : Date.now();
      this.publishChatMessage(payload.text, {
        broadcast: false,
        senderId,
        senderName,
        timestamp,
      });
    } else if (payload.type === "system" && typeof payload.text === "string") {
      const timestamp =
        typeof payload.timestamp === "number"
          ? payload.timestamp
          : Date.now();
      this.appendSystemMessage(payload.text, timestamp);
    } else if (payload.type === "ping" && typeof payload.timestamp === "number") {
      const response = {
        type: "pong",
        timestamp: payload.timestamp,
        senderId: this.localSteamIdString,
      };
      try {
        steamClient.networking.sendP2PPacket(
          packet.steamId.steamId64,
          steamClient.networking.SendType.Reliable,
          Buffer.from(JSON.stringify(response))
        );
      } catch (error) {
        logger("Failed to send pong", error);
      }
    } else if (payload.type === "pong" && typeof payload.timestamp === "number") {
      const memberId = packet.steamId.steamId64.toString();
      const sentAt = this.pendingPings.get(memberId);
      if (sentAt && sentAt === payload.timestamp) {
        const rtt = Date.now() - sentAt;
        this.pendingPings.delete(memberId);
        this.pingSamples.set(memberId, { rtt, updatedAt: Date.now() });
      }
    }
  }

  private appendChatMessage(entry: ChatEntry): void {
    this.chatMessages.push(entry);
    if (this.chatMessages.length > this.maxMessages) {
      this.chatMessages.splice(0, this.chatMessages.length - this.maxMessages);
    }
  }

  private appendSystemMessage(text: string, timestamp: number = Date.now()): void {
    this.chatMessages.push({
      id: this.messageSequence++,
      senderId: "system",
      senderName: "",
      text,
      timestamp,
      kind: "system",
    });
    if (this.chatMessages.length > this.maxMessages) {
      this.chatMessages.splice(0, this.chatMessages.length - this.maxMessages);
    }
  }

  private publishChatMessage(
    text: string,
    {
      broadcast = true,
      senderId = this.localSteamIdString,
      senderName = this.localPlayerName,
      timestamp = Date.now(),
    }: {
      broadcast?: boolean;
      senderId?: string;
      senderName?: string;
      timestamp?: number;
    } = {}
  ): void {
    this.memberNames.set(senderId, senderName);
    this.appendChatMessage({
      id: this.messageSequence++,
      senderId,
      senderName,
      text,
      timestamp,
      kind: "chat",
    });

    if (broadcast) {
      this.broadcastChatPayload(text, timestamp, senderId, senderName);
    }
  }

  private broadcastChatPayload(
    text: string,
    timestamp: number,
    senderId: string,
    senderName: string
  ): void {
    const payload = {
      type: "chat",
      text,
      senderId,
      senderName,
      timestamp,
    };
    this.broadcastPayload(Buffer.from(JSON.stringify(payload)));
  }

  private addSystemMessage(text: string, broadcast: boolean = false): void {
    const timestamp = Date.now();
    this.appendSystemMessage(text, timestamp);
    if (broadcast) {
      this.broadcastSystemMessage(text, timestamp);
    }
  }

  private broadcastSystemMessage(text: string, timestamp: number): void {
    const payload = {
      type: "system",
      text,
      timestamp,
    };
    this.broadcastPayload(Buffer.from(JSON.stringify(payload)));
  }

  private broadcastPayload(buffer: Buffer): void {
    if (!this.lobby) return;
    for (const member of this.members) {
      if (member.steamId64 === this.localSteamId) continue;
      try {
        steamClient.networking.sendP2PPacket(
          member.steamId64,
          steamClient.networking.SendType.Reliable,
          buffer
        );
      } catch (error) {
        logger("Failed to send packet", error);
      }
    }
  }

  private findMemberByName(name: string):
    | { member: PlayerSteamId; name: string }
    | null {
    const target = name.toLowerCase();
    for (const member of this.members) {
      const memberId = member.steamId64.toString();
      const storedName = this.memberNames.get(memberId);
      if (storedName && storedName.toLowerCase() === target) {
        return { member, name: storedName };
      }
    }
    return null;
  }

  private updateSetter(
    setterId: string | null,
    setterName: string | null,
    {
      broadcast = false,
      announce = false,
    }: {
      broadcast?: boolean;
      announce?: boolean;
    } = {}
  ): void {
    const normalizedId = setterId && setterId.trim().length ? setterId : null;
    const normalizedName = setterName && setterName.trim().length ? setterName : null;

    if (
      this.setterId === normalizedId &&
      (this.setterName || "") === (normalizedName || "")
    ) {
      return;
    }

    this.setterId = normalizedId;
    this.setterName = normalizedName;

    if (normalizedId && normalizedName) {
      this.memberNames.set(normalizedId, normalizedName);
    }

    if (broadcast) {
      this.writeSetterLobbyData();
    }

    if (announce && normalizedName) {
      this.addSystemMessage(`Map setter is now ${normalizedName}.`, true);
    }

    this.refreshSetterUi();
  }

  private writeSetterLobbyData(): void {
    if (!this.lobby) return;
    this.lobby.setData("setterId", this.setterId ?? "");
    this.lobby.setData("setterName", this.setterName ?? "");
  }

  private loadSetterFromLobby(): void {
    if (!this.lobby) return;
    const dataId = this.lobby.getData("setterId");
    const dataName = this.lobby.getData("setterName");
    const normalizedId = dataId && dataId.trim().length ? dataId : null;
    let normalizedName = dataName && dataName.trim().length ? dataName : null;

    if (normalizedId && !normalizedName) {
      normalizedName =
        this.memberNames.get(normalizedId) ||
        `User ${normalizedId.slice(Math.max(0, normalizedId.length - 6))}`;
    }

    this.updateSetter(normalizedId, normalizedName, {
      broadcast: false,
      announce: false,
    });
  }

  private drawPanels(layout: LobbyLayout): void {
    drawSprite(
      "/solid.png",
      Vector2(layout.margin, layout.margin),
      Vector2(layout.sidebarWidth, layout.panelHeight),
      { r: 24, g: 28, b: 40, a: 240 }
    );
    drawSprite(
      "/solid.png",
      Vector2(layout.chatPanelX, layout.margin),
      Vector2(layout.chatPanelWidth, layout.panelHeight),
      { r: 18, g: 20, b: 30, a: 240 }
    );
  }

  private drawHeader(layout: LobbyLayout): void {
    const baseX = layout.margin + 20;
    const statusText =
      this.displayPing != null
        ? `${this.connectionStatus} • ${this.displayPing}ms`
        : this.connectionStatus;

    const statusY = layout.margin + 16;
    drawText(statusText, Vector2(baseX, statusY), 24, {
      r: 140,
      g: 200,
      b: 255,
      a: 255,
    });

    const titleY = statusY + 28;
    drawText(this.lobbyTitle, Vector2(baseX, titleY), 44, {
      r: 245,
      g: 245,
      b: 255,
      a: 255,
    });

    const lobbyIdText = this.lobby ? this.lobby.id.toString() : "pending";
    const infoY = titleY + 44;
    drawText(`Lobby ID: ${lobbyIdText}`, Vector2(baseX, infoY), 24, {
      r: 170,
      g: 176,
      b: 200,
      a: 255,
    });

    drawText(
      `Players: ${this.members.length}/${this.maxMembers}`,
      Vector2(baseX, infoY + 32),
      24,
      { r: 170, g: 176, b: 200, a: 255 }
    );
  }

  private drawMembers(layout: LobbyLayout): void {
    const baseX = layout.margin + 20;
    const titleY = layout.margin + 220;

    drawText("Members", Vector2(baseX, titleY), 30, {
      r: 220,
      g: 222,
      b: 235,
      a: 255,
    });
    let y = titleY + 42;
    for (const member of this.members) {
      const label = this.describeMember(member);
      drawText(label, Vector2(baseX, y), 26, {
        r: 210,
        g: 214,
        b: 230,
        a: 255,
      });
      y += 36;
    }
  }

  private drawChat(layout: LobbyLayout): void {
    const paddingX = layout.chatPanelX + 24;
    const width = layout.chatPanelWidth - 48;
    let y = layout.margin + 24;
    const visible = this.chatMessages.slice(-12);
    for (const message of visible) {
      if (message.kind === "chat") {
        drawText(
          message.senderName,
          Vector2(paddingX, y),
          26,
          this.getNameColor(message.senderId)
        );
        y += 30;
        const lines = this.wrapText(message.text, width, 24);
        for (const line of lines) {
          drawText(line, Vector2(paddingX, y), 24, {
            r: 218,
            g: 222,
            b: 244,
            a: 255,
          });
          y += 28;
        }
        y += 12;
      } else {
        const lines = this.wrapText(message.text, width, 24);
        for (const line of lines) {
          drawText(line, Vector2(paddingX, y), 24, {
            r: 150,
            g: 154,
            b: 170,
            a: 255,
          });
          y += 28;
        }
        y += 12;
      }
      if (y > layout.margin + layout.messagesHeight - 40) {
        break;
      }
    }
  }

  private wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    const trimmed = text.trim();
    if (!trimmed) {
      return [""];
    }
    const words = trimmed.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (measureText(next, fontSize).width <= maxWidth) {
        current = next;
      } else {
        if (current) {
          lines.push(current);
        }
        current = word;
      }
    }
    if (current) {
      lines.push(current);
    }
    return lines.length ? lines : [trimmed];
  }

  private getNameColor(senderId: string) {
    if (senderId === this.localSteamIdString) {
      return { r: 140, g: 200, b: 255, a: 255 };
    }
    return { r: 178, g: 186, b: 250, a: 255 };
  }

  private describeMember(member: PlayerSteamId): string {
    const memberId = member.steamId64.toString();
    let baseName: string;

    if (member.steamId64 === this.localSteamId) {
      baseName = `${this.localPlayerName} (You)`;
    } else {
      const stored = this.memberNames.get(memberId);
      if (stored) {
        baseName = stored;
      } else {
        baseName = `User ${member.accountId}`;
        this.memberNames.set(memberId, baseName);
      }
    }

    if (memberId === this.setterId) {
      baseName += " (setter)";
    }

    return baseName;
  }

  private registerCallbacks(): void {
    const chatHandle = steamClient.callback.register(
      steamClient.callback.SteamCallback.LobbyChatUpdate,
      (event: any) => {
        if (!this.lobby || event.lobby !== this.lobby.id) return;
        const change = event.member_state_change as number;
        this.refreshMembers();
        this.loadSetterFromLobby();
        const name = this.describeSteamId(event.user_changed);
        if (change === LobbyMemberStateChange.Entered) {
          this.appendSystemMessage(`${name} joined the lobby.`);
        } else if (change === LobbyMemberStateChange.Left) {
          this.appendSystemMessage(`${name} left the lobby.`);
        } else if (change === LobbyMemberStateChange.Disconnected) {
          this.appendSystemMessage(`${name} disconnected.`);
        } else if (change === LobbyMemberStateChange.Kicked) {
          this.appendSystemMessage(`${name} was removed.`);
        } else if (change === LobbyMemberStateChange.Banned) {
          this.appendSystemMessage(`${name} was banned.`);
        }
      }
    );
    const dataHandle = steamClient.callback.register(
      steamClient.callback.SteamCallback.LobbyDataUpdate,
      (event: any) => {
        if (!this.lobby || event.lobby !== this.lobby.id) return;
        this.refreshMembers();
        this.loadSetterFromLobby();
      }
    );
    const p2pHandle = steamClient.callback.register(
      steamClient.callback.SteamCallback.P2PSessionRequest,
      (event: any) => {
        steamClient.networking.acceptP2PSession(event.remote);
      }
    );
    this.callbackHandles.push(chatHandle, dataHandle, p2pHandle);
  }

  private unregisterCallbacks(): void {
    for (const handle of this.callbackHandles) {
      try {
        handle.disconnect();
      } catch {}
    }
    this.callbackHandles = [];
  }

  private refreshMembers(): void {
    if (!this.lobby) {
      this.members = [];
      return;
    }
    try {
      const members = this.lobby.getMembers();
      this.members = members;
      for (const member of members) {
        const key = member.steamId64.toString();
        if (!this.memberNames.has(key)) {
          if (member.steamId64 === this.localSteamId) {
            this.memberNames.set(key, this.localPlayerName);
          } else {
            this.memberNames.set(key, `User ${member.accountId}`);
          }
        }
      }
    } catch (error) {
      logger("Failed to refresh lobby members", error);
      this.members = [];
    }
  }

  private describeSteamId(id: bigint): string {
    const key = id.toString();
    let baseName: string;

    if (id === this.localSteamId) {
      baseName = `${this.localPlayerName} (You)`;
    } else {
      const stored = this.memberNames.get(key);
      if (stored) {
        baseName = stored;
      } else {
        baseName = `User ${key.slice(Math.max(0, key.length - 6))}`;
        this.memberNames.set(key, baseName);
      }
    }

    if (this.setterId === key) {
      baseName += " (setter)";
    }

    return baseName;
  }
}
