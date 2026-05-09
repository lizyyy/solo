import { Registration, Activity, StatusHistory, User } from '../models';
import {
  RegistrationStatus,
  LogAction,
  LogEntity,
  UserRole
} from '../types';
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  CustomError
} from '../middleware/errorHandler';
import { AuditService } from './auditService';
import { Op, Transaction } from 'sequelize';
import { sequelize } from '../config/database';

export interface CreateRegistrationData {
  activityId: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
}

export interface RegistrationQuery {
  activityId?: string;
  status?: RegistrationStatus;
  search?: string;
  email?: string;
  page?: number;
  limit?: number;
}

export interface BatchStatusUpdate {
  ids: string[];
  newStatus: RegistrationStatus;
  reason?: string;
}

const STATUS_TRANSITIONS: Record<RegistrationStatus, RegistrationStatus[]> = {
  [RegistrationStatus.PENDING]: [
    RegistrationStatus.CONFIRMED,
    RegistrationStatus.CANCELLED
  ],
  [RegistrationStatus.CONFIRMED]: [
    RegistrationStatus.RESCHEDULED,
    RegistrationStatus.CANCELLED,
    RegistrationStatus.NO_SHOW,
    RegistrationStatus.COMPLETED
  ],
  [RegistrationStatus.RESCHEDULED]: [
    RegistrationStatus.CONFIRMED,
    RegistrationStatus.CANCELLED
  ],
  [RegistrationStatus.CANCELLED]: [],
  [RegistrationStatus.NO_SHOW]: [RegistrationStatus.COMPLETED],
  [RegistrationStatus.COMPLETED]: []
};

export class RegistrationService {
  static canTransition(
    currentStatus: RegistrationStatus,
    newStatus: RegistrationStatus
  ): boolean {
    return STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
  }

  static async create(
    data: CreateRegistrationData,
    createdBy: string
  ): Promise<Registration> {
    const activity = await Activity.findByPk(data.activityId);
    if (!activity) {
      throw new NotFoundError('活动', data.activityId);
    }

    const existing = await Registration.findOne({
      where: {
        activityId: data.activityId,
        email: data.email
      }
    });

    if (existing) {
      throw new ConflictError('该邮箱已报名此活动');
    }

    const registration = await Registration.create({
      ...data,
      status: RegistrationStatus.PENDING,
      registrationTime: new Date(),
      createdBy
    });

    await StatusHistory.create({
      registrationId: registration.id,
      newStatus: RegistrationStatus.PENDING,
      changedBy: createdBy,
      reason: '初始报名'
    });

    await AuditService.log(
      LogAction.CREATE,
      LogEntity.REGISTRATION,
      registration.id,
      createdBy,
      undefined,
      registration.toJSON()
    );

    return registration;
  }

  static async update(
    id: string,
    data: Partial<CreateRegistrationData>,
    userId: string
  ): Promise<Registration> {
    const registration = await Registration.findByPk(id);
    if (!registration) {
      throw new NotFoundError('报名记录', id);
    }

    const oldValues = registration.toJSON();
    await registration.update(data);

    await AuditService.log(
      LogAction.UPDATE,
      LogEntity.REGISTRATION,
      id,
      userId,
      oldValues,
      registration.toJSON()
    );

    return registration;
  }

  static async updateStatus(
    id: string,
    newStatus: RegistrationStatus,
    userId: string,
    reason?: string
  ): Promise<Registration> {
    const registration = await Registration.findByPk(id);
    if (!registration) {
      throw new NotFoundError('报名记录', id);
    }

    const oldStatus = registration.status;

    if (oldStatus === newStatus) {
      return registration;
    }

    if (!this.canTransition(oldStatus, newStatus)) {
      throw new CustomError(
        `无法从 ${oldStatus} 转换到 ${newStatus}`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    await sequelize.transaction(async (t: Transaction) => {
      await registration.update({ status: newStatus }, { transaction: t });

      await StatusHistory.create(
        {
          registrationId: id,
          oldStatus,
          newStatus,
          changedBy: userId,
          reason
        },
        { transaction: t }
      );
    });

    await AuditService.log(
      LogAction.STATUS_CHANGE,
      LogEntity.REGISTRATION,
      id,
      userId,
      { status: oldStatus },
      { status: newStatus }
    );

    return registration;
  }

  static async batchUpdateStatus(
    batchUpdate: BatchStatusUpdate,
    userId: string
  ): Promise<{ success: number; failed: number; errors: Array<{ id: string; error: string }> }> {
    const results: { success: number; failed: number; errors: Array<{ id: string; error: string }> } = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const id of batchUpdate.ids) {
      try {
        await this.updateStatus(id, batchUpdate.newStatus, userId, batchUpdate.reason);
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({ id, error: error.message });
      }
    }

    await AuditService.log(
      LogAction.BATCH_OPERATION,
      LogEntity.REGISTRATION,
      'batch-' + Date.now(),
      userId,
      undefined,
      {
        ids: batchUpdate.ids,
        newStatus: batchUpdate.newStatus,
        ...results
      }
    );

    return results;
  }

  static async getById(id: string): Promise<Registration> {
    const registration = await Registration.findByPk(id, {
      include: [
        {
          model: Activity,
          as: 'activity',
          attributes: ['id', 'name', 'startTime', 'location']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: StatusHistory,
          as: 'statusHistory',
          include: [
            {
              model: User,
              as: 'changedByUser',
              attributes: ['id', 'name']
            }
          ],
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!registration) {
      throw new NotFoundError('报名记录', id);
    }

    return registration;
  }

  static async list(query: RegistrationQuery) {
    const {
      activityId,
      status,
      search,
      email,
      page = 1,
      limit = 20
    } = query;

    const where: any = {};
    if (activityId) where.activityId = activityId;
    if (status) where.status = status;
    if (email) where.email = email;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { company: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Registration.findAndCountAll({
      where,
      include: [
        {
          model: Activity,
          as: 'activity',
          attributes: ['id', 'name', 'startTime', 'location']
        }
      ],
      order: [['registrationTime', 'DESC']],
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

  static async delete(id: string, userId: string): Promise<void> {
    const registration = await Registration.findByPk(id);
    if (!registration) {
      throw new NotFoundError('报名记录', id);
    }

    const oldValues = registration.toJSON();
    await registration.destroy();

    await AuditService.log(
      LogAction.DELETE,
      LogEntity.REGISTRATION,
      id,
      userId,
      oldValues
    );
  }

  static async getStatistics(activityId?: string): Promise<any> {
    const where: any = {};
    if (activityId) where.activityId = activityId;

    const total = await Registration.count({ where });
    const byStatus = await Registration.findAll({
      where,
      attributes: ['status', [Registration.sequelize!.fn('COUNT', Registration.sequelize!.col('id')), 'count']],
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

  static async getDuplicateCandidates(activityId: string): Promise<any[]> {
    const duplicates = await Registration.findAll({
      where: { activityId },
      attributes: [
        'email',
        [Registration.sequelize!.fn('COUNT', Registration.sequelize!.col('id')), 'count']
      ],
      group: ['email'],
      having: Registration.sequelize!.literal('COUNT(id) > 1')
    });

    return duplicates.map((d: any) => ({
      email: d.email,
      count: parseInt(d.dataValues.count, 10)
    }));
  }
}
