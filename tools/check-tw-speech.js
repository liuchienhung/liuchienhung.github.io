#!/usr/bin/env node
/* 檢查 tw-speech.js 的台灣口語念法與挑語音規則。
 *   node tools/check-tw-speech.js
 * 改了 tw-speech.js 的規則，請在這裡加上例子再跑一次。 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'tw-speech.js'), 'utf8'), ctx);
const T = ctx.window.TWSpeech;

const TEXT = [
  // 數字＋量詞念「兩」
  ['有 2 隻烏龜', '有兩隻烏龜'],
  ['一共挖到 2 條蚯蚓。', '一共挖到兩條蚯蚓。'],
  ['完成了！大寶得到 2 顆星，繼續加油！', '完成了！大寶得到兩顆星，繼續加油！'],
  ['時間到！大寶答對了 12 題', '時間到！大寶答對了十二題'],
  ['答對了 22 題', '答對了二十二題'],
  ['2 罐是 2 個十，再加 5 條，一共 25 條。', '兩罐是兩個十，再加五條，一共二十五條。'],
  ['兩件 200 元，1200 元，2000 元，2,500 元', '兩件兩百元，一千兩百元，兩千元，兩千五百元'],
  ['102 個、110 個、20000 人、120000 人', '一百零二個、一百一十個、兩萬人、十二萬人'],
  ['每 10 條裝一罐', '每十條裝一罐'],
  ['2到3個', '兩到三個'],
  ['3～5 公分', '三到五公分'],
  ['2cm、2 kg', '兩公分、兩公斤'],
  ['打2折', '打兩折'],
  ['２個、２０元', '兩個、二十元'],
  ['2件100元，特價99元，第2件6折', '兩件一百元，特價九十九元，第2件六折'],
  // 時間
  ['火車 2點半 要出發', '火車兩點半 要出發'],
  ['2:30 出發，8:05 到，12:00 吃飯', '兩點半出發，八點零五分到，十二點吃飯'],
  ['營業時間 10:00-22:00', '營業時間十點到二十二點'],
  // 照原本念「二」
  ['第 2 節車廂坐的是誰', '第2節車廂坐的是誰'],
  ['第2名', '第2名'],
  ['2 號車廂', '2號車廂'],
  ['2樓、2月、2年級、二聲', '2樓、2月、2年級、二聲'],
  ['20分之1、2分之1', '20分之1、2分之1'],
  ['把 2 分成 1 和 1', '把2分成1和1'],
  ['星期2下午', '星期2下午'],
  ['1+1=2 對嗎', '1加1等於2對嗎'],
  ['按 2 下', '按兩下'],
  ['2.5 公分', '2.5公分'],
  ['3 + 2 = ？', '3加2等於多少'],
  ['24 ＋ 12 ＝ ？', '24加12等於多少'],
  ['5 − 2 = 3', '5減2等於3'],
  ['民國113年', '民國113年'],
  ['25%', '百分之二十五'],
  // 經文出處
  ['創世記 1:1', '創世記一章一節'],
  ['詩篇 23:1', '詩篇二十三篇一節'],
  ['詩篇 139:14', '詩篇一百三十九篇十四節'],
  ['加拉太書 5:22–23', '加拉太書五章二十二到二十三節'],
  ['帖撒羅尼迦前書 5:16–18', '帖撒羅尼迦前書五章十六到十八節'],
  ['路加福音 10:27', '路加福音十章二十七節'],
  ['創世記 1–2 章', '創世記1到2章'],
  // 表情符號、箭頭、拉長音
  ['看完了！換大寶描描看吧 👉 按「✍️ 描描看」', '看完了！換大寶描描看吧 按「 描描看」'],
  ['嚼嚼嚼～', '嚼嚼嚼'],
  ['好棒喔～你好厲害', '好棒喔，你好厲害'],
  ['第 1 天光 ↔ 第 4 天', '第1天光 第4天'],
  // 注音
  ['ㄅ', 'ㄅ'],
];
const ZY = [
  ['照順序排好：ㄅ 先，然後是 ㄠ。', '照順序排好：波 先，然後是 凹。'],
  ['「杯」的注音是 ㄅㄟ，第一個是 ㄅ。', '「杯」的注音是 波、誒，第一個是 波。'],
  ['ㄊㄨˋ ˙ㄗ', '特、烏 資'],
];
const NUM = [[0, false, '零'], [2, false, '二'], [2, true, '兩'], [10, true, '十'], [12, true, '十二'], [20, true, '二十'],
  [200, false, '兩百'], [205, true, '兩百零五'], [1010, true, '一千零一十'], [10010, true, '一萬零一十'], [22222, true, '兩萬兩千兩百二十二']];

let bad = 0;
const check = (got, want, label) => { if (got !== want) { bad++; console.log(`✗ ${label}\n   得到：${got}\n   應為：${want}`); } };
for (const [a, b] of TEXT) check(T.text(a), b, a);
for (const [a, b] of ZY) check(T.text(a, { zhuyin: 'read' }), b, a);
for (const [n, c, w] of NUM) check(T.cnNum(n, c), w, `cnNum(${n}, ${c})`);

// 挑語音：台灣國語 > 一般國語 > 粵語
const V = (name, lang) => ({ name, lang, voiceURI: name });
const voices = [
  V('Google 粵語（香港）', 'zh-HK'), V('Microsoft HiuGaai Online (Natural) - Chinese (Cantonese Traditional)', 'zh-HK'),
  V('Google 普通话（中国大陆）', 'zh-CN'), V('Tingting', 'zh-CN'), V('Sinji', 'yue-Hant-HK'),
  V('Google 國語（臺灣）', 'zh-TW'), V('Mei-Jia', 'zh-TW'), V('cmn-tw-x-ctc-local', 'zh_TW'),
  V('Microsoft HsiaoChen Online (Natural) - Chinese (Taiwanese Mandarin, Traditional)', 'zh-TW'),
];
const rank = voices.slice().sort((a, b) => T.voiceScore(b) - T.voiceScore(a)).map(v => v.name);
const firstNonTW = rank.findIndex(n => !T.isTaiwanVoice(voices.find(v => v.name === n)));
check(String(firstNonTW), '4', '台灣語音（4 個）要排在最前面：' + rank.join(' > '));
check(String(rank.slice(-3).every(n => T.isCantonese(voices.find(v => v.name === n)))), 'true', '粵語要排在最後：' + rank.join(' > '));
check(T.langOf(V('x', 'zh_TW')), 'zh-TW', 'langOf zh_TW');
check(T.langOf(null), 'zh-TW', 'langOf null');

console.log(bad ? `\n${bad} 個不符` : `全部通過（${TEXT.length + ZY.length + NUM.length + 4} 項）`);
process.exit(bad ? 1 : 0);
