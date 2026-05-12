import { getRotatedRectangleCorners } from './collision.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 50;
    this.offsetX = 0;
    this.offsetY = 0;
    this.gridSize = 5;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  worldToScreen(x, y) {
    return {
      x: x * this.scale + this.canvas.width / 2 / window.devicePixelRatio + this.offsetX,
      y: -y * this.scale + this.canvas.height / 2 / window.devicePixelRatio + this.offsetY
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.canvas.width / 2 / window.devicePixelRatio - this.offsetX) / this.scale,
      y: -(sy - this.canvas.height / 2 / window.devicePixelRatio - this.offsetY) / this.scale
    };
  }

  drawGrid() {
    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;

    this.ctx.strokeStyle = '#2a3a5a';
    this.ctx.lineWidth = 0.5;

    const worldLeft = this.screenToWorld(0, 0).x;
    const worldRight = this.screenToWorld(width, 0).x;
    const worldTop = this.screenToWorld(0, 0).y;
    const worldBottom = this.screenToWorld(0, height).y;

    const gridStartX = Math.floor(worldLeft / this.gridSize) * this.gridSize;
    const gridEndX = Math.ceil(worldRight / this.gridSize) * this.gridSize;
    const gridStartY = Math.floor(worldBottom / this.gridSize) * this.gridSize;
    const gridEndY = Math.ceil(worldTop / this.gridSize) * this.gridSize;

    for (let x = gridStartX; x <= gridEndX; x += this.gridSize) {
      const start = this.worldToScreen(x, worldTop);
      const end = this.worldToScreen(x, worldBottom);
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.stroke();
    }

    for (let y = gridStartY; y <= gridEndY; y += this.gridSize) {
      const start = this.worldToScreen(worldLeft, y);
      const end = this.worldToScreen(worldRight, y);
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.stroke();
    }

    this.ctx.strokeStyle = '#e94560';
    this.ctx.lineWidth = 2;

    const origin = this.worldToScreen(0, 0);
    const axisEndX = this.worldToScreen(20, 0);
    const axisEndY = this.worldToScreen(0, 20);

    this.ctx.beginPath();
    this.ctx.moveTo(origin.x, origin.y);
    this.ctx.lineTo(axisEndX.x, axisEndX.y);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(origin.x, origin.y);
    this.ctx.lineTo(axisEndY.x, axisEndY.y);
    this.ctx.stroke();
  }

  drawBoundary(boundary) {
    if (!boundary) return;

    const { minX, maxX, minY, maxY } = boundary;

    const corners = [
      this.worldToScreen(minX, maxY),
      this.worldToScreen(maxX, maxY),
      this.worldToScreen(maxX, minY),
      this.worldToScreen(minX, minY)
    ];

    this.ctx.save();

    this.ctx.fillStyle = 'rgba(76, 175, 80, 0.05)';
    this.ctx.beginPath();
    this.ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      this.ctx.lineTo(corners[i].x, corners[i].y);
    }
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.strokeStyle = '#4caf50';
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([8, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      this.ctx.lineTo(corners[i].x, corners[i].y);
    }
    this.ctx.closePath();
    this.ctx.stroke();

    this.ctx.setLineDash([]);
    this.ctx.fillStyle = '#4caf50';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'center';

    const labelTop = this.worldToScreen((minX + maxX) / 2, maxY);
    this.ctx.fillText(`边界 Y: ${maxY}m`, labelTop.x, labelTop.y - 10);

    const labelBottom = this.worldToScreen((minX + maxX) / 2, minY);
    this.ctx.fillText(`边界 Y: ${minY}m`, labelBottom.x, labelBottom.y + 15);

    this.ctx.textAlign = 'left';
    const labelLeft = this.worldToScreen(minX, (minY + maxY) / 2);
    this.ctx.fillText(`X: ${minX}m`, labelLeft.x + 5, labelLeft.y);

    this.ctx.textAlign = 'right';
    const labelRight = this.worldToScreen(maxX, (minY + maxY) / 2);
    this.ctx.fillText(`X: ${maxX}m`, labelRight.x - 5, labelRight.y);

    this.ctx.restore();
  }

  drawParkingSpot(spot, selected = false, hasAnomaly = false) {
    const corners = getRotatedRectangleCorners(
      spot.x, spot.y, spot.width, spot.length, spot.angle
    );
    const screenCorners = corners.map(c => this.worldToScreen(c.x, c.y));

    this.ctx.save();

    if (hasAnomaly) {
      this.ctx.fillStyle = 'rgba(244, 67, 54, 0.4)';
      this.ctx.strokeStyle = '#f44336';
    } else if (selected) {
      this.ctx.fillStyle = 'rgba(76, 175, 80, 0.4)';
      this.ctx.strokeStyle = '#4caf50';
    } else {
      this.ctx.fillStyle = 'rgba(33, 150, 243, 0.4)';
      this.ctx.strokeStyle = '#2196f3';
    }

    this.ctx.lineWidth = selected ? 3 : 2;

    this.ctx.beginPath();
    this.ctx.moveTo(screenCorners[0].x, screenCorners[0].y);
    for (let i = 1; i < screenCorners.length; i++) {
      this.ctx.lineTo(screenCorners[i].x, screenCorners[i].y);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = hasAnomaly ? '#f44336' : (selected ? '#fff' : '#90caf9');
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const center = this.worldToScreen(
      spot.x + spot.width / 2,
      spot.y + spot.length / 2
    );
    this.ctx.fillText(spot.label, center.x, center.y);

    this.ctx.restore();
  }

  drawFireLane(lane, selected = false) {
    const start = this.worldToScreen(lane.x, lane.y);
    const end = this.worldToScreen(lane.x + lane.length, lane.y);

    this.ctx.save();

    this.ctx.strokeStyle = selected ? '#ff9800' : '#f44336';
    this.ctx.lineWidth = lane.width * this.scale;
    this.ctx.lineCap = 'butt';

    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();

    this.ctx.setLineDash([10, 10]);
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();

    this.ctx.setLineDash([]);
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';

    const center = this.worldToScreen(
      lane.x + lane.length / 2,
      lane.y + lane.width / 2
    );
    this.ctx.fillText(`消防通道 ${lane.label}`, center.x, center.y);

    this.ctx.restore();
  }

  drawTurningRadius(tr, selected = false) {
    const center = this.worldToScreen(tr.x, tr.y);
    const radius = tr.radius * this.scale;

    this.ctx.save();

    this.ctx.fillStyle = 'rgba(255, 152, 0, 0.2)';
    this.ctx.strokeStyle = selected ? '#fff' : '#ff9800';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);

    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.setLineDash([]);
    this.ctx.fillStyle = '#ff9800';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`转弯 ${tr.label}`, center.x, center.y);

    this.ctx.restore();
  }

  drawObstacle(obs, selected = false) {
    const start = this.worldToScreen(obs.x, obs.y);
    const width = obs.width * this.scale;
    const height = obs.length * this.scale;

    this.ctx.save();

    this.ctx.fillStyle = 'rgba(158, 158, 158, 0.6)';
    this.ctx.strokeStyle = selected ? '#fff' : '#9e9e9e';
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    this.ctx.rect(start.x, start.y - height, width, height);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      obs.label,
      start.x + width / 2,
      start.y - height / 2
    );

    this.ctx.restore();
  }

  drawObjects(objects, selectedId = null, anomalousIds = new Set()) {
    for (const obj of objects) {
      const selected = obj.id === selectedId;
      const hasAnomaly = anomalousIds.has(obj.id);

      switch (obj.type) {
        case 'parking':
          this.drawParkingSpot(obj, selected, hasAnomaly);
          break;
        case 'fireLane':
          this.drawFireLane(obj, selected);
          break;
        case 'turningRadius':
          this.drawTurningRadius(obj, selected);
          break;
        case 'obstacle':
          this.drawObstacle(obj, selected);
          break;
      }
    }
  }

  drawPreview(type, worldPos, settings) {
    this.ctx.save();
    this.ctx.globalAlpha = 0.5;

    const obj = {
      x: worldPos.x,
      y: worldPos.y,
      width: settings.width || 2.5,
      length: settings.length || 5.0,
      angle: settings.angle || 0,
      radius: settings.radius || 6,
      label: '预览'
    };

    switch (type) {
      case 'parking':
        this.drawParkingSpot(obj, true, false);
        break;
      case 'fireLane':
        obj.width = 4;
        obj.length = 10;
        this.drawFireLane(obj, true);
        break;
      case 'turningRadius':
        obj.x = worldPos.x;
        obj.y = worldPos.y;
        this.drawTurningRadius(obj, true);
        break;
      case 'obstacle':
        obj.width = 2;
        obj.length = 2;
        this.drawObstacle(obj, true);
        break;
    }

    this.ctx.restore();
  }

  clear() {
    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;
    this.ctx.fillStyle = '#0a1929';
    this.ctx.fillRect(0, 0, width, height);
  }

  render(objects, selectedId = null, anomalousIds = new Set(), boundary = null) {
    this.clear();
    this.drawGrid();
    this.drawBoundary(boundary);
    this.drawObjects(objects, selectedId, anomalousIds);
  }
}
