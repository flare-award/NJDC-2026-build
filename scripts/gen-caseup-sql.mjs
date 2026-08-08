// ============================================================
// Генератор SQL-сида CASEUP из src/data/caseupCatalog.ts.
// Запуск: node scripts/gen-caseup-sql.mjs
// Вставляет сгенерированный блок в supabase-caseup-migration.sql
// между маркерами -- [CASEUP_SEED_BEGIN] и -- [CASEUP_SEED_END].
// ============================================================
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "node_modules/.cache-caseup-catalog.mjs");

await build({
  entryPoints: [path.join(root, "src/data/caseupCatalog.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});

const mod = await import("file://" + out);
const { CASEUP_CASES, CASEUP_ITEMS, KNIFE_FINISHES } = mod;

const esc = (s) => String(s).replace(/'/g, "''");

const lines = [];
lines.push("-- Кейсы");
for (const c of CASEUP_CASES) {
  lines.push(
    `insert into public.caseup_cases (id, name, description, price, image_url, accent, knife_item_id, knife_chance, sort_order, active) values` +
      ` ('${esc(c.id)}', '${esc(c.name)}', '${esc(c.description)}', ${c.price}, '${esc(c.image)}', '${esc(c.accent)}', NULL, ${c.knifeChance}, ${c.sortOrder}, true)` +
      ` on conflict (id) do nothing;`
  );
}
lines.push("");
lines.push("-- Предметы (скины и ножи)");
for (const it of CASEUP_ITEMS) {
  const low = Math.max(10, Math.round(it.basePrice * 0.55));
  const high = Math.round(it.basePrice * 1.8);
  const caseId = it.caseId ? `'${esc(it.caseId)}'` : "NULL";
  lines.push(
    `insert into public.caseup_items (id, case_id, name, skin_name, rarity, image_url, base_price, price, price_low, price_high, drop_chance, is_knife, sort_order) values` +
      ` ('${esc(it.id)}', ${caseId}, '${esc(it.name)}', '${esc(it.skinName)}', '${esc(it.rarity)}', '${esc(it.image)}', ${it.basePrice}, ${it.basePrice}, ${low}, ${high}, ${it.dropChance}, ${it.rarity === "knife" ? "true" : "false"}, ${it.sortOrder})` +
      ` on conflict (id) do nothing;`
  );
}
lines.push("");
lines.push("-- Привязка ножей к кейсам");
for (const c of CASEUP_CASES) {
  lines.push(
    `update public.caseup_cases set knife_item_id = '${esc(c.knifeItemId)}' where id = '${esc(c.id)}' and knife_item_id is null;`
  );
}
const seedBlock = lines.join("\n");

const migrationPath = path.join(root, "supabase-caseup-migration.sql");
let sql = readFileSync(migrationPath, "utf8");
const begin = "-- [CASEUP_SEED_BEGIN]";
const end = "-- [CASEUP_SEED_END]";
const bIdx = sql.indexOf(begin);
const eIdx = sql.indexOf(end);
if (bIdx === -1 || eIdx === -1) {
  throw new Error("Маркеры сида не найдены в supabase-caseup-migration.sql");
}
sql = sql.slice(0, bIdx) + begin + "\n" + seedBlock + "\n" + sql.slice(eIdx);
writeFileSync(migrationPath, sql);
console.log(`Сид обновлён: ${CASEUP_CASES.length} кейсов, ${CASEUP_ITEMS.length} предметов`);
