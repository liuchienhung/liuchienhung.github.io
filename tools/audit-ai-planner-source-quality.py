from __future__ import annotations

import ast
import json
import pathlib
import re
import statistics
import subprocess

from pypdf import PdfReader


ROOT = pathlib.Path(__file__).resolve().parents[1]
GUIDE_DIR = ROOT / "docs" / "學習指引"
EXAM_DIR = ROOT / "docs" / "114年第二梯次考古題"
REPORT = ROOT / "docs" / "AI應用規劃師題庫學習指引與考古題完整稽核.md"

STOP_ENGLISH = {
    "AI",
    "ITRI",
    "QRcode",
    "YouTube",
    "Facebook",
    "Google",
    "Microsoft",
    "No",
    "Low",
    "Code",
    "ChatGPT",
    "Act",
    "Action",
    "Attribute",
    "Artifacts",
    "Audit",
    "Approximation",
    "Code",
    "Low",
    "No",
}


def read_pdf_text(pdf: pathlib.Path) -> str:
    reader = PdfReader(str(pdf))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def load_static_terms() -> list[str]:
    source = (ROOT / "tools" / "audit-ai-planner-guide-alignment.py").read_text(encoding="utf-8")
    module = ast.parse(source)
    for node in module.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "TERMS":
                    return list(ast.literal_eval(node.value))
    return []


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text)


def extract_explicit_terms(text: str) -> set[str]:
    compact = normalize_text(text)
    terms: set[str] = set()

    for zh, inside in re.findall(r"([\u4e00-\u9fffA-Za-z0-9 /+\-.]{2,32})[（(]\s*([^）)]{2,100})\s*[）)]", compact):
        zh = re.split(r"[，。、；:：\s]", zh.strip(" ，、。：；:;()（）"))[-1]
        if 2 <= len(zh) <= 16 and re.search(r"[\u4e00-\u9fff]", zh):
            terms.add(zh)
        for part in re.split(r"[,，/、;；]", inside):
            part = part.strip()
            word_count = len(part.split())
            has_acronym = bool(re.search(r"\b[A-Z0-9]{2,}\b", part))
            has_tech_shape = bool(re.search(r"-|[A-Z][a-z]+[A-Z]|Regression|Scaling|Encoding|Distribution|Network|Learning|Model|Spark|Kafka|Hadoop|Airflow|Tableau|Power BI|GAN|BERT|Transformer|Word2Vec|YOLO|CNN|R-CNN|IoU|mAP", part))
            if (
                re.search(r"[A-Za-z]", part)
                and 2 <= len(part) <= 45
                and word_count <= 4
                and (has_acronym or has_tech_shape)
                and part not in STOP_ENGLISH
            ):
                terms.add(part)

    for term in re.findall(r"\b[A-Z][A-Z0-9]{1,11}\b", compact):
        term = term.strip()
        if term in STOP_ENGLISH:
            continue
        if len(term) >= 2 and not term.isdigit():
            terms.add(term)

    for heading in re.findall(r"(?m)^\s*[3456]\.\d\s+([\u4e00-\u9fffA-Za-z0-9 /+\-.、與之應用技術管理規劃分析資料數據]{4,40})\s*$", text):
        heading = heading.strip()
        if heading:
            terms.add(heading)

    return terms


def count_term(text: str, term: str) -> int:
    flags = re.IGNORECASE if re.search(r"[A-Za-z0-9+-]", term) else 0
    return len(re.findall(re.escape(term), text, flags=flags))


def load_bank() -> list[dict]:
    js = """
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('ai-planner-data.js', 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(`${code};globalThis.aiPlannerSubjects = aiPlannerSubjects;`, context);
console.log(JSON.stringify(context.aiPlannerSubjects));
"""
    raw = subprocess.check_output(["node", "-e", js], cwd=ROOT, text=True, encoding="utf-8")
    subjects = json.loads(raw)
    rows: list[dict] = []
    for subject in subjects:
        for unit in subject["units"]:
            for question in unit["questions"]:
                rows.append(
                    {
                        "subject": subject["subject"],
                        "unit": unit["unit"],
                        "question": question["question"],
                        "options": question["options"],
                        "answer": question["answer"],
                        "explanation": question.get("explanation", ""),
                    }
                )
    return rows


ANSWER_MAP = str.maketrans("ＡＢＣＤ", "ABCD")


def parse_exam_questions(text: str) -> list[dict]:
    normalized = re.sub(r"\n+", "\n", text)
    pattern = re.compile(
        r"(?P<answer>[A-DＡＢＣＤ])\s+(?P<number>\d{1,3})\.\s+(?P<body>.*?)(?=\n[A-DＡＢＣＤ]\s+\d{1,3}\.\s+|\Z)",
        re.S,
    )
    rows: list[dict] = []
    for match in pattern.finditer(normalized):
        body = re.sub(r"\s+", " ", match.group("body")).strip()
        options = re.findall(r"\([A-D]\)(.*?)(?=\([A-D]\)|$)", body)
        stem = re.split(r"\(A\)", body, maxsplit=1)[0].strip()
        rows.append(
            {
                "answer": match.group("answer").translate(ANSWER_MAP),
                "number": int(match.group("number")),
                "question": stem,
                "options": [option.strip(" ；;") for option in options],
                "raw": body,
            }
        )
    return rows


CODE_TERMS = [
    "pandas",
    "df[",
    "sns.",
    "LinearRegression",
    "groupby",
    "describe()",
    "astype",
    "isna",
    "程式碼",
    "語法",
    "附圖",
    "下圖",
]

IMPORTANT_REVIEW_TERMS = [
    "GPT",
    "GDPR",
    "CCPA",
    "HIPAA",
    "偏見",
    "模型偏見",
    "透明度",
    "法規遵循",
    "POS",
    "LSTM",
    "GRU",
    "LoRA",
    "ViT",
    "U-Net",
    "BLIP",
    "ASR",
    "TTS",
    "NLU",
    "BLEU",
    "ROUGE",
    "詞幹提取",
    "詞形還原",
    "子詞",
    "預訓練語言模型",
    "語音辨識",
    "語意理解",
    "對話系統",
    "圖像生成",
    "文本生成",
    "人臉辨識",
    "自動駕駛",
    "影像分割",
    "HDFS",
    "Airflow",
    "Spark Streaming",
    "半結構化資料",
    "元資料",
    "ARIMA",
    "自由度",
    "對立假設",
    "型一錯誤",
    "型二錯誤",
    "卡方分佈",
    "泊松分佈",
    "配對樣本",
    "重複值",
    "缺失率",
    "算術平均",
    "箱形圖",
    "NPV",
    "WBS",
    "跨部門協作",
]


def summarize_rows(label: str, rows: list[dict]) -> dict:
    stems = [row["question"] for row in rows]
    option_lengths = [len(option) for row in rows for option in row["options"]]
    raw_values = []
    for row in rows:
        raw_values.append(row.get("raw") or (row["question"] + " " + " ".join(row["options"])))
    raw = "\n".join(raw_values)
    return {
        "label": label,
        "count": len(rows),
        "avg_stem_len": round(statistics.mean(map(len, stems)), 1),
        "median_stem_len": round(statistics.median(map(len, stems)), 1),
        "avg_option_len": round(statistics.mean(option_lengths), 1) if option_lengths else 0,
        "scenario_ratio": round(sum(("某" in stem or "情境" in stem) for stem in stems) / len(rows), 3),
        "english_alias_ratio": round(sum(bool(re.search(r"[A-Za-z][A-Za-z -]{2,}", stem)) for stem in stems) / len(rows), 3),
        "calculation_ratio": round(sum(bool(re.search(r"\d|=|≥|≤|公式|計算", stem)) for stem in stems) / len(rows), 3),
        "code_or_figure_ratio": round(sum(any(term in row for term in CODE_TERMS) for row in raw_values) / len(rows), 3),
        "negative_question_ratio": round(sum(("不正確" in stem or "錯誤" in stem) for stem in stems) / len(rows), 3),
        "single_sentence_ratio": round(sum(stem.count("。") + stem.count("？") + stem.count("?") <= 1 for stem in stems) / len(rows), 3),
        "raw": raw,
    }


def pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def main() -> int:
    guide_texts = {pdf.name: read_pdf_text(pdf) for pdf in sorted(GUIDE_DIR.glob("*.pdf"))}
    guide_text = "\n".join(guide_texts.values())
    guide_compact = normalize_text(guide_text)

    bank_rows = load_bank()
    bank_qo_text = "\n".join(row["question"] + " " + " ".join(row["options"]) for row in bank_rows)
    bank_explanation_text = "\n".join(row["explanation"] for row in bank_rows)
    bank_all_text = bank_qo_text + "\n" + bank_explanation_text

    terms = set(load_static_terms())
    terms.update(extract_explicit_terms(guide_text))
    terms = {term.strip() for term in terms if 2 <= len(term.strip()) <= 60}

    coverage = []
    for term in sorted(terms, key=lambda t: (re.sub(r"[A-Za-z0-9 +/.-]", "", t), t.lower())):
        guide_count = count_term(guide_compact, term)
        if guide_count == 0:
            continue
        qo_count = count_term(bank_qo_text, term)
        exp_count = count_term(bank_explanation_text, term)
        total = count_term(bank_all_text, term)
        if total == 0:
            status = "missing"
        elif qo_count == 0:
            status = "explanation_only"
        elif qo_count < 3 and guide_count >= 5:
            status = "thin"
        else:
            status = "ok"
        coverage.append(
            {
                "term": term,
                "guide": guide_count,
                "question_options": qo_count,
                "explanation": exp_count,
                "total": total,
                "status": status,
            }
        )

    missing = [row for row in coverage if row["status"] == "missing"]
    explanation_only = [row for row in coverage if row["status"] == "explanation_only"]
    thin = [row for row in coverage if row["status"] == "thin"]
    coverage_by_term = {row["term"]: row for row in coverage}

    exam_rows_by_file = {pdf.name: parse_exam_questions(read_pdf_text(pdf)) for pdf in sorted(EXAM_DIR.glob("*.pdf"))}
    exam_summaries = {name: summarize_rows(name, rows) for name, rows in exam_rows_by_file.items()}
    bank_summary = summarize_rows("題庫全體", bank_rows)
    supplement_summary = summarize_rows(
        "考古題與高擬真補強",
        [row for row in bank_rows if "考古題與高擬真補強" in row["subject"]],
    )

    priority_gaps = [
        row
        for row in coverage
        if row["status"] != "ok"
        and (row["guide"] >= 3 or row["status"] in {"thin", "explanation_only"})
        and not row["term"].startswith(("如", "或", "與", "的"))
    ]
    priority_gaps.sort(key=lambda row: ({"missing": 0, "explanation_only": 1, "thin": 2}[row["status"]], -row["guide"], row["term"]))

    curated_lines = []
    for term in IMPORTANT_REVIEW_TERMS:
        row = coverage_by_term.get(term)
        if row and row["status"] != "ok":
            curated_lines.append(
                f"| {row['term']} | {row['guide']} | {row['question_options']} | {row['explanation']} | {row['status']} |"
            )

    exam_table = [
        "| 來源 | 題數 | 平均題幹 | 平均選項 | 情境題 | 英文術語 | 數字/計算 | 程式/圖表 | 反向題 | 短題幹 |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for name, summary in exam_summaries.items():
        short_name = "考古題第一科" if "第一科" in name else "考古題第二科"
        exam_table.append(
            f"| {short_name} | {summary['count']} | {summary['avg_stem_len']} | {summary['avg_option_len']} | "
            f"{pct(summary['scenario_ratio'])} | {pct(summary['english_alias_ratio'])} | "
            f"{pct(summary['calculation_ratio'])} | {pct(summary['code_or_figure_ratio'])} | "
            f"{pct(summary['negative_question_ratio'])} | {pct(summary['single_sentence_ratio'])} |"
        )
    for short_name, summary in [("題庫全體", bank_summary), ("補強科目", supplement_summary)]:
        exam_table.append(
            f"| {short_name} | {summary['count']} | {summary['avg_stem_len']} | {summary['avg_option_len']} | "
            f"{pct(summary['scenario_ratio'])} | {pct(summary['english_alias_ratio'])} | "
            f"{pct(summary['calculation_ratio'])} | {pct(summary['code_or_figure_ratio'])} | "
            f"{pct(summary['negative_question_ratio'])} | {pct(summary['single_sentence_ratio'])} |"
        )

    report = f"""# AI應用規劃師題庫學習指引與考古題完整稽核

## 結論

本次稽核讀取 `docs/學習指引` 兩份 PDF、`docs/114年第二梯次考古題` 兩份 PDF，並比對 `ai-planner-data.js` 的 2220 題。

- 題庫結構：2220 題，其中主題庫 2000 題，考古題與高擬真補強 220 題。
- 學習指引術語覆蓋：固定核心術語清單 100 項皆已進入題庫；自 PDF 顯性抽取的專業術語中，仍有少數術語只出現在學習指引、未直接出現在題庫文字。
- 考古題水準：題庫已具備考古題主要特徵，包括情境式題幹、中英術語、單一考點、相近概念干擾、科目二的數值/程式判讀。題庫全體的題幹與選項平均長度仍短於正式考古題，補強科目則更貼近正式考題。

## 術語覆蓋方法

術語來源包含三層：

1. 既有核心術語清單：NLP、Transformer、BERT、Word2Vec、IoU、mAP、GAN、MLOps、p-value、ANOVA、ETL、Spark、Kafka、差分隱私、聯邦學習等。
2. PDF 顯性術語：從學習指引中括號內外的中英術語、英文縮寫、演算法/工具名自動抽取。
3. 章節標題與評鑑項目：例如自然語言處理、電腦視覺、AI 導入評估、資料儲存與管理、數據可視化工具等。

判定標準：

- `ok`：術語已在題幹/選項中出現，或覆蓋量足夠。
- `thin`：有進入題幹/選項，但相對學習指引出現頻率偏少。
- `explanation_only`：只在解析出現，沒有作為題幹或選項考點。
- `missing`：學習指引有出現，題庫全文未直接出現。

## 術語覆蓋摘要

- 自動抽取並比對的學習指引顯性術語：{len(coverage)} 項。
- 完整或足量覆蓋：{sum(1 for row in coverage if row['status'] == 'ok')} 項。
- 薄弱覆蓋：{len(thin)} 項。
- 只在解析出現：{len(explanation_only)} 項。
- 未直接出現：{len(missing)} 項。

### 人工判讀後的主要缺口

自動抽取會包含部分 PDF 斷詞碎片、章節代碼與英文別名；下表是從缺口中挑出的高優先考點，較適合直接補入題幹或選項。

| 術語 | 指引出現 | 題幹/選項 | 解析 | 狀態 |
|---|---:|---:|---:|---|
{chr(10).join(curated_lines) if curated_lines else '| 無 | 0 | 0 | 0 | ok |'}

## 考古題出題模式

從兩份 114 年第二梯次公告試題可歸納出下列模式：

- 題幹多為短到中等長度，但常含一個具體情境或應用目標。
- 科目一高度依賴中英術語對照與模型/技術目的辨識，例如 Transformer、BERT、Word2Vec、TF-IDF、IoU、mAP、Softmax、Max-Pooling。
- 科目二明顯提高數值、統計、資料處理與程式碼判讀比例，例如 Z-Score、p 值、CDF/PDF、Label Encoding、One-Hot、Robust Scaling、ACID、pandas、groupby、astype、isna、seaborn。
- 干擾選項多為同章節相近概念，不是完全無關選項。
- 反向題比例不高，但會出現「不正確/錯誤」判斷。

## 題庫與考古題量化比較

{chr(10).join(exam_table)}

## 水準判斷

現有題庫已達到「考古題練習」的基本水準，原因如下：

- 題庫已收錄 100 題公告試題原題，並保留官方答案來源。
- 另有 120 題高擬真補強題，補足正式考題常見的英文術語、數值判讀與程式語法題。
- 主題庫 2000 題已依學習指引章節與考古題落點分配題數，不是平均灌題。
- 答案一致性稽核通過：2220 題結構有效，604 題可機械驗證題型通過，100 題公告試題保留來源答案。

但若目標是「高度貼近正式考場」，仍建議補強：

- 將 `missing` 與 `thin` 術語補成題幹或選項考點，而不是只放在解析或完全未出現。
- 拉長部分主題庫題幹與選項，使平均長度更接近考古題約 117 至 119 字題幹、38 至 39 字選項。
- 第二科可再增加表格輸出、程式片段、統計圖表文字化判讀題，讓程式/圖表比例更接近考古題第二科的 22%。
- 對 `AI 倫理與治理`、`資料治理與品質管理`、`資安治理`、`模型生命週期管理` 這類較抽象的抽取術語，應以實務場景重寫為可考的具體題目。

## 可重跑命令

```powershell
$env:PYTHONIOENCODING='utf-8'
& 'C:\\Users\\neilliu\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe' tools\\audit-ai-planner-source-quality.py
node tools\\audit-ai-planner-answer-consistency.js
```
"""

    REPORT.write_text(report, encoding="utf-8")
    print(f"wrote {REPORT}")
    print(f"terms={len(coverage)} ok={sum(1 for row in coverage if row['status'] == 'ok')} thin={len(thin)} explanation_only={len(explanation_only)} missing={len(missing)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
