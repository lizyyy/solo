import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { registrationService } from '../services/registration.service';
import { CreateRegistrationDto, UpdateRegistrationDto } from '../types';
import { ValidationError } from '../utils/errors';

const router = Router();

const createRegistrationSchema = Joi.object({
  eventId: Joi.string().uuid().required(),
  userId: Joi.string().uuid().required(),
  userName: Joi.string().min(1).max(100).required(),
  userEmail: Joi.string().email().max(255).required(),
  userPhone: Joi.string().max(20).optional(),
  notes: Joi.string().max(1000).optional(),
});

const updateRegistrationSchema = Joi.object({
  status: Joi.string().valid('confirmed', 'cancelled').optional(),
  notes: Joi.string().max(1000).optional(),
}).min(1);

router.get('/event/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 50;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const result = await registrationService.findByEvent(req.params.eventId, {
      status,
      search,
      page,
      pageSize,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;
    const status = req.query.status as string;

    const result = await registrationService.findByUser(req.params.userId, {
      status,
      page,
      pageSize,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/check/:eventId/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await registrationService.checkRegistration(
      req.params.eventId,
      req.params.userId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const registration = await registrationService.findById(req.params.id);
    if (!registration) {
      return res.status(404).json({
        error: { message: 'Registration not found', code: 'NOT_FOUND' },
      });
    }
    res.json(registration);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createRegistrationSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid request body', {
        details: error.details.map((d) => d.message),
      });
    }

    const dto: CreateRegistrationDto = value;
    const registration = await registrationService.create(dto, req.context);
    res.status(201).json(registration);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = updateRegistrationSchema.validate(req.body);
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

    const dto: UpdateRegistrationDto = value;
    const registration = await registrationService.update(
      req.params.id,
      dto,
      expectedVersion,
      req.context
    );

    res.setHeader('ETag', registration.version.toString());
    res.json(registration);
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
    const registration = await registrationService.cancel(
      req.params.id,
      expectedVersion,
      req.context
    );

    res.json(registration);
  } catch (error) {
    next(error);
  }
});

export default router;
