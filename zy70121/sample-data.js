const sampleData = {
  allergenRules: [
    {
      ruleId: 'RULE-001',
      allergenName: '花生',
      description: '含有花生成分的食品',
      severity: '高',
      affectedSymptoms: ['过敏反应', '呼吸困难', '皮疹'],
      createdAt: '2026-05-01T00:00:00.000Z'
    },
    {
      ruleId: 'RULE-002',
      allergenName: '牛奶',
      description: '含有乳制品成分的食品',
      severity: '中',
      affectedSymptoms: ['腹痛', '腹泻', '皮疹'],
      createdAt: '2026-05-02T00:00:00.000Z'
    },
    {
      ruleId: 'RULE-003',
      allergenName: '小麦',
      description: '含有谷蛋白的食品',
      severity: '低',
      affectedSymptoms: ['肠胃不适', '疲劳'],
      createdAt: '2026-05-03T00:00:00.000Z'
    }
  ],

  skuBatches: [
    {
      batchId: 'BATCH-A202605',
      skuId: 'SKU-COOKIE-001',
      skuName: '香脆花生曲奇',
      productionDate: '2026-05-05',
      expiryDate: '2026-11-05',
      actualAllergens: ['花生', '小麦'],
      labeledAllergens: ['小麦'],
      labelError: true,
      totalQuantity: 5000,
      warehouseId: 'WH-BJ-001'
    },
    {
      batchId: 'BATCH-B202605',
      skuId: 'SKU-MILK-002',
      skuName: '原味牛奶巧克力',
      productionDate: '2026-05-06',
      expiryDate: '2026-12-06',
      actualAllergens: ['牛奶', '大豆'],
      labeledAllergens: ['牛奶', '大豆'],
      labelError: false,
      totalQuantity: 3000,
      warehouseId: 'WH-SH-001'
    },
    {
      batchId: 'BATCH-C202605',
      skuId: 'SKU-BREAD-003',
      skuName: '全麦吐司面包',
      productionDate: '2026-05-07',
      expiryDate: '2026-05-14',
      actualAllergens: ['小麦'],
      labeledAllergens: ['牛奶'],
      labelError: true,
      totalQuantity: 2000,
      warehouseId: 'WH-GZ-001'
    }
  ],

  orders: [
    {
      orderId: 'ORDER-20260508-001',
      customerName: '张三',
      customerPhone: '13800138001',
      customerEmail: 'zhangsan@example.com',
      orderDate: '2026-05-08T10:30:00.000Z',
      items: [
        {
          skuId: 'SKU-COOKIE-001',
          batchId: 'BATCH-A202605',
          productName: '香脆花生曲奇',
          quantity: 3,
          unitPrice: 25.00
        }
      ],
      totalAmount: 75.00,
      status: '已发货'
    },
    {
      orderId: 'ORDER-20260508-002',
      customerName: '李四',
      customerPhone: '13800138002',
      customerEmail: 'lisi@example.com',
      orderDate: '2026-05-08T14:20:00.000Z',
      items: [
        {
          skuId: 'SKU-COOKIE-001',
          batchId: 'BATCH-A202605',
          productName: '香脆花生曲奇',
          quantity: 2,
          unitPrice: 25.00
        },
        {
          skuId: 'SKU-MILK-002',
          batchId: 'BATCH-B202605',
          productName: '原味牛奶巧克力',
          quantity: 1,
          unitPrice: 35.00
        }
      ],
      totalAmount: 85.00,
      status: '已完成'
    },
    {
      orderId: 'ORDER-20260509-001',
      customerName: '王五',
      customerPhone: '13800138003',
      customerEmail: 'wangwu@example.com',
      orderDate: '2026-05-09T09:15:00.000Z',
      items: [
        {
          skuId: 'SKU-BREAD-003',
          batchId: 'BATCH-C202605',
          productName: '全麦吐司面包',
          quantity: 5,
          unitPrice: 18.00
        }
      ],
      totalAmount: 90.00,
      status: '已发货'
    },
    {
      orderId: 'ORDER-20260509-002',
      customerName: '赵六',
      customerPhone: '13800138004',
      customerEmail: 'zhaoliu@example.com',
      orderDate: '2026-05-09T16:45:00.000Z',
      items: [
        {
          skuId: 'SKU-COOKIE-001',
          batchId: 'BATCH-A202605',
          productName: '香脆花生曲奇',
          quantity: 10,
          unitPrice: 25.00
        }
      ],
      totalAmount: 250.00,
      status: '待发货'
    }
  ],

  inventory: [
    {
      skuId: 'SKU-COOKIE-001',
      batchId: 'BATCH-A202605',
      warehouseId: 'WH-BJ-001',
      totalQuantity: 5000,
      soldQuantity: 15,
      availableQuantity: 4985,
      status: '正常'
    },
    {
      skuId: 'SKU-MILK-002',
      batchId: 'BATCH-B202605',
      warehouseId: 'WH-SH-001',
      totalQuantity: 3000,
      soldQuantity: 1,
      availableQuantity: 2999,
      status: '正常'
    },
    {
      skuId: 'SKU-BREAD-003',
      batchId: 'BATCH-C202605',
      warehouseId: 'WH-GZ-001',
      totalQuantity: 2000,
      soldQuantity: 5,
      availableQuantity: 1995,
      status: '正常'
    }
  ]
};

module.exports = { sampleData };
