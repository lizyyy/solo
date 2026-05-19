const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');

const dbPath = path.join(__dirname, '../../data/critical_values.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('开始生成样例数据...');

  const batchNo = `BATCH${moment().format('YYYYMMDDHHmmss')}`;
  
  db.run(
    `INSERT INTO batches (batch_no, import_by, shift_type, status, remark)
     VALUES (?, ?, ?, ?, ?)`,
    [batchNo, '张检验师', 'night', 'processing', '夜班组危急值批次'],
    function(err) {
      if (err) {
        console.error('创建批次失败:', err.message);
        return;
      }
      const batchId = this.lastID;
      console.log('创建批次成功, ID:', batchId);

      const criticalValues = [
        {
          batch_id: batchId,
          patient_id: 'P001',
          patient_name: '张三',
          ward: '内科',
          bed_no: '101',
          test_item: '血钾',
          test_result: '2.3 mmol/L',
          reference_range: '3.5-5.5 mmol/L',
          critical_level: 'high',
          report_time: moment().subtract(2, 'hours').format(),
          status: 'confirmed'
        },
        {
          batch_id: batchId,
          patient_id: 'P002',
          patient_name: '李四',
          ward: '外科',
          bed_no: '203',
          test_item: '血糖',
          test_result: '22.5 mmol/L',
          reference_range: '3.9-6.1 mmol/L',
          critical_level: 'high',
          report_time: moment().subtract(1, 'hour').format(),
          status: 'pending_correction'
        },
        {
          batch_id: batchId,
          patient_id: 'P003',
          patient_name: '王五',
          ward: 'ICU',
          bed_no: 'ICU01',
          test_item: '肌钙蛋白',
          test_result: '5.2 ng/mL',
          reference_range: '<0.04 ng/mL',
          critical_level: 'critical',
          report_time: moment().subtract(45, 'minutes').format(),
          status: 'processing',
          has_multiple_records: 1
        },
        {
          batch_id: batchId,
          patient_id: 'P003',
          patient_name: '王五',
          ward: 'ICU',
          bed_no: 'ICU01',
          test_item: '肌钙蛋白',
          test_result: '5.8 ng/mL',
          reference_range: '<0.04 ng/mL',
          critical_level: 'critical',
          report_time: moment().subtract(30, 'minutes').format(),
          status: 'processing',
          has_multiple_records: 1
        },
        {
          batch_id: batchId,
          patient_id: 'P004',
          patient_name: '赵六',
          ward: '急诊科',
          bed_no: 'ER05',
          test_item: '血氧分压',
          test_result: '55 mmHg',
          reference_range: '80-100 mmHg',
          critical_level: 'critical',
          report_time: moment().subtract(90, 'minutes').format(),
          status: 'pending',
          timeout_flag: 1
        }
      ];

      let cvIds = [];
      let completed = 0;

      criticalValues.forEach((cv, index) => {
        db.run(
          `INSERT INTO critical_values 
           (batch_id, patient_id, patient_name, ward, bed_no, test_item, test_result,
            reference_range, critical_level, report_time, status, has_multiple_records, timeout_flag, handover_gap)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cv.batch_id, cv.patient_id, cv.patient_name, cv.ward, cv.bed_no,
            cv.test_item, cv.test_result, cv.reference_range, cv.critical_level,
            cv.report_time, cv.status, cv.has_multiple_records || 0, cv.timeout_flag || 0, 0
          ],
          function(err) {
            if (err) {
              console.error('插入危急值失败:', err.message);
              return;
            }
            cvIds.push(this.lastID);
            completed++;

            if (completed === criticalValues.length) {
              console.log('危急值数据插入完成');
              insertCallbacks(cvIds);
            }
          }
        );
      });
    }
  );

  function insertCallbacks(cvIds) {
    const callbacks = [
      {
        critical_value_id: cvIds[0],
        call_time: moment().subtract(90, 'minutes').format(),
        caller: '李护士',
        receiver: '王医生',
        receiver_role: 'doctor',
        callback_content: '已告知患者张三血钾危急值2.3mmol/L，医生表示知晓，将立即处理',
        callback_status: 'confirmed',
        confirm_time: moment().subtract(85, 'minutes').format()
      },
      {
        critical_value_id: cvIds[1],
        call_time: moment().subtract(30, 'minutes').format(),
        caller: '王护士',
        receiver: '张医生',
        receiver_role: 'doctor',
        callback_content: '患者李四血糖22.5mmol/L，需人工复核检验结果',
        callback_status: 'pending'
      },
      {
        critical_value_id: cvIds[2],
        call_time: moment().subtract(40, 'minutes').format(),
        caller: '赵护士',
        receiver: '刘主任',
        receiver_role: 'director',
        callback_content: '患者王五肌钙蛋白显著升高，已通知值班主任',
        callback_status: 'confirmed',
        confirm_time: moment().subtract(35, 'minutes').format()
      }
    ];

    let cbCompleted = 0;
    callbacks.forEach((cb) => {
      db.run(
        `INSERT INTO callbacks 
         (critical_value_id, call_time, caller, receiver, receiver_role, callback_content, callback_status, confirm_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cb.critical_value_id, cb.call_time, cb.caller, cb.receiver,
          cb.receiver_role, cb.callback_content, cb.callback_status, cb.confirm_time
        ],
        function(err) {
          if (err) {
            console.error('插入回告失败:', err.message);
            return;
          }
          cbCompleted++;
          if (cbCompleted === callbacks.length) {
            console.log('回告数据插入完成');
            insertProcessingRecords(cvIds);
          }
        }
      );
    });
  }

  function insertProcessingRecords(cvIds) {
    const processingRecords = [
      {
        critical_value_id: cvIds[0],
        action: 'confirm',
        operator: '王医生',
        operator_role: 'doctor',
        reason: '医生已确认收到危急值通知，立即给予补钾治疗',
        previous_status: 'pending',
        new_status: 'confirmed'
      },
      {
        critical_value_id: cvIds[1],
        action: 'request_correction',
        operator: '张检验师',
        operator_role: 'lab_tech',
        reason: '血糖结果需要人工复核，原始样本可能溶血',
        previous_status: 'pending',
        new_status: 'pending_correction'
      },
      {
        critical_value_id: cvIds[2],
        action: 'director_review',
        operator: '刘主任',
        operator_role: 'director',
        reason: '值班主任已复核，患者为急性心梗，已安排紧急PCI',
        previous_status: 'processing',
        new_status: 'processing'
      },
      {
        critical_value_id: cvIds[4],
        action: 'mark_timeout',
        operator: '陈护士',
        operator_role: 'nurse',
        reason: '危急值报告已超过30分钟未收到医生确认',
        previous_status: 'pending',
        new_status: 'pending'
      }
    ];

    let prCompleted = 0;
    processingRecords.forEach((pr) => {
      db.run(
        `INSERT INTO processing_records 
         (critical_value_id, action, operator, operator_role, reason, previous_status, new_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          pr.critical_value_id, pr.action, pr.operator, pr.operator_role,
          pr.reason, pr.previous_status, pr.new_status
        ],
        function(err) {
          if (err) {
            console.error('插入处理记录失败:', err.message);
            return;
          }
          prCompleted++;
          if (prCompleted === processingRecords.length) {
            console.log('处理记录插入完成');
            insertDutySchedule();
          }
        }
      );
    });
  }

  function insertDutySchedule() {
    const today = moment().format('YYYY-MM-DD');
    const dutySchedules = [
      {
        duty_date: today,
        shift_type: 'morning',
        doctor_name: '张医生',
        nurse_name: '李护士',
        director_name: '王主任'
      },
      {
        duty_date: today,
        shift_type: 'afternoon',
        doctor_name: '刘医生',
        nurse_name: '赵护士',
        director_name: '王主任'
      },
      {
        duty_date: today,
        shift_type: 'night',
        doctor_name: '王医生',
        nurse_name: '陈护士',
        director_name: '刘主任'
      }
    ];

    let dsCompleted = 0;
    dutySchedules.forEach((ds) => {
      db.run(
        `INSERT INTO duty_schedule 
         (duty_date, shift_type, doctor_name, nurse_name, director_name)
         VALUES (?, ?, ?, ?, ?)`,
        [ds.duty_date, ds.shift_type, ds.doctor_name, ds.nurse_name, ds.director_name],
        function(err) {
          if (err) {
            console.error('插入值班表失败:', err.message);
            return;
          }
          dsCompleted++;
          if (dsCompleted === dutySchedules.length) {
            console.log('✅ 所有样例数据生成完成!');
            console.log('📋 样例说明:');
            console.log('   1. 患者张三 - 血钾危急值，医生已确认 (已处理)');
            console.log('   2. 患者李四 - 血糖危急值，需要人工修正检验结果 (待处理)');
            console.log('   3. 患者王五 - 肌钙蛋白危急值，同患者多次报告，主任已复核');
            console.log('   4. 患者赵六 - 血氧危急值，超时未确认标记');
            db.close();
          }
        }
      );
    });
  }
});
