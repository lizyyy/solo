const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

class InventorySystem {
  constructor() {
    this.stores = [
      { id: 'store_001', name: '北京朝阳店', code: 'BJ-CY' },
      { id: 'store_002', name: '上海浦东店', code: 'SH-PD' },
      { id: 'store_003', name: '广州天河店', code: 'GZ-TH' },
      { id: 'store_004', name: '深圳南山店', code: 'SZ-NS' }
    ];
    
    this.products = [
      { id: 'prod_001', name: '可口可乐 330ml', sku: 'SKU001', category: '饮料' },
      { id: 'prod_002', name: '农夫山泉 550ml', sku: 'SKU002', category: '饮料' },
      { id: 'prod_003', name: '康师傅红烧牛肉面', sku: 'SKU003', category: '方便食品' },
      { id: 'prod_004', name: '乐事薯片原味 40g', sku: 'SKU004', category: '零食' },
      { id: 'prod_005', name: '双汇火腿肠', sku: 'SKU005', category: '肉制品' },
      { id: 'prod_006', name: '益达口香糖', sku: 'SKU006', category: '零食' },
      { id: 'prod_007', name: '德芙巧克力', sku: 'SKU007', category: '零食' },
      { id: 'prod_008', name: '统一冰红茶', sku: 'SKU008', category: '饮料' }
    ];
    
    this.systemInventory = {};
    this.physicalCount = {};
    this.inTransit = [];
    this.damageRecords = [];
    this.differenceResults = [];
    this.reviewRecords = [];
    this.importHistory = [];
  }

  importSystemInventory(storeId, data, importId) {
    if (!this.systemInventory[storeId]) {
      this.systemInventory[storeId] = {};
    }
    
    const records = [];
    data.forEach(item => {
      const product = this.products.find(p => p.sku === item.sku || p.name === item.name);
      if (product) {
        this.systemInventory[storeId][product.id] = {
          productId: product.id,
          quantity: parseInt(item.quantity) || 0,
          unitPrice: parseFloat(item.unitPrice) || 0,
          lastUpdate: new Date().toISOString()
        };
        records.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: parseInt(item.quantity) || 0
        });
      }
    });
    
    this.importHistory.push({
      id: importId || uuidv4(),
      type: 'system_inventory',
      storeId,
      timestamp: new Date().toISOString(),
      recordCount: records.length
    });
    
    return records;
  }

  importPhysicalCount(storeId, data, importId) {
    if (!this.physicalCount[storeId]) {
      this.physicalCount[storeId] = {};
    }
    
    const records = [];
    const issues = [];
    
    data.forEach(item => {
      const product = this.products.find(p => p.sku === item.sku || p.name === item.name);
      if (product) {
        const quantity = parseInt(item.quantity) || 0;
        
        if (quantity < 0) {
          issues.push({
            product: product.name,
            sku: product.sku,
            quantity,
            message: '实盘数量为负，已自动修正为0'
          });
        }
        
        const existing = this.physicalCount[storeId][product.id];
        if (existing) {
          issues.push({
            product: product.name,
            sku: product.sku,
            oldQuantity: existing.quantity,
            newQuantity: Math.max(0, quantity),
            message: '重复导入，已更新数量'
          });
        }
        
        this.physicalCount[storeId][product.id] = {
          productId: product.id,
          quantity: Math.max(0, quantity),
          countDate: item.countDate || new Date().toISOString().split('T')[0],
          operator: item.operator || '未知'
        };
        records.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: Math.max(0, quantity)
        });
      }
    });
    
    this.importHistory.push({
      id: importId || uuidv4(),
      type: 'physical_count',
      storeId,
      timestamp: new Date().toISOString(),
      recordCount: records.length,
      issues
    });
    
    return { records, issues };
  }

  importInTransit(data) {
    const records = data.map(item => {
      const record = {
        id: uuidv4(),
        fromStore: item.fromStore,
        toStore: item.toStore,
        productSku: item.productSku,
        productName: item.productName,
        quantity: parseInt(item.quantity) || 0,
        transferDate: item.transferDate || new Date().toISOString().split('T')[0],
        expectedArrivalDate: item.expectedArrivalDate,
        status: item.status || 'in_transit',
        isRecorded: item.isRecorded === '是' || item.isRecorded === true
      };
      this.inTransit.push(record);
      return record;
    });
    
    return records;
  }

  importDamageRecords(data) {
    const records = data.map(item => {
      const record = {
        id: uuidv4(),
        storeId: item.storeId,
        productSku: item.productSku,
        productName: item.productName,
        quantity: parseInt(item.quantity) || 0,
        damageDate: item.damageDate || new Date().toISOString().split('T')[0],
        reason: item.reason || '未说明',
        operator: item.operator || '未知',
        isReported: item.isReported === '是' || item.isReported === true
      };
      this.damageRecords.push(record);
      return record;
    });
    
    return records;
  }

  calculateDifferences(storeId) {
    const results = [];
    const sysInv = this.systemInventory[storeId] || {};
    const phyCount = this.physicalCount[storeId] || {};
    
    const storeInTransit = this.inTransit.filter(t => 
      t.toStore === storeId && !t.isRecorded
    );
    const storeDamage = this.damageRecords.filter(d => 
      d.storeId === storeId && !d.isReported
    );
    
    this.products.forEach(product => {
      const sysQty = sysInv[product.id]?.quantity || 0;
      const phyQty = phyCount[product.id]?.quantity || 0;
      
      const inTransitQty = storeInTransit
        .filter(t => t.productSku === product.sku)
        .reduce((sum, t) => sum + t.quantity, 0);
      
      const damageQty = storeDamage
        .filter(d => d.productSku === product.sku)
        .reduce((sum, d) => sum + d.quantity, 0);
      
      const adjustedSysQty = sysQty + inTransitQty - damageQty;
      const difference = phyQty - adjustedSysQty;
      
      const reasons = [];
      const details = [];
      
      details.push(`系统库存: ${sysQty}`);
      
      if (inTransitQty > 0) {
        details.push(`在途调拨(未入账): +${inTransitQty}`);
        reasons.push({
          type: 'in_transit',
          label: '在途调拨未入账',
          quantity: inTransitQty,
          records: storeInTransit.filter(t => t.productSku === product.sku)
        });
      }
      
      if (damageQty > 0) {
        details.push(`报损(未上报): -${damageQty}`);
        reasons.push({
          type: 'damage',
          label: '报损未上报',
          quantity: damageQty,
          records: storeDamage.filter(d => d.productSku === product.sku)
        });
      }
      
      if (difference === 0) {
        reasons.unshift({
          type: 'normal',
          label: '盘点正常',
          quantity: 0
        });
      } else if (difference > 0) {
        reasons.unshift({
          type: 'overage',
          label: '盘盈',
          quantity: difference
        });
      } else {
        reasons.unshift({
          type: 'shortage',
          label: '盘亏',
          quantity: Math.abs(difference)
        });
      }
      
      results.push({
        id: uuidv4(),
        storeId,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        category: product.category,
        systemQty: sysQty,
        physicalQty: phyQty,
        inTransitQty,
        damageQty,
        adjustedSysQty,
        difference,
        reasons,
        details,
        calculation: `实盘(${phyQty}) - [系统(${sysQty}) + 在途(${inTransitQty}) - 报损(${damageQty})] = ${difference}`,
        reviewed: false,
        reviewNote: '',
        reviewTime: null,
        reviewOperator: null
      });
    });
    
    this.differenceResults = results;
    return results;
  }

  reviewDifference(id, note, operator) {
    const result = this.differenceResults.find(r => r.id === id);
    if (result) {
      if (result.reviewed) {
        return {
          success: false,
          message: '该记录已复核，如需修改请先取消复核'
        };
      }
      
      result.reviewed = true;
      result.reviewNote = note || '';
      result.reviewTime = new Date().toISOString();
      result.reviewOperator = operator || '未知';
      
      this.reviewRecords.push({
        id: uuidv4(),
        differenceId: id,
        note,
        operator,
        timestamp: new Date().toISOString()
      });
      
      return { success: true, data: result };
    }
    return { success: false, message: '记录不存在' };
  }

  cancelReview(id) {
    const result = this.differenceResults.find(r => r.id === id);
    if (result) {
      result.reviewed = false;
      result.reviewNote = '';
      result.reviewTime = null;
      result.reviewOperator = null;
      return { success: true, data: result };
    }
    return { success: false, message: '记录不存在' };
  }

  getSummary(storeId) {
    const results = this.differenceResults.filter(r => r.storeId === storeId);
    
    const totalProducts = results.length;
    const zeroDiff = results.filter(r => r.difference === 0).length;
    const overage = results.filter(r => r.difference > 0);
    const shortage = results.filter(r => r.difference < 0);
    const reviewed = results.filter(r => r.reviewed).length;
    
    const overageQty = overage.reduce((sum, r) => sum + r.difference, 0);
    const shortageQty = shortage.reduce((sum, r) => sum + Math.abs(r.difference), 0);
    
    const categories = {};
    results.forEach(r => {
      if (!categories[r.category]) {
        categories[r.category] = {
          name: r.category,
          total: 0,
          normal: 0,
          overage: 0,
          shortage: 0,
          overageQty: 0,
          shortageQty: 0
        };
      }
      categories[r.category].total++;
      if (r.difference === 0) categories[r.category].normal++;
      else if (r.difference > 0) {
        categories[r.category].overage++;
        categories[r.category].overageQty += r.difference;
      } else {
        categories[r.category].shortage++;
        categories[r.category].shortageQty += Math.abs(r.difference);
      }
    });
    
    return {
      storeId,
      storeName: this.stores.find(s => s.id === storeId)?.name || '未知门店',
      totalProducts,
      zeroDiff,
      overageCount: overage.length,
      overageQty,
      shortageCount: shortage.length,
      shortageQty,
      reviewed,
      pendingReview: totalProducts - reviewed,
      categories: Object.values(categories)
    };
  }

  exportReport(storeId) {
    const summary = this.getSummary(storeId);
    const details = this.differenceResults.filter(r => r.storeId === storeId);
    
    const summaryData = [
      ['门店盘点汇总报告'],
      ['门店', summary.storeName],
      ['盘点时间', new Date().toLocaleString('zh-CN')],
      [],
      ['统计项', '数量', '差异数量'],
      ['盘点商品总数', summary.totalProducts, ''],
      ['账实一致', summary.zeroDiff, '0'],
      ['盘盈', summary.overageCount, `+${summary.overageQty}`],
      ['盘亏', summary.shortageCount, `-${summary.shortageQty}`],
      ['已复核', summary.reviewed, ''],
      ['待复核', summary.pendingReview, ''],
      [],
      ['分类汇总'],
      ['分类', '总数', '一致', '盘盈', '盘亏', '盘盈数量', '盘亏数量'],
      ...summary.categories.map(c => [
        c.name, c.total, c.normal, c.overage, c.shortage,
        c.overageQty, c.shortageQty
      ])
    ];
    
    const detailData = [
      ['商品SKU', '商品名称', '分类', '系统库存', '在途调拨', '报损记录', '调整后系统库存',
       '实盘数量', '差异数量', '可能原因', '计算过程', '复核状态', '复核备注', '复核人', '复核时间']
    ];
    
    details.forEach(d => {
      detailData.push([
        d.productSku,
        d.productName,
        d.category,
        d.systemQty,
        d.inTransitQty,
        d.damageQty,
        d.adjustedSysQty,
        d.physicalQty,
        d.difference,
        d.reasons.map(r => r.label).join('; '),
        d.calculation,
        d.reviewed ? '已复核' : '待复核',
        d.reviewNote || '',
        d.reviewOperator || '',
        d.reviewTime ? new Date(d.reviewTime).toLocaleString('zh-CN') : ''
      ]);
    });
    
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    const ws2 = XLSX.utils.aoa_to_sheet(detailData);
    
    XLSX.utils.book_append_sheet(wb, ws1, '汇总');
    XLSX.utils.book_append_sheet(wb, ws2, '明细');
    
    return wb;
  }

  initSampleData() {
    const store1Id = 'store_001';
    const store2Id = 'store_002';
    
    this.importSystemInventory(store1Id, [
      { sku: 'SKU001', quantity: 100, unitPrice: 3.00 },
      { sku: 'SKU002', quantity: 200, unitPrice: 2.00 },
      { sku: 'SKU003', quantity: 50, unitPrice: 5.00 },
      { sku: 'SKU004', quantity: 80, unitPrice: 8.50 },
      { sku: 'SKU005', quantity: 120, unitPrice: 2.50 },
      { sku: 'SKU006', quantity: 60, unitPrice: 12.00 },
      { sku: 'SKU007', quantity: 40, unitPrice: 18.00 },
      { sku: 'SKU008', quantity: 90, unitPrice: 4.00 }
    ], 'import_sample_sys_001');
    
    this.importSystemInventory(store2Id, [
      { sku: 'SKU001', quantity: 150, unitPrice: 3.00 },
      { sku: 'SKU002', quantity: 180, unitPrice: 2.00 },
      { sku: 'SKU003', quantity: 70, unitPrice: 5.00 },
      { sku: 'SKU004', quantity: 100, unitPrice: 8.50 }
    ], 'import_sample_sys_002');
    
    this.importPhysicalCount(store1Id, [
      { sku: 'SKU001', quantity: 100, operator: '张三', countDate: '2026-05-10' },
      { sku: 'SKU002', quantity: 180, operator: '张三', countDate: '2026-05-10' },
      { sku: 'SKU003', quantity: 45, operator: '李四', countDate: '2026-05-10' },
      { sku: 'SKU004', quantity: 100, operator: '李四', countDate: '2026-05-10' },
      { sku: 'SKU005', quantity: 118, operator: '王五', countDate: '2026-05-10' },
      { sku: 'SKU006', quantity: 55, operator: '王五', countDate: '2026-05-10' },
      { sku: 'SKU007', quantity: 42, operator: '赵六', countDate: '2026-05-10' },
      { sku: 'SKU008', quantity: 88, operator: '赵六', countDate: '2026-05-10' }
    ], 'import_sample_phy_001');
    
    this.importInTransit([
      {
        fromStore: 'store_002',
        toStore: 'store_001',
        productSku: 'SKU002',
        productName: '农夫山泉 550ml',
        quantity: 20,
        transferDate: '2026-05-08',
        expectedArrivalDate: '2026-05-11',
        status: 'in_transit',
        isRecorded: '否'
      },
      {
        fromStore: 'store_002',
        toStore: 'store_001',
        productSku: 'SKU004',
        productName: '乐事薯片原味 40g',
        quantity: 15,
        transferDate: '2026-05-09',
        expectedArrivalDate: '2026-05-12',
        status: 'in_transit',
        isRecorded: '否'
      }
    ]);
    
    this.importDamageRecords([
      {
        storeId: 'store_001',
        productSku: 'SKU003',
        productName: '康师傅红烧牛肉面',
        quantity: 5,
        damageDate: '2026-05-09',
        reason: '包装破损',
        operator: '李四',
        isReported: '否'
      }
    ]);
    
    this.calculateDifferences(store1Id);
    this.calculateDifferences(store2Id);
  }
}

const inventorySystem = new InventorySystem();
inventorySystem.initSampleData();

app.get('/api/stores', (req, res) => {
  res.json(inventorySystem.stores);
});

app.get('/api/products', (req, res) => {
  res.json(inventorySystem.products);
});

app.post('/api/import/system-inventory', (req, res) => {
  const { storeId, data } = req.body;
  const result = inventorySystem.importSystemInventory(storeId, data);
  inventorySystem.calculateDifferences(storeId);
  res.json({ success: true, data: result });
});

app.post('/api/import/physical-count', (req, res) => {
  const { storeId, data } = req.body;
  const result = inventorySystem.importPhysicalCount(storeId, data);
  inventorySystem.calculateDifferences(storeId);
  res.json({ success: true, data: result });
});

app.post('/api/import/in-transit', (req, res) => {
  const result = inventorySystem.importInTransit(req.body.data);
  res.json({ success: true, data: result });
});

app.post('/api/import/damage', (req, res) => {
  const result = inventorySystem.importDamageRecords(req.body.data);
  res.json({ success: true, data: result });
});

app.get('/api/differences', (req, res) => {
  const { storeId } = req.query;
  if (!storeId) {
    return res.json({ success: false, message: '请选择门店' });
  }
  const results = inventorySystem.differenceResults.filter(r => r.storeId === storeId);
  res.json({ success: true, data: results });
});

app.get('/api/summary', (req, res) => {
  const { storeId } = req.query;
  if (!storeId) {
    return res.json({ success: false, message: '请选择门店' });
  }
  const summary = inventorySystem.getSummary(storeId);
  res.json({ success: true, data: summary });
});

app.post('/api/review', (req, res) => {
  const { id, note, operator } = req.body;
  const result = inventorySystem.reviewDifference(id, note, operator);
  res.json(result);
});

app.post('/api/review/cancel', (req, res) => {
  const { id } = req.body;
  const result = inventorySystem.cancelReview(id);
  res.json(result);
});

app.get('/api/export', (req, res) => {
  const { storeId } = req.query;
  if (!storeId) {
    return res.json({ success: false, message: '请选择门店' });
  }
  
  const wb = inventorySystem.exportReport(storeId);
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=盘点报告_${inventorySystem.stores.find(s => s.id === storeId)?.name || '未知'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  
  res.send(buffer);
});

app.get('/api/import-history', (req, res) => {
  res.json({ success: true, data: inventorySystem.importHistory });
});

app.get('/api/in-transit', (req, res) => {
  const { storeId } = req.query;
  let data = inventorySystem.inTransit;
  if (storeId) {
    data = data.filter(t => t.toStore === storeId);
  }
  res.json({ success: true, data });
});

app.get('/api/damage-records', (req, res) => {
  const { storeId } = req.query;
  let data = inventorySystem.damageRecords;
  if (storeId) {
    data = data.filter(d => d.storeId === storeId);
  }
  res.json({ success: true, data });
});

app.listen(PORT, () => {
  console.log(`盘点差异台后端服务运行在 http://localhost:${PORT}`);
});
