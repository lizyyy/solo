import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tireApi, vehicleApi, exportToCSV } from '../api';
import { TireLifecycleDetail, STATUS_LABELS, STATUS_COLORS, EVENT_LABELS, Vehicle } from '../types';

const TireDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<TireLifecycleDetail | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const [detailData, vehiclesData] = await Promise.all([
        tireApi.getLifecycle(id),
        vehicleApi.getAll(),
      ]);
      setDetail(detailData);
      setVehicles(vehiclesData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    if (!id) return;
    try {
      switch (action) {
        case 'install':
          await tireApi.install(id, formData);
          break;
        case 'remove':
          await tireApi.remove(id, formData);
          break;
        case 'inspect':
          await tireApi.inspect(id, formData);
          break;
        case 'retread':
          await tireApi.sendToRetread(id, formData);
          break;
        case 'completeRetread':
          await tireApi.completeRetread(id, formData);
          break;
        case 'scrap':
          await tireApi.scrap(id, formData);
          break;
      }
      setActiveAction(null);
      setFormData({});
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || '操作失败');
    }
  };

  const handleExportEvents = () => {
    if (!detail) return;
    const exportData = detail.events.map(e => ({
      事件类型: EVENT_LABELS[e.event_type] || e.event_type,
      原因: e.reason || '-',
      检测结果: e.inspection_result || '-',
      检测备注: e.inspection_notes || '-',
      费用: e.cost || '-',
      操作人: e.performed_by || '-',
      操作时间: e.performed_at.split('T')[0],
      备注: e.notes || '-',
    }));
    exportToCSV(exportData, `轮胎_${detail.tire.serial_number}_事件记录`);
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
  }

  if (!detail) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>轮胎不存在</div>;
  }

  const { tire, events, totalCost, costBreakdown } = detail;

  const availableActions: { key: string; label: string; disabled?: boolean }[] = [];
  
  if (tire.current_status === 'in_stock') {
    availableActions.push({ key: 'install', label: '装车' });
    availableActions.push({ key: 'inspect', label: '检测' });
  }
  if (tire.current_status === 'installed') {
    availableActions.push({ key: 'remove', label: '拆下' });
  }
  if (['removed', 'inspection_passed', 'inspection_failed'].includes(tire.current_status)) {
    availableActions.push({ key: 'inspect', label: '检测' });
  }
  if (['inspection_passed', 'inspection_failed', 'in_stock'].includes(tire.current_status)) {
    availableActions.push({ key: 'retread', label: '送翻新' });
  }
  if (tire.current_status === 'retreading') {
    availableActions.push({ key: 'completeRetread', label: '完成翻新' });
  }
  if (tire.current_status !== 'scrapped') {
    availableActions.push({ key: 'scrap', label: '报废', disabled: ['installed', 'retreading'].includes(tire.current_status) });
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/tires')}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '14px',
            marginBottom: '12px',
          }}
        >
          ← 返回轮胎列表
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937', marginBottom: '8px' }}>
              轮胎生命周期详情
            </h2>
            <p style={{ color: '#6b7280', fontFamily: 'monospace' }}>胎号: {tire.serial_number}</p>
          </div>
          <button
            onClick={handleExportEvents}
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            📥 导出事件记录
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div>
          <div style={{ 
            background: 'white', 
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginBottom: '24px',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '20px' }}>
              基本信息
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>品牌</div>
                <div style={{ fontSize: '16px', fontWeight: 500 }}>{tire.brand}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>型号</div>
                <div style={{ fontSize: '16px', fontWeight: 500 }}>{tire.model}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>规格</div>
                <div style={{ fontSize: '16px', fontWeight: 500 }}>{tire.size}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>当前状态</div>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  backgroundColor: STATUS_COLORS[tire.current_status] + '20',
                  color: STATUS_COLORS[tire.current_status],
                }}>
                  {STATUS_LABELS[tire.current_status]}
                </span>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>累计费用</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#3b82f6' }}>¥{totalCost.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div style={{ 
            background: 'white', 
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '20px' }}>
              事件时间线
            </h3>
            {events.length === 0 ? (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
                暂无事件记录
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {events.map((event, index) => (
                  <div key={event.id} style={{
                    display: 'flex',
                    gap: '16px',
                    paddingBottom: index < events.length - 1 ? '16px' : 0,
                    borderBottom: index < events.length - 1 ? '1px solid #f3f4f6' : 'none',
                  }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#3b82f620',
                      color: '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '14px',
                      flexShrink: 0,
                    }}>
                      {events.length - index}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '15px' }}>
                          {EVENT_LABELS[event.event_type] || event.event_type}
                        </span>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          {new Date(event.performed_at).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
                        {event.reason && <div>原因: {event.reason}</div>}
                        {event.inspection_result && <div>检测结果: {event.inspection_result}</div>}
                        {event.inspection_notes && <div>检测备注: {event.inspection_notes}</div>}
                        {event.cost != null && <div>费用: ¥{event.cost.toFixed(2)}</div>}
                        {event.performed_by && <div>操作人: {event.performed_by}</div>}
                        {event.notes && <div>备注: {event.notes}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div style={{ 
            background: 'white', 
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginBottom: '24px',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '16px' }}>
              快捷操作
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {availableActions.map(action => (
                <button
                  key={action.key}
                  onClick={() => !action.disabled && setActiveAction(action.key)}
                  disabled={action.disabled}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: action.disabled ? '#f3f4f6' : '#eff6ff',
                    color: action.disabled ? '#9ca3af' : '#3b82f6',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: action.disabled ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    textAlign: 'left',
                  }}
                >
                  {action.label}
                </button>
              ))}
              {availableActions.length === 0 && (
                <div style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', padding: '10px' }}>
                  暂无可执行操作
                </div>
              )}
            </div>
          </div>

          {costBreakdown.length > 0 && (
            <div style={{ 
              background: 'white', 
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '16px' }}>
                费用明细
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {costBreakdown.map((item, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: index < costBreakdown.length - 1 ? '12px' : 0,
                    borderBottom: index < costBreakdown.length - 1 ? '1px solid #f3f4f6' : 'none',
                  }}>
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>
                      {EVENT_LABELS[item.type as keyof typeof EVENT_LABELS] || item.type}
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: 600 }}>¥{item.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '8px',
                  borderTop: '2px solid #e5e7eb',
                }}>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>合计</span>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: '#3b82f6' }}>¥{totalCost.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeAction && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '450px',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>
              {activeAction === 'install' && '装车'}
              {activeAction === 'remove' && '拆下'}
              {activeAction === 'inspect' && '检测'}
              {activeAction === 'retread' && '送翻新'}
              {activeAction === 'completeRetread' && '完成翻新'}
              {activeAction === 'scrap' && '报废'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {activeAction === 'install' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>选择车辆 *</label>
                    <select
                      value={formData.vehicle_id || ''}
                      onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">请选择车辆</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.plate_number} - {v.model}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>操作人</label>
                    <input
                      type="text"
                      value={formData.performed_by || ''}
                      onChange={(e) => setFormData({ ...formData, performed_by: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>备注</label>
                    <textarea
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </>
              )}

              {activeAction === 'remove' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>拆下原因 *</label>
                    <input
                      type="text"
                      value={formData.reason || ''}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      placeholder="例如: 花纹磨损、扎钉漏气等"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>操作人</label>
                    <input
                      type="text"
                      value={formData.performed_by || ''}
                      onChange={(e) => setFormData({ ...formData, performed_by: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>备注</label>
                    <textarea
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </>
              )}

              {activeAction === 'inspect' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>检测结果 *</label>
                    <select
                      value={formData.result || ''}
                      onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">请选择</option>
                      <option value="passed">通过</option>
                      <option value="failed">未通过</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>检测备注 *</label>
                    <textarea
                      value={formData.inspection_notes || ''}
                      onChange={(e) => setFormData({ ...formData, inspection_notes: e.target.value })}
                      placeholder="详细描述检测情况"
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>检测费用</label>
                    <input
                      type="number"
                      value={formData.cost || ''}
                      onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>操作人</label>
                    <input
                      type="text"
                      value={formData.performed_by || ''}
                      onChange={(e) => setFormData({ ...formData, performed_by: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                </>
              )}

              {activeAction === 'retread' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>翻新费用 *</label>
                    <input
                      type="number"
                      value={formData.cost || ''}
                      onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>操作人</label>
                    <input
                      type="text"
                      value={formData.performed_by || ''}
                      onChange={(e) => setFormData({ ...formData, performed_by: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>备注</label>
                    <textarea
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </>
              )}

              {activeAction === 'completeRetread' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>操作人</label>
                    <input
                      type="text"
                      value={formData.performed_by || ''}
                      onChange={(e) => setFormData({ ...formData, performed_by: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>备注</label>
                    <textarea
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </>
              )}

              {activeAction === 'scrap' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>报废原因 *</label>
                    <input
                      type="text"
                      value={formData.reason || ''}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      placeholder="例如: 胎侧鼓包、老化开裂等"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>操作人</label>
                    <input
                      type="text"
                      value={formData.performed_by || ''}
                      onChange={(e) => setFormData({ ...formData, performed_by: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>备注</label>
                    <textarea
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setActiveAction(null); setFormData({}); }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                取消
              </button>
              <button
                onClick={() => handleAction(activeAction)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TireDetail;
