/*
 * 原版試卷報讀：頁面互動
 *
 * 版面原則：PDF 頁面以 pdf.js 直接繪製在 canvas 上，外框寬高固定為 PDF 頁面尺寸 × 縮放倍率，
 * 只做等比例縮放，不重排任何文字；點讀、高亮都畫在上方透明的 SVG 圖層，不影響原版面。
 */
(function () {
    'use strict';

    const PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/';
    const STORAGE_KEY = 'pdf-reader-settings-v1';
    const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
    const MAX_CANVAS_PIXELS = 16 * 1024 * 1024;
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const Layout = window.PdfReaderLayout;

    const $ = (id) => document.getElementById(id);
    const el = {
        intro: $('intro'),
        reader: $('reader'),
        drop: $('drop'),
        fileInput: $('file-input'),
        status: $('status'),
        fileName: $('file-name'),
        viewer: $('viewer'),
        btnHome: $('btn-home'),
        btnPlay: $('btn-play'),
        btnPrev: $('btn-prev'),
        btnNext: $('btn-next'),
        btnRepeat: $('btn-repeat'),
        btnStop: $('btn-stop'),
        btnSelect: $('btn-select'),
        btnSettings: $('btn-settings'),
        settings: $('settings'),
        rate: $('rate'),
        rateLabel: $('rate-label'),
        voice: $('voice'),
        voiceHint: $('voice-hint'),
        zoomIn: $('zoom-in'),
        zoomOut: $('zoom-out'),
        zoomFit: $('zoom-fit'),
        zoomLabel: $('zoom-label'),
        caption: $('caption'),
        captionTag: $('caption-tag'),
        showZones: $('show-zones'),
        showTargets: $('show-targets'),
        autoScroll: $('auto-scroll'),
        pronList: $('pron-list'),
        pronForm: $('pron-form'),
        pronFrom: $('pron-from'),
        pronTo: $('pron-to'),
        pronTest: $('pron-test'),
        btnFixPron: $('btn-fix-pron')
    };

    const settings = loadSettings();
    const state = {
        doc: null,
        loadToken: 0,
        pages: [],
        zoom: 1,
        cursor: null,          // { page, sentence } 目前（或上次）念到的句子
        playing: false,        // 是否連續朗讀
        selectMode: false,
        speechToken: 0,
        observer: null,
        rerenderTimer: null
    };

    function loadSettings() {
        const defaults = {
            rate: 0.9,
            voiceURI: '',
            targetMode: 'mask',
            zhuyinMode: 'read',
            showZones: false,
            showTargets: false,
            autoScroll: true,
            // 破音字讀音修正：遇到 from 改念 to（以同音字代替）
            pronunciations: [{ from: '抹布', to: '摸布' }]
        };
        try {
            const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
            return Object.assign(defaults, saved);
        } catch (error) {
            return defaults;
        }
    }

    function saveSettings() {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (error) {
            // 無痕模式等情況無法儲存，不影響使用
        }
    }

    function setStatus(text, isError) {
        el.status.textContent = text || '';
        el.status.classList.toggle('error', Boolean(isError));
    }

    function setCaption(tag, text) {
        el.captionTag.textContent = tag;
        el.caption.textContent = text;
        el.caption.title = text;
    }

    /* ---------- 語音 ---------- */

    const speech = {
        supported: typeof window !== 'undefined' && 'speechSynthesis' in window,
        voices: []
    };

    function refreshVoices() {
        if (!speech.supported) {
            el.voice.innerHTML = '<option>此瀏覽器不支援語音朗讀</option>';
            el.voice.disabled = true;
            el.voiceHint.textContent = '請改用最新版 Chrome、Edge 或 Safari。';
            return;
        }
        const all = window.speechSynthesis.getVoices() || [];
        const rank = (voice) => {
            const lang = (voice.lang || '').toLowerCase().replace('_', '-');
            if (lang === 'zh-tw' || lang.includes('hant')) return 0;
            if (lang === 'cmn-hant-tw') return 0;
            if (lang.startsWith('zh-cn') || lang.startsWith('cmn')) return 2;
            if (lang.startsWith('zh-hk')) return 3;
            if (lang.startsWith('zh')) return 1;
            return 9;
        };
        speech.voices = all.filter((voice) => rank(voice) < 9).sort((a, b) => rank(a) - rank(b));
        el.voice.innerHTML = '';
        if (!speech.voices.length) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '系統預設（未找到中文語音）';
            el.voice.appendChild(option);
            el.voiceHint.textContent = '裝置沒有中文語音時可能無法正確朗讀，可在系統設定中加裝「中文（台灣）」語音。';
            return;
        }
        speech.voices.forEach((voice) => {
            const option = document.createElement('option');
            option.value = voice.voiceURI;
            option.textContent = `${voice.name}（${voice.lang}）`;
            el.voice.appendChild(option);
        });
        const preferred = speech.voices.find((voice) => voice.voiceURI === settings.voiceURI) || speech.voices[0];
        el.voice.value = preferred.voiceURI;
        el.voiceHint.textContent = rank(preferred) === 0 ? '' : '建議選用「中文（台灣）」語音，發音較貼近國語課本。';
    }

    function currentVoice() {
        return speech.voices.find((voice) => voice.voiceURI === el.voice.value) || speech.voices[0] || null;
    }

    function cancelSpeech() {
        state.speechToken += 1;
        clearTimeout(speech.watchdog);
        if (speech.supported && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
            window.speechSynthesis.cancel();
        }
    }

    // iOS Safari 等瀏覽器要求「第一次發聲」必須發生在使用者點擊的當下；
    // 在第一次觸控／點擊時先送出一段無聲語音解鎖，之後連續朗讀才不會被擋掉。
    // Android Chrome 不需要解鎖，而且解鎖用的語音會和接著要念的句子互相取消，反而造成沒聲音，因此只在 iOS 執行。
    const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    function unlockSpeech() {
        if (!speech.supported || speech.unlocked || !IS_IOS) return;
        speech.unlocked = true;
        try {
            const silent = new SpeechSynthesisUtterance('');
            silent.volume = 0;
            silent.lang = 'zh-TW';
            window.speechSynthesis.speak(silent);
        } catch (error) {
            // 解鎖失敗不影響後續操作
        }
    }

    function showNoSoundHint(reason) {
        const tips = reason === 'not-allowed'
            ? '瀏覽器擋下了語音播放，請再點一次文字或按「▶ 朗讀」。'
            : (IS_IOS
                ? '沒有聽到聲音？請確認音量已開啟、iPhone／iPad 側邊靜音鍵未開啟，並在「⚙️ 設定」選擇中文（台灣）語音。'
                : '沒有聽到聲音？請調高「媒體音量」，並到手機「設定 › 協助工具 › 文字轉語音輸出」確認已安裝中文語音；也可在「⚙️ 設定」換一個語音。');
        setCaption('沒有聲音', tips);
    }

    // 注意：必須在點擊事件中「同步」呼叫，不可先 await 或 setTimeout，否則行動裝置會靜默擋下
    function speak(rawText, onDone) {
        const text = rawText ? applyPronunciations(rawText) : rawText;
        cancelSpeech();
        const token = state.speechToken;
        if (!speech.supported || !text) {
            if (onDone) setTimeout(() => token === state.speechToken && onDone(), text ? 0 : 50);
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = currentVoice();
        if (voice) utterance.voice = voice;
        // Android 回報的語言常是「zh_TW」，直接套用不是合法語言代碼，會讓語音引擎不出聲
        const voiceLang = voice && voice.lang ? voice.lang.replace(/_/g, '-') : '';
        utterance.lang = /^zh-(CN|HK)/i.test(voiceLang) ? voiceLang : 'zh-TW';
        utterance.rate = settings.rate;
        utterance.volume = 1;
        utterance.pitch = 1;
        let started = false;
        const finish = () => {
            if (token !== state.speechToken) return;
            clearTimeout(speech.watchdog);
            if (onDone) onDone();
        };
        utterance.onstart = () => {
            started = true;
            clearTimeout(speech.watchdog);
        };
        utterance.onend = finish;
        utterance.onerror = (event) => {
            if (event.error === 'interrupted' || event.error === 'canceled') return;
            if (token !== state.speechToken) return;
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                speech.unlocked = false;
                state.playing = false;
                updatePlayButton();
                showNoSoundHint('not-allowed');
                return;
            }
            finish();
        };
        // 保留參考，避免 Chrome 在朗讀途中把物件回收，造成中斷或 onend 不觸發
        speech.current = utterance;
        speech.unlocked = true;
        window.speechSynthesis.speak(utterance);
        speech.watchdog = setTimeout(() => {
            if (token === state.speechToken && !started && !window.speechSynthesis.speaking) {
                showNoSoundHint();
            }
        }, 3000);
    }

    function applyPronunciations(text) {
        const rules = (settings.pronunciations || [])
            .filter((rule) => rule && rule.from && rule.to)
            .sort((a, b) => b.from.length - a.from.length);
        if (!rules.length) return text;
        // 一次掃描，長詞優先，避免替換後的文字又被其他規則改到
        const pattern = new RegExp(rules.map((rule) => rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
        const lookup = new Map(rules.map((rule) => [rule.from, rule.to]));
        return text.replace(pattern, (match) => lookup.get(match) || match);
    }

    function renderPronunciations() {
        el.pronList.textContent = '';
        const rules = settings.pronunciations || [];
        if (!rules.length) {
            const empty = document.createElement('li');
            empty.className = 'empty';
            empty.textContent = '尚未設定';
            el.pronList.appendChild(empty);
            return;
        }
        rules.forEach((rule, index) => {
            const item = document.createElement('li');
            const label = document.createElement('span');
            label.textContent = `${rule.from} → ${rule.to}`;
            const play = document.createElement('button');
            play.type = 'button';
            play.textContent = '🔊';
            play.setAttribute('aria-label', `試聽 ${rule.to}`);
            play.addEventListener('click', () => speak(rule.to));
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = '✕';
            remove.setAttribute('aria-label', `刪除 ${rule.from}`);
            remove.addEventListener('click', () => {
                settings.pronunciations.splice(index, 1);
                saveSettings();
                renderPronunciations();
            });
            item.append(label, play, remove);
            el.pronList.appendChild(item);
        });
    }

    function speechOptions() {
        return { targetMode: settings.targetMode, zhuyinOnlyMode: settings.zhuyinMode };
    }

    /* ---------- 載入 PDF ---------- */

    function ensurePdfJs() {
        if (typeof window.pdfjsLib === 'undefined') {
            throw new Error('PDF 元件尚未載入，請確認網路連線後重新整理頁面。');
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}build/pdf.worker.min.js`;
        return window.pdfjsLib;
    }

    async function openFile(file) {
        if (!file) return;
        if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) {
            setStatus('請選擇 PDF 檔案。', true);
            return;
        }
        let pdfjsLib;
        try {
            pdfjsLib = ensurePdfJs();
        } catch (error) {
            setStatus(error.message, true);
            return;
        }
        setStatus('正在開啟 PDF…');
        const token = ++state.loadToken;
        try {
            const data = new Uint8Array(await file.arrayBuffer());
            const doc = await pdfjsLib.getDocument({
                data,
                cMapUrl: `${PDFJS_BASE}cmaps/`,
                cMapPacked: true,
                standardFontDataUrl: `${PDFJS_BASE}standard_fonts/`
            }).promise;
            if (token !== state.loadToken) return;
            await showDocument(doc, file.name);
            setStatus('');
        } catch (error) {
            console.error(error);
            setStatus(error && error.name === 'PasswordException'
                ? '這份 PDF 有密碼保護，請先解除密碼再上傳。'
                : '無法開啟這份 PDF，檔案可能已損毀。', true);
        }
    }

    async function showDocument(doc, name) {
        closeDocument();
        state.doc = doc;
        el.fileName.textContent = name;
        document.title = `${name} - 原版試卷報讀`;
        el.intro.style.display = 'none';
        el.reader.classList.add('show');

        for (let num = 1; num <= doc.numPages; num += 1) {
            const page = await doc.getPage(num);
            if (state.doc !== doc) return;
            const viewport = page.getViewport({ scale: 1 });
            state.pages.push(createSheet(num, page, viewport));
        }
        fitWidth();
        setupObserver();
        setCaption('提示', '點選試卷上的文字即可朗讀；按「▶ 朗讀」從頭連續念。');
        // 在背景依序分析各頁的閱讀順序
        analyzeAll(doc);
    }

    function closeDocument() {
        stopReading();
        if (state.observer) state.observer.disconnect();
        state.pages.forEach((p) => {
            if (p.renderTask) p.renderTask.cancel();
        });
        if (state.doc) state.doc.destroy();
        state.doc = null;
        state.pages = [];
        state.cursor = null;
        el.viewer.innerHTML = '';
    }

    function backToIntro() {
        closeDocument();
        state.loadToken += 1;
        el.reader.classList.remove('show');
        el.intro.style.display = '';
        el.fileInput.value = '';
        document.title = '原版試卷報讀';
    }

    /* ---------- 頁面 ---------- */

    function svgEl(tag, attrs) {
        const node = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
        return node;
    }

    function createSheet(num, page, viewport) {
        const sheet = document.createElement('div');
        sheet.className = 'sheet';
        sheet.dataset.page = String(num);
        sheet.setAttribute('aria-label', `第 ${num} 頁`);

        const label = document.createElement('span');
        label.className = 'page-no';
        label.textContent = `第 ${num} 頁 / 共 ${state.doc.numPages} 頁`;

        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.textContent = '載入中…';

        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');

        const svg = svgEl('svg', {
            viewBox: `0 0 ${viewport.width} ${viewport.height}`,
            preserveAspectRatio: 'none'
        });
        const layers = {
            zones: svgEl('g', { class: 'zones-layer' }),
            targets: svgEl('g', { class: 'targets-layer' }),
            hover: svgEl('g', { class: 'hover-layer' }),
            highlight: svgEl('g', { class: 'hl-layer' }),
            marquee: svgEl('rect', { class: 'marquee', visibility: 'hidden' })
        };
        Object.values(layers).forEach((layer) => svg.appendChild(layer));

        sheet.append(label, canvas, loading, svg);
        el.viewer.appendChild(sheet);

        const record = {
            num,
            index: num - 1,
            page,
            viewport,
            sheet,
            canvas,
            svg,
            layers,
            loading,
            renderedZoom: 0,
            renderTask: null,
            visible: false,
            analysis: null,
            analysisPromise: null
        };
        bindSheetEvents(record);
        return record;
    }

    function applyZoom(zoom, keepAnchor) {
        const clamped = Math.min(4, Math.max(0.25, zoom));
        const anchor = keepAnchor ? scrollAnchor() : null;
        state.zoom = clamped;
        el.zoomLabel.textContent = `${Math.round(clamped * 100)}%`;
        state.pages.forEach((p) => {
            // 外框尺寸 = PDF 頁面尺寸 × 縮放倍率，長寬比永遠與原檔相同
            p.sheet.style.width = `${p.viewport.width * clamped}px`;
            p.sheet.style.height = `${p.viewport.height * clamped}px`;
        });
        if (anchor) restoreAnchor(anchor);
        clearTimeout(state.rerenderTimer);
        state.rerenderTimer = setTimeout(() => {
            state.pages.filter((p) => p.visible).forEach(renderPage);
        }, 160);
    }

    function scrollAnchor() {
        const sheet = state.pages.find((p) => p.sheet.getBoundingClientRect().bottom > 80);
        if (!sheet) return null;
        const rect = sheet.sheet.getBoundingClientRect();
        return { sheet, ratio: (80 - rect.top) / rect.height };
    }

    function restoreAnchor(anchor) {
        const rect = anchor.sheet.sheet.getBoundingClientRect();
        window.scrollBy(0, rect.top + anchor.ratio * rect.height - 80);
    }

    function fitWidth() {
        if (!state.pages.length) return;
        const widest = Math.max(...state.pages.map((p) => p.viewport.width));
        const available = Math.max(200, el.viewer.clientWidth - 24);
        applyZoom(available / widest, false);
    }

    function stepZoom(direction) {
        const current = state.zoom;
        const next = direction > 0
            ? ZOOM_STEPS.find((z) => z > current + 0.01) || ZOOM_STEPS[ZOOM_STEPS.length - 1]
            : ZOOM_STEPS.slice().reverse().find((z) => z < current - 0.01) || ZOOM_STEPS[0];
        applyZoom(next, true);
    }

    function setupObserver() {
        if (state.observer) state.observer.disconnect();
        if (!('IntersectionObserver' in window)) {
            state.pages.forEach((p) => { p.visible = true; renderPage(p); });
            return;
        }
        state.observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const record = state.pages.find((p) => p.sheet === entry.target);
                if (!record) return;
                record.visible = entry.isIntersecting;
                if (entry.isIntersecting) renderPage(record);
            });
        }, { rootMargin: '800px 0px' });
        state.pages.forEach((p) => state.observer.observe(p.sheet));
    }

    async function renderPage(record) {
        const zoom = state.zoom;
        if (record.renderedZoom === zoom && !record.renderTask) return;
        if (record.renderTask) {
            record.renderTask.cancel();
            record.renderTask = null;
        }
        const dpr = window.devicePixelRatio || 1;
        let scale = zoom * dpr;
        const pixels = record.viewport.width * record.viewport.height * scale * scale;
        if (pixels > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
        const viewport = record.page.getViewport({ scale });

        // 先畫在暫存 canvas，完成後再替換，避免縮放時畫面閃白
        const target = document.createElement('canvas');
        target.width = Math.floor(viewport.width);
        target.height = Math.floor(viewport.height);
        const task = record.page.render({
            canvasContext: target.getContext('2d', { alpha: false }),
            viewport,
            background: 'rgb(255,255,255)'
        });
        record.renderTask = task;
        try {
            await task.promise;
        } catch (error) {
            if (error && error.name === 'RenderingCancelledException') return;
            console.error(error);
            record.loading.textContent = '此頁無法顯示';
            return;
        } finally {
            if (record.renderTask === task) record.renderTask = null;
        }
        target.setAttribute('aria-hidden', 'true');
        record.canvas.replaceWith(target);
        record.canvas = target;
        record.renderedZoom = zoom;
        record.loading.remove();
    }

    /* ---------- 版面分析 ---------- */

    function analyzePage(record) {
        if (!record.analysisPromise) {
            record.analysisPromise = (async () => {
                // 先取得繪圖指令，讓字型載入，才能讀到真實字型名稱（判斷注音字型）
                await record.page.getOperatorList();
                const textContent = await record.page.getTextContent();
                const fontInfo = {};
                textContent.items.forEach((item) => {
                    if (!item.fontName || fontInfo[item.fontName]) return;
                    try {
                        if (record.page.commonObjs.has(item.fontName)) {
                            const font = record.page.commonObjs.get(item.fontName);
                            if (font && font.name) fontInfo[item.fontName] = font.name;
                        }
                    } catch (error) {
                        // 讀不到字型名稱時當一般字型處理
                    }
                });
                const analysis = Layout.analyzePage(textContent, record.viewport, fontInfo);
                analysis.sentences.forEach((sentence) => {
                    sentence.page = record.index;
                    sentence.glyphs.forEach((g, i) => { g.seq = sentence.index * 10000 + i; });
                });
                record.analysis = analysis;
                drawStaticLayers(record);
                if (!analysis.sentences.length) {
                    const notice = document.createElement('div');
                    notice.className = 'notice';
                    notice.textContent = '這一頁沒有可讀取的文字（可能是掃描圖檔），無法點讀';
                    record.sheet.appendChild(notice);
                }
                return analysis;
            })().catch((error) => {
                console.error(error);
                record.analysis = { glyphs: [], sentences: [], chains: [] };
                return record.analysis;
            });
        }
        return record.analysisPromise;
    }

    async function analyzeAll(doc) {
        for (const record of state.pages) {
            if (state.doc !== doc) return;
            await analyzePage(record);
        }
    }

    function sentenceRects(glyphs) {
        // 把同一行相連的字合併成一個矩形，高亮看起來比較整齊
        const rects = [];
        let box = null;
        glyphs.forEach((g) => {
            const s = Math.max(4, Math.min(g.size, Math.max(g.x1 - g.x0, g.y1 - g.y0)));
            if (box) {
                const xo = Math.min(box.x1, g.x1) - Math.max(box.x0, g.x0);
                const yo = Math.min(box.y1, g.y1) - Math.max(box.y0, g.y0);
                const vertical = xo > 0.4 * Math.min(box.x1 - box.x0, g.x1 - g.x0) && g.y0 - box.y1 < 1.2 * s && g.y1 > box.y0;
                const horizontal = yo > 0.4 * Math.min(box.y1 - box.y0, g.y1 - g.y0) && g.x0 - box.x1 < 1.2 * s && g.x1 > box.x0;
                if (vertical || horizontal) {
                    box.x0 = Math.min(box.x0, g.x0);
                    box.y0 = Math.min(box.y0, g.y0);
                    box.x1 = Math.max(box.x1, g.x1);
                    box.y1 = Math.max(box.y1, g.y1);
                    return;
                }
                rects.push(box);
            }
            box = { x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1 };
        });
        if (box) rects.push(box);
        return rects;
    }

    function fillRects(layer, rects, className) {
        layer.textContent = '';
        rects.forEach((r) => {
            layer.appendChild(svgEl('rect', {
                class: className,
                x: r.x0 - 1,
                y: r.y0 - 1,
                width: r.x1 - r.x0 + 2,
                height: r.y1 - r.y0 + 2,
                rx: 2
            }));
        });
    }

    function drawStaticLayers(record) {
        const analysis = record.analysis;
        if (!analysis) return;
        if (settings.showZones) {
            fillRects(record.layers.zones, analysis.sentences.flatMap((s) => sentenceRects(s.glyphs)), 'zone');
        } else {
            record.layers.zones.textContent = '';
        }
        if (settings.showTargets) {
            const special = analysis.glyphs.filter((g) => g.role === 'target' ||
                (g.kind === 'zhuyin-only' && settings.zhuyinMode === 'mask'));
            fillRects(record.layers.targets, special.map((g) => g), 'target');
        } else {
            record.layers.targets.textContent = '';
        }
    }

    /* ---------- 點讀與連續朗讀 ---------- */

    function clearHighlights() {
        state.pages.forEach((p) => { p.layers.highlight.textContent = ''; });
    }

    function highlight(record, glyphs) {
        clearHighlights();
        fillRects(record.layers.highlight, sentenceRects(glyphs), 'hl');
        if (settings.autoScroll || !state.playing) scrollToGlyphs(record, glyphs);
    }

    function scrollToGlyphs(record, glyphs) {
        if (!glyphs.length) return;
        const box = glyphs.reduce((acc, g) => ({
            x0: Math.min(acc.x0, g.x0), y0: Math.min(acc.y0, g.y0),
            x1: Math.max(acc.x1, g.x1), y1: Math.max(acc.y1, g.y1)
        }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
        const rect = record.sheet.getBoundingClientRect();
        const zoom = rect.width / record.viewport.width;
        const top = rect.top + box.y0 * zoom;
        const bottom = rect.top + box.y1 * zoom;
        const left = rect.left + box.x0 * zoom;
        const right = rect.left + box.x1 * zoom;
        const head = document.querySelector('.reader-head');
        const toolbarBottom = head ? Math.max(0, head.getBoundingClientRect().bottom) : 0;
        const viewTop = toolbarBottom + 8;
        const viewBottom = window.innerHeight - 12;
        if (top < viewTop || bottom > viewBottom) {
            const height = bottom - top;
            const delta = height > viewBottom - viewTop
                ? top - viewTop
                : top - viewTop - (viewBottom - viewTop - height) / 2;
            window.scrollBy({ top: delta, behavior: 'smooth' });
        }
        const viewerRect = el.viewer.getBoundingClientRect();
        if (left < viewerRect.left || right > viewerRect.right) {
            el.viewer.scrollBy({ left: (left + right) / 2 - (viewerRect.left + viewerRect.right) / 2, behavior: 'smooth' });
        }
    }

    function sentenceAt(cursor) {
        const record = state.pages[cursor.page];
        if (!record || !record.analysis) return null;
        return record.analysis.sentences[cursor.sentence] || null;
    }

    function readSentence(cursor, onDone) {
        const record = state.pages[cursor.page];
        const sentence = sentenceAt(cursor);
        if (!sentence) return;
        state.cursor = { page: cursor.page, sentence: cursor.sentence };
        const text = Layout.buildSpeech(sentence.glyphs, speechOptions());
        highlight(record, sentence.glyphs);
        setCaption(`第 ${cursor.page + 1} 頁`, Layout.buildSpeech(sentence.glyphs, { display: true }));
        speak(text, onDone);
    }

    // 只用已分析完成的頁面找相鄰句子；遇到尚未分析的頁面回傳 undefined
    function neighbourCursorSync(cursor, direction) {
        let page = cursor.page;
        let index = cursor.sentence + direction;
        while (page >= 0 && page < state.pages.length) {
            const analysis = state.pages[page].analysis;
            if (!analysis) return undefined;
            if (index < 0) index = analysis.sentences.length - 1;
            if (index >= 0 && index < analysis.sentences.length) return { page, sentence: index };
            page += direction;
            index = direction > 0 ? 0 : -1;
        }
        return null;
    }

    async function neighbourCursor(cursor, direction) {
        const ready = neighbourCursorSync(cursor, direction);
        if (ready !== undefined) return ready;
        let page = cursor.page;
        let index = cursor.sentence + direction;
        while (page >= 0 && page < state.pages.length) {
            const analysis = await analyzePage(state.pages[page]);
            if (index < 0) index = analysis.sentences.length - 1;
            if (index >= 0 && index < analysis.sentences.length) return { page, sentence: index };
            page += direction;
            index = direction > 0 ? 0 : -1;
        }
        return null;
    }

    async function firstCursor() {
        return neighbourCursor({ page: 0, sentence: -1 }, 1);
    }

    function updatePlayButton() {
        el.btnPlay.textContent = state.playing ? '⏸ 暫停' : '▶ 朗讀';
        el.btnPlay.title = state.playing ? '暫停連續朗讀（空白鍵）' : '從目前位置開始連續朗讀（空白鍵）';
    }

    async function startReading() {
        if (!state.doc) return;
        unlockSpeech();
        let cursor = state.cursor || neighbourCursorSync({ page: 0, sentence: -1 }, 1);
        if (cursor === undefined) cursor = await firstCursor();
        if (!cursor) {
            setCaption('提示', '這份 PDF 沒有可朗讀的文字。');
            return;
        }
        state.playing = true;
        updatePlayButton();
        playFrom(cursor);
    }

    function playFrom(cursor) {
        readSentence(cursor, async () => {
            if (!state.playing) return;
            const next = await neighbourCursor(cursor, 1);
            if (!state.playing) return;
            if (!next) {
                stopReading();
                setCaption('完成', '已念完整份試卷。');
                return;
            }
            playFrom(next);
        });
    }

    function pauseReading() {
        state.playing = false;
        updatePlayButton();
        cancelSpeech();
    }

    function stopReading() {
        state.playing = false;
        updatePlayButton();
        cancelSpeech();
        clearHighlights();
    }

    async function step(direction) {
        if (!state.doc) return;
        const base = state.cursor || (direction > 0 ? { page: 0, sentence: -1 } : null);
        if (!base) return;
        unlockSpeech();
        let target = neighbourCursorSync(base, direction);
        if (target === undefined) target = await neighbourCursor(base, direction);
        if (!target) return;
        if (state.playing) playFrom(target); else readSentence(target);
    }

    function repeat() {
        if (!state.cursor) return;
        if (state.playing) playFrom(state.cursor); else readSentence(state.cursor);
    }

    /* ---------- 點選與框選 ---------- */

    function pagePoint(record, event) {
        const rect = record.sheet.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) / rect.width * record.viewport.width,
            y: (event.clientY - rect.top) / rect.height * record.viewport.height
        };
    }

    function glyphAt(record, point) {
        const analysis = record.analysis;
        if (!analysis) return null;
        let best = null;
        let bestDistance = Infinity;
        analysis.glyphs.forEach((g) => {
            if (typeof g.sentence !== 'number') return;
            const pad = 0.25 * g.size;
            const dx = Math.max(g.x0 - pad - point.x, 0, point.x - g.x1 - pad);
            const dy = Math.max(g.y0 - pad - point.y, 0, point.y - g.y1 - pad);
            const distance = Math.hypot(dx, dy);
            if (distance < bestDistance && distance <= 0.8 * g.size) {
                bestDistance = distance;
                best = g;
            }
        });
        return best;
    }

    function bindSheetEvents(record) {
        let drag = null;

        record.sheet.addEventListener('pointerdown', (event) => {
            if (!state.selectMode || event.button > 0) return;
            event.preventDefault();
            record.sheet.setPointerCapture(event.pointerId);
            drag = { start: pagePoint(record, event), end: null };
        });

        record.sheet.addEventListener('pointermove', (event) => {
            if (drag) {
                drag.end = pagePoint(record, event);
                const x = Math.min(drag.start.x, drag.end.x);
                const y = Math.min(drag.start.y, drag.end.y);
                Object.entries({
                    x, y,
                    width: Math.abs(drag.end.x - drag.start.x),
                    height: Math.abs(drag.end.y - drag.start.y),
                    visibility: 'visible'
                }).forEach(([key, value]) => record.layers.marquee.setAttribute(key, value));
                return;
            }
            if (event.pointerType !== 'mouse' || state.selectMode || !record.analysis) return;
            const glyph = glyphAt(record, pagePoint(record, event));
            const key = glyph ? glyph.sentence : -1;
            if (record.hoverKey === key) return;
            record.hoverKey = key;
            record.sheet.classList.toggle('hit', Boolean(glyph));
            record.sheet.style.cursor = glyph ? 'pointer' : '';
            if (glyph) {
                fillRects(record.layers.hover, sentenceRects(record.analysis.sentences[glyph.sentence].glyphs), 'hover');
            } else {
                record.layers.hover.textContent = '';
            }
        });

        record.sheet.addEventListener('pointerleave', () => {
            record.hoverKey = null;
            record.layers.hover.textContent = '';
        });

        const finishDrag = async (event) => {
            if (!drag) return;
            const { start } = drag;
            const end = drag.end || start;
            drag = null;
            record.layers.marquee.setAttribute('visibility', 'hidden');
            if (event.type === 'pointercancel') return;
            const x0 = Math.min(start.x, end.x);
            const x1 = Math.max(start.x, end.x);
            const y0 = Math.min(start.y, end.y);
            const y1 = Math.max(start.y, end.y);
            const analysis = record.analysis || await analyzePage(record);
            if (x1 - x0 < 4 && y1 - y0 < 4) {
                // 框選模式下單點一下，仍當作點讀
                clickRead(record, start);
                return;
            }
            const inside = analysis.glyphs
                .filter((g) => typeof g.sentence === 'number')
                .filter((g) => {
                    const cx = (g.x0 + g.x1) / 2;
                    const cy = (g.y0 + g.y1) / 2;
                    return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
                })
                .sort((a, b) => a.seq - b.seq);
            if (!inside.length) {
                setCaption('框選', '框內沒有可朗讀的文字。');
                return;
            }
            pauseReading();
            const text = Layout.buildSpeech(inside, speechOptions());
            clearHighlights();
            fillRects(record.layers.highlight, sentenceRects(inside), 'hl');
            setCaption('框選', Layout.buildSpeech(inside, { display: true }));
            speak(text);
        };
        record.sheet.addEventListener('pointerup', finishDrag);
        record.sheet.addEventListener('pointercancel', finishDrag);

        record.sheet.addEventListener('click', async (event) => {
            if (state.selectMode) return;
            unlockSpeech();
            if (!record.analysis) await analyzePage(record);
            clickRead(record, pagePoint(record, event));
        });
    }

    function clickRead(record, point) {
        const glyph = glyphAt(record, point);
        if (!glyph) return;
        const cursor = { page: record.index, sentence: glyph.sentence };
        if (state.playing) {
            playFrom(cursor);
        } else {
            readSentence(cursor);
        }
    }

    function toggleSelectMode() {
        state.selectMode = !state.selectMode;
        el.btnSelect.classList.toggle('on', state.selectMode);
        el.btnSelect.setAttribute('aria-pressed', String(state.selectMode));
        state.pages.forEach((p) => {
            p.sheet.classList.toggle('select-mode', state.selectMode);
            p.layers.hover.textContent = '';
        });
        setCaption('提示', state.selectMode
            ? '框選模式：在試卷上拖曳拉出範圍，放開後念出框內文字。'
            : '點選試卷上的文字即可朗讀。');
    }

    /* ---------- 事件 ---------- */

    function bindEvents() {
        el.fileInput.addEventListener('change', () => openFile(el.fileInput.files[0]));
        ['dragenter', 'dragover'].forEach((type) => el.drop.addEventListener(type, (event) => {
            event.preventDefault();
            el.drop.classList.add('drag');
        }));
        ['dragleave', 'drop'].forEach((type) => el.drop.addEventListener(type, (event) => {
            event.preventDefault();
            el.drop.classList.remove('drag');
        }));
        el.drop.addEventListener('drop', (event) => {
            const file = event.dataTransfer && event.dataTransfer.files[0];
            openFile(file);
        });

        el.btnHome.addEventListener('click', backToIntro);
        el.btnPlay.addEventListener('click', () => (state.playing ? pauseReading() : startReading()));
        el.btnStop.addEventListener('click', () => {
            stopReading();
            setCaption('提示', '已停止。點選文字或按「▶ 朗讀」繼續。');
        });
        el.btnPrev.addEventListener('click', () => step(-1));
        el.btnNext.addEventListener('click', () => step(1));
        el.btnRepeat.addEventListener('click', repeat);
        el.btnSelect.addEventListener('click', toggleSelectMode);
        el.btnSettings.addEventListener('click', () => {
            const open = !el.settings.classList.contains('show');
            el.settings.classList.toggle('show', open);
            el.btnSettings.setAttribute('aria-expanded', String(open));
        });

        el.rate.value = String(settings.rate);
        el.rateLabel.textContent = Number(settings.rate).toFixed(1);
        el.rate.addEventListener('input', () => {
            settings.rate = Number(el.rate.value);
            el.rateLabel.textContent = settings.rate.toFixed(1);
            saveSettings();
        });
        el.voice.addEventListener('change', () => {
            settings.voiceURI = el.voice.value;
            saveSettings();
            refreshVoices();
        });

        document.querySelectorAll('input[name="target-mode"]').forEach((input) => {
            input.checked = input.value === settings.targetMode;
            input.addEventListener('change', () => {
                settings.targetMode = input.value;
                saveSettings();
                state.pages.forEach(drawStaticLayers);
            });
        });
        document.querySelectorAll('input[name="zhuyin-mode"]').forEach((input) => {
            input.checked = input.value === settings.zhuyinMode;
            input.addEventListener('change', () => {
                settings.zhuyinMode = input.value;
                saveSettings();
                state.pages.forEach(drawStaticLayers);
            });
        });
        [['showZones', el.showZones], ['showTargets', el.showTargets], ['autoScroll', el.autoScroll]].forEach(([key, input]) => {
            input.checked = Boolean(settings[key]);
            input.addEventListener('change', () => {
                settings[key] = input.checked;
                saveSettings();
                state.pages.forEach(drawStaticLayers);
            });
        });

        renderPronunciations();
        el.pronForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const from = el.pronFrom.value.trim();
            const to = el.pronTo.value.trim();
            if (!from || !to) return;
            settings.pronunciations = (settings.pronunciations || []).filter((rule) => rule.from !== from);
            settings.pronunciations.push({ from, to });
            saveSettings();
            renderPronunciations();
            el.pronFrom.value = '';
            el.pronTo.value = '';
            el.pronFrom.focus();
        });
        el.pronTest.addEventListener('click', () => {
            const to = el.pronTo.value.trim();
            if (to) speak(to);
        });
        el.btnFixPron.addEventListener('click', () => {
            el.settings.classList.add('show');
            el.btnSettings.setAttribute('aria-expanded', 'true');
            el.pronFrom.scrollIntoView({ block: 'center', behavior: 'smooth' });
            el.pronFrom.focus({ preventScroll: true });
        });

        el.zoomIn.addEventListener('click', () => stepZoom(1));
        el.zoomOut.addEventListener('click', () => stepZoom(-1));
        el.zoomFit.addEventListener('click', fitWidth);

        document.addEventListener('keydown', (event) => {
            if (!state.doc || event.altKey || event.ctrlKey || event.metaKey) return;
            const tag = (event.target && event.target.tagName) || '';
            if (/INPUT|SELECT|TEXTAREA/.test(tag)) return;
            if (event.key === ' ' && tag !== 'BUTTON') {
                event.preventDefault();
                if (state.playing) pauseReading(); else startReading();
            } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown' && event.shiftKey) {
                event.preventDefault();
                step(1);
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' && event.shiftKey) {
                event.preventDefault();
                step(-1);
            } else if (event.key === 'Escape') {
                stopReading();
            } else if (event.key === 'r' || event.key === 'R') {
                repeat();
            } else if (event.key === '+' || event.key === '=') {
                stepZoom(1);
            } else if (event.key === '-') {
                stepZoom(-1);
            }
        });

        if (speech.supported) {
            refreshVoices();
            if ('onvoiceschanged' in window.speechSynthesis) {
                window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
            }
        } else {
            refreshVoices();
        }

        ['pointerdown', 'touchend', 'keydown'].forEach((type) => {
            document.addEventListener(type, unlockSpeech, { capture: true, passive: true });
        });

        window.addEventListener('beforeunload', cancelSpeech);
    }

    bindEvents();
}());
