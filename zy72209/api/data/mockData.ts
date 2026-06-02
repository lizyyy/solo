import type { CreditRecord, ImportHistory, OperationLog } from '../../shared/types';

export const mockRecords: CreditRecord[] = [
  {
    id: 'REC001',
    institutionCode: 'INS001',
    institutionNamePrev: '国泰君安',
    institutionNameCurrent: '国泰君安证券',
    nameConsistent: false,
    creditLine: 500000000,
    occupiedAmount: 280000000,
    availableAmount: 220000000,
    custodianData: {
      source: 'custodian',
      exDividendDate: '2026-06-15',
      shareRatio: 0.85,
      totalShares: 10000000,
      confirmDate: '2026-06-01',
      fileHash: 'hash_cust_001'
    },
    hasConflict: false,
    status: 'abnormal',
    importTime: '2026-06-02 09:30:00',
    updateTime: '2026-06-02 09:30:00',
    operator: '阿南',
    reviewStatus: 'pending'
  },
  {
    id: 'REC002',
    institutionCode: 'INS002',
    institutionNamePrev: '中信证券',
    institutionNameCurrent: '中信证券',
    nameConsistent: true,
    creditLine: 800000000,
    occupiedAmount: 450000000,
    availableAmount: 350000000,
    custodianData: {
      source: 'custodian',
      exDividendDate: '2026-06-20',
      shareRatio: 0.92,
      totalShares: 15000000,
      confirmDate: '2026-06-03',
      fileHash: 'hash_cust_002'
    },
    screenshotData: {
      source: 'screenshot',
      exDividendDate: '2026-06-20',
      shareRatio: 0.95,
      totalShares: 15000000,
      ocrConfidence: 0.98,
      uploadTime: '2026-06-03 11:00:00'
    },
    hasConflict: true,
    conflictFields: ['shareRatio'],
    conflictEvidence: [
      {
        field: 'shareRatio',
        fieldLabel: '配售比例',
        custodianValue: 0.92,
        screenshotValue: 0.95,
        custodianSource: '托管确认页第3页第2行',
        screenshotSource: '除权日截图右上角数据区'
      }
    ],
    status: 'conflict',
    importTime: '2026-06-03 10:00:00',
    updateTime: '2026-06-03 11:00:00',
    operator: '阿南',
    reviewStatus: 'pending'
  },
  {
    id: 'REC003',
    institutionCode: 'INS003',
    institutionNamePrev: '华泰证券',
    institutionNameCurrent: '华泰证券',
    nameConsistent: true,
    creditLine: 300000000,
    occupiedAmount: 120000000,
    availableAmount: 180000000,
    custodianData: {
      source: 'custodian',
      exDividendDate: '2026-06-18',
      shareRatio: 0.78,
      totalShares: 8000000,
      confirmDate: '2026-06-02',
      fileHash: 'hash_cust_003'
    },
    hasConflict: false,
    status: 'imported',
    importTime: '2026-06-02 14:20:00',
    updateTime: '2026-06-02 14:20:00',
    operator: '阿南',
    reviewStatus: 'pending'
  },
  {
    id: 'REC004',
    institutionCode: 'INS004',
    institutionNamePrev: '广发证券',
    institutionNameCurrent: '广发证券股份',
    nameConsistent: false,
    creditLine: 600000000,
    occupiedAmount: 380000000,
    availableAmount: 220000000,
    custodianData: {
      source: 'custodian',
      exDividendDate: '2026-06-22',
      shareRatio: 0.88,
      totalShares: 12000000,
      confirmDate: '2026-06-01',
      fileHash: 'hash_cust_004'
    },
    screenshotData: {
      source: 'screenshot',
      exDividendDate: '2026-06-22',
      shareRatio: 0.88,
      totalShares: 12000000,
      ocrConfidence: 0.96,
      uploadTime: '2026-06-02 16:30:00'
    },
    hasConflict: false,
    status: 'resolved',
    supplementFields: {
      settlementAccount: 'ACC0045678',
      settlementBank: '工商银行北京分行',
      contactPerson: '张三'
    },
    importTime: '2026-06-01 11:00:00',
    updateTime: '2026-06-02 17:00:00',
    operator: '阿南',
    reviewStatus: 'pending'
  },
  {
    id: 'REC005',
    institutionCode: 'INS005',
    institutionNamePrev: '招商证券',
    institutionNameCurrent: '招商证券',
    nameConsistent: true,
    creditLine: 450000000,
    occupiedAmount: 200000000,
    availableAmount: 250000000,
    custodianData: {
      source: 'custodian',
      exDividendDate: '2026-06-25',
      shareRatio: 0.90,
      totalShares: 9000000,
      confirmDate: '2026-06-03',
      fileHash: 'hash_cust_005'
    },
    hasConflict: false,
    status: 'imported',
    importTime: '2026-06-03 08:45:00',
    updateTime: '2026-06-03 08:45:00',
    operator: '阿南',
    reviewStatus: 'pending'
  },
  {
    id: 'REC006',
    institutionCode: 'INS006',
    institutionNamePrev: '海通证券',
    institutionNameCurrent: '海通证券',
    nameConsistent: true,
    creditLine: 700000000,
    occupiedAmount: 520000000,
    availableAmount: 180000000,
    custodianData: {
      source: 'custodian',
      exDividendDate: '2026-06-12',
      shareRatio: 0.82,
      totalShares: 20000000,
      confirmDate: '2026-05-30',
      fileHash: 'hash_cust_006'
    },
    screenshotData: {
      source: 'screenshot',
      exDividendDate: '2026-06-12',
      shareRatio: 0.82,
      totalShares: 20000000,
      ocrConfidence: 0.99,
      uploadTime: '2026-05-31 09:15:00'
    },
    hasConflict: false,
    status: 'reviewed',
    supplementFields: {
      settlementAccount: 'ACC0061234',
      settlementBank: '建设银行上海分行'
    },
    importTime: '2026-05-30 15:00:00',
    updateTime: '2026-06-01 10:30:00',
    operator: '阿南',
    reviewStatus: 'approved'
  },
  {
    id: 'REC007',
    institutionCode: 'INS007',
    institutionNamePrev: '申万宏源',
    institutionNameCurrent: '申万宏源证券',
    nameConsistent: false,
    creditLine: 250000000,
    occupiedAmount: 135000000,
    availableAmount: 115000000,
    custodianData: {
      source: 'custodian',
      exDividendDate: '2026-06-28',
      shareRatio: 0.75,
      totalShares: 6000000,
      confirmDate: '2026-06-02',
      fileHash: 'hash_cust_007'
    },
    screenshotData: {
      source: 'screenshot',
      exDividendDate: '2026-06-30',
      shareRatio: 0.75,
      totalShares: 6500000,
      ocrConfidence: 0.94,
      uploadTime: '2026-06-03 14:00:00'
    },
    hasConflict: true,
    conflictFields: ['exDividendDate', 'totalShares'],
    conflictEvidence: [
      {
        field: 'exDividendDate',
        fieldLabel: '除权日',
        custodianValue: '2026-06-28',
        screenshotValue: '2026-06-30',
        custodianSource: '托管确认页第2页第1行',
        screenshotSource: '除权日截图标题栏'
      },
      {
        field: 'totalShares',
        fieldLabel: '总股数',
        custodianValue: 6000000,
        screenshotValue: 6500000,
        custodianSource: '托管确认页第5页合计行',
        screenshotSource: '除权日截图表格末行'
      }
    ],
    status: 'conflict',
    importTime: '2026-06-02 13:00:00',
    updateTime: '2026-06-03 14:00:00',
    operator: '阿南',
    reviewStatus: 'pending'
  },
  {
    id: 'REC008',
    institutionCode: 'INS008',
    institutionNamePrev: '国信证券',
    institutionNameCurrent: '国信证券',
    nameConsistent: true,
    creditLine: 380000000,
    occupiedAmount: 190000000,
    availableAmount: 190000000,
    custodianData: {
      source: 'custodian',
      exDividendDate: '2026-06-16',
      shareRatio: 0.86,
      totalShares: 7500000,
      confirmDate: '2026-06-01',
      fileHash: 'hash_cust_008'
    },
    hasConflict: false,
    status: 'imported',
    importTime: '2026-06-01 16:30:00',
    updateTime: '2026-06-01 16:30:00',
    operator: '阿南',
    reviewStatus: 'pending'
  }
];

export const mockImportHistory: ImportHistory[] = [
  {
    id: 'IMP001',
    fileHash: 'hash_cust_001',
    fileName: '托管确认报表_20260602.xlsx',
    importTime: '2026-06-02 09:30:00',
    operator: '阿南',
    recordCount: 1
  },
  {
    id: 'IMP002',
    fileHash: 'hash_cust_002',
    fileName: '托管确认报表_20260603.xlsx',
    importTime: '2026-06-03 10:00:00',
    operator: '阿南',
    recordCount: 1
  }
];

export const mockOperationLogs: OperationLog[] = [
  {
    id: 'LOG001',
    recordId: 'REC002',
    operationType: 'screenshot_upload',
    operator: '阿南',
    operationTime: '2026-06-03 11:00:00',
    remark: '上传除权日截图，检测到配售比例冲突'
  },
  {
    id: 'LOG002',
    recordId: 'REC004',
    operationType: 'supplement',
    operator: '阿南',
    operationTime: '2026-06-02 17:00:00',
    remark: '补录结算账户信息'
  },
  {
    id: 'LOG003',
    recordId: 'REC006',
    operationType: 'review',
    operator: '财务复核人',
    operationTime: '2026-06-01 10:30:00',
    remark: '财务复核通过'
  },
  {
    id: 'LOG004',
    recordId: 'REC007',
    operationType: 'screenshot_upload',
    operator: '阿南',
    operationTime: '2026-06-03 14:00:00',
    remark: '上传除权日截图，检测到除权日和总股数两处冲突'
  }
];
