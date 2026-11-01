#!/usr/bin/env node
/* 期中考總復習（midterm-review）的注音：
 *   node tools/build-midterm-zhuyin.js          重新產生頁面裡的 ZY_C（題目說明用到的字 → 教育部辭典預設讀音）
 *   node tools/build-midterm-zhuyin.js --check  印出每一句題目說明的國字注音，並把國語題目的詞語、句子和辭典比對
 * 讀音來源：zhuyin-lens/zhuyin-data.js（教育部《重編國語辭典修訂本》）。
 * 國語題目照老師的參考題型照抄，和辭典不同的地方列在 TEACHER（照考卷），其他不同會讓 --check 失敗。 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'midterm-review/index.html');

const dctx = { window: {} }; vm.createContext(dctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'zhuyin-lens/zhuyin-data.js'), 'utf8'), dctx);
const C = dctx.window.ZLENS_C, W = dctx.window.ZLENS_W, MAXW = dctx.window.ZLENS_MAXW;

let html = fs.readFileSync(PAGE, 'utf8');
const between = (a, b) => { const i = html.indexOf(a); if (i < 0) throw new Error('找不到 ' + a); return html.slice(i, html.indexOf(b, i)); };

// 題目資料
const data = {};
vm.createContext(data);
const stubs = 'rZ1 rZ2 rZ3 rZ4 rZ5 rZ6 rM1 rM2 rM3 rM4 rM5 rM6 rM7 rM8 rM9 rM10'.split(' ').map(f => `function ${f}(){}`).join('\n');
vm.runInContext(`const rep = (s, n) => Array.from({ length: n }, () => s);\n${stubs}\n` +
  between('const Z1 = [', 'const CN_NUM').replace(/^const (\w+)/gm, 'this.$1'), data);
vm.runInContext(between('const ZY_W = {', 'const isHan').replace(/^const (\w+)/gm, 'this.$1'), data);

// 會經過 T() 加注音的文字
const texts = new Set(['國語', '數學', '例', '例如']);
data.SECS.forEach(s => texts.add(s.title));
data.LESSONS.concat(data.UNITS).forEach(t => texts.add(t));
data.M3.flat().forEach(r => texts.add(r.lb));
data.M4.flat().forEach(c => texts.add(c.t));
data.M7.forEach(b => { b.ends.forEach(e => texts.add(e)); b.q.forEach(q => texts.add(q.t)); });
data.M8.flat().forEach(c => texts.add(c.t));
data.M10.forEach(r => texts.add(r[1]));
// 做題順序引導的話
const walk = v => typeof v === 'string' ? texts.add(v) : v && typeof v === 'object' && Object.values(v).forEach(walk);
walk(data.GUIDE);
for (const m of html.matchAll(/\bT\('([^']+)'\)/g)) texts.add(m[1]);
// 手寫（寫字板、工具列）的字也要有注音
const hwSrc = fs.readFileSync(path.join(ROOT, 'midterm-review/handwrite.js'), 'utf8');
for (const m of hwSrc.matchAll(/\bT\('([^']+)'\)/g)) texts.add(m[1]);
const parts = [...texts].flatMap(t => t.split(/\{[a-z]\}/));
const isHan = c => /[㐀-鿿]/.test(c);

if (!process.argv.includes('--check')) {
  const chars = [...new Set(parts.join(''))].filter(isHan).sort();
  const map = {};
  const miss = [];
  chars.forEach(c => { if (C[c]) map[c] = C[c].split('|')[0]; else miss.push(c); });
  html = html.replace(/\/\*ZY_C\*\/[\s\S]*?\/\*END\*\//, `/*ZY_C*/${JSON.stringify(map)}/*END*/`);
  fs.writeFileSync(PAGE, html);
  console.log(`ZY_C：${Object.keys(map).length} 個字` + (miss.length ? `；辭典沒有：${miss.join('')}（請加進 ZY_FIX）` : ''));
  process.exit(0);
}

/* ---------- --check ---------- */
const ZY_C = JSON.parse(html.match(/\/\*ZY_C\*\/([\s\S]*?)\/\*END\*\//)[1]);
function annotate(s) {
  const ch = [...s], out = ch.map(() => '');
  for (let i = 0; i < ch.length;) {
    if (!isHan(ch[i])) { i++; continue; }
    let hit = 0;
    for (let n = 3; n >= 2; n--) {
      const w = ch.slice(i, i + n).join('');
      if (data.ZY_W[w]) { data.ZY_W[w].split(' ').forEach((z, k) => { out[i + k] = z; }); i += n; hit = 1; break; }
    }
    if (!hit) { out[i] = data.ZY_FIX[ch[i]] || ZY_C[ch[i]] || '？'; i++; }
  }
  return out;
}
console.log('== 題目說明的國字注音 ==');
let missing = 0;
[...new Set(parts)].filter(p => [...p].some(isHan)).forEach(p => {
  const z = annotate(p), line = [...p].map((c, i) => z[i] ? `${c}(${z[i]})` : c).join('');
  if (z.includes('？')) missing++;
  console.log(line);
});

// 辭典讀音（最長詞比對）
function dict(text) {
  const ch = [...text].filter(isHan), out = [];
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
// 考卷上的念法和辭典不同、照考卷的地方（字＠詞：考卷念法）
const TEACHER = {
  '狸@狐狸': 'ㄌㄧˊ', '毛@毛毛蟲': 'ㄇㄠˊ', '寶@羊寶寶': '˙ㄅㄠ', '腐@豆腐': 'ㄈㄨˇ', '米@玉米': 'ㄇㄧˇ', '友@好朋友': 'ㄧㄡˇ',
  '璃@玻璃': 'ㄌㄧˊ', '萄@葡萄': 'ㄊㄠˊ', '著@撐著': '˙ㄓㄜ'
};
const teacher = (c, w) => Object.entries(TEACHER).find(([k]) => { const [ch, ww] = k.split('@'); return ch === c && w.includes(ww); });
const strip = z => z.replace(/[?!]$/, '');
const items = [];
data.Z1.forEach(B => B.items.forEach(it => items.push([it.w, it.o[it.a]])));
data.Z2.forEach(B => B.items.forEach(it => {
  const z = it.s.split(' ').filter(t => t !== '|' && !/^[。：]$/.test(t)).map(t => {
    const m = t.match(/^[[(](.+)[\])]$/); if (!m) return t;
    return m[1].split('/').find(x => x.includes('*')).replace('*', '').replace(/_/g, ' ');
  }).join(' ');
  items.push([it.w, z]);
}));
data.Z3.forEach(B => B.items.forEach(it => { if (it.ex) items.push([it.ex[1], it.ex[0]]); else it.o.forEach(([, z, w]) => items.push([w, z])); }));
data.Z4.forEach(B => B.items.forEach(it => {
  items.push([it.w, it.s.split(' ').filter(t => !/^[：。]$/.test(t)).map(t => t === '□' ? it.o[it.a][0] : t).join(' ')]);
  it.o.forEach(([z, w]) => items.push([w, z]));
}));
data.Z5.forEach(B => B.w.forEach((w, i) => items.push([w, B.z[i]])));
data.Z6.forEach(B => B.items.forEach(it => items.push([it.w, it.z.split(' ').map(strip).join(' ')])));

console.log('\n== 國語題目和辭典比對 ==');
let bad = 0, note = 0;
items.forEach(([w, z]) => {
  const want = dict(w), got = z.split(' ');
  if (want.length !== got.length) { bad++; console.log(`✗「${w}」字數和注音數不同：${z}`); return; }
  want.forEach((d, k) => {
    if (got[k] === d.z) return;
    const t = (teacher(d.c, w) || [])[1];
    if (!d.all[0]) { note++; console.log(`△「${w}」的「${d.c}」辭典沒有收這個字，考卷寫 ${got[k]}`); return; }
    if (t === got[k]) { note++; console.log(`△「${w}」的「${d.c}」照考卷寫 ${got[k]}（辭典 ${d.z}）`); return; }
    if ((d.c === '一' || d.c === '不') && got[k].replace(/[ˊˇˋ]/, '') === d.z.replace(/[ˊˇˋ]/, '')) return; // 一、不 變調
    if (d.all.includes(got[k]) && !d.word) { note++; console.log(`△「${w}」的「${d.c}」用 ${got[k]}（辭典預設 ${d.z}，也有這個讀音）`); return; }
    bad++; console.log(`✗「${w}」的「${d.c}」寫 ${got[k]}，辭典是 ${d.z}（所有讀音：${d.all.join('／')}）`);
  });
});
console.log(`\n${items.length} 個詞句；${bad ? `${bad} 個讀音和辭典不同` : '全部和辭典相同或照考卷'}${note ? `；${note} 處請看一下` : ''}${missing ? `；${missing} 句說明有字沒有注音` : ''}`);
process.exit(bad || missing ? 1 : 0);
