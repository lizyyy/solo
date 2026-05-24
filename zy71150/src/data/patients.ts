import { PatientTemplate } from '../types/game';

export const patientTemplates: PatientTemplate[] = [
  {
    id: 'mi_001',
    name: '张三',
    age: 65,
    gender: 'male',
    chiefComplaint: '胸痛伴呼吸困难',
    symptoms: ['压榨性胸痛', '放射至左肩', '出汗', '恶心'],
    vitalSigns: {
      heartRate: 110,
      bloodPressure: '85/50',
      temperature: 36.8,
      respiratoryRate: 28,
      oxygenSaturation: 88
    },
    correctEsi: 1,
    maxWaitTime: 60,
    processingTime: 45,
    reassessEvents: []
  },
  {
    id: 'stroke_001',
    name: '李四',
    age: 72,
    gender: 'female',
    chiefComplaint: '突发右侧肢体无力',
    symptoms: ['右侧面瘫', '言语不清', '右侧肢体无力', '头痛'],
    vitalSigns: {
      heartRate: 95,
      bloodPressure: '180/100',
      temperature: 37.0,
      respiratoryRate: 20,
      oxygenSaturation: 95
    },
    correctEsi: 1,
    maxWaitTime: 45,
    processingTime: 50,
    reassessEvents: []
  },
  {
    id: 'sepsis_001',
    name: '王五',
    age: 58,
    gender: 'male',
    chiefComplaint: '高热伴意识模糊',
    symptoms: ['发热', '寒战', '意识模糊', '尿量减少'],
    vitalSigns: {
      heartRate: 130,
      bloodPressure: '90/60',
      temperature: 39.5,
      respiratoryRate: 30,
      oxygenSaturation: 90
    },
    correctEsi: 1,
    maxWaitTime: 45,
    processingTime: 60,
    reassessEvents: []
  },
  {
    id: 'arrhythmia_001',
    name: '赵六',
    age: 45,
    gender: 'male',
    chiefComplaint: '心悸伴晕厥',
    symptoms: ['心悸', '头晕', '晕厥史', '胸闷'],
    vitalSigns: {
      heartRate: 160,
      bloodPressure: '100/60',
      temperature: 36.5,
      respiratoryRate: 22,
      oxygenSaturation: 94
    },
    correctEsi: 2,
    maxWaitTime: 120,
    processingTime: 35,
    reassessEvents: [
      {
        triggerTime: 60,
        newSymptoms: ['意识丧失', '抽搐'],
        newVitalSigns: { heartRate: 200, bloodPressure: '70/40', oxygenSaturation: 82 },
        newCorrectEsi: 1
      }
    ]
  },
  {
    id: 'asthma_001',
    name: '陈七',
    age: 30,
    gender: 'female',
    chiefComplaint: '哮喘急性发作',
    symptoms: ['喘息', '呼吸困难', '咳嗽', '不能平卧'],
    vitalSigns: {
      heartRate: 115,
      bloodPressure: '135/85',
      temperature: 37.2,
      respiratoryRate: 32,
      oxygenSaturation: 89
    },
    correctEsi: 2,
    maxWaitTime: 90,
    processingTime: 30,
    reassessEvents: []
  },
  {
    id: 'abdominal_001',
    name: '刘八',
    age: 55,
    gender: 'male',
    chiefComplaint: '剧烈腹痛',
    symptoms: ['上腹痛', '呕血', '黑便', '头晕'],
    vitalSigns: {
      heartRate: 105,
      bloodPressure: '105/65',
      temperature: 36.9,
      respiratoryRate: 20,
      oxygenSaturation: 96
    },
    correctEsi: 2,
    maxWaitTime: 120,
    processingTime: 40,
    reassessEvents: []
  },
  {
    id: 'pneumonia_001',
    name: '孙九',
    age: 68,
    gender: 'female',
    chiefComplaint: '发热咳嗽伴气短',
    symptoms: ['发热', '咳嗽咳痰', '气短', '胸痛'],
    vitalSigns: {
      heartRate: 100,
      bloodPressure: '125/75',
      temperature: 38.5,
      respiratoryRate: 24,
      oxygenSaturation: 92
    },
    correctEsi: 3,
    maxWaitTime: 180,
    processingTime: 25,
    reassessEvents: [
      {
        triggerTime: 90,
        newSymptoms: ['呼吸困难加重', '意识模糊'],
        newVitalSigns: { heartRate: 120, respiratoryRate: 35, oxygenSaturation: 85, temperature: 39.2 },
        newCorrectEsi: 2
      }
    ]
  },
  {
    id: 'kidney_stone_001',
    name: '周十',
    age: 42,
    gender: 'male',
    chiefComplaint: '肾绞痛',
    symptoms: ['侧腹痛', '放射至腹股沟', '恶心呕吐', '血尿'],
    vitalSigns: {
      heartRate: 90,
      bloodPressure: '140/90',
      temperature: 37.1,
      respiratoryRate: 18,
      oxygenSaturation: 98
    },
    correctEsi: 3,
    maxWaitTime: 240,
    processingTime: 20,
    reassessEvents: []
  },
  {
    id: 'headache_001',
    name: '吴十一',
    age: 35,
    gender: 'female',
    chiefComplaint: '剧烈头痛',
    symptoms: ['搏动性头痛', '恶心', '畏光', '畏声'],
    vitalSigns: {
      heartRate: 85,
      bloodPressure: '130/80',
      temperature: 36.7,
      respiratoryRate: 16,
      oxygenSaturation: 99
    },
    correctEsi: 3,
    maxWaitTime: 240,
    processingTime: 15,
    reassessEvents: []
  },
  {
    id: 'laceration_001',
    name: '郑十二',
    age: 28,
    gender: 'male',
    chiefComplaint: '手部切割伤',
    symptoms: ['手部伤口出血', '疼痛', '活动受限'],
    vitalSigns: {
      heartRate: 88,
      bloodPressure: '125/75',
      temperature: 36.6,
      respiratoryRate: 16,
      oxygenSaturation: 98
    },
    correctEsi: 4,
    maxWaitTime: 360,
    processingTime: 15,
    reassessEvents: []
  },
  {
    id: 'sprain_001',
    name: '冯十三',
    age: 22,
    gender: 'female',
    chiefComplaint: '踝关节扭伤',
    symptoms: ['踝关节肿胀', '疼痛', '行走困难', '瘀斑'],
    vitalSigns: {
      heartRate: 75,
      bloodPressure: '118/72',
      temperature: 36.5,
      respiratoryRate: 14,
      oxygenSaturation: 99
    },
    correctEsi: 4,
    maxWaitTime: 360,
    processingTime: 12,
    reassessEvents: []
  },
  {
    id: 'uti_001',
    name: '陈十四',
    age: 30,
    gender: 'female',
    chiefComplaint: '尿频尿痛',
    symptoms: ['尿频', '尿痛', '下腹痛', '尿液浑浊'],
    vitalSigns: {
      heartRate: 78,
      bloodPressure: '120/75',
      temperature: 37.3,
      respiratoryRate: 16,
      oxygenSaturation: 99
    },
    correctEsi: 4,
    maxWaitTime: 480,
    processingTime: 10,
    reassessEvents: []
  },
  {
    id: 'cold_001',
    name: '杨十五',
    age: 18,
    gender: 'male',
    chiefComplaint: '感冒症状',
    symptoms: ['鼻塞', '流涕', '咽痛', '轻微咳嗽'],
    vitalSigns: {
      heartRate: 72,
      bloodPressure: '115/70',
      temperature: 37.0,
      respiratoryRate: 14,
      oxygenSaturation: 99
    },
    correctEsi: 5,
    maxWaitTime: 600,
    processingTime: 8,
    reassessEvents: []
  },
  {
    id: 'rash_001',
    name: '朱十六',
    age: 25,
    gender: 'female',
    chiefComplaint: '皮肤皮疹',
    symptoms: ['皮肤红疹', '瘙痒', '无发热', '无呼吸困难'],
    vitalSigns: {
      heartRate: 70,
      bloodPressure: '118/72',
      temperature: 36.6,
      respiratoryRate: 14,
      oxygenSaturation: 99
    },
    correctEsi: 5,
    maxWaitTime: 600,
    processingTime: 8,
    reassessEvents: []
  },
  {
    id: 'sleep_001',
    name: '秦十七',
    age: 38,
    gender: 'male',
    chiefComplaint: '失眠咨询',
    symptoms: ['入睡困难', '多梦', '白天乏力'],
    vitalSigns: {
      heartRate: 68,
      bloodPressure: '120/80',
      temperature: 36.5,
      respiratoryRate: 12,
      oxygenSaturation: 100
    },
    correctEsi: 5,
    maxWaitTime: 600,
    processingTime: 6,
    reassessEvents: []
  },
  {
    id: 'hidden_critical_001',
    name: '何十八',
    age: 60,
    gender: 'male',
    chiefComplaint: '上腹痛伴恶心',
    symptoms: ['上腹痛', '恶心', '嗳气', '轻度出汗'],
    vitalSigns: {
      heartRate: 95,
      bloodPressure: '110/70',
      temperature: 36.8,
      respiratoryRate: 18,
      oxygenSaturation: 94
    },
    correctEsi: 3,
    maxWaitTime: 180,
    processingTime: 35,
    reassessEvents: [
      {
        triggerTime: 60,
        newSymptoms: ['剧烈胸痛', '呼吸困难', '大汗淋漓'],
        newVitalSigns: { heartRate: 120, bloodPressure: '85/50', respiratoryRate: 28, oxygenSaturation: 86 },
        newCorrectEsi: 1
      }
    ]
  },
  {
    id: 'anxiety_001',
    name: '林十九',
    age: 28,
    gender: 'female',
    chiefComplaint: '胸闷呼吸困难',
    symptoms: ['胸闷', '呼吸困难', '手脚麻木', '头晕'],
    vitalSigns: {
      heartRate: 110,
      bloodPressure: '130/80',
      temperature: 36.7,
      respiratoryRate: 30,
      oxygenSaturation: 98
    },
    correctEsi: 3,
    maxWaitTime: 240,
    processingTime: 15,
    reassessEvents: []
  },
  {
    id: 'fever_child_001',
    name: '黄小宝',
    age: 2,
    gender: 'male',
    chiefComplaint: '发热伴皮疹',
    symptoms: ['发热', '皮疹', '精神可', '进食正常'],
    vitalSigns: {
      heartRate: 110,
      bloodPressure: '95/60',
      temperature: 38.2,
      respiratoryRate: 24,
      oxygenSaturation: 97
    },
    correctEsi: 4,
    maxWaitTime: 300,
    processingTime: 12,
    reassessEvents: []
  }
];
