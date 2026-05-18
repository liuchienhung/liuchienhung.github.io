const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const dataPath = path.join(root, 'ai-planner-data.js');
const code = fs.readFileSync(dataPath, 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(`${code};globalThis.aiPlannerSubjects = aiPlannerSubjects;`, context);

const subjects = context.aiPlannerSubjects;
const answerIndex = { A: 0, B: 1, C: 2, D: 3 };
const artifactPattern = /114 年第二次AI|試題公告日期|第 \d+ 頁，共 \d+ 頁|答\s*案\s*題目/;

const issues = [];
const checked = {
  total: 0,
  structural: 0,
  machineValidated: 0,
  officialSourceAnswers: 0
};

function addIssue(scope, message) {
  issues.push({ scope, message });
}

function optionText(option) {
  return String(option || '').replace(/^[A-D]\)\s*/, '').trim();
}

function getCorrectOption(question) {
  return optionText(question.options[answerIndex[question.answer]]);
}

function expect(scope, question, predicate, message) {
  checked.machineValidated += 1;
  if (!predicate(getCorrectOption(question), question)) {
    addIssue(scope, message);
  }
}

function validateKnownPattern(scope, question) {
  const stem = question.question;
  if (/114年第二梯次公告試題/.test(scope)) {
    checked.officialSourceAnswers += 1;
  }

  const zMatch = stem.match(/平均數為\s*([\d,]+)、標準差為\s*([\d,]+)，觀察值為\s*([\d,]+)/);
  if (zMatch && /Z-Score/.test(stem)) {
    const mean = Number(zMatch[1].replace(/,/g, ''));
    const std = Number(zMatch[2].replace(/,/g, ''));
    const value = Number(zMatch[3].replace(/,/g, ''));
    const expected = String((value - mean) / std);
    expect(scope, question, (correct) => correct === expected, `Z-Score answer should be ${expected}`);
  }

  const pMatch = stem.match(/p-value=([0-9.]+).*α=0\.05/);
  if (pMatch) {
    const p = Number(pMatch[1]);
    expect(
      scope,
      question,
      (correct) => (p < 0.05 ? /拒絕虛無假設/.test(correct) : /未達顯著|不足以拒絕/.test(correct)),
      `p-value interpretation is inconsistent with p=${p}`
    );
  }

  if (/平均每分鐘來電率固定/.test(stem)) {
    expect(scope, question, (correct) => /卜瓦松/.test(correct), 'Poisson process question should answer 卜瓦松分佈');
  }
  if (/count、mean、std、四分位數/.test(stem)) {
    expect(scope, question, (correct) => /describe\(\)/.test(correct), 'pandas descriptive-statistics question should answer describe()');
  }
  if (/data\['Year'\] 含 NaN/.test(stem)) {
    expect(scope, question, (correct) => /astype\('Int64'\)/.test(correct), "nullable integer question should answer astype('Int64')");
  }
  if (/Platform 的 Global_Sales 總和/.test(stem)) {
    expect(scope, question, (correct) => /groupby\(['"]Platform['"]\)\[['"]Global_Sales['"]\]\.sum\(\)/.test(correct), 'Platform Global_Sales aggregation should use groupby sum');
  }
  if (/遺漏值數量/.test(stem)) {
    expect(scope, question, (correct) => /isnull\(\).*isna\(\)|isna\(\).*isnull\(\)/.test(correct), 'missing-value count question should answer isnull/isna');
  }
  if (/LinearRegression\(\)\.fit\(X, y\)/.test(stem) && /模型輸入與輸出變數|通常分別代表/.test(stem)) {
    expect(scope, question, (correct) => /X 為特徵矩陣[，、]y 為目標變數/.test(correct), 'LinearRegression fit question should map X to features and y to target');
  }
  if (/sns\.barplot.*nlargest\(5/.test(stem) && /此程式碼主要想呈現什麼/.test(stem)) {
    expect(scope, question, (correct) => /前五|前 5/.test(correct), 'nlargest barplot question should answer top-five visualization');
  }
  if (/Gini impurity/.test(stem) && /正規化後結果/.test(stem)) {
    expect(scope, question, (correct) => correct === '1', 'normalized binary Gini question should answer 1');
  }
  if (/DBSCAN/.test(stem) && /主要超參數/.test(stem)) {
    expect(scope, question, (correct) => /Epsilon|eps|MinPts/.test(correct), 'DBSCAN hyperparameter question should answer Epsilon/MinPts');
  }
  if (/少數類別不到 1%/.test(stem) && /Accuracy/.test(stem)) {
    expect(scope, question, (correct) => /少數類/.test(correct), 'imbalanced Accuracy question should mention minority-class detection risk');
  }
}

subjects.forEach((subject) => {
  subject.units.forEach((unit) => {
    unit.questions.forEach((question, index) => {
      checked.total += 1;
      const scope = `${subject.subject} / ${unit.unit} / #${index + 1}`;

      if (!/^[A-D]$/.test(question.answer || '')) {
        addIssue(scope, `invalid answer letter: ${question.answer}`);
        return;
      }
      if (!Array.isArray(question.options) || question.options.length !== 4) {
        addIssue(scope, `option count is ${question.options && question.options.length}`);
        return;
      }
      checked.structural += 1;
      question.options.forEach((option, optionIndex) => {
        const expectedLabel = `${String.fromCharCode(65 + optionIndex)})`;
        if (!String(option).startsWith(expectedLabel)) {
          addIssue(scope, `option ${optionIndex + 1} label should start with ${expectedLabel}`);
        }
        if (artifactPattern.test(String(option)) || artifactPattern.test(String(question.question))) {
          addIssue(scope, 'contains PDF page-header artifact');
        }
      });
      const deduped = new Set(question.options.map(optionText));
      if (deduped.size !== question.options.length) {
        addIssue(scope, 'duplicate option text');
      }
      if (!getCorrectOption(question)) {
        addIssue(scope, 'correct option is empty');
      }
      validateKnownPattern(scope, question);
    });
  });
});

console.log(JSON.stringify(checked, null, 2));
if (issues.length) {
  console.error(JSON.stringify(issues.slice(0, 100), null, 2));
  console.error(`Answer consistency audit failed with ${issues.length} issue(s).`);
  process.exit(1);
}
console.log('Answer consistency audit passed.');
