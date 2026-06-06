import { useSystem } from '../context/SystemContext';
import { getStatusLabel, getStatusColor, getSourceLabel } from '../utils/heatLoadCalculator';

export default function Dashboard() {
  const { state, setActiveTab } = useSystem();
  const { heatLoadRecords, samplingIntervals, calibrationRecords } = state;

  const stats = {
    total: heatLoadRecords.length,
    normal: heatLoadRecords.filter(r => r.status === 'normal').length,
    noReason: heatLoadRecords.filter(r => r.status === 'manual_modified_no_reason').length,
    recalibrated: heatLoadRecords.filter(r => r.status === 'recalibrated').length
  };

  return (
    <div>
      <div className="alert alert-info">
        <strong>演示说明：</strong>本系统包含小而真的演示数据，涵盖三种典型场景——正常记录、人工改系数未说明、补录校准后重跑。何工可直接用此给新人讲解完整流程。
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">总记录数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#52c41a' }}>{stats.normal}</div>
          <div className="stat-label">正常记录</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#faad14' }}>{stats.noReason}</div>
          <div className="stat-label">人工改系数未说明</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#1890ff' }}>{stats.recalibrated}</div>
          <div className="stat-label">校准补录重算</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">热负荷记录列表</div>
          <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('replay')}>
            查看参数回放
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>记录ID</th>
              <th>车号-车号</th>
              <th>制动ID</th>
              <th>记录时间</th>
              <th>热负荷 (kJ/m²)</th>
              <th>状态</th>
              <th>来源</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {heatLoadRecords.map(record => (
              <tr key={record.id}>
                <td>{record.id}</td>
                <td>{record.trainNo}-{record.carriageNo}</td>
                <td>{record.brakeId}</td>
                <td>{record.recordTime}</td>
                <td>
                  <strong>{record.finalHeatLoad}</strong>
                  {record.rawHeatLoad !== undefined && record.rawHeatLoad !== record.finalHeatLoad && (
                    <span style={{ color: '#8c8c8c', fontSize: '12px', marginLeft: '8px' }}>
                      (原值 {record.rawHeatLoad}
                    </span>
                  )}
                </td>
                <td>
                  <span className="status-tag" style={{ background: getStatusColor(record.status) }}>
                    {getStatusLabel(record.status)}
                  </span>
                </td>
                <td>{getSourceLabel(record.source)}</td>
                <td>
                  <button 
                    className="link-btn"
                    onClick={() => setActiveTab('replay')}
                  >
                    查看详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">基础数据概览</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h4 style={{ marginBottom: '12px', color: '#595959' }}>采样间隔说明 ({samplingIntervals.length} 条)</h4>
            {samplingIntervals.map(si => (
              <div key={si.id} style={{ padding: '10px', background: '#fafafa', borderRadius: '4px', marginBottom: '8px' }}>
                <div style={{ fontWeight: 500 }}>{si.id} - {si.name}</div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                  间隔：{si.intervalMs}ms | 导入人：{si.operator}
                </div>
              </div>
            ))}
          </div>
          <div>
            <h4 style={{ marginBottom: '12px', color: '#595959' }}>温度校准记录 ({calibrationRecords.length} 条)</h4>
            {calibrationRecords.map(cr => (
              <div key={cr.id} style={{ padding: '10px', background: '#fafafa', borderRadius: '4px', marginBottom: '8px' }}>
                <div style={{ fontWeight: 500 }}>
                  {cr.id} - {cr.sensorName}
                  {cr.isOldStandard && (
                    <span className="status-tag" style={{ background: '#faad14', marginLeft: '8px' }}>旧口径</span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                  校准点：{cr.calibrationPoint}℃ | 补偿：{cr.correctionOffset > 0 ? '+' : ''}{cr.correctionOffset}℃
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">三种典型场景说明（给新人讲解用）</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div style={{ padding: '16px', background: '#f6ffed', borderRadius: '6px', border: '1px solid #b7eb8f' }}>
            <h4 style={{ color: '#389e0d', marginBottom: '8px' }}>场景一：顺利记录</h4>
            <p style={{ fontSize: '13px', color: '#595959', lineHeight: '1.6' }}>
              HL-2025-001：标准流程。采样间隔SI-001正常导入，温度校准TC-001匹配，自动计算热负荷1285.6 kJ/m²，无人工干预，复核通过。
            </p>
          </div>
          <div style={{ padding: '16px', background: '#fffbe6', borderRadius: '6px', border: '1px solid #ffe58f' }}>
            <h4 style={{ color: '#d48806', marginBottom: '8px' }}>场景二：人工改系数未说明</h4>
            <p style={{ fontSize: '13px', color: '#595959', lineHeight: '1.6' }}>
              HL-2025-002：王工修改散热系数0.85→0.78，没写原因。系统标黄，留在未复核状态，等何工确认。别急着归正常，先去复核处理页处理。
            </p>
          </div>
          <div style={{ padding: '16px', background: '#e6f7ff', borderRadius: '6px', border: '1px solid #91d5ff' }}>
            <h4 style={{ color: '#0050b3', marginBottom: '8px' }}>场景三：补录校准重跑</h4>
            <p style={{ fontSize: '13px', color: '#595959', lineHeight: '1.6' }}>
              HL-2025-003：1月数据，补录旧口径校准TC-002后重跑，温度补偿从+1.5改+3.2，热负荷1420.8→1498.2，参数回放同步更新。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
