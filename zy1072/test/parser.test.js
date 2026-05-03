import { test } from 'node:test';
import assert from 'node:assert';
import { GuestParser, TableParser } from '../src/parser/index.js';
import { parseBoolean, parseArray, normalizeName } from '../src/utils.js';

test('utils - parseBoolean', () => {
  assert.strictEqual(parseBoolean('是'), true);
  assert.strictEqual(parseBoolean('yes'), true);
  assert.strictEqual(parseBoolean('YES'), true);
  assert.strictEqual(parseBoolean('1'), true);
  assert.strictEqual(parseBoolean('true'), true);
  assert.strictEqual(parseBoolean('否'), false);
  assert.strictEqual(parseBoolean('no'), false);
  assert.strictEqual(parseBoolean(''), false);
  assert.strictEqual(parseBoolean(null), false);
  assert.strictEqual(parseBoolean(undefined), false);
});

test('utils - parseArray', () => {
  assert.deepStrictEqual(parseArray('张三,李四,王五'), ['张三', '李四', '王五']);
  assert.deepStrictEqual(parseArray('张三，李四，王五'), ['张三', '李四', '王五']);
  assert.deepStrictEqual(parseArray('张三、李四、王五'), ['张三', '李四', '王五']);
  assert.deepStrictEqual(parseArray('张三 李四 王五'), ['张三', '李四', '王五']);
  assert.deepStrictEqual(parseArray(''), []);
  assert.deepStrictEqual(parseArray(null), []);
});

test('utils - normalizeName', () => {
  assert.strictEqual(normalizeName('  张三  '), '张三');
  assert.strictEqual(normalizeName('张三'), '张三');
});

test('GuestParser - parse basic CSV content', () => {
  const parser = new GuestParser();
  const content = `姓名,分组,关系标签,同行人,忌口/过敏,行动不便,儿童,是否需要安静区,优先同桌,避免同桌,VIP,桌号
张大明,新郎家人,父亲,李美娟,素食,否,否,否,,,"是",1
李美娟,新郎家人,母亲,张大明,坚果过敏,否,否,否,,,"否",1`;

  const parsedData = parser.parseContent(content, 'test.csv');
  const result = parser.parseGuests(parsedData);
  
  assert.strictEqual(result.guests.length, 2);
  assert.strictEqual(result.guests[0].name, '张大明');
  assert.strictEqual(result.guests[0].isVIP, true);
  assert.ok(result.guests[0].companions.includes('李美娟'));
  assert.strictEqual(result.guests[1].name, '李美娟');
  assert.strictEqual(result.guests[1].isVIP, false);
});

test('TableParser - parse basic JSON content', () => {
  const parser = new TableParser();
  const content = JSON.stringify([
    {
      "桌号": "1",
      "容量": 10,
      "区域": "主舞台前",
      "离舞台距离": 10,
      "离音箱距离": 15,
      "离出口距离": 80,
      "是否儿童友好": false,
      "是否安静区": false
    }
  ]);

  const result = parser.parseContent(content, 'test.json');
  assert.strictEqual(result.tables.length, 1);
  assert.strictEqual(result.tables[0].tableNumber, '1');
  assert.strictEqual(result.tables[0].capacity, 10);
  assert.strictEqual(result.tables[0].distanceToStage, 10);
  assert.strictEqual(result.tables[0].isChildFriendly, false);
});

test('TableParser - handle invalid JSON', () => {
  const parser = new TableParser();
  assert.throws(() => {
    parser.parseContent('invalid json', 'test.json');
  });
});
