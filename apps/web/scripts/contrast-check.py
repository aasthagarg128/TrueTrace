def lin(c):
    c/=255
    return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def lum(h):
    h=h.lstrip("#"); r,g,b=(int(h[i:i+2],16) for i in (0,2,4))
    return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)
def ratio(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb)
    return (hi+0.05)/(lo+0.05)

T={
 "LIGHT":{"canvas":"#f4f8f8","surface":"#ffffff","raised":"#e9f0f1",
          "ink":"#111b1f","muted":"#3f545b","subtle":"#5a6f76",
          "accent":"#0f6f68","accent2":"#2a5f86","accentSoft":"#d8ecea",
          "attention":"#7a5312","attentionBg":"#fdf6e8"},
 "DARK":{"canvas":"#0d1418","surface":"#141f24","raised":"#1a262c",
         "ink":"#e9eff1","muted":"#a9bfc6","subtle":"#8ba3ab",
         "accent":"#5ec8b4","accent2":"#8fbde3","accentSoft":"#16332f",
         "attention":"#e3bd82","attentionBg":"#241d10"},
}
CH=[("ink/canvas","ink","canvas",4.5),("ink/surface","ink","surface",4.5),
    ("muted/canvas","muted","canvas",4.5),("muted/surface","muted","surface",4.5),
    ("subtle/canvas","subtle","canvas",4.5),("subtle/raised","subtle","raised",4.5),
    ("accent/canvas","accent","canvas",4.5),("accent/surface","accent","surface",4.5),
    ("accent2/canvas","accent2","canvas",4.5),("accent2/surface","accent2","surface",4.5),
    ("ink/accentSoft","ink","accentSoft",4.5),("accent/accentSoft","accent","accentSoft",3.0),
    ("attention/attentionBg","attention","attentionBg",4.5)]
bad=0
for name,t in T.items():
    print(f"\n{name}")
    for lbl,f,b,need in CH:
        r=ratio(t[f],t[b]); ok=r>=need
        bad += 0 if ok else 1
        print(f"  {lbl:<22} {r:5.2f}:1 need {need}  {'PASS' if ok else 'FAIL'}")
print("\nALL PASS" if not bad else f"\n{bad} FAILURES")
