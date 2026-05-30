import type {
  FrameData,
  DiagnosticIssue,
  CarParams,
  WingConfig,
  WindConfig,
  IssueType,
  TriggerSource
} from '../types';
import { THRESHOLDS } from '../physics/constants';
import { GRAVITY } from '../physics/constants';

const generateId = () => Math.random().toString(36).substring(2, 11);

interface DetectionContext {
  frame: FrameData;
  existingIssues: DiagnosticIssue[];
  car: CarParams;
  wing: WingConfig;
  wind: WindConfig;
  curvature: number;
}

const issueDetectors: Record<IssueType, (ctx: DetectionContext) => Partial<DiagnosticIssue> | null> = {
  high_drag: ({ frame, car, wing, wind }) => {
    const { dragForce } = frame.physics;
    const threshold = THRESHOLDS.HIGH_DRAG;
    
    if (dragForce > threshold) {
      const windContribution = Math.abs(wind.speed) > 30 ? 0.3 : 0;
      const wingContribution = Math.abs(wing.angle) > 10 ? 0.4 : 0.2;
      const carContribution = car.baseDragCoeff > 0.4 ? 0.3 : 0.2;
      
      const total = windContribution + wingContribution + carContribution;
      const triggerSource: TriggerSource = 
        windContribution > wingContribution && windContribution > carContribution ? 'wind' :
        wingContribution > carContribution ? 'wing' : 'car';
      
      const severity = Math.min(5, Math.ceil((dragForce / threshold) * 3)) as 1 | 2 | 3 | 4 | 5;
      
      const suggestions: Record<TriggerSource, string> = {
        car: '建议减小赛车迎风面积或优化车身流线型',
        wing: '建议减小翼片角度（向0°调整）以降低阻力',
        wind: '等待风速降低，或调整赛车方向减小迎风角度'
      };
      
      return {
        type: 'high_drag',
        severity,
        threshold,
        actualValue: dragForce,
        triggerSource,
        triggerId: triggerSource === 'car' ? car.id : triggerSource === 'wing' ? wing.id : wind.id,
        suggestion: suggestions[triggerSource],
        trackPosition: frame.trackProgress
      };
    }
    return null;
  },

  low_grip: ({ frame, car, wing, wind }) => {
    const { grip, downForce } = frame.physics;
    const threshold = THRESHOLDS.LOW_GRIP;
    
    if (grip < threshold) {
      const wingContribution = wing.liftFactor < 0.3 ? 0.5 : 0.2;
      const carContribution = car.tireGrip < 1.0 ? 0.3 : 0.2;
      const windContribution = wind.speed > 80 ? 0.2 : 0.1;
      
      const triggerSource: TriggerSource = 
        wingContribution > carContribution && wingContribution > windContribution ? 'wing' :
        carContribution > windContribution ? 'car' : 'wind';
      
      const severity = Math.min(5, Math.ceil((1 - grip / threshold) * 4 + 1)) as 1 | 2 | 3 | 4 | 5;
      
      const suggestions: Record<TriggerSource, string> = {
        car: '建议更换抓地力更好的轮胎或增加车重',
        wing: '建议增加翼片负角度（增大下压力）以提升抓地力',
        wind: '侧风过大，建议降低车速或等待风势减弱'
      };
      
      return {
        type: 'low_grip',
        severity,
        threshold,
        actualValue: grip,
        triggerSource,
        triggerId: triggerSource === 'car' ? car.id : triggerSource === 'wing' ? wing.id : wind.id,
        suggestion: suggestions[triggerSource],
        trackPosition: frame.trackProgress,
        actualValue: downForce
      };
    }
    return null;
  },

  corner_loss: ({ frame, car, wing, wind, curvature }) => {
    if (Math.abs(curvature) < 0.01) return null;
    
    const { speed, grip } = frame.physics;
    const radius = 1 / Math.abs(curvature);
    const requiredGrip = (speed * speed) / (radius * GRAVITY);
    const threshold = THRESHOLDS.CORNER_SPEED_LIMIT * grip;
    
    if (requiredGrip > threshold) {
      const speedFactor = speed / 30;
      const gripFactor = 1 - grip / 1.2;
      const windFactor = wind.speed > 50 ? 0.3 : 0.1;
      
      const triggerSource: TriggerSource = 
        speedFactor > gripFactor && speedFactor > windFactor ? 'car' :
        gripFactor > windFactor ? 'wing' : 'wind';
      
      const severity = Math.min(5, Math.ceil((requiredGrip / threshold - 0.85) * 10)) as 1 | 2 | 3 | 4 | 5;
      
      const suggestions: Record<TriggerSource, string> = {
        car: '入弯速度过高，建议提前刹车减速',
        wing: '下压力不足，建议增加翼片负角度提升过弯极限',
        wind: '横风影响过弯稳定性，建议降低车速'
      };
      
      return {
        type: 'corner_loss',
        severity,
        threshold,
        actualValue: requiredGrip,
        triggerSource,
        triggerId: triggerSource === 'car' ? car.id : triggerSource === 'wing' ? wing.id : wind.id,
        suggestion: suggestions[triggerSource],
        trackPosition: frame.trackProgress
      };
    }
    return null;
  }
};

export const detectIssues = (
  frame: FrameData,
  existingIssues: DiagnosticIssue[],
  car: CarParams,
  wing: WingConfig,
  wind: WindConfig,
  curvature: number
): DiagnosticIssue[] => {
  const ctx: DetectionContext = { frame, existingIssues, car, wing, wind, curvature };
  const updatedIssues = [...existingIssues];
  
  (Object.keys(issueDetectors) as IssueType[]).forEach((type) => {
    const detector = issueDetectors[type];
    const result = detector(ctx);
    
    const openIssue = updatedIssues.find(
      i => i.type === type && (i.endTime === -1 || i.endTime === undefined)
    );
    
    if (result) {
      if (openIssue) {
        openIssue.endTime = frame.timestamp;
        openIssue.frames.push(frame.frameNumber);
        openIssue.actualValue = Math.max(openIssue.actualValue, result.actualValue || openIssue.actualValue);
      } else {
        const newIssue: DiagnosticIssue = {
          id: generateId(),
          type,
          severity: result.severity || 1,
          startTime: frame.timestamp,
          endTime: -1,
          triggerSource: result.triggerSource || 'car',
          triggerId: result.triggerId || car.id,
          threshold: result.threshold || 0,
          actualValue: result.actualValue || 0,
          suggestion: result.suggestion || '',
          frames: [frame.frameNumber],
          trackPosition: result.trackPosition || frame.trackProgress
        };
        updatedIssues.push(newIssue);
      }
    } else if (openIssue) {
      openIssue.endTime = frame.timestamp;
    }
  });
  
  return updatedIssues;
};

export const getIssueTypeLabel = (type: IssueType): string => {
  const labels: Record<IssueType, string> = {
    high_drag: '阻力过大',
    low_grip: '抓地不足',
    corner_loss: '弯道失控'
  };
  return labels[type];
};

export const getIssueTypeColor = (type: IssueType): string => {
  const colors: Record<IssueType, string> = {
    high_drag: '#ff6b35',
    low_grip: '#fbbf24',
    corner_loss: '#ff4757'
  };
  return colors[type];
};

export const getSourceLabel = (source: TriggerSource): string => {
  const labels: Record<TriggerSource, string> = {
    car: '赛车参数',
    wing: '翼片配置',
    wind: '风速数据'
  };
  return labels[source];
};

export const generateDiagnosticReport = (issues: DiagnosticIssue[]): string => {
  if (issues.length === 0) {
    return '本次行驶未检测到明显问题，参数配置合理。';
  }
  
  const typeCount = issues.reduce((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {} as Record<IssueType, number>);
  
  const sourceCount = issues.reduce((acc, issue) => {
    acc[issue.triggerSource] = (acc[issue.triggerSource] || 0) + 1;
    return acc;
  }, {} as Record<TriggerSource, number>);
  
  let report = `=== 诊断报告 ===\n\n`;
  report += `共检测到 ${issues.length} 个问题：\n`;
  report += `  阻力过大: ${typeCount.high_drag || 0} 次\n`;
  report += `  抓地不足: ${typeCount.low_grip || 0} 次\n`;
  report += `  弯道失控: ${typeCount.corner_loss || 0} 次\n\n`;
  
  report += `触发来源分布：\n`;
  report += `  赛车参数: ${sourceCount.car || 0} 次\n`;
  report += `  翼片配置: ${sourceCount.wing || 0} 次\n`;
  report += `  风速数据: ${sourceCount.wind || 0} 次\n\n`;
  
  const worstIssue = issues.reduce((worst, curr) => 
    curr.severity > worst.severity ? curr : worst
  );
  
  report += `最严重问题：${getIssueTypeLabel(worstIssue.type)} (严重程度: ${worstIssue.severity}/5)\n`;
  report += `触发来源：${getSourceLabel(worstIssue.triggerSource)} (ID: ${worstIssue.triggerId})\n`;
  report += `建议：${worstIssue.suggestion}\n`;
  
  return report;
};
