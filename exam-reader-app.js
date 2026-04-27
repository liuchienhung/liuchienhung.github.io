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
            lastAnalysisTitle: '',
            studentMode: true,
            lastSpokenText: '',
            speechReady: false,
            speechSupported: false,
            voices: [],
            selectedVoiceURI: '',
            activeTemplate: 'generic',
            calibration: {
                active: false,
                questionId: null,
                targetType: null,
                optionIndex: null,
                startPoint: null
            },
            calibrationWizard: {
                active: false,
                queue: [],
                currentIndex: 0
            },
            continuousReading: {
                active: false,
                queue: [],
                index: 0
            }
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
        this.enableSpeechBtn = document.getElementById('reader-enable-speech-btn');
        this.playAllBtn = document.getElementById('reader-play-all-btn');
        this.studentModeBtn = document.getElementById('reader-student-mode-btn');
        this.calibrationWizardBtn = document.getElementById('reader-calibration-wizard-btn');
        this.repeatLastBtn = document.getElementById('reader-repeat-last');
        this.stopSpeechSecondaryBtn = document.getElementById('reader-stop-speech-secondary');
        this.studentText = document.getElementById('reader-student-text');

        this.layoutModeSelect = document.getElementById('reader-layout-mode');
        this.ocrModeSelect = document.getElementById('reader-ocr-mode');
        this.rateInput = document.getElementById('reader-rate-input');
        this.voiceSelect = document.getElementById('reader-voice-select');

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
        if (this.enableSpeechBtn) {
            this.enableSpeechBtn.addEventListener('click', () => this.enableSpeechPlayback(true));
        }
        if (this.playAllBtn) {
            this.playAllBtn.addEventListener('click', () => this.startContinuousReading());
        }
        if (this.calibrationWizardBtn) {
            this.calibrationWizardBtn.addEventListener('click', () => {
                if (this.state.calibrationWizard.active) {
                    this.stopCalibrationWizard('已結束校正精靈。');
                    return;
                }
                this.startCalibrationWizard();
            });
        }
        if (this.stopSpeechSecondaryBtn) {
            this.stopSpeechSecondaryBtn.addEventListener('click', () => this.stopSpeech());
        }
        if (this.studentModeBtn) {
            this.studentModeBtn.addEventListener('click', () => this.toggleStudentMode());
        }
        if (this.repeatLastBtn) {
            this.repeatLastBtn.addEventListener('click', () => {
                if (this.state.lastSpokenText) {
                    this.speakText(this.state.lastSpokenText);
                }
            });
        }
        if (this.rateInput) {
            this.rateInput.addEventListener('input', () => {
                this.state.speechRate = Number(this.rateInput.value || 1);
            });
        }
        if (this.voiceSelect) {
            this.voiceSelect.addEventListener('change', () => {
                this.state.selectedVoiceURI = this.voiceSelect.value || '';
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
        this.bootstrapSpeechSupport();
        this.applyStudentMode();
        this.updateStatus('尚未開始分析', '請先選擇 PDF 或圖片檔，再按下「開始分析」。');
        this.renderSummary();
        this.renderPageList();
        this.renderPreview();
        this.renderQuestionList();
        this.renderQuestionDetail();
    }

    toggleStudentMode() {
        this.state.studentMode = !this.state.studentMode;
        this.applyStudentMode();
    }

    applyStudentMode() {
        if (this.readerServiceApp) {
            this.readerServiceApp.classList.toggle('student-mode', this.state.studentMode);
        }

        if (this.studentModeBtn) {
            this.studentModeBtn.classList.toggle('active', this.state.studentMode);
            this.studentModeBtn.textContent = this.state.studentMode ? '學生模式' : '編輯模式';
            this.studentModeBtn.title = this.state.studentMode ? '目前為學生操作版面' : '目前為編輯校正版面';
        }
    }

    bootstrapSpeechSupport() {
        this.state.speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
        if (!this.state.speechSupported) {
            this.renderSpeechControls();
            return;
        }

        this.loadSpeechVoices();
        if ('onvoiceschanged' in window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = () => {
                this.loadSpeechVoices();
            };
        }

        window.setTimeout(() => this.loadSpeechVoices(), 300);
        window.addEventListener('pageshow', () => this.loadSpeechVoices(), { passive: true });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.loadSpeechVoices();
            }
        });
    }

    loadSpeechVoices() {
        if (!this.state.speechSupported) {
            return;
        }

        const voices = window.speechSynthesis.getVoices() || [];
        this.state.voices = voices;

        if (!this.state.selectedVoiceURI) {
            const preferredVoice = this.pickPreferredVoice(voices);
            this.state.selectedVoiceURI = preferredVoice?.voiceURI || '';
        } else if (!voices.some((voice) => voice.voiceURI === this.state.selectedVoiceURI)) {
            const fallbackVoice = this.pickPreferredVoice(voices);
            this.state.selectedVoiceURI = fallbackVoice?.voiceURI || '';
        }

        this.renderSpeechControls();
    }

    pickPreferredVoice(voices) {
        if (!voices?.length) {
            return null;
        }

        return (
            voices.find((voice) => /zh[-_]TW/i.test(voice.lang)) ||
            voices.find((voice) => /zh[-_]HK/i.test(voice.lang)) ||
            voices.find((voice) => /zh[-_](CN|SG)/i.test(voice.lang)) ||
            voices.find((voice) => /^zh/i.test(voice.lang)) ||
            voices[0]
        );
    }

    renderSpeechControls() {
        if (this.voiceSelect) {
            const selectedValue = this.state.selectedVoiceURI || '';
            const options = ['<option value="">自動選擇中文語音</option>']
                .concat(
                    (this.state.voices || []).map(
                        (voice) =>
                            `<option value="${this.escapeHtml(voice.voiceURI)}" ${voice.voiceURI === selectedValue ? 'selected' : ''}>${this.escapeHtml(voice.name)} (${this.escapeHtml(voice.lang)})</option>`
                    )
                )
                .join('');
            this.voiceSelect.innerHTML = options;
            this.voiceSelect.disabled = !this.state.speechSupported;
        }

        if (this.enableSpeechBtn) {
            if (!this.state.speechSupported) {
                this.enableSpeechBtn.disabled = true;
                this.enableSpeechBtn.textContent = '裝置不支援朗讀';
            } else {
                this.enableSpeechBtn.disabled = false;
                this.enableSpeechBtn.textContent = this.state.speechReady ? '重新啟用朗讀' : '啟用朗讀';
            }
        }

        if (this.playAllBtn) {
            this.playAllBtn.disabled = !this.state.speechSupported || !this.state.questions.length;
            this.playAllBtn.textContent = this.state.continuousReading.active ? '整卷朗讀中' : '整卷朗讀';
        }
    }

    resolveSpeechVoice() {
        const voices = this.state.voices || [];
        return voices.find((voice) => voice.voiceURI === this.state.selectedVoiceURI) || this.pickPreferredVoice(voices) || null;
    }

    enableSpeechPlayback(announce = true) {
        if (!this.state.speechSupported) {
            this.updateStatus('無法朗讀', '目前瀏覽器不支援 Speech Synthesis API。');
            return;
        }

        this.loadSpeechVoices();
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
        this.state.speechReady = true;
        this.renderSpeechControls();
        if (announce) {
            this.performSpeech('朗讀已啟用，現在可以點題目或選項進行報讀。', {
                skipStore: true
            });
        }
    }

    syncCalibrationWizardButton() {
        if (!this.calibrationWizardBtn) {
            return;
        }

        const active = this.state.calibrationWizard.active;
        this.calibrationWizardBtn.disabled = !active && !this.state.questions.length;
        this.calibrationWizardBtn.textContent = active
            ? `結束校正精靈 ${this.getCalibrationWizardProgressText()}`
            : '上傳後校正精靈';
        this.calibrationWizardBtn.title = active
            ? '停止目前的逐題校正流程'
            : '依序帶你校正題幹、題組文章與選項熱區';
    }

    startCalibrationWizard() {
        if (!this.state.questions.length) {
            this.updateStatus('尚無可校正題目', '請先完成試卷分析，再啟動校正精靈。');
            return;
        }

        const queue = this.buildCalibrationWizardQueue();
        if (!queue.length) {
            this.updateStatus('沒有可校正目標', '目前尚未找到可逐題校正的題目或選項。');
            return;
        }

        this.state.calibrationWizard = {
            active: true,
            queue,
            currentIndex: 0
        };
        this.focusCalibrationWizardTarget();
    }

    stopCalibrationWizard(message = '已結束校正精靈。') {
        this.state.calibrationWizard = {
            active: false,
            queue: [],
            currentIndex: 0
        };
        this.state.calibration = {
            active: false,
            questionId: null,
            targetType: null,
            optionIndex: null,
            startPoint: null
        };
        this.renderSummary();
        this.renderQuestionList();
        this.renderPreview();
        this.renderQuestionDetail();
        this.updateStatus('校正精靈', message);
    }

    buildCalibrationWizardQueue() {
        const orderedQuestions = [...this.state.questions].sort((left, right) => {
            if (left.pageNumber !== right.pageNumber) {
                return left.pageNumber - right.pageNumber;
            }

            const leftNumber = Number(left.number || 0);
            const rightNumber = Number(right.number || 0);
            if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && leftNumber !== rightNumber) {
                return leftNumber - rightNumber;
            }

            return String(left.id).localeCompare(String(right.id), 'zh-Hant');
        });

        const queue = [];
        const passageKeys = new Set();

        orderedQuestions.forEach((question) => {
            if (question.prompt) {
                queue.push({
                    questionId: question.id,
                    targetType: 'question',
                    optionIndex: null
                });
            }

            if (question.passage) {
                const passageKey = `${question.pageNumber}|${question.sectionTitle}|${question.passage}`;
                if (!passageKeys.has(passageKey)) {
                    passageKeys.add(passageKey);
                    queue.push({
                        questionId: question.id,
                        targetType: 'passage',
                        optionIndex: null
                    });
                }
            }

            (question.options || []).forEach((option, optionIndex) => {
                if (option.text) {
                    queue.push({
                        questionId: question.id,
                        targetType: 'option',
                        optionIndex
                    });
                }
            });
        });

        return queue;
    }

    getCalibrationWizardProgressText() {
        const wizard = this.state.calibrationWizard;
        if (!wizard.active || !wizard.queue.length) {
            return '';
        }

        return `(${wizard.currentIndex + 1}/${wizard.queue.length})`;
    }

    getCurrentCalibrationWizardEntry() {
        const wizard = this.state.calibrationWizard;
        if (!wizard.active) {
            return null;
        }

        return wizard.queue[wizard.currentIndex] || null;
    }

    focusCalibrationWizardTarget() {
        const entry = this.getCurrentCalibrationWizardEntry();
        if (!entry) {
            this.stopCalibrationWizard('校正精靈已完成。');
            return;
        }

        const question = this.state.questions.find((item) => item.id === entry.questionId);
        if (!question) {
            this.advanceCalibrationWizard();
            return;
        }

        this.state.studentMode = false;
        this.applyStudentMode();
        this.state.selectedQuestionId = question.id;
        this.state.selectedPageNumber = question.pageNumber;
        this.state.calibration = {
            active: true,
            questionId: question.id,
            targetType: entry.targetType,
            optionIndex: entry.optionIndex,
            startPoint: null
        };

        this.renderSummary();
        this.renderQuestionList();
        this.renderPreview();
        this.renderQuestionDetail();
        this.scrollToPage(question.pageNumber);
        this.updateStatus(
            '校正精靈',
            `${this.getCalibrationWizardProgressText()} 請在試卷上框選 ${this.renderCalibrationTargetLabel(question)}，先點左上角，再點右下角。`
        );
    }

    advanceCalibrationWizard() {
        if (!this.state.calibrationWizard.active) {
            return;
        }

        this.state.calibrationWizard.currentIndex += 1;
        if (this.state.calibrationWizard.currentIndex >= this.state.calibrationWizard.queue.length) {
            this.stopCalibrationWizard('全部校正完成，已切回編輯模式。');
            return;
        }

        this.focusCalibrationWizardTarget();
    }

    startCalibration(questionId, targetType, optionIndex = null) {
        const question = this.state.questions.find((item) => item.id === questionId);
        if (!question) {
            return;
        }

        this.state.studentMode = false;
        this.applyStudentMode();
        this.state.selectedQuestionId = questionId;
        this.state.selectedPageNumber = question.pageNumber;
        this.state.calibration = {
            active: true,
            questionId,
            targetType,
            optionIndex,
            startPoint: null
        };

        this.renderQuestionList();
        this.renderPreview();
        this.renderQuestionDetail();
        this.updateStatus(
            '校正模式',
            '請在試卷頁面上點兩下: 第一下點選左上角，第二下點選右下角，完成熱區校正。'
        );
        this.scrollToPage(question.pageNumber);
    }

    cancelCalibration() {
        if (this.state.calibrationWizard.active) {
            this.stopCalibrationWizard('已中止校正精靈。');
            return;
        }

        this.state.calibration = {
            active: false,
            questionId: null,
            targetType: null,
            optionIndex: null,
            startPoint: null
        };
        this.renderPreview();
        this.renderQuestionDetail();
        this.updateStatus('已取消校正', '目前已離開熱區校正模式。');
    }

    completeCalibrationPoint(pageNumber, point) {
        const calibration = this.state.calibration;
        if (!calibration.active || !calibration.questionId) {
            return;
        }

        const question = this.state.questions.find((item) => item.id === calibration.questionId);
        if (!question || question.pageNumber !== pageNumber) {
            return;
        }

        if (!calibration.startPoint) {
            calibration.startPoint = point;
            this.renderPreview();
            this.updateStatus('校正模式', '已記錄第一個點，請再點一下右下角完成框選。');
            return;
        }

        const bbox = this.createBBoxFromPoints(calibration.startPoint, point);
        if (calibration.targetType === 'question') {
            question.bbox = bbox;
            question.promptBox = bbox;
            question.segments = [bbox];
            question.promptItemIndexes = [];
        } else if (calibration.targetType === 'passage') {
            question.passageBox = bbox;
            question.passageSegments = [bbox];
            question.passageItemIndexes = [];
        } else if (calibration.targetType === 'option' && calibration.optionIndex != null && question.options[calibration.optionIndex]) {
            question.options[calibration.optionIndex].bbox = bbox;
            question.options[calibration.optionIndex].segments = [bbox];
            question.options[calibration.optionIndex].itemIndexes = [];
        }

        question.confidence = Math.max(question.confidence || 0, 0.98);
        this.state.calibration = {
            active: false,
            questionId: null,
            targetType: null,
            optionIndex: null,
            startPoint: null
        };

        if (this.state.calibrationWizard.active) {
            this.renderSummary();
            this.advanceCalibrationWizard();
            return;
        }

        this.renderQuestionList();
        this.renderPreview();
        this.renderQuestionDetail();
        this.updateStatus('校正完成', '已更新目前題目的熱區定位。');
    }

    createBBoxFromPoints(startPoint, endPoint) {
        const leftPct = Math.max(Math.min(startPoint.x, endPoint.x), 0);
        const topPct = Math.max(Math.min(startPoint.y, endPoint.y), 0);
        const widthPct = Math.min(Math.abs(endPoint.x - startPoint.x), 100 - leftPct);
        const heightPct = Math.min(Math.abs(endPoint.y - startPoint.y), 100 - topPct);

        return {
            leftPct,
            topPct,
            widthPct,
            heightPct
        };
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
        this.applyStudentMode();
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

            this.state.activeTemplate = this.detectTemplate(file.name, pages);
            const questions = this.buildQuestionModelFromPages(pages);
            this.state.pages = pages;
            this.state.questions = questions;
            this.state.selectedQuestionId = questions.length ? questions[0].id : null;
            this.state.selectedPageNumber = questions.length ? questions[0].pageNumber : 1;
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
                    `試卷模板: ${this.state.activeTemplate === 'elementary-chinese-exam' ? '國語直排試卷' : '通用模式'}`,
                    `可點擊版面題目: ${questions.filter((question) => this.getQuestionRegions(question).length).length}`,
                    `待人工校正: ${warningCount}`,
                    warningCount
                        ? '可先直接點頁面上的題目與選項。若有切題不準，請按「上傳後校正精靈」。'
                        : '目前已可直接從頁面版面點題目與選項朗讀；需要微調時可啟動校正精靈。'
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
        const ocrMode = this.ocrModeSelect ? this.ocrModeSelect.value : 'prefer-text';
        const layoutMode = this.layoutModeSelect ? this.layoutModeSelect.value : 'vertical';

        for (let index = 1; index <= pdf.numPages; index += 1) {
            this.updateStatus('分析 PDF', `處理第 ${index} / ${pdf.numPages} 頁...`);
            const page = await pdf.getPage(index);
            const viewport = page.getViewport({ scale: 1.45 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: context, viewport }).promise;

            let textBundle = null;
            let extractedText = '';
            let extractionMethod = 'pdf-text';

            if (ocrMode !== 'ocr-force') {
                const textContent = await page.getTextContent();
                textBundle = this.buildTextBundle(textContent.items || [], viewport, layoutMode);
                extractedText = textBundle.displayText;
            }

            if ((!extractedText || extractedText.length < 80) && ocrMode !== 'prefer-text') {
                extractionMethod = 'ocr';
                extractedText = await this.runOcrFromDataUrl(canvas.toDataURL('image/png'));
            }

            pages.push({
                pageNumber: index,
                imageSrc: canvas.toDataURL('image/png'),
                extractedText,
                extractionMethod,
                width: viewport.width,
                height: viewport.height,
                textBundle
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
                extractionMethod: 'ocr',
                width: 1,
                height: 1,
                textBundle: null
            }
        ];
    }

    buildTextBundle(items, viewport, layoutMode) {
        const enriched = items
            .map((item) => this.enrichPdfItem(item, viewport))
            .filter((item) => item.text && item.compactText);

        const isVertical = this.detectVerticalLayout(enriched, layoutMode);
        const grouped = isVertical
            ? this.groupItemsByAxis(enriched, 'left', 14).sort((left, right) => right.key - left.key)
            : this.groupItemsByAxis(enriched, 'top', 12).sort((top, bottom) => top.key - bottom.key);

        const orderedItems = [];
        const displayColumns = grouped.map((group) => {
            const groupItems = isVertical
                ? group.items.sort((top, bottom) => top.top - bottom.top)
                : group.items.sort((left, right) => left.left - right.left);
            orderedItems.push(...groupItems);
            return groupItems.map((item) => item.text).join('');
        });

        const displayText = displayColumns.join('\n');
        let compactText = '';
        const itemRanges = [];

        orderedItems.forEach((item, index) => {
            const start = compactText.length;
            compactText += item.compactText;
            const end = compactText.length;
            itemRanges.push({
                itemIndex: index,
                start,
                end
            });
        });

        return {
            displayText,
            compactText,
            itemRanges,
            orderedItems,
            width: viewport.width,
            height: viewport.height,
            isVertical
        };
    }

    enrichPdfItem(item, viewport) {
        const transform = item.transform || [1, 0, 0, 1, 0, 0];
        const rawText = (item.str || '').normalize('NFKC');
        const compactText = rawText.replace(/\s+/g, '');
        const height = Math.max(item.height || Math.abs(transform[0]) || 10, 10);
        const width = Math.max(item.width || Math.abs(transform[1]) || height * 0.7, 8);
        const left = transform[4] || 0;
        const top = viewport.height - (transform[5] || 0) - height;

        return {
            text: rawText,
            compactText,
            left,
            top,
            width,
            height,
            right: left + width,
            bottom: top + height,
            angleA: transform[0] || 0,
            angleB: transform[1] || 0
        };
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
            const parsedQuestions = page.textBundle
                ? this.parseQuestionsFromBundle(page.textBundle, page.pageNumber)
                : this.parseQuestionsFromText(page.extractedText, page.pageNumber);

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
                sourceLabel: page.extractionMethod,
                bbox: null
            }));
        }

        questions = this.applyTemplateOptimizations(questions);

        return questions;
    }

    detectTemplate(fileName, pages) {
        const source = `${fileName} ${(pages || []).map((page) => page.extractedText || '').join(' ')}`;
        if (/國語科試卷|語文領域國語文|閱讀測驗|選擇題/.test(source)) {
            return 'elementary-chinese-exam';
        }
        return 'generic';
    }

    applyTemplateOptimizations(questions) {
        if (this.state.activeTemplate !== 'elementary-chinese-exam') {
            return questions;
        }

        return questions.map((question) => {
            const optimized = { ...question };

            if (optimized.bbox) {
                const questionExpandX = optimized.options?.length ? 0.06 : 0.12;
                const questionExpandY = optimized.options?.length ? 0.12 : 0.2;
                optimized.bbox = this.expandBox(optimized.bbox, questionExpandX, questionExpandY);
            }
            if (optimized.segments?.length) {
                const questionExpandX = optimized.options?.length ? 0.02 : 0.04;
                const questionExpandY = optimized.options?.length ? 0.04 : 0.06;
                optimized.segments = this.expandRegions(optimized.segments, questionExpandX, questionExpandY);
            }

            optimized.options = (optimized.options || []).map((option) => ({
                ...option,
                bbox: option.bbox ? this.expandBox(option.bbox, 0.04, 0.08) : null,
                segments: option.segments?.length ? this.expandRegions(option.segments, 0.03, 0.05) : []
            }));

            if (optimized.passageBox) {
                optimized.passageBox = this.expandBox(optimized.passageBox, 0.04, 0.08);
            }
            if (optimized.passageSegments?.length) {
                optimized.passageSegments = this.expandRegions(optimized.passageSegments, 0.03, 0.05);
            }

            if (optimized.type === 'multiple-choice' || optimized.type === 'reading-choice') {
                optimized.confidence = Math.max(optimized.confidence || 0, 0.92);
            }

            return optimized;
        });
    }

    expandRegions(regions, expandX, expandY) {
        return (regions || [])
            .map((region) => this.expandBox(region, expandX, expandY))
            .filter(Boolean);
    }

    expandBox(box, expandX, expandY) {
        if (!box) {
            return null;
        }

        const leftPct = Math.max(box.leftPct - expandX, 0);
        const topPct = Math.max(box.topPct - expandY, 0);
        const widthPct = Math.min(box.widthPct + expandX * 2, 100 - leftPct);
        const heightPct = Math.min(box.heightPct + expandY * 2, 100 - topPct);

        return {
            ...box,
            leftPct,
            topPct,
            widthPct,
            heightPct
        };
    }

    parseQuestionsFromBundle(bundle, pageNumber) {
        const compact = bundle.compactText;
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
            const headerLength = (match[0] || '').length;

            let sectionQuestions = [];
            if (sectionTitle === '選擇題' || sectionTitle === '閱讀測驗') {
                sectionQuestions = this.parseChoiceQuestionsFromBundle(sectionBlock, sectionTitle, sectionType, pageNumber, bundle, blockStart, headerLength);
            } else {
                sectionQuestions = this.parseGenericQuestionsFromBundle(sectionBlock, sectionTitle, sectionType, pageNumber, bundle, blockStart, headerLength);
            }

            questions.push(...sectionQuestions);
        });

        return questions;
    }

    parseChoiceQuestionsFromBundle(sectionBlock, sectionTitle, sectionType, pageNumber, bundle, blockStart, headerLength) {
        const bodyBlock = sectionBlock.slice(headerLength);
        const firstQuestionIndex = this.findFirstQuestionIndex(bodyBlock);
        if (firstQuestionIndex < 0) {
            return [];
        }

        const introBlock = bodyBlock.slice(0, firstQuestionIndex);
        const bodyStart = blockStart + headerLength;
        const bodyText = bodyBlock.slice(firstQuestionIndex);
        const bodyOffset = bodyStart + firstQuestionIndex;
        const questionMatches = [...bodyText.matchAll(/(?:[(（]\d+[)）]|[(（]?\d+[)）]?)([\s\S]*?)(?=(?:[(（]\d+[)）]|[(（]?\d+[)）]?)|$)/g)];
        const passageText = sectionTitle === '閱讀測驗' ? this.toDisplayText(introBlock) : '';
        const passageBox = passageText ? this.computeBoundsFromRange(bundle, bodyStart, bodyStart + firstQuestionIndex) : null;
        const passageSegments = passageText ? this.computeSegmentsFromRange(bundle, bodyStart, bodyStart + firstQuestionIndex) : [];
        const passageItemIndexes = passageText ? this.getItemIndexesFromRange(bundle, bodyStart, bodyStart + firstQuestionIndex) : [];

        return questionMatches
            .map((match) => {
                const fullMatch = match[0] || '';
                const matchStart = bodyOffset + (match.index || 0);
                const matchEnd = matchStart + fullMatch.length;
                const prefixMatch = fullMatch.match(/^(?:[(（]\d+[)）]|[(（]?\d+[)）]?)/);
                const prefixLength = prefixMatch ? prefixMatch[0].length : 0;
                const numberMatch = fullMatch.match(/\d+/);
                const number = numberMatch ? numberMatch[0] : '';
                const content = fullMatch.slice(prefixLength);
                const contentStart = matchStart + prefixLength;
                const split = this.splitChoiceOptionsDetailed(content);
                const prompt = this.toDisplayText(split.prompt);
                const promptRangeEnd = split.options.length ? contentStart + split.options[0].start : matchEnd;
                const promptBox = this.computeBoundsFromRange(bundle, contentStart, promptRangeEnd);
                const promptSegments = this.computeSegmentsFromRange(bundle, contentStart, promptRangeEnd);
                const promptItemIndexes = this.getItemIndexesFromRange(bundle, contentStart, promptRangeEnd);
                const contentBox = this.computeBoundsFromRange(bundle, contentStart, matchEnd);
                const options = split.options.map((option) => ({
                    key: option.key,
                    text: this.toDisplayText(option.text),
                    bbox: this.computeBoundsFromRange(bundle, contentStart + option.start, contentStart + option.end),
                    segments: this.computeSegmentsFromRange(bundle, contentStart + option.start, contentStart + option.end),
                    itemIndexes: this.getItemIndexesFromRange(bundle, contentStart + option.start, contentStart + option.end)
                }));

                return {
                    pageNumber,
                    sectionTitle,
                    type: sectionTitle === '閱讀測驗' ? 'reading-choice' : sectionType,
                    prompt,
                    options,
                    number,
                    confidence: options.length >= 2 && (promptBox || contentBox) ? 0.9 : 0.58,
                    rawText: this.toDisplayText(content),
                    sourceLabel: 'auto',
                    passage: passageText,
                    bbox: promptBox || contentBox,
                    segments: promptSegments,
                    promptItemIndexes,
                    promptBox,
                    contentBox,
                    passageBox,
                    passageSegments,
                    passageItemIndexes
                };
            })
            .filter((question) => question.prompt);
    }

    parseGenericQuestionsFromBundle(sectionBlock, sectionTitle, sectionType, pageNumber, bundle, blockStart, headerLength) {
        const bodyBlock = sectionBlock.slice(headerLength);
        const firstQuestionIndex = this.findFirstQuestionIndex(bodyBlock);
        if (firstQuestionIndex < 0) {
            return [
                {
                    pageNumber,
                    sectionTitle,
                    type: sectionType,
                    prompt: this.toDisplayText(bodyBlock),
                    options: [],
                    number: '',
                    confidence: 0.45,
                    rawText: this.toDisplayText(bodyBlock),
                    sourceLabel: 'auto',
                    bbox: this.computeBoundsFromRange(bundle, blockStart + headerLength, blockStart + sectionBlock.length),
                    segments: this.computeSegmentsFromRange(bundle, blockStart + headerLength, blockStart + sectionBlock.length),
                    promptItemIndexes: this.getItemIndexesFromRange(bundle, blockStart + headerLength, blockStart + sectionBlock.length)
                }
            ];
        }

        const questionBody = bodyBlock.slice(firstQuestionIndex);
        const questionBodyOffset = blockStart + headerLength + firstQuestionIndex;
        const questionMatches = [...questionBody.matchAll(/(?:[(（]\d+[)）]|[(（]?\d+[)）]?)([\s\S]*?)(?=(?:[(（]\d+[)）]|[(（]?\d+[)）]?)|$)/g)];

        return questionMatches
            .map((match) => {
                const fullMatch = match[0] || '';
                const matchStart = questionBodyOffset + (match.index || 0);
                const matchEnd = matchStart + fullMatch.length;
                const prefixMatch = fullMatch.match(/^(?:[(（]\d+[)）]|[(（]?\d+[)）]?)/);
                const prefixLength = prefixMatch ? prefixMatch[0].length : 0;
                const numberMatch = fullMatch.match(/\d+/);
                const number = numberMatch ? numberMatch[0] : '';
                const content = fullMatch.slice(prefixLength);

                return {
                    pageNumber,
                    sectionTitle,
                    type: sectionType,
                    prompt: this.toDisplayText(content),
                    options: [],
                    number,
                    confidence: 0.8,
                    rawText: this.toDisplayText(content),
                    sourceLabel: 'auto',
                    bbox: this.computeBoundsFromRange(bundle, matchStart + prefixLength, matchEnd),
                    segments: this.computeSegmentsFromRange(bundle, matchStart + prefixLength, matchEnd),
                    promptItemIndexes: this.getItemIndexesFromRange(bundle, matchStart + prefixLength, matchEnd)
                };
            })
            .filter((question) => question.prompt);
    }

    getItemIndexesFromRange(bundle, start, end) {
        if (!bundle || !bundle.itemRanges?.length || end <= start) {
            return [];
        }

        return [...new Set(
            bundle.itemRanges
                .filter((range) => range.end > start && range.start < end)
                .map((range) => range.itemIndex)
                .filter((itemIndex) => Number.isInteger(itemIndex))
        )];
    }

    computeSegmentsFromRange(bundle, start, end) {
        if (!bundle || !bundle.itemRanges?.length || end <= start) {
            return [];
        }

        const matchedRanges = bundle.itemRanges.filter((range) => range.end > start && range.start < end);
        if (!matchedRanges.length) {
            return [];
        }

        const seen = new Set();
        return matchedRanges
            .map((range) => bundle.orderedItems[range.itemIndex])
            .filter(Boolean)
            .map((item) => {
                const left = Math.max(item.left - 2, 0);
                const top = Math.max(item.top - 2, 0);
                const right = Math.min(item.right + 2, bundle.width);
                const bottom = Math.min(item.bottom + 2, bundle.height);
                const width = Math.max(right - left, 18);
                const height = Math.max(bottom - top, 18);
                const key = `${Math.round(left)}:${Math.round(top)}:${Math.round(width)}:${Math.round(height)}`;
                if (seen.has(key)) {
                    return null;
                }
                seen.add(key);
                return {
                    left,
                    top,
                    width,
                    height,
                    leftPct: (left / bundle.width) * 100,
                    topPct: (top / bundle.height) * 100,
                    widthPct: (width / bundle.width) * 100,
                    heightPct: (height / bundle.height) * 100
                };
            })
            .filter(Boolean);
    }

    computeBoundsFromRange(bundle, start, end) {
        if (!bundle || !bundle.itemRanges?.length || end <= start) {
            return null;
        }

        const matchedRanges = bundle.itemRanges.filter((range) => range.end > start && range.start < end);
        if (!matchedRanges.length) {
            return null;
        }

        const items = matchedRanges.map((range) => bundle.orderedItems[range.itemIndex]).filter(Boolean);
        if (!items.length) {
            return null;
        }

        const left = Math.max(Math.min(...items.map((item) => item.left)) - 3, 0);
        const top = Math.max(Math.min(...items.map((item) => item.top)) - 3, 0);
        const right = Math.min(Math.max(...items.map((item) => item.right)) + 3, bundle.width);
        const bottom = Math.min(Math.max(...items.map((item) => item.bottom)) + 3, bundle.height);
        const width = Math.max(right - left, 18);
        const height = Math.max(bottom - top, 18);

        return {
            left,
            top,
            width,
            height,
            leftPct: (left / bundle.width) * 100,
            topPct: (top / bundle.height) * 100,
            widthPct: (width / bundle.width) * 100,
            heightPct: (height / bundle.height) * 100
        };
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
                sectionQuestions = this.parseChoiceQuestionsFromText(sectionBlock, sectionTitle, sectionType, pageNumber);
            } else {
                sectionQuestions = this.parseGenericQuestionsFromText(sectionBlock, sectionTitle, sectionType, pageNumber);
            }

            questions.push(...sectionQuestions);
        });

        return questions;
    }

    parseChoiceQuestionsFromText(sectionBlock, sectionTitle, sectionType, pageNumber) {
        const firstQuestionIndex = this.findFirstQuestionIndex(sectionBlock);
        if (firstQuestionIndex < 0) {
            return [];
        }

        const introBlock = sectionBlock.slice(0, firstQuestionIndex);
        const questionBody = sectionBlock.slice(firstQuestionIndex);
        const questionMatches = [...questionBody.matchAll(/(?:[(（]\d+[)）]|[(（]?\d+[)）]?)([\s\S]*?)(?=(?:[(（]\d+[)）]|[(（]?\d+[)）]?)|$)/g)];
        const passageText = sectionTitle === '閱讀測驗' ? this.toDisplayText(introBlock) : '';

        return questionMatches
            .map((match) => {
                const fullMatch = match[0] || '';
                const numberMatch = fullMatch.match(/\d+/);
                const number = numberMatch ? numberMatch[0] : '';
                const content = fullMatch.replace(/^(?:[(（]\d+[)）]|[(（]?\d+[)）]?)/, '');
                const optionSplit = this.splitChoiceOptionsDetailed(content);
                return {
                    pageNumber,
                    sectionTitle,
                    type: sectionTitle === '閱讀測驗' ? 'reading-choice' : sectionType,
                    prompt: this.toDisplayText(optionSplit.prompt),
                    options: optionSplit.options.map((option) => ({
                        key: option.key,
                        text: this.toDisplayText(option.text),
                        bbox: null
                    })),
                    number,
                    confidence: 0.52,
                    rawText: this.toDisplayText(content),
                    sourceLabel: 'auto',
                    passage: passageText,
                    bbox: null
                };
            })
            .filter((question) => question.prompt);
    }

    parseGenericQuestionsFromText(sectionBlock, sectionTitle, sectionType, pageNumber) {
        const firstQuestionIndex = this.findFirstQuestionIndex(sectionBlock);
        if (firstQuestionIndex < 0) {
            return [];
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
                    confidence: 0.66,
                    rawText: this.toDisplayText(content),
                    sourceLabel: 'auto',
                    bbox: null
                };
            })
            .filter((question) => question.prompt);
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

    splitChoiceOptionsDetailed(content) {
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
            const text = content.slice(start + key.length, end);
            return {
                key,
                text,
                start,
                end
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

        return { display: normalized, compact };
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
        this.syncCalibrationWizardButton();
    }

    getQuestionRegions(question) {
        if (!question) {
            return [];
        }

        return question.segments?.length ? question.segments : question.bbox ? [question.bbox] : [];
    }

    getOptionRegions(option) {
        if (!option) {
            return [];
        }

        return option.segments?.length ? option.segments : option.bbox ? [option.bbox] : [];
    }

    getPassageRegions(question) {
        if (!question) {
            return [];
        }

        return question.passageSegments?.length ? question.passageSegments : question.passageBox ? [question.passageBox] : [];
    }

    hasPreciseTextLayer(page) {
        return Boolean(page?.textBundle?.orderedItems?.length) && page.extractionMethod !== 'ocr';
    }

    buildTextItemActionMap(pageQuestions, bundle) {
        const actionMap = new Map();
        const assign = (itemIndexes, action) => {
            (itemIndexes || []).forEach((itemIndex) => {
                if (!Number.isInteger(itemIndex)) {
                    return;
                }

                const existing = actionMap.get(itemIndex);
                if (!existing || existing.priority <= action.priority) {
                    actionMap.set(itemIndex, action);
                }
            });
        };

        const passageKeys = new Set();
        pageQuestions.forEach((question) => {
            const passageKey = `${question.pageNumber}|${question.sectionTitle}|${question.passage || ''}`;
            if (question.passage && question.passageItemIndexes?.length && !passageKeys.has(passageKey)) {
                passageKeys.add(passageKey);
                assign(question.passageItemIndexes, {
                    priority: 1,
                    kind: 'passage',
                    questionId: question.id
                });
            }

            if (question.promptItemIndexes?.length) {
                assign(question.promptItemIndexes, {
                    priority: 2,
                    kind: 'question',
                    questionId: question.id
                });
            }

            (question.options || []).forEach((option, optionIndex) => {
                if (option.itemIndexes?.length) {
                    assign(option.itemIndexes, {
                        priority: 3,
                        kind: 'option',
                        questionId: question.id,
                        optionIndex
                    });
                }
            });
        });

        return (bundle?.orderedItems || [])
            .map((item, itemIndex) => ({ item, itemIndex, action: actionMap.get(itemIndex) || null }))
            .filter(({ action }) => Boolean(action));
    }

    renderTextLayerHotspots(pageQuestions, page) {
        if (!this.hasPreciseTextLayer(page)) {
            return '';
        }

        const mappedItems = this.buildTextItemActionMap(pageQuestions, page.textBundle);
        return mappedItems
            .map(({ item, itemIndex, action }) => {
                const actionClass =
                    action.kind === 'option'
                        ? 'reader-text-item-hotspot option'
                        : action.kind === 'passage'
                            ? 'reader-text-item-hotspot passage'
                            : 'reader-text-item-hotspot question';

                return `
                    <button
                        class="${actionClass}"
                        type="button"
                        data-text-item-kind="${action.kind}"
                        data-text-item-index="${itemIndex}"
                        data-hotspot-question-ref="${action.questionId}"
                        ${action.kind === 'option' ? `data-hotspot-option="${action.optionIndex}"` : ''}
                        ${action.kind === 'passage' ? 'data-hotspot-passage="1"' : ''}
                        ${action.kind === 'question' ? `data-hotspot-question="${action.questionId}"` : ''}
                        style="left:${(item.left / page.textBundle.width) * 100}%;top:${(item.top / page.textBundle.height) * 100}%;width:${(item.width / page.textBundle.width) * 100}%;height:${(item.height / page.textBundle.height) * 100}%;"
                        title="${this.escapeHtml(item.text)}">
                    </button>
                `;
            })
            .join('');
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
                const clickableCount = this.state.questions.filter((question) => question.pageNumber === page.pageNumber && this.getQuestionRegions(question).length).length;
                return `
                    <button class="reader-page-card ${activeClass}" type="button" data-page-number="${page.pageNumber}">
                        <strong>第 ${page.pageNumber} 頁</strong>
                        <div class="reader-question-meta">來源: ${page.extractionMethod === 'ocr' ? 'OCR' : 'PDF 文字層'}</div>
                        <div class="reader-question-meta">可點題目: ${clickableCount}</div>
                    </button>
                `;
            })
            .join('');

        this.pageList.querySelectorAll('[data-page-number]').forEach((button) => {
            button.addEventListener('click', () => {
                this.state.selectedPageNumber = Number(button.dataset.pageNumber || 1);
                this.renderPageList();
                this.renderPreview();
                this.scrollToPage(this.state.selectedPageNumber);
            });
        });
    }

    renderPreview() {
        if (!this.state.pages.length) {
            this.previewMeta.textContent = '尚未載入頁面';
            this.pageCanvasWrap.innerHTML = `
                <div class="reader-empty-state">
                    <h3>尚未有預覽內容</h3>
                    <p>完成分析後，這裡會顯示試卷頁面影像。</p>
                </div>
            `;
            return;
        }

        const currentQuestion = this.getSelectedQuestion();
        const calibration = this.state.calibration;
        const pageMarkup = this.state.pages
            .map((page) => {
                const pageQuestions = this.state.questions.filter((question) => question.pageNumber === page.pageNumber);
                const usePreciseTextLayer = this.hasPreciseTextLayer(page);
                const preciseTextHotspots = usePreciseTextLayer ? this.renderTextLayerHotspots(pageQuestions, page) : '';
                const pageHotspots = usePreciseTextLayer
                    ? ''
                    : pageQuestions
                        .flatMap((question) =>
                            this.getQuestionRegions(question).map((region, regionIndex) => ({ question, region, regionIndex }))
                        )
                        .map(({ question, region, regionIndex }) => {
                            const classes = [
                                'reader-hotspot',
                                question.id === this.state.selectedQuestionId ? 'active' : '',
                                question.confidence < 0.7 ? 'warning' : ''
                            ]
                                .filter(Boolean)
                                .join(' ');
                            return `
                                <button
                                    class="${classes}"
                                    type="button"
                                    data-hotspot-question="${question.id}"
                                    data-hotspot-region="${regionIndex}"
                                    style="left:${region.leftPct}%;top:${region.topPct}%;width:${region.widthPct}%;height:${region.heightPct}%;"
                                    title="${this.escapeHtml(question.sectionTitle)}${question.number ? ` 第 ${this.escapeHtml(question.number)} 題` : ''}">
                                    <span class="reader-hotspot-label">${this.escapeHtml(question.sectionTitle)}${question.number ? `-${this.escapeHtml(question.number)}` : ''}</span>
                                </button>
                            `;
                        })
                        .join('');

                const optionHotspots = usePreciseTextLayer
                    ? ''
                    : pageQuestions
                        .flatMap((question) =>
                            (question.options || [])
                                .map((option, index) => ({ question, option, index }))
                                .flatMap(({ question, option, index }) =>
                                    this.getOptionRegions(option).map((region, regionIndex) => ({ question, option, index, region, regionIndex }))
                                )
                        )
                        .map(
                            ({ question, option, index, region, regionIndex }) => `
                                <button
                                    class="reader-option-hotspot ${question.id === this.state.selectedQuestionId ? 'active' : ''}"
                                    type="button"
                                    data-hotspot-option="${index}"
                                    data-hotspot-question-ref="${question.id}"
                                    data-hotspot-region="${regionIndex}"
                                    style="left:${region.leftPct}%;top:${region.topPct}%;width:${region.widthPct}%;height:${region.heightPct}%;"
                                    title="${this.escapeHtml(option.key)} ${this.escapeHtml(option.text)}">
                                    <span class="reader-hotspot-label">${this.escapeHtml(option.key)}</span>
                                </button>
                            `
                        )
                        .join('');

                const passageHotspot = usePreciseTextLayer
                    ? ''
                    : (() => {
                        const passageKeys = new Set();
                        return pageQuestions
                            .filter((question) => question.passage && this.getPassageRegions(question).length)
                            .flatMap((question) => {
                                const key = `${question.pageNumber}|${question.sectionTitle}|${question.passage}`;
                                if (passageKeys.has(key)) {
                                    return [];
                                }
                                passageKeys.add(key);
                                return this.getPassageRegions(question).map((region, regionIndex) => ({ question, region, regionIndex }));
                            })
                            .map(
                                ({ question, region, regionIndex }) => `
                                    <button
                                        class="reader-passage-hotspot ${question.id === this.state.selectedQuestionId ? 'active' : ''}"
                                        type="button"
                                        data-hotspot-passage="1"
                                        data-hotspot-question-ref="${question.id}"
                                        data-hotspot-region="${regionIndex}"
                                        style="left:${region.leftPct}%;top:${region.topPct}%;width:${region.widthPct}%;height:${region.heightPct}%;"
                                        title="題組文章">
                                        <span class="reader-hotspot-label">題組文章</span>
                                    </button>
                                `
                            )
                            .join('');
                    })();

                const pageActiveClass = page.pageNumber === this.state.selectedPageNumber ? 'active' : '';
                const calibrationBox =
                    calibration.active && calibration.questionId && calibration.startPoint && currentQuestion && currentQuestion.pageNumber === page.pageNumber
                        ? `
                            <div
                                class="reader-calibration-box"
                                style="left:${calibration.startPoint.x}%;top:${calibration.startPoint.y}%;width:2%;height:2%;"></div>
                        `
                        : '';

                return `
                    <section class="reader-document-page ${pageActiveClass}" data-page-stage="${page.pageNumber}">
                        <div class="reader-document-page-title">
                            <span>第 ${page.pageNumber} 頁</span>
                            <span class="reader-muted">${page.extractionMethod === 'ocr' ? 'OCR' : 'PDF 文字層'}</span>
                        </div>
                        <div class="reader-page-stage">
                            <img src="${page.imageSrc}" alt="第 ${page.pageNumber} 頁預覽">
                            <div class="reader-overlay-layer">
                                ${preciseTextHotspots}
                                ${pageHotspots}
                                ${passageHotspot}
                                ${optionHotspots}
                                ${calibrationBox}
                            </div>
                        </div>
                    </section>
                `;
            })
            .join('');

        const precisePageCount = this.state.pages.filter((page) => this.hasPreciseTextLayer(page)).length;
        this.previewMeta.textContent = precisePageCount
            ? `共 ${this.state.pages.length} 頁，其中 ${precisePageCount} 頁使用 PDF 文字層精準點讀。`
            : `共 ${this.state.pages.length} 頁，保留原始 PDF 版面，點頁面上的題目或選項即可朗讀。`;
        this.pageCanvasWrap.innerHTML = `<div class="reader-document-stack">${pageMarkup}</div>`;

        this.pageCanvasWrap.querySelectorAll('[data-hotspot-question]').forEach((button) => {
            button.addEventListener('click', () => {
                if (this.state.calibration.active) {
                    return;
                }
                this.state.selectedQuestionId = button.dataset.hotspotQuestion;
                const question = this.getSelectedQuestion();
                if (question) {
                    this.state.selectedPageNumber = question.pageNumber;
                }
                this.renderQuestionList();
                this.renderPreview();
                this.renderQuestionDetail();
                if (question) {
                    this.speakQuestion(question);
                }
            });
        });

        this.pageCanvasWrap.querySelectorAll('[data-hotspot-option]').forEach((button) => {
            button.addEventListener('click', () => {
                if (this.state.calibration.active) {
                    return;
                }
                this.state.selectedQuestionId = button.dataset.hotspotQuestionRef || this.state.selectedQuestionId;
                const question = this.getSelectedQuestion();
                if (!question) {
                    return;
                }
                const option = question.options[Number(button.dataset.hotspotOption || 0)];
                if (option) {
                    this.state.selectedPageNumber = question.pageNumber;
                    this.renderQuestionList();
                    this.renderPreview();
                    this.renderQuestionDetail();
                    this.speakOption(question, option);
                }
            });
        });

        this.pageCanvasWrap.querySelectorAll('[data-hotspot-passage]').forEach((passageButton) => {
            passageButton.addEventListener('click', () => {
                if (this.state.calibration.active) {
                    return;
                }
                this.state.selectedQuestionId = passageButton.dataset.hotspotQuestionRef || this.state.selectedQuestionId;
                const question = this.getSelectedQuestion();
                if (question) {
                    this.state.selectedPageNumber = question.pageNumber;
                    this.renderQuestionList();
                    this.renderPreview();
                    this.renderQuestionDetail();
                    this.speakPassage(question);
                }
            });
        });

        if (this.state.calibration.active) {
            this.pageCanvasWrap.querySelectorAll('[data-page-stage]').forEach((stage) => {
                stage.addEventListener('click', (event) => {
                    if (!event.target.closest('.reader-page-stage')) {
                        return;
                    }
                    const pageStage = event.target.closest('.reader-page-stage');
                    const pageSection = event.target.closest('[data-page-stage]');
                    const rect = pageStage.getBoundingClientRect();
                    const x = ((event.clientX - rect.left) / rect.width) * 100;
                    const y = ((event.clientY - rect.top) / rect.height) * 100;
                    const pageNumber = Number(pageSection.dataset.pageStage || 0);
                    this.completeCalibrationPoint(pageNumber, { x, y });
                });
            });
        }
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
                    <p>點選題目卡片或直接點頁面上的題目框後，可在這裡朗讀題目、逐項朗讀選項，並手動修正內容。</p>
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

        const wizardBanner = this.state.calibrationWizard.active
            ? `
                <div class="reader-calibration-hint">
                    <strong>校正精靈 ${this.getCalibrationWizardProgressText()}</strong>
                    <div style="margin-top: 6px;">目前目標: ${this.escapeHtml(this.renderCalibrationTargetLabel(question))}</div>
                    <div style="margin-top: 6px;">請在左側試卷上點兩下，依序框出左上角與右下角。</div>
                    <div class="reader-detail-actions" style="margin-top: 10px;">
                        <button id="reader-stop-calibration-wizard" class="btn btn-secondary" type="button">結束精靈</button>
                    </div>
                </div>
            `
            : '';

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

            ${wizardBanner}

            ${this.state.calibration.active ? `
                <div class="reader-calibration-hint">
                    正在校正 ${this.renderCalibrationTargetLabel(question)}。請到左側試卷頁面點兩下，依序框出左上角與右下角。
                    <div class="reader-detail-actions" style="margin-top: 10px;">
                        <button id="reader-cancel-calibration" class="btn btn-secondary" type="button">取消校正</button>
                    </div>
                </div>
            ` : `
                <div class="reader-detail-actions">
                    <button id="reader-calibrate-question" class="btn btn-outline-primary" type="button">校正題幹熱區</button>
                    ${question.passage ? '<button id="reader-calibrate-passage" class="btn btn-outline-primary" type="button">校正題組文章熱區</button>' : ''}
                </div>
            `}

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
                ${!this.state.calibration.active && question.options.length ? `
                    <div class="reader-detail-actions" style="margin-top: 10px;">
                        ${question.options
                            .map(
                                (option, index) => `
                                    <button class="btn btn-outline-primary" type="button" data-calibrate-option="${index}">
                                        校正 ${this.escapeHtml(option.key)} 熱區
                                    </button>
                                `
                            )
                            .join('')}
                    </div>
                ` : ''}
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
        const calibrateQuestionBtn = document.getElementById('reader-calibrate-question');
        const calibratePassageBtn = document.getElementById('reader-calibrate-passage');
        const cancelCalibrationBtn = document.getElementById('reader-cancel-calibration');
        const stopCalibrationWizardBtn = document.getElementById('reader-stop-calibration-wizard');

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
        if (calibrateQuestionBtn) {
            calibrateQuestionBtn.addEventListener('click', () => this.startCalibration(question.id, 'question'));
        }
        if (calibratePassageBtn) {
            calibratePassageBtn.addEventListener('click', () => this.startCalibration(question.id, 'passage'));
        }
        if (cancelCalibrationBtn) {
            cancelCalibrationBtn.addEventListener('click', () => this.cancelCalibration());
        }
        if (stopCalibrationWizardBtn) {
            stopCalibrationWizardBtn.addEventListener('click', () => this.stopCalibrationWizard('已結束校正精靈。'));
        }

        this.detailCard.querySelectorAll('[data-option-index]').forEach((button) => {
            button.addEventListener('click', () => {
                const option = question.options[Number(button.dataset.optionIndex || 0)];
                if (option) {
                    this.speakOption(question, option);
                }
            });
        });

        this.detailCard.querySelectorAll('[data-calibrate-option]').forEach((button) => {
            button.addEventListener('click', () => {
                this.startCalibration(question.id, 'option', Number(button.dataset.calibrateOption || 0));
            });
        });
    }

    renderCalibrationTargetLabel(question) {
        const calibration = this.state.calibration;
        if (calibration.targetType === 'question') {
            return `${question.sectionTitle} 第 ${question.number || ''} 題的題幹`;
        }
        if (calibration.targetType === 'passage') {
            return `${question.sectionTitle} 的題組文章`;
        }
        if (calibration.targetType === 'option' && calibration.optionIndex != null && question.options[calibration.optionIndex]) {
            return `${question.sectionTitle} 第 ${question.number || ''} 題選項 ${question.options[calibration.optionIndex].key}`;
        }
        return '目前熱區';
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
        question.options = this.deserializeOptions(optionsField ? optionsField.value : '', question.options);
        question.confidence = Math.max(question.confidence, 0.92);

        this.renderSummary();
        this.renderQuestionList();
        this.renderPreview();
        this.renderQuestionDetail();
        this.updateStatus('已儲存修正', `已更新 ${question.sectionTitle} 第 ${question.number || '?'} 題。`);
    }

    serializeOptions(options) {
        return (options || []).map((option) => `${option.key}|${option.text}`).join('\n');
    }

    deserializeOptions(rawValue, previousOptions) {
        const previous = previousOptions || [];
        return rawValue
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, index) => {
                const [key, ...rest] = line.split('|');
                return {
                    key: (key || '').trim(),
                    text: rest.join('|').trim(),
                    bbox: previous[index]?.bbox || null,
                    segments: previous[index]?.segments || []
                };
            })
            .filter((option) => option.key && option.text);
    }

    speakQuestion(question) {
        const parts = [];
        parts.push(`${question.sectionTitle}。`);
        if (question.number) {
            parts.push(`第 ${question.number} 題。`);
        }
        parts.push(question.prompt);
        this.speakText(parts.join(' '));
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
        const text = question.options.map((option) => `${option.key}。${option.text}`).join('。 ');
        this.speakText(`${question.number ? `第 ${question.number} 題。` : ''}${text}`);
    }

    buildContinuousReadingQueue() {
        const questions = [...this.state.questions].sort((left, right) => {
            if (left.pageNumber !== right.pageNumber) {
                return left.pageNumber - right.pageNumber;
            }
            return Number(left.number || 0) - Number(right.number || 0);
        });

        const queue = [];
        const passageKeys = new Set();

        questions.forEach((question) => {
            if (question.passage) {
                const passageKey = `${question.pageNumber}|${question.sectionTitle}|${question.passage}`;
                if (!passageKeys.has(passageKey)) {
                    passageKeys.add(passageKey);
                    queue.push(`題組文章。 ${question.passage}`);
                }
            }

            const promptParts = [];
            promptParts.push(`${question.sectionTitle}。`);
            if (question.number) {
                promptParts.push(`第 ${question.number} 題。`);
            }
            promptParts.push(question.prompt);
            queue.push(promptParts.join(' '));

            if (question.options?.length) {
                queue.push(question.options.map((option) => `${option.key}。${option.text}`).join('。 '));
            }
        });

        return queue.filter(Boolean);
    }

    startContinuousReading() {
        if (!this.state.questions.length) {
            this.updateStatus('尚無可朗讀內容', '請先完成試卷分析。');
            return;
        }

        if (!this.state.speechSupported) {
            this.updateStatus('無法朗讀', '目前瀏覽器不支援 Speech Synthesis API。');
            return;
        }

        if (!this.state.speechReady) {
            this.enableSpeechPlayback(false);
        }

        const queue = this.buildContinuousReadingQueue();
        if (!queue.length) {
            this.updateStatus('尚無可朗讀內容', '目前沒有可供整卷朗讀的題目內容。');
            return;
        }

        this.state.continuousReading = {
            active: true,
            queue,
            index: 0
        };
        this.renderSpeechControls();
        this.speakContinuousReadingStep();
    }

    speakContinuousReadingStep() {
        const reading = this.state.continuousReading;
        if (!reading.active) {
            return;
        }

        const text = reading.queue[reading.index];
        if (!text) {
            this.finishContinuousReading('整卷朗讀完成。');
            return;
        }

        this.performSpeech(text, {
            onend: () => {
                if (!this.state.continuousReading.active) {
                    return;
                }
                this.state.continuousReading.index += 1;
                if (this.state.continuousReading.index >= this.state.continuousReading.queue.length) {
                    this.finishContinuousReading('整卷朗讀完成。');
                    return;
                }
                this.speakContinuousReadingStep();
            },
            onerror: () => {
                this.finishContinuousReading('整卷朗讀中斷，請重新按一次「整卷朗讀」。');
            }
        });
    }

    finishContinuousReading(message) {
        this.state.continuousReading = {
            active: false,
            queue: [],
            index: 0
        };
        this.renderSpeechControls();
        if (message) {
            this.updateStatus('整卷朗讀', message);
        }
    }

    speakText(text) {
        if (!this.state.speechSupported) {
            this.updateStatus('無法朗讀', '目前瀏覽器不支援 Speech Synthesis API。');
            return;
        }

        if (!this.state.speechReady) {
            this.enableSpeechPlayback(false);
        }
        this.finishContinuousReading('');
        this.performSpeech(text);
    }

    performSpeech(text, options = {}) {
        const { onstart, onend, onerror, skipStore = false } = options;

        this.stopSpeech({ keepQueue: true });
        this.loadSpeechVoices();
        if (!skipStore) {
            this.state.lastSpokenText = text;
        }
        if (!skipStore && this.studentText) {
            this.studentText.textContent = text;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW';
        utterance.rate = this.state.speechRate;
        utterance.volume = 1;
        utterance.pitch = 1;
        const voice = this.resolveSpeechVoice();
        if (voice) {
            utterance.voice = voice;
        }
        utterance.onstart = () => {
            this.state.speechReady = true;
            this.renderSpeechControls();
            this.updateStatus('朗讀中', text);
            if (typeof onstart === 'function') {
                onstart();
            }
        };
        utterance.onend = () => {
            this.updateStatus('朗讀完成', text);
            if (typeof onend === 'function') {
                onend();
            }
        };
        utterance.onerror = (event) => {
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                this.state.speechReady = false;
                this.renderSpeechControls();
            }
            this.updateStatus('朗讀失敗', `語音播放失敗: ${event.error || 'unknown'}。請先按「啟用朗讀」，並確認裝置未靜音。`);
            if (typeof onerror === 'function') {
                onerror(event);
            }
        };
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
    }

    stopSpeech(options = {}) {
        const { keepQueue = false } = options;

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        if (!keepQueue) {
            this.finishContinuousReading('');
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
        this.scrollToPage(this.state.selectedPageNumber);
    }

    scrollToPage(pageNumber) {
        const target = this.pageCanvasWrap.querySelector(`[data-page-stage="${pageNumber}"]`);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
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
            lastAnalysisTitle: '',
            lastSpokenText: '',
            activeTemplate: 'generic',
            calibration: {
                active: false,
                questionId: null,
                targetType: null,
                optionIndex: null,
                startPoint: null
            },
            calibrationWizard: {
                active: false,
                queue: [],
                currentIndex: 0
            },
            continuousReading: {
                active: false,
                queue: [],
                index: 0
            }
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
        if (this.studentText) {
            this.studentText.textContent = '點選試卷上的題目、選項或題組文章後，這裡會顯示剛剛朗讀的內容。';
        }
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

        const titleNode = this.statusBox.querySelector('strong');
        if (titleNode) {
            titleNode.textContent = title;
        }
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
