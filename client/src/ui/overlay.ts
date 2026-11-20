import {
  ARMOR_LEVEL_NAMES,
  ARMOR_LOCATIONS,
  armorSetsForHero,
  CREATURE_RACE_LABELS,
  describeTradeoffs,
  EXPEDITION_LOCATION_IDS,
  EXPEDITION_LOCATIONS,
  GAME_MODE_LABELS,
  HERO_IDS,
  HEROES,
  LEVEL_TYPE_LABELS,
  MAX_PLAYERS,
  parsePerks,
  perksForHero,
  perksOfferedFor,
  SHOP_ITEMS,
  WASTES_EXPEDITION_STOPS,
  isExpeditionLocationId,
  isGameMode,
  isHeroId,
  parseLevelProps,
  weaponsForHero,
  type ArmorLocation,
  type ArmorSetId,
  type ExpeditionLocation,
  type ExpeditionLocationId,
  type GameMode,
  type HeroId,
  type LevelProperties,
  type PerkId,
  type ShopItemId,
  type ShopWeaponId,
} from "@twodverm/shared";
import type { GameStateView, PlayerView } from "../net/types";
import { getSettings, updateSettings } from "../settings";

export interface OverlayHandlers {
  onCreate(name: string, gameMode: GameMode, devTest: boolean): void;
  onJoin(code: string, name: string): void;
  onPickHero(heroId: HeroId): void;
  onAddAiHero(heroId: HeroId): void;
  onRemoveAiHero(heroId: HeroId): void;
  onStart(): void;
  onVoteLocation(locationId: ExpeditionLocationId): void;
  onTravel(): void;
  /** Wastes `devTest`: host jumps straight into a location. */
  onDevPickLocation(locationId: ExpeditionLocationId): void;
  onReturnToLobby(): void;
  onLeave(): void;
  onPauseChange(paused: boolean): void;
  onBuyShopItem(itemId: ShopItemId): void;
  onBuyPerk(perkId: PerkId): void;
  onBuyArmorSet(setId: ArmorSetId): void;
  onBuyWeapon(weaponId: ShopWeaponId): void;
}

const ARMOR_LOCATION_LABELS: Record<ArmorLocation, string> = { head: "Head", front: "Front", side: "Sides", back: "Back" };

const PERK_ICON = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 6 L54 14 V32 C54 46 44 54 32 58 C20 54 10 46 10 32 V14 Z" fill="#16303f" stroke="#8fd3ff" stroke-width="3" />
  <path d="M32 18 V46 M22 26 L32 34 L42 26 M24 40 L32 34 L40 40" fill="none" stroke="#bfe8ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const WEAPON_ICON = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 48 L40 20 L46 26 L18 54 Z" fill="#5a4030" stroke="#c9a14a" stroke-width="2" />
  <path d="M40 20 L52 8 L56 12 L46 26 Z" fill="#c9a14a" />
  <rect x="10" y="50" width="14" height="6" rx="1" fill="#8a6a40" transform="rotate(-45 17 53)" />
</svg>`;

const DMG_ICON = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="10" fill="#f2c14e" />
  <circle cx="32" cy="32" r="6" fill="#fff3c4" />
  <path d="M32 6 L36 22 L32 18 L28 22 Z" fill="#e85d04" />
  <path d="M32 58 L28 42 L32 46 L36 42 Z" fill="#e85d04" />
  <path d="M6 32 L22 28 L18 32 L22 36 Z" fill="#f48c06" />
  <path d="M58 32 L42 36 L46 32 L42 28 Z" fill="#f48c06" />
  <path d="M14 14 L26 24 L22 22 L24 26 Z" fill="#dc2f02" />
  <path d="M50 14 L40 26 L42 22 L38 24 Z" fill="#dc2f02" />
  <path d="M14 50 L26 40 L22 42 L24 38 Z" fill="#dc2f02" />
  <path d="M50 50 L38 40 L42 42 L40 38 Z" fill="#dc2f02" />
</svg>`;

const ARMOR_ICON = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 8 L52 16 V30 C52 44 42 52 32 56 C22 52 12 44 12 30 V16 Z" fill="#3a3632" stroke="#c9a14a" stroke-width="3" />
  <path d="M22 28 H42 V40 H22 Z" fill="#5a5248" />
  <path d="M32 16 V48" fill="none" stroke="#8a8070" stroke-width="2" />
</svg>`;

type ScreenId = "menu" | "lobby" | "expedition" | "results" | "pause" | "settings" | "shop";

/** Currently highlighted shop catalog entry (details + BUY live in the info panel). */
type ShopSelection =
  | { kind: "dmg" }
  | { kind: "perk"; id: PerkId }
  | { kind: "armor"; id: ArmorSetId }
  | { kind: "weapon"; id: ShopWeaponId };

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
  private shopOpen = false;
  private shopSelection: ShopSelection | null = null;
  private shopCatalogSignature = "";
  private busy = false;
  private signature = "";
  private toastTimer = 0;
  private localId = "";
  private lastState: GameStateView | null = null;
  private inspected: ExpeditionLocationId | null = null;
  private readonly nameInput = el<HTMLInputElement>("name-input");
  private readonly codeInput = el<HTMLInputElement>("code-input");
  private readonly modeSelect = el<HTMLSelectElement>("mode-select");
  private readonly devTestCheck = el<HTMLInputElement>("devtest-check");
  private readonly devTestRow = el("devtest-row");
  private readonly devTestHint = el("devtest-hint");

  constructor(private readonly h: OverlayHandlers) {
    const s = getSettings();
    this.nameInput.value = s.name;
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (code) this.codeInput.value = code.toUpperCase().slice(0, 4);

    this.modeSelect.onchange = () => this.syncDevTestVisibility();
    this.syncDevTestVisibility();
    el("create-btn").onclick = () =>
      this.submit(() => this.h.onCreate(this.name(), this.mode(), this.devTestEnabled()));
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
    el("shop-close-btn").onclick = () => this.closeShop();
    el("shop-grid").onclick = (e) => {
      const tile = (e.target as HTMLElement).closest<HTMLButtonElement>("button.shop-tile[data-shop-kind]");
      if (!tile) return;
      this.selectShopTile(tile);
    };
    el("shop-buy-btn").onclick = () => this.buySelectedShopItem();
    this.bindSettings();

    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (el("settings").classList.contains("show")) el("settings").classList.remove("show");
      else if (this.shopOpen) this.closeShop();
      else if (this.inRoom && (this.currentPhase === "playing" || this.currentPhase === "merchant")) this.setPaused(!this.paused);
    });
  }

  openShop(): void {
    if (!this.inRoom) return;
    const castlePlay = this.lastState?.gameMode === "castle" && this.currentPhase === "playing";
    if (this.currentPhase !== "merchant" && !castlePlay) return;
    this.shopOpen = true;
    this.shopSelection = null;
    this.shopCatalogSignature = "";
    el("shop").classList.add("show");
    this.h.onPauseChange(true);
    this.refreshShop();
  }

  closeShop(): void {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    this.shopSelection = null;
    el("shop").classList.remove("show");
    if (!this.paused) this.h.onPauseChange(false);
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

  private syncDevTestVisibility(): void {
    const wastes = this.mode() === "wastes";
    this.devTestRow.style.display = wastes ? "flex" : "none";
    this.devTestHint.style.display = wastes ? "block" : "none";
    if (!wastes) this.devTestCheck.checked = false;
  }

  private devTestEnabled(): boolean {
    return this.mode() === "wastes" && this.devTestCheck.checked;
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
    this.closeShop();
    this.signature = "";
    this.currentPhase = "";
    this.inspected = null;
    this.lastState = null;
    this.setBusy(false);
    this.error(error);
    this.show("menu");
  }

  get isPaused(): boolean {
    return this.paused;
  }

  private setPaused(p: boolean): void {
    this.paused = p;
    this.h.onPauseChange(p || this.shopOpen);
    this.show(p ? "pause" : null);
  }

  private refreshShop(): void {
    if (!this.shopOpen || !this.lastState) return;
    const me = this.lastState.players.get(this.localId);
    const gold = me?.gold ?? 0;
    el("shop-gold").textContent = `${gold} GP`;
    this.renderShopCatalog(me);
    this.renderShopInfo(me);
  }

  private selectShopTile(tile: HTMLButtonElement): void {
    const kind = tile.dataset.shopKind;
    const id = tile.dataset.shopId ?? "";
    if (kind === "dmg") this.shopSelection = { kind: "dmg" };
    else if (kind === "perk" && id) this.shopSelection = { kind: "perk", id: id as PerkId };
    else if (kind === "armor" && id) this.shopSelection = { kind: "armor", id: id as ArmorSetId };
    else if (kind === "weapon" && id) this.shopSelection = { kind: "weapon", id: id as ShopWeaponId };
    else return;
    this.refreshShop();
  }

  private buySelectedShopItem(): void {
    const sel = this.shopSelection;
    if (!sel) return;
    if (sel.kind === "dmg") this.h.onBuyShopItem("dmg_up");
    else if (sel.kind === "perk") this.h.onBuyPerk(sel.id);
    else if (sel.kind === "armor") this.h.onBuyArmorSet(sel.id);
    else if (sel.kind === "weapon") this.h.onBuyWeapon(sel.id);
  }

  private selectionKey(sel: ShopSelection | null): string {
    if (!sel) return "";
    if (sel.kind === "dmg") return "dmg";
    return `${sel.kind}:${sel.id}`;
  }

  private shopTileHtml(opts: {
    kind: ShopSelection["kind"];
    id: string;
    name: string;
    icon: string;
    owned?: boolean;
    selected: boolean;
  }): string {
    const classes = ["shop-tile"];
    if (opts.owned) classes.push("owned");
    if (opts.selected) classes.push("selected");
    const idAttr = opts.kind === "dmg" ? "" : ` data-shop-id="${opts.id}"`;
    return `<button type="button" class="${classes.join(" ")}" data-shop-kind="${opts.kind}"${idAttr} aria-pressed="${opts.selected ? "true" : "false"}">
      <div class="shop-tile-icon" aria-hidden="true">${opts.icon}</div>
      <p class="shop-tile-name">${escapeHtml(opts.name)}</p>
    </button>`;
  }

  /** Equal-sized catalog tiles: abilities, perks, weapons, and armour. */
  private renderShopCatalog(me: PlayerView | undefined): void {
    const heroId = me?.heroId ?? "";
    const gold = me?.gold ?? 0;
    const stacks = me?.dmgUpStacks ?? 0;
    const perksRaw = me?.perks ?? "";
    const ownedPerks = parsePerks(perksRaw);
    const offered = new Set(perksOfferedFor(heroId, ownedPerks).map((p) => p.id));
    const perks = perksForHero(heroId).filter((p) => ownedPerks.has(p.id) || offered.has(p.id));
    const weapons = weaponsForHero(heroId);
    const armor = armorSetsForHero(heroId);
    const primaryId = me?.primaryWeaponId ?? "";
    const secondaryId = me?.secondaryWeaponId ?? "";
    const armorId = me?.armorSetId ?? "";
    // Drop selection if that entry left the catalog.
    const prior = this.shopSelection;
    if (prior?.kind === "perk" && !perks.some((p) => p.id === prior.id)) this.shopSelection = null;
    else if (prior?.kind === "weapon" && !weapons.some((w) => w.id === prior.id)) this.shopSelection = null;
    else if (prior?.kind === "armor" && !armor.some((s) => s.id === prior.id)) this.shopSelection = null;

    const selKey = this.selectionKey(this.shopSelection);
    const sig = [
      heroId,
      gold,
      stacks,
      perksRaw,
      primaryId,
      secondaryId,
      armorId,
      selKey,
      perks.map((p) => p.id).join(","),
      weapons.map((w) => w.id).join(","),
      armor.map((s) => s.id).join(","),
    ].join("|");
    if (sig === this.shopCatalogSignature) return;
    this.shopCatalogSignature = sig;

    const tiles: string[] = [];
    const dmg = SHOP_ITEMS.dmg_up;
    tiles.push(
      this.shopTileHtml({
        kind: "dmg",
        id: dmg.id,
        name: dmg.name,
        icon: DMG_ICON,
        selected: selKey === "dmg",
      }),
    );
    for (const p of perks) {
      tiles.push(
        this.shopTileHtml({
          kind: "perk",
          id: p.id,
          name: p.name,
          icon: PERK_ICON,
          owned: ownedPerks.has(p.id),
          selected: selKey === `perk:${p.id}`,
        }),
      );
    }
    for (const w of weapons) {
      const equipped = w.slot === "primary" ? w.id === primaryId : w.id === secondaryId;
      tiles.push(
        this.shopTileHtml({
          kind: "weapon",
          id: w.id,
          name: w.name,
          icon: WEAPON_ICON,
          owned: equipped,
          selected: selKey === `weapon:${w.id}`,
        }),
      );
    }
    for (const s of armor) {
      tiles.push(
        this.shopTileHtml({
          kind: "armor",
          id: s.id,
          name: s.name,
          icon: ARMOR_ICON,
          owned: s.id === armorId,
          selected: selKey === `armor:${s.id}`,
        }),
      );
    }
    const box = el("shop-grid");
    box.innerHTML = tiles.length > 0 ? tiles.join("") : `<div class="shop-empty">Nothing for sale</div>`;
  }

  private renderShopInfo(me: PlayerView | undefined): void {
    const body = el("shop-info-body");
    const costEl = el("shop-info-cost");
    const statusEl = el("shop-info-status");
    const buy = el<HTMLButtonElement>("shop-buy-btn");
    const gold = me?.gold ?? 0;
    const sel = this.shopSelection;

    const hideBuy = () => {
      costEl.hidden = true;
      statusEl.hidden = true;
      buy.hidden = true;
      buy.disabled = true;
    };

    if (!sel) {
      body.innerHTML = `<p class="shop-info-placeholder">Select an ability or perk to see its details.</p>`;
      hideBuy();
      return;
    }

    if (sel.kind === "dmg") {
      const item = SHOP_ITEMS.dmg_up;
      const stacks = me?.dmgUpStacks ?? 0;
      body.innerHTML = `
        <div class="shop-info-kind">Ability</div>
        <h3 class="shop-info-name">${escapeHtml(item.name)}</h3>
        <p class="shop-info-desc">${escapeHtml(item.description)}</p>
        <p class="shop-info-meta"><b>Stacks owned</b> ${stacks}</p>`;
      costEl.hidden = false;
      costEl.textContent = `${item.cost} GP`;
      statusEl.hidden = true;
      buy.hidden = false;
      buy.disabled = gold < item.cost;
      buy.textContent = gold < item.cost ? "Need gold" : "Buy";
      return;
    }

    if (sel.kind === "perk") {
      const owned = parsePerks(me?.perks ?? "");
      const perk = perksForHero(me?.heroId ?? "").find((p) => p.id === sel.id);
      if (!perk) {
        body.innerHTML = `<p class="shop-info-placeholder">Select an ability or perk to see its details.</p>`;
        hideBuy();
        return;
      }
      const isOwned = owned.has(perk.id);
      body.innerHTML = `
        <div class="shop-info-kind">Perk</div>
        <h3 class="shop-info-name">${escapeHtml(perk.name)}</h3>
        <p class="shop-info-desc">${escapeHtml(perk.description)}</p>`;
      if (isOwned) {
        costEl.hidden = true;
        statusEl.hidden = false;
        statusEl.textContent = "Owned";
        buy.hidden = true;
        buy.disabled = true;
      } else {
        costEl.hidden = false;
        costEl.textContent = `${perk.cost} GP`;
        statusEl.hidden = true;
        buy.hidden = false;
        buy.disabled = gold < perk.cost;
        buy.textContent = gold < perk.cost ? "Need gold" : "Buy";
      }
      return;
    }

    if (sel.kind === "weapon") {
      const weapon = weaponsForHero(me?.heroId ?? "").find((w) => w.id === sel.id);
      if (!weapon) {
        body.innerHTML = `<p class="shop-info-placeholder">Select an ability or perk to see its details.</p>`;
        hideBuy();
        return;
      }
      const equipped =
        weapon.slot === "primary"
          ? weapon.id === (me?.primaryWeaponId ?? "")
          : weapon.id === (me?.secondaryWeaponId ?? "");
      const slotLabel = weapon.slot === "primary" ? "Primary (melee)" : "Secondary (ranged)";
      const desc =
        weapon.slot === "primary"
          ? "Melee kit. Buying replaces your current primary weapon."
          : "Ranged kit. Buying replaces your current secondary weapon.";
      body.innerHTML = `
        <div class="shop-info-kind">Weapon · ${slotLabel}</div>
        <h3 class="shop-info-name">${escapeHtml(weapon.name)}</h3>
        <p class="shop-info-desc">${desc}</p>
        ${equipped ? `<p class="shop-info-meta"><b>Status</b> Equipped</p>` : ""}`;
      costEl.hidden = false;
      costEl.textContent = `${weapon.cost} GP`;
      statusEl.hidden = true;
      buy.hidden = false;
      buy.disabled = gold < weapon.cost;
      buy.textContent = gold < weapon.cost ? "Need gold" : equipped ? "Buy again" : "Buy";
      return;
    }

    const set = armorSetsForHero(me?.heroId ?? "").find((s) => s.id === sel.id);
    if (!set) {
      body.innerHTML = `<p class="shop-info-placeholder">Select an ability or perk to see its details.</p>`;
      hideBuy();
      return;
    }
    const isEquipped = set.id === (me?.armorSetId ?? "");
    const levels = ARMOR_LOCATIONS.map(
      (loc) => `<span><b>${ARMOR_LOCATION_LABELS[loc]}</b> ${ARMOR_LEVEL_NAMES[set.loadout[loc]]}</span>`,
    ).join("");
    const tradeoffs = describeTradeoffs(set.tradeoffs);
    body.innerHTML = `
      <div class="shop-info-kind">Armour</div>
      <h3 class="shop-info-name">${escapeHtml(set.name)}</h3>
      <p class="shop-info-desc">${escapeHtml(tradeoffs ? `${set.description} ${tradeoffs}.` : set.description)}</p>
      <div class="shop-armor-levels">${levels}</div>`;
    if (isEquipped) {
      costEl.hidden = true;
      statusEl.hidden = false;
      statusEl.textContent = "Equipped";
      buy.hidden = true;
      buy.disabled = true;
    } else {
      costEl.hidden = false;
      costEl.textContent = `${set.cost} GP`;
      statusEl.hidden = true;
      buy.hidden = false;
      buy.disabled = gold < set.cost;
      buy.textContent = gold < set.cost ? "Need gold" : "Buy";
    }
  }

  /** Called on every state patch; only rebuilds the DOM when something visible changed. */
  render(state: GameStateView, localId: string): void {
    this.inRoom = true;
    this.localId = localId;
    this.lastState = state;
    this.code = state.code;
    if (state.phase !== this.currentPhase) {
      if (this.paused && state.phase !== "playing" && state.phase !== "merchant") this.setPaused(false);
      if (state.phase !== "merchant") this.closeShop();
      if (state.phase === "expedition") this.inspected = null;
      this.currentPhase = state.phase;
    }
    if (this.shopOpen) this.refreshShop();
    const players = [...state.players.values()];
    const sig = [
      state.phase,
      state.hostId,
      state.code,
      state.gameMode,
      state.devTest ? "1" : "0",
      state.levelId,
      state.expeditionOptionA,
      state.expeditionOptionB,
      state.expeditionPropsA,
      state.expeditionPropsB,
      state.expeditionStop,
      this.inspected ?? "",
      ...players.map(
        (p) =>
          `${p.id}:${p.name}:${p.heroId}:${p.connected}:${p.vote}:${state.phase === "lobby" || state.phase === "expedition" ? "" : `${p.kills}:${p.damageDealt}:${p.gold ?? 0}:${p.dmgUpStacks ?? 0}`}`,
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
    el("lobby-mode").textContent = state.devTest && mode === "wastes" ? `${GAME_MODE_LABELS[mode]} · devTest` : GAME_MODE_LABELS[mode];
    const players = [...state.players.values()];
    const me = state.players.get(localId);
    el("lobby-players").innerHTML =
      players
        .map((p) => {
          const hero = isHeroId(p.heroId) ? HEROES[p.heroId].name : "choosing...";
          const host = p.id === state.hostId ? " (host)" : "";
          const ai = p.isAi ? " (AI)" : "";
          const off = p.connected || p.isAi ? "" : " - reconnecting";
          return `<span class="player-chip${p.id === localId ? " me" : ""}${p.isAi ? " ai" : ""}">${escapeHtml(p.name)}${host}${ai}: ${hero}${off}</span>`;
        })
        .join("") + `<span class="muted" style="align-self:center">${players.length}/${MAX_PLAYERS}</span>`;

    const isHost = state.hostId === localId;
    const roomFull = players.length >= MAX_PLAYERS;
    const heroes = el("lobby-heroes");
    heroes.innerHTML = "";
    for (const id of HERO_IDS) {
      const def = HEROES[id];
      const owner = players.find((p) => p.heroId === id);
      const mine = owner?.id === localId;
      const aiOwned = !!owner?.isAi;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `hero-card${mine ? " selected" : ""}${aiOwned ? " ai-seat" : ""}`;
      btn.style.borderLeftColor = def.color;
      const takenByOtherHuman = !!owner && !mine && !aiOwned;
      btn.disabled = takenByOtherHuman;
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
        ${
          aiOwned
            ? `<span class="taken ai-label">AI teammate${isHost ? " — click to remove" : ""}</span>`
            : owner && !mine
              ? `<span class="taken">Taken by ${escapeHtml(owner.name)}</span>`
              : isHost && !owner && !roomFull
                ? `<span class="ai-hint">Click to play · Host: right-click or “Add AI”</span>`
                : ""
        }`;
      if (isHost && aiOwned) {
        btn.onclick = () => this.h.onRemoveAiHero(id);
      } else if (!owner || mine) {
        btn.onclick = () => this.h.onPickHero(id);
      }
      if (isHost && !owner && !roomFull) {
        const add = document.createElement("button");
        add.type = "button";
        add.className = "ai-add-btn";
        add.textContent = "Add AI";
        add.onclick = (ev) => {
          ev.stopPropagation();
          this.h.onAddAiHero(id);
        };
        btn.appendChild(add);
      }
      if (isHost && !owner && !roomFull) {
        btn.oncontextmenu = (ev) => {
          ev.preventDefault();
          this.h.onAddAiHero(id);
        };
      }
      heroes.appendChild(btn);
    }

    const allPicked = players.every((p) => isHeroId(p.heroId));
    const start = el<HTMLButtonElement>("start-btn");
    start.style.display = isHost ? "" : "none";
    start.disabled = !allPicked;
    start.textContent = mode === "wastes" ? "Enter staging hall" : "Start mission";
    el("lobby-status").textContent = !me?.heroId
      ? "Pick a hero"
      : isHost
        ? allPicked
          ? mode === "wastes"
            ? state.devTest
              ? "Start in the testing hall with bonus gold when ready"
              : "Start in the testing hall when ready"
            : "Everyone is ready"
          : "Waiting for everyone to pick a hero — host can Add AI on free cards"
        : mode === "wastes"
          ? "Waiting for the host to open the staging hall"
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
    const isHost = state.hostId === localId;

    el("expedition-panel").classList.toggle("expedition-wide", state.devTest);
    el("expedition-progress").textContent = `Stop ${nextStop} of ${WASTES_EXPEDITION_STOPS}`;
    this.renderDevTestMapGrid(state.devTest, isHost, nextStop);

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

    const anyVote = players.some((p) => !!p.vote);
    const allVoted = players.filter((p) => p.connected).every((p) => !!p.vote);
    const travel = el<HTMLButtonElement>("travel-btn");
    travel.style.display = isHost ? "" : "none";
    travel.disabled = !anyVote;
    el("expedition-status").textContent = !myVote
      ? state.devTest && isHost
        ? "Vote a fork, or pick any map on the right to jump in"
        : "Inspect a path, then click Vote to confirm"
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

  /** 3×3 name grid of every Wastes map; host click launches at current stop difficulty. */
  private renderDevTestMapGrid(devTest: boolean, isHost: boolean, nextStop: number): void {
    const grid = el("devtest-map-grid");
    const cells = el("devtest-map-cells");
    grid.hidden = !devTest;
    if (!devTest) {
      cells.innerHTML = "";
      return;
    }
    const slots = 9;
    const ids = EXPEDITION_LOCATION_IDS;
    cells.innerHTML = "";
    for (let i = 0; i < slots; i++) {
      const id = ids[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "devtest-map-cell";
      if (!id) {
        btn.classList.add("empty");
        btn.disabled = true;
        btn.textContent = "";
      } else {
        const loc = EXPEDITION_LOCATIONS[id];
        btn.textContent = loc.name;
        btn.title = `Launch ${loc.name} at difficulty ${nextStop}`;
        btn.disabled = !isHost;
        if (isHost) {
          btn.onclick = () => this.h.onDevPickLocation(id);
        }
      }
      cells.appendChild(btn);
    }
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
        return `<tr><td>${escapeHtml(p.name)}${p.id === localId ? " (you)" : ""}</td><td>${hero}</td><td>${p.kills}</td><td>${Math.round(p.damageDealt)}</td><td>${p.gold ?? 0} GP</td></tr>`;
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
