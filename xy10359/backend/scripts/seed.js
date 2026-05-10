const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const Drug = require('../models/Drug');
const Prescription = require('../models/Prescription');
const { validatePrescription } = require('../utils/prescriptionValidator');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/prescription_review';

const patientsData = [
  {
    name: '张三',
    idCard: '110101199001011234',
    age: 34,
    gender: '男',
    allergies: [
      { drugName: '青霉素', severity: '重度', description: '青霉素过敏史，曾出现过敏性休克' },
      { drugName: '阿莫西林', severity: '中度', description: '青霉素类交叉过敏' }
    ],
    medicalHistory: ['高血压', '糖尿病']
  },
  {
    name: '李四',
    idCard: '110101198505052345',
    age: 39,
    gender: '女',
    allergies: [
      { drugName: '对乙酰氨基酚', severity: '轻度', description: '轻度皮疹' }
    ],
    medicalHistory: ['哮喘']
  },
  {
    name: '王五',
    idCard: '110101197808083456',
    age: 46,
    gender: '男',
    allergies: [],
    medicalHistory: ['冠心病']
  }
];

const drugsData = [
  {
    code: 'DRG001',
    name: '阿莫西林胶囊',
    genericName: '阿莫西林',
    activeIngredients: [{ name: '阿莫西林' }],
    category: '处方药',
    maxDosePerDay: 4,
    maxDosePerCourse: 28,
    unit: '粒',
    contraindications: ['青霉素过敏者禁用'],
    sideEffects: ['胃肠道不适', '皮疹']
  },
  {
    code: 'DRG002',
    name: '头孢克洛胶囊',
    genericName: '头孢克洛',
    activeIngredients: [{ name: '头孢克洛' }],
    category: '处方药',
    maxDosePerDay: 3,
    maxDosePerCourse: 21,
    unit: '粒',
    contraindications: ['头孢类过敏者禁用'],
    sideEffects: ['胃肠道不适']
  },
  {
    code: 'DRG003',
    name: '布洛芬缓释胶囊',
    genericName: '布洛芬',
    activeIngredients: [{ name: '布洛芬' }],
    category: '处方药',
    maxDosePerDay: 2,
    maxDosePerCourse: 14,
    unit: '粒',
    contraindications: ['胃溃疡患者慎用'],
    sideEffects: ['胃肠道刺激']
  },
  {
    code: 'DRG004',
    name: '复方氨酚烷胺片',
    genericName: '复方氨酚烷胺',
    activeIngredients: [
      { name: '对乙酰氨基酚' },
      { name: '马来酸氯苯那敏' }
    ],
    category: '非处方药',
    maxDosePerDay: 2,
    maxDosePerCourse: 7,
    unit: '片',
    contraindications: ['肝肾功能不全者慎用'],
    sideEffects: ['嗜睡', '口干']
  },
  {
    code: 'DRG005',
    name: '对乙酰氨基酚片',
    genericName: '对乙酰氨基酚',
    activeIngredients: [{ name: '对乙酰氨基酚' }],
    category: '非处方药',
    maxDosePerDay: 4,
    maxDosePerCourse: 10,
    unit: '片',
    contraindications: ['严重肝肾功能不全者禁用'],
    sideEffects: ['肝损伤']
  },
  {
    code: 'DRG006',
    name: '奥美拉唑肠溶胶囊',
    genericName: '奥美拉唑',
    activeIngredients: [{ name: '奥美拉唑' }],
    category: '处方药',
    maxDosePerDay: 2,
    maxDosePerCourse: 14,
    unit: '粒',
    contraindications: [],
    sideEffects: ['头痛', '腹泻']
  },
  {
    code: 'DRG007',
    name: '甲硝唑片',
    genericName: '甲硝唑',
    activeIngredients: [{ name: '甲硝唑' }],
    category: '处方药',
    maxDosePerDay: 4,
    maxDosePerCourse: 10,
    unit: '片',
    contraindications: ['妊娠早期禁用'],
    sideEffects: ['恶心', '金属味']
  }
];

const generatePrescriptionNo = () => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `RX${dateStr}${random}`;
};

const seed = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('开始清空旧数据...');
    await Patient.deleteMany({});
    await Drug.deleteMany({});
    await Prescription.deleteMany({});

    console.log('开始导入患者数据...');
    const patients = await Patient.create(patientsData);
    console.log(`成功导入 ${patients.length} 位患者`);

    console.log('开始导入药品数据...');
    const drugs = await Drug.create(drugsData);
    console.log(`成功导入 ${drugs.length} 种药品`);

    const drugMap = {};
    drugs.forEach(d => {
      drugMap[d.name] = d;
    });

    const prescriptionsData = [
      {
        patient: patients[0],
        doctorName: '王医生',
        department: '内科',
        diagnosis: '上呼吸道感染',
        items: [
          {
            drugId: drugMap['头孢克洛胶囊']._id,
            drugName: '头孢克洛胶囊',
            genericName: '头孢克洛',
            dosage: '1粒',
            frequency: '每日3次',
            quantity: 21,
            unit: '粒',
            route: '口服'
          }
        ],
        status: '待复核',
        consultationRecord: {
          consultationTime: new Date(),
          symptoms: '发热、咳嗽、咽痛3天',
          physicalExamination: '体温38.5℃，扁桃体II度肿大',
          assistantAdvice: '注意休息，多饮水'
        }
      },
      {
        patient: patients[0],
        doctorName: '李医生',
        department: '内科',
        diagnosis: '急性支气管炎',
        items: [
          {
            drugId: drugMap['阿莫西林胶囊']._id,
            drugName: '阿莫西林胶囊',
            genericName: '阿莫西林',
            dosage: '1粒',
            frequency: '每日3次',
            quantity: 14,
            unit: '粒',
            route: '口服'
          }
        ],
        status: '待复核',
        consultationRecord: {
          consultationTime: new Date(Date.now() - 86400000),
          symptoms: '咳嗽、咳痰5天',
          physicalExamination: '双肺呼吸音粗，可闻及湿啰音',
          assistantAdvice: '建议复查胸片'
        }
      },
      {
        patient: patients[1],
        doctorName: '张医生',
        department: '内科',
        diagnosis: '感冒',
        items: [
          {
            drugId: drugMap['布洛芬缓释胶囊']._id,
            drugName: '布洛芬缓释胶囊',
            genericName: '布洛芬',
            dosage: '2粒',
            frequency: '每日3次',
            quantity: 14,
            unit: '粒',
            route: '口服'
          }
        ],
        status: '待复核',
        consultationRecord: {
          consultationTime: new Date(Date.now() - 172800000),
          symptoms: '头痛、全身酸痛',
          physicalExamination: '体温37.8℃',
          assistantAdvice: '多休息'
        }
      },
      {
        patient: patients[1],
        doctorName: '王医生',
        department: '内科',
        diagnosis: '发热',
        items: [
          {
            drugId: drugMap['复方氨酚烷胺片']._id,
            drugName: '复方氨酚烷胺片',
            genericName: '复方氨酚烷胺',
            dosage: '1片',
            frequency: '每日2次',
            quantity: 10,
            unit: '片',
            route: '口服'
          },
          {
            drugId: drugMap['对乙酰氨基酚片']._id,
            drugName: '对乙酰氨基酚片',
            genericName: '对乙酰氨基酚',
            dosage: '1片',
            frequency: '每日3次',
            quantity: 10,
            unit: '片',
            route: '口服'
          }
        ],
        status: '已退回',
        consultationRecord: {
          consultationTime: new Date(Date.now() - 259200000),
          symptoms: '发热38.9℃',
          physicalExamination: '咽部充血',
          assistantAdvice: ''
        }
      },
      {
        patient: patients[2],
        doctorName: '陈医生',
        department: '消化内科',
        diagnosis: '急性胃肠炎',
        items: [
          {
            drugId: drugMap['奥美拉唑肠溶胶囊']._id,
            drugName: '奥美拉唑肠溶胶囊',
            genericName: '奥美拉唑',
            dosage: '1粒',
            frequency: '每日2次',
            quantity: 14,
            unit: '粒',
            route: '口服'
          },
          {
            drugId: drugMap['甲硝唑片']._id,
            drugName: '甲硝唑片',
            genericName: '甲硝唑',
            dosage: '1片',
            frequency: '每日3次',
            quantity: 10,
            unit: '片',
            route: '口服'
          }
        ],
        status: '已通过',
        consultationRecord: {
          consultationTime: new Date(Date.now() - 345600000),
          symptoms: '腹痛、腹泻2天',
          physicalExamination: '腹软，脐周压痛',
          assistantAdvice: '清淡饮食'
        },
        reviewHistoryExtra: [
          {
            reviewer: '陈药师',
            action: '通过',
            reason: '处方合理，无风险问题',
            timestamp: new Date(Date.now() - 345000000)
          }
        ]
      },
      {
        patient: patients[2],
        doctorName: '张医生',
        department: '内科',
        diagnosis: '冠心病',
        items: [
          {
            drugId: drugMap['阿司匹林肠溶片'] ? drugMap['阿司匹林肠溶片']._id : drugMap['布洛芬缓释胶囊']._id,
            drugName: '阿司匹林肠溶片',
            genericName: '阿司匹林',
            dosage: '1片',
            frequency: '每日1次',
            quantity: 30,
            unit: '片',
            route: '口服'
          }
        ],
        status: '需补充',
        consultationRecord: {
          consultationTime: new Date(Date.now() - 432000000),
          symptoms: '胸闷、胸痛',
          physicalExamination: '血压145/90mmHg',
          assistantAdvice: ''
        }
      }
    ];

    console.log('开始导入处方数据...');
    for (const pData of prescriptionsData) {
      const validationResult = await validatePrescription({
        patientId: pData.patient._id,
        items: pData.items
      });

      const prescription = new Prescription({
        prescriptionNo: generatePrescriptionNo(),
        patientId: pData.patient._id,
        patientName: pData.patient.name,
        doctorName: pData.doctorName,
        department: pData.department,
        diagnosis: pData.diagnosis,
        items: pData.items,
        status: pData.status,
        risks: validationResult.risks,
        canDispense: validationResult.canDispense && pData.status === '已通过',
        consultationRecord: pData.consultationRecord,
        reviewHistory: [
          {
            reviewer: pData.doctorName,
            action: '创建',
            reason: '处方创建'
          }
        ],
        createdAt: pData.consultationRecord.consultationTime,
        reviewedAt: pData.status === '已通过' ? new Date() : null
      });

      if (pData.reviewHistoryExtra) {
        prescription.reviewHistory.push(...pData.reviewHistoryExtra);
      }

      if (pData.status === '已退回') {
        prescription.reviewHistory.push({
          reviewer: '李药师',
          action: '退回',
          reason: '存在重复成分风险，对乙酰氨基酚同时出现在复方氨酚烷胺片和对乙酰氨基酚片中',
          timestamp: new Date(Date.now() - 258000000)
        });
      }

      if (pData.status === '需补充') {
        prescription.reviewHistory.push({
          reviewer: '王药师',
          action: '需补充',
          reason: '需要医生补充具体诊断依据和用药理由',
          timestamp: new Date(Date.now() - 430000000)
        });
      }

      await prescription.save();
    }

    console.log('样例数据导入完成！');
    console.log('============================================');
    console.log('样例数据说明：');
    console.log('1. 正常处方（王五）- 急性胃肠炎，已通过');
    console.log('2. 过敏冲突（张三）- 开了阿莫西林，患者对青霉素过敏');
    console.log('3. 剂量超限（李四）- 布洛芬每日3次，每次2粒，超过每日最大剂量2粒');
    console.log('4. 重复成分（李四）- 复方氨酚烷胺 + 对乙酰氨基酚，均含对乙酰氨基酚');
    console.log('5. 需补充（王五）- 冠心病处方需医生补充信息');
    console.log('============================================');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('数据导入失败:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seed();
