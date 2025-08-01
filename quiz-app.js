// PT職能題庫測驗系統
class QuizApp {
    constructor() {
        this.currentSubject = null;
        this.currentUnit = null;
        this.currentSubjectData = [];
        this.currentSingleUnits = [];
        this.currentMultiUnits = [];
        this.currentUnitType = 'single';
        this.currentQuestionIndex = 0;
        this.currentPage = 1;
        this.questionsPerPage = 1;
        this.selectedQuestions = [];
        this.timeLimit = 30 * 60; // default 30 minutes
        this.remainingTime = this.timeLimit;
        this.passScore = 70; // passing score percentage
        this.timerInterval = null;
        this.userAnswers = {};
        this.showingResults = false;
        this.starredQuestions = new Set();
        this.selectionCallback = null;
        this.toastTimer = null;

        this.loadFromStorage();
        this.initializeElements();
        this.initializeEventListeners();
        this.renderSubjectSelector();
    }

    initializeElements() {
        this.subjectSelector = document.getElementById('subject-selector');
        this.subjectButtons = document.getElementById('subject-buttons');
        this.backToSubjectsBtn = document.getElementById('back-to-subjects');

        this.unitSelector = document.getElementById('unit-selector');
        this.singleUnitButtons = document.getElementById('single-unit-buttons');
        this.multiUnitButtons = document.getElementById('multi-unit-buttons');
        this.mixedUnitButtons = document.getElementById('mixed-unit-buttons');
        this.quizArea = document.getElementById('quiz-area');
        this.questionContainer = document.getElementById('question-container');
        this.timerElement = document.getElementById('timer');
        this.scoreDisplay = document.getElementById('score-display');
        this.scoreText = document.getElementById('score-text');
        this.scoreProgress = document.getElementById('score-progress');
        
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.submitBtn = document.getElementById('submit-btn');
        this.statusBtn = document.getElementById('status-btn');
        this.backToUnitsBtn = document.getElementById('back-to-units');
        this.restartBtn = document.getElementById('restart-quiz');

        this.statusOverlay = document.getElementById('status-overlay');
        this.statusList = document.getElementById('status-list');
        this.closeStatusBtn = document.getElementById('close-status');

        this.selectOverlay = document.getElementById('select-overlay');
        this.selectTitle = document.getElementById('select-title');
        this.selectList = document.getElementById('select-list');
        this.selectConfirm = document.getElementById('select-confirm');
        this.selectCancel = document.getElementById('select-cancel');

        this.importFile = document.getElementById('import-file');
        this.importBtn = document.getElementById('import-btn');
        this.importUnit = document.getElementById('import-unit');
        this.importFileMulti = document.getElementById('import-file-multi');
        this.importMultiBtn = document.getElementById('import-multi-btn');
        this.importUnitMulti = document.getElementById('import-unit-multi');
        this.importAllFile = document.getElementById('import-all-file');
        this.importAllBtn = document.getElementById('import-all-btn');
        this.exportAllBtn = document.getElementById('export-all-btn');
        this.importAllFileMulti = document.getElementById('import-all-file-multi');
        this.importAllMultiBtn = document.getElementById('import-all-multi-btn');
        this.exportAllMultiBtn = document.getElementById('export-all-multi-btn');
        this.exportUnitBtn = document.getElementById('export-unit-btn');
        this.exportUnitMultiBtn = document.getElementById('export-unit-multi-btn');
        this.downloadPdfBtn = document.getElementById('download-pdf');
        this.downloadFormatBtn = document.getElementById('download-format-btn');
        this.downloadMultiFormatBtn = document.getElementById('download-multi-format-btn');
        this.editUnitMultiBtn = document.getElementById('edit-unit-multi-btn');
        this.editUnitBtn = document.getElementById('edit-unit-btn');

        this.unitSettingsBtn = document.getElementById('unit-settings-btn');
        this.unitSettingsPanel = document.getElementById('unit-settings-panel');

        this.addSubjectBtn = document.getElementById('add-subject');
        this.addUnitBtn = document.getElementById('add-unit');
        this.addUnitMultiBtn = document.getElementById('add-unit-multi');
        this.removeSubjectBtn = document.getElementById('remove-subject');
        this.removeUnitBtn = document.getElementById('remove-unit');
        this.removeUnitMultiBtn = document.getElementById('remove-unit-multi');
        this.syncUnitToMultiBtn = document.getElementById('sync-unit-to-multi');
        this.syncUnitMultiToSingleBtn = document.getElementById('sync-unit-multi-to-single');
        
        this.currentPageSpan = document.getElementById('current-page');
        this.totalPagesSpan = document.getElementById('total-pages');
        this.currentQuestionSpan = document.getElementById('current-question');
        this.totalQuestionsSpan = document.getElementById('total-questions');
        this.questionProgress = document.getElementById('question-progress');
        this.progressText = document.getElementById('progress-text');
    }

    initializeEventListeners() {
        this.prevBtn.addEventListener('click', () => this.previousPage());
        this.nextBtn.addEventListener('click', () => this.nextPage());
        this.submitBtn.addEventListener('click', () => {
            if (confirm('確定要結束作答並交卷嗎？')) {
                this.submitQuiz();
            }
        });
        this.statusBtn.addEventListener('click', () => this.showAnswerStatus());
        this.backToUnitsBtn.addEventListener('click', () => this.backToUnitSelector());
        this.backToSubjectsBtn.addEventListener('click', () => this.backToSubjectSelector());
        this.restartBtn.addEventListener('click', () => this.restartQuiz());
        this.closeStatusBtn.addEventListener('click', () => this.hideAnswerStatus());
        this.importBtn.addEventListener('click', () => this.importQuestions());
        if (this.importFile) {
            this.importFile.addEventListener('change', () => {
                this.importBtn.disabled = !this.importFile.files.length;
            });
        }
        if (this.importMultiBtn) {
            this.importMultiBtn.addEventListener('click', () => this.importQuestionsMulti());
        }
        if (this.importFileMulti) {
            this.importFileMulti.addEventListener('change', () => {
                this.importMultiBtn.disabled = !this.importFileMulti.files.length;
            });
        }
        if (this.downloadPdfBtn) {
            this.downloadPdfBtn.addEventListener('click', () => this.downloadPDF());
        }

        if (this.unitSettingsBtn && this.unitSettingsPanel) {
            this.unitSettingsBtn.addEventListener('click', () => {
                this.unitSettingsPanel.style.display = this.unitSettingsPanel.style.display === 'none' ? 'block' : 'none';
            });
        }
        if (this.downloadFormatBtn) {
            this.downloadFormatBtn.addEventListener('click', () => this.downloadFormat());
        }
        if (this.downloadMultiFormatBtn) {
            this.downloadMultiFormatBtn.addEventListener('click', () => this.downloadFormatMulti());
        }
        if (this.addSubjectBtn) {
            this.addSubjectBtn.addEventListener('click', () => this.addSubject());
        }
        if (this.addUnitBtn) {
            this.addUnitBtn.addEventListener('click', () => this.addUnit());
        }
        if (this.addUnitMultiBtn) {
            this.addUnitMultiBtn.addEventListener('click', () => this.addUnitMulti());
        }
        if (this.removeSubjectBtn) {
            this.removeSubjectBtn.addEventListener('click', () => this.removeSubject());
        }
        if (this.removeUnitBtn) {
            this.removeUnitBtn.addEventListener('click', () => this.removeUnit());
        }
        if (this.removeUnitMultiBtn) {
            this.removeUnitMultiBtn.addEventListener('click', () => this.removeUnitMulti());
        }
        if (this.syncUnitToMultiBtn) {
            this.syncUnitToMultiBtn.addEventListener('click', () => this.syncSingleToMulti());
        }
        if (this.syncUnitMultiToSingleBtn) {
            this.syncUnitMultiToSingleBtn.addEventListener('click', () => this.syncMultiToSingle());
        }
        if (this.importAllBtn) {
            this.importAllBtn.addEventListener('click', () => this.importAllQuestions());
            if (this.importAllFile) {
                this.importAllFile.addEventListener('change', () => {
                    this.importAllBtn.disabled = !this.importAllFile.files.length;
                });
            }
        }
        if (this.exportAllBtn) {
            this.exportAllBtn.addEventListener('click', () => this.exportAllQuestions());
        }
        if (this.importAllMultiBtn) {
            this.importAllMultiBtn.addEventListener('click', () => this.importAllQuestionsMulti());
            if (this.importAllFileMulti) {
                this.importAllFileMulti.addEventListener('change', () => {
                    this.importAllMultiBtn.disabled = !this.importAllFileMulti.files.length;
                });
            }
        }
        if (this.exportAllMultiBtn) {
            this.exportAllMultiBtn.addEventListener('click', () => this.exportAllQuestionsMulti());
        }
        if (this.exportUnitBtn) {
            this.exportUnitBtn.addEventListener('click', () => this.exportUnit());
        }
        if (this.exportUnitMultiBtn) {
            this.exportUnitMultiBtn.addEventListener('click', () => this.exportUnitMulti());
        }
        if (this.editUnitBtn) {
            this.editUnitBtn.addEventListener('click', () => this.editUnitQuestions());
        }
        if (this.editUnitMultiBtn) {
            this.editUnitMultiBtn.addEventListener('click', () => this.editUnitQuestionsMulti());
        }
        if (this.selectConfirm) {
            this.selectConfirm.addEventListener('click', () => this.confirmSelection());
        }
        if (this.selectCancel) {
            this.selectCancel.addEventListener('click', () => this.hideSelection());
        }
    }

    renderSubjectSelector() {
        this.subjectButtons.innerHTML = '';
        subjects.forEach((subj, index) => {
            const button = document.createElement('button');
            button.className = 'unit-btn';
            const singleCount = subj.units.reduce((s, u) => s + u.questions.length, 0);
            const multiCount = (subj.multiUnits || []).reduce((s, u) => s + u.questions.length, 0);
            button.innerHTML = `
                <strong>${subj.subject}</strong><br>
                <small>單選 ${singleCount} / 多選 ${multiCount}</small>
            `;
            button.addEventListener('click', () => this.selectSubject(index));
            this.subjectButtons.appendChild(button);
        });

        this.subjectSelector.style.display = 'block';
        this.unitSelector.style.display = 'none';
        this.quizArea.style.display = 'none';
    }

    selectSubject(index) {
        this.currentSubject = index;
        this.currentSingleUnits = subjects[index].units;
        this.currentMultiUnits = subjects[index].multiUnits || [];
        this.currentSubjectData = this.currentSingleUnits;
        this.renderUnitSelector();
        this.subjectSelector.style.display = 'none';
        this.unitSelector.style.display = 'block';
    }

    renderUnitSelector() {
        this.singleUnitButtons.innerHTML = '';
        this.multiUnitButtons.innerHTML = '';
        if (this.mixedUnitButtons) this.mixedUnitButtons.innerHTML = '';
        if (this.importUnit) this.importUnit.innerHTML = '';
        if (this.importUnitMulti) this.importUnitMulti.innerHTML = '';

        this.currentSingleUnits.forEach((unit, index) => {
            const button = document.createElement('button');
            button.className = 'unit-btn';
            button.innerHTML = `
                <strong>${unit.unit}</strong><br>
                <small>${unit.questions.length} 道題目</small>
            `;
            button.addEventListener('click', () => this.startQuiz(index, 'single'));
            this.singleUnitButtons.appendChild(button);

            if (this.importUnit) {
                const opt = document.createElement('option');
                opt.value = index;
                opt.textContent = unit.unit;
                this.importUnit.appendChild(opt);
            }
        });

        const totalSingle = this.currentSingleUnits.reduce((sum,u)=>sum+u.questions.length,0);
        if (totalSingle > 0) {
            const allUnitsButton = document.createElement('button');
            allUnitsButton.className = 'unit-btn';
            allUnitsButton.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
            allUnitsButton.innerHTML = `
                <strong>全部單元綜合測驗</strong><br>
                <small>${totalSingle} 道題目</small>
            `;
            allUnitsButton.addEventListener('click', () => this.startQuiz(-1, 'single'));
            this.singleUnitButtons.appendChild(allUnitsButton);
        }

        // 多選題單元
        this.currentMultiUnits.forEach((unit, index) => {
            const button = document.createElement('button');
            button.className = 'unit-btn';
            button.innerHTML = `
                <strong>${unit.unit}</strong><br>
                <small>${unit.questions.length} 道題目</small>
            `;
            button.addEventListener('click', () => this.startQuiz(index, 'multi'));
            this.multiUnitButtons.appendChild(button);

            if (this.importUnitMulti) {
                const opt = document.createElement('option');
                opt.value = index;
                opt.textContent = unit.unit;
                this.importUnitMulti.appendChild(opt);
            }
        });

        const totalMulti = this.currentMultiUnits.reduce((sum,u)=>sum+u.questions.length,0);
        if (totalMulti > 0) {
            const allMultiBtn = document.createElement('button');
            allMultiBtn.className = 'unit-btn';
            allMultiBtn.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
            allMultiBtn.innerHTML = `
                <strong>全部單元綜合測驗</strong><br>
                <small>${totalMulti} 道題目</small>
            `;
            allMultiBtn.addEventListener('click', () => this.startQuiz(-1, 'multi'));
            this.multiUnitButtons.appendChild(allMultiBtn);
        }

        if (this.mixedUnitButtons) {
            const mixBtn = document.createElement('button');
            mixBtn.className = 'unit-btn';
            mixBtn.style.background = 'linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%)';
            mixBtn.innerHTML = `
                <strong>混合題綜合測驗</strong><br>
                <small>${Math.min(40, totalSingle)} 單選 + ${Math.min(10, totalMulti)} 多選</small>
            `;
            mixBtn.addEventListener('click', () => this.startQuiz(-1, 'mixed'));
            this.mixedUnitButtons.appendChild(mixBtn);
        }
    }

    startQuiz(unitIndex, type = 'single', predefinedCount = null, predefinedTime = null) {
        this.currentUnitType = type;
        if (type === 'multi') {
            this.currentSubjectData = this.currentMultiUnits;
        } else if (type === 'mixed') {
            this.currentSubjectData = [];
        } else {
            this.currentSubjectData = this.currentSingleUnits;
        }
        this.currentUnit = unitIndex;
        this.currentQuestionIndex = 0;
        this.currentPage = 1;
        this.userAnswers = {};
        this.showingResults = false;

        const allQuestions = this.getAllQuestions();
        let count = 0;
        if (type === 'mixed') {
            const singleQ = allQuestions.filter(q => !Array.isArray(q.answers)).sort(() => Math.random() - 0.5).slice(0, 40);
            const multiQ = allQuestions.filter(q => Array.isArray(q.answers)).sort(() => Math.random() - 0.5).slice(0, 10);
            this.selectedQuestions = singleQ.concat(multiQ).sort(() => Math.random() - 0.5);
            count = this.selectedQuestions.length;
        } else {
            let maxQuestions = Math.min(50, allQuestions.length);
            let countInput = predefinedCount !== null ? predefinedCount : prompt(`請輸入測驗題數 (5-${maxQuestions})`, Math.min(10, maxQuestions));
            if (countInput === null) {
                this.backToUnitSelector();
                return;
            }
            count = parseInt(countInput);
            if (isNaN(count)) count = Math.min(10, maxQuestions);
            count = Math.min(Math.max(count, 5), maxQuestions);

            const shuffled = allQuestions.sort(() => Math.random() - 0.5);
            this.selectedQuestions = shuffled.slice(0, count);
        }

        let timeInput = predefinedTime !== null ? predefinedTime : prompt('請輸入測驗時間(分鐘)', this.timeLimit / 60);
        if (timeInput === null) {
            this.backToUnitSelector();
            return;
        }
        let timeMin = parseInt(timeInput);
        if (isNaN(timeMin) || timeMin <= 0) timeMin = this.timeLimit / 60;
        this.timeLimit = timeMin * 60;

        if (this.unitSettingsPanel) {
            this.unitSettingsPanel.style.display = 'none';
        }
        // 隱藏單元選擇器，顯示測驗區域
        this.unitSelector.style.display = 'none';
        this.quizArea.style.display = 'block';
        this.scoreDisplay.style.display = 'none';

        this.startTimer();
        this.renderQuiz();
    }

    getAllQuestions() {
        if (this.currentUnitType === 'mixed') {
            let all = [];
            this.currentSingleUnits.forEach((unit, unitIndex) => {
                unit.questions.forEach((q, qi) => {
                    all.push({
                        ...q,
                        unitIndex,
                        originalIndex: qi,
                        unitName: unit.unit
                    });
                });
            });
            this.currentMultiUnits.forEach((unit, unitIndex) => {
                unit.questions.forEach((q, qi) => {
                    all.push({
                        ...q,
                        unitIndex,
                        originalIndex: qi,
                        unitName: unit.unit
                    });
                });
            });
            return all;
        }

        if (this.currentUnit === -1) {
            // 全部單元
            let allQuestions = [];
            this.currentSubjectData.forEach((unit, unitIndex) => {
                unit.questions.forEach((question, questionIndex) => {
                    allQuestions.push({
                        ...question,
                        unitIndex: unitIndex,
                        originalIndex: questionIndex,
                        unitName: unit.unit
                    });
                });
            });
            return allQuestions;
        } else {
            return this.currentSubjectData[this.currentUnit].questions.map((question, index) => ({
                ...question,
                unitIndex: this.currentUnit,
                originalIndex: index,
                unitName: this.currentSubjectData[this.currentUnit].unit
            }));
        }
    }

    getQuestions() {
        return this.selectedQuestions;
    }

    renderQuiz() {
        const questions = this.getQuestions();
        const totalPages = Math.ceil(questions.length / this.questionsPerPage);
        this.totalPages = totalPages;
        
        // 更新分頁資訊
        if (this.currentPageSpan) this.currentPageSpan.textContent = this.currentPage;
        if (this.totalPagesSpan) this.totalPagesSpan.textContent = totalPages;
        if (this.currentQuestionSpan) this.currentQuestionSpan.textContent = ((this.currentPage - 1) * this.questionsPerPage) + 1;
        if (this.totalQuestionsSpan) this.totalQuestionsSpan.textContent = Math.min(this.currentPage * this.questionsPerPage, questions.length);

        const progressPercent = (this.currentPage / totalPages) * 100;
        if (this.questionProgress) this.questionProgress.style.width = `${progressPercent}%`;
        if (this.progressText) this.progressText.textContent = `${this.currentPage} / ${totalPages}`;

        // 渲染當前頁面的題目
        this.renderCurrentPageQuestions();

        // 更新按鈕狀態
        this.updateButtonStates(totalPages);
    }

    renderCurrentPageQuestions() {
        const questions = this.getQuestions();
        const startIndex = (this.currentPage - 1) * this.questionsPerPage;
        const endIndex = Math.min(startIndex + this.questionsPerPage, questions.length);
        const currentPageQuestions = questions.slice(startIndex, endIndex);

        this.questionContainer.innerHTML = '';

        currentPageQuestions.forEach((question, pageIndex) => {
            const globalIndex = startIndex + pageIndex;
            const questionDiv = document.createElement('div');
            questionDiv.className = 'question-container';
            
            let unitInfo = '';
            if (this.currentUnit === -1) {
                unitInfo = `<div style="color: #7f8c8d; font-size: 0.9em; margin-bottom: 10px;">${question.unitName}</div>`;
            }

            const starred = this.starredQuestions.has(globalIndex) ? 'starred' : '';
            questionDiv.innerHTML = `
                ${unitInfo}
                <div class="question-header">
                    <div class="question-number" data-question-index="${globalIndex}">第 ${globalIndex + 1} 題</div>
                    <div class="star ${starred}" data-question-index="${globalIndex}">${this.starredQuestions.has(globalIndex) ? '★' : '☆'}</div>
                </div>
                <div class="question-text">${question.question}</div>
                <div class="options" data-question-index="${globalIndex}">
                    ${question.options.map((option, optionIndex) => `
                        <div class="option" data-option="${option.charAt(0)}" data-question-index="${globalIndex}">
                            ${option}
                        </div>
                    `).join('')}
                </div>
            `;

            this.questionContainer.appendChild(questionDiv);

            // 星號標記事件
            const starEl = questionDiv.querySelector('.star');
            starEl.addEventListener('click', (e) => {
                if (this.showingResults) return;
                const idx = parseInt(e.target.dataset.questionIndex);
                if (this.starredQuestions.has(idx)) {
                    this.starredQuestions.delete(idx);
                } else {
                    this.starredQuestions.add(idx);
                }
                starEl.classList.toggle('starred', this.starredQuestions.has(idx));
                starEl.textContent = this.starredQuestions.has(idx) ? '★' : '☆';
            });
        });

        // 添加選項點擊事件
        this.addOptionClickListeners();
        
        // 恢復用戶之前的選擇
        this.restoreUserSelections();

        if (this.showingResults) {
            this.showCorrectAnswers();
        }
    }

    addOptionClickListeners() {
        const options = document.querySelectorAll('.option');
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                if (this.showingResults) return;

                const questionIndex = parseInt(e.target.dataset.questionIndex);
                const selectedOption = e.target.dataset.option;
                const question = this.getQuestions()[questionIndex];

                if (Array.isArray(question.answers)) {
                    if (!Array.isArray(this.userAnswers[questionIndex])) {
                        this.userAnswers[questionIndex] = [];
                    }
                    const arr = this.userAnswers[questionIndex];
                    if (arr.includes(selectedOption)) {
                        e.target.classList.remove('selected');
                        this.userAnswers[questionIndex] = arr.filter(o => o !== selectedOption);
                    } else {
                        e.target.classList.add('selected');
                        arr.push(selectedOption);
                    }
                } else {
                    const questionOptions = document.querySelectorAll(`[data-question-index="${questionIndex}"]`);
                    questionOptions.forEach(opt => opt.classList.remove('selected'));
                    e.target.classList.add('selected');
                    this.userAnswers[questionIndex] = selectedOption;
                }

                this.updateButtonStates(this.totalPages);
            });
        });
    }

    restoreUserSelections() {
        Object.keys(this.userAnswers).forEach(questionIndex => {
            const selectedOption = this.userAnswers[questionIndex];
            if (Array.isArray(selectedOption)) {
                selectedOption.forEach(opt => {
                    const el = document.querySelector(`[data-question-index="${questionIndex}"][data-option="${opt}"]`);
                    if (el) el.classList.add('selected');
                });
            } else {
                const optionElement = document.querySelector(`[data-question-index="${questionIndex}"][data-option="${selectedOption}"]`);
                if (optionElement) optionElement.classList.add('selected');
            }
        });
    }

    showAnswerStatus() {
        const questions = this.getQuestions();
        this.statusList.innerHTML = '';
        questions.forEach((q, i) => {
            const item = document.createElement('div');
            let mark = null;
            if (this.showingResults) {
                const userAnswer = this.userAnswers[i];
                let isCorrect = false;
                if (Array.isArray(q.answers)) {
                    const ans = Array.isArray(userAnswer) ? userAnswer.slice().sort() : [];
                    const correct = (q.answers || []).slice().sort();
                    if (ans.length === correct.length && ans.every((v,idx)=>v===correct[idx])) {
                        isCorrect = true;
                    }
                } else {
                    if (userAnswer === q.answer) {
                        isCorrect = true;
                    }
                }
                item.className = 'status-item ' + (isCorrect ? 'correct' : 'incorrect');
                mark = document.createElement('span');
                mark.className = 'status-mark ' + (isCorrect ? 'correct' : 'incorrect');
                mark.textContent = isCorrect ? '✓' : '✗';
            } else {
                item.className = 'status-item ' + (this.userAnswers[i] ? 'answered' : 'unanswered');
            }

            const label = document.createElement('span');
            label.textContent = `第 ${i + 1} 題`;
            label.addEventListener('click', () => {
                this.currentPage = i + 1;
                this.hideAnswerStatus();
                this.renderQuiz();
            });

            const star = document.createElement('span');
            star.className = 'star ' + (this.starredQuestions.has(i) ? 'starred' : '');
            star.dataset.index = i;
            star.textContent = this.starredQuestions.has(i) ? '★' : '☆';
            star.addEventListener('click', (e) => {
                if (this.showingResults) return;
                e.stopPropagation();
                const idx = parseInt(star.dataset.index);
                if (this.starredQuestions.has(idx)) {
                    this.starredQuestions.delete(idx);
                } else {
                    this.starredQuestions.add(idx);
                }
                star.classList.toggle('starred', this.starredQuestions.has(idx));
                star.textContent = this.starredQuestions.has(idx) ? '★' : '☆';
                const starInQuestion = document.querySelector(`.star[data-question-index="${idx}"]`);
                if (starInQuestion) {
                    starInQuestion.classList.toggle('starred', this.starredQuestions.has(idx));
                    starInQuestion.textContent = this.starredQuestions.has(idx) ? '★' : '☆';
                }
            });

            item.appendChild(label);
            if (mark) item.appendChild(mark);
            item.appendChild(star);
            this.statusList.appendChild(item);
        });
        this.statusOverlay.style.display = 'flex';
    }

    hideAnswerStatus() {
        this.statusOverlay.style.display = 'none';
    }

    showSelection(title, items, callback) {
        this.selectTitle.textContent = title;
        this.selectList.innerHTML = '';
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'select-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = item.value;
            const label = document.createElement('label');
            label.textContent = item.label;
            div.appendChild(checkbox);
            div.appendChild(label);
            this.selectList.appendChild(div);
        });
        this.selectionCallback = callback;
        this.selectOverlay.style.display = 'flex';
    }

    hideSelection() {
        this.selectOverlay.style.display = 'none';
    }

    confirmSelection() {
        const cbs = this.selectList.querySelectorAll('input[type="checkbox"]');
        const selected = Array.from(cbs).filter(cb => cb.checked).map(cb => parseInt(cb.value));
        this.hideSelection();
        if (this.selectionCallback) this.selectionCallback(selected);
    }

    updateButtonStates(totalPages) {
        // 上一頁按鈕
        this.prevBtn.disabled = this.currentPage === 1;

        // 下一頁按鈕
        this.nextBtn.disabled = this.currentPage === totalPages;

        if (this.showingResults) {
            this.submitBtn.style.display = 'none';
        } else {
            this.submitBtn.style.display = 'inline-block';
            this.submitBtn.disabled = false;
        }

        if (this.currentPage === totalPages) {
            this.nextBtn.style.display = 'none';
        } else {
            this.nextBtn.style.display = 'inline-block';
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderQuiz();
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.renderQuiz();
        }
    }

    startTimer() {
        clearInterval(this.timerInterval);
        let remaining = this.timeLimit;
        this.remainingTime = remaining;
        const update = () => {
            const min = Math.floor(remaining / 60);
            const sec = remaining % 60;
            this.timerElement.textContent = `剩餘時間：${min}:${sec.toString().padStart(2, '0')}`;
            if (remaining <= 0) {
                clearInterval(this.timerInterval);
                alert('時間到，自動提交測驗');
                this.submitQuiz();
            }
            remaining--;
            this.remainingTime = remaining;
        };
        update();
        this.timerInterval = setInterval(update, 1000);
    }

    submitQuiz() {
        this.showingResults = true;
        const questions = this.getQuestions();

        clearInterval(this.timerInterval);
        this.timerElement.textContent = '';
        
        // 計算分數
        let correctAnswers = 0;
        questions.forEach((question, index) => {
            const userAnswer = this.userAnswers[index];
            if (Array.isArray(question.answers)) {
                const ans = Array.isArray(userAnswer) ? userAnswer.slice().sort() : [];
                const correct = (question.answers || []).slice().sort();
                if (ans.length === correct.length && ans.every((v,i)=>v===correct[i])) {
                    correctAnswers++;
                }
            } else {
                if (userAnswer === question.answer) {
                    correctAnswers++;
                }
            }
        });

        const totalQuestions = questions.length;
        const percentage = Math.round((correctAnswers / totalQuestions) * 100);
        const passText = percentage >= this.passScore ? '通過' : '未通過';

        // 顯示結果
        this.scoreDisplay.style.display = 'block';
        this.scoreText.innerHTML = `
            您答對了 ${correctAnswers} 題，共 ${totalQuestions} 題<br>
            正確率：${percentage}%<br>
            得分：${percentage} 分 - ${passText}<br>
            通過分數：${this.passScore} 分
        `;
        this.scoreProgress.style.width = `${percentage}%`;
        this.scoreProgress.style.background = percentage >= this.passScore
            ? 'linear-gradient(135deg, #27ae60 0%, #229954 100%)'
            : 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
        if (this.downloadPdfBtn) this.downloadPdfBtn.style.display = 'inline-block';

        // 顯示正確答案
        this.showCorrectAnswers();

        // 提交後仍可瀏覽題目
        this.prevBtn.style.display = 'inline-block';
        this.nextBtn.style.display = 'inline-block';
        this.submitBtn.style.display = 'none';

        // 滾動到頂部
        window.scrollTo(0, 0);
    }

    showCorrectAnswers() {
        const questions = this.getQuestions();
        
        questions.forEach((question, index) => {
            const userAnswer = this.userAnswers[index];
            const questionOptions = document.querySelectorAll(`.option[data-question-index="${index}"]`);
            questionOptions.forEach(option => {
                const optionLetter = option.dataset.option;
                if (Array.isArray(question.answers)) {
                    const correctAnswers = question.answers || [];
                    if (correctAnswers.includes(optionLetter)) {
                        option.classList.add('correct');
                    }
                    if (Array.isArray(userAnswer) && userAnswer.includes(optionLetter) && !correctAnswers.includes(optionLetter)) {
                        option.classList.add('incorrect');
                    }
                } else {
                    if (optionLetter === question.answer) {
                        option.classList.add('correct');
                    } else if (optionLetter === userAnswer && userAnswer !== question.answer) {
                        option.classList.add('incorrect');
                    }
                }
            });

            if (!userAnswer || (Array.isArray(userAnswer) && userAnswer.length === 0)) {
                const numberEl = document.querySelector(`.question-number[data-question-index="${index}"]`);
                if (numberEl && !numberEl.textContent.includes('未作答')) {
					numberEl.innerHTML += '<span style="color:red">（未作答）</span>';
                }
            }
        });
    }

    backToUnitSelector() {
        this.quizArea.style.display = 'none';
        this.unitSelector.style.display = 'block';
        this.resetQuiz();
        if (this.unitSettingsPanel) {
            this.unitSettingsPanel.style.display = 'none';
        }
    }

    backToSubjectSelector() {
        this.currentSubject = null;
        this.currentSubjectData = [];
        this.currentUnit = null;
        this.resetQuiz();
        this.renderSubjectSelector();
        if (this.unitSettingsPanel) {
            this.unitSettingsPanel.style.display = 'none';
        }
    }

    restartQuiz() {
        const allQuestions = this.getAllQuestions();
        let maxQuestions = Math.min(50, allQuestions.length);
        let countInput = prompt(`請輸入測驗題數 (5-${maxQuestions})`, Math.min(10, maxQuestions));
        if (countInput === null) return;
        let count = parseInt(countInput);
        if (isNaN(count)) count = Math.min(10, maxQuestions);
        count = Math.min(Math.max(count, 5), maxQuestions);

        let timeInput = prompt('請輸入測驗時間(分鐘)', this.timeLimit / 60);
        if (timeInput === null) return;
        let timeMin = parseInt(timeInput);
        if (isNaN(timeMin) || timeMin <= 0) timeMin = this.timeLimit / 60;

        this.resetQuiz();
        this.startQuiz(this.currentUnit, this.currentUnitType, count, timeMin);
    }

    resetQuiz() {
        this.currentQuestionIndex = 0;
        this.currentPage = 1;
        this.userAnswers = {};
        this.showingResults = false;
        this.selectedQuestions = [];
        this.starredQuestions.clear();
        this.hideAnswerStatus();

        clearInterval(this.timerInterval);
        if (this.timerElement) this.timerElement.textContent = '';

        // 重置按鈕顯示
        this.prevBtn.style.display = 'inline-block';
        this.nextBtn.style.display = 'inline-block';
        this.submitBtn.style.display = 'none';
        this.scoreDisplay.style.display = 'none';
        if (this.downloadPdfBtn) this.downloadPdfBtn.style.display = 'none';
    }

    importQuestions() {
        const file = this.importFile.files[0];
        const unitIndex = parseInt(this.importUnit.value);
        if (!file || isNaN(unitIndex)) {
            alert('請選擇單元與檔案');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const questions = Array.isArray(data) ? data : data.questions;
                if (!Array.isArray(questions)) throw new Error('格式錯誤');
                this.currentSubjectData[unitIndex].questions.push(...questions);
                this.saveToStorage();
                this.showToast('匯入成功');
                this.renderUnitSelector();
            } catch (err) {
                this.showToast('匯入失敗：檔案格式不正確');
            }
        };
        reader.readAsText(file, 'utf-8');
    }

    importQuestionsMulti() {
        const file = this.importFileMulti.files[0];
        const unitIndex = parseInt(this.importUnitMulti.value);
        if (!file || isNaN(unitIndex)) {
            alert('請選擇單元與檔案');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const questions = Array.isArray(data) ? data : data.questions;
                if (!Array.isArray(questions)) throw new Error('格式錯誤');
                this.currentMultiUnits[unitIndex].questions.push(...questions);
                subjects[this.currentSubject].multiUnits = this.currentMultiUnits;
                this.saveToStorage();
                this.showToast('匯入成功');
                this.renderUnitSelector();
            } catch (err) {
                this.showToast('匯入失敗：檔案格式不正確');
            }
        };
        reader.readAsText(file, 'utf-8');
    }

    exportAllQuestions() {
        if (this.currentSubject == null) return;
        const dataStr = JSON.stringify(this.currentSubjectData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${subjects[this.currentSubject].subject}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    exportUnit() {
        if (this.currentSubject == null) return;
        const unitIndex = parseInt(this.importUnit.value);
        if (isNaN(unitIndex)) {
            alert('請選擇單元');
            return;
        }
        const unit = this.currentSubjectData[unitIndex];
        const dataStr = JSON.stringify({ questions: unit.questions }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${unit.unit}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    exportUnitMulti() {
        if (this.currentSubject == null) return;
        const unitIndex = parseInt(this.importUnitMulti.value);
        if (isNaN(unitIndex)) {
            alert('請選擇單元');
            return;
        }
        const unit = this.currentMultiUnits[unitIndex];
        const dataStr = JSON.stringify({ questions: unit.questions }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${unit.unit}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    exportAllQuestionsMulti() {
        if (this.currentSubject == null) return;
        const dataStr = JSON.stringify(this.currentMultiUnits, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${subjects[this.currentSubject].subject}-multi.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    downloadFormat() {
        const a = document.createElement('a');
        a.href = 'import-format.json';
        a.download = 'import-format.json';
        a.click();
    }

    downloadFormatMulti() {
        const a = document.createElement('a');
        a.href = 'import-multi-format.json';
        a.download = 'import-multi-format.json';
        a.click();
    }

    importAllQuestions() {
        const file = this.importAllFile.files[0];
        if (!file) {
            alert('請選擇檔案');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const units = Array.isArray(data) ? data : data.units;
                if (!Array.isArray(units)) throw new Error('格式錯誤');
                this.currentSubjectData = units;
                subjects[this.currentSubject].units = units;
                this.saveToStorage();
                this.showToast('匯入成功');
                this.renderUnitSelector();
            } catch (err) {
                this.showToast('匯入失敗：檔案格式不正確');
            }
        };
        reader.readAsText(file, 'utf-8');
    }

    importAllQuestionsMulti() {
        const file = this.importAllFileMulti.files[0];
        if (!file) {
            alert('請選擇檔案');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const units = Array.isArray(data) ? data : data.units;
                if (!Array.isArray(units)) throw new Error('格式錯誤');
                this.currentMultiUnits = units;
                subjects[this.currentSubject].multiUnits = units;
                this.saveToStorage();
                this.showToast('匯入成功');
                this.renderUnitSelector();
            } catch (err) {
                this.showToast('匯入失敗：檔案格式不正確');
            }
        };
        reader.readAsText(file, 'utf-8');
    }

    addSubject() {
        const name = prompt('請輸入科目名稱');
        if (!name) return;
        subjects.push({ subject: name, units: [] });
        this.saveToStorage();
        this.renderSubjectSelector();
    }

    addUnit() {
        if (this.currentSubject == null) return;
        const name = prompt('請輸入單元名稱');
        if (!name) return;
        this.currentSubjectData.push({ unit: name, questions: [] });
        subjects[this.currentSubject].units = this.currentSubjectData;
        this.saveToStorage();
        this.renderUnitSelector();
    }

    removeSubject() {
        if (!subjects.length) return;
        const items = subjects.map((s, i) => ({ label: s.subject, value: i }));
        this.showSelection('選擇要刪除的科目', items, (selected) => {
            if (!selected.length) return;
            if (!confirm('確定刪除選取的科目？')) return;
            selected.sort((a,b) => b - a).forEach(idx => subjects.splice(idx, 1));
            this.saveToStorage();
            this.renderSubjectSelector();
        });
    }

    removeUnit() {
        if (this.currentSubject == null) return;
        if (!this.currentSubjectData.length) return;
        const items = this.currentSubjectData.map((u, i) => ({ label: u.unit, value: i }));
        this.showSelection('選擇要刪除的單元', items, (selected) => {
            if (!selected.length) return;
            if (!confirm('確定刪除選取的單元？')) return;
            selected.sort((a,b) => b - a).forEach(idx => {
                this.currentSubjectData.splice(idx, 1);
            });
            subjects[this.currentSubject].units = this.currentSubjectData;
            this.saveToStorage();
            this.renderUnitSelector();
        });
    }

    addUnitMulti() {
        if (this.currentSubject == null) return;
        const name = prompt('請輸入單元名稱');
        if (!name) return;
        if (!Array.isArray(subjects[this.currentSubject].multiUnits)) {
            subjects[this.currentSubject].multiUnits = [];
        }
        this.currentMultiUnits = subjects[this.currentSubject].multiUnits;
        this.currentMultiUnits.push({ unit: name, questions: [] });
        this.saveToStorage();
        this.renderUnitSelector();
    }

    removeUnitMulti() {
        if (this.currentSubject == null) return;
        this.currentMultiUnits = subjects[this.currentSubject].multiUnits || [];
        if (!this.currentMultiUnits.length) return;
        const items = this.currentMultiUnits.map((u, i) => ({ label: u.unit, value: i }));
        this.showSelection('選擇要刪除的單元', items, (selected) => {
            if (!selected.length) return;
            if (!confirm('確定刪除選取的單元？')) return;
            selected.sort((a,b) => b - a).forEach(idx => {
                this.currentMultiUnits.splice(idx, 1);
            });
            subjects[this.currentSubject].multiUnits = this.currentMultiUnits;
            this.saveToStorage();
            this.renderUnitSelector();
        });
    }

    syncSingleToMulti() {
        if (this.currentSubject == null) return;
        if (!confirm('確定要同步單選題庫單元至多選題庫？(僅同步下拉選單，不會同步題目)')) return;
        const units = this.currentSingleUnits.map(u => ({ unit: u.unit, questions: [] }));
        this.currentMultiUnits = units;
        subjects[this.currentSubject].multiUnits = units;
        this.saveToStorage();
        this.renderUnitSelector();
        this.showToast('多選題庫下拉選單已同步');
    }

    syncMultiToSingle() {
        if (this.currentSubject == null) return;
        if (!confirm('確定要同步多選題庫單元至單選題庫？(僅同步下拉選單，不會同步題目)')) return;
        const units = this.currentMultiUnits.map(u => ({ unit: u.unit, questions: [] }));
        this.currentSingleUnits = units;
        this.currentSubjectData = units;
        subjects[this.currentSubject].units = units;
        this.saveToStorage();
        this.renderUnitSelector();
        this.showToast('單選題庫下拉選單已同步');
    }

    editUnitQuestions() {
        if (this.currentSubject == null) return;
        const unitIndex = parseInt(this.importUnit.value);
        if (isNaN(unitIndex)) {
            alert('請選擇單元');
            return;
        }
        const unit = this.currentSubjectData[unitIndex];
        if (!unit.questions.length) {
            alert('此單元尚無題目');
            return;
        }
        const items = unit.questions.map((q, i) => ({
            label: `${i + 1}. ${q.question.slice(0, 30)}`,
            value: i
        }));
        this.showSelection('選擇要刪除的題目', items, (selected) => {
            if (!selected.length) return;
            if (!confirm('確定刪除選取的題目？')) return;
            selected.sort((a,b) => b - a).forEach(idx => unit.questions.splice(idx, 1));
            if (unit.questions.length === 0) {
                this.currentSubjectData.splice(unitIndex, 1);
                subjects[this.currentSubject].units = this.currentSubjectData;
            }
            this.saveToStorage();
            this.renderUnitSelector();
            alert('已刪除題目');
        });
    }

    editUnitQuestionsMulti() {
        if (this.currentSubject == null) return;
        const unitIndex = parseInt(this.importUnitMulti.value);
        if (isNaN(unitIndex)) {
            alert('請選擇單元');
            return;
        }
        const unit = this.currentMultiUnits[unitIndex];
        if (!unit.questions.length) {
            alert('此單元尚無題目');
            return;
        }
        const items = unit.questions.map((q, i) => ({
            label: `${i + 1}. ${q.question.slice(0, 30)}`,
            value: i
        }));
        this.showSelection('選擇要刪除的題目', items, (selected) => {
            if (!selected.length) return;
            if (!confirm('確定刪除選取的題目？')) return;
            selected.sort((a,b) => b - a).forEach(idx => unit.questions.splice(idx, 1));
            if (unit.questions.length === 0) {
                this.currentMultiUnits.splice(unitIndex, 1);
            }
            subjects[this.currentSubject].multiUnits = this.currentMultiUnits;
            this.saveToStorage();
            this.renderUnitSelector();
            alert('已刪除題目');
        });
    }

    downloadPDF() {
        if (!window.jspdf || !window.jspdf.jsPDF || !window.html2canvas) {
            alert('無法載入PDF庫');
            return;
        }
        const { jsPDF } = window.jspdf;

        const subjectName = subjects[this.currentSubject].subject;
        const unitName = this.currentUnit === -1 ? '全部單元' : this.currentSubjectData[this.currentUnit].unit;

        const container = document.createElement('div');
        container.style.padding = '20px';
        container.style.fontFamily = 'Arial,\'Microsoft JhengHei\',sans-serif';
        container.style.fontSize = '32px';
        container.innerHTML = `
            <h2>測驗結果</h2>
            <p>科目：${subjectName}</p>
            <p>單元：${unitName}</p>
            <p>${this.scoreText.textContent}</p>
            <p>剩餘時間：${Math.floor(this.remainingTime/60)}:${(this.remainingTime%60).toString().padStart(2,'0')}</p>
            <hr>
        `;

        const questions = this.getQuestions();
        questions.forEach((q, i) => {
            const div = document.createElement('div');
            const userAns = this.userAnswers[i] || '未作答';
            const starred = this.starredQuestions.has(i) ? '★' : '';
            div.innerHTML = `<strong>第 ${i+1} 題 ${starred}</strong><br>${q.question}<br>您的答案：${userAns}，正確答案：${q.answer}`;
            div.style.marginTop = '10px';
            container.appendChild(div);
        });

        document.body.appendChild(container);
        html2canvas(container, { scale: 2 }).then(canvas => {
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const imgData = canvas.toDataURL('image/png');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 25.4; // Word 標準邊界 (1 吋)
            const usableWidth = pageWidth - margin * 2;
            const usableHeight = pageHeight - margin * 2;
            const imgWidth = usableWidth;
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let heightLeft = imgHeight;
            let position = margin;

            pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
            heightLeft -= usableHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight + margin;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
                heightLeft -= usableHeight;
            }

            pdf.save('quiz-result.pdf');
            document.body.removeChild(container);
        });
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        if (!toast) {
            alert(message);
            return;
        }
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem('quizSubjects');
            if (data) {
                subjects = JSON.parse(data);
            }
        } catch (e) {
            console.error('load storage failed', e);
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('quizSubjects', JSON.stringify(subjects));
        } catch (e) {
            console.error('save storage failed', e);
        }
    }
}

// 當頁面載入完成後初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});

