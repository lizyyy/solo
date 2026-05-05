import React, { useState, useEffect, useCallback } from 'react';
import type {
  ApplicationState,
  SeedlingTray,
  MoistureSensorData,
  NozzleCalibration,
  NutrientRecipe,
  ImportResult
} from './types';
import {
  sampleSeedlingTrays,
  sampleMoistureSensorData,
  sampleNozzleCalibrations,
  sampleNutrientRecipes
} from './utils/sampleData';
import {
  parseSeedlingTrayCSV,
  parseMoistureSensorCSV,
  parseNozzleCalibrationCSV
} from './utils/csvParser';
import { analyzeAllBeds, getOverallRiskLevel } from './utils/analysis';
import {
  saveState,
  loadState,
  saveAnalysisOverrides,
  mergeAnalysisWithOverrides,
  clearState
} from './utils/storage';
import {
  generateMarkdownReport,
  generateJSONExport,
  downloadFile
} from './utils/export';
import FileUpload from './components/FileUpload';
import BedAnalysisCard from './components/BedAnalysisCard';

const initialState: ApplicationState = {
  seedlingTrays: [],
  sensorData: [],
  nozzleCalibrations: [],
  nutrientRecipes: [],
  bedAnalyses: [],
  lastUpdated: new Date().toISOString(),
  isUsingSampleData: false
};

function App() {
  const [state, setState] = useState<ApplicationState>(initialState);
  const [importMessages, setImportMessages] = useState<Record<string, { type: 'success' | 'error'; message: string }>>({});
  const [importSectionCollapsed, setImportSectionCollapsed] = useState(false);
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  useEffect(() => {
    const savedState = loadState();
    if (savedState) {
      const mergedAnalyses = mergeAnalysisWithOverrides(savedState.bedAnalyses);
      setState({
        ...savedState,
        bedAnalyses: mergedAnalyses
      });
    }
  }, []);

  useEffect(() => {
    if (state.bedAnalyses.length > 0) {
      saveState(state);
      saveAnalysisOverrides(state.bedAnalyses);
    }
  }, [state]);

  const analyzeData = useCallback((
    trays: SeedlingTray[],
    sensorData: MoistureSensorData[],
    nozzles: NozzleCalibration[],
    recipes: NutrientRecipe[],
    isSampleData: boolean
  ) => {
    const analyses = analyzeAllBeds(trays, sensorData, nozzles, recipes);
    const mergedAnalyses = mergeAnalysisWithOverrides(analyses);

    setState({
      seedlingTrays: trays,
      sensorData,
      nozzleCalibrations: nozzles,
      nutrientRecipes: recipes,
      bedAnalyses: mergedAnalyses,
      lastUpdated: new Date().toISOString(),
      isUsingSampleData: isSampleData
    });
  }, []);

  const loadSampleData = () => {
    analyzeData(
      sampleSeedlingTrays,
      sampleMoistureSensorData,
      sampleNozzleCalibrations,
      sampleNutrientRecipes,
      true
    );
    setImportMessages({});
  };

  const handleFileSelect = async (file: File, fileType: string) => {
    try {
      const text = await file.text();
      let result: ImportResult;
      const newState = { ...state };
      const isSampleData = false;

      switch (fileType) {
        case 'seedlingTrays':
          result = parseSeedlingTrayCSV(text);
          if (result.success && result.data) {
            newState.seedlingTrays = result.data as SeedlingTray[];
          }
          break;
        case 'sensorData':
          result = parseMoistureSensorCSV(text);
          if (result.success && result.data) {
            newState.sensorData = result.data as MoistureSensorData[];
          }
          break;
        case 'nozzleCalibrations':
          result = parseNozzleCalibrationCSV(text);
          if (result.success && result.data) {
            newState.nozzleCalibrations = result.data as NozzleCalibration[];
          }
          break;
        case 'nutrientRecipes':
          try {
            const jsonData = JSON.parse(text) as NutrientRecipe[];
            newState.nutrientRecipes = Array.isArray(jsonData) ? jsonData : [jsonData];
            result = {
              success: true,
              message: `成功解析 ${newState.nutrientRecipes.length} 条配方记录`
            };
          } catch {
            result = {
              success: false,
              message: 'JSON 解析失败，请检查文件格式',
              errors: ['无效的 JSON 格式']
            };
          }
          break;
        default:
          result = { success: false, message: '未知的文件类型' };
      }

      setImportMessages(prev => ({
        ...prev,
        [fileType]: {
          type: result.success ? 'success' : 'error',
          message: result.message
        }
      }));

      if (result.success) {
        newState.isUsingSampleData = isSampleData;
        newState.lastUpdated = new Date().toISOString();

        if (
          newState.seedlingTrays.length > 0 ||
          newState.sensorData.length > 0 ||
          newState.nozzleCalibrations.length > 0
        ) {
          const analyses = analyzeAllBeds(
            newState.seedlingTrays,
            newState.sensorData,
            newState.nozzleCalibrations,
            newState.nutrientRecipes
          );
          const mergedAnalyses = mergeAnalysisWithOverrides(analyses);
          newState.bedAnalyses = mergedAnalyses;
        }

        setState(newState);
      }
    } catch (error) {
      setImportMessages(prev => ({
        ...prev,
        [fileType]: {
          type: 'error',
          message: `文件读取失败: ${(error as Error).message}`
        }
      }));
    }
  };

  const handleUpdateNotes = (bedId: string, notes: string) => {
    setState(prev => ({
      ...prev,
      bedAnalyses: prev.bedAnalyses.map(analysis =>
        analysis.bedId === bedId
          ? { ...analysis, notes, lastUpdated: new Date().toISOString() }
          : analysis
      )
    }));
  };

  const handleManualOverride = (
    bedId: string,
    isOverridden: boolean,
    reason: string,
    decision: 'ignore' | 'mark_as_resolved' | 'assign_to_technician'
  ) => {
    setState(prev => ({
      ...prev,
      bedAnalyses: prev.bedAnalyses.map(analysis =>
        analysis.bedId === bedId
          ? {
              ...analysis,
              manualOverride: isOverridden
                ? {
                    isOverridden: true,
                    overrideReason: reason,
                    overrideDecision: decision
                  }
                : undefined,
              lastUpdated: new Date().toISOString()
            }
          : analysis
      )
    }));
  };

  const exportMarkdown = () => {
    const content = generateMarkdownReport(state.bedAnalyses, state);
    const filename = `温室育苗喷灌交接单_${new Date().toISOString().split('T')[0]}.md`;
    downloadFile(content, filename, 'text/markdown');
  };

  const exportJSON = () => {
    const content = generateJSONExport(state);
    const filename = `温室育苗喷灌数据_${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(content, filename, 'application/json');
  };

  const handleClearData = () => {
    clearState();
    setState(initialState);
    setImportMessages({});
    setShowConfirmClear(false);
  };

  const filteredAnalyses = state.bedAnalyses.filter(analysis => {
    if (riskFilter === 'all') return true;
    const riskLevel = getOverallRiskLevel(analysis.risks);
    if (riskFilter === 'hasRisk') return analysis.risks.length > 0;
    return riskLevel === riskFilter;
  });

  const stats = {
    total: state.bedAnalyses.length,
    high: state.bedAnalyses.filter(a => getOverallRiskLevel(a.risks) === 'high').length,
    medium: state.bedAnalyses.filter(a => getOverallRiskLevel(a.risks) === 'medium').length,
    low: state.bedAnalyses.filter(a => getOverallRiskLevel(a.risks) === 'low').length
  };

  const hasData = state.bedAnalyses.length > 0;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1 className="header-title">🌱 温室育苗喷灌校准工具</h1>
            <p className="header-subtitle">
              苗床分析 · 风险检测 · 智能校准
              {state.isUsingSampleData && (
                <span className="sample-data-badge" style={{ marginLeft: '0.5rem' }}>
                  📋 示例数据
                </span>
              )}
            </p>
          </div>
          <div className="header-actions">
            <button className="btn btn-primary" onClick={loadSampleData}>
              📋 加载示例数据
            </button>
            {hasData && (
              <>
                <button className="btn btn-secondary" onClick={exportMarkdown}>
                  📄 导出 Markdown
                </button>
                <button className="btn btn-secondary" onClick={exportJSON}>
                  💾 导出 JSON
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => setShowConfirmClear(true)}
                >
                  🗑️ 清除数据
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        {!hasData && (
          <div className="empty-state">
            <div className="empty-state-icon">🌿</div>
            <h2 className="empty-state-title">开始使用温室育苗喷灌校准工具</h2>
            <p className="empty-state-text">
              导入您的数据文件或点击"加载示例数据"来体验工具功能
            </p>
            <button
              className="btn btn-success"
              style={{ marginTop: '1.5rem' }}
              onClick={loadSampleData}
            >
              📋 加载示例数据
            </button>
          </div>
        )}

        <section className="dashboard-section">
          <div
            className={`import-section ${importSectionCollapsed ? 'collapsed' : ''}`}
          >
            <div className="section-header">
              <h2 className="section-title">📥 数据导入</h2>
              <button
                className="toggle-btn"
                onClick={() => setImportSectionCollapsed(!importSectionCollapsed)}
              >
                {importSectionCollapsed ? '▼ 展开' : '▲ 收起'}
              </button>
            </div>

            <div className="file-upload-container">
              <FileUpload
                label="苗盘清单 (CSV)"
                description="包含苗盘编号、苗床编号、种苗类型等信息"
                fileType="seedlingTrays"
                accept=".csv"
                onFileSelect={handleFileSelect}
              />
              {importMessages.seedlingTrays && (
                <div className={`import-message ${importMessages.seedlingTrays.type}`}>
                  {importMessages.seedlingTrays.message}
                </div>
              )}

              <FileUpload
                label="土壤湿度传感器数据 (CSV)"
                description="包含湿度、EC 值、温度等传感器数据"
                fileType="sensorData"
                accept=".csv"
                onFileSelect={handleFileSelect}
              />
              {importMessages.sensorData && (
                <div className={`import-message ${importMessages.sensorData.type}`}>
                  {importMessages.sensorData.message}
                </div>
              )}

              <FileUpload
                label="喷头流量标定表 (CSV)"
                description="包含喷头编号、流量、状态等标定数据"
                fileType="nozzleCalibrations"
                accept=".csv"
                onFileSelect={handleFileSelect}
              />
              {importMessages.nozzleCalibrations && (
                <div className={`import-message ${importMessages.nozzleCalibrations.type}`}>
                  {importMessages.nozzleCalibrations.message}
                </div>
              )}

              <FileUpload
                label="营养液配方 (JSON)"
                description="包含不同种苗阶段的营养液配方"
                fileType="nutrientRecipes"
                accept=".json"
                onFileSelect={handleFileSelect}
              />
              {importMessages.nutrientRecipes && (
                <div className={`import-message ${importMessages.nutrientRecipes.type}`}>
                  {importMessages.nutrientRecipes.message}
                </div>
              )}
            </div>
          </div>
        </section>

        {hasData && (
          <>
            <section className="dashboard-section">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">总苗床数</div>
                  <div className="stat-value">{stats.total}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">高风险苗床</div>
                  <div className="stat-value high">{stats.high}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">中风险苗床</div>
                  <div className="stat-value medium">{stats.medium}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">低风险苗床</div>
                  <div className="stat-value low">{stats.low}</div>
                </div>
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-header">
                <h2 className="section-title">📊 苗床分析结果</h2>
              </div>

              <div className="filter-section">
                <span className="filter-label">风险筛选:</span>
                <select
                  className="filter-select"
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                >
                  <option value="all">全部苗床</option>
                  <option value="hasRisk">有风险苗床</option>
                  <option value="high">高风险</option>
                  <option value="medium">中风险</option>
                  <option value="low">低风险/无风险</option>
                </select>
                <span className="filter-label" style={{ marginLeft: '1rem' }}>
                  显示 {filteredAnalyses.length} 个苗床
                </span>
              </div>

              <div className="analysis-list">
                {filteredAnalyses.length > 0 ? (
                  filteredAnalyses.map((analysis) => (
                    <BedAnalysisCard
                      key={analysis.bedId}
                      analysis={analysis}
                      onUpdateNotes={handleUpdateNotes}
                      onManualOverride={handleManualOverride}
                    />
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <h2 className="empty-state-title">没有匹配的苗床</h2>
                    <p className="empty-state-text">
                      尝试调整筛选条件或导入更多数据
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="dashboard-section">
              <div className="export-section">
                <div className="section-header">
                  <h2 className="section-title">📤 数据导出</h2>
                </div>
                <div className="export-buttons">
                  <button className="btn btn-success" onClick={exportMarkdown}>
                    📄 导出 Markdown 交接单
                  </button>
                  <button className="btn btn-primary" onClick={exportJSON}>
                    💾 导出 JSON 明细
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          温室育苗喷灌校准工具 · 最后更新:{' '}
          {new Date(state.lastUpdated).toLocaleString('zh-CN')}
        </p>
      </footer>

      {showConfirmClear && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '2rem',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
              确认清除数据
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              此操作将清除所有导入的数据、人工改判和备注信息。此操作不可撤销。
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowConfirmClear(false)}
              >
                取消
              </button>
              <button className="btn btn-danger" onClick={handleClearData}>
                确认清除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
