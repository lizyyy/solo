import { v4 as uuidv4 } from 'uuid';
import { store } from './store';
import {
  LineChangePlan,
  MoldInspection,
  MaterialKitting,
  FirstArticleInspection,
  PersonQualification,
  MissingItem,
  StatusHistory,
  ChangeLog
} from './types';

export function initSampleData() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const persons = [
    { id: 'P001', name: '张三' },
    { id: 'P002', name: '李四' },
    { id: 'P003', name: '王五' },
    { id: 'P004', name: '赵六' },
    { id: 'P005', name: '钱七' }
  ];

  const plans: LineChangePlan[] = [
    {
      id: uuidv4(),
      planNo: 'PLAN-2024-001',
      line: 'LINE-A',
      productCode: 'PROD-001',
      productName: '产品A-标准版',
      plannedStartTime: lastMonth.toISOString(),
      plannedEndTime: tomorrow.toISOString(),
      actualStartTime: lastMonth.toISOString(),
      actualEndTime: now.toISOString(),
      status: 'COMPLETED',
      responsiblePerson: '张三',
      responsiblePersonId: 'P001',
      remarks: '正常完成',
      createdAt: lastMonth.toISOString(),
      updatedAt: now.toISOString(),
      version: 2
    },
    {
      id: uuidv4(),
      planNo: 'PLAN-2024-002',
      line: 'LINE-B',
      productCode: 'PROD-002',
      productName: '产品B-增强版',
      plannedStartTime: now.toISOString(),
      plannedEndTime: nextWeek.toISOString(),
      actualStartTime: now.toISOString(),
      status: 'IN_PROGRESS',
      responsiblePerson: '李四',
      responsiblePersonId: 'P002',
      remarks: '进行中，物料有缺项',
      createdAt: yesterday(now).toISOString(),
      updatedAt: now.toISOString(),
      version: 3
    },
    {
      id: uuidv4(),
      planNo: 'PLAN-2024-003',
      line: 'LINE-C',
      productCode: 'PROD-003',
      productName: '产品C-高级版',
      plannedStartTime: nextWeek.toISOString(),
      plannedEndTime: nextMonth.toISOString(),
      status: 'PENDING',
      responsiblePerson: '王五',
      responsiblePersonId: 'P003',
      remarks: '待审批',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      version: 1
    },
    {
      id: uuidv4(),
      planNo: 'PLAN-2024-004',
      line: 'LINE-A',
      productCode: 'PROD-004',
      productName: '产品D-定制版',
      plannedStartTime: tomorrow.toISOString(),
      plannedEndTime: nextWeek.toISOString(),
      status: 'REVIEW',
      responsiblePerson: '赵六',
      responsiblePersonId: 'P004',
      remarks: '待复核',
      createdAt: yesterday(now).toISOString(),
      updatedAt: now.toISOString(),
      version: 2
    },
    {
      id: uuidv4(),
      planNo: 'PLAN-2024-005',
      line: 'LINE-B',
      productCode: 'PROD-005',
      productName: '产品E-限量版',
      plannedStartTime: lastMonth.toISOString(),
      plannedEndTime: yesterday(now).toISOString(),
      status: 'REJECTED',
      responsiblePerson: '钱七',
      responsiblePersonId: 'P005',
      remarks: '审核不通过，需要重新提交',
      createdAt: lastMonth.toISOString(),
      updatedAt: yesterday(now).toISOString(),
      version: 2
    }
  ];

  plans.forEach(plan => store.lineChangePlans.set(plan.id, plan));

  const moldItemsTemplate = [
    { name: '外观检查', standard: '无明显划痕、变形' },
    { name: '尺寸测量', standard: '符合图纸要求±0.02mm' },
    { name: '安装孔位', standard: '孔位正确，无偏差' },
    { name: '导向机构', standard: '运行顺畅，无卡顿' },
    { name: '冷却水路', standard: '无泄漏，流量正常' },
    { name: '顶出机构', standard: '顶出平稳，同步性好' },
    { name: '型腔表面', standard: '光洁度达标，无锈蚀' },
    { name: '锁紧装置', standard: '锁紧可靠，无松动' }
  ];

  const moldInspections: MoldInspection[] = [
    {
      id: uuidv4(),
      planId: plans[0].id,
      moldCode: 'MOLD-001',
      moldName: '注塑模具A',
      items: moldItemsTemplate.map((item, idx) => ({
        id: uuidv4(),
        ...item,
        result: idx === 3 ? '轻微卡顿，已润滑' : '正常',
        isPassed: true,
        checkedBy: '李四',
        checkedAt: lastMonth.toISOString()
      })),
      status: 'REVIEWED',
      checkedBy: '李四',
      checkedAt: lastMonth.toISOString(),
      reviewedBy: '张三',
      reviewedAt: yesterday(now).toISOString(),
      createdAt: lastMonth.toISOString(),
      updatedAt: yesterday(now).toISOString(),
      version: 2
    },
    {
      id: uuidv4(),
      planId: plans[1].id,
      moldCode: 'MOLD-002',
      moldName: '冲压模具B',
      items: [
        ...moldItemsTemplate.slice(0, 4).map((item, idx) => ({
          id: uuidv4(),
          ...item,
          result: idx === 1 ? '偏差0.03mm，超出标准' : '正常',
          isPassed: idx !== 1,
          checkedBy: '王五',
          checkedAt: now.toISOString()
        })),
        ...moldItemsTemplate.slice(4).map(item => ({
          id: uuidv4(),
          ...item,
          result: undefined,
          isPassed: undefined,
          checkedBy: undefined,
          checkedAt: undefined
        }))
      ],
      status: 'IN_PROGRESS',
      checkedBy: '王五',
      checkedAt: now.toISOString(),
      createdAt: yesterday(now).toISOString(),
      updatedAt: now.toISOString(),
      version: 2
    },
    {
      id: uuidv4(),
      planId: plans[2].id,
      moldCode: 'MOLD-003',
      moldName: '吹塑模具C',
      items: moldItemsTemplate.map(item => ({
        id: uuidv4(),
        ...item,
        result: undefined,
        isPassed: undefined,
        checkedBy: undefined,
        checkedAt: undefined
      })),
      status: 'NOT_STARTED',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      version: 1
    }
  ];

  moldInspections.forEach(inspection => store.moldInspections.set(inspection.id, inspection));

  const materialsTemplate = [
    { materialCode: 'MAT-001', materialName: 'ABS塑料粒', unit: 'kg', location: 'A-01-01' },
    { materialCode: 'MAT-002', materialName: 'PC塑料粒', unit: 'kg', location: 'A-01-02' },
    { materialCode: 'MAT-003', materialName: '色母粒', unit: 'kg', location: 'B-02-01' },
    { materialCode: 'MAT-004', materialName: '脱模剂', unit: '瓶', location: 'C-03-01' },
    { materialCode: 'MAT-005', materialName: '清洗剂', unit: '瓶', location: 'C-03-02' },
    { materialCode: 'MAT-006', materialName: '润滑油', unit: 'L', location: 'D-04-01' }
  ];

  const materialKittings: MaterialKitting[] = [
    {
      id: uuidv4(),
      planId: plans[0].id,
      items: materialsTemplate.map(m => ({
        id: uuidv4(),
        ...m,
        requiredQty: 100,
        actualQty: 100,
        status: 'COMPLETE' as const,
        checkedBy: '赵六',
        checkedAt: lastMonth.toISOString()
      })),
      status: 'COMPLETE',
      checkedBy: '赵六',
      checkedAt: lastMonth.toISOString(),
      reviewedBy: '张三',
      reviewedAt: yesterday(now).toISOString(),
      createdAt: lastMonth.toISOString(),
      updatedAt: yesterday(now).toISOString(),
      version: 2
    },
    {
      id: uuidv4(),
      planId: plans[1].id,
      items: [
        ...materialsTemplate.slice(0, 2).map(m => ({
          id: uuidv4(),
          ...m,
          requiredQty: 150,
          actualQty: 150,
          status: 'COMPLETE' as const,
          checkedBy: '钱七',
          checkedAt: now.toISOString()
        })),
        {
          id: uuidv4(),
          ...materialsTemplate[2],
          requiredQty: 50,
          actualQty: 30,
          status: 'PARTIAL' as const,
          checkedBy: '钱七',
          checkedAt: now.toISOString()
        },
        {
          id: uuidv4(),
          ...materialsTemplate[3],
          requiredQty: 20,
          actualQty: 0,
          status: 'MISSING' as const,
          checkedBy: undefined,
          checkedAt: undefined
        },
        ...materialsTemplate.slice(4).map(m => ({
          id: uuidv4(),
          ...m,
          requiredQty: 10,
          actualQty: 0,
          status: 'NOT_STARTED' as const,
          checkedBy: undefined,
          checkedAt: undefined
        }))
      ],
      status: 'IN_PROGRESS',
      checkedBy: '钱七',
      checkedAt: now.toISOString(),
      createdAt: yesterday(now).toISOString(),
      updatedAt: now.toISOString(),
      version: 3
    }
  ];

  materialKittings.forEach(kitting => store.materialKittings.set(kitting.id, kitting));

  const firstArticleItemsTemplate = [
    { name: '外观检验', standard: '无明显缺陷，色泽均匀' },
    { name: '尺寸A', standard: '50±0.5mm' },
    { name: '尺寸B', standard: '30±0.3mm' },
    { name: '壁厚', standard: '2.0±0.2mm' },
    { name: '重量', standard: '100±5g' },
    { name: '硬度测试', standard: '≥80 Shore D' },
    { name: '拉伸强度', standard: '≥40 MPa' },
    { name: '冲击强度', standard: '≥5 kJ/m²' }
  ];

  const firstArticleInspections: FirstArticleInspection[] = [
    {
      id: uuidv4(),
      planId: plans[0].id,
      serialNo: 'FA-2024-001',
      items: firstArticleItemsTemplate.map((item, idx) => ({
        id: uuidv4(),
        ...item,
        result: '合格',
        measuredValue: idx === 1 ? '50.2mm' : idx === 2 ? '29.9mm' : idx === 3 ? '2.1mm' : idx === 4 ? '98g' : '符合要求',
        isPassed: true,
        checkedBy: '赵六',
        checkedAt: lastMonth.toISOString()
      })),
      status: 'REVIEWED',
      checkedBy: '赵六',
      checkedAt: lastMonth.toISOString(),
      reviewedBy: '张三',
      reviewedAt: yesterday(now).toISOString(),
      createdAt: lastMonth.toISOString(),
      updatedAt: yesterday(now).toISOString(),
      version: 2
    },
    {
      id: uuidv4(),
      planId: plans[1].id,
      serialNo: 'FA-2024-002',
      items: [
        ...firstArticleItemsTemplate.slice(0, 3).map((item, idx) => ({
          id: uuidv4(),
          ...item,
          result: idx === 1 ? '尺寸偏大' : '合格',
          measuredValue: idx === 1 ? '51.0mm' : idx === 2 ? '29.8mm' : '良好',
          isPassed: idx !== 1,
          checkedBy: '钱七',
          checkedAt: now.toISOString()
        })),
        ...firstArticleItemsTemplate.slice(3).map(item => ({
          id: uuidv4(),
          ...item,
          result: undefined,
          measuredValue: undefined,
          isPassed: undefined,
          checkedBy: undefined,
          checkedAt: undefined
        }))
      ],
      status: 'FAILED',
      checkedBy: '钱七',
      checkedAt: now.toISOString(),
      createdAt: yesterday(now).toISOString(),
      updatedAt: now.toISOString(),
      version: 2
    }
  ];

  firstArticleInspections.forEach(inspection => store.firstArticleInspections.set(inspection.id, inspection));

  const qualifications: PersonQualification[] = [
    {
      id: uuidv4(),
      personId: 'P001',
      personName: '张三',
      qualificationType: '模具点检员',
      qualificationCode: 'QC-MOLD-001',
      validFrom: lastMonth.toISOString(),
      validTo: nextMonth.toISOString(),
      status: 'VALID'
    },
    {
      id: uuidv4(),
      personId: 'P001',
      personName: '张三',
      qualificationType: '首件检验员',
      qualificationCode: 'QC-FA-001',
      validFrom: lastMonth.toISOString(),
      validTo: nextMonth.toISOString(),
      status: 'VALID'
    },
    {
      id: uuidv4(),
      personId: 'P002',
      personName: '李四',
      qualificationType: '模具点检员',
      qualificationCode: 'QC-MOLD-002',
      validFrom: lastMonth.toISOString(),
      validTo: tomorrow.toISOString(),
      status: 'VALID'
    },
    {
      id: uuidv4(),
      personId: 'P003',
      personName: '王五',
      qualificationType: '物料管理员',
      qualificationCode: 'WH-MAT-001',
      validFrom: lastMonth.toISOString(),
      validTo: nextWeek.toISOString(),
      status: 'VALID'
    },
    {
      id: uuidv4(),
      personId: 'P004',
      personName: '赵六',
      qualificationType: '首件检验员',
      qualificationCode: 'QC-FA-002',
      validFrom: lastMonth.toISOString(),
      validTo: yesterday(now).toISOString(),
      status: 'EXPIRED'
    },
    {
      id: uuidv4(),
      personId: 'P005',
      personName: '钱七',
      qualificationType: '换线操作员',
      qualificationCode: 'OP-LINE-001',
      validFrom: lastMonth.toISOString(),
      validTo: nextMonth.toISOString(),
      status: 'VALID'
    }
  ];

  qualifications.forEach(q => store.personQualifications.set(q.id, q));

  const missingItems: MissingItem[] = [
    {
      id: uuidv4(),
      planId: plans[1].id,
      category: 'MATERIAL',
      name: '色母粒短缺',
      description: '色母粒MAT-003库存不足，需要采购20kg',
      responsiblePerson: '王五',
      dueDate: tomorrow.toISOString(),
      status: 'IN_PROGRESS',
      createdBy: '李四',
      createdAt: yesterday(now).toISOString()
    },
    {
      id: uuidv4(),
      planId: plans[1].id,
      category: 'MATERIAL',
      name: '脱模剂缺失',
      description: '脱模剂MAT-004库存为0，急需补货',
      responsiblePerson: '王五',
      dueDate: now.toISOString(),
      status: 'OPEN',
      createdBy: '李四',
      createdAt: yesterday(now).toISOString()
    },
    {
      id: uuidv4(),
      planId: plans[0].id,
      category: 'TOOL',
      name: '专用扳手损坏',
      description: '模具安装专用扳手损坏，需要更换',
      responsiblePerson: '赵六',
      dueDate: yesterday(now).toISOString(),
      status: 'RESOLVED',
      resolvedAt: now.toISOString(),
      createdBy: '张三',
      createdAt: lastMonth.toISOString()
    },
    {
      id: uuidv4(),
      planId: plans[2].id,
      category: 'DOCUMENT',
      name: '作业指导书未更新',
      description: '新产品的作业指导书需要更新',
      responsiblePerson: '钱七',
      dueDate: nextWeek.toISOString(),
      status: 'OPEN',
      createdBy: '王五',
      createdAt: now.toISOString()
    },
    {
      id: uuidv4(),
      planId: plans[1].id,
      category: 'MOLD',
      name: '模具导向机构异常',
      description: '模具导向机构有卡顿，需要检修',
      responsiblePerson: '李四',
      dueDate: tomorrow.toISOString(),
      status: 'IN_PROGRESS',
      createdBy: '王五',
      createdAt: now.toISOString()
    }
  ];

  missingItems.forEach(item => store.missingItems.set(item.id, item));

  plans.forEach(plan => {
    store.addStatusHistory(plan.id, 'LINE_CHANGE', 'DRAFT', undefined, plan.responsiblePerson, plan.responsiblePersonId, '创建计划');
    if (plan.status !== 'DRAFT') {
      store.addStatusHistory(plan.id, 'LINE_CHANGE', 'PENDING', 'DRAFT', plan.responsiblePerson, plan.responsiblePersonId, '提交审核');
    }
    if (plan.status === 'IN_PROGRESS') {
      store.addStatusHistory(plan.id, 'LINE_CHANGE', 'IN_PROGRESS', 'PENDING', '张三', 'P001', '审核通过，开始执行');
    }
    if (plan.status === 'COMPLETED') {
      store.addStatusHistory(plan.id, 'LINE_CHANGE', 'IN_PROGRESS', 'PENDING', '张三', 'P001', '审核通过，开始执行');
      store.addStatusHistory(plan.id, 'LINE_CHANGE', 'COMPLETED', 'IN_PROGRESS', '张三', 'P001', '执行完成');
    }
    if (plan.status === 'REJECTED') {
      store.addStatusHistory(plan.id, 'LINE_CHANGE', 'REJECTED', 'PENDING', '张三', 'P001', '审核不通过');
    }
    if (plan.status === 'REVIEW') {
      store.addStatusHistory(plan.id, 'LINE_CHANGE', 'REVIEW', 'PENDING', '张三', 'P001', '待复核');
    }
  });

  console.log('Sample data initialized successfully!');
}

function yesterday(date: Date): Date {
  return new Date(date.getTime() - 24 * 60 * 60 * 1000);
}
