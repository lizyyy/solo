import { Risk, Cue, SceneRules, Channel } from '../types';

export function checkExcessiveBlackouts(
  cues: Cue[],
  rules: SceneRules,
  dimmerChannels: Channel[]
): Risk[] {
  const risks: Risk[] = [];
  const riskIdCounter = { value: 0 };

  if (cues.length < 2 || dimmerChannels.length === 0) {
    return risks;
  }

  const sortedCues = [...cues].sort((a, b) => a.startTime - b.startTime);
  const dimmerChannelIds = new Set(dimmerChannels.map((ch) => ch.id));

  let blackoutStartTime: number | null = null;
  let previousCue: Cue | null = null;

  for (let i = 0; i < sortedCues.length; i++) {
    const currentCue = sortedCues[i];
    
    const isBlackout = checkIfCueIsBlackout(currentCue, dimmerChannelIds);
    const cueEndTime = currentCue.startTime + currentCue.duration + currentCue.fadeOut;

    if (isBlackout) {
      if (blackoutStartTime === null) {
        blackoutStartTime = currentCue.startTime;
      }

      const nextCue = i < sortedCues.length - 1 ? sortedCues[i + 1] : null;
      
      if (nextCue) {
        const blackoutDuration = nextCue.startTime - blackoutStartTime;
        
        if (blackoutDuration > rules.blackoutThreshold) {
          risks.push(createBlackoutRisk(
            currentCue,
            `Cue ${currentCue.number} 开始的黑场持续约 ${blackoutDuration.toFixed(1)} 秒，超过阈值 ${rules.blackoutThreshold} 秒`,
            {
              blackoutStartTime,
              blackoutDuration,
              threshold: rules.blackoutThreshold,
              affectedCues: [currentCue.number, nextCue.number]
            },
            riskIdCounter,
            blackoutDuration > rules.blackoutThreshold * 2 ? 'critical' : 'warning'
          ));
        }
      } else {
        const estimatedBlackoutEnd = cueEndTime;
        const blackoutDuration = estimatedBlackoutEnd - blackoutStartTime;
        
        if (blackoutDuration > rules.blackoutThreshold) {
          risks.push(createBlackoutRisk(
            currentCue,
            `最后一个 Cue ${currentCue.number} 以黑场结束，持续约 ${blackoutDuration.toFixed(1)} 秒`,
            {
              blackoutStartTime,
              blackoutDuration,
              isLastCue: true
            },
            riskIdCounter,
            'info'
          ));
        }
      }
    } else {
      blackoutStartTime = null;
    }

    if (previousCue && !isBlackout) {
      const gapStartTime = previousCue.startTime + previousCue.duration + previousCue.fadeOut;
      const gapDuration = currentCue.startTime - gapStartTime;
      
      if (gapDuration > 0.5) {
        const prevWasBlackout = checkIfCueIsBlackout(previousCue, dimmerChannelIds);
        
        if (prevWasBlackout && gapDuration > rules.blackoutThreshold) {
          risks.push(createBlackoutRisk(
            currentCue,
            `Cue ${previousCue.number} 和 Cue ${currentCue.number} 之间存在 ${gapDuration.toFixed(1)} 秒的黑场间隙`,
            {
              gapStartTime,
              gapDuration,
              betweenCues: [previousCue.number, currentCue.number]
            },
            riskIdCounter,
            'warning'
          ));
        }
      }
    }

    previousCue = currentCue;
  }

  return risks;
}

function checkIfCueIsBlackout(cue: Cue, dimmerChannelIds: Set<string>): boolean {
  let activeDimmers = 0;
  let blackoutDimmers = 0;

  cue.channelValues.forEach((cv) => {
    if (dimmerChannelIds.has(cv.channelId)) {
      activeDimmers++;
      if (cv.value <= 5) {
        blackoutDimmers++;
      }
    }
  });

  if (activeDimmers === 0) {
    return false;
  }

  return blackoutDimmers === activeDimmers;
}

function createBlackoutRisk(
  cue: Cue,
  message: string,
  details: Record<string, unknown>,
  counter: { value: number },
  severity: 'critical' | 'warning' | 'info'
): Risk {
  return {
    id: `blackout-${++counter.value}`,
    type: 'excessive_blackout',
    severity,
    cueId: cue.id,
    cueNumber: cue.number,
    message,
    details,
    timestamp: Date.now()
  };
}