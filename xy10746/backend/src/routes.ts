import express, { Request, Response } from 'express';
import { db } from './database';
import { stateMachine } from './stateMachine';
import { PluginVersionStatus, ApiResponseStatus, ReviewResult, PermissionDeclaration } from './types';
import { v4 as uuidv4 } from 'uuid';
import { Parser } from 'json2csv';

const router = express.Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: '审核平台服务运行正常' });
});

router.get('/statistics', async (req: Request, res: Response) => {
  const stats = await db.getStatistics();
  res.json({
    status: ApiResponseStatus.SUCCESS,
    message: '获取统计数据成功',
    data: stats
  });
});

router.get('/plugins', async (req: Request, res: Response) => {
  const plugins = await db.getAllPlugins();
  res.json({
    status: ApiResponseStatus.SUCCESS,
    message: '获取插件列表成功',
    data: plugins
  });
});

router.post('/plugins', async (req: Request, res: Response) => {
  const { name, description, author, ownerId } = req.body;
  const plugin = await db.createPlugin({ name, description, author, ownerId });
  res.json({
    status: ApiResponseStatus.SUCCESS,
    message: '创建插件成功',
    data: plugin
  });
});

router.get('/plugins/:pluginId/versions', async (req: Request, res: Response) => {
  const { pluginId } = req.params;
  const versions = await db.getVersionsByPlugin(pluginId);
  res.json({
    status: ApiResponseStatus.SUCCESS,
    message: '获取版本列表成功',
    data: versions
  });
});

router.post('/versions', async (req: Request, res: Response) => {
  const { idempotencyKey, pluginId, version, packageUrl, packageHash, permissionDeclarations, submittedBy } = req.body;
  
  if (idempotencyKey) {
    const existingVersionId = await db.checkIdempotency(idempotencyKey);
    if (existingVersionId) {
      const existingVersion = await db.getVersion(existingVersionId);
      return res.json({
        status: ApiResponseStatus.SUCCESS,
        message: '幂等请求：版本已存在',
        data: existingVersion
      });
    }
  }

  const versionData = await db.createVersion({
    pluginId,
    version,
    status: PluginVersionStatus.DRAFT,
    packageUrl,
    packageHash,
    permissionDeclarations,
    submittedBy,
    submittedAt: new Date().toISOString()
  });

  if (idempotencyKey) {
    await db.saveIdempotencyKey(idempotencyKey, versionData.id);
  }

  await db.createTimelineEvent({
    versionId: versionData.id,
    type: 'created',
    title: '版本已创建',
    description: '新版本创建完成，当前状态为草稿',
    actor: submittedBy,
    timestamp: new Date().toISOString()
  });

  res.json({
    status: ApiResponseStatus.SUCCESS,
    message: '创建版本成功',
    data: versionData
  });
});

router.post('/versions/:versionId/submit', async (req: Request, res: Response) => {
  const { versionId } = req.params;
  const { actor } = req.body;

  const result = await stateMachine.transition(versionId, PluginVersionStatus.SUBMITTED, actor);
  
  if (result.success) {
    await stateMachine.transition(versionId, PluginVersionStatus.SECURITY_SCANNING, 'system');
    
    setTimeout(async () => {
      const version = await db.getVersion(versionId);
      if (version) {
        const hasCriticalIssues = Math.random() > 0.7;
        const findings = hasCriticalIssues ? [
          {
            id: uuidv4(),
            severity: 'critical' as const,
            type: 'remote_code_execution',
            description: '检测到潜在的远程代码执行风险',
            location: 'src/utils/executor.js:42'
          }
        ] : [];

        await db.createSecurityScan({
          versionId,
          status: hasCriticalIssues ? 'failed' : 'passed',
          findings,
          startedAt: new Date(Date.now() - 5000).toISOString(),
          completedAt: new Date().toISOString(),
          scannerVersion: '2.1.0'
        });

        await stateMachine.transition(
          versionId,
          hasCriticalIssues ? PluginVersionStatus.SECURITY_FAILED : PluginVersionStatus.SECURITY_PASSED,
          'system'
        );

        if (!hasCriticalIssues) {
          await stateMachine.transition(versionId, PluginVersionStatus.PENDING_REVIEW, 'system');
        }
      }
    }, 5000);
  }

  res.json(result);
});

router.post('/versions/:versionId/retry-scan', async (req: Request, res: Response) => {
  const { versionId } = req.params;
  const { actor } = req.body;

  const version = await db.getVersion(versionId);
  if (!version) {
    return res.json({
      status: ApiResponseStatus.BLOCKED,
      message: '版本不存在'
    });
  }

  if (version.retryCount >= version.maxRetries) {
    return res.json({
      status: ApiResponseStatus.BLOCKED,
      message: '已达到最大重试次数',
      retryAfter: -1
    });
  }

  const result = await stateMachine.transition(versionId, PluginVersionStatus.SECURITY_SCANNING, actor);

  if (result.success) {
    setTimeout(async () => {
      const findings = [];
      await db.createSecurityScan({
        versionId,
        status: 'passed',
        findings,
        startedAt: new Date(Date.now() - 3000).toISOString(),
        completedAt: new Date().toISOString(),
        scannerVersion: '2.1.0'
      });
      await stateMachine.transition(versionId, PluginVersionStatus.SECURITY_PASSED, 'system');
      await stateMachine.transition(versionId, PluginVersionStatus.PENDING_REVIEW, 'system');
    }, 3000);
  }

  res.json({
    ...result,
    retryAfter: 3
  });
});

router.get('/versions/:versionId', async (req: Request, res: Response) => {
  const { versionId } = req.params;
  const version = await db.getVersion(versionId);
  if (!version) {
    return res.json({
      status: ApiResponseStatus.BLOCKED,
      message: '版本不存在'
    });
  }

  const scans = await db.getSecurityScansByVersion(versionId);
  const reviews = await db.getReviewOpinionsByVersion(versionId);
  const timeline = await db.getTimelineByVersion(versionId);
  const plugin = await db.getPlugin(version.pluginId);

  res.json({
    status: ApiResponseStatus.SUCCESS,
    message: '获取版本详情成功',
    data: {
      version,
      plugin,
      securityScans: scans,
      reviewOpinions: reviews,
      timeline
    }
  });
});

router.post('/versions/:versionId/review', async (req: Request, res: Response) => {
  const { versionId } = req.params;
  const { reviewerId, reviewerName, result, comment, actor } = req.body;

  const version = await db.getVersion(versionId);
  if (!version) {
    return res.json({
      status: ApiResponseStatus.BLOCKED,
      message: '版本不存在'
    });
  }

  await db.createReviewOpinion({
    versionId,
    reviewerId,
    reviewerName,
    result,
    comment,
    createdAt: new Date().toISOString()
  });

  const newStatus = result === ReviewResult.APPROVED 
    ? PluginVersionStatus.REVIEW_APPROVED 
    : PluginVersionStatus.REVIEW_REJECTED;

  const transitionResult = await stateMachine.transition(versionId, newStatus, actor, comment);

  res.json(transitionResult);
});

router.post('/versions/:versionId/recheck', async (req: Request, res: Response) => {
  const { versionId } = req.params;
  const { actor } = req.body;

  const result = await stateMachine.transition(versionId, PluginVersionStatus.PENDING_RECHECK, actor, '提交版本上架复核');
  res.json(result);
});

router.post('/versions/:versionId/publish', async (req: Request, res: Response) => {
  const { versionId } = req.params;
  const { actor } = req.body;

  const version = await db.getVersion(versionId);
  if (!version) {
    return res.json({
      status: ApiResponseStatus.BLOCKED,
      message: '版本不存在'
    });
  }

  if (version.status !== PluginVersionStatus.REVIEW_APPROVED && version.status !== PluginVersionStatus.PENDING_RECHECK) {
    return res.json({
      status: ApiResponseStatus.BLOCKED,
      message: '只有审核通过或等待复核的版本才能上架'
    });
  }

  const result = await stateMachine.transition(versionId, PluginVersionStatus.PUBLISHED, actor);
  res.json(result);
});

router.post('/versions/:versionId/unpublish', async (req: Request, res: Response) => {
  const { versionId } = req.params;
  const { actor, reason } = req.body;

  const result = await stateMachine.transition(versionId, PluginVersionStatus.UNPUBLISHED, actor, reason);
  res.json(result);
});

router.post('/review-opinions/:opinionId/correct', async (req: Request, res: Response) => {
  const { opinionId } = req.params;
  const { revisedComment, revisedBy, justification, versionId } = req.body;

  const correctionPath = {
    id: uuidv4(),
    originalOpinionId: opinionId,
    revisedComment,
    revisedBy,
    revisedAt: new Date().toISOString(),
    justification
  };

  await db.updateReviewOpinionCorrection(opinionId, correctionPath);

  await db.createTimelineEvent({
    versionId,
    type: 'correction',
    title: '审核意见已修正',
    description: `修正理由：${justification}`,
    actor: revisedBy,
    timestamp: new Date().toISOString(),
    metadata: { opinionId, revisedComment }
  });

  res.json({
    status: ApiResponseStatus.SUCCESS,
    message: '审核意见修正成功',
    data: correctionPath
  });
});

router.get('/export/unpublish-records', async (req: Request, res: Response) => {
  const allVersions = await db.getAllVersions();
  const unpublishedVersions = allVersions.filter(v => v.status === PluginVersionStatus.UNPUBLISHED);

  const records = [];
  for (const version of unpublishedVersions) {
    const plugin = await db.getPlugin(version.pluginId);
    const scans = await db.getSecurityScansByVersion(version.id);
    const latestScan = scans[0];
    
    records.push({
      id: version.id,
      pluginName: plugin?.name || '未知插件',
      version: version.version,
      reason: version.unpublishedReason || '未提供原因',
      handledBy: version.unpublishedBy || '未知处理人',
      handledAt: version.unpublishedAt || version.submittedAt,
      securityScanStatus: latestScan?.status || '未扫描',
      criticalFindings: latestScan?.findings.filter((f: any) => f.severity === 'critical').length || 0,
      highFindings: latestScan?.findings.filter((f: any) => f.severity === 'high').length || 0,
      mediumFindings: latestScan?.findings.filter((f: any) => f.severity === 'medium').length || 0
    });
  }

  records.sort((a, b) => new Date(b.handledAt).getTime() - new Date(a.handledAt).getTime());

  const parser = new Parser({
    fields: [
      { label: '插件名称', value: 'pluginName' },
      { label: '版本号', value: 'version' },
      { label: '下架原因', value: 'reason' },
      { label: '处理人', value: 'handledBy' },
      { label: '处理时间', value: 'handledAt' },
      { label: '安全扫描状态', value: 'securityScanStatus' },
      { label: '严重问题数', value: 'criticalFindings' },
      { label: '高危问题数', value: 'highFindings' },
      { label: '中危问题数', value: 'mediumFindings' }
    ]
  });

  const csv = parser.parse(records);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="unpublish-records-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send('\uFEFF' + csv);
});

router.put('/versions/:versionId/permissions', async (req: Request, res: Response) => {
  const { versionId } = req.params;
  const { permissions, actor } = req.body;

  const version = await db.getVersion(versionId);
  if (!version) {
    return res.json({
      status: ApiResponseStatus.BLOCKED,
      message: '版本不存在'
    });
  }

  const updatedPermissions: PermissionDeclaration[] = permissions.map((p: any) => ({
    ...p,
    id: p.id || uuidv4(),
    createdAt: p.createdAt || new Date().toISOString()
  }));

  await db.runAsync(
    'UPDATE plugin_versions SET permissionDeclarations = ? WHERE id = ?',
    [JSON.stringify(updatedPermissions), versionId]
  );

  await db.createTimelineEvent({
    versionId,
    type: 'permission_change',
    title: '权限声明已更新',
    description: `权限声明已更新，共 ${updatedPermissions.length} 个权限`,
    actor,
    timestamp: new Date().toISOString(),
    metadata: { permissionCount: updatedPermissions.length }
  });

  if (version.status === PluginVersionStatus.PUBLISHED) {
    await stateMachine.transition(versionId, PluginVersionStatus.PENDING_RECHECK, 'system', '权限声明变更，需要重新复核');
  }

  res.json({
    status: ApiResponseStatus.SUCCESS,
    message: '权限声明更新成功',
    data: updatedPermissions
  });
});

router.get('/versions', async (req: Request, res: Response) => {
  const versions = await db.getAllVersions();
  const versionsWithPlugins = [];
  
  for (const version of versions) {
    const plugin = await db.getPlugin(version.pluginId);
    versionsWithPlugins.push({
      ...version,
      pluginName: plugin?.name,
      pluginAuthor: plugin?.author
    });
  }

  res.json({
    status: ApiResponseStatus.SUCCESS,
    message: '获取所有版本成功',
    data: versionsWithPlugins
  });
});

export default router;
