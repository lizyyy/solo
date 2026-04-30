import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ticketDao } from '../dao/ticketDao';
import { commentDao } from '../dao/commentDao';
import { statusHistoryDao } from '../dao/statusHistoryDao';
import {
  validateCreateTicket,
  validateUpdateTicket,
  validateStatusTransition,
  validateComment,
  getStatusLabel,
  getPriorityLabel,
} from '../validators';
import {
  TicketStatus,
  TicketPriority,
  Ticket,
  TicketWithDetails,
  ApiResponse,
  CreateTicketRequest,
  UpdateTicketRequest,
  UpdateStatusRequest,
  CreateCommentRequest,
  ImportResult,
  FilterParams,
} from '../types';
import {
  parseCSVBuffer,
  validateAndTransformCSVRecords,
  exportTicketsToCSV,
} from '../utils/csvHandler';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

function errorResponse(error: string): ApiResponse {
  return {
    success: false,
    error,
  };
}

router.get('/', (req: Request, res: Response<ApiResponse<Ticket[]>>) => {
  try {
    const filters: FilterParams = {
      assignee: req.query.assignee as string,
      status: req.query.status as TicketStatus,
      priority: req.query.priority as TicketPriority,
      tags: req.query.tags as string,
      keyword: req.query.keyword as string,
    };

    const hasFilters = Object.values(filters).some(v => v !== undefined);
    const tickets = hasFilters ? ticketDao.findByFilters(filters) : ticketDao.findAll();

    res.json(successResponse(tickets));
  } catch (error) {
    res.status(500).json(errorResponse('获取工单列表失败'));
  }
});

router.get('/metadata', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const assignees = ticketDao.getDistinctAssignees();
    const tags = ticketDao.getDistinctTags();

    res.json(successResponse({
      assignees,
      tags,
      statuses: Object.values(TicketStatus).map(s => ({
        value: s,
        label: getStatusLabel(s),
      })),
      priorities: Object.values(TicketPriority).map(p => ({
        value: p,
        label: getPriorityLabel(p),
      })),
    }));
  } catch (error) {
    res.status(500).json(errorResponse('获取元数据失败'));
  }
});

router.get('/:id', (req: Request<{ id: string }>, res: Response<ApiResponse<TicketWithDetails>>) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json(errorResponse('无效的工单ID'));
    }

    const ticket = ticketDao.findById(id);
    if (!ticket) {
      return res.status(404).json(errorResponse('工单不存在'));
    }

    const comments = commentDao.findByTicketId(id);
    const statusHistory = statusHistoryDao.findByTicketId(id);

    res.json(successResponse({
      ...ticket,
      comments,
      statusHistory,
    }));
  } catch (error) {
    res.status(500).json(errorResponse('获取工单详情失败'));
  }
});

router.post('/', (req: Request<{}, any, CreateTicketRequest>, res: Response<ApiResponse<Ticket>>) => {
  try {
    const validation = validateCreateTicket(req.body);
    if (!validation.isValid) {
      return res.status(400).json(errorResponse(validation.errors.join('; ')));
    }

    const ticket = ticketDao.create(req.body);

    statusHistoryDao.create(
      ticket.id,
      null,
      TicketStatus.PENDING,
      req.body.assignee || '系统',
      '工单创建'
    );

    res.status(201).json(successResponse(ticket, '工单创建成功'));
  } catch (error) {
    res.status(500).json(errorResponse('创建工单失败'));
  }
});

router.put('/:id', (req: Request<{ id: string }, any, UpdateTicketRequest>, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json(errorResponse('无效的工单ID'));
    }

    const ticket = ticketDao.findById(id);
    if (!ticket) {
      return res.status(404).json(errorResponse('工单不存在'));
    }

    const validation = validateUpdateTicket(req.body, ticket.status);
    if (!validation.isValid) {
      return res.status(400).json(errorResponse(validation.errors.join('; ')));
    }

    const updated = ticketDao.update(id, req.body);
    if (updated) {
      res.json(successResponse(null, '工单更新成功'));
    } else {
      res.status(400).json(errorResponse('没有需要更新的内容'));
    }
  } catch (error) {
    res.status(500).json(errorResponse('更新工单失败'));
  }
});

router.post('/:id/status', (req: Request<{ id: string }, any, UpdateStatusRequest>, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json(errorResponse('无效的工单ID'));
    }

    const ticket = ticketDao.findById(id);
    if (!ticket) {
      return res.status(404).json(errorResponse('工单不存在'));
    }

    const { newStatus, remark, changedBy } = req.body;

    const validation = validateStatusTransition(ticket.status, newStatus);
    if (!validation.isValid) {
      return res.status(400).json(errorResponse(validation.errors.join('; ')));
    }

    if (ticket.status !== newStatus) {
      ticketDao.updateStatus(id, newStatus);

      statusHistoryDao.create(
        id,
        ticket.status,
        newStatus,
        changedBy || '系统',
        remark || ''
      );
    }

    res.json(successResponse(null, '状态更新成功'));
  } catch (error) {
    res.status(500).json(errorResponse('更新状态失败'));
  }
});

router.get('/:id/comments', (req: Request<{ id: string }>, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json(errorResponse('无效的工单ID'));
    }

    const ticket = ticketDao.findById(id);
    if (!ticket) {
      return res.status(404).json(errorResponse('工单不存在'));
    }

    const comments = commentDao.findByTicketId(id);
    res.json(successResponse(comments));
  } catch (error) {
    res.status(500).json(errorResponse('获取评论失败'));
  }
});

router.post('/:id/comments', (req: Request<{ id: string }, any, CreateCommentRequest>, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json(errorResponse('无效的工单ID'));
    }

    const ticket = ticketDao.findById(id);
    if (!ticket) {
      return res.status(404).json(errorResponse('工单不存在'));
    }

    const { author, content } = req.body;
    const validation = validateComment(author, content);
    if (!validation.isValid) {
      return res.status(400).json(errorResponse(validation.errors.join('; ')));
    }

    const comment = commentDao.create(id, { author, content });
    res.status(201).json(successResponse(comment, '评论添加成功'));
  } catch (error) {
    res.status(500).json(errorResponse('添加评论失败'));
  }
});

router.post('/import', upload.single('file'), async (req: Request, res: Response<ApiResponse<ImportResult>>) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('请上传CSV文件'));
    }

    const records = await parseCSVBuffer(req.file.buffer);
    const { valid, errors } = validateAndTransformCSVRecords(records);

    const importedIds: number[] = [];

    for (const item of valid) {
      try {
        const validation = validateCreateTicket(item.data);
        if (validation.isValid) {
          const ticket = ticketDao.create(item.data);
          statusHistoryDao.create(
            ticket.id,
            null,
            TicketStatus.PENDING,
            item.data.assignee || '系统',
            '批量导入创建'
          );
          importedIds.push(ticket.id);
        } else {
          errors.push({
            row: item.index,
            message: validation.errors.join('; '),
          });
        }
      } catch (e) {
        errors.push({
          row: item.index,
          message: '创建失败',
        });
      }
    }

    const result: ImportResult = {
      success: importedIds.length,
      failed: errors.length,
      errors,
      importedIds,
    };

    res.json(successResponse(result, `导入完成: 成功${result.success}条, 失败${result.failed}条`));
  } catch (error) {
    res.status(500).json(errorResponse('导入失败'));
  }
});

router.post('/export', async (req: Request<{}, any, FilterParams>, res: Response) => {
  try {
    const filters = req.body || {};
    const hasFilters = Object.values(filters).some(v => v !== undefined);
    const tickets = hasFilters ? ticketDao.findByFilters(filters) : ticketDao.findAll();

    const csvContent = await exportTicketsToCSV(tickets);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=tickets_${Date.now()}.csv`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json(errorResponse('导出失败'));
  }
});

export default router;
