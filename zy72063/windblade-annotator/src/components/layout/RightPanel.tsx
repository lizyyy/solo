import { useState } from 'react';
import {
  ChevronRight,
  X,
  MapPin,
  AlertTriangle,
  FileText,
  Lightbulb,
  MessageSquare,
  History,
  Edit3,
  Check,
  Clock,
  User,
  Link2,
  Copy
} from 'lucide-react';
import { useAppStore, useSelectedRecord } from '../../store/useAppStore';
import { StatusBadge } from '../common/StatusBadge';
import { SourceIcon } from '../common/SourceIcon';
import { RiskIndicator } from '../common/RiskIndicator';
import {
  CRACK_TYPE_LABELS,
  LOCATION_LABELS,
  STATUS_LABELS,
  type RecordStatus
} from '../../types';
import { copyToClipboard } from '../../utils/export';

const STATUS_OPTIONS: RecordStatus[] = ['pending', 'processing', 'completed', 'confirmed'];

const ActionIcon = ({ action }: { action: string }) => {
  const icons: Record<string, typeof Edit3> = {
    create: FileText,
    update: Edit3,
    status_change: Check,
    remark: MessageSquare,
    import: Link2
  };
  const Icon = icons[action] || Edit3;
  return <Icon className="w-4 h-4" />;
};

export const RightPanel = () => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState(false);

  const {
    rightPanelCollapsed,
    toggleRightPanel,
    setSelectedRecord,
    updateRecordStatus,
    addRemark,
    toggleDiffPanel
  } = useAppStore();

  const record = useSelectedRecord();

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleStatusChange = (status: RecordStatus) => {
    if (record) {
      updateRecordStatus(record.id, status);
      setEditingStatus(false);
    }
  };

  const handleAddRemark = () => {
    const remark = prompt('请输入备注内容：');
    if (remark && record) {
      addRemark(record.id, remark);
    }
  };

  if (rightPanelCollapsed) {
    return (
      <div className="w-12 glass border-l border-white/10 flex flex-col items-center py-4">
        <button
          onClick={toggleRightPanel}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="w-96 glass border-l border-white/10 flex flex-col h-full">
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">详情信息</h2>
          <button
            onClick={toggleRightPanel}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <MapPin className="w-16 h-16 text-gray-600 mb-4" />
          <p className="text-gray-400 mb-2">请选择一条异常记录</p>
          <p className="text-gray-500 text-sm">点击左侧列表或3D模型上的标记</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 glass border-l border-white/10 flex flex-col h-full">
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">详情信息</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelectedRecord(null)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={toggleRightPanel}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-mono font-bold text-white">{record.code}</span>
                {record.isOldCaliber && (
                  <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded border border-amber-500/30">
                    旧口径待复核
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">创建于 {record.createdAt}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {editingStatus ? (
                <div className="flex flex-wrap gap-1 justify-end">
                  {STATUS_OPTIONS.map(status => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        record.status === status
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                      }`}
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setEditingStatus(true)}
                  className="flex items-center gap-1"
                >
                  <StatusBadge status={record.status} />
                  <Edit3 className="w-3 h-3 text-gray-500 hover:text-gray-300 ml-1" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-dark-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-primary-400" />
                <span className="text-xs text-gray-400">部位</span>
              </div>
              <p className="text-sm font-medium text-white">{LOCATION_LABELS[record.location]}</p>
              <p className="text-xs text-gray-500 font-mono mt-1">
                X:{record.position3D.x.toFixed(2)} Y:{record.position3D.y.toFixed(2)} Z:{record.position3D.z.toFixed(2)}
              </p>
            </div>

            <div className="bg-dark-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-warning-400" />
                <span className="text-xs text-gray-400">裂纹类型</span>
              </div>
              <p className="text-sm font-medium text-white">{CRACK_TYPE_LABELS[record.crackType]}</p>
              <RiskIndicator level={record.riskLevel} showLabel className="mt-1" />
            </div>
          </div>

          <div className="bg-dark-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-400">裂纹描述</span>
              </div>
              <SourceIcon source={record.source} showLabel />
            </div>
            <p className="text-sm text-gray-200 leading-relaxed">{record.description}</p>
          </div>

          <div className="sticky-note rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-700">何工的处理建议</span>
            </div>
            <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-line">
              {record.suggestion}
            </p>
          </div>

          <div className="bg-dark-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-400">处理备注</span>
              </div>
              <button
                onClick={handleAddRemark}
                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                补录备注
              </button>
            </div>
            <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {record.remark || (
                <span className="text-gray-500 italic">暂无备注，点击"补录备注"添加</span>
              )}
            </div>
          </div>

          {record.isOldCaliber && (
            <button
              onClick={() => toggleDiffPanel(true)}
              className="w-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg p-3 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-400">查看新旧口径差异对比</span>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-400" />
            </button>
          )}

          <div className="bg-dark-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-400">来源追溯</span>
              </div>
              <button
                onClick={() => handleCopy(record.sourceInfo.sourceRef, 'source')}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
              >
                {copiedField === 'source' ? (
                  <><Check className="w-3 h-3 text-success-400" /> 已复制</>
                ) : (
                  <><Copy className="w-3 h-3" /> 复制</>
                )}
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <SourceIcon source={record.source} showLabel />
              </div>
              <blockquote className="border-l-2 border-primary-500 pl-3 text-sm text-gray-400">
                {record.sourceInfo.sourceRef}
              </blockquote>
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-300">
                  查看原始数据快照
                </summary>
                <pre className="mt-2 p-2 bg-dark-900 rounded text-gray-400 font-mono text-xs overflow-x-auto">
                  {JSON.stringify(JSON.parse(record.sourceInfo.originalData), null, 2)}
                </pre>
              </details>
            </div>
          </div>

          <div className="bg-dark-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400">操作历史</span>
            </div>
            <div className="space-y-3">
              {record.history.map((h, idx) => (
                <div
                  key={h.id}
                  className={`timeline-connector pl-7 ${idx === record.history.length - 1 ? '' : 'pb-3'}`}
                >
                  <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-dark-700 flex items-center justify-center">
                    <ActionIcon action={h.action} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-gray-500" />
                        <span className="text-xs font-medium text-gray-300">{h.operator}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {h.timestamp.slice(5, 16)}
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">{h.detail}</p>
                    {h.diff && h.diff.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {h.diff.map((d, i) => (
                          <div key={i} className="text-xs diff-modify pl-2 py-1 rounded">
                            <span className="text-gray-500">{d.field}:</span>
                            <span className="text-red-400 line-through mx-1">{d.oldValue}</span>
                            <span className="text-gray-500">→</span>
                            <span className="text-success-400 ml-1">{d.newValue}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
