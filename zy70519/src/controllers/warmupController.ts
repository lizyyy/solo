import { Request, Response } from 'express';
import { WarmupService, NodeService, DataSourceService } from '../services/warmupService';
import { BatchStatus, KeyStatus, NodeStatus } from '../models/types';

export const WarmupController = {
  async createBatch(req: Request, res: Response) {
    try {
      const result = await WarmupService.createBatch(req.body);
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  async getBatch(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const result = await WarmupService.getBatchById(batchId);
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  },

  async listBatches(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const batches = await WarmupService.listBatches(limit, offset);
      res.json({
        success: true,
        data: batches
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  async startBatch(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const result = await WarmupService.startBatch(batchId);
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  async updateBatchStatus(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const { status } = req.body;
      
      if (!Object.values(BatchStatus).includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid batch status'
        });
      }

      await WarmupService.recalculateBatchCounts(batchId);
      const result = await WarmupService.getBatchById(batchId);
      
      res.json({
        success: true,
        data: result.batch
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  async updateKeyStatus(req: Request, res: Response) {
    try {
      const result = await WarmupService.updateKeyStatus(req.body);
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  async manualFix(req: Request, res: Response) {
    try {
      const result = await WarmupService.manualFix(req.body);
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  async getFailedKeys(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const failedKeys = await WarmupService.getFailedKeys(batchId);
      res.json({
        success: true,
        data: failedKeys
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  async getRetryRecords(req: Request, res: Response) {
    try {
      const { cacheKeyId } = req.params;
      const retryRecords = await WarmupService.getRetryRecords(cacheKeyId);
      res.json({
        success: true,
        data: retryRecords
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  async getReport(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const report = await WarmupService.generateReport(batchId);
      res.json({
        success: true,
        data: report
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  },

  async exportBatch(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const exportData = await WarmupService.exportBatchData(batchId);
      
      const format = req.query.format as string;
      if (format === 'csv') {
        const csvData = [
          Object.keys(exportData.records[0]).join(','),
          ...exportData.records.map(record => 
            Object.values(record).map(v => 
              typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
            ).join(',')
          )
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="warmup_batch_${batchId}.csv"`);
        res.send(csvData);
      } else {
        res.json({
          success: true,
          data: exportData
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

export const NodeController = {
  async registerNode(req: Request, res: Response) {
    try {
      const { name, ip } = req.body;
      const node = await NodeService.registerNode(name, ip);
      res.status(201).json({
        success: true,
        data: node
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  async heartbeat(req: Request, res: Response) {
    try {
      const { nodeId } = req.params;
      const node = await NodeService.heartbeat(nodeId);
      res.json({
        success: true,
        data: node
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  },

  async updateStatus(req: Request, res: Response) {
    try {
      const { nodeId } = req.params;
      const { status } = req.body;
      
      if (!Object.values(NodeStatus).includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid node status'
        });
      }
      
      const node = await NodeService.updateNodeStatus(nodeId, status);
      res.json({
        success: true,
        data: node
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  async listNodes(req: Request, res: Response) {
    try {
      const nodes = await NodeService.listNodes();
      res.json({
        success: true,
        data: nodes
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

export const DataSourceController = {
  async createDataSource(req: Request, res: Response) {
    try {
      const { name, type, config } = req.body;
      const dataSource = await DataSourceService.createDataSource(name, type, config);
      res.status(201).json({
        success: true,
        data: dataSource
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  async listDataSources(req: Request, res: Response) {
    try {
      const dataSources = await DataSourceService.listDataSources();
      res.json({
        success: true,
        data: dataSources
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};
