import {
  validateAuditEvent,
  validateEventGroup,
  validateTimelineOptions,
  validateSearchOptions,
  validateExportOptions,
  isNonEmptyString,
  isPositiveNumber,
  isValidTimestamp,
  validateEventId,
  validateUserId,
  validateTimestamp,
  validateEventType,
  validateResourceId,
  validateColor,
} from '../src/validators';
import { defaultTimelineOptions } from '../src/types';
import type { AuditEvent, EventGroup } from '../src/types';
import { test, describe, it } from 'node:test';
import assert from 'node:assert';

describe('Validators', () => {
  describe('基础验证函数', () => {
    it('isNonEmptyString - 正确识别非空字符串', () => {
      assert.strictEqual(isNonEmptyString('test'), true);
      assert.strictEqual(isNonEmptyString('  test  '), true);
      assert.strictEqual(isNonEmptyString(''), false);
      assert.strictEqual(isNonEmptyString('   '), false);
      assert.strictEqual(isNonEmptyString(null as unknown as string), false);
      assert.strictEqual(isNonEmptyString(undefined as unknown as string), false);
      assert.strictEqual(isNonEmptyString(123 as unknown as string), false);
    });

    it('isPositiveNumber - 正确识别正数', () => {
      assert.strictEqual(isPositiveNumber(1), true);
      assert.strictEqual(isPositiveNumber(0.5), true);
      assert.strictEqual(isPositiveNumber(100.5), true);
      assert.strictEqual(isPositiveNumber(0), false);
      assert.strictEqual(isPositiveNumber(-1), false);
      assert.strictEqual(isPositiveNumber(NaN), false);
      assert.strictEqual(isPositiveNumber(Infinity), false);
      assert.strictEqual(isPositiveNumber('1' as unknown as number), false);
    });

    it('isValidTimestamp - 正确识别有效时间戳', () => {
      assert.strictEqual(isValidTimestamp(Date.now()), true);
      assert.strictEqual(isValidTimestamp(0), true);
      assert.strictEqual(isValidTimestamp(1000000000000), true);
      assert.strictEqual(isValidTimestamp(-1), false);
      assert.strictEqual(isValidTimestamp(NaN), false);
      assert.strictEqual(isValidTimestamp(Infinity), false);
    });

    it('validateEventId - 验证事件ID', () => {
      assert.strictEqual(validateEventId('event-001'), null);
      assert.notStrictEqual(validateEventId(''), null);
      assert.notStrictEqual(validateEventId('   '), null);
    });

    it('validateUserId - 验证用户ID', () => {
      assert.strictEqual(validateUserId('user-001'), null);
      assert.notStrictEqual(validateUserId(''), null);
    });

    it('validateTimestamp - 验证时间戳', () => {
      assert.strictEqual(validateTimestamp(Date.now()), null);
      assert.notStrictEqual(validateTimestamp(-1000), null);
    });

    it('validateEventType - 验证事件类型', () => {
      assert.strictEqual(validateEventType('create'), null);
      assert.strictEqual(validateEventType('update'), null);
      assert.strictEqual(validateEventType('delete'), null);
      assert.strictEqual(validateEventType('rollback'), null);
      assert.strictEqual(validateEventType('restore'), null);
      assert.strictEqual(validateEventType('read'), null);
      assert.strictEqual(validateEventType('login'), null);
      assert.strictEqual(validateEventType('logout'), null);
      assert.notStrictEqual(validateEventType('invalid'), null);
      assert.notStrictEqual(validateEventType(''), null);
    });

    it('validateResourceId - 验证资源ID', () => {
      assert.strictEqual(validateResourceId('res-001'), null);
      assert.notStrictEqual(validateResourceId(''), null);
    });

    it('validateColor - 验证颜色格式', () => {
      assert.strictEqual(validateColor('#fff'), null);
      assert.strictEqual(validateColor('#ffffff'), null);
      assert.strictEqual(validateColor('#123456'), null);
      assert.strictEqual(validateColor('#ABC'), null);
      assert.notStrictEqual(validateColor('fff'), null);
      assert.notStrictEqual(validateColor('#ffff'), null);
      assert.notStrictEqual(validateColor('red'), null);
      assert.notStrictEqual(validateColor(''), null);
    });
  });

  describe('validateAuditEvent', () => {
    const validEvent: AuditEvent = {
      id: 'test-001',
      timestamp: Date.now(),
      type: 'update',
      userId: 'user-001',
      userName: '测试用户',
      resourceId: 'res-001',
      resourceName: '测试资源',
      resourceType: 'test',
      action: '测试操作',
      details: '测试详情',
      tags: ['测试'],
    };

    it('验证完整有效事件', () => {
      const result = validateAuditEvent(validEvent);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('验证空对象返回错误', () => {
      const result = validateAuditEvent({});
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.length > 0, true);
    });

    it('验证 null/undefined 返回错误', () => {
      const result1 = validateAuditEvent(null);
      assert.strictEqual(result1.valid, false);

      const result2 = validateAuditEvent(undefined);
      assert.strictEqual(result2.valid, false);
    });

    it('验证缺少 ID 返回错误', () => {
      const event = { ...validEvent, id: '' };
      const result = validateAuditEvent(event);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'id'), true);
    });

    it('验证缺少时间戳返回错误', () => {
      const event = { ...validEvent, timestamp: -1000 };
      const result = validateAuditEvent(event);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'timestamp'), true);
    });

    it('验证无效事件类型返回错误', () => {
      const event = { ...validEvent, type: 'invalid_type' as AuditEvent['type'] };
      const result = validateAuditEvent(event);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'type'), true);
    });

    it('验证缺少用户信息返回错误', () => {
      const event = { ...validEvent, userId: '', userName: '' };
      const result = validateAuditEvent(event);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'userId'), true);
      assert.strictEqual(result.errors.some(e => e.field === 'userName'), true);
    });

    it('验证缺少资源信息返回错误', () => {
      const event = { ...validEvent, resourceId: '', resourceName: '', resourceType: '' };
      const result = validateAuditEvent(event);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'resourceId'), true);
      assert.strictEqual(result.errors.some(e => e.field === 'resourceName'), true);
      assert.strictEqual(result.errors.some(e => e.field === 'resourceType'), true);
    });

    it('验证缺少操作描述返回错误', () => {
      const event = { ...validEvent, action: '' };
      const result = validateAuditEvent(event);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'action'), true);
    });

    it('验证无效的 tags 类型返回错误', () => {
      const event = { ...validEvent, tags: 'not_an_array' as unknown as string[] };
      const result = validateAuditEvent(event);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'tags'), true);
    });

    it('验证回滚事件缺少目标ID返回错误', () => {
      const event = { ...validEvent, type: 'rollback' as const, isRollback: true, rollbackTargetId: '' };
      const result = validateAuditEvent(event);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'rollbackTargetId'), true);
    });

    it('验证重复的事件ID返回错误', () => {
      const existingEvents = [validEvent];
      const duplicateEvent = { ...validEvent, timestamp: Date.now() + 1000 };
      const result = validateAuditEvent(duplicateEvent, existingEvents);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'id'), true);
    });
  });

  describe('validateEventGroup', () => {
    const validGroup: EventGroup = {
      id: 'group-001',
      name: '测试组',
      color: '#3b82f6',
      events: ['event-001', 'event-002'],
      startTimestamp: Date.now() - 10000,
      endTimestamp: Date.now(),
      collapsed: false,
    };

    it('验证完整有效组', () => {
      const result = validateEventGroup(validGroup);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('验证缺少 ID 返回错误', () => {
      const group = { ...validGroup, id: '' };
      const result = validateEventGroup(group);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'id'), true);
    });

    it('验证缺少名称返回错误', () => {
      const group = { ...validGroup, name: '' };
      const result = validateEventGroup(group);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'name'), true);
    });

    it('验证无效颜色返回错误', () => {
      const group = { ...validGroup, color: 'invalid' };
      const result = validateEventGroup(group);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'color'), true);
    });

    it('验证非数组 events 返回错误', () => {
      const group = { ...validGroup, events: 'not_an_array' as unknown as string[] };
      const result = validateEventGroup(group);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'events'), true);
    });
  });

  describe('validateTimelineOptions', () => {
    it('验证空配置返回有效（使用默认值场景）', () => {
      const result = validateTimelineOptions({});
      assert.strictEqual(result.valid, true);
    });

    it('验证完整有效配置', () => {
      const result = validateTimelineOptions(defaultTimelineOptions);
      assert.strictEqual(result.valid, true);
    });

    it('验证无效画布宽度返回错误', () => {
      const result = validateTimelineOptions({ canvasWidth: -100 });
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'canvasWidth'), true);
    });

    it('验证无效画布高度返回错误', () => {
      const result = validateTimelineOptions({ canvasHeight: 0 });
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'canvasHeight'), true);
    });

    it('验证 minZoom >= maxZoom 返回错误', () => {
      const result = validateTimelineOptions({ minZoom: 2, maxZoom: 1 });
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'maxZoom'), true);
    });

    it('验证 initialZoom 超出范围返回错误', () => {
      const result = validateTimelineOptions({ minZoom: 0.5, maxZoom: 2, initialZoom: 3 });
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'initialZoom'), true);
    });
  });

  describe('validateSearchOptions', () => {
    it('验证完整有效搜索选项', () => {
      const result = validateSearchOptions({
        query: '测试',
        searchIn: ['action', 'details'],
        caseSensitive: false,
        exactMatch: false,
      });
      assert.strictEqual(result.valid, true);
    });

    it('验证缺少查询返回错误', () => {
      const result = validateSearchOptions({} as unknown as Parameters<typeof validateSearchOptions>[0]);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'query'), true);
    });

    it('验证无效的搜索字段返回错误', () => {
      const result = validateSearchOptions({
        query: '测试',
        searchIn: ['invalid_field'] as unknown as ('action' | 'details')[],
      });
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'searchIn'), true);
    });

    it('验证无效的 caseSensitive 返回错误', () => {
      const result = validateSearchOptions({
        query: '测试',
        caseSensitive: 'true' as unknown as boolean,
      });
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'caseSensitive'), true);
    });
  });

  describe('validateExportOptions', () => {
    it('验证完整有效导出选项', () => {
      const result = validateExportOptions({
        format: 'png',
        quality: 0.9,
        backgroundColor: '#ffffff',
        includeLegend: true,
        includeTimestamp: true,
      });
      assert.strictEqual(result.valid, true);
    });

    it('验证无效格式返回错误', () => {
      const result = validateExportOptions({
        format: 'pdf' as unknown as 'png' | 'jpeg',
      });
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'format'), true);
    });

    it('验证无效质量返回错误', () => {
      const result1 = validateExportOptions({ quality: -1 });
      assert.strictEqual(result1.valid, false);
      assert.strictEqual(result1.errors.some(e => e.field === 'quality'), true);

      const result2 = validateExportOptions({ quality: 2 });
      assert.strictEqual(result2.valid, false);
      assert.strictEqual(result2.errors.some(e => e.field === 'quality'), true);
    });

    it('验证无效背景色返回错误', () => {
      const result = validateExportOptions({
        backgroundColor: 'invalid',
      });
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.some(e => e.field === 'backgroundColor'), true);
    });
  });
});
