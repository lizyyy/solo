export class Renderer2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 40;
    this.offsetX = 0;
    this.offsetY = 0;
    this.warehouse = null;
    this.routes = [];
    this.hotspots = [];
    this.editMode = false;
    this.selectedElement = null;
    this.dragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    
    this.colors = {
      warehouse: '#e8e8e8',
      shelf: '#78909c',
      shelfBorder: '#546e7a',
      shelfSelected: '#ff9800',
      aisle: '#e3f2fd',
      aisleBorder: '#90caf9',
      packing: '#ff7043',
      packingBorder: '#e64a19',
      pickStart: '#4caf50',
      route: ['#2196f3', '#9c27b0', '#ff9800', '#4caf50'],
      hotspot: '#f44336',
      text: '#333'
    };
    
    this.setupEvents();
  }

  setWarehouse(warehouse) {
    this.warehouse = warehouse;
    this.resizeCanvas();
    this.render();
  }

  setRoutes(routes) {
    this.routes = routes || [];
    this.render();
  }

  setHotspots(hotspots) {
    this.hotspots = hotspots || [];
    this.render();
  }

  setEditMode(enabled) {
    this.editMode = enabled;
    this.canvas.style.cursor = enabled ? 'pointer' : 'grab';
    this.render();
  }

  resizeCanvas() {
    if (!this.warehouse) return;
    
    const container = this.canvas.parentElement;
    const maxWidth = container.clientWidth * 0.9;
    const maxHeight = container.clientHeight * 0.9;
    
    const whRatio = this.warehouse.dimensions.width / this.warehouse.dimensions.height;
    const containerRatio = maxWidth / maxHeight;
    
    if (whRatio > containerRatio) {
      this.scale = maxWidth / (this.warehouse.dimensions.width + 1);
    } else {
      this.scale = maxHeight / (this.warehouse.dimensions.height + 1);
    }
    
    this.canvas.width = (this.warehouse.dimensions.width + 1) * this.scale;
    this.canvas.height = (this.warehouse.dimensions.height + 1) * this.scale;
    
    this.offsetX = this.scale * 0.5;
    this.offsetY = this.scale * 0.5;
  }

  setupEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
    
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.scale *= delta;
      this.scale = Math.max(10, Math.min(100, this.scale));
      this.resizeCanvas();
      this.render();
    });
  }

  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.offsetX) / this.scale;
    const y = (e.clientY - rect.top - this.offsetY) / this.scale;
    
    if (this.editMode) {
      const element = this.findElementAt(x, y);
      if (element) {
        this.selectedElement = element;
        this.dragging = true;
        this.dragStartX = x - element.x;
        this.dragStartY = y - element.y;
        this.render();
      }
    } else {
      this.dragging = true;
      this.dragStartX = e.clientX - this.canvas.offsetLeft;
      this.dragStartY = e.clientY - this.canvas.offsetTop;
    }
  }

  handleMouseMove(e) {
    if (!this.dragging) return;
    
    if (this.editMode && this.selectedElement) {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - this.offsetX) / this.scale;
      const y = (e.clientY - rect.top - this.offsetY) / this.scale;
      
      this.selectedElement.x = Math.max(0, x - this.dragStartX);
      this.selectedElement.y = Math.max(0, y - this.dragStartY);
      
      this.render();
    }
  }

  handleMouseUp(e) {
    if (this.dragging && this.selectedElement) {
      this.canvas.dispatchEvent(new CustomEvent('elementMoved', {
        detail: { element: this.selectedElement }
      }));
    }
    this.dragging = false;
    this.selectedElement = null;
  }

  findElementAt(x, y) {
    if (!this.warehouse) return null;
    
    for (const shelf of this.warehouse.shelves) {
      if (x >= shelf.x && x <= shelf.x + shelf.width &&
          y >= shelf.y && y <= shelf.y + shelf.depth) {
        return { type: 'shelf', ...shelf };
      }
    }
    
    for (const station of this.warehouse.packingStations) {
      if (x >= station.x && x <= station.x + station.width &&
          y >= station.y && y <= station.y + station.depth) {
        return { type: 'packing', ...station };
      }
    }
    
    return null;
  }

  render() {
    if (!this.warehouse) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.drawWarehouseBoundary();
    this.drawAisles();
    this.drawShelves();
    this.drawPackingStations();
    this.drawPickStart();
    this.drawRoutes();
    this.drawHotspots();
    this.drawLabels();
  }

  drawWarehouseBoundary() {
    const w = this.warehouse.dimensions.width * this.scale;
    const h = this.warehouse.dimensions.height * this.scale;
    
    this.ctx.fillStyle = this.colors.warehouse;
    this.ctx.fillRect(this.offsetX, this.offsetY, w, h);
    
    this.ctx.strokeStyle = '#bbb';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(this.offsetX, this.offsetY, w, h);
    
    this.ctx.strokeStyle = '#ddd';
    this.ctx.lineWidth = 0.5;
    
    for (let x = 0; x <= this.warehouse.dimensions.width; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.offsetX + x * this.scale, this.offsetY);
      this.ctx.lineTo(this.offsetX + x * this.scale, this.offsetY + h);
      this.ctx.stroke();
    }
    
    for (let y = 0; y <= this.warehouse.dimensions.height; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.offsetX, this.offsetY + y * this.scale);
      this.ctx.lineTo(this.offsetX + w, this.offsetY + y * this.scale);
      this.ctx.stroke();
    }
  }

  drawAisles() {
    this.warehouse.aisles.forEach(aisle => {
      const x = this.offsetX + aisle.x * this.scale;
      const y = this.offsetY + aisle.y * this.scale;
      const w = aisle.width * this.scale;
      const h = aisle.depth * this.scale;
      
      this.ctx.fillStyle = this.colors.aisle;
      this.ctx.fillRect(x, y, w, h);
      
      this.ctx.strokeStyle = this.colors.aisleBorder;
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeRect(x, y, w, h);
      this.ctx.setLineDash([]);
    });
  }

  drawShelves() {
    this.warehouse.shelves.forEach(shelf => {
      const x = this.offsetX + shelf.x * this.scale;
      const y = this.offsetY + shelf.y * this.scale;
      const w = shelf.width * this.scale;
      const h = shelf.depth * this.scale;
      
      const isSelected = this.selectedElement && 
                         this.selectedElement.type === 'shelf' && 
                         this.selectedElement.id === shelf.id;
      
      this.ctx.fillStyle = isSelected ? this.colors.shelfSelected : this.colors.shelf;
      this.ctx.fillRect(x, y, w, h);
      
      this.ctx.strokeStyle = this.colors.shelfBorder;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, w, h);
      
      this.ctx.fillStyle = '#fff';
      this.ctx.font = `${Math.min(12, this.scale * 0.3)}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(shelf.zone, x + w / 2, y + h / 2);
    });
  }

  drawPackingStations() {
    this.warehouse.packingStations.forEach(station => {
      const x = this.offsetX + station.x * this.scale;
      const y = this.offsetY + station.y * this.scale;
      const w = station.width * this.scale;
      const h = station.depth * this.scale;
      
      const isSelected = this.selectedElement && 
                         this.selectedElement.type === 'packing' && 
                         this.selectedElement.id === station.id;
      
      this.ctx.fillStyle = station.isPrimary ? this.colors.packing : '#ffb74d';
      this.ctx.fillRect(x, y, w, h);
      
      this.ctx.strokeStyle = this.colors.packingBorder;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, w, h);
      
      this.ctx.fillStyle = '#fff';
      this.ctx.font = `${Math.min(10, this.scale * 0.25)}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(station.isPrimary ? '打包台' : '辅助', x + w / 2, y + h / 2);
    });
  }

  drawPickStart() {
    const start = this.warehouse.pickStart;
    if (!start) return;
    
    const x = this.offsetX + start.x * this.scale;
    const y = this.offsetY + start.y * this.scale;
    const radius = this.scale * 0.3;
    
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = this.colors.pickStart;
    this.ctx.fill();
    this.ctx.strokeStyle = '#2e7d32';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = `${Math.min(10, this.scale * 0.2)}px sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('起', x, y);
  }

  drawRoutes() {
    if (!this.routes || this.routes.length === 0) return;
    
    this.routes.forEach((route, routeIndex) => {
      if (!route.points || route.points.length < 2) return;
      
      const color = this.colors.route[routeIndex % this.colors.route.length];
      
      this.ctx.beginPath();
      this.ctx.moveTo(
        this.offsetX + route.points[0].x * this.scale,
        this.offsetY + route.points[0].y * this.scale
      );
      
      for (let i = 1; i < route.points.length; i++) {
        this.ctx.lineTo(
          this.offsetX + route.points[i].x * this.scale,
          this.offsetY + route.points[i].y * this.scale
        );
      }
      
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.stroke();
      
      route.points.forEach((point, index) => {
        const x = this.offsetX + point.x * this.scale;
        const y = this.offsetY + point.y * this.scale;
        
        let pointColor = color;
        let radius = 6;
        
        if (point.type === 'start') {
          pointColor = '#4caf50';
          radius = 8;
        } else if (point.type === 'packing') {
          pointColor = '#ff5722';
          radius = 8;
        } else if (point.type === 'pick') {
          radius = 5;
        }
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = pointColor;
        this.ctx.fill();
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        if (point.skuCodes && point.skuCodes.length > 0) {
          this.ctx.fillStyle = '#333';
          this.ctx.font = '10px sans-serif';
          this.ctx.textAlign = 'left';
          this.ctx.fillText(
            point.skuCodes.join(','),
            x + 10,
            y - 10
          );
        }
      });
      
      if (route.points.length > 1) {
        for (let i = 0; i < route.points.length - 1; i++) {
          const from = route.points[i];
          const to = route.points[i + 1];
          
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          
          const angle = Math.atan2(to.y - from.y, to.x - from.x);
          
          const arrowSize = 8;
          const ax = this.offsetX + midX * this.scale;
          const ay = this.offsetY + midY * this.scale;
          
          this.ctx.save();
          this.ctx.translate(ax, ay);
          this.ctx.rotate(angle);
          
          this.ctx.beginPath();
          this.ctx.moveTo(arrowSize, 0);
          this.ctx.lineTo(-arrowSize / 2, -arrowSize / 2);
          this.ctx.lineTo(-arrowSize / 2, arrowSize / 2);
          this.ctx.closePath();
          this.ctx.fillStyle = color;
          this.ctx.fill();
          
          this.ctx.restore();
        }
      }
    });
  }

  drawHotspots() {
    if (!this.hotspots || this.hotspots.length === 0) return;
    
    const time = Date.now() / 1000;
    
    this.hotspots.forEach(hotspot => {
      const x = this.offsetX + hotspot.x * this.scale;
      const y = this.offsetY + hotspot.y * this.scale;
      
      const pulse = 1 + Math.sin(time * 3) * 0.2;
      const baseRadius = this.scale * 0.4;
      const radius = baseRadius * pulse;
      
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(244, 67, 54, 0.2)';
      this.ctx.fill();
      
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = hotspot.severity === 'high' ? '#f44336' : '#ff9800';
      this.ctx.fill();
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 12px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('!', x, y);
    });
  }

  drawLabels() {
    this.ctx.fillStyle = '#666';
    this.ctx.font = '10px sans-serif';
    this.ctx.textAlign = 'center';
    
    for (let x = 0; x <= this.warehouse.dimensions.width; x++) {
      this.ctx.fillText(
        x + 'm',
        this.offsetX + x * this.scale,
        this.offsetY - 5
      );
    }
    
    this.ctx.textAlign = 'right';
    for (let y = 0; y <= this.warehouse.dimensions.height; y++) {
      this.ctx.fillText(
        y + 'm',
        this.offsetX - 5,
        this.offsetY + y * this.scale + 3
      );
    }
  }

  zoomIn() {
    this.scale = Math.min(100, this.scale * 1.2);
    this.resizeCanvas();
    this.render();
  }

  zoomOut() {
    this.scale = Math.max(10, this.scale / 1.2);
    this.resizeCanvas();
    this.render();
  }

  resetView() {
    this.resizeCanvas();
    this.render();
  }

  startAnimation() {
    const animate = () => {
      if (this.hotspots && this.hotspots.length > 0) {
        this.render();
      }
      requestAnimationFrame(animate);
    };
    animate();
  }
}
