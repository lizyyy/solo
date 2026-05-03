import {
  DataFiles,
  AnalysisResult,
  BatterySlotSession,
  RiskItem,
  Alert,
  SwapEvent,
  SlotTemperature,
  AlertRule,
} from '../types';
import {
  parseDateTime,
  getMinutesDifference,
  calculateTemperatureSlope,
  getTemperatureStats,
  detectSensorGaps,
  generateId,
  formatDateTime,
} from '../utils';

function buildBatterySessions(
  swapEvents: SwapEvent[],
  temperatures: SlotTemperature[],
  maxGapMinutes: number,
  duplicateBatteryMinutes: number
): BatterySlotSession[] {
  const sessions: BatterySlotSession[] = [];
  
  const sortedEvents = [...swapEvents].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const activeSessions: Map<string, BatterySlotSession> = new Map();

  for (const event of sortedEvents) {
    const sessionKey = `${event.cabinetId}-${event.slotId}`;
    const eventTime = parseDateTime(event.timestamp);

    if (event.eventType === 'in') {
      const existingSession = activeSessions.get(sessionKey);
      
      if (existingSession) {
        const timeDiff = getMinutesDifference(eventTime, existingSession.inTime);
        if (timeDiff > duplicateBatteryMinutes) {
          existingSession.outTime = eventTime;
          sessions.push(existingSession);
          activeSessions.delete(sessionKey);
        } else {
          continue;
        }
      }

      const slotTemperatures = temperatures.filter(
        (t) => t.cabinetId === event.cabinetId && t.slotId === event.slotId
      );

      const newSession: BatterySlotSession = {
        batteryId: event.batteryId,
        cabinetId: event.cabinetId,
        slotId: event.slotId,
        inTime: eventTime,
        temperatures: slotTemperatures,
        hasSensorGap: false,
        sensorGapMinutes: 0,
      };

      activeSessions.set(sessionKey, newSession);
    } else if (event.eventType === 'out') {
      const activeSession = activeSessions.get(sessionKey);
      
      if (activeSession) {
        activeSession.outTime = eventTime;
        sessions.push(activeSession);
        activeSessions.delete(sessionKey);
      }
    }
  }

  for (const session of activeSessions.values()) {
    sessions.push(session);
  }

  for (const session of sessions) {
    const sessionTemperatures = session.temperatures.filter((t) => {
      const tempTime = parseDateTime(t.timestamp);
      const afterInTime = tempTime >= session.inTime;
      const beforeOutTime = !session.outTime || tempTime <= session.outTime;
      return afterInTime && beforeOutTime;
    });

    session.temperatures = sessionTemperatures;

    const slope = calculateTemperatureSlope(sessionTemperatures);
    const stats = getTemperatureStats(sessionTemperatures);
    const sensorGap = detectSensorGaps(sessionTemperatures, maxGapMinutes);

    session.temperatureSlope = slope;
    session.maxTemperature = stats.max;
    session.minTemperature = stats.min;
    session.avgTemperature = stats.avg;
    session.hasSensorGap = sensorGap.hasGap;
    session.sensorGapMinutes = sensorGap.totalGapMinutes;
  }

  return sessions;
}

function detectTemperatureAnomalies(
  sessions: BatterySlotSession[],
  rules: AlertRule[]
): RiskItem[] {
  const risks: RiskItem[] = [];
  const tempRules = rules.filter((r) => r.type === 'temperature_slope' && r.enabled);

  for (const session of sessions) {
    if (session.temperatureSlope === undefined) continue;

    for (const rule of tempRules) {
      const absSlope = Math.abs(session.temperatureSlope);
      
      if (absSlope > rule.threshold) {
        const risk: RiskItem = {
          riskId: generateId('risk'),
          batteryId: session.batteryId,
          cabinetId: session.cabinetId,
          slotId: session.slotId,
          riskType: 'temperature_anomaly',
          severity: rule.severity,
          startTime: formatDateTime(session.inTime),
          endTime: session.outTime ? formatDateTime(session.outTime) : undefined,
          description: `电池 ${session.batteryId} 温度异常，斜率为 ${session.temperatureSlope.toFixed(3)}°C/分钟，超过阈值 ${rule.threshold}°C/分钟`,
          relatedEventIds: [],
          temperatureSlope: session.temperatureSlope,
          maxTemperature: session.maxTemperature,
          status: 'open',
        };
        risks.push(risk);
      }
    }
  }

  return risks;
}

function detectAbnormalSwaps(
  swapEvents: SwapEvent[],
  sessions: BatterySlotSession[],
  rules: AlertRule[],
  duplicateBatteryMinutes: number
): RiskItem[] {
  const risks: RiskItem[] = [];
  const swapRules = rules.filter((r) => r.type === 'abnormal_swap' && r.enabled);

  if (swapRules.length === 0) return risks;

  const batteryEvents: Map<string, SwapEvent[]> = new Map();
  for (const event of swapEvents) {
    if (!batteryEvents.has(event.batteryId)) {
      batteryEvents.set(event.batteryId, []);
    }
    batteryEvents.get(event.batteryId)!.push(event);
  }

  for (const [batteryId, events] of batteryEvents) {
    const sortedEvents = [...events].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    for (let i = 1; i < sortedEvents.length; i++) {
      const prevEvent = sortedEvents[i - 1];
      const currEvent = sortedEvents[i];
      
      const timeDiff = getMinutesDifference(
        parseDateTime(currEvent.timestamp),
        parseDateTime(prevEvent.timestamp)
      );

      if (timeDiff < duplicateBatteryMinutes) {
        for (const rule of swapRules) {
          if (timeDiff < rule.threshold) {
            const risk: RiskItem = {
              riskId: generateId('risk'),
              batteryId: batteryId,
              cabinetId: currEvent.cabinetId,
              slotId: currEvent.slotId,
              riskType: 'abnormal_swap',
              severity: rule.severity,
              startTime: prevEvent.timestamp,
              endTime: currEvent.timestamp,
              description: `电池 ${batteryId} 在 ${timeDiff} 分钟内频繁换电（间隔 ${timeDiff} 分钟，阈值 ${rule.threshold} 分钟）`,
              relatedEventIds: [prevEvent.eventId, currEvent.eventId],
              status: 'open',
            };
            risks.push(risk);
          }
        }
      }
    }
  }

  const slotSessions: Map<string, BatterySlotSession[]> = new Map();
  for (const session of sessions) {
    const key = `${session.cabinetId}-${session.slotId}`;
    if (!slotSessions.has(key)) {
      slotSessions.set(key, []);
    }
    slotSessions.get(key)!.push(session);
  }

  for (const [key, slotSessionList] of slotSessions) {
    const sortedSessions = [...slotSessionList].sort((a, b) => {
      return a.inTime.getTime() - b.inTime.getTime();
    });

    for (let i = 1; i < sortedSessions.length; i++) {
      const prevSession = sortedSessions[i - 1];
      const currSession = sortedSessions[i];
      
      if (!prevSession.outTime) continue;

      const timeDiff = getMinutesDifference(currSession.inTime, prevSession.outTime);
      
      if (timeDiff < 5) {
        for (const rule of swapRules) {
          const risk: RiskItem = {
            riskId: generateId('risk'),
            batteryId: currSession.batteryId,
            cabinetId: currSession.cabinetId,
            slotId: currSession.slotId,
            riskType: 'abnormal_swap',
            severity: rule.severity,
            startTime: formatDateTime(prevSession.outTime),
            endTime: formatDateTime(currSession.inTime),
            description: `仓位 ${key} 在 ${timeDiff} 分钟内快速换电（前电池: ${prevSession.batteryId}，后电池: ${currSession.batteryId}）`,
            relatedEventIds: [],
            status: 'open',
          };
          risks.push(risk);
        }
      }
    }
  }

  return risks;
}

function detectSensorFailures(
  sessions: BatterySlotSession[],
  rules: AlertRule[]
): RiskItem[] {
  const risks: RiskItem[] = [];
  const sensorRules = rules.filter((r) => r.type === 'sensor_failure' && r.enabled);

  if (sensorRules.length === 0) return risks;

  for (const session of sessions) {
    if (session.hasSensorGap && session.sensorGapMinutes > 0) {
      for (const rule of sensorRules) {
        if (session.sensorGapMinutes > rule.threshold) {
          const risk: RiskItem = {
            riskId: generateId('risk'),
            batteryId: session.batteryId,
            cabinetId: session.cabinetId,
            slotId: session.slotId,
            riskType: 'sensor_failure',
            severity: rule.severity,
            startTime: formatDateTime(session.inTime),
            endTime: session.outTime ? formatDateTime(session.outTime) : undefined,
            description: `仓位 ${session.cabinetId}-${session.slotId} 传感器数据断采 ${session.sensorGapMinutes} 分钟，超过阈值 ${rule.threshold} 分钟`,
            relatedEventIds: [],
            status: 'open',
          };
          risks.push(risk);
        }
      }
    }

    const validTemps = session.temperatures.filter(
      (t) => t.temperature !== null && !isNaN(t.temperature)
    );
    if (validTemps.length === 0 && session.temperatures.length > 0) {
      for (const rule of sensorRules) {
        const risk: RiskItem = {
          riskId: generateId('risk'),
          batteryId: session.batteryId,
          cabinetId: session.cabinetId,
          slotId: session.slotId,
          riskType: 'sensor_failure',
          severity: rule.severity,
          startTime: formatDateTime(session.inTime),
          endTime: session.outTime ? formatDateTime(session.outTime) : undefined,
          description: `仓位 ${session.cabinetId}-${session.slotId} 所有温度数据均无效，可能传感器故障`,
          relatedEventIds: [],
          status: 'open',
        };
        risks.push(risk);
      }
    }
  }

  return risks;
}

function generateAlertsFromRisks(
  risks: RiskItem[],
  rules: AlertRule[]
): Alert[] {
  const alerts: Alert[] = [];

  for (const risk of risks) {
    const alert: Alert = {
      alertId: generateId('alert'),
      ruleId: '',
      batteryId: risk.batteryId,
      cabinetId: risk.cabinetId,
      slotId: risk.slotId,
      startTime: parseDateTime(risk.startTime),
      endTime: risk.endTime ? parseDateTime(risk.endTime) : undefined,
      severity: risk.severity,
      status: 'active',
    };
    alerts.push(alert);
  }

  return alerts;
}

export function analyzeData(data: DataFiles): AnalysisResult {
  const { swapEvents, temperatures, rules } = data;
  const { maxGapMinutes = 30, duplicateBatteryMinutes = 60 } = rules.globalSettings || {};

  const sessions = buildBatterySessions(
    swapEvents,
    temperatures,
    maxGapMinutes,
    duplicateBatteryMinutes
  );

  const tempRisks = detectTemperatureAnomalies(sessions, rules.rules);
  const swapRisks = detectAbnormalSwaps(swapEvents, sessions, rules.rules, duplicateBatteryMinutes);
  const sensorRisks = detectSensorFailures(sessions, rules.rules);

  const allRisks = [...tempRisks, ...swapRisks, ...sensorRisks];
  const alerts = generateAlertsFromRisks(allRisks, rules.rules);

  const risksByType: Record<string, number> = {};
  const risksBySeverity: Record<string, number> = {};

  for (const risk of allRisks) {
    risksByType[risk.riskType] = (risksByType[risk.riskType] || 0) + 1;
    risksBySeverity[risk.severity] = (risksBySeverity[risk.severity] || 0) + 1;
  }

  const closedAlerts = alerts.filter((a) => a.status === 'closed' || a.status === 'resolved');
  const openAlerts = alerts.filter(
    (a) => a.status === 'active' || a.status === 'acknowledged'
  );

  return {
    batterySessions: sessions,
    riskItems: allRisks,
    alerts,
    summary: {
      totalSessions: sessions.length,
      totalRisks: allRisks.length,
      risksByType,
      risksBySeverity,
      alertsClosed: closedAlerts.length,
      alertsOpen: openAlerts.length,
    },
  };
}
