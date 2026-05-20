const db = require('../config/database');
const { Parser } = require('json2csv');

const getReadingsByBatch = async (batchId, filters = {}) => {
  let query = `
    SELECT 
      mr.*,
      m.meter_no,
      m.name as meter_name,
      z.zone_code,
      z.name as zone_name
    FROM meter_readings mr
    LEFT JOIN meters m ON mr.meter_id = m.id
    LEFT JOIN temperature_zones z ON m.zone_id = z.id
    WHERE mr.batch_id = ?
  `;
  const params = [batchId];
  
  if (filters.status) {
    query += ` AND mr.status = ?`;
    params.push(filters.status);
  }
  
  if (filters.zone_id) {
    query += ` AND z.id = ?`;
    params.push(filters.zone_id);
  }
  
  if (filters.is_peak_abnormal) {
    query += ` AND mr.is_peak_abnormal = 1`;
  }
  
  if (filters.is_vacant_period) {
    query += ` AND mr.is_vacant_period = 1`;
  }
  
  query += ` ORDER BY mr.reading_date ASC`;
  
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const getContractsByZone = async (zoneId) => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        c.*,
        t.name as tenant_name,
        t.tenant_code,
        z.name as zone_name,
        z.zone_code
      FROM contracts c
      LEFT JOIN tenants t ON c.tenant_id = t.id
      LEFT JOIN temperature_zones z ON c.zone_id = z.id
      WHERE c.zone_id = ?
      ORDER BY c.start_date DESC
    `, [zoneId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const getMeterMultipliers = async (meterId) => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM meters WHERE id = ?
    `, [meterId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows[0]);
    });
  });
};

const getTenantAllocations = async (tenantId, batchId) => {
  let query = `
    SELECT 
      ar.*,
      c.contract_no,
      t.name as tenant_name,
      z.name as zone_name,
      m.meter_no,
      mr.reading_date
    FROM allocation_results ar
    LEFT JOIN contracts c ON ar.contract_id = c.id
    LEFT JOIN tenants t ON c.tenant_id = t.id
    LEFT JOIN temperature_zones z ON c.zone_id = z.id
    LEFT JOIN meter_readings mr ON ar.reading_id = mr.id
    LEFT JOIN meters m ON mr.meter_id = m.id
    WHERE 1=1
  `;
  const params = [];
  
  if (tenantId) {
    query += ` AND c.tenant_id = ?`;
    params.push(tenantId);
  }
  
  if (batchId) {
    query += ` AND ar.batch_id = ?`;
    params.push(batchId);
  }
  
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const exportToCSV = async (data, fields) => {
  const json2csvParser = new Parser({ fields });
  return json2csvParser.parse(data);
};

const exportReadings = async (batchId, filters = {}) => {
  const readings = await getReadingsByBatch(batchId, filters);
  
  const fields = [
    { label: '电表编号', value: 'meter_no' },
    { label: '电表名称', value: 'meter_name' },
    { label: '温区', value: 'zone_name' },
    { label: '抄表日期', value: 'reading_date' },
    { label: '读数', value: 'reading_value' },
    { label: '用电量', value: 'consumption' },
    { label: '倍率', value: 'multiplier' },
    { label: '实际用电量', value: 'actual_consumption' },
    { label: '异常尖峰', value: (row) => row.is_peak_abnormal ? '是' : '否' },
    { label: '空置期', value: (row) => row.is_vacant_period ? '是' : '否' },
    { label: '状态', value: 'status' },
    { label: '尖峰原因', value: 'peak_reason' },
    { label: '空置原因', value: 'vacant_reason' }
  ];
  
  const csv = await exportToCSV(readings, fields);
  return { csv, count: readings.length };
};

const exportAllocations = async (batchId, tenantId) => {
  const allocations = await getTenantAllocations(tenantId, batchId);
  
  const fields = [
    { label: '批次ID', value: 'batch_id' },
    { label: '合同编号', value: 'contract_no' },
    { label: '租户名称', value: 'tenant_name' },
    { label: '温区', value: 'zone_name' },
    { label: '电表编号', value: 'meter_no' },
    { label: '抄表日期', value: 'reading_date' },
    { label: '分摊电量', value: 'allocated_consumption' },
    { label: '分摊金额', value: 'allocated_amount' }
  ];
  
  const csv = await exportToCSV(allocations, fields);
  return { csv, count: allocations.length };
};

const getReadingsWithHistory = async (readingId) => {
  const reading = await new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        mr.*,
        m.meter_no,
        m.name as meter_name,
        z.name as zone_name
      FROM meter_readings mr
      LEFT JOIN meters m ON mr.meter_id = m.id
      LEFT JOIN temperature_zones z ON m.zone_id = z.id
      WHERE mr.id = ?
    `, [readingId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  const history = await new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM processing_records 
      WHERE reading_id = ? 
      ORDER BY processed_at DESC
    `, [readingId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  return { reading, history };
};

const calculateAllocations = async (batchId) => {
  const readings = await getReadingsByBatch(batchId, { status: 'approved' });
  
  for (const reading of readings) {
    const contracts = await new Promise((resolve, reject) => {
      db.all(`
        SELECT c.* FROM contracts c
        WHERE c.zone_id = (
          SELECT zone_id FROM meters WHERE id = ?
        ) AND c.status = 'active'
      `, [reading.meter_id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    for (const contract of contracts) {
      const allocatedConsumption = reading.actual_consumption * contract.allocation_ratio;
      const allocatedAmount = allocatedConsumption * contract.electricity_price;

      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO allocation_results 
          (batch_id, contract_id, reading_id, allocated_consumption, allocated_amount)
          VALUES (?, ?, ?, ?, ?)
        `, [batchId, contract.id, reading.id, allocatedConsumption, allocatedAmount], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  return { success: true };
};

module.exports = {
  getReadingsByBatch,
  getContractsByZone,
  getMeterMultipliers,
  getTenantAllocations,
  exportReadings,
  exportAllocations,
  getReadingsWithHistory,
  calculateAllocations
};
