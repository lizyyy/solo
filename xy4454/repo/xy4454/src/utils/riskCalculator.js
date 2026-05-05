import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

export function calculateRisks({ rooms, sensors, batteries, reservations }) {
  const risks = [];
  
  const batteryThreshold = 20;
  const consecutiveTriggerThreshold = 3;
  const timeoutMinutes = 60;
  const consecutiveTriggerWindowMinutes = 5;
  
  batteries.forEach(battery => {
    if (battery.percentage <= batteryThreshold) {
      const room = rooms.find(r => r.id === battery.roomId);
      const hasReservation = reservations.some(r => r.roomId === battery.roomId);
      
      risks.push({
        id: uuidv4(),
        type: 'low_battery',
        roomId: battery.roomId,
        roomName: room?.name || '未知房间',
        deviceId: battery.deviceId,
        deviceName: battery.deviceName,
        percentage: battery.percentage,
        hasReservation,
        description: `${battery.deviceName} 电量仅为 ${battery.percentage}%${hasReservation ? '，且明日有预约' : ''}`,
        status: 'pending',
        level: hasReservation ? 'high' : 'medium',
        createdAt: dayjs().toISOString()
      });
    }
  });
  
  const roomSensorGroups = {};
  sensors.forEach(sensor => {
    if (!roomSensorGroups[sensor.roomId]) {
      roomSensorGroups[sensor.roomId] = [];
    }
    roomSensorGroups[sensor.roomId].push(sensor);
  });
  
  Object.entries(roomSensorGroups).forEach(([roomId, roomSensors]) => {
    const room = rooms.find(r => r.id === roomId);
    const deviceGroups = {};
    
    roomSensors.forEach(sensor => {
      if (!deviceGroups[sensor.deviceId]) {
        deviceGroups[sensor.deviceId] = [];
      }
      deviceGroups[sensor.deviceId].push(sensor);
    });
    
    Object.entries(deviceGroups).forEach(([deviceId, deviceSensors]) => {
      const sortedSensors = deviceSensors.sort((a, b) => 
        dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf()
      );
      
      let consecutiveCount = 0;
      let firstTriggerTime = null;
      
      for (let i = 0; i < sortedSensors.length; i++) {
        const current = sortedSensors[i];
        
        if (current.type === 'trigger' && !current.isReset) {
          if (firstTriggerTime === null) {
            firstTriggerTime = current.timestamp;
          }
          
          const timeSinceFirst = dayjs(current.timestamp).diff(dayjs(firstTriggerTime), 'minute');
          if (timeSinceFirst <= consecutiveTriggerWindowMinutes) {
            consecutiveCount++;
            
            if (consecutiveCount >= consecutiveTriggerThreshold) {
              const deviceName = rooms.find(r => r.id === roomId)?.devices?.find(d => d.id === deviceId)?.name || deviceId;
              
              risks.push({
                id: uuidv4(),
                type: 'consecutive_trigger',
                roomId: roomId,
                roomName: room?.name || '未知房间',
                deviceId: deviceId,
                deviceName: deviceName,
                triggerCount: consecutiveCount,
                windowMinutes: consecutiveTriggerWindowMinutes,
                description: `${deviceName} 在 ${consecutiveTriggerWindowMinutes} 分钟内连续触发 ${consecutiveCount} 次，疑似误触`,
                status: 'pending',
                level: 'medium',
                createdAt: dayjs().toISOString()
              });
              
              firstTriggerTime = null;
              consecutiveCount = 0;
            }
          } else {
            firstTriggerTime = current.timestamp;
            consecutiveCount = 1;
          }
        }
        
        if (current.type === 'reset') {
          firstTriggerTime = null;
          consecutiveCount = 0;
        }
      }
      
      const lastTrigger = sortedSensors.filter(s => s.type === 'trigger').slice(-1)[0];
      const lastReset = sortedSensors.filter(s => s.type === 'reset').slice(-1)[0];
      
      if (lastTrigger && (!lastReset || dayjs(lastTrigger.timestamp).isAfter(dayjs(lastReset.timestamp)))) {
        const timeSinceTrigger = dayjs().diff(dayjs(lastTrigger.timestamp), 'minute');
        
        if (timeSinceTrigger > timeoutMinutes) {
          const deviceName = rooms.find(r => r.id === roomId)?.devices?.find(d => d.id === deviceId)?.name || deviceId;
          
          risks.push({
            id: uuidv4(),
            type: 'timeout_reset',
            roomId: roomId,
            roomName: room?.name || '未知房间',
            deviceId: deviceId,
            deviceName: deviceName,
            minutesSinceTrigger: timeSinceTrigger,
            description: `${deviceName} 触发后 ${timeSinceTrigger} 分钟未复位，超时未复位`,
            status: 'pending',
            level: 'high',
            createdAt: dayjs().toISOString()
          });
        }
      }
    });
  });
  
  rooms.forEach(room => {
    if (room.hasMaintenance && room.maintenanceDate) {
      const maintenanceDate = dayjs(room.maintenanceDate);
      const tomorrow = dayjs().add(1, 'day').startOf('day');
      
      if (maintenanceDate.isSame(tomorrow, 'day')) {
        const hasReservation = reservations.some(r => 
          r.roomId === room.id && dayjs(r.date).isSame(tomorrow, 'day')
        );
        
        if (hasReservation) {
          const reservation = reservations.find(r => 
            r.roomId === room.id && dayjs(r.date).isSame(tomorrow, 'day')
          );
          
          risks.push({
            id: uuidv4(),
            type: 'maintenance_conflict',
            roomId: room.id,
            roomName: room.name,
            maintenanceDate: room.maintenanceDate,
            reservationTime: reservation?.timeSlot,
            reservationCount: reservation?.count,
            description: `${room.name} 明日有维修计划，但同时有 ${reservation?.count} 人预约在 ${reservation?.timeSlot}，存在冲突`,
            status: 'pending',
            level: 'high',
            createdAt: dayjs().toISOString()
          });
        }
      }
    }
  });
  
  reservations.forEach(reservation => {
    const reservationDate = dayjs(reservation.date);
    const tomorrow = dayjs().add(1, 'day').startOf('day');
    
    if (reservationDate.isSame(tomorrow, 'day')) {
      const roomBatteries = batteries.filter(b => b.roomId === reservation.roomId);
      const lowBatteryDevices = roomBatteries.filter(b => b.percentage <= batteryThreshold);
      
      if (lowBatteryDevices.length > 0) {
        const room = rooms.find(r => r.id === reservation.roomId);
        const deviceNames = lowBatteryDevices.map(d => d.deviceName).join('、');
        
        risks.push({
          id: uuidv4(),
          type: 'low_battery_with_reservation',
          roomId: reservation.roomId,
          roomName: room?.name || '未知房间',
          devices: lowBatteryDevices,
          reservationCount: reservation.count,
          reservationTime: reservation.timeSlot,
          description: `${room?.name} 明日 ${reservation.timeSlot} 有 ${reservation.count} 人预约，但 ${deviceNames} 电量不足`,
          status: 'pending',
          level: 'high',
          createdAt: dayjs().toISOString()
        });
      }
    }
  });
  
  return risks.sort((a, b) => {
    const levelOrder = { high: 0, medium: 1, low: 2 };
    return levelOrder[a.level] - levelOrder[b.level];
  });
}

export const riskTypeLabels = {
  'low_battery': '低电量',
  'consecutive_trigger': '连续误触',
  'timeout_reset': '超时未复位',
  'maintenance_conflict': '维修冲突',
  'low_battery_with_reservation': '低电量且有预约'
};

export const riskLevelColors = {
  'high': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  'medium': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  'low': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' }
};

export const riskStatusLabels = {
  'pending': '待处理',
  'reviewed': '已复核',
  'resolved': '已解决'
};
