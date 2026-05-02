import { TemperatureParser, DoorParser, VaccineParser } from '../src/parsers';

describe('TemperatureParser', () => {
  const parser = new TemperatureParser();

  describe('parseString', () => {
    it('should parse valid CSV with Chinese headers', () => {
      const csv = `时间,冰箱ID,探头ID,温度,状态
2026-05-01 08:00:00,FRIDGE-001,PROBE-01,4.5,正常
2026-05-01 08:05:00,FRIDGE-001,PROBE-01,4.2,正常
2026-05-01 08:10:00,FRIDGE-001,PROBE-01,9.5,超温`;

      const result = parser.parseString(csv);
      
      expect(result.length).toBe(3);
      expect(result[0].temperature).toBe(4.5);
      expect(result[0].fridgeId).toBe('FRIDGE-001');
      expect(result[0].probeId).toBe('PROBE-01');
      expect(result[0].isValid).toBe(true);
    });

    it('should parse invalid temperature as invalid', () => {
      const csv = `时间,冰箱ID,探头ID,温度,状态
2026-05-01 08:00:00,FRIDGE-001,PROBE-01,ERROR,异常
2026-05-01 08:05:00,FRIDGE-001,PROBE-01,-,异常
2026-05-01 08:10:00,FRIDGE-001,PROBE-01,N/A,异常`;

      const result = parser.parseString(csv);
      
      expect(result.length).toBeGreaterThan(0);
      result.forEach(r => {
        expect(r.isValid).toBe(false);
      });
    });

    it('should parse different time formats', () => {
      const csv = `时间,冰箱ID,探头ID,温度,状态
2026年05月01日 08时00分00秒,FRIDGE-001,PROBE-01,4.5,正常
2026-05-01 08:05:00,FRIDGE-001,PROBE-01,4.2,正常
05/01/2026 08:10:00,FRIDGE-001,PROBE-01,4.8,正常`;

      const result = parser.parseString(csv);
      
      expect(result.length).toBe(3);
      result.forEach(r => {
        expect(r.timestamp).toBeInstanceOf(Date);
        expect(r.isValid).toBe(true);
      });
    });
  });
});

describe('DoorParser', () => {
  const parser = new DoorParser();

  describe('parseString', () => {
    it('should parse door events', () => {
      const csv = `时间,冰箱ID,事件,持续时间(分钟),操作员
2026-05-01 09:00:00,FRIDGE-001,开门,2,张护士
2026-05-01 09:02:00,FRIDGE-001,关门,2,张护士
2026-05-01 14:30:00,FRIDGE-001,开门,45,李医生
2026-05-01 15:15:00,FRIDGE-001,关门,45,李医生`;

      const result = parser.parseString(csv);
      
      expect(result.length).toBe(4);
      
      const openEvents = result.filter(r => r.eventType === 'open');
      const closeEvents = result.filter(r => r.eventType === 'close');
      
      expect(openEvents.length).toBe(2);
      expect(closeEvents.length).toBe(2);
      expect(openEvents[0].fridgeId).toBe('FRIDGE-001');
      expect(openEvents[0].operator).toBe('张护士');
    });

    it('should parse open/close in Chinese', () => {
      const csv = `时间,冰箱ID,事件,持续时间(分钟),操作员
2026-05-01 09:00:00,FRIDGE-001,开门,5,测试员
2026-05-01 09:05:00,FRIDGE-001,关门,5,测试员`;

      const result = parser.parseString(csv);
      
      expect(result.length).toBe(2);
      expect(result[0].eventType).toBe('open');
      expect(result[1].eventType).toBe('close');
    });
  });
});

describe('VaccineParser', () => {
  const parser = new VaccineParser();

  describe('parseString', () => {
    it('should parse vaccine batches', () => {
      const csv = `批次号,疫苗名称,生产厂家,数量,最低温度,最高温度,有效期开始,有效期结束,冰箱ID,入库日期,出库日期,目标冰箱,备注
VAC-2026-001,新冠灭活疫苗,中生集团,100,2,8,2026-01-01,2026-12-31,FRIDGE-001,2026-04-01,,,常规库存
VAC-2026-002,乙肝疫苗,康泰生物,50,2,8,2025-06-01,2027-05-31,FRIDGE-001,2026-03-15,,,儿童接种专用`;

      const result = parser.parseString(csv);
      
      expect(result.length).toBe(2);
      expect(result[0].batchId).toBe('VAC-2026-001');
      expect(result[0].vaccineName).toBe('新冠灭活疫苗');
      expect(result[0].quantity).toBe(100);
      expect(result[0].minTemp).toBe(2);
      expect(result[0].maxTemp).toBe(8);
      expect(result[0].fridgeId).toBe('FRIDGE-001');
    });

    it('should parse batch with transfer information', () => {
      const csv = `批次号,疫苗名称,生产厂家,数量,最低温度,最高温度,有效期开始,有效期结束,冰箱ID,入库日期,出库日期,目标冰箱,备注
VAC-2026-003,流感疫苗,华兰生物,80,2,8,2025-09-01,2026-08-31,FRIDGE-002,2026-02-20,2026-05-02,FRIDGE-001,跨冰箱转移`;

      const result = parser.parseString(csv);
      
      expect(result.length).toBe(1);
      expect(result[0].exitDate).toBeDefined();
      expect(result[0].targetFridgeId).toBe('FRIDGE-001');
    });
  });
});
