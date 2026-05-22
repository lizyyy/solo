import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { matchService } from '../services/matchService';
import { batchService } from '../services/batchService';
import {
  parseCSV,
  parseJSON,
  transformPassengerRecord,
  transformDriverRecord,
  transformWarehouseRecord,
  transformRouteShift,
  transformImageIndex
} from '../utils/fileParser';
import { PassengerRecord, DriverRecord, WarehouseRecord, RouteShift, ImageIndex } from '../types';

export const matchController = {
  async uploadAndMatch(req: Request, res: Response) {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请上传至少一个文件'
        });
      }

      const duplicateCheck = batchService.checkDuplicate(files);
      if (duplicateCheck.isDuplicate && duplicateCheck.existingBatch) {
        return res.status(400).json({
          success: false,
          message: '检测到重复批次',
          duplicateError: batchService.createDuplicateError(duplicateCheck.existingBatch)
        });
      }

      let passengers: PassengerRecord[] = [];
      let drivers: DriverRecord[] = [];
      let warehouses: WarehouseRecord[] = [];
      let routeShifts: RouteShift[] = [];
      let imageIndexes: ImageIndex[] = [];

      for (const file of files) {
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (ext === '.json') {
          const jsonContent = await parseJSON<Record<string, any> | Record<string, any>[]>(file.path);
          
          const isArray = Array.isArray(jsonContent);
          const items: Record<string, any>[] = isArray ? jsonContent : [jsonContent];
          
          if (file.originalname.includes('route') || file.originalname.includes('线路') || file.originalname.includes('班次')) {
            routeShifts = items.map(transformRouteShift);
          } else if (file.originalname.includes('image') || file.originalname.includes('图片')) {
            imageIndexes = items.map(transformImageIndex);
          } else {
            if (items.length > 0) {
              const firstItem = items[0];
              if ('shiftTime' in firstItem || '发车时间' in firstItem) {
                routeShifts = items.map(transformRouteShift);
              } else if ('imagePath' in firstItem || '图片路径' in firstItem) {
                imageIndexes = items.map(transformImageIndex);
              }
            }
          }
        } else if (ext === '.csv') {
          const fileContent = await parseCSV<Record<string, any>>(file.path);
          
          if (file.originalname.includes('passenger') || file.originalname.includes('乘客')) {
            passengers = fileContent.map(transformPassengerRecord);
          } else if (file.originalname.includes('driver') || file.originalname.includes('司机')) {
            drivers = fileContent.map(transformDriverRecord);
          } else if (file.originalname.includes('warehouse') || file.originalname.includes('仓库')) {
            warehouses = fileContent.map(transformWarehouseRecord);
          } else {
            if (fileContent.length > 0) {
              const firstRow = fileContent[0];
              if ('乘客姓名' in firstRow || 'passengerName' in firstRow) {
                passengers = fileContent.map(transformPassengerRecord);
              } else if ('司机姓名' in firstRow || 'driverName' in firstRow) {
                drivers = fileContent.map(transformDriverRecord);
              } else if ('存放位置' in firstRow || 'storageLocation' in firstRow) {
                warehouses = fileContent.map(transformWarehouseRecord);
              }
            }
          }
        }
      }

      if (passengers.length === 0 && drivers.length === 0 && warehouses.length === 0) {
        return res.status(400).json({
          success: false,
          message: '未能识别任何有效数据，请检查文件格式'
        });
      }

      matchService.setData(passengers, drivers, warehouses, routeShifts, imageIndexes);
      const result = matchService.process();

      batchService.registerBatch(result.batchId, files);
      batchService.markBatchProcessed(result.batchId);

      for (const file of files) {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          console.warn('删除临时文件失败:', file.path);
        }
      }

      res.json({
        success: true,
        data: {
          batchId: result.batchId,
          processDate: result.processDate,
          statistics: result.statistics,
          metadata: {
            routeShiftsCount: routeShifts.length,
            imageIndexesCount: imageIndexes.length
          },
          normalItems: {
            count: result.normalItems.length,
            description: '匹配度高，可直接确认认领',
            items: result.normalItems
          },
          pendingItems: {
            count: result.pendingItems.length,
            description: '需要人工确认或缺少关联记录',
            items: result.pendingItems
          },
          failedItems: {
            count: result.failedItems.length,
            description: '匹配失败或不符合规则，保留原始数据和处理建议',
            items: result.failedItems
          }
        }
      });
    } catch (error) {
      console.error('处理失败:', error);
      res.status(500).json({
        success: false,
        message: '处理失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  },

  async getBatchHistory(req: Request, res: Response) {
    try {
      const history = batchService.getBatchHistory();
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取历史记录失败'
      });
    }
  },

  async healthCheck(req: Request, res: Response) {
    res.json({
      success: true,
      message: '失物匹配系统运行正常',
      timestamp: new Date().toISOString(),
      features: [
        '乘客报失-司机上交-仓库入库三方匹配',
        '同名物品智能识别',
        '逾期物品自动检测',
        '敏感信息自动脱敏',
        '重复批次防重机制',
        '线路班次数据验证',
        '图片索引关联支持',
        'CSV/JSON 混合格式支持'
      ]
    });
  }
};
