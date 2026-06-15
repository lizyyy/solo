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
【版权口径来源】2024年版权口径第3版
【知识库链接】https://kb.example.com/article/copyright-v3
【版权说明】本素材由AI生成，参考知识库版权口径第3版执行。
【使用范围】可用于商业宣传物料、网页背景。
【注意事项】不得单独作为商标标识使用。
【脱敏状态】已完成脱敏检查，未发现敏感信息。
【导出生成时间】2024-06-01 09:30:10
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
【版权口径来源】2024年版权口径第2版
【知识库链接】https://kb.example.com/article/copyright-v2
【版权说明】本素材由AI生成，参考知识库版权口径第2版执行。
【使用范围】可用于社交媒体推广、产品详情页。
【注意事项】需标注"AI生成"字样。
【脱敏状态】⚠️ 检测到手机号未脱敏！
【问题内容】导出中包含手机号：138****5678（原始值：13812345678）
【处理建议】请算法同事复核后修正，别急着归为正常记录。
【导出生成时间】2024-06-02 14:15:10
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
    status: 'pending_review',
    knowledgeBaseLink: '',
    knowledgeBaseSource: '',
    exportContent: `【素材名称】节日活动海报模板
【提示词版本】v2.1.5
【版权口径来源】⚠️ 缺失，待知识库编辑补录
【知识库链接】⚠️ 缺失，待知识库编辑补录
【版权说明】⚠️ 知识库引用缺失，请联系知识库编辑小乔补录后再使用。
【使用范围】暂不确定，补录知识库口径后确认。
【注意事项】⚠️ 缺少版权口径，请勿直接使用。
【脱敏状态】暂未完成，待知识库引用补录后重新生成导出。
【导出生成时间】2024-06-03 10:00:05
【联系方式】如有疑问，请联系知识库编辑小乔。`,
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
        description: '未找到对应的知识库引用链接，请小乔补录',
        timestamp: '2024-06-03 10:00:05',
      },
    ],
    createdAt: '2024-06-03 10:00:00',
    updatedAt: '2024-06-03 10:00:05',
  },
];
