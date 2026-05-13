const { OperationLog, User, ModificationHistory } = require('../models');

class LogController {
  async getOperationLogs(req, res) {
    try {
      const { page = 1, pageSize = 10, module, userId, startDate, endDate } = req.query;

      const where = {};
      if (module) where.module = module;
      if (userId) where.user_id = userId;
      if (startDate && endDate) {
        where.created_at = {
          [require('sequelize').Op.between]: [startDate, endDate]
        };
      }

      const { count, rows } = await OperationLog.findAndCountAll({
        where,
        include: [{ model: User, as: 'User' }],
        order: [['created_at', 'DESC']],
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize)
      });

      res.json({
        data: rows,
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      });
    } catch (error) {
      console.error('获取操作日志失败:', error);
      res.status(500).json({ message: '获取失败', error: error.message });
    }
  }

  async getModificationHistory(req, res) {
    try {
      const { page = 1, pageSize = 10, table_name, record_id, modifiedBy, startDate, endDate } = req.query;

      const where = {};
      if (table_name) where.table_name = table_name;
      if (record_id) where.record_id = record_id;
      if (modifiedBy) where.modified_by = modifiedBy;
      if (startDate && endDate) {
        where.modified_at = {
          [require('sequelize').Op.between]: [startDate, endDate]
        };
      }

      const { count, rows } = await ModificationHistory.findAndCountAll({
        where,
        include: [{ model: User, as: 'User' }],
        order: [['modified_at', 'DESC']],
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize)
      });

      res.json({
        data: rows,
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      });
    } catch (error) {
      console.error('获取修改历史失败:', error);
      res.status(500).json({ message: '获取失败', error: error.message });
    }
  }
}

module.exports = new LogController();
