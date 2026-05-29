const db = require('../database/connection');
const hashService = require('./hash.service');
const config = require('../config');

class ConflictService {
  async detectDuplicateFile(fileHash, excludeUuid = null) {
    let sql = `
      SELECT lr.*, p.name as project_name, s.name as scene_name
      FROM lut_records lr
      LEFT JOIN projects p ON lr.project_id = p.id
      LEFT JOIN scenes s ON lr.scene_id = s.id
      WHERE lr.file_hash = ? AND lr.status != ?
    `;
    const params = [fileHash, config.status.WITHDRAWN];

    if (excludeUuid) {
      sql += ' AND lr.uuid != ?';
      params.push(excludeUuid);
    }

    const duplicates = await db.all(sql, params);
    return duplicates.length > 0 ? duplicates : null;
  }

  async detectSameNameDifferentFile(projectId, name, version, fileHash) {
    const existing = await db.get(`
      SELECT * FROM lut_records
      WHERE project_id = ? AND name = ? AND version = ? AND status != ?
    `, [projectId, name, version, config.status.WITHDRAWN]);

    if (existing && existing.file_hash !== fileHash) {
      return {
        type: 'same_name_different_content',
        message: `项目中已存在同名但内容不同的LUT: ${name}@${version}`,
        existingRecord: existing
      };
    }
    return null;
  }

  async detectSceneMismatch(lutUuid, expectedSceneId) {
    const lut = await db.get(`
      SELECT lr.*, s.name as scene_name
      FROM lut_records lr
      LEFT JOIN scenes s ON lr.scene_id = s.id
      WHERE lr.uuid = ?
    `, [lutUuid]);

    if (!lut) return null;

    if (lut.scene_id && lut.scene_id !== expectedSceneId) {
      const expectedScene = await db.get('SELECT name FROM scenes WHERE id = ?', [expectedSceneId]);
      return {
        type: 'scene_mismatch',
        message: `场景不匹配: 当前场景"${lut.scene_name}"，期望场景"${expectedScene?.name || '未知'}"`,
        currentScene: { id: lut.scene_id, name: lut.scene_name },
        expectedScene: { id: expectedSceneId, name: expectedScene?.name }
      };
    }
    return null;
  }

  async detectVersionConflict(projectId, name, newVersion) {
    const existingVersions = await db.all(`
      SELECT version FROM lut_records
      WHERE project_id = ? AND name = ? AND status != ?
      ORDER BY created_at DESC
    `, [projectId, name, config.status.WITHDRAWN]);

    if (existingVersions.length === 0) return null;

    const versionNumbers = existingVersions.map(v => this.parseVersion(v.version));
    const newVersionNum = this.parseVersion(newVersion);

    if (versionNumbers.some(v => this.compareVersions(v, newVersionNum) === 0)) {
      return {
        type: 'version_exists',
        message: `版本 ${newVersion} 已存在`,
        existingVersions: existingVersions.map(v => v.version)
      };
    }

    const maxVersion = versionNumbers.reduce((max, v) =>
      this.compareVersions(v, max) > 0 ? v : max
    );

    if (this.compareVersions(newVersionNum, maxVersion) < 0) {
      return {
        type: 'version_rollback_warning',
        message: `警告: 新版本 ${newVersion} 低于当前最新版本 ${this.formatVersion(maxVersion)}`,
        latestVersion: this.formatVersion(maxVersion),
        newVersion
      };
    }

    return null;
  }

  async detectProjectSceneConflict(projectId, sceneId) {
    const scene = await db.get(`
      SELECT * FROM scenes WHERE id = ? AND project_id = ?
    `, [sceneId, projectId]);

    if (!scene) {
      const sceneInfo = await db.get('SELECT name, project_id FROM scenes WHERE id = ?', [sceneId]);
      if (sceneInfo) {
        const project = await db.get('SELECT name FROM projects WHERE id = ?', [sceneInfo.project_id]);
        return {
          type: 'scene_not_in_project',
          message: `场景"${sceneInfo.name}"属于项目"${project?.name}"，不属于当前项目`
        };
      }
      return {
        type: 'scene_not_found',
        message: `场景不存在`
      };
    }
    return null;
  }

  async recordConflict(lutUuid, conflictType, conflictDetails) {
    const result = await db.run(`
      INSERT INTO conflicts (lut_uuid, conflict_type, conflict_details)
      VALUES (?, ?, ?)
    `, [lutUuid, conflictType, JSON.stringify(conflictDetails)]);

    return result.lastID;
  }

  async resolveConflict(conflictId, resolvedBy, resolutionNote = '') {
    await db.run(`
      UPDATE conflicts
      SET resolved = 1, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP,
          conflict_details = json_patch(conflict_details, ?)
      WHERE id = ?
    `, [resolvedBy, JSON.stringify({ resolutionNote }), conflictId]);
  }

  async getConflicts(lutUuid = null, resolved = false) {
    let sql = `
      SELECT c.*, lr.name as lut_name, lr.version as lut_version
      FROM conflicts c
      LEFT JOIN lut_records lr ON c.lut_uuid = lr.uuid
      WHERE c.resolved = ?
    `;
    const params = [resolved ? 1 : 0];

    if (lutUuid) {
      sql += ' AND c.lut_uuid = ?';
      params.push(lutUuid);
    }

    sql += ' ORDER BY c.created_at DESC';

    return await db.all(sql, params);
  }

  parseVersion(versionStr) {
    const match = versionStr.match(/^v(\d+)\.(\d+)(?:\.(\d+))?$/);
    if (!match) return [0, 0, 0];
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]) || 0];
  }

  formatVersion(versionArr) {
    return `v${versionArr[0]}.${versionArr[1]}${versionArr[2] > 0 ? '.' + versionArr[2] : ''}`;
  }

  compareVersions(v1, v2) {
    for (let i = 0; i < 3; i++) {
      if (v1[i] > v2[i]) return 1;
      if (v1[i] < v2[i]) return -1;
    }
    return 0;
  }
}

module.exports = new ConflictService();
