class InteractiveController {
  constructor(canvas, renderer) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.game = null;
    
    this.activeTool = 'select';
    this.listeners = {};
    
    this.isDragging = false;
    this.dragStartPos = null;
    this.hoveredObject = null;
    
    this.initEventListeners();
  }
  
  setGame(game) {
    this.game = game;
  }
  
  setActiveTool(tool) {
    this.activeTool = tool;
  }
  
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }
  
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }
  
  initEventListeners() {
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
  }
  
  getMousePosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }
  
  getObjectAtPosition(pos) {
    if (!this.game) return null;
    
    return this.game.objects.find(obj => {
      return pos.x >= obj.x && 
             pos.x <= obj.x + obj.width &&
             pos.y >= obj.y && 
             pos.y <= obj.y + obj.height;
    });
  }
  
  handleClick(e) {
    const pos = this.getMousePosition(e);
    const obj = this.getObjectAtPosition(pos);
    
    if (this.activeTool === 'select') {
      if (obj) {
        this.handleObjectClick(obj, pos);
      }
    } else if (this.activeTool === 'barrier') {
      this.emit('interact', {
        type: 'barrier',
        position: pos
      });
    }
  }
  
  handleObjectClick(obj, pos) {
    switch (obj.type) {
      case 'gate':
        this.emit('interact', {
          type: 'gate',
          id: obj.id,
          position: pos
        });
        break;
        
      case 'escalator':
        this.emit('interact', {
          type: 'escalator',
          id: obj.id,
          position: pos
        });
        break;
        
      case 'barrier':
        this.emit('interact', {
          type: 'barrier',
          id: obj.id,
          position: pos
        });
        break;
        
      default:
        this.emit('select', {
          object: obj,
          position: pos
        });
    }
    
    this.renderer.highlightObject(obj);
  }
  
  handleMouseMove(e) {
    const pos = this.getMousePosition(e);
    const obj = this.getObjectAtPosition(pos);
    
    if (obj !== this.hoveredObject) {
      this.hoveredObject = obj;
      
      if (obj) {
        this.canvas.style.cursor = 'pointer';
      } else {
        this.canvas.style.cursor = 'default';
      }
    }
    
    if (this.isDragging && this.dragStartPos) {
      this.emit('drag', {
        start: this.dragStartPos,
        current: pos,
        delta: {
          x: pos.x - this.dragStartPos.x,
          y: pos.y - this.dragStartPos.y
        }
      });
    }
  }
  
  handleMouseDown(e) {
    const pos = this.getMousePosition(e);
    const obj = this.getObjectAtPosition(pos);
    
    if (obj && obj.type === 'barrier') {
      this.isDragging = true;
      this.dragStartPos = pos;
      this.draggingObject = obj;
    }
  }
  
  handleMouseUp(e) {
    if (this.isDragging && this.draggingObject) {
      const pos = this.getMousePosition(e);
      
      if (this.dragStartPos) {
        const distance = Math.sqrt(
          Math.pow(pos.x - this.dragStartPos.x, 2) +
          Math.pow(pos.y - this.dragStartPos.y, 2)
        );
        
        if (distance > 10) {
          this.emit('interact', {
            type: 'barrier',
            id: this.draggingObject.id,
            action: 'move',
            from: this.dragStartPos,
            to: pos
          });
        }
      }
    }
    
    this.isDragging = false;
    this.dragStartPos = null;
    this.draggingObject = null;
  }
  
  handleMouseLeave(e) {
    this.isDragging = false;
    this.dragStartPos = null;
    this.draggingObject = null;
    this.hoveredObject = null;
    this.canvas.style.cursor = 'default';
  }
  
  showTooltip(obj, pos) {
    if (!this.tooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        pointer-events: none;
        z-index: 1000;
        max-width: 200px;
      `;
      document.body.appendChild(this.tooltip);
    }
    
    let tooltipText = this.getObjectTooltip(obj);
    
    this.tooltip.textContent = tooltipText;
    this.tooltip.style.left = (pos.x + 15) + 'px';
    this.tooltip.style.top = (pos.y + 15) + 'px';
    this.tooltip.style.display = 'block';
  }
  
  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }
  
  getObjectTooltip(obj) {
    switch (obj.type) {
      case 'gate':
        return `闸机: ${obj.id}\n状态: ${obj.state === 'open' ? '开启' : '关闭'}\n无障碍: ${obj.accessibility ? '是' : '否'}\n点击切换状态`;
        
      case 'escalator':
        return `扶梯: ${obj.id}\n方向: ${obj.direction === 'up' ? '上行' : '下行'}\n点击切换方向`;
        
      case 'barrier':
        return `临时围栏: ${obj.id}\n状态: ${obj.active ? '已放置' : '未放置'}\n点击放置/移除`;
        
      case 'entrance':
        return `入口: ${obj.id}`;
        
      case 'exit':
        return `出口: ${obj.id}`;
        
      case 'waiting_area':
        return `候车区: ${obj.platform || obj.id}`;
        
      default:
        return `${obj.id}`;
    }
  }
}

export default InteractiveController;
