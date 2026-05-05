import { useState } from 'react';
import { useAppState } from './hooks/useAppState';
import FileImporter from './components/FileImporter';
import RiskDashboard from './components/RiskDashboard';
import RoofPlan from './components/RoofPlan';
import HiveDetails from './components/HiveDetails';
import { exportToMarkdown, exportToJSON, downloadFile } from './utils/exporter';
import { clearAllStorage } from './utils/storage';
import './App.css';

function App() {
  const {
    hives,
    sensorData,
    inspectionRecords,
    wateringSchedules,
    reviewNotes,
    riskAssessments,
    selectedHive,
    setSelectedHive,
    addHives,
    addSensorData,
    addInspectionRecords,
    addWateringSchedules,
    updateReviewNote,
    getHiveRiskAssessment,
    getHiveSensorData,
    getHiveInspectionRecords,
    getHiveWateringSchedule,
    clearAllData
  } = useAppState();

  const [activeView, setActiveView] = useState('dashboard');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleExportMarkdown = () => {
    const markdown = exportToMarkdown(hives, riskAssessments, reviewNotes, {
      title: '蜂箱热害巡检报告',
      date: new Date().toLocaleDateString('zh-CN')
    });
    
    const filename = `蜂箱巡检报告_${new Date().toISOString().split('T')[0]}.md`;
    downloadFile(markdown, filename, 'text/markdown');
  };

  const handleExportJSON = () => {
    const json = exportToJSON(
      hives, 
      sensorData, 
      inspectionRecords, 
      wateringSchedules, 
      riskAssessments, 
      reviewNotes
    );
    
    const filename = `蜂箱数据_${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(json, filename, 'application/json');
  };

  const handleClearAllData = () => {
    clearAllData();
    setShowClearConfirm(false);
  };

  const selectedHiveRiskAssessment = selectedHive ? getHiveRiskAssessment(selectedHive.id) : null;
  const selectedHiveSensorData = selectedHive ? getHiveSensorData(selectedHive.id) : null;
  const selectedHiveInspectionRecords = selectedHive ? getHiveInspectionRecords(selectedHive.id) : null;
  const selectedHiveWateringSchedule = selectedHive ? getHiveWateringSchedule(selectedHive.id) : null;
  const selectedHiveReviewNote = selectedHive ? reviewNotes[selectedHive.id] : null;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">🐝 蜂箱热害巡检系统</h1>
          <p className="app-subtitle">城市天台养蜂风险监测与管理工具</p>
        </div>
        
        <div className="header-right">
          <div className="export-buttons">
            <button 
              className="export-btn markdown"
              onClick={handleExportMarkdown}
              disabled={hives.length === 0}
            >
              📄 导出Markdown
            </button>
            <button 
              className="export-btn json"
              onClick={handleExportJSON}
              disabled={hives.length === 0}
            >
              📊 导出JSON
            </button>
          </div>
          
          <button 
            className="clear-btn"
            onClick={() => setShowClearConfirm(true)}
          >
            🗑️ 清除数据
          </button>
        </div>
      </header>

      <nav className="app-nav">
        <button 
          className={`nav-btn ${activeView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveView('dashboard')}
        >
          📈 风险概览
        </button>
        <button 
          className={`nav-btn ${activeView === 'map' ? 'active' : ''}`}
          onClick={() => setActiveView('map')}
        >
          🗺️ 屋顶平面图
        </button>
        <button 
          className={`nav-btn ${activeView === 'import' ? 'active' : ''}`}
          onClick={() => setActiveView('import')}
        >
          📥 数据导入
        </button>
      </nav>

      <main className="app-main">
        <div className={`main-content ${selectedHive ? 'with-details' : ''}`}>
          {activeView === 'dashboard' && (
            <RiskDashboard 
              hives={hives}
              riskAssessments={riskAssessments}
              onSelectHive={setSelectedHive}
            />
          )}

          {activeView === 'map' && (
            <RoofPlan 
              hives={hives}
              riskAssessments={riskAssessments}
              selectedHive={selectedHive}
              onSelectHive={setSelectedHive}
            />
          )}

          {activeView === 'import' && (
            <FileImporter 
              onImportHives={addHives}
              onImportSensorData={addSensorData}
              onImportInspectionRecords={addInspectionRecords}
              onImportWateringSchedules={addWateringSchedules}
            />
          )}
        </div>

        {selectedHive && (
          <aside className="details-panel">
            <HiveDetails 
              hive={selectedHive}
              riskAssessment={selectedHiveRiskAssessment}
              sensorData={selectedHiveSensorData}
              inspectionRecords={selectedHiveInspectionRecords}
              wateringSchedule={selectedHiveWateringSchedule}
              reviewNote={selectedHiveReviewNote}
              onUpdateReviewNote={updateReviewNote}
              onClose={() => setSelectedHive(null)}
            />
          </aside>
        )}
      </main>

      {showClearConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>确认清除数据</h3>
            <p>您确定要清除所有已导入的数据吗？此操作不可撤销。</p>
            <div className="modal-actions">
              <button 
                className="modal-btn cancel"
                onClick={() => setShowClearConfirm(false)}
              >
                取消
              </button>
              <button 
                className="modal-btn confirm"
                onClick={handleClearAllData}
              >
                确认清除
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <p>蜂箱热害巡检系统 - 为城市天台养蜂人提供实时风险监测</p>
      </footer>
    </div>
  );
}

export default App;
