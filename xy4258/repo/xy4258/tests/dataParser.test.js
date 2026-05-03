const dataParser = require('../src/core/dataParser');

describe('DataParser', () => {
  describe('parseBikeGPS', () => {
    test('should parse valid CSV content', () => {
      const csvContent = `bike_id,timestamp,latitude,longitude,accuracy,status
BK001,2026-05-02 23:45:00,31.2354,121.4787,5.2,available
BK002,2026-05-02 23:45:30,31.2356,121.4789,6.1,available`;

      const result = dataParser.parseBikeGPS(csvContent);
      
      expect(result).toHaveLength(2);
      expect(result[0].bike_id).toBe('BK001');
      expect(result[0].latitude).toBe(31.2354);
      expect(result[0].longitude).toBe(121.4787);
      expect(typeof result[0].timestamp).toBe('number');
    });

    test('should filter out invalid rows without bike_id', () => {
      const csvContent = `bike_id,timestamp,latitude,longitude,accuracy,status
,2026-05-02 23:45:00,31.2354,121.4787,5.2,available
BK002,2026-05-02 23:45:30,31.2356,121.4789,6.1,available`;

      const result = dataParser.parseBikeGPS(csvContent);
      
      expect(result).toHaveLength(1);
    });

    test('should filter out rows with invalid coordinates', () => {
      const csvContent = `bike_id,timestamp,latitude,longitude,accuracy,status
BK001,2026-05-02 23:45:00,,121.4787,5.2,available
BK002,2026-05-02 23:45:30,31.2356,,6.1,available
BK003,2026-05-02 23:46:00,31.2352,121.4785,4.8,available`;

      const result = dataParser.parseBikeGPS(csvContent);
      
      expect(result).toHaveLength(1);
      expect(result[0].bike_id).toBe('BK003');
    });
  });

  describe('parseStationCapacity', () => {
    test('should parse valid JSON array', () => {
      const jsonContent = JSON.stringify([
        {
          station_id: 'ST001',
          name: '人民广场站',
          latitude: 31.2355,
          longitude: 121.4787,
          capacity: 15,
          current_bikes: 12,
          address: '上海市黄浦区人民大道120号'
        }
      ]);

      const result = dataParser.parseStationCapacity(jsonContent);
      
      expect(result).toHaveLength(1);
      expect(result[0].station_id).toBe('ST001');
      expect(result[0].name).toBe('人民广场站');
      expect(result[0].capacity).toBe(15);
    });

    test('should parse JSON with stations field', () => {
      const jsonContent = JSON.stringify({
        stations: [
          {
            station_id: 'ST001',
            name: '人民广场站',
            latitude: 31.2355,
            longitude: 121.4787,
            capacity: 15,
            current_bikes: 12
          }
        ]
      });

      const result = dataParser.parseStationCapacity(jsonContent);
      
      expect(result).toHaveLength(1);
    });

    test('should throw error for invalid JSON', () => {
      expect(() => {
        dataParser.parseStationCapacity('invalid json');
      }).toThrow('站点容量JSON解析失败');
    });

    test('should handle alternative field names', () => {
      const jsonContent = JSON.stringify([
        {
          id: 'ST001',
          station_name: '人民广场站',
          lat: 31.2355,
          lng: 121.4787,
          total_docks: 15,
          available_bikes: 12
        }
      ]);

      const result = dataParser.parseStationCapacity(jsonContent);
      
      expect(result[0].station_id).toBe('ST001');
      expect(result[0].name).toBe('人民广场站');
      expect(result[0].latitude).toBe(31.2355);
      expect(result[0].longitude).toBe(121.4787);
      expect(result[0].capacity).toBe(15);
      expect(result[0].current_bikes).toBe(12);
    });
  });

  describe('parseWorkOrders', () => {
    test('should parse valid work order CSV', () => {
      const csvContent = `work_order_id,bike_id,created_at,completed_at,status,issue_type,latitude,longitude,description
WO001,BK051,2026-05-02 14:30:00,,pending,flat_tire,31.2353,121.4786,车辆轮胎漏气
WO002,BK052,2026-05-02 15:15:00,2026-05-02 18:30:00,completed,battery_low,31.2354,121.4787,电池电量低`;

      const result = dataParser.parseWorkOrders(csvContent);
      
      expect(result).toHaveLength(2);
      expect(result[0].work_order_id).toBe('WO001');
      expect(result[0].bike_id).toBe('BK051');
      expect(result[0].status).toBe('pending');
      expect(typeof result[0].created_at).toBe('number');
      expect(result[1].completed_at).not.toBeNull();
    });
  });
});
