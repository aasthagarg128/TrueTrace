"""WCAG contrast check for the proposed palette. Guessing at contrast is how
you ship text that a chunk of your users cannot read."""

def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def lum(hexs):
    h = hexs.lstrip("#")
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b)

def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

THEMES = {
  "LIGHT": {
    "bg": "#f6f8f8", "surface": "#ffffff", "surface2": "#eef2f3", "border": "#d0dade",
    "text": "#111b1f", "muted": "#42565d", "subtle": "#5d7178",
    "accent": "#0f6f68", "accentFg": "#ffffff",
    "attention": "#7a5312", "attentionBg": "#fdf6e8",
  },
  "DARK": {
    "bg": "#0e1519", "surface": "#152025", "surface2": "#1b272d", "border": "#2a3a41",
    "text": "#e9eff1", "muted": "#a9bfc6", "subtle": "#8ba3ab",
    "accent": "#5ec8b4", "accentFg": "#06201c",
    "attention": "#e3bd82", "attentionBg": "#241d10",
  },
}

CHECKS = [
  ("text  on bg",       "text", "bg",       4.5),
  ("text  on surface",  "text", "surface",  4.5),
  ("muted on bg",       "muted", "bg",      4.5),
  ("muted on surface",  "muted", "surface", 4.5),
  ("subtle on bg",      "subtle", "bg",     4.5),
  ("subtle on surface2","subtle", "surface2",4.5),
  ("accent on bg",      "accent", "bg",     3.0),
  ("accentFg on accent","accentFg","accent",4.5),
  ("attention on attentionBg","attention","attentionBg",4.5),
  ("border on bg (ui)", "border", "bg",     1.5),
]

worst = 99
for name, t in THEMES.items():
    print(f"\n{name}")
    for label, fg, bg, need in CHECKS:
        r = ratio(t[fg], t[bg])
        ok = "PASS" if r >= need else "FAIL"
        if ok == "FAIL":
            worst = min(worst, r)
        print(f"  {label:<26} {r:5.2f}:1  need {need}  {ok}")
print("\nall checks pass" if worst == 99 else "\nSOME CHECKS FAILED")
