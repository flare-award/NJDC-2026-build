// ============================================================
// Генератор артов предметов CASEUP (запасной вариант для скинов,
// когда лимит генерации изображений исчерпан).
// Рисует стилизованный векторный арт оружия (SVG) и рендерит в PNG
// через sharp (librsvg). Стиль единый: тёмный фон, акцент кейса,
// полоса редкости.
//
// Запуск: node scripts/gen-item-art.mjs
// ============================================================
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "public/caseup/items");
mkdirSync(OUT, { recursive: true });

// ---------- Палитра ----------
const RARITY = {
  "mil-spec": { color: "#5b7cfa", label: "mil" },
  restricted: { color: "#9d6bff", label: "res" },
  classified: { color: "#e05ce0", label: "cla" },
  covert: { color: "#f05555", label: "cov" },
  knife: { color: "#ffcf4d", label: "kni" },
};

const ACCENTS = {
  molten: "#ff7a1a",
  neon: "#22d3ee",
  frost: "#7cc7ff",
  gold: "#ffd54a",
};

const BODY_A = "#2b2b31";
const BODY_B = "#1b1b1f";
const DARK = "#151518";

// ---------- Примитивы ----------
const esc = (s) => String(s);

function rect(x, y, w, h, rx = 4, fill = BODY_A, extra = "") {
  return `<rect x='${x}' y='${y}' width='${w}' height='${h}' rx='${rx}' fill='${fill}' ${extra}/>`;
}
function poly(points, fill = BODY_A, extra = "") {
  return `<polygon points='${points}' fill='${fill}' ${extra}/>`;
}
function line(x1, y1, x2, y2, stroke, w = 3, extra = "") {
  return `<line x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}' stroke='${stroke}' stroke-width='${w}' ${extra}/>`;
}

// ---------- Конфиги оружия (пропорции) ----------
// y0 — верх корпуса. Все размеры подогнаны под холст 800×600, центр ~ y=310.
const WEAPON_DEFS = {
  // ===== Расплавленный Штурм =====
  mol_mp9_blaze: { type: "smg", stock: 46, barrel: 120, mag: "straight", grip: true, accent: "molten", rarity: "mil-spec" },
  mol_famas_cinder: { type: "rifle", stock: 70, barrel: 130, mag: "curved", grip: true, accent: "molten", rarity: "mil-spec", handguardLen: 110 },
  mol_glock_magma: { type: "pistol", stock: 0, barrel: 62, mag: "pistol", grip: true, accent: "molten", rarity: "restricted", slide: 150 },
  mol_m4a1_scorch: { type: "rifle", stock: 74, barrel: 118, mag: "straight", grip: true, accent: "molten", rarity: "restricted", suppressor: true },
  mol_usp_ember: { type: "pistol", stock: 0, barrel: 50, mag: "pistol", grip: true, accent: "molten", rarity: "classified", slide: 132, suppressor: true },
  mol_ak47_molten: { type: "rifle", stock: 76, barrel: 120, mag: "curved", grip: true, accent: "molten", rarity: "covert" },
  // ===== Неоновый Разлом =====
  neo_galil_laser: { type: "rifle", stock: 66, barrel: 122, mag: "curved", grip: true, accent: "neon", rarity: "mil-spec" },
  neo_tec9_glitch: { type: "pistol", stock: 0, barrel: 66, mag: "pistol", grip: true, accent: "neon", rarity: "mil-spec", slide: 148 },
  neo_mp7_signal: { type: "smg", stock: 56, barrel: 104, mag: "straight", grip: true, accent: "neon", rarity: "restricted", foregrip: true },
  neo_p90_circuit: { type: "smg", stock: 40, barrel: 108, mag: "long", grip: true, accent: "neon", rarity: "restricted", topRail: true },
  neo_deagle_pulse: { type: "pistol", stock: 0, barrel: 92, mag: "pistol", grip: true, accent: "neon", rarity: "classified", slide: 168 },
  neo_awp_volt: { type: "sniper", stock: 92, barrel: 160, mag: "straight", grip: true, accent: "neon", rarity: "covert", scope: true },
  // ===== Ледяная Глубина =====
  fro_mac10_frostbite: { type: "smg", stock: 52, barrel: 96, mag: "straight", grip: true, accent: "frost", rarity: "mil-spec" },
  fro_five7_chill: { type: "pistol", stock: 0, barrel: 60, mag: "pistol", grip: true, accent: "frost", rarity: "mil-spec", slide: 142 },
  fro_ump_hoarfrost: { type: "smg", stock: 58, barrel: 100, mag: "straight", grip: true, accent: "frost", rarity: "restricted" },
  fro_m4a4_snowfall: { type: "rifle", stock: 72, barrel: 122, mag: "straight", grip: true, accent: "frost", rarity: "restricted" },
  fro_awp_arctic: { type: "sniper", stock: 90, barrel: 158, mag: "straight", grip: true, accent: "frost", rarity: "classified", scope: true },
  fro_ak47_glacier: { type: "rifle", stock: 76, barrel: 120, mag: "curved", grip: true, accent: "frost", rarity: "covert" },
  // ===== Золотая Лихорадка =====
  gol_sg553_bullion: { type: "rifle", stock: 78, barrel: 118, mag: "straight", grip: true, accent: "gold", rarity: "mil-spec", scope: true },
  gol_p250_coin: { type: "pistol", stock: 0, barrel: 54, mag: "pistol", grip: true, accent: "gold", rarity: "mil-spec", slide: 132 },
  gol_mp9_nugget: { type: "smg", stock: 46, barrel: 120, mag: "straight", grip: true, accent: "gold", rarity: "restricted" },
  gol_m4a1_royal: { type: "rifle", stock: 74, barrel: 118, mag: "straight", grip: true, accent: "gold", rarity: "restricted", suppressor: true },
  gol_awp_gilded: { type: "sniper", stock: 92, barrel: 160, mag: "straight", grip: true, accent: "gold", rarity: "classified", scope: true },
  gol_ak47_treasure: { type: "rifle", stock: 76, barrel: 120, mag: "curved", grip: true, accent: "gold", rarity: "covert" },
};

// ---------- Построение SVG ----------
function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return h;
}

function drawWeapon(id, def) {
  const accent = ACCENTS[def.accent] || "#7c3aed";
  const rarity = RARITY[def.rarity] || RARITY["mil-spec"];
  const seed = hashSeed(id);

  // Геометрия (x слева направо, y — середина корпуса)
  const Y = 310;
  const X0 = 90; // левый край (приклад/тыльная часть)
  const total = 620; // длина оружия
  const stockLen = def.stock || 0;
  const recvLen = def.type === "pistol" ? (def.slide || 150) : def.type === "sniper" ? 150 : 130;
  const handLen = def.handguardLen || (def.type === "sniper" ? 120 : 100);
  const barrelLen = def.barrel;
  const suppressorLen = def.suppressor ? 46 : 0;
  const recvH = def.type === "pistol" ? 30 : 42;
  const barrelH = def.type === "sniper" ? 18 : 13;

  let x = X0;
  const parts = [];

  // --- Приклад ---
  if (stockLen > 0) {
    const sy = Y - recvH / 2 - 2;
    parts.push(
      `<path d='M${x} ${sy + 10} Q${x - 8} ${sy} ${x} ${sy} L${x + stockLen} ${sy} L${x + stockLen} ${sy + recvH - 6} Q${x + stockLen - 14} ${sy + recvH + 4} ${x} ${sy + recvH - 8} Z' fill='${BODY_A}' stroke='#00000055' stroke-width='1.5'/>`
    );
    parts.push(line(x + 10, sy + recvH - 8, x + stockLen - 16, sy + recvH - 8, accent, 2.5, `opacity='0.55'`));
    x += stockLen;
  }

  // --- Глушитель (пистолеты/винтовки) ---
  if (def.suppressor && def.type === "pistol") {
    // у пистолета глушитель перед затвором — рисуем после ствола
  }

  // --- Затвор/ресивер ---
  const recvX = x;
  const recvY = Y - recvH / 2;
  parts.push(rect(recvX, recvY, recvLen, recvH, 7, BODY_A, `stroke='#00000044' stroke-width='1.5'`));
  // верхняя полоса
  parts.push(rect(recvX + 6, recvY + 4, recvLen - 12, 8, 3, BODY_B));
  // декоративные акцентные насечки (зависят от сида)
  for (let i = 0; i < 3; i++) {
    const nx = recvX + 18 + ((seed * (i + 3)) % (recvLen - 60));
    parts.push(line(nx, recvY + 16, nx + 14, recvY + 16, accent, 3, `opacity='0.5'`));
  }
  // прицел
  parts.push(rect(recvX + recvLen - 34, recvY - 8, 18, 10, 3, DARK, `stroke='#00000055' stroke-width='1'`));
  parts.push(rect(recvX + recvLen - 30, recvY - 12, 8, 6, 2, accent, `opacity='0.8'`));
  x += recvLen;

  // --- Оптический прицел ---
  if (def.scope) {
    const sx = recvX + recvLen / 2 - 34;
    parts.push(rect(sx, recvY - 26, 12, 22, 3, DARK));
    parts.push(rect(sx + 10, recvY - 34, 58, 28, 10, "#0d0d0f", `stroke='${accent}' stroke-opacity='0.6' stroke-width='2'`));
    parts.push(rect(sx + 20, recvY - 28, 38, 6, 3, accent, `opacity='0.35'`));
    parts.push(rect(sx + 60, recvY - 22, 12, 14, 3, DARK));
  }

  // --- Цевьё ---
  const handY = Y - recvH / 2 + 4;
  parts.push(rect(x, handY, handLen, recvH - 8, 5, BODY_B, `stroke='#00000044' stroke-width='1.2'`));
  for (let i = 0; i < 4; i++) {
    parts.push(line(x + 12 + i * 22, handY + 6, x + 12 + i * 22, handY + recvH - 14, accent, 2, `opacity='0.35'`));
  }
  // передняя рукоять
  if (def.foregrip) {
    parts.push(poly(`${x + 30},${handY + recvH - 8} ${x + 38},${handY + recvH + 26} ${x + 50},${handY + recvH + 26} ${x + 56},${handY + recvH - 8}`, BODY_A));
  }
  x += handLen;

  // --- Ствол ---
  const by = Y - barrelH / 2 + 4;
  parts.push(rect(x, by, barrelLen, barrelH, 4, DARK, `stroke='#00000044' stroke-width='1'`));
  parts.push(line(x + 4, by + 2, x + barrelLen - 4, by + 2, "#3a3a42", 2));
  // мушка
  parts.push(rect(x + barrelLen - 22, by - 8, 8, 10, 2, DARK));
  parts.push(rect(x + barrelLen - 19, by - 11, 4, 5, 1, accent, `opacity='0.85'`));
  x += barrelLen;

  // --- Глушитель (ствол) ---
  if (def.suppressor) {
    parts.push(rect(x, by - 4, suppressorLen, barrelH + 8, 6, "#222226", `stroke='${accent}' stroke-opacity='0.5' stroke-width='1.5'`));
    for (let i = 0; i < 3; i++) {
      parts.push(line(x + 8 + i * 12, by, x + 8 + i * 12, by + barrelH + 4, "#3a3a42", 2));
    }
    x += suppressorLen;
  }

  // --- Магазин ---
  const mgx = recvX + recvLen - 26;
  if (def.mag === "curved") {
    parts.push(
      `<path d='M${mgx} ${Y + recvH / 2 - 2} Q${mgx + 6} ${Y + recvH / 2 + 52} ${mgx + 34} ${Y + recvH / 2 + 64} L${mgx + 44} ${Y + recvH / 2 + 60} Q${mgx + 30} ${Y + recvH / 2 + 44} ${mgx + 30} ${Y + recvH / 2 - 2} Z' fill='${BODY_A}' stroke='#00000055' stroke-width='1.5'/>`
    );
    parts.push(line(mgx + 12, Y + recvH / 2 + 8, mgx + 34, Y + recvH / 2 + 52, accent, 2.5, `opacity='0.5'`));
  } else if (def.mag === "long") {
    parts.push(rect(mgx - 4, Y + recvH / 2 - 2, 26, 58, 6, BODY_A, `stroke='#00000055' stroke-width='1.5'`));
    parts.push(rect(mgx + 2, Y + recvH / 2 + 8, 12, 40, 3, accent, `opacity='0.4'`));
  } else if (def.mag === "pistol") {
    // магазин в рукояти — рисуем вместе с рукоятью
  } else {
    parts.push(rect(mgx, Y + recvH / 2 - 2, 24, 40, 5, BODY_A, `stroke='#00000055' stroke-width='1.5'`));
    parts.push(rect(mgx + 5, Y + recvH / 2 + 8, 12, 26, 3, accent, `opacity='0.4'`));
  }

  // --- Рукоять ---
  const grx = recvX + recvLen - 16;
  parts.push(
    `<path d='M${grx} ${Y + recvH / 2 - 2} L${grx - 8} ${Y + recvH / 2 + 52} Q${grx} ${Y + recvH / 2 + 60} ${grx + 16} ${Y + recvH / 2 + 52} L${grx + 14} ${Y + recvH / 2 - 2} Z' fill='${BODY_A}' stroke='#00000055' stroke-width='1.5'/>`
  );
  parts.push(line(grx - 2, Y + recvH / 2 + 8, grx + 6, Y + recvH / 2 + 44, accent, 2.5, `opacity='0.5'`));

  // Пистолет: затвор-слайд поверх рамки
  let pistolParts = "";
  if (def.type === "pistol") {
    const slideLen = def.slide || 150;
    const sx0 = X0 + 10;
    const sy0 = Y - 34;
    pistolParts = `
      ${rect(sx0, sy0, slideLen, 30, 7, BODY_A, `stroke='#00000055' stroke-width='1.5'`)}
      ${rect(sx0 + 8, sy0 + 6, slideLen - 16, 8, 3, BODY_B)}
      ${rect(sx0 + 10, sy0 + 18, slideLen - 60, 4, 2, accent, `opacity='0.55'`)}
      ${rect(sx0 + slideLen - 30, sy0 - 6, 14, 8, 3, DARK)}
      ${rect(sx0 + slideLen - 26, sy0 - 10, 6, 6, 2, accent, `opacity='0.85'`)}
      ${rect(sx0 + 24, sy0 + 30, 26, 8, 4, DARK)}
    `;
    // рамка + спусковая скоба
    pistolParts += `
      ${rect(sx0 + 10, sy0 + 30, slideLen - 26, 12, 5, DARK)}
      ${`<path d='M${sx0 + 30} ${sy0 + 42} Q${sx0 + 44} ${sy0 + 56} ${sx0 + 60} ${sy0 + 42}' fill='none' stroke='#3a3a42' stroke-width='5' stroke-linecap='round'/>`}
      ${rect(sx0 + 8, sy0 + 42, 26, 40, 6, BODY_A, `stroke='#00000055' stroke-width='1.5'`)}
      ${line(sx0 + 14, sy0 + 52, sx0 + 26, sy0 + 72, accent, 2.5, `opacity='0.5'`)}
    `;
    // ствол пистолета
    pistolParts += `${rect(sx0 + slideLen - 4, sy0 + 6, def.barrel, 12, 4, DARK, `stroke='#00000044' stroke-width='1'`)}`;
    if (def.suppressor) {
      pistolParts += `${rect(sx0 + slideLen + def.barrel - 6, sy0, 40, 22, 8, "#222226", `stroke='${accent}' stroke-opacity='0.5' stroke-width='1.5'`)}`;
    }
  }

  // --- Тень под оружием ---
  const shadow = `<ellipse cx='${X0 + total / 2}' cy='${Y + 96}' rx='${total / 2 - 30}' ry='14' fill='#000000' opacity='0.5'/>`;

  // --- Подсветка редкости и фон ---
  const bgGlow = `<ellipse cx='${X0 + total / 2}' cy='${Y}' rx='280' ry='120' fill='${rarity.color}' opacity='0.07'/>`;
  const accentGlow = `<ellipse cx='${X0 + total / 2}' cy='${Y}' rx='220' ry='90' fill='${accent}' opacity='0.06'/>`;

  // полоса редкости внизу
  const rarityBar = `<rect x='40' y='520' width='720' height='5' rx='2.5' fill='${rarity.color}' opacity='0.8'/>`;
  const rarityBarBg = `<rect x='40' y='516' width='720' height='13' rx='6.5' fill='${rarity.color}' opacity='0.12'/>`;

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'>
<rect width='800' height='600' fill='#101012'/>
<defs>
  <linearGradient id='bg' x1='0' y1='0' x2='0' y2='1'>
    <stop offset='0%' stop-color='#16161a'/><stop offset='100%' stop-color='#0c0c0e'/>
  </linearGradient>
</defs>
<rect width='800' height='600' fill='url(#bg)'/>
${bgGlow}
${accentGlow}
${rarityBarBg}
${rarityBar}
${shadow}
${def.type === "pistol" ? pistolParts : parts.join("\n")}
</svg>`;
  return svg;
}

// ---------- Рендер ----------
for (const [id, def] of Object.entries(WEAPON_DEFS)) {
  const svg = drawWeapon(id, def);
  const file = path.join(OUT, `${id}.png`);
  await sharp(Buffer.from(svg)).png().toFile(file);
  console.log("ok:", id);
}
console.log("Готово: 24 арта в", OUT);
