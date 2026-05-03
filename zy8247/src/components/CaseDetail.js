import React from 'react';

const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const CaseDetail = ({ caseData }) => {
  if (!caseData) return null;

  const errorCount = caseData.errorCount || 0;
  const warningCount = caseData.warningCount || 0;
  const infoCount = caseData.infoCount || 0;

  return (
    <div>
      <div className="section">
        <div className="section-header">
          <h2>病例摘要</h2>
        </div>
        <div className="section-body">
          <div className="case-summary">
            <div className="summary-item">
              <div className="summary-label">病例ID</div>
              <div className="summary-value">{caseData.id || caseData.caseId || '-'}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">动物名称</div>
              <div className="summary-value">{caseData.patientName || caseData.patient || '-'}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">动物类型</div>
              <div className="summary-value">{caseData.species || caseData.animalType || '-'}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">年龄</div>
              <div className="summary-value">{caseData.age || '-'}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">体重</div>
              <div className="summary-value">{caseData.weight || '-'} kg</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">手术类型</div>
              <div className="summary-value">{caseData.procedure || caseData.surgeryType || '-'}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">手术日期</div>
              <div className="summary-value">{caseData.surgeryDate || caseData.date || '-'}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">麻醉时长</div>
              <div className="summary-value">
                {caseData.anesthesiaDuration 
                  ? `${caseData.anesthesiaDuration} 分钟` 
                  : '-'}
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-label">恢复状态</div>
              <div className="summary-value">
                {caseData.recoveryStatus === 'extubated' 
                  ? '已拔管 ✓' 
                  : caseData.recoveryStatus || '-'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2>风险检测</h2>
        </div>
        <div className="section-body">
          <div className="issues-summary">
            <div className="issue-card error">
              <h4>🔴 错误</h4>
              <p>{errorCount}</p>
            </div>
            <div className="issue-card warning">
              <h4>🟡 警告</h4>
              <p>{warningCount}</p>
            </div>
            <div className="issue-card info">
              <h4>🔵 提示</h4>
              <p>{infoCount}</p>
            </div>
          </div>
          
          {caseData.issues && caseData.issues.length > 0 ? (
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ marginBottom: '0.75rem', color: '#2c3e50' }}>详细问题列表</h4>
              {caseData.issues.map((issue, index) => (
                <div 
                  key={issue.id || index}
                  style={{
                    padding: '1rem',
                    marginBottom: '0.75rem',
                    borderRadius: '4px',
                    backgroundColor: 
                      issue.severity === 'error' ? '#ffebee' :
                      issue.severity === 'warning' ? '#fff3e0' :
                      '#e3f2fd',
                    borderLeft: `4px solid ${
                      issue.severity === 'error' ? '#e74c3c' :
                      issue.severity === 'warning' ? '#f39c12' :
                      '#3498db'
                    }`
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '0.5rem'
                  }}>
                    <strong style={{ fontSize: '1rem' }}>
                      {issue.severity === 'error' ? '🔴' : 
                       issue.severity === 'warning' ? '🟡' : '🔵'}
                      {' '}{issue.title}
                    </strong>
                    {issue.time && (
                      <span style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>
                        {formatTime(issue.time)}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '0.5rem' }}>
                    {issue.description}
                  </p>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    padding: '0.125rem 0.5rem',
                    backgroundColor: 'rgba(0,0,0,0.05)',
                    borderRadius: '3px',
                    color: '#7f8c8d'
                  }}>
                    类型: {issue.type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>✅ 未检测到风险点</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                麻醉记录完整，无需特殊关注
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2>麻醉时间线</h2>
        </div>
        <div className="section-body">
          {caseData.timeline && caseData.timeline.length > 0 ? (
            <div className="timeline-container">
              {caseData.timeline.map((item, index) => (
                <div key={index} className="timeline-item">
                  <div className={`timeline-marker ${item.type}`}></div>
                  <div className="timeline-content">
                    <div className="timeline-time">
                      {formatTime(item.time)}
                    </div>
                    
                    {item.type === 'event' && (
                      <>
                        <div className="timeline-title">{item.data.title}</div>
                        {item.data.description && (
                          <div className="timeline-details">{item.data.description}</div>
                        )}
                      </>
                    )}
                    
                    {item.type === 'vitals' && (
                      <>
                        <div className="timeline-title">生命体征</div>
                        <div className="vitals-grid">
                          {item.data.heartRate && (
                            <div className="vital-item">
                              <div className="vital-label">心率</div>
                              <div className="vital-value">{item.data.heartRate} bpm</div>
                            </div>
                          )}
                          {item.data.systolicBP && item.data.diastolicBP && (
                            <div className="vital-item">
                              <div className="vital-label">血压</div>
                              <div className="vital-value">{item.data.systolicBP}/{item.data.diastolicBP} mmHg</div>
                            </div>
                          )}
                          {item.data.spo2 && (
                            <div className="vital-item">
                              <div className="vital-label">血氧</div>
                              <div className="vital-value">{item.data.spo2}%</div>
                            </div>
                          )}
                          {item.data.etco2 && (
                            <div className="vital-item">
                              <div className="vital-label">EtCO2</div>
                              <div className="vital-value">{item.data.etco2} mmHg</div>
                            </div>
                          )}
                          {item.data.temperature && (
                            <div className="vital-item">
                              <div className="vital-label">体温</div>
                              <div className="vital-value">{item.data.temperature}°C</div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    
                    {item.type === 'medication' && (
                      <>
                        <div className="timeline-title">
                          💊 {item.data.drugName || item.data.name}
                        </div>
                        <div className="timeline-details">
                          剂量: {item.data.dosage || '-'} {item.data.unit || ''}
                          {item.data.route && ` · 途径: ${item.data.route}`}
                        </div>
                      </>
                    )}
                    
                    {item.type === 'issue' && (
                      <>
                        <div className="timeline-title">
                          {item.data.severity === 'error' ? '🔴' : 
                           item.data.severity === 'warning' ? '🟡' : '🔵'}
                          {' '}{item.data.title}
                        </div>
                        <div className="timeline-details">{item.data.description}</div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>暂无时间线数据</p>
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2>用药记录</h2>
          <span style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>
            共 {caseData.medications?.length || 0} 条记录
          </span>
        </div>
        <div className="section-body">
          {caseData.medications && caseData.medications.length > 0 ? (
            <table className="medication-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>药物名称</th>
                  <th>剂量</th>
                  <th>单位</th>
                  <th>给药方式</th>
                </tr>
              </thead>
              <tbody>
                {caseData.medications.map((med, index) => (
                  <tr key={index}>
                    <td>{formatTime(med.timestamp || med.adminTime)}</td>
                    <td>
                      <strong>{med.drugName || med.name || '-'}</strong>
                    </td>
                    <td>{med.dosage || '-'}</td>
                    <td>{med.unit || '-'}</td>
                    <td>{med.route || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p>暂无用药记录</p>
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2>生命体征摘要</h2>
          <span style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>
            共 {caseData.vitals?.length || 0} 条记录
          </span>
        </div>
        <div className="section-body">
          {caseData.vitals && caseData.vitals.length > 0 ? (
            <div className="case-summary">
              {(() => {
                const hrValues = caseData.vitals
                  .filter(v => v.heartRate && !isNaN(v.heartRate))
                  .map(v => parseFloat(v.heartRate));
                
                if (hrValues.length > 0) {
                  return (
                    <>
                      <div className="summary-item">
                        <div className="summary-label">心率记录数</div>
                        <div className="summary-value">{hrValues.length} 条</div>
                      </div>
                      <div className="summary-item">
                        <div className="summary-label">心率范围</div>
                        <div className="summary-value">
                          {Math.min(...hrValues)} - {Math.max(...hrValues)} bpm
                        </div>
                      </div>
                      <div className="summary-item">
                        <div className="summary-label">平均心率</div>
                        <div className="summary-value">
                          {Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length)} bpm
                        </div>
                      </div>
                    </>
                  );
                }
                return null;
              })()}
              
              {(() => {
                const tempValues = caseData.vitals
                  .filter(v => v.temperature && !isNaN(v.temperature))
                  .map(v => parseFloat(v.temperature));
                
                if (tempValues.length > 0) {
                  return (
                    <>
                      <div className="summary-item">
                        <div className="summary-label">体温记录数</div>
                        <div className="summary-value">{tempValues.length} 条</div>
                      </div>
                      <div className="summary-item">
                        <div className="summary-label">体温范围</div>
                        <div className="summary-value">
                          {Math.min(...tempValues).toFixed(1)} - {Math.max(...tempValues).toFixed(1)} °C
                        </div>
                      </div>
                      <div className="summary-item">
                        <div className="summary-label">平均体温</div>
                        <div className="summary-value">
                          {(tempValues.reduce((a, b) => a + b, 0) / tempValues.length).toFixed(1)} °C
                        </div>
                      </div>
                    </>
                  );
                }
                return null;
              })()}
              
              {(() => {
                const spo2Values = caseData.vitals
                  .filter(v => v.spo2 && !isNaN(v.spo2))
                  .map(v => parseFloat(v.spo2));
                
                if (spo2Values.length > 0) {
                  return (
                    <>
                      <div className="summary-item">
                        <div className="summary-label">血氧记录数</div>
                        <div className="summary-value">{spo2Values.length} 条</div>
                      </div>
                      <div className="summary-item">
                        <div className="summary-label">血氧范围</div>
                        <div className="summary-value">
                          {Math.min(...spo2Values)} - {Math.max(...spo2Values)} %
                        </div>
                      </div>
                    </>
                  );
                }
                return null;
              })()}
              
              {(() => {
                const bpValues = caseData.vitals
                  .filter(v => v.systolicBP && !isNaN(v.systolicBP) && v.diastolicBP && !isNaN(v.diastolicBP))
                  .map(v => ({ sys: parseFloat(v.systolicBP), dia: parseFloat(v.diastolicBP) }));
                
                if (bpValues.length > 0) {
                  const sysValues = bpValues.map(v => v.sys);
                  const diaValues = bpValues.map(v => v.dia);
                  return (
                    <>
                      <div className="summary-item">
                        <div className="summary-label">血压记录数</div>
                        <div className="summary-value">{bpValues.length} 条</div>
                      </div>
                      <div className="summary-item">
                        <div className="summary-label">血压范围</div>
                        <div className="summary-value">
                          {Math.min(...sysValues)}/{Math.min(...diaValues)} - {Math.max(...sysValues)}/{Math.max(...diaValues)} mmHg
                        </div>
                      </div>
                    </>
                  );
                }
                return null;
              })()}
            </div>
          ) : (
            <div className="empty-state">
              <p>暂无生命体征记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseDetail;
