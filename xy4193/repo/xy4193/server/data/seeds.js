const db = require('../config/database');

const sampleData = {
  donors: [
    { donor_code: 'D001', name: '张三', blood_type: 'A' },
    { donor_code: 'D002', name: '李四', blood_type: 'B' },
    { donor_code: 'D003', name: '王五', blood_type: 'O' },
    { donor_code: 'D004', name: '赵六', blood_type: 'AB' },
    { donor_code: 'D005', name: '钱七', blood_type: 'A' },
  ],
  bloodBags: [
    { bag_code: 'B001', donor_code: 'D001', volume: 400, blood_type: 'A' },
    { bag_code: 'B002', donor_code: 'D002', volume: 400, blood_type: 'B' },
    { bag_code: 'B003', donor_code: 'D003', volume: 400, blood_type: 'O' },
    { bag_code: 'B004', donor_code: 'D004', volume: 400, blood_type: 'AB' },
    { bag_code: 'B005', donor_code: 'D005', volume: 200, blood_type: 'A' },
    { bag_code: 'B006', donor_code: 'D001', volume: 400, blood_type: 'A' },
  ],
  sampleTubes: [
    { tube_code: 'T001', donor_code: 'D001', tube_type: 'standard' },
    { tube_code: 'T002', donor_code: 'D002', tube_type: 'edta' },
    { tube_code: 'T003', donor_code: 'D003', tube_type: 'standard' },
    { tube_code: 'T004', donor_code: 'D004', tube_type: 'heparin' },
    { tube_code: 'T005', donor_code: 'D005', tube_type: 'standard' },
    { tube_code: 'T006', donor_code: 'D001', tube_type: 'edta' },
  ],
  coldBoxes: [
    { box_code: 'BOX001', description: '流动采血车冷箱1号', max_temp: 10 },
    { box_code: 'BOX002', description: '流动采血车冷箱2号', max_temp: 10 },
    { box_code: 'BOX003', description: '备用冷箱', max_temp: 6 },
  ]
};

function insertDonor(donor) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR IGNORE INTO donors (donor_code, name, blood_type, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [donor.donor_code, donor.name, donor.blood_type],
      function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      }
    );
  });
}

function getDonorIdByCode(donorCode) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT id FROM donors WHERE donor_code = ?`, [donorCode], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.id : null);
    });
  });
}

function insertBloodBag(bag, donorId) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR IGNORE INTO blood_bags (bag_code, donor_id, volume, blood_type, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [bag.bag_code, donorId, bag.volume, bag.blood_type],
      function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      }
    );
  });
}

function insertSampleTube(tube, donorId) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR IGNORE INTO sample_tubes (tube_code, donor_id, tube_type, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [tube.tube_code, donorId, tube.tube_type],
      function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      }
    );
  });
}

function insertColdBox(box) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR IGNORE INTO cold_boxes (box_code, description, max_temp, status, created_at) VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)`,
      [box.box_code, box.description, box.max_temp],
      function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      }
    );
  });
}

async function seedDatabase() {
  console.log('开始插入示例数据...');
  
  try {
    for (const donor of sampleData.donors) {
      const result = await insertDonor(donor);
      if (result.changes > 0) {
        console.log(`✓ 献血者已添加: ${donor.donor_code}`);
      } else {
        console.log(`- 献血者已存在: ${donor.donor_code}`);
      }
    }

    for (const bag of sampleData.bloodBags) {
      const donorId = await getDonorIdByCode(bag.donor_code);
      if (donorId) {
        const result = await insertBloodBag(bag, donorId);
        if (result.changes > 0) {
          console.log(`✓ 血袋已添加: ${bag.bag_code}`);
        } else {
          console.log(`- 血袋已存在: ${bag.bag_code}`);
        }
      }
    }

    for (const tube of sampleData.sampleTubes) {
      const donorId = await getDonorIdByCode(tube.donor_code);
      if (donorId) {
        const result = await insertSampleTube(tube, donorId);
        if (result.changes > 0) {
          console.log(`✓ 样本管已添加: ${tube.tube_code}`);
        } else {
          console.log(`- 样本管已存在: ${tube.tube_code}`);
        }
      }
    }

    for (const box of sampleData.coldBoxes) {
      const result = await insertColdBox(box);
      if (result.changes > 0) {
        console.log(`✓ 冷箱已添加: ${box.box_code}`);
      } else {
        console.log(`- 冷箱已存在: ${box.box_code}`);
      }
    }

    console.log('\n示例数据插入完成！');
    console.log('\n已创建以下数据:');
    console.log(`- 献血者: ${sampleData.donors.length} 人`);
    console.log(`- 血袋: ${sampleData.bloodBags.length} 个`);
    console.log(`- 样本管: ${sampleData.sampleTubes.length} 个`);
    console.log(`- 冷箱: ${sampleData.coldBoxes.length} 个`);
    
  } catch (error) {
    console.error('插入示例数据失败:', error.message);
    throw error;
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedDatabase, sampleData };
