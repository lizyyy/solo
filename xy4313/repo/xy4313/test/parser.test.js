import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DataParser } from '../src/parser.js';

describe('DataParser', () => {
  let parser;

  beforeEach(() => {
    parser = new DataParser();
  });

  describe('parseJSON', () => {
    it('should parse valid JSON', () => {
      const result = parser.parseJSON('{"name": "test", "value": 123}');
      assert.deepStrictEqual(result, { name: 'test', value: 123 });
    });

    it('should throw error for invalid JSON', () => {
      assert.throws(() => {
        parser.parseJSON('invalid json');
      }, Error);
    });
  });

  describe('parseCSV', () => {
    it('should parse simple CSV', () => {
      const csv = 'name,value\ntest,123\nexample,456';
      const result = parser.parseCSV(csv);
      
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].name, 'test');
      assert.strictEqual(result[0].value, 123);
      assert.strictEqual(result[1].name, 'example');
      assert.strictEqual(result[1].value, 456);
    });

    it('should parse CSV with quoted values', () => {
      const csv = 'name,description\ntest,"value with, comma"\nexample,"value with ""quotes"""';
      const result = parser.parseCSV(csv);
      
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].description, 'value with, comma');
    });

    it('should convert numeric values', () => {
      const csv = 'x,y,z\n1.5,2.5,3.5\n4,5,6';
      const result = parser.parseCSV(csv);
      
      assert.strictEqual(result[0].x, 1.5);
      assert.strictEqual(result[0].y, 2.5);
      assert.strictEqual(result[1].x, 4);
    });

    it('should throw error for empty CSV', () => {
      assert.throws(() => {
        parser.parseCSV('');
      }, Error);
    });
  });

  describe('parseShelves', () => {
    it('should parse valid shelves data', () => {
      const data = {
        version: '1.0',
        warehouseSize: { width: 50, depth: 40, height: 10 },
        shelves: [
          {
            id: 'shelf_001',
            name: 'Test Shelf',
            position: { x: 10, y: 0, z: 10 },
            size: { width: 8, depth: 2, height: 6 },
            isBlindSpot: true,
            blindSpotZone: { radius: 5, angle: 120 }
          }
        ],
        noEntryZones: [],
        temporaryObstacles: []
      };

      const result = parser.parseShelves(data);
      
      assert.strictEqual(result.version, '1.0');
      assert.strictEqual(result.shelves.length, 1);
      assert.strictEqual(result.shelves[0].name, 'Test Shelf');
      assert.strictEqual(result.shelves[0].isBlindSpot, true);
      assert.strictEqual(result.shelves[0].blindSpotZone.radius, 5);
    });

    it('should throw error for missing shelves array', () => {
      assert.throws(() => {
        parser.parseShelves({ version: '1.0' });
      }, Error);
    });

    it('should provide default values for missing fields', () => {
      const data = {
        shelves: [
          {
            position: { x: 10, y: 0, z: 10 }
          }
        ]
      };

      const result = parser.parseShelves(data);
      
      assert.strictEqual(result.shelves.length, 1);
      assert.strictEqual(result.shelves[0].name, '未命名货架');
      assert.strictEqual(result.shelves[0].size.width, 2);
      assert.strictEqual(result.shelves[0].isBlindSpot, false);
    });
  });

  describe('parseForkliftTrajectory', () => {
    it('should parse CSV trajectory data', () => {
      const csv = `timestamp,forkliftId,x,y,z,speed,speedLimit,direction,isReversing
2024-01-15T09:00:00.000Z,FL-001,5,0,5,0,5,0,false
2024-01-15T09:00:00.500Z,FL-001,10,0,5,4,5,90,false`;

      const result = parser.parseForkliftTrajectory(csv);
      
      assert.strictEqual(result.forkliftId, 'FL-001');
      assert.strictEqual(result.points.length, 2);
      assert.strictEqual(result.points[0].position.x, 5);
      assert.strictEqual(result.points[1].speed, 4);
    });

    it('should sort points by timestamp', () => {
      const csv = `timestamp,forkliftId,x,y,z,speed
2024-01-15T09:00:02.000Z,FL-001,15,0,10,3
2024-01-15T09:00:00.000Z,FL-001,5,0,5,0
2024-01-15T09:00:01.000Z,FL-001,10,0,8,2`;

      const result = parser.parseForkliftTrajectory(csv);
      
      assert.strictEqual(result.points.length, 3);
      assert.strictEqual(result.points[0].position.x, 5);
      assert.strictEqual(result.points[1].position.x, 10);
      assert.strictEqual(result.points[2].position.x, 15);
    });
  });

  describe('parseTimestamp', () => {
    it('should parse ISO string timestamp', () => {
      const date = new Date('2024-01-15T09:00:00.000Z');
      const result = parser.parseTimestamp('2024-01-15T09:00:00.000Z');
      
      assert.strictEqual(result, date.getTime());
    });

    it('should pass through numeric timestamp', () => {
      const timestamp = Date.now();
      const result = parser.parseTimestamp(timestamp);
      
      assert.strictEqual(result, timestamp);
    });

    it('should return 0 for invalid values', () => {
      assert.strictEqual(parser.parseTimestamp(null), 0);
      assert.strictEqual(parser.parseTimestamp(undefined), 0);
      assert.strictEqual(parser.parseTimestamp(''), 0);
    });
  });

  describe('normalizeEventType', () => {
    it('should normalize blind spot types', () => {
      assert.strictEqual(parser.normalizeEventType('blind-spot'), 'blind-spot');
      assert.strictEqual(parser.normalizeEventType('blind_spot'), 'blind-spot');
      assert.strictEqual(parser.normalizeEventType('盲区交汇'), 'blind-spot');
    });

    it('should normalize overspeed types', () => {
      assert.strictEqual(parser.normalizeEventType('overspeed'), 'overspeed');
      assert.strictEqual(parser.normalizeEventType('over-speed'), 'overspeed');
      assert.strictEqual(parser.normalizeEventType('超速'), 'overspeed');
    });

    it('should normalize no-entry types', () => {
      assert.strictEqual(parser.normalizeEventType('no-entry'), 'no-entry');
      assert.strictEqual(parser.normalizeEventType('no_entry'), 'no-entry');
      assert.strictEqual(parser.normalizeEventType('禁行区'), 'no-entry');
    });

    it('should pass through unknown types', () => {
      assert.strictEqual(parser.normalizeEventType('custom-type'), 'custom-type');
    });
  });

  describe('isComplete', () => {
    it('should return false when data is missing', () => {
      assert.strictEqual(parser.isComplete(), false);
    });

    it('should return true when both shelves and trajectory are present', () => {
      parser.parsedData.shelves = { shelves: [] };
      parser.parsedData.forkliftTrajectory = { points: [] };
      
      assert.strictEqual(parser.isComplete(), true);
    });
  });

  describe('getAllData', () => {
    it('should return copy of parsed data', () => {
      parser.parsedData.shelves = { shelves: [] };
      parser.parsedData.forkliftTrajectory = { points: [] };
      
      const result = parser.getAllData();
      
      assert.deepStrictEqual(result.shelves, parser.parsedData.shelves);
      assert.deepStrictEqual(result.forkliftTrajectory, parser.parsedData.forkliftTrajectory);
    });
  });
});
