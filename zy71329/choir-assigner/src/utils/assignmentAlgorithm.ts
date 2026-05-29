import type { Member, VoicePart, Assignment, ConflictItem, ConflictType, AssignmentResult } from '../types';
import { NOTE_TO_MIDI } from '../types';

function getMidiValue(note: string): number {
  return NOTE_TO_MIDI[note] || 60;
}

function calculateVoiceMatchScore(member: Member, part: VoicePart): number {
  const memberLow = getMidiValue(member.voiceRange.lowest);
  const memberHigh = getMidiValue(member.voiceRange.highest);
  const partLow = getMidiValue(part.range.lowest);
  const partHigh = getMidiValue(part.range.highest);

  const overlapLow = Math.max(memberLow, partLow);
  const overlapHigh = Math.min(memberHigh, partHigh);

  if (overlapLow > overlapHigh) {
    return 0;
  }

  const overlapRange = overlapHigh - overlapLow;
  const partRange = partHigh - partLow;
  const rangeScore = Math.min(overlapRange / partRange, 1);

  const midMember = (memberLow + memberHigh) / 2;
  const midPart = (partLow + partHigh) / 2;
  const centerDistance = Math.abs(midMember - midPart);
  const centerScore = Math.max(1 - centerDistance / 12, 0.3);

  let preferenceScore = 1;
  if (member.preferredPart === part.name) {
    preferenceScore = 1.2;
  }

  return rangeScore * centerScore * preferenceScore * 100;
}

function createConflict(type: ConflictType, severity: 'warning' | 'error' | 'info', message: string, details?: Record<string, any>): ConflictItem {
  return { type, severity, message, details };
}

function detectMemberConflicts(member: Member, part: VoicePart, assignments: Assignment[]): ConflictItem[] {
  const conflicts: ConflictItem[] = [];
  const voiceScore = calculateVoiceMatchScore(member, part);

  if (voiceScore < 40) {
    conflicts.push(createConflict(
      'VOICE_MISMATCH',
      'warning',
      `${member.name} 的音域与 ${part.displayName} 匹配度较低 (${Math.round(voiceScore)}%)`,
      { memberId: member.id, partId: part.id, matchScore: voiceScore }
    ));
  }

  if (member.attendance.rate < 0.7) {
    conflicts.push(createConflict(
      'ABSENTEEISM',
      'warning',
      `${member.name} 出勤率较低 (${Math.round(member.attendance.rate * 100)}%)，可能影响排练效果`,
      { memberId: member.id, attendanceRate: member.attendance.rate }
    ));
  }

  if (member.bindPartnerId) {
    const partnerAssignment = assignments.find(a => a.memberId === member.bindPartnerId);
    if (partnerAssignment && partnerAssignment.partId !== part.id) {
      conflicts.push(createConflict(
        'PARTNER_SPLIT',
        'error',
        `${member.name} 与绑定搭档 ${member.bindPartnerName} 被分配到不同声部`,
        { memberId: member.id, partnerId: member.bindPartnerId, partnerName: member.bindPartnerName }
      ));
    }
  }

  return conflicts;
}

function detectGlobalConflicts(assignments: Assignment[], parts: VoicePart[], members: Member[]): ConflictItem[] {
  const conflicts: ConflictItem[] = [];
  const partCounts: Record<string, number> = {};
  const veteranCounts: Record<string, number> = {};

  parts.forEach(part => {
    partCounts[part.id] = 0;
    veteranCounts[part.id] = 0;
  });

  assignments.forEach(assignment => {
    partCounts[assignment.partId] = (partCounts[assignment.partId] || 0) + 1;
    const member = members.find(m => m.id === assignment.memberId);
    if (member?.isVeteran) {
      veteranCounts[assignment.partId] = (veteranCounts[assignment.partId] || 0) + 1;
    }
  });

  parts.forEach(part => {
    const count = partCounts[part.id] || 0;
    const veterans = veteranCounts[part.id] || 0;

    if (count > part.maxMembers) {
      conflicts.push(createConflict(
        'OVERCAPACITY',
        'error',
        `${part.displayName} 人数超出上限 (${count}/${part.maxMembers})`,
        { partId: part.id, current: count, max: part.maxMembers }
      ));
    }

    if (count < part.minMembers) {
      conflicts.push(createConflict(
        'UNDERCAPACITY',
        'error',
        `${part.displayName} 人数未达到下限 (${count}/${part.minMembers})`,
        { partId: part.id, current: count, min: part.minMembers }
      ));
    }

    if (part.requiredVeterans && veterans < part.requiredVeterans) {
      conflicts.push(createConflict(
        'VETERAN_SHORTAGE',
        'warning',
        `${part.displayName} 资深团员人数不足 (${veterans}/${part.requiredVeterans})`,
        { partId: part.id, current: veterans, required: part.requiredVeterans }
      ));
    }
  });

  return conflicts;
}

export function assignVoices(members: Member[], parts: VoicePart[]): AssignmentResult {
  const assignments: Assignment[] = [];
  const partMemberCount: Record<string, number> = {};

  parts.forEach(part => {
    partMemberCount[part.id] = 0;
  });

  const boundPairs: Map<string, Member[]> = new Map();
  const unboundMembers: Member[] = [];

  members.forEach(member => {
    if (member.bindPartnerId) {
      const pairKey = [member.id, member.bindPartnerId].sort().join('-');
      if (!boundPairs.has(pairKey)) {
        boundPairs.set(pairKey, []);
      }
      boundPairs.get(pairKey)!.push(member);
    } else {
      unboundMembers.push(member);
    }
  });

  const sortedBoundPairs = Array.from(boundPairs.values()).sort((a, b) => {
    const aMaxSeniority = Math.max(...a.map(m => m.seniority));
    const bMaxSeniority = Math.max(...b.map(m => m.seniority));
    return bMaxSeniority - aMaxSeniority;
  });

  sortedBoundPairs.forEach(pair => {
    const bestPart = findBestPartForGroup(pair, parts, partMemberCount);
    if (bestPart) {
      pair.forEach(member => {
        const score = calculateVoiceMatchScore(member, bestPart);
        assignments.push({
          memberId: member.id,
          memberName: member.name,
          partId: bestPart.id,
          partName: bestPart.name,
          isManual: false,
          matchScore: score,
          conflicts: []
        });
        partMemberCount[bestPart.id]++;
      });
    }
  });

  const sortedMembers = [...unboundMembers].sort((a, b) => {
    if (b.isVeteran !== a.isVeteran) {
      return b.isVeteran ? 1 : -1;
    }
    if (b.seniority !== a.seniority) {
      return b.seniority - a.seniority;
    }
    return b.attendance.rate - a.attendance.rate;
  });

  sortedMembers.forEach(member => {
    const availableParts = parts
      .filter(part => {
        const genderMatch = part.gender === 'mixed' || part.gender === member.gender;
        const capacityMatch = partMemberCount[part.id] < part.maxMembers;
        return genderMatch && capacityMatch;
      })
      .map(part => ({
        part,
        score: calculateVoiceMatchScore(member, part)
      }))
      .sort((a, b) => b.score - a.score);

    if (availableParts.length > 0) {
      const bestMatch = availableParts[0];
      assignments.push({
        memberId: member.id,
        memberName: member.name,
        partId: bestMatch.part.id,
        partName: bestMatch.part.name,
        isManual: false,
        matchScore: bestMatch.score,
        conflicts: []
      });
      partMemberCount[bestMatch.part.id]++;
    }
  });

  assignments.forEach(assignment => {
    const member = members.find(m => m.id === assignment.memberId);
    const part = parts.find(p => p.id === assignment.partId);
    if (member && part) {
      assignment.conflicts = detectMemberConflicts(member, part, assignments);
    }
  });

  const globalConflicts = detectGlobalConflicts(assignments, parts, members);

  const conflictCount: Record<ConflictType, number> = {
    OVERCAPACITY: 0,
    UNDERCAPACITY: 0,
    VOICE_MISMATCH: 0,
    ABSENTEEISM: 0,
    PARTNER_SPLIT: 0,
    VETERAN_SHORTAGE: 0,
    MANUAL_OVERRIDE: 0
  };

  [...globalConflicts, ...assignments.flatMap(a => a.conflicts)].forEach(conflict => {
    conflictCount[conflict.type]++;
  });

  const partsDistribution: Record<string, number> = {};
  parts.forEach(part => {
    partsDistribution[part.name] = partMemberCount[part.id] || 0;
  });

  const totalScore = assignments.reduce((sum, a) => sum + a.matchScore, 0);
  const averageMatchScore = assignments.length > 0 ? totalScore / assignments.length : 0;

  return {
    assignments,
    conflicts: globalConflicts,
    statistics: {
      totalMembers: members.length,
      assignedMembers: assignments.length,
      partsDistribution,
      averageMatchScore,
      conflictCount
    }
  };
}

function findBestPartForGroup(members: Member[], parts: VoicePart[], partMemberCount: Record<string, number>): VoicePart | null {
  const availableParts = parts.filter(part => {
    const remainingCapacity = part.maxMembers - partMemberCount[part.id];
    if (remainingCapacity < members.length) return false;

    return members.every(member => {
      const genderMatch = part.gender === 'mixed' || part.gender === member.gender;
      return genderMatch;
    });
  });

  if (availableParts.length === 0) return null;

  const scoredParts = availableParts.map(part => {
    const totalScore = members.reduce((sum, member) => {
      return sum + calculateVoiceMatchScore(member, part);
    }, 0);
    return { part, avgScore: totalScore / members.length };
  });

  scoredParts.sort((a, b) => b.avgScore - a.avgScore);
  return scoredParts[0]?.part || null;
}

export function recalculateConflicts(
  assignments: Assignment[],
  parts: VoicePart[],
  members: Member[]
): { assignments: Assignment[]; globalConflicts: ConflictItem[] } {
  const updatedAssignments = assignments.map(assignment => {
    const member = members.find(m => m.id === assignment.memberId);
    const part = parts.find(p => p.id === assignment.partId);
    if (member && part) {
      return {
        ...assignment,
        conflicts: detectMemberConflicts(member, part, assignments)
      };
    }
    return assignment;
  });

  const globalConflicts = detectGlobalConflicts(updatedAssignments, parts, members);

  return { assignments: updatedAssignments, globalConflicts };
}
