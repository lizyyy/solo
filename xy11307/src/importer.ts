import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { Elder, MenuItem, ImportResult, ImportError } from './types';
import { db } from './database';

export class DataImporter {
  private validateElderRow(row: Record<string, any>, rowNumber: number): { valid: boolean; errors: string[]; suggestion: string } {
    const errors: string[] = [];
    const suggestions: string[] = [];

    if (!row.name || row.name.trim() === '') {
      errors.push('姓名不能为空');
      suggestions.push('请填写老人姓名');
    }
    if (!row.phone || row.phone.trim() === '') {
      errors.push('联系电话不能为空');
      suggestions.push('请填写联系电话');
    }
    if (!row.address || row.address.trim() === '') {
      errors.push('地址不能为空');
      suggestions.push('请填写详细地址');
    }
    if (!row.deliveryRoute || row.deliveryRoute.trim() === '') {
      errors.push('配送路线不能为空');
      suggestions.push('请指定配送路线，如"A线"、"B线"');
    }

    return {
      valid: errors.length === 0,
      errors,
      suggestion: suggestions.join('; ') || '请检查必填字段',
    };
  }

  private parseElderRow(row: Record<string, any>): Omit<Elder, 'id' | 'createdAt' | 'updatedAt'> {
    const dietaryRestrictions = row.dietaryRestrictions 
      ? row.dietaryRestrictions.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean)
      : [];
    
    const chronicConditions = row.chronicConditions 
      ? row.chronicConditions.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean)
      : [];

    return {
      name: row.name?.trim() || '',
      phone: row.phone?.trim() || '',
      address: row.address?.trim() || '',
      dietaryRestrictions,
      chronicConditions,
      deliveryRoute: row.deliveryRoute?.trim() || '',
      roomNumber: row.roomNumber?.trim() || undefined,
    };
  }

  async importEldersFromCSV(filePath: string): Promise<ImportResult<Elder>> {
    const results: any[] = [];
    const errors: ImportError[] = [];
    let rowNumber = 0;

    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          rowNumber++;
          results.push({ row: rowNumber, data });
        })
        .on('end', () => {
          const validElders: Array<Omit<Elder, 'id' | 'createdAt' | 'updatedAt'>> = [];
          
          results.forEach(({ row, data }) => {
            const validation = this.validateElderRow(data, row);
            if (validation.valid) {
              validElders.push(this.parseElderRow(data));
            } else {
              errors.push({
                row,
                rawData: data,
                error: validation.errors.join('; '),
                suggestion: validation.suggestion,
              });
            }
          });

          const imported = db.bulkAddElders(validElders);
          if (errors.length > 0) {
            db.saveImportErrors('elders', errors);
          }

          resolve({
            success: imported,
            errors,
            total: results.length,
          });
        });
    });
  }

  importMenuFromJSON(filePath: string): ImportResult<MenuItem> {
    const errors: ImportError[] = [];
    const validItems: Array<Omit<MenuItem, 'id'>> = [];

    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawContent);
    const items = Array.isArray(data) ? data : [data];

    items.forEach((item, index) => {
      const rowNumber = index + 1;
      const itemErrors: string[] = [];
      const suggestions: string[] = [];

      if (!item.name || item.name.trim() === '') {
        itemErrors.push('菜品名称不能为空');
        suggestions.push('请填写菜品名称');
      }
      if (!item.category || !['breakfast', 'lunch', 'dinner'].includes(item.category)) {
        itemErrors.push('菜品分类必须是 breakfast、lunch 或 dinner');
        suggestions.push('请修正菜品分类');
      }
      if (typeof item.price !== 'number' || item.price < 0) {
        itemErrors.push('价格必须是非负数');
        suggestions.push('请填写正确的价格');
      }

      if (itemErrors.length === 0) {
        validItems.push({
          name: item.name.trim(),
          ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
          isSuitableFor: {
            diabetes: Boolean(item.isSuitableFor?.diabetes),
            hypertension: Boolean(item.isSuitableFor?.hypertension),
            vegetarian: Boolean(item.isSuitableFor?.vegetarian),
          },
          price: item.price,
          category: item.category,
        });
      } else {
        errors.push({
          row: rowNumber,
          rawData: item,
          error: itemErrors.join('; '),
          suggestion: suggestions.join('; '),
        });
      }
    });

    const imported = db.bulkAddMenuItems(validItems);
    if (errors.length > 0) {
      db.saveImportErrors('menuItems', errors);
    }

    return {
      success: imported,
      errors,
      total: items.length,
    };
  }

  importDeliveriesFromJSON(filePath: string): ImportResult<any> {
    const errors: ImportError[] = [];
    const success: any[] = [];

    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawContent);
    const deliveries = Array.isArray(data) ? data : [data];

    deliveries.forEach((delivery, index) => {
      const rowNumber = index + 1;
      const itemErrors: string[] = [];
      const suggestions: string[] = [];

      if (!delivery.elderId || !db.getElderById(delivery.elderId)) {
        itemErrors.push('有效的老人ID不能为空');
        suggestions.push('请确认老人ID已存在于系统中');
      }
      if (!delivery.date) {
        itemErrors.push('配送日期不能为空');
        suggestions.push('请填写配送日期，格式如 YYYY-MM-DD');
      }
      if (!delivery.mealType || !['breakfast', 'lunch', 'dinner'].includes(delivery.mealType)) {
        itemErrors.push('餐次必须是 breakfast、lunch 或 dinner');
        suggestions.push('请修正餐次类型');
      }

      if (itemErrors.length === 0) {
        const existingPlans = db.getMealPlansByElderAndDate(delivery.elderId, delivery.date);
        const existingPlan = existingPlans.find(p => p.mealType === delivery.mealType);
        
        if (existingPlan) {
          const newDelivery = db.addDelivery({
            mealPlanId: existingPlan.id,
            elderId: delivery.elderId,
            date: delivery.date,
            route: delivery.route || db.getElderById(delivery.elderId)?.deliveryRoute || '',
            status: 'pending',
          });
          success.push(newDelivery);
        } else {
          itemErrors.push('该老人该日期该餐次尚无配餐计划');
          suggestions.push('请先为该老人创建配餐计划');
          errors.push({
            row: rowNumber,
            rawData: delivery,
            error: itemErrors.join('; '),
            suggestion: suggestions.join('; '),
          });
        }
      } else {
        errors.push({
          row: rowNumber,
          rawData: delivery,
          error: itemErrors.join('; '),
          suggestion: suggestions.join('; '),
        });
      }
    });

    if (errors.length > 0) {
      db.saveImportErrors('deliveries', errors);
    }

    return {
      success,
      errors,
      total: deliveries.length,
    };
  }

  getSampleElderCSV(): string {
    return `name,phone,address,dietaryRestrictions,chronicConditions,deliveryRoute,roomNumber
张奶奶,13800138001,幸福小区1号楼,低糖低盐,糖尿病;高血压,A线,101
李爷爷,13800138002,幸福小区2号楼,素食,高血糖,B线,203
王婆婆,13800138003,阳光花园3号楼,,痛风,A线,305`;
  }

  getSampleMenuJSON(): string {
    return JSON.stringify([
      {
        name: '燕麦粥配馒头',
        ingredients: ['燕麦', '面粉', '酵母'],
        isSuitableFor: {
          diabetes: true,
          hypertension: true,
          vegetarian: true,
        },
        price: 8,
        category: 'breakfast',
      },
      {
        name: '清蒸鱼配米饭',
        ingredients: ['鲈鱼', '大米', '姜', '葱'],
        isSuitableFor: {
          diabetes: true,
          hypertension: true,
          vegetarian: false,
        },
        price: 18,
        category: 'lunch',
      },
    ], null, 2);
  }
}

export const importer = new DataImporter();
