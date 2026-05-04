class PassengerStateMachine {
  constructor(game) {
    this.game = game;
  }
  
  update(passenger) {
    switch (passenger.state) {
      case 'entering':
        this.enteringState(passenger);
        break;
      case 'approaching_gate':
        this.approachingGateState(passenger);
        break;
      case 'at_gate':
        this.atGateState(passenger);
        break;
      case 'moving_to_escalator':
        this.movingToEscalatorState(passenger);
        break;
      case 'on_escalator':
        this.onEscalatorState(passenger);
        break;
      case 'moving_to_platform':
        this.movingToPlatformState(passenger);
        break;
      case 'waiting':
        this.waitingState(passenger);
        break;
      case 'boarding':
        this.boardingState(passenger);
        break;
      case 'exiting':
        this.exitingState(passenger);
        break;
      case 'blocked':
        this.blockedState(passenger);
        break;
    }
  }
  
  enteringState(passenger) {
    const gates = this.game.objects.filter(o => 
      o.type === 'gate' && 
      o.state === 'open' &&
      (!passenger.hasAccessibilityNeed || o.accessibility)
    );
    
    if (gates.length === 0) {
      if (passenger.hasAccessibilityNeed) {
        passenger.state = 'blocked';
        this.game.addAlert('danger', '无障碍乘客被阻挡！请立即打开无障碍闸机。');
        this.game.incidents++;
      }
      return;
    }
    
    const nearestGate = this.findNearestObject(passenger, gates);
    passenger.targetGate = nearestGate;
    passenger.state = 'approaching_gate';
  }
  
  approachingGateState(passenger) {
    if (!passenger.targetGate || passenger.targetGate.state !== 'open') {
      const gates = this.game.objects.filter(o => 
        o.type === 'gate' && 
        o.state === 'open' &&
        (!passenger.hasAccessibilityNeed || o.accessibility)
      );
      
      if (gates.length === 0) {
        passenger.state = 'blocked';
        return;
      }
      
      passenger.targetGate = this.findNearestObject(passenger, gates);
    }
    
    this.moveTowards(passenger, passenger.targetGate);
    
    if (this.isAtObject(passenger, passenger.targetGate)) {
      passenger.state = 'at_gate';
    }
  }
  
  atGateState(passenger) {
    if (passenger.targetGate.state !== 'open') {
      passenger.state = 'approaching_gate';
      return;
    }
    
    if (passenger.hasAccessibilityNeed && !passenger.targetGate.accessibility) {
      passenger.state = 'approaching_gate';
      return;
    }
    
    const ticketCheckTime = passenger.hasAccessibilityNeed ? 0.5 : 2;
    if (!passenger.gateTimer) {
      passenger.gateTimer = 0;
    }
    passenger.gateTimer += 0.016;
    
    if (passenger.gateTimer >= ticketCheckTime) {
      passenger.area = passenger.targetGate.connectsTo || 'concourse';
      passenger.state = 'moving_to_escalator';
      delete passenger.gateTimer;
    }
  }
  
  movingToEscalatorState(passenger) {
    const escalators = this.game.objects.filter(o => 
      o.type === 'escalator' && 
      o.direction === 'down'
    );
    
    if (escalators.length === 0) {
      passenger.state = 'blocked';
      this.game.addAlert('warning', '乘客无法找到下行扶梯！');
      return;
    }
    
    const nearestEscalator = this.findNearestObject(passenger, escalators);
    passenger.targetEscalator = nearestEscalator;
    
    this.moveTowards(passenger, nearestEscalator);
    
    if (this.isAtObject(passenger, nearestEscalator)) {
      passenger.state = 'on_escalator';
    }
  }
  
  onEscalatorState(passenger) {
    const escalator = passenger.targetEscalator;
    if (!escalator) {
      passenger.state = 'moving_to_escalator';
      return;
    }
    
    const progress = passenger.escalatorProgress || 0;
    passenger.escalatorProgress = progress + 0.01;
    
    if (passenger.escalatorProgress >= 1) {
      passenger.x = escalator.x + escalator.width / 2;
      passenger.y = escalator.y + escalator.height + 20;
      passenger.area = passenger.targetPlatform || 'platform1';
      passenger.state = 'moving_to_platform';
      delete passenger.escalatorProgress;
    } else {
      const startY = escalator.y;
      const endY = escalator.y + escalator.height;
      passenger.y = startY + (endY - startY) * passenger.escalatorProgress;
    }
  }
  
  movingToPlatformState(passenger) {
    const waitingAreas = this.game.objects.filter(o => 
      o.type === 'waiting_area' && 
      o.platform === passenger.targetPlatform
    );
    
    if (waitingAreas.length === 0) {
      passenger.state = 'waiting';
      return;
    }
    
    const nearestWaiting = this.findNearestObject(passenger, waitingAreas);
    this.moveTowards(passenger, nearestWaiting);
    
    if (this.isAtObject(passenger, nearestWaiting)) {
      passenger.state = 'waiting';
    }
  }
  
  waitingState(passenger) {
    const currentPlatform = passenger.area;
    const arrivingTrain = this.game.trains.find(t => 
      t.platform === currentPlatform && 
      t.arrived && 
      !t.departed
    );
    
    if (arrivingTrain && passenger.state === 'waiting') {
      passenger.state = 'boarding';
    }
    
    this.randomWalk(passenger);
  }
  
  boardingState(passenger) {
    const boardTime = passenger.boardTimer || 0;
    passenger.boardTimer = boardTime + 0.016;
    
    if (passenger.boardTimer >= 1) {
      passenger.removed = true;
      this.game.score += 10;
    }
  }
  
  exitingState(passenger) {
    const exits = this.game.objects.filter(o => o.type === 'exit');
    const nearestExit = this.findNearestObject(passenger, exits);
    
    if (nearestExit) {
      this.moveTowards(passenger, nearestExit);
      
      if (this.isAtObject(passenger, nearestExit)) {
        passenger.removed = true;
        this.game.score += 5;
      }
    }
  }
  
  blockedState(passenger) {
    const gates = this.game.objects.filter(o => 
      o.type === 'gate' && 
      o.state === 'open' &&
      (!passenger.hasAccessibilityNeed || o.accessibility)
    );
    
    if (gates.length > 0) {
      passenger.state = 'entering';
      delete passenger.blockedTimer;
      return;
    }
    
    if (!passenger.blockedTimer) {
      passenger.blockedTimer = 0;
    }
    passenger.blockedTimer += 0.016;
    
    if (passenger.blockedTimer > 30) {
      this.game.incidents++;
      this.game.addAlert('danger', '乘客被阻挡过久，发生拥堵事件！');
      passenger.blockedTimer = 0;
    }
  }
  
  findNearestObject(passenger, objects) {
    let nearest = null;
    let minDist = Infinity;
    
    objects.forEach(obj => {
      const dx = (obj.x + obj.width / 2) - passenger.x;
      const dy = (obj.y + obj.height / 2) - passenger.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < minDist) {
        minDist = dist;
        nearest = obj;
      }
    });
    
    return nearest;
  }
  
  moveTowards(passenger, target) {
    const targetX = target.x + target.width / 2;
    const targetY = target.y + target.height / 2;
    
    const dx = targetX - passenger.x;
    const dy = targetY - passenger.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 1) {
      const speed = passenger.speed * 2;
      passenger.x += (dx / dist) * speed;
      passenger.y += (dy / dist) * speed;
    }
  }
  
  isAtObject(passenger, obj) {
    const px = passenger.x;
    const py = passenger.y;
    
    return px >= obj.x && px <= obj.x + obj.width &&
           py >= obj.y && py <= obj.y + obj.height;
  }
  
  randomWalk(passenger) {
    if (Math.random() < 0.02) {
      passenger.walkTarget = {
        x: passenger.x + (Math.random() - 0.5) * 50,
        y: passenger.y + (Math.random() - 0.5) * 50
      };
    }
    
    if (passenger.walkTarget) {
      const dx = passenger.walkTarget.x - passenger.x;
      const dy = passenger.walkTarget.y - passenger.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 2) {
        passenger.x += (dx / dist) * passenger.speed * 0.5;
        passenger.y += (dy / dist) * passenger.speed * 0.5;
      } else {
        delete passenger.walkTarget;
      }
    }
  }
}

export default PassengerStateMachine;
