import { PrismaClient } from '@prisma/client';
import { addDays, subDays, startOfDay, endOfDay } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('开始创建种子数据...');

  const buildings = await Promise.all([
    prisma.building.create({
      data: {
        name: '1号楼',
        description: '综合办公楼',
        location: '园区北侧'
      }
    }),
    prisma.building.create({
      data: {
        name: '2号楼',
        description: '研发中心',
        location: '园区东侧'
      }
    }),
    prisma.building.create({
      data: {
        name: '3号楼',
        description: '生产车间',
        location: '园区南侧'
      }
    })
  ]);

  console.log('创建了 3 栋楼');

  const workers = await Promise.all([
    prisma.worker.create({
      data: {
        name: '张师傅',
        phone: '13800138001',
        skills: JSON.stringify(['电气', '空调', '电梯'])
      }
    }),
    prisma.worker.create({
      data: {
        name: '李师傅',
        phone: '13800138002',
        skills: JSON.stringify(['水暖', '消防', '管道'])
      }
    }),
    prisma.worker.create({
      data: {
        name: '王师傅',
        phone: '13800138003',
        skills: JSON.stringify(['机械', '电气', '电梯'])
      }
    })
  ]);

  console.log('创建了 3 个维修师傅');

  const devices = await Promise.all([
    prisma.device.create({
      data: {
        name: '客梯-1号',
        type: '电梯',
        buildingId: buildings[0].id,
        location: '1号楼大厅左侧',
        status: 'active'
      }
    }),
    prisma.device.create({
      data: {
        name: '中央空调-1单元',
        type: '空调',
        buildingId: buildings[0].id,
        location: '1号楼楼顶',
        status: 'active'
      }
    }),
    prisma.device.create({
      data: {
        name: '消防泵房-1号',
        type: '消防',
        buildingId: buildings[0].id,
        location: '1号楼地下室',
        status: 'active'
      }
    }),
    prisma.device.create({
      data: {
        name: '货梯-2号',
        type: '电梯',
        buildingId: buildings[1].id,
        location: '2号楼东侧',
        status: 'active'
      }
    }),
    prisma.device.create({
      data: {
        name: '配电柜-2单元',
        type: '电气',
        buildingId: buildings[1].id,
        location: '2号楼配电室',
        status: 'active'
      }
    }),
    prisma.device.create({
      data: {
        name: '供暖锅炉-2号',
        type: '水暖',
        buildingId: buildings[1].id,
        location: '2号楼锅炉房',
        status: 'active'
      }
    }),
    prisma.device.create({
      data: {
        name: '客梯-3号',
        type: '电梯',
        buildingId: buildings[2].id,
        location: '3号楼大厅',
        status: 'active'
      }
    }),
    prisma.device.create({
      data: {
        name: '工业空调-3单元',
        type: '空调',
        buildingId: buildings[2].id,
        location: '3号楼生产车间',
        status: 'active'
      }
    })
  ]);

  console.log('创建了 8 台设备');

  const inspectionTemplates = [];
  
  inspectionTemplates.push(await prisma.inspectionTemplate.create({
    data: {
      name: '电梯日常巡检模板',
      deviceId: devices[0].id,
      checkItems: {
        create: [
          { name: '电梯运行状态', description: '检查电梯运行是否平稳', sortOrder: 1 },
          { name: '电梯门开关', description: '检查门开关是否正常', sortOrder: 2 },
          { name: '紧急呼叫按钮', description: '检查紧急呼叫是否正常', sortOrder: 3 },
          { name: '轿厢照明', description: '检查照明是否正常', sortOrder: 4 }
        ]
      }
    }
  }));

  inspectionTemplates.push(await prisma.inspectionTemplate.create({
    data: {
      name: '电梯日常巡检模板',
      deviceId: devices[3].id,
      checkItems: {
        create: [
          { name: '电梯运行状态', description: '检查电梯运行是否平稳', sortOrder: 1 },
          { name: '电梯门开关', description: '检查门开关是否正常', sortOrder: 2 },
          { name: '紧急呼叫按钮', description: '检查紧急呼叫是否正常', sortOrder: 3 },
          { name: '轿厢照明', description: '检查照明是否正常', sortOrder: 4 }
        ]
      }
    }
  }));

  inspectionTemplates.push(await prisma.inspectionTemplate.create({
    data: {
      name: '电梯日常巡检模板',
      deviceId: devices[6].id,
      checkItems: {
        create: [
          { name: '电梯运行状态', description: '检查电梯运行是否平稳', sortOrder: 1 },
          { name: '电梯门开关', description: '检查门开关是否正常', sortOrder: 2 },
          { name: '紧急呼叫按钮', description: '检查紧急呼叫是否正常', sortOrder: 3 },
          { name: '轿厢照明', description: '检查照明是否正常', sortOrder: 4 }
        ]
      }
    }
  }));

  inspectionTemplates.push(await prisma.inspectionTemplate.create({
    data: {
      name: '空调日常巡检模板',
      deviceId: devices[1].id,
      checkItems: {
        create: [
          { name: '制冷/制热效果', description: '检查空调效果是否正常', sortOrder: 1 },
          { name: '滤网清洁度', description: '检查滤网是否需要清洁', sortOrder: 2 },
          { name: '外机运行噪音', description: '检查外机噪音是否异常', sortOrder: 3 },
          { name: '冷凝水排水', description: '检查冷凝水是否正常排出', sortOrder: 4 }
        ]
      }
    }
  }));

  inspectionTemplates.push(await prisma.inspectionTemplate.create({
    data: {
      name: '工业空调巡检模板',
      deviceId: devices[7].id,
      checkItems: {
        create: [
          { name: '制冷效果', description: '检查工业空调制冷效果', sortOrder: 1 },
          { name: '压力参数', description: '检查高低压是否正常', sortOrder: 2 },
          { name: '风机运行', description: '检查风机是否正常运转', sortOrder: 3 }
        ]
      }
    }
  }));

  inspectionTemplates.push(await prisma.inspectionTemplate.create({
    data: {
      name: '消防泵房巡检模板',
      deviceId: devices[2].id,
      checkItems: {
        create: [
          { name: '水泵压力', description: '检查水泵压力是否正常', sortOrder: 1 },
          { name: '阀门状态', description: '检查阀门开关状态', sortOrder: 2 },
          { name: '控制柜指示灯', description: '检查指示灯是否正常', sortOrder: 3 },
          { name: '消防联动测试', description: '测试消防联动功能', sortOrder: 4 }
        ]
      }
    }
  }));

  inspectionTemplates.push(await prisma.inspectionTemplate.create({
    data: {
      name: '配电柜巡检模板',
      deviceId: devices[4].id,
      checkItems: {
        create: [
          { name: '电压显示', description: '检查电压是否在正常范围', sortOrder: 1 },
          { name: '电流显示', description: '检查电流是否异常', sortOrder: 2 },
          { name: '温升检查', description: '检查接线端子是否过热', sortOrder: 3 },
          { name: '绝缘测试', description: '检查绝缘情况', sortOrder: 4 }
        ]
      }
    }
  }));

  inspectionTemplates.push(await prisma.inspectionTemplate.create({
    data: {
      name: '供暖锅炉巡检模板',
      deviceId: devices[5].id,
      checkItems: {
        create: [
          { name: '锅炉压力', description: '检查锅炉压力是否正常', sortOrder: 1 },
          { name: '水温显示', description: '检查水温是否正常', sortOrder: 2 },
          { name: '安全阀状态', description: '检查安全阀是否正常', sortOrder: 3 },
          { name: '排烟温度', description: '检查排烟温度是否正常', sortOrder: 4 }
        ]
      }
    }
  }));

  console.log('创建了 8 个巡检模板及对应的检查项');

  const patrolTasks = [];
  
  const allCheckItems = await prisma.checkItem.findMany();
  
  patrolTasks.push(await prisma.patrolTask.create({
    data: {
      name: '1号楼客梯日常巡检 - 2026-04-28',
      deviceId: devices[0].id,
      status: 'completed',
      scheduledAt: subDays(new Date(), 3),
      completedAt: subDays(new Date(), 3),
      items: {
        create: [
          {
            checkItemId: allCheckItems[0].id,
            result: '正常',
            isAbnormal: false,
            notes: '运行平稳',
            photoUrls: JSON.stringify([])
          },
          {
            checkItemId: allCheckItems[1].id,
            result: '正常',
            isAbnormal: false,
            photoUrls: JSON.stringify([])
          },
          {
            checkItemId: allCheckItems[2].id,
            result: '正常',
            isAbnormal: false,
            photoUrls: JSON.stringify([])
          },
          {
            checkItemId: allCheckItems[3].id,
            result: '正常',
            isAbnormal: false,
            photoUrls: JSON.stringify([])
          }
        ]
      }
    }
  }));

  patrolTasks.push(await prisma.patrolTask.create({
    data: {
      name: '2号楼货梯日常巡检 - 2026-04-29',
      deviceId: devices[3].id,
      status: 'completed',
      scheduledAt: subDays(new Date(), 2),
      completedAt: subDays(new Date(), 2),
      items: {
        create: [
          {
            checkItemId: allCheckItems[4].id,
            result: '异常',
            isAbnormal: true,
            notes: '电梯运行时有异响',
            photoUrls: JSON.stringify([])
          },
          {
            checkItemId: allCheckItems[5].id,
            result: '正常',
            isAbnormal: false,
            photoUrls: JSON.stringify([])
          },
          {
            checkItemId: allCheckItems[6].id,
            result: '正常',
            isAbnormal: false,
            photoUrls: JSON.stringify([])
          },
          {
            checkItemId: allCheckItems[7].id,
            result: '正常',
            isAbnormal: false,
            photoUrls: JSON.stringify([])
          }
        ]
      }
    }
  }));

  patrolTasks.push(await prisma.patrolTask.create({
    data: {
      name: '3号楼客梯日常巡检 - 2026-04-30',
      deviceId: devices[6].id,
      status: 'in_progress',
      scheduledAt: subDays(new Date(), 1),
      items: {
        create: [
          {
            checkItemId: allCheckItems[8].id,
            result: '正常',
            isAbnormal: false,
            photoUrls: JSON.stringify([])
          },
          {
            checkItemId: allCheckItems[9].id,
            result: '待检查',
            isAbnormal: false,
            photoUrls: JSON.stringify([])
          }
        ]
      }
    }
  }));

  patrolTasks.push(await prisma.patrolTask.create({
    data: {
      name: '1号楼中央空调巡检 - 2026-05-01',
      deviceId: devices[1].id,
      status: 'pending',
      scheduledAt: new Date()
    }
  }));

  console.log('创建了 4 个巡检任务');

  const repairOrders = [];

  repairOrders.push(await prisma.repairOrder.create({
    data: {
      title: '1号楼客梯例行检查后维护',
      description: '巡检后常规维护保养',
      status: 'closed',
      patrolTaskId: patrolTasks[0].id,
      deviceId: devices[0].id,
      workerId: workers[0].id,
      skillRequired: '电梯',
      estimatedMinutes: 60,
      dueDate: subDays(new Date(), 1),
      completedAt: subDays(new Date(), 1),
      processingNotes: '已完成常规保养，润滑油添加，安全检查完成',
      reviewedBy: '班组长',
      reviewNotes: '工作完成质量良好'
    }
  }));

  repairOrders.push(await prisma.repairOrder.create({
    data: {
      title: '2号楼货梯运行异响故障维修',
      description: '巡检时发现货梯运行时有异响，需排查原因并修复',
      status: 'pending_review',
      patrolTaskId: patrolTasks[1].id,
      deviceId: devices[3].id,
      workerId: workers[2].id,
      skillRequired: '电梯',
      estimatedMinutes: 120,
      dueDate: addDays(new Date(), 1),
      processingNotes: '已检查导轨，发现导轨润滑不足，已添加润滑油。异响有所减轻但仍需进一步观察运行情况'
    }
  }));

  repairOrders.push(await prisma.repairOrder.create({
    data: {
      title: '2号楼配电柜指示灯故障',
      description: '配电室指示灯闪烁，需要检查更换',
      status: 'in_progress',
      deviceId: devices[4].id,
      workerId: workers[0].id,
      skillRequired: '电气',
      estimatedMinutes: 90,
      dueDate: addDays(new Date(), 2),
      processingNotes: '已检查，发现指示灯接触不良，已重新接线。待观察确认是否完全修复'
    }
  }));

  repairOrders.push(await prisma.repairOrder.create({
    data: {
      title: '1号楼消防水泵压力异常',
      description: '消防水泵压力表显示压力偏低，需要检查',
      status: 'pending_assignment',
      deviceId: devices[2].id,
      skillRequired: '消防',
      estimatedMinutes: 60,
      dueDate: addDays(new Date(), 3)
    }
  }));

  repairOrders.push(await prisma.repairOrder.create({
    data: {
      title: '2号楼供暖锅炉水温异常',
      description: '锅炉水温显示波动较大',
      status: 'in_progress',
      deviceId: devices[5].id,
      workerId: workers[1].id,
      skillRequired: '水暖',
      estimatedMinutes: 90,
      dueDate: addDays(new Date(), 1),
      processingNotes: '已检查传感器，但问题未完全解决，复核打回要求重新检查',
      reviewedBy: '班组长',
      reviewNotes: '首次处理不彻底，打回重新检查'
    }
  }));

  console.log('创建了 5 个维修单');

  console.log('\n=== 种子数据创建完成 ===');
  console.log('创建的统计：');
  console.log(`- 楼栋: ${buildings.length} 栋`);
  console.log(`- 维修师傅: ${workers.length} 位`);
  console.log(`- 设备: ${devices.length} 台`);
  console.log(`- 巡检任务: ${patrolTasks.length} 个`);
  console.log(`- 维修单: ${repairOrders.length} 个`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
