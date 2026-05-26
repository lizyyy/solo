import type { Prescription } from '@/types';

export const prescriptions: Prescription[] = [
  {
    id: 'pres_001',
    patientName: '张三',
    patientAge: 35,
    patientGender: '男',
    diagnosis: '上呼吸道感染',
    allergies: [],
    items: [
      {
        medicineId: 'med_001',
        medicineName: '阿莫西林胶囊',
        dosage: 0.5,
        unit: 'g',
        frequency: '每日3次',
        duration: '7天'
      },
      {
        medicineId: 'med_009',
        medicineName: '氨溴索口服溶液',
        dosage: 30,
        unit: 'mg',
        frequency: '每日3次',
        duration: '7天'
      }
    ],
    doctorName: '李医生',
    date: '2026-05-20'
  },
  {
    id: 'pres_002',
    patientName: '李四',
    patientAge: 65,
    patientGender: '男',
    diagnosis: '高血压、冠心病',
    allergies: ['青霉素'],
    items: [
      {
        medicineId: 'med_006',
        medicineName: '氨氯地平片',
        dosage: 5,
        unit: 'mg',
        frequency: '每日1次',
        duration: '长期'
      },
      {
        medicineId: 'med_012',
        medicineName: '阿司匹林肠溶片',
        dosage: 100,
        unit: 'mg',
        frequency: '每日1次',
        duration: '长期'
      },
      {
        medicineId: 'med_013',
        medicineName: '阿托伐他汀钙片',
        dosage: 20,
        unit: 'mg',
        frequency: '每晚1次',
        duration: '长期'
      }
    ],
    doctorName: '王医生',
    date: '2026-05-21'
  },
  {
    id: 'pres_003',
    patientName: '王五',
    patientAge: 45,
    patientGender: '男',
    diagnosis: '2型糖尿病',
    allergies: [],
    items: [
      {
        medicineId: 'med_005',
        medicineName: '二甲双胍缓释片',
        dosage: 0.5,
        unit: 'g',
        frequency: '每日2次',
        duration: '长期'
      },
      {
        medicineId: 'med_017',
        medicineName: '格列美脲片',
        dosage: 2,
        unit: 'mg',
        frequency: '每日1次',
        duration: '长期'
      }
    ],
    doctorName: '张医生',
    date: '2026-05-22'
  },
  {
    id: 'pres_004',
    patientName: '赵六',
    patientAge: 28,
    patientGender: '女',
    diagnosis: '慢性胃炎、幽门螺杆菌感染',
    allergies: [],
    items: [
      {
        medicineId: 'med_007',
        medicineName: '奥美拉唑肠溶胶囊',
        dosage: 20,
        unit: 'mg',
        frequency: '每日2次',
        duration: '14天'
      },
      {
        medicineId: 'med_001',
        medicineName: '阿莫西林胶囊',
        dosage: 1.0,
        unit: 'g',
        frequency: '每日2次',
        duration: '14天'
      },
      {
        medicineId: 'med_023',
        medicineName: '罗红霉素分散片',
        dosage: 150,
        unit: 'mg',
        frequency: '每日2次',
        duration: '14天'
      }
    ],
    doctorName: '刘医生',
    date: '2026-05-23'
  },
  {
    id: 'pres_005',
    patientName: '孙七',
    patientAge: 52,
    patientGender: '男',
    diagnosis: '腰椎间盘突出症',
    allergies: ['磺胺类'],
    items: [
      {
        medicineId: 'med_003',
        medicineName: '布洛芬缓释胶囊',
        dosage: 0.3,
        unit: 'g',
        frequency: '每日2次',
        duration: '14天'
      },
      {
        medicineId: 'med_018',
        medicineName: '泼尼松片',
        dosage: 10,
        unit: 'mg',
        frequency: '每日1次',
        duration: '7天'
      }
    ],
    doctorName: '陈医生',
    date: '2026-05-24'
  },
  {
    id: 'pres_006',
    patientName: '周八',
    patientAge: 72,
    patientGender: '女',
    diagnosis: '高血压、心房颤动',
    allergies: [],
    items: [
      {
        medicineId: 'med_015',
        medicineName: '硝苯地平缓释片',
        dosage: 30,
        unit: 'mg',
        frequency: '每日1次',
        duration: '长期'
      },
      {
        medicineId: 'med_016',
        medicineName: '华法林钠片',
        dosage: 2.5,
        unit: 'mg',
        frequency: '每日1次',
        duration: '长期'
      }
    ],
    doctorName: '吴医生',
    date: '2026-05-25'
  },
  {
    id: 'pres_007',
    patientName: '吴九',
    patientAge: 32,
    patientGender: '男',
    diagnosis: '社区获得性肺炎',
    allergies: [],
    items: [
      {
        medicineId: 'med_014',
        medicineName: '左氧氟沙星片',
        dosage: 0.5,
        unit: 'g',
        frequency: '每日1次',
        duration: '10天'
      },
      {
        medicineId: 'med_009',
        medicineName: '氨溴索口服溶液',
        dosage: 30,
        unit: 'mg',
        frequency: '每日3次',
        duration: '10天'
      }
    ],
    doctorName: '郑医生',
    date: '2026-05-26'
  },
  {
    id: 'pres_008',
    patientName: '郑十',
    patientAge: 40,
    patientGender: '女',
    diagnosis: '过敏性鼻炎',
    allergies: [],
    items: [
      {
        medicineId: 'med_008',
        medicineName: '氯雷他定片',
        dosage: 10,
        unit: 'mg',
        frequency: '每日1次',
        duration: '14天'
      }
    ],
    doctorName: '冯医生',
    date: '2026-05-26'
  },
  {
    id: 'pres_009',
    patientName: '冯十一',
    patientAge: 17,
    patientGender: '男',
    diagnosis: '急性支气管炎',
    allergies: [],
    items: [
      {
        medicineId: 'med_002',
        medicineName: '头孢克肟分散片',
        dosage: 0.1,
        unit: 'g',
        frequency: '每日2次',
        duration: '7天'
      },
      {
        medicineId: 'med_024',
        medicineName: '复方甘草片',
        dosage: 3,
        unit: '片',
        frequency: '每日3次',
        duration: '7天'
      }
    ],
    doctorName: '褚医生',
    date: '2026-05-26'
  },
  {
    id: 'pres_010',
    patientName: '陈十二',
    patientAge: 58,
    patientGender: '男',
    diagnosis: '骨关节炎',
    allergies: ['青霉素'],
    items: [
      {
        medicineId: 'med_022',
        medicineName: '双氯芬酸钠缓释片',
        dosage: 75,
        unit: 'mg',
        frequency: '每日1次',
        duration: '30天'
      }
    ],
    doctorName: '卫医生',
    date: '2026-05-26'
  },
  {
    id: 'pres_011',
    patientName: '林十三',
    patientAge: 45,
    patientGender: '男',
    diagnosis: '上呼吸道感染',
    allergies: [],
    items: [
      {
        medicineId: 'med_021',
        medicineName: '阿莫西林克拉维酸钾',
        dosage: 0.375,
        unit: 'g',
        frequency: '每日3次',
        duration: '7天'
      }
    ],
    doctorName: '蒋医生',
    date: '2026-05-26'
  },
  {
    id: 'pres_012',
    patientName: '黄十四',
    patientAge: 30,
    patientGender: '女',
    diagnosis: '急性腹泻',
    allergies: [],
    items: [
      {
        medicineId: 'med_010',
        medicineName: '蒙脱石散',
        dosage: 3,
        unit: 'g',
        frequency: '每日3次',
        duration: '3天'
      }
    ],
    doctorName: '沈医生',
    date: '2026-05-26'
  }
];

export const getPrescriptionById = (id: string): Prescription | undefined => {
  return prescriptions.find(p => p.id === id);
};

export const getRandomPrescriptions = (count: number): Prescription[] => {
  const shuffled = [...prescriptions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};
