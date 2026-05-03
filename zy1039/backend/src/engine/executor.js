/**
 * 状态机执行引擎
 * 处理事件执行、守卫条件检查、时间线记录
 */
class StateMachineExecutor {
  /**
   * 创建执行器
   * @param {Object} machine - 规范化的状态机对象
   * @param {Object} context - 初始上下文
   */
  constructor(machine, context = {}) {
    this.machine = machine;
    this.context = { ...context };
    this.currentState = machine.initialState;
    this.timeline = [];
    this.step = 0;
    this.isTerminated = false;
    
    // 记录初始状态
    this._recordTimeline({
      type: 'initial',
      state: this.currentState,
      stateInfo: this.machine.states[this.currentState],
      message: '初始状态',
      step: 0
    });
  }
  
  /**
   * 执行单个事件
   * @param {string|Object} event - 事件名称或事件对象
   * @returns {Object} 执行结果
   */
  executeEvent(event) {
    if (this.isTerminated) {
      return this._createErrorResult('状态机已终止，无法执行新事件');
    }
    
    this.step++;
    const eventName = typeof event === 'string' ? event : event.name;
    const eventData = typeof event === 'object' ? event.data || {} : {};
    
    // 更新上下文
    this.context = { ...this.context, ...eventData };
    
    const currentStateDef = this.machine.states[this.currentState];
    
    // 检查当前状态是否有定义
    if (!currentStateDef) {
      const result = this._createErrorResult(`当前状态 "${this.currentState}" 未定义`);
      this._recordTimeline({
        type: 'error',
        event: eventName,
        eventData,
        message: result.error,
        step: this.step
      });
      return result;
    }
    
    // 检查当前状态是否定义了此事件的转换
    const transitions = currentStateDef.on[eventName];
    
    if (!transitions || transitions.length === 0) {
      const availableEvents = Object.keys(currentStateDef.on);
      const result = this._createErrorResult(
        `状态 "${currentStateDef.name}" 不接受事件 "${eventName}"`,
        {
          availableEvents,
          currentState: this.currentState
        }
      );
      
      this._recordTimeline({
        type: 'invalid_event',
        event: eventName,
        eventData,
        fromState: this.currentState,
        fromStateInfo: currentStateDef,
        availableEvents,
        message: `非法事件：${eventName}`,
        step: this.step
      });
      
      return result;
    }
    
    // 尝试找到第一个满足守卫条件的转换
    for (const transition of transitions) {
      const guardResult = this._evaluateGuard(transition.guard, eventData);
      
      if (guardResult.passed) {
        // 执行转换
        return this._executeTransition(eventName, eventData, transition, guardResult);
      }
    }
    
    // 所有守卫条件都不满足
    const result = this._createErrorResult(
      `事件 "${eventName}" 在状态 "${currentStateDef.name}" 下无满足条件的转换`,
      {
        evaluatedGuards: transitions.map(t => ({
          guard: t.guard,
          description: t.guard?.description || t.guard?.condition || '无守卫条件'
        }))
      }
    );
    
    this._recordTimeline({
      type: 'guard_failed',
      event: eventName,
      eventData,
      fromState: this.currentState,
      fromStateInfo: currentStateDef,
      transitions,
      message: `所有守卫条件均不满足`,
      step: this.step
    });
    
    return result;
  }
  
  /**
   * 执行事件序列
   * @param {Array} eventSequence - 事件序列数组
   * @param {boolean} stopOnError - 遇到错误时是否停止
   * @returns {Object} 执行结果
   */
  executeSequence(eventSequence, stopOnError = true) {
    const results = [];
    let firstFailureIndex = -1;
    
    for (let i = 0; i < eventSequence.length; i++) {
      const result = this.executeEvent(eventSequence[i]);
      results.push({
        index: i,
        event: eventSequence[i],
        result
      });
      
      if (!result.success && firstFailureIndex === -1) {
        firstFailureIndex = i;
        if (stopOnError) {
          break;
        }
      }
    }
    
    return {
      success: firstFailureIndex === -1,
      firstFailureIndex,
      results,
      finalState: this.currentState,
      finalStateInfo: this.machine.states[this.currentState],
      timeline: [...this.timeline]
    };
  }
  
  /**
   * 重置执行器到初始状态
   */
  reset() {
    this.currentState = this.machine.initialState;
    this.context = {};
    this.step = 0;
    this.isTerminated = false;
    this.timeline = [];
    
    this._recordTimeline({
      type: 'initial',
      state: this.currentState,
      stateInfo: this.machine.states[this.currentState],
      message: '已重置到初始状态',
      step: 0
    });
  }
  
  /**
   * 获取当前状态
   * @returns {Object} 当前状态信息
   */
  getCurrentState() {
    return {
      state: this.currentState,
      stateInfo: this.machine.states[this.currentState],
      availableEvents: Object.keys(this.machine.states[this.currentState]?.on || {})
    };
  }
  
  /**
   * 获取时间线记录
   * @returns {Array} 时间线数组
   */
  getTimeline() {
    return [...this.timeline];
  }
  
  /**
   * 评估守卫条件
   * @param {Object|null} guard - 守卫条件
   * @param {Object} eventData - 事件数据
   * @returns {Object} 评估结果
   * @private
   */
  _evaluateGuard(guard, eventData) {
    if (!guard) {
      return { passed: true, reason: '无守卫条件' };
    }
    
    const condition = typeof guard === 'string' ? guard : guard.condition;
    const description = guard.description || '';
    
    try {
      // 创建执行上下文
      const evalContext = {
        context: this.context,
        event: eventData,
        ...this.context,
        ...eventData
      };
      
      // 尝试安全评估条件表达式
      let passed = false;
      let reason = '';
      
      // 简单的条件评估（支持常见的比较操作）
      if (condition === 'always' || condition === 'true') {
        passed = true;
        reason = '条件恒为真';
      } else if (condition === 'never' || condition === 'false') {
        passed = false;
        reason = '条件恒为假';
      } else if (condition.includes('&&') || condition.includes('||') || 
                 condition.includes('==') || condition.includes('!=') ||
                 condition.includes('>') || condition.includes('<')) {
        // 尝试使用 Function 构造器评估
        try {
          const fn = new Function(...Object.keys(evalContext), `return ${condition}`);
          passed = fn(...Object.values(evalContext));
          reason = passed ? '条件评估为真' : '条件评估为假';
        } catch (evalError) {
          passed = false;
          reason = `条件评估出错: ${evalError.message}`;
        }
      } else {
        // 简单属性存在性检查
        passed = evalContext[condition] === true ||
                 evalContext.context?.[condition] === true;
        reason = passed ? `属性 "${condition}" 为真` : `属性 "${condition}" 为假或不存在`;
      }
      
      return {
        passed,
        condition,
        description,
        reason: description || reason
      };
    } catch (error) {
      return {
        passed: false,
        condition,
        description,
        reason: `守卫条件评估出错: ${error.message}`
      };
    }
  }
  
  /**
   * 执行转换
   * @param {string} eventName - 事件名称
   * @param {Object} eventData - 事件数据
   * @param {Object} transition - 转换定义
   * @param {Object} guardResult - 守卫评估结果
   * @returns {Object} 执行结果
   * @private
   */
  _executeTransition(eventName, eventData, transition, guardResult) {
    const fromState = this.currentState;
    const fromStateInfo = this.machine.states[fromState];
    const toState = transition.target;
    const toStateInfo = this.machine.states[toState];
    
    // 记录时间线
    const timelineEntry = {
      type: 'transition',
      event: eventName,
      eventData,
      fromState,
      fromStateInfo,
      toState,
      toStateInfo,
      transition: {
        guard: transition.guard,
        guardResult,
        actions: transition.actions,
        description: transition.description
      },
      message: `${fromStateInfo.name} → ${toStateInfo.name}`,
      step: this.step
    };
    
    // 更新当前状态
    this.currentState = toState;
    
    // 检查是否为终态
    if (toStateInfo.type === 'final') {
      this.isTerminated = true;
      timelineEntry.isFinal = true;
      timelineEntry.message += ' (到达终态)';
    }
    
    this._recordTimeline(timelineEntry);
    
    return {
      success: true,
      fromState,
      fromStateInfo,
      toState,
      toStateInfo,
      event: eventName,
      eventData,
      guardResult,
      transition,
      isTerminated: this.isTerminated
    };
  }
  
  /**
   * 创建错误结果
   * @param {string} message - 错误消息
   * @param {Object} details - 错误详情
   * @returns {Object} 错误结果对象
   * @private
   */
  _createErrorResult(message, details = {}) {
    return {
      success: false,
      error: message,
      details,
      currentState: this.currentState,
      currentStateInfo: this.machine.states[this.currentState]
    };
  }
  
  /**
   * 记录时间线
   * @param {Object} entry - 时间线条目
   * @private
   */
  _recordTimeline(entry) {
    this.timeline.push({
      ...entry,
      timestamp: Date.now(),
      contextSnapshot: { ...this.context }
    });
  }
}

module.exports = StateMachineExecutor;
