/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";
import {
  evaluatePathTraversal,
  formatTraversalBlockedReason,
  formatTraversalRequirement,
  getPathBetweenRegions,
  getReachableRegionIds,
  getRegionIndexById,
  getVisiblePathIds,
  hydrateTraversalRuntimeState,
} from "../models/worldTraversal.js";

// @ts-ignore - Vite handles import.meta.env at build time, bypassing strict IDE module checks
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const API = "/api";
const DEV_API = "/dev";
let G: any = {
  playerId: null,
  characterId: null,
  worldSeed: null,
  regions: [],
  selectedRegion: null,
  selectedRegionIndex: 0,
  user: null,
  gs: null,
  activeCombat: null,
  worldDefinition: null as any,
  selectedLegend: null as any,
  createdWorlds: [] as any[],
  recentJourneys: [] as any[],
  allContent: { biomes: [], monsters: [], factions: [], maps: [] },
  customSelection: { biomes: [] as string[], monsters: [] as string[] },
};

const GUEST_EMAIL = "guest@local";
const GUEST_STORAGE_KEY = "rpg_guest_mode";
const INVITE_STORAGE_KEY = "rpg_invite_code";
const PENDING_LOAD_KEY = "rpg_pending_load";
const NORMALIZED_PATH =
  window.location.pathname.replace(/\.html$/, "").replace(/\/+$/, "") || "/";
const APP_PAGE =
  NORMALIZED_PATH === "/hub"
    ? "hub"
    : NORMALIZED_PATH === "/map"
    ? "map"
    : NORMALIZED_PATH === "/vault"
      ? "vault"
      : NORMALIZED_PATH === "/forge"
        ? "forge"
        : NORMALIZED_PATH === "/adventure"
          ? "adventure"
          : document.documentElement.dataset.appPage || "menu";
const IS_GAMEPLAY_PAGE = APP_PAGE === "adventure" || APP_PAGE === "map";
document.documentElement.dataset.appPage = APP_PAGE;
const PRESET_WORLD_BIOMES: Record<string, string[]> = {
  balanced: ["forest", "coast", "mountain", "desert"],
  inferno: ["volcanic"],
  cursed: ["cursed_land", "swamp"],
  ancient: ["ruins"],
};

const SKILL_SIGIL_LEXICON = [
  {
    category: "Trigger",
    values: [
      "Self Cast",
      "On Hit",
      "On Damaged",
      "On Kill",
      "Low HP",
      "Low Mana",
      "Timed",
      "Enter Combat",
      "Buff Event",
      "Random Trigger",
    ],
  },
  {
    category: "Skill Role",
    values: [
      "None",
      "Attack",
      "Defense",
      "Buff",
      "Debuff",
      "Curse",
      "Heal",
      "Summon",
      "Utility",
      "Random Role",
    ],
  },
  {
    category: "Target Type",
    values: [
      "Self",
      "Single Enemy",
      "Multi Enemy",
      "All Enemies",
      "Area",
      "Single Ally",
      "All Allies",
      "Random Target",
      "All Units Area",
      "Random Target Type",
    ],
  },
  {
    category: "Effect Type",
    values: [
      "None",
      "Physical",
      "Magical",
      "Soul",
      "Life Steal",
      "Mana Drain",
      "Max HP Damage",
      "Mana Break",
      "Armor Break",
      "Random Effect",
    ],
  },
  {
    category: "Scaling Source",
    values: [
      "No Scaling",
      "Attack Power",
      "Defense Power",
      "Max HP",
      "Max Mana",
      "Speed",
      "Level",
      "Enemy Count",
      "Buff Count",
      "Random Scaling",
    ],
  },
  {
    category: "Delivery Type",
    values: [
      "Instant",
      "Direct Strike",
      "Explosion",
      "Wave",
      "Chain",
      "Aura",
      "Ring",
      "Beam",
      "Spawn Object",
      "Random Delivery",
    ],
  },
  {
    category: "Duration Type",
    values: [
      "Instant",
      "Short",
      "Medium",
      "Long",
      "Continuous",
      "Periodic",
      "Stackable",
      "Delayed",
      "Conditional",
      "Random Duration",
    ],
  },
  {
    category: "Secondary Modifier",
    values: [
      "None",
      "Life Steal",
      "Armor Up",
      "Attack Up",
      "Slow",
      "Status Effect",
      "Bounce",
      "Range Up",
      "Cooldown Reduce",
      "Random Modifier",
    ],
  },
  {
    category: "Special Property",
    values: [
      "None",
      "HP Trade Power",
      "Mana Overload",
      "Random Outcome",
      "Backfire",
      "Permanent Stack",
      "Mutation",
      "Low HP Boost",
      "Hidden Unlock",
      "Anomaly",
    ],
  },
] as const;

const RUNE_ALPHABET: Record<string, string> = {
  A: "ᚨ",
  B: "ᛒ",
  C: "ᚲ",
  D: "ᛞ",
  E: "ᛖ",
  F: "ᚠ",
  G: "ᚷ",
  H: "ᚺ",
  I: "ᛁ",
  J: "ᛃ",
  K: "ᚲ",
  L: "ᛚ",
  M: "ᛗ",
  N: "ᚾ",
  O: "ᛟ",
  P: "ᛈ",
  Q: "ᚲ",
  R: "ᚱ",
  S: "ᛊ",
  T: "ᛏ",
  U: "ᚢ",
  V: "ᚡ",
  W: "ᚹ",
  X: "ᚲᛊ",
  Y: "ᛇ",
  Z: "ᛉ",
  " ": " ᛫ ",
  "-": " ᛫ ",
  _: " ᛫ ",
  "/": " ᛬ ",
  "|": " ᛭ ",
  ".": " ᛫ ",
  ",": " ᛫ ",
  ":": " ᛬ ",
  "&": " ᛭ ",
  "'": "",
  '"': "",
  "(": " ",
  ")": " ",
};

// Vault and Forge state
let forgeState = { skillCode: "", skillData: null as any };
let forgeSigilHost: HTMLElement | null = null;
let forgeSigilSpinFrame: number | null = null;
let forgeSigilSettleFrame: number | null = null;
let forgeSigilRotation = 0;
let forgeSigilVelocity = 0;
let forgeSigilTargetVelocity = 0;
let forgeSigilLastTimestamp = 0;

// --- AUTH ---
let authMode = "login";
function toggleAuthMode() {
  authMode = authMode === "login" ? "signup" : "login";
  const titleEl = document.getElementById("auth-title");
  const btnEl = document.getElementById("btn-auth");
  const toggleEl = document.getElementById("auth-toggle");

  if (titleEl)
    titleEl.textContent =
      authMode === "login" ? "🔐 Character Login" : "🛡️ Join the Realm";
  if (btnEl)
    btnEl.textContent =
      authMode === "login" ? "Enter Realm" : "Claim Your Glory";
  if (toggleEl)
    toggleEl.textContent =
      authMode === "login"
        ? "Need an account? Sign Up"
        : "Already have a hero? Login";
}

function showAuthError(msg: string) {
  const errEl = document.getElementById("auth-error");
  if (errEl) {
    errEl.textContent = "⚠️ " + msg;
    errEl.style.display = "block";
  }
}
function clearAuthError() {
  const errEl = document.getElementById("auth-error");
  if (errEl) errEl.style.display = "none";
}

function enterGuestMode() {
  clearAuthError();
  localStorage.setItem(GUEST_STORAGE_KEY, "true");
  localStorage.removeItem(INVITE_STORAGE_KEY);
  G.user = {
    id: null,
    email: GUEST_EMAIL,
    isGuest: true,
  };
  onLoginSuccess();
}

function buildIdentityQuery() {
  const params = new URLSearchParams();
  if (G.user?.id) params.set("userId", G.user.id);
  if (G.user?.email) params.set("email", G.user.email);
  if (G.user?.inviteCode) params.set("inviteCode", G.user.inviteCode);
  return params;
}

function pageHref(page: string) {
  if (page === "hub") return "/hub";
  if (page === "map") return "/map";
  if (page === "vault") return "/vault";
  if (page === "forge") return "/forge";
  if (page === "adventure") return "/adventure";
  return "/";
}

function humanizeSkillTerm(value: unknown) {
  return String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\bHp\b/gi, "HP")
    .replace(/\bMp\b/gi, "MP")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenSigilPhrase(value: unknown, maxWords = 2, maxChars = 18) {
  const words = humanizeSkillTerm(value).split(" ").filter(Boolean);
  const shortened = words.slice(0, maxWords).join(" ");
  return shortened.slice(0, maxChars).trim();
}

function toRuneText(value: unknown) {
  return humanizeSkillTerm(value)
    .toUpperCase()
    .split("")
    .map((char) => RUNE_ALPHABET[char] ?? char)
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getSigilSegments(code: string) {
  const digits = code
    .replace(/\D/g, "")
    .slice(0, 9)
    .padEnd(9, "0")
    .split("")
    .map((digit) => Number(digit));

  return digits.map((digit, index) => {
    const bucket = SKILL_SIGIL_LEXICON[index];
    return {
      digit,
      category: bucket.category,
      value: bucket.values[digit] || bucket.values[0],
    };
  });
}

function polarPoint(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function buildCirclePath(
  cx: number,
  cy: number,
  radius: number,
  reverse = false,
) {
  if (reverse) {
    return `M ${cx} ${cy - radius} a ${radius} ${radius} 0 1 0 0 ${
      radius * 2
    } a ${radius} ${radius} 0 1 0 0 -${radius * 2}`;
  }
  return `M ${cx} ${cy - radius} a ${radius} ${radius} 0 1 1 0 ${
    radius * 2
  } a ${radius} ${radius} 0 1 1 0 -${radius * 2}`;
}

function buildSigilStarPoints(
  cx: number,
  cy: number,
  radius: number,
  step = 4,
  total = 9,
) {
  let index = 0;
  const ordered: string[] = [];
  for (let i = 0; i < total; i++) {
    const point = polarPoint(cx, cy, radius, (360 / total) * index);
    ordered.push(`${point.x.toFixed(2)},${point.y.toFixed(2)}`);
    index = (index + step) % total;
  }
  const first = polarPoint(cx, cy, radius, 0);
  ordered.push(`${first.x.toFixed(2)},${first.y.toFixed(2)}`);
  return ordered.join(" ");
}

function buildSigilTicks(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  count: number,
) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (360 / count) * index;
    const inner = polarPoint(cx, cy, innerRadius, angle);
    const outer = polarPoint(cx, cy, outerRadius, angle);
    return `<line x1="${inner.x.toFixed(2)}" y1="${inner.y.toFixed(
      2,
    )}" x2="${outer.x.toFixed(2)}" y2="${outer.y.toFixed(
      2,
    )}" class="sigil-tick" />`;
  }).join("");
}

function buildRuneRingText(source: string | string[], minimumLength = 120) {
  const raw = Array.isArray(source) ? source.filter(Boolean).join(" | ") : source;
  const base = toRuneText(raw || "Legendary Sigil");
  let text = base;
  while (text.length < minimumLength) {
    text += " ᛫ " + base;
  }
  return text;
}

function buildSigilPointOrbits(segments: ReturnType<typeof getSigilSegments>) {
  const defs: string[] = [];
  const markup: string[] = [];

  segments.forEach((segment, index) => {
    const point = polarPoint(200, 200, 87, index * 40);
    const orbitRadius = 15.5;
    const orbitId = `sigil-point-orbit-${index}`;
    const orbitText = escapeHtml(
      buildRuneRingText(
        [shortenSigilPhrase(segment.value, 1, 12), segment.category],
        30,
      ),
    );

    defs.push(
      `<path id="${orbitId}" d="${buildCirclePath(
        point.x,
        point.y,
        orbitRadius,
        index % 2 === 1,
      )}" />`,
    );

    markup.push(`
      <g class="sigil-point-orbit">
        <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(
          2,
        )}" r="18.5" class="sigil-point-orbit-circle" />
        <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(
          2,
        )}" r="10.5" class="sigil-point-orbit-core" />
        <text class="sigil-point-ring-text">
          <textPath href="#${orbitId}" startOffset="0%">${orbitText}</textPath>
        </text>
      </g>
    `);
  });

  return {
    defs: defs.join(""),
    markup: markup.join(""),
  };
}

function buildSigilCoreOrbits(
  skillName: string,
  loreText: string,
  statusText: string,
  skillData: any,
  segments: ReturnType<typeof getSigilSegments>,
) {
  const outerText = escapeHtml(
    buildRuneRingText(
      [
        shortenSigilPhrase(skillName, 2, 20),
        humanizeSkillTerm(skillData?.target_type || segments[2].value),
        humanizeSkillTerm(skillData?.scaling_stat || segments[4].value),
      ],
      54,
    ),
  );
  const innerText = escapeHtml(
    buildRuneRingText(
      [
        statusText,
        shortenSigilPhrase(skillData?.mechanics || loreText, 3, 22),
      ],
      44,
    ),
  );
  const centerGlyph = escapeHtml(
    toRuneText(shortenSigilPhrase(skillName, 1, 8) || "Legend"),
  );

  return {
    defs: `
      <path id="sigil-core-orbit-outer" d="${buildCirclePath(
        200,
        200,
        34,
        true,
      )}" />
      <path id="sigil-core-orbit-inner" d="${buildCirclePath(200, 200, 22)}" />
    `,
    markup: `
      <g class="sigil-core-orbit">
        <circle cx="200" cy="200" r="38" class="sigil-core-orbit-circle" />
        <circle cx="200" cy="200" r="26" class="sigil-core-orbit-circle sigil-core-orbit-circle-inner" />
        <circle cx="200" cy="200" r="11.5" class="sigil-point-orbit-core" />
        <text class="sigil-core-ring-text sigil-core-ring-text-outer">
          <textPath href="#sigil-core-orbit-outer" startOffset="0%">${outerText}</textPath>
        </text>
        <text class="sigil-core-ring-text sigil-core-ring-text-inner">
          <textPath href="#sigil-core-orbit-inner" startOffset="0%">${innerText}</textPath>
        </text>
        <text x="200" y="204" class="sigil-core-glyph">${centerGlyph}</text>
      </g>
    `,
  };
}

function buildForgeSigilSvg(
  code: string,
  skillData?: any,
  phase: "rolling" | "interpreting" | "final" = "final",
) {
  const segments = getSigilSegments(code);
  const skillName =
    humanizeSkillTerm(skillData?.name) ||
    (phase === "interpreting" ? "Interpreting Sigil" : "Unwritten Legend");
  const loreText =
    humanizeSkillTerm(skillData?.mechanics) ||
    humanizeSkillTerm(skillData?.description) ||
    `${segments[1].value} ${segments[3].value} ${segments[2].value}`;
  const outerRingText = buildRuneRingText(
    [
      skillName,
      humanizeSkillTerm(skillData?.target_type || segments[2].value),
      humanizeSkillTerm(skillData?.scaling_stat || segments[4].value),
      humanizeSkillTerm(skillData?.mechanics || segments[8].value),
    ],
    170,
  );
  const innerRingText = buildRuneRingText(
    segments.map((segment) => `${segment.category} ${segment.value}`),
    210,
  );
  const loreRingText = buildRuneRingText(loreText, 150);
  const starPath = buildSigilStarPoints(200, 200, 104);
  const innerStarPath = buildSigilStarPoints(200, 200, 76, 2);
  const pointOrbits = buildSigilPointOrbits(segments);
  const tickMarks = buildSigilTicks(200, 200, 182, 191, 108);
  const statusText =
    phase === "rolling"
      ? "Sigil awakening"
      : phase === "interpreting"
        ? "Reading the runes"
        : shortenSigilPhrase(skillData?.name || "Legendary Sigil", 3, 20);
  const coreOrbits = buildSigilCoreOrbits(
    skillName,
    loreText,
    statusText,
    skillData,
    segments,
  );

  return `
    <svg class="forge-sigil-svg" viewBox="0 0 400 400" aria-label="Legendary magic circle">
      <defs>
        <linearGradient id="sigil-grad" x1="5%" y1="5%" x2="95%" y2="95%">
          <stop offset="0%" stop-color="#f2c38e" />
          <stop offset="55%" stop-color="#d4a65a" />
          <stop offset="100%" stop-color="#a06cff" />
        </linearGradient>
        <radialGradient id="sigil-core" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stop-color="rgba(255,233,190,0.22)" />
          <stop offset="70%" stop-color="rgba(160,108,255,0.12)" />
          <stop offset="100%" stop-color="rgba(0,0,0,0)" />
        </radialGradient>
        <path id="sigil-ring-outer" d="${buildCirclePath(200, 200, 168)}" />
        <path id="sigil-ring-mid" d="${buildCirclePath(200, 200, 141, true)}" />
        <path id="sigil-ring-inner" d="${buildCirclePath(200, 200, 118)}" />
        ${pointOrbits.defs}
        ${coreOrbits.defs}
      </defs>

      <circle cx="200" cy="200" r="188" class="sigil-outline sigil-outline-outer" />
      <circle cx="200" cy="200" r="176" class="sigil-outline sigil-outline-mid" />
      <circle cx="200" cy="200" r="152" class="sigil-outline sigil-outline-soft" />
      <circle cx="200" cy="200" r="129" class="sigil-outline sigil-outline-soft" />
      <circle cx="200" cy="200" r="97" class="sigil-outline sigil-outline-core" />
      <circle cx="200" cy="200" r="63" fill="url(#sigil-core)" />

      <g class="sigil-ticks">${tickMarks}</g>

      <text class="sigil-ring-text sigil-ring-text-outer">
        <textPath href="#sigil-ring-outer" startOffset="0%">${escapeHtml(
          outerRingText,
        )}</textPath>
      </text>
      <text class="sigil-ring-text sigil-ring-text-mid">
        <textPath href="#sigil-ring-mid" startOffset="0%">${escapeHtml(
          innerRingText,
        )}</textPath>
      </text>
      <text class="sigil-ring-text sigil-ring-text-inner">
        <textPath href="#sigil-ring-inner" startOffset="0%">${escapeHtml(
          loreRingText,
        )}</textPath>
      </text>

      <polygon points="${starPath}" class="sigil-star-fill" />
      <polygon points="${starPath}" class="sigil-star-line" />
      <polygon points="${innerStarPath}" class="sigil-inner-web" />
      <circle cx="200" cy="200" r="46" class="sigil-outline sigil-outline-core" />

      <g class="sigil-spoke-labels">${pointOrbits.markup}</g>
      ${coreOrbits.markup}
    </svg>
  `;
}

function renderForgeSigil(
  container: HTMLElement,
  code: string,
  skillData?: any,
  phase: "rolling" | "interpreting" | "final" = "final",
) {
  container.innerHTML = buildForgeSigilSvg(code, skillData, phase);
}

function applyForgeSigilRotation(container?: HTMLElement | null) {
  const host = container || forgeSigilHost;
  if (!host) return;
  host.style.setProperty("--sigil-rotation", `${forgeSigilRotation}deg`);
}

function setForgeSkillBoxVisible(visible: boolean) {
  const box = document.getElementById("forge-skill-box");
  if (!box) return;
  if (visible) {
    box.style.display = "block";
    requestAnimationFrame(() => box.classList.add("is-visible"));
    return;
  }
  box.classList.remove("is-visible");
  box.style.display = "none";
}

function setForgeScreenPhase(
  screen: HTMLElement | null,
  phase: "idle" | "rolling" | "interpreting" | "settling" | "resolved",
) {
  if (!screen) return;
  screen.classList.remove(
    "forging",
    "forge-interpreting",
    "forge-settling",
    "forge-resolved",
  );

  if (phase === "rolling") screen.classList.add("forging");
  if (phase === "interpreting") screen.classList.add("forge-interpreting");
  if (phase === "settling") screen.classList.add("forge-settling");
  if (phase === "resolved") screen.classList.add("forge-resolved");
}

function stopForgeSigilMotion() {
  if (forgeSigilSpinFrame !== null) {
    cancelAnimationFrame(forgeSigilSpinFrame);
    forgeSigilSpinFrame = null;
  }
  if (forgeSigilSettleFrame !== null) {
    cancelAnimationFrame(forgeSigilSettleFrame);
    forgeSigilSettleFrame = null;
  }
  forgeSigilVelocity = 0;
  forgeSigilTargetVelocity = 0;
  forgeSigilLastTimestamp = 0;
}

function tickForgeSigilMotion(timestamp: number) {
  if (!forgeSigilHost || !forgeSigilHost.isConnected) {
    stopForgeSigilMotion();
    return;
  }

  if (!forgeSigilLastTimestamp) {
    forgeSigilLastTimestamp = timestamp;
  }

  const deltaSeconds = Math.max(0, (timestamp - forgeSigilLastTimestamp) / 1000);
  forgeSigilLastTimestamp = timestamp;

  const easing = Math.min(1, deltaSeconds * 3.5);
  forgeSigilVelocity += (forgeSigilTargetVelocity - forgeSigilVelocity) * easing;
  forgeSigilRotation += forgeSigilVelocity * deltaSeconds;
  applyForgeSigilRotation();

  if (
    Math.abs(forgeSigilVelocity) > 0.05 ||
    Math.abs(forgeSigilTargetVelocity - forgeSigilVelocity) > 0.05
  ) {
    forgeSigilSpinFrame = requestAnimationFrame(tickForgeSigilMotion);
  } else {
    forgeSigilSpinFrame = null;
  }
}

function startForgeSigilMotion(container: HTMLElement, velocity = 64) {
  forgeSigilHost = container;
  forgeSigilTargetVelocity = velocity;
  applyForgeSigilRotation(container);

  if (forgeSigilSpinFrame === null) {
    forgeSigilLastTimestamp = 0;
    forgeSigilSpinFrame = requestAnimationFrame(tickForgeSigilMotion);
  }
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function settleForgeSigil(container: HTMLElement, duration = 820) {
  stopForgeSigilMotion();
  forgeSigilHost = container;

  const startRotation = forgeSigilRotation;
  const normalized = ((startRotation % 360) + 360) % 360;
  const snapStep = 40;
  let targetRotation = startRotation - normalized + Math.round(normalized / snapStep) * snapStep;
  if (targetRotation <= startRotation + 80) {
    targetRotation += 360;
  }

  return new Promise<void>((resolve) => {
    let startTime = 0;

    const frame = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min(1, (timestamp - startTime) / duration);
      const eased = easeOutCubic(progress);
      forgeSigilRotation =
        startRotation + (targetRotation - startRotation) * eased;
      applyForgeSigilRotation(container);

      if (progress < 1) {
        forgeSigilSettleFrame = requestAnimationFrame(frame);
      } else {
        forgeSigilSettleFrame = null;
        resolve();
      }
    };

    forgeSigilSettleFrame = requestAnimationFrame(frame);
  });
}

function setHubSummaryValue(id: string, value: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateHubAccessMode() {
  if (!G.user) return;
  const value = G.user.isGuest
    ? "Guest"
    : G.user.isInvite
      ? "Invite Code"
      : "Account";
  setHubSummaryValue("hub-access-mode", value);
}

function syncPageChrome() {
  const activePage =
    APP_PAGE === "menu" || APP_PAGE === "hub" ? "hub" : APP_PAGE;
  document.querySelectorAll<HTMLElement>("[data-nav-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.navPage === activePage);
  });
  updateHubAccessMode();
}

function normalizeRegions(regions: any[] | null | undefined) {
  return (regions || []).map((region: any, index: number) => ({
    ...region,
    id: region?.id || `region-${index}`,
    dangerLevel: region?.dangerLevel ?? region?.danger_level ?? 1,
    enemyTypes: Array.isArray(region?.enemyTypes)
      ? region.enemyTypes
      : Array.isArray(region?.enemyPool)
        ? region.enemyPool
        : [],
    icon: region?.icon || "🗺️",
    landmark: region?.landmark || "Waystation",
    accentColor: region?.accentColor || region?.accent_color || "var(--accent)",
    tier: Number.isFinite(region?.tier) ? Number(region.tier) : 0,
    mapPosition:
      typeof region?.mapPosition?.x === "number" &&
      typeof region?.mapPosition?.y === "number"
        ? {
            x: Number(region.mapPosition.x),
            y: Number(region.mapPosition.y),
          }
        : null,
    connections: Array.isArray(region?.connections)
      ? region.connections
      : [],
    isStart: !!region?.isStart,
    isGoal: !!region?.isGoal,
  }));
}

function normalizeWorldDefinition(definition: any, fallbackRegions?: any[]) {
  if (!definition && !fallbackRegions) return null;
  const normalizedRegions = normalizeRegions(
    definition?.regions || fallbackRegions || [],
  );
  const fallbackLayout =
    normalizedRegions.length > 0 ? buildFallbackMapLayout(normalizedRegions) : null;

  return {
    ...(definition || {}),
    regions: normalizedRegions,
    mapLayout:
      definition?.mapLayout && Array.isArray(definition.mapLayout.nodes)
        ? {
            ...definition.mapLayout,
            paths: Array.isArray(definition.mapLayout.paths)
              ? definition.mapLayout.paths.map((path: any) => ({
                  ...path,
                  difficulty: Number.isFinite(path?.difficulty)
                    ? Number(path.difficulty)
                    : 1,
                  visibility:
                    path?.visibility === "hidden" || path?.visibility === "fogged"
                      ? path.visibility
                      : "visible",
                  requirements: Array.isArray(path?.requirements)
                    ? path.requirements.filter((entry: any) => typeof entry === "string")
                    : [],
                }))
              : [],
          }
        : fallbackLayout,
  };
}

function getBiomeLabel(biomeId: string) {
  return (
    G.allContent.biomes.find((biome: any) => biome.id === biomeId)?.name ||
    biomeId
  );
}

function formatWorldList(type: "biomes" | "monsters", values: string[] = []) {
  if (!values.length) return "Default";
  return type === "biomes"
    ? values.map((value) => getBiomeLabel(value)).join(", ")
    : values.join(", ");
}

function worldPresetLabel(preset: string) {
  if (preset === "balanced") return "Balanced Realm";
  if (preset === "inferno") return "Inferno World";
  if (preset === "cursed") return "Cursed Lands";
  if (preset === "ancient") return "Ancient Ruins";
  if (preset === "custom") return "Custom World";
  return preset || "Unknown World";
}

function sortCreatedWorlds(worlds: any[] = []) {
  return [...worlds].sort((a, b) => {
    const aTime = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJsSingleQuoted(value: unknown) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function truncateText(value: unknown, max = 84) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function summarizeEnemyList(values: unknown[] = [], max = 2) {
  const names = values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  if (!names.length) return "Unknown threats";
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} +${names.length - max}`;
}

function buildFallbackMapLayout(regions: any[]) {
  if (!regions.length) return null;
  const width = 1040;
  const height = 560;
  const columns =
    regions.length <= 1 ? 1 : regions.length >= 10 ? 5 : regions.length >= 7 ? 4 : 3;
  const nodes = regions.map((region: any, index: number) => {
    const col =
      columns === 1
        ? 0
        : Math.round((index / Math.max(1, regions.length - 1)) * (columns - 1));
    const tierMembers = regions.filter((candidate: any, candidateIndex: number) => {
      const candidateCol =
        columns === 1
          ? 0
          : Math.round(
              (candidateIndex / Math.max(1, regions.length - 1)) * (columns - 1),
            );
      return candidateCol === col;
    });
    const row = tierMembers.findIndex((entry: any) => entry.id === region.id);
    const x =
      columns === 1 ? width / 2 : 120 + col * ((width - 240) / (columns - 1));
    const y =
      tierMembers.length === 1
        ? height / 2
        : 90 + row * ((height - 180) / Math.max(1, tierMembers.length - 1));
    return {
      regionId: region.id,
      x,
      y,
      tier: col,
      icon: region.icon || "🗺️",
      landmark: region.landmark || "Waystation",
      accentColor: region.accentColor || "var(--accent)",
      isStart: index === 0,
      isGoal: index === regions.length - 1,
    };
  });
  const paths = nodes.slice(0, -1).map((node: any, index: number) => ({
    id: `${node.regionId}::${nodes[index + 1].regionId}`,
    fromRegionId: node.regionId,
    toRegionId: nodes[index + 1].regionId,
    kind: "road",
    difficulty: 1,
    visibility: "visible",
    requirements: [],
  }));

  return {
    width,
    height,
    startRegionId: nodes[0].regionId,
    goalRegionId: nodes[nodes.length - 1].regionId,
    nodes,
    paths,
  };
}

function getActiveMapLayout() {
  return (
    G.worldDefinition?.mapLayout ||
    buildFallbackMapLayout(normalizeRegions(G.regions))
  );
}

function getActiveWorldDefinition() {
  if (
    G.worldDefinition?.mapLayout &&
    Array.isArray(G.worldDefinition.mapLayout.nodes)
  ) {
    return G.worldDefinition;
  }
  if (!Array.isArray(G.regions) || G.regions.length === 0) return null;
  return normalizeWorldDefinition(null, G.regions);
}

function getTraversalState() {
  const definition = getActiveWorldDefinition();
  const baseState = {
    currentRegionId: G.gs?.currentRegionId || G.gs?.regionId || null,
    discoveredRegionIds: Array.isArray(G.gs?.discoveredRegionIds)
      ? G.gs.discoveredRegionIds
      : [],
    visitedRegionIds: Array.isArray(G.gs?.visitedRegionIds)
      ? G.gs.visitedRegionIds
      : [],
    clearedRegionIds: Array.isArray(G.gs?.clearedRegionIds)
      ? G.gs.clearedRegionIds
      : [],
    lockedRegionIds: Array.isArray(G.gs?.lockedRegionIds)
      ? G.gs.lockedRegionIds
      : [],
    revealedPathIds: Array.isArray(G.gs?.revealedPathIds)
      ? G.gs.revealedPathIds
      : [],
    traversedPathIds: Array.isArray(G.gs?.traversedPathIds)
      ? G.gs.traversedPathIds
      : [],
  };
  return definition
    ? hydrateTraversalRuntimeState(definition, baseState, baseState.currentRegionId)
    : baseState;
}

function getCurrentRegionId() {
  return getTraversalState().currentRegionId;
}

function getCurrentRegion() {
  const currentRegionId = getCurrentRegionId();
  return G.regions.find((region: any) => region.id === currentRegionId) || null;
}

function getReachableRegionIdsForUI() {
  const definition = getActiveWorldDefinition();
  if (!definition || !G.gs) return [];
  return getReachableRegionIds(definition, getTraversalState(), G.gs.level || 1);
}

function getSelectedPathContext() {
  const definition = getActiveWorldDefinition();
  const selectedRegion = G.selectedRegion;
  const currentRegionId = getCurrentRegionId();
  if (!definition || !selectedRegion || !currentRegionId) return null;
  if (selectedRegion.id === currentRegionId) return null;
  const path = getPathBetweenRegions(definition, currentRegionId, selectedRegion.id);
  if (!path) return null;
  return {
    path,
    evaluation: evaluatePathTraversal(
      definition,
      getTraversalState(),
      path,
      G.gs?.level || 1,
    ),
  };
}

function pathKindLabel(kind: string) {
  if (kind === "hazard") return "Hazard Route";
  if (kind === "secret") return "Secret Route";
  return "Road";
}

function syncSelectedRegionFromSession(preferCurrent = false) {
  const regions = normalizeRegions(G.regions);
  G.regions = regions;
  if (!regions.length) {
    G.selectedRegion = null;
    G.selectedRegionIndex = 0;
    return;
  }

  const currentRegionId = getCurrentRegionId();
  const currentIndex =
    currentRegionId && G.worldDefinition
      ? getRegionIndexById(G.worldDefinition, currentRegionId)
      : regions.findIndex((region: any) => region.id === currentRegionId);
  const selectedIndex = regions.findIndex(
    (region: any) => region.id === G.selectedRegion?.id,
  );

  let nextIndex = selectedIndex;
  if (preferCurrent || nextIndex < 0) {
    nextIndex = currentIndex >= 0 ? currentIndex : 0;
  }

  G.selectedRegionIndex = Math.max(0, nextIndex);
  G.selectedRegion = regions[G.selectedRegionIndex] || null;
}

function navigateToPage(page: string, params?: Record<string, string>) {
  const url = new URL(pageHref(page), window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  ) {
    return;
  }
  window.location.href = url.toString();
}

function showMapPage() {
  if (APP_PAGE !== "map") {
    navigateToPage("map");
    return;
  }
  initializeMapPage(true);
}

function showHubPage() {
  if (APP_PAGE !== "hub") {
    navigateToPage("hub");
    return;
  }
  showScreen("menu");
}

function showAdventurePage() {
  if (APP_PAGE !== "adventure") {
    navigateToPage("adventure");
    return;
  }
  showScreen("world");
}

function renderAdventureLandingState() {
  G.activeCombat = null;
  G.regions = normalizeRegions([]);
  G.selectedRegion = null;
  G.selectedRegionIndex = 0;
  toggleMapCombatStage(false);
  clearAdventureLog();
  setMapEventState(
    "⚔ Adventure Chamber",
    "Resume a saved journey from the hub, or start a new adventure to choose a world and legend.",
  );
  renderRegions();
}

function enterCurrentPage() {
  if (APP_PAGE === "hub") {
    showScreen("menu");
    return;
  }
  if (APP_PAGE === "vault") {
    showScreen("vault");
    renderFullVault();
    return;
  }
  if (APP_PAGE === "forge") {
    forgeReturnState =
      (new URLSearchParams(window.location.search).get("returnTo") as
        | "menu"
        | "vault"
        | "wizard"
        | null) || "menu";
    showScreen("forge");
    return;
  }
  if (APP_PAGE === "adventure") {
    const pendingLoad = sessionStorage.getItem(PENDING_LOAD_KEY);
    if (pendingLoad) {
      showScreen("world");
      try {
        const { characterId, characterName } = JSON.parse(pendingLoad);
        if (characterId) {
          loadGame(characterId, characterName);
        }
      } catch {
        /* ignore malformed session cache */
      } finally {
        sessionStorage.removeItem(PENDING_LOAD_KEY);
      }
      return;
    }
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (requestedView === "wizard" || G.selectedLegend) {
      showScreen("wizard");
      wizardGoStep(1);
      return;
    }
    showScreen("world");
    renderAdventureLandingState();
    return;
  }
  if (APP_PAGE === "map") {
    showScreen("world");
    initializeMapPage();
    return;
  }
  showScreen("menu");
}

async function enterInviteMode() {
  clearAuthError();
  const inviteEl = document.getElementById("auth-invite-code") as HTMLInputElement;
  const code = inviteEl?.value.trim();
  if (!code) return showAuthError("กรุณากรอกรหัสรับเชิญ");

  const btn = document.getElementById("btn-invite-auth") as HTMLButtonElement;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Checking code...";
  }

  try {
    const res = await fetch(API + "/invite/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: code }),
    });
    const j = await res.json();
    if (!j.success) {
      throw new Error(j.error || "Invite code is invalid");
    }

    localStorage.setItem(INVITE_STORAGE_KEY, code);
    localStorage.removeItem(GUEST_STORAGE_KEY);
    G.user = {
      ...j.data.profile,
      inviteCode: code,
    };
    onLoginSuccess();
  } catch (e: any) {
    showAuthError(e.message || "Invite code is invalid");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Enter with Invite Code";
    }
  }
}

async function handleAuth(event?: Event) {
  if (event) event.preventDefault();
  clearAuthError();
  localStorage.removeItem(GUEST_STORAGE_KEY);
  localStorage.removeItem(INVITE_STORAGE_KEY);
  const emailEl = document.getElementById("auth-email") as HTMLInputElement;
  const passwordEl = document.getElementById(
    "auth-password",
  ) as HTMLInputElement;
  const btnEl = document.getElementById("btn-auth") as HTMLButtonElement;
  const email = emailEl?.value.trim();
  const password = passwordEl?.value;
  if (!email || !password) return showAuthError("กรุณากรอก Email และ Password");

  btnEl.textContent = "⏳ กำลังเข้าสู่ระบบ...";
  btnEl.disabled = true;

  try {
    let res;
    if (authMode === "login") {
      res = await supabase.auth.signInWithPassword({ email, password });
    } else {
      res = await supabase.auth.signUp({ email, password });
    }

    if (res.error) {
      // Translate common Supabase errors to user-friendly messages
      const errMsg = res.error.message;
      let friendlyMsg = errMsg;
      if (errMsg.includes("Invalid login credentials"))
        friendlyMsg = "Email หรือ Password ไม่ถูกต้อง";
      else if (errMsg.includes("Email not confirmed"))
        friendlyMsg = "กรุณายืนยัน Email ของคุณก่อน (ตรวจสอบ inbox)";
      else if (errMsg.includes("User already registered"))
        friendlyMsg = "Email นี้มีบัญชีอยู่แล้ว กรุณา Login แทน";
      else if (errMsg.includes("Password should be"))
        friendlyMsg = "Password ต้องมีอย่างน้อย 6 ตัวอักษร";
      throw new Error(friendlyMsg);
    }

    if (authMode === "signup" && res.data.user && !res.data.session) {
      // Signup succeeded but needs email verification
      showAuthError(
        "สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบ Email เพื่อยืนยันบัญชีแล้วกลับมา Login ใหม่",
      );
      const errEl = document.getElementById("auth-error");
      if (errEl) errEl.style.color = "var(--green)";
      return;
    }

    if (res.data.user) {
      G.user = res.data.user;
      onLoginSuccess();
    }
  } catch (e: any) {
    showAuthError(e.message);
  } finally {
    btnEl.textContent =
      authMode === "login" ? "Enter Realm" : "Claim Your Glory";
    btnEl.disabled = false;
  }
}

function onLoginSuccess() {
  const authScreen = document.getElementById("screen-auth");
  const gameContainer = document.getElementById("game-container");
  const userDisplay = document.getElementById("user-display");

  if (authScreen) authScreen.style.display = "none";
  if (gameContainer) gameContainer.style.display = "block";
  if (userDisplay && G.user)
    userDisplay.textContent = G.user.isGuest
      ? "Playing as Guest"
      : G.user.isInvite
        ? `Invite Access: ${G.user.label || "Streamer"}`
        : `Logged in as: ${G.user.email}`;
  syncPageChrome();
  loadWorldContent(); // Load DB content for the world creation screen
  fetchSaveList(); // Fetch existing saves so user can see their data
  fetchCreatedWorlds(); // Fetch saved worlds for world archive / custom reuse
  renderThemeBiomes("balanced"); // Initial biome preview
  renderThemeMonsters("balanced"); // Initial monster preview
  if (APP_PAGE === "menu") {
    navigateToPage("hub");
    return;
  }
  enterCurrentPage();
}

async function logout() {
  localStorage.removeItem(GUEST_STORAGE_KEY);
  localStorage.removeItem(INVITE_STORAGE_KEY);
  if (!G.user?.isGuest) {
    await supabase.auth.signOut();
  }
  window.location.href = pageHref("menu");
}

// Initialize state check
window.addEventListener("load", async () => {
  const storedLegend = sessionStorage.getItem("rpg_selected_legend");
  if (storedLegend) {
    try {
      G.selectedLegend = JSON.parse(storedLegend);
    } catch {
      /* ignore malformed session cache */
    } finally {
      sessionStorage.removeItem("rpg_selected_legend");
    }
  }
  const savedInviteCode = localStorage.getItem(INVITE_STORAGE_KEY);
  if (savedInviteCode) {
    try {
      const res = await fetch(API + "/invite/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: savedInviteCode }),
      });
      const j = await res.json();
      if (j.success) {
        G.user = { ...j.data.profile, inviteCode: savedInviteCode };
        onLoginSuccess();
        return;
      }
      localStorage.removeItem(INVITE_STORAGE_KEY);
    } catch {
      localStorage.removeItem(INVITE_STORAGE_KEY);
    }
  }
  if (localStorage.getItem(GUEST_STORAGE_KEY) === "true") {
    G.user = { id: null, email: GUEST_EMAIL, isGuest: true };
    onLoginSuccess();
    return;
  }
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    G.user = data.session.user;
    onLoginSuccess();
  } else {
    // Not logged in: ensure auth screen is visible
    const authScreen = document.getElementById("screen-auth");
    const gameContainer = document.getElementById("game-container");
    if (authScreen) authScreen.style.display = "block";
    if (gameContainer) gameContainer.style.display = "none";
    syncPageChrome();
  }
});

// --- SCREEN ---
function showScreen(name: string) {
  if (name === "map" && APP_PAGE !== "map") {
    navigateToPage("map");
    return;
  }
  if (name === "menu" && APP_PAGE !== "menu" && APP_PAGE !== "hub") {
    navigateToPage("hub");
    return;
  }
  if (name === "vault" && APP_PAGE !== "vault") {
    navigateToPage("vault");
    return;
  }
  if (name === "forge" && APP_PAGE !== "forge") {
    navigateToPage("forge");
    return;
  }
  if (
    [
      "wizard",
      "world",
      "explore",
      "combat",
      "character",
      "inventory",
    ].includes(name) &&
    !IS_GAMEPLAY_PAGE
  ) {
    navigateToPage("adventure");
    return;
  }
  // Ensure game-container is always visible when navigating app screens
  const gameContainer = document.getElementById("game-container");
  if (gameContainer) gameContainer.style.display = "block";

  const menuEl = document.getElementById("screen-menu");
  const wizardEl = document.getElementById("screen-wizard");
  const vaultEl = document.getElementById("screen-vault");
  const forgeEl = document.getElementById("screen-forge");
  const gameUi = document.getElementById("game-ui-screen");

  // Hide all major screens
  if (menuEl) menuEl.style.display = "none";
  if (wizardEl) wizardEl.style.display = "none";
  if (vaultEl) vaultEl.style.display = "none";
  if (forgeEl) forgeEl.style.display = "none";
  if (gameUi) gameUi.classList.remove("active");

  if (name === "menu") {
    if (menuEl) menuEl.style.display = "block";
  } else if (name === "wizard") {
    if (wizardEl) wizardEl.style.display = "block";
  } else if (name === "vault") {
    if (vaultEl) vaultEl.style.display = "block";
  } else if (name === "forge") {
    if (forgeEl) forgeEl.style.display = "block";
  } else {
    // For all gameplay screens (world, explore, combat, etc.), show the 4-panel game UI
    if (gameUi) gameUi.classList.add("active");

    // Map screen names to center tabs
    if (["world", "explore", "combat"].includes(name)) gpTab("map");

    // Refresh stats
    if (name === "character") renderCharacter();
    if (name === "inventory") renderInventory();
  }
}

// Switch center-top tabs: map | explore | combat
function gpTab(tab: string) {
  const activeTab = "map";
  ["map", "explore", "combat"].forEach((t) => {
    document
      .getElementById("sub-" + t)
      ?.classList.toggle("active", t === activeTab);
    document
      .getElementById("tab-" + t)
      ?.classList.toggle("active", t === activeTab);
  });
}

function clearAdventureLog() {
  const visibleLog = document.getElementById("gp-log");
  if (visibleLog) {
    visibleLog.innerHTML = `
      <div style="color: var(--muted); font-style: italic">
        Choose a region and explore to begin your adventure...
      </div>
    `;
    visibleLog.setAttribute("data-pristine", "true");
  }
  const eventLog = document.getElementById("event-log");
  if (eventLog) eventLog.innerHTML = "";
  const combatLog = document.getElementById("combat-log");
  if (combatLog) combatLog.innerHTML = "";
}

function appendSharedLog(html: string, targetIds: string[]) {
  Array.from(new Set(targetIds)).forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === "gp-log" && el.getAttribute("data-pristine") !== "false") {
      el.innerHTML = "";
      el.setAttribute("data-pristine", "false");
    }
    el.insertAdjacentHTML("beforeend", html);
    el.scrollTop = el.scrollHeight;
  });
}

function setMapEventState(title: string, description: string) {
  const titleEl = document.getElementById("explore-title");
  const copyEl = document.getElementById("map-event-copy");
  if (titleEl) titleEl.textContent = title;
  if (copyEl) copyEl.textContent = description;
}

function toggleMapCombatStage(visible: boolean) {
  const stage = document.getElementById("map-combat-stage");
  if (stage) stage.style.display = visible ? "block" : "none";
}

function syncMapSelectionState() {
  const headingEl = document.getElementById("map-region-heading");
  const copyEl = document.getElementById("map-region-copy");
  const chipEl = document.getElementById("map-region-chip");
  const exploreBtn = document.getElementById(
    "btn-map-explore",
  ) as HTMLButtonElement | null;
  const currentRegion = getCurrentRegion();
  const currentRegionId = currentRegion?.id || getCurrentRegionId();
  const selectedPathContext = getSelectedPathContext();
  const isSelectedCurrent =
    !!G.selectedRegion && !!currentRegionId && G.selectedRegion.id === currentRegionId;
  const isSelectedReachable = !!selectedPathContext?.evaluation?.traversable;

  if (!G.selectedRegion) {
    if (headingEl)
      headingEl.textContent = currentRegion
        ? `${currentRegion.name} is your current position`
        : "Choose your next route";
    if (copyEl)
      copyEl.textContent =
        "Move along connected routes from your current node. Selecting a reachable region will travel there and immediately trigger the next exploration event.";
    if (chipEl) {
      chipEl.textContent = currentRegion
        ? `Current Node • ${currentRegion.name}`
        : "No region selected";
    }
    if (exploreBtn) {
      exploreBtn.disabled = true;
      exploreBtn.textContent = "🧭 Select a Reachable Region";
    }
    return;
  }

  const enemyList =
    Array.isArray(G.selectedRegion.enemyTypes) &&
    G.selectedRegion.enemyTypes.length > 0
      ? G.selectedRegion.enemyTypes.join(", ")
      : "Unknown threats";
  const landmark = G.selectedRegion.landmark || "Waystation";
  const exitCount = Array.isArray(G.selectedRegion.connections)
    ? G.selectedRegion.connections.length
    : 0;
  if (headingEl) headingEl.textContent = G.selectedRegion.name;
  if (copyEl) {
    const routeSummary = selectedPathContext
      ? `${pathKindLabel(selectedPathContext.path.kind)} • Difficulty ${selectedPathContext.path.difficulty} • ${selectedPathContext.path.visibility === "fogged" ? "Fogged" : selectedPathContext.path.visibility === "hidden" ? "Hidden" : "Visible"}`
      : "Current node";
    const requirementSummary =
      selectedPathContext?.path.requirements?.length
        ? `Requirements: ${selectedPathContext.path.requirements
            .map((entry: string) => formatTraversalRequirement(entry))
            .join(" • ")}.`
        : "";
    const routeState = isSelectedCurrent
      ? "You are already here. Explore this node to trigger the next event."
      : isSelectedReachable
        ? "This route is reachable from your current node. Traveling there will trigger a travel step before the regional event resolves."
        : selectedPathContext
          ? formatTraversalBlockedReason(
              selectedPathContext.evaluation.blockedReason,
            )
          : "This node is not directly connected to your current position.";
    copyEl.textContent = `${landmark}. Danger ${G.selectedRegion.dangerLevel}. Known threats: ${enemyList}. Connected routes: ${exitCount}. ${routeSummary}. ${requirementSummary} ${routeState}`.trim();
  }
  if (chipEl) {
    chipEl.textContent = isSelectedCurrent
      ? `Current Node • ${G.selectedRegion.name} • Danger ${G.selectedRegion.dangerLevel}`
      : selectedPathContext
        ? `${G.selectedRegion.name} • ${pathKindLabel(selectedPathContext.path.kind)} • Danger ${G.selectedRegion.dangerLevel}`
        : `${G.selectedRegion.name} • Danger ${G.selectedRegion.dangerLevel} • ${landmark}`;
  }
  if (exploreBtn) {
    exploreBtn.disabled =
      !!G.activeCombat || (!isSelectedCurrent && !isSelectedReachable);
    exploreBtn.textContent = G.activeCombat
      ? "⚔️ Resolve Current Encounter"
      : isSelectedCurrent
        ? "🧭 Explore Current Region"
        : isSelectedReachable
          ? selectedPathContext?.path.kind === "hazard"
            ? "🧭 Brave the Hazard Route"
            : selectedPathContext?.path.kind === "secret"
              ? "🧭 Take the Secret Route"
              : "🧭 Travel and Explore"
          : selectedPathContext
            ? "🚫 Route Blocked"
            : "🚫 No Direct Route";
  }
}

function renderNav() {
  const html = `
        <button class="btn btn-action" id="nav-btn-world">🗺️ Map</button>
        <button class="btn btn-action" id="nav-btn-char">👤 Stats</button>
        <button class="btn btn-action" id="nav-btn-inv">🎒 Inventory</button>
        <button class="btn btn-action" id="nav-btn-explore">🧭 Explore</button>
        <button class="btn btn-gold" id="nav-btn-save">💾 Save</button>
    `;
  ["game-nav", "nav-char", "nav-explore", "nav-inv"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = html;
      // Re-attach listeners because we re-rendered HTML
      document
        .getElementById("nav-btn-world")
        ?.addEventListener("click", () => showScreen("world"));
      document
        .getElementById("nav-btn-char")
        ?.addEventListener("click", () => showScreen("character"));
      document
        .getElementById("nav-btn-inv")
        ?.addEventListener("click", () => showScreen("inventory"));
      document
        .getElementById("nav-btn-explore")
        ?.addEventListener("click", () => showScreen("explore"));
      document
        .getElementById("nav-btn-save")
        ?.addEventListener("click", saveGame);
    }
  });
}

function updateAllStatusBars() {
  const s = G.gs;
  if (!s) return;
  const currentRegion = getCurrentRegion() || G.selectedRegion;
  const html = `
        <div class="stat">🗺️ Seed<span class="val-accent">${G.worldSeed}</span></div>
        <div class="stat">⭐ Lv.<span class="val-accent">${s.level}</span></div>
        <div class="stat">❤️ HP<span class="val-green">${s.hp}/${s.maxHP}</span></div>
        <div class="stat">🔷 MP<span class="val-accent">${s.mana}/${s.maxMana}</span></div>
        <div class="stat">💰<span class="val-gold">${s.gold}</span></div>
        <div class="stat">✨ EXP<span class="val-accent">${s.exp}/${s.level * 100}</span></div>
        ${currentRegion ? `<div class="stat">📍<span class="val-accent">${currentRegion.name}</span></div>` : ""}
    `;
  [
    "status-bar",
    "status-bar-char",
    "status-bar-explore",
    "status-bar-inv",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
  // Update new HUD elements
  updateHUD();
  renderCharacter();
}

function showToast(msg: string, type = "success") {
  const t = document.getElementById("toast");
  if (t) {
    t.textContent = msg;
    t.className = "toast " + type + " show";
    setTimeout(() => t.classList.remove("show"), 2200);
  }
}

// --- WORLD CREATION FUNCTIONS ---

// Expose functions so inline onclick= HTML attributes work with Vite modules
(window as any).selectPreset = selectPreset;
(window as any).rollRandomSeed = rollRandomSeed;
(window as any).fetchSaveList = fetchSaveList;
(window as any).loadGame = loadGame;
(window as any).saveGame = saveGame;
(window as any).logout = logout;
(window as any).toggleAuthMode = toggleAuthMode;
(window as any).handleAuth = handleAuth;
(window as any).enterGuestMode = enterGuestMode;
(window as any).enterInviteMode = enterInviteMode;
(window as any).deleteLegend = deleteLegend;
(window as any).exploreRegion = exploreRegion;
(window as any).showScreen = showScreen;
(window as any).startWizard = startWizard;
(window as any).gpTab = gpTab;
(window as any).wizardGoStep = wizardGoStep;
(window as any).rollSkill = rollSkill;
(window as any).submitNewGame = submitNewGame;
(window as any).showVault = showVault;
(window as any).showForge = showForge;
(window as any).showHubPage = showHubPage;
(window as any).showAdventurePage = showAdventurePage;
(window as any).showMapPage = showMapPage;
(window as any).fetchCreatedWorlds = fetchCreatedWorlds;
(window as any).rollForgeSkill = rollForgeSkill;
(window as any).confirmForge = confirmForge;
(window as any).backFromForge = backFromForge;
(window as any).startWizardWithLegend = startWizardWithLegend;
(window as any).selectLegend = selectLegend;
(window as any).applyWorldRecord = applyWorldRecord;
(window as any).deleteWorldRecord = deleteWorldRecord;
(window as any).openWorldInAdventure = openWorldInAdventure;
(window as any).resumeLatestJourney = resumeLatestJourney;
(window as any).clearAdventureLog = clearAdventureLog;
(window as any).toggleCustomTag = toggleCustomTag;
(window as any).forgeGoStep = forgeGoStep;

// Wizard state
let wizardState = {
  worldName: "The Balanced Realm",
  charSuggestion: "Hero",
  seed: 500000000 as number | null,
  skillCode: "",
  skillData: null as any,
};

function selectPreset(
  el: HTMLElement,
  worldName: string,
  charName: string,
  seed: number | null,
) {
  document
    .querySelectorAll(".preset-card")
    .forEach((c) => c.classList.remove("selected"));
  el.classList.add("selected");
  wizardState.worldName = worldName;
  wizardState.charSuggestion = charName;
  wizardState.seed = seed;

  // Show or hide seed row
  const seedRow = document.getElementById("seed-row");
  if (seedRow)
    seedRow.style.display = el.dataset.preset === "custom" ? "flex" : "none";

  const svEl = document.getElementById("input-seed") as HTMLInputElement;
  if (seed !== null) {
    svEl.value = String(seed);
  } else {
    svEl.value = "";
  }

  // Update Biome & Monster Previews based on Selection
  renderThemeBiomes(el.dataset.preset || "balanced");
  renderThemeMonsters(el.dataset.preset || "balanced");
}

function toggleCustomTag(type: "biomes" | "monsters", name: string) {
  const list = G.customSelection[type];
  const index = list.indexOf(name);
  if (index > -1) {
    list.splice(index, 1);
  } else {
    list.push(name);
  }
  const preset = document.querySelector(".preset-card.selected") as HTMLElement;
  if (preset?.dataset.preset === "custom") {
    renderThemeBiomes("custom");
    renderThemeMonsters("custom");
  }
}

function renderThemeMonsters(preset: string) {
  const monEl = document.getElementById("monster-list");
  if (!monEl) return;
  const headerEl = monEl.parentElement?.querySelector("h3");

  if (preset === "custom") {
    if (headerEl) headerEl.textContent = "👾 Select Monsters for Your World";
    if (G.allContent.monsters.length === 0) {
      monEl.innerHTML =
        '<div style="color:var(--muted); font-size:11px">Loading global database...</div>';
      return;
    }
    monEl.innerHTML = G.allContent.monsters
      .map((m: any) => {
        const isSelected = G.customSelection.monsters.includes(m.name);
        return `
                <div class="monster-badge selectable ${isSelected ? "selected" : ""}" onclick="toggleCustomTag('monsters', '${m.name}')">
                    <span class="m-name">${m.name}</span>
                    <span class="m-lv">Lv.${m.level}</span>
                    <span class="m-type">${m.biome || m.type || "Unknown"}</span>
                </div>
            `;
      })
      .join("");
    return;
  }

  if (headerEl) headerEl.textContent = "👾 Monsters in this World";

  let filterBiomes: string[] = [];
  if (preset === "balanced")
    filterBiomes = ["forest", "coast", "mountain", "desert", "Mixed"];
  else if (preset === "inferno") filterBiomes = ["volcanic", "Volcanic"];
  else if (preset === "cursed") filterBiomes = ["cursed_land", "swamp", "Dark"];
  else if (preset === "ancient") filterBiomes = ["ruins", "Lore"];

  let monsters = G.allContent.monsters.filter(
    (m: any) =>
      filterBiomes.includes(m.biome) ||
      filterBiomes.includes(m.type) ||
      !m.biome,
  );

  if (!monsters || monsters.length === 0) {
    monEl.innerHTML =
      '<div style="color:var(--muted); font-size:11px">Fetching global database...</div>';
    return;
  }

  monsters = monsters.sort(() => Math.random() - 0.5).slice(0, 3);

  monEl.innerHTML = monsters
    .map(
      (m: any) => `
        <div class="monster-badge fade-in" style="border: 1px solid rgba(255,255,255,0.05); background: var(--surface2)">
            <span class="m-name" style="font-weight:600">${m.name}</span>
            <span class="m-lv" style="color:var(--accent); margin-left:5px">Lv.${m.level || m.lv || 1}</span>
            <span class="m-type" style="font-size:9px; color:var(--muted); margin-left:8px; background:rgba(0,0,0,0.2); padding:1px 4px; border-radius:3px">${m.biome || m.type || "Unknown"}</span>
        </div>
    `,
    )
    .join("");
}

function renderThemeBiomes(preset: string) {
  const biomeEl = document.getElementById("biome-list");
  if (!biomeEl) return;
  const headerEl = biomeEl.parentElement?.querySelector("h3");

  if (preset === "custom") {
    if (headerEl) headerEl.textContent = "🌍 Select World Biomes (Tags)";
    if (G.allContent.biomes.length === 0) {
      biomeEl.innerHTML =
        '<div style="color:var(--muted); font-size:11px">Loading global database...</div>';
      return;
    }
    biomeEl.innerHTML = G.allContent.biomes
      .map((b: any) => {
        const isSelected = G.customSelection.biomes.includes(b.id);
        return `
                <div class="biome-card selectable ${isSelected ? "selected" : ""}" onclick="toggleCustomTag('biomes', '${b.id}')">
                    <div class="b-name">${b.name}</div>
                    <div class="b-desc">${b.description}</div>
                </div>
            `;
      })
      .join("");
    const preview = document.getElementById("content-preview");
    if (preview) preview.style.display = "block";
    return;
  }

  if (headerEl) headerEl.textContent = "🌍 World Biomes";

  let filterBiomes: string[] = [];
  if (preset === "balanced")
    filterBiomes = ["forest", "coast", "mountain", "desert"];
  else if (preset === "inferno") filterBiomes = ["volcanic"];
  else if (preset === "cursed") filterBiomes = ["cursed_land", "swamp"];
  else if (preset === "ancient") filterBiomes = ["ruins"];

  let biomes = G.allContent.biomes.filter(
    (b: any) => filterBiomes.includes(b.id) || filterBiomes.includes(b.name),
  );

  if (!biomes || biomes.length === 0) {
    biomeEl.innerHTML =
      '<div style="color:var(--muted); font-size:11px">Fetching global database...</div>';
    return;
  }

  biomes = biomes.sort(() => Math.random() - 0.5).slice(0, 3);

  biomeEl.innerHTML = biomes
    .map(
      (b: any) => `
        <div class="biome-card fade-in" style="border-left: 3px solid var(--accent)">
            <div class="b-name" style="font-weight:700; color:var(--text)">${b.name}</div>
            <div class="b-desc" style="font-size:10px; color:var(--muted); margin-top:2px">${b.description}</div>
        </div>
    `,
    )
    .join("");

  const preview = document.getElementById("content-preview");
  if (preview) preview.style.display = "block";
}

function wizardGoStep(step: number) {
  if (step === 1) {
    fetchCreatedWorlds();
  }

  // Validate on forward to the final confirm step
  if (step === 4) {
    if (!G.selectedLegend) {
      alert("Please select a legend for this adventure.");
      return;
    }

    // Populate summary
    const summaryEl = document.getElementById("confirm-summary");
    if (summaryEl) {
      let worldName = wizardState.worldName || "Custom World";
      const selectedPreset = document.querySelector(
        ".preset-card.selected",
      ) as HTMLElement;
      const isCustom = selectedPreset?.dataset.preset === "custom";

      if (isCustom) {
        const customNameField = (
          document.getElementById("input-world-name") as HTMLInputElement
        )?.value.trim();
        if (customNameField) worldName = customNameField;
      }

      let tagSummary = "";
      if (isCustom) {
        const bTags =
          G.customSelection.biomes.length > 0
            ? formatWorldList("biomes", G.customSelection.biomes)
            : "Default";
        const mTags =
          G.customSelection.monsters.length > 0
            ? formatWorldList("monsters", G.customSelection.monsters)
            : "Default";
        tagSummary = `
                    <div style="margin-top:8px; padding-top:8px; border-top:1px solid var(--border); font-size:10px;">
                        <span style="color:var(--muted)">Biomes:</span> ${bTags}<br>
                        <span style="color:var(--muted)">Monsters:</span> ${mTags}
                    </div>
                `;
      }

      summaryEl.innerHTML = `
                <div style="text-align:left; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:15px; margin-bottom:10px">
                    <div style="font-size:10px; color:var(--muted); text-transform:uppercase; margin-bottom:4px">Selected World</div>
                    <div style="font-size:16px; font-weight:700">${worldName}</div>
                    <div style="font-size:11px; color:var(--muted)">Seed: ${wizardState.seed || "Random"}</div>
                    ${tagSummary}
                </div>
                <div style="text-align:left; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:15px;">
                    <div style="font-size:10px; color:var(--muted); text-transform:uppercase; margin-bottom:4px">Chosen Legend</div>
                    <div style="font-size:16px; font-weight:700">👤 ${G.selectedLegend.name}</div>
                    <div style="font-size:11px; color:var(--accent); font-weight:600; margin-top:4px">🌟 ${G.selectedLegend.skill_data?.name || "Innate Power"}</div>
                </div>
            `;
    }
  }

  if (step === 2) {
    fetchVaultSelections();
  }

  // Show/hide steps
  [1, 2, 3, 4].forEach((s) => {
    const stepEl = document.getElementById(`wizard-step-${s}`);
    const indEl = document.getElementById(`step-indicator-${s}`);
    if (stepEl) stepEl.style.display = s === step ? "block" : "none";
    if (indEl) {
      if (s === step) {
        indEl.style.background =
          "linear-gradient(135deg,var(--accent),var(--accent2))";
        indEl.style.color = "#fff";
      } else if (s < step) {
        indEl.style.background = "rgba(79,195,247,0.15)";
        indEl.style.color = "var(--accent)";
      } else {
        indEl.style.background = "var(--surface2)";
        indEl.style.color = "var(--muted)";
      }
    }
  });

  const wizardScreen = document.getElementById("screen-wizard");
  if (wizardScreen) wizardScreen.scrollTo(0, 0);
  window.scrollTo(0, 0);
}

function startWizard() {
  if (APP_PAGE !== "adventure") {
    navigateToPage("adventure", { view: "wizard" });
    return;
  }
  showScreen("wizard");
  wizardGoStep(1);
}

function startWizardWithLegend(legend: any) {
  G.selectedLegend = legend;
  if (APP_PAGE !== "adventure") {
    sessionStorage.setItem("rpg_selected_legend", JSON.stringify(legend));
    navigateToPage("adventure", { view: "wizard" });
    return;
  }
  showScreen("wizard");
  wizardGoStep(1);
  showToast(`Legend selected: ${legend.name}. Choose a world to begin.`, "info");
}

async function fetchUserCharacters() {
  const params = buildIdentityQuery();
  const query = params.toString();
  const res = await fetch(`${API}/characters${query ? `?${query}` : ""}`);
  const j = await res.json();
  return j.success ? j.data || [] : [];
}

async function fetchLegendCollection() {
  const [characters, saveResponse] = await Promise.all([
    fetchUserCharacters().catch(() => []),
    fetch(
      `${API}/load/list/all?${buildIdentityQuery().toString()}`,
    )
      .then((res) => res.json())
      .catch(() => ({ success: false, data: [] })),
  ]);

  const merged = new Map<string, any>();

  for (const character of characters) {
    merged.set(character.id, {
      ...character,
      hasSave: false,
      last_action_log: null,
      updated_at: character.created_at || null,
    });
  }

  for (const save of saveResponse.success ? saveResponse.data || [] : []) {
    const existing = merged.get(save.character_id) || {
      id: save.character_id,
      name: save.character_name || "Unknown Hero",
      level: save.level || 1,
      skill_data: null,
    };
    merged.set(save.character_id, {
      ...existing,
      name: existing.name || save.character_name || "Unknown Hero",
      level: existing.level || save.level || 1,
      hasSave: true,
      last_action_log: save.last_action_log || null,
      updated_at: save.updated_at || existing.updated_at || null,
    });
  }

  return Array.from(merged.values()).sort((a, b) => {
    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bTime - aTime;
  });
}

async function fetchCreatedWorlds() {
  const listEl = document.getElementById("created-world-list");
  if (listEl) {
    listEl.innerHTML =
      '<div class="world-record-empty">Loading created worlds...</div>';
  }

  try {
    const query = buildIdentityQuery().toString();
    const res = await fetch(`${API}/worlds${query ? `?${query}` : ""}`);
    const j = await res.json();
    G.createdWorlds = sortCreatedWorlds(j.success ? j.data || [] : []);
  } catch {
    G.createdWorlds = [];
  }

  setHubSummaryValue(
    "hub-world-count",
    `${G.createdWorlds.length} ${G.createdWorlds.length === 1 ? "world" : "worlds"}`,
  );

  renderCreatedWorlds();
  renderHubWorldArchivePreview();
  renderHubCurrentJourney();
  renderHubRecentJourneys();
  renderMapPreviewWorldSelector();
}

function renderCreatedWorlds() {
  const listEl = document.getElementById("created-world-list");
  if (!listEl) return;

  if (!G.createdWorlds || G.createdWorlds.length === 0) {
    listEl.innerHTML = `
      <div class="world-record-empty">
        No worlds recorded yet. Start an adventure and it will appear here.
      </div>
    `;
    return;
  }

  listEl.innerHTML = G.createdWorlds
    .map((world: any) => {
      const worldBiomes =
        world.customBiomes && world.customBiomes.length > 0
          ? world.customBiomes
          : PRESET_WORLD_BIOMES[world.worldPreset || ""] || [];
      const worldName = escapeHtml(world.worldName || "Unknown World");
      const presetName = escapeHtml(
        worldPresetLabel(world.worldPreset || "custom"),
      );
      const phase = escapeHtml(world.phase || "IDLE");
      const characterName = escapeHtml(world.characterName || "Hero");
      const biomeSummary = escapeHtml(
        formatWorldList("biomes", worldBiomes),
      );
      const monsterSummary = escapeHtml(
        formatWorldList("monsters", world.customMonsters || []),
      );
      const lastActionLog = escapeHtml(
        world.lastActionLog || "No recent action recorded yet.",
      );
      const updatedAt = escapeHtml(
        world.updatedAt ? new Date(world.updatedAt).toLocaleString() : "No timestamp",
      );
      const deleteName = escapeJsSingleQuoted(world.worldName || "Unknown World");
      return `
        <div class="world-record-card">
          <button
            class="btn-delete world-delete-btn"
            title="Delete World"
            onclick="event.stopPropagation(); deleteWorldRecord('${world.characterId}', '${deleteName}')"
          >
            🗑️
          </button>
          <div class="world-record-header">
            <div>
              <div class="world-record-title">${worldName}</div>
              <div class="world-record-subtitle">${presetName} • Seed ${Number(world.worldSeed) || 0}</div>
            </div>
            <div class="world-record-phase">${phase}</div>
          </div>
          <div class="world-record-meta">Legend: ${characterName}</div>
          <div class="world-record-meta">Biomes: ${biomeSummary}</div>
          <div class="world-record-meta">Monsters: ${monsterSummary}</div>
          <div class="world-record-meta world-record-log">${lastActionLog}</div>
          <div class="world-record-footer">
            <span>${updatedAt}</span>
            <button class="btn btn-action" onclick="event.stopPropagation(); applyWorldRecord('${world.characterId}')">Use World</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderMapPreviewWorldSelector() {
  const shell = document.getElementById("map-progress-panel");
  const listEl = document.getElementById("map-world-selector");
  const noteEl = document.getElementById("map-preview-note");
  if (!shell || !listEl) return;

  if (APP_PAGE !== "map") {
    shell.style.display = "none";
    return;
  }

  shell.style.display = "block";
  const worlds = sortCreatedWorlds(G.createdWorlds || []);
  if (noteEl) {
    noteEl.textContent =
      G.characterId && G.gs
        ? "Previewing the latest saved map state for this legend."
        : "Choose a saved world to inspect its current map progress.";
  }

  if (worlds.length === 0) {
    listEl.innerHTML = `
      <div class="map-preview-empty">
        <div class="map-preview-empty-title">No saved worlds yet</div>
        <div class="map-preview-empty-copy">
          Start an adventure once, then come back here to track the world as it evolves.
        </div>
        <div class="map-preview-empty-actions">
          <button class="btn btn-primary" onclick="startWizard()">⚔️ Start Adventure</button>
          <button class="btn btn-action" onclick="showForge('menu')">⚒️ Forge Legend</button>
        </div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = worlds
    .slice(0, 8)
    .map((world: any) => {
      const isActive = G.characterId === world.characterId;
      const worldName = escapeHtml(world.worldName || "Unknown World");
      const legendName = escapeHtml(world.characterName || "Hero");
      const phase = escapeHtml(world.phase || "IDLE");
      const updatedAt = world.updatedAt
        ? new Date(world.updatedAt).toLocaleString()
        : "No timestamp";
      const safeName = escapeJsSingleQuoted(world.characterName || "Hero");
      return `
        <button
          class="map-world-card ${isActive ? "active" : ""}"
          onclick="loadGame('${world.characterId}', '${safeName}')"
        >
          <div class="map-world-card-top">
            <div>
              <div class="map-world-card-title">${worldName}</div>
              <div class="map-world-card-subtitle">${legendName} • ${escapeHtml(worldPresetLabel(world.worldPreset || "custom"))}</div>
            </div>
            <div class="map-world-card-phase">${phase}</div>
          </div>
          <div class="map-world-card-meta">Seed ${Number(world.worldSeed) || 0} • ${escapeHtml(updatedAt)}</div>
          <div class="map-world-card-actions">
            <span>${isActive ? "Now previewing" : "Load preview"}</span>
            <span class="map-world-card-link" onclick="event.stopPropagation(); openWorldInAdventure('${world.characterId}', '${safeName}')">Open adventure</span>
          </div>
        </button>
      `;
    })
    .join("");
}

function resetMapPreviewState() {
  G.characterId = null;
  G.worldSeed = null;
  G.gs = null;
  G.worldDefinition = null;
  G.regions = [];
  G.selectedRegion = null;
  G.selectedRegionIndex = 0;
  G.activeCombat = null;
  toggleMapCombatStage(false);
}

function renderMapPreviewEmptyState() {
  resetMapPreviewState();
  const listEl = document.getElementById("region-list");
  if (listEl) {
    listEl.innerHTML = `
      <div class="map-preview-empty map-preview-empty-stage">
        <div class="map-preview-empty-title">Map preview is waiting for its first world</div>
        <div class="map-preview-empty-copy">
          Once a legend starts an adventure and saves progress, this page will show the live world map here.
        </div>
        <div class="map-preview-empty-actions">
          <button class="btn btn-primary" onclick="startWizard()">⚔️ Start Adventure</button>
          <button class="btn btn-action" onclick="showScreen('menu')">🏠 Main Menu</button>
        </div>
      </div>
    `;
  }
  setMapEventState(
    "🗺️ Map preview is standing by",
    "This page is reserved for live world-map progress. Start an adventure to populate it.",
  );
  syncMapSelectionState();
  renderMapPreviewWorldSelector();
}

async function initializeMapPage(forceReload = false) {
  if (APP_PAGE !== "map") return;

  showScreen("world");
  clearAdventureLog();
  setMapEventState(
    "🗺️ Loading world map progress",
    "This page tracks the latest saved world. Pick a recorded world below to inspect its current map state.",
  );
  toggleMapCombatStage(false);

  if (!G.createdWorlds.length || forceReload) {
    await fetchCreatedWorlds();
  } else {
    renderMapPreviewWorldSelector();
  }

  if (!G.createdWorlds.length) {
    renderMapPreviewEmptyState();
    return;
  }

  const previewWorld =
    (!forceReload &&
      G.characterId &&
      G.createdWorlds.find(
        (world: any) => world.characterId === G.characterId,
      )) ||
    sortCreatedWorlds(G.createdWorlds)[0];

  if (!previewWorld) {
    renderMapPreviewEmptyState();
    return;
  }

  renderMapPreviewWorldSelector();
  if (
    forceReload ||
    G.characterId !== previewWorld.characterId ||
    !G.gs ||
    !G.regions.length
  ) {
    await loadGame(previewWorld.characterId, previewWorld.characterName);
  } else {
    syncMapSelectionState();
  }
}

function openWorldInAdventure(characterId: string, characterName?: string) {
  sessionStorage.setItem(
    PENDING_LOAD_KEY,
    JSON.stringify({
      characterId,
      characterName: characterName || null,
    }),
  );
  navigateToPage("adventure");
}

function applyWorldRecord(characterId: string) {
  const world = G.createdWorlds.find(
    (entry: any) => entry.characterId === characterId,
  );
  if (!world) return;

  G.customSelection.biomes = [
    ...((world.customBiomes && world.customBiomes.length > 0
      ? world.customBiomes
      : PRESET_WORLD_BIOMES[world.worldPreset || ""]) || []),
  ];
  G.customSelection.monsters = [...(world.customMonsters || [])];

  const presetId = world.worldPreset || "custom";
  const presetEl =
    (document.querySelector(
      `.preset-card[data-preset="${presetId}"]`,
    ) as HTMLElement | null) ||
    (document.querySelector(
      '.preset-card[data-preset="custom"]',
    ) as HTMLElement | null);

  if (presetEl) {
    selectPreset(
      presetEl,
      world.worldName || "Custom World",
      G.selectedLegend?.name || "Hero",
      Number(world.worldSeed) || null,
    );
  }

  const worldNameEl = document.getElementById(
    "input-world-name",
  ) as HTMLInputElement | null;
  if (worldNameEl) worldNameEl.value = world.worldName || "";

  const seedEl = document.getElementById("input-seed") as HTMLInputElement | null;
  if (seedEl) seedEl.value = String(world.worldSeed || "");

  renderThemeBiomes(presetId);
  renderThemeMonsters(presetId);
  showToast(`World selected: ${world.worldName}`, "info");
}

async function deleteWorldRecord(characterId: string, worldName: string) {
  if (
    !confirm(
      `Delete the saved world "${worldName}"? The legend stays, but this adventure world/save will be erased.`,
    )
  ) {
    return;
  }

  try {
    const res = await fetch(`${API}/worlds/${characterId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: G.user?.id,
        email: G.user?.email,
        inviteCode: G.user?.inviteCode,
      }),
    });
    const j = await res.json();
    if (!j.success) {
      throw new Error(j.error || "Could not delete world");
    }

    if (G.characterId === characterId) {
      G.characterId = null;
      G.gs = null;
      G.worldDefinition = null;
      G.regions = [];
      G.selectedRegion = null;
      G.selectedRegionIndex = 0;
    }

    showToast(`Deleted world: ${worldName}`, "info");
    await Promise.all([fetchCreatedWorlds(), fetchSaveList()]);
    if (APP_PAGE === "map") {
      await initializeMapPage(true);
    }
  } catch (err: any) {
    showToast(err.message || "Could not delete world", "error");
  }
}

// --- VAULT & FORGE LOGIC ---

async function fetchVaultSelections() {
  const grid = document.getElementById("vault-selection-grid");
  if (!grid) return;
  grid.innerHTML =
    '<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--muted);">Loading vault...</div>';

  try {
    const legends = await fetchLegendCollection();
    if (legends.length > 0) {
      grid.innerHTML = legends
        .map(
          (c: any) => `
                <div class="legend-card ${G.selectedLegend?.id === c.id ? "selected" : ""}" onclick="selectLegend('${c.id}', ${JSON.stringify(c).replace(/"/g, "&quot;")})">
                    <div class="name">${c.name}</div>
                    <div style="font-size:11px; color:var(--muted)">Lv.${c.level} Adventurer</div>
                    <div class="skill-badge" title="${c.skill_data?.mechanics || ""}">🌟 ${c.skill_data?.name || "Innate"}</div>
                </div>
            `,
        )
        .join("");
    } else {
      grid.innerHTML =
        '<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--muted);">Your vault is empty. Forge a legend first!</div>';
    }
  } catch (e) {
    grid.innerHTML =
      '<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--red);">Error loading vault.</div>';
  }
}

function selectLegend(id: string, legend: any) {
  G.selectedLegend = legend;
  document
    .querySelectorAll("#vault-selection-grid .legend-card")
    .forEach((el) => el.classList.remove("selected"));
  // Visual update will happen on re-render in fetchVaultSelections if we want, or manually here
  const nextBtn = document.getElementById(
    "btn-vault-next",
  ) as HTMLButtonElement;
  if (nextBtn) nextBtn.disabled = false;

  // Add selected class to the clicked element (the one that triggered the event)
  const target = event?.currentTarget as HTMLElement;
  if (target) target.classList.add("selected");
}

function showVault() {
  if (APP_PAGE !== "vault") {
    navigateToPage("vault");
    return;
  }
  showScreen("vault");
  renderFullVault();
}

async function renderFullVault() {
  const grid = document.getElementById("vault-full-list");
  if (!grid) return;
  grid.innerHTML =
    '<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--muted);">Opening the archives...</div>';

  try {
    const legends = await fetchLegendCollection();
    if (legends.length > 0) {
      grid.innerHTML = legends
        .map(
          (c: any) => `
                <div class="legend-card">
                    <button
                      class="btn-delete"
                      title="Delete Legend"
                      onclick="event.stopPropagation(); deleteLegend('${c.id}', '${c.name.replace(/'/g, "\\'")}')"
                      style="position:absolute; top:10px; right:10px; background:none; border:none; color:var(--red); cursor:pointer; font-size:16px; padding:4px;"
                    >
                      🗑️
                    </button>
                    <div class="name">${c.name}</div>
                    <div style="font-size:11px; color:var(--muted); margin-bottom:10px">Lv.${c.level} Adventurer</div>
                    <div style="background:rgba(0,0,0,0.2); border-radius:6px; padding:10px; font-size:11px">
                        <div style="color:var(--accent); font-weight:700; margin-bottom:4px">🌟 ${c.skill_data?.name || "Innate Power"}</div>
                        <div style="opacity:0.8; font-style: italic; margin-bottom: 8px; line-height:1.4">${c.skill_data?.description || "No lore description."}</div>
                        ${
                          c.skill_data?.mechanics
                            ? `
                        <div style="font-size: 9px; color: var(--accent2); font-weight: 800; margin-bottom: 2px; text-transform: uppercase;">Mechanics:</div>
                        <div style="color:var(--text); line-height:1.3">${c.skill_data.mechanics}</div>
                        `
                            : ""
                        }
                        <div style="display:flex; gap:10px; margin-top:8px; font-size:9px; color:var(--muted)">
                            <span>CD: <b style="color:var(--gold)">${c.skill_data?.cooldown || 0}</b></span>
                            <span>Target: <b style="color:var(--text)">${c.skill_data?.target_type || "N/A"}</b></span>
                        </div>
                    </div>
                </div>
            `,
        )
        .join("");
    } else {
      grid.innerHTML =
        '<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--muted);">No legends have been recorded yet.</div>';
    }
  } catch (e) {
    grid.innerHTML =
      '<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--red);">Vault connection failed.</div>';
  }
}

function forgeGoStep(step: number) {
  const s1 = document.getElementById("forge-step-1");
  const s2 = document.getElementById("forge-step-2");

  if (step === 2) {
    // Validate name before proceeding
    const nameVal = (
      document.getElementById("forge-name") as HTMLInputElement
    )?.value.trim();
    if (!nameVal) {
      alert("Please enter a name for your legend.");
      return;
    }
  }

  if (s1 && s2) {
    s1.style.display = step === 1 ? "block" : "none";
    s2.style.display = step === 2 ? "block" : "none";
  }
}

let forgeReturnState: "menu" | "vault" | "wizard" = "menu";

function showForge(returnTo: "menu" | "vault" | "wizard" = "menu") {
  if (APP_PAGE !== "forge") {
    navigateToPage("forge", { returnTo });
    return;
  }
  forgeReturnState = returnTo;
  showScreen("forge");
  // Reset state
  forgeState = { skillCode: "", skillData: null };
  (document.getElementById("forge-name") as HTMLInputElement).value = "";

  // Reset appearance to default
  (document.getElementById("forge-gender") as HTMLSelectElement).value = "male";
  (document.getElementById("forge-skin") as HTMLSelectElement).value = "fair";
  (document.getElementById("forge-face") as HTMLSelectElement).value = "round";
  (document.getElementById("forge-hair") as HTMLSelectElement).value = "black";
  (document.getElementById("forge-eyes") as HTMLSelectElement).value = "brown";

  document.getElementById("forge-skill-display")!.style.display = "none";
  document.getElementById("forge-skill-placeholder")!.style.display = "block";
  setForgeSkillBoxVisible(false);
  document.getElementById("skill-code-forge")!.innerHTML = "";
  const sigilHost = document.getElementById("skill-code-forge") as HTMLElement | null;
  if (sigilHost) {
    forgeSigilHost = sigilHost;
    forgeSigilRotation = 0;
    applyForgeSigilRotation(sigilHost);
  }
  stopForgeSigilMotion();
  const forgeScreen = document.getElementById("screen-forge");
  setForgeScreenPhase(forgeScreen, "idle");
  (document.getElementById("btn-forge-confirm") as HTMLButtonElement).disabled =
    true;
  (document.getElementById("btn-forge-confirm") as HTMLButtonElement).textContent =
    "Confirm Character Creation ⚔️";
  (document.getElementById("forge-error") as HTMLElement).style.display =
    "none";

  forgeGoStep(1);
}

function backFromForge() {
  // Refresh both candidate lists if they exist
  fetchVaultSelections();
  renderFullVault();

  // Go back to wherever we were
  if (forgeReturnState === "vault") {
    showScreen("vault");
  } else if (forgeReturnState === "wizard") {
    showScreen("wizard");
    wizardGoStep(2);
  } else {
    showScreen("menu");
  }
}

async function rollForgeSkill() {
  const btn = document.getElementById("btn-roll-forge") as HTMLButtonElement;
  const confirmBtn = document.getElementById(
    "btn-forge-confirm",
  ) as HTMLButtonElement;
  const display = document.getElementById("skill-code-forge") as HTMLElement;
  const resultBox = document.getElementById("forge-skill-box") as HTMLElement;
  const starArea = document.getElementById(
    "forge-skill-display",
  ) as HTMLElement;
  const placeholder = document.getElementById(
    "forge-skill-placeholder",
  ) as HTMLElement;
  const screen = document.getElementById("screen-forge");

  if (
    !btn ||
    !confirmBtn ||
    !display ||
    !resultBox ||
    !starArea ||
    !placeholder ||
    !screen
  )
    return;

  btn.disabled = true;
  confirmBtn.disabled = true;
  placeholder.style.display = "none";
  starArea.style.display = "block";
  setForgeSkillBoxVisible(false);
  setForgeScreenPhase(screen, "rolling");
  forgeSigilRotation = 0;
  applyForgeSigilRotation(display);
  startForgeSigilMotion(display, 96);

  let codeStr = "";
  let rolls = 0;
  const rollInterval = setInterval(() => {
    codeStr = Array.from({ length: 9 }, () =>
      Math.floor(Math.random() * 10),
    ).join("");
    renderForgeSigil(display, codeStr, null, "rolling");
    rolls++;
    if (rolls > 15) {
      clearInterval(rollInterval);
      fetchForgeInterpretation(codeStr);
    }
  }, 50);

  async function fetchForgeInterpretation(code: string) {
    setForgeScreenPhase(screen, "interpreting");
    startForgeSigilMotion(display, 42);
    renderForgeSigil(display, code, null, "interpreting");

    try {
      const res = await fetch(`${DEV_API}/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "skill", context: code }),
      });
      const j = await res.json();

      if (j.success && j.data) {
        forgeState.skillCode = code;
        forgeState.skillData = j.data;

        document.getElementById("forge-skill-name")!.textContent = j.data.name;
        document.getElementById("forge-skill-cost")!.textContent =
          j.data.mana_cost + " MP";
        document.getElementById("forge-skill-desc")!.textContent =
          j.data.description;
        document.getElementById("forge-skill-mechanics")!.textContent =
          j.data.mechanics;
        document.getElementById("forge-skill-cd")!.textContent = String(
          j.data.cooldown,
        );
        document.getElementById("forge-skill-target")!.textContent =
          j.data.target_type;
        document.getElementById("forge-skill-scaling")!.textContent =
          j.data.scaling_stat;

        renderForgeSigil(display, code, j.data, "final");
        setForgeScreenPhase(screen, "settling");
        await new Promise((resolve) => setTimeout(resolve, 220));
        await settleForgeSigil(display);
        setForgeSkillBoxVisible(true);
        setForgeScreenPhase(screen, "resolved");
        confirmBtn.disabled = false;
      } else {
        stopForgeSigilMotion();
        setForgeScreenPhase(screen, "idle");
        display.innerHTML = `<div style="color:var(--red);font-size:10px">${j.error || "Interpretation Failed"}</div>`;
      }
    } catch (e) {
      stopForgeSigilMotion();
      setForgeScreenPhase(screen, "idle");
      display.innerHTML = `<div style="color:var(--red);font-size:10px">Connection Error</div>`;
    } finally {
      stopForgeSigilMotion();
      btn.disabled = false;
    }
  }
}

async function confirmForge() {
  const nameEl = document.getElementById("forge-name") as HTMLInputElement;
  const errEl = document.getElementById("forge-error") as HTMLElement;
  const btn = document.getElementById("btn-forge-confirm") as HTMLButtonElement;
  const name = nameEl.value.trim();

  if (!name) {
    errEl.textContent = "Please enter a name for your legend.";
    errEl.style.display = "block";
    return;
  }
  errEl.style.display = "none";
  btn.disabled = true;
  btn.textContent = "Baking...";

  const appearance = {
    gender:
      (document.getElementById("forge-gender") as HTMLSelectElement)?.value ||
      "male",
    skinTone:
      (document.getElementById("forge-skin") as HTMLSelectElement)?.value ||
      "fair",
    faceShape:
      (document.getElementById("forge-face") as HTMLSelectElement)?.value ||
      "round",
    hairStyle:
      (document.getElementById("forge-hair") as HTMLSelectElement)?.value ||
      "black",
    eyeColor:
      (document.getElementById("forge-eyes") as HTMLSelectElement)?.value ||
      "brown",
  };

  try {
    const res = await fetch(API + "/character", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterName: name,
        playerName:
          (G.user?.email && G.user.email.split("@")[0]) ||
          G.user?.label ||
          "Hero",
        userId: G.user?.id,
        email: G.user?.email,
        inviteCode: G.user?.inviteCode,
        signatureSkill: { code: forgeState.skillCode, ...forgeState.skillData },
        appearance: appearance, // Dev placeholder data for generating portraits later
      }),
    });
    const j = await res.json();
    if (j.success) {
      showToast("Legend forged successfully! ✨", "success");
      // Select this character if we're in the wizard flow
      G.selectedLegend = j.data;
      await Promise.all([fetchVaultSelections(), renderFullVault(), fetchSaveList()]);
      backFromForge();
    } else {
      errEl.textContent = j.error || "Failed to forge legend.";
      errEl.style.display = "block";
    }
  } catch (e) {
    errEl.textContent = "Server connection failed.";
    errEl.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm Character Creation ⚔️";
  }
}

async function rollSkill() {
  const btn = document.getElementById("btn-roll-skill") as HTMLButtonElement;
  const nextBtn = document.getElementById(
    "btn-step3-next",
  ) as HTMLButtonElement;
  const display = document.getElementById("skill-code-display") as HTMLElement;
  const resultBox = document.getElementById("skill-result-box") as HTMLElement;

  // Disable buttons
  btn.disabled = true;
  nextBtn.disabled = true;
  resultBox.style.display = "none";

  // Animate rolling
  let codeStr = "";
  let rolls = 0;
  const rollInterval = setInterval(() => {
    codeStr = Array.from({ length: 9 }, () =>
      Math.floor(Math.random() * 10),
    ).join("");
    const formatted = codeStr.match(/.{1,3}/g)?.join("-") || codeStr;
    display.innerHTML = `<div style="font-family:monospace; font-size:32px; font-weight:900; letter-spacing:4px; color:var(--accent); text-shadow:0 0 10px rgba(99,102,241,0.5)">${formatted}</div>`;
    rolls++;
    if (rolls > 15) {
      clearInterval(rollInterval);
      fetchAIinterpretation(codeStr);
    }
  }, 50);

  async function fetchAIinterpretation(code: string) {
    display.innerHTML = `<div style="font-family:monospace; font-size:32px; font-weight:900; letter-spacing:4px; color:var(--text); text-shadow:0 0 10px rgba(255,255,255,0.5)">${code.match(/.{1,3}/g)?.join("-")}</div><div style="font-size:10px;color:var(--accent);margin-top:8px">Interpreting with AI...</div>`;

    try {
      const res = await fetch(`${DEV_API}/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "skill", context: code }),
      });
      const j = await res.json();

      if (j.success && j.data) {
        wizardState.skillCode = code;
        wizardState.skillData = j.data;

        // Populate UI
        document.getElementById("skill-name-ui")!.textContent = j.data.name;
        document.getElementById("skill-cost-ui")!.textContent =
          j.data.mana_cost + " MP";
        document.getElementById("skill-desc-ui")!.textContent =
          j.data.description;
        document.getElementById("skill-cd-ui")!.textContent = String(
          j.data.cooldown,
        );
        document.getElementById("skill-target-ui")!.textContent =
          j.data.target_type;
        document.getElementById("skill-scaling-ui")!.textContent =
          j.data.scaling_stat + " (" + j.data.power_multiplier + "x)";

        resultBox.style.display = "block";
        display.innerHTML = `<div style="font-family:monospace; font-size:24px; font-weight:900; letter-spacing:4px; color:#fff">${code.match(/.{1,3}/g)?.join("-")}</div>`;
        nextBtn.disabled = false;
      } else {
        display.innerHTML = `<div style="color:var(--red);font-size:12px">AI Interpretation Failed. Ensure API Key is set in Dev Panel.</div>`;
      }
    } catch (e) {
      console.error(e);
      display.innerHTML = `<div style="color:var(--red);font-size:12px">Network Error</div>`;
    }
    btn.disabled = false;
  }
}

function rollRandomSeed() {
  const svEl = document.getElementById("input-seed") as HTMLInputElement;
  svEl.value = String(Math.floor(Math.random() * 999999999));
}

async function loadWorldContent() {
  try {
    const res = await fetch(API + "/content");
    const j = await res.json();
    if (!j.success) return;
    const { biomes, monsters, factions, maps } = j.data;

    G.allContent.biomes = biomes || [];
    G.allContent.monsters = monsters || [];
    G.allContent.factions = factions || [];
    G.allContent.maps = maps || [];

    // Factions and Maps can still be rendered directly if they aren't theme-dependent
    const facEl = document.getElementById("faction-list");
    if (facEl && factions && factions.length > 0) {
      facEl.innerHTML = factions
        .map(
          (f: any) => `
                <div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:11px">
                    <div style="font-weight:700">${f.name}</div>
                    <div style="color:var(--muted);font-size:10px;margin-top:2px">${f.ideology || f.type || ""}</div>
                </div>
            `,
        )
        .join("");
    }

    const mapEl = document.getElementById("map-list");
    if (mapEl && maps && maps.length > 0) {
      mapEl.innerHTML = maps
        .map(
          (m: any) => `
                <div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:11px;display:flex;justify-content:space-between">
                    <span style="font-weight:600">${m.name}</span>
                    <span style="color:var(--red);font-size:10px">⚠ Lv.${m.danger_level}</span>
                </div>
            `,
        )
        .join("");
    }

    const preview = document.getElementById("content-preview");
    if (preview) preview.style.display = "block";
    renderCreatedWorlds();
  } catch (e) {
    console.warn("Could not load world content", e);
  }
}

async function submitNewGame() {
  if (!G.selectedLegend) return;

  const svEl = document.getElementById("input-seed") as HTMLInputElement;
  const errEl = document.getElementById("start-error") as HTMLElement;
  const sv = svEl?.value.trim();

  if (errEl) errEl.style.display = "none";

  // --- STEP 1: Enter game screen IMMEDIATELY ---
  const seed = sv ? Number(sv) : Math.floor(Math.random() * 999999999);
  const selectedPreset = document.querySelector(
    ".preset-card.selected",
  ) as HTMLElement;
  const presetId = selectedPreset?.dataset.preset || "balanced";
  const presetName =
    selectedPreset?.querySelector(".preset-name")?.textContent ||
    "Unknown World";
  const isCustom = presetId === "custom";

  let finalWorldName = wizardState.worldName || presetName;
  if (isCustom) {
    const customName = (
      document.getElementById("input-world-name") as HTMLInputElement
    )?.value.trim();
    if (customName) finalWorldName = customName;
  }
  const activeCustomBiomes = isCustom
    ? [...G.customSelection.biomes]
    : [...(PRESET_WORLD_BIOMES[presetId] || [])];
  const activeCustomMonsters = isCustom ? [...G.customSelection.monsters] : [];

  G.worldSeed = seed;
  G.selectedRegion = null;
  G.selectedRegionIndex = 0;
  G.regions = [];
  G.gs = {
    characterName: G.selectedLegend.name,
    playerName: G.user?.email?.split("@")[0] || "Hero",
    level: G.selectedLegend.level || 1,
    exp: 0,
    gold: 0,
    hp: G.selectedLegend.hp,
    maxHP: G.selectedLegend.max_hp,
    mana: G.selectedLegend.mana,
    maxMana: G.selectedLegend.max_mana,
    equipment: { weapon: null, armor: null, accessory: null },
    inventory: [],
    effectiveStats: {
      attack: G.selectedLegend.attack,
      defense: G.selectedLegend.defense,
      speed: G.selectedLegend.speed,
    },
    worldSeed: seed,
    worldName: finalWorldName,
    worldPreset: presetId,
    customBiomes: activeCustomBiomes,
    customMonsters: activeCustomMonsters,
    signatureSkill: G.selectedLegend.skill_data,
  };
  G.worldDefinition = normalizeWorldDefinition(
    {
      seed,
      metadata: {
        worldName: finalWorldName,
        worldPreset: presetId,
        customBiomes: activeCustomBiomes,
        customMonsters: activeCustomMonsters,
      },
      regions: [],
    },
    [],
  );

  updateAllStatusBars();
  clearAdventureLog();
  setMapEventState(
    "🧭 Choose your opening route",
    "Your journey begins from the start node. Select a reachable route on the map to travel and trigger the first event.",
  );
  toggleMapCombatStage(false);
  showScreen("world");
  showToast(`Welcome back, ${G.selectedLegend.name}! ⚔️`, "success");

  // --- STEP 2: Sync with server in background (non-blocking) ---
  (async () => {
    try {
      let autoCustomSelection: { biomes: string[]; monsters: string[] } | null =
        null;
      if (isCustom) {
        autoCustomSelection = G.customSelection;
      } else {
        autoCustomSelection = { biomes: [], monsters: [] };
        autoCustomSelection.biomes = [...(PRESET_WORLD_BIOMES[presetId] || [])];
      }

      const res = await fetch(API + "/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worldSeed: seed,
          characterId: G.selectedLegend.id,
          userId: G.user?.id,
          email: G.user?.email,
          inviteCode: G.user?.inviteCode,
          worldName: finalWorldName,
          worldPreset: presetId,
          customSelection: autoCustomSelection,
        }),
      });
      const j = await res.json();
      if (j.success) {
        G.characterId = j.data.characterId;
        G.worldSeed = j.data.worldSeed;
        G.gs = j.data.gameState || j.data.state || G.gs;
        G.worldDefinition = normalizeWorldDefinition(
          j.data.worldDefinition,
          j.data.regions,
        );
        G.regions = normalizeRegions(
          G.worldDefinition?.regions || j.data.regions,
        );
        syncSelectedRegionFromSession(true);
        renderRegions();
        updateAllStatusBars();
        fetchCreatedWorlds();
        showToast("Adventure synced! 🌍", "success");
      } else {
        showToast("Sync issue: " + (j.error || "Server busy"), "error");
      }
    } catch (err) {
      console.warn("[World] Server sync failed, using local state:", err);
      // Default regions if offline
      if (!G.regions || G.regions.length === 0) {
        G.regions = normalizeRegions([
          {
            name: "Starting Plains",
            dangerLevel: 1,
            enemyTypes: ["Slime", "Goblin"],
          },
          {
            name: "Dark Forest",
            dangerLevel: 3,
            enemyTypes: ["Wolf", "Bandit"],
          },
          {
            name: "Ancient Ruins",
            dangerLevel: 5,
            enemyTypes: ["Skeleton", "Ghost"],
          },
        ]);
        renderRegions();
      }
    }
  })();
}

// --- LOAD ---
function sortJourneyRecords(values: any[] | null | undefined) {
  return [...(values || [])].sort((a, b) => {
    const aTime = a?.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bTime = b?.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bTime - aTime;
  });
}

function getWorldRecordForCharacter(characterId: string | null | undefined) {
  if (!characterId) return null;
  return (
    (G.createdWorlds || []).find(
      (world: any) => world.characterId === characterId,
    ) || null
  );
}

function getLatestJourney() {
  return sortJourneyRecords(G.recentJourneys || [])[0] || null;
}

function renderHubCurrentJourney() {
  const shell = document.getElementById("hub-current-journey");
  if (!shell) return;

  const latest = getLatestJourney();
  if (!latest) {
    shell.innerHTML = `
      <div class="hub-current-empty">
        <div class="hub-current-title">No active journey yet</div>
        <div class="hub-current-copy">
          Start a new adventure from the hall below, then return here to track the current expedition.
        </div>
      </div>
    `;
    return;
  }

  const world = getWorldRecordForCharacter(latest.character_id);
  const characterName = escapeHtml(latest.character_name || "Hero");
  const worldName = escapeHtml(world?.worldName || "Uncharted Realm");
  const presetName = escapeHtml(
    worldPresetLabel(world?.worldPreset || "custom"),
  );
  const lastLog = escapeHtml(
    truncateText(
      latest.last_action_log ||
        "Resume the journey from the last recorded scene.",
      110,
    ),
  );
  const updatedAt = latest.updated_at
    ? new Date(latest.updated_at).toLocaleString()
    : "No recent timestamp";
  const safeName = escapeJsSingleQuoted(latest.character_name || "Hero");

  shell.innerHTML = `
    <div class="hub-current-eyebrow">Latest Save</div>
    <div class="hub-current-title">${characterName}</div>
    <div class="hub-current-meta">${worldName} • ${presetName}</div>
    <div class="hub-current-copy">${lastLog}</div>
    <div class="hub-current-actions">
      <button class="btn btn-primary" onclick="loadGame('${latest.character_id}', '${safeName}')">
        ⚔ Resume Journey
      </button>
      <button class="btn btn-action" onclick="showMapPage()">
        🗺 World Map
      </button>
    </div>
    <div class="hub-current-foot">${escapeHtml(updatedAt)}</div>
  `;
}

function renderHubRecentJourneys() {
  const listEl = document.getElementById("save-list");
  if (!listEl) return;

  const journeys = sortJourneyRecords(G.recentJourneys || []);
  if (journeys.length === 0) {
    listEl.innerHTML = `
      <div class="hub-list-empty">
        <div class="hub-list-empty-title">No journeys recorded yet</div>
        <div class="hub-list-empty-copy">
          Forge a legend, then start an adventure to create the first save route.
        </div>
        <div class="hub-list-empty-actions">
          <button class="btn btn-primary" onclick="startWizard()">⚔ Start New Adventure</button>
          <button class="btn btn-action" onclick="showForge('menu')">⚒ Forge Legend</button>
        </div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = journeys
    .slice(0, 4)
    .map((save: any) => {
      const world = getWorldRecordForCharacter(save.character_id);
      const safeName = escapeJsSingleQuoted(save.character_name || "Hero");
      const worldName = escapeHtml(world?.worldName || "Uncharted Realm");
      const updatedAt = save.updated_at
        ? new Date(save.updated_at).toLocaleString()
        : "No timestamp";
      return `
        <button class="hub-list-card" onclick="loadGame('${save.character_id}', '${safeName}')">
          <div class="hub-list-card-top">
            <div>
              <div class="hub-list-card-title">${escapeHtml(save.character_name || "Hero")}</div>
              <div class="hub-list-card-subtitle">${worldName}</div>
            </div>
            <div class="hub-list-card-chip">Lv.${Number(save.level) || 1}</div>
          </div>
          <div class="hub-list-card-copy">${escapeHtml(truncateText(save.last_action_log || "Resume the last recorded turn.", 74))}</div>
          <div class="hub-list-card-meta">
            <span>${escapeHtml(updatedAt)}</span>
            <span>Resume</span>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderHubWorldArchivePreview() {
  const listEl = document.getElementById("hub-world-preview");
  if (!listEl) return;

  const worlds = sortCreatedWorlds(G.createdWorlds || []);
  if (worlds.length === 0) {
    listEl.innerHTML = `
      <div class="hub-list-empty">
        <div class="hub-list-empty-title">No worlds archived yet</div>
        <div class="hub-list-empty-copy">
          Once a legend enters a realm, the saved world archive will surface here.
        </div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = worlds
    .slice(0, 4)
    .map((world: any) => {
      const safeName = escapeJsSingleQuoted(world.characterName || "Hero");
      const updatedAt = world.updatedAt
        ? new Date(world.updatedAt).toLocaleString()
        : "No timestamp";
      return `
        <div class="hub-list-card hub-world-preview-card">
          <div class="hub-list-card-top">
            <div>
              <div class="hub-list-card-title">${escapeHtml(world.worldName || "Unknown World")}</div>
              <div class="hub-list-card-subtitle">${escapeHtml(worldPresetLabel(world.worldPreset || "custom"))} • ${escapeHtml(world.characterName || "Hero")}</div>
            </div>
            <div class="hub-list-card-chip">${escapeHtml(world.phase || "IDLE")}</div>
          </div>
          <div class="hub-list-card-copy">${escapeHtml(truncateText(world.lastActionLog || "No recent action recorded.", 74))}</div>
          <div class="hub-list-card-meta">
            <span>${escapeHtml(updatedAt)}</span>
            <span class="hub-inline-actions">
              <button class="btn-link-inline" onclick="openWorldInAdventure('${world.characterId}', '${safeName}')">Open</button>
            </span>
          </div>
        </div>
      `;
    })
    .join("");
}

function resumeLatestJourney() {
  const latest = getLatestJourney();
  if (!latest) {
    showToast("No saved journey is ready yet.", "info");
    return;
  }
  loadGame(latest.character_id, latest.character_name || "Hero");
}

async function fetchSaveList() {
  try {
    const saveRes = await fetch(`${API}/load/list/all?${buildIdentityQuery().toString()}`);
    const j = await saveRes.json();
    const saves = sortJourneyRecords(j.success ? j.data || [] : []);
    G.recentJourneys = saves;
    setHubSummaryValue(
      "hub-save-count",
      `${saves.length} ${saves.length === 1 ? "journey" : "journeys"}`,
    );
    renderHubCurrentJourney();
    renderHubRecentJourneys();
  } catch {
    G.recentJourneys = [];
    setHubSummaryValue("hub-save-count", "Unavailable");
    renderHubCurrentJourney();
    renderHubRecentJourneys();
    showToast("Could not fetch saves", "error");
  }
}

async function deleteLegend(cid: string, name: string) {
  if (
    !confirm(
      `Are you sure you want to permanently delete ${name}? This will remove the legend and any save data.`,
    )
  )
    return;

  try {
    const res = await fetch(API + "/load/" + cid, { method: "DELETE" });
    const j = await res.json();
    if (j.success) {
      if (G.selectedLegend?.id === cid) G.selectedLegend = null;
      showToast(`Legend of ${name} has been erased.`, "info");
      await Promise.all([
        fetchSaveList(),
        fetchCreatedWorlds(),
        renderFullVault(),
        fetchVaultSelections(),
      ]);
    } else {
      showToast(j.error || "Delete failed", "error");
    }
  } catch (err) {
    console.error("Delete error:", err);
    showToast("Connection error during deletion", "error");
  }
}

async function loadGame(cid: string, charName?: string) {
  if (!IS_GAMEPLAY_PAGE) {
    sessionStorage.setItem(
      PENDING_LOAD_KEY,
      JSON.stringify({
        characterId: cid,
        characterName: charName || null,
      }),
    );
    navigateToPage("adventure");
    return;
  }

  // --- Enter game screen IMMEDIATELY ---
  G.characterId = cid;
  G.selectedRegion = null;
  G.selectedRegionIndex = 0;
  G.worldDefinition = null;
  G.gs = G.gs || {
    characterName: charName || "Hero",
    level: 1,
    exp: 0,
    gold: 0,
    hp: 100,
    maxHP: 100,
    mana: 50,
    maxMana: 50,
    equipment: { weapon: null, armor: null, accessory: null },
    inventory: [],
    effectiveStats: { attack: 10, defense: 5, speed: 8 },
    worldSeed: 0,
  };

  const regionListEl = document.getElementById("region-list");
  if (regionListEl)
    regionListEl.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--muted)">
            <div style="font-size:36px;margin-bottom:12px">📂</div>
            <div style="font-size:14px;font-weight:700;margin-bottom:6px">Loading save...</div>
        </div>
    `;

  updateAllStatusBars();
  clearAdventureLog();
  setMapEventState(
    "🧭 Syncing traversal state",
    "Load complete. Your current node and reachable routes will repopulate on the map in a moment.",
  );
  toggleMapCombatStage(false);
  showScreen("world");
  renderMapPreviewWorldSelector();
  showToast("Loading save...", "info");

  // --- Sync in background ---
  try {
    const res = await fetch(API + "/load/" + cid);
    const j = await res.json();
    if (j.success) {
      G.gs = j.data.gameState;
      G.worldSeed = j.data.gameState.worldSeed;
      G.worldDefinition = normalizeWorldDefinition(
        j.data.worldDefinition,
        j.data.regions,
      );
      G.regions = normalizeRegions(
        G.worldDefinition?.regions || j.data.regions,
      );
      syncSelectedRegionFromSession(true);
      renderRegions();
      updateAllStatusBars();
      renderMapPreviewWorldSelector();
      showToast("Game loaded! ✅", "success");
    } else {
      // Server error — show offline regions so the UI isn't stuck
      G.regions = normalizeRegions([
        {
          name: "Starting Plains",
          dangerLevel: 1,
          enemyTypes: ["Slime", "Goblin"],
        },
        { name: "Dark Forest", dangerLevel: 3, enemyTypes: ["Wolf", "Bandit"] },
        {
          name: "Ancient Ruins",
          dangerLevel: 5,
          enemyTypes: ["Skeleton", "Ghost"],
        },
      ]);
      G.worldDefinition = normalizeWorldDefinition(null, G.regions);
      syncSelectedRegionFromSession(true);
      renderRegions();
      renderMapPreviewWorldSelector();
      showToast(j.error || "Offline mode", "info");
    }
  } catch {
    G.regions = normalizeRegions([
      {
        name: "Starting Plains",
        dangerLevel: 1,
        enemyTypes: ["Slime", "Goblin"],
      },
      { name: "Dark Forest", dangerLevel: 3, enemyTypes: ["Wolf", "Bandit"] },
      {
        name: "Ancient Ruins",
        dangerLevel: 5,
        enemyTypes: ["Skeleton", "Ghost"],
      },
    ]);
    G.worldDefinition = normalizeWorldDefinition(null, G.regions);
    syncSelectedRegionFromSession(true);
    renderRegions();
    renderMapPreviewWorldSelector();
    showToast("Offline mode – syncing failed", "info");
  }
}

// --- SAVE ---
async function saveGame() {
  try {
    const res = await fetch(API + "/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: G.characterId }),
    });
    const j = await res.json();
    if (j.success) showToast("💾 Game Saved!", "success");
    else showToast(j.error, "error");
  } catch {
    showToast("Save failed", "error");
  }
}

// --- REGIONS ---
function renderTopologyMap(listEl: HTMLElement, regions: any[]) {
  const layout: any = getActiveMapLayout();
  if (!layout || !Array.isArray(layout.nodes) || layout.nodes.length === 0) {
    return false;
  }
  const definition = getActiveWorldDefinition();
  const traversal = getTraversalState();
  const currentRegionId = traversal.currentRegionId;
  const reachableRegionIds = new Set(getReachableRegionIdsForUI());
  const discoveredRegionIds = new Set(traversal.discoveredRegionIds || []);
  const visitedRegionIds = new Set(traversal.visitedRegionIds || []);
  const clearedRegionIds = new Set(traversal.clearedRegionIds || []);
  const lockedRegionIds = new Set(traversal.lockedRegionIds || []);
  const traversedPathIds = new Set(traversal.traversedPathIds || []);
  const visiblePathIds = new Set(
    definition ? getVisiblePathIds(definition, traversal) : (layout.paths || []).map((path: any) => path.id),
  );

  const nodeById = new Map<string, any>(
    layout.nodes.map((node: any) => [node.regionId, node]),
  );
  const renderedRegions = regions.filter((region: any) =>
    nodeById.has(region.id),
  );
  if (renderedRegions.length === 0) return false;

  listEl.className = "map-topology-board";

  const routeMarkup = (layout.paths || [])
    .map((path: any) => {
      if (!visiblePathIds.has(path.id)) return "";
      const from = nodeById.get(path.fromRegionId);
      const to = nodeById.get(path.toRegionId);
      if (!from || !to) return "";
      const isSelected =
        G.selectedRegion &&
        (G.selectedRegion.id === path.fromRegionId ||
          G.selectedRegion.id === path.toRegionId);
      const isCurrentPath =
        currentRegionId &&
        (path.fromRegionId === currentRegionId || path.toRegionId === currentRegionId);
      const evaluation =
        definition && isCurrentPath
          ? evaluatePathTraversal(definition, traversal, path, G.gs?.level || 1)
          : null;
      const isReachablePath =
        !!evaluation?.traversable;
      const isBlockedPath =
        !!evaluation && evaluation.visible && !evaluation.traversable;
      const isTraversedPath = traversedPathIds.has(path.id);
      return `
        <line
          x1="${from.x}"
          y1="${from.y}"
          x2="${to.x}"
          y2="${to.y}"
          class="map-route ${path.kind || "road"} ${path.visibility || "visible"} ${isSelected ? "selected" : ""} ${isCurrentPath ? "current" : ""} ${isReachablePath ? "reachable" : ""} ${isBlockedPath ? "blocked" : ""} ${isTraversedPath ? "traversed" : ""}"
        >
          <title>${escapeHtml(
            `${pathKindLabel(path.kind || "road")} • Difficulty ${path.difficulty || 1}${evaluation?.blockedReason ? ` • ${formatTraversalBlockedReason(evaluation.blockedReason)}` : ""}`,
          )}</title>
        </line>
      `;
    })
    .join("");

  const nodeMarkup = renderedRegions
    .map((region: any) => {
      const node = nodeById.get(region.id);
      if (!node) return "";
      const regionIndex = regions.findIndex((entry: any) => entry.id === region.id);
      const enemyList = summarizeEnemyList(region.enemyTypes || []);
      const left = ((node.x || 0) / Math.max(1, layout.width || 1)) * 100;
      const top = ((node.y || 0) / Math.max(1, layout.height || 1)) * 100;
      const selected =
        G.selectedRegion && G.selectedRegion.id === region.id ? "selected" : "";
      const isCurrent = currentRegionId === region.id;
      const isReachable = reachableRegionIds.has(region.id);
      const isDiscovered = discoveredRegionIds.has(region.id);
      const isVisited = visitedRegionIds.has(region.id);
      const isCleared = clearedRegionIds.has(region.id);
      const isLocked = lockedRegionIds.has(region.id);
      const inactive = !isCurrent && !isReachable;
      const nodeStateClasses = [
        selected,
        isCurrent ? "current" : "",
        isReachable ? "reachable" : "",
        isDiscovered ? "discovered" : "",
        isVisited ? "visited" : "",
        isCleared ? "cleared" : "",
        isLocked ? "locked" : "",
        inactive ? "inactive" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <button
          class="map-node ${nodeStateClasses}"
          style="left:${left}%; top:${top}%; --map-node-accent:${escapeHtml(node.accentColor || region.accentColor || "#4fc3f7")}"
          onclick="selectRegion(${regionIndex})"
          ${isLocked ? "disabled" : ""}
          ${isLocked ? "data-node-state=\"locked\"" : ""}
        >
          <div class="map-node-head">
            <span class="map-node-icon">${escapeHtml(node.icon || region.icon || "🗺️")}</span>
            <span class="map-node-title">${escapeHtml(region.name)}</span>
          </div>
          <div class="map-node-meta">
            <span>${escapeHtml(node.landmark || region.landmark || "Waystation")}</span>
            <span>Danger ${escapeHtml(region.dangerLevel)}</span>
          </div>
          <div class="map-node-enemies">${escapeHtml(enemyList)}</div>
          <div class="map-node-flags">
            ${node.isStart ? '<span class="map-flag start">Start</span>' : ""}
            ${node.isGoal ? '<span class="map-flag goal">Goal</span>' : ""}
            ${isCurrent ? '<span class="map-flag current">Current</span>' : ""}
            ${isReachable ? '<span class="map-flag reachable">Reachable</span>' : ""}
            ${isCleared ? '<span class="map-flag cleared">Cleared</span>' : ""}
          </div>
        </button>
      `;
    })
    .join("");

  listEl.innerHTML = `
    <div class="map-topology-canvas">
      <svg
        class="map-topology-lines"
        viewBox="0 0 ${layout.width || 1040} ${layout.height || 560}"
        preserveAspectRatio="none"
      >
        ${routeMarkup}
      </svg>
      ${nodeMarkup}
    </div>
  `;
  return true;
}

function renderRegions() {
  const listEl = document.getElementById("region-list");
  if (!listEl) return;
  listEl.innerHTML = "";
  const regions = normalizeRegions(G.regions);
  G.regions = regions;
  syncSelectedRegionFromSession();

  if (regions.length === 0) {
    listEl.className = "region-grid map-region-grid";
    listEl.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:26px 18px;color:var(--muted)">
        <div style="font-size:34px;margin-bottom:10px">🗺️</div>
        <div style="font-size:13px;font-weight:700;margin-bottom:6px">No regions loaded yet</div>
        <div style="font-size:11px;line-height:1.5">Create or load an adventure again and the world map will repopulate here.</div>
      </div>
    `;
    syncMapSelectionState();
    return;
  }

  if (renderTopologyMap(listEl, regions)) {
    syncMapSelectionState();
    return;
  }

  listEl.className = "region-grid map-region-grid";

  regions.forEach((r: any, i: number) => {
    const enemyList = summarizeEnemyList(r.enemyTypes || []);
    const card = document.createElement("div");
    const isCurrent = getCurrentRegionId() === r.id;
    const isReachable = getReachableRegionIdsForUI().includes(r.id);
    card.className = `region-card ${G.selectedRegion && G.selectedRegionIndex === i ? "selected" : ""} ${isCurrent ? "current" : ""} ${isReachable ? "reachable" : ""}`;
    card.innerHTML = `
            <div class="name">${r.name}</div>
            <div class="danger">⚠️ Danger: ${r.dangerLevel}</div>
            <div class="enemies">${enemyList}</div>
        `;
    card.onclick = () => selectRegion(i);
    listEl.appendChild(card);
  });
  syncMapSelectionState();
}

function selectRegion(i: number) {
  if (G.activeCombat) {
    showToast("Finish the current encounter before switching regions.", "info");
    return;
  }
  const region = G.regions[i];
  if (!region) return;
  G.selectedRegion = region;
  G.selectedRegionIndex = i;
  renderRegions();
  updateAllStatusBars();
  const selectedPathContext = getSelectedPathContext();
  const selectionCopy = selectedPathContext
    ? `${pathKindLabel(selectedPathContext.path.kind)} • Difficulty ${selectedPathContext.path.difficulty}. ${
        selectedPathContext.evaluation.traversable
          ? "This route is ready."
          : formatTraversalBlockedReason(selectedPathContext.evaluation.blockedReason)
      }`
    : `${G.selectedRegion.landmark || "Waystation"} • Danger ${G.selectedRegion.dangerLevel}. Explore this region to trigger story events, loot, or monster encounters.`;
  setMapEventState(
    `🧭 ${G.selectedRegion.name} is ready`,
    selectionCopy,
  );
  toggleMapCombatStage(false);
  showScreen("world");
}

// --- DOM CACHE FOR STATIC HUD ELEMENTS ---
const hudCache: Record<string, HTMLElement> = {};
function getHudEl(id: string): HTMLElement | null {
  if (hudCache[id]) return hudCache[id];
  const el = document.getElementById(id);
  if (el) hudCache[id] = el;
  return el;
}

// --- HUD ---
function updateHUD() {
  const s = G.gs;
  if (!s) return;
  const name = s.characterName || "Hero";

  const f = (id: string, v: any) => {
    const el = getHudEl(id);
    if (el && el.textContent !== String(v)) {
      el.textContent = String(v);
    }
  };

  const setBar = (id: string, pct: number) => {
    const el = getHudEl(id);
    if (el) {
      const w = Math.max(0, Math.min(100, pct)) + "%";
      if (el.style.width !== w) el.style.width = w;
    }
  };

  // ── Old HUD compat ──
  f("hud-char", `⚔️ ${name} (Lv.${s.level})`);
  f("hud-char-exp", `⚔️ ${name}`);
  f("hud-hp", s.hp);
  f("hud-maxhp", s.maxHP);
  f("hud-mp", s.mana);
  f("hud-maxmp", s.maxMana);
  f("hud-lv", s.level);
  f("hud-gold", s.gold);
  f("exp-hp", s.hp);
  f("exp-maxhp", s.maxHP);
  f("exp-mp", s.mana);
  f("exp-maxmp", s.maxMana);
  f("exp-gold", s.gold);

  // ── New 4-panel LEFT sidebar ──
  f("gp-char-name", name);
  f("gp-char-class", `Level ${s.level} Adventurer`);
  const hpPct = Math.round((s.hp / s.maxHP) * 100);
  const mpPct = Math.round((s.mana / s.maxMana) * 100);
  const expPct = Math.round((s.exp / (s.level * 100)) * 100);
  f("gp-hp-txt", `${s.hp}/${s.maxHP}`);
  f("gp-mp-txt", `${s.mana}/${s.maxMana}`);
  f("gp-exp-txt", `${s.exp}/${s.level * 100}`);
  setBar("gp-hp-bar", hpPct);
  setBar("gp-mp-bar", mpPct);
  setBar("gp-exp-bar", expPct);
  f("gp-atk", s.effectiveStats?.attack ?? 10);
  f("gp-def", s.effectiveStats?.defense ?? 5);
  f("gp-spd", s.effectiveStats?.speed ?? 8);
  f("gp-gold", s.gold);

  // ── Signature Skill Preview ──
  const skill = s.signatureSkill;
  if (skill) {
    f("gp-skill-name", skill.name);
    f(
      "gp-skill-brief",
      skill.mechanics || skill.description || "Power unknown",
    );
    const tooltip = `Full Mechanics:\n${skill.mechanics || "Unknown"}\n\nCost: ${skill.mana_cost || 0} MP\nCD: ${skill.cooldown || 0} Turns\nScaling: ${skill.scaling_stat || "N/A"}`;
    const skillBox = document.getElementById("gp-skill-preview");
    if (skillBox) skillBox.title = tooltip;
  }

  // ── EXP bar (old compat) ──
  const expPctOld = Math.round((s.exp / (s.level * 100)) * 100);
  f("exp-display", `${s.exp} / ${s.level * 100}`);
  setBar("exp-bar", expPctOld);
}

// --- CHARACTER ---
function renderCharacter() {
  const s = G.gs;
  if (!s) return;
  const hpPct = Math.round((s.hp / s.maxHP) * 100);
  const mpPct = Math.round((s.mana / s.maxMana) * 100);
  const expPct = Math.round((s.exp / (s.level * 100)) * 100);

  // New bar elements
  const f = (id: string, v: any) => {
    const el = getHudEl(id);
    if (el && el.textContent !== String(v)) el.textContent = String(v);
  };
  f("char-hp-text", `${s.hp}/${s.maxHP}`);
  f("char-mp-text", `${s.mana}/${s.maxMana}`);
  f("char-exp-text", `${s.exp}/${s.level * 100}`);
  const setBar = (id: string, pct: number) => {
    const el = getHudEl(id);
    if (el) {
      const w = pct + "%";
      if (el.style.width !== w) el.style.width = w;
    }
  };
  setBar("char-hp-bar", hpPct);
  setBar("char-mp-bar", mpPct);
  setBar("char-exp-bar", expPct);
  // Explore bars too
  f("explore-hp-text", `${s.hp}/${s.maxHP}`);
  f("explore-mp-text", `${s.mana}/${s.maxMana}`);
  setBar("explore-hp-bar", hpPct);
  setBar("explore-mp-bar", mpPct);

  const statsEl = document.getElementById("char-stats");
  // Legacy char-bars support
  const barsEl = document.getElementById("char-bars");
  if (barsEl) barsEl.innerHTML = "";

  if (statsEl)
    statsEl.innerHTML = `
        <div class="char-stat"><div class="label">Level</div><div class="value" style="color:var(--accent)">${s.level}</div></div>
        <div class="char-stat"><div class="label">Gold</div><div class="value" style="color:var(--gold)">${s.gold}</div></div>
        <div class="char-stat"><div class="label">Attack</div><div class="value" style="color:var(--red)">${s.effectiveStats.attack}</div></div>
        <div class="char-stat"><div class="label">Defense</div><div class="value" style="color:var(--green)">${s.effectiveStats.defense}</div></div>
        <div class="char-stat"><div class="label">Speed</div><div class="value" style="color:var(--accent)">${s.effectiveStats.speed}</div></div>
        <div class="char-stat"><div class="label">World Seed</div><div class="value" style="color:var(--muted);font-size:14px">${G.worldSeed}</div></div>
    `;
}

// --- INVENTORY ---
function renderInventory() {
  const s = G.gs;
  if (!s) return;
  const eq = s.equipment;
  const weaponText = eq.weapon || "— None —";
  const armorText = eq.armor || "— None —";
  const accessText = eq.accessory || "— None —";

  // Update all equipment slot elements (both inventory and character screens)
  ["inv-weapon", "eq-weapon"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = weaponText;
  });
  ["inv-armor", "eq-armor"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = armorText;
  });
  ["inv-access", "eq-access"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = accessText;
  });

  // Legacy equip-display
  const equipEl = document.getElementById("equip-display");
  if (equipEl && equipEl.children.length === 0) {
    equipEl.innerHTML = `
            <div class="equip-slot"><div class="slot-name">⚔️ Weapon</div><div class="slot-item">${weaponText}</div></div>
            <div class="equip-slot"><div class="slot-name">🛡️ Armor</div><div class="slot-item">${armorText}</div></div>
            <div class="equip-slot"><div class="slot-name">💎 Accessory</div><div class="slot-item">${accessText}</div></div>
        `;
  }

  const invEl = document.getElementById("inv-display");
  if (invEl) {
    if (s.inventory.length === 0) {
      invEl.innerHTML =
        '<p style="color:var(--muted);font-size:12px">No items yet. Explore to find loot!</p>';
    } else {
      invEl.innerHTML = s.inventory
        .map(
          (i: any) =>
            `<div class="inv-item"><span class="name">${i.itemId}</span><span class="qty">x${i.qty}</span></div>`,
        )
        .join("");
    }
  }
}

// --- EXPLORE ---
async function exploreRegion() {
  if (!G.selectedRegion) {
    showToast("Pick a region before exploring.", "info");
    return;
  }
  if (G.activeCombat) {
    showToast("Resolve the current encounter first.", "info");
    return;
  }
  const currentRegionId = getCurrentRegionId();
  const reachableRegionIds = new Set(getReachableRegionIdsForUI());
  if (
    currentRegionId &&
    G.selectedRegion.id !== currentRegionId &&
    !reachableRegionIds.has(G.selectedRegion.id)
  ) {
    showToast("That route is not reachable yet.", "info");
    return;
  }

  showScreen("world");
  setMapEventState(
    G.selectedRegion.id === currentRegionId
      ? `🧭 Exploring ${G.selectedRegion.name}`
      : `🧭 Traveling to ${G.selectedRegion.name}`,
    G.selectedRegion.id === currentRegionId
      ? "The party moves deeper into the current region. Any discovery or enemy encounter will appear here immediately."
      : "The party follows a reachable route into the selected node. Travel and the next event resolve directly on this map.",
  );
  appendSharedLog(
    '<div class="log-info">───────────────────</div>',
    ["gp-log", "event-log"],
  );
  try {
    const res = await fetch(API + "/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: G.characterId,
        regionIndex: G.selectedRegionIndex,
        regionId: G.selectedRegion.id,
      }),
    });
    const j = await res.json();
    if (!j.success) {
      appendSharedLog(
        `<div class="log-combat">Error: ${j.error}</div>`,
        ["gp-log", "event-log"],
      );
      return;
    }

    const ev = j.data;
    if (ev.gameState) {
      G.gs = ev.gameState;
      syncSelectedRegionFromSession(true);
      renderRegions();
      updateAllStatusBars();
    }

    if (ev.travel) {
      appendSharedLog(
        `<div class="log-info">🛤️ ${ev.travel.description}</div>`,
        ["gp-log", "event-log"],
      );
      if (ev.travel.hpLoss || ev.travel.manaLoss) {
        appendSharedLog(
          `<div class="log-combat">Travel toll: -${ev.travel.hpLoss || 0} HP, -${ev.travel.manaLoss || 0} MP.</div>`,
          ["gp-log", "event-log"],
        );
      }
      if (Array.isArray(ev.travel.newlyRevealedPathIds) && ev.travel.newlyRevealedPathIds.length > 0) {
        appendSharedLog(
          `<div class="log-rare">✨ New routes revealed: ${ev.travel.newlyRevealedPathIds.length}</div>`,
          ["gp-log", "event-log"],
        );
      }
    }

    if (ev.type === "enemy_encounter" && ev.enemy) {
      showCombat(ev);
    } else if (ev.type === "treasure_found") {
      G.activeCombat = null;
      toggleMapCombatStage(false);
      syncMapSelectionState();
      setMapEventState("💰 Treasure Found", ev.description);
      appendSharedLog(
        `<div class="log-treasure">💰 ${ev.description}</div>`,
        ["gp-log", "event-log"],
      );
      if (ev.treasureGold)
        appendSharedLog(
          `<div class="log-exp">+${ev.treasureGold} Gold!</div>`,
          ["gp-log", "event-log"],
        );
    } else if (ev.type === "rare_event") {
      G.activeCombat = null;
      toggleMapCombatStage(false);
      syncMapSelectionState();
      setMapEventState("✨ Rare Event", ev.description);
      appendSharedLog(
        `<div class="log-rare">✨ ${ev.description}</div>`,
        ["gp-log", "event-log"],
      );
    } else if (ev.type === "npc_encounter") {
      G.activeCombat = null;
      toggleMapCombatStage(false);
      syncMapSelectionState();
      setMapEventState("💬 Traveler Encounter", ev.description);
      appendSharedLog(
        `<div class="log-dialogue">💬 ${ev.description}</div>`,
        ["gp-log", "event-log"],
      );
    } else if (ev.type === "lore_event") {
      G.activeCombat = null;
      toggleMapCombatStage(false);
      syncMapSelectionState();
      setMapEventState(
        `📖 ${ev.loreTitle || "Ancient Scroll"}`,
        ev.loreContent || ev.description,
      );
      appendSharedLog(
        `
                <div class="log-info" style="margin: 8px 0; padding: 10px; background:rgba(79, 195, 247, 0.1); border-left: 3px solid var(--accent); border-radius: 4px">
                    <strong style="color:var(--accent)">📖 ${ev.loreTitle || "Ancient Scroll"}</strong><br/>
                    <p style="margin-top:4px; font-style:italic">${ev.loreContent || ev.description}</p>
                </div>
            `,
        ["gp-log", "event-log"],
      );
    } else if (ev.type === "ambient_event") {
      G.activeCombat = null;
      toggleMapCombatStage(false);
      syncMapSelectionState();
      setMapEventState("☁️ Ambient Event", ev.description);
      appendSharedLog(
        `<div class="log-info" style="font-style:italic; color:var(--muted)">☁️ ${ev.description}</div>`,
        ["gp-log", "event-log"],
      );
    } else if (ev.type === "rest_event") {
      G.activeCombat = null;
      toggleMapCombatStage(false);
      syncMapSelectionState();
      setMapEventState("🧘 Safe Rest", ev.description);
      appendSharedLog(
        `<div class="log-victory">🧘 ${ev.description}</div>`,
        ["gp-log", "event-log"],
      );
      if (ev.restLog)
        appendSharedLog(
          `<div class="log-exp">${ev.restLog}</div>`,
          ["gp-log", "event-log"],
        );
    } else {
      G.activeCombat = null;
      toggleMapCombatStage(false);
      syncMapSelectionState();
      setMapEventState("🗺️ Exploration Update", ev.description);
      appendSharedLog(
        `<div class="log-info">${ev.description}</div>`,
        ["gp-log", "event-log"],
      );
    }
  } catch {
    appendSharedLog(
      '<div class="log-combat">Network error</div>',
      ["gp-log", "event-log"],
    );
    setMapEventState(
      "⚠️ Exploration Error",
      "The world did not respond in time. Try exploring again.",
    );
  }
}

// --- COMBAT ---
function showCombat(ev: any) {
  const logBox = document.getElementById("combat-log");
  const resultBox = document.getElementById("combat-result");
  const titleEl = document.getElementById("combat-title");
  if (titleEl) titleEl.textContent = `⚔️ Combat — ${ev.enemy?.name || "Enemy"}`;

  if (logBox) logBox.innerHTML = "";
  if (resultBox) resultBox.innerHTML = "";
  G.activeCombat = {
    battleId: ev.battleId,
    enemy: ev.enemy,
    isFinished: false,
  };
  setMapEventState(
    `⚔️ ${ev.enemy?.name || "Enemy"} blocks the path`,
    "Combat now resolves right on the map. Use the battle controls below to finish the encounter.",
  );
  toggleMapCombatStage(true);
  syncMapSelectionState();
  syncCombatPanels();
  if (ev.combatLogs && logBox) {
    ev.combatLogs.forEach((line: string) => appendCombatLog(line));
  }
  renderCombatActions();
  showScreen("world");
}

function appendCombatLog(line: string) {
  const logBox = document.getElementById("combat-log");
  const resultBox = document.getElementById("combat-result");
  if (!logBox) return;
  const cls =
    line.includes("Victory") || line.includes("defeats")
      ? "log-victory"
      : line.includes("attacks") || line.includes("damage")
        ? "log-combat"
        : "log-info";
  appendSharedLog(`<div class="${cls}">${line}</div>`, ["combat-log", "gp-log"]);
  if (resultBox) resultBox.textContent = line;
}

function applyCombatSprite(
  el: HTMLElement | null,
  imageUrl: string,
  fallback: string,
  placeholder: string,
) {
  if (!el) return;
  el.setAttribute("data-placeholder", placeholder);
  const fallbackEl = el.querySelector(".sprite-fallback") as HTMLElement | null;
  if (fallbackEl) fallbackEl.textContent = fallback;

  if (imageUrl) {
    el.style.backgroundImage = `linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)), url("${imageUrl}")`;
    el.style.borderStyle = "solid";
    el.style.borderColor = "rgba(255,255,255,0.14)";
    if (fallbackEl) fallbackEl.style.display = "none";
    return;
  }

  el.style.backgroundImage =
    "linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.015)), rgba(9, 14, 22, 0.65)";
  el.style.borderStyle = "dashed";
  el.style.borderColor = "rgba(200, 211, 224, 0.18)";
  if (fallbackEl) fallbackEl.style.display = "";
}

function syncCombatPanels() {
  const playerNameEl = document.getElementById("combat-player-name");
  const playerLevelEl = document.getElementById("combat-player-level");
  const playerHpEl = document.getElementById("combat-player-hp");
  const playerBarEl = document.getElementById("combat-player-bar");
  const playerSpriteEl = document.getElementById("combat-player-sprite");
  const enemyNameEl = document.getElementById("combat-enemy-name");
  const enemyLevelEl = document.getElementById("combat-enemy-level");
  const enemyHpEl = document.getElementById("combat-enemy-hp");
  const enemyBarEl = document.getElementById("combat-enemy-bar");
  const enemySpriteEl = document.getElementById("combat-enemy-sprite");

  const playerName = G.gs?.characterName || "Hero";
  const playerLevel = G.gs?.level || 1;
  const playerHp = G.gs?.hp || 0;
  const playerMaxHp = G.gs?.maxHP || 1;
  const enemyName = G.activeCombat?.enemy?.name || "Enemy";
  const enemyLevel = G.activeCombat?.enemy?.level || 1;
  const enemyHp = G.activeCombat?.enemy?.hp || 0;
  const enemyMaxHp = G.activeCombat?.enemy?.maxHP || 1;
  const playerImageUrl =
    G.gs?.portraitUrl ||
    G.selectedLegend?.portrait_url ||
    G.selectedLegend?.portraitUrl ||
    G.selectedLegend?.image_url ||
    G.selectedLegend?.imageUrl ||
    "";
  const enemyImageUrl =
    G.activeCombat?.enemy?.imageUrl || G.activeCombat?.enemy?.image_url || "";

  if (playerNameEl) playerNameEl.textContent = playerName;
  if (playerLevelEl) playerLevelEl.textContent = `Lv.${playerLevel}`;
  if (playerHpEl) playerHpEl.textContent = `${playerHp}/${playerMaxHp}`;
  if (playerBarEl)
    playerBarEl.style.width = `${Math.max(0, Math.min(100, (playerHp / playerMaxHp) * 100))}%`;

  if (enemyNameEl) enemyNameEl.textContent = enemyName;
  if (enemyLevelEl) enemyLevelEl.textContent = `Lv.${enemyLevel}`;
  if (enemyHpEl) enemyHpEl.textContent = `${enemyHp}/${enemyMaxHp}`;
  if (enemyBarEl)
    enemyBarEl.style.width = `${Math.max(0, Math.min(100, (enemyHp / enemyMaxHp) * 100))}%`;

  applyCombatSprite(playerSpriteEl, playerImageUrl, "🧙", "Hero Art Slot");
  applyCombatSprite(enemySpriteEl, enemyImageUrl, "👾", "Dev Monster Art Slot");
}

function renderCombatActions() {
  const resultBox = document.getElementById("combat-result");
  const actionBox = document.getElementById("combat-actions");
  if (!resultBox || !actionBox) return;

  if (!G.activeCombat) {
    resultBox.textContent = "";
    actionBox.innerHTML = "";
    toggleMapCombatStage(false);
    syncMapSelectionState();
    return;
  }

  if (G.activeCombat.isFinished) {
    resultBox.textContent = "Battle complete. Choose your next move.";
    actionBox.innerHTML = `
      <button class="battle-action-btn primary" id="btn-post-combat-explore">
        <strong>Continue</strong>
        <span>Return to the current region</span>
      </button>
      <button class="battle-action-btn" id="btn-post-combat-stats">
        <strong>Party</strong>
        <span>Review your hero and gear</span>
      </button>
      <button class="battle-action-btn" disabled title="Planned for a future update">
        <strong>Capture</strong>
        <span>Reserved for monster systems</span>
      </button>
      <button class="battle-action-btn" disabled title="Wire monster art from the dev panel here later">
        <strong>Link Art</strong>
        <span>Future dev image integration slot</span>
      </button>`;
    document
      .getElementById("btn-post-combat-explore")
      ?.addEventListener("click", () => {
        G.activeCombat = null;
        toggleMapCombatStage(false);
        syncMapSelectionState();
        setMapEventState(
          G.selectedRegion
            ? `🧭 ${G.selectedRegion.name} is clear for now`
            : "🗺️ The path is clear",
          "The encounter is over. Explore again or pick a different region.",
        );
        showScreen("world");
      });
    document
      .getElementById("btn-post-combat-stats")
      ?.addEventListener("click", () => {
        showScreen("character");
      });
    return;
  }

  if (!resultBox.textContent?.trim()) {
    resultBox.textContent = `${G.activeCombat.enemy?.name || "Enemy"} stands ready. Choose a command.`;
  }
  actionBox.innerHTML = `
    <button class="battle-action-btn primary" id="btn-combat-attack">
      <strong>Attack</strong>
      <span>Resolve one turn right now</span>
    </button>
    <button class="battle-action-btn" id="btn-combat-skill" disabled title="Skill commands are coming soon">
      <strong>Skill</strong>
      <span>Future active abilities</span>
    </button>
    <button class="battle-action-btn" id="btn-combat-bag" disabled title="Bag support is planned">
      <strong>Bag</strong>
      <span>Items and consumables later</span>
    </button>
    <button class="battle-action-btn" id="btn-combat-retreat" disabled title="Retreat is not enabled yet">
      <strong>Run</strong>
      <span>Escape options later</span>
    </button>`;
  document
    .getElementById("btn-combat-attack")
    ?.addEventListener("click", executeCombatTurn);
}

async function executeCombatTurn() {
  if (!G.characterId || !G.activeCombat?.battleId) return;
  const actionButtons = Array.from(
    document.querySelectorAll("#combat-actions button"),
  ) as HTMLButtonElement[];
  const attackBtn = document.getElementById("btn-combat-attack") as
    | HTMLButtonElement
    | null;
  actionButtons.forEach((btn) => {
    btn.disabled = true;
  });
  if (attackBtn) {
    attackBtn.innerHTML =
      "<strong>Resolving...</strong><span>Processing this turn</span>";
  }

  try {
    const res = await fetch(API + "/combat/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: G.characterId }),
    });
    const j = await res.json();
    if (!j.success) {
      appendCombatLog(`Combat error: ${j.error || "Unknown error"}`);
      return;
    }

    G.gs = j.data.gameState || G.gs;
    G.activeCombat.enemy = j.data.enemy;
    G.activeCombat.isFinished = j.data.isFinished;

    syncSelectedRegionFromSession(true);
    renderRegions();
    updateAllStatusBars();
    syncCombatPanels();
    (j.data.logs || []).forEach((line: string) => appendCombatLog(line));

    if (j.data.isFinished) {
      if (j.data.rewards?.exp || j.data.rewards?.gold) {
        appendCombatLog(
          `Rewards: +${j.data.rewards.exp || 0} EXP, +${j.data.rewards.gold || 0} Gold`,
        );
      }
      syncMapSelectionState();
    }
    renderCombatActions();
  } catch {
    appendCombatLog("Network error while resolving turn.");
  } finally {
    if (attackBtn && !G.activeCombat?.isFinished) {
      attackBtn.disabled = false;
      attackBtn.innerHTML =
        "<strong>Attack</strong><span>Resolve one turn right now</span>";
    }
  }
}

(window as any).selectRegion = selectRegion;
