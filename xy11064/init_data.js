const db = require('./database');
const fs = require('fs');
const csv = require('csv-parser');

const results = [];

fs.createReadStream('sample_data.csv')
  .pipe(csv())
  .on('data', (row) => {
    results.push(row);
  })
  .on('end', () => {
    console.log(`准备导入 ${results.length} 条样例数据...`);
    importData(results);
  });

function importData(rows) {
  let imported = 0;
  
  rows.forEach((data) => {
    const sql = `
      INSERT INTO deposits (
        deposit_no, student_name, student_phone, instrument_type,
        instrument_brand, instrument_model, instrument_serial,
        deposit_amount, rental_start_date, expected_return_date,
        actual_return_date, status, store, manager, string_condition,
        body_condition, damage_description, damage_type, deduction_amount,
        refund_amount, evidence_photos, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      data.deposit_no, data.student_name, data.student_phone, data.instrument_type,
      data.instrument_brand, data.instrument_model, data.instrument_serial,
      parseFloat(data.deposit_amount) || 0, data.rental_start_date,
      data.expected_return_date, data.actual_return_date || null,
      data.status || 'active', data.store, data.manager, data.string_condition,
      data.body_condition, data.damage_description, data.damage_type,
      parseFloat(data.deduction_amount) || 0,
      data.refund_amount ? parseFloat(data.refund_amount) : null,
      data.evidence_photos, data.notes
    ];
    
    db.run(sql, params, function(err) {
      if (err) {
        console.log(`导入 ${data.deposit_no} 失败:`, err.message);
      } else {
        console.log(`导入 ${data.deposit_no} 成功`);
        imported++;
      }
      
      if (imported + (rows.length - imported) === rows.length) {
        console.log(`\n导入完成！共成功导入 ${imported} 条数据`);
        db.close();
      }
    });
  });
}
