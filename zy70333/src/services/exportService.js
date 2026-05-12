const { getFormModel, getSubmissionModel } = require('../utils/inMemoryStore');

class ExportService {
  async exportSubmissions(formId, options = {}) {
    const Form = getFormModel();
    const Submission = getSubmissionModel();

    const form = await Form.findOne({ formId }).exec();
    if (!form) {
      throw new Error(`Form not found: ${formId}`);
    }

    const exportMode = options.mode || 'original';
    const targetVersion = options.targetVersion || form.latestPublishedVersion;

    if (!targetVersion) {
      throw new Error('No published version available for this form');
    }

    const targetVersionData = form.getVersion(targetVersion);
    if (!targetVersionData) {
      throw new Error(`Target version not found: ${targetVersion}`);
    }

    let query = { formId };
    if (options.submissionVersion) {
      query.version = parseInt(options.submissionVersion);
    }

    const submissions = await Submission.find(query).sort({ submittedAt: 1 }).exec();

    const activeTargetFields = targetVersionData.fields.filter(f => !f.deleted);
    
    const exportRecords = [];
    const migrationGaps = [];
    const fieldWarnings = [];

    const submissionsByVersion = this._groupSubmissionsByVersion(submissions);

    for (const submission of submissions) {
      const record = {
        submissionId: submission.submissionId,
        submissionKey: submission.submissionKey,
        submittedVersion: submission.version,
        submittedAt: submission.submittedAt,
        updatedAt: submission.updatedAt,
        fields: {},
        gaps: [],
        warnings: []
      };

      const submitVersion = form.getVersion(submission.version);
      const submitFields = submitVersion 
        ? submitVersion.fields.filter(f => !f.deleted)
        : [];

      if (exportMode === 'original') {
        for (const field of submitFields) {
          if (submission.data.hasOwnProperty(field.name)) {
            record.fields[field.name] = {
              value: submission.data[field.name],
              label: field.label,
              status: 'present'
            };
          } else {
            if (field.required) {
              record.gaps.push({
                field: field.name,
                label: field.label,
                reason: `必填字段在提交时缺失（v${submission.version}）`,
                severity: 'error'
              });
            }
            record.fields[field.name] = {
              value: null,
              label: field.label,
              status: 'missing'
            };
          }
        }
      } else if (exportMode === 'latest') {
        for (const targetField of activeTargetFields) {
          if (submission.data.hasOwnProperty(targetField.name)) {
            const submitField = submitFields.find(f => f.name === targetField.name);
            const value = submission.data[targetField.name];
            
            let status = 'present';
            let warning = null;

            if (submitField) {
              if (submitField.type !== targetField.type) {
                warning = `字段类型变更: ${submitField.type} → ${targetField.type}，值可能需要转换`;
                status = 'type_mismatch';
              } else if (JSON.stringify(submitField.validation) !== JSON.stringify(targetField.validation)) {
                warning = `校验规则变更，当前值可能不符合新规则`;
                status = 'validation_changed';
              }
            }

            if (warning) {
              record.warnings.push({
                field: targetField.name,
                label: targetField.label,
                message: warning
              });
            }

            record.fields[targetField.name] = {
              value: value,
              label: targetField.label,
              status: status
            };
          } else {
            if (targetField.required) {
              if (!submitFields.find(f => f.name === targetField.name)) {
                record.gaps.push({
                  field: targetField.name,
                  label: targetField.label,
                  reason: `此字段在 v${targetVersion} 中新增且为必填，但在提交时（v${submission.version}）不存在`,
                  severity: 'critical'
                });
              } else {
                record.gaps.push({
                  field: targetField.name,
                  label: targetField.label,
                  reason: `必填字段在提交时缺失`,
                  severity: 'error'
                });
              }
            }

            record.fields[targetField.name] = {
              value: null,
              label: targetField.label,
              status: submitFields.find(f => f.name === targetField.name) 
                ? 'missing' 
                : 'not_exist_when_submitted'
            };
          }
        }

        const removedFields = submitFields.filter(
          f => !activeTargetFields.find(tf => tf.name === f.name)
        );
        for (const removedField of removedFields) {
          if (submission.data.hasOwnProperty(removedField.name)) {
            record.warnings.push({
              field: removedField.name,
              label: removedField.label,
              message: `此字段在最新版本中已删除（迁移说明: ${removedField.migrationNote || '未提供'}），值已保留但不包含在目标列中`
            });
          }
        }
      }

      if (record.gaps.length > 0) {
        migrationGaps.push({
          submissionId: submission.submissionId,
          submissionKey: submission.submissionKey,
          version: submission.version,
          gaps: record.gaps
        });
      }
      if (record.warnings.length > 0) {
        fieldWarnings.push({
          submissionId: submission.submissionId,
          submissionKey: submission.submissionKey,
          version: submission.version,
          warnings: record.warnings
        });
      }

      exportRecords.push(record);
    }

    const summary = this._generateSummary(
      form,
      targetVersion,
      exportMode,
      submissions,
      submissionsByVersion,
      activeTargetFields,
      migrationGaps,
      fieldWarnings
    );

    return {
      exportInfo: {
        formId: form.formId,
        formName: form.name,
        exportMode: exportMode,
        targetVersion: targetVersion,
        generatedAt: new Date(),
        summary
      },
      records: exportRecords,
      migrationGaps,
      fieldWarnings,
      rawData: this._flattenForCsv(exportRecords, activeTargetFields, exportMode)
    };
  }

  _groupSubmissionsByVersion(submissions) {
    const groups = {};
    for (const s of submissions) {
      if (!groups[s.version]) {
        groups[s.version] = [];
      }
      groups[s.version].push(s);
    }
    return groups;
  }

  _generateSummary(form, targetVersion, exportMode, submissions, byVersion, targetFields, gaps, warnings) {
    const versionSummary = [];
    for (const [v, subs] of Object.entries(byVersion)) {
      const versionData = form.getVersion(parseInt(v));
      versionSummary.push({
        version: parseInt(v),
        status: versionData ? versionData.status : 'unknown',
        submissionCount: subs.length,
        fields: versionData ? versionData.fields.filter(f => !f.deleted).map(f => ({
          name: f.name,
          label: f.label,
          required: f.required
        })) : []
      });
    }

    return {
      totalSubmissions: submissions.length,
      submissionsByVersion: versionSummary,
      targetVersionInfo: {
        version: targetVersion,
        fields: targetFields.map(f => ({
          name: f.name,
          label: f.label,
          required: f.required
        }))
      },
      issues: {
        criticalGaps: gaps.filter(g => g.gaps.some(gap => gap.severity === 'critical')).length,
        errors: gaps.filter(g => g.gaps.some(gap => gap.severity === 'error')).length,
        warnings: warnings.length
      },
      exportModeDescription: exportMode === 'original'
        ? '按提交时的原始版本字段导出，保留历史字段结构'
        : `按目标版本（v${targetVersion}）字段映射导出，展示新旧字段差异`
    };
  }

  _flattenForCsv(records, targetFields, exportMode) {
    const fieldNames = exportMode === 'latest' 
      ? targetFields.map(f => f.name)
      : Array.from(new Set(records.flatMap(r => Object.keys(r.fields))));

    const headers = [
      'submissionId',
      'submissionKey',
      'submittedVersion',
      'submittedAt',
      ...fieldNames,
      '_gaps',
      '_warnings'
    ];

    const rows = records.map(record => {
      const row = {
        submissionId: record.submissionId,
        submissionKey: record.submissionKey,
        submittedVersion: record.submittedVersion,
        submittedAt: record.submittedAt
      };

      for (const fieldName of fieldNames) {
        const fieldData = record.fields[fieldName];
        row[fieldName] = fieldData ? fieldData.value : null;
      }

      row['_gaps'] = record.gaps.length > 0 
        ? JSON.stringify(record.gaps) 
        : '';
      row['_warnings'] = record.warnings.length > 0 
        ? JSON.stringify(record.warnings) 
        : '';

      return row;
    });

    return {
      headers,
      rows
    };
  }
}

module.exports = new ExportService();