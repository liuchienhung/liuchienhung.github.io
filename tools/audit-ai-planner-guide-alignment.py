from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys

from pypdf import PdfReader


ROOT = pathlib.Path(__file__).resolve().parents[1]
GUIDE_DIR = ROOT / "docs" / "學習指引"

TERMS = [
    "斷詞",
    "詞性標註",
    "命名實體",
    "NER",
    "詞向量",
    "Word2Vec",
    "BERT",
    "Transformer",
    "情感分析",
    "意圖辨識",
    "文字分類",
    "機器翻譯",
    "摘要",
    "問答",
    "RAG",
    "OCR",
    "CNN",
    "YOLO",
    "R-CNN",
    "影像分類",
    "物件偵測",
    "語意分割",
    "實例分割",
    "IoU",
    "mAP",
    "GAN",
    "擴散模型",
    "Diffusion",
    "VAE",
    "大型語言模型",
    "LLM",
    "提示工程",
    "微調",
    "幻覺",
    "多模態",
    "CLIP",
    "VLM",
    "POC",
    "ROI",
    "KPI",
    "MLOps",
    "A/B",
    "監控",
    "漂移",
    "API",
    "邊緣",
    "容器",
    "Kubernetes",
    "平均數",
    "中位數",
    "眾數",
    "變異數",
    "標準差",
    "偏態",
    "峰度",
    "盒鬚圖",
    "常態分佈",
    "二項分佈",
    "卜瓦松",
    "中央極限定理",
    "p 值",
    "p-value",
    "信賴區間",
    "t 檢定",
    "卡方",
    "ANOVA",
    "第一型錯誤",
    "第二型錯誤",
    "ETL",
    "缺失值",
    "離群值",
    "正規化",
    "標準化",
    "SQL",
    "NoSQL",
    "資料倉儲",
    "資料湖",
    "湖倉",
    "Hadoop",
    "Spark",
    "Kafka",
    "批次",
    "串流",
    "迴歸",
    "分群",
    "關聯規則",
    "時間序列",
    "PCA",
    "異常偵測",
    "Tableau",
    "Power BI",
    "儀表板",
    "5V",
    "去識別化",
    "匿名化",
    "加密",
    "存取控制",
    "差分隱私",
    "聯邦學習",
]


def extract_guides() -> str:
    text_parts: list[str] = []
    for pdf in sorted(GUIDE_DIR.glob("*.pdf")):
        reader = PdfReader(str(pdf))
        text_parts.extend(page.extract_text() or "" for page in reader.pages)
    return "\n".join(text_parts)


def extract_bank() -> tuple[str, list[dict]]:
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
    return raw, subjects


def count_term(text: str, term: str) -> int:
    if re.search(r"[A-Za-z0-9+-]", term):
        return len(re.findall(re.escape(term), text, flags=re.IGNORECASE))
    return text.count(term)


def main() -> int:
    guide_text = extract_guides()
    bank_text, subjects = extract_bank()
    print("term,guide_count,bank_count,status")
    missing = []
    for term in TERMS:
        guide_count = count_term(guide_text, term)
        bank_count = count_term(bank_text, term)
        status = "ok"
        if guide_count and not bank_count:
            status = "missing_in_bank"
            missing.append(term)
        print(f"{term},{guide_count},{bank_count},{status}")

    print("\nsubject,unit,questions")
    for subject in subjects:
        for unit in subject["units"]:
            print(f"{subject['subject']},{unit['unit']},{len(unit['questions'])}")

    if missing:
        print("\nMissing guide terms in bank:", "、".join(missing), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
