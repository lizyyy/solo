import { RiskLevel, ActionType } from '../types';

export function analyzeComponentRisk(component, inspections, alarms, closureWindows) {
  let riskLevel = RiskLevel.LOW;
  let actionType = ActionType.NORMAL;
  let riskReasons = [];

  const componentInspections = inspections.filter(
    (i) => i.componentId === component.id
  );
  const componentAlarms = alarms.filter((a) => a.componentId === component.id);

  for (const inspection of componentInspections) {
    if (inspection.type === 'crack') {
      const { width, length, depth } = inspection;
      if (width >= 0.2 && width < 0.5) {
        riskLevel = Math.max(riskLevel, RiskLevel.MEDIUM);
        riskReasons.push(`裂缝宽度 ${width}mm，超过 0.2mm 阈值`);
      } else if (width >= 0.5) {
        riskLevel = Math.max(riskLevel, RiskLevel.HIGH);
        riskReasons.push(`裂缝宽度 ${width}mm，超过 0.5mm 危险阈值`);
      }
      if (length > 100) {
        riskLevel = Math.max(riskLevel, RiskLevel.MEDIUM);
        riskReasons.push(`裂缝长度 ${length}cm，超过 100cm 阈值`);
      }
    } else if (inspection.type === 'corrosion') {
      const { area, level } = inspection;
      if (level === '轻度') {
        riskLevel = Math.max(riskLevel, RiskLevel.LOW);
        riskReasons.push(`存在轻度锈蚀，锈蚀面积 ${area}%`);
      } else if (level === '中度') {
        riskLevel = Math.max(riskLevel, RiskLevel.MEDIUM);
        riskReasons.push(`存在中度锈蚀，锈蚀面积 ${area}%`);
      } else if (level === '重度') {
        riskLevel = Math.max(riskLevel, RiskLevel.HIGH);
        riskReasons.push(`存在重度锈蚀，锈蚀面积 ${area}%`);
      }
    }
  }

  for (const alarm of componentAlarms) {
    const { amplitude, frequency, level } = alarm;
    if (level === 'warning') {
      riskLevel = Math.max(riskLevel, RiskLevel.MEDIUM);
      riskReasons.push(`振动告警: 振幅 ${amplitude}mm，频率 ${frequency}Hz (预警级别)`);
    } else if (level === 'alarm') {
      riskLevel = Math.max(riskLevel, RiskLevel.HIGH);
      riskReasons.push(`振动告警: 振幅 ${amplitude}mm，频率 ${frequency}Hz (告警级别)`);
    } else if (level === 'critical') {
      riskLevel = Math.max(riskLevel, RiskLevel.CRITICAL);
      riskReasons.push(`振动告警: 振幅 ${amplitude}mm，频率 ${frequency}Hz (严重告警级别)`);
    }
  }

  if (riskLevel === RiskLevel.LOW) {
    actionType = ActionType.NORMAL;
  } else if (riskLevel === RiskLevel.MEDIUM) {
    actionType = ActionType.RETEST;
  } else if (riskLevel === RiskLevel.HIGH) {
    const hasClosureWindow = closureWindows.some((w) => w.componentId === component.id);
    actionType = hasClosureWindow ? ActionType.RESTRICT : ActionType.RESTRICT;
  } else if (riskLevel === RiskLevel.CRITICAL) {
    actionType = ActionType.IMMEDIATE;
  }

  if (riskReasons.length === 0) {
    riskReasons.push('构件状态正常，无病害记录');
  }

  return {
    riskLevel,
    actionType,
    riskReasons,
    inspections: componentInspections,
    alarms: componentAlarms,
  };
}

export function analyzeAllComponents(components, inspections, alarms, closureWindows) {
  return components.map((component) => ({
    ...component,
    analysis: analyzeComponentRisk(component, inspections, alarms, closureWindows),
  }));
}
