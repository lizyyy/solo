import type {
  Member,
  LeaveRequest,
  SubstituteRecommendation,
  StandingVersion,
  Conflict,
  RehearsalReport,
  VoicePart,
  Position,
} from '../types';
import { VOICE_PARTS } from '../types';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

export const generateDataHash = (data: unknown): string => {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
};

export const getDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const getMembersByVoicePart = (members: Member[], voicePart: VoicePart): Member[] => {
  return members.filter(m => m.voicePart === voicePart);
};

export const isMemberAvailable = (
  memberId: string, leaveRequests: LeaveRequest[], date: string
): boolean => {
  return !leaveRequests.some(lr => 
    lr.memberId === memberId && 
    lr.status === 'approved' &&
    date >= lr.startDate && 
    date <= lr.endDate
  );
};

export const calculateSubstituteScore = (
  substitute: Member, absentMember: Member
): number => {
  let score = 0;
  
  if (substitute.voicePart === absentMember.voicePart) {
    score += 40;
  }
  
  if (substitute.canLead) {
    score += 30;
  }
  
  score += substitute.experienceLevel * 5;
  
  score += Math.floor(substitute.attendanceRate * 20);
  
  if (substitute.isSubstitute) {
    score += 10;
  }
  
  return score;
};

export const generateSubstituteRecommendations = (
  members: Member[], leaveRequests: LeaveRequest[], date: string
): SubstituteRecommendation[] => {
  const recommendations: SubstituteRecommendation[] = [];
  const approvedLeaves = leaveRequests.filter(lr => 
    lr.status === 'approved' && 
    date >= lr.startDate && date <= lr.endDate
  );
  
  const absentMemberIds = new Set(approvedLeaves.map(lr => lr.memberId));
  const availableMembers = members.filter(m => !absentMemberIds.has(m.id));
  
  for (const leave of approvedLeaves) {
    const absentMember = members.find(m => m.id === leave.memberId);
    if (!absentMember) continue;
    
    const candidates = availableMembers
      .filter(m => m.id !== absentMember.id)
      .map(m => ({
        member: m,
        score: calculateSubstituteScore(m, absentMember),
        reasons: [
          m.voicePart === absentMember.voicePart ? '声部匹配' : '声部不同',
          m.canLead ? '可担任声部长' : '不可担任声部长',
          `经验等级: ${m.experienceLevel}`,
        ],
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    
    for (const candidate of candidates) {
      recommendations.push({
        id: generateId(),
        leaveRequestId: leave.id,
        substituteId: candidate.member.id,
        score: candidate.score,
        reasons: candidate.reasons,
        status: 'pending',
      });
    }
  }
  
  return recommendations;
};

export const detectConflicts = (
  members: Member[], leaveRequests: LeaveRequest[], 
  recommendations: SubstituteRecommendation[], 
  standingVersion: StandingVersion | null
): Conflict[] => {
  const conflicts: Conflict[] = [];
  
  const selectedSubstitutes = recommendations.filter(r => r.status === 'selected');
  
  const substituteCounts = new Map<string, number>();
  for (const rec of selectedSubstitutes) {
    const count = substituteCounts.get(rec.substituteId) ?? 0;
    substituteCounts.set(rec.substituteId, count + 1);
  }
  
  for (const [substituteId, count] of substituteCounts.entries()) {
    if (count > 1) {
      const substitute = members.find(m => m.id === substituteId);
      conflicts.push({
        id: generateId(),
        type: 'duplicate_substitute',
        severity: 'high',
        description: `替补成员 ${substitute?.name ?? substituteId} 被同时指派给多个请假请求`,
        affectedItems: selectedSubstitutes
          .filter(r => r.substituteId === substituteId)
          .map(r => r.leaveRequestId),
      });
    }
  }
  
  const approvedLeaves = leaveRequests.filter(lr => lr.status === 'approved');
  const absentIds = new Set(approvedLeaves.map(lr => lr.memberId));
  
  for (const part of VOICE_PARTS) {
    const partMembers = members.filter(m => m.voicePart === part);
    const absentInPart = partMembers.filter(m => absentIds.has(m.id));
    const substitutesInPart = selectedSubstitutes.filter(r => {
      const sub = members.find(m => m.id === r.substituteId);
      return sub?.voicePart === part;
    });
    
    const actualCount = partMembers.length - absentInPart.length + substitutesInPart.length;
    
    if (actualCount < partMembers.length * 0.6) {
      conflicts.push({
        id: generateId(),
        type: 'voice_imbalance',
        severity: actualCount < partMembers.length * 0.4 ? 'high' : 'medium',
        description: `声部 ${part} 人数不足，计划 ${partMembers.length} 人，实际 ${actualCount} 人`,
        affectedItems: partMembers.map(m => m.id),
      });
    }
  }
  
  if (standingVersion) {
    const positionMap = new Map<string, string>();
    for (const pos of standingVersion.positions) {
      const key = `${pos.position.row}-${pos.position.col}`;
      const existing = positionMap.get(key);
      if (existing) {
        const member1 = members.find(m => m.id === pos.memberId);
        const member2 = members.find(m => m.id === existing);
        conflicts.push({
          id: generateId(),
          type: 'position_conflict',
          severity: 'high',
          description: `站位冲突：${member1?.name ?? pos.memberId} 和 ${member2?.name ?? existing} 在同一位置`,
          affectedItems: [pos.memberId, existing],
        });
      } else {
        positionMap.set(key, pos.memberId);
      }
    }
  }
  
  for (const part of VOICE_PARTS) {
    const partMembers = members.filter(m => m.voicePart === part);
    const leadersInPart = partMembers.filter(m => m.isSectionLeader);
    const absentLeaders = leadersInPart.filter(m => absentIds.has(m.id));
    const hasSubstituteLeader = selectedSubstitutes.some(r => {
      const sub = members.find(m => m.id === r.substituteId);
      return sub?.voicePart === part && sub?.canLead;
    });
    
    if (absentLeaders.length > 0 && !hasSubstituteLeader) {
      conflicts.push({
        id: generateId(),
        type: 'no_leader',
        severity: 'high',
        description: `声部 ${part} 声部长请假且无替补声部长`,
        affectedItems: absentLeaders.map(m => m.id),
      });
    }
  }
  
  return conflicts;
};

export const createStandingVersion = (
  name: string, date: string, members: Member[], 
  leaveRequests: LeaveRequest[], 
  recommendations: SubstituteRecommendation[], _rows: number = 4, cols: number = 8
): StandingVersion => {
  const approvedLeaves = leaveRequests.filter(lr => 
    lr.status === 'approved' && date >= lr.startDate && date <= lr.endDate
  );
  const absentIds = new Set(approvedLeaves.map(lr => lr.memberId));
  const selectedSubstitutes = recommendations.filter(r => r.status === 'selected');
  const substituteForLeave = new Map(selectedSubstitutes.map(r => [r.leaveRequestId, r.substituteId]));
  
  const positions: { memberId: string; position: Position }[] = [];
  let row = 0, col = 0;
  
  for (const part of VOICE_PARTS) {
    const partMembers = members.filter(m => m.voicePart === part);
    
    for (const member of partMembers) {
      if (!absentIds.has(member.id)) {
        positions.push({ memberId: member.id, position: { row, col } });
        col++;
        if (col >= cols) {
          col = 0;
          row++;
        }
      } else {
        const leave = approvedLeaves.find(lr => lr.memberId === member.id);
        if (leave && substituteForLeave.has(leave.id)) {
          const substituteId = substituteForLeave.get(leave.id)!;
          positions.push({ memberId: substituteId, position: { row, col } });
          col++;
          if (col >= cols) {
            col = 0;
            row++;
          }
        }
      }
    }
  }
  
  const version: StandingVersion = {
    id: generateId(),
    name,
    date,
    positions,
    createdAt: new Date().toISOString(),
    createdBy: 'system',
    isActive: true,
    conflicts: [],
  };
  
  version.conflicts = detectConflicts(members, leaveRequests, recommendations, version);
  
  return version;
};

export const generateReport = (
  members: Member[], leaveRequests: LeaveRequest[],
  recommendations: SubstituteRecommendation[],
  standingVersion: StandingVersion, date: string
): RehearsalReport => {
  const approvedLeaves = leaveRequests.filter(lr => 
    lr.status === 'approved' && date >= lr.startDate && date <= lr.endDate
  );
  const absentIds = new Set(approvedLeaves.map(lr => lr.memberId));
  const selectedSubstitutes = recommendations.filter(r => r.status === 'selected');
  
  const voicePartBalance = {} as Record<VoicePart, { planned: number; actual: number; leaders: number }>;
  
  for (const part of VOICE_PARTS) {
    const partMembers = members.filter(m => m.voicePart === part);
    const absentInPart = partMembers.filter(m => absentIds.has(m.id));
    const substitutesInPart = selectedSubstitutes.filter(r => {
      const sub = members.find(m => m.id === r.substituteId);
      return sub?.voicePart === part;
    });
    const leadersInPart = partMembers.filter(m => m.isSectionLeader && !absentIds.has(m.id));
    
    voicePartBalance[part] = {
      planned: partMembers.length,
      actual: partMembers.length - absentInPart.length + substitutesInPart.length,
      leaders: leadersInPart.length,
    };
  }
  
  const reportData = {
    members,
    leaveRequests,
    recommendations,
    standingVersion,
    date,
  };
  
  return {
    id: generateId(),
    date,
    leaveRequests: approvedLeaves,
    substituteAssignments: selectedSubstitutes,
    standingVersion,
    summary: {
      totalMembers: members.length,
      absentMembers: absentIds.size,
      presentMembers: members.length - absentIds.size,
      substitutesUsed: selectedSubstitutes.length,
      voicePartBalance,
    },
    issues: standingVersion.conflicts,
    exportedAt: new Date().toISOString(),
    dataHash: generateDataHash(reportData),
  };
};

export const exportReportToJSON = (report: RehearsalReport): string => {
  return JSON.stringify(report, null, 2);
};

export const exportReportToText = (report: RehearsalReport, members: Member[]): string => {
  const getMemberName = (id: string) => members.find(m => m.id === id)?.name ?? id;
  
  let text = `合唱团排练报告\n`;
  text += `日期: ${report.date}\n`;
  text += `导出时间: ${report.exportedAt}\n`;
  text += `数据校验码: ${report.dataHash}\n\n`;
  
  text += `=== 人员统计 ===\n`;
  text += `总人数: ${report.summary.totalMembers}\n`;
  text += `缺席人数: ${report.summary.absentMembers}\n`;
  text += `出勤人数: ${report.summary.presentMembers}\n`;
  text += `使用替补人数: ${report.summary.substitutesUsed}\n\n`;
  
  text += `=== 声部平衡 ===\n`;
  for (const [part, stats] of Object.entries(report.summary.voicePartBalance)) {
    text += `${part}: 计划 ${stats.planned} 人, 实际 ${stats.actual} 人, 声部长 ${stats.leaders} 人\n`;
  }
  text += '\n';
  
  text += `=== 请假名单 ===\n`;
  for (const leave of report.leaveRequests) {
    text += `- ${getMemberName(leave.memberId)}: ${leave.startDate} ~ ${leave.endDate}\n`;
    text += `  原因: ${leave.reason}\n`;
  }
  text += '\n';
  
  text += `=== 替补安排 ===\n`;
  for (const sub of report.substituteAssignments) {
    const leave = report.leaveRequests.find(lr => lr.id === sub.leaveRequestId);
    text += `- 请假: ${getMemberName(leave?.memberId ?? '')} → 替补: ${getMemberName(sub.substituteId)}\n`;
    text += `  推荐分数: ${sub.score}\n`;
  }
  text += '\n';
  
  text += `=== 问题与冲突 ===\n`;
  if (report.issues.length === 0) {
    text += `无冲突\n`;
  } else {
    for (const issue of report.issues) {
      text += `- [${issue.severity}] ${issue.description}\n`;
      text += `  影响: ${issue.affectedItems.map(getMemberName).join(', ')}\n`;
    }
  }
  
  return text;
};
