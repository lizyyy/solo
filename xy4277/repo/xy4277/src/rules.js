const _ = require('lodash');

const RISK_LEVELS = {
  CRITICAL: { level: 'CRITICAL', value: 100, label: '严重' },
  HIGH: { level: 'HIGH', value: 75, label: '高' },
  MEDIUM: { level: 'MEDIUM', value: 50, label: '中' },
  LOW: { level: 'LOW', value: 25, label: '低' },
  OK: { level: 'OK', value: 0, label: '正常' }
};

const RULE_CODES = {
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_EXPIRING_SOON: 'AUTH_EXPIRING_SOON',
  DURATION_EXCEEDED: 'DURATION_EXCEEDED',
  MISSING_SOURCE: 'MISSING_SOURCE',
  MISSING_AUTH: 'MISSING_AUTH',
  MISSING_IN_MANIFEST: 'MISSING_IN_MANIFEST',
  NAMING_VIOLATION: 'NAMING_VIOLATION',
  UNUSED_MATERIAL: 'UNUSED_MATERIAL',
  NO_CONTRACT_LIMIT: 'NO_CONTRACT_LIMIT',
  DATE_FORMAT_INVALID: 'DATE_FORMAT_INVALID'
};

class RulesEngine {
  constructor(options = {}) {
    this.options = {
      warningDays: options.warningDays || 30,
      namingPattern: options.namingPattern || /^[A-Z]{2,3}_\d{4}_\d{2}_\w+$/,
      allowMissingAuth: options.allowMissingAuth === true,
      strictDurationCheck: options.strictDurationCheck !== false,
      ...options
    };
    this.violations = [];
    this.warnings = [];
  }

  validate(parsedData, mediaFiles) {
    this.violations = [];
    this.warnings = [];

    const result = {
      summary: {
        totalMaterials: 0,
        totalContracts: 0,
        totalEDLEvents: 0,
        totalMediaFiles: mediaFiles ? mediaFiles.length : 0,
        violations: 0,
        warnings: 0,
        highestRisk: RISK_LEVELS.OK.level
      },
      byMaterialId: {},
      gaps: [],
      badData: [],
      rulesApplied: []
    };

    if (!parsedData) {
      return result;
    }

    const { materialList, authData, edlData } = parsedData;

    if (materialList) {
      result.summary.totalMaterials = materialList.materials.length;
      this._indexMaterials(result, materialList);
    }

    if (authData) {
      result.summary.totalContracts = authData.contracts.length;
      this._indexContracts(result, authData);
    }

    if (edlData) {
      result.summary.totalEDLEvents = edlData.events.length;
      this._indexEDEvents(result, edlData);
    }

    this._checkAuthorizations(result);
    this._checkDurations(result);
    this._checkMediaFiles(result, mediaFiles);
    this._checkNamingConventions(result, mediaFiles);
    this._checkCrossReferences(result);
    this._calculateRiskSummary(result);

    return result;
  }

  _indexMaterials(result, materialList) {
    for (const material of materialList.materials) {
      const id = material.id;
      if (!result.byMaterialId[id]) {
        result.byMaterialId[id] = {
          materialId: id,
          material: null,
          contracts: [],
          edlEvents: [],
          mediaFiles: [],
          violations: [],
          warnings: [],
          riskLevel: RISK_LEVELS.OK.level
        };
      }
      result.byMaterialId[id].material = material;
    }
  }

  _indexContracts(result, authData) {
    for (const contract of authData.contracts) {
      const id = contract.materialId || contract.id;
      if (!id) continue;

      if (!result.byMaterialId[id]) {
        result.byMaterialId[id] = {
          materialId: id,
          material: null,
          contracts: [],
          edlEvents: [],
          mediaFiles: [],
          violations: [],
          warnings: [],
          riskLevel: RISK_LEVELS.OK.level
        };
      }
      result.byMaterialId[id].contracts.push(contract);
    }
  }

  _indexEDEvents(result, edlData) {
    for (const event of edlData.events) {
      const id = this._extractMaterialIdFromEvent(event);
      if (!id) continue;

      if (!result.byMaterialId[id]) {
        result.byMaterialId[id] = {
          materialId: id,
          material: null,
          contracts: [],
          edlEvents: [],
          mediaFiles: [],
          violations: [],
          warnings: [],
          riskLevel: RISK_LEVELS.OK.level
        };
      }
      result.byMaterialId[id].edlEvents.push(event);
    }
  }

  _extractMaterialIdFromEvent(event) {
    if (event.reel && event.reel !== 'AX' && event.reel !== 'BL') {
      return event.reel;
    }
    if (event.clipName) {
      const idMatch = event.clipName.match(/^([A-Z]{2,3}_\d{4}_\d{2})/);
      if (idMatch) {
        return idMatch[1];
      }
      return event.clipName.replace(/\.(mp4|mov|avi|mkv)$/i, '');
    }
    return null;
  }

  _checkAuthorizations(result) {
    const now = new Date();
    const warningThreshold = new Date(now.getTime() + this.options.warningDays * 24 * 60 * 60 * 1000);

    for (const [materialId, item] of Object.entries(result.byMaterialId)) {
      if (item.edlEvents.length > 0) {
        if (item.contracts.length === 0) {
          if (!this.options.allowMissingAuth) {
            this._addViolation(
              item,
              RULE_CODES.MISSING_AUTH,
              `素材 ${materialId} 在时间线中使用但没有对应授权合同`,
              RISK_LEVELS.CRITICAL
            );
          } else {
            this._addWarning(
              item,
              RULE_CODES.MISSING_AUTH,
              `素材 ${materialId} 在时间线中使用但没有对应授权合同`,
              RISK_LEVELS.LOW
            );
          }
        } else {
          for (const contract of item.contracts) {
            if (contract.endDateObj) {
              if (contract.endDateObj < now) {
                this._addViolation(
                  item,
                  RULE_CODES.AUTH_EXPIRED,
                  `素材 ${materialId} 的授权已于 ${contract.endDate} 过期`,
                  RISK_LEVELS.CRITICAL,
                  { contract, expiredDate: contract.endDate }
                );
              } else if (contract.endDateObj < warningThreshold) {
                this._addWarning(
                  item,
                  RULE_CODES.AUTH_EXPIRING_SOON,
                  `素材 ${materialId} 的授权将于 ${contract.endDate} 到期（不足${this.options.warningDays}天）`,
                  RISK_LEVELS.MEDIUM,
                  { contract, expiryDate: contract.endDate, daysRemaining: this._daysBetween(now, contract.endDateObj) }
                );
              }
            } else if (contract.endDate) {
              this._addWarning(
                item,
                RULE_CODES.DATE_FORMAT_INVALID,
                `素材 ${materialId} 的合同结束日期格式无法解析: ${contract.endDate}`,
                RISK_LEVELS.LOW,
                { contract, rawDate: contract.endDate }
              );
            }
          }
        }
      }
    }
  }

  _checkDurations(result) {
    if (!this.options.strictDurationCheck) return;

    for (const [materialId, item] of Object.entries(result.byMaterialId)) {
      if (item.edlEvents.length === 0) continue;
      if (item.contracts.length === 0) continue;

      const totalUsedDuration = item.edlEvents.reduce((sum, event) => {
        return sum + (event.durationSeconds || 0);
      }, 0);

      for (const contract of item.contracts) {
        if (contract.maxDurationSeconds !== undefined && contract.maxDurationSeconds !== null) {
          if (totalUsedDuration > contract.maxDurationSeconds) {
            this._addViolation(
              item,
              RULE_CODES.DURATION_EXCEEDED,
              `素材 ${materialId} 使用时长 ${this._formatDuration(totalUsedDuration)} 超过授权限制 ${this._formatDuration(contract.maxDurationSeconds)}`,
              RISK_LEVELS.HIGH,
              { 
                contract, 
                usedSeconds: totalUsedDuration, 
                limitSeconds: contract.maxDurationSeconds,
                excessSeconds: totalUsedDuration - contract.maxDurationSeconds
              }
            );
          }
        } else if (contract.maxDuration) {
          this._addWarning(
            item,
            RULE_CODES.NO_CONTRACT_LIMIT,
            `素材 ${materialId} 的合同时长限制无法解析，跳过时长检查: ${contract.maxDuration}`,
            RISK_LEVELS.LOW,
            { contract, rawLimit: contract.maxDuration }
          );
        }
      }
    }
  }

  _checkMediaFiles(result, mediaFiles) {
    if (!mediaFiles || mediaFiles.length === 0) return;

    const mediaById = {};
    for (const file of mediaFiles) {
      const id = this._extractMaterialIdFromFilename(file.name);
      if (id) {
        if (!mediaById[id]) {
          mediaById[id] = [];
        }
        mediaById[id].push(file);
      }
    }

    for (const [materialId, item] of Object.entries(result.byMaterialId)) {
      if (item.edlEvents.length > 0) {
        item.mediaFiles = mediaById[materialId] || [];
        
        if (item.mediaFiles.length === 0) {
          this._addViolation(
            item,
            RULE_CODES.MISSING_SOURCE,
            `素材 ${materialId} 在时间线中使用但交付文件夹中缺少源文件`,
            RISK_LEVELS.CRITICAL
          );
        }
      }
    }

    for (const [fileId, files] of Object.entries(mediaById)) {
      if (!result.byMaterialId[fileId]) {
        result.gaps.push({
          type: 'UNREFERENCED_MEDIA',
          materialId: fileId,
          files: files,
          message: `媒体文件存在但未在素材清单或时间线中引用: ${fileId}`
        });
      }
    }
  }

  _extractMaterialIdFromFilename(filename) {
    const idMatch = filename.match(/^([A-Z]{2,3}_\d{4}_\d{2})/);
    if (idMatch) {
      return idMatch[1];
    }

    const baseName = filename.replace(/\.[^.]+$/, '');
    return baseName;
  }

  _checkNamingConventions(result, mediaFiles) {
    if (!mediaFiles || mediaFiles.length === 0) return;
    if (!this.options.namingPattern) return;

    for (const file of mediaFiles) {
      const baseName = file.name.replace(/\.[^.]+$/, '');
      if (!this.options.namingPattern.test(baseName)) {
        this._addGlobalViolation(
          RULE_CODES.NAMING_VIOLATION,
          `文件名不符合命名规范: ${file.name}`,
          RISK_LEVELS.MEDIUM,
          { file, expectedPattern: this.options.namingPattern.toString() }
        );
      }
    }
  }

  _checkCrossReferences(result) {
    for (const [materialId, item] of Object.entries(result.byMaterialId)) {
      if (item.material && item.edlEvents.length === 0 && item.contracts.length > 0) {
        this._addWarning(
          item,
          RULE_CODES.UNUSED_MATERIAL,
          `素材 ${materialId} 有授权合同但未在时间线中使用`,
          RISK_LEVELS.LOW
        );
      }

      if (item.edlEvents.length > 0 && !item.material) {
        this._addWarning(
          item,
          RULE_CODES.MISSING_IN_MANIFEST,
          `素材 ${materialId} 在时间线中使用但未在素材清单中列出`,
          RISK_LEVELS.MEDIUM
        );
      }
    }
  }

  _addViolation(item, code, message, riskLevel, details = {}) {
    const violation = {
      code,
      message,
      riskLevel: riskLevel.level,
      riskValue: riskLevel.value,
      timestamp: new Date().toISOString(),
      ...details
    };
    item.violations.push(violation);
    this.violations.push({ materialId: item.materialId, ...violation });
  }

  _addWarning(item, code, message, riskLevel, details = {}) {
    const warning = {
      code,
      message,
      riskLevel: riskLevel.level,
      riskValue: riskLevel.value,
      timestamp: new Date().toISOString(),
      ...details
    };
    item.warnings.push(warning);
    this.warnings.push({ materialId: item.materialId, ...warning });
  }

  _addGlobalViolation(code, message, riskLevel, details = {}) {
    const violation = {
      code,
      message,
      riskLevel: riskLevel.level,
      riskValue: riskLevel.value,
      timestamp: new Date().toISOString(),
      ...details
    };
    this.violations.push(violation);
  }

  _calculateRiskSummary(result) {
    let highestValue = 0;
    let violationCount = 0;
    let warningCount = 0;

    for (const [materialId, item] of Object.entries(result.byMaterialId)) {
      const itemHighest = Math.max(
        ...item.violations.map(v => v.riskValue),
        ...item.warnings.map(w => w.riskValue),
        0
      );
      
      if (itemHighest > 0) {
        for (const [key, level] of Object.entries(RISK_LEVELS)) {
          if (itemHighest >= level.value) {
            item.riskLevel = level.level;
            break;
          }
        }
      }

      highestValue = Math.max(highestValue, itemHighest);
      violationCount += item.violations.length;
      warningCount += item.warnings.length;
    }

    violationCount += this.violations.filter(v => !v.materialId).length;

    for (const [key, level] of Object.entries(RISK_LEVELS)) {
      if (highestValue >= level.value) {
        result.summary.highestRisk = level.level;
        break;
      }
    }

    result.summary.violations = violationCount;
    result.summary.warnings = warningCount;
  }

  _daysBetween(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((date2 - date1) / oneDay));
  }

  _formatDuration(seconds) {
    if (typeof seconds !== 'number') return String(seconds);
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 25);

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
    } else {
      return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
    }
  }

  getViolations() {
    return [...this.violations];
  }

  getWarnings() {
    return [...this.warnings];
  }

  static getRiskLevels() {
    return { ...RISK_LEVELS };
  }

  static getRuleCodes() {
    return { ...RULE_CODES };
  }
}

module.exports = RulesEngine;
