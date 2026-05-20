import { Request, Response } from 'express';
import { DataStore } from '../models/DataStore';
import { ExportService } from '../services/ExportService';
import { RecordStatus, ExportOptions } from '../types';

export class QueryController {
  private dataStore: DataStore;
  private exportService: ExportService;

  constructor() {
    this.dataStore = DataStore.getInstance();
    this.exportService = new ExportService();
  }

  public queryRecords(req: Request, res: Response): void {
    try {
      const {
        filmName,
        hallName,
        settlementPeriod,
        startDate,
        endDate,
        status,
        contractId
      } = req.query;

      const queryParams = {
        filmName: filmName as string,
        hallName: hallName as string,
        settlementPeriod: settlementPeriod as string,
        startDate: startDate as string,
        endDate: endDate as string,
        status: status as RecordStatus,
        contractId: contractId as string
      };

      const records = this.dataStore.queryRecords(queryParams);
      const boundarySummary = this.exportService.getBoundarySummary(records);

      res.json({
        query: queryParams,
        total: records.length,
        boundarySummary: {
          totalRecords: boundarySummary.totalRecords,
          crossDayRecords: boundarySummary.crossDayCount,
          subsidyLimitRecords: boundarySummary.subsidyLimitCount,
          refundDeductionRecords: boundarySummary.refundDeductionCount,
          hasBoundaryCases: boundarySummary.boundaryRecords.length > 0
        },
        records: records.slice(0, 200),
        hasMoreRecords: records.length > 200
      });
    } catch (error) {
      res.status(500).json({ error: '查询记录失败', details: (error as Error).message });
    }
  }

  public getRecordDetail(req: Request, res: Response): void {
    try {
      const { recordId } = req.params;
      const record = this.dataStore.getRecord(recordId);

      if (!record) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }

      const boundaryExplanations = record.boundaryLogs.map(log => 
        this.exportService.processingService.getBoundaryExplanation(log)
      );

      res.json({
        record,
        boundaryExplanations,
        auditTrail: {
          created: record.createdAt,
          lastUpdated: record.updatedAt,
          currentHandler: record.currentHandler
        }
      });
    } catch (error) {
      res.status(500).json({ error: '获取记录详情失败', details: (error as Error).message });
    }
  }

  public exportRecords(req: Request, res: Response): void {
    try {
      const {
        filmName,
        hallName,
        settlementPeriod,
        startDate,
        endDate,
        status,
        contractId,
        format = 'csv',
        includeBoundaryDetails = 'true'
      } = req.query;

      const queryParams = {
        filmName: filmName as string,
        hallName: hallName as string,
        settlementPeriod: settlementPeriod as string,
        startDate: startDate as string,
        endDate: endDate as string,
        status: status as RecordStatus,
        contractId: contractId as string
      };

      const options: ExportOptions = {
        format: format as 'csv' | 'json',
        includeBoundaryDetails: includeBoundaryDetails === 'true'
      };

      const result = this.exportService.exportRecords(queryParams, options);

      if (result.count === 0) {
        res.status(404).json({ error: '没有符合条件的记录可导出' });
        return;
      }

      const contentType = options.format === 'csv' 
        ? 'text/csv; charset=utf-8'
        : 'application/json; charset=utf-8';

      const filename = `cinema-records-${new Date().toISOString().split('T')[0]}.${options.format}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Export-Count', result.count.toString());
      res.setHeader('X-Export-Summary', encodeURIComponent(result.querySummary));

      res.send(result.content);
    } catch (error) {
      res.status(500).json({ error: '导出记录失败', details: (error as Error).message });
    }
  }

  public createContract(req: Request, res: Response): void {
    try {
      const {
        filmName,
        effectiveStartDate,
        effectiveEndDate,
        subsidyRate,
        subsidyMaxAmount,
        refundDeductionRate,
        settlementCycle
      } = req.body;

      if (!filmName || !effectiveStartDate || !effectiveEndDate) {
        res.status(400).json({ error: '影片名称和生效日期不能为空' });
        return;
      }

      const contract = this.dataStore.addContract({
        filmName,
        effectiveStartDate,
        effectiveEndDate,
        subsidyRate: parseFloat(subsidyRate),
        subsidyMaxAmount: parseFloat(subsidyMaxAmount),
        refundDeductionRate: parseFloat(refundDeductionRate),
        settlementCycle
      });

      res.status(201).json({
        message: '合同创建成功',
        contract
      });
    } catch (error) {
      res.status(500).json({ error: '创建合同失败', details: (error as Error).message });
    }
  }

  public listContracts(req: Request, res: Response): void {
    try {
      const contracts = this.dataStore.listContracts();
      
      res.json({
        total: contracts.length,
        contracts
      });
    } catch (error) {
      res.status(500).json({ error: '获取合同列表失败', details: (error as Error).message });
    }
  }

  public getBoundaryStatistics(req: Request, res: Response): void {
    try {
      const allRecords = this.dataStore.queryRecords({});
      const summary = this.exportService.getBoundarySummary(allRecords);

      const pendingRecords = allRecords.filter(r => r.status === RecordStatus.PENDING);
      const approvedRecords = allRecords.filter(r => r.status === RecordStatus.APPROVED);
      const returnedRecords = allRecords.filter(r => r.status === RecordStatus.RETURNED);

      res.json({
        overall: {
          totalRecords: summary.totalRecords,
          pendingCount: pendingRecords.length,
          approvedCount: approvedRecords.length,
          returnedCount: returnedRecords.length
        },
        boundaryStatistics: {
          withBoundaryCases: summary.boundaryRecords.length,
          withoutBoundaryCases: summary.totalRecords - summary.boundaryRecords.length,
          crossDayCount: summary.crossDayCount,
          subsidyLimitCount: summary.subsidyLimitCount,
          refundDeductionCount: summary.refundDeductionCount
        },
        breakdown: {
          crossDayPercentage: summary.totalRecords > 0 
            ? ((summary.crossDayCount / summary.totalRecords) * 100).toFixed(1) + '%'
            : '0%',
          subsidyLimitPercentage: summary.totalRecords > 0 
            ? ((summary.subsidyLimitCount / summary.totalRecords) * 100).toFixed(1) + '%'
            : '0%',
          refundDeductionPercentage: summary.totalRecords > 0 
            ? ((summary.refundDeductionCount / summary.totalRecords) * 100).toFixed(1) + '%'
            : '0%'
        }
      });
    } catch (error) {
      res.status(500).json({ error: '获取统计信息失败', details: (error as Error).message });
    }
  }
}
