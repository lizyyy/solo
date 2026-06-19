import assert from 'node:assert/strict';
import { normalizeAlarmOccluded, detectOcclusion } from '../src/services/alarmDetector.ts';

type TestCase = { name: string; fn: () => void };

const tests: TestCase[] = [];

function test(name: string, fn: () => void) {
  tests.push({ name, fn });
}

function runAll() {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      t.fn();
      console.log(`  ✓ ${t.name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${t.name}`);
      console.error(`    ${(err as Error).message}`);
      failed++;
    }
  }
  console.log(`\nResult: ${passed} passed, ${failed} failed, ${tests.length} total`);
  if (failed > 0) process.exit(1);
}

console.log('\n[1] normalizeAlarmOccluded —— 失败点2：false/否 不应被当成遮挡告警=true\n');

test('boolean true → true', () => assert.equal(normalizeAlarmOccluded(true), true));
test('boolean false → false', () => assert.equal(normalizeAlarmOccluded(false), false));
test('string "false" → false (核心修复)', () => assert.equal(normalizeAlarmOccluded('false'), false));
test('string "否" → false (核心修复)', () => assert.equal(normalizeAlarmOccluded('否'), false));
test('string "无" → false', () => assert.equal(normalizeAlarmOccluded('无'), false));
test('string "没有" → false', () => assert.equal(normalizeAlarmOccluded('没有'), false));
test('empty string → false', () => assert.equal(normalizeAlarmOccluded(''), false));
test('string "true" → true', () => assert.equal(normalizeAlarmOccluded('true'), true));
test('string "是" → true', () => assert.equal(normalizeAlarmOccluded('是'), true));
test('string "有" → true', () => assert.equal(normalizeAlarmOccluded('有'), true));
test('number 1 → true', () => assert.equal(normalizeAlarmOccluded(1), true));
test('number 0 → false', () => assert.equal(normalizeAlarmOccluded(0), false));
test('undefined → false', () => assert.equal(normalizeAlarmOccluded(undefined), false));
test('null → false', () => assert.equal(normalizeAlarmOccluded(null), false));
test('object {} → false', () => assert.equal(normalizeAlarmOccluded({}), false));

console.log('\n[2] detectOcclusion —— 失败点3：不能随机，必须只基于 URL 关键词稳定判断\n');

test('同一 URL 多次调用结果一致（幂等性，核心修复）', () => {
  const url = '/screenshots/normal.jpg';
  const results = Array.from({ length: 20 }, () => detectOcclusion(url));
  assert.ok(results.every((r) => r === results[0]), '同一 URL 多次调用必须返回相同结果');
});

test('无任何遮挡关键词的图片 → false', () => assert.equal(detectOcclusion('/screenshots/batch001-point11.jpg'), false));
test('URL 含 "occluded" → true', () => assert.equal(detectOcclusion('/screenshots/batch003-occluded.jpg'), true));
test('URL 含中文 "遮挡" → true', () => assert.equal(detectOcclusion('/screenshots/手指遮挡告警.jpg'), true));
test('URL 含 "blur" → true', () => assert.equal(detectOcclusion('/screenshots/blur-point12.jpeg'), true));
test('URL 含 "finger" → true', () => assert.equal(detectOcclusion('/screenshots/finger_blocked.png'), true));
test('空字符串 → false', () => assert.equal(detectOcclusion(''), false));
test('undefined/非字符串输入安全', () => {
  // @ts-expect-error 故意传入非法值
  assert.equal(detectOcclusion(undefined), false);
  // @ts-expect-error 故意传入非法值
  assert.equal(detectOcclusion(null), false);
});

console.log('\n[3] 组合判定 —— alarmOccluded=false + 无遮挡关键词截图，最终一定不入复核\n');

function finalOccluded(alarmRaw: unknown, screenshotUrl: string): boolean {
  const normalized = normalizeAlarmOccluded(alarmRaw);
  return normalized || detectOcclusion(screenshotUrl);
}

test('alarm="否" + 正常截图 → 不告警（之前会误判）', () =>
  assert.equal(finalOccluded('否', '/screenshots/normal.jpg'), false));
test('alarm="false" + 正常截图 → 不告警（之前会误判）', () =>
  assert.equal(finalOccluded('false', '/screenshots/normal.jpg'), false));
test('alarm=false + 正常截图 → 不告警', () =>
  assert.equal(finalOccluded(false, '/screenshots/normal.jpg'), false));
test('alarm="" + 正常截图 → 不告警', () =>
  assert.equal(finalOccluded('', '/screenshots/normal.jpg'), false));
test('alarm="是" + 正常截图 → 告警', () =>
  assert.equal(finalOccluded('是', '/screenshots/normal.jpg'), true));
test('alarm=false + URL含遮挡 → 告警', () =>
  assert.equal(finalOccluded(false, '/screenshots/手指遮挡.jpg'), true));

console.log('\n[4] 历史记录字段完整性验证\n');

test('normalizeAlarmOccluded 返回严格 boolean，不泄露字符串', () => {
  const allValues: unknown[] = [true, false, 'true', 'false', '是', '否', '', null, undefined, 0, 1];
  for (const v of allValues) {
    const result = normalizeAlarmOccluded(v);
    assert.equal(typeof result, 'boolean', `${String(v)} 必须返回 boolean，实际返回 ${typeof result}`);
  }
});

runAll();
