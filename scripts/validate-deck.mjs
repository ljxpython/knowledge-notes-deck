import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const deck = JSON.parse(await readFile(resolve(root, 'deck.json'), 'utf8'));
const allowed = new Set(['cover', 'narrative', 'comparison', 'process', 'timeline', 'chart', 'architecture', 'decision-matrix', 'summary', 'custom']);
const ids = new Set(), sections = new Set(deck.sections.map((section) => section.id));
if (deck.version !== 1 || !deck.title || !Array.isArray(deck.pages) || !deck.pages.length) throw new Error('deck.json requires version 1, a title, and pages.');
for (const page of deck.pages) {
  if (!page.id || ids.has(page.id)) throw new Error(`Invalid or duplicate page id: ${page.id}`); ids.add(page.id);
  if (!sections.has(page.section)) throw new Error(`Unknown section for ${page.id}: ${page.section}`);
  if (!allowed.has(page.type)) throw new Error(`Unsupported page type for ${page.id}: ${page.type}`);
  if (page.type === 'custom' && !page.module) throw new Error(`Custom page ${page.id} requires module.`);
  for (const path of [page.path, page.module].filter(Boolean)) await access(resolve(root, path));
}
console.log(`Validated ${deck.pages.length} pages across ${deck.sections.length} sections.`);
