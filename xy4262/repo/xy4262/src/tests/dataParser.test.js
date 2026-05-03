import { describe, it, expect } from 'vitest';
import { DataParser } from '../modules/DataParser.js';
import { SampleData } from '../data/SampleData.js';

describe('DataParser', () => {
  let parser;

  beforeEach(() => {
    parser = new DataParser();
  });

  describe('无人机数据解析', () => {
    it('应该能解析标准JSON格式', () => {
      const jsonData = JSON.stringify({
        drones: [
          {
            id: 'drone_0',
            name: '测试无人机1',
            batteryId: 'battery_0',
            waypoints: [
              { time: 0, x: 0, y: 0, z: 10 },
              { time: 10, x: 10, y: 10, z: 20 }
            ],
            color: '#ff0000'
          }
        ]
      });

      const result = parser.parseDronesJSON(jsonData);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('drone_0');
      expect(result[0].waypoints.length).toBe(2);
    });

    it('应该能解析数组格式', () => {
      const jsonData = JSON.stringify([
        {
          id: 'drone_0',
          name: '测试无人机1',
          waypoints: []
        }
      ]);

      const result = parser.parseDronesJSON(jsonData);
      expect(result.length).toBe(1);
    });

    it('应该能生成默认ID', () => {
      const jsonData = JSON.stringify([
        { waypoints: [] },
        { waypoints: [] }
      ]);

      const result = parser.parseDronesJSON(jsonData);
      expect(result[0].id).toBe('drone_0');
      expect(result[1].id).toBe('drone_1');
    });

    it('应该能标准化航点数据', () => {
      const jsonData = JSON.stringify([
        {
          waypoints: [
            { t: 0, x: 0, y: 0, altitude: 10 },
            { time: 10, x: 10, y: 10, z: 20 }
          ]
        }
      ]);

      const result = parser.parseDronesJSON(jsonData);
      expect(result[0].waypoints[0].time).toBe(0);
      expect(result[0].waypoints[0].z).toBe(10);
      expect(result[0].waypoints[1].time).toBe(10);
      expect(result[0].waypoints[1].z).toBe(20);
    });

    it('无效JSON应该抛出错误', () => {
      expect(() => parser.parseDronesJSON('这不是JSON')).toThrow();
    });
  });

  describe('禁飞区数据解析', () => {
    it('应该能解析GeoJSON FeatureCollection', () => {
      const geojson = JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              id: 'zone_0',
              name: '测试禁飞区',
              radius: 50
            },
            geometry: {
              type: 'Point',
              coordinates: [0, 0]
            }
          }
        ]
      });

      const result = parser.parseNoFlyGeoJSON(geojson);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('zone_0');
      expect(result[0].shape).toBe('circle');
      expect(result[0].radius).toBe(50);
    });

    it('应该能解析多边形GeoJSON', () => {
      const geojson = JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              id: 'zone_0',
              name: '多边形禁飞区'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
              ]
            }
          }
        ]
      });

      const result = parser.parseNoFlyGeoJSON(geojson);
      expect(result.length).toBe(1);
      expect(result[0].shape).toBe('polygon');
      expect(result[0].coordinates.length).toBe(5);
    });

    it('应该能解析单个Feature', () => {
      const geojson = JSON.stringify({
        type: 'Feature',
        properties: {
          id: 'zone_0',
          radius: 30
        },
        geometry: {
          type: 'Point',
          coordinates: [10, 20]
        }
      });

      const result = parser.parseNoFlyGeoJSON(geojson);
      expect(result.length).toBe(1);
      expect(result[0].center.x).toBe(10);
      expect(result[0].center.y).toBe(20);
    });
  });

  describe('CSV解析', () => {
    it('应该能解析标准CSV', () => {
      const csv = `id,capacity,drain_rate
battery_0,100,0.5
battery_1,95,0.6`;

      const result = parser.parseBatteriesCSV(csv);
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('battery_0');
      expect(result[0].capacity).toBe(100);
      expect(result[0].drainRate).toBe(0.5);
    });

    it('应该能解析带引号的CSV', () => {
      const csv = `time,type,description
0,"strong","第一拍"
0.5,"weak","第二拍"`;

      const result = parser.parseBeatsCSV(csv);
      expect(result.length).toBe(2);
      expect(result[0].description).toBe('第一拍');
    });

    it('应该能处理不同的列名', () => {
      const csv = `timestamp,beat_type,strength
0,strong,1.0
0.5,weak,0.6`;

      const result = parser.parseBeatsCSV(csv);
      expect(result.length).toBe(2);
      expect(result[0].time).toBe(0);
      expect(result[0].type).toBe('strong');
      expect(result[0].intensity).toBe(1.0);
    });

    it('空CSV应该返回空数组', () => {
      const csv = `id,capacity`;
      const result = parser.parseBatteriesCSV(csv);
      expect(result.length).toBe(0);
    });

    it('应该能按时间排序节拍数据', () => {
      const csv = `time,type
1.5,weak
0.0,strong
0.5,weak`;

      const result = parser.parseBeatsCSV(csv);
      expect(result[0].time).toBe(0);
      expect(result[1].time).toBe(0.5);
      expect(result[2].time).toBe(1.5);
    });
  });

  describe('CSV行解析', () => {
    it('应该能解析简单的CSV行', () => {
      const line = 'a,b,c';
      const result = parser.parseCSVLine(line);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('应该能解析带引号的字段', () => {
      const line = 'a,"b,c",d';
      const result = parser.parseCSVLine(line);
      expect(result).toEqual(['a', 'b,c', 'd']);
    });

    it('应该能处理空字段', () => {
      const line = 'a,,c';
      const result = parser.parseCSVLine(line);
      expect(result).toEqual(['a', '', 'c']);
    });
  });

  describe('示例数据集成测试', () => {
    it('应该能解析示例无人机数据', () => {
      const json = SampleData.exportDronesJSON();
      const result = parser.parseDronesJSON(json);
      expect(result.length).toBe(8);
      result.forEach(drone => {
        expect(drone.id).toBeDefined();
        expect(drone.waypoints.length).toBeGreaterThan(0);
      });
    });

    it('应该能解析示例禁飞区数据', () => {
      const geojson = SampleData.exportNoFlyGeoJSON();
      const result = parser.parseNoFlyGeoJSON(geojson);
      expect(result.length).toBe(3);
    });

    it('应该能解析示例节拍数据', () => {
      const csv = SampleData.exportBeatsCSV();
      const result = parser.parseBeatsCSV(csv);
      expect(result.length).toBeGreaterThan(0);
    });

    it('应该能解析示例电池数据', () => {
      const csv = SampleData.exportBatteriesCSV();
      const result = parser.parseBatteriesCSV(csv);
      expect(result.length).toBe(4);
    });
  });
});
