import express from 'express';
import cors from 'cors';
import { dataStore } from './store/DataStore';
import { importService } from './services/ImportService';
import { businessService } from './services/BusinessService';
import { queryService } from './services/QueryService';
import { RecordStatus } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '社区疫苗预约服务运行正常' });
});

app.post('/api/batches', (req, res) => {
  try {
    const { batchNo, name, vaccineCode, vaccineName, createdBy } = req.body;
    const batch = dataStore.createBatch({
      batchNo,
      name,
      vaccineCode,
      vaccineName,
      totalCount: 0,
      processedCount: 0,
      status: 'active',
      createdBy: createdBy || 'admin'
    });
    res.json({ success: true, data: batch });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/batches', (req, res) => {
  try {
    const batches = dataStore.getBatches();
    res.json({ success: true, data: batches });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/batches/:id', (req, res) => {
  try {
    const batch = dataStore.getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, error: '批次不存在' });
    }
    const statistics = queryService.getStatisticsByBatch(req.params.id);
    res.json({ success: true, data: { ...batch, statistics } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/import/appointments', async (req, res) => {
  try {
    const { csvContent, batchId } = req.body;
    if (!csvContent || !batchId) {
      return res.status(400).json({ success: false, error: '缺少CSV内容或批次ID' });
    }
    const result = await importService.importAppointmentsFromCSVString(csvContent, batchId);
    
    const batch = dataStore.getBatchById(batchId);
    if (batch) {
      dataStore.updateBatch(batchId, {
        totalCount: batch.totalCount + result.imported
      });
    }
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/import/inventory', (req, res) => {
  try {
    const { jsonContent } = req.body;
    if (!jsonContent) {
      return res.status(400).json({ success: false, error: '缺少JSON内容' });
    }
    const result = importService.importVaccineInventoryFromJSON(jsonContent);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/import/contraindications', (req, res) => {
  try {
    const { jsonContent } = req.body;
    if (!jsonContent) {
      return res.status(400).json({ success: false, error: '缺少JSON内容' });
    }
    const result = importService.importContraindicationRules(jsonContent);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/records/:id/process', (req, res) => {
  try {
    const { operator } = req.body;
    const result = businessService.processAppointmentRecord(req.params.id, operator || 'admin');
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.reason });
    }
    res.json({ success: true, data: result.record });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/batches/:id/process-all', (req, res) => {
  try {
    const { operator } = req.body;
    const result = businessService.processBatchRecords(req.params.id, operator || 'admin');
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/records/:id/return', (req, res) => {
  try {
    const { operator, reason } = req.body;
    const result = businessService.returnToPending(req.params.id, operator || 'admin', reason);
    if (!result.success) {
      return res.status(400).json({ success: false, error: '退回失败' });
    }
    res.json({ success: true, data: result.record });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/records/:id/mark-processed', (req, res) => {
  try {
    const { operator } = req.body;
    const result = businessService.markAsProcessed(req.params.id, operator || 'admin');
    if (!result.success) {
      return res.status(400).json({ success: false, error: '标记失败' });
    }
    res.json({ success: true, data: result.record });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/records', (req, res) => {
  try {
    const { childIdCard, childName, vaccineCode, batchId, status, startDate, endDate, waitlistOrder } = req.query;
    const filters = {
      childIdCard: childIdCard as string,
      childName: childName as string,
      vaccineCode: vaccineCode as string,
      batchId: batchId as string,
      status: status as RecordStatus,
      startDate: startDate as string,
      endDate: endDate as string,
      waitlistOrder: waitlistOrder ? parseInt(waitlistOrder as string) : undefined
    };
    const records = queryService.queryRecords(filters);
    res.json({ success: true, count: records.length, data: records });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/records/:id', (req, res) => {
  try {
    const result = queryService.getRecordWithTraceability(req.params.id);
    if (!result.record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/export/records', (req, res) => {
  try {
    const { childIdCard, childName, vaccineCode, batchId, status, startDate, endDate } = req.query;
    const filters = {
      childIdCard: childIdCard as string,
      childName: childName as string,
      vaccineCode: vaccineCode as string,
      batchId: batchId as string,
      status: status as RecordStatus,
      startDate: startDate as string,
      endDate: endDate as string
    };
    const records = queryService.queryRecords(filters);
    const csv = queryService.exportToCSV(records);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="appointments_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/export/records/:id/traceability', (req, res) => {
  try {
    const csv = queryService.exportWithTraceability(req.params.id);
    if (!csv) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="traceability_${req.params.id}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/children/:idCard/history', (req, res) => {
  try {
    const history = queryService.getHistoryByChild(req.params.idCard);
    res.json({ success: true, count: history.length, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/batches/:id/waitlist', (req, res) => {
  try {
    const waitlist = queryService.getWaitlistByBatch(req.params.id);
    res.json({ success: true, count: waitlist.length, data: waitlist });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/batches/:id/waitlist/traceability', (req, res) => {
  try {
    const traceability = businessService.getWaitlistTraceability(req.params.id);
    res.json({ success: true, count: traceability.length, data: traceability });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/inventory', (req, res) => {
  try {
    const inventory = dataStore.getVaccineInventories();
    res.json({ success: true, count: inventory.length, data: inventory });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/contraindications', (req, res) => {
  try {
    const rules = dataStore.getContraindicationRules();
    res.json({ success: true, count: rules.length, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`社区疫苗预约服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`数据文件将保存在: ${process.cwd()}/data/data.json`);
});

export default app;
