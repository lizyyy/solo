import express from 'express';
import * as services from './services';
import type { ApiResponse } from './types';

const router = express.Router();

function handleError(error: unknown): ApiResponse {
  const message = error instanceof Error ? error.message : '未知错误';
  return { success: false, error: message };
}

router.get('/synonym-groups', (req, res) => {
  try {
    const data = services.getSynonymGroups();
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/synonym-groups/:id', (req, res) => {
  try {
    const data = services.getSynonymGroupById(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: '同义词组不存在' } as ApiResponse);
      return;
    }
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/synonym-groups', (req, res) => {
  try {
    const data = services.createSynonymGroup(req.body);
    res.json({ success: true, data, message: '创建成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.put('/synonym-groups/:id', (req, res) => {
  try {
    const data = services.updateSynonymGroup(req.params.id, req.body);
    res.json({ success: true, data, message: '更新成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.put('/synonym-groups/:id/status', (req, res) => {
  try {
    const data = services.updateSynonymGroupStatus(
      req.params.id,
      req.body.status,
      req.body.reason
    );
    res.json({ success: true, data, message: '状态更新成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/synonym-groups/:id/versions', (req, res) => {
  try {
    const data = services.getSynonymVersions(req.params.id);
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/synonym-groups/:id/test-queries', (req, res) => {
  try {
    const data = services.getTestQueries(req.params.id);
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/synonym-groups/:id/test-queries', (req, res) => {
  try {
    const data = services.addTestQuery(req.params.id, req.body.query, req.body.expected_hits);
    res.json({ success: true, data, message: '添加成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/publish-batches', (req, res) => {
  try {
    const data = services.getPublishBatches();
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/publish-batches/:id', (req, res) => {
  try {
    const data = services.getPublishBatchById(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: '发布批次不存在' } as ApiResponse);
      return;
    }
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/publish-batches', (req, res) => {
  try {
    const data = services.createPublishBatch(req.body);
    res.json({ success: true, data, message: '创建成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/publish-batches/:id/items', (req, res) => {
  try {
    const data = services.getBatchItems(req.params.id);
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.put('/publish-batches/:id/status', (req, res) => {
  try {
    const data = services.updateBatchStatus(
      req.params.id,
      req.body.status,
      req.body.reason
    );
    res.json({ success: true, data, message: '状态更新成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/publish-batches/:id/simulate', (req, res) => {
  try {
    const data = services.simulatePublish(req.params.id);
    res.json({ success: true, data, message: '模拟完成' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/publish-batches/:id/publish', (req, res) => {
  try {
    const data = services.executePublish(req.params.id);
    res.json({ success: true, data, message: '发布成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/publish-batches/:id/rollback', (req, res) => {
  try {
    const data = services.rollbackBatch(req.params.id, req.body.reason);
    res.json({ success: true, data, message: '回滚成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/publish-batches/:id/hit-changes', (req, res) => {
  try {
    const data = services.getHitChanges(req.params.id);
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/publish-batches/:id/rollback-audits', (req, res) => {
  try {
    const data = services.getRollbackAudits(req.params.id);
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/publish-batches/:id/export', (req, res) => {
  try {
    const data = services.exportBatchData(req.params.id);
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/status-history/:entityType/:entityId', (req, res) => {
  try {
    const data = services.getStatusHistory(
      req.params.entityType as 'synonym_group' | 'publish_batch',
      req.params.entityId
    );
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

export default router;
