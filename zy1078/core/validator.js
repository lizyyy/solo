import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import config from '../config/index.js';
import { parseDate, formatDate } from '../utils/date.js';
import { parseDurationToMinutes, parseElevation, normalizePace, normalizeSurface, normalizeTrainingType, normalizeShoeName } from '../utils/normalization.js';

export class DataValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  addError(type, row, message, field, value) {
    this.errors.push({
      type,
      row: row + 1,
      message,
      field,
      value
    });
  }

  addWarning(type, row, message, field, value) {
    this.warnings.push({
      type,
      row: row + 1,
      message,
      field,
      value
    });
  }

  validateRuns(csvContent, shoes = []) {
    const shoeNames = new Set(shoes.map(s => s.name.toLowerCase()));
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });

    const validated = [];
    this.errors = [];
    this.warnings = [];

    const requiredFields = ['date', 'distance'];
    const optionalFields = ['duration', 'pace', 'elevation', 'surface', 'training_type', 'shoe', 'heart_rate', 'calories', 'notes'];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const issues = [];

      for (const field of requiredFields) {
        if (!record[field] && record[field] !== 0) {
          this.addError('missing_field', i, `必填字段缺失: ${field}`, field, record[field]);
          issues.push(`缺失${field}`);
        }
      }

      if (issues.length > 0) {
        continue;
      }

      const date = parseDate(record.date);
      if (!date) {
        this.addError('invalid_date', i, `日期格式无效: ${record.date}`, 'date', record.date);
        continue;
      }

      const distance = parseFloat(record.distance);
      if (isNaN(distance) || distance <= 0) {
        this.addError('invalid_distance', i, `距离必须是正数: ${record.distance}`, 'distance', record.distance);
        continue;
      }

      if (distance < config.validation.minDistance) {
        this.addWarning('distance_small', i, `距离异常小: ${distance} km`, 'distance', distance);
      }
      if (distance > config.validation.maxDistance) {
        this.addError('distance_large', i, `距离异常大: ${distance} km，超过最大值 ${config.validation.maxDistance} km`, 'distance', distance);
        continue;
      }

      const durationMinutes = parseDurationToMinutes(record.duration);
      if (record.duration && (durationMinutes === null || durationMinutes <= 0)) {
        this.addWarning('invalid_duration', i, `时长格式可能有问题: ${record.duration}`, 'duration', record.duration);
      }

      let pace = parseFloat(record.pace);
      if (isNaN(pace) || pace <= 0) {
        if (durationMinutes && durationMinutes > 0 && distance > 0) {
          pace = durationMinutes / distance;
        }
      }

      if (pace !== null && pace !== undefined) {
        if (pace < config.validation.minPace) {
          this.addWarning('pace_fast', i, `配速异常快: ${pace.toFixed(2)} 分/公里`, 'pace', pace);
        }
        if (pace > config.validation.maxPace) {
          this.addWarning('pace_slow', i, `配速异常慢: ${pace.toFixed(2)} 分/公里`, 'pace', pace);
        }
      }

      const elevation = parseElevation(record.elevation);
      if (elevation < config.validation.minElevation) {
        this.addWarning('elevation_low', i, `爬升异常低: ${elevation} m`, 'elevation', elevation);
      }
      if (elevation > config.validation.maxElevation) {
        this.addWarning('elevation_high', i, `爬升异常高: ${elevation} m`, 'elevation', elevation);
      }

      const surface = normalizeSurface(record.surface);
      const trainingType = normalizeTrainingType(record.training_type);
      const shoe = normalizeShoeName(record.shoe);

      if (shoe && shoe !== 'unknown' && !shoeNames.has(shoe.toLowerCase())) {
        this.addWarning('shoe_not_found', i, `鞋款 "${shoe}" 未在 shoes.json 中定义`, 'shoe', shoe);
      }

      const heartRate = record.heart_rate ? parseInt(record.heart_rate) : null;
      const calories = record.calories ? parseInt(record.calories) : null;

      validated.push({
        id: i,
        date: date,
        dateStr: formatDate(date),
        distance: distance,
        duration: durationMinutes,
        pace: pace,
        elevation: elevation,
        surface: surface,
        trainingType: trainingType,
        shoe: shoe,
        heartRate: heartRate,
        calories: calories,
        notes: record.notes || '',
        raw: record
      });
    }

    return {
      data: validated.sort((a, b) => a.date - b.date),
      errors: [...this.errors],
      warnings: [...this.warnings]
    };
  }

  validateShoes(jsonContent) {
    const shoes = JSON.parse(jsonContent);
    this.errors = [];
    this.warnings = [];

    if (!Array.isArray(shoes)) {
      this.addError('invalid_format', -1, 'shoes.json 应该是一个数组', 'root', typeof shoes);
      return { data: [], errors: [...this.errors], warnings: [...this.warnings] };
    }

    const validated = [];
    const names = new Set();

    for (let i = 0; i < shoes.length; i++) {
      const shoe = shoes[i];

      if (!shoe.name) {
        this.addError('missing_name', i, '跑鞋缺少 name 字段', 'name', null);
        continue;
      }

      if (names.has(shoe.name.toLowerCase())) {
        this.addError('duplicate_name', i, `鞋款名称重复: ${shoe.name}`, 'name', shoe.name);
        continue;
      }
      names.add(shoe.name.toLowerCase());

      const purchaseDate = shoe.purchase_date ? parseDate(shoe.purchase_date) : null;
      const initialMileage = parseFloat(shoe.initial_mileage || 0);

      validated.push({
        id: i,
        name: shoe.name,
        brand: shoe.brand || '',
        model: shoe.model || '',
        purchaseDate: purchaseDate,
        purchaseDateStr: purchaseDate ? formatDate(purchaseDate) : null,
        initialMileage: isNaN(initialMileage) ? 0 : initialMileage,
        notes: shoe.notes || '',
        retired: shoe.retired === true,
        raw: shoe
      });
    }

    return {
      data: validated,
      errors: [...this.errors],
      warnings: [...this.warnings]
    };
  }

  validateSoreness(csvContent) {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });

    this.errors = [];
    this.warnings = [];

    const validated = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      if (!record.date) {
        this.addError('missing_date', i, '疼痛日志缺少日期', 'date', null);
        continue;
      }

      const date = parseDate(record.date);
      if (!date) {
        this.addError('invalid_date', i, `日期格式无效: ${record.date}`, 'date', record.date);
        continue;
      }

      const location = record.location ? record.location.trim() : '';
      if (!location) {
        this.addWarning('missing_location', i, '疼痛部位未指定', 'location', null);
      }

      const severity = record.severity ? parseInt(record.severity) : 3;
      if (severity < 1 || severity > 10) {
        this.addWarning('invalid_severity', i, `疼痛程度应该在 1-10 之间: ${record.severity}`, 'severity', record.severity);
      }

      validated.push({
        id: i,
        date: date,
        dateStr: formatDate(date),
        location: location,
        side: record.side ? record.side.trim().toLowerCase() : 'unknown',
        severity: severity,
        description: record.description || '',
        notes: record.notes || '',
        raw: record
      });
    }

    return {
      data: validated.sort((a, b) => a.date - b.date),
      errors: [...this.errors],
      warnings: [...this.warnings]
    };
  }
}

export function validateAll(dataDir, options = {}) {
  const validator = new DataValidator();
  
  const runsPath = path.join(dataDir, options.runsFile || 'runs.csv');
  const shoesPath = path.join(dataDir, options.shoesFile || 'shoes.json');
  const sorenessPath = path.join(dataDir, options.sorenessFile || 'soreness.csv');

  const results = {
    runs: null,
    shoes: null,
    soreness: null,
    allValid: true
  };

  try {
    if (fs.existsSync(shoesPath)) {
      const content = fs.readFileSync(shoesPath, 'utf-8');
      results.shoes = validator.validateShoes(content);
      if (results.shoes.errors.length > 0) {
        results.allValid = false;
      }
    } else {
      results.shoes = { data: [], errors: [], warnings: [] };
    }
  } catch (e) {
    results.shoes = {
      data: [],
      errors: [{ type: 'file_error', row: -1, message: `读取 shoes.json 失败: ${e.message}`, field: 'file', value: shoesPath }],
      warnings: []
    };
    results.allValid = false;
  }

  try {
    if (fs.existsSync(runsPath)) {
      const content = fs.readFileSync(runsPath, 'utf-8');
      results.runs = validator.validateRuns(content, results.shoes.data);
      if (results.runs.errors.length > 0) {
        results.allValid = false;
      }
    } else {
      results.runs = { data: [], errors: [], warnings: [] };
    }
  } catch (e) {
    results.runs = {
      data: [],
      errors: [{ type: 'file_error', row: -1, message: `读取 runs.csv 失败: ${e.message}`, field: 'file', value: runsPath }],
      warnings: []
    };
    results.allValid = false;
  }

  try {
    if (fs.existsSync(sorenessPath)) {
      const content = fs.readFileSync(sorenessPath, 'utf-8');
      results.soreness = validator.validateSoreness(content);
      if (results.soreness.errors.length > 0) {
        results.allValid = false;
      }
    } else {
      results.soreness = { data: [], errors: [], warnings: [] };
    }
  } catch (e) {
    results.soreness = {
      data: [],
      errors: [{ type: 'file_error', row: -1, message: `读取 soreness.csv 失败: ${e.message}`, field: 'file', value: sorenessPath }],
      warnings: []
    };
    results.allValid = false;
  }

  return results;
}
