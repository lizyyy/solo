import { Request, Response, Router } from 'express';
import { CriticalValueService, CreateRecordDto, UpdateRecordDto } from '../services/CriticalValueService';
import { TaskStatus, DataCategory } from '../models/CriticalValueRecord';
import * as Joi from 'joi';
import * as moment from 'moment';

const router = Router();
const criticalValueService = new CriticalValueService();

const createRecordSchema = Joi.object({
  patientId: Joi.string().required(),
  patientName: Joi.string().required(),
  department: Joi.string().required(),
  ward: Joi.string().optional(),
  bedNo: Joi.string().optional(),
  testItem: Joi.string().required(),
  testValue: Joi.string().required(),
  referenceRange: Joi.string().optional(),
  testTime: Joi.date().required(),
  reporter: Joi.string().optional(),
  smsContent: Joi.string().optional(),
  smsTime: Joi.date().optional(),
  phoneCallTime: Joi.date().optional(),
  phoneCallOperator: Joi.string().optional(),
  doctorConfirmer: Joi.string().optional(),
  doctorConfirmTime: Joi.date().optional(),
  finalProcessor: Joi.string().optional(),
  operator: Joi.string().required()
});

const updateRecordSchema = Joi.object({
  status: Joi.string().valid(...Object.values(TaskStatus)).optional(),
  category: Joi.string().valid(...Object.values(DataCategory)).optional(),
  supplementRequirements: Joi.string().optional(),
  blockReason: Joi.string().optional(),
  smsContent: Joi.string().optional(),
  smsTime: Joi.date().optional(),
  phoneCallTime: Joi.date().optional(),
  phoneCallOperator: Joi.string().optional(),
  doctorConfirmer: Joi.string().optional(),
  doctorConfirmTime: Joi.date().optional(),
  finalProcessor: Joi.string().optional(),
  operator: Joi.string().required(),
  changeReason: Joi.string().required()
});

router.post('/records', async (req: Request, res: Response) => {
  try {
    const { error, value } = createRecordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { operator, ...dto } = value;
    const record = await criticalValueService.createRecord(dto as CreateRecordDto, operator);

    res.status(201).json({
      success: true,
      data: record,
      categoryInfo: {
        category: record.category,
        reason: record.categoryReason,
        followUpAction: getFollowUpAction(record.category)
      }
    });
  } catch (error) {
    console.error('Create record error:', error);
    res.status(500).json({ error: '创建记录失败' });
  }
});

router.get('/records', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const category = req.query.category as DataCategory;
    const status = req.query.status as TaskStatus;

    let records;
    let total;

    if (category) {
      records = await criticalValueService.getRecordsByCategory(category);
      total = records.length;
    } else if (status) {
      records = await criticalValueService.getRecordsByStatus(status);
      total = records.length;
    } else {
      const result = await criticalValueService.getAllRecords(page, pageSize);
      records = result.records;
      total = result.total;
    }

    res.json({
      success: true,
      data: records,
      pagination: { page, pageSize, total }
    });
  } catch (error) {
    console.error('Get records error:', error);
    res.status(500).json({ error: '获取记录列表失败' });
  }
});

router.get('/records/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = await criticalValueService.getRecordById(id);

    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('Get record error:', error);
    res.status(500).json({ error: '获取记录详情失败' });
  }
});

router.put('/records/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error, value } = updateRecordSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { operator, changeReason, ...dto } = value;
    const updatedRecord = await criticalValueService.updateRecord(
      id,
      dto as UpdateRecordDto,
      operator,
      changeReason
    );

    if (!updatedRecord) {
      return res.status(404).json({ error: '记录不存在' });
    }

    res.json({
      success: true,
      data: updatedRecord
    });
  } catch (error) {
    console.error('Update record error:', error);
    res.status(500).json({ error: '更新记录失败' });
  }
});

router.patch('/records/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, operator, reason } = req.body;

    if (!status || !operator || !reason) {
      return res.status(400).json({ error: '状态、操作人和原因必填' });
    }

    if (!Object.values(TaskStatus).includes(status)) {
      return res.status(400).json({ error: '无效的任务状态' });
    }

    const updatedRecord = await criticalValueService.updateStatus(id, status, operator, reason);

    if (!updatedRecord) {
      return res.status(404).json({ error: '记录不存在' });
    }

    res.json({
      success: true,
      data: updatedRecord
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: '更新状态失败' });
  }
});

router.post('/records/:id/reclassify', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, reason } = req.body;

    if (!operator || !reason) {
      return res.status(400).json({ error: '操作人和原因必填' });
    }

    const updatedRecord = await criticalValueService.reclassifyRecord(id, operator, reason);

    if (!updatedRecord) {
      return res.status(404).json({ error: '记录不存在' });
    }

    res.json({
      success: true,
      data: updatedRecord,
      categoryInfo: {
        category: updatedRecord.category,
        reason: updatedRecord.categoryReason,
        followUpAction: getFollowUpAction(updatedRecord.category)
      }
    });
  } catch (error) {
    console.error('Reclassify record error:', error);
    res.status(500).json({ error: '重新分类失败' });
  }
});

router.get('/records/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = await criticalValueService.getRecordHistory(id);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Get record history error:', error);
    res.status(500).json({ error: '获取历史记录失败' });
  }
});

router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const statistics = await criticalValueService.getStatistics(startDate, endDate);

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const operator = req.query.operator as string;

    const buffer = await criticalValueService.exportRecords(startDate, endDate);

    const fileName = `危急值回告记录_${moment().format('YYYYMMDD_HHmmss')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Export records error:', error);
    res.status(500).json({ error: '导出数据失败' });
  }
});

function getFollowUpAction(category: DataCategory): string {
  const actions = {
    [DataCategory.NORMAL]: '自动进入短信通知和电话回告流程',
    [DataCategory.PENDING_SUPPLEMENT]: '通知检验科夜班组补充缺失信息，补充后重新提交',
    [DataCategory.BLOCKED]: '转入人工审核流程，由值班组长确认处理方式'
  };
  return actions[category];
}

export default router;
