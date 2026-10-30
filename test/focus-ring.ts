import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type SourceFile = { path: string; text: string };
export type FocusViolation = { file: string; line: number; selector: string; reason: string };

type Declaration = { name: string; value: string; line: number };
type CssRule = { selectors: string[]; declarations: Declaration[]; media: string; order: number };

const FOCUSABLE_TAGS = "a|button|input|select|textarea|summary";

function lineAt(text: string, index: number, startLine: number) {
  return startLine + text.slice(0, index).split("\n").length - 1;
}

function closingBrace(text: string, open: number) {
  let depth = 0;
  let quote = "";
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return i;
  }
  return text.length;
}

function splitList(selector: string) {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of selector) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += ch;
  }
  parts.push(current.trim());
  return parts.filter(Boolean);
}

function parseDeclarations(body: string, startLine: number) {
  const out: Declaration[] = [];
  for (const m of body.matchAll(/(?:^|;)\s*([-\w]+)\s*:\s*([^;]+)/g)) {
    out.push({
      name: m[1].toLowerCase(),
      value: m[2].trim().toLowerCase(),
      line: lineAt(body, m.index + m[0].indexOf(m[1]), startLine),
    });
  }
  return out;
}

function parseBlock(text: string, startLine: number, media: string, rules: CssRule[]) {
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ";") start = i + 1;
    if (text[i] !== "{") continue;
    const close = closingBrace(text, i);
    const prelude = text.slice(start, i).trim().replace(/\s+/g, " ");
    const inner = text.slice(i + 1, close);
    const innerLine = lineAt(text, i + 1, startLine);
    if (/^@(media|supports|container|layer)\b/.test(prelude)) {
      parseBlock(inner, innerLine, `${media} ${prelude}`.trim(), rules);
    } else if (!prelude.startsWith("@")) {
      rules.push({
        selectors: splitList(prelude),
        declarations: parseDeclarations(inner, innerLine),
        media,
        order: rules.length,
      });
    }
    i = close;
    start = close + 1;
  }
}

export function parseCss(css: string, startLine = 1) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  const rules: CssRule[] = [];
  parseBlock(clean, startLine, "", rules);
  return rules;
}

function rulesIn(file: SourceFile) {
  if (file.path.endsWith(".css")) return parseCss(file.text);
  const rules: CssRule[] = [];
  for (const m of file.text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const contentAt = m.index + m[0].indexOf(">") + 1;
    for (const rule of parseCss(m[1], lineAt(file.text, contentAt, 1))) {
      rules.push({ ...rule, order: rules.length });
    }
  }
  return rules;
}

function compounds(selector: string) {
  return selector
    .replace(/\([^)]*\)/g, (group) => group.replace(/\s/g, ""))
    .split(/\s*[\s>+~]\s*/)
    .filter(Boolean);
}

function specificity(selector: string) {
  const s = selector.replace(/:where\([^)]*\)/g, "").replace(/:not\(([^)]*)\)/g, " $1 ");
  const ids = s.match(/#[\w-]+/g)?.length ?? 0;
  const classes = s.match(/\.[\w-]+|\[[^\]]*\]|(?<!:):(?!:)[\w-]+/g)?.length ?? 0;
  const tags = s.match(/::[\w-]+|(?:^|[\s>+~])[a-z][\w-]*/gi)?.length ?? 0;
  return ids * 10000 + classes * 100 + tags;
}

function names(compound: string) {
  const bare = compound.replace(/\([^)]*\)/g, "");
  const tag = bare.match(/^[a-z][\w-]*/i)?.[0];
  return [...(tag ? [tag] : []), ...(bare.match(/\.[\w-]+/g) ?? [])];
}

function canHoldFocus(key: string, focusable: Set<string>) {
  if (key.includes("::")) return false;
  const k = key.replace(/:not\([^)]*\)/g, "");
  if (/:focus(?!-within)/.test(k) || k.includes("[tabindex") || k.startsWith("*")) return true;
  if (new RegExp(`(?:^|[(,])(?:${FOCUSABLE_TAGS})(?=$|[.:\\[#,)])`).test(k)) return true;
  return names(k).some((name) => focusable.has(name));
}

function hidesOutline({ name, value }: Declaration) {
  if (name === "outline") return /^(none|0[a-z]*)(\s|$)/.test(value);
  if (name === "outline-style") return value.startsWith("none");
  if (name === "outline-width") return /^0[a-z]*$/.test(value);
  return false;
}

function drawsRing(rule: CssRule) {
  return rule.declarations.some(
    (d) =>
      (d.name === "outline" && !hidesOutline(d)) ||
      (d.name === "box-shadow" && shadowIsRing(d.value)),
  );
}

function shadowLayers(value: string) {
  // Drop colors (hex and functions like rgba() or var()) so their digits and names
  // cannot be read as lengths or as the inset keyword.
  return value
    .split(/,(?![^(]*\))/)
    .map((layer) => layer.replace(/[\w-]+\([^()]*(?:\([^()]*\)[^()]*)*\)/g, " ").replace(/#[0-9a-fA-F]+\b/g, " "));
}

function shadowIsRing(value: string) {
  return shadowLayers(value).some((layer) => {
    if (/(?:^|\s)inset(?=\s|$)/.test(layer)) return true;
    const lengths = layer.match(/(?:^|\s)-?\d*\.?\d+(?:px|r?em|%)?(?=\s|$)/g) ?? [];
    return lengths.length >= 4 && parseFloat(lengths[3]) > 0;
  });
}

function ringSurvivesClip(rule: CssRule) {
  return rule.declarations.some(
    (d) =>
      (d.name === "clip-path" && d.value === "none") ||
      (d.name === "outline-offset" && d.value.startsWith("-")) ||
      (d.name === "box-shadow" && shadowLayers(d.value).some((layer) => /(?:^|\s)inset(?=\s|$)/.test(layer))),
  );
}

function restored(rules: CssRule[], broken: CssRule, selector: string, clipped: boolean) {
  const key = compounds(selector).at(-1) ?? "";
  const brokenNames = names(key);
  return rules.some((rule) => {
    if (rule.media && rule.media !== broken.media) return false;
    return rule.selectors.some((candidate) => {
      const parts = compounds(candidate);
      const focused = parts.find((part) => part.includes(":focus-visible"));
      if (!focused) return false;
      const targets = names(focused);
      const shared = targets.some((name) => brokenNames.includes(name));
      if (!shared && (clipped || targets.length > 0)) return false;
      if (focused === parts.at(-1)) {
        const [mine, theirs] = [specificity(candidate), specificity(selector)];
        if (mine < theirs || (mine === theirs && rule.order < broken.order)) return false;
      }
      return clipped ? ringSurvivesClip(rule) || (focused !== parts.at(-1) && drawsRing(rule)) : drawsRing(rule);
    });
  });
}

export function focusableClasses(files: SourceFile[]) {
  const found = new Set<string>();
  const add = (classes: string) => {
    for (const token of classes.match(/[\w-]+/g) ?? []) found.add(`.${token}`);
  };
  const tag = new RegExp(`<(?:${FOCUSABLE_TAGS})\\b[^>]*>|<[a-z][\\w-]*\\b[^>]*\\btabindex=[^>]*>`, "gi");
  const created = new RegExp(
    `createElement\\(["'](?:${FOCUSABLE_TAGS})["']\\)[\\s\\S]{0,200}?\\.className\\s*=\\s*["'\`]([^"'\`]+)`,
    "g",
  );
  for (const file of files) {
    for (const [open] of file.text.matchAll(tag)) {
      const attr = open.match(/\bclass(?::list)?=(?:"([^"]*)"|'([^']*)'|\{(.*?)\}(?=[\s/>]))/);
      if (!attr) continue;
      if (attr[3] === undefined) add(attr[1] ?? attr[2]);
      else for (const [, text] of attr[3].matchAll(/["'`]([^"'`]*)["'`]/g)) add(text);
    }
    for (const [, classes] of file.text.matchAll(created)) add(classes);
  }
  return found;
}

export function findFocusViolations(files: SourceFile[]) {
  const focusable = focusableClasses(files);
  const violations: FocusViolation[] = [];
  for (const file of files) {
    if (!/\.(css|astro|html)$/.test(file.path)) continue;
    const rules = rulesIn(file);
    for (const rule of rules) {
      for (const declaration of rule.declarations) {
        const clipped = declaration.name === "clip-path" && declaration.value !== "none";
        if (!clipped && !hidesOutline(declaration)) continue;
        for (const selector of rule.selectors) {
          if (selector.includes(":not(:focus-visible)")) continue;
          if (!canHoldFocus(compounds(selector).at(-1) ?? "", focusable)) continue;
          if (restored(rules, rule, selector, clipped)) continue;
          violations.push({
            file: file.path,
            line: declaration.line,
            selector,
            reason: clipped
              ? "clip-path cuts off the focus ring; move it to ::before or set an inset ring in a :focus-visible rule for this selector"
              : "outline removed with no :focus-visible rule for this selector that draws a ring and wins the cascade",
          });
        }
      }
    }
  }
  return violations;
}

export function readSources(root: string) {
  const files: SourceFile[] = [];
  for (const dir of ["src", "public"]) {
    const entries = readdirSync(path.join(root, dir), { recursive: true, encoding: "utf8" });
    for (const entry of entries) {
      if (!/\.(css|astro|html|ts|js)$/.test(entry)) continue;
      const rel = path.posix.join(dir, entry.split(path.sep).join("/"));
      files.push({ path: rel, text: readFileSync(path.join(root, rel), "utf8") });
    }
  }
  return files;
}
