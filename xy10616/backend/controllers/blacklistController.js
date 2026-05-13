const DbHelper = require('../utils/dbHelper');

class BlacklistController {
  static async addToBlacklist(req, res) {
    try {
      const { plate_number, reason, created_by } = req.body;

      const existing = await DbHelper.get('SELECT id FROM blacklist WHERE plate_number = ? AND status = ?', [plate_number, 'active']);
      if (existing) {
        return res.status(400).json({ success: false, message: '该车牌已在黑名单中' });
      }

      const result = await DbHelper.run(
        `INSERT INTO blacklist (plate_number, reason, created_by) VALUES (?, ?, ?)`,
        [plate_number, reason, created_by]
      );

      await DbHelper.saveFlowRecord('blacklist', result.id, 'create', null, { plate_number, reason }, created_by);

      res.json({ success: true, data: { id: result.id, plate_number } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async removeFromBlacklist(req, res) {
    try {
      const { id } = req.params;
      const { reviewed_by, remarks } = req.body;

      const oldRecord = await DbHelper.get('SELECT * FROM blacklist WHERE id = ?', [id]);
      if (!oldRecord) {
        return res.status(404).json({ success: false, message: '记录不存在' });
      }

      const oldValue = { status: oldRecord.status };

      await DbHelper.run(
        `UPDATE blacklist SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`,
        ['inactive', reviewed_by, new Date().toISOString(), id]
      );

      const newValue = { status: 'inactive' };
      await DbHelper.saveFlowRecord('blacklist', id, 'review', oldValue, newValue, reviewed_by, remarks);

      res.json({ success: true, message: '黑名单解除复核完成' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getBlacklist(req, res) {
    try {
      const { plate_number, status, page = 1, pageSize = 20 } = req.query;
      
      let sql = 'SELECT * FROM blacklist WHERE 1=1';
      let countSql = 'SELECT COUNT(*) as total FROM blacklist WHERE 1=1';
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
}

module.exports = BlacklistController;
