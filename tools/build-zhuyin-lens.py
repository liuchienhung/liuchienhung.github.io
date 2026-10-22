#!/usr/bin/env python3
"""產生 zhuyin-lens/zhuyin-data.js：「注音放大鏡」用的完整國字注音表（台灣讀音）。

讀音來源：教育部《重編國語辭典修訂本》（g0v/moedict-data 的 dict-revised.json，
repo 裡是 dict-revised.json.xz，解壓後使用）。
  python3 tools/build-zhuyin-lens.py path/to/dict-revised.json [--check]

做法（和 tools/build-jena-zhuyin.py 相同的規則，但收錄辭典裡所有的字）：
  1. 每個字的預設讀音 = 在辭典詞條中最常出現的讀音，再用人工修正（CHAR_FIX）。
     其他讀音也一起存下來，網頁上點字可以看到所有讀音（破音字）。
  2. 詞的讀音和逐字預設不同時，收進「詞」表（例如 銀行、長大、便宜）。只收 2～4 字的詞。
  3. 人工校對過的語境讀音：沿用家學堂的 CHAR_FIX、WORD_FIX，再加上逛街常見的詞（LENS_*）。
網頁執行時用最長詞比對：先查詞表，再用字的預設讀音。
--check 會印出 SAMPLE 裡逛街常見字詞的注音，方便人工檢查。
"""
import json, re, sys, collections, pathlib, importlib.util

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAXW = 4

_spec = importlib.util.spec_from_file_location('jena', ROOT / 'tools/build-jena-zhuyin.py')
jena = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(jena)
HAN, clean = jena.HAN, jena.clean

# 逛街常見字的預設讀音（優先於家學堂與統計）。原則：以教育部辭典為準，只在辭典的幾個讀音中選常用的那個。
LENS_CHAR_FIX = {
    '台': 'ㄊㄞˊ', '量': 'ㄌㄧㄤˋ', '折': 'ㄓㄜˊ', '號': 'ㄏㄠˋ', '蝦': 'ㄒㄧㄚ', '露': 'ㄌㄨˋ', '殼': 'ㄎㄜˊ',
}
# 逛街常見詞的語境讀音（詞 → 每字讀音，空白分隔）。辭典有的詞照辭典；這裡只放
# 辭典沒收的詞，或辭典第一個讀音不是逛街時的意思（例如 便宜＝價錢低）。
LENS_WORD_FIX = {
    '便宜': 'ㄆㄧㄢˊ ˙ㄧ', '量一量': 'ㄌㄧㄤˊ ㄧ ㄌㄧㄤˊ', '量身': 'ㄌㄧㄤˊ ㄕㄣ', '量體溫': 'ㄌㄧㄤˊ ㄊㄧˇ ㄨㄣ',
    '六折': 'ㄌㄧㄡˋ ㄓㄜˊ', '七折': 'ㄑㄧ ㄓㄜˊ', '八折': 'ㄅㄚ ㄓㄜˊ', '九折': 'ㄐㄧㄡˇ ㄓㄜˊ', '五折': 'ㄨˇ ㄓㄜˊ',
    '份量': 'ㄈㄣˋ ㄌㄧㄤˋ', '限購': 'ㄒㄧㄢˋ ㄍㄡˋ', '長褲': 'ㄔㄤˊ ㄎㄨˋ', '長袖': 'ㄔㄤˊ ㄒㄧㄡˋ', '褲子': 'ㄎㄨˋ ˙ㄗ',
    '台灣': 'ㄊㄞˊ ㄨㄢ', '櫃台': 'ㄍㄨㄟˋ ㄊㄞˊ', '服務台': 'ㄈㄨˊ ㄨˋ ㄊㄞˊ', '收銀台': 'ㄕㄡ ㄧㄣˊ ㄊㄞˊ',
    # 樓層的「地下」（地下一樓、地下街）；辭典第一個讀音是「地面上」的 ˙ㄒㄧㄚ
    '地下': 'ㄉㄧˋ ㄒㄧㄚˋ',
    # 店家的「行」唸 ㄏㄤˊ
    '眼鏡行': 'ㄧㄢˇ ㄐㄧㄥˋ ㄏㄤˊ', '機車行': 'ㄐㄧ ㄔㄜ ㄏㄤˊ', '五金行': 'ㄨˇ ㄐㄧㄣ ㄏㄤˊ', '琴行': 'ㄑㄧㄣˊ ㄏㄤˊ',
    '米行': 'ㄇㄧˇ ㄏㄤˊ', '布行': 'ㄅㄨˋ ㄏㄤˊ',
}
SAMPLE = [
    '特價99元', '鮮乳 牛奶', '結帳櫃台', '第二件六折', '小心地滑', '營業時間', '便利商店', '洗手間', '冷藏飲料', '銀行',
    '蘋果一盒', '買一送一', '會員價', '每人限購兩瓶', '售完為止', '新品上市', '有效日期', '保存期限', '成分', '熱量',
    '蛋白質', '脂肪', '碳水化合物', '鈉', '糖', '重量', '容量', '數量有限', '量販店', '停車場', '藥局', '電梯', '手扶梯',
    '出口', '入口', '推車', '購物籃', '收銀台', '找零', '發票', '載具', '統一編號', '塑膠袋', '環保袋', '請排隊',
    '請勿觸摸', '試吃', '試穿', '更衣室', '玩具', '文具', '衣服', '褲子', '鞋子', '襪子', '帽子', '餅乾', '糖果',
    '巧克力', '冰淇淋', '麵包', '蛋糕', '水果', '蔬菜', '豬肉', '雞蛋', '豆腐', '白米', '醬油', '調味料', '衛生紙',
    '洗髮精', '牙膏', '牙刷', '便當', '咖啡', '可樂', '果汁', '礦泉水', '珍珠奶茶', '少糖少冰', '大杯', '中杯', '小杯',
    '外帶', '內用', '自助洗衣', '樂透', '彩券', '一樓', '地下一樓', '美食街', '服務台', '寄物櫃', '哺乳室', '親子廁所',
    '長袖', '短袖', '長褲', '尺寸', '顏色', '紅色', '黑色', '還有', '還沒', '好吃', '好喝', '便宜', '很貴', '打折',
    '百貨公司', '超級市場', '傳統市場', '夜市', '大頭菜', '高麗菜', '空心菜', '地瓜', '番茄', '香蕉', '鳳梨', '西瓜',
    '芒果', '葡萄', '草莓', '奇異果', '火龍果', '柳丁', '橘子', '蘿蔔', '花椰菜', '玉米', '雞腿', '牛排', '鮭魚',
    '蝦子', '螃蟹', '冷凍食品', '泡麵', '飲水機', '提款機', '銀行', '郵局', '藥妝店', '眼鏡行', '書店', '花店',
]

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    d = json.load(open(src, encoding='utf-8'))
    words, chars, order = {}, collections.defaultdict(collections.Counter), collections.defaultdict(list)
    for e in d:
        t = e['title']
        if not HAN.fullmatch(t or ''):
            continue
        hs = [clean(h.get('bopomofo', '')) for h in e.get('heteronyms', []) if h.get('bopomofo')]
        if not hs:
            continue
        if len(t) == 1:
            for b in hs:
                chars[t][b] += 0
                if b not in order[t]:
                    order[t].append(b)
        else:
            sy = hs[0].split(' ')
            if len(sy) == len(t):
                words.setdefault(t, sy)
                for c, s in zip(t, sy):
                    chars[c][s] += 1
    fixc = {**jena.CHAR_FIX, **LENS_CHAR_FIX}
    cdef = {}
    for c, cnt in chars.items():
        cdef[c] = fixc.get(c) or cnt.most_common(1)[0][0]
    fixw = {}
    for w, r in {**jena.WORD_FIX, **LENS_WORD_FIX}.items():
        sy = r.split(' ')
        if len(sy) != len(w):
            sys.exit('WORD_FIX 字數不符：' + w)
        fixw[w] = sy
    allw = {w: sy for w, sy in words.items() if 2 <= len(w) <= MAXW}
    allw.update(fixw)
    # 只存讀音和逐字預設不同的詞（相同的不用存，網頁直接用字的預設讀音）
    exc = {w: sy for w, sy in allw.items() if any(cdef.get(c) != s for c, s in zip(w, sy))}
    maxw = max(len(w) for w in exc)
    creadings = {}
    for c in sorted(cdef):
        alts = [b for b in order.get(c, []) if b != cdef[c]]
        for s in chars[c]:
            if s != cdef[c] and s not in alts and chars[c][s] >= 2:
                alts.append(s)
        creadings[c] = '|'.join([cdef[c]] + alts)
    out = ROOT / 'zhuyin-lens/zhuyin-data.js'
    out.parent.mkdir(exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write('/* 注音放大鏡注音表（自動產生，請改 tools/build-zhuyin-lens.py）\n')
        f.write(' * 讀音來源：教育部《重編國語辭典修訂本》（CC BY-ND 3.0 TW），另經人工校對語境讀音。\n')
        f.write(' * ZLENS_C：字 → 讀音（第一個是預設，其餘以 | 分隔）；ZLENS_W：詞 → 每字讀音（空白分隔）。 */\n')
        f.write('window.ZLENS_MAXW=' + str(maxw) + ';\n')
        f.write('window.ZLENS_C=' + json.dumps(creadings, ensure_ascii=False, separators=(',', ':')) + ';\n')
        f.write('window.ZLENS_W=' + json.dumps({w: ' '.join(s) for w, s in sorted(exc.items())}, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'字 {len(creadings)}（破音字 {sum(1 for v in creadings.values() if "|" in v)}），詞 {len(exc)}，{out.stat().st_size // 1024} KB')
    if '--check' in sys.argv:
        def annotate(run):
            res, i = [], 0
            while i < len(run):
                for L in range(min(maxw, len(run) - i), 1, -1):
                    if run[i:i + L] in exc:
                        res += list(zip(run[i:i + L], exc[run[i:i + L]])); i += L; break
                else:
                    res.append((run[i], cdef.get(run[i], '?'))); i += 1
            return res
        for s in SAMPLE:
            print(s, ' '.join(f'{c}{b}' for run in HAN.findall(s) for c, b in annotate(run)))

if __name__ == '__main__':
    main()
