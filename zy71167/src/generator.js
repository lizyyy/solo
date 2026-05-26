import { BOOK_KINDS, BOOK_TITLES } from './levels.js';

let idCounter = 0;
const nextId = () => ++idCounter;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function generateIsbn(prefix = null) {
  const prefixes = ['978-7-1', '978-7-2', '978-7-5', '978-7-8'];
  const p = prefix || pick(prefixes);
  const rest = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('');
  return `${p}-${rest.slice(0, 2)}-${rest.slice(2, 6)}-${Math.floor(Math.random() * 10)}`;
}

export function generateBooks(level, count) {
  const availableKinds = level.slots.slice();
  const books = [];
  const titlesUsed = new Set();

  for (let i = 0; i < count; i++) {
    const kindKey = pick(availableKinds);
    const kind = BOOK_KINDS[kindKey];
    let title = pick(BOOK_TITLES);
    while (titlesUsed.has(title)) title = pick(BOOK_TITLES);
    titlesUsed.add(title);

    const isbn = kindKey === 'shelf' && level.shelfIsbnPrefixes
      ? generateIsbn(pick(Object.values(level.shelfIsbnPrefixes)))
      : generateIsbn();

    books.push({
      id: `b${nextId()}`,
      kind: kindKey,
      tag: kind.tag,
      color: kind.color,
      title,
      isbn,
      reservedBy: kindKey === 'reserved'
        ? pick(['林女士', '张先生', '王同学', '陈老师', '刘先生'])
        : null,
      damageNote: kindKey === 'damaged'
        ? pick(['封面折痕', '书角磕碰', '内页污损', '书脊脱胶'])
        : null,
      returnSlipId: null,
      x: 0,
      y: 0,
      width: 78,
      height: 108,
      placed: null,
    });
  }

  return books;
}

export function generateReturnSlips(level, count, books) {
  const slips = [];
  const returnBooks = books.filter(b => b.kind === 'return');
  const today = '2026-05-26';

  for (let i = 0; i < count && i < returnBooks.length; i++) {
    const book = returnBooks[i];
    const slipId = `RS${String(260501 + i).padStart(6, '0')}`;
    book.returnSlipId = slipId;
    slips.push({
      id: slipId,
      bookId: book.id,
      isbn: book.isbn,
      title: book.title,
      qty: 1,
      date: today,
      customer: pick(['悦读书店', '新知书馆', '纸间文创', '墨香阁', '文轩阁']),
    });
  }

  return slips;
}

export function generateTurn(level, turnIndex) {
  const [min, max] = level.booksPerTurn;
  const bookCount = randInt(min, max);
  const books = generateBooks(level, bookCount);

  let returnSlips = [];
  if (level.matchReturnSlip && level.returnSlipsPerTurn) {
    const [sMin, sMax] = level.returnSlipsPerTurn;
    const slipCount = Math.min(randInt(sMin, sMax), books.filter(b => b.kind === 'return').length);
    returnSlips = generateReturnSlips(level, slipCount, books);
  }

  return {
    turnIndex,
    books: shuffle(books),
    returnSlips,
    placedBooks: new Map(),
  };
}
