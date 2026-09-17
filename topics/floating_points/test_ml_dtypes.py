"""Check fmt.js against ml_dtypes / numpy: every code decodes identically (all codes for ≤16-bit formats,
a random sample for float32), and float64→code rounding matches for representable values, midpoints ± 1ulp,
overflow / underflow edges, specials and random probes.
Run: python test_ml_dtypes.py   (needs numpy, ml_dtypes, node)"""
import json, math, random, subprocess, sys, os
import numpy as np, ml_dtypes as md

HERE = os.path.dirname(os.path.abspath(__file__))
NODE = r"""
const F = require(process.argv[1] + "/fmt.js");
const inp = JSON.parse(require("fs").readFileSync(0, "utf8"));
const out = {};
for (const f of F.FORMATS) {
  const dec = [], enc = [];
  for (const c of inp[f.name].codes) { const v = F.decode(f, c).value; dec.push(Object.is(v, -0) ? "-0" : String(v)); }
  for (const s of inp[f.name].probes) enc.push(F.encode(f, F.parseValue(s)));
  out[f.name] = { dec, enc };
}
process.stdout.write(JSON.stringify(out));
"""

DTYPES = {  # name -> (dtype, bits)
    **{n: (np.dtype(getattr(md, n)), int(n[5:6]) if n[5] in "46" else 8) for n in
       ["float4_e2m1fn", "float6_e2m3fn", "float6_e3m2fn", "float8_e3m4", "float8_e4m3", "float8_e4m3fn",
        "float8_e4m3fnuz", "float8_e4m3b11fnuz", "float8_e5m2", "float8_e5m2fnuz", "float8_e8m0fnu"]},
    "float16": (np.dtype(np.float16), 16), "bfloat16": (np.dtype(md.bfloat16), 16), "float32": (np.dtype(np.float32), 32),
}
UINT = {4: np.uint8, 6: np.uint8, 8: np.uint8, 16: np.uint16, 32: np.uint32}

def fstr(v):
    if math.isnan(v): return "NaN"
    if math.isinf(v): return "Infinity" if v > 0 else "-Infinity"
    return v

random.seed(0); rng = np.random.default_rng(0)
inp, fails = {}, 0
for name, (dt, bits) in DTYPES.items():
    fi = md.finfo(dt) if bits < 32 else np.finfo(dt)
    if bits <= 16:
        codes = np.arange(2 ** bits, dtype=UINT[bits])
    else:  # float32: sample, plus the edges
        codes = np.unique(np.concatenate([rng.integers(0, 2 ** 32, 20000, dtype=np.uint32),
                                          np.array([0, 1, 0x7f7fffff, 0x7f800000, 0x7fc00000, 0x80000000, 0x80000001, 0xff800000, 0xffffffff, 0x3f800000, 0x00800000], dtype=np.uint32)]))
    vals = codes.view(dt).astype(np.float64)
    fin = sorted({float(v) for v in vals if np.isfinite(v)})
    if len(fin) > 600: fin = sorted(random.sample(fin, 600))
    p = list(fin)
    for a, b in zip(fin, fin[1:]):
        m = (a + b) / 2
        p += [m, math.nextafter(m, a), math.nextafter(m, b)]
    mx, ss = float(fi.max), float(fi.smallest_subnormal)
    p += [mx * 1.01, mx * 1.1, mx * 2, mx * 1e6, 1e300, -1e300, ss / 2, ss * 0.49, ss * 0.51, ss / 1e6,
          math.inf, -math.inf, math.nan, 0.0, -0.0, 1e-300, 0.1, 1 / 3, math.pi, 1.0625 + 2 ** -40]
    p += [random.uniform(-1, 1) * 2 ** random.uniform(-160, 135) for _ in range(3000)]
    inp[name] = {"codes": [int(c) for c in codes], "probes": [repr(x) for x in p]}

res = json.loads(subprocess.run(["node", "-e", NODE, HERE], input=json.dumps(inp), capture_output=True, text=True, check=True).stdout)

for name, (dt, bits) in DTYPES.items():
    codes = np.array(inp[name]["codes"], dtype=UINT[bits])
    ref_dec = codes.view(dt).astype(np.float64)
    for c, js, ref in zip(codes, res[name]["dec"], ref_dec):
        rs = fstr(float(ref))
        ok = js == rs if isinstance(rs, str) else (float(js) == rs and math.copysign(1, float(js)) == math.copysign(1, rs))
        if not ok: fails += 1; print(f"DECODE {name} code=0x{int(c):02x}: js={js} ref={rs}")
    for s, jc in zip(inp[name]["probes"], res[name]["enc"]):
        with np.errstate(all="ignore"):
            rc = int(np.float64(float(s)).astype(dt).view(UINT[bits]))
        if jc != rc: fails += 1; print(f"ENCODE {name} x={s}: js=0x{jc:02x} ref=0x{rc:02x}")
    print(f"{name}: {len(codes)} codes, {len(inp[name]['probes'])} probes checked")
print("FAIL", fails) if fails else print("ALL ALIGNED with ml_dtypes", md.__version__, "/ numpy", np.__version__)
sys.exit(1 if fails else 0)
