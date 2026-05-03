import { test } from 'node:test';
import assert from 'node:assert';
import { RuleEngine } from '../src/rules/index.js';
import { DuplicateNameRule, UnseatedGuestRule, MissingTableRule } from '../src/rules/validation-rules.js';
import { TableCapacityRule, EmptyTableRule } from '../src/rules/table-rules.js';
import { CONFLICT_SEVERITY } from '../src/types.js';

test('RuleEngine - basic execution', async () => {
  const engine = new RuleEngine();
  const result = await engine.validate({ guests: [], tables: [] });
  
  assert.ok(result.conflicts);
  assert.ok(result.conflicts.length >= 0);
  assert.ok(result.summary);
});

test('TableCapacityRule - detect over capacity', async () => {
  const rule = new TableCapacityRule();
  const context = {
    guests: [
      { name: '张三', tableNumber: '1' },
      { name: '李四', tableNumber: '1' },
      { name: '王五', tableNumber: '1' }
    ],
    tables: [
      { tableNumber: '1', capacity: 2 },
      { tableNumber: '2', capacity: 8 }
    ]
  };

  const result = await rule.execute(context);
  assert.strictEqual(result.conflicts.length, 1);
  assert.strictEqual(result.conflicts[0].severity, CONFLICT_SEVERITY.CRITICAL);
});

test('DuplicateNameRule - detect duplicate names', async () => {
  const rule = new DuplicateNameRule();
  const context = {
    guests: [
      { name: '张三', tableNumber: '1' },
      { name: '张三', tableNumber: '2' },
      { name: '李四', tableNumber: '1' }
    ],
    tables: []
  };

  const result = await rule.execute(context);
  assert.strictEqual(result.conflicts.length, 1);
  assert.strictEqual(result.conflicts[0].severity, CONFLICT_SEVERITY.CRITICAL);
});

test('UnseatedGuestRule - detect unseated guests', async () => {
  const rule = new UnseatedGuestRule();
  const context = {
    guests: [
      { name: '张三', tableNumber: '1' },
      { name: '李四', tableNumber: '' },
      { name: '王五', tableNumber: null }
    ],
    tables: []
  };

  const result = await rule.execute(context);
  assert.strictEqual(result.conflicts.length, 1);
  assert.strictEqual(result.conflicts[0].severity, CONFLICT_SEVERITY.HIGH);
});

test('MissingTableRule - detect invalid table number', async () => {
  const rule = new MissingTableRule();
  const context = {
    guests: [
      { name: '张三', tableNumber: '1' },
      { name: '李四', tableNumber: '99' },
      { name: '王五', tableNumber: '1' }
    ],
    tables: [
      { tableNumber: '1' },
      { tableNumber: '2' }
    ]
  };

  const result = await rule.execute(context);
  assert.strictEqual(result.conflicts.length, 1);
  assert.strictEqual(result.conflicts[0].severity, CONFLICT_SEVERITY.HIGH);
});
