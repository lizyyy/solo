import { Book } from './book.js';
import { initLevel, getLevel } from './levels.js';

export class Game {
    constructor() {
        this.currentLevel = 1;
        this.selectedLevel = 1;
        this.score = 0;
        this.timeLeft = 0;
        this.timerInterval = null;
        this.isPaused = false;
        this.isGameOver = false;
        
        this.pendingBooks = [];
        this.sortingSlots = [];
        this.shelvedBooks = [];
        this.processedReservations = [];
        this.processedDamages = [];
        
        this.history = [];
        this.errors = [];
        this.correctCount = 0;
        this.errorCount = 0;
        
        this.currentReplayIndex = 0;
        
        this.callbacks = {};
    }

    on(event, callback) {
        this.callbacks[event] = callback;
    }

    emit(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event](data);
        }
    }

    startLevel(levelId) {
        const levelData = initLevel(levelId);
        this.currentLevel = levelId;
        this.score = 0;
        this.timeLeft = levelData.level.timeLimit;
        this.isPaused = false;
        this.isGameOver = false;
        
        this.pendingBooks = levelData.books;
        this.sortingSlots = new Array(levelData.books.length).fill(null);
        this.shelvedBooks = [];
        this.processedReservations = [];
        this.processedDamages = [];
        
        this.history = [];
        this.errors = [];
        this.correctCount = 0;
        this.errorCount = 0;
        
        this.startTimer();
        this.emit('levelStarted', levelData);
    }

    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            if (!this.isPaused && !this.isGameOver) {
                this.timeLeft--;
                this.emit('timerUpdated', this.timeLeft);
                
                if (this.timeLeft <= 0) {
                    this.endGame(false);
                }
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    pause() {
        this.isPaused = true;
        this.emit('paused');
    }

    resume() {
        this.isPaused = false;
        this.emit('resumed');
    }

    restart() {
        this.startLevel(this.currentLevel);
    }

    addToSortingSlot(bookId, slotIndex) {
        const bookIndex = this.pendingBooks.findIndex(b => b.id === bookId);
        if (bookIndex === -1) return false;
        
        const book = this.pendingBooks[bookIndex];
        
        if (this.sortingSlots[slotIndex] !== null) {
            this.pendingBooks.push(this.sortingSlots[slotIndex]);
        }
        
        this.sortingSlots[slotIndex] = book;
        this.pendingBooks.splice(bookIndex, 1);
        
        this.emit('sortingUpdated', {
            pendingBooks: this.pendingBooks,
            sortingSlots: this.sortingSlots
        });
        
        return true;
    }

    removeFromSortingSlot(slotIndex) {
        if (this.sortingSlots[slotIndex] === null) return null;
        
        const book = this.sortingSlots[slotIndex];
        this.sortingSlots[slotIndex] = null;
        this.pendingBooks.push(book);
        
        this.emit('sortingUpdated', {
            pendingBooks: this.pendingBooks,
            sortingSlots: this.sortingSlots
        });
        
        return book;
    }

    swapSortingSlots(fromIndex, toIndex) {
        const temp = this.sortingSlots[fromIndex];
        this.sortingSlots[fromIndex] = this.sortingSlots[toIndex];
        this.sortingSlots[toIndex] = temp;
        
        this.emit('sortingUpdated', {
            pendingBooks: this.pendingBooks,
            sortingSlots: this.sortingSlots
        });
    }

    confirmSort() {
        const sortedBooks = this.sortingSlots.filter(b => b !== null);
        
        if (sortedBooks.length === 0) {
            return { success: false, message: '请先将图书拖入排序区' };
        }

        const unprocessedSpecialBooks = sortedBooks.filter(b => 
            (b.isReserved && !this.processedReservations.includes(b.id)) ||
            (b.isDamaged && !this.processedDamages.includes(b.id))
        );

        if (unprocessedSpecialBooks.length > 0) {
            const reserved = unprocessedSpecialBooks.filter(b => b.isReserved);
            const damaged = unprocessedSpecialBooks.filter(b => b.isDamaged);
            
            let message = '';
            if (reserved.length > 0) {
                message += `预约图书(${reserved.map(b => b.callNumber).join(', ')})需要先处理；`;
                this.addError('RESERVED_NOT_PROCESSED', reserved, '预约图书未处理就上架');
                this.score -= 100 * reserved.length;
            }
            if (damaged.length > 0) {
                message += `破损图书(${damaged.map(b => b.callNumber).join(', ')})需要先登记；`;
                this.addError('DAMAGED_NOT_PROCESSED', damaged, '破损图书未登记就上架');
                this.score -= 100 * damaged.length;
            }
            
            this.emit('scoreUpdated', this.score);
            return { success: false, message };
        }

        const normalBooks = sortedBooks.filter(b => !b.isReserved && !b.isDamaged);
        const sortErrors = Book.findSortErrors(normalBooks);
        
        if (sortErrors.length > 0) {
            sortErrors.forEach(error => {
                this.addError('SORT_ERROR', [error.book1, error.book2], error.reason);
            });
            this.score -= 50 * sortErrors.length;
            this.errorCount += sortErrors.length;
            
            this.emit('scoreUpdated', this.score);
            this.addHistory(`排序错误: ${sortErrors.length}处`, false);
            
            return { 
                success: false, 
                message: `排序错误: ${sortErrors.map(e => e.reason).join('; ')}`,
                errors: sortErrors
            };
        }

        const points = 100 * normalBooks.length;
        this.score += points;
        this.correctCount += normalBooks.length;
        this.shelvedBooks.push(...normalBooks);
        
        normalBooks.forEach(book => {
            const index = this.sortingSlots.indexOf(book);
            if (index !== -1) {
                this.sortingSlots[index] = null;
            }
        });
        
        this.addHistory(`正确上架 ${normalBooks.length} 本图书，+${points}分`, true);
        this.emit('scoreUpdated', this.score);
        this.emit('booksShelved', normalBooks);

        const remainingNormalBooks = this.pendingBooks.filter(b => !b.isReserved && !b.isDamaged);
        const allReservationsProcessed = this.pendingBooks.filter(b => b.isReserved).length === 0;
        const allDamagesProcessed = this.pendingBooks.filter(b => b.isDamaged).length === 0;

        if (remainingNormalBooks.length === 0 && allReservationsProcessed && allDamagesProcessed) {
            const level = getLevel(this.currentLevel);
            const passed = this.score >= level.targetScore;
            this.endGame(passed);
        }
        
        return { success: true, message: `上架成功！+${points}分`, books: normalBooks };
    }

    processReservation(bookId) {
        const book = this.pendingBooks.find(b => b.id === bookId);
        if (!book || !book.isReserved) {
            return { success: false, message: '该图书没有预约' };
        }

        if (this.processedReservations.includes(bookId)) {
            return { success: false, message: '该预约已处理' };
        }

        this.processedReservations.push(bookId);
        this.score += 50;
        this.correctCount++;
        
        const index = this.pendingBooks.indexOf(book);
        if (index > -1) {
            this.pendingBooks.splice(index, 1);
        }

        this.addHistory(`正确处理预约: ${book.callNumber}，+50分`, true);
        this.emit('scoreUpdated', this.score);
        this.emit('sortingUpdated', {
            pendingBooks: this.pendingBooks,
            sortingSlots: this.sortingSlots
        });

        return { success: true, message: `预约处理成功！+50分` };
    }

    processDamage(bookId) {
        const book = this.pendingBooks.find(b => b.id === bookId);
        if (!book || !book.isDamaged) {
            return { success: false, message: '该图书没有破损' };
        }

        if (this.processedDamages.includes(bookId)) {
            return { success: false, message: '该破损已登记' };
        }

        this.processedDamages.push(bookId);
        this.score += 50;
        this.correctCount++;
        
        const index = this.pendingBooks.indexOf(book);
        if (index > -1) {
            this.pendingBooks.splice(index, 1);
        }

        this.addHistory(`正确登记破损: ${book.callNumber}，+50分`, true);
        this.emit('scoreUpdated', this.score);
        this.emit('sortingUpdated', {
            pendingBooks: this.pendingBooks,
            sortingSlots: this.sortingSlots
        });

        return { success: true, message: `破损登记成功！+50分` };
    }

    addError(type, books, reason) {
        this.errors.push({
            type,
            books: books.map(b => ({ callNumber: b.callNumber, title: b.title })),
            reason,
            timestamp: Date.now()
        });
        this.errorCount++;
    }

    addHistory(message, isSuccess) {
        this.history.unshift({
            message,
            isSuccess,
            timestamp: Date.now()
        });
        
        if (this.history.length > 50) {
            this.history.pop();
        }
        
        this.emit('historyUpdated', this.history);
    }

    endGame(passed) {
        this.isGameOver = true;
        this.stopTimer();
        
        const level = getLevel(this.currentLevel);
        
        this.emit('gameEnded', {
            passed,
            score: this.score,
            targetScore: level.targetScore,
            correctCount: this.correctCount,
            errorCount: this.errorCount,
            errors: this.errors,
            level: level
        });
    }

    generateReport() {
        const level = getLevel(this.currentLevel);
        const passed = this.score >= level.targetScore;
        
        const report = {
            title: '图书馆排架修复游戏 - 排架报告',
            level: level.name,
            levelId: this.currentLevel,
            date: new Date().toLocaleString(),
            score: this.score,
            targetScore: level.targetScore,
            passed,
            statistics: {
                correctCount: this.correctCount,
                errorCount: this.errorCount,
                accuracy: this.correctCount + this.errorCount > 0 
                    ? Math.round(this.correctCount / (this.correctCount + this.errorCount) * 100) 
                    : 0
            },
            errors: this.errors.map(e => ({
                type: e.type,
                books: e.books.map(b => b.callNumber).join(', '),
                reason: e.reason
            })),
            suggestions: this.generateSuggestions()
        };
        
        return report;
    }

    generateSuggestions() {
        const suggestions = [];
        const sortErrors = this.errors.filter(e => e.type === 'SORT_ERROR');
        const reservedErrors = this.errors.filter(e => e.type === 'RESERVED_NOT_PROCESSED');
        const damagedErrors = this.errors.filter(e => e.type === 'DAMAGED_NOT_PROCESSED');

        if (sortErrors.length > 0) {
            suggestions.push('需要加强索书号排序规则的学习，注意字母和数字的组合排序');
        }
        if (reservedErrors.length > 0) {
            suggestions.push('注意识别预约图书标记，预约书需要先处理再上架');
        }
        if (damagedErrors.length > 0) {
            suggestions.push('注意识别破损图书标记，破损书需要先登记再上架');
        }
        if (suggestions.length === 0) {
            suggestions.push('表现优秀！继续保持，挑战更高难度关卡');
        }

        return suggestions;
    }

    exportReport() {
        const report = this.generateReport();
        
        let text = `========================================\n`;
        text += `${report.title}\n`;
        text += `========================================\n\n`;
        text += `关卡: ${report.level} (第${report.levelId}关)\n`;
        text += `日期: ${report.date}\n`;
        text += `得分: ${report.score} / ${report.targetScore}\n`;
        text += `结果: ${report.passed ? '✅ 通过' : '❌ 未通过'}\n\n`;
        text += `----------------------------------------\n`;
        text += `统计信息\n`;
        text += `----------------------------------------\n`;
        text += `正确操作: ${report.statistics.correctCount}\n`;
        text += `错误次数: ${report.statistics.errorCount}\n`;
        text += `正确率: ${report.statistics.accuracy}%\n\n`;

        if (report.errors.length > 0) {
            text += `----------------------------------------\n`;
            text += `错误记录\n`;
            text += `----------------------------------------\n`;
            report.errors.forEach((error, i) => {
                text += `${i + 1}. [${error.type}] ${error.books}\n`;
                text += `   ${error.reason}\n\n`;
            });
        }

        text += `----------------------------------------\n`;
        text += `改进建议\n`;
        text += `----------------------------------------\n`;
        report.suggestions.forEach((s, i) => {
            text += `${i + 1}. ${s}\n`;
        });

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `排架报告_关卡${this.currentLevel}_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    getErrorsForReplay() {
        return this.errors;
    }

    destroy() {
        this.stopTimer();
    }
}
