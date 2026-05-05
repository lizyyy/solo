import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../services/databaseService.js';
import { HydraulicCalculator } from '../services/hydraulicCalculator.js';
import { DataImporter } from '../services/dataImporter.js';
import { ExportService } from '../services/exportService.js';
import { createSampleProject } from '../utils/sampleData.js';
import { Project, Valve } from '../models/types.js';

export class ProjectController {
  private dbService: DatabaseService;
  private calculator: HydraulicCalculator;
  private importer: DataImporter;
  private exporter: ExportService;

  constructor(
    dbService: DatabaseService,
    calculator: HydraulicCalculator,
    importer: DataImporter,
    exporter: ExportService
  ) {
    this.dbService = dbService;
    this.calculator = calculator;
    this.importer = importer;
    this.exporter = exporter;
  }

  async getAllProjects(req: Request, res: Response): Promise<void> {
    try {
      const projects = await this.dbService.getAllProjects();
      res.json({
        success: true,
        data: projects.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          nodeCount: p.nodes.length,
          pipeCount: p.pipes.length,
          valveCount: p.valves.length,
          hasCalculation: !!p.lastCalculationResult,
        })),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取项目列表失败',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getProject(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const project = await this.dbService.getProject(id);

      if (!project) {
        res.status(404).json({
          success: false,
          message: '项目不存在',
        });
        return;
      }

      res.json({
        success: true,
        data: project,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取项目失败',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async createProject(req: Request, res: Response): Promise<void> {
    try {
      const { name, description } = req.body;
      const now = new Date().toISOString();

      const project: Project = {
        id: uuidv4(),
        name: name || '新建项目',
        description: description || '',
        createdAt: now,
        updatedAt: now,
        nodes: [],
        pipes: [],
        valves: [],
        pumpCurve: {
          id: 'default-pump',
          name: '默认水泵',
          points: [
            { flowRate: 0, head: 30 },
            { flowRate: 50, head: 25 },
            { flowRate: 100, head: 18 },
            { flowRate: 150, head: 10 },
          ],
          maxFlowRate: 150,
          maxHead: 30,
        },
        temperatureData: [],
        userNotes: '',
      };

      await this.dbService.saveProject(project);

      res.status(201).json({
        success: true,
        message: '项目创建成功',
        data: project,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '创建项目失败',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async createSampleProject(req: Request, res: Response): Promise<void> {
    try {
      const project = createSampleProject();
      await this.dbService.saveProject(project);

      res.status(201).json({
        success: true,
        message: '示例项目创建成功',
        data: project,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '创建示例项目失败',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async updateProject(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const existingProject = await this.dbService.getProject(id);
      if (!existingProject) {
        res.status(404).json({
          success: false,
          message: '项目不存在',
        });
        return;
      }

      const updatedProject: Project = {
        ...existingProject,
        ...updateData,
        updatedAt: new Date().toISOString(),
      };

      await this.dbService.saveProject(updatedProject);

      res.json({
        success: true,
        message: '项目更新成功',
        data: updatedProject,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '更新项目失败',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async deleteProject(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.dbService.deleteProject(id);

      if (!success) {
        res.status(404).json({
          success: false,
          message: '项目不存在',
        });
        return;
      }

      res.json({
        success: true,
        message: '项目删除成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '删除项目失败',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async importData(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.body;

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: '请上传文件',
        });
        return;
      }

      let importResult;
      const buffer = req.file.buffer;
      const originalName = req.file.originalname.toLowerCase();

      if (originalName.endsWith('.json')) {
        const jsonStr = buffer.toString('utf-8');
        importResult = this.importer.importFromJSON(jsonStr);
      } else if (originalName.endsWith('.xlsx') || originalName.endsWith('.xls')) {
        importResult = this.importer.importFromExcel(buffer);
      } else {
        res.status(400).json({
          success: false,
          message: '不支持的文件格式，请上传JSON或Excel文件',
        });
        return;
      }

      if (!importResult.success) {
        res.status(400).json({
          success: false,
          message: importResult.message,
          errors: importResult.errors,
          warnings: importResult.warnings,
        });
        return;
      }

      if (projectId) {
        const existingProject = await this.dbService.getProject(projectId);
        if (existingProject && importResult.data) {
          const updatedProject: Project = {
            ...existingProject,
            nodes: importResult.data.nodes || existingProject.nodes,
            pipes: importResult.data.pipes || existingProject.pipes,
            valves: importResult.data.valves || existingProject.valves,
            pumpCurve: importResult.data.pumpCurve || existingProject.pumpCurve,
            temperatureData: importResult.data.temperatureData || existingProject.temperatureData,
            updatedAt: new Date().toISOString(),
          };
          await this.dbService.saveProject(updatedProject);

          res.json({
            success: true,
            message: importResult.message,
            warnings: importResult.warnings,
            data: updatedProject,
          });
          return;
        }
      }

      res.json({
        success: true,
        message: importResult.message,
        warnings: importResult.warnings,
        data: importResult.data,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '导入数据失败',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async calculate(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const project = await this.dbService.getProject(projectId);

      if (!project) {
        res.status(404).json({
          success: false,
          message: '项目不存在',
        });
        return;
      }

      if (project.nodes.length === 0 || project.pipes.length === 0) {
        res.status(400).json({
          success: false,
          message: '项目数据不完整，请先导入节点和管道数据',
        });
        return;
      }

      const result = this.calculator.calculate(
        project.nodes,
        project.pipes,
        project.valves,
        project.pumpCurve,
        project.temperatureData,
        project.id
      );

      await this.dbService.saveCalculationResult(result);

      const updatedProject: Project = {
        ...project,
        lastCalculationResult: result,
        updatedAt: new Date().toISOString(),
      };
      await this.dbService.saveProject(updatedProject);

      res.json({
        success: true,
        message: '计算完成',
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '计算失败',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getCalculationHistory(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const results = await this.dbService.getCalculationResults(projectId);

      res.json({
        success: true,
        data: results.map(r => ({
          id: r.id,
          timestamp: r.timestamp,
          totalFlowRate: r.totalFlowRate,
          systemPressureDrop: r.systemPressureDrop,
          abnormalCount: r.abnormalData.length,
          suggestionCount: r.suggestions.length,
        })),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取计算历史失败',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async exportMarkdown(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const project = await this.dbService.getProject(projectId);

      if (!project) {
        res.status(404).json({
          success: false,
          message: '项目不存在',
        });
        return;
      }

      let result = project.lastCalculationResult;
      if (!result) {
        result = await this.dbService.getLatestCalculationResult(projectId);
      }

      if (!result) {
        res.status(400).json({
          success: false,
          message: '请先执行水力平衡计算',
        });
        return;
      }

      const markdown = this.exporter.generateMarkdownReport(project, result);

      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="调平建议_${project.name}.md"`);
      res.send(markdown);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '导出Markdown失败',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async exportJSON(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const project = await this.dbService.getProject(projectId);

      if (!project) {
        res.status(404).json({
          success: false,
          message: '项目不存在',
        });
        return;
      }

      let result = project.lastCalculationResult;
      if (!result) {
        result = await this.dbService.getLatestCalculationResult(projectId);
      }

      if (!result) {
        res.status(400).json({
          success: false,
          message: '请先执行水力平衡计算',
        });
        return;
      }

      const jsonData = this.exporter.generateJSONExport(project, result);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="计算明细_${project.name}.json"`);
      res.send(jsonData);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '导出JSON失败',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async downloadExcelTemplate(req: Request, res: Response): Promise<void> {
    try {
      const buffer = this.exporter.generateExcelTemplate();

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="数据导入模板.xlsx"');
      res.send(Buffer.from(buffer));
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '生成模板失败',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async updateValve(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, valveId } = req.params;
      const { opening, notes } = req.body;

      const project = await this.dbService.getProject(projectId);
      if (!project) {
        res.status(404).json({
          success: false,
          message: '项目不存在',
        });
        return;
      }

      const valveIndex = project.valves.findIndex(v => v.id === valveId);
      if (valveIndex === -1) {
        res.status(404).json({
          success: false,
          message: '阀门不存在',
        });
        return;
      }

      project.valves[valveIndex] = {
        ...project.valves[valveIndex],
        opening: opening !== undefined ? Math.max(0, Math.min(100, opening)) : project.valves[valveIndex].opening,
        notes: notes !== undefined ? notes : project.valves[valveIndex].notes,
      };

      project.updatedAt = new Date().toISOString();
      await this.dbService.saveProject(project);

      res.json({
        success: true,
        message: '阀门更新成功',
        data: project.valves[valveIndex],
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '更新阀门失败',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async saveUserNotes(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { notes } = req.body;

      const project = await this.dbService.getProject(projectId);
      if (!project) {
        res.status(404).json({
          success: false,
          message: '项目不存在',
        });
        return;
      }

      project.userNotes = notes || '';
      project.updatedAt = new Date().toISOString();
      await this.dbService.saveProject(project);

      res.json({
        success: true,
        message: '备注保存成功',
        data: { userNotes: project.userNotes },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '保存备注失败',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
