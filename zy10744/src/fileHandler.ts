import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { Dish, StoreInventory, HeadquartersNotice, ShelfVerificationResult } from './types.js';

export class FileHandler {
  static async readJsonFile<T>(filePath: string): Promise<T> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      throw new Error(`读取文件失败 ${filePath}: ${(error as Error).message}`);
    }
  }

  static async writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      throw new Error(`写入文件失败 ${filePath}: ${(error as Error).message}`);
    }
  }

  static async readDishes(filePath: string): Promise<Dish[]> {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.json') {
      return this.readJsonFile<Dish[]>(filePath);
    } else if (ext === '.csv') {
      return this.readDishesCsv(filePath);
    }
    throw new Error(`不支持的文件格式: ${ext}`);
  }

  static async readDishesCsv(filePath: string): Promise<Dish[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    
    return records.map((record: any) => ({
      dishId: record.dishId || record['菜品ID'],
      dishName: record.dishName || record['菜品名称'],
      dishType: (record.dishType || record['菜品类型'] || '预制菜') as any,
      status: (record.status || record['状态'] || '上架') as any,
      scheduledOnTime: record.scheduledOnTime || record['定时上架时间'] || undefined,
      scheduledOffTime: record.scheduledOffTime || record['定时下架时间'] || undefined,
      isCombo: (record.isCombo || record['是否组合菜'] || 'false') === 'true',
      comboComponents: record.comboComponents || record['组合成分'] 
        ? (record.comboComponents || record['组合成分']).split(',').map((s: string) => s.trim())
        : undefined,
      category: record.category || record['分类'] || '',
      price: parseFloat(record.price || record['价格'] || '0')
    }));
  }

  static async readInventory(filePath: string): Promise<StoreInventory[]> {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.json') {
      return this.readJsonFile<StoreInventory[]>(filePath);
    } else if (ext === '.csv') {
      return this.readInventoryCsv(filePath);
    }
    throw new Error(`不支持的文件格式: ${ext}`);
  }

  static async readInventoryCsv(filePath: string): Promise<StoreInventory[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    
    return records.map((record: any) => ({
      storeId: record.storeId || record['门店ID'],
      storeName: record.storeName || record['门店名称'],
      dishId: record.dishId || record['菜品ID'],
      dishName: record.dishName || record['菜品名称'],
      stockQuantity: parseInt(record.stockQuantity || record['库存数量'] || '0'),
      unit: record.unit || record['单位'] || '份',
      lastUpdated: record.lastUpdated || record['更新时间'] || new Date().toISOString()
    }));
  }

  static async readNotices(filePath: string): Promise<HeadquartersNotice[]> {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.json') {
      return this.readJsonFile<HeadquartersNotice[]>(filePath);
    } else if (ext === '.csv') {
      return this.readNoticesCsv(filePath);
    }
    throw new Error(`不支持的文件格式: ${ext}`);
  }

  static async readNoticesCsv(filePath: string): Promise<HeadquartersNotice[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    
    return records.map((record: any) => ({
      noticeId: record.noticeId || record['通知ID'],
      noticeDate: record.noticeDate || record['通知日期'] || new Date().toISOString().split('T')[0],
      noticeType: (record.noticeType || record['通知类型'] || '下架通知') as any,
      targetDishIds: (record.targetDishIds || record['目标菜品ID'] || '').split(',').map((s: string) => s.trim()),
      reason: record.reason || record['原因'] || '',
      effectiveDate: record.effectiveDate || record['生效日期'] || new Date().toISOString().split('T')[0],
      effectiveStores: record.effectiveStores || record['生效门店'] 
        ? (record.effectiveStores || record['生效门店']).split(',').map((s: string) => s.trim())
        : undefined
    }));
  }

  static async writeVerificationResult(filePath: string, result: ShelfVerificationResult): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.json') {
      await this.writeJsonFile(filePath, result);
    } else if (ext === '.csv') {
      await this.writeVerificationResultCsv(filePath, result);
    } else {
      throw new Error(`不支持的文件格式: ${ext}`);
    }
  }

  static async writeVerificationResultCsv(filePath: string, result: ShelfVerificationResult): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    const affectedDishesRows = result.affectedDishes.flatMap(dish => 
      dish.affectedStores.map(store => ({
        核验ID: result.verificationId,
        核验日期: result.verificationDate,
        菜品ID: dish.dishId,
        菜品名称: dish.dishName,
        菜品类型: dish.dishType,
        影响等级: dish.impactLevel,
        下架原因: dish.reason,
        门店ID: store.storeId,
        门店名称: store.storeName,
        剩余库存: store.remainingStock,
        单位: store.unit,
        库存价值: store.stockValue.toFixed(2),
        影响组合菜: dish.relatedComboDishes.map(c => c.dishName).join('; '),
        定时上架信息: dish.scheduledInfo?.isScheduled ? (dish.scheduledInfo.scheduledTime || '是') : '否',
        定时冲突: dish.scheduledInfo?.conflictDescription || ''
      }))
    );

    const dishesCsvContent = stringify(affectedDishesRows, { header: true });
    
    const summaryRows = [{
      核验ID: result.verificationId,
      核验日期: result.verificationDate,
      受影响菜品总数: result.summary.totalAffectedDishes,
      受影响门店总数: result.summary.totalAffectedStores,
      总库存价值: result.summary.totalStockValue.toFixed(2),
      高影响菜品: result.summary.highImpactCount,
      中影响菜品: result.summary.mediumImpactCount,
      低影响菜品: result.summary.lowImpactCount,
      组合菜影响数: result.summary.comboDishImpactCount,
      定时上架冲突数: result.summary.scheduledConflictCount,
      问题数量: result.summary.issues.length
    }];
    const summaryCsvContent = stringify(summaryRows, { header: true });

    const issuesRows = result.summary.issues.map(issue => ({
      核验ID: result.verificationId,
      问题类型: issue.type,
      严重程度: issue.severity,
      问题描述: issue.message,
      菜品ID: issue.dishId || '',
      门店ID: issue.storeId || ''
    }));
    const issuesCsvContent = stringify(issuesRows, { header: true });

    const baseName = filePath.replace(ext, '');
    await fs.writeFile(`${baseName}_明细${ext}`, dishesCsvContent, 'utf-8');
    await fs.writeFile(`${baseName}_汇总${ext}`, summaryCsvContent, 'utf-8');
    await fs.writeFile(`${baseName}_问题${ext}`, issuesCsvContent, 'utf-8');
  }
}
