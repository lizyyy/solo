import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { RuleEngine } from '../src/rules.js';

describe('RuleEngine', () => {
  let ruleEngine;

  beforeEach(() => {
    ruleEngine = new RuleEngine({
      speedLimit: 5,
      reverseSpeedLimit: 3,
      blindSpotDistance: 5,
      turningSpeedLimit: 3
    });
  });

  describe('getSpeedSeverity', () => {
    it('should return high for speed >= 150% of limit', () => {
      const severity = ruleEngine.getSpeedSeverity(8, 5);
      assert.strictEqual(severity, 'high');
    });

    it('should return medium for speed >= 120% but < 150% of limit', () => {
      const severity = ruleEngine.getSpeedSeverity(6.5, 5);
      assert.strictEqual(severity, 'medium');
    });

    it('should return low for speed just above limit', () => {
      const severity = ruleEngine.getSpeedSeverity(5.5, 5);
      assert.strictEqual(severity, 'low');
    });
  });

  describe('isInAngleRange', () => {
    it('should return true when angle is within range', () => {
      assert.strictEqual(ruleEngine.isInAngleRange(0, 0, 90), true);
      assert.strictEqual(ruleEngine.isInAngleRange(45, 0, 90), true);
      assert.strictEqual(ruleEngine.isInAngleRange(-45, 0, 90), true);
    });

    it('should return false when angle is outside range', () => {
      assert.strictEqual(ruleEngine.isInAngleRange(50, 0, 90), false);
      assert.strictEqual(ruleEngine.isInAngleRange(-50, 0, 90), false);
    });

    it('should handle angle wrapping around 180 degrees', () => {
      assert.strictEqual(ruleEngine.isInAngleRange(170, 180, 60), true);
      assert.strictEqual(ruleEngine.isInAngleRange(-170, 180, 60), true);
    });
  });

  describe('isPointInZone', () => {
    it('should detect point in circular zone', () => {
      const circleZone = {
        type: 'circle',
        center: { x: 10, z: 10 },
        radius: 5
      };

      assert.strictEqual(ruleEngine.isPointInZone({ x: 10, z: 10 }, circleZone), true);
      assert.strictEqual(ruleEngine.isPointInZone({ x: 12, z: 12 }, circleZone), true);
      assert.strictEqual(ruleEngine.isPointInZone({ x: 20, z: 10 }, circleZone), false);
    });

    it('should detect point in rectangular zone', () => {
      const rectZone = {
        type: 'rectangle',
        position: { x: 10, z: 10 },
        width: 4,
        depth: 4
      };

      assert.strictEqual(ruleEngine.isPointInZone({ x: 10, z: 10 }, rectZone), true);
      assert.strictEqual(ruleEngine.isPointInZone({ x: 8, z: 8 }, rectZone), true);
      assert.strictEqual(ruleEngine.isPointInZone({ x: 5, z: 10 }, rectZone), false);
    });
  });

  describe('getEventTypeName', () => {
    it('should return Chinese names for known types', () => {
      assert.strictEqual(ruleEngine.getEventTypeName('blind-spot'), '盲区交汇');
      assert.strictEqual(ruleEngine.getEventTypeName('overspeed'), '超速');
      assert.strictEqual(ruleEngine.getEventTypeName('no-entry'), '禁行区穿越');
      assert.strictEqual(ruleEngine.getEventTypeName('near-miss'), '近失事件');
    });

    it('should return original type for unknown types', () => {
      assert.strictEqual(ruleEngine.getEventTypeName('unknown-type'), 'unknown-type');
    });
  });

  describe('getSeverityLabel', () => {
    it('should return Chinese labels', () => {
      assert.strictEqual(ruleEngine.getSeverityLabel('high'), '高风险');
      assert.strictEqual(ruleEngine.getSeverityLabel('medium'), '中风险');
      assert.strictEqual(ruleEngine.getSeverityLabel('low'), '低风险');
    });

    it('should return original severity for unknown values', () => {
      assert.strictEqual(ruleEngine.getSeverityLabel('critical'), 'critical');
    });
  });

  describe('getReviewStatusLabel', () => {
    it('should return Chinese labels', () => {
      assert.strictEqual(ruleEngine.getReviewStatusLabel('unreviewed'), '待复核');
      assert.strictEqual(ruleEngine.getReviewStatusLabel('reviewed'), '已复核');
      assert.strictEqual(ruleEngine.getReviewStatusLabel('confirmed'), '已确认风险');
      assert.strictEqual(ruleEngine.getReviewStatusLabel('dismissed'), '已驳回');
    });
  });

  describe('calculateStats', () => {
    it('should calculate statistics from events', () => {
      const events = [
        { type: 'overspeed', severity: 'high', reviewStatus: 'unreviewed' },
        { type: 'overspeed', severity: 'medium', reviewStatus: 'confirmed' },
        { type: 'blind-spot', severity: 'low', reviewStatus: 'dismissed' },
        { type: 'no-entry', severity: 'high', reviewStatus: 'unreviewed' }
      ];

      const stats = ruleEngine.calculateStats(events);

      assert.strictEqual(stats.total, 4);
      assert.strictEqual(stats.byType.overspeed, 2);
      assert.strictEqual(stats.byType['blind-spot'], 1);
      assert.strictEqual(stats.byType['no-entry'], 1);
      assert.strictEqual(stats.bySeverity.high, 2);
      assert.strictEqual(stats.bySeverity.medium, 1);
      assert.strictEqual(stats.bySeverity.low, 1);
      assert.strictEqual(stats.byReviewStatus.unreviewed, 2);
      assert.strictEqual(stats.byReviewStatus.confirmed, 1);
      assert.strictEqual(stats.byReviewStatus.dismissed, 1);
    });

    it('should handle empty events array', () => {
      const stats = ruleEngine.calculateStats([]);

      assert.strictEqual(stats.total, 0);
      assert.deepStrictEqual(stats.byType, {});
      assert.strictEqual(stats.bySeverity.high, 0);
      assert.strictEqual(stats.bySeverity.medium, 0);
      assert.strictEqual(stats.bySeverity.low, 0);
    });
  });

  describe('runAllChecks', () => {
    it('should return empty array for missing trajectory data', () => {
      const events = ruleEngine.runAllChecks(null, null, []);
      assert.deepStrictEqual(events, []);
    });

    it('should detect overspeed events', () => {
      const startTime = Date.now();
      const trajectoryData = {
        points: [
          { index: 0, timestamp: startTime, position: { x: 0, y: 0, z: 0 }, speed: 4, speedLimit: 5, direction: 0, isReversing: false, forkliftId: 'FL-001' },
          { index: 1, timestamp: startTime + 1000, position: { x: 2, y: 0, z: 0 }, speed: 6, speedLimit: 5, direction: 0, isReversing: false, forkliftId: 'FL-001' },
          { index: 2, timestamp: startTime + 2000, position: { x: 4, y: 0, z: 0 }, speed: 7, speedLimit: 5, direction: 0, isReversing: false, forkliftId: 'FL-001' },
          { index: 3, timestamp: startTime + 3000, position: { x: 6, y: 0, z: 0 }, speed: 4, speedLimit: 5, direction: 0, isReversing: false, forkliftId: 'FL-001' }
        ]
      };

      const events = ruleEngine.runAllChecks(trajectoryData, null, []);

      const overspeedEvents = events.filter(e => e.type === 'overspeed');
      assert.ok(overspeedEvents.length > 0);

      const hasHighSpeedEvent = overspeedEvents.some(e => e.maxSpeed >= 6);
      assert.strictEqual(hasHighSpeedEvent, true);
    });

    it('should detect blind spot encounters', () => {
      const startTime = Date.now();
      const trajectoryData = {
        points: []
      };

      for (let i = 0; i < 20; i++) {
        trajectoryData.points.push({
          index: i,
          timestamp: startTime + i * 500,
          position: { x: 5 + i * 0.5, y: 0, z: 10 },
          speed: 3,
          speedLimit: 5,
          direction: 0,
          isReversing: false,
          forkliftId: 'FL-001'
        });
      }

      const shelvesData = {
        shelves: [
          {
            id: 'shelf_001',
            name: 'Test Blind Spot',
            position: { x: 10, y: 0, z: 10 },
            size: { width: 2, depth: 1, height: 5 },
            isBlindSpot: true,
            blindSpotZone: { radius: 5, angle: 120 }
          }
        ]
      };

      const events = ruleEngine.runAllChecks(trajectoryData, shelvesData, []);

      const blindSpotEvents = events.filter(e => e.type === 'blind-spot');
      assert.ok(blindSpotEvents.length > 0);
      assert.strictEqual(blindSpotEvents[0].shelfId, 'shelf_001');
    });

    it('should detect no-entry zone violations', () => {
      const startTime = Date.now();
      const trajectoryData = {
        points: [
          { index: 0, timestamp: startTime, position: { x: 0, y: 0, z: 0 }, speed: 3, speedLimit: 5, direction: 0, isReversing: false, forkliftId: 'FL-001' },
          { index: 1, timestamp: startTime + 1000, position: { x: 10, y: 0, z: 10 }, speed: 3, speedLimit: 5, direction: 0, isReversing: false, forkliftId: 'FL-001' },
          { index: 2, timestamp: startTime + 2000, position: { x: 10.5, y: 0, z: 10.5 }, speed: 3, speedLimit: 5, direction: 0, isReversing: false, forkliftId: 'FL-001' },
          { index: 3, timestamp: startTime + 3000, position: { x: 20, y: 0, z: 20 }, speed: 3, speedLimit: 5, direction: 0, isReversing: false, forkliftId: 'FL-001' }
        ]
      };

      const shelvesData = {
        shelves: [],
        noEntryZones: [
          {
            id: 'zone_001',
            name: '消防通道',
            type: 'circle',
            center: { x: 10, z: 10 },
            radius: 3
          }
        ]
      };

      const events = ruleEngine.runAllChecks(trajectoryData, shelvesData, []);

      const noEntryEvents = events.filter(e => e.type === 'no-entry');
      assert.ok(noEntryEvents.length > 0);
      assert.strictEqual(noEntryEvents[0].zoneName, '消防通道');
    });
  });

  describe('getStatistics', () => {
    it('should return statistics after running checks', () => {
      const startTime = Date.now();
      const trajectoryData = {
        points: [
          { index: 0, timestamp: startTime, position: { x: 0, y: 0, z: 0 }, speed: 4, speedLimit: 5, direction: 0, isReversing: false, forkliftId: 'FL-001' },
          { index: 1, timestamp: startTime + 1000, position: { x: 2, y: 0, z: 0 }, speed: 6, speedLimit: 5, direction: 0, isReversing: false, forkliftId: 'FL-001' },
          { index: 2, timestamp: startTime + 2000, position: { x: 4, y: 0, z: 0 }, speed: 4, speedLimit: 5, direction: 0, isReversing: false, forkliftId: 'FL-001' }
        ]
      };

      ruleEngine.runAllChecks(trajectoryData, null, []);
      const stats = ruleEngine.getStatistics();

      assert.ok(stats.total > 0);
    });
  });

  describe('getEventsByType', () => {
    it('should filter events by type', () => {
      const startTime = Date.now();
      const trajectoryData = {
        points: [
          { index: 0, timestamp: startTime, position: { x: 0, y: 0, z: 0 }, speed: 6, speedLimit: 5, direction: 0, isReversing: false, forkliftId: 'FL-001' },
          { index: 1, timestamp: startTime + 1000, position: { x: 2, y: 0, z: 0 }, speed: 6, speedLimit: 5, direction: 0, isReversing: false, forkliftId: 'FL-001' },
          { index: 2, timestamp: startTime + 2000, position: { x: 4, y: 0, z: 0 }, speed: 6, speedLimit: 5, direction: 0, isReversing: false, forkliftId: 'FL-001' }
        ]
      };

      ruleEngine.runAllChecks(trajectoryData, null, []);
      
      const overspeedEvents = ruleEngine.getEventsByType('overspeed');
      const blindSpotEvents = ruleEngine.getEventsByType('blind-spot');

      assert.ok(overspeedEvents.length > 0);
      assert.strictEqual(blindSpotEvents.length, 0);
    });
  });
});
