export const EventType = {
  TEMPORARY_BLOCKAGE: 'temporary_blockage',
  BROADCAST_ANNOUNCEMENT: 'broadcast_announcement',
  MEDICAL_EMERGENCY: 'medical_emergency',
  ADDITIONAL_CROWD: 'additional_crowd',
  EQUIPMENT_FAILURE: 'equipment_failure'
};

export const BroadcastType = {
  GENERAL_EVACUATION: 'general_evacuation',
  SPECIFIC_EXIT: 'specific_exit',
  CALM_MESSAGE: 'calm_message',
  WARNING_MESSAGE: 'warning_message'
};

const EventDescriptions = {
  [EventType.TEMPORARY_BLOCKAGE]: '临时封路：某区域暂时无法通行',
  [EventType.BROADCAST_ANNOUNCEMENT]: '广播指令：需要选择合适的广播内容',
  [EventType.MEDICAL_EMERGENCY]: '医疗紧急情况：有人员需要医疗救助',
  [EventType.ADDITIONAL_CROWD]: '额外人群：更多人涌入现场',
  [EventType.EQUIPMENT_FAILURE]: '设备故障：出口设备需要临时维修'
};

export function checkEventTriggers(state, currentTime) {
  const triggeredEvents = [];
  
  for (const event of state.events) {
    if (event.triggered) continue;
    
    const shouldTrigger = shouldTriggerEvent(event, state.elapsedTime);
    
    if (shouldTrigger) {
      triggeredEvents.push(event);
    }
  }
  
  return triggeredEvents;
}

function shouldTriggerEvent(event, elapsedTime) {
  if (event.triggerType === 'time') {
    return elapsedTime >= event.triggerTime;
  }
  
  if (event.triggerType === 'condition') {
    return false;
  }
  
  if (event.triggerType === 'manual') {
    return false;
  }
  
  return false;
}

export function applyEvent(state, event) {
  let newState = { ...state };
  
  switch (event.type) {
    case EventType.TEMPORARY_BLOCKAGE:
      newState = applyTemporaryBlockage(newState, event);
      break;
      
    case EventType.BROADCAST_ANNOUNCEMENT:
      newState = applyBroadcastAnnouncement(newState, event);
      break;
      
    case EventType.MEDICAL_EMERGENCY:
      newState = applyMedicalEmergency(newState, event);
      break;
      
    case EventType.ADDITIONAL_CROWD:
      newState = applyAdditionalCrowd(newState, event);
      break;
      
    case EventType.EQUIPMENT_FAILURE:
      newState = applyEquipmentFailure(newState, event);
      break;
  }
  
  newState.events = newState.events.map(e => 
    e.id === event.id ? { ...e, triggered: true, appliedAt: state.elapsedTime } : e
  );
  
  return newState;
}

function applyTemporaryBlockage(state, event) {
  const blockedPaths = [...state.blockedPaths];
  
  if (event.blockageTiles) {
    for (const tile of event.blockageTiles) {
      blockedPaths.push({
        x: tile.x,
        y: tile.y,
        duration: event.duration || 30,
        startTime: state.elapsedTime,
        reason: event.description || '临时封路'
      });
    }
  }
  
  return {
    ...state,
    blockedPaths,
    currentEvent: {
      type: event.type,
      description: EventDescriptions[event.type],
      actionRequired: event.actionRequired || '等待封路解除或引导人群绕行'
    }
  };
}

function applyBroadcastAnnouncement(state, event) {
  const activeBroadcasts = [...state.activeBroadcasts];
  
  let broadcastEffect = {
    patienceBoost: 0,
    speedMultiplier: 1.0,
    targetExit: null
  };
  
  if (event.broadcastType) {
    switch (event.broadcastType) {
      case BroadcastType.CALM_MESSAGE:
        broadcastEffect.patienceBoost = 20;
        broadcastEffect.speedMultiplier = 1.1;
        break;
        
      case BroadcastType.GENERAL_EVACUATION:
        broadcastEffect.speedMultiplier = 1.3;
        broadcastEffect.patienceBoost = -10;
        break;
        
      case BroadcastType.SPECIFIC_EXIT:
        broadcastEffect.targetExit = event.targetExit;
        broadcastEffect.speedMultiplier = 1.1;
        break;
        
      case BroadcastType.WARNING_MESSAGE:
        broadcastEffect.speedMultiplier = 1.5;
        broadcastEffect.patienceBoost = -20;
        break;
    }
  }
  
  activeBroadcasts.push({
    id: `broadcast_${Date.now()}`,
    type: event.broadcastType || BroadcastType.CALM_MESSAGE,
    effect: broadcastEffect,
    duration: event.duration || 10,
    startTime: state.elapsedTime,
    message: event.message || '请保持秩序，按照指示疏散'
  });
  
  return {
    ...state,
    activeBroadcasts,
    currentEvent: {
      type: event.type,
      description: EventDescriptions[event.type],
      actionRequired: '已发布广播通知'
    }
  };
}

function applyMedicalEmergency(state, event) {
  const blockedPaths = [...state.blockedPaths];
  
  if (event.location) {
    blockedPaths.push({
      x: event.location.x,
      y: event.location.y,
      duration: event.duration || 45,
      startTime: state.elapsedTime,
      reason: '医疗紧急情况'
    });
  }
  
  const updatedPersons = state.persons.map(person => {
    if (person.state === 'evacuated' || person.state === 'panicked') {
      return person;
    }
    
    return {
      ...person,
      patience: Math.max(0, person.patience - 5)
    };
  });
  
  return {
    ...state,
    blockedPaths,
    persons: updatedPersons,
    currentEvent: {
      type: event.type,
      description: EventDescriptions[event.type],
      actionRequired: '引导人群绕行并保持冷静'
    }
  };
}

function applyAdditionalCrowd(state, event) {
  const newPersons = [...state.persons];
  let newId = Math.max(...state.persons.map(p => p.id)) + 1;
  
  const entrancePositions = [];
  for (let row = 0; row < state.grid.height; row++) {
    for (let col = 0; col < state.grid.width; col++) {
      const tile = state.grid.tiles[row * state.grid.width + col];
      if (tile === 'entrance') {
        entrancePositions.push({ x: col, y: row });
      }
    }
  }
  
  const count = event.additionalCount || 5;
  
  for (let i = 0; i < count; i++) {
    const entrancePos = entrancePositions[Math.floor(Math.random() * entrancePositions.length)];
    const type = event.personType || 'normal';
    
    newPersons.push({
      id: newId++,
      type,
      x: entrancePos.x + (Math.random() - 0.5) * 0.3,
      y: entrancePos.y + (Math.random() - 0.5) * 0.3,
      targetX: state.persons[0]?.targetX || entrancePos.x + 5,
      targetY: state.persons[0]?.targetY || entrancePos.y,
      path: [],
      pathIndex: 0,
      speed: event.baseSpeed || 1.0,
      actualSpeed: event.baseSpeed || 1.0,
      patience: event.basePatience || 100,
      maxPatience: event.basePatience || 100,
      state: 'moving',
      color: getPersonColor(type),
      blockedTime: 0,
      directedBy: null,
      customTarget: null
    });
  }
  
  return {
    ...state,
    persons: newPersons,
    totalPeople: state.totalPeople + count,
    currentEvent: {
      type: event.type,
      description: EventDescriptions[event.type],
      actionRequired: `新增 ${count} 人需要疏散`
    }
  };
}

function applyEquipmentFailure(state, event) {
  const blockedPaths = [...state.blockedPaths];
  
  if (event.affectedExits) {
    for (const exitPos of event.affectedExits) {
      blockedPaths.push({
        x: exitPos.x,
        y: exitPos.y,
        duration: event.duration || 60,
        startTime: state.elapsedTime,
        reason: '设备故障'
      });
    }
  }
  
  const updatedPersons = state.persons.map(person => {
    if (person.state === 'evacuated' || person.state === 'panicked') {
      return person;
    }
    
    if (person.customTarget) {
      const isBlocked = blockedPaths.some(bp => 
        Math.abs(bp.x - person.customTarget.x) < 0.5 && 
        Math.abs(bp.y - person.customTarget.y) < 0.5
      );
      
      if (isBlocked) {
        return {
          ...person,
          customTarget: null,
          directedBy: null,
          path: [],
          pathIndex: 0
        };
      }
    }
    
    return person;
  });
  
  return {
    ...state,
    blockedPaths,
    persons: updatedPersons,
    currentEvent: {
      type: event.type,
      description: EventDescriptions[event.type],
      actionRequired: '部分出口暂时无法使用，请引导人群使用其他出口'
    }
  };
}

function getPersonColor(type) {
  const colorMap = {
    normal: '#4A90D9',
    elderly: '#D9A04A',
    child: '#D94A7E',
    disabled: '#4AD9B8'
  };
  return colorMap[type] || '#4A90D9';
}

export function updateActiveEvents(state, deltaTime) {
  let newState = { ...state };
  
  const currentTime = state.elapsedTime;
  
  newState.blockedPaths = state.blockedPaths.filter(bp => {
    const elapsed = currentTime - bp.startTime;
    return elapsed < bp.duration;
  });
  
  newState.activeBroadcasts = state.activeBroadcasts.filter(bc => {
    const elapsed = currentTime - bc.startTime;
    return elapsed < bc.duration;
  });
  
  for (const broadcast of newState.activeBroadcasts) {
    if (broadcast.effect) {
      newState.persons = newState.persons.map(person => {
        if (person.state === 'evacuated' || person.state === 'panicked') {
          return person;
        }
        
        let updatedPerson = { ...person };
        
        if (broadcast.effect.patienceBoost && broadcast.effect.patienceBoost !== 0) {
          updatedPerson.patience = Math.max(0, Math.min(
            person.maxPatience,
            person.patience + broadcast.effect.patienceBoost * deltaTime * 0.1
          ));
        }
        
        if (broadcast.effect.speedMultiplier && broadcast.effect.speedMultiplier !== 1.0) {
          updatedPerson.actualSpeed = person.speed * broadcast.effect.speedMultiplier;
        }
        
        return updatedPerson;
      });
    }
  }
  
  return newState;
}

export function createEventCard(event) {
  return {
    id: event.id,
    type: event.type,
    title: getEventTitle(event.type),
    description: EventDescriptions[event.type] || event.description,
    actionOptions: getActionOptions(event.type),
    urgency: event.urgency || 'medium'
  };
}

function getEventTitle(type) {
  const titles = {
    [EventType.TEMPORARY_BLOCKAGE]: '临时封路',
    [EventType.BROADCAST_ANNOUNCEMENT]: '广播指令',
    [EventType.MEDICAL_EMERGENCY]: '医疗紧急情况',
    [EventType.ADDITIONAL_CROWD]: '额外人群',
    [EventType.EQUIPMENT_FAILURE]: '设备故障'
  };
  return titles[type] || '突发事件';
}

function getActionOptions(type) {
  const options = {
    [EventType.BROADCAST_ANNOUNCEMENT]: [
      { id: BroadcastType.CALM_MESSAGE, label: '安抚广播', description: '请大家保持冷静，有序疏散' },
      { id: BroadcastType.GENERAL_EVACUATION, label: '紧急疏散', description: '请立即前往最近的出口' },
      { id: BroadcastType.SPECIFIC_EXIT, label: '指定出口', description: '请前往指定出口' },
      { id: BroadcastType.WARNING_MESSAGE, label: '警告广播', description: '情况紧急，请快速撤离' }
    ]
  };
  return options[type] || [];
}
