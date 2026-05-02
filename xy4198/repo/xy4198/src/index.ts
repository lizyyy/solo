import './styles.css';
import { GameController } from './game/GameController';
import { ToolType, Direction } from './models/types';

let gameController: GameController;

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }
  
  gameController = new GameController(canvas);
  bindUIEvents();
});

function bindUIEvents(): void {
  const toolButtons = document.querySelectorAll('.tool-btn');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.getAttribute('data-tool') as ToolType;
      if (tool) {
        gameController.setTool(tool);
      }
    });
  });
  
  const startBtn = document.getElementById('startSimulation');
  const pauseBtn = document.getElementById('pauseSimulation');
  const resetBtn = document.getElementById('resetSimulation');
  
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      gameController.startSimulation();
    });
  }
  
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      gameController.pauseSimulation();
    });
  }
  
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      gameController.resetSimulation();
    });
  }
  
  const resizeBtn = document.getElementById('resizeGrid');
  const clearBtn = document.getElementById('clearAll');
  
  if (resizeBtn) {
    resizeBtn.addEventListener('click', () => {
      const widthInput = document.getElementById('gridWidth') as HTMLInputElement;
      const heightInput = document.getElementById('gridHeight') as HTMLInputElement;
      
      const width = parseInt(widthInput.value, 10);
      const height = parseInt(heightInput.value, 10);
      
      gameController.resizeGrid(width, height);
    });
  }
  
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('确定要清空所有内容吗？')) {
        gameController.clearAll();
      }
    });
  }
  
  const saveLevelBtn = document.getElementById('saveLevel');
  const loadLevelBtn = document.getElementById('loadLevel');
  
  if (saveLevelBtn) {
    saveLevelBtn.addEventListener('click', async () => {
      await gameController.saveLevelToFile();
    });
  }
  
  if (loadLevelBtn) {
    loadLevelBtn.addEventListener('click', async () => {
      await gameController.loadLevelFromFile();
      
      const level = gameController.getLevel();
      const widthInput = document.getElementById('gridWidth') as HTMLInputElement;
      const heightInput = document.getElementById('gridHeight') as HTMLInputElement;
      
      if (widthInput) widthInput.value = level.width.toString();
      if (heightInput) heightInput.value = level.height.toString();
    });
  }
  
  const exampleButtons = document.querySelectorAll('.example-btn');
  exampleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const levelKey = btn.getAttribute('data-level') as 'simple' | 'medium' | 'hard';
      if (levelKey) {
        gameController.loadExampleLevel(levelKey);
        
        const level = gameController.getLevel();
        const widthInput = document.getElementById('gridWidth') as HTMLInputElement;
        const heightInput = document.getElementById('gridHeight') as HTMLInputElement;
        
        if (widthInput) widthInput.value = level.width.toString();
        if (heightInput) heightInput.value = level.height.toString();
      }
    });
  });
  
  const exportMarkdownBtn = document.getElementById('exportMarkdown');
  const exportJSONBtn = document.getElementById('exportJSON');
  
  if (exportMarkdownBtn) {
    exportMarkdownBtn.addEventListener('click', () => {
      gameController.exportMarkdown();
    });
  }
  
  if (exportJSONBtn) {
    exportJSONBtn.addEventListener('click', () => {
      gameController.exportJSON();
    });
  }
  
  document.addEventListener('keydown', (e) => {
    handleKeyboardEvent(e);
  });
}

function handleKeyboardEvent(e: KeyboardEvent): void {
  switch (e.key) {
    case '1':
      gameController.setTool('select');
      break;
    case '2':
      gameController.setTool('wall');
      break;
    case '3':
      gameController.setTool('exit');
      break;
    case '4':
      gameController.setTool('smoke');
      break;
    case '5':
      gameController.setTool('customer');
      break;
    case '6':
      gameController.setTool('sign');
      break;
    case '7':
      gameController.setTool('eraser');
      break;
    case ' ':
      e.preventDefault();
      const simulation = gameController.getSimulation();
      if (simulation && simulation.isRunning) {
        gameController.pauseSimulation();
      } else if (!simulation || !simulation.isRunning) {
        gameController.startSimulation();
      }
      break;
    case 'r':
    case 'R':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        gameController.resetSimulation();
      }
      break;
    case 'ArrowUp':
      gameController.setSignDirection(Direction.UP);
      break;
    case 'ArrowDown':
      gameController.setSignDirection(Direction.DOWN);
      break;
    case 'ArrowLeft':
      gameController.setSignDirection(Direction.LEFT);
      break;
    case 'ArrowRight':
      gameController.setSignDirection(Direction.RIGHT);
      break;
  }
}
