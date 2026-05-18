import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { attachmentService } from '../services/attachmentService';
import { FilterParams, AttachmentStatus } from '../types';

const router = Router();

const uploadSchema = Joi.object({
  attachmentItemId: Joi.string().required(),
  uploadedBy: Joi.string().required(),
  fileName: Joi.string().required(),
  fileSize: Joi.number().required(),
  fileVersion: Joi.string().required(),
});

const validateSchema = Joi.object({
  attachmentItemId: Joi.string().required(),
  operator: Joi.string().required(),
});

const archiveSchema = Joi.object({
  attachmentItemId: Joi.string().required(),
  operator: Joi.string().required(),
});

router.get('/list', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status, responsiblePerson, businessObject } = req.query;

    const filters: FilterParams = {
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as AttachmentStatus,
      responsiblePerson: responsiblePerson as string,
      businessObject: businessObject as string,
    };

    const list = await attachmentService.getAttachmentList(filters);
    res.json({
      success: true,
      data: list,
      total: list.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '获取列表失败',
    });
  }
});

router.get('/detail/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const detail = await attachmentService.getAttachmentDetail(id);

    if (!detail) {
      return res.status(404).json({
        success: false,
        message: '附件项不存在',
      });
    }

    res.json({
      success: true,
      data: detail,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '获取详情失败',
    });
  }
});

router.get('/history/:attachmentItemId', async (req: Request, res: Response) => {
  try {
    const { attachmentItemId } = req.params;
    const history = await attachmentService.getHistory(attachmentItemId);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '获取历史记录失败',
    });
  }
});

router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { error, value } = uploadSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '参数错误',
        details: error.details,
      });
    }

    const result = await attachmentService.uploadAttachment(
      value.attachmentItemId,
      value.uploadedBy,
      value.fileName,
      value.fileSize,
      value.fileVersion
    );

    res.json({
      success: true,
      data: result,
      message: '上传成功',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '上传失败',
    });
  }
});

router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { error, value } = validateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '参数错误',
        details: error.details,
      });
    }

    const result = await attachmentService.validateAttachment(
      value.attachmentItemId,
      value.operator
    );

    res.json({
      success: true,
      data: result,
      message: '校验完成',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '校验失败',
    });
  }
});

router.post('/archive', async (req: Request, res: Response) => {
  try {
    const { error, value } = archiveSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '参数错误',
        details: error.details,
      });
    }

    const result = await attachmentService.archiveAttachment(
      value.attachmentItemId,
      value.operator
    );

    res.json({
      success: true,
      data: result,
      message: '归档成功',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '归档失败',
    });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status, responsiblePerson, businessObject } = req.query;

    const filters: FilterParams = {
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as AttachmentStatus,
      responsiblePerson: responsiblePerson as string,
      businessObject: businessObject as string,
    };

    const filePath = await attachmentService.exportAttachments(filters);

    res.json({
      success: true,
      message: '导出成功',
      data: {
        filePath,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '导出失败',
    });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await attachmentService.getStatusStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '获取统计失败',
    });
  }
});

export default router;
