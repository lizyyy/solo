import fs from 'fs/promises'
import path from 'path'
import { HOSE_STATUS } from './models.js'
import { storage } from './storage.js'
import { ruleEngine } from './rules.js'

export const SAMPLE_HOSES = [
  {
    id: 'HD-0001',
    number: 'HD-0001',
    name: '65mm 水带 (1号)',
    status: HOSE_STATUS.STORAGE,
    location: 'A区货架 1-1',
    notes: '2023年采购，状况良好'
  },
  {
    id: 'HD-0002',
    number: 'HD-0002',
    name: '65mm 水带 (2号)',
    status: HOSE_STATUS.WET,
    location: '晾晒场 A区',
    notes: '今日训练使用，待晾晒'
  },
  {
    id: 'HD-0003',
    number: 'HD-0003',
    name: '80mm 水带 (1号)',
    status: HOSE_STATUS.DRYING,
    location: '晾晒场 B区',
    notes: '昨日训练使用'
  },
  {
    id: 'HD-0004',
    number: 'HD-0004',
    name: '80mm 水带 (2号)',
    status: HOSE_STATUS.DRY,
    location: '检查区',
    notes: '已晾干，待归仓检查'
  },
  {
    id: 'HD-0005',
    number: 'HD-0005',
    name: '65mm 水带 (3号)',
    status: HOSE_STATUS.WET,
    location: '训练场地',
    notes: '正在使用中'
  },
  {
    id: 'HD-0006',
    number: 'HD-0006',
    name: '65mm 水带 (4号)',
    status: HOSE_STATUS.DRY,
    location: '检查区',
    notes: '已晾干'
  },
  {
    id: 'HD-0007',
    number: 'HD-0007',
    name: '80mm 水带 (3号)',
    status: HOSE_STATUS.DRYING,
    location: '晾晒场 C区',
    notes: ''
  }
]

export const SAMPLE_BORROW_RECORDS = [
  {
    id: 'BOR-0001',
    hoseId: 'HD-0002',
    borrowDate: new Date(Date.now() - 86400000).toISOString(),
    purpose: '日常训练',
    borrower: '张三',
    returnDate: new Date().toISOString()
  },
  {
    id: 'BOR-0002',
    hoseId: 'HD-0003',
    borrowDate: new Date(Date.now() - 172800000).toISOString(),
    purpose: '演练',
    borrower: '李四',
    returnDate: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'BOR-0003',
    hoseId: 'HD-0005',
    borrowDate: new Date().toISOString(),
    purpose: '技能考核',
    borrower: '王五',
    returnDate: null
  }
]

export const SAMPLE_DRYING_RECORDS = [
  {
    id: 'DRY-0001',
    hoseId: 'HD-0003',
    startDate: new Date(Date.now() - 86400000).toISOString(),
    endDate: null,
    isComplete: false
  },
  {
    id: 'DRY-0002',
    hoseId: 'HD-0004',
    startDate: new Date(Date.now() - 172800000).toISOString(),
    endDate: new Date(Date.now() - 86400000).toISOString(),
    isComplete: true
  },
  {
    id: 'DRY-0003',
    hoseId: 'HD-0006',
    startDate: new Date(Date.now() - 259200000).toISOString(),
    endDate: new Date(Date.now() - 172800000).toISOString(),
    isComplete: true
  },
  {
    id: 'DRY-0004',
    hoseId: 'HD-0007',
    startDate: new Date(Date.now() - 43200000).toISOString(),
    endDate: null,
    isComplete: false
  }
]

export class SampleDataInitializer {
  async initialize() {
    await storage.ensureInit()
    
    await storage.saveHoses(SAMPLE_HOSES)
    await storage.saveBorrowRecords(SAMPLE_BORROW_RECORDS)
    await storage.saveDryingRecords(SAMPLE_DRYING_RECORDS)
    await storage.saveProblems([])
    await storage.saveHistory([])

    await ruleEngine.addHistory('INIT_SAMPLE', '初始化示例数据')

    return {
      hoses: SAMPLE_HOSES.length,
      borrowRecords: SAMPLE_BORROW_RECORDS.length,
      dryingRecords: SAMPLE_DRYING_RECORDS.length
    }
  }

  async createImportSamples(outputDir) {
    await fs.mkdir(outputDir, { recursive: true })
    
    const hoseSample = [
      { number: 'HD-9001', name: '导入测试水带1', status: 'storage', location: '导入测试' },
      { number: 'HD-9002', name: '导入测试水带2', status: 'dry', location: '导入测试' }
    ]
    
    const borrowSample = [
      { hoseNumber: 'HD-0001', purpose: '测试导入借用', borrower: '测试员' }
    ]
    
    const dryingSample = [
      { hoseNumber: 'HD-0002', startDate: new Date().toISOString(), isComplete: false }
    ]

    await fs.writeFile(
      path.join(outputDir, 'sample-hoses.json'),
      JSON.stringify(hoseSample, null, 2)
    )
    
    await fs.writeFile(
      path.join(outputDir, 'sample-borrow.json'),
      JSON.stringify(borrowSample, null, 2)
    )
    
    await fs.writeFile(
      path.join(outputDir, 'sample-drying.json'),
      JSON.stringify(dryingSample, null, 2)
    )

    return { outputDir, files: ['sample-hoses.json', 'sample-borrow.json', 'sample-drying.json'] }
  }
}

export const sampleData = new SampleDataInitializer()
