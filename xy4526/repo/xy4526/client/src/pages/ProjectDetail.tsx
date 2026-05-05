import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { Project, CalculationResult, AbnormalData, AdjustmentSuggestion } from '../types';

type TabType = 'overview' | 'data' | 'valves' | 'abnormal' | 'suggestions' | 'steps' | 'notes';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [calculating, setCalculating] = useState(false);
  const [lastResult, setLastResult] = useState<CalculationResult | null>(null);
  const [userNotes, setUserNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const [fileInput, setFileInput] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; warnings?: string[] } | null>(null);

  const loadProject = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getProject(id);
      setProject(data);
      setLastResult(data.lastCalculationResult || null);
      setUserNotes(data.userNotes || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleCalculate = async () => {
    if (!id) return;

    try {
      setCalculating(true);
      setError(null);
      const result = await apiService.calculate(id);
      setLastResult(result);
      if (project) {
        setProject({ ...project, lastCalculationResult: result });
      }
      setActiveTab('suggestions');
    } catch (err) {
      setError(err instanceof Error ? err.message : '计算失败');
    } finally {
      setCalculating(false);
    }
  };

  const handleExportMarkdown = async () => {
    if (!id) return;
    try {
      const blob = await apiService.exportMarkdown(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `调平建议_${project?.name || '项目'}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    }
  };

  const handleExportJSON = async () => {
    if (!id) return;
    try {
      const blob = await apiService.exportJSON(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `计算明细_${project?.name || '项目'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileInput(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!fileInput || !id) return;

    try {
      setImporting(true);
      setError(null);
      const result = await apiService.importData(fileInput, id);
      setImportResult({
        success: true,
        message: result.message || '导入成功',
        warnings: result.warnings,
      });
      setFileInput(null);
      loadProject();
    } catch (err) {
      setImportResult({
        success: false,
        message: err instanceof Error ? err.message : '导入失败',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!id) return;

    try {
      setSavingNotes(true);
      await apiService.saveUserNotes(id, userNotes);
      if (project) {
        setProject({ ...project, userNotes });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存备注失败');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!id || !window.confirm('确定要删除此项目吗？此操作不可撤销。')) return;

    try {
      await apiService.deleteProject(id);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除项目失败');
    }
  };

  const handleUpdateValve = async (valveId: string, opening: number) => {
    if (!id) return;

    try {
      await apiService.updateValve(id, valveId, opening);
      loadProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新阀门失败');
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <span className="badge badge-high">🔴 高</span>;
      case 'medium':
        return <span className="badge badge-medium">🟡 中</span>;
      case 'low':
        return <span className="badge badge-low">🟢 低</span>;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="badge badge-high">高优先级</span>;
      case 'medium':
        return <span className="badge badge-medium">中优先级</span>;
      case 'low':
        return <span className="badge badge-low">低优先级</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <p>加载中...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="alert alert-danger">
        项目不存在
        <Link to="/" style={{ marginLeft: '1rem' }}>返回项目列表</Link>
      </div>
    );
  }

  const hasCalculation = !!lastResult;

  return (
    <div>
      <Link to="/" className="back-link">
        ← 返回项目列表
      </Link>

      <div className="project-header">
        <div className="project-header-info">
          <h2>{project.name}</h2>
          {project.description && <p>{project.description}</p>}
        </div>
        <div className="btn-group">
          {hasCalculation && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleExportMarkdown}
              >
                📄 导出调平建议
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleExportJSON}
              >
                📊 导出计算明细
              </button>
            </>
          )}
          <button
            className="btn btn-success btn-sm"
            onClick={handleCalculate}
            disabled={calculating || project.nodes.length === 0}
          >
            {calculating ? '⏳ 计算中...' : '🧮 水力平衡计算'}
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleDeleteProject}
          >
            🗑️ 删除
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
          <button
            className="btn btn-sm btn-secondary"
            style={{ marginLeft: '1rem' }}
            onClick={() => setError(null)}
          >
            关闭
          </button>
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📈 概览
        </button>
        <button
          className={`tab ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          📥 数据导入
        </button>
        <button
          className={`tab ${activeTab === 'valves' ? 'active' : ''}`}
          onClick={() => setActiveTab('valves')}
        >
          🚰 阀门调节
        </button>
        {hasCalculation && (
          <>
            <button
              className={`tab ${activeTab === 'abnormal' ? 'active' : ''}`}
              onClick={() => setActiveTab('abnormal')}
            >
              ⚠️ 异常数据 ({lastResult?.abnormalData.length || 0})
            </button>
            <button
              className={`tab ${activeTab === 'suggestions' ? 'active' : ''}`}
              onClick={() => setActiveTab('suggestions')}
            >
              💡 调整建议 ({lastResult?.suggestions.length || 0})
            </button>
            <button
              className={`tab ${activeTab === 'steps' ? 'active' : ''}`}
              onClick={() => setActiveTab('steps')}
            >
              📝 计算过程
            </button>
          </>
        )}
        <button
          className={`tab ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          📋 人工备注
        </button>
      </div>

      {activeTab === 'overview' && (
        <div>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-card-label">节点数量</div>
              <div className="stat-card-value">{project.nodes.length}</div>
              <div className="stat-card-unit">个</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">管道数量</div>
              <div className="stat-card-value">{project.pipes.length}</div>
              <div className="stat-card-unit">条</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">阀门数量</div>
              <div className="stat-card-value">{project.valves.length}</div>
              <div className="stat-card-unit">个</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">温度数据</div>
              <div className="stat-card-value">{project.temperatureData.length}</div>
              <div className="stat-card-unit">组</div>
            </div>
          </div>

          {lastResult && (
            <div className="card">
              <div className="card-header">
                <h3>计算结果概览</h3>
              </div>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-card-label">总流量</div>
                  <div className="stat-card-value">{lastResult.totalFlowRate.toFixed(2)}</div>
                  <div className="stat-card-unit">m³/h</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">系统总压降</div>
                  <div className="stat-card-value">{lastResult.systemPressureDrop.toFixed(2)}</div>
                  <div className="stat-card-unit">kPa</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">工作点流量</div>
                  <div className="stat-card-value">{lastResult.operatingPoint.flowRate.toFixed(2)}</div>
                  <div className="stat-card-unit">m³/h</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">工作点扬程</div>
                  <div className="stat-card-value">{lastResult.operatingPoint.head.toFixed(2)}</div>
                  <div className="stat-card-unit">m</div>
                </div>
              </div>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-card-label">异常数据项</div>
                  <div className="stat-card-value">{lastResult.abnormalData.length}</div>
                  <div className="stat-card-unit">
                    {lastResult.abnormalData.filter(a => a.severity === 'high').length > 0 && (
                      <span className="badge badge-high" style={{ marginLeft: '0.5rem' }}>
                        含高优先级
                      </span>
                    )}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">调整建议</div>
                  <div className="stat-card-value">{lastResult.suggestions.length}</div>
                  <div className="stat-card-unit">项</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">计算时间</div>
                  <div className="stat-card-value" style={{ fontSize: '0.9rem' }}>
                    {new Date(lastResult.timestamp).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {project.nodes.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3>节点列表</h3>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>类型</th>
                      <th>供水温度</th>
                      <th>回水温度</th>
                      <th>温差</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.nodes.map((node) => {
                      const temp = project.temperatureData.find(t => t.nodeId === node.id);
                      const deltaT = temp ? temp.supplyTemp - temp.returnTemp : null;
                      return (
                        <tr key={node.id}>
                          <td>{node.name}</td>
                          <td>
                            <span className="badge badge-success">
                              {node.type === 'building' ? '楼栋' : node.type === 'unit' ? '单元' : '分支'}
                            </span>
                          </td>
                          <td>{temp ? `${temp.supplyTemp}°C` : '-'}</td>
                          <td>{temp ? `${temp.returnTemp}°C` : '-'}</td>
                          <td>
                            {deltaT !== null ? (
                              <span className={deltaT < 5 ? 'badge badge-warning' : deltaT > 25 ? 'badge badge-danger' : 'badge badge-success'}>
                                {deltaT.toFixed(1)}°C
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'data' && (
        <div className="card">
          <div className="card-header">
            <h3>数据导入</h3>
          </div>

          {importResult && (
            <div className={`alert ${importResult.success ? 'alert-success' : 'alert-danger'}`}>
              {importResult.message}
              {importResult.warnings && importResult.warnings.length > 0 && (
                <div style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
                  {importResult.warnings.map((w, i) => (
                    <div key={i}>⚠️ {w}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="alert alert-info">
            <p>
              <strong>支持的文件格式：</strong>JSON (.json) 或 Excel (.xlsx, .xls)
            </p>
            <p>
              <strong>数据要求：</strong>
            </p>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
              <li><strong>节点数据：</strong>id, name, type (building/unit/branch)</li>
              <li><strong>管道数据：</strong>id, name, fromNodeId, toNodeId, diameter (mm), length (m)</li>
              <li><strong>阀门数据：</strong>id, name, pipeId, opening (0-100), kvValue</li>
              <li><strong>水泵曲线：</strong>流量-扬程点数据</li>
              <li><strong>温度数据：</strong>nodeId, supplyTemp, returnTemp</li>
            </ul>
          </div>

          <div className="form-group">
            <label>选择文件</label>
            <input
              type="file"
              accept=".json,.xlsx,.xls"
              onChange={handleFileChange}
              style={{ padding: '0.5rem 0' }}
            />
            {fileInput && (
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--bg-color)', borderRadius: '0.5rem' }}>
                <strong>已选择：</strong>{fileInput.name} ({(fileInput.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>

          <div className="btn-group">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const a = document.createElement('a');
                a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
                  nodes: project.nodes,
                  pipes: project.pipes,
                  valves: project.valves,
                  pumpCurve: project.pumpCurve,
                  temperatureData: project.temperatureData,
                }, null, 2));
                a.download = '当前数据.json';
                a.click();
              }}
            >
              📤 导出当前数据
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleImport}
              disabled={!fileInput || importing}
            >
              {importing ? '导入中...' : '📥 导入数据'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'valves' && (
        <div className="card">
          <div className="card-header">
            <h3>阀门调节</h3>
          </div>

          {project.valves.length === 0 ? (
            <div className="empty-state">
              <p>暂无阀门数据，请先导入数据</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>阀门名称</th>
                    <th>所属管道</th>
                    <th>Kv值</th>
                    <th>当前开度</th>
                    <th>调节</th>
                    <th>备注</th>
                    {lastResult && <th>状态</th>}
                  </tr>
                </thead>
                <tbody>
                  {project.valves.map((valve) => {
                    const pipe = project.pipes.find(p => p.id === valve.pipeId);
                    const valveResult = lastResult?.valveResults.find(v => v.valveId === valve.id);
                    return (
                      <tr key={valve.id}>
                        <td><strong>{valve.name}</strong></td>
                        <td>{pipe?.name || valve.pipeId}</td>
                        <td>{valve.kvValue}</td>
                        <td>
                          <span className={`badge ${valve.opening < 15 || valve.opening > 85 ? 'badge-warning' : 'badge-success'}`}>
                            {valve.opening}%
                          </span>
                        </td>
                        <td style={{ minWidth: '200px' }}>
                          <div className="slider-container">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={valve.opening}
                              onChange={(e) => handleUpdateValve(valve.id, Number(e.target.value))}
                            />
                            <span className="slider-value">{valve.opening}%</span>
                          </div>
                        </td>
                        <td>{valve.notes || '-'}</td>
                        {lastResult && (
                          <td>
                            {valveResult ? (
                              valveResult.isBalanced ? (
                                <span className="badge badge-success">✅ 平衡</span>
                              ) : (
                                <span className="badge badge-warning">⚠️ 需调整</span>
                              )
                            ) : '-'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'abnormal' && lastResult && (
        <div className="card">
          <div className="card-header">
            <h3>异常数据检测</h3>
          </div>

          {lastResult.abnormalData.length === 0 ? (
            <div className="empty-state">
              <p>✅ 未检测到异常数据</p>
            </div>
          ) : (
            <div>
              {lastResult.abnormalData
                .sort((a, b) => {
                  const order = { high: 0, medium: 1, low: 2 };
                  return order[a.severity] - order[b.severity];
                })
                .map((abnormal, index) => (
                  <div key={index} className={`alert ${
                    abnormal.severity === 'high' ? 'alert-danger' :
                    abnormal.severity === 'medium' ? 'alert-warning' : 'alert-info'
                  }`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <strong style={{ fontSize: '1rem' }}>
                          {abnormal.type === 'valve' ? '🚰 阀门异常' :
                           abnormal.type === 'temperature' ? '🌡️ 温度异常' :
                           abnormal.type === 'pressure' ? '💨 压力异常' : '💧 流量异常'}
                        </strong>
                        <div style={{ marginTop: '0.5rem' }}>
                          <strong>位置：</strong>{abnormal.location}
                        </div>
                        <div style={{ marginTop: '0.25rem' }}>
                          <strong>当前值：</strong>{abnormal.currentValue}
                          <span style={{ marginLeft: '1rem' }}>
                            <strong>期望范围：</strong>{abnormal.expectedRange.min} ~ {abnormal.expectedRange.max}
                          </span>
                        </div>
                        <div style={{ marginTop: '0.5rem', color: 'var(--text-color)' }}>
                          💡 {abnormal.suggestion}
                        </div>
                      </div>
                      <div>{getSeverityBadge(abnormal.severity)}</div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'suggestions' && lastResult && (
        <div className="card">
          <div className="card-header">
            <h3>阀门调整建议</h3>
          </div>

          {lastResult.suggestions.length === 0 ? (
            <div className="empty-state">
              <p>✅ 系统水力平衡状态良好，无需调整</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>优先级</th>
                    <th>阀门名称</th>
                    <th>当前开度</th>
                    <th>建议开度</th>
                    <th>调整量</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {lastResult.suggestions.map((suggestion, index) => (
                    <tr key={index}>
                      <td>{getPriorityBadge(suggestion.priority)}</td>
                      <td><strong>{suggestion.valveName}</strong></td>
                      <td>{suggestion.currentOpening}%</td>
                      <td>
                        <span className="badge badge-success">
                          {suggestion.suggestedOpening}%
                        </span>
                      </td>
                      <td>
                        <span className={suggestion.adjustmentAmount > 0 ? 'badge badge-success' : 'badge badge-warning'}>
                          {suggestion.adjustmentAmount > 0 ? '↑' : '↓'}{Math.abs(suggestion.adjustmentAmount)}%
                        </span>
                      </td>
                      <td style={{ maxWidth: '400px' }}>{suggestion.reasoning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'steps' && lastResult && (
        <div className="card">
          <div className="card-header">
            <h3>计算过程明细</h3>
          </div>

          <div className="alert alert-info">
            以下是本次水力平衡计算的详细步骤记录，包含输入参数、计算公式和输出结果。
          </div>

          {lastResult.steps.map((step) => (
            <div key={step.step} className="step-details">
              <h4>
                步骤 {step.step}：{step.description}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                <div>
                  <strong>输入参数：</strong>
                  <ul style={{ marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
                    {Object.entries(step.inputs).map(([key, value]) => (
                      <li key={key}><code>{key}</code> = {value}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>输出结果：</strong>
                  <ul style={{ marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
                    {Object.entries(step.outputs).map(([key, value]) => (
                      <li key={key}><code>{key}</code> = {value}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <strong>计算公式：</strong>
                <pre>{step.formula}</pre>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="card">
          <div className="card-header">
            <h3>人工修正意见</h3>
          </div>

          <div className="alert alert-info">
            在此记录检修过程中的人工修正意见、实际操作记录和其他备注信息。
            这些内容将随调平建议报告一起导出。
          </div>

          <div className="form-group">
            <label>备注内容</label>
            <textarea
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="在此输入人工修正意见、操作记录等..."
              rows={10}
            />
          </div>

          <div className="btn-group">
            <button
              className="btn btn-primary"
              onClick={handleSaveNotes}
              disabled={savingNotes}
            >
              {savingNotes ? '保存中...' : '💾 保存备注'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
