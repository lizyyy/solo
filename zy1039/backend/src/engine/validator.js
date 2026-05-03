/**
 * 状态机定义验证器
 */
function validate(machine) {
  const errors = [];
  
  // 检查基本结构
  if (!machine) {
    return { valid: false, errors: ['状态机定义为空'] };
  }
  
  // 检查初始状态
  if (!machine.initialState) {
    errors.push('缺少初始状态定义 (initialState)');
  }
  
  // 检查状态定义
  if (!machine.states || Object.keys(machine.states).length === 0) {
    errors.push('缺少状态定义 (states)');
  } else {
    // 验证初始状态是否存在
    if (machine.initialState && !machine.states[machine.initialState]) {
      errors.push(`初始状态 "${machine.initialState}" 未在状态定义中找到`);
    }
    
    // 验证每个状态
    for (const [stateId, stateDef] of Object.entries(machine.states)) {
      const stateErrors = validateState(stateId, stateDef, machine.states);
      errors.push(...stateErrors);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 验证单个状态定义
 * @param {string} stateId - 状态ID
 * @param {Object} stateDef - 状态定义
 * @param {Object} allStates - 所有状态定义
 * @returns {Array} 错误列表
 */
function validateState(stateId, stateDef, allStates) {
  const errors = [];
  
  // 检查状态定义是否为对象
  if (typeof stateDef !== 'object' || stateDef === null) {
    errors.push(`状态 "${stateId}" 的定义不是有效对象`);
    return errors;
  }
  
  // 检查转换定义
  if (stateDef.on) {
    if (typeof stateDef.on !== 'object') {
      errors.push(`状态 "${stateId}" 的 on 定义不是有效对象`);
    } else {
      for (const [eventName, transitions] of Object.entries(stateDef.on)) {
        const transitionList = Array.isArray(transitions) ? transitions : [transitions];
        
        for (let i = 0; i < transitionList.length; i++) {
          const transition = transitionList[i];
          const transitionErrors = validateTransition(
            stateId,
            eventName,
            i,
            transition,
            allStates
          );
          errors.push(...transitionErrors);
        }
      }
    }
  }
  
  // 检查动作定义
  if (stateDef.actions) {
    if (typeof stateDef.actions !== 'object') {
      errors.push(`状态 "${stateId}" 的 actions 定义不是有效对象`);
    } else {
      const actionTypes = ['entry', 'exit', 'do'];
      for (const actionType of actionTypes) {
        if (stateDef.actions[actionType] !== undefined && !Array.isArray(stateDef.actions[actionType])) {
          errors.push(`状态 "${stateId}" 的 ${actionType} 动作必须是数组类型`);
        }
      }
    }
  }
  
  return errors;
}

/**
 * 验证单个转换定义
 * @param {string} stateId - 源状态ID
 * @param {string} eventName - 事件名称
 * @param {number} index - 转换索引
 * @param {Object|string} transition - 转换定义
 * @param {Object} allStates - 所有状态定义
 * @returns {Array} 错误列表
 */
function validateTransition(stateId, eventName, index, transition, allStates) {
  const errors = [];
  
  let targetState;
  let guard = null;
  
  // 处理简单字符串形式的转换
  if (typeof transition === 'string') {
    targetState = transition;
  } else if (typeof transition === 'object' && transition !== null) {
    targetState = transition.target;
    guard = transition.guard;
    
    // 检查动作定义
    if (transition.actions !== undefined && !Array.isArray(transition.actions)) {
      errors.push(`状态 "${stateId}" 事件 "${eventName}" 第 ${index + 1} 个转换的 actions 必须是数组类型`);
    }
    
    // 检查守卫定义
    if (guard !== undefined && guard !== null) {
      if (typeof guard !== 'string' && typeof guard !== 'object') {
        errors.push(`状态 "${stateId}" 事件 "${eventName}" 第 ${index + 1} 个转换的 guard 必须是字符串或对象类型`);
      } else if (typeof guard === 'object') {
        if (!guard.condition) {
          errors.push(`状态 "${stateId}" 事件 "${eventName}" 第 ${index + 1} 个转换的 guard 缺少 condition 字段`);
        }
      }
    }
  } else {
    errors.push(`状态 "${stateId}" 事件 "${eventName}" 第 ${index + 1} 个转换定义无效`);
    return errors;
  }
  
  // 检查目标状态是否存在
  if (!targetState) {
    errors.push(`状态 "${stateId}" 事件 "${eventName}" 第 ${index + 1} 个转换缺少目标状态 (target)`);
  } else if (!allStates[targetState]) {
    errors.push(`状态 "${stateId}" 事件 "${eventName}" 第 ${index + 1} 个转换引用的目标状态 "${targetState}" 不存在`);
  }
  
  return errors;
}

/**
 * 验证事件序列
 * @param {Array} eventSequence - 事件序列数组
 * @returns {Object} 验证结果
 */
function validateEventSequence(eventSequence) {
  const errors = [];
  
  if (!Array.isArray(eventSequence)) {
    return { valid: false, errors: ['事件序列必须是数组类型'] };
  }
  
  for (let i = 0; i < eventSequence.length; i++) {
    const event = eventSequence[i];
    
    if (typeof event === 'string') {
      // 简单事件名称
      if (!event.trim()) {
        errors.push(`第 ${i + 1} 个事件不能为空`);
      }
    } else if (typeof event === 'object' && event !== null) {
      // 带数据的事件
      if (!event.name || !event.name.trim()) {
        errors.push(`第 ${i + 1} 个事件缺少 name 字段`);
      }
    } else {
      errors.push(`第 ${i + 1} 个事件定义无效，必须是字符串或带 name 字段的对象`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validate,
  validateEventSequence
};
