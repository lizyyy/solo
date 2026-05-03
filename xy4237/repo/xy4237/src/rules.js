const chalk = require('chalk');

class RuleEngine {
  constructor(options = {}) {
    this.options = {
      maxSceneChangeTime: 120,
      dangerousItemsRequireConfirmation: true,
      checkResponsible: true,
      ...options
    };

    this.rules = [
      this.ruleMissingResponsible,
      this.ruleDangerousItemUnconfirmed,
      this.ruleSceneChangeTimeExceeded,
      this.ruleDuplicateCues,
      this.ruleMissingSceneProps,
      this.ruleTimeGap,
      this.rulePriorityMissing,
      this.ruleActorConflict
    ];
  }

  async checkAll(tasks, parsedData, options = {}) {
    const result = {
      issues: [],
      warnings: [],
      stats: {
        totalRules: this.rules.length,
        issuesFound: 0,
        warningsFound: 0
      }
    };

    console.log(chalk.gray('  运行规则检查...'));

    // 按场景分组
    const byScene = this._groupByScene(tasks);
    
    // 执行所有规则
    for (const rule of this.rules) {
      try {
        const ruleResult = rule.call(this, tasks, parsedData, byScene, options);
        result.issues.push(...(ruleResult.issues || []));
        result.warnings.push(...(ruleResult.warnings || []));
      } catch (error) {
        console.error(chalk.red(`规则执行错误: ${error.message}`));
      }
    }

    result.stats.issuesFound = result.issues.length;
    result.stats.warningsFound = result.warnings.length;

    console.log(chalk.gray(`  检测完成: ${result.issues.length} 个问题, ${result.warnings.length} 个警告`));

    return result;
  }

  _groupByScene(tasks) {
    const groups = {};
    
    tasks.forEach(task => {
      const scene = task.scene || 'unknown';
      if (!groups[scene]) {
        groups[scene] = [];
      }
      groups[scene].push(task);
    });

    return groups;
  }

  // 规则1: 检查负责人缺失
  ruleMissingResponsible(tasks, parsedData, byScene, options) {
    const issues = [];
    const warnings = [];

    if (!this.options.checkResponsible) return { issues, warnings };

    // 危险道具必须有负责人
    const dangerousTasks = tasks.filter(t => t.isDangerous);
    dangerousTasks.forEach(task => {
      if (!task.responsible) {
        issues.push({
          type: 'error',
          rule: 'missing_responsible',
          severity: 'high',
          message: `危险道具"${task.name}"缺少负责人`,
          taskId: task.id,
          task: task,
          category: 'responsibility',
          suggestion: '请为危险道具指定明确的负责人'
        });
      }
    });

    // 其他任务缺少负责人是警告
    const otherTasks = tasks.filter(t => !t.isDangerous && t.type !== 'lighting');
    otherTasks.forEach(task => {
      if (!task.responsible) {
        warnings.push({
          type: 'warning',
          rule: 'missing_responsible_warning',
          severity: 'low',
          message: `"${task.name}"未指定负责人`,
          taskId: task.id,
          task: task,
          category: 'responsibility',
          suggestion: '建议为每个任务指定负责人'
        });
      }
    });

    return { issues, warnings };
  }

  // 规则2: 检查危险道具未确认
  ruleDangerousItemUnconfirmed(tasks, parsedData, byScene, options) {
    const issues = [];
    const warnings = [];

    if (!this.options.dangerousItemsRequireConfirmation) return { issues, warnings };

    const dangerousTasks = tasks.filter(t => t.isDangerous);
    
    dangerousTasks.forEach(task => {
      if (!task.confirmed) {
        issues.push({
          type: 'error',
          rule: 'dangerous_unconfirmed',
          severity: 'critical',
          message: `危险道具"${task.name}"未经确认`,
          taskId: task.id,
          task: task,
          category: 'safety',
          suggestion: '危险道具必须双人确认后方可使用，请立即复核'
        });
      }
    });

    return { issues, warnings };
  }

  // 规则3: 检查换景时间超限
  ruleSceneChangeTimeExceeded(tasks, parsedData, byScene, options) {
    const issues = [];
    const warnings = [];

    // 计算每个场景的总换景时间
    for (const [scene, sceneTasks] of Object.entries(byScene)) {
      const changeTasks = sceneTasks.filter(t => t.type === 'prop' || t.type === 'actor');
      
      // 计算总时间（取所有任务时间的最大值或累加？）
      // 这里采用：如果有时间字段，检查是否超过阈值
      changeTasks.forEach(task => {
        const time = task.time_seconds || task.time || 0;
        
        if (time > this.options.maxSceneChangeTime) {
          issues.push({
            type: 'error',
            rule: 'time_exceeded',
            severity: 'high',
            message: `场景${scene}的"${task.name}"换景时间${time}秒超过阈值${this.options.maxSceneChangeTime}秒`,
            taskId: task.id,
            task: task,
            category: 'timing',
            suggestion: '建议优化换景流程或增加换景时间'
          });
        } else if (time > this.options.maxSceneChangeTime * 0.8) {
          warnings.push({
            type: 'warning',
            rule: 'time_near_limit',
            severity: 'medium',
            message: `场景${scene}的"${task.name}"换景时间${time}秒接近阈值`,
            taskId: task.id,
            task: task,
            category: 'timing',
            suggestion: '请预留充足时间，考虑应急预案'
          });
        }
      });
    }

    return { issues, warnings };
  }

  // 规则4: 检查重复Cue
  ruleDuplicateCues(tasks, parsedData, byScene, options) {
    const issues = [];
    const warnings = [];

    // 按场景检查重复cue
    for (const [scene, sceneTasks] of Object.entries(byScene)) {
      const cueMap = new Map();
      
      sceneTasks.forEach(task => {
        if (task.cue) {
          const cueKey = `${task.type}_${task.cue}`;
          
          if (cueMap.has(cueKey)) {
            const existing = cueMap.get(cueKey);
            issues.push({
              type: 'error',
              rule: 'duplicate_cue',
              severity: 'medium',
              message: `场景${scene}中Cue ${task.cue} 存在重复: "${existing.name}" 和 "${task.name}"`,
              taskId: task.id,
              relatedTaskId: existing.id,
              category: 'cue_conflict',
              suggestion: '请检查并修正重复的Cue编号'
            });
          } else {
            cueMap.set(cueKey, task);
          }
        }
      });
    }

    // 检查灯光cue编号连续性
    const lightingTasks = tasks.filter(t => t.type === 'lighting').sort((a, b) => {
      const numA = parseFloat(a.cue) || 0;
      const numB = parseFloat(b.cue) || 0;
      return numA - numB;
    });

    for (let i = 1; i < lightingTasks.length; i++) {
      const prevCue = parseFloat(lightingTasks[i - 1].cue) || 0;
      const currCue = parseFloat(lightingTasks[i].cue) || 0;
      
      if (currCue > prevCue + 1) {
        warnings.push({
          type: 'warning',
          rule: 'cue_gap',
          severity: 'low',
          message: `灯光Cue ${prevCue} 和 ${currCue} 之间存在编号缺口`,
          category: 'cue_gap',
          suggestion: '请确认是否有意跳过Cue编号'
        });
      }
    }

    return { issues, warnings };
  }

  // 规则5: 检查场景道具缺失（基于期望的场景道具）
  ruleMissingSceneProps(tasks, parsedData, byScene, options) {
    const issues = [];
    const warnings = [];

    // 检查是否有场景完全没有道具
    for (const [scene, sceneTasks] of Object.entries(byScene)) {
      if (scene === 'unknown') continue;
      
      const props = sceneTasks.filter(t => t.type === 'prop');
      
      if (props.length === 0) {
        // 检查这个场景是否在其他地方被引用
        const hasLighting = sceneTasks.some(t => t.type === 'lighting');
        const hasActors = sceneTasks.some(t => t.type === 'actor');
        
        if (hasLighting || hasActors) {
          warnings.push({
            type: 'warning',
            rule: 'scene_no_props',
            severity: 'low',
            message: `场景${scene}有灯光或演员，但没有道具任务`,
            category: 'completeness',
            suggestion: '请确认该场景是否需要道具检查'
          });
        }
      }
    }

    return { issues, warnings };
  }

  // 规则6: 检查时间缺口
  ruleTimeGap(tasks, parsedData, byScene, options) {
    const issues = [];
    const warnings = [];

    // 检查同一时间点的任务冲突
    const timeGroups = {};
    
    tasks.forEach(task => {
      const key = `${task.scene || 'unknown'}_${task.time || 0}`;
      if (!timeGroups[key]) {
        timeGroups[key] = [];
      }
      timeGroups[key].push(task);
    });

    for (const [key, timeTasks] of Object.entries(timeGroups)) {
      if (timeTasks.length > 3) {
        warnings.push({
          type: 'warning',
          rule: 'too_many_tasks',
          severity: 'medium',
          message: `时间点${key}有${timeTasks.length}个任务，可能造成拥堵`,
          tasks: timeTasks.map(t => t.name),
          category: 'congestion',
          suggestion: '建议分散任务时间点'
        });
      }
    }

    return { issues, warnings };
  }

  // 规则7: 检查优先级缺失
  rulePriorityMissing(tasks, parsedData, byScene, options) {
    const issues = [];
    const warnings = [];

    const tasksWithoutPriority = tasks.filter(t => !t.priority || t.priority === 'medium');
    
    // 高优先级任务应该被明确标记
    const highPriorityCount = tasks.filter(t => t.priority === 'high').length;
    
    if (highPriorityCount === 0 && tasks.length > 5) {
      warnings.push({
        type: 'warning',
        rule: 'no_high_priority',
        severity: 'low',
        message: '当前没有标记为高优先级的任务，建议明确重点任务',
        category: 'priority',
        suggestion: '请评估并标记关键任务为高优先级'
      });
    }

    return { issues, warnings };
  }

  // 规则8: 检查演员冲突
  ruleActorConflict(tasks, parsedData, byScene, options) {
    const issues = [];
    const warnings = [];

    const actorTasks = tasks.filter(t => t.type === 'actor');
    const actorMap = new Map();

    actorTasks.forEach(task => {
      if (task.name) {
        if (!actorMap.has(task.name)) {
          actorMap.set(task.name, []);
        }
        actorMap.get(task.name).push(task);
      }
    });

    // 检查同一演员在同一时间点的多个任务
    for (const [actor, actorTaskList] of actorMap.entries()) {
      const timeMap = new Map();
      
      actorTaskList.forEach(task => {
        const timeKey = `${task.scene || 'unknown'}_${task.cue || task.time || 0}`;
        
        if (timeMap.has(timeKey)) {
          const existing = timeMap.get(timeKey);
          issues.push({
            type: 'error',
            rule: 'actor_conflict',
            severity: 'high',
            message: `演员"${actor}"在同一时间点${timeKey}有冲突任务: "${existing.action}" 和 "${task.action}"`,
            taskId: task.id,
            category: 'actor_conflict',
            suggestion: '请检查演员出场时间是否冲突'
          });
        } else {
          timeMap.set(timeKey, task);
        }
      });
    }

    return { issues, warnings };
  }

  // 自定义规则添加
  addRule(ruleFunction) {
    this.rules.push(ruleFunction);
  }

  // 规则配置
  configure(options) {
    Object.assign(this.options, options);
  }
}

module.exports = RuleEngine;
