import { Renderer } from './renderer.js';
import { generateTurn } from './generator.js';
import { BOOK_KINDS } from './levels.js';

const CANVAS_W = 980;
const CANVAS_H = 640;

function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.width &&
         py >= rect.y && py <= rect.y + rect.height;
}

export function createGame(canvas, level, options = {}) {
  const ctx = canvas.getContext('2d');
  const onLog = options.onLog || (() => {});
  const onMistake = options.onMistake || (() => {});
  const onScore = options.onScore || (() => {});
  const onTurnEnd = options.onTurnEnd || (() => {});
  const onGameOver = options.onGameOver || (() => {});

  let paused = false;
  let running = false;
  let currentTurnIndex = 0;
  let turn = null;
  let score = 0;
  let mistakes = 0;
  let mistakesThisTurn = [];
  let turnHistory = [];
  let dragState = null;
  let hoverZone = null;
  let hoverShelf = null;
  let hoverSlip = null;
  let bookPos0 = { x: 40, y: 40, gapX: 18, gapY: 22, cols: 7 };
  let rafId = null;

  const dropzones = buildDropzones(level);
  const shelves = buildShelves(level);

  function start() {
    running = true;
    paused = false;
    currentTurnIndex = 0;
    score = 0;
    mistakes = 0;
    turnHistory = [];
    mistakesThisTurn = [];
    startTurn();
    loop();
    onScore(score);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  function pause() {
    paused = !paused;
    return paused;
  }

  function restart() {
    stop();
    start();
  }

  function startTurn() {
    turn = generateTurn(level, currentTurnIndex);
    layoutBooks(turn.books);
    mistakesThisTurn = [];
    onLog('info', `—— 第 ${currentTurnIndex + 1} 回合开始 ——`);
  }

  function layoutBooks(books) {
    const { x, y, gapX, gapY, cols } = bookPos0;
    books.forEach((b, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      b.x = x + col * (b.width + gapX);
      b.y = y + row * (b.height + gapY);
      b.placed = null;
    });
  }

  function submitTurn() {
    if (!running || paused) return;

    const results = evaluateTurn();
    const deltaScore = results.correct * level.scorePerBook;
    const perfect = results.correct === turn.books.length && results.wrong === 0;
    const bonus = perfect ? 20 : 0;

    score += deltaScore + bonus;
    mistakes += results.wrong;

    turnHistory.push({
      turnIndex: currentTurnIndex,
      results,
      mistakes: mistakesThisTurn.slice(),
    });

    onScore(score);
    onLog('info', `回合结算：对 ${results.correct} / 错 ${results.wrong}${bonus ? ` · 全对 +${bonus}` : ''}`);

    if (mistakes >= level.maxMistakes) {
      onGameOver({ reason: 'mistakes', score, mistakes, turnHistory });
      stop();
      return;
    }

    if (currentTurnIndex + 1 >= level.turns) {
      onGameOver({ reason: 'complete', score, mistakes, turnHistory });
      stop();
      return;
    }

    currentTurnIndex++;
    startTurn();
    onTurnEnd(currentTurnIndex, score);
  }

  function evaluateTurn() {
    let correct = 0, wrong = 0;
    for (const book of turn.books) {
      const r = judgePlacement(book);
      if (r.ok) correct++;
      else {
        wrong++;
        mistakesThisTurn.push({
          bookId: book.id,
          bookTitle: book.title,
          bookKind: book.kind,
          placed: book.placed,
          reason: r.reason,
        });
        onLog('bad', `❌ ${book.title} · ${r.reason}`);
        onMistake(mistakes + wrong);
      }
    }
    return { correct, wrong };
  }

  function judgePlacement(book) {
    const placed = book.placed;
    const kind = book.kind;

    if (!placed) return { ok: false, reason: '未放置任何区域' };

    if (placed.type === 'dropzone') {
      if (placed.kind === kind) return { ok: true };
      const expected = BOOK_KINDS[kind]?.tag || kind;
      const got = BOOK_KINDS[placed.kind]?.tag || placed.kind;
      return { ok: false, reason: `应放到「${expected}」区，实际放到「${got}」区` };
    }

    if (placed.type === 'shelf') {
      if (kind !== 'shelf') {
        return { ok: false, reason: `此书不是可售回架类型，不应放到货架 ${placed.label}` };
      }
      const prefix = level.shelfIsbnPrefixes[placed.label];
      if (book.isbn.startsWith(prefix)) return { ok: true };
      return { ok: false, reason: `ISBN 前缀不匹配：应匹配 ${prefix}，实际是 ${book.isbn.slice(0, 8)}` };
    }

    if (placed.type === 'returnSlip') {
      if (!level.matchReturnSlip) {
        return { ok: false, reason: '本关不需要匹配退货单' };
      }
      if (kind !== 'return') {
        return { ok: false, reason: '只有退货书需要匹配退货单' };
      }
      if (book.returnSlipId === placed.id) return { ok: true };
      return { ok: false, reason: `退货单不匹配：应是 ${book.returnSlipId || '（无单号）'}，实际是 ${placed.id}` };
    }

    return { ok: false, reason: '未知放置类型' };
  }

  function onPointerDown(e) {
    if (!running || paused) return;
    const { x, y } = getCanvasPos(e);
    for (let i = turn.books.length - 1; i >= 0; i--) {
      const b = turn.books[i];
      if (pointInRect(x, y, b)) {
        dragState = {
          book: b,
          offsetX: x - b.x,
          offsetY: y - b.y,
          originX: b.x,
          originY: b.y,
          originPlaced: b.placed,
        };
        b.placed = null;
        turn.books.splice(i, 1);
        turn.books.push(b);
        return;
      }
    }
  }

  function onPointerMove(e) {
    if (!dragState) return;
    const { x, y } = getCanvasPos(e);
    dragState.book.x = x - dragState.offsetX;
    dragState.book.y = y - dragState.offsetY;
    hoverZone = dropzones.find(z => pointInRect(x, y, z)) || null;
    hoverShelf = shelves.find(s => pointInRect(x, y, s)) || null;
    hoverSlip = turn.returnSlips.find(s => pointInRect(x, y, s)) || null;
  }

  function onPointerUp(e) {
    if (!dragState) return;
    const { book, originX, originY, originPlaced } = dragState;
    const { x, y } = getCanvasPos(e);
    dragState = null;

    const hitZone = dropzones.find(z => pointInRect(x, y, z));
    const hitShelf = shelves.find(s => pointInRect(x, y, s));
    const hitSlip = turn.returnSlips.find(s => pointInRect(x, y, s));

    if (hitZone) {
      if (hitZone.kind === 'return' && level.matchReturnSlip && book.kind === 'return') {
        book.x = originX; book.y = originY; book.placed = originPlaced;
        onLog('info', '💡 本关退货书需要放到「对应退货单」，不是退货区');
      } else {
        book.placed = { type: 'dropzone', kind: hitZone.kind, label: hitZone.label };
        snapToZone(book, hitZone);
        onLog('info', `放到「${hitZone.label}」：${book.title}`);
      }
    } else if (hitShelf && level.shelves.length) {
      book.placed = { type: 'shelf', label: hitShelf.label };
      snapToShelf(book, hitShelf);
      onLog('info', `放到货架 ${hitShelf.label}：${book.title}`);
    } else if (hitSlip && level.matchReturnSlip) {
      book.placed = { type: 'returnSlip', id: hitSlip.id };
      snapToSlip(book, hitSlip);
      onLog('info', `匹配退货单 ${hitSlip.id}：${book.title}`);
    } else {
      book.x = originX;
      book.y = originY;
      book.placed = originPlaced;
    }

    hoverZone = hoverShelf = hoverSlip = null;
  }

  function snapToZone(book, zone) {
    const placed = turn.books.filter(b => b.placed?.type === 'dropzone' && b.placed?.kind === zone.kind && b !== book);
    const cols = Math.floor((zone.width - 20) / (book.width + 8));
    const idx = placed.length;
    book.x = zone.x + 14 + (idx % cols) * (book.width + 8);
    book.y = zone.y + 50 + Math.floor(idx / cols) * (book.height + 8);
  }

  function snapToShelf(book, shelf) {
    const placed = turn.books.filter(b => b.placed?.type === 'shelf' && b.placed?.label === shelf.label && b !== book);
    book.x = shelf.x + 10 + placed.length * 26;
    book.y = shelf.y + 56;
  }

  function snapToSlip(book, slip) {
    book.x = slip.x + slip.width + 8;
    book.y = slip.y + (slip.height - book.height) / 2;
  }

  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function loop() {
    if (!running) return;
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    for (const zone of dropzones) {
      const hasMatch = turn?.books.some(b => b.placed?.type === 'dropzone' && b.placed.kind === zone.kind);
      Renderer.drawDropzone(ctx, zone, hasMatch, hoverZone === zone);
    }

    for (const shelf of shelves) {
      const hasMatch = turn?.books.some(b => b.placed?.type === 'shelf' && b.placed.label === shelf.label);
      Renderer.drawShelf(ctx, shelf, hasMatch, hoverShelf === shelf);
    }

    for (const slip of (turn?.returnSlips || [])) {
      const matched = turn?.books.some(b => b.placed?.type === 'returnSlip' && b.placed.id === slip.id);
      Renderer.drawReturnSlip(ctx, slip, hoverSlip === slip, matched);
    }

    if (!turn) return;
    for (const book of turn.books) {
      if (book === dragState?.book) continue;
      Renderer.drawBook(ctx, book);
    }

    if (dragState?.book) {
      Renderer.drawBook(ctx, dragState.book, 1, 0.95, true);
    }
  }

  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  canvas.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('mouseleave', onPointerUp);

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    onPointerDown(e.touches[0]);
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    onPointerMove(e.touches[0]);
  }, { passive: false });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    onPointerUp(e.changedTouches[0]);
  }, { passive: false });

  return {
    start,
    stop,
    pause,
    restart,
    submitTurn,
    getState: () => ({
      level,
      currentTurnIndex,
      score,
      mistakes,
      turnHistory,
      running,
      paused,
    }),
    getTurn: () => turn,
  };
}

function buildDropzones(level) {
  const zones = [];
  const baseY = 40;
  const width = 180;
  const height = 150;
  const gap = 12;
  let x = CANVAS_W - width - 30;

  if (level.slots.includes('return')) {
    zones.push({
      kind: 'return',
      label: level.matchReturnSlip ? '退货区' : '退货区',
      subLabel: level.matchReturnSlip ? '本关请用退货单匹配' : '书脊标签 = 退',
      color: '#f4c86a',
      x, y: baseY, width, height,
    });
  }
  if (level.slots.includes('damaged')) {
    zones.push({
      kind: 'damaged',
      label: '破损登记',
      subLabel: '书脊标签 = 损',
      color: '#ff7b7b',
      x, y: baseY + height + gap, width, height,
    });
  }
  if (level.slots.includes('reserved')) {
    zones.push({
      kind: 'reserved',
      label: '预订留位',
      subLabel: '书脊标签 = 订',
      color: '#8fd2ff',
      x, y: baseY + (height + gap) * 2, width, height,
    });
  }

  return zones;
}

function buildShelves(level) {
  if (!level.shelves?.length) return [];
  const shelfW = 200;
  const shelfH = 180;
  const gap = 10;
  const y = CANVAS_H - shelfH - 30;
  const totalW = level.shelves.length * shelfW + (level.shelves.length - 1) * gap;
  let x = (CANVAS_W - totalW) / 2 - 60;

  return level.shelves.map((label, i) => ({
    type: 'shelf',
    label,
    isbnPrefix: level.shelfIsbnPrefixes[label],
    x: x + i * (shelfW + gap),
    y,
    width: shelfW,
    height: shelfH,
  }));
}
