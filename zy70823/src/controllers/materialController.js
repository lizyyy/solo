const Database = require('../utils/db');

class MaterialController {
  static async processMaterial(req, res) {
    try {
      const { id } = req.params;
      const { action, handler, remark, status, is_out_of_stock } = req.body;

      if (!action || !handler) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数：action, handler'
        });
      }

      const material = await Database.get('SELECT * FROM materials WHERE id = ?', [id]);
      if (!material) {
        return res.status(404).json({
          success: false,
          message: '材料记录不存在'
        });
      }

      await Database.run(
        'INSERT INTO process_logs (material_id, action, handler, remark) VALUES (?, ?, ?, ?)',
        [id, action, handler, remark || '']
      );

      if (status || is_out_of_stock !== undefined) {
        const updateParams = [];
        const updateFields = [];
        
        if (status) {
          updateFields.push('status = ?');
          updateParams.push(status);
        }
        if (is_out_of_stock !== undefined) {
          updateFields.push('is_out_of_stock = ?');
          updateParams.push(is_out_of_stock ? 1 : 0);
        }
        updateFields.push('current_handler = ?');
        updateParams.push(handler);
        updateParams.push(id);

        await Database.run(
          `UPDATE materials SET ${updateFields.join(', ')} WHERE id = ?`,
          updateParams
        );

        if (status && status !== 'pending' && material.status === 'pending') {
          await Database.run(
            'UPDATE batches SET processed_count = processed_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [material.batch_id]
          );
        }
      }

      const updatedMaterial = await Database.get('SELECT * FROM materials WHERE id = ?', [id]);
      const logs = await Database.all('SELECT * FROM process_logs WHERE material_id = ? ORDER BY created_at', [id]);

      res.json({
        success: true,
        message: '处理记录已添加',
        material: updatedMaterial,
        process_logs: logs
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      });
    }
  }

  static async getMaterialTrace(req, res) {
    try {
      const { id } = req.params;

      const material = await Database.get('SELECT * FROM materials WHERE id = ?', [id]);
      if (!material) {
        return res.status(404).json({
          success: false,
          message: '材料记录不存在'
        });
      }

      const logs = await Database.all(
        'SELECT * FROM process_logs WHERE material_id = ? ORDER BY created_at ASC',
        [id]
      );

      res.json({
        success: true,
        material,
        process_trace: logs.map(log => ({
          action: log.action,
          handler: log.handler,
          remark: log.remark,
          time: log.created_at
        }))
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      });
    }
  }
}

module.exports = MaterialController;
