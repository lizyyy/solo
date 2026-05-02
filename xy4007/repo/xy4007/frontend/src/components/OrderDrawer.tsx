import React, { useState, useEffect } from 'react';
import { X, Phone, Smartphone, Clock, User, Wrench, DollarSign, MessageSquare, ArrowRight, Send } from 'lucide-react';
import type { Order, OrderStatus, Technician, UpdateOrderRequest } from '../types';
import { STATUS_FLOW, STATUS_LABELS } from '../constants/statusFlow';
import { orderApi } from '../services/api';

interface OrderDrawerProps {
  order: Order | null;
  technicians: Technician[];
  onClose: () => void;
  onUpdate: () => void;
}

export function OrderDrawer({ order, technicians, onClose, onUpdate }: OrderDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingNote, setIsLoadingNote] = useState(false);
  const [formData, setFormData] = useState<UpdateOrderRequest>({});
  const [orderDetail, setOrderDetail] = useState<Order | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [showStatusNoteInput, setShowStatusNoteInput] = useState<OrderStatus | null>(null);

  useEffect(() => {
    if (order) {
      fetchOrderDetail(order.id);
    }
  }, [order]);

  const fetchOrderDetail = async (orderId: number) => {
    try {
      const detail = await orderApi.getOrderById(orderId);
      setOrderDetail(detail);
    } catch (error) {
      console.error('获取工单详情失败:', error);
    }
  };

  const displayOrder = orderDetail || order;

  useEffect(() => {
    if (displayOrder) {
      setFormData({
        customer_name: displayOrder.customer_name,
        customer_phone: displayOrder.customer_phone,
        device_brand: displayOrder.device_brand,
        device_model: displayOrder.device_model,
        device_imei: displayOrder.device_imei,
        technician_id: displayOrder.technician_id || null,
        fault_description: displayOrder.fault_description,
        quote: displayOrder.quote ?? null,
        estimated_completion_time: displayOrder.estimated_completion_time || null,
        status: displayOrder.status
      });
    }
  }, [displayOrder]);

  if (!displayOrder) return null;

  const nextStatuses = STATUS_FLOW[displayOrder.status] || [];

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleString('zh-CN');
  };

  const handleUpdateStatus = async (newStatus: OrderStatus, note?: string) => {
    try {
      setIsSaving(true);
      await orderApi.updateStatus(displayOrder.id, newStatus, note || undefined);
      setShowStatusNoteInput(null);
      setStatusNote('');
      fetchOrderDetail(displayOrder.id);
      onUpdate();
    } catch (error) {
      alert(error instanceof Error ? error.message : '更新状态失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      setIsSaving(true);
      await orderApi.updateOrder(displayOrder.id, formData);
      setIsEditing(false);
      fetchOrderDetail(displayOrder.id);
      onUpdate();
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      setIsLoadingNote(true);
      await orderApi.addNote(displayOrder.id, newNote.trim());
      setNewNote('');
      fetchOrderDetail(displayOrder.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : '添加备注失败');
    } finally {
      setIsLoadingNote(false);
    }
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | number | undefined | null }) => (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50">
      <Icon className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs text-gray-500">{label}</span>
        <p className="text-sm font-medium text-gray-900 truncate">
          {value !== undefined && value !== null ? String(value) : '-'}
        </p>
      </div>
    </div>
  );

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white">
          <div>
            <h2 className="text-lg font-bold text-gray-900">工单 #{displayOrder.id}</h2>
            <span className={`status-badge status-${displayOrder.status} mt-1`}>
              {displayOrder.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                编辑
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {nextStatuses.length > 0 && (
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 mb-2">推进状态</p>
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map(status => (
                <div key={status} className="relative">
                  {showStatusNoteInput === status ? (
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow">
                      <input
                        type="text"
                        value={statusNote}
                        onChange={(e) => setStatusNote(e.target.value)}
                        placeholder="备注（选填）"
                        className="input-field text-sm w-32"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdateStatus(status, statusNote)}
                        disabled={isSaving}
                        className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setShowStatusNoteInput(null);
                          setStatusNote('');
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (status === '已取消') {
                          setShowStatusNoteInput(status);
                        } else {
                          handleUpdateStatus(status);
                        }
                      }}
                      disabled={isSaving}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        status === '已取消'
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      <ArrowRight className="w-4 h-4" />
                      {status}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 space-y-6">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">客户信息</h3>
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">姓名</label>
                    <input
                      type="text"
                      value={formData.customer_name || ''}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">手机号</label>
                    <input
                      type="tel"
                      value={formData.customer_phone || ''}
                      onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <InfoRow icon={User} label="姓名" value={displayOrder.customer_name} />
                  <InfoRow icon={Phone} label="手机号" value={displayOrder.customer_phone} />
                </>
              )}
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">设备信息</h3>
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">品牌</label>
                    <input
                      type="text"
                      value={formData.device_brand || ''}
                      onChange={(e) => setFormData({ ...formData, device_brand: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">型号</label>
                    <input
                      type="text"
                      value={formData.device_model || ''}
                      onChange={(e) => setFormData({ ...formData, device_model: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">IMEI</label>
                    <input
                      type="text"
                      value={formData.device_imei || ''}
                      onChange={(e) => setFormData({ ...formData, device_imei: e.target.value || undefined })}
                      className="input-field text-sm"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <InfoRow icon={Smartphone} label="设备" value={`${displayOrder.device_brand} ${displayOrder.device_model}`} />
                  <InfoRow icon={Smartphone} label="IMEI" value={displayOrder.device_imei} />
                </>
              )}
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">工单信息</h3>
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">故障描述</label>
                    <textarea
                      value={formData.fault_description || ''}
                      onChange={(e) => setFormData({ ...formData, fault_description: e.target.value })}
                      rows={3}
                      className="input-field text-sm resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">报价 (元)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.quote ?? ''}
                      onChange={(e) => setFormData({ ...formData, quote: e.target.value ? parseFloat(e.target.value) : null })}
                      className="input-field text-sm"
                      placeholder="未报价"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">维修师傅</label>
                    <select
                      value={formData.technician_id ?? ''}
                      onChange={(e) => setFormData({ ...formData, technician_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="select-field text-sm"
                    >
                      <option value="">暂不分配</option>
                      {technicians.map(tech => (
                        <option key={tech.id} value={tech.id}>{tech.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">预计完成时间</label>
                    <input
                      type="datetime-local"
                      value={formData.estimated_completion_time || ''}
                      onChange={(e) => setFormData({ ...formData, estimated_completion_time: e.target.value || null })}
                      className="input-field text-sm"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <InfoRow icon={Wrench} label="故障描述" value={displayOrder.fault_description} />
                  <InfoRow icon={DollarSign} label="报价" value={displayOrder.quote !== null && displayOrder.quote !== undefined ? `¥${displayOrder.quote.toFixed(2)}` : '未报价'} />
                  <InfoRow icon={User} label="维修师傅" value={displayOrder.technician_name || '暂未分配'} />
                  <InfoRow icon={Clock} label="预计完成时间" value={displayOrder.estimated_completion_time ? formatTime(displayOrder.estimated_completion_time) : undefined} />
                  <InfoRow icon={Clock} label="创建时间" value={formatTime(displayOrder.created_at)} />
                  <InfoRow icon={Clock} label="更新时间" value={formatTime(displayOrder.updated_at)} />
                </>
              )}
            </div>

            {displayOrder.status_history && displayOrder.status_history.length > 0 && (
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-gray-500 mb-3">状态历史</h3>
                <div className="space-y-3">
                  {displayOrder.status_history.map((history, index) => (
                    <div key={history.id} className={`relative ${index < displayOrder.status_history!.length - 1 ? 'pb-4' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`status-badge status-${history.new_status} text-xs`}>
                              {history.new_status}
                            </span>
                            {history.old_status && (
                              <span className="text-xs text-gray-400">← {history.old_status}</span>
                            )}
                          </div>
                          {history.note && (
                            <p className="text-sm text-gray-600 mt-1">{history.note}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {formatTime(history.changed_at)}
                            {history.changed_by_name && ` · ${history.changed_by_name}`}
                          </p>
                        </div>
                      </div>
                      {index < displayOrder.status_history!.length - 1 && (
                        <div className="absolute left-1 top-4 w-px h-6 bg-gray-200" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">备注</h3>
              
              {displayOrder.notes && displayOrder.notes.length > 0 && (
                <div className="space-y-3 mb-4">
                  {displayOrder.notes.map((note) => (
                    <div key={note.id} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-900">{note.content}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTime(note.created_at)}
                        {note.created_by_name && ` · ${note.created_by_name}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="添加备注..."
                  className="flex-1 input-field text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || isLoadingNote}
                  className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100 bg-white">
            <button
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="btn-primary"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
