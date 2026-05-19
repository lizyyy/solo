import { SampleRetention, TemperatureLog, DiscardRecord } from '../models/types';
import { parseISO, isValid } from 'date-fns';

export interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors: string[];
  suggestions: string[];
}

export class Validator {
  static validateSampleRetention(row: any, rowNumber: number): ValidationResult<SampleRetention> {
    const errors: string[] = [];
    const suggestions: string[] = [];

    if (!row.date || !this.isValidDate(row.date)) {
      errors.push(`日期格式无效: ${row.date}`);
      suggestions.push('请使用 YYYY-MM-DD 格式，例如 2024-05-19');
    }

    if (!row.dishName || String(row.dishName).trim() === '') {
      errors.push('菜品名称不能为空');
      suggestions.push('请填写菜品名称，例如 "宫保鸡丁"');
    }

    if (!row.dishType || String(row.dishType).trim() === '') {
      errors.push('菜品类型不能为空');
      suggestions.push('请填写菜品类型，例如 "热菜"、"凉菜"、"主食"');
    }

    if (row.quantity === undefined || row.quantity === null || isNaN(Number(row.quantity)) || Number(row.quantity) <= 0) {
      errors.push(`数量无效: ${row.quantity}`);
      suggestions.push('请填写大于0的数字，例如 1、0.5');
    }

    if (!row.reservedBy || String(row.reservedBy).trim() === '') {
      errors.push('留样人不能为空');
      suggestions.push('请填写留样人姓名');
    }

    if (!row.reservedAt || !this.isValidDateTime(row.reservedAt)) {
      errors.push(`留样时间格式无效: ${row.reservedAt}`);
      suggestions.push('请使用 YYYY-MM-DD HH:mm:ss 格式，例如 2024-05-19 09:30:00');
    }

    if (!row.storageLocation || String(row.storageLocation).trim() === '') {
      errors.push('存放位置不能为空');
      suggestions.push('请填写存放位置，例如 "留样冰箱1号"');
    }

    if (!row.discardDate || !this.isValidDate(row.discardDate)) {
      errors.push(`废弃日期格式无效: ${row.discardDate}`);
      suggestions.push('请使用 YYYY-MM-DD 格式');
    }

    if (errors.length > 0) {
      return { isValid: false, errors, suggestions };
    }

    return {
      isValid: true,
      errors: [],
      suggestions: [],
      data: {
        id: '',
        date: String(row.date).trim(),
        dishName: String(row.dishName).trim(),
        dishType: String(row.dishType).trim(),
        quantity: Number(row.quantity),
        reservedBy: String(row.reservedBy).trim(),
        reservedAt: String(row.reservedAt).trim(),
        storageLocation: String(row.storageLocation).trim(),
        discardDate: String(row.discardDate).trim(),
        status: 'pending' as any,
        remarks: row.remarks ? String(row.remarks).trim() : undefined,
        createdAt: '',
        updatedAt: ''
      }
    };
  }

  static validateTemperatureLog(row: any, rowNumber: number): ValidationResult<TemperatureLog> {
    const errors: string[] = [];
    const suggestions: string[] = [];

    if (!row.date || !this.isValidDate(row.date)) {
      errors.push(`日期格式无效: ${row.date}`);
      suggestions.push('请使用 YYYY-MM-DD 格式');
    }

    if (!row.refrigeratorId || String(row.refrigeratorId).trim() === '') {
      errors.push('冰箱编号不能为空');
      suggestions.push('请填写冰箱编号，例如 "FRIDGE-001"');
    }

    if (!row.refrigeratorName || String(row.refrigeratorName).trim() === '') {
      errors.push('冰箱名称不能为空');
      suggestions.push('请填写冰箱名称，例如 "留样冰箱1号"');
    }

    if (row.temperature === undefined || row.temperature === null || isNaN(Number(row.temperature))) {
      errors.push(`温度值无效: ${row.temperature}`);
      suggestions.push('请填写数字，例如 4.5');
    }

    if (row.minTemperature === undefined || row.minTemperature === null || isNaN(Number(row.minTemperature))) {
      errors.push(`最低温度值无效: ${row.minTemperature}`);
      suggestions.push('请填写最低温度阈值，例如 0');
    }

    if (row.maxTemperature === undefined || row.maxTemperature === null || isNaN(Number(row.maxTemperature))) {
      errors.push(`最高温度值无效: ${row.maxTemperature}`);
      suggestions.push('请填写最高温度阈值，例如 8');
    }

    if (!row.measuredBy || String(row.measuredBy).trim() === '') {
      errors.push('测量人不能为空');
      suggestions.push('请填写测量人姓名');
    }

    if (!row.measuredAt || !this.isValidDateTime(row.measuredAt)) {
      errors.push(`测量时间格式无效: ${row.measuredAt}`);
      suggestions.push('请使用 YYYY-MM-DD HH:mm:ss 格式');
    }

    if (errors.length > 0) {
      return { isValid: false, errors, suggestions };
    }

    const temp = Number(row.temperature);
    const minTemp = Number(row.minTemperature);
    const maxTemp = Number(row.maxTemperature);
    const isNormal = temp >= minTemp && temp <= maxTemp;

    return {
      isValid: true,
      errors: [],
      suggestions: [],
      data: {
        id: '',
        date: String(row.date).trim(),
        refrigeratorId: String(row.refrigeratorId).trim(),
        refrigeratorName: String(row.refrigeratorName).trim(),
        temperature: temp,
        minTemperature: minTemp,
        maxTemperature: maxTemp,
        measuredBy: String(row.measuredBy).trim(),
        measuredAt: String(row.measuredAt).trim(),
        isNormal,
        status: 'pending' as any,
        remarks: row.remarks ? String(row.remarks).trim() : undefined,
        createdAt: '',
        updatedAt: ''
      }
    };
  }

  static validateDiscardRecord(row: any, rowNumber: number): ValidationResult<DiscardRecord> {
    const errors: string[] = [];
    const suggestions: string[] = [];

    if (!row.date || !this.isValidDate(row.date)) {
      errors.push(`日期格式无效: ${row.date}`);
      suggestions.push('请使用 YYYY-MM-DD 格式');
    }

    if (!row.itemName || String(row.itemName).trim() === '') {
      errors.push('物品名称不能为空');
      suggestions.push('请填写物品名称');
    }

    if (!row.itemType || String(row.itemType).trim() === '') {
      errors.push('物品类型不能为空');
      suggestions.push('请填写物品类型，例如 "原材料"、"半成品"、"成品"');
    }

    if (row.quantity === undefined || row.quantity === null || isNaN(Number(row.quantity)) || Number(row.quantity) <= 0) {
      errors.push(`数量无效: ${row.quantity}`);
      suggestions.push('请填写大于0的数字');
    }

    if (!row.unit || String(row.unit).trim() === '') {
      errors.push('单位不能为空');
      suggestions.push('请填写单位，例如 "kg"、"份"、"个"');
    }

    if (!row.discardReason || String(row.discardReason).trim() === '') {
      errors.push('废弃原因不能为空');
      suggestions.push('请填写废弃原因，例如 "过期"、"变质"、"留样到期"');
    }

    if (!row.discardedBy || String(row.discardedBy).trim() === '') {
      errors.push('废弃人不能为空');
      suggestions.push('请填写废弃人姓名');
    }

    if (!row.discardedAt || !this.isValidDateTime(row.discardedAt)) {
      errors.push(`废弃时间格式无效: ${row.discardedAt}`);
      suggestions.push('请使用 YYYY-MM-DD HH:mm:ss 格式');
    }

    if (errors.length > 0) {
      return { isValid: false, errors, suggestions };
    }

    return {
      isValid: true,
      errors: [],
      suggestions: [],
      data: {
        id: '',
        date: String(row.date).trim(),
        itemName: String(row.itemName).trim(),
        itemType: String(row.itemType).trim(),
        quantity: Number(row.quantity),
        unit: String(row.unit).trim(),
        discardReason: String(row.discardReason).trim(),
        discardedBy: String(row.discardedBy).trim(),
        discardedAt: String(row.discardedAt).trim(),
        status: 'pending' as any,
        remarks: row.remarks ? String(row.remarks).trim() : undefined,
        createdAt: '',
        updatedAt: ''
      }
    };
  }

  private static isValidDate(dateStr: string): boolean {
    try {
      const cleaned = String(dateStr).trim().replace(/\//g, '-');
      const parts = cleaned.split('-');
      if (parts.length !== 3) return false;
      const date = new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
      return isValid(date);
    } catch {
      return false;
    }
  }

  private static isValidDateTime(dateTimeStr: string): boolean {
    try {
      const cleaned = String(dateTimeStr).trim().replace(/\//g, '-');
      const [datePart, timePart] = cleaned.split(' ');
      if (!datePart || !timePart) return false;
      const dateParts = datePart.split('-');
      if (dateParts.length !== 3) return false;
      const normalizedDate = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')} ${timePart}`;
      return isValid(parseISO(normalizedDate.replace(' ', 'T')));
    } catch {
      return false;
    }
  }
}