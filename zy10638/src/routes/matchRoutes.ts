import { Router, Request, Response } from 'express';
import matchService from '../services/matchService';
import { MatchStatus } from '../types';
import Joi from 'joi';

const router = Router();

const matchIdSchema = Joi.object({
  id: Joi.string().required().messages({
    'any.required': '匹配ID不能为空',
    'string.empty': '匹配ID不能为空'
  })
});

const statusSchema = Joi.object({
  status: Joi.string().valid(...Object.values(MatchStatus)).required().messages({
    'any.required': '状态无效',
    'any.only': '状态无效'
  }),
  changedBy: Joi.string().optional(),
  changeNote: Joi.string().optional()
});

const noteSchema = Joi.object({
  note: Joi.string().required().messages({
    'any.required': '备注内容不能为空',
    'string.empty': '备注内容不能为空'
  }),
  changedBy: Joi.string().optional()
});

const createMatchSchema = Joi.object({
  entryId: Joi.string().required().messages({
    'any.required': '入场记录ID不能为空',
    'string.empty': '入场记录ID不能为空'
  }),
  paymentId: Joi.string().required().messages({
    'any.required': '支付记录ID不能为空',
    'string.empty': '支付记录ID不能为空'
  }),
  manualNote: Joi.string().optional(),
  matchedBy: Joi.string().optional()
});

const listSchema = Joi.object({
  status: Joi.string().valid(...Object.values(MatchStatus)).optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20)
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { error, value } = listSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await matchService.getMatchList(value);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { error } = matchIdSchema.validate(req.params);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await matchService.getMatchDetail(String(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const { error } = matchIdSchema.validate(req.params);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await matchService.getMatchHistories(String(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { error, value } = createMatchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const id = await matchService.createMatch(value);
    res.status(201).json({ id });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { error: idError } = matchIdSchema.validate(req.params);
    if (idError) {
      return res.status(400).json({ error: idError.details[0].message });
    }

    const { error: bodyError, value } = statusSchema.validate(req.body);
    if (bodyError) {
      return res.status(400).json({ error: bodyError.details[0].message });
    }

    await matchService.updateStatus(String(req.params.id), value.status, value.changedBy, value.changeNote);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/note', async (req: Request, res: Response) => {
  try {
    const { error: idError } = matchIdSchema.validate(req.params);
    if (idError) {
      return res.status(400).json({ error: idError.details[0].message });
    }

    const { error: bodyError, value } = noteSchema.validate(req.body);
    if (bodyError) {
      return res.status(400).json({ error: bodyError.details[0].message });
    }

    await matchService.addManualNote(String(req.params.id), value.note, value.changedBy);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/import', async (req: Request, res: Response) => {
  try {
    const records = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: '导入数据必须是数组格式' });
    }

    const result = await matchService.batchImport(records);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/data', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const result = await matchService.exportData({
      status: status as MatchStatus | undefined
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
