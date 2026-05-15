const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.join(__dirname, '..');

const subject1Weights = [
  { unit: '科目一 3.1：自然語言處理技術與應用', exam: 6, guide: 37 },
  { unit: '科目一 3.2：電腦視覺技術與應用', exam: 2, guide: 19 },
  { unit: '科目一 3.3：生成式 AI 技術與應用', exam: 4, guide: 14 },
  { unit: '科目一 3.4：多模態人工智慧應用', exam: 1, guide: 7 },
  { unit: '科目一 4.1：AI 導入評估', exam: 3, guide: 12 },
  { unit: '科目一 4.2：AI 導入規劃', exam: 5, guide: 14 },
  { unit: '科目一 4.3：AI 風險管理', exam: 6, guide: 10 },
  { unit: '科目一 5.1：數據準備與模型選擇', exam: 15, guide: 12 },
  { unit: '科目一 5.2：AI 技術系統集成與部署', exam: 8, guide: 8 }
];

const subject2Weights = [
  { unit: '科目二 3.1：敘述性統計與資料摘要技術', exam: 4, guide: 11 },
  { unit: '科目二 3.2：機率分佈與資料分佈模型', exam: 4, guide: 10 },
  { unit: '科目二 3.3：假設檢定與統計推論', exam: 2, guide: 10 },
  { unit: '科目二 4.1：數據收集與清理', exam: 8, guide: 7 },
  { unit: '科目二 4.2：數據儲存與管理', exam: 4, guide: 11 },
  { unit: '科目二 4.3：數據處理技術與工具', exam: 3, guide: 11 },
  { unit: '科目二 5.1：統計學在大數據中的應用', exam: 4, guide: 8 },
  { unit: '科目二 5.2：常見的大數據分析方法', exam: 7, guide: 19 },
  { unit: '科目二 5.3：數據可視化工具', exam: 1, guide: 10 },
  { unit: '科目二 6.1：大數據與機器學習', exam: 3, guide: 12 },
  { unit: '科目二 6.2：大數據在鑑別式 AI 中的應用', exam: 3, guide: 11 },
  { unit: '科目二 6.3：大數據在生成式 AI 中的應用', exam: 1, guide: 5 },
  { unit: '科目二 6.4：大數據隱私保護、安全與合規', exam: 6, guide: 8 }
];

function allocate(total, weights) {
  const weighted = weights.map((item) => ({
    ...item,
    raw: total * (item.exam * 0.7 + item.guide * 0.3) / weights.reduce((sum, row) => sum + row.exam * 0.7 + row.guide * 0.3, 0)
  }));
  const floors = weighted.map((item) => ({ ...item, count: Math.floor(item.raw) }));
  let remaining = total - floors.reduce((sum, item) => sum + item.count, 0);
  floors
    .sort((a, b) => (b.raw - b.count) - (a.raw - a.count))
    .slice(0, remaining)
    .forEach((item) => {
      item.count += 1;
    });
  return weights.map((item) => floors.find((row) => row.unit === item.unit));
}

function loadAiSubjects() {
  const code = fs.readFileSync(path.join(repoRoot, 'ai-planner-data.js'), 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${code}\nglobalThis.aiPlannerSubjects = aiPlannerSubjects;`, context);
  return context.aiPlannerSubjects;
}

function summarize(subject, targetWeights) {
  const allocated = allocate(1000, targetWeights);
  const rows = subject.units.map((unit) => {
    const target = allocated.find((row) => row.unit === unit.unit);
    const questions = unit.questions || [];
    const exactQuestions = new Set(questions.map((q) => q.question));
    const optionSets = new Set(questions.map((q) => q.options.join('|')));
    const concepts = new Set();
    questions.forEach((q) => {
      const match = q.question.match(/「([^」]+)」/);
      if (match) concepts.add(match[1]);
    });
    return {
      unit: unit.unit,
      actual: questions.length,
      target: target ? target.count : null,
      examReference: target ? target.exam : null,
      guideReference: target ? target.guide : null,
      uniqueQuestions: exactQuestions.size,
      uniqueOptionSets: optionSets.size,
      detectedConcepts: concepts.size
    };
  });
  return rows;
}

function printTable(title, rows) {
  console.log(`\n${title}`);
  console.log('unit,actual,target,examReference,guideReference,uniqueQuestions,uniqueOptionSets,detectedConcepts');
  rows.forEach((row) => {
    console.log([
      row.unit,
      row.actual,
      row.target,
      row.examReference,
      row.guideReference,
      row.uniqueQuestions,
      row.uniqueOptionSets,
      row.detectedConcepts
    ].join(','));
  });
}

const subjects = loadAiSubjects();
const subject1Rows = summarize(subjects[0], subject1Weights);
const subject2Rows = summarize(subjects[1], subject2Weights);

printTable(subjects[0].subject, subject1Rows);
printTable(subjects[1].subject, subject2Rows);

const failures = subject1Rows.concat(subject2Rows).filter((row) => (
  row.actual !== row.target ||
  row.actual !== row.uniqueQuestions ||
  row.actual !== row.uniqueOptionSets
));

if (failures.length) {
  console.error('\nCoverage audit failed.');
  failures.forEach((row) => console.error(`${row.unit}: actual=${row.actual}, target=${row.target}, uniqueQ=${row.uniqueQuestions}, uniqueOptions=${row.uniqueOptionSets}`));
  process.exit(1);
}

console.log('\nCoverage audit passed.');
