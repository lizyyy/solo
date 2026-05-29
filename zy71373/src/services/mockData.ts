import type { FontFile, License, Client, Channel, Project, AuditReport, RegressionCase, TodoItem } from '../types';

export const mockFonts: FontFile[] = [
  {
    id: 'font-001',
    name: 'PingFang SC Regular',
    familyName: 'PingFang SC',
    weight: 'Regular',
    version: '15.0d11e1',
    uploadDate: '2025-01-15',
    status: 'confirmed',
    uploader: '张三',
    aliases: ['苹方', 'PingFang']
  },
  {
    id: 'font-002',
    name: 'Helvetica Neue Bold',
    familyName: 'Helvetica Neue',
    weight: 'Bold',
    version: '2.000',
    uploadDate: '2025-02-20',
    status: 'confirmed',
    uploader: '李四',
    aliases: ['Helvetica']
  },
  {
    id: 'font-003',
    name: 'Source Han Sans CN Medium',
    familyName: 'Source Han Sans CN',
    weight: 'Medium',
    version: '1.004',
    uploadDate: '2025-03-10',
    status: 'temp_note',
    uploader: '王五',
    aliases: ['思源黑体', 'Noto Sans CJK SC']
  },
  {
    id: 'font-004',
    name: 'Microsoft YaHei',
    familyName: 'Microsoft YaHei',
    weight: 'Regular',
    version: '6.25',
    uploadDate: '2025-04-05',
    status: 'confirmed',
    uploader: '赵六',
    aliases: ['微软雅黑']
  },
  {
    id: 'font-005',
    name: 'DIN Alternate Bold',
    familyName: 'DIN Alternate',
    weight: 'Bold',
    version: '1.000',
    uploadDate: '2025-05-12',
    status: 'temp_note',
    uploader: '钱七',
    aliases: ['DIN']
  }
];

export const mockLicenses: License[] = [
  {
    id: 'lic-001',
    fontId: 'font-001',
    fontName: 'PingFang SC Regular',
    licensor: 'Apple Inc.',
    licenseType: '商业授权',
    startDate: '2024-01-01',
    endDate: '2026-12-31',
    allowedChannels: ['web', 'print', 'social'],
    allowedClients: ['client-001', 'client-002'],
    status: 'confirmed',
    notes: '苹果官方授权，覆盖主要客户'
  },
  {
    id: 'lic-002',
    fontId: 'font-002',
    fontName: 'Helvetica Neue Bold',
    licensor: 'Linotype',
    licenseType: '年度订阅',
    startDate: '2023-06-01',
    endDate: '2025-05-30',
    allowedChannels: ['web', 'print'],
    allowedClients: ['client-001'],
    status: 'confirmed',
    notes: '即将过期，需要续约'
  },
  {
    id: 'lic-003',
    fontId: 'font-004',
    fontName: 'Microsoft YaHei',
    licensor: 'Microsoft',
    licenseType: '随系统授权',
    startDate: '2020-01-01',
    endDate: '2099-12-31',
    allowedChannels: ['web', 'print', 'social', 'broadcast', 'merchandise'],
    allowedClients: ['client-001', 'client-002', 'client-003'],
    status: 'confirmed',
    notes: '永久授权'
  }
];

export const mockClients: Client[] = [
  {
    id: 'client-001',
    name: '恒瑞地产',
    industry: '房地产',
    contactPerson: '王经理',
    contactEmail: 'wang@hengrui.com',
    status: 'confirmed'
  },
  {
    id: 'client-002',
    name: '悦动科技',
    industry: '互联网',
    contactPerson: '李总监',
    contactEmail: 'li@yuedong.com',
    status: 'confirmed'
  },
  {
    id: 'client-003',
    name: '优鲜食品',
    industry: '快消品',
    contactPerson: '张经理',
    contactEmail: 'zhang@youxian.com',
    status: 'temp_note'
  }
];

export const mockChannels: Channel[] = [
  {
    id: 'ch-001',
    type: 'web',
    name: '官方网站',
    description: '企业官网、品牌官网',
    riskLevel: 'low',
    status: 'confirmed'
  },
  {
    id: 'ch-002',
    type: 'print',
    name: '印刷品',
    description: '海报、画册、包装等印刷物料',
    riskLevel: 'medium',
    status: 'confirmed'
  },
  {
    id: 'ch-003',
    type: 'social',
    name: '社交媒体',
    description: '微信、微博、抖音等平台',
    riskLevel: 'low',
    status: 'confirmed'
  },
  {
    id: 'ch-004',
    type: 'broadcast',
    name: '广播电视',
    description: '电视广告、视频平台广告',
    riskLevel: 'high',
    status: 'confirmed'
  },
  {
    id: 'ch-005',
    type: 'merchandise',
    name: '衍生商品',
    description: '周边产品、衍生品',
    riskLevel: 'high',
    status: 'temp_note'
  }
];

export const mockProjects: Project[] = [
  {
    id: 'proj-001',
    name: '恒瑞地产2025春季Campaign',
    clientId: 'client-001',
    clientName: '恒瑞地产',
    channelIds: ['ch-001', 'ch-002', 'ch-003'],
    channelNames: ['官方网站', '印刷品', '社交媒体'],
    fontIds: ['font-001', 'font-002'],
    fontNames: ['PingFang SC Regular', 'Helvetica Neue Bold'],
    createDate: '2025-03-01',
    auditStatus: 'risk_found',
    status: 'confirmed'
  },
  {
    id: 'proj-002',
    name: '悦动科技品牌升级',
    clientId: 'client-002',
    clientName: '悦动科技',
    channelIds: ['ch-001', 'ch-003', 'ch-004'],
    channelNames: ['官方网站', '社交媒体', '广播电视'],
    fontIds: ['font-003', 'font-004'],
    fontNames: ['Source Han Sans CN Medium', 'Microsoft YaHei'],
    createDate: '2025-04-15',
    auditStatus: 'audited',
    status: 'confirmed'
  }
];

export const mockReports: AuditReport[] = [
  {
    id: 'report-001',
    projectId: 'proj-001',
    projectName: '恒瑞地产2025春季Campaign',
    clientName: '恒瑞地产',
    createDate: '2025-03-10',
    auditor: '法务-李明',
    overallRisk: 'high',
    conclusion: '检测到高风险：Helvetica Neue Bold授权将于2025-05-30过期，且广播电视渠道未在授权范围内。',
    status: 'confirmed',
    sampleFileName: '恒瑞春季主视觉.psd',
    steps: [
      {
        id: 'step-1',
        type: 'upload',
        name: '文件上传',
        status: 'completed',
        startTime: '2025-03-10T10:00:00',
        endTime: '2025-03-10T10:00:05',
        input: { fileName: '恒瑞春季主视觉.psd', fileSize: 15240000 },
        output: { fileId: 'file-001', uploaded: true }
      },
      {
        id: 'step-2',
        type: 'recognize',
        name: '字体识别',
        status: 'completed',
        startTime: '2025-03-10T10:00:05',
        endTime: '2025-03-10T10:00:15',
        input: { fileId: 'file-001' },
        output: {
          fonts: [
            { fontId: 'font-001', confidence: 0.98 },
            { fontId: 'font-002', confidence: 0.95 }
          ]
        }
      },
      {
        id: 'step-3',
        type: 'match',
        name: '授权匹配',
        status: 'completed',
        startTime: '2025-03-10T10:00:15',
        endTime: '2025-03-10T10:00:20',
        input: { fontIds: ['font-001', 'font-002'], projectId: 'proj-001' },
        output: {
          matchedLicenses: {
            'font-001': 'lic-001',
            'font-002': 'lic-002'
          }
        }
      },
      {
        id: 'step-4',
        type: 'validate',
        name: '渠道校验',
        status: 'completed',
        startTime: '2025-03-10T10:00:20',
        endTime: '2025-03-10T10:00:25',
        input: { licenseIds: ['lic-001', 'lic-002'], channelIds: ['ch-001', 'ch-002', 'ch-003'] },
        output: {
          valid: false,
          invalidChannels: ['ch-004'],
          details: {
            'lic-002': { allowedChannels: ['web', 'print'], projectChannels: ['web', 'print', 'social', 'broadcast'] }
          }
        }
      },
      {
        id: 'step-5',
        type: 'analyze',
        name: '风险分析',
        status: 'completed',
        startTime: '2025-03-10T10:00:25',
        endTime: '2025-03-10T10:00:30',
        input: { fonts: ['font-001', 'font-002'], licenses: ['lic-001', 'lic-002'], projectId: 'proj-001' },
        output: {
          risks: [
            { type: 'expired', level: 'high', fontName: 'Helvetica Neue Bold' },
            { type: 'channel_out_of_scope', level: 'high', fontName: 'Helvetica Neue Bold' }
          ],
          overallRisk: 'high'
        }
      }
    ],
    risks: [
      {
        id: 'risk-001',
        type: 'expired',
        level: 'high',
        fontName: 'Helvetica Neue Bold',
        description: '该字体授权将于2025-05-30过期，当前项目交付时间可能跨越授权有效期。',
        suggestion: '建议立即与Linotype联系续约，或更换为已获永久授权的字体。',
        relatedEntityId: 'lic-002',
        relatedEntityType: 'license'
      },
      {
        id: 'risk-002',
        type: 'channel_out_of_scope',
        level: 'high',
        fontName: 'Helvetica Neue Bold',
        description: '项目计划在广播电视渠道投放，但该字体授权仅覆盖网站和印刷品渠道。',
        suggestion: '申请广播电视渠道的授权扩展，或在该渠道使用其他已获授权的字体。',
        relatedEntityId: 'lic-002',
        relatedEntityType: 'license'
      }
    ]
  },
  {
    id: 'report-002',
    projectId: 'proj-002',
    projectName: '悦动科技品牌升级',
    clientName: '悦动科技',
    createDate: '2025-04-20',
    auditor: '法务-王芳',
    overallRisk: 'medium',
    conclusion: '检测到中风险：Source Han Sans CN Medium为临时备注状态，需补充授权证书确认。',
    status: 'temp_note',
    sampleFileName: '悦动品牌手册_v2.pdf',
    steps: [
      {
        id: 'step-1',
        type: 'upload',
        name: '文件上传',
        status: 'completed',
        startTime: '2025-04-20T14:30:00',
        endTime: '2025-04-20T14:30:08',
        input: { fileName: '悦动品牌手册_v2.pdf', fileSize: 28500000 },
        output: { fileId: 'file-002', uploaded: true }
      },
      {
        id: 'step-2',
        type: 'recognize',
        name: '字体识别',
        status: 'completed',
        startTime: '2025-04-20T14:30:08',
        endTime: '2025-04-20T14:30:20',
        input: { fileId: 'file-002' },
        output: {
          fonts: [
            { fontId: 'font-003', confidence: 0.87 },
            { fontId: 'font-004', confidence: 0.99 }
          ]
        }
      },
      {
        id: 'step-3',
        type: 'match',
        name: '授权匹配',
        status: 'completed',
        startTime: '2025-04-20T14:30:20',
        endTime: '2025-04-20T14:30:25',
        input: { fontIds: ['font-003', 'font-004'], projectId: 'proj-002' },
        output: {
          matchedLicenses: {
            'font-003': null,
            'font-004': 'lic-003'
          }
        }
      },
      {
        id: 'step-4',
        type: 'validate',
        name: '渠道校验',
        status: 'completed',
        startTime: '2025-04-20T14:30:25',
        endTime: '2025-04-20T14:30:30',
        input: { licenseIds: ['lic-003'], channelIds: ['ch-001', 'ch-003', 'ch-004'] },
        output: {
          valid: true,
          invalidChannels: [],
          details: {
            'lic-003': { allowedChannels: ['web', 'print', 'social', 'broadcast', 'merchandise'] }
          }
        }
      },
      {
        id: 'step-5',
        type: 'analyze',
        name: '风险分析',
        status: 'completed',
        startTime: '2025-04-20T14:30:30',
        endTime: '2025-04-20T14:30:35',
        input: { fonts: ['font-003', 'font-004'], licenses: [null, 'lic-003'], projectId: 'proj-002' },
        output: {
          risks: [
            { type: 'pending_info', level: 'medium', fontName: 'Source Han Sans CN Medium' }
          ],
          overallRisk: 'medium'
        }
      }
    ],
    risks: [
      {
        id: 'risk-003',
        type: 'pending_info',
        level: 'medium',
        fontName: 'Source Han Sans CN Medium',
        description: '该字体在系统中为临时备注状态，未找到对应的授权证书记录。',
        suggestion: '请设计师或采购提供该字体的授权证书，上传至系统进行确认。',
        relatedEntityId: 'font-003',
        relatedEntityType: 'font'
      }
    ]
  }
];

export const mockRegressionCases: RegressionCase[] = [
  {
    id: 'reg-001',
    name: '授权过期检测',
    type: 'expired_license',
    description: '验证系统能否正确识别即将过期或已过期的授权证书',
    testData: {
      licenseId: 'lic-002',
      checkDate: '2025-06-01'
    },
    expectedResult: '系统应检测到授权已过期，并标记为高风险',
    lastRunDate: '2025-05-20',
    lastRunResult: 'passed',
    status: 'confirmed'
  },
  {
    id: 'reg-002',
    name: '渠道超范围检测',
    type: 'channel_out_of_scope',
    description: '验证系统能否正确识别项目使用渠道超出授权范围的情况',
    testData: {
      licenseId: 'lic-002',
      projectChannels: ['web', 'print', 'broadcast'],
      allowedChannels: ['web', 'print']
    },
    expectedResult: '系统应检测到broadcast渠道超范围，并标记为高风险',
    lastRunDate: '2025-05-20',
    lastRunResult: 'passed',
    status: 'confirmed'
  },
  {
    id: 'reg-003',
    name: '同字体改名识别',
    type: 'font_renamed',
    description: '验证系统能否通过别名匹配识别同一字体的不同名称',
    testData: {
      detectedFontName: '思源黑体',
      fontAliases: ['思源黑体', 'Noto Sans CJK SC', 'Source Han Sans CN']
    },
    expectedResult: '系统应通过别名匹配正确识别为Source Han Sans CN字体',
    lastRunDate: '2025-05-20',
    lastRunResult: 'passed',
    status: 'confirmed'
  },
  {
    id: 'reg-004',
    name: '待补资料标记',
    type: 'missing_info',
    description: '验证系统能否正确标记缺少授权证书的字体并生成待办',
    testData: {
      fontId: 'font-003',
      fontStatus: 'temp_note',
      hasLicense: false
    },
    expectedResult: '系统应标记为待补资料状态，并生成对应的待办事项',
    lastRunDate: '2025-05-20',
    lastRunResult: 'passed',
    status: 'confirmed'
  }
];

export const mockTodos: TodoItem[] = [
  {
    id: 'todo-001',
    type: 'expiring_license',
    title: 'Helvetica Neue Bold授权续约',
    description: '该字体授权将于2025-05-30过期，请联系Linotype进行续约。涉及项目：恒瑞地产2025春季Campaign。',
    relatedEntityId: 'lic-002',
    relatedEntityType: 'license',
    relatedAuditReportId: 'report-001',
    assignee: '采购-孙明',
    dueDate: '2025-05-20',
    status: 'pending',
    createDate: '2025-03-10'
  },
  {
    id: 'todo-002',
    type: 'missing_license',
    title: '补充Source Han Sans CN Medium授权证书',
    description: '该字体缺少授权证书，请设计师或采购提供并上传系统。涉及项目：悦动科技品牌升级。',
    relatedEntityId: 'font-003',
    relatedEntityType: 'font',
    relatedAuditReportId: 'report-002',
    assignee: '设计-周杰',
    dueDate: '2025-05-01',
    status: 'pending',
    createDate: '2025-04-20'
  },
  {
    id: 'todo-003',
    type: 'pending_confirmation',
    title: '确认衍生商品渠道授权范围',
    description: '衍生商品渠道目前为临时备注状态，请法务确认授权风险等级。',
    relatedEntityId: 'ch-005',
    relatedEntityType: 'channel',
    assignee: '法务-李明',
    dueDate: '2025-06-01',
    status: 'pending',
    createDate: '2025-05-01'
  }
];
