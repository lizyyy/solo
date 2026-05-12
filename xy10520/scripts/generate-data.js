const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeJson(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  生成: ${filename}`);
}

ensureDir(DATA_DIR);

console.log('\n生成样例数据...\n');

const stores = [
  {
    id: 'store_001',
    code: 'SH001',
    name: '上海南京路店',
    manager: '李明',
    phone: '13800138001',
    address: '上海市黄浦区南京东路100号',
    region: '华东区'
  },
  {
    id: 'store_002',
    code: 'BJ001',
    name: '北京王府井店',
    manager: '王芳',
    phone: '13800138002',
    address: '北京市东城区王府井大街50号',
    region: '华北区'
  },
  {
    id: 'store_003',
    code: 'GZ001',
    name: '广州天河城店',
    manager: '张伟',
    phone: '13800138003',
    address: '广州市天河区天河路208号',
    region: '华南区'
  }
];
writeJson('stores.json', stores);

const inspections = [
  {
    id: 'inspect_001',
    storeId: 'store_001',
    inspectionDate: '2026-05-10',
    inspector: '张督导',
    remark: '常规巡店'
  },
  {
    id: 'inspect_002',
    storeId: 'store_002',
    inspectionDate: '2026-05-11',
    inspector: '李督导',
    remark: '月度检查'
  }
];
writeJson('inspections.json', inspections);

const issues = [
  {
    id: 'issue_001',
    inspectionId: 'inspect_001',
    category: '陈列',
    description: '货架第三层商品陈列不整齐，部分商品正面未朝向顾客',
    severity: '普通',
    dueDays: 3,
    photoUrls: [
      'https://example.com/photos/inspect_001_display_1.jpg',
      'https://example.com/photos/inspect_001_display_2.jpg'
    ],
    remark: '需要重新理货'
  },
  {
    id: 'issue_002',
    inspectionId: 'inspect_001',
    category: '卫生',
    description: '冷柜底部有积冰和积水，影响制冷效果',
    severity: '严重',
    dueDays: 2,
    photoUrls: [
      'https://example.com/photos/inspect_001_clean_1.jpg'
    ],
    remark: '需立即清理'
  },
  {
    id: 'issue_003',
    inspectionId: 'inspect_002',
    category: '价格牌',
    description: '牛奶促销区价格牌与实际售价不符，相差5元',
    severity: '普通',
    dueDays: 3,
    photoUrls: [
      'https://example.com/photos/inspect_002_price_1.jpg'
    ],
    remark: '需更新价格标签'
  },
  {
    id: 'issue_004',
    inspectionId: 'inspect_002',
    category: '安全隐患',
    description: '消防通道被杂物堵塞，影响紧急疏散',
    severity: '严重',
    dueDays: 1,
    photoUrls: [
      'https://example.com/photos/inspect_002_safety_1.jpg'
    ],
    remark: '必须立即整改'
  }
];
writeJson('issues.json', issues);

const correctionsSuccess = [
  {
    issueId: 'issue_001',
    description: '已重新整理货架第三层商品，所有商品正面朝向顾客，陈列整齐',
    photoUrls: [
      'https://example.com/photos/corr_001_1.jpg',
      'https://example.com/photos/corr_001_2.jpg'
    ],
    submittedBy: '李明（上海南京路店店长）'
  },
  {
    issueId: 'issue_002',
    description: '已断电清理冷柜底部积冰，并用干抹布擦干，冷柜已恢复正常工作',
    photoUrls: [
      'https://example.com/photos/corr_002_1.jpg'
    ],
    submittedBy: '李明（上海南京路店店长）'
  }
];
writeJson('corrections-success.json', correctionsSuccess);

const correctionsFailNoPhoto = [
  {
    issueId: 'issue_003',
    description: '已更新价格牌，现在与系统价格一致',
    photoUrls: [],
    submittedBy: '王芳（北京王府井店店长）'
  }
];
writeJson('corrections-fail-no-photo.json', correctionsFailNoPhoto);

const correctionsIssue003 = [
  {
    issueId: 'issue_003',
    description: '已更新价格牌，现在与系统价格一致',
    photoUrls: [
      'https://example.com/photos/corr_003_1.jpg'
    ],
    submittedBy: '王芳（北京王府井店店长）'
  }
];
writeJson('corrections-issue-003.json', correctionsIssue003);

const reinspections = [
  {
    issueId: 'issue_001',
    inspector: '张督导',
    result: '通过',
    comment: '整改到位，货架陈列整齐',
    photoUrls: [
      'https://example.com/photos/reinspect_001_1.jpg'
    ]
  },
  {
    issueId: 'issue_002',
    inspector: '张督导',
    result: '通过',
    comment: '冷柜已清理干净，制冷正常',
    photoUrls: [
      'https://example.com/photos/reinspect_002_1.jpg'
    ]
  },
  {
    issueId: 'issue_003',
    inspector: '李督导',
    result: '不通过',
    comment: '价格牌只更新了一张，其他位置仍有错误',
    photoUrls: [
      'https://example.com/photos/reinspect_003_fail.jpg'
    ]
  }
];
writeJson('reinspections.json', reinspections);

const duplicateIssues = [
  {
    id: 'issue_001_dup',
    inspectionId: 'inspect_001',
    category: '陈列',
    description: '货架第三层商品陈列不整齐，部分商品正面未朝向顾客',
    severity: '普通',
    dueDays: 3,
    photoUrls: [
      'https://example.com/photos/dup_1.jpg'
    ]
  }
];
writeJson('duplicate-issues.json', duplicateIssues);

console.log('\n样例数据生成完成！\n');
