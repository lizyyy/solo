import type { AudioMaterial, ExceptionType, MaterialException } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);

const createException = (type: ExceptionType, description: string): MaterialException => ({
  type,
  description,
  detectedAt: new Date().toISOString(),
  resolved: false,
});

export const detectAuthExpired = (material: AudioMaterial): MaterialException | null => {
  if (!material.authorizationDate) return null;

  const authDate = new Date(material.authorizationDate);
  const now = new Date();

  if (authDate < now) {
    const daysExpired = Math.floor((now.getTime() - authDate.getTime()) / (1000 * 60 * 60 * 24));
    return createException(
      'auth_expired',
      `授权已过期${daysExpired}天，需要重新申请`
    );
  }
  return null;
};

export const detectTimecodeMismatch = (material: AudioMaterial): MaterialException | null => {
  if (!material.timecode) return null;

  const timecodePattern = /^\d{2}:\d{2}:\d{2}\s*-\s*\d{2}:\d{2}:\d{2}$/;
  if (!timecodePattern.test(material.timecode.trim())) {
    return createException(
      'timecode_mismatch',
      `时码格式不正确："${material.timecode}"，应为 HH:MM:SS - HH:MM:SS 格式`
    );
  }

  const [startStr, endStr] = material.timecode.split('-').map((s) => s.trim());
  const parseTime = (s: string): number => {
    const [h, m, sec] = s.split(':').map(Number);
    return h * 3600 + m * 60 + sec;
  };

  const start = parseTime(startStr);
  const end = parseTime(endStr);

  if (start >= end) {
    return createException(
      'timecode_mismatch',
      `开始时间大于结束时间：${material.timecode}`
    );
  }

  return null;
};

export const detectDuplicateTracks = (materials: AudioMaterial[]): Map<string, string[]> => {
  const nameMap = new Map<string, string[]>();

  materials.forEach((m) => {
    const normalizedName = m.trackName
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[_\-0-9]/g, '')
      .substring(0, 6);

    if (normalizedName.length < 2) return;

    const existing = nameMap.get(normalizedName) || [];
    nameMap.set(normalizedName, [...existing, m.id]);
  });

  const duplicates = new Map<string, string[]>();
  nameMap.forEach((ids, key) => {
    if (ids.length > 1) {
      duplicates.set(key, ids);
    }
  });

  return duplicates;
};

export const countDuplicateGroups = (materials: AudioMaterial[]): number => {
  const duplicates = detectDuplicateTracks(materials);
  return duplicates.size;
};

export const detectAllExceptions = (materials: AudioMaterial[]): AudioMaterial[] => {
  const duplicates = detectDuplicateTracks(materials);
  const duplicateIds = new Set<string>();
  duplicates.forEach((ids) => {
    ids.forEach((id) => duplicateIds.add(id));
  });

  return materials.map((material) => {
    const newExceptions: MaterialException[] = [];

    const authException = detectAuthExpired(material);
    if (authException) newExceptions.push(authException);

    const timecodeException = detectTimecodeMismatch(material);
    if (timecodeException) newExceptions.push(timecodeException);

    if (duplicateIds.has(material.id)) {
      const duplicateGroup = Array.from(duplicates.values()).find((g) => g.includes(material.id));
      const otherNames = materials
        .filter((m) => duplicateGroup?.includes(m.id) && m.id !== material.id)
        .map((m) => m.trackName)
        .join('、');

      if (otherNames) {
        newExceptions.push(
          createException('duplicate_track', `与"${otherNames}"内容重复`)
        );
      }
    }

    const existingExceptionTypes = new Set(
      material.exceptions.map((e) => `${e.type}_${e.resolved}`)
    );

    const mergedExceptions = [...material.exceptions];
    newExceptions.forEach((newExc) => {
      const key = `${newExc.type}_false`;
      if (!existingExceptionTypes.has(key)) {
        mergedExceptions.push(newExc);
      }
    });

    const hasUnresolvedExceptions = mergedExceptions.some((e) => !e.resolved);
    const status: AudioMaterial['status'] = hasUnresolvedExceptions
      ? 'exception'
      : material.status === 'exception'
      ? 'pending'
      : material.status;

    return {
      ...material,
      id: material.id || generateId(),
      exceptions: mergedExceptions,
      status,
    };
  });
};
