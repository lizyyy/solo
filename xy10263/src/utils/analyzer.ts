import type { Player, Clue, Conflict, Gap, Statistics } from '../types';
import { generateId } from './hash';

export function detectConflicts(clues: Clue[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const testimonies = clues.filter(c => c.type === 'testimony');
  
  for (let i = 0; i < testimonies.length; i++) {
    for (let j = i + 1; j < testimonies.length; j++) {
      const t1 = testimonies[i];
      const t2 = testimonies[j];
      
      if (t1.playerId === t2.playerId) continue;
      if (t1.timelineTime === t2.timelineTime) {
        if (
          (t1.content.includes('看到') && t2.content.includes('离开')) ||
          (t1.content.includes('离开') && t2.content.includes('看到')) ||
          (t1.notes.includes('冲突') || t2.notes.includes('冲突'))
        ) {
          conflicts.push({
            id: generateId(),
            type: 'testimony_conflict',
            involvedClueIds: [t1.id, t2.id],
            description: `「${t1.title}」与「${t2.title}」存在证词冲突`,
            resolved: false,
          });
        }
      }
      
      if (t1.timelineTime === t2.timelineTime && !t1.content.includes(t2.playerId)) {
        const sameTime = clues.filter(c => 
          c.timelineTime === t1.timelineTime && 
          c.id !== t1.id && 
          c.id !== t2.id
        );
        if (sameTime.length > 0 && conflicts.every(c => 
          !c.involvedClueIds.includes(t1.id) && !c.involvedClueIds.includes(t2.id)
        )) {
          if (Math.random() > 0.7) {
            conflicts.push({
              id: generateId(),
              type: 'time_conflict',
              involvedClueIds: [t1.id, t2.id, sameTime[0].id],
              description: `时间点 ${t1.timelineTime} 存在多个相互矛盾的事件描述`,
              resolved: false,
            });
          }
        }
      }
    }
  }
  
  const unresolved = clues.filter(c => c.status === 'unresolved');
  const analyzed = clues.filter(c => c.status === 'analyzed');
  
  for (const u of unresolved) {
    for (const a of analyzed) {
      if (u.id !== a.id && conflicts.every(c => 
        !c.involvedClueIds.includes(u.id) && !c.involvedClueIds.includes(a.id)
      )) {
        if (u.notes.includes('冲突') || a.notes.includes('冲突')) {
          conflicts.push({
            id: generateId(),
            type: 'logic_conflict',
            involvedClueIds: [u.id, a.id],
            description: `「${u.title}」与已分析的「${a.title}」可能存在逻辑矛盾`,
            resolved: false,
          });
        }
      }
    }
  }
  
  return conflicts;
}

export function detectGaps(clues: Clue[], players: Player[]): Gap[] {
  const gaps: Gap[] = [];
  
  if (clues.length === 0) return gaps;
  
  const allTimes = clues.map(c => c.timelineTime).sort((a, b) => a - b);
  const minTime = allTimes[0];
  const maxTime = allTimes[allTimes.length - 1];
  
  for (let t = minTime; t < maxTime; t++) {
    if (!allTimes.includes(t)) {
      const existingGap = gaps.find(g => 
        g.type === 'timeline_gap' && 
        g.relatedTimeRange && 
        g.relatedTimeRange[1] === t
      );
      
      if (!existingGap) {
        gaps.push({
          id: generateId(),
          type: 'timeline_gap',
          description: `时间点 ${t} 缺乏线索覆盖，建议补充该时段的信息`,
          relatedTimeRange: [t, t],
        });
      }
    }
  }
  
  const playersWithClues = new Set(clues.map(c => c.playerId));
  for (const player of players) {
    if (!playersWithClues.has(player.id)) {
      gaps.push({
        id: generateId(),
        type: 'unassigned',
        description: `玩家「${player.name}（${player.role}）」暂无关联线索`,
        relatedPlayerId: player.id,
      });
    }
  }
  
  for (const clue of clues) {
    if (clue.status === 'found') {
      const hasRelatedGap = gaps.some(g => 
        g.description.includes(clue.title) || 
        g.description.includes(clue.playerId)
      );
      
      if (!hasRelatedGap) {
        const player = players.find(p => p.id === clue.playerId);
        if (player && Math.random() > 0.8) {
          gaps.push({
            id: generateId(),
            type: 'missing_clue',
            description: `线索「${clue.title}」仅标记为发现，但尚未深入分析`,
            relatedPlayerId: clue.playerId,
          });
        }
      }
    }
  }
  
  return gaps;
}

export function calculateStatistics(
  clues: Clue[],
  players: Player[],
  conflicts: Conflict[],
  gaps: Gap[]
): Statistics {
  const totalClues = clues.length;
  
  const cluesByPlayer: Record<string, number> = {};
  players.forEach(p => {
    cluesByPlayer[p.id] = clues.filter(c => c.playerId === p.id).length;
  });
  
  const cluesByStatus: Record<'found' | 'analyzed' | 'unresolved' | 'resolved', number> = {
    found: clues.filter(c => c.status === 'found').length,
    analyzed: clues.filter(c => c.status === 'analyzed').length,
    unresolved: clues.filter(c => c.status === 'unresolved').length,
    resolved: clues.filter(c => c.status === 'resolved').length,
  };
  
  const cluesByType: Record<'physical' | 'testimony' | 'document' | 'special', number> = {
    physical: clues.filter(c => c.type === 'physical').length,
    testimony: clues.filter(c => c.type === 'testimony').length,
    document: clues.filter(c => c.type === 'document').length,
    special: clues.filter(c => c.type === 'special').length,
  };
  
  const conflictsTotal = conflicts.length;
  const conflictsResolved = conflicts.filter(c => c.resolved).length;
  const gapsTotal = gaps.length;
  
  let timelineCoverage = 0;
  if (clues.length > 0) {
    const allTimes = clues.map(c => c.timelineTime);
    const minTime = Math.min(...allTimes);
    const maxTime = Math.max(...allTimes);
    const totalSlots = maxTime - minTime + 1;
    const coveredSlots = new Set(allTimes).size;
    timelineCoverage = totalSlots > 0 ? Math.round((coveredSlots / totalSlots) * 100) : 0;
  }
  
  return {
    totalClues,
    cluesByPlayer,
    cluesByStatus,
    cluesByType,
    conflictsTotal,
    conflictsResolved,
    gapsTotal,
    timelineCoverage,
  };
}

export function sortCluesByTimeline(clues: Clue[]): Clue[] {
  return [...clues].sort((a, b) => a.timelineTime - b.timelineTime);
}

export function groupCluesByPlayer(clues: Clue[], players: Player[]): Map<string, Clue[]> {
  const map = new Map<string, Clue[]>();
  
  for (const player of players) {
    map.set(player.id, []);
  }
  
  for (const clue of clues) {
    const existing = map.get(clue.playerId) || [];
    map.set(clue.playerId, [...existing, clue]);
  }
  
  return map;
}
