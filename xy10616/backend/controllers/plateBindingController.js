const DbHelper = require('../utils/dbHelper');

class PlateBindingController {
  static async createBinding(req, res) {
    try {
      const { plate_number, card_number, owner_name, phone, valid_from, valid_to, handler } = req.body;

      const existing = await DbHelper.get('SELECT id FROM plate_bindings WHERE plate_number = ?', [plate_number]);
      if (existing) {
        return res.status(400).json({ success: false, message: '该车牌已绑定' });
      }

      const result = await DbHelper.run(
        `INSERT INTO plate_bindings 
         (plate_number, card_number, owner_name, phone, valid_from, valid_to) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [plate_number, card_number, owner_name, phone, valid_from, valid_to]
      );

      await DbHelper.saveFlowRecord('plate_binding', result.id, 'create', null, { plate_number, card_number, owner_name }, handler || 'system');

      res.json({ success: true, data: { id: result.id, plate_number } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateBinding(req, res) {
    try {
      const { id } = req.params;
      const { card_number, owner_name, phone, valid_from, valid_to, status, handler } = req.body;

      const oldRecord = await DbHelper.get('SELECT * FROM plate_bindings WHERE id = ?', [id]);
      if (!oldRecord) {
        return res.status(404).json({ success: false, message: '记录不存在' });
      }

      const oldValue = {
        card_number: oldRecord.card_number,
        owner_name: oldRecord.owner_name,
        phone: oldRecord.phone,
        valid_from: oldRecord.valid_from,
        valid_to: oldRecord.valid_to,
        status: oldRecord.status
      };

      await DbHelper.run(
        `UPDATE plate_bindings 
         SET card_number = ?, owner_name = ?, phone = ?, valid_from = ?, valid_to = ?, status = ?, updated_at = ? 
         WHERE id = ?`,
        [card_number, owner_name, phone, valid_from, valid_to, status, new Date().toISOString(), id]
      );

      const newValue = { card_number, owner_name, phone, valid_from, valid_to, status };
      await DbHelper.saveFlowRecord('plate_binding', id, 'update', oldValue, newValue, handler || 'system');

      res.json({ success: true, message: '更新成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getBindings(req, res) {
    try {
      const { plate_number, status, page = 1, pageSize = 20 } = req.query;
      
      let sql = 'SELECT * FROM plate_bindings WHERE 1=1';
      let countSql = 'SELECT COUNT(*) as total FROM plate_bindings WHERE 1=1';
      let params = [];
      let countParams = [];

      if (plate_number) {
        sql += ' AND plate_number LIKE ?';
        countSql += ' AND plate_number LIKE ?';
        params.push(`%${plate_number}%`);
        countParams.push(`%${plate_number}%`);
      }

      if (status) {
        sql += ' AND status = ?';
        countSql += ' AND status = ?';
        params.push(status);
        countParams.push(status);
      }

      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

      const [list, countResult] = await Promise.all([
        DbHelper.all(sql, params),
        DbHelper.get(countSql, countParams)
      ]);

      res.json({ success: true, data: { list, total: countResult.total, page: parseInt(page), pageSize: parseInt(pageSize) } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getBindingDetail(req, res) {
    try {
      const { id } = req.params;
      const binding = await DbHelper.get('SELECT * FROM plate_bindings WHERE id = ?', [id]);
      
      if (!binding) {
        return res.status(404).json({ success: false, message: '记录不存在' });
      }

      const flowRecords = await DbHelper.all(
        'SELECT * FROM flow_records WHERE business_type = ? AND business_id = ? ORDER BY created_at DESC',
        ['plate_binding', id]
      );

      res.json({ success: true, data: { ...binding, flowRecords } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = PlateBindingController;
