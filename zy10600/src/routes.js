const express = require('express');
const router = express.Router();
const service = require('./service');
const { createObjectCsvStringifier: createCsvStringifier } = require('csv-writer');

router.post('/rotations', async (req, res) => {
  try {
    const id = await service.createRotation(req.body);
    res.json({ success: true, data: { id } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/rotations/:id', async (req, res) => {
  try {
    await service.updateRotation(req.params.id, req.body);
    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/rotations/:id/gray', async (req, res) => {
  try {
    const { operator } = req.body;
    await service.startGray(req.params.id, operator);
    res.json({ success: true, message: '开始灰度成功' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/rotations/:id/approve', async (req, res) => {
  try {
    const { operator } = req.body;
    await service.approveSwitch(req.params.id, operator);
    res.json({ success: true, message: '审核切换成功' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/rotations/:id/rollback', async (req, res) => {
  try {
    const { operator, remark } = req.body;
    await service.rollback(req.params.id, operator, remark);
    res.json({ success: true, message: '回滚成功' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/rotations', async (req, res) => {
  try {
    const result = await service.getList(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/rotations/:id', async (req, res) => {
  try {
    const result = await service.getDetail(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/rotations/:id/history', async (req, res) => {
  try {
    const result = await service.getHistory(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const data = await service.exportData(req.query);
    
    const csvWriter = createCsvStringifier({
      header: [
        { id: 'id', title: 'ID' },
        { id: 'app_key', title: '应用密钥' },
        { id: 'callback_url', title: '回调地址' },
        { id: 'old_signature_version', title: '旧签名版本' },
        { id: 'new_signature_version', title: '新签名版本' },
        { id: 'current_signature_version', title: '当前签名版本' },
        { id: 'status_text', title: '状态' },
        { id: 'fail_count', title: '失败次数' },
        { id: 'old_key_expire_time', title: '旧密钥过期时间' },
        { id: 'created_at', title: '创建时间' }
      ]
    });

    const csv = csvWriter.getHeaderString() + csvWriter.stringifyRecords(data);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=signature_rotations.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/callback-retry', async (req, res) => {
  try {
    const { app_key, signature_version, callback_url } = req.body;
    const rotationId = await service.recordCallbackRetry(app_key, signature_version, callback_url);
    if (rotationId) {
      await service.incrementFailCount(rotationId);
    }
    res.json({ success: true, data: { rotation_id: rotationId } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
