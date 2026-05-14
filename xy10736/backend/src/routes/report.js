const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const XLSX = require('xlsx');
const { format } = require('date-fns');

router.get('/acceptance/:sessionId', async (req, res) => {
  const session = await prisma.debugSession.findUnique({
    where: { sessionId: req.params.sessionId },
    include: {
      pageEvents: { include: { trackingPoint: true } },
      missingDetections: { include: { trackingPoint: true, reviewLogs: true } }
    }
  });

  if (!session) {
    return res.status(404).json({ error: '会话不存在' });
  }

  const totalPoints = await prisma.trackingPoint.count({
    where: { version: session.version, status: 'active' }
  });

  const receivedCodes = new Set(session.pageEvents.map(e => e.trackingCode));
  const successCount = receivedCodes.size;
  const missingCount = session.missingDetections.filter(d => d.status !== 'dismissed').length;
  const passRate = totalPoints > 0 ? ((successCount / totalPoints) * 100).toFixed(1) : 0;

  const report = {
    报告标题: '埋点验收报告',
    报告版本: '1.0',
    生成时间: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    验收基本信息: {
      版本号: session.version,
      测试会话ID: session.sessionId,
      操作人员: session.operator || '系统',
      开始时间: format(session.startTime, 'yyyy-MM-dd HH:mm:ss'),
      结束时间: session.endTime ? format(session.endTime, 'yyyy-MM-dd HH:mm:ss') : '进行中',
      会话状态: getStatusText(session.status)
    },
    验收统计概览: {
      应埋点总数: totalPoints,
      已收到事件数: successCount,
      漏报事件数: missingCount,
      通过率: `${passRate}%`,
      验收结果: passRate >= 95 ? '通过' : '不通过'
    },
    已收到的埋点事件: session.pageEvents.map(e => ({
      埋点编码: e.trackingCode,
      埋点名称: e.trackingPoint?.name || '未知',
      所属页面: e.trackingPoint?.page || '未知',
      触发页面: e.pageUrl,
      用户ID: e.userId || '-',
      触发时间: format(e.timestamp, 'yyyy-MM-dd HH:mm:ss'),
      状态: getEventStatusText(e.status),
      重试次数: e.retryCount
    })),
    漏报检测记录: session.missingDetections.map(d => ({
      埋点编码: d.trackingCode,
      埋点名称: d.trackingPoint?.name || '未知',
      所属页面: d.trackingPoint?.page || '未知',
      检测时间: format(d.detectedAt, 'yyyy-MM-dd HH:mm:ss'),
      状态: getDetectionStatusText(d.status),
      漏报原因: d.reason || '待确认',
      解决方案: d.resolution || '-',
      处理人: d.resolvedBy || '-',
      处理时间: d.resolvedAt ? format(d.resolvedAt, 'yyyy-MM-dd HH:mm:ss') : '-'
    })),
    修正路径复盘: session.missingDetections
      .filter(d => d.correctionPath)
      .map(d => ({
        埋点编码: d.trackingCode,
        埋点名称: d.trackingPoint?.name || '未知',
        修正步骤: formatCorrectionPath(d.correctionPath),
        复盘日志: d.reviewLogs?.map(l => 
          `[${format(l.createdAt, 'yyyy-MM-dd HH:mm:ss')}] ${l.operator || '系统'}: ${l.action} - ${l.reason}`
        ).join('\n') || '-'
      })),
    版本复核信息: {
      复核结论: passRate >= 95 ? '允许发布' : '需修复后重新验收',
      建议: getSuggestions(passRate, missingCount, session.missingDetections)
    }
  };

  res.json(report);
});

router.get('/acceptance/:sessionId/excel', async (req, res) => {
  const session = await prisma.debugSession.findUnique({
    where: { sessionId: req.params.sessionId },
    include: {
      pageEvents: { include: { trackingPoint: true } },
      missingDetections: { include: { trackingPoint: true } }
    }
  });

  const totalPoints = await prisma.trackingPoint.count({
    where: { version: session.version, status: 'active' }
  });

  const receivedCodes = new Set(session.pageEvents.map(e => e.trackingCode));
  const passRate = totalPoints > 0 ? ((receivedCodes.size / totalPoints) * 100).toFixed(1) : 0;

  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['埋点验收报告'],
    ['生成时间', format(new Date(), 'yyyy-MM-dd HH:mm:ss')],
    ['版本号', session.version],
    ['测试会话ID', session.sessionId],
    ['应埋点总数', totalPoints],
    ['已收到事件数', receivedCodes.size],
    ['漏报事件数', session.missingDetections.length],
    ['通过率', `${passRate}%`],
    ['验收结果', passRate >= 95 ? '通过' : '不通过']
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), '概览');

  const eventsData = [
    ['埋点编码', '埋点名称', '所属页面', '触发页面', '触发时间', '状态']
  ].concat(session.pageEvents.map(e => [
    e.trackingCode,
    e.trackingPoint?.name || '未知',
    e.trackingPoint?.page || '未知',
    e.pageUrl,
    format(e.timestamp, 'yyyy-MM-dd HH:mm:ss'),
    getEventStatusText(e.status)
  ]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(eventsData), '已收到事件');

  const missingData = [
    ['埋点编码', '埋点名称', '所属页面', '检测时间', '状态', '漏报原因', '解决方案']
  ].concat(session.missingDetections.map(d => [
    d.trackingCode,
    d.trackingPoint?.name || '未知',
    d.trackingPoint?.page || '未知',
    format(d.detectedAt, 'yyyy-MM-dd HH:mm:ss'),
    getDetectionStatusText(d.status),
    d.reason || '待确认',
    d.resolution || '-'
  ]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(missingData), '漏报记录');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="埋点验收报告_${session.version}_${format(new Date(), 'yyyyMMdd')}.xlsx"`);
  res.send(buffer);
});

function getStatusText(status) {
  const map = { active: '进行中', completed: '已完成', cancelled: '已取消' };
  return map[status] || status;
}

function getEventStatusText(status) {
  const map = { received: '已接收', validated: '已验证', processed: '已处理', failed: '失败' };
  return map[status] || status;
}

function getDetectionStatusText(status) {
  const map = { pending: '待确认', confirmed: '已确认', resolved: '已解决', dismissed: '已忽略' };
  return map[status] || status;
}

function formatCorrectionPath(path) {
  if (!path) return '-';
  if (Array.isArray(path)) {
    return path.map((step, i) => `${i + 1}. ${step.description || step}`).join('\n');
  }
  return JSON.stringify(path, null, 2);
}

function getSuggestions(passRate, missingCount, detections) {
  const suggestions = [];
  if (passRate < 95) {
    suggestions.push('当前通过率低于95%，建议修复漏报问题后重新进行验收测试。');
  }
  const confirmedMissing = detections.filter(d => d.status === 'confirmed').length;
  if (confirmedMissing > 0) {
    suggestions.push(`有${confirmedMissing}个漏报已确认，请优先处理核心流程相关埋点。`);
  }
  if (suggestions.length === 0) {
    suggestions.push('验收情况良好，建议保持现有质量标准。');
  }
  return suggestions.join('\n');
}

module.exports = router;
