import {
  BloodBag,
  Application,
  BloodType,
  BloodComponentType,
  MatchResult,
  MatchedBloodBag,
} from '../types';
import { getAvailableBloodBags, getBloodBagById, checkTemperatureAnomaly } from '../storage';

const BLOOD_TYPE_COMPATIBILITY: Record<BloodType, BloodType[]> = {
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'A-': ['A-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+': ['O+', 'O-'],
  'O-': ['O-'],
};

function isBloodTypeCompatible(donorType: BloodType, recipientType: BloodType): boolean {
  const compatibleTypes = BLOOD_TYPE_COMPATIBILITY[recipientType];
  return compatibleTypes.includes(donorType);
}

function getBloodTypeMatchScore(donorType: BloodType, recipientType: BloodType): number {
  if (donorType === recipientType) {
    return 100;
  }
  
  const recipientRh = recipientType.includes('+') ? '+' : '-';
  const donorRh = donorType.includes('+') ? '+' : '-';
  
  if (recipientRh === '+' && donorRh === '-') {
    return 80;
  }
  
  const compatibleTypes = BLOOD_TYPE_COMPATIBILITY[recipientType];
  if (compatibleTypes.includes(donorType)) {
    return 60;
  }
  
  return 0;
}

function getHoursUntilExpiry(expiryDate: string): number {
  const now = Date.now();
  const expiry = new Date(expiryDate).getTime();
  const diffMs = expiry - now;
  return Math.max(0, diffMs / (1000 * 60 * 60));
}

function getExpiryPriorityScore(hoursUntilExpiry: number): number {
  if (hoursUntilExpiry <= 24) {
    return 100;
  } else if (hoursUntilExpiry <= 48) {
    return 80;
  } else if (hoursUntilExpiry <= 72) {
    return 60;
  } else if (hoursUntilExpiry <= 168) {
    return 40;
  }
  return 20;
}

function getCrossMatchScore(
  crossMatchStatus: 'PENDING' | 'COMPATIBLE' | 'INCOMPATIBLE' | 'NOT_REQUIRED',
  crossMatchRequired: boolean
): { score: number; reason: string } {
  if (crossMatchStatus === 'INCOMPATIBLE') {
    return { score: 0, reason: '交叉配血不相容' };
  }
  
  if (crossMatchRequired) {
    if (crossMatchStatus === 'COMPATIBLE') {
      return { score: 100, reason: '交叉配血相容' };
    }
    if (crossMatchStatus === 'NOT_REQUIRED') {
      return { score: 90, reason: '无需交叉配血' };
    }
    return { score: 30, reason: '交叉配血待完成' };
  }
  
  if (crossMatchStatus === 'COMPATIBLE' || crossMatchStatus === 'NOT_REQUIRED') {
    return { score: 100, reason: '配血状态合格' };
  }
  
  return { score: 50, reason: '配血状态待确认' };
}

interface MatchCandidate {
  bloodBag: BloodBag;
  bloodTypeScore: number;
  expiryScore: number;
  crossMatchScore: number;
  hasTemperatureAnomaly: boolean;
  totalScore: number;
  matchReasons: string[];
}

export function findMatchingBloodBags(
  application: Application
): MatchResult {
  const warnings: string[] = [];
  
  const compatibleBloodTypes = BLOOD_TYPE_COMPATIBILITY[application.bloodType];
  
  const allCandidates: MatchCandidate[] = [];
  
  for (const bloodType of compatibleBloodTypes) {
    const availableBags = getAvailableBloodBags(
      bloodType,
      application.componentType,
      application.crossMatchRequired
    );
    
    for (const bag of availableBags) {
      const hasAnomaly = checkTemperatureAnomaly(bag);
      
      if (hasAnomaly) {
        warnings.push(`血袋 ${bag.id} 存在温控异常，已排除`);
        continue;
      }
      
      const bloodTypeScore = getBloodTypeMatchScore(bag.bloodType, application.bloodType);
      const hoursUntilExpiry = getHoursUntilExpiry(bag.expiryDate);
      const expiryScore = getExpiryPriorityScore(hoursUntilExpiry);
      const { score: crossMatchScore, reason: crossMatchReason } = getCrossMatchScore(
        bag.crossMatchStatus,
        application.crossMatchRequired
      );
      
      const matchReasons: string[] = [];
      
      if (bag.bloodType === application.bloodType) {
        matchReasons.push('血型完全匹配');
      } else if (isBloodTypeCompatible(bag.bloodType, application.bloodType)) {
        matchReasons.push(`血型兼容: ${bag.bloodType} 可输给 ${application.bloodType}`);
      }
      
      if (hoursUntilExpiry <= 24) {
        matchReasons.push('临期优先(24小时内到期)');
      } else if (hoursUntilExpiry <= 48) {
        matchReasons.push('临期优先(48小时内到期)');
      }
      
      matchReasons.push(crossMatchReason);
      
      const totalScore = Math.round(
        bloodTypeScore * 0.4 +
        expiryScore * 0.35 +
        crossMatchScore * 0.25
      );
      
      allCandidates.push({
        bloodBag: bag,
        bloodTypeScore,
        expiryScore,
        crossMatchScore,
        hasTemperatureAnomaly: hasAnomaly,
        totalScore,
        matchReasons,
      });
    }
  }
  
  allCandidates.sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    
    const aHours = getHoursUntilExpiry(a.bloodBag.expiryDate);
    const bHours = getHoursUntilExpiry(b.bloodBag.expiryDate);
    if (aHours !== bHours) {
      return aHours - bHours;
    }
    
    return new Date(a.bloodBag.receivedAt).getTime() - new Date(b.bloodBag.receivedAt).getTime();
  });
  
  const topCandidates = allCandidates.slice(0, application.quantity);
  
  const matchedBags: MatchedBloodBag[] = topCandidates.map((candidate) => ({
    bloodBagId: candidate.bloodBag.id,
    bloodType: candidate.bloodBag.bloodType,
    componentType: candidate.bloodBag.componentType,
    expiryDate: candidate.bloodBag.expiryDate,
    hoursUntilExpiry: getHoursUntilExpiry(candidate.bloodBag.expiryDate),
    crossMatchStatus: candidate.bloodBag.crossMatchStatus,
    hasTemperatureAnomaly: candidate.hasTemperatureAnomaly,
    matchScore: candidate.totalScore,
    matchReason: candidate.matchReasons.join('; '),
  }));
  
  const canFulfill = matchedBags.length >= application.quantity;
  const missingQuantity = Math.max(0, application.quantity - matchedBags.length);
  
  if (missingQuantity > 0) {
    warnings.push(`库存不足: 需要 ${application.quantity} 袋，仅匹配到 ${matchedBags.length} 袋`);
  }
  
  const avgScore = matchedBags.length > 0
    ? Math.round(matchedBags.reduce((sum, bag) => sum + bag.matchScore, 0) / matchedBags.length)
    : 0;
  
  return {
    applicationId: application.id,
    matchedBags,
    score: avgScore,
    canFulfill,
    missingQuantity,
    warnings,
  };
}

export function validateBloodBagForReservation(
  bloodBagId: string,
  application: Application
): { valid: boolean; reason?: string } {
  const bloodBag = getBloodBagById(bloodBagId);
  
  if (!bloodBag) {
    return { valid: false, reason: '血袋不存在' };
  }
  
  if (bloodBag.status !== 'AVAILABLE') {
    return { valid: false, reason: `血袋状态为 ${bloodBag.status}，无法预留` };
  }
  
  if (!isBloodTypeCompatible(bloodBag.bloodType, application.bloodType)) {
    return { valid: false, reason: `血型不兼容: ${bloodBag.bloodType} 不能输给 ${application.bloodType}` };
  }
  
  if (bloodBag.componentType !== application.componentType) {
    return { valid: false, reason: `成分类型不匹配: 需要 ${application.componentType}，实际为 ${bloodBag.componentType}` };
  }
  
  if (application.crossMatchRequired && 
      bloodBag.crossMatchStatus === 'INCOMPATIBLE') {
    return { valid: false, reason: '交叉配血不相容' };
  }
  
  if (application.crossMatchRequired && 
      bloodBag.crossMatchStatus === 'PENDING') {
    return { valid: false, reason: '交叉配血尚未完成' };
  }
  
  if (checkTemperatureAnomaly(bloodBag)) {
    return { valid: false, reason: '血袋存在温控异常' };
  }
  
  const hoursUntilExpiry = getHoursUntilExpiry(bloodBag.expiryDate);
  if (hoursUntilExpiry <= 0) {
    return { valid: false, reason: '血袋已过期' };
  }
  
  return { valid: true };
}

export function getBloodTypeCompatibilityInfo(): Record<string, { canDonateTo: string[]; canReceiveFrom: string[] }> {
  const result: Record<string, { canDonateTo: string[]; canReceiveFrom: string[] }> = {};
  
  const allTypes: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  
  for (const recipientType of allTypes) {
    const canReceiveFrom = BLOOD_TYPE_COMPATIBILITY[recipientType];
    const canDonateTo = allTypes.filter((donorType) => 
      BLOOD_TYPE_COMPATIBILITY[donorType].includes(recipientType)
    );
    
    result[recipientType] = {
      canDonateTo,
      canReceiveFrom,
    };
  }
  
  return result;
}
