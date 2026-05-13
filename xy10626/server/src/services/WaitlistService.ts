import { Op, Transaction } from 'sequelize';
import WaitlistQueue from '../models/WaitlistQueue';
import TicketInventory from '../models/TicketInventory';
import CompanionSeat from '../models/CompanionSeat';
import FlowRecord from '../models/FlowRecord';
import sequelize from '../database';
import dayjs from 'dayjs';

class WaitlistService {
  private async createFlowRecord(
    waitlistId: string,
    orderNo: string,
    actionType: FlowRecord['actionType'],
    operator: string,
    beforeValue: any,
    afterValue: any,
    status: 'success' | 'failed' | 'reviewing' = 'success',
    remark?: string
  ) {
    return FlowRecord.create({
      waitlistId,
      orderNo,
      actionType,
      operator,
      beforeValue: JSON.stringify(beforeValue),
      afterValue: JSON.stringify(afterValue),
      status,
      remark
    });
  }

  async getWaitlistList(params: {
    status?: string;
    ticketGrade?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { status, ticketGrade, keyword, page = 1, pageSize = 20 } = params;
    const where: any = {};

    if (status) where.status = status;
    if (ticketGrade) where.ticketGrade = ticketGrade;
    if (keyword) {
      where[Op.or] = [
        { customerName: { [Op.like]: `%${keyword}%` } },
        { customerPhone: { [Op.like]: `%${keyword}%` } },
        { orderNo: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await WaitlistQueue.findAndCountAll({
      where,
      order: [['priority', 'DESC'], ['createdAt', 'ASC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return { total: count, list: rows, page, pageSize };
  }

  async lockWaitlist(id: string, operator: string) {
    const t = await sequelize.transaction();
    try {
      const waitlist = await WaitlistQueue.findByPk(id, { transaction: t });
      if (!waitlist) {
        throw new Error('候补记录不存在');
      }

      const beforeValue = waitlist.toJSON();

      if (waitlist.isLocked && waitlist.lockedBy !== operator) {
        await this.createFlowRecord(
          id,
          waitlist.orderNo,
          'lock',
          operator,
          beforeValue,
          beforeValue,
          'failed',
          '记录已被其他用户锁定'
        );
        await t.commit();
        return { success: false, message: '记录已被其他用户锁定' };
      }

      if (waitlist.status !== 'pending' && waitlist.status !== 'processing') {
        await this.createFlowRecord(
          id,
          waitlist.orderNo,
          'lock',
          operator,
          beforeValue,
          beforeValue,
          'failed',
          '当前状态不允许锁定'
        );
        await t.commit();
        return { success: false, message: '当前状态不允许锁定' };
      }

      await waitlist.update(
        {
          isLocked: true,
          lockedBy: operator,
          lockedAt: new Date(),
          status: 'processing'
        },
        { transaction: t }
      );

      const afterValue = waitlist.toJSON();
      await this.createFlowRecord(id, waitlist.orderNo, 'lock', operator, beforeValue, afterValue);

      await t.commit();
      return { success: true, data: waitlist };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async unlockWaitlist(id: string, operator: string) {
    const t = await sequelize.transaction();
    try {
      const waitlist = await WaitlistQueue.findByPk(id, { transaction: t });
      if (!waitlist) {
        throw new Error('候补记录不存在');
      }

      const beforeValue = waitlist.toJSON();

      if (!waitlist.isLocked) {
        await this.createFlowRecord(
          id,
          waitlist.orderNo,
          'unlock',
          operator,
          beforeValue,
          beforeValue,
          'failed',
          '记录未锁定'
        );
        await t.commit();
        return { success: false, message: '记录未锁定' };
      }

      await waitlist.update(
        {
          isLocked: false,
          lockedBy: null,
          lockedAt: null,
          status: 'pending'
        },
        { transaction: t }
      );

      const afterValue = waitlist.toJSON();
      await this.createFlowRecord(id, waitlist.orderNo, 'unlock', operator, beforeValue, afterValue);

      await t.commit();
      return { success: true, data: waitlist };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async confirmWaitlist(id: string, operator: string, seatNumbers: string[]) {
    const t = await sequelize.transaction();
    try {
      const waitlist = await WaitlistQueue.findByPk(id, { transaction: t });
      if (!waitlist) {
        throw new Error('候补记录不存在');
      }

      const beforeValue = waitlist.toJSON();

      if (!waitlist.isLocked || waitlist.lockedBy !== operator) {
        await this.createFlowRecord(
          id,
          waitlist.orderNo,
          'confirm',
          operator,
          beforeValue,
          beforeValue,
          'failed',
          '请先锁定该记录'
        );
        await t.commit();
        return { success: false, message: '请先锁定该记录' };
      }

      if (seatNumbers.length !== waitlist.quantity) {
        await this.createFlowRecord(
          id,
          waitlist.orderNo,
          'confirm',
          operator,
          beforeValue,
          beforeValue,
          'failed',
          '座位数量与购票数量不一致'
        );
        await t.commit();
        return { success: false, message: '座位数量与购票数量不一致' };
      }

      const inventory = await TicketInventory.findOne({
        where: { ticketGrade: waitlist.ticketGrade },
        transaction: t
      });

      if (!inventory || inventory.availableQuantity < waitlist.quantity) {
        await this.createFlowRecord(
          id,
          waitlist.orderNo,
          'confirm',
          operator,
          beforeValue,
          beforeValue,
          'failed',
          '库存不足'
        );
        await t.commit();
        return { success: false, message: '库存不足' };
      }

      await CompanionSeat.destroy({
        where: { waitlistId: id },
        transaction: t
      });

      const seats = seatNumbers.map((seatNumber, index) => ({
        waitlistId: id,
        seatNumber,
        seatRow: seatNumber.match(/[A-Z]+/)?.[0] || '',
        seatColumn: seatNumber.match(/\d+/)?.[0] || '',
        isMain: index === 0,
        status: 'assigned' as const
      }));

      await CompanionSeat.bulkCreate(seats, { transaction: t });

      await inventory.update(
        {
          lockedQuantity: inventory.lockedQuantity + waitlist.quantity,
          availableQuantity: inventory.availableQuantity - waitlist.quantity
        },
        { transaction: t }
      );

      await waitlist.update(
        {
          status: 'confirmed',
          assignedSeats: JSON.stringify(seatNumbers),
          processedBy: operator
        },
        { transaction: t }
      );

      const afterValue = waitlist.toJSON();
      await this.createFlowRecord(id, waitlist.orderNo, 'confirm', operator, beforeValue, afterValue);

      await t.commit();
      return { success: true, data: waitlist };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async payWaitlist(id: string, operator: string) {
    const t = await sequelize.transaction();
    try {
      const waitlist = await WaitlistQueue.findByPk(id, { transaction: t });
      if (!waitlist) {
        throw new Error('候补记录不存在');
      }

      const beforeValue = waitlist.toJSON();

      if (waitlist.status !== 'confirmed') {
        await this.createFlowRecord(
          id,
          waitlist.orderNo,
          'pay',
          operator,
          beforeValue,
          beforeValue,
          'failed',
          '只有已确认的订单可以支付'
        );
        await t.commit();
        return { success: false, message: '只有已确认的订单可以支付' };
      }

      const inventory = await TicketInventory.findOne({
        where: { ticketGrade: waitlist.ticketGrade },
        transaction: t
      });

      if (inventory) {
        await inventory.update(
          {
            lockedQuantity: inventory.lockedQuantity - waitlist.quantity,
            usedQuantity: inventory.usedQuantity + waitlist.quantity
          },
          { transaction: t }
        );
      }

      await waitlist.update(
        {
          status: 'paid',
          paidAt: new Date(),
          isLocked: false,
          lockedBy: null,
          lockedAt: null
        },
        { transaction: t }
      );

      const afterValue = waitlist.toJSON();
      await this.createFlowRecord(id, waitlist.orderNo, 'pay', operator, beforeValue, afterValue);

      await t.commit();
      return { success: true, data: waitlist };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async cancelWaitlist(id: string, operator: string, needReview: boolean = false) {
    const t = await sequelize.transaction();
    try {
      const waitlist = await WaitlistQueue.findByPk(id, { transaction: t });
      if (!waitlist) {
        throw new Error('候补记录不存在');
      }

      const beforeValue = waitlist.toJSON();

      if (waitlist.status === 'paid') {
        await this.createFlowRecord(
          id,
          waitlist.orderNo,
          'cancel',
          operator,
          beforeValue,
          beforeValue,
          'failed',
          '已支付的订单不能直接取消'
        );
        await t.commit();
        return { success: false, message: '已支付的订单不能直接取消' };
      }

      const flowStatus = needReview ? 'reviewing' : 'success';

      if (!needReview) {
        const inventory = await TicketInventory.findOne({
          where: { ticketGrade: waitlist.ticketGrade },
          transaction: t
        });

        if (inventory && waitlist.status === 'confirmed') {
          await inventory.update(
            {
              lockedQuantity: inventory.lockedQuantity - waitlist.quantity,
              availableQuantity: inventory.availableQuantity + waitlist.quantity
            },
            { transaction: t }
          );
        }

        await CompanionSeat.update(
          { status: 'cancelled' },
          { where: { waitlistId: id }, transaction: t }
        );

        await waitlist.update(
          {
            status: 'cancelled',
            isLocked: false,
            lockedBy: null,
            lockedAt: null
          },
          { transaction: t }
        );
      }

      const afterValue = needReview ? beforeValue : waitlist.toJSON();
      await this.createFlowRecord(
        id,
        waitlist.orderNo,
        'cancel',
        operator,
        beforeValue,
        afterValue,
        flowStatus,
        needReview ? '需要复核' : ''
      );

      await t.commit();
      return { success: true, data: waitlist, needReview };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async modifySeats(id: string, operator: string, newSeatNumbers: string[]) {
    const t = await sequelize.transaction();
    try {
      const waitlist = await WaitlistQueue.findByPk(id, { transaction: t });
      if (!waitlist) {
        throw new Error('候补记录不存在');
      }

      const beforeValue = {
        seats: await CompanionSeat.findAll({ where: { waitlistId: id }, transaction: t })
      };

      if (!waitlist.isLocked || waitlist.lockedBy !== operator) {
        await this.createFlowRecord(
          id,
          waitlist.orderNo,
          'modify_seat',
          operator,
          beforeValue,
          beforeValue,
          'failed',
          '请先锁定该记录'
        );
        await t.commit();
        return { success: false, message: '请先锁定该记录' };
      }

      if (newSeatNumbers.length !== waitlist.quantity) {
        await this.createFlowRecord(
          id,
          waitlist.orderNo,
          'modify_seat',
          operator,
          beforeValue,
          beforeValue,
          'failed',
          '座位数量与购票数量不一致'
        );
        await t.commit();
        return { success: false, message: '座位数量与购票数量不一致' };
      }

      await CompanionSeat.destroy({ where: { waitlistId: id }, transaction: t });

      const seats = newSeatNumbers.map((seatNumber, index) => ({
        waitlistId: id,
        seatNumber,
        seatRow: seatNumber.match(/[A-Z]+/)?.[0] || '',
        seatColumn: seatNumber.match(/\d+/)?.[0] || '',
        isMain: index === 0,
        status: 'assigned' as const
      }));

      await CompanionSeat.bulkCreate(seats, { transaction: t });

      await waitlist.update(
        { assignedSeats: JSON.stringify(newSeatNumbers) },
        { transaction: t }
      );

      const afterValue = { seats: await CompanionSeat.findAll({ where: { waitlistId: id }, transaction: t }) };
      await this.createFlowRecord(id, waitlist.orderNo, 'modify_seat', operator, beforeValue, afterValue);

      await t.commit();
      return { success: true, data: waitlist };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async getFlowRecords(params: {
    operator?: string;
    actionType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { operator, actionType, status, startDate, endDate, page = 1, pageSize = 20 } = params;
    const where: any = {};

    if (operator) where.operator = operator;
    if (actionType) where.actionType = actionType;
    if (status) where.status = status;
    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate + ' 23:59:59')]
      };
    }

    const { count, rows } = await FlowRecord.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return { total: count, list: rows, page, pageSize };
  }

  async getAnomalies() {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    const [lockedOverTime, reviewingRecords, inventoryDiscrepancy] = await Promise.all([
      WaitlistQueue.findAll({
        where: {
          isLocked: true,
          lockedAt: { [Op.lt]: thirtyMinutesAgo }
        }
      }),
      FlowRecord.findAll({
        where: { status: 'reviewing' },
        order: [['createdAt', 'DESC']]
      }),
      TicketInventory.findAll({
        where: {
          [Op.or]: [
            sequelize.literal('totalQuantity != usedQuantity + lockedQuantity + availableQuantity'),
            { availableQuantity: { [Op.lt]: 0 } }
          ]
        }
      })
    ]);

    return {
      lockedOverTime,
      reviewingRecords,
      inventoryDiscrepancy
    };
  }

  async getTicketInventories() {
    return TicketInventory.findAll({ order: [['ticketGrade', 'ASC']] });
  }

  async getCompanionSeats(waitlistId: string) {
    return CompanionSeat.findAll({ where: { waitlistId }, order: [['isMain', 'DESC'], ['seatNumber', 'ASC']] });
  }

  async reviewCancel(id: string, operator: string, approved: boolean) {
    const t = await sequelize.transaction();
    try {
      const flowRecord = await FlowRecord.findByPk(id, { transaction: t });
      if (!flowRecord || flowRecord.status !== 'reviewing') {
        throw new Error('复核记录不存在或状态不正确');
      }

      const beforeValue = flowRecord.toJSON();

      if (approved) {
        const waitlist = await WaitlistQueue.findByPk(flowRecord.waitlistId, { transaction: t });
        if (waitlist) {
          const inventory = await TicketInventory.findOne({
            where: { ticketGrade: waitlist.ticketGrade },
            transaction: t
          });

          if (inventory && waitlist.status === 'confirmed') {
            await inventory.update(
              {
                lockedQuantity: inventory.lockedQuantity - waitlist.quantity,
                availableQuantity: inventory.availableQuantity + waitlist.quantity
              },
              { transaction: t }
            );
          }

          await CompanionSeat.update(
            { status: 'cancelled' },
            { where: { waitlistId: flowRecord.waitlistId }, transaction: t }
          );

          await waitlist.update(
            {
              status: 'cancelled',
              isLocked: false,
              lockedBy: null,
              lockedAt: null
            },
            { transaction: t }
          );
        }
      }

      await flowRecord.update(
        {
          status: approved ? 'success' : 'failed',
          reviewedBy: operator,
          reviewedAt: new Date()
        },
        { transaction: t }
      );

      await t.commit();
      return { success: true };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async exportReport(params: {
    operator?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { operator, startDate, endDate } = params;
    const where: any = {};

    if (operator) where.operator = operator;
    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate + ' 23:59:59')]
      };
    }

    const records = await FlowRecord.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    return records.map(record => ({
      订单号: record.orderNo,
      操作类型: record.actionType,
      操作人: record.operator,
      操作时间: dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      状态: record.status === 'success' ? '成功' : record.status === 'failed' ? '失败' : '待复核',
      修改前: record.beforeValue,
      修改后: record.afterValue,
      备注: record.remark || '',
      复核人: record.reviewedBy || '',
      复核时间: record.reviewedAt ? dayjs(record.reviewedAt).format('YYYY-MM-DD HH:mm:ss') : ''
    }));
  }
}

export default new WaitlistService();
