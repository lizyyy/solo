const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.json');

function readJSONFile(filePath, defaultData = []) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return defaultData;
}

function writeJSONFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    return false;
  }
}

function analyzeOrderStatus(order, inventory) {
  const issues = [];
  const warnings = [];
  
  const laceNet = inventory.find(item => item.type === 'lace_net' && item.sku === order.laceNetSku);
  if (!laceNet || laceNet.quantity < order.laceNetQuantity) {
    issues.push({
      type: 'inventory',
      category: 'lace_net_shortage',
      message: `蕾丝网底库存不足: 需要 ${order.laceNetQuantity}, 实际库存 ${laceNet ? laceNet.quantity : 0}`,
      sku: order.laceNetSku,
      required: order.laceNetQuantity,
      available: laceNet ? laceNet.quantity : 0
    });
  }
  
  const hairBatch = inventory.find(item => item.type === 'hair_batch' && item.batchNumber === order.hairBatch);
  if (!hairBatch) {
    issues.push({
      type: 'inventory',
      category: 'hair_batch_not_found',
      message: `发丝批次不存在: ${order.hairBatch}`,
      batchNumber: order.hairBatch
    });
  } else if (hairBatch.quantity < order.hairQuantity) {
    issues.push({
      type: 'inventory',
      category: 'hair_shortage',
      message: `发丝数量不足: 需要 ${order.hairQuantity}, 实际库存 ${hairBatch.quantity}`,
      batchNumber: order.hairBatch,
      required: order.hairQuantity,
      available: hairBatch.quantity
    });
  }
  
  if (hairBatch && order.colorCurve) {
    const colorMatch = hairBatch.colorCurves && hairBatch.colorCurves.includes(order.colorCurve);
    if (!colorMatch) {
      warnings.push({
        type: 'color',
        category: 'color_deviation',
        message: `染色曲线可能不匹配: 订单要求 ${order.colorCurve}, 批次支持 ${hairBatch.colorCurves ? hairBatch.colorCurves.join(', ') : '无'}`,
        orderColor: order.colorCurve,
        batchColors: hairBatch.colorCurves || []
      });
    }
  }
  
  const today = new Date();
  const deadline = new Date(order.deadline);
  const daysToDeadline = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
  
  if (daysToDeadline < 0) {
    issues.push({
      type: 'deadline',
      category: 'deadline_overdue',
      message: `交期已过期: ${order.deadline}`,
      deadline: order.deadline,
      daysOverdue: Math.abs(daysToDeadline)
    });
  } else if (daysToDeadline <= 3) {
    warnings.push({
      type: 'deadline',
      category: 'deadline_urgent',
      message: `交期紧急: 剩余 ${daysToDeadline} 天`,
      deadline: order.deadline,
      daysRemaining: daysToDeadline
    });
  }
  
  if (order.headCircumference) {
    const { min, max } = order.headCircumference;
    if (min < 50 || max > 65) {
      warnings.push({
        type: 'measurement',
        category: 'size_anomaly',
        message: `头围尺寸异常: ${min}cm - ${max}cm (正常范围 50-65cm)`,
        measurement: order.headCircumference
      });
    }
  }
  
  let status = 'ready';
  if (issues.length > 0) {
    status = 'needs_communication';
  } else if (warnings.length > 0) {
    status = 'needs_material';
  }
  
  return {
    status,
    issues,
    warnings,
    canStart: issues.length === 0
  };
}

app.get('/api/orders', (req, res) => {
  const orders = readJSONFile(ORDERS_FILE, []);
  res.json(orders);
});

app.get('/api/orders/:id', (req, res) => {
  const orders = readJSONFile(ORDERS_FILE, []);
  const order = orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  res.json(order);
});

app.post('/api/orders', (req, res) => {
  const orders = readJSONFile(ORDERS_FILE, []);
  const inventory = readJSONFile(INVENTORY_FILE, []);
  const { v4: uuidv4 } = require('uuid');
  
  const newOrder = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const analysis = analyzeOrderStatus(newOrder, inventory);
  newOrder.analysis = analysis;
  newOrder.finalStatus = analysis.status;
  newOrder.manualOverride = null;
  
  orders.push(newOrder);
  writeJSONFile(ORDERS_FILE, orders);
  
  res.status(201).json(newOrder);
});

app.put('/api/orders/:id', (req, res) => {
  const orders = readJSONFile(ORDERS_FILE, []);
  const inventory = readJSONFile(INVENTORY_FILE, []);
  const index = orders.findIndex(o => o.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: '订单不存在' });
  }
  
  const updatedOrder = {
    ...orders[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  
  const analysis = analyzeOrderStatus(updatedOrder, inventory);
  updatedOrder.analysis = analysis;
  
  if (!updatedOrder.manualOverride) {
    updatedOrder.finalStatus = analysis.status;
  }
  
  orders[index] = updatedOrder;
  writeJSONFile(ORDERS_FILE, orders);
  
  res.json(updatedOrder);
});

app.post('/api/orders/:id/manual-status', (req, res) => {
  const orders = readJSONFile(ORDERS_FILE, []);
  const reviews = readJSONFile(REVIEWS_FILE, []);
  const { v4: uuidv4 } = require('uuid');
  const index = orders.findIndex(o => o.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: '订单不存在' });
  }
  
  const { status, note } = req.body;
  
  const newReview = {
    id: uuidv4(),
    orderId: req.params.id,
    previousStatus: orders[index].finalStatus,
    newStatus: status,
    note: note || '',
    createdAt: new Date().toISOString()
  };
  
  reviews.push(newReview);
  writeJSONFile(REVIEWS_FILE, reviews);
  
  orders[index].manualOverride = {
    status,
    note: note || '',
    at: new Date().toISOString()
  };
  orders[index].finalStatus = status;
  orders[index].updatedAt = new Date().toISOString();
  
  writeJSONFile(ORDERS_FILE, orders);
  
  res.json({ order: orders[index], review: newReview });
});

app.get('/api/reviews', (req, res) => {
  const reviews = readJSONFile(REVIEWS_FILE, []);
  res.json(reviews);
});

app.get('/api/reviews/order/:orderId', (req, res) => {
  const reviews = readJSONFile(REVIEWS_FILE, []);
  const orderReviews = reviews.filter(r => r.orderId === req.params.orderId);
  res.json(orderReviews);
});

app.get('/api/inventory', (req, res) => {
  const inventory = readJSONFile(INVENTORY_FILE, []);
  res.json(inventory);
});

app.post('/api/inventory', (req, res) => {
  const inventory = readJSONFile(INVENTORY_FILE, []);
  const { v4: uuidv4 } = require('uuid');
  
  const newItem = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  inventory.push(newItem);
  writeJSONFile(INVENTORY_FILE, inventory);
  
  res.status(201).json(newItem);
});

app.get('/api/export/markdown/:orderId', (req, res) => {
  const orders = readJSONFile(ORDERS_FILE, []);
  const reviews = readJSONFile(REVIEWS_FILE, []);
  const order = orders.find(o => o.id === req.params.orderId);
  
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  
  const orderReviews = reviews.filter(r => r.orderId === order.id);
  
  let markdown = `# 假发定制生产交接单\n\n`;
  markdown += `## 基本信息\n\n`;
  markdown += `- **订单编号**: ${order.id}\n`;
  markdown += `- **客户姓名**: ${order.customerName || '-'}\n`;
  markdown += `- **创建时间**: ${order.createdAt ? new Date(order.createdAt).toLocaleString('zh-CN') : '-'}\n`;
  markdown += `- **发货期限**: ${order.deadline || '-'}\n`;
  markdown += `- **订单状态**: ${order.finalStatus || order.analysis?.status || '-'}\n\n`;
  
  markdown += `## 尺寸信息\n\n`;
  if (order.headCircumference) {
    markdown += `- **头围范围**: ${order.headCircumference.min}cm - ${order.headCircumference.max}cm\n`;
  }
  if (order.headMoldMeasurements) {
    markdown += `- **头模尺寸**:\n`;
    for (const [key, value] of Object.entries(order.headMoldMeasurements)) {
      markdown += `  - ${key}: ${value}cm\n`;
    }
  }
  markdown += `\n`;
  
  markdown += `## 产品规格\n\n`;
  markdown += `- **发丝批次**: ${order.hairBatch || '-'}\n`;
  markdown += `- **发丝数量**: ${order.hairQuantity || '-'}g\n`;
  markdown += `- **染色曲线**: ${order.colorCurve || '-'}\n`;
  markdown += `- **蕾丝网底SKU**: ${order.laceNetSku || '-'}\n`;
  markdown += `- **蕾丝网底数量**: ${order.laceNetQuantity || '-'}\n\n`;
  
  markdown += `## 试戴与备注\n\n`;
  if (order.fittingPhotos && order.fittingPhotos.length > 0) {
    markdown += `- **试戴照片**:\n`;
    order.fittingPhotos.forEach((photo, index) => {
      markdown += `  ${index + 1}. ${photo.url}${photo.note ? ` (${photo.note})` : ''}\n`;
    });
  }
  if (order.notes) {
    markdown += `- **备注**: ${order.notes}\n`;
  }
  markdown += `\n`;
  
  markdown += `## 状态分析\n\n`;
  if (order.analysis) {
    markdown += `- **能否开工**: ${order.analysis.canStart ? '是' : '否'}\n`;
    markdown += `- **系统判定状态**: ${order.analysis.status}\n\n`;
    
    if (order.analysis.issues && order.analysis.issues.length > 0) {
      markdown += `### 问题列表\n\n`;
      order.analysis.issues.forEach((issue, index) => {
        markdown += `${index + 1}. **[${issue.category}]** ${issue.message}\n`;
      });
      markdown += `\n`;
    }
    
    if (order.analysis.warnings && order.analysis.warnings.length > 0) {
      markdown += `### 警告列表\n\n`;
      order.analysis.warnings.forEach((warning, index) => {
        markdown += `${index + 1}. **[${warning.category}]** ${warning.message}\n`;
      });
      markdown += `\n`;
    }
  }
  
  if (order.manualOverride) {
    markdown += `## 人工改判\n\n`;
    markdown += `- **改判状态**: ${order.manualOverride.status}\n`;
    markdown += `- **改判时间**: ${new Date(order.manualOverride.at).toLocaleString('zh-CN')}\n`;
    if (order.manualOverride.note) {
      markdown += `- **改判备注**: ${order.manualOverride.note}\n`;
    }
    markdown += `\n`;
  }
  
  if (orderReviews.length > 0) {
    markdown += `## 复核记录\n\n`;
    orderReviews.forEach((review, index) => {
      markdown += `### 复核 ${index + 1}\n\n`;
      markdown += `- **时间**: ${new Date(review.createdAt).toLocaleString('zh-CN')}\n`;
      markdown += `- **从状态**: ${review.previousStatus}\n`;
      markdown += `- **到状态**: ${review.newStatus}\n`;
      if (review.note) {
        markdown += `- **备注**: ${review.note}\n`;
      }
      markdown += `\n`;
    });
  }
  
  res.set('Content-Type', 'text/markdown');
  res.set('Content-Disposition', `attachment; filename=order-${order.id}.md`);
  res.send(markdown);
});

app.get('/api/export/json/:orderId', (req, res) => {
  const orders = readJSONFile(ORDERS_FILE, []);
  const reviews = readJSONFile(REVIEWS_FILE, []);
  const order = orders.find(o => o.id === req.params.orderId);
  
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  
  const orderReviews = reviews.filter(r => r.orderId === order.id);
  
  const exportData = {
    order,
    reviews: orderReviews,
    exportedAt: new Date().toISOString()
  };
  
  res.set('Content-Type', 'application/json');
  res.set('Content-Disposition', `attachment; filename=order-${order.id}.json`);
  res.json(exportData);
});

app.get('/api/export/json', (req, res) => {
  const orders = readJSONFile(ORDERS_FILE, []);
  const reviews = readJSONFile(REVIEWS_FILE, []);
  const inventory = readJSONFile(INVENTORY_FILE, []);
  
  const exportData = {
    orders,
    reviews,
    inventory,
    exportedAt: new Date().toISOString()
  };
  
  res.set('Content-Type', 'application/json');
  res.set('Content-Disposition', 'attachment; filename=full-data.json');
  res.json(exportData);
});

app.get('/api/init-sample-data', (req, res) => {
  const { v4: uuidv4 } = require('uuid');
  
  const sampleInventory = [
    {
      id: uuidv4(),
      type: 'hair_batch',
      batchNumber: 'HB-2024-001',
      name: '巴西顺发 20寸 自然黑',
      color: '#1B',
      colorCurves: ['natural_black', 'dark_brown', 'medium_brown'],
      quantity: 500,
      unit: 'g',
      supplier: '巴西毛发供应商A',
      createdAt: new Date('2024-01-15').toISOString(),
      updatedAt: new Date('2024-01-15').toISOString()
    },
    {
      id: uuidv4(),
      type: 'hair_batch',
      batchNumber: 'HB-2024-002',
      name: '印度发 18寸 深棕',
      color: '#2',
      colorCurves: ['dark_brown', 'medium_brown', 'light_brown'],
      quantity: 300,
      unit: 'g',
      supplier: '印度毛发供应商B',
      createdAt: new Date('2024-02-01').toISOString(),
      updatedAt: new Date('2024-02-01').toISOString()
    },
    {
      id: uuidv4(),
      type: 'lace_net',
      sku: 'LN-SWISS-001',
      name: '瑞士网 13x4 透明色',
      type: 'lace_net',
      material: 'swiss_lace',
      size: '13x4',
      color: 'transparent',
      quantity: 20,
      unit: '片',
      supplier: '蕾丝网供应商C',
      createdAt: new Date('2024-01-20').toISOString(),
      updatedAt: new Date('2024-01-20').toISOString()
    },
    {
      id: uuidv4(),
      type: 'lace_net',
      sku: 'LN-HD-002',
      name: 'HD网 4x4 浅棕色',
      type: 'lace_net',
      material: 'hd_lace',
      size: '4x4',
      color: 'light_brown',
      quantity: 5,
      unit: '片',
      supplier: '蕾丝网供应商C',
      createdAt: new Date('2024-02-10').toISOString(),
      updatedAt: new Date('2024-02-10').toISOString()
    }
  ];
  
  const sampleOrders = [
    {
      id: uuidv4(),
      customerName: '张女士',
      customerPhone: '13800138001',
      headCircumference: {
        min: 54,
        max: 56
      },
      headMoldMeasurements: {
        '前后径': 35,
        '左右径': 28,
        '耳上距': 30
      },
      hairBatch: 'HB-2024-001',
      hairQuantity: 150,
      colorCurve: 'natural_black',
      laceNetSku: 'LN-SWISS-001',
      laceNetQuantity: 1,
      fittingPhotos: [
        {
          url: 'https://example.com/photo1.jpg',
          note: '试戴正面照，发际线调整中'
        }
      ],
      notes: '客户要求发际线自然，不要太密',
      deadline: '2024-12-20',
      createdAt: new Date('2024-11-10').toISOString(),
      updatedAt: new Date('2024-11-10').toISOString(),
      analysis: null,
      finalStatus: null,
      manualOverride: null
    },
    {
      id: uuidv4(),
      customerName: '李女士',
      customerPhone: '13900139002',
      headCircumference: {
        min: 58,
        max: 60
      },
      headMoldMeasurements: {
        '前后径': 38,
        '左右径': 30,
        '耳上距': 32
      },
      hairBatch: 'HB-2024-002',
      hairQuantity: 200,
      colorCurve: 'light_brown',
      laceNetSku: 'LN-HD-002',
      laceNetQuantity: 2,
      fittingPhotos: [],
      notes: '加急订单，请优先处理',
      deadline: '2024-11-25',
      createdAt: new Date('2024-11-20').toISOString(),
      updatedAt: new Date('2024-11-20').toISOString(),
      analysis: null,
      finalStatus: null,
      manualOverride: null
    }
  ];
  
  sampleOrders.forEach(order => {
    const analysis = analyzeOrderStatus(order, sampleInventory);
    order.analysis = analysis;
    order.finalStatus = analysis.status;
  });
  
  writeJSONFile(INVENTORY_FILE, sampleInventory);
  writeJSONFile(ORDERS_FILE, sampleOrders);
  writeJSONFile(REVIEWS_FILE, []);
  
  res.json({
    message: '示例数据初始化成功',
    inventoryCount: sampleInventory.length,
    ordersCount: sampleOrders.length
  });
});

app.listen(PORT, () => {
  console.log(`假发定制工坊订单管理系统运行在 http://localhost:${PORT}`);
  console.log(`请访问 http://localhost:${PORT} 查看应用`);
});
