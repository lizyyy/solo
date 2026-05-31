import express from 'express';
import cors from 'cors';
import path from 'path';
import {
  AccountFreezeRequest,
  FreezeStatus,
  MigrationReportFilter
} from './types';
import { stateMachine } from './stateMachine/AccountFreezeStateMachine';
import { recordStore } from './store/RecordStore';
import { reportGenerator } from './report/MigrationReportGenerator';
import { getStatusDisplayName, getReasonDisplayName } from './stateMachine/transitions';
import { getSourceDisplayName } from './stateMachine/parameterValidator';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.post('/api/freeze/process', (req, res) => {
  try {
    const request: AccountFreezeRequest = {
      ...req.body,
      createdAt: new Date(req.body.createdAt || Date.now())
    };

    const result = stateMachine.processRequest(request);
    const isReRun = stateMachine.isReRun();

    res.json({
      success: true,
      data: {
        record: result,
        isReRun,
        statusDisplayName: getStatusDisplayName(result.status),
        reasonDisplayName: getReasonDisplayName(result.freezeReason)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '处理失败'
    });
  }
});

app.get('/api/records', (req, res) => {
  try {
    const { accountId, status, includeHistorical } = req.query;

    const filter: MigrationReportFilter = {};
    if (accountId) filter.accountId = accountId as string;
    if (status) {
      filter.status = (status as string).split(',') as FreezeStatus[];
    }
    if (includeHistorical !== undefined) {
      filter.includeHistorical = includeHistorical === 'true';
    }

    const records = recordStore.filterRecords(filter);
    const enrichedRecords = records.map(r => ({
      ...r,
      statusDisplayName: getStatusDisplayName(r.status),
      reasonDisplayName: getReasonDisplayName(r.freezeReason),
      sourceDisplayName: r.parameterSource ? getSourceDisplayName(r.parameterSource) : null
    }));

    res.json({
      success: true,
      data: {
        records: enrichedRecords,
        total: enrichedRecords.length,
        currentFilter: filter
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '查询失败'
    });
  }
});

app.get('/api/records/:recordId', (req, res) => {
  try {
    const record = recordStore.findByRecordId(req.params.recordId);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: '记录不存在'
      });
    }

    res.json({
      success: true,
      data: {
        record: {
          ...record,
          statusDisplayName: getStatusDisplayName(record.status),
          reasonDisplayName: getReasonDisplayName(record.freezeReason),
          sourceDisplayName: record.parameterSource ? getSourceDisplayName(record.parameterSource) : null
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '查询失败'
    });
  }
});

app.post('/api/records/:recordId/transition', (req, res) => {
  try {
    const { targetStatus, operatorId, operatorName, reason } = req.body;

    const result = stateMachine.manualTransition(
      req.params.recordId,
      targetStatus,
      operatorId,
      operatorName,
      reason
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: '记录不存在'
      });
    }

    res.json({
      success: true,
      data: {
        record: {
          ...result,
          statusDisplayName: getStatusDisplayName(result.status),
          reasonDisplayName: getReasonDisplayName(result.freezeReason)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '状态转换失败'
    });
  }
});

app.post('/api/report/generate', (req, res) => {
  try {
    const filter: MigrationReportFilter = {
      ...req.body,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined
    };

    const report = reportGenerator.generateReport(filter);

    res.json({
      success: true,
      data: {
        report: {
          ...report,
          summaryText: reportGenerator.generateSummaryText(report)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '报告生成失败'
    });
  }
});

app.get('/api/report/export/:format', (req, res) => {
  try {
    const format = req.params.format;
    const lastFilter = reportGenerator.getLastFilter();

    if (!lastFilter) {
      return res.status(400).json({
        success: false,
        error: '请先生成报告后再导出'
      });
    }

    if (format === 'csv') {
      const csv = reportGenerator.exportToCSV(lastFilter);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="freeze-report-${Date.now()}.csv"`);
      res.send(csv);
    } else if (format === 'json') {
      const json = reportGenerator.exportToJSON(lastFilter);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="freeze-report-${Date.now()}.json"`);
      res.send(json);
    } else {
      res.status(400).json({
        success: false,
        error: '不支持的导出格式'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '导出失败'
    });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'running',
      timestamp: new Date(),
      totalRecords: recordStore.getCount()
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n============================================================`);
  console.log(`账户冻结状态机服务已启动`);
  console.log(`============================================================`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API文档:`);
  console.log(`  POST /api/freeze/process     - 处理冻结请求`);
  console.log(`  GET  /api/records            - 查询冻结记录`);
  console.log(`  GET  /api/records/:id        - 获取单条记录详情`);
  console.log(`  POST /api/records/:id/transition - 人工状态转换`);
  console.log(`  POST /api/report/generate    - 生成迁移报告`);
  console.log(`  GET  /api/report/export/:format - 导出报告(csv/json)`);
  console.log(`============================================================\n`);
});
