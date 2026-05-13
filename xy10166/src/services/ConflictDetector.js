const fs = require('fs');
const path = require('path');
const { format, differenceInMinutes } = require('date-fns');
const Appointment = require('../models/Appointment');
const Conflict = require('../models/Conflict');
const MidnightHandler = require('./MidnightHandler');
const { ResourceType } = require('../models/ResourceTypes');

class ConflictDetector {
  constructor() {
    this.detectedConflicts = [];
  }

  async detectConflicts(options = {}) {
    const { 
      dateRange = null,
      resourceTypes = [ResourceType.DOCTOR, ResourceType.ROOM, ResourceType.EQUIPMENT],
      includeMidnight = true 
    } = options;

    const result = {
      success: false,
      timestamp: new Date(),
      totalAppointments: 0,
      checkedAppointments: 0,
      midnightAppointments: 0,
      includeMidnight,
      conflicts: [],
      statistics: {
        byType: {
          doctor: 0,
          room: 0,
          equipment: 0
        },
        bySeverity: {
          high: 0,
          medium: 0,
          low: 0
        }
      }
    };

    try {
      const dataFile = path.join(process.cwd(), 'data', 'appointments.json');
      if (!fs.existsSync(dataFile)) {
        result.message = '没有找到预约数据，请先导入排班';
        result.success = true;
        return result;
      }

      const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
      const appointments = rawData.map(data => new Appointment(data));
      
      result.totalAppointments = appointments.length;

      const midnightApts = appointments.filter(apt => apt.spansMidnight());
      result.midnightAppointments = midnightApts.length;

      let workingSlots = appointments;
      if (includeMidnight && midnightApts.length > 0) {
        workingSlots = MidnightHandler.normalizeTimeSlots(appointments);
      }

      if (dateRange) {
        workingSlots = this._filterByDateRange(workingSlots, dateRange);
      }

      result.checkedAppointments = workingSlots.length;

      const resourceMap = this._groupByResource(workingSlots);

      for (const resourceType of resourceTypes) {
        if (!resourceMap[resourceType]) continue;
        
        for (const [resourceId, slots] of Object.entries(resourceMap[resourceType])) {
          const sortedSlots = slots.sort((a, b) => 
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          );

          const resourceConflicts = this._detectResourceConflicts(
            sortedSlots, 
            resourceType, 
            resourceId
          );

          for (const conflict of resourceConflicts) {
            result.conflicts.push(conflict);
            result.statistics.byType[resourceType]++;
            result.statistics.bySeverity[conflict.severity]++;
          }
        }
      }

      result.success = true;
      result.message = this._generateResultMessage(result);
      this.detectedConflicts = result.conflicts;

    } catch (error) {
      result.error = error.message;
      result.message = `冲突检测失败: ${error.message}`;
    }

    return result;
  }

  _filterByDateRange(slots, dateRange) {
    const { start, end } = dateRange;
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    return slots.filter(slot => {
      const slotStart = new Date(slot.startTime);
      const slotEnd = new Date(slot.endTime);
      return slotStart <= endDate && slotEnd >= startDate;
    });
  }

  _groupByResource(slots) {
    const resourceMap = {
      [ResourceType.DOCTOR]: {},
      [ResourceType.ROOM]: {},
      [ResourceType.EQUIPMENT]: {}
    };

    for (const slot of slots) {
      const resourceId = slot.doctorId;
      if (resourceId) {
        if (!resourceMap[ResourceType.DOCTOR][resourceId]) {
          resourceMap[ResourceType.DOCTOR][resourceId] = [];
        }
        resourceMap[ResourceType.DOCTOR][resourceId].push(slot);
      }

      const roomId = slot.roomId;
      if (roomId) {
        if (!resourceMap[ResourceType.ROOM][roomId]) {
          resourceMap[ResourceType.ROOM][roomId] = [];
        }
        resourceMap[ResourceType.ROOM][roomId].push(slot);
      }

      const equipId = slot.equipmentId;
      if (equipId) {
        if (!resourceMap[ResourceType.EQUIPMENT][equipId]) {
          resourceMap[ResourceType.EQUIPMENT][equipId] = [];
        }
        resourceMap[ResourceType.EQUIPMENT][equipId].push(slot);
      }
    }

    return resourceMap;
  }

  _detectResourceConflicts(sortedSlots, resourceType, resourceId) {
    const overlapGroups = new Map();

    for (let i = 0; i < sortedSlots.length; i++) {
      for (let j = i + 1; j < sortedSlots.length; j++) {
        const slot1 = sortedSlots[i];
        const slot2 = sortedSlots[j];

        const slotId1 = slot1.slotId || slot1.id;
        const slotId2 = slot2.slotId || slot2.id;
        const originalId1 = slot1.originalId || slot1.id;
        const originalId2 = slot2.originalId || slot2.id;

        const pairKey = [slotId1, slotId2].sort().join('|');
        const originalPairKey = [originalId1, originalId2].sort().join('|');

        const overlap = this._calculateOverlap(slot1, slot2);
        
        if (overlap > 0) {
          if (!overlapGroups.has(originalPairKey)) {
            overlapGroups.set(originalPairKey, {
              appointmentId1: originalId1,
              appointmentId2: originalId2,
              totalOverlap: 0,
              affectedSlots: [],
              segmentDetails: []
            });
          }
          
          const group = overlapGroups.get(originalPairKey);
          group.totalOverlap += overlap;
          
          const slotInfo1 = this._formatSlotInfo(slot1);
          const slotInfo2 = this._formatSlotInfo(slot2);
          
          if (!group.affectedSlots.find(s => s.id === slotInfo1.id && s.startTime === slotInfo1.startTime)) {
            group.affectedSlots.push(slotInfo1);
          }
          if (!group.affectedSlots.find(s => s.id === slotInfo2.id && s.startTime === slotInfo2.startTime)) {
            group.affectedSlots.push(slotInfo2);
          }
          
          group.segmentDetails.push({
            slotId1,
            slotId2,
            overlapMinutes: overlap,
            slot1StartTime: slot1.startTime,
            slot1EndTime: slot1.endTime,
            slot2StartTime: slot2.startTime,
            slot2EndTime: slot2.endTime
          });
        }
      }
    }

    const conflicts = [];
    for (const group of overlapGroups.values()) {
      const conflict = new Conflict({
        appointmentId1: group.appointmentId1,
        appointmentId2: group.appointmentId2,
        resourceType,
        resourceId,
        overlapMinutes: group.totalOverlap,
        affectedSlots: group.affectedSlots.sort((a, b) => 
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        )
      });
      const conflictJson = conflict.toJSON();
      conflictJson.segmentDetails = group.segmentDetails;
      if (group.affectedSlots.some(s => s.isSplit)) {
        conflictJson.isSplitConflict = true;
        conflictJson.totalOverlapMinutes = group.totalOverlap;
      }
      conflicts.push(conflictJson);
    }

    return conflicts;
  }

  _calculateOverlap(slot1, slot2) {
    const start1 = new Date(slot1.startTime).getTime();
    const end1 = new Date(slot1.endTime).getTime();
    const start2 = new Date(slot2.startTime).getTime();
    const end2 = new Date(slot2.endTime).getTime();

    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);

    if (overlapStart < overlapEnd) {
      return Math.round((overlapEnd - overlapStart) / (1000 * 60));
    }
    return 0;
  }

  _formatSlotInfo(slot) {
    return {
      id: slot.id,
      patientId: slot.patientId,
      patientName: slot.patientName,
      startTime: format(new Date(slot.startTime), 'yyyy-MM-dd HH:mm'),
      endTime: format(new Date(slot.endTime), 'yyyy-MM-dd HH:mm'),
      isSplit: slot.isSplit || false
    };
  }

  _generateResultMessage(result) {
    const totalConflicts = result.conflicts.length;
    if (totalConflicts === 0) {
      let msg = `检测完成：检查了 ${result.checkedAppointments} 个预约，未发现冲突`;
      if (result.midnightAppointments > 0 && result.includeMidnight) {
        msg += `（包含 ${result.midnightAppointments} 个跨午夜预约的自动拆分检测）`;
      } else if (result.midnightAppointments > 0 && !result.includeMidnight) {
        msg += `（注意：有 ${result.midnightAppointments} 个跨午夜预约未进行拆分检测）`;
      }
      return msg;
    }
    
    const high = result.statistics.bySeverity.high;
    const medium = result.statistics.bySeverity.medium;
    const low = result.statistics.bySeverity.low;
    
    let msg = `检测完成：发现 ${totalConflicts} 个冲突`;
    if (high > 0) msg += `（严重 ${high}）`;
    if (medium > 0) msg += `（中等 ${medium}）`;
    if (low > 0) msg += `（轻微 ${low}）`;
    
    if (result.midnightAppointments > 0 && result.includeMidnight) {
      msg += `，其中 ${result.midnightAppointments} 个跨午夜预约已自动拆分检测`;
    } else if (result.midnightAppointments > 0 && !result.includeMidnight) {
      msg += `（注意：有 ${result.midnightAppointments} 个跨午夜预约未进行拆分检测）`;
    }
    
    return msg;
  }
}

module.exports = ConflictDetector;
