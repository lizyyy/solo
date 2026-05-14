import { db } from './database';
import { PluginVersionStatus, ReviewResult } from './types';
import { v4 as uuidv4 } from 'uuid';

async function initSampleData() {
  console.log('开始初始化测试数据...');

  const plugins = [
    { name: '代码格式化工具', description: '自动格式化代码，支持多种语言', author: 'DevTeam A', ownerId: 'team_a' },
    { name: '语法检查插件', description: '实时检查代码语法错误', author: 'DevTeam B', ownerId: 'team_b' },
    { name: '智能补全插件', description: 'AI 驱动的代码智能补全', author: 'DevTeam C', ownerId: 'team_c' },
  ];

  const createdPlugins = [];
  for (const plugin of plugins) {
    const created = await db.createPlugin(plugin);
    createdPlugins.push(created);
    console.log(`创建插件: ${plugin.name}`);
  }

  const versions = [
    { pluginIdx: 0, version: '1.0.0', status: PluginVersionStatus.DRAFT, submittedBy: 'user_a' },
    { pluginIdx: 0, version: '1.1.0', status: PluginVersionStatus.PENDING_REVIEW, submittedBy: 'user_a' },
    { pluginIdx: 1, version: '2.0.0', status: PluginVersionStatus.REVIEW_APPROVED, submittedBy: 'user_b' },
    { pluginIdx: 1, version: '2.1.0', status: PluginVersionStatus.PUBLISHED, submittedBy: 'user_b' },
    { pluginIdx: 2, version: '3.0.0', status: PluginVersionStatus.SECURITY_FAILED, submittedBy: 'user_c' },
    { pluginIdx: 2, version: '3.1.0', status: PluginVersionStatus.UNPUBLISHED, submittedBy: 'user_c' },
  ];

  for (const v of versions) {
    const plugin = createdPlugins[v.pluginIdx];
    const versionData = {
      pluginId: plugin.id,
      version: v.version,
      status: v.status,
      packageUrl: `https://cdn.example.com/packages/${plugin.name}-${v.version}.zip`,
      packageHash: uuidv4().replace(/-/g, ''),
      permissionDeclarations: [
        { id: uuidv4(), name: '文件读写', description: '读取和修改项目文件', scope: 'workspace', required: true, createdAt: new Date().toISOString() },
        { id: uuidv4(), name: '网络请求', description: '发送网络请求', scope: 'network', required: false, createdAt: new Date().toISOString() },
      ],
      submittedBy: v.submittedBy,
      submittedAt: new Date().toISOString(),
      retryCount: v.status === PluginVersionStatus.SECURITY_FAILED ? 1 : 0,
      maxRetries: 3,
    };

    const version = await db.createVersion(versionData);
    console.log(`创建版本: ${plugin.name} v${v.version} (${v.status})`);

    await db.createTimelineEvent({
      versionId: version.id,
      type: 'created',
      title: '版本已创建',
      description: `版本 ${v.version} 已创建`,
      actor: v.submittedBy,
      timestamp: new Date().toISOString(),
    });

    if (v.status !== PluginVersionStatus.DRAFT) {
      await db.createTimelineEvent({
        versionId: version.id,
        type: 'submission',
        title: '已提交审核',
        description: '版本已提交进入审核流程',
        actor: v.submittedBy,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      });

      await db.createSecurityScan({
        versionId: version.id,
        status: v.status === PluginVersionStatus.SECURITY_FAILED ? 'failed' : 'passed',
        findings: v.status === PluginVersionStatus.SECURITY_FAILED ? [
          {
            id: uuidv4(),
            severity: 'critical' as const,
            type: 'remote_code_execution',
            description: '检测到潜在的远程代码执行风险',
            location: 'src/utils/executor.js:42',
          },
        ] : [],
        startedAt: new Date(Date.now() - 7200000).toISOString(),
        completedAt: new Date(Date.now() - 3600000).toISOString(),
        scannerVersion: '2.1.0',
      });
    }

    if (v.status === PluginVersionStatus.REVIEW_APPROVED || v.status === PluginVersionStatus.PUBLISHED || v.status === PluginVersionStatus.UNPUBLISHED) {
      await db.createReviewOpinion({
        versionId: version.id,
        reviewerId: 'reviewer_001',
        reviewerName: '张审核',
        result: ReviewResult.APPROVED,
        comment: '代码质量良好，权限声明清晰，符合上架要求。',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
      });

      await db.createTimelineEvent({
        versionId: version.id,
        type: 'review_approved',
        title: '审核通过',
        description: '张审核已审核通过此版本',
        actor: '张审核',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
      });
    }

    if (v.status === PluginVersionStatus.PUBLISHED || v.status === PluginVersionStatus.UNPUBLISHED) {
      await db.updateVersionStatus(version.id, PluginVersionStatus.PUBLISHED, {
        publishedBy: 'admin',
        publishedAt: new Date(Date.now() - 900000).toISOString(),
      });

      await db.createTimelineEvent({
        versionId: version.id,
        type: 'published',
        title: '版本已上架',
        description: '管理员已将此版本上架到插件市场',
        actor: 'admin',
        timestamp: new Date(Date.now() - 900000).toISOString(),
      });
    }

    if (v.status === PluginVersionStatus.UNPUBLISHED) {
      await db.updateVersionStatus(version.id, PluginVersionStatus.UNPUBLISHED, {
        unpublishedBy: 'admin',
        unpublishedAt: new Date().toISOString(),
        unpublishedReason: '发现严重安全漏洞，需紧急下架修复',
      });

      await db.createTimelineEvent({
        versionId: version.id,
        type: 'unpublished',
        title: '版本已下架',
        description: '发现严重安全漏洞，需紧急下架修复',
        actor: 'admin',
        timestamp: new Date().toISOString(),
      });
    }
  }

  console.log('测试数据初始化完成！');
}

initSampleData().catch(console.error);
