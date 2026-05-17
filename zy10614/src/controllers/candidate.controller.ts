import { Request, Response } from 'express';
import { candidateService } from '../services/candidate.service';
import { importService } from '../services/import.service';
import { exportService } from '../services/export.service';
import { CandidateQuery, CandidateStatus, SourceChannel } from '../types';

export class CandidateController {
  async create(req: Request, res: Response) {
    try {
      const result = candidateService.createCandidate(req.body);
      res.status(201).json({
        success: true,
        data: result.candidate,
        message: result.conflicts.length > 0 
          ? `发现 ${result.conflicts.length} 个重复候选人，需审核处理` 
          : '创建成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '创建失败'
      });
    }
  }

  async get(req: Request, res: Response) {
    const { id } = req.params;
    const candidate = candidateService.getCandidate(id);
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: '候选人不存在'
      });
    }

    const history = candidateService.getMergeHistory(id);
    
    res.json({
      success: true,
      data: {
        candidate,
        mergeHistory: history
      }
    });
  }

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const candidate = candidateService.updateCandidate(id, req.body);
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: '候选人不存在'
      });
    }

    res.json({
      success: true,
      data: candidate
    });
  }

  async list(req: Request, res: Response) {
    const query: CandidateQuery = {
      status: req.query.status as CandidateStatus,
      sourceChannel: req.query.sourceChannel as SourceChannel,
      keyword: req.query.keyword as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 20
    };

    const result = candidateService.listCandidates(query);
    
    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize
      }
    });
  }

  async review(req: Request, res: Response) {
    try {
      const candidate = candidateService.reviewCandidate(req.body);
      
      if (!candidate) {
        return res.status(404).json({
          success: false,
          message: '候选人不存在'
        });
      }

      res.json({
        success: true,
        data: candidate,
        message: '审核成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '审核失败'
      });
    }
  }

  async getHistory(req: Request, res: Response) {
    const { id } = req.params;
    const history = candidateService.getMergeHistory(id);
    
    res.json({
      success: true,
      data: history
    });
  }

  async getAllHistory(req: Request, res: Response) {
    const history = candidateService.getAllMergeHistories();
    
    res.json({
      success: true,
      data: history
    });
  }

  async importCsv(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传CSV文件'
        });
      }

      const result = await importService.importFromCsv(req.file.originalname, req.file.buffer);
      
      res.json({
        success: true,
        data: result,
        message: `导入完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条`
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '导入失败'
      });
    }
  }

  async getImportRecords(req: Request, res: Response) {
    const records = importService.getAllImportRecords();
    
    res.json({
      success: true,
      data: records
    });
  }

  async getImportRecord(req: Request, res: Response) {
    const { id } = req.params;
    const record = importService.getImportRecord(id);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '导入记录不存在'
      });
    }

    res.json({
      success: true,
      data: record
    });
  }

  async exportCsv(req: Request, res: Response) {
    const query: CandidateQuery = {
      status: req.query.status as CandidateStatus,
      sourceChannel: req.query.sourceChannel as SourceChannel,
      keyword: req.query.keyword as string
    };

    const csv = exportService.exportToCsv(query);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=candidates_${Date.now()}.csv`);
      res.send(csv);
  }

  async exportJson(req: Request, res: Response) {
    const query: CandidateQuery = {
      status: req.query.status as CandidateStatus,
      sourceChannel: req.query.sourceChannel as SourceChannel,
      keyword: req.query.keyword as string
    };

    const data = exportService.exportToJson(query);
    
    res.json({
      success: true,
      data
    });
  }
}

export const candidateController = new CandidateController();
