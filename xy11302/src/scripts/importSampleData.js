const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '../../data/homestay.db');

const sampleRooms = [
  { room_number: '101', room_type: '标准间', floor: 1 },
  { room_number: '102', room_type: '标准间', floor: 1 },
  { room_number: '103', room_type: '大床房', floor: 1 },
  { room_number: '201', room_type: '大床房', floor: 2 },
  { room_number: '202', room_type: '豪华套房', floor: 2 },
  { room_number: '301', room_type: '豪华套房', floor: 3 },
  { room_number: '302', room_type: '家庭房', floor: 3 },
  { room_number: '401', room_type: '家庭房', floor: 4 },
  { room_number: '402', room_type: '标准间', floor: 4 },
  { room_number: '501', room_type: '大床房', floor: 5 }
];

const sampleComplaints = [
  {
    room_number: '101',
    complaint_type: '卫生问题',
    description: '客人反映卫生间有异味，需要彻底清洁',
    reporter_name: '客户李女士',
    handler_name: '张三',
    status: 'resolved',
    deduction_amount: 50,
    occurred_at: '2024-01-16 10:30:00'
  },
  {
    room_number: '202',
    complaint_type: '设施问题',
    description: '空调制热效果不佳，客人感到寒冷',
    reporter_name: '客户王先生',
    handler_name: '李四',
    status: 'processing',
    deduction_amount: 0,
    occurred_at: '2024-01-17 15:00:00'
  },
  {
    room_number: '401',
    complaint_type: '服务问题',
    description: '保洁用品摆放不整齐，客人不满意',
    reporter_name: '客户张女士',
    handler_name: '王五',
    status: 'pending',
    deduction_amount: 30,
    occurred_at: '2024-01-19 09:15:00'
  }
];

const sampleReworks = [
  {
    room_number: '101',
    original_cleaner: '张三',
    reworker_name: '张三',
    reason: '卫生间有污渍需要返工清洁',
    status: 'completed',
    rework_date: '2024-01-16',
    deduction_amount: 20
  },
  {
    room_number: '202',
    original_cleaner: '王五',
    reworker_name: '赵六',
    reason: '窗户未擦干净需要返工',
    status: 'pending',
    rework_date: '2024-01-17',
    deduction_amount: 0
  },
  {
    room_number: '401',
    original_cleaner: '赵六',
    reworker_name: '赵六',
    reason: '垃圾桶未清理，质量分过低',
    status: 'completed',
    rework_date: '2024-01-18',
    deduction_amount: 30
  }
];

function initRooms(db) {
  return new Promise((resolve, reject) => {
    console.log('📋 正在初始化房间数据...');
    let completed = 0;
    sampleRooms.forEach(room => {
      db.run('INSERT OR IGNORE INTO rooms (room_number, room_type, floor, status) VALUES (?, ?, ?, ?)',
        [room.room_number, room.room_type, room.floor, 'active'],
        (err) => {
          if (err) {
            console.error('插入房间失败:', err);
          }
          completed++;
          if (completed === sampleRooms.length) {
            console.log(`✅ 房间数据初始化完成，共 ${sampleRooms.length} 个房间`);
            resolve();
          }
        }
      );
    });
  });
}

function importCleaningRecords(db) {
  return new Promise((resolve, reject) => {
    console.log('📋 正在导入保洁记录...');
    const results = [];
    const filePath = path.join(__dirname, '../../samples/cleaning_records_with_issues.csv');
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        let normalCount = 0;
        let abnormalCount = 0;

        for (const row of results) {
          const hasIssue = parseInt(row.has_issue) === 1 || 
                          (parseInt(row.quality_score) < 80) || 
                          !row.photo_urls;
          
          if (!row.room_number || !row.cleaner_name || !row.check_date) {
            abnormalCount++;
            continue;
          }

          try {
            await new Promise((res, rej) => {
              db.get('SELECT id FROM rooms WHERE room_number = ?', [row.room_number], (err, room) => {
                if (err) {
                  rej(err);
                  return;
                }
                const roomId = room ? room.id : 1;
                db.run(
                  `INSERT INTO cleaning_records 
                   (room_id, room_number, cleaner_name, check_date, check_time, status, 
                    photo_urls, quality_score, has_issue, issue_description)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [roomId, row.room_number, row.cleaner_name, row.check_date, 
                   row.check_time || null, hasIssue ? 'pending' : 'approved',
                   row.photo_urls || null, parseInt(row.quality_score) || null,
                   hasIssue ? 1 : 0, row.issue_description || null],
                  (err) => {
                    if (err) rej(err);
                    else res();
                  }
                );
              });
            });
            normalCount++;
          } catch (error) {
            abnormalCount++;
          }
        }

        console.log(`✅ 保洁记录导入完成: 正常 ${normalCount} 条, 异常 ${abnormalCount} 条`);
        resolve();
      })
      .on('error', reject);
  });
}

function importComplaints(db) {
  return new Promise((resolve, reject) => {
    console.log('📋 正在导入客诉记录...');
    let completed = 0;
    sampleComplaints.forEach(c => {
      db.get('SELECT id FROM rooms WHERE room_number = ?', [c.room_number], (err, room) => {
        const roomId = room ? room.id : null;
        db.run(
          `INSERT INTO complaints 
           (room_id, room_number, complaint_type, description, reporter_name, 
            handler_name, status, handling_result, deduction_amount, occurred_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [roomId, c.room_number, c.complaint_type, c.description, c.reporter_name,
           c.handler_name, c.status, c.status === 'resolved' ? '已解决' : null, 
           c.deduction_amount, c.occurred_at],
          (err) => {
            if (err) console.error('插入客诉失败:', err);
            completed++;
            if (completed === sampleComplaints.length) {
              console.log(`✅ 客诉记录导入完成，共 ${sampleComplaints.length} 条`);
              resolve();
            }
          }
        );
      });
    });
  });
}

function importReworks(db) {
  return new Promise((resolve, reject) => {
    console.log('📋 正在导入返工记录...');
    let completed = 0;
    sampleReworks.forEach(r => {
      db.get('SELECT id FROM cleaning_records WHERE room_number = ? LIMIT 1', [r.room_number], (err, record) => {
        const recordId = record ? record.id : null;
        db.run(
          `INSERT INTO reworks 
           (cleaning_record_id, room_number, original_cleaner, reworker_name, 
            reason, status, rework_date, reviewer_name, reviewed_at, deduction_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [recordId, r.room_number, r.original_cleaner, r.reworker_name,
           r.reason, r.status, r.rework_date,
           r.status === 'completed' ? '管理员' : null,
           r.status === 'completed' ? new Date().toISOString() : null,
           r.deduction_amount],
          (err) => {
            if (err) console.error('插入返工失败:', err);
            completed++;
            if (completed === sampleReworks.length) {
              console.log(`✅ 返工记录导入完成，共 ${sampleReworks.length} 条`);
              resolve();
            }
          }
        );
      });
    });
  });
}

async function main() {
  console.log('🚀 开始导入样例数据...\n');
  
  const db = new sqlite3.Database(dbPath);
  
  try {
    await initRooms(db);
    await importCleaningRecords(db);
    await importComplaints(db);
    await importReworks(db);
    
    console.log('\n🎉 所有样例数据导入成功!');
    console.log('📊 数据概览:');
    console.log('   - 房间: 10 个');
    console.log('   - 保洁记录: 含正常和待审核记录');
    console.log('   - 客诉记录: 3 条 (不同状态)');
    console.log('   - 返工记录: 3 条 (含扣款记录)');
    
    db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据导入失败:', error);
    db.close();
    process.exit(1);
  }
}

main();