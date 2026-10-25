#!/usr/bin/env node
/* 檢查大寶加油站（exam-cheer）首冊題庫的注音：BANK 詞語、讀一讀的句子與選項，
 * 和教育部《重編國語辭典修訂本》的讀音（zhuyin-lens/zhuyin-data.js）比對。
 *   node tools/check-exam-cheer-zhuyin.js
 * 辭典沒有收的詞會照逐字的讀音比，破音字只要是該字的讀音之一就算過，但會列出來給人看。 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'zhuyin-lens/zhuyin-data.js'), 'utf8'), ctx);
const C = ctx.window.ZLENS_C, W = ctx.window.ZLENS_W, MAXW = ctx.window.ZLENS_MAXW;

// 從網頁裡取出 BANK 與 SENTENCES
const html = fs.readFileSync(path.join(ROOT, 'exam-cheer/index.html'), 'utf8');
const grab = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
const page = { };
vm.createContext(page);
vm.runInContext(grab('const BANK = [', '// 讀一讀的句子').replace('const BANK', 'this.BANK') +
  grab('const SENTENCES = [', '// 注音符號的順序').replace('const SENTENCES', 'this.SENTENCES'), page);

// 最長詞比對，取得辭典讀音；每個字也記下所有讀音
function dict(text) {
  const ch = [...text].filter(c => /[一-鿿]/.test(c)), out = [];
  for (let i = 0; i < ch.length;) {
    let hit = null;
    for (let n = Math.min(MAXW, ch.length - i); n >= 2; n--) {
      const w = ch.slice(i, i + n).join('');
      if (W[w]) { hit = W[w].split(' '); break; }
    }
    if (hit) { hit.forEach((z, k) => out.push({ c: ch[i + k], z, all: (C[ch[i + k]] || '').split('|'), word: true })); i += hit.length; continue; }
    out.push({ c: ch[i], z: (C[ch[i]] || '?').split('|')[0], all: (C[ch[i]] || '').split('|') }); i++;
  }
  return out;
}
let bad = 0, note = 0;
function check(label, text, zy) {
  const want = dict(text), got = zy.split(' ').filter(t => !/^[，。？！、]$/.test(t));
  if (want.length !== got.length) { bad++; console.log(`✗ ${label}「${text}」字數和注音數不同：${zy}`); return; }
  want.forEach((d, k) => {
    if (got[k] === d.z) return;
    if (d.all.includes(got[k]) && !d.word) { note++; console.log(`△ ${label}「${text}」的「${d.c}」用 ${got[k]}（辭典預設 ${d.z}，也有這個讀音）`); return; }
    bad++; console.log(`✗ ${label}「${text}」的「${d.c}」寫 ${got[k]}，辭典是 ${d.z}（所有讀音：${d.all.join('／')}）`);
  });
}
page.BANK.forEach(({ w, z }) => check('詞語', w, z));
page.SENTENCES.forEach(S => {
  check('句子', S.s, S.z); check('問題', S.q, S.qz);
  S.o.forEach(([, w, z]) => check('選項', w, z));
});
console.log(bad ? `\n${bad} 個讀音和辭典不同` : `全部和辭典相同（${page.BANK.length} 個詞、${page.SENTENCES.length} 個句子${note ? `；${note} 處破音字請看一下` : ''}）`);
process.exit(bad ? 1 : 0);
