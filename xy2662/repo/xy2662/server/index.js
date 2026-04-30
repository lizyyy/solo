const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const fs = require('fs');
const db = require('./database');
const { insertSampleData } = require('./sample-data');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

app.get('/api/bookings', async (req, res) => {
  try {
    const filters = {};
    if (req.query.booking_date) filters.booking_date = req.query.booking_date;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.search) filters.search = req.query.search;

    const bookings = await db.getBookings(filters);
    
    const bookingsWithOverdue = bookings.map(booking => ({
      ...booking,
      is_overdue: db.isOverdue(booking)
    }));

    res.json({ success: true, data: bookingsWithOverdue });
  } catch (error) {
    console.error('获取预约列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/bookings/:id', async (req, res) => {
  try {
    const booking = await db.getBookingById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ success: false, error: '预约不存在' });
    }

    const auditLogs = await db.getAuditLogs(req.params.id);

    res.json({
      success: true,
      data: {
        ...booking,
        is_overdue: db.isOverdue(booking),
        audit_logs: auditLogs
      }
    });
  } catch (error) {
    console.error('获取预约详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const {
      customer_name, phone, studio, booking_date,
      start_time, end_time, deposit_amount, note
    } = req.body;

    if (!customer_name || !phone || !studio || !booking_date || 
        !start_time || !end_time) {
      return res.status(400).json({ 
        success: false, 
        error: '客户姓名、电话、棚位、日期、时间段为必填项' 
      });
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ 
        success: false, 
        error: '请输入有效的手机号码' 
      });
    }

    const id = await db.createBooking({
      customer_name, phone, studio, booking_date,
      start_time, end_time, 
      deposit_amount: deposit_amount || 0,
      note
    });

    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('创建预约失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.put('/api/bookings/:id', async (req, res) => {
  try {
    const {
      customer_name, phone, studio, booking_date,
      start_time, end_time, deposit_amount, note
    } = req.body;

    if (!customer_name || !phone || !studio || !booking_date || 
        !start_time || !end_time) {
      return res.status(400).json({ 
        success: false, 
        error: '客户姓名、电话、棚位、日期、时间段为必填项' 
      });
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ 
        success: false, 
        error: '请输入有效的手机号码' 
      });
    }

    await db.updateBooking(req.params.id, {
      customer_name, phone, studio, booking_date,
      start_time, end_time,
      deposit_amount: deposit_amount || 0,
      note
    });

    res.json({ success: true });
  } catch (error) {
    console.error('更新预约失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.patch('/api/bookings/:id/status', async (req, res) => {
  try {
    const { status, note } = req.body;

    if (!status) {
      return res.status(400).json({ 
        success: false, 
        error: '状态为必填项' 
      });
    }

    const validStatuses = ['pending', 'deposited', 'verified', 'refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的状态值' 
      });
    }

    await db.updateStatus(req.params.id, status, note);

    res.json({ success: true });
  } catch (error) {
    console.error('更新状态失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/csv/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请选择 CSV 文件' });
    }

    const results = [];
    const errors = [];
    let rowNumber = 1;

    const stream = fs.createReadStream(req.file.path)
      .pipe(csv());

    for await (const row of stream) {
      rowNumber++;
      try {
        const customer_name = row['客户姓名'] || row['customer_name'] || row['name'];
        const phone = (row['联系电话'] || row['电话'] || row['phone'] || '').toString().trim();
        const studio = (row['棚位'] || row['棚位编号'] || row['studio'] || '').toString().trim();
        const booking_date = row['预约日期'] || row['日期'] || row['booking_date'];
        const start_time = (row['开始时间'] || row['start_time'] || row['time'] || '').toString().trim();
        const end_time = (row['结束时间'] || row['end_time'] || '').toString().trim();
        const deposit_amount = parseFloat(row['押金金额'] || row['deposit_amount'] || row['amount'] || '0');
        const status = (row['状态'] || row['status'] || 'pending').toString().trim().toLowerCase();
        const note = row['备注'] || row['note'] || '';

        if (!customer_name || !phone || !studio || !booking_date) {
          errors.push(`第 ${rowNumber} 行: 缺少必填字段（客户姓名、电话、棚位、日期）`);
          continue;
        }

        let actualStartTime = start_time;
        let actualEndTime = end_time;

        if (!start_time || !end_time) {
          actualStartTime = '09:00';
          actualEndTime = '12:00';
        }

        let actualStatus = status;
        const statusMap = {
          '待收押金': 'pending',
          '已收押金': 'deposited',
          '已核销': 'verified',
          '已退款': 'refunded',
          'pending': 'pending',
          'deposited': 'deposited',
          'verified': 'verified',
          'refunded': 'refunded'
        };
        
        if (statusMap[status]) {
          actualStatus = statusMap[status];
        } else {
          actualStatus = 'pending';
        }

        const bookingData = {
          customer_name,
          phone,
          studio,
          booking_date,
          start_time: actualStartTime,
          end_time: actualEndTime,
          deposit_amount,
          note
        };

        const id = await db.createBooking(bookingData);

        if (actualStatus === 'deposited') {
          await db.updateStatus(id, 'deposited', `CSV导入 - 收取押金 ¥${deposit_amount}`);
        } else if (actualStatus === 'verified') {
          await db.updateStatus(id, 'deposited', `CSV导入 - 收取押金 ¥${deposit_amount}`);
          await db.updateStatus(id, 'verified', 'CSV导入 - 核销预约');
        } else if (actualStatus === 'refunded') {
          if (deposit_amount > 0) {
            await db.updateStatus(id, 'deposited', `CSV导入 - 收取押金 ¥${deposit_amount}`);
          }
          await db.updateStatus(id, 'refunded', 'CSV导入 - 退回押金');
        }

        results.push({ row: rowNumber, customer_name, status: actualStatus });
      } catch (e) {
        errors.push(`第 ${rowNumber} 行: ${e.message}`);
      }
    }

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: {
        imported: results.length,
        errors: errors.length,
        details: results,
        error_details: errors
      }
    });
  } catch (error) {
    console.error('CSV 导入失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/csv/export', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const date = req.query.date || today;

    const bookings = await db.getBookings({ booking_date: date });

    const data = bookings.map(booking => ({
      '预约ID': booking.id,
      '客户姓名': booking.customer_name,
      '联系电话': booking.phone,
      '棚位': booking.studio,
      '预约日期': booking.booking_date,
      '开始时间': booking.start_time,
      '结束时间': booking.end_time,
      '押金金额': booking.deposit_amount,
      '状态': db.getStatusName(booking.status),
      '备注': booking.note || '',
      '创建时间': booking.created_at,
      '更新时间': booking.updated_at
    }));

    if (data.length === 0) {
      data.push({
        '预约ID': '',
        '客户姓名': '',
        '联系电话': '',
        '棚位': '',
        '预约日期': date,
        '开始时间': '',
        '结束时间': '',
        '押金金额': '',
        '状态': '',
        '备注': '当日无预约记录',
        '创建时间': '',
        '更新时间': ''
      });
    }

    const parser = new Parser({
      fields: [
        '预约ID', '客户姓名', '联系电话', '棚位',
        '预约日期', '开始时间', '结束时间',
        '押金金额', '状态', '备注', '创建时间', '更新时间'
      ]
    });
    
    const csvContent = parser.parse(data);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=核销报表_${date}.csv`);
    res.send('\uFEFF' + csvContent);
  } catch (error) {
    console.error('CSV 导出失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/csv/all', async (req, res) => {
  try {
    const bookings = await db.getBookings();

    const data = bookings.map(booking => ({
      '预约ID': booking.id,
      '客户姓名': booking.customer_name,
      '联系电话': booking.phone,
      '棚位': booking.studio,
      '预约日期': booking.booking_date,
      '开始时间': booking.start_time,
      '结束时间': booking.end_time,
      '押金金额': booking.deposit_amount,
      '状态': db.getStatusName(booking.status),
      '备注': booking.note || '',
      '创建时间': booking.created_at,
      '更新时间': booking.updated_at
    }));

    if (data.length === 0) {
      data.push({
        '预约ID': '',
        '客户姓名': '',
        '联系电话': '',
        '棚位': '',
        '预约日期': '',
        '开始时间': '',
        '结束时间': '',
        '押金金额': '',
        '状态': '',
        '备注': '暂无预约记录',
        '创建时间': '',
        '更新时间': ''
      });
    }

    const parser = new Parser({
      fields: [
        '预约ID', '客户姓名', '联系电话', '棚位',
        '预约日期', '开始时间', '结束时间',
        '押金金额', '状态', '备注', '创建时间', '更新时间'
      ]
    });
    
    const csvContent = parser.parse(data);

    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=全部预约_${today}.csv`);
    res.send('\uFEFF' + csvContent);
  } catch (error) {
    console.error('CSV 导出失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/status-info', (req, res) => {
  res.json({
    success: true,
    data: {
      status_flow: db.STATUS_FLOW,
      status_names: db.STATUS_NAMES
    }
  });
});

app.get('/api/studios', (req, res) => {
  res.json({
    success: true,
    data: ['A', 'B', 'C', 'D']
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ success: true, message: '服务正常运行' });
});

async function startServer() {
  try {
    console.log('初始化数据库...');
    await db.init();
    
    console.log('检查示例数据...');
    await insertSampleData();
    
    app.listen(PORT, () => {
      console.log('========================================');
      console.log('  预约押金核销台系统已启动');
      console.log('========================================');
      console.log(`  服务地址: http://localhost:${PORT}`);
      console.log('========================================');
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

startServer();
