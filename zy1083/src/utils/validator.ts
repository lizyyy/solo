import { House, VisitNote, ValidationError, RatingConfig, AdditionalFee } from '../types';

export const validateHouse = (house: House, index: number = 0): ValidationError[] => {
  const errors: ValidationError[] = [];
  const row = index + 2;

  if (!house.id || house.id.trim() === '') {
    errors.push({
      row,
      column: 'id',
      field: 'id',
      message: '房源ID不能为空',
      value: house.id,
    });
  }

  if (!house.name || house.name.trim() === '') {
    errors.push({
      row,
      column: 'name',
      field: 'name',
      message: '房源名称不能为空',
      value: house.name,
    });
  }

  if (!house.address || house.address.trim() === '') {
    errors.push({
      row,
      column: 'address',
      field: 'address',
      message: '房源地址不能为空',
      value: house.address,
    });
  }

  if (house.monthlyRent === undefined || house.monthlyRent === null) {
    errors.push({
      row,
      column: 'monthlyRent',
      field: 'monthlyRent',
      message: '月租金不能为空',
      value: '',
    });
  } else if (typeof house.monthlyRent !== 'number' || isNaN(house.monthlyRent)) {
    errors.push({
      row,
      column: 'monthlyRent',
      field: 'monthlyRent',
      message: '月租金必须是有效的数字',
      value: String(house.monthlyRent),
    });
  } else if (house.monthlyRent < 0) {
    errors.push({
      row,
      column: 'monthlyRent',
      field: 'monthlyRent',
      message: '月租金不能为负数',
      value: String(house.monthlyRent),
    });
  }

  if (house.deposit === undefined || house.deposit === null) {
    errors.push({
      row,
      column: 'deposit',
      field: 'deposit',
      message: '押金不能为空',
      value: '',
    });
  } else if (typeof house.deposit !== 'number' || isNaN(house.deposit)) {
    errors.push({
      row,
      column: 'deposit',
      field: 'deposit',
      message: '押金必须是有效的数字',
      value: String(house.deposit),
    });
  } else if (house.deposit < 0) {
    errors.push({
      row,
      column: 'deposit',
      field: 'deposit',
      message: '押金不能为负数',
      value: String(house.deposit),
    });
  }

  if (house.area === undefined || house.area === null) {
    errors.push({
      row,
      column: 'area',
      field: 'area',
      message: '面积不能为空',
      value: '',
    });
  } else if (typeof house.area !== 'number' || isNaN(house.area)) {
    errors.push({
      row,
      column: 'area',
      field: 'area',
      message: '面积必须是有效的数字',
      value: String(house.area),
    });
  } else if (house.area <= 0) {
    errors.push({
      row,
      column: 'area',
      field: 'area',
      message: '面积必须大于0',
      value: String(house.area),
    });
  }

  if (house.commuteTime === undefined || house.commuteTime === null) {
    errors.push({
      row,
      column: 'commuteTime',
      field: 'commuteTime',
      message: '通勤时间不能为空',
      value: '',
    });
  } else if (typeof house.commuteTime !== 'number' || isNaN(house.commuteTime)) {
    errors.push({
      row,
      column: 'commuteTime',
      field: 'commuteTime',
      message: '通勤时间必须是有效的数字（分钟）',
      value: String(house.commuteTime),
    });
  } else if (house.commuteTime < 0) {
    errors.push({
      row,
      column: 'commuteTime',
      field: 'commuteTime',
      message: '通勤时间不能为负数',
      value: String(house.commuteTime),
    });
  }

  if (house.contractTerm !== undefined && house.contractTerm !== null) {
    if (typeof house.contractTerm !== 'number' || isNaN(house.contractTerm)) {
      errors.push({
        row,
        column: 'contractTerm',
        field: 'contractTerm',
        message: '合同期限必须是有效的数字（月）',
        value: String(house.contractTerm),
      });
    } else if (house.contractTerm <= 0) {
      errors.push({
        row,
        column: 'contractTerm',
        field: 'contractTerm',
        message: '合同期限必须大于0',
        value: String(house.contractTerm),
      });
    }
  }

  if (house.agencyFee !== undefined && house.agencyFee !== null) {
    if (typeof house.agencyFee !== 'number' || isNaN(house.agencyFee)) {
      errors.push({
        row,
        column: 'agencyFee',
        field: 'agencyFee',
        message: '中介费必须是有效的数字',
        value: String(house.agencyFee),
      });
    } else if (house.agencyFee < 0) {
      errors.push({
        row,
        column: 'agencyFee',
        field: 'agencyFee',
        message: '中介费不能为负数',
        value: String(house.agencyFee),
      });
    }
  }

  if (house.additionalFees && Array.isArray(house.additionalFees)) {
    house.additionalFees.forEach((fee: AdditionalFee, feeIndex: number) => {
      if (fee.amount === undefined || fee.amount === null) {
        errors.push({
          row,
          column: `additionalFees[${feeIndex}].amount`,
          field: 'additionalFees',
          message: `额外费用 "${fee.name}" 的金额不能为空`,
          value: '',
        });
      } else if (typeof fee.amount !== 'number' || isNaN(fee.amount)) {
        errors.push({
          row,
          column: `additionalFees[${feeIndex}].amount`,
          field: 'additionalFees',
          message: `额外费用 "${fee.name}" 的金额必须是有效的数字`,
          value: String(fee.amount),
        });
      } else if (fee.amount < 0) {
        errors.push({
          row,
          column: `additionalFees[${feeIndex}].amount`,
          field: 'additionalFees',
          message: `额外费用 "${fee.name}" 的金额不能为负数`,
          value: String(fee.amount),
        });
      }
    });
  }

  return errors;
};

export const validateVisitNote = (
  visitNote: VisitNote,
  houses: House[],
  index: number = 0
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const row = index + 2;

  if (!visitNote.id || visitNote.id.trim() === '') {
    errors.push({
      row,
      column: 'id',
      field: 'id',
      message: '看房记录ID不能为空',
      value: visitNote.id,
    });
  }

  if (!visitNote.houseId || visitNote.houseId.trim() === '') {
    errors.push({
      row,
      column: 'houseId',
      field: 'houseId',
      message: '关联房源ID不能为空',
      value: visitNote.houseId,
    });
  } else {
    const houseExists = houses.some((h) => h.id === visitNote.houseId);
    if (!houseExists) {
      errors.push({
        row,
        column: 'houseId',
        field: 'houseId',
        message: `未找到ID为 "${visitNote.houseId}" 的房源`,
        value: visitNote.houseId,
      });
    }
  }

  if (visitNote.lighting !== undefined && visitNote.lighting !== null) {
    if (typeof visitNote.lighting !== 'number' || isNaN(visitNote.lighting)) {
      errors.push({
        row,
        column: 'lighting',
        field: 'lighting',
        message: '采光评分必须是有效的数字',
        value: String(visitNote.lighting),
      });
    } else if (visitNote.lighting < 1 || visitNote.lighting > 5) {
      errors.push({
        row,
        column: 'lighting',
        field: 'lighting',
        message: '采光评分必须在1-5之间',
        value: String(visitNote.lighting),
      });
    }
  }

  if (visitNote.noise !== undefined && visitNote.noise !== null) {
    if (typeof visitNote.noise !== 'number' || isNaN(visitNote.noise)) {
      errors.push({
        row,
        column: 'noise',
        field: 'noise',
        message: '噪音评分必须是有效的数字',
        value: String(visitNote.noise),
      });
    } else if (visitNote.noise < 1 || visitNote.noise > 5) {
      errors.push({
        row,
        column: 'noise',
        field: 'noise',
        message: '噪音评分必须在1-5之间',
        value: String(visitNote.noise),
      });
    }
  }

  if (visitNote.surroundingSafety !== undefined && visitNote.surroundingSafety !== null) {
    if (typeof visitNote.surroundingSafety !== 'number' || isNaN(visitNote.surroundingSafety)) {
      errors.push({
        row,
        column: 'surroundingSafety',
        field: 'surroundingSafety',
        message: '周边安全评分必须是有效的数字',
        value: String(visitNote.surroundingSafety),
      });
    } else if (visitNote.surroundingSafety < 1 || visitNote.surroundingSafety > 5) {
      errors.push({
        row,
        column: 'surroundingSafety',
        field: 'surroundingSafety',
        message: '周边安全评分必须在1-5之间',
        value: String(visitNote.surroundingSafety),
      });
    }
  }

  return errors;
};

export const validateRatingConfig = (config: RatingConfig): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!config.weights) {
    errors.push({
      row: 1,
      column: 'weights',
      field: 'weights',
      message: '评分权重配置缺失',
      value: '',
    });
    return errors;
  }

  const weightFields = [
    { field: 'monthlyRent', name: '月租金权重' },
    { field: 'depositRisk', name: '押金风险权重' },
    { field: 'commuteTime', name: '通勤时间权重' },
    { field: 'lighting', name: '采光权重' },
    { field: 'noise', name: '噪音权重' },
    { field: 'waterLeak', name: '漏水权重' },
    { field: 'odor', name: '异味权重' },
    { field: 'repairCost', name: '维修成本权重' },
    { field: 'surroundingSafety', name: '周边安全权重' },
    { field: 'agencyFee', name: '中介费权重' },
    { field: 'additionalFees', name: '额外费用权重' },
  ];

  weightFields.forEach(({ field, name }) => {
    const value = (config.weights as any)[field];
    if (value === undefined || value === null) {
      errors.push({
        row: 1,
        column: `weights.${field}`,
        field: `weights.${field}`,
        message: `${name} 缺失`,
        value: '',
      });
    } else if (typeof value !== 'number' || isNaN(value)) {
      errors.push({
        row: 1,
        column: `weights.${field}`,
        field: `weights.${field}`,
        message: `${name} 必须是有效的数字`,
        value: String(value),
      });
    } else if (value < 0) {
      errors.push({
        row: 1,
        column: `weights.${field}`,
        field: `weights.${field}`,
        message: `${name} 不能为负数`,
        value: String(value),
      });
    }
  });

  return errors;
};

export const validateAllData = (
  houses: House[],
  visitNotes: VisitNote[]
): { houseErrors: ValidationError[]; visitNoteErrors: ValidationError[] } => {
  const houseErrors: ValidationError[] = [];
  const visitNoteErrors: ValidationError[] = [];

  houses.forEach((house, index) => {
    const errors = validateHouse(house, index);
    houseErrors.push(...errors);
  });

  visitNotes.forEach((visitNote, index) => {
    const errors = validateVisitNote(visitNote, houses, index);
    visitNoteErrors.push(...errors);
  });

  const houseIds = new Set(houses.map((h) => h.id));
  const duplicateIds = houses.filter(
    (h, index, arr) => arr.findIndex((item) => item.id === h.id) !== index
  );

  duplicateIds.forEach((house) => {
    const index = houses.indexOf(house);
    houseErrors.push({
      row: index + 2,
      column: 'id',
      field: 'id',
      message: `房源ID "${house.id}" 重复`,
      value: house.id,
    });
  });

  const visitNoteIds = new Set(visitNotes.map((v) => v.id));
  const duplicateVisitIds = visitNotes.filter(
    (v, index, arr) => arr.findIndex((item) => item.id === v.id) !== index
  );

  duplicateVisitIds.forEach((visitNote) => {
    const index = visitNotes.indexOf(visitNote);
    visitNoteErrors.push({
      row: index + 2,
      column: 'id',
      field: 'id',
      message: `看房记录ID "${visitNote.id}" 重复`,
      value: visitNote.id,
    });
  });

  return { houseErrors, visitNoteErrors };
};

export const formatValidationErrors = (errors: ValidationError[]): string => {
  if (errors.length === 0) return '';

  return errors
    .map((error) => {
      return `第 ${error.row} 行，列 "${error.column}": ${error.message} (值: ${error.value || '空'})`;
    })
    .join('\n');
};
