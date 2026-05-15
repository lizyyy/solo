const { MeetingRecord, SearchReport, CacheManager } = require('../src/models');

async function createSampleData() {
  console.log('正在创建真实部门样例数据...\n');

  await CacheManager.set('dept:信息科技部:auth_paths', [
    '/api/auth/dept-it/**',
    '/api/auth/level-2/it/*',
    '/api/auth/devops/read'
  ]);

  const meetings = [
    {
      title: '2024年Q2信息科技部季度评审会议纪要',
      department: '信息科技部',
      meetingDate: '2024-06-15',
      attendees: ['张三', '李四', '王五', '赵六'],
      summary: '本次会议审议了Q2系统升级方案，确定了三季度系统迭代计划。重点讨论了鉴权系统重构的技术路线，同意采用微服务架构进行升级。',
      attachments: []
    },
    {
      title: '关于财务系统用户权限调整的专题会议',
      department: '财务管理部',
      meetingDate: '2024-06-10',
      attendees: ['财务A', '财务B', 'IT支持'],
      summary: '会议审议了财务人员岗位调整后的权限变更申请。确定了新的权限矩阵，涉及3个岗位共12人的权限调整。',
      attachments: []
    },
    {
      title: '人力资源部薪酬管理系统上线协调会',
      department: '人力资源部',
      meetingDate: '2024-06-08',
      attendees: ['HR张', 'HR李', 'IT开发组'],
      summary: '协调薪酬系统上线前的各项准备工作，明确数据迁移方案和员工信息同步机制。',
      attachments: []
    }
  ];

  for (const meeting of meetings) {
    const record = await MeetingRecord.createRecord(meeting);
    await MeetingRecord.update(record.id, { status: 'completed', processedAt: new Date().toISOString() });
    console.log(`✓ 创建会议: ${record.title}`);
  }

  const reports = [
    {
      searchTerm: '鉴权系统重构',
      recordTitle: '2024年Q2信息科技部季度评审会议纪要',
      matchedContent: '重点讨论了鉴权系统重构的技术路线',
      confidence: 0.95
    },
    {
      searchTerm: '权限调整',
      recordTitle: '关于财务系统用户权限调整的专题会议',
      matchedContent: '审议了财务人员岗位调整后的权限变更申请',
      confidence: 0.88
    }
  ];

  for (const reportData of reports) {
    const report = await SearchReport.createReport(reportData);
    console.log(`✓ 创建搜索报告: ${report.searchTerm}`);
    console.log(`  导出摘要: ${SearchReport.generateExportSummary(report)}`);
  }

  console.log('\n✅ 样例数据创建完成！');
  console.log('\n提示: 数据已持久化到 data/ 目录，服务重启后数据仍然保留。');
}

if (require.main === module) {
  createSampleData().catch(console.error);
}

module.exports = { createSampleData };
