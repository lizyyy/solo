import type {
  Member,
  Problem,
  TrainingActivity,
  ActivityResult,
  KnowledgePoint,
  Contest,
  ContestResult,
  KeyDecision,
  ProblemDiscovery,
  CorrectionAction,
  GameState,
  VersionInfo,
  Replay,
  ReplayStep,
  ActivityType,
} from '../types';
import { DEFAULT_CONFIG, TRAIT_EFFECTS, KNOWLEDGE_POINTS } from '../data/constants';

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getTraitModifier(member: Member, effectKey: string): number | null {
  for (const trait of member.traits) {
    const effect = TRAIT_EFFECTS[trait]?.effect;
    if (effect?.startsWith(effectKey)) {
      const value = parseFloat(effect.split(':')[1]);
      return value;
    }
  }
  return null;
}

export function hasTraitEffect(member: Member, effectKey: string): boolean {
  return member.traits.some(trait => {
    const effect = TRAIT_EFFECTS[trait]?.effect;
    return effect === effectKey || effect?.startsWith(`${effectKey}:`);
  });
}

export function calculateEffectiveAbility(
  member: Member,
  knowledgePoints: KnowledgePoint[]
): number {
  let totalAbility = 0;
  let count = 0;

  for (const kp of knowledgePoints) {
    let ability = member.knowledgePoints[kp];
    
    const bonus = getTraitModifier(member, `${kp}_bonus`);
    if (bonus !== null) {
      ability += bonus;
    }
    
    totalAbility += ability;
    count++;
  }

  const avgAbility = count > 0 ? totalAbility / count : member.overallAbility;
  
  const fatiguePenalty = Math.max(0, (member.fatigue / member.maxFatigue - 0.5) * 0.3);
  
  return Math.max(0, avgAbility * (1 - fatiguePenalty));
}

export function calculatePracticeSuccess(
  member: Member,
  problem: Problem
): { success: boolean; abilityGain: Record<KnowledgePoint, number>; message: string } {
  const effectiveAbility = calculateEffectiveAbility(member, problem.knowledgePoints);
  
  const difficultyModifier = {
    easy: 1.2,
    medium: 1.0,
    hard: 0.8,
  }[problem.difficulty];

  let consecutivePenalty = 1;
  if (!hasTraitEffect(member, 'no_consecutive_penalty') && member.consecutivePracticeDays >= 3) {
    consecutivePenalty = 1 - Math.min(0.3, (member.consecutivePracticeDays - 2) * 0.1);
  }

  const successChance = Math.min(0.95, (effectiveAbility / 100) * difficultyModifier * consecutivePenalty);
  const success = Math.random() < successChance;

  const abilityGain: Record<KnowledgePoint, number> = {
    dp: 0,
    graph: 0,
    string: 0,
    math: 0,
    geometry: 0,
    dataStructure: 0,
    greedy: 0,
    search: 0,
  };

  if (success) {
    const baseGain = {
      easy: 2,
      medium: 4,
      hard: 7,
    }[problem.difficulty];

    let bonusMultiplier = 1;
    const practiceBonus = getTraitModifier(member, 'practice_ability_bonus');
    if (practiceBonus !== null) {
      bonusMultiplier = practiceBonus;
    }

    for (const kp of problem.knowledgePoints) {
      abilityGain[kp] = Math.round(baseGain * bonusMultiplier * (1 + Math.random() * 0.5));
    }

    return {
      success: true,
      abilityGain,
      message: `成功通过「${problem.title}」，知识点能力提升！`,
    };
  } else {
    for (const kp of problem.knowledgePoints) {
      abilityGain[kp] = 1;
    }

    return {
      success: false,
      abilityGain,
      message: `未能通过「${problem.title}」，但积累了一些经验。`,
    };
  }
}

export function calculateFatigueChange(
  member: Member,
  activityType: ActivityType,
  settings: GameState['settings']
): number {
  let fatigueChange = 0;

  switch (activityType) {
    case 'practice':
      fatigueChange = settings.practiceFatigueCost * member.maxFatigue;
      break;
    case 'review':
      fatigueChange = settings.reviewFatigueCost * member.maxFatigue;
      break;
    case 'rest':
      fatigueChange = -settings.fatigueRecoveryRate * member.maxFatigue;
      break;
  }

  const fatigueMultiplier = getTraitModifier(member, 'fatigue_multiplier');
  if (fatigueMultiplier !== null && fatigueChange > 0) {
    fatigueChange *= fatigueMultiplier;
  }

  return Math.round(fatigueChange);
}

export function checkCrash(member: Member, settings: GameState['settings']): boolean {
  return member.fatigue >= member.maxFatigue * settings.crashThreshold;
}

export function executeActivity(
  activity: TrainingActivity,
  member: Member,
  problems: Problem[],
  settings: GameState['settings']
): { result: ActivityResult; updatedMember: Member } {
  const problem = activity.problemId 
    ? problems.find(p => p.id === activity.problemId) 
    : null;

  const fatigueChange = calculateFatigueChange(member, activity.type, settings);
  
  const abilityChange: Record<KnowledgePoint, number> = {
    dp: 0,
    graph: 0,
    string: 0,
    math: 0,
    geometry: 0,
    dataStructure: 0,
    greedy: 0,
    search: 0,
  };

  let overallAbilityChange = 0;
  let success = true;
  let message = '';
  let isCrash = false;

  const updatedMember: Member = { ...member };

  switch (activity.type) {
    case 'practice':
      if (problem) {
        const practiceResult = calculatePracticeSuccess(member, problem);
        success = practiceResult.success;
        Object.assign(abilityChange, practiceResult.abilityGain);
        message = practiceResult.message;

        Object.keys(abilityChange).forEach(kp => {
          updatedMember.knowledgePoints[kp as KnowledgePoint] = Math.min(
            100,
            updatedMember.knowledgePoints[kp as KnowledgePoint] + abilityChange[kp as KnowledgePoint]
          );
        });

        overallAbilityChange = Math.round(
          Object.values(abilityChange).reduce((a, b) => a + b, 0) / Object.keys(abilityChange).length
        );
        updatedMember.overallAbility = Math.min(
          100,
          updatedMember.overallAbility + overallAbilityChange
        );
        updatedMember.practiceCount++;
        updatedMember.consecutivePracticeDays++;
        updatedMember.consecutiveRestDays = 0;
      }
      break;

    case 'review':
      const reviewKp = activity.knowledgePoint;
      if (reviewKp) {
        const reviewGain = 3 + Math.floor(Math.random() * 3);
        abilityChange[reviewKp] = reviewGain;
        updatedMember.knowledgePoints[reviewKp] = Math.min(
          100,
          updatedMember.knowledgePoints[reviewKp] + reviewGain
        );
        overallAbilityChange = Math.round(reviewGain / 8);
        updatedMember.overallAbility = Math.min(
          100,
          updatedMember.overallAbility + overallAbilityChange
        );
        message = `复盘${KNOWLEDGE_POINTS.find(k => k === reviewKp) ? '' : ''}知识点，巩固了基础。`;
        updatedMember.reviewCount++;
        updatedMember.consecutivePracticeDays = 0;
        updatedMember.consecutiveRestDays = 0;
      }
      break;

    case 'rest':
      message = '好好休息了一天，精力恢复了不少。';
      updatedMember.consecutiveRestDays++;
      updatedMember.consecutivePracticeDays = 0;
      break;
  }

  updatedMember.fatigue = Math.max(
    0,
    Math.min(updatedMember.maxFatigue, updatedMember.fatigue + fatigueChange)
  );
  updatedMember.lastActivity = activity.type;

  if (checkCrash(updatedMember, settings)) {
    isCrash = true;
    success = false;
    message = '⚠️ 疲劳过度！队员崩溃了，需要强制休息。';
    updatedMember.fatigue = updatedMember.maxFatigue;
    updatedMember.crashCount++;
  }

  const result: ActivityResult = {
    activityId: activity.id,
    memberId: activity.memberId,
    type: activity.type,
    day: activity.day,
    success,
    fatigueChange,
    abilityChange,
    overallAbilityChange,
    problemId: activity.problemId,
    knowledgePoint: activity.knowledgePoint,
    message,
    isCrash,
  };

  return { result, updatedMember };
}

export function executeContest(
  contest: Contest,
  members: Member[],
  settings: GameState['settings']
): { result: ContestResult; updatedMembers: Member[] } {
  const updatedMembers = members.map(m => ({ ...m }));
  const problemResults: ContestResult['problemResults'] = [];
  const memberPerformances: ContestResult['memberPerformances'] = [];

  let totalScore = 0;

  for (const problem of contest.problems) {
    let bestMember: Member | null = null;
    let bestAbility = -1;

    for (const member of updatedMembers) {
      const ability = calculateEffectiveAbility(member, problem.knowledgePoints);
      if (ability > bestAbility) {
        bestAbility = ability;
        bestMember = member;
      }
    }

    if (bestMember) {
      const successChance = Math.min(
        0.9,
        (bestAbility / 100) * { easy: 1.2, medium: 1.0, hard: 0.7 }[problem.difficulty]
      );
      const solved = Math.random() < successChance;
      const score = solved ? problem.points : Math.floor(problem.points * 0.1 * Math.random());

      problemResults.push({
        problemId: problem.id,
        solved,
        score,
        attemptedBy: bestMember.id,
      });

      totalScore += score;

      const fatigueUsed = Math.round(settings.practiceFatigueCost * bestMember.maxFatigue * 0.5);
      bestMember.fatigue = Math.min(bestMember.maxFatigue, bestMember.fatigue + fatigueUsed);

      const memberPerf = memberPerformances.find(mp => mp.memberId === bestMember!.id);
      if (memberPerf) {
        memberPerf.score += score;
        memberPerf.fatigueUsed += fatigueUsed;
        memberPerf.problemsSolved += solved ? 1 : 0;
      } else {
        memberPerformances.push({
          memberId: bestMember.id,
          score,
          fatigueUsed,
          problemsSolved: solved ? 1 : 0,
        });
      }

      if (solved) {
        for (const kp of problem.knowledgePoints) {
          bestMember.knowledgePoints[kp] = Math.min(
            100,
            bestMember.knowledgePoints[kp] + 1
          );
        }
      }
    }
  }

  for (const member of updatedMembers) {
    if (!memberPerformances.find(mp => mp.memberId === member.id)) {
      memberPerformances.push({
        memberId: member.id,
        score: 0,
        fatigueUsed: 0,
        problemsSolved: 0,
      });
    }
  }

  const passed = totalScore >= contest.targetScore;
  const rank = passed ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 5) + 4;

  const result: ContestResult = {
    contestId: contest.id,
    day: contest.day,
    totalScore,
    targetScore: contest.targetScore,
    problemResults,
    memberPerformances,
    passed,
    rank,
  };

  return { result, updatedMembers };
}

export function analyzeProblems(
  members: Member[],
  activityResults: ActivityResult[],
  day: number
): ProblemDiscovery[] {
  const discoveries: ProblemDiscovery[] = [];

  for (const member of members) {
    if (member.fatigue >= member.maxFatigue * 0.7) {
      discoveries.push({
        id: generateId('disc'),
        day,
        type: 'fatigue',
        description: `队员「${member.name}」疲劳值过高（${Math.round(member.fatigue / member.maxFatigue * 100)}%），需要安排休息。`,
        severity: member.fatigue >= member.maxFatigue * 0.9 ? 'high' : 'medium',
        discoveredBy: '系统监测',
      });
    }

    const kpValues = Object.values(member.knowledgePoints);
    const minKp = Math.min(...kpValues);
    const maxKp = Math.max(...kpValues);

    if (maxKp - minKp > 30) {
      const weakKp = Object.entries(member.knowledgePoints).find(([_, v]) => v === minKp)?.[0];
      const weakKpName = weakKp ? KNOWLEDGE_POINTS.find(k => k === weakKp) : '';
      discoveries.push({
        id: generateId('disc'),
        day,
        type: 'knowledge_gap',
        description: `队员「${member.name}」存在知识点短板，${weakKpName}能力仅为${minKp}，与最强项差距${maxKp - minKp}。`,
        severity: maxKp - minKp > 40 ? 'high' : 'medium',
        discoveredBy: '能力分析',
      });
    }

    if (maxKp - minKp > 20) {
      discoveries.push({
        id: generateId('disc'),
        day,
        type: 'imbalance',
        description: `队员「${member.name}」知识点发展不均衡，方差较大，建议均衡发展。`,
        severity: 'low',
        discoveredBy: '能力分析',
      });
    }
  }

  const recentResults = activityResults.filter(r => r.day >= day - 3);
  const reviewCount = recentResults.filter(r => r.type === 'review').length;
  const practiceCount = recentResults.filter(r => r.type === 'practice').length;

  if (practiceCount > 0 && reviewCount === 0) {
    discoveries.push({
      id: generateId('disc'),
      day,
      type: 'lack_of_review',
      description: '近3天只有刷题没有复盘，知识点容易遗忘，建议安排复盘。',
      severity: 'medium',
      discoveredBy: '训练分析',
    });
  } else if (practiceCount > 0 && reviewCount / practiceCount < 0.2) {
    discoveries.push({
      id: generateId('disc'),
      day,
      type: 'lack_of_review',
      description: '复盘比例偏低（刷题:复盘 = ' + practiceCount + ':' + reviewCount + '），建议增加复盘频率。',
      severity: 'low',
      discoveredBy: '训练分析',
    });
  }

  return discoveries;
}

export function suggestCorrection(problem: ProblemDiscovery): CorrectionAction {
  let action = '';
  let description = '';
  let expectedEffect = '';

  switch (problem.type) {
    case 'fatigue':
      action = '安排休息';
      description = '为高疲劳队员安排1-2天的休息时间，避免崩盘。';
      expectedEffect = '疲劳值下降，训练效率恢复正常。';
      break;
    case 'knowledge_gap':
      action = '专项训练';
      description = '针对短板知识点安排专项刷题和复盘。';
      expectedEffect = '短板知识点能力提升，整体均衡发展。';
      break;
    case 'lack_of_review':
      action = '增加复盘';
      description = '调整训练计划，每3次刷题至少安排1次复盘。';
      expectedEffect = '知识点巩固率提升，长期学习效果更好。';
      break;
    case 'imbalance':
      action = '均衡训练';
      description = '调整各知识点训练时间分配，避免偏科。';
      expectedEffect = '各知识点能力均衡提升，综合能力更强。';
      break;
  }

  return {
    id: generateId('corr'),
    problemId: problem.id,
    day: problem.day,
    action,
    description,
    expectedEffect,
    confirmedBy: '',
    confirmedAt: 0,
  };
}

export function createInitialState(): GameState {
  const now = Date.now();
  const version: VersionInfo = {
    dataVersion: '1.0.0',
    schemaVersion: 1,
    memberVersion: 1,
    problemVersion: 1,
    contestVersion: 1,
    lastUpdated: now,
  };

  const replay: Replay = {
    id: generateId('replay'),
    gameId: generateId('game'),
    startTime: now,
    endTime: 0,
    steps: [],
    finalResult: 'playing',
    finalScore: 0,
    version,
  };

  return {
    id: replay.gameId,
    currentDay: 1,
    totalDays: DEFAULT_CONFIG.totalDays,
    phase: 'planning',
    status: 'playing',
    members: JSON.parse(JSON.stringify(DEFAULT_CONFIG.initialMembers)),
    problems: JSON.parse(JSON.stringify(DEFAULT_CONFIG.initialProblems)),
    contests: JSON.parse(JSON.stringify(DEFAULT_CONFIG.contests)),
    completedContests: [],
    scheduledActivities: [],
    activityResults: [],
    keyDecisions: [],
    problemDiscoveries: [],
    correctionActions: [],
    totalScore: 0,
    targetScore: DEFAULT_CONFIG.targetScore,
    version,
    replay,
    createdAt: now,
    updatedAt: now,
    settings: { ...DEFAULT_CONFIG.settings },
  };
}

export function createReplayStep(
  state: GameState,
  decisions: KeyDecision[],
  results: ActivityResult[]
): ReplayStep {
  return {
    day: state.currentDay,
    phase: state.phase,
    state: {
      currentDay: state.currentDay,
      members: JSON.parse(JSON.stringify(state.members)),
      totalScore: state.totalScore,
      status: state.status,
    },
    decisions: JSON.parse(JSON.stringify(decisions)),
    results: JSON.parse(JSON.stringify(results)),
    timestamp: Date.now(),
  };
}

export function applyKnowledgeDecay(members: Member[], decayRate: number): Member[] {
  return members.map(member => {
    const updated = { ...member };
    for (const kp of KNOWLEDGE_POINTS) {
      const decay = Math.floor(updated.knowledgePoints[kp] * decayRate);
      updated.knowledgePoints[kp] = Math.max(0, updated.knowledgePoints[kp] - decay);
    }
    const avgDecay = Math.floor(
      Object.values(updated.knowledgePoints).reduce((a, b) => a + b, 0) / KNOWLEDGE_POINTS.length * decayRate
    );
    updated.overallAbility = Math.max(0, updated.overallAbility - avgDecay);
    return updated;
  });
}

export function checkGameEnd(state: GameState): GameState {
  const updated = { ...state };
  
  if (state.currentDay > state.totalDays) {
    updated.status = state.totalScore >= state.targetScore ? 'won' : 'lost';
    updated.phase = 'result';
    updated.replay.endTime = Date.now();
    updated.replay.finalResult = updated.status;
    updated.replay.finalScore = updated.totalScore;
    return updated;
  }

  const crashedMembers = state.members.filter(m => m.fatigue >= m.maxFatigue);
  if (crashedMembers.length >= state.members.length) {
    updated.status = 'crashed';
    updated.phase = 'result';
    updated.replay.endTime = Date.now();
    updated.replay.finalResult = 'crashed';
    updated.replay.finalScore = updated.totalScore;
    return updated;
  }

  return updated;
}

export function recordKeyDecision(
  state: GameState,
  type: KeyDecision['type'],
  description: string,
  impact: string,
  riskLevel: KeyDecision['riskLevel'] = 'medium'
): KeyDecision {
  return {
    day: state.currentDay,
    type,
    description,
    impact,
    riskLevel,
    timestamp: Date.now(),
  };
}

export function generateVersionInfo(): VersionInfo {
  return {
    dataVersion: '1.0.0',
    schemaVersion: 1,
    memberVersion: 1,
    problemVersion: 1,
    contestVersion: 1,
    lastUpdated: Date.now(),
  };
}
