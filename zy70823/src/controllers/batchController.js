const Database = require('../utils/db');
const { generateMaterialFingerprint, generateBatchId, generateMaterialId } = require('../utils/fingerprint');

class BatchController {
  static async createBatch(req, res) {
    try {
      const { community_name, submitter, materials } = req.body;

      if (!community_name || !submitter || !materials || !Array.isArray(materials) || materials.length === 0) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数：community_name, submitter, materials'
        });
      }

      const fingerprint = generateMaterialFingerprint(materials);
      const existingBatch = await Database.get(
        'SELECT * FROM batches WHERE material_fingerprint = ?',
        [fingerprint]
      );

      if (existingBatch) {
        const existingMaterials = await Database.all(
          'SELECT * FROM materials WHERE batch_id = ?',
          [existingBatch.id]
        );
        return res.status(200).json({
          success: true,
          message: '检测到重复批次，返回原有处理结果',
          is_duplicate: true,
          batch: existingBatch,
          materials: existingMaterials
        });
      }

      const batchId = generateBatchId();
      await Database.run(
        'INSERT INTO batches (id, community_name, submitter, material_fingerprint, total_materials) VALUES (?, ?, ?, ?, ?)',
        [batchId, community_name, submitter, fingerprint, materials.length]
      );

      const materialPromises = materials.map(mat => {
        const matId = generateMaterialId();
        return Database.run(
          'INSERT INTO materials (id, batch_id, child_name, child_id_card, phone, original_appointment_date, target_vaccine, reschedule_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [matId, batchId, mat.child_name, mat.child_id_card, mat.phone, mat.original_appointment_date, mat.target_vaccine, mat.reschedule_reason]
        );
      });

      await Promise.all(materialPromises);

      const newBatch = await Database.get('SELECT * FROM batches WHERE id = ?', [batchId]);
      const newMaterials = await Database.all('SELECT * FROM materials WHERE batch_id = ?', [batchId]);

      res.status(201).json({
        success: true,
        message: '批次创建成功',
        is_duplicate: false,
        batch: newBatch,
        materials: newMaterials
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

  static async getBatch(req, res) {
    try {
      const { id } = req.params;
      const batch = await Database.get('SELECT * FROM batches WHERE id = ?', [id]);

      if (!batch) {
        return res.status(404).json({
          success: false,
          message: '批次不存在'
        });
      }

      const materials = await Database.all('SELECT * FROM materials WHERE batch_id = ?', [id]);
      const processLogs = await Database.all(
        `SELECT pl.*, m.child_name FROM process_logs pl 
         JOIN materials m ON pl.material_id = m.id 
         WHERE m.batch_id = ?`,
        [id]
      );

      res.json({
        success: true,
        batch,
        materials,
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

module.exports = BatchController;
