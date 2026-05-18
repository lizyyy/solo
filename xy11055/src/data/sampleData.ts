import { CreateApplicationRequest } from '../types';

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(18, 0, 0, 0);

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

const in30Minutes = new Date();
in30Minutes.setMinutes(in30Minutes.getMinutes() + 30);

const nextWeek = new Date();
nextWeek.setDate(nextWeek.getDate() + 7);

export const validApplication: CreateApplicationRequest = {
  orderId: 'YZC-2024-0520-001',
  motherName: '王芳',
  roomNumber: '806房',
  admissionDate: '2024-05-15',
  deliveryDate: '2024-05-18',
  mealPlanType: 'premium',
  deliveryDateRange: {
    start: '2024-05-20',
    end: '2024-06-19'
  },
  mealPreparationCutoffTime: tomorrow.toISOString(),
  dietaryRestrictions: [
    {
      type: 'allergy',
      name: '海鲜过敏',
      description: '对虾、蟹等海产品过敏，食用后会出现皮疹和呼吸困难',
      severity: 'severe'
    },
    {
      type: 'health',
      name: '高血糖',
      description: '产后血糖偏高，需控制碳水摄入，避免高糖食物',
      severity: 'moderate'
    }
  ],
  replacementItems: [
    {
      originalMealId: 'MEAL-001',
      originalMealName: '清蒸鲈鱼',
      replacementMealId: 'MEAL-001-ALT',
      replacementMealName: '香菇滑鸡',
      reason: '海鲜过敏，鲈鱼属于海产品',
      dietaryRestrictionId: ''
    },
    {
      originalMealId: 'MEAL-002',
      originalMealName: '红糖糯米粥',
      replacementMealId: 'MEAL-002-ALT',
      replacementMealName: '小米山药粥',
      reason: '高血糖，红糖和糯米含糖量过高',
      dietaryRestrictionId: ''
    }
  ],
  createdBy: '李护士',
  notes: '产妇产后第3天，身体恢复良好，但需严格控制饮食'
};

export const lateApplication: CreateApplicationRequest = {
  orderId: 'YZC-2024-0520-002',
  motherName: '赵敏',
  roomNumber: '702房',
  admissionDate: '2024-05-16',
  deliveryDate: '2024-05-19',
  mealPlanType: 'standard',
  deliveryDateRange: {
    start: '2024-05-20',
    end: '2024-06-19'
  },
  mealPreparationCutoffTime: yesterday.toISOString(),
  dietaryRestrictions: [
    {
      type: 'allergy',
      name: '花生过敏',
      description: '对花生产生严重过敏反应',
      severity: 'severe'
    }
  ],
  replacementItems: [
    {
      originalMealId: 'MEAL-003',
      originalMealName: '花生猪脚汤',
      replacementMealId: 'MEAL-003-ALT',
      replacementMealName: '黄豆猪脚汤',
      reason: '花生过敏',
      dietaryRestrictionId: ''
    }
  ],
  createdBy: '张护士',
  notes: '紧急提交，希望能尽快处理'
};

export const urgentApplication: CreateApplicationRequest = {
  orderId: 'YZC-2024-0520-003',
  motherName: '刘婷',
  roomNumber: '605房',
  admissionDate: '2024-05-17',
  deliveryDate: '2024-05-20',
  mealPlanType: 'vegetarian',
  deliveryDateRange: {
    start: '2024-05-20',
    end: '2024-06-19'
  },
  mealPreparationCutoffTime: in30Minutes.toISOString(),
  dietaryRestrictions: [
    {
      type: 'religion',
      name: '佛教素食',
      description: '信仰佛教，严格素食，不食任何肉类、蛋类',
      severity: 'severe'
    }
  ],
  replacementItems: [
    {
      originalMealId: 'MEAL-004',
      originalMealName: '鸡蛋炒时蔬',
      replacementMealId: 'MEAL-004-ALT',
      replacementMealName: '黑木耳炒山药',
      reason: '佛教素食，不能吃鸡蛋',
      dietaryRestrictionId: ''
    }
  ],
  createdBy: '王护士',
  notes: '今天下午刚入住，立即需要调整'
};

export const inconsistentApplication: CreateApplicationRequest = {
  orderId: 'YZC-2024-0520-004',
  motherName: '陈静',
  roomNumber: '901房',
  admissionDate: '2024-05-10',
  deliveryDate: '2024-05-12',
  mealPlanType: 'standard',
  deliveryDateRange: {
    start: '2024-05-20',
    end: '2024-06-19'
  },
  mealPreparationCutoffTime: tomorrow.toISOString(),
  dietaryRestrictions: [
    {
      type: 'allergy',
      name: '牛奶过敏',
      description: '乳糖不耐受，饮用牛奶后会腹泻',
      severity: 'moderate'
    }
  ],
  replacementItems: [
    {
      originalMealId: 'MEAL-005',
      originalMealName: '牛奶炖木瓜',
      replacementMealId: 'MEAL-005-ALT',
      replacementMealName: '银耳炖雪梨',
      reason: '不喜欢吃木瓜',
      dietaryRestrictionId: ''
    }
  ],
  createdBy: '周护士',
  notes: '产妇说她不爱吃木瓜'
};

export const duplicateApplication: CreateApplicationRequest = {
  orderId: 'YZC-2024-0520-005',
  motherName: '孙丽',
  roomNumber: '508房',
  admissionDate: '2024-05-14',
  deliveryDate: '2024-05-17',
  mealPlanType: 'diabetic',
  deliveryDateRange: {
    start: '2024-05-20',
    end: '2024-06-19'
  },
  mealPreparationCutoffTime: tomorrow.toISOString(),
  dietaryRestrictions: [
    {
      type: 'health',
      name: '糖尿病',
      description: '妊娠糖尿病，需要严格控糖',
      severity: 'severe'
    }
  ],
  replacementItems: [
    {
      originalMealId: 'MEAL-006',
      originalMealName: '红豆沙汤圆',
      replacementMealId: 'MEAL-006-ALT',
      replacementMealName: '燕麦粥',
      reason: '糖尿病，含糖量过高',
      dietaryRestrictionId: ''
    },
    {
      originalMealId: 'MEAL-006',
      originalMealName: '红豆沙汤圆',
      replacementMealId: 'MEAL-006-ALT2',
      replacementMealName: '糙米粥',
      reason: '糖尿病，糯米升糖快',
      dietaryRestrictionId: ''
    }
  ],
  createdBy: '吴护士',
  notes: '两个替换申请都是同一个菜品'
};

export const sampleMeals = [
  { id: 'MEAL-001', name: '清蒸鲈鱼', category: 'lunch', ingredients: ['鲈鱼', '生姜', '葱', '料酒'] },
  { id: 'MEAL-001-ALT', name: '香菇滑鸡', category: 'lunch', ingredients: ['鸡肉', '香菇', '红枣', '枸杞'] },
  { id: 'MEAL-002', name: '红糖糯米粥', category: 'breakfast', ingredients: ['糯米', '红糖', '红枣'] },
  { id: 'MEAL-002-ALT', name: '小米山药粥', category: 'breakfast', ingredients: ['小米', '山药', '枸杞'] },
  { id: 'MEAL-003', name: '花生猪脚汤', category: 'soup', ingredients: ['猪脚', '花生', '生姜'] },
  { id: 'MEAL-003-ALT', name: '黄豆猪脚汤', category: 'soup', ingredients: ['猪脚', '黄豆', '通草'] },
  { id: 'MEAL-004', name: '鸡蛋炒时蔬', category: 'dinner', ingredients: ['鸡蛋', '青菜', '胡萝卜'] },
  { id: 'MEAL-004-ALT', name: '黑木耳炒山药', category: 'dinner', ingredients: ['黑木耳', '山药', '青椒'] },
  { id: 'MEAL-005', name: '牛奶炖木瓜', category: 'snack', ingredients: ['牛奶', '木瓜', '冰糖'] },
  { id: 'MEAL-005-ALT', name: '银耳炖雪梨', category: 'snack', ingredients: ['银耳', '雪梨', '红枣'] },
  { id: 'MEAL-006', name: '红豆沙汤圆', category: 'snack', ingredients: ['红豆', '糯米粉', '红糖'] },
  { id: 'MEAL-006-ALT', name: '燕麦粥', category: 'snack', ingredients: ['燕麦', '水'] },
  { id: 'MEAL-006-ALT2', name: '糙米粥', category: 'snack', ingredients: ['糙米', '水'] }
];
