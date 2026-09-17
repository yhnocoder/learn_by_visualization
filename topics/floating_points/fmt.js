/* Core encode/decode for ml_dtypes / numpy float formats. No DOM. Loaded by index.html and by test_ml_dtypes.py (via node).
   All bit twiddling uses >>> / Math.pow so 32-bit codes stay unsigned. */

var FORMATS = [
	{ group: "fp4",  name: "float4_e2m1fn",      bits: 4,  e: 2, m: 1,  bias: 1,   kind: "mx" },
	{ group: "fp6",  name: "float6_e2m3fn",      bits: 6,  e: 2, m: 3,  bias: 1,   kind: "mx" },
	{ group: "fp6",  name: "float6_e3m2fn",      bits: 6,  e: 3, m: 2,  bias: 3,   kind: "mx" },
	{ group: "fp8",  name: "float8_e3m4",        bits: 8,  e: 3, m: 4,  bias: 3,   kind: "ieee" },
	{ group: "fp8",  name: "float8_e4m3",        bits: 8,  e: 4, m: 3,  bias: 7,   kind: "ieee" },
	{ group: "fp8",  name: "float8_e4m3fn",      bits: 8,  e: 4, m: 3,  bias: 7,   kind: "fn" },
	{ group: "fp8",  name: "float8_e4m3fnuz",    bits: 8,  e: 4, m: 3,  bias: 8,   kind: "fnuz" },
	{ group: "fp8",  name: "float8_e4m3b11fnuz", bits: 8,  e: 4, m: 3,  bias: 11,  kind: "fnuz" },
	{ group: "fp8",  name: "float8_e5m2",        bits: 8,  e: 5, m: 2,  bias: 15,  kind: "ieee" },
	{ group: "fp8",  name: "float8_e5m2fnuz",    bits: 8,  e: 5, m: 2,  bias: 16,  kind: "fnuz" },
	{ group: "fp8",  name: "float8_e8m0fnu",     bits: 8,  e: 8, m: 0,  bias: 127, kind: "e8m0" },
	{ group: "fp16", name: "float16",            bits: 16, e: 5, m: 10, bias: 15,  kind: "ieee", direct: true },
	{ group: "fp16", name: "bfloat16",           bits: 16, e: 8, m: 7,  bias: 127, kind: "ieee" },
	{ group: "fp32", name: "float32",            bits: 32, e: 8, m: 23, bias: 127, kind: "ieee" },
];

/* kind:
   ieee : exp all-ones => inf (mant 0) / nan.  signed zero.
   fn   : no inf; nan = S.1111.111 only.       signed zero.
   fnuz : no inf; nan = 0x80 only.             no negative zero (0x80 is the nan).
   mx   : no inf, no nan (fp4/fp6 microscaling).
   e8m0 : unsigned, no mantissa, value = 2^(code-127); nan = 0xFF; no zero.
   direct: numpy converts float64 → this format directly; every other format goes float64 → float32 → format. */

var KIND_NOTES = {
	ieee: "IEEE-754 style: exp=all 1s → mant=0 is ±inf, otherwise NaN. Signed zero.",
	fn:   "Finite only, NaN = S.1111.111 (mant all 1s with exp all 1s). Signed zero. No inf.",
	fnuz: "Finite only, single NaN = 0x80 (sign=1, everything else 0). Unsigned zero (no −0). No inf.",
	mx:   "OCP Microscaling element type: no inf, no NaN, saturating conversion. Signed zero.",
	e8m0: "OCP MX scale type: unsigned, 8 exponent bits, no mantissa. value = 2^(E−127). NaN = 0xFF. No zero, no inf.",
};

function fmtByName(name) {
	for (var i = 0; i < FORMATS.length; i++) if (FORMATS[i].name === name) return FORMATS[i];
}

function pow2(n) { return Math.pow(2, n); }
function hasSign(f) { return f.kind !== "e8m0"; }
function maxExp(f)  { return pow2(f.e) - 1; }
function maxMant(f) { return pow2(f.m) - 1; }
function maxCode(f) { return pow2(f.bits) - 1; }
function signBit(f) { return pow2(f.e + f.m); }

/* Split a code into fields. */
function fields(f, code) {
	return {
		sign: hasSign(f) ? Math.floor(code / signBit(f)) & 1 : 0,
		exp:  Math.floor(code / pow2(f.m)) & maxExp(f),
		mant: code % pow2(f.m),
	};
}

function join(f, sign, exp, mant) {
	return (hasSign(f) ? sign : 0) * signBit(f) + exp * pow2(f.m) + mant;
}

/* Magnitude of a sign-stripped code *as if* it were a plain (sub)normal, ignoring nan/inf rules.
   Also valid for the virtual "one past max" code used by rounding. Returns {sig, pow}: value = sig * 2^pow. */
function rawMag(f, code) {
	var exp = Math.floor(code / pow2(f.m)), mant = code % pow2(f.m);
	if (f.kind === "e8m0") return { sig: 1, pow: exp - f.bias };
	if (exp === 0) return { sig: mant, pow: 1 - f.bias - f.m };
	return { sig: mant + pow2(f.m), pow: exp - f.bias - f.m };
}

/* Full decode: {code, sign, exp, mant, cls, sig, pow, value}. cls in zero|sub|normal|inf|nan. */
function decode(f, code) {
	var r = fields(f, code);
	r.code = code;
	var cls;
	if (f.kind === "e8m0")      cls = code === 0xff ? "nan" : "normal";
	else if (f.kind === "ieee") cls = r.exp === maxExp(f) ? (r.mant === 0 ? "inf" : "nan") : r.exp === 0 ? (r.mant === 0 ? "zero" : "sub") : "normal";
	else if (f.kind === "fn")   cls = r.exp === maxExp(f) && r.mant === maxMant(f) ? "nan" : r.exp === 0 ? (r.mant === 0 ? "zero" : "sub") : "normal";
	else if (f.kind === "fnuz") cls = code === signBit(f) ? "nan" : r.exp === 0 ? (r.mant === 0 ? "zero" : "sub") : "normal";
	else                        cls = r.exp === 0 ? (r.mant === 0 ? "zero" : "sub") : "normal";
	r.cls = cls;
	var mg = rawMag(f, hasSign(f) ? code % signBit(f) : code);
	r.sig = mg.sig; r.pow = mg.pow;
	var s = r.sign ? -1 : 1;
	r.value = cls === "nan" ? NaN : cls === "inf" ? s * Infinity : s * mg.sig * pow2(mg.pow);
	return r;
}

/* Largest finite positive code. */
function maxFiniteCode(f) {
	if (f.kind === "ieee") return join(f, 0, maxExp(f) - 1, maxMant(f));
	if (f.kind === "fn")   return join(f, 0, maxExp(f), maxMant(f) - 1);
	if (f.kind === "e8m0") return 0xfe;
	return join(f, 0, maxExp(f), maxMant(f)); /* fnuz, mx */
}

function nanCode(f) {
	if (f.kind === "ieee") return join(f, 0, maxExp(f), pow2(f.m - 1));
	if (f.kind === "fn")   return join(f, 0, maxExp(f), maxMant(f));
	if (f.kind === "fnuz") return signBit(f);
	if (f.kind === "e8m0") return 0xff;
	return signBit(f); /* mx: ml_dtypes maps NaN to -0 */
}

/* Round a non-negative double q to an integer, ties to even. q < 2^53. */
function rne(q) {
	var i = Math.floor(q), frac = q - i;
	return frac > 0.5 || (frac === 0.5 && i % 2 === 1) ? i + 1 : i;
}

/* Round a JS double to the nearest code, matching ml_dtypes / numpy conversion semantics.
   Mirrors ml_dtypes ConvertImpl: normalise, shift with RNE, let the carry flow into the exponent, then overflow-check. */
function encode(f, x) {
	if (!f.direct) x = Math.fround(x);   /* numpy casts float64 → float32 → narrow type (double rounding) */
	if (f.kind === "e8m0") {
		if (!(x > 0) || x === Infinity) return 0xff;   /* nan, 0, negatives, inf */
		if (x < pow2(-126)) return x * pow2(126) > 0.5 ? 1 : 0;  /* ml_dtypes treats code 0 as "subnormal": RNE of x / 2^-126 */
		var k = Math.floor(Math.log2(x)), lo = pow2(k);
		if (x >= 2 * lo) { k++; lo *= 2; } else if (x < lo) { k--; lo /= 2; }  /* guard log2 rounding */
		if (x - lo >= lo / 2) k++;                     /* round half up on the mantissa fraction (RNE of 1.f → 1 or 2) */
		k += f.bias;
		return k > 254 ? 0xff : k;
	}
	if (x !== x) return nanCode(f);
	var sign = x < 0 || (x === 0 && 1 / x < 0) ? 1 : 0;
	var mag = Math.abs(x), maxFin = maxFiniteCode(f), code;
	if (mag === 0) code = 0;
	else if (mag === Infinity) code = maxFin + 1;
	else {
		var k = Math.floor(Math.log2(mag));
		if (mag >= pow2(k + 1)) k++; else if (mag < pow2(k)) k--;
		var base = Math.max(0, k + f.bias - 1);                 /* biased exponent − 1 (0 ⇒ subnormal) */
		var shift = base === 0 ? 1 - f.bias - f.m : k - f.m;    /* value = q × 2^shift */
		code = base * pow2(f.m) + rne(mag * pow2(-shift));      /* rounding carry lands in the exponent */
	}
	if (code > maxFin) {
		if (f.kind === "ieee") code = join(f, 0, maxExp(f), 0);
		else if (f.kind === "mx") code = maxFin;
		else if (f.kind === "fnuz") return nanCode(f);          /* single NaN, no sign */
		else return nanCode(f) + sign * signBit(f);             /* fn: NaN keeps the sign */
	}
	if (f.kind === "fnuz" && code === 0) return 0;              /* no -0 */
	return code + sign * signBit(f);
}

/* ---- exact decimal helpers (BigInt) ---- */

function exactDecimal(sig, pow) {
	if (!sig) return "0";
	var s = BigInt(sig);
	if (pow >= 0) return (s << BigInt(pow)).toString();
	var n = -pow;
	var digits = (s * (5n ** BigInt(n))).toString();
	if (digits.length <= n) digits = "0".repeat(n - digits.length + 1) + digits;
	var int = digits.slice(0, digits.length - n), frac = digits.slice(digits.length - n).replace(/0+$/, "");
	return frac ? int + "." + frac : int;
}

/* s × 2^p (s: non-negative BigInt) → {dec: decimal string, pow2: "2^k" or "m×2^k" with m odd}. */
function bigForm(s, p) {
	var dec = exactDecimal(s, p);
	while (s > 1n && s % 2n === 0n) { s /= 2n; p++; }
	return { dec: dec, pow2: (s === 1n ? "" : s + "×") + "2^" + p };
}

/* Align two finite decoded values to a common exponent p: {A, B, p} with a = A×2^p, b = B×2^p (signed BigInt). */
function align(a, b) {
	var p = Math.min(a.pow, b.pow);
	var A = BigInt(a.sig) << BigInt(a.pow - p), B = BigInt(b.sig) << BigInt(b.pow - p);
	return { A: a.sign ? -A : A, B: b.sign ? -B : B, p: p };
}

/* |a - b|, exact. */
function exactDelta(a, b) {
	var r = align(a, b), d = r.A - r.B;
	return bigForm(d < 0n ? -d : d, r.p);
}

/* (a + b) / 2, exact and signed. */
function exactMid(a, b) {
	var r = align(a, b), s = r.A + r.B, neg = s < 0n, o = bigForm(neg ? -s : s, r.p - 1);
	if (neg) { o.dec = "-" + o.dec; o.pow2 = "-" + o.pow2; }
	return o;
}

/* Exact decimal for the Value field. (Not the shortest round-trip string: "3.8" for 3.75 only misleads when learning the format.) */
function valueString(f, code) {
	var d = decode(f, code);
	if (d.cls === "nan") return "NaN";
	if (d.cls === "inf") return d.sign ? "-Infinity" : "Infinity";
	return (d.sign ? "-" : "") + exactDecimal(d.sig, d.pow);
}

/* Parse the text field: decimal, inf/-inf/nan. Returns a double or undefined. */
function parseValue(str) {
	str = str.trim().toLowerCase();
	if (str === "") return undefined;
	if (/^[+-]?(inf|infinity)$/.test(str)) return str[0] === "-" ? -Infinity : Infinity;
	if (/^[+-]?nan$/.test(str)) return NaN;
	if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(str)) return undefined;
	return Number(str);
}

if (typeof module !== "undefined") module.exports = { FORMATS, KIND_NOTES, fmtByName, decode, encode, exactDecimal, exactDelta, exactMid, valueString, rawMag, parseValue, fields, join, maxExp, maxMant, maxCode, maxFiniteCode, hasSign, signBit, nanCode };
