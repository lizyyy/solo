const fs = require('fs-extra');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const config = require('../config');
const db = require('../database/connection');

class ExportService {
  async exportToCsv(projectId = null, sceneId = null) {
    let sql = `
      SELECT
        lr.uuid,
        lr.name,
        lr.version,
        p.name as project_name,
        s.name as scene_name,
        lr.file_hash,
        lr.colorist,
        lr.notes,
        lr.status,
        lr.file_size,
        lr.created_at,
        lr.updated_at
      FROM lut_records lr
      LEFT JOIN projects p ON lr.project_id = p.id
      LEFT JOIN scenes s ON lr.scene_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (projectId) {
      sql += ' AND lr.project_id = ?';
      params.push(projectId);
    }
    if (sceneId) {
      sql += ' AND lr.scene_id = ?';
      params.push(sceneId);
    }

    sql += ' ORDER BY lr.created_at DESC';

    const records = await db.all(sql, params);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `lut_report_${timestamp}.csv`;
    const filePath = path.join(config.storage.exportDir, fileName);

    await fs.ensureDir(config.storage.exportDir);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'uuid', title: 'UUID' },
        { id: 'name', title: 'LUT名称' },
        { id: 'version', title: '版本' },
        { id: 'project_name', title: '项目' },
        { id: 'scene_name', title: '场景' },
        { id: 'file_hash', title: '文件哈希' },
        { id: 'colorist', title: '调色师' },
        { id: 'notes', title: '备注' },
        { id: 'status', title: '状态' },
        { id: 'file_size', title: '文件大小' },
        { id: 'created_at', title: '创建时间' },
        { id: 'updated_at', title: '更新时间' }
      ]
    });

    const csvData = records.map(r => ({
      ...r,
      file_size: this.formatFileSize(r.file_size)
    }));

    await csvWriter.writeRecords(csvData);

    return { filePath, fileName };
  }

  async exportFullReport(lutUuid) {
    const lut = await db.get(`
      SELECT
        lr.*,
        p.name as project_name,
        s.name as scene_name
      FROM lut_records lr
      LEFT JOIN projects p ON lr.project_id = p.id
      LEFT JOIN scenes s ON lr.scene_id = s.id
      WHERE lr.uuid = ?
    `, [lutUuid]);

    if (!lut) {
      throw new Error('LUT记录不存在');
    }

    const tags = await db.all('SELECT tag FROM lut_tags WHERE lut_id = ?', [lut.id]);
    const history = await db.all(`
      SELECT * FROM version_history WHERE lut_uuid = ? ORDER BY created_at DESC
    `, [lutUuid]);
    const logs = await db.all(`
      SELECT * FROM operation_logs WHERE lut_uuid = ? ORDER BY created_at DESC
    `, [lutUuid]);
    const conflicts = await db.all(`
      SELECT * FROM conflicts WHERE lut_uuid = ? ORDER BY created_at DESC
    `, [lutUuid]);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `lut_${lut.name}_${lut.version}_report_${timestamp}.json`;
    const filePath = path.join(config.storage.exportDir, fileName);

    await fs.ensureDir(config.storage.exportDir);

    const report = {
      basicInfo: {
        uuid: lut.uuid,
        name: lut.name,
        version: lut.version,
        project: lut.project_name,
        scene: lut.scene_name,
        colorist: lut.colorist,
        status: lut.status,
        fileHash: lut.file_hash,
        fileSize: lut.file_size,
        notes: lut.notes,
        createdAt: lut.created_at,
        updatedAt: lut.updated_at
      },
      tags: tags.map(t => t.tag),
      versionHistory: history,
      operationLogs: logs,
      conflicts: conflicts.map(c => ({
        ...c,
        details: JSON.parse(c.conflict_details)
      })),
      generatedAt: new Date().toISOString()
    };

    await fs.writeJson(filePath, report, { spaces: 2 });

    return { filePath, fileName };
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }
}

module.exports = new ExportService();
