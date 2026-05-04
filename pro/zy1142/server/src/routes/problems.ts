import { Router, Request, Response } from 'express';
import {
  getAllProblems,
  getProblemById,
  getProblemsByType,
  createProblem,
  updateProblem,
  deleteProblem,
  saveSolution,
  resetToSeeds,
} from '../data/dataStore';
import { validateAndSolve, solverConfigs, getDefaultParams } from '../physics/solverManager';
import { exportSolution } from '../export/exporter';
import { PhysicsProblemType, ExportOptions } from '../../../shared/types';

const router = Router();

router.get('/types', (req: Request, res: Response) => {
  const types = solverConfigs.map(config => ({
    type: config.type,
    label: config.label,
    description: config.description,
    defaultParams: config.defaultParams,
  }));
  res.json({ types });
});

router.get('/types/:type/defaults', (req: Request, res: Response) => {
  const { type } = req.params as { type: PhysicsProblemType };
  const defaults = getDefaultParams(type);
  
  if (!defaults || defaults.length === 0) {
    return res.status(404).json({ error: '未知的物理问题类型' });
  }
  
  res.json({ defaultParams: defaults });
});

router.get('/', (req: Request, res: Response) => {
  const { type } = req.query as { type?: PhysicsProblemType };
  
  let problems;
  if (type) {
    problems = getProblemsByType(type);
  } else {
    problems = getAllProblems();
  }
  
  res.json({ problems });
});

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const problem = getProblemById(id);
  
  if (!problem) {
    return res.status(404).json({ error: '题目未找到' });
  }
  
  res.json({ problem });
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { type, title, description, parameters, notes } = req.body;
    
    if (!type || !title || !description || !parameters) {
      return res.status(400).json({ error: '缺少必要字段' });
    }
    
    const problem = createProblem({
      type,
      title,
      description,
      parameters,
      notes,
    });
    
    res.status(201).json({ problem });
  } catch (error) {
    res.status(500).json({ error: '创建题目失败' });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, parameters, notes } = req.body;
    
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (parameters !== undefined) updates.parameters = parameters;
    if (notes !== undefined) updates.notes = notes;
    
    const problem = updateProblem(id, updates);
    
    if (!problem) {
      return res.status(404).json({ error: '题目未找到' });
    }
    
    res.json({ problem });
  } catch (error) {
    res.status(500).json({ error: '更新题目失败' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const success = deleteProblem(id);
  
  if (!success) {
    return res.status(404).json({ error: '题目未找到' });
  }
  
  res.json({ success: true });
});

router.post('/:id/solve', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { parameters } = req.body;
    
    const problem = getProblemById(id);
    
    if (!problem) {
      return res.status(404).json({ error: '题目未找到' });
    }
    
    const paramsToUse = parameters || problem.parameters;
    const result = validateAndSolve(id, problem.type, paramsToUse);
    
    if (!result.validation.valid) {
      return res.status(400).json({
        success: false,
        validation: result.validation,
      });
    }
    
    if (result.solution) {
      saveSolution(id, result.solution);
    }
    
    res.json({
      success: true,
      solution: result.solution,
      validation: result.validation,
    });
  } catch (error) {
    res.status(500).json({ error: '解题失败', details: error instanceof Error ? error.message : '未知错误' });
  }
});

router.post('/solve', (req: Request, res: Response) => {
  try {
    const { type, parameters } = req.body;
    
    if (!type || !parameters) {
      return res.status(400).json({ error: '缺少必要字段：type 或 parameters' });
    }
    
    const tempId = `temp-${Date.now()}`;
    const result = validateAndSolve(tempId, type, parameters);
    
    if (!result.validation.valid) {
      return res.status(400).json({
        success: false,
        validation: result.validation,
      });
    }
    
    res.json({
      success: true,
      solution: result.solution,
      validation: result.validation,
    });
  } catch (error) {
    res.status(500).json({ error: '解题失败', details: error instanceof Error ? error.message : '未知错误' });
  }
});

router.post('/:id/export', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { format = 'markdown', includeDerivations = true, includeTrajectory = false, includeDiagrams = false } = req.body as ExportOptions & { format: string };
    
    const problem = getProblemById(id);
    
    if (!problem) {
      return res.status(404).json({ error: '题目未找到' });
    }
    
    if (!problem.solution) {
      return res.status(400).json({ error: '该题目尚未求解，请先调用解题接口' });
    }
    
    const exportOptions: ExportOptions = {
      format: format as any,
      includeDerivations,
      includeTrajectory,
      includeDiagrams,
    };
    
    const content = exportSolution(problem, problem.solution, exportOptions);
    
    let contentType = 'text/plain';
    if (format === 'html') {
      contentType = 'text/html';
    } else if (format === 'json') {
      contentType = 'application/json';
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="problem-${id}.${format}"`);
    res.send(content);
  } catch (error) {
    res.status(500).json({ error: '导出失败', details: error instanceof Error ? error.message : '未知错误' });
  }
});

router.post('/reset', (req: Request, res: Response) => {
  try {
    const problems = resetToSeeds();
    res.json({ success: true, count: problems.length });
  } catch (error) {
    res.status(500).json({ error: '重置失败' });
  }
});

export default router;
