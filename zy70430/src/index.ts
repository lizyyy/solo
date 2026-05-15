import express from 'express';
import { Request, Response } from 'express';
import { RequestSizeGuardrail } from './guardrail';
import { ReportExporter } from './exporter';
import * as path from 'path';

export { RequestSizeGuardrail, ReportExporter };
export * from './types';

const app = express();
const PORT = process.env.PORT || 3000;
const guardrail = new RequestSizeGuardrail();
const exporter = new ReportExporter(guardrail);

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'request-size-guardrail',
    timestamp: new Date().toISOString(),
    config: guardrail.getConfig()
  });
});

app.post('/api/guardrail/check', (req: Request, res: Response) => {
  try {
    const { source, requestType, input, metadata } = req.body;
    
    if (!input) {
      return res.status(400).json({ error: 'input is required' });
    }

    const result = guardrail.processRequest(
      source || 'api',
      requestType || 'unknown',
      input,
      metadata || {}
    );

    res.json({
      success: true,
      recordId: result.record.id,
      isDuplicate: result.isDuplicate,
      hasIssues: result.record.fieldIssues.length > 0,
      issues: result.record.fieldIssues,
      status: result.record.status,
      record: result.record
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/records', (req: Request, res: Response) => {
  try {
    const { status, hasIssues } = req.query;
    let records = guardrail.getAllRecords();

    if (status) {
      records = records.filter(r => r.status === status);
    }
    if (hasIssues === 'true') {
      records = records.filter(r => r.fieldIssues.length > 0);
    }

    res.json({
      success: true,
      total: records.length,
      records
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/records/:id', (req: Request, res: Response) => {
  try {
    const record = guardrail.getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/records/:id/field/:fieldPath', (req: Request, res: Response) => {
  try {
    const value = guardrail.getFieldOriginalValue(req.params.id, req.params.fieldPath);
    if (value === null) {
      return res.status(404).json({ error: 'Field not found' });
    }
    res.json({
      success: true,
      fieldPath: req.params.fieldPath,
      originalValue: value,
      valueLength: typeof value === 'string' ? value.length : undefined
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/records/:id/correct', (req: Request, res: Response) => {
  try {
    const { fieldPath, operator, originalDecision, correctedDecision, reason, evidence } = req.body;
    
    if (!fieldPath || !operator || !originalDecision || !correctedDecision || !reason) {
      return res.status(400).json({ 
        error: 'fieldPath, operator, originalDecision, correctedDecision, reason are required' 
      });
    }

    const correction = guardrail.addCorrection(
      req.params.id,
      fieldPath,
      operator,
      originalDecision,
      correctedDecision,
      reason,
      evidence
    );

    if (!correction) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({
      success: true,
      correction,
      message: 'Correction added successfully'
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/export', async (req: Request, res: Response) => {
  try {
    const { generator, format = 'json' } = req.query;
    const report = exporter.generateReport((generator as string) || 'api');
    
    if (format === 'markdown') {
      const mdPath = exporter.exportToMarkdown(report);
      res.json({
        success: true,
        reportId: report.reportId,
        format: 'markdown',
        filePath: mdPath,
        summary: report.summary
      });
    } else {
      const jsonPath = exporter.exportToJSON(report);
      res.json({
        success: true,
        reportId: report.reportId,
        format: 'json',
        filePath: jsonPath,
        summary: report.summary,
        report
      });
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/corrections', (req: Request, res: Response) => {
  try {
    const records = guardrail.getAllRecords().filter(r => r.corrections.length > 0);
    const corrections = records.flatMap(record => 
      record.corrections.map(correction => ({
        ...correction,
        recordId: record.id,
        source: record.source,
        requestType: record.requestType
      }))
    );
    
    res.json({
      success: true,
      total: corrections.length,
      corrections: corrections.map(c => ({
        fieldPath: c.fieldPath,
        source: `${c.recordId} (${c.source} - ${c.requestType})`,
        originalDecision: c.originalDecision,
        correctedDecision: c.correctedDecision,
        evidence: c.evidence,
        operator: c.operator,
        timestamp: c.timestamp
      }))
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀 请求大小护栏服务已启动`);
    console.log(`📍 服务地址: http://localhost:${PORT}`);
    console.log(`\n📚 API 端点:`);
    console.log(`   GET  /api/health                - 健康检查`);
    console.log(`   POST /api/guardrail/check       - 检查请求大小`);
    console.log(`   GET  /api/records               - 获取所有记录`);
    console.log(`   GET  /api/records/:id           - 获取单个记录`);
    console.log(`   GET  /api/records/:id/field/*   - 获取字段原始值`);
    console.log(`   POST /api/records/:id/correct   - 添加人工修正`);
    console.log(`   GET  /api/export                - 导出复核报告`);
    console.log(`   GET  /api/corrections           - 获取所有人工修正记录`);
    console.log(`\n🧪 运行测试: npm test`);
    console.log(`📤 手动导出: npm run export\n`);
  });
}
