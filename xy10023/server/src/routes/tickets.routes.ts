import { Router } from 'express';
import { requireAgent, requireSupervisor, AuthenticatedRequest } from '../middlewares/auth.middleware';
import ticketService from '../services/ticket.service';
import { TicketStatus, TicketPriority, VersionConflictError } from '../models/Ticket';
import logger from '../utils/logger';

const router = Router();

router.get('/', requireAgent, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      status,
      priority,
      assigneeId,
      customerId,
      category,
      search,
      page,
      pageSize,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await ticketService.getTickets({
      status: status ? (Array.isArray(status) ? status as string[] : [status as string]) as TicketStatus[] : undefined,
      priority: priority ? (Array.isArray(priority) ? priority as string[] : [priority as string]) as TicketPriority[] : undefined,
      assigneeId: assigneeId as string,
      customerId: customerId as string,
      category: category as string,
      search: search as string,
      page: page ? parseInt(page as string, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string, 10) : undefined,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'ASC' | 'DESC',
    });

    res.json(result);
  } catch (error) {
    logger.error('Get tickets failed:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get tickets',
    });
  }
});

router.get('/stats', requireAgent, async (req, res) => {
  try {
    const stats = await ticketService.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Get stats failed:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get stats',
    });
  }
});

router.get('/:id', requireAgent, async (req: AuthenticatedRequest, res) => {
  try {
    const ticket = await ticketService.getTicketById(req.params.id);
    
    if (!ticket) {
      res.status(404).json({
        error: 'TICKET_NOT_FOUND',
        message: 'Ticket not found',
      });
      return;
    }

    res.json(ticket);
  } catch (error) {
    logger.error('Get ticket failed:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get ticket',
    });
  }
});

router.post('/', requireAgent, async (req: AuthenticatedRequest, res) => {
  try {
    const ticket = await ticketService.createTicket(
      req.body,
      req.user!.id,
      req.requestId
    );

    res.status(201).json(ticket);
  } catch (error) {
    logger.error('Create ticket failed:', error);
    res.status(400).json({
      error: 'CREATE_FAILED',
      message: (error as Error).message,
    });
  }
});

router.put('/:id', requireAgent, async (req: AuthenticatedRequest, res) => {
  try {
    const { version, ...updateData } = req.body;
    
    if (!version && version !== 0) {
      res.status(400).json({
        error: 'MISSING_VERSION',
        message: 'Version is required for optimistic locking',
      });
      return;
    }

    const ticket = await ticketService.updateTicket(
      req.params.id,
      updateData,
      parseInt(version as string, 10),
      req.user!.id,
      req.requestId
    );

    res.json(ticket);
  } catch (error) {
    if (error instanceof VersionConflictError) {
      res.status(409).json({
        error: 'VERSION_CONFLICT',
        message: 'Version conflict. Please refresh and try again.',
        ticketId: error.ticketId,
        expectedVersion: error.expectedVersion,
      });
      return;
    }

    logger.error('Update ticket failed:', error);
    res.status(400).json({
      error: 'UPDATE_FAILED',
      message: (error as Error).message,
    });
  }
});

router.patch('/:id/status', requireAgent, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, version, reason } = req.body;
    
    if (!status) {
      res.status(400).json({
        error: 'MISSING_STATUS',
        message: 'Status is required',
      });
      return;
    }

    if (!version && version !== 0) {
      res.status(400).json({
        error: 'MISSING_VERSION',
        message: 'Version is required for optimistic locking',
      });
      return;
    }

    const ticket = await ticketService.changeStatus(
      req.params.id,
      status as TicketStatus,
      parseInt(version as string, 10),
      req.user!.id,
      reason as string,
      req.requestId
    );

    res.json(ticket);
  } catch (error) {
    if (error instanceof VersionConflictError) {
      res.status(409).json({
        error: 'VERSION_CONFLICT',
        message: 'Version conflict. Please refresh and try again.',
        ticketId: error.ticketId,
        expectedVersion: error.expectedVersion,
      });
      return;
    }

    logger.error('Change status failed:', error);
    res.status(400).json({
      error: 'STATUS_CHANGE_FAILED',
      message: (error as Error).message,
    });
  }
});

router.patch('/:id/assign', requireSupervisor, async (req: AuthenticatedRequest, res) => {
  try {
    const { assigneeId, version } = req.body;
    
    if (!version && version !== 0) {
      res.status(400).json({
        error: 'MISSING_VERSION',
        message: 'Version is required for optimistic locking',
      });
      return;
    }

    const ticket = await ticketService.assignTicket(
      req.params.id,
      assigneeId || null,
      parseInt(version as string, 10),
      req.user!.id,
      req.requestId
    );

    res.json(ticket);
  } catch (error) {
    if (error instanceof VersionConflictError) {
      res.status(409).json({
        error: 'VERSION_CONFLICT',
        message: 'Version conflict. Please refresh and try again.',
        ticketId: error.ticketId,
        expectedVersion: error.expectedVersion,
      });
      return;
    }

    logger.error('Assign ticket failed:', error);
    res.status(400).json({
      error: 'ASSIGN_FAILED',
      message: (error as Error).message,
    });
  }
});

router.get('/:id/events', requireAgent, async (req, res) => {
  try {
    const events = await ticketService.getTicketEvents(req.params.id);
    res.json({ events });
  } catch (error) {
    logger.error('Get ticket events failed:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get ticket events',
    });
  }
});

router.get('/:id/replay', requireAgent, async (req, res) => {
  try {
    const { version } = req.query;
    
    if (!version) {
      res.status(400).json({
        error: 'MISSING_VERSION',
        message: 'Target version is required',
      });
      return;
    }

    const result = await ticketService.replayTicketToVersion(
      req.params.id,
      parseInt(version as string, 10)
    );

    res.json(result);
  } catch (error) {
    logger.error('Replay ticket failed:', error);
    res.status(500).json({
      error: 'REPLAY_FAILED',
      message: (error as Error).message,
    });
  }
});

export default router;
