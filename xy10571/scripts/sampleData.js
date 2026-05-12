const { URGENCY_LEVEL, SHIPMENT_STATUS, PURCHASE_CONFIRM_STATUS, PRODUCTION_STATUS } = require('../models/types');

const sampleECNs = {
  normal: {
    title: '零件A-001图纸尺寸优化',
    reason: '客户反馈零件配合公差过松，需要收紧',
    urgency: URGENCY_LEVEL.NORMAL,
    createdBy: '工程师-张三',
    changeDescription: '将内径公差从 0.05mm 收紧至 0.02mm',
    affectedPart: 'A-001',
    revision: 'Rev.A -> Rev.B'
  },
  
  urgent: {
    title: '安全零件紧急更换',
    reason: '发现潜在安全隐患，需要立即更换',
    urgency: URGENCY_LEVEL.URGENT,
    createdBy: '质量经理-李四',
    changeDescription: '材料从钢材改为合金，增加强度',
    affectedPart: 'B-002',
    revision: 'Rev.2 -> Rev.3'
  },
  
  critical: {
    title: '核心功能零件召回',
    reason: '已发货产品存在严重缺陷，需立即冻结并召回',
    urgency: URGENCY_LEVEL.CRITICAL,
    createdBy: '技术总监-王五',
    changeDescription: '设计缺陷修正，需更换所有已发货产品',
    affectedPart: 'C-003',
    revision: 'Rev.1 -> Rev.2'
  }
};

const sampleMaterials = [
  {
    materialCode: 'MAT-1001',
    materialName: '轴套-A001',
    description: '内径25mm的主轴轴套',
    affectedLevel: 'DIRECT',
    oldSpec: '内径 25.00 ± 0.05mm',
    newSpec: '内径 25.00 ± 0.02mm'
  },
  {
    materialCode: 'MAT-1002',
    materialName: '密封圈-B001',
    description: 'O型密封圈',
    affectedLevel: 'DEPENDENT',
    oldSpec: '材质 NBR-70',
    newSpec: '材质 NBR-80'
  }
];

const sampleProductionOrders = [
  {
    orderNo: 'PO-2024-001',
    product: '减速器组件',
    quantity: 100,
    progress: 0.3,
    shipmentStatus: SHIPMENT_STATUS.NOT_SHIPPED,
    productionStatus: PRODUCTION_STATUS.IN_PROGRESS,
    responsible: '生产主管-张三'
  },
  {
    orderNo: 'PO-2024-002',
    product: '减速器组件',
    quantity: 50,
    progress: 0.8,
    shipmentStatus: SHIPMENT_STATUS.PARTIALLY_SHIPPED,
    shippedQuantity: 20,
    productionStatus: PRODUCTION_STATUS.IN_PROGRESS,
    responsible: '生产主管-张三'
  },
  {
    orderNo: 'PO-2024-003',
    product: '减速器组件',
    quantity: 30,
    progress: 1.0,
    shipmentStatus: SHIPMENT_STATUS.FULLY_SHIPPED,
    productionStatus: PRODUCTION_STATUS.COMPLETED,
    responsible: '生产主管-张三'
  }
];

const samplePurchaseOrders = [
  {
    poNumber: 'PUR-2024-0101',
    supplier: '长城机械配件',
    material: '轴套-A001',
    quantity: 200,
    unitPrice: 125.00,
    expectedDelivery: '2024-12-15',
    confirmStatus: PURCHASE_CONFIRM_STATUS.NOT_CONFIRMED,
    responsible: '采购员-小王'
  },
  {
    poNumber: 'PUR-2024-0102',
    supplier: '上海密封科技',
    material: '密封圈-B001',
    quantity: 500,
    unitPrice: 8.50,
    expectedDelivery: '2024-12-10',
    confirmStatus: PURCHASE_CONFIRM_STATUS.CONFIRMED,
    responsible: '采购员-小李'
  }
];

const sampleCustomerOrders = [
  {
    orderNo: 'CO-2024-1001',
    customer: '华东重型机械',
    product: '减速器组件',
    quantity: 30,
    shipmentStatus: SHIPMENT_STATUS.NOT_SHIPPED,
    shipDate: '2024-12-20',
    salesRep: '销售-小王'
  },
  {
    orderNo: 'CO-2024-1002',
    customer: '南方装备制造',
    product: '减速器组件',
    quantity: 50,
    shipmentStatus: SHIPMENT_STATUS.PARTIALLY_SHIPPED,
    shippedQuantity: 20,
    shipDate: '2024-12-15',
    salesRep: '销售-小李'
  },
  {
    orderNo: 'CO-2024-1003',
    customer: '北京汽车集团',
    product: '减速器组件',
    quantity: 20,
    shipmentStatus: SHIPMENT_STATUS.FULLY_SHIPPED,
    shipDate: '2024-12-01',
    salesRep: '销售-小张'
  }
];

const getImpactData = (type = 'full') => {
  if (type === 'full') {
    return {
      materials: JSON.parse(JSON.stringify(sampleMaterials)),
      productionOrders: JSON.parse(JSON.stringify(sampleProductionOrders)),
      purchaseOrders: JSON.parse(JSON.stringify(samplePurchaseOrders)),
      customerOrders: JSON.parse(JSON.stringify(sampleCustomerOrders))
    };
  }
  
  if (type === 'trace') {
    return {
      materials: JSON.parse(JSON.stringify(sampleMaterials)),
      customerOrders: JSON.parse(JSON.stringify(sampleCustomerOrders))
    };
  }
  
  if (type === 'purchase') {
    return {
      materials: JSON.parse(JSON.stringify(sampleMaterials)),
      purchaseOrders: JSON.parse(JSON.stringify(samplePurchaseOrders))
    };
  }
  
  return {};
};

module.exports = {
  sampleECNs,
  sampleMaterials,
  sampleProductionOrders,
  samplePurchaseOrders,
  sampleCustomerOrders,
  getImpactData
};
