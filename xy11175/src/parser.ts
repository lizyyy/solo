import * as fs from 'fs';
import * as path from 'path';
import { StoreInspection } from './types';

export class InspectionParser {
  private validateRequiredFields(data: unknown): string[] {
    const errors: string[] = [];
    const obj = data as Record<string, unknown>;

    if (!obj.storeId || typeof obj.storeId !== 'string') {
      errors.push('缺少或无效的 storeId 字段');
    }
    if (!obj.storeName || typeof obj.storeName !== 'string') {
      errors.push('缺少或无效的 storeName 字段');
    }
    if (!obj.inspectionDate || typeof obj.inspectionDate !== 'string') {
      errors.push('缺少或无效的 inspectionDate 字段');
    }
    if (!obj.inspector || typeof obj.inspector !== 'string') {
      errors.push('缺少或无效的 inspector 字段');
    }
    if (!Array.isArray(obj.items)) {
      errors.push('items 字段必须是数组');
    }
    if (!Array.isArray(obj.photos)) {
      errors.push('photos 字段必须是数组');
    }

    return errors;
  }

  parseFile(filePath: string): StoreInspection[] {
    const absolutePath = path.resolve(filePath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`文件不存在: ${absolutePath}`);
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    let data: unknown;

    try {
      data = JSON.parse(content);
    } catch (e) {
      throw new Error(`JSON 解析失败: ${(e as Error).message}`);
    }

    if (Array.isArray(data)) {
      return data.map((item, index) => {
        const errors = this.validateRequiredFields(item);
        if (errors.length > 0) {
          throw new Error(`第 ${index + 1} 条数据验证失败: ${errors.join(', ')}`);
        }
        return item as StoreInspection;
      });
    }

    const errors = this.validateRequiredFields(data);
    if (errors.length > 0) {
      throw new Error(`数据验证失败: ${errors.join(', ')}`);
    }

    return [data as StoreInspection];
  }

  sortInspections(inspections: StoreInspection[]): StoreInspection[] {
    return [...inspections].sort((a, b) => {
      if (a.storeId !== b.storeId) {
        return a.storeId.localeCompare(b.storeId);
      }
      return a.inspectionDate.localeCompare(b.inspectionDate);
    }).map(inspection => ({
      ...inspection,
      items: [...inspection.items].sort((a, b) => a.itemId.localeCompare(b.itemId)),
      photos: [...inspection.photos].sort((a, b) => a.photoId.localeCompare(b.photoId))
    }));
  }
}
