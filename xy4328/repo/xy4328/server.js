const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { runAsync, getAsync, allAsync } = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function isDateValid(dateStr) {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function getCurrentDateTime() {
  return formatDate(new Date());
}

function getPackageStatus(pkg, cycle, distribution) {
  const now = new Date();
  const validUntil = new Date(pkg.valid_until);
  const issues = [];

  if (!cycle) {
    issues.push('锅次不存在');
    return { status: '异常', issues, color: 'danger' };
  }

  if (!cycle.is_qualified) {
    issues.push('锅次不合格');
  }

  if (validUntil < now) {
    issues.push('已过期');
  }

  if (distribution) {
    if (pkg.release_time) {
      const releaseTime = new Date(pkg.release_time);
      const distributionTime = new Date(distribution.distribution_time);
      if (distributionTime < releaseTime) {
        issues.push('领用时间早于放行时间');
      }
    }
  }

  if (issues.length > 0) {
    return { status: '异常', issues, color: 'danger' };
  }

  if (pkg.status === '已放行') {
    if (distribution) {
      return { status: '已领用', issues: [], color: 'success' };
    }
    return { status: '已放行', issues: [], color: 'info' };
  }

  return { status: '待放行', issues: [], color: 'warning' };
}

app.get('/api/cycles', async (req, res) => {
  try {
    const cycles = await allAsync('SELECT * FROM sterilization_cycles ORDER BY sterilization_date DESC');
    res.json({ success: true, data: cycles });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.get('/api/cycles/:cycleNumber', async (req, res) => {
  try {
    const cycle = await getAsync('SELECT * FROM sterilization_cycles WHERE cycle_number = ?', [req.params.cycleNumber]);
    if (cycle) {
      res.json({ success: true, data: cycle });
    } else {
      res.json({ success: false, message: '锅次不存在' });
    }
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.post('/api/cycles', async (req, res) => {
  try {
    const { cycle_number, sterilization_date, physical_monitor, chemical_monitor, biological_monitor } = req.body;

    if (!cycle_number || !sterilization_date) {
      return res.json({ success: false, message: '锅次号和灭菌日期为必填项' });
    }

    if (!isDateValid(sterilization_date)) {
      return res.json({ success: false, message: '日期格式无效' });
    }

    const existing = await getAsync('SELECT * FROM sterilization_cycles WHERE cycle_number = ?', [cycle_number]);
    if (existing) {
      return res.json({ success: false, message: '锅次号已存在' });
    }

    const is_qualified = (physical_monitor === '合格' || physical_monitor === '通过') &&
                         (chemical_monitor === '合格' || chemical_monitor === '通过') &&
                         (biological_monitor === '合格' || biological_monitor === '通过') ? 1 : 0;

    await runAsync(`
      INSERT INTO sterilization_cycles (cycle_number, sterilization_date, physical_monitor, chemical_monitor, biological_monitor, is_qualified)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [cycle_number, sterilization_date, physical_monitor, chemical_monitor, biological_monitor, is_qualified]);

    res.json({ success: true, message: '锅次添加成功' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.put('/api/cycles/:id', async (req, res) => {
  try {
    const { cycle_number, sterilization_date, physical_monitor, chemical_monitor, biological_monitor } = req.body;

    if (!cycle_number || !sterilization_date) {
      return res.json({ success: false, message: '锅次号和灭菌日期为必填项' });
    }

    const existing = await getAsync('SELECT * FROM sterilization_cycles WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.json({ success: false, message: '锅次不存在' });
    }

    const duplicate = await getAsync('SELECT * FROM sterilization_cycles WHERE cycle_number = ? AND id != ?', [cycle_number, req.params.id]);
    if (duplicate) {
      return res.json({ success: false, message: '锅次号已存在' });
    }

    const is_qualified = (physical_monitor === '合格' || physical_monitor === '通过') &&
                         (chemical_monitor === '合格' || chemical_monitor === '通过') &&
                         (biological_monitor === '合格' || biological_monitor === '通过') ? 1 : 0;

    await runAsync(`
      UPDATE sterilization_cycles 
      SET cycle_number = ?, sterilization_date = ?, physical_monitor = ?, chemical_monitor = ?, biological_monitor = ?, is_qualified = ?
      WHERE id = ?
    `, [cycle_number, sterilization_date, physical_monitor, chemical_monitor, biological_monitor, is_qualified, req.params.id]);

    if (!is_qualified) {
      const packages = await allAsync('SELECT * FROM instrument_packages WHERE cycle_number = ?', [cycle_number]);
      for (const pkg of packages) {
        await runAsync('UPDATE instrument_packages SET status = ? WHERE id = ?', ['待放行', pkg.id]);
      }
    }

    res.json({ success: true, message: '锅次更新成功' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.get('/api/packages', async (req, res) => {
  try {
    const { barcode, department, status } = req.query;
    
    let query = `
      SELECT p.*, c.is_qualified as cycle_qualified, c.physical_monitor, c.chemical_monitor, c.biological_monitor,
             d.department, d.receiver, d.distribution_time
      FROM instrument_packages p
      LEFT JOIN sterilization_cycles c ON p.cycle_number = c.cycle_number
      LEFT JOIN distribution_records d ON p.barcode = d.package_barcode
    `;
    const conditions = [];
    const params = [];

    if (barcode) {
      conditions.push('p.barcode LIKE ?');
      params.push(`%${barcode}%`);
    }

    if (department) {
      conditions.push('d.department LIKE ?');
      params.push(`%${department}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY p.created_at DESC';

    const packages = await allAsync(query, params);

    const result = packages.map(pkg => {
      const cycle = {
        is_qualified: pkg.cycle_qualified,
        physical_monitor: pkg.physical_monitor,
        chemical_monitor: pkg.chemical_monitor,
        biological_monitor: pkg.biological_monitor
      };
      const distribution = pkg.department ? {
        department: pkg.department,
        receiver: pkg.receiver,
        distribution_time: pkg.distribution_time
      } : null;

      const statusInfo = getPackageStatus(pkg, cycle, distribution);
      return {
        ...pkg,
        computed_status: statusInfo.status,
        issues: statusInfo.issues,
        status_color: statusInfo.color
      };
    });

    let filteredResult = result;
    if (status) {
      if (status === '异常') {
        filteredResult = result.filter(p => p.computed_status === '异常');
      } else {
        filteredResult = result.filter(p => p.computed_status === status);
      }
    }

    res.json({ success: true, data: filteredResult });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.post('/api/packages', async (req, res) => {
  try {
    const { barcode, package_name, cycle_number, valid_until } = req.body;

    if (!barcode || !package_name || !cycle_number || !valid_until) {
      return res.json({ success: false, message: '所有字段为必填项' });
    }

    if (!isDateValid(valid_until)) {
      return res.json({ success: false, message: '有效期格式无效' });
    }

    const existing = await getAsync('SELECT * FROM instrument_packages WHERE barcode = ?', [barcode]);
    if (existing) {
      return res.json({ success: false, message: '条码已存在' });
    }

    const cycle = await getAsync('SELECT * FROM sterilization_cycles WHERE cycle_number = ?', [cycle_number]);
    if (!cycle) {
      return res.json({ success: false, message: '锅次不存在，请先添加锅次' });
    }

    await runAsync(`
      INSERT INTO instrument_packages (barcode, package_name, cycle_number, valid_until)
      VALUES (?, ?, ?, ?)
    `, [barcode, package_name, cycle_number, valid_until]);

    res.json({ success: true, message: '器械包添加成功' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.put('/api/packages/:id', async (req, res) => {
  try {
    const { barcode, package_name, cycle_number, valid_until } = req.body;

    if (!barcode || !package_name || !cycle_number || !valid_until) {
      return res.json({ success: false, message: '所有字段为必填项' });
    }

    const existing = await getAsync('SELECT * FROM instrument_packages WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.json({ success: false, message: '器械包不存在' });
    }

    const duplicate = await getAsync('SELECT * FROM instrument_packages WHERE barcode = ? AND id != ?', [barcode, req.params.id]);
    if (duplicate) {
      return res.json({ success: false, message: '条码已存在' });
    }

    const cycle = await getAsync('SELECT * FROM sterilization_cycles WHERE cycle_number = ?', [cycle_number]);
    if (!cycle) {
      return res.json({ success: false, message: '锅次不存在' });
    }

    await runAsync(`
      UPDATE instrument_packages 
      SET barcode = ?, package_name = ?, cycle_number = ?, valid_until = ?
      WHERE id = ?
    `, [barcode, package_name, cycle_number, valid_until, req.params.id]);

    res.json({ success: true, message: '器械包更新成功' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.post('/api/packages/:id/release', async (req, res) => {
  try {
    const pkg = await getAsync('SELECT * FROM instrument_packages WHERE id = ?', [req.params.id]);
    if (!pkg) {
      return res.json({ success: false, message: '器械包不存在' });
    }

    const cycle = await getAsync('SELECT * FROM sterilization_cycles WHERE cycle_number = ?', [pkg.cycle_number]);
    if (!cycle) {
      return res.json({ success: false, message: '锅次不存在' });
    }

    if (!cycle.is_qualified) {
      return res.json({ success: false, message: '锅次不合格，无法放行' });
    }

    const validUntil = new Date(pkg.valid_until);
    const now = new Date();
    if (validUntil < now) {
      return res.json({ success: false, message: '器械包已过期，无法放行' });
    }

    const releaseTime = getCurrentDateTime();
    await runAsync('UPDATE instrument_packages SET status = ?, release_time = ? WHERE id = ?', ['已放行', releaseTime, req.params.id]);

    res.json({ success: true, message: '放行成功', release_time: releaseTime });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.get('/api/distributions', async (req, res) => {
  try {
    const distributions = await allAsync(`
      SELECT d.*, p.package_name, p.cycle_number
      FROM distribution_records d
      JOIN instrument_packages p ON d.package_barcode = p.barcode
      ORDER BY d.distribution_time DESC
    `);
    res.json({ success: true, data: distributions });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.post('/api/distributions', async (req, res) => {
  try {
    const { package_barcode, department, receiver, distribution_time } = req.body;

    if (!package_barcode || !department) {
      return res.json({ success: false, message: '条码和科室为必填项' });
    }

    const pkg = await getAsync('SELECT * FROM instrument_packages WHERE barcode = ?', [package_barcode]);
    if (!pkg) {
      return res.json({ success: false, message: '器械包不存在' });
    }

    if (pkg.status !== '已放行') {
      return res.json({ success: false, message: '器械包未放行，无法领用' });
    }

    const existingDist = await getAsync('SELECT * FROM distribution_records WHERE package_barcode = ?', [package_barcode]);
    if (existingDist) {
      return res.json({ success: false, message: '该器械包已被领用' });
    }

    const distTime = distribution_time || getCurrentDateTime();

    if (pkg.release_time) {
      const releaseTime = new Date(pkg.release_time);
      const checkDistTime = new Date(distTime);
      if (checkDistTime < releaseTime) {
        return res.json({ success: false, message: '领用时间不能早于放行时间' });
      }
    }

    await runAsync(`
      INSERT INTO distribution_records (package_barcode, department, receiver, distribution_time)
      VALUES (?, ?, ?, ?)
    `, [package_barcode, department, receiver, distTime]);

    res.json({ success: true, message: '领用记录添加成功' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.post('/api/import/cycles', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, message: '请选择文件' });
    }

    const results = [];
    const errors = [];
    let rowCount = 0;

    const processRow = async (row) => {
      rowCount++;
      try {
        const cycle_number = row['锅次号'] || row['cycle_number'] || row.cycle_number;
        const sterilization_date = row['灭菌日期'] || row['sterilization_date'] || row.sterilization_date;
        const physical_monitor = row['物理监测'] || row['physical_monitor'] || row.physical_monitor;
        const chemical_monitor = row['化学监测'] || row['chemical_monitor'] || row.chemical_monitor;
        const biological_monitor = row['生物监测'] || row['biological_monitor'] || row.biological_monitor;

        if (!cycle_number || !sterilization_date) {
          errors.push(`行 ${rowCount}: 缺少锅次号或灭菌日期`);
          return;
        }

        const is_qualified = (physical_monitor === '合格' || physical_monitor === '通过') &&
                             (chemical_monitor === '合格' || chemical_monitor === '通过') &&
                             (biological_monitor === '合格' || biological_monitor === '通过') ? 1 : 0;

        const existing = await getAsync('SELECT * FROM sterilization_cycles WHERE cycle_number = ?', [cycle_number]);
        if (existing) {
          await runAsync(`
            UPDATE sterilization_cycles 
            SET sterilization_date = ?, physical_monitor = ?, chemical_monitor = ?, biological_monitor = ?, is_qualified = ?
            WHERE cycle_number = ?
          `, [sterilization_date, physical_monitor, chemical_monitor, biological_monitor, is_qualified, cycle_number]);
        } else {
          await runAsync(`
            INSERT INTO sterilization_cycles (cycle_number, sterilization_date, physical_monitor, chemical_monitor, biological_monitor, is_qualified)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [cycle_number, sterilization_date, physical_monitor, chemical_monitor, biological_monitor, is_qualified]);
        }

        results.push(cycle_number);
      } catch (e) {
        errors.push(`行 ${rowCount}: ${e.message}`);
      }
    };

    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    for (const row of rows) {
      await processRow(row);
    }

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `成功导入 ${results.length} 条锅次记录`,
      imported: results.length,
      errors: errors
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.post('/api/import/packages', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, message: '请选择文件' });
    }

    const results = [];
    const errors = [];
    let rowCount = 0;

    const processRow = async (row) => {
      rowCount++;
      try {
        const barcode = row['条码'] || row['barcode'] || row.barcode;
        const package_name = row['包名称'] || row['package_name'] || row.package_name;
        const cycle_number = row['锅次号'] || row['cycle_number'] || row.cycle_number;
        const valid_until = row['有效期'] || row['valid_until'] || row.valid_until;

        if (!barcode || !package_name || !cycle_number || !valid_until) {
          errors.push(`行 ${rowCount}: 缺少必填字段`);
          return;
        }

        const cycle = await getAsync('SELECT * FROM sterilization_cycles WHERE cycle_number = ?', [cycle_number]);
        if (!cycle) {
          errors.push(`行 ${rowCount}: 锅次 ${cycle_number} 不存在，请先导入锅次`);
          return;
        }

        const existing = await getAsync('SELECT * FROM instrument_packages WHERE barcode = ?', [barcode]);
        if (existing) {
          await runAsync(`
            UPDATE instrument_packages 
            SET package_name = ?, cycle_number = ?, valid_until = ?
            WHERE barcode = ?
          `, [package_name, cycle_number, valid_until, barcode]);
        } else {
          await runAsync(`
            INSERT INTO instrument_packages (barcode, package_name, cycle_number, valid_until)
            VALUES (?, ?, ?, ?)
          `, [barcode, package_name, cycle_number, valid_until]);
        }

        results.push(barcode);
      } catch (e) {
        errors.push(`行 ${rowCount}: ${e.message}`);
      }
    };

    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    for (const row of rows) {
      await processRow(row);
    }

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `成功导入 ${results.length} 条器械包记录`,
      imported: results.length,
      errors: errors
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.post('/api/import/distributions', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, message: '请选择文件' });
    }

    const results = [];
    const errors = [];
    let rowCount = 0;

    const processRow = async (row) => {
      rowCount++;
      try {
        const package_barcode = row['条码'] || row['package_barcode'] || row.package_barcode;
        const department = row['科室'] || row['department'] || row.department;
        const receiver = row['领用人'] || row['receiver'] || row.receiver;
        const distribution_time = row['领用时间'] || row['distribution_time'] || row.distribution_time || getCurrentDateTime();

        if (!package_barcode || !department) {
          errors.push(`行 ${rowCount}: 缺少条码或科室`);
          return;
        }

        const pkg = await getAsync('SELECT * FROM instrument_packages WHERE barcode = ?', [package_barcode]);
        if (!pkg) {
          errors.push(`行 ${rowCount}: 器械包 ${package_barcode} 不存在`);
          return;
        }

        if (pkg.status !== '已放行') {
          errors.push(`行 ${rowCount}: 器械包 ${package_barcode} 未放行`);
          return;
        }

        const existingDist = await getAsync('SELECT * FROM distribution_records WHERE package_barcode = ?', [package_barcode]);
        if (existingDist) {
          errors.push(`行 ${rowCount}: 器械包 ${package_barcode} 已被领用`);
          return;
        }

        await runAsync(`
          INSERT INTO distribution_records (package_barcode, department, receiver, distribution_time)
          VALUES (?, ?, ?, ?)
        `, [package_barcode, department, receiver, distribution_time]);

        results.push(package_barcode);
      } catch (e) {
        errors.push(`行 ${rowCount}: ${e.message}`);
      }
    };

    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    for (const row of rows) {
      await processRow(row);
    }

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `成功导入 ${results.length} 条领用记录`,
      imported: results.length,
      errors: errors
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.get('/api/recall', async (req, res) => {
  try {
    const { cycle_number, department, start_date, end_date } = req.query;

    let query = `
      SELECT p.*, c.is_qualified, c.physical_monitor, c.chemical_monitor, c.biological_monitor,
             d.department, d.receiver, d.distribution_time
      FROM instrument_packages p
      LEFT JOIN sterilization_cycles c ON p.cycle_number = c.cycle_number
      LEFT JOIN distribution_records d ON p.barcode = d.package_barcode
      WHERE 1=1
    `;
    const params = [];

    if (cycle_number) {
      query += ' AND p.cycle_number LIKE ?';
      params.push(`%${cycle_number}%`);
    }

    if (department) {
      query += ' AND d.department LIKE ?';
      params.push(`%${department}%`);
    }

    if (start_date) {
      query += ' AND date(d.distribution_time) >= date(?)';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND date(d.distribution_time) <= date(?)';
      params.push(end_date);
    }

    query += ' ORDER BY d.distribution_time DESC';

    const packages = await allAsync(query, params);

    const result = packages.map(pkg => {
      const cycle = {
        is_qualified: pkg.is_qualified,
        physical_monitor: pkg.physical_monitor,
        chemical_monitor: pkg.chemical_monitor,
        biological_monitor: pkg.biological_monitor
      };
      const distribution = pkg.department ? {
        department: pkg.department,
        receiver: pkg.receiver,
        distribution_time: pkg.distribution_time
      } : null;

      const statusInfo = getPackageStatus(pkg, cycle, distribution);
      return {
        ...pkg,
        computed_status: statusInfo.status,
        issues: statusInfo.issues,
        is_abnormal: statusInfo.status === '异常'
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const totalPackagesResult = await getAsync('SELECT COUNT(*) as count FROM instrument_packages');
    const totalPackages = totalPackagesResult.count;

    const totalCyclesResult = await getAsync('SELECT COUNT(*) as count FROM sterilization_cycles');
    const totalCycles = totalCyclesResult.count;

    const qualifiedCyclesResult = await getAsync('SELECT COUNT(*) as count FROM sterilization_cycles WHERE is_qualified = 1');
    const qualifiedCycles = qualifiedCyclesResult.count;

    const releasedPackagesResult = await getAsync('SELECT COUNT(*) as count FROM instrument_packages WHERE status = "已放行"');
    const releasedPackages = releasedPackagesResult.count;

    const distributedPackagesResult = await getAsync('SELECT COUNT(*) as count FROM distribution_records');
    const distributedPackages = distributedPackagesResult.count;

    const allPackages = await allAsync(`
      SELECT p.*, c.is_qualified, d.department, d.distribution_time
      FROM instrument_packages p
      LEFT JOIN sterilization_cycles c ON p.cycle_number = c.cycle_number
      LEFT JOIN distribution_records d ON p.barcode = d.package_barcode
    `);

    let abnormalCount = 0;
    const now = new Date();

    allPackages.forEach(pkg => {
      let hasIssue = false;
      if (pkg.is_qualified === 0) hasIssue = true;
      if (pkg.valid_until && new Date(pkg.valid_until) < now) hasIssue = true;
      if (hasIssue) abnormalCount++;
    });

    res.json({
      success: true,
      data: {
        totalPackages,
        totalCycles,
        qualifiedCycles,
        unqualifiedCycles: totalCycles - qualifiedCycles,
        releasedPackages,
        distributedPackages,
        abnormalCount
      }
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
