import type {
  Sensor,
  WorkOrder,
  Thresholds,
  Alert,
  InspectionSuggestion,
} from '../types';

const THIRTY_MINUTES = 30 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const TWO_HOURS = 2 * 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function detectContinuousThresholdViolations(
  sensors: Sensor[],
  thresholds: Thresholds,
  currentTime: number
): Alert[] {
  const alerts: Alert[] = [];

  sensors.forEach((sensor) => {
    if (sensor.readings.length === 0) return;

    const sortedReadings = [...sensor.readings].sort((a, b) => a.timestamp - b.timestamp);
    const recentReadings = sortedReadings.filter((r) => r.timestamp >= currentTime - TWO_HOURS);

    if (recentReadings.length === 0) return;

    let continuousViolationStartTime: number | null = null;
    let violationType: 'temperature' | 'humidity' | null = null;

    for (let i = 0; i < recentReadings.length; i++) {
      const reading = recentReadings[i];
      
      if (!reading.isOnline) {
        continuousViolationStartTime = null;
        violationType = null;
        continue;
      }

      const isTempViolation = reading.temperature < thresholds.temperatureMin || 
                              reading.temperature > thresholds.temperatureMax;
      const isHumidityViolation = reading.humidity < thresholds.humidityMin || 
                                   reading.humidity > thresholds.humidityMax;

      if (isTempViolation || isHumidityViolation) {
        if (continuousViolationStartTime === null) {
          continuousViolationStartTime = reading.timestamp;
          violationType = isTempViolation ? 'temperature' : 'humidity';
        }

        const duration = reading.timestamp - continuousViolationStartTime;

        if (duration >= THIRTY_MINUTES) {
          const isCritical = duration >= ONE_HOUR;
          
          alerts.push({
            id: `threshold-${sensor.id}-${generateId()}`,
            type: 'continuous_threshold',
            severity: isCritical ? 'critical' : 'error',
            title: isCritical 
              ? `传感器 ${sensor.name} 连续${Math.round(duration / 60000)}分钟超阈`
              : `传感器 ${sensor.name} 连续超阈预警`,
            description: violationType === 'temperature'
              ? `温度超出阈值范围 [${thresholds.temperatureMin}°C - ${thresholds.temperatureMax}°C]，当前读数: ${reading.temperature.toFixed(1)}°C`
              : `湿度超出阈值范围 [${thresholds.humidityMin}% - ${thresholds.humidityMax}%]，当前读数: ${reading.humidity.toFixed(1)}%`,
            sensorId: sensor.id,
            zoneId: sensor.zoneId,
            floorId: sensor.floorId,
            timestamp: currentTime,
            data: {
              continuousDuration: duration,
            },
          });

          break;
        }
      } else {
        continuousViolationStartTime = null;
        violationType = null;
      }
    }
  });

  return alerts;
}

export function detectOfflineSensors(
  sensors: Sensor[],
  currentTime: number
): Alert[] {
  const alerts: Alert[] = [];
  const offlineThreshold = 15 * 60 * 1000;
  const criticalOfflineThreshold = 60 * 60 * 1000;

  sensors.forEach((sensor) => {
    if (sensor.readings.length === 0) {
      alerts.push({
        id: `offline-${sensor.id}-${generateId()}`,
        type: 'sensor_offline',
        severity: 'warning',
        title: `传感器 ${sensor.name} 无数据`,
        description: '该传感器暂无历史读数记录，请检查设备连接。',
        sensorId: sensor.id,
        zoneId: sensor.zoneId,
        floorId: sensor.floorId,
        timestamp: currentTime,
        data: {},
      });
      return;
    }

    const sortedReadings = [...sensor.readings].sort((a, b) => b.timestamp - a.timestamp);
    const lastReading = sortedReadings[0];
    const timeSinceLastReading = currentTime - lastReading.timestamp;

    if (!lastReading.isOnline || timeSinceLastReading > offlineThreshold) {
      const isCritical = !lastReading.isOnline || timeSinceLastReading > criticalOfflineThreshold;
      
      alerts.push({
        id: `offline-${sensor.id}-${generateId()}`,
        type: 'sensor_offline',
        severity: isCritical ? 'critical' : 'error',
        title: isCritical 
          ? `传感器 ${sensor.name} 严重离线`
          : `传感器 ${sensor.name} 离线`,
        description: !lastReading.isOnline 
          ? '传感器状态已标记为离线，请立即检查设备通信。'
          : `最后一次数据上报于 ${Math.round(timeSinceLastReading / 60000)} 分钟前。`,
        sensorId: sensor.id,
        zoneId: sensor.zoneId,
        floorId: sensor.floorId,
        timestamp: currentTime,
        data: {
          offlineDuration: timeSinceLastReading,
        },
      });
    }
  });

  return alerts;
}

export function detectRepeatedDispatch(
  workOrders: WorkOrder[],
  currentTime: number
): Alert[] {
  const alerts: Alert[] = [];
  const timeWindow = ONE_DAY;

  const recentOrders = workOrders.filter((o) => 
    o.createdAt >= currentTime - timeWindow && 
    o.status !== 'cancelled'
  );

  const zoneMap = new Map<string, WorkOrder[]>();
  recentOrders.forEach((order) => {
    const key = `${order.floorId}-${order.zoneId}`;
    if (!zoneMap.has(key)) {
      zoneMap.set(key, []);
    }
    zoneMap.get(key)!.push(order);
  });

  zoneMap.forEach((orders, key) => {
    if (orders.length < 2) return;

    const assigneeMap = new Map<string, WorkOrder[]>();
    orders.forEach((order) => {
      if (!assigneeMap.has(order.assigneeId)) {
        assigneeMap.set(order.assigneeId, []);
      }
      assigneeMap.get(order.assigneeId)!.push(order);
    });

    assigneeMap.forEach((assigneeOrders, assigneeId) => {
      if (assigneeOrders.length >= 2) {
        const [floorId, zoneId] = key.split('-');
        const hasPending = assigneeOrders.some((o) => o.status === 'pending' || o.status === 'in_progress');
        const isCritical = assigneeOrders.length >= 3 || hasPending;

        alerts.push({
          id: `repeated-${key}-${assigneeId}-${generateId()}`,
          type: 'repeated_dispatch',
          severity: isCritical ? 'critical' : 'warning',
          title: isCritical
            ? `区域重复派单告警（${assigneeOrders.length}次）`
            : `区域重复派单提醒`,
          description: `运维人员 ${assigneeOrders[0].assignedTo} 在过去24小时内对同一区域（${floorId} ${zoneId}）派发了 ${assigneeOrders.length} 张工单，可能存在问题定位不准确或反复发生的情况。`,
          zoneId,
          floorId,
          relatedWorkOrders: assigneeOrders.map((o) => o.id),
          timestamp: currentTime,
          data: {
            dispatchCount: assigneeOrders.length,
            assignees: [assigneeOrders[0].assignedTo],
          },
        });
      }
    });
  });

  return alerts;
}

export function runAllRules(
  sensors: Sensor[],
  workOrders: WorkOrder[],
  thresholds: Thresholds,
  currentTime: number
): Alert[] {
  const thresholdAlerts = detectContinuousThresholdViolations(sensors, thresholds, currentTime);
  const offlineAlerts = detectOfflineSensors(sensors, currentTime);
  const dispatchAlerts = detectRepeatedDispatch(workOrders, currentTime);

  return [...thresholdAlerts, ...offlineAlerts, ...dispatchAlerts];
}

export function generateInspectionSuggestions(
  alerts: Alert[],
  sensors: Sensor[],
  workOrders: WorkOrder[]
): InspectionSuggestion[] {
  const suggestions: InspectionSuggestion[] = [];

  const sensorMap = new Map(sensors.map((s) => [s.id, s]));

  alerts.forEach((alert) => {
    let suggestion: InspectionSuggestion | null = null;

    switch (alert.type) {
      case 'continuous_threshold':
        suggestion = {
          id: `suggestion-${alert.id}`,
          floorId: alert.floorId,
          zoneId: alert.zoneId!,
          sensorId: alert.sensorId,
          issueType: '连续超阈',
          priority: alert.severity === 'critical' ? 'high' : 'medium',
          suggestion: alert.data.continuousDuration && alert.data.continuousDuration >= ONE_HOUR
            ? '建议：1) 立即派遣运维人员到现场检查空调/通风系统；2) 核实传感器读数是否准确；3) 检查区域是否有热源/冷源异常；4) 如有必要，临时调整空调参数。'
            : '建议：1) 密切关注该传感器读数变化趋势；2) 检查相邻传感器读数是否存在类似异常；3) 如持续超阈，考虑提前介入处理。',
          relatedData: {
            alertId: alert.id,
            duration: alert.data.continuousDuration,
            sensorName: alert.sensorId ? sensorMap.get(alert.sensorId)?.name : null,
          },
        };
        break;

      case 'sensor_offline':
        suggestion = {
          id: `suggestion-${alert.id}`,
          floorId: alert.floorId,
          zoneId: alert.zoneId!,
          sensorId: alert.sensorId,
          issueType: '传感器离线',
          priority: alert.severity === 'critical' ? 'high' : 'medium',
          suggestion: '建议：1) 检查传感器供电是否正常；2) 核实网络连接状态；3) 如为无线传感器，检查电池电量；4) 必要时现场重启设备或联系供应商维修。',
          relatedData: {
            alertId: alert.id,
            offlineDuration: alert.data.offlineDuration,
            sensorName: alert.sensorId ? sensorMap.get(alert.sensorId)?.name : null,
          },
        };
        break;

      case 'repeated_dispatch':
        const relatedOrders = workOrders.filter((o) => 
          alert.relatedWorkOrders?.includes(o.id)
        );
        suggestion = {
          id: `suggestion-${alert.id}`,
          floorId: alert.floorId,
          zoneId: alert.zoneId!,
          issueType: '重复派单',
          priority: alert.severity === 'critical' ? 'high' : 'low',
          suggestion: '建议：1) 查看历史工单详情，了解问题根因；2) 与运维人员沟通，确认是否存在问题未彻底解决的情况；3) 如为系统性问题，考虑升级处理；4) 优化巡检路线，避免同一区域反复派单。',
          relatedData: {
            alertId: alert.id,
            dispatchCount: alert.data.dispatchCount,
            assignees: alert.data.assignees,
            relatedWorkOrderIds: alert.relatedWorkOrders,
            pendingCount: relatedOrders.filter((o) => o.status === 'pending' || o.status === 'in_progress').length,
          },
        };
        break;
    }

    if (suggestion) {
      suggestions.push(suggestion);
    }
  });

  const pendingHighPriority = workOrders.filter((o) => 
    (o.status === 'pending' || o.status === 'in_progress') &&
    (o.priority === 'high' || o.priority === 'critical')
  );

  pendingHighPriority.forEach((order) => {
    const existingSuggestion = suggestions.find((s) => 
      s.relatedData.relatedWorkOrderIds?.includes(order.id)
    );
    
    if (!existingSuggestion) {
      suggestions.push({
        id: `suggestion-order-${order.id}`,
        floorId: order.floorId,
        zoneId: order.zoneId,
        sensorId: order.sensorId,
        issueType: '高优先级工单',
        priority: order.priority === 'critical' ? 'high' : 'medium',
        suggestion: `建议：优先处理高优先级工单 [${order.id}] - ${order.title}。当前状态: ${order.status === 'pending' ? '待处理' : '处理中'}。`,
        relatedData: {
          workOrderId: order.id,
          workOrderTitle: order.title,
          workOrderStatus: order.status,
          workOrderPriority: order.priority,
        },
      });
    }
  });

  return suggestions.sort((a, b) => {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    return priorityWeight[b.priority] - priorityWeight[a.priority];
  });
}
