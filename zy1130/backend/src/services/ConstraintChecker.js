const timeUtils = require('../utils/time');

class ConstraintChecker {
  constructor(roadRulesData, travelTimeService) {
    this.roadRules = roadRulesData || {};
    this.travelTimeService = travelTimeService;
    this.constraints = roadRulesData.constraints || {};
  }

  checkAll(route, worker, jobs) {
    const issues = [];
    const warnings = [];
    
    const skillIssues = this.checkSkillMatch(route, worker, jobs);
    issues.push(...skillIssues);
    
    const timeWindowIssues = this.checkTimeWindows(route, worker, jobs);
    issues.push(...timeWindowIssues);
    
    const workHourIssues = this.checkWorkHours(route, worker, jobs);
    issues.push(...workHourIssues);
    
    const jobLimitIssues = this.checkJobLimit(route, worker);
    issues.push(...jobLimitIssues);
    
    const restrictionIssues = this.checkRestrictions(route, worker, jobs);
    issues.push(...restrictionIssues);
    
    const distanceWarning = this.checkMaxDistance(route, worker, jobs);
    warnings.push(...distanceWarning);
    
    const overtimeWarning = this.checkOvertime(route, worker, jobs);
    warnings.push(...overtimeWarning);
    
    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      riskScore: this.calculateRiskScore(issues, warnings)
    };
  }

  checkSkillMatch(route, worker, jobs) {
    const issues = [];
    
    for (const stop of route.stops || []) {
      if (stop.type === 'job') {
        const job = jobs[stop.jobId];
        if (job && !worker.canServeJob(job)) {
          issues.push({
            type: 'skill_mismatch',
            severity: 'error',
            jobId: stop.jobId,
            workerId: worker.id,
            message: `师傅 ${worker.name} 没有 ${job.serviceType} 技能，无法处理任务 ${job.clientName}`
          });
        }
      }
    }
    
    return issues;
  }

  checkTimeWindows(route, worker, jobs) {
    const issues = [];
    const lateThreshold = this.constraints.late_threshold_minutes || 15;
    
    for (const stop of route.stops || []) {
      if (stop.type === 'job' && stop.eta) {
        const job = jobs[stop.jobId];
        if (job) {
          const twStart = timeUtils.timeToMinutes(job.timeWindowStart);
          const twEnd = timeUtils.timeToMinutes(job.timeWindowEnd);
          const etaMinutes = timeUtils.timeToMinutes(stop.eta);
          
          if (etaMinutes > twEnd) {
            const lateMinutes = etaMinutes - twEnd;
            issues.push({
              type: lateMinutes > lateThreshold ? 'late_risk' : 'time_window_violation',
              severity: lateMinutes > lateThreshold ? 'error' : 'warning',
              jobId: stop.jobId,
              workerId: worker.id,
              eta: stop.eta,
              timeWindowEnd: job.timeWindowEnd,
              lateMinutes,
              message: lateMinutes > lateThreshold 
                ? `任务 ${job.clientName} 预计 ${stop.eta} 到达，迟到 ${lateMinutes} 分钟（时间窗截止 ${job.timeWindowEnd}）`
                : `任务 ${job.clientName} 接近时间窗截止，可能迟到`
            });
          }
        }
      }
    }
    
    return issues;
  }

  checkWorkHours(route, worker, jobs) {
    const issues = [];
    const workStart = timeUtils.timeToMinutes(worker.workStartTime);
    const workEnd = timeUtils.timeToMinutes(worker.workEndTime);
    
    if (route.stops && route.stops.length > 0) {
      const firstStop = route.stops[0];
      if (firstStop.eta) {
        const firstEta = timeUtils.timeToMinutes(firstStop.eta);
        if (firstEta < workStart) {
          issues.push({
            type: 'start_before_work',
            severity: 'error',
            workerId: worker.id,
            message: `师傅 ${worker.name} 的第一个任务在工作时间之前开始`
          });
        }
      }
      
      const lastStop = route.stops[route.stops.length - 1];
      if (lastStop.etd) {
        const lastEtd = timeUtils.timeToMinutes(lastStop.etd);
        if (lastEtd > workEnd) {
          issues.push({
            type: 'end_after_work',
            severity: 'error',
            workerId: worker.id,
            message: `师傅 ${worker.name} 的最后一个任务在工作时间之后结束`
          });
        }
      }
    }
    
    return issues;
  }

  checkJobLimit(route, worker) {
    const issues = [];
    const jobCount = (route.stops || []).filter(s => s.type === 'job').length;
    
    if (jobCount > worker.maxJobsPerDay) {
      issues.push({
        type: 'job_limit_exceeded',
        severity: 'error',
        workerId: worker.id,
        jobCount,
        maxJobs: worker.maxJobsPerDay,
        message: `师傅 ${worker.name} 分配了 ${jobCount} 个任务，超过每日最大限制 ${worker.maxJobsPerDay} 个`
      });
    }
    
    return issues;
  }

  checkRestrictions(route, worker, jobs) {
    const issues = [];
    
    for (const stop of route.stops || []) {
      if (stop.type === 'job' && stop.eta) {
        const job = jobs[stop.jobId];
        if (job && this.travelTimeService) {
          const restriction = this.travelTimeService.checkRestriction(
            job.lat, job.lng,
            worker.vehicleType,
            stop.eta
          );
          
          if (restriction.restricted) {
            issues.push({
              type: 'restriction_violation',
              severity: 'error',
              jobId: stop.jobId,
              workerId: worker.id,
              zone: restriction.zone,
              restriction: restriction.restriction,
              timeRange: restriction.timeRange,
              message: `师傅 ${worker.name} 在限行时间内访问 ${job.address}（${restriction.zone}，${restriction.timeRange}）`
            });
          }
        }
      }
    }
    
    return issues;
  }

  checkMaxDistance(route, worker, jobs) {
    const warnings = [];
    const maxDistance = this.constraints.max_travel_distance_per_day_km || 50;
    
    if (route.totalDistanceKm && route.totalDistanceKm > maxDistance) {
      warnings.push({
        type: 'distance_exceeded',
        severity: 'warning',
        workerId: worker.id,
        distance: route.totalDistanceKm,
        maxDistance,
        message: `师傅 ${worker.name} 当日行程 ${route.totalDistanceKm.toFixed(1)} 公里，接近或超过建议最大距离 ${maxDistance} 公里`
      });
    }
    
    return warnings;
  }

  checkOvertime(route, worker, jobs) {
    const warnings = [];
    const overtimeThreshold = this.constraints.overtime_threshold_minutes || 30;
    
    if (route.totalDurationMinutes) {
      const workDuration = timeUtils.timeToMinutes(worker.workEndTime) - timeUtils.timeToMinutes(worker.workStartTime);
      
      if (route.totalDurationMinutes > workDuration + overtimeThreshold) {
        warnings.push({
          type: 'overtime_risk',
          severity: 'warning',
          workerId: worker.id,
          duration: route.totalDurationMinutes,
          workDuration,
          message: `师傅 ${worker.name} 当日预计工作时长 ${Math.round(route.totalDurationMinutes / 60)} 小时，存在加班风险`
        });
      }
    }
    
    return warnings;
  }

  calculateRiskScore(issues, warnings) {
    let score = 0;
    
    issues.forEach(issue => {
      if (issue.severity === 'error') {
        score += 100;
      } else {
        score += 30;
      }
    });
    
    warnings.forEach(warning => {
      score += 10;
    });
    
    return Math.min(100, score);
  }

  checkSingleJobInsertion(route, worker, job, insertPosition, jobs) {
    const tempRoute = JSON.parse(JSON.stringify(route));
    
    if (!tempRoute.stops) tempRoute.stops = [];
    
    tempRoute.stops.splice(insertPosition, 0, {
      type: 'job',
      jobId: job.id,
      eta: null,
      etd: null
    });
    
    return this.checkAll(tempRoute, worker, jobs);
  }
}

module.exports = ConstraintChecker;
