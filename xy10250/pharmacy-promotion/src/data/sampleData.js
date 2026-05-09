export const SAMPLE_BATCHES = [
  {
    id: 'batch_001',
    medicineId: 'MED001',
    medicineName: '阿莫西林胶囊',
    batchNumber: 'B20240301',
    expiryDate: '2026-06-10',
    quantity: 200,
    price: 28.5,
    isPrescription: true,
    manufacturer: '华北制药',
    isLocked: false
  },
  {
    id: 'batch_002',
    medicineId: 'MED002',
    medicineName: '布洛芬缓释片',
    batchNumber: 'B20240515',
    expiryDate: '2026-07-20',
    quantity: 150,
    price: 35.0,
    isPrescription: false,
    manufacturer: '中美史克',
    isLocked: false
  },
  {
    id: 'batch_003',
    medicineId: 'MED003',
    medicineName: '复方氨酚烷胺片',
    batchNumber: 'B20240220',
    expiryDate: '2026-05-25',
    quantity: 80,
    price: 18.0,
    isPrescription: false,
    manufacturer: '吉林敖东',
    isLocked: false
  },
  {
    id: 'batch_004',
    medicineId: 'MED004',
    medicineName: '头孢克肟分散片',
    batchNumber: 'B20240110',
    expiryDate: '2026-05-15',
    quantity: 50,
    price: 42.0,
    isPrescription: true,
    manufacturer: '广州白云山',
    isLocked: false
  },
  {
    id: 'batch_005',
    medicineId: 'MED005',
    medicineName: '维生素C片',
    batchNumber: 'B20240601',
    expiryDate: '2026-11-10',
    quantity: 500,
    price: 12.0,
    isPrescription: false,
    manufacturer: '东北制药',
    isLocked: false
  },
  {
    id: 'batch_006',
    medicineId: 'MED006',
    medicineName: '氯雷他定片',
    batchNumber: 'B20240320',
    expiryDate: '2026-08-15',
    quantity: 120,
    price: 25.0,
    isPrescription: false,
    manufacturer: '扬子江药业',
    isLocked: false
  }
]

export const SAMPLE_PROMOTIONS = [
  {
    id: 'promo_001',
    name: '夏季感冒促销组合',
    status: 'draft',
    description: '针对感冒症状的组合促销',
    validFrom: '2026-05-15',
    validTo: '2026-06-30',
    discountType: 'percentage',
    discountValue: 20,
    items: [
      {
        batchId: 'batch_002',
        batchNumber: 'B20240515',
        medicineName: '布洛芬缓释片',
        minQuantity: 2
      },
      {
        batchId: 'batch_003',
        batchNumber: 'B20240220',
        medicineName: '复方氨酚烷胺片',
        minQuantity: 2
      }
    ],
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z'
  }
]

export const CSV_IMPORT_TEMPLATE = `药品ID,药品名称,批号,有效期,库存数量,单价,是否处方药,生产厂家
MED001,阿莫西林胶囊,B20240301,2026-06-10,200,28.5,是,华北制药
MED002,布洛芬缓释片,B20240515,2026-07-20,150,35.0,否,中美史克`
