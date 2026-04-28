const SUPER: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  n: "ⁿ",
  i: "ⁱ",
  a: "ᵃ",
  b: "ᵇ",
  c: "ᶜ",
  d: "ᵈ",
  x: "ˣ",
  y: "ʸ",
};

const SUB: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
  a: "ₐ",
  e: "ₑ",
  h: "ₕ",
  i: "ᵢ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  r: "ᵣ",
  s: "ₛ",
  t: "ₜ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
};

const SYMBOLS: Record<string, string> = {
  cdot: "×",
  times: "×",
  div: "÷",
  pm: "±",
  mp: "∓",
  leq: "≤",
  le: "≤",
  geq: "≥",
  ge: "≥",
  neq: "≠",
  ne: "≠",
  approx: "≈",
  equiv: "≡",
  infty: "∞",
  infin: "∞",
  rightarrow: "→",
  leftarrow: "←",
  Rightarrow: "⇒",
  Leftarrow: "⇐",
  to: "→",
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  phi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω",
  sin: "sin",
  cos: "cos",
  tan: "tan",
  log: "log",
  ln: "ln",
  left: "",
  right: "",
  text: "",
  mathrm: "",
  mathbf: "",
  mathit: "",
  displaystyle: "",
  quad: " ",
  qquad: "  ",
};

function mapChars(input: string, map: Record<string, string>): string {
  let out = "";
  for (const ch of input) {
    out += map[ch] ?? ch;
  }
  return out;
}

function replaceFractions(src: string): string {
  let result = src;
  for (let pass = 0; pass < 6; pass++) {
    const next = result.replace(
      /\\(?:d?frac|tfrac)\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
      (_m, a: string, b: string) => `(${a.trim()}) / (${b.trim()})`
    );
    if (next === result) break;
    result = next;
  }
  return result;
}

function replaceSqrt(src: string): string {
  let result = src;
  for (let pass = 0; pass < 6; pass++) {
    const next = result.replace(
      /\\sqrt\s*(?:\[([^\]]*)\])?\s*\{([^{}]*)\}/g,
      (_m, n: string | undefined, x: string) =>
        n ? `${n.trim()}-th root(${x.trim()})` : `√(${x.trim()})`
    );
    if (next === result) break;
    result = next;
  }
  return result;
}

function replaceSuperSub(src: string): string {
  let result = src;

  // ^{...} where ... is short and convertible
  result = result.replace(/\^\{([^{}]{1,6})\}/g, (m, inner: string) => {
    const trimmed = inner.trim();
    if (/^[0-9+\-=()nia]+$/i.test(trimmed)) {
      const mapped = mapChars(trimmed, SUPER);
      if (mapped !== trimmed && !mapped.includes("undefined")) return mapped;
    }
    return `^(${trimmed})`;
  });
  // _{...}
  result = result.replace(/_\{([^{}]{1,6})\}/g, (m, inner: string) => {
    const trimmed = inner.trim();
    if (/^[0-9+\-=()a-z]+$/i.test(trimmed)) {
      const mapped = mapChars(trimmed.toLowerCase(), SUB);
      if (mapped !== trimmed && !mapped.includes("undefined")) return mapped;
    }
    return `_(${trimmed})`;
  });
  // ^x  (single char)
  result = result.replace(/\^([0-9a-zA-Z+\-])/g, (_m, c: string) => SUPER[c] ?? `^${c}`);
  // _x  (single char) — careful not to break markdown italics; only when preceded by alnum/)
  result = result.replace(/([\w)\]])_([0-9a-zA-Z+\-])/g, (_m, prev: string, c: string) => {
    const sub = SUB[c.toLowerCase()];
    return sub ? `${prev}${sub}` : `${prev}_${c}`;
  });
  return result;
}

function replaceCommands(src: string): string {
  // Symbol commands like \pi, \cdot, \le ...
  return src.replace(/\\([A-Za-z]+)/g, (m, name: string) => {
    if (Object.prototype.hasOwnProperty.call(SYMBOLS, name)) {
      return SYMBOLS[name];
    }
    return m;
  });
}

function stripDelimiters(src: string): string {
  let out = src;
  // Block math: $$...$$ and \[...\]
  out = out.replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner: string) => `\n${inner.trim()}\n`);
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner: string) => `\n${inner.trim()}\n`);
  // Inline math: $...$ and \(...\)
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner: string) => inner.trim());
  out = out.replace(/(?<![\\$])\$([^$\n]+?)\$/g, (_m, inner: string) => inner.trim());
  // \begin{...} ... \end{...}  → keep inner
  out = out.replace(
    /\\begin\{[a-zA-Z*]+\}([\s\S]*?)\\end\{[a-zA-Z*]+\}/g,
    (_m, inner: string) => `\n${inner.trim()}\n`
  );
  // Hard line breaks
  out = out.replace(/\\\\\s*/g, "\n");
  // Stray \, \; \! spacing
  out = out.replace(/\\[,;!: ]/g, " ");
  // Curly braces left over from {} groupings
  out = out.replace(/\\\{/g, "{").replace(/\\\}/g, "}");
  return out;
}

export function sanitizeMath(input: string): string {
  if (!input) return input;
  let out = input;
  out = stripDelimiters(out);
  out = replaceFractions(out);
  out = replaceSqrt(out);
  out = replaceCommands(out);
  out = replaceSuperSub(out);
  // Collapse any remaining stray backslashes before a letter (unknown commands)
  out = out.replace(/\\([A-Za-z]+)/g, "$1");
  // Tidy double spaces inside lines
  out = out
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/\s+$/g, ""))
    .join("\n");
  return out;
}
