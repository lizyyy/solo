import type { EnergyConsumption, ValidationError, ValidationResult, HouseType, WeatherData, ElectricityPrice } from '../types';

export interface ImportRecord {
  rowIndex: number;
  rawData: Record<string, string | number>;
  parsed?: EnergyConsumption;
  validation: ValidationResult;
  status: 'pending' | 'valid' | 'error' | 'rejected' | 'confirmed';
}

const REQUIRED_FIELDS = [
  'houseTypeName', 'month', 'year', 'kWhConsumed', 'targetRoomTemp',
];

export const parseCSV = (csvContent: string): Record<string, string | number>[] => {
  const lines = csvContent.trim().split('\n');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const records: Record<string, string | number>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const record: Record<string, string | number> = {};

    for (let j = 0; j < headers.length; j++) {
      const value = values[j];
      const numValue = parseFloat(value);
      record[headers[j]] = isNaN(numValue) ? value : numValue;
    }

    records.push(record);
  }

  return records;
};

export const parseJSON = (jsonContent: string): Record<string, string | number>[] => {
  try {
    const data = JSON.parse(jsonContent);
    if (Array.isArray(data)) {
      return data.map((item) => {
        const record: Record<string, string | number> = {};
        Object.entries(item).forEach(([key, value]) => {
          record[key] = typeof value === 'string' ? value : Number(value);
        });
        return record;
      });
    }
  } catch {
    return [];
  }
  return [];
};

export const parseConsumptionRecord = (
  raw: Record<string, string | number>,
  houseTypes: HouseType[],
  weatherDataList: WeatherData[],
  priceList: ElectricityPrice[],
  rowIndex: number
): { parsed?: EnergyConsumption; validation: ValidationResult } => {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (raw[field] === undefined || raw[field] === null || raw[field] === '') {
      errors.push({
        type: 'missing',
        field,
        message: `缺少必需字段: ${field}`,
        rowIndex,
      });
    }
  }

  if (errors.length > 0) {
    return { validation: { isValid: false, errors, warnings: [] } };
  }

  const houseName = String(raw.houseTypeName);
  const house = houseTypes.find(
    (h) => h.name.toLowerCase() === houseName.toLowerCase()
  );

  if (!house) {
    errors.push({
      type: 'missing',
      field: 'houseTypeName',
      message: `未找到户型: ${houseName}`,
      value: houseName,
      rowIndex,
    });
    return { validation: { isValid: false, errors, warnings: [] } };
  }

  const month = Number(raw.month);
  const year = Number(raw.year);

  if (month < 1 || month > 12) {
    errors.push({
      type: 'invalid',
      field: 'month',
      message: '月份必须在1-12之间',
      value: month,
      rowIndex,
    });
  }

  const kWh = Number(raw.kWhConsumed);
  if (kWh < 0) {
    errors.push({
      type: 'manual_error',
      field: 'kWhConsumed',
      message: '能耗不能为负数',
      value: kWh,
      rowIndex,
    });
  } else if (kWh > 5000) {
    warnings.push({
      type: 'outlier' as any,
      field: 'kWhConsumed',
      message: '能耗值异常高，建议检查',
      value: kWh,
      rowIndex,
    });
  }

  const targetTemp = Number(raw.targetRoomTemp);
  if (targetTemp < 10 || targetTemp > 30) {
    errors.push({
      type: 'manual_error',
      field: 'targetRoomTemp',
      message: '室温应在10-30℃之间',
      value: targetTemp,
      rowIndex,
    });
  }

  if (errors.length > 0) {
    return { validation: { isValid: false, errors, warnings: warnings as any } };
  }

  const weather = weatherDataList.find(
    (w) => w.houseTypeId === house.id && w.month === month && w.year === year
  );

  const priceName = raw.priceName ? String(raw.priceName) : '默认电价';
  const price = priceList.find(
    (p) => p.name.toLowerCase() === priceName.toLowerCase()
  ) || priceList[0];

  if (!price) {
    errors.push({
      type: 'missing',
      field: 'priceName',
      message: `未找到电价方案: ${priceName}`,
      value: priceName,
      rowIndex,
    });
    return { validation: { isValid: false, errors, warnings: warnings as any } };
  }

  const consumption: EnergyConsumption = {
    id: generateId(),
    houseTypeId: house.id,
    electricityPriceId: price.id,
    weatherDataId: weather?.id || '',
    month,
    year,
    kWhConsumed: kWh,
    targetRoomTemp: targetTemp,
    isConfirmed: false,
    hasError: false,
    dataSource: 'imported',
  };

  return {
    parsed: consumption,
    validation: { isValid: true, errors: [], warnings: warnings as any },
  };
};

export const detectDuplicates = (
  records: ImportRecord[],
  existingConsumptions: EnergyConsumption[]
): ImportRecord[] => {
  return records.map((record, index) => {
    if (!record.parsed) return record;

    const key = `${record.parsed.houseTypeId}-${record.parsed.month}-${record.parsed.year}`;

    const isDuplicateInBatch = records
      .slice(0, index)
      .some((r) =>
        r.parsed &&
        `${r.parsed.houseTypeId}-${r.parsed.month}-${r.parsed.year}` === key
      );

    const isDuplicateInExisting = existingConsumptions.some(
      (c) => `${c.houseTypeId}-${c.month}-${c.year}` === key
    );

    if (isDuplicateInBatch || isDuplicateInExisting) {
      const duplicateError: ValidationError = {
        type: 'duplicate',
        field: 'combination',
        message: '该户型在相同月份已存在数据',
        rowIndex: record.rowIndex,
      };

      return {
        ...record,
        validation: {
          ...record.validation,
          isValid: false,
          errors: [...record.validation.errors, duplicateError],
        },
      };
    }

    return record;
  });
};

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const exportToCSV = (
  consumptions: EnergyConsumption[],
  houseTypes: HouseType[],
  _prices: ElectricityPrice[]
): string => {
  const headers = [
    'houseTypeName', 'month', 'year', 'kWhConsumed', 'targetRoomTemp',
    'normalizedConsumption', 'weatherCorrectedConsumption',
    'estimatedCost', 'isConfirmed', 'dataSource',
  ];

  const lines = [headers.join(',')];

  for (const c of consumptions) {
    const house = houseTypes.find((h) => h.id === c.houseTypeId);

    const values = [
      house?.name || '',
      c.month,
      c.year,
      c.kWhConsumed,
      c.targetRoomTemp,
      c.normalizedConsumption ?? '',
      c.weatherCorrectedConsumption ?? '',
      c.estimatedCost ?? '',
      c.isConfirmed,
      c.dataSource,
    ];

    lines.push(values.map((v) => `"${v}"`).join(','));
  }

  return lines.join('\n');
};

export const exportToJSON = (
  consumptions: EnergyConsumption[],
  houseTypes: HouseType[],
  prices: ElectricityPrice[]
): string => {
  const data = consumptions.map((c) => {
    const house = houseTypes.find((h) => h.id === c.houseTypeId);
    const price = prices.find((p) => p.id === c.electricityPriceId);

    return {
      houseTypeName: house?.name,
      priceName: price?.name,
      month: c.month,
      year: c.year,
      kWhConsumed: c.kWhConsumed,
      targetRoomTemp: c.targetRoomTemp,
      normalizedConsumption: c.normalizedConsumption,
      weatherCorrectedConsumption: c.weatherCorrectedConsumption,
      weatherCorrectionFactor: c.weatherCorrectionFactor,
      estimatedCost: c.estimatedCost,
      isConfirmed: c.isConfirmed,
      hasError: c.hasError,
      errorMessage: c.errorMessage,
      dataSource: c.dataSource,
    };
  });

  return JSON.stringify(data, null, 2);
};
