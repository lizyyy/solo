import express from 'express';
import path from 'path';
import fs from 'fs';
import {
  initDB,
  getDisputes,
  getDispute,
  getEvidences,
  getBatches,
  getBatch,
  createBatch,
  updateBatchStatus,
  addAccessRecord,
  getAccessRecords,
  reauthorizeBatch,
  addEvidence,
  seedTestData,
  generateHash,
  generateBatchZip,
  getEvidence
} from './database';
import { ValidationResult, Evidence, ExportBatch } from '../shared/types';

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

const downloadsDir = path.join(__dirname, '../downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

const REQUIRED_EVIDENCE_TYPES = ['order_screenshot', 'chat_history', 'operation_log', 'contract'];

app.get('/api/disputes', async (req, res) => {
  try {
    const disputes = await getDisputes();
    res.json(disputes);
  } catch (error) {
    res.status(500).json({ error: '获取争议单列表失败' });
  }
});

app.get('/api/disputes/:id', async (req, res) => {
  try {
    const dispute = await getDispute(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: '争议单不存在' });
    }
    const evidences = await getEvidences(req.params.id);
    const batches = await getBatches(req.params.id);
    
    const existingTypes = evidences.map(e => e.type);
    const missingTypes = REQUIRED_EVIDENCE_TYPES.filter(t => !existingTypes.includes(t));
    
    const validation: ValidationResult = {
      isValid: missingTypes.length === 0,
      missingEvidence: missingTypes,
      hashMismatch: []
    };

    res.json({
      dispute,
      evidences,
      batches,
      validation
    });
  } catch (error) {
    res.status(500).json({ error: '获取争议单详情失败' });
  }
});

app.post('/api/disputes/:id/evidences', async (req, res) => {
  try {
    const { type, name, source, content } = req.body;
    const evidence = await addEvidence(req.params.id, type, name, source, content);
    res.json(evidence);
  } catch (error) {
    res.status(500).json({ error: '添加证据失败' });
  }
});

app.get('/api/disputes/:id/validate', async (req, res) => {
  try {
    const evidences = await getEvidences(req.params.id);
    const existingTypes = evidences.map(e => e.type);
    const missingTypes = REQUIRED_EVIDENCE_TYPES.filter(t => !existingTypes.includes(t));
    
    const hashMismatch: string[] = [];
    if (req.body && req.body.verifyContent) {
      for (const ev of evidences) {
        const currentHash = generateHash(req.body.verifyContent[ev.id] || '');
        if (currentHash !== ev.hash) {
          hashMismatch.push(ev.id);
        }
      }
    }

    const validation: ValidationResult = {
      isValid: missingTypes.length === 0 && hashMismatch.length === 0,
      missingEvidence: missingTypes,
      hashMismatch
    };

    res.json(validation);
  } catch (error) {
    res.status(500).json({ error: '校验失败' });
  }
});

app.post('/api/disputes/:id/export', async (req, res) => {
  try {
    const { evidenceIds, operator } = req.body;
    const allEvidences = await getEvidences(req.params.id);
    const selectedEvidences = allEvidences.filter(e => evidenceIds.includes(e.id));
    const existingTypes = allEvidences.map(e => e.type);
    const missingTypes = REQUIRED_EVIDENCE_TYPES.filter(t => !existingTypes.includes(t));

    if (missingTypes.length > 0) {
      return res.status(400).json({ 
        error: '材料缺失，无法导出',
        missingEvidence: missingTypes
      });
    }

    const batches = await getBatches(req.params.id);
    const validBatch = batches.find(b => {
      const sameEvidence = b.evidenceIds.length === evidenceIds.length && 
        b.evidenceIds.every((id: string) => evidenceIds.includes(id));
      return sameEvidence && b.status === 'ready' && new Date(b.expiresAt) > new Date();
    });

    if (validBatch) {
      await addAccessRecord(validBatch.id, operator || 'system', 'download');
      return res.json({ batch: validBatch, reused: true });
    }

    const batch = await createBatch(req.params.id, evidenceIds);
    await updateBatchStatus(batch.id, 'packing');

    setImmediate(async () => {
      try {
        const downloadUrl = await generateBatchZip(batch.id, selectedEvidences);
        await updateBatchStatus(batch.id, 'ready', downloadUrl);
      } catch (err) {
        console.error('打包失败:', err);
        await updateBatchStatus(batch.id, 'pending');
      }
    });

    res.json({ batch, reused: false });
  } catch (error) {
    console.error('导出失败:', error);
    res.status(500).json({ error: '创建导出批次失败' });
  }
});

app.get('/api/batches/:id/access-records', async (req, res) => {
  try {
    const records = await getAccessRecords(req.params.id);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: '获取领取记录失败' });
  }
});

app.post('/api/batches/:id/reauthorize', async (req, res) => {
  try {
    const batch = await reauthorizeBatch(req.params.id);
    await addAccessRecord(req.params.id, req.body.operator || 'system', 'reauthorize');
    res.json(batch);
  } catch (error) {
    console.error('重新授权失败:', error);
    res.status(500).json({ error: '重新授权失败' });
  }
});

app.get('/api/downloads/:filename', async (req, res) => {
  const filePath = path.join(downloadsDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    const batchId = req.params.filename.replace('.zip', '');
    await addAccessRecord(batchId, (req.query.operator as string) || 'anonymous', 'download');
    res.download(filePath);
  } else {
    res.status(404).json({ error: '文件不存在' });
  }
});

app.get('/api/disputes/:id/report', async (req, res) => {
  try {
    const evidences = await getEvidences(req.params.id);
    const batches = await getBatches(req.params.id);
    const dispute = await getDispute(req.params.id);
    
    if (!dispute) {
      return res.status(404).json({ error: '争议单不存在' });
    }

    const report = generateFullReport(dispute, evidences, batches);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="争议单_${dispute.orderId}_报告.txt"`);
    res.send(report);
  } catch (error) {
    res.status(500).json({ error: '生成报告失败' });
  }
});

function generateFullReport(dispute: any, evidences: Evidence[], batches: ExportBatch[]): string {
  let report = '='.repeat(80) + '\n';
  report += '                      争议单完整报告\n';
  report += '='.repeat(80) + '\n\n';

  report += '【争议单信息】\n';
  report += `  订单编号: ${dispute.orderId}\n`;
  report += `  客户名称: ${dispute.customerName}\n`;
  report += `  当前状态: ${getStatusText(dispute.status)}\n`;
  report += `  创建时间: ${new Date(dispute.createdAt).toLocaleString('zh-CN')}\n`;
  report += `  更新时间: ${new Date(dispute.updatedAt).toLocaleString('zh-CN')}\n\n`;

  report += '【证据目录】\n';
  const typeMap: Record<string, string> = {
    order_screenshot: '订单截图',
    chat_history: '聊天记录',
    operation_log: '操作日志',
    contract: '合同附件',
    other: '其他材料'
  };

  evidences.forEach((ev, idx) => {
    report += `  ${idx + 1}. ${ev.name} (${typeMap[ev.type] || ev.type})\n`;
    report += `     来源: ${ev.source} | 大小: ${ev.fileSize} bytes\n`;
    report += `     SHA256: ${ev.hash}\n\n`;
  });

  const existingTypes = evidences.map(e => e.type);
  const missingTypes = REQUIRED_EVIDENCE_TYPES.filter(t => !existingTypes.includes(t));
  if (missingTypes.length > 0) {
    report += '【缺失材料提醒】\n';
    missingTypes.forEach(t => {
      report += `  ⚠️  缺少: ${typeMap[t] || t}\n`;
    });
    report += '\n';
  }

  report += '【导出批次记录】\n';
  batches.forEach((batch, idx) => {
    report += `  批次 ${idx + 1}: ${batch.id}\n`;
    report += `     状态: ${getBatchStatusText(batch.status)} | 证据数: ${batch.evidenceIds.length}\n`;
    report += `     创建时间: ${new Date(batch.createdAt).toLocaleString('zh-CN')}\n`;
    report += `     过期时间: ${new Date(batch.expiresAt).toLocaleString('zh-CN')}\n\n`;
  });

  report += '='.repeat(80) + '\n';
  report += '报告生成时间: ' + new Date().toLocaleString('zh-CN') + '\n';
  report += '='.repeat(80) + '\n';

  return report;
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    ready: '已就绪',
    expired: '已过期',
    completed: '已完成'
  };
  return map[status] || status;
}

function getBatchStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: '待打包',
    packing: '打包中',
    ready: '可下载',
    expired: '已过期'
  };
  return map[status] || status;
}

app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../client/dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('证据包导出系统 - 请先构建前端: cd client && npm run build');
  }
});

async function startServer() {
  await initDB();
  await seedTestData();
  
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`API 文档:`);
    console.log(`  GET  /api/disputes                - 获取争议单列表`);
    console.log(`  GET  /api/disputes/:id            - 获取争议单详情`);
    console.log(`  POST /api/disputes/:id/export     - 创建导出批次`);
    console.log(`  GET  /api/disputes/:id/report     - 下载完整报告`);
    console.log(`  POST /api/batches/:id/reauthorize - 重新授权`);
  });
}

startServer();
