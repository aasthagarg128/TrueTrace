def lin(c):
    c/=255
    return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def lum(h):
    h=h.lstrip("#"); r,g,b=(int(h[i:i+2],16) for i in (0,2,4))
    return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)
def ratio(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb)
    return (hi+0.05)/(lo+0.05)

BRAND = {"plum":"#490b3d","crimson":"#bd1e51","gold":"#f1b814"}
print("the three brand colours, as text:")
for name,c in BRAND.items():
    print(f"  {name:8} {c}  on white {ratio(c,'#ffffff'):5.2f}:1   on near-black {ratio(c,'#140410'):5.2f}:1")
print()

T = {
 "LIGHT": {
   "canvas":"#fbf7fa","surface":"#ffffff","raised":"#f4ebf1","line":"#d6bccd",
   "ink":"#2b0722","muted":"#5c2a4d","subtle":"#7a4468",
   "accent":"#bd1e51","accent-ink":"#ffffff","accent-soft":"#fbe7ee",
   "attention":"#7a5a06","attention-bg":"#fdf5e0","attention-line":"#f1b814",
 },
 "DARK": {
   "canvas":"#180514","surface":"#26091f","raised":"#330e2a","line":"#54234607",
   "ink":"#f8edf4","muted":"#d5b6c9","subtle":"#b189a2",
   "accent":"#f2traits","accent-ink":"#ffffff","accent-soft":"#3d0f2e",
   "attention":"#f1b814","attention-bg":"#2e2208","attention-line":"#6b5210",
 },
}
# fix the two placeholders properly
T["DARK"]["line"]="#542346"
T["DARK"]["accent"]="#e8467d"   # lightened crimson: #bd1e51 is too dark on this ground

CH=[("ink/canvas","ink","canvas",4.5),("ink/surface","ink","surface",4.5),
    ("muted/canvas","muted","canvas",4.5),("muted/surface","muted","surface",4.5),
    ("subtle/canvas","subtle","canvas",4.5),("subtle/raised","subtle","raised",4.5),
    ("accent/canvas","accent","canvas",4.5),("accent/surface","accent","surface",4.5),
    ("accent-ink/accent","accent-ink","accent",4.5),
    ("ink/accent-soft","ink","accent-soft",4.5),
    ("attention/attention-bg","attention","attention-bg",4.5),
    ("line/canvas (ui)","line","canvas",1.5),
    ("attention-line/canvas (ui)","attention-line","canvas",1.5)]
bad=0
for name,t in T.items():
    print(name)
    for lbl,f,b,need in CH:
        r=ratio(t[f],t[b]); ok=r>=need
        bad += 0 if ok else 1
        print(f"  {lbl:<28} {r:5.2f}:1 need {need}  {'PASS' if ok else 'FAIL'}")
    print()
print("ALL PASS" if not bad else f"{bad} FAILURES")
