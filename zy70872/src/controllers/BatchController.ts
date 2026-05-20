import { Request, Response } from 'express';
import { DataStore } from '../models/DataStore';
import { ProcessingService } from '../services/ProcessingService';
import { FileParserService } from '../services/FileParserService';
import { ExportService } from '../services/ExportService';
import { RecordStatus, ExportOptions } from '../types';

export class BatchController {
  private dataStore: DataStore;
  private processingService: ProcessingService;
  private fileParserService: FileParserService;
  private exportService: ExportService;

  constructor() {
    this.dataStore = DataStore.getInstance();
    this.processingService = new ProcessingService();
    this.fileParserService = new FileParserService();
    this.exportService = new ExportService();
  }

  public createBatch(req: Request, res: Response): void {
    try {
      const { name, createdBy, settlementPeriod } = req.body;

      if (!name || !createdBy) {
        res.status(400).json({ error: '批次名称和创建人不能为空' });
        return;
      }

      const batch = this.dataStore.createBatch(name, createdBy, settlementPeriod);
      
      res.status(201).json({
        message: '批次创建成功',
        batch
      });
    } catch (error) {
      res.status(500).json({ error: '创建批次失败', details: (error as Error).message });
    }
  }

  public async uploadShowtimes(req: Request, res: Response): Promise<void> {
    try {
      const { batchId, handler } = req.body;

      if (!batchId || !handler) {
        res.status(400).json({ error: '批次ID和处理人不能为空' });
        return;
      }

      const batch = this.dataStore.getBatch(batchId);
      if (!batch) {
        res.status(404).json({ error: '批次不存在' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: '请上传场次CSV文件' });
        return;
      }

      const showtimes = await this.fileParserService.parseShowtimeCSV(req.file.buffer);
      const validation = this.fileParserService.validateShowtimeData(showtimes);

      if (!validation.valid) {
        res.status(400).json({ error: '数据验证失败', errors: validation.errors });
        return;
      }

      const result = this.processingService.processShowtimeBatch(batchId, showtimes, handler);

      res.json({
        message: '场次数据上传成功',
        totalCount: result.showtimes.length,
        crossDayCount: result.crossDayCount,
        crossDayWarning: result.crossDayCount > 0 
          ? `检测到 ${result.crossDayCount} 个跨日场次，请在处理记录时重点关注`
          : undefined
      });
    } catch (error) {
      res.status(500).json({ error: '上传场次数据失败', details: (error as Error).message });
    }
  }

  public uploadBoxOffice(req: Request, res: Response): void {
    try {
      const { batchId, handler } = req.body;

      if (!batchId || !handler) {
        res.status(400).json({ error: '批次ID和处理人不能为空' });
        return;
      }

      const batch = this.dataStore.getBatch(batchId);
      if (!batch) {
        res.status(404).json({ error: '批次不存在' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: '请上传票房JSON文件' });
        return;
      }

      const boxOffices = this.fileParserService.parseBoxOfficeJSON(req.file.buffer);
      const validation = this.fileParserService.validateBoxOfficeData(boxOffices);

      if (!validation.valid) {
        res.status(400).json({ error: '数据验证失败', errors: validation.errors });
        return;
      }

      const result = this.processingService.processBoxOfficeBatch(batchId, boxOffices, handler);

      const boundarySummary = this.exportService.getBoundarySummary(result.records);

      res.json({
        message: '票房数据上传成功，处理记录已生成',
        boxOfficeCount: result.boxOffices.length,
        recordCount: result.records.length,
        boundarySummary: {
          totalRecords: boundarySummary.totalRecords,
          crossDayRecords: boundarySummary.crossDayCount,
          subsidyLimitRecords: boundarySummary.subsidyLimitCount,
          refundDeductionRecords: boundarySummary.refundDeductionCount,
          hasBoundaryCases: boundarySummary.boundaryRecords.length > 0
        }
      });
    } catch (error) {
      res.status(500).json({ error: '上传票房数据失败', details: (error as Error).message });
    }
  }

  public approveRecord(req: Request, res: Response): void {
    try {
      const { recordId } = req.params;
      const { handler, remarks } = req.body;

      if (!handler) {
        res.status(400).json({ error: '处理人不能为空' });
        return;
      }

      const record = this.processingService.approveRecord(recordId, handler, remarks);
      
      if (!record) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }

      res.json({
        message: '记录已通过',
        record
      });
    } catch (error) {
      res.status(500).json({ error: '处理记录失败', details: (error as Error).message });
    }
  }

  public returnRecord(req: Request, res: Response): void {
    try {
      const { recordId } = req.params;
      const { handler, reason } = req.body;

      if (!handler || !reason) {
        res.status(400).json({ error: '处理人和退回原因不能为空' });
        return;
      }

      const record = this.processingService.returnRecord(recordId, handler, reason);
      
      if (!record) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }

      res.json({
        message: '记录已退回修改',
        record
      });
    } catch (error) {
      res.status(500).json({ error: '退回记录失败', details: (error as Error).message });
    }
  }

  public approveBatch(req: Request, res: Response): void {
    try {
      const { batchId } = req.params;
      const { handler } = req.body;

      if (!handler) {
        res.status(400).json({ error: '处理人不能为空' });
        return;
      }

      const batch = this.dataStore.getBatch(batchId);
      if (!batch) {
        res.status(404).json({ error: '批次不存在' });
        return;
      }

      const approvedRecords = this.processingService.approveBatch(batchId, handler);

      res.json({
        message: '批次处理完成',
        approvedCount: approvedRecords.length,
        batch: this.dataStore.getBatch(batchId)
      });
    } catch (error) {
      res.status(500).json({ error: '处理批次失败', details: (error as Error).message });
    }
  }

  public getBatch(req: Request, res: Response): void {
    try {
      const { batchId } = req.params;
      const batch = this.dataStore.getBatch(batchId);

      if (!batch) {
        res.status(404).json({ error: '批次不存在' });
        return;
      }

      const records = this.dataStore.getRecordsByBatch(batchId);
      const showtimes = this.dataStore.getShowtimesByBatch(batchId);
      const boxOffices = this.dataStore.getBoxOfficesByBatch(batchId);

      const boundarySummary = this.exportService.getBoundarySummary(records);

      res.json({
        batch,
        stats: {
          showtimeCount: showtimes.length,
          boxOfficeCount: boxOffices.length,
          recordCount: records.length,
          ...boundarySummary
        },
        records: records.slice(0, 100),
        hasMoreRecords: records.length > 100
      });
    } catch (error) {
      res.status(500).json({ error: '获取批次信息失败', details: (error as Error).message });
    }
  }

  public listBatches(req: Request, res: Response): void {
    try {
      const batches = this.dataStore.listBatches();
      
      res.json({
        total: batches.length,
        batches
      });
    } catch (error) {
      res.status(500).json({ error: '获取批次列表失败', details: (error as Error).message });
    }
  }
}
