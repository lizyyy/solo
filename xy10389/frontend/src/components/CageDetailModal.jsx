import React from 'react';
import dayjs from 'dayjs';

function CageDetailModal({ cage, currentHosp, futureReservations, history, onClose, onViewHosp }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            笼位详情 - {cage.cage_number}
            {cage.is_isolation && (
              <span className="cage-tag tag-infectious" style={{ marginLeft: '12px' }}>隔离笼位</span>
            )}
          </h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="detail-section">
            <h3>📋 基本信息</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">笼位编号</span>
                <span className="value">{cage.cage_number}</span>
              </div>
              <div className="info-item">
                <span className="label">所在区域</span>
                <span className="value">{cage.location_name || '-'}</span>
              </div>
              <div className="info-item">
                <span className="label">最大承重</span>
                <span className="value">{cage.max_weight_kg || '-'} kg</span>
              </div>
              <div className="info-item">
                <span className="label">隔离笼位</span>
                <span className="value">{cage.is_isolation ? '是' : '否'}</span>
              </div>
              {cage.notes && (
                <div className="info-item">
                  <span className="label">备注</span>
                  <span className="value">{cage.notes}</span>
                </div>
              )}
            </div>
          </div>

          <div className="detail-section">
            <h3>🐾 当前占用</h3>
            {currentHosp ? (
              <div
                style={{
                  background: '#f8f9fa',
                  padding: '16px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => onViewHosp(currentHosp.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                      {currentHosp.pet_name} ({currentHosp.species_name})
                    </div>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                      {currentHosp.admission_number} | {currentHosp.primary_diagnosis}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      入院: {dayjs(currentHosp.admission_date).format('YYYY-MM-DD HH:mm')}
                      {currentHosp.expected_discharge_date && (
                        <span> | 预计出院: {dayjs(currentHosp.expected_discharge_date).format('YYYY-MM-DD HH:mm')}</span>
                      )}
                    </div>
                  </div>
                  <div className="cage-tags">
                    {currentHosp.is_infectious && (
                      <span className="cage-tag tag-infectious">传染病</span>
                    )}
                    {currentHosp.care_level_name && (
                      <span className="cage-tag tag-care">{currentHosp.care_level_name}</span>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: '12px', fontSize: '12px', color: '#667eea' }}>
                  点击查看详情 →
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="icon">🏠</div>
                <p>当前空闲</p>
              </div>
            )}
          </div>

          {futureReservations && futureReservations.length > 0 && (
            <div className="detail-section">
              <h3>📅 未来预订</h3>
              <table>
                <thead>
                  <tr>
                    <th>宠物</th>
                    <th>种类</th>
                    <th>入院时间</th>
                    <th>预计出院</th>
                  </tr>
                </thead>
                <tbody>
                  {futureReservations.map(h => (
                    <tr key={h.id} onClick={() => onViewHosp(h.id)} style={{ cursor: 'pointer' }}>
                      <td>{h.pet_name}</td>
                      <td>{h.species_name}</td>
                      <td>{dayjs(h.admission_date).format('MM-DD HH:mm')}</td>
                      <td>
                        {h.expected_discharge_date
                          ? dayjs(h.expected_discharge_date).format('MM-DD HH:mm')
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="detail-section">
            <h3>📜 使用历史</h3>
            {history && history.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>宠物</th>
                    <th>住院号</th>
                    <th>开始时间</th>
                    <th>结束时间</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, idx) => (
                    <tr key={idx}>
                      <td>{h.pet_name}</td>
                      <td>{h.admission_number}</td>
                      <td>{dayjs(h.start_date).format('MM-DD HH:mm')}</td>
                      <td>
                        {h.end_date
                          ? dayjs(h.end_date).format('MM-DD HH:mm')
                          : <span className="status-badge status-active">当前</span>}
                      </td>
                      <td>{h.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p>暂无使用历史</p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}

export default CageDetailModal;
