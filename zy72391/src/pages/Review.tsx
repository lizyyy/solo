import { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { getStatusLabel, getStatusColor, getSourceLabel, getCoefficientLabel } from '../utils/heatLoadCalculator';

export default function Review() {
  const { state, reviewRecord, addModification } = useSystem();
  const [selectedRecordId, setSelectedRecordId] = useState<string>(
    state.heatLoadRecords.find(r => r.reviewStatus === 'unreviewed')?.id || 
    state.heatLoadRecords[0]?.id || ''
  );
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showModificationModal, setShowModificationModal] = useState(false);
  const [reviewRemark, setReviewRemark] = useState('');
  const [modificationForm, setModificationForm] = useState({
    coefficientName: 'heatDissipationCoeff',
    originalValue: 0,
    modifiedValue: 0,
    modifier: '何工',
    reason: '',
    hasReason: false
  });

  const pendingRecords = state.heatLoadRecords.filter(r => r.hasUnreasonedModification || r.reviewStatus === 'unreviewed');
  const selectedRecord = state.heatLoadRecords.find(r => r.id === selectedRecordId);

  const handleReview = () => {
    if (!selectedRecordId) return;
    reviewRecord(selectedRecordId, '何工', reviewRemark || '已复核');
    setShowReviewModal(false);
    setReviewRemark('');
  };

  const handleAddModification = () => {
    if (!selectedRecordId) return;
    addModification(selectedRecordId, {
      coefficientName: modificationForm.coefficientName,
      originalValue: modificationForm.originalValue,
      modifiedValue: modificationForm.modifiedValue,
      modifier: modificationForm.modifier,
      reason: modificationForm.hasReason ? modificationForm.reason : undefined,
      hasReason: modificationForm.hasReason
    });
    setShowModificationModal(false);
    setModificationForm({
      coefficientName: 'heatDissipationCoeff',
      originalValue: 0,
      modifiedValue: 0,
      modifier: '何工',
      reason: '',
      hasReason: false
    });
  };

  const handleModifyRecord = () => {
    if (!selectedRecord) return;
    setModificationForm(prev => ({
      ...prev,
      originalValue: selectedRecord.heatDissipationCoeff,
      modifiedValue: selectedRecord.heatDissipationCoeff
    }));
    setShowModificationModal(true);
  };

  return (
    <div>
      <div className="alert alert-warning">
        <strong>复核注意：</strong>碰到人工改过系数但没写原因的记录，别急着归正常，先核对采样间隔说明和温度校准记录谁更可信。确认后再点"复核通过"。
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">待复核记录 ({pendingRecords.length} 条)</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>记录ID</th>
              <th>车号</th>
              <th>状态</th>
              <th>热负荷 (kJ/m²)</th>
              <th>问题说明</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {pendingRecords.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#8c8c8c', padding: '40px' }}>
                  暂无待复核记录
                </td>
              </tr>
            ) : (
              pendingRecords.map(record => (
                <tr key={record.id}>
                  <td>{record.id}</td>
                  <td>{record.trainNo}-{record.carriageNo}</td>
                  <td>
                    <span className="status-tag" style={{ background: getStatusColor(record.status) }}>
                      {getStatusLabel(record.status)}
                    </span>
                  </td>
                  <td><strong>{record.finalHeatLoad}</strong></td>
                  <td>
                    {record.hasUnreasonedModification ? (
                      <span style={{ color: '#ff4d4f' }}>存在未说明原因的系数修改</span>
                    ) : record.reviewStatus === 'unreviewed' ? (
                      <span style={{ color: '#faad14' }}>待复核</span>
                    ) : '-'}
                  </td>
                  <td>
                    <button 
                      className="link-btn"
                      onClick={() => {
                        setSelectedRecordId(record.id);
                        setShowReviewModal(true);
                      }}
                    >
                      处理
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedRecord && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">当前查看：{selectedRecord.id}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-default btn-sm" onClick={handleModifyRecord}>
                模拟修改系数
              </button>
              <button className="btn btn-success btn-sm" onClick={() => setShowReviewModal(true)}>
                复核通过
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span className="status-tag" style={{ background: getStatusColor(selectedRecord.status) }}>
              {getStatusLabel(selectedRecord.status)}
            </span>
            <span>{getSourceLabel(selectedRecord.source)}</span>
            <span style={{ color: '#8c8c8c' }}>|</span>
            <span>记录时间：{selectedRecord.recordTime}</span>
          </div>

          {selectedRecord.modifications.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '12px', color: '#595959' }}>系数修改记录</h4>
              {selectedRecord.modifications.map((mod, idx) => (
                <div 
                  key={idx} 
                  className={`modification-item ${!mod.hasReason ? 'modification-no-reason' : ''}`}
                >
                  <div className="modification-header">
                    <span style={{ fontWeight: 500 }}>
                      {getCoefficientLabel(mod.coefficientName)}: {mod.originalValue} → {mod.modifiedValue}
                    </span>
                    <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
                      {mod.modifier} | {mod.modifyTime}
                    </span>
                  </div>
                  {mod.reason ? (
                    <div style={{ fontSize: '13px', color: '#595959' }}>原因：{mod.reason}</div>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#ff4d4f', fontWeight: 500 }}>
                      ⚠ 未填写修改原因！请核对采样间隔说明和温度校准记录的可信度
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">制动力 (kN)</div>
              <div className="detail-value">{selectedRecord.brakingForce}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">制动初速 (km/h)</div>
              <div className="detail-value">{selectedRecord.brakingSpeed}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">制动时长 (s)</div>
              <div className="detail-value">{selectedRecord.brakingDuration}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">摩擦系数 μ</div>
              <div className="detail-value">{selectedRecord.frictionCoeff}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">散热系数 K</div>
              <div className="detail-value">{selectedRecord.heatDissipationCoeff}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">最终热负荷 (kJ/m²)</div>
              <div className="detail-value" style={{ color: '#52c41a' }}>{selectedRecord.finalHeatLoad}</div>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <h4 style={{ marginBottom: '8px', color: '#595959' }}>计算日志</h4>
            <div className="log-list" style={{ maxHeight: '200px' }}>
              {selectedRecord.calculationLog.map((log, idx) => (
                <div key={idx} className="log-item">{log}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showReviewModal && selectedRecord && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">复核记录：{selectedRecord.id}</div>
            <div className="modal-body">
              {selectedRecord.hasUnreasonedModification && (
                <div className="alert alert-warning">
                  <strong>提醒：</strong>该记录存在未说明原因的系数修改，请确认采样间隔说明和温度校准记录的可信度后再复核。
                </div>
              )}
              <div className="form-group">
                <label className="form-label">复核意见</label>
                <textarea 
                  className="form-input form-textarea"
                  value={reviewRemark}
                  onChange={e => setReviewRemark(e.target.value)}
                  placeholder="请填写复核意见，如：核对了TC-001校准记录，数据可信"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowReviewModal(false)}>取消</button>
              <button className="btn btn-success" onClick={handleReview}>
                确认复核通过
              </button>
            </div>
          </div>
        </div>
      )}

      {showModificationModal && (
        <div className="modal-overlay" onClick={() => setShowModificationModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">模拟修改系数（演示用）</div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">修改系数</label>
                  <select 
                    className="form-input"
                    value={modificationForm.coefficientName}
                    onChange={e => setModificationForm({...modificationForm, coefficientName: e.target.value})}
                  >
                    <option value="frictionCoeff">摩擦系数 μ</option>
                    <option value="heatDissipationCoeff">散热系数 K</option>
                    <option value="contactArea">接触面积</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">修改人</label>
                  <input 
                    className="form-input"
                    value={modificationForm.modifier}
                    onChange={e => setModificationForm({...modificationForm, modifier: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">原值</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={modificationForm.originalValue}
                    onChange={e => setModificationForm({...modificationForm, originalValue: Number(e.target.value)})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">修改后值</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={modificationForm.modifiedValue}
                    onChange={e => setModificationForm({...modificationForm, modifiedValue: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox"
                      checked={modificationForm.hasReason}
                      onChange={e => setModificationForm({...modificationForm, hasReason: e.target.checked})}
                    />
                    填写修改原因
                  </label>
                </div>
              </div>
              {modificationForm.hasReason && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">修改原因</label>
                    <textarea 
                      className="form-input form-textarea"
                      value={modificationForm.reason}
                      onChange={e => setModificationForm({...modificationForm, reason: e.target.value})}
                      placeholder="说明修改系数的依据"
                    />
                  </div>
                </div>
              )}
              {!modificationForm.hasReason && (
                <div className="alert alert-warning">
                  不填原因的修改会被标记为"人工改系数未说明"，进入待复核队列
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowModificationModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleAddModification}>
                确认修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
