const express = require('express');
const dirtyRecordModel = require('../models/dirtyRecord');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

router.get('/', requirePermission('view_dirty_records'), (req, res) => {
  try {
    const { page = 1, pageSize = 20, batch_id, status, error_type, source_type } = req.query;
    
    const result = dirtyRecordModel.listDirtyRecords(
      { batch_id, status, error_type, source_type },
      parseInt(page),
      parseInt(pageSize)
    );
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requirePermission('view_dirty_records'), (req, res) => {
  try {
    const record = dirtyRecordModel.getDirtyRecord(req.params.id);
    
    if (!record) {
      return res.status(404).json({ error: '脏记录不存在' });
    }
    
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/resolve', requirePermission('resolve_dirty_record'), (req, res) => {
  try {
    const { handling_opinion, status = 'resolved' } = req.body;
    
    if (!handling_opinion) {
      return res.status(400).json({ error: '处理意见不能为空' });
    }
    
    if (!['resolved', 'ignored'].includes(status)) {
      return res.status(400).json({ error: '状态只能是 resolved 或 ignored' });
    }
    
    const result = dirtyRecordModel.resolveDirtyRecord(
      parseInt(req.params.id),
      req.user.userId,
      handling_opinion,
      status
    );
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
