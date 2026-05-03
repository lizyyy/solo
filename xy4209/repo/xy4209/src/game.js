import { LevelState, PersonType, initLevelState, validateLevel } from './levels.js';
import { ActionType, startGame, pauseGame, resumeGame, checkGameEnd, updateGame, recordAction, calculateScore } from './state.js';
import { updateAllPersons } from './pathfinding.js';
import { checkEventTriggers, applyEvent, updateActiveEvents, EventType, BroadcastType } from './events.js';
import { Renderer, updateUI, showGameResult } from './render.js';
import { saveHighScore, getHighScores, isNewHighScore, saveReplay } from './save.js';
import { generateMarkdownReport, downloadMarkdown } from './export.js';

class Game {
  constructor() {
    this.canvas = null;
    this.renderer = null;
    this.state = null;
    this.levelData = null;
    this.isRunning = false;
    this.lastFrameTime = null;
    this.animationId = null;
    
    this.draggedVolunteer = null;
    this.selectedVolunteer = null;
    
    this.pendingEvent = null;
  }

  async init() {
    this.canvas = document.getElementById('game-canvas');
    if (!this.canvas) {
      console.error('Canvas element not found');
      return false;
    }
    
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    this.renderer = new Renderer(this.canvas);
    
    await this.loadLevel();
    this.setupEventListeners();
    
    return true;
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    this.canvas.width = Math.min(rect.width - 20, 800);
    this.canvas.height = Math.min(rect.height - 20, 600);
    
    if (this.renderer && this.state) {
      this.renderer.resize(this.state.grid.width, this.state.grid.height);
    }
  }

  async loadLevel(levelPath = 'data/levels/basic.json') {
    try {
      const response = await fetch(levelPath);
      if (!response.ok) {
        throw new Error(`Failed to load level: ${response.status}`);
      }
      
      this.levelData = await response.json();
      
      const validation = validateLevel(this.levelData);
      if (!validation.valid) {
        console.error('Level validation failed:', validation.errors);
        throw new Error('Invalid level data');
      }
      
      this.state = initLevelState(this.levelData);
      this.renderer.resize(this.state.grid.width, this.state.grid.height);
      
      this.updateHighScoreDisplay();
      
      return true;
    } catch (error) {
      console.error('Error loading level:', error);
      return false;
    }
  }

  setupEventListeners() {
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const exportBtn = document.getElementById('export-btn');
    
    if (startBtn) {
      startBtn.addEventListener('click', () => this.start());
    }
    
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.togglePause());
    }
    
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.reset());
    }
    
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportReport());
    }
    
    this.setupBroadcastButtons();
    this.setupDirectionButtons();
    this.setupCanvasInteraction();
    
    const levelSelect = document.getElementById('level-select');
    if (levelSelect) {
      levelSelect.addEventListener('change', async (e) => {
        const levelPath = e.target.value;
        await this.loadLevel(levelPath);
        this.render();
      });
    }
  }

  setupBroadcastButtons() {
    const calmBtn = document.getElementById('broadcast-calm');
    const urgencyBtn = document.getElementById('broadcast-urgency');
    
    if (calmBtn) {
      calmBtn.addEventListener('click', () => this.useBroadcast(BroadcastType.CALM_MESSAGE));
    }
    
    if (urgencyBtn) {
      urgencyBtn.addEventListener('click', () => this.useBroadcast(BroadcastType.GENERAL_EVACUATION));
    }
  }

  setupDirectionButtons() {
    const dirUp = document.getElementById('dir-up');
    const dirDown = document.getElementById('dir-down');
    const dirLeft = document.getElementById('dir-left');
    const dirRight = document.getElementById('dir-right');
    const dirClear = document.getElementById('dir-clear');
    
    if (dirUp) dirUp.addEventListener('click', () => this.setVolunteerDirection('up'));
    if (dirDown) dirDown.addEventListener('click', () => this.setVolunteerDirection('down'));
    if (dirLeft) dirLeft.addEventListener('click', () => this.setVolunteerDirection('left'));
    if (dirRight) dirRight.addEventListener('click', () => this.setVolunteerDirection('right'));
    if (dirClear) dirClear.addEventListener('click', () => this.setVolunteerDirection(null));
  }

  setupCanvasInteraction() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
  }

  handleMouseDown(e) {
    if (this.state.state !== LevelState.PLAYING) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const grid = this.renderer.screenToGrid(x, y, this.state);
    
    const clickedVolunteer = this.state.volunteers.find(v => 
      Math.abs(v.x - grid.x) < 0.5 && Math.abs(v.y - grid.y) < 0.5
    );
    
    if (clickedVolunteer) {
      this.draggedVolunteer = clickedVolunteer;
      this.selectedVolunteer = clickedVolunteer;
    }
  }

  handleMouseMove(e) {
    if (!this.draggedVolunteer) return;
    if (this.state.state !== LevelState.PLAYING) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const grid = this.renderer.screenToGrid(x, y, this.state);
    
    if (grid.isValid) {
      const col = grid.col;
      const row = grid.row;
      
      if (this.draggedVolunteer.x !== col || this.draggedVolunteer.y !== row) {
        this.state.volunteers = this.state.volunteers.map(v => {
          if (v.id === this.draggedVolunteer.id) {
            return { ...v, x: col, y: row };
          }
          return v;
        });
        
        this.state = recordAction(this.state, ActionType.MOVE_VOLUNTEER, {
          volunteerId: this.draggedVolunteer.id,
          from: { x: this.draggedVolunteer.x, y: this.draggedVolunteer.y },
          to: { x: col, y: row }
        });
        
        this.draggedVolunteer.x = col;
        this.draggedVolunteer.y = row;
      }
    }
  }

  handleMouseUp(e) {
    this.draggedVolunteer = null;
  }

  handleClick(e) {
    if (this.state.state !== LevelState.PLAYING) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const grid = this.renderer.screenToGrid(x, y, this.state);
    
    const clickedVolunteer = this.state.volunteers.find(v => 
      Math.abs(v.x - grid.x) < 0.5 && Math.abs(v.y - grid.y) < 0.5
    );
    
    if (clickedVolunteer) {
      this.selectedVolunteer = clickedVolunteer;
      this.updateDirectionButtons();
    }
  }

  setVolunteerDirection(direction) {
    if (!this.selectedVolunteer) return;
    if (this.state.state !== LevelState.PLAYING) return;
    
    this.state.volunteers = this.state.volunteers.map(v => {
      if (v.id === this.selectedVolunteer.id) {
        return { ...v, direction };
      }
      return v;
    });
    
    this.selectedVolunteer.direction = direction;
    
    this.state = recordAction(this.state, ActionType.DIRECT_PEOPLE, {
      volunteerId: this.selectedVolunteer.id,
      direction
    });
    
    this.updateDirectionButtons();
  }

  updateDirectionButtons() {
    const buttons = ['up', 'down', 'left', 'right', 'clear'];
    
    buttons.forEach(dir => {
      const btn = document.getElementById(`dir-${dir}`);
      if (btn) {
        btn.classList.remove('bg-yellow-500', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
        
        if (this.selectedVolunteer && this.selectedVolunteer.direction === dir) {
          btn.classList.remove('bg-gray-200', 'text-gray-700');
          btn.classList.add('bg-yellow-500', 'text-white');
        }
      }
    });
  }

  useBroadcast(broadcastType) {
    if (this.state.state !== LevelState.PLAYING) return;
    
    const event = {
      id: `broadcast_${Date.now()}`,
      type: EventType.BROADCAST_ANNOUNCEMENT,
      broadcastType,
      triggered: false,
      triggerType: 'manual',
      duration: 10
    };
    
    this.state = applyEvent(this.state, event);
    this.state = recordAction(this.state, ActionType.USE_BROADCAST, {
      broadcastType
    });
  }

  start() {
    if (this.state.state === LevelState.PLAYING) return;
    
    this.state = startGame(this.state);
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.gameLoop();
    
    this.updateButtons();
  }

  togglePause() {
    if (this.state.state === LevelState.PLAYING) {
      this.state = pauseGame(this.state);
      this.isRunning = false;
    } else if (this.state.state === LevelState.PAUSED) {
      this.state = resumeGame(this.state);
      this.isRunning = true;
      this.lastFrameTime = performance.now();
      this.gameLoop();
    }
    
    this.updateButtons();
  }

  updateButtons() {
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    
    if (startBtn) {
      startBtn.disabled = this.state.state === LevelState.PLAYING;
    }
    
    if (pauseBtn) {
      pauseBtn.disabled = this.state.state !== LevelState.PLAYING && this.state.state !== LevelState.PAUSED;
      pauseBtn.textContent = this.state.state === LevelState.PAUSED ? '继续' : '暂停';
    }
  }

  reset() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.isRunning = false;
    this.draggedVolunteer = null;
    this.selectedVolunteer = null;
    this.pendingEvent = null;
    
    if (this.levelData) {
      this.state = initLevelState(this.levelData);
    }
    
    const resultOverlay = document.getElementById('result-overlay');
    if (resultOverlay) {
      resultOverlay.style.display = 'none';
    }
    
    this.updateButtons();
    this.render();
    updateUI(this.state);
  }

  gameLoop() {
    if (!this.isRunning) return;
    
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = currentTime;
    
    this.state = this.update(deltaTime);
    this.render();
    updateUI(this.state);
    
    if (this.state.state === LevelState.WON || this.state.state === LevelState.LOST) {
      this.endGame();
      return;
    }
    
    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }

  update(deltaTime) {
    let newState = { ...this.state };
    
    newState.elapsedTime += deltaTime;
    
    newState = updateAllPersons(newState, deltaTime);
    newState = updateActiveEvents(newState, deltaTime);
    
    const triggeredEvents = checkEventTriggers(newState, newState.elapsedTime);
    for (const event of triggeredEvents) {
      if (event.type === EventType.BROADCAST_ANNOUNCEMENT) {
        this.pendingEvent = event;
        this.isRunning = false;
        this.showEventDialog(event);
      } else {
        newState = applyEvent(newState, event);
      }
    }
    
    newState.score = calculateScore(newState);
    newState = checkGameEnd(newState);
    
    return newState;
  }

  showEventDialog(event) {
    const dialog = document.getElementById('event-dialog');
    const eventDesc = document.getElementById('event-description');
    const calmOpt = document.getElementById('option-calm');
    const urgentOpt = document.getElementById('option-urgent');
    const confirmBtn = document.getElementById('confirm-choice');
    
    if (!dialog) return;
    
    dialog.style.display = 'block';
    
    if (eventDesc) {
      eventDesc.textContent = '需要选择广播内容：';
    }
    
    let selectedOption = null;
    
    if (calmOpt) {
      calmOpt.onclick = () => {
        selectedOption = BroadcastType.CALM_MESSAGE;
        calmOpt.classList.add('ring-2', 'ring-blue-500');
        if (urgentOpt) urgentOpt.classList.remove('ring-2', 'ring-blue-500');
      };
    }
    
    if (urgentOpt) {
      urgentOpt.onclick = () => {
        selectedOption = BroadcastType.GENERAL_EVACUATION;
        urgentOpt.classList.add('ring-2', 'ring-blue-500');
        if (calmOpt) calmOpt.classList.remove('ring-2', 'ring-blue-500');
      };
    }
    
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        if (selectedOption) {
          const broadcastEvent = {
            ...event,
            broadcastType: selectedOption
          };
          this.state = applyEvent(this.state, broadcastEvent);
          this.state = recordAction(this.state, ActionType.USE_BROADCAST, {
            broadcastType: selectedOption
          });
          
          dialog.style.display = 'none';
          this.isRunning = true;
          this.lastFrameTime = performance.now();
          this.gameLoop();
        }
      };
    }
  }

  render() {
    if (!this.renderer || !this.state) return;
    
    this.renderer.clear();
    this.renderer.drawGrid(this.state);
    this.renderer.drawPersons(this.state);
    this.renderer.drawVolunteers(this.state);
    
    if (this.state.currentEvent) {
      this.renderer.drawEventCard(this.state.currentEvent);
    }
    
    if (this.state.activeBroadcasts && this.state.activeBroadcasts.length > 0) {
      const latestBroadcast = this.state.activeBroadcasts[this.state.activeBroadcasts.length - 1];
      this.renderer.drawBroadcastMessage(latestBroadcast.message);
    }
  }

  endGame() {
    this.isRunning = false;
    
    const isWin = this.state.state === LevelState.WON;
    
    showGameResult({ isWin }, this.state);
    
    if (isNewHighScore(this.state.levelId, this.state.score)) {
      saveHighScore(this.state.levelId, this.state.score, this.state.elapsedTime, {
        peopleEvacuated: this.state.peopleEvacuated,
        peoplePanicked: this.state.peoplePanicked,
        actionsTaken: this.state.replayActions.length
      });
      
      this.updateHighScoreDisplay();
    }
    
    saveReplay(this.state.levelId, this.state.replayActions, {
      finalScore: this.state.score,
      isWin,
      peopleEvacuated: this.state.peopleEvacuated,
      peoplePanicked: this.state.peoplePanicked
    });
  }

  updateHighScoreDisplay() {
    const highScoreEl = document.getElementById('high-score');
    const scores = getHighScores(this.state?.levelId);
    
    if (highScoreEl && scores.length > 0) {
      highScoreEl.textContent = Math.round(scores[0].score);
    }
  }

  exportReport() {
    if (!this.state) return;
    
    const isWin = this.state.state === LevelState.WON;
    const report = generateMarkdownReport(this.state, { isWin });
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
    const filename = `evacuation-report-${timestamp}.md`;
    
    downloadMarkdown(report, filename);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const game = new Game();
  const initialized = await game.init();
  
  if (initialized) {
    game.render();
    updateUI(game.state);
  }
});

export { Game };
