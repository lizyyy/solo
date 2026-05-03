import { hashService } from './hashService.js';

export class EvaluationEngine {
  constructor() {}

  evaluateUserInSegment(user, segment) {
    const conditions = segment.conditions || [];
    
    if (conditions.length === 0) {
      return {
        matches: false,
        reason: 'Segment 没有定义任何条件'
      };
    }

    const matchResults = [];
    let allMatch = true;

    for (const condition of conditions) {
      const result = this.evaluateCondition(user, condition);
      matchResults.push({
        condition,
        matches: result.matches,
        reason: result.reason
      });

      if (!result.matches) {
        allMatch = false;
      }
    }

    return {
      matches: allMatch,
      segmentId: segment.id,
      segmentName: segment.name,
      matchResults
    };
  }

  evaluateCondition(user, condition) {
    const { field, operator, value } = condition;
    const userValue = user[field];

    switch (operator) {
      case 'equals':
        return {
          matches: userValue === value,
          reason: `${field} = ${userValue} ${userValue === value ? '等于' : '不等于'} ${value}`
        };
      
      case 'not_equals':
        return {
          matches: userValue !== value,
          reason: `${field} = ${userValue} ${userValue !== value ? '不等于' : '等于'} ${value}`
        };
      
      case 'in':
        const inValues = Array.isArray(value) ? value : [value];
        const inResult = inValues.includes(userValue);
        return {
          matches: inResult,
          reason: `${field} = ${userValue} ${inResult ? '在' : '不在'} [${inValues.join(', ')}] 中`
        };
      
      case 'not_in':
        const notInValues = Array.isArray(value) ? value : [value];
        const notInResult = !notInValues.includes(userValue);
        return {
          matches: notInResult,
          reason: `${field} = ${userValue} ${notInResult ? '不在' : '在'} [${notInValues.join(', ')}] 中`
        };
      
      case 'greater_than':
        const gtValue = Number(value);
        const gtUserValue = Number(userValue);
        const gtResult = gtUserValue > gtValue;
        return {
          matches: gtResult,
          reason: `${field} = ${gtUserValue} ${gtResult ? '大于' : '不大于'} ${gtValue}`
        };
      
      case 'greater_than_or_equals':
        const gteValue = Number(value);
        const gteUserValue = Number(userValue);
        const gteResult = gteUserValue >= gteValue;
        return {
          matches: gteResult,
          reason: `${field} = ${gteUserValue} ${gteResult ? '大于等于' : '小于'} ${gteValue}`
        };
      
      case 'less_than':
        const ltValue = Number(value);
        const ltUserValue = Number(userValue);
        const ltResult = ltUserValue < ltValue;
        return {
          matches: ltResult,
          reason: `${field} = ${ltUserValue} ${ltResult ? '小于' : '不小于'} ${ltValue}`
        };
      
      case 'less_than_or_equals':
        const lteValue = Number(value);
        const lteUserValue = Number(userValue);
        const lteResult = lteUserValue <= lteValue;
        return {
          matches: lteResult,
          reason: `${field} = ${lteUserValue} ${lteResult ? '小于等于' : '大于'} ${lteValue}`
        };
      
      case 'contains':
        const containsResult = String(userValue).includes(String(value));
        return {
          matches: containsResult,
          reason: `${field} = ${userValue} ${containsResult ? '包含' : '不包含'} ${value}`
        };
      
      case 'has_tag':
        const userTags = Array.isArray(userValue) ? userValue : [];
        const hasTagResult = userTags.includes(value);
        return {
          matches: hasTagResult,
          reason: `标签 [${userTags.join(', ')}] ${hasTagResult ? '包含' : '不包含'} ${value}`
        };
      
      default:
        return {
          matches: false,
          reason: `未知的操作符: ${operator}`
        };
    }
  }

  evaluateFlagForUser(user, flag, allFlags, allSegments) {
    const evaluationSteps = [];
    let finalResult = false;
    let finalReason = '';
    let overrideReason = null;

    evaluationSteps.push({
      step: '开始评估',
      flagKey: flag.key,
      flagName: flag.name,
      timestamp: new Date().toISOString()
    });

    if (flag.killSwitch) {
      evaluationSteps.push({
        step: 'Kill Switch 检查',
        result: false,
        reason: 'Kill Switch 已启用，强制关闭此 Flag'
      });
      finalResult = false;
      finalReason = 'Kill Switch 已启用';
      overrideReason = 'Kill Switch 覆盖';
      return this.buildEvaluationResult(
        user, flag, finalResult, finalReason, overrideReason, evaluationSteps
      );
    }
    evaluationSteps.push({
      step: 'Kill Switch 检查',
      result: true,
      reason: 'Kill Switch 未启用'
    });

    if (flag.dependsOn && flag.dependsOn.length > 0) {
      const dependencyResults = [];
      let allDependenciesMet = true;

      for (const depFlagKey of flag.dependsOn) {
        const depFlag = allFlags.find(f => f.key === depFlagKey);
        
        if (!depFlag) {
          dependencyResults.push({
            flagKey: depFlagKey,
            result: false,
            reason: `依赖的 Flag ${depFlagKey} 不存在`
          });
          allDependenciesMet = false;
          continue;
        }

        const depEvaluation = this.evaluateFlagForUser(
          user, depFlag, allFlags, allSegments
        );
        
        dependencyResults.push({
          flagKey: depFlagKey,
          flagName: depFlag.name,
          result: depEvaluation.result,
          reason: depEvaluation.reason
        });

        if (!depEvaluation.result) {
          allDependenciesMet = false;
        }
      }

      evaluationSteps.push({
        step: '依赖检查',
        result: allDependenciesMet,
        dependencies: dependencyResults,
        reason: allDependenciesMet 
          ? '所有依赖 Flag 都已启用' 
          : '存在未启用的依赖 Flag'
      });

      if (!allDependenciesMet) {
        finalResult = false;
        finalReason = '依赖的 Flag 未全部启用';
        overrideReason = '依赖检查未通过';
        return this.buildEvaluationResult(
          user, flag, finalResult, finalReason, overrideReason, evaluationSteps
        );
      }
    } else {
      evaluationSteps.push({
        step: '依赖检查',
        result: true,
        reason: '无依赖配置'
      });
    }

    if (!flag.enabled) {
      evaluationSteps.push({
        step: '全局开关检查',
        result: false,
        reason: 'Flag 全局开关已关闭'
      });
      finalResult = false;
      finalReason = 'Flag 全局开关已关闭';
      return this.buildEvaluationResult(
        user, flag, finalResult, finalReason, overrideReason, evaluationSteps
      );
    }
    evaluationSteps.push({
      step: '全局开关检查',
      result: true,
      reason: 'Flag 全局开关已开启'
    });

    if (flag.segments && flag.segments.length > 0) {
      const segmentResults = [];
      let matchedAnySegment = false;
      let matchedSegment = null;

      for (const segmentId of flag.segments) {
        const segment = allSegments.find(s => s.id === segmentId);
        
        if (!segment) {
          segmentResults.push({
            segmentId,
            result: false,
            reason: `Segment ${segmentId} 不存在`
          });
          continue;
        }

        const segmentEvaluation = this.evaluateUserInSegment(user, segment);
        segmentResults.push(segmentEvaluation);

        if (segmentEvaluation.matches) {
          matchedAnySegment = true;
          matchedSegment = segmentEvaluation;
        }
      }

      evaluationSteps.push({
        step: 'Segment 匹配检查',
        result: matchedAnySegment,
        segments: segmentResults,
        reason: matchedAnySegment 
          ? `命中 Segment: ${matchedSegment.segmentName}` 
          : '未命中任何配置的 Segment'
      });

      if (matchedAnySegment) {
        finalResult = true;
        finalReason = `命中 Segment: ${matchedSegment.segmentName}`;
        return this.buildEvaluationResult(
          user, flag, finalResult, finalReason, overrideReason, evaluationSteps
        );
      }
    } else {
      evaluationSteps.push({
        step: 'Segment 匹配检查',
        result: true,
        reason: '无 Segment 配置，跳过'
      });
    }

    if (flag.percentage !== undefined && flag.percentage !== null) {
      const bucket = hashService.getBucket(user.id, flag.key);
      const inPercentage = bucket <= flag.percentage;

      evaluationSteps.push({
        step: '百分比灰度检查',
        result: inPercentage,
        bucket,
        percentage: flag.percentage,
        reason: inPercentage 
          ? `分桶 ${bucket} <= ${flag.percentage}%，命中灰度` 
          : `分桶 ${bucket} > ${flag.percentage}%，未命中灰度`
      });

      finalResult = inPercentage;
      finalReason = inPercentage 
        ? `分桶 ${bucket} <= ${flag.percentage}%，命中灰度` 
        : `分桶 ${bucket} > ${flag.percentage}%，未命中灰度`;
      return this.buildEvaluationResult(
        user, flag, finalResult, finalReason, overrideReason, evaluationSteps
      );
    }

    evaluationSteps.push({
      step: '最终结果',
      result: true,
      reason: 'Flag 已启用且无限制条件'
    });
    finalResult = true;
    finalReason = 'Flag 已启用且无限制条件';

    return this.buildEvaluationResult(
      user, flag, finalResult, finalReason, overrideReason, evaluationSteps
    );
  }

  buildEvaluationResult(user, flag, result, reason, overrideReason, steps) {
    return {
      flagId: flag.id,
      flagKey: flag.key,
      flagName: flag.name,
      userId: user.id,
      userName: user.name,
      result,
      reason,
      overrideReason,
      steps,
      timestamp: new Date().toISOString()
    };
  }

  evaluateAllFlagsForUser(user, allFlags, allSegments) {
    const results = [];
    const flagMap = new Map();

    for (const flag of allFlags) {
      flagMap.set(flag.key, flag);
    }

    for (const flag of allFlags) {
      const evaluation = this.evaluateFlagForUser(user, flag, allFlags, allSegments);
      results.push(evaluation);
    }

    return results;
  }

  evaluateBatch(users, allFlags, allSegments) {
    const results = [];
    
    for (const user of users) {
      const userResults = this.evaluateAllFlagsForUser(user, allFlags, allSegments);
      results.push({
        user,
        evaluations: userResults
      });
    }

    return results;
  }

  analyzeBatchResults(batchResults, allFlags) {
    const flagStats = new Map();
    const conflicts = [];
    const anomalies = [];

    for (const flag of allFlags) {
      flagStats.set(flag.key, {
        flagId: flag.id,
        flagKey: flag.key,
        flagName: flag.name,
        total: 0,
        enabled: 0,
        disabled: 0,
        killSwitchOverride: 0,
        dependencyBlocked: 0,
        percentageMissed: 0,
        segmentMissed: 0,
        globalDisabled: 0
      });
    }

    for (const result of batchResults) {
      const { user, evaluations } = result;

      for (const evaluation of evaluations) {
        const stats = flagStats.get(evaluation.flagKey);
        if (stats) {
          stats.total++;
          
          if (evaluation.result) {
            stats.enabled++;
          } else {
            stats.disabled++;
          }

          if (evaluation.overrideReason === 'Kill Switch 覆盖') {
            stats.killSwitchOverride++;
          }
          if (evaluation.reason.includes('依赖')) {
            stats.dependencyBlocked++;
          }
          if (evaluation.reason.includes('分桶')) {
            stats.percentageMissed++;
          }
          if (evaluation.reason.includes('Segment')) {
            stats.segmentMissed++;
          }
          if (evaluation.reason.includes('全局开关')) {
            stats.globalDisabled++;
          }
        }
      }

      const enabledFlags = evaluations.filter(e => e.result);
      const disabledFlags = evaluations.filter(e => !e.result);

      const overrideFlags = evaluations.filter(e => e.overrideReason);
      if (overrideFlags.length > 0) {
        conflicts.push({
          user,
          overrideFlags: overrideFlags.map(f => ({
            flagKey: f.flagKey,
            flagName: f.flagName,
            overrideReason: f.overrideReason,
            originalReason: f.reason
          }))
        });
      }

      const userAnomalies = [];
      
      const killSwitchEnabled = evaluations.filter(e => e.overrideReason === 'Kill Switch 覆盖');
      if (killSwitchEnabled.length > 0) {
        userAnomalies.push({
          type: 'kill_switch',
          message: `${killSwitchEnabled.length} 个 Flag 被 Kill Switch 覆盖`,
          flags: killSwitchEnabled.map(f => f.flagKey)
        });
      }

      const dependencyBlocked = evaluations.filter(e => 
        e.reason.includes('依赖') && !e.result
      );
      if (dependencyBlocked.length > 0) {
        userAnomalies.push({
          type: 'dependency_blocked',
          message: `${dependencyBlocked.length} 个 Flag 被依赖关系阻止`,
          flags: dependencyBlocked.map(f => f.flagKey)
        });
      }

      if (userAnomalies.length > 0) {
        anomalies.push({
          user,
          anomalies: userAnomalies,
          evaluations
        });
      }
    }

    return {
      flagStats: Array.from(flagStats.values()),
      conflicts,
      anomalies,
      totalUsers: batchResults.length,
      totalFlags: allFlags.length
    };
  }
}

export const evaluationEngine = new EvaluationEngine();
