const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'standalone-db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = {
  equipment: [],
  rentals: [],
  deposit_transactions: [],
  damages: [],
  renewals: [],
  settlements: [],
  exception_logs: []
};

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {
    console.log('使用空数据库');
  }
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function momentAdd(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendCSV(res, csv) {
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename=settlements.csv'
  });
  res.end('\ufeff' + csv);
}

loadDB();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3000');
  const pathname = url.pathname;
  const method = req.method;

  if (pathname === '/health' && method === 'GET') {
    return sendJSON(res, { status: 'ok', service: '租赁设备押金API (零依赖版)' });
  }

  if (pathname === '/api/equipment' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.equipment });
  }

  if (pathname === '/api/equipment' && method === 'POST') {
    const body = await parseBody(req);
    const id = uuidv4();
    const equip = {
      id,
      name: body.name || '未命名设备',
      category: body.category || '未分类',
      daily_rate: body.daily_rate || 100,
      deposit_amount: body.deposit_amount || 2000,
      status: 'available',
      created_at: new Date().toISOString()
    };
    db.equipment.push(equip);
    saveDB();
    return sendJSON(res, { success: true, data: { id } }, 201);
  }

  if (pathname === '/api/rentals' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.rentals });
  }

  if (pathname === '/api/rentals' && method === 'POST') {
    const body = await parseBody(req);
    const equipment = db.equipment.find(e => e.id === body.equipment_id);
    
    if (!equipment) {
      const exId = uuidv4();
      db.exception_logs.push({
        id: exId,
        api_path: '/api/rentals',
        request_method: 'POST',
        raw_input: JSON.stringify(body),
        error_message: '设备不存在',
        processing_result: 'failed',
        operator: body.created_by || null,
        created_at: new Date().toISOString()
      });
      saveDB();
      return sendJSON(res, { success: false, error: '设备不存在' }, 400);
    }

    const id = uuidv4();
    const rentalNo = 'RN' + Date.now();
    const rental = {
      id,
      rental_no: rentalNo,
      customer_id: body.customer_id,
      customer_name: body.customer_name,
      equipment_id: body.equipment_id,
      start_date: body.start_date,
      end_date: body.end_date,
      total_deposit: equipment.deposit_amount,
      remaining_deposit: equipment.deposit_amount,
      status: 'pending',
      created_by: body.created_by,
      created_at: new Date().toISOString()
    };
    db.rentals.push(rental);
    
    const equipIdx = db.equipment.findIndex(e => e.id === body.equipment_id);
    db.equipment[equipIdx].status = 'rented';
    
    saveDB();
    return sendJSON(res, { success: true, data: { id, rental_no: rentalNo } }, 201);
  }

  const rentalMatch = pathname.match(/^\/api\/rentals\/([^\/]+)$/);
  if (rentalMatch && method === 'GET') {
    const rentalId = rentalMatch[1];
    const rental = db.rentals.find(r => r.id === rentalId);
    if (!rental) {
      return sendJSON(res, { success: false, error: '租赁单不存在' }, 404);
    }
    const equipment = db.equipment.find(e => e.id === rental.equipment_id);
    const transactions = db.deposit_transactions.filter(t => t.rental_id === rentalId);
    const damages = db.damages.filter(d => d.rental_id === rentalId);
    const renewals = db.renewals.filter(r => r.rental_id === rentalId);
    const settlement = db.settlements.find(s => s.rental_id === rentalId);
    
    return sendJSON(res, {
      success: true,
      data: { rental, equipment, transactions, damages, renewals, settlement }
    });
  }

  const freezeMatch = pathname.match(/^\/api\/rentals\/([^\/]+)\/freeze-deposit$/);
  if (freezeMatch && method === 'POST') {
    const rentalId = freezeMatch[1];
    const body = await parseBody(req);
    const rental = db.rentals.find(r => r.id === rentalId);
    
    if (!rental) {
      const exId = uuidv4();
      db.exception_logs.push({
        id: exId,
        api_path: '/api/rentals/:id/freeze-deposit',
        request_method: 'POST',
        raw_input: JSON.stringify(body),
        error_message: '租赁单不存在',
        processing_result: 'failed',
        operator: body.operator || null,
        created_at: new Date().toISOString()
      });
      saveDB();
      return sendJSON(res, { success: false, error: '租赁单不存在' }, 400);
    }

    const existingTx = db.deposit_transactions.find(t => t.request_id === body.request_id);
    if (existingTx) {
      return sendJSON(res, { success: true, data: { message: '押金已冻结（幂等）', transaction: existingTx } });
    }

    const txId = uuidv4();
    db.deposit_transactions.push({
      id: txId,
      rental_id: rentalId,
      transaction_type: 'freeze',
      amount: rental.total_deposit,
      request_id: body.request_id,
      operator: body.operator,
      remark: '押金冻结',
      created_at: new Date().toISOString()
    });

    const rentalIdx = db.rentals.findIndex(r => r.id === rentalId);
    db.rentals[rentalIdx].status = 'deposit_frozen';
    
    saveDB();
    return sendJSON(res, { success: true, data: { message: '押金冻结成功' } });
  }

  const renewMatch = pathname.match(/^\/api\/rentals\/([^\/]+)\/renew$/);
  if (renewMatch && method === 'POST') {
    const rentalId = renewMatch[1];
    const body = await parseBody(req);
    const rental = db.rentals.find(r => r.id === rentalId);
    
    if (!rental) {
      return sendJSON(res, { success: false, error: '租赁单不存在' }, 400);
    }

    const existingRenewal = db.renewals.find(r => r.request_id === body.request_id);
    if (existingRenewal) {
      return sendJSON(res, { success: true, data: { message: '续租已处理（幂等）', renewal: existingRenewal } });
    }

    const equipment = db.equipment.find(e => e.id === rental.equipment_id);
    const extensionFee = body.extension_days * equipment.daily_rate;
    const newEndDate = momentAdd(body.extension_days);

    const renewalId = uuidv4();
    db.renewals.push({
      id: renewalId,
      rental_id: rentalId,
      request_id: body.request_id,
      original_end_date: rental.end_date,
      new_end_date: newEndDate,
      extension_days: body.extension_days,
      extension_fee: extensionFee,
      operator: body.operator,
      created_at: new Date().toISOString()
    });

    const rentalIdx = db.rentals.findIndex(r => r.id === rentalId);
    db.rentals[rentalIdx].end_date = newEndDate;
    db.rentals[rentalIdx].remaining_deposit = Math.max(0, rental.remaining_deposit - extensionFee);

    const txId = uuidv4();
    db.deposit_transactions.push({
      id: txId,
      rental_id: rentalId,
      transaction_type: 'renewal_fee',
      amount: extensionFee,
      request_id: body.request_id + '_tx',
      operator: body.operator,
      remark: `续租${body.extension_days}天费用`,
      created_at: new Date().toISOString()
    });

    saveDB();
    return sendJSON(res, { success: true, data: { message: '续租成功', extensionFee, newEndDate } });
  }

  const damageMatch = pathname.match(/^\/api\/rentals\/([^\/]+)\/damage$/);
  if (damageMatch && method === 'POST') {
    const rentalId = damageMatch[1];
    const body = await parseBody(req);
    const rental = db.rentals.find(r => r.id === rentalId);
    
    if (!rental) {
      return sendJSON(res, { success: false, error: '租赁单不存在' }, 400);
    }

    const damageId = uuidv4();
    db.damages.push({
      id: damageId,
      rental_id: rentalId,
      damage_type: body.damage_type,
      description: body.description,
      deduction_amount: body.deduction_amount,
      reported_by: body.reported_by,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    const newRemaining = Math.max(0, rental.remaining_deposit - body.deduction_amount);
    const rentalIdx = db.rentals.findIndex(r => r.id === rentalId);
    db.rentals[rentalIdx].remaining_deposit = newRemaining;

    const txId = uuidv4();
    db.deposit_transactions.push({
      id: txId,
      rental_id: rentalId,
      transaction_type: 'damage_deduction',
      amount: body.deduction_amount,
      request_id: 'damage_' + damageId,
      operator: body.reported_by,
      remark: `损坏扣款: ${body.damage_type} - ${body.description}`,
      created_at: new Date().toISOString()
    });

    saveDB();
    return sendJSON(res, { success: true, data: { damageId, newRemaining } });
  }

  const settleMatch = pathname.match(/^\/api\/rentals\/([^\/]+)\/settle$/);
  if (settleMatch && method === 'POST') {
    const rentalId = settleMatch[1];
    const body = await parseBody(req);
    const rental = db.rentals.find(r => r.id === rentalId);
    
    if (!rental) {
      return sendJSON(res, { success: false, error: '租赁单不存在' }, 400);
    }

    const existingSettlement = db.settlements.find(s => s.rental_id === rentalId);
    if (existingSettlement) {
      return sendJSON(res, { success: true, data: { message: '结算已完成', settlement: existingSettlement } });
    }

    const equipment = db.equipment.find(e => e.id === rental.equipment_id);
    const damages = db.damages.filter(d => d.rental_id === rentalId);
    const renewals = db.renewals.filter(r => r.rental_id === rentalId);

    const damageDeduction = damages.reduce((sum, d) => sum + d.deduction_amount, 0);
    const renewalFee = renewals.reduce((sum, r) => sum + r.extension_fee, 0);
    const overdueFee = 0;
    const totalDeductions = damageDeduction + renewalFee + overdueFee;
    const refundAmount = Math.max(0, rental.total_deposit - totalDeductions);

    const settlementId = uuidv4();
    const settlementNo = 'ST' + Date.now();
    db.settlements.push({
      id: settlementId,
      rental_id: rentalId,
      settlement_no: settlementNo,
      total_deposit: rental.total_deposit,
      damage_deduction: damageDeduction,
      overdue_fee: overdueFee,
      renewal_fee: renewalFee,
      refund_amount: refundAmount,
      generated_by: body.generated_by,
      generated_at: new Date().toISOString()
    });

    if (refundAmount > 0) {
      const txId = uuidv4();
      db.deposit_transactions.push({
        id: txId,
        rental_id: rentalId,
        transaction_type: 'refund',
        amount: refundAmount,
        request_id: 'refund_' + rentalId,
        operator: body.generated_by,
        remark: '押金退款',
        created_at: new Date().toISOString()
      });
    }

    const rentalIdx = db.rentals.findIndex(r => r.id === rentalId);
    db.rentals[rentalIdx].status = 'completed';
    db.rentals[rentalIdx].actual_end_date = body.actual_end_date;

    const equipIdx = db.equipment.findIndex(e => e.id === rental.equipment_id);
    db.equipment[equipIdx].status = 'available';

    saveDB();
    return sendJSON(res, {
      success: true,
      data: {
        settlement: {
          id: settlementId,
          settlement_no: settlementNo,
          total_deposit: rental.total_deposit,
          damage_deduction: damageDeduction,
          overdue_fee: overdueFee,
          renewal_fee: renewalFee,
          refund_amount: refundAmount
        }
      }
    });
  }

  if (pathname === '/api/settlements' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.settlements });
  }

  if (pathname === '/api/settlements/export' && method === 'GET') {
    const csvHeader = '结算单号,租赁单号,总押金,损坏扣款,逾期费,续租费,退款金额,生成时间\n';
    const csvRows = db.settlements.map(s => 
      `${s.settlement_no},${s.rental_id},${s.total_deposit},${s.damage_deduction},${s.overdue_fee},${s.renewal_fee},${s.refund_amount},${s.generated_at}`
    ).join('\n');
    return sendCSV(res, csvHeader + csvRows);
  }

  if (pathname === '/api/exceptions' && method === 'GET') {
    return sendJSON(res, { success: true, data: db.exception_logs });
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Not Found' }));
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log('═'.repeat(60));
  console.log('  租赁设备押金 API (零依赖版本)');
  console.log('═'.repeat(60));
  console.log('');
  console.log('✅ 使用 Node.js 内置模块，无需 npm install');
  console.log('✅ 本地 JSON 文件持久化');
  console.log('');
  console.log(`服务已启动: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log('');
  console.log('核心功能:');
  console.log('  POST /api/equipment          - 添加设备');
  console.log('  POST /api/rentals            - 创建租赁单');
  console.log('  POST /api/rentals/:id/freeze-deposit  - 押金冻结(幂等)');
  console.log('  POST /api/rentals/:id/renew  - 续租(幂等)');
  console.log('  POST /api/rentals/:id/damage - 损坏扣款');
  console.log('  POST /api/rentals/:id/settle - 结算');
  console.log('  GET  /api/settlements/export - 导出CSV');
  console.log('');
});
