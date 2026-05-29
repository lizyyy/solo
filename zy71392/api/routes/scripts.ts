import express, { type Request, type Response } from 'express';
import scriptRepository from '../repositories/scriptRepository.js';
import parseService from '../services/parseService.js';
import permissionService from '../services/permissionService.js';
import riskService from '../services/riskService.js';
import type { CloudPlatform } from '../types/index.js';

const router = express.Router();

router.post('/import', (req: Request, res: Response) => {
  try {
    const { name, content, file_type, cloud_platform, existing_policy } = req.body;
    if (!content) {
      res.status(400).json({ success: false, error: '脚本内容不能为空' });
      return;
    }
    const script = scriptRepository.create({
      name: name || `script_${Date.now()}`,
      file_type: file_type || 'sh',
      content,
      cloud_platform: (cloud_platform as CloudPlatform) || 'aws',
      existing_policy_json: existing_policy ? JSON.stringify(existing_policy) : '[]',
    });
    parseService.parseScript(script.id);
    permissionService.derivePermissions(script.id);
    riskService.calculateScriptScore(script.id);
    res.json({ success: true, data: script });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', (_req: Request, res: Response) => {
  try {
    const scripts = scriptRepository.list();
    const enriched = scripts.map(s => {
      const risk = scriptRepository.getLatestRiskScore(s.id);
      const calls = scriptRepository.getApiCalls(s.id);
      return { ...s, risk_score: risk?.total_score || 0, api_call_count: calls.length };
    });
    res.json({ success: true, data: enriched });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const script = scriptRepository.getById(id);
    if (!script) {
      res.status(404).json({ success: false, error: '脚本不存在' });
      return;
    }
    const apiCalls = scriptRepository.getApiCalls(id);
    const runtimeLogs = scriptRepository.getRuntimeLogs(id);
    const permissions = scriptRepository.getPermissions(id);
    const riskScore = scriptRepository.getLatestRiskScore(id);
    res.json({
      success: true,
      data: {
        script,
        api_calls: apiCalls,
        runtime_logs: runtimeLogs,
        permissions,
        risk_score: riskScore,
      },
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    scriptRepository.delete(id);
    res.json({ success: true });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/parse', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const calls = parseService.parseScript(id);
    permissionService.derivePermissions(id);
    riskService.calculateScriptScore(id);
    res.json({ success: true, data: calls });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/runtime-log', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { content } = req.body;
    if (!content) {
      res.status(400).json({ success: false, error: '日志内容不能为空' });
      return;
    }
    const calls = parseService.parseRuntimeLog(id, content);
    permissionService.derivePermissions(id);
    riskService.calculateScriptScore(id);
    res.json({ success: true, data: calls });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/calls', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const calls = scriptRepository.getApiCalls(id);
    res.json({ success: true, data: calls });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/derive', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const diff = permissionService.derivePermissions(id);
    riskService.calculateScriptScore(id);
    res.json({ success: true, data: diff });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/permissions', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const diff = permissionService.getPermissionDiff(id);
    res.json({ success: true, data: diff });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/permissions', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    permissionService.applyMinimalPolicy(id);
    res.json({ success: true });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/risk-score', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const score = scriptRepository.getLatestRiskScore(id);
    if (score) {
      res.json({ success: true, data: { ...score, details: JSON.parse(score.details_json) } });
    } else {
      const newScore = riskService.calculateScriptScore(id);
      res.json({ success: true, data: { ...newScore, details: JSON.parse(newScore.details_json) } });
    }
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
