const yaml = require('yaml');
const { validate } = require('./validator');

/**
 * 状态机解析器
 * 支持 JSON 和 YAML 格式
 */
class StateMachineParser {
  /**
   * 解析状态机定义
   * @param {string} content - 状态机定义内容（JSON 或 YAML）
   * @returns {Object} 解析后的状态机对象
   */
  parse(content) {
    let machine;
    
    try {
      // 尝试解析 JSON
      machine = JSON.parse(content);
    } catch (jsonError) {
      try {
        // 尝试解析 YAML
        machine = yaml.parse(content);
      } catch (yamlError) {
        throw new Error(`无法解析状态机定义：不是有效的 JSON 或 YAML 格式。JSON错误：${jsonError.message}，YAML错误：${yamlError.message}`);
      }
    }
    
    // 验证状态机结构
    const validationResult = validate(machine);
    if (!validationResult.valid) {
      throw new Error(`状态机定义验证失败：${validationResult.errors.join('; ')}`);
    }
    
    // 规范化状态机对象
    return this.normalize(machine);
  }
  
  /**
   * 规范化状态机对象
   * @param {Object} machine - 原始状态机对象
   * @returns {Object} 规范化后的状态机对象
   */
  normalize(machine) {
    const normalized = {
      name: machine.name || '未命名状态机',
      description: machine.description || '',
      initialState: machine.initialState,
      states: {},
      events: {},
      metadata: machine.metadata || {}
    };
    
    // 处理状态定义
    for (const [stateId, stateDef] of Object.entries(machine.states || {})) {
      normalized.states[stateId] = {
        id: stateId,
        name: stateDef.name || stateId,
        description: stateDef.description || '',
        type: this.determineStateType(stateId, stateDef, machine.initialState),
        on: {},
        actions: {
          entry: stateDef.actions?.entry || [],
          exit: stateDef.actions?.exit || [],
          do: stateDef.actions?.do || []
        },
        metadata: stateDef.metadata || {}
      };
      
      // 处理转换规则
      for (const [eventName, transitions] of Object.entries(stateDef.on || {})) {
        const transitionList = Array.isArray(transitions) ? transitions : [transitions];
        normalized.states[stateId].on[eventName] = transitionList.map(t => this.normalizeTransition(t, stateId));
      }
    }
    
    // 收集所有事件定义
    for (const stateId of Object.keys(normalized.states)) {
      for (const [eventName, transitions] of Object.entries(normalized.states[stateId].on)) {
        if (!normalized.events[eventName]) {
          normalized.events[eventName] = {
            name: eventName,
            description: '',
            triggeredBy: []
          };
        }
        normalized.events[eventName].triggeredBy.push(stateId);
      }
    }
    
    return normalized;
  }
  
  /**
   * 确定状态类型
   * @param {string} stateId - 状态ID
   * @param {Object} stateDef - 状态定义
   * @param {string} initialState - 初始状态ID
   * @returns {string} 状态类型：initial|final|normal
   */
  determineStateType(stateId, stateDef, initialState) {
    if (stateId === initialState) {
      return 'initial';
    }
    if (stateDef.final || stateDef.type === 'final') {
      return 'final';
    }
    return 'normal';
  }
  
  /**
   * 规范化转换定义
   * @param {Object|string} transition - 转换定义
   * @param {string} sourceState - 源状态ID
   * @returns {Object} 规范化后的转换对象
   */
  normalizeTransition(transition, sourceState) {
    if (typeof transition === 'string') {
      return {
        target: transition,
        guard: null,
        actions: [],
        description: '',
        source: sourceState
      };
    }
    
    return {
      target: transition.target,
      guard: transition.guard ? this.normalizeGuard(transition.guard) : null,
      actions: transition.actions || [],
      description: transition.description || '',
      source: sourceState
    };
  }
  
  /**
   * 规范化守卫条件
   * @param {Object|string} guard - 守卫条件
   * @returns {Object} 规范化后的守卫对象
   */
  normalizeGuard(guard) {
    if (typeof guard === 'string') {
      return {
        condition: guard,
        description: '',
        params: {}
      };
    }
    
    return {
      condition: guard.condition || '',
      description: guard.description || '',
      params: guard.params || {}
    };
  }
  
  /**
   * 导出为 JSON 格式
   * @param {Object} machine - 规范化的状态机对象
   * @returns {string} JSON 字符串
   */
  toJSON(machine) {
    const exportMachine = {
      name: machine.name,
      description: machine.description,
      initialState: machine.initialState,
      states: {},
      metadata: machine.metadata
    };
    
    for (const [stateId, stateDef] of Object.entries(machine.states)) {
      exportMachine.states[stateId] = {
        name: stateDef.name,
        description: stateDef.description,
        final: stateDef.type === 'final',
        actions: stateDef.actions,
        on: {},
        metadata: stateDef.metadata
      };
      
      for (const [eventName, transitions] of Object.entries(stateDef.on)) {
        exportMachine.states[stateId].on[eventName] = transitions.map(t => ({
          target: t.target,
          guard: t.guard,
          actions: t.actions,
          description: t.description
        }));
      }
    }
    
    return JSON.stringify(exportMachine, null, 2);
  }
  
  /**
   * 导出为 YAML 格式
   * @param {Object} machine - 规范化的状态机对象
   * @returns {string} YAML 字符串
   */
  toYAML(machine) {
    const exportMachine = JSON.parse(this.toJSON(machine));
    return yaml.stringify(exportMachine);
  }
}

module.exports = new StateMachineParser();
