/* 注音排版（各服務共用）：照課本、考卷的格式
 *
 *  1. 一個音的符號由上往下直排。
 *  2. 二、三、四聲的聲調符號標在最後一個符號的右上方；一聲不標。
 *  3. 輕聲的點標在第一個符號的正上方。
 *  4. 國字的注音直排在國字右邊。
 *  5. 只有注音的詞：一個音接一個音由上往下；句子一行一行由右往左。
 *
 * 聲調符號用畫的（SVG），不靠字型，每台手機的位置、形狀都一樣。
 *
 * 用法（注音的音和音之間用空白隔開，輕聲寫在前面：'ㄇㄚ ˙ㄇㄚ'）：
 *   ZhuyinLayout.syl('ㄇㄠˊ')                 一個音
 *   ZhuyinLayout.word('ㄇㄠ ㄇㄧ')             一個詞，由上往下；{ dir: 'h' } 改成由左往右
 *   ZhuyinLayout.ruby('貓', 'ㄇㄠ')            國字右邊加注音
 *   ZhuyinLayout.sentence('ㄇㄠ ㄇㄧ ㄞˋ ㄔ ㄩˊ 。')  直式句子，每行最多 { per } 個音，由右往左換行
 *   ZhuyinLayout.text('注音是 ㄇㄠˊ ㄧ 喔')    一般文字（會跳脫 HTML）裡的注音換成直式
 *   ZhuyinLayout.apply(元素)                  頁面上已經寫好的說明文字，裡面的注音換成直式
 * syl 的選項：box＝聲調的位置放這段 HTML（例如考聲調的框框），mask＝[第幾個符號, HTML] 換掉一個符號，cls、attr＝加在外層
 * 字型用 CSS 變數 --zy-font（預設跟著外層），國字旁注音的大小用 --zr-size（預設 .4em）。頁面自己的 CSS 會蓋過這裡的預設。
 */
(function (root) {
  'use strict';
  const TONE_OF = { 'ˊ': 2, 'ˇ': 3, 'ˋ': 4 };
  const TONE_NAME = ['', '一聲', '二聲', '三聲', '四聲', '輕聲'];
  const MARK = ['', '', 'ˊ', 'ˇ', 'ˋ', '˙'];
  const PATH = { 2: 'M2.6 8.8 7.6 1.6', 3: 'M1.8 3.2 4.8 8.6 8.6 1.6', 4: 'M2.4 1.6 7.4 8.8' };
  const toneSVG = (t, cls = 'tm') => PATH[t] ? `<svg class="${cls}" viewBox="0 0 10 10" aria-hidden="true"><path d="${PATH[t]}"/></svg>` : '';
  // 聲母？介音？韻母？，前面可以有輕聲點，後面可以有聲調
  const SYL_RE = /^(˙?)([ㄅ-ㄙ]?)([ㄧㄨㄩ]?)([ㄚ-ㄦ]?)([ˊˇˋ˙]?)$/;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 'ㄇㄠˊ' → { b: ['ㄇ','ㄠ'], t: 2 }；輕聲 t = 5
  function parse(s) {
    let b = String(s), t = 1;
    if (b[0] === '˙') { t = 5; b = b.slice(1); }
    const last = b.slice(-1);
    if (TONE_OF[last]) { t = TONE_OF[last]; b = b.slice(0, -1); } else if (last === '˙') { t = 5; b = b.slice(0, -1); }
    return { b: [...b], t };
  }
  function isSyl(s) {
    const m = SYL_RE.exec(s);
    return !!m && !!(m[2] || m[3] || m[4]) && !(m[1] && m[5]);
  }
  const baseOf = s => parse(s).b.join('');
  const withTone = (b, t) => t === 5 ? '˙' + b : b + MARK[t];

  function syl(s, o = {}) {
    const { b, t } = parse(s), last = b.length - 1, hasBox = o.box != null;
    const mark = hasBox ? o.box : toneSVG(t);
    const dot = t === 5 && !hasBox ? '<span class="zl"></span>' : '';
    return `<span class="zv${hasBox ? ' hb' : ''}${o.cls ? ' ' + o.cls : ''}"${o.attr || ''}>${dot}${b.map((c, i) =>
      `<span class="zs">${o.mask && o.mask[0] === i ? o.mask[1] : c}${i === last ? mark : ''}</span>`).join('')}</span>`;
  }
  const sylsOf = z => String(z).split(/\s+/).filter(Boolean);
  // o.each(音, 第幾個) 回傳那個音的 syl 選項
  function word(z, o = {}) {
    return `<span class="zw${o.dir === 'h' ? ' h' : ''}${o.cls ? ' ' + o.cls : ''}">${sylsOf(z).map((s, i) => syl(s, o.each ? o.each(s, i) || {} : {})).join('')}</span>`;
  }
  const ruby = (ch, z, o = {}) => `<span class="zr${o.cls ? ' ' + o.cls : ''}">${esc(ch)}${z ? syl(z, o.syl || {}) : ''}</span>`;

  // 直式標點：逗號、句號、頓號在右上角；冒號、問號、驚嘆號置中
  const VPUNC = { '，': '︐', '。': '︒', '、': '︑', '：': '︓', '；': '︔', '？': '︖', '！': '︕' };
  const punc = c => `<span class="zp">${VPUNC[c] || esc(c)}</span>`;
  // 直式句子：音和標點用空白隔開，'|' 強制換行；每行最多 per 個音，換行優先在標點後面
  function sentence(z, o = {}) {
    const per = o.per || 7, cols = [[]];
    let n = 0;
    sylsOf(z).forEach(tk => {
      if (tk === '|') { cols.push([]); n = 0; return; }
      const isP = !isSyl(tk);
      if (!isP && n >= per) { cols.push([]); n = 0; }
      cols[cols.length - 1].push(isP ? punc(tk) : syl(tk, o.each ? o.each(tk) || {} : {}));
      if (!isP) n++;
      else if (n >= Math.ceil(per / 2) && /[，、；]/.test(tk)) { cols.push([]); n = 0; }
    });
    return `<span class="zsent${o.cls ? ' ' + o.cls : ''}">${cols.filter(c => c.length).map(c => `<span class="zcol">${c.join('')}</span>`).join('')}</span>`;
  }
  // 一般文字裡的注音：連續的音（中間一個空白）當成一個詞，橫著由左往右排，每個音直排。
  // 只有單獨一個符號、沒有聲調的（例如「ㄅ、ㄆ、ㄇ」「中間有沒有ㄧ」）是在說符號本身，保持原樣。
  const RUN = /˙?[ㄅ-ㄩ]+[ˊˇˋ˙]?(?: ˙?[ㄅ-ㄩ]+[ˊˇˋ˙]?)*/g;
  function text(str, o = {}) {
    return esc(str).replace(RUN, run => {
      const tks = run.split(' ');
      if (!tks.every(isSyl) || !tks.some(t => /[ˊˇˋ˙]/.test(t) || baseOf(t).length > 1)) return run;
      return word(run, { dir: o.dir || 'h', cls: 'in' });
    });
  }
  // 頁面上已經寫好的說明文字：把元素裡文字中的注音換成直式（不動 script、style、輸入框）
  function apply(el) {
    if (!el || !root.document) return;
    const SKIP = /^(SCRIPT|STYLE|TEXTAREA|OPTION|SELECT|TITLE)$/;
    const walker = root.document.createTreeWalker(el, 4 /* 文字節點 */, {
      acceptNode: n => SKIP.test(n.parentNode.nodeName) || n.parentNode.closest('.zv,.zw') ? 2 : 1
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const h = text(n.nodeValue);
      if (h === esc(n.nodeValue)) return;
      const box = root.document.createElement('span'); box.innerHTML = h;
      n.replaceWith(...box.childNodes);
    });
  }

  const CSS = `
.zv{display:inline-flex;flex-direction:column;align-items:center;position:relative;line-height:1;padding:0 .48em 0 .04em;
  font-family:var(--zy-font,inherit);font-style:normal;letter-spacing:0;text-indent:0;vertical-align:middle;white-space:nowrap}
.zv.hb{padding-right:.95em}
.zs{position:relative;display:block;width:1em;height:1.04em;line-height:1.04em;text-align:center}
.zl{display:block;width:1em;height:.42em;position:relative}
.zl::after{content:"";position:absolute;left:50%;top:.1em;width:.19em;height:.19em;margin-left:-.095em;border-radius:50%;background:currentColor}
.zv .tm{position:absolute;left:92%;top:-.2em;width:.5em;height:.5em;overflow:visible;fill:none;stroke:currentColor;stroke-width:1.35;
  stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.zq{position:absolute;left:100%;top:-.24em;width:.82em;height:.82em;box-sizing:border-box;border:.07em dashed currentColor;border-radius:.16em;
  display:flex;align-items:center;justify-content:center;font-size:.86em;line-height:1}
.zw{display:inline-flex;flex-direction:column;align-items:center;gap:.55em;vertical-align:middle}
.zw.h{flex-direction:row;gap:.06em}
.zw.in{font-size:.72em;margin:0 .1em}
.zr{display:inline-flex;align-items:center;white-space:nowrap;vertical-align:middle}
.zr>.zv{font-size:var(--zr-size,.4em);padding-right:.55em;margin-left:.05em}
.zr>.zv .tm{stroke-width:1.7}
.zsent{display:inline-flex;flex-direction:row-reverse;align-items:flex-start;gap:.7em;vertical-align:top}
.zcol{display:flex;flex-direction:column;align-items:center;gap:.55em}
.zp{display:block;width:1em;height:1em;line-height:1em;text-align:center;font-family:var(--zy-font,inherit)}
`;
  if (root.document && !root.document.getElementById('zhuyin-layout-css')) {
    const st = root.document.createElement('style');
    st.id = 'zhuyin-layout-css'; st.textContent = CSS;
    // 放在最前面：頁面自己的樣式可以蓋過這裡的預設
    root.document.head.prepend(st);
  }

  root.ZhuyinLayout = { parse, isSyl, baseOf, withTone, syl, word, ruby, sentence, text, apply, toneSVG, punc, TONE_NAME, MARK, CSS };
})(typeof window !== 'undefined' ? window : globalThis);
