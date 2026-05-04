const express = require('express');
const morgan = require('morgan');
const path = require('path');
const config = require('../config');
const DatabaseManager = require('../db');
const Inspector = require('../core/inspector');
const { MarkdownExporter, JSONExporter } = require('../exporters');

class InspectorServer {
  constructor() {
    this.app = express();
    this.port = config.server.port;
    this.host = config.server.host;
    this.db = new DatabaseManager();
    this.inspector = new Inspector();
    this.markdownExporter = new MarkdownExporter();
    this.jsonExporter = new JSONExporter();
    
    this._setupMiddleware();
    this._setupRoutes();
    this._setupErrorHandlers();
  }
  
  _setupMiddleware() {
    this.app.use(morgan('combined'));
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      
      next();
    });
  }
  
  _setupRoutes() {
    const apiRouter = express.Router();
    
    apiRouter.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: config.app.version
      });
    });
    
    apiRouter.get('/inspections', (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const inspections = this.db.getInspections(limit, offset);
        
        res.json({
          success: true,
          data: {
            inspections,
            pagination: {
              limit,
              offset,
              count: inspections.length
            }
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    apiRouter.get('/inspections/:id', (req, res) => {
      try {
        const inspectionId = parseInt(req.params.id);
        
        const inspection = this.db.getInspectionById(inspectionId);
        if (!inspection) {
          return res.status(404).json({
            success: false,
            error: '巡检记录不存在'
          });
        }
        
        const risks = this.db.getRisksByInspection(inspectionId);
        const notes = this.db.getNotesByInspection(inspectionId);
        
        res.json({
          success: true,
          data: {
            inspection,
            risks,
            notes
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    apiRouter.post('/inspections', async (req, res) => {
      try {
        const { path: dirPath } = req.body;
        
        if (!dirPath) {
          return res.status(400).json({
            success: false,
            error: '缺少必要参数: path'
          });
        }
        
        const result = await this.inspector.inspect(dirPath);
        
        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    apiRouter.get('/inspections/:id/risks', (req, res) => {
      try {
        const inspectionId = parseInt(req.params.id);
        const risks = this.db.getRisksByInspection(inspectionId);
        
        res.json({
          success: true,
          data: {
            risks,
            count: risks.length
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    apiRouter.put('/risks/:id/resolve', (req, res) => {
      try {
        const riskId = parseInt(req.params.id);
        const result = this.db.resolveRisk(riskId);
        
        if (result.changes === 0) {
          return res.status(404).json({
            success: false,
            error: '风险记录不存在'
          });
        }
        
        res.json({
          success: true,
          data: {
            resolved: true,
            riskId
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    apiRouter.post('/inspections/:id/notes', (req, res) => {
      try {
        const inspectionId = parseInt(req.params.id);
        const { content, createdBy } = req.body;
        
        if (!content) {
          return res.status(400).json({
            success: false,
            error: '缺少必要参数: content'
          });
        }
        
        const noteId = this.db.createNote(inspectionId, {
          content,
          createdBy: createdBy || 'system'
        });
        
        res.json({
          success: true,
          data: {
            noteId,
            inspectionId,
            content,
            createdBy: createdBy || 'system'
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    apiRouter.get('/inspections/:id/notes', (req, res) => {
      try {
        const inspectionId = parseInt(req.params.id);
        const notes = this.db.getNotesByInspection(inspectionId);
        
        res.json({
          success: true,
          data: {
            notes,
            count: notes.length
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    apiRouter.get('/inspections/:id/export/markdown', (req, res) => {
      try {
        const inspectionId = parseInt(req.params.id);
        
        const inspection = this.db.getInspectionById(inspectionId);
        if (!inspection) {
          return res.status(404).json({
            success: false,
            error: '巡检记录不存在'
          });
        }
        
        const risks = this.db.getRisksByInspection(inspectionId);
        const notes = this.db.getNotesByInspection(inspectionId);
        
        const inspectionDetails = { inspection, risks, notes };
        
        const outputPath = path.join(
          process.cwd(),
          'exports',
          `inspection-${inspectionId}-${Date.now()}.md`
        );
        
        const result = this.markdownExporter.export(
          inspectionDetails,
          outputPath
        );
        
        this.db.createExport(inspectionId, 'markdown', outputPath);
        
        res.json({
          success: true,
          data: {
            type: 'markdown',
            path: result.path,
            size: result.size,
            generatedAt: result.generatedAt
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    apiRouter.get('/inspections/:id/export/json', (req, res) => {
      try {
        const inspectionId = parseInt(req.params.id);
        
        const inspection = this.db.getInspectionById(inspectionId);
        if (!inspection) {
          return res.status(404).json({
            success: false,
            error: '巡检记录不存在'
          });
        }
        
        const risks = this.db.getRisksByInspection(inspectionId);
        const notes = this.db.getNotesByInspection(inspectionId);
        
        const inspectionDetails = { inspection, risks, notes };
        
        const outputPath = path.join(
          process.cwd(),
          'exports',
          `inspection-${inspectionId}-${Date.now()}.json`
        );
        
        const result = this.jsonExporter.export(
          inspectionDetails,
          outputPath,
          this.db
        );
        
        this.db.createExport(inspectionId, 'json', outputPath);
        
        const download = req.query.download === 'true';
        if (download) {
          const jsonContent = this.jsonExporter.exportToBuffer(
            inspectionDetails,
            this.db
          );
          
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="inspection-${inspectionId}.json"`
          );
          res.setHeader('Content-Type', 'application/json');
          return res.send(jsonContent);
        }
        
        res.json({
          success: true,
          data: {
            type: 'json',
            path: result.path,
            size: result.size,
            generatedAt: result.generatedAt
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    apiRouter.get('/dashboard', (req, res) => {
      try {
        const recentInspections = this.db.getInspections(10, 0);
        
        let totalInspections = 0;
        let passedCount = 0;
        let failedCount = 0;
        let warningCount = 0;
        
        try {
          const countResult = this.db.db.prepare(
            'SELECT COUNT(*) as count FROM inspections'
          ).get();
          totalInspections = countResult.count;
        } catch (e) {
          totalInspections = recentInspections.length;
        }
        
        for (const inspection of recentInspections) {
          if (inspection.status === 'passed') passedCount++;
          else if (inspection.status === 'failed') failedCount++;
          else if (inspection.status === 'warning') warningCount++;
        }
        
        res.json({
          success: true,
          data: {
            summary: {
              totalInspections,
              recentPassed: passedCount,
              recentFailed: failedCount,
              recentWarning: warningCount
            },
            recentInspections
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    this.app.use('/api', apiRouter);
    
    this.app.get('/', (req, res) => {
      res.json({
        name: config.app.name,
        version: config.app.version,
        endpoints: {
          health: 'GET /api/health',
          dashboard: 'GET /api/dashboard',
          inspections: 'GET /api/inspections',
          inspectionDetail: 'GET /api/inspections/:id',
          createInspection: 'POST /api/inspections',
          inspectionRisks: 'GET /api/inspections/:id/risks',
          resolveRisk: 'PUT /api/risks/:id/resolve',
          createNote: 'POST /api/inspections/:id/notes',
          getNotes: 'GET /api/inspections/:id/notes',
          exportMarkdown: 'GET /api/inspections/:id/export/markdown',
          exportJson: 'GET /api/inspections/:id/export/json?download=true'
        }
      });
    });
  }
  
  _setupErrorHandlers() {
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: '接口不存在',
        path: req.path
      });
    });
    
    this.app.use((error, req, res, next) => {
      console.error('Server error:', error);
      res.status(500).json({
        success: false,
        error: '服务器内部错误',
        message: error.message
      });
    });
  }
  
  start() {
    this.server = this.app.listen(this.port, this.host, () => {
      console.log(`\n🎵 ${config.app.name} 服务已启动`);
      console.log(`📡 服务地址: http://${this.host}:${this.port}`);
      console.log(`📊 API 文档: http://${this.host}:${this.port}/`);
      console.log(`🔧 健康检查: http://${this.host}:${this.port}/api/health`);
      console.log(`\n`);
    });
    
    return this.server;
  }
  
  stop() {
    if (this.server) {
      this.server.close();
    }
    this.db.close();
  }
}

module.exports = InspectorServer;
