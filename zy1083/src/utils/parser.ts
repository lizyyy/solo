import { House, VisitNote, ImportResult, ValidationError, HouseJson, VisitNoteCsvRow } from '../types';

export const parseHouseJson = (jsonContent: string): ImportResult<House> => {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const houses: House[] = [];

  try {
    const data = JSON.parse(jsonContent);
    const houseArray = Array.isArray(data) ? data : [data];

    houseArray.forEach((item: HouseJson, index: number) => {
      const rowErrors = validateHouseJson(item, index + 2);
      errors.push(...rowErrors.errors);
      warnings.push(...rowErrors.warnings);

      if (rowErrors.errors.length === 0) {
        houses.push(convertHouseJson(item));
      }
    });
  } catch (error) {
    errors.push({
      row: 1,
      column: '全部',
      field: 'json',
      message: 'JSON 解析失败，请检查格式是否正确',
      value: jsonContent.substring(0, 100),
    });
  }

  return {
    success: errors.length === 0,
    data: houses,
    errors,
    warnings,
  };
};

const validateHouseJson = (
  item: HouseJson,
  row: number
): { errors: ValidationError[]; warnings: ValidationError[] } => {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const requiredFields = ['id', 'name', 'address', 'monthlyRent', 'deposit', 'area', 'commuteTime'];

  requiredFields.forEach((field) => {
    if (!(field in item) || item[field as keyof HouseJson] === undefined || item[field as keyof HouseJson] === null) {
      errors.push({
        row,
        column: field,
        field,
        message: `必填字段缺失: ${field}`,
        value: '',
      });
    }
  });

  if ('monthlyRent' in item && item.monthlyRent !== undefined) {
    if (typeof item.monthlyRent !== 'number' || item.monthlyRent < 0) {
      errors.push({
        row,
        column: 'monthlyRent',
        field: 'monthlyRent',
        message: '月租金必须是大于等于0的数字',
        value: String(item.monthlyRent),
      });
    }
  }

  if ('deposit' in item && item.deposit !== undefined) {
    if (typeof item.deposit !== 'number' || item.deposit < 0) {
      errors.push({
        row,
        column: 'deposit',
        field: 'deposit',
        message: '押金必须是大于等于0的数字',
        value: String(item.deposit),
      });
    }
  }

  if ('area' in item && item.area !== undefined) {
    if (typeof item.area !== 'number' || item.area <= 0) {
      errors.push({
        row,
        column: 'area',
        field: 'area',
        message: '面积必须是大于0的数字',
        value: String(item.area),
      });
    }
  }

  if ('commuteTime' in item && item.commuteTime !== undefined) {
    if (typeof item.commuteTime !== 'number' || item.commuteTime < 0) {
      errors.push({
        row,
        column: 'commuteTime',
        field: 'commuteTime',
        message: '通勤时间必须是大于等于0的数字（分钟）',
        value: String(item.commuteTime),
      });
    }
  }

  if ('agencyFee' in item && item.agencyFee !== undefined) {
    if (typeof item.agencyFee !== 'number' || item.agencyFee < 0) {
      warnings.push({
        row,
        column: 'agencyFee',
        field: 'agencyFee',
        message: '中介费应该是大于等于0的数字，已默认设为0',
        value: String(item.agencyFee),
      });
    }
  }

  if ('contractTerm' in item && item.contractTerm !== undefined) {
    if (typeof item.contractTerm !== 'number' || item.contractTerm <= 0) {
      warnings.push({
        row,
        column: 'contractTerm',
        field: 'contractTerm',
        message: '合同期限应该是大于0的数字（月），已默认设为12',
        value: String(item.contractTerm),
      });
    }
  }

  return { errors, warnings };
};

const convertHouseJson = (item: HouseJson): House => {
  const validDepositTypes = ['押一付一', '押二付一', '押三付一', '其他'];
  const validCommuteTypes = ['地铁', '公交', '步行', '驾车'];

  return {
    id: item.id || `house_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: item.name || '未命名房源',
    address: item.address || '未填写地址',
    monthlyRent: typeof item.monthlyRent === 'number' ? item.monthlyRent : 0,
    deposit: typeof item.deposit === 'number' ? item.deposit : 0,
    depositType: (validDepositTypes.includes(item.depositType) 
      ? item.depositType 
      : '其他') as House['depositType'],
    area: typeof item.area === 'number' ? item.area : 0,
    floor: item.floor || '未填写',
    orientation: item.orientation || '未填写',
    commuteTime: typeof item.commuteTime === 'number' ? item.commuteTime : 0,
    commuteType: (validCommuteTypes.includes(item.commuteType)
      ? item.commuteType
      : '地铁') as House['commuteType'],
    contractTerm: typeof item.contractTerm === 'number' && item.contractTerm > 0 ? item.contractTerm : 12,
    agencyFee: typeof item.agencyFee === 'number' ? item.agencyFee : 0,
    additionalFees: Array.isArray(item.additionalFees) ? item.additionalFees.map((fee) => ({
      name: fee.name || '其他费用',
      amount: typeof fee.amount === 'number' ? fee.amount : 0,
      period: (['月付', '季付', '年付', '一次性'].includes(fee.period)
        ? fee.period
        : '月付') as '月付' | '季付' | '年付' | '一次性',
    })) : [],
    landlordPromises: Array.isArray(item.landlordPromises) ? item.landlordPromises : [],
    photos: Array.isArray(item.photos) ? item.photos : [],
    visitDate: item.visitDate || new Date().toISOString().split('T')[0],
    contactPerson: item.contactPerson || '',
    contactPhone: item.contactPhone || '',
    notes: item.notes || '',
  };
};

export const parseVisitNotesCsv = (csvContent: string): ImportResult<VisitNote> => {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const visitNotes: VisitNote[] = [];

  try {
    const lines = csvContent.split('\n').filter((line) => line.trim() !== '');
    if (lines.length < 2) {
      errors.push({
        row: 1,
        column: '全部',
        field: 'csv',
        message: 'CSV 文件格式错误，至少需要表头和一行数据',
        value: lines.join('\n'),
      });
      return { success: false, errors, warnings };
    }

    const headers = parseCsvLine(lines[0]);
    const headerMap = new Map<string, number>();
    headers.forEach((header, index) => {
      headerMap.set(header.trim(), index);
    });

    const requiredHeaders = ['id', 'houseId', 'visitDate'];
    requiredHeaders.forEach((header) => {
      if (!headerMap.has(header)) {
        errors.push({
          row: 1,
          column: header,
          field: header,
          message: `表头缺少必填列: ${header}`,
          value: '',
        });
      }
    });

    if (errors.length > 0) {
      return { success: false, errors, warnings };
    }

    for (let i = 1; i < lines.length; i++) {
      const row = i + 1;
      const values = parseCsvLine(lines[i]);
      
      if (values.length === 0 || (values.length === 1 && values[0].trim() === '')) {
        continue;
      }

      const csvRow: Partial<VisitNoteCsvRow> = {};
      headerMap.forEach((index, key) => {
        if (values[index] !== undefined) {
          (csvRow as any)[key] = values[index];
        }
      });

      const rowErrors = validateVisitNoteCsv(csvRow as VisitNoteCsvRow, row);
      errors.push(...rowErrors.errors);
      warnings.push(...rowErrors.warnings);

      if (rowErrors.errors.length === 0) {
        visitNotes.push(convertVisitNoteCsv(csvRow as VisitNoteCsvRow));
      }
    }
  } catch (error) {
    errors.push({
      row: 1,
      column: '全部',
      field: 'csv',
      message: 'CSV 解析失败，请检查格式是否正确',
      value: csvContent.substring(0, 100),
    });
  }

  return {
    success: errors.length === 0,
    data: visitNotes,
    errors,
    warnings,
  };
};

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current.trim());
  return result;
};

const validateVisitNoteCsv = (
  item: VisitNoteCsvRow,
  row: number
): { errors: ValidationError[]; warnings: ValidationError[] } => {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!item.id) {
    errors.push({
      row,
      column: 'id',
      field: 'id',
      message: '必填字段缺失: id',
      value: '',
    });
  }

  if (!item.houseId) {
    errors.push({
      row,
      column: 'houseId',
      field: 'houseId',
      message: '必填字段缺失: houseId（关联房源ID）',
      value: '',
    });
  }

  if (item.lighting) {
    const num = parseInt(item.lighting, 10);
    if (isNaN(num) || num < 1 || num > 5) {
      warnings.push({
        row,
        column: 'lighting',
        field: 'lighting',
        message: '采光评分应为1-5的数字，已默认设为3',
        value: item.lighting,
      });
    }
  }

  if (item.noise) {
    const num = parseInt(item.noise, 10);
    if (isNaN(num) || num < 1 || num > 5) {
      warnings.push({
        row,
        column: 'noise',
        field: 'noise',
        message: '噪音评分应为1-5的数字，已默认设为3',
        value: item.noise,
      });
    }
  }

  if (item.surroundingSafety) {
    const num = parseInt(item.surroundingSafety, 10);
    if (isNaN(num) || num < 1 || num > 5) {
      warnings.push({
        row,
        column: 'surroundingSafety',
        field: 'surroundingSafety',
        message: '周边安全评分应为1-5的数字，已默认设为3',
        value: item.surroundingSafety,
      });
    }
  }

  return { errors, warnings };
};

const convertVisitNoteCsv = (item: VisitNoteCsvRow): VisitNote => {
  const parseScore = (value: string | undefined, defaultValue: number): number => {
    if (!value) return defaultValue;
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 5) return defaultValue;
    return num;
  };

  const parseBoolean = (value: string | undefined): boolean => {
    if (!value) return false;
    const lower = value.toLowerCase().trim();
    return lower === '是' || lower === 'true' || lower === '1' || lower === 'yes';
  };

  const parseRepairItems = (value: string | undefined) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          item: item.item || '未知维修项',
          severity: (['轻微', '中等', '严重'].includes(item.severity) 
            ? item.severity 
            : '中等') as '轻微' | '中等' | '严重',
          needsLandlordRepair: item.needsLandlordRepair ?? true,
        }));
      }
    } catch {
      return value.split(';').map((item) => ({
        item: item.trim(),
        severity: '中等' as const,
        needsLandlordRepair: true,
      }));
    }
    return [];
  };

  const parseApplianceStatus = (value: string | undefined) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          name: item.name || '未知家电',
          status: (['正常', '故障', '缺失'].includes(item.status)
            ? item.status
            : '正常') as '正常' | '故障' | '缺失',
          notes: item.notes || '',
        }));
      }
    } catch {
      return value.split(';').map((item) => ({
        name: item.trim(),
        status: '正常' as const,
        notes: '',
      }));
    }
    return [];
  };

  const parsePendingQuestions = (value: string | undefined) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          question: item.question || '未填写问题',
          status: (['待确认', '已确认', '放弃'].includes(item.status)
            ? item.status
            : '待确认') as '待确认' | '已确认' | '放弃',
          answer: item.answer || '',
        }));
      }
    } catch {
      return value.split(';').map((item) => ({
        question: item.trim(),
        status: '待确认' as const,
        answer: '',
      }));
    }
    return [];
  };

  return {
    id: item.id || `visit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    houseId: item.houseId || '',
    visitDate: item.visitDate || new Date().toISOString().split('T')[0],
    lighting: parseScore(item.lighting, 3) as 1 | 2 | 3 | 4 | 5,
    noise: parseScore(item.noise, 3) as 1 | 2 | 3 | 4 | 5,
    waterLeak: parseBoolean(item.waterLeak),
    waterLeakDescription: item.waterLeakDescription || '',
    odor: parseBoolean(item.odor),
    odorDescription: item.odorDescription || '',
    repairItems: parseRepairItems(item.repairItems),
    applianceStatus: parseApplianceStatus(item.applianceStatus),
    surroundingSafety: parseScore(item.surroundingSafety, 3) as 1 | 2 | 3 | 4 | 5,
    generalNotes: item.generalNotes || '',
    pendingQuestions: parsePendingQuestions(item.pendingQuestions),
    photos: item.photos ? item.photos.split(';').map((p) => p.trim()).filter(Boolean) : [],
  };
};

export const generateCsvTemplate = (): string => {
  const headers = [
    'id', 'houseId', 'visitDate', 'lighting', 'noise',
    'waterLeak', 'waterLeakDescription', 'odor', 'odorDescription',
    'repairItems', 'applianceStatus', 'surroundingSafety',
    'generalNotes', 'pendingQuestions', 'photos'
  ];

  const exampleRow = [
    'visit_001',
    'house_001',
    '2026-04-30',
    '4',
    '3',
    '否',
    '',
    '否',
    '',
    '[{"item":"厨房水龙头漏水","severity":"轻微","needsLandlordRepair":true}]',
    '[{"name":"空调","status":"正常","notes":""}]',
    '4',
    '整体感觉不错，就是厨房有点小',
    '[{"question":"物业费包含哪些？","status":"待确认","answer":""}]',
    ''
  ];

  return [headers.join(','), exampleRow.join(',')].join('\n');
};
