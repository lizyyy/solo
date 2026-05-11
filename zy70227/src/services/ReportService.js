const { Op } = require('sequelize');
const { Conference, Schedule, LanguageChannel, Interpreter, Device, Room } = require('../models');
const { ConferenceStatus, ScheduleStatus } = require('../enums');

class ReportService {
  static async getConferenceDashboard(conferenceId) {
    const conference = await Conference.findByPk(conferenceId, {
      include: [
        { model: Room, as: 'room' },
        { model: LanguageChannel, as: 'channels' }
      ]
    });

    if (!conference) {
      return null;
    }

    const schedules = await Schedule.findAll({
      where: { conferenceId },
      include: ['channel', 'interpreter', 'device']
    });

    const statusCounts = {
      draft: schedules.filter(s => s.status === ScheduleStatus.DRAFT).length,
      confirmed: schedules.filter(s => s.status === ScheduleStatus.CONFIRMED).length,
      inUse: schedules.filter(s => s.status === ScheduleStatus.IN_USE).length,
      completed: schedules.filter(s => s.status === ScheduleStatus.COMPLETED).length,
      cancelled: schedules.filter(s => s.status === ScheduleStatus.CANCELLED).length
    };

    const channels = conference.channels.map(channel => {
      const channelSchedules = schedules.filter(s => s.channelId === channel.id);
      return {
        channel: {
          id: channel.id,
          language: channel.language,
          channelNumber: channel.channelNumber
        },
        schedules: channelSchedules.map(s => ({
          id: s.id,
          interpreter: s.interpreter ? { id: s.interpreter.id, name: s.interpreter.name } : null,
          device: s.device ? { id: s.device.id, name: s.device.name } : null,
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status
        })),
        stats: {
          total: channelSchedules.length,
          confirmed: channelSchedules.filter(s => s.status === ScheduleStatus.CONFIRMED).length,
          inUse: channelSchedules.filter(s => s.status === ScheduleStatus.IN_USE).length
        }
      };
    });

    const interpreterStats = {};
    schedules.forEach(schedule => {
      if (schedule.interpreter) {
        const intId = schedule.interpreter.id;
        if (!interpreterStats[intId]) {
          interpreterStats[intId] = {
            interpreter: { id: schedule.interpreter.id, name: schedule.interpreter.name },
            schedules: []
          };
        }
        interpreterStats[intId].schedules.push({
          id: schedule.id,
          channel: schedule.channel ? { language: schedule.channel.language, channelNumber: schedule.channel.channelNumber } : null,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          status: schedule.status
        });
      }
    });

    return {
      conference: {
        id: conference.id,
        title: conference.title,
        status: conference.status,
        startTime: conference.startTime,
        endTime: conference.endTime,
        room: conference.room ? { id: conference.room.id, name: conference.room.name } : null
      },
      statusCounts,
      channels,
      interpreters: Object.values(interpreterStats),
      totalSchedules: schedules.length
    };
  }

  static async getOverallDashboard(startTime, endTime) {
    const where = {};
    if (startTime && endTime) {
      where[Op.and] = [
        { startTime: { [Op.lte]: endTime } },
        { endTime: { [Op.gte]: startTime } }
      ];
    }

    const conferences = await Conference.findAll({
      where,
      include: ['room', 'channels']
    });

    const schedules = await Schedule.findAll({
      include: ['conference', 'channel', 'interpreter', 'device']
    });

    const conferenceStats = conferences.map(conf => {
      const confSchedules = schedules.filter(s => s.conferenceId === conf.id);
      return {
        conference: {
          id: conf.id,
          title: conf.title,
          status: conf.status,
          startTime: conf.startTime,
          endTime: conf.endTime,
          channels: conf.channels.map(c => ({ language: c.language, channelNumber: c.channelNumber }))
        },
        scheduleStats: {
          total: confSchedules.length,
          draft: confSchedules.filter(s => s.status === ScheduleStatus.DRAFT).length,
          confirmed: confSchedules.filter(s => s.status === ScheduleStatus.CONFIRMED).length,
          inUse: confSchedules.filter(s => s.status === ScheduleStatus.IN_USE).length,
          completed: confSchedules.filter(s => s.status === ScheduleStatus.COMPLETED).length
        }
      };
    });

    const interpreterUtilization = {};
    schedules.forEach(schedule => {
      if (schedule.interpreter && schedule.status !== ScheduleStatus.CANCELLED) {
        const intId = schedule.interpreter.id;
        if (!interpreterUtilization[intId]) {
          interpreterUtilization[intId] = {
            interpreter: { id: schedule.interpreter.id, name: schedule.interpreter.name, languages: schedule.interpreter.languages },
            totalHours: 0,
            schedules: 0
          };
        }
        const duration = (new Date(schedule.endTime) - new Date(schedule.startTime)) / (1000 * 60 * 60);
        interpreterUtilization[intId].totalHours += duration;
        interpreterUtilization[intId].schedules++;
      }
    });

    const deviceUtilization = {};
    schedules.forEach(schedule => {
      if (schedule.device && schedule.status !== ScheduleStatus.CANCELLED) {
        const devId = schedule.device.id;
        if (!deviceUtilization[devId]) {
          deviceUtilization[devId] = {
            device: { id: schedule.device.id, name: schedule.device.name, type: schedule.device.type },
            totalHours: 0,
            schedules: 0
          };
        }
        const duration = (new Date(schedule.endTime) - new Date(schedule.startTime)) / (1000 * 60 * 60);
        deviceUtilization[devId].totalHours += duration;
        deviceUtilization[devId].schedules++;
      }
    });

    return {
      summary: {
        totalConferences: conferences.length,
        totalSchedules: schedules.length,
        activeConferences: conferences.filter(c => c.status === ConferenceStatus.IN_PROGRESS).length,
        plannedConferences: conferences.filter(c => c.status === ConferenceStatus.PLANNED).length
      },
      conferences: conferenceStats,
      interpreterUtilization: Object.values(interpreterUtilization),
      deviceUtilization: Object.values(deviceUtilization)
    };
  }

  static async checkConflictsInTimeRange(startTime, endTime) {
    const schedules = await Schedule.findAll({
      where: {
        status: { [Op.in]: [ScheduleStatus.DRAFT, ScheduleStatus.CONFIRMED, ScheduleStatus.IN_USE] }
      },
      include: ['channel', 'interpreter', 'device', 'conference']
    });

    const interpreterConflicts = [];
    const deviceConflicts = [];

    const relevantSchedules = schedules.filter(s => {
      return this.isTimeOverlap(s.startTime, s.endTime, startTime, endTime);
    });

    for (let i = 0; i < relevantSchedules.length; i++) {
      for (let j = i + 1; j < relevantSchedules.length; j++) {
        const s1 = relevantSchedules[i];
        const s2 = relevantSchedules[j];

        if (this.isTimeOverlap(s1.startTime, s1.endTime, s2.startTime, s2.endTime)) {
          if (s1.interpreterId === s2.interpreterId) {
            interpreterConflicts.push({
              type: 'interpreter',
              interpreter: s1.interpreter ? { id: s1.interpreter.id, name: s1.interpreter.name } : null,
              schedule1: this.scheduleToSummary(s1),
              schedule2: this.scheduleToSummary(s2)
            });
          }

          if (s1.deviceId === s2.deviceId) {
            deviceConflicts.push({
              type: 'device',
              device: s1.device ? { id: s1.device.id, name: s1.device.name } : null,
              schedule1: this.scheduleToSummary(s1),
              schedule2: this.scheduleToSummary(s2)
            });
          }
        }
      }
    }

    return {
      timeRange: { startTime, endTime },
      interpreterConflicts,
      deviceConflicts,
      totalConflicts: interpreterConflicts.length + deviceConflicts.length
    };
  }

  static isTimeOverlap(start1, end1, start2, end2) {
    const s1 = new Date(start1).getTime();
    const e1 = new Date(end1).getTime();
    const s2 = new Date(start2).getTime();
    const e2 = new Date(end2).getTime();
    return s1 < e2 && e1 > s2;
  }

  static scheduleToSummary(schedule) {
    return {
      id: schedule.id,
      conference: schedule.conference ? { id: schedule.conference.id, title: schedule.conference.title } : null,
      channel: schedule.channel ? { language: schedule.channel.language, channelNumber: schedule.channel.channelNumber } : null,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      status: schedule.status
    };
  }
}

module.exports = ReportService;
