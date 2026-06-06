import { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { getStatusLabel, getStatusColor, getSourceLabel, getCoefficientLabel } from '../utils/heatLoadCalculator';

export default function ParamReplay() {
  const { 
    state, 
    getRecordById, 
    getCalibrationById, 
    getSamplingIntervalById,
    recalculateWithCalibration 
  } = useSystem();
  
  const [selectedRecordId, setSelectedRecordId] = useState<string>(
    state.heatLoadRecords[0]?.id || ''
  );
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [selectedCalibrationId, setSelectedCalibrationId] = useState('');

  const selectedRecord = getRecordById(selectedRecordId);
  const samplingInterval = selectedRecord?.samplingIntervalId 
    ? getSamplingIntervalById(selectedRecord.samplingIntervalId)
    : undefined;
  const calibrationRecord = selectedRecord?.temperatureCalibrationId
    ? getCalibrationById(selectedRecord.temperatureCalibrationId)
    : undefined;

  const handleApplyCalibration = () => {
    if (!selectedRecordId || !selectedCalibrationId) return;
    recalculateWithCalibration(selectedRecordId, selectedCalibrationId);
    setShowCalibrationModal(false);
    setSelectedCalibrationId('');
  };

  if (!selectedRecord) {
    return <div className="card">暂无记录数据</div>;
  }

  return (
    <div>
      <div className="alert alert-info">
        <strong>参数回放：</strong>补录温度校准记录后，选择"应用校准重算"，热负荷值和计算日志会同步更新。版本号 v{selectedRecord.replayVersion}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">选择回放记录</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select 
              className="form-input"
              style={{ width: '200px' }}
              value={selectedRecordId}
              onChange={e => setSelectedRecordId(e.target.value)}
            >
              {state.heatLoadRecords.map(r => (
                <option key={r.id} value={r.id}>
                  {r.id} - {r.trainNo}/{r.carriageNo} - {getStatusLabel(r.status)}
                </option>
              ))}
            </select>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setShowCalibrationModal(true)}
            >
              应用校准重算
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <span className="status-tag" style={{ background: getStatusColor(selectedRecord.status) }}>
            {getStatusLabel(selectedRecord.status)}
          </span>
          <span>{getSourceLabel(selectedRecord.source)}</span>
          <span style={{ color: '#8c8c8c' }}>|</span>
          <span>回放版本 v{selectedRecord.replayVersion}</span>
          {selectedRecord.reviewStatus === 'reviewed' && (
            <>
              <span style={{ color: '#8c8c8c' }}>|</span>
              <span style={{ color: '#52c41a' }}>已复核：{selectedRecord.reviewer}</span>
            </>
          )}
        </div>

        <div className="card" style={{ background: '#fafafa', marginBottom: '0' }}>
          <div className="card-title" style={{ marginBottom: '12px', fontSize: '14px' }}>基础信息</div>
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">记录ID</div>
              <div className="detail-value">{selectedRecord.id}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">车组-车厢</div>
              <div className="detail-value">{selectedRecord.trainNo} - {selectedRecord.carriageNo}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">制动器ID</div>
              <div className="detail-value">{selectedRecord.brakeId}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">记录时间</div>
              <div className="detail-value">{selectedRecord.recordTime}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">采样间隔</div>
              <div className="detail-value">
                {samplingInterval ? `${samplingInterval.name} (${samplingInterval.intervalMs}ms)` : '未指定'}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">温度校准</div>
              <div className="detail-value">
                {calibrationRecord ? (
                  <span>
                    {calibrationRecord.id}
                    {calibrationRecord.isOldStandard && (
                      <span className="status-tag" style={{ background: '#faad14', marginLeft: '6px', fontSize: '11px' }}>
                        旧口径
                      </span>
                    )}
                  </span>
                ) : '未关联'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">制动参数</div>
        </div>
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
            <div className="detail-label">环境温度 (℃)</div>
            <div className="detail-value">{selectedRecord.ambientTemp}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">摩擦系数 μ</div>
            <div className="detail-value">
              {selectedRecord.frictionCoeff}
              {selectedRecord.modifications.find(m => m.coefficientName === 'frictionCoeff') && (
                <span style={{ color: '#faad14', fontSize: '12px', marginLeft: '6px' }}>已修改</span>
              )}
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">散热系数 K</div>
            <div className="detail-value">
              {selectedRecord.heatDissipationCoeff}
              {selectedRecord.modifications.find(m => m.coefficientName === 'heatDissipationCoeff') && (
                <span style={{ color: '#faad14', fontSize: '12px', marginLeft: '6px' }}>已修改</span>
              )}
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">接触面积 (m²)</div>
            <div className="detail-value">{selectedRecord.contactArea}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">热负荷计算结果</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {selectedRecord.rawHeatLoad !== undefined && (
            <div style={{ textAlign: 'center', padding: '20px', background: '#fafafa', borderRadius: '6px' }}>
              <div style={{ color: '#8c8c8c', fontSize: '13px', marginBottom: '8px' }}>原始计算值</div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: '#8c8c8c' }}>
                {selectedRecord.rawHeatLoad}
              </div>
              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>kJ/m²</div>
            </div>
          )}
          {selectedRecord.calibratedHeatLoad !== undefined && selectedRecord.calibratedHeatLoad !== selectedRecord.rawHeatLoad && (
            <div style={{ textAlign: 'center', padding: '20px', background: '#e6f7ff', borderRadius: '6px', border: '1px solid #91d5ff' }}>
              <div style={{ color: '#0050b3', fontSize: '13px', marginBottom: '8px' }}>校准后值</div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: '#1890ff' }}>
                {selectedRecord.calibratedHeatLoad}
              </div>
              <div style={{ fontSize: '12px', color: '#0050b3' }}>kJ/m²</div>
            </div>
          )}
          <div style={{ textAlign: 'center', padding: '20px', background: '#f6ffed', borderRadius: '6px', border: '1px solid #b7eb8f' }}>
            <div style={{ color: '#389e0d', fontSize: '13px', marginBottom: '8px' }}>最终热负荷</div>
            <div style={{ fontSize: '28px', fontWeight: 600, color: '#52c41a' }}>
              {selectedRecord.finalHeatLoad}
            </div>
            <div style={{ fontSize: '12px', color: '#389e0d' }}>kJ/m²</div>
          </div>
        </div>

        {selectedRecord.modifications.length > 0 && (
          <div style={{ marginTop: '20px' }}>
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
                    ⚠ 未填写修改原因，需复核
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">计算日志</div>
        </div>
        <div className="log-list">
          {selectedRecord.calculationLog.map((log, idx) => (
            <div key={idx} className="log-item">{log}</div>
          ))}
        </div>
      </div>

      {selectedRecord.reviewRemark && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">复核意见</div>
          </div>
          <div style={{ padding: '12px', background: '#fafafa', borderRadius: '4px' }}>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontWeight: 500 }}>{selectedRecord.reviewer}</span>
              <span style={{ color: '#8c8c8c', fontSize: '12px', marginLeft: '12px' }}>
                {selectedRecord.reviewTime}
              </span>
            </div>
            <div style={{ color: '#595959' }}>{selectedRecord.reviewRemark}</div>
          </div>
        </div>
      )}

      {showCalibrationModal && (
        <div className="modal-overlay" onClick={() => setShowCalibrationModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">选择校准记录应用并重算</div>
            <div className="modal-body">
              <div className="alert alert-warning">
                应用校准记录后，热负荷将重新计算，参数回放页数据同步更新。
              </div>
              <div className="form-group">
                <label className="form-label">选择温度校准记录</label>
                <select 
                  className="form-input"
                  value={selectedCalibrationId}
                  onChange={e => setSelectedCalibrationId(e.target.value)}
                >
                  <option value="">请选择校准记录</option>
                  {state.calibrationRecords.map(cr => (
                    <option key={cr.id} value={cr.id}>
                      {cr.id} - {cr.sensorName} - 补偿{cr.correctionOffset > 0 ? '+' : ''}{cr.correctionOffset}℃
                      {cr.isOldStandard ? '（旧口径）' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowCalibrationModal(false)}>取消</button>
              <button 
                className="btn btn-primary" 
                onClick={handleApplyCalibration}
                disabled={!selectedCalibrationId}
              >
                确认应用并重算
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
