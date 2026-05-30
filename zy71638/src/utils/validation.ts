import { Microphone, DrumPiece, ValidationError, Session } from '@/types';
import { DISTANCE_UNIT_NAMES, POLAR_PATTERN_NAMES, DRUM_PIECE_NAMES } from './constants';
import { getDistance } from './acousticMath';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function validateMicrophone(
  mic: Microphone,
  drumPiece: DrumPiece | undefined,
  generateIdFn: () => string
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!mic.name || mic.name.trim() === '') {
    errors.push({
      id: generateIdFn(),
      severity: 'error',
      category: 'format',
      field: 'name',
      message: '麦克风名称不能为空',
      suggestion: '请输入麦克风名称，例如「军鼓上麦」、「底鼓内麦」',
      sourceId: mic.id,
    });
  }
  
  if (mic.name && /^\s|\s$/.test(mic.name)) {
    errors.push({
      id: generateIdFn(),
      severity: 'warning',
      category: 'format',
      field: 'name',
      message: `麦克风名称「${mic.name}」前后包含多余空格`,
      suggestion: '建议去除名称前后的空格，保持格式整洁',
      sourceId: mic.id,
    });
  }
  
  if (!drumPiece) {
    errors.push({
      id: generateIdFn(),
      severity: 'error',
      category: 'format',
      field: 'drumPieceId',
      message: `麦克风「${mic.name || '未命名'}」未关联到任何鼓件`,
      suggestion: '请在左侧面板选择该麦克风对应的鼓件',
      sourceId: mic.id,
    });
    return errors;
  }
  
  const validUnits = ['cm', 'm', 'inch'];
  if (!validUnits.includes(mic.distanceUnit)) {
    errors.push({
      id: generateIdFn(),
      severity: 'error',
      category: 'unit',
      field: 'distanceUnit',
      message: `麦克风「${mic.name}」的距离单位「${mic.distanceUnit}」不支持`,
      suggestion: `请选择以下单位之一：${Object.values(DISTANCE_UNIT_NAMES).join('、')}`,
      sourceId: mic.id,
    });
  }
  
  const validPatterns = ['cardioid', 'omnidirectional', 'bidirectional', 'figure8'];
  if (!validPatterns.includes(mic.polarPattern)) {
    errors.push({
      id: generateIdFn(),
      severity: 'error',
      category: 'format',
      field: 'polarPattern',
      message: `麦克风「${mic.name}」的极性模式「${mic.polarPattern}」不支持`,
      suggestion: `请选择以下模式之一：${Object.values(POLAR_PATTERN_NAMES).join('、')}`,
      sourceId: mic.id,
    });
  }
  
  if (typeof mic.position.x !== 'number' || isNaN(mic.position.x)) {
    errors.push({
      id: generateIdFn(),
      severity: 'error',
      category: 'format',
      field: 'position.x',
      message: `麦克风「${mic.name}」的X坐标值无效`,
      suggestion: '请输入有效的数字作为X坐标',
      sourceId: mic.id,
    });
  }
  
  if (typeof mic.position.y !== 'number' || isNaN(mic.position.y)) {
    errors.push({
      id: generateIdFn(),
      severity: 'error',
      category: 'format',
      field: 'position.y',
      message: `麦克风「${mic.name}」的Y坐标值无效`,
      suggestion: '请输入有效的数字作为Y坐标',
      sourceId: mic.id,
    });
  }
  
  if (typeof mic.position.z !== 'number' || isNaN(mic.position.z)) {
    errors.push({
      id: generateIdFn(),
      severity: 'error',
      category: 'format',
      field: 'position.z',
      message: `麦克风「${mic.name}」的Z坐标值无效`,
      suggestion: '请输入有效的数字作为Z坐标',
      sourceId: mic.id,
    });
  }
  
  const distance = getDistance(mic.position, drumPiece.position);
  if (distance < 0.05) {
    errors.push({
      id: generateIdFn(),
      severity: 'warning',
      category: 'distance',
      field: 'position',
      message: `麦克风「${mic.name}」距离「${drumPiece.name}」过近（${(distance * 100).toFixed(1)}cm）`,
      suggestion: '建议保持至少5cm距离，避免鼓皮振动损坏麦克风',
      sourceId: mic.id,
    });
  }
  
  if (distance > 3) {
    errors.push({
      id: generateIdFn(),
      severity: 'info',
      category: 'distance',
      field: 'position',
      message: `麦克风「${mic.name}」距离「${drumPiece.name}」较远（${(distance * 100).toFixed(0)}cm）`,
      suggestion: '远距离拾音会增加串音和房间声，确认这是您想要的效果',
      sourceId: mic.id,
    });
  }
  
  if (mic.gain < -30 || mic.gain > 30) {
    errors.push({
      id: generateIdFn(),
      severity: 'warning',
      category: 'format',
      field: 'gain',
      message: `麦克风「${mic.name}」的增益值（${mic.gain}dB）超出常规范围`,
      suggestion: '建议增益设置在-30dB到+30dB之间',
      sourceId: mic.id,
    });
  }
  
  return errors;
}

export function validateDrumPiece(
  piece: DrumPiece,
  generateIdFn: () => string
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!piece.name || piece.name.trim() === '') {
    errors.push({
      id: generateIdFn(),
      severity: 'error',
      category: 'format',
      field: 'name',
      message: '鼓件名称不能为空',
      suggestion: `建议使用默认名称：${DRUM_PIECE_NAMES[piece.type]}`,
      sourceId: piece.id,
    });
  }
  
  if (typeof piece.position.x !== 'number' || isNaN(piece.position.x) ||
      typeof piece.position.y !== 'number' || isNaN(piece.position.y) ||
      typeof piece.position.z !== 'number' || isNaN(piece.position.z)) {
    errors.push({
      id: generateIdFn(),
      severity: 'error',
      category: 'format',
      field: 'position',
      message: `鼓件「${piece.name}」的位置坐标无效`,
      suggestion: '请检查位置坐标是否为有效数字',
      sourceId: piece.id,
    });
  }
  
  return errors;
}

export function validateSession(session: Session): ValidationError[] {
  const allErrors: ValidationError[] = [];
  
  session.drumPieces.forEach(piece => {
    allErrors.push(...validateDrumPiece(piece, generateId));
  });
  
  session.microphones.forEach(mic => {
    const drumPiece = session.drumPieces.find(p => p.id === mic.drumPieceId);
    allErrors.push(...validateMicrophone(mic, drumPiece, generateId));
  });
  
  return allErrors;
}

export function checkPhaseInversionPair(
  mic1: Microphone,
  mic2: Microphone,
  generateIdFn: () => string
): ValidationError | null {
  if (mic1.drumPieceId !== mic2.drumPieceId) return null;
  
  if (mic1.phaseInverted && !mic2.phaseInverted) {
    return {
      id: generateIdFn(),
      severity: 'warning',
      category: 'phase',
      field: 'phaseInverted',
      message: `同鼓件拾音：「${mic1.name}」相位已反向，但「${mic2.name}」未反向`,
      suggestion: '上下鼓皮拾音时通常需要反向其中一个麦克风，请确认相位设置',
      sourceId: mic1.id,
    };
  }
  
  return null;
}

export function validateOverheadStereoPair(
  mic1: Microphone,
  mic2: Microphone,
  generateIdFn: () => string
): ValidationError | null {
  const isOverhead1 = /overhead|OH|顶置/i.test(mic1.name);
  const isOverhead2 = /overhead|OH|顶置/i.test(mic2.name);
  
  if (!isOverhead1 || !isOverhead2) return null;
  
  const heightDiff = Math.abs(mic1.position.y - mic2.position.y);
  const centerX = (mic1.position.x + mic2.position.x) / 2;
  
  if (heightDiff > 0.1) {
    return {
      id: generateIdFn(),
      severity: 'warning',
      category: 'phase',
      field: 'position.y',
      message: `立体声顶置麦高度差过大（${(heightDiff * 100).toFixed(1)}cm）`,
      suggestion: '为保持立体声像平衡，建议左右顶置麦高度差不超过10cm',
      sourceId: mic1.id,
    };
  }
  
  if (Math.abs(centerX) > 0.2) {
    return {
      id: generateIdFn(),
      severity: 'info',
      category: 'phase',
      field: 'position.x',
      message: `立体声顶置麦中心偏离鼓组中心（${(centerX * 100).toFixed(1)}cm）`,
      suggestion: '建议将立体声对的中心点与军鼓中心对齐',
      sourceId: mic1.id,
    };
  }
  
  return null;
}
