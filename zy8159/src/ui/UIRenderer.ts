import {
  GameState,
  Position
} from '../types';
import { MapSystem } from '../core';

export class UIRenderer {
  private mapContainer: HTMLElement;
  private turnCounter: HTMLElement;
  private powerStatus: HTMLElement;
  private collectedArts: HTMLElement;
  private custodianInfo: HTMLElement;
  private eventCard: HTMLElement;
  private risksList: HTMLElement;
  private messageLog: HTMLElement;
  private gameMap: HTMLElement;

  constructor() {
    this.mapContainer = document.getElementById('game-map')!;
    this.turnCounter = document.getElementById('turn-counter')!;
    this.powerStatus = document.getElementById('power-status')!;
    this.collectedArts = document.getElementById('collected-arts')!;
    this.custodianInfo = document.getElementById('custodian-info')!;
    this.eventCard = document.getElementById('event-card')!;
    this.risksList = document.getElementById('risks-list')!;
    this.messageLog = document.getElementById('message-log')!;
    this.gameMap = document.getElementById('game-map')!;
  }

  renderGameState(
    state: GameState,
    mapSystem: MapSystem,
    reachablePositions: Position[] = []
  ): void {
    this.renderHeader(state);
    this.renderMap(state, mapSystem, reachablePositions);
    this.renderCustodianInfo(state, mapSystem);
    this.renderEventCard(state);
    this.renderRisks(state);
    this.renderMessageLog(state);
  }

  private renderHeader(state: GameState): void {
    this.turnCounter.textContent = `回合: ${state.turn} / ${state.maxTurns}`;
    
    if (state.isPowerOutage) {
      this.powerStatus.textContent = `电力: 故障 (剩余 ${state.powerOutageTurnsRemaining} 回合)`;
      this.powerStatus.style.color = '#f59e0b';
    } else {
      this.powerStatus.textContent = '电力: 正常';
      this.powerStatus.style.color = '#22c55e';
    }

    this.collectedArts.textContent = `已撤展: ${state.securedArtifactsCount} / ${state.totalArtifactsToSecure}`;
  }

  private renderMap(
    state: GameState,
    mapSystem: MapSystem,
    reachablePositions: Position[]
  ): void {
    const width = mapSystem.getWidth();
    const height = mapSystem.getHeight();
    const grid = mapSystem.getGrid();

    this.mapContainer.innerHTML = '';
    this.mapContainer.style.gridTemplateColumns = `repeat(${width}, 60px)`;
    this.mapContainer.style.gridTemplateRows = `repeat(${height}, 60px)`;

    if (state.isPowerOutage) {
      this.gameMap.classList.add('power-outage');
    } else {
      this.gameMap.classList.remove('power-outage');
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = document.createElement('div');
        cell.className = 'map-cell';
        cell.dataset.x = x.toString();
        cell.dataset.y = y.toString();

        const cellType = grid[y][x];
        const position = { x, y };

        const displayCase = state.displayCases.find(
          dc => dc.position.x === x && dc.position.y === y
        );

        const custodian = state.custodians.find(
          c => c.position.x === x && c.position.y === y
        );

        const guard = state.guards.find(
          g => g.position.x === x && g.position.y === y
        );

        const isExit = mapSystem.isExit(position);
        const isReachable = reachablePositions.some(
          p => p.x === x && p.y === y
        );

        if (cellType === 'wall') {
          cell.classList.add('wall');
          cell.innerHTML = '<div class="cell-content">🧱</div>';
        } else if (isExit) {
          cell.classList.add('exit');
          cell.innerHTML = '<div class="cell-content">🚪</div>';
        } else if (displayCase) {
          cell.classList.add('case');
          if (displayCase.isLocked) {
            cell.classList.add('locked');
            cell.innerHTML = '<div class="cell-content">🔒</div>';
          } else {
            cell.innerHTML = '<div class="cell-content">📦</div>';
          }
        } else {
          cell.classList.add('floor');
          cell.innerHTML = '<div class="cell-content"></div>';
        }

        if (guard) {
          cell.classList.add('guard');
          const directionArrow = this.getDirectionArrow(guard.direction);
          cell.innerHTML = `<div class="cell-content">👮 ${directionArrow}</div>`;
        }

        if (custodian) {
          cell.classList.add('custodian');
          const loadIndicator = custodian.currentLoad > 0 ? ` (${custodian.currentLoad})` : '';
          cell.innerHTML = `<div class="cell-content">👨‍💼${loadIndicator}</div>`;

          if (custodian.isSelected) {
            cell.classList.add('selected');
          }
        }

        if (isReachable) {
          cell.classList.add('reachable');
        }

        this.mapContainer.appendChild(cell);
      }
    }
  }

  private getDirectionArrow(direction: string): string {
    switch (direction) {
      case 'up': return '⬆️';
      case 'down': return '⬇️';
      case 'left': return '⬅️';
      case 'right': return '➡️';
      default: return '';
    }
  }

  private renderCustodianInfo(state: GameState, mapSystem: MapSystem): void {
    const selectedCustodian = state.custodians.find(c => c.isSelected);

    if (!selectedCustodian) {
      this.custodianInfo.innerHTML = '<p>选择一名保管员查看详情</p>';
      return;
    }

    const loadPercentage = (selectedCustodian.currentLoad / selectedCustodian.maxLoad) * 100;
    const carriedArtifacts = state.artifacts.filter(
      a => selectedCustodian.carriedArtifacts.includes(a.id)
    );

    let html = `
      <div class="custodian-details">
        <h4>${selectedCustodian.name}</h4>
        <p>📍 位置: (${selectedCustodian.position.x}, ${selectedCustodian.position.y})</p>
        <p>⚡ 移动状态: ${selectedCustodian.canMove ? '可移动' : '已移动'}</p>
        <p>📦 载重: ${selectedCustodian.currentLoad} / ${selectedCustodian.maxLoad}</p>
        <div class="stat-bar">
          <div class="stat-fill load" style="width: ${loadPercentage}%"></div>
        </div>
    `;

    if (carriedArtifacts.length > 0) {
      html += '<p style="margin-top: 10px;"><strong>🎒 携带的文物:</strong></p>';
      html += '<ul style="margin-top: 5px; padding-left: 15px;">';
      for (const artifact of carriedArtifacts) {
        html += `<li style="margin-bottom: 5px; font-size: 0.8rem;">${artifact.name} (重量: ${artifact.weight})</li>`;
      }
      html += '</ul>';
    } else {
      html += '<p style="margin-top: 10px;">🎒 未携带任何文物</p>';
    }

    const adjacentCase = state.displayCases.find(
      dc => mapSystem.getDistance(selectedCustodian.position, dc.position) === 0
    );

    if (adjacentCase) {
      const artifact = state.artifacts.find(a => a.caseId === adjacentCase.id);
      html += `<p style="margin-top: 10px;"><strong>📦 当前位置:</strong> 展柜 ${adjacentCase.id}</p>`;
      html += `<p>🔐 展柜状态: ${adjacentCase.isLocked ? '已锁定 🔒' : '已解锁 🔓'}</p>`;
      if (artifact && !artifact.isSecured) {
        html += `<p>🎨 文物: ${artifact.name} (重量: ${artifact.weight})</p>`;
      }
    }

    if (mapSystem.isExit(selectedCustodian.position)) {
      html += '<p style="margin-top: 10px; color: #22c55e;"><strong>🚪 当前位置: 安全出口</strong></p>';
      if (selectedCustodian.carriedArtifacts.length > 0) {
        html += '<p style="color: #22c55e;">💡 可点击"存放文物"按钮将文物放置到安全出口</p>';
      }
    }

    html += '</div>';
    this.custodianInfo.innerHTML = html;
  }

  private renderEventCard(state: GameState): void {
    if (state.activeEvents.length === 0) {
      this.eventCard.innerHTML = '<p>无活跃事件</p>';
      return;
    }

    let html = '';
    for (const event of state.activeEvents) {
      const typeColor = event.type === 'negative' ? '#ef4444' : event.type === 'positive' ? '#22c55e' : '#60a5fa';
      html += `
        <div class="event-card-content">
          <h4 style="color: ${typeColor};">${event.name}</h4>
          <p>${event.description}</p>
          <p><strong>剩余回合:</strong> ${event.turnsRemaining}</p>
        </div>
      `;
    }
    this.eventCard.innerHTML = html;
  }

  private renderRisks(state: GameState): void {
    if (state.risks.length === 0) {
      this.risksList.innerHTML = '<p>暂无风险</p>';
      return;
    }

    let html = '';
    for (const risk of state.risks) {
      const severityColor = risk.severity === 'critical' ? '#ef4444' :
                          risk.severity === 'high' ? '#f97316' :
                          risk.severity === 'medium' ? '#f59e0b' : '#60a5fa';
      
      html += `
        <div class="risk-item" style="border-color: ${severityColor};">
          <h4 style="color: ${severityColor};">${this.getRiskTypeName(risk.type)} (${risk.severity})</h4>
          <p>${risk.description}</p>
        </div>
      `;
    }
    this.risksList.innerHTML = html;
  }

  private getRiskTypeName(type: string): string {
    switch (type) {
      case 'routeConflict': return '路线冲突';
      case 'timeout': return '超时风险';
      case 'guardDetection': return '被发现';
      case 'powerFailure': return '电力故障';
      default: return type;
    }
  }

  private renderMessageLog(state: GameState): void {
    const recentLogs = state.logs.slice(-20);
    
    if (recentLogs.length === 0) {
      this.messageLog.innerHTML = '<h3>📝 消息日志</h3><p>暂无消息</p>';
      return;
    }

    let html = '<h3>📝 消息日志</h3>';
    for (const log of recentLogs) {
      const typeClass = `log-entry ${log.type}`;
      html += `
        <div class="${typeClass}">
          <strong>[回合 ${log.turn}]</strong> ${log.message}
          ${log.details ? `<br><small>${log.details}</small>` : ''}
        </div>
      `;
    }
    this.messageLog.innerHTML = html;

    this.messageLog.scrollTop = this.messageLog.scrollHeight;
  }

  showGameEnd(result: string, secured: number, total: number): void {
    let message = '';

    switch (result) {
      case 'victory':
        message = `🎉 恭喜！任务成功！已安全转移 ${secured}/${total} 件文物。`;
        break;
      case 'defeat':
        message = '💀 任务失败！保管员被安保人员发现。';
        break;
      case 'timeout':
        message = `⏰ 时间耗尽！仅转移了 ${secured}/${total} 件文物。`;
        break;
    }

    alert(`游戏结束: ${message}`);
  }

  getMapCell(x: number, y: number): HTMLElement | null {
    return this.mapContainer.querySelector(`[data-x="${x}"][data-y="${y}"]`);
  }

  addMapClickListener(callback: (x: number, y: number) => void): void {
    this.mapContainer.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const cell = target.closest('.map-cell');
      if (cell) {
        const x = parseInt(cell.getAttribute('data-x') || '0');
        const y = parseInt(cell.getAttribute('data-y') || '0');
        callback(x, y);
      }
    });
  }
}
