import React, { useEffect } from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import { MenuBar } from './components/MenuBar';
import { Timeline } from './components/Timeline';
import { CueList } from './components/CueList';
import { CueEditor } from './components/CueEditor';
import { ValidationPanel } from './components/ValidationPanel';
import { FixturePanel } from './components/FixturePanel';
import { deserializeProject } from '../shared/services/storage';
import './styles/global.css';

const sampleProjectJson = `{
  "version": "1.0.0",
  "id": "demo-project-001",
  "name": "演示项目 - 小剧场演出",
  "createdAt": 1746288000000,
  "updatedAt": 1746288000000,
  "fixtures": [
    {
      "id": "fx-001",
      "name": "主舞台面光 1",
      "model": "Source Four LED",
      "manufacturer": "ETC",
      "channelCount": 8,
      "channels": [
        {"number": 1, "name": "亮度", "type": "intensity"},
        {"number": 2, "name": "红", "type": "color"},
        {"number": 3, "name": "绿", "type": "color"},
        {"number": 4, "name": "蓝", "type": "color"},
        {"number": 5, "name": "暖白", "type": "color"},
        {"number": 6, "name": "冷白", "type": "color"},
        {"number": 7, "name": "变焦", "type": "position"},
        {"number": 8, "name": "频闪", "type": "effect"}
      ],
      "power": 230,
      "powerUnit": "W",
      "type": "spot",
      "dmxMode": "8通道",
      "notes": "舞台左侧面光"
    },
    {
      "id": "fx-002",
      "name": "主舞台面光 2",
      "model": "Source Four LED",
      "manufacturer": "ETC",
      "channelCount": 8,
      "channels": [
        {"number": 1, "name": "亮度", "type": "intensity"},
        {"number": 2, "name": "红", "type": "color"},
        {"number": 3, "name": "绿", "type": "color"},
        {"number": 4, "name": "蓝", "type": "color"},
        {"number": 5, "name": "暖白", "type": "color"},
        {"number": 6, "name": "冷白", "type": "color"},
        {"number": 7, "name": "变焦", "type": "position"},
        {"number": 8, "name": "频闪", "type": "effect"}
      ],
      "power": 230,
      "powerUnit": "W",
      "type": "spot",
      "dmxMode": "8通道",
      "notes": "舞台右侧面光"
    },
    {
      "id": "fx-003",
      "name": "摇头灯 1",
      "model": "Intimidator Spot 360",
      "manufacturer": "Chauvet DJ",
      "channelCount": 16,
      "channels": [
        {"number": 1, "name": "Pan", "type": "position"},
        {"number": 2, "name": "Pan细调", "type": "position"},
        {"number": 3, "name": "Tilt", "type": "position"},
        {"number": 4, "name": "Tilt细调", "type": "position"},
        {"number": 5, "name": "颜色", "type": "color"},
        {"number": 6, "name": "Gobo", "type": "gobo"},
        {"number": 7, "name": "棱镜", "type": "effect"},
        {"number": 8, "name": "调焦", "type": "position"},
        {"number": 9, "name": "变焦", "type": "position"},
        {"number": 10, "name": "调光", "type": "intensity"},
        {"number": 11, "name": "频闪", "type": "effect"}
      ],
      "power": 160,
      "powerUnit": "W",
      "type": "moving",
      "dmxMode": "16通道",
      "notes": "舞台左侧摇头灯"
    },
    {
      "id": "fx-004",
      "name": "LED染色条",
      "model": "COLORband PIX",
      "manufacturer": "Chauvet DJ",
      "channelCount": 6,
      "channels": [
        {"number": 1, "name": "调光", "type": "intensity"},
        {"number": 2, "name": "红", "type": "color"},
        {"number": 3, "name": "绿", "type": "color"},
        {"number": 4, "name": "蓝", "type": "color"},
        {"number": 5, "name": "琥珀", "type": "color"},
        {"number": 6, "name": "频闪", "type": "effect"}
      ],
      "power": 80,
      "powerUnit": "W",
      "type": "wash",
      "dmxMode": "6通道",
      "notes": "背景墙染色"
    },
    {
      "id": "fx-005",
      "name": "追光灯",
      "model": "Leprechaun II",
      "manufacturer": "Robert Juliat",
      "channelCount": 4,
      "channels": [
        {"number": 1, "name": "亮度", "type": "intensity"},
        {"number": 2, "name": "色温", "type": "color"},
        {"number": 3, "name": "光圈", "type": "other"},
        {"number": 4, "name": "散焦", "type": "position"}
      ],
      "power": 2500,
      "powerUnit": "W",
      "type": "spot",
      "dmxMode": "4通道",
      "notes": "主追光灯 - 高功率"
    }
  ],
  "patches": [
    {
      "id": "p-001",
      "fixtureId": "fx-001",
      "universe": 1,
      "startChannel": 1,
      "endChannel": 8,
      "patchName": "面光1",
      "notes": "舞台左侧"
    },
    {
      "id": "p-002",
      "fixtureId": "fx-002",
      "universe": 1,
      "startChannel": 9,
      "endChannel": 16,
      "patchName": "面光2",
      "notes": "舞台右侧"
    },
    {
      "id": "p-003",
      "fixtureId": "fx-003",
      "universe": 1,
      "startChannel": 17,
      "endChannel": 32,
      "patchName": "摇头1",
      "notes": "舞台左侧"
    },
    {
      "id": "p-004",
      "fixtureId": "fx-004",
      "universe": 1,
      "startChannel": 33,
      "endChannel": 38,
      "patchName": "染色条",
      "notes": "背景墙"
    },
    {
      "id": "p-005",
      "fixtureId": "fx-005",
      "universe": 1,
      "startChannel": 39,
      "endChannel": 42,
      "patchName": "追光灯",
      "notes": "主追光"
    }
  ],
  "cues": [
    {
      "id": "cue-001",
      "number": "1",
      "name": "开场暗场",
      "time": 0,
      "fadeIn": 2,
      "fadeOut": 0,
      "delay": 0,
      "isLocked": false,
      "isBlackout": true,
      "activeFixtures": ["fx-001", "fx-002", "fx-003", "fx-004", "fx-005"],
      "notes": "开场全黑准备",
      "createdAt": 1746288000000,
      "updatedAt": 1746288000000
    },
    {
      "id": "cue-002",
      "number": "2",
      "name": "主光亮起",
      "time": 2,
      "fadeIn": 3,
      "fadeOut": 0,
      "delay": 0,
      "isLocked": false,
      "isBlackout": false,
      "activeFixtures": ["fx-001", "fx-002"],
      "notes": "面光渐亮，演员上场",
      "createdAt": 1746288000000,
      "updatedAt": 1746288000000
    },
    {
      "id": "cue-003",
      "number": "3",
      "name": "背景染色",
      "time": 5,
      "fadeIn": 2,
      "fadeOut": 0,
      "delay": 0,
      "isLocked": false,
      "isBlackout": false,
      "activeFixtures": ["fx-004"],
      "notes": "背景蓝色氛围",
      "createdAt": 1746288000000,
      "updatedAt": 1746288000000
    },
    {
      "id": "cue-004",
      "number": "4",
      "name": "人物登场",
      "time": 8,
      "fadeIn": 1.5,
      "fadeOut": 0,
      "delay": 0,
      "isLocked": false,
      "isBlackout": false,
      "activeFixtures": ["fx-001", "fx-002", "fx-005"],
      "notes": "追光灯定位主角 - 高功率将触发功率警告",
      "createdAt": 1746288000000,
      "updatedAt": 1746288000000
    },
    {
      "id": "cue-005",
      "number": "5",
      "name": "场景过渡",
      "time": 15,
      "fadeIn": 4,
      "fadeOut": 2,
      "delay": 0,
      "isLocked": false,
      "isBlackout": false,
      "activeFixtures": ["fx-003", "fx-004"],
      "notes": "摇头灯效果",
      "createdAt": 1746288000000,
      "updatedAt": 1746288000000
    },
    {
      "id": "cue-006",
      "number": "6",
      "name": "高潮场景",
      "time": 20,
      "fadeIn": 3,
      "fadeOut": 1,
      "delay": 0,
      "isLocked": false,
      "isBlackout": false,
      "activeFixtures": ["fx-001", "fx-002", "fx-003", "fx-004"],
      "notes": "全亮效果",
      "createdAt": 1746288000000,
      "updatedAt": 1746288000000
    },
    {
      "id": "cue-007",
      "number": "7",
      "name": "过渡黑场",
      "time": 25,
      "fadeIn": 1,
      "fadeOut": 2,
      "delay": 0,
      "isLocked": false,
      "isBlackout": true,
      "activeFixtures": ["fx-001", "fx-002", "fx-003", "fx-004"],
      "notes": "黑场转场",
      "createdAt": 1746288000000,
      "updatedAt": 1746288000000
    },
    {
      "id": "cue-008",
      "number": "8",
      "name": "新场景",
      "time": 28,
      "fadeIn": 2,
      "fadeOut": 0,
      "delay": 0,
      "isLocked": false,
      "isBlackout": false,
      "activeFixtures": ["fx-003", "fx-004"],
      "notes": "新场景开始",
      "createdAt": 1746288000000,
      "updatedAt": 1746288000000
    },
    {
      "id": "cue-009",
      "number": "9",
      "name": "结束",
      "time": 35,
      "fadeIn": 1,
      "fadeOut": 3,
      "delay": 0,
      "isLocked": true,
      "isBlackout": false,
      "activeFixtures": ["fx-001", "fx-002"],
      "notes": "淡入淡出重叠测试 - 与Cue 10重叠",
      "createdAt": 1746288000000,
      "updatedAt": 1746288000000
    },
    {
      "id": "cue-010",
      "number": "10",
      "name": "谢幕",
      "time": 37,
      "fadeIn": 5,
      "fadeOut": 0,
      "delay": 0,
      "isLocked": true,
      "isBlackout": false,
      "activeFixtures": ["fx-001", "fx-002", "fx-004"],
      "notes": "谢幕光 - 与Cue 9淡出重叠",
      "createdAt": 1746288000000,
      "updatedAt": 1746288000000
    }
  ],
  "settings": {
    "maxChannelsPerUniverse": 512,
    "maxPower": 3000,
    "powerUnit": "W",
    "timePrecision": 2,
    "blackoutSafetyMargin": 0.5,
    "fadeOverlapThreshold": 0.1
  }
}`;

const AppContent: React.FC = () => {
  const { setProject } = useApp();

  useEffect(() => {
    try {
      const project = deserializeProject(sampleProjectJson);
      setProject(project);
    } catch (error) {
      console.error('Failed to load sample project:', error);
    }
  }, [setProject]);

  return (
    <div className="app">
      <MenuBar />
      <div className="main-layout">
        <div className="left-panel">
          <FixturePanel className="fixture-panel-section" />
          <ValidationPanel className="validation-panel-section" />
        </div>
        <div className="center-panel">
          <Timeline className="timeline-section" />
          <CueList className="cue-list-section" />
        </div>
        <div className="right-panel">
          <CueEditor className="cue-editor-section" />
        </div>
      </div>

      <style>{`
        .app {
          display: flex;
          flex-direction: column;
          width: 100vw;
          height: 100vh;
          background-color: var(--bg-primary);
          overflow: hidden;
        }

        .main-layout {
          display: flex;
          flex: 1;
          overflow: hidden;
          padding: 16px;
          gap: 16px;
        }

        .left-panel {
          display: flex;
          flex-direction: column;
          width: 320px;
          min-width: 280px;
          gap: 16px;
          overflow: hidden;
        }

        .fixture-panel-section {
          flex: 1;
          min-height: 0;
        }

        .validation-panel-section {
          flex: 1;
          min-height: 0;
        }

        .center-panel {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 400px;
          gap: 16px;
          overflow: hidden;
        }

        .timeline-section {
          height: 280px;
          min-height: 200px;
          flex-shrink: 0;
        }

        .cue-list-section {
          flex: 1;
          min-height: 0;
        }

        .right-panel {
          display: flex;
          flex-direction: column;
          width: 360px;
          min-width: 300px;
          overflow: hidden;
        }

        .cue-editor-section {
          flex: 1;
          min-height: 0;
        }

        @media (max-width: 1200px) {
          .main-layout {
            flex-wrap: wrap;
            overflow-y: auto;
          }

          .left-panel {
            width: 100%;
            flex-direction: row;
          }

          .center-panel {
            width: 100%;
            min-width: auto;
          }

          .right-panel {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
