import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';
import { DatabaseService } from './database';
import { WallZone, Route, Hold, WearRecord, Feedback } from '../types';

interface ImportResult {
  success: boolean;
  count: number;
  errors: string[];
  message: string;
}

export class ImportService {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  async importWallZones(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      count: 0,
      errors: [],
      message: ''
    };

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      const zones = Array.isArray(data) ? data : (data.zones || data);

      if (!Array.isArray(zones)) {
        throw new Error('JSON 格式错误：需要包含 zones 数组或直接是数组格式');
      }

      for (const zone of zones) {
        try {
          const wallZone: Omit<WallZone, 'id'> = {
            name: zone.name || zone.zoneName || '未命名区域',
            code: zone.code || zone.zoneCode || `ZONE_${Date.now()}_${Math.random()}`,
            description: zone.description || '',
            x: zone.x || 0,
            y: zone.y || 0,
            width: zone.width || 100,
            height: zone.height || 100,
            difficultyRangeMin: zone.difficultyRangeMin ?? zone.minDifficulty ?? 0,
            difficultyRangeMax: zone.difficultyRangeMax ?? zone.maxDifficulty ?? 20
          };

          const existing = this.db.getWallZoneByCode(wallZone.code);
          if (existing) {
            this.db.saveWallZone({ ...wallZone, id: existing.id });
          } else {
            this.db.saveWallZone(wallZone);
          }
          result.count++;
        } catch (err: any) {
          result.errors.push(`区域 "${zone.name || zone.code}" 导入失败: ${err.message}`);
        }
      }

      result.success = result.errors.length === 0 || result.count > 0;
      result.message = `成功导入 ${result.count} 个墙面区域`;
      if (result.errors.length > 0) {
        result.message += `，${result.errors.length} 个失败`;
      }
    } catch (err: any) {
      result.errors.push(`文件读取或解析失败: ${err.message}`);
      result.message = '导入失败：' + err.message;
    }

    return result;
  }

  async importRoutes(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      count: 0,
      errors: [],
      message: ''
    };

    const routes: any[] = [];

    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => {
          routes.push(row);
        })
        .on('end', () => {
          for (const row of routes) {
            try {
              const route: Omit<Route, 'id' | 'createdAt' | 'updatedAt'> = {
                name: row.name || row.routeName || row.线路名称 || '未命名线路',
                code: row.code || row.routeCode || row.线路编号 || `R_${Date.now()}_${Math.random()}`,
                color: row.color || row.routeColor || row.线路颜色 || '#000000',
                difficulty: parseInt(row.difficulty || row.难度 || '0', 10),
                difficultyLabel: row.difficultyLabel || row.难度级别 || row.难度标签 || '',
                zoneCode: row.zoneCode || row.zone || row.区域代码 || row.区域 || '',
                holdPositions: row.holdPositions || row.点位 || row.抓点位置 || '[]',
                startPosition: row.startPosition || row.起点 || '',
                endPosition: row.endPosition || row.终点 || '',
                setDate: row.setDate || row.定线日期 || '',
                isChildrenRoute: (row.isChildrenRoute || row.儿童线路 || 'false').toString().toLowerCase() === 'true',
                notes: row.notes || row.备注 || ''
              };

              const existing = this.db.getRouteByCode(route.code);
              if (existing) {
                this.db.saveRoute({ ...route, id: existing.id, createdAt: existing.createdAt, updatedAt: '' });
              } else {
                this.db.saveRoute({ ...route, createdAt: '', updatedAt: '' });
              }
              result.count++;
            } catch (err: any) {
              result.errors.push(`线路 "${row.name || row.code}" 导入失败: ${err.message}`);
            }
          }

          result.success = result.errors.length === 0 || result.count > 0;
          result.message = `成功导入 ${result.count} 条线路`;
          if (result.errors.length > 0) {
            result.message += `，${result.errors.length} 个失败`;
          }
          resolve(result);
        })
        .on('error', (err) => {
          result.errors.push(`CSV 文件读取失败: ${err.message}`);
          result.message = '导入失败：' + err.message;
          resolve(result);
        });
    });
  }

  async importWearRecords(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      count: 0,
      errors: [],
      message: ''
    };

    const records: any[] = [];

    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => {
          records.push(row);
        })
        .on('end', () => {
          for (const row of records) {
            try {
              const holdCode = row.holdCode || row.hold || row.抓点代码 || row.抓点 || '';
              
              if (!holdCode) {
                result.errors.push('记录缺少抓点代码');
                continue;
              }

              let hold = this.db.getHoldByCode(holdCode);
              const currentUseCount = parseInt(row.useCount || row.使用次数 || '0', 10);
              
              if (!hold) {
                hold = {
                  code: holdCode,
                  name: row.holdName || '自动导入-' + holdCode,
                  type: row.type || 'unknown',
                  color: row.color || '#888888',
                  position: row.position || '',
                  x: parseFloat(row.x || '0'),
                  y: parseFloat(row.y || '0'),
                  installDate: row.installDate || row.安装日期 || '',
                  maxUseCount: parseInt(row.maxUseCount || '1000', 10),
                  currentUseCount: currentUseCount,
                  lastInspectionDate: row.recordDate || row.检查日期 || '',
                  status: 'active',
                  notes: ''
                };
                this.db.saveHold(hold);
              } else {
                if (currentUseCount > hold.currentUseCount) {
                  this.db.updateHoldUseCount(holdCode, currentUseCount);
                }
              }

              const record: Omit<WearRecord, 'id'> = {
                holdCode: holdCode,
                recordDate: row.recordDate || row.记录日期 || new Date().toISOString().split('T')[0],
                wearLevel: parseInt(row.wearLevel || row.磨损等级 || '0', 10),
                useCount: currentUseCount,
                inspector: row.inspector || row.检查人 || '',
                notes: row.notes || row.备注 || ''
              };

              this.db.saveWearRecord(record);
              result.count++;
            } catch (err: any) {
              result.errors.push(`磨损记录导入失败: ${err.message}`);
            }
          }

          result.success = result.errors.length === 0 || result.count > 0;
          result.message = `成功导入 ${result.count} 条磨损记录`;
          if (result.errors.length > 0) {
            result.message += `，${result.errors.length} 个失败`;
          }
          resolve(result);
        })
        .on('error', (err) => {
          result.errors.push(`CSV 文件读取失败: ${err.message}`);
          result.message = '导入失败：' + err.message;
          resolve(result);
        });
    });
  }

  async importFeedback(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      count: 0,
      errors: [],
      message: ''
    };

    const feedbacks: any[] = [];

    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => {
          feedbacks.push(row);
        })
        .on('end', () => {
          for (const row of feedbacks) {
            try {
              const feedback: Omit<Feedback, 'id'> = {
                memberId: row.memberId || row.会员ID || '',
                memberName: row.memberName || row.会员姓名 || '匿名',
                routeCode: row.routeCode || row.线路代码 || row.线路 || '',
                difficultyRating: parseInt(row.difficultyRating || row.难度评分 || '3', 10),
                enjoymentRating: parseInt(row.enjoymentRating || row.满意度 || '3', 10),
                comments: row.comments || row.反馈内容 || row.评论 || '',
                feedbackDate: row.feedbackDate || row.反馈日期 || new Date().toISOString(),
                hasIssues: (row.hasIssues || row.有问题 || 'false').toString().toLowerCase() === 'true',
                issueDetails: row.issueDetails || row.问题详情 || ''
              };

              if (!feedback.routeCode) {
                result.errors.push('反馈缺少线路代码');
                continue;
              }

              this.db.saveFeedback(feedback);
              result.count++;
            } catch (err: any) {
              result.errors.push(`反馈导入失败: ${err.message}`);
            }
          }

          result.success = result.errors.length === 0 || result.count > 0;
          result.message = `成功导入 ${result.count} 条会员反馈`;
          if (result.errors.length > 0) {
            result.message += `，${result.errors.length} 个失败`;
          }
          resolve(result);
        })
        .on('error', (err) => {
          result.errors.push(`CSV 文件读取失败: ${err.message}`);
          result.message = '导入失败：' + err.message;
          resolve(result);
        });
    });
  }
}
