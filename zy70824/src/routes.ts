import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import { Parser } from 'json2csv';
import { generateId, getStatusDescription, formatDate } from './utils';
import {
  createBatch,
  createSampleRecord,
  getSampleRecord,
  updateSampleRecord,
  getRecordsByQuery,
  getOperationLogs,
  importInfluencers,
  checkDuplicateSample,
  getInfluencer,
  getBatch,
  getAllBatches,
  updateOverdueRecords
} from './services';
import { SampleRecord } from './types';

const router = express.Router();
const upload = multer({ dest: process.env.UPLOAD_PATH || './uploads' });

router.post('/batches', async (req, res) => {
  try {
    const batchId = generateId('BATCH');
    const batch = await createBatch({
      ...req.body,
      batchId,
      status: 'pending'
    });
    res.json({ success: true, data: batch });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/batches', async (req, res) => {
  try {
    const batches = await getAllBatches();
    res.json({ success: true, data: batches });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }

    const results: any[] = [];
    const errors: string[] = [];
    const batchId = req.body.batchId || generateId('BATCH');

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          let batchCreated = false;
          let batchData: any = null;

          for (const row of results) {
            const sampleId = row.sampleId || row['样品ID'];
            const sampleName = row.sampleName || row['样品名称'];
            const influencerId = row.influencerId || row['达人ID'];
            const influencerName = row.influencerName || row['达人姓名'];
            const sendDate = row.sendDate || row['寄送日期'] || formatDate(new Date());
            const expectedReturnDate = row.expectedReturnDate || row['预计归还日期'];
            const deposit = parseFloat(row.deposit || row['押金'] || 0);
            const brand = row.brand || row['品牌'] || '未知品牌';

            if (!sampleId || !influencerId) {
              errors.push(`行数据不完整: ${JSON.stringify(row)}`);
              continue;
            }

            const isDuplicate = await checkDuplicateSample(sampleId, influencerId);
            if (isDuplicate) {
              errors.push(`样品${sampleId}已寄送给达人${influencerId}且未归还`);
              continue;
            }

            if (!batchCreated) {
              batchData = await createBatch({
                batchId,
                brand,
                sendDate,
                expectedReturnDate,
                status: 'processing',
                handler: req.body.handler || 'admin'
              });
              batchCreated = true;
            }

            const recordId = generateId('REC');
            await createSampleRecord({
              recordId,
              batchId,
              sampleId,
              sampleName,
              influencerId,
              influencerName,
              sendDate,
              expectedReturnDate,
              status: 'sent',
              deposit,
              handler: req.body.handler || 'admin'
            });
          }

          fs.unlinkSync(req.file.path);

          res.json({
            success: true,
            data: {
              batch: batchData,
              imported: results.length - errors.length,
              total: results.length,
              errors
            }
          });
        } catch (error: any) {
          res.status(500).json({ success: false, error: error.message });
        }
      });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import/influencers', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }

    const content = fs.readFileSync(req.file.path, 'utf-8');
    const influencers = JSON.parse(content);

    await importInfluencers(influencers);

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: { imported: influencers.length }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/records/:recordId/process', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { status, handler, remark, actualReturnDate, deductionAmount, deductionReason } = req.body;

    const record = await getSampleRecord(recordId);
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    const updates: Partial<SampleRecord> = { status };
    if (actualReturnDate) updates.actualReturnDate = actualReturnDate;
    if (deductionAmount !== undefined) updates.deductionAmount = deductionAmount;
    if (deductionReason) updates.deductionReason = deductionReason;
    if (handler) updates.handler = handler;
    if (remark) updates.remark = remark;

    await updateSampleRecord(recordId, updates, handler || 'admin', 'processed', remark);

    res.json({ success: true, message: '处理完成' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/records/:recordId/return', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { handler, reason } = req.body;

    const record = await getSampleRecord(recordId);
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    await updateSampleRecord(recordId, { status: 'pending' }, handler || 'admin', 'returned', reason);

    res.json({ success: true, message: '已退回修改' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/records', async (req, res) => {
  try {
    const { brand, batchId, influencerId, status, hasDeduction } = req.query;

    await updateOverdueRecords();

    const records = await getRecordsByQuery({
      brand: brand as string,
      batchId: batchId as string,
      influencerId: influencerId as string,
      status: status as string,
      hasDeduction: hasDeduction === 'true'
    });

    const recordsWithDescription = records.map(record => ({
      ...record,
      statusDescription: getStatusDescription(record.status),
      isOverdue: record.status === 'overdue'
    }));

    res.json({
      success: true,
      data: recordsWithDescription,
      total: recordsWithDescription.length
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/records/:recordId/logs', async (req, res) => {
  try {
    const { recordId } = req.params;
    const logs = await getOperationLogs(recordId);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { brand, batchId, influencerId, status, hasDeduction } = req.query;

    await updateOverdueRecords();

    const records = await getRecordsByQuery({
      brand: brand as string,
      batchId: batchId as string,
      influencerId: influencerId as string,
      status: status as string,
      hasDeduction: hasDeduction === 'true'
    });

    const exportData = records.map(record => ({
      recordId: record.recordId,
      batchId: record.batchId,
      样品ID: record.sampleId,
      样品名称: record.sampleName,
      达人ID: record.influencerId,
      达人姓名: record.influencerName,
      寄送日期: record.sendDate,
      预计归还日期: record.expectedReturnDate,
      实际归还日期: record.actualReturnDate || '',
      状态: getStatusDescription(record.status),
      押金: record.deposit,
      扣款金额: record.deductionAmount || 0,
      扣款原因: record.deductionReason || '',
      处理人: record.handler || '',
      备注: record.remark || ''
    }));

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(exportData);

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`samples_export_${Date.now()}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/records/:recordId/photos', upload.array('photos', 10), async (req, res) => {
  try {
    const { recordId } = req.params;
    const { handler } = req.body;

    const record = await getSampleRecord(recordId);
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    const photoPaths = (req.files as Express.Multer.File[]).map(f => f.path).join(',');

    await updateSampleRecord(
      recordId,
      { photos: photoPaths },
      handler || 'admin',
      'modified',
      '上传回收照片'
    );

    res.json({ success: true, message: '照片上传成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/influencers/:influencerId', async (req, res) => {
  try {
    const { influencerId } = req.params;
    const influencer = await getInfluencer(influencerId);
    if (!influencer) {
      return res.status(404).json({ success: false, error: '达人不存在' });
    }
    res.json({ success: true, data: influencer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
