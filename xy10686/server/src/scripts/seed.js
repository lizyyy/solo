const { sequelize, MaterialOrder, DeliveryNote, InspectionRecord } = require('../models');

const seedData = async () => {
  try {
    await sequelize.sync({ force: true });
    console.log('数据库已重置');

    const orders = await MaterialOrder.bulkCreate([
      {
        orderNo: 'MO-2024-001',
        projectName: '阳光花园一期',
        materialName: '实木地板',
        materialType: '地板',
        specification: '910*125*18mm',
        quantity: 500,
        unit: '㎡',
        unitPrice: 280,
        totalAmount: 140000,
        supplier: '优品建材有限公司',
        expectedDeliveryDate: new Date('2024-01-15'),
        status: 'completed',
        responsiblePerson: '张三',
        createdBy: 'admin'
      },
      {
        orderNo: 'MO-2024-002',
        projectName: '阳光花园一期',
        materialName: '抛光瓷砖',
        materialType: '瓷砖',
        specification: '800*800mm',
        quantity: 1000,
        unit: '㎡',
        unitPrice: 150,
        totalAmount: 150000,
        supplier: '瓷砖王国',
        expectedDeliveryDate: new Date('2024-01-20'),
        status: 'delivered',
        responsiblePerson: '李四',
        createdBy: 'admin'
      },
      {
        orderNo: 'MO-2024-003',
        projectName: '悦府二期',
        materialName: '乳胶漆',
        materialType: '涂料',
        specification: '5L/桶',
        quantity: 200,
        unit: '桶',
        unitPrice: 380,
        totalAmount: 76000,
        supplier: '多彩涂料',
        expectedDeliveryDate: new Date('2024-02-01'),
        status: 'partial_delivered',
        responsiblePerson: '王五',
        createdBy: 'admin'
      },
      {
        orderNo: 'MO-2024-004',
        projectName: '悦府二期',
        materialName: '铝合金门窗',
        materialType: '门窗',
        specification: '定制',
        quantity: 50,
        unit: '樘',
        unitPrice: 2500,
        totalAmount: 125000,
        supplier: '精工门窗厂',
        expectedDeliveryDate: new Date('2024-02-15'),
        status: 'pending',
        responsiblePerson: '张三',
        createdBy: 'admin'
      },
      {
        orderNo: 'MO-2024-005',
        projectName: '滨江壹号',
        materialName: 'PPR水管',
        materialType: '水电材料',
        specification: 'D25',
        quantity: 3000,
        unit: '米',
        unitPrice: 15,
        totalAmount: 45000,
        supplier: '管业世家',
        expectedDeliveryDate: new Date('2024-02-20'),
        status: 'inspected',
        responsiblePerson: '赵六',
        createdBy: 'admin'
      }
    ]);

    console.log('材料订单数据已插入');

    const deliveries = await DeliveryNote.bulkCreate([
      {
        deliveryNo: 'DL-2024-001',
        orderId: orders[0].id,
        deliveryDate: new Date('2024-01-15'),
        deliveredQuantity: 500,
        driverName: '王师傅',
        vehicleNo: '京A12345',
        batchNo: 'BATCH-001',
        status: 'accepted',
        receivedBy: '张三',
        createdBy: 'admin'
      },
      {
        deliveryNo: 'DL-2024-002',
        orderId: orders[1].id,
        deliveryDate: new Date('2024-01-20'),
        deliveredQuantity: 1000,
        driverName: '李师傅',
        vehicleNo: '京B67890',
        batchNo: 'BATCH-002',
        status: 'partial_accepted',
        receivedBy: '李四',
        createdBy: 'admin'
      },
      {
        deliveryNo: 'DL-2024-003',
        orderId: orders[2].id,
        deliveryDate: new Date('2024-02-01'),
        deliveredQuantity: 100,
        driverName: '张师傅',
        vehicleNo: '京C11111',
        batchNo: 'BATCH-003',
        status: 'rejected',
        receivedBy: '王五',
        createdBy: 'admin'
      },
      {
        deliveryNo: 'DL-2024-004',
        orderId: orders[4].id,
        deliveryDate: new Date('2024-02-20'),
        deliveredQuantity: 3000,
        driverName: '赵师傅',
        vehicleNo: '京D22222',
        batchNo: 'BATCH-004',
        status: 'accepted',
        receivedBy: '赵六',
        createdBy: 'admin'
      }
    ]);

    console.log('送货单数据已插入');

    await InspectionRecord.bulkCreate([
      {
        inspectionNo: 'IN-2024-001',
        deliveryId: deliveries[0].id,
        orderId: orders[0].id,
        inspectionDate: new Date('2024-01-16'),
        inspectedQuantity: 500,
        acceptedQuantity: 500,
        rejectedQuantity: 0,
        inspectionResult: 'accepted',
        photos: JSON.stringify(['photo1.jpg', 'photo2.jpg']),
        status: 'completed',
        isReturnProcessed: true,
        paymentNodeVerified: true,
        inspector: '质检员A',
        reviewer: '主管A',
        createdBy: 'admin'
      },
      {
        inspectionNo: 'IN-2024-002',
        deliveryId: deliveries[1].id,
        orderId: orders[1].id,
        inspectionDate: new Date('2024-01-21'),
        inspectedQuantity: 1000,
        acceptedQuantity: 950,
        rejectedQuantity: 50,
        inspectionResult: 'partial',
        rejectReason: '部分瓷砖边角破损',
        photos: JSON.stringify(['broken1.jpg', 'broken2.jpg']),
        status: 'completed',
        isReturnProcessed: false,
        paymentNodeVerified: false,
        inspector: '质检员B',
        reviewer: '主管B',
        createdBy: 'admin'
      },
      {
        inspectionNo: 'IN-2024-003',
        deliveryId: deliveries[2].id,
        orderId: orders[2].id,
        inspectionDate: new Date('2024-02-02'),
        inspectedQuantity: 100,
        acceptedQuantity: 0,
        rejectedQuantity: 100,
        inspectionResult: 'rejected',
        rejectReason: '涂料桶变形，疑似过期产品',
        photos: JSON.stringify(['paint1.jpg', 'paint2.jpg', 'paint3.jpg']),
        status: 'submitted',
        isReturnProcessed: false,
        paymentNodeVerified: false,
        inspector: '质检员A',
        createdBy: 'admin'
      },
      {
        inspectionNo: 'IN-2024-004',
        deliveryId: deliveries[3].id,
        orderId: orders[4].id,
        inspectionDate: new Date('2024-02-21'),
        inspectedQuantity: 3000,
        acceptedQuantity: 3000,
        rejectedQuantity: 0,
        inspectionResult: 'accepted',
        status: 'reviewed',
        isReturnProcessed: true,
        paymentNodeVerified: false,
        inspector: '质检员C',
        reviewer: '主管A',
        createdBy: 'admin'
      }
    ]);

    console.log('验收记录数据已插入');
    console.log('样例数据初始化完成！');
    process.exit(0);
  } catch (error) {
    console.error('数据初始化失败:', error);
    process.exit(1);
  }
};

seedData();
