import { addMinutes, parseISO } from 'date-fns';
import { TemperatureRecord, DoorRecord, VaccineBatch } from '../types';

export function generateSampleTemperatureRecords(): TemperatureRecord[] {
  const records: TemperatureRecord[] = [];
  
  const baseDate = parseISO('2026-05-01T08:00:00');
  
  for (let i = 0; i < 288; i++) {
    const timestamp = addMinutes(baseDate, i * 5);
    let temp = 4.5 + (Math.random() - 0.5) * 1.0;
    let isValid = true;
    
    if (i >= 50 && i <= 70) {
      temp = 10 + (Math.random() - 0.5) * 2;
    }
    
    if (i >= 100 && i <= 105) {
      temp = -99;
      isValid = false;
    }
    
    if (i >= 150 && i <= 160) {
      temp = 0.5 + (Math.random() - 0.5) * 1.0;
    }
    
    if (i === 180) {
      temp = 4.0;
    } else if (i === 181) {
      temp = 8.0;
    } else if (i === 182) {
      temp = 3.5;
    }

    records.push({
      timestamp,
      fridgeId: 'FRIDGE-001',
      probeId: 'PROBE-01',
      temperature: temp,
      isValid,
      rawValue: temp.toString(),
    });
  }

  for (let i = 0; i < 288; i++) {
    const timestamp = addMinutes(baseDate, i * 5);
    let temp = 5.0 + (Math.random() - 0.5) * 0.8;
    let isValid = true;
    
    if (i >= 200 && i <= 240) {
      temp = -100;
      isValid = false;
    }

    records.push({
      timestamp,
      fridgeId: 'FRIDGE-002',
      probeId: 'PROBE-02',
      temperature: temp,
      isValid,
      rawValue: isValid ? temp.toString() : 'ERROR',
    });
  }

  return records;
}

export function generateSampleDoorRecords(): DoorRecord[] {
  const baseDate = parseISO('2026-05-01T08:00:00');
  
  return [
    {
      timestamp: addMinutes(baseDate, 60),
      fridgeId: 'FRIDGE-001',
      eventType: 'open',
      duration: 2,
      operator: '张护士',
    },
    {
      timestamp: addMinutes(baseDate, 62),
      fridgeId: 'FRIDGE-001',
      eventType: 'close',
      duration: 2,
      operator: '张护士',
    },
    {
      timestamp: addMinutes(baseDate, 250),
      fridgeId: 'FRIDGE-001',
      eventType: 'open',
      duration: 45,
      operator: '李医生',
    },
    {
      timestamp: addMinutes(baseDate, 295),
      fridgeId: 'FRIDGE-001',
      eventType: 'close',
      duration: 45,
      operator: '李医生',
    },
    {
      timestamp: addMinutes(baseDate, 120),
      fridgeId: 'FRIDGE-002',
      eventType: 'open',
      duration: 3,
      operator: '王护士',
    },
    {
      timestamp: addMinutes(baseDate, 123),
      fridgeId: 'FRIDGE-002',
      eventType: 'close',
      duration: 3,
      operator: '王护士',
    },
  ];
}

export function generateSampleVaccineBatches(): VaccineBatch[] {
  const baseDate = parseISO('2026-05-01T00:00:00');
  
  return [
    {
      batchId: 'VAC-2026-001',
      vaccineName: '新冠灭活疫苗',
      manufacturer: '中生集团',
      quantity: 100,
      minTemp: 2,
      maxTemp: 8,
      validFrom: parseISO('2026-01-01T00:00:00'),
      validTo: parseISO('2026-12-31T23:59:59'),
      fridgeId: 'FRIDGE-001',
      entryDate: parseISO('2026-04-01T09:00:00'),
      notes: '常规库存',
    },
    {
      batchId: 'VAC-2026-002',
      vaccineName: '乙肝疫苗',
      manufacturer: '康泰生物',
      quantity: 50,
      minTemp: 2,
      maxTemp: 8,
      validFrom: parseISO('2025-06-01T00:00:00'),
      validTo: parseISO('2027-05-31T23:59:59'),
      fridgeId: 'FRIDGE-001',
      entryDate: parseISO('2026-03-15T10:30:00'),
      notes: '儿童接种专用',
    },
    {
      batchId: 'VAC-2026-003',
      vaccineName: '流感疫苗',
      manufacturer: '华兰生物',
      quantity: 80,
      minTemp: 2,
      maxTemp: 8,
      validFrom: parseISO('2025-09-01T00:00:00'),
      validTo: parseISO('2026-08-31T23:59:59'),
      fridgeId: 'FRIDGE-002',
      entryDate: parseISO('2026-02-20T14:00:00'),
      exitDate: addMinutes(baseDate, 1000),
      targetFridgeId: 'FRIDGE-001',
      notes: '跨冰箱转移',
    },
  ];
}

export function generateSampleCSVContent(): {
  temperature: string;
  door: string;
  vaccine: string;
} {
  const baseDate = '2026-05-01';
  
  const tempLines: string[] = [];
  tempLines.push('时间,冰箱ID,探头ID,温度,状态');
  
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
      const timeStr = `${baseDate} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
      let temp = (4 + Math.random() * 2).toFixed(1);
      let status = '正常';
      
      if (hour === 12 && minute >= 10 && minute <= 50) {
        temp = (9 + Math.random() * 2).toFixed(1);
        status = '超温';
      }
      
      if (hour === 16 && minute >= 20 && minute <= 40) {
        temp = 'ERROR';
        status = '异常';
      }
      
      if (hour === 20 && minute >= 30 && minute <= 50) {
        temp = (0.5 + Math.random()).toFixed(1);
        status = '低温';
      }
      
      tempLines.push(`${timeStr},FRIDGE-001,PROBE-01,${temp},${status}`);
    }
  }

  const doorLines: string[] = [];
  doorLines.push('时间,冰箱ID,事件,持续时间(分钟),操作员');
  doorLines.push(`${baseDate} 09:00:00,FRIDGE-001,开门,2,张护士`);
  doorLines.push(`${baseDate} 09:02:00,FRIDGE-001,关门,2,张护士`);
  doorLines.push(`${baseDate} 14:30:00,FRIDGE-001,开门,45,李医生`);
  doorLines.push(`${baseDate} 15:15:00,FRIDGE-001,关门,45,李医生`);
  doorLines.push(`${baseDate} 10:00:00,FRIDGE-002,开门,3,王护士`);
  doorLines.push(`${baseDate} 10:03:00,FRIDGE-002,关门,3,王护士`);

  const vaccineLines: string[] = [];
  vaccineLines.push('批次号,疫苗名称,生产厂家,数量,最低温度,最高温度,有效期开始,有效期结束,冰箱ID,入库日期,出库日期,目标冰箱,备注');
  vaccineLines.push('VAC-2026-001,新冠灭活疫苗,中生集团,100,2,8,2026-01-01,2026-12-31,FRIDGE-001,2026-04-01,,,常规库存');
  vaccineLines.push('VAC-2026-002,乙肝疫苗,康泰生物,50,2,8,2025-06-01,2027-05-31,FRIDGE-001,2026-03-15,,,儿童接种专用');
  vaccineLines.push('VAC-2026-003,流感疫苗,华兰生物,80,2,8,2025-09-01,2026-08-31,FRIDGE-002,2026-02-20,2026-05-02,FRIDGE-001,跨冰箱转移');

  return {
    temperature: tempLines.join('\n'),
    door: doorLines.join('\n'),
    vaccine: vaccineLines.join('\n'),
  };
}
