const db = require('../database/connection');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const hashService = require('./hash.service');
const archiveService = require('./archive.service');
const conflictService = require('./conflict.service');

class LutService {
  async uploadLut(file, metadata, operator = 'system') {
    const { projectId, sceneId, name, version, colorist, notes, tags = [] } = metadata;

    if (!config.validation.versionPattern.test(version)) {
      throw new Error(`版本号格式错误，应为 v1.0 或 v1.0.0 格式: ${version}`);
    }

    const fileExt = path.extname(file.originalname).toLowerCase();
    if (!config.validation.allowedExtensions.includes(fileExt)) {
      throw new Error(`不支持的文件格式: ${fileExt}，仅支持: ${config.validation.allowedExtensions.join(', ')}`);
    }

    const fileHash = await hashService.calculateFileHash(file.path);

    const project = await db.get('SELECT id, name FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      throw new Error(`项目不存在: ${projectId}`);
    }

    if (sceneId) {
      const sceneConflict = await conflictService.detectProjectSceneConflict(projectId, sceneId);
      if (sceneConflict) {
        throw new Error(sceneConflict.message);
      }
    }

    const nameConflict = await conflictService.detectSameNameDifferentFile(projectId, name, version, fileHash);
    if (nameConflict) {
      throw new Error(nameConflict.message);
    }

    const versionConflict = await conflictService.detectVersionConflict(projectId, name, version);
    if (versionConflict && versionConflict.type === 'version_exists') {
      throw new Error(versionConflict.message);
    }

    const duplicates = await conflictService.detectDuplicateFile(fileHash);
    let conflictWarning = null;
    if (duplicates) {
      conflictWarning = {
        type: 'duplicate_file',
        message: '检测到相同文件内容已存在',
        duplicates: duplicates.map(d => ({
          uuid: d.uuid,
          name: d.name,
          version: d.version,
          project: d.project_name,
          scene: d.scene_name
        }))
      };
    }

    const lutUuid = uuidv4();
    const storagePath = path.join(config.storage.lutDir, `${lutUuid}${fileExt}`);
    await fs.move(file.path, storagePath);

    await db.beginTransaction();

    try {
      const result = await db.run(`
        INSERT INTO lut_records (
          uuid, project_id, scene_id, name, version, file_hash,
          file_path, file_size, file_extension, colorist, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        lutUuid, projectId, sceneId || null, name, version, fileHash,
        storagePath, file.size, fileExt, colorist || null, notes || null,
        versionConflict && versionConflict.type === 'version_rollback_warning'
          ? config.status.CONFLICT
          : config.status.ACTIVE
      ]);

      for (const tag of tags) {
        await db.run(`
          INSERT OR IGNORE INTO lut_tags (lut_id, tag) VALUES (?, ?)
        `, [result.lastID, tag]);
      }

      await this.logOperation({
        lutUuid,
        operationType: 'upload',
        statusBefore: null,
        statusAfter: config.status.ACTIVE,
        operator,
        details: JSON.stringify({ name, version, fileHash, tags })
      });

      if (conflictWarning) {
        await conflictService.recordConflict(lutUuid, conflictWarning.type, conflictWarning);
      }
      if (versionConflict && versionConflict.type === 'version_rollback_warning') {
        await conflictService.recordConflict(lutUuid, versionConflict.type, versionConflict);
      }

      await db.commit();

      return await this.getLutByUuid(lutUuid);
    } catch (error) {
      await db.rollback();
      await fs.remove(storagePath).catch(() => {});
      throw error;
    }
  }

  async overwriteVersion(file, metadata, operator = 'system') {
    const { projectId, sceneId, name, version, colorist, notes, reason } = metadata;

    const existing = await db.get(`
      SELECT * FROM lut_records
      WHERE project_id = ? AND name = ? AND version = ? AND status != ?
    `, [projectId, name, version, config.status.WITHDRAWN]);

    if (!existing) {
      throw new Error(`要覆盖的版本不存在: ${name}@${version}`);
    }

    const fileExt = path.extname(file.originalname).toLowerCase();
    if (!config.validation.allowedExtensions.includes(fileExt)) {
      throw new Error(`不支持的文件格式: ${fileExt}`);
    }

    const newFileHash = await hashService.calculateFileHash(file.path);
    if (existing.file_hash === newFileHash) {
      throw new Error('新旧文件内容相同，无需覆盖');
    }

    await db.beginTransaction();

    try {
      await archiveService.archiveVersion(existing, `overwritten_by_${operator}`);

      const newStoragePath = path.join(config.storage.lutDir, `${existing.uuid}${fileExt}`);
      await fs.move(file.path, newStoragePath, { overwrite: true });

      await this.recordVersionHistory({
        lutUuid: existing.uuid,
        previousVersion: version,
        newVersion: version,
        action: 'overwrite',
        operator,
        reason: reason || '版本覆盖'
      });

      await db.run(`
        UPDATE lut_records
        SET file_hash = ?, file_path = ?, file_size = ?, file_extension = ?,
            colorist = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE uuid = ?
      `, [
        newFileHash, newStoragePath, file.size, fileExt,
        colorist || existing.colorist, notes || existing.notes,
        existing.uuid
      ]);

      await this.logOperation({
        lutUuid: existing.uuid,
        operationType: 'overwrite',
        statusBefore: existing.status,
        statusAfter: existing.status,
        operator,
        details: JSON.stringify({
          previousHash: existing.file_hash,
          newHash: newFileHash,
          reason
        })
      });

      await db.commit();

      return await this.getLutByUuid(existing.uuid);
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async supplementLut(file, metadata, operator = 'system') {
    const { projectId, sceneId, name, version, colorist, notes, reason } = metadata;

    if (!reason) {
      throw new Error('补录必须提供原因');
    }

    const fileExt = path.extname(file.originalname).toLowerCase();
    if (!config.validation.allowedExtensions.includes(fileExt)) {
      throw new Error(`不支持的文件格式: ${fileExt}`);
    }

    const fileHash = await hashService.calculateFileHash(file.path);

    const duplicates = await conflictService.detectDuplicateFile(fileHash);
    if (duplicates) {
      throw new Error(`补录文件已存在于系统中，请检查: ${duplicates.map(d => d.name).join(', ')}`);
    }

    const lutUuid = uuidv4();
    const storagePath = path.join(config.storage.lutDir, `${lutUuid}${fileExt}`);
    await fs.move(file.path, storagePath);

    await db.beginTransaction();

    try {
      const result = await db.run(`
        INSERT INTO lut_records (
          uuid, project_id, scene_id, name, version, file_hash,
          file_path, file_size, file_extension, colorist, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        lutUuid, projectId, sceneId || null, name, version, fileHash,
        storagePath, file.size, fileExt, colorist || null, notes || null,
        config.status.ARCHIVED
      ]);

      await this.recordVersionHistory({
        lutUuid,
        previousVersion: null,
        newVersion: version,
        action: 'supplement',
        operator,
        reason
      });

      await this.logOperation({
        lutUuid,
        operationType: 'supplement',
        statusBefore: null,
        statusAfter: config.status.ARCHIVED,
        operator,
        details: JSON.stringify({ name, version, fileHash, reason })
      });

      await db.commit();

      return await this.getLutByUuid(lutUuid);
    } catch (error) {
      await db.rollback();
      await fs.remove(storagePath).catch(() => {});
      throw error;
    }
  }

  async withdrawLut(uuid, reason, operator = 'system') {
    const lut = await db.get('SELECT * FROM lut_records WHERE uuid = ?', [uuid]);
    if (!lut) {
      throw new Error(`LUT记录不存在: ${uuid}`);
    }

    if (lut.status === config.status.WITHDRAWN) {
      throw new Error('该LUT已被撤回');
    }

    await db.beginTransaction();

    try {
      await archiveService.archiveVersion(lut, `withdrawn_by_${operator}`);

      await db.run(`
        UPDATE lut_records
        SET status = ?, is_archive = 1, updated_at = CURRENT_TIMESTAMP
        WHERE uuid = ?
      `, [config.status.WITHDRAWN, uuid]);

      await this.recordVersionHistory({
        lutUuid: uuid,
        previousVersion: lut.version,
        newVersion: `${lut.version}-withdrawn`,
        action: 'withdraw',
        operator,
        reason: reason || '撤回'
      });

      await this.logOperation({
        lutUuid: uuid,
        operationType: 'withdraw',
        statusBefore: lut.status,
        statusAfter: config.status.WITHDRAWN,
        operator,
        details: JSON.stringify({ reason })
      });

      await db.commit();

      return await this.getLutByUuid(uuid);
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async getLutByUuid(uuid) {
    const lut = await db.get(`
      SELECT lr.*, p.name as project_name, s.name as scene_name
      FROM lut_records lr
      LEFT JOIN projects p ON lr.project_id = p.id
      LEFT JOIN scenes s ON lr.scene_id = s.id
      WHERE lr.uuid = ?
    `, [uuid]);

    if (!lut) return null;

    const tags = await db.all('SELECT tag FROM lut_tags WHERE lut_id = ?', [lut.id]);
    const history = await db.all(`
      SELECT * FROM version_history WHERE lut_uuid = ? ORDER BY created_at DESC
    `, [uuid]);
    const logs = await db.all(`
      SELECT * FROM operation_logs WHERE lut_uuid = ? ORDER BY created_at DESC
    `, [uuid]);
    const archives = await archiveService.listArchives(uuid);

    return {
      ...lut,
      tags: tags.map(t => t.tag),
      versionHistory: history,
      operationLogs: logs,
      archives
    };
  }

  async queryLuts(filters = {}) {
    let sql = `
      SELECT lr.*, p.name as project_name, s.name as scene_name
      FROM lut_records lr
      LEFT JOIN projects p ON lr.project_id = p.id
      LEFT JOIN scenes s ON lr.scene_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.projectId) {
      sql += ' AND lr.project_id = ?';
      params.push(filters.projectId);
    }
    if (filters.sceneId) {
      sql += ' AND lr.scene_id = ?';
      params.push(filters.sceneId);
    }
    if (filters.name) {
      sql += ' AND lr.name LIKE ?';
      params.push(`%${filters.name}%`);
    }
    if (filters.version) {
      sql += ' AND lr.version = ?';
      params.push(filters.version);
    }
    if (filters.status) {
      sql += ' AND lr.status = ?';
      params.push(filters.status);
    }
    if (filters.colorist) {
      sql += ' AND lr.colorist LIKE ?';
      params.push(`%${filters.colorist}%`);
    }
    if (filters.fileHash) {
      sql += ' AND lr.file_hash = ?';
      params.push(filters.fileHash);
    }

    sql += ' ORDER BY lr.created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }
    if (filters.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    return await db.all(sql, params);
  }

  async recordVersionHistory(data) {
    await db.run(`
      INSERT INTO version_history (lut_uuid, previous_version, new_version, action, operator, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [data.lutUuid, data.previousVersion, data.newVersion, data.action, data.operator, data.reason]);
  }

  async logOperation(data) {
    await db.run(`
      INSERT INTO operation_logs (
        lut_uuid, operation_type, status_before, status_after, operator, details, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      data.lutUuid || null,
      data.operationType,
      data.statusBefore,
      data.statusAfter,
      data.operator,
      data.details || null,
      data.ipAddress || null
    ]);
  }
}

module.exports = new LutService();
