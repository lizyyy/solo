const RecordModel = require('../models/recordModel');

const recordController = {
  create: function(req, res) {
    const data = req.body;

    if (!data.room_number || !data.resident_name || !data.phone || 
        !data.storage_type || !data.valid_from || !data.valid_to) {
      return res.status(400).json({ 
        error: '缺少必填字段', 
        required: ['room_number', 'resident_name', 'phone', 'storage_type', 'valid_from', 'valid_to']
      });
    }

    RecordModel.checkPendingByRoomAndPhone(data.room_number, data.phone, (err, existing) => {
      if (err) {
        return res.status(500).json({ error: '检查重复记录失败', details: err.message });
      }

      if (existing) {
        return res.status(409).json({ 
          error: '记录已存在', 
          message: `房号 ${data.room_number} 手机号 ${data.phone} 已有待领取的寄存记录，请先处理该记录`
        });
      }

      RecordModel.create(data, (err, result) => {
        if (err) {
          return res.status(500).json({ error: '创建记录失败', details: err.message });
        }
        res.status(201).json({ success: true, id: result.id });
      });
    });
  },

  search: function(req, res) {
    const filters = {
      room_number: req.query.room_number,
      phone: req.query.phone,
      status: req.query.status
    };

    RecordModel.checkAndMarkExpired((err, expiredResult) => {
      if (err) {
        console.log('过期检查警告:', err.message);
      }
    });

    RecordModel.search(filters, (err, records) => {
      if (err) {
        return res.status(500).json({ error: '查询失败', details: err.message });
      }
      res.json({ success: true, data: records });
    });
  },

  getById: function(req, res) {
    const id = req.params.id;

    RecordModel.findById(id, (err, record) => {
      if (err) {
        return res.status(500).json({ error: '查询失败', details: err.message });
      }
      if (!record) {
        return res.status(404).json({ error: '记录不存在' });
      }
      res.json({ success: true, data: record });
    });
  },

  updateStatus: function(req, res) {
    const id = req.params.id;
    const { status, received_by } = req.body;

    if (!status || !['已领取', '已过期'].includes(status)) {
      return res.status(400).json({ error: '无效的状态值，有效值：已领取、已过期' });
    }

    if (status === '已领取' && !received_by) {
      return res.status(400).json({ error: '领取时需要提供操作人姓名' });
    }

    RecordModel.findById(id, (err, record) => {
      if (err) {
        return res.status(500).json({ error: '查询记录失败', details: err.message });
      }
      if (!record) {
        return res.status(404).json({ error: '记录不存在' });
      }
      if (record.status !== '待领取') {
        return res.status(400).json({ error: `当前状态为 ${record.status}，无法更新` });
      }

      RecordModel.updateStatus(id, status, received_by || null, (err, result) => {
        if (err) {
          return res.status(500).json({ error: '更新状态失败', details: err.message });
        }
        res.json({ success: true, message: `状态已更新为 ${status}` });
      });
    });
  },

  checkExpired: function(req, res) {
    RecordModel.checkAndMarkExpired((err, result) => {
      if (err) {
        return res.status(500).json({ error: '过期检查失败', details: err.message });
      }
      res.json({ success: true, expired_count: result.count, affected_ids: result.ids || [] });
    });
  }
};

module.exports = recordController;
