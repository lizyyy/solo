class ConflictDetector {
  static detectProxyAndLateMakeupConflict(record) {
    if (record.isProxySign && record.isLateMakeup) {
      return {
        type: 'PROXY_AND_LATE_MAKEUP_CONFLICT',
        severity: 'high',
        message: `业务争议：志愿者[${record.volunteerName}]在${record.serviceDate}的服务记录同时标记了"代签"和"迟到补签"`,
        detail: {
          volunteerName: record.volunteerName,
          serviceDate: record.serviceDate,
          serviceProject: record.serviceProject,
          isProxySign: record.isProxySign,
          isLateMakeup: record.isLateMakeup,
          proxySigner: record.proxySigner
        },
        suggestion: '同一服务记录不能同时标记代签和迟到补签，请核实实际签到情况。代签应有代签人书面授权，迟到补签应在备注中说明迟到原因和补签审批人。'
      };
    }
    return null;
  }

  static detectPublicityConsistencyConflict(newRecord, existingRecords) {
    const conflicts = [];
    const sameDayRecords = existingRecords.filter(r => 
      r.volunteerId === newRecord.volunteerId && 
      r.serviceDate === newRecord.serviceDate &&
      r.id !== newRecord.id
    );

    for (const existing of sameDayRecords) {
      if (existing.publicityStatus === 'publicized' || newRecord.publicityStatus === 'publicized') {
        const hoursDiff = Math.abs(newRecord.serviceHours - existing.serviceHours);
        if (hoursDiff > 0.5) {
          conflicts.push({
            type: 'PUBLICITY_HOURS_CONSISTENCY_CONFLICT',
            severity: 'high',
            message: `业务争议：志愿者[${newRecord.volunteerName}]在${newRecord.serviceDate}的服务时长与已公示记录不一致`,
            detail: {
              volunteerName: newRecord.volunteerName,
              serviceDate: newRecord.serviceDate,
              newHours: newRecord.serviceHours,
              existingHours: existing.serviceHours,
              hoursDiff: hoursDiff,
              newPublicityStatus: newRecord.publicityStatus,
              existingPublicityStatus: existing.publicityStatus,
              existingRecordId: existing.id
            },
            suggestion: '同一日期的服务时长公示后不应随意修改。如需调整，应走公示变更审批流程，并保留变更前后的记录作为证据。'
          });
        }

        if (newRecord.serviceProject !== existing.serviceProject) {
          conflicts.push({
            type: 'PUBLICITY_PROJECT_CONSISTENCY_CONFLICT',
            severity: 'medium',
            message: `业务争议：志愿者[${newRecord.volunteerName}]在${newRecord.serviceDate}的服务项目与已公示记录不一致`,
            detail: {
              volunteerName: newRecord.volunteerName,
              serviceDate: newRecord.serviceDate,
              newProject: newRecord.serviceProject,
              existingProject: existing.serviceProject,
              newPublicityStatus: newRecord.publicityStatus,
              existingPublicityStatus: existing.publicityStatus,
              existingRecordId: existing.id
            },
            suggestion: '服务项目公示后变更应说明原因，并保留项目变更审批记录。'
          });
        }
      }
    }

    return conflicts;
  }

  static detectRecordOverwriteConflict(newRecord, existingRecord) {
    if (existingRecord) {
      const hasSignificantChanges = 
        newRecord.serviceHours !== existingRecord.serviceHours ||
        newRecord.serviceProject !== existingRecord.serviceProject ||
        newRecord.serviceDate !== existingRecord.serviceDate ||
        newRecord.isProxySign !== existingRecord.isProxySign ||
        newRecord.isLateMakeup !== existingRecord.isLateMakeup ||
        newRecord.checkInStatus !== existingRecord.checkInStatus;

      if (hasSignificantChanges && existingRecord.publicityStatus === 'publicized') {
        return {
          type: 'PUBLICIZED_RECORD_OVERWRITE_ATTEMPT',
          severity: 'critical',
          message: `业务争议：尝试静默覆盖已公示的服务记录[${existingRecord.id}]`,
          detail: {
            recordId: existingRecord.id,
            volunteerName: existingRecord.volunteerName,
            serviceDate: existingRecord.serviceDate,
            changes: {
              serviceHours: { old: existingRecord.serviceHours, new: newRecord.serviceHours },
              serviceProject: { old: existingRecord.serviceProject, new: newRecord.serviceProject },
              isProxySign: { old: existingRecord.isProxySign, new: newRecord.isProxySign },
              isLateMakeup: { old: existingRecord.isLateMakeup, new: newRecord.isLateMakeup }
            }
          },
          suggestion: '已公示的记录禁止直接覆盖。如需修改，应创建新的更正记录并关联原记录，同时保留完整的变更审计轨迹。'
        };
      }
    }
    return null;
  }

  static detectAllConflicts(newRecord, existingRecords) {
    const allConflicts = [];

    const proxyLateConflict = this.detectProxyAndLateMakeupConflict(newRecord);
    if (proxyLateConflict) allConflicts.push(proxyLateConflict);

    const publicityConflicts = this.detectPublicityConsistencyConflict(newRecord, existingRecords);
    allConflicts.push(...publicityConflicts);

    const existingRecord = existingRecords.find(r => r.id === newRecord.id);
    const overwriteConflict = this.detectRecordOverwriteConflict(newRecord, existingRecord);
    if (overwriteConflict) allConflicts.push(overwriteConflict);

    return allConflicts;
  }
}

module.exports = ConflictDetector;