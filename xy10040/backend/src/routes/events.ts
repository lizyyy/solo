import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { eventService } from '../services/event.service';
import { CreateEventDto, UpdateEventDto } from '../types';
import { ValidationError } from '../utils/errors';

const router = Router();

const createEventSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(5000).optional(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
  maxParticipants: Joi.number().integer().min(0).required(),
});

const updateEventSchema = Joi.object({
  title: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(5000).optional(),
  startTime: Joi.date().iso().optional(),
  endTime: Joi.date().iso().optional(),
  maxParticipants: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid('draft', 'active', 'cancelled').optional(),
}).min(1);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const result = await eventService.findAll({
      status,
      search,
      page,
      pageSize,
      createdBy: req.userId,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await eventService.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        error: { message: 'Event not found', code: 'NOT_FOUND' },
      });
    }
    return res.json(event);
  } catch (error) {
    next(error);
    return;
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createEventSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid request body', {
        details: error.details.map((d) => d.message),
      });
    }

    const dto: CreateEventDto = {
      ...value,
      startTime: new Date(value.startTime),
      endTime: new Date(value.endTime),
    };

    const event = await eventService.create(dto, req.context);
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = updateEventSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid request body', {
        details: error.details.map((d) => d.message),
      });
    }

    const ifMatch = req.headers['if-match'];
    if (!ifMatch) {
      throw new ValidationError('If-Match header is required for updates');
    }

    const expectedVersion = parseInt(ifMatch, 10);
    if (isNaN(expectedVersion)) {
      throw new ValidationError('Invalid If-Match header value');
    }

    const dto: UpdateEventDto = {
      ...value,
      startTime: value.startTime ? new Date(value.startTime) : undefined,
      endTime: value.endTime ? new Date(value.endTime) : undefined,
    };

    const event = await eventService.update(
      req.params.id,
      dto,
      expectedVersion,
      req.context
    );

    res.setHeader('ETag', event.version.toString());
    res.json(event);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ifMatch = req.headers['if-match'];
    if (!ifMatch) {
      throw new ValidationError('If-Match header is required');
    }

    const expectedVersion = parseInt(ifMatch, 10);
    const event = await eventService.cancel(
      req.params.id,
      expectedVersion,
      req.context
    );

    res.json(event);
  } catch (error) {
    next(error);
  }
});

export default router;
