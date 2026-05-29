import { useState } from 'react';
import { useRecordStore } from '@/store/useRecordStore';
import { StatusBadge } from './StatusBadge';
import { ConditionBadge } from './ConditionBadge';
import { ExceptionBadge } from './ExceptionBadge';
import { ConditionTimeline } from './ConditionTimeline';
import { PriceHistoryView } from './PriceHistoryView';
import { VersionCompare } from './VersionCompare';
import {
  X,
  Edit,
  Disc,
  Calendar,
  User,
  MapPin,
  FileText,
  Tag,
  History,
  TrendingUp,
  Layers,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import type { InventoryRecord, RecordStatus, ConditionGrade } from '@/types';
import {
  STATUS_LABELS,
  CONDITION_GRADES,
} from '@/types';
import {
  canTransition,
  getAvailableTransitions,
  isModifiable,
} from '@/utils/stateMachine';

interface RecordDetailProps {
  record: InventoryRecord;
  onClose: () => void;
  onEdit: (record: InventoryRecord) => void;
}

type TabType = 'info' | 'condition' | 'price' | 'versions' | 'exceptions';

export function RecordDetail({ record, onClose, onEdit }: RecordDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [statusReason, setStatusReason] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState<RecordStatus | null>(null);
  const [conditionReason, setConditionReason] = useState('');
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [targetCondition, setTargetCondition] = useState<ConditionGrade | null>(null);
  const [priceReason, setPriceReason] = useState('');
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [newPrice, setNewPrice] = useState<number | ''>('');

  const updateRecordStatus = useRecordStore((s) => s.updateRecordStatus);
  const updateCondition = useRecordStore((s) => s.updateCondition);
  const updatePrice = useRecordStore((s) => s.updatePrice);
  const resolveException = useRecordStore((s) => s.resolveException);
  const getRecordExceptions = useRecordStore((s) => s.getRecordExceptions);

  const exceptions = getRecordExceptions(record.id);
  const availableTransitions = getAvailableTransitions(record.status);
  const modifiable = isModifiable(record.status);

  const handleStatusChange = () => {
    if (!targetStatus || !statusReason.trim()) return;
    const result = updateRecordStatus(record.id, targetStatus, statusReason);
    if (result.success) {
      setShowStatusModal(false);
      setStatusReason('');
      setTargetStatus(null);
    }
  };

  const handleConditionChange = () => {
    if (!targetCondition || !conditionReason.trim()) return;
    const result = updateCondition(record.id, targetCondition, conditionReason);
    if (result.success) {
      setShowConditionModal(false);
      setConditionReason('');
      setTargetCondition(null);
    }
  };

  const handlePriceChange = () => {
    if (newPrice === '' || !priceReason.trim()) return;
    const result = updatePrice(record.id, Number(newPrice), priceReason);
    if (result.success) {
      setShowPriceModal(false);
      setPriceReason('');
      setNewPrice('');
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'info', label: '基本信息', icon: Disc },
    { id: 'condition', label: '品相历史', icon: History },
    { id: 'price', label: '价格版本', icon: TrendingUp },
    { id: 'versions', label: '版本对比', icon: Layers },
    { id: 'exceptions', label: '异常记录', icon: AlertTriangle },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cream-100 rounded-sm shadow-vinyl-lg w-full max-w-4xl max-h-[90vh] overflow-hidden animate-slide-in flex flex-col">
        <div className="bg-vinyl-700 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Disc className="w-6 h-6" />
            <div>
              <h2 className="font-display text-xl font-semibold">
                {record.albumName}
              </h2>
              <p className="text-white/70 text-sm">
                {record.artist} · {record.catalogNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {modifiable && (
              <button
                className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-sm text-sm flex items-center gap-1 transition-colors"
                onClick={() => onEdit(record)}
              >
                <Edit className="w-4 h-4" />
                编辑
              </button>
            )}
            <button
              className="text-white/70 hover:text-white transition-colors p-1"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex border-b border-vinyl-700/20 bg-white overflow-x-auto flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                activeTab === tab.id
                  ? 'text-vinyl-700 border-b-2 border-vinyl-700 bg-vinyl-700/5'
                  : 'text-vinyl-500 hover:text-vinyl-700 hover:bg-vinyl-700/5'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'exceptions' && exceptions.filter((e) => !e.resolved).length > 0 && (
                <span className="bg-alert-500 text-white text-xs px-1.5 rounded-full">
                  {exceptions.filter((e) => !e.resolved).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-vinyl-600" />
                    <span className="text-sm font-medium text-vinyl-600">状态</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={record.status} />
                    {modifiable && availableTransitions.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-vinyl-500">变更为:</span>
                        {availableTransitions.map((s) => (
                          <button
                            key={s}
                            className="text-xs bg-vinyl-700/10 text-vinyl-700 px-2 py-1 rounded-sm hover:bg-vinyl-700/20 transition-colors"
                            onClick={() => {
                              setTargetStatus(s);
                              setShowStatusModal(true);
                            }}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <Disc className="w-4 h-4 text-vinyl-600" />
                    <span className="text-sm font-medium text-vinyl-600">品相</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ConditionBadge condition={record.condition} />
                    {modifiable && (
                      <button
                        className="text-xs bg-vinyl-700/10 text-vinyl-700 px-2 py-1 rounded-sm hover:bg-vinyl-700/20 transition-colors"
                        onClick={() => setShowConditionModal(true)}
                      >
                        变更品相
                      </button>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-vinyl-600" />
                    <span className="text-sm font-medium text-vinyl-600">寄售价格</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold font-display text-vinyl-900">
                      ¥{record.price.toFixed(2)}
                    </span>
                    {modifiable && (
                      <button
                        className="text-xs bg-vinyl-700/10 text-vinyl-700 px-2 py-1 rounded-sm hover:bg-vinyl-700/20 transition-colors"
                        onClick={() => {
                          setNewPrice(record.price);
                          setShowPriceModal(true);
                        }}
                      >
                        调整价格
                      </button>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-vinyl-600" />
                    <span className="text-sm font-medium text-vinyl-600">版本标记</span>
                  </div>
                  <div className="font-mono text-vinyl-900">
                    {record.versionTag || '-'}
                  </div>
                  {record.albumGroupId && (
                    <div className="text-xs text-caramel-500 mt-1">
                      同专辑 {useRecordStore.getState().getAlbumGroupRecords(record.albumGroupId).length} 个版本
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-vinyl-500" />
                    <span className="text-xs text-vinyl-500">发行年份</span>
                  </div>
                  <div className="text-lg font-semibold text-vinyl-900">{record.pressYear}</div>
                </div>
                <div className="card">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-vinyl-500" />
                    <span className="text-xs text-vinyl-500">寄售人</span>
                  </div>
                  <div className="text-lg font-semibold text-vinyl-900">{record.consignor}</div>
                </div>
                <div className="card">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-vinyl-500" />
                    <span className="text-xs text-vinyl-500">上架位置</span>
                  </div>
                  <div className="text-lg font-mono text-vinyl-900">{record.shelfLocation}</div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-vinyl-500" />
                  <span className="text-xs text-vinyl-500">核对报告</span>
                </div>
                <p className="text-vinyl-800 whitespace-pre-wrap">{record.verificationReport}</p>
              </div>

              <div className="text-xs text-vinyl-400 flex gap-4">
                <span>创建: {new Date(record.createdAt).toLocaleString('zh-CN')}</span>
                <span>更新: {new Date(record.updatedAt).toLocaleString('zh-CN')}</span>
                <span>版本: v{record.version}</span>
              </div>
            </div>
          )}

          {activeTab === 'condition' && (
            <div className="animate-fade-in">
              <ConditionTimeline recordId={record.id} />
            </div>
          )}

          {activeTab === 'price' && (
            <div className="animate-fade-in">
              <PriceHistoryView recordId={record.id} />
            </div>
          )}

          {activeTab === 'versions' && (
            <div className="animate-fade-in">
              {record.albumGroupId ? (
                <VersionCompare
                  albumGroupId={record.albumGroupId}
                  currentRecordId={record.id}
                />
              ) : (
                <div className="text-center py-6 text-vinyl-500 text-sm">
                  此唱片未关联到任何专辑组
                </div>
              )}
            </div>
          )}

          {activeTab === 'exceptions' && (
            <div className="space-y-3 animate-fade-in">
              {exceptions.length === 0 ? (
                <div className="text-center py-6 text-vinyl-500 text-sm">
                  暂无异常记录
                </div>
              ) : (
                exceptions.map((e) => (
                  <div
                    key={e.id}
                    className={`card ${!e.resolved ? 'exception-highlight' : 'opacity-60'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <ExceptionBadge type={e.type} resolved={e.resolved} />
                        {e.field && (
                          <span className="text-xs text-vinyl-500 bg-vinyl-700/10 px-2 py-0.5 rounded-sm">
                            字段: {e.field}
                          </span>
                        )}
                      </div>
                      {!e.resolved && (
                        <button
                          className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                          onClick={() => resolveException(e.id)}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          标记已解决
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-vinyl-700 mt-2">{e.message}</p>
                    <p className="text-xs text-vinyl-500 mt-1">
                      {new Date(e.timestamp).toLocaleString('zh-CN')}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-sm shadow-vinyl-lg w-full max-w-md p-6 animate-fade-in">
            <h3 className="font-display text-lg font-semibold mb-4 text-vinyl-900">
              变更状态为: {STATUS_LABELS[targetStatus!]}
            </h3>
            <div className="mb-4">
              <label className="label-field label-required">变更原因</label>
              <textarea
                className="input-field min-h-[80px]"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="请说明状态变更原因"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="btn-ghost"
                onClick={() => {
                  setShowStatusModal(false);
                  setStatusReason('');
                  setTargetStatus(null);
                }}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleStatusChange}
                disabled={!statusReason.trim()}
              >
                确认变更
              </button>
            </div>
          </div>
        </div>
      )}

      {showConditionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-sm shadow-vinyl-lg w-full max-w-md p-6 animate-fade-in">
            <h3 className="font-display text-lg font-semibold mb-4 text-vinyl-900">
              变更品相
            </h3>
            <div className="mb-4">
              <label className="label-field label-required">新品相</label>
              <select
                className="input-field"
                value={targetCondition || ''}
                onChange={(e) => setTargetCondition(e.target.value as ConditionGrade)}
              >
                <option value="">请选择品相</option>
                {CONDITION_GRADES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="label-field label-required">变更原因</label>
              <textarea
                className="input-field min-h-[80px]"
                value={conditionReason}
                onChange={(e) => setConditionReason(e.target.value)}
                placeholder="请说明品相变更原因"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="btn-ghost"
                onClick={() => {
                  setShowConditionModal(false);
                  setConditionReason('');
                  setTargetCondition(null);
                }}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleConditionChange}
                disabled={!targetCondition || !conditionReason.trim()}
              >
                确认变更
              </button>
            </div>
          </div>
        </div>
      )}

      {showPriceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-sm shadow-vinyl-lg w-full max-w-md p-6 animate-fade-in">
            <h3 className="font-display text-lg font-semibold mb-4 text-vinyl-900">
              调整寄售价格
            </h3>
            <div className="mb-2 text-sm text-vinyl-600">
              当前价格: <span className="font-semibold">¥{record.price.toFixed(2)}</span>
            </div>
            <div className="mb-4">
              <label className="label-field label-required">新价格 (元)</label>
              <input
                type="number"
                className="input-field"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value ? Number(e.target.value) : '')}
                placeholder="请输入新价格"
                step="0.01"
                min="0"
              />
            </div>
            <div className="mb-4">
              <label className="label-field label-required">调整原因</label>
              <textarea
                className="input-field min-h-[80px]"
                value={priceReason}
                onChange={(e) => setPriceReason(e.target.value)}
                placeholder="请说明价格调整原因"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="btn-ghost"
                onClick={() => {
                  setShowPriceModal(false);
                  setPriceReason('');
                  setNewPrice('');
                }}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handlePriceChange}
                disabled={newPrice === '' || !priceReason.trim() || Number(newPrice) <= 0}
              >
                确认调整
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
