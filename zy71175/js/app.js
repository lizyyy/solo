import { Game } from './game.js';
import { Book } from './book.js';
import { levels, getLevel } from './levels.js';
import { BookshelfScene } from './scene3d.js';

class App {
    constructor() {
        this.game = new Game();
        this.scene3d = null;
        this.draggedBook = null;
        this.draggedFromSlot = null;
        this.currentReplayIndex = 0;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupGameCallbacks();
        this.renderLevelButtons();
        
        setTimeout(() => {
            this.scene3d = new BookshelfScene('bookshelf-3d');
        }, 100);
    }

    setupEventListeners() {
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startGame(this.game.selectedLevel);
        });

        document.getElementById('pause-btn').addEventListener('click', () => {
            this.game.pause();
            this.showScreen('pause-screen');
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            this.game.restart();
        });

        document.getElementById('rules-btn').addEventListener('click', () => {
            this.showScreen('rules-modal', true);
        });

        document.getElementById('resume-btn').addEventListener('click', () => {
            this.game.resume();
            this.hideScreen('pause-screen');
        });

        document.getElementById('pause-restart-btn').addEventListener('click', () => {
            this.hideScreen('pause-screen');
            this.game.restart();
        });

        document.getElementById('quit-btn').addEventListener('click', () => {
            this.hideScreen('pause-screen');
            this.showScreen('start-screen');
            this.game.destroy();
        });

        document.getElementById('close-rules-btn').addEventListener('click', () => {
            this.hideScreen('rules-modal');
        });

        document.getElementById('confirm-sort').addEventListener('click', () => {
            const result = this.game.confirmSort();
            this.showToast(result.message, result.success ? 'success' : 'error');
        });

        document.getElementById('replay-errors-btn').addEventListener('click', () => {
            this.startErrorReplay();
        });

        document.getElementById('export-report-btn').addEventListener('click', () => {
            this.game.exportReport();
        });

        document.getElementById('next-level-btn').addEventListener('click', () => {
            this.nextLevel();
        });

        document.getElementById('result-restart-btn').addEventListener('click', () => {
            this.hideScreen('result-screen');
            this.game.restart();
        });

        document.getElementById('result-quit-btn').addEventListener('click', () => {
            this.hideScreen('result-screen');
            this.showScreen('start-screen');
        });

        document.getElementById('prev-error-btn').addEventListener('click', () => {
            this.showPreviousError();
        });

        document.getElementById('next-error-btn').addEventListener('click', () => {
            this.showNextError();
        });

        document.getElementById('close-replay-btn').addEventListener('click', () => {
            this.hideScreen('replay-screen');
        });
    }

    setupGameCallbacks() {
        this.game.on('levelStarted', (data) => {
            this.onLevelStarted(data);
        });

        this.game.on('timerUpdated', (time) => {
            document.getElementById('timer').textContent = time;
        });

        this.game.on('scoreUpdated', (score) => {
            document.getElementById('score').textContent = score;
        });

        this.game.on('sortingUpdated', (data) => {
            this.renderPendingBooks(data.pendingBooks);
            this.renderSortingSlots(data.sortingSlots);
        });

        this.game.on('booksShelved', (books) => {
            if (this.scene3d) {
                this.scene3d.animateBooksIn(books);
            }
        });

        this.game.on('historyUpdated', (history) => {
            this.renderHistory(history);
        });

        this.game.on('gameEnded', (data) => {
            this.onGameEnded(data);
        });
    }

    renderLevelButtons() {
        const container = document.getElementById('level-buttons');
        container.innerHTML = '';
        
        levels.forEach(level => {
            const btn = document.createElement('button');
            btn.className = 'level-btn' + (level.id === 1 ? ' active' : '');
            btn.textContent = `第${level.id}关`;
            btn.title = level.name + ': ' + level.description;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.game.selectedLevel = level.id;
            });
            container.appendChild(btn);
        });
    }

    startGame(levelId) {
        this.showScreen('game-screen');
        this.game.startLevel(levelId);
    }

    onLevelStarted(data) {
        document.getElementById('current-level').textContent = data.level.id;
        document.getElementById('timer').textContent = data.level.timeLimit;
        document.getElementById('score').textContent = '0';
        
        this.renderPendingBooks(data.books);
        this.renderSortingSlots(new Array(data.books.length).fill(null));
        this.renderReservations(data.reservations);
        this.renderDamages(data.damagedBooks);
        
        document.getElementById('history-list').innerHTML = '';
        
        if (this.scene3d) {
            this.scene3d.updateBooks([]);
        }

        this.showToast(`第${data.level.id}关: ${data.level.name}`, 'info');
    }

    renderPendingBooks(books) {
        const container = document.getElementById('pending-books-list');
        container.innerHTML = '';
        
        books.forEach(book => {
            const element = this.createBookElement(book);
            element.addEventListener('dblclick', () => {
                if (book.isReserved) {
                    const result = this.game.processReservation(book.id);
                    this.showToast(result.message, result.success ? 'success' : 'error');
                } else if (book.isDamaged) {
                    const result = this.game.processDamage(book.id);
                    this.showToast(result.message, result.success ? 'success' : 'error');
                }
            });
            container.appendChild(element);
        });
    }

    createBookElement(book) {
        const div = document.createElement('div');
        div.className = 'book-item';
        div.draggable = true;
        div.dataset.bookId = book.id;
        
        if (book.isReserved) div.classList.add('reserved');
        if (book.isDamaged) div.classList.add('damaged');
        
        div.innerHTML = `
            <div class="book-call-number">${book.callNumber}</div>
            <div class="book-title">${book.title}</div>
            <div class="book-tags">
                ${book.isReserved ? '<span class="book-tag tag-reserved">预约</span>' : ''}
                ${book.isDamaged ? '<span class="book-tag tag-damaged">破损</span>' : ''}
            </div>
        `;
        
        div.addEventListener('dragstart', (e) => this.onDragStart(e, book.id));
        div.addEventListener('dragend', (e) => this.onDragEnd(e));
        
        return div;
    }

    renderSortingSlots(slots) {
        const container = document.getElementById('sorting-slots');
        container.innerHTML = '';
        
        slots.forEach((book, index) => {
            const slot = document.createElement('div');
            slot.className = 'sort-slot';
            slot.dataset.slotIndex = index;
            
            if (book) {
                const bookEl = this.createBookElement(book);
                bookEl.style.width = '100%';
                bookEl.dataset.fromSlot = index;
                slot.appendChild(bookEl);
            }
            
            slot.addEventListener('dragover', (e) => this.onDragOver(e));
            slot.addEventListener('dragleave', (e) => this.onDragLeave(e));
            slot.addEventListener('drop', (e) => this.onDrop(e, index));
            
            container.appendChild(slot);
        });
    }

    renderReservations(reservations) {
        const container = document.getElementById('reservation-list');
        container.innerHTML = '';
        
        if (reservations.length === 0) {
            container.innerHTML = '<p style="color: #999; font-size: 0.9rem;">暂无预约图书</p>';
            return;
        }
        
        reservations.forEach(book => {
            const div = document.createElement('div');
            div.className = 'reservation-item';
            div.innerHTML = `
                <strong>${book.callNumber}</strong>
                <br>${book.title}
            `;
            container.appendChild(div);
        });
    }

    renderDamages(damages) {
        const container = document.getElementById('damage-list');
        container.innerHTML = '';
        
        if (damages.length === 0) {
            container.innerHTML = '<p style="color: #999; font-size: 0.9rem;">暂无破损图书</p>';
            return;
        }
        
        damages.forEach(book => {
            const div = document.createElement('div');
            div.className = 'damage-item';
            div.innerHTML = `
                <strong>${book.callNumber}</strong>
                <br>${book.title}
            `;
            container.appendChild(div);
        });
    }

    renderHistory(history) {
        const container = document.getElementById('history-list');
        container.innerHTML = '';
        
        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item ' + (item.isSuccess ? 'success' : 'error');
            div.textContent = item.message;
            container.appendChild(div);
        });
    }

    onDragStart(e, bookId) {
        this.draggedBook = bookId;
        this.draggedFromSlot = e.target.dataset.fromSlot ? parseInt(e.target.dataset.fromSlot) : null;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    onDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedBook = null;
        this.draggedFromSlot = null;
        
        document.querySelectorAll('.sort-slot').forEach(slot => {
            slot.classList.remove('drag-over');
        });
    }

    onDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }

    onDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    onDrop(e, slotIndex) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        if (!this.draggedBook) return;
        
        if (this.draggedFromSlot !== null) {
            this.game.swapSortingSlots(this.draggedFromSlot, slotIndex);
        } else {
            this.game.addToSortingSlot(this.draggedBook, slotIndex);
        }
    }

    onGameEnded(data) {
        document.getElementById('result-title').textContent = 
            data.passed ? '🎉 关卡完成！' : '😢 挑战失败';
        document.getElementById('final-score').textContent = data.score;
        document.getElementById('correct-count').textContent = data.correctCount;
        document.getElementById('error-count').textContent = data.errorCount;
        
        const nextBtn = document.getElementById('next-level-btn');
        if (data.passed && this.game.currentLevel < levels.length) {
            nextBtn.style.display = 'inline-block';
        } else {
            nextBtn.style.display = 'none';
        }
        
        const failureList = document.getElementById('failure-reasons-list');
        if (data.errors.length === 0) {
            failureList.innerHTML = '<p style="color: #28a745;">太棒了！没有任何错误！</p>';
        } else {
            failureList.innerHTML = data.errors.map((error, i) => `
                <div class="failure-item">
                    <strong>${i + 1}.</strong> ${error.reason}
                    <br><small>图书: ${error.books.map(b => b.callNumber).join(', ')}</small>
                </div>
            `).join('');
        }
        
        const replayBtn = document.getElementById('replay-errors-btn');
        replayBtn.style.display = data.errors.length > 0 ? 'inline-block' : 'none';
        
        this.showScreen('result-screen', true);
    }

    startErrorReplay() {
        const errors = this.game.getErrorsForReplay();
        if (errors.length === 0) return;
        
        this.currentReplayIndex = 0;
        this.updateReplayContent();
        this.showScreen('replay-screen', true);
    }

    showPreviousError() {
        const errors = this.game.getErrorsForReplay();
        if (this.currentReplayIndex > 0) {
            this.currentReplayIndex--;
            this.updateReplayContent();
        }
    }

    showNextError() {
        const errors = this.game.getErrorsForReplay();
        if (this.currentReplayIndex < errors.length - 1) {
            this.currentReplayIndex++;
            this.updateReplayContent();
        }
    }

    updateReplayContent() {
        const errors = this.game.getErrorsForReplay();
        const error = errors[this.currentReplayIndex];
        
        document.getElementById('replay-progress').textContent = 
            `${this.currentReplayIndex + 1}/${errors.length}`;
        
        let content = `<h3>错误类型: ${this.getErrorTypeName(error.type)}</h3>`;
        
        if (error.type === 'SORT_ERROR' && error.books.length >= 2) {
            content += `
                <div class="replay-book-comparison">
                    <div class="replay-book incorrect">
                        <div class="book-call-number">${error.books[0].callNumber}</div>
                        <div class="book-title">${error.books[0].title}</div>
                        <div style="color: #dc3545; margin-top: 5px;">↕ 位置错误</div>
                    </div>
                    <div class="replay-book incorrect">
                        <div class="book-call-number">${error.books[1].callNumber}</div>
                        <div class="book-title">${error.books[1].title}</div>
                    </div>
                </div>
            `;
            
            const sorted = Book.sortBooks(error.books);
            content += `
                <div style="text-align: center; margin: 10px 0;">↓ 正确顺序</div>
                <div class="replay-book-comparison">
                    <div class="replay-book correct">
                        <div class="book-call-number">${sorted[0].callNumber}</div>
                        <div class="book-title">${sorted[0].title}</div>
                    </div>
                    <div class="replay-book correct">
                        <div class="book-call-number">${sorted[1].callNumber}</div>
                        <div class="book-title">${sorted[1].title}</div>
                    </div>
                </div>
            `;
        } else {
            content += error.books.map(book => `
                <div class="replay-book incorrect">
                    <div class="book-call-number">${book.callNumber}</div>
                    <div class="book-title">${book.title}</div>
                </div>
            `).join('');
        }
        
        content += `
            <div class="replay-explanation">
                <strong>💡 说明:</strong> ${error.reason}
            </div>
        `;
        
        document.getElementById('replay-content').innerHTML = content;
    }

    getErrorTypeName(type) {
        const names = {
            'SORT_ERROR': '排序错误',
            'RESERVED_NOT_PROCESSED': '预约图书未处理',
            'DAMAGED_NOT_PROCESSED': '破损图书未登记'
        };
        return names[type] || type;
    }

    nextLevel() {
        const nextLevelId = this.game.currentLevel + 1;
        if (nextLevelId <= levels.length) {
            this.hideScreen('result-screen');
            this.game.startLevel(nextLevelId);
        }
    }

    showScreen(screenId, isOverlay = false) {
        if (!isOverlay) {
            document.querySelectorAll('.screen:not(.overlay)').forEach(s => {
                s.classList.remove('active');
            });
        }
        document.getElementById(screenId).classList.add('active');
    }

    hideScreen(screenId) {
        document.getElementById(screenId).classList.remove('active');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            padding: 15px 30px;
            border-radius: 10px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideDown 0.3s ease;
            ${type === 'success' ? 'background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);' : ''}
            ${type === 'error' ? 'background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);' : ''}
            ${type === 'info' ? 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);' : ''}
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes slideUp {
        from { transform: translateX(-50%) translateY(0); opacity: 1; }
        to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
