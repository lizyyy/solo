import { generateId } from './storage.js'

export function generateSampleData() {
  const materials = [
    { id: generateId(), name: '红玫瑰', category: '主花', unit: '支', defaultLossRate: 0.15 },
    { id: generateId(), name: '粉玫瑰', category: '主花', unit: '支', defaultLossRate: 0.12 },
    { id: generateId(), name: '白玫瑰', category: '主花', unit: '支', defaultLossRate: 0.1 },
    { id: generateId(), name: '康乃馨', category: '主花', unit: '支', defaultLossRate: 0.08 },
    { id: generateId(), name: '百合', category: '主花', unit: '支', defaultLossRate: 0.2 },
    { id: generateId(), name: '满天星', category: '配花', unit: '扎', defaultLossRate: 0.05 },
    { id: generateId(), name: '尤加利叶', category: '叶材', unit: '扎', defaultLossRate: 0.1 },
    { id: generateId(), name: '黄莺', category: '配花', unit: '扎', defaultLossRate: 0.08 },
    { id: generateId(), name: '绣球', category: '主花', unit: '朵', defaultLossRate: 0.25 },
    { id: generateId(), name: '洋桔梗', category: '配花', unit: '支', defaultLossRate: 0.12 }
  ]

  const recipes = [
    {
      id: generateId(),
      name: '浪漫红玫瑰',
      description: '经典11支红玫瑰花束，适合情人节表达爱意',
      status: 'active',
      materials: [
        { materialId: materials[0].id, quantity: 11 },
        { materialId: materials[5].id, quantity: 1 },
        { materialId: materials[6].id, quantity: 1 }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      name: '粉色甜蜜',
      description: '19支粉玫瑰搭配满天星，温馨浪漫',
      status: 'active',
      materials: [
        { materialId: materials[1].id, quantity: 19 },
        { materialId: materials[5].id, quantity: 2 },
        { materialId: materials[6].id, quantity: 1 }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      name: '母亲节康乃馨',
      description: '33支康乃馨，感恩母亲的爱',
      status: 'active',
      materials: [
        { materialId: materials[3].id, quantity: 33 },
        { materialId: materials[7].id, quantity: 2 },
        { materialId: materials[6].id, quantity: 1 }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      name: '百年好合',
      description: '百合与玫瑰的完美组合，适合婚礼祝福',
      status: 'active',
      materials: [
        { materialId: materials[4].id, quantity: 6 },
        { materialId: materials[2].id, quantity: 11 },
        { materialId: materials[9].id, quantity: 5 },
        { materialId: materials[6].id, quantity: 2 }
      ],
      createdAt: new Date().toISOString()
    }
  ]

  const preorders = [
    {
      id: generateId(),
      orderNo: 'PO20260214001',
      customerName: '张先生',
      bouquetId: recipes[0].id,
      quantity: 3,
      deliveryDate: '2026-02-14',
      status: 'confirmed',
      notes: '情人节当天上午10点配送',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      orderNo: 'PO20260214002',
      customerName: '李女士',
      bouquetId: recipes[1].id,
      quantity: 2,
      deliveryDate: '2026-02-14',
      status: 'confirmed',
      notes: '需要卡片留言',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      orderNo: 'PO20260214003',
      customerName: '王先生',
      bouquetId: recipes[0].id,
      quantity: 5,
      deliveryDate: '2026-02-14',
      status: 'pending',
      notes: '等待确认',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      orderNo: 'PO20260214004',
      customerName: '赵小姐',
      bouquetId: recipes[3].id,
      quantity: 1,
      deliveryDate: '2026-02-14',
      status: 'rejected',
      notes: '客户取消订单',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      orderNo: 'PO20260214005',
      customerName: '陈先生',
      bouquetId: recipes[0].id,
      quantity: 4,
      deliveryDate: '2026-02-14',
      status: 'confirmed',
      notes: '公司团购订单',
      createdAt: new Date().toISOString()
    }
  ]

  const inventory = [
    { id: generateId(), materialId: materials[0].id, quantity: 80, pendingArrival: 50, batchNumber: 'B20260201', arrivalDate: '2026-02-10' },
    { id: generateId(), materialId: materials[1].id, quantity: 50, pendingArrival: 30, batchNumber: 'B20260201', arrivalDate: '2026-02-10' },
    { id: generateId(), materialId: materials[2].id, quantity: 30, pendingArrival: 20, batchNumber: 'B20260201', arrivalDate: '2026-02-10' },
    { id: generateId(), materialId: materials[3].id, quantity: 100, pendingArrival: 0, batchNumber: 'B20260201', arrivalDate: '2026-02-10' },
    { id: generateId(), materialId: materials[4].id, quantity: 15, pendingArrival: 10, batchNumber: 'B20260201', arrivalDate: '2026-02-12' },
    { id: generateId(), materialId: materials[5].id, quantity: 15, pendingArrival: 5, batchNumber: 'B20260201', arrivalDate: '2026-02-10' },
    { id: generateId(), materialId: materials[6].id, quantity: 20, pendingArrival: 0, batchNumber: 'B20260201', arrivalDate: '2026-02-10' },
    { id: generateId(), materialId: materials[7].id, quantity: 10, pendingArrival: 5, batchNumber: 'B20260201', arrivalDate: '2026-02-10' },
    { id: generateId(), materialId: materials[8].id, quantity: 5, pendingArrival: 10, batchNumber: 'B20260201', arrivalDate: '2026-02-12' },
    { id: generateId(), materialId: materials[9].id, quantity: 20, pendingArrival: 10, batchNumber: 'B20260201', arrivalDate: '2026-02-10' }
  ]

  const lossRecords = [
    {
      id: generateId(),
      materialId: materials[0].id,
      quantity: 8,
      reason: '运输损坏',
      status: 'confirmed',
      recordedAt: new Date().toISOString()
    },
    {
      id: generateId(),
      materialId: materials[4].id,
      quantity: 3,
      reason: '花期提前凋谢',
      status: 'confirmed',
      recordedAt: new Date().toISOString()
    },
    {
      id: generateId(),
      materialId: materials[6].id,
      quantity: 2,
      reason: '质量不合格',
      status: 'pending',
      recordedAt: new Date().toISOString()
    }
  ]

  const substitutePlans = [
    {
      id: generateId(),
      originalMaterialId: materials[0].id,
      substituteMaterialId: materials[1].id,
      substituteRatio: 1,
      reason: '红玫瑰缺货时可用粉玫瑰替代',
      status: 'active',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(),
      originalMaterialId: materials[4].id,
      substituteMaterialId: materials[8].id,
      substituteRatio: 2,
      reason: '百合缺货时可用绣球替代（2朵百合=1朵绣球）',
      status: 'active',
      createdAt: new Date().toISOString()
    }
  ]

  return {
    materials,
    recipes,
    preorders,
    inventory,
    lossRecords,
    substitutePlans
  }
}