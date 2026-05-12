import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/client';
import { logger } from '../utils/logger';
import { eventService } from './event.service';
import { eventLogService } from './event-log.service';
import { EventType, RequestContext } from '../types';

export interface CompensationAction {
  id: string;
  sagaId: string;
  stepName: string;
  execute: () => Promise<void>;
  compensate?: () => Promise<void>;
  status: 'pending' | 'completed' | 'failed' | 'compensating' | 'compensated';
}

export interface SagaOptions {
  sagaId?: string;
  context: RequestContext;
}

export class Saga {
  id: string;
  context: RequestContext;
  private actions: CompensationAction[] = [];
  private executedActions: CompensationAction[] = [];
  private isCompensating = false;

  constructor(options: SagaOptions) {
    this.id = options.sagaId || uuidv4();
    this.context = options.context;
    logger.info('Saga started', { sagaId: this.id });
  }

  addAction(action: Omit<CompensationAction, 'id' | 'status'>): void {
    this.actions.push({
      ...action,
      id: uuidv4(),
      sagaId: this.id,
      status: 'pending',
    });
  }

  async execute(): Promise<void> {
    for (const action of this.actions) {
      if (this.isCompensating) break;

      try {
        logger.info('Saga executing step', {
          sagaId: this.id,
          step: action.stepName,
          actionId: action.id,
        });

        action.status = 'pending';
        await action.execute();
        action.status = 'completed';
        this.executedActions.push(action);

        logger.info('Saga step completed', {
          sagaId: this.id,
          step: action.stepName,
          actionId: action.id,
        });
      } catch (error) {
        action.status = 'failed';
        logger.error('Saga step failed', {
          sagaId: this.id,
          step: action.stepName,
          actionId: action.id,
          error: (error as Error).message,
        });

        await this.compensate(error as Error);
        throw error;
      }
    }

    logger.info('Saga completed successfully', { sagaId: this.id });
  }

  private async compensate(originalError: Error): Promise<void> {
    this.isCompensating = true;
    logger.warn('Saga starting compensation', {
      sagaId: this.id,
      originalError: originalError.message,
    });

    for (let i = this.executedActions.length - 1; i >= 0; i--) {
      const action = this.executedActions[i];
      
      if (!action.compensate) {
        logger.warn('Saga step has no compensation action', {
          sagaId: this.id,
          step: action.stepName,
        });
        continue;
      }

      try {
        action.status = 'compensating';
        logger.info('Saga compensating step', {
          sagaId: this.id,
          step: action.stepName,
        });

        await action.compensate();
        action.status = 'compensated';

        logger.info('Saga step compensated', {
          sagaId: this.id,
          step: action.stepName,
        });
      } catch (compensationError) {
        logger.error('Saga compensation failed', {
          sagaId: this.id,
          step: action.stepName,
          originalError: originalError.message,
          compensationError: (compensationError as Error).message,
        });
      }
    }

    logger.error('Saga rolled back', { sagaId: this.id });
  }
}

export class CompensationService {
  async executeWithCompensation<T>(
    context: RequestContext,
    callback: (saga: Saga) => Promise<T>
  ): Promise<T> {
    const saga = new Saga({ context });
    try {
      const result = await callback(saga);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async compensateRegistration(
    registrationId: string,
    eventId: string,
    context: RequestContext
  ): Promise<void> {
    logger.warn('Compensating registration', { registrationId, eventId });

    try {
      await db.transaction(async (client) => {
        await client.query(
          `UPDATE registrations SET status = 'cancelled', version = version + 1 WHERE id = $1`,
          [registrationId]
        );

        await eventService.decrementCurrentParticipants(eventId, client);

        await eventLogService.append(
          'registration',
          registrationId,
          EventType.REGISTRATION_CANCELLED,
          { action: 'compensation' },
          context,
          client
        );
      });

      logger.info('Registration compensated', { registrationId });
    } catch (error) {
      logger.error('Compensation failed', {
        registrationId,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

export const compensationService = new CompensationService();
