// Run from repository root: node tools/check-step-games.cjs
// VM checks exercise question generation and progression gates; not a browser substitute.
const fs=require('fs'),vm=require('vm'),assert=require('assert');let checked=0;
for(const subject of ['zh','ma']){
 const elements=new Map(),el=()=>({innerHTML:'',textContent:'',className:'',hidden:true,addEventListener(){},classList:{toggle(){},add(){}},querySelector(){return null},insertAdjacentHTML(){}});
 const document={body:{dataset:{subject},classList:{toggle(){}}},querySelector(s){if(!elements.has(s))elements.set(s,el());return elements.get(s)},querySelectorAll(){return []}};
 const ctx={document,localStorage:{getItem(){return null},setItem(){}},console,Set,window:{addEventListener(){}}};ctx.window.document=undefined;vm.createContext(ctx);
 for(const file of ['tw-speech.js','zhuyin-layout.js','learning-games/reference-data.js'])vm.runInContext(fs.readFileSync(''+file,'utf8'),ctx);
 ctx.TWSpeech=ctx.window.TWSpeech;
 let src=fs.readFileSync('learning-games/game.js','utf8');src=src.replace('home();\n})();',`window.test={lessons, set(s){state=s}, question(){return math?makeMath():makeZh()},render,answer,help,next,get(){return state}, elements:document};\n})();`);vm.runInContext(src,ctx);
 const t=ctx.window.test;assert(t);
 for(let i=0;i<t.lessons.length;i++)for(let phase=0;phase<4;phase++)for(let variant=0;variant<30;variant++){
  t.set({i,phase,variant});const q=t.question();assert(q.prompt&&q.explain);if(q.mode!=='ordinal')assert(q.choices.some(o=>o.value===q.a),`answer absent ${subject}/${i}/${phase}/${variant}`);for(const o of q.choices||[])assert(o.html&&!o.html.includes('undefined'));t.render();checked++;
 }
 // A hinted independent answer must require another question, not a promotion.
 t.set({i:subject==='ma'?6:0,phase:2,variant:0});t.render();t.help();let q=t.get().q;t.answer(q.a);assert.equal(elements.get('#retry').hidden,false);assert.notEqual(elements.get('#next')?.hidden,false);
 // Correct answer cannot skip concrete counting in the first two teaching steps.
 if(subject==='ma'){t.set({i:0,phase:1,variant:0});t.render();t.answer(t.get().q.a);assert.equal(t.get().solved,false)}
}
console.log('PASS:',checked,'generated lesson/phase/variant renders; hint gating and concrete-count gating verified');

const data={window:{}};vm.createContext(data);vm.runInContext(fs.readFileSync('learning-games/reference-data.js','utf8'),data);
const tones=data.window.ReviewReference.Z6.flatMap(x=>x.items);
assert(tones.find(x=>x.w==='羊寶寶').z.endsWith('ㄅㄠˇ'));
for(const word of ['玉米','豆腐','好朋友一起玩遊戲'])assert(!tones.find(x=>x.w===word).alt,word+' must use MOE concise citation tone');
console.log('PASS: MOE citation-tone regression checks');
