import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { useStore } from '../store';

const steps = [
  { id: 'geojson', label: '场馆 GeoJSON', description: '导入场馆房间布局' },
  { id: 'csv', label: '风机/门窗 CSV', description: '导入风机和门窗状态' },
  { id: 'json', label: '传感器 JSON', description: '导入烟雾浓度数据' },
  { id: 'form', label: '基本信息', description: '设置训练场次信息' },
];

function ImportWizard() {
  const navigate = useNavigate();
  const { 
    geojsonData, setGeojsonData,
    fanWindowData, setFanWindowData,
    sensorData, setSensorData,
    clearImportData,
    createSession,
    fetchSessions
  } = useStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [geojsonFile, setGeojsonFile] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [jsonFile, setJsonFile] = useState(null);
  const [sessionName, setSessionName] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [newSessionId, setNewSessionId] = useState(null);

  const geojsonInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const jsonInputRef = useRef(null);

  useEffect(() => {
    clearImportData();
  }, []);

  const handleFileUpload = (file, type) => {
    if (!file) return;

    const reader = new FileReader();

    switch (type) {
      case 'geojson':
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            setGeojsonData(data);
            setGeojsonFile(file);
          } catch (err) {
            alert('GeoJSON 文件格式错误');
          }
        };
        reader.readAsText(file);
        break;

      case 'csv':
        reader.onload = (e) => {
          Papa.parse(e.target.result, {
            header: true,
            complete: (results) => {
              const data = parseFanWindowData(results.data);
              setFanWindowData(data);
              setCsvFile(file);
            },
            error: (err) => {
              alert('CSV 文件解析错误: ' + err.message);
            }
          });
        };
        reader.readAsText(file);
        break;

      case 'json':
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            setSensorData(data);
            setJsonFile(file);
          } catch (err) {
            alert('JSON 文件格式错误');
          }
        };
        reader.readAsText(file);
        break;
    }
  };

  const parseFanWindowData = (csvData) => {
    const fans = [];
    const windows = [];

    csvData.forEach((row) => {
      const type = row.type?.toLowerCase();
      
      if (type === 'fan' || type === '风机') {
        fans.push({
          id: row.id,
          name: row.name,
          x: parseFloat(row.x) || 0,
          y: parseFloat(row.y) || 0,
          status: row.status?.toLowerCase() || 'on',
          mode: row.mode?.toLowerCase() || 'exhaust',
          direction: row.direction?.toLowerCase() || 'out',
          expectedDirection: row.expectedDirection?.toLowerCase(),
          required: row.required === 'true' || row.required === '是'
        });
      } else if (type === 'window' || type === 'door' || type === '门窗' || type === '门' || type === '窗') {
        windows.push({
          id: row.id,
          name: row.name,
          x: parseFloat(row.x) || 0,
          y: parseFloat(row.y) || 0,
          status: row.status?.toLowerCase() || 'closed',
          width: parseFloat(row.width) || 1
        });
      }
    });

    return { fans, windows };
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0], type);
    }
  };

  const handleCreateSession = async () => {
    if (!sessionName.trim()) {
      alert('请输入训练场次名称');
      return;
    }

    setIsCreating(true);

    try {
      const result = await createSession({
        name: sessionName,
        description: sessionDescription,
        geojson: geojsonData,
        fanWindowData: fanWindowData,
        sensorData: sensorData
      });

      if (result && result.sessionId) {
        setNewSessionId(result.sessionId);
        setCreateSuccess(true);
        await fetchSessions();
      } else {
        throw new Error('创建失败');
      }
    } catch (error) {
      alert('创建训练场次失败: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return !!geojsonData;
      case 1: return true;
      case 2: return !!sensorData;
      case 3: return !!sessionName.trim();
      default: return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="import-content">
            <h3>导入场馆房间 GeoJSON</h3>
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
              上传包含场馆房间布局的 GeoJSON 文件。文件应包含房间、出口、障碍物等地理信息。
            </p>
            
            <div
              className={`upload-area ${geojsonData ? 'has-file' : ''}`}
              onClick={() => geojsonInputRef.current.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'geojson')}
            >
              <input
                ref={geojsonInputRef}
                type="file"
                accept=".geojson,.json"
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e.target.files[0], 'geojson')}
              />
              <div className="upload-icon">🗺️</div>
              <h3>{geojsonData ? '文件已选择' : '点击或拖拽上传 GeoJSON 文件'}</h3>
              <p>{geojsonData ? geojsonFile?.name : '支持 .geojson 和 .json 格式'}</p>
              {geojsonData && (
                <div className="file-preview">
                  <div className="file-preview-name">{geojsonFile?.name}</div>
                  <div className="file-preview-size">
                    包含 {geojsonData.features?.length || 0} 个地理要素
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="import-content">
            <h3>导入风机/门窗状态 CSV</h3>
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
              上传包含风机和门窗状态的 CSV 文件。此步骤为可选，如无数据可跳过。
            </p>
            
            <div
              className={`upload-area ${fanWindowData ? 'has-file' : ''}`}
              onClick={() => csvInputRef.current.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'csv')}
            >
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e.target.files[0], 'csv')}
              />
              <div className="upload-icon">📊</div>
              <h3>{fanWindowData ? '文件已选择' : '点击或拖拽上传 CSV 文件'}</h3>
              <p>{fanWindowData ? csvFile?.name : '支持 .csv 格式 (可选)'}</p>
              {fanWindowData && (
                <div className="file-preview">
                  <div className="file-preview-name">{csvFile?.name}</div>
                  <div className="file-preview-size">
                    风机: {fanWindowData.fans?.length || 0} 个 | 门窗: {fanWindowData.windows?.length || 0} 个
                  </div>
                </div>
              )}
            </div>

            {!fanWindowData && (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                💡 如无风机/门窗数据，可直接点击"下一步"跳过
              </p>
            )}
          </div>
        );

      case 2:
        return (
          <div className="import-content">
            <h3>导入传感器烟雾浓度 JSON</h3>
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
              上传包含传感器点位和烟雾浓度读数的 JSON 文件。
            </p>
            
            <div
              className={`upload-area ${sensorData ? 'has-file' : ''}`}
              onClick={() => jsonInputRef.current.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'json')}
            >
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e.target.files[0], 'json')}
              />
              <div className="upload-icon">📡</div>
              <h3>{sensorData ? '文件已选择' : '点击或拖拽上传 JSON 文件'}</h3>
              <p>{sensorData ? jsonFile?.name : '支持 .json 格式'}</p>
              {sensorData && (
                <div className="file-preview">
                  <div className="file-preview-name">{jsonFile?.name}</div>
                  <div className="file-preview-size">
                    传感器: {sensorData.sensors?.length || 0} 个 | 
                    读数: {sensorData.readings?.length || 0} 组
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="import-content">
            <h3>设置训练场次基本信息</h3>
            
            <div className="import-form">
              <div className="form-group">
                <label>训练场次名称 *</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="例如：2024年第一季度消防训练"
                />
              </div>
              
              <div className="form-group">
                <label>训练描述 (可选)</label>
                <textarea
                  value={sessionDescription}
                  onChange={(e) => setSessionDescription(e.target.value)}
                  placeholder="描述本次训练的目的、场景设置等信息..."
                />
              </div>

              <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                <h4 style={{ marginBottom: 12 }}>📋 导入数据概览</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div style={{ textAlign: 'center', padding: 12, background: 'var(--bg-primary)', borderRadius: 6 }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>🗺️</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>场馆数据</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                      {geojsonData?.features?.length || 0} 个要素
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: 'var(--bg-primary)', borderRadius: 6 }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>🔧</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>风机/门窗</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                      {fanWindowData ? `${fanWindowData.fans?.length || 0} 风机 / ${fanWindowData.windows?.length || 0} 门窗` : '无数据'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: 'var(--bg-primary)', borderRadius: 6 }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📡</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>传感器</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                      {sensorData?.sensors?.length || 0} 个点位
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (createSuccess) {
    return (
      <div className="import-wizard">
        <div className="import-success">
          <div className="import-success-icon">✅</div>
          <h3>训练场次创建成功！</h3>
          <p>系统已自动识别潜在问题并进行风险评估。</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/')}>
              返回列表
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/session/${newSessionId}`)}
            >
              查看训练详情
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isCreating) {
    return (
      <div className="import-wizard">
        <div className="import-progress">
          <div className="import-progress-spinner"></div>
          <h3>正在创建训练场次...</h3>
          <p className="import-progress-text">系统正在分析数据并识别潜在问题</p>
        </div>
      </div>
    );
  }

  return (
    <div className="import-wizard">
      <div className="page-header">
        <h2>📥 导入数据</h2>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          取消
        </button>
      </div>

      <div className="import-steps">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`import-step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
            onClick={() => index < currentStep && setCurrentStep(index)}
            style={{ cursor: index < currentStep ? 'pointer' : 'default' }}
          >
            <div className="step-number">
              {index < currentStep ? '✓' : index + 1}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{step.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{step.description}</div>
            </div>
          </div>
        ))}
      </div>

      {renderStepContent()}

      <div className="import-actions">
        {currentStep > 0 && (
          <button
            className="btn btn-secondary"
            onClick={() => setCurrentStep(currentStep - 1)}
          >
            上一步
          </button>
        )}
        
        {currentStep < steps.length - 1 ? (
          <button
            className="btn btn-primary"
            onClick={() => setCurrentStep(currentStep + 1)}
            disabled={!canProceed()}
            style={{ opacity: canProceed() ? 1 : 0.5, cursor: canProceed() ? 'pointer' : 'not-allowed' }}
          >
            下一步
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={handleCreateSession}
            disabled={!canProceed()}
            style={{ opacity: canProceed() ? 1 : 0.5, cursor: canProceed() ? 'pointer' : 'not-allowed' }}
          >
            创建训练场次
          </button>
        )}
      </div>
    </div>
  );
}

export default ImportWizard;
