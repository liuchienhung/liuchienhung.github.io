class ExamReaderApp {
    constructor() {
        this.state = {
            file: null,
            pages: [],
            questions: [],
            selectedQuestionId: null,
            selectedPageNumber: 1,
            speechRate: 1,
            isAnalyzing: false,
            lastAnalysisTitle: ''
        };

        this.sectionTypeMap = {
            '寫國字或注音': 'fill-in',
            '改錯字': 'correction',
            '連連看': 'matching',
            '選擇題': 'multiple-choice',
            '照樣寫短語': 'phrase',
            '造句': 'sentence',
            '閱讀測驗': 'reading'
        };

        this.typeLabelMap = {
            'multiple-choice': '選擇題',
            'reading-choice': '閱讀選擇',
            'fill-in': '書寫填答',
            'correction': '改錯字',
            'matching': '配對題',
            'phrase': '短語題',
            'sentence': '造句題',
            'reading': '閱讀測驗',
            'unknown': '待確認'
        };

        this.initializeElements();
        this.bindEvents();
        this.renderInitialState();
    }

    initializeElements() {
        this.serviceHome = document.getElementById('service-home');
        this.quizServiceApp = document.getElementById('quiz-service-app');
        this.readerServiceApp = document.getElementById('reader-service-app');

        this.openReaderServiceBtn = document.getElementById('open-reader-service');
        this.openReaderServiceSecondaryBtn = document.getElementById('open-reader-service-secondary');
        this.readerBackToHomeBtn = document.getElementById('reader-back-to-home');

        this.liveServiceCount = document.getElementById('live-service-count');

        this.fileInput = document.getElementById('reader-file-input');
        this.analyzeBtn = document.getElementById('reader-analyze-btn');
        this.clearBtn = document.getElementById('reader-clear-btn');
        this.exportBtn = document.getElementById('reader-export-json');
        this.stopSpeechBtn = document.getElementById('reader-stop-speech');

        this.layoutModeSelect = document.getElementById('reader-layout-mode');
        this.ocrModeSelect = document.getElementById('reader-ocr-mode');
        this.rateInput = document.getElementById('reader-rate-input');

        this.statusBox = document.getElementById('reader-status');
        this.statusLog = document.getElementById('reader-status-log');

        this.pageList = document.getElementById('reader-page-list');
        this.previewMeta = document.getElementById('reader-preview-meta');
        this.pageCanvasWrap = document.getElementById('reader-page-canvas-wrap');
        this.prevPageBtn = document.getElementById('reader-prev-page');
        this.nextPageBtn = document.getElementById('reader-next-page');

        this.summaryPages = document.getElementById('reader-summary-pages');
        this.summaryQuestions = document.getElementById('reader-summary-questions');
        this.summaryChoice = document.getElementById('reader-summary-choice');
        this.summaryWarning = document.getElementById('reader-summary-warning');

        this.questionList = document.getElementById('reader-question-list');
        this.detailCard = document.getElementById('reader-detail-card');
    }

    bindEvents() {
        if (this.openReaderServiceBtn) {
            this.openReaderServiceBtn.addEventListener('click', () => this.enterReaderService());
        }
        if (this.openReaderServiceSecondaryBtn) {
            this.openReaderServiceSecondaryBtn.addEventListener('click', () => this.enterReaderService());
        }
        if (this.readerBackToHomeBtn) {
            this.readerBackToHomeBtn.addEventListener('click', () => this.returnToHome());
        }
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (event) => this.handleFileSelection(event));
        }
        if (this.analyzeBtn) {
            this.analyzeBtn.addEventListener('click', () => this.analyzeSelectedFile());
        }
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clearAnalysis());
        }
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.exportAnalysisJson());
        }
        if (this.stopSpeechBtn) {
            this.stopSpeechBtn.addEventListener('click', () => this.stopSpeech());
        }
        if (this.rateInput) {
            this.rateInput.addEventListener('input', () => {
                this.state.speechRate = Number(this.rateInput.value || 1);
            });
        }
        if (this.prevPageBtn) {
            this.prevPageBtn.addEventListener('click', () => this.changePage(-1));
        }
        if (this.nextPageBtn) {
            this.nextPageBtn.addEventListener('click', () => this.changePage(1));
        }
    }

    renderInitialState() {
        if (this.liveServiceCount) {
            this.liveServiceCount.textContent = '2';
        }
        this.updateStatus('尚未開始分析', '請先選擇 PDF 或圖片檔，再按下「開始分析」。');
        this.renderSummary();
        this.renderPageList();
        this.renderPreview();
        this.renderQuestionList();
        this.renderQuestionDetail();
    }

    handleFileSelection(event) {
        const [file] = event.target.files || [];
        this.state.file = file || null;
        this.analyzeBtn.disabled = !file;

        if (!file) {
            this.updateStatus('尚未選擇檔案', '請選擇 PDF、PNG、JPG 或 JPEG。');
            return;
        }

        this.updateStatus('檔案已載入', `已選擇 ${file.name}，可開始分析。`);
    }

    enterReaderService() {
        this.stopSpeech();
        if (this.serviceHome) {
            this.serviceHome.style.display = 'none';
        }
        if (this.quizServiceApp) {
            this.quizServiceApp.style.display = 'none';
        }
        if (this.readerServiceApp) {
            this.readerServiceApp.style.display = 'block';
        }
    }

    returnToHome() {
        if (this.state.isAnalyzing) {
            const shouldLeave = confirm('目前仍在分析中，確定要返回服務首頁嗎？');
            if (!shouldLeave) {
                return;
            }
        }

        this.stopSpeech();
        if (this.readerServiceApp) {
            this.readerServiceApp.style.display = 'none';
        }
        if (window.quizApp && typeof window.quizApp.showServiceHome === 'function') {
            window.quizApp.showServiceHome();
            window.quizApp.renderServiceHome();
        } else if (this.serviceHome) {
            this.serviceHome.style.display = 'block';
        }
    }

    async analyzeSelectedFile() {
        const file = this.state.file;
        if (!file || this.state.isAnalyzing) {
            return;
        }

        this.state.isAnalyzing = true;
        this.analyzeBtn.disabled = true;
        this.exportBtn.disabled = true;
        this.stopSpeech();

        try {
            this.updateStatus('準備分析', `開始分析 ${file.name}`);
            let pages = [];

            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                pages = await this.processPdfFile(file);
            } else {
                pages = await this.processImageFile(file);
            }

            if (!pages.length) {
                throw new Error('找不到可分析的頁面');
            }

            const questions = this.buildQuestionModelFromPages(pages);

            this.state.pages = pages;
            this.state.questions = questions;
            this.state.selectedPageNumber = 1;
            this.state.selectedQuestionId = questions.length ? questions[0].id : null;
            this.state.lastAnalysisTitle = file.name.replace(/\.[^/.]+$/, '');

            this.renderSummary();
            this.renderPageList();
            this.renderPreview();
            this.renderQuestionList();
            this.renderQuestionDetail();
            this.exportBtn.disabled = !questions.length;

            const warningCount = questions.filter((question) => question.confidence < 0.7).length;
            this.updateStatus(
                '分析完成',
                [
                    `頁面數: ${pages.length}`,
                    `題目數: ${questions.length}`,
                    `待人工校正: ${warningCount}`,
                    warningCount
                        ? '建議先檢查標成「待校正」的題目，必要時修正題型、題幹與選項。'
                        : '目前題型與選項切分看起來相對完整，可直接開始朗讀。'
                ].join('\n')
            );
        } catch (error) {
            this.updateStatus('分析失敗', `系統無法完成分析: ${error.message}`);
        } finally {
            this.state.isAnalyzing = false;
            this.analyzeBtn.disabled = !this.state.file;
        }
    }

    async processPdfFile(file) {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js 尚未載入，無法處理 PDF');
        }

        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        const pages = [];
        const useOcrMode = this.ocrModeSelect ? this.ocrModeSelect.value : 'prefer-text';

        for (let index = 1; index <= pdf.numPages; index += 1) {
            this.updateStatus('分析 PDF', `處理第 ${index} / ${pdf.numPages} 頁...`);
            const page = await pdf.getPage(index);
            const viewport = page.getViewport({ scale: 1.45 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: context, viewport }).promise;

            let extractedText = '';
            let extractionMethod = 'pdf-text';

            if (useOcrMode !== 'ocr-force') {
                const textContent = await page.getTextContent();
                extractedText = this.extractPageTextFromPdfItems(
                    textContent.items || [],
                    viewport,
                    this.layoutModeSelect ? this.layoutModeSelect.value : 'vertical'
                );
            }

            if ((!extractedText || extractedText.length < 80) && useOcrMode !== 'prefer-text') {
                extractionMethod = 'ocr';
                extractedText = await this.runOcrFromDataUrl(canvas.toDataURL('image/png'));
            }

            pages.push({
                pageNumber: index,
                imageSrc: canvas.toDataURL('image/png'),
                extractedText,
                extractionMethod
            });
        }

        return pages;
    }

    async processImageFile(file) {
        const imageSrc = await this.readFileAsDataUrl(file);
        this.updateStatus('圖片 OCR', '正在辨識圖片文字，這個步驟可能需要一點時間...');
        const extractedText = await this.runOcrFromDataUrl(imageSrc);

        return [
            {
                pageNumber: 1,
                imageSrc,
                extractedText,
                extractionMethod: 'ocr'
            }
        ];
    }

    extractPageTextFromPdfItems(items, viewport, layoutMode) {
        if (!items.length) {
            return '';
        }

        const enriched = items
            .map((item) => {
                const transform = item.transform || [1, 0, 0, 1, 0, 0];
                return {
                    text: item.str || '',
                    x: transform[4] || 0,
                    y: viewport.height - (transform[5] || 0),
                    width: item.width || 0,
                    height: item.height || 0,
                    angleA: transform[0] || 0,
                    angleB: transform[1] || 0
                };
            })
            .filter((item) => item.text);

        const isVertical = this.detectVerticalLayout(enriched, layoutMode);

        if (isVertical) {
            const columns = this.groupItemsByAxis(enriched, 'x', 14);
            const columnTexts = columns
                .sort((left, right) => right.key - left.key)
                .map((column) =>
                    column.items
                        .sort((top, bottom) => top.y - bottom.y)
                        .map((item) => item.text)
                        .join('')
                );

            return columnTexts.join('\n');
        }

        const rows = this.groupItemsByAxis(enriched, 'y', 12);
        const rowTexts = rows
            .sort((top, bottom) => top.key - bottom.key)
            .map((row) =>
                row.items
                    .sort((left, right) => left.x - right.x)
                    .map((item) => item.text)
                    .join('')
            );

        return rowTexts.join('\n');
    }

    detectVerticalLayout(items, layoutMode) {
        if (layoutMode === 'vertical') {
            return true;
        }
        if (layoutMode === 'horizontal') {
            return false;
        }

        let verticalSignals = 0;
        let horizontalSignals = 0;

        items.forEach((item) => {
            if (Math.abs(item.angleB) > Math.abs(item.angleA)) {
                verticalSignals += 1;
            } else {
                horizontalSignals += 1;
            }
        });

        return verticalSignals >= horizontalSignals;
    }

    groupItemsByAxis(items, axis, tolerance) {
        const groups = [];

        items.forEach((item) => {
            const value = item[axis];
            let group = groups.find((candidate) => Math.abs(candidate.key - value) <= tolerance);

            if (!group) {
                group = { key: value, items: [] };
                groups.push(group);
            }

            group.items.push(item);
            group.key = (group.key * (group.items.length - 1) + value) / group.items.length;
        });

        return groups;
    }

    async runOcrFromDataUrl(dataUrl) {
        if (typeof Tesseract === 'undefined') {
            throw new Error('Tesseract.js 尚未載入，無法執行 OCR');
        }

        const layoutMode = this.layoutModeSelect ? this.layoutModeSelect.value : 'vertical';
        const language = layoutMode === 'horizontal' ? 'chi_tra+eng' : 'chi_tra_vert+chi_tra+eng';

        const result = await Tesseract.recognize(dataUrl, language, {
            logger: (message) => {
                if (message.status && typeof message.progress === 'number') {
                    const percent = Math.round(message.progress * 100);
                    this.updateStatus('OCR 辨識中', `${message.status} ${percent}%`);
                }
            }
        });

        return (result?.data?.text || '').trim();
    }

    buildQuestionModelFromPages(pages) {
        let questions = [];
        let questionIndex = 1;

        pages.forEach((page) => {
            const parsedQuestions = this.parseQuestionsFromText(page.extractedText, page.pageNumber);
            parsedQuestions.forEach((question) => {
                question.id = `reader-q-${questionIndex}`;
                questionIndex += 1;
                questions.push(question);
            });
        });

        if (!questions.length) {
            questions = pages.map((page, index) => ({
                id: `reader-q-fallback-${index + 1}`,
                pageNumber: page.pageNumber,
                sectionTitle: '待校正',
                type: 'unknown',
                prompt: this.toDisplayText(page.extractedText).slice(0, 180) || '無法自動切題，請改上傳可抽文字的 PDF 或手動調整。',
                options: [],
                confidence: 0.2,
                rawText: page.extractedText,
                sourceLabel: page.extractionMethod
            }));
        }

        return questions;
    }

    parseQuestionsFromText(rawText, pageNumber) {
        if (!rawText) {
            return [];
        }

        const normalized = this.normalizeExtractedText(rawText);
        const compact = normalized.compact;
        const titlePattern = /([一二三四五六七八九十]+)、(寫國字或注音|改錯字|連連看|選擇題|照樣寫短語|造句|閱讀測驗)[：:]/g;
        const sectionMatches = [...compact.matchAll(titlePattern)];

        if (!sectionMatches.length) {
            return [];
        }

        const questions = [];

        sectionMatches.forEach((match, index) => {
            const blockStart = match.index || 0;
            const blockEnd = index + 1 < sectionMatches.length ? sectionMatches[index + 1].index || compact.length : compact.length;
            const sectionBlock = compact.slice(blockStart, blockEnd);
            const sectionTitle = match[2];
            const sectionType = this.sectionTypeMap[sectionTitle] || 'unknown';

            let sectionQuestions = [];

            if (sectionTitle === '選擇題' || sectionTitle === '閱讀測驗') {
                sectionQuestions = this.parseChoiceQuestions(sectionBlock, sectionTitle, sectionType, pageNumber);
            } else {
                sectionQuestions = this.parseGenericQuestions(sectionBlock, sectionTitle, sectionType, pageNumber);
            }

            questions.push(...sectionQuestions);
        });

        return questions;
    }

    parseChoiceQuestions(sectionBlock, sectionTitle, sectionType, pageNumber) {
        const firstQuestionIndex = this.findFirstQuestionIndex(sectionBlock);
        if (firstQuestionIndex < 0) {
            return [];
        }

        const introBlock = sectionBlock.slice(0, firstQuestionIndex);
        const questionBody = sectionBlock.slice(firstQuestionIndex);
        const questionMatches = [...questionBody.matchAll(/(?:[(（]\d+[)）]|[(（]?\d+[)）]?)([\s\S]*?)(?=(?:[(（]\d+[)）]|[(（]?\d+[)）]?)|$)/g)];
        const passageText = sectionTitle === '閱讀測驗' ? this.toDisplayText(this.cleanSectionHeader(introBlock)) : '';

        return questionMatches
            .map((match) => {
                const fullMatch = match[0] || '';
                const numberMatch = fullMatch.match(/\d+/);
                const number = numberMatch ? numberMatch[0] : '';
                const content = fullMatch.replace(/^(?:[(（]\d+[)）]|[(（]?\d+[)）]?)/, '');
                const optionSplit = this.splitChoiceOptions(content);
                const prompt = this.toDisplayText(optionSplit.prompt);
                const options = optionSplit.options.map((option) => ({
                    key: option.key,
                    text: this.toDisplayText(option.text)
                }));

                return {
                    pageNumber,
                    sectionTitle,
                    type: sectionTitle === '閱讀測驗' ? 'reading-choice' : sectionType,
                    prompt,
                    options,
                    number,
                    confidence: options.length >= 2 ? 0.86 : 0.52,
                    rawText: this.toDisplayText(content),
                    passage: passageText,
                    sourceLabel: 'auto'
                };
            })
            .filter((question) => question.prompt);
    }

    parseGenericQuestions(sectionBlock, sectionTitle, sectionType, pageNumber) {
        const firstQuestionIndex = this.findFirstQuestionIndex(sectionBlock);
        if (firstQuestionIndex < 0) {
            return [
                {
                    pageNumber,
                    sectionTitle,
                    type: sectionType,
                    prompt: this.toDisplayText(this.cleanSectionHeader(sectionBlock)),
                    options: [],
                    number: '',
                    confidence: 0.45,
                    rawText: this.toDisplayText(sectionBlock),
                    sourceLabel: 'auto'
                }
            ];
        }

        const questionBody = sectionBlock.slice(firstQuestionIndex);
        const questionMatches = [...questionBody.matchAll(/(?:[(（]\d+[)）]|[(（]?\d+[)）]?)([\s\S]*?)(?=(?:[(（]\d+[)）]|[(（]?\d+[)）]?)|$)/g)];

        return questionMatches
            .map((match) => {
                const fullMatch = match[0] || '';
                const numberMatch = fullMatch.match(/\d+/);
                const number = numberMatch ? numberMatch[0] : '';
                const content = fullMatch.replace(/^(?:[(（]\d+[)）]|[(（]?\d+[)）]?)/, '');

                return {
                    pageNumber,
                    sectionTitle,
                    type: sectionType,
                    prompt: this.toDisplayText(content),
                    options: [],
                    number,
                    confidence: 0.72,
                    rawText: this.toDisplayText(content),
                    sourceLabel: 'auto'
                };
            })
            .filter((question) => question.prompt);
    }

    cleanSectionHeader(sectionBlock) {
        const firstQuestionIndex = this.findFirstQuestionIndex(sectionBlock);
        if (firstQuestionIndex < 0) {
            return sectionBlock;
        }
        return sectionBlock.slice(0, firstQuestionIndex);
    }

    findFirstQuestionIndex(sectionBlock) {
        const questionPattern = /[(（]?\d+[)）]?/g;
        let match = questionPattern.exec(sectionBlock);

        while (match) {
            const token = match[0] || '';
            if (token.includes('(') || token.includes('（') || token.length <= 2) {
                return match.index;
            }
            match = questionPattern.exec(sectionBlock);
        }

        return -1;
    }

    splitChoiceOptions(content) {
        const markerPattern = /(ロ|ヮ|ワ|ヰ|①|②|③|④|A|B|C|D|a|b|c|d)/g;
        const markers = [...content.matchAll(markerPattern)];

        if (!markers.length) {
            return {
                prompt: content,
                options: []
            };
        }

        const prompt = content.slice(0, markers[0].index || 0);
        const options = markers.map((marker, index) => {
            const key = marker[0];
            const start = marker.index || 0;
            const end = index + 1 < markers.length ? markers[index + 1].index || content.length : content.length;
            const optionText = content.slice(start + key.length, end);
            return {
                key,
                text: optionText
            };
        });

        return { prompt, options };
    }

    normalizeExtractedText(text) {
        let normalized = text.normalize('NFKC');
        normalized = normalized.replace(/\r/g, '\n');
        normalized = normalized.replace(/[ \t]+/g, ' ');
        normalized = normalized.replace(/[\u00A0]/g, ' ');

        const compact = normalized
            .replace(/[ \n]+/g, '')
            .replace(/[（(][ 　]*[)）]/g, '');

        return {
            display: normalized,
            compact
        };
    }

    toDisplayText(text) {
        if (!text) {
            return '';
        }

        let normalized = text.normalize('NFKC');
        normalized = normalized.replace(/[ \t]+/g, ' ');
        normalized = normalized.replace(/\s*([，。？！；：、])/g, '$1');
        normalized = normalized.replace(/([，。？！；：、])(?=\S)/g, '$1');
        normalized = normalized.replace(/\s+/g, '');
        normalized = normalized.replace(/□/g, '口');

        return normalized.trim();
    }

    renderSummary() {
        const pageCount = this.state.pages.length;
        const questionCount = this.state.questions.length;
        const choiceCount = this.state.questions.filter((question) => question.options.length > 0).length;
        const warningCount = this.state.questions.filter((question) => question.confidence < 0.7).length;

        this.summaryPages.textContent = String(pageCount);
        this.summaryQuestions.textContent = String(questionCount);
        this.summaryChoice.textContent = String(choiceCount);
        this.summaryWarning.textContent = String(warningCount);
    }

    renderPageList() {
        if (!this.pageList) {
            return;
        }

        if (!this.state.pages.length) {
            this.pageList.innerHTML = `
                <div class="reader-empty-state">
                    <h3>尚未載入頁面</h3>
                    <p>完成分析後，這裡會列出所有頁面與擷取方式。</p>
                </div>
            `;
            return;
        }

        this.pageList.innerHTML = this.state.pages
            .map((page) => {
                const activeClass = page.pageNumber === this.state.selectedPageNumber ? 'active' : '';
                return `
                    <button class="reader-page-card ${activeClass}" type="button" data-page-number="${page.pageNumber}">
                        <strong>第 ${page.pageNumber} 頁</strong>
                        <div class="reader-question-meta">來源: ${page.extractionMethod === 'ocr' ? 'OCR' : 'PDF 文字層'}</div>
                        <div class="reader-question-meta">擷取字數: ${(page.extractedText || '').length}</div>
                    </button>
                `;
            })
            .join('');

        this.pageList.querySelectorAll('[data-page-number]').forEach((button) => {
            button.addEventListener('click', () => {
                this.state.selectedPageNumber = Number(button.dataset.pageNumber || 1);
                this.renderPageList();
                this.renderPreview();
            });
        });
    }

    renderPreview() {
        const page = this.state.pages.find((candidate) => candidate.pageNumber === this.state.selectedPageNumber) || this.state.pages[0];

        if (!page) {
            this.previewMeta.textContent = '尚未載入頁面';
            this.pageCanvasWrap.innerHTML = `
                <div class="reader-empty-state">
                    <h3>尚未有預覽內容</h3>
                    <p>完成分析後，這裡會顯示試卷頁面影像。</p>
                </div>
            `;
            return;
        }

        this.previewMeta.textContent = `第 ${page.pageNumber} 頁，擷取方式: ${page.extractionMethod === 'ocr' ? 'OCR' : 'PDF 文字層'}`;
        this.pageCanvasWrap.innerHTML = `<img src="${page.imageSrc}" alt="第 ${page.pageNumber} 頁預覽">`;
    }

    renderQuestionList() {
        if (!this.questionList) {
            return;
        }

        if (!this.state.questions.length) {
            this.questionList.innerHTML = `
                <div class="reader-empty-state">
                    <h3>尚未產生題目</h3>
                    <p>分析完成後，這裡會出現可點擊的題目卡片。</p>
                </div>
            `;
            return;
        }

        this.questionList.innerHTML = this.state.questions
            .map((question) => {
                const isActive = question.id === this.state.selectedQuestionId;
                const warning = question.confidence < 0.7;
                const preview = this.escapeHtml(question.prompt).slice(0, 70);
                return `
                    <article class="reader-question-card ${isActive ? 'active' : ''} ${warning ? 'warning' : ''}" data-question-id="${question.id}">
                        <div class="reader-badge-row">
                            <span class="reader-chip">第 ${question.pageNumber} 頁</span>
                            <span class="reader-chip">${this.typeLabelMap[question.type] || '待確認'}</span>
                            ${warning ? '<span class="reader-chip warning">待校正</span>' : ''}
                        </div>
                        <h4>${this.escapeHtml(question.sectionTitle)} ${question.number ? `第 ${this.escapeHtml(question.number)} 題` : ''}</h4>
                        <div class="reader-question-meta">${preview}${question.prompt.length > 70 ? '…' : ''}</div>
                        <div class="reader-question-meta">選項數: ${question.options.length}</div>
                    </article>
                `;
            })
            .join('');

        this.questionList.querySelectorAll('[data-question-id]').forEach((item) => {
            item.addEventListener('click', () => {
                this.state.selectedQuestionId = item.dataset.questionId;
                const question = this.getSelectedQuestion();
                if (question) {
                    this.state.selectedPageNumber = question.pageNumber;
                }
                this.renderQuestionList();
                this.renderPreview();
                this.renderQuestionDetail();
            });
        });
    }

    renderQuestionDetail() {
        const question = this.getSelectedQuestion();

        if (!question) {
            this.detailCard.innerHTML = `
                <div class="reader-empty-state">
                    <h3>尚未選擇題目</h3>
                    <p>點選題目卡片後，可在這裡朗讀題目、逐項朗讀選項，並手動修正內容。</p>
                </div>
            `;
            return;
        }

        const optionButtons = question.options.length
            ? `
                <div class="reader-option-buttons">
                    ${question.options
                        .map(
                            (option, index) => `
                                <button class="btn btn-outline-primary reader-option-btn" type="button" data-option-index="${index}">
                                    ${this.escapeHtml(option.key)}. ${this.escapeHtml(option.text)}
                                </button>
                            `
                        )
                        .join('')}
                </div>
            `
            : '<p class="reader-muted">此題目前沒有可朗讀的選項。</p>';

        this.detailCard.innerHTML = `
            <div class="reader-selected-question-title">
                <div>
                    <div class="reader-badge-row">
                        <span class="reader-chip">第 ${question.pageNumber} 頁</span>
                        <span class="reader-chip">${this.typeLabelMap[question.type] || '待確認'}</span>
                        ${question.confidence < 0.7 ? '<span class="reader-chip warning">待校正</span>' : ''}
                    </div>
                    <h3>${this.escapeHtml(question.sectionTitle)} ${question.number ? `第 ${this.escapeHtml(question.number)} 題` : ''}</h3>
                </div>
                <div class="reader-detail-actions">
                    <button id="reader-speak-question" class="btn" type="button">朗讀題目</button>
                    <button id="reader-speak-options" class="btn btn-outline-primary" type="button" ${question.options.length ? '' : 'disabled'}>朗讀全部選項</button>
                </div>
            </div>

            ${question.passage ? `
                <div class="reader-passage-box">
                    <strong>題組文章</strong>
                    <p>${this.escapeHtml(question.passage)}</p>
                    <div class="reader-detail-actions" style="margin-top: 10px;">
                        <button id="reader-speak-passage" class="btn btn-outline-primary" type="button">朗讀題組文章</button>
                    </div>
                </div>
            ` : ''}

            <div>
                <strong>題幹</strong>
                <p>${this.escapeHtml(question.prompt || '尚未辨識到題幹')}</p>
            </div>

            <div>
                <strong>選項</strong>
                ${optionButtons}
            </div>

            <div class="reader-source-box">
                <strong>原始擷取片段</strong>
                <p>${this.escapeHtml(question.rawText || '無')}</p>
            </div>

            <div class="reader-edit-grid">
                <h3>手動修正</h3>
                <label>
                    題型
                    <select id="reader-edit-type" class="reader-edit-field">
                        ${this.renderTypeOptions(question.type)}
                    </select>
                </label>
                <label>
                    題幹
                    <textarea id="reader-edit-prompt" class="reader-edit-textarea">${this.escapeHtml(question.prompt)}</textarea>
                </label>
                <label>
                    題組文章
                    <textarea id="reader-edit-passage" class="reader-edit-textarea">${this.escapeHtml(question.passage || '')}</textarea>
                </label>
                <label>
                    選項
                    <textarea id="reader-edit-options" class="reader-edit-textarea">${this.escapeHtml(this.serializeOptions(question.options))}</textarea>
                </label>
                <div class="reader-form-actions">
                    <button id="reader-save-edit" class="btn" type="button">儲存修正</button>
                </div>
            </div>
        `;

        const speakQuestionBtn = document.getElementById('reader-speak-question');
        const speakOptionsBtn = document.getElementById('reader-speak-options');
        const speakPassageBtn = document.getElementById('reader-speak-passage');
        const saveEditBtn = document.getElementById('reader-save-edit');

        if (speakQuestionBtn) {
            speakQuestionBtn.addEventListener('click', () => this.speakQuestion(question));
        }
        if (speakOptionsBtn) {
            speakOptionsBtn.addEventListener('click', () => this.speakAllOptions(question));
        }
        if (speakPassageBtn) {
            speakPassageBtn.addEventListener('click', () => this.speakPassage(question));
        }
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', () => this.saveQuestionEdits(question.id));
        }

        this.detailCard.querySelectorAll('[data-option-index]').forEach((button) => {
            button.addEventListener('click', () => {
                const option = question.options[Number(button.dataset.optionIndex || 0)];
                if (option) {
                    this.speakOption(question, option);
                }
            });
        });
    }

    renderTypeOptions(currentType) {
        return Object.entries(this.typeLabelMap)
            .map(([value, label]) => `<option value="${value}" ${value === currentType ? 'selected' : ''}>${label}</option>`)
            .join('');
    }

    saveQuestionEdits(questionId) {
        const question = this.state.questions.find((item) => item.id === questionId);
        if (!question) {
            return;
        }

        const typeField = document.getElementById('reader-edit-type');
        const promptField = document.getElementById('reader-edit-prompt');
        const passageField = document.getElementById('reader-edit-passage');
        const optionsField = document.getElementById('reader-edit-options');

        question.type = typeField ? typeField.value : question.type;
        question.prompt = promptField ? promptField.value.trim() : question.prompt;
        question.passage = passageField ? passageField.value.trim() : question.passage;
        question.options = this.deserializeOptions(optionsField ? optionsField.value : '');
        question.confidence = Math.max(question.confidence, 0.92);

        this.renderSummary();
        this.renderQuestionList();
        this.renderQuestionDetail();
        this.updateStatus('已儲存修正', `已更新 ${question.sectionTitle} 第 ${question.number || '?'} 題。`);
    }

    serializeOptions(options) {
        return (options || []).map((option) => `${option.key}|${option.text}`).join('\n');
    }

    deserializeOptions(rawValue) {
        return rawValue
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const [key, ...rest] = line.split('|');
                return {
                    key: (key || '').trim(),
                    text: rest.join('|').trim()
                };
            })
            .filter((option) => option.key && option.text);
    }

    speakQuestion(question) {
        const textParts = [];
        textParts.push(`${question.sectionTitle}。`);
        if (question.number) {
            textParts.push(`第 ${question.number} 題。`);
        }
        textParts.push(question.prompt);
        this.speakText(textParts.join(' '));
    }

    speakPassage(question) {
        if (!question.passage) {
            return;
        }
        this.speakText(`題組文章。 ${question.passage}`);
    }

    speakOption(question, option) {
        const prefix = question.number ? `第 ${question.number} 題，` : '';
        this.speakText(`${prefix}${option.key}。${option.text}`);
    }

    speakAllOptions(question) {
        if (!question.options.length) {
            return;
        }
        const joined = question.options.map((option) => `${option.key}。${option.text}`).join('。 ');
        const prefix = question.number ? `第 ${question.number} 題所有選項。 ` : '所有選項。 ';
        this.speakText(`${prefix}${joined}`);
    }

    speakText(text) {
        if (!('speechSynthesis' in window)) {
            this.updateStatus('無法朗讀', '目前瀏覽器不支援 Speech Synthesis API。');
            return;
        }

        this.stopSpeech();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW';
        utterance.rate = this.state.speechRate;
        utterance.onstart = () => {
            this.updateStatus('朗讀中', text);
        };
        utterance.onend = () => {
            this.updateStatus('朗讀完成', text);
        };

        window.speechSynthesis.speak(utterance);
    }

    stopSpeech() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }

    changePage(direction) {
        if (!this.state.pages.length) {
            return;
        }

        const currentIndex = this.state.pages.findIndex((page) => page.pageNumber === this.state.selectedPageNumber);
        const nextIndex = Math.min(Math.max(currentIndex + direction, 0), this.state.pages.length - 1);
        this.state.selectedPageNumber = this.state.pages[nextIndex].pageNumber;
        this.renderPageList();
        this.renderPreview();
    }

    clearAnalysis() {
        this.stopSpeech();
        this.state = {
            ...this.state,
            file: null,
            pages: [],
            questions: [],
            selectedQuestionId: null,
            selectedPageNumber: 1,
            lastAnalysisTitle: ''
        };

        if (this.fileInput) {
            this.fileInput.value = '';
        }
        this.analyzeBtn.disabled = true;
        this.exportBtn.disabled = true;

        this.renderSummary();
        this.renderPageList();
        this.renderPreview();
        this.renderQuestionList();
        this.renderQuestionDetail();
        this.updateStatus('已清除結果', '可以重新上傳新的試卷檔案。');
    }

    exportAnalysisJson() {
        if (!this.state.questions.length) {
            return;
        }

        const payload = {
            title: this.state.lastAnalysisTitle,
            pageCount: this.state.pages.length,
            generatedAt: new Date().toISOString(),
            pages: this.state.pages.map((page) => ({
                pageNumber: page.pageNumber,
                extractionMethod: page.extractionMethod,
                extractedText: page.extractedText
            })),
            questions: this.state.questions
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.state.lastAnalysisTitle || 'exam-analysis'}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    getSelectedQuestion() {
        return this.state.questions.find((question) => question.id === this.state.selectedQuestionId) || null;
    }

    updateStatus(title, body) {
        if (!this.statusBox || !this.statusLog) {
            return;
        }

        this.statusBox.querySelector('strong').textContent = title;
        this.statusLog.textContent = body;
    }

    readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('無法讀取檔案'));
            reader.readAsDataURL(file);
        });
    }

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.examReaderApp = new ExamReaderApp();
});
