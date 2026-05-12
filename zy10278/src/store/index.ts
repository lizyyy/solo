import { create } from 'zustand';
import dayjs from 'dayjs';
import {
  Member,
  Medicine,
  PurchaseRecord,
  IndicatorRecord,
  FollowupTask,
  AbnormalAlert,
  DashboardStats,
} from '../types';

const mockMembers: Member[] = [
  {
    id: '1',
    name: '张桂英',
    phone: '13800138001',
    idCard: '310101195501011234',
    gender: 'female',
    age: 69,
    chronicDiseases: ['高血压', '糖尿病'],
    address: '北京市朝阳区建国路88号',
    registerDate: '2024-01-15',
    lastVisitDate: '2026-05-10',
    riskLevel: 'high',
    status: 'active',
  },
  {
    id: '2',
    name: '李建国',
    phone: '13800138002',
    idCard: '310101195802022345',
    gender: 'male',
    age: 66,
    chronicDiseases: ['高血压', '冠心病'],
    address: '北京市海淀区中关村大街1号',
    registerDate: '2024-02-20',
    lastVisitDate: '2026-05-08',
    riskLevel: 'medium',
    status: 'active',
  },
  {
    id: '3',
    name: '王秀兰',
    phone: '13800138003',
    idCard: '310101196003033456',
    gender: 'female',
    age: 64,
    chronicDiseases: ['糖尿病'],
    address: '北京市西城区金融街10号',
    registerDate: '2024-03-10',
    lastVisitDate: '2026-05-05',
    riskLevel: 'medium',
    status: 'active',
  },
  {
    id: '4',
    name: '刘志强',
    phone: '13800138004',
    idCard: '310101195204044567',
    gender: 'male',
    age: 72,
    chronicDiseases: ['高血压', '高血脂', '糖尿病'],
    address: '北京市东城区王府井大街20号',
    registerDate: '2024-01-05',
    lastVisitDate: '2026-05-01',
    riskLevel: 'high',
    status: 'active',
  },
  {
    id: '5',
    name: '陈美玲',
    phone: '13800138005',
    idCard: '310101196505055678',
    gender: 'female',
    age: 59,
    chronicDiseases: ['高血脂'],
    address: '北京市丰台区南三环西路5号',
    registerDate: '2024-04-15',
    lastVisitDate: '2026-04-28',
    riskLevel: 'low',
    status: 'active',
  },
];

const mockMedicines: Medicine[] = [
  {
    id: '1',
    name: '拜新同',
    genericName: '硝苯地平控释片',
    category: '降压药',
    specification: '30mg*7片',
    manufacturer: '拜耳医药保健有限公司',
    price: 38.5,
    stock: 156,
    contraindications: ['对硝苯地平过敏者禁用', '心源性休克禁用', '怀孕20周内禁用'],
    sideEffects: ['头痛', '面部潮红', '下肢水肿'],
    usage: '每日一次，每次一片',
    status: 'available',
  },
  {
    id: '2',
    name: '格华止',
    genericName: '盐酸二甲双胍片',
    category: '降糖药',
    specification: '0.5g*20片',
    manufacturer: '中美上海施贵宝制药有限公司',
    price: 29.8,
    stock: 234,
    contraindications: ['严重肾功能不全禁用', '乳酸酸中毒病史禁用', '急性代谢性酸中毒禁用'],
    sideEffects: ['腹泻', '恶心', '胃部不适'],
    usage: '每日三次，每次一片，随餐服用',
    status: 'available',
  },
  {
    id: '3',
    name: '立普妥',
    genericName: '阿托伐他汀钙片',
    category: '降脂药',
    specification: '20mg*7片',
    manufacturer: '辉瑞制药有限公司',
    price: 55.2,
    stock: 89,
    contraindications: ['活动性肝病禁用', '转氨酶持续升高禁用', '妊娠哺乳期禁用'],
    sideEffects: ['肌肉疼痛', '肝功能异常', '恶心'],
    usage: '每日一次，每次一片，睡前服用',
    status: 'available',
  },
  {
    id: '4',
    name: '波立维',
    genericName: '硫酸氢氯吡格雷片',
    category: '抗血小板药',
    specification: '75mg*7片',
    manufacturer: '赛诺菲制药有限公司',
    price: 98.0,
    stock: 67,
    contraindications: ['严重肝脏损伤禁用', '活动性病理性出血禁用', '哺乳期禁用'],
    sideEffects: ['出血', '胃肠道不适', '皮疹'],
    usage: '每日一次，每次一片',
    status: 'available',
  },
  {
    id: '5',
    name: '倍他乐克',
    genericName: '琥珀酸美托洛尔缓释片',
    category: 'β受体阻滞剂',
    specification: '47.5mg*7片',
    manufacturer: '阿斯利康制药有限公司',
    price: 42.3,
    stock: 123,
    contraindications: ['心源性休克禁用', '病态窦房结综合征禁用', 'II/III度房室传导阻滞禁用'],
    sideEffects: ['疲劳', '头晕', '心动过缓'],
    usage: '每日一次，每次一片',
    status: 'available',
  },
];

const mockPurchaseRecords: PurchaseRecord[] = [
  {
    id: '1',
    memberId: '1',
    memberName: '张桂英',
    medicines: [
      { medicineId: '1', medicineName: '拜新同', quantity: 2, price: 38.5 },
      { medicineId: '2', medicineName: '格华止', quantity: 3, price: 29.8 },
    ],
    purchaseDate: '2026-05-10',
    totalAmount: 166.4,
    pharmacist: '王药师',
  },
  {
    id: '2',
    memberId: '2',
    memberName: '李建国',
    medicines: [
      { medicineId: '1', medicineName: '拜新同', quantity: 2, price: 38.5 },
      { medicineId: '4', medicineName: '波立维', quantity: 2, price: 98.0 },
    ],
    purchaseDate: '2026-05-08',
    totalAmount: 273.0,
    pharmacist: '李药师',
  },
  {
    id: '3',
    memberId: '3',
    memberName: '王秀兰',
    medicines: [
      { medicineId: '2', medicineName: '格华止', quantity: 4, price: 29.8 },
    ],
    purchaseDate: '2026-05-05',
    totalAmount: 119.2,
    pharmacist: '王药师',
  },
  {
    id: '4',
    memberId: '4',
    memberName: '刘志强',
    medicines: [
      { medicineId: '1', medicineName: '拜新同', quantity: 2, price: 38.5 },
      { medicineId: '2', medicineName: '格华止', quantity: 3, price: 29.8 },
      { medicineId: '3', medicineName: '立普妥', quantity: 2, price: 55.2 },
    ],
    purchaseDate: '2026-05-01',
    totalAmount: 276.8,
    pharmacist: '张药师',
  },
];

const mockIndicatorRecords: IndicatorRecord[] = [
  {
    id: '1',
    memberId: '1',
    memberName: '张桂英',
    type: 'blood_pressure',
    typeName: '血压',
    value: '165/95',
    unit: 'mmHg',
    isAbnormal: true,
    measureDate: '2026-05-10',
    measureTime: '08:30',
    followupTaskId: '1',
  },
  {
    id: '2',
    memberId: '1',
    memberName: '张桂英',
    type: 'blood_sugar',
    typeName: '血糖',
    value: '8.5',
    unit: 'mmol/L',
    isAbnormal: true,
    measureDate: '2026-05-10',
    measureTime: '08:35',
    followupTaskId: '1',
  },
  {
    id: '3',
    memberId: '2',
    memberName: '李建国',
    type: 'blood_pressure',
    typeName: '血压',
    value: '145/88',
    unit: 'mmHg',
    isAbnormal: true,
    measureDate: '2026-05-08',
    measureTime: '09:00',
    followupTaskId: '2',
  },
  {
    id: '4',
    memberId: '3',
    memberName: '王秀兰',
    type: 'blood_sugar',
    typeName: '血糖',
    value: '7.2',
    unit: 'mmol/L',
    isAbnormal: false,
    measureDate: '2026-05-05',
    measureTime: '08:45',
    followupTaskId: '3',
  },
];

const mockFollowupTasks: FollowupTask[] = [
  {
    id: '1',
    memberId: '1',
    memberName: '张桂英',
    memberPhone: '13800138001',
    type: 'medicine',
    typeName: '用药回访',
    priority: 'high',
    status: 'pending',
    scheduledDate: '2026-05-12',
    scheduledTime: '10:00',
    assignedTo: '王药师',
    relatedPurchaseId: '1',
    relatedMedicines: ['拜新同', '格华止'],
    refillIntention: 'pending',
    completionStatus: 'none',
    hasAbnormalIndicator: true,
    hasContraindicationReminder: false,
    indicatorFollowed: false,
    content: '询问用药情况，测量血压血糖',
    createdAt: '2026-05-10T14:00:00',
    updatedAt: '2026-05-10T14:00:00',
  },
  {
    id: '2',
    memberId: '2',
    memberName: '李建国',
    memberPhone: '13800138002',
    type: 'indicator',
    typeName: '指标回访',
    priority: 'medium',
    status: 'pending',
    scheduledDate: '2026-05-12',
    scheduledTime: '14:00',
    assignedTo: '李药师',
    relatedPurchaseId: '2',
    relatedMedicines: ['拜新同', '波立维'],
    refillIntention: 'pending',
    completionStatus: 'none',
    hasAbnormalIndicator: true,
    hasContraindicationReminder: true,
    indicatorFollowed: false,
    content: '回访血压控制情况，确认无出血症状',
    createdAt: '2026-05-08T15:00:00',
    updatedAt: '2026-05-08T15:00:00',
  },
  {
    id: '3',
    memberId: '3',
    memberName: '王秀兰',
    memberPhone: '13800138003',
    type: 'refill',
    typeName: '续方回访',
    priority: 'medium',
    status: 'in_progress',
    scheduledDate: '2026-05-12',
    scheduledTime: '09:30',
    assignedTo: '王药师',
    relatedPurchaseId: '3',
    relatedMedicines: ['格华止'],
    refillIntention: 'yes',
    completionStatus: 'partial',
    hasAbnormalIndicator: false,
    hasContraindicationReminder: true,
    indicatorFollowed: true,
    content: '确认是否需要续方，测量血糖',
    createdAt: '2026-05-05T16:00:00',
    updatedAt: '2026-05-11T10:00:00',
  },
  {
    id: '4',
    memberId: '4',
    memberName: '刘志强',
    memberPhone: '13800138004',
    type: 'chronic',
    typeName: '慢病回访',
    priority: 'high',
    status: 'pending',
    scheduledDate: '2026-05-13',
    assignedTo: '张药师',
    relatedPurchaseId: '4',
    relatedMedicines: ['拜新同', '格华止', '立普妥'],
    refillIntention: 'pending',
    completionStatus: 'none',
    hasAbnormalIndicator: false,
    hasContraindicationReminder: false,
    indicatorFollowed: false,
    content: '综合回访三高控制情况',
    createdAt: '2026-05-01T14:30:00',
    updatedAt: '2026-05-01T14:30:00',
  },
  {
    id: '5',
    memberId: '5',
    memberName: '陈美玲',
    memberPhone: '13800138005',
    type: 'medicine',
    typeName: '用药回访',
    priority: 'low',
    status: 'completed',
    scheduledDate: '2026-05-10',
    actualDate: '2026-05-10',
    assignedTo: '李药师',
    relatedMedicines: ['立普妥'],
    refillIntention: 'yes',
    completionStatus: 'full',
    hasAbnormalIndicator: false,
    hasContraindicationReminder: true,
    indicatorFollowed: true,
    content: '询问降脂药服用情况',
    result: '患者按时服药，血脂控制良好，需要续方',
    nextFollowupDate: '2026-05-24',
    createdAt: '2026-04-28T10:00:00',
    updatedAt: '2026-05-10T11:00:00',
  },
];

const mockAbnormalAlerts: AbnormalAlert[] = [
  {
    id: '1',
    memberId: '1',
    memberName: '张桂英',
    type: 'indicator',
    typeName: '指标异常',
    level: 'danger',
    message: '血压165/95mmHg，血糖8.5mmol/L，均超出正常范围',
    relatedTaskId: '1',
    relatedIndicatorId: '1',
    isHandled: false,
    createdAt: '2026-05-10T08:35:00',
  },
  {
    id: '2',
    memberId: '2',
    memberName: '李建国',
    type: 'indicator',
    typeName: '指标异常',
    level: 'warning',
    message: '血压145/88mmHg，略高于正常范围',
    relatedTaskId: '2',
    relatedIndicatorId: '3',
    isHandled: false,
    createdAt: '2026-05-08T09:05:00',
  },
  {
    id: '3',
    memberId: '1',
    memberName: '张桂英',
    type: 'task',
    typeName: '任务提醒',
    level: 'warning',
    message: '今日上午10:00有高优先级回访任务待处理',
    relatedTaskId: '1',
    isHandled: false,
    createdAt: '2026-05-12T08:00:00',
  },
];

interface StoreState {
  members: Member[];
  medicines: Medicine[];
  purchaseRecords: PurchaseRecord[];
  indicatorRecords: IndicatorRecord[];
  followupTasks: FollowupTask[];
  abnormalAlerts: AbnormalAlert[];
  currentUser: { id: string; name: string; role: string };
  addMember: (member: Omit<Member, 'id'>) => void;
  updateMember: (id: string, member: Partial<Member>) => void;
  addMedicine: (medicine: Omit<Medicine, 'id'>) => void;
  updateMedicine: (id: string, medicine: Partial<Medicine>) => void;
  addPurchaseRecord: (record: Omit<PurchaseRecord, 'id'>) => void;
  addIndicatorRecord: (record: Omit<IndicatorRecord, 'id'>) => void;
  addFollowupTask: (task: Omit<FollowupTask, 'id' | 'createdAt' | 'updatedAt'>) => { success: boolean; message: string };
  updateFollowupTask: (id: string, task: Partial<FollowupTask>) => { success: boolean; message: string };
  handleAbnormalAlert: (id: string) => void;
  checkDuplicateTask: (memberId: string, scheduledDate: string, type: string) => boolean;
  getDashboardStats: () => DashboardStats;
  getTodayPendingTasks: () => FollowupTask[];
  getHighRiskMembers: () => Member[];
  getUnhandledAlerts: () => AbnormalAlert[];
}

export const useStore = create<StoreState>((set, get) => ({
  members: mockMembers,
  medicines: mockMedicines,
  purchaseRecords: mockPurchaseRecords,
  indicatorRecords: mockIndicatorRecords,
  followupTasks: mockFollowupTasks,
  abnormalAlerts: mockAbnormalAlerts,
  currentUser: { id: '1', name: '王药师', role: 'pharmacist' },

  addMember: (member) =>
    set((state) => ({
      members: [...state.members, { ...member, id: Date.now().toString() }],
    })),

  updateMember: (id, member) =>
    set((state) => ({
      members: state.members.map((m) => (m.id === id ? { ...m, ...member } : m)),
    })),

  addMedicine: (medicine) =>
    set((state) => ({
      medicines: [...state.medicines, { ...medicine, id: Date.now().toString() }],
    })),

  updateMedicine: (id, medicine) =>
    set((state) => ({
      medicines: state.medicines.map((m) => (m.id === id ? { ...m, ...medicine } : m)),
    })),

  addPurchaseRecord: (record) =>
    set((state) => ({
      purchaseRecords: [...state.purchaseRecords, { ...record, id: Date.now().toString() }],
    })),

  addIndicatorRecord: (record) =>
    set((state) => ({
      indicatorRecords: [...state.indicatorRecords, { ...record, id: Date.now().toString() }],
    })),

  checkDuplicateTask: (memberId, scheduledDate, type) => {
    const { followupTasks } = get();
    return followupTasks.some(
      (task) =>
        task.memberId === memberId &&
        task.scheduledDate === scheduledDate &&
        task.type === type &&
        task.status !== 'cancelled' &&
        task.status !== 'closed'
    );
  },

  addFollowupTask: (task) => {
    const state = get();
    if (state.checkDuplicateTask(task.memberId, task.scheduledDate, task.type)) {
      return { success: false, message: '该会员在同一日期已有相同类型的回访任务，请勿重复创建' };
    }
    const newTask: FollowupTask = {
      ...task,
      id: Date.now().toString(),
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    };
    set((state) => ({
      followupTasks: [...state.followupTasks, newTask],
    }));
    return { success: true, message: '回访任务创建成功' };
  },

  updateFollowupTask: (id, task) => {
    const state = get();
    const existingTask = state.followupTasks.find((t) => t.id === id);
    if (!existingTask) {
      return { success: false, message: '任务不存在' };
    }
    if (existingTask.status === 'closed' && task.status && task.status !== 'closed') {
      return { success: false, message: '已关闭的任务无法重新编辑或打开' };
    }
    if (
      task.memberId &&
      task.scheduledDate &&
      task.type &&
      (task.memberId !== existingTask.memberId ||
        task.scheduledDate !== existingTask.scheduledDate ||
        task.type !== existingTask.type)
    ) {
      if (state.checkDuplicateTask(task.memberId, task.scheduledDate, task.type)) {
        return { success: false, message: '该会员在同一日期已有相同类型的回访任务' };
      }
    }
    set((state) => ({
      followupTasks: state.followupTasks.map((t) =>
        t.id === id ? { ...t, ...task, updatedAt: dayjs().toISOString() } : t
      ),
    }));
    return { success: true, message: '回访任务更新成功' };
  },

  handleAbnormalAlert: (id) =>
    set((state) => ({
      abnormalAlerts: state.abnormalAlerts.map((a) =>
        a.id === id
          ? { ...a, isHandled: true, handledBy: state.currentUser.name, handledAt: dayjs().toISOString() }
          : a
      ),
    })),

  getDashboardStats: () => {
    const state = get();
    const today = dayjs().format('YYYY-MM-DD');
    const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
    const weekEnd = dayjs().endOf('week').format('YYYY-MM-DD');

    const todayTasks = state.followupTasks.filter((t) => t.scheduledDate === today);
    const weekTasks = state.followupTasks.filter(
      (t) => t.scheduledDate >= weekStart && t.scheduledDate <= weekEnd
    );

    return {
      todayPendingTasks: todayTasks.filter((t) => t.status === 'pending').length,
      todayCompletedTasks: todayTasks.filter((t) => t.status === 'completed').length,
      highRiskMembers: state.members.filter((m) => m.riskLevel === 'high').length,
      mediumRiskMembers: state.members.filter((m) => m.riskLevel === 'medium').length,
      abnormalIndicatorsPending: state.abnormalAlerts.filter(
        (a) => a.type === 'indicator' && !a.isHandled
      ).length,
      pendingRefillIntentions: state.followupTasks.filter(
        (t) => t.refillIntention === 'pending' && t.status !== 'completed'
      ).length,
      tasksThisWeek: weekTasks.length,
      completedThisWeek: weekTasks.filter((t) => t.status === 'completed').length,
    };
  },

  getTodayPendingTasks: () => {
    const state = get();
    const today = dayjs().format('YYYY-MM-DD');
    return state.followupTasks
      .filter((t) => t.scheduledDate === today && t.status === 'pending')
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  },

  getHighRiskMembers: () => {
    const state = get();
    return state.members.filter((m) => m.riskLevel === 'high');
  },

  getUnhandledAlerts: () => {
    const state = get();
    return state.abnormalAlerts.filter((a) => !a.isHandled);
  },
}));
