import { SCORING_RULES, PRIORITY_WEIGHTS, TASK_TYPES, TASK_TYPE_INFO, PRIORITY_LEVELS } from './constants.js';
import { calculateDistance, deepClone, percentage } from './utils.js';

class RulesEngine {
  constructor() {
    this.state = null;
  }

  setState(state) {
    this.state = deepClone(state);
  }

  validateScheduling() {
    if (!this.state) {
      return { valid: false, errors: ['状态未设置'] };
    }
    
    const errors = [];
    const warnings = [];
    const conflicts = [];
    
    const scheduledTasks = this.state.tasks.filter(t => t.scheduled);
    const unscheduledTasks = this.state.tasks.filter(t => !t.scheduled);
    
    if (unscheduledTasks.length > 0) {
      warnings.push(`还有 ${unscheduledTasks.length} 个任务未调度`);
    }
    
    const channelConflicts = this.detectChannelConflicts();
    if (channelConflicts.length > 0) {
      errors.push('存在频道冲突');
      conflicts.push(...channelConflicts);
    }
    
    const interferenceConflicts = this.detectInterference();
    if (interferenceConflicts.length > 0) {
      errors.push('存在同频干扰');
      conflicts.push(...interferenceConflicts);
    }
    
    const batteryIssues = this.checkBatteryStatus();
    if (batteryIssues.warnings.length > 0) {
      warnings.push(...batteryIssues.warnings);
    }
    if (batteryIssues.errors.length > 0) {
      errors.push(...batteryIssues.errors);
    }
    
    const coverageIssues = this.checkCoverage();
    if (coverageIssues.warnings.length > 0) {
      warnings.push(...coverageIssues.warnings);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      conflicts,
      scheduledCount: scheduledTasks.length,
      unscheduledCount: unscheduledTasks.length,
      totalTasks: this.state.tasks.length
    };
  }

  detectChannelConflicts() {
    const conflicts = [];
    const { schedule, tasks } = this.state;
    
    const slotOccupancy = new Map();
    
    for (const [key, taskId] of Object.entries(schedule)) {
      const { channel, slot } = this.parseScheduleKey(key);
      const slotKey = `${channel}-${slot}`;
      
      if (slotOccupancy.has(slotKey)) {
        conflicts.push({
          type: 'duplicate_slot',
          channel,
          slot,
          task1: slotOccupancy.get(slotKey),
          task2: taskId,
          message: `频道 ${channel + 1} 时隙 ${slot + 1} 存在重复占用`
        });
      } else {
        slotOccupancy.set(slotKey, taskId);
      }
    }
    
    return conflicts;
  }

  detectInterference() {
    const conflicts = [];
    const { schedule, tasks } = this.state;
    
    const scheduledByChannel = new Map();
    
    for (const [key, taskId] of Object.entries(schedule)) {
      const { channel, slot } = this.parseScheduleKey(key);
      
      if (!scheduledByChannel.has(channel)) {
        scheduledByChannel.set(channel, []);
      }
      
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        scheduledByChannel.get(channel).push({
          task,
          slot,
          key
        });
      }
    }
    
    for (const [channel, channelTasks] of scheduledByChannel.entries()) {
      const slotsUsed = new Set();
      
      for (const ct of channelTasks) {
        if (slotsUsed.has(ct.slot)) {
          const dupTask = channelTasks.find(t => t.slot === ct.slot && t.task.id !== ct.task.id);
          if (dupTask) {
            conflicts.push({
              type: 'same_channel_interference',
              channel,
              slot: ct.slot,
              task1: ct.task.id,
              task2: dupTask.task.id,
              message: `频道 ${channel + 1} 时隙 ${ct.slot + 1} 存在同频干扰: ${ct.task.name} 与 ${dupTask.task.name}`
            });
          }
        }
        slotsUsed.add(ct.slot);
      }
      
      for (let i = 0; i < channelTasks.length; i++) {
        for (let j = i + 1; j < channelTasks.length; j++) {
          const t1 = channelTasks[i];
          const t2 = channelTasks[j];
          
          if (this.checkProximityInterference(t1.task, t2.task)) {
            conflicts.push({
              type: 'proximity_interference',
              channel,
              slots: [t1.slot, t2.slot],
              task1: t1.task.id,
              task2: t2.task.id,
              message: `频道 ${channel + 1} 中 ${t1.task.name} 与 ${t2.task.name} 距离过近，可能产生干扰`
            });
          }
        }
      }
    }
    
    return conflicts;
  }

  checkProximityInterference(task1, task2) {
    if (!task1.position || !task2.position) {
      return false;
    }
    
    const distance = calculateDistance(
      task1.position.x, task1.position.y,
      task2.position.x, task2.position.y
    );
    
    const minSafeDistance = Math.max(task1.coverageRadius, task2.coverageRadius) * 1.5;
    
    return distance < minSafeDistance;
  }

  checkBatteryStatus() {
    const warnings = [];
    const errors = [];
    
    const scheduledTasks = this.state.tasks.filter(t => t.scheduled);
    const totalPowerConsumption = scheduledTasks.reduce(
      (sum, task) => sum + task.powerConsumption,
      0
    );
    
    const remainingBattery = this.state.battery - totalPowerConsumption;
    
    if (remainingBattery < 0) {
      errors.push(`电量不足: 需要 ${totalPowerConsumption}%，当前只有 ${this.state.battery}%`);
    } else if (remainingBattery < 20) {
      warnings.push(`电量紧张: 剩余电量仅 ${remainingBattery}%`);
    }
    
    return { warnings, errors, remainingBattery, totalPowerConsumption };
  }

  checkCoverage() {
    const warnings = [];
    
    const scheduledTasks = this.state.tasks.filter(t => t.scheduled);
    
    if (scheduledTasks.length === 0) {
      return { warnings };
    }
    
    const stations = scheduledTasks.filter(t => t.type === TASK_TYPES.STATION);
    
    for (const task of scheduledTasks) {
      if (task.type === TASK_TYPES.STATION) continue;
      
      let hasCoverage = stations.length === 0;
      
      for (const station of stations) {
        const distance = calculateDistance(
          task.position.x, task.position.y,
          station.position.x, station.position.y
        );
        
        if (distance <= station.coverageRadius) {
          hasCoverage = true;
          break;
        }
      }
      
      if (!hasCoverage) {
        warnings.push(`${task.name} 不在任何基站覆盖范围内`);
      }
    }
    
    return { warnings };
  }

  calculateScore() {
    if (!this.state) {
      return { score: 0, breakdown: {} };
    }
    
    const score = {
      total: 0,
      breakdown: {},
      details: []
    };
    
    const scheduledTasks = this.state.tasks.filter(t => t.scheduled);
    const highPriorityTasks = scheduledTasks.filter(
      t => t.priority === PRIORITY_LEVELS.HIGH
    );
    
    const placedScore = scheduledTasks.length * SCORING_RULES.TASK_PLACED;
    score.breakdown.taskPlacement = placedScore;
    score.total += placedScore;
    score.details.push({
      category: '任务调度',
      points: placedScore,
      description: `成功调度 ${scheduledTasks.length} 个任务`
    });
    
    const highPriorityCount = highPriorityTasks.length;
    if (highPriorityCount > 0) {
      const highPriorityScore = highPriorityCount * SCORING_RULES.HIGH_PRIORITY_FIRST;
      score.breakdown.highPriority = highPriorityScore;
      score.total += highPriorityScore;
      score.details.push({
        category: '优先级处理',
        points: highPriorityScore,
        description: `处理了 ${highPriorityCount} 个高优先级任务`
      });
    }
    
    const interferenceConflicts = this.detectInterference();
    if (interferenceConflicts.length === 0) {
      score.breakdown.noInterference = SCORING_RULES.NO_INTERFERENCE;
      score.total += SCORING_RULES.NO_INTERFERENCE;
      score.details.push({
        category: '无干扰奖励',
        points: SCORING_RULES.NO_INTERFERENCE,
        description: '调度方案无同频干扰'
      });
    } else {
      const penalty = interferenceConflicts.length * SCORING_RULES.INTERFERENCE_PENALTY;
      score.breakdown.interferencePenalty = penalty;
      score.total += penalty;
      score.details.push({
        category: '干扰惩罚',
        points: penalty,
        description: `存在 ${interferenceConflicts.length} 处同频干扰`
      });
    }
    
    const batteryCheck = this.checkBatteryStatus();
    const remainingRatio = batteryCheck.remainingBattery / 100;
    if (remainingRatio >= 0.5) {
      const powerScore = Math.floor(remainingRatio * SCORING_RULES.POWER_EFFICIENT);
      score.breakdown.powerEfficiency = powerScore;
      score.total += powerScore;
      score.details.push({
        category: '电量效率',
        points: powerScore,
        description: `剩余电量 ${batteryCheck.remainingBattery}%，效率良好`
      });
    } else if (remainingRatio < 0) {
      score.breakdown.powerPenalty = SCORING_RULES.HIGH_POWER_PENALTY;
      score.total += SCORING_RULES.HIGH_POWER_PENALTY;
      score.details.push({
        category: '电量惩罚',
        points: SCORING_RULES.HIGH_POWER_PENALTY,
        description: '电量不足，无法支持所有任务'
      });
    }
    
    const coverageCheck = this.checkCoverage();
    if (coverageCheck.warnings.length === 0 && scheduledTasks.length > 0) {
      score.breakdown.coverageEfficiency = SCORING_RULES.COVERAGE_EFFICIENT;
      score.total += SCORING_RULES.COVERAGE_EFFICIENT;
      score.details.push({
        category: '覆盖效率',
        points: SCORING_RULES.COVERAGE_EFFICIENT,
        description: '所有任务均在信号覆盖范围内'
      });
    } else if (coverageCheck.warnings.length > 0) {
      const penalty = coverageCheck.warnings.length * SCORING_RULES.LOW_COVERAGE_PENALTY;
      score.breakdown.coveragePenalty = penalty;
      score.total += penalty;
      score.details.push({
        category: '覆盖惩罚',
        points: penalty,
        description: `${coverageCheck.warnings.length} 个任务不在信号覆盖范围内`
      });
    }
    
    const unscheduledTasks = this.state.tasks.filter(t => !t.scheduled);
    if (unscheduledTasks.length > 0) {
      const penalty = unscheduledTasks.length * SCORING_RULES.DUPLICATE_PENALTY;
      score.breakdown.unscheduledPenalty = penalty;
      score.total += penalty;
      score.details.push({
        category: '未调度惩罚',
        points: penalty,
        description: `${unscheduledTasks.length} 个任务未被调度`
      });
    }
    
    const channelConflicts = this.detectChannelConflicts();
    if (channelConflicts.length > 0) {
      const penalty = channelConflicts.length * SCORING_RULES.DUPLICATE_PENALTY;
      score.breakdown.channelConflictPenalty = penalty;
      score.total += penalty;
      score.details.push({
        category: '频道冲突',
        points: penalty,
        description: `存在 ${channelConflicts.length} 处频道冲突`
      });
    }
    
    score.total = Math.max(0, score.total);
    
    return score;
  }

  generateReport() {
    const validation = this.validateScheduling();
    const score = this.calculateScore();
    
    const scheduledTasks = this.state.tasks.filter(t => t.scheduled);
    const unscheduledTasks = this.state.tasks.filter(t => !t.scheduled);
    
    const totalSlots = this.state.channels * this.state.slots;
    const usedSlots = Object.keys(this.state.schedule).length;
    const utilizationRate = percentage(usedSlots, totalSlots);
    
    const taskTypeStats = {
      [TASK_TYPES.RESCUE]: 0,
      [TASK_TYPES.HOSPITAL]: 0,
      [TASK_TYPES.STATION]: 0
    };
    
    scheduledTasks.forEach(task => {
      taskTypeStats[task.type]++;
    });
    
    const optimizations = [];
    
    if (unscheduledTasks.length > 0) {
      optimizations.push({
        type: 'unscheduled',
        message: `还有 ${unscheduledTasks.length} 个任务未调度，尝试将它们放置在空闲时隙中`
      });
    }
    
    const interferenceConflicts = this.detectInterference();
    if (interferenceConflicts.length > 0) {
      optimizations.push({
        type: 'interference',
        message: `存在 ${interferenceConflicts.length} 处同频干扰，建议将干扰任务分配到不同频道`
      });
    }
    
    const batteryCheck = this.checkBatteryStatus();
    if (batteryCheck.remainingBattery < 30) {
      optimizations.push({
        type: 'battery',
        message: '电量紧张，考虑减少高功耗设备（临时基站）的使用'
      });
    }
    
    const stations = scheduledTasks.filter(t => t.type === TASK_TYPES.STATION);
    if (stations.length === 0 && scheduledTasks.length > 0) {
      optimizations.push({
        type: 'coverage',
        message: '没有部署基站，考虑至少放置一个基站以提供信号覆盖'
      });
    }
    
    const highPriorityUnscheduled = unscheduledTasks.filter(
      t => t.priority === PRIORITY_LEVELS.HIGH
    );
    if (highPriorityUnscheduled.length > 0) {
      optimizations.push({
        type: 'priority',
        message: `${highPriorityUnscheduled.length} 个高优先级任务未被调度，优先处理这些任务`
      });
    }
    
    return {
      score: score.total,
      scoreBreakdown: score.breakdown,
      scoreDetails: score.details,
      validation: {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        conflicts: validation.conflicts
      },
      stats: {
        totalTasks: this.state.tasks.length,
        scheduledTasks: scheduledTasks.length,
        unscheduledTasks: unscheduledTasks.length,
        channels: this.state.channels,
        slots: this.state.slots,
        totalSlots,
        usedSlots,
        utilizationRate,
        taskTypeStats,
        remainingBattery: batteryCheck.remainingBattery,
        totalPowerConsumption: batteryCheck.totalPowerConsumption
      },
      optimizations
    };
  }

  parseScheduleKey(key) {
    const [channel, slot] = key.split('-').map(Number);
    return { channel, slot };
  }
}

export const rulesEngine = new RulesEngine();
export default RulesEngine;
