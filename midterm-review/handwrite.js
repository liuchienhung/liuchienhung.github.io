/* 期中考總復習：手寫
 *
 *  1. 寫字板 HW.pad()：寫數字（十位、個位兩格）、寫聲調、寫注音（一個字一個字寫：三格符號＋聲調欄）。
 *     工具：寫字、橡皮擦（擦到的那一筆會不見）、上一筆、重寫、寫好了。
 *     寫好了先給孩子看「我認出來的是…」，對了才送出；認錯可以再寫，練習時也可以「請爸媽看」。
 *  2. 考卷上直接畫 HW.ink：打勾、圈起來、打叉、連線。
 *     「寫字」時一根手指畫、兩根手指捲動；「移動」時照常點和捲動。工具列在右邊。
 *  3. 辨識 HW.recog：數字、注音符號用 $P 點雲辨識（Vatavu、Anthony、Wobbrock 2012），
 *     注音的樣子取自 ../zhuyin-stroke/strokes.js（教育部筆順）；聲調和勾、叉、圈、線看筆畫的形狀。
 *
 * 頁面先 HW.config({ T, ZY })：T 幫國字加注音，ZY 是 ../zhuyin-layout.js。
 */
(function (root) {
  'use strict';
  const doc = root.document;
  let T = s => s, ZY = root.ZhuyinLayout;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ================= $P 點雲辨識 ================= */
  const NP = 32;
  const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  function toPts(strokes) { const out = []; strokes.forEach((s, id) => s.forEach(p => out.push({ x: p[0], y: p[1], id }))); return out; }
  function resample(pts, n) {
    pts = pts.map(p => ({ ...p }));
    let L = 0;
    for (let i = 1; i < pts.length; i++) if (pts[i].id === pts[i - 1].id) L += Math.sqrt(d2(pts[i], pts[i - 1]));
    const I = L / (n - 1), out = [{ ...pts[0] }];
    if (!(I > 0)) { while (out.length < n) out.push({ ...pts[0] }); return out; }
    let D = 0;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].id !== pts[i - 1].id) continue;
      const d = Math.sqrt(d2(pts[i], pts[i - 1]));
      if (D + d >= I) {
        const t = (I - D) / d, q = { x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y), id: pts[i].id };
        out.push(q); pts.splice(i, 0, q); D = 0;
      } else D += d;
    }
    while (out.length < n) out.push({ ...pts[pts.length - 1] });
    return out.slice(0, n);
  }
  function normalize(strokes) {
    let p = resample(toPts(strokes), NP);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    p.forEach(q => { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); });
    const s = Math.max(x1 - x0, y1 - y0) || 1;
    p = p.map(q => ({ x: (q.x - x0) / s, y: (q.y - y0) / s }));
    const cx = p.reduce((a, q) => a + q.x, 0) / p.length, cy = p.reduce((a, q) => a + q.y, 0) / p.length;
    return p.map(q => ({ x: q.x - cx, y: q.y - cy }));
  }
  function cloudDist(a, b, start) {
    const n = a.length, used = new Array(n).fill(false);
    let sum = 0, i = start;
    do {
      let min = Infinity, idx = 0;
      for (let j = 0; j < n; j++) if (!used[j]) { const d = d2(a[i], b[j]); if (d < min) { min = d; idx = j; } }
      used[idx] = true;
      sum += (1 - ((i - start + n) % n) / n) * min;
      i = (i + 1) % n;
    } while (i !== start);
    return sum;
  }
  function greedy(a, b) {
    const n = a.length, step = Math.floor(Math.sqrt(n));
    let m = Infinity;
    for (let i = 0; i < n; i += step) m = Math.min(m, cloudDist(a, b, i), cloudDist(b, a, i));
    return m;
  }
  function classify(strokes, set) {
    const c = normalize(strokes), best = {};
    set.forEach(t => { const d = greedy(c, t.pts); if (!(t.label in best) || d < best[t.label]) best[t.label] = d; });
    return Object.entries(best).map(([label, d]) => ({ label, d })).sort((a, b) => a.d - b.d);
  }

  /* ---------- 數字的樣子（0～100 寬、0～140 高；每個數字幾種常見寫法） ---------- */
  const arc = (cx, cy, rx, ry, a0, a1, n = 16) => Array.from({ length: n + 1 }, (_, i) => {
    const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
  const DIGIT_SHAPES = {
    0: [[arc(50, 70, 40, 64, -90, 270, 24)], [arc(50, 70, 26, 64, -90, 270, 24)]],
    1: [[[[50, 4], [50, 136]]], [[[28, 32], [52, 4], [52, 136]]], [[[28, 32], [52, 4], [52, 136]], [[24, 136], [80, 136]]]],
    2: [[[...arc(50, 42, 38, 37, 180, 400, 14), [12, 136], [92, 136]]], [[...arc(50, 40, 36, 36, 200, 380, 12), [16, 132], [16, 136], [90, 134]]]],
    3: [[[...arc(48, 36, 34, 31, 200, 450, 12), ...arc(48, 100, 38, 35, 270, 500, 14)]], [[[14, 8], [86, 8], [46, 60], ...arc(48, 98, 38, 38, 270, 500, 14)]]],
    4: [[[[68, 4], [8, 96], [94, 96]], [[68, 40], [68, 136]]], [[[24, 4], [14, 88], [92, 88]], [[70, 44], [70, 136]]]],
    5: [[[[82, 6], [26, 6]], [[26, 6], [20, 64], ...arc(50, 96, 40, 38, 225, 500, 14)]], [[[26, 6], [20, 64], ...arc(50, 96, 40, 38, 225, 500, 14)], [[26, 6], [84, 6]]]],
    6: [[[[78, 6], [46, 26], [22, 62], ...arc(52, 98, 38, 37, 180, 540, 18)]]],
    7: [[[[10, 8], [90, 8], [40, 136]]], [[[10, 8], [90, 8], [40, 136]], [[34, 72], [80, 72]]], [[[10, 30], [10, 8], [90, 8], [52, 136]]]],
    8: [[arc(50, 36, 30, 31, 90, 450, 16), arc(50, 100, 38, 36, -90, 270, 16)], [[...arc(50, 36, 30, 31, 90, 450, 16), ...arc(50, 100, 38, 36, -90, 270, 16)]]],
    9: [[arc(48, 40, 36, 35, 0, 360, 18), [[84, 40], [80, 136]]], [[...arc(48, 40, 36, 35, 0, 360, 18), [84, 60], [70, 136]]],
      [[...arc(50, 34, 30, 30, 0, 360, 16), [80, 34], [80, 138]]], [[...arc(50, 34, 30, 30, 0, 360, 16), [80, 34], [80, 110], [62, 136], [36, 130]]]]
  };
  const DIGIT_T = Object.entries(DIGIT_SHAPES).flatMap(([d, vs]) => vs.map(strokes => ({ label: d, pts: normalize(strokes) })));
  let ZHUYIN_T = null;
  function zhuyinTemplates() {
    if (ZHUYIN_T) return ZHUYIN_T;
    let S = null;
    try { S = typeof ZHUYIN_STROKES !== 'undefined' ? ZHUYIN_STROKES : null; } catch { S = null; } // eslint-disable-line no-undef
    if (!S) return [];
    ZHUYIN_T = Object.entries(S).map(([c, ss]) => ({ label: c, pts: normalize(ss.map(s => s[1])) }));
    return ZHUYIN_T;
  }
  // 注音筆順資料只有手寫才用到，要用時才載入
  let strokesP = null;
  function loadStrokes(src) {
    if (zhuyinTemplates().length) return Promise.resolve();
    if (!strokesP) strokesP = new Promise((ok, no) => {
      const s = doc.createElement('script'); s.src = src || '../zhuyin-stroke/strokes.js';
      s.onload = () => ok(); s.onerror = no; doc.head.appendChild(s);
    });
    return strokesP;
  }

  /* ---------- 形狀 ---------- */
  const bbox = pts => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  };
  const plen = s => s.reduce((a, p, i) => i ? a + Math.hypot(p[0] - s[i - 1][0], p[1] - s[i - 1][1]) : 0, 0);
  function segCross(p1, p2, p3, p4) {
    const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const a = d(p3, p4, p1), b = d(p3, p4, p2), c = d(p1, p2, p3), e = d(p1, p2, p4);
    return ((a > 0 && b < 0) || (a < 0 && b > 0)) && ((c > 0 && e < 0) || (c < 0 && e > 0));
  }
  function strokesCross(s, t) {
    for (let i = 1; i < s.length; i += 1) for (let j = 1; j < t.length; j += 1) if (segCross(s[i - 1], s[i], t[j - 1], t[j])) return true;
    return false;
  }
  // 考卷上畫的記號：x 叉、o 圈、line 線、v 勾
  function markShape(strokes) {
    const all = strokes.flat(), b = bbox(all), size = Math.max(b.w, b.h);
    if (strokes.length >= 2 && strokesCross(strokes[0], strokes[1])) return 'x';
    const s = strokes.reduce((m, x) => plen(x) > plen(m) ? x : m, strokes[0]);
    const L = plen(s), chord = Math.hypot(s[s.length - 1][0] - s[0][0], s[s.length - 1][1] - s[0][1]);
    if (L > 2.2 * size && chord < 0.45 * size) return 'o';
    if (strokes.length === 1 && L < 1.3 * chord && chord > 60) return 'line';
    return 'v';
  }
  function inPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  // 聲調：1 一聲（沒寫）2 ˊ 3 ˇ 4 ˋ 5 ˙；cell＝格子大小
  function toneOf(strokes, cell) {
    const all = strokes.flat();
    if (!all.length) return 1;
    const b = bbox(all), size = Math.max(b.w, b.h);
    if (size < cell * 0.17) return 5;
    if (b.h < b.w * 0.28) return 1;
    // ˇ：最低的點在中間，兩頭都比較高
    const isV = s => {
      const n = s.length; let li = 0;
      s.forEach((p, i) => { if (p[1] > s[li][1]) li = i; });
      const bb = bbox(s);
      return li > n * 0.15 && li < n * 0.85 && s[0][1] < s[li][1] - bb.h * 0.35 && s[n - 1][1] < s[li][1] - bb.h * 0.35 && bb.w > bb.h * 0.35;
    };
    if (strokes.length === 1 && isV(strokes[0])) return 3;
    if (strokes.length === 2) {
      const low = s => s.reduce((m, p) => p[1] > m[1] ? p : m, s[0]), top = s => s.reduce((m, p) => p[1] < m[1] ? p : m, s[0]);
      const l1 = low(strokes[0]), l2 = low(strokes[1]), t1 = top(strokes[0]), t2 = top(strokes[1]);
      if (Math.hypot(l1[0] - l2[0], l1[1] - l2[1]) < size * 0.4 && (t1[0] - l1[0]) * (t2[0] - l2[0]) < 0) return 3;
    }
    const left = all.reduce((m, p) => p[0] < m[0] ? p : m, all[0]), right = all.reduce((m, p) => p[0] > m[0] ? p : m, all[0]);
    if (right[1] < left[1] - b.h * 0.25) return 2;
    if (right[1] > left[1] + b.h * 0.25) return 4;
    return b.h > b.w ? 4 : 1;
  }

  /* ================= 樣式 ================= */
  const ICON = {
    pen: '<path d="M4 20l4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16z"/><path d="M14.5 6.5l3 3"/>',
    eraser: '<path d="M7.5 19.5h12"/><path d="M4.6 14.6l9.2-9.2a2 2 0 0 1 2.8 0l2.6 2.6a2 2 0 0 1 0 2.8L11 19H8.8z"/><path d="M9.3 9.9l4.8 4.8"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    clear: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4v4.5h4.5"/>',
    done: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    move: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5"/><path d="M14 10.5V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.6 7-6.2 7-2.3 0-3.9-1.2-5.2-3.5L3.8 14a1.5 1.5 0 0 1 2.4-1.7L8 14.5"/>',
    parent: '<circle cx="9" cy="7" r="3"/><path d="M3.5 20c0-3.6 2.4-6 5.5-6s5.5 2.4 5.5 6"/><circle cx="17" cy="9" r="2.2"/><path d="M15.5 14.4c3.2-.6 5.5 1.6 5.5 5.1"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  const icon = k => `<svg class="hwi" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
  const CSS = `
.hwi{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
.hwpad{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.28)}
.hwpad[hidden]{display:none}
.hw-in{background:var(--paper,#fff);border-radius:22px 22px 0 0;box-shadow:0 -8px 24px rgba(0,0,0,.18);max-height:94vh;overflow:auto;
  padding:10px max(12px,env(safe-area-inset-left,0px)) calc(10px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:8px}
.hw-head{display:flex;align-items:center;gap:8px;font-size:18px}
.hw-head .tt{flex:1;min-width:0}
.hw-head button{min-width:44px;min-height:44px;padding:4px;display:grid;place-items:center}
.hw-stage{display:flex;gap:10px;justify-content:center;align-items:stretch;touch-action:none}
.hw-col{display:flex;flex-direction:column;gap:0}
.hw-cell{position:relative;border:2px solid var(--ink,#222);background:var(--paper,#fff);margin-top:-2px}
.hw-cell:first-child{margin-top:0}
.hw-cell canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair}
.hw-cell .lbl{position:absolute;left:4px;top:2px;font-size:12px;color:var(--muted,#777);pointer-events:none}
.hw-cell.tone{border-style:dashed;border-color:var(--red,#c33)}
.hw-ctx{display:flex;align-items:center;justify-content:center;font-size:56px;padding:0 6px}
.hw-tip{text-align:center;font-size:15px;color:var(--muted,#666);margin:0}
.hw-tools{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.hw-tools button,.hw-acts button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:62px;padding:4px 2px;font-size:14px;border-radius:14px}
.hw-tools button.on{border-color:var(--zh,#2f8f5e);background:var(--zh-soft,#ddf0e4)}
.hw-tools .go,.hw-acts .go{background:var(--zh,#2f8f5e);border-color:var(--zh,#2f8f5e);color:var(--paper,#fff);font-weight:700}
.ma .hw-tools .go,.ma .hw-acts .go{background:var(--ma,#c97520);border-color:var(--ma,#c97520)}
.hw-acts{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:6px}
.hw-res{text-align:center;display:flex;flex-direction:column;gap:6px;align-items:center}
.hw-res .big{font-size:52px;font-weight:700;line-height:1.2;font-variant-numeric:tabular-nums;font-family:var(--f-kai,inherit)}
.hw-res .big .zw{font-size:.75em}
.hw-alts{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.hw-alts button{min-height:46px;min-width:52px;font-size:22px;font-family:var(--f-kai,inherit)}
.hw-ans{font-size:18px}
.hw-ans .big{font-size:30px}
body.hwpad-open .coach{opacity:0;pointer-events:none}
/* 考卷上畫 */
.hwc{position:absolute;left:0;top:0;width:100%;height:100%;z-index:4;pointer-events:none;touch-action:auto}
body.hw-draw .hwc{pointer-events:auto;touch-action:none;cursor:crosshair}
.hwdock{position:fixed;right:max(6px,env(safe-area-inset-right,0px));top:50%;transform:translateY(-50%);z-index:30;display:flex;flex-direction:column;gap:6px;
  background:var(--paper,#fff);border:2px solid var(--line,#ddd);border-radius:18px;padding:6px;box-shadow:0 4px 16px rgba(0,0,0,.15)}
.hwdock button{display:flex;flex-direction:column;align-items:center;gap:1px;width:58px;min-height:56px;padding:3px 2px;font-size:12px;border-radius:12px}
.hwdock button.on{border-color:var(--zh,#2f8f5e);background:var(--zh-soft,#ddf0e4);font-weight:700}
.hwdock[hidden]{display:none}
body.padopen .hwdock,body.hwpad-open .hwdock{display:none}
`;
  if (doc && !doc.getElementById('hw-css')) { const st = doc.createElement('style'); st.id = 'hw-css'; st.textContent = CSS; doc.head.appendChild(st); }

  /* ================= 寫字板 ================= */
  // 一格可以寫的畫布：筆畫存成點，橡皮擦擦掉碰到的整筆
  function cellCanvas(cell, st) {
    const cv = doc.createElement('canvas'); cell.appendChild(cv);
    const c = { el: cell, cv, strokes: [] };
    const fit = () => {
      const r = cell.getBoundingClientRect(), dpr = root.devicePixelRatio || 1;
      cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr);
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); c.g = g; c.w = r.width; c.h = r.height; draw();
    };
    const draw = () => {
      const g = c.g; if (!g) return;
      g.clearRect(0, 0, c.w, c.h);
      g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = getComputedStyle(cell).color || '#222'; g.lineWidth = Math.max(5, c.w / 26);
      c.strokes.forEach(s => {
        g.beginPath(); g.moveTo(s[0][0], s[0][1]);
        if (s.length === 1) g.lineTo(s[0][0] + .1, s[0][1]);
        s.forEach(p => g.lineTo(p[0], p[1])); g.stroke();
      });
    };
    c.fit = fit; c.draw = draw;
    let cur = null;
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const erase = p => {
      const R = Math.max(14, c.w / 9), n = c.strokes.length;
      c.strokes = c.strokes.filter(s => !s.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < R));
      if (c.strokes.length !== n) { draw(); st.changed(); }
    };
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); cv.setPointerCapture(e.pointerId);
      if (st.tool === 'eraser') { cur = 'erase'; erase(pos(e)); return; }
      cur = [pos(e)]; c.strokes.push(cur); st.hist.push(c); draw();
    });
    cv.addEventListener('pointermove', e => {
      if (!cur) return;
      if (cur === 'erase') { erase(pos(e)); return; }
      const p = pos(e), q = cur[cur.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 1.2) { cur.push(p); draw(); }
    });
    const up = () => { if (cur && cur !== 'erase') st.changed(); cur = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    return c;
  }

  const PAD = { el: null, o: null, tool: 'pen', cells: [], hist: [], step: 0, results: [] };
  function padEl() {
    if (PAD.el) return PAD.el;
    const el = doc.createElement('div'); el.className = 'hwpad'; el.hidden = true;
    el.innerHTML = `<div class="hw-in" role="dialog" aria-modal="true">
      <div class="hw-head"><span class="tt" id="hwTitle"></span><button type="button" data-hw="close" aria-label="收起來">${icon('close')}</button></div>
      <p class="hw-tip" id="hwTip"></p>
      <div class="hw-stage" id="hwStage"></div>
      <div class="hw-res" id="hwRes" hidden></div>
      <div class="hw-tools" id="hwTools">
        <button type="button" data-hw="pen" class="on">${icon('pen')}<span>${T('寫字')}</span></button>
        <button type="button" data-hw="eraser">${icon('eraser')}<span>${T('橡皮擦')}</span></button>
        <button type="button" data-hw="undo">${icon('undo')}<span>${T('上一筆')}</span></button>
        <button type="button" data-hw="clear">${icon('clear')}<span>${T('重寫')}</span></button>
        <button type="button" data-hw="done" class="go">${icon('done')}<span id="hwDoneLbl">${T('寫好了')}</span></button>
      </div></div>`;
    el.addEventListener('click', e => {
      if (e.target === el) return closePad();
      const b = e.target.closest('[data-hw]'); if (!b) return;
      const a = b.dataset.hw;
      if (a === 'close') closePad();
      else if (a === 'pen' || a === 'eraser') { PAD.tool = a; el.querySelectorAll('[data-hw="pen"],[data-hw="eraser"]').forEach(x => x.classList.toggle('on', x.dataset.hw === a)); }
      else if (a === 'undo') { const c = PAD.hist.pop(); if (c) { c.strokes.pop(); c.draw(); } }
      else if (a === 'clear') { PAD.cells.forEach(c => { c.strokes = []; c.draw(); }); PAD.hist = []; }
      else if (a === 'done') padDone();
      else if (a === 'ok') padSubmit(PAD.cand);
      else if (a === 'alt') { PAD.cand = JSON.parse(b.dataset.v); padSubmit(PAD.cand); }
      else if (a === 'again') padShowWrite();
      else if (a === 'parent') padParent();
      else if (a === 'pyes' || a === 'pno') { const o = PAD.o; closePad(); o.onResult({ by: 'parent', ok: a === 'pyes' }); }
      else if (a === 'tone1') { PAD.cells.forEach(c => { c.strokes = []; c.draw(); }); padDone(); }
    });
    doc.body.appendChild(el); PAD.el = el; return el;
  }
  const $p = s => PAD.el.querySelector(s);
  function closePad() { if (PAD.el) PAD.el.hidden = true; doc.body.classList.remove('hwpad-open'); PAD.o = null; }
  /* o = { kind: 'num'|'tone'|'zy'|'code', title, digits, syl, n（幾個字）, parent: { answerHTML } 或 null, onResult(r) }
   * r = { by: 'child', value } 或 { by: 'parent', ok } */
  function pad(o) {
    padEl(); PAD.o = o; PAD.step = 0; PAD.results = []; PAD.tool = 'pen';
    PAD.el.querySelectorAll('[data-hw="pen"],[data-hw="eraser"]').forEach(x => x.classList.toggle('on', x.dataset.hw === 'pen'));
    PAD.el.hidden = false; doc.body.classList.add('hwpad-open');
    $p('#hwTitle').innerHTML = o.title || '';
    padBuild();
  }
  function padBuild() {
    const o = PAD.o, st = $p('#hwStage'), vw = Math.min(root.innerWidth, 520);
    PAD.cells = []; PAD.hist = [];
    const state = { get tool() { return PAD.tool; }, hist: PAD.hist, changed() {} };
    let tip = '';
    if (o.kind === 'num' || o.kind === 'code') {
      const n = o.kind === 'code' ? 1 : o.digits || 2, sz = Math.min(160, (vw - 60) / n);
      st.innerHTML = Array.from({ length: n }, (_, i) => `<div class="hw-col"><div class="hw-cell" style="width:${sz}px;height:${sz * 1.15}px"><span class="lbl">${n > 1 ? (i ? '個位' : '十位') : ''}</span></div></div>`).join('');
      tip = o.kind === 'code' ? T('寫號碼 1、2 或 3') : T('一格寫一個數字；只有一位數，寫在右邊的格子');
    } else if (o.kind === 'tone') {
      const sz = Math.min(170, vw - 190);
      st.innerHTML = `<div class="hw-ctx">${ZY.syl(o.syl, { box: '' })}</div><div class="hw-col"><div class="hw-cell tone" style="width:${sz}px;height:${sz}px"></div></div>`;
      tip = T('在框框裡寫聲調（ˊ ˇ ˋ 或 ˙）；一聲不用寫');
    } else {
      const sz = Math.min(96, (root.innerHeight - 330) / 3.2);
      st.innerHTML = `<div class="hw-col">${[0, 1, 2].map(i => `<div class="hw-cell" style="width:${sz}px;height:${sz}px"><span class="lbl">${i + 1}</span></div>`).join('')}</div>
        <div class="hw-col"><div class="hw-cell tone" style="width:${sz * .62}px;height:${sz * 3 - 4}px"><span class="lbl">聲調</span></div></div>`;
      tip = (o.n > 1 ? `第 ${PAD.step + 1} 個字（共 ${o.n} 個）：` : '') + '符號由上往下一格寫一個；聲調寫在右邊（一聲不寫、輕聲寫一點）';
    }
    $p('#hwTip').innerHTML = tip;
    st.querySelectorAll('.hw-cell').forEach(cell => PAD.cells.push(cellCanvas(cell, state)));
    requestAnimationFrame(() => PAD.cells.forEach(c => c.fit()));
    const toneBtn = o.kind === 'tone' ? `<button type="button" data-hw="tone1">－<span>${T('一聲')}</span></button>` : '';
    $p('#hwTools').hidden = false; $p('#hwRes').hidden = true; st.hidden = false;
    $p('#hwTools').querySelectorAll('[data-hw="tone1"]').forEach(x => x.remove());
    if (toneBtn) $p('#hwTools [data-hw="done"]').insertAdjacentHTML('beforebegin', toneBtn);
    $p('#hwTools').style.gridTemplateColumns = `repeat(${toneBtn ? 6 : 5},1fr)`;
    $p('#hwDoneLbl').innerHTML = o.kind === 'zy' && o.n > 1 && PAD.step < o.n - 1 ? T('下一個字') : T('寫好了');
  }
  function padShowWrite() { $p('#hwStage').hidden = false; $p('#hwTools').hidden = false; $p('#hwRes').hidden = true; PAD.cells.forEach(c => c.fit()); }
  // 寫好了：辨識，再給孩子確認
  async function padDone() {
    const o = PAD.o;
    if (o.kind === 'num' || o.kind === 'code') {
      const per = PAD.cells.map(c => c.strokes.length ? classify(c.strokes, DIGIT_T) : null);
      if (per.every(x => !x)) { $p('#hwTip').innerHTML = '還沒寫喔！'; return; }
      const top = per.map(r => r ? r[0].label : ''), v = +top.join('');
      const alts = [];
      per.forEach((r, i) => { if (r && r[1]) { const t = top.slice(); t[i] = r[1].label; const x = +t.join(''); if (!alts.includes(x) && x !== v) alts.push(x); } });
      PAD.cand = v; showResult(String(v), alts.slice(0, 3).map(x => [JSON.stringify(x), String(x)]));
    } else if (o.kind === 'tone') {
      const c = PAD.cells[0], t = toneOf(c.strokes, Math.max(c.w, c.h));
      PAD.cand = t;
      const show = t2 => ZY.syl(ZY.withTone(o.syl, t2));
      showResult(show(t) + (t === 1 ? `<div class="hw-tip">${T('一聲')}</div>` : ''), [1, 2, 3, 4, 5].filter(x => x !== t).map(x => [String(x), show(x)]));
    } else {
      await loadStrokes(o.strokesSrc).catch(() => {});
      const set = zhuyinTemplates();
      const syms = PAD.cells.slice(0, 3).filter(c => c.strokes.length).map(c => classify(c.strokes, set)[0]?.label || '');
      const tc = PAD.cells[3], t = toneOf(tc.strokes, Math.max(tc.w, tc.h * .4));
      if (!syms.length) { $p('#hwTip').innerHTML = '還沒寫喔！'; return; }
      PAD.results[PAD.step] = ZY.withTone(syms.join(''), t);
      if (PAD.step < o.n - 1) { PAD.step++; padBuild(); return; }
      const z = PAD.results.join(' ');
      PAD.cand = z; showResult(ZY.word(z), []);
    }
  }
  function showResult(html, alts) {
    const o = PAD.o;
    $p('#hwStage').hidden = true; $p('#hwTools').hidden = true;
    const r = $p('#hwRes'); r.hidden = false;
    r.innerHTML = `<div class="hw-tip">${T('我認出來的是')}</div><div class="big">${html}</div>
      ${alts.length ? `<div class="hw-tip">${T('不是嗎？你寫的是')}</div><div class="hw-alts">${alts.map(([v, h]) => `<button type="button" data-hw="alt" data-v='${esc(v)}'>${h}</button>`).join('')}</div>` : ''}
      <div class="hw-acts" style="width:100%"><button type="button" data-hw="again">${icon('pen')}<span>${T('再寫一次')}</span></button>
      ${o.parent ? `<button type="button" data-hw="parent">${icon('parent')}<span>${T('請爸媽看')}</span></button>` : ''}
      <button type="button" class="go" data-hw="ok">${icon('done')}<span>${T('對，送出')}</span></button></div>`;
  }
  function padSubmit(v) { const o = PAD.o; closePad(); o.onResult({ by: 'child', value: v }); }
  // 請爸媽看：看孩子寫的字和答案，爸媽決定對不對
  function padParent() {
    const o = PAD.o; padShowWrite();
    $p('#hwTools').hidden = true;
    const r = $p('#hwRes'); r.hidden = false;
    r.innerHTML = `<div class="hw-tip">${T('請爸爸媽媽看：上面孩子寫的對嗎？')}</div><div class="hw-ans">答案：<span class="big">${o.parent.answerHTML}</span></div>
      <div class="hw-acts" style="width:100%"><button type="button" data-hw="pno">✗<span>${T('寫錯了')}</span></button><button type="button" class="go" data-hw="pyes">✓<span>${T('寫對了')}</span></button></div>`;
  }
  // 問爸媽（例如孩子造的詞不在題庫裡）
  function ask(html, onYes, onNo) {
    padEl(); PAD.o = { onResult: r => (r.ok ? onYes : onNo)() };
    PAD.el.hidden = false; doc.body.classList.add('hwpad-open');
    $p('#hwTitle').innerHTML = T('請爸爸媽媽看'); $p('#hwTip').innerHTML = '';
    $p('#hwStage').hidden = true; $p('#hwTools').hidden = true;
    const r = $p('#hwRes'); r.hidden = false;
    r.innerHTML = `<div class="hw-ans">${html}</div><div class="hw-acts" style="width:100%"><button type="button" data-hw="pno">✗<span>${T('不對')}</span></button><button type="button" class="go" data-hw="pyes">✓<span>${T('對')}</span></button></div>`;
  }

  /* ================= 考卷上直接畫 ================= */
  const INK = { mode: 'draw', sheets: [], dock: null, last: null, handler: null, tapHandler: null };
  function dockEl() {
    if (INK.dock) return INK.dock;
    const d = doc.createElement('div'); d.className = 'hwdock'; d.hidden = true;
    d.innerHTML = `<button type="button" data-ink="draw" class="on">${icon('pen')}<span>${T('寫字')}</span></button>
      <button type="button" data-ink="move">${icon('move')}<span>${T('移動')}</span></button>
      <button type="button" data-ink="eraser">${icon('eraser')}<span>${T('橡皮擦')}</span></button>
      <button type="button" data-ink="undo">${icon('undo')}<span>${T('上一筆')}</span></button>
      <button type="button" data-ink="clear">${icon('clear')}<span>${T('重寫')}</span></button>`;
    d.addEventListener('click', e => {
      const b = e.target.closest('[data-ink]'); if (!b) return;
      const a = b.dataset.ink;
      if (a === 'draw' || a === 'move' || a === 'eraser') setMode(a);
      else if (a === 'undo') inkUndo();
      else if (a === 'clear') inkClear();
    });
    doc.body.appendChild(d); INK.dock = d; return d;
  }
  function setMode(m) {
    INK.mode = m;
    dockEl().querySelectorAll('[data-ink="draw"],[data-ink="move"],[data-ink="eraser"]').forEach(x => x.classList.toggle('on', x.dataset.ink === m));
    doc.body.classList.toggle('hw-draw', m !== 'move');
  }
  function sheetOf(paper) { return INK.sheets.find(s => s.paper === paper); }
  // 每一張紙蓋一層透明畫布，筆跡跟著紙的位置
  function attach(paper) {
    if (sheetOf(paper)) return;
    const cv = doc.createElement('canvas'); cv.className = 'hwc';
    if (getComputedStyle(paper).position === 'static') paper.style.position = 'relative';
    paper.appendChild(cv);
    const S = { paper, cv, strokes: [], pending: [], timer: 0 };
    const fit = () => {
      const r = paper.getBoundingClientRect(), dpr = root.devicePixelRatio || 1;
      cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr);
      S.g = cv.getContext('2d'); S.g.setTransform(dpr, 0, 0, dpr, 0, 0); S.w = r.width; S.h = r.height; draw();
    };
    const draw = () => {
      const g = S.g; if (!g) return;
      g.clearRect(0, 0, S.w, S.h); g.lineCap = 'round'; g.lineJoin = 'round';
      S.strokes.forEach(s => {
        g.strokeStyle = s.tag && s.tag.bad ? '#d2352c' : getComputedStyle(paper).getPropertyValue('--ink') || '#223';
        g.lineWidth = 3.6; g.beginPath(); g.moveTo(s.pts[0][0], s.pts[0][1]); s.pts.forEach(p => g.lineTo(p[0], p[1])); g.stroke();
      });
    };
    S.fit = fit; S.draw = draw;
    const ro = new ResizeObserver(fit); ro.observe(paper); S.ro = ro;
    let cur = null, pens = new Map(), pan = null, t0 = 0;
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', e => {
      pens.set(e.pointerId, [e.clientX, e.clientY]);
      if (pens.size >= 2) { // 兩根手指：捲動
        if (cur && cur.pts) { S.strokes.splice(S.strokes.indexOf(cur), 1); draw(); }
        cur = null; pan = { y: [...pens.values()].reduce((a, p) => a + p[1], 0) / pens.size }; return;
      }
      e.preventDefault(); cv.setPointerCapture(e.pointerId); t0 = Date.now();
      if (INK.mode === 'eraser') { cur = 'erase'; inkErase(S, pos(e)); return; }
      clearTimeout(S.timer);
      cur = { pts: [pos(e)] }; S.strokes.push(cur); INK.last = S;
    });
    cv.addEventListener('pointermove', e => {
      if (pens.has(e.pointerId)) pens.set(e.pointerId, [e.clientX, e.clientY]);
      if (pan) { const y = [...pens.values()].reduce((a, p) => a + p[1], 0) / pens.size; root.scrollBy(0, pan.y - y); pan.y = y; return; }
      if (!cur) return;
      if (cur === 'erase') { inkErase(S, pos(e)); return; }
      const p = pos(e), q = cur.pts[cur.pts.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 1.5) {
        cur.pts.push(p); const g = S.g;
        g.strokeStyle = getComputedStyle(paper).getPropertyValue('--ink') || '#223'; g.lineWidth = 3.6; g.lineCap = 'round';
        g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(p[0], p[1]); g.stroke();
      }
    });
    const up = e => {
      pens.delete(e.pointerId);
      if (pan) { if (!pens.size) pan = null; return; }
      const s = cur; cur = null;
      if (!s || s === 'erase') return;
      const b = bbox(s.pts);
      // 點一下：當作按下面的按鈕（例如念題目、圈好了、數字格）
      if (Math.max(b.w, b.h) < 12 && Date.now() - t0 < 400) {
        S.strokes.splice(S.strokes.indexOf(s), 1); draw();
        const r = cv.getBoundingClientRect(), x = r.left + s.pts[0][0], y = r.top + s.pts[0][1];
        cv.style.pointerEvents = 'none'; const el = doc.elementFromPoint(x, y); cv.style.pointerEvents = '';
        if (INK.tapHandler) INK.tapHandler(el, paper);
        return;
      }
      S.pending.push(s);
      clearTimeout(S.timer);
      S.timer = setTimeout(() => interpret(S), 650);
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    INK.sheets.push(S);
    requestAnimationFrame(fit);
  }
  // 一組筆畫（停下來 0.65 秒算一組）交給頁面判斷是勾哪裡、圈哪裡、連哪裡
  function interpret(S) {
    const group = S.pending.splice(0);
    if (!group.length || !INK.handler) return;
    const r = S.cv.getBoundingClientRect();
    const strokes = group.map(s => s.pts.map(p => [p[0] + r.left, p[1] + r.top]));
    const all = strokes.flat(), b = bbox(all);
    const info = { strokes, shape: markShape(strokes), box: b, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2,
      poly: strokes.reduce((m, x) => plen(x) > plen(m) ? x : m, strokes[0]), start: strokes[0][0], end: strokes[strokes.length - 1][strokes[strokes.length - 1].length - 1] };
    const res = INK.handler(S.paper, info);
    if (res && res.remove) { group.forEach(s => S.strokes.splice(S.strokes.indexOf(s), 1)); S.draw(); return; }
    if (res && res.tag) { group.forEach(s => { s.tag = res.tag; }); S.draw(); }
  }
  function inkErase(S, p) {
    const n = S.strokes.length;
    S.strokes = S.strokes.filter(s => {
      const hit = s.pts.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 16);
      if (hit && s.tag && s.tag.undo && !S.strokes.some(o => o !== s && o.tag === s.tag && !o.gone)) s.tag.undo();
      if (hit) s.gone = true;
      return !hit;
    });
    if (S.strokes.length !== n) S.draw();
  }
  function inkUndo() {
    const S = INK.last || INK.sheets.find(x => x.strokes.length); if (!S || !S.strokes.length) return;
    const s = S.strokes.pop(); s.gone = true;
    if (s.tag && s.tag.undo && !S.strokes.some(o => o.tag === s.tag)) s.tag.undo();
    S.draw();
  }
  // 重寫：清掉最後寫的那一張紙上的筆跡（模擬考寫的答案也一起擦掉）
  function inkClear() {
    const S = INK.last; if (!S) return;
    const tags = new Set(S.strokes.map(s => s.tag).filter(Boolean));
    tags.forEach(t => t.undo && t.undo());
    S.strokes = []; S.pending = []; S.draw();
  }
  function inkStart(papers, handler, tapHandler) {
    inkStop(); INK.handler = handler; INK.tapHandler = tapHandler;
    papers.forEach(attach);
    dockEl().hidden = false; setMode(INK.mode === 'move' ? 'move' : 'draw');
  }
  function inkStop() {
    INK.sheets.forEach(S => { S.ro.disconnect(); S.cv.remove(); clearTimeout(S.timer); });
    INK.sheets = []; INK.last = null;
    if (INK.dock) INK.dock.hidden = true;
    doc.body.classList.remove('hw-draw');
  }

  root.HW = {
    config(o) { if (o.T) T = o.T; if (o.ZY) ZY = o.ZY; },
    pad, ask, close: closePad, loadStrokes,
    ink: { start: inkStart, stop: inkStop, setMode, inPoly },
    recog: { classify, normalize, digits: s => classify(s, DIGIT_T), zhuyin: s => classify(s, zhuyinTemplates()), tone: toneOf, shape: markShape, DIGIT_SHAPES, zhuyinTemplates }
  };
})(typeof window !== 'undefined' ? window : globalThis);
