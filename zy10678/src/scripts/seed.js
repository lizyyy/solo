const referenceRepository = require('../repositories/ReferenceRepository');
const noFlyRepository = require('../repositories/NoFlyRepository');
const { STATUS_PENDING, STATUS_APPROVED, STATUS_RESTORED } = require('../models/NoFlyRecord');

const routes = [
  {
    name: 'A区巡检航线',
    code: 'ROUTE-A-001',
    start_point: '116.397428,39.90923',
    end_point: '116.407428,39.91923',
    waypoints: [
      { lat: 39.90923, lng: 116.397428 },
      { lat: 39.91423, lng: 116.402428 }
    ],
    distance: 5.2,
    altitude: 100
  },
  {
    name: 'B区巡检航线',
    code: 'ROUTE-B-001',
    start_point: '116.417428,39.92923',
    end_point: '116.427428,39.93923',
    waypoints: [
      { lat: 39.92923, lng: 116.417428 }
    ],
    distance: 3.8,
    altitude: 80
  },
  {
    name: 'C区巡检航线',
    code: 'ROUTE-C-001',
    start_point: '116.437428,39.94923',
    end_point: '116.447428,39.95923',
    distance: 6.5,
    altitude: 120
  }
];

const drones = [
  {
    name: '大疆M300-01',
    code: 'DRONE-M300-001',
    model: 'DJI Matrice 300 RTK',
    serial_number: 'SN-2024-M300-001',
    max_flight_time: 55,
    max_altitude: 500
  },
  {
    name: '大疆M300-02',
    code: 'DRONE-M300-002',
    model: 'DJI Matrice 300 RTK',
    serial_number: 'SN-2024-M300-002',
    max_flight_time: 55,
    max_altitude: 500
  },
  {
    name: '大疆Mavic-01',
    code: 'DRONE-MAVIC-001',
    model: 'DJI Mavic 3 Enterprise',
    serial_number: 'SN-2024-MAVIC-001',
    max_flight_time: 45,
    max_altitude: 600
  }
];

const applicants = [
  {
    name: '张三',
    department: '运维部',
    phone: '13800138001',
    email: 'zhangsan@example.com'
  },
  {
    name: '李四',
    department: '安全部',
    phone: '13800138002',
    email: 'lisi@example.com'
  },
  {
    name: '王五',
    department: '飞行调度中心',
    phone: '13800138003',
    email: 'wangwu@example.com'
  }
];

async function seed() {
  console.log('🚀 开始初始化种子数据...\n');

  try {
    console.log('📋 创建航线数据...');
    const createdRoutes = [];
    for (const route of routes) {
      const result = await referenceRepository.createRoute(route);
      createdRoutes.push(result);
      console.log(`  ✅ 航线: ${route.name} (${route.code})`);
    }

    console.log('\n🛸 创建无人机数据...');
    const createdDrones = [];
    for (const drone of drones) {
      const result = await referenceRepository.createDrone(drone);
      createdDrones.push(result);
      console.log(`  ✅ 无人机: ${drone.name} (${drone.code})`);
    }

    console.log('\n👤 创建申请人数据...');
    const createdApplicants = [];
    for (const applicant of applicants) {
      const result = await referenceRepository.createApplicant(applicant);
      createdApplicants.push(result);
      console.log(`  ✅ 申请人: ${applicant.name} (${applicant.department})`);
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const noFlyRecords = [
      {
        route_id: createdRoutes[0].id,
        drone_id: createdDrones[0].id,
        start_time: new Date().toISOString(),
        end_time: tomorrow.toISOString(),
        applicant_id: createdApplicants[0].id,
        reason: '临时航空管制，A区进行重要活动',
        cancel_older_tasks: 1
      },
      {
        route_id: createdRoutes[1].id,
        drone_id: null,
        start_time: tomorrow.toISOString(),
        end_time: nextWeek.toISOString(),
        applicant_id: createdApplicants[1].id,
        reason: 'B区进行电力设施检修，高空作业',
        cancel_older_tasks: 1
      },
      {
        route_id: createdRoutes[2].id,
        drone_id: createdDrones[2].id,
        start_time: new Date(Date.now() + 86400000 * 3).toISOString(),
        end_time: new Date(Date.now() + 86400000 * 10).toISOString(),
        applicant_id: createdApplicants[2].id,
        reason: 'C区进行大型基建工程，持续禁飞',
        cancel_older_tasks: 0
      }
    ];

    console.log('\n🚫 创建禁飞记录...');
    for (let i = 0; i < noFlyRecords.length; i++) {
      const result = await noFlyRepository.createRecord(noFlyRecords[i]);
      const statuses = [STATUS_PENDING, STATUS_APPROVED, STATUS_RESTORED];
      await noFlyRepository.updateRecordStatus(result.id, statuses[i % 3]);
      if (i > 0) {
        await noFlyRepository.addHistory(
          result.id,
          STATUS_PENDING,
          statuses[i % 3],
          createdApplicants[0].name,
          i === 1 ? '审批通过，禁飞生效' : '禁飞期结束，恢复通航'
        );
      }
      console.log(`  ✅ 禁飞记录: 航线${createdRoutes[i].code} - 状态: ${statuses[i % 3]}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 种子数据初始化完成！');
    console.log('='.repeat(60));
    console.log(`
  统计信息:
  - 航线: ${createdRoutes.length} 条
  - 无人机: ${createdDrones.length} 台
  - 申请人: ${createdApplicants.length} 人
  - 禁飞记录: ${noFlyRecords.length} 条
  
  参考数据ID:
  - ROUTE-A-001: ${createdRoutes[0].id}
  - ROUTE-B-001: ${createdRoutes[1].id}
  - ROUTE-C-001: ${createdRoutes[2].id}
  
  - 张三: ${createdApplicants[0].id}
  - 李四: ${createdApplicants[1].id}
  - 王五: ${createdApplicants[2].id}
    `);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 种子数据初始化失败:', error.message);
    process.exit(1);
  }
}

setTimeout(seed, 1000);