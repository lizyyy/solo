const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const moment = require('moment');

const upload = multer({ storage: multer.memoryStorage() });

function parseCsvBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer.toString('utf8'));
    
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

router.post('/plots', upload.single('file'), async (req, res) => {
  const db = req.app.locals.db;
  if (!req.file) {
    return res.status(400).json({ error: '请上传 CSV 文件' });
  }

  try {
    const data = await parseCsvBuffer(req.file.buffer);
    const transaction = db.transaction(() => {
      const inserted = [];
      data.forEach((row, index) => {
        const farmer_name = row['农户姓名'] || row['farmer_name'] || row.farmer_name;
        const plot_name = row['地块名称'] || row['plot_name'] || row.plot_name;
        const area = parseFloat(row['面积(亩)'] || row['area'] || row.area) || 0;
        const location = row['位置'] || row['location'] || row.location || '';
        const crop_type = row['作物类型'] || row['crop_type'] || row.crop_type || '';

        if (farmer_name && plot_name) {
          const result = db.prepare(`
            INSERT INTO plots (farmer_name, plot_name, area, location, crop_type)
            VALUES (?, ?, ?, ?, ?)
          `).run(farmer_name, plot_name, area, location, crop_type);
          inserted.push({ row: index + 1, id: result.lastInsertRowid });
        }
      });
      return inserted;
    });

    const inserted = transaction();
    res.json({ message: `成功导入 ${inserted.length} 条地块记录`, count: inserted.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/machines', upload.single('file'), async (req, res) => {
  const db = req.app.locals.db;
  if (!req.file) {
    return res.status(400).json({ error: '请上传 CSV 文件' });
  }

  try {
    const data = await parseCsvBuffer(req.file.buffer);
    const transaction = db.transaction(() => {
      const inserted = [];
      data.forEach((row, index) => {
        const machine_name = row['机具名称'] || row['machine_name'] || row.machine_name;
        const machine_type = row['机具类型'] || row['machine_type'] || row.machine_type || '';
        const license_plate = row['车牌号'] || row['license_plate'] || row.license_plate || '';
        const last_maintenance = row['上次保养日期'] || row['last_maintenance'] || row.last_maintenance || null;
        const maintenance_interval_days = parseInt(row['保养间隔(天)'] || row['maintenance_interval_days'] || row.maintenance_interval_days) || 90;
        const status = row['状态'] || row['status'] || row.status || 'active';

        if (machine_name) {
          const result = db.prepare(`
            INSERT INTO machines (machine_name, machine_type, license_plate, last_maintenance, maintenance_interval_days, status)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(machine_name, machine_type, license_plate, last_maintenance, maintenance_interval_days, status);
          inserted.push({ row: index + 1, id: result.lastInsertRowid });
        }
      });
      return inserted;
    });

    const inserted = transaction();
    res.json({ message: `成功导入 ${inserted.length} 条机具记录`, count: inserted.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/operators', upload.single('file'), async (req, res) => {
  const db = req.app.locals.db;
  if (!req.file) {
    return res.status(400).json({ error: '请上传 CSV 文件' });
  }

  try {
    const data = await parseCsvBuffer(req.file.buffer);
    const transaction = db.transaction(() => {
      const inserted = [];
      data.forEach((row, index) => {
        const operator_name = row['机手姓名'] || row['operator_name'] || row.operator_name;
        const id_card = row['身份证号'] || row['id_card'] || row.id_card || '';
        const license_type = row['驾驶证类型'] || row['license_type'] || row.license_type || '';
        const license_number = row['驾驶证号'] || row['license_number'] || row.license_number || '';
        const license_expiry = row['驾驶证到期日期'] || row['license_expiry'] || row.license_expiry || null;
        const phone = row['联系电话'] || row['phone'] || row.phone || '';

        if (operator_name) {
          const result = db.prepare(`
            INSERT INTO operators (operator_name, id_card, license_type, license_number, license_expiry, phone)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(operator_name, id_card, license_type, license_number, license_expiry, phone);
          inserted.push({ row: index + 1, id: result.lastInsertRowid });
        }
      });
      return inserted;
    });

    const inserted = transaction();
    res.json({ message: `成功导入 ${inserted.length} 条机手记录`, count: inserted.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/reservations', upload.single('file'), async (req, res) => {
  const db = req.app.locals.db;
  if (!req.file) {
    return res.status(400).json({ error: '请上传 CSV 文件' });
  }

  try {
    const data = await parseCsvBuffer(req.file.buffer);
    const transaction = db.transaction(() => {
      const inserted = [];
      const plots = db.prepare('SELECT id, plot_name FROM plots').all();
      const machines = db.prepare('SELECT id, machine_name FROM machines').all();
      const operators = db.prepare('SELECT id, operator_name FROM operators').all();

      const plotMap = new Map(plots.map(p => [p.plot_name, p.id]));
      const machineMap = new Map(machines.map(m => [m.machine_name, m.id]));
      const operatorMap = new Map(operators.map(o => [o.operator_name, o.id]));

      data.forEach((row, index) => {
        const plot_name = row['地块名称'] || row['plot_name'] || row.plot_name;
        const machine_name = row['机具名称'] || row['machine_name'] || row.machine_name;
        const operator_name = row['机手姓名'] || row['operator_name'] || row.operator_name;
        const start_time = row['开始时间'] || row['start_time'] || row.start_time;
        const end_time = row['结束时间'] || row['end_time'] || row.end_time;
        const work_type = row['作业类型'] || row['work_type'] || row.work_type || '';

        const plot_id = plotMap.get(plot_name);
        const machine_id = machineMap.get(machine_name);
        const operator_id = operator_name ? operatorMap.get(operator_name) : null;

        if (plot_id && machine_id && start_time && end_time) {
          const result = db.prepare(`
            INSERT INTO reservations (plot_id, machine_id, operator_id, start_time, end_time, work_type, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
          `).run(plot_id, machine_id, operator_id, start_time, end_time, work_type);
          inserted.push({ row: index + 1, id: result.lastInsertRowid });
        }
      });
      return inserted;
    });

    const inserted = transaction();
    res.json({ message: `成功导入 ${inserted.length} 条预约记录`, count: inserted.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/subsidies', upload.single('file'), async (req, res) => {
  const db = req.app.locals.db;
  if (!req.file) {
    return res.status(400).json({ error: '请上传 CSV 文件' });
  }

  try {
    const data = await parseCsvBuffer(req.file.buffer);
    const transaction = db.transaction(() => {
      const inserted = [];
      const plots = db.prepare('SELECT id, plot_name FROM plots').all();
      const plotMap = new Map(plots.map(p => [p.plot_name, p.id]));

      data.forEach((row, index) => {
        const plot_name = row['地块名称'] || row['plot_name'] || row.plot_name;
        const subsidy_amount = parseFloat(row['补贴金额(元)'] || row['subsidy_amount'] || row.subsidy_amount) || 0;
        const fuel_consumption = parseFloat(row['油耗(L)'] || row['fuel_consumption'] || row.fuel_consumption) || null;
        const subsidy_date = row['补贴日期'] || row['subsidy_date'] || row.subsidy_date || null;
        const status = row['状态'] || row['status'] || row.status || 'pending';

        const plot_id = plotMap.get(plot_name);

        if (plot_id && subsidy_amount > 0) {
          const result = db.prepare(`
            INSERT INTO oil_subsidies (plot_id, subsidy_amount, fuel_consumption, subsidy_date, status)
            VALUES (?, ?, ?, ?, ?)
          `).run(plot_id, subsidy_amount, fuel_consumption, subsidy_date, status);
          inserted.push({ row: index + 1, id: result.lastInsertRowid });
        }
      });
      return inserted;
    });

    const inserted = transaction();
    res.json({ message: `成功导入 ${inserted.length} 条油料补贴记录`, count: inserted.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sample', async (req, res) => {
  const db = req.app.locals.db;
  
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM oil_subsidies').run();
    db.prepare('DELETE FROM risk_assessments').run();
    db.prepare('DELETE FROM reservations').run();
    db.prepare('DELETE FROM plots').run();
    db.prepare('DELETE FROM machines').run();
    db.prepare('DELETE FROM operators').run();
    db.prepare('DELETE FROM audit_logs').run();

    const plot1 = db.prepare(`
      INSERT INTO plots (farmer_name, plot_name, area, location, crop_type)
      VALUES ('张三', '东河村1号地', 50.5, '东河村东侧', '小麦')
    `).run().lastInsertRowid;

    const plot2 = db.prepare(`
      INSERT INTO plots (farmer_name, plot_name, area, location, crop_type)
      VALUES ('李四', '西坡村2号地', 35.2, '西坡村南', '玉米')
    `).run().lastInsertRowid;

    const plot3 = db.prepare(`
      INSERT INTO plots (farmer_name, plot_name, area, location, crop_type)
      VALUES ('王五', '北岗村3号地', 80.0, '北岗村北', '水稻')
    `).run().lastInsertRowid;

    const machine1 = db.prepare(`
      INSERT INTO machines (machine_name, machine_type, license_plate, last_maintenance, maintenance_interval_days, status)
      VALUES ('东方红-1', '拖拉机', '鲁A12345', date('now', '-100 days'), 90, 'active')
    `).run().lastInsertRowid;

    const machine2 = db.prepare(`
      INSERT INTO machines (machine_name, machine_type, license_plate, last_maintenance, maintenance_interval_days, status)
      VALUES ('东方红-2', '拖拉机', '鲁A12346', date('now', '-30 days'), 90, 'active')
    `).run().lastInsertRowid;

    const machine3 = db.prepare(`
      INSERT INTO machines (machine_name, machine_type, license_plate, last_maintenance, maintenance_interval_days, status)
      VALUES ('久保田-1', '收割机', '鲁A12347', date('now', '-60 days'), 90, 'active')
    `).run().lastInsertRowid;

    const operator1 = db.prepare(`
      INSERT INTO operators (operator_name, id_card, license_type, license_number, license_expiry, phone)
      VALUES ('赵师傅', '370101198001011234', 'G1', '370101202001011234', date('now', '-10 days'), '13800138001')
    `).run().lastInsertRowid;

    const operator2 = db.prepare(`
      INSERT INTO operators (operator_name, id_card, license_type, license_number, license_expiry, phone)
      VALUES ('钱师傅', '370101198502022345', 'G1', '370101202001012345', date('now', '+180 days'), '13800138002')
    `).run().lastInsertRowid;

    const operator3 = db.prepare(`
      INSERT INTO operators (operator_name, id_card, license_type, license_number, license_expiry, phone)
      VALUES ('孙师傅', '370101199003033456', 'G2', '370101202001013456', date('now', '+365 days'), '13800138003')
    `).run().lastInsertRowid;

    const reservation1 = db.prepare(`
      INSERT INTO reservations (plot_id, machine_id, operator_id, start_time, end_time, work_type, status)
      VALUES (?, ?, ?, datetime('now', '+1 day', '+8 hours'), datetime('now', '+1 day', '+12 hours'), '耕地', 'pending')
    `).run(plot1, machine1, operator1).lastInsertRowid;

    const reservation2 = db.prepare(`
      INSERT INTO reservations (plot_id, machine_id, operator_id, start_time, end_time, work_type, status)
      VALUES (?, ?, ?, datetime('now', '+1 day', '+9 hours'), datetime('now', '+1 day', '+11 hours'), '播种', 'pending')
    `).run(plot2, machine1, operator2).lastInsertRowid;

    const reservation3 = db.prepare(`
      INSERT INTO reservations (plot_id, machine_id, operator_id, start_time, end_time, work_type, status)
      VALUES (?, ?, ?, datetime('now', '+2 days', '+8 hours'), datetime('now', '+2 days', '+14 hours'), '收割', 'pending')
    `).run(plot3, machine3, operator3).lastInsertRowid;

    const reservation4 = db.prepare(`
      INSERT INTO reservations (plot_id, machine_id, operator_id, start_time, end_time, work_type, status)
      VALUES (?, ?, ?, datetime('now', '+3 days', '+8 hours'), datetime('now', '+3 days', '+12 hours'), '耕地', 'pending')
    `).run(plot1, machine2, operator2).lastInsertRowid;

    db.prepare(`
      INSERT INTO oil_subsidies (plot_id, reservation_id, subsidy_amount, fuel_consumption, subsidy_date, status)
      VALUES (?, ?, 500.0, 100.0, date('now'), 'approved')
    `).run(plot1, reservation1);

    db.prepare(`
      INSERT INTO oil_subsidies (plot_id, reservation_id, subsidy_amount, fuel_consumption, subsidy_date, status)
      VALUES (?, ?, 300.0, 60.0, date('now'), 'approved')
    `).run(plot2, reservation2);

    db.prepare(`
      INSERT INTO oil_subsidies (plot_id, reservation_id, subsidy_amount, fuel_consumption, subsidy_date, status)
      VALUES (?, ?, 50.0, 10.0, date('now'), 'pending')
    `).run(plot3, null);

    return { plots: 3, machines: 3, operators: 3, reservations: 4, subsidies: 3 };
  });

  try {
    const result = transaction();
    res.json({ message: '示例数据导入成功', data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
