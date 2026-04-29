const gameController = {
    currentChapterId: null,
    currentLevelIndex: 0,
    chapterStats: {},
    totalCorrect: 0,
    totalWrong: 0,
    wrongAnswers: [],
    currentWrongIndex: 0,

    init: function() {
        this.chapterStats = {};
        gameData.chapters.forEach(chapter => {
            this.chapterStats[chapter.id] = {
                correct: 0,
                wrong: 0,
                levelsCompleted: 0
            };
        });
        this.totalCorrect = 0;
        this.totalWrong = 0;
        this.wrongAnswers = [];
        this.currentWrongIndex = 0;
        this.updateStartPageProgress();
        this.updateWrongAnswerButton();
    },

    showPage: function(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
        }
    },

    goToStart: function() {
        this.updateStartPageProgress();
        this.updateWrongAnswerButton();
        this.showPage('start-page');
    },

    goToChapterSelect: function() {
        this.renderChapterList();
        this.showPage('chapter-select-page');
    },

    startChapter: function(chapterId) {
        this.currentChapterId = chapterId;
        this.currentLevelIndex = 0;
        
        if (!this.chapterStats[chapterId]) {
            this.chapterStats[chapterId] = {
                correct: 0,
                wrong: 0,
                levelsCompleted: 0
            };
        }
        
        this.renderLevel();
        this.showPage('game-page');
    },

    renderChapterList: function() {
        const chapterList = document.getElementById('chapter-list');
        chapterList.innerHTML = '';

        gameData.chapters.forEach(chapter => {
            const isCompleted = chapter.completed;
            const stats = this.chapterStats[chapter.id] || { correct: 0, wrong: 0 };
            
            const chapterCard = document.createElement('div');
            chapterCard.className = `chapter-card ${isCompleted ? 'completed' : ''}`;
            chapterCard.onclick = () => this.startChapter(chapter.id);
            
            chapterCard.innerHTML = `
                <div class="chapter-icon">${chapter.icon}</div>
                <div class="chapter-content">
                    <h3>${chapter.name}</h3>
                    <p class="chapter-description">${chapter.description}</p>
                    <div class="chapter-meta">
                        <span class="level-count">${chapter.levels.length} 关</span>
                        ${isCompleted ? '<span class="completed-badge">✓ 已完成</span>' : ''}
                        ${stats.correct > 0 || stats.wrong > 0 ? 
                            `<span class="stats-badge">答对 ${stats.correct} 题</span>` : ''}
                    </div>
                </div>
                <div class="chapter-arrow">›</div>
            `;
            
            chapterList.appendChild(chapterCard);
        });
    },

    renderLevel: function() {
        const chapter = gameData.getChapterById(this.currentChapterId);
        if (!chapter) return;

        const level = chapter.levels[this.currentLevelIndex];
        if (!level) return;

        document.getElementById('current-chapter-name').textContent = chapter.name;
        document.getElementById('current-level').textContent = `第 ${this.currentLevelIndex + 1} 关`;

        document.getElementById('scenario-icon').textContent = level.icon;
        document.getElementById('scenario-text').textContent = level.scenario;

        this.renderLevelDots(chapter.levels.length);
        this.renderOptions(this.currentChapterId, level);
    },

    renderLevelDots: function(totalLevels) {
        const dotsContainer = document.getElementById('level-dots');
        dotsContainer.innerHTML = '';

        for (let i = 0; i < totalLevels; i++) {
            const dot = document.createElement('div');
            dot.className = `level-dot ${i < this.currentLevelIndex ? 'completed' : ''} ${i === this.currentLevelIndex ? 'current' : ''}`;
            dotsContainer.appendChild(dot);
        }
    },

    renderOptions: function(chapterId, level) {
        const optionsContainer = document.getElementById('options-container');
        optionsContainer.innerHTML = '';

        const shuffledOptions = gameData.getShuffledOptions(chapterId, level.id);

        shuffledOptions.forEach(option => {
            const optionBtn = document.createElement('button');
            optionBtn.className = 'option-btn';
            optionBtn.textContent = option.text;
            optionBtn.onclick = () => this.selectOption(option);
            optionsContainer.appendChild(optionBtn);
        });
    },

    selectOption: function(option) {
        const chapter = gameData.getChapterById(this.currentChapterId);
        const level = chapter.levels[this.currentLevelIndex];

        const feedbackIcon = document.getElementById('feedback-icon');
        const feedbackTitle = document.getElementById('feedback-title');
        const feedbackMessage = document.getElementById('feedback-message');
        const tipText = document.getElementById('tip-text');
        const nextBtn = document.getElementById('next-btn');

        if (option.isCorrect) {
            feedbackIcon.textContent = '✅';
            feedbackIcon.className = 'feedback-icon correct';
            feedbackTitle.textContent = '回答正确！';
            feedbackTitle.className = '';
            feedbackMessage.textContent = option.feedback;
            
            this.chapterStats[this.currentChapterId].correct++;
            this.totalCorrect++;
        } else {
            feedbackIcon.textContent = '❌';
            feedbackIcon.className = 'feedback-icon wrong';
            feedbackTitle.textContent = '回答错误';
            feedbackTitle.className = 'wrong-title';
            feedbackMessage.textContent = option.feedback;
            
            this.chapterStats[this.currentChapterId].wrong++;
            this.totalWrong++;
            
            this.addWrongAnswer(chapter, level, option);
        }

        tipText.textContent = level.tip;

        const isLastLevel = this.currentLevelIndex >= chapter.levels.length - 1;
        if (isLastLevel) {
            nextBtn.textContent = '查看结果';
        } else {
            nextBtn.textContent = '下一关';
        }

        this.chapterStats[this.currentChapterId].levelsCompleted++;
        this.showPage('feedback-page');
    },

    addWrongAnswer: function(chapter, level, wrongOption) {
        const wrongKey = `${chapter.id}-${level.id}`;
        const existingIndex = this.wrongAnswers.findIndex(w => w.key === wrongKey);
        
        const correctOption = level.options.find(o => o.isCorrect);
        
        const wrongAnswer = {
            key: wrongKey,
            chapterId: chapter.id,
            chapterName: chapter.name,
            chapterIcon: chapter.icon,
            levelId: level.id,
            scenario: level.scenario,
            scenarioIcon: level.icon,
            correctAnswer: correctOption ? correctOption.text : '',
            correctFeedback: correctOption ? correctOption.feedback : '',
            wrongAnswer: wrongOption.text,
            wrongFeedback: wrongOption.feedback,
            tip: level.tip
        };

        if (existingIndex >= 0) {
            this.wrongAnswers[existingIndex] = wrongAnswer;
        } else {
            this.wrongAnswers.push(wrongAnswer);
        }

        this.updateWrongAnswerButton();
    },

    removeWrongAnswer: function(key) {
        const index = this.wrongAnswers.findIndex(w => w.key === key);
        if (index >= 0) {
            this.wrongAnswers.splice(index, 1);
        }
        this.updateWrongAnswerButton();
    },

    updateWrongAnswerButton: function() {
        const reviewBtn = document.getElementById('review-btn');
        const completeReviewBtn = document.getElementById('complete-review-btn');
        
        if (this.wrongAnswers.length > 0) {
            if (reviewBtn) {
                reviewBtn.style.display = 'block';
                reviewBtn.textContent = `错题复习 (${this.wrongAnswers.length}题)`;
            }
            if (completeReviewBtn) {
                completeReviewBtn.style.display = 'block';
                completeReviewBtn.textContent = `复习错题 (${this.wrongAnswers.length}题)`;
            }
        } else {
            if (reviewBtn) reviewBtn.style.display = 'none';
            if (completeReviewBtn) completeReviewBtn.style.display = 'none';
        }
    },

    nextLevel: function() {
        const chapter = gameData.getChapterById(this.currentChapterId);
        
        if (this.currentLevelIndex >= chapter.levels.length - 1) {
            this.completeChapter();
        } else {
            this.currentLevelIndex++;
            this.renderLevel();
            this.showPage('game-page');
        }
    },

    completeChapter: function() {
        gameData.markChapterCompleted(this.currentChapterId);
        
        const chapter = gameData.getChapterById(this.currentChapterId);
        const stats = this.chapterStats[this.currentChapterId];

        document.getElementById('chapter-complete-text').textContent = 
            `您已成功完成「${chapter.name}」章节的学习！`;
        document.getElementById('correct-count').textContent = stats.correct;
        document.getElementById('wrong-count').textContent = stats.wrong;

        const nextChapterBtn = document.getElementById('next-chapter-btn');
        const nextChapter = gameData.getChapterById(this.currentChapterId + 1);
        
        if (nextChapter) {
            nextChapterBtn.style.display = 'block';
            nextChapterBtn.textContent = '继续学习下一章节';
        } else {
            if (gameData.isAllChaptersCompleted()) {
                nextChapterBtn.style.display = 'block';
                nextChapterBtn.textContent = '查看毕业成绩';
            } else {
                nextChapterBtn.style.display = 'none';
            }
        }

        this.showPage('chapter-complete-page');
    },

    nextChapter: function() {
        if (gameData.isAllChaptersCompleted()) {
            this.showGameComplete();
            return;
        }

        const nextChapterId = this.currentChapterId + 1;
        const nextChapter = gameData.getChapterById(nextChapterId);
        
        if (nextChapter) {
            this.startChapter(nextChapterId);
        } else {
            this.goToChapterSelect();
        }
    },

    showGameComplete: function() {
        const totalLevels = gameData.getTotalLevels();
        const accuracy = totalLevels > 0 ? 
            Math.round((this.totalCorrect / totalLevels) * 100) : 0;

        document.getElementById('total-correct-count').textContent = this.totalCorrect;
        document.getElementById('total-wrong-count').textContent = this.totalWrong;
        document.getElementById('accuracy-rate').textContent = accuracy + '%';

        const badgeText = document.querySelector('.badge-text');
        if (accuracy >= 90) {
            badgeText.textContent = '反诈大师';
        } else if (accuracy >= 70) {
            badgeText.textContent = '反诈卫士';
        } else {
            badgeText.textContent = '反诈学员';
        }

        this.updateWrongAnswerButton();
        this.showPage('game-complete-page');
    },

    goToWrongAnswers: function() {
        this.renderWrongAnswersList();
        this.showPage('wrong-answers-page');
    },

    renderWrongAnswersList: function() {
        const wrongCount = this.wrongAnswers.length;
        const wrongCountBadge = document.getElementById('wrong-count-badge');
        const wrongList = document.getElementById('wrong-list');
        const emptyWrong = document.getElementById('empty-wrong');
        const clearBtn = document.getElementById('clear-wrong-btn');

        wrongCountBadge.textContent = wrongCount;

        if (wrongCount === 0) {
            wrongList.style.display = 'none';
            emptyWrong.style.display = 'block';
            clearBtn.style.display = 'none';
            return;
        }

        wrongList.style.display = 'block';
        emptyWrong.style.display = 'none';
        clearBtn.style.display = 'block';

        wrongList.innerHTML = '';

        this.wrongAnswers.forEach((wrongAnswer, index) => {
            const wrongCard = document.createElement('div');
            wrongCard.className = 'wrong-card';
            wrongCard.onclick = () => this.startWrongReview(index);
            
            wrongCard.innerHTML = `
                <div class="wrong-card-icon">${wrongAnswer.chapterIcon}</div>
                <div class="wrong-card-content">
                    <div class="wrong-card-chapter">${wrongAnswer.chapterName}</div>
                    <div class="wrong-card-scenario">${wrongAnswer.scenario}</div>
                    <div class="wrong-card-meta">
                        <span class="wrong-badge">❌ 错题</span>
                    </div>
                </div>
                <div class="wrong-card-arrow">›</div>
            `;
            
            wrongList.appendChild(wrongCard);
        });
    },

    startWrongReview: function(index) {
        this.currentWrongIndex = index;
        this.renderWrongAnswerDetail();
        this.showPage('wrong-detail-page');
    },

    renderWrongAnswerDetail: function() {
        if (this.wrongAnswers.length === 0) {
            this.goToWrongAnswers();
            return;
        }

        const wrongAnswer = this.wrongAnswers[this.currentWrongIndex];
        
        document.getElementById('wrong-chapter-name').textContent = wrongAnswer.chapterName;
        document.getElementById('wrong-current-index').textContent = `第 ${this.currentWrongIndex + 1} 题`;
        
        document.getElementById('wrong-scenario-icon').textContent = wrongAnswer.scenarioIcon;
        document.getElementById('wrong-scenario-text').textContent = wrongAnswer.scenario;
        
        document.getElementById('correct-answer-text').textContent = wrongAnswer.correctAnswer;
        document.getElementById('your-answer-text').textContent = wrongAnswer.wrongAnswer;
        document.getElementById('wrong-tip-text').textContent = wrongAnswer.tip;

        this.renderWrongDots();

        const nextBtn = document.getElementById('next-wrong-btn');
        if (this.currentWrongIndex >= this.wrongAnswers.length - 1) {
            nextBtn.textContent = '完成复习';
        } else {
            nextBtn.textContent = '下一题';
        }
    },

    renderWrongDots: function() {
        const dotsContainer = document.getElementById('wrong-dots');
        dotsContainer.innerHTML = '';

        for (let i = 0; i < this.wrongAnswers.length; i++) {
            const dot = document.createElement('div');
            dot.className = `level-dot ${i < this.currentWrongIndex ? 'completed' : ''} ${i === this.currentWrongIndex ? 'current' : ''}`;
            dotsContainer.appendChild(dot);
        }
    },

    markAsLearned: function() {
        const wrongAnswer = this.wrongAnswers[this.currentWrongIndex];
        this.removeWrongAnswer(wrongAnswer.key);
        
        if (this.currentWrongIndex >= this.wrongAnswers.length) {
            this.currentWrongIndex = Math.max(0, this.wrongAnswers.length - 1);
        }
        
        if (this.wrongAnswers.length === 0) {
            this.goToWrongAnswers();
        } else {
            this.renderWrongAnswerDetail();
        }
    },

    nextWrongAnswer: function() {
        if (this.currentWrongIndex >= this.wrongAnswers.length - 1) {
            this.goToWrongAnswers();
        } else {
            this.currentWrongIndex++;
            this.renderWrongAnswerDetail();
        }
    },

    clearWrongAnswers: function() {
        if (this.wrongAnswers.length === 0) return;
        
        if (confirm('确定要清空所有错题吗？')) {
            this.wrongAnswers = [];
            this.currentWrongIndex = 0;
            this.updateWrongAnswerButton();
            this.renderWrongAnswersList();
        }
    },

    restartGame: function() {
        gameData.resetGame();
        this.wrongAnswers = [];
        this.currentWrongIndex = 0;
        this.init();
        this.goToStart();
    },

    updateStartPageProgress: function() {
        const completedChapters = gameData.getCompletedChaptersCount();
        const totalChapters = gameData.chapters.length;
        const progressText = document.getElementById('progress-text');
        const progressFill = document.getElementById('total-progress-fill');
        const progressSection = document.getElementById('total-progress');

        if (completedChapters > 0) {
            progressSection.style.display = 'block';
            progressText.textContent = `已完成 ${completedChapters}/${totalChapters} 章节`;
            const progressPercentage = (completedChapters / totalChapters) * 100;
            progressFill.style.width = progressPercentage + '%';
        } else {
            progressSection.style.display = 'none';
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    gameController.init();
});
