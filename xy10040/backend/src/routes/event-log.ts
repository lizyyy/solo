import { Router, Request, Response, NextFunction } from 'express';
import { eventLogService } from '../services/event-log.service';
import { EventType } from '../types';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 50;
    const aggregateType = req.query.aggregateType as 'event' | 'registration' | undefined;
    const eventType = req.query.eventType as EventType | undefined;
    const userId = req.query.userId as string | undefined;
    
    let fromTime: Date | undefined;
    let toTime: Date | undefined;
    
    if (req.query.fromTime) {
      fromTime = new Date(req.query.fromTime as string);
    }
    if (req.query.toTime) {
      toTime = new Date(req.query.toTime as string);
    }

    const result = await eventLogService.query({
      aggregateType,
      eventType,
      userId,
      fromTime,
      toTime,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    res.json({
      entries: result.entries,
      total: result.total,
      page,
      pageSize,
      hasMore: (page - 1) * pageSize + result.entries.length < result.total,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/request/:requestId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = await eventLogService.getByRequestId(req.params.requestId);
    res.json({ entries });
  } catch (error) {
    next(error);
  }
});

router.get('/replay/:aggregateType/:aggregateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aggregateType, aggregateId } = req.params;
    
    if (!['event', 'registration'].includes(aggregateType)) {
      return res.status(400).json({
        error: { message: 'Invalid aggregate type', code: 'VALIDATION_ERROR' },
      });
    }

    let toTime: Date | undefined;
    if (req.query.toTime) {
      toTime = new Date(req.query.toTime as string);
    }

    const events = await eventLogService.replay(
      aggregateType as 'event' | 'registration',
      aggregateId,
      toTime
    );

    res.json({
      events,
      eventCount: events.length,
      toTime: toTime?.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/aggregate/:aggregateType/:aggregateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aggregateType, aggregateId } = req.params;
    
    if (!['event', 'registration'].includes(aggregateType)) {
      return res.status(400).json({
        error: { message: 'Invalid aggregate type', code: 'VALIDATION_ERROR' },
      });
    }

    let fromTime: Date | undefined;
    if (req.query.fromTime) {
      fromTime = new Date(req.query.fromTime as string);
    }

    const entries = await eventLogService.getByAggregate(
      aggregateType as 'event' | 'registration',
      aggregateId,
      fromTime
    );

    res.json({ entries });
  } catch (error) {
    next(error);
  }
});

export default router;
