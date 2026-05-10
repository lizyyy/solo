import React, { useState, useEffect } from 'react';

function Kitchens() {
  const [kitchens, setKitchens] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showKitchenModal, setShowKitchenModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [selectedKitchen, setSelectedKitchen] = useState(null);
  const [kitchenEquipments, setKitchenEquipments] = useState([]);
  const [kitchenForm, setKitchenForm] = useState({ name: '', location: '', capacity: 3 });
  const [teamForm, setTeamForm] = useState({ name: '', contact: '' });
  const [equipmentForm, setEquipmentForm] = useState({ name: '', type: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [kitchenRes, teamRes] = await Promise.all([
        fetch('/api/kitchens'),
        fetch('/api/reservations/teams')
      ]);
      setKitchens(await kitchenRes.json());
      setTeams(await teamRes.json());
    } catch (err) {
      console.error('获取数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddKitchen = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch('/api/kitchens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kitchenForm)
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '添加失败');
      }
      
      setSuccess('厨房添加成功！');
      setShowKitchenModal(false);
      setKitchenForm({ name: '', location: '', capacity: 3 });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddTeam = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch('/api/reservations/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamForm)
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '添加失败');
      }
      
      setSuccess('团队添加成功！');
      setShowTeamModal(false);
      setTeamForm({ name: '', contact: '' });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleViewEquipment = async (kitchen) => {
    setSelectedKitchen(kitchen);
    setShowEquipmentModal(true);
    try {
      const res = await fetch(`/api/kitchens/${kitchen.id}/equipments`);
      setKitchenEquipments(await res.json());
    } catch (err) {
      console.error('获取设备失败:', err);
    }
  };

  const handleAddEquipment = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!selectedKitchen) return;
    
    try {
      const res = await fetch(`/api/kitchens/${selectedKitchen.id}/equipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(equipmentForm)
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '添加设备失败');
      }
      
      setSuccess('设备添加成功！');
      setEquipmentForm({ name: '', type: '' });
      const equipmentsRes = await fetch(`/api/kitchens/${selectedKitchen.id}/equipments`);
      setKitchenEquipments(await equipmentsRes.json());
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>共享厨房档案</h2>
          <div className="flex-gap">
            <button 
              className="button button-secondary"
              onClick={() => setShowTeamModal(true)}
            >
              + 管理团队
            </button>
            <button 
              className="button button-primary"
              onClick={() => setShowKitchenModal(true)}
            >
              + 添加厨房
            </button>
          </div>
        </div>
        <div className="card-body">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          {kitchens.length === 0 ? (
            <div className="empty-state">
              <h3>暂无厨房档案</h3>
              <p>点击「添加厨房」开始建立基础档案</p>
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef3c7', borderRadius: '8px', textAlign: 'left', maxWidth: '500px', margin: '1rem auto' }}>
                <h4 style={{ color: '#92400e', marginBottom: '0.5rem' }}>快速开始指南</h4>
                <ol style={{ paddingLeft: '1.5rem', fontSize: '0.9rem', color: '#64748b' }}>
                  <li>添加一个共享厨房（如：中心厨房A)</li>
                  <li>为厨房添加设备（如：烤箱、炸炉等）</li>
                  <li>添加餐饮团队（如：美味川菜、粤式茶点等）</li>
                  <li>到「预约管理」创建第一个预约</li>
                </ol>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {kitchens.map(k => (
                <div key={k.id} style={{ padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  <div className="flex-between mb-2">
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{k.name}</h3>
                    <span className={`badge badge-${k.status === 'active' ? 'approved' : 'draft'}`}>
                      {k.status}
                    </span>
                  </div>
                  {k.location && (
                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
                      位置: {k.location}
                    </p>
                  )}
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                    容量: {k.capacity} 个团队同时使用
                  </p>
                  <button
                    className="button button-secondary button-sm"
                    onClick={() => handleViewEquipment(k)}
                  >
                    管理设备
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>餐饮团队</h2>
        </div>
        <div className="card-body">
          {teams.length === 0 ? (
            <p style={{ color: '#64748b' }}>暂无团队数据</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>团队名称</th>
                  <th>联系方式</th>
                </tr>
              </thead>
              <tbody>
                {teams.map(t => (
                  <tr key={t.id}>
                    <td>#{t.id}</td>
                    <td>{t.name}</td>
                    <td>{t.contact || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showKitchenModal && (
        <div className="modal-backdrop" onClick={() => setShowKitchenModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>添加共享厨房</h3>
              <button className="modal-close" onClick={() => setShowKitchenModal(false)}>×</button>
            </div>
            <form className="modal-body" onSubmit={handleAddKitchen}>
              <div className="form">
                <div className="form-group">
                  <label>厨房名称 *</label>
                  <input
                    type="text"
                    value={kitchenForm.name}
                    onChange={(e) => setKitchenForm({ ...kitchenForm, name: e.target.value })}
                    placeholder="如：中心厨房A"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>位置</label>
                  <input
                    type="text"
                    value={kitchenForm.location}
                    onChange={(e) => setKitchenForm({ ...kitchenForm, location: e.target.value })}
                    placeholder="如：1楼东区"
                  />
                </div>
                <div className="form-group">
                  <label>同时使用容量</label>
                  <input
                    type="number"
                    min="1"
                    value={kitchenForm.capacity}
                    onChange={(e) => setKitchenForm({ ...kitchenForm, capacity: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="button button-secondary" onClick={() => setShowKitchenModal(false)}>
                  取消
                </button>
                <button type="submit" className="button button-primary">
                  添加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTeamModal && (
        <div className="modal-backdrop" onClick={() => setShowTeamModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>添加餐饮团队</h3>
              <button className="modal-close" onClick={() => setShowTeamModal(false)}>×</button>
            </div>
            <form className="modal-body" onSubmit={handleAddTeam}>
              <div className="form">
                <div className="form-group">
                  <label>团队名称 *</label>
                  <input
                    type="text"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                    placeholder="如：美味川菜"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>联系方式</label>
                  <input
                    type="text"
                    value={teamForm.contact}
                    onChange={(e) => setTeamForm({ ...teamForm, contact: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="button button-secondary" onClick={() => setShowTeamModal(false)}>
                  取消
                </button>
                <button type="submit" className="button button-primary">
                  添加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEquipmentModal && selectedKitchen && (
        <div className="modal-backdrop" onClick={() => setShowEquipmentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedKitchen.name} - 设备管理</h3>
              <button className="modal-close" onClick={() => setShowEquipmentModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {kitchenEquipments.length === 0 ? (
                <p style={{ color: '#64748b', marginBottom: '1rem' }}>暂无设备</p>
              ) : (
                <table className="table" style={{ marginBottom: '1.5rem' }}>
                  <thead>
                    <tr>
                      <th>设备名称</th>
                      <th>类型</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kitchenEquipments.map(e => (
                      <tr key={e.id}>
                        <td>{e.name}</td>
                        <td>{e.type || '-'}</td>
                        <td>
                          <span className={`badge badge-${e.status === 'available' ? 'approved' : 'draft'}`}>
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              
              <h4 style={{ marginBottom: '1rem' }}>添加新设备</h4>
              <form onSubmit={handleAddEquipment} className="form">
                <div className="form-row">
                  <div className="form-group">
                    <label>设备名称 *</label>
                    <input
                      type="text"
                      value={equipmentForm.name}
                      onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })}
                      placeholder="如：大型烤箱"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>类型</label>
                    <input
                      type="text"
                      value={equipmentForm.type}
                      onChange={(e) => setEquipmentForm({ ...equipmentForm, type: e.target.value })}
                      placeholder="如：烘焙设备"
                    />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button type="submit" className="button button-primary">
                    添加设备
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Kitchens;
