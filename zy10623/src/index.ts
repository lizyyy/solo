import express from 'express';
import repairPartReturnRouter from './routes/repairPartReturn';
import { repairPartReturnService } from './services/repairPartReturn';
import { Carrier, InspectionResult } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/repair-part-return', repairPartReturnRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '售后备件系统维修件返厂跟踪服务运行正常' });
});

function initSampleData() {
  console.log('初始化样例数据...');

  const sample1 = repairPartReturnService.create({
    sparePart: {
      partName: '主板',
      partCode: 'MB-001',
      partModel: 'X1-Carbon',
      quantity: 1,
      unit: '件',
      price: 2500
    },
    repairOrder: {
      repairOrderNo: 'RO20240001',
      customerName: '张三',
      customerPhone: '13800138001',
      faultDescription: '不开机，主板故障',
      createTime: new Date().toISOString()
    },
    operatorId: 'OP001',
    operatorName: '管理员',
    idempotentKey: 'sample-1'
  });

  if (sample1.success && sample1.data) {
    const id1 = sample1.data.id;
    repairPartReturnService.ship(id1, {
      carrier: Carrier.SF,
      trackingNo: 'SF1234567890',
      operatorId: 'OP001',
      operatorName: '管理员'
    });
    repairPartReturnService.receive(id1, {
      receiverName: '仓库管理员',
      operatorId: 'OP002',
      operatorName: '仓库管理员'
    });
    repairPartReturnService.inspect(id1, {
      result: InspectionResult.PASS,
      remark: '检测通过，可正常入库',
      inspectorId: 'OP003',
      inspectorName: '质检员'
    });
    repairPartReturnService.stockIn(id1, {
      operatorId: 'OP002',
      operatorName: '仓库管理员'
    });
    console.log('样例1: 完整流转 - 已入库');
  }

  const sample2 = repairPartReturnService.create({
    sparePart: {
      partName: '显示屏',
      partCode: 'LCD-002',
      partModel: 'T14-Gen1',
      quantity: 1,
      unit: '件',
      price: 1200
    },
    repairOrder: {
      repairOrderNo: 'RO20240002',
      customerName: '李四',
      customerPhone: '13800138002',
      faultDescription: '屏幕花屏',
      createTime: new Date().toISOString()
    },
    operatorId: 'OP001',
    operatorName: '管理员',
    idempotentKey: 'sample-2'
  });

  if (sample2.success && sample2.data) {
    const id2 = sample2.data.id;
    repairPartReturnService.ship(id2, {
      carrier: Carrier.JD,
      trackingNo: 'JD9876543210',
      operatorId: 'OP001',
      operatorName: '管理员'
    });
    repairPartReturnService.receive(id2, {
      receiverName: '仓库管理员',
      operatorId: 'OP002',
      operatorName: '仓库管理员'
    });
    repairPartReturnService.inspect(id2, {
      result: InspectionResult.FAIL,
      remark: '屏幕物理损坏，非质量问题',
      defectDescription: '屏幕有明显磕碰痕迹',
      requiredMaterials: ['质量检测报告', '维修记录', '现场照片', '客户沟通记录'],
      inspectorId: 'OP003',
      inspectorName: '质检员'
    }, true);
    console.log('样例2: 冲突记录 - 检测不通过但库存已恢复被拦截');
  }

  const sample3 = repairPartReturnService.create({
    sparePart: {
      partName: '键盘',
      partCode: 'KB-003',
      partModel: 'E14',
      quantity: 1,
      unit: '件',
      price: 350
    },
    repairOrder: {
      repairOrderNo: 'RO20240003',
      customerName: '王五',
      customerPhone: '13800138003',
      faultDescription: '按键失灵',
      createTime: new Date().toISOString()
    },
    operatorId: 'OP001',
    operatorName: '管理员',
    idempotentKey: 'sample-3'
  });

  if (sample3.success && sample3.data) {
    const id3 = sample3.data.id;
    repairPartReturnService.reject(id3, 'OP004', '审核员', '非保修范围，需客户付费维修');
    console.log('样例3: 驳回状态 - 非保修范围');
  }

  const sample4 = repairPartReturnService.create({
    sparePart: {
      partName: '电池',
      partCode: 'BAT-004',
      partModel: 'P15s',
      quantity: 1,
      unit: '件',
      price: 680
    },
    repairOrder: {
      repairOrderNo: 'RO20240004',
      customerName: '赵六',
      customerPhone: '13800138004',
      faultDescription: '电池鼓包',
      createTime: new Date().toISOString()
    },
    operatorId: 'OP001',
    operatorName: '管理员',
    idempotentKey: 'sample-4'
  });

  if (sample4.success && sample4.data) {
    const id4 = sample4.data.id;
    repairPartReturnService.ship(id4, {
      carrier: Carrier.ZTO,
      trackingNo: 'ZT1122334455',
      operatorId: 'OP001',
      operatorName: '管理员'
    });
    repairPartReturnService.receive(id4, {
      receiverName: '仓库管理员',
      operatorId: 'OP002',
      operatorName: '仓库管理员'
    });
    repairPartReturnService.inspect(id4, {
      result: InspectionResult.NEED_REPAIR,
      remark: '电池接口松动，需重新焊接',
      repairSuggestion: '重新焊接电池接口',
      inspectorId: 'OP003',
      inspectorName: '质检员'
    });
    console.log('样例4: 待维修状态 - 电池接口故障');
  }

  const sample5 = repairPartReturnService.create({
    sparePart: {
      partName: '内存条',
      partCode: 'RAM-005',
      partModel: 'DDR4-16G',
      quantity: 1,
      unit: '条',
      price: 450
    },
    repairOrder: {
      repairOrderNo: 'RO20240005',
      customerName: '孙七',
      customerPhone: '13800138005',
      faultDescription: '内存不识别',
      createTime: new Date().toISOString()
    },
    operatorId: 'OP001',
    operatorName: '管理员',
    idempotentKey: 'sample-5'
  });

  if (sample5.success && sample5.data) {
    const id5 = sample5.data.id;
    repairPartReturnService.ship(id5, {
      carrier: Carrier.YTO,
      trackingNo: 'YT5566778899',
      operatorId: 'OP001',
      operatorName: '管理员'
    });
    console.log('样例5: 运输中 - 内存不识别');
  }

  const badRows = [
    { rowNumber: 1, rawData: '坏件数据1', errorMessage: '备件编码格式错误', errorFields: ['partCode'] },
    { rowNumber: 2, rawData: '坏件数据2', errorMessage: '数量不能为负数', errorFields: ['quantity'] },
    { rowNumber: 3, rawData: '坏件数据3', errorMessage: '客户电话格式不正确', errorFields: ['customerPhone'] }
  ];
  console.log('样例坏行数据已准备:', badRows.length, '条');

  console.log('样例数据初始化完成！');
}

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('');
  console.log('API接口:');
  console.log('  GET  /health                        - 健康检查');
  console.log('  POST /api/repair-part-return        - 创建返厂单');
  console.log('  GET  /api/repair-part-return        - 查询返厂单列表');
  console.log('  GET  /api/repair-part-return/export - 导出CSV');
  console.log('  GET  /api/repair-part-return/:id    - 查询详情');
  console.log('  GET  /api/repair-part-return/returnNo/:returnNo - 按单号查询');
  console.log('  GET  /api/repair-part-return/:id/histories       - 查询历史');
  console.log('  POST /api/repair-part-return/:id/ship            - 寄出');
  console.log('  POST /api/repair-part-return/:id/receive         - 签收');
  console.log('  POST /api/repair-part-return/:id/inspect?stockRecovered=true/false - 检测');
  console.log('  POST /api/repair-part-return/:id/stockIn         - 入库');
  console.log('  POST /api/repair-part-return/:id/reject          - 驳回');
  console.log('');
  
  initSampleData();
});

export default app;
