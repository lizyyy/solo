export interface SampleMeeting {
  title: string;
  date: string;
  department: string;
  attendees: string[];
  topics: string[];
  decisions: string[];
  attachments: Array<{
    fileName: string;
    fileType: string;
    uploader: string;
    content: string;
    originalInput: Record<string, any>;
  }>;
  corrections?: Array<{
    field: string;
    value: any;
    reason: string;
    corrector: string;
  }>;
  hasBrokenChain?: boolean;
  brokenReason?: string;
  searchTerms?: Array<{
    term: string;
    content: string;
  }>;
}

export const sampleMeetings: SampleMeeting[] = [
  {
    title: '2024年Q1技术研发部预算评审会议',
    date: '2024-03-15',
    department: '技术研发部',
    attendees: ['张伟', '李明', '王芳', '刘强'],
    topics: [
      'Q1预算执行情况回顾',
      '研发人员扩招计划',
      '服务器设备采购预算',
      '研发项目优先级调整',
    ],
    decisions: [
      '批准新增10名研发人员编制',
      '同意采购5台高性能服务器，预算150万',
      '优先保障AI研发项目资源',
      'Q2预算按原计划执行',
    ],
    attachments: [
      {
        fileName: 'Q1预算执行报告.pdf',
        fileType: 'application/pdf',
        uploader: '张伟',
        content: `2024年Q1预算执行情况报告

一、总体执行情况
预算总额：500万元
实际支出：420万元
执行率：84%

二、分项执行
1. 人员成本：预算300万，实际支出280万，执行率93%
2. 设备采购：预算150万，实际支出120万，执行率80%
3. 办公费用：预算30万，实际支出15万，执行率50%
4. 其他费用：预算20万，实际支出5万，执行率25%

三、存在问题
1. 服务器采购延迟，影响研发进度
2. 招聘进度滞后，人员成本结余较多`,
        originalInput: {
          source: 'OA系统-财务审批',
          approvalId: 'OA-FIN-2024-0315-001',
          submitter: '张伟',
          department: '技术研发部',
          budgetPeriod: '2024-Q1',
          totalBudget: 5000000,
          actualSpend: 4200000,
          executionRate: 0.84,
          approvalStatus: 'approved',
          approvalDate: '2024-03-14',
          approver: '财务总监-陈总',
        },
      },
      {
        fileName: '服务器采购需求清单.xlsx',
        fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        uploader: '李明',
        content: `服务器采购需求清单

序号 | 型号 | 配置 | 数量 | 单价 | 总价
1 | Dell PowerEdge R750 | 2*Intel Xeon Gold 6330, 128GB RAM, 4*2TB SSD | 3 | 250000 | 750000
2 | NVIDIA DGX A100 | 8*A100 80GB GPUs, 2TB RAM | 2 | 375000 | 750000

合计：1,500,000元`,
        originalInput: {
          source: 'IT采购系统',
          requestId: 'IT-PUR-2024-0315-002',
          requester: '李明',
          department: '技术研发部',
          totalAmount: 1500000,
          items: [
            { model: 'Dell PowerEdge R750', quantity: 3, price: 250000 },
            { model: 'NVIDIA DGX A100', quantity: 2, price: 375000 },
          ],
          expectedDelivery: '2024-04-15',
          usagePurpose: 'AI模型训练',
        },
      },
    ],
    corrections: [
      {
        field: 'meetingTitle',
        value: '2024年Q1技术研发部预算评审会议（最终版）',
        reason: '根据会议决议补充"最终版"标识，便于档案管理',
        corrector: '王芳',
      },
    ],
    searchTerms: [
      { term: '预算', content: '预算执行情况和采购预算相关内容' },
      { term: '服务器', content: '服务器采购需求清单' },
    ],
  },
  {
    title: '产品迭代规划研讨会',
    date: '2024-03-18',
    department: '产品部',
    attendees: ['周婷', '吴涛', '郑晓', '孙萌'],
    topics: [
      'V2.0版本功能规划',
      '用户反馈数据分析',
      '竞品功能对比',
      '技术可行性评估',
    ],
    decisions: [
      '确定V2.0核心功能清单',
      '优先优化用户体验相关功能',
      '计划Q3发布V2.0版本',
    ],
    attachments: [
      {
        fileName: '用户反馈分析报告.docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        uploader: '周婷',
        content: `用户反馈分析报告

一、反馈总体情况
本月收集用户反馈共328条
其中功能建议156条，Bug报告87条，使用咨询85条

二、主要问题
1. 登录流程繁琐（42条反馈）
2. 数据导出功能不完善（38条）
3. 移动端适配问题（35条）
4. 响应速度慢（28条）

三、用户满意度
整体满意度：3.8/5.0
较上月提升0.2分`,
        originalInput: {
          source: '用户反馈系统导出',
          exportId: 'FEEDBACK-EXPORT-20240318',
          period: '2024年2月',
          totalFeedbacks: 328,
          categories: {
            featureRequest: 156,
            bugReport: 87,
            consultation: 85,
          },
          satisfactionScore: 3.8,
          exportDate: '2024-03-18',
        },
      },
    ],
    searchTerms: [
      { term: '用户', content: '用户反馈和满意度分析' },
    ],
  },
  {
    title: '合规审计发现问题整改会议',
    date: '2024-03-20',
    department: '合规部',
    attendees: ['黄海', '杨梅', '林涛'],
    topics: [
      'Q1内部审计发现问题通报',
      '数据安全合规检查情况',
      '整改措施制定',
      '整改期限确定',
    ],
    decisions: [
      '成立专项整改小组',
      '4月15日前完成所有问题整改',
      '建立定期自查机制',
    ],
    attachments: [
      {
        fileName: 'Q1内部审计发现清单.pdf',
        fileType: 'application/pdf',
        uploader: '黄海',
        content: `Q1内部审计发现问题清单

1. 数据访问权限管理不规范
   - 部分离职员工账号未及时注销
   - 权限分级不明确

2. 数据加密措施不完善
   - 部分敏感数据未加密存储
   - 加密密钥管理不规范

3. 审计日志不完整
   - 部分操作未记录日志
   - 日志保存期限不足`,
        originalInput: {
          source: '内部审计系统',
          auditId: 'AUDIT-2024-Q1-001',
          auditor: '内审一组',
          auditDate: '2024-03-10',
          totalIssues: 3,
          severityLevels: {
            high: 1,
            medium: 1,
            low: 1,
          },
          status: 'pending_review',
        },
      },
    ],
    hasBrokenChain: true,
    brokenReason: '关键审批文件缺失：审计报告缺少分管领导签字页扫描件',
    corrections: [
      {
        field: 'status',
        value: 'reviewed',
        reason: '虽然证据链不完整，但根据实际审计工作完成情况更新状态',
        corrector: '杨梅',
      },
    ],
    searchTerms: [
      { term: '审计', content: '内部审计发现问题和整改要求' },
      { term: '合规', content: '合规检查和数据安全相关内容' },
    ],
  },
  {
    title: '年度员工培训计划协调会',
    date: '2024-03-22',
    department: '人力资源部',
    attendees: ['赵雪', '钱进', '孙俪'],
    topics: [
      '2024年度培训预算',
      '培训课程体系设计',
      '培训供应商筛选',
      '培训效果评估方法',
    ],
    decisions: [
      '年度培训预算核定为80万元',
      '确定三大培训模块：专业技能、管理能力、通用素养',
      '采用内部讲师+外部培训机构相结合的方式',
    ],
    attachments: [
      {
        fileName: '2024年度培训计划表.xlsx',
        fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        uploader: '赵雪',
        content: `2024年度培训计划表

一、培训预算
总预算：800,000元

二、培训模块
1. 专业技能培训：350,000元（43.75%）
2. 管理能力培训：250,000元（31.25%）
3. 通用素养培训：200,000元（25%）

三、计划培训场次
Q1: 8场
Q2: 12场
Q3: 10场
Q4: 8场
合计: 38场`,
        originalInput: {
          source: 'HR系统培训模块导出',
          planId: 'HR-TRAIN-2024-PLAN',
          creator: '赵雪',
          department: '人力资源部',
          year: 2024,
          totalBudget: 800000,
          modules: [
            { name: '专业技能培训', budget: 350000 },
            { name: '管理能力培训', budget: 250000 },
            { name: '通用素养培训', budget: 200000 },
          ],
          status: 'draft',
        },
      },
    ],
    searchTerms: [
      { term: '培训', content: '年度培训计划和预算安排' },
      { term: '预算', content: '培训预算分配情况' },
    ],
  },
];
