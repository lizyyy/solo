import { Risk, Cue, SceneRules } from '../types';

export function checkMissingSafetyLights(
  cues: Cue[],
  rules: SceneRules
): Risk[] {
  const risks: Risk[] = [];
  const riskIdCounter = { value: 0 };

  if (!rules.requiresSafetyLight) {
    return risks;
  }

  if (rules.safetyLightChannels.length === 0) {
    risks.push({
      id: `safety-light-config-${++riskIdCounter.value}`,
      type: 'missing_safety_light',
      severity: 'warning',
      cueId: '',
      cueNumber: '',
      message: '场景规则要求安全灯检查，但未配置安全灯通道列表',
      details: {
        requiresSafetyLight: rules.requiresSafetyLight,
        safetyLightChannels: rules.safetyLightChannels
      },
      timestamp: Date.now()
    });
    return risks;
  }

  const safetyChannelIds = new Set(rules.safetyLightChannels);

  cues.forEach((cue) => {
    const safetyChannelValues: { channelId: string; value: number }[] = [];
    
    cue.channelValues.forEach((cv) => {
      if (safetyChannelIds.has(cv.channelId)) {
        safetyChannelValues.push({
          channelId: cv.channelId,
          value: cv.value
        });
      }
    });

    if (safetyChannelValues.length === 0) {
      risks.push(createSafetyLightRisk(
        cue,
        `Cue ${cue.number} 未设置任何安全灯通道值`,
        {
          safetyLightChannels: rules.safetyLightChannels,
          cueChannelValues: cue.channelValues.map((cv) => cv.channelId)
        },
        riskIdCounter,
        'critical'
      ));
    } else {
      const activeSafetyLights = safetyChannelValues.filter((sc) => sc.value > 10);
      
      if (activeSafetyLights.length === 0) {
        risks.push(createSafetyLightRisk(
          cue,
          `Cue ${cue.number} 中所有安全灯通道的值均为 0 或极低`,
          {
            safetyChannelValues: safetyChannelValues
          },
          riskIdCounter,
          'warning'
        ));
      }
    }
  });

  return risks;
}

function createSafetyLightRisk(
  cue: Cue,
  message: string,
  details: Record<string, unknown>,
  counter: { value: number },
  severity: 'critical' | 'warning' | 'info'
): Risk {
  return {
    id: `safety-light-${++counter.value}`,
    type: 'missing_safety_light',
    severity,
    cueId: cue.id,
    cueNumber: cue.number,
    message,
    details,
    timestamp: Date.now()
  };
}