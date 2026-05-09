import { Op, Transaction } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { Ticket, TicketStatus, TicketPriority, VersionConflictError } from '../models/Ticket';
import { FollowUp, FollowUpStatus } from '../models/FollowUp';
import { Event, EventType, AggregateType, OperatorType } from '../models/Event';
import eventStoreService, { EventData } from './eventStore.service';
import redisService from './redis.service';
import { sequelize } from '../database';
import logger from '../utils/logger';
import { config } from '../config';

export interface CreateTicketDto {
  title: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  category?: string;
  description?: string;
  priority?: TicketPriority;
}

export interface UpdateTicketDto {
  title?: string;
  customerName?: string;
  customerPhone?: string;
  category?: string;
  description?: string;
  priority?: TicketPriority;
  assigneeId?: string;
}

export interface TicketQuery {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  assigneeId?: string;
  customerId?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

interface TicketState {
  id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  version: number;
  [key: string]: unknown;
}

class TicketService {
  private readonly CACHE_PREFIX = 'ticket:';
  private readonly CACHE_TTL = config.cache.ttl;

  async createTicket(
    dto: CreateTicketDto,
    operatorId: string,
    requestId?: string
  ): Promise<Ticket> {
    return redisService.withLock(`ticket:create:${dto.customerId}`, async () => {
      const transaction = await sequelize.transaction();

      try {
        const ticketId = uuidv4();

        const ticket = await Ticket.create(
          {
            id: ticketId,
            title: dto.title,
            customerId: dto.customerId,
            customerName: dto.customerName,
            customerPhone: dto.customerPhone,
            category: dto.category,
            description: dto.description,
            priority: dto.priority || TicketPriority.NORMAL,
            status: TicketStatus.OPEN,
            version: 1,
          },
          { transaction }
        );

        const eventData: EventData = {
          aggregateId: ticketId,
          aggregateType: AggregateType.TICKET,
          eventType: EventType.TICKET_CREATED,
          eventData: {
            title: dto.title,
            customerId: dto.customerId,
            customerName: dto.customerName,
            customerPhone: dto.customerPhone,
            category: dto.category,
            description: dto.description,
            priority: dto.priority || TicketPriority.NORMAL,
          },
          operatorId,
          operatorType: OperatorType.USER,
          requestId,
        };

        await eventStoreService.appendEvent(eventData, transaction);

        await transaction.commit();

        await this.cacheTicket(ticket);

        logger.info(`Ticket created: ${ticketId} by operator: ${operatorId}`);

        return ticket;
      } catch (error) {
        await transaction.rollback();
        logger.error('Failed to create ticket:', error);
        throw error;
      }
    });
  }

  async getTicketById(ticketId: string): Promise<Ticket | null> {
    const cached = await this.getCachedTicket(ticketId);
    if (cached) {
      return cached;
    }

    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        {
          association: 'followUps',
          separate: true,
          order: [['createdAt', 'DESC']],
        },
      ],
    });

    if (ticket) {
      await this.cacheTicket(ticket);
    }

    return ticket;
  }

  async getTickets(query: TicketQuery): Promise<{
    tickets: Ticket[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};

    if (query.status && query.status.length > 0) {
      where['status'] = { [Op.in]: query.status } as any;
    }

    if (query.priority && query.priority.length > 0) {
      where['priority'] = { [Op.in]: query.priority } as any;
    }

    if (query.assigneeId) {
      where['assigneeId'] = query.assigneeId;
    }

    if (query.customerId) {
      where['customerId'] = query.customerId;
    }

    if (query.category) {
      where['category'] = query.category;
    }

    if (query.search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${query.search}%` } as any },
        { description: { [Op.iLike]: `%${query.search}%` } as any },
        { customerName: { [Op.iLike]: `%${query.search}%` } as any },
      ] as any;
    }

    const order: [string, string][] = [[query.sortBy || 'createdAt', query.sortOrder || 'DESC']];

    const { count, rows } = await Ticket.findAndCountAll({
      where,
      order,
      limit: pageSize,
      offset,
    });

    return {
      tickets: rows,
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize),
    };
  }

  async updateTicket(
    ticketId: string,
    dto: UpdateTicketDto,
    expectedVersion: number,
    operatorId: string,
    requestId?: string
  ): Promise<Ticket> {
    const transaction = await sequelize.transaction();

    try {
      const existingTicket = await Ticket.findByPk(ticketId, { transaction });
      if (!existingTicket) {
        throw new Error('Ticket not found');
      }

      let updatedTicket: Ticket;
      try {
        updatedTicket = await Ticket.updateWithOptimisticLock(
          ticketId,
          dto,
          expectedVersion
        );
      } catch (error) {
        if (error instanceof VersionConflictError) {
          await transaction.rollback();
          throw error;
        }
        throw error;
      }

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      Object.keys(dto).forEach((key) => {
        const k = key as keyof UpdateTicketDto;
        if (dto[k] !== undefined && dto[k] !== (existingTicket as any)[k]) {
          changes[key] = {
            old: (existingTicket as any)[k],
            new: dto[k],
          };
        }
      });

      if (Object.keys(changes).length > 0) {
        const eventData: EventData = {
          aggregateId: ticketId,
          aggregateType: AggregateType.TICKET,
          eventType: EventType.TICKET_UPDATED,
          eventData: {
            changes,
            previousVersion: expectedVersion,
            newVersion: expectedVersion + 1,
          },
          operatorId,
          operatorType: OperatorType.USER,
          requestId,
        };

        await eventStoreService.appendEvent(eventData, transaction);
      }

      await transaction.commit();

      await this.cacheTicket(updatedTicket);
      await this.invalidateTicketListCache();

      logger.info(`Ticket updated: ${ticketId} to version ${expectedVersion + 1}`);

      return updatedTicket;
    } catch (error) {
      await transaction.rollback();
      logger.error('Failed to update ticket:', error);
      throw error;
    }
  }

  async changeStatus(
    ticketId: string,
    newStatus: TicketStatus,
    expectedVersion: number,
    operatorId: string,
    reason?: string,
    requestId?: string
  ): Promise<Ticket> {
    const transaction = await sequelize.transaction();

    try {
      const existingTicket = await Ticket.findByPk(ticketId, { transaction });
      if (!existingTicket) {
        throw new Error('Ticket not found');
      }

      if (existingTicket.status === newStatus) {
        return existingTicket;
      }

      const updatedTicket = await Ticket.updateWithOptimisticLock(
        ticketId,
        { status: newStatus },
        expectedVersion
      );

      const eventData: EventData = {
        aggregateId: ticketId,
        aggregateType: AggregateType.TICKET,
        eventType: EventType.TICKET_STATUS_CHANGED,
        eventData: {
          oldStatus: existingTicket.status,
          newStatus,
          reason,
          previousVersion: expectedVersion,
          newVersion: expectedVersion + 1,
        },
        operatorId,
        operatorType: OperatorType.USER,
        requestId,
      };

      await eventStoreService.appendEvent(eventData, transaction);

      await transaction.commit();

      await this.cacheTicket(updatedTicket);
      await this.invalidateTicketListCache();

      logger.info(
        `Ticket status changed: ${ticketId} ${existingTicket.status} -> ${newStatus}`
      );

      return updatedTicket;
    } catch (error) {
      await transaction.rollback();
      logger.error('Failed to change ticket status:', error);
      throw error;
    }
  }

  async assignTicket(
    ticketId: string,
    assigneeId: string | null,
    expectedVersion: number,
    operatorId: string,
    requestId?: string
  ): Promise<Ticket> {
    const transaction = await sequelize.transaction();

    try {
      const existingTicket = await Ticket.findByPk(ticketId, { transaction });
      if (!existingTicket) {
        throw new Error('Ticket not found');
      }

      const updatedTicket = await Ticket.updateWithOptimisticLock(
        ticketId,
        { assigneeId: assigneeId || undefined },
        expectedVersion
      );

      const eventData: EventData = {
        aggregateId: ticketId,
        aggregateType: AggregateType.TICKET,
        eventType: EventType.TICKET_ASSIGNED,
        eventData: {
          oldAssigneeId: existingTicket.assigneeId,
          newAssigneeId: assigneeId,
        },
        operatorId,
        operatorType: OperatorType.USER,
        requestId,
      };

      await eventStoreService.appendEvent(eventData, transaction);

      await transaction.commit();

      await this.cacheTicket(updatedTicket);
      await this.invalidateTicketListCache();

      logger.info(`Ticket assigned: ${ticketId} to ${assigneeId}`);

      return updatedTicket;
    } catch (error) {
      await transaction.rollback();
      logger.error('Failed to assign ticket:', error);
      throw error;
    }
  }

  async getTicketEvents(ticketId: string): Promise<Event[]> {
    return eventStoreService.getEvents(ticketId);
  }

  async replayTicketToVersion(
    ticketId: string,
    targetVersion: number
  ): Promise<{ state: TicketState; events: Event[] }> {
    const initialState: TicketState = {
      id: ticketId,
      title: '',
      status: TicketStatus.OPEN,
      priority: TicketPriority.NORMAL,
      version: 0,
    };

    const result = await eventStoreService.replayToVersion(
      ticketId,
      targetVersion,
      initialState,
      this.ticketStateReducer
    );

    return {
      state: result.state as TicketState,
      events: result.events,
    };
  }

  private ticketStateReducer(state: TicketState, event: Event): TicketState {
    const newState = { ...state };

    switch (event.eventType) {
      case EventType.TICKET_CREATED:
        newState.title = (event.eventData.title as string) || '';
        newState.status = TicketStatus.OPEN;
        newState.priority = (event.eventData.priority as TicketPriority) || TicketPriority.NORMAL;
        break;

      case EventType.TICKET_UPDATED:
        const changes = event.eventData.changes as Record<string, { new: unknown }>;
        if (changes?.title) newState.title = changes.title.new as string;
        if (changes?.priority) newState.priority = changes.priority.new as TicketPriority;
        break;

      case EventType.TICKET_STATUS_CHANGED:
        newState.status = event.eventData.newStatus as TicketStatus;
        break;
    }

    newState.version = event.version;
    return newState;
  }

  async getStats(): Promise<{
    total: number;
    byStatus: Record<TicketStatus, number>;
    byPriority: Record<TicketPriority, number>;
    overdueFollowUps: number;
  }> {
    const cacheKey = `${this.CACHE_PREFIX}stats`;
    const cached = await redisService.getJSON<Record<string, unknown>>(cacheKey);
    
    if (cached) {
      return cached as ReturnType<typeof this.getStats>;
    }

    const [total, statusCounts, priorityCounts, overdueCount] = await Promise.all([
      Ticket.count(),
      this.countByStatus(),
      this.countByPriority(),
      FollowUp.count({
        where: {
          status: FollowUpStatus.PENDING,
          promisedDeadline: { [Op.lt]: new Date() } as any,
        },
      }),
    ]);

    const stats = {
      total,
      byStatus: statusCounts,
      byPriority: priorityCounts,
      overdueFollowUps: overdueCount,
    };

    await redisService.setJSON(cacheKey, stats, 300);

    return stats;
  }

  private async countByStatus(): Promise<Record<TicketStatus, number>> {
    const counts: Record<string, number> = {};
    for (const status of Object.values(TicketStatus)) {
      counts[status] = await Ticket.count({ where: { status } });
    }
    return counts as Record<TicketStatus, number>;
  }

  private async countByPriority(): Promise<Record<TicketPriority, number>> {
    const counts: Record<string, number> = {};
    for (const priority of Object.values(TicketPriority)) {
      counts[priority] = await Ticket.count({ where: { priority } });
    }
    return counts as Record<TicketPriority, number>;
  }

  private async cacheTicket(ticket: Ticket): Promise<void> {
    await redisService.setJSON(
      `${this.CACHE_PREFIX}${ticket.id}`,
      ticket.toJSON(),
      this.CACHE_TTL
    );
  }

  private async getCachedTicket(ticketId: string): Promise<Ticket | null> {
    const cached = await redisService.getJSON(`${this.CACHE_PREFIX}${ticketId}`);
    if (!cached) return null;
    return Ticket.build(cached as Record<string, unknown>);
  }

  private async invalidateTicketListCache(): Promise<void> {
    await redisService.del(`${this.CACHE_PREFIX}stats`);
  }
}

export const ticketService = new TicketService();
export default ticketService;
