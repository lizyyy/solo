const db = require('./db');
const moment = require('moment');

const insertSampleData = () => {
  db.serialize(() => {
    const tenants = [
      { name: '北京科技有限公司', contact_person: '张三', phone: '13800138001', email: 'zhangsan@tech.com', address: 'A座101室' },
      { name: '上海贸易有限公司', contact_person: '李四', phone: '13800138002', email: 'lisi@trade.com', address: 'A座201室' },
      { name: '广州设计工作室', contact_person: '王五', phone: '13800138003', email: 'wangwu@design.com', address: 'B座301室' },
      { name: '深圳咨询公司', contact_person: '赵六', phone: '13800138004', email: 'zhaoliu@consult.com', address: 'B座401室' }
    ];

    const tenantStmt = db.prepare('INSERT INTO tenants (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)');
    tenants.forEach(t => tenantStmt.run(t.name, t.contact_person, t.phone, t.email, t.address));
    tenantStmt.finalize();

    const contracts = [
      { tenant_id: 1, contract_no: 'HT2024001', room_no: 'A101', start_date: '2024-01-01', end_date: null, monthly_rent: 15000, area: 100, share_ratio: 1 },
      { tenant_id: 2, contract_no: 'HT2024002', room_no: 'A201', start_date: '2024-01-15', end_date: '2024-06-15', monthly_rent: 12000, area: 80, share_ratio: 0.8 },
      { tenant_id: 3, contract_no: 'HT2024003', room_no: 'B301', start_date: '2024-02-01', end_date: null, monthly_rent: 8000, area: 50, share_ratio: 0.5 },
      { tenant_id: 4, contract_no: 'HT2024004', room_no: 'B401', start_date: '2024-03-01', end_date: null, monthly_rent: 20000, area: 150, share_ratio: 1.5 }
    ];

    const contractStmt = db.prepare('INSERT INTO contracts (tenant_id, contract_no, room_no, start_date, end_date, monthly_rent, area, share_ratio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    contracts.forEach(c => contractStmt.run(c.tenant_id, c.contract_no, c.room_no, c.start_date, c.end_date, c.monthly_rent, c.area, c.share_ratio));
    contractStmt.finalize();

    const meterReadings = [];
    for (let month = 1; month <= 5; month++) {
      const date = `2024-0${month}-01`;
      meterReadings.push({ contract_id: 1, reading_date: date, water_prev: (month-1)*50, water_curr: month*50, water_usage: 50, electric_prev: (month-1)*1000, electric_curr: month*1000, electric_usage: 1000, reader: '管理员' });
      meterReadings.push({ contract_id: 2, reading_date: date, water_prev: (month-1)*30, water_curr: month*30, water_usage: 30, electric_prev: (month-1)*800, electric_curr: month*800, electric_usage: 800, reader: '管理员' });
      if (month >= 2) {
        meterReadings.push({ contract_id: 3, reading_date: date, water_prev: (month-2)*20, water_curr: (month-1)*20, water_usage: 20, electric_prev: (month-2)*500, electric_curr: (month-1)*500, electric_usage: 500, reader: '管理员' });
      }
      if (month >= 3) {
        meterReadings.push({ contract_id: 4, reading_date: date, water_prev: (month-3)*60, water_curr: (month-2)*60, water_usage: 60, electric_prev: (month-3)*1200, electric_curr: (month-2)*1200, electric_usage: 1200, reader: '管理员' });
      }
    }

    const meterStmt = db.prepare('INSERT INTO meter_readings (contract_id, reading_date, water_prev, water_curr, water_usage, electric_prev, electric_curr, electric_usage, reader) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    meterReadings.forEach(m => meterStmt.run(m.contract_id, m.reading_date, m.water_prev, m.water_curr, m.water_usage, m.electric_prev, m.electric_curr, m.electric_usage, m.reader));
    meterStmt.finalize();

    const devices = [
      { contract_id: 1, device_name: '服务器机房空调', device_type: '空调', power: 5000, hours_per_day: 24, days_per_month: 30 },
      { contract_id: 1, device_name: '网络设备', device_type: '网络', power: 1000, hours_per_day: 24, days_per_month: 30 },
      { contract_id: 4, device_name: '大型打印机', device_type: '办公', power: 2000, hours_per_day: 8, days_per_month: 22 }
    ];

    const deviceStmt = db.prepare('INSERT INTO special_devices (contract_id, device_name, device_type, power, hours_per_day, days_per_month) VALUES (?, ?, ?, ?, ?, ?)');
    devices.forEach(d => deviceStmt.run(d.contract_id, d.device_name, d.device_type, d.power, d.hours_per_day, d.days_per_month));
    deviceStmt.finalize();

    console.log('演示数据插入完成');
  });
};

insertSampleData();
