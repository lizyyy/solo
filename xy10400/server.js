const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  return getInitialData();
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getInitialData() {
  return {
    returnOrders: [
      {
        id: 'RO20260501001',
        returnBoxId: 'BOX001',
        originalSku: 'CLOTH-001',
        originalBatch: 'BATCH-CLOTH-202603',
        returnDate: '2026-05-01',
        returnQty: 50,
        status: 'pending',
        inspectionStatus: null,
        inspectionNote: null,
        inspectionDate: null,
        relabelQty: 0,
        newLabel: null,
        history: [
          {
            timestamp: '2026-05-01T09:00:00',
            action: '退货入库',
            description: '接收退货箱 BOX001，男式T恤 CLOTH-001，批次 BATCH-CLOTH-202603，数量 50'
          }
        ]
      },
      {
        id: 'RO20260502002',
        returnBoxId: 'BOX002',
        originalSku: 'APPLIANCE-001',
        originalBatch: 'BATCH-APP-202604',
        returnDate: '2026-05-02',
        returnQty: 20,
        status: 'inspected',
        inspectionStatus: 'qualified',
        inspectionNote: '包装磨损，产品完好，全部可换标',
        inspectionDate: '2026-05-03',
        relabelQty: 20,
        newLabel: 'APPLIANCE-001-R1',
        history: [
          {
            timestamp: '2026-05-02T10:30:00',
            action: '退货入库',
            description: '接收退货箱 BOX002，电饭煲 APPLIANCE-001，批次 BATCH-APP-202604，数量 20'
          },
          {
            timestamp: '2026-05-03T14:00:00',
            action: '质检完成',
            description: '质检结果：合格，包装磨损，产品完好，全部可换标'
          },
          {
            timestamp: '2026-05-03T15:00:00',
            action: '换标完成',
            description: '换标数量 20，新标签 APPLIANCE-001-R1，重新入库完成'
          }
        ]
      },
      {
        id: 'RO20260503003',
        returnBoxId: 'BOX003',
        originalSku: 'CLOTH-002',
        originalBatch: 'BATCH-CLOTH-202602',
        returnDate: '2026-05-03',
        returnQty: 30,
        status: 'inspected',
        inspectionStatus: 'partial',
        inspectionNote: '15件完好可换标，15件有污渍报废',
        inspectionDate: '2026-05-04',
        relabelQty: 15,
        newLabel: 'CLOTH-002-R2',
        history: [
          {
            timestamp: '2026-05-03T11:00:00',
            action: '退货入库',
            description: '接收退货箱 BOX003，女式连衣裙 CLOTH-002，批次 BATCH-CLOTH-202602，数量 30'
          },
          {
            timestamp: '2026-05-04T09:00:00',
            action: '质检完成',
            description: '质检结果：部分合格，15件完好可换标，15件有污渍报废'
          },
          {
            timestamp: '2026-05-04T10:30:00',
            action: '换标完成',
            description: '换标数量 15，新标签 CLOTH-002-R2，重新入库完成，报废 15 件'
          }
        ]
      },
      {
        id: 'RO20260504004',
        returnBoxId: 'BOX004',
        originalSku: 'APPLIANCE-002',
        originalBatch: 'BATCH-APP-202601',
        returnDate: '2026-05-04',
        returnQty: 10,
        status: 'relabeled',
        inspectionStatus: 'qualified',
        inspectionNote: '全部合格',
        inspectionDate: '2026-05-05',
        relabelQty: 10,
        newLabel: 'APPLIANCE-002-R1',
        history: [
          {
            timestamp: '2026-05-04T14:00:00',
            action: '退货入库',
            description: '接收退货箱 BOX004，榨汁机 APPLIANCE-002，批次 BATCH-APP-202601，数量 10'
          },
          {
            timestamp: '2026-05-05T10:00:00',
            action: '质检完成',
            description: '质检结果：合格，全部合格'
          },
          {
            timestamp: '2026-05-05T11:00:00',
            action: '换标完成',
            description: '换标数量 10，新标签 APPLIANCE-002-R1，重新入库完成'
          }
        ]
      }
    ],
    newLabels: ['APPLIANCE-001-R1', 'CLOTH-002-R2', 'APPLIANCE-002-R1'],
    skuInfo: {
      'CLOTH-001': { name: '男式纯棉T恤', category: '服饰' },
      'CLOTH-002': { name: '女式碎花连衣裙', category: '服饰' },
      'APPLIANCE-001': { name: '智能电饭煲', category: '小家电' },
      'APPLIANCE-002': { name: '多功能榨汁机', category: '小家电' }
    }
  };
}

app.get('/api/data', (req, res) => {
  const data = loadData();
  res.json(data);
});

app.post('/api/return-orders', (req, res) => {
  const data = loadData();
  const { returnBoxId, originalSku, originalBatch, returnDate, returnQty } = req.body;

  if (!returnBoxId || !originalSku || !originalBatch || !returnDate || !returnQty) {
    return res.status(400).json({ error: '所有必填字段不能为空' });
  }

  if (data.returnOrders.some(o => o.returnBoxId === returnBoxId && o.status !== 'cancelled')) {
    return res.status(400).json({ error: `退货箱 ${returnBoxId} 已存在，防止重复入库` });
  }

  const orderId = `RO${returnDate.replace(/-/g, '')}${String(data.returnOrders.length + 1).padStart(3, '0')}`;
  const newOrder = {
    id: orderId,
    returnBoxId,
    originalSku,
    originalBatch,
    returnDate,
    returnQty: parseInt(returnQty),
    status: 'pending',
    inspectionStatus: null,
    inspectionNote: null,
    inspectionDate: null,
    relabelQty: 0,
    newLabel: null,
    history: [
      {
        timestamp: new Date().toISOString(),
        action: '退货入库',
        description: `接收退货箱 ${returnBoxId}，SKU ${originalSku}，批次 ${originalBatch}，数量 ${returnQty}`
      }
    ]
  };

  data.returnOrders.push(newOrder);
  saveData(data);
  res.json(newOrder);
});

app.post('/api/return-orders/:id/inspect', (req, res) => {
  const data = loadData();
  const order = data.returnOrders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ error: '退货单不存在' });
  }

  if (order.status !== 'pending') {
    return res.status(400).json({ error: '只有待处理的退货单才能进行质检' });
  }

  const { inspectionStatus, inspectionNote, relabelQty, newLabel } = req.body;

  if (!inspectionStatus || !inspectionNote) {
    return res.status(400).json({ error: '质检状态和质检备注不能为空' });
  }

  if (inspectionStatus === 'rejected') {
    order.status = 'rejected';
    order.inspectionStatus = 'rejected';
    order.inspectionNote = inspectionNote;
    order.inspectionDate = new Date().toISOString().split('T')[0];
    order.history.push({
      timestamp: new Date().toISOString(),
      action: '质检完成',
      description: `质检结果：不合格，${inspectionNote}`
    });
    saveData(data);
    return res.json(order);
  }

  const parsedRelabelQty = parseInt(relabelQty);
  if (isNaN(parsedRelabelQty) || parsedRelabelQty <= 0) {
    return res.status(400).json({ error: '换标数量必须大于0' });
  }

  if (parsedRelabelQty > order.returnQty) {
    return res.status(400).json({ 
      error: `换标数量(${parsedRelabelQty})不能超过退货数量(${order.returnQty})` 
    });
  }

  if (!newLabel || newLabel.trim() === '') {
    return res.status(400).json({ error: '新标签不能为空' });
  }

  const existingOrderWithLabel = data.returnOrders.find(
    o => o.newLabel === newLabel.trim() && o.id !== order.id && o.status === 'relabeled'
  );
  
  if (existingOrderWithLabel) {
    return res.status(400).json({ 
      error: `新标签 ${newLabel} 已被退货单 ${existingOrderWithLabel.id} 使用，存在标签冲突` 
    });
  }

  if (data.newLabels.includes(newLabel.trim())) {
    const existingOrder = data.returnOrders.find(
      o => o.newLabel === newLabel.trim() && o.id !== order.id
    );
    if (existingOrder) {
      return res.status(400).json({ 
        error: `新标签 ${newLabel} 已被退货单 ${existingOrder.id} 使用，存在标签冲突` 
      });
    }
  }

  order.status = 'inspected';
  order.inspectionStatus = parsedRelabelQty < order.returnQty ? 'partial' : 'qualified';
  order.inspectionNote = inspectionNote;
  order.inspectionDate = new Date().toISOString().split('T')[0];
  order.relabelQty = parsedRelabelQty;
  order.newLabel = newLabel.trim();

  if (!data.newLabels.includes(newLabel.trim())) {
    data.newLabels.push(newLabel.trim());
  }

  let historyDesc = `质检结果：${order.inspectionStatus === 'qualified' ? '全部合格' : '部分合格'}，${inspectionNote}`;
  if (parsedRelabelQty < order.returnQty) {
    historyDesc += `，可换标 ${parsedRelabelQty} 件，报废 ${order.returnQty - parsedRelabelQty} 件`;
  }
  order.history.push({
    timestamp: new Date().toISOString(),
    action: '质检完成',
    description: historyDesc
  });

  saveData(data);
  res.json(order);
});

app.post('/api/return-orders/:id/relabel', (req, res) => {
  const data = loadData();
  const order = data.returnOrders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ error: '退货单不存在' });
  }

  if (order.status !== 'inspected') {
    return res.status(400).json({ error: '只有质检通过的退货单才能进行换标入库' });
  }

  if (order.inspectionStatus === 'rejected') {
    return res.status(400).json({ error: '质检不合格的退货单不能进行换标入库' });
  }

  order.status = 'relabeled';
  order.history.push({
    timestamp: new Date().toISOString(),
    action: '换标完成',
    description: `换标数量 ${order.relabelQty}，新标签 ${order.newLabel}，重新入库完成`
  });

  saveData(data);
  res.json(order);
});

app.get('/api/stats', (req, res) => {
  const data = loadData();
  const pending = data.returnOrders.filter(o => o.status === 'pending').length;
  const inspected = data.returnOrders.filter(o => o.status === 'inspected').length;
  const relabeled = data.returnOrders.filter(o => o.status === 'relabeled').length;
  const rejected = data.returnOrders.filter(o => o.status === 'rejected').length;

  const totalReturnQty = data.returnOrders.reduce((sum, o) => sum + o.returnQty, 0);
  const totalRelabelQty = data.returnOrders.reduce((sum, o) => sum + o.relabelQty, 0);
  const totalScrapped = totalReturnQty - totalRelabelQty;

  res.json({
    pending,
    inspected,
    relabeled,
    rejected,
    totalReturnQty,
    totalRelabelQty,
    totalScrapped
  });
});

app.get('/api/export', (req, res) => {
  const data = loadData();
  const orders = data.returnOrders.filter(o => o.status === 'relabeled');
  
  let csv = '退货单号,退货箱号,原SKU,SKU名称,原批次,退货日期,退货数量,质检状态,质检日期,换标数量,新标签,报废数量\n';
  
  orders.forEach(order => {
    const skuInfo = data.skuInfo[order.originalSku] || { name: order.originalSku, category: '' };
    const scrappedQty = order.returnQty - order.relabelQty;
    csv += `${order.id},${order.returnBoxId},${order.originalSku},${skuInfo.name},${order.originalBatch},${order.returnDate},${order.returnQty},${order.inspectionStatus},${order.inspectionDate || ''},${order.relabelQty},${order.newLabel},${scrappedQty}\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=relabel-details.csv');
  res.send('\uFEFF' + csv);
});

app.post('/api/reset', (req, res) => {
  const data = getInitialData();
  saveData(data);
  res.json({ message: '数据已重置为初始样例' });
});

app.listen(PORT, () => {
  console.log(`换标退货批次追踪台运行在 http://localhost:${PORT}`);
});
