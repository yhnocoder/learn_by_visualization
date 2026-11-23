/* UI for the ml_dtypes narrow-float explorer. Depends on fmt.js and MathJax (tex-svg). */
(function () {
	var $ = function (id) { return document.getElementById(id); };
	var NS = "http://www.w3.org/2000/svg";
	var GROUPS = ["fp4", "fp6", "fp8", "fp16", "fp32"];
	var C_SIGN = "#e83e5d", C_EXP = "#41ba63", C_MANT = "#577ec7";
	var fmt, code, bitLabels = [];
	var mainField = $("float_value_field");

	function mk(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
	function svgEl(svg, tag, attrs, text) {
		var e = document.createElementNS(NS, tag);
		for (var k in attrs) e.setAttribute(k, attrs[k]);
		if (text != null) e.textContent = text;
		svg.appendChild(e);
		return e;
	}

	/* ---------- TeX (MathJax SVG output) ---------- */
	/* The vendored MathJax bundle has only the base and ams packages (no color extension),
	   so colored numbers are written as \\mmlToken{mn}[mathcolor="..."]{...}; see col(). */
	function mj(t, display) { return MathJax.tex2svg(t, { display: !!display }); }
	var texCache = {};
	function texSvg(t) {
		if (!texCache[t]) texCache[t] = mj(t).querySelector("svg");
		return texCache[t].cloneNode(true);
	}
	/* Place TeX inside an SVG chart. fs: font size in px; y: baseline; align: start | middle | end. */
	function texAt(svg, t, x, y, align, fs, color) {
		var node = texSvg(t), ex = fs * 0.45;
		var w = parseFloat(node.getAttribute("width")) * ex, h = parseFloat(node.getAttribute("height")) * ex;
		var m = /vertical-align:\s*(-?[\d.]+)ex/.exec(node.getAttribute("style") || ""), shift = m ? parseFloat(m[1]) * ex : 0;
		node.setAttribute("width", w); node.setAttribute("height", h);
		node.setAttribute("x", align === "middle" ? x - w / 2 : align === "end" ? x - w : x);
		node.setAttribute("y", y - h - shift);
		node.removeAttribute("style");
		node.style.color = color || "#888";
		node.style.overflow = "visible";
		svg.appendChild(node);
		return node;
	}
	/* Replace the content of an HTML element with one TeX formula. */
	function texInto(el, t, display) {
		el.innerHTML = "";
		el.appendChild(mj(t, display));
	}
	/* HTML text with $...$ TeX segments. */
	function rich(el, s) {
		el.innerHTML = "";
		s.split("$").forEach(function (seg, i) {
			if (!seg) return;
			if (i % 2) el.appendChild(mj(seg));
			else el.appendChild(document.createTextNode(seg));
		});
	}
	/* bigForm pow2 strings ("23×2^-6", "−2^-5") and decimal strings → TeX */
	function tx(s) { return s.replace(/−/g, "-").replace(/×/g, "\\times ").replace(/2\^(-?\d+)/g, "2^{$1}"); }

	/* ---------- format tabs ---------- */
	/* Top row: a track with one white thumb that slides to the selected group. Built once, then only updated. */
	var groupBtns = {}, groupThumb;
	function moveThumb(thumb, target, animate) {
		if (!animate) thumb.style.transition = "none";
		thumb.style.width = target.offsetWidth + "px";
		thumb.style.transform = "translateX(" + target.offsetLeft + "px)";
		if (!animate) { void thumb.offsetWidth; thumb.style.transition = ""; }
	}
	function updateGroups(f) {
		var row = $("mode_section"), first = !groupThumb;
		if (first) {
			groupThumb = mk("span", "seg_thumb", row);
			GROUPS.forEach(function (g) {
				var b = mk("span", "seg_button non_selectable", row);
				b.textContent = g;
				b.onclick = function () { if (g !== fmt.group) setFormat(lastInGroup[g] || FORMATS.filter(function (x) { return x.group === g; })[0]); };
				groupBtns[g] = b;
			});
		}
		GROUPS.forEach(function (g) { groupBtns[g].classList.toggle("on", g === f.group); });
		moveThumb(groupThumb, groupBtns[f.group], !first);
	}

	/* Second row: the formats of the group, grouped by exponent/mantissa width (e4m3, e5m2, ...).
	   The selected family is outlined and lists its variants; the variant label is the name suffix after "eXmY".
	   The row keeps its DOM while the group stays the same, so opening and closing a family can use a width transition. */
	var lastInGroup = {}, lastInFamily = {}, famRow = { group: null, fams: {} }, famScrollTimer;
	function family(f) { return "e" + f.e + "m" + f.m; }
	function variantLabel(f) {
		var i = f.name.indexOf(family(f)), suffix = i < 0 ? "" : f.name.slice(i + family(f).length);
		return suffix || "标准";
	}
	function buildFamilies(f) {
		var row = $("sub_mode_section");
		if (famRow.group !== f.group) {
			row.innerHTML = "";
			famRow = { group: f.group, fams: {} };
			var track = mk("div", "fam_track", row), keys = [], byFam = {};
			FORMATS.forEach(function (x) {
				if (x.group !== f.group) return;
				var k = family(x);
				if (!byFam[k]) { byFam[k] = []; keys.push(k); }
				byFam[k].push(x);
			});
			keys.forEach(function (k) {
				var list = byFam[k], box = mk("span", "fam", track);
				var lab = mk("span", "fam_button fam_label non_selectable", box);
				lab.textContent = k;
				lab.onclick = function () { if (family(fmt) !== k) setFormat(lastInFamily[famRow.group + ":" + k] || list[0]); };
				var vars = null, btns = [];
				if (list.length > 1) {
					vars = mk("span", "fam_vars", box);
					list.forEach(function (x) {
						var b = mk("span", "fam_button non_selectable", vars);
						b.textContent = variantLabel(x);
						b.onclick = function () { if (fmt !== x) setFormat(x); };
						btns.push({ f: x, el: b });
					});
				}
				famRow.fams[k] = { box: box, lab: lab, vars: vars, btns: btns };
			});
			famRow.track = track;
		}
		var opened = null;
		for (var k in famRow.fams) {
			var e = famRow.fams[k], on = k === family(f);
			e.box.classList.toggle("open", on);
			e.lab.classList.toggle("on", on && !e.vars);
			e.lab.classList.toggle("current", on && !!e.vars);
			if (e.vars) {
				e.vars.style.maxWidth = on ? e.vars.scrollWidth + "px" : "0px";
				e.btns.forEach(function (b) { b.el.classList.toggle("on", b.f === f); });
			}
			if (on) opened = e.box;
		}
		/* narrow screens: the row scrolls horizontally; once the width transition ends, bring the opened family to the left edge */
		clearTimeout(famScrollTimer);
		famScrollTimer = setTimeout(function () {
			if (row.scrollWidth > row.clientWidth + 1) row.scrollTo({ left: famRow.track.offsetLeft + opened.offsetLeft - 8, behavior: "smooth" });
		}, 170);
	}

	/* One line under the dtype name: how a variant differs from the standard (IEEE-style) format of its family.
	   Standard variants, e3m4, float16, bfloat16 and float32 get no line. */
	/* Each note is a list of tags; the one starting with "!" is the key trait and is emphasized. */
	var FMT_NOTES = {
		float8_e4m3fn:      ["no inf", "2 NaN", "!larger max"],
		float8_e4m3fnuz:    ["no inf", "no −0", "1 NaN", "!finer near 0"],
		float8_e4m3b11fnuz: ["no inf", "no −0", "1 NaN", "!finest near 0", "!max 30"],
		float8_e5m2fnuz:    ["no inf", "no −0", "1 NaN", "!finer near 0"],
		float8_e8m0fnu:     ["!powers of two only", "no zero", "no sign"],
		float4_e2m1fn:      ["no inf", "no NaN", "!overflow → max"],
		float6_e2m3fn:      ["no inf", "no NaN", "!overflow → max"],
		float6_e3m2fn:      ["no inf", "no NaN", "!overflow → max"],
	};

	function setFormat(f, initialCode) {
		var prev = fmt ? decode(fmt, code) : null;
		fmt = f;
		lastInGroup[f.group] = f;
		lastInFamily[f.group + ":" + family(f)] = f;
		if (initialCode !== undefined) code = initialCode;
		else if (!prev) code = encode(f, 3.5);
		else code = prev.cls === "nan" ? nanCode(f) : encode(f, prev.value);

		updateGroups(f);
		buildFamilies(f);
		$("fmt_name").textContent = f.name;
		var note = $("fmt_note"); note.innerHTML = "";
		(FMT_NOTES[f.name] || []).forEach(function (t) {
			var key = t[0] === "!";
			mk("span", "fmt_tag" + (key ? " key" : ""), note).textContent = key ? t.slice(1) : t;
		});

		buildBits();
		$("narrow_only").classList.toggle("hidden", fmt.bits > 8);   /* the 2^bits grid only */
		if (fmt.bits <= 8) buildGrid(); else $("grid").innerHTML = "";
		buildLine();
		zoomKey = null;
		reload();
	}

	/* ---------- bit pattern ---------- */
	function buildBits() {
		var c = $("bits_container"); c.innerHTML = ""; bitLabels = [];
		var byte;
		for (var i = fmt.bits - 1; i >= 0; i--) {
			if ((i + 1) % 8 === 0 || i === fmt.bits - 1) byte = mk("div", "byte", c);
			var span = mk("span", "bit_container", byte); span.title = "Bit " + i;
			var lab = mk("div", "bit_label monospace", span);
			mk("div", "bit_marker " + (hasSign(fmt) && i === fmt.bits - 1 ? "float_sign" : i >= fmt.m ? "float_exponent" : "float_mantissa"), span);
			span.onmousedown = function (e) { e.preventDefault(); };
			span.onclick = (function (bit) { return function () { var b = pow2(bit); code += Math.floor(code / b) % 2 ? -b : b; reload(); }; })(i);
			bitLabels.push(lab);
		}
	}

	/* ---------- raw code fields (hex / dec) ---------- */
	var CODE_FIELDS = [
		{ input: $("hex_field"), parse: function (s) { return /^(0x)?[0-9a-f]+$/.test(s) ? parseInt(s.replace(/^0x/, ""), 16) : NaN; }, show: function (c) { return "0x" + c.toString(16).padStart(Math.ceil(fmt.bits / 4), "0"); } },
		{ input: $("dec_field"), parse: function (s) { return /^\d+$/.test(s) ? parseInt(s, 10) : NaN; }, show: function (c) { return String(c); } },
	];
	function sizeField(input) { input.style.width = Math.max(2, input.value.length) + 0.6 + "ch"; }
	CODE_FIELDS.forEach(function (cf) {
		var input = cf.input;
		var parse = function () { var v = cf.parse(input.value.trim().toLowerCase()); return isNaN(v) || v > maxCode(fmt) ? undefined : v; };
		var set = function (v) { code = Math.max(0, Math.min(maxCode(fmt), v)); reload(); };
		input.oninput = function () { sizeField(input); input.classList.toggle("invalid_number", parse() === undefined); };
		input.onkeydown = function (e) {
			var v = parse();
			if (e.key === "Enter" && v !== undefined) { set(v); input.select(); }
			else if (e.key === "ArrowUp" && v !== undefined) { e.preventDefault(); set(v + 1); }
			else if (e.key === "ArrowDown" && v !== undefined) { e.preventDefault(); set(v - 1); }
		};
		input.onblur = function () { var v = parse(); if (v !== undefined) set(v); else reload(); };
	});

	/* ---------- number line (log₂ axis) ---------- */
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
		var svg = $("number_line");
		svg.innerHTML = "";
		var el = function (tag, attrs, text) { return svgEl(svg, tag, attrs, text); };
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
		var every = Math.ceil((hi - lo) / 16);
		for (var k = lo; k <= hi; k++) {
			var x = X(pow2(k));
			el("line", { x1: x, y1: y - 22, x2: x, y2: y + 22, class: "binade" });
			if ((k - lo) % every === 0) texAt(svg, "2^{" + k + "}", x, y + 42, "middle", 13);
		}
		el("line", { x1: x0, y1: y, x2: x1, y2: y, class: "axis" });
		/* landmarks: subnormal/normal boundary 2^(1-bias) and 1 = 2^0 */
		var kMin = 1 - fmt.bias;
		if (fmt.kind !== "e8m0" && kMin > lo) {
			var lx = X(pow2(kMin)), nearLeft = lx < x0 + 110;   /* keep clear of the axis name at the top-left */
			el("line", { x1: lx, y1: y - 30, x2: lx, y2: y + 22, class: "landmark" });
			texAt(svg, "\\text{min normal } 2^{" + kMin + "}", lx + (nearLeft ? 5 : 0), y - 35, nearLeft ? "start" : "middle", 13, C_EXP);
		}
		var minLabelEnd = fmt.kind !== "e8m0" && kMin > lo ? X(pow2(kMin)) + (X(pow2(kMin)) < x0 + 110 ? 120 : 60) : -Infinity;
		if (lo < 0 && hi > 0 && kMin !== 0 && X(1) - 10 > minLabelEnd) {   /* fp4/fp6 e2m3: min normal is 1, one label is enough; skip "1" when it would collide */
			el("line", { x1: X(1), y1: y - 30, x2: X(1), y2: y + 22, class: "landmark one" });
			texAt(svg, "1", X(1), y - 35, "middle", 13);
		}
		var curSign = function () { return decode(fmt, code).sign * sb; };
		if (hasZero) {
			el("line", { x1: 8, y1: y, x2: x0 - 2, y2: y, class: "zero_gap" });
			texAt(svg, "0", 8, y + 42, "middle", 13);
			el("circle", { cx: 8, cy: y, r: 3.5, class: "dot cls_zero" }).onclick = function () { code = curSign(); reload(); };
		}
		if (hasInf) {
			el("line", { x1: x1 + 2, y1: y, x2: xInf, y2: y, class: "zero_gap" });
			texAt(svg, "\\infty", xInf, y + 42, "middle", 13);
			el("circle", { cx: xInf, cy: y, r: 3.5, class: "dot cls_inf" }).onclick = function () { code = join(fmt, 0, maxExp(fmt), 0) + curSign(); reload(); };
		}
		if (hasNaN) {
			texAt(svg, "\\text{NaN}", xNaN, yNaN - 9, "middle", 13);
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
				svgEl(dot, "title", {}, "0x" + c.toString(16) + " = " + d.value + (per > 1 ? "  (+" + (per - 1) + " more)" : ""));
				dot.onclick = function () { code = c + curSign(); reload(); };
			})(c);
		});
		var binned = pers.some(function (p) { return p > 1; });
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
		$("line_note").textContent = binned ? "The log₂ axis is binned: each subnormal dot stands for " + pers[0].toLocaleString() + " values, each normal dot for " + pers[1].toLocaleString() + " values (drawn at the first one)." : "";
	}

	/* ---------- linear zoom: three binades around |value|, real (or evenly binned) points ---------- */
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
		var svg = $("zoom"), w = zoomWindow();
		zoomKey = fmt.name + ":" + w.k;
		svg.innerHTML = "";
		var el = function (tag, attrs, text) { return svgEl(svg, tag, attrs, text); };
		var W = svg.clientWidth || 800, H = 100, y = 44, x0 = 40, x1 = W - 40;
		svg.setAttribute("viewBox", "0 0 " + W + " " + H);
		var X = function (v) { return x0 + (v - w.lo) / (w.hi - w.lo) * (x1 - x0); };
		var sb = hasSign(fmt) ? signBit(fmt) : 0, curSign = function () { return decode(fmt, code).sign * sb; };
		/* binade boundaries inside the window */
		for (var k = w.k - 1; k <= w.k + 2; k++) {
			var b = pow2(k), isMin = fmt.kind !== "e8m0" && k === w.kMin;
			if (b < w.lo || b > w.hi) continue;
			el("line", { x1: X(b), y1: y - 22, x2: X(b), y2: y + 22, class: isMin ? "landmark" : "binade" });
			texAt(svg, "2^{" + k + "}", X(b), y + 40, "middle", 13, isMin ? C_EXP : null);
			if (isMin) texAt(svg, "\\text{min normal}", X(b) + 5, y - 26, "start", 13, C_EXP);
		}
		if (w.lo === 0) texAt(svg, "0", x0, y + 40, "middle", 13);
		if (w.hi < pow2(w.k + 2)) texAt(svg, "\\text{max}", x1, y + 40, "middle", 13);
		el("line", { x1: x0, y1: y, x2: x1, y2: y, class: "axis" });
		/* points: contiguous code range, evenly binned by code when too many */
		var c0 = w.lo === 0 ? 0 : binadeStart(w.k - 1);
		var c1 = w.hi < pow2(w.k + 2) ? w.maxFin : binadeStart(w.k + 2) - 1;
		var n = c1 - c0 + 1, per = Math.max(1, Math.ceil(n / 120));
		for (var c = c0; c <= c1; c += per) (function (c) {
			var d = decode(fmt, c);
			var dot = el("circle", { cx: X(d.value), cy: y, r: per > 1 ? 2.5 : 3.5, class: "dot cls_" + d.cls });
			svgEl(dot, "title", {}, "0x" + c.toString(16) + " = " + d.value + (per > 1 ? "  (+" + (per - 1) + " more)" : ""));
			dot.onclick = function () { code = c + curSign(); reload(); };
		})(c);
		var marker = el("circle", { cx: x0, cy: y, r: 5, class: "dot sel", "pointer-events": "none" });
		el("text", { x: 2, y: 14, class: "axis_name" }, "linear axis");
		zoomGeom = { X: X, marker: marker, lo: w.lo, hi: w.hi, y: y };
		/* magnifier links: window edges on the log axis → both ends of the linear axis, drawn on the overlay behind both charts */
		var lg = lineGeom, bx0 = w.lo === 0 ? 8 : lg.X(w.lo), bx1 = lg.X(w.hi);
		var ov = $("overlay"), wrap = $("line_wrap"), OH = wrap.clientHeight;
		var zt = svg.getBoundingClientRect().top - wrap.getBoundingClientRect().top;   /* SVG has no offsetTop */
		ov.innerHTML = "";
		ov.setAttribute("viewBox", "0 0 " + W + " " + OH);
		svgEl(ov, "line", { x1: bx0, y1: lg.y + 4, x2: x0, y2: zt + y - 4, class: "link" });
		svgEl(ov, "line", { x1: bx1, y1: lg.y + 4, x2: x1, y2: zt + y - 4, class: "link" });
		var band = el("rect", { x: x0, y: y - 4, width: x1 - x0, height: 8, rx: 4, class: "band" });
		svg.insertBefore(band, svg.firstChild);
		var range = "|x| \\in [" + (w.lo === 0 ? "0" : "2^{" + (w.k - 1) + "}") + ",\\ " + (w.hi < pow2(w.k + 2) ? "\\text{max}" : "2^{" + (w.k + 2) + "}") + (w.hi < pow2(w.k + 2) ? "]" : ")");
		texAt(svg, range + (per > 1 ? "\\quad\\text{each dot} = " + per.toLocaleString().replace(/,/g, "{,}") + "\\text{ values}" : ""), W - 2, 16, "end", 12);
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
		var lab = function (t) { mk("div", "collab", g).textContent = t; };
		lab("");
		for (var j = 0; j < cols; j++) lab("_" + j.toString(16));
		for (var c = 0; c < n; c++) {
			if (c % cols === 0) mk("div", "rowlab", g).textContent = (c >> 4).toString(16) + "_";
			var d = decode(fmt, c);
			var cell = mk("div", "cell cls_" + d.cls, g); cell.dataset.code = c;
			cell.innerHTML = "<div class='hex'>0x" + c.toString(16).padStart(2, "0") + "</div><div class='val'>" + shortVal(d) + "</div>";
			cell.title = "0x" + c.toString(16) + " = " + d.value;
			cell.onclick = (function (cc) { return function () { code = cc; reload(); }; })(c);
		}
	}

	/* ---------- evaluation ---------- */
	function pad(n, w) { return n.toString(2).padStart(w, "0"); }
	function mantFrac(d) { return d.value === 0 && fmt.m ? "0" : exactDecimal(d.sig % pow2(fmt.m), -fmt.m).replace(/^0\.?/, "") || "0"; }
	function col(c, t) { return "\\mmlToken{mn}[mathcolor=\"" + c + "\"]{" + t + "}"; }
	/* Evaluation as a grid: one column per field, base 2 above base 10, so each factor sits over its decoded value. */
	function renderEval(d) {
		var special = d.cls === "nan" || d.cls === "inf", g = $("eval");
		var cols, rows;
		if (fmt.kind === "e8m0") {
			cols = [["exponent", C_EXP]];
			rows = [
				["base 2",  ["2^{" + col(C_EXP, pad(d.exp, fmt.e)) + "_2 - " + pad(fmt.bias, fmt.e) + "_2}"]],
				["base 10", ["2^{" + col(C_EXP, d.exp) + " - " + fmt.bias + "}"]],
			];
		} else {
			var normal = d.cls === "normal" || (special && d.exp > 0), lead = normal ? "1" : "0";
			var frac = mantFrac(d), m10 = frac === "0" ? lead : lead + "." + frac;
			cols = [["sign", C_SIGN], ["exponent", C_EXP], ["mantissa", C_MANT]];
			rows = [
				["base 2", [
					"(-1)^{" + col(C_SIGN, d.sign) + "}",
					"2^{" + (normal ? col(C_EXP, pad(d.exp, fmt.e)) + "_2" : "1") + " - " + pad(fmt.bias, fmt.e) + "_2}",
					lead + "." + col(C_MANT, pad(d.mant, fmt.m)) + "_2"]],
				["base 10", [
					d.sign ? "-1" : "+1",
					"2^{" + (normal ? col(C_EXP, d.exp) : "1") + " - " + fmt.bias + "}",
					col(C_MANT, m10)]],
			];
		}
		g.innerHTML = "";
		g.style.gridTemplateColumns = "auto" + cols.map(function (c, i) { return (i ? " auto" : "") + " auto"; }).join("");
		var cell = function (cls) { return mk("div", cls, g); };
		cell("eg_lab");
		cols.forEach(function (c, i) {
			if (i) cell("eg_op");
			var h = cell("eg_head"); h.textContent = c[0]; h.style.color = c[1];
		});
		rows.forEach(function (r) {
			cell("eg_lab").textContent = r[0];
			r[1].forEach(function (t, i) {
				if (i) texInto(cell("eg_op eg_math"), "\\times");
				texInto(cell("eg_math"), t);
			});
		});
		g.classList.toggle("eg_special", special);
	}

	/* ---------- neighbours, gaps and round-trip interval ---------- */
	/* Exact signed values as {n: BigInt, p}: value = n × 2^p. */
	function raw(d) { var n = BigInt(d.sig); return { n: d.sign ? -n : n, p: d.pow }; }
	function rAlign(a, b) { var p = Math.min(a.p, b.p); return { A: a.n << BigInt(a.p - p), B: b.n << BigInt(b.p - p), p: p }; }
	function rMid(a, b) { var r = rAlign(a, b); return { n: r.A + r.B, p: r.p - 1 }; }
	function rSub(a, b) { var r = rAlign(a, b); return { n: r.A - r.B, p: r.p }; }
	function rAbs(x) { return { n: x.n < 0n ? -x.n : x.n, p: x.p }; }
	function rNum(x) { return Number(x.n) * pow2(x.p); }
	function rFmt(x) {
		if (x.n === 0n) return { dec: "0", pow2: "0" };
		var neg = x.n < 0n, o = bigForm(neg ? -x.n : x.n, x.p);
		o.pow2 = o.pow2.replace(/^(\d+)×2\^0$/, "$1");
		if (neg) { o.dec = "−" + o.dec; o.pow2 = "−" + o.pow2; }
		return o;
	}
	function tP(x) { return tx(rFmt(x).pow2); }   /* exact value as TeX, power-of-two form */
	function tD(x) { return tx(rFmt(x).dec); }    /* exact value as TeX, decimal form */

	/* Neighbours by value: next = toward +∞, prev = toward −∞ (codes carry the sign bit). */
	function neighbours(d) {
		var sb = hasSign(fmt) ? signBit(fmt) : 0, mag = sb ? code % sb : code;
		function fin(c) { if (c === null || c > maxCode(fmt)) return null; var x = decode(fmt, c); return x.cls === "nan" || x.cls === "inf" ? null : x; }
		var up, dn;
		if (!d.sign) { up = fin(mag + 1); dn = fin(mag > 0 ? mag - 1 : sb ? sb + 1 : null); }
		else { up = fin(mag > 1 ? sb + mag - 1 : mag === 1 ? 0 : 1); dn = fin(sb + mag + 1); }
		return { up: up, dn: dn, mag: mag };
	}

	/* Inputs that round to this code: the midpoints to both neighbours.
	   - A missing neighbour past max is the virtual "one past max" code (the overflow threshold); mx saturates instead ⇒ unbounded.
	   - Round half to even: a tie goes to the even mantissa ⇒ even sig gives closed ends.
	   - Signed zero: +0 only takes inputs ≥ 0 and −0 only inputs ≤ −0 (fnuz has a single zero, which takes both sides). */
	var curIv = null;
	function roundInterval(d, nb) {
		var mx = fmt.kind === "mx";
		var virt = function (sign) { var m = rawMag(fmt, nb.mag + 1); return { sign: sign, sig: m.sig, pow: m.pow, virtual: true }; };
		var nUp = nb.up || (mx ? null : virt(0)), nDn = nb.dn || (mx ? null : virt(1));
		var v = raw(d), even = d.sig % 2 === 0;
		var iv = {
			d: d, v: v, nUp: nUp, nDn: nDn, even: even,
			lo: nDn ? rMid(raw(nDn), v) : null, hi: nUp ? rMid(v, raw(nUp)) : null,   /* null = unbounded */
			gapDn: nDn ? rSub(v, raw(nDn)) : null, gapUp: nUp ? rSub(raw(nUp), v) : null,
			closedLo: even, closedHi: even, zeroSide: null,
		};
		if (d.cls === "zero" && fmt.kind !== "fnuz") {
			iv.zeroSide = d.sign ? "hi" : "lo";
			if (d.sign) { iv.hi = { n: 0n, p: 0 }; iv.closedHi = true; } else { iv.lo = { n: 0n, p: 0 }; iv.closedLo = true; }
		}
		return iv;
	}
	function brk(iv) { return [iv.lo && iv.closedLo ? "[" : "(", iv.hi && iv.closedHi ? "]" : ")"]; }
	/* C: local axis with previous / this / next */
	function bracketPath(svg, x, y, h, side, closed) {
		var dir = side === "l" ? 1 : -1;
		var d = closed
			? "M" + (x + dir * 5) + "," + (y - h) + " L" + x + "," + (y - h) + " L" + x + "," + (y + h) + " L" + (x + dir * 5) + "," + (y + h)
			: "M" + (x + dir * 5) + "," + (y - h) + " Q" + (x - dir * 3) + "," + y + " " + (x + dir * 5) + "," + (y + h);
		svgEl(svg, "path", { d: d, class: "iv_bracket" });
	}
	function renderLocal(body, iv) {
		if (!body.firstChild) body.innerHTML = "<svg class='iv_local non_selectable'></svg>";
		var svg = body.firstChild; svg.innerHTML = "";
		var el = function (tag, attrs, text) { return svgEl(svg, tag, attrs, text); };
		var W = svg.clientWidth || 800, H = 176, y = 74, x0 = 80, x1 = W - 80;
		svg.setAttribute("viewBox", "0 0 " + W + " " + H);
		var v = rNum(iv.v), dn = iv.nDn ? rNum(raw(iv.nDn)) : null, up = iv.nUp ? rNum(raw(iv.nUp)) : null;
		var L = dn !== null ? dn : v - (up - v), R = up !== null ? up : v + (v - dn);
		var X = function (t) { return x0 + (t - L) / (R - L) * (x1 - x0); };
		el("line", { x1: x0 - 50, y1: y, x2: x1 + 50, y2: y, class: "axis" });
		var lo = iv.lo ? rNum(iv.lo) : null, hi = iv.hi ? rNum(iv.hi) : null;
		var bx0 = lo === null ? x0 - 50 : X(lo), bx1 = hi === null ? x1 + 50 : X(hi);
		el("rect", { x: bx0, y: y - 8, width: bx1 - bx0, height: 16, class: "iv_band" });
		if (lo !== null) bracketPath(svg, bx0, y, 11, "l", iv.closedLo);
		else texAt(svg, "\\leftarrow\\ \\text{saturates to }{-\\text{max}}", bx0 + 4, y - 16, "start", 12);
		if (hi !== null) bracketPath(svg, bx1, y, 11, "r", iv.closedHi);
		else texAt(svg, "\\text{saturates to max}\\ \\rightarrow", bx1 - 4, y - 16, "end", 12);
		/* interval ends below the axis */
		[[iv.lo, lo], [iv.hi, hi]].forEach(function (p) {
			if (!p[0]) return;
			texAt(svg, tD(p[0]), X(p[1]), y + 30, "middle", 13, "#555");
			el("text", { x: X(p[1]), y: y + 44, class: "iv_cap" }, p[0].n === 0n ? "sign boundary" : "midpoint");
		});
		/* points, with role and value above */
		var pt = function (t, d, role, sel) {
			el("circle", { cx: X(t), cy: y, r: sel ? 5 : 3.5, class: "dot " + (d.virtual ? "iv_virtual" : "cls_" + d.cls) + (sel ? " sel" : "") });
			el("text", { x: X(t), y: y - 38, class: "iv_cap" }, role);
			texAt(svg, d.virtual ? (d.sign ? "-" : "") + tx(bigForm(BigInt(d.sig), d.pow).pow2) : tD(raw(d)), X(t), y - 18, "middle", 13, sel ? "#191919" : "#555");
		};
		if (iv.nDn) pt(dn, iv.nDn, iv.nDn.virtual ? "overflow threshold" : "previous");
		if (iv.nUp) pt(up, iv.nUp, iv.nUp.virtual ? "overflow threshold" : "next");
		pt(v, iv.d, "this value", true);
		/* gaps to the neighbours */
		var gap = function (t, g, name) {
			var a = Math.min(X(t), X(v)), c = Math.max(X(t), X(v)), yy = y + 70;
			el("line", { x1: a, y1: yy, x2: c, y2: yy, class: "iv_dim" });
			el("line", { x1: a, y1: yy - 4, x2: a, y2: yy + 4, class: "iv_dim" });
			el("line", { x1: c, y1: yy - 4, x2: c, y2: yy + 4, class: "iv_dim" });
			texAt(svg, "\\Delta_{\\text{" + name + "}} = " + tP(g), (a + c) / 2, yy + 22, "middle", 13, "#555");
		};
		if (iv.nDn) gap(dn, iv.gapDn, "prev");
		if (iv.nUp) gap(up, iv.gapUp, "next");
	}

	/* One short line under the chart: why the ends are open or closed, and the special cases. */
	function ivReasons(iv) {
		var d = iv.d, notes = [], mbits = pad(d.mant, fmt.m);
		notes.push(iv.even
			? "Ends included: the mantissa " + mbits + " is even, and a tie rounds to the even neighbour."
			: "Ends excluded: the mantissa " + mbits + " is odd, so a tie rounds to the neighbour.");
		if (iv.gapDn && iv.gapUp && rFmt(iv.gapDn).dec !== rFmt(iv.gapUp).dec && d.cls !== "zero")
			notes.push("At a binade boundary the gap below is half the gap above.");
		if (iv.zeroSide) notes.push((d.sign ? "Positive inputs round to +0" : "Negative inputs round to −0") + ", so this side ends at 0.");
		if ((iv.nUp && iv.nUp.virtual) || (iv.nDn && iv.nDn.virtual))
			notes.push("Past the overflow threshold's midpoint, inputs become " + (fmt.kind === "ieee" ? "infinity" : "NaN") + ".");
		if (!iv.lo || !iv.hi) notes.push("mx conversion saturates, so every larger input becomes max.");
		return notes.join(" ");
	}
	function renderNeighbours(d) {
		var special = d.cls === "nan" || d.cls === "inf";
		var showIv = !special && fmt.kind !== "e8m0";
		$("iv_chart").classList.toggle("hidden", !showIv);
		$("iv_reasons").classList.toggle("hidden", !showIv);
		$("interval_na").classList.toggle("hidden", showIv);
		var nb = neighbours(d);
		curIv = showIv ? roundInterval(d, nb) : null;
		if (curIv) { renderLocal($("iv_chart"), curIv); $("iv_reasons").textContent = ivReasons(curIv); return; }
		if (special) { $("interval_na").textContent = "Not defined for " + (d.cls === "nan" ? "NaN" : "infinity") + "."; return; }
		/* e8m0: neighbours exist, but rounding works on the fraction of log₂, not on midpoints */
		var g = function (n) { return n ? tP(rAbs(rSub(raw(n), raw(d)))) : "\\text{none}"; };
		rich($("interval_na"), "e8m0 rounds on the fraction of $\\log_2 x$, not at midpoints between neighbours, so no interval is shown. " +
			"Gaps: $\\Delta_{\\text{prev}} = " + g(nb.dn) + "$, $\\Delta_{\\text{next}} = " + g(nb.up) + "$.");
	}

	/* ---------- render ---------- */
	function pop(e) { e.classList.remove("pop"); void e.offsetWidth; e.classList.add("pop"); }   /* restart the CSS animation */

	function reload() {
		var d = decode(fmt, code);
		var vs = valueString(fmt, code);
		if (mainField.value !== vs) { mainField.value = vs; pop(mainField); }
		mainField.classList.remove("invalid_number");
		mainField.style.fontSize = Math.max(18, Math.min(50, Math.floor(600 / Math.max(1, mainField.value.length)))) + "px";

		for (var i = 0; i < fmt.bits; i++) {
			var b = String(Math.floor(code / pow2(fmt.bits - 1 - i)) % 2);
			if (bitLabels[i].textContent !== b) { bitLabels[i].textContent = b; pop(bitLabels[i]); }
		}
		CODE_FIELDS.forEach(function (cf) {
			if (document.activeElement !== cf.input || cf.parse(cf.input.value.trim().toLowerCase()) !== code) cf.input.value = cf.show(code);
			cf.input.classList.remove("invalid_number");
			sizeField(cf.input);
		});
		$("cls_badge").textContent = { zero: "zero", sub: "subnormal", normal: "normal", inf: "infinity", nan: "NaN" }[d.cls];
		$("cls_badge").className = "cls_badge cls_" + d.cls;

		renderEval(d);

		var cells = $("grid").children;
		for (var k = 0; k < cells.length; k++) cells[k].classList.toggle("sel", cells[k].dataset.code == code);
		moveMarker();
		updateZoom();
		renderNeighbours(d);
		history.replaceState(null, "", "#" + fmt.name + ":0x" + code.toString(16).padStart(fmt.bits / 4, "0"));
	}

	/* ---------- main field ---------- */
	mainField.oninput = function () { mainField.classList.toggle("invalid_number", parseValue(mainField.value) === undefined); };
	function commitMain() { var v = parseValue(mainField.value); if (v !== undefined) code = encode(fmt, v); reload(); }
	mainField.onkeydown = function (e) { if (e.key === "Enter") commitMain(); };
	mainField.onblur = commitMain;

	function start() {
		document.head.appendChild(MathJax.svgStylesheet());
		window.addEventListener("resize", function () { moveThumb(groupThumb, groupBtns[fmt.group], false); buildLine(); buildZoom(); reload(); });
		/* deep link: #float8_e5m2:0x7b */
		var h = /^#(\w+)(?::0x([0-9a-f]+))?$/i.exec(location.hash), f0 = h && fmtByName(h[1]);
		setFormat(f0 || fmtByName("float8_e4m3fn"), f0 && h[2] ? Math.min(maxCode(f0), parseInt(h[2], 16)) : undefined);
		mainField.focus();
	}
	MathJax.startup.promise.then(start);
})();
