const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const today = new Date();
const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
const fifteenDaysAgo = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000);
const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
const oneYearLater = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);

async function main() {
  console.log('开始清理旧数据...');
  await prisma.auditHistory.deleteMany({});
  await prisma.temperatureRecord.deleteMany({});
  await prisma.destructionReceipt.deleteMany({});
  await prisma.shipment.deleteMany({});
  await prisma.recipient.deleteMany({});
  await prisma.receivingInstitution.deleteMany({});
  await prisma.sampleBatch.deleteMany({});

  console.log('创建接收机构...');
  const institutions = await Promise.all([
    prisma.receivingInstitution.create({
      data: {
        name: '北京协和医院',
        address: '北京市东城区帅府园1号',
        contact: '王主任',
        phone: '010-69156114'
      }
    }),
    prisma.receivingInstitution.create({
      data: {
        name: '上海中山医院',
        address: '上海市徐汇区枫林路180号',
        contact: '李主任',
        phone: '021-64041990'
      }
    }),
    prisma.receivingInstitution.create({
      data: {
        name: '广州南方医院',
        address: '广州市白云区广州大道北1838号',
        contact: '张主任',
        phone: '020-61641888'
      }
    })
  ]);

  console.log('创建接收人资质...');
  const recipients = await Promise.all([
    prisma.recipient.create({
      data: {
        institutionId: institutions[0].id,
        name: '张医生',
        idNumber: '110101198001011234',
        qualificationType: '执业医师资格证',
        qualificationNum: '110101198001011234',
        issueDate: oneYearAgo,
        expiryDate: oneYearLater,
        isActive: true
      }
    }),
    prisma.recipient.create({
      data: {
        institutionId: institutions[1].id,
        name: '李医生',
        idNumber: '310101198505055678',
        qualificationType: '执业医师资格证',
        qualificationNum: '310101198505055678',
        issueDate: new Date(today.getTime() - 700 * 24 * 60 * 60 * 1000),
        expiryDate: thirtyDaysAgo,
        isActive: true
      }
    }),
    prisma.recipient.create({
      data: {
        institutionId: institutions[2].id,
        name: '王医生',
        idNumber: '440101199001019876',
        qualificationType: '执业药师资格证',
        qualificationNum: '440101199001019876',
        issueDate: new Date(today.getTime() - 500 * 24 * 60 * 60 * 1000),
        expiryDate: thirtyDaysLater,
        isActive: true
      }
    }),
    prisma.recipient.create({
      data: {
        institutionId: institutions[0].id,
        name: '赵医生',
        idNumber: '110101197501014567',
        qualificationType: '执业医师资格证',
        qualificationNum: '110101197501014567',
        issueDate: new Date(today.getTime() - 400 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(today.getTime() + 200 * 24 * 60 * 60 * 1000),
        isActive: true
      }
    })
  ]);

  console.log('创建样本批次...');
  const batches = await Promise.all([
    prisma.sampleBatch.create({
      data: {
        batchNumber: 'BATCH-2026-001',
        sampleName: '新型冠状病毒疫苗样品',
        quantity: 50,
        manufacturer: '科兴中维生物技术有限公司',
        productionDate: sixtyDaysAgo,
        expiryDate: new Date(today.getTime() + 335 * 24 * 60 * 60 * 1000),
        storageTempMin: 2,
        storageTempMax: 8,
        description: '临床试验用疫苗样品，需严格温控'
      }
    }),
    prisma.sampleBatch.create({
      data: {
        batchNumber: 'BATCH-2026-002',
        sampleName: '抗肿瘤药物样品',
        quantity: 30,
        manufacturer: '恒瑞医药股份有限公司',
        productionDate: thirtyDaysAgo,
        expiryDate: new Date(today.getTime() + 360 * 24 * 60 * 60 * 1000),
        storageTempMin: -20,
        storageTempMax: -15,
        description: '靶向药物样品，超低温保存'
      }
    }),
    prisma.sampleBatch.create({
      data: {
        batchNumber: 'BATCH-2026-003',
        sampleName: '抗生素对照品',
        quantity: 100,
        manufacturer: '石药集团',
        productionDate: ninetyDaysAgo(),
        expiryDate: new Date(today.getTime() + 270 * 24 * 60 * 60 * 1000),
        storageTempMin: 15,
        storageTempMax: 25,
        description: '常温保存对照品'
      }
    })
  ]);

  console.log('创建寄送申请样例...');
  
  console.log('样例1: 正常寄送流程（已完成全流程）');
  const normalShipment = await prisma.shipment.create({
    data: {
      shipmentNumber: 'SP-20260501-0001',
      batchId: batches[0].id,
      institutionId: institutions[0].id,
      recipientId: recipients[0].id,
      applicant: '申请专员-张三',
      applicationDate: sixtyDaysAgo,
      status: 'CLOSED',
      purpose: '临床试验样本检测',
      remark: '常规临床检测',
      approvedBy: '审批员-李四',
      approvedAt: new Date(sixtyDaysAgo.getTime() + 1 * 24 * 60 * 60 * 1000),
      closedAt: new Date(fifteenDaysAgo.getTime() + 2 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.temperatureRecord.createMany({
    data: [
      { shipmentId: normalShipment.id, recordTime: new Date(sixtyDaysAgo.getTime() + 2 * 24 * 60 * 60 * 1000), temperature: 4.5, status: 'NORMAL' },
      { shipmentId: normalShipment.id, recordTime: new Date(sixtyDaysAgo.getTime() + 2 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000), temperature: 5.2, status: 'NORMAL' },
      { shipmentId: normalShipment.id, recordTime: new Date(sixtyDaysAgo.getTime() + 2 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000), temperature: 3.8, status: 'NORMAL' },
      { shipmentId: normalShipment.id, recordTime: new Date(sixtyDaysAgo.getTime() + 3 * 24 * 60 * 60 * 1000), temperature: 4.1, status: 'NORMAL' },
      { shipmentId: normalShipment.id, recordTime: new Date(sixtyDaysAgo.getTime() + 3 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000), temperature: 5.5, status: 'NORMAL' }
    ]
  });

  await prisma.destructionReceipt.create({
    data: {
      shipmentId: normalShipment.id,
      destructionDate: fifteenDaysAgo,
      destructionMethod: '高压蒸汽灭菌',
      witnessName: '监督员-王五',
      receiptNumber: 'DEST-2026-0001',
      remark: '按SOP销毁，全程录像'
    }
  });

  await prisma.auditHistory.createMany({
    data: [
      { shipmentId: normalShipment.id, action: 'CREATE', operator: '申请专员-张三', description: '创建寄送申请: SP-20260501-0001' },
      { shipmentId: normalShipment.id, action: 'APPROVE', operator: '审批员-李四', description: '审批通过寄送申请' },
      { shipmentId: normalShipment.id, action: 'SHIP', operator: '物流员-赵六', description: '发出样本' },
      { shipmentId: normalShipment.id, action: 'DELIVER', operator: '张医生', description: '签收样本' },
      { shipmentId: normalShipment.id, action: 'DESTROY', operator: '监督员-王五', description: '记录销毁回执，方法: 高压蒸汽灭菌' },
      { shipmentId: normalShipment.id, action: 'CLOSE', operator: '系统管理员', description: '关闭寄送申请' }
    ]
  });

  console.log('样例2: 资质过期（创建时拦截，或审批时拦截）');
  const expiredQualificationShipment = await prisma.shipment.create({
    data: {
      shipmentNumber: 'SP-20260505-0002',
      batchId: batches[1].id,
      institutionId: institutions[1].id,
      recipientId: recipients[1].id,
      applicant: '申请专员-张三',
      applicationDate: fifteenDaysAgo,
      status: 'REJECTED',
      purpose: '抗肿瘤药物临床试验',
      remark: '需要上海中山医院的临床数据',
      approvedBy: '审批员-李四',
      approvedAt: new Date(fifteenDaysAgo.getTime() + 1 * 24 * 60 * 60 * 1000),
      rejectReason: '接收人李医生的执业医师资格证已过期（有效期至: ' + thirtyDaysAgo.toLocaleDateString() + '）'
    }
  });

  await prisma.auditHistory.createMany({
    data: [
      { shipmentId: expiredQualificationShipment.id, action: 'CREATE', operator: '申请专员-张三', description: '创建寄送申请: SP-20260505-0002' },
      { shipmentId: expiredQualificationShipment.id, action: 'REJECT', operator: '审批员-李四', description: '审批驳回寄送申请，原因: 接收人资质已过期' }
    ]
  });

  console.log('样例3: 温控异常（有超限记录，部分未复核）');
  const tempExceptionShipment = await prisma.shipment.create({
    data: {
      shipmentNumber: 'SP-20260508-0003',
      batchId: batches[1].id,
      institutionId: institutions[2].id,
      recipientId: recipients[2].id,
      applicant: '申请专员-钱七',
      applicationDate: fifteenDaysAgo,
      status: 'DELIVERED',
      purpose: '低温药物样品配送',
      remark: '需严格控制-18°C左右',
      approvedBy: '审批员-李四',
      approvedAt: new Date(fifteenDaysAgo.getTime() + 0.5 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.temperatureRecord.createMany({
    data: [
      { shipmentId: tempExceptionShipment.id, recordTime: new Date(fifteenDaysAgo.getTime() + 1 * 24 * 60 * 60 * 1000), temperature: -18.5, status: 'NORMAL' },
      { shipmentId: tempExceptionShipment.id, recordTime: new Date(fifteenDaysAgo.getTime() + 1 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), temperature: -17.8, status: 'NORMAL' },
      { shipmentId: tempExceptionShipment.id, recordTime: new Date(fifteenDaysAgo.getTime() + 1 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000), temperature: -10.0, status: 'EXCEEDED', reviewedBy: '质控员-孙八', reviewedAt: new Date(fifteenDaysAgo.getTime() + 1.5 * 24 * 60 * 60 * 1000), reviewRemark: '温控设备短暂故障，已修复，样本仍可使用' },
      { shipmentId: tempExceptionShipment.id, recordTime: new Date(fifteenDaysAgo.getTime() + 2 * 24 * 60 * 60 * 1000), temperature: -5.5, status: 'EXCEEDED' },
      { shipmentId: tempExceptionShipment.id, recordTime: new Date(fifteenDaysAgo.getTime() + 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), temperature: -18.2, status: 'NORMAL' }
    ]
  });

  await prisma.auditHistory.createMany({
    data: [
      { shipmentId: tempExceptionShipment.id, action: 'CREATE', operator: '申请专员-钱七', description: '创建寄送申请: SP-20260508-0003' },
      { shipmentId: tempExceptionShipment.id, action: 'APPROVE', operator: '审批员-李四', description: '审批通过寄送申请' },
      { shipmentId: tempExceptionShipment.id, action: 'SHIP', operator: '物流员-周九', description: '发出样本' },
      { shipmentId: tempExceptionShipment.id, action: 'DELIVER', operator: '王医生', description: '签收样本' }
    ]
  });

  console.log('样例4: 销毁回执缺失（已签收但未销毁）');
  const pendingDestructionShipment = await prisma.shipment.create({
    data: {
      shipmentNumber: 'SP-20260510-0004',
      batchId: batches[2].id,
      institutionId: institutions[0].id,
      recipientId: recipients[3].id,
      applicant: '申请专员-张三',
      applicationDate: thirtyDaysAgo,
      status: 'DELIVERED',
      purpose: '抗生素对照品质量复核',
      remark: '常温运输',
      approvedBy: '审批员-李四',
      approvedAt: new Date(thirtyDaysAgo.getTime() + 1 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.temperatureRecord.createMany({
    data: [
      { shipmentId: pendingDestructionShipment.id, recordTime: new Date(thirtyDaysAgo.getTime() + 2 * 24 * 60 * 60 * 1000), temperature: 20.5, status: 'NORMAL' },
      { shipmentId: pendingDestructionShipment.id, recordTime: new Date(thirtyDaysAgo.getTime() + 2 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000), temperature: 21.8, status: 'NORMAL' }
    ]
  });

  await prisma.auditHistory.createMany({
    data: [
      { shipmentId: pendingDestructionShipment.id, action: 'CREATE', operator: '申请专员-张三', description: '创建寄送申请: SP-20260510-0004' },
      { shipmentId: pendingDestructionShipment.id, action: 'APPROVE', operator: '审批员-李四', description: '审批通过寄送申请' },
      { shipmentId: pendingDestructionShipment.id, action: 'SHIP', operator: '物流员-赵六', description: '发出样本' },
      { shipmentId: pendingDestructionShipment.id, action: 'DELIVER', operator: '赵医生', description: '签收样本' }
    ]
  });

  console.log('样例5: 待处理状态（等待审批）');
  await prisma.shipment.create({
    data: {
      shipmentNumber: 'SP-20260510-0005',
      batchId: batches[0].id,
      institutionId: institutions[2].id,
      recipientId: recipients[2].id,
      applicant: '申请专员-钱七',
      applicationDate: today,
      status: 'PENDING',
      purpose: '疫苗临床试验样本',
      remark: '急需发送'
    }
  });

  console.log('\n种子数据创建完成!');
  console.log('\n样例数据说明:');
  console.log('1. 正常寄送 (SP-20260501-0001): 已关闭，全流程合规，有完整销毁回执');
  console.log('2. 资质过期 (SP-20260505-0002): 已驳回，接收人资质已过期');
  console.log('3. 温控异常 (SP-20260508-0003): 已签收，存在温控超限记录（1条已复核，1条待复核）');
  console.log('4. 回执缺失 (SP-20260510-0004): 已签收，销毁回执尚未提交');
  console.log('5. 待处理 (SP-20260510-0005): 待审批，新建申请');
}

function ninetyDaysAgo() {
  return new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
