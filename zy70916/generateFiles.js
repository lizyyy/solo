const fs = require('fs');
const path = require('path');

const files = {
  'src/utils/helpers.js': `const crypto = require('crypto');

function generateBatchNo() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return 'BATCH-' + dateStr + '-' + random;
}

function generateRecordNo() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return 'REC-' + timestamp + '-' + random;
}

function generateOrderNo() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return 'SO-' + dateStr + '-' + random;
}

function calculateDistance(addr1, addr2) {
  if (!addr1 || !addr2) return 0;
  const hash = crypto.createHash('md5').update(addr1 + addr2).digest('hex');
  const num = parseInt(hash.substring(0, 8), 16);
  return (num % 50) / 10 + 0.5;
}

function checkSkillMatch(nurseSkills, requiredSkills) {
  if (!nurseSkills || !requiredSkills) return { matched: true, missing: [] };
  const nurseSkillList = Array.isArray(nurseSkills) ? nurseSkills : nurseSkills.split(',').map(s => s.trim());
  const requiredList = Array.isArray(requiredSkills) ? requiredSkills : requiredSkills.split(',').map(s => s.trim());
  const missing = requiredList.filter(skill => !nurseSkillList.includes(skill));
  return {
    matched: missing.length === 0,
    missing,
    nurseSkills: nurseSkillList,
    requiredSkills: requiredList
  };
}

function checkDistrictMatch(nurseDistrict, serviceDistrict) {
  if (!nurseDistrict || !serviceDistrict) return true;
  return nurseDistrict === serviceDistrict;
}

module.exports = {
  generateBatchNo,
  generateRecordNo,
  generateOrderNo,
  calculateDistance,
  checkSkillMatch,
  checkDistrictMatch
};
`,

  'src/services/batchService.js': `const { run, get, all } = require('../models/database');
const helpers = require('../utils/helpers');

async function createBatch(name, createdBy) {
  const batchNo = helpers.generateBatchNo();
  const result = await run('INSERT INTO batches (batch_no, name, status, created_by) VALUES (?, ?, "pending", ?)', [batchNo, name, createdBy]);
  return getBatchById(result.lastID);
}

async function getBatchById(id) {
  return get('SELECT * FROM batches WHERE id = ?', [id]);
}

async function listBatches(filters = {}) {
  let query = 'SELECT * FROM batches WHERE 1=1';
  const params = [];
  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  query += ' ORDER BY created_at DESC';
  return all(query, params);
}

async function getBatchStatistics(batchId) {
  const batch = await getBatchById(batchId);
  if (!batch) return null;
  const stats = await all('SELECT status, COUNT(*) as count FROM service_orders WHERE batch_id = ? GROUP BY status', [batchId]);
  const statusMap = {};
  for (const stat of stats) {
    statusMap[stat.status] = stat.count;
  }
  return {
    batch,
    statistics: {
      total: batch.total_count,
      pending: statusMap.pending || 0,
      processing: statusMap.processing || 0,
      approved: statusMap.approved || 0,
      returned: statusMap.returned || 0,
      cancelled: statusMap.cancelled || 0,
      completed: statusMap.completed || 0
    }
  };
}

module.exports = {
  createBatch,
  getBatchById,
  listBatches,
  getBatchStatistics
};
`,

  'src/services/importService.js': `const fs = require('fs');
const csv = require('csv-parser');
const { run, get } = require('../models/database');
const helpers = require('../utils/helpers');

async function importServiceOrdersCsv(filePath, batchId, createdBy) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => results.push(row))
      .on('end', async () => {
        try {
          const imported = await processServiceOrders(results, batchId, createdBy);
          resolve(imported);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function processServiceOrders(rows, batchId, createdBy) {
  let count = 0;
  for (const row of rows) {
    const orderNo = row.order_no || helpers.generateOrderNo();
    const elderlyId = row.elderly_id || row['老人编号'];
    const serviceType = row.service_type || row['服务类型'] || '常规护理';
    const serviceItems = row.service_items || row['服务项目'] || '';
    const scheduledDate = row.scheduled_date || row['预约日期'];
    const address = row.address || row['地址'] || '';
    const district = row.district || row['区域'] || '';

    try {
      const result = await run(
        'INSERT INTO service_orders (order_no, batch_id, elderly_id, service_type, service_items, scheduled_date, address, district, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "pending")',
        [orderNo, batchId, elderlyId, serviceType, serviceItems, scheduledDate, address, district]
      );
      if (result.changes > 0) {
        count++;
        await run(
          'INSERT INTO track_records (record_no, service_order_id, batch_id, elderly_id, service_type, status, action, reason, handled_by, source_type, source_id) VALUES (?, ?, ?, ?, ?, "pending", "import", "批量导入服务单", ?, "csv", ?)',
          [helpers.generateRecordNo(), result.lastID, batchId, elderlyId, serviceType, createdBy, orderNo]
        );
      }
    } catch (e) {
      console.log('Skip duplicate:', orderNo);
    }
  }
  await run('UPDATE batches SET total_count = total_count + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [count, batchId]);
  return { count, total: rows.length };
}

async function importNurseCalendarJson(data, createdBy) {
  const items = Array.isArray(data) ? data : [data];
  let nurseCount = 0;
  for (const item of items) {
    const nurseId = item.nurse_id || item['护士编号'];
    const name = item.name || item['姓名'] || '';
    const qualifications = item.qualifications || item['资质'] || '';
    const skills = Array.isArray(item.skills) ? item.skills.join(',') : (item.skills || item['技能'] || '');
    const district = item.district || item['区域'] || '';
    try {
      await run('INSERT INTO nurses (nurse_id, name, qualifications, skills, district) VALUES (?, ?, ?, ?, ?)', [nurseId, name, qualifications, skills, district]);
      nurseCount++;
    } catch (e) {
      await run('UPDATE nurses SET name = ?, qualifications = ?, skills = ?, district = ? WHERE nurse_id = ?', [name, qualifications, skills, district, nurseId]);
    }
  }
  return { nurseCount, calendarCount: 0 };
}

async function importElderlyProfiles(data, createdBy) {
  const items = Array.isArray(data) ? data : [data];
  let count = 0;
  for (const item of items) {
    const elderlyId = item.elderly_id || item['老人编号'];
    const name = item.name || item['姓名'] || '';
    const age = item.age || item['年龄'] || null;
    const phone = item.phone || item['电话'] || '';
    const address = item.address || item['地址'] || '';
    const district = item.district || item['区域'] || '';
    const healthStatus = item.health_status || item['健康状况'] || '';
    const careLevel = item.care_level || item['护理等级'] || '';
    try {
      await run('INSERT INTO elderly_profiles (elderly_id, name, age, phone, address, district, health_status, care_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [elderlyId, name, age, phone, address, district, healthStatus, careLevel]);
      count++;
    } catch (e) {
      await run('UPDATE elderly_profiles SET name = ?, age = ?, phone = ?, address = ?, district = ?, health_status = ?, care_level = ? WHERE elderly_id = ?', [name, age, phone, address, district, healthStatus, careLevel, elderlyId]);
    }
  }
  return { count };
}

module.exports = {
  importServiceOrdersCsv,
  importNurseCalendarJson,
  importElderlyProfiles
};
`
};

for (const [filePath, content] of Object.entries(files)) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('Created:', filePath);
}

console.log('\nFiles created successfully!');
