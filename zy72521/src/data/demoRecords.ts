import { CopyrightRecord } from '../types';

export const demoRecords: CopyrightRecord[] = [
  {
    id: 'rec-001',
    materialName: '古风山水背景图',
    promptVersion: 'v2.3.1',
    status: 'normal',
    knowledgeBaseLink: 'https://kb.example.com/article/copyright-v3',
    knowledgeBaseSource: '2024年版权口径第3版',
    exportContent: `【素材名称】古风山水背景图
【提示词版本】v2.3.1
【版权说明】本素材由AI生成，参考知识库版权口径第3版执行。
【使用范围】可用于商业宣传物料、网页背景。
【注意事项】不得单独作为商标标识使用。
【脱敏状态】已完成脱敏检查，未发现敏感信息。
【联系方式】如有疑问，请联系版权组。`,
    hasPhoneLeak: false,
    history: [
      {
        id: 'h-001-1',
        action: 'import_prompt',
        operator: '系统',
        description: '导入提示词版本号 v2.3.1',
        newValue: 'v2.3.1',
        timestamp: '2024-06-01 09:30:00',
      },
      {
        id: 'h-001-2',
        action: 'auto_link_kb',
        operator: '系统',
        description: '自动关联知识库引用链接',
        newValue: 'https://kb.example.com/article/copyright-v3',
        timestamp: '2024-06-01 09:30:05',
      },
      {
        id: 'h-001-3',
        action: 'generate_export',
        operator: '系统',
        description: '生成脱敏导出，检查通过',
        timestamp: '2024-06-01 09:30:10',
      },
    ],
    createdAt: '2024-06-01 09:30:00',
    updatedAt: '2024-06-01 09:30:10',
  },
  {
    id: 'rec-002',
    materialName: '科技风产品宣传图',
    promptVersion: 'v2.2.0',
    status: 'pending_review',
    knowledgeBaseLink: 'https://kb.example.com/article/copyright-v2',
    knowledgeBaseSource: '2024年版权口径第2版',
    exportContent: `【素材名称】科技风产品宣传图
【提示词版本】v2.2.0
【版权说明】本素材由AI生成，参考知识库版权口径第2版执行。
【使用范围】可用于社交媒体推广、产品详情页。
【注意事项】需标注"AI生成"字样。
【脱敏状态】⚠️ 检测到手机号未脱敏！
【问题内容】导出中包含手机号：138****5678
【处理建议】请算法同事复核后修正。
【联系方式】版权组 张经理`,
    hasPhoneLeak: true,
    leakedPhone: '13812345678',
    history: [
      {
        id: 'h-002-1',
        action: 'import_prompt',
        operator: '系统',
        description: '导入提示词版本号 v2.2.0',
        newValue: 'v2.2.0',
        timestamp: '2024-06-02 14:15:00',
      },
      {
        id: 'h-002-2',
        action: 'auto_link_kb',
        operator: '系统',
        description: '自动关联知识库引用链接',
        newValue: 'https://kb.example.com/article/copyright-v2',
        timestamp: '2024-06-02 14:15:05',
      },
      {
        id: 'h-002-3',
        action: 'generate_export',
        operator: '系统',
        description: '生成脱敏导出',
        timestamp: '2024-06-02 14:15:10',
      },
      {
        id: 'h-002-4',
        action: 'detect_phone_leak',
        operator: '系统',
        description: '检测到手机号在导出里漏遮',
        oldValue: '无',
        newValue: '手机号 138****5678 未脱敏',
        timestamp: '2024-06-02 14:15:11',
      },
      {
        id: 'h-002-5',
        action: 'pending_algorithm_review',
        operator: '系统',
        description: '已转交算法同事复核，暂不归为正常记录',
        timestamp: '2024-06-02 14:15:12',
      },
    ],
    createdAt: '2024-06-02 14:15:00',
    updatedAt: '2024-06-02 14:15:12',
  },
  {
    id: 'rec-003',
    materialName: '节日活动海报模板',
    promptVersion: 'v2.1.5',
    status: 'supplemented',
    knowledgeBaseLink: 'https://kb.example.com/article/copyright-v1-legacy',
    knowledgeBaseSource: '2023年版权口径第1版（旧口径补录）',
    exportContent: `【素材名称】节日活动海报模板
【提示词版本】v2.1.5
【版权说明】本素材由AI生成，参考知识库2023年旧口径执行。
【使用范围】可用于内部活动宣传、节日祝福海报。
【注意事项】旧口径素材建议尽快更新到最新版本。
【补录说明】知识库引用由小乔于2024-06-03补录，来源为历史归档文档。
【脱敏状态】已完成脱敏检查，未发现敏感信息。
【联系方式】如有疑问，请联系版权组。`,
    hasPhoneLeak: false,
    history: [
      {
        id: 'h-003-1',
        action: 'import_prompt',
        operator: '系统',
        description: '导入提示词版本号 v2.1.5',
        newValue: 'v2.1.5',
        timestamp: '2024-06-03 10:00:00',
      },
      {
        id: 'h-003-2',
        action: 'kb_missing',
        operator: '系统',
        description: '未找到对应的知识库引用链接',
        timestamp: '2024-06-03 10:00:05',
      },
      {
        id: 'h-003-3',
        action: 'supplement_kb',
        operator: '小乔',
        description: '补录知识库引用链接（从历史归档文档查找）',
        oldValue: '无',
        newValue: 'https://kb.example.com/article/copyright-v1-legacy',
        timestamp: '2024-06-03 10:20:00',
      },
      {
        id: 'h-003-4',
        action: 'rerun_export',
        operator: '小乔',
        description: '补录后重新生成脱敏导出',
        timestamp: '2024-06-03 10:20:30',
      },
      {
        id: 'h-003-5',
        action: 'mark_supplemented',
        operator: '系统',
        description: '标记为已补录记录',
        timestamp: '2024-06-03 10:20:31',
      },
    ],
    createdAt: '2024-06-03 10:00:00',
    updatedAt: '2024-06-03 10:20:31',
  },
];
