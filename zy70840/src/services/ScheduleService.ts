import { Op } from 'sequelize';
import VenueSchedule, { ScheduleStatus } from '../models/VenueSchedule';
import Application from '../models/Application';
import dayjs from 'dayjs';

export interface Conflict {
  scheduleId: number;
  applicationId: number | null;
  applicationNo: string | null;
  merchantName: string | null;
  startDate: Date;
  endDate: Date;
  conflictType: string;
  readableConflict: string;
}

export interface ScheduleCheckResult {
  hasConflict: boolean;
  conflicts: Conflict[];
}

class ScheduleService {
  private isDateOverlap(
    start1: Date, end1: Date,
    start2: Date, end2: Date
  ): boolean {
    const s1 = dayjs(start1);
    const e1 = dayjs(end1);
    const s2 = dayjs(start2);
    const e2 = dayjs(end2);
    
    return s1.isBefore(e2) && s2.isBefore(e1);
  }

  async checkConflict(
    venueName: string,
    location: string,
    startDate: Date,
    endDate: Date,
    excludeApplicationId?: number
  ): Promise<ScheduleCheckResult> {
    const schedules = await VenueSchedule.findAll({
      where: {
        venueName,
        location,
        status: { [Op.ne]: ScheduleStatus.AVAILABLE },
        applicationId: {
          [Op.or]: [
            { [Op.ne]: excludeApplicationId },
            { [Op.is]: null }
          ]
        }
      },
      include: [{
        model: Application,
        as: 'application',
        attributes: ['applicationNo', 'merchantName'],
      }],
    });

    const conflicts: Conflict[] = [];

    for (const schedule of schedules) {
      if (this.isDateOverlap(startDate, endDate, schedule.startDate, schedule.endDate)) {
        let conflictType = '';
        let readableConflict = '';

        if (schedule.status === ScheduleStatus.BLOCKED) {
          conflictType = 'blocked';
          readableConflict = `该档期已被封禁，原因：${schedule.blockedReason || '未说明'}，封禁人：${schedule.blockedBy}`;
        } else {
          conflictType = 'occupied';
          readableConflict = `档期冲突，冲突申请：【${schedule.application?.applicationNo || '未知'}】- ${schedule.application?.merchantName || '未知商户'}，占用时间：${dayjs(schedule.startDate).format('YYYY-MM-DD')} 至 ${dayjs(schedule.endDate).format('YYYY-MM-DD')}`;
        }

        conflicts.push({
          scheduleId: schedule.id,
          applicationId: schedule.applicationId,
          applicationNo: schedule.application?.applicationNo || null,
          merchantName: schedule.application?.merchantName || null,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          conflictType,
          readableConflict,
        });
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  }

  async occupySchedule(
    applicationId: number,
    venueName: string,
    location: string,
    startDate: Date,
    endDate: Date
  ) {
    const conflictCheck = await this.checkConflict(venueName, location, startDate, endDate, applicationId);
    if (conflictCheck.hasConflict) {
      throw new Error(`档期冲突：${conflictCheck.conflicts.map(c => c.readableConflict).join('; ')}`);
    }

    const schedule = await VenueSchedule.create({
      applicationId,
      venueName,
      location,
      startDate,
      endDate,
      status: ScheduleStatus.OCCUPIED,
    });

    return schedule;
  }

  async releaseSchedule(applicationId: number) {
    await VenueSchedule.update(
      { status: ScheduleStatus.AVAILABLE, applicationId: null },
      { where: { applicationId } }
    );
  }

  async getSchedulesByVenueAndDate(
    venueName: string,
    location: string,
    startDate: Date,
    endDate: Date
  ) {
    return await VenueSchedule.findAll({
      where: {
        venueName,
        location,
        startDate: { [Op.lte]: endDate },
        endDate: { [Op.gte]: startDate },
      },
      include: [{
        model: Application,
        as: 'application',
        attributes: ['applicationNo', 'merchantName', 'status'],
      }],
      order: [['startDate', 'ASC']],
    });
  }

  async blockSchedule(
    venueName: string,
    location: string,
    startDate: Date,
    endDate: Date,
    blockedBy: string,
    blockedReason: string
  ) {
    return await VenueSchedule.create({
      venueName,
      location,
      startDate,
      endDate,
      status: ScheduleStatus.BLOCKED,
      blockedBy,
      blockedReason,
    });
  }
}

export default new ScheduleService();
