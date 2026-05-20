import express from 'express';
import * as services from './services';
import type { ApiResponse } from './types';

const router = express.Router();

function handleError(error: unknown): ApiResponse {
  const message = error instanceof Error ? error.message : '未知错误';
  return { success: false, error: message };
}

router.get('/synonym-groups', async (req, res) => {
  try {
    const data = await services.getSynonymGroups();
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/synonym-groups/:id', async (req, res) => {
  try {
    const data = await services.getSynonymGroupById(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: '同义词组不存在' } as ApiResponse);
      return;
    }
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/synonym-groups', async (req, res) => {
  try {
    const data = await services.createSynonymGroup(req.body);
    res.json({ success: true, data, message: '创建成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.put('/synonym-groups/:id', async (req, res) => {
  try {
    const data = await services.updateSynonymGroup(req.params.id, req.body);
    res.json({ success: true, data, message: '更新成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.put('/synonym-groups/:id/status', async (req, res) => {
  try {
    const data = await services.updateSynonymGroupStatus(
      req.params.id,
      req.body.status,
      req.body.reason
    );
    res.json({ success: true, data, message: '状态更新成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/synonym-groups/:id/versions', async (req, res) => {
  try {
    const data = await services.getSynonymVersions(req.params.id);
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/synonym-groups/:id/test-queries', async (req, res) => {
  try {
    const data = await services.getTestQueries(req.params.id);
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/synonym-groups/:id/test-queries', async (req, res) => {
  try {
    const data = await services.addTestQuery(req.params.id, req.body.query, req.body.expected_hits);
    res.json({ success: true, data, message: '添加成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/publish-batches', async (req, res) => {
  try {
    const data = await services.getPublishBatches();
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/publish-batches/:id', async (req, res) => {
  try {
    const data = await services.getPublishBatchById(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: '发布批次不存在' } as ApiResponse);
      return;
    }
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/publish-batches', async (req, res) => {
  try {
    const data = await services.createPublishBatch(req.body);
    res.json({ success: true, data, message: '创建成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/publish-batches/:id/items', async (req, res) => {
  try {
    const data = await services.getBatchItems(req.params.id);
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.put('/publish-batches/:id/status', async (req, res) => {
  try {
    const data = await services.updateBatchStatus(
      req.params.id,
      req.body.status,
      req.body.reason
    );
    res.json({ success: true, data, message: '状态更新成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/publish-batches/:id/simulate', async (req, res) => {
  try {
    const data = await services.simulatePublish(req.params.id);
    res.json({ success: true, data, message: '模拟完成' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/publish-batches/:id/publish', async (req, res) => {
  try {
    const data = await services.executePublish(req.params.id);
    res.json({ success: true, data, message: '发布成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/publish-batches/:id/rollback', async (req, res) => {
  try {
    const data = await services.rollbackBatch(req.params.id, req.body.reason);
    res.json({ success: true, data, message: '回滚成功' } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/publish-batches/:id/hit-changes', async (req, res) => {
  try {
    const data = await services.getHitChanges(req.params.id);
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/publish-batches/:id/rollback-audits', async (req, res) => {
  try {
    const data = await services.getRollbackAudits(req.params.id);
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/publish-batches/:id/export', async (req, res) => {
  try {
    const data = await services.exportBatchData(req.params.id);
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/status-history/:entityType/:entityId', async (req, res) => {
  try {
    const data = await services.getStatusHistory(
      req.params.entityType as 'synonym_group' | 'publish_batch',
      req.params.entityId
    );
    res.json({ success: true, data } as ApiResponse);
  } catch (error) {
    res.json(handleError(error));
  }
});

export default router;
