const { SHARE_VERSION_STATUS, BLACKLIST_STATUS } = require('./constants');
const { BusinessRuleError, ConflictError } = require('../utils/errors');

class VersionRules {
  static generateVersionNumber(existingVersions = []) {
    if (existingVersions.length === 0) {
      return '1.0.0';
    }

    const latestVersion = existingVersions
      .filter(v => v.status === SHARE_VERSION_STATUS.PUBLISHED)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

    if (!latestVersion) {
      return '1.0.0';
    }

    const parts = latestVersion.versionNumber.split('.').map(Number);
    parts[2] += 1;
    return parts.join('.');
  }

  static canPublish(currentStatus, hasChanges = false) {
    if (currentStatus === SHARE_VERSION_STATUS.PUBLISHED) {
      throw new ConflictError('该版本已发布，不能重复发布');
    }

    if (currentStatus === SHARE_VERSION_STATUS.ARCHIVED) {
      throw new ConflictError('已归档的版本不能发布');
    }

    if (!hasChanges) {
      throw new BusinessRuleError('当前版本没有任何变更，无法发布');
    }

    return true;
  }

  static canArchive(currentStatus) {
    if (currentStatus !== SHARE_VERSION_STATUS.PUBLISHED) {
      throw new ConflictError('只有已发布的版本才能归档');
    }
    return true;
  }

  static canDelete(currentStatus) {
    if (currentStatus === SHARE_VERSION_STATUS.PUBLISHED) {
      throw new ConflictError('已发布的版本不能删除，只能归档');
    }
    return true;
  }

  static compareVersions(version1, version2) {
    const parts1 = version1.split('.').map(Number);
    const parts2 = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 !== p2) {
        return p1 > p2 ? 1 : -1;
      }
    }
    return 0;
  }

  static calculateDiff(oldSnapshot, newSnapshot) {
    const oldMap = new Map(oldSnapshot.map(item => [item.memberIdentifier, item]));
    const newMap = new Map(newSnapshot.map(item => [item.memberIdentifier, item]));

    const added = [];
    const removed = [];
    const updated = [];
    const unchanged = [];

    for (const [id, newItem] of newMap) {
      const oldItem = oldMap.get(id);
      if (!oldItem) {
        added.push(newItem);
      } else if (oldItem.status !== newItem.status) {
        updated.push({
          before: oldItem,
          after: newItem,
        });
      } else {
        unchanged.push(newItem);
      }
    }

    for (const [id, oldItem] of oldMap) {
      if (!newMap.has(id)) {
        removed.push(oldItem);
      }
    }

    return {
      added,
      removed,
      updated,
      unchanged,
      summary: {
        total: newSnapshot.length,
        added: added.length,
        removed: removed.length,
        updated: updated.length,
        unchanged: unchanged.length,
      },
    };
  }

  static hasSignificantChanges(diff) {
    return (
      diff.added.length > 0 ||
      diff.removed.length > 0 ||
      diff.updated.length > 0
    );
  }

  static validateSnapshot(snapshot) {
    const requiredFields = ['memberIdentifier', 'status', 'source'];
    const validStatuses = Object.values(BLACKLIST_STATUS);

    for (let i = 0; i < snapshot.length; i++) {
      const item = snapshot[i];
      const missingFields = requiredFields.filter(f => !item[f]);

      if (missingFields.length > 0) {
        throw new BusinessRuleError(
          `快照第 ${i + 1} 条记录缺少必要字段: ${missingFields.join(', ')}`
        );
      }

      if (!validStatuses.includes(item.status)) {
        throw new BusinessRuleError(
          `快照第 ${i + 1} 条记录状态无效: ${item.status}`
        );
      }
    }

    return true;
  }
}

module.exports = VersionRules;
