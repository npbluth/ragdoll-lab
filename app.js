const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const headSvgImage = new Image();
headSvgImage.src = "head.svg";
const headPngFiles = ["fish.png", "head2.png", "skull.png", "tomato.png"];
const headPngImages = headPngFiles.map((src) => {
  const image = new Image();
  image.src = src;
  return image;
});

const baseGravity = 0.35;
const damping = 0.992;
const floorBounce = 0.35;
const floorFriction = 0.78;
const physicsIterations = 8;
const MAX_EFFECTS = 2200;

// Arcade repair bill: charge only health actually lost, never excess damage.
const DAMAGE_DOLLARS_PER_HP = 2500;
let damageBill = 0;
function chargeDamage(object, amount, minimumHp = 0) {
  if (!object || !Number.isFinite(amount) || amount <= 0) return;
  const before = Math.max(0, object.hp);
  object.hp = Math.max(minimumHp, before - amount);
  damageBill += Math.max(0, before - object.hp) * DAMAGE_DOLLARS_PER_HP;
}


const nodes = [];
const constraints = [];
const obstacles = [];
const props = [];
const effects = [];
const projectiles = [];
const cars = [];
const bombs = [];
const anvils = [];
const titaniumBalls = [];
const launchedGrenades = [];
const bungeeRopes = [];
const lava = {
  active: false,
  level: 0,
  risePerFrame: 0.16,
};
const tsunami = {
  active: false,
  side: "left",
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  speed: 0,
  pushForce: 0,
  curveDepth: 0,
};
const nuclearBlast = {
  active: false,
  detonated: false,
  startAt: 0,
  x: 0,
  y: 0,
  blastRadius: 0,
};
const saw = {
  active: false,
  x: 0,
  y: 0,
  radius: 132,
  angle: 0,
  speed: 0.21,
  spinDirection: 1,
};
const SUPER_RAGDOLL_ID = -9999;
const ragdollScale = 0.75;
const keyboardState = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
};
const superRagdoll = {
  active: false,
  refs: null,
  directionX: 1,
  directionY: 0,
  punchSide: "right",
};

function isHeadSvgReady() {
  return headSvgImage.complete && headSvgImage.naturalWidth > 0 && headSvgImage.naturalHeight > 0;
}

function getLoadedHeadPngImages() {
  return headPngImages.filter((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
}

function pickRandomHeadImage() {
  if (!headPngImages.length) {
    return null;
  }
  return headPngImages[Math.floor(Math.random() * headPngImages.length)];
}

function getNodeHeadImage(node) {
  if (!node || node.part !== "head") {
    return null;
  }
  if (node.headImage && node.headImage.complete && node.headImage.naturalWidth > 0 && node.headImage.naturalHeight > 0) {
    return node.headImage;
  }
  if (isHeadSvgReady()) {
    return headSvgImage;
  }
  return null;
}

const pointer = {
  x: 0,
  y: 0,
  prevX: 0,
  prevY: 0,
  down: false,
  grabbedNode: null,
  grabOffsetX: 0,
  grabOffsetY: 0,
};
const bungeeState = {
  pendingTarget: null,
};

const toolConfigs = {
  hand: {
    name: "Trainer Hand",
    range: 0,
    force: 0,
    color: "#f8fafc",
    mode: "drag",
    cooldownMs: 0,
    specialMs: 0,
  },
  "health-boost": {
    name: "Health Boost",
    range: 0,
    force: 0,
    color: "#22c55e",
    mode: "heal",
    cooldownMs: 0,
    specialMs: 0,
  },
  "explosive-touch": {
    name: "Explosive Touch",
    range: 140,
    force: 3.8,
    color: "#f97316",
    mode: "explode-touch",
    cooldownMs: 0,
    specialMs: 0,
  },
  "bungee-rope": {
    name: "Bungee Rope",
    range: 0,
    force: 0,
    color: "#7f1d1d",
    mode: "bungee-connect",
    cooldownMs: 0,
    specialMs: 0,
  },
  "nuclear-bomb": {
    name: "Nuclear Bomb",
    range: 0,
    force: 0,
    color: "#f8fafc",
    mode: "nuclear",
    cooldownMs: 0,
    specialMs: 0,
  },
  "anvil-dropper": {
    name: "Anvil Dropper",
    range: 0,
    force: 0,
    color: "#9ca3af",
    mode: "anvil-drop",
    cooldownMs: 0,
    specialMs: 0,
  },
  "water-lance": {
    name: "Black Hole",
    range: 440,
    force: 1.7,
    color: "#22d3ee",
    mode: "black-hole",
    cooldownMs: 2100,
    specialMs: 380,
  },
  "psychic-bat": {
    name: "Psychic Bat",
    range: 110,
    force: 2.9,
    color: "#c084fc",
    mode: "spin",
    cooldownMs: 1900,
    specialMs: 320,
  },
  "gravity-reverser": {
    name: "Gravity Reverser",
    range: 0,
    force: 0,
    color: "#38bdf8",
    mode: "gravity-reverse",
    cooldownMs: 0,
    specialMs: 0,
  },
  "ranger-shotgun": {
    name: "Ranger Shotgun",
    range: 0,
    force: 0,
    color: "#e5e7eb",
    mode: "scatter",
    cooldownMs: 0,
    specialMs: 0,
    fireRateMs: 650,
    projectileSpeed: 12,
    projectileLife: 34,
    impactForce: 2.1,
    projectileRadius: 3,
    pellets: 6,
    spread: 0.36,
  },
  "rocket-launcher": {
    name: "Rocket Launcher",
    range: 0,
    force: 0,
    color: "#f97316",
    mode: "rocket",
    cooldownMs: 0,
    specialMs: 0,
    fireRateMs: 900,
    projectileSpeed: 8.8,
    projectileLife: 84,
    impactForce: 1.4,
    projectileRadius: 6,
    explosiveRadius: 165,
    explosiveForce: 14.8,
    explosiveDamage: 124,
  },
  "grenade-launcher": {
    name: "Grenade Launcher",
    range: 0,
    force: 0,
    color: "#84cc16",
    mode: "grenade",
    cooldownMs: 0,
    specialMs: 0,
    fireRateMs: 10,
    projectileSpeed: 7.2,
    projectileLife: 72,
    impactForce: 1,
    projectileRadius: 7,
    explosiveRadius: 145,
    explosiveForce: 30,
    explosiveDamage: 28,
  },
};

const toolState = {};
Object.keys(toolConfigs).forEach((key) => {
  toolState[key] = {
    lastSpecialAt: -Infinity,
    specialUntil: -Infinity,
    lastShotAt: -Infinity,
  };
});

const baseBuilds = {
  pikachu: {
    name: "Human A",
    headRadius: 17,
    torsoScale: 1,
    shoulderWidth: 1.02,
    hipWidth: 0.9,
    armLength: 1,
    forearmLength: 0.98,
    legLength: 1,
    shinLength: 0.98,
    neckLength: 0.82,
    stanceWidth: 0.92,
    body: ["#f1c27d", "#2563eb", "#1d4ed8", "#111827"],
    accents: ["#0f172a", "#e5e7eb"],
    earHeight: 0.22,
  },
  squirtle: {
    name: "Human B",
    headRadius: 16,
    torsoScale: 1.06,
    shoulderWidth: 0.96,
    hipWidth: 0.94,
    armLength: 0.96,
    forearmLength: 0.95,
    legLength: 0.99,
    shinLength: 0.97,
    neckLength: 0.76,
    stanceWidth: 0.9,
    body: ["#d39a6b", "#be185d", "#9d174d", "#1f2937"],
    accents: ["#111827", "#f8fafc"],
    earHeight: 0.2,
  },
  mewtwo: {
    name: "Human C",
    headRadius: 18,
    torsoScale: 0.98,
    shoulderWidth: 1.08,
    hipWidth: 0.88,
    armLength: 1.05,
    forearmLength: 1.02,
    legLength: 1.04,
    shinLength: 1,
    neckLength: 0.88,
    stanceWidth: 0.95,
    body: ["#8d5524", "#0f766e", "#115e59", "#0b1020"],
    accents: ["#0f172a", "#e2e8f0"],
    earHeight: 0.24,
  },
};

let activeTool = "hand";
let width = 0;
let height = 0;
let lastFrameMs = performance.now();
let ragdollRefsList = [];
let ragdollStates = [];
let ragdollCount = 2;
let aimAngle = 0;
let simulationTick = 0;
let gravityMultiplier = 1;
let frameNow = performance.now();
let fightModeEnabled = true;
let blackHoleReverseEnabled = false;
const wakeDamageThreshold = 42;
const minimumHitsBeforeWake = 4;
const carCooldownMs = 2200;
let lastCarSpawnAt = -Infinity;
const bombFuseMs = 10000;
const grenadeLauncherFuseMs = 1000;

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function hslToHex(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c * 0.5;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hh < 60) {
    r = c;
    g = x;
  } else if (hh < 120) {
    r = x;
    g = c;
  } else if (hh < 180) {
    g = c;
    b = x;
  } else if (hh < 240) {
    g = x;
    b = c;
  } else if (hh < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function createRandomRagdollStyle() {
  const buildKeys = Object.keys(baseBuilds);
  const variantKey = buildKeys[Math.floor(Math.random() * buildKeys.length)];
  const base = baseBuilds[variantKey];
  // Keep variation within an adult humanoid silhouette.
  const girthScale = randomRange(0.94, 1.08);
  const bellyScale = randomRange(0.92, 1.04);
  const massScale = randomRange(0.92, 1.16);

  const skin = hslToHex(randomRange(20, 34), randomRange(38, 58), randomRange(42, 74));
  const shirtHue = randomRange(0, 360);
  const pantsHue = (shirtHue + randomRange(-58, 58) + 360) % 360;
  const shirt = hslToHex(shirtHue, randomRange(52, 84), randomRange(30, 50));
  const pants = hslToHex(pantsHue, randomRange(48, 74), randomRange(24, 42));
  const shoes = hslToHex(randomRange(205, 245), randomRange(18, 45), randomRange(7, 18));

  return {
    variantKey,
    headRadius: randomRange(12.5, 14),
    torsoScale: Math.max(0.9, Math.min(1.16, base.torsoScale + randomRange(-0.06, 0.06))),
    shoulderWidth: Math.max(0.88, Math.min(1.18, base.shoulderWidth + randomRange(-0.07, 0.07))),
    hipWidth: Math.max(0.84, Math.min(1.06, base.hipWidth + randomRange(-0.05, 0.06))),
    armLength: Math.max(0.9, Math.min(1.12, base.armLength + randomRange(-0.05, 0.05))),
    forearmLength: Math.max(0.9, Math.min(1.1, base.forearmLength + randomRange(-0.05, 0.05))),
    legLength: randomRange(1.18, 1.26),
    shinLength: randomRange(1.16, 1.24),
    neckLength: Math.max(0.66, Math.min(0.94, base.neckLength + randomRange(-0.05, 0.05))),
    stanceWidth: Math.max(0.84, Math.min(1.04, base.stanceWidth + randomRange(-0.05, 0.05))),
    body: [skin, shirt, pants, shoes],
    accents: [hslToHex(shirtHue, 32, 14), hslToHex(shirtHue, 28, 90)],
    earHeight: Math.max(0.14, Math.min(0.34, base.earHeight + randomRange(-0.05, 0.05))),
    girthScale,
    bellyScale,
    massScale,
  };
}

function createNode(x, y, radius, color, mass = 1, pinned = false) {
  const maxHp = 55 + radius * 4 + mass * 18;
  return {
    x,
    y,
    oldX: x,
    oldY: y,
    radius,
    color,
    mass,
    pinned,
    hp: maxHp,
    maxHp,
    destroyed: false,
    lastImpactTick: -1,
    damageDecals: [],
    hitFlash: 0,
    lastDamageDecalTick: -1,
  };
}

function getStyleStandingMetrics(style) {
  const torso = style?.torsoScale ?? 1;
  const neckLength = style?.neckLength ?? 0.8;
  const legLength = style?.legLength ?? 1;
  const shinLength = style?.shinLength ?? 1;
  const headLift = (18 + 18 * neckLength) * torso;
  const footRadius = 9;
  const footDepth = 66 * torso + 50 * torso * legLength + 50 * torso * shinLength + footRadius;
  return {
    headLift,
    footDepth,
  };
}

function getStyleBaseYAtGround(style, floorY = height - 24) {
  const { footDepth } = getStyleStandingMetrics(style);
  return Math.max(96, floorY - footDepth);
}

function createConstraint(a, b, stiffness = 1) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return {
    a,
    b,
    length: Math.hypot(dx, dy),
    stiffness,
    baseStiffness: stiffness,
    broken: false,
  };
}

function addNode(node) {
  nodes.push(node);
  return node;
}

function addConstraint(a, b, stiffness = 1) {
  constraints.push(createConstraint(a, b, stiffness));
}

function getNodeIntegrity(node) {
  return Math.max(0, node.hp / node.maxHp);
}

function getRagdollState(ragdollId) {
  return ragdollStates[ragdollId];
}

function isSuperRagdollNode(node) {
  return node?.ragdollId === SUPER_RAGDOLL_ID;
}

function clearSuperRagdoll() {
  superRagdoll.active = false;
  superRagdoll.refs = null;
  superRagdoll.directionX = 1;
  superRagdoll.directionY = 0;
  superRagdoll.punchSide = "right";
}

function purgeSuperRagdoll() {
  const refs = superRagdoll.refs;
  if (!refs) {
    clearSuperRagdoll();
    return;
  }

  const superNodes = new Set(Array.isArray(refs.allNodes) ? refs.allNodes : []);
  for (let i = constraints.length - 1; i >= 0; i -= 1) {
    if (superNodes.has(constraints[i].a) || superNodes.has(constraints[i].b)) {
      constraints.splice(i, 1);
    }
  }

  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    if (superNodes.has(nodes[i])) {
      nodes.splice(i, 1);
    }
  }

  for (let i = ragdollRefsList.length - 1; i >= 0; i -= 1) {
    if (ragdollRefsList[i] === refs) {
      ragdollRefsList.splice(i, 1);
    }
  }

  for (let i = bungeeRopes.length - 1; i >= 0; i -= 1) {
    if (superNodes.has(bungeeRopes[i].a) || superNodes.has(bungeeRopes[i].b)) {
      bungeeRopes.splice(i, 1);
    }
  }

  if (pointer.grabbedNode && superNodes.has(pointer.grabbedNode)) {
    pointer.grabbedNode = null;
    pointer.grabOffsetX = 0;
    pointer.grabOffsetY = 0;
  }

  clearSuperRagdoll();
}

function updateFightModeAvailability() {
  const fightModeToggle = document.getElementById("fightModeToggle");
  const tooManyRagdolls = ragdollStates.length > 8;

  if (tooManyRagdolls) {
    fightModeEnabled = false;
  }

  if (fightModeToggle) {
    fightModeToggle.disabled = tooManyRagdolls;
    fightModeToggle.checked = fightModeEnabled;
  }
}

function wakeRagdoll(ragdollId) {
  const state = getRagdollState(ragdollId);
  if (!state || state.mode === "ragdoll") {
    return;
  }

  state.mode = "ragdoll";
  for (const node of nodes) {
    if (node.ragdollId !== ragdollId) {
      continue;
    }
    node.pinned = false;
  }
}

function setRagdollStanding(ragdollId) {
  const state = getRagdollState(ragdollId);
  if (!state) {
    return;
  }

  state.mode = "standing";
  state.damageTaken = 0;
  state.hitCount = 0;
  state.stagger = 0;
  state.lastRegisteredHitTick = -1;
  state.gravityReverseUntil = -Infinity;
  state.walkX = 0;

  for (const node of nodes) {
    if (node.ragdollId !== ragdollId) {
      continue;
    }

    node.poseX = null;
    node.poseY = null;
    if (node.destroyed) {
      node.pinned = false;
      continue;
    }

    node.hp = node.maxHp;
    node.damageDecals = [];
    node.hitFlash = 0;
    node.pinned = true;
    node.x = node.standX ?? node.x;
    node.y = node.standY ?? node.y;
    node.oldX = node.x;
    node.oldY = node.y;
  }
}

function reverseRagdollGravity(ragdollId, durationMs = 3000) {
  const state = getRagdollState(ragdollId);
  if (!state) {
    return;
  }
  wakeRagdoll(ragdollId);
  state.gravityReverseUntil = Math.max(state.gravityReverseUntil || -Infinity, frameNow + durationMs);
}

function getStandingOffset(part, sway, bob) {
  if (part === "footL" || part === "footR") {
    return { x: 0, y: 0 };
  }
  if (part === "kneeL") {
    return { x: sway * 0.12, y: bob * 0.2 };
  }
  if (part === "kneeR") {
    return { x: -sway * 0.12, y: bob * 0.2 };
  }
  if (part === "hips") {
    return { x: sway * 0.45, y: bob * 0.8 };
  }
  if (part === "belly") {
    return { x: sway * 0.6, y: bob * 0.95 };
  }
  if (part === "chest") {
    return { x: sway * 0.75, y: bob * 1.1 };
  }
  if (part === "neck" || part === "head") {
    return { x: sway, y: bob * 1.35 };
  }
  if (part === "shoulderL" || part === "elbowL" || part === "handL") {
    return { x: sway * 0.45, y: -bob * 0.5 };
  }
  if (part === "shoulderR" || part === "elbowR" || part === "handR") {
    return { x: sway * 0.45, y: bob * 0.5 };
  }
  if (part === "earL" || part === "earR") {
    return { x: sway * 1.2, y: bob * 1.8 };
  }
  return { x: sway * 0.3, y: bob * 0.5 };
}

function isRangedTool(toolKey) {
  const tool = toolConfigs[toolKey];
  if (!tool) {
    return false;
  }
  return (
    tool.mode === "projectile" ||
    tool.mode === "scatter" ||
    tool.mode === "rocket" ||
    tool.mode === "grenade"
  );
}

function getShooterAnchor() {
  return {
    x: Math.max(72, width * 0.12),
    y: Math.min(height - 84, height * 0.74),
  };
}

function getDraggedRagdollId() {
  if (!pointer.down || activeTool !== "hand" || !pointer.grabbedNode) {
    return -1;
  }
  return pointer.grabbedNode.ragdollId ?? -1;
}

function spawnCar(now = frameNow) {
  if (now - lastCarSpawnAt < carCooldownMs) {
    return false;
  }

  lastCarSpawnAt = now;
  const fromLeft = Math.random() > 0.5;
  const direction = fromLeft ? 1 : -1;
  const w = 250;
  const h = 78;
  cars.push({
    x: fromLeft ? -w - 12 : width + 12,
    y: height - 24 - h - 2,
    w,
    h,
    direction,
    speed: 11.8 + Math.random() * 2.8,
    impactForce: 18,
    impactDamage: 24,
    hitTick: -1,
    color: fromLeft ? "#dc2626" : "#0284c7",
  });
  return true;
}

function placeBomb(now = frameNow) {
  const x = Math.max(28, Math.min(width - 28, pointer.x || width * 0.5));
  const y = Math.max(28, Math.min(height - 80, pointer.y || height * 0.45));
  bombs.push({
    x,
    y,
    oldX: x,
    oldY: y,
    radius: 15,
    fuseEndAt: now + bombFuseMs,
    color: "#ef4444",
  });
}

function launchGrenade(x, y, tool, now = frameNow) {
  launchedGrenades.push({
    x,
    y,
    oldX: x,
    oldY: y - 1,
    radius: Math.max(6, tool.projectileRadius || 7),
    fuseEndAt: now + grenadeLauncherFuseMs,
    explosiveRadius: tool.explosiveRadius || 110,
    explosiveForce: tool.explosiveForce || 7.5,
    explosiveDamage: tool.explosiveDamage || 56,
    color: tool.color || "#84cc16",
  });
}

function dropAnvil(x = pointer.x, y = pointer.y) {
  const clampedX = Math.max(24, Math.min(width - 24, x || width * 0.5));
  const spawnY = Math.max(28, Math.min(height - 120, (y || height * 0.5) - 170));
  anvils.push({
    kind: "anvil",
    x: clampedX,
    y: spawnY,
    oldX: clampedX,
    oldY: spawnY - 4,
    radius: 23,
    mass: 7.2,
    impactForce: 14,
    impactDamage: 36,
  });
}

function launchTitaniumBall() {
  const fromLeft = Math.random() > 0.5;
  const direction = fromLeft ? 1 : -1;
  const x = fromLeft ? 30 : width - 30;
  const y = Math.max(72, Math.min(height - 130, 90 + Math.random() * (height * 0.42)));
  const speed = 22 + Math.random() * 7;
  titaniumBalls.push({
    kind: "titanium-ball",
    x,
    y,
    oldX: x - direction * speed,
    oldY: y + (Math.random() - 0.5) * 4,
    radius: 20,
    mass: 5.4,
    bounce: 1.08,
    minSpeed: 22,
    maxSpeed: 42,
    hitTick: -1,
    impactDamage: 11,
    impactForce: 24,
  });
}

function spawnSixSeven(x = pointer.x, y = pointer.y) {
  const w = 94;
  const h = 74;
  const defaultX = width * 0.5 - w * 0.5;
  const defaultY = height * 0.36 - h * 0.5;
  const spawnX = Math.max(14, Math.min(width - 14 - w, (x ?? defaultX + w * 0.5) - w * 0.5));
  const spawnY = Math.max(14, Math.min(height - 24 - h, (y ?? defaultY + h * 0.5) - h * 0.5));
  obstacles.push({
    type: "six-seven",
    x: spawnX,
    y: spawnY,
    w,
    h,
    hp: 180,
    maxHp: 180,
    melted: false,
    color: "#facc15",
    border: "#b45309",
    impactForce: 2.8,
    impactDamageScale: 3.2,
    kinematicVX: 0,
    kinematicVY: 0,
  });
}

function spawnDropCar(x = pointer.x, y = pointer.y) {
  const w = 220;
  const h = 78;
  const defaultX = width * 0.58 - w * 0.5;
  const defaultY = height * 0.45 - h * 0.5;
  const spawnX = Math.max(14, Math.min(width - 14 - w, (x ?? defaultX + w * 0.5) - w * 0.5));
  const spawnY = Math.max(14, Math.min(height - 24 - h, (y ?? defaultY + h * 0.5) - h * 0.5));
  obstacles.push({
    type: "drop-car",
    x: spawnX,
    y: spawnY,
    oldX: spawnX,
    oldY: spawnY - 2,
    w,
    h,
    hp: 420,
    maxHp: 420,
    melted: false,
    color: "#f43f5e",
    border: "#831843",
    impactForce: 4.1,
    impactDamageScale: 4.8,
    kinematicVX: 0,
    kinematicVY: 0,
    dynamic: true,
    bounce: 0.28,
    drag: 0.992,
  });
}

function spawnSawBlade() {
  saw.active = true;
  saw.x = width;
  saw.y = Math.max(120, Math.min(height - 130, height * 0.58));
  saw.radius = Math.max(110, Math.min(150, width * 0.11));
  saw.angle = 0;
  saw.speed = 0.21;
  saw.spinDirection = 1;
}

function hasIntactConstraint(a, b) {
  for (const c of constraints) {
    if (c.broken) {
      continue;
    }
    if ((c.a === a && c.b === b) || (c.a === b && c.b === a)) {
      return true;
    }
  }
  return false;
}

function breakConstraintsForNode(node) {
  for (const c of constraints) {
    if (c.broken) {
      continue;
    }
    if (c.a === node || c.b === node) {
      c.broken = true;
    }
  }
}

function addDamageDecal(node, amount, effectColor = "#ef4444") {
  if (!node || node.destroyed || amount < 1.2) {
    return;
  }

  if (simulationTick - node.lastDamageDecalTick < 2 && amount < 8) {
    return;
  }
  node.lastDamageDecalTick = simulationTick;

  const severity = Math.max(0.15, Math.min(1, amount / Math.max(8, node.maxHp * 0.2)));
  const markCount = amount > 10 ? 2 : 1;
  for (let i = 0; i < markCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const offset = node.radius * (0.12 + Math.random() * 0.56);
    const isScorch = effectColor === "#f97316" || effectColor === "#fb7185";
    node.damageDecals.push({
      kind: isScorch ? "scorch" : Math.random() < 0.55 ? "scratch" : "bruise",
      angle,
      x: Math.cos(angle) * offset,
      y: Math.sin(angle) * offset,
      size: node.radius * (0.2 + Math.random() * 0.45) * (0.55 + severity * 0.8),
      alpha: 0.18 + severity * 0.42,
      color: isScorch ? "rgba(120, 53, 15, 0.65)" : "rgba(127, 29, 29, 0.58)",
    });
  }

  if (node.damageDecals.length > 9) {
    node.damageDecals.splice(0, node.damageDecals.length - 9);
  }
}

function triggerImpactVisual(node, amount, effectColor = "#ef4444") {
  if (!node || amount <= 0) {
    return;
  }

  const flash = Math.max(0.12, Math.min(0.9, amount / 26));
  node.hitFlash = Math.min(1, Math.max(node.hitFlash || 0, flash));

  if (amount > 2.4) {
    effects.push({
      type: "impact",
      x: node.x,
      y: node.y,
      radius: node.radius * (1.05 + Math.random() * 0.35),
      maxRadius: node.radius * (1.9 + Math.random() * 0.8),
      life: 8,
      maxLife: 8,
      color: effectColor,
    });
  }
}

function applyDamageToNode(node, amount, effectColor = "#ef4444") {
  if (!node || node.destroyed || amount <= 0) {
    return;
  }

  const state = getRagdollState(node.ragdollId);
  if (state && state.mode === "standing") {
    wakeRagdoll(node.ragdollId);
  }

  addDamageDecal(node, amount, effectColor);
  triggerImpactVisual(node, amount, effectColor);

  const prevIntegrity = getNodeIntegrity(node);
  chargeDamage(node, amount);
  const nextIntegrity = getNodeIntegrity(node);

  if (prevIntegrity >= 0.66 && nextIntegrity < 0.66) {
    spawnBreakEffect(node.x, node.y, effectColor);
  } else if (prevIntegrity >= 0.33 && nextIntegrity < 0.33) {
    spawnBreakEffect(node.x, node.y, effectColor);
  }

  if (node.hp <= 0 && !node.severed) {
    // Keep parts visible/physical at 0 HP; only sever their joints once.
    node.severed = true;
    breakConstraintsForNode(node);
    spawnBreakEffect(node.x, node.y, "#7f1d1d");
  }
}

function updateConstraintFractures() {
  for (const c of constraints) {
    if (c.broken) {
      continue;
    }

    const dx = c.b.x - c.a.x;
    const dy = c.b.y - c.a.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const strain = dist / c.length;
    const damageFactor =
      ((1 - getNodeIntegrity(c.a)) + (1 - getNodeIntegrity(c.b))) * 0.5;
    const breakThreshold = 1.85 - damageFactor * 0.65;

    const fatigueSnap = damageFactor > 0.72 && strain > 1.05;
    if (strain > breakThreshold || fatigueSnap || c.a.destroyed || c.b.destroyed) {
      c.broken = true;
    }
  }
}

function createRagdollInstance(centerX, baseY, preset, presetId, ragdollId, options = {}) {
  const isMaster = Boolean(options.master);
  const isSuper = Boolean(options.super);
  const torso = preset.torsoScale;
  const shoulderWidth = preset.shoulderWidth ?? 1;
  const hipWidth = preset.hipWidth ?? 0.92;
  const armLength = preset.armLength ?? 1;
  const forearmLength = preset.forearmLength ?? 1;
  const legLength = preset.legLength ?? 1;
  const shinLength = preset.shinLength ?? 1;
  const neckLength = preset.neckLength ?? 0.8;
  const stanceWidth = preset.stanceWidth ?? 0.92;
  const headR = preset.headRadius;
  const girth = preset.girthScale ?? 1;
  const bellyScale = preset.bellyScale ?? 1;
  const massScale = preset.massScale ?? 1;
  const upperBodyRadius = 15 * torso * girth;
  const bellyRadius = 10 * torso * girth * bellyScale;
  const hipsRadius = 12 * torso * (0.9 + girth * 0.1);
  const shoulderOffsetX = 29 * shoulderWidth;
  const hipLegOffsetX = 17 * stanceWidth;
  const footOffsetX = 20 * stanceWidth;
  const upperArmX = 6 * shoulderWidth * armLength;
  const upperArmY = 37 * torso * armLength;
  const lowerArmX = 3 * shoulderWidth * forearmLength;
  const lowerArmY = 35 * torso * forearmLength;
  const upperLegY = 50 * torso * legLength;
  const lowerLegY = 50 * torso * shinLength;
  const neckY = 10 + 10 * neckLength;
  const headLift = 18 + 18 * neckLength;

  const head = addNode(createNode(centerX, baseY - headLift * torso, headR, preset.body[0], 1 * massScale));
  head.headImage = pickRandomHeadImage();
  const neck = addNode(createNode(centerX, baseY - neckY * torso, 5.8, preset.body[0], 0.95 * massScale));
  const chest = addNode(createNode(centerX, baseY + 2 * torso, upperBodyRadius, preset.body[1], 1.16 * massScale));
  const belly = addNode(createNode(centerX, baseY + 34 * torso, bellyRadius, preset.body[1], 1.1 * massScale));
  const hips = addNode(createNode(centerX, baseY + 66 * torso, hipsRadius, preset.body[2], 1.16 * massScale));

  const shoulderL = addNode(createNode(centerX - shoulderOffsetX, baseY - 1 * torso, 8.4, preset.body[0], 0.93 * massScale));
  const elbowL = addNode(createNode(centerX - shoulderOffsetX - upperArmX, baseY + upperArmY, 7.3, preset.body[0], 0.88 * massScale));
  const handL = addNode(createNode(centerX - shoulderOffsetX - upperArmX - lowerArmX, baseY + upperArmY + lowerArmY, 6.2, preset.body[0], 0.82 * massScale));

  const shoulderR = addNode(createNode(centerX + shoulderOffsetX, baseY - 1 * torso, 8.4, preset.body[0], 0.93 * massScale));
  const elbowR = addNode(createNode(centerX + shoulderOffsetX + upperArmX, baseY + upperArmY, 7.3, preset.body[0], 0.88 * massScale));
  const handR = addNode(createNode(centerX + shoulderOffsetX + upperArmX + lowerArmX, baseY + upperArmY + lowerArmY, 6.2, preset.body[0], 0.82 * massScale));

  const kneeL = addNode(createNode(centerX - hipLegOffsetX * hipWidth, baseY + 66 * torso + upperLegY, 8.8, preset.body[2], 1.06 * massScale));
  const footL = addNode(createNode(centerX - footOffsetX * hipWidth, baseY + 66 * torso + upperLegY + lowerLegY, 8.4, preset.body[3], 1.04 * massScale));
  const kneeR = addNode(createNode(centerX + hipLegOffsetX * hipWidth, baseY + 66 * torso + upperLegY, 8.8, preset.body[2], 1.06 * massScale));
  const footR = addNode(createNode(centerX + footOffsetX * hipWidth, baseY + 66 * torso + upperLegY + lowerLegY, 8.4, preset.body[3], 1.04 * massScale));

  const earSpread = Math.max(6, headR * 0.64);
  const earY = head.y - headR * (0.2 + Math.max(0.12, preset.earHeight) * 0.25);
  const earL = addNode(createNode(centerX - earSpread, earY, 4.2, preset.body[0], 0.38));
  const earR = addNode(createNode(centerX + earSpread, earY, 4.2, preset.body[0], 0.38));
  head.neckNode = neck;
  head.part = "head";
  neck.part = "neck";
  chest.part = "chest";
  belly.part = "belly";
  hips.part = "hips";
  shoulderL.part = "shoulderL";
  elbowL.part = "elbowL";
  handL.part = "handL";
  shoulderR.part = "shoulderR";
  elbowR.part = "elbowR";
  handR.part = "handR";
  kneeL.part = "kneeL";
  footL.part = "footL";
  kneeR.part = "kneeR";
  footR.part = "footR";
  earL.part = "earL";
  earR.part = "earR";
  const ragdollNodes = [
    head,
    neck,
    chest,
    belly,
    hips,
    shoulderL,
    elbowL,
    handL,
    shoulderR,
    elbowR,
    handR,
    kneeL,
    footL,
    kneeR,
    footR,
    earL,
    earR,
  ];
  // Shrink every robot toward its feet so it stays standing on the floor.
  const groundY = Math.max(...ragdollNodes.map((node) => node.y + node.radius));
  for (const node of ragdollNodes) {
    node.x = centerX + (node.x - centerX) * ragdollScale;
    node.y = groundY + (node.y - groundY) * ragdollScale;
    node.oldX = node.x;
    node.oldY = node.y;
    node.radius *= ragdollScale;
  }
  for (const node of ragdollNodes) {
    node.ragdollId = ragdollId;
    node.isMaster = isMaster || isSuper;
    node.isSuper = isSuper;
    node.standX = node.x;
    node.standY = node.y;
    node.pinned = !isSuper;
  }

  addConstraint(head, neck, 0.95);
  addConstraint(neck, chest, 0.95);
  addConstraint(chest, belly, 0.95);
  addConstraint(belly, hips, 0.98);

  addConstraint(chest, shoulderL, 0.93);
  addConstraint(shoulderL, elbowL, 0.9);
  addConstraint(elbowL, handL, 0.88);

  addConstraint(chest, shoulderR, 0.93);
  addConstraint(shoulderR, elbowR, 0.9);
  addConstraint(elbowR, handR, 0.88);

  addConstraint(hips, kneeL, 0.93);
  addConstraint(kneeL, footL, 0.88);
  addConstraint(hips, kneeR, 0.93);
  addConstraint(kneeR, footR, 0.88);

  addConstraint(head, earL, 0.8);
  addConstraint(head, earR, 0.8);

  addConstraint(shoulderL, shoulderR, 0.75);
  addConstraint(hips, shoulderL, 0.28);
  addConstraint(hips, shoulderR, 0.28);
  addConstraint(handL, handR, 0.2);
  addConstraint(footL, footR, 0.2);
  addConstraint(kneeL, kneeR, 0.3);

  addConstraint(head, chest, 0.42);
  addConstraint(shoulderL, hips, 0.3);
  addConstraint(shoulderR, hips, 0.3);

  if (presetId === "squirtle") {
    addConstraint(chest, hips, 0.98);
    addConstraint(shoulderL, kneeL, 0.22);
    addConstraint(shoulderR, kneeR, 0.22);
  }

  if (presetId === "mewtwo") {
    addConstraint(head, belly, 0.58);
    addConstraint(handL, kneeL, 0.22);
    addConstraint(handR, kneeR, 0.22);
  }

  return {
    style: preset,
    isSuper,
    allNodes: ragdollNodes,
    head,
    neck,
    chest,
    belly,
    hips,
    shoulderL,
    elbowL,
    handL,
    shoulderR,
    elbowR,
    handR,
    kneeL,
    footL,
    kneeR,
    footR,
    earL,
    earR,
  };
}

function buildRagdolls(count = ragdollCount) {
  ragdollCount = Math.max(1, count);
  clearSuperRagdoll();

  nodes.length = 0;
  constraints.length = 0;
  bungeeRopes.length = 0;
  bungeeState.pendingTarget = null;
  ragdollRefsList = [];
  ragdollStates = [];

  const floorY = height - 24;
  const leftPadding = 140;
  const rightPadding = 120;
  const availableWidth = Math.max(120, width - leftPadding - rightPadding);
  const spacing = ragdollCount === 1 ? 0 : availableWidth / (ragdollCount - 1);
  const startX = ragdollCount === 1 ? width * 0.55 : leftPadding;

  for (let i = 0; i < ragdollCount; i += 1) {
    const x = startX + spacing * i;
    const style = createRandomRagdollStyle();
    const baseY = getStyleBaseYAtGround(style, floorY);
    const refs = createRagdollInstance(x, baseY, style, style.variantKey, i);
    ragdollRefsList.push(refs);
    ragdollStates.push({
      mode: "standing",
      damageTaken: 0,
      wakeThreshold: wakeDamageThreshold + Math.random() * 5,
      phase: Math.random() * Math.PI * 2,
      hitCount: 0,
      lastRegisteredHitTick: -1,
      stagger: 0,
      gravityReverseUntil: -Infinity,
      isMaster: false,
    });
  }

  pointer.grabbedNode = null;
  updateFightModeAvailability();
}

function appendRagdoll() {
  const style = createRandomRagdollStyle();
  const floorY = height - 24;
  const baseY = getStyleBaseYAtGround(style, floorY);

  const minX = 92;
  const maxX = Math.max(minX + 40, width - 92);
  const existingX = ragdollRefsList
    .map((refs) => refs?.head?.x)
    .filter((x) => Number.isFinite(x));
  let x = minX + Math.random() * Math.max(10, maxX - minX);
  for (let attempts = 0; attempts < 36; attempts += 1) {
    const candidate = minX + Math.random() * Math.max(10, maxX - minX);
    let tooClose = false;
    for (const ex of existingX) {
      if (Math.abs(candidate - ex) < 86) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      x = candidate;
      break;
    }
  }

  const ragdollId = ragdollStates.length;
  const refs = createRagdollInstance(x, baseY, style, style.variantKey, ragdollId);
  ragdollRefsList.push(refs);
  ragdollStates.push({
    mode: "standing",
    damageTaken: 0,
    wakeThreshold: wakeDamageThreshold + Math.random() * 5,
    phase: Math.random() * Math.PI * 2,
    hitCount: 0,
    lastRegisteredHitTick: -1,
    stagger: 0,
    gravityReverseUntil: -Infinity,
    isMaster: false,
  });

  ragdollCount = ragdollStates.length;
  updateFightModeAvailability();
  return true;
}

function appendMasterRagdoll() {
  const baseStyle = createRandomRagdollStyle();
  const masterStyle = {
    ...baseStyle,
    headRadius: Math.min(42, baseStyle.headRadius * 2),
    torsoScale: Math.min(2.32, baseStyle.torsoScale * 2),
    shoulderWidth: Math.max(1.02, (baseStyle.shoulderWidth || 1) * 1.14),
    hipWidth: Math.max(0.94, (baseStyle.hipWidth || 0.92) * 1.08),
    armLength: Math.max(1.06, (baseStyle.armLength || 1) * 1.08),
    forearmLength: Math.max(1.04, (baseStyle.forearmLength || 1) * 1.06),
    legLength: Math.max(1.05, (baseStyle.legLength || 1) * 1.08),
    shinLength: Math.max(1.03, (baseStyle.shinLength || 1) * 1.06),
    neckLength: Math.max(0.82, Math.min(0.98, (baseStyle.neckLength || 0.8) * 1.06)),
    stanceWidth: Math.max(0.92, (baseStyle.stanceWidth || 0.92) * 1.06),
    girthScale: Math.max(1.45, (baseStyle.girthScale || 1) * 1.35),
    bellyScale: Math.max(1.45, (baseStyle.bellyScale || 1) * 1.35),
    massScale: Math.max(7.8, (baseStyle.massScale || 1) * 4.6),
  };

  const floorY = height - 24;
  const baseY = getStyleBaseYAtGround(masterStyle, floorY);

  const minX = 124;
  const maxX = Math.max(minX + 60, width - 124);
  let x = minX + Math.random() * Math.max(10, maxX - minX);
  for (let attempts = 0; attempts < 32; attempts += 1) {
    const candidate = minX + Math.random() * Math.max(10, maxX - minX);
    let tooClose = false;
    for (const refs of ragdollRefsList) {
      const ex = refs?.head?.x;
      if (Number.isFinite(ex) && Math.abs(candidate - ex) < 150) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      x = candidate;
      break;
    }
  }

  const ragdollId = ragdollStates.length;
  const refs = createRagdollInstance(
    x,
    baseY,
    masterStyle,
    baseStyle.variantKey,
    ragdollId,
    { master: true }
  );
  ragdollRefsList.push(refs);
  ragdollStates.push({
    mode: "standing",
    damageTaken: 0,
    wakeThreshold: wakeDamageThreshold + Math.random() * 5,
    phase: Math.random() * Math.PI * 2,
    hitCount: 0,
    lastRegisteredHitTick: -1,
    stagger: 0,
    gravityReverseUntil: -Infinity,
    isMaster: true,
  });

  ragdollCount = ragdollStates.length;
  updateFightModeAvailability();
  return true;
}

function spawnSuperRagdoll() {
  purgeSuperRagdoll();

  const baseStyle = createRandomRagdollStyle();
  const superStyle = {
    ...baseStyle,
    headRadius: Math.min(26, baseStyle.headRadius * 1.12),
    torsoScale: Math.min(1.34, baseStyle.torsoScale * 1.12),
    shoulderWidth: Math.max(1.06, (baseStyle.shoulderWidth || 1) * 1.12),
    hipWidth: Math.max(0.92, (baseStyle.hipWidth || 0.92) * 1.04),
    armLength: Math.max(1.08, (baseStyle.armLength || 1) * 1.1),
    forearmLength: Math.max(1.06, (baseStyle.forearmLength || 1) * 1.08),
    legLength: Math.max(1.02, (baseStyle.legLength || 1) * 1.04),
    shinLength: Math.max(1.01, (baseStyle.shinLength || 1) * 1.03),
    neckLength: Math.max(0.76, Math.min(0.96, (baseStyle.neckLength || 0.8) * 1.02)),
    stanceWidth: Math.max(0.94, (baseStyle.stanceWidth || 0.92) * 1.02),
    girthScale: Math.max(1.02, (baseStyle.girthScale || 1) * 1.08),
    bellyScale: Math.max(1, (baseStyle.bellyScale || 1) * 1.04),
    massScale: Math.max(2.1, (baseStyle.massScale || 1) * 1.9),
    body: [baseStyle.body[0], "#f97316", "#7c2d12", "#111827"],
    accents: ["#451a03", "#fef3c7"],
  };

  const fromLeft = Math.random() > 0.5;
  const direction = fromLeft ? 1 : -1;
  const spawnX = fromLeft ? Math.max(130, width * 0.18) : Math.min(width - 130, width * 0.82);
  const spawnY = Math.max(124, Math.min(height - 210, height * 0.36));
  const refs = createRagdollInstance(
    spawnX,
    spawnY,
    superStyle,
    superStyle.variantKey,
    SUPER_RAGDOLL_ID,
    { super: true }
  );

  refs.handL.radius *= 1.18;
  refs.handR.radius *= 1.18;
  refs.head.radius *= 1.04;

  for (const node of refs.allNodes) {
    node.pinned = false;
    node.oldX = node.x - direction * 6.5;
    node.oldY = node.y + 0.6;
  }

  ragdollRefsList.push(refs);
  superRagdoll.active = true;
  superRagdoll.refs = refs;
  superRagdoll.directionX = direction;
  superRagdoll.directionY = 0;
  superRagdoll.punchSide = direction > 0 ? "right" : "left";

  effects.push({
    type: "ring",
    x: refs.chest.x,
    y: refs.chest.y,
    radius: 18,
    maxRadius: 90,
    life: 14,
    maxLife: 14,
    color: "#facc15",
  });
  return true;
}

function spawnTsunami() {
  const fromLeft = Math.random() > 0.5;
  const waveHeight = Math.max(180, Math.min(height - 96, height * 0.52));
  const waveWidth = Math.max(150, Math.min(280, width * 0.2));
  tsunami.active = true;
  tsunami.side = fromLeft ? "left" : "right";
  tsunami.width = waveWidth;
  tsunami.height = waveHeight;
  tsunami.y = height - 24 - waveHeight;
  tsunami.speed = Math.max(11, width * 0.011);
  tsunami.pushForce = 18;
  tsunami.curveDepth = Math.max(42, Math.min(110, waveWidth * 0.55));
  tsunami.x = fromLeft ? -waveWidth - 20 : width + 20;
  return true;
}

function buildArena() {
  damageBill = 0;
  clearSuperRagdoll();
  obstacles.length = 0;
  props.length = 0;
  effects.length = 0;
  projectiles.length = 0;
  bungeeRopes.length = 0;
  bungeeState.pendingTarget = null;
  cars.length = 0;
  bombs.length = 0;
  launchedGrenades.length = 0;
  anvils.length = 0;
  titaniumBalls.length = 0;
  nuclearBlast.active = false;
  tsunami.active = false;
  saw.active = false;
  lava.active = false;
  lava.level = 0;

  const floor = height - 24;
  const tallestStyle = {
    torsoScale: 1.18,
    neckLength: 0.94,
    legLength: 1.1,
    shinLength: 1.08,
  };
  const baseY = getStyleBaseYAtGround(tallestStyle, floor);
  const standingHeadY = baseY - getStyleStandingMetrics(tallestStyle).headLift;
  const headClearY = Math.max(64, standingHeadY - 16);
  const spawnLeft = 40;
  const spawnRight = Math.max(spawnLeft + 220, width - 40);
  const obstacleYMin = Math.max(56, Math.min(floor - 220, height * 0.08));
  const obstacleYMax = Math.max(
    obstacleYMin + 24,
    Math.min(floor - 64, headClearY)
  );
  const propYMin = Math.max(72, Math.min(floor - 200, height * 0.12));
  const propYMax = Math.max(
    propYMin + 24,
    Math.min(floor - 54, headClearY + 12)
  );

  const overlapsRect = (x, y, w, h, list, gap = 26) => {
    for (const item of list) {
      const separated =
        x + w + gap < item.x ||
        x - gap > item.x + item.w ||
        y + h + gap < item.y ||
        y - gap > item.y + item.h;
      if (!separated) {
        return true;
      }
    }
    return false;
  };

  const obstacleTemplates = [
    {
      w: 78,
      h: 115,
      color: "#334155",
      border: "#94a3b8",
      hp: 230,
      maxHp: 230,
      melted: false,
    },
    {
      w: 120,
      h: 14,
      color: "#1e293b",
      border: "#64748b",
      hp: 180,
      maxHp: 180,
      melted: false,
    },
    {
      w: 160,
      h: 18,
      color: "#1e293b",
      border: "#64748b",
      hp: 200,
      maxHp: 200,
      melted: false,
    },
  ];

  for (const template of obstacleTemplates) {
    let placed = false;
    for (let attempts = 0; attempts < 40; attempts += 1) {
      const x = spawnLeft + Math.random() * Math.max(20, spawnRight - spawnLeft - template.w);
      const yCeiling = Math.max(obstacleYMin, obstacleYMax - template.h);
      const y = obstacleYMin + Math.random() * Math.max(10, yCeiling - obstacleYMin);
      if (overlapsRect(x, y, template.w, template.h, obstacles, 24)) {
        continue;
      }
      obstacles.push({ x, y, ...template });
      placed = true;
      break;
    }
    if (!placed) {
      const fallbackY = Math.max(
        obstacleYMin,
        Math.min(obstacleYMax - template.h, headClearY - template.h)
      );
      obstacles.push({
        x: spawnLeft + Math.random() * Math.max(10, spawnRight - spawnLeft - template.w),
        y: fallbackY,
        ...template,
      });
    }
  }

  const crateCount = 6;
  for (let i = 0; i < crateCount; i += 1) {
    const w = 34;
    const h = 34;
    let placed = false;
    for (let attempts = 0; attempts < 50; attempts += 1) {
      const x = spawnLeft + Math.random() * Math.max(20, spawnRight - spawnLeft - w);
      const yCeiling = Math.max(propYMin, propYMax - h);
      const y = propYMin + Math.random() * Math.max(10, yCeiling - propYMin);

      if (overlapsRect(x, y, w, h, obstacles, 8) || overlapsRect(x, y, w, h, props, 4)) {
        continue;
      }

      props.push({
        x,
        y,
        w,
        h,
        hp: 48,
        maxHp: 48,
        broken: false,
      });
      placed = true;
      break;
    }
    if (!placed) {
      const fallbackY = Math.max(propYMin, Math.min(propYMax - h, headClearY - h + 10));
      props.push({
        x: spawnLeft + Math.random() * Math.max(10, spawnRight - spawnLeft - w),
        y: fallbackY,
        w,
        h,
        hp: 48,
        maxHp: 48,
        broken: false,
      });
    }
  }
}

function resetArenaAndRagdoll() {
  buildArena();
  buildRagdolls(ragdollCount);
}

function resize() {
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = width;
  canvas.height = height;

  if (pointer.x === 0 && pointer.y === 0) {
    pointer.x = width * 0.52;
    pointer.y = height * 0.5;
    pointer.prevX = pointer.x;
    pointer.prevY = pointer.y;
  }

  buildArena();
  buildRagdolls(ragdollCount);
}

function integrate() {
  for (const node of nodes) {
    if (node.pinned) {
      // Keep the last step's motion so a moving robot carries momentum when knocked limp.
      const prevX = node.x;
      const prevY = node.y;
      node.x = node.poseX ?? node.standX ?? node.x;
      node.y = node.poseY ?? node.standY ?? node.y;
      node.oldX = node.poseX == null ? node.x : prevX;
      node.oldY = node.poseY == null ? node.y : prevY;
      continue;
    }

    const vx = (node.x - node.oldX) * damping;
    const vy = (node.y - node.oldY) * damping;

    node.oldX = node.x;
    node.oldY = node.y;
    const state = getRagdollState(node.ragdollId);
    const gravityDirection =
      state && typeof state.gravityReverseUntil === "number" && state.gravityReverseUntil > frameNow
        ? -1
        : 1;
    node.x += vx;
    node.y += vy + baseGravity * gravityMultiplier * gravityDirection;
  }
}

function integrateBombs() {
  for (const bomb of bombs) {
    const vx = (bomb.x - bomb.oldX) * 0.992;
    const vy = (bomb.y - bomb.oldY) * 0.992;
    bomb.oldX = bomb.x;
    bomb.oldY = bomb.y;
    bomb.x += vx;
    bomb.y += vy + baseGravity * gravityMultiplier * 1.05;
  }
}

function integrateAnvils() {
  for (const anvil of anvils) {
    const vx = (anvil.x - anvil.oldX) * 0.996;
    const vy = (anvil.y - anvil.oldY) * 0.996;
    anvil.oldX = anvil.x;
    anvil.oldY = anvil.y;
    anvil.x += vx;
    anvil.y += vy + baseGravity * gravityMultiplier * 1.28;
  }
}

function integrateTitaniumBalls() {
  for (const ball of titaniumBalls) {
    let vx = ball.x - ball.oldX;
    let vy = ball.y - ball.oldY;
    const speed = Math.hypot(vx, vy) || 0.0001;
    const minSpeed = ball.minSpeed || 20;
    const maxSpeed = ball.maxSpeed || 44;
    if (speed < minSpeed) {
      const scaleUp = minSpeed / speed;
      vx *= scaleUp;
      vy *= scaleUp;
    } else if (speed > maxSpeed) {
      const scaleDown = maxSpeed / speed;
      vx *= scaleDown;
      vy *= scaleDown;
    }
    ball.oldX = ball.x;
    ball.oldY = ball.y;
    ball.x += vx;
    ball.y += vy;
  }
}

function integrateLaunchedGrenades() {
  for (const grenade of launchedGrenades) {
    const vx = (grenade.x - grenade.oldX) * 0.992;
    const vy = (grenade.y - grenade.oldY) * 0.992;
    grenade.oldX = grenade.x;
    grenade.oldY = grenade.y;
    grenade.x += vx;
    grenade.y += vy + baseGravity * gravityMultiplier * 1.08;
  }
}

function solveBombCollisions() {
  for (const bomb of bombs) {
    constrainToBounds(bomb);

    for (const obstacle of obstacles) {
      if (obstacle.melted) {
        continue;
      }
      resolveCircleRect(bomb, obstacle);
    }

    for (const prop of props) {
      if (prop.broken) {
        continue;
      }
      resolveCircleRect(bomb, prop);
    }

    for (const node of nodes) {
      const dx = node.x - bomb.x;
      const dy = node.y - bomb.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const minDist = node.radius + bomb.radius;
      if (dist >= minDist) {
        continue;
      }
      const overlap = (minDist - dist) * 0.5;
      const nx = dx / dist;
      const ny = dy / dist;
      node.x += nx * overlap;
      node.y += ny * overlap;
      bomb.x -= nx * overlap;
      bomb.y -= ny * overlap;
    }
  }
}

function solveAnvilCollisions() {
  for (let i = 0; i < anvils.length; i += 1) {
    const anvil = anvils[i];
    constrainToBounds(anvil);
    collideAnvilWithSaw(anvil);

    for (const obstacle of obstacles) {
      if (obstacle.melted) {
        continue;
      }
      resolveCircleRect(anvil, obstacle);
    }

    for (const prop of props) {
      if (prop.broken) {
        continue;
      }
      const collided = resolveCircleRect(anvil, prop);
      if (collided) {
        const speed = Math.hypot(anvil.x - anvil.oldX, anvil.y - anvil.oldY);
        if (speed > 1.6) {
          chargeDamage(prop, speed * 6.2);
          if (prop.hp <= 0) {
            prop.broken = true;
            spawnBreakEffect(prop.x + prop.w * 0.5, prop.y + prop.h * 0.5, "#9ca3af");
          }
        }
      }
    }

    for (const node of nodes) {
      const dx = node.x - anvil.x;
      const dy = node.y - anvil.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const minDist = node.radius + anvil.radius;
      if (dist >= minDist) {
        continue;
      }

      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      node.x += nx * overlap * 0.8;
      node.y += ny * overlap * 0.8;
      anvil.x -= nx * overlap * 0.2;
      anvil.y -= ny * overlap * 0.2;

      const anvilVx = anvil.x - anvil.oldX;
      const anvilVy = anvil.y - anvil.oldY;
      const nodeVx = node.x - node.oldX;
      const nodeVy = node.y - node.oldY;
      const relSpeed = Math.hypot(anvilVx - nodeVx, anvilVy - nodeVy);
      const force = (anvil.impactForce * Math.max(0.3, overlap / minDist) + relSpeed * 0.8) / node.mass;
      node.oldX -= nx * force;
      node.oldY -= ny * force;

      if (node.lastImpactTick !== simulationTick && relSpeed > 1.3) {
        node.lastImpactTick = simulationTick;
        applyDamageToNode(node, Math.min(62, anvil.impactDamage * (0.28 + relSpeed * 0.14)), "#9ca3af");
      }
    }

    for (let j = i + 1; j < anvils.length; j += 1) {
      const other = anvils[j];
      const dx = other.x - anvil.x;
      const dy = other.y - anvil.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const minDist = anvil.radius + other.radius;
      if (dist >= minDist) {
        continue;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = (minDist - dist) * 0.5;
      anvil.x -= nx * overlap;
      anvil.y -= ny * overlap;
      other.x += nx * overlap;
      other.y += ny * overlap;
    }
  }
}

function solveLaunchedGrenadeCollisions() {
  for (const grenade of launchedGrenades) {
    constrainToBounds(grenade);

    for (const obstacle of obstacles) {
      if (obstacle.melted) {
        continue;
      }
      resolveCircleRect(grenade, obstacle);
    }

    for (const prop of props) {
      if (prop.broken) {
        continue;
      }
      resolveCircleRect(grenade, prop);
    }

    for (const node of nodes) {
      const dx = node.x - grenade.x;
      const dy = node.y - grenade.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const minDist = node.radius + grenade.radius;
      if (dist >= minDist) {
        continue;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = (minDist - dist) * 0.5;
      node.x += nx * overlap;
      node.y += ny * overlap;
      grenade.x -= nx * overlap;
      grenade.y -= ny * overlap;
    }
  }
}

function solveTitaniumBallCollisions() {
  const floorY = height - 24;
  const topY = 8;
  for (const ball of titaniumBalls) {
    const vx = ball.x - ball.oldX;
    const vy = ball.y - ball.oldY;

    if (ball.y < topY + ball.radius) {
      ball.y = topY + ball.radius;
      ball.oldY = ball.y + vy * ball.bounce;
    }
    if (ball.y > floorY - ball.radius) {
      ball.y = floorY - ball.radius;
      ball.oldY = ball.y + vy * ball.bounce;
    }
    if (ball.x < 14 + ball.radius) {
      ball.x = 14 + ball.radius;
      ball.oldX = ball.x + vx * ball.bounce;
    }
    if (ball.x > width - 14 - ball.radius) {
      ball.x = width - 14 - ball.radius;
      ball.oldX = ball.x + vx * ball.bounce;
    }

    for (const obstacle of obstacles) {
      if (obstacle.melted) {
        continue;
      }
      const collided = resolveCircleRect(ball, obstacle);
      if (collided) {
        const reboundX = (ball.x - ball.oldX) * ball.bounce;
        const reboundY = (ball.y - ball.oldY) * ball.bounce;
        ball.oldX = ball.x - reboundX;
        ball.oldY = ball.y - reboundY;
      }
    }

    for (const prop of props) {
      if (prop.broken) {
        continue;
      }
      const collided = resolveCircleRect(ball, prop);
      if (collided) {
        const reboundX = (ball.x - ball.oldX) * ball.bounce;
        const reboundY = (ball.y - ball.oldY) * ball.bounce;
        ball.oldX = ball.x - reboundX;
        ball.oldY = ball.y - reboundY;
        chargeDamage(prop, 3.5);
        if (prop.hp <= 0) {
          prop.broken = true;
          spawnBreakEffect(prop.x + prop.w * 0.5, prop.y + prop.h * 0.5, "#94a3b8");
        }
      }
    }

    for (const node of nodes) {
      const dx = node.x - ball.x;
      const dy = node.y - ball.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const minDist = node.radius + ball.radius;
      if (dist >= minDist) {
        continue;
      }

      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      node.x += nx * overlap * 0.7;
      node.y += ny * overlap * 0.7;
      ball.x -= nx * overlap * 0.3;
      ball.y -= ny * overlap * 0.3;

      const force = (ball.impactForce * Math.max(0.4, overlap / minDist)) / node.mass;
      node.oldX -= nx * force;
      node.oldY -= ny * force;
      ball.oldX += nx * force * 0.2;
      ball.oldY += ny * force * 0.2;

      if (node.lastImpactTick !== simulationTick) {
        node.lastImpactTick = simulationTick;
        applyDamageToNode(node, ball.impactDamage, "#cbd5e1");
      }
    }

    for (const anvil of anvils) {
      const dx = anvil.x - ball.x;
      const dy = anvil.y - ball.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const minDist = anvil.radius + ball.radius;
      if (dist >= minDist) {
        continue;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      ball.x -= nx * overlap * 0.55;
      ball.y -= ny * overlap * 0.55;
      anvil.x += nx * overlap * 0.45;
      anvil.y += ny * overlap * 0.45;
      ball.oldX += nx * 3.4;
      ball.oldY += ny * 3.4;
      anvil.oldX -= nx * 1.1;
      anvil.oldY -= ny * 1.1;
    }

    let finalVx = ball.x - ball.oldX;
    let finalVy = ball.y - ball.oldY;
    const finalSpeed = Math.hypot(finalVx, finalVy) || 0.0001;
    const minSpeed = ball.minSpeed || 20;
    const maxSpeed = ball.maxSpeed || 44;
    if (finalSpeed < minSpeed) {
      const boost = minSpeed / finalSpeed;
      finalVx *= boost;
      finalVy *= boost;
    } else if (finalSpeed > maxSpeed) {
      const clamp = maxSpeed / finalSpeed;
      finalVx *= clamp;
      finalVy *= clamp;
    }
    ball.oldX = ball.x - finalVx;
    ball.oldY = ball.y - finalVy;
  }
}

function applyPointerDrag() {
  if (!(pointer.down && activeTool === "hand" && pointer.grabbedNode)) {
    return;
  }

  if (isDraggableRect(pointer.grabbedNode)) {
    const minX = 14;
    const maxX = Math.max(minX, width - 14 - pointer.grabbedNode.w);
    const minY = 14;
    const maxY = Math.max(minY, height - 24 - pointer.grabbedNode.h);
    const nextX = Math.max(minX, Math.min(maxX, pointer.x - pointer.grabOffsetX));
    const nextY = Math.max(minY, Math.min(maxY, pointer.y - pointer.grabOffsetY));
    pointer.grabbedNode.kinematicVX =
      (pointer.grabbedNode.kinematicVX || 0) + (nextX - pointer.grabbedNode.x);
    pointer.grabbedNode.kinematicVY =
      (pointer.grabbedNode.kinematicVY || 0) + (nextY - pointer.grabbedNode.y);
    pointer.grabbedNode.x = nextX;
    pointer.grabbedNode.y = nextY;
    return;
  }

  if (isSawTarget(pointer.grabbedNode)) {
    const minX = saw.radius * 0.42;
    const maxX = Math.max(minX, width - saw.radius * 0.42);
    const minY = saw.radius * 0.42;
    const maxY = Math.max(minY, height - 24 - saw.radius * 0.42);
    saw.x = Math.max(minX, Math.min(maxX, pointer.x - pointer.grabOffsetX));
    saw.y = Math.max(minY, Math.min(maxY, pointer.y - pointer.grabOffsetY));
    return;
  }

  if (isAnvilTarget(pointer.grabbedNode)) {
    const minX = pointer.grabbedNode.radius + 8;
    const maxX = Math.max(minX, width - pointer.grabbedNode.radius - 8);
    const minY = pointer.grabbedNode.radius + 8;
    const maxY = Math.max(minY, height - 24 - pointer.grabbedNode.radius);
    pointer.grabbedNode.x = Math.max(minX, Math.min(maxX, pointer.x - pointer.grabOffsetX));
    pointer.grabbedNode.y = Math.max(minY, Math.min(maxY, pointer.y - pointer.grabOffsetY));
    pointer.grabbedNode.oldX = pointer.prevX - pointer.grabOffsetX;
    pointer.grabbedNode.oldY = pointer.prevY - pointer.grabOffsetY;
    return;
  }

  pointer.grabbedNode.x = pointer.x;
  pointer.grabbedNode.y = pointer.y;
  pointer.grabbedNode.oldX = pointer.x;
  pointer.grabbedNode.oldY = pointer.y;
}

function solveConstraints() {
  const hasActiveObstacles = obstacles.some((obstacle) => !obstacle.melted);
  const hasActiveProps = props.some((prop) => !prop.broken);
  const hasSaw = saw.active;

  for (let i = 0; i < physicsIterations; i += 1) {
    applyPointerDrag();

    for (const c of constraints) {
      if (c.broken) {
        continue;
      }

      const dx = c.b.x - c.a.x;
      const dy = c.b.y - c.a.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const diff = (dist - c.length) / dist;
      const effectiveStiffness = c.baseStiffness;
      const adjust = 0.5 * effectiveStiffness * diff;
      const ax = dx * adjust;
      const ay = dy * adjust;

      if (!c.a.pinned) {
        c.a.x += ax;
        c.a.y += ay;
      }

      if (!c.b.pinned) {
        c.b.x -= ax;
        c.b.y -= ay;
      }
    }

    for (const node of nodes) {
      constrainToBounds(node);
      if (hasActiveObstacles) {
        collideNodeWithObstacle(node);
      }
      if (!node.pinned) {
        if (hasActiveProps) {
          collideNodeWithProps(node);
        }
      }
      if (hasSaw) {
        collideNodeWithSaw(node);
      }
    }

    collideRagdollNodes();
    solveBungeeRopes();

    solveBombCollisions();
    solveAnvilCollisions();
    solveTitaniumBallCollisions();
    solveLaunchedGrenadeCollisions();
  }

  updateConstraintFractures();
}

function updateSawBlade() {
  if (!saw.active) {
    return;
  }
  saw.angle += saw.speed * saw.spinDirection;
}

function constrainToBounds(node) {
  const floorY = height - 24;
  const leftX = 14;
  const rightX = width - 14;
  const topY = 8;

  if (node.y > floorY - node.radius) {
    node.y = floorY - node.radius;
    const vy = node.y - node.oldY;
    node.oldY = node.y + vy * floorBounce;

    const vx = node.x - node.oldX;
    const dampedVx = vx * floorFriction;
    node.oldX = node.x - dampedVx;
    if (Math.abs(dampedVx) < 0.06) {
      node.oldX = node.x;
    }
  }

  if (node.x < leftX + node.radius) {
    node.x = leftX + node.radius;
    const vx = node.x - node.oldX;
    node.oldX = node.x + vx * floorBounce;
    if (node.oldX < leftX + node.radius) {
      node.oldX = leftX + node.radius;
    }
  }

  if (node.x > rightX - node.radius) {
    node.x = rightX - node.radius;
    const vx = node.x - node.oldX;
    node.oldX = node.x + vx * floorBounce;
    if (node.oldX > rightX - node.radius) {
      node.oldX = rightX - node.radius;
    }
  }

  if (node.y < topY + node.radius) {
    node.y = topY + node.radius;
    const vy = node.y - node.oldY;
    node.oldY = node.y + vy * floorBounce;
    if (node.oldY < topY + node.radius) {
      node.oldY = topY + node.radius;
    }
  }
}

function resolveCircleRect(node, rect) {
  const nearestX = Math.max(rect.x, Math.min(node.x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(node.y, rect.y + rect.h));
  const dx = node.x - nearestX;
  const dy = node.y - nearestY;
  let dist = Math.hypot(dx, dy);

  if (dist === 0) {
    const leftGap = node.x - rect.x;
    const rightGap = rect.x + rect.w - node.x;
    const topGap = node.y - rect.y;
    const bottomGap = rect.y + rect.h - node.y;
    const minGap = Math.min(leftGap, rightGap, topGap, bottomGap);

    if (minGap === leftGap) {
      node.x = rect.x - node.radius;
    } else if (minGap === rightGap) {
      node.x = rect.x + rect.w + node.radius;
    } else if (minGap === topGap) {
      node.y = rect.y - node.radius;
    } else {
      node.y = rect.y + rect.h + node.radius;
    }
    node.oldX = node.x;
    node.oldY = node.y;
    return true;
  }

  if (dist >= node.radius) {
    return false;
  }

  const overlap = node.radius - dist;
  const nx = dx / dist;
  const ny = dy / dist;

  node.x += nx * overlap;
  node.y += ny * overlap;
  node.oldX = node.x + (node.x - node.oldX) * 0.55;
  node.oldY = node.y + (node.y - node.oldY) * 0.55;
  return true;
}

function resolveRectRect(dynamicRect, solidRect) {
  if (
    dynamicRect.x + dynamicRect.w <= solidRect.x ||
    dynamicRect.x >= solidRect.x + solidRect.w ||
    dynamicRect.y + dynamicRect.h <= solidRect.y ||
    dynamicRect.y >= solidRect.y + solidRect.h
  ) {
    return false;
  }

  const overlapLeft = dynamicRect.x + dynamicRect.w - solidRect.x;
  const overlapRight = solidRect.x + solidRect.w - dynamicRect.x;
  const overlapTop = dynamicRect.y + dynamicRect.h - solidRect.y;
  const overlapBottom = solidRect.y + solidRect.h - dynamicRect.y;
  const minX = Math.min(overlapLeft, overlapRight);
  const minY = Math.min(overlapTop, overlapBottom);

  if (minX < minY) {
    if (overlapLeft < overlapRight) {
      dynamicRect.x = solidRect.x - dynamicRect.w;
    } else {
      dynamicRect.x = solidRect.x + solidRect.w;
    }
    const vx = dynamicRect.x - dynamicRect.oldX;
    dynamicRect.oldX = dynamicRect.x + vx * (dynamicRect.bounce || 0.25);
  } else {
    if (overlapTop < overlapBottom) {
      dynamicRect.y = solidRect.y - dynamicRect.h;
    } else {
      dynamicRect.y = solidRect.y + solidRect.h;
    }
    const vy = dynamicRect.y - dynamicRect.oldY;
    dynamicRect.oldY = dynamicRect.y + vy * (dynamicRect.bounce || 0.25);
  }

  return true;
}

function integrateDroppedCars() {
  const floorY = height - 24;
  const leftX = 14;
  const rightX = width - 14;
  const topY = 8;

  for (const obstacle of obstacles) {
    if (obstacle.melted || obstacle.type !== "drop-car" || !obstacle.dynamic) {
      continue;
    }

    const isGrabbedByHand =
      pointer.down && activeTool === "hand" && pointer.grabbedNode === obstacle;
    if (isGrabbedByHand) {
      obstacle.oldX = obstacle.x;
      obstacle.oldY = obstacle.y;
      continue;
    }

    const vx = (obstacle.x - obstacle.oldX) * (obstacle.drag || 0.992);
    const vy = (obstacle.y - obstacle.oldY) * (obstacle.drag || 0.992);
    obstacle.oldX = obstacle.x;
    obstacle.oldY = obstacle.y;
    obstacle.x += vx;
    obstacle.y += vy + baseGravity * gravityMultiplier * 1.15;

    if (obstacle.x < leftX) {
      obstacle.x = leftX;
      const hitVx = obstacle.x - obstacle.oldX;
      obstacle.oldX = obstacle.x + hitVx * (obstacle.bounce || 0.28);
    } else if (obstacle.x + obstacle.w > rightX) {
      obstacle.x = rightX - obstacle.w;
      const hitVx = obstacle.x - obstacle.oldX;
      obstacle.oldX = obstacle.x + hitVx * (obstacle.bounce || 0.28);
    }

    if (obstacle.y < topY) {
      obstacle.y = topY;
      const hitVy = obstacle.y - obstacle.oldY;
      obstacle.oldY = obstacle.y + hitVy * (obstacle.bounce || 0.28);
    } else if (obstacle.y + obstacle.h > floorY) {
      obstacle.y = floorY - obstacle.h;
      const hitVy = obstacle.y - obstacle.oldY;
      obstacle.oldY = obstacle.y + hitVy * (obstacle.bounce || 0.28);
      const floorVx = obstacle.x - obstacle.oldX;
      obstacle.oldX = obstacle.x - floorVx * 0.88;
      if (Math.abs(floorVx) < 0.06) {
        obstacle.oldX = obstacle.x;
      }
      if (Math.abs(hitVy) < 0.12) {
        obstacle.oldY = obstacle.y;
      }
    }

    for (const other of obstacles) {
      if (other === obstacle || other.melted) {
        continue;
      }
      resolveRectRect(obstacle, other);
    }

    for (const prop of props) {
      if (prop.broken) {
        continue;
      }
      resolveRectRect(obstacle, prop);
    }
  }
}

function collideNodeWithObstacle(node) {
  for (const obstacle of obstacles) {
    if (obstacle.melted) {
      continue;
    }
    if (node.pinned && obstacle.type !== "drop-car") {
      continue;
    }
    const collided = resolveCircleRect(node, obstacle);
    if (!collided) {
      continue;
    }

    const speed = Math.hypot(node.x - node.oldX, node.y - node.oldY);
    if (obstacle.type === "six-seven" || obstacle.type === "drop-car") {
      const obstacleVX =
        (obstacle.kinematicVX || 0) +
        (typeof obstacle.oldX === "number" ? obstacle.x - obstacle.oldX : 0);
      const obstacleVY =
        (obstacle.kinematicVY || 0) +
        (typeof obstacle.oldY === "number" ? obstacle.y - obstacle.oldY : 0);
      const obstacleSpeed = Math.hypot(obstacleVX, obstacleVY);
      if (obstacleSpeed > 0.08) {
        node.oldX -= (obstacleVX * (obstacle.impactForce || 3)) / node.mass;
        node.oldY -= (obstacleVY * (obstacle.impactForce || 3)) / node.mass;
      }
      const relSpeed = speed + obstacleSpeed;
      if (relSpeed > 1.2 && node.lastImpactTick !== simulationTick) {
        node.lastImpactTick = simulationTick;
        applyDamageToNode(
          node,
          (relSpeed - 1.1) * (obstacle.impactDamageScale || 3.4),
          obstacle.type === "drop-car" ? "#f43f5e" : "#f59e0b"
        );
      } else if (
        obstacle.type === "drop-car" &&
        node.pinned &&
        node.lastImpactTick !== simulationTick
      ) {
        // Standing ragdolls should still react to dropped-car contact.
        node.lastImpactTick = simulationTick;
        applyDamageToNode(node, 6.5, "#f43f5e");
      }
      continue;
    }
    if (speed > 3.2 && node.lastImpactTick !== simulationTick) {
      node.lastImpactTick = simulationTick;
      applyDamageToNode(node, (speed - 3.2) * 1.8, "#f97316");
    }
  }
}

function spawnBreakEffect(x, y, color) {
  for (let i = 0; i < 10; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.3 + Math.random() * 3.4;
    effects.push({
      type: "debris",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      drag: 0.98,
      gravity: 0.07,
      size: 2 + Math.random() * 2.5,
      life: 34 + Math.random() * 18,
      maxLife: 52,
      color,
    });
  }
}

function collideNodeWithProps(node) {
  const speed = Math.hypot(node.x - node.oldX, node.y - node.oldY);

  for (const prop of props) {
    if (prop.broken) {
      continue;
    }

    const collided = resolveCircleRect(node, prop);
    if (!collided) {
      continue;
    }

    if (speed > 2.4) {
      chargeDamage(prop, speed * 3);
      if (node.lastImpactTick !== simulationTick) {
        node.lastImpactTick = simulationTick;
        applyDamageToNode(node, (speed - 2.2) * 2.1, "#fb7185");
      }
      if (prop.hp <= 0) {
        prop.broken = true;
        spawnBreakEffect(prop.x + prop.w * 0.5, prop.y + prop.h * 0.5, "#f59e0b");
      }
    }
  }
}

function collideNodeWithSaw(node) {
  if (!saw.active) {
    return;
  }

  const dx = node.x - saw.x;
  const dy = node.y - saw.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const minDist = node.radius + saw.radius;
  if (dist >= minDist) {
    return;
  }

  const nx = dx / dist;
  const ny = dy / dist;
  const tx = -ny * saw.spinDirection;
  const ty = nx * saw.spinDirection;
  const penetration = minDist - dist;
  node.x += nx * penetration;
  node.y += ny * penetration;

  const outward = 10.5 / node.mass;
  const tangential = 14.2 / node.mass;
  node.oldX -= nx * outward + tx * tangential;
  node.oldY -= ny * outward + ty * tangential;

  if (node.lastImpactTick !== simulationTick) {
    node.lastImpactTick = simulationTick;
    applyDamageToNode(node, 13, "#ef4444");
    effects.push({
      type: "spark",
      x: node.x - nx * node.radius,
      y: node.y - ny * node.radius,
      vx: tx * (3 + Math.random() * 3),
      vy: ty * (3 + Math.random() * 3),
      drag: 0.9,
      gravity: 0.09,
      size: 2 + Math.random() * 1.6,
      life: 16,
      maxLife: 16,
      color: "#fde047",
    });
  }
}

function collideAnvilWithSaw(anvil) {
  if (!saw.active) {
    return;
  }

  const dx = anvil.x - saw.x;
  const dy = anvil.y - saw.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const minDist = anvil.radius + saw.radius;
  if (dist >= minDist) {
    return;
  }

  const nx = dx / dist;
  const ny = dy / dist;
  const tx = -ny * saw.spinDirection;
  const ty = nx * saw.spinDirection;
  const penetration = minDist - dist;
  anvil.x += nx * penetration * 1.05;
  anvil.y += ny * penetration * 1.05;

  const outward = 28 / anvil.mass;
  const tangential = 42 / anvil.mass;
  anvil.oldX -= nx * outward + tx * tangential;
  anvil.oldY -= ny * outward + ty * tangential;

  effects.push({
    type: "spark",
    x: anvil.x - nx * anvil.radius,
    y: anvil.y - ny * anvil.radius,
    vx: tx * (2.5 + Math.random() * 2.2),
    vy: ty * (2.5 + Math.random() * 2.2),
    drag: 0.9,
    gravity: 0.09,
    size: 2 + Math.random() * 1.6,
    life: 14,
    maxLife: 14,
    color: "#e2e8f0",
  });
}

function collideRagdollNodes() {
  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j += 1) {
      const b = nodes[j];
      if (a.ragdollId === b.ragdollId) {
        continue;
      }
      if (!fightModeEnabled && !a.isMaster && !b.isMaster) {
        continue;
      }

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const minDist = a.radius + b.radius;
      if (dist >= minDist) {
        continue;
      }

      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      const moveA = a.pinned ? 0 : 0.5;
      const moveB = b.pinned ? 0 : 0.5;
      const totalMove = moveA + moveB || 1;

      if (!a.pinned) {
        a.x -= nx * overlap * (moveA / totalMove);
        a.y -= ny * overlap * (moveA / totalMove);
      }
      if (!b.pinned) {
        b.x += nx * overlap * (moveB / totalMove);
        b.y += ny * overlap * (moveB / totalMove);
      }

      const avx = a.x - a.oldX;
      const avy = a.y - a.oldY;
      const bvx = b.x - b.oldX;
      const bvy = b.y - b.oldY;
      const impact = Math.hypot(avx - bvx, avy - bvy);

      if (impact > 4.2) {
        if (a.lastImpactTick !== simulationTick) {
          a.lastImpactTick = simulationTick;
          applyDamageToNode(a, (impact - 4.2) * 0.42, "#fb7185");
        }
        if (b.lastImpactTick !== simulationTick) {
          b.lastImpactTick = simulationTick;
          applyDamageToNode(b, (impact - 4.2) * 0.42, "#fb7185");
        }
      }

      const bounce = Math.min(5.5, impact * 0.5);
      if (!a.pinned) {
        a.oldX += nx * bounce / a.mass;
        a.oldY += ny * bounce / a.mass;
      }
      if (!b.pinned) {
        b.oldX -= nx * bounce / b.mass;
        b.oldY -= ny * bounce / b.mass;
      }
    }
  }
}

function getNodeAt(x, y) {
  let selected = null;
  let minDistance = Infinity;

  for (const node of nodes) {
    const dx = node.x - x;
    const dy = node.y - y;
    const dist = Math.hypot(dx, dy);
    const threshold = node.radius + 16;

    if (dist < threshold && dist < minDistance) {
      minDistance = dist;
      selected = node;
    }
  }

  for (const bomb of bombs) {
    const dx = bomb.x - x;
    const dy = bomb.y - y;
    const dist = Math.hypot(dx, dy);
    const threshold = bomb.radius + 18;

    if (dist < threshold && dist < minDistance) {
      minDistance = dist;
      selected = bomb;
    }
  }

  for (const anvil of anvils) {
    const dx = anvil.x - x;
    const dy = anvil.y - y;
    const dist = Math.hypot(dx, dy);
    const threshold = anvil.radius + 14;

    if (dist < threshold && dist < minDistance) {
      minDistance = dist;
      selected = anvil;
    }
  }

  for (const ball of titaniumBalls) {
    const dx = ball.x - x;
    const dy = ball.y - y;
    const dist = Math.hypot(dx, dy);
    const threshold = ball.radius + 14;

    if (dist < threshold && dist < minDistance) {
      minDistance = dist;
      selected = ball;
    }
  }

  if (!selected) {
    if (saw.active) {
      const dx = saw.x - x;
      const dy = saw.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < saw.radius * 0.62) {
        return saw;
      }
    }

    for (const prop of props) {
      if (prop.broken) {
        continue;
      }
      if (isPointInRect(x, y, prop)) {
        return prop;
      }
    }

    for (const obstacle of obstacles) {
      if (obstacle.melted) {
        continue;
      }
      if (isPointInRect(x, y, obstacle)) {
        return obstacle;
      }
    }
  }

  return selected;
}

function isDraggableRect(target) {
  return (
    target &&
    typeof target.x === "number" &&
    typeof target.y === "number" &&
    typeof target.w === "number" &&
    typeof target.h === "number"
  );
}

function isSawTarget(target) {
  return target === saw;
}

function isAnvilTarget(target) {
  return target && target.kind === "anvil";
}

function isRopeTargetActive(target) {
  if (!target) {
    return false;
  }
  if (isSawTarget(target)) {
    return saw.active;
  }
  if (isAnvilTarget(target)) {
    return anvils.includes(target);
  }
  if (target.kind === "bomb") {
    return bombs.includes(target);
  }
  if (target.kind === "launched-grenade") {
    return launchedGrenades.includes(target);
  }
  if (isDraggableRect(target)) {
    return !target.broken && !target.melted;
  }
  return typeof target.x === "number" && typeof target.y === "number" && !target.destroyed;
}

function getRopeAnchorPosition(target) {
  if (!isRopeTargetActive(target)) {
    return null;
  }
  if (isDraggableRect(target)) {
    return { x: target.x + target.w * 0.5, y: target.y + target.h * 0.5 };
  }
  return { x: target.x, y: target.y };
}

function applyRopeDisplacement(target, dx, dy) {
  if (!isRopeTargetActive(target)) {
    return;
  }

  if (target.ragdollId != null && target.pinned) {
    wakeRagdoll(target.ragdollId);
  }

  if (isSawTarget(target)) {
    const minX = saw.radius * 0.42;
    const maxX = Math.max(minX, width - saw.radius * 0.42);
    const minY = saw.radius * 0.42;
    const maxY = Math.max(minY, height - 24 - saw.radius * 0.42);
    saw.x = Math.max(minX, Math.min(maxX, saw.x + dx));
    saw.y = Math.max(minY, Math.min(maxY, saw.y + dy));
    return;
  }

  if (isDraggableRect(target)) {
    const minX = 14;
    const maxX = Math.max(minX, width - 14 - target.w);
    const minY = 14;
    const maxY = Math.max(minY, height - 24 - target.h);
    const nextX = Math.max(minX, Math.min(maxX, target.x + dx));
    const nextY = Math.max(minY, Math.min(maxY, target.y + dy));
    target.kinematicVX = (target.kinematicVX || 0) + (nextX - target.x);
    target.kinematicVY = (target.kinematicVY || 0) + (nextY - target.y);
    target.x = nextX;
    target.y = nextY;
    return;
  }

  if (typeof target.x !== "number" || typeof target.y !== "number") {
    return;
  }

  if (!target.pinned) {
    target.x += dx;
    target.y += dy;
    if (typeof target.oldX === "number") {
      target.oldX += dx * 0.34;
    }
    if (typeof target.oldY === "number") {
      target.oldY += dy * 0.34;
    }
  }
}

function addBungeeRope(aTarget, bTarget) {
  const aPos = getRopeAnchorPosition(aTarget);
  const bPos = getRopeAnchorPosition(bTarget);
  if (!aPos || !bPos) {
    return false;
  }
  const dx = bPos.x - aPos.x;
  const dy = bPos.y - aPos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) {
    return false;
  }

  const minLength = Math.max(42, dist * 0.45);
  bungeeRopes.push({
    a: aTarget,
    b: bTarget,
    minLength,
    stiffness: 0.42,
  });
  return true;
}

function solveBungeeRopes() {
  for (let i = bungeeRopes.length - 1; i >= 0; i -= 1) {
    const rope = bungeeRopes[i];
    const aPos = getRopeAnchorPosition(rope.a);
    const bPos = getRopeAnchorPosition(rope.b);
    if (!aPos || !bPos) {
      bungeeRopes.splice(i, 1);
      continue;
    }

    const dx = bPos.x - aPos.x;
    const dy = bPos.y - aPos.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    if (dist <= rope.minLength) {
      continue;
    }

    const stretch = dist - rope.minLength;
    const tension = stretch * rope.stiffness;
    const nx = dx / dist;
    const ny = dy / dist;
    const ax = nx * tension * 0.5;
    const ay = ny * tension * 0.5;

    applyRopeDisplacement(rope.a, ax, ay);
    applyRopeDisplacement(rope.b, -ax, -ay);
  }
}

function isPointInRect(x, y, rect, pad = 0) {
  return (
    x >= rect.x - pad &&
    x <= rect.x + rect.w + pad &&
    y >= rect.y - pad &&
    y <= rect.y + rect.h + pad
  );
}

function damagePropsInRadius(x, y, radius, damage) {
  for (const prop of props) {
    if (prop.broken) {
      continue;
    }
    const cx = prop.x + prop.w * 0.5;
    const cy = prop.y + prop.h * 0.5;
    const dist = Math.hypot(cx - x, cy - y);
    if (dist > radius) {
      continue;
    }
    chargeDamage(prop, damage * (1 - dist / radius));
    if (prop.hp <= 0) {
      prop.broken = true;
      spawnBreakEffect(cx, cy, "#fb923c");
    }
  }
}

function spawnExplosion(x, y, radius, force, damage, color, profile = "default") {
  const isWeaponBlast = profile === "weapon";
  const loadScale = effects.length > 1600 ? 0.45 : effects.length > 900 ? 0.62 : 1;
  const ringLife = isWeaponBlast ? 32 : 20;
  const ringStartRadius = isWeaponBlast ? 26 : 18;
  const forceScale = isWeaponBlast ? 1.72 : 1;
  effects.push({
    type: "ring",
    x,
    y,
    radius: ringStartRadius,
    maxRadius: radius,
    life: ringLife,
    maxLife: ringLife,
    color,
  });
  spawnBreakEffect(x, y, color);

  const fireCount = Math.max(10, Math.round((isWeaponBlast ? 120 : 36) * loadScale));
  for (let i = 0; i < fireCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (isWeaponBlast ? 3.4 : 1.8) + Math.random() * (isWeaponBlast ? 11.8 : 6);
    effects.push({
      type: "fire",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.7,
      drag: isWeaponBlast ? 0.93 : 0.95,
      gravity: -0.01,
      size: (isWeaponBlast ? 7.5 : 5) + Math.random() * (isWeaponBlast ? 10.5 : 6),
      life: (isWeaponBlast ? 24 : 14) + Math.random() * (isWeaponBlast ? 18 : 10),
      maxLife: isWeaponBlast ? 42 : 24,
      color: i % 3 === 0 ? "#fde047" : "#fb923c",
    });
  }

  const smokeCount = Math.max(8, Math.round((isWeaponBlast ? 74 : 28) * loadScale));
  for (let i = 0; i < smokeCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (isWeaponBlast ? 1.2 : 0.7) + Math.random() * (isWeaponBlast ? 4.2 : 2.2);
    effects.push({
      type: "smoke",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.8,
      drag: isWeaponBlast ? 0.975 : 0.97,
      gravity: -0.03,
      size: (isWeaponBlast ? 17 : 10) + Math.random() * (isWeaponBlast ? 26 : 14),
      life: (isWeaponBlast ? 66 : 34) + Math.random() * (isWeaponBlast ? 46 : 28),
      maxLife: isWeaponBlast ? 120 : 62,
      color: "#475569",
    });
  }

  const sparkCount = Math.max(6, Math.round((isWeaponBlast ? 88 : 18) * loadScale));
  for (let i = 0; i < sparkCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (isWeaponBlast ? 6 : 3.5) + Math.random() * (isWeaponBlast ? 13.5 : 7);
    effects.push({
      type: "spark",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.5,
      drag: isWeaponBlast ? 0.91 : 0.93,
      gravity: 0.1,
      size: (isWeaponBlast ? 2.1 : 1.5) + Math.random() * (isWeaponBlast ? 3.4 : 1.8),
      life: (isWeaponBlast ? 18 : 12) + Math.random() * (isWeaponBlast ? 16 : 10),
      maxLife: isWeaponBlast ? 38 : 22,
      color: "#fef08a",
    });
  }

  if (isWeaponBlast) {
    const delayedSmokeCount = Math.max(10, Math.round(64 * loadScale));
    for (let i = 0; i < delayedSmokeCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.45 + Math.random() * 1.9;
      effects.push({
        type: "smoke",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        drag: 0.978,
        gravity: -0.028,
        size: 14 + Math.random() * 26,
        life: 72 + Math.random() * 56,
        maxLife: 132,
        color: "#334155",
        delay: 8 + Math.floor(Math.random() * 26),
      });
    }
  }

  for (const node of nodes) {
    const dx = node.x - x;
    const dy = node.y - y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    if (dist > radius) {
      continue;
    }

    const strength = (1 - dist / radius) * force * forceScale / node.mass;
    node.oldX -= (dx / dist) * strength;
    node.oldY -= (dy / dist) * strength;
    applyDamageToNode(node, (1 - dist / radius) * damage, color);
  }

  for (const anvil of anvils) {
    const dx = anvil.x - x;
    const dy = anvil.y - y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    if (dist > radius) {
      continue;
    }
    const strength = (1 - dist / radius) * force * forceScale / anvil.mass;
    anvil.oldX -= (dx / dist) * strength;
    anvil.oldY -= (dy / dist) * strength;
  }

  damagePropsInRadius(x, y, radius, damage);
}

function spawnBombExplosion(x, y) {
  spawnExplosion(x, y, 250, 22, 165, "#fb7185");

  const scatterRadius = 285;
  for (const node of nodes) {
    const dx = node.x - x;
    const dy = node.y - y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    if (dist > scatterRadius) {
      continue;
    }

    const falloff = 1 - dist / scatterRadius;
    const chaoticAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.3;
    const blast = (20 * falloff) / node.mass;
    node.oldX -= Math.cos(chaoticAngle) * blast;
    node.oldY -= Math.sin(chaoticAngle) * blast - (0.4 + Math.random() * 1.1);

    if (falloff > 0.55) {
      applyDamageToNode(node, 18 * falloff, "#fb7185");
    }
    if (falloff > 0.65 && Math.random() < 0.35) {
      breakConstraintsForNode(node);
    }
  }

  for (let i = 0; i < 3; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const offset = 20 + Math.random() * 60;
    spawnExplosion(
      x + Math.cos(angle) * offset,
      y + Math.sin(angle) * offset,
      110,
      9.5,
      46,
      "#f97316"
    );
  }
}

function detonateRagdoll(ragdollId, originX, originY) {
  if (typeof ragdollId !== "number" || ragdollId < 0) {
    return;
  }

  wakeRagdoll(ragdollId);
  // Explosive Touch should fling parts violently without deleting them.
  spawnExplosion(originX, originY, 165, 12.5, 0, "#f97316");

  for (const c of constraints) {
    if (c.broken) {
      continue;
    }
    if (c.a.ragdollId === ragdollId || c.b.ragdollId === ragdollId) {
      c.broken = true;
    }
  }

  for (const node of nodes) {
    if (node.ragdollId !== ragdollId) {
      continue;
    }
    const dx = node.x - originX;
    const dy = node.y - originY;
    const baseAngle = Math.atan2(dy, dx);
    const chaoticAngle = baseAngle + (Math.random() - 0.5) * 1.45;
    const blast = (16 + Math.random() * 12) / node.mass;

    node.pinned = false;
    node.oldX = node.x - Math.cos(chaoticAngle) * blast;
    node.oldY = node.y - Math.sin(chaoticAngle) * blast + (2.2 + Math.random() * 2.8);
  }

  for (let i = 0; i < 2; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const offset = 12 + Math.random() * 44;
    spawnExplosion(
      originX + Math.cos(angle) * offset,
      originY + Math.sin(angle) * offset,
      95,
      8.5,
      0,
      "#fb7185"
    );
  }
}

function triggerNuclearBlast(x, y) {
  nuclearBlast.active = true;
  nuclearBlast.detonated = false;
  nuclearBlast.startAt = frameNow;
  nuclearBlast.x = x;
  nuclearBlast.y = y;
  nuclearBlast.blastRadius = Math.hypot(width, height) * 0.8;

  for (let i = 0; i < ragdollStates.length; i += 1) {
    wakeRagdoll(i);
  }

  for (const c of constraints) {
    c.broken = true;
  }

  for (const node of nodes) {
    const dx = node.x - x;
    const dy = node.y - y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const falloff = Math.max(0, 1 - dist / nuclearBlast.blastRadius);
    const chaotic = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.52;
    const blast = (22 + falloff * 30) / Math.max(0.45, node.mass);
    node.oldX = node.x - Math.cos(chaotic) * blast;
    node.oldY = node.y - Math.sin(chaotic) * blast + (3 + falloff * 5);
    node.color = "#0b0b0b";
    node.charred = true;
    chargeDamage(node, 0.6, 1);
  }

  for (const anvil of anvils) {
    const dx = anvil.x - x;
    const dy = anvil.y - y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const falloff = Math.max(0, 1 - dist / nuclearBlast.blastRadius);
    const blast = (26 + falloff * 36) / Math.max(1.2, anvil.mass);
    anvil.oldX = anvil.x - (dx / dist) * blast;
    anvil.oldY = anvil.y - (dy / dist) * blast + 3.2;
  }

  for (const bomb of bombs) {
    const dx = bomb.x - x;
    const dy = bomb.y - y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const falloff = Math.max(0, 1 - dist / nuclearBlast.blastRadius);
    const blast = 14 + falloff * 20;
    bomb.oldX = bomb.x - (dx / dist) * blast;
    bomb.oldY = bomb.y - (dy / dist) * blast + 2.3;
  }

  for (const grenade of launchedGrenades) {
    const dx = grenade.x - x;
    const dy = grenade.y - y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const falloff = Math.max(0, 1 - dist / nuclearBlast.blastRadius);
    const blast = 14 + falloff * 18;
    grenade.oldX = grenade.x - (dx / dist) * blast;
    grenade.oldY = grenade.y - (dy / dist) * blast + 2.1;
  }
}

function applyHitscanImpact(x, y, tool, forceScale = 1) {
  let closestNode = null;
  let closestDist = Infinity;

  for (const node of nodes) {
    const dist = Math.hypot(node.x - x, node.y - y);
    if (dist < closestDist) {
      closestDist = dist;
      closestNode = node;
    }
  }

  if (closestNode && closestDist < 48) {
    const dx = closestNode.x - x;
    const dy = closestNode.y - y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const impulse = (tool.impactForce || 2.2) * forceScale;
    closestNode.oldX -= (dx / dist) * impulse / closestNode.mass;
    closestNode.oldY -= (dy / dist) * impulse / closestNode.mass;
    applyDamageToNode(closestNode, (tool.mode === "scatter" ? 7 : 10) * forceScale, tool.color);
  } else {
    damagePropsInRadius(x, y, 24, 18 * forceScale);
  }

  effects.push({
    type: "spark",
    x,
    y,
    vx: (Math.random() - 0.5) * 2,
    vy: -1 - Math.random() * 2,
    drag: 0.9,
    gravity: 0.08,
    size: 2 + Math.random() * 1.5,
    life: 12,
    maxLife: 12,
    color: "#f8fafc",
  });
}

function maybeShoot(now) {
  if (!pointer.down) {
    return;
  }

  const tool = toolConfigs[activeTool];
  const state = toolState[activeTool];
  if (!tool || !state) {
    return;
  }

  const isRanged = isRangedTool(activeTool);
  if (!isRanged) {
    return;
  }

  if (now - state.lastShotAt < tool.fireRateMs) {
    return;
  }

  const anchor = getShooterAnchor();
  const aimDx = pointer.x - anchor.x;
  const aimDy = pointer.y - anchor.y;
  const baseAngle = Math.atan2(aimDy, aimDx);
  aimAngle = baseAngle;

  state.lastShotAt = now;

  if (tool.mode === "scatter") {
    const pellets = tool.pellets || 5;
    const spread = tool.spread || 0.25;
    for (let i = 0; i < pellets; i += 1) {
      const randomOffset = (Math.random() - 0.5) * spread;
      const shotAngle = baseAngle + randomOffset;
      const hitX = pointer.x + Math.cos(shotAngle) * 16;
      const hitY = pointer.y + Math.sin(shotAngle) * 16;
      applyHitscanImpact(hitX, hitY, tool, 0.75);
    }
    return;
  }

  if (tool.mode === "rocket") {
    spawnExplosion(
      pointer.x,
      pointer.y,
      tool.explosiveRadius || 110,
      tool.explosiveForce || 7.5,
      tool.explosiveDamage || 56,
      tool.color,
      "weapon"
    );
    return;
  }

  if (tool.mode === "grenade") {
    launchGrenade(pointer.x, pointer.y, tool, now);
    return;
  }

  applyHitscanImpact(pointer.x, pointer.y, tool, 1);
}

function triggerSpecial(tool, now) {
  if (!tool || tool.cooldownMs <= 0) {
    return false;
  }

  const state = toolState[activeTool];
  if (now - state.lastSpecialAt < tool.cooldownMs) {
    return false;
  }

  state.lastSpecialAt = now;
  state.specialUntil = now + tool.specialMs;
  effects.push({
    type: "ring",
    x: pointer.x,
    y: pointer.y,
    radius: 16,
    maxRadius: tool.range,
    life: 18,
    maxLife: 18,
    color: tool.color,
  });

  return true;
}

function applyToolForces(now) {
  if (!pointer.down || activeTool === "hand" || activeTool === "health-boost") {
    return;
  }

  const tool = toolConfigs[activeTool];
  if (!tool) {
    return;
  }

  if (
    tool.mode === "projectile" ||
    tool.mode === "scatter" ||
    tool.mode === "rocket" ||
    tool.mode === "grenade" ||
    tool.mode === "heal" ||
    tool.mode === "explode-touch" ||
    tool.mode === "bungee-connect" ||
    tool.mode === "anvil-drop" ||
    tool.mode === "gravity-reverse" ||
    tool.mode === "nuclear"
  ) {
    return;
  }

  const state = toolState[activeTool];
  const specialTriggered = triggerSpecial(tool, now);
  const specialActive = now <= state.specialUntil;
  const specialMultiplier = specialActive ? 1.9 : 1;

  for (const node of nodes) {
    const dx = node.x - pointer.x;
    const dy = node.y - pointer.y;
    const dist = Math.hypot(dx, dy) || 0.0001;

    if (dist > tool.range) {
      continue;
    }

    const falloff = 1 - dist / tool.range;
    const strength = (tool.force * falloff * specialMultiplier) / node.mass;

    if (tool.mode === "push") {
      node.x += (dx / dist) * strength * 2;
      node.y += (dy / dist) * strength * 2;
    }

    if (tool.mode === "blast") {
      node.x += (dx / dist) * strength * 2.8;
      node.y += (dy / dist) * strength * 2.8;
      node.oldY += 0.35 * strength;
    }

    if (tool.mode === "black-hole") {
      const strongRange = Math.min(320, tool.range);
      if (
        node.pinned &&
        typeof node.ragdollId === "number" &&
        dist < strongRange * 0.95
      ) {
        wakeRagdoll(node.ragdollId);
      }
      if (node.pinned) {
        continue;
      }

      const tx = -dy / dist;
      const ty = dx / dist;
      const distanceRatio = Math.max(0, Math.min(1, dist / tool.range));
      const proximity = 1 - distanceRatio;
      const curvedFalloff = proximity ** 3.2;
      const innerQuarterBoost =
        distanceRatio < 0.25 ? 0.6 + ((0.25 - distanceRatio) / 0.25) * 1.25 : 0.08;
      const outerHalfMultiplier =
        distanceRatio > 0.5 ? 0.08 + (1 - distanceRatio) * 0.24 : 1;
      const gravityEffect = Math.max(0.25, Math.min(1.15, 1 / (0.78 + gravityMultiplier * 0.92)));
      const pull =
        (tool.force *
          specialMultiplier *
          gravityEffect *
          outerHalfMultiplier *
          (0.02 + curvedFalloff * 3.4 + innerQuarterBoost)) /
        node.mass;
      if (blackHoleReverseEnabled) {
        const blast = pull * (2.35 + proximity * 1.4);
        const swirl = blast * (0.12 + proximity * 0.18);
        const blastX = (dx / dist) * blast;
        const blastY = (dy / dist) * blast;
        node.x += blastX;
        node.y += blastY;
        node.x -= tx * swirl;
        node.y -= ty * swirl;
        node.oldX -= (dx / dist) * Math.min(8.2, blast * 1.25);
        node.oldY -= (dy / dist) * Math.min(8.2, blast * 1.25);
      } else {
        const swirl = pull * (distanceRatio > 0.5 ? 0.14 : 0.2 + proximity * 0.22);
        let pullX = -(dx / dist) * pull;
        let pullY = -(dy / dist) * pull;

        const floorY = height - 24;
        const nearGround = node.y + node.radius >= floorY - 2;
        if (distanceRatio > 0.5 && nearGround && pullY < 0) {
          pullY *= 0.05;
        }

        node.x += pullX;
        node.y += pullY;
        node.x += tx * swirl;
        node.y += ty * swirl;
        node.oldX += (dx / dist) * Math.min(2.8, pull * 0.36);
        node.oldY += (dy / dist) * Math.min(2.8, pull * 0.36);
      }
    }

    if (tool.mode === "spin") {
      const tx = -dy / dist;
      const ty = dx / dist;
      node.x += tx * strength * 2.6;
      node.y += ty * strength * 2.6;
    }

    if (specialActive && dist < tool.range * 0.55 && node.lastImpactTick !== simulationTick) {
      node.lastImpactTick = simulationTick;
      applyDamageToNode(node, strength * 0.9, tool.color);
    }

  }

  if (tool.mode === "black-hole") {
    for (const anvil of anvils) {
      const dx = anvil.x - pointer.x;
      const dy = anvil.y - pointer.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      if (dist > tool.range) {
        continue;
      }

      const tx = -dy / dist;
      const ty = dx / dist;
      const distanceRatio = Math.max(0, Math.min(1, dist / tool.range));
      const proximity = 1 - distanceRatio;
      const curvedFalloff = proximity ** 3.2;
      const innerQuarterBoost =
        distanceRatio < 0.25 ? 0.6 + ((0.25 - distanceRatio) / 0.25) * 1.25 : 0.08;
      const outerHalfMultiplier =
        distanceRatio > 0.5 ? 0.08 + (1 - distanceRatio) * 0.24 : 1;
      const gravityEffect = Math.max(
        0.25,
        Math.min(1.15, 1 / (0.78 + gravityMultiplier * 0.92))
      );
      const anvilCoupling = 2.8;
      const effectiveMass = Math.max(1.45, anvil.mass * 0.32);
      const pull =
        (tool.force *
          specialMultiplier *
          anvilCoupling *
          gravityEffect *
          outerHalfMultiplier *
          (0.02 + curvedFalloff * 3.4 + innerQuarterBoost)) /
        effectiveMass;
      if (blackHoleReverseEnabled) {
        const blast = pull * (2.45 + proximity * 1.4);
        const swirl = blast * (0.1 + proximity * 0.16);
        const blastX = (dx / dist) * blast;
        const blastY = (dy / dist) * blast;
        anvil.x += blastX;
        anvil.y += blastY;
        anvil.x -= tx * swirl;
        anvil.y -= ty * swirl;
        anvil.oldX -= (dx / dist) * Math.min(9.5, blast * 1.35);
        anvil.oldY -= (dy / dist) * Math.min(9.5, blast * 1.35);
      } else {
        const swirl = pull * (distanceRatio > 0.5 ? 0.14 : 0.2 + proximity * 0.22);
        let pullX = -(dx / dist) * pull;
        let pullY = -(dy / dist) * pull;

        const floorY = height - 24;
        const nearGround = anvil.y + anvil.radius >= floorY - 2;
        if (distanceRatio > 0.5 && nearGround && pullY < 0) {
          pullY *= 0.05;
        }

        anvil.x += pullX;
        anvil.y += pullY;
        anvil.x += tx * swirl;
        anvil.y += ty * swirl;
        anvil.oldX += (dx / dist) * Math.min(5.2, pull * 0.62);
        anvil.oldY += (dy / dist) * Math.min(5.2, pull * 0.62);
      }
    }
  }

  if (specialTriggered) {
    applySpecialWave(tool.mode, tool.range, tool.force);
  }
}

function applySpecialWave(mode, range, force) {
  for (const node of nodes) {
    const dx = node.x - pointer.x;
    const dy = node.y - pointer.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    if (dist > range * 1.25) {
      continue;
    }

    const ratio = 1 - dist / (range * 1.25);
    const pulse = (force * 4.6 * ratio) / node.mass;

    if (mode === "blast") {
      node.oldX -= (dx / dist) * pulse;
      node.oldY -= (dy / dist) * pulse;
    } else if (mode === "black-hole") {
      const tx = -dy / dist;
      const ty = dx / dist;
      if (blackHoleReverseEnabled) {
        node.oldX -= (dx / dist) * pulse * 2.35 + tx * pulse * 0.55;
        node.oldY -= (dy / dist) * pulse * 2.35 + ty * pulse * 0.55;
      } else {
        node.oldX += (dx / dist) * pulse * 1.45 - tx * pulse * 0.85;
        node.oldY += (dy / dist) * pulse * 1.45 - ty * pulse * 0.85;
      }
    } else if (mode === "pull") {
      node.oldX += (dx / dist) * pulse;
      node.oldY += (dy / dist) * pulse;
    } else if (mode === "spin") {
      node.oldX += (-dy / dist) * pulse;
      node.oldY += (dx / dist) * pulse;
    } else {
      node.oldX -= (dx / dist) * pulse * 0.8;
      node.oldY -= (dy / dist) * pulse * 0.8;
    }
  }

  if (mode === "black-hole") {
    for (const anvil of anvils) {
      const dx = anvil.x - pointer.x;
      const dy = anvil.y - pointer.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      if (dist > range * 1.25) {
        continue;
      }

      const ratio = 1 - dist / (range * 1.25);
      const pulse = (force * 4.6 * ratio * 2.1) / Math.max(1.45, anvil.mass * 0.32);
      const tx = -dy / dist;
      const ty = dx / dist;
      if (blackHoleReverseEnabled) {
        anvil.oldX -= (dx / dist) * pulse * 2.35 + tx * pulse * 0.55;
        anvil.oldY -= (dy / dist) * pulse * 2.35 + ty * pulse * 0.55;
      } else {
        anvil.oldX += (dx / dist) * pulse * 1.45 - tx * pulse * 0.85;
        anvil.oldY += (dy / dist) * pulse * 1.45 - ty * pulse * 0.85;
      }
    }
  }
}

function updateProjectiles() {
  const floorY = height - 24;

  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const p = projectiles[i];
    p.life -= 1;

    if (p.mode === "grenade") {
      p.vy += 0.2;
    } else {
      p.vy += 0.02;
    }

    p.x += p.vx;
    p.y += p.vy;

    if (p.mode === "grenade" && p.y > floorY - p.radius) {
      p.y = floorY - p.radius;
      if (!p.bounced) {
        p.vy *= -0.45;
        p.vx *= 0.7;
        p.bounced = true;
      } else {
        p.life = 0;
      }
    }

    let consumed = false;

    for (const node of nodes) {
      const dx = node.x - p.x;
      const dy = node.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > node.radius + p.radius) {
        continue;
      }

      node.oldX -= p.vx * p.impactForce / node.mass;
      node.oldY -= p.vy * p.impactForce / node.mass;
      const baseDamage =
        p.mode === "rocket" || p.mode === "grenade"
          ? 10
          : p.mode === "scatter"
            ? 8
            : 12;
      applyDamageToNode(node, baseDamage, p.color);
      consumed = true;
      break;
    }

    if (!consumed) {
      for (const obstacle of obstacles) {
        if (obstacle.melted) {
          continue;
        }
        if (isPointInRect(p.x, p.y, obstacle, p.radius)) {
          consumed = true;
          break;
        }
      }
    }

    if (!consumed) {
      for (const prop of props) {
        if (prop.broken) {
          continue;
        }
        if (!isPointInRect(p.x, p.y, prop, p.radius)) {
          continue;
        }
        chargeDamage(prop, 18);
        if (prop.hp <= 0) {
          prop.broken = true;
          spawnBreakEffect(prop.x + prop.w * 0.5, prop.y + prop.h * 0.5, "#f59e0b");
        }
        consumed = true;
        break;
      }
    }

    if (p.x < -30 || p.x > width + 30 || p.y < -30 || p.y > height + 40 || p.life <= 0) {
      consumed = true;
    }

    if (consumed) {
      if (p.explosiveRadius > 0) {
        spawnExplosion(
          p.x,
          p.y,
          p.explosiveRadius,
          p.explosiveForce,
          p.explosiveDamage,
          p.color,
          p.mode === "rocket" || p.mode === "grenade" ? "weapon" : "default"
        );
      } else {
        effects.push({
          type: "spark",
          x: p.x,
          y: p.y,
          vx: 0,
          vy: 0,
          size: 2.2,
          life: 8,
          maxLife: 8,
          color: "#f8fafc",
        });
      }
      projectiles.splice(i, 1);
    }
  }
}

function updateLaunchedGrenades(now) {
  for (let i = launchedGrenades.length - 1; i >= 0; i -= 1) {
    const grenade = launchedGrenades[i];
    if (now < grenade.fuseEndAt) {
      continue;
    }

    spawnExplosion(
      grenade.x,
      grenade.y,
      grenade.explosiveRadius,
      grenade.explosiveForce,
      grenade.explosiveDamage,
      grenade.color,
      "weapon"
    );
    launchedGrenades.splice(i, 1);
  }
}

function updateCars(now) {
  for (let i = cars.length - 1; i >= 0; i -= 1) {
    const car = cars[i];
    car.x += car.speed * car.direction;

    const frontX = car.direction > 0 ? car.x + car.w : car.x;
    for (const node of nodes) {
      const inY = node.y + node.radius > car.y && node.y - node.radius < car.y + car.h;
      const hitFront =
        car.direction > 0
          ? node.x - node.radius < frontX && node.x > car.x
          : node.x + node.radius > frontX && node.x < car.x + car.w;
      if (!inY || !hitFront) {
        continue;
      }
      if (node.lastImpactTick === simulationTick && car.hitTick === simulationTick) {
        continue;
      }

      node.lastImpactTick = simulationTick;
      car.hitTick = simulationTick;
      applyDamageToNode(node, car.impactDamage, "#f97316");
      const impulse = (car.impactForce * car.direction) / node.mass;
      if (!node.pinned) {
        node.oldX -= impulse;
        node.oldY -= Math.abs(impulse) * 0.18;
      }
      effects.push({
        type: "spark",
        x: node.x,
        y: node.y,
        vx: car.direction * (2 + Math.random() * 2),
        vy: -1.4 - Math.random() * 1.6,
        drag: 0.9,
        gravity: 0.09,
        size: 2 + Math.random() * 1.5,
        life: 14,
        maxLife: 14,
        color: "#fef08a",
      });
    }

    if (car.direction > 0 && car.x > width + car.w + 30) {
      cars.splice(i, 1);
    } else if (car.direction < 0 && car.x + car.w < -30) {
      cars.splice(i, 1);
    }
  }
}

function getTsunamiFrontXAt(y, includeWobble = false) {
  const direction = tsunami.side === "left" ? 1 : -1;
  const baseFront = tsunami.side === "left" ? tsunami.x + tsunami.width : tsunami.x;
  const bottomY = tsunami.y + tsunami.height;
  const fromGround = Math.max(0, Math.min(1, (bottomY - y) / Math.max(1, tsunami.height)));
  // Wave face should curve from the ground up: near-ground is flatter, crest leans furthest.
  const parabolic = fromGround * fromGround;
  const wobble = includeWobble ? Math.sin((simulationTick + y) * 0.07) * 8 : 0;
  return baseFront + direction * (tsunami.curveDepth * parabolic + wobble);
}

function updateTsunami() {
  if (!tsunami.active) {
    return;
  }

  const direction = tsunami.side === "left" ? 1 : -1;
  tsunami.x += tsunami.speed * direction;
  const backX = tsunami.side === "left" ? tsunami.x : tsunami.x + tsunami.width;
  const maxPushDistance = Math.max(46, tsunami.width * 0.26);

  const applyWavePush = (body, radius = 0) => {
    const inY = body.y + radius > tsunami.y && body.y - radius < tsunami.y + tsunami.height;
    if (!inY) {
      return 0;
    }

    const frontX = getTsunamiFrontXAt(body.y);
    const withinBody =
      tsunami.side === "left"
        ? body.x + radius > backX && body.x - radius < frontX
        : body.x - radius < backX && body.x + radius > frontX;
    let pushRatio = 0;
    if (withinBody) {
      const distFromFront = Math.abs(frontX - body.x);
      pushRatio = Math.max(0.35, 1 - distFromFront / maxPushDistance);
    } else {
      const distToFront = Math.abs(frontX - body.x) - radius;
      if (distToFront > maxPushDistance) {
        return 0;
      }
      pushRatio = Math.max(0.08, 1 - Math.max(0, distToFront) / maxPushDistance);
    }

    const mass = Math.max(0.45, body.mass || 1);
    const impulse = (tsunami.pushForce * pushRatio) / mass;
    body.oldX -= direction * impulse;
    body.oldY -= impulse * 0.08;
    return pushRatio;
  };

  for (const node of nodes) {
    const pushRatio = applyWavePush(node, node.radius);
    if (pushRatio > 0.12) {
      const lastWaveDamageAt = node.lastWaveDamageAt || -Infinity;
      if (frameNow - lastWaveDamageAt > 320) {
        node.lastWaveDamageAt = frameNow;
        applyDamageToNode(node, 0.3, "#7dd3fc");
      }
    }
  }
  for (const anvil of anvils) {
    applyWavePush(anvil, anvil.radius);
  }
  for (const bomb of bombs) {
    applyWavePush(bomb, bomb.radius);
  }
  for (const grenade of launchedGrenades) {
    applyWavePush(grenade, grenade.radius);
  }

  if (simulationTick % 2 === 0) {
    const sprayY = tsunami.y + 20 + Math.random() * Math.max(22, tsunami.height - 34);
    effects.push({
      type: "smoke",
      x: getTsunamiFrontXAt(sprayY, true) + (Math.random() - 0.5) * 10,
      y: sprayY,
      vx: direction * (0.8 + Math.random() * 1.5),
      vy: -0.45 - Math.random() * 0.7,
      drag: 0.95,
      gravity: -0.01,
      size: 8 + Math.random() * 10,
      life: 18 + Math.random() * 14,
      maxLife: 32,
      color: "#7dd3fc",
    });
  }

  if (tsunami.side === "left") {
    if (backX > width + tsunami.width + 42) {
      tsunami.active = false;
    }
  } else if (backX < -tsunami.width - 42) {
    tsunami.active = false;
  }
}

function applySuperRagdollControl() {
  if (!superRagdoll.active || !superRagdoll.refs) {
    return;
  }

  const refs = superRagdoll.refs;
  const superNodes = Array.isArray(refs.allNodes)
    ? refs.allNodes.filter((node) => nodes.includes(node) && !node.destroyed)
    : [];
  if (!superNodes.length) {
    clearSuperRagdoll();
    return;
  }

  const inputX = (keyboardState.ArrowRight ? 1 : 0) - (keyboardState.ArrowLeft ? 1 : 0);
  const inputY = (keyboardState.ArrowDown ? 1 : 0) - (keyboardState.ArrowUp ? 1 : 0);
  if (inputX !== 0 || inputY !== 0) {
    const mag = Math.hypot(inputX, inputY) || 1;
    superRagdoll.directionX = inputX / mag;
    superRagdoll.directionY = inputY / mag;
  }

  const driveX = inputX !== 0 ? inputX : superRagdoll.directionX * 0.58;
  const driveY = inputY !== 0 ? inputY * 0.86 : superRagdoll.directionY * 0.22;
  superRagdoll.punchSide = driveX >= 0 ? "right" : "left";

  for (const node of superNodes) {
    node.pinned = false;
    const coreScale =
      node.part === "chest" || node.part === "belly" || node.part === "hips"
        ? 1
        : node.part === "head" || node.part === "neck"
          ? 0.84
          : 0.74;
    node.oldX -= (driveX * 0.62 * coreScale) / Math.max(0.8, node.mass * 0.6);
    node.oldY -= (driveY * 0.56 * coreScale) / Math.max(0.8, node.mass * 0.6);
    node.oldY += 0.22 * coreScale;
  }

  const punchHand = superRagdoll.punchSide === "right" ? refs.handR : refs.handL;
  const punchElbow = superRagdoll.punchSide === "right" ? refs.elbowR : refs.elbowL;
  const punchShoulder = superRagdoll.punchSide === "right" ? refs.shoulderR : refs.shoulderL;
  if (punchHand && !punchHand.destroyed) {
    const punchDriveX = superRagdoll.directionX || (superRagdoll.punchSide === "right" ? 1 : -1);
    const punchDriveY = superRagdoll.directionY * 0.6;
    punchHand.oldX -= punchDriveX * 1.7;
    punchHand.oldY -= punchDriveY * 1.3;
    if (punchElbow && !punchElbow.destroyed) {
      punchElbow.oldX -= punchDriveX * 0.72;
      punchElbow.oldY -= punchDriveY * 0.56;
    }
    if (punchShoulder && !punchShoulder.destroyed) {
      punchShoulder.oldX -= punchDriveX * 0.28;
      punchShoulder.oldY -= punchDriveY * 0.22;
    }

    if (simulationTick % 2 === 0) {
      effects.push({
        type: "spark",
        x: punchHand.x,
        y: punchHand.y,
        vx: (Math.random() - 0.2) * 2.6 + punchDriveX * 2.4,
        vy: (Math.random() - 0.5) * 1.8 + punchDriveY * 1.4,
        drag: 0.9,
        gravity: 0.04,
        size: 2 + Math.random() * 1.6,
        life: 10,
        maxLife: 10,
        color: "#fde68a",
      });
    }
  }
}

// Standing robots are pinned to a pose; behaviours animate that pose until a hit makes them limp.
const ragdollBehaviors = {
  still: { label: "Stand still", speed: 0, stepRate: 0, legSwing: 0, armSwing: 0, bob: 0 },
  defensive: { label: "Defensive", speed: 0, stepRate: 0.08, legSwing: 0, armSwing: 0, bob: 1.5 },
  walk: { label: "Walk", speed: 0.9, stepRate: 0.16, legSwing: 11, armSwing: 8, bob: 2 },
  stumble: { label: "Stumble", speed: 0.45, stepRate: 0.1, legSwing: 8, armSwing: 12, bob: 4 },
  panic: { label: "Panicked chaos", speed: 2.6, stepRate: 0.42, legSwing: 15, armSwing: 14, bob: 3 },
};
let ragdollBehavior = "still";

function applyRagdollBehavior() {
  const behavior = ragdollBehaviors[ragdollBehavior];
  for (const refs of ragdollRefsList) {
    const ragdollId = refs.head?.ragdollId;
    const state = getRagdollState(ragdollId);
    if (refs.isSuper || !state || state.mode !== "standing") {
      continue;
    }

    state.walkX = state.walkX ?? 0;
    state.facing = state.facing ?? (Math.random() < 0.5 ? -1 : 1);
    state.gait = (state.gait ?? state.phase) + behavior.stepRate;
    const homeX = refs.chest.standX + state.walkX;

    let speed = behavior.speed;
    let leanX = 0;
    let crouch = 0;
    if (ragdollBehavior === "defensive") {
      state.facing = pointer.x < homeX ? -1 : 1;
      crouch = 8;
    } else if (ragdollBehavior === "stumble") {
      speed *= 0.6 + Math.sin(state.gait * 0.7) * 0.6;
      leanX = Math.sin(state.gait * 0.45) * 9;
      if (Math.random() < 0.0008) {
        wakeRagdoll(ragdollId);
        continue;
      }
    } else if (ragdollBehavior === "panic") {
      if (Math.random() < 0.012) {
        state.facing *= -1;
      }
      leanX = state.facing * 6;
    }

    if (homeX < 60) {
      state.facing = 1;
    } else if (homeX > width - 60) {
      state.facing = -1;
    }
    state.walkX += speed * state.facing;

    const swing = Math.sin(state.gait);
    const bob = Math.abs(Math.cos(state.gait)) * behavior.bob;
    const footLift = (side) => Math.max(0, Math.cos(state.gait + side)) * behavior.legSwing * 0.7;
    const offsets = {
      footL: [swing * behavior.legSwing * state.facing, -footLift(0)],
      footR: [-swing * behavior.legSwing * state.facing, -footLift(Math.PI)],
      kneeL: [swing * behavior.legSwing * 0.5 * state.facing, -footLift(0) * 0.5 + crouch * 0.5],
      kneeR: [-swing * behavior.legSwing * 0.5 * state.facing, -footLift(Math.PI) * 0.5 + crouch * 0.5],
      handL: [-swing * behavior.armSwing * state.facing, 0],
      handR: [swing * behavior.armSwing * state.facing, 0],
      elbowL: [-swing * behavior.armSwing * 0.5 * state.facing, 0],
      elbowR: [swing * behavior.armSwing * 0.5 * state.facing, 0],
    };

    if (ragdollBehavior === "defensive") {
      // Guard: fists up in front of the face, elbows tucked toward the chest.
      for (const side of ["L", "R"]) {
        const hand = refs[`hand${side}`];
        const elbow = refs[`elbow${side}`];
        offsets[`hand${side}`] = [
          refs.head.standX + state.facing * (side === "R" ? 18 : 10) - hand.standX,
          refs.head.standY + 14 - hand.standY + crouch,
        ];
        offsets[`elbow${side}`] = [
          refs.chest.standX + state.facing * 12 - elbow.standX,
          refs.chest.standY + 10 - elbow.standY + crouch,
        ];
      }
    } else if (ragdollBehavior === "panic") {
      // Arms thrown up and flailing.
      offsets.handL = [Math.sin(state.gait * 1.7) * behavior.armSwing, -80 + Math.cos(state.gait * 2.1) * 10];
      offsets.handR = [Math.cos(state.gait * 1.9) * behavior.armSwing, -80 + Math.sin(state.gait * 2.3) * 10];
      offsets.elbowL = [offsets.handL[0] * 0.5, -42];
      offsets.elbowR = [offsets.handR[0] * 0.5, -42];
    }

    for (const node of refs.allNodes) {
      if (node.destroyed) {
        continue;
      }
      const isLeg = /^(knee|foot)/.test(node.part);
      const [dx, dy] = offsets[node.part] ?? [0, 0];
      node.poseX = node.standX + state.walkX + dx + (isLeg ? 0 : leanX);
      node.poseY = node.standY + dy + (isLeg ? 0 : crouch - bob);
    }
  }
}

function setRagdollBehavior(key) {
  ragdollBehavior = key;
  document.querySelectorAll("[data-behavior]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.behavior === key));
  });
}

function resolveSuperRagdollPunch() {
  if (!superRagdoll.active || !superRagdoll.refs) {
    return;
  }

  const refs = superRagdoll.refs;
  const punchHand = superRagdoll.punchSide === "right" ? refs.handR : refs.handL;
  if (!punchHand || punchHand.destroyed) {
    return;
  }

  const handVx = punchHand.x - punchHand.oldX;
  const handVy = punchHand.y - punchHand.oldY;
  const punchSpeed = Math.hypot(handVx, handVy);
  if (punchSpeed < 1.4) {
    return;
  }

  const driveX = superRagdoll.directionX || (superRagdoll.punchSide === "right" ? 1 : -1);
  const driveY = superRagdoll.directionY * 0.5;
  const reach = punchHand.radius + 18;

  for (const node of nodes) {
    if (node.destroyed || isSuperRagdollNode(node)) {
      continue;
    }

    const dx = node.x - punchHand.x;
    const dy = node.y - punchHand.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const minDist = node.radius + reach;
    if (dist >= minDist) {
      continue;
    }

    if (node.lastImpactTick === simulationTick) {
      continue;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const force = (18 + punchSpeed * 2.6) / Math.max(0.7, node.mass);
    node.x += nx * Math.min(12, minDist - dist + 2);
    node.y += ny * Math.min(12, minDist - dist + 2);
    node.oldX -= nx * force + driveX * (8.5 / Math.max(0.7, node.mass));
    node.oldY -= ny * force + driveY * (4 / Math.max(0.7, node.mass)) - 2.4 / Math.max(0.7, node.mass);
    node.lastImpactTick = simulationTick;
    applyDamageToNode(node, Math.min(60, 18 + punchSpeed * 6.5), "#facc15");

    effects.push({
      type: "ring",
      x: (node.x + punchHand.x) * 0.5,
      y: (node.y + punchHand.y) * 0.5,
      radius: 12,
      maxRadius: 58,
      life: 10,
      maxLife: 10,
      color: "#fde047",
    });

    for (let i = 0; i < 4; i += 1) {
      effects.push({
        type: "spark",
        x: punchHand.x,
        y: punchHand.y,
        vx: driveX * (2.8 + Math.random() * 2.8) + (Math.random() - 0.5) * 2,
        vy: driveY * (1.5 + Math.random() * 1.8) - 1.3 + (Math.random() - 0.5) * 1.4,
        drag: 0.9,
        gravity: 0.07,
        size: 2 + Math.random() * 1.5,
        life: 12,
        maxLife: 12,
        color: "#fef3c7",
      });
    }
  }
}

function updateBombs(now) {
  for (let i = bombs.length - 1; i >= 0; i -= 1) {
    const bomb = bombs[i];
    const remaining = bomb.fuseEndAt - now;
    bomb.remainingMs = remaining;

    if (remaining <= 0) {
      spawnBombExplosion(bomb.x, bomb.y);
      bombs.splice(i, 1);
      continue;
    }

    if (remaining < 2500 && simulationTick % 10 === 0) {
      effects.push({
        type: "spark",
        x: bomb.x + 6,
        y: bomb.y - bomb.radius - 4,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -1.1 - Math.random() * 0.8,
        drag: 0.88,
        gravity: 0.07,
        size: 1.8,
        life: 10,
        maxLife: 10,
        color: "#fde047",
      });
    }
  }
}

function emitLavaSmoke(x, y, amount = 4) {
  for (let i = 0; i < amount; i += 1) {
    const angle = (Math.random() - 0.5) * Math.PI;
    const speed = 0.6 + Math.random() * 1.8;
    effects.push({
      type: "smoke",
      x,
      y,
      vx: Math.cos(angle) * speed * 0.65,
      vy: -0.8 - Math.random() * 1.4,
      drag: 0.975,
      gravity: -0.03,
      size: 9 + Math.random() * 12,
      life: 44 + Math.random() * 32,
      maxLife: 76,
      color: "#475569",
    });
  }
}

function updateLava(now) {
  if (!lava.active && lava.level <= 0) {
    return;
  }

  if (lava.active) {
    const maxLevel = Math.max(0, height - 96);
    lava.level = Math.min(maxLevel, lava.level + lava.risePerFrame);
  }

  const lavaTop = height - lava.level;
  if (lavaTop >= height) {
    return;
  }

  for (const node of nodes) {
    if (node.destroyed) {
      continue;
    }
    const submerge = node.y + node.radius - lavaTop;
    if (submerge <= 0) {
      continue;
    }
    applyDamageToNode(node, 1.9 + Math.min(3, submerge * 0.11), "#f97316");
    if (simulationTick % 2 === 0) {
      emitLavaSmoke(node.x, Math.max(lavaTop + 2, node.y), 3 + Math.floor(Math.random() * 3));
    }
  }

  for (const prop of props) {
    if (prop.broken) {
      continue;
    }
    const submerge = prop.y + prop.h - lavaTop;
    if (submerge <= 0) {
      continue;
    }
    const immerseRatio = Math.max(0.15, Math.min(1, submerge / prop.h));
    chargeDamage(prop, 1.9 * immerseRatio);
    if (simulationTick % 3 === 0) {
      emitLavaSmoke(prop.x + prop.w * 0.5, lavaTop + 2, 4 + Math.floor(immerseRatio * 4));
    }
    if (prop.hp <= 0) {
      prop.broken = true;
      spawnBreakEffect(prop.x + prop.w * 0.5, prop.y + prop.h * 0.5, "#7f1d1d");
    }
  }

  for (const obstacle of obstacles) {
    if (obstacle.melted) {
      continue;
    }
    const submerge = obstacle.y + obstacle.h - lavaTop;
    if (submerge <= 0) {
      continue;
    }
    const immerseRatio = Math.max(0.1, Math.min(1, submerge / obstacle.h));
    chargeDamage(obstacle, 1.35 * immerseRatio);
    if (simulationTick % 3 === 0) {
      emitLavaSmoke(obstacle.x + obstacle.w * 0.5, lavaTop + 2, 4);
    }
    if (obstacle.hp <= 0) {
      obstacle.melted = true;
      spawnBreakEffect(obstacle.x + obstacle.w * 0.5, obstacle.y + obstacle.h * 0.5, "#7f1d1d");
    }
  }

  for (let i = bombs.length - 1; i >= 0; i -= 1) {
    const bomb = bombs[i];
    if (bomb.y + bomb.radius <= lavaTop) {
      continue;
    }
    spawnBombExplosion(bomb.x, bomb.y);
    bombs.splice(i, 1);
  }

  for (let i = launchedGrenades.length - 1; i >= 0; i -= 1) {
    const grenade = launchedGrenades[i];
    if (grenade.y + grenade.radius <= lavaTop) {
      continue;
    }
    spawnExplosion(
      grenade.x,
      grenade.y,
      grenade.explosiveRadius,
      grenade.explosiveForce,
      grenade.explosiveDamage,
      grenade.color,
      "weapon"
    );
    launchedGrenades.splice(i, 1);
  }

  for (let i = anvils.length - 1; i >= 0; i -= 1) {
    const anvil = anvils[i];
    const submerge = anvil.y + anvil.radius - lavaTop;
    if (submerge <= 0) {
      continue;
    }
    anvil.lavaDamage = (anvil.lavaDamage || 0) + 1.2 + submerge * 0.06;
    if (simulationTick % 2 === 0) {
      emitLavaSmoke(anvil.x, lavaTop + 2, 5);
    }
    if (anvil.lavaDamage > 110) {
      spawnBreakEffect(anvil.x, anvil.y, "#475569");
      anvils.splice(i, 1);
    }
  }

  for (let i = titaniumBalls.length - 1; i >= 0; i -= 1) {
    const ball = titaniumBalls[i];
    const submerge = ball.y + ball.radius - lavaTop;
    if (submerge <= 0) {
      continue;
    }
    emitLavaSmoke(ball.x, lavaTop + 2, 4);
    if (submerge > ball.radius * 0.4) {
      titaniumBalls.splice(i, 1);
      spawnBreakEffect(ball.x, ball.y, "#94a3b8");
    }
  }

  for (let i = cars.length - 1; i >= 0; i -= 1) {
    const car = cars[i];
    if (car.y + car.h <= lavaTop) {
      continue;
    }
    emitLavaSmoke(car.x + car.w * 0.5, lavaTop + 3, 7);
    cars.splice(i, 1);
  }

  if (saw.active && saw.y + saw.radius * 0.35 > lavaTop) {
    saw.active = false;
    emitLavaSmoke(saw.x - saw.radius * 0.3, lavaTop + 4, 8);
  }
}

function updateNuclearBlast() {
  if (!nuclearBlast.active) {
    return;
  }

  const age = frameNow - nuclearBlast.startAt;
  if (!nuclearBlast.detonated && age >= 120) {
    nuclearBlast.detonated = true;
    spawnExplosion(
      nuclearBlast.x,
      nuclearBlast.y,
      Math.max(width, height) * 0.95,
      42,
      0,
      "#f8fafc",
      "weapon"
    );
  }

  if (age > 420) {
    const cloudAge = age - 420;
    const rise = cloudAge * 0.2;
    const cloudBaseY = nuclearBlast.y - 8 - rise;
    const smokeCount = age < 3600 ? 4 : 3;
    for (let i = 0; i < smokeCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const spread = 42 + Math.random() * 130;
      effects.push({
        type: "smoke",
        x: nuclearBlast.x + Math.cos(angle) * spread,
        y: cloudBaseY + Math.sin(angle) * (24 + Math.random() * 36),
        vx: (Math.random() - 0.5) * 1.2,
        vy: -0.7 - Math.random() * 0.8,
        drag: 0.978,
        gravity: -0.03,
        size: 22 + Math.random() * 42,
        life: 110 + Math.random() * 90,
        maxLife: 200,
        color: "#1f2937",
      });
    }

    const cloudTop = cloudBaseY - 260;
    if (cloudTop < -140 && age > 5200) {
      nuclearBlast.active = false;
      return;
    }
  }

  if (age > 12000) {
    nuclearBlast.active = false;
  }
}

function updateEffects() {
  if (effects.length > MAX_EFFECTS) {
    effects.splice(0, effects.length - MAX_EFFECTS);
  }

  for (let i = effects.length - 1; i >= 0; i -= 1) {
    const fx = effects[i];

    if (fx.delay && fx.delay > 0) {
      fx.delay -= 1;
      continue;
    }

    fx.life -= 1;

    if (fx.type === "ring") {
      fx.radius += (fx.maxRadius - fx.radius) * 0.26;
    } else if (fx.type === "impact") {
      fx.radius += ((fx.maxRadius || fx.radius) - fx.radius) * 0.36;
    } else {
      fx.x += fx.vx;
      fx.y += fx.vy;
      fx.vx *= fx.drag ?? 1;
      fx.vy *= fx.drag ?? 1;
      fx.vy += fx.gravity ?? 0.07;

      if (fx.type === "smoke") {
        fx.size += 0.15;
      }
    }

    if (fx.life <= 0) {
      effects.splice(i, 1);
    }
  }
}

function shadeHex(hex, amount) {
  const value = hex.replace("#", "");
  const normalized =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;

  if (!/^[\da-fA-F]{6}$/.test(normalized)) {
    return hex;
  }

  const r = Math.max(0, Math.min(255, parseInt(normalized.slice(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(normalized.slice(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(normalized.slice(4, 6), 16) + amount));
  return `rgb(${r} ${g} ${b})`;
}

function drawGround() {
  const base = height - 24;
  const roomGlow = ctx.createRadialGradient(
    width * 0.5,
    base - 18,
    32,
    width * 0.5,
    base - 18,
    width * 0.72
  );
  roomGlow.addColorStop(0, "rgba(248, 250, 252, 0.08)");
  roomGlow.addColorStop(0.45, "rgba(125, 211, 252, 0.03)");
  roomGlow.addColorStop(1, "rgba(2, 6, 23, 0)");
  ctx.fillStyle = roomGlow;
  ctx.fillRect(0, Math.max(0, base - 180), width, 220);

  const horizon = ctx.createLinearGradient(0, base - 52, 0, base + 3);
  horizon.addColorStop(0, "rgba(248, 250, 252, 0)");
  horizon.addColorStop(0.62, "rgba(148, 163, 184, 0.08)");
  horizon.addColorStop(1, "rgba(15, 23, 42, 0.32)");
  ctx.fillStyle = horizon;
  ctx.fillRect(0, base - 52, width, 58);

  const groundGradient = ctx.createLinearGradient(0, base - 16, 0, height);
  groundGradient.addColorStop(0, "rgba(236, 240, 246, 0.18)");
  groundGradient.addColorStop(0.24, "rgba(148, 163, 184, 0.22)");
  groundGradient.addColorStop(1, "rgba(51, 65, 85, 0.82)");
  ctx.fillStyle = groundGradient;
  ctx.fillRect(0, base - 6, width, height - base + 10);

  const floorGlow = ctx.createLinearGradient(0, base - 4, 0, height);
  floorGlow.addColorStop(0, "rgba(248, 250, 252, 0.08)");
  floorGlow.addColorStop(1, "rgba(2, 6, 23, 0)");
  ctx.fillStyle = floorGlow;
  ctx.fillRect(0, base - 2, width, 12);

  ctx.strokeStyle = "rgba(248, 250, 252, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, base);
  ctx.lineTo(width, base);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let x = -20; x < width + 30; x += 44) {
    const lean = 12 + Math.sin(x * 0.035) * 4;
    ctx.beginPath();
    ctx.moveTo(x, base + 1.5);
    ctx.lineTo(x + lean, base + 11);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(15, 23, 42, 0.16)";
  for (let i = 0; i < 6; i += 1) {
    const y = base + 4 + i * 3.1;
    ctx.beginPath();
    ctx.moveTo(width * 0.18 + i * 34, y);
    ctx.lineTo(width * 0.44 + i * 18, y + 2);
    ctx.moveTo(width * 0.62 - i * 16, y + 1);
    ctx.lineTo(width * 0.86 - i * 27, y + 3);
    ctx.stroke();
  }
}

function drawRectGroundShadow(x, y, w, h, opacityScale = 1) {
  const floorY = height - 24;
  const lift = Math.max(0, floorY - (y + h));
  const alpha = Math.max(0.04, Math.min(0.24, (0.22 - lift / 720) * opacityScale));
  if (alpha <= 0.04) {
    return;
  }

  const rx = Math.max(10, w * 0.34 + lift * 0.038);
  const ry = Math.max(4, h * 0.14 + lift * 0.011);
  const cx = x + w * 0.5 + Math.min(18, lift * 0.02);

  ctx.fillStyle = `rgba(2, 6, 23, ${alpha.toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(cx, floorY - 0.7, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSceneAtmosphere() {
  const upperGlow = ctx.createLinearGradient(0, 0, 0, height * 0.65);
  upperGlow.addColorStop(0, "rgba(248, 250, 252, 0.03)");
  upperGlow.addColorStop(0.34, "rgba(34, 211, 238, 0.018)");
  upperGlow.addColorStop(1, "rgba(15, 23, 42, 0)");
  ctx.fillStyle = upperGlow;
  ctx.fillRect(0, 0, width, height);

  const sideVignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.42,
    Math.min(width, height) * 0.18,
    width * 0.5,
    height * 0.42,
    Math.max(width, height) * 0.82
  );
  sideVignette.addColorStop(0, "rgba(2, 6, 23, 0)");
  sideVignette.addColorStop(1, "rgba(2, 6, 23, 0.3)");
  ctx.fillStyle = sideVignette;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.018)";
  ctx.lineWidth = 1;
  for (let y = 20; y < height; y += 34) {
    const drift = (Math.sin(y * 0.06) + 1) * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, y + drift);
    ctx.lineTo(width, y + drift);
    ctx.stroke();
  }
}

function drawLava() {
  if (lava.level <= 0) {
    return;
  }

  const lavaTop = height - lava.level;
  const wave = Math.sin(simulationTick * 0.09) * 3.2;
  const gradient = ctx.createLinearGradient(0, lavaTop - 18, 0, height);
  gradient.addColorStop(0, "rgba(251, 146, 60, 0.86)");
  gradient.addColorStop(0.45, "rgba(239, 68, 68, 0.9)");
  gradient.addColorStop(1, "rgba(127, 29, 29, 0.96)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, lavaTop + wave, width, height - lavaTop + 24);

  ctx.strokeStyle = "rgba(254, 215, 170, 0.82)";
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.moveTo(0, lavaTop + wave);
  const segments = Math.max(10, Math.floor(width / 56));
  for (let i = 1; i <= segments; i += 1) {
    const x = (i / segments) * width;
    const y = lavaTop + Math.sin(simulationTick * 0.09 + i * 0.55) * 4.4;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawTsunami() {
  if (!tsunami.active) {
    return;
  }

  // Pixel water: stepped depth bands, scrolling ripples, and foam on the face and crest.
  const left = tsunami.side === "left";
  const backX = left ? tsunami.x : tsunami.x + tsunami.width;
  const top = snapPixel(tsunami.y);
  const bottom = tsunami.y + tsunami.height;
  const bands = ["#bfe9ff", "#5cc8f2", "#2a9fd6", "#1477b4", "#0c4f86"];
  ctx.save();
  ctx.globalAlpha = 0.85;
  for (let y = top; y < bottom; y += propPixelSize) {
    const front = snapPixel(getTsunamiFrontXAt(y, true));
    const x0 = Math.min(backX, front);
    const x1 = Math.max(backX, front);
    const depth = (y - tsunami.y) / tsunami.height;
    ctx.fillStyle = bands[Math.min(bands.length - 1, Math.floor(depth * bands.length))];
    ctx.fillRect(x0, y, x1 - x0, propPixelSize);
    if ((y / propPixelSize) % 5 === 0) {
      ctx.fillStyle = "rgba(224, 246, 255, 0.45)";
      for (let x = x0 + ((simulationTick * 2 + y) % 30); x < x1 - 12; x += 30) {
        ctx.fillRect(snapPixel(x), y, 9, propPixelSize);
      }
    }
    const foam = (2 + Math.floor((Math.sin(y * 0.3 + simulationTick * 0.2) + 1) * 1.5)) * propPixelSize;
    ctx.fillStyle = "#f8fdff";
    ctx.fillRect(left ? front - foam : front, y, foam, propPixelSize);
  }
  const crestFront = getTsunamiFrontXAt(top, true);
  for (let x = Math.min(backX, crestFront); x < Math.max(backX, crestFront); x += 15) {
    pixelBlob(x, top + Math.sin(x * 0.05 + simulationTick * 0.15) * 3, 7, "#f8fdff");
  }
  pixelBlob(crestFront, top + 6, 12, "#f8fdff");
  ctx.restore();
}

function drawBungeeRopes() {
  for (const rope of bungeeRopes) {
    const aPos = getRopeAnchorPosition(rope.a);
    const bPos = getRopeAnchorPosition(rope.b);
    if (!aPos || !bPos) {
      continue;
    }
    const dx = bPos.x - aPos.x;
    const dy = bPos.y - aPos.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;

    ctx.strokeStyle = "rgba(32, 5, 5, 0.78)";
    ctx.lineWidth = 5.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(aPos.x + nx * 0.8, aPos.y + ny * 0.8);
    ctx.lineTo(bPos.x + nx * 0.8, bPos.y + ny * 0.8);
    ctx.stroke();

    ctx.strokeStyle = "rgba(127, 29, 29, 0.94)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(aPos.x, aPos.y);
    ctx.lineTo(bPos.x, bPos.y);
    ctx.stroke();
  }

  if (activeTool === "bungee-rope" && bungeeState.pendingTarget) {
    const pendingPos = getRopeAnchorPosition(bungeeState.pendingTarget);
    if (pendingPos) {
      ctx.strokeStyle = "rgba(248, 113, 113, 0.82)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(pendingPos.x, pendingPos.y);
      ctx.lineTo(pointer.x, pointer.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawNuclearBlast() {
  if (!nuclearBlast.active) {
    return;
  }

  const age = frameNow - nuclearBlast.startAt;
  const flashDuration = 340;
  if (age < flashDuration) {
    const alpha = 1 - age / flashDuration;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, alpha)})`;
    ctx.fillRect(0, 0, width, height);
  }

  const glowAge = Math.max(0, age - flashDuration * 0.35);
  const glowDuration = 3600;
  if (glowAge < glowDuration) {
    const glowAlpha = Math.max(0, 0.42 * (1 - glowAge / glowDuration));
    const glow = ctx.createRadialGradient(
      nuclearBlast.x,
      nuclearBlast.y,
      0,
      nuclearBlast.x,
      nuclearBlast.y,
      Math.max(width, height) * 1.25
    );
    glow.addColorStop(0, `rgba(255, 255, 255, ${glowAlpha})`);
    glow.addColorStop(0.45, `rgba(254, 240, 138, ${glowAlpha * 0.7})`);
    glow.addColorStop(1, "rgba(254, 240, 138, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  const shockAge = age - flashDuration;
  if (shockAge > 0 && shockAge < 1400) {
    const progress = shockAge / 1400;
    const radius = Math.max(width, height) * (0.25 + progress * 1.25);
    // Thick dotted pixel shockwave.
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    const dots = Math.round(radius * 0.5);
    ["#fff4c4", "#ffd23f", "#ff8a1f"].forEach((color, ring) => {
      const ringRadius = radius - ring * 9;
      ctx.fillStyle = color;
      for (let i = 0; i < dots; i += 1) {
        const a = (i / dots) * Math.PI * 2;
        ctx.fillRect(
          snapPixel(nuclearBlast.x + Math.cos(a) * ringRadius),
          snapPixel(nuclearBlast.y + Math.sin(a) * ringRadius),
          6,
          6
        );
      }
    });
    ctx.restore();
  }

  const cloudAge = age - 380;
  if (cloudAge > 0) {
    if (nuclearBlast.cloudFor !== nuclearBlast.startAt) {
      nuclearBlast.cloudFor = nuclearBlast.startAt;
      nuclearBlast.cloud = buildMushroomCloud();
    }
    // Blobs cool from flame colours to dark smoke as the cloud rises and spreads.
    const cloudSteps = ["#fff4c4", "#ffd23f", "#ff8a1f", "#e4461c", "#9b1f1f", "#5e4b4b", "#4b505c", "#3b404b", "#30343e"];
    const stepAt = (heat, offset = 0) =>
      cloudSteps[Math.max(0, Math.min(cloudSteps.length - 1, Math.floor((heat + cloudAge / 3200) * cloudSteps.length) + offset))];
    const cx = nuclearBlast.x;
    const baseY = nuclearBlast.y - cloudAge * 0.2;
    const spread = Math.min(1, 0.35 + cloudAge / 1200);
    const { stem, skirt, cap } = nuclearBlast.cloud;
    ctx.save();
    for (const blob of [...stem, ...skirt, ...cap]) {
      const isStem = stem.includes(blob);
      const x = cx + blob.dx * (isStem ? 1 : spread);
      const y = baseY + blob.dy * (isStem ? 1 : spread);
      const r = blob.r * (isStem ? 1 : 0.5 + spread * 0.5);
      pixelBlob(x, y + r * 0.25, r, stepAt(blob.heat, 1));
      pixelBlob(x, y, r * 0.9, stepAt(blob.heat));
      if (cap.includes(blob)) pixelBlob(x - r * 0.25, y - r * 0.3, r * 0.45, stepAt(blob.heat, -1));
    }
    ctx.restore();
  }

  const hazeAlpha = Math.max(0, Math.min(0.34, 0.34 - Math.max(0, age - 2400) / 11000));
  if (hazeAlpha > 0.01) {
    ctx.fillStyle = `rgba(51, 65, 85, ${hazeAlpha})`;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawArena() {
  for (const obstacle of obstacles) {
    if (obstacle.melted) {
      continue;
    }
    drawRectGroundShadow(
      obstacle.x,
      obstacle.y,
      obstacle.w,
      obstacle.h,
      obstacle.type === "drop-car" ? 1.18 : 1
    );
    if (obstacle.type === "six-seven") {
      ctx.save();
      ctx.font = "900 64px Impact, Arial Black, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(15, 23, 42, 0.7)";
      ctx.strokeText("67", obstacle.x + obstacle.w * 0.5, obstacle.y + obstacle.h * 0.54);
      const textFill = ctx.createLinearGradient(
        obstacle.x,
        obstacle.y,
        obstacle.x,
        obstacle.y + obstacle.h
      );
      textFill.addColorStop(0, "#fde047");
      textFill.addColorStop(1, "#f97316");
      ctx.fillStyle = textFill;
      ctx.fillText("67", obstacle.x + obstacle.w * 0.5, obstacle.y + obstacle.h * 0.54);
      ctx.restore();
      continue;
    }
    if (obstacle.type === "drop-car") {
      drawPropSprite(getCarSprite("#f43f5e", obstacle.w, obstacle.h), obstacle.x, obstacle.y);
      continue;
    }
    const body = ctx.createLinearGradient(
      obstacle.x,
      obstacle.y,
      obstacle.x,
      obstacle.y + obstacle.h
    );
    body.addColorStop(0, "rgba(100, 116, 139, 0.72)");
    body.addColorStop(1, "rgba(30, 41, 59, 0.94)");
    ctx.fillStyle = body;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);

    ctx.strokeStyle = "rgba(226, 232, 240, 0.35)";
    ctx.lineWidth = 1.8;
    ctx.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);

    ctx.fillStyle = "rgba(15, 23, 42, 0.35)";
    ctx.fillRect(obstacle.x + 6, obstacle.y + 8, obstacle.w - 12, 8);
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(obstacle.x + 4, obstacle.y + 4, obstacle.w - 8, 6);
    ctx.fillStyle = "rgba(15, 23, 42, 0.16)";
    ctx.fillRect(obstacle.x + obstacle.w - 10, obstacle.y + 2, 8, obstacle.h - 4);
  }

  for (const prop of props) {
    if (prop.broken) {
      continue;
    }
    drawRectGroundShadow(prop.x, prop.y, prop.w, prop.h, 0.82);

    const hpRatio = Math.max(0, prop.hp / prop.maxHp);
    const crate = ctx.createLinearGradient(prop.x, prop.y, prop.x + prop.w, prop.y + prop.h);
    crate.addColorStop(0, `rgba(${176 - (1 - hpRatio) * 55} 118 56 / 0.96)`);
    crate.addColorStop(1, `rgba(${100 - (1 - hpRatio) * 30} 62 30 / 0.98)`);
    ctx.fillStyle = crate;
    ctx.fillRect(prop.x, prop.y, prop.w, prop.h);

    ctx.strokeStyle = "rgba(250, 204, 21, 0.7)";
    ctx.lineWidth = 1.3;
    ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);

    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.fillRect(prop.x + 3, prop.y + 3, prop.w - 6, 4);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.23)";
    ctx.beginPath();
    ctx.moveTo(prop.x + 5, prop.y + 5);
    ctx.lineTo(prop.x + prop.w - 5, prop.y + prop.h - 5);
    ctx.moveTo(prop.x + prop.w - 6, prop.y + 6);
    ctx.lineTo(prop.x + 6, prop.y + prop.h - 6);
    ctx.moveTo(prop.x + prop.w * 0.33, prop.y + 2);
    ctx.lineTo(prop.x + prop.w * 0.33, prop.y + prop.h - 2);
    ctx.moveTo(prop.x + prop.w * 0.66, prop.y + 2);
    ctx.lineTo(prop.x + prop.w * 0.66, prop.y + prop.h - 2);
    ctx.stroke();
  }
}

function drawLimbSegment(a, b, color, thicknessMultiplier = 1) {
  if (!a || !b || a.destroyed || b.destroyed) {
    return;
  }

  const thickness = Math.max(5.5, ((a.radius + b.radius) * 0.5 + 2.7) * thicknessMultiplier);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const highlightOffset = thickness * 0.16;
  const mx = (a.x + b.x) * 0.5;
  const my = (a.y + b.y) * 0.5;

  // Soft cast shadow so limbs sit in the arena depth.
  ctx.strokeStyle = "rgba(0, 0, 0, 0.24)";
  ctx.lineCap = "round";
  ctx.lineWidth = thickness + 3.4;
  ctx.beginPath();
  ctx.moveTo(a.x + nx * 0.5, a.y + 4);
  ctx.lineTo(b.x + nx * 0.5, b.y + 4);
  ctx.stroke();

  // Capsule body with gentle volume shading.
  const volume = ctx.createLinearGradient(
    mx - nx * thickness,
    my - ny * thickness,
    mx + nx * thickness,
    my + ny * thickness
  );
  volume.addColorStop(0, shadeHex(color, -32));
  volume.addColorStop(0.2, shadeHex(color, 22));
  volume.addColorStop(0.8, shadeHex(color, 4));
  volume.addColorStop(1, shadeHex(color, -38));
  ctx.strokeStyle = volume;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  // Exposed connective strand for a darker "guts" look between parts.
  const guts = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  guts.addColorStop(0, "rgba(69, 10, 10, 0.9)");
  guts.addColorStop(0.5, "rgba(127, 29, 29, 0.95)");
  guts.addColorStop(1, "rgba(69, 10, 10, 0.9)");
  ctx.strokeStyle = guts;
  ctx.lineWidth = Math.max(1.8, thickness * 0.2);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  // Rim light to keep segments readable against dark backgrounds.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
  ctx.lineWidth = thickness * 0.27;
  ctx.beginPath();
  ctx.moveTo(a.x + nx * highlightOffset, a.y + ny * highlightOffset - 0.8);
  ctx.lineTo(b.x + nx * highlightOffset, b.y + ny * highlightOffset - 0.8);
  ctx.stroke();

  ctx.strokeStyle = "rgba(15, 23, 42, 0.3)";
  ctx.lineWidth = Math.max(1.1, thickness * 0.13);
  ctx.beginPath();
  ctx.moveTo(a.x - nx * highlightOffset * 0.85, a.y - ny * highlightOffset * 0.85 + 1);
  ctx.lineTo(b.x - nx * highlightOffset * 0.85, b.y - ny * highlightOffset * 0.85 + 1);
  ctx.stroke();
}

function drawJoint(node) {
  if (!node || node.destroyed) {
    return;
  }

  const integrity = getNodeIntegrity(node);
  const wear = 1 - integrity;
  const baseColor = wear > 0.6 ? shadeHex(node.color, -48) : node.color;
  const isHead = node.part === "head";
  const headImage = getNodeHeadImage(node);
  if (isHead && headImage) {
    const size = node.radius * 2.45;
    const neckNode = node.neckNode && !node.neckNode.destroyed ? node.neckNode : null;
    const neckAngle = neckNode
      ? Math.atan2(neckNode.y - node.y, neckNode.x - node.x) - Math.PI * 0.5
      : 0;
    ctx.save();
    ctx.translate(node.x, node.y);
    ctx.rotate(neckAngle);
    ctx.drawImage(headImage, -size * 0.5, -size * 0.44, size, size);
    if (node.charred) {
      ctx.fillStyle = "rgba(2, 6, 23, 0.7)";
      ctx.beginPath();
      ctx.ellipse(0, node.radius * 0.04, node.radius * 1.03, node.radius * 1.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (wear > 0.22) {
      const damageAlpha = Math.min(0.46, wear * 0.55);
      ctx.fillStyle = `rgba(127, 29, 29, ${damageAlpha})`;
      ctx.beginPath();
      ctx.ellipse(
        node.x,
        node.y - node.radius * 0.06,
        node.radius * 0.9,
        node.radius * 1.08,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    return;
  }
  const g = ctx.createRadialGradient(
    node.x - node.radius * 0.25,
    node.y - node.radius * 0.3,
    node.radius * 0.2,
    node.x,
    node.y,
    node.radius * 1.25
  );
  g.addColorStop(0, shadeHex(baseColor, 35));
  g.addColorStop(0.45, baseColor);
  g.addColorStop(1, shadeHex(baseColor, -40));
  ctx.fillStyle = g;
  if (isHead) {
    ctx.beginPath();
    ctx.ellipse(node.x, node.y - node.radius * 0.05, node.radius * 0.92, node.radius * 1.12, 0, 0, Math.PI * 2);
  } else {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.strokeStyle = "rgba(15, 23, 42, 0.45)";
  ctx.lineWidth = 1.15;
  if (isHead) {
    ctx.beginPath();
    ctx.ellipse(
      node.x,
      node.y - node.radius * 0.05,
      Math.max(1, node.radius * 0.92 - 0.4),
      Math.max(1, node.radius * 1.12 - 0.4),
      0,
      0,
      Math.PI * 2
    );
  } else {
    ctx.beginPath();
    ctx.arc(node.x, node.y, Math.max(1, node.radius - 0.5), 0, Math.PI * 2);
  }
  ctx.stroke();

  ctx.fillStyle = "rgba(248, 250, 252, 0.22)";
  ctx.beginPath();
  ctx.arc(
    node.x - node.radius * 0.3,
    node.y - node.radius * 0.34,
    Math.max(1.1, node.radius * 0.24),
    0,
    Math.PI * 2
  );
  ctx.fill();

  if (isHead) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.12)";
    ctx.beginPath();
    ctx.moveTo(node.x - node.radius * 0.5, node.y + node.radius * 0.35);
    ctx.quadraticCurveTo(node.x, node.y + node.radius * 0.76, node.x + node.radius * 0.5, node.y + node.radius * 0.35);
    ctx.quadraticCurveTo(node.x, node.y + node.radius * 0.48, node.x - node.radius * 0.5, node.y + node.radius * 0.35);
    ctx.fill();
  }

  if (wear > 0.32) {
    ctx.strokeStyle = `rgba(127, 29, 29, ${Math.min(0.8, wear)})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(node.x - node.radius * 0.4, node.y - node.radius * 0.2);
    ctx.lineTo(node.x + node.radius * 0.35, node.y + node.radius * 0.28);
    ctx.moveTo(node.x + node.radius * 0.1, node.y - node.radius * 0.42);
    ctx.lineTo(node.x - node.radius * 0.28, node.y + node.radius * 0.34);
    ctx.stroke();
  }

  if (node.damageDecals && node.damageDecals.length > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.clip();

    for (const mark of node.damageDecals) {
      if (mark.kind === "scratch") {
        ctx.strokeStyle = `rgba(120, 30, 30, ${mark.alpha.toFixed(3)})`;
        ctx.lineWidth = Math.max(0.9, node.radius * 0.09);
        ctx.beginPath();
        ctx.moveTo(
          node.x + mark.x - Math.cos(mark.angle + Math.PI * 0.5) * mark.size * 0.5,
          node.y + mark.y - Math.sin(mark.angle + Math.PI * 0.5) * mark.size * 0.5
        );
        ctx.lineTo(
          node.x + mark.x + Math.cos(mark.angle + Math.PI * 0.5) * mark.size * 0.85,
          node.y + mark.y + Math.sin(mark.angle + Math.PI * 0.5) * mark.size * 0.85
        );
        ctx.stroke();
      } else {
        const blot = ctx.createRadialGradient(
          node.x + mark.x,
          node.y + mark.y,
          mark.size * 0.05,
          node.x + mark.x,
          node.y + mark.y,
          mark.size
        );
        blot.addColorStop(0, mark.color);
        blot.addColorStop(1, "rgba(30, 41, 59, 0)");
        ctx.fillStyle = blot;
        ctx.beginPath();
        ctx.arc(node.x + mark.x, node.y + mark.y, mark.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  if (node.hitFlash > 0.02) {
    ctx.strokeStyle = `rgba(255, 241, 214, ${(node.hitFlash * 0.56).toFixed(3)})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius + 1.2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawNodeContactShadow(node) {
  if (!node || node.destroyed) {
    return;
  }

  const floorY = height - 24;
  const lift = Math.max(0, floorY - (node.y + node.radius));
  const alpha = Math.max(0.05, 0.27 - lift / 820);
  if (alpha <= 0.05) {
    return;
  }

  const rx = Math.max(5, node.radius * (1.3 + lift * 0.012));
  const ry = Math.max(2.6, node.radius * (0.4 + lift * 0.003));

  ctx.fillStyle = `rgba(2, 6, 23, ${alpha.toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(node.x, floorY - 0.6, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawRagdollContactShadows(ragdollRefs) {
  const ragdollId = ragdollRefs?.head?.ragdollId;
  if (typeof ragdollId !== "number") {
    return;
  }

  for (const node of nodes) {
    if (node.ragdollId !== ragdollId) {
      continue;
    }
    drawNodeContactShadow(node);
  }
}

function getNodeMaterialProfile(node) {
  const part = node?.part || "";
  if (part === "head" || part === "neck" || part.startsWith("ear")) {
    return { highlight: 0.28, shadow: 0.14, sheen: 0.26, warmTint: true };
  }
  if (part === "chest" || part === "belly" || part === "hips") {
    return { highlight: 0.2, shadow: 0.22, sheen: 0.2, warmTint: false };
  }
  if (part.startsWith("shoulder") || part.startsWith("elbow") || part.startsWith("hand")) {
    return { highlight: 0.17, shadow: 0.2, sheen: 0.16, warmTint: false };
  }
  if (part.startsWith("knee") || part.startsWith("foot")) {
    return { highlight: 0.13, shadow: 0.28, sheen: 0.14, warmTint: false };
  }
  return { highlight: 0.14, shadow: 0.22, sheen: 0.14, warmTint: false };
}

function drawNodeMaterialOverlay(node) {
  if (!node || node.destroyed) {
    return;
  }

  const profile = getNodeMaterialProfile(node);
  const r = node.radius;
  const x = node.x;
  const y = node.y;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  const topLight = ctx.createRadialGradient(
    x - r * 0.34,
    y - r * 0.42,
    r * 0.16,
    x - r * 0.12,
    y - r * 0.08,
    r * 1.34
  );
  topLight.addColorStop(0, `rgba(255, 255, 255, ${profile.highlight})`);
  topLight.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = topLight;
  ctx.fillRect(x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4);

  const underside = ctx.createLinearGradient(x, y - r, x, y + r);
  underside.addColorStop(0, "rgba(15, 23, 42, 0)");
  underside.addColorStop(1, `rgba(15, 23, 42, ${profile.shadow})`);
  ctx.fillStyle = underside;
  ctx.fillRect(x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4);

  if (profile.warmTint) {
    const warm = ctx.createRadialGradient(x, y, r * 0.2, x + r * 0.22, y + r * 0.18, r * 1.05);
    warm.addColorStop(0, `rgba(253, 224, 71, ${profile.sheen * 0.5})`);
    warm.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = warm;
    ctx.fillRect(x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4);
  }

  ctx.restore();
}

function drawRagdollMaterialPass(ragdollRefs) {
  const ragdollNodes = ragdollRefs?.allNodes;
  if (!Array.isArray(ragdollNodes) || ragdollNodes.length === 0) {
    return;
  }

  for (const node of ragdollNodes) {
    drawNodeMaterialOverlay(node);
  }

  const chest = ragdollRefs.chest;
  const belly = ragdollRefs.belly;
  const hips = ragdollRefs.hips;
  if (!chest || !belly || !hips || chest.destroyed || belly.destroyed || hips.destroyed) {
    return;
  }

  ctx.strokeStyle = "rgba(248, 250, 252, 0.16)";
  ctx.lineWidth = Math.max(1.8, chest.radius * 0.23);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(chest.x - chest.radius * 0.22, chest.y - chest.radius * 0.3);
  ctx.quadraticCurveTo(
    belly.x + belly.radius * 0.3,
    belly.y - belly.radius * 0.2,
    hips.x - hips.radius * 0.15,
    hips.y - hips.radius * 0.38
  );
  ctx.stroke();

  ctx.strokeStyle = "rgba(15, 23, 42, 0.18)";
  ctx.lineWidth = Math.max(1.3, chest.radius * 0.2);
  ctx.beginPath();
  ctx.moveTo(chest.x + chest.radius * 0.15, chest.y + chest.radius * 0.32);
  ctx.quadraticCurveTo(
    belly.x - belly.radius * 0.26,
    belly.y + belly.radius * 0.22,
    hips.x + hips.radius * 0.2,
    hips.y + hips.radius * 0.34
  );
  ctx.stroke();
}

function drawCharacterFace(ragdollRefs) {
  const { head, neck } = ragdollRefs;
  if (!head || !neck) {
    return;
  }

  const angle = Math.atan2(neck.y - head.y, neck.x - head.x);
  const ex = Math.cos(angle + Math.PI * 0.5);
  const ey = Math.sin(angle + Math.PI * 0.5);
  const fx = Math.cos(angle);
  const fy = Math.sin(angle);
  const eyeSpread = head.radius * 0.3;

  ctx.fillStyle = "rgba(17, 24, 39, 0.9)";
  ctx.beginPath();
  ctx.ellipse(
    head.x + ex * eyeSpread - fx * 2.2,
    head.y + ey * eyeSpread - fy * 2.8,
    2.1,
    2.6,
    angle,
    0,
    Math.PI * 2
  );
  ctx.ellipse(
    head.x - ex * eyeSpread - fx * 2.2,
    head.y - ey * eyeSpread - fy * 2.8,
    2.1,
    2.6,
    angle,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.strokeStyle = "rgba(30, 41, 59, 0.65)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(head.x - ex * eyeSpread * 1.25 - fx * 3.3, head.y - ey * eyeSpread * 1.25 - fy * 4);
  ctx.lineTo(head.x - ex * eyeSpread * 0.58 - fx * 3.3, head.y - ey * eyeSpread * 0.58 - fy * 4.4);
  ctx.moveTo(head.x + ex * eyeSpread * 1.25 - fx * 3.3, head.y + ey * eyeSpread * 1.25 - fy * 4);
  ctx.lineTo(head.x + ex * eyeSpread * 0.58 - fx * 3.3, head.y + ey * eyeSpread * 0.58 - fy * 4.4);
  ctx.stroke();

  ctx.strokeStyle = "rgba(82, 45, 32, 0.52)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(head.x - fx * 2.2, head.y - fy * 0.7);
  ctx.lineTo(head.x - fx * 1.1 + ex * 0.9, head.y - fy * 1.1 + ey * 0.9);
  ctx.stroke();

  ctx.strokeStyle = "rgba(17, 24, 39, 0.8)";
  ctx.lineWidth = 1.45;
  ctx.beginPath();
  ctx.arc(head.x - fx * 3.2, head.y - fy * 1, head.radius * 0.2, 0.3, Math.PI - 0.3);
  ctx.stroke();
}

function drawHumanExtremities(ragdollRefs) {
  const pairs = [
    [ragdollRefs.elbowL, ragdollRefs.handL],
    [ragdollRefs.elbowR, ragdollRefs.handR],
    [ragdollRefs.kneeL, ragdollRefs.footL],
    [ragdollRefs.kneeR, ragdollRefs.footR],
  ];

  for (const [parent, end] of pairs) {
    if (!parent || !end || parent.destroyed || end.destroyed) {
      continue;
    }
    const dx = end.x - parent.x;
    const dy = end.y - parent.y;
    const angle = Math.atan2(dy, dx);
    const isFoot = end.part?.startsWith("foot");

    ctx.save();
    ctx.translate(end.x, end.y);
    ctx.rotate(angle);
    if (isFoot) {
      ctx.fillStyle = shadeHex(end.color, -8);
      ctx.beginPath();
      ctx.ellipse(0, 0, end.radius * 1.55, end.radius * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = shadeHex(end.color, 6);
      ctx.beginPath();
      ctx.ellipse(0, 0, end.radius * 1.28, end.radius * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawRagdollBodyMass(ragdollRefs) {
  const {
    chest,
    belly,
    hips,
    shoulderL,
    shoulderR,
  } = ragdollRefs;
  if (
    !chest ||
    !belly ||
    !hips ||
    !shoulderL ||
    !shoulderR ||
    chest.destroyed ||
    belly.destroyed ||
    hips.destroyed ||
    shoulderL.destroyed ||
    shoulderR.destroyed
  ) {
    return;
  }

  if (
    !hasIntactConstraint(chest, belly) ||
    !hasIntactConstraint(belly, hips) ||
    !hasIntactConstraint(chest, shoulderL) ||
    !hasIntactConstraint(chest, shoulderR)
  ) {
    return;
  }

  const shoulderDx = shoulderR.x - shoulderL.x;
  const shoulderDy = shoulderR.y - shoulderL.y;
  const shoulderLen = Math.hypot(shoulderDx, shoulderDy) || 1;
  const nx = shoulderDx / shoulderLen;
  const ny = shoulderDy / shoulderLen;

  const shoulderInset = Math.max(3, shoulderL.radius * 0.15);
  const chestHalf = chest.radius * 0.95;
  const bellyHalf = belly.radius * 1.02;
  const hipsHalf = hips.radius * 0.94;

  const leftShoulder = {
    x: shoulderL.x - nx * (shoulderL.radius + shoulderInset),
    y: shoulderL.y - ny * (shoulderL.radius + shoulderInset),
  };
  const rightShoulder = {
    x: shoulderR.x + nx * (shoulderR.radius + shoulderInset),
    y: shoulderR.y + ny * (shoulderR.radius + shoulderInset),
  };
  const chestLeft = { x: chest.x - nx * chestHalf, y: chest.y - ny * chestHalf };
  const chestRight = { x: chest.x + nx * chestHalf, y: chest.y + ny * chestHalf };
  const bellyLeft = { x: belly.x - nx * bellyHalf, y: belly.y - ny * bellyHalf };
  const bellyRight = { x: belly.x + nx * bellyHalf, y: belly.y + ny * bellyHalf };
  const hipsLeft = { x: hips.x - nx * hipsHalf, y: hips.y - ny * hipsHalf };
  const hipsRight = { x: hips.x + nx * hipsHalf, y: hips.y + ny * hipsHalf };

  ctx.save();

  ctx.fillStyle = "rgba(2, 6, 23, 0.2)";
  ctx.beginPath();
  ctx.moveTo(leftShoulder.x, leftShoulder.y + 5);
  ctx.quadraticCurveTo(chestLeft.x, chestLeft.y + 8, bellyLeft.x, bellyLeft.y + 7);
  ctx.quadraticCurveTo(hipsLeft.x, hipsLeft.y + 6, hipsRight.x, hipsRight.y + 6);
  ctx.quadraticCurveTo(bellyRight.x, bellyRight.y + 7, chestRight.x, chestRight.y + 8);
  ctx.quadraticCurveTo(rightShoulder.x, rightShoulder.y + 5, leftShoulder.x, leftShoulder.y + 5);
  ctx.closePath();
  ctx.fill();

  const body = ctx.createLinearGradient(chest.x, chest.y - chest.radius, hips.x, hips.y + hips.radius);
  body.addColorStop(0, shadeHex(chest.color, 20));
  body.addColorStop(0.38, shadeHex(belly.color, 12));
  body.addColorStop(1, shadeHex(hips.color, -12));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(leftShoulder.x, leftShoulder.y);
  ctx.quadraticCurveTo(chestLeft.x, chestLeft.y - 1, bellyLeft.x, bellyLeft.y);
  ctx.quadraticCurveTo(hipsLeft.x, hipsLeft.y + 1, hipsRight.x, hipsRight.y + 1);
  ctx.quadraticCurveTo(bellyRight.x, bellyRight.y, chestRight.x, chestRight.y - 1);
  ctx.quadraticCurveTo(rightShoulder.x, rightShoulder.y, leftShoulder.x, leftShoulder.y);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(leftShoulder.x, leftShoulder.y);
  ctx.quadraticCurveTo(chestLeft.x, chestLeft.y - 1, bellyLeft.x, bellyLeft.y);
  ctx.quadraticCurveTo(hipsLeft.x, hipsLeft.y + 1, hipsRight.x, hipsRight.y + 1);
  ctx.quadraticCurveTo(bellyRight.x, bellyRight.y, chestRight.x, chestRight.y - 1);
  ctx.quadraticCurveTo(rightShoulder.x, rightShoulder.y, leftShoulder.x, leftShoulder.y);
  ctx.closePath();
  ctx.clip();

  const highlight = ctx.createLinearGradient(
    chestLeft.x,
    chest.y - chest.radius,
    chestRight.x,
    hips.y + hips.radius
  );
  highlight.addColorStop(0, "rgba(255, 255, 255, 0.08)");
  highlight.addColorStop(0.45, "rgba(255, 255, 255, 0.2)");
  highlight.addColorStop(1, "rgba(15, 23, 42, 0.06)");
  ctx.fillStyle = highlight;
  ctx.fillRect(
    chest.x - chest.radius * 2.1,
    chest.y - chest.radius * 1.5,
    chest.radius * 4.2,
    hips.y - chest.y + hips.radius * 2
  );

  const sideShade = ctx.createLinearGradient(chestLeft.x, chest.y, chestRight.x, chest.y);
  sideShade.addColorStop(0, "rgba(15, 23, 42, 0.18)");
  sideShade.addColorStop(0.22, "rgba(15, 23, 42, 0)");
  sideShade.addColorStop(0.78, "rgba(15, 23, 42, 0)");
  sideShade.addColorStop(1, "rgba(15, 23, 42, 0.2)");
  ctx.fillStyle = sideShade;
  ctx.fillRect(
    chest.x - chest.radius * 2.1,
    chest.y - chest.radius * 1.5,
    chest.radius * 4.2,
    hips.y - chest.y + hips.radius * 2
  );

  ctx.restore();

  ctx.strokeStyle = "rgba(248, 250, 252, 0.14)";
  ctx.lineWidth = Math.max(1.2, chest.radius * 0.11);
  ctx.beginPath();
  ctx.moveTo(leftShoulder.x + nx * 2, leftShoulder.y + ny * 2);
  ctx.quadraticCurveTo(chestLeft.x + nx * 1.5, chestLeft.y, bellyLeft.x + nx * 1.5, bellyLeft.y);
  ctx.stroke();

  ctx.strokeStyle = "rgba(15, 23, 42, 0.16)";
  ctx.lineWidth = Math.max(1.2, chest.radius * 0.12);
  ctx.beginPath();
  ctx.moveTo(chest.x + nx * chest.radius * 0.12, chest.y + chest.radius * 0.04);
  ctx.quadraticCurveTo(
    belly.x + nx * belly.radius * 0.1,
    belly.y + belly.radius * 0.1,
    hips.x + nx * hips.radius * 0.08,
    hips.y + hips.radius * 0.18
  );
  ctx.stroke();
}

function drawRagdoll(ragdollRefs) {
  const p = ragdollRefs;
  if (!p.head) {
    return;
  }

  drawRagdollContactShadows(p);
  if (p.isSuper && p.chest && p.head) {
    const punchHand = superRagdoll.punchSide === "right" ? p.handR : p.handL;
    const aura = ctx.createRadialGradient(
      p.chest.x,
      p.chest.y,
      p.chest.radius * 0.4,
      p.chest.x,
      p.chest.y,
      p.chest.radius * 3.2
    );
    aura.addColorStop(0, "rgba(250, 204, 21, 0.16)");
    aura.addColorStop(1, "rgba(250, 204, 21, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(p.chest.x, p.chest.y, p.chest.radius * 3.2, 0, Math.PI * 2);
    ctx.fill();

    if (punchHand && !punchHand.destroyed) {
      const fistGlow = ctx.createRadialGradient(
        punchHand.x,
        punchHand.y,
        2,
        punchHand.x,
        punchHand.y,
        punchHand.radius * 4.2
      );
      fistGlow.addColorStop(0, "rgba(255, 249, 196, 0.92)");
      fistGlow.addColorStop(0.32, "rgba(250, 204, 21, 0.7)");
      fistGlow.addColorStop(1, "rgba(250, 204, 21, 0)");
      ctx.fillStyle = fistGlow;
      ctx.beginPath();
      ctx.arc(punchHand.x, punchHand.y, punchHand.radius * 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawRagdollBodyMass(p);

  if (hasIntactConstraint(p.neck, p.chest)) drawLimbSegment(p.neck, p.chest, p.chest.color, 1.15);
  if (hasIntactConstraint(p.chest, p.belly)) drawLimbSegment(p.chest, p.belly, p.belly.color, 1.2);
  if (hasIntactConstraint(p.belly, p.hips)) drawLimbSegment(p.belly, p.hips, p.hips.color, 1.22);

  if (hasIntactConstraint(p.chest, p.shoulderL)) drawLimbSegment(p.chest, p.shoulderL, p.shoulderL.color);
  if (hasIntactConstraint(p.shoulderL, p.elbowL)) drawLimbSegment(p.shoulderL, p.elbowL, p.elbowL.color, 0.95);
  if (hasIntactConstraint(p.elbowL, p.handL)) drawLimbSegment(p.elbowL, p.handL, p.handL.color, 0.88);
  if (hasIntactConstraint(p.chest, p.shoulderR)) drawLimbSegment(p.chest, p.shoulderR, p.shoulderR.color);
  if (hasIntactConstraint(p.shoulderR, p.elbowR)) drawLimbSegment(p.shoulderR, p.elbowR, p.elbowR.color, 0.95);
  if (hasIntactConstraint(p.elbowR, p.handR)) drawLimbSegment(p.elbowR, p.handR, p.handR.color, 0.88);

  if (hasIntactConstraint(p.hips, p.kneeL)) drawLimbSegment(p.hips, p.kneeL, p.kneeL.color, 1.05);
  if (hasIntactConstraint(p.kneeL, p.footL)) drawLimbSegment(p.kneeL, p.footL, p.footL.color, 0.92);
  if (hasIntactConstraint(p.hips, p.kneeR)) drawLimbSegment(p.hips, p.kneeR, p.kneeR.color, 1.05);
  if (hasIntactConstraint(p.kneeR, p.footR)) drawLimbSegment(p.kneeR, p.footR, p.footR.color, 0.92);

  const hasHeadArt = Boolean(getNodeHeadImage(p.head));
  if (!hasHeadArt) {
    if (hasIntactConstraint(p.head, p.earL)) drawLimbSegment(p.head, p.earL, p.earL.color, 0.55);
    if (hasIntactConstraint(p.head, p.earR)) drawLimbSegment(p.head, p.earR, p.earR.color, 0.55);
  }

  const ragdollNodes = Array.isArray(p.allNodes) ? p.allNodes : [];
  for (const node of ragdollNodes) {
    if (hasHeadArt && (node.part === "earL" || node.part === "earR")) {
      continue;
    }
    drawJoint(node);
  }

  drawHumanExtremities(p);
  drawRagdollMaterialPass(p);
  if (!hasHeadArt) {
    drawCharacterFace(p);
  }
}

function drawRagdolls() {
  for (const refs of ragdollRefsList) {
    drawRagdoll(refs);
  }
}

function drawEffects() {
  for (const fx of effects) {
    if (fx.delay && fx.delay > 0) {
      continue;
    }

    if (fx.type === "ring") {
      const alpha = Math.max(0, fx.life / (fx.maxLife || 18));
      ctx.strokeStyle = `${fx.color}${Math.floor(alpha * 180)
        .toString(16)
        .padStart(2, "0")}`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }

    const alpha = Math.max(0, fx.life / (fx.maxLife || 30));
    ctx.save();
    ctx.globalAlpha = alpha;

    if (fx.type === "impact") {
      const burst = ctx.createRadialGradient(fx.x, fx.y, fx.radius * 0.15, fx.x, fx.y, fx.radius);
      burst.addColorStop(0, `${fx.color}cc`);
      burst.addColorStop(1, `${fx.color}00`);
      ctx.fillStyle = burst;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    if (fx.type === "smoke") {
      const smoke = ctx.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, fx.size);
      smoke.addColorStop(0, "rgba(226, 232, 240, 0.25)");
      smoke.addColorStop(1, "rgba(51, 65, 85, 0.02)");
      ctx.fillStyle = smoke;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    if (fx.type === "fire") {
      const glow = ctx.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, fx.size * 1.8);
      glow.addColorStop(0, fx.color);
      glow.addColorStop(1, "rgba(251, 146, 60, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.size * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    if (fx.type === "spark") {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = Math.max(1, fx.size * 0.7);
      ctx.beginPath();
      ctx.moveTo(fx.x - fx.vx * 0.45, fx.y - fx.vy * 0.45);
      ctx.lineTo(fx.x, fx.y);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    ctx.fillStyle = fx.color;
    ctx.fillRect(fx.x, fx.y, fx.size || 3, fx.size || 3);
    ctx.restore();
  }
}

function updateDamageVisuals() {
  for (const node of nodes) {
    if (!node || node.destroyed || !node.hitFlash) {
      continue;
    }
    node.hitFlash *= 0.82;
    if (node.hitFlash < 0.015) {
      node.hitFlash = 0;
    }
  }
}

function drawProjectiles() {
  for (const p of projectiles) {
    const glow = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.radius * 3.5);
    glow.addColorStop(0, `${p.color}ee`);
    glow.addColorStop(1, `${p.color}00`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCars() {
  for (const car of cars) {
    ctx.save();
    ctx.translate(car.x, car.y);
    if (car.direction < 0) {
      ctx.translate(car.w, 0);
      ctx.scale(-1, 1);
    }

    ctx.fillStyle = "rgba(2, 6, 23, 0.34)";
    ctx.beginPath();
    ctx.ellipse(car.w * 0.5, car.h + 8, car.w * 0.45, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    drawPropSprite(getCarSprite(car.color, car.w, car.h), 0, 0);
    ctx.restore();
  }
}

function drawBombs() {
  for (const bomb of bombs) {
    const fuseRatio = Math.max(0, Math.min(1, (bomb.remainingMs || bombFuseMs) / bombFuseMs));
    ctx.fillStyle = "rgba(2, 6, 23, 0.3)";
    ctx.beginPath();
    ctx.ellipse(bomb.x, bomb.y + bomb.radius + 6, bomb.radius * 1.05, bomb.radius * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(
      bomb.x - bomb.radius * 0.3,
      bomb.y - bomb.radius * 0.35,
      2,
      bomb.x,
      bomb.y,
      bomb.radius * 1.4
    );
    body.addColorStop(0, "#f87171");
    body.addColorStop(1, "#7f1d1d");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(bomb.x, bomb.y, bomb.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(248, 250, 252, 0.25)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.arc(bomb.x - bomb.radius * 0.32, bomb.y - bomb.radius * 0.36, bomb.radius * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.arc(bomb.x + 1.5, bomb.y - bomb.radius - 0.5, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(bomb.x + 2, bomb.y - bomb.radius + 2);
    ctx.lineTo(bomb.x + 9, bomb.y - bomb.radius - 8);
    ctx.stroke();

    ctx.fillStyle = fuseRatio > 0.25 ? "#facc15" : "#fb7185";
    ctx.beginPath();
    ctx.arc(bomb.x + 9, bomb.y - bomb.radius - 8, 2.2, 0, Math.PI * 2);
    ctx.fill();

    const timer = Math.max(0, Math.ceil((bomb.remainingMs || 0) / 1000));
    ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
    ctx.beginPath();
    ctx.roundRect(bomb.x - 8, bomb.y - 7, 16, 12, 4);
    ctx.fill();
    ctx.fillStyle = fuseRatio > 0.25 ? "#fef3c7" : "#fecaca";
    ctx.font = "700 9px Avenir Next";
    ctx.textAlign = "center";
    ctx.fillText(String(timer), bomb.x, bomb.y + 2.5);
    ctx.textAlign = "start";
  }
}

function drawLaunchedGrenades(now) {
  for (const grenade of launchedGrenades) {
    const remaining = Math.max(0, grenade.fuseEndAt - now);
    const fuseRatio = Math.max(0, Math.min(1, remaining / grenadeLauncherFuseMs));

    const body = ctx.createRadialGradient(
      grenade.x - grenade.radius * 0.28,
      grenade.y - grenade.radius * 0.32,
      2,
      grenade.x,
      grenade.y,
      grenade.radius * 1.3
    );
    body.addColorStop(0, "#bef264");
    body.addColorStop(1, "#3f6212");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(grenade.x, grenade.y, grenade.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(15, 23, 42, 0.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.strokeStyle = "#a3e635";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(grenade.x, grenade.y - grenade.radius + 2);
    ctx.lineTo(grenade.x + 4, grenade.y - grenade.radius - 6);
    ctx.stroke();

    ctx.fillStyle = fuseRatio < 0.35 ? "#ef4444" : "#facc15";
    ctx.beginPath();
    ctx.arc(grenade.x + 5, grenade.y - grenade.radius - 7, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAnvils() {
  for (const anvil of anvils) {
    ctx.save();
    ctx.translate(anvil.x, anvil.y);

    ctx.fillStyle = "rgba(2, 6, 23, 0.34)";
    ctx.beginPath();
    ctx.ellipse(0, anvil.radius + 8, anvil.radius * 0.86, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createLinearGradient(-anvil.radius, -anvil.radius, anvil.radius, anvil.radius);
    body.addColorStop(0, "#f8fafc");
    body.addColorStop(0.28, "#cbd5e1");
    body.addColorStop(0.64, "#94a3b8");
    body.addColorStop(1, "#334155");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-anvil.radius * 0.95, anvil.radius * 0.45);
    ctx.lineTo(anvil.radius * 0.95, anvil.radius * 0.45);
    ctx.lineTo(anvil.radius * 0.72, -anvil.radius * 0.15);
    ctx.lineTo(anvil.radius * 0.36, -anvil.radius * 0.15);
    ctx.lineTo(anvil.radius * 0.2, -anvil.radius * 0.7);
    ctx.lineTo(-anvil.radius * 0.2, -anvil.radius * 0.7);
    ctx.lineTo(-anvil.radius * 0.36, -anvil.radius * 0.15);
    ctx.lineTo(-anvil.radius * 0.72, -anvil.radius * 0.15);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.beginPath();
    ctx.moveTo(-anvil.radius * 0.54, -anvil.radius * 0.42);
    ctx.lineTo(anvil.radius * 0.08, -anvil.radius * 0.42);
    ctx.lineTo(anvil.radius * 0.2, -anvil.radius * 0.12);
    ctx.lineTo(-anvil.radius * 0.66, -anvil.radius * 0.12);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(15, 23, 42, 0.24)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-anvil.radius * 0.72, -anvil.radius * 0.15);
    ctx.lineTo(anvil.radius * 0.72, -anvil.radius * 0.15);
    ctx.moveTo(-anvil.radius * 0.2, -anvil.radius * 0.68);
    ctx.lineTo(anvil.radius * 0.2, -anvil.radius * 0.68);
    ctx.stroke();

    ctx.strokeStyle = "rgba(241, 245, 249, 0.55)";
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
  }
}

function drawTitaniumBalls() {
  for (const ball of titaniumBalls) {
    const vx = ball.x - ball.oldX;
    const vy = ball.y - ball.oldY;
    const speed = Math.hypot(vx, vy);
    if (speed > 0.6) {
      const tx = vx / (speed || 1);
      const ty = vy / (speed || 1);
      const trail = ctx.createLinearGradient(
        ball.x,
        ball.y,
        ball.x - tx * ball.radius * 3.6,
        ball.y - ty * ball.radius * 3.6
      );
      trail.addColorStop(0, "rgba(226, 232, 240, 0.5)");
      trail.addColorStop(1, "rgba(148, 163, 184, 0)");
      ctx.strokeStyle = trail;
      ctx.lineWidth = Math.max(2.4, ball.radius * 0.45);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x - tx * ball.radius * 3.6, ball.y - ty * ball.radius * 3.6);
      ctx.stroke();
    }

    const shell = ctx.createRadialGradient(
      ball.x - ball.radius * 0.32,
      ball.y - ball.radius * 0.36,
      2,
      ball.x,
      ball.y,
      ball.radius * 1.25
    );
    shell.addColorStop(0, "#f8fafc");
    shell.addColorStop(0.35, "#cbd5e1");
    shell.addColorStop(0.75, "#94a3b8");
    shell.addColorStop(1, "#334155");
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(15, 23, 42, 0.45)";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
    ctx.beginPath();
    ctx.arc(ball.x - ball.radius * 0.33, ball.y - ball.radius * 0.35, ball.radius * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSawBlade() {
  if (!saw.active) {
    return;
  }

  ctx.save();
  ctx.translate(saw.x, saw.y);
  ctx.rotate(saw.angle);

  const bodyR = Math.round(saw.radius / propPixelSize);
  const size = (bodyR + 3) * 2 + 1;
  const sprite = getPropSprite(`saw-${size}`, size, size, (p) => paintSaw(p, size, bodyR));
  drawPropSprite(sprite, (-size * propPixelSize) / 2, (-size * propPixelSize) / 2);
  ctx.restore();
}

function drawBambooClub(angle) {
  ctx.rotate(angle);
  const wood = ctx.createLinearGradient(-10, 0, 70, 0);
  wood.addColorStop(0, "#725334");
  wood.addColorStop(1, "#3f2f1e");
  ctx.fillStyle = wood;
  ctx.fillRect(-8, -5, 78, 10);
  ctx.fillStyle = "#9ca3af";
  ctx.beginPath();
  ctx.arc(70, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(59, -6);
  ctx.lineTo(80, 6);
  ctx.stroke();
}

function drawThunderHammer(angle) {
  ctx.rotate(angle);
  const grip = ctx.createLinearGradient(-14, 0, 44, 0);
  grip.addColorStop(0, "#6b7280");
  grip.addColorStop(1, "#111827");
  ctx.fillStyle = grip;
  ctx.fillRect(-14, -5, 58, 10);
  const head = ctx.createLinearGradient(38, 0, 90, 0);
  head.addColorStop(0, "#f59e0b");
  head.addColorStop(1, "#b45309");
  ctx.fillStyle = head;
  ctx.fillRect(40, -18, 34, 36);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.strokeRect(40, -18, 34, 36);
}

function drawWaterLance(angle, activeSpin = false) {
  ctx.rotate(angle);
  const spin = activeSpin ? simulationTick * 0.28 : 0;

  ctx.save();
  ctx.rotate(spin);
  ctx.beginPath();
  ctx.ellipse(0, 0, 19, 15, 0, 0, Math.PI * 2);
  const orb = ctx.createRadialGradient(-4, -3, 2, 0, 0, 22);
  orb.addColorStop(0, "rgba(34, 211, 238, 0.95)");
  orb.addColorStop(0.45, "rgba(15, 23, 42, 0.9)");
  orb.addColorStop(1, "rgba(2, 6, 23, 0.96)");
  ctx.fillStyle = orb;
  ctx.fill();

  ctx.strokeStyle = "rgba(103, 232, 249, 0.75)";
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.arc(0, 0, 22, -0.5, Math.PI * 1.12);
  ctx.stroke();

  ctx.strokeStyle = "rgba(165, 243, 252, 0.55)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, 0, 14, -1.2, Math.PI * 1.24);
  ctx.stroke();
  ctx.restore();
}

function drawAnvilDropper(angle) {
  ctx.rotate(angle);
  ctx.fillStyle = "#9ca3af";
  ctx.beginPath();
  ctx.moveTo(-11, 6);
  ctx.lineTo(11, 6);
  ctx.lineTo(8, -1);
  ctx.lineTo(3, -1);
  ctx.lineTo(1, -9);
  ctx.lineTo(-1, -9);
  ctx.lineTo(-3, -1);
  ctx.lineTo(-8, -1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(241, 245, 249, 0.6)";
  ctx.lineWidth = 1.1;
  ctx.stroke();
}

// Pixel-art weapons. Each row is one line of pixels; "." is empty and every
// other letter is a colour from the shared palette plus the sprite's own glow.
const weaponPixelSize = 3;
const weaponBasePalette = {
  k: "#0a0d16", // outline
  d: "#1b2130", // shadow
  m: "#2c3446", // body
  l: "#46516a", // light
  h: "#6b7891", // top highlight
  y: "#facc15", // accent
};

const weaponSprites = {
  shotgun: {
    glow: ["#38bdf8", "#bae6fd"],
    grip: [12, 6],
    rows: [
      "..........kkkkkkkk",
      ".........khhhhhhhhkkkkkkkkkkkkkkkkkk",
      "kkk.....kllllllllllhhhhhhhhhhhhhhhhhk",
      "kmmkkkkkkmmmyymmmmmlllgggggGGGGGgggllk",
      "kmmmmmmmmmmyyymmmmmkkkkkkkkkkkkkkkkkkk",
      "kggggggggmmmymmmmmmkkmGmGmGmGmGmkkkk",
      ".kkkkmmmmmmmmmmmkkkkkdmdmdmdmdmdk",
      ".....kkkkkmmmmkk....kkkkkkkkkkkk",
      ".........kmmmk",
      ".........kmmk",
      ".........kkkk",
    ],
  },
  rocket: {
    glow: ["#f97316", "#fed7aa"],
    grip: [12, 7],
    rows: [
      "kkkk..............................kkkk",
      "kllkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkllk",
      "kllhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhllk",
      "kllmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmllk",
      "kllmmgggGGGGgggmmmmmmmmyymmmmmmmmmmllk",
      "kllddddddddddddddddddddddddddddddddllk",
      "kllkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkllk",
      "kkkk.......kmmk...kmmk............kkkk",
      "...........kmmk...kddk",
      "...........kmmk...kkkk",
      "...........kkkk",
    ],
  },
  grenade: {
    glow: ["#84cc16", "#d9f99d"],
    grip: [8, 7],
    rows: [
      "......kkkkkkkkkkkkkkkkkkk",
      ".....khhhhhhhhhhhhhhhhhhhkkkkk",
      "kkk.kllllllllllllllllllllkhhhk",
      "kmmkkmmmyymmmmmmmmmmmmmmmkgGgk",
      "kmmmmmmmmymmmmmmmmmmmmmmmkgGgk",
      "kggggggmmmmmmmmkkkkkkkkkkkdddk",
      ".kkkkkkmmmmmmmkddddddk...kkkkk",
      "......kmmmk.kdddggdddk",
      "......kmmk..kddgGgddk",
      "......kmmk...kddddk",
      "......kkkk....kkkk",
    ],
  },
  bat: {
    glow: ["#c084fc", "#f5d0fe"],
    grip: [2, 2],
    // TODO(human): draw the Psychic Bat
    rows: [
      "kkkkkkkkkkkkkkkkkkkkkkk",
      "kmmmmmmmmmmmmmmmmmmmmmk",
      "kkkkkkkkkkkkkkkkkkkkkkk",
    ],
  },
};

const weaponSpriteCache = {};

function getWeaponSprite(key) {
  if (weaponSpriteCache[key]) {
    return weaponSpriteCache[key];
  }
  const sprite = weaponSprites[key];
  const palette = { ...weaponBasePalette, g: sprite.glow[0], G: sprite.glow[1] };
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(...sprite.rows.map((row) => row.length));
  canvas.height = sprite.rows.length;
  const spriteCtx = canvas.getContext("2d");
  sprite.rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (palette[cell]) {
        spriteCtx.fillStyle = palette[cell];
        spriteCtx.fillRect(x, y, 1, 1);
      }
    });
  });
  weaponSpriteCache[key] = canvas;
  return canvas;
}

function drawWeaponSprite(key, angle) {
  ctx.rotate(angle);
  // Keep the grip below the barrel when aiming left.
  if (Math.cos(angle) < 0) {
    ctx.scale(1, -1);
  }
  const canvas = getWeaponSprite(key);
  const [gripX, gripY] = weaponSprites[key].grip;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    canvas,
    -gripX * weaponPixelSize,
    -gripY * weaponPixelSize,
    canvas.width * weaponPixelSize,
    canvas.height * weaponPixelSize
  );
}

// Pixel-art props are painted once into small canvases, then scaled up without smoothing.
const propPixelSize = 3;
const propSpriteCache = {};

function getPropSprite(key, w, h, paint) {
  if (!propSpriteCache[key]) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    paint(canvas.getContext("2d"), w, h);
    propSpriteCache[key] = canvas;
  }
  return propSpriteCache[key];
}

function drawPropSprite(sprite, x, y) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, x, y, sprite.width * propPixelSize, sprite.height * propPixelSize);
}

function fillPixelDisc(p, cx, cy, r, color) {
  p.fillStyle = color;
  for (let y = -r; y <= r; y += 1) {
    const half = Math.round(Math.sqrt(r * r - y * y));
    p.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

function paintCar(p, w, h, color) {
  const outline = "#0a0d16";
  const light = shadeHex(color, 45);
  const shadow = shadeHex(color, -40);
  const wheelY = h - 8;
  const roofL = Math.round(w * 0.3);
  const roofR = Math.round(w * 0.62);
  const cabin = [];
  for (let r = 0; r < 8; r += 1) {
    cabin.push([roofL - Math.round(r * 0.6), 2 + r, roofR + Math.round(r * 1.6) - (roofL - Math.round(r * 0.6))]);
  }
  const body = [];
  for (let y = 10; y <= wheelY; y += 1) {
    const inset = y === 10 ? 3 : y === 11 ? 1 : y === wheelY ? 2 : 0;
    body.push([1 + inset, y, w - 2 - inset * 2]);
  }
  // Outline first (one pixel larger), then the paint.
  p.fillStyle = outline;
  for (const [x, y, len] of [...cabin, ...body]) p.fillRect(x - 1, y - 1, len + 2, 3);
  for (const [x, y, len] of cabin) {
    p.fillStyle = y === 2 ? light : color;
    p.fillRect(x, y, len, 1);
  }
  for (const [x, y, len] of body) {
    p.fillStyle = y <= 11 ? light : y >= wheelY - 3 ? shadow : color;
    p.fillRect(x, y, len, 1);
  }
  // Windows split by a pillar, with a glint.
  for (const [x, y, len] of cabin.slice(1, 7)) {
    p.fillStyle = "#2b5d7a";
    p.fillRect(x + 2, y, len - 4, 1);
  }
  const pillar = Math.round((roofL + roofR) / 2);
  p.fillStyle = color;
  p.fillRect(pillar, 3, 2, 6);
  p.fillStyle = "#9fd8f5";
  for (let i = 0; i < 4; i += 1) {
    p.fillRect(pillar + 6 + i, 7 - i, 2, 1);
    p.fillRect(roofL + 2 + i, 7 - i, 2, 1);
  }
  // Door seam, handle, lights, bumpers.
  p.fillStyle = outline;
  p.fillRect(pillar, 11, 1, wheelY - 13);
  p.fillStyle = light;
  p.fillRect(pillar + 3, 13, 3, 1);
  p.fillRect(pillar - 6, 13, 3, 1);
  p.fillStyle = "#fde68a";
  p.fillRect(w - 4, 12, 2, 3);
  p.fillStyle = "#ef4444";
  p.fillRect(1, 12, 2, 3);
  p.fillStyle = "#3a4250";
  p.fillRect(0, wheelY - 3, 4, 2);
  p.fillRect(w - 4, wheelY - 3, 4, 2);
  // Wheel arches and wheels.
  for (const cx of [Math.round(w * 0.2), Math.round(w * 0.8)]) {
    fillPixelDisc(p, cx, wheelY, 7, outline);
    fillPixelDisc(p, cx, wheelY, 5, "#1f232b");
    fillPixelDisc(p, cx, wheelY, 2, "#9aa3b2");
    p.fillStyle = "#4b5563";
    p.fillRect(cx, wheelY, 1, 1);
  }
}

function getCarSprite(color, w, h) {
  const cw = Math.round(w / propPixelSize);
  const ch = Math.round(h / propPixelSize);
  return getPropSprite(`car-${color}-${cw}x${ch}`, cw, ch, (p) => paintCar(p, cw, ch, color));
}

function paintSaw(p, size, bodyR) {
  const c = (size - 1) / 2;
  const toothBase = bodyR - 4;
  const teeth = 22;
  const cells = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - c;
      const dy = y - c;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      let color = null;
      if (r > toothBase && r <= c) {
        const t = (((a / (Math.PI * 2)) * teeth) % 1 + 1) % 1;
        const reach = 1 - (r - toothBase) / (c - toothBase);
        if (t < reach * 0.85) color = t < 0.2 ? "#e2e8f0" : "#94a3b8";
      } else if (r <= toothBase) {
        const hole = [0, 1, 2].some((k) => {
          const ha = (k * Math.PI * 2) / 3;
          return Math.hypot(dx - Math.cos(ha) * 17, dy - Math.sin(ha) * 17) < 5;
        });
        const lightness = Math.sin(a + 0.8);
        if (r < 3 || (r >= 7 && r < 9) || hole) color = "#0a0d16";
        else if (r < 7) color = Math.floor((a + Math.PI) / (Math.PI / 4)) % 2 ? "#facc15" : "#0a0d16";
        else if (r >= 22 && r < 26) color = Math.floor((a + Math.PI) / (Math.PI / 6)) % 2 ? "#b91c1c" : "#7f1d1d";
        else if (r >= toothBase - 3) color = "#64748b";
        else if (Math.floor(r) % 6 === 0) color = "#8b95a6";
        else color = lightness > 0.5 ? "#cbd5e1" : lightness < -0.5 ? "#7c8798" : "#a3aebf";
      }
      cells.push(color);
    }
  }
  // Outline any filled pixel that touches empty space.
  const at = (x, y) => (x < 0 || y < 0 || x >= size || y >= size ? null : cells[y * size + x]);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const color = at(x, y);
      if (!color) continue;
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      p.fillStyle = edge ? "#0a0d16" : color;
      p.fillRect(x, y, 1, 1);
    }
  }
}

function buildMushroomCloud() {
  const rand = (min, max) => min + Math.random() * (max - min);
  const stem = [];
  for (let i = 0; i < 10; i += 1) {
    stem.push({ dx: rand(-10, 10), dy: 40 + i * 26, r: 30 - i * 0.6 + rand(0, 6), heat: 0.45 - i * 0.04 });
  }
  const skirt = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 7) * Math.PI;
    skirt.push({ dx: Math.cos(a) * 110, dy: 12 + Math.sin(a) * 18, r: rand(26, 36), heat: 0.45 });
  }
  const cap = [];
  for (let i = 0; i < 16; i += 1) {
    const a = Math.PI + (i / 15) * Math.PI;
    cap.push({ dx: Math.cos(a) * 140 + rand(-8, 8), dy: -40 + Math.sin(a) * 60, r: rand(42, 58), heat: rand(0.2, 0.4) });
  }
  for (let i = 0; i < 5; i += 1) {
    cap.push({ dx: rand(-70, 70), dy: rand(-70, -30), r: rand(56, 68), heat: 0 });
  }
  return { stem, skirt, cap };
}

function drawPsychicBat(angle) {
  drawWeaponSprite("bat", angle);
}

function drawPokePistol(angle) {
  ctx.rotate(angle);
  ctx.fillStyle = "#374151";
  ctx.fillRect(-10, -7, 40, 14);
  ctx.fillRect(-2, 7, 10, 18);
  ctx.fillStyle = "#9ca3af";
  ctx.fillRect(28, -4, 16, 8);
}

function drawRangerShotgun(angle) {
  drawWeaponSprite("shotgun", angle);
}

function drawRocketLauncher(angle) {
  drawWeaponSprite("rocket", angle);
}

function drawGrenadeLauncher(angle) {
  drawWeaponSprite("grenade", angle);
}

function drawReticle() {
  ctx.save();
  ctx.translate(pointer.x, pointer.y);
  ctx.strokeStyle = "rgba(248, 250, 252, 0.95)";
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(-6, 0);
  ctx.moveTo(6, 0);
  ctx.lineTo(18, 0);
  ctx.moveTo(0, -18);
  ctx.lineTo(0, -6);
  ctx.moveTo(0, 6);
  ctx.lineTo(0, 18);
  ctx.stroke();
  ctx.restore();
}

function drawHealthBoostCursor() {
  ctx.save();
  ctx.translate(pointer.x, pointer.y);
  ctx.strokeStyle = "rgba(34, 197, 94, 0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(6, 0);
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 6);
  ctx.stroke();
  ctx.restore();
}

function drawExplosiveTouchCursor() {
  ctx.save();
  ctx.translate(pointer.x, pointer.y);
  ctx.fillStyle = "rgba(251, 146, 60, 0.95)";
  ctx.strokeStyle = "rgba(124, 45, 18, 0.9)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawGravityReverserCursor() {
  ctx.save();
  ctx.translate(pointer.x, pointer.y);
  ctx.strokeStyle = "rgba(56, 189, 248, 0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(0, 8);
  ctx.moveTo(-4, -4);
  ctx.lineTo(0, -8);
  ctx.lineTo(4, -4);
  ctx.moveTo(-4, 4);
  ctx.lineTo(0, 8);
  ctx.lineTo(4, 4);
  ctx.stroke();
  ctx.restore();
}

function drawBungeeCursor() {
  ctx.save();
  ctx.translate(pointer.x, pointer.y);
  ctx.strokeStyle = "rgba(127, 29, 29, 0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(7, 0);
  ctx.stroke();
  ctx.restore();
}

function drawWeaponOverlay(toolKey) {
  const anchor = getShooterAnchor();
  const angle = Math.atan2(pointer.y - anchor.y, pointer.x - anchor.x);
  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.globalAlpha = 0.9;

  if (toolKey === "ranger-shotgun") {
    drawRangerShotgun(angle);
  } else if (toolKey === "rocket-launcher") {
    drawRocketLauncher(angle);
  } else if (toolKey === "grenade-launcher") {
    drawGrenadeLauncher(angle);
  }
  ctx.restore();
}

function drawToolCursor() {
  const tool = toolConfigs[activeTool];
  if (!tool) {
    return;
  }

  if (isRangedTool(activeTool)) {
    drawWeaponOverlay(activeTool);
    drawReticle();
    return;
  }

  if (activeTool === "health-boost") {
    drawHealthBoostCursor();
    return;
  }

  if (activeTool === "explosive-touch") {
    drawExplosiveTouchCursor();
    return;
  }

  if (activeTool === "gravity-reverser") {
    drawGravityReverserCursor();
    return;
  }

  if (activeTool === "bungee-rope") {
    drawBungeeCursor();
    return;
  }

  if (activeTool === "nuclear-bomb") {
    drawReticle();
    return;
  }

  const moveX = pointer.x - pointer.prevX;
  const moveY = pointer.y - pointer.prevY;
  const angle = Math.hypot(moveX, moveY) > 0.2 ? Math.atan2(moveY, moveX) : aimAngle;

  ctx.save();
  ctx.translate(pointer.x, pointer.y);

  if (activeTool === "hand") {
    ctx.fillStyle = "rgba(248, 250, 252, 0.8)";
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(15, 23, 42, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    if (activeTool !== "water-lance") {
      ctx.strokeStyle = `${tool.color}55`;
      ctx.setLineDash([5, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, tool.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (activeTool === "water-lance") {
      drawWaterLance(angle, pointer.down);
    } else if (activeTool === "anvil-dropper") {
      drawAnvilDropper(angle);
    } else if (activeTool === "psychic-bat") {
      drawPsychicBat(angle);
    } else if (activeTool === "ranger-shotgun") {
      drawRangerShotgun(angle);
    } else if (activeTool === "rocket-launcher") {
      drawRocketLauncher(angle);
    } else if (activeTool === "grenade-launcher") {
      drawGrenadeLauncher(angle);
    }
  }

  ctx.restore();
}

function getCooldownText(now, toolKey) {
  const tool = toolConfigs[toolKey];
  if (!tool) {
    return "Special: n/a";
  }

  if (tool.fireRateMs) {
    const roundsPerSecond = (1000 / tool.fireRateMs).toFixed(1);
    return `Rate: ${roundsPerSecond}/s`;
  }

  if (tool.cooldownMs === 0) {
    return "Special: n/a";
  }

  const state = toolState[toolKey];
  const remaining = tool.cooldownMs - (now - state.lastSpecialAt);
  if (remaining <= 0) {
    return "Special: Ready";
  }

  return `Special cooldown: ${(remaining / 1000).toFixed(1)}s`;
}

function updateWeaponStatus(now) {
  const status = document.getElementById("weaponStatus");
  if (!status) {
    return;
  }

  const text = getCooldownText(now, activeTool);
  status.textContent = text === "Special: n/a" ? "" : text;
}

function getRagdollIntegrityPercent() {
  const regularNodes = nodes.filter((node) => !isSuperRagdollNode(node));
  if (!regularNodes.length) {
    return 100;
  }
  let hp = 0;
  let maxHp = 0;
  for (const node of regularNodes) {
    hp += Math.max(0, node.hp);
    maxHp += node.maxHp;
  }
  return Math.round((hp / maxHp) * 100);
}

function getFractureCount() {
  let broken = 0;
  for (const c of constraints) {
    if (c.broken && !(isSuperRagdollNode(c.a) || isSuperRagdollNode(c.b))) {
      broken += 1;
    }
  }
  return broken;
}

function getAliveCount() {
  let alive = 0;
  for (const state of ragdollStates) {
    if (state.mode === "standing") {
      alive += 1;
    }
  }
  return alive;
}

function drawHudPill(x, y, w, label, value, tint) {
  const pill = ctx.createLinearGradient(x, y, x, y + 34);
  pill.addColorStop(0, "rgba(255, 255, 255, 0.08)");
  pill.addColorStop(1, "rgba(255, 255, 255, 0.025)");
  ctx.fillStyle = pill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 34, 11);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "rgba(191, 219, 254, 0.78)";
  ctx.font = "600 10px Avenir Next";
  ctx.fillText(label, x + 10, y + 12);

  ctx.fillStyle = tint;
  ctx.font = "700 14px Avenir Next";
  ctx.fillText(value, x + 10, y + 26);
}

function drawHUD(now) {
  const tool = toolConfigs[activeTool];
  const label = tool ? tool.name : "Unknown";
  const integrity = getRagdollIntegrityPercent();
  const fractures = getFractureCount();
  const alive = getAliveCount();
  const cardX = 18;
  const cardY = 16;
  const cardW = 372;
  const cardH = 136;

  const panel = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  panel.addColorStop(0, "rgba(8, 15, 30, 0.82)");
  panel.addColorStop(1, "rgba(8, 14, 28, 0.62)");
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 22);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  const glow = ctx.createRadialGradient(cardX + 72, cardY + 24, 10, cardX + 72, cardY + 24, 160);
  glow.addColorStop(0, "rgba(255, 138, 61, 0.14)");
  glow.addColorStop(1, "rgba(255, 138, 61, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  ctx.fillStyle = "rgba(191, 219, 254, 0.74)";
  ctx.font = "700 10px Avenir Next";
  ctx.fillText("ACTIVE TOOL", cardX + 16, cardY + 18);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 22px Avenir Next";
  ctx.fillText(label, cardX + 16, cardY + 44);

  ctx.fillStyle = "#adc3e1";
  ctx.font = "600 12px Avenir Next";
  ctx.fillText(`Random styles  |  ${ragdollCount} ragdolls`, cardX + 16, cardY + 64);

  ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
  ctx.beginPath();
  ctx.roundRect(cardX + 16, cardY + 74, 154, 24, 12);
  ctx.fill();
  ctx.fillStyle = "#fed7aa";
  ctx.font = "700 11px Avenir Next";
  ctx.fillText(getCooldownText(now, activeTool).toUpperCase(), cardX + 26, cardY + 90);

  drawHudPill(cardX + 16, cardY + 106, 108, "INTEGRITY", `${integrity}%`, integrity > 40 ? "#fde68a" : "#fca5a5");
  drawHudPill(cardX + 132, cardY + 106, 112, "BROKEN JOINTS", String(fractures), "#fecaca");
  drawHudPill(cardX + 252, cardY + 106, 120, "STANDING", `${alive}/${ragdollCount}`, "#93c5fd");
}

function render(now) {
  ctx.clearRect(0, 0, width, height);
  drawGround();
  drawArena();
  drawBungeeRopes();
  drawSawBlade();
  drawCars();
  drawTsunami();
  drawBombs();
  drawLaunchedGrenades(now);
  drawAnvils();
  drawTitaniumBalls();
  drawProjectiles();
  drawRagdolls();
  drawLava();
  drawEffects();
  drawSceneAtmosphere();
  drawNuclearBlast();
  drawToolCursor();
  drawHUD(now);
}

let physicsAccumulator = 0;
let simulationTime = performance.now();
function frame(realNow) {
  const delta = Math.max(0, realNow - lastFrameMs);
  lastFrameMs = realNow;
  const settings = typeof visual !== "undefined" ? visual : null;
  if (settings) {
    settings.fps += (1000 / Math.max(1, delta) - settings.fps) * 0.06;
    settings.clock = realNow;
  }
  if (!settings?.paused) {
    physicsAccumulator += Math.min(delta, 100) * (settings?.slow ? 0.25 : 1);
    while (physicsAccumulator >= 1000 / 60) {
      physicsAccumulator -= 1000 / 60;
      simulationTime += 1000 / 60;
      const now = simulationTime;
      frameNow = now;
      simulationTick += 1;
  for (const state of ragdollStates) {
    state.stagger *= 0.94;
  }
  for (const obstacle of obstacles) {
    obstacle.kinematicVX = 0;
    obstacle.kinematicVY = 0;
  }

  applySuperRagdollControl();
  applyRagdollBehavior();
  integrate();
  integrateBombs();
  integrateLaunchedGrenades();
  integrateAnvils();
  integrateTitaniumBalls();
  integrateDroppedCars();
  updateSawBlade();
  maybeShoot(now);
  updateCars(now);
  updateTsunami();
  updateProjectiles();
  updateLaunchedGrenades(now);
  updateBombs(now);
  updateLava(now);
  updateNuclearBlast();
  applyToolForces(now);
  solveConstraints();
  resolveSuperRagdollPunch();
  updateDamageVisuals();
  updateEffects();
  updateWeaponStatus(now);
    }
  } else {
    physicsAccumulator = 0;
  }
  render(simulationTime);
  if (delta > 150) {
    pointer.grabbedNode = null;
    pointer.grabOffsetX = 0;
    pointer.grabOffsetY = 0;
  }
  requestAnimationFrame(frame);
}

function onPointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.prevX = pointer.x;
  pointer.prevY = pointer.y;
  pointer.x = event.clientX - rect.left;
  pointer.y = event.clientY - rect.top;

  const dx = pointer.x - pointer.prevX;
  const dy = pointer.y - pointer.prevY;
  if (Math.hypot(dx, dy) > 0.2) {
    aimAngle = Math.atan2(dy, dx);
  }
}

function onPointerDown(event) {
  onPointerMove(event);
  pointer.down = true;

  if (activeTool === "hand") {
    pointer.grabbedNode = getNodeAt(pointer.x, pointer.y);
    if (pointer.grabbedNode && pointer.grabbedNode.kind === "titanium-ball") {
      const moveX = pointer.x - pointer.prevX;
      const moveY = pointer.y - pointer.prevY;
      let angle = Math.atan2(moveY, moveX);
      if (Math.hypot(moveX, moveY) < 0.4) {
        angle = Math.random() * Math.PI * 2;
      }
      const speed = Math.max(
        pointer.grabbedNode.minSpeed || 22,
        ((pointer.grabbedNode.minSpeed || 22) + (pointer.grabbedNode.maxSpeed || 42)) * 0.5
      );
      pointer.grabbedNode.oldX = pointer.grabbedNode.x - Math.cos(angle) * speed;
      pointer.grabbedNode.oldY = pointer.grabbedNode.y - Math.sin(angle) * speed;
      effects.push({
        type: "ring",
        x: pointer.grabbedNode.x,
        y: pointer.grabbedNode.y,
        radius: 8,
        maxRadius: 36,
        life: 10,
        maxLife: 10,
        color: "#cbd5e1",
      });
      pointer.grabbedNode = null;
      pointer.grabOffsetX = 0;
      pointer.grabOffsetY = 0;
      return;
    }
    if (
      pointer.grabbedNode &&
      (
        isDraggableRect(pointer.grabbedNode) ||
        isSawTarget(pointer.grabbedNode) ||
        isAnvilTarget(pointer.grabbedNode)
      )
    ) {
      pointer.grabOffsetX = pointer.x - pointer.grabbedNode.x;
      pointer.grabOffsetY = pointer.y - pointer.grabbedNode.y;
    } else {
      pointer.grabOffsetX = 0;
      pointer.grabOffsetY = 0;
    }

    if (pointer.grabbedNode && pointer.grabbedNode.pinned) {
      wakeRagdoll(pointer.grabbedNode.ragdollId);
    }
  } else if (activeTool === "bungee-rope") {
    const target = getNodeAt(pointer.x, pointer.y);
    if (!target) {
      bungeeState.pendingTarget = null;
      return;
    }
    if (!isRopeTargetActive(target)) {
      return;
    }
    if (!bungeeState.pendingTarget) {
      bungeeState.pendingTarget = target;
      effects.push({
        type: "ring",
        x: pointer.x,
        y: pointer.y,
        radius: 8,
        maxRadius: 34,
        life: 9,
        maxLife: 9,
        color: "#7f1d1d",
      });
      return;
    }

    if (bungeeState.pendingTarget === target) {
      bungeeState.pendingTarget = null;
      return;
    }

    const connected = addBungeeRope(bungeeState.pendingTarget, target);
    if (connected) {
      const aPos = getRopeAnchorPosition(bungeeState.pendingTarget);
      const bPos = getRopeAnchorPosition(target);
      if (aPos && bPos) {
        effects.push({
          type: "ring",
          x: (aPos.x + bPos.x) * 0.5,
          y: (aPos.y + bPos.y) * 0.5,
          radius: 10,
          maxRadius: 42,
          life: 11,
          maxLife: 11,
          color: "#b91c1c",
        });
      }
      bungeeState.pendingTarget = null;
    }
  } else if (activeTool === "explosive-touch") {
    const target = getNodeAt(pointer.x, pointer.y);
    if (target && typeof target.ragdollId === "number") {
      detonateRagdoll(target.ragdollId, target.x, target.y);
      effects.push({
        type: "ring",
        x: target.x,
        y: target.y,
        radius: 14,
        maxRadius: 96,
        life: 16,
        maxLife: 16,
        color: "#f97316",
      });
    }
  } else if (activeTool === "health-boost") {
    const target = getNodeAt(pointer.x, pointer.y);
    if (target && typeof target.ragdollId === "number") {
      setRagdollStanding(target.ragdollId);
      effects.push({
        type: "ring",
        x: pointer.x,
        y: pointer.y,
        radius: 12,
        maxRadius: 70,
        life: 14,
        maxLife: 14,
        color: "#22c55e",
      });
    }
  } else if (activeTool === "anvil-dropper") {
    dropAnvil(pointer.x, pointer.y);
    effects.push({
      type: "ring",
      x: pointer.x,
      y: Math.max(30, pointer.y - 120),
      radius: 10,
      maxRadius: 44,
      life: 10,
      maxLife: 10,
      color: "#94a3b8",
    });
  } else if (activeTool === "gravity-reverser") {
    const target = getNodeAt(pointer.x, pointer.y);
    if (target && typeof target.ragdollId === "number") {
      reverseRagdollGravity(target.ragdollId, 3000);
      effects.push({
        type: "ring",
        x: target.x,
        y: target.y,
        radius: 12,
        maxRadius: 88,
        life: 16,
        maxLife: 16,
        color: "#38bdf8",
      });
    }
  } else if (activeTool === "nuclear-bomb") {
    triggerNuclearBlast(pointer.x, pointer.y);
  }
}

function onPointerUp() {
  pointer.down = false;
  pointer.grabbedNode = null;
  pointer.grabOffsetX = 0;
  pointer.grabOffsetY = 0;
}

function onKeyDown(event) {
  if (!(event.key in keyboardState)) {
    return;
  }
  keyboardState[event.key] = true;
  if (superRagdoll.active) {
    event.preventDefault();
  }
}

function onKeyUp(event) {
  if (!(event.key in keyboardState)) {
    return;
  }
  keyboardState[event.key] = false;
  if (superRagdoll.active) {
    event.preventDefault();
  }
}

function setupControls() {
  const blackHoleReverseRow = document.getElementById("blackHoleReverseRow");
  const blackHoleReverseToggle = document.getElementById("blackHoleReverseToggle");
  const syncBlackHoleReverseVisibility = () => {
    if (!blackHoleReverseRow) {
      return;
    }
    blackHoleReverseRow.style.display = activeTool === "water-lance" ? "flex" : "none";
  };

  if (blackHoleReverseToggle) {
    blackHoleReverseToggle.checked = blackHoleReverseEnabled;
    blackHoleReverseToggle.addEventListener("change", () => {
      blackHoleReverseEnabled = blackHoleReverseToggle.checked;
    });
  }

  const radios = document.querySelectorAll('input[name="tool"]');
  radios.forEach((radio) => {
    radio.addEventListener("change", () => {
      activeTool = radio.value;
      pointer.grabbedNode = null;
      pointer.grabOffsetX = 0;
      pointer.grabOffsetY = 0;
      bungeeState.pendingTarget = null;
      syncBlackHoleReverseVisibility();
    });
  });
  syncBlackHoleReverseVisibility();

  const ragdollCountSelect = document.getElementById("ragdollCount");
  const ragdollCountValue = document.getElementById("ragdollCountValue");
  const syncRagdollCountControl = () => {
    const sliderValue = Math.max(1, Math.min(20, ragdollCount));
    ragdollCountSelect.value = String(sliderValue);
    if (ragdollCountValue) {
      ragdollCountValue.textContent = ragdollCount > 20 ? "20+" : String(sliderValue);
    }
  };
  syncRagdollCountControl();
  ragdollCountSelect.addEventListener("input", () => {
    const parsed = Number.parseInt(ragdollCountSelect.value, 10);
    ragdollCount = Number.isFinite(parsed) ? Math.max(1, Math.min(20, parsed)) : 2;
    buildRagdolls(ragdollCount);
    syncRagdollCountControl();
  });

  const gravitySlider = document.getElementById("gravitySlider");
  const gravityValue = document.getElementById("gravityValue");
  gravitySlider.value = String(gravityMultiplier);
  gravityValue.textContent = `${gravityMultiplier.toFixed(2)}x`;
  gravitySlider.addEventListener("input", () => {
    gravityMultiplier = Number.parseFloat(gravitySlider.value);
    gravityValue.textContent = `${gravityMultiplier.toFixed(2)}x`;
  });

  const fightModeToggle = document.getElementById("fightModeToggle");
  if (fightModeToggle) {
    updateFightModeAvailability();
    fightModeToggle.addEventListener("change", () => {
      fightModeEnabled = fightModeToggle.checked;
      updateFightModeAvailability();
    });
  }

  document.getElementById("resetButton").addEventListener("click", () => {
    resetArenaAndRagdoll();
  });

  document.getElementById("addRagdollButton").addEventListener("click", () => {
    const added = appendRagdoll();
    if (added) {
      syncRagdollCountControl();
    }
  });

  document.getElementById("masterButton").addEventListener("click", () => {
    const added = appendMasterRagdoll();
    if (added) {
      syncRagdollCountControl();
    }
  });

  document.getElementById("superRagdollButton").addEventListener("click", () => {
    spawnSuperRagdoll();
  });

  document.getElementById("sixSevenButton").addEventListener("click", () => {
    spawnSixSeven();
  });

  document.getElementById("titaniumBallButton").addEventListener("click", () => {
    launchTitaniumBall();
  });

  document.getElementById("bombButton").addEventListener("click", () => {
    placeBomb(frameNow);
  });

  document.getElementById("carButton").addEventListener("click", () => {
    spawnCar(frameNow);
  });

  document.getElementById("dropCarButton").addEventListener("click", () => {
    spawnDropCar();
  });

  document.getElementById("sawButton").addEventListener("click", () => {
    spawnSawBlade();
  });

  document.getElementById("lavaButton").addEventListener("click", () => {
    lava.active = true;
  });

  document.getElementById("tsunamiButton").addEventListener("click", () => {
    spawnTsunami();
  });

  document.querySelectorAll("[data-behavior]").forEach((button) => {
    button.addEventListener("click", () => {
      setRagdollBehavior(button.dataset.behavior);
    });
  });
}

// Canvas layout is observed by the renderer.
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointerleave", onPointerUp);
window.addEventListener("pointerup", onPointerUp);

resize();
setupControls();
frame(performance.now());
