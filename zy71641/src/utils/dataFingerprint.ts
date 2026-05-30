import { SwingSession, SwingFrame } from '@/types';

const hashString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
};

const sha256 = async (message: string): Promise<string> => {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return hashString(message) + hashString(message.split('').reverse().join(''));
};

export const extractFrameFeatures = (frames: SwingFrame[], count: number = 100): string => {
  if (frames.length === 0) return '';
  
  const step = Math.max(1, Math.floor(frames.length / count));
  const features: string[] = [];
  
  for (let i = 0; i < Math.min(count, frames.length); i += step) {
    const frame = frames[i];
    features.push(`${frame.position.x.toFixed(3)},${frame.position.y.toFixed(3)},${frame.position.z.toFixed(3)}`);
  }
  
  return features.join(';');
};

export const computeDataFingerprint = async (session: Omit<SwingSession, 'dataFingerprint'>): Promise<string> => {
  const baseString = [
    session.studentName,
    session.recordedAt.getTime().toString(),
    session.importSource,
    session.frames.length.toString(),
    extractFrameFeatures(session.frames, 50),
  ].join('|');
  
  return await sha256(baseString);
};

export const computeSessionHash = (session: SwingSession): string => {
  const frameData = session.frames
    .slice(0, Math.min(100, session.frames.length))
    .map(f => `${f.position.x.toFixed(2)},${f.velocity.toFixed(1)}`)
    .join('|');
  
  return hashString(session.studentName + session.recordedAt.getTime() + frameData);
};

export const compareSessions = (a: SwingSession, b: SwingSession): {
  similarity: number;
  matchingFields: string[];
  differingFields: string[];
} => {
  const matchingFields: string[] = [];
  const differingFields: string[] = [];
  
  if (a.studentName === b.studentName) matchingFields.push('studentName');
  else differingFields.push('studentName');
  
  const timeDiff = Math.abs(a.recordedAt.getTime() - b.recordedAt.getTime());
  if (timeDiff < 1000) matchingFields.push('recordedAt');
  else differingFields.push('recordedAt');
  
  if (a.frames.length === b.frames.length) matchingFields.push('frameCount');
  else differingFields.push('frameCount');
  
  const positionThreshold = 0.01;
  let positionMatchCount = 0;
  const compareCount = Math.min(50, a.frames.length, b.frames.length);
  
  for (let i = 0; i < compareCount; i++) {
    const dx = Math.abs(a.frames[i].position.x - b.frames[i].position.x);
    const dy = Math.abs(a.frames[i].position.y - b.frames[i].position.y);
    const dz = Math.abs(a.frames[i].position.z - b.frames[i].position.z);
    if (dx < positionThreshold && dy < positionThreshold && dz < positionThreshold) {
      positionMatchCount++;
    }
  }
  
  const positionSimilarity = positionMatchCount / compareCount;
  
  if (positionSimilarity > 0.95) matchingFields.push('trajectory');
  else if (positionSimilarity < 0.5) differingFields.push('trajectory');
  
  const similarity = (matchingFields.length / (matchingFields.length + differingFields.length)) * positionSimilarity;
  
  return { similarity, matchingFields, differingFields };
};

export const isDuplicate = (a: SwingSession, b: SwingSession, threshold: number = 0.9): boolean => {
  if (a.dataFingerprint && b.dataFingerprint && a.dataFingerprint === b.dataFingerprint) {
    return true;
  }
  
  const { similarity } = compareSessions(a, b);
  return similarity >= threshold;
};

export const isUpdate = (a: SwingSession, b: SwingSession): boolean => {
  const { similarity, matchingFields, differingFields } = compareSessions(a, b);
  return similarity >= 0.7 && similarity < 0.9 && 
         matchingFields.includes('studentName') && 
         matchingFields.includes('recordedAt');
};

export const isConflict = (a: SwingSession, b: SwingSession): boolean => {
  const { similarity, differingFields } = compareSessions(a, b);
  
  if (similarity < 0.5) return false;
  
  const criticalFields = ['impactPoint', 'trajectory'];
  return differingFields.some(f => criticalFields.includes(f));
};

export const getConflictingFields = (existing: SwingSession, incoming: SwingSession): Array<{
  field: string;
  existingValue: any;
  newValue: any;
}> => {
  const conflicts: Array<{ field: string; existingValue: any; newValue: any }> = [];
  
  if (existing.impactPoint && incoming.impactPoint) {
    const posDiff = Math.abs(existing.impactPoint.position.x - incoming.impactPoint.position.x) +
                    Math.abs(existing.impactPoint.position.y - incoming.impactPoint.position.y) +
                    Math.abs(existing.impactPoint.position.z - incoming.impactPoint.position.z);
    
    if (posDiff > 0.05) {
      conflicts.push({
        field: 'impactPoint.position',
        existingValue: existing.impactPoint.position,
        newValue: incoming.impactPoint.position,
      });
    }
    
    if (Math.abs(existing.impactPoint.faceAngle - incoming.impactPoint.faceAngle) > 5) {
      conflicts.push({
        field: 'impactPoint.faceAngle',
        existingValue: existing.impactPoint.faceAngle,
        newValue: incoming.impactPoint.faceAngle,
      });
    }
    
    if (Math.abs(existing.impactPoint.velocity - incoming.impactPoint.velocity) > 5) {
      conflicts.push({
        field: 'impactPoint.velocity',
        existingValue: existing.impactPoint.velocity,
        newValue: incoming.impactPoint.velocity,
      });
    }
  }
  
  const compareCount = Math.min(20, existing.frames.length, incoming.frames.length);
  for (let i = 0; i < compareCount; i++) {
    const eFrame = existing.frames[i];
    const nFrame = incoming.frames[i];
    const velDiff = Math.abs(eFrame.velocity - nFrame.velocity);
    
    if (velDiff > 10) {
      conflicts.push({
        field: `frames[${i}].velocity`,
        existingValue: eFrame.velocity,
        newValue: nFrame.velocity,
      });
      break;
    }
  }
  
  return conflicts;
};
