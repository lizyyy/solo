import { Risk, Fixture, Cue } from '../types';

export function checkChannelConflicts(
  fixtures: Fixture[],
  cues: Cue[]
): Risk[] {
  const risks: Risk[] = [];
  const riskIdCounter = { value: 0 };

  const dmxAddressMap = new Map<number, Set<string>>();
  fixtures.forEach((fixture) => {
    fixture.channels.forEach((channel) => {
      const key = channel.dmxAddress;
      if (!dmxAddressMap.has(key)) {
        dmxAddressMap.set(key, new Set());
      }
      dmxAddressMap.get(key)?.add(`${fixture.id}:${channel.id}`);
    });
  });

  dmxAddressMap.forEach((fixtureChannels, dmxAddress) => {
    if (fixtureChannels.size > 1) {
      risks.push(createConflictRisk(
        `DMX 地址 ${dmxAddress} 被 ${fixtureChannels.size} 个通道共享: ${Array.from(fixtureChannels).join(', ')}`,
        {
          dmxAddress,
          conflicts: Array.from(fixtureChannels)
        },
        riskIdCounter
      ));
    }
  });

  cues.forEach((cue, cueIndex) => {
    const cueChannelMap = new Map<string, Set<string>>();
    
    cue.channelValues.forEach((cv) => {
      const fixtureId = extractFixtureId(cv.channelId);
      if (!cueChannelMap.has(cv.channelId)) {
        cueChannelMap.set(cv.channelId, new Set());
      }
      cueChannelMap.get(cv.channelId)?.add(fixtureId || cv.channelId);
    });

    const previousCue = cueIndex > 0 ? cues[cueIndex - 1] : null;
    if (previousCue) {
      const prevChannelValues = new Map(
        previousCue.channelValues.map((cv) => [cv.channelId, cv.value])
      );

      cue.channelValues.forEach((cv) => {
        if (prevChannelValues.has(cv.channelId)) {
          const prevValue = prevChannelValues.get(cv.channelId)!;
          if (cv.value !== prevValue) {
            const conflictDuringFade = checkValueConflictDuringFade(
              prevValue,
              cv.value,
              cue.fadeIn
            );
            
            if (conflictDuringFade) {
              risks.push(createCueConflictRisk(
                cue,
                `通道 ${cv.channelId} 在淡入过程中可能存在值冲突风险`,
                {
                  channelId: cv.channelId,
                  previousValue: prevValue,
                  currentValue: cv.value,
                  fadeInDuration: cue.fadeIn
                },
                riskIdCounter
              ));
            }
          }
        }
      });
    }
  });

  return risks;
}

function extractFixtureId(channelId: string): string | null {
  const parts = channelId.split('-');
  if (parts.length >= 2) {
    return parts[0];
  }
  return null;
}

function checkValueConflictDuringFade(
  prevValue: number,
  currentValue: number,
  fadeInDuration: number
): boolean {
  return fadeInDuration > 0 && Math.abs(prevValue - currentValue) > 50;
}

function createConflictRisk(
  message: string,
  details: Record<string, unknown>,
  counter: { value: number }
): Risk {
  return {
    id: `channel-conflict-${++counter.value}`,
    type: 'channel_conflict',
    severity: 'warning',
    cueId: '',
    cueNumber: '',
    message,
    details,
    timestamp: Date.now()
  };
}

function createCueConflictRisk(
  cue: Cue,
  message: string,
  details: Record<string, unknown>,
  counter: { value: number }
): Risk {
  return {
    id: `cue-channel-conflict-${++counter.value}`,
    type: 'channel_conflict',
    severity: 'info',
    cueId: cue.id,
    cueNumber: cue.number,
    message,
    details,
    timestamp: Date.now()
  };
}