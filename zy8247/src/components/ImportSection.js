import React from 'react';

const ImportSection = ({
  onImportCases,
  onImportVitals,
  onImportMedications,
  onImportRules,
  casesCount,
  vitalsCount,
  medicationsCount,
  hasRules
}) => {
  return (
    <div className="import-section">
      <h2>数据导入</h2>
      <p style={{ marginBottom: '1rem', color: '#7f8c8d', fontSize: '0.9rem' }}>
        请按顺序导入以下数据文件，或点击顶部"加载示例数据"按钮快速体验。
      </p>
      
      <div className="import-options">
        <div className="import-btn-group">
          <label>病例信息 (CSV)</label>
          <div style={{ position: 'relative' }}>
            <input
              type="file"
              accept=".csv"
              onChange={onImportCases}
              style={{
                position: 'absolute',
                opacity: 0,
                width: '100%',
                height: '100%',
                cursor: 'pointer'
              }}
            />
            <button 
              className={`btn ${casesCount > 0 ? 'btn-success' : 'btn-primary'}`}
              style={{ pointerEvents: 'none' }}
            >
              导入病例
              {casesCount > 0 && (
                <span className="status-indicator">
                  <span className="status-dot green"></span>
                  {casesCount} 条
                </span>
              )}
            </button>
          </div>
        </div>
        
        <div className="import-btn-group">
          <label>分钟生命体征 (JSONL)</label>
          <div style={{ position: 'relative' }}>
            <input
              type="file"
              accept=".jsonl,.json"
              onChange={onImportVitals}
              style={{
                position: 'absolute',
                opacity: 0,
                width: '100%',
                height: '100%',
                cursor: 'pointer'
              }}
            />
            <button 
              className={`btn ${vitalsCount > 0 ? 'btn-success' : 'btn-primary'}`}
              style={{ pointerEvents: 'none' }}
            >
              导入体征
              {vitalsCount > 0 && (
                <span className="status-indicator">
                  <span className="status-dot green"></span>
                  {vitalsCount} 条
                </span>
              )}
            </button>
          </div>
        </div>
        
        <div className="import-btn-group">
          <label>用药扫描 (CSV)</label>
          <div style={{ position: 'relative' }}>
            <input
              type="file"
              accept=".csv"
              onChange={onImportMedications}
              style={{
                position: 'absolute',
                opacity: 0,
                width: '100%',
                height: '100%',
                cursor: 'pointer'
              }}
            />
            <button 
              className={`btn ${medicationsCount > 0 ? 'btn-success' : 'btn-primary'}`}
              style={{ pointerEvents: 'none' }}
            >
              导入用药
              {medicationsCount > 0 && (
                <span className="status-indicator">
                  <span className="status-dot green"></span>
                  {medicationsCount} 条
                </span>
              )}
            </button>
          </div>
        </div>
        
        <div className="import-btn-group">
          <label>麻醉规则 (YAML)</label>
          <div style={{ position: 'relative' }}>
            <input
              type="file"
              accept=".yaml,.yml"
              onChange={onImportRules}
              style={{
                position: 'absolute',
                opacity: 0,
                width: '100%',
                height: '100%',
                cursor: 'pointer'
              }}
            />
            <button 
              className={`btn ${hasRules ? 'btn-success' : 'btn-primary'}`}
              style={{ pointerEvents: 'none' }}
            >
              导入规则
              {hasRules && (
                <span className="status-indicator">
                  <span className="status-dot green"></span>
                  已加载
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
      
      <div className="file-info" style={{ marginTop: '1.5rem' }}>
        <h4 style={{ marginBottom: '0.75rem', color: '#2c3e50' }}>数据格式说明</h4>
        
        <div style={{ marginBottom: '1rem' }}>
          <strong>病例 CSV 字段:</strong>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', fontSize: '0.85rem' }}>
            <li><code>id</code> / <code>caseId</code> - 病例ID</li>
            <li><code>patientName</code> / <code>patient</code> - 动物名称</li>
            <li><code>species</code> / <code>animalType</code> - 动物类型</li>
            <li><code>weight</code> - 体重 (kg)</li>
            <li><code>surgeryDate</code> / <code>date</code> - 手术日期</li>
            <li><code>startTime</code> / <code>anesthesiaStart</code> - 麻醉开始时间</li>
            <li><code>endTime</code> / <code>anesthesiaEnd</code> - 麻醉结束时间</li>
            <li><code>procedure</code> / <code>surgeryType</code> - 手术类型</li>
          </ul>
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <strong>体征 JSONL 格式:</strong>
          <pre style={{ 
            background: '#f8f9fa', 
            padding: '0.75rem', 
            borderRadius: '4px',
            fontSize: '0.8rem',
            marginTop: '0.5rem',
            overflowX: 'auto'
          }}>
{`{
  "caseId": "CASE001",
  "timestamp": "2024-01-15T09:00:00",
  "heartRate": 120,
  "systolicBP": 110,
  "diastolicBP": 70,
  "spo2": 98,
  "etco2": 35,
  "temperature": 37.5
}`}
          </pre>
        </div>
        
        <div>
          <strong>用药 CSV 字段:</strong>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', fontSize: '0.85rem' }}>
            <li><code>caseId</code> - 病例ID</li>
            <li><code>timestamp</code> / <code>adminTime</code> - 给药时间</li>
            <li><code>drugName</code> / <code>name</code> - 药物名称</li>
            <li><code>dosage</code> - 剂量</li>
            <li><code>unit</code> - 单位</li>
            <li><code>route</code> - 给药方式</li>
            <li><code>weight</code> - 体重 (用于剂量计算)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ImportSection;
