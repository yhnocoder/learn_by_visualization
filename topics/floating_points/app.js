/* UI for the ml_dtypes narrow-float explorer. Depends on fmt.js. */
(function () {
	var $ = function (id) { return document.getElementById(id); };
	var GROUPS = ["fp4", "fp6", "fp8", "fp16", "fp32"];
	var ROWS = [
		{ id: "sign", title: "Sign",                      cls: "float_sign" },
		{ id: "exp",  title: "Exponent",                  cls: "float_exponent" },
		{ id: "mant", title: "Significand",               cls: "float_mantissa" },
		{ id: "hex",  title: "Raw Hexadecimal Integer Value" },
		{ id: "dec",  title: "Raw Decimal Integer Value" },
	];
	var fmt, code, rows = {}, bitLabels = [];
	var mainField = $("float_value_field");

	/* ---------- tabs ---------- */
	function tabs(container, items, current, onPick) {
		container.innerHTML = "";
		items.forEach(function (it, i) {
			var b = document.createElement("span");
			b.className = "mode_button non_selectable" + (i === 0 ? " left_round" : "") + (i === items.length - 1 ? " right_round" : "") + (it === current ? " on" : "");
			b.textContent = it;
			b.onclick = function () { onPick(it); };
			container.appendChild(b);
		});
	}

	function setFormat(f, initialCode) {
		var prev = fmt ? decode(fmt, code) : null;
		fmt = f;
		if (initialCode !== undefined) code = initialCode;
		else if (!prev) code = encode(f, 3.5);
		else code = prev.cls === "nan" ? nanCode(f) : encode(f, prev.value);

		tabs($("mode_section"), GROUPS, f.group, function (g) {
			setFormat(FORMATS.filter(function (x) { return x.group === g; })[0]);
		});
		tabs($("sub_mode_section"), FORMATS.filter(function (x) { return x.group === f.group; }).map(function (x) { return x.name; }), f.name, function (n) { setFormat(fmtByName(n)); });

		var mx = decode(f, maxFiniteCode(f)), tiny = decode(f, join(f, 0, 1, 0)), sub = decode(f, 1);
		$("fmt_note").innerHTML =
			"<b>" + f.name + "</b> &middot; " + f.bits + " bits &middot; E" + f.e + "M" + f.m + " &middot; bias " + f.bias +
			" &middot; max " + mx.value + (f.kind === "e8m0" ? " (2<sup>127</sup>) &middot; min 2<sup>&minus;127</sup>" :
			" &middot; min normal " + tiny.value + " &middot; min subnormal " + sub.value) +
			"<br>" + KIND_NOTES[f.kind];

		buildBits();
		$("narrow_only").classList.toggle("hidden", fmt.bits > 8);   /* the 2^bits grid only */
		if (fmt.bits <= 8) buildGrid(); else $("grid").innerHTML = "";
		buildLine();
		rows.sign.wrap.classList.toggle("field_row_disabled", !hasSign(f));
		rows.mant.wrap.classList.toggle("field_row_disabled", f.m === 0);
		reload();
	}

	/* ---------- bit pattern ---------- */
	function buildBits() {
		var c = $("bits_container"); c.innerHTML = ""; bitLabels = [];
		var byte;
		for (var i = fmt.bits - 1; i >= 0; i--) {
			if ((i + 1) % 8 === 0 || i === fmt.bits - 1) { byte = document.createElement("div"); byte.className = "byte"; c.appendChild(byte); }
			var span = document.createElement("span"); span.className = "bit_container"; span.title = "Bit " + i;
			var lab = document.createElement("div"); lab.className = "bit_label monospace";
			var mark = document.createElement("div");
			mark.className = "bit_marker " + (hasSign(fmt) && i === fmt.bits - 1 ? "float_sign" : i >= fmt.m ? "float_exponent" : "float_mantissa");
			span.appendChild(lab); span.appendChild(mark); byte.appendChild(span);
			span.onmousedown = function (e) { e.preventDefault(); };
			span.onclick = (function (bit) { return function () { var b = pow2(bit); code += Math.floor(code / b) % 2 ? -b : b; reload(); }; })(i);
			bitLabels.push(lab);
		}
	}

	/* ---------- rows ---------- */
	function buildRows() {
		ROWS.forEach(function (r, i) {
			var col = $("column" + (i < 3 ? 0 : 1));
			var title = document.createElement("div"); title.className = "field_title"; title.textContent = r.title; col.appendChild(title);
			var wrap = document.createElement("div"); col.appendChild(wrap);
			var input = document.createElement("input"); input.className = "field monospace" + (r.cls ? " " + r.cls : ""); input.maxLength = 64; input.spellcheck = false;
			wrap.appendChild(input);
			var bc = document.createElement("div"); bc.className = "button_container"; wrap.appendChild(bc);
			var btns = {};
			["plus", "minus"].forEach(function (k) {
				var b = document.createElement("div"); b.className = "field_button non_selectable button_" + k;
				var s = document.createElement("div"); s.className = "sign_" + k; b.appendChild(s); bc.appendChild(b);
				b.onmousedown = function (e) { e.preventDefault(); };
				b.onclick = function () { setRow(r.id, rowValue(r.id) + (k === "plus" ? 1 : -1)); };
				btns[k] = b;
			});
			input.oninput = function () { input.classList.toggle("invalid_number", parseRow(r.id, input.value) === undefined); };
			input.onkeydown = function (e) {
				var v = parseRow(r.id, input.value);
				if (e.key === "Enter" && v !== undefined) setRow(r.id, v);
				else if (e.key === "ArrowUp" && v !== undefined) { e.preventDefault(); setRow(r.id, v + 1); }
				else if (e.key === "ArrowDown" && v !== undefined) { e.preventDefault(); setRow(r.id, v - 1); }
			};
			input.onblur = function () { var v = parseRow(r.id, input.value); if (v !== undefined) setRow(r.id, v); else reload(); };
			rows[r.id] = { input: input, btns: btns, wrap: wrap };
		});
	}

	function rowMax(id) {
		return { sign: hasSign(fmt) ? 1 : 0, exp: maxExp(fmt), mant: maxMant(fmt), hex: maxCode(fmt), dec: maxCode(fmt) }[id];
	}
	function rowValue(id) {
		var f = fields(fmt, code);
		return { sign: f.sign, exp: f.exp, mant: f.mant, hex: code, dec: code }[id];
	}
	function parseRow(id, s) {
		s = s.trim().toLowerCase();
		var v = id === "hex" ? (/^(0x)?[0-9a-f]+$/.test(s) ? parseInt(s, 16) : NaN) : (/^\d+$/.test(s) ? parseInt(s, 10) : NaN);
		return isNaN(v) || v > rowMax(id) ? undefined : v;
	}
	function setRow(id, v) {
		v = Math.max(0, Math.min(rowMax(id), v));
		var f = fields(fmt, code);
		if (id === "hex" || id === "dec") code = v;
		else { f[id] = v; code = join(fmt, f.sign, f.exp, f.mant); }
		reload();
	}

	/* ---------- number line ---------- */
	var lineGeom;
	function moveMarker() {
		if (!lineGeom) return;
		var sel = decode(fmt, code), g = lineGeom;
		var sx = sel.cls === "zero" ? 8 : sel.cls === "inf" ? g.xInf : sel.cls === "nan" ? g.xNaN : g.X(Math.abs(sel.value));
		g.marker.setAttribute("class", "dot sel cls_" + sel.cls);
		g.marker.setAttribute("cx", sx);
		g.marker.setAttribute("cy", sel.cls === "nan" ? g.yNaN : g.y);
	}
	function buildLine() {
		var svg = $("number_line"), NS = "http://www.w3.org/2000/svg";
		svg.innerHTML = "";
		var hasInf = fmt.kind === "ieee", hasZero = fmt.kind !== "e8m0", hasNaN = fmt.kind !== "mx";
		var W = svg.clientWidth || 800, H = 110, y = 50, x0 = 34, x1 = W - 12 - (hasInf ? 26 : 0) - (hasNaN ? 30 : 0);
		var xInf = x1 + 22, xNaN = W - 16, yNaN = y - 18;   /* NaN sits off the axis, top-right */
		svg.setAttribute("viewBox", "0 0 " + W + " " + H);
		var maxFin = maxFiniteCode(fmt), sb = hasSign(fmt) ? signBit(fmt) : 0;
		var lo = decode(fmt, hasZero ? 1 : 0).pow, hi = Math.floor(Math.log2(decode(fmt, maxFin).value)) + 1;
		/* subnormals and normals are binned separately so the (tiny) subnormal region keeps its own dots */
		var subEnd = fmt.kind === "e8m0" ? -1 : join(fmt, 0, 0, maxMant(fmt));
		var ranges = fmt.kind === "e8m0" ? [[0, maxFin, 90]] : [[1, subEnd, 24], [subEnd + 1, maxFin, 90]];
		var pers = ranges.map(function (r) { return fmt.bits > 8 ? Math.max(1, Math.ceil((r[1] - r[0] + 1) / r[2])) : 1; });
		var X = function (v) { return x0 + (Math.log2(v) - lo) / (hi - lo) * (x1 - x0); };
		var el = function (tag, attrs, text) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; svg.appendChild(e); return e; };
		var every = Math.ceil((hi - lo) / 16);
		for (var k = lo; k <= hi; k++) {
			var x = X(pow2(k));
			el("line", { x1: x, y1: y - 22, x2: x, y2: y + 22, class: "binade" });
			if ((k - lo) % every === 0) el("text", { x: x, y: y + 40, class: "tick" }, "2^" + k);
		}
		el("line", { x1: x0, y1: y, x2: x1, y2: y, class: "axis" });
		/* landmarks: subnormal/normal boundary 2^(1-bias) and 1 = 2^0 */
		var kMin = 1 - fmt.bias;
		if (fmt.kind !== "e8m0" && kMin > lo) {
			el("line", { x1: X(pow2(kMin)), y1: y - 30, x2: X(pow2(kMin)), y2: y + 22, class: "landmark" });
			var lx = X(pow2(kMin)), nearLeft = lx < x0 + 110;   /* keep clear of the axis name at the top-left */
			el("text", { x: lx + (nearLeft ? 5 : 0), y: y - 34, class: "tick landmark_label", style: nearLeft ? "text-anchor:start" : "" }, "min normal 2^" + kMin);
		}
		if (lo < 0 && hi > 0 && kMin !== 0) {   /* fp4/fp6 e2m3: min normal is 1, one label is enough */
			el("line", { x1: X(1), y1: y - 30, x2: X(1), y2: y + 22, class: "landmark one" });
			el("text", { x: X(1), y: y - 34, class: "tick" }, "1");
		}
		var binned = false, curSign = function () { return decode(fmt, code).sign * sb; };
		if (hasZero) {
			el("line", { x1: 8, y1: y, x2: x0 - 2, y2: y, class: "zero_gap" });
			el("text", { x: 8, y: y + 40, class: "tick" }, "0");
			el("circle", { cx: 8, cy: y, r: 3.5, class: "dot cls_zero" }).onclick = function () { code = curSign(); reload(); };
		}
		if (hasInf) {
			el("line", { x1: x1 + 2, y1: y, x2: xInf, y2: y, class: "zero_gap" });
			el("text", { x: xInf, y: y + 40, class: "tick" }, "∞");
			el("circle", { cx: xInf, cy: y, r: 3.5, class: "dot cls_inf" }).onclick = function () { code = join(fmt, 0, maxExp(fmt), 0) + curSign(); reload(); };
		}
		if (hasNaN) {
			el("text", { x: xNaN, y: yNaN - 10, class: "tick" }, "NaN");
			el("circle", { cx: xNaN, cy: yNaN, r: 3.5, class: "dot cls_nan" }).onclick = function () {
				code = fmt.kind === "fnuz" || fmt.kind === "e8m0" ? nanCode(fmt) : nanCode(fmt) + curSign(); reload();
			};
		}
		/* one dot per `per` consecutive values (value order == code order), placed at the first of them */
		ranges.forEach(function (r, i) {
			var per = pers[i];
			for (var c = r[0]; c <= r[1]; c += per) (function (c) {
				var d = decode(fmt, c);
				var dot = el("circle", { cx: X(d.value), cy: y, r: per > 1 ? 2.5 : 3.5, class: "dot cls_" + d.cls });
				var t = document.createElementNS(NS, "title"); t.textContent = "0x" + c.toString(16) + " = " + d.value + (per > 1 ? "  (+" + (per - 1) + " more)" : ""); dot.appendChild(t);
				dot.onclick = function () { code = c + curSign(); reload(); };
			})(c);
		});
		binned = pers.some(function (p) { return p > 1; });
		/* persistent selected marker: moved (with a CSS transition) by moveMarker() on every reload */
		var marker = el("circle", { cx: x0, cy: y, r: 5, class: "dot sel", "pointer-events": "none" });
		var win = el("rect", { x: x0, y: y - 4, width: 0, height: 8, rx: 4, class: "band" });   /* zoom window band on the axis, sized by buildZoom */
		svg.insertBefore(win, svg.firstChild);
		el("text", { x: 2, y: 14, class: "axis_name" }, "log₂ axis");
		lineGeom = { X: X, marker: marker, y: y, xInf: xInf, xNaN: xNaN, yNaN: yNaN, W: W, H: H, x0: x0, x1: x1, lo: lo, hi: hi, win: win };
		marker.style.transition = "none";   /* first placement: no slide-in */
		moveMarker();
		void marker.getBoundingClientRect();
		marker.style.transition = "";
		$("line_note").textContent = binned ? " — binned: each subnormal dot = " + pers[0].toLocaleString() + " values, each normal dot = " + pers[1].toLocaleString() + " values (drawn at the first one)" : "";
	}

	/* ---------- linear zoom (B): three binades around |value|, real (or evenly binned) points ---------- */
	var zoomGeom, zoomKey;
	function binadeStart(k) {   /* code of the positive value exactly 2^k */
		if (fmt.kind === "e8m0") return k + fmt.bias;
		return k >= 1 - fmt.bias ? join(fmt, 0, k + fmt.bias, 0) : pow2(k - (1 - fmt.bias - fmt.m));
	}
	function zoomWindow() {
		var d = decode(fmt, code), kMin = 1 - fmt.bias, maxFin = maxFiniteCode(fmt), kTop = Math.floor(Math.log2(decode(fmt, maxFin).value));
		var v = Math.abs(d.value), k;
		if (d.cls === "nan" || d.cls === "inf") k = kTop - 1;
		else if (fmt.kind !== "e8m0" && (v === 0 || v < pow2(kMin + 1))) k = kMin;   /* zero / subnormal / first normal binade: window starts at 0 */
		else k = Math.min(Math.floor(Math.log2(v)), kTop - 1);
		var lo = fmt.kind !== "e8m0" && k - 1 < kMin ? 0 : pow2(k - 1), hi = Math.min(pow2(k + 2), decode(fmt, maxFin).value * (1 + 1e-9));
		return { k: k, lo: lo, hi: hi, kMin: kMin, maxFin: maxFin, kTop: kTop };
	}
	function buildZoom() {
		var svg = $("zoom"), NS = "http://www.w3.org/2000/svg", w = zoomWindow();
		zoomKey = fmt.name + ":" + w.k;
		svg.innerHTML = "";
		var W = svg.clientWidth || 800, H = 100, y = 44, x0 = 40, x1 = W - 40;
		svg.setAttribute("viewBox", "0 0 " + W + " " + H);
		var el = function (tag, attrs, text) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; svg.appendChild(e); return e; };
		var X = function (v) { return x0 + (v - w.lo) / (w.hi - w.lo) * (x1 - x0); };
		var sb = hasSign(fmt) ? signBit(fmt) : 0, curSign = function () { return decode(fmt, code).sign * sb; };
		/* binade boundaries inside the window */
		for (var k = w.k - 1; k <= w.k + 2; k++) {
			var b = pow2(k);
			if (b < w.lo || b > w.hi) continue;
			el("line", { x1: X(b), y1: y - 22, x2: X(b), y2: y + 22, class: fmt.kind !== "e8m0" && k === w.kMin ? "landmark" : "binade" });
			el("text", { x: X(b), y: y + 36, class: "tick" + (fmt.kind !== "e8m0" && k === w.kMin ? " landmark_label" : "") }, "2^" + k + (fmt.kind !== "e8m0" && k === w.kMin ? " min normal" : ""));
		}
		if (w.lo === 0) el("text", { x: x0, y: y + 36, class: "tick" }, "0");
		if (w.hi < pow2(w.k + 2)) el("text", { x: x1, y: y + 36, class: "tick" }, "max");
		el("line", { x1: x0, y1: y, x2: x1, y2: y, class: "axis" });
		/* points: contiguous code range, evenly binned by code when too many */
		var c0 = w.lo === 0 ? (fmt.kind === "e8m0" ? 0 : 0) : binadeStart(w.k - 1);
		var c1 = w.hi < pow2(w.k + 2) ? w.maxFin : binadeStart(w.k + 2) - 1;
		var n = c1 - c0 + 1, per = Math.max(1, Math.ceil(n / 120));
		for (var c = c0; c <= c1; c += per) (function (c) {
			var d = decode(fmt, c);
			var dot = el("circle", { cx: X(d.value), cy: y, r: per > 1 ? 2.5 : 3.5, class: "dot cls_" + d.cls });
			var t = document.createElementNS(NS, "title"); t.textContent = "0x" + c.toString(16) + " = " + d.value + (per > 1 ? "  (+" + (per - 1) + " more)" : ""); dot.appendChild(t);
			dot.onclick = function () { code = c + curSign(); reload(); };
		})(c);
		var marker = el("circle", { cx: x0, cy: y, r: 5, class: "dot sel", "pointer-events": "none" });
		el("text", { x: 2, y: 14, class: "axis_name" }, "linear axis");
		zoomGeom = { X: X, marker: marker, lo: w.lo, hi: w.hi };
		/* magnifier links: window edges on the log axis → both ends of the linear axis, drawn on the overlay behind both charts */
		var lg = lineGeom, bx0 = w.lo === 0 ? 8 : lg.X(w.lo), bx1 = lg.X(w.hi);
		var ov = $("overlay"), wrap = $("line_wrap"), OH = wrap.clientHeight;
		var zt = svg.getBoundingClientRect().top - wrap.getBoundingClientRect().top;   /* SVG has no offsetTop */
		ov.innerHTML = "";
		ov.setAttribute("viewBox", "0 0 " + W + " " + OH);
		var oel = function (tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); ov.appendChild(e); return e; };
		oel("line", { x1: bx0, y1: lg.y + 4, x2: x0, y2: zt + y - 4, class: "link" });
		oel("line", { x1: bx1, y1: lg.y + 4, x2: x1, y2: zt + y - 4, class: "link" });
		var band = el("rect", { x: x0, y: y - 4, width: x1 - x0, height: 8, rx: 4, class: "band" });
		svg.insertBefore(band, svg.firstChild);
		el("text", { x: W - 2, y: 14, class: "note" }, "|value| ∈ [" + (w.lo === 0 ? "0" : "2^" + (w.k - 1)) + ", " + (w.hi < pow2(w.k + 2) ? "max" : "2^" + (w.k + 2)) + ")" + (per > 1 ? " · each dot = " + per.toLocaleString() + " values" : ""));
		lg.win.setAttribute("x", bx0); lg.win.setAttribute("width", Math.max(0, bx1 - bx0));
		marker.style.transition = "none";
		moveZoomMarker();
		void marker.getBoundingClientRect();
		marker.style.transition = "";
	}
	function moveZoomMarker() {
		var d = decode(fmt, code), g = zoomGeom, v = Math.abs(d.value);
		if (d.cls === "nan" || d.cls === "inf" || v < g.lo || v > g.hi) { g.marker.setAttribute("class", "dot sel hidden_marker"); return; }
		g.marker.setAttribute("class", "dot sel cls_" + d.cls);
		g.marker.setAttribute("cx", g.X(v));
	}
	function updateZoom() {
		if (fmt.name + ":" + zoomWindow().k !== zoomKey) buildZoom(); else moveZoomMarker();
	}

	/* ---------- grid ---------- */
	function shortVal(d) {
		if (d.cls === "nan") return "NaN";
		if (d.cls === "inf") return d.sign ? "−∞" : "∞";
		if (fmt.kind === "e8m0") return "2^" + d.pow;
		if (d.cls === "zero") return d.sign ? "−0" : "0";
		var s = String(d.value), a = Math.abs(d.value);
		if (s.length <= 7) return s;
		return a < 1e-3 || a >= 1e7 ? d.value.toExponential(1).replace("e-0", "e-").replace("e+", "e") : String(Number(d.value.toPrecision(3)));
	}
	function buildGrid() {
		var g = $("grid"); g.innerHTML = "";
		var n = 1 << fmt.bits, cols = 16;
		var lab = function (t) { var e = document.createElement("div"); e.className = "collab"; e.textContent = t; g.appendChild(e); };
		lab("");
		for (var j = 0; j < cols; j++) lab("_" + j.toString(16));
		for (var c = 0; c < n; c++) {
			if (c % cols === 0) { var r = document.createElement("div"); r.className = "rowlab"; r.textContent = (c >> 4).toString(16) + "_"; g.appendChild(r); }
			var d = decode(fmt, c);
			var cell = document.createElement("div"); cell.className = "cell cls_" + d.cls; cell.dataset.code = c;
			cell.innerHTML = "<div class='hex'>0x" + c.toString(16).padStart(2, "0") + "</div><div class='val'>" + shortVal(d) + "</div>";
			cell.title = "0x" + c.toString(16) + " = " + d.value;
			cell.onclick = (function (cc) { return function () { code = cc; reload(); }; })(c);
			g.appendChild(cell);
		}
	}

	/* ---------- render ---------- */
	function pop(e) { e.classList.remove("pop"); void e.offsetWidth; e.classList.add("pop"); }   /* restart the CSS animation */
	function pad(n, w) { return n.toString(2).padStart(w, "0"); }
	function mantFrac(d) { return d.value === 0 && fmt.m ? "0" : exactDecimal(d.sig % pow2(fmt.m), -fmt.m).replace(/^0\.?/, "") || "0"; }

	function reload() {
		var d = decode(fmt, code), special = d.cls === "nan" || d.cls === "inf";
		var vs = valueString(fmt, code);
		if (mainField.value !== vs) { mainField.value = vs; pop(mainField); }
		mainField.classList.remove("invalid_number");
		mainField.style.fontSize = Math.max(18, Math.min(50, Math.floor(600 / Math.max(1, mainField.value.length)))) + "px";

		for (var i = 0; i < fmt.bits; i++) {
			var b = String(Math.floor(code / pow2(fmt.bits - 1 - i)) % 2);
			if (bitLabels[i].textContent !== b) { bitLabels[i].textContent = b; pop(bitLabels[i]); }
		}
		$("cls_badge").textContent = { zero: "zero", sub: "subnormal", normal: "normal", inf: "infinity", nan: "NaN" }[d.cls];

		ROWS.forEach(function (r) {
			var v = rowValue(r.id), row = rows[r.id];
			row.input.value = r.id === "hex" ? "0x" + v.toString(16) : String(v);
			row.input.classList.remove("invalid_number");
			row.btns.plus.classList.toggle("inactive_buton", v >= rowMax(r.id));
			row.btns.minus.classList.toggle("inactive_buton", v <= 0);
		});

		var implicit = d.cls === "normal" ? 1 : 0;
		var unbiased = fmt.kind === "e8m0" ? d.pow : (d.cls === "normal" ? d.exp - fmt.bias : 1 - fmt.bias);
		var e2 = fmt.kind === "e8m0"
			? "10<sub>2</sub><sup>(<span class='float_exponent'>" + pad(d.exp, fmt.e) + "</span><sub>2</sub> &minus; " + pad(fmt.bias, fmt.e) + "<sub>2</sub>)</sup>"
			: "(&minus;1<sub>2</sub>)<sup><span class='float_sign'>" + d.sign + "</span><sub>2</sub></sup><span class='times'>&times;</span>" +
			  "10<sub>2</sub><sup>(<span class='float_exponent'>" + pad(d.cls === "normal" ? d.exp : 1, fmt.e) + "</span><sub>2</sub> &minus; " + pad(fmt.bias, fmt.e) + "<sub>2</sub>)</sup>" +
			  "<span class='times'>&times;</span>" + implicit + "." + "<span class='float_mantissa'>" + pad(d.mant, fmt.m) + "</span><sub>2</sub>";
		$("eval2").innerHTML = e2;
		$("eval10").innerHTML = fmt.kind === "e8m0"
			? "2<sup>" + unbiased + "</sup>"
			: (d.sign ? "-1" : "1") + "<span class='times'>&times;</span>2<sup>" + unbiased + "</sup><span class='times'>&times;</span>" + implicit + "." + mantFrac(d);
		$("eval2").style.opacity = $("eval10").style.opacity = special ? 0.2 : 1;
		$("exact_10").textContent = special ? (d.cls === "nan" ? "NaN" : d.sign ? "−∞" : "∞") : (d.sign ? "−" : "") + exactDecimal(d.sig, d.pow);

		/* neighbours by value: next = toward +∞, prev = toward −∞ (codes carry the sign bit) */
		var sb = hasSign(fmt) ? signBit(fmt) : 0, mag = sb ? code % sb : code;
		function fin(c) { if (c === null || c > maxCode(fmt)) return null; var x = decode(fmt, c); return x.cls === "nan" || x.cls === "inf" ? null : x; }
		var up, dn;
		if (!d.sign) { up = fin(mag + 1); dn = fin(mag > 0 ? mag - 1 : sb ? sb + 1 : null); }
		else { up = fin(mag > 1 ? sb + mag - 1 : mag === 1 ? 0 : 1); dn = fin(sb + mag + 1); }
		var dNext = up && !special ? exactDelta(up, d) : null, dPrev = dn && !special ? exactDelta(dn, d) : null;
		var same = dNext !== null && dPrev !== null && dNext.dec === dPrev.dec;
		var fmtDelta = function (x) { return x === null ? "—" : x.pow2.replace(/2\^(-?\d+)/, "2<sup>$1</sup>") + " <span class='delta_dec'>(" + x.dec + ")</span>"; };
		$("delta_pm").classList.toggle("hidden", !same);
		$("delta_n").classList.toggle("hidden", same);
		$("delta_p").classList.toggle("hidden", same);
		$("delta_pm_v").innerHTML = "±" + fmtDelta(dNext);
		$("delta_n_v").innerHTML = fmtDelta(dNext);
		$("delta_p_v").innerHTML = fmtDelta(dPrev);

		/* inputs that round to this code: midpoints to the neighbours; a missing neighbour is the virtual "one past max" code (overflow threshold).
		   RNE: a tie goes to the even mantissa, so even sig ⇒ closed ends. mx saturates ⇒ open to ∞. e8m0 rounds on the fraction, not midpoints ⇒ skip. */
		var showIv = !special && fmt.kind !== "e8m0";
		$("interval").classList.toggle("hidden", !showIv);
		if (showIv) {
			var virt = function (c, sign) { var m = rawMag(fmt, c); return { sign: sign, sig: m.sig, pow: m.pow }; };
			var even = d.sig % 2 === 0, mx = fmt.kind === "mx";
			var inf = { dec: "∞", pow2: "∞" }, ninf = { dec: "−∞", pow2: "−∞" };
			var lo = mx && !dn ? ninf : exactMid(dn || virt(mag + 1, 1), d), hi = mx && !up ? inf : exactMid(d, up || virt(mag + 1, 0));
			var open = even && !(mx && !dn) ? "[" : "(", close = even && !(mx && !up) ? "]" : ")";
			var sup = function (x) { return x.replace("-", "−").replace(/2\^(-?\d+)/, "2<sup>$1</sup>"); };
			$("interval_v").innerHTML = open + sup(lo.pow2) + ", " + sup(hi.pow2) + close +
				" <span class='delta_dec'>" + open + sup(lo.dec) + ", " + sup(hi.dec) + close + "</span>";
		}

		var cells = $("grid").children;
		for (var k = 0; k < cells.length; k++) cells[k].classList.toggle("sel", cells[k].dataset.code == code);
		moveMarker();
		updateZoom();
		history.replaceState(null, "", "#" + fmt.name + ":0x" + code.toString(16).padStart(fmt.bits / 4, "0"));
	}

	/* ---------- main field ---------- */
	mainField.oninput = function () { mainField.classList.toggle("invalid_number", parseValue(mainField.value) === undefined); };
	function commitMain() { var v = parseValue(mainField.value); if (v !== undefined) code = encode(fmt, v); reload(); }
	mainField.onkeydown = function (e) { if (e.key === "Enter") commitMain(); };
	mainField.onblur = commitMain;
	window.addEventListener("resize", function () { buildLine(); buildZoom(); });

	buildRows();
	/* deep link: #float8_e5m2:0x7b */
	var h = /^#(\w+)(?::0x([0-9a-f]+))?$/i.exec(location.hash), f0 = h && fmtByName(h[1]);
	setFormat(f0 || fmtByName("float8_e4m3fn"), f0 && h[2] ? Math.min(maxCode(f0), parseInt(h[2], 16)) : undefined);
	mainField.focus();
})();
