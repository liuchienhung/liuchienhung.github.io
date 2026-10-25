/* 台灣口語語音（各服務共用）
 *
 * 1. 挑語音：台灣國語優先；裝置沒有台灣語音時用一般國語，絕不自動選到粵語（香港語音會講廣東話）。
 * 2. 念法：把要念的文字轉成台灣人平常說的樣子，例如
 *      「2 條蚯蚓」→「兩條蚯蚓」、「200 元」→「兩百元」、「2:30」→「兩點半」、
 *      「創世記 1:1」→「創世記一章一節」、「3～5 公分」→「三到五公分」、「25%」→「百分之二十五」，
 *    並拿掉表情符號和箭頭（有些手機會把 👉 念成「反手食指向右」）。
 *    「第 2 節」「二聲」「2 號」「2 樓」「2 月」照原本念「二」。
 *
 * 用法：
 *   const v = TWSpeech.pickVoice(使用者選的 voiceURI);   // 找不到中文語音時是 null
 *   const u = new SpeechSynthesisUtterance(TWSpeech.text('有 2 隻烏龜'));  // 「有兩隻烏龜」
 *   u.lang = TWSpeech.langOf(v); if (v) u.voice = v;
 * 規則檢查：node tools/check-tw-speech.js
 */
(function (root) {
  'use strict';

  /* ---------- 挑語音 ---------- */
  // 分數越高越像台灣國語；粵語、大陸普通話扣分
  function voiceScore(v) {
    const s = [v.lang, v.name, v.voiceURI].join(' ').toLowerCase().replace(/_/g, '-');
    let sc = 0;
    if (/\b(zh|cmn)-(hant-)?tw\b/.test(s)) sc += 100;
    if (/臺灣|台灣|taiwan|國語/.test(s)) sc += 60;
    if (/hsiaochen|hsiaoyu|yating|mei-?jia|美佳|zhiwei|yunjhe|hanhan/.test(s)) sc += 20;
    if (/natural|online|neural|enhanced|premium|高品質/.test(s)) sc += 15;
    if (isCantonese(v)) sc -= 200;
    if (/\b(zh-cn|zh-hans|cmn-hans|cmn-cn)\b|普通话|mainland|中国大陆/.test(s)) sc -= 40;
    return sc;
  }
  function isCantonese(v) {
    const s = [v.lang, v.name].join(' ').toLowerCase().replace(/_/g, '-');
    return /\b(zh-hk|zh-mo|yue)\b|cantonese|粵|粤|廣東|广东|香港|hong kong/.test(s);
  }
  const isTaiwanVoice = v => voiceScore(v) >= 60;
  // 裝置上的中文語音，台灣國語排最前面、粵語排最後
  function chineseVoices() {
    if (!('speechSynthesis' in root)) return [];
    return root.speechSynthesis.getVoices()
      .filter(v => /^(zh|cmn|yue)/i.test(v.lang || ''))
      .sort((a, b) => voiceScore(b) - voiceScore(a));
  }
  // 使用者選的 → 台灣國語 → 一般國語；沒有就回傳 null（交給裝置決定）
  function pickVoice(pref) {
    const vs = chineseVoices();
    return (pref && vs.find(v => v.voiceURI === pref)) || vs.find(isTaiwanVoice) || vs.find(v => !isCantonese(v)) || null;
  }
  // 裝置沒有台灣國語語音時，告訴家長怎麼加；有的話（或語音清單還沒載入）回傳空字串
  function voiceTip() {
    if (!('speechSynthesis' in root)) return '這個瀏覽器不支援朗讀，請改用 Chrome 或 Safari 開啟。';
    if (!root.speechSynthesis.getVoices().length || chineseVoices().some(isTaiwanVoice)) return '';
    return '這台裝置沒有台灣國語語音，可能會聽到大陸口音。加裝方法：Android 到「設定 › 文字轉語音 › Google 語音服務 › 安裝語音資料 › 中文（台灣）」；' +
      'iPhone／iPad 到「設定 › 輔助使用 › 朗讀內容 › 聲音 › 中文（台灣）」；電腦用 Microsoft Edge 開啟。裝好後重新打開這一頁。';
  }
  // 把提示放進頁面上的元素（沒有提示就藏起來）
  function showTip(el) { if (!el) return; const t = voiceTip(); el.textContent = t; el.hidden = !t; }
  // 給 utterance.lang 用。台灣語音一律用 zh-TW；Android 會回報「zh_TW」，要換成合法的語言代碼，語音引擎才會出聲
  const langOf = v => (!v || !v.lang || isTaiwanVoice(v) ? 'zh-TW' : v.lang.replace(/_/g, '-'));

  /* ---------- 數字念法 ---------- */
  const DIGIT = '零一二三四五六七八九';
  // 0～9999；full：前面還有萬位時，十位的「一」要念出來（一萬零一十）
  function below10k(n, full) {
    const d = [Math.floor(n / 1000), Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10];
    const unit = ['千', '百', '十', ''];
    let out = '', zero = false, started = false;
    for (let i = 0; i < 4; i++) {
      if (!d[i]) { if (started) zero = true; continue; }
      if (zero) { out += '零'; zero = false; }
      let w = DIGIT[d[i]];
      if (d[i] === 2 && i < 2) w = '兩';                     // 兩千、兩百
      if (i === 2 && d[i] === 1 && !started && !full) w = '';  // 十二，不念一十二
      out += w + unit[i]; started = true;
    }
    return out;
  }
  // 整數轉國字。count：後面接量詞（2 條 → 兩條）；不是量詞時 2 念「二」
  function cnNum(n, count) {
    n = Number(n);
    if (!Number.isInteger(n) || n < 0 || n >= 1e8) return String(n);
    if (n === 0) return '零';
    if (n === 2) return count ? '兩' : '二';
    const hi = Math.floor(n / 10000), lo = n % 10000;
    let out = hi ? (hi === 2 ? '兩' : below10k(hi)) + '萬' : '';
    if (lo) out += (hi && lo < 1000 ? '零' : '') + below10k(lo, !!hi);
    return out;
  }

  // 接在數字後面、要念「兩」的量詞與單位（長的放前面）。
  // 刻意不放：號、樓、月、日、級、聲（二聲）、章、篇、度——這些照原本念「二」。
  const MEASURES = ('公分|公尺|公里|公斤|公克|公升|公釐|毫升|小時|鐘頭|分鐘|星期|禮拜|塊錢|個|隻|條|根|顆|粒|塊|片|張|本|枝|支|朵|棵|株|匹|頭|尾|' +
    '包|盒|杯|碗|盤|瓶|罐|袋|箱|籃|桶|堆|排|列|組|雙|件|套|台|臺|輛|架|艘|間|棟|層|份|位|名|人|次|遍|下|題|頁|行|句|首|段|' +
    '節|課|堂|筆|畫|劃|點|天|週|周|年|歲|分|秒|倍|元|成|折|種|樣|步|口|滴|把|封|回|趟|場|部|字|圈|斤|億|萬|千|百').split('|');
  const MEASURE_RE = new RegExp('^\\s*(' + MEASURES.join('|') + ')');
  // 數字後面的量詞；不是要念「兩」的情況回傳空字串
  function measureAfter(str, i, n) {
    const m = str.slice(i).match(MEASURE_RE);
    if (!m) return '';
    const w = m[1], next = str.slice(i + m[0].length, i + m[0].length + 1);
    if (w === '分' && /[之成給開]/.test(next)) return '';     // 2分之1、把 2 分成 1 和 1 → 二
    if (w === '下' && /[午面方來去]/.test(next)) return '';   // 星期2下午
    if (w === '年' && (next === '級' || n >= 100)) return ''; // 2年級、民國113年
    return w;
  }
  // 往前跳過空白，看前一個字
  function prevChar(str, i) {
    let j = i - 1;
    while (j >= 0 && /\s/.test(str[j])) j--;
    return j >= 0 ? str[j] : '';
  }

  const BOOKS = ('創世記 出埃及記 利未記 民數記 申命記 約書亞記 士師記 路得記 撒母耳記上 撒母耳記下 列王紀上 列王紀下 歷代志上 歷代志下 ' +
    '以斯拉記 尼希米記 以斯帖記 約伯記 詩篇 箴言 傳道書 雅歌 以賽亞書 耶利米書 耶利米哀歌 以西結書 但以理書 何西阿書 約珥書 阿摩司書 ' +
    '俄巴底亞書 約拿書 彌迦書 那鴻書 哈巴谷書 西番雅書 哈該書 撒迦利亞書 瑪拉基書 馬太福音 馬可福音 路加福音 約翰福音 使徒行傳 羅馬書 ' +
    '哥林多前書 哥林多後書 加拉太書 以弗所書 腓立比書 歌羅西書 帖撒羅尼迦前書 帖撒羅尼迦後書 提摩太前書 提摩太後書 提多書 腓利門書 ' +
    '希伯來書 雅各書 彼得前書 彼得後書 約翰一書 約翰二書 約翰三書 猶大書 啟示錄').split(' ').sort((a, b) => b.length - a.length);
  const BIBLE_RE = new RegExp('(' + BOOKS.join('|') + ')\\s*(\\d+)\\s*[:：]\\s*(\\d+)(?:\\s*[-–—~～〜]\\s*(\\d+))?', 'g');
  const RANGE = '[–—~～〜]';

  // 注音符號念法（同注音小火車、注音筆順）：只有符號時念相近的國字
  const ZHUYIN_READ = {
    'ㄅ': '波', 'ㄆ': '坡', 'ㄇ': '摸', 'ㄈ': '佛', 'ㄉ': '得', 'ㄊ': '特', 'ㄋ': '訥', 'ㄌ': '勒', 'ㄍ': '哥', 'ㄎ': '科', 'ㄏ': '喝',
    'ㄐ': '基', 'ㄑ': '欺', 'ㄒ': '希', 'ㄓ': '知', 'ㄔ': '吃', 'ㄕ': '詩', 'ㄖ': '日', 'ㄗ': '資', 'ㄘ': '疵', 'ㄙ': '思',
    'ㄚ': '阿', 'ㄛ': '喔', 'ㄜ': '婀', 'ㄝ': '欸', 'ㄞ': '哀', 'ㄟ': '誒', 'ㄠ': '凹', 'ㄡ': '歐', 'ㄢ': '安', 'ㄣ': '恩',
    'ㄤ': '骯', 'ㄥ': '鞥', 'ㄦ': '兒', 'ㄧ': '衣', 'ㄨ': '烏', 'ㄩ': '迂'
  };
  // 一串注音（例如 ㄅㄠˇ）→「波、凹」；聲調符號不念
  const readZhuyin = zy => [...zy].filter(c => ZHUYIN_READ[c]).map(c => ZHUYIN_READ[c]).join('、');

  // 轉好的國字數字先做記號，最後把前後的空白拿掉（「有 2 隻」→「有兩隻」）
  const mark = t => '\u0001' + t + '\u0002';

  /* 把文字轉成台灣口語的念法。opts.zhuyin：'keep'（預設，注音符號照原樣交給語音）或 'read'（念成相近的國字） */
  function text(input, opts) {
    opts = opts || {};
    let s = String(input == null ? '' : input);
    // 表情符號、箭頭：拿掉（有些語音會念出符號名稱）
    s = s.replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\uFE0E\uFE0F\u200D\u20E3]/gu, ' ')
      .replace(/[→←↑↓⇒⇐➜➔]/g, '，');
    // 全形數字轉半形；1,200 → 1200
    s = s.replace(/[\uFF10-\uFF19]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
    s = s.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
    // 經文出處：創世記 1:1 → 創世記一章一節；詩篇用「篇」
    s = s.replace(BIBLE_RE, (m, book, ch, v1, v2) =>
      book + cnNum(ch) + (book === '詩篇' ? '篇' : '章') + cnNum(v1) + (v2 ? '到' + cnNum(v2) : '') + '節');
    // 時間範圍：10:00-22:00 → 10:00到22:00
    s = s.replace(/(\d{1,2}\s*[:：]\s*\d{2})\s*[-–—~～〜]\s*(?=\d{1,2}\s*[:：]\s*\d{2})/g, '$1到');
    // 時間：2:30 → 兩點半、8:05 → 八點零五分
    s = s.replace(/(^|[^\d:：./])(\d{1,2})\s*[:：]\s*([0-5]\d)(?![\d:：])/g, (m, pre, h, mm) => {
      h = +h; mm = +mm;
      if (h > 24) return m;
      return pre + mark(cnNum(h, true) + '點' + (mm === 0 ? '' : mm === 30 ? '半' : (mm < 10 ? '零' : '') + cnNum(mm) + '分'));
    });
    // 範圍：3～5 → 3到5
    s = s.replace(new RegExp('(\\d)\\s*' + RANGE + '\\s*(?=\\d)', 'g'), '$1到');
    // 百分比
    s = s.replace(/(\d+)\s*[%％]/g, (m, n) => mark('百分之' + cnNum(n)));
    // 單位
    s = s.replace(/(\d)\s*(cm|mm|km|kg)(?![A-Za-z])/g, (m, d, u) => d + { cm: '公分', mm: '公釐', km: '公里', kg: '公斤' }[u]);
    // 數字＋量詞：2 條 → 兩條、200 元 → 兩百元（「第 2 節」、小數、「2到3個」的前一個數另外處理）
    s = s.replace(/\d+(?:\.\d+)?/g, (num, i, str) => {
      if (num.includes('.') || /[\d.:：/]/.test(str[i - 1] || '') || (num.length > 1 && num[0] === '0')) return num;
      const n = +num, end = i + num.length;
      if (prevChar(str, i) === '第') return num;
      let w = measureAfter(str, end, n);
      // 「2到3個」：前一個數跟著後面的量詞
      if (!w) { const r = str.slice(end).match(/^到(\d+)/); if (r) w = measureAfter(str, end + r[0].length, +r[1]); }
      return w ? mark(cnNum(n, true)) : num;
    });
    // 數字和前後的字黏在一起念，不要停頓
    s = s.replace(/[ \t\u3000]*\u0001([^\u0002]*)\u0002[ \t\u3000]*/g, '$1')
      .replace(/(\d)\s+(?=[\u4e00-\u9fff])/g, '$1').replace(/([\u4e00-\u9fff])\s+(?=\d)/g, '$1');
    // 算式
    s = s.replace(/\s*[=＝]\s*[？?]/g, '等於多少')
      .replace(/(\d)\s*[+＋]\s*(?=\d)/g, '$1加')
      .replace(/(\d)\s*[−－]\s*(?=\d)/g, '$1減')
      .replace(/(\d)\s*[×✕]\s*(?=\d)/g, '$1乘以')
      .replace(/(\d)\s*÷\s*(?=\d)/g, '$1除以')
      .replace(/(\d)\s*[=＝]\s*/g, '$1等於');
    // 注音符號
    if (opts.zhuyin === 'read') s = s.replace(/[ㄅ-ㄩ][ㄅ-ㄩˊˇˋ˙]*|˙[ㄅ-ㄩ]+[ˊˇˋ]?/g, zy => readZhuyin(zy) || zy);
    // 拉長音的「～」不是範圍，換成停頓
    s = s.replace(/[~～〜]+/g, '，');
    return s.replace(/[ \t\u3000]+/g, ' ').replace(/\s*，\s*(，\s*)+/g, '，').replace(/^[，\s]+|[，\s]+$/g, '');
  }

  root.TWSpeech = { voiceScore, isTaiwanVoice, isCantonese, chineseVoices, pickVoice, voiceTip, showTip, langOf, text, cnNum, readZhuyin, ZHUYIN_READ };
})(typeof window !== 'undefined' ? window : globalThis);
