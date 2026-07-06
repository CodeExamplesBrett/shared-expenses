/**
 * Parser for the Obsidian "Food Diary" vault folder.
 *
 * Reads each YYYY-MM-DD.md entry (English section: meal tables of
 * ingredient/amount/unit price/cost) plus "_Ingredient Prices.md", and returns
 * structured data. Shared dishes (split bowls/trays) have each item's cost
 * scaled to the owner's share and flagged `shared: true`.
 *
 * Exports `parseFoodDiary(vaultDir)` -> { days, prices, warnings }.
 * Pure: reads files, returns data, never writes. Used by both the NUC server
 * (live, per request) and the one-off seed CLI (scripts/parse-food-diary.mjs).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function parseEuro(text) {
  // "€1.80" or "**€3.84**" -> 1.8
  const m = text.replace(/\*/g, '').match(/€\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function parseUnitPrice(cell) {
  // "€1.80/kg", "€0.90/piece", "€20.00/L", "—"
  const m = cell.match(/€\s*(\d+(?:\.\d+)?)\s*\/\s*(\S+)/);
  if (!m) return { unitPrice: null, unit: null };
  return { unitPrice: Number(m[1]), unit: m[2] };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function parseMealBlock(lines, context, warnings) {
  const meal = { items: [], note: '' };
  const notes = [];
  let i = 0;
  let pendingGroupLabel = '';

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith('|')) {
      // Collect the whole table
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const header = tableLines[0] ?? '';
      const isShared = /\(whole /i.test(header);
      const rows = tableLines
        .slice(2) // skip header + separator
        .map((l) =>
          l
            .split('|')
            .map((c) => c.trim())
            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1),
        )
        .filter((cells) => cells.length >= 4);

      const items = [];
      let wholeTotal = null;
      let shareValue = null;
      let shareLabel = '';
      for (const cells of rows) {
        if (cells[0].startsWith('**')) {
          const value = parseEuro(cells[3] ?? '');
          if (/total/i.test(cells[0])) wholeTotal = value;
          else {
            shareValue = value;
            shareLabel = cells[0].replace(/\*/g, '').trim();
          }
          continue;
        }
        const { unitPrice, unit } = parseUnitPrice(cells[2]);
        const cost = parseEuro(cells[3]);
        if (cost === null) {
          warnings.push(`${context}: could not parse cost in row "${cells.join(' | ')}"`);
          continue;
        }
        items.push({ name: cells[0], amount: cells[1], unitPrice, unit, cost, shared: false });
      }

      if (isShared) {
        if (wholeTotal === null || shareValue === null || wholeTotal === 0) {
          warnings.push(`${context}: shared table without total/share rows`);
        } else {
          const factor = shareValue / wholeTotal;
          const itemSum = items.reduce((s, it) => s + it.cost, 0);
          if (Math.abs(itemSum - wholeTotal) > 0.03) {
            warnings.push(
              `${context}: shared table items sum ${itemSum.toFixed(2)} != stated whole total ${wholeTotal}`,
            );
          }
          for (const it of items) {
            it.cost = it.cost * factor; // unrounded so the meal sum stays exact
            it.shared = true;
          }
          if (pendingGroupLabel) notes.push(pendingGroupLabel);
          else notes.push(`Shared dish — ${shareLabel.toLowerCase() || 'your share'}`);
        }
      } else if (pendingGroupLabel) {
        notes.push(pendingGroupLabel);
      }
      pendingGroupLabel = '';
      meal.items.push(...items);
      continue;
    }

    if (/^\*\*.+:\*\*$/.test(line)) {
      // Group label like "**Salad (shared bowl — your half):**"
      pendingGroupLabel = line.replace(/\*/g, '').replace(/:$/, '').trim();
    } else if (/subtotal/i.test(line) && line.startsWith('**')) {
      // The subtotal is the last € amount on the line (earlier ones may appear in parentheses)
      const euros = line.replace(/\*/g, '').match(/€\s*\d+(?:\.\d+)?/g) ?? [];
      const stated = euros.length ? parseEuro(euros[euros.length - 1]) : null;
      const computed = meal.items.reduce((s, it) => s + it.cost, 0);
      if (stated !== null && Math.abs(stated - computed) > 0.02) {
        warnings.push(`${context}: subtotal ${stated} != computed ${computed.toFixed(2)}`);
      }
    } else if (line.startsWith('- ')) {
      notes.push(line.slice(2).replace(/\*/g, '').trim());
    }
    i++;
  }

  meal.note = notes.join('\n');
  return meal;
}

function parseDay(vaultDir, file, warnings) {
  const raw = readFileSync(join(vaultDir, file), 'utf8');
  const date = file.replace('.md', '');

  const fmTotal = raw.match(/^total_cost:\s*([\d.]+)/m);
  const statedTotal = fmTotal ? Number(fmTotal[1]) : null;

  // English section only
  const en = raw.split(/^## 🇩🇪.*$/m)[0].split(/^## 🇬🇧.*$/m)[1];
  if (!en) {
    warnings.push(`${date}: no English section found`);
    return null;
  }

  const meals = { breakfast: null, lunch: null, dinner: null };
  const sections = en.split(/^### /m).slice(1);
  for (const section of sections) {
    const lines = section.split('\n');
    const heading = lines[0].trim();
    const key = /^breakfast/i.test(heading)
      ? 'breakfast'
      : /^lunch/i.test(heading)
        ? 'lunch'
        : /^dinner/i.test(heading)
          ? 'dinner'
          : null;
    if (!key) {
      warnings.push(`${date}: unrecognized meal heading "${heading}"`);
      continue;
    }
    const meal = parseMealBlock(lines.slice(1), `${date}/${key}`, warnings);
    // Heading suffix ("— Salad + Flammkuchen", "(bigger breakfast)") becomes part of the note
    const suffix = heading
      .replace(/^(breakfast|lunch|dinner)\s*/i, '')
      .replace(/^[—–-]\s*/, '')
      .trim();
    if (suffix) meal.note = [suffix.replace(/^\((.*)\)$/, '$1'), meal.note].filter(Boolean).join('\n');
    meals[key] = meal;
  }

  for (const key of ['breakfast', 'lunch', 'dinner']) {
    if (!meals[key]) meals[key] = { items: [], note: '' };
  }

  const totalCost = round2(
    Object.values(meals)
      .flatMap((m) => m.items)
      .reduce((s, it) => s + it.cost, 0),
  );
  if (statedTotal !== null && Math.abs(totalCost - statedTotal) > 0.02) {
    warnings.push(`${date}: computed total ${totalCost} != frontmatter total_cost ${statedTotal}`);
  }

  return { date, meals, totalCost };
}

function parsePrices(vaultDir, warnings) {
  let raw;
  try {
    raw = readFileSync(join(vaultDir, '_Ingredient Prices.md'), 'utf8');
  } catch {
    warnings.push('prices: _Ingredient Prices.md not found');
    return [];
  }
  const prices = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|') || t.startsWith('| ---') || t.startsWith('| Ingredient')) continue;
    const cells = t
      .split('|')
      .map((c) => c.trim())
      .slice(1, -1);
    if (cells.length < 5) continue;
    const name = cells[0].split(' / ')[0].trim();
    const unitRaw = cells[1].split(' / ')[0].trim().toLowerCase();
    const unit = unitRaw.includes('kg')
      ? 'kg'
      : unitRaw.includes('litre') || unitRaw.includes('liter')
        ? 'L'
        : unitRaw.includes('piece')
          ? 'piece'
          : unitRaw.includes('portion')
            ? 'portion'
            : unitRaw.includes('use')
              ? 'use'
              : unitRaw;
    const price = parseEuro(cells[2]);
    if (price === null) {
      warnings.push(`prices: could not parse "${t}"`);
      continue;
    }
    prices.push({ name, unit, price, notes: cells[3], addedAt: cells[4] });
  }
  return prices;
}

/**
 * Parse an Obsidian Food Diary folder.
 * @param {string} vaultDir Absolute path to the "Food Diary" folder.
 * @returns {{ days: object[], prices: object[], warnings: string[] }}
 */
export function parseFoodDiary(vaultDir) {
  const warnings = [];
  const dayFiles = readdirSync(vaultDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort();

  const days = dayFiles.map((f) => parseDay(vaultDir, f, warnings)).filter(Boolean);
  const prices = parsePrices(vaultDir, warnings);
  return { days, prices, warnings };
}
