import { Risk, Cue, SceneRules } from '../types';

export function checkFadeOverlaps(
  cues: Cue[],
  rules: SceneRules
): Risk[] {
  const risks: Risk[] = [];
  const riskIdCounter = { value: 0 };

  if (cues.length < 2) {
    return risks;
  }

  const sortedCues = [...cues].sort((a, b) => a.startTime - b.startTime);

  for (let i = 0; i < sortedCues.length - 1; i++) {
    const currentCue = sortedCues[i];
    const nextCue = sortedCues[i + 1];

    const currentFadeEndTime = currentCue.startTime + currentCue.fadeIn;
    const nextFadeStartTime = nextCue.startTime;

    if (nextFadeStartTime < currentFadeEndTime) {
      const overlapDuration = currentFadeEndTime - nextFadeStartTime;

      if (overlapDuration > rules.maxFadeOverlap) {
        risks.push(createFadeOverlapRisk(
          nextCue,
          `Cue ${nextCue.number} 的淡入与 Cue ${currentCue.number} 的淡入重叠 ${overlapDuration.toFixed(1)} 秒，超过最大允许值 ${rules.maxFadeOverlap} 秒`,
          {
            overlappingCues: [currentCue.number, nextCue.number],
            overlapDuration,
            maxAllowed: rules.maxFadeOverlap,
            currentCueFadeEnd: currentFadeEndTime,
            nextCueFadeStart: nextFadeStartTime
          },
          riskIdCounter,
          'critical'
        ));
      } else if (overlapDuration > 0) {
        risks.push(createFadeOverlapRisk(
          nextCue,
          `Cue ${nextCue.number} 的淡入与 Cue ${currentCue.number} 的淡入重叠 ${overlapDuration.toFixed(1)} 秒`,
          {
            overlappingCues: [currentCue.number, nextCue.number],
            overlapDuration
          },
          riskIdCounter,
          'warning'
        ));
      }
    }

    const currentFadeOutStartTime = currentCue.startTime + currentCue.duration;
    const currentFadeOutEndTime = currentFadeOutStartTime + currentCue.fadeOut;
    
    const nextFadeInEndTime = nextCue.startTime + nextCue.fadeIn;

    if (nextCue.startTime < currentFadeOutEndTime && nextCue.startTime >= currentFadeOutStartTime) {
      const fadeOutOverlap = Math.min(currentFadeOutEndTime, nextFadeInEndTime) - nextCue.startTime;
      
      if (fadeOutOverlap > 0) {
        risks.push(createFadeOverlapRisk(
          nextCue,
          `Cue ${nextCue.number} 的淡入与 Cue ${currentCue.number} 的淡出重叠 ${fadeOutOverlap.toFixed(1)} 秒`,
          {
            overlappingCues: [currentCue.number, nextCue.number],
            overlapDuration: fadeOutOverlap,
            overlapType: 'fade-in-fade-out'
          },
          riskIdCounter,
          'info'
        ));
      }
    }
  }

  return risks;
}

function createFadeOverlapRisk(
  cue: Cue,
  message: string,
  details: Record<string, unknown>,
  counter: { value: number },
  severity: 'critical' | 'warning' | 'info'
): Risk {
  return {
    id: `fade-overlap-${++counter.value}`,
    type: 'fade_overlap',
    severity,
    cueId: cue.id,
    cueNumber: cue.number,
    message,
    details,
    timestamp: Date.now()
  };
}