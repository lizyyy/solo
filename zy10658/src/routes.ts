import express, { Request, Response } from 'express';
import { store } from './store';
import { service } from './service';
import { AnnouncementStatus, FilterParams } from './types';

const router = express.Router();

router.get('/announcements', (req: Request, res: Response) => {
  try {
    const params: FilterParams = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      status: req.query.status as AnnouncementStatus,
      responsiblePerson: req.query.responsiblePerson as string,
      businessObject: req.query.businessObject as string,
      announcer: req.query.announcer as string,
      metricName: req.query.metricName as string
    };

    const announcements = service.filterAnnouncements(params);
    res.json({
      success: true,
      data: announcements,
      total: announcements.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询公告列表失败',
      error: (error as Error).message
    });
  }
});

router.get('/announcements/:id', (req: Request, res: Response) => {
  try {
    const announcement = store.getAnnouncementById(req.params.id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }
    res.json({
      success: true,
      data: announcement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询公告详情失败',
      error: (error as Error).message
    });
  }
});

router.get('/announcements/:id/history', (req: Request, res: Response) => {
  try {
    const history = store.getHistoryByAnnouncementId(req.params.id);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询历史记录失败',
      error: (error as Error).message
    });
  }
});

router.post('/announcements', (req: Request, res: Response) => {
  try {
    const validation = service.validateAnnouncementData(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        errors: validation.errors
      });
    }

    const announcement = store.createAnnouncement(req.body);

    const conflictCheck = service.checkForConflicts(announcement);
    if (conflictCheck.hasConflict) {
      store.updateStatus(
        announcement.id,
        AnnouncementStatus.PENDING_MANUAL,
        '系统',
        'system',
        conflictCheck.note
      );
      const updated = store.getAnnouncementById(announcement.id);
      return res.status(201).json({
        success: true,
        data: updated,
        warning: '检测到潜在冲突，已标记为待人工处理',
        conflictNote: conflictCheck.note
      });
    }

    res.status(201).json({
      success: true,
      data: announcement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建公告失败',
      error: (error as Error).message
    });
  }
});

router.put('/announcements/:id', (req: Request, res: Response) => {
  try {
    const announcement = store.updateAnnouncement(req.params.id, req.body);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }
    res.json({
      success: true,
      data: announcement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新公告失败',
      error: (error as Error).message
    });
  }
});

router.post('/announcements/:id/status', (req: Request, res: Response) => {
  try {
    const { newStatus, operator, operatorId, remark } = req.body;

    if (!Object.values(AnnouncementStatus).includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态值'
      });
    }

    if (!operator || !operatorId) {
      return res.status(400).json({
        success: false,
        message: '操作人信息不能为空'
      });
    }

    const announcement = store.updateStatus(
      req.params.id,
      newStatus,
      operator,
      operatorId,
      remark
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }

    res.json({
      success: true,
      data: announcement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新状态失败',
      error: (error as Error).message
    });
  }
});

router.get('/export/announcements', (req: Request, res: Response) => {
  try {
    const params: FilterParams = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      status: req.query.status as AnnouncementStatus,
      responsiblePerson: req.query.responsiblePerson as string,
      businessObject: req.query.businessObject as string,
      announcer: req.query.announcer as string,
      metricName: req.query.metricName as string
    };

    const announcements = service.filterAnnouncements(params);
    const csv = service.exportToCSV(announcements);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="口径变更公告_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出失败',
      error: (error as Error).message
    });
  }
});

router.get('/export/fields', (_req: Request, res: Response) => {
  const mappings = service.getExportFieldMappings();
  res.json({
    success: true,
    data: mappings.map(m => ({ key: m.key, label: m.label }))
  });
});

router.get('/import/errors', (_req: Request, res: Response) => {
  try {
    const errors = store.getImportErrors();
    res.json({
      success: true,
      data: errors,
      total: errors.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询导入错误记录失败',
      error: (error as Error).message
    });
  }
});

router.get('/statuses', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.values(AnnouncementStatus)
  });
});

export { router };
