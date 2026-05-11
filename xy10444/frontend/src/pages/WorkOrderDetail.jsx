import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workOrdersAPI, materialsAPI } from '../api.js';

function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workOrder, setWorkOrder] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('info');

  const [takeModal, setTakeModal] = useState(false);
  const [consumeModal, setConsumeModal] = useState(false);
  const [returnModal, setReturnModal] = useState(false);

  const [takeForm, setTakeForm] = useState([]);
  const [consumeForm, setConsumeForm] = useState([]);
  const [returnForm, setReturnForm] = useState([]);

  const loadWorkOrder = async () => {
    try {
      const response = await workOrdersAPI.getById(id);
      if (response.data.success) {
        setWorkOrder(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMaterials = async () => {
    try {
      const response = await materialsAPI.getAll();
      if (response.data.success) {
        setMaterials(response.data.data);
      }
    } catch (err) {
      console.error('加载材料失败:', err);
    }
  };

  useEffect(() => {
    loadWorkOrder();
    loadMaterials();
  }, [id]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const openTakeModal = () => {
    const availableMaterials = materials.filter(m => m.stock > 0);
    setTakeForm(availableMaterials.map(m => ({
      materialId: m._id,
      materialName: m.name,
      unit: m.unit,
      unitPrice: m.unitPrice,
      stock: m.stock,
      quantityTaken: 0
    })));
    setTakeModal(true);
  };

  const openConsumeModal = () => {
    if (!workOrder?.materials?.length) {
      alert('该工单尚未领用任何材料');
      return;
    }
    setConsumeForm(workOrder.materials.map(m => ({
      materialId: m.materialId,
      materialName: m.materialName,
      unit: m.unit,
      quantityTaken: m.quantityTaken,
      quantityUsed: m.quantityUsed,
      quantityReturned: m.quantityReturned,
      available: m.balance,
      newQuantityUsed: m.quantityUsed
    })));
    setConsumeModal(true);
  };

  const openReturnModal = () => {
    if (!workOrder?.materials?.length) {
      alert('该工单尚未领用任何材料');
      return;
    }
    const hasBalance = workOrder.materials.some(m => m.balance > 0);
    if (!hasBalance) {
      alert('没有可退回的材料');
      return;
    }
    setReturnForm(workOrder.materials
      .filter(m => m.balance > 0)
      .map(m => ({
        materialId: m.materialId,
        materialName: m.materialName,
        unit: m.unit,
        balance: m.balance,
        quantityReturned: 0
      })));
    setReturnModal(true);
  };

  const handleTakeMaterials = async (e) => {
    e.preventDefault();
    const selected = takeForm.filter(m => m.quantityTaken > 0);
    if (selected.length === 0) {
      alert('请至少选择一种材料并填写数量');
      return;
    }
    try {
      await workOrdersAPI.takeMaterials(id, { materials: selected });
      setTakeModal(false);
      setSuccess('材料领用成功');
      loadWorkOrder();
      loadMaterials();
    } catch (err) {
      alert('领用失败: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleConsumeMaterials = async (e) => {
    e.preventDefault();
    try {
      const materials = consumeForm.map(m => ({
        materialId: m.materialId,
        quantityUsed: m.newQuantityUsed
      }));
      await workOrdersAPI.consumeMaterials(id, { materials });
      setConsumeModal(false);
      setSuccess('材料消耗登记成功');
      loadWorkOrder();
    } catch (err) {
      alert('登记失败: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleReturnMaterials = async (e) => {
    e.preventDefault();
    const selected = returnForm.filter(m => m.quantityReturned > 0);
    if (selected.length === 0) {
      alert('请至少选择一种材料并填写退回数量');
      return;
    }
    try {
      await workOrdersAPI.returnMaterials(id, { materials: selected });
      setReturnModal(false);
      setSuccess('材料退回成功');
      loadWorkOrder();
      loadMaterials();
    } catch (err) {
      alert('退回失败: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleConfirm = async () => {
    const confirmedBy = prompt('请输入确认人姓名:');
    if (!confirmedBy) return;
    try {
      await workOrdersAPI.confirm(id, { confirmedBy });
      setSuccess('业主确认成功');
      loadWorkOrder();
    } catch (err) {
      alert('确认失败: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSettle = async () => {
    if (!window.confirm('确认进行结算？结算后将生成核销记录，且不可重复核销。')) {
      return;
    }
    try {
      const response = await workOrdersAPI.settle(id);
      if (response.data.success) {
        setSuccess(response.data.message || '结算成功');
        loadWorkOrder();
      }
    } catch (err) {
      alert('结算失败: ' + (err.response?.data?.message || err.message));
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      '待处理': 'badge-pending',
      '处理中': 'badge-progress',
      '待确认': 'badge-confirm',
      '已完成': 'badge-completed',
      '已取消': 'badge-cancelled'
    };
    return badges[status] || 'badge-cancelled';
  };

  if (loading) return <div className="empty-state">加载中...</div>;
  if (!workOrder) return <div className="empty-state">工单不存在</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm mr-2" onClick={() => navigate(-1)}>
            ← 返回
          </button>
          <span className="page-title">
            工单详情: <span className="number">{workOrder.orderNumber}</span>
          </span>
        </div>
        <span className={`badge ${getStatusBadge(workOrder.status)}`} style={{ fontSize: '1rem', padding: '0.4rem 1rem' }}>
          {workOrder.status}
        </span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="card-body">
          <div className="tabs">
            <div className={`tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>
              基本信息
            </div>
            <div className={`tab ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>
              材料管理
            </div>
            <div className={`tab ${activeTab === 'settlement' ? 'active' : ''}`} onClick={() => setActiveTab('settlement')}>
              结算信息
            </div>
          </div>

          {activeTab === 'info' && (
            <div>
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">工单号</div>
                  <div className="detail-value number">{workOrder.orderNumber}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">维修类型</div>
                  <div className="detail-value">{workOrder.repairType}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">维修类别</div>
                  <div className="detail-value">
                    <span className={`badge ${workOrder.repairCategory === '公共区域' ? 'badge-public' : 'badge-private'}`}>
                      {workOrder.repairCategory}
                    </span>
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">维修地点</div>
                  <div className="detail-value">{workOrder.location}</div>
                </div>
                {workOrder.houseNumber && (
                  <div className="detail-item">
                    <div className="detail-label">房号</div>
                    <div className="detail-value">{workOrder.houseNumber}</div>
                  </div>
                )}
                <div className="detail-item">
                  <div className="detail-label">报修人</div>
                  <div className="detail-value">{workOrder.reporterName}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">联系电话</div>
                  <div className="detail-value">{workOrder.reporterPhone || '-'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">维修师傅</div>
                  <div className="detail-value">{workOrder.technician}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">业主确认</div>
                  <div className="detail-value">
                    {workOrder.ownerConfirmed ? (
                      <span className="badge badge-completed">
                        已确认 ({workOrder.confirmedBy})
                      </span>
                    ) : (
                      <span className="badge badge-pending">未确认</span>
                    )}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">结算状态</div>
                  <div className="detail-value">
                    {workOrder.settled ? (
                      <span className={`badge ${workOrder.settlementType === '业主付费' ? 'badge-owner' : workOrder.settlementType === '公共维修基金' ? 'badge-fund' : 'badge-cancelled'}`}>
                        {workOrder.settlementType}
                      </span>
                    ) : (
                      <span className="badge badge-pending">未结算</span>
                    )}
                  </div>
                </div>
              </div>
              {workOrder.description && (
                <div className="detail-item">
                  <div className="detail-label">问题描述</div>
                  <div className="detail-value">{workOrder.description}</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'materials' && (
            <div>
              <div className="mb-4">
                <button 
                  className="btn btn-primary btn-sm mr-2"
                  onClick={openTakeModal}
                  disabled={['已完成', '已取消'].includes(workOrder.status)}
                >
                  + 领用材料
                </button>
                <button 
                  className="btn btn-secondary btn-sm mr-2"
                  onClick={openConsumeModal}
                  disabled={['已完成', '已取消'].includes(workOrder.status)}
                >
                  📝 登记消耗
                </button>
                <button 
                  className="btn btn-warning btn-sm"
                  onClick={openReturnModal}
                  disabled={['已完成', '已取消'].includes(workOrder.status)}
                >
                  ↩️ 退回材料
                </button>
              </div>

              {workOrder.materials && workOrder.materials.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>材料名称</th>
                        <th>单位</th>
                        <th>单价</th>
                        <th>领用数量</th>
                        <th>实际消耗</th>
                        <th>已退回</th>
                        <th>领退差额</th>
                        <th>消耗金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workOrder.materials.map((m, i) => (
                        <tr key={i}>
                          <td>{m.materialName}</td>
                          <td>{m.unit}</td>
                          <td className="number">¥{m.unitPrice.toFixed(2)}</td>
                          <td className="number">{m.quantityTaken}</td>
                          <td className="number">{m.quantityUsed}</td>
                          <td className="number">{m.quantityReturned}</td>
                          <td className="number">
                            <span className={m.balance > 0 ? 'badge badge-warning' : ''}>
                              {m.balance}
                              {m.balance > 0 && ' (待退)'}
                            </span>
                          </td>
                          <td className="number">¥{(m.quantityUsed * m.unitPrice).toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="totals-row">
                        <td colSpan="7" style={{ textAlign: 'right' }}>合计金额</td>
                        <td className="number">¥{workOrder.totalAmount?.toFixed(2) || '0.00'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">尚未领用任何材料</div>
              )}

              {workOrder.materials && workOrder.materials.some(m => m.balance > 0) && (
                <div className="alert alert-warning mt-4">
                  ⚠️ 部分材料存在领退差额（未使用完也未退回），请在结算前处理完毕。
                </div>
              )}
            </div>
          )}

          {activeTab === 'settlement' && (
            <div>
              {workOrder.settled ? (
                <div>
                  <div className="section-title">结算记录</div>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <div className="detail-label">结算类型</div>
                      <div className="detail-value">
                        <span className={`badge ${workOrder.settlementType === '业主付费' ? 'badge-owner' : workOrder.settlementType === '公共维修基金' ? 'badge-fund' : 'badge-cancelled'}`}>
                          {workOrder.settlementType}
                        </span>
                      </div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">结算时间</div>
                      <div className="detail-value">
                        {workOrder.settledAt ? new Date(workOrder.settledAt).toLocaleString() : '-'}
                      </div>
                    </div>
                  </div>
                  <div className="summary-box">
                    <span className="summary-label">结算总金额</span>
                    <span className="summary-value">¥{workOrder.totalAmount?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="section-title">结算操作</div>
                  
                  {workOrder.materials && workOrder.materials.length === 0 && (
                    <div className="alert alert-warning">
                      该工单尚未领用任何材料，结算后将直接标记为完成。
                    </div>
                  )}
                  
                  {workOrder.materials && workOrder.materials.some(m => m.balance > 0) && (
                    <div className="alert alert-warning">
                      ⚠️ 存在未退回的材料差额，请先处理退料后再结算。
                    </div>
                  )}

                  {!workOrder.ownerConfirmed && (
                    <div className="alert alert-error">
                      ⚠️ 业主确认前不能结算，请先进行业主确认。
                    </div>
                  )}

                  <div className="mb-4" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-success"
                      onClick={handleConfirm}
                      disabled={workOrder.ownerConfirmed}
                    >
                      {workOrder.ownerConfirmed ? '✓ 已业主确认' : '✅ 业主确认'}
                    </button>
                    <button 
                      className="btn btn-primary"
                      onClick={handleSettle}
                      disabled={!workOrder.ownerConfirmed}
                    >
                      💰 生成结算
                    </button>
                  </div>

                  <div className="alert alert-warning">
                    <strong>重要提示：</strong>
                    <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                      <li>业主确认前不能进行结算</li>
                      <li>重复核销不会增加费用</li>
                      <li>公共区域维修走"公共维修基金"</li>
                      <li>住户自费维修走"业主付费"</li>
                    </ul>
                  </div>

                  {workOrder.totalAmount > 0 && (
                    <div className="summary-box">
                      <span className="summary-label">预计结算金额</span>
                      <span className="summary-value">¥{workOrder.totalAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {takeModal && (
        <div className="modal-overlay" onClick={() => setTakeModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">领用材料</h3>
              <button className="modal-close" onClick={() => setTakeModal(false)}>&times;</button>
            </div>
            <form className="modal-body" onSubmit={handleTakeMaterials}>
              <div className="alert alert-warning">
                填写需要领用的数量，0表示不领用该材料
              </div>
              <div className="table-container">
                <table className="material-table">
                  <thead>
                    <tr>
                      <th>材料名称</th>
                      <th>单位</th>
                      <th>库存</th>
                      <th>领用数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {takeForm.map((m, i) => (
                      <tr key={i}>
                        <td>{m.materialName}</td>
                        <td>{m.unit}</td>
                        <td className="number">{m.stock}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={m.stock}
                            className="material-input"
                            value={m.quantityTaken}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              const newForm = [...takeForm];
                              newForm[i].quantityTaken = Math.min(val, m.stock);
                              setTakeForm(newForm);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setTakeModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  确认领用
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {consumeModal && (
        <div className="modal-overlay" onClick={() => setConsumeModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">登记实际消耗</h3>
              <button className="modal-close" onClick={() => setConsumeModal(false)}>&times;</button>
            </div>
            <form className="modal-body" onSubmit={handleConsumeMaterials}>
              <div className="alert alert-warning">
                填写实际使用的数量，不能超过当前可用数量（领用 - 已用 - 已退）
              </div>
              <div className="table-container">
                <table className="material-table">
                  <thead>
                    <tr>
                      <th>材料名称</th>
                      <th>领用</th>
                      <th>已用</th>
                      <th>已退</th>
                      <th>可用</th>
                      <th>实际消耗</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumeForm.map((m, i) => (
                      <tr key={i}>
                        <td>{m.materialName}</td>
                        <td className="number">{m.quantityTaken}</td>
                        <td className="number">{m.quantityUsed}</td>
                        <td className="number">{m.quantityReturned}</td>
                        <td className="number">{m.available}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={m.quantityTaken - m.quantityReturned}
                            className="material-input"
                            value={m.newQuantityUsed}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              const maxVal = m.quantityTaken - m.quantityReturned;
                              const newForm = [...consumeForm];
                              newForm[i].newQuantityUsed = Math.min(Math.max(val, 0), maxVal);
                              setConsumeForm(newForm);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setConsumeModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  确认登记
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {returnModal && (
        <div className="modal-overlay" onClick={() => setReturnModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">退回剩余材料</h3>
              <button className="modal-close" onClick={() => setReturnModal(false)}>&times;</button>
            </div>
            <form className="modal-body" onSubmit={handleReturnMaterials}>
              <div className="alert alert-warning">
                填写退回仓库的数量，不能超过当前差额（领用 - 已用 - 已退）
              </div>
              <div className="table-container">
                <table className="material-table">
                  <thead>
                    <tr>
                      <th>材料名称</th>
                      <th>单位</th>
                      <th>可退回</th>
                      <th>退回数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnForm.map((m, i) => (
                      <tr key={i}>
                        <td>{m.materialName}</td>
                        <td>{m.unit}</td>
                        <td className="number">{m.balance}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={m.balance}
                            className="material-input"
                            value={m.quantityReturned}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              const newForm = [...returnForm];
                              newForm[i].quantityReturned = Math.min(val, m.balance);
                              setReturnForm(newForm);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setReturnModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-warning">
                  确认退回
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkOrderDetail;
