import { Activity, User } from '../models';
import { ActivityStatus, LogAction, LogEntity } from '../types';
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { AuditService } from './auditService';
import { Op } from 'sequelize';

export interface CreateActivityData {
  name: string;
  description?: string;
  location: string;
  startTime: Date;
  endTime: Date;
  maxParticipants: number;
}

export interface ActivityQuery {
  status?: ActivityStatus;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export class ActivityService {
  static async create(
    data: CreateActivityData,
    createdBy: string
  ): Promise<Activity> {
    const activity = await Activity.create({
      ...data,
      status: ActivityStatus.DRAFT,
      createdBy
    });

    await AuditService.log(
      LogAction.CREATE,
      LogEntity.ACTIVITY,
      activity.id,
      createdBy,
      undefined,
      activity.toJSON()
    );

    return activity;
  }

  static async update(
    id: string,
    data: Partial<CreateActivityData>,
    userId: string
  ): Promise<Activity> {
    const activity = await Activity.findByPk(id);
    if (!activity) {
      throw new NotFoundError('活动', id);
    }

    const oldValues = activity.toJSON();
    await activity.update(data);

    await AuditService.log(
      LogAction.UPDATE,
      LogEntity.ACTIVITY,
      activity.id,
      userId,
      oldValues,
      activity.toJSON()
    );

    return activity;
  }

  static async updateStatus(
    id: string,
    status: ActivityStatus,
    userId: string
  ): Promise<Activity> {
    const activity = await Activity.findByPk(id);
    if (!activity) {
      throw new NotFoundError('活动', id);
    }

    const oldStatus = activity.status;
    await activity.update({ status });

    await AuditService.log(
      LogAction.STATUS_CHANGE,
      LogEntity.ACTIVITY,
      activity.id,
      userId,
      { status: oldStatus },
      { status }
    );

    return activity;
  }

  static async delete(id: string, userId: string): Promise<void> {
    const activity = await Activity.findByPk(id);
    if (!activity) {
      throw new NotFoundError('活动', id);
    }

    const oldValues = activity.toJSON();
    await activity.destroy();

    await AuditService.log(
      LogAction.DELETE,
      LogEntity.ACTIVITY,
      id,
      userId,
      oldValues
    );
  }

  static async getById(id: string): Promise<Activity> {
    const activity = await Activity.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        }
      ]
    });
    if (!activity) {
      throw new NotFoundError('活动', id);
    }
    return activity;
  }

  static async list(query: ActivityQuery) {
    const {
      status,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = query;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } }
      ];
    }
    if (startDate) {
      where.startTime = { [Op.gte]: startDate };
    }
    if (endDate) {
      where.endTime = { [Op.lte]: endDate };
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Activity.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['startTime', 'DESC']],
      offset,
      limit
    });

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  static async getStatistics(): Promise<any> {
    const total = await Activity.count();
    const byStatus = await Activity.findAll({
      attributes: ['status', [Activity.sequelize!.fn('COUNT', Activity.sequelize!.col('id')), 'count']],
      group: ['status']
    });

    return {
      total,
      byStatus: byStatus.map((item: any) => ({
        status: item.status,
        count: parseInt(item.dataValues.count, 10)
      }))
    };
  }
}
