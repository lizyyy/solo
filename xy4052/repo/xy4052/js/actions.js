/**
 * 动作与资源规则系统模块
 * 管理可执行动作、资源限制和动作执行规则
 */

const ActionType = {
  MEASURE_VITALS: 'measure_vitals',
  ECG: 'ecg',
  BLOOD_TEST: 'blood_test',
  FLUIDS: 'fluids',
  CALL_DOCTOR: 'call_doctor',
  ISOLATION: 'isolation',
  CALM_FAMILY: 'calm_family',
  DISCHARGE: 'discharge'
};

const ResourceType = {
  NURSE: 'nurse',
  ECG_MACHINE: 'ecg_machine',
  LAB: 'lab',
  DOCTOR: 'doctor',
  ISOLATION_ROOM: 'isolation_room'
};

const ActionDefinitions = {
  [ActionType.MEASURE_VITALS]: {
    id: ActionType.MEASURE_VITALS,
    name: '测量生命体征',
    description: '测量患者的心率、血压、体温和血氧饱和度',
    duration: 30,
    requiredResources: [ResourceType.NURSE],
    priority: 1,
    canInterrupt: false,
    autoComplete: true,
    scoreBonus: 5,
    validStates: ['pending', 'triaged', 'waiting']
  },
  [ActionType.ECG]: {
    id: ActionType.ECG,
    name: '心电图检查',
    description: '为患者进行心电图检查',
    duration: 60,
    requiredResources: [ResourceType.NURSE, ResourceType.ECG_MACHINE],
    priority: 2,
    canInterrupt: false,
    autoComplete: true,
    scoreBonus: 10,
    validStates: ['triaged', 'waiting']
  },
  [ActionType.BLOOD_TEST]: {
    id: ActionType.BLOOD_TEST,
    name: '抽血检验',
    description: '采集患者血液样本进行检验',
    duration: 45,
    requiredResources: [ResourceType.NURSE, ResourceType.LAB],
    priority: 2,
    canInterrupt: false,
    autoComplete: true,
    scoreBonus: 10,
    validStates: ['triaged', 'waiting']
  },
  [ActionType.FLUIDS]: {
    id: ActionType.FLUIDS,
    name: '补液治疗',
    description: '为患者进行静脉补液',
    duration: 120,
    requiredResources: [ResourceType.NURSE],
    priority: 2,
    canInterrupt: false,
    autoComplete: false,
    scoreBonus: 10,
    validStates: ['triaged', 'waiting', 'being_treated']
  },
  [ActionType.CALL_DOCTOR]: {
    id: ActionType.CALL_DOCTOR,
    name: '呼叫医生',
    description: '呼叫值班医生进行紧急处理',
    duration: 30,
    requiredResources: [ResourceType.DOCTOR],
    priority: 1,
    canInterrupt: true,
    autoComplete: true,
    scoreBonus: 15,
    validStates: ['triaged', 'waiting', 'deteriorated']
  },
  [ActionType.ISOLATION]: {
    id: ActionType.ISOLATION,
    name: '隔离措施',
    description: '将患者转移到隔离室',
    duration: 20,
    requiredResources: [ResourceType.NURSE, ResourceType.ISOLATION_ROOM],
    priority: 1,
    canInterrupt: false,
    autoComplete: true,
    scoreBonus: 10,
    validStates: ['pending', 'triaged', 'waiting']
  },
  [ActionType.CALM_FAMILY]: {
    id: ActionType.CALM_FAMILY,
    name: '安抚家属',
    description: '与患者家属沟通，缓解他们的焦虑',
    duration: 15,
    requiredResources: [ResourceType.NURSE],
    priority: 3,
    canInterrupt: false,
    autoComplete: true,
    scoreBonus: 5,
    validStates: ['triaged', 'waiting']
  },
  [ActionType.DISCHARGE]: {
    id: ActionType.DISCHARGE,
    name: '办理出院',
    description: '完成患者的出院手续',
    duration: 10,
    requiredResources: [ResourceType.NURSE],
    priority: 3,
    canInterrupt: false,
    autoComplete: true,
    scoreBonus: 5,
    validStates: ['triaged', 'waiting']
  }
};

const ResourceDefaults = {
  [ResourceType.NURSE]: { count: 2, name: '护士' },
  [ResourceType.ECG_MACHINE]: { count: 1, name: '心电图机' },
  [ResourceType.LAB]: { count: 2, name: '检验室' },
  [ResourceType.DOCTOR]: { count: 1, name: '医生' },
  [ResourceType.ISOLATION_ROOM]: { count: 1, name: '隔离室' }
};

class ResourceManager {
  constructor(config = {}) {
    this.resources = {};
    this.allocations = {};
    this.listeners = [];

    const resourceConfig = config.resources || ResourceDefaults;
    for (const [type, def] of Object.entries(resourceConfig)) {
      this.resources[type] = {
        count: def.count,
        name: def.name,
        available: def.count
      };
      this.allocations[type] = [];
    }
  }

  addResourceListener(callback) {
    this.listeners.push(callback);
  }

  notifyResourceChange() {
    this.listeners.forEach(callback => callback(this.getResourceStatus()));
  }

  getResourceStatus() {
    const status = {};
    for (const [type, resource] of Object.entries(this.resources)) {
      status[type] = {
        ...resource,
        allocations: [...this.allocations[type]]
      };
    }
    return status;
  }

  canAllocate(resources, patientId) {
    for (const resourceType of resources) {
      const resource = this.resources[resourceType];
      if (!resource) return false;

      const currentAllocations = this.allocations[resourceType];
      if (currentAllocations.length >= resource.count) {
        return false;
      }

      if (currentAllocations.includes(patientId)) {
        return false;
      }
    }
    return true;
  }

  allocate(resources, patientId) {
    if (!this.canAllocate(resources, patientId)) {
      return { success: false, message: '资源不足或已被占用' };
    }

    for (const resourceType of resources) {
      this.allocations[resourceType].push(patientId);
      this.resources[resourceType].available--;
    }

    this.notifyResourceChange();
    return { success: true, message: '资源分配成功' };
  }

  release(resources, patientId) {
    for (const resourceType of resources) {
      const index = this.allocations[resourceType].indexOf(patientId);
      if (index !== -1) {
        this.allocations[resourceType].splice(index, 1);
        this.resources[resourceType].available++;
      }
    }

    this.notifyResourceChange();
    return { success: true, message: '资源释放成功' };
  }

  releaseAll(patientId) {
    for (const resourceType of Object.keys(this.resources)) {
      const index = this.allocations[resourceType].indexOf(patientId);
      if (index !== -1) {
        this.allocations[resourceType].splice(index, 1);
        this.resources[resourceType].available++;
      }
    }

    this.notifyResourceChange();
    return { success: true, message: '所有资源释放成功' };
  }

  isAvailable(resourceType) {
    const resource = this.resources[resourceType];
    if (!resource) return false;
    return resource.available > 0;
  }

  getAvailableCount(resourceType) {
    const resource = this.resources[resourceType];
    if (!resource) return 0;
    return resource.available;
  }

  getTotalCount(resourceType) {
    const resource = this.resources[resourceType];
    if (!resource) return 0;
    return resource.count;
  }

  getAllocations(resourceType) {
    return [...(this.allocations[resourceType] || [])];
  }
}

class ActionManager {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.activeActions = new Map();
    this.completedActions = [];
    this.listeners = [];
  }

  addActionListener(callback) {
    this.listeners.push(callback);
  }

  notifyActionEvent(event, data) {
    this.listeners.forEach(callback => callback(event, data));
  }

  getActionDefinition(actionType) {
    return ActionDefinitions[actionType];
  }

  getAllActionDefinitions() {
    return { ...ActionDefinitions };
  }

  canPerformAction(patient, actionType) {
    const actionDef = this.getActionDefinition(actionType);
    if (!actionDef) {
      return { success: false, message: '动作类型不存在' };
    }

    if (!actionDef.validStates.includes(patient.state)) {
      return { success: false, message: '患者状态不允许执行此动作' };
    }

    if (patient.currentAction) {
      return { success: false, message: '患者正在进行其他操作' };
    }

    if (!this.resourceManager.canAllocate(actionDef.requiredResources, patient.id)) {
      return { success: false, message: '所需资源不可用' };
    }

    return { success: true, message: '可以执行' };
  }

  startAction(patient, actionType) {
    const canPerform = this.canPerformAction(patient, actionType);
    if (!canPerform.success) {
      return canPerform;
    }

    const actionDef = this.getActionDefinition(actionType);

    const allocation = this.resourceManager.allocate(
      actionDef.requiredResources,
      patient.id
    );

    if (!allocation.success) {
      return allocation;
    }

    const actionInstance = {
      id: `${patient.id}_${actionType}_${Date.now()}`,
      patientId: patient.id,
      actionType: actionType,
      startTime: Date.now(),
      duration: actionDef.duration,
      resources: [...actionDef.requiredResources],
      autoComplete: actionDef.autoComplete
    };

    this.activeActions.set(actionInstance.id, actionInstance);

    patient.startAction(actionType);

    this.notifyActionEvent('start', {
      action: actionInstance,
      patient: patient
    });

    return { success: true, action: actionInstance, message: `开始${actionDef.name}` };
  }

  completeAction(actionId, wasSuccessful = true) {
    const actionInstance = this.activeActions.get(actionId);
    if (!actionInstance) {
      return { success: false, message: '动作不存在或已完成' };
    }

    this.activeActions.delete(actionId);

    this.resourceManager.release(
      actionInstance.resources,
      actionInstance.patientId
    );

    this.completedActions.push({
      ...actionInstance,
      endTime: Date.now(),
      successful: wasSuccessful
    });

    this.notifyActionEvent('complete', {
      action: actionInstance,
      successful: wasSuccessful
    });

    return { success: true, message: '动作完成' };
  }

  cancelAction(actionId) {
    const actionInstance = this.activeActions.get(actionId);
    if (!actionInstance) {
      return { success: false, message: '动作不存在' };
    }

    this.activeActions.delete(actionId);

    this.resourceManager.release(
      actionInstance.resources,
      actionInstance.patientId
    );

    this.notifyActionEvent('cancel', {
      action: actionInstance
    });

    return { success: true, message: '动作已取消' };
  }

  getActiveAction(patientId) {
    for (const [actionId, action] of this.activeActions) {
      if (action.patientId === patientId) {
        return { actionId, ...action };
      }
    }
    return null;
  }

  getActiveActions() {
    const actions = [];
    for (const [actionId, action] of this.activeActions) {
      actions.push({ actionId, ...action });
    }
    return actions;
  }

  getCompletedActions() {
    return [...this.completedActions];
  }

  update(deltaTime) {
    const now = Date.now();
    const actionsToComplete = [];

    for (const [actionId, action] of this.activeActions) {
      if (action.autoComplete) {
        const elapsed = (now - action.startTime) / 1000;
        if (elapsed >= action.duration) {
          actionsToComplete.push(actionId);
        }
      }
    }

    for (const actionId of actionsToComplete) {
      this.completeAction(actionId, true);
    }
  }

  getActionProgress(actionId) {
    const action = this.activeActions.get(actionId);
    if (!action) return null;

    const now = Date.now();
    const elapsed = (now - action.startTime) / 1000;
    const progress = Math.min(1, elapsed / action.duration);

    return {
      actionId: actionId,
      elapsed: elapsed,
      total: action.duration,
      progress: progress,
      remaining: action.duration - elapsed
    };
  }
}

export {
  ActionType,
  ResourceType,
  ActionDefinitions,
  ResourceDefaults,
  ResourceManager,
  ActionManager
};
