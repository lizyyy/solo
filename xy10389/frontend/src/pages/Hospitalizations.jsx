import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { hospitalizationsAPI, masterDataAPI, exportAPI } from '../services/api';
import HospitalizationDetail from '../components/HospitalizationDetail';

function Hospitalizations() {
  const [hospitalizations, setHospitalizations] = useState([]);
  const [species, setSpecies] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    status: '',
    is_infectious: '',
    species_id: ''
  });

  const [selectedHosp, setSelectedHosp] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hospsRes, speciesRes, locationsRes] = await Promise.all([
        hospitalizationsAPI.getAll(),
        masterDataAPI.getSpecies(),
        masterDataAPI.getLocations()
      ]);
      setHospitalizations(hospsRes.data);
      setSpecies(speciesRes.data);
      setLocations(locationsRes.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredHosps = hospitalizations.filter(h => {
    if (filters.status && h.status !== filters.status) return false;
    if (filters.is_infectious !== '') {
      const filterVal = filters.is_infectious === 'true' ? 1 : 0;
      if (h.is_infectious !== filterVal) return false;
    }
    if (filters.species_id && h.species_id !== parseInt(filters.species_id)) return false;
    return true;
  });

  const getStatusLabel = (status) => {
    const labels = {
      active: '在院',
      discharged: '已出院',
      scheduled: '已预约'
    };
    return labels[status] || status;
  };

  const handleExport = async () => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      params.format = 'json';

      const response = await exportAPI.exportHospitalizations(params);
      const data = response.data;

      const csv = [
        ['住院号', '宠物', '种类', '笼位', '区域', '诊断', '传染病', '护理等级',
         '入院时间', '预计出院', '实际出院', '主治医生', '状态'].join(','),
        ...data.map(row => [
          row.admission_number,
          row.pet_name,
          row.species,
          row.cage_number,
          row.location || '',
          row.primary_diagnosis || '',
          row.is_infectious,
          row.care_level || '',
          row.admission_date || '',
          row.expected_discharge_date || '',
          row.actual_discharge_date || '',
          row.attending_vet || '',
          row.hospitalization_status
        ].join(','))
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `住院记录_${dayjs().format('YYYYMMDD')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败');
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="filter-bar">
        <div className="filter-group">
          <label>状态</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">全部状态</option>
            <option value="active">在院</option>
            <option value="discharged">已出院</option>
            <option value="scheduled">已预约</option>
          </select>
        </div>
        <div className="filter-group">
          <label>传染病</label>
          <select
            value={filters.is_infectious}
            onChange={(e) => setFilters({ ...filters, is_infectious: e.target.value })}
          >
            <option value="">全部</option>
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        </div>
        <div className="filter-group">
          <label>动物种类</label>
          <select
            value={filters.species_id}
            onChange={(e) => setFilters({ ...filters, species_id: e.target.value })}
          >
            <option value="">全部种类</option>
            {species.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-primary" onClick={handleExport}>
            📥 导出CSV
          </button>
          <button className="btn btn-secondary" onClick={loadData}>
            🔄 刷新
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3>
            住院记录
            <span style={{ marginLeft: '12px', fontSize: '13px', color: '#888' }}>
              共 {filteredHosps.length} 条记录
            </span>
          </h3>
        </div>

        {filteredHosps.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>住院号</th>
                <th>宠物</th>
                <th>种类</th>
                <th>笼位</th>
                <th>诊断</th>
                <th>传染病</th>
                <th>护理等级</th>
                <th>入院时间</th>
                <th>预计出院</th>
                <th>主治医生</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredHosps.map(h => (
                <tr key={h.id}>
                  <td style={{ fontWeight: '600' }}>{h.admission_number}</td>
                  <td>{h.pet_name}</td>
                  <td>{h.species_name}</td>
                  <td>
                    {h.cage_number}
                    {h.cage_is_isolation && (
                      <span className="cage-tag tag-infectious" style={{ marginLeft: '6px' }}>
                        隔离
                      </span>
                    )}
                  </td>
                  <td>{h.primary_diagnosis}</td>
                  <td>
                    {h.is_infectious ? (
                      <span className="cage-tag tag-infectious">{h.infectious_disease || '是'}</span>
                    ) : '否'}
                  </td>
                  <td>{h.care_level_name || '-'}</td>
                  <td>{dayjs(h.admission_date).format('MM-DD HH:mm')}</td>
                  <td>
                    {h.expected_discharge_date
                      ? dayjs(h.expected_discharge_date).format('MM-DD HH:mm')
                      : '-'}
                  </td>
                  <td>{h.attending_vet || '-'}</td>
                  <td>
                    <span className={`status-badge status-${h.status}`}>
                      {getStatusLabel(h.status)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                      onClick={() => setSelectedHosp(h.id)}
                    >
                      详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="icon">📋</div>
            <p>暂无住院记录</p>
          </div>
        )}
      </div>

      {selectedHosp && (
        <HospitalizationDetail
          hospId={selectedHosp}
          onClose={() => setSelectedHosp(null)}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}

export default Hospitalizations;
