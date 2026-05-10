import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import './App.css';
import { useAppStore } from './store/AppStore';
import type { EnergyConsumption } from './types';
import {
  sampleValidCSV, sampleDuplicateCSV, sampleMissingFieldsCSV,
  sampleManualErrorCSV, sampleValidJSON
} from './data/sampleData';
import { applyWeatherCorrection } from './utils/weatherCorrection';

const COLORS = ['#0f4c75', '#3282b8', '#0f4c75', '#bbe1fa', '#0f4c75', '#f39c12', '#2ecc71'];

const App = () => {
  const store = useAppStore();
  const [importFormat, setImportFormat] = useState<'csv' | 'json'>('csv');
  const [importContent, setImportContent] = useState('');
  const [selectedHouseType, setSelectedHouseType] = useState<string>('');
  const [selectedConsumptionId, setSelectedConsumptionId] = useState<string>('');
  const [editingConsumption, setEditingConsumption] = useState<EnergyConsumption | null>(null);

  const houseTypeNames = useMemo(() => {
    const map = new Map<string, string>();
    store.houseTypes.forEach((h) => map.set(h.id, h.name));
    return map;
  }, [store.houseTypes]);

  const priceNames = useMemo(() => {
    const map = new Map<string, string>();
    store.prices.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [store.prices]);

  const selectedHouse = store.houseTypes.find((h) => h.id === selectedHouseType);
  const selectedConsumption = store.consumptions.find((c) => c.id === selectedConsumptionId);

  const getWeatherCorrectionEvidence = (consumption: EnergyConsumption) => {
    if (!consumption) return null;
    const actualWeather = store.weatherData.get(`${consumption.houseTypeId}-actual`) || [];
    const refWeather = store.weatherData.get(`${consumption.houseTypeId}-reference`) || [];
    const actualMonth = actualWeather.find((w) => w.month === consumption.month);
    const refMonth = refWeather.find((w) => w.month === consumption.month);
    if (actualMonth && refMonth) {
      return applyWeatherCorrection(consumption, actualMonth, refMonth);
    }
    return null;
  };

  const comparisonData = useMemo(() => {
    const monthlyMap = new Map<string, { month: number; [key: string]: number }>();
    store.consumptions.forEach((c) => {
      const key = `${c.houseTypeId}-${c.month}`;
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { month: c.month });
      }
      const houseName = houseTypeNames.get(c.houseTypeId) || c.houseTypeId;
      monthlyMap.get(key)![houseName] = c.weatherCorrectedConsumption || c.normalizedConsumption || c.kWhConsumed;
    });
    const allHouses = Array.from(new Set(store.consumptions.map((c) => houseTypeNames.get(c.houseTypeId) || c.houseTypeId)));
    return {
      data: Array.from(monthlyMap.values()).sort((a, b) => a.month - b.month),
      houses: allHouses,
    };
  }, [store.consumptions, houseTypeNames]);

  const annualComparison = useMemo(() => {
    const totals = new Map<string, { consumption: number; cost: number }>();
    store.consumptions.forEach((c) => {
      const key = houseTypeNames.get(c.houseTypeId) || c.houseTypeId;
      if (!totals.has(key)) {
        totals.set(key, { consumption: 0, cost: 0 });
      }
      const current = totals.get(key)!;
      current.consumption += c.weatherCorrectedConsumption || c.kWhConsumed;
      current.cost += c.estimatedCost || 0;
    });
    return Array.from(totals.entries()).map(([name, v]) => ({
      name,
      consumption: parseFloat(v.consumption.toFixed(0)),
      cost: parseFloat(v.cost.toFixed(0)),
    }));
  }, [store.consumptions, houseTypeNames]);

  const handleExportCSV = () => {
    const csv = store.exportConsumptionsAsCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `energy_comparison_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const json = store.exportConsumptionsAsJSON();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `energy_comparison_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'valid': return 'status-valid';
      case 'error': return 'status-error';
      case 'confirmed': return 'status-confirmed';
      case 'rejected': return 'status-rejected';
      default: return 'status-pending';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'valid': return '有效';
      case 'error': return '错误';
      case 'confirmed': return '已确认';
      case 'rejected': return '已拒绝';
      default: return '待处理';
    }
  };

  const getInsulationLabel = (level: string) => {
    switch (level) {
      case 'poor': return '差';
      case 'medium': return '中等';
      case 'good': return '良好';
      default: return level;
    }
  };

  const renderImportTab = () => (
    <>
      <div className="section">
        <h2 className="section-title">快速开始</h2>
        <div className="button-group">
          <button className="btn btn-primary" onClick={store.loadSampleData} disabled={store.loadingSample}>
            加载示例数据
          </button>
        </div>
        {store.loadingSample && (
          <div className="info-panel">
            <p className="panel-title">正在加载示例数据...</p>
          </div>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">能耗数据导入</h2>
        <div className="info-panel">
          <p className="panel-title">导入说明</p>
          <p>支持以下字段：houseTypeName(户型名称), priceName(电价方案), month(月份), year(年份), kWhConsumed(用电量), targetRoomTemp(目标室温)</p>
        </div>

        <div className="format-tabs">
          <button 
            className={`format-tab ${importFormat === 'csv' ? 'active' : ''}`}
            onClick={() => setImportFormat('csv')}
          >
            CSV格式
          </button>
          <button 
            className={`format-tab ${importFormat === 'json' ? 'active' : ''}`}
            onClick={() => setImportFormat('json')}
          >
            JSON格式
          </button>
        </div>

        <textarea
          className="textarea-import"
          value={importContent}
          onChange={(e) => setImportContent(e.target.value)}
          placeholder={importFormat === 'csv' 
            ? '粘贴CSV内容，例如：\nhouseTypeName,priceName,month,year,kWhConsumed,targetRoomTemp\n传统土坯房,居民阶梯电价,1,2024,480,20'
            : '粘贴JSON内容，例如：\n[{"houseTypeName":"传统土坯房","month":1,"year":2024,"kWhConsumed":480}]'
          }
        />

        <div className="example-buttons">
          <span style={{ fontSize: '12px', color: '#64748b' }}>示例数据：</span>
          <button className="example-btn" onClick={() => setImportContent(sampleValidCSV)}>
            正常数据
          </button>
          <button className="example-btn" onClick={() => setImportContent(sampleDuplicateCSV)}>
            重复数据
          </button>
          <button className="example-btn" onClick={() => setImportContent(sampleMissingFieldsCSV)}>
            缺字段
          </button>
          <button className="example-btn" onClick={() => setImportContent(sampleManualErrorCSV)}>
            人工改错
          </button>
          <button className="example-btn" onClick={() => setImportContent(sampleValidJSON)}>
            JSON格式
          </button>
        </div>

        <div className="button-group" style={{ marginTop: '20px' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => store.processImportData(importContent, importFormat)}
            disabled={!importContent.trim()}
          >
            解析数据
          </button>
          <button className="btn btn-secondary" onClick={() => setImportContent('')}>
            清空
          </button>
        </div>
      </div>

      {store.importRecords.length > 0 && (
        <>
          <div className="section">
            <h2 className="section-title">导入校验结果</h2>
            
            <div className="stats-row">
              <div className="stat-card">
                <p className="stat-card-value">{store.importRecords.length}</p>
                <p className="stat-card-label">总记录数</p>
              </div>
              <div className="stat-card">
                <p className="stat-card-value" style={{ color: '#27ae60' }}>
                  {store.importRecords.filter((r) => r.status === 'valid' || r.status === 'confirmed').length}
                </p>
                <p className="stat-card-label">有效/已确认</p>
              </div>
              <div className="stat-card">
                <p className="stat-card-value" style={{ color: '#e74c3c' }}>
                  {store.importRecords.filter((r) => r.status === 'error').length}
                </p>
                <p className="stat-card-label">有错误</p>
              </div>
              <div className="stat-card">
                <p className="stat-card-value" style={{ color: '#95a5a6' }}>
                  {store.importRecords.filter((r) => r.status === 'rejected').length}
                </p>
                <p className="stat-card-label">已拒绝</p>
              </div>
            </div>

            {store.validationErrors.length > 0 && (
              <div className="error-panel">
                <p className="panel-title">发现 {store.validationErrors.length} 个错误</p>
                <ul className="panel-list">
                  {store.validationErrors.slice(0, 5).map((e, i) => (
                    <li key={i}>
                      第{e.rowIndex}行 - {e.field}: {e.message}
                      {e.value !== undefined && ` (值: ${e.value})`}
                    </li>
                  ))}
                  {store.validationErrors.length > 5 && (
                    <li>...还有 {store.validationErrors.length - 5} 个错误</li>
                  )}
                </ul>
              </div>
            )}

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>行号</th>
                    <th>户型</th>
                    <th>月份</th>
                    <th>用电量(kWh)</th>
                    <th>目标室温(℃)</th>
                    <th>归一化能耗</th>
                    <th>天气校正后</th>
                    <th>预估费用</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {store.importRecords.map((record) => (
                    <tr key={record.rowIndex} className={
                      record.status === 'error' ? 'error-row' :
                      record.status === 'rejected' ? 'rejected-row' :
                      record.status === 'confirmed' ? 'confirmed-row' : ''
                    }>
                      <td>{record.rowIndex}</td>
                      <td>{record.parsed?.houseTypeId ? houseTypeNames.get(record.parsed.houseTypeId) : record.rawData.houseTypeName}</td>
                      <td>{record.parsed?.month || record.rawData.month}</td>
                      <td>{record.parsed?.kWhConsumed || record.rawData.kWhConsumed}</td>
                      <td>{record.parsed?.targetRoomTemp || record.rawData.targetRoomTemp}</td>
                      <td>{record.parsed?.normalizedConsumption || '-'}</td>
                      <td>{record.parsed?.weatherCorrectedConsumption || '-'}</td>
                      <td>{record.parsed?.estimatedCost ? `¥${record.parsed.estimatedCost}` : '-'}</td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(record.status)}`}>
                          {getStatusText(record.status)}
                        </span>
                      </td>
                      <td>
                        {record.status === 'valid' && (
                          <>
                            <button className="btn btn-success btn-small" onClick={() => store.confirmImportRecord(record.rowIndex)}>
                              确认
                            </button>
                            <button className="btn btn-danger btn-small" onClick={() => store.rejectImportRecord(record.rowIndex)}>
                              拒绝
                            </button>
                          </>
                        )}
                        {record.status === 'error' && (
                          <span style={{ color: '#e74c3c', fontSize: '12px' }}>
                            {record.validation.errors[0]?.message}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="button-group" style={{ marginTop: '20px' }}>
              <button 
                className="btn btn-success" 
                onClick={store.confirmAllImportRecords}
                disabled={store.importRecords.filter((r) => r.status === 'valid').length === 0}
              >
                确认全部有效
              </button>
              <button 
                className="btn btn-primary" 
                onClick={store.saveConfirmedRecords}
                disabled={store.importRecords.filter((r) => r.status === 'confirmed').length === 0}
              >
                保存已确认数据
              </button>
              <button className="btn btn-secondary" onClick={store.clearImportRecords}>
                清除导入缓存
              </button>
            </div>
          </div>

          {store.consumptions.length > 0 && (
            <div className="section">
              <h2 className="section-title">已保存的能耗数据</h2>
              <div className="flex-between" style={{ marginBottom: '16px' }}>
                <div>共 {store.consumptions.length} 条记录</div>
                <div className="button-group">
                  <button className="btn btn-secondary" onClick={handleExportCSV}>
                    导出CSV
                  </button>
                  <button className="btn btn-secondary" onClick={handleExportJSON}>
                    导出JSON
                  </button>
                </div>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>户型</th>
                      <th>电价方案</th>
                      <th>月份</th>
                      <th>原始能耗(kWh)</th>
                      <th>归一化(kWh)</th>
                      <th>天气校正后(kWh)</th>
                      <th>目标室温(℃)</th>
                      <th>预估费用</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.consumptions.map((c) => (
                      <tr 
                        key={c.id}
                        onClick={() => setSelectedConsumptionId(c.id)}
                        style={{ cursor: 'pointer' }}
                        className={selectedConsumptionId === c.id ? 'confirmed-row' : ''}
                      >
                        <td>{houseTypeNames.get(c.houseTypeId)}</td>
                        <td>{priceNames.get(c.electricityPriceId)}</td>
                        <td>{c.month}月</td>
                        <td>{c.kWhConsumed}</td>
                        <td>{c.normalizedConsumption || '-'}</td>
                        <td>{c.weatherCorrectedConsumption || '-'}</td>
                        <td>{c.targetRoomTemp}</td>
                        <td>¥{c.estimatedCost || '-'}</td>
                        <td>
                          <button className="btn btn-secondary btn-small" onClick={(e) => { e.stopPropagation(); setEditingConsumption(c); }}>
                            编辑
                          </button>
                          <button className="btn btn-danger btn-small" onClick={(e) => { e.stopPropagation(); store.deleteConsumption(c.id); }}>
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );

  const renderNormalizationTab = () => (
    <>
      <div className="section">
        <h2 className="section-title">户型归一化</h2>
        <div className="info-panel">
          <p className="panel-title">关键校验标准</p>
          <p>户型归一化基于：面积(基准100㎡)、保温等级(差/中等/良好)、建筑年限、楼层数</p>
          <p>归一化系数 = 面积系数 × 保温系数 × 年限系数 × 楼层系数</p>
        </div>

        <div className="grid-2">
          {store.houseTypes.map((house) => (
            <div key={house.id} className="house-card">
              <h3 className="house-name">{house.name}</h3>
              <div className="house-meta">
                <span className="house-meta-item">面积: {house.area}㎡</span>
                <span className="house-meta-item">保温: {getInsulationLabel(house.insulationLevel)}</span>
                <span className="house-meta-item">年限: {house.buildingAge}年</span>
                <span className="house-meta-item">楼层: {house.floorCount}层</span>
                <span className="house-meta-item">位置: {house.location}</span>
              </div>
              <div className="factor-display">
                <div>
                  <span className="factor-value">{house.normalizedFactor}</span>
                  <p className="factor-label">归一化系数</p>
                </div>
                <div style={{ marginLeft: '20px', fontSize: '12px', color: '#64748b' }}>
                  <p>面积系数: {(house.area / 100).toFixed(2)}</p>
                  <p>保温系数: {house.insulationLevel === 'poor' ? '1.30' : house.insulationLevel === 'medium' ? '1.00' : '0.80'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedHouse && (
        <div className="section">
          <h2 className="section-title">户型详情: {selectedHouse.name}</h2>
          <div className="info-panel">
            <p className="panel-title">归一化计算详情</p>
            <ul className="panel-list">
              <li>面积: {selectedHouse.area}㎡ → 系数: {(selectedHouse.area / 100).toFixed(2)}</li>
              <li>保温: {getInsulationLabel(selectedHouse.insulationLevel)} → 系数: {selectedHouse.insulationLevel === 'poor' ? '1.30' : selectedHouse.insulationLevel === 'medium' ? '1.00' : '0.80'}</li>
              <li>年限: {selectedHouse.buildingAge}年 → 系数: {selectedHouse.buildingAge < 10 ? '0.85' : selectedHouse.buildingAge < 20 ? '1.00' : selectedHouse.buildingAge < 40 ? '1.15' : '1.30'}</li>
              <li>楼层: {selectedHouse.floorCount}层 → 系数: {(1 + (selectedHouse.floorCount - 1) * 0.1).toFixed(2)}</li>
              <li><strong>总系数: {selectedHouse.normalizedFactor}</strong></li>
            </ul>
          </div>
        </div>
      )}

      <div className="section">
        <h2 className="section-title">户型选择</h2>
        <select 
          className="select-field"
          value={selectedHouseType}
          onChange={(e) => setSelectedHouseType(e.target.value)}
        >
          <option value="">选择户型查看详情</option>
          {store.houseTypes.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </div>
    </>
  );

  const renderWeatherTab = () => {
    const evidence = selectedConsumption ? getWeatherCorrectionEvidence(selectedConsumption) : null;

    return (
      <>
        <div className="section">
          <h2 className="section-title">天气校正证据</h2>
          <div className="info-panel">
            <p className="panel-title">校正原理</p>
            <p>基于实际年份天气与参考年份(2023年基准)的差异进行校正，考虑：温度差异、采暖度日数、太阳辐射、风速</p>
          </div>

          {store.consumptions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <p>暂无数据，请先导入能耗数据</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '14px', color: '#64748b', display: 'block', marginBottom: '8px' }}>
                  选择能耗记录查看天气校正详情：
                </label>
                <select 
                  className="select-field"
                  value={selectedConsumptionId}
                  onChange={(e) => setSelectedConsumptionId(e.target.value)}
                >
                  <option value="">选择记录</option>
                  {store.consumptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {houseTypeNames.get(c.houseTypeId)} - {c.month}月 ({c.kWhConsumed}kWh)
                    </option>
                  ))}
                </select>
              </div>

              {evidence && selectedConsumption && (
                <div className="weather-evidence">
                  <h4>天气校正详情</h4>
                  
                  <div className="before-after">
                    <div>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>原始能耗</p>
                      <p style={{ fontSize: '24px', fontWeight: '700', color: '#e74c3c', margin: '4px 0 0' }}>
                        {evidence.evidence.originalConsumption} kWh
                      </p>
                    </div>
                    <div className="before-after-arrow">→</div>
                    <div>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>校正后能耗</p>
                      <p style={{ fontSize: '24px', fontWeight: '700', color: '#27ae60', margin: '4px 0 0' }}>
                        {evidence.evidence.correctedConsumption} kWh
                      </p>
                    </div>
                  </div>

                  <div className="weather-grid">
                    <div className="weather-item">
                      <p className="weather-item-label">实际年份温度</p>
                      <p className="weather-item-value">{evidence.evidence.actualTemp}℃</p>
                    </div>
                    <div className="weather-item">
                      <p className="weather-item-label">参考年份温度</p>
                      <p className="weather-item-value">{evidence.evidence.referenceTemp}℃</p>
                    </div>
                    <div className="weather-item">
                      <p className="weather-item-label">温度差异</p>
                      <p className="weather-item-value" style={{ 
                        color: evidence.evidence.tempDiff > 0 ? '#27ae60' : evidence.evidence.tempDiff < 0 ? '#e74c3c' : '#0f4c75'
                      }}>
                        {evidence.evidence.tempDiff > 0 ? '+' : ''}{evidence.evidence.tempDiff}℃
                      </p>
                    </div>
                    <div className="weather-item">
                      <p className="weather-item-label">采暖度日数差异</p>
                      <p className="weather-item-value">{evidence.evidence.heatingDegreeDaysDiff > 0 ? '+' : ''}{evidence.evidence.heatingDegreeDaysDiff}</p>
                    </div>
                    <div className="weather-item">
                      <p className="weather-item-label">太阳辐射差异</p>
                      <p className="weather-item-value">{evidence.evidence.solarImpact > 0 ? '+' : ''}{evidence.evidence.solarImpact} W/m²</p>
                    </div>
                    <div className="weather-item">
                      <p className="weather-item-label">风速影响</p>
                      <p className="weather-item-value">{evidence.evidence.windImpact > 0 ? '+' : ''}{evidence.evidence.windImpact} m/s</p>
                    </div>
                    <div className="weather-item" style={{ gridColumn: 'span 2' }}>
                      <p className="weather-item-label">总校正系数</p>
                      <p className="weather-item-value" style={{ fontSize: '28px' }}>
                        × {evidence.evidence.totalCorrectionFactor}
                      </p>
                    </div>
                  </div>

                  {evidence.evidence.adjustmentDetails.length > 0 && (
                    <div className="weather-correction-summary">
                      <p style={{ fontWeight: '600', margin: '0 0 8px' }}>校正依据：</p>
                      <ul className="panel-list">
                        {evidence.evidence.adjustmentDetails.map((d, i) => (
                          <li key={i}>
                            <strong>{d.type}</strong> (系数: {d.factor.toFixed(4)}) - {d.impact}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {store.consumptions.length > 0 && (
          <div className="section">
            <h2 className="section-title">年度天气对比</h2>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={comparisonData.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" label={{ value: '月份', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: '能耗(kWh)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                {comparisonData.houses.map((house, i) => (
                  <Line 
                    key={house} 
                    type="monotone" 
                    dataKey={house} 
                    stroke={COLORS[i % COLORS.length]} 
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </>
    );
  };

  const renderComparisonTab = () => (
    <>
      <div className="section">
        <h2 className="section-title">能耗对比分析</h2>
        
        {store.consumptions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📈</div>
            <p>暂无数据，请先导入能耗数据进行对比分析</p>
          </div>
        ) : (
          <>
            <div className="comparison-summary">
              {annualComparison.map((item) => (
                <div key={item.name} className="compare-card">
                  <p className="compare-card-title">{item.name}</p>
                  <p className="compare-card-value">{item.consumption}</p>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0' }}>kWh/年</p>
                  <p className="compare-card-savings">¥{item.cost}/年</p>
                </div>
              ))}
            </div>

            <div className="chart-container">
              <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>年度能耗对比</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={annualComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="consumption" name="年能耗(kWh)" fill="#0f4c75" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-container">
              <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>年度费用对比</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={annualComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`¥${value}`, '费用']} />
                  <Legend />
                  <Bar dataKey="cost" name="年费用(元)" fill="#3282b8" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {annualComparison.length > 1 && (
              <div className="chart-container">
                <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>能耗占比</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={annualComparison}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="consumption"
                    >
                      {annualComparison.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="chart-container">
              <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>月度能耗趋势</h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={comparisonData.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" label={{ value: '月份', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: '能耗(kWh)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  {comparisonData.houses.map((house, i) => (
                    <Line 
                      key={house} 
                      type="monotone" 
                      dataKey={house} 
                      stroke={COLORS[i % COLORS.length]} 
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="section" style={{ marginTop: '24px' }}>
              <h2 className="section-title">电价方案模拟</h2>
              <div className="grid-3">
                {store.prices.map((price) => (
                  <div key={price.id} className="house-card">
                    <h3 className="house-name">{price.name}</h3>
                    <div className="house-meta">
                      <span className="house-meta-item">类型: {price.tier}</span>
                      {price.hasTimeOfUse ? (
                        <>
                          <span className="house-meta-item">峰时: ¥{price.peakPrice}/kWh</span>
                          <span className="house-meta-item">谷时: ¥{price.offPeakPrice}/kWh</span>
                        </>
                      ) : (
                        <span className="house-meta-item">统一: ¥{price.pricePerKWh}/kWh</span>
                      )}
                    </div>
                    <div className="factor-display">
                      <div>
                        <span className="factor-value">
                          ¥{price.hasTimeOfUse ? `${price.peakPrice}/${price.offPeakPrice}` : price.pricePerKWh}
                        </span>
                        <p className="factor-label">每kWh价格</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>🏠 热泵采暖能耗对比器</h1>
        <p>农村热泵采暖改造后，不同户型、室温、电价下的节能效果分析工具</p>
      </div>

      <div className="tab-navigation">
        <button 
          className={`tab-button ${store.currentTab === 'import' ? 'active' : ''}`}
          onClick={() => store.setCurrentTab('import')}
        >
          📥 数据导入
        </button>
        <button 
          className={`tab-button ${store.currentTab === 'normalization' ? 'active' : ''}`}
          onClick={() => store.setCurrentTab('normalization')}
        >
          🏗️ 户型归一
        </button>
        <button 
          className={`tab-button ${store.currentTab === 'weather' ? 'active' : ''}`}
          onClick={() => store.setCurrentTab('weather')}
        >
          🌤️ 天气校正
        </button>
        <button 
          className={`tab-button ${store.currentTab === 'comparison' ? 'active' : ''}`}
          onClick={() => store.setCurrentTab('comparison')}
        >
          📊 对比分析
        </button>
      </div>

      {store.currentTab === 'import' && renderImportTab()}
      {store.currentTab === 'normalization' && renderNormalizationTab()}
      {store.currentTab === 'weather' && renderWeatherTab()}
      {store.currentTab === 'comparison' && renderComparisonTab()}

      {editingConsumption && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="section" style={{ width: '500px', maxWidth: '90vw' }}>
            <h2 className="section-title">编辑能耗记录</h2>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                用电量(kWh)
              </label>
              <input 
                type="number"
                className="input-field"
                style={{ width: '100%' }}
                value={editingConsumption.kWhConsumed}
                onChange={(e) => setEditingConsumption({ 
                  ...editingConsumption, 
                  kWhConsumed: parseFloat(e.target.value) || 0 
                })}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                目标室温(℃)
              </label>
              <input 
                type="number"
                className="input-field"
                style={{ width: '100%' }}
                value={editingConsumption.targetRoomTemp}
                onChange={(e) => setEditingConsumption({ 
                  ...editingConsumption, 
                  targetRoomTemp: parseFloat(e.target.value) || 0 
                })}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                电价方案
              </label>
              <select 
                className="select-field"
                style={{ width: '100%' }}
                value={editingConsumption.electricityPriceId}
                onChange={(e) => setEditingConsumption({ 
                  ...editingConsumption, 
                  electricityPriceId: e.target.value 
                })}
              >
                {store.prices.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="button-group" style={{ marginTop: '20px' }}>
              <button className="btn btn-primary" onClick={() => {
                store.updateConsumption(editingConsumption.id, editingConsumption);
                setEditingConsumption(null);
              }}>
                保存
              </button>
              <button className="btn btn-secondary" onClick={() => setEditingConsumption(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
