/*
 * 原版試卷報讀：版面分析模組
 *
 * 只負責「決定閱讀順序與要念的文字」，完全不改動 PDF 的版面。
 * 輸入 pdf.js 的 textContent 與 viewport，輸出：
 *   glyphs    每個字在頁面上的位置（viewport scale=1 座標，y 向下）
 *   sentences 依閱讀順序排列的句子，每句記錄它包含哪些字，供點讀與高亮
 *
 * 支援直書（由右而左、由上而下）與橫書，並辨識國小試卷常見的注音字型：
 *   ruby        國字旁附注音的字型（如 StdKaiZuinn）
 *   zhuyin-only 畫面只顯示注音、文字層卻是國字的字型（如 ZhuYinNR），多用於「看注音寫國字」
 *   target      注音試卷中以「」框起、沒有注音的國字，多用於「看國字寫注音」
 * 後兩者若照文字層直接念出，可能洩漏答案，因此交由 buildSpeech 依設定處理。
 *
 * 同時可在瀏覽器（window.PdfReaderLayout）與 Node（module.exports）使用。
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.PdfReaderLayout = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const CJK_RE = /[㐀-鿿豈-﫿]/;
    const BOPOMOFO_RE = /[㄀-ㄯㆠ-ㆿˊˇˋ˙]/;
    const LATIN_RE = /[A-Za-z0-9]/;
    const SENTENCE_END_RE = /[。！？；!?;]/;
    const SILENT_RE = /[\s↓→←↑•●○◎▲△˙·‧（）()［］\[\]〔〕|｜]/;
    const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';
    const HEADING_RE = /^[一二三四五六七八九十]{1,3}[、．.]/;
    const OPEN_QUOTE = '「『';
    const CLOSE_QUOTE = '」』';

    function classifyFont(fontName) {
        const name = String(fontName || '').replace(/^[A-Z]{6}\+/, '');
        if (/zhuyin|zhu-yin|bopomofo|注音/i.test(name) && !/kai|ming|sung|song|hei|zuinn/i.test(name)) {
            return 'zhuyin-only';
        }
        if (/zuinn|zhuyin|bopomofo|注音/i.test(name)) {
            return 'ruby';
        }
        return 'plain';
    }

    function median(values, fallback) {
        if (!values.length) return fallback;
        const sorted = values.slice().sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
    }

    function overlap(a0, a1, b0, b1) {
        return Math.min(a1, b1) - Math.max(a0, b0);
    }

    /*
     * 把 pdf.js 的文字項目拆成逐字的 glyph，座標轉成 viewport（scale=1）座標。
     * fontInfo: { [loadedName]: 真實字型名稱 }，可省略。
     */
    function extractGlyphs(textContent, viewport, fontInfo) {
        const glyphs = [];
        const styles = textContent.styles || {};
        textContent.items.forEach((item) => {
            if (!item || typeof item.str !== 'string' || !item.str.length || !item.transform) return;
            const chars = Array.from(item.str);
            const [a, b, c, d, e, f] = item.transform;
            const fontScaleX = Math.hypot(a, b) || 1;
            const fontScaleY = Math.hypot(c, d) || 1;
            const style = styles[item.fontName] || {};
            const ascent = typeof style.ascent === 'number' && style.ascent > 0 ? style.ascent : 0.88;
            const descent = typeof style.descent === 'number' ? style.descent : -0.12;
            const ux = a / fontScaleX;
            const uy = b / fontScaleX;
            const vx = c / fontScaleY;
            const vy = d / fontScaleY;
            const realFont = (fontInfo && fontInfo[item.fontName]) || item.fontName;
            const kind = classifyFont(realFont);
            const vertical = Boolean(style.vertical);
            const totalAdvance = vertical ? (item.height || fontScaleY * chars.length) : (item.width || fontScaleX * 0.5 * chars.length);
            const step = totalAdvance / chars.length;

            chars.forEach((ch, index) => {
                let corners;
                if (vertical) {
                    // 直排字型：字沿著 -v 方向往下排
                    const top = -step * index;
                    const bottom = -step * (index + 1);
                    const half = fontScaleX / 2;
                    corners = [
                        [e - ux * half + vx * top, f - uy * half + vy * top],
                        [e + ux * half + vx * top, f + uy * half + vy * top],
                        [e - ux * half + vx * bottom, f - uy * half + vy * bottom],
                        [e + ux * half + vx * bottom, f + uy * half + vy * bottom]
                    ];
                } else {
                    const s0 = step * index;
                    const s1 = step * (index + 1);
                    const lo = descent * fontScaleY;
                    const hi = ascent * fontScaleY;
                    corners = [
                        [e + ux * s0 + vx * lo, f + uy * s0 + vy * lo],
                        [e + ux * s1 + vx * lo, f + uy * s1 + vy * lo],
                        [e + ux * s0 + vx * hi, f + uy * s0 + vy * hi],
                        [e + ux * s1 + vx * hi, f + uy * s1 + vy * hi]
                    ];
                }
                const points = corners.map(([px, py]) => viewport.convertToViewportPoint(px, py));
                const xs = points.map((p) => p[0]);
                const ys = points.map((p) => p[1]);
                const scale = viewport.scale || 1;
                glyphs.push({
                    ch,
                    x0: Math.min(...xs) / scale,
                    x1: Math.max(...xs) / scale,
                    y0: Math.min(...ys) / scale,
                    y1: Math.max(...ys) / scale,
                    size: fontScaleY,
                    font: realFont,
                    kind
                });
            });
        });

        // 去掉空白；去掉明顯比正文小的注音（另附在國字旁的 ruby 注音），避免一字念兩次
        const sizes = glyphs.filter((g) => CJK_RE.test(g.ch)).map((g) => g.size);
        const bodySize = median(sizes, median(glyphs.map((g) => g.size), 12));
        return glyphs
            .filter((g) => g.ch.trim().length > 0 && g.x1 > g.x0 && g.y1 > g.y0)
            .filter((g) => !(BOPOMOFO_RE.test(g.ch) && g.size < bodySize * 0.75))
            .map((g, index) => Object.assign(g, { id: index }));
    }

    function glyphSize(g) {
        // 用字型大小；以框的短邊做保險，避免異常大的 transform
        return Math.max(1, Math.min(g.size, Math.max(g.x1 - g.x0, g.y1 - g.y0)));
    }

    /*
     * 找出相鄰的字並決定每個字是直書還是橫書，串成「行」（chain）。
     */
    function buildChains(glyphs) {
        const n = glyphs.length;
        const down = new Array(n).fill(-1);
        const right = new Array(n).fill(-1);

        // 空間格點索引：只比對附近的字，避免字數多時變慢
        const cell = Math.max(4, median(glyphs.map(glyphSize), 12) * 2);
        const grid = new Map();
        const cellsOf = (g, pad) => {
            const keys = [];
            for (let cx = Math.floor((g.x0 - pad) / cell); cx <= Math.floor((g.x1 + pad) / cell); cx += 1) {
                for (let cy = Math.floor((g.y0 - pad) / cell); cy <= Math.floor((g.y1 + pad) / cell); cy += 1) {
                    keys.push(`${cx},${cy}`);
                }
            }
            return keys;
        };
        glyphs.forEach((g, index) => {
            cellsOf(g, 0).forEach((key) => {
                if (!grid.has(key)) grid.set(key, []);
                grid.get(key).push(index);
            });
        });

        for (let i = 0; i < n; i += 1) {
            const g = glyphs[i];
            const sg = glyphSize(g);
            let bestDown = -1;
            let bestDownGap = Infinity;
            let bestRight = -1;
            let bestRightGap = Infinity;
            const nearby = new Set();
            cellsOf(g, sg).forEach((key) => (grid.get(key) || []).forEach((k) => nearby.add(k)));
            for (const k of nearby) {
                if (k === i) continue;
                const h = glyphs[k];
                const s = Math.min(sg, glyphSize(h));
                // 往下
                const xo = overlap(g.x0, g.x1, h.x0, h.x1);
                if (xo >= 0.5 * Math.min(g.x1 - g.x0, h.x1 - h.x0)) {
                    const gap = h.y0 - g.y1;
                    if (gap > -0.35 * s && gap < 0.6 * s && (h.y0 + h.y1) > (g.y0 + g.y1) && gap < bestDownGap) {
                        bestDownGap = gap;
                        bestDown = k;
                    }
                }
                // 往右
                const yo = overlap(g.y0, g.y1, h.y0, h.y1);
                if (yo >= 0.5 * Math.min(g.y1 - g.y0, h.y1 - h.y0)) {
                    const gap = h.x0 - g.x1;
                    if (gap > -0.35 * s && gap < 0.6 * s && (h.x0 + h.x1) > (g.x0 + g.x1) && gap < bestRightGap) {
                        bestRightGap = gap;
                        bestRight = k;
                    }
                }
            }
            down[i] = bestDown;
            right[i] = bestRight;
        }

        // 只保留互為最近的連結
        const up = new Array(n).fill(-1);
        const left = new Array(n).fill(-1);
        const keepBest = (from, to, back, axisGap) => {
            for (let i = 0; i < n; i += 1) {
                const k = from[i];
                if (k < 0) continue;
                if (back[k] < 0 || axisGap(i, k) < axisGap(back[k], k)) back[k] = i;
            }
            for (let i = 0; i < n; i += 1) {
                if (from[i] >= 0 && back[from[i]] !== i) from[i] = -1;
            }
        };
        keepBest(down, down, up, (i, k) => glyphs[k].y0 - glyphs[i].y1);
        keepBest(right, right, left, (i, k) => glyphs[k].x0 - glyphs[i].x1);

        // 每個字同時屬於一條橫向串列與一條直向串列，取較長的那條決定方向。
        // 這樣兩端對齊的橫書段落，行尾剛好上下對齊的幾個字不會被誤判成直書。
        const runLength = (forward, backward) => {
            const length = new Array(n).fill(0);
            for (let i = 0; i < n; i += 1) {
                if (length[i] || backward[i] >= 0) continue;
                const members = [];
                const seen = new Set();
                for (let cur = i; cur >= 0 && !seen.has(cur); cur = forward[cur]) {
                    seen.add(cur);
                    members.push(cur);
                }
                members.forEach((idx) => { length[idx] = members.length; });
            }
            for (let i = 0; i < n; i += 1) if (!length[i]) length[i] = 1;
            return length;
        };
        const vLen = runLength(down, up);
        const hLen = runLength(right, left);

        let vTotal = 0;
        let hTotal = 0;
        for (let i = 0; i < n; i += 1) {
            if (vLen[i] > hLen[i]) vTotal += 1;
            else if (hLen[i] > vLen[i]) hTotal += 1;
        }
        const dominant = vTotal > hTotal ? 'V' : 'H';
        const other = dominant === 'V' ? 'H' : 'V';
        const orient = new Array(n);
        for (let i = 0; i < n; i += 1) {
            orient[i] = vLen[i] > hLen[i] ? 'V' : (hLen[i] > vLen[i] ? 'H' : dominant);
            // 和主要方向相反、又只有兩個字以下的串列，多半只是碰巧對齊
            const len = other === 'V' ? vLen[i] : hLen[i];
            if (orient[i] === other && len <= 2) orient[i] = dominant;
            // 直書中的阿拉伯數字（如「113」）多半是橫向排列
            if (hLen[i] > 1 && LATIN_RE.test(glyphs[i].ch) &&
                [right[i], left[i]].some((k) => k >= 0 && LATIN_RE.test(glyphs[k].ch))) {
                orient[i] = 'H';
            }
        }

        const visited = new Array(n).fill(false);
        const chains = [];
        const startOf = (i) => {
            let cur = i;
            const prev = orient[i] === 'V' ? up : left;
            const guard = new Set([cur]);
            while (prev[cur] >= 0 && orient[prev[cur]] === orient[i] && !guard.has(prev[cur])) {
                cur = prev[cur];
                guard.add(cur);
            }
            return cur;
        };
        for (let i = 0; i < n; i += 1) {
            if (visited[i]) continue;
            const o = orient[i];
            const next = o === 'V' ? down : right;
            let cur = startOf(i);
            const members = [];
            while (cur >= 0 && !visited[cur] && orient[cur] === o) {
                visited[cur] = true;
                members.push(cur);
                cur = next[cur];
            }
            if (!members.length) {
                visited[i] = true;
                members.push(i);
            }
            chains.push(makeChain(members.map((idx) => glyphs[idx]), o));
        }
        return { chains, dominant };
    }

    function makeChain(members, orientation) {
        const box = members.reduce((acc, g) => ({
            x0: Math.min(acc.x0, g.x0),
            y0: Math.min(acc.y0, g.y0),
            x1: Math.max(acc.x1, g.x1),
            y1: Math.max(acc.y1, g.y1)
        }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
        return Object.assign(box, {
            glyphs: members,
            orientation,
            size: median(members.map(glyphSize), 12)
        });
    }

    function isOpenBracket(ch) {
        return '（(［[〔'.includes(ch);
    }

    function isCloseBracket(ch) {
        return '）)］]〕'.includes(ch);
    }

    /*
     * 把同一欄（直書）或同一列（橫書）中被切開的片段接回來：
     *   緊鄰或重疊的片段（如直書中的橫向數字、作答括號「）（」）
     *   作答用的空白括號「（　　）」，中間沒有任何字
     */
    function joinLines(chains, dominant) {
        const list = chains.slice();
        const vertical = dominant === 'V';
        const lo = vertical ? 'y0' : 'x0';
        const hi = vertical ? 'y1' : 'x1';
        const crossLo = vertical ? 'x0' : 'y0';
        const crossHi = vertical ? 'x1' : 'y1';

        const emptyBetween = (a, b) => {
            const c0 = Math.max(a[crossLo], b[crossLo]);
            const c1 = Math.min(a[crossHi], b[crossHi]);
            const g0 = a[hi];
            const g1 = b[lo];
            if (g1 <= g0) return true;
            return !list.some((other) => other !== a && other !== b &&
                overlap(other[crossLo], other[crossHi], c0, c1) > 0 &&
                overlap(other[lo], other[hi], g0, g1) > 0);
        };

        let changed = true;
        while (changed) {
            changed = false;
            for (let i = 0; i < list.length && !changed; i += 1) {
                const a = list[i];
                const lastCh = a.glyphs[a.glyphs.length - 1].ch;
                let best = -1;
                let bestGap = Infinity;
                for (let k = 0; k < list.length; k += 1) {
                    if (k === i) continue;
                    const b = list[k];
                    const s = Math.max(a.size, b.size);
                    const co = overlap(a[crossLo], a[crossHi], b[crossLo], b[crossHi]);
                    if (co < 0.5 * Math.min(a[crossHi] - a[crossLo], b[crossHi] - b[crossLo])) continue;
                    if ((b[lo] + b[hi]) <= (a[lo] + a[hi])) continue;
                    const gap = b[lo] - a[hi];
                    if (gap < -0.7 * s) continue;
                    const firstCh = b.glyphs[0].ch;
                    const ok = gap < 0.6 * s || (isOpenBracket(lastCh) && isCloseBracket(firstCh) && gap < 12 * s);
                    if (ok && gap < bestGap && emptyBetween(a, b)) {
                        bestGap = gap;
                        best = k;
                    }
                }
                if (best >= 0) {
                    const b = list[best];
                    const merged = makeChain(a.glyphs.concat(b.glyphs), dominant);
                    list.splice(Math.max(i, best), 1);
                    list.splice(Math.min(i, best), 1, merged);
                    changed = true;
                }
            }
        }
        return list;
    }

    /*
     * 遞迴 XY-cut 決定各行的先後：
     *   水平切（上下分區）→ 上面先念
     *   垂直切（左右分區）→ 直書由右而左、橫書由左而右
     */
    function orderChains(chains, dominant) {
        const bodySize = median(chains.map((c) => c.size), 12);

        function gaps(items, lo, hi) {
            const spans = items.map((it) => [it[lo], it[hi]]).sort((p, q) => p[0] - q[0]);
            const result = [];
            let end = spans[0][1];
            for (let i = 1; i < spans.length; i += 1) {
                if (spans[i][0] > end) {
                    result.push({ at: (end + spans[i][0]) / 2, size: spans[i][0] - end });
                }
                end = Math.max(end, spans[i][1]);
            }
            return result;
        }

        function localDominant(items) {
            let v = 0;
            let h = 0;
            items.forEach((it) => {
                const weight = it.glyphs.length;
                if (weight < 2) return;
                if (it.orientation === 'V') v += weight; else h += weight;
            });
            if (v === h) return dominant;
            return v > h ? 'V' : 'H';
        }

        function fallbackSort(items, dir) {
            return items.slice().sort((p, q) => {
                if (dir === 'V') {
                    const xo = overlap(p.x0, p.x1, q.x0, q.x1);
                    if (xo > 0.3 * Math.min(p.x1 - p.x0, q.x1 - q.x0)) return p.y0 - q.y0;
                    return q.x1 - p.x1;
                }
                const yo = overlap(p.y0, p.y1, q.y0, q.y1);
                if (yo > 0.3 * Math.min(p.y1 - p.y0, q.y1 - q.y0)) return p.x0 - q.x0;
                return p.y0 - q.y0;
            });
        }

        function cut(items) {
            if (items.length <= 1) return items;
            const dir = localDominant(items);
            const yGaps = gaps(items, 'y0', 'y1');
            const xGaps = gaps(items, 'x0', 'x1');
            const bestY = yGaps.reduce((m, g) => (!m || g.size > m.size ? g : m), null);
            const bestX = xGaps.reduce((m, g) => (!m || g.size > m.size ? g : m), null);
            // 沿著行進方向（橫書上下、直書左右）的空隙只要存在就能切；
            // 垂直於行進方向的切割代表分欄，至少要約一個字寬，避免把同一行從字距切開
            const minGap = 0.05 * bodySize;
            const gutter = 0.8 * bodySize;
            const yMin = dir === 'V' ? gutter : minGap;
            const xMin = dir === 'H' ? gutter : minGap;
            const yScore = bestY && bestY.size > yMin ? bestY.size * (dir === 'V' ? 1.6 : 1) : 0;
            const xScore = bestX && bestX.size > xMin ? bestX.size * (dir === 'H' ? 1.6 : 1) : 0;
            if (!yScore && !xScore) return fallbackSort(items, dir);
            if (yScore >= xScore) {
                const top = items.filter((it) => (it.y0 + it.y1) / 2 < bestY.at);
                const bottom = items.filter((it) => (it.y0 + it.y1) / 2 >= bestY.at);
                return cut(top).concat(cut(bottom));
            }
            const leftPart = items.filter((it) => (it.x0 + it.x1) / 2 < bestX.at);
            const rightPart = items.filter((it) => (it.x0 + it.x1) / 2 >= bestX.at);
            return dir === 'V'
                ? cut(rightPart).concat(cut(leftPart))
                : cut(leftPart).concat(cut(rightPart));
        }

        return cut(chains);
    }

    /*
     * 判斷下一行是否接續目前這一欄／列（換行接續），用來把跨欄的句子接起來。
     * line 是目前這一欄（可能由同欄多個片段組成）的範圍，segmentEnd 是本段目前最深的位置。
     */
    function continues(line, next, segmentEnd) {
        const s = Math.max(line.size, next.size);
        if (HEADING_RE.test(next.glyphs.map((g) => g.ch).slice(0, 4).join(''))) return false;
        if (line.orientation === 'V' && next.orientation === 'V') {
            const columnGap = line.x0 - next.x1;
            const bottom = Math.max(segmentEnd, next.y1);
            return columnGap > -0.3 * s && columnGap < 1.4 * s &&
                line.y1 >= bottom - 1.5 * s &&
                next.y0 > line.y0 - 3.5 * s &&
                next.y0 < line.y0 + 8 * s;
        }
        if (line.orientation === 'H' && next.orientation === 'H') {
            const lineGap = next.y0 - line.y1;
            const end = Math.max(segmentEnd, next.x1);
            return lineGap > -0.3 * s && lineGap < 1.2 * s &&
                line.x1 >= end - 2 * s &&
                next.x0 > line.x0 - 3.5 * s &&
                next.x0 < line.x0 + 8 * s;
        }
        const dx = Math.max(0, Math.max(line.x0, next.x0) - Math.min(line.x1, next.x1));
        const dy = Math.max(0, Math.max(line.y0, next.y0) - Math.min(line.y1, next.y1));
        return dx < 0.6 * s && dy < 0.6 * s;
    }

    function sameLine(line, next) {
        const s = Math.max(line.size, next.size);
        if (line.orientation === 'V') {
            const xo = overlap(line.x0, line.x1, next.x0, next.x1);
            return xo > 0.3 * Math.min(line.x1 - line.x0, next.x1 - next.x0) &&
                next.y0 > line.y0 && next.y0 - line.y1 < 6 * s;
        }
        const yo = overlap(line.y0, line.y1, next.y0, next.y1);
        return yo > 0.3 * Math.min(line.y1 - line.y0, next.y1 - next.y0) &&
            next.x0 > line.x0 && next.x0 - line.x1 < 6 * s;
    }

    const DIGIT_RE = /^[0-9０-９]$/;

    /*
     * 標記每一欄／列開頭的題號（如「1」「(1)」「1.」，前面可以有作答括號「（　）」），
     * 朗讀時在題號後停頓、字幕加空格，並從題號處另起一句。
     * 沒有括號或標點的純數字，需與後面的字有明顯間距或字級不同，避免把「25顆糖果」當成題號。
     */
    function markQuestionNumbers(chains) {
        chains.forEach((chain, chainIndex) => {
            const list = chain.glyphs;
            const following = chains[chainIndex + 1];
            let i = 0;
            if (list.length > 2 && isOpenBracket(list[0].ch) && isCloseBracket(list[1].ch)) i = 2;
            const bracketed = list[i] && isOpenBracket(list[i].ch);
            if (bracketed) i += 1;
            const digitsFrom = i;
            while (i < list.length && DIGIT_RE.test(list[i].ch) && i - digitsFrom < 2) i += 1;
            if (i === digitsFrom) {
                // 連連看、排序題的注音標號（如「˙ㄅ沒料想到」「ㄆ發現狗毛…」）
                let k = 0;
                while (k < list.length && '˙•·‧●'.includes(list[k].ch)) k += 1;
                const label = list[k];
                const after = list[k + 1];
                if (!bracketed && label && /[ㄅ-ㄩ]/.test(label.ch) && after && CJK_RE.test(after.ch)) {
                    label.qnumEnd = true;
                    list[0].sentenceStart = true;
                }
                return;
            }
            if (bracketed) {
                if (!list[i] || !isCloseBracket(list[i].ch)) return;
                i += 1;
            }
            let punctuated = bracketed;
            if (list[i] && '.．、'.includes(list[i].ch)) {
                punctuated = true;
                i += 1;
            }
            // 題號後面可能被空白隔成下一段（如橫書「1. 小明…」）
            // 只有帶標點或括號的題號才往下一段找，避免把「有 25 顆」的數字當成題號
            const next = list[i] || (i === list.length && punctuated && following ? following.glyphs[0] : null);
            if (!next || !(CJK_RE.test(next.ch) || OPEN_QUOTE.includes(next.ch) || BOPOMOFO_RE.test(next.ch) ||
                isOpenBracket(next.ch) || '…⋯'.includes(next.ch))) return;
            const last = list[i - 1];
            if (!punctuated) {
                const s = Math.min(glyphSize(last), glyphSize(next));
                const gap = chain.orientation === 'V' ? next.y0 - last.y1 : next.x0 - last.x1;
                const sizeDiffers = Math.abs(last.size - next.size) > 0.1 * Math.max(last.size, next.size);
                if (gap < 0.12 * s && !sizeDiffers) return;
            }
            last.qnumEnd = true;
            list[0].sentenceStart = true;
        });
    }

    function markSpecialRuns(orderedGlyphs) {
        const cjk = orderedGlyphs.filter((g) => CJK_RE.test(g.ch));
        const rubyCount = cjk.filter((g) => g.kind === 'ruby' || g.kind === 'zhuyin-only').length;
        const zhuyinDocument = cjk.length > 0 && rubyCount / cjk.length >= 0.3;
        if (!zhuyinDocument) return;
        for (let i = 0; i < orderedGlyphs.length; i += 1) {
            if (!OPEN_QUOTE.includes(orderedGlyphs[i].ch)) continue;
            let j = i + 1;
            while (j < orderedGlyphs.length && j - i <= 6 && !CLOSE_QUOTE.includes(orderedGlyphs[j].ch)) j += 1;
            if (j >= orderedGlyphs.length || !CLOSE_QUOTE.includes(orderedGlyphs[j].ch) || j === i + 1) continue;
            const inner = orderedGlyphs.slice(i + 1, j);
            if (inner.every((g) => CJK_RE.test(g.ch) && g.kind === 'plain')) {
                inner.forEach((g) => { g.role = 'target'; });
            }
        }
    }

    function splitSentences(segment) {
        const sentences = [];
        let current = [];
        const flush = () => {
            if (current.some((g) => !SILENT_RE.test(g.ch))) sentences.push(current);
            current = [];
        };
        segment.forEach((g, index) => {
            // 選項 ①②③④ 各自成為一個點讀單位
            if (CIRCLED.includes(g.ch) && current.length) flush();
            // 題號另起一句（如「…共十四分」與「1連出正確的解釋」分開）
            if (g.sentenceStart && current.length) flush();
            current.push(g);
            const nextCh = segment[index + 1] ? segment[index + 1].ch : '';
            if (SENTENCE_END_RE.test(g.ch) && !CLOSE_QUOTE.includes(nextCh) && !'）)'.includes(nextCh)) {
                flush();
            } else if (CLOSE_QUOTE.includes(g.ch) && index > 0 && SENTENCE_END_RE.test(segment[index - 1].ch)) {
                flush();
            } else if (current.length >= 90 && /[，、,]/.test(g.ch)) {
                flush();
            }
        });
        flush();
        return sentences;
    }

    function analyzePage(textContent, viewport, fontInfo) {
        const glyphs = extractGlyphs(textContent, viewport, fontInfo);
        if (!glyphs.length) {
            return { glyphs, chains: [], sentences: [], dominant: 'H' };
        }
        const built = buildChains(glyphs);
        const dominant = built.dominant;
        const pageWidth = viewport.width / (viewport.scale || 1);
        const pageHeight = viewport.height / (viewport.scale || 1);
        const chains = joinLines(built.chains, dominant).filter((chain) => {
            // 頁首／頁尾的頁碼不念，也不打斷句子
            const text = chain.glyphs.map((g) => g.ch).join('');
            const nearEdge = chain.y1 < pageHeight * 0.06 || chain.y0 > pageHeight * 0.94;
            const pageNumber = /^[-－—]?\s*\d{1,3}\s*[-－—]?$/.test(text) && nearEdge &&
                Math.abs((chain.x0 + chain.x1) / 2 - pageWidth / 2) < pageWidth * 0.2;
            if (pageNumber) chain.glyphs.forEach((g) => { g.role = 'page-number'; });
            return !pageNumber;
        });
        const ordered = orderChains(chains, dominant);

        // 依閱讀順序把行接成段（segment）
        const segments = [];
        let currentSegment = null;
        let line = null;
        let segmentEnd = 0;
        const endOf = (box) => (box.orientation === 'V' ? box.y1 : box.x1);
        ordered.forEach((chain, index) => {
            chain.order = index;
            const heading = HEADING_RE.test(chain.glyphs.map((g) => g.ch).slice(0, 4).join(''));
            if (line && !heading && sameLine(line, chain)) {
                currentSegment.push(...chain.glyphs);
                line = Object.assign({}, line, {
                    x0: Math.min(line.x0, chain.x0),
                    y0: Math.min(line.y0, chain.y0),
                    x1: Math.max(line.x1, chain.x1),
                    y1: Math.max(line.y1, chain.y1)
                });
            } else if (line && continues(line, chain, segmentEnd)) {
                currentSegment.push(...chain.glyphs);
                line = Object.assign({}, chain);
            } else {
                currentSegment = chain.glyphs.slice();
                segments.push(currentSegment);
                line = Object.assign({}, chain);
                segmentEnd = 0;
            }
            segmentEnd = Math.max(segmentEnd, endOf(line));
        });

        markQuestionNumbers(ordered);
        const orderedGlyphs = segments.flat();
        markSpecialRuns(orderedGlyphs);

        const sentences = [];
        segments.forEach((segment) => {
            splitSentences(segment).forEach((list) => {
                sentences.push({ index: sentences.length, glyphs: list });
            });
        });
        sentences.forEach((sentence) => {
            sentence.glyphs.forEach((g) => { g.sentence = sentence.index; });
            sentence.box = sentence.glyphs.reduce((acc, g) => ({
                x0: Math.min(acc.x0, g.x0),
                y0: Math.min(acc.y0, g.y0),
                x1: Math.max(acc.x1, g.x1),
                y1: Math.max(acc.y1, g.y1)
            }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
        });
        return { glyphs, chains: ordered, sentences, dominant };
    }

    const PUNCTUATION_NAMES = {
        '、': '頓號', '，': '逗號', ',': '逗號', '。': '句號', '？': '問號', '?': '問號',
        '！': '驚嘆號', '!': '驚嘆號', '：': '冒號', ':': '冒號', '；': '分號', ';': '分號',
        '「': '上引號', '」': '下引號', '『': '雙上引號', '』': '雙下引號',
        '……': '刪節號', '…': '刪節號', '——': '破折號', '—': '破折號', '‧': '間隔號', '·': '間隔號',
        '《': '書名號', '》': '書名號', '〈': '篇名號', '〉': '篇名號'
    };

    /*
     * 把一串字轉成要給語音念的文字。
     * options.targetMode      'mask'（預設，念「這個字」）| 'read'
     * options.zhuyinOnlyMode  'read'（預設，念出讀音）    | 'mask'（念「注音」）
     * options.display         true 時改為產生「畫面字幕」：只呈現卷面上看得到的內容，
     *                         只顯示注音的格子以〔注音〕表示，避免字幕洩漏國字答案
     */
    function buildSpeech(glyphList, options) {
        const opts = Object.assign({ targetMode: 'mask', zhuyinOnlyMode: 'read', display: false }, options || {});
        if (opts.display) {
            opts.targetMode = 'read';
            opts.zhuyinOnlyMode = 'display';
        }
        // 整個選項只有標點（如標點符號選擇題 ①、②，③？），念出標點名稱
        const core = glyphList.filter((g) => !CIRCLED.includes(g.ch) && g.ch.trim());
        if (!opts.display && core.length && core.length <= 4 && core.every((g) => PUNCTUATION_NAMES[g.ch])) {
            const lead = glyphList.find((g) => CIRCLED.includes(g.ch));
            const prefix = lead ? `${CIRCLED.indexOf(lead.ch) + 1}、` : '';
            return prefix + core.map((g) => PUNCTUATION_NAMES[g.ch]).join('、');
        }

        const parts = [];
        let prev = null;
        let pendingBlank = false;
        for (let i = 0; i < glyphList.length; i += 1) {
            const g = glyphList[i];
            let ch = g.ch;
            // 全形英數轉半形
            if (/[！-～]/.test(ch) && !'（）「」，：；！？'.includes(ch)) {
                ch = String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
            }
            if (g.role === 'target' && opts.targetMode === 'mask') {
                if (!(prev && prev.role === 'target')) parts.push('這個字');
                prev = g;
                continue;
            }
            if (g.kind === 'zhuyin-only' && CJK_RE.test(ch) && opts.zhuyinOnlyMode !== 'read') {
                if (!(prev && prev.kind === 'zhuyin-only')) parts.push(opts.display ? '〔注音〕' : '注音');
                prev = g;
                continue;
            }
            if ('（('.includes(ch)) {
                const close = glyphList[i + 1];
                if (close && '）)'.includes(close.ch)) {
                    parts.push('（空格）');
                    i += 1;
                    prev = close;
                    continue;
                }
            }
            if ('□▢☐＿_'.includes(ch)) {
                if (!pendingBlank) parts.push('空格');
                pendingBlank = true;
                prev = g;
                continue;
            }
            pendingBlank = false;
            const dotAsMark = '˙·‧'.includes(ch) && !(prev && BOPOMOFO_RE.test(prev.ch));
            if ('↓→←↑•●○◎▲△|｜'.includes(ch) || dotAsMark) {
                prev = g;
                continue;
            }
            const circled = CIRCLED.indexOf(ch);
            if (circled >= 0) {
                parts.push(opts.display ? ` ${ch}` : `，${circled + 1}、`);
                prev = g;
                continue;
            }
            if (g.qnumEnd) {
                // 題號與題目之間留間隔：朗讀停頓、字幕空一格
                if ('.．、'.includes(ch)) {
                    parts.push(opts.display ? `${ch} ` : '，');
                } else {
                    parts.push(opts.display ? `${ch} ` : `${ch}，`);
                }
                prev = g;
                continue;
            }
            if (prev && LATIN_RE.test(ch) && LATIN_RE.test(prev.ch.slice(-1))) {
                const s = Math.min(glyphSize(prev), glyphSize(g));
                const gap = Math.max(g.x0 - prev.x1, g.y0 - prev.y1);
                if (gap > 0.2 * s) parts.push(' ');
            }
            parts.push(ch);
            prev = g;
        }
        const joined = parts.join('');
        return (opts.display ? joined : joined.replace(/[「」『』]/g, ''))
            .replace(/（空格）(?=（空格）)/g, '（空格），')
            .replace(/^[，、\s]+/, '')
            .trim();
    }

    return {
        analyzePage,
        buildSpeech,
        classifyFont,
        extractGlyphs
    };
}));
