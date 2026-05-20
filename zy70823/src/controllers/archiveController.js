const Database = require('../utils/db');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

class ArchiveController {
  static async triggerArchive(req, res) {
    try {
      const { batch_id, archived_by } = req.body;

      if (!batch_id || !archived_by) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数：batch_id, archived_by'
        });
      }

      const batch = await Database.get('SELECT * FROM batches WHERE id = ?', [batch_id]);
      if (!batch) {
        return res.status(404).json({
          success: false,
          message: '批次不存在'
        });
      }

      const materials = await Database.all('SELECT * FROM materials WHERE batch_id = ?', [batch_id]);
      
      const successCount = materials.filter(m => m.status === 'success' || m.status === 'completed').length;
      const failCount = materials.filter(m => m.status === 'failed').length;

      await Database.run(
        'INSERT INTO archives (batch_id, archived_by, total_records, success_count, fail_count) VALUES (?, ?, ?, ?, ?)',
        [batch_id, archived_by, materials.length, successCount, failCount]
      );

      await Database.run(
        'UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['archived', batch_id]
      );

      const archive = await Database.get('SELECT * FROM archives WHERE batch_id = ? ORDER BY archive_date DESC LIMIT 1', [batch_id]);

      res.json({
        success: true,
        message: '归档完成',
        archive: {
          ...archive,
          statistics: {
            total: materials.length,
            success: successCount,
            fail: failCount,
            pending: materials.length - successCount - failCount
          }
        }
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

  static async exportReport(req, res) {
    try {
      const { batch_id } = req.params;

      const batch = await Database.get('SELECT * FROM batches WHERE id = ?', [batch_id]);
      if (!batch) {
        return res.status(404).json({
          success: false,
          message: '批次不存在'
        });
      }

      const materials = await Database.all(`
        SELECT m.*, 
               (SELECT handler FROM process_logs WHERE material_id = m.id ORDER BY id DESC LIMIT 1) as last_handler
        FROM materials m 
        WHERE m.batch_id = ?`,
        [batch_id]
      );

      const processLogs = await Database.all(`
        SELECT pl.*, m.child_name 
        FROM process_logs pl 
        JOIN materials m ON pl.material_id = m.id 
        WHERE m.batch_id = ?`,
        [batch_id]
      );

      const outOfStockCount = materials.filter(m => m.is_out_of_stock === 1).length;
      const rescheduledCount = materials.filter(m => m.status === 'success' || m.status === 'completed').length;

      const exportDir = path.join(__dirname, '../../exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const filename = `疫苗预约改签报告_${batch.community_name}_${Date.now()}.csv`;
      const filePath = path.join(exportDir, filename);

      const csvWriter = createCsvWriter({
        path: filePath,
        header: [
          { id: 'child_name', title: '儿童姓名' },
          { id: 'child_id_card', title: '身份证号' },
          { id: 'phone', title: '联系电话' },
          { id: 'original_appointment_date', title: '原预约日期' },
          { id: 'target_vaccine', title: '目标疫苗' },
          { id: 'reschedule_reason', title: '改签原因' },
          { id: 'is_out_of_stock', title: '是否缺苗' },
          { id: 'status', title: '处理状态' },
          { id: 'last_handler', title: '最后处理人' },
          { id: 'created_at', title: '创建时间' }
        ]
      });

      const records = materials.map(m => ({
        ...m,
        is_out_of_stock: m.is_out_of_stock === 1 ? '是' : '否'
      }));

      await csvWriter.writeRecords(records);

      const statistics = {
        community_name: batch.community_name,
        submitter: batch.submitter,
        total_records: batch.total_materials,
        processed_count: batch.processed_count,
        out_of_stock_count: outOfStockCount,
        rescheduled_count: rescheduledCount,
        batch_status: batch.status,
        created_at: batch.created_at
      };

      res.json({
        success: true,
        message: '报告导出成功',
        download_url: `/exports/${filename}`,
        statistics: statistics,
        materials: materials,
        process_logs: processLogs
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

module.exports = ArchiveController;
