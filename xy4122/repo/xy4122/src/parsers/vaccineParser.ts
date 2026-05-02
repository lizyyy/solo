import { parse } from 'csv-parse/sync';
import * as fs from 'fs-extra';
import { parseISO, isValid } from 'date-fns';
import { VaccineBatch } from '../types';

export interface VaccineParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
  batchIdExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  vaccineNameExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  manufacturerExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  quantityExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  minTempExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  maxTempExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  validFromExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  validToExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  fridgeIdExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  entryDateExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  exitDateExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  targetFridgeIdExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  notesExtractor?: (row: Record<string, string>, rowIndex: number) => string;
}

export const DEFAULT_VACCINE_OPTIONS: VaccineParseOptions = {
  delimiter: ',',
  hasHeader: true,
  batchIdExtractor: (row) => row['批次号'] || row['batchId'] || row['BatchID'] || row['batch_id'] || row['批号'] || '',
  vaccineNameExtractor: (row) => row['疫苗名称'] || row['vaccineName'] || row['VaccineName'] || row['vaccine_name'] || row['名称'] || '',
  manufacturerExtractor: (row) => row['生产厂家'] || row['manufacturer'] || row['Manufacturer'] || row['厂家'] || '',
  quantityExtractor: (row) => row['数量'] || row['quantity'] || row['Quantity'] || row['库存'] || '',
  minTempExtractor: (row) => row['最低温度'] || row['minTemp'] || row['MinTemp'] || row['min_temp'] || row['低温'] || '',
  maxTempExtractor: (row) => row['最高温度'] || row['maxTemp'] || row['MaxTemp'] || row['max_temp'] || row['高温'] || '',
  validFromExtractor: (row) => row['有效期开始'] || row['validFrom'] || row['ValidFrom'] || row['valid_from'] || row['生效日期'] || '',
  validToExtractor: (row) => row['有效期结束'] || row['validTo'] || row['ValidTo'] || row['valid_to'] || row['失效日期'] || row['有效期'] || '',
  fridgeIdExtractor: (row) => row['冰箱ID'] || row['fridgeId'] || row['FridgeID'] || row['fridge_id'] || row['存储位置'] || row['位置'] || '',
  entryDateExtractor: (row) => row['入库日期'] || row['entryDate'] || row['EntryDate'] || row['entry_date'] || row['入库时间'] || '',
  exitDateExtractor: (row) => row['出库日期'] || row['exitDate'] || row['ExitDate'] || row['exit_date'] || row['出库时间'] || '',
  targetFridgeIdExtractor: (row) => row['目标冰箱'] || row['targetFridgeId'] || row['TargetFridgeID'] || row['target_fridge_id'] || row['转移目标'] || '',
  notesExtractor: (row) => row['备注'] || row['notes'] || row['Notes'] || row['说明'] || '',
};

export class VaccineParser {
  private options: VaccineParseOptions;

  constructor(options: Partial<VaccineParseOptions> = {}) {
    this.options = { ...DEFAULT_VACCINE_OPTIONS, ...options };
  }

  async parseFile(filePath: string): Promise<VaccineBatch[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parseString(content);
  }

  parseString(content: string): VaccineBatch[] {
    const { delimiter, hasHeader } = this.options;
    
    const records = parse(content, {
      delimiter: delimiter || ',',
      columns: hasHeader,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    return records
      .map((row, index) => this.parseRow(row, index))
      .filter(Boolean) as VaccineBatch[];
  }

  private parseRow(row: Record<string, string>, rowIndex: number): VaccineBatch | null {
    const {
      batchIdExtractor, vaccineNameExtractor, manufacturerExtractor, quantityExtractor,
      minTempExtractor, maxTempExtractor, validFromExtractor, validToExtractor,
      fridgeIdExtractor, entryDateExtractor, exitDateExtractor,
      targetFridgeIdExtractor, notesExtractor
    } = this.options;

    const batchId = batchIdExtractor ? batchIdExtractor(row, rowIndex) : '';
    const vaccineName = vaccineNameExtractor ? vaccineNameExtractor(row, rowIndex) : '';

    if (!batchId || !vaccineName) {
      return null;
    }

    const manufacturer = manufacturerExtractor ? manufacturerExtractor(row, rowIndex) : '';
    const rawQuantity = quantityExtractor ? quantityExtractor(row, rowIndex) : '';
    const rawMinTemp = minTempExtractor ? minTempExtractor(row, rowIndex) : '';
    const rawMaxTemp = maxTempExtractor ? maxTempExtractor(row, rowIndex) : '';
    const rawValidFrom = validFromExtractor ? validFromExtractor(row, rowIndex) : '';
    const rawValidTo = validToExtractor ? validToExtractor(row, rowIndex) : '';
    const fridgeId = fridgeIdExtractor ? fridgeIdExtractor(row, rowIndex) : '';
    const rawEntryDate = entryDateExtractor ? entryDateExtractor(row, rowIndex) : '';
    const rawExitDate = exitDateExtractor ? exitDateExtractor(row, rowIndex) : '';
    const targetFridgeId = targetFridgeIdExtractor ? targetFridgeIdExtractor(row, rowIndex) : '';
    const notes = notesExtractor ? notesExtractor(row, rowIndex) : '';

    const quantity = this.parseNumber(rawQuantity, 0);
    const minTemp = this.parseNumber(rawMinTemp, 2);
    const maxTemp = this.parseNumber(rawMaxTemp, 8);
    const validFrom = this.parseTimestamp(rawValidFrom);
    const validTo = this.parseTimestamp(rawValidTo);
    const entryDate = this.parseTimestamp(rawEntryDate);
    const exitDate = this.parseTimestamp(rawExitDate);

    if (!entryDate || !isValid(entryDate)) {
      return null;
    }

    return {
      batchId: batchId.trim(),
      vaccineName: vaccineName.trim(),
      manufacturer: manufacturer.trim() || '未知',
      quantity,
      minTemp,
      maxTemp,
      validFrom: validFrom || entryDate,
      validTo: validTo || new Date(entryDate.getTime() + 365 * 24 * 60 * 60 * 1000),
      fridgeId: fridgeId.trim() || 'unknown',
      entryDate,
      exitDate: exitDate || undefined,
      targetFridgeId: targetFridgeId.trim() || undefined,
      notes: notes.trim() || undefined,
    };
  }

  private parseTimestamp(value: string): Date | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    
    const parsed = parseISO(trimmed);
    if (isValid(parsed)) {
      return parsed;
    }

    const chinesePattern = /(\d{4})年(\d{1,2})月(\d{1,2})日/;
    const chineseMatch = trimmed.match(chinesePattern);
    if (chineseMatch) {
      const [, year, month, day] = chineseMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    const slashPattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
    const slashMatch = trimmed.match(slashPattern);
    if (slashMatch) {
      const [, month, day, year] = slashMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    const dashPattern = /(\d{4})-(\d{1,2})-(\d{1,2})/;
    const dashMatch = trimmed.match(dashPattern);
    if (dashMatch) {
      const [, year, month, day] = dashMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    return null;
  }

  private parseNumber(value: string, defaultValue: number): number {
    const trimmed = value.trim();
    if (!trimmed) return defaultValue;

    const numMatch = trimmed.match(/-?\d+(\.\d+)?/);
    if (!numMatch) return defaultValue;

    return parseFloat(numMatch[0]);
  }

  parseFiles(filePaths: string[]): Promise<VaccineBatch[]> {
    return Promise.all(filePaths.map(path => this.parseFile(path)))
      .then(results => results.flat());
  }
}
