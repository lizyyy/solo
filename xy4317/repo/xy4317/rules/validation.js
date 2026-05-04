const moment = require('moment');
const storage = require('../models/storage');

const validation = {
  checkDuplicateSignature: async (householdId) => {
    const existingSignature = await storage.getSignatureByHousehold(householdId);
    if (existingSignature) {
      return {
        valid: false,
        rule: 'duplicate_signature_check',
        message: '该住户已存在签字记录，禁止重复签字',
        details: {
          householdId,
          existingSignature: {
            id: existingSignature.id,
            is_agree: existingSignature.is_agree,
            signature_date: existingSignature.signature_date
          }
        }
      };
    }
    return {
      valid: true,
      rule: 'duplicate_signature_check',
      message: '无重复签字记录'
    };
  },

  checkLowFloorOpposition: async (buildingId, ruleConfig) => {
    const threshold = ruleConfig?.low_floor_threshold || 3;
    const households = await storage.getHouseholdsByBuilding(buildingId);
    
    const lowFloorHouseholds = households.filter(h => h.floor <= threshold);
    const lowFloorIds = lowFloorHouseholds.map(h => h.id);
    
    const signatures = await storage.getSignatures();
    const lowFloorSignatures = signatures.filter(s => lowFloorIds.includes(s.household_id));
    
    const opposeSignatures = lowFloorSignatures.filter(s => !s.is_agree);
    
    if (opposeSignatures.length === 0) {
      return {
        valid: true,
        rule: 'low_floor_opposition_check',
        message: `低楼层(${threshold}层及以下)暂无反对记录，或反对已被记录`,
        details: {
          threshold,
          lowFloorHouseholdsCount: lowFloorHouseholds.length,
          lowFloorSignedCount: lowFloorSignatures.length,
          opposeCount: 0
        }
      };
    }
    
    const opposingHouseholds = opposeSignatures.map(s => ({
      householdId: s.household_id,
      unitNumber: s.unit_number,
      floor: s.floor,
      signatureDate: s.signature_date,
      notes: s.notes
    }));
    
    return {
      valid: false,
      rule: 'low_floor_opposition_check',
      message: `检测到${opposeSignatures.length}户低楼层住户反对，需重点关注`,
      details: {
        threshold,
        lowFloorHouseholdsCount: lowFloorHouseholds.length,
        lowFloorSignedCount: lowFloorSignatures.length,
        opposeCount: opposeSignatures.length,
        opposingHouseholds
      }
    };
  },

  checkConstructionTimeConflict: async (constructionBatch, ruleConfig) => {
    const conflicts = [];
    const gaokaoDates = ruleConfig?.gaokao_dates || [];
    const nightHours = ruleConfig?.night_hours || { start: "22:00", end: "06:00" };
    const silentPeriods = ruleConfig?.silent_periods || [];

    const batchStart = moment(constructionBatch.start_date);
    const batchEnd = moment(constructionBatch.end_date);

    for (const gaokao of gaokaoDates) {
      const gaokaoStart = moment(gaokao.start);
      const gaokaoEnd = moment(gaokao.end);
      
      if (batchStart.isSameOrBefore(gaokaoEnd) && batchEnd.isSameOrAfter(gaokaoStart)) {
        const overlapStart = moment.max(batchStart, gaokaoStart);
        const overlapEnd = moment.min(batchEnd, gaokaoEnd);
        
        conflicts.push({
          type: 'gaokao_conflict',
          message: '施工时间与高考禁噪期冲突',
          details: {
            gaokaoPeriod: `${gaokao.start} 至 ${gaokao.end}`,
            conflictPeriod: `${overlapStart.format('YYYY-MM-DD')} 至 ${overlapEnd.format('YYYY-MM-DD')}`
          }
        });
      }
    }

    const workStart = constructionBatch.work_hours_start;
    const workEnd = constructionBatch.work_hours_end;

    const [nightStartHour, nightStartMin] = nightHours.start.split(':').map(Number);
    const [nightEndHour, nightEndMin] = nightHours.end.split(':').map(Number);
    const [workStartHour, workStartMin] = workStart.split(':').map(Number);
    const [workEndHour, workEndMin] = workEnd.split(':').map(Number);

    const workStartTime = workStartHour * 60 + workStartMin;
    const workEndTime = workEndHour * 60 + workEndMin;
    const nightStartTime = nightStartHour * 60 + nightStartMin;
    const nightEndTime = nightEndHour * 60 + nightEndMin;

    if (workStartTime < nightEndTime) {
      conflicts.push({
        type: 'night_conflict',
        message: '施工开始时间早于夜间禁噪结束时间',
        details: {
          nightPeriod: `${nightHours.start} 至 ${nightHours.end}`,
          workStart,
          workEnd
        }
      });
    }

    if (workEndTime > nightStartTime) {
      conflicts.push({
        type: 'night_conflict',
        message: '施工结束时间晚于夜间禁噪开始时间',
        details: {
          nightPeriod: `${nightHours.start} 至 ${nightHours.end}`,
          workStart,
          workEnd
        }
      });
    }

    for (const silent of silentPeriods) {
      const [silentStartHour, silentStartMin] = silent.start.split(':').map(Number);
      const [silentEndHour, silentEndMin] = silent.end.split(':').map(Number);
      const silentStartTime = silentStartHour * 60 + silentStartMin;
      const silentEndTime = silentEndHour * 60 + silentEndMin;

      if (workStartTime < silentEndTime && workEndTime > silentStartTime) {
        conflicts.push({
          type: 'silent_period_conflict',
          message: `施工时间与${silent.description}冲突`,
          details: {
            silentPeriod: `${silent.start} 至 ${silent.end}`,
            description: silent.description,
            workStart,
            workEnd
          }
        });
      }
    }

    if (conflicts.length > 0) {
      return {
        valid: false,
        rule: 'construction_time_conflict_check',
        message: `检测到${conflicts.length}个施工时间冲突`,
        details: {
          conflicts
        }
      };
    }

    return {
      valid: true,
      rule: 'construction_time_conflict_check',
      message: '施工时间无冲突'
    };
  },

  checkSignatureRatio: async (buildingId, ruleConfig) => {
    const requiredRatio = ruleConfig?.required_ratio || 0.7;
    const requiredByFloor = ruleConfig?.required_by_floor !== false;

    const summary = await storage.getBuildingSignaturesSummary(buildingId);
    
    if (summary.length === 0) {
      return {
        valid: false,
        rule: 'signature_ratio_check',
        message: '该楼栋暂无住户数据',
        details: { requiredRatio }
      };
    }

    const totalHouseholds = summary.reduce((sum, item) => sum + item.total_households, 0);
    const totalSigned = summary.reduce((sum, item) => sum + item.signed_count, 0);
    const totalAgree = summary.reduce((sum, item) => sum + item.agree_count, 0);

    const overallRatio = totalHouseholds > 0 ? totalSigned / totalHouseholds : 0;
    const agreeRatio = totalSigned > 0 ? totalAgree / totalSigned : 0;

    const floorResults = [];
    let allFloorsMeetRequirement = true;

    for (const floor of summary) {
      const floorRatio = floor.total_households > 0 ? floor.signed_count / floor.total_households : 0;
      const floorMeets = floorRatio >= requiredRatio;
      
      if (!floorMeets) {
        allFloorsMeetRequirement = false;
      }

      floorResults.push({
        floor: floor.floor,
        total_households: floor.total_households,
        signed_count: floor.signed_count,
        agree_count: floor.agree_count,
        oppose_count: floor.oppose_count,
        ratio: floorRatio.toFixed(2),
        meets_requirement: floorMeets
      });
    }

    const valid = requiredByFloor 
      ? allFloorsMeetRequirement && overallRatio >= requiredRatio
      : overallRatio >= requiredRatio;

    return {
      valid,
      rule: 'signature_ratio_check',
      message: valid 
        ? '签字比例符合要求' 
        : '签字比例未达到要求',
      details: {
        requiredRatio,
        requiredByFloor,
        overall: {
          total_households: totalHouseholds,
          signed_count: totalSigned,
          agree_count: totalAgree,
          ratio: overallRatio.toFixed(2),
          agree_ratio: agreeRatio.toFixed(2)
        },
        by_floor: floorResults
      }
    };
  },

  runAllValidations: async (context) => {
    const rules = await storage.getValidationRules();
    const results = [];

    for (const rule of rules) {
      let result;
      
      try {
        switch (rule.rule_name) {
          case 'duplicate_signature_check':
            if (context.householdId) {
              result = await validation.checkDuplicateSignature(context.householdId);
            }
            break;
          case 'low_floor_opposition_check':
            if (context.buildingId) {
              result = await validation.checkLowFloorOpposition(context.buildingId, rule.rule_config);
            }
            break;
          case 'construction_time_conflict_check':
            if (context.constructionBatch) {
              result = await validation.checkConstructionTimeConflict(context.constructionBatch, rule.rule_config);
            }
            break;
          case 'signature_ratio_check':
            if (context.buildingId) {
              result = await validation.checkSignatureRatio(context.buildingId, rule.rule_config);
            }
            break;
          default:
            break;
        }

        if (result) {
          results.push(result);
        }
      } catch (error) {
        results.push({
          valid: false,
          rule: rule.rule_name,
          message: `校验执行错误: ${error.message}`,
          error: error.message
        });
      }
    }

    const allValid = results.every(r => r.valid);

    return {
      overall_valid: allValid,
      validation_count: results.length,
      valid_count: results.filter(r => r.valid).length,
      invalid_count: results.filter(r => !r.valid).length,
      results
    };
  }
};

module.exports = validation;
