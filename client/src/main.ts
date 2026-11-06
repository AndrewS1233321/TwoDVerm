import Phaser from "phaser";
import { MSG, type HeroId } from "@twodverm/shared";
import { unlockAudio } from "./audio/sfx";
import { createGame, forgetRoom, friendlyError, joinGame, tryReconnect, type GameRoom } from "./net/connection";
import { GameScene } from "./scenes/GameScene";
import { HudScene } from "./scenes/HudScene";
import { Overlay } from "./ui/overlay";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#0e0c0b",
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: [GameScene, HudScene],
  disableContextMenu: true,
});

let room: GameRoom | null = null;
let leaving = false;

const scene = (): GameScene => game.scene.getScene("GameScene") as GameScene;
if (import.meta.env.DEV) Object.assign(window, { twodverm: { game, scene, room: () => room } });

const overlay = new Overlay({
  onCreate: (name) => connect(() => createGame({ name })),
  onJoin: (code, name) => connect(() => joinGame(code, { name })),
  onPickHero: (heroId: HeroId) => room?.send(MSG.selectHero, { heroId }),
  onStart: () => room?.send(MSG.start),
  onReturnToLobby: () => room?.send(MSG.returnToLobby),
  onLeave: () => leave(),
  onPauseChange: (paused) => (scene().inputBlocked = paused),
});

async function connect(open: () => Promise<GameRoom>): Promise<void> {
  overlay.setBusy(true);
  try {
    enter(await open());
  } catch (err) {
    overlay.showMenu(friendlyError(err));
  } finally {
    overlay.setBusy(false);
  }
}

function enter(r: GameRoom): void {
  room = r;
  leaving = false;
  scene().attach(r);
  r.onStateChange((state) => overlay.render(state, r.sessionId));
  r.onLeave(() => {
    if (room !== r) return;
    room = null;
    scene().detach();
    if (!leaving) {
      forgetRoom();
      overlay.showMenu("Lost connection to the game.");
    }
  });
  r.onError((_code, message) => overlay.toast(message ?? "Server error"));
  const url = new URL(location.href);
  url.searchParams.set("code", r.roomId);
  history.replaceState(null, "", url);
}

function leave(): void {
  const r = room;
  leaving = true;
  room = null;
  forgetRoom();
  scene().detach();
  scene().inputBlocked = false;
  overlay.showMenu();
  const url = new URL(location.href);
  url.searchParams.delete("code");
  history.replaceState(null, "", url);
  r?.leave(true);
}

let audioStarted = false;
function startAudio(): void {
  if (audioStarted) return;
  audioStarted = true;
  unlockAudio();
  scene().music.start();
}
window.addEventListener("pointerdown", startAudio, { once: true });
window.addEventListener("keydown", startAudio, { once: true });

let lastFrame = -1;
setInterval(() => {
  const loop = game.loop;
  if (document.visibilityState === "visible" && loop.running && loop.frame === lastFrame) {
    loop.sleep();
    loop.wake();
  }
  lastFrame = loop.frame;
}, 1000);

game.events.once(Phaser.Core.Events.READY, async () => {
  const r = await tryReconnect();
  if (r) enter(r);
  else overlay.showMenu();
});
