const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/prescriptions.db');
const db = new sqlite3.Database(dbPath);

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const samplePrescriptions = [
  {
    prescription_no: 'RX20240101001',
    order_id: 'ORD001',
    patient_name: '张三',
    patient_id_card: '110101199001011234',
    doctor_name: '李医生',
    hospital_name: '第一人民医院',
    issue_date: moment().subtract(1, 'days').toISOString(),
    status: 'PENDING',
    medicines: [
      { medicine_name: '阿莫西林胶囊', specification: '0.25g*24粒', dosage: '每日3次，每次2粒', quantity: 2, unit: '盒', price: 15.5 }
    ]
  },
  {
    prescription_no: 'RX20240101002',
    order_id: 'ORD002',
    patient_name: '李四',
    patient_id_card: '310101198505055678',
    doctor_name: '王医生',
    hospital_name: '中心医院',
    issue_date: moment().subtract(2, 'days').toISOString(),
    status: 'APPROVED',
    medicines: [
      { medicine_name: '布洛芬缓释胶囊', specification: '0.3g*20粒', dosage: '每日2次，每次1粒', quantity: 1, unit: '盒', price: 22.0 },
      { medicine_name: '维生素C片', specification: '100mg*100片', dosage: '每日3次，每次1片', quantity: 1, unit: '瓶', price: 8.5 }
    ],
    review: {
      pharmacist_id: 'PH001',
      pharmacist_name: '赵药师',
      review_result: 'PASS',
      review_comment: '处方无误'
    }
  },
  {
    prescription_no: 'RX20240101003',
    order_id: 'ORD003',
    patient_name: '王五',
    patient_id_card: '440101197808089012',
    doctor_name: '陈医生',
    hospital_name: '社区医院',
    issue_date: moment().subtract(5, 'days').toISOString(),
    status: 'RETURNED',
    medicines: [
      { medicine_name: '感冒灵颗粒', specification: '10g*9袋', dosage: '每日3次，每次1袋', quantity: 2, unit: '盒', price: 18.0 }
    ],
    return: {
      return_reason: '药品缺货',
      return_detail: '该规格的感冒灵颗粒暂时缺货',
      operator_id: 'OP001',
      operator_name: '店员小张'
    }
  },
  {
    prescription_no: 'RX20240101004',
    order_id: 'ORD004',
    patient_name: '赵六',
    patient_id_card: '510101199202023456',
    doctor_name: '刘医生',
    hospital_name: '中医院',
    issue_date: moment().subtract(3, 'days').toISOString(),
    status: 'COMPLETED',
    medicines: [
      { medicine_name: '六味地黄丸', specification: '9g*10丸', dosage: '每日2次，每次1丸', quantity: 3, unit: '盒', price: 25.0 }
    ]
  }
];

const seedDatabase = async () => {
  console.log('开始初始化样例数据...');

  for (const prescr of samplePrescriptions) {
    const existing = await dbGet('SELECT id FROM prescriptions WHERE prescription_no = ?', [prescr.prescription_no]);
    if (existing) {
      console.log(`处方 ${prescr.prescription_no} 已存在，跳过`);
      continue;
    }

    const prescriptionId = uuidv4();
    const expireDate = moment(prescr.issue_date).add(3, 'days').toISOString();

    await dbRun(`
      INSERT INTO prescriptions (
        id, prescription_no, order_id, patient_name, patient_id_card,
        doctor_name, hospital_name, issue_date, expire_date, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      prescriptionId, prescr.prescription_no, prescr.order_id,
      prescr.patient_name, prescr.patient_id_card, prescr.doctor_name,
      prescr.hospital_name, prescr.issue_date, expireDate,
      prescr.status, prescr.issue_date
    ]);

    for (const medicine of prescr.medicines) {
      await dbRun(`
        INSERT INTO prescription_medicines (
          id, prescription_id, medicine_name, specification,
          dosage, quantity, unit, price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        uuidv4(), prescriptionId, medicine.medicine_name,
        medicine.specification, medicine.dosage, medicine.quantity,
        medicine.unit, medicine.price
      ]);
    }

    if (prescr.review) {
      await dbRun(`
        INSERT INTO pharmacist_reviews (
          id, prescription_id, pharmacist_id, pharmacist_name, review_result, review_comment, review_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        uuidv4(), prescriptionId, prescr.review.pharmacist_id,
        prescr.review.pharmacist_name, prescr.review.review_result,
        prescr.review.review_comment, moment(prescr.issue_date).add(1, 'hours').toISOString()
      ]);
    }

    if (prescr.return) {
      await dbRun(`
        INSERT INTO return_records (
          id, prescription_id, return_reason, return_detail, operator_id, operator_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        uuidv4(), prescriptionId, prescr.return.return_reason,
        prescr.return.return_detail, prescr.return.operator_id,
        prescr.return.operator_name, moment(prescr.issue_date).add(2, 'hours').toISOString()
      ]);
    }

    await dbRun(`
      INSERT INTO audit_logs (
        id, prescription_id, action, new_status, operator_id, operator_name, comment, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(), prescriptionId, 'CREATE', prescr.status, 'SYS', '系统', '创建处方', prescr.issue_date
    ]);

    console.log(`已创建处方: ${prescr.prescription_no}`);
  }

  console.log('样例数据初始化完成！');
};

seedDatabase().catch(console.error).finally(() => {
  db.close();
});
