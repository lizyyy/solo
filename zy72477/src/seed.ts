import { shelterDao } from './dao/shelterDao';
import { capacityCheckService } from './services/capacityCheckService';
import { selfCheckService } from './services/selfCheckService';
import { conflictDetectionService } from './services/conflictDetectionService';
import { workflowService } from './services/workflowService';
import { redLineDao } from './dao/redLineDao';
import { changeHistoryDao } from './dao/changeHistoryDao';
import { resetStore } from './database/memoryStore';

export const initDemoData = () => {
  console.log('开始初始化演示数据...');

  resetStore();

  capacityCheckService.initDefaultParams('system_init');

  const shelters = [
    {
      name: '第一中学避难点',
      address: '解放路100号',
      designedCapacity: 500,
      actualCapacity: 500,
      latitude: 31.2304,
      longitude: 121.4737,
      status: 'normal' as const,
      area: '黄浦区',
      manager: '张主任',
      phone: '13800138001'
    },
    {
      name: '体育中心避难点',
      address: '人民大道200号',
      designedCapacity: 2000,
      actualCapacity: 2000,
      latitude: 31.2350,
      longitude: 121.4800,
      status: 'normal' as const,
      area: '黄浦区',
      manager: '李主任',
      phone: '13800138002'
    },
    {
      name: '社区活动中心避难点',
      address: '建国路88号',
      designedCapacity: 300,
      actualCapacity: 300,
      latitude: 31.2200,
      longitude: 121.4600,
      status: 'normal' as const,
      area: '徐汇区',
      manager: '王主任',
      phone: '13800138003'
    },
    {
      name: '实验小学避难点',
      address: '南京东路500号',
      designedCapacity: 800,
      actualCapacity: 800,
      latitude: 31.2400,
      longitude: 121.4850,
      status: 'normal' as const,
      area: '黄浦区',
      manager: '赵主任',
      phone: '13800138004'
    },
    {
      name: '市民广场避难点',
      address: '世纪大道1000号',
      designedCapacity: 3000,
      actualCapacity: 3000,
      latitude: 31.2280,
      longitude: 121.5000,
      status: 'normal' as const,
      area: '浦东新区',
      manager: '钱主任',
      phone: '13800138005'
    }
  ];

  const createdShelters = shelters.map(s => shelterDao.create(s));
  console.log(`  已创建 ${createdShelters.length} 个避难点`);

  for (const shelter of createdShelters) {
    workflowService.startWorkflow(shelter.id, '系统初始化');
  }
  console.log('  已启动所有避难点的工作流');

  const step1Shelter = createdShelters[0];
  const wf1 = workflowService.getWorkflowForShelter(step1Shelter.id);
  if (wf1) {
    const result1 = workflowService.step1_importRedLine(
      wf1.id,
      step1Shelter.id,
      'v1.0',
      '该避难点为学校操场，可用面积约1200平方米，容量：600人。注意东侧入口道路拓宽施工',
      '东至解放路、西至校内路、南至教学楼、北至围墙',
      '2026-01-01',
      '规划科-小王'
    );
    if (result1.redLine) {
      workflowService.reviewRedLine(result1.redLine.id, 'reviewed', '已审核，容量数据合理', '老马');
    }
    console.log(`  已为 ${step1Shelter.name} 导入红线图并完成复核`);
  }

  const step2Shelter = createdShelters[1];
  const wf2 = workflowService.getWorkflowForShelter(step2Shelter.id);
  if (wf2) {
    workflowService.step1_importRedLine(
      wf2.id,
      step2Shelter.id,
      'v1.0',
      '体育中心主馆，设计容量2000人，无施工改道',
      '体育中心全域',
      '2026-01-01',
      '规划科-小王'
    );

    const wf2Next = workflowService.getWorkflowForShelter(step2Shelter.id);
    if (wf2Next && wf2Next.currentStep === 'inspector_review') {
      workflowService.step2_reviewInspectorReport(
        wf2Next.id,
        step2Shelter.id,
        '网格员小陈',
        '2026-06-06',
        1850,
        '主馆部分区域用于物资堆放，实际可用面积略有减少',
        false,
        '',
        'normal',
        '老马'
      );
      console.log(`  已为 ${step2Shelter.name} 完成巡查表审核`);
    }

    const wf2Step3 = workflowService.getWorkflowForShelter(step2Shelter.id);
    if (wf2Step3 && wf2Step3.currentStep === 'point_update') {
      workflowService.step3_updatePointList(wf2Step3.id, step2Shelter.id, '系统');
      console.log(`  已为 ${step2Shelter.name} 完成点位清单更新`);
    }
  }

  const detourShelter = createdShelters[2];
  const wf3 = workflowService.getWorkflowForShelter(detourShelter.id);
  if (wf3) {
    workflowService.step1_importRedLine(
      wf3.id,
      detourShelter.id,
      'v1.0',
      '社区活动中心，设计容量300人',
      '活动中心建筑及前广场',
      '2026-01-01',
      '规划科-小王'
    );

    const wf3Next = workflowService.getWorkflowForShelter(detourShelter.id);
    if (wf3Next && wf3Next.currentStep === 'inspector_review') {
      workflowService.step2_reviewInspectorReport(
        wf3Next.id,
        detourShelter.id,
        '网格员小周',
        '2026-06-07',
        320,
        '门口建国路临时施工改道，需从西侧绕行',
        true,
        '建国路半幅施工，行人需从建国西路绕行约200米',
        'detour',
        '老马'
      );
      console.log(`  已为 ${detourShelter.name} 录入含临时改道的巡查表，工作流已挂起待居民代表复核`);
    }
  }

  capacityCheckService.calculateAll('system_init');
  console.log('  已完成所有避难点容量校核计算');

  conflictDetectionService.detectAllConflicts();
  console.log('  已完成冲突检测');

  selfCheckService.runAllChecks();
  console.log('  已完成系统自检');

  const redLineCount = redLineDao.findAll().length;
  const historyCount = changeHistoryDao.findAll().length;
  console.log(`  红线图记录: ${redLineCount} 条`);
  console.log(`  变更历史: ${historyCount} 条`);

  console.log('✅ 演示数据初始化完成！');
};

if (require.main === module) {
  initDemoData();
}
