import { v4 as uuidv4 } from 'uuid';
import { store, resetStore } from './store';
import { createTasksFromInspection, scheduleReview, completeReview } from './services/rectificationService';
import { Merchant, Inspection, InspectionProblem } from './types';

const now = new Date();
const daysAgo = (d: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() - d);
  return date.toISOString().split('T')[0];
};

function createSampleData() {
  resetStore();
  
  const merchants: Merchant[] = [
    {
      id: uuidv4(),
      name: '川味轩火锅店',
      address: '美食街123号',
      contactPerson: '张老板',
      contactPhone: '13800138001',
      businessType: '火锅餐饮',
      gasSupplier: '华润燃气',
      accountNo: 'GAS-001-2024',
      createdAt: daysAgo(90),
      updatedAt: daysAgo(90),
      currentStatus: 'normal',
    },
    {
      id: uuidv4(),
      name: '粤式茶餐厅',
      address: '商业街456号',
      contactPerson: '李经理',
      contactPhone: '13800138002',
      businessType: '茶餐厅',
      gasSupplier: '港华燃气',
      accountNo: 'GAS-002-2024',
      createdAt: daysAgo(60),
      updatedAt: daysAgo(60),
      currentStatus: 'normal',
    },
    {
      id: uuidv4(),
      name: '快捷面馆',
      address: '幸福路789号',
      contactPerson: '王师傅',
      contactPhone: '13800138003',
      businessType: '中式快餐',
      gasSupplier: '华润燃气',
      accountNo: 'GAS-003-2024',
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
      currentStatus: 'normal',
    },
    {
      id: uuidv4(),
      name: '香辣小龙虾',
      address: '夜市小吃街88号',
      contactPerson: '陈大姐',
      contactPhone: '13800138004',
      businessType: '夜市小吃',
      gasSupplier: '深燃集团',
      accountNo: 'GAS-004-2024',
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120),
      currentStatus: 'normal',
    },
  ];
  
  store.merchants = merchants;
  
  const inspection1: Inspection = {
    id: uuidv4(),
    merchantId: merchants[0].id,
    inspector: '安检员-王军',
    inspectionDate: daysAgo(5),
    status: 'has_problem',
    remarks: '发现多项安全隐患，限期整改',
    createdAt: daysAgo(5),
    problems: [
      {
        id: uuidv4(),
        inspectionId: '',
        problemType: 'hose',
        description: '软管老化龟裂，多处出现裂纹',
        severity: 'critical',
        rectificationDays: 3,
        createdAt: daysAgo(5),
      },
      {
        id: uuidv4(),
        inspectionId: '',
        problemType: 'alarm',
        description: '可燃气体报警器未通电',
        severity: 'major',
        rectificationDays: 5,
        createdAt: daysAgo(5),
      },
    ],
  };
  inspection1.problems.forEach(p => p.inspectionId = inspection1.id);
  store.inspections.push(inspection1);
  createTasksFromInspection(inspection1);
  
  const inspection2: Inspection = {
    id: uuidv4(),
    merchantId: merchants[1].id,
    inspector: '安检员-李明',
    inspectionDate: daysAgo(10),
    status: 'has_problem',
    remarks: '阀门问题需重点关注',
    createdAt: daysAgo(10),
    problems: [
      {
        id: uuidv4(),
        inspectionId: '',
        problemType: 'valve',
        description: '主阀门锈蚀，无法正常关闭',
        severity: 'minor',
        rectificationDays: 7,
        createdAt: daysAgo(10),
      },
    ],
  };
  inspection2.problems.forEach(p => p.inspectionId = inspection2.id);
  store.inspections.push(inspection2);
  const tasks2 = createTasksFromInspection(inspection2);
  scheduleReview(tasks2[0].id, daysAgo(3), '复查员-刘强');
  completeReview(tasks2[0].id, 'failed', '复查员-刘强');
  
  const inspection3: Inspection = {
    id: uuidv4(),
    merchantId: merchants[2].id,
    inspector: '安检员-王丽',
    inspectionDate: daysAgo(3),
    status: 'completed',
    remarks: '安检合格，无安全隐患',
    createdAt: daysAgo(3),
    problems: [],
  };
  store.inspections.push(inspection3);
  
  const inspection4: Inspection = {
    id: uuidv4(),
    merchantId: merchants[3].id,
    inspector: '安检员-张军',
    inspectionDate: daysAgo(20),
    status: 'has_problem',
    remarks: '问题严重，多次整改不通过',
    createdAt: daysAgo(20),
    problems: [
      {
        id: uuidv4(),
        inspectionId: '',
        problemType: 'hose',
        description: '私接三通，多处漏气风险',
        severity: 'critical',
        rectificationDays: 3,
        createdAt: daysAgo(20),
      },
    ],
  };
  inspection4.problems.forEach(p => p.inspectionId = inspection4.id);
  store.inspections.push(inspection4);
  const tasks4 = createTasksFromInspection(inspection4);
  scheduleReview(tasks4[0].id, daysAgo(15), '复查员-刘强');
  completeReview(tasks4[0].id, 'failed', '复查员-刘强');
  scheduleReview(tasks4[0].id, daysAgo(10), '复查员-刘强');
  completeReview(tasks4[0].id, 'failed', '复查员-刘强');
  
  store.merchants.forEach(m => {
    const tasks = store.rectificationTasks.filter(t => t.merchantId === m.id);
    if (tasks.some(t => t.status === 'gas_cut_off')) {
      m.currentStatus = 'gas_cut_off';
    } else if (tasks.some(t => ['created', 'scheduled_review', 'review_failed'].includes(t.status))) {
      m.currentStatus = 'warning';
    }
  });
  
  console.log('样本数据已创建:');
  console.log(`  商户: ${store.merchants.length} 家`);
  console.log(`  安检记录: ${store.inspections.length} 条`);
  console.log(`  整改任务: ${store.rectificationTasks.length} 条`);
  console.log(`  状态变更: ${store.statusChanges.length} 条`);
}

createSampleData();
