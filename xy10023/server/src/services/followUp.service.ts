import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { FollowUp, FollowUpType, FollowUpStatus } from '../models/FollowUp';
import { Ticket, TicketStatus } from '../models/Ticket';
import { EventType, AggregateType, OperatorType } from '../models/Event';
import eventStoreService, { EventData } from './eventStore.service';
import { sequelize } from '../database';
import logger from '../utils/logger';
import redisService from './redis.service';

export interface CreateFollowUpDto {
  ticketId: string;
  content: string;
  followUpType: FollowUpType;
  promisedAction?: string;
  promisedDeadline?: Date;
  assigneeId?: string;
}

export interface UpdateFollowUpDto {
  content?: string;
  followUpType?: FollowUpType;
  promisedAction?: string;
  promisedDeadline?: Date;
  assigneeId?: string;
  status?: FollowUpStatus;
}

export interface CompleteFollowUpDto {
  completionNote: string;
}

class FollowUpService {
  async createFollowUp(
    dto: CreateFollowUpDto,
    operatorId: string,
    requestId?: string
  ): Promise<FollowUp> {
    return redisService.withLock(`followup:create:${dto.ticketId}`, async () => {
      const transaction = await sequelize.transaction();

      try {
        const ticket = await Ticket.findByPk(dto.ticketId, { transaction });
        if (!ticket) {
          throw new Error('Ticket not found');
        }

        const followUpId = uuidv4();

        const followUp = await FollowUp.create(
          {
            id: followUpId,
            ticketId: dto.ticketId,
            content: dto.content,
            followUpType: dto.followUpType,
            promisedAction: dto.promisedAction,
            promisedDeadline: dto.promisedDeadline,
            assigneeId: dto.assigneeId,
            createdBy: operatorId,
            status: FollowUpStatus.PENDING,
          },
          { transaction }
        );

        if (dto.promisedAction || dto.promisedDeadline) {
          await Ticket.update(
            { status: TicketStatus.PENDING_FOLLOWUP },
            { where: { id: dto.ticketId }, transaction }
          );
        }

        const eventData: EventData = {
          aggregateId: dto.ticketId,
          aggregateType: AggregateType.TICKET,
          eventType: EventType.FOLLOW_UP_ADDED,
          eventData: {
            followUpId,
            content: dto.content,
            followUpType: dto.followUpType,
            promisedAction: dto.promisedAction,
            promisedDeadline: dto.promisedDeadline,
            assigneeId: dto.assigneeId,
          },
          operatorId,
          operatorType: OperatorType.USER,
          requestId,
        };

        await eventStoreService.appendEvent(eventData, transaction);

        await transaction.commit();

        logger.info(`Follow-up created: ${followUpId} for ticket: ${dto.ticketId}`);

        return followUp;
      } catch (error) {
        await transaction.rollback();
        logger.error('Failed to create follow-up:', error);
        throw error;
      }
    });
  }

  async getFollowUpById(followUpId: string): Promise<FollowUp | null> {
    return FollowUp.findByPk(followUpId, {
      include: [
        { association: 'ticket' },
        { association: 'creator' },
        { association: 'followUpAssignee' },
      ],
    });
  }

  async getFollowUpsByTicket(ticketId: string): Promise<FollowUp[]> {
    return FollowUp.findAll({
      where: { ticketId },
      order: [['createdAt', 'DESC']],
      include: [
        { association: 'creator' },
        { association: 'followUpAssignee' },
      ],
    });
  }

  async getPendingFollowUps(assigneeId?: string): Promise<FollowUp[]> {
    const where: Record<string, unknown> = {
      status: { [Op.in]: [FollowUpStatus.PENDING, FollowUpStatus.IN_PROGRESS] } as any,
    };

    if (assigneeId) {
      where['assigneeId'] = assigneeId;
    }

    return FollowUp.findAll({
      where,
      order: [['promisedDeadline', 'ASC']],
      include: [
        { association: 'ticket' },
        { association: 'creator' },
      ],
    });
  }

  async getOverdueFollowUps(): Promise<FollowUp[]> {
    const now = new Date();
    
    return FollowUp.findAll({
      where: {
        status: FollowUpStatus.PENDING,
        promisedDeadline: { [Op.lt]: now } as any,
      },
      order: [['promisedDeadline', 'ASC']],
      include: [
        { association: 'ticket' },
        { association: 'followUpAssignee' },
      ],
    });
  }

  async updateFollowUp(
    followUpId: string,
    dto: UpdateFollowUpDto,
    operatorId: string,
    requestId?: string
  ): Promise<FollowUp> {
    const transaction = await sequelize.transaction();

    try {
      const followUp = await FollowUp.findByPk(followUpId, { transaction });
      if (!followUp) {
        throw new Error('Follow-up not found');
      }

      await followUp.update(dto, { transaction });

      const eventData: EventData = {
        aggregateId: followUp.ticketId,
        aggregateType: AggregateType.TICKET,
        eventType: EventType.FOLLOW_UP_UPDATED,
        eventData: {
          followUpId,
          changes: dto,
        },
        operatorId,
        operatorType: OperatorType.USER,
        requestId,
      };

      await eventStoreService.appendEvent(eventData, transaction);

      await transaction.commit();

      logger.info(`Follow-up updated: ${followUpId}`);

      return followUp;
    } catch (error) {
      await transaction.rollback();
      logger.error('Failed to update follow-up:', error);
      throw error;
    }
  }

  async completeFollowUp(
    followUpId: string,
    dto: CompleteFollowUpDto,
    operatorId: string,
    requestId?: string
  ): Promise<FollowUp> {
    const transaction = await sequelize.transaction();

    try {
      const followUp = await FollowUp.findByPk(followUpId, { transaction });
      if (!followUp) {
        throw new Error('Follow-up not found');
      }

      if (followUp.status === FollowUpStatus.COMPLETED) {
        return followUp;
      }

      const now = new Date();
      await followUp.update(
        {
          status: FollowUpStatus.COMPLETED,
          completedAt: now,
          completionNote: dto.completionNote,
        },
        { transaction }
      );

      const pendingCount = await FollowUp.count({
        where: {
          ticketId: followUp.ticketId,
          status: { [Op.in]: [FollowUpStatus.PENDING, FollowUpStatus.IN_PROGRESS] } as any,
        },
        transaction,
      });

      if (pendingCount === 0) {
        const ticket = await Ticket.findByPk(followUp.ticketId, { transaction });
        if (ticket && ticket.status === TicketStatus.PENDING_FOLLOWUP) {
          await ticket.update(
            { status: TicketStatus.IN_PROGRESS },
            { transaction }
          );
        }
      }

      const eventData: EventData = {
        aggregateId: followUp.ticketId,
        aggregateType: AggregateType.TICKET,
        eventType: EventType.FOLLOW_UP_COMPLETED,
        eventData: {
          followUpId,
          completionNote: dto.completionNote,
          completedAt: now,
          wasOverdue: followUp.promisedDeadline && followUp.promisedDeadline < now,
        },
        operatorId,
        operatorType: OperatorType.USER,
        requestId,
      };

      await eventStoreService.appendEvent(eventData, transaction);

      await transaction.commit();

      logger.info(`Follow-up completed: ${followUpId}`);

      return followUp;
    } catch (error) {
      await transaction.rollback();
      logger.error('Failed to complete follow-up:', error);
      throw error;
    }
  }

  async compensateFollowUp(
    followUpId: string,
    compensationDetails: Record<string, unknown>,
    operatorId: string,
    requestId?: string
  ): Promise<FollowUp> {
    const transaction = await sequelize.transaction();

    try {
      const followUp = await FollowUp.findByPk(followUpId, { transaction });
      if (!followUp) {
        throw new Error('Follow-up not found');
      }

      const compensationFollowUp = await FollowUp.create(
        {
          id: uuidv4(),
          ticketId: followUp.ticketId,
          content: `补偿操作：${JSON.stringify(compensationDetails)}`,
          followUpType: FollowUpType.COMPENSATION,
          createdBy: operatorId,
          status: FollowUpStatus.COMPLETED,
          completedAt: new Date(),
        },
        { transaction }
      );

      const eventData: EventData = {
        aggregateId: followUp.ticketId,
        aggregateType: AggregateType.TICKET,
        eventType: EventType.COMPENSATION_APPLIED,
        eventData: {
          originalFollowUpId: followUpId,
          compensationFollowUpId: compensationFollowUp.id,
          compensationDetails,
        },
        operatorId,
        operatorType: OperatorType.USER,
        requestId,
      };

      await eventStoreService.appendEvent(eventData, transaction);

      await transaction.commit();

      logger.info(
        `Compensation applied for follow-up: ${followUpId}, new follow-up: ${compensationFollowUp.id}`
      );

      return compensationFollowUp;
    } catch (error) {
      await transaction.rollback();
      logger.error('Failed to apply compensation:', error);
      throw error;
    }
  }

  async markOverdueFollowUps(): Promise<number> {
    const now = new Date();
    
    const [updatedCount] = await FollowUp.update(
      { status: FollowUpStatus.OVERDUE },
      {
        where: {
          status: FollowUpStatus.PENDING,
          promisedDeadline: { [Op.lt]: now } as any,
        },
      }
    );

    if (updatedCount > 0) {
      logger.info(`Marked ${updatedCount} follow-ups as overdue`);
    }

    return updatedCount;
  }

  async getFollowUpStats(): Promise<{
    total: number;
    byStatus: Record<FollowUpStatus, number>;
    byType: Record<FollowUpType, number>;
    overdue: number;
    completedThisWeek: number;
  }> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [total, statusCounts, typeCounts, overdue, completedThisWeek] = await Promise.all([
      FollowUp.count(),
      this.countByStatus(),
      this.countByType(),
      FollowUp.count({
        where: {
          status: { [Op.in]: [FollowUpStatus.OVERDUE, FollowUpStatus.PENDING] } as any,
          promisedDeadline: { [Op.lt]: new Date() } as any,
        },
      }),
      FollowUp.count({
        where: {
          status: FollowUpStatus.COMPLETED,
          completedAt: { [Op.gte]: weekAgo } as any,
        },
      }),
    ]);

    return {
      total,
      byStatus: statusCounts,
      byType: typeCounts,
      overdue,
      completedThisWeek,
    };
  }

  private async countByStatus(): Promise<Record<FollowUpStatus, number>> {
    const counts: Record<string, number> = {};
    for (const status of Object.values(FollowUpStatus)) {
      counts[status] = await FollowUp.count({ where: { status } });
    }
    return counts as Record<FollowUpStatus, number>;
  }

  private async countByType(): Promise<Record<FollowUpType, number>> {
    const counts: Record<string, number> = {};
    for (const type of Object.values(FollowUpType)) {
      counts[type] = await FollowUp.count({ where: { followUpType: type } });
    }
    return counts as Record<FollowUpType, number>;
  }
}

export const followUpService = new FollowUpService();
export default followUpService;
