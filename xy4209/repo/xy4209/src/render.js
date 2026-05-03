import { TileType, LevelState } from './levels.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileSize = 40;
    this.offsetX = 0;
    this.offsetY = 0;
    this.animationFrame = 0;
  }

  resize(gridWidth, gridHeight) {
    const maxTileWidth = (this.canvas.width - 40) / gridWidth;
    const maxTileHeight = (this.canvas.height - 40) / gridHeight;
    this.tileSize = Math.min(maxTileWidth, maxTileHeight, 50);
    
    const totalWidth = gridWidth * this.tileSize;
    const totalHeight = gridHeight * this.tileSize;
    this.offsetX = (this.canvas.width - totalWidth) / 2;
    this.offsetY = (this.canvas.height - totalHeight) / 2;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.animationFrame++;
  }

  drawGrid(state) {
    const grid = state.grid;
    const ctx = this.ctx;
    const tileSize = this.tileSize;
    const offsetX = this.offsetX;
    const offsetY = this.offsetY;

    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) {
        const tile = grid.tiles[row * grid.width + col];
        const x = offsetX + col * tileSize;
        const y = offsetY + row * tileSize;

        ctx.fillStyle = this.getTileColor(tile);
        ctx.fillRect(x, y, tileSize, tileSize);

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, tileSize, tileSize);

        this.drawTileDecoration(ctx, tile, x, y, tileSize);
      }
    }

    for (const blocked of state.blockedPaths) {
      const x = offsetX + blocked.x * tileSize;
      const y = offsetY + blocked.y * tileSize;
      
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(x, y, tileSize, tileSize);
      
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 5);
      ctx.lineTo(x + tileSize - 5, y + tileSize - 5);
      ctx.moveTo(x + tileSize - 5, y + 5);
      ctx.lineTo(x + 5, y + tileSize - 5);
      ctx.stroke();
    }
  }

  getTileColor(tileType) {
    const colors = {
      [TileType.FLOOR]: '#E8E8E8',
      [TileType.WALL]: '#444444',
      [TileType.ENTRANCE]: '#90EE90',
      [TileType.EXIT]: '#87CEEB',
      [TileType.OBSTACLE]: '#8B4513',
      [TileType.VOLUNTEER_SPAWN]: '#FFD700'
    };
    return colors[tileType] || '#E8E8E8';
  }

  drawTileDecoration(ctx, tileType, x, y, tileSize) {
    ctx.font = `${tileSize * 0.6}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;

    switch (tileType) {
      case TileType.ENTRANCE:
        ctx.fillStyle = '#006400';
        ctx.fillText('入', centerX, centerY);
        break;
      case TileType.EXIT:
        ctx.fillStyle = '#00008B';
        ctx.fillText('出', centerX, centerY);
        break;
      case TileType.WALL:
        break;
      case TileType.OBSTACLE:
        ctx.fillStyle = '#4A2800';
        ctx.fillText('障', centerX, centerY);
        break;
    }
  }

  drawPersons(state) {
    const ctx = this.ctx;
    const tileSize = this.tileSize;
    const offsetX = this.offsetX;
    const offsetY = this.offsetY;

    for (const person of state.persons) {
      if (person.state === 'evacuated') continue;

      const x = offsetX + person.x * tileSize + tileSize / 2;
      const y = offsetY + person.y * tileSize + tileSize / 2;
      const radius = tileSize * 0.35;

      ctx.save();

      if (person.state === 'panicked') {
        const shake = Math.sin(this.animationFrame * 0.5) * 2;
        ctx.translate(shake, 0);
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);

      if (person.state === 'panicked') {
        ctx.fillStyle = '#FF4444';
      } else if (person.state === 'blocked') {
        ctx.fillStyle = '#FFA500';
      } else {
        ctx.fillStyle = person.color;
      }
      ctx.fill();

      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (person.patience < person.maxPatience && person.state !== 'panicked') {
        const patienceWidth = radius * 1.5;
        const patienceHeight = 4;
        const patienceX = x - patienceWidth / 2;
        const patienceY = y - radius - 8;

        ctx.fillStyle = '#333';
        ctx.fillRect(patienceX, patienceY, patienceWidth, patienceHeight);

        const patienceRatio = person.patience / person.maxPatience;
        let patienceColor = '#4CAF50';
        if (patienceRatio < 0.3) patienceColor = '#F44336';
        else if (patienceRatio < 0.6) patienceColor = '#FF9800';

        ctx.fillStyle = patienceColor;
        ctx.fillRect(patienceX, patienceY, patienceWidth * patienceRatio, patienceHeight);
      }

      if (person.customTarget) {
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        const targetX = offsetX + person.customTarget.x * tileSize + tileSize / 2;
        const targetY = offsetY + person.customTarget.y * tileSize + tileSize / 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }

  drawVolunteers(state) {
    const ctx = this.ctx;
    const tileSize = this.tileSize;
    const offsetX = this.offsetX;
    const offsetY = this.offsetY;

    for (const volunteer of state.volunteers) {
      const x = offsetX + volunteer.x * tileSize + tileSize / 2;
      const y = offsetY + volunteer.y * tileSize + tileSize / 2;
      const radius = tileSize * 0.4;

      ctx.beginPath();
      ctx.arc(x, y, volunteer.effectRadius * tileSize, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD700';
      ctx.fill();
      ctx.strokeStyle = '#B8860B';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.font = `${tileSize * 0.5}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#333';
      ctx.fillText('志', x, y);

      if (volunteer.direction) {
        this.drawDirectionArrow(ctx, volunteer.direction, x, y, radius);
      }
    }
  }

  drawDirectionArrow(ctx, direction, x, y, radius) {
    ctx.save();
    ctx.translate(x, y);

    const arrowLength = radius * 1.2;
    ctx.strokeStyle = '#FF4444';
    ctx.fillStyle = '#FF4444';
    ctx.lineWidth = 3;

    let endX = 0, endY = 0;
    switch (direction) {
      case 'up': endY = -arrowLength; break;
      case 'down': endY = arrowLength; break;
      case 'left': endX = -arrowLength; break;
      case 'right': endX = arrowLength; break;
    }

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const arrowHeadSize = 8;
    ctx.beginPath();
    switch (direction) {
      case 'up':
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowHeadSize, endY + arrowHeadSize);
        ctx.lineTo(endX + arrowHeadSize, endY + arrowHeadSize);
        break;
      case 'down':
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowHeadSize, endY - arrowHeadSize);
        ctx.lineTo(endX + arrowHeadSize, endY - arrowHeadSize);
        break;
      case 'left':
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX + arrowHeadSize, endY - arrowHeadSize);
        ctx.lineTo(endX + arrowHeadSize, endY + arrowHeadSize);
        break;
      case 'right':
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowHeadSize, endY - arrowHeadSize);
        ctx.lineTo(endX - arrowHeadSize, endY + arrowHeadSize);
        break;
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawEventCard(event) {
    if (!event) return;

    const ctx = this.ctx;
    const canvas = this.canvas;
    const cardWidth = 300;
    const cardHeight = 150;
    const x = (canvas.width - cardWidth) / 2;
    const y = 20;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(x, y, cardWidth, cardHeight);
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, cardWidth, cardHeight);

    ctx.fillStyle = '#FF6B6B';
    ctx.fillRect(x, y, cardWidth, 30);

    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('⚠️ 突发事件', x + cardWidth / 2, y + 20);

    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#333';
    
    if (event.description) {
      this.wrapText(ctx, event.description, x + 15, y + 50, cardWidth - 30, 18);
    }

    if (event.actionRequired) {
      ctx.fillStyle = '#666';
      ctx.fillText(`提示: ${event.actionRequired}`, x + 15, y + cardHeight - 20);
    }
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split('');
    let line = '';
    let currentY = y;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && i > 0) {
        ctx.fillText(line, x, currentY);
        line = words[i];
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  }

  drawBroadcastMessage(message) {
    if (!message) return;

    const ctx = this.ctx;
    const canvas = this.canvas;
    const y = canvas.height - 60;
    const alpha = 0.7 + Math.sin(this.animationFrame * 0.1) * 0.2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, y, canvas.width, 50);
    ctx.restore();

    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(`📢 广播: ${message}`, canvas.width / 2, y + 32);
  }

  screenToGrid(screenX, screenY, state) {
    const gridX = (screenX - this.offsetX) / this.tileSize;
    const gridY = (screenY - this.offsetY) / this.tileSize;
    
    return {
      x: gridX,
      y: gridY,
      col: Math.floor(gridX),
      row: Math.floor(gridY),
      isValid: gridX >= 0 && gridX < state.grid.width && 
               gridY >= 0 && gridY < state.grid.height
    };
  }

  gridToScreen(gridX, gridY) {
    return {
      x: this.offsetX + gridX * this.tileSize + this.tileSize / 2,
      y: this.offsetY + gridY * this.tileSize + this.tileSize / 2
    };
  }
}

export function updateUI(state) {
  const timeEl = document.getElementById('game-time');
  const scoreEl = document.getElementById('game-score');
  const statusEl = document.getElementById('game-status');
  const evacuatedEl = document.getElementById('people-evacuated');
  const panickedEl = document.getElementById('people-panicked');
  const remainingEl = document.getElementById('people-remaining');

  if (timeEl) {
    const minutes = Math.floor(state.elapsedTime / 60);
    const seconds = Math.floor(state.elapsedTime % 60);
    const maxMinutes = Math.floor(state.maxTime / 60);
    const maxSeconds = Math.floor(state.maxTime % 60);
    timeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} / ${maxMinutes}:${maxSeconds.toString().padStart(2, '0')}`;
    
    const remainingRatio = 1 - state.elapsedTime / state.maxTime;
    if (remainingRatio < 0.3) {
      timeEl.style.color = '#FF4444';
    } else if (remainingRatio < 0.5) {
      timeEl.style.color = '#FFA500';
    } else {
      timeEl.style.color = 'inherit';
    }
  }

  if (scoreEl) {
    scoreEl.textContent = Math.round(state.score);
  }

  if (statusEl) {
    const statusMap = {
      [LevelState.NOT_STARTED]: '未开始',
      [LevelState.PLAYING]: '进行中',
      [LevelState.PAUSED]: '已暂停',
      [LevelState.WON]: '胜利',
      [LevelState.LOST]: '失败'
    };
    statusEl.textContent = statusMap[state.state] || state.state;
  }

  if (evacuatedEl) {
    evacuatedEl.textContent = state.peopleEvacuated;
  }

  if (panickedEl) {
    panickedEl.textContent = state.peoplePanicked;
  }

  if (remainingEl) {
    const remaining = state.totalPeople - state.peopleEvacuated - state.peoplePanicked;
    remainingEl.textContent = remaining;
  }
}

export function showGameResult(result, state) {
  const resultOverlay = document.getElementById('result-overlay');
  const resultTitle = document.getElementById('result-title');
  const resultScore = document.getElementById('result-score');
  const resultDetails = document.getElementById('result-details');

  if (!resultOverlay) return;

  resultOverlay.style.display = 'flex';

  if (result.isWin) {
    resultTitle.textContent = '🎉 疏散成功！';
    resultTitle.className = 'text-3xl font-bold text-green-600 mb-4';
  } else {
    resultTitle.textContent = '😔 疏散失败';
    resultTitle.className = 'text-3xl font-bold text-red-600 mb-4';
  }

  resultScore.textContent = `最终得分: ${Math.round(state.score)} 分`;

  resultDetails.innerHTML = `
    <p>疏散人数: ${state.peopleEvacuated} / ${state.totalPeople}</p>
    <p>恐慌人数: ${state.peoplePanicked}</p>
    <p>用时: ${Math.floor(state.elapsedTime / 60)}分${Math.floor(state.elapsedTime % 60)}秒</p>
  `;
}
