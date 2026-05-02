const GameState = {
  IDLE: 'idle',
  PLAYING: 'playing',
  FINISHED: 'finished'
};

class LibraryGame {
  constructor() {
    this.state = GameState.IDLE;
    this.levelData = null;
    this.currentSteps = 0;
    this.score = 0;
    this.history = [];
    this.booksInCart = new Set();
    this.placedBooks = new Map();
    this.scannedBookIds = new Set();
    
    this.initElements();
    this.initEventListeners();
    this.loadLocalSave();
  }

  initElements() {
    this.cartEl = document.getElementById('cart');
    this.shelvesEl = document.getElementById('shelves');
    this.levelNameEl = document.getElementById('levelName');
    this.currentStepsEl = document.getElementById('currentSteps');
    this.maxStepsEl = document.getElementById('maxSteps');
    this.scoreEl = document.getElementById('score');
    this.currentFloorEl = document.getElementById('currentFloor');
    this.undoBtn = document.getElementById('undoBtn');
    this.messageEl = document.getElementById('message');
    this.fileInput = document.getElementById('fileInput');
  }

  initEventListeners() {
    document.getElementById('loadLevelBtn').addEventListener('click', () => {
      this.fileInput.click();
    });
    
    this.fileInput.addEventListener('change', (e) => {
      this.loadLevelFromFile(e.target.files[0]);
    });
    
    document.getElementById('undoBtn').addEventListener('click', () => {
      this.undo();
    });
    
    document.getElementById('saveBtn').addEventListener('click', () => {
      this.saveLocal();
    });
    
    document.getElementById('finishBtn').addEventListener('click', () => {
      this.finish();
    });
  }

  async loadLevelFromFile(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      this.loadLevel(data);
      this.showMessage('关卡加载成功！', 'success');
    } catch (error) {
      this.showMessage('关卡加载失败：' + error.message, 'error');
    }
  }

  loadLevel(data) {
    this.levelData = JSON.parse(JSON.stringify(data));
    this.state = GameState.PLAYING;
    this.currentSteps = 0;
    this.score = 100;
    this.history = [];
    this.booksInCart = new Set(data.books.map(b => b.id));
    this.placedBooks = new Map();
    this.scannedBookIds = new Set();
    
    data.shelves.forEach(shelf => {
      shelf.slots.forEach(slot => {
        if (slot.bookId) {
          this.placedBooks.set(slot.id, slot.bookId);
        }
      });
    });
    
    this.updateUI();
    this.undoBtn.disabled = true;
  }

  normalizeCallNumber(cn) {
    return cn.toUpperCase().trim();
  }

  compareCallNumbers(a, b) {
    const normA = this.normalizeCallNumber(a);
    const normB = this.normalizeCallNumber(b);
    return normA.localeCompare(normB);
  }

  isCallNumberInRange(cn, range) {
    const normCN = this.normalizeCallNumber(cn);
    const normStart = this.normalizeCallNumber(range.start);
    const normEnd = this.normalizeCallNumber(range.end);
    
    return this.compareCallNumbers(normCN, normStart) >= 0 && 
           this.compareCallNumbers(normCN, normEnd) <= 0;
  }

  validatePlacement(book, shelf) {
    const errors = [];
    
    if (!this.isCallNumberInRange(book.callNumber, shelf.callNumberRange)) {
      errors.push({ reason: '分类号不在该书架范围内', penalty: 20 });
    }
    
    if (book.isReserved && !shelf.isReserveShelf) {
      errors.push({ reason: '预约图书应放在保留架', penalty: 15 });
    }
    
    if (!book.isReserved && shelf.isReserveShelf) {
      errors.push({ reason: '非预约图书不应放在保留架', penalty: 10 });
    }
    
    return errors;
  }

  placeBook(bookId, slotId) {
    if (this.state !== GameState.PLAYING) return;
    if (this.currentSteps >= this.levelData.maxSteps) {
      this.showMessage('步数已用完！', 'error');
      return;
    }

    const book = this.levelData.books.find(b => b.id === bookId);
    const shelf = this.levelData.shelves.find(s => s.slots.some(slot => slot.id === slotId));
    const slot = shelf.slots.find(s => s.id === slotId);
    
    if (!book || !shelf || !slot) return;
    
    if (slot.bookId) {
      this.showMessage('该位置已有图书', 'error');
      return;
    }

    if (this.scannedBookIds.has(bookId)) {
      this.showMessage('该书已归架（重复扫码）', 'error');
      return;
    }

    const previousLocation = this.booksInCart.has(bookId) ? 'cart' : 
                             Array.from(this.placedBooks.entries()).find(([k, v]) => v === bookId)?.[0];

    this.history.push({
      type: 'place',
      bookId,
      from: previousLocation,
      to: slotId,
      scoreBefore: this.score
    });

    if (previousLocation === 'cart') {
      this.booksInCart.delete(bookId);
    } else if (previousLocation) {
      this.placedBooks.delete(previousLocation);
      const prevSlot = this.findSlotById(previousLocation);
      if (prevSlot) prevSlot.bookId = null;
    }

    slot.bookId = bookId;
    this.placedBooks.set(slotId, bookId);
    this.scannedBookIds.add(bookId);
    this.currentSteps++;

    const errors = this.validatePlacement(book, shelf);
    if (errors.length > 0) {
      const totalPenalty = errors.reduce((sum, e) => sum + e.penalty, 0);
      this.score = Math.max(0, this.score - totalPenalty);
      const reasons = errors.map(e => e.reason).join('；');
      this.showMessage(`❌ 错放：${reasons}（扣${totalPenalty}分）`, 'error');
    } else {
      this.showMessage('✅ 放置正确！', 'success');
    }

    this.updateUI();
    this.undoBtn.disabled = this.history.length === 0;
  }

  findSlotById(slotId) {
    for (const shelf of this.levelData.shelves) {
      const slot = shelf.slots.find(s => s.id === slotId);
      if (slot) return slot;
    }
    return null;
  }

  undo() {
    if (this.history.length === 0 || this.state !== GameState.PLAYING) return;

    const lastAction = this.history.pop();
    this.score = lastAction.scoreBefore;
    this.currentSteps--;

    const slot = this.findSlotById(lastAction.to);
    if (slot) {
      slot.bookId = null;
      this.placedBooks.delete(lastAction.to);
    }

    if (lastAction.from === 'cart') {
      this.booksInCart.add(lastAction.bookId);
      this.scannedBookIds.delete(lastAction.bookId);
    } else if (lastAction.from) {
      const prevSlot = this.findSlotById(lastAction.from);
      if (prevSlot) {
        prevSlot.bookId = lastAction.bookId;
        this.placedBooks.set(lastAction.from, lastAction.bookId);
      }
    }

    this.updateUI();
    this.undoBtn.disabled = this.history.length === 0;
    this.showMessage('已撤销', 'info');
  }

  saveLocal() {
    const saveData = {
      levelData: this.levelData,
      state: this.state,
      currentSteps: this.currentSteps,
      score: this.score,
      history: this.history,
      booksInCart: Array.from(this.booksInCart),
      placedBooks: Array.from(this.placedBooks.entries()),
      scannedBookIds: Array.from(this.scannedBookIds),
      timestamp: Date.now()
    };
    localStorage.setItem('libraryGameSave', JSON.stringify(saveData));
    this.showMessage('游戏已保存', 'success');
  }

  loadLocalSave() {
    const saveStr = localStorage.getItem('libraryGameSave');
    if (saveStr) {
      try {
        const saveData = JSON.parse(saveStr);
        if (saveData.levelData) {
          this.levelData = saveData.levelData;
          this.state = saveData.state;
          this.currentSteps = saveData.currentSteps;
          this.score = saveData.score;
          this.history = saveData.history;
          this.booksInCart = new Set(saveData.booksInCart);
          this.placedBooks = new Map(saveData.placedBooks);
          this.scannedBookIds = new Set(saveData.scannedBookIds);
          this.updateUI();
          this.undoBtn.disabled = this.history.length === 0;
        }
      } catch (e) {
        console.error('Load save failed', e);
      }
    }
  }

  finish() {
    if (this.state !== GameState.PLAYING) return;
    
    this.state = GameState.FINISHED;
    
    const report = {
      levelId: this.levelData.levelId,
      levelName: this.levelData.levelName,
      finalScore: this.score,
      stepsUsed: this.currentSteps,
      maxSteps: this.levelData.maxSteps,
      placedBooks: Array.from(this.placedBooks.entries()).map(([slotId, bookId]) => ({
        slotId,
        bookId,
        book: this.levelData.books.find(b => b.id === bookId)
      })),
      unplacedBooks: this.levelData.books.filter(b => this.booksInCart.has(b.id)),
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report.json';
    a.click();
    URL.revokeObjectURL(url);
    
    this.showMessage(`游戏结束！最终得分：${this.score}分`, 'success');
  }

  showMessage(text, type = 'info') {
    this.messageEl.textContent = text;
    this.messageEl.className = `message ${type}`;
    setTimeout(() => {
      this.messageEl.classList.add('hidden');
    }, 3000);
  }

  createBookElement(book) {
    const el = document.createElement('div');
    el.className = `book ${book.isReserved ? 'reserved' : ''}`;
    el.draggable = true;
    el.dataset.bookId = book.id;
    
    el.innerHTML = `
      <div class="book-title">${book.title}</div>
      <div class="book-callnumber">${book.callNumber}</div>
      ${book.isReserved ? `<span class="book-badge">预约 ${book.reservePriority}级</span>` : ''}
    `;
    
    el.addEventListener('dragstart', (e) => {
      el.classList.add('dragging');
      e.dataTransfer.setData('text/plain', book.id);
    });
    
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
    });
    
    return el;
  }

  createSlotElement(slot, shelf) {
    const el = document.createElement('div');
    el.className = 'slot';
    el.dataset.slotId = slot.id;
    
    if (slot.bookId) {
      el.classList.add('has-book');
      const book = this.levelData.books.find(b => b.id === slot.bookId);
      if (book) {
        el.appendChild(this.createBookElement(book));
      }
    }
    
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('drag-over');
    });
    
    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-over');
    });
    
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const bookId = e.dataTransfer.getData('text/plain');
      this.placeBook(bookId, slot.id);
    });
    
    return el;
  }

  updateUI() {
    if (!this.levelData) return;
    
    this.levelNameEl.textContent = this.levelData.levelName;
    this.currentStepsEl.textContent = this.currentSteps;
    this.maxStepsEl.textContent = this.levelData.maxSteps;
    this.scoreEl.textContent = this.score;
    this.currentFloorEl.textContent = this.levelData.floor;
    
    this.cartEl.innerHTML = '';
    this.levelData.books
      .filter(book => this.booksInCart.has(book.id))
      .forEach(book => {
        this.cartEl.appendChild(this.createBookElement(book));
      });
    
    this.shelvesEl.innerHTML = '';
    this.levelData.shelves.forEach(shelf => {
      const shelfEl = document.createElement('div');
      shelfEl.className = 'shelf';
      
      shelfEl.innerHTML = `
        <div class="shelf-header">
          <div>
            <span class="shelf-label">${shelf.label}</span>
            <span class="shelf-range">${shelf.callNumberRange.start} - ${shelf.callNumberRange.end}</span>
          </div>
          ${shelf.isReserveShelf ? '<span class="shelf-badge">保留架</span>' : ''}
        </div>
      `;
      
      const slotsEl = document.createElement('div');
      slotsEl.className = 'slots';
      shelf.slots.forEach(slot => {
        slotsEl.appendChild(this.createSlotElement(slot, shelf));
      });
      shelfEl.appendChild(slotsEl);
      
      this.shelvesEl.appendChild(shelfEl);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.game = new LibraryGame();
  
  fetch('level.json')
    .then(res => res.json())
    .then(data => {
      window.game.loadLevel(data);
    })
    .catch(err => {
      console.log('No default level loaded:', err);
    });
});
