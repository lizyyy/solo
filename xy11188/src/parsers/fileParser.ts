import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import { FileParseResult, ParsedItem, ParseError, FurnitureItem } from '../types';

export class FileParser {
  private supportedFormats = ['.csv', '.xlsx', '.xls'];

  isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedFormats.includes(ext);
  }

  async parseFile(filePath: string): Promise<FileParseResult> {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);

    if (!this.isSupportedFile(filePath)) {
      return {
        fileName,
        success: false,
        items: [],
        errors: [{
          lineNumber: 0,
          fileName,
          errorType: 'UNSUPPORTED_FORMAT',
          message: `不支持的文件格式: ${ext}`,
          rawContent: ''
        }]
      };
    }

    try {
      if (ext === '.csv') {
        return this.parseCSV(filePath, fileName);
      } else {
        return this.parseExcel(filePath, fileName);
      }
    } catch (error) {
      return {
        fileName,
        success: false,
        items: [],
        errors: [{
          lineNumber: 0,
          fileName,
          errorType: 'FILE_READ_ERROR',
          message: `文件读取失败: ${(error as Error).message}`,
          rawContent: ''
        }]
      };
    }
  }

  private async parseCSV(filePath: string, fileName: string): Promise<FileParseResult> {
    return new Promise((resolve) => {
      const items: ParsedItem[] = [];
      const errors: ParseError[] = [];
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      
      if (lines.length === 0) {
        resolve({ fileName, success: true, items, errors });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());

      for (let i = 1; i < lines.length; i++) {
        const lineNumber = i + 1;
        const line = lines[i].trim();
        
        if (!line) continue;

        const values = line.split(',');
        const row: Record<string, string> = {};
        
        headers.forEach((header, index) => {
          row[header] = (values[index] || '').trim();
        });

        try {
          const parsedItem = this.parseRow(row, lineNumber, fileName);
          items.push(parsedItem);
        } catch (error) {
          errors.push({
            lineNumber,
            fileName,
            errorType: 'PARSE_ERROR',
            message: (error as Error).message,
            rawContent: JSON.stringify(row)
          });
          items.push({
            raw: row,
            lineNumber,
            fileName,
            data: null
          });
        }
      }

      resolve({
        fileName,
        success: errors.length === 0,
        items,
        errors
      });
    });
  }

  private parseExcel(filePath: string, fileName: string): FileParseResult {
    const items: ParsedItem[] = [];
    const errors: ParseError[] = [];

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    const headers = jsonData[0] || [];
    
    for (let i = 1; i < jsonData.length; i++) {
      const lineNumber = i + 1;
      const row = jsonData[i];
      
      if (!row || row.every(cell => cell === undefined || cell === null || cell === '')) {
        continue;
      }

      const rowObj: Record<string, any> = {};
      headers.forEach((header: string, index: number) => {
        rowObj[header] = row[index];
      });

      try {
        const parsedItem = this.parseRow(rowObj, lineNumber, fileName);
        items.push(parsedItem);
      } catch (error) {
        errors.push({
          lineNumber,
          fileName,
          errorType: 'PARSE_ERROR',
          message: (error as Error).message,
          rawContent: JSON.stringify(row)
        });
        items.push({
          raw: rowObj,
          lineNumber,
          fileName,
          data: null
        });
      }
    }

    return {
      fileName,
      success: errors.length === 0,
      items,
      errors
    };
  }

  private parseRow(row: any, lineNumber: number, fileName: string): ParsedItem {
    const requiredFields = ['name', 'category', 'width', 'height', 'depth', 'weight'];
    const missingFields = requiredFields.filter(field => row[field] === undefined || row[field] === '');

    if (missingFields.length > 0) {
      throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
    }

    const width = parseFloat(row.width);
    const height = parseFloat(row.height);
    const depth = parseFloat(row.depth);
    const weight = parseFloat(row.weight);

    if (isNaN(width) || isNaN(height) || isNaN(depth) || isNaN(weight)) {
      throw new Error('尺寸或重量必须是有效数字');
    }

    if (width <= 0 || height <= 0 || depth <= 0 || weight <= 0) {
      throw new Error('尺寸或重量必须大于0');
    }

    const furnitureItem: FurnitureItem = {
      id: row.id || `ITEM-${lineNumber}`,
      name: String(row.name),
      category: String(row.category),
      width,
      height,
      depth,
      weight,
      isNonDisassemblable: String(row.isNonDisassemblable || 'false').toLowerCase() === 'true',
      quantity: parseInt(row.quantity || '1', 10) || 1
    };

    return {
      raw: row,
      lineNumber,
      fileName,
      data: furnitureItem
    };
  }

  async parseFiles(filePaths: string[]): Promise<FileParseResult[]> {
    const results: FileParseResult[] = [];
    
    for (const filePath of filePaths) {
      try {
        const result = await this.parseFile(filePath);
        results.push(result);
      } catch (error) {
        results.push({
          fileName: path.basename(filePath),
          success: false,
          items: [],
          errors: [{
            lineNumber: 0,
            fileName: path.basename(filePath),
            errorType: 'PROCESSING_ERROR',
            message: `处理文件时出错: ${(error as Error).message}`,
            rawContent: ''
          }]
        });
      }
    }

    return results;
  }
}
