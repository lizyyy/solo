import { Container, Reservation, Vehicle, Level } from '../types';
import { SIMILAR_CHARACTERS } from '../data/constants';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function generateContainerNo(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  for (let i = 0; i < 6; i++) {
    result += Math.floor(Math.random() * 10);
  }
  result += Math.floor(Math.random() * 10);
  return result;
}

export function generateLicensePlate(): string {
  const provinces = '京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼';
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const province = provinces.charAt(Math.floor(Math.random() * provinces.length));
  const city = letters.charAt(Math.floor(Math.random() * letters.length));
  let number = '';
  for (let i = 0; i < 5; i++) {
    if (Math.random() > 0.7) {
      number += letters.charAt(Math.floor(Math.random() * letters.length));
    } else {
      number += Math.floor(Math.random() * 10);
    }
  }
  return `${province}${city}${number}`;
}

export function generateSimilarCharacter(char: string): string {
  const similar = SIMILAR_CHARACTERS[char];
  if (similar && similar.length > 0) {
    return similar[Math.floor(Math.random() * similar.length)];
  }
  return char;
}

export function modifyContainerNo(original: string): string {
  const chars = original.split('');
  const modifyIndex = Math.floor(Math.random() * chars.length);
  const originalChar = chars[modifyIndex];
  
  if (Math.random() > 0.5 && SIMILAR_CHARACTERS[originalChar]) {
    chars[modifyIndex] = generateSimilarCharacter(originalChar);
  } else {
    if (modifyIndex < 4) {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      chars[modifyIndex] = letters.charAt(Math.floor(Math.random() * letters.length));
    } else {
      chars[modifyIndex] = String(Math.floor(Math.random() * 10));
    }
  }
  
  return chars.join('');
}

export function modifyLicensePlate(original: string): string {
  const chars = original.split('');
  const modifyIndex = 2 + Math.floor(Math.random() * (chars.length - 2));
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  
  if (Math.random() > 0.5) {
    chars[modifyIndex] = letters.charAt(Math.floor(Math.random() * letters.length));
  } else {
    chars[modifyIndex] = String(Math.floor(Math.random() * 10));
  }
  
  return chars.join('');
}

export function generateVehicle(level: Level, index: number): Vehicle {
  const containerNo = generateContainerNo();
  const licensePlate = generateLicensePlate();
  const hasDangerous = Math.random() < level.dangerousRate;
  const dangerousLevel = hasDangerous ? Math.floor(Math.random() * 3) + 1 : undefined;
  
  const shouldMismatch = Math.random() < level.mismatchRate;
  const mismatchType = Math.random();
  
  let reservationContainerNo = containerNo;
  let reservationLicensePlate = licensePlate;
  let isValid = true;
  let allowDangerous = !hasDangerous;
  
  let shouldIntercept = false;
  let interceptionReason = '';
  
  if (shouldMismatch) {
    if (mismatchType < 0.4) {
      reservationContainerNo = modifyContainerNo(containerNo);
      shouldIntercept = true;
      interceptionReason = '箱号不匹配';
    } else if (mismatchType < 0.7) {
      reservationLicensePlate = modifyLicensePlate(licensePlate);
      shouldIntercept = true;
      interceptionReason = '车牌不匹配';
    } else {
      isValid = false;
      shouldIntercept = true;
      interceptionReason = '预约无效';
    }
  }
  
  if (hasDangerous && !allowDangerous) {
    shouldIntercept = true;
    interceptionReason = '危品未申报';
  }
  
  const container: Container = {
    id: generateId(),
    containerNo,
    licensePlate,
    hasDangerous,
    dangerousLevel,
  };
  
  const reservation: Reservation = {
    id: generateId(),
    containerNo: reservationContainerNo,
    licensePlate: reservationLicensePlate,
    isValid,
    expireTime: Date.now() + 3600000,
    allowDangerous,
  };
  
  return {
    id: generateId(),
    container,
    reservation,
    arriveTime: Date.now(),
    shouldIntercept,
    interceptionReason: shouldIntercept ? interceptionReason : undefined,
  };
}

export function generateVehiclesForLevel(level: Level): Vehicle[] {
  const vehicles: Vehicle[] = [];
  for (let i = 0; i < level.vehicleCount; i++) {
    vehicles.push(generateVehicle(level, i));
  }
  return vehicles;
}
