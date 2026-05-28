import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import { VoucherController, upload } from './controllers/VoucherController';
import { BalanceController } from './controllers/BalanceController';
import { SubjectController } from './controllers/SubjectController';
import { ReportController } from './controllers/ReportController';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/vouchers', VoucherController.getVouchers);
app.get('/api/vouchers/summary', VoucherController.getSummary);
app.get('/api/vouchers/generate-no', VoucherController.generateVoucherNo);
app.get('/api/vouchers/:id', VoucherController.getVoucher);
app.get('/api/vouchers/:id/suggestions', VoucherController.getSubjectSuggestions);
app.get('/api/vouchers/:id/history', VoucherController.getRevisionHistory);
app.post('/api/vouchers', upload.single('image'), VoucherController.createVoucher);
app.put('/api/vouchers/:id', VoucherController.updateVoucher);
app.post('/api/vouchers/:id/parse', VoucherController.parseVoucher);
app.put('/api/vouchers/:id/mappings/:mappingId', VoucherController.updateSubjectMappingItem);
app.post('/api/vouchers/:id/notes', VoucherController.addNote);
app.post('/api/vouchers/:id/complete', VoucherController.completeVoucher);

app.get('/api/balance', BalanceController.getBalances);
app.get('/api/balance/check', BalanceController.verifyBalances);
app.post('/api/balance/calculate', BalanceController.calculateBalances);
app.get('/api/balance/periods', BalanceController.getPeriods);

app.get('/api/subjects', SubjectController.getSubjects);
app.post('/api/subjects', SubjectController.createSubject);
app.post('/api/subjects/validate', SubjectController.validateMapping);

app.get('/api/reports', ReportController.getReports);
app.get('/api/reports/:id', ReportController.getReport);
app.post('/api/reports', ReportController.generateReport);
app.post('/api/reports/:id/export', ReportController.exportReport);
app.get('/api/exports/history', ReportController.getExportHistory);
app.get('/api/exports/:exportId/trace', ReportController.traceExport);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

export default app;
