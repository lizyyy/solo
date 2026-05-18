import { v4 as uuidv4 } from 'uuid';
import { RepairRecord, RepairStatus, RepairPriority, RepairCategory } from '../types/repair';
import { repairRepository } from '../storage/repository';

const sampleRepairs: Omit<RepairRecord, 'id' | 'repairNumber' | 'createdAt' | 'updatedAt' | 'submittedAt' | 'version'>[] = [
  {
    title: '3号楼电梯故障停运',
    description: '3号楼电梯突然停运，轿厢内有人员被困。电梯控制屏显示故障代码E01，主板指示灯不亮。',
    category: RepairCategory.ELEVATOR,
    priority: RepairPriority.EMERGENCY,
    status: RepairStatus.IN_PROGRESS,
    location: {
      building: '3号楼',
      floor: '1层',
      room: '大厅',
      areaDescription: '电梯A'
    },
    reporter: {
      name: '张三',
      phone: '13800138001',
      roomNumber: '3-101',
      email: 'zhangsan@example.com',
      isResident: true
    },
    assignment: {
      technicianId: 'tech-001',
      technicianName: '李师傅',
      assignedAt: new Date(Date.now() - 30 * 60 * 1000),
      estimatedCompletion: new Date(Date.now() + 2 * 60 * 60 * 1000)
    },
    estimatedCost: 2500,
    images: ['elevator_fault_01.jpg', 'elevator_fault_02.jpg'],
    mergeHistory: [],
    isDuplicate: false,
    duplicateCount: 0,
    relatedRepairIds: [],
    createdBy: 'system',
    notes: ['已通知电梯维保单位紧急到场', '已联系被困人员安抚情绪'],
    completedAt: undefined
  },
  {
    title: '3号楼电梯异响',
    description: '3号楼电梯运行时有明显的金属摩擦声，乘坐时感觉有颠簸。',
    category: RepairCategory.ELEVATOR,
    priority: RepairPriority.URGENT,
    status: RepairStatus.SUBMITTED,
    location: {
      building: '3号楼',
      floor: '1层',
      room: '大厅',
      areaDescription: '电梯A'
    },
    reporter: {
      name: '李四',
      phone: '13800138002',
      roomNumber: '3-202',
      isResident: true
    },
    images: [],
    mergeHistory: [],
    isDuplicate: false,
    duplicateCount: 0,
    relatedRepairIds: [],
    createdBy: 'user',
    notes: [],
    completedAt: undefined
  },
  {
    title: '1号楼水管爆裂漏水',
    description: '1号楼东侧外墙主水管爆裂，水流入地下车库。漏水情况严重，已形成积水。',
    category: RepairCategory.PLUMBING,
    priority: RepairPriority.EMERGENCY,
    status: RepairStatus.ASSIGNED,
    location: {
      building: '1号楼',
      floor: '1层',
      room: '东侧外墙',
      areaDescription: '水管井旁'
    },
    reporter: {
      name: '王五',
      phone: '13800138003',
      roomNumber: '1-1503',
      isResident: true
    },
    assignment: {
      technicianId: 'tech-002',
      technicianName: '赵师傅',
      assignedAt: new Date(Date.now() - 15 * 60 * 1000)
    },
    estimatedCost: 5000,
    images: ['water_leak_01.jpg', 'water_leak_02.jpg'],
    mergeHistory: [],
    isDuplicate: false,
    duplicateCount: 0,
    relatedRepairIds: [],
    createdBy: 'security',
    notes: ['已关闭主水阀', '正在联系抢修队伍'],
    completedAt: undefined
  },
  {
    title: '地下车库照明故障',
    description: '地下车库B区照明全部熄灭，只有应急灯工作。光线昏暗，影响行车安全。',
    category: RepairCategory.ELECTRICAL,
    priority: RepairPriority.HIGH,
    status: RepairStatus.PENDING_PARTS,
    location: {
      building: '地下车库',
      floor: 'B1层',
      room: 'B区',
      areaDescription: '车位B101-B150'
    },
    reporter: {
      name: '赵六',
      phone: '13800138004',
      roomNumber: '2-802',
      isResident: true
    },
    assignment: {
      technicianId: 'tech-003',
      technicianName: '王电工',
      assignedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    },
    estimatedCost: 1200,
    images: ['lighting_fault.jpg'],
    mergeHistory: [],
    isDuplicate: false,
    duplicateCount: 0,
    relatedRepairIds: [],
    createdBy: 'security',
    notes: ['空气开关烧毁，待采购配件更换', '预计明天下午到货'],
    completedAt: undefined
  },
  {
    title: '2号楼卫生间下水道堵塞',
    description: '2号楼3层公共卫生间下水道堵塞，污水溢出到地面，气味难闻。',
    category: RepairCategory.PLUMBING,
    priority: RepairPriority.HIGH,
    status: RepairStatus.COMPLETED,
    location: {
      building: '2号楼',
      floor: '3层',
      room: '公共卫生间',
      areaDescription: '男厕'
    },
    reporter: {
      name: '孙七',
      phone: '13800138005',
      roomNumber: '2-301',
      isResident: true
    },
    assignment: {
      technicianId: 'tech-002',
      technicianName: '赵师傅',
      assignedAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
    },
    estimatedCost: 300,
    actualCost: 280,
    images: [],
    mergeHistory: [],
    isDuplicate: false,
    duplicateCount: 0,
    relatedRepairIds: [],
    createdBy: 'user',
    notes: ['疏通完成，正常使用', '清理了地面污水'],
    completedAt: new Date(Date.now() - 20 * 60 * 60 * 1000)
  },
  {
    title: '中央空调不制冷',
    description: '4号楼公共区域中央空调出风口温度偏高，不制冷。已连续三天如此。',
    category: RepairCategory.HVAC,
    priority: RepairPriority.MEDIUM,
    status: RepairStatus.SUBMITTED,
    location: {
      building: '4号楼',
      floor: '5-12层',
      room: '公共走廊',
      areaDescription: '各楼层'
    },
    reporter: {
      name: '周八',
      phone: '13800138006',
      roomNumber: '4-1001',
      isResident: true
    },
    images: [],
    mergeHistory: [],
    isDuplicate: false,
    duplicateCount: 0,
    relatedRepairIds: [],
    createdBy: 'user',
    notes: [],
    completedAt: undefined
  }
];

async function initData() {
  console.log('开始初始化数据...\n');

  await repairRepository.clearAll();
  console.log('✓ 已清空原有数据\n');

  const repairs: RepairRecord[] = [];
  let repairNumber = 1;

  for (const sample of sampleRepairs) {
    const now = new Date();
    const repair: RepairRecord = {
      ...sample,
      id: uuidv4(),
      repairNumber: `REP-${String(repairNumber++).padStart(6, '0')}`,
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
      version: 1,
      assignment: sample.assignment ? {
        ...sample.assignment,
        assignedAt: sample.assignment.assignedAt,
        estimatedCompletion: sample.assignment.estimatedCompletion
      } : undefined,
      completedAt: sample.completedAt
    };
    repairs.push(repair);
  }

  const result = await repairRepository.bulkImport(repairs);

  console.log(`✓ 成功导入 ${result.success.length} 条报修记录:`);
  result.success.forEach((id, index) => {
    const repair = repairs.find(r => r.id === id);
    if (repair) {
      console.log(`  ${index + 1}. [${repair.repairNumber}] ${repair.title} - ${repair.status}`);
    }
  });

  if (result.failed.length > 0) {
    console.log(`\n⚠ 导入失败 ${result.failed.length} 条:`);
    result.failed.forEach((fail, index) => {
      console.log(`  ${index + 1}. ${fail.record.title} - ${fail.error}`);
    });
  }

  console.log('\n数据初始化完成！');
  console.log(`\n统计信息:`);
  console.log(`  总记录数: ${result.success.length}`);
  console.log(`  紧急报修: ${repairs.filter(r => r.priority === RepairPriority.EMERGENCY).length}`);
  console.log(`  高优先级: ${repairs.filter(r => r.priority === RepairPriority.HIGH).length}`);
  console.log(`  处理中: ${repairs.filter(r => r.status === RepairStatus.IN_PROGRESS).length}`);
  console.log(`  待配件: ${repairs.filter(r => r.status === RepairStatus.PENDING_PARTS).length}`);
  console.log(`  已完成: ${repairs.filter(r => r.status === RepairStatus.COMPLETED).length}`);
}

initData().catch(console.error);
