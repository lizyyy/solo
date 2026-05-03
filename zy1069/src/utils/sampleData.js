import { 
  createFamilyMember, 
  createMedicine, 
  createMedicationPlan, 
  createDose,
  generateId
} from './models'
import { formatDate, addDays, getTodayString } from './dateUtils'
import { AGE_GROUP, MEAL_TIMING, APPLICABLE_POPULATION } from './constants'

export function getSampleData() {
  const today = new Date()
  
  const members = [
    createFamilyMember({
      id: 'm_grandpa',
      name: '张爷爷',
      age: 72,
      ageGroup: AGE_GROUP.ELDERLY,
      allergies: ['青霉素', '磺胺类药物'],
      chronicConditions: ['高血压', '糖尿病', '冠心病'],
      notes: '需要早晚监测血压，餐后注意血糖'
    }),
    createFamilyMember({
      id: 'm_grandma',
      name: '张奶奶',
      age: 68,
      ageGroup: AGE_GROUP.ELDERLY,
      allergies: [],
      chronicConditions: ['骨质疏松', '失眠'],
      notes: '睡眠不好，晚上需要吃助眠药'
    }),
    createFamilyMember({
      id: 'm_father',
      name: '张爸爸',
      age: 42,
      ageGroup: AGE_GROUP.ADULT,
      allergies: ['海鲜'],
      chronicConditions: ['轻度脂肪肝'],
      notes: '工作压力大，偶尔有偏头痛'
    }),
    createFamilyMember({
      id: 'm_mother',
      name: '张妈妈',
      age: 38,
      ageGroup: AGE_GROUP.ADULT,
      allergies: [],
      chronicConditions: [],
      notes: '身体健康，注意补充维生素'
    }),
    createFamilyMember({
      id: 'm_son',
      name: '张小宝',
      age: 8,
      ageGroup: AGE_GROUP.CHILD,
      allergies: ['牛奶', '花生'],
      chronicConditions: [],
      notes: '正在换牙，注意口腔卫生'
    }),
    createFamilyMember({
      id: 'm_daughter',
      name: '张贝贝',
      age: 3,
      ageGroup: AGE_GROUP.INFANT,
      allergies: [],
      chronicConditions: [],
      notes: '婴幼儿，用药需特别注意剂量'
    })
  ]
  
  const medicines = [
    createMedicine({
      id: 'med_amlodipine',
      name: '苯磺酸氨氯地平片',
      genericIngredient: '氨氯地平',
      specifications: '5mg/片',
      stockQuantity: 28,
      expiryDate: formatDate(addDays(today, 180)),
      applicablePopulation: [APPLICABLE_POPULATION.ADULT, APPLICABLE_POPULATION.ELDERLY],
      contraindications: ['对二氢吡啶类药物过敏者禁用', '严重低血压患者禁用'],
      suggestedInterval: 24,
      notes: '降压药，每日一次'
    }),
    createMedicine({
      id: 'med_metformin',
      name: '盐酸二甲双胍缓释片',
      genericIngredient: '二甲双胍',
      specifications: '0.5g/片',
      stockQuantity: 60,
      expiryDate: formatDate(addDays(today, 240)),
      applicablePopulation: [APPLICABLE_POPULATION.ADULT, APPLICABLE_POPULATION.ELDERLY],
      contraindications: ['严重肾功能不全者禁用', '急性代谢性酸中毒禁用'],
      suggestedInterval: 12,
      notes: '降糖药，随餐服用'
    }),
    createMedicine({
      id: 'med_aspirin',
      name: '阿司匹林肠溶片',
      genericIngredient: '阿司匹林',
      specifications: '100mg/片',
      stockQuantity: 30,
      expiryDate: formatDate(addDays(today, -10)),
      applicablePopulation: [APPLICABLE_POPULATION.ADULT, APPLICABLE_POPULATION.ELDERLY],
      contraindications: ['对阿司匹林过敏者禁用', '活动性消化道溃疡禁用', '出血倾向者禁用'],
      suggestedInterval: 24,
      notes: '抗血小板药，已过期！'
    }),
    createMedicine({
      id: 'med_calcium',
      name: '碳酸钙D3片',
      genericIngredient: '碳酸钙、维生素D3',
      specifications: '每片含钙600mg',
      stockQuantity: 45,
      expiryDate: formatDate(addDays(today, 360)),
      applicablePopulation: [APPLICABLE_POPULATION.ALL],
      contraindications: ['高钙血症患者禁用', '肾结石患者禁用'],
      suggestedInterval: 24,
      notes: '补钙药，饭后服用'
    }),
    createMedicine({
      id: 'med_ibuprofen',
      name: '布洛芬缓释胶囊',
      genericIngredient: '布洛芬',
      specifications: '0.3g/粒',
      stockQuantity: 12,
      expiryDate: formatDate(addDays(today, 15)),
      applicablePopulation: [APPLICABLE_POPULATION.ADULT, APPLICABLE_POPULATION.TEEN],
      contraindications: ['对非甾体抗炎药过敏者禁用', '活动性消化道溃疡禁用', '严重肝肾功能不全者禁用'],
      suggestedInterval: 12,
      notes: '止痛药，即将过期！'
    }),
    createMedicine({
      id: 'med_multivitamin',
      name: '复合维生素B片',
      genericIngredient: '维生素B1、B2、B6、B12',
      specifications: '100片/瓶',
      stockQuantity: 80,
      expiryDate: formatDate(addDays(today, 300)),
      applicablePopulation: [APPLICABLE_POPULATION.ALL],
      contraindications: [],
      suggestedInterval: 24,
      notes: '补充维生素B族'
    }),
    createMedicine({
      id: 'med_paracetamol_child',
      name: '对乙酰氨基酚混悬滴剂',
      genericIngredient: '对乙酰氨基酚',
      specifications: '100ml/瓶',
      stockQuantity: 2,
      expiryDate: formatDate(addDays(today, 200)),
      applicablePopulation: [APPLICABLE_POPULATION.INFANT, APPLICABLE_POPULATION.CHILD],
      contraindications: ['严重肝肾功能不全者禁用', '对本品过敏者禁用'],
      suggestedInterval: 6,
      notes: '儿童退烧药，按体重计算剂量'
    }),
    createMedicine({
      id: 'med_cough_syrup',
      name: '小儿止咳糖浆',
      genericIngredient: '甘草流浸膏、桔梗流浸膏',
      specifications: '100ml/瓶',
      stockQuantity: 1,
      expiryDate: formatDate(addDays(today, 180)),
      applicablePopulation: [APPLICABLE_POPULATION.CHILD],
      contraindications: ['糖尿病患儿禁用'],
      suggestedInterval: 8,
      notes: '止咳化痰，库存仅剩1瓶'
    }),
    createMedicine({
      id: 'med_atorvastatin',
      name: '阿托伐他汀钙片',
      genericIngredient: '阿托伐他汀',
      specifications: '20mg/片',
      stockQuantity: 0,
      expiryDate: formatDate(addDays(today, 270)),
      applicablePopulation: [APPLICABLE_POPULATION.ADULT, APPLICABLE_POPULATION.ELDERLY],
      contraindications: ['活动性肝病患者禁用', '孕妇及哺乳期妇女禁用'],
      suggestedInterval: 24,
      notes: '降脂药，库存为0，需要补充！'
    }),
    createMedicine({
      id: 'med_loratadine',
      name: '氯雷他定片',
      genericIngredient: '氯雷他定',
      specifications: '10mg/片',
      stockQuantity: 6,
      expiryDate: formatDate(addDays(today, 210)),
      applicablePopulation: [APPLICABLE_POPULATION.ADULT, APPLICABLE_POPULATION.TEEN, APPLICABLE_POPULATION.CHILD],
      contraindications: ['对本品过敏者禁用'],
      suggestedInterval: 24,
      notes: '抗过敏药，用于过敏性鼻炎、荨麻疹'
    })
  ]
  
  const plans = [
    createMedicationPlan({
      id: 'p_grandpa_1',
      familyMemberId: 'm_grandpa',
      medicineId: 'med_amlodipine',
      startDate: formatDate(addDays(today, -30)),
      endDate: formatDate(addDays(today, 60)),
      frequencyPerDay: 1,
      doses: [
        createDose({ time: '08:00', status: 'pending' })
      ],
      mealTiming: MEAL_TIMING.AFTER,
      dosage: '1片',
      notes: '早餐后服用，监测血压'
    }),
    createMedicationPlan({
      id: 'p_grandpa_2',
      familyMemberId: 'm_grandpa',
      medicineId: 'med_metformin',
      startDate: formatDate(addDays(today, -30)),
      endDate: formatDate(addDays(today, 60)),
      frequencyPerDay: 2,
      doses: [
        createDose({ time: '08:00', status: 'pending' }),
        createDose({ time: '18:00', status: 'pending' })
      ],
      mealTiming: MEAL_TIMING.BEFORE,
      dosage: '1片',
      notes: '早晚餐前服用，监测血糖'
    }),
    createMedicationPlan({
      id: 'p_grandpa_3',
      familyMemberId: 'm_grandpa',
      medicineId: 'med_aspirin',
      startDate: formatDate(addDays(today, -60)),
      endDate: formatDate(addDays(today, 30)),
      frequencyPerDay: 1,
      doses: [
        createDose({ time: '20:00', status: 'pending' })
      ],
      mealTiming: MEAL_TIMING.AFTER,
      dosage: '1片',
      notes: '睡前服用，注意：该药已过期！'
    }),
    createMedicationPlan({
      id: 'p_grandma_1',
      familyMemberId: 'm_grandma',
      medicineId: 'med_calcium',
      startDate: formatDate(addDays(today, -15)),
      endDate: formatDate(addDays(today, 90)),
      frequencyPerDay: 1,
      doses: [
        createDose({ time: '20:00', status: 'pending' })
      ],
      mealTiming: MEAL_TIMING.AFTER,
      dosage: '1片',
      notes: '晚饭后补钙'
    }),
    createMedicationPlan({
      id: 'p_mother_1',
      familyMemberId: 'm_mother',
      medicineId: 'med_multivitamin',
      startDate: formatDate(addDays(today, -20)),
      endDate: formatDate(addDays(today, 100)),
      frequencyPerDay: 1,
      doses: [
        createDose({ time: '08:00', status: 'pending' })
      ],
      mealTiming: MEAL_TIMING.AFTER,
      dosage: '1片',
      notes: '早餐后补充维生素'
    }),
    createMedicationPlan({
      id: 'p_father_1',
      familyMemberId: 'm_father',
      medicineId: 'med_ibuprofen',
      startDate: formatDate(today),
      endDate: formatDate(addDays(today, 3)),
      frequencyPerDay: 2,
      doses: [
        createDose({ time: '12:00', status: 'pending' }),
        createDose({ time: '20:00', status: 'pending' })
      ],
      mealTiming: MEAL_TIMING.AFTER,
      dosage: '1粒',
      notes: '头痛时服用，注意：该药即将过期！'
    }),
    createMedicationPlan({
      id: 'p_son_1',
      familyMemberId: 'm_son',
      medicineId: 'med_loratadine',
      startDate: formatDate(addDays(today, -2)),
      endDate: formatDate(addDays(today, 5)),
      frequencyPerDay: 1,
      doses: [
        createDose({ time: '08:00', status: 'pending' })
      ],
      mealTiming: MEAL_TIMING.ANY,
      dosage: '半片',
      notes: '过敏性鼻炎，注意：对牛奶花生过敏'
    })
  ]
  
  return {
    familyMembers: members,
    medicines,
    medicationPlans: plans
  }
}
