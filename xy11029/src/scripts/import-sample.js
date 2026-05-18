const fs = require('fs');
const path = require('path');
const { runQuery, initDatabase } = require('../database/db');

async function importSampleData() {
  try {
    await initDatabase();
    
    const sampleDataPath = path.join(__dirname, '../../data/sample-data.json');
    const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
    
    console.log(`开始导入 ${sampleData.length} 条样例数据...`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const data of sampleData) {
      try {
        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data).map(v => v === null ? null : v);
        
        await runQuery(
          `INSERT INTO insurance_reports (${columns}) VALUES (${placeholders})`,
          values
        );
        successCount++;
        console.log(`✓ 导入成功: ${data.report_no}`);
      } catch (error) {
        failCount++;
        console.log(`✗ 导入失败: ${data.report_no} - ${error.message}`);
      }
    }
    
    console.log(`\n导入完成: 成功 ${successCount} 条, 失败 ${failCount} 条`);
    process.exit(0);
  } catch (error) {
    console.error('导入样例数据失败:', error);
    process.exit(1);
  }
}

importSampleData();
