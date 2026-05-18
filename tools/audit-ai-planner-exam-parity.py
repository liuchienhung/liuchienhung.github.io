from __future__ import annotations

import json
import pathlib
import re
import statistics
import subprocess

from pypdf import PdfReader


ROOT = pathlib.Path(__file__).resolve().parents[1]
EXAM_DIR = ROOT / "docs" / "114年第二梯次考古題"

KEY_TERMS = [
    "NLP",
    "Transformer",
    "BERT",
    "Word2Vec",
    "TF-IDF",
    "N-gram",
    "IoU",
    "mAP",
    "Softmax",
    "Max-Pooling",
    "DBSCAN",
    "PCA",
    "Kubernetes",
    "MLOps",
    "Cross-Validation",
    "Precision",
    "Recall",
    "F1",
    "Z-Score",
    "p 值",
    "CDF",
    "PDF",
    "Label Encoding",
    "One-Hot",
    "Robust Scaling",
    "ACID",
    "ETL",
    "Spark",
    "Kafka",
    "同態加密",
    "差分隱私",
    "聯邦學習",
]

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
    "選項 A",
]


def read_pdf_text(pdf: pathlib.Path) -> str:
    reader = PdfReader(str(pdf))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


ANSWER_MAP = str.maketrans("ＡＢＣＤ", "ABCD")


def parse_exam_questions(text: str) -> list[dict]:
    normalized = re.sub(r"\n+", "\n", text)
    pattern = re.compile(
        r"(?P<answer>[A-DＡＢＣＤ])\s+(?P<number>\d{1,3})\.\s+(?P<body>.*?)(?=\n[A-DＡＢＣＤ]\s+\d{1,3}\.\s+|\Z)",
        re.S,
    )
    questions = []
    for match in pattern.finditer(normalized):
        body = re.sub(r"\s+", " ", match.group("body")).strip()
        options = re.findall(r"\([A-D]\)(.*?)(?=\([A-D]\)|$)", body)
        stem = re.split(r"\(A\)", body, maxsplit=1)[0].strip()
        questions.append(
            {
                "answer": match.group("answer").translate(ANSWER_MAP),
                "number": int(match.group("number")),
                "question": stem,
                "options": [option.strip(" ；;") for option in options],
                "raw": body,
            }
        )
    return questions


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
    rows = []
    for subject in subjects:
        for unit in subject["units"]:
            for q in unit["questions"]:
                rows.append(
                    {
                        "subject": subject["subject"],
                        "unit": unit["unit"],
                        "question": q["question"],
                        "options": q["options"],
                        "answer": q["answer"],
                        "raw": q["question"] + " " + " ".join(q["options"]),
                    }
                )
    return rows


def count_term(text: str, term: str) -> int:
    return len(re.findall(re.escape(term), text, flags=re.I))


def summarize(label: str, rows: list[dict]) -> dict:
    stems = [row["question"] for row in rows]
    raw = "\n".join(row["raw"] for row in rows)
    option_lengths = [len(option) for row in rows for option in row["options"]]
    stem_lengths = [len(stem) for stem in stems]
    return {
        "label": label,
        "count": len(rows),
        "avg_stem_len": round(statistics.mean(stem_lengths), 1),
        "median_stem_len": round(statistics.median(stem_lengths), 1),
        "max_stem_len": max(stem_lengths),
        "avg_option_len": round(statistics.mean(option_lengths), 1) if option_lengths else 0,
        "scenario_ratio": round(sum(("某" in stem or "情境" in stem) for stem in stems) / len(rows), 3),
        "single_sentence_ratio": round(sum(stem.count("。") + stem.count("？") + stem.count("?") <= 1 for stem in stems) / len(rows), 3),
        "english_alias_ratio": round(sum(bool(re.search(r"[A-Za-z][A-Za-z -]{2,}", stem)) for stem in stems) / len(rows), 3),
        "negative_question_ratio": round(sum(("不正確" in stem or "錯誤" in stem) for stem in stems) / len(rows), 3),
        "calculation_ratio": round(sum(bool(re.search(r"\d|=|≥|≤|公式|計算", stem)) for stem in stems) / len(rows), 3),
        "code_or_figure_ratio": round(
            sum(any(term in row["raw"] for term in CODE_TERMS) for row in rows) / len(rows),
            3,
        ),
        "term_hits": {term: count_term(raw, term) for term in KEY_TERMS if count_term(raw, term)},
        "code_hits": {term: raw.count(term) for term in CODE_TERMS if raw.count(term)},
    }


def main() -> int:
    exam_rows_by_file = {}
    for pdf in sorted(EXAM_DIR.glob("*.pdf")):
        exam_rows_by_file[pdf.name] = parse_exam_questions(read_pdf_text(pdf))

    bank_rows = load_bank()
    print(json.dumps({"exam": {k: summarize(k, v) for k, v in exam_rows_by_file.items()}}, ensure_ascii=False, indent=2))
    print(json.dumps({"bank_all": summarize("bank_all", bank_rows)}, ensure_ascii=False, indent=2))
    supplement_rows = [row for row in bank_rows if "考古題與高擬真補強" in row.get("subject", "")]
    if supplement_rows:
        print(json.dumps({"bank_supplement": summarize("bank_supplement", supplement_rows)}, ensure_ascii=False, indent=2))

    print("\nSAMPLES")
    for name, rows in exam_rows_by_file.items():
        print(f"\n{name}")
        for row in rows[:3]:
            print(f"{row['number']}. {row['question']}")
    print("\nBank")
    for row in bank_rows[:3]:
        print(f"- {row['question']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
