import express from 'express';
import {
  getMaterials,
  getMaterialById,
  getHistoryByMaterialId,
  createMaterial,
  updateMaterial,
  rejudgeMaterial,
  updateCadNote,
  updateChangeOrder,
  getMaterialStats,
  getHistoryAll,
} from '../services/materialService';
import type {
  RejudgeRequest,
  CadNoteRequest,
  ChangeOrderRequest,
  MaterialStatus,
} from '../../shared/types';

const router = express.Router();

router.get('/stats', (_req, res) => {
  res.json(getMaterialStats());
});

router.get('/', (req, res) => {
  const keyword = (req.query.keyword as string) || '';
  const status = req.query.status as MaterialStatus | undefined;
  const project = (req.query.project as string) || '';
  const layer = (req.query.layer as string) || '';
  const page = parseInt((req.query.page as string) || '1', 10);
  const pageSize = parseInt((req.query.pageSize as string) || '20', 10);
  res.json(getMaterials({ keyword, status, project, layer, page, pageSize }));
});

router.get('/:id', (req, res) => {
  const m = getMaterialById(req.params.id);
  if (!m) return res.status(404).json({ error: '材料不存在' });
  const history = getHistoryByMaterialId(req.params.id);
  res.json({ material: m, history });
});

router.post('/', (req, res) => {
  try {
    const operator = (req.body.operator as string) || '阿宁';
    const result = createMaterial(req.body, operator);
    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message || '创建失败' });
  }
});

router.put('/:id', (req, res) => {
  const operator = (req.body.operator as string) || '阿宁';
  const result = updateMaterial(req.params.id, req.body, operator);
  if (!result) return res.status(404).json({ error: '材料不存在' });
  res.json(result);
});

router.put('/:id/rejudge', (req, res) => {
  const { newStatus, reason, relatedLayer, collisionDesc, operator } = req.body as RejudgeRequest;
  if (!newStatus) return res.status(400).json({ error: '新状态必填' });
  if (!reason) return res.status(400).json({ error: '改判理由必填' });
  const result = rejudgeMaterial(req.params.id, newStatus, reason, relatedLayer || '', collisionDesc || '', operator || '阿宁');
  if (!result) return res.status(404).json({ error: '材料不存在' });
  res.json(result);
});

router.put('/:id/cad-note', (req, res) => {
  const { cadNote, cadJudgmentChange, operator } = req.body as CadNoteRequest;
  if (!cadNote && !cadJudgmentChange) {
    return res.status(400).json({ error: 'CAD备注或改变的判断至少填一项' });
  }
  const result = updateCadNote(req.params.id, cadNote || '', cadJudgmentChange || '', operator || '阿宁');
  if (!result) return res.status(404).json({ error: '材料不存在' });
  res.json(result);
});

router.put('/:id/change-order', (req, res) => {
  const { changeOrderNo, changeOrderReason, changeOrderImpact, operator } = req.body as ChangeOrderRequest;
  if (!changeOrderNo) return res.status(400).json({ error: '变更单号必填' });
  if (!changeOrderReason) return res.status(400).json({ error: '人工确认理由必填' });
  if (!changeOrderImpact) return res.status(400).json({ error: '影响范围必填' });
  const result = updateChangeOrder(
    req.params.id,
    changeOrderNo,
    changeOrderReason,
    changeOrderImpact,
    operator || '阿宁',
  );
  if (!result) return res.status(404).json({ error: '材料不存在' });
  res.json(result);
});

router.get('/:id/history', (req, res) => {
  const history = getHistoryByMaterialId(req.params.id);
  res.json(history);
});

export default router;
