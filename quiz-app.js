// PT職能題庫測驗系統
class QuizApp {
    constructor() {
        this.currentSubject = null;
        this.currentUnit = null;
        this.currentSubjectData = [];
        this.currentQuestionIndex = 0;
        this.currentPage = 1;
        // 一題一頁作答
        this.questionsPerPage = 1;
        this.userAnswers = {};
        this.showingResults = false;

        // 考試相關設定
        this.questions = [];
        this.examQuestionCount = 0;
        this.timerInterval = null;
        this.timeRemaining = 0;
        
        this.initializeElements();
        this.initializeEventListeners();
        this.renderSubjectSelector();
    }

    initializeElements() {
        this.subjectSelector = document.getElementById('subject-selector');
        this.subjectButtons = document.getElementById('subject-buttons');
        this.backToSubjectsBtn = document.getElementById('back-to-subjects');

        this.unitSelector = document.getElementById('unit-selector');
        this.unitButtons = document.getElementById('unit-buttons');
        this.quizArea = document.getElementById('quiz-area');
        this.questionContainer = document.getElementById('question-container');
        this.scoreDisplay = document.getElementById('score-display');
        this.scoreText = document.getElementById('score-text');
        this.scoreProgress = document.getElementById('score-progress');
        
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.submitBtn = document.getElementById('submit-btn');
        this.statusBtn = document.getElementById('status-btn');
        this.backToUnitsBtn = document.getElementById('back-to-units');
        this.restartBtn = document.getElementById('restart-quiz');
        
        this.currentPageSpan = document.getElementById('current-page');
        this.totalPagesSpan = document.getElementById('total-pages');
        this.currentQuestionSpan = document.getElementById('current-question');
        this.totalQuestionsSpan = document.getElementById('total-questions');
        this.timerDisplay = document.getElementById('timer');
    }

    initializeEventListeners() {
        this.prevBtn.addEventListener('click', () => this.previousPage());
        this.nextBtn.addEventListener('click', () => this.nextPage());
        this.submitBtn.addEventListener('click', () => this.submitQuiz());
        this.statusBtn.addEventListener('click', () => this.showAnswerStatus());
        this.backToUnitsBtn.addEventListener('click', () => this.backToUnitSelector());
        this.backToSubjectsBtn.addEventListener('click', () => this.backToSubjectSelector());
        this.restartBtn.addEventListener('click', () => this.restartQuiz());
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
        this.unitButtons.innerHTML = '';

        this.currentSubjectData.forEach((unit, index) => {
            const button = document.createElement('button');
            button.className = 'unit-btn';
            button.innerHTML = `
                <strong>${unit.unit}</strong><br>
                <small>${unit.questions.length} 道題目</small>
            `;
            button.addEventListener('click', () => this.startQuiz(index));
            this.unitButtons.appendChild(button);
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
        this.unitButtons.appendChild(allUnitsButton);
    }

    startQuiz(unitIndex) {
        this.currentUnit = unitIndex;
        this.currentQuestionIndex = 0;
        this.currentPage = 1;
        this.userAnswers = {};
        this.showingResults = false;
        // 建立題目清單
        const allQuestions = this.buildAllQuestions();

        let qCount = parseInt(prompt('請輸入測驗題數 (5-50)', '10'));
        if (isNaN(qCount)) qCount = 10;
        qCount = Math.min(Math.max(qCount, 5), 50);
        this.examQuestionCount = Math.min(qCount, allQuestions.length);

        this.questions = this.shuffleArray(allQuestions).slice(0, this.examQuestionCount);

        let minutes = parseInt(prompt('請輸入測驗時間(分鐘)', '30'));
        if (isNaN(minutes) || minutes <= 0) minutes = 30;
        this.timeRemaining = minutes * 60;

        // 隱藏單元選擇器，顯示測驗區域
        this.unitSelector.style.display = 'none';
        this.quizArea.style.display = 'block';
        this.scoreDisplay.style.display = 'none';

        this.startTimer();
        this.renderQuiz();
    }

    buildAllQuestions() {
        if (this.currentUnit === -1) {
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
        return this.questions;
    }

    renderQuiz() {
        const questions = this.getQuestions();
        const totalPages = Math.ceil(questions.length / this.questionsPerPage);

        // 更新分頁資訊
        this.currentPageSpan.textContent = this.currentPage;
        this.totalPagesSpan.textContent = totalPages;
        this.currentQuestionSpan.textContent = this.currentPage;
        this.totalQuestionsSpan.textContent = questions.length;

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

            questionDiv.innerHTML = `
                ${unitInfo}
                <div class="question-number">第 ${globalIndex + 1} 題</div>
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
                
                // 清除同一題目的其他選項的選中狀態
                const questionOptions = document.querySelectorAll(`[data-question-index="${questionIndex}"]`);
                questionOptions.forEach(opt => opt.classList.remove('selected'));
                
                // 標記當前選項為選中
                e.target.classList.add('selected');
                
                // 保存用戶答案
                this.userAnswers[questionIndex] = selectedOption;

                // 一題一題作答，自動進入下一題
                const totalPages = Math.ceil(this.getQuestions().length / this.questionsPerPage);
                if (this.currentPage < totalPages) {
                    setTimeout(() => {
                        this.nextPage();
                    }, 200);
                }
            });
        });
    }

    restoreUserSelections() {
        Object.keys(this.userAnswers).forEach(questionIndex => {
            const selectedOption = this.userAnswers[questionIndex];
            const optionElement = document.querySelector(`[data-question-index="${questionIndex}"][data-option="${selectedOption}"]`);
            if (optionElement) {
                optionElement.classList.add('selected');
            }
        });
    }

    showAnswerStatus() {
        const questions = this.getQuestions();
        const statusLines = questions.map((q, i) => `第 ${i + 1} 題：${this.userAnswers[i] ? '已作答' : '未作答'}`);
        const unanswered = questions.map((q, i) => (!this.userAnswers[i] ? i + 1 : null)).filter(n => n);
        if (unanswered.length === 0) {
            alert(statusLines.join('\n') + '\n\n已全部作答');
            return;
        }
        const input = prompt(statusLines.join('\n') + '\n\n輸入要前往的未作答題號：', unanswered[0]);
        const num = parseInt(input);
        if (unanswered.includes(num)) {
            this.currentPage = num;
            this.renderQuiz();
        }
    }

    updateButtonStates(totalPages) {
        // 上一頁按鈕
        this.prevBtn.disabled = this.currentPage === 1;
        
        // 下一頁按鈕
        this.nextBtn.disabled = this.currentPage === totalPages;
        
        // 提交按鈕
        if (this.currentPage === totalPages) {
            this.nextBtn.style.display = 'none';
            this.submitBtn.style.display = 'inline-block';
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
        const questions = this.getQuestions();
        const totalPages = Math.ceil(questions.length / this.questionsPerPage);

        const currentIndex = (this.currentPage - 1) * this.questionsPerPage;
        if (!this.userAnswers[currentIndex]) {
            alert('請先作答本題');
            return;
        }

        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderQuiz();
        }
    }

    submitQuiz() {
        this.showingResults = true;
        this.stopTimer();
        const questions = this.getQuestions();
        
        // 計算分數
        let correctAnswers = 0;
        questions.forEach((question, index) => {
            const userAnswer = this.userAnswers[index];
            if (userAnswer === question.answer) {
                correctAnswers++;
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
                
                if (optionLetter === correctAnswer) {
                    option.classList.add('correct');
                } else if (optionLetter === userAnswer && userAnswer !== correctAnswer) {
                    option.classList.add('incorrect');
                }
            });
        });
    }

    startTimer() {
        this.stopTimer();
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => {
            if (this.timeRemaining <= 0) {
                this.stopTimer();
                alert('時間到，自動提交答案');
                this.submitQuiz();
            } else {
                this.timeRemaining--;
                this.updateTimerDisplay();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        if (!this.timerDisplay) return;
        const m = String(Math.floor(this.timeRemaining / 60)).padStart(2, '0');
        const s = String(this.timeRemaining % 60).padStart(2, '0');
        this.timerDisplay.textContent = `剩餘時間：${m}:${s}`;
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    shuffleArray(arr) {
        return arr
            .map(v => ({ v, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ v }) => v);
    }

    backToUnitSelector() {
        this.quizArea.style.display = 'none';
        this.unitSelector.style.display = 'block';
        this.resetQuiz();
    }

    backToSubjectSelector() {
        this.unitSelector.style.display = 'none';
        this.subjectSelector.style.display = 'block';
        this.currentSubject = null;
        this.currentSubjectData = [];
        this.currentUnit = null;
        this.resetQuiz();
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
        this.questions = [];
        this.examQuestionCount = 0;
        this.stopTimer();

        // 重置按鈕顯示
        this.prevBtn.style.display = 'inline-block';
        this.nextBtn.style.display = 'inline-block';
        this.submitBtn.style.display = 'none';
        this.scoreDisplay.style.display = 'none';
    }
}

// 當頁面載入完成後初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});

