const db = require('../database/db');

const sampleValuations = [
  {
    order_no: 'VAL202405001',
    customer_name: '张三',
    customer_phone: '13800138001',
    appliance_brand: '海尔',
    appliance_model: 'BCD-216SDCX',
    appliance_type: '冰箱',
    purchase_year: 2018,
    online_valuation: 300,
    onsite_valuation: 280,
    final_price: 280,
    status: 'completed',
    operator: '李工',
    reviewer: '王主管'
  },
  {
    order_no: 'VAL202405002',
    customer_name: '李四',
    customer_phone: '13800138002',
    appliance_brand: '格力',
    appliance_model: 'KFR-35GW',
    appliance_type: '空调',
    purchase_year: 2020,
    online_valuation: 500,
    onsite_valuation: null,
    final_price: null,
    status: 'pending_onsite',
    operator: '李工'
  },
  {
    order_no: 'VAL202405003',
    customer_name: '王五',
    customer_phone: '13800138003',
    appliance_brand: '美的',
    appliance_model: 'MB80V31',
    appliance_type: '洗衣机',
    purchase_year: 2019,
    online_valuation: 250,
    onsite_valuation: 180,
    final_price: 180,
    status: 'price_changed',
    price_change_reason: '外观磨损严重，电机有异响',
    operator: '赵工',
    is_anomaly: 1,
    anomaly_type: 'price_drop_exceed'
  },
  {
    order_no: 'VAL202405004',
    customer_name: '赵六',
    customer_phone: '13800138004',
    appliance_brand: '西门子',
    appliance_model: 'WM12N2C80W',
    appliance_type: '洗衣机',
    purchase_year: 2017,
    online_valuation: 400,
    onsite_valuation: 350,
    final_price: null,
    status: 'cancelled',
    cancel_reason: '客户临时取消',
    operator: '李工',
    reviewer: '张主管',
    is_anomaly: 1,
    anomaly_type: 'cancelled_after_onsite'
  },
  {
    order_no: 'VAL202405005',
    customer_name: '孙七',
    customer_phone: '13800138005',
    appliance_brand: '小米',
    appliance_model: 'L55M5-AD',
    appliance_type: '电视',
    purchase_year: 2021,
    online_valuation: 600,
    onsite_valuation: 600,
    final_price: 600,
    status: 'completed',
    operator: '赵工'
  },
  {
    order_no: 'VAL202405006',
    customer_name: '周八',
    customer_phone: '13800138006',
    appliance_brand: '海信',
    appliance_model: 'BCD-518WTDVBP',
    appliance_type: '冰箱',
    purchase_year: 2022,
    online_valuation: 800,
    onsite_valuation: null,
    final_price: null,
    status: 'pending',
    operator: '李工'
  }
];

const sampleFlowRecords = [];
const sampleChangeHistory = [];

function initSampleData(callback) {
  let completed = 0;
  const total = sampleValuations.length;

  sampleValuations.forEach((valuation, index) => {
    db.run(
      `INSERT INTO valuations (
        order_no, customer_name, customer_phone, appliance_brand,
        appliance_model, appliance_type, purchase_year, online_valuation,
        onsite_valuation, final_price, status, price_change_reason,
        cancel_reason, operator, reviewer, is_anomaly, anomaly_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        valuation.order_no, valuation.customer_name, valuation.customer_phone,
        valuation.appliance_brand, valuation.appliance_model, valuation.appliance_type,
        valuation.purchase_year, valuation.online_valuation, valuation.onsite_valuation,
        valuation.final_price, valuation.status, valuation.price_change_reason,
        valuation.cancel_reason, valuation.operator, valuation.reviewer,
        valuation.is_anomaly, valuation.anomaly_type
      ],
      function(err) {
        if (err) {
          console.error('插入估价单失败:', err);
          return callback(err);
        }

        const valuationId = this.lastID;

        db.run(
          `INSERT INTO flow_records (valuation_id, action, operator, previous_status, new_status, remark)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [valuationId, 'create_valuation', valuation.operator, null, 'pending', '创建估价单'],
          (err) => {
            if (err) console.error('插入流转记录失败:', err);
          }
        );

        if (valuation.online_valuation && valuation.onsite_valuation) {
          db.run(
            `INSERT INTO change_history (valuation_id, field_name, old_value, new_value, operator, reason)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [valuationId, 'onsite_valuation', valuation.online_valuation.toString(), 
             valuation.onsite_valuation.toString(), valuation.operator, '上门检测'],
            (err) => {
              if (err) console.error('插入变更历史失败:', err);
            }
          );
        }

        completed++;
        if (completed === total) {
          callback(null);
        }
      }
    );
  });
}

module.exports = { initSampleData };
