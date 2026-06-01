const Validator = {
  REQUIRED_FIELDS: [
    { key: 'performanceDate', label: '演出日期', severity: 'error' },
    { key: 'city', label: '城市', severity: 'error' },
    { key: 'songName', label: '曲目名称', severity: 'error' },
    { key: 'inputType', label: '输入类型', severity: 'error' },
    { key: 'fileName', label: '文件名', severity: 'error' },
    { key: 'sourceType', label: '来源', severity: 'warning' }
  ],

  validateRecord(record, allRecords) {
    const issues = [];
    const suggestions = [];

    issues.push(...this.checkEmptyFields(record));
    issues.push(...this.checkDuplicates(record, allRecords));
    issues.push(...this.checkBoundaryConditions(record, allRecords));
    issues.push(...this.checkFileNameConvention(record));
    issues.push(...this.checkDurationAnomaly(record));

    const uniqueIssues = this.deduplicateIssues(issues);

    suggestions.push(...this.generateSuggestions(record, uniqueIssues));

    return { issues: uniqueIssues, suggestions };
  },

  checkEmptyFields(record) {
    const issues = [];

    for (const field of this.REQUIRED_FIELDS) {
      const value = record[field.key];
      if (value === undefined || value === null || value === '') {
        issues.push({
          type: '空值',
          severity: field.severity,
          field: field.key,
          fieldLabel: field.label,
          message: `${field.label}为空`,
          code: `EMPTY_${field.key.toUpperCase()}`
        });
      }
    }

    return issues;
  },

  checkDuplicates(record, allRecords) {
    const issues = [];

    const sameSongChannel = allRecords.filter(r =>
      r.id !== record.id &&
      r.performanceDate === record.performanceDate &&
      r.songName === record.songName &&
      r.inputType === record.inputType &&
      r.channelNumber && record.channelNumber &&
      r.channelNumber === record.channelNumber
    );

    if (sameSongChannel.length > 0) {
      issues.push({
        type: '重复',
        severity: 'error',
        field: 'channelNumber',
        fieldLabel: '通道号',
        message: `相同日期、曲目、输入类型下，通道号${record.channelNumber}重复`,
        duplicateWith: sameSongChannel.map(r => r.id),
        code: 'DUPLICATE_CHANNEL'
      });
    }

    const sameFileName = allRecords.filter(r =>
      r.id !== record.id &&
      r.fileName && record.fileName &&
      r.fileName.toLowerCase() === record.fileName.toLowerCase()
    );

    if (sameFileName.length > 0) {
      issues.push({
        type: '重复',
        severity: 'warning',
        field: 'fileName',
        fieldLabel: '文件名',
        message: `文件名"${record.fileName}"已存在`,
        duplicateWith: sameFileName.map(r => r.id),
        code: 'DUPLICATE_FILENAME'
      });
    }

    return issues;
  },

  checkBoundaryConditions(record, allRecords) {
    const issues = [];

    if (record.channelNumber) {
      const channelNum = parseInt(record.channelNumber);
      if (isNaN(channelNum)) {
        issues.push({
          type: '边界',
          severity: 'warning',
          field: 'channelNumber',
          fieldLabel: '通道号',
          message: `通道号"${record.channelNumber}"不是有效数字`,
          code: 'INVALID_CHANNEL'
        });
      } else if (channelNum < 1 || channelNum > 128) {
        issues.push({
          type: '边界',
          severity: 'warning',
          field: 'channelNumber',
          fieldLabel: '通道号',
          message: `通道号${channelNum}超出常规范围(1-128)`,
          code: 'CHANNEL_OUT_OF_RANGE'
        });
      }
    }

    if (record.duration) {
      const seconds = DataManager.parseDuration(record.duration);
      if (seconds > 0 && seconds < 10) {
        issues.push({
          type: '边界',
          severity: 'warning',
          field: 'duration',
          fieldLabel: '时长',
          message: `时长${record.duration}异常短，可能不完整`,
          code: 'DURATION_TOO_SHORT'
        });
      } else if (seconds > 3600 * 2) {
        issues.push({
          type: '边界',
          severity: 'warning',
          field: 'duration',
          fieldLabel: '时长',
          message: `时长${record.duration}超过2小时，请确认`,
          code: 'DURATION_TOO_LONG'
        });
      }
    }

    if (record.performanceDate) {
      const date = new Date(record.performanceDate);
      const today = new Date();
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const threeMonthsLater = new Date();
      threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

      if (date < threeMonthsAgo) {
        issues.push({
          type: '边界',
          severity: 'info',
          field: 'performanceDate',
          fieldLabel: '演出日期',
          message: `演出日期${record.performanceDate}距今超过3个月`,
          code: 'DATE_TOO_OLD'
        });
      } else if (date > threeMonthsLater) {
        issues.push({
          type: '边界',
          severity: 'info',
          field: 'performanceDate',
          fieldLabel: '演出日期',
          message: `演出日期${record.performanceDate}在3个月后，请确认`,
          code: 'DATE_TOO_FAR'
        });
      }
    }

    if (record.fileName && !record.fileFormat) {
      const extMatch = record.fileName.match(/\.(\w+)$/);
      if (extMatch) {
        const ext = extMatch[1].toUpperCase();
        const validFormats = ['WAV', 'MP3', 'AIFF', 'FLAC', 'M4A', 'OGG'];
        if (!validFormats.includes(ext)) {
          issues.push({
            type: '边界',
            severity: 'warning',
            field: 'fileFormat',
            fieldLabel: '文件格式',
            message: `文件扩展名"${ext}"不是常见音频格式`,
            code: 'UNKNOWN_FORMAT'
          });
        }
      }
    }

    return issues;
  },

  checkFileNameConvention(record) {
    const issues = [];

    if (!record.fileName) return issues;

    const hasChinese = /[\u4e00-\u9fa5]/.test(record.fileName);
    const hasEnglish = /[a-zA-Z]/.test(record.fileName);

    if (hasChinese && hasEnglish) {
      issues.push({
        type: '边界',
        severity: 'info',
        field: 'fileName',
        fieldLabel: '文件名',
        message: '文件名同时包含中英文，建议统一命名规范',
        code: 'MIXED_LANGUAGE_FILENAME'
      });
    }

    if (record.fileName.includes(' ') || record.fileName.includes('　')) {
      issues.push({
        type: '边界',
        severity: 'info',
        field: 'fileName',
        fieldLabel: '文件名',
        message: '文件名包含空格，建议使用下划线或连字符',
        code: 'SPACE_IN_FILENAME'
      });
    }

    const specialChars = /[!@#$%^&*()+=\\|[\]{};:'",<>?]/;
    if (specialChars.test(record.fileName)) {
      issues.push({
        type: '边界',
        severity: 'warning',
        field: 'fileName',
        fieldLabel: '文件名',
        message: '文件名包含特殊字符，可能导致跨平台问题',
        code: 'SPECIAL_CHARS_IN_FILENAME'
      });
    }

    return issues;
  },

  checkDurationAnomaly(record) {
    const issues = [];

    if (!record.duration || !record.songName) return issues;

    const seconds = DataManager.parseDuration(record.duration);
    if (seconds === 0) return issues;

    const songLower = record.songName.toLowerCase();

    if (songLower.includes('intro') || songLower.includes('序曲')) {
      if (seconds > 180) {
        issues.push({
          type: '边界',
          severity: 'warning',
          field: 'duration',
          fieldLabel: '时长',
          message: `Intro/序曲通常较短(${record.duration})，请确认`,
          code: 'INTRO_TOO_LONG'
        });
      }
    }

    if (songLower.includes('outro') || songLower.includes('尾奏')) {
      if (seconds > 120) {
        issues.push({
          type: '边界',
          severity: 'warning',
          field: 'duration',
          fieldLabel: '时长',
          message: `Outro/尾奏通常较短(${record.duration})，请确认`,
          code: 'OUTRO_TOO_LONG'
        });
      }
    }

    return issues;
  },

  deduplicateIssues(issues) {
    const seen = new Set();
    return issues.filter(issue => {
      const key = `${issue.code}_${issue.field}_${issue.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },

  generateSuggestions(record, issues) {
    const suggestions = [];

    if (issues.length === 0) {
      suggestions.push({
        type: 'success',
        icon: '✅',
        title: '核对通过',
        description: '该记录各项信息完整，未发现明显问题。',
        action: '可以标记为"已确认"状态，或继续补充备注信息。'
      });
      return suggestions;
    }

    const emptyIssues = issues.filter(i => i.type === '空值');
    const duplicateIssues = issues.filter(i => i.type === '重复');
    const boundaryIssues = issues.filter(i => i.type === '边界');

    if (emptyIssues.length > 0) {
      const missingFields = emptyIssues.map(i => i.fieldLabel).join('、');
      suggestions.push({
        type: 'error',
        icon: '❌',
        title: '关键信息缺失',
        description: `发现 ${emptyIssues.length} 项必填字段为空：${missingFields}。`,
        action: `请 <strong>立即补充</strong> 缺失的信息。缺少这些信息会导致材料无法定位，影响后续混音和发行流程。`
      });
    }

    if (duplicateIssues.length > 0) {
      for (const issue of duplicateIssues) {
        if (issue.code === 'DUPLICATE_CHANNEL') {
          suggestions.push({
            type: 'error',
            icon: '⚠️',
            title: '通道号冲突',
            description: issue.message,
            action: `请 <strong>核对调音台记录</strong>，确认哪一条是正确的通道号。同一场同一首歌的同一输入类型不能占用相同通道。`
          });
        } else if (issue.code === 'DUPLICATE_FILENAME') {
          suggestions.push({
            type: 'warning',
            icon: '📁',
            title: '文件名重复',
            description: issue.message,
            action: `请检查是否为同一文件的重复录入。如果是不同版本，建议在文件名中加入版本号（如 _v2、_final）或日期区分。`
          });
        }
      }
    }

    if (boundaryIssues.length > 0) {
      for (const issue of boundaryIssues) {
        let suggestion = null;

        switch (issue.code) {
          case 'CHANNEL_OUT_OF_RANGE':
            suggestion = {
              type: 'warning',
              icon: '🎚️',
              title: '通道号异常',
              description: issue.message,
              action: `请确认调音台实际通道配置。如使用的是大型数字台，请在备注中说明设备型号。`
            };
            break;

          case 'INVALID_CHANNEL':
            suggestion = {
              type: 'warning',
              icon: '🎚️',
              title: '通道号格式错误',
              description: issue.message,
              action: `通道号应为数字（1-128）。如使用立体声对，请分别记录或在备注中说明。`
            };
            break;

          case 'DURATION_TOO_SHORT':
            suggestion = {
              type: 'warning',
              icon: '⏱️',
              title: '时长异常',
              description: issue.message,
              action: `请确认文件是否完整。如果是片段录音，请在备注中标注"片段"及具体用途。`
            };
            break;

          case 'DURATION_TOO_LONG':
            suggestion = {
              type: 'warning',
              icon: '⏱️',
              title: '时长过长',
              description: issue.message,
              action: `请确认是否为多轨合并文件或整场录音。如果包含多首曲目，建议拆分后分别录入。`
            };
            break;

          case 'MIXED_LANGUAGE_FILENAME':
            suggestion = {
              type: 'info',
              icon: '📝',
              title: '文件名建议',
              description: issue.message,
              action: `建议统一使用中文或英文命名。推荐格式：日期_城市_曲目名_输入类型，如 20240615_上海_夜空中最亮的星_主唱麦.wav`
            };
            break;

          case 'SPACE_IN_FILENAME':
            suggestion = {
              type: 'info',
              icon: '📝',
              title: '文件名规范',
              description: issue.message,
              action: `建议将空格替换为下划线(_)或连字符(-)，避免在某些系统或软件中出现路径问题。`
            };
            break;

          case 'UNKNOWN_FORMAT':
            suggestion = {
              type: 'warning',
              icon: '💾',
              title: '文件格式',
              description: issue.message,
              action: `请确认文件格式。推荐使用 WAV 或 AIFF 等无损格式用于后期制作。`
            };
            break;

          case 'DATE_TOO_OLD':
          case 'DATE_TOO_FAR':
            suggestion = {
              type: 'info',
              icon: '📅',
              title: '日期提醒',
              description: issue.message,
              action: `请确认演出日期是否正确。如为归档材料，请在备注中说明背景。`
            };
            break;

          case 'INTRO_TOO_LONG':
          case 'OUTRO_TOO_LONG':
            suggestion = {
              type: 'warning',
              icon: '🎵',
              title: '曲目时长提醒',
              description: issue.message,
              action: `请确认曲目名称和时长是否匹配。如曲目标识有误，请更正曲目名称。`
            };
            break;

          default:
            suggestion = {
              type: 'info',
              icon: '💡',
              title: '注意事项',
              description: issue.message,
              action: `请人工核对以上信息，确认无误后可忽略此提示。`
            };
        }

        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    if (!record.sourceType || !record.sourceDetail) {
      suggestions.push({
        type: 'info',
        icon: '🔍',
        title: '来源信息建议',
        description: '完善来源信息可以在需要追溯时快速定位原始材料。',
        action: `建议补充"来源类型"（微信群截图/邮件/文件夹等）和具体说明，方便日后核对。`
      });
    }

    return suggestions;
  },

  validateAllRecords() {
    const records = DataManager.getAllRecords();
    const results = [];
    const stats = {
      total: records.length,
      ok: 0,
      warning: 0,
      error: 0,
      duplicate: 0,
      empty: 0,
      boundary: 0
    };

    for (const record of records) {
      const { issues, suggestions } = this.validateRecord(record, records);

      DataManager.updateRecordIssues(record.id, issues, suggestions);

      const hasError = issues.some(i => i.severity === 'error');
      const hasWarning = issues.some(i => i.severity === 'warning');
      const hasDuplicate = issues.some(i => i.type === '重复');
      const hasEmpty = issues.some(i => i.type === '空值');
      const hasBoundary = issues.some(i => i.type === '边界');

      if (issues.length === 0) {
        stats.ok++;
      }
      if (hasError) stats.error++;
      if (hasWarning) stats.warning++;
      if (hasDuplicate) stats.duplicate++;
      if (hasEmpty) stats.empty++;
      if (hasBoundary) stats.boundary++;

      results.push({
        recordId: record.id,
        issues,
        suggestions,
        hasError,
        hasWarning
      });
    }

    return { results, stats };
  },

  generateSummaryReport() {
    const { results, stats } = this.validateAllRecords();

    const report = {
      summary: stats,
      generatedAt: new Date().toISOString(),
      generatedBy: DataManager.currentUser,
      sections: []
    };

    if (stats.empty > 0) {
      const emptyRecords = results.filter(r => r.issues.some(i => i.type === '空值'));
      report.sections.push({
        type: 'error',
        title: '❌ 缺失材料提醒',
        count: stats.empty,
        description: `有 ${stats.empty} 条记录缺少关键字段信息`,
        records: emptyRecords.map(r => ({
          id: r.recordId,
          issues: r.issues.filter(i => i.type === '空值').map(i => i.message)
        }))
      });
    }

    if (stats.duplicate > 0) {
      const dupRecords = results.filter(r => r.issues.some(i => i.type === '重复'));
      report.sections.push({
        type: 'error',
        title: '⚠️ 重复记录提醒',
        count: stats.duplicate,
        description: `发现 ${stats.duplicate} 条疑似重复记录`,
        records: dupRecords.map(r => ({
          id: r.recordId,
          issues: r.issues.filter(i => i.type === '重复').map(i => i.message)
        }))
      });
    }

    if (stats.boundary > 0) {
      const boundaryRecords = results.filter(r => r.issues.some(i => i.type === '边界'));
      report.sections.push({
        type: 'warning',
        title: '💡 需要人工确认',
        count: stats.boundary,
        description: `有 ${stats.boundary} 条记录存在边界异常，建议人工核对`,
        records: boundaryRecords.map(r => ({
          id: r.recordId,
          issues: r.issues.filter(i => i.type === '边界').map(i => i.message)
        }))
      });
    }

    if (stats.ok > 0) {
      report.sections.push({
        type: 'success',
        title: '✅ 核对通过',
        count: stats.ok,
        description: `${stats.ok} 条记录信息完整，无异常`,
        records: []
      });
    }

    return report;
  }
};
