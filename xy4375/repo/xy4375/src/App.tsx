import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Prescription,
  HerbBatch,
  DecoctionSchedule,
  DecoctionPot,
  RiskEvent,
  ReviewLog,
  AuditTrail,
  DailyWorkSession,
  PickupTimeSlot,
  ImportResult,
  PrescriptionHerb,
} from './types';
import {
  parsePrescriptionCSV,
  parseHerbBatchJSON,
  parseDecoctionPotCSV,
  parsePickupTimeSlotCSV,
} from './utils/dataParser';
import {
  detectAllRisks,
  RISK_TYPE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  SPECIAL_PROCESS_LABELS,
} from './utils/riskDetector';
import {
  loadPrescriptions,
  savePrescriptions,
  loadHerbBatches,
  saveHerbBatches,
  loadDecoctionPots,
  saveDecoctionSchedules,
  loadDecoctionSchedules,
  loadPickupTimeSlots,
  loadRiskEvents,
  saveRiskEvents,
  loadReviewLogs,
  loadAuditTrails,
  loadDailySessions,
  startNewSession,
  endCurrentSession,
  getCurrentSession,
  updateSessionStats,
  updateRiskReview,
  addDecoctionSchedule,
  updateDecoctionSchedule,
  deleteDecoctionSchedule,
  initializeDefaultData,
  addPrescription,
  addHerbBatch,
  exportAllData,
  importAllData,
  clearAllData,
  addAuditTrail,
} from './utils/storage';
import {
  exportDecoctionHandover,
  exportBatchHandover,
  exportRiskListCSV,
  exportAuditJSON,
} from './utils/exporter';
import './App.css';

type ActiveView = 'dashboard' | 'import' | 'prescriptions' | 'schedules' | 'risks' | 'export' | 'settings';

function App() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [herbBatches, setHerbBatches] = useState<HerbBatch[]>([]);
  const [decoctionPots, setDecoctionPots] = useState<DecoctionPot[]>([]);
  const [schedules, setSchedules] = useState<DecoctionSchedule[]>([]);
  const [timeSlots, setTimeSlots] = useState<PickupTimeSlot[]>([]);
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>([]);
  const [reviewLogs, setReviewLogs] = useState<ReviewLog[]>([]);
  const [auditTrails, setAuditTrails] = useState<AuditTrail[]>([]);
  const [dailySessions, setDailySessions] = useState<DailyWorkSession[]>([]);
  const [currentSession, setCurrentSession] = useState<DailyWorkSession | null>(null);
  
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<DecoctionSchedule | null>(null);
  const [selectedRisk, setSelectedRisk] = useState<RiskEvent | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  
  const [importErrors, setImportErrors] = useState<{ file: string; errors: string[] }[]>([]);
  const [importWarnings, setImportWarnings] = useState<{ file: string; warnings: string[] }[]>([]);
  const [importResults, setImportResults] = useState<{
    prescriptions: number;
    batches: number;
    pots: number;
    slots: number;
  }>({ prescriptions: 0, batches: 0, pots: 0, slots: 0 });

  const [operatorName, setOperatorName] = useState('');
  const [showSessionModal, setShowSessionModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initializeDefaultData();
    loadAllData();
    
    const session = getCurrentSession();
    if (session) {
      setCurrentSession(session);
    } else {
      setShowSessionModal(true);
    }
  }, []);

  const loadAllData = useCallback(() => {
    setPrescriptions(loadPrescriptions());
    setHerbBatches(loadHerbBatches());
    setDecoctionPots(loadDecoctionPots());
    setSchedules(loadDecoctionSchedules());
    setTimeSlots(loadPickupTimeSlots());
    setRiskEvents(loadRiskEvents());
    setReviewLogs(loadReviewLogs());
    setAuditTrails(loadAuditTrails());
    setDailySessions(loadDailySessions());
  }, []);

  const showNotification = useCallback((message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleStartSession = useCallback(() => {
    if (!operatorName.trim()) {
      setError('请输入操作人员姓名');
      return;
    }
    const session = startNewSession(operatorName.trim());
    setCurrentSession(session);
    setShowSessionModal(false);
    setError(null);
    showNotification(`欢迎，${operatorName}！会话已开始`);
  }, [operatorName, showNotification]);

  const handleEndSession = useCallback(() => {
    const session = endCurrentSession();
    if (session) {
      setCurrentSession(null);
      setDailySessions(loadDailySessions());
      showNotification('会话已结束');
      setShowSessionModal(true);
    }
  }, [showNotification]);

  const handleFileImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, fileType: 'prescription' | 'batch' | 'pot' | 'slot') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setImportErrors([]);
    setImportWarnings([]);

    try {
      const text = await file.text();
      let result: ImportResult<unknown>;

      switch (fileType) {
        case 'prescription':
          result = parsePrescriptionCSV(text);
          if (result.success && result.data.length > 0) {
            const existing = loadPrescriptions();
            const toAdd = result.data as Prescription[];
            toAdd.forEach(p => addPrescription(p));
            setPrescriptions(loadPrescriptions());
            updateSessionStats({ prescriptionsImported: result.data.length });
            setImportResults(prev => ({ ...prev, prescriptions: prev.prescriptions + result.data.length }));
          }
          break;
        case 'batch':
          result = parseHerbBatchJSON(text);
          if (result.success && result.data.length > 0) {
            const existing = loadHerbBatches();
            const toAdd = result.data as HerbBatch[];
            toAdd.forEach(b => addHerbBatch(b));
            setHerbBatches(loadHerbBatches());
            updateSessionStats({ batchesImported: result.data.length });
            setImportResults(prev => ({ ...prev, batches: prev.batches + result.data.length }));
          }
          break;
        case 'pot':
          result = parseDecoctionPotCSV(text);
          if (result.success && result.data.length > 0) {
            const pots = result.data as DecoctionPot[];
            const existingPots = loadDecoctionPots();
            const merged = [...existingPots, ...pots];
            saveDecoctionSchedules(merged as unknown as DecoctionSchedule[]);
            setDecoctionPots(loadDecoctionPots());
            setImportResults(prev => ({ ...prev, pots: prev.pots + result.data.length }));
          }
          break;
        case 'slot':
          result = parsePickupTimeSlotCSV(text);
          if (result.success && result.data.length > 0) {
            setTimeSlots(prev => [...prev, ...(result.data as PickupTimeSlot[])]);
            setImportResults(prev => ({ ...prev, slots: prev.slots + result.data.length }));
          }
          break;
        default:
          throw new Error('未知的文件类型');
      }

      const risks = detectAllRisks(
        loadPrescriptions(),
        loadHerbBatches(),
        loadDecoctionSchedules(),
        loadPickupTimeSlots()
      );
      if (risks.length > 0) {
        saveRiskEvents(risks);
        setRiskEvents(risks);
        updateSessionStats({ risksDetected: risks.length });
      }

      showNotification('数据导入完成');
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  }, [timeSlots, showNotification]);

  const handleRiskReview = useCallback((
    riskId: string,
    isReviewed: boolean,
    reviewResult: RiskEvent['reviewResult'],
    reviewNotes: string
  ) => {
    if (!currentSession) {
      setError('请先开始工作会话');
      return;
    }

    try {
      const updatedRisk = updateRiskReview(
        riskId,
        isReviewed,
        reviewResult,
        reviewNotes,
        currentSession.operatorName
      );

      setRiskEvents(prev =>
        prev.map(r => r.id === riskId ? updatedRisk : r)
      );
      setReviewLogs(loadReviewLogs());
      setAuditTrails(loadAuditTrails());
      updateSessionStats({ risksReviewed: 1 });

      if (selectedRisk?.id === riskId) {
        setSelectedRisk(updatedRisk);
      }

      showNotification('风险复核已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }, [currentSession, selectedRisk, showNotification]);

  const handleCreateSchedule = useCallback((
    potId: string,
    prescriptionIds: string[]
  ) => {
    const pot = decoctionPots.find(p => p.id === potId);
    if (!pot) {
      setError('请选择有效的煎锅');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const todaySchedules = schedules.filter(s => s.potNo === pot.potNo && s.scheduleDate === today);
    
    const newSchedule: Omit<DecoctionSchedule, 'id' | 'createdAt' | 'updatedAt'> = {
      scheduleDate: today,
      potId: pot.id,
      potNo: pot.potNo,
      batchNo: todaySchedules.length + 1,
      sequence: todaySchedules.length + 1,
      prescriptions: prescriptionIds,
      status: 'pending',
      startTime: null,
      endTime: null,
      actualFirstDecoctionTime: null,
      actualSecondDecoctionTime: null,
      operatorName: currentSession?.operatorName || '',
      notes: '',
    };

    const schedule = addDecoctionSchedule(newSchedule);
    setSchedules(loadDecoctionSchedules());
    updateSessionStats({ schedulesCreated: 1 });
    showNotification('排程已创建');

    const risks = detectAllRisks(
      loadPrescriptions(),
      loadHerbBatches(),
      loadDecoctionSchedules(),
      loadPickupTimeSlots()
    );
    if (risks.length > 0) {
      saveRiskEvents(risks);
      setRiskEvents(risks);
    }
  }, [decoctionPots, schedules, currentSession, showNotification]);

  const handleExportDecoctionHandover = useCallback((prescription: Prescription) => {
    const schedule = schedules.find(s => s.prescriptions.includes(prescription.id));
    const pot = schedule ? decoctionPots.find(p => p.id === schedule.potId) : undefined;
    exportDecoctionHandover(prescription, schedule, pot, riskEvents);
    showNotification('煎药交接单已导出');
  }, [schedules, decoctionPots, riskEvents, showNotification]);

  const handleExportBatchHandover = useCallback((potNo?: string) => {
    exportBatchHandover(schedules, prescriptions, decoctionPots, riskEvents, potNo);
    showNotification('批次交接单已导出');
  }, [schedules, prescriptions, decoctionPots, riskEvents, showNotification]);

  const handleExportRiskList = useCallback(() => {
    exportRiskListCSV(riskEvents, prescriptions, schedules);
    showNotification('风险清单已导出');
  }, [riskEvents, prescriptions, schedules, showNotification]);

  const handleExportAudit = useCallback(() => {
    exportAuditJSON(prescriptions, herbBatches, schedules, riskEvents, reviewLogs, auditTrails);
    showNotification('审计包已导出');
  }, [prescriptions, herbBatches, schedules, riskEvents, reviewLogs, auditTrails, showNotification]);

  const handleExportAllData = useCallback(() => {
    const data = exportAllData();
    const content = JSON.stringify(data, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `数据备份_${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('数据备份已导出');
  }, [showNotification]);

  const handleImportDataFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    file.text()
      .then(text => {
        try {
          const data = JSON.parse(text);
          const success = importAllData(data);
          if (success) {
            loadAllData();
            showNotification('数据导入成功');
          } else {
            setError('数据导入失败');
          }
        } catch {
          setError('JSON 文件格式错误');
        } finally {
          setIsLoading(false);
          event.target.value = '';
        }
      })
      .catch(() => {
        setError('读取文件失败');
        setIsLoading(false);
      });
  }, [showNotification, loadAllData]);

  const handleClearAllData = useCallback(() => {
    if (window.confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      clearAllData();
      loadAllData();
      showNotification('所有数据已清空');
    }
  }, [showNotification, loadAllData]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayPrescriptions = prescriptions.filter(p => p.orderDate === today);
    const todaySchedules = schedules.filter(s => s.scheduleDate === today);
    const pendingRisks = riskEvents.filter(r => !r.isReviewed);
    const criticalRisks = riskEvents.filter(r => r.severity === 'critical' && !r.isReviewed);
    const urgentPrescriptions = prescriptions.filter(p => 
      (p.priority === 'urgent' || p.priority === 'emergency') && 
      (p.status === 'pending' || p.status === 'preparing')
    );

    return {
      totalPrescriptions: prescriptions.length,
      todayPrescriptions: todayPrescriptions.length,
      totalSchedules: schedules.length,
      todaySchedules: todaySchedules.length,
      pendingRisks: pendingRisks.length,
      criticalRisks: criticalRisks.length,
      urgentPrescriptions: urgentPrescriptions.length,
      completedPrescriptions: prescriptions.filter(p => p.status === 'completed' || p.status === 'picked_up').length,
    };
  }, [prescriptions, schedules, riskEvents]);

  const renderSessionModal = () => (
    <div className="modal-overlay">
      <div className="modal session-modal">
        <div className="modal-header">
          <h2>开始工作会话</h2>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>操作人员姓名</label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="请输入您的姓名"
              className="form-input"
              onKeyDown={(e) => e.key === 'Enter' && handleStartSession()}
            />
          </div>
          {error && <div className="error-text">{error}</div>}
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-primary"
            onClick={handleStartSession}
            disabled={!operatorName.trim()}
          >
            开始工作
          </button>
        </div>
      </div>
    </div>
  );

  const renderNav = () => (
    <nav className="sidebar-nav">
      <div className="nav-header">
        <h1>🫖 中药煎药复核</h1>
        {currentSession && (
          <div className="session-info">
            <span className="operator-name">{currentSession.operatorName}</span>
            <span className="session-status active">● 工作中</span>
          </div>
        )}
      </div>
      
      <ul className="nav-menu">
        <li>
          <button
            className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveView('dashboard')}
          >
            📊 仪表盘
            {stats.criticalRisks > 0 && (
              <span className="badge critical">{stats.criticalRisks}</span>
            )}
          </button>
        </li>
        <li>
          <button
            className={`nav-item ${activeView === 'import' ? 'active' : ''}`}
            onClick={() => setActiveView('import')}
          >
            📥 数据导入
          </button>
        </li>
        <li>
          <button
            className={`nav-item ${activeView === 'prescriptions' ? 'active' : ''}`}
            onClick={() => setActiveView('prescriptions')}
          >
            📋 处方管理
            {stats.urgentPrescriptions > 0 && (
              <span className="badge urgent">{stats.urgentPrescriptions}</span>
            )}
          </button>
        </li>
        <li>
          <button
            className={`nav-item ${activeView === 'schedules' ? 'active' : ''}`}
            onClick={() => setActiveView('schedules')}
          >
            🍳 锅次排程
          </button>
        </li>
        <li>
          <button
            className={`nav-item ${activeView === 'risks' ? 'active' : ''}`}
            onClick={() => setActiveView('risks')}
          >
            ⚠️ 风险复核
            {stats.pendingRisks > 0 && (
              <span className="badge warning">{stats.pendingRisks}</span>
            )}
          </button>
        </li>
        <li>
          <button
            className={`nav-item ${activeView === 'export' ? 'active' : ''}`}
            onClick={() => setActiveView('export')}
          >
            📤 导出报表
          </button>
        </li>
        <li>
          <button
            className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveView('settings')}
          >
            ⚙️ 设置
          </button>
        </li>
      </ul>

      {currentSession && (
        <div className="nav-footer">
          <button
            className="btn btn-danger btn-small"
            onClick={handleEndSession}
          >
            结束会话
          </button>
        </div>
      )}
    </nav>
  );

  const renderDashboard = () => (
    <div className="view-content">
      <div className="view-header">
        <h2>仪表盘</h2>
        <p className="view-subtitle">今日工作概览</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <div className="stat-value">{stats.todayPrescriptions}</div>
            <div className="stat-label">今日处方</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🍳</div>
          <div className="stat-content">
            <div className="stat-value">{stats.todaySchedules}</div>
            <div className="stat-label">今日排程</div>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <div className="stat-value">{stats.pendingRisks}</div>
            <div className="stat-label">待复核风险</div>
          </div>
        </div>
        <div className="stat-card critical">
          <div className="stat-icon">🔴</div>
          <div className="stat-content">
            <div className="stat-value">{stats.criticalRisks}</div>
            <div className="stat-label">严重风险</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-panel">
          <div className="panel-header">
            <h3>紧急处方</h3>
          </div>
          <div className="panel-body">
            {stats.urgentPrescriptions > 0 ? (
              <div className="prescription-list">
                {prescriptions
                  .filter(p => (p.priority === 'urgent' || p.priority === 'emergency') && (p.status === 'pending' || p.status === 'preparing'))
                  .slice(0, 5)
                  .map(p => (
                    <div key={p.id} className="prescription-item urgent">
                      <div className="prescription-info">
                        <span className="prescription-no">{p.prescriptionNo}</span>
                        <span className="patient-name">{p.patientName}</span>
                      </div>
                      <span className={`priority-badge ${p.priority}`}>
                        {p.priority === 'emergency' ? '急诊' : '加急'}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="empty-state-small">暂无紧急处方</div>
            )}
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="panel-header">
            <h3>风险概览</h3>
          </div>
          <div className="panel-body">
            <div className="risk-summary">
              {(['critical', 'high', 'medium', 'low'] as const).map(severity => {
                const count = riskEvents.filter(r => r.severity === severity && !r.isReviewed).length;
                return (
                  <div key={severity} className={`risk-summary-item ${severity}`}>
                    <span className="severity-label">{SEVERITY_LABELS[severity]}</span>
                    <span className="severity-count">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-panel">
        <div className="panel-header">
          <h3>最近风险事件</h3>
          <button className="btn-link" onClick={() => setActiveView('risks')}>查看全部 →</button>
        </div>
        <div className="panel-body">
          {riskEvents.length > 0 ? (
            <div className="risk-list">
              {riskEvents.slice(0, 5).map(risk => (
                <div
                  key={risk.id}
                  className={`risk-item ${risk.isReviewed ? 'reviewed' : ''}`}
                  onClick={() => {
                    setSelectedRisk(risk);
                    setActiveView('risks');
                  }}
                >
                  <div className="risk-severity-indicator" style={{ backgroundColor: SEVERITY_COLORS[risk.severity] }} />
                  <div className="risk-info">
                    <span className="risk-title">{risk.title}</span>
                    <span className="risk-desc">{risk.description}</span>
                  </div>
                  <span className={`review-status ${risk.isReviewed ? 'done' : 'pending'}`}>
                    {risk.isReviewed ? '已复核' : '待复核'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state-small">暂无风险事件</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderImportView = () => (
    <div className="view-content">
      <div className="view-header">
        <h2>数据导入</h2>
        <p className="view-subtitle">导入处方、药材批次、煎锅配置和取药时段</p>
      </div>

      {(importErrors.length > 0 || importWarnings.length > 0) && (
        <div className="import-results">
          {importErrors.length > 0 && (
            <div className="error-group">
              <h4>❌ 导入错误</h4>
              {importErrors.map((err, i) => (
                <div key={i} className="error-item">
                  <span className="error-file">{err.file}:</span>
                  <ul>
                    {err.errors.map((e, j) => <li key={j}>{e}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {importWarnings.length > 0 && (
            <div className="warning-group">
              <h4>⚠️ 导入警告</h4>
              {importWarnings.map((warn, i) => (
                <div key={i} className="warning-item">
                  <span className="warning-file">{warn.file}:</span>
                  <ul>
                    {warn.warnings.map((w, j) => <li key={j}>{w}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(importResults.prescriptions > 0 || importResults.batches > 0) && (
        <div className="import-success">
          <h4>✅ 导入成功</h4>
          <ul>
            {importResults.prescriptions > 0 && <li>处方: {importResults.prescriptions} 张</li>}
            {importResults.batches > 0 && <li>药材批次: {importResults.batches} 批</li>}
          </ul>
        </div>
      )}

      <div className="import-grid">
        <div className="import-card">
          <div className="import-icon">📋</div>
          <h3>处方数据</h3>
          <p className="import-desc">导入处方 CSV 文件，包含患者信息、药材清单等</p>
          <div className="import-stats">
            <span>当前: {prescriptions.length} 张处方</span>
          </div>
          <label className="btn btn-primary btn-full">
            选择 CSV 文件
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileImport(e, 'prescription')}
              disabled={isLoading}
              hidden
            />
          </label>
        </div>

        <div className="import-card">
          <div className="import-icon">🌿</div>
          <h3>药材批次</h3>
          <p className="import-desc">导入药材批次 JSON 文件，包含批号、有效期等</p>
          <div className="import-stats">
            <span>当前: {herbBatches.length} 批次</span>
          </div>
          <label className="btn btn-primary btn-full">
            选择 JSON 文件
            <input
              type="file"
              accept=".json"
              onChange={(e) => handleFileImport(e, 'batch')}
              disabled={isLoading}
              hidden
            />
          </label>
        </div>

        <div className="import-card">
          <div className="import-icon">🍳</div>
          <h3>煎锅配置</h3>
          <p className="import-desc">导入煎锅配置 CSV 文件，包含锅号、容量等</p>
          <div className="import-stats">
            <span>当前: {decoctionPots.length} 台煎锅</span>
          </div>
          <label className="btn btn-secondary btn-full">
            选择 CSV 文件
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileImport(e, 'pot')}
              disabled={isLoading}
              hidden
            />
          </label>
        </div>

        <div className="import-card">
          <div className="import-icon">⏰</div>
          <h3>取药时段</h3>
          <p className="import-desc">导入取药时段 CSV 文件，配置患者取药时间</p>
          <div className="import-stats">
            <span>当前: {timeSlots.length} 个时段</span>
          </div>
          <label className="btn btn-secondary btn-full">
            选择 CSV 文件
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileImport(e, 'slot')}
              disabled={isLoading}
              hidden
            />
          </label>
        </div>
      </div>
    </div>
  );

  const renderPrescriptionsView = () => (
    <div className="view-content">
      <div className="view-header">
        <h2>处方管理</h2>
        <p className="view-subtitle">查看和管理所有处方</p>
      </div>

      <div className="prescription-filters">
        <div className="filter-group">
          <label>状态筛选</label>
          <select className="form-select">
            <option value="">全部</option>
            <option value="pending">待处理</option>
            <option value="preparing">备药中</option>
            <option value="decocting">煎煮中</option>
            <option value="completed">已完成</option>
            <option value="picked_up">已取药</option>
          </select>
        </div>
        <div className="filter-group">
          <label>优先级</label>
          <select className="form-select">
            <option value="">全部</option>
            <option value="emergency">急诊</option>
            <option value="urgent">加急</option>
            <option value="normal">普通</option>
          </select>
        </div>
      </div>

      {selectedPrescription ? (
        <div className="detail-panel">
          <div className="detail-header">
            <button className="btn-back" onClick={() => setSelectedPrescription(null)}>← 返回列表</button>
            <div className="detail-actions">
              <button
                className="btn btn-primary"
                onClick={() => handleExportDecoctionHandover(selectedPrescription)}
              >
                📄 导出交接单
              </button>
            </div>
          </div>

          <div className="detail-content">
            <div className="detail-section">
              <h3>处方信息</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">处方号</span>
                  <span className="info-value">{selectedPrescription.prescriptionNo}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">患者姓名</span>
                  <span className="info-value">{selectedPrescription.patientName}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">性别/年龄</span>
                  <span className="info-value">
                    {selectedPrescription.patientGender === 'male' ? '男' : selectedPrescription.patientGender === 'female' ? '女' : '未知'}
                    {selectedPrescription.patientAge ? ` / ${selectedPrescription.patientAge}岁` : ''}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">科室</span>
                  <span className="info-value">{selectedPrescription.department || '-'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">医师</span>
                  <span className="info-value">{selectedPrescription.doctorName || '-'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">诊断</span>
                  <span className="info-value">{selectedPrescription.diagnosis || '-'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">开方日期</span>
                  <span className="info-value">{selectedPrescription.orderDate}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">取药日期</span>
                  <span className="info-value">{selectedPrescription.pickupDate}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">状态</span>
                  <span className={`status-badge ${selectedPrescription.status}`}>
                    {selectedPrescription.status === 'pending' ? '待处理' :
                     selectedPrescription.status === 'preparing' ? '备药中' :
                     selectedPrescription.status === 'decocting' ? '煎煮中' :
                     selectedPrescription.status === 'completed' ? '已完成' :
                     selectedPrescription.status === 'picked_up' ? '已取药' : '已取消'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">优先级</span>
                  <span className={`priority-badge ${selectedPrescription.priority}`}>
                    {selectedPrescription.priority === 'emergency' ? '急诊' :
                     selectedPrescription.priority === 'urgent' ? '加急' : '普通'}
                  </span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3>煎煮工艺</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">煎煮类型</span>
                  <span className="info-value">
                    {selectedPrescription.decoctionMethod.type === 'water' ? '水煎' :
                     selectedPrescription.decoctionMethod.type === 'wine' ? '酒煎' :
                     selectedPrescription.decoctionMethod.type === 'water_wine' ? '水酒共煎' : '其他'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">加水量</span>
                  <span className="info-value">{selectedPrescription.decoctionMethod.waterAmount || '遵医嘱'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">浸泡时间</span>
                  <span className="info-value">{selectedPrescription.decoctionMethod.soakingTime || 30} 分钟</span>
                </div>
                <div className="info-item">
                  <span className="info-label">头煎时间</span>
                  <span className="info-value">{selectedPrescription.decoctionMethod.firstDecoctionTime || 30} 分钟</span>
                </div>
                <div className="info-item">
                  <span className="info-label">二煎时间</span>
                  <span className="info-value">{selectedPrescription.decoctionMethod.secondDecoctionTime || 20} 分钟</span>
                </div>
                <div className="info-item">
                  <span className="info-label">火候</span>
                  <span className="info-value">
                    {selectedPrescription.decoctionMethod.fireType === 'strong' ? '武火' :
                     selectedPrescription.decoctionMethod.fireType === 'gentle' ? '文火' : '文武火交替'}
                  </span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3>药材清单 ({selectedPrescription.herbs.length} 味)</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>药材名称</th>
                    <th>剂量</th>
                    <th>特殊处理</th>
                    <th>批次</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPrescription.herbs.map((herb, index) => (
                    <tr key={index} className={herb.specialProcess !== 'normal' ? 'highlight-row' : ''}>
                      <td>{herb.herbName}</td>
                      <td>{herb.dosage} {herb.unit}</td>
                      <td>
                        {herb.specialProcess !== 'normal' && (
                          <span className={`process-badge ${herb.specialProcess}`}>
                            {SPECIAL_PROCESS_LABELS[herb.specialProcess]}
                          </span>
                        )}
                        {herb.specialProcess === 'normal' && '-'}
                      </td>
                      <td>{herb.batchId || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {riskEvents.filter(r => r.relatedPrescriptionId === selectedPrescription.id).length > 0 && (
              <div className="detail-section">
                <h3>⚠️ 相关风险</h3>
                <div className="risk-list">
                  {riskEvents
                    .filter(r => r.relatedPrescriptionId === selectedPrescription.id)
                    .map(risk => (
                      <div
                        key={risk.id}
                        className={`risk-item ${risk.isReviewed ? 'reviewed' : ''}`}
                        onClick={() => {
                          setSelectedRisk(risk);
                          setActiveView('risks');
                        }}
                      >
                        <div className="risk-severity-indicator" style={{ backgroundColor: SEVERITY_COLORS[risk.severity] }} />
                        <div className="risk-info">
                          <span className="risk-title">{risk.title}</span>
                          <span className="risk-desc">{risk.description}</span>
                        </div>
                        <span className={`review-status ${risk.isReviewed ? 'done' : 'pending'}`}>
                          {risk.isReviewed ? '已复核' : '待复核'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>处方号</th>
                <th>患者</th>
                <th>医师</th>
                <th>药材数</th>
                <th>剂数</th>
                <th>优先级</th>
                <th>状态</th>
                <th>开方日期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.length > 0 ? (
                prescriptions.map(p => (
                  <tr key={p.id} onClick={() => setSelectedPrescription(p)} className="clickable-row">
                    <td className="prescription-no-cell">
                      <span className="prescription-no">{p.prescriptionNo}</span>
                    </td>
                    <td>{p.patientName}</td>
                    <td>{p.doctorName || '-'}</td>
                    <td>{p.herbs.length} 味</td>
                    <td>{p.totalDoses} 剂</td>
                    <td>
                      <span className={`priority-badge ${p.priority}`}>
                        {p.priority === 'emergency' ? '急诊' : p.priority === 'urgent' ? '加急' : '普通'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${p.status}`}>
                        {p.status === 'pending' ? '待处理' :
                         p.status === 'preparing' ? '备药中' :
                         p.status === 'decocting' ? '煎煮中' :
                         p.status === 'completed' ? '已完成' :
                         p.status === 'picked_up' ? '已取药' : '已取消'}
                      </span>
                    </td>
                    <td>{p.orderDate}</td>
                    <td>
                      <button
                        className="btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportDecoctionHandover(p);
                        }}
                        title="导出交接单"
                      >
                        📄
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="empty-cell">
                    <div className="empty-state-table">
                      <span className="empty-icon">📋</span>
                      <p>暂无处方数据</p>
                      <button className="btn btn-primary" onClick={() => setActiveView('import')}>
                        导入处方
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderSchedulesView = () => {
    const today = new Date().toISOString().split('T')[0];
    const todaySchedules = schedules.filter(s => s.scheduleDate === today);

    return (
      <div className="view-content">
        <div className="view-header">
          <h2>锅次排程</h2>
          <p className="view-subtitle">按煎锅管理煎煮排程</p>
          <div className="header-actions">
            <button
              className="btn btn-success"
              onClick={() => handleExportBatchHandover()}
            >
              📄 导出批次交接单
            </button>
          </div>
        </div>

        <div className="pots-grid">
          {decoctionPots.map(pot => {
            const potSchedules = todaySchedules.filter(s => s.potNo === pot.potNo);
            const inUseSchedule = potSchedules.find(s => s.status === 'decocting');

            return (
              <div key={pot.id} className="pot-card">
                <div className="pot-header">
                  <div className="pot-info">
                    <span className="pot-no">{pot.potNo}</span>
                    <span className="pot-name">{pot.name}</span>
                  </div>
                  <span className={`pot-status ${inUseSchedule ? 'in_use' : 'idle'}`}>
                    {inUseSchedule ? '使用中' : '空闲'}
                  </span>
                </div>
                <div className="pot-details">
                  <span>容量: {pot.capacity}{pot.capacityUnit}</span>
                  <span>位置: {pot.location}</span>
                </div>

                {potSchedules.length > 0 ? (
                  <div className="pot-schedules">
                    <h4>今日排程</h4>
                    {potSchedules.map(schedule => {
                      const schedulePrescriptions = schedule.prescriptions
                        .map(id => prescriptions.find(p => p.id === id))
                        .filter(Boolean) as Prescription[];

                      return (
                        <div
                          key={schedule.id}
                          className={`schedule-item ${schedule.status}`}
                          onClick={() => setSelectedSchedule(schedule)}
                        >
                          <div className="schedule-header">
                            <span className="schedule-no">第 {schedule.batchNo} 锅</span>
                            <span className={`schedule-status ${schedule.status}`}>
                              {schedule.status === 'pending' ? '待排程' :
                               schedule.status === 'preparing' ? '备药中' :
                               schedule.status === 'decocting' ? '煎煮中' :
                               schedule.status === 'completed' ? '已完成' : '已复核'}
                            </span>
                          </div>
                          <div className="schedule-prescriptions">
                            {schedulePrescriptions.map(p => (
                              <span key={p.id} className="schedule-prescription">
                                {p.patientName}
                              </span>
                            ))}
                          </div>
                          {riskEvents.filter(r => r.relatedScheduleId === schedule.id && !r.isReviewed).length > 0 && (
                            <span className="schedule-risk-badge">
                              ⚠️ {riskEvents.filter(r => r.relatedScheduleId === schedule.id && !r.isReviewed).length} 风险
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state-small">今日无排程</div>
                )}
              </div>
            );
          })}
        </div>

        {selectedSchedule && (
          <div className="modal-overlay" onClick={() => setSelectedSchedule(null)}>
            <div className="modal schedule-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>排程详情</h3>
                <button className="btn-close" onClick={() => setSelectedSchedule(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">煎锅</span>
                    <span className="info-value">{selectedSchedule.potNo}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">锅次</span>
                    <span className="info-value">第 {selectedSchedule.batchNo} 锅</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">状态</span>
                    <span className={`status-badge ${selectedSchedule.status}`}>
                      {selectedSchedule.status === 'pending' ? '待排程' :
                       selectedSchedule.status === 'preparing' ? '备药中' :
                       selectedSchedule.status === 'decocting' ? '煎煮中' :
                       selectedSchedule.status === 'completed' ? '已完成' : '已复核'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">操作人</span>
                    <span className="info-value">{selectedSchedule.operatorName || '-'}</span>
                  </div>
                </div>

                <h4>关联处方 ({selectedSchedule.prescriptions.length} 张)</h4>
                <div className="prescription-list">
                  {selectedSchedule.prescriptions
                    .map(id => prescriptions.find(p => p.id === id))
                    .filter(Boolean)
                    .map(p => (
                      <div key={p!.id} className="prescription-item">
                        <span className="prescription-no">{p!.prescriptionNo}</span>
                        <span className="patient-name">{p!.patientName}</span>
                        <button
                          className="btn-link-small"
                          onClick={() => {
                            setSelectedPrescription(p!);
                            setSelectedSchedule(null);
                            setActiveView('prescriptions');
                          }}
                        >
                          查看详情
                        </button>
                      </div>
                    ))}
                </div>

                {riskEvents.filter(r => r.relatedScheduleId === selectedSchedule.id).length > 0 && (
                  <>
                    <h4>⚠️ 相关风险</h4>
                    <div className="risk-list">
                      {riskEvents
                        .filter(r => r.relatedScheduleId === selectedSchedule.id)
                        .map(risk => (
                          <div
                            key={risk.id}
                            className={`risk-item ${risk.isReviewed ? 'reviewed' : ''}`}
                          >
                            <div className="risk-severity-indicator" style={{ backgroundColor: SEVERITY_COLORS[risk.severity] }} />
                            <div className="risk-info">
                              <span className="risk-title">{risk.title}</span>
                              <span className="risk-desc">{risk.description}</span>
                            </div>
                            <span className={`review-status ${risk.isReviewed ? 'done' : 'pending'}`}>
                              {risk.isReviewed ? '已复核' : '待复核'}
                            </span>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    handleExportBatchHandover(selectedSchedule.potNo);
                    setSelectedSchedule(null);
                  }}
                >
                  📄 导出本锅交接单
                </button>
                <button className="btn btn-secondary" onClick={() => setSelectedSchedule(null)}>
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRisksView = () => (
    <div className="view-content">
      <div className="view-header">
        <h2>风险复核</h2>
        <p className="view-subtitle">检测和复核煎煮风险</p>
        <div className="header-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              const risks = detectAllRisks(prescriptions, herbBatches, schedules, timeSlots);
              saveRiskEvents(risks);
              setRiskEvents(risks);
              showNotification('风险检测已完成');
            }}
          >
            🔍 重新检测
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleExportRiskList}
          >
            📊 导出风险清单
          </button>
        </div>
      </div>

      <div className="risk-stats-bar">
        {(['critical', 'high', 'medium', 'low'] as const).map(severity => {
          const total = riskEvents.filter(r => r.severity === severity).length;
          const pending = riskEvents.filter(r => r.severity === severity && !r.isReviewed).length;
          return (
            <div key={severity} className={`risk-stat-item ${severity}`}>
              <span className="stat-label">{SEVERITY_LABELS[severity]}</span>
              <span className="stat-numbers">
                <span className="pending-count">{pending}</span>
                <span className="total-count">/ {total}</span>
              </span>
            </div>
          );
        })}
      </div>

      {selectedRisk ? (
        <div className="detail-panel">
          <div className="detail-header">
            <button className="btn-back" onClick={() => setSelectedRisk(null)}>← 返回列表</button>
          </div>

          <div className="detail-content">
            <div className="detail-section">
              <div className="risk-detail-header">
                <div
                  className="risk-detail-severity"
                  style={{ backgroundColor: SEVERITY_COLORS[selectedRisk.severity] }}
                >
                  {SEVERITY_LABELS[selectedRisk.severity]}
                </div>
                <div>
                  <h3 className="risk-detail-title">{selectedRisk.title}</h3>
                  <p className="risk-detail-type">{RISK_TYPE_LABELS[selectedRisk.type]}</p>
                </div>
                <span className={`review-status-badge ${selectedRisk.isReviewed ? 'done' : 'pending'}`}>
                  {selectedRisk.isReviewed ? '已复核' : '待复核'}
                </span>
              </div>

              <p className="risk-detail-desc">{selectedRisk.description}</p>
            </div>

            {selectedRisk.evidence.length > 0 && (
              <div className="detail-section">
                <h4>证据链</h4>
                <div className="evidence-list">
                  {selectedRisk.evidence.map((ev, index) => (
                    <div key={index} className="evidence-item">
                      <span className="evidence-index">{index + 1}</span>
                      <div className="evidence-content">
                        <span className="evidence-desc">{ev.description}</span>
                        {Object.keys(ev.details).length > 0 && (
                          <pre className="evidence-details">{JSON.stringify(ev.details, null, 2)}</pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedRisk.relatedPrescriptionId && (
              <div className="detail-section">
                <h4>相关处方</h4>
                {(() => {
                  const presc = prescriptions.find(p => p.id === selectedRisk.relatedPrescriptionId);
                  if (!presc) return <p className="text-muted">处方不存在</p>;
                  return (
                    <div className="related-prescription">
                      <span className="prescription-no">{presc.prescriptionNo}</span>
                      <span className="patient-name">{presc.patientName}</span>
                      <button
                        className="btn-link-small"
                        onClick={() => {
                          setSelectedPrescription(presc);
                          setActiveView('prescriptions');
                        }}
                      >
                        查看处方
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="detail-section">
              <h4>复核操作</h4>
              <div className="review-form">
                <div className="form-group">
                  <label>复核结果</label>
                  <div className="radio-group">
                    <label className={`radio-option ${selectedRisk.reviewResult === 'confirmed' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="reviewResult"
                        value="confirmed"
                        checked={selectedRisk.reviewResult === 'confirmed'}
                        onChange={(e) => {
                          const value = e.target.value as RiskEvent['reviewResult'];
                          setSelectedRisk(prev => prev ? { ...prev, reviewResult: value } : null);
                        }}
                      />
                      <span className="radio-label">✅ 确认风险</span>
                    </label>
                    <label className={`radio-option ${selectedRisk.reviewResult === 'false_positive' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="reviewResult"
                        value="false_positive"
                        checked={selectedRisk.reviewResult === 'false_positive'}
                        onChange={(e) => {
                          const value = e.target.value as RiskEvent['reviewResult'];
                          setSelectedRisk(prev => prev ? { ...prev, reviewResult: value } : null);
                        }}
                      />
                      <span className="radio-label">❌ 误报排除</span>
                    </label>
                    <label className={`radio-option ${selectedRisk.reviewResult === 'mitigated' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="reviewResult"
                        value="mitigated"
                        checked={selectedRisk.reviewResult === 'mitigated'}
                        onChange={(e) => {
                          const value = e.target.value as RiskEvent['reviewResult'];
                          setSelectedRisk(prev => prev ? { ...prev, reviewResult: value } : null);
                        }}
                      />
                      <span className="radio-label">🛡️ 风险已缓解</span>
                    </label>
                    <label className={`radio-option ${selectedRisk.reviewResult === 'escalated' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="reviewResult"
                        value="escalated"
                        checked={selectedRisk.reviewResult === 'escalated'}
                        onChange={(e) => {
                          const value = e.target.value as RiskEvent['reviewResult'];
                          setSelectedRisk(prev => prev ? { ...prev, reviewResult: value } : null);
                        }}
                      />
                      <span className="radio-label">🚨 需进一步处理</span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label>复核备注</label>
                  <textarea
                    className="form-textarea"
                    value={selectedRisk.reviewNotes || ''}
                    onChange={(e) => setSelectedRisk(prev => prev ? { ...prev, reviewNotes: e.target.value } : null)}
                    placeholder="请输入复核意见..."
                    rows={4}
                  />
                </div>

                <div className="form-actions">
                  {selectedRisk.isReviewed ? (
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        handleRiskReview(
                          selectedRisk.id,
                          true,
                          selectedRisk.reviewResult,
                          selectedRisk.reviewNotes
                        );
                      }}
                      disabled={!selectedRisk.reviewResult}
                    >
                      更新复核
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        handleRiskReview(
                          selectedRisk.id,
                          true,
                          selectedRisk.reviewResult,
                          selectedRisk.reviewNotes
                        );
                      }}
                      disabled={!selectedRisk.reviewResult}
                    >
                      确认复核
                    </button>
                  )}
                </div>
              </div>
            </div>

            {selectedRisk.isReviewed && (
              <div className="detail-section">
                <h4>复核记录</h4>
                <div className="review-info">
                  <div className="review-info-item">
                    <span className="review-info-label">复核人</span>
                    <span className="review-info-value">{selectedRisk.reviewedBy || '-'}</span>
                  </div>
                  <div className="review-info-item">
                    <span className="review-info-label">复核时间</span>
                    <span className="review-info-value">
                      {selectedRisk.reviewedAt ? new Date(selectedRisk.reviewedAt).toLocaleString('zh-CN') : '-'}
                    </span>
                  </div>
                  <div className="review-info-item">
                    <span className="review-info-label">复核结果</span>
                    <span className="review-info-value">
                      {selectedRisk.reviewResult === 'confirmed' ? '✅ 确认风险' :
                       selectedRisk.reviewResult === 'false_positive' ? '❌ 误报排除' :
                       selectedRisk.reviewResult === 'mitigated' ? '🛡️ 风险已缓解' : '🚨 需进一步处理'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>严重程度</th>
                <th>风险类型</th>
                <th>标题</th>
                <th>相关处方</th>
                <th>相关药材</th>
                <th>复核状态</th>
                <th>检测时间</th>
              </tr>
            </thead>
            <tbody>
              {riskEvents.length > 0 ? (
                riskEvents.map(risk => {
                  const relatedPresc = prescriptions.find(p => p.id === risk.relatedPrescriptionId);
                  return (
                    <tr
                      key={risk.id}
                      onClick={() => setSelectedRisk(risk)}
                      className={`clickable-row ${risk.isReviewed ? 'reviewed-row' : ''}`}
                    >
                      <td>
                        <span
                          className="severity-badge"
                          style={{ backgroundColor: SEVERITY_COLORS[risk.severity] }}
                        >
                          {SEVERITY_LABELS[risk.severity]}
                        </span>
                      </td>
                      <td>{RISK_TYPE_LABELS[risk.type]}</td>
                      <td className="risk-title-cell">{risk.title}</td>
                      <td>{relatedPresc ? `${relatedPresc.prescriptionNo} - ${relatedPresc.patientName}` : '-'}</td>
                      <td>{risk.relatedHerbName || '-'}</td>
                      <td>
                        <span className={`review-status ${risk.isReviewed ? 'done' : 'pending'}`}>
                          {risk.isReviewed ? '已复核' : '待复核'}
                        </span>
                      </td>
                      <td>{new Date(risk.createdAt).toLocaleString('zh-CN')}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    <div className="empty-state-table">
                      <span className="empty-icon">✅</span>
                      <p>暂无风险事件</p>
                      <button className="btn btn-primary" onClick={() => setActiveView('import')}>
                        导入数据后检测风险
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderExportView = () => (
    <div className="view-content">
      <div className="view-header">
        <h2>导出报表</h2>
        <p className="view-subtitle">导出交接单、风险清单和审计包</p>
      </div>

      <div className="export-grid">
        <div className="export-card">
          <div className="export-icon">📄</div>
          <h3>煎药交接单</h3>
          <p className="export-desc">导出单张处方的煎药交接单，包含药材清单、煎煮工艺、风险提示等</p>
          <div className="export-stats">
            <span>当前处方数: {prescriptions.length}</span>
          </div>
          <div className="export-actions">
            <select
              className="form-select"
              onChange={(e) => {
                const presc = prescriptions.find(p => p.id === e.target.value);
                if (presc) handleExportDecoctionHandover(presc);
              }}
              disabled={prescriptions.length === 0}
            >
              <option value="">选择处方...</option>
              {prescriptions.map(p => (
                <option key={p.id} value={p.id}>
                  {p.prescriptionNo} - {p.patientName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="export-card">
          <div className="export-icon">📋</div>
          <h3>批次交接单</h3>
          <p className="export-desc">导出今日所有排程的批次交接单，按煎锅分组展示</p>
          <div className="export-stats">
            <span>今日排程数: {schedules.filter(s => s.scheduleDate === new Date().toISOString().split('T')[0]).length}</span>
          </div>
          <div className="export-actions">
            <button
              className="btn btn-primary btn-full"
              onClick={() => handleExportBatchHandover()}
              disabled={schedules.length === 0}
            >
              导出全部批次
            </button>
          </div>
        </div>

        <div className="export-card">
          <div className="export-icon">📊</div>
          <h3>风险清单</h3>
          <p className="export-desc">导出所有风险事件为 CSV 格式，方便查看和统计</p>
          <div className="export-stats">
            <span>风险总数: {riskEvents.length} | 待复核: {riskEvents.filter(r => !r.isReviewed).length}</span>
          </div>
          <div className="export-actions">
            <button
              className="btn btn-primary btn-full"
              onClick={handleExportRiskList}
              disabled={riskEvents.length === 0}
            >
              导出风险清单
            </button>
          </div>
        </div>

        <div className="export-card">
          <div className="export-icon">🔒</div>
          <h3>审计包</h3>
          <p className="export-desc">导出完整的审计数据包，包含所有处方、批次、排程、风险和复核记录</p>
          <div className="export-stats">
            <span>审计记录数: {auditTrails.length}</span>
          </div>
          <div className="export-actions">
            <button
              className="btn btn-secondary btn-full"
              onClick={handleExportAudit}
            >
              导出审计包 (JSON)
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettingsView = () => (
    <div className="view-content">
      <div className="view-header">
        <h2>设置</h2>
        <p className="view-subtitle">系统设置和数据管理</p>
      </div>

      <div className="settings-sections">
        <div className="settings-panel">
          <h3>当前会话</h3>
          {currentSession ? (
            <div className="session-info-card">
              <div className="session-info-row">
                <span className="session-label">操作人员</span>
                <span className="session-value">{currentSession.operatorName}</span>
              </div>
              <div className="session-info-row">
                <span className="session-label">开始时间</span>
                <span className="session-value">{new Date(currentSession.startTime).toLocaleString('zh-CN')}</span>
              </div>
              <div className="session-info-row">
                <span className="session-label">工作日期</span>
                <span className="session-value">{currentSession.date}</span>
              </div>
              <div className="session-info-row">
                <span className="session-label">今日统计</span>
                <span className="session-value">
                  导入处方 {currentSession.prescriptionsImported} | 导入批次 {currentSession.batchesImported} | 
                  创建排程 {currentSession.schedulesCreated} | 复核风险 {currentSession.risksReviewed}
                </span>
              </div>
              <button className="btn btn-danger" onClick={handleEndSession}>
                结束会话
              </button>
            </div>
          ) : (
            <p className="text-muted">未开始工作会话</p>
          )}
        </div>

        <div className="settings-panel">
          <h3>煎锅配置</h3>
          <div className="pots-list">
            {decoctionPots.map(pot => (
              <div key={pot.id} className="pot-item">
                <span className="pot-no">{pot.potNo}</span>
                <span className="pot-name">{pot.name}</span>
                <span className="pot-capacity">{pot.capacity}{pot.capacityUnit}</span>
                <span className={`pot-status-small ${pot.status}`}>
                  {pot.status === 'idle' ? '空闲' : pot.status === 'in_use' ? '使用中' : pot.status === 'maintenance' ? '维护中' : '禁用'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-panel">
          <h3>数据管理</h3>
          <div className="data-management">
            <div className="data-stats">
              <div className="data-stat-item">
                <span className="data-count">{prescriptions.length}</span>
                <span className="data-label">处方</span>
              </div>
              <div className="data-stat-item">
                <span className="data-count">{herbBatches.length}</span>
                <span className="data-label">批次</span>
              </div>
              <div className="data-stat-item">
                <span className="data-count">{riskEvents.length}</span>
                <span className="data-label">风险</span>
              </div>
              <div className="data-stat-item">
                <span className="data-count">{auditTrails.length}</span>
                <span className="data-label">审计</span>
              </div>
            </div>
            <div className="data-actions">
              <button
                className="btn btn-secondary"
                onClick={handleExportAllData}
              >
                📤 导出数据备份
              </button>
              <label className="btn btn-secondary">
                📥 导入数据备份
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportDataFile}
                  disabled={isLoading}
                  hidden
                  ref={fileInputRef}
                />
              </label>
              <button
                className="btn btn-danger"
                onClick={handleClearAllData}
              >
                🗑️ 清空所有数据
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return renderDashboard();
      case 'import':
        return renderImportView();
      case 'prescriptions':
        return renderPrescriptionsView();
      case 'schedules':
        return renderSchedulesView();
      case 'risks':
        return renderRisksView();
      case 'export':
        return renderExportView();
      case 'settings':
        return renderSettingsView();
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="app-container">
      {showSessionModal && renderSessionModal()}
      
      <div className="main-layout">
        {renderNav()}
        
        <main className="main-content">
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}
          
          {notification && (
            <div className="notification-banner">
              <span>{notification}</span>
            </div>
          )}
          
          {renderActiveView()}
        </main>
      </div>
      
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
}

export default App;