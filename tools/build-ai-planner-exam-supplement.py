from __future__ import annotations

import json
import pathlib
import re
import subprocess

from pypdf import PdfReader


ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "ai-planner-data.js"
EXAM_DIR = ROOT / "docs" / "114年第二梯次考古題"
SUPPLEMENT_MARKER = "（考古題與高擬真補強）"
ANSWER_MAP = str.maketrans("ＡＢＣＤ", "ABCD")


def label_options(options: list[str]) -> list[str]:
    return [f"{chr(65 + index)}) {option.strip(' ；;')}" for index, option in enumerate(options)]


def read_subjects() -> list[dict]:
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
    return json.loads(raw)


def read_pdf_text(pdf: pathlib.Path) -> str:
    reader = PdfReader(str(pdf))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


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
        if len(options) != 4 or not stem:
            continue
        answer = match.group("answer").translate(ANSWER_MAP)
        questions.append(
            {
                "question": stem,
                "options": label_options(options),
                "answer": answer,
                "explanation": f"114年第二梯次公告試題，答案為 {answer}。此題保留原考古題作為正式考試題型參考。",
            }
        )
    return questions


def parse_exam_units() -> tuple[list[dict], list[dict]]:
    first_questions: list[dict] = []
    second_questions: list[dict] = []
    for pdf in sorted(EXAM_DIR.glob("*.pdf")):
        questions = parse_exam_questions(read_pdf_text(pdf))
        if "第一科" in pdf.name:
            first_questions.extend(questions)
        elif "第二科" in pdf.name:
            second_questions.extend(questions)
    return (
        [{"unit": "114年第二梯次公告試題（第一科）", "questions": first_questions}],
        [{"unit": "114年第二梯次公告試題（第二科）", "questions": second_questions}],
    )


def q(question: str, options: list[str], answer: str, explanation: str) -> dict:
    return {
        "question": question,
        "options": label_options(options),
        "answer": answer,
        "explanation": f"解析：{explanation}",
    }


def build_subject_one_hifi() -> list[dict]:
    rows: list[dict] = []
    tech_items = [
        ("情感分析（Sentiment Analysis）", "判斷文字中的正向、負向或中性情緒傾向", "B"),
        ("Transformer 的自注意力機制（Self-Attention）", "同時參考序列中不同位置的 token 以捕捉長距離依賴", "A"),
        ("BERT 的遮罩語言模型（Masked Language Model, MLM）", "隨機遮罩部分詞語並依雙向上下文預測", "C"),
        ("Word2Vec 與 GloVe", "Word2Vec 偏預測式訓練，GloVe 偏全局共現統計", "D"),
        ("TF-IDF", "提升少數文件中常見且具區辨力詞彙的權重", "A"),
        ("N-gram 語言模型", "只依固定長度上下文估計機率，較難處理長距離語意依賴", "B"),
        ("IoU 與 mAP", "IoU 衡量框重疊程度，mAP 彙整偵測精確率表現", "C"),
        ("Softmax 與 Max-Pooling", "Softmax 轉成類別機率分佈，Max-Pooling 保留局部最大特徵", "D"),
        ("資料增強（Data Augmentation）", "需避免增強後資料分佈或語意偏離原任務", "A"),
        ("Kubernetes", "協調模型服務容器的部署、擴展、復原與運行", "B"),
        ("MLOps", "整合模型版本、部署、監控、回滾與持續改善流程", "C"),
        ("差分隱私（Differential Privacy）", "在統計輸出或訓練中加入受控噪音以降低個體被識別風險", "D"),
        ("提示注入（Prompt Injection）", "惡意輸入誘導模型違反系統指令或洩漏資訊", "A"),
        ("RAG", "以檢索外部資料補足生成模型知識並降低幻覺", "B"),
        ("CLIP 圖文檢索", "將文字與影像映射到共同表示空間以做跨模態比對", "C"),
    ]
    option_sets = {
        "A": ["正確敘述", "只會增加資料庫交易一致性", "必須完全移除人工覆核", "與模型部署或風險無關"],
        "B": ["只會增加資料庫交易一致性", "正確敘述", "必須完全移除人工覆核", "與模型部署或風險無關"],
        "C": ["只會增加資料庫交易一致性", "必須完全移除人工覆核", "正確敘述", "與模型部署或風險無關"],
        "D": ["只會增加資料庫交易一致性", "必須完全移除人工覆核", "與模型部署或風險無關", "正確敘述"],
    }
    scenarios = [
        "某企業導入智慧客服與文件分析流程",
        "某金融科技公司規劃 AI 模型上線驗收",
        "某製造業團隊評估影像檢測與模型維運",
        "某醫療院所導入多模態問答服務",
    ]
    for index, (concept, correct, answer) in enumerate(tech_items):
        opts = [item.replace("正確敘述", correct) for item in option_sets[answer]]
        rows.append(
            q(
                f"{scenarios[index % len(scenarios)]}，題目聚焦於「{concept}」。下列何者最符合其核心作用或主要限制？",
                opts,
                answer,
                f"{concept} 的重點是：{correct}。",
            )
        )

    comparisons = [
        ("若模型在長篇翻譯中能改善遠距語境理解，最可能依賴哪一項機制？", ["Self-Attention", "Max-Pooling", "ACID 原子性", "One-Hot Encoding"], "A", "Transformer 透過自注意力捕捉長距離依賴。"),
        ("若生成式 AI 回答流暢但無法指出來源，導入哪一項設計最能降低幻覺風險？", ["提高溫度參數", "RAG 與來源引用", "刪除測試集", "關閉日誌"], "B", "RAG 與可追溯來源可改善查證能力。"),
        ("若模型需同時讀取圖片與文字問題並回答圖片內容，最接近哪一類應用？", ["資料倉儲", "批次 ETL", "影像問答（Visual Question Answering）", "交叉驗證"], "C", "影像問答是典型多模態應用。"),
        ("若新版模型只先開放 5% 流量觀察錯誤率，再逐步擴大，這屬於哪一種部署策略？", ["直接覆蓋部署", "離線訓練", "資料分箱", "金絲雀釋出"], "D", "金絲雀釋出先用少量流量降低上線風險。"),
        ("若高風險模型需讓受影響者查詢與申訴，最直接對應哪一項治理設計？", ["申訴與修正機制", "提高 batch size", "只看 Accuracy", "刪除模型卡"], "A", "申訴與修正機制是 AI 治理的重要補救設計。"),
    ]
    for stem, options, answer, explanation in comparisons:
        rows.append(q(stem, options, answer, explanation))

    # Repeat with controlled variants to reach a useful supplement size.
    base = list(rows)
    for round_index in range(2):
        for item in base:
            rows.append(
                {
                    **item,
                    "question": item["question"].replace("下列", f"在第 {round_index + 1} 組高擬真情境中，下列", 1),
                }
            )
    return rows[:60]


def build_subject_two_hifi() -> list[dict]:
    rows = [
        q("若某交易金額平均為 2,000、標準差為 400，某筆交易為 3,200，則 Z-Score 為何？", ["2", "2.5", "3", "4"], "C", "Z=(3200-2000)/400=3。"),
        q("使用 pandas 計算 df['總銷售額'] 的平均、標準差、四分位數等敘述統計，最適合哪一個語法？", ["df['總銷售額'].sum()", "df['總銷售額'].describe()", "df['總銷售額'].sort_values()", "df['總銷售額'].stats()"], "B", "describe() 會輸出 count、mean、std、min、quartiles、max。"),
        q("若 Label Encoding 用於無序類別資料，最常見風險為何？", ["無法處理任何缺值", "引入不存在的大小順序", "自動造成資料外洩", "一定造成維度爆炸"], "B", "無序類別被整數化後，模型可能誤解大小順序。"),
        q("若資料有極端值且仍需縮放數值特徵，何者通常較適合？", ["Min-Max Scaling", "Robust Scaling", "One-Hot Encoding", "Label Encoding"], "B", "Robust Scaling 使用中位數與 IQR，對極端值較穩健。"),
        q("在 ACID 中，Atomicity 的正確定義為何？", ["交易需全部成功或全部失敗", "所有欄位都同型別", "所有節點都同時備份", "查詢結果必為常態分佈"], "A", "Atomicity 強調交易不可分割。"),
        q("若 data['Year'] 含 NaN 且要保留缺值並轉為整數型態，較合適的 pandas 型別為何？", ["astype(int)", "astype(float)", "astype('Int64')", "astype(str).astype(int)"], "C", "pandas nullable integer `Int64` 可保留 NA。"),
        q("若要統計每個 Platform 的 Global_Sales 總和並畫長條圖，何者較正確？", ["data.groupby('Platform')['Global_Sales'].sum().plot(kind='bar')", "data['Platform'].sum().plot(kind='bar')", "data.groupby('Global_Sales')['Platform'].mean()", "data['Global_Sales'].describe().plot(kind='bar')"], "A", "groupby 平台後對銷售額加總，符合題意。"),
        q("若要檢查每個欄位的遺漏值數量，哪些語法正確？", ["df.isnull().sum() 與 df.isna().sum()", "df.isnan().sum() 與 df.isNaN().sum()", "df.missing().count()", "df.nulls().sum()"], "A", "pandas 可用 isnull() 或 isna()。"),
        q("LinearRegression().fit(X, y) 中 X 與 y 通常分別代表什麼？", ["X 為目標、y 為特徵", "X 為特徵矩陣、y 為目標變數", "X 為截距、y 為殘差", "X 為 p 值、y 為信賴區間"], "B", "sklearn fit 通常使用特徵矩陣 X 與目標 y。"),
        q("若兩類標籤 A/B 各 5 筆，二元 Gini impurity 為 0.5，正規化到最大值 0.5 後為何？", ["0", "0.5", "1", "2"], "C", "均分二類時 Gini 達二元最大值，正規化後為 1。"),
        q("CDF 與 PDF 的關係，下列何者最正確？", ["CDF 是 PDF 的積分", "PDF 是 CDF 的平均數", "CDF 只能用於類別資料", "PDF 必為負值"], "A", "連續分佈中 CDF 是 PDF 累積積分。"),
        q("平均每分鐘客服來電數固定且事件彼此獨立，描述每分鐘來電通數通常使用哪一分佈？", ["均勻分佈", "常態分佈", "卜瓦松分佈", "t 分佈"], "C", "固定時間內事件次數常以卜瓦松分佈描述。"),
        q("若要比較三種促銷方案的平均銷售額是否有差異，較合適的方法為何？", ["ANOVA", "K-means", "資料湖", "同態加密"], "A", "ANOVA 常用於三組以上平均數比較。"),
        q("A/B 測試得到 p 值 0.03，在顯著水準 0.05 下，最合適解讀為何？", ["拒絕虛無假設", "證明效果一定很大", "接受虛無假設為真", "樣本完全無偏"], "A", "p 值小於顯著水準時通常拒絕虛無假設，但不代表效果大小。"),
        q("使用 sns.barplot(x='Name', y='NA_Sales', data=data.nlargest(5, 'NA_Sales')) 的主要目的為何？", ["畫出 NA_Sales 前五名資料", "計算缺失值", "訓練迴歸模型", "執行資料加密"], "A", "nlargest 取前五名，再用 barplot 視覺化。"),
        q("資料欄位 Year 讀成 float64，哪一原因最合理？", ["欄位含 NaN 或小數形式年份", "pandas 永遠把整數讀成 float64", "年份欄位不能轉換", "CSV 無法儲存整數"], "A", "缺失值或 2006.0 這類值可能讓欄位成為浮點。"),
        q("若分類問題少數類不到 1%，只看 Accuracy 的主要風險為何？", ["可能忽略少數類偵測能力", "一定造成資料庫壞損", "無法計算任何指標", "必定降低樣本數"], "A", "類別不平衡時 Accuracy 可能高估模型表現。"),
        q("同態加密（Homomorphic Encryption）的核心特性為何？", ["可在加密資料上進行特定運算", "直接刪除所有個資", "讓模型自動重訓", "把類別資料轉成整數"], "A", "同態加密允許特定加密狀態運算。"),
        q("Spark 較適合下列哪一種情境？", ["大量資料的分散式處理", "單一 Word 文件排版", "手動標註十筆資料", "只改圖表顏色"], "A", "Spark 常用於分散式大數據處理。"),
        q("Kafka 較常用於哪一類資料流程？", ["高吞吐事件串流與訊息佇列", "靜態簡報製作", "單機圖片裁切", "模型係數顯著性檢定"], "A", "Kafka 常用於串流事件管線。"),
    ]
    base = list(rows)
    for round_index in range(2):
        for item in base:
            rows.append(
                {
                    **item,
                    "question": f"高擬真實作題 {round_index + 1}：{item['question']}",
                }
            )
    return rows[:60]


def write_subjects(subjects: list[dict]) -> None:
    output = (
        "// AI 應用規劃師(中級)單選模擬題庫\n"
        "// 依據科目一、科目二學習指引章節配置，並加入 114 年第二梯次公告試題與高擬真補強題。\n"
        "// Generated by tools/generate-ai-planner-questions.js + tools/build-ai-planner-exam-supplement.py\n"
        f"let aiPlannerSubjects = {json.dumps(subjects, ensure_ascii=False, indent=4)};\n"
    )
    DATA_FILE.write_text(output, encoding="utf-8")


def main() -> int:
    subjects = [subject for subject in read_subjects() if SUPPLEMENT_MARKER not in subject.get("subject", "")]
    exam_first_units, exam_second_units = parse_exam_units()
    first_hifi = {"unit": "考古題風格高擬真補強題（第一科）", "questions": build_subject_one_hifi()}
    second_hifi = {"unit": "考古題風格高擬真補強題（第二科）", "questions": build_subject_two_hifi()}
    subjects.extend(
        [
            {
                "subject": f"第一科：人工智慧技術應用與規劃{SUPPLEMENT_MARKER}",
                "units": exam_first_units + [first_hifi],
                "multiUnits": [],
            },
            {
                "subject": f"第二科：大數據處理分析與應用{SUPPLEMENT_MARKER}",
                "units": exam_second_units + [second_hifi],
                "multiUnits": [],
            },
        ]
    )
    write_subjects(subjects)
    print(f"Wrote {DATA_FILE}")
    for subject in subjects:
        total = sum(len(unit["questions"]) for unit in subject.get("units", []))
        print(f"{subject['subject']}: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
