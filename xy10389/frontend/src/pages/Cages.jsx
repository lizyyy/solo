import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { cagesAPI, hospitalizationsAPI, masterDataAPI, alertsAPI } from '../services/api';
import HospitalizationDetail from '../components/HospitalizationDetail';
import CageDetailModal from '../components/CageDetailModal';

function Cages() {
  const [cages, setCages] = useState([]);
  const [hospitalizations, setHospitalizations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    location_id: '',
    is_isolation: '',
    status: ''
  });

  const [selectedCage, setSelectedCage] = useState(null);
  const [selectedHosp, setSelectedHosp] = useState(null);
  const [showCageModal, setShowCageModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cagesRes, hospsRes, locationsRes, alertsRes] = await Promise.all([
        cagesAPI.getAll(),
        hospitalizationsAPI.getAll({ status: 'active' }),
        masterDataAPI.getLocations(),
        alertsAPI.getAll({ is_resolved: false })
      ]);

      setCages(cagesRes.data);
      setHospitalizations(hospsRes.data);
      setLocations(locationsRes.data);
      setAlerts(alertsRes.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCages = cages.filter(cage => {
    if (filters.location_id && cage.location_id !== parseInt(filters.location_id)) return false;
    if (filters.is_isolation !== '') {
      const filterVal = filters.is_isolation === 'true' ? 1 : 0;
      if (cage.is_isolation !== filterVal) return false;
    }
    return true;
  });

  const getCageOccupancy = (cageId) => {
    return hospitalizations.filter(h => h.cage_id === cageId);
  };

  const getCageStatus = (cage, occupancies) => {
    if (cage.is_isolation) return 'isolation';
    if (occupancies.length > 0) return 'occupied';
    return 'available';
  };

  const getStatusLabel = (status) => {
    const labels = {
      available: '空闲',
      occupied: '占用',
      isolation: '隔离区'
    };
    return labels[status] || status;
  };

  const handleCageClick = async (cage) => {
    setSelectedCage(null);
    try {
      const response = await cagesAPI.getById(cage.id);
      setSelectedCage(response.data);
      setShowCageModal(true);
    } catch (error) {
      console.error('加载笼位详情失败:', error);
    }
  };

  const handleHospClick = (hospId) => {
    setSelectedHosp(hospId);
    setShowCageModal(false);
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  const cagesByLocation = {};
  filteredCages.forEach(cage => {
    const locName = cage.location_name || '未分区';
    if (!cagesByLocation[locName]) {
      cagesByLocation[locName] = [];
    }
    cagesByLocation[locName].push(cage);
  });

  return (
    <div>
      <div className="filter-bar">
        <div className="filter-group">
          <label>区域</label>
          <select
            value={filters.location_id}
            onChange={(e) => setFilters({ ...filters, location_id: e.target.value })}
          >
            <option value="">全部区域</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>隔离类型</label>
          <select
            value={filters.is_isolation}
            onChange={(e) => setFilters({ ...filters, is_isolation: e.target.value })}
          >
            <option value="">全部</option>
            <option value="true">隔离笼位</option>
            <option value="false">普通笼位</option>
          </select>
        </div>
        <div className="filter-group">
          <button className="btn btn-secondary" onClick={loadData}>
            🔄 刷新
          </button>
        </div>
      </div>

      {Object.entries(cagesByLocation).map(([location, locationCages]) => (
        <div key={location} style={{ marginBottom: '32px' }}>
          <h3 style={{ marginBottom: '16px', color: '#333', fontSize: '16px' }}>
            📍 {location}
            <span style={{ marginLeft: '12px', fontSize: '13px', color: '#888' }}>
              共 {locationCages.length} 个笼位
            </span>
          </h3>

          <div className="cage-board">
            {locationCages.map(cage => {
              const occupancies = getCageOccupancy(cage.id);
              const status = getCageStatus(cage, occupancies);
              const hasAlert = alerts.some(a => {
                const hosp = hospitalizations.find(h => h.id === a.hospitalization_id);
                return hosp && hosp.cage_id === cage.id;
              });

              return (
                <div
                  key={cage.id}
                  className="cage-card"
                  onClick={() => handleCageClick(cage)}
                >
                  <div className="cage-header">
                    <span className="cage-number">
                      {cage.cage_number}
                      {hasAlert && <span style={{ marginLeft: '4px' }}>🔔</span>}
                    </span>
                    <span className={`cage-status ${status}`}>
                      {getStatusLabel(status)}
                    </span>
                  </div>

                  <div className="cage-body">
                    <div className="cage-location">
                      {cage.location_name}
                      {cage.is_isolation && (
                        <span className="cage-tag tag-infectious" style={{ marginLeft: '8px' }}>
                          隔离
                        </span>
                      )}
                    </div>

                    {occupancies.length > 0 ? (
                      occupancies.map(hosp => (
                        <div
                          key={hosp.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHospClick(hosp.id);
                          }}
                        >
                          <div className="cage-pet">{hosp.pet_name} ({hosp.species_name})</div>
                          <div className="cage-diagnosis">{hosp.primary_diagnosis}</div>
                          <div className="cage-tags">
                            {hosp.is_infectious && (
                              <span className="cage-tag tag-infectious">传染病</span>
                            )}
                            {hosp.care_level_name && (
                              <span className="cage-tag tag-care">{hosp.care_level_name}</span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
                            入院: {dayjs(hosp.admission_date).format('MM-DD HH:mm')}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '10px' }}>
                        空闲中
                      </div>
                    )}
                  </div>

                  {cage.notes && (
                    <div className="future-reservation">
                      {cage.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {showCageModal && selectedCage && (
        <CageDetailModal
          cage={selectedCage.cage}
          currentHosp={selectedCage.currentHosp}
          futureReservations={selectedCage.futureReservations}
          history={selectedCage.history}
          onClose={() => setShowCageModal(false)}
          onViewHosp={handleHospClick}
        />
      )}

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

export default Cages;
