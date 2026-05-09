import './styles/main.css';
import SceneManager from './core/SceneManager';
import ElementFactory from './core/ElementFactory';
import CollisionDetector from './core/CollisionDetector';
import ReportGenerator from './utils/ReportGenerator';
import UIHandler from './ui/UIHandler';

const stageSize = { width: 16, height: 8, depth: 10 };

const sceneManager = new SceneManager({
  container: document.getElementById('scene'),
  stageSize
});

const elementFactory = new ElementFactory();
const collisionDetector = new CollisionDetector(stageSize);
const reportGenerator = new ReportGenerator();
const uiHandler = new UIHandler();

const initialElements = [
  elementFactory.createLightRig({
    id: 'light-rig-1',
    name: '主灯架',
    position: { x: 0, y: 6, z: -3 },
    size: { width: 8, height: 0.5, depth: 0.5 }
  }),
  elementFactory.createLightRig({
    id: 'light-rig-2',
    name: '侧灯架',
    position: { x: 7, y: 4, z: 0 },
    size: { width: 0.5, height: 5, depth: 0.5 }
  }),
  elementFactory.createCurtain({
    id: 'curtain-1',
    name: '背景幕布',
    position: { x: 0, y: 4, z: 4 },
    size: { width: 12, height: 6, depth: 0.2 }
  }),
  elementFactory.createCurtain({
    id: 'curtain-2',
    name: '侧幕布',
    position: { x: -5, y: 4, z: 0 },
    size: { width: 0.2, height: 6, depth: 8 }
  }),
  elementFactory.createCamera({
    id: 'camera-1',
    name: '主摄像机',
    position: { x: 0, y: 3, z: -5 },
    size: { width: 0.8, height: 1.8, depth: 1.2 }
  }),
  elementFactory.createCamera({
    id: 'camera-2',
    name: '侧摄像机',
    position: { x: 6, y: 3, z: -5 },
    size: { width: 0.8, height: 1.8, depth: 1.2 }
  })
];

sceneManager.addElements(initialElements);

uiHandler.init({
  sceneManager,
  collisionDetector,
  reportGenerator,
  stageSize
});

sceneManager.init();

function animate() {
  requestAnimationFrame(animate);
  sceneManager.update();
  uiHandler.updateStatus();
}

animate();
