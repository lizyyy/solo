import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { BoardScene } from './scenes/BoardScene';
import { initStore, subscribe, getState, setActivePanel } from './store/gameStore';
import { initPanels } from './ui/panelManager';

initStore();

const gameContainer = document.getElementById('game-container');
if (!gameContainer) throw new Error('game-container not found');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: gameContainer.clientWidth,
  height: gameContainer.clientHeight,
  backgroundColor: '#1a1a2e',
  scene: [BootScene, BoardScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

initPanels();

document.querySelectorAll('.panel-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const panel = (tab as HTMLElement).dataset.panel;
    if (panel) setActivePanel(panel as 'import' | 'review' | 'correct' | 'history' | 'export');
  });
});

subscribe(() => {
  const { activePanel } = getState();
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel-section').forEach(s => s.classList.remove('active'));
  const activeTab = document.querySelector(`.panel-tab[data-panel="${activePanel}"]`);
  const activeSection = document.getElementById(`panel-${activePanel}`);
  if (activeTab) activeTab.classList.add('active');
  if (activeSection) activeSection.classList.add('active');
});

window.addEventListener('resize', () => {
  game.scale.resize(gameContainer.clientWidth, gameContainer.clientHeight);
});

(window as unknown as Record<string, unknown>).__game = game;
