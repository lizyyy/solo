const database = require('../database');
const { generateId, now, AuditLog } = require('../utils');
const path = require('path');
const fs = require('fs');

class EvidenceService {
  addEvidence(repairOrderId, fileData, operator = 'system') {
    const { file_name, file_path, file_type, file_size, description } = fileData;

    if (!file_name || !file_path) {
      throw new Error('文件名和文件路径不能为空');
    }

    return database.runTransaction(() => {
      const order = database.prepare('SELECT * FROM repair_orders WHERE id = ?').get(repairOrderId);
      if (!order) {
        throw new Error('返修单不存在');
      }

      const id = generateId();
      const nowTime = now();

      database.prepare(`
        INSERT INTO evidence_attachments 
        (id, repair_order_id, file_name, file_path, file_type, file_size, uploaded_by, uploaded_at, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, repairOrderId, file_name, file_path, file_type || null, file_size || null, operator, nowTime, description || null);

      AuditLog.log('EVIDENCE', 'ADD', repairOrderId, operator, {
        evidence_id: id,
        file_name
      });

      return {
        id,
        repair_order_id: repairOrderId,
        file_name,
        file_type,
        file_size,
        uploaded_at: nowTime,
        uploaded_by: operator,
        description
      };
    });
  }

  getEvidences(repairOrderId) {
    return database.prepare('SELECT * FROM evidence_attachments WHERE repair_order_id = ? ORDER BY uploaded_at DESC').all(repairOrderId);
  }

  getEvidence(id) {
    return database.prepare('SELECT * FROM evidence_attachments WHERE id = ?').get(id);
  }

  deleteEvidence(id, operator = 'system') {
    return database.runTransaction(() => {
      const evidence = database.prepare('SELECT * FROM evidence_attachments WHERE id = ?').get(id);
      if (!evidence) {
        throw new Error('证据不存在');
      }

      database.prepare('DELETE FROM evidence_attachments WHERE id = ?').run(id);

      if (evidence.file_path && fs.existsSync(evidence.file_path)) {
        try {
          fs.unlinkSync(evidence.file_path);
        } catch (e) {
        }
      }

      AuditLog.log('EVIDENCE', 'DELETE', evidence.repair_order_id, operator, {
        evidence_id: id,
        file_name: evidence.file_name
      });

      return { success: true, message: '证据已删除' };
    });
  }
}

module.exports = new EvidenceService();
