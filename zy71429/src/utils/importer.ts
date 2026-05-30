import { Ship, Berth, Tug, Weather, DataSource, ImportError, ImportResult } from '../types/game';

const generateId = (prefix: string, index: number): string => {
  return `${prefix}-${index.toString().padStart(3, '0')}`;
};

const createDataSource = (
  file: string,
  line: number,
  rawContent: string,
  importTimestamp: Date
): DataSource => ({
  file,
  line,
  rawContent,
  importTimestamp,
});

const parseCSV = (content: string): string[][] => {
  const lines = content.trim().split('\n');
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
};

const validateRequiredFields = (
  row: string[],
  requiredFields: string[],
  file: string,
  lineNumber: number,
  rawContent: string
): ImportError[] => {
  const errors: ImportError[] = [];
  
  requiredFields.forEach((field, index) => {
    if (!row[index] || row[index].trim() === '') {
      errors.push({
        file,
        line: lineNumber,
        rawContent,
        errorType: 'missing_field',
        message: `缺少必填字段: ${field}`,
        suggestion: `请在第 ${index + 1} 列填写 ${field} 的值`,
      });
    }
  });
  
  return errors;
};

const validateNumeric = (
  value: string,
  fieldName: string,
  file: string,
  lineNumber: number,
  rawContent: string,
  min?: number,
  max?: number
): { value: number; error?: ImportError } => {
  const num = parseFloat(value);
  
  if (isNaN(num)) {
    return {
      value: 0,
      error: {
        file,
        line: lineNumber,
        rawContent,
        errorType: 'invalid_value',
        message: `${fieldName} 必须是数字: ${value}`,
        suggestion: `请输入有效的数字`,
      },
    };
  }
  
  if (min !== undefined && num < min) {
    return {
      value: num,
      error: {
        file,
        line: lineNumber,
        rawContent,
        errorType: 'out_of_range',
        message: `${fieldName} 不能小于 ${min}: ${value}`,
        suggestion: `请输入大于等于 ${min} 的值`,
      },
    };
  }
  
  if (max !== undefined && num > max) {
    return {
      value: num,
      error: {
        file,
        line: lineNumber,
        rawContent,
        errorType: 'out_of_range',
        message: `${fieldName} 不能大于 ${max}: ${value}`,
        suggestion: `请输入小于等于 ${max} 的值`,
      },
    };
  }
  
  return { value: num };
};

export const parseShips = (
  content: string,
  fileName: string,
  importTimestamp: Date
): ImportResult<Ship> => {
  const rows = parseCSV(content);
  const data: Ship[] = [];
  const errors: ImportError[] = [];
  
  rows.forEach((row, index) => {
    if (index === 0 && row[0]?.toLowerCase().includes('id')) {
      return;
    }
    
    const lineNumber = index + 1;
    const rawContent = row.join(',');
    
    const requiredErrors = validateRequiredFields(
      row,
      ['id', 'name', 'length', 'draft', 'priority', 'eta', 'tugRequired'],
      fileName,
      lineNumber,
      rawContent
    );
    
    if (requiredErrors.length > 0) {
      errors.push(...requiredErrors);
      return;
    }
    
    const [id, name, lengthStr, draftStr, priority, etaStr, tugRequiredStr] = row;
    
    const validPriorities = ['high', 'medium', 'low'];
    if (!validPriorities.includes(priority)) {
      errors.push({
        file: fileName,
        line: lineNumber,
        rawContent,
        errorType: 'invalid_value',
        message: `优先级必须是 high/medium/low: ${priority}`,
        suggestion: `请从 high, medium, low 中选择一个值`,
      });
      return;
    }
    
    const lengthResult = validateNumeric(lengthStr, '船长', fileName, lineNumber, rawContent, 1);
    const draftResult = validateNumeric(draftStr, '吃水', fileName, lineNumber, rawContent, 0.1);
    const tugRequiredResult = validateNumeric(tugRequiredStr, '所需拖力', fileName, lineNumber, rawContent, 1);
    
    if (lengthResult.error) errors.push(lengthResult.error);
    if (draftResult.error) errors.push(draftResult.error);
    if (tugRequiredResult.error) errors.push(tugRequiredResult.error);
    
    if (lengthResult.error || draftResult.error || tugRequiredResult.error) {
      return;
    }
    
    let eta: Date;
    try {
      eta = new Date(etaStr);
      if (isNaN(eta.getTime())) {
        throw new Error('Invalid date');
      }
    } catch {
      errors.push({
        file: fileName,
        line: lineNumber,
        rawContent,
        errorType: 'format_error',
        message: `ETA 日期格式无效: ${etaStr}`,
        suggestion: `请使用 ISO 格式 (YYYY-MM-DDTHH:mm:ss)`,
      });
      return;
    }
    
    data.push({
      id: id || generateId('ship', index),
      name,
      length: lengthResult.value,
      draft: draftResult.value,
      priority: priority as Ship['priority'],
      eta,
      tugRequired: tugRequiredResult.value,
      status: 'waiting',
      source: createDataSource(fileName, lineNumber, rawContent, importTimestamp),
    });
  });
  
  return {
    data,
    errors,
    successCount: data.length,
    errorCount: errors.length,
  };
};

export const parseBerths = (
  content: string,
  fileName: string,
  importTimestamp: Date
): ImportResult<Berth> => {
  const rows = parseCSV(content);
  const data: Berth[] = [];
  const errors: ImportError[] = [];
  
  rows.forEach((row, index) => {
    if (index === 0 && row[0]?.toLowerCase().includes('id')) {
      return;
    }
    
    const lineNumber = index + 1;
    const rawContent = row.join(',');
    
    const requiredErrors = validateRequiredFields(
      row,
      ['id', 'name', 'maxLength', 'maxDraft', 'status'],
      fileName,
      lineNumber,
      rawContent
    );
    
    if (requiredErrors.length > 0) {
      errors.push(...requiredErrors);
      return;
    }
    
    const [id, name, maxLengthStr, maxDraftStr, status] = row;
    
    const validStatuses = ['available', 'occupied', 'maintenance', 'locked'];
    if (!validStatuses.includes(status)) {
      errors.push({
        file: fileName,
        line: lineNumber,
        rawContent,
        errorType: 'invalid_value',
        message: `状态必须是 available/occupied/maintenance/locked: ${status}`,
        suggestion: `请从有效状态中选择一个值`,
      });
      return;
    }
    
    const maxLengthResult = validateNumeric(maxLengthStr, '最大船长', fileName, lineNumber, rawContent, 1);
    const maxDraftResult = validateNumeric(maxDraftStr, '最大吃水', fileName, lineNumber, rawContent, 0.1);
    
    if (maxLengthResult.error) errors.push(maxLengthResult.error);
    if (maxDraftResult.error) errors.push(maxDraftResult.error);
    
    if (maxLengthResult.error || maxDraftResult.error) {
      return;
    }
    
    data.push({
      id: id || generateId('berth', index),
      name,
      maxLength: maxLengthResult.value,
      maxDraft: maxDraftResult.value,
      status: status as Berth['status'],
      occupiedUntil: null,
      currentShipId: null,
      source: createDataSource(fileName, lineNumber, rawContent, importTimestamp),
    });
  });
  
  return {
    data,
    errors,
    successCount: data.length,
    errorCount: errors.length,
  };
};

export const parseTugs = (
  content: string,
  fileName: string,
  importTimestamp: Date
): ImportResult<Tug> => {
  const rows = parseCSV(content);
  const data: Tug[] = [];
  const errors: ImportError[] = [];
  
  rows.forEach((row, index) => {
    if (index === 0 && row[0]?.toLowerCase().includes('id')) {
      return;
    }
    
    const lineNumber = index + 1;
    const rawContent = row.join(',');
    
    const requiredErrors = validateRequiredFields(
      row,
      ['id', 'name', 'power', 'fuelLevel'],
      fileName,
      lineNumber,
      rawContent
    );
    
    if (requiredErrors.length > 0) {
      errors.push(...requiredErrors);
      return;
    }
    
    const [id, name, powerStr, fuelLevelStr] = row;
    
    const powerResult = validateNumeric(powerStr, '功率', fileName, lineNumber, rawContent, 1);
    const fuelLevelResult = validateNumeric(fuelLevelStr, '燃油量', fileName, lineNumber, rawContent, 0, 100);
    
    if (powerResult.error) errors.push(powerResult.error);
    if (fuelLevelResult.error) errors.push(fuelLevelResult.error);
    
    if (powerResult.error || fuelLevelResult.error) {
      return;
    }
    
    data.push({
      id: id || generateId('tug', index),
      name,
      power: powerResult.value,
      fuelLevel: fuelLevelResult.value,
      maxFuel: 100,
      availableFrom: new Date(),
      currentAssignment: null,
      status: fuelLevelResult.value < 20 ? 'refueling' : 'available',
      source: createDataSource(fileName, lineNumber, rawContent, importTimestamp),
    });
  });
  
  return {
    data,
    errors,
    successCount: data.length,
    errorCount: errors.length,
  };
};

export const parseWeather = (
  content: string,
  fileName: string,
  importTimestamp: Date
): ImportResult<Weather> => {
  const rows = parseCSV(content);
  const data: Weather[] = [];
  const errors: ImportError[] = [];
  
  rows.forEach((row, index) => {
    if (index === 0 && row[0]?.toLowerCase().includes('id')) {
      return;
    }
    
    const lineNumber = index + 1;
    const rawContent = row.join(',');
    
    const requiredErrors = validateRequiredFields(
      row,
      ['id', 'timestamp', 'windLevel', 'waveHeight'],
      fileName,
      lineNumber,
      rawContent
    );
    
    if (requiredErrors.length > 0) {
      errors.push(...requiredErrors);
      return;
    }
    
    const [id, timestampStr, windLevelStr, waveHeightStr] = row;
    
    const windLevelResult = validateNumeric(windLevelStr, '风力等级', fileName, lineNumber, rawContent, 0, 12);
    const waveHeightResult = validateNumeric(waveHeightStr, '浪高', fileName, lineNumber, rawContent, 0, 20);
    
    if (windLevelResult.error) errors.push(windLevelResult.error);
    if (waveHeightResult.error) errors.push(waveHeightResult.error);
    
    if (windLevelResult.error || waveHeightResult.error) {
      return;
    }
    
    let timestamp: Date;
    try {
      timestamp = new Date(timestampStr);
      if (isNaN(timestamp.getTime())) {
        throw new Error('Invalid date');
      }
    } catch {
      errors.push({
        file: fileName,
        line: lineNumber,
        rawContent,
        errorType: 'format_error',
        message: `时间戳格式无效: ${timestampStr}`,
        suggestion: `请使用 ISO 格式 (YYYY-MM-DDTHH:mm:ss)`,
      });
      return;
    }
    
    const windowType = waveHeightResult.value < 2.0 
      ? 'operable' 
      : waveHeightResult.value < 3.5 
        ? 'warning' 
        : 'restricted';
    
    data.push({
      id: id || generateId('weather', index),
      timestamp,
      windLevel: Math.round(windLevelResult.value),
      waveHeight: waveHeightResult.value,
      windowType,
      source: createDataSource(fileName, lineNumber, rawContent, importTimestamp),
    });
  });
  
  return {
    data,
    errors,
    successCount: data.length,
    errorCount: errors.length,
  };
};

export const parseFile = async (
  file: File,
  importTimestamp: Date
): Promise<{ type: 'ships' | 'berths' | 'tugs' | 'weather' | 'unknown'; result: ImportResult<unknown> }> => {
  const content = await file.text();
  const fileName = file.name.toLowerCase();
  
  if (fileName.includes('ship')) {
    return { type: 'ships', result: parseShips(content, file.name, importTimestamp) };
  } else if (fileName.includes('berth')) {
    return { type: 'berths', result: parseBerths(content, file.name, importTimestamp) };
  } else if (fileName.includes('tug')) {
    return { type: 'tugs', result: parseTugs(content, file.name, importTimestamp) };
  } else if (fileName.includes('weather')) {
    return { type: 'weather', result: parseWeather(content, file.name, importTimestamp) };
  }
  
  const firstLine = content.split('\n')[0].toLowerCase();
  if (firstLine.includes('eta') || firstLine.includes('priority')) {
    return { type: 'ships', result: parseShips(content, file.name, importTimestamp) };
  } else if (firstLine.includes('maxlength') || firstLine.includes('max_length')) {
    return { type: 'berths', result: parseBerths(content, file.name, importTimestamp) };
  } else if (firstLine.includes('power') && firstLine.includes('fuel')) {
    return { type: 'tugs', result: parseTugs(content, file.name, importTimestamp) };
  } else if (firstLine.includes('wind') || firstLine.includes('wave')) {
    return { type: 'weather', result: parseWeather(content, file.name, importTimestamp) };
  }
  
  return {
    type: 'unknown',
    result: {
      data: [],
      errors: [{
        file: file.name,
        line: 0,
        rawContent: '',
        errorType: 'format_error',
        message: '无法识别文件类型',
        suggestion: '请确保文件名包含 ships/berths/tugs/weather 关键词，或文件内容包含对应的字段名',
      }],
      successCount: 0,
      errorCount: 1,
    },
  };
};
