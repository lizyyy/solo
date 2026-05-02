import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from './store';
import { SceneManager } from './utils/sceneManager';
import { runAllRules, generateInspectionSuggestions } from './utils/rulesEngine';
import {
  TimelineControl,
  SensorDetailPanel,
  AlertPanel,
  ImportPanel,
  ExportPanel,
} from './components';
import './App.css';

type ActiveTab = 'scene' | 'import' | 'export';

export const App: React.FC = () => {
  const sceneRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('scene');
  const [isInitialized, setIsInitialized] = useState(false);

  const {
    floors,
    sensors,
    workOrders,
    thresholds,
    currentTime,
    selectedSensorId,
    setSelectedSensor,
    setAlerts,
    setInspectionSuggestions,
    alerts,
    getSensorReadingAtTime,
  } = useAppStore();

  const initializeScene = useCallback(() => {
    if (sceneRef.current && !sceneManagerRef.current) {
      sceneManagerRef.current = new SceneManager(sceneRef.current);
      
      sceneManagerRef.current.onSensorClick = (sensorId) => {
        setSelectedSensor(sensorId);
      };
      
      setIsInitialized(true);
    }
  }, [setSelectedSensor]);

  useEffect(() => {
    initializeScene();
    
    return () => {
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose();
        sceneManagerRef.current = null;
      }
    };
  }, [initializeScene]);

  useEffect(() => {
    if (sceneManagerRef.current && floors.length > 0) {
      sceneManagerRef.current.loadFloors(floors);
    }
  }, [floors, isInitialized]);

  useEffect(() => {
    if (sceneManagerRef.current && sensors.length > 0) {
      sceneManagerRef.current.loadSensors(sensors);
    }
  }, [sensors, isInitialized]);

  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setThresholds(thresholds);
    }
  }, [thresholds, isInitialized]);

  useEffect(() => {
    if (sceneManagerRef.current) {
      const sensorIdsWithAlert = new Set(
        alerts.filter((a) => a.sensorId).map((a) => a.sensorId!)
      );

      sensors.forEach((sensor) => {
        const reading = getSensorReadingAtTime(sensor.id, currentTime);
        if (reading) {
          sceneManagerRef.current!.updateSensorTemperature(
            sensor.id,
            reading.temperature,
            reading.isOnline,
            sensorIdsWithAlert.has(sensor.id)
          );
        }
      });
    }
  }, [sensors, currentTime, alerts, isInitialized, getSensorReadingAtTime]);

  useEffect(() => {
    if (sensors.length === 0) return;

    const newAlerts = runAllRules(
      sensors,
      workOrders,
      thresholds,
      currentTime
    );
    
    setAlerts(newAlerts);

    const suggestions = generateInspectionSuggestions(
      newAlerts,
      sensors,
      workOrders
    );
    
    setInspectionSuggestions(suggestions);
  }, [sensors, workOrders, thresholds, currentTime, setAlerts, setInspectionSuggestions]);

  useEffect(() => {
    if (sceneManagerRef.current && selectedSensorId) {
      sceneManagerRef.current.focusOnSensor(selectedSensorId);
    }
  }, [selectedSensorId, isInitialized]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏢 室内热区巡检沙盘</h1>
        <nav className="main-nav">
          <button
            className={`nav-btn ${activeTab === 'scene' ? 'active' : ''}`}
            onClick={() => setActiveTab('scene')}
          >
            🗺️ 3D沙盘
          </button>
          <button
            className={`nav-btn ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            📥 数据导入
          </button>
          <button
            className={`nav-btn ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            📤 数据导出
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'scene' && (
          <div className="scene-container">
            <div className="left-panel">
              <AlertPanel />
            </div>

            <div className="center-panel">
              <div ref={sceneRef} className="scene-canvas" />
              <TimelineControl />
            </div>

            <div className="right-panel">
              <SensorDetailPanel />
            </div>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="settings-container">
            <ImportPanel />
          </div>
        )}

        {activeTab === 'export' && (
          <div className="settings-container">
            <ExportPanel />
          </div>
        )}
      </main>

      {sensors.length === 0 && activeTab === 'scene' && (
        <div className="welcome-overlay">
          <div className="welcome-content">
            <h2>欢迎使用室内热区巡检沙盘</h2>
            <p>请导入数据或加载示例数据开始使用</p>
            <div className="welcome-buttons">
              <button
                className="btn btn-primary btn-large"
                onClick={() => setActiveTab('import')}
              >
                📥 前往数据导入
              </button>
            </div>
            <div className="feature-list">
              <div className="feature-item">
                <span className="feature-icon">🗺️</span>
                <div>
                  <h4>3D立体沙盘</h4>
                  <p>楼层叠层可视化，支持旋转和缩放</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🌡️</span>
                <div>
                  <h4>热力变化播放</h4>
                  <p>时间轴控制，查看温湿度变化趋势</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">⚠️</span>
                <div>
                  <h4>智能规则引擎</h4>
                  <p>自动检测连续超阈、离线、重复派单</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📄</span>
                <div>
                  <h4>巡检建议导出</h4>
                  <p>支持Markdown报告和CSV表格</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
