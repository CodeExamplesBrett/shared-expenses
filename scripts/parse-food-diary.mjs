/**
 * One-off CLI: Obsidian "Food Diary" vault folder -> src/assets/food-diary-seed.json
 *
 * Kept for the Firebase/Firestore import path (the NUC server reads the vault
 * live instead — see server/index.mjs). Parsing logic lives in the shared
 * server/foodDiaryParser.mjs module.
 *
 * Usage: node scripts/parse-food-diary.mjs [vaultFoodDiaryDir]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFoodDiary } from '../server/foodDiaryParser.mjs';

const SRC_DIR = process.argv[2] ?? '/home/brett/Dokumente/obsidian-vault/Food Diary';
const OUT_FILE = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/food-diary-seed.json');

const { days, prices, warnings } = parseFoodDiary(SRC_DIR);

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify({ days, prices }, null, 2) + '\n');

console.log(`Parsed ${days.length} days, ${prices.length} ingredient prices -> ${OUT_FILE}`);
console.log(days.map((d) => `  ${d.date}  €${d.totalCost.toFixed(2)}`).join('\n'));
if (warnings.length) {
  console.log('\nWarnings:');
  for (const w of warnings) console.log('  ⚠ ' + w);
} else {
  console.log('\nNo warnings — all totals match the Obsidian frontmatter.');
}
