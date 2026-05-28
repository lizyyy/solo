import type { ValidationError, ProcessingLogEntry, Tour, Stop, MerchItem } from '../../types/tour';

function generateId(): string {
  return `val-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') return !isNaN(value);
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    return cleaned !== '' && !isNaN(parseFloat(cleaned));
  }
  return false;
}

function needsCleaning(value: unknown): boolean {
  if (typeof value === 'number') return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return false;
    return trimmed !== String(Number(trimmed));
  }
  return false;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    if (cleaned === '') return null;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString().split('T')[0];
  }
  if (typeof value === 'string') {
    const formats = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{4}\/\d{2}\/\d{2}$/,
      /^\d{2}-\d{2}-\d{4}$/,
      /^\d{2}\/\d{2}\/\d{4}$/,
    ];
    
    for (const format of formats) {
      if (format.test(value)) {
        const normalized = value.replace(/\//g, '-');
        const parts = normalized.split('-');
        let year, month, day;
        
        if (parts[0].length === 4) {
          [year, month, day] = parts;
        } else {
          [day, month, year] = parts;
        }
        
        const date = new Date(`${year}-${month}-${day}`);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }
  }
  return null;
}

function calculateMean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calculateStdDev(values: number[], mean: number): number {
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

export function validateTourData(tour: Partial<Tour>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!tour.name || tour.name.trim() === '') {
    errors.push({
      id: generateId(),
      type: 'required',
      field: 'tour_name',
      message: '巡演名称为必填项',
      severity: 'error',
    });
  }

  if (tour.initialBudget === undefined || tour.initialBudget === null) {
    errors.push({
      id: generateId(),
      type: 'required',
      field: 'initial_budget',
      message: '初始预算为必填项',
      severity: 'error',
    });
  } else if (toNumber(tour.initialBudget) === null || toNumber(tour.initialBudget)! < 0) {
    errors.push({
      id: generateId(),
      type: 'format',
      field: 'initial_budget',
      message: '初始预算必须为非负数',
      severity: 'error',
    });
  }

  if (!tour.startDate) {
    errors.push({
      id: generateId(),
      type: 'required',
      field: 'start_date',
      message: '开始日期为必填项',
      severity: 'error',
    });
  } else if (!parseDate(tour.startDate)) {
    errors.push({
      id: generateId(),
      type: 'format',
      field: 'start_date',
      message: '开始日期格式不正确，请使用 YYYY-MM-DD 格式',
      severity: 'error',
    });
  }

  if (!tour.endDate) {
    errors.push({
      id: generateId(),
      type: 'required',
      field: 'end_date',
      message: '结束日期为必填项',
      severity: 'error',
    });
  } else if (!parseDate(tour.endDate)) {
    errors.push({
      id: generateId(),
      type: 'format',
      field: 'end_date',
      message: '结束日期格式不正确，请使用 YYYY-MM-DD 格式',
      severity: 'error',
    });
  }

  if (tour.startDate && tour.endDate && parseDate(tour.startDate) && parseDate(tour.endDate)) {
    const start = new Date(parseDate(tour.startDate)!);
    const end = new Date(parseDate(tour.endDate)!);
    if (end < start) {
      errors.push({
        id: generateId(),
        type: 'logic',
        field: 'end_date',
        message: '结束日期不能早于开始日期',
        severity: 'error',
      });
    }
  }

  return errors;
}

export function validateStopsData(stops: Partial<Stop>[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const ticketPrices: number[] = [];
  const venueRents: number[] = [];

  stops.forEach((stop, index) => {
    const rowNum = index + 1;

    if (!stop.city || stop.city.trim() === '') {
      errors.push({
        id: generateId(),
        type: 'required',
        field: 'city',
        rowIndex: index,
        message: `第 ${rowNum} 行：城市名称为必填项`,
        severity: 'error',
      });
    }

    if (!stop.venue || stop.venue.trim() === '') {
      errors.push({
        id: generateId(),
        type: 'required',
        field: 'venue',
        rowIndex: index,
        message: `第 ${rowNum} 行：场地名称为必填项`,
        severity: 'error',
      });
    }

    if (!stop.date) {
      errors.push({
        id: generateId(),
        type: 'required',
        field: 'date',
        rowIndex: index,
        message: `第 ${rowNum} 行：演出日期为必填项`,
        severity: 'error',
      });
    } else if (!parseDate(stop.date)) {
      errors.push({
        id: generateId(),
        type: 'format',
        field: 'date',
        rowIndex: index,
        message: `第 ${rowNum} 行：日期格式不正确`,
        severity: 'error',
      });
    }

    if (stop.venueRent === undefined || stop.venueRent === null) {
      errors.push({
        id: generateId(),
        type: 'required',
        field: 'venue_rent',
        rowIndex: index,
        message: `第 ${rowNum} 行：场地租金为必填项`,
        severity: 'error',
      });
    } else if (toNumber(stop.venueRent) === null || toNumber(stop.venueRent)! < 0) {
      errors.push({
        id: generateId(),
        type: 'format',
        field: 'venue_rent',
        rowIndex: index,
        message: `第 ${rowNum} 行：场地租金必须为非负数`,
        severity: 'error',
      });
    } else {
      venueRents.push(toNumber(stop.venueRent)!);
    }

    if (stop.ticketPrice === undefined || stop.ticketPrice === null) {
      errors.push({
        id: generateId(),
        type: 'required',
        field: 'ticket_price',
        rowIndex: index,
        message: `第 ${rowNum} 行：票价为必填项`,
        severity: 'error',
      });
    } else if (toNumber(stop.ticketPrice) === null || toNumber(stop.ticketPrice)! <= 0) {
      errors.push({
        id: generateId(),
        type: 'format',
        field: 'ticket_price',
        rowIndex: index,
        message: `第 ${rowNum} 行：票价必须为正数`,
        severity: 'error',
      });
    } else {
      ticketPrices.push(toNumber(stop.ticketPrice)!);
    }

    if (stop.predictedAttendance === undefined || stop.predictedAttendance === null) {
      errors.push({
        id: generateId(),
        type: 'required',
        field: 'predicted_attendance',
        rowIndex: index,
        message: `第 ${rowNum} 行：预测到场人数为必填项`,
        severity: 'error',
      });
    } else if (toNumber(stop.predictedAttendance) === null || toNumber(stop.predictedAttendance)! <= 0) {
      errors.push({
        id: generateId(),
        type: 'format',
        field: 'predicted_attendance',
        rowIndex: index,
        message: `第 ${rowNum} 行：预测到场人数必须为正数`,
        severity: 'error',
      });
    }

    if (stop.venueSplit !== undefined && stop.venueSplit !== null) {
      const split = toNumber(stop.venueSplit);
      if (split === null || split < 0 || split > 1) {
        errors.push({
          id: generateId(),
          type: 'range',
          field: 'venue_split',
          rowIndex: index,
          message: `第 ${rowNum} 行：场地分成比例必须在 0-1 之间`,
          severity: 'warning',
        });
      }
    }

    if (stop.distanceFromPrev !== undefined && stop.distanceFromPrev !== null) {
      const dist = toNumber(stop.distanceFromPrev);
      if (dist === null || dist < 0) {
        errors.push({
          id: generateId(),
          type: 'format',
          field: 'distance_from_prev',
          rowIndex: index,
          message: `第 ${rowNum} 行：距离必须为非负数`,
          severity: 'warning',
        });
      }
    }
  });

  if (ticketPrices.length > 0) {
    const mean = calculateMean(ticketPrices);
    const stdDev = calculateStdDev(ticketPrices, mean);
    stops.forEach((stop, index) => {
      const price = toNumber(stop.ticketPrice);
      if (price !== null && Math.abs(price - mean) > 3 * stdDev) {
        errors.push({
          id: generateId(),
          type: 'range',
          field: 'ticket_price',
          rowIndex: index,
          message: `第 ${index + 1} 行：票价偏离正常值较大，可能存在异常`,
          severity: 'warning',
        });
      }
    });
  }

  if (venueRents.length > 0) {
    const mean = calculateMean(venueRents);
    const stdDev = calculateStdDev(venueRents, mean);
    stops.forEach((stop, index) => {
      const rent = toNumber(stop.venueRent);
      if (rent !== null && Math.abs(rent - mean) > 3 * stdDev) {
        errors.push({
          id: generateId(),
          type: 'range',
          field: 'venue_rent',
          rowIndex: index,
          message: `第 ${index + 1} 行：场租偏离正常值较大，可能存在异常`,
          severity: 'warning',
        });
      }
    });
  }

  return errors;
}

export function validateMerchData(merch: Partial<MerchItem>[]): ValidationError[] {
  const errors: ValidationError[] = [];

  merch.forEach((item, index) => {
    const rowNum = index + 1;

    if (!item.name || item.name.trim() === '') {
      errors.push({
        id: generateId(),
        type: 'required',
        field: 'name',
        rowIndex: index,
        message: `第 ${rowNum} 行：商品名称为必填项`,
        severity: 'error',
      });
    }

    if (item.costPrice === undefined || item.costPrice === null) {
      errors.push({
        id: generateId(),
        type: 'required',
        field: 'cost_price',
        rowIndex: index,
        message: `第 ${rowNum} 行：成本价为必填项`,
        severity: 'error',
      });
    } else if (toNumber(item.costPrice) === null || toNumber(item.costPrice)! < 0) {
      errors.push({
        id: generateId(),
        type: 'format',
        field: 'cost_price',
        rowIndex: index,
        message: `第 ${rowNum} 行：成本价必须为非负数`,
        severity: 'error',
      });
    }

    if (item.sellingPrice === undefined || item.sellingPrice === null) {
      errors.push({
        id: generateId(),
        type: 'required',
        field: 'selling_price',
        rowIndex: index,
        message: `第 ${rowNum} 行：售价为必填项`,
        severity: 'error',
      });
    } else if (toNumber(item.sellingPrice) === null || toNumber(item.sellingPrice)! <= 0) {
      errors.push({
        id: generateId(),
        type: 'format',
        field: 'selling_price',
        rowIndex: index,
        message: `第 ${rowNum} 行：售价必须为正数`,
        severity: 'error',
      });
    }

    if (item.initialStock === undefined || item.initialStock === null) {
      errors.push({
        id: generateId(),
        type: 'required',
        field: 'initial_stock',
        rowIndex: index,
        message: `第 ${rowNum} 行：初始库存为必填项`,
        severity: 'error',
      });
    } else if (toNumber(item.initialStock) === null || toNumber(item.initialStock)! < 0) {
      errors.push({
        id: generateId(),
        type: 'format',
        field: 'initial_stock',
        rowIndex: index,
        message: `第 ${rowNum} 行：初始库存必须为非负数`,
        severity: 'error',
      });
    }

    const cost = toNumber(item.costPrice);
    const selling = toNumber(item.sellingPrice);
    if (cost !== null && selling !== null && cost >= selling) {
      errors.push({
        id: generateId(),
        type: 'logic',
        field: 'selling_price',
        rowIndex: index,
        message: `第 ${rowNum} 行：售价低于或等于成本价，可能导致亏损`,
        severity: 'warning',
      });
    }
  });

  return errors;
}

export function cleanTourData(
  tour: Partial<Tour>,
  rawTour: Record<string, unknown>
): { cleaned: Partial<Tour>; logs: ProcessingLogEntry[] } {
  const logs: ProcessingLogEntry[] = [];
  const cleaned: Partial<Tour> = { ...tour };

  if (tour.initialBudget !== undefined && tour.initialBudget !== null) {
    const num = toNumber(tour.initialBudget);
    if (num !== null && needsCleaning(tour.initialBudget)) {
      logs.push({
        id: generateId(),
        priority: 2,
        type: 'format_error',
        severity: 'warning',
        field: 'initial_budget',
        originalValue: String(tour.initialBudget),
        cleanedValue: String(num),
        message: `初始预算从 "${tour.initialBudget}" 清理为 ${num}`,
        requiresUserAction: false,
        resolved: true,
      });
      cleaned.initialBudget = num;
    } else if (num !== null) {
      cleaned.initialBudget = num;
    }
  }

  if (tour.startDate) {
    const parsed = parseDate(tour.startDate);
    if (parsed && parsed !== tour.startDate) {
      logs.push({
        id: generateId(),
        priority: 2,
        type: 'format_error',
        severity: 'warning',
        field: 'start_date',
        originalValue: String(tour.startDate),
        cleanedValue: parsed,
        message: `开始日期格式从 "${tour.startDate}" 标准化为 ${parsed}`,
        requiresUserAction: false,
        resolved: true,
      });
      cleaned.startDate = parsed;
    }
  }

  if (tour.endDate) {
    const parsed = parseDate(tour.endDate);
    if (parsed && parsed !== tour.endDate) {
      logs.push({
        id: generateId(),
        priority: 2,
        type: 'format_error',
        severity: 'warning',
        field: 'end_date',
        originalValue: String(tour.endDate),
        cleanedValue: parsed,
        message: `结束日期格式从 "${tour.endDate}" 标准化为 ${parsed}`,
        requiresUserAction: false,
        resolved: true,
      });
      cleaned.endDate = parsed;
    }
  }

  if (!cleaned.notes && rawTour.notes !== undefined) {
    cleaned.notes = String(rawTour.notes);
  }

  return { cleaned, logs };
}

export function cleanStopsData(
  stops: Partial<Stop>[],
  rawStops: Record<string, unknown>[]
): { cleaned: Partial<Stop>[]; logs: ProcessingLogEntry[] } {
  const logs: ProcessingLogEntry[] = [];
  const cleaned: Partial<Stop>[] = [];

  stops.forEach((stop, index) => {
    const cleanStop: Partial<Stop> = { ...stop };
    const raw = rawStops[index] || {};

    if (stop.distanceFromPrev === undefined || stop.distanceFromPrev === null) {
      const defaultDist = 300;
      logs.push({
        id: generateId(),
        priority: 1,
        type: 'missing_value',
        severity: 'info',
        field: 'distance_from_prev',
        rowIndex: index,
        originalValue: '',
        cleanedValue: String(defaultDist),
        message: `第 ${index + 1} 行：距离未填写，使用默认值 ${defaultDist}km`,
        requiresUserAction: false,
        resolved: true,
      });
      cleanStop.distanceFromPrev = defaultDist;
    } else {
      const num = toNumber(stop.distanceFromPrev);
      if (num !== null && needsCleaning(stop.distanceFromPrev)) {
        logs.push({
          id: generateId(),
          priority: 2,
          type: 'format_error',
          severity: 'warning',
          field: 'distance_from_prev',
          rowIndex: index,
          originalValue: String(stop.distanceFromPrev),
          cleanedValue: String(num),
          message: `第 ${index + 1} 行：距离从 "${stop.distanceFromPrev}" 清理为 ${num}`,
          requiresUserAction: false,
          resolved: true,
        });
        cleanStop.distanceFromPrev = num;
      } else if (num !== null) {
        cleanStop.distanceFromPrev = num;
      }
    }

    if (stop.venueSplit === undefined || stop.venueSplit === null) {
      const defaultSplit = 0;
      logs.push({
        id: generateId(),
        priority: 1,
        type: 'missing_value',
        severity: 'info',
        field: 'venue_split',
        rowIndex: index,
        originalValue: '',
        cleanedValue: String(defaultSplit),
        message: `第 ${index + 1} 行：场地分成未填写，使用默认值 ${defaultSplit}`,
        requiresUserAction: false,
        resolved: true,
      });
      cleanStop.venueSplit = defaultSplit;
    } else {
      const num = toNumber(stop.venueSplit);
      if (num !== null && needsCleaning(stop.venueSplit)) {
        logs.push({
          id: generateId(),
          priority: 2,
          type: 'format_error',
          severity: 'warning',
          field: 'venue_split',
          rowIndex: index,
          originalValue: String(stop.venueSplit),
          cleanedValue: String(num),
          message: `第 ${index + 1} 行：场地分成从 "${stop.venueSplit}" 清理为 ${num}`,
          requiresUserAction: false,
          resolved: true,
        });
        cleanStop.venueSplit = num;
      }
    }

    if (stop.transportType === undefined || stop.transportType === null || stop.transportType === '') {
      const defaultTransport = '巴士';
      logs.push({
        id: generateId(),
        priority: 1,
        type: 'missing_value',
        severity: 'info',
        field: 'transport_type',
        rowIndex: index,
        originalValue: '',
        cleanedValue: defaultTransport,
        message: `第 ${index + 1} 行：交通方式未填写，使用默认值 "${defaultTransport}"`,
        requiresUserAction: false,
        resolved: true,
      });
      cleanStop.transportType = defaultTransport;
    }

    if (stop.transportCost === undefined || stop.transportCost === null) {
      const dist = cleanStop.distanceFromPrev || 300;
      const defaultCost = Math.round(dist * 2.5);
      logs.push({
        id: generateId(),
        priority: 1,
        type: 'missing_value',
        severity: 'info',
        field: 'transport_cost',
        rowIndex: index,
        originalValue: '',
        cleanedValue: String(defaultCost),
        message: `第 ${index + 1} 行：交通费用未填写，按距离估算为 ${defaultCost}元`,
        requiresUserAction: false,
        resolved: true,
      });
      cleanStop.transportCost = defaultCost;
    } else {
      const num = toNumber(stop.transportCost);
      if (num !== null && needsCleaning(stop.transportCost)) {
        logs.push({
          id: generateId(),
          priority: 2,
          type: 'format_error',
          severity: 'warning',
          field: 'transport_cost',
          rowIndex: index,
          originalValue: String(stop.transportCost),
          cleanedValue: String(num),
          message: `第 ${index + 1} 行：交通费用从 "${stop.transportCost}" 清理为 ${num}`,
          requiresUserAction: false,
          resolved: true,
        });
        cleanStop.transportCost = num;
      }
    }

    if (stop.date) {
      const parsed = parseDate(stop.date);
      if (parsed && parsed !== stop.date) {
        logs.push({
          id: generateId(),
          priority: 2,
          type: 'format_error',
          severity: 'warning',
          field: 'date',
          rowIndex: index,
          originalValue: String(stop.date),
          cleanedValue: parsed,
          message: `第 ${index + 1} 行：日期从 "${stop.date}" 标准化为 ${parsed}`,
          requiresUserAction: false,
          resolved: true,
        });
        cleanStop.date = parsed;
      }
    }

    const numericFields: (keyof Stop)[] = ['venueRent', 'ticketPrice', 'predictedAttendance'];
    numericFields.forEach((field) => {
      if (stop[field] !== undefined && stop[field] !== null) {
        const num = toNumber(stop[field]);
        if (num !== null && needsCleaning(stop[field])) {
          logs.push({
            id: generateId(),
            priority: 2,
            type: 'format_error',
            severity: 'warning',
            field,
            rowIndex: index,
            originalValue: String(stop[field]),
            cleanedValue: String(num),
            message: `第 ${index + 1} 行：${field} 从 "${stop[field]}" 清理为 ${num}`,
            requiresUserAction: false,
            resolved: true,
          });
          (cleanStop as Record<string, unknown>)[field] = num;
        }
      }
    });

    if (!cleanStop.notes && raw.notes !== undefined) {
      cleanStop.notes = String(raw.notes);
    }

    cleaned.push(cleanStop);
  });

  const distances = cleaned.map((s) => s.distanceFromPrev || 0);
  if (distances.length > 1) {
    const totalDistance = distances.slice(1).reduce((a, b) => a + b, 0);
    const directCities = cleaned.length;
    const optimalDistance = (directCities - 1) * 250;
    if (totalDistance > optimalDistance * 1.2) {
      logs.push({
        id: generateId(),
        priority: 4,
        type: 'outlier',
        severity: 'warning',
        field: 'route',
        originalValue: String(totalDistance),
        cleanedValue: String(optimalDistance),
        message: `巡演路线总距离 ${totalDistance}km 超出最优路线 ${optimalDistance}km 的20%，可能存在路线绕远风险`,
        requiresUserAction: true,
        resolved: false,
      });
    }
  }

  return { cleaned, logs };
}

export function cleanMerchData(
  merch: Partial<MerchItem>[],
  rawMerch: Record<string, unknown>[]
): { cleaned: Partial<MerchItem>[]; logs: ProcessingLogEntry[] } {
  const logs: ProcessingLogEntry[] = [];
  const cleaned: Partial<MerchItem>[] = [];

  merch.forEach((item, index) => {
    const cleanItem: Partial<MerchItem> = { ...item };
    const raw = rawMerch[index] || {};

    const numericFields: (keyof MerchItem)[] = ['costPrice', 'sellingPrice', 'initialStock'];
    numericFields.forEach((field) => {
      if (item[field] !== undefined && item[field] !== null) {
        const num = toNumber(item[field]);
        if (num !== null && needsCleaning(item[field])) {
          logs.push({
            id: generateId(),
            priority: 2,
            type: 'format_error',
            severity: 'warning',
            field,
            rowIndex: index,
            originalValue: String(item[field]),
            cleanedValue: String(num),
            message: `第 ${index + 1} 行：${field} 从 "${item[field]}" 清理为 ${num}`,
            requiresUserAction: false,
            resolved: true,
          });
          (cleanItem as Record<string, unknown>)[field] = num;
        }
      }
    });

    if (item.sku === undefined || item.sku === null || item.sku === '') {
      const defaultSku = `MERCH-${String(index + 1).padStart(3, '0')}`;
      logs.push({
        id: generateId(),
        priority: 1,
        type: 'missing_value',
        severity: 'info',
        field: 'sku',
        rowIndex: index,
        originalValue: '',
        cleanedValue: defaultSku,
        message: `第 ${index + 1} 行：SKU未填写，自动生成 "${defaultSku}"`,
        requiresUserAction: false,
        resolved: true,
      });
      cleanItem.sku = defaultSku;
    }

    if (!cleanItem.notes && raw.notes !== undefined) {
      cleanItem.notes = String(raw.notes);
    }

    if (cleanItem.currentStock === undefined || cleanItem.currentStock === null) {
      cleanItem.currentStock = cleanItem.initialStock || 0;
    }

    cleaned.push(cleanItem);
  });

  return { cleaned, logs };
}
