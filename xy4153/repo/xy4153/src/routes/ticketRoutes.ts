import { Router } from 'express';
import { AuthRequest, requireRoles, validateRequestBody } from './middleware';
import { createTicket, getTicketById, getTicketsByUser, updateTicket } from '../storage/ticketRepository';
import { getSampleRecordById, updateSampleRecord } from '../storage/sampleRecordRepository';
import { getThresholdByType } from '../storage/thresholdRepository';
import { UserRole, TicketStatus, SampleType } from '../types';
import { createAuditLog } from '../storage/auditRepository';
import { 
  checkTicketCreation, 
  checkRectificationSubmission,
  checkRetestSubmission 
} from '../rules/validationRules';
import {
  assignTicket,
  startRectification,
  submitRectification,
  submitRetest,
  closeTicket,
  archiveTicket,
  getAvailableTransitions
} from '../state-machine/ticketStateMachine';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const { status } = req.query;
    const tickets = getTicketsByUser(req.user, status as TicketStatus | undefined);

    res.json({
      success: true,
      data: tickets
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取工单列表失败'
    });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const ticket = getTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: '工单不存在'
      });
    }

    let availableTransitions = [];
    if (req.user) {
      availableTransitions = getAvailableTransitions(ticket.status, req.user.role);
    }

    res.json({
      success: true,
      data: ticket,
      availableTransitions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '获取工单信息失败'
    });
  }
});

router.post(
  '/',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]),
  validateRequestBody({
    sampleRecordId: { required: true, type: 'string' }
  }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      const { sampleRecordId } = req.body;

      const sampleRecord = getSampleRecordById(sampleRecordId);
      if (!sampleRecord) {
        return res.status(400).json({
          success: false,
          error: '采样记录不存在'
        });
      }

      const ticketCheck = checkTicketCreation(sampleRecord);
      if (!ticketCheck.valid) {
        return res.status(400).json({
          success: false,
          errors: ticketCheck.errors,
          warnings: ticketCheck.warnings
        });
      }

      const threshold = getThresholdByType(sampleRecord.sampleType);
      if (!threshold) {
        return res.status(400).json({
          success: false,
          error: '未找到阈值配置'
        });
      }

      const ticket = createTicket(
        sampleRecord.storeId,
        sampleRecord.poolId,
        sampleRecordId,
        sampleRecord.sampleType,
        sampleRecord.value,
        threshold.minValue,
        threshold.maxValue,
        req.user
      );

      updateSampleRecord(sampleRecordId, { ticketId: ticket.id }, req.user);

      createAuditLog('ticket', ticket.id, 'create', req.user, {
        afterState: ticket
      });

      res.status(201).json({
        success: true,
        data: ticket,
        warnings: ticketCheck.warnings
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '创建工单失败'
      });
    }
  }
);

router.post(
  '/:id/assign',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]),
  validateRequestBody({
    assignedTo: { required: true, type: 'string' }
  }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      const { id } = req.params;
      const { assignedTo } = req.body;

      const result = assignTicket({
        ticketId: id,
        assignedTo,
        user: req.user
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.ticket
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '派发工单失败'
      });
    }
  }
);

router.post(
  '/:id/start-rectification',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.STORE_STAFF]),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      const { id } = req.params;

      const result = startRectification({
        ticketId: id,
        user: req.user
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.ticket
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '开始整改失败'
      });
    }
  }
);

router.post(
  '/:id/submit-rectification',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.STORE_STAFF]),
  validateRequestBody({
    description: { required: true, type: 'string' },
    evidenceUrls: { required: true, type: 'array' }
  }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      const { id } = req.params;
      const { description, evidenceUrls } = req.body;

      const validationResult = checkRectificationSubmission(description, evidenceUrls);
      if (!validationResult.valid) {
        return res.status(400).json({
          success: false,
          errors: validationResult.errors,
          warnings: validationResult.warnings
        });
      }

      const result = submitRectification({
        ticketId: id,
        description,
        evidenceUrls,
        user: req.user
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.ticket,
        warnings: validationResult.warnings
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '提交整改失败'
      });
    }
  }
);

router.post(
  '/:id/submit-retest',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]),
  validateRequestBody({
    retestValue: { required: true, type: 'number' },
    retestSampleRecordId: { required: true, type: 'string' },
    passed: { required: true, type: 'boolean' }
  }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      const { id } = req.params;
      const { retestValue, retestSampleRecordId, passed } = req.body;

      const ticket = getTicketById(id);
      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: '工单不存在'
        });
      }

      const originalSample = getSampleRecordById(ticket.sampleRecordId);
      if (!originalSample) {
        return res.status(400).json({
          success: false,
          error: '原始采样记录不存在'
        });
      }

      const retestSample = getSampleRecordById(retestSampleRecordId);
      if (!retestSample) {
        return res.status(400).json({
          success: false,
          error: '复测采样记录不存在'
        });
      }

      const validationResult = checkRetestSubmission(
        retestValue,
        ticket.sampleType,
        originalSample.sampleTime,
        retestSample.sampleTime
      );

      const result = submitRetest({
        ticketId: id,
        retestValue,
        retestSampleRecordId,
        passed,
        user: req.user
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.ticket,
        warnings: validationResult.warnings
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '提交复测失败'
      });
    }
  }
);

router.post(
  '/:id/close',
  requireRoles([UserRole.ADMIN]),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      const { id } = req.params;
      const { closeReason } = req.body;

      const result = closeTicket({
        ticketId: id,
        closeReason: closeReason || '管理员关闭',
        user: req.user
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.ticket
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '关闭工单失败'
      });
    }
  }
);

router.post(
  '/:id/archive',
  requireRoles([UserRole.ADMIN]),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      const { id } = req.params;

      const result = archiveTicket({
        ticketId: id,
        user: req.user
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.ticket
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '归档工单失败'
      });
    }
  }
);

export default router;
