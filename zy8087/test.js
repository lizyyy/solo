const fs = require('fs');

console.log('🧪 开始图书馆游戏核心逻辑测试\n');

const testData = JSON.parse(fs.readFileSync('./level.json', 'utf8'));

class MockLibraryGame {
  constructor() {
    this.scannedBookIds = new Set();
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
}

const game = new MockLibraryGame();

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

test('normalizeCallNumber - 处理小写', () => {
  if (game.normalizeCallNumber('tp312/ja1') !== 'TP312/JA1') {
    throw new Error('未正确转换为大写');
  }
});

test('normalizeCallNumber - 处理空格', () => {
  if (game.normalizeCallNumber('  TP3/CS1  ') !== 'TP3/CS1') {
    throw new Error('未正确修剪空格');
  }
});

test('isCallNumberInRange - 范围内', () => {
  const range = { start: 'TP3', end: 'TP309' };
  if (!game.isCallNumberInRange('TP3/CS1', range)) {
    throw new Error('应在范围内');
  }
});

test('isCallNumberInRange - 范围外', () => {
  const range = { start: 'TP3', end: 'TP309' };
  if (game.isCallNumberInRange('TP312/JA1', range)) {
    throw new Error('应不在范围内');
  }
});

test('isCallNumberInRange - 大小写混合', () => {
  const range = { start: 'tp3', end: 'tp309' };
  if (!game.isCallNumberInRange('TP3/CS1', range)) {
    throw new Error('应支持大小写不敏感比较');
  }
});

test('validatePlacement - 正确放置（非预约）', () => {
  const book = { callNumber: 'TP3/CS1', isReserved: false };
  const shelf = { callNumberRange: { start: 'TP3', end: 'TP309' }, isReserveShelf: false };
  const errors = game.validatePlacement(book, shelf);
  if (errors.length !== 0) {
    throw new Error('不应有错误');
  }
});

test('validatePlacement - 正确放置（预约）', () => {
  const book = { callNumber: 'TP312/JA1', isReserved: true };
  const shelf = { callNumberRange: { start: 'TP310', end: 'TP319' }, isReserveShelf: true };
  const errors = game.validatePlacement(book, shelf);
  if (errors.length !== 0) {
    throw new Error('不应有错误');
  }
});

test('validatePlacement - 分类号错误', () => {
  const book = { callNumber: 'TP4/XX1', isReserved: false };
  const shelf = { callNumberRange: { start: 'TP3', end: 'TP309' }, isReserveShelf: false };
  const errors = game.validatePlacement(book, shelf);
  if (errors.length !== 1 || errors[0].reason !== '分类号不在该书架范围内') {
    throw new Error('应检测到分类号错误');
  }
});

test('validatePlacement - 预约图书未放保留架', () => {
  const book = { callNumber: 'TP3/CS1', isReserved: true };
  const shelf = { callNumberRange: { start: 'TP3', end: 'TP309' }, isReserveShelf: false };
  const errors = game.validatePlacement(book, shelf);
  if (!errors.some(e => e.reason === '预约图书应放在保留架')) {
    throw new Error('应检测到保留架错误');
  }
});

test('validatePlacement - 非预约图书放保留架', () => {
  const book = { callNumber: 'TP312/JA1', isReserved: false };
  const shelf = { callNumberRange: { start: 'TP310', end: 'TP319' }, isReserveShelf: true };
  const errors = game.validatePlacement(book, shelf);
  if (!errors.some(e => e.reason === '非预约图书不应放在保留架')) {
    throw new Error('应检测到保留架错误');
  }
});

test('示例关卡数据完整性', () => {
  if (!testData.levelId || !testData.levelName || !testData.books || !testData.shelves) {
    throw new Error('关卡数据缺少必填字段');
  }
  if (testData.books.length === 0) {
    throw new Error('关卡应至少有一本书');
  }
  if (testData.shelves.length === 0) {
    throw new Error('关卡应至少有一个书架');
  }
});

console.log(`\n📊 测试结果：${passed} 通过，${failed} 失败`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 所有测试通过！');
}
