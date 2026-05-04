class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = null;
    this.highlightedObject = null;
    this.animationFrame = 0;
    
    this.colors = {
      background: '#0f0f23',
      floor: '#1a1a30',
      wall: '#2a2a4a',
      entrance: '#4ade80',
      exit: '#60a5fa',
      gate: {
        open: '#4ade80',
        closed: '#f87171'
      },
      escalator: {
        up: '#fbbf24',
        down: '#a78bfa'
      },
      barrier: {
        active: '#f87171',
        inactive: '#6b7280'
      },
      waitingArea: '#3b82f6',
      platform: '#8b5cf6',
      concourse: '#10b981',
      passenger: {
        normal: '#e5e7eb',
        accessibility: '#fbbf24',
        blocked: '#f87171'
      },
      train: '#ef4444',
      text: '#e5e7eb'
    };
  }
  
  setGame(game) {
    this.game = game;
  }
  
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }
  
  highlightObject(obj) {
    this.highlightedObject = obj;
  }
  
  render() {
    if (!this.game) return;
    
    this.animationFrame++;
    
    this.ctx.fillStyle = this.colors.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.drawGrid();
    this.drawAreas();
    this.drawObjects();
    this.drawPassengers();
    this.drawTrains();
    this.drawRiskOverlay();
    this.drawHighlight();
    this.drawInfo();
  }
  
  drawGrid() {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;
    
    const gridSize = 40;
    for (let x = 0; x < this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    
    for (let y = 0; y < this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }
  
  drawAreas() {
    for (const [name, area] of Object.entries(this.game.areas)) {
      let color;
      switch (area.status) {
        case 'safe':
          color = 'rgba(16, 185, 129, 0.15)';
          break;
        case 'warning':
          color = 'rgba(251, 191, 36, 0.2)';
          break;
        case 'danger':
          color = 'rgba(239, 68, 68, 0.25)';
          break;
        default:
          color = 'rgba(100, 100, 100, 0.1)';
      }
      
      this.ctx.fillStyle = color;
      this.ctx.fillRect(area.x, area.y, area.width, area.height);
      
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(area.x, area.y, area.width, area.height);
      
      this.ctx.fillStyle = this.colors.text;
      this.ctx.font = '12px Microsoft YaHei';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        `${name} (${area.currentCount}/${area.capacity})`,
        area.x + area.width / 2,
        area.y + 20
      );
    }
  }
  
  drawObjects() {
    this.game.objects.forEach(obj => {
      switch (obj.type) {
        case 'entrance':
          this.drawEntrance(obj);
          break;
        case 'exit':
          this.drawExit(obj);
          break;
        case 'gate':
          this.drawGate(obj);
          break;
        case 'escalator':
          this.drawEscalator(obj);
          break;
        case 'barrier':
          this.drawBarrier(obj);
          break;
        case 'waiting_area':
          this.drawWaitingArea(obj);
          break;
      }
    });
  }
  
  drawEntrance(obj) {
    this.ctx.fillStyle = this.colors.entrance;
    this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    
    this.ctx.fillStyle = this.colors.background;
    this.ctx.font = 'bold 14px Microsoft YaHei';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('入口', obj.x + obj.width / 2, obj.y + obj.height / 2);
    
    const arrowOffset = Math.sin(this.animationFrame * 0.1) * 5;
    this.ctx.fillStyle = this.colors.entrance;
    this.ctx.beginPath();
    this.ctx.moveTo(obj.x + obj.width / 2 - 8, obj.y + obj.height + 10 + arrowOffset);
    this.ctx.lineTo(obj.x + obj.width / 2 + 8, obj.y + obj.height + 10 + arrowOffset);
    this.ctx.lineTo(obj.x + obj.width / 2, obj.y + obj.height + 25 + arrowOffset);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  drawExit(obj) {
    this.ctx.fillStyle = this.colors.exit;
    this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    
    this.ctx.fillStyle = this.colors.background;
    this.ctx.font = 'bold 14px Microsoft YaHei';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('出口', obj.x + obj.width / 2, obj.y + obj.height / 2);
  }
  
  drawGate(obj) {
    const isOpen = obj.state === 'open';
    const isAccessibility = obj.accessibility;
    
    this.ctx.fillStyle = isOpen ? this.colors.gate.open : this.colors.gate.closed;
    this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    
    if (isOpen) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.fillRect(obj.x + 5, obj.y + 5, obj.width - 10, obj.height - 10);
    }
    
    if (isAccessibility) {
      this.ctx.strokeStyle = '#fbbf24';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(obj.x - 2, obj.y - 2, obj.width + 4, obj.height + 4);
      
      this.ctx.fillStyle = '#fbbf24';
      this.ctx.font = 'bold 10px Microsoft YaHei';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('♿', obj.x + obj.width / 2, obj.y - 8);
    }
    
    this.ctx.fillStyle = isOpen ? this.colors.background : this.colors.text;
    this.ctx.font = 'bold 11px Microsoft YaHei';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      isOpen ? '开' : '关',
      obj.x + obj.width / 2,
      obj.y + obj.height / 2
    );
  }
  
  drawEscalator(obj) {
    const isUp = obj.direction === 'up';
    
    this.ctx.fillStyle = isUp ? this.colors.escalator.up : this.colors.escalator.down;
    this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (let i = 0; i < 5; i++) {
      const y = obj.y + (i * obj.height / 5) + (this.animationFrame * (isUp ? -1 : 1)) % (obj.height / 5);
      this.ctx.fillRect(obj.x + 5, y, obj.width - 10, 3);
    }
    
    this.ctx.fillStyle = this.colors.background;
    this.ctx.font = 'bold 16px Microsoft YaHei';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      isUp ? '▲' : '▼',
      obj.x + obj.width / 2,
      obj.y + obj.height / 2
    );
    
    this.ctx.font = 'bold 10px Microsoft YaHei';
    this.ctx.fillText(
      isUp ? '上' : '下',
      obj.x + obj.width / 2,
      obj.y + obj.height / 2 + 15
    );
  }
  
  drawBarrier(obj) {
    if (!obj.active) {
      this.ctx.strokeStyle = this.colors.barrier.inactive;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
      this.ctx.setLineDash([]);
      return;
    }
    
    this.ctx.fillStyle = this.colors.barrier.active;
    this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    
    this.ctx.fillStyle = '#fbbf24';
    const stripeWidth = 10;
    for (let i = -obj.height; i < obj.width; i += stripeWidth * 2) {
      this.ctx.beginPath();
      this.ctx.moveTo(obj.x + i, obj.y);
      this.ctx.lineTo(obj.x + i + stripeWidth, obj.y);
      this.ctx.lineTo(obj.x + i + stripeWidth + obj.height, obj.y + obj.height);
      this.ctx.lineTo(obj.x + i + obj.height, obj.y + obj.height);
      this.ctx.closePath();
      this.ctx.fill();
    }
    
    this.ctx.fillStyle = this.colors.background;
    this.ctx.font = 'bold 12px Microsoft YaHei';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('🚧', obj.x + obj.width / 2, obj.y + obj.height / 2);
  }
  
  drawWaitingArea(obj) {
    this.ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    
    this.ctx.strokeStyle = this.colors.waitingArea;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([8, 4]);
    this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
    this.ctx.setLineDash([]);
    
    this.ctx.fillStyle = this.colors.waitingArea;
    this.ctx.font = '10px Microsoft YaHei';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      `候车区 ${obj.platform || ''}`,
      obj.x + obj.width / 2,
      obj.y - 5
    );
  }
  
  drawPassengers() {
    this.game.passengers.forEach(passenger => {
      let color = this.colors.passenger.normal;
      
      if (passenger.hasAccessibilityNeed) {
        color = this.colors.passenger.accessibility;
      }
      
      if (passenger.state === 'blocked') {
        color = this.colors.passenger.blocked;
      }
      
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(passenger.x, passenger.y, passenger.width / 2, 0, Math.PI * 2);
      this.ctx.fill();
      
      if (passenger.hasAccessibilityNeed) {
        this.ctx.strokeStyle = '#fbbf24';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(passenger.x, passenger.y, passenger.width / 2 + 3, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      
      if (passenger.state === 'blocked') {
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 2;
        const pulse = Math.sin(this.animationFrame * 0.2) * 2;
        this.ctx.beginPath();
        this.ctx.arc(passenger.x, passenger.y, passenger.width / 2 + 5 + pulse, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    });
  }
  
  drawTrains() {
    this.game.trains.forEach(train => {
      if (!train.arrived || train.departed) return;
      
      const platform = this.game.areas[train.platform];
      if (!platform) return;
      
      const trainY = platform.y + platform.height - 60;
      const trainX = platform.x + 50;
      const trainWidth = platform.width - 100;
      const trainHeight = 50;
      
      this.ctx.fillStyle = this.colors.train;
      this.ctx.fillRect(trainX, trainY, trainWidth, trainHeight);
      
      const doorCount = Math.floor(trainWidth / 40);
      for (let i = 0; i < doorCount; i++) {
        const doorX = trainX + 20 + i * (trainWidth - 40) / doorCount;
        const doorWidth = 15;
        
        const openProgress = Math.min(1, (this.game.currentTime - train.arrivalTime) / 5);
        const doorOffset = openProgress * doorWidth / 2;
        
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(doorX - doorOffset, trainY + 10, doorWidth / 2, trainHeight - 20);
        this.ctx.fillRect(doorX + doorWidth / 2 + doorOffset, trainY + 10, doorWidth / 2, trainHeight - 20);
      }
      
      const timeLeft = train.departureTime - this.game.currentTime;
      this.ctx.fillStyle = this.colors.text;
      this.ctx.font = 'bold 14px Microsoft YaHei';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        `🚇 ${train.line} ${timeLeft.toFixed(0)}秒后发车`,
        platform.x + platform.width / 2,
        trainY - 15
      );
    });
  }
  
  drawRiskOverlay() {
    const risk = this.game.riskEvaluator.getOverallRisk();
    
    if (risk > 0.5) {
      const intensity = (risk - 0.5) * 2;
      const alpha = intensity * 0.15;
      
      this.ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      if (risk > 0.8) {
        const pulseAlpha = Math.sin(this.animationFrame * 0.1) * 0.1 + 0.1;
        this.ctx.fillStyle = `rgba(239, 68, 68, ${pulseAlpha})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  }
  
  drawHighlight() {
    if (!this.highlightedObject) return;
    
    const obj = this.highlightedObject;
    const pulse = Math.sin(this.animationFrame * 0.1) * 3;
    
    this.ctx.strokeStyle = '#e94560';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(
      obj.x - 5 - pulse,
      obj.y - 5 - pulse,
      obj.width + 10 + pulse * 2,
      obj.height + 10 + pulse * 2
    );
    
    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = 'bold 12px Microsoft YaHei';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(
      `${obj.id} - 点击交互`,
      obj.x,
      obj.y - 15
    );
  }
  
  drawInfo() {
    const state = this.game.getState();
    const y = this.canvas.height - 30;
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, this.canvas.height - 40, this.canvas.width, 40);
    
    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = '12px Microsoft YaHei';
    this.ctx.textAlign = 'left';
    
    let infoText = `提示: `;
    infoText += `点击闸机开关 | 点击扶梯换向 | 点击围栏放置/移除 | `;
    infoText += `⚠️ 无障碍通道(♿标记)必须保持开启`;
    
    this.ctx.fillText(infoText, 20, y);
  }
}

export default Renderer;
