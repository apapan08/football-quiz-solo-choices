// src/lib/catalogs.js
import Fuse from "fuse.js";

const cache = new Map();

const FUSE_OPTS = {
  keys: ["name"],
  includeScore: true,
  threshold: 0.55,      // was 0.3 — a bit looser for short partials
  ignoreLocation: true,
  minMatchCharLength: 2,
};

export function norm(s = "") {
  return s
    .toString()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[’'`]/g, "'")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/ς/g, "σ");
}

function slug(s) {
  return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function getCatalog(name) {
  if (cache.has(name)) return cache.get(name);

  let list = [];
  try {
    const res = await fetch(`/data/${name}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    list = await res.json();            // array of strings
  } catch (e) {
    console.warn(`Catalog "${name}" could not be loaded:`, e);
    list = [];
  }

  const items = list.map((n) => ({
    id: `${name}:${slug(n)}`,
    name: String(n),
    _norm: norm(n),
  }));

  const fuse = new Fuse(items, FUSE_OPTS);
  const byName = new Map(items.map(i => [i._norm, i]));
  const out = { items, fuse, byName };
  cache.set(name, out);
  return out;
}
