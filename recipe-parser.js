// recipe-parser.js — pure functions (no DOM) used by index.html and tested in Node.
//
// Recipes are stored as one plain-text string (same as before, so old recipes
// keep working). New/imported recipes follow this convention:
//
//   Serves: 2
//   Time: 50–60 minutes
//
//   Ingredients
//   Steak                      <- optional group label (plain line)
//   - 2 strip steaks
//
//   Instructions
//   1. Start the potatoes. Put potato chunks in a saucepan...
//
//   Shopping list
//   - 2 steaks
//
// parseRecipes() turns messy text (e.g. from a PDF) into that format, and
// parseContent() reads it back for display.

export const MAX_CONTENT = 30000; // characters per recipe (Firestore docs cap at 1 MiB)

export const TEMPLATE =
  "Serves: \nTime: \n\nIngredients\n- \n\nInstructions\n1. \n\nShopping list\n- \n";

const LABEL = {
  ingredients: "Ingredients",
  steps: "Instructions",
  shopping: "Shopping list",
  notes: "Notes",
};
const SECTION_RES = [
  ["ingredients", /^ingredients?\s*:?$/i],
  ["steps", /^(?:instructions?|directions?|method|steps?|preparation)\s*:?$/i],
  ["shopping", /^(?:shopping\s+list|grocery\s+list|to\s+buy|shopping)\s*:?$/i],
  ["notes", /^(?:notes?|tips?)\s*:?$/i],
];
const BULLET = /^\s*(?:[•●▪◦·*]\s*|[-–—]\s+)/;
const META_RE =
  /^(?:serves?|servings?|yields?|makes|(?:approximate|prep|cook|total)?\s*time)\s*:/i;
const QTY_START = /^(?:\d|[½¼¾⅓⅔⅛])/;
const SMALL_WORDS = new Set(["a", "an", "and", "of", "the", "for", "to", "in", "with", "or", "&"]);

export function sectionOf(line) {
  const t = String(line || "").trim();
  for (const [key, re] of SECTION_RES) if (re.test(t)) return key;
  return null;
}

// "Quick Kitchen Notes" / "FOR THE SAUCE": short, title-case, no punctuation.
function isHeadingLike(line) {
  const t = line.trim();
  if (/[.,;:!?]$/.test(t) || /\d/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length < 2 || words.length > 6) return false;
  return words.every((w) => SMALL_WORDS.has(w.toLowerCase()) || /^[\p{Lu}]/u.test(w));
}

const isTerminated = (s) => /[.!?]["')\]]?$/.test(s.trim());

function splitTop(s, ch) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const c of s) {
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    if (c === ch && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function parseMeta(line) {
  const re = /(serves?|servings?|yields?|makes|(?:approximate|prep|cook|total)?\s*time)\s*:\s*/gi;
  const hits = [];
  let m;
  while ((m = re.exec(line))) hits.push({ label: m[1], start: m.index, valueStart: re.lastIndex });
  return hits
    .map((h, i) => {
      const value = line.slice(h.valueStart, hits[i + 1] ? hits[i + 1].start : undefined).trim();
      const l = h.label.toLowerCase().replace(/\s+/g, " ").trim();
      let label;
      if (/^serv/.test(l)) label = "Serves";
      else if (/^(yield|makes)/.test(l)) label = "Makes";
      else if (/^(approximate )?time$/.test(l)) label = "Time";
      else label = l.replace(/^./, (c) => c.toUpperCase());
      return value ? `${label}: ${value}` : "";
    })
    .filter(Boolean);
}

function normalize(text) {
  const raw = String(text || "")
    .replace(/\r/g, "")
    .replace(/\f/g, "\n")
    .replace(/ /g, " ")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l && !/^page\s+\d+(\s+of\s+\d+)?$/i.test(l));
  // A bullet glyph or step number alone on a line belongs to the next line.
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    if ((/^[•●▪◦·*]$/.test(raw[i]) || /^\d+[.)]$/.test(raw[i])) && raw[i + 1]) {
      out.push(raw[i] + " " + raw[i + 1]);
      i++;
    } else out.push(raw[i]);
  }
  return out;
}

function findStarts(lines) {
  const isPlain = (l) => l && !sectionOf(l) && !BULLET.test(l) && !META_RE.test(l) && l.length <= 120;
  const starts = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (isPlain(lines[i]) && META_RE.test(lines[i + 1])) starts.push(i);
  }
  if (starts.length) return starts;
  // No "Serves:" lines: split on each Ingredients heading; title is the line above.
  lines.forEach((l, i) => {
    if (sectionOf(l) !== "ingredients") return;
    let t = i - 1;
    while (t >= 0 && META_RE.test(lines[t]) && i - t <= 3) t--;
    if (t >= 0 && isPlain(lines[t])) starts.push(t);
    else starts.push(i); // untitled
  });
  return [...new Set(starts)];
}

function explodeItem(text) {
  const t = text.trim().replace(/\.$/, "");
  let label = null;
  let rest = t;
  const m = /^(\p{Lu}[\p{L}'’&\/\- ]{0,38}):\s+(.+)$/u.exec(t);
  if (m && m[1].trim().split(/\s+/).length <= 4 && (splitTop(m[2], ";").length > 1 || QTY_START.test(m[2]))) {
    label = m[1].trim();
    rest = m[2];
  }
  const items = splitTop(rest, ";")
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);
  return { label, items: items.length ? items : [t] };
}

function buildGroups(entries) {
  const groups = [];
  let cur = { label: null, items: [] };
  const push = () => {
    if (cur.items.length) groups.push(cur);
  };
  for (const e of entries) {
    if (e.kind === "group") {
      push();
      cur = { label: e.text.replace(/:$/, "").trim(), items: [] };
    } else {
      const { label, items } = explodeItem(e.text);
      if (label) {
        push();
        groups.push({ label, items });
        cur = { label: null, items: [] };
      } else cur.items.push(...items);
    }
  }
  push();
  return groups;
}

function parseOne(slice) {
  const r = {
    title: slice[0].replace(/^\s*\d+\s*[.)]\s*/, "").trim() || "Untitled recipe",
    meta: [],
    intro: [],
    ingredients: [],
    steps: [],
    shopping: [],
    notes: [],
    skipped: [],
    warnings: [],
  };
  const ing = [];
  const shop = [];
  let state = "meta";
  let numbered = null; // null = unknown, true/false once the first step is seen

  for (let i = 1; i < slice.length; i++) {
    const line = slice[i];
    const sec = sectionOf(line);
    if (sec) {
      state = sec;
      continue;
    }
    if (state === "meta") {
      if (META_RE.test(line)) r.meta.push(...parseMeta(line));
      else r.intro.push(line);
    } else if (state === "skip") {
      r.skipped.push(line);
    } else if (state === "notes") {
      r.notes.push(line);
    } else if (state === "ingredients" || state === "shopping") {
      const entries = state === "ingredients" ? ing : shop;
      const last = entries[entries.length - 1];
      if (BULLET.test(line)) {
        entries.push({ kind: "item", text: line.replace(BULLET, "").trim(), bulleted: true });
      } else if (/:$/.test(line) && BULLET.test(slice[i + 1] || "")) {
        entries.push({ kind: "group", text: line }); // "Steak:" label above bullets
      } else if (last && last.kind === "item" && last.bulleted && !isTerminated(last.text)) {
        last.text += " " + line; // wrapped bullet
      } else if (state === "ingredients" && isHeadingLike(line) && BULLET.test(slice[i + 1] || "")) {
        entries.push({ kind: "group", text: line });
      } else if (state === "shopping" && isHeadingLike(line)) {
        state = "skip";
        r.skipped.push(line);
      } else if (last && last.kind === "item" && last.bulleted) {
        state = "skip"; // free text after a finished bullet list
        r.skipped.push(line);
      } else {
        entries.push({ kind: "item", text: line, bulleted: false });
      }
    } else if (state === "steps") {
      const m = /^\s*\d+\s*[.)]\s+(.*)$/.exec(line);
      const last = r.steps[r.steps.length - 1];
      if (m) {
        numbered = true;
        r.steps.push(m[1].trim());
      } else if (BULLET.test(line)) {
        r.steps.push(line.replace(BULLET, "").trim());
      } else if (last === undefined) {
        numbered = numbered ?? false;
        r.steps.push(line);
      } else if (numbered) {
        if (isTerminated(last) && isHeadingLike(line)) {
          state = "skip";
          r.skipped.push(line);
        } else r.steps[r.steps.length - 1] = last + " " + line;
      } else {
        // unnumbered text: a new step starts after a finished sentence
        if (isTerminated(last)) r.steps.push(line);
        else r.steps[r.steps.length - 1] = last + " " + line;
      }
    }
  }

  r.ingredients = buildGroups(ing);
  r.shopping = buildGroups(shop);
  if (!r.ingredients.length) r.warnings.push("No ingredients found");
  if (!r.steps.length) r.warnings.push("No instructions found");
  r.content = formatRecipe(r);
  return r;
}

function pushGroups(out, groups) {
  for (const g of groups) {
    if (g.label) out.push(g.label + ":"); // trailing colon keeps it distinct from a wrapped line
    g.items.forEach((it) => out.push("- " + it));
  }
}

export function formatRecipe(r) {
  const out = [];
  if (r.meta?.length) out.push(...r.meta, "");
  if (r.intro?.length) out.push(r.intro.join(" "), "");
  if (r.ingredients?.length) {
    out.push(LABEL.ingredients);
    pushGroups(out, r.ingredients);
    out.push("");
  }
  if (r.steps?.length) {
    out.push(LABEL.steps);
    r.steps.forEach((s, i) => out.push(`${i + 1}. ${s}`));
    out.push("");
  }
  if (r.shopping?.length) {
    out.push(LABEL.shopping);
    pushGroups(out, r.shopping);
    out.push("");
  }
  if (r.notes?.length) out.push(LABEL.notes, ...r.notes, "");
  return out.join("\n").trim();
}

// Split free text (a PDF, a pasted page, one recipe or many) into recipes.
export function parseRecipes(text) {
  const lines = normalize(text);
  const starts = findStarts(lines);
  if (!starts.length) return { recipes: [], skipped: [] };
  const skipped = lines.slice(0, starts[0]);
  const recipes = starts.map((s, i) => parseOne(lines.slice(s, starts[i + 1] ?? lines.length)));
  recipes.forEach((r) => skipped.push(...r.skipped));
  return { recipes, skipped };
}

// Read a stored recipe string back into display blocks.
// Returns {structured:false} for old free-text recipes so they render as before.
export function parseContent(content) {
  const lines = String(content || "").replace(/\r/g, "").split("\n");
  const nonEmpty = lines.map((l) => l.trim());
  if (!nonEmpty.some((t) => t && sectionOf(t))) return { structured: false, blocks: [] };
  const blocks = [];
  let state = "meta";
  for (let i = 0; i < nonEmpty.length; i++) {
    const t = nonEmpty[i];
    if (!t) continue;
    const sec = sectionOf(t);
    if (sec) {
      state = sec;
      blocks.push({ type: "heading", key: sec, text: LABEL[sec] });
      continue;
    }
    if (state === "meta") {
      blocks.push({ type: META_RE.test(t) ? "meta" : "para", text: t });
    } else if (state === "steps") {
      const m = /^\d+\s*[.)]\s*(.*)$/.exec(t);
      const text = m ? m[1] : t.replace(BULLET, "");
      if (!text) continue;
      blocks.push({ type: m || BULLET.test(t) ? "step" : "para", text });
    } else if (state === "ingredients" || state === "shopping") {
      if (BULLET.test(t)) {
        const text = t.replace(BULLET, "").trim();
        if (text) blocks.push({ type: "item", text, list: state });
      } else {
        let next = i + 1;
        while (next < nonEmpty.length && !nonEmpty[next]) next++;
        const isGroup = (isHeadingLike(t) || /:$/.test(t)) && BULLET.test(nonEmpty[next] || "");
        blocks.push(
          isGroup
            ? { type: "group", text: t.replace(/:$/, "") }
            : { type: "item", text: t, list: state }
        );
      }
    } else {
      blocks.push({ type: "para", text: t });
    }
  }
  return { structured: true, blocks };
}

export function shoppingItems(content) {
  return parseContent(content)
    .blocks.filter((b) => b.type === "item" && b.list === "shopping")
    .map((b) => b.text);
}

// Tidy a hand-typed recipe before saving: drop empty bullets/steps and empty
// section headings left over from the template, collapse blank lines.
export function cleanContent(content) {
  let lines = String(content || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter(
      (l) =>
        !/^\s*(?:[-•*]|\d+[.)])\s*$/.test(l) && // empty bullet / step
        !/^\s*(?:serves?|servings?|yields?|makes|(?:approximate|prep|cook|total)?\s*time)\s*:\s*$/i.test(l) // blank meta
    );
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (sectionOf(lines[i])) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j >= lines.length || sectionOf(lines[j])) continue; // empty section
    }
    out.push(lines[i]);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
