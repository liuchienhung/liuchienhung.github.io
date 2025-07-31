// PT職能題庫測驗系統
class QuizApp {
    constructor() {
        this.currentSubject = null;
        this.currentUnit = null;
        this.currentSubjectData = [];
        this.currentQuestionIndex = 0;
        this.currentPage = 1;
        this.questionsPerPage = 1;
        this.selectedQuestions = [];
        this.timeLimit = 30 * 60; // default 30 minutes
        this.remainingTime = this.timeLimit;
        this.timerInterval = null;
        this.userAnswers = {};
        this.showingResults = false;
        this.starredQuestions = new Set();
        this.selectionCallback = null;

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
        this.unitButtonsSingle = document.getElementById('unit-buttons-single');
        this.unitButtonsMulti = document.getElementById('unit-buttons-multi');
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
        this.importBtnMulti = document.getElementById('import-btn-multi');
        this.importUnitMulti = document.getElementById('import-unit-multi');
        this.importSubjectFile = document.getElementById('import-subject-file');
        this.importSubjectBtn = document.getElementById('import-subject-btn');
        this.exportSubjectBtn = document.getElementById('export-subject-btn');
        this.exportUnitBtn = document.getElementById('export-unit-btn');
        this.exportUnitBtnMulti = document.getElementById('export-unit-btn-multi');
        this.downloadPdfBtn = document.getElementById('download-pdf');
        this.downloadFormatBtn = document.getElementById('download-format-btn');
        this.editUnitBtn = document.getElementById('edit-unit-btn');
        this.editUnitBtnMulti = document.getElementById('edit-unit-btn-multi');

        this.addSubjectBtn = document.getElementById('add-subject');
        this.addUnitBtn = document.getElementById('add-unit');
        this.removeSubjectBtn = document.getElementById('remove-subject');
        this.removeUnitBtn = document.getElementById('remove-unit');
        
        this.currentPageSpan = document.getElementById('current-page');
        this.totalPagesSpan = document.getElementById('total-pages');
        this.currentQuestionSpan = document.getElementById('current-question');
        this.totalQuestionsSpan = document.getElementById('total-questions');
    }

    initializeEventListeners() {
        this.prevBtn.addEventListener('click', () => this.previousPage());
        this.nextBtn.addEventListener('click', () => this.nextPage());
        this.submitBtn.addEventListener('click', () => this.submitQuiz());
        this.statusBtn.addEventListener('click', () => this.showAnswerStatus());
        this.backToUnitsBtn.addEventListener('click', () => this.backToUnitSelector());
        this.backToSubjectsBtn.addEventListener('click', () => this.backToSubjectSelector());
        this.restartBtn.addEventListener('click', () => this.restartQuiz());
        this.closeStatusBtn.addEventListener('click', () => this.hideAnswerStatus());
        this.importBtn.addEventListener('click', () => this.importQuestions());
        if (this.importBtnMulti) {
            this.importBtnMulti.addEventListener('click', () => this.importQuestions(true));
        }
        if (this.downloadPdfBtn) {
            this.downloadPdfBtn.addEventListener('click', () => this.downloadPDF());
        }
        if (this.downloadFormatBtn) {
            this.downloadFormatBtn.addEventListener('click', () => this.downloadFormat());
        }
        if (this.addSubjectBtn) {
            this.addSubjectBtn.addEventListener('click', () => this.addSubject());
        }
        if (this.addUnitBtn) {
            this.addUnitBtn.addEventListener('click', () => this.addUnit());
        }
        if (this.removeSubjectBtn) {
            this.removeSubjectBtn.addEventListener('click', () => this.removeSubject());
        }
        if (this.removeUnitBtn) {
            this.removeUnitBtn.addEventListener('click', () => this.removeUnit());
        }
        if (this.importSubjectBtn) {
            this.importSubjectBtn.addEventListener('click', () => this.importSubject());
        }
        if (this.exportSubjectBtn) {
            this.exportSubjectBtn.addEventListener('click', () => this.exportSubject());
        }
        if (this.exportUnitBtn) {
            this.exportUnitBtn.addEventListener('click', () => this.exportUnit());
        }
        if (this.exportUnitBtnMulti) {
            this.exportUnitBtnMulti.addEventListener('click', () => this.exportUnit(true));
        }
        if (this.editUnitBtn) {
            this.editUnitBtn.addEventListener('click', () => this.editUnitQuestions());
        }
        if (this.editUnitBtnMulti) {
            this.editUnitBtnMulti.addEventListener('click', () => this.editUnitQuestions(true));
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
            const count = subj.units.reduce((s, u) => s + u.questions.length, 0);
            button.innerHTML = `
                <strong>${subj.subject}</strong><br>
                <small>${count} 道題目</small>
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
        this.currentSubjectData = subjects[index].units;
        this.renderUnitSelector();
        this.subjectSelector.style.display = 'none';
        this.unitSelector.style.display = 'block';
    }

    renderUnitSelector() {
        this.unitButtonsSingle.innerHTML = '';
        this.unitButtonsMulti.innerHTML = '';
        if (this.importUnit) this.importUnit.innerHTML = '';
        if (this.importUnitMulti) this.importUnitMulti.innerHTML = '';

        this.currentSubjectData.forEach((unit, index) => {
            const button = document.createElement('button');
            button.className = 'unit-btn';
            button.innerHTML = `
                <strong>${unit.unit}</strong><br>
                <small>${unit.questions.length} 道題目</small>
            `;
            button.addEventListener('click', () => this.startQuiz(index));

            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = unit.unit;

            if (unit.type === 'multi') {
                this.unitButtonsMulti.appendChild(button);
                if (this.importUnitMulti) this.importUnitMulti.appendChild(opt);
            } else {
                this.unitButtonsSingle.appendChild(button);
                if (this.importUnit) this.importUnit.appendChild(opt);
            }
        });

        // 添加全部單元測驗選項
        const allUnitsButton = document.createElement('button');
        allUnitsButton.className = 'unit-btn';
        allUnitsButton.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
        const totalQuestions = this.currentSubjectData.reduce((sum, unit) => sum + unit.questions.length, 0);
        allUnitsButton.innerHTML = `
            <strong>全部單元綜合測驗</strong><br>
            <small>${totalQuestions} 道題目</small>
        `;
        allUnitsButton.addEventListener('click', () => this.startQuiz(-1));
        this.unitButtonsSingle.appendChild(allUnitsButton);
    }

    startQuiz(unitIndex) {
        this.currentUnit = unitIndex;
        this.currentQuestionIndex = 0;
        this.currentPage = 1;
        this.userAnswers = {};
        this.showingResults = false;

        const allQuestions = this.getAllQuestions();
        let maxQuestions = Math.min(50, allQuestions.length);
        let countInput = prompt(`請輸入測驗題數 (5-${maxQuestions})`, Math.min(10, maxQuestions));
        if (countInput === null) {
            this.backToUnitSelector();
            return;
        }
        let count = parseInt(countInput);
        if (isNaN(count)) count = Math.min(10, maxQuestions);
        count = Math.min(Math.max(count, 5), maxQuestions);

        const shuffled = allQuestions.sort(() => Math.random() - 0.5);
        this.selectedQuestions = shuffled.slice(0, count);

        let timeInput = prompt('請輸入測驗時間(分鐘)', this.timeLimit / 60);
        if (timeInput === null) {
            this.backToUnitSelector();
            return;
        }
        let timeMin = parseInt(timeInput);
        if (isNaN(timeMin) || timeMin <= 0) timeMin = this.timeLimit / 60;
        this.timeLimit = timeMin * 60;

        // 隱藏單元選擇器，顯示測驗區域
        this.unitSelector.style.display = 'none';
        this.quizArea.style.display = 'block';
        this.scoreDisplay.style.display = 'none';

        this.startTimer();
        this.renderQuiz();
    }

    getAllQuestions() {
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
        this.currentPageSpan.textContent = this.currentPage;
        this.totalPagesSpan.textContent = totalPages;
        this.currentQuestionSpan.textContent = ((this.currentPage - 1) * this.questionsPerPage) + 1;
        this.totalQuestionsSpan.textContent = Math.min(this.currentPage * this.questionsPerPage, questions.length);

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
            const multiNote = Array.isArray(question.answer) ? '<span style="color:#e67e22;font-size:0.9em;">（多選）</span>' : '';
            questionDiv.innerHTML = `
                ${unitInfo}
                <div class="question-header">
                    <div class="question-number">第 ${globalIndex + 1} 題 ${multiNote}</div>
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
    }

    addOptionClickListeners() {
        const options = document.querySelectorAll('.option');
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                if (this.showingResults) return;

                const questionIndex = parseInt(e.target.dataset.questionIndex);
                const selectedOption = e.target.dataset.option;
                const question = this.getQuestions()[questionIndex];

                if (Array.isArray(question.answer)) {
                    // 多選題：切換選擇
                    const current = this.userAnswers[questionIndex] || [];
                    const idx = current.indexOf(selectedOption);
                    if (idx >= 0) {
                        current.splice(idx, 1);
                        e.target.classList.remove('selected');
                    } else {
                        current.push(selectedOption);
                        e.target.classList.add('selected');
                    }
                    this.userAnswers[questionIndex] = current;
                } else {
                    // 單選題
                    const questionOptions = document.querySelectorAll(`[data-question-index="${questionIndex}"]`);
                    questionOptions.forEach(opt => opt.classList.remove('selected'));
                    e.target.classList.add('selected');
                    this.userAnswers[questionIndex] = selectedOption;
                }

                this.updateButtonStates(this.totalPages);

                if (questionIndex === this.currentPage - 1 && this.currentPage < this.totalPages && !Array.isArray(question.answer)) {
                    setTimeout(() => this.nextPage(), 300);
                }
            });
        });
    }

    restoreUserSelections() {
        Object.keys(this.userAnswers).forEach(questionIndex => {
            const ans = this.userAnswers[questionIndex];
            if (Array.isArray(ans)) {
                ans.forEach(o => {
                    const el = document.querySelector(`[data-question-index="${questionIndex}"][data-option="${o}"]`);
                    if (el) el.classList.add('selected');
                });
            } else {
                const optionElement = document.querySelector(`[data-question-index="${questionIndex}"][data-option="${ans}"]`);
                if (optionElement) optionElement.classList.add('selected');
            }
        });
    }

    showAnswerStatus() {
        const questions = this.getQuestions();
        this.statusList.innerHTML = '';
        questions.forEach((q, i) => {
            const item = document.createElement('div');
            const ans = this.userAnswers[i];
            const answered = Array.isArray(ans) ? ans.length > 0 : !!ans;
            item.className = 'status-item ' + (answered ? 'answered' : 'unanswered');

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
        const q = this.getQuestions()[this.currentPage - 1];
        const ans = this.userAnswers[this.currentPage - 1];
        const answered = Array.isArray(q.answer) ? Array.isArray(ans) && ans.length > 0 : !!ans;
        this.nextBtn.disabled = this.currentPage === totalPages || !answered;

        if (this.currentPage === totalPages) {
            this.submitBtn.style.display = 'inline-block';
            this.submitBtn.disabled = !answered;
            this.nextBtn.style.display = 'none';
        } else {
            this.nextBtn.style.display = 'inline-block';
            this.submitBtn.style.display = 'none';
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
            if (Array.isArray(question.answer)) {
                if (Array.isArray(userAnswer) && userAnswer.length === question.answer.length && userAnswer.every(a => question.answer.includes(a))) {
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

        // 顯示結果
        this.scoreDisplay.style.display = 'block';
        this.scoreText.innerHTML = `
            您答對了 ${correctAnswers} 題，共 ${totalQuestions} 題<br>
            正確率：${percentage}%
        `;
        this.scoreProgress.style.width = `${percentage}%`;
        if (this.downloadPdfBtn) this.downloadPdfBtn.style.display = 'inline-block';

        // 顯示正確答案
        this.showCorrectAnswers();

        // 隱藏導航按鈕
        this.prevBtn.style.display = 'none';
        this.nextBtn.style.display = 'none';
        this.submitBtn.style.display = 'none';

        // 滾動到頂部
        window.scrollTo(0, 0);
    }

    showCorrectAnswers() {
        const questions = this.getQuestions();
        
        questions.forEach((question, index) => {
            const userAnswer = this.userAnswers[index];
            const correctAnswer = question.answer;

            const questionOptions = document.querySelectorAll(`[data-question-index="${index}"]`);
            questionOptions.forEach(option => {
                const optionLetter = option.dataset.option;

                if (Array.isArray(correctAnswer)) {
                    if (correctAnswer.includes(optionLetter)) {
                        option.classList.add('correct');
                    }
                    if (Array.isArray(userAnswer) && userAnswer.includes(optionLetter) && !correctAnswer.includes(optionLetter)) {
                        option.classList.add('incorrect');
                    }
                } else {
                    if (optionLetter === correctAnswer) {
                        option.classList.add('correct');
                    } else if (optionLetter === userAnswer && userAnswer !== correctAnswer) {
                        option.classList.add('incorrect');
                    }
                }
            });
        });
    }

    backToUnitSelector() {
        this.quizArea.style.display = 'none';
        this.unitSelector.style.display = 'block';
        this.resetQuiz();
    }

    backToSubjectSelector() {
        this.currentSubject = null;
        this.currentSubjectData = [];
        this.currentUnit = null;
        this.resetQuiz();
        this.renderSubjectSelector();
    }

    restartQuiz() {
        this.resetQuiz();
        this.startQuiz(this.currentUnit);
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

    importQuestions(isMulti = false) {
        const file = (isMulti ? this.importFileMulti : this.importFile).files[0];
        const unitIndex = parseInt((isMulti ? this.importUnitMulti : this.importUnit).value);
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
                alert('匯入成功');
                this.renderUnitSelector();
            } catch (err) {
                alert('匯入失敗：檔案格式不正確');
            }
        };
        reader.readAsText(file, 'utf-8');
    }

    exportSubject() {
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

    exportUnit(isMulti = false) {
        if (this.currentSubject == null) return;
        const unitIndex = parseInt((isMulti ? this.importUnitMulti : this.importUnit).value);
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

    downloadFormat() {
        const a = document.createElement('a');
        a.href = 'import-format.json';
        a.download = 'import-format.json';
        a.click();
    }

    importSubject() {
        const file = this.importSubjectFile.files[0];
        if (!file) {
            alert('請選擇檔案');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!Array.isArray(data)) throw new Error('格式錯誤');
                this.currentSubjectData = data;
                subjects[this.currentSubject].units = data;
                this.saveToStorage();
                alert('匯入成功');
                this.renderUnitSelector();
            } catch (err) {
                alert('匯入失敗：檔案格式不正確');
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

    editUnitQuestions(isMulti = false) {
        if (this.currentSubject == null) return;
        const unitIndex = parseInt((isMulti ? this.importUnitMulti : this.importUnit).value);
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
        html2canvas(container).then(canvas => {
            const pdf = new jsPDF({orientation: 'p', unit: 'px', format: [canvas.width, canvas.height]});
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save('quiz-result.pdf');
            document.body.removeChild(container);
        });
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

