class RiskEvaluator {
  constructor(game) {
    this.game = game;
    this.overallRisk = 0;
    this.riskHistory = [];
  }
  
  evaluate() {
    const areaRisks = this.evaluateAreaRisks();
    const bottleneckRisks = this.evaluateBottleneckRisks();
    const accessibilityRisks = this.evaluateAccessibilityRisks();
    const trainRisks = this.evaluateTrainRisks();
    const blockageRisks = this.evaluateBlockageRisks();
    
    this.overallRisk = this.calculateOverallRisk({
      areaRisks,
      bottleneckRisks,
      accessibilityRisks,
      trainRisks,
      blockageRisks
    });
    
    this.riskHistory.push({
      time: this.game.currentTime,
      risk: this.overallRisk
    });
    
    return {
      overall: this.overallRisk,
      areaRisks,
      bottleneckRisks,
      accessibilityRisks,
      trainRisks,
      blockageRisks,
      overcrowdedAreas: this.game.capacityCalculator.getOvercrowdedAreas()
    };
  }
  
  evaluateAreaRisks() {
    const risks = {};
    
    for (const [name, area] of Object.entries(this.game.areas)) {
      const capacity = this.game.capacityCalculator.calculateAreaCapacity(name);
      let risk = 0;
      
      if (capacity.utilization > 0.95) {
        risk = 1.0;
      } else if (capacity.utilization > 0.85) {
        risk = 0.8;
      } else if (capacity.utilization > 0.7) {
        risk = 0.5;
      } else if (capacity.utilization > 0.5) {
        risk = 0.2;
      }
      
      const blockedPassengers = this.game.passengers.filter(p => 
        p.area === name && p.state === 'blocked'
      );
      if (blockedPassengers.length > 0) {
        risk = Math.min(1.0, risk + 0.3 + blockedPassengers.length * 0.05);
      }
      
      risks[name] = {
        risk,
        utilization: capacity.utilization,
        current: capacity.current,
        capacity: capacity.capacity
      };
    }
    
    return risks;
  }
  
  evaluateBottleneckRisks() {
    const bottlenecks = this.game.capacityCalculator.getBottlenecks();
    const risks = [];
    
    bottlenecks.forEach(bottleneck => {
      let risk = 0;
      
      if (bottleneck.type === 'closed_gate') {
        risk = 0.6;
      } else if (bottleneck.waiting > 50) {
        risk = 0.9;
      } else if (bottleneck.waiting > 30) {
        risk = 0.6;
      } else if (bottleneck.waiting > 20) {
        risk = 0.3;
      }
      
      risks.push({
        ...bottleneck,
        risk
      });
    });
    
    return risks;
  }
  
  evaluateAccessibilityRisks() {
    const risks = [];
    
    const accessibilityGates = this.game.rules.accessibilityGates || [];
    
    accessibilityGates.forEach(gateId => {
      const gate = this.game.objects.find(o => o.id === gateId);
      if (gate && gate.state === 'closed') {
        const accessibilityPassengers = this.game.passengers.filter(p => 
          p.hasAccessibilityNeed && (p.state === 'entering' || p.state === 'approaching_gate' || p.state === 'blocked')
        );
        
        risks.push({
          type: 'accessibility_blocked',
          gate: gate,
          waitingPassengers: accessibilityPassengers.length,
          risk: accessibilityPassengers.length > 0 ? 1.0 : 0.8,
          message: '无障碍通道被封闭！这是严重违规行为。'
        });
      }
    });
    
    const waitingAccessibilityPassengers = this.game.passengers.filter(p => 
      p.hasAccessibilityNeed && p.state === 'blocked'
    );
    
    if (waitingAccessibilityPassengers.length > 0) {
      risks.push({
        type: 'accessibility_passengers_blocked',
        count: waitingAccessibilityPassengers.length,
        risk: 1.0,
        message: `${waitingAccessibilityPassengers.length}名无障碍乘客被阻挡！`
      });
    }
    
    return risks;
  }
  
  evaluateTrainRisks() {
    const risks = [];
    
    this.game.trains.forEach(train => {
      if (train.arrived && !train.departed) {
        const platformPassengers = this.game.passengers.filter(p => 
          p.area === train.platform
        );
        
        const timeLeft = train.departureTime - this.game.currentTime;
        
        if (timeLeft < 30 && platformPassengers.length > 100) {
          risks.push({
            type: 'train_departure_rush',
            train: train,
            passengers: platformPassengers.length,
            timeLeft,
            risk: 0.7,
            message: `列车即将发车，仍有${platformPassengers.length}名乘客在站台。`
          });
        }
        
        if (train.isLastTrain && timeLeft < 60) {
          const remainingPassengers = platformPassengers.filter(p => 
            p.state === 'waiting'
          );
          if (remainingPassengers.length > 0) {
            risks.push({
              type: 'last_train_warning',
              train: train,
              remaining: remainingPassengers.length,
              timeLeft,
              risk: 0.8,
              message: `末班车即将发车！仍有${remainingPassengers.length}名乘客未能乘车。`
            });
          }
        }
      }
      
      if (train.isLastTrain && train.arrivalTime > 24 * 60 && !train.arrived) {
        risks.push({
          type: 'midnight_delay',
          train: train,
          risk: 0.6,
          message: '末班车跨午夜延误，请注意滞留乘客安排。'
        });
      }
    });
    
    return risks;
  }
  
  evaluateBlockageRisks() {
    const risks = [];
    const blockedPassengers = this.game.passengers.filter(p => p.state === 'blocked');
    
    if (blockedPassengers.length > 0) {
      const blockedByArea = {};
      blockedPassengers.forEach(p => {
        if (!blockedByArea[p.area]) blockedByArea[p.area] = 0;
        blockedByArea[p.area]++;
      });
      
      for (const [area, count] of Object.entries(blockedByArea)) {
        let risk = 0.3;
        if (count > 10) risk = 0.6;
        if (count > 30) risk = 0.9;
        
        const hasAccessibility = blockedPassengers.some(p => 
          p.area === area && p.hasAccessibilityNeed
        );
        if (hasAccessibility) risk = Math.min(1.0, risk + 0.3);
        
        risks.push({
          type: 'area_blocked',
          area,
          count,
          hasAccessibility,
          risk,
          message: `${area}区域有${count}名乘客被阻挡${hasAccessibility ? '（含无障碍乘客）' : ''}`
        });
      }
    }
    
    return risks;
  }
  
  calculateOverallRisk(risks) {
    let totalRisk = 0;
    let weightSum = 0;
    
    for (const areaRisk of Object.values(risks.areaRisks)) {
      totalRisk += areaRisk.risk * 1.5;
      weightSum += 1.5;
    }
    
    risks.bottleneckRisks.forEach(r => {
      totalRisk += r.risk * 1.0;
      weightSum += 1.0;
    });
    
    risks.accessibilityRisks.forEach(r => {
      totalRisk += r.risk * 2.5;
      weightSum += 2.5;
    });
    
    risks.trainRisks.forEach(r => {
      totalRisk += r.risk * 1.2;
      weightSum += 1.2;
    });
    
    risks.blockageRisks.forEach(r => {
      totalRisk += r.risk * 2.0;
      weightSum += 2.0;
    });
    
    if (weightSum === 0) return 0;
    
    return Math.min(1.0, totalRisk / weightSum);
  }
  
  getOverallRisk() {
    return this.overallRisk;
  }
  
  getRiskLevel() {
    if (this.overallRisk < 0.3) return 'low';
    if (this.overallRisk < 0.5) return 'moderate';
    if (this.overallRisk < 0.7) return 'high';
    return 'critical';
  }
  
  shouldTriggerAlert() {
    if (this.overallRisk > 0.8) return 'danger';
    if (this.overallRisk > 0.6) return 'warning';
    return null;
  }
}

export default RiskEvaluator;
