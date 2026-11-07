import {
  CREATURE_RACE_LABELS,
  EXPEDITION_LOCATIONS,
  GAME_MODE_LABELS,
  HERO_IDS,
  HEROES,
  LEVEL_TYPE_LABELS,
  MAX_PLAYERS,
  WASTES_EXPEDITION_STOPS,
  isExpeditionLocationId,
  isGameMode,
  isHeroId,
  parseLevelProps,
  type ExpeditionLocation,
  type ExpeditionLocationId,
  type GameMode,
  type HeroId,
  type LevelProperties,
} from "@twodverm/shared";
import type { GameStateView } from "../net/types";
import { getSettings, updateSettings } from "../settings";

export interface OverlayHandlers {
  onCreate(name: string, gameMode: GameMode): void;
  onJoin(code: string, name: string): void;
  onPickHero(heroId: HeroId): void;
  onStart(): void;
  onVoteLocation(locationId: ExpeditionLocationId): void;
  onTravel(): void;
  onReturnToLobby(): void;
  onLeave(): void;
  onPauseChange(paused: boolean): void;
}

type ScreenId = "menu" | "lobby" | "expedition" | "results" | "pause" | "settings";

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing #${id}`);
  return e as T;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export class Overlay {
  private inRoom = false;
  private paused = false;
  private busy = false;
  private signature = "";
  private toastTimer = 0;
  private inspected: ExpeditionLocationId | null = null;
  private readonly nameInput = el<HTMLInputElement>("name-input");
  private readonly codeInput = el<HTMLInputElement>("code-input");
  private readonly modeSelect = el<HTMLSelectElement>("mode-select");

  constructor(private readonly h: OverlayHandlers) {
    const s = getSettings();
    this.nameInput.value = s.name;
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (code) this.codeInput.value = code.toUpperCase().slice(0, 4);

    el("create-btn").onclick = () => this.submit(() => this.h.onCreate(this.name(), this.mode()));
    el("join-btn").onclick = () => this.join();
    this.codeInput.onkeydown = (e) => {
      if (e.key === "Enter") this.join();
    };
    this.codeInput.oninput = () => (this.codeInput.value = this.codeInput.value.toUpperCase().replace(/[^A-Z]/g, ""));
    this.nameInput.onchange = () => updateSettings({ name: this.nameInput.value.trim() });

    el("copy-link-btn").onclick = () => this.copyLink();
    el("start-btn").onclick = () => this.h.onStart();
    el("lobby-leave-btn").onclick = () => this.h.onLeave();
    el("expedition-leave-btn").onclick = () => this.h.onLeave();
    el("vote-btn").onclick = () => this.confirmVote();
    el("travel-btn").onclick = () => this.h.onTravel();
    el("results-leave-btn").onclick = () => this.h.onLeave();
    el("return-btn").onclick = () => this.h.onReturnToLobby();
    el("resume-btn").onclick = () => this.setPaused(false);
    el("pause-leave-btn").onclick = () => {
      this.setPaused(false);
      this.h.onLeave();
    };
    el("menu-settings-btn").onclick = () => this.openSettings();
    el("pause-settings-btn").onclick = () => this.openSettings();
    el("settings-close-btn").onclick = () => el("settings").classList.remove("show");
    this.bindSettings();

    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (el("settings").classList.contains("show")) el("settings").classList.remove("show");
      else if (this.inRoom && (this.currentPhase === "playing" || this.currentPhase === "merchant")) this.setPaused(!this.paused);
    });
  }

  private currentPhase = "";
  private code = "";

  private name(): string {
    const n = this.nameInput.value.trim();
    updateSettings({ name: n });
    return n || "Hero";
  }

  private mode(): GameMode {
    const v = this.modeSelect.value;
    return isGameMode(v) ? v : "default";
  }

  private join(): void {
    const code = this.codeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
      this.error("Room codes are 4 letters.");
      return;
    }
    this.submit(() => this.h.onJoin(code, this.name()));
  }

  private submit(fn: () => void): void {
    if (this.busy) return;
    this.error("");
    fn();
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    (el("create-btn") as HTMLButtonElement).disabled = busy;
    (el("join-btn") as HTMLButtonElement).disabled = busy;
  }

  error(msg: string): void {
    el("menu-error").textContent = msg;
  }

  toast(msg: string, ms = 2500): void {
    const t = el("toast");
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (t.style.display = "none"), ms);
  }

  private show(id: ScreenId | null): void {
    for (const s of ["menu", "lobby", "expedition", "results", "pause"] as const) el(s).classList.toggle("show", s === id);
  }

  showMenu(error = ""): void {
    this.inRoom = false;
    this.paused = false;
    this.signature = "";
    this.currentPhase = "";
    this.inspected = null;
    this.setBusy(false);
    this.error(error);
    this.show("menu");
  }

  get isPaused(): boolean {
    return this.paused;
  }

  private setPaused(p: boolean): void {
    this.paused = p;
    this.h.onPauseChange(p);
    this.show(p ? "pause" : null);
  }

  /** Called on every state patch; only rebuilds the DOM when something visible changed. */
  render(state: GameStateView, localId: string): void {
    this.inRoom = true;
    this.code = state.code;
    if (state.phase !== this.currentPhase) {
      if (this.paused && state.phase !== "playing") this.setPaused(false);
      if (state.phase === "expedition") this.inspected = null;
      this.currentPhase = state.phase;
    }
    const players = [...state.players.values()];
    const sig = [
      state.phase,
      state.hostId,
      state.code,
      state.gameMode,
      state.levelId,
      state.expeditionOptionA,
      state.expeditionOptionB,
      state.expeditionPropsA,
      state.expeditionPropsB,
      state.expeditionStop,
      this.inspected ?? "",
      ...players.map(
        (p) =>
          `${p.id}:${p.name}:${p.heroId}:${p.connected}:${p.vote}:${state.phase === "lobby" || state.phase === "expedition" ? "" : `${p.kills}:${p.damageDealt}`}`,
      ),
    ].join("|");
    if (sig === this.signature) return;
    this.signature = sig;

    if (state.phase === "lobby") this.renderLobby(state, localId);
    else if (state.phase === "expedition") this.renderExpedition(state, localId);
    else if (state.phase === "victory" || state.phase === "defeat") this.renderResults(state, localId);
    else if (!this.paused) this.show(null);
  }

  private renderLobby(state: GameStateView, localId: string): void {
    this.show("lobby");
    el("lobby-code").textContent = state.code;
    const mode = isGameMode(state.gameMode) ? state.gameMode : "default";
    el("lobby-mode").textContent = GAME_MODE_LABELS[mode];
    const players = [...state.players.values()];
    const me = state.players.get(localId);
    el("lobby-players").innerHTML =
      players
        .map((p) => {
          const hero = isHeroId(p.heroId) ? HEROES[p.heroId].name : "choosing...";
          const host = p.id === state.hostId ? " (host)" : "";
          const off = p.connected ? "" : " - reconnecting";
          return `<span class="player-chip${p.id === localId ? " me" : ""}">${escapeHtml(p.name)}${host}: ${hero}${off}</span>`;
        })
        .join("") + `<span class="muted" style="align-self:center">${players.length}/${MAX_PLAYERS}</span>`;

    const heroes = el("lobby-heroes");
    heroes.innerHTML = "";
    for (const id of HERO_IDS) {
      const def = HEROES[id];
      const owner = players.find((p) => p.heroId === id);
      const mine = owner?.id === localId;
      const btn = document.createElement("button");
      btn.className = `hero-card${mine ? " selected" : ""}`;
      btn.style.borderLeftColor = def.color;
      btn.disabled = !!owner && !mine;
      btn.innerHTML = `<span class="name">${def.name}</span><span class="title">${def.title}</span>
        <span class="desc">${def.description}</span>
        <div class="stats">
          <span>Health <b>${def.hp}</b></span>
          <span>Move speed <b>${def.speed}</b></span>
          <span>Block stamina <b>${def.stamina}</b></span>
          <span>Dodges <b>${def.dodges}</b></span>
          <span>Stagger resist <b>${def.staggerResist}</b></span>
          <span>Size <b>${def.radius}</b></span>
          <span>Melee <b>${escapeHtml(def.weapon.name)}</b></span>
          <span>Ranged <b>${escapeHtml(def.ranged.name)}</b></span>
          <span>Ammo <b>${def.ranged.ammo}</b></span>
          <span>Ult CD <b>${def.ultCooldown}s</b></span>
        </div>
        <span class="desc"><b>Ultimate:</b> ${escapeHtml(def.ultName)}</span>
        ${owner && !mine ? `<span class="taken">Taken by ${escapeHtml(owner.name)}</span>` : ""}`;
      btn.onclick = () => this.h.onPickHero(id);
      heroes.appendChild(btn);
    }

    const isHost = state.hostId === localId;
    const allPicked = players.every((p) => isHeroId(p.heroId));
    const start = el<HTMLButtonElement>("start-btn");
    start.style.display = isHost ? "" : "none";
    start.disabled = !allPicked;
    start.textContent = mode === "wastes" ? "Open Gingey's Map" : "Start mission";
    el("lobby-status").textContent = !me?.heroId
      ? "Pick a hero"
      : isHost
        ? allPicked
          ? mode === "wastes"
            ? "Open the map when ready"
            : "Everyone is ready"
          : "Waiting for everyone to pick a hero"
        : mode === "wastes"
          ? "Waiting for the host to open the map"
          : "Waiting for the host to start";
  }

  private renderExpedition(state: GameStateView, localId: string): void {
    this.show("expedition");
    const optionA = isExpeditionLocationId(state.expeditionOptionA) ? state.expeditionOptionA : null;
    const optionB = isExpeditionLocationId(state.expeditionOptionB) ? state.expeditionOptionB : null;
    const players = [...state.players.values()];
    const me = state.players.get(localId);
    const myVote = isExpeditionLocationId(me?.vote) ? me.vote : null;
    const nextStop = Math.min(state.expeditionStop + 1, WASTES_EXPEDITION_STOPS);

    el("expedition-progress").textContent = `Stop ${nextStop} of ${WASTES_EXPEDITION_STOPS}`;

    if (!this.inspected) this.inspected = myVote ?? optionA;

    const voteCount = (id: string) => players.filter((p) => p.vote === id).length;

    const propsFor = (id: ExpeditionLocationId | null): LevelProperties | null => {
      if (!id) return null;
      if (id === optionA) return parseLevelProps(state.expeditionPropsA);
      if (id === optionB) return parseLevelProps(state.expeditionPropsB);
      return null;
    };

    this.fillLocationNode(el<HTMLButtonElement>("expedition-option-a"), optionA, myVote, voteCount, propsFor(optionA));
    this.fillLocationNode(el<HTMLButtonElement>("expedition-option-b"), optionB, myVote, voteCount, propsFor(optionB));

    const detail = this.inspected && isExpeditionLocationId(this.inspected) ? EXPEDITION_LOCATIONS[this.inspected] : null;
    const detailProps = this.inspected && isExpeditionLocationId(this.inspected) ? propsFor(this.inspected) : null;
    el("expedition-detail").innerHTML = detail
      ? this.locationDetailHtml(detail, detailProps)
      : `<div class="muted">Select a location to inspect its dangers and rewards.</div>`;
    this.updateVoteButton(myVote);

    el("expedition-votes").innerHTML = players
      .map((p) => {
        const choice = isExpeditionLocationId(p.vote) ? EXPEDITION_LOCATIONS[p.vote].name : "deciding...";
        return `<span class="player-chip${p.id === localId ? " me" : ""}">${escapeHtml(p.name)}: ${escapeHtml(choice)}</span>`;
      })
      .join("");

    const isHost = state.hostId === localId;
    const anyVote = players.some((p) => !!p.vote);
    const allVoted = players.filter((p) => p.connected).every((p) => !!p.vote);
    const travel = el<HTMLButtonElement>("travel-btn");
    travel.style.display = isHost ? "" : "none";
    travel.disabled = !anyVote;
    el("expedition-status").textContent = !myVote
      ? "Inspect a path, then click Vote to confirm"
      : this.inspected && this.inspected !== myVote
        ? "Inspecting another path — Vote again to change"
        : isHost
          ? allVoted
            ? "All voted — Travel, or wait for auto-depart"
            : "Waiting for votes — Travel uses majority of votes cast"
          : allVoted
            ? "All voted — departing soon"
            : "Waiting for the rest of the party";
  }

  private updateVoteButton(myVote: ExpeditionLocationId | null): void {
    const btn = el<HTMLButtonElement>("vote-btn");
    const id = this.inspected;
    if (!id || !isExpeditionLocationId(id)) {
      btn.disabled = true;
      btn.textContent = "Vote for this path";
      return;
    }
    if (myVote === id) {
      btn.disabled = true;
      btn.textContent = "Voted for this path";
      return;
    }
    btn.disabled = false;
    btn.textContent = myVote ? "Change vote to this path" : "Vote for this path";
  }

  private confirmVote(): void {
    if (!this.inspected || !isExpeditionLocationId(this.inspected)) return;
    this.h.onVoteLocation(this.inspected);
  }

  private fillLocationNode(
    btn: HTMLButtonElement,
    id: ExpeditionLocationId | null,
    myVote: ExpeditionLocationId | null,
    voteCount: (id: string) => number,
    props: LevelProperties | null,
  ): void {
    if (!id) {
      btn.disabled = true;
      btn.innerHTML = `<span class="loc-name">Unknown path</span>`;
      btn.onclick = null;
      return;
    }
    const loc = EXPEDITION_LOCATIONS[id];
    btn.disabled = false;
    btn.classList.toggle("inspected", this.inspected === id);
    btn.classList.toggle("voted", myVote === id);
    const votes = voteCount(id);
    const typeLabel = props ? LEVEL_TYPE_LABELS[props.levelType] : loc.factions;
    const diffLabel = props ? `Difficulty ${props.difficulty.toFixed(1)}` : loc.curse ? `Curse: ${loc.curse}` : "Uncursed";
    btn.innerHTML = `<span class="loc-name">${escapeHtml(loc.name)}</span>
      <span class="loc-curse${props || loc.curse ? "" : " none"}">${escapeHtml(diffLabel)}</span>
      <span class="muted">${escapeHtml(typeLabel)}</span>
      <span class="loc-votes">${myVote === id ? "Your vote · " : ""}${votes} vote${votes === 1 ? "" : "s"}</span>`;
    btn.onclick = () => {
      this.inspected = id;
      el("expedition-detail").innerHTML = this.locationDetailHtml(loc, props);
      el("expedition-option-a").classList.toggle("inspected", id === el("expedition-option-a").dataset.locId);
      el("expedition-option-b").classList.toggle("inspected", id === el("expedition-option-b").dataset.locId);
      this.updateVoteButton(myVote);
      this.signature = "";
    };
    btn.dataset.locId = id;
  }

  private locationDetailHtml(loc: ExpeditionLocation, props: LevelProperties | null): string {
    const races = props
      ? props.allowableRaces.map((r) => CREATURE_RACE_LABELS[r]).join(", ")
      : loc.factions;
    const primary = props ? CREATURE_RACE_LABELS[props.primaryRace] : null;
    return `<h3>${escapeHtml(loc.name)}</h3>
      <div class="detail-line">${escapeHtml(loc.description)}</div>
      ${
        props
          ? `<div class="detail-line"><b>Level type:</b> ${escapeHtml(LEVEL_TYPE_LABELS[props.levelType])}</div>
      <div class="detail-line"><b>Difficulty:</b> ${props.difficulty.toFixed(1)}</div>
      <div class="detail-line"><b>Primary race:</b> ${escapeHtml(primary!)}</div>
      <div class="detail-line"><b>Allowable races:</b> ${escapeHtml(races)}</div>`
          : `<div class="detail-line"><b>Factions:</b> ${escapeHtml(loc.factions)}</div>`
      }
      <div class="detail-line"><b>Curse:</b> ${loc.curse ? escapeHtml(loc.curse) : "None"}</div>
      <div class="detail-line"><b>Modifiers:</b> ${loc.modifiers.map(escapeHtml).join(" · ")}</div>
      <div class="detail-line"><b>Completion reward:</b> ${escapeHtml(loc.reward)}</div>`;
  }

  private renderResults(state: GameStateView, localId: string): void {
    this.show("results");
    const win = state.phase === "victory";
    el("results-title").textContent = win ? "Victory" : "Defeat";
    el("results-title").style.color = win ? "var(--accent)" : "#ff8a70";
    el("results-subtitle").textContent = win
      ? state.gameMode === "wastes"
        ? "Expedition complete. Four paths conquered in the Gingey Wastes."
        : "You escaped the city. The rats will remember this."
      : "The horde overwhelmed you.";
    el("results-body").innerHTML = [...state.players.values()]
      .map((p) => {
        const hero = isHeroId(p.heroId) ? HEROES[p.heroId].name : "-";
        return `<tr><td>${escapeHtml(p.name)}${p.id === localId ? " (you)" : ""}</td><td>${hero}</td><td>${p.kills}</td><td>${Math.round(p.damageDealt)}</td></tr>`;
      })
      .join("");
    const isHost = state.hostId === localId;
    el("return-btn").style.display = isHost ? "" : "none";
    el("results-status").textContent = isHost ? "" : "Waiting for the host";
  }

  private copyLink(): void {
    const url = `${location.origin}${location.pathname}?code=${this.code}`;
    navigator.clipboard
      .writeText(url)
      .then(() => this.toast("Invite link copied. Send it to your friends!"))
      .catch(() => this.toast(url, 6000));
  }

  private openSettings(): void {
    const s = getSettings();
    el<HTMLInputElement>("set-master").value = String(s.masterVolume);
    el<HTMLInputElement>("set-music").value = String(s.musicVolume);
    el<HTMLInputElement>("set-numbers").checked = s.damageNumbers;
    el<HTMLInputElement>("set-shake").checked = s.screenShake;
    el("settings").classList.add("show");
  }

  private bindSettings(): void {
    el<HTMLInputElement>("set-master").oninput = (e) => updateSettings({ masterVolume: Number((e.target as HTMLInputElement).value) });
    el<HTMLInputElement>("set-music").oninput = (e) => updateSettings({ musicVolume: Number((e.target as HTMLInputElement).value) });
    el<HTMLInputElement>("set-numbers").onchange = (e) => updateSettings({ damageNumbers: (e.target as HTMLInputElement).checked });
    el<HTMLInputElement>("set-shake").onchange = (e) => updateSettings({ screenShake: (e.target as HTMLInputElement).checked });
  }
}
