/**
 * 状态机检查器
 * 检查不可达状态、无出口非终态、冲突转换等
 */
class StateMachineChecker {
  /**
   * 运行所有检查
   * @param {Object} machine - 规范化的状态机对象
   * @returns {Object} 检查结果
   */
  checkAll(machine) {
    const results = {
      machine: {
        name: machine.name,
        stateCount: Object.keys(machine.states).length,
        eventCount: Object.keys(machine.events).length
      },
      checks: []
    };
    
    // 执行各项检查
    results.checks.push(this.checkUnreachableStates(machine));
    results.checks.push(this.checkDeadEndStates(machine));
    results.checks.push(this.checkConflictingTransitions(machine));
    results.checks.push(this.checkMissingTargetStates(machine));
    results.checks.push(this.checkDuplicateTransitions(machine));
    
    // 汇总结果
    const allIssues = [];
    let hasErrors = false;
    let hasWarnings = false;
    
    for (const check of results.checks) {
      allIssues.push(...check.issues);
      if (check.severity === 'error' && check.issues.length > 0) {
        hasErrors = true;
      }
      if (check.severity === 'warning' && check.issues.length > 0) {
        hasWarnings = true;
      }
    }
    
    results.summary = {
      totalChecks: results.checks.length,
      totalIssues: allIssues.length,
      hasErrors,
      hasWarnings,
      overall: hasErrors ? 'fail' : (hasWarnings ? 'warning' : 'pass')
    };
    
    return results;
  }
  
  /**
   * 检查不可达状态
   * @param {Object} machine - 规范化的状态机对象
   * @returns {Object} 检查结果
   */
  checkUnreachableStates(machine) {
    const reachable = new Set();
    const queue = [machine.initialState];
    reachable.add(machine.initialState);
    
    // BFS 遍历可达状态
    while (queue.length > 0) {
      const current = queue.shift();
      const stateDef = machine.states[current];
      
      if (!stateDef) continue;
      
      // 收集所有目标状态
      const targets = new Set();
      for (const transitions of Object.values(stateDef.on)) {
        for (const transition of transitions) {
          targets.add(transition.target);
        }
      }
      
      // 添加未访问的目标状态
      for (const target of targets) {
        if (!reachable.has(target)) {
          reachable.add(target);
          queue.push(target);
        }
      }
    }
    
    // 找出不可达状态
    const allStates = Object.keys(machine.states);
    const unreachableStates = allStates.filter(s => !reachable.has(s));
    
    const issues = unreachableStates.map(stateId => ({
      type: 'unreachable_state',
      state: stateId,
      stateInfo: machine.states[stateId],
      message: `状态 "${machine.states[stateId]?.name || stateId}" 不可达`,
      location: {
        state: stateId
      }
    }));
    
    return {
      id: 'unreachable_states',
      name: '不可达状态检查',
      description: '检查是否存在从初始状态无法到达的状态',
      severity: 'warning',
      passed: issues.length === 0,
      count: issues.length,
      issues
    };
  }
  
  /**
   * 检查无出口的非终态（死端状态）
   * @param {Object} machine - 规范化的状态机对象
   * @returns {Object} 检查结果
   */
  checkDeadEndStates(machine) {
    const issues = [];
    
    for (const [stateId, stateDef] of Object.entries(machine.states)) {
      // 终态可以没有出口
      if (stateDef.type === 'final') {
        continue;
      }
      
      // 检查是否有任何出边
      const hasOutTransitions = Object.keys(stateDef.on).length > 0;
      
      if (!hasOutTransitions) {
        issues.push({
          type: 'dead_end_state',
          state: stateId,
          stateInfo: stateDef,
          message: `非终态 "${stateDef.name}" 没有出口转换`,
          detail: '非终态应该定义至少一个出转换，否则状态机将在这里卡住',
          location: {
            state: stateId
          }
        });
      }
    }
    
    return {
      id: 'dead_end_states',
      name: '死端状态检查',
      description: '检查是否存在无出口的非终态（会导致状态机卡住）',
      severity: 'warning',
      passed: issues.length === 0,
      count: issues.length,
      issues
    };
  }
  
  /**
   * 检查同一事件下的冲突转换
   * @param {Object} machine - 规范化的状态机对象
   * @returns {Object} 检查结果
   */
  checkConflictingTransitions(machine) {
    const issues = [];
    
    for (const [stateId, stateDef] of Object.entries(machine.states)) {
      for (const [eventName, transitions] of Object.entries(stateDef.on)) {
        if (transitions.length <= 1) {
          continue;
        }
        
        // 检查是否有多个转换可能同时满足
        // 这是一种启发式检查，可能产生误报
        
        const transitionsWithoutGuard = transitions.filter(t => !t.guard);
        const transitionsWithGuard = transitions.filter(t => t.guard);
        
        // 1. 如果有多个无守卫条件的转换，它们肯定冲突
        if (transitionsWithoutGuard.length > 1) {
          issues.push({
            type: 'conflicting_transitions',
            state: stateId,
            stateInfo: stateDef,
            event: eventName,
            transitions: transitionsWithoutGuard,
            message: `状态 "${stateDef.name}" 在事件 "${eventName}" 下有多个无守卫的转换`,
            detail: '同一事件下多个无守卫转换会产生歧义，只有第一个会被执行',
            location: {
              state: stateId,
              event: eventName
            }
          });
        }
        
        // 2. 如果有无守卫转换和有守卫转换，无守卫的可能掩盖有守卫的
        if (transitionsWithoutGuard.length >= 1 && transitionsWithGuard.length >= 1) {
          issues.push({
            type: 'potential_conflict',
            state: stateId,
            stateInfo: stateDef,
            event: eventName,
            transitions: transitions,
            message: `状态 "${stateDef.name}" 在事件 "${eventName}" 下混用无守卫和有守卫的转换`,
            detail: '无守卫转换会优先匹配，可能导致有守卫的转换永远不会被触发',
            location: {
              state: stateId,
              event: eventName
            }
          });
        }
        
        // 3. 检查是否有完全相同的守卫条件
        const guardConditions = new Map();
        for (const transition of transitionsWithGuard) {
          const guardKey = typeof transition.guard === 'string' 
            ? transition.guard 
            : (transition.guard.condition || JSON.stringify(transition.guard));
          
          if (guardConditions.has(guardKey)) {
            issues.push({
              type: 'duplicate_guard',
              state: stateId,
              stateInfo: stateDef,
              event: eventName,
              guard: guardKey,
              transitions: [guardConditions.get(guardKey), transition],
              message: `状态 "${stateDef.name}" 在事件 "${eventName}" 下有重复的守卫条件`,
              detail: `守卫条件 "${guardKey}" 被多个转换使用，只有第一个会被执行`,
              location: {
                state: stateId,
                event: eventName,
                guard: guardKey
              }
            });
          } else {
            guardConditions.set(guardKey, transition);
          }
        }
      }
    }
    
    return {
      id: 'conflicting_transitions',
      name: '冲突转换检查',
      description: '检查同一事件下是否存在可能冲突的转换',
      severity: 'error',
      passed: issues.length === 0,
      count: issues.length,
      issues
    };
  }
  
  /**
   * 检查引用不存在目标状态的转换
   * @param {Object} machine - 规范化的状态机对象
   * @returns {Object} 检查结果
   */
  checkMissingTargetStates(machine) {
    const issues = [];
    const allStates = new Set(Object.keys(machine.states));
    
    for (const [stateId, stateDef] of Object.entries(machine.states)) {
      for (const [eventName, transitions] of Object.entries(stateDef.on)) {
        for (const transition of transitions) {
          if (!allStates.has(transition.target)) {
            issues.push({
              type: 'missing_target_state',
              state: stateId,
              stateInfo: stateDef,
              event: eventName,
              transition,
              missingTarget: transition.target,
              message: `转换引用了不存在的目标状态 "${transition.target}"`,
              location: {
                state: stateId,
                event: eventName,
                target: transition.target
              }
            });
          }
        }
      }
    }
    
    return {
      id: 'missing_target_states',
      name: '目标状态引用检查',
      description: '检查转换是否引用了不存在的目标状态',
      severity: 'error',
      passed: issues.length === 0,
      count: issues.length,
      issues
    };
  }
  
  /**
   * 检查重复的转换定义
   * @param {Object} machine - 规范化的状态机对象
   * @returns {Object} 检查结果
   */
  checkDuplicateTransitions(machine) {
    const issues = [];
    
    for (const [stateId, stateDef] of Object.entries(machine.states)) {
      for (const [eventName, transitions] of Object.entries(stateDef.on)) {
        const seen = new Map();
        
        for (const transition of transitions) {
          // 生成转换的唯一标识（源状态 + 事件 + 目标 + 守卫）
          const guardKey = transition.guard 
            ? (typeof transition.guard === 'string' ? transition.guard : transition.guard.condition)
            : '';
          const key = `${stateId}:${eventName}:${transition.target}:${guardKey}`;
          
          if (seen.has(key)) {
            issues.push({
              type: 'duplicate_transition',
              state: stateId,
              stateInfo: stateDef,
              event: eventName,
              transitions: [seen.get(key), transition],
              message: `状态 "${stateDef.name}" 在事件 "${eventName}" 下有重复的转换定义`,
              detail: `到 "${transition.target}" 的相同守卫条件的转换被定义了多次`,
              location: {
                state: stateId,
                event: eventName,
                target: transition.target
              }
            });
          } else {
            seen.set(key, transition);
          }
        }
      }
    }
    
    return {
      id: 'duplicate_transitions',
      name: '重复转换检查',
      description: '检查是否存在完全相同的转换定义',
      severity: 'warning',
      passed: issues.length === 0,
      count: issues.length,
      issues
    };
  }
  
  /**
   * 检查事件序列中的首次失败位置
   * @param {Object} machine - 规范化的状态机对象
   * @param {Array} eventSequence - 事件序列
   * @returns {Object} 检查结果
   */
  checkEventSequence(machine, eventSequence) {
    const StateMachineExecutor = require('./executor');
    const executor = new StateMachineExecutor(machine);
    
    const result = executor.executeSequence(eventSequence, true);
    
    return {
      success: result.success,
      firstFailureIndex: result.firstFailureIndex,
      finalState: result.finalState,
      timeline: result.timeline,
      ...(result.firstFailureIndex >= 0 ? {
        failedEvent: eventSequence[result.firstFailureIndex],
        failureResult: result.results[result.firstFailureIndex]
      } : {})
    };
  }
}

module.exports = new StateMachineChecker();
