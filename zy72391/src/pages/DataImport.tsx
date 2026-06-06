import { useState } from 'react';
import { useSystem } from '../context/SystemContext';

export default function DataImport() {
  const { state, importSamplingInterval, importCalibrationRecord } = useSystem();
  const [activeTab, setActiveTab] = useState<'sampling' | 'calibration'>('sampling');
  const [showSamplingForm, setShowSamplingForm] = useState(false);
  const [showCalibrationForm, setShowCalibrationForm] = useState(false);

  const [samplingForm, setSamplingForm] = useState({
    name: '',
    intervalMs: 100,
    description: '',
    operator: '何工'
  });

  const [calibrationForm, setCalibrationForm] = useState({
    sensorId: '',
    sensorName: '',
    calibrationDate: new Date().toISOString().split('T')[0],
    calibrationPoint: 150,
    measuredValue: 150,
    correctionOffset: 0,
    operator: '何工',
    remarks: '',
    isOldStandard: false
  });

  const handleImportSampling = () => {
    if (!samplingForm.name) {
      alert('请输入采样间隔名称');
      return;
    }
    importSamplingInterval(samplingForm);
    setShowSamplingForm(false);
    setSamplingForm({ name: '', intervalMs: 100, description: '', operator: '何工' });
  };

  const handleImportCalibration = () => {
    if (!calibrationForm.sensorId || !calibrationForm.sensorName) {
      alert('请填写传感器信息');
      return;
    }
    const offset = calibrationForm.calibrationPoint - calibrationForm.measuredValue;
    importCalibrationRecord({
      ...calibrationForm,
      correctionOffset: Math.round(offset * 10) / 10
    });
    setShowCalibrationForm(false);
    setCalibrationForm({
      sensorId: '',
      sensorName: '',
      calibrationDate: new Date().toISOString().split('T')[0],
      calibrationPoint: 150,
      measuredValue: 150,
      correctionOffset: 0,
      operator: '何工',
      remarks: '',
      isOldStandard: false
    });
  };

  return (
    <div>
      <div className="alert alert-info">
        <strong>第一步：</strong>先导入采样间隔说明，再导入温度校准记录。校准记录补录后，参数回放页的对应记录会同步更新。
      </div>

      <div className="tabs">
        <div 
          className={`tab-item ${activeTab === 'sampling' ? 'active' : ''}`}
          onClick={() => setActiveTab('sampling')}
        >
          采样间隔说明
        </div>
        <div 
          className={`tab-item ${activeTab === 'calibration' ? 'active' : ''}`}
          onClick={() => setActiveTab('calibration')}
        >
          温度校准记录
        </div>
      </div>

      {activeTab === 'sampling' && (
        <div>
          <div className="card">
            <div className="card-header">
              <div className="card-title">采样间隔说明列表</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowSamplingForm(true)}>
                + 导入采样间隔
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>名称</th>
                  <th>间隔(ms)</th>
                  <th>说明</th>
                  <th>导入时间</th>
                  <th>导入人</th>
                </tr>
              </thead>
              <tbody>
                {state.samplingIntervals.map(si => (
                  <tr key={si.id}>
                    <td>{si.id}</td>
                    <td>{si.name}</td>
                    <td>{si.intervalMs}</td>
                    <td>{si.description}</td>
                    <td>{si.importTime}</td>
                    <td>{si.operator}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showSamplingForm && (
            <div className="modal-overlay" onClick={() => setShowSamplingForm(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">导入采样间隔说明</div>
                <div className="modal-body">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">名称</label>
                      <input 
                        className="form-input"
                        value={samplingForm.name}
                        onChange={e => setSamplingForm({...samplingForm, name: e.target.value})}
                        placeholder="如：标准制动采样间隔"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">采样间隔(ms)</label>
                      <input 
                        type="number"
                        className="form-input"
                        value={samplingForm.intervalMs}
                        onChange={e => setSamplingForm({...samplingForm, intervalMs: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">说明</label>
                      <textarea 
                        className="form-input form-textarea"
                        value={samplingForm.description}
                        onChange={e => setSamplingForm({...samplingForm, description: e.target.value})}
                        placeholder="描述该采样间隔适用的工况"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">操作人</label>
                      <input 
                        className="form-input"
                        value={samplingForm.operator}
                        onChange={e => setSamplingForm({...samplingForm, operator: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-default" onClick={() => setShowSamplingForm(false)}>取消</button>
                  <button className="btn btn-primary" onClick={handleImportSampling}>确认导入</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'calibration' && (
        <div>
          <div className="card">
            <div className="card-header">
              <div className="card-title">温度校准记录列表</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCalibrationForm(true)}>
                + 导入校准记录
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>传感器</th>
                  <th>校准日期</th>
                  <th>校准点(℃)</th>
                  <th>实测值(℃)</th>
                  <th>补偿值(℃)</th>
                  <th>操作人</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {state.calibrationRecords.map(cr => (
                  <tr key={cr.id}>
                    <td>
                    {cr.id}
                      {cr.isOldStandard && (
                        <span className="status-tag" style={{ background: '#faad14', marginLeft: '6px' }}>旧口径</span>
                      )}
                    </td>
                    <td>{cr.sensorName}</td>
                    <td>{cr.calibrationDate}</td>
                    <td>{cr.calibrationPoint}</td>
                    <td>{cr.measuredValue}</td>
                    <td style={{ color: cr.correctionOffset >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 500 }}>
                      {cr.correctionOffset > 0 ? '+' : ''}{cr.correctionOffset}
                    </td>
                    <td>{cr.operator}</td>
                    <td>{cr.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showCalibrationForm && (
            <div className="modal-overlay" onClick={() => setShowCalibrationForm(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">导入温度校准记录</div>
                <div className="modal-body">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">传感器ID</label>
                      <input 
                        className="form-input"
                        value={calibrationForm.sensorId}
                        onChange={e => setCalibrationForm({...calibrationForm, sensorId: e.target.value})}
                        placeholder="如：TS-BRK-012"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">传感器名称</label>
                      <input 
                        className="form-input"
                        value={calibrationForm.sensorName}
                        onChange={e => setCalibrationForm({...calibrationForm, sensorName: e.target.value})}
                        placeholder="如：1号车制动盘表面温度传感器"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">校准日期</label>
                      <input 
                        type="date"
                        className="form-input"
                        value={calibrationForm.calibrationDate}
                        onChange={e => setCalibrationForm({...calibrationForm, calibrationDate: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">校准点温度(℃)</label>
                      <input 
                        type="number"
                        className="form-input"
                        value={calibrationForm.calibrationPoint}
                        onChange={e => setCalibrationForm({...calibrationForm, calibrationPoint: Number(e.target.value)})}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">实测温度(℃)</label>
                      <input 
                        type="number"
                        step="0.1"
                        className="form-input"
                        value={calibrationForm.measuredValue}
                        onChange={e => setCalibrationForm({...calibrationForm, measuredValue: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">备注</label>
                      <textarea 
                        className="form-input form-textarea"
                        value={calibrationForm.remarks}
                        onChange={e => setCalibrationForm({...calibrationForm, remarks: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input 
                          type="checkbox"
                          checked={calibrationForm.isOldStandard}
                          onChange={e => setCalibrationForm({...calibrationForm, isOldStandard: e.target.checked})}
                        />
                        旧口径校准记录（使用旧版校准规程）
                      </label>
                    </div>
                  </div>
                  <div className="alert alert-info" style={{ marginBottom: 0 }}>
                    系统自动计算补偿值 = 校准点 - 实测值 = {calibrationForm.calibrationPoint - calibrationForm.measuredValue} ℃
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-default" onClick={() => setShowCalibrationForm(false)}>取消</button>
                  <button className="btn btn-primary" onClick={handleImportCalibration}>确认导入</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
