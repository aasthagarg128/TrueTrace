/**
 * Paste into a browser console to audit rendered contrast on the current page.
 *
 * Handles oklab(), which Tailwind emits for alpha-modified colour tokens
 * (bg-canvas/85). A naive rgb-only parser reads those decimals as 0-255 channel
 * values and reports large false failures — that happened, and cost a debugging
 * round trip. It also composites translucent layers rather than stopping at the
 * first non-transparent ancestor.
 */
(() => {
  function parse(c) {
    if (!c) return null;
    let m = c.match(/^rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
      const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return { r: lin(p[0]), g: lin(p[1]), b: lin(p[2]), a: p[3] === undefined ? 1 : p[3] };
    }
    m = c.match(/^oklab\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[\s\/]+/).filter(Boolean).map(Number);
      const [L, A, B] = p; const a = p[3] === undefined ? 1 : p[3];
      const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
      const mm = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
      const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
      return {
        r: 4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
        g: -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
        b: -0.0041960863 * l - 0.7034186147 * mm + 1.7076147010 * s,
        a,
      };
    }
    return null;
  }
  const over = (f, b) => ({ r: f.r*f.a + b.r*(1-f.a), g: f.g*f.a + b.g*(1-f.a), b: f.b*f.a + b.b*(1-f.a), a: 1 });
  const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const ratio = (f, b) => { const x = lum(f), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  function effectiveBg(el) {
    let acc = null, node = el;
    while (node) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) acc = acc ? over(acc, c) : c;
      if (acc && acc.a >= 1) return acc;
      node = node.parentElement;
    }
    return acc ?? parse("rgb(255,255,255)");
  }

  document.querySelectorAll(".tt-reveal").forEach((e) => { e.style.transition = "none"; e.classList.add("tt-reveal-in"); });
  const fails = [];
  document.querySelectorAll("h1,h2,h3,p,a,label,summary,span,li,dt,dd,button").forEach((el) => {
    const t = el.textContent.trim(); if (!t || el.children.length) return;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color); if (!fg) return;
    const bg = effectiveBg(el);
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    const r = ratio(fg.a < 1 ? over(fg, bg) : fg, bg);
    if (r < need) fails.push({ text: t.slice(0, 40), ratio: +r.toFixed(2), need });
  });
  const de = document.documentElement;
  return { page: location.pathname, viewport: de.clientWidth, horizontalScroll: de.scrollWidth > de.clientWidth, failures: fails };
})();
