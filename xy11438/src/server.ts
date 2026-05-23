import express from 'express';
import bodyParser from 'body-parser';
import { initDatabase, upsertSourceRecord, upsertFactRecord, updateSourceRecordStatus, getFactRecord, getFactRecordsByDateRange, getDirtyRecords, getAuditLogs, resolveDirtyRecord, upsertSupplierStatement, getSupplierStatements, generateFactId } from './database';
import { validateOrderCalendar, validateCleaningMessage, validateMaintenanceNote, validateApprovalEmail, validateSupplierStatement } from './services/dirty-detector';
import { performReconciliation, reprocessFactRecord, getReconciliationSummary, ReconciliationResult } from './services/reconciliation';
import { OrderCalendar, CleaningMessage, MaintenanceNote, ApprovalEmail, SupplierStatement, FactRecord, DirtyRecord, AuditLog } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

app.post('/api/ingest/order', async (req, res) => {
  try {
    const order: OrderCalendar = req.body;
    const operator = req.headers['x-operator'] as string || 'api_user';

    const { record, isNew, factId } = await upsertSourceRecord(
      'order_calendar',
      order.orderId,
      order,
      operator
    );

    const validation = await validateOrderCalendar(order, record.id);

    await updateSourceRecordStatus(
      'order_calendar',
      order.orderId,
      validation.isValid ? 'processed' : 'dirty',
      validation.dirtyTypes,
      validation.issues.map(i => i.description).join('; ')
    );

    await upsertFactRecord(
      factId,
      order.roomId,
      order.checkInDate,
      { orderInfo: order },
      operator
    );

    res.json({
      success: true,
      isNew,
      factId,
      recordId: record.id,
      validation: {
        isValid: validation.isValid,
        dirtyTypes: validation.dirtyTypes,
        issues: validation.issues
      }
    });
  } catch (error) {
    console.error('[API] Error ingesting order:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/ingest/cleaning', async (req, res) => {
  try {
    const cleaning: CleaningMessage = req.body;
    const operator = req.headers['x-operator'] as string || 'api_user';

    const { record, isNew, factId } = await upsertSourceRecord(
      'cleaning_group',
      cleaning.messageId,
      cleaning,
      operator
    );

    const fact = await getFactRecord(factId);
    const existingOrders = fact?.orderInfo ? [fact.orderInfo] : [];

    const validation = await validateCleaningMessage(cleaning, record.id, existingOrders);

    await updateSourceRecordStatus(
      'cleaning_group',
      cleaning.messageId,
      validation.isValid ? 'processed' : 'dirty',
      validation.dirtyTypes,
      validation.issues.map(i => i.description).join('; ')
    );

    await upsertFactRecord(
      factId,
      cleaning.roomId,
      cleaning.scheduledDate,
      { cleaningInfo: cleaning },
      operator
    );

    res.json({
      success: true,
      isNew,
      factId,
      recordId: record.id,
      validation: {
        isValid: validation.isValid,
        dirtyTypes: validation.dirtyTypes,
        issues: validation.issues
      }
    });
  } catch (error) {
    console.error('[API] Error ingesting cleaning:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/ingest/maintenance', async (req, res) => {
  try {
    const maint: MaintenanceNote = req.body;
    const operator = req.headers['x-operator'] as string || 'api_user';

    const { record, isNew, factId } = await upsertSourceRecord(
      'maintenance_note',
      maint.noteId,
      maint,
      operator
    );

    const validation = await validateMaintenanceNote(maint, record.id);

    await updateSourceRecordStatus(
      'maintenance_note',
      maint.noteId,
      validation.isValid ? 'processed' : 'dirty',
      validation.dirtyTypes,
      validation.issues.map(i => i.description).join('; ')
    );

    const fact = await getFactRecord(factId);
    const existingMaintenance = fact?.maintenanceInfo || [];
    const updatedMaintenance = [...existingMaintenance.filter(m => m.noteId !== maint.noteId), maint];

    await upsertFactRecord(
      factId,
      maint.roomId,
      maint.reportedAt.split('T')[0],
      { maintenanceInfo: updatedMaintenance },
      operator
    );

    res.json({
      success: true,
      isNew,
      factId,
      recordId: record.id,
      validation: {
        isValid: validation.isValid,
        dirtyTypes: validation.dirtyTypes,
        issues: validation.issues
      }
    });
  } catch (error) {
    console.error('[API] Error ingesting maintenance:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/ingest/approval', async (req, res) => {
  try {
    const approval: ApprovalEmail = req.body;
    const operator = req.headers['x-operator'] as string || 'api_user';

    const { record, isNew, factId } = await upsertSourceRecord(
      'approval_email',
      approval.emailId,
      approval,
      operator
    );

    const validation = await validateApprovalEmail(approval, record.id);

    await updateSourceRecordStatus(
      'approval_email',
      approval.emailId,
      validation.isValid ? 'processed' : 'dirty',
      validation.dirtyTypes,
      validation.issues.map(i => i.description).join('; ')
    );

    if (approval.relatedRoomId) {
      const fact = await getFactRecord(factId);
      const existingApprovals = fact?.approvalInfo || [];
      const updatedApprovals = [...existingApprovals.filter(a => a.emailId !== approval.emailId), approval];

      await upsertFactRecord(
        factId,
        approval.relatedRoomId,
        approval.requestedAt.split('T')[0],
        { approvalInfo: updatedApprovals },
        operator
      );
    }

    res.json({
      success: true,
      isNew,
      factId,
      recordId: record.id,
      validation: {
        isValid: validation.isValid,
        dirtyTypes: validation.dirtyTypes,
        issues: validation.issues
      }
    });
  } catch (error) {
    console.error('[API] Error ingesting approval:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/ingest/statement', async (req, res) => {
  try {
    const statement: SupplierStatement = req.body;
    const operator = req.headers['x-operator'] as string || 'api_user';

    const { record, isNew, factId } = await upsertSourceRecord(
      'supplier_statement',
      statement.statementId,
      statement,
      operator
    );

    const factRecords = await getFactRecordsByDateRange(statement.periodStart, statement.periodEnd);
    const validation = await validateSupplierStatement(statement, record.id, factRecords);

    await updateSourceRecordStatus(
      'supplier_statement',
      statement.statementId,
      validation.isValid ? 'processed' : 'dirty',
      validation.dirtyTypes,
      validation.issues.map(i => i.description).join('; ')
    );

    await upsertSupplierStatement(statement);

    res.json({
      success: true,
      isNew,
      recordId: record.id,
      validation: {
        isValid: validation.isValid,
        dirtyTypes: validation.dirtyTypes,
        issues: validation.issues
      }
    });
  } catch (error) {
    console.error('[API] Error ingesting statement:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/api/facts/:factId', async (req, res) => {
  try {
    const { factId } = req.params;
    const fact = await getFactRecord(factId);
    
    if (!fact) {
      res.status(404).json({ success: false, error: 'Fact record not found' });
      return;
    }

    const auditLogs = await getAuditLogs(factId);

    res.json({
      success: true,
      data: fact,
      auditLogs
    });
  } catch (error) {
    console.error('[API] Error getting fact:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/api/facts', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      res.status(400).json({ success: false, error: 'startDate and endDate are required' });
      return;
    }

    const facts = await getFactRecordsByDateRange(startDate as string, endDate as string);

    res.json({
      success: true,
      count: facts.length,
      data: facts
    });
  } catch (error) {
    console.error('[API] Error listing facts:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/api/dirty-records', async (req, res) => {
  try {
    const { resolved } = req.query;
    const resolvedBool = resolved === 'true' ? true : resolved === 'false' ? false : undefined;
    
    const records = await getDirtyRecords(resolvedBool);

    res.json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error('[API] Error getting dirty records:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/dirty-records/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, reprocess = false } = req.body;
    const operator = req.headers['x-operator'] as string || 'api_user';

    await resolveDirtyRecord(id, resolution, operator);

    if (reprocess) {
      const dirtyRecords = await getDirtyRecords();
      const dirty = dirtyRecords.find(d => d.id === id);
      if (dirty) {
        if (dirty.recordId) {
          const factRecord = await getFactRecord(dirty.recordId);
          if (factRecord) {
            await reprocessFactRecord(factRecord.factId);
          }
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error resolving dirty record:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/reconcile', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      res.status(400).json({ success: false, error: 'startDate and endDate are required' });
      return;
    }

    const result = await performReconciliation(startDate, endDate);
    const summary = getReconciliationSummary(result);

    console.log(summary);

    res.json({
      success: true,
      data: result,
      summary
    });
  } catch (error) {
    console.error('[API] Error performing reconciliation:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/facts/:factId/reprocess', async (req, res) => {
  try {
    const { factId } = req.params;
    const result = await reprocessFactRecord(factId);

    if (!result) {
      res.status(404).json({ success: false, error: 'Fact record not found' });
      return;
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[API] Error reprocessing fact:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/api/statements', async (req, res) => {
  try {
    const statements = await getSupplierStatements();
    res.json({
      success: true,
      count: statements.length,
      data: statements
    });
  } catch (error) {
    console.error('[API] Error getting statements:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/api/audit-logs/:factId', async (req, res) => {
  try {
    const { factId } = req.params;
    const logs = await getAuditLogs(factId);

    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    console.error('[API] Error getting audit logs:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log('[Server] API Endpoints:');
    console.log('  POST /api/ingest/order      - 接入订单日历');
    console.log('  POST /api/ingest/cleaning    - 接入保洁群消息');
    console.log('  POST /api/ingest/maintenance - 接入维修备注');
    console.log('  POST /api/ingest/approval    - 接入审批邮件');
    console.log('  POST /api/ingest/statement   - 接入供应商对账单');
    console.log('  GET  /api/facts?startDate=&endDate= - 查询事实记录');
    console.log('  GET  /api/facts/:factId      - 事实详情+审计日志');
    console.log('  GET  /api/dirty-records      - 查询脏记录');
    console.log('  POST /api/reconcile          - 执行对账');
    console.log('  GET  /api/health             - 健康检查');
  });
}

startServer().catch(err => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
