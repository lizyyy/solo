import { v4 as uuidv4 } from 'uuid';
import { storageService } from './storage.js';

export async function initSampleData() {
  const sampleUsers = generateSampleUsers();
  const sampleSegments = generateSampleSegments();
  const sampleFlags = generateSampleFlags(sampleSegments);
  
  await storageService.saveUsers(sampleUsers);
  await storageService.saveSegments(sampleSegments);
  await storageService.saveFlags(sampleFlags);
  await storageService.saveAuditLogs([]);

  console.log('Sample data initialized successfully!');
  console.log(`- Users: ${sampleUsers.length}`);
  console.log(`- Segments: ${sampleSegments.length}`);
  console.log(`- Flags: ${sampleFlags.length}`);
}

function generateSampleUsers() {
  const regions = ['CN', 'US', 'JP', 'UK', 'DE', 'FR', 'IN', 'BR'];
  const accountTypes = ['free', 'pro', 'enterprise', 'trial'];
  const tagOptions = ['new_user', 'active', 'inactive', 'premium', 'beta_tester', 'early_adopter'];
  
  const names = [
    '张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十',
    'Alice Smith', 'Bob Johnson', 'Charlie Brown', 'Diana Wilson',
    'Edward Davis', 'Fiona Garcia', 'George Martinez', 'Hannah Anderson',
    '田中太郎', '山田花子', '佐藤健', '铃木美香',
    'Hans Mueller', 'Anna Schmidt', 'Pierre Dubois', 'Marie Martin'
  ];

  const users = names.map((name, index) => {
    const id = uuidv4();
    const isChinese = /[\u4e00-\u9fa5]/.test(name);
    
    return {
      id,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}${index + 1}@example.com`,
      region: regions[Math.floor(Math.random() * regions.length)],
      accountType: accountTypes[Math.floor(Math.random() * accountTypes.length)],
      tags: generateRandomTags(tagOptions),
      registerDays: Math.floor(Math.random() * 365),
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
    };
  });

  users[0].region = 'CN';
  users[0].accountType = 'pro';
  users[0].tags = ['active', 'beta_tester'];
  users[0].registerDays = 180;

  users[1].region = 'CN';
  users[1].accountType = 'free';
  users[1].tags = ['new_user'];
  users[1].registerDays = 5;

  users[2].region = 'US';
  users[2].accountType = 'enterprise';
  users[2].tags = ['premium', 'active'];
  users[2].registerDays = 360;

  return users;
}

function generateRandomTags(options) {
  const numTags = Math.floor(Math.random() * 3);
  const tags = [];
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < numTags; i++) {
    tags.push(shuffled[i]);
  }
  
  return tags;
}

function generateSampleSegments() {
  const segments = [
    {
      id: uuidv4(),
      name: '中国用户',
      description: '所有位于中国地区的用户',
      conditions: [
        {
          field: 'region',
          operator: 'equals',
          value: 'CN'
        }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: uuidv4(),
      name: '付费用户',
      description: '所有 Pro 和 Enterprise 级别的用户',
      conditions: [
        {
          field: 'accountType',
          operator: 'in',
          value: ['pro', 'enterprise']
        }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: uuidv4(),
      name: '新用户 (7天内)',
      description: '注册时间不超过7天的新用户',
      conditions: [
        {
          field: 'registerDays',
          operator: 'less_than_or_equals',
          value: 7
        }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: uuidv4(),
      name: '老用户 (90天+)',
      description: '注册超过90天的老用户',
      conditions: [
        {
          field: 'registerDays',
          operator: 'greater_than_or_equals',
          value: 90
        }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: uuidv4(),
      name: 'Beta 测试用户',
      description: '带有 beta_tester 标签的用户',
      conditions: [
        {
          field: 'tags',
          operator: 'has_tag',
          value: 'beta_tester'
        }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: uuidv4(),
      name: '中国付费老用户',
      description: '中国地区的付费老用户组合条件',
      conditions: [
        {
          field: 'region',
          operator: 'equals',
          value: 'CN'
        },
        {
          field: 'accountType',
          operator: 'in',
          value: ['pro', 'enterprise']
        },
        {
          field: 'registerDays',
          operator: 'greater_than_or_equals',
          value: 30
        }
      ],
      createdAt: new Date().toISOString()
    }
  ];

  return segments;
}

function generateSampleFlags(segments) {
  const chinaSegment = segments.find(s => s.name === '中国用户');
  const paidSegment = segments.find(s => s.name === '付费用户');
  const newUserSegment = segments.find(s => s.name === '新用户 (7天内)');
  const betaSegment = segments.find(s => s.name === 'Beta 测试用户');

  const flags = [
    {
      id: uuidv4(),
      key: 'new_dashboard_v2',
      name: '新版仪表盘 v2',
      description: '全新设计的仪表盘界面，包含更多数据可视化组件',
      enabled: true,
      killSwitch: false,
      segments: [],
      percentage: 50,
      dependsOn: [],
      createdAt: new Date().toISOString()
    },
    {
      id: uuidv4(),
      key: 'dark_mode_support',
      name: '深色模式支持',
      description: '为应用添加深色模式切换功能',
      enabled: true,
      killSwitch: false,
      segments: paidSegment ? [paidSegment.id] : [],
      percentage: null,
      dependsOn: [],
      createdAt: new Date().toISOString()
    },
    {
      id: uuidv4(),
      key: 'ai_smart_search',
      name: 'AI 智能搜索',
      description: '基于 AI 的智能搜索功能，支持自然语言查询',
      enabled: true,
      killSwitch: false,
      segments: betaSegment ? [betaSegment.id] : [],
      percentage: 10,
      dependsOn: ['dark_mode_support'],
      createdAt: new Date().toISOString()
    },
    {
      id: uuidv4(),
      key: 'onboarding_redesign',
      name: '新手引导重设计',
      description: '重新设计的新手引导流程，帮助新用户更快上手',
      enabled: true,
      killSwitch: false,
      segments: newUserSegment ? [newUserSegment.id] : [],
      percentage: null,
      dependsOn: [],
      createdAt: new Date().toISOString()
    },
    {
      id: uuidv4(),
      key: 'china_region_exclusive',
      name: '中国区专属功能',
      description: '仅对中国区域用户开放的功能',
      enabled: true,
      killSwitch: false,
      segments: chinaSegment ? [chinaSegment.id] : [],
      percentage: null,
      dependsOn: [],
      createdAt: new Date().toISOString()
    },
    {
      id: uuidv4(),
      key: 'emergency_feature',
      name: '紧急功能 (带 Kill Switch)',
      description: '这是一个带有 Kill Switch 的功能，可用于紧急情况下的快速关闭',
      enabled: true,
      killSwitch: true,
      segments: [],
      percentage: 100,
      dependsOn: [],
      createdAt: new Date().toISOString()
    },
    {
      id: uuidv4(),
      key: 'disabled_feature',
      name: '已禁用的功能',
      description: '这个功能已经全局关闭，用于测试关闭状态',
      enabled: false,
      killSwitch: false,
      segments: [],
      percentage: 100,
      dependsOn: [],
      createdAt: new Date().toISOString()
    }
  ];

  return flags;
}

export { generateSampleUsers, generateSampleSegments, generateSampleFlags };
