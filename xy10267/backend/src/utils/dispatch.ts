import { Aunt, Order, Skill, Taboo, DispatchCandidate, Leave } from '../types';

export const calculateDistance = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const matchSkills = (auntSkills: Skill[], requiredSkills: Skill[]): Skill[] => {
  return requiredSkills.filter(skill => auntSkills.includes(skill));
};

const checkTabooConflicts = (
  auntTaboos: Taboo[], 
  customerTaboos: Taboo[]
): Taboo[] => {
  const conflicts: Taboo[] = [];
  auntTaboos.forEach(taboo => {
    if (customerTaboos.includes(taboo)) {
      conflicts.push(taboo);
    }
  });
  return conflicts;
};

const isAuntOnLeave = (
  auntId: string,
  orderStartTime: string,
  orderEndTime: string,
  leaves: Leave[]
): boolean => {
  const orderStart = new Date(orderStartTime).getTime();
  const orderEnd = new Date(orderEndTime).getTime();
  
  return leaves.some(leave => {
    if (leave.auntId !== auntId || !leave.isApproved) return false;
    const leaveStart = new Date(leave.startTime).getTime();
    const leaveEnd = new Date(leave.endTime).getTime();
    return (orderStart < leaveEnd && orderEnd > leaveStart);
  });
};

export const scoreCandidate = (
  aunt: Aunt,
  order: Order,
  leaves: Leave[]
): DispatchCandidate => {
  const reasons: string[] = [];
  
  if (!aunt.isAvailable) {
    return {
      aunt,
      score: 0,
      distanceKm: calculateDistance(
        aunt.location.lat, aunt.location.lng,
        order.location.lat, order.location.lng
      ),
      matchedSkills: matchSkills(aunt.skills, order.skillsRequired),
      tabooConflicts: [],
      reasons: ['阿姨当前不可用']
    };
  }
  
  if (isAuntOnLeave(aunt.id, order.startTime, order.endTime, leaves)) {
    return {
      aunt,
      score: 0,
      distanceKm: calculateDistance(
        aunt.location.lat, aunt.location.lng,
        order.location.lat, order.location.lng
      ),
      matchedSkills: matchSkills(aunt.skills, order.skillsRequired),
      tabooConflicts: [],
      reasons: ['阿姨在订单时间段内请假']
    };
  }
  
  const matchedSkills = matchSkills(aunt.skills, order.skillsRequired);
  const tabooConflicts = checkTabooConflicts(aunt.taboos, order.customerTaboos);
  const distance = calculateDistance(
    aunt.location.lat, aunt.location.lng,
    order.location.lat, order.location.lng
  );
  
  let score = 0;
  
  if (matchedSkills.length === order.skillsRequired.length) {
    score += 40;
    reasons.push('技能完全匹配');
  } else if (matchedSkills.length > 0) {
    score += (matchedSkills.length / order.skillsRequired.length) * 30;
    reasons.push(`技能匹配度: ${matchedSkills.length}/${order.skillsRequired.length}`);
  }
  
  if (tabooConflicts.length === 0) {
    score += 25;
    reasons.push('无禁忌冲突');
  } else {
    score -= tabooConflicts.length * 10;
    reasons.push(`存在 ${tabooConflicts.length} 个禁忌冲突`);
  }
  
  if (distance <= 2) {
    score += 20;
    reasons.push(`距离较近 (${distance.toFixed(1)}km)`);
  } else if (distance <= 5) {
    score += 15;
    reasons.push(`距离适中 (${distance.toFixed(1)}km)`);
  } else if (distance <= 10) {
    score += 10;
    reasons.push(`距离较远 (${distance.toFixed(1)}km)`);
  } else {
    score += 5;
    reasons.push(`距离很远 (${distance.toFixed(1)}km)`);
  }
  
  score += aunt.rating * 3;
  if (aunt.rating >= 4.5) {
    reasons.push(`评分优秀 (${aunt.rating})`);
  }
  
  score += Math.min(aunt.experienceYears * 1.5, 15);
  if (aunt.experienceYears >= 5) {
    reasons.push(`经验丰富 (${aunt.experienceYears}年)`);
  }
  
  score = Math.max(0, Math.min(100, score));
  
  return {
    aunt,
    score,
    distanceKm: distance,
    matchedSkills,
    tabooConflicts,
    reasons
  };
};

export const findCandidates = (
  order: Order,
  aunts: Aunt[],
  leaves: Leave[]
): DispatchCandidate[] => {
  return aunts
    .map(aunt => scoreCandidate(aunt, order, leaves))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.distanceKm - b.distanceKm;
    });
};

export const getBestCandidate = (
  order: Order,
  aunts: Aunt[],
  leaves: Leave[]
): DispatchCandidate | null => {
  const candidates = findCandidates(order, aunts, leaves);
  const validCandidates = candidates.filter(c => c.score > 0);
  return validCandidates.length > 0 ? validCandidates[0] : null;
};
