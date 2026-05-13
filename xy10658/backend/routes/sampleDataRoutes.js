const express = require('express');
const router = express.Router();
const { DBUtils } = require('../utils/db');

router.post('/generate', (req, res) => {
  try {
    const now = DBUtils.now();
    const operators = ['张三', '李四', '王五', '赵六'];
    
    const contractIds = [];
    const rooms = ['101', '102', '201', '202', '301'];
    const tenants = ['张明', '李华', '王芳', '刘强', '陈静'];
    
    for (let i = 0; i < 5; i++) {
      const id = DBUtils.generateId();
      contractIds.push(id);
      
      const monthlyRent = 2000 + i * 500;
      const depositAmount = monthlyRent * 2;
      
      DBUtils.runQuery(
        `INSERT INTO lease_contracts (id, room_number, tenant_name, tenant_phone, start_date, end_date, monthly_rent, deposit_amount, status, created_at, updated_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          rooms[i],
          tenants[i],
          `1380000${1000 + i}`,
          '2024-01-01',
          '2024-12-31',
          monthlyRent,
          depositAmount,
          i < 4 ? 'active' : 'ended',
          now,
          now,
          operators[i % 4]
        ]
      );
    }
    
    const renewalIds = [];
    const renewalEndDates = ['2025-06-30', '2025-12-31'];
    
    for (let i = 0; i < 2; i++) {
      const id = DBUtils.generateId();
      renewalIds.push(id);
      
      DBUtils.runQuery(
        `INSERT INTO renewal_quotes (id, contract_id, original_end_date, new_end_date, new_monthly_rent, deposit_adjustment, status, created_at, updated_at, created_by, reviewed_by, reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          contractIds[i],
          '2024-12-31',
          renewalEndDates[i],
          2500 + i * 300,
          500,
          i === 0 ? 'approved' : 'pending',
          now,
          now,
          operators[0],
          i === 0 ? operators[1] : null,
          i === 0 ? now : null
        ]
      );
    }
    
    const depositTypes = ['deposit_increase', 'maintenance_deduction', 'deposit_decrease'];
    
    for (let i = 0; i < 3; i++) {
      const id = DBUtils.generateId();
      const contractId = contractIds[i];
      const contract = DBUtils.getQuery('SELECT deposit_amount FROM lease_contracts WHERE id = ?', [contractId]);
      
      const amount = 200 + i * 100;
      let balance = contract.deposit_amount;
      
      if (depositTypes[i].includes('deduction') || depositTypes[i].includes('decrease')) {
        balance -= amount;
      } else {
        balance += amount;
      }
      
      DBUtils.runQuery(
        `INSERT INTO deposit_ledgers (id, contract_id, transaction_type, amount, balance, description, status, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          contractId,
          depositTypes[i],
          amount,
          balance,
          `押金${i === 0 ? '增加' : i === 1 ? '扣款' : '减少'}`,
          'confirmed',
          now,
          operators[i % 4]
        ]
      );
    }
    
    const maintenanceItems = ['墙壁修复', '门锁更换', '灯具维修', '空调清洗'];
    
    for (let i = 0; i < 3; i++) {
      const id = DBUtils.generateId();
      
      DBUtils.runQuery(
        `INSERT INTO maintenance_deductions (id, contract_id, item_name, deduction_amount, reason, photos, status, created_at, updated_at, created_by, reviewed_by, reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          contractIds[i],
          maintenanceItems[i],
          150 + i * 100,
          `${maintenanceItems[i]}需要维修`,
          null,
          i === 0 ? 'approved' : (i === 1 ? 'rejected' : 'pending'),
          now,
          now,
          operators[0],
          i <= 1 ? operators[1] : null,
          i <= 1 ? now : null
        ]
      );
    }
    
    for (let i = 0; i < 2; i++) {
      const id = DBUtils.generateId();
      
      DBUtils.runQuery(
        `INSERT INTO checkout_inspections (id, contract_id, inspection_date, overall_condition, notes, total_deductions, refund_amount, status, created_at, updated_at, created_by, reviewed_by, reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          contractIds[3 + i],
          '2024-12-28',
          i === 0 ? 'good' : 'average',
          i === 0 ? '房间保持良好' : '有轻微损坏',
          i === 0 ? 0 : 300,
          i === 0 ? 6000 : 5700,
          i === 0 ? 'approved' : 'pending',
          now,
          now,
          operators[0],
          i === 0 ? operators[1] : null,
          i === 0 ? now : null
        ]
      );
    }
    
    for (let i = 0; i < 2; i++) {
      const id = DBUtils.generateId();
      
      DBUtils.runQuery(
        `INSERT INTO pending_contracts (id, contract_id, request_type, request_data, status, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          contractIds[1 + i],
          i === 0 ? 'renewal' : 'checkout',
          JSON.stringify({ note: `待确认${i === 0 ? '续租' : '退租'}请求` }),
          'pending',
          now,
          operators[0]
        ]
      );
    }
    
    res.json({ success: true, message: '样例数据生成成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
