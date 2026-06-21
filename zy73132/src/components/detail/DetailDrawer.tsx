import React, { useState } from 'react';
import {
  X, CheckCircle, Clock, XCircle, AlertTriangle, Database,
  Edit3, MessageSquare, Mic, Send, ArrowRight, Ruler, Hash,
  History, ChevronDown, ChevronUp
} from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { formatDateTime, getStatusLabel, getSourceTypeLabel, getAnomalyTypeLabel } from '../../utils/helpers';
import type { ReviewStatus, SourceChainItem, ReviewLog, TidalRecord } from '../../types';

const getSourceIcon = (type: string) => {
  switch (type) {
    case 'original': return Database;
    case 'old_bottle_id': return Hash;
    case 'manual_review': return Edit3;
    case 'verbal_note': return Mic;
    default: return Database;
  }
};

const getSourceColor = (type: string, affectsConclusion: boolean) => {
  if (affectsConclusion) return { bg: 'bg-anomaly-500/20', border: 'border-anomaly-500/50', text: 'text-anomaly-400', label: '影响结论' };
  switch (type) {
    case 'original': return { bg: 'bg-ocean-500/15', border: 'border-ocean-400/30', text: 'text-ocean-400', label: '原始数据' };
    case 'old_bottle_id': return { bg: 'bg-amber-500/15', border: 'border-amber-400/40', text: 'text-amber-400', label: '旧版编号' };
    case 'manual_review': return { bg: 'bg-pink-500/15', border: 'border-pink-400/40', text: 'text-pink-400', label: '人工改判' };
    case 'verbal_note': return { bg: 'bg-purple-500/15', border: 'border-purple-400/40', text: 'text-purple-400', label: '口头备注' };
    default: return { bg: 'bg-slate-500/15', border: 'border-slate-400/30', text: 'text-slate-400', label: '其他' };
  }
};

const DetailDrawer: React.FC = () => {
  const {
    selectedRecordId, showDetail, toggleDetail,
    records, sourceChains, remarks, reviewLogs,
    updateRecordStatus, addRemark,
  } = useAppStore();

  const [newRemark, setNewRemark] = useState('');
  const [isVerbal, setIsVerbal] = useState(false);
  const [statusDialog, setStatusDialog] = useState<{ open: boolean; targetStatus: ReviewStatus | null }>({ open: false, targetStatus: null });
  const [statusRemark, setStatusRemark] = useState('');
  const [showHistory, setShowHistory] = useState(true);

  const record = records.find(r => r.id === selectedRecordId);
  const chain = record ? sourceChains[record.id] || [] : [];
  const recordRemarks = record ? remarks[record.id] || [] : [];
  const recordReviewLogs = record ? reviewLogs[record.id] || [] : [];

  const handleStatusClick = (status: ReviewStatus) => {
    setStatusDialog({ open: true, targetStatus: status });
    setStatusRemark('');
  };

  const handleStatusConfirm = () => {
    if (record && statusDialog.targetStatus) {
      updateRecordStatus(record.id, statusDialog.targetStatus, statusRemark.trim() || undefined);
      setStatusDialog({ open: false, targetStatus: null });
      setStatusRemark('');
    }
  };

  const handleStatusCancel = () => {
    setStatusDialog({ open: false, targetStatus: null });
    setStatusRemark('');
  };

  const handleAddRemark = () => {
    if (record && newRemark.trim()) {
      addRemark(record.id, newRemark.trim(), isVerbal);
      setNewRemark('');
      setIsVerbal(false);
    }
  };

  if (!showDetail || !record) {
    return null;
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] glass-panel border-l border-ocean-400/20 shadow-2xl z-50 flex flex-col animate-[slideIn_0.3s_ease-out]" style={{ animation: 'slideIn 0.3s ease-out' }}>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

      <div className="px-5 py-4 border-b border-ocean-400/15 flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold text-ocean-300">记录详情</h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{record.id}</p>
        </div>
        <button
          onClick={() => toggleDetail(false)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-deep-sea-700 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <section className="px-5 py-4 border-b border-ocean-400/10">
          <h4 className="text-xs font-semibold text-ocean-400 uppercase tracking-wider mb-3">基础信息</h4>
          <div className="grid grid-cols-2 gap-3">
            <InfoItem label="时间" value={formatDateTime(record.timestamp)} mono />
            <InfoItem label="采样瓶" value={record.bottleId} highlight={record.bottleVersion === 'old'} />
            {record.bottleVersion === 'old' && record.oldBottleId && (
              <div className="col-span-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
                <p className="text-xs text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  该记录使用旧版编号: <span className="font-mono ml-1">{record.oldBottleId}</span>
                </p>
              </div>
            )}
            <InfoItem label="潮位值" value={`${record.waterLevel} ${record.unit}`} mono />
            {record.originalUnit !== record.unit && (
              <div className="col-span-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
                <p className="text-xs text-amber-400 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5" />
                  单位混写: 原始为 <span className="font-mono mx-1">{record.originalUnit}</span>，当前为 <span className="font-mono mx-1">{record.unit}</span>，需要复核换算
                </p>
              </div>
            )}
            <InfoItem
              label="状态"
              value={getStatusLabel(record.status)}
              valueClass={
                record.status === 'confirmed' ? 'text-[#52b788]' :
                record.status === 'pending' ? 'text-[#FFB627]' :
                'text-[#fa5252]'
              }
            />
            {record.isAnomaly && (
              <InfoItem
                label="异常类型"
                value={getAnomalyTypeLabel(record.anomalyType)}
                valueClass="text-anomaly-400"
              />
            )}
          </div>
          {record.anomalyReason && (
            <div className="mt-3 p-2.5 rounded-lg bg-anomaly-500/10 border border-anomaly-500/30">
              <p className="text-xs text-anomaly-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{record.anomalyReason}</span>
              </p>
            </div>
          )}
          {record.conclusion && (
            <div className="mt-3 p-2.5 rounded-lg bg-ocean-500/10 border border-ocean-400/30">
              <p className="text-xs text-ocean-300">
                <span className="font-medium text-ocean-400">复核结论: </span>
                {record.conclusion}
              </p>
            </div>
          )}
        </section>

        <section className="px-5 py-4 border-b border-ocean-400/10">
          <h4 className="text-xs font-semibold text-ocean-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ArrowRight className="w-3.5 h-3.5" />
            数据来源链
          </h4>
          <div className="space-y-1">
            {chain.map((item, idx) => (
              <SourceChainNode key={item.id} item={item} isLast={idx === chain.length - 1} />
            ))}
            {chain.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">暂无来源记录</p>
            )}
          </div>
        </section>

        <section className="px-5 py-4 border-b border-ocean-400/10">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-xs font-semibold text-ocean-400 uppercase tracking-wider mb-3"
          >
            <span className="flex items-center gap-2">
              <History className="w-3.5 h-3.5" />
              状态操作历史
              {recordReviewLogs.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-ocean-400/20 text-ocean-400 text-[10px] font-normal">
                  {recordReviewLogs.length}
                </span>
              )}
            </span>
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showHistory && (
            <div className="space-y-2">
              {recordReviewLogs.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">暂无操作记录</p>
              ) : (
                recordReviewLogs.slice().reverse().map(log => (
                  <ReviewLogItem key={log.id} log={log} />
                ))
              )}
            </div>
          )}
        </section>

        <section className="px-5 py-4">
          <h4 className="text-xs font-semibold text-ocean-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" />
            备注记录
          </h4>
          <div className="space-y-2 mb-4">
            {recordRemarks.map(remark => (
              <div key={remark.id} className="p-3 rounded-lg bg-deep-sea-800/60 border border-ocean-400/10">
                <div className="flex items-center gap-2 mb-1.5">
                  {remark.isVerbal && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      <Mic className="w-2.5 h-2.5" />
                      口头
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{remark.author}</span>
                  <span className="text-xs text-slate-500 font-mono">{formatDateTime(remark.time)}</span>
                </div>
                <p className="text-sm text-slate-200">{remark.content}</p>
              </div>
            ))}
            {recordRemarks.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">暂无备注</p>
            )}
          </div>

          <div className="space-y-2">
            <textarea
              value={newRemark}
              onChange={(e) => setNewRemark(e.target.value)}
              placeholder="输入备注内容..."
              className="w-full h-20 bg-deep-sea-800/60 border border-ocean-400/20 rounded-lg p-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-ocean-400 resize-none"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVerbal}
                  onChange={(e) => setIsVerbal(e.target.checked)}
                  className="rounded bg-deep-sea-800 border-ocean-400/30 text-ocean-400 focus:ring-ocean-400"
                />
                标记为口头备注
              </label>
              <button
                onClick={handleAddRemark}
                disabled={!newRemark.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-ocean-500 hover:bg-ocean-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-all"
              >
                <Send className="w-3 h-3" />
                添加
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="px-5 py-4 border-t border-ocean-400/15">
        <p className="text-xs text-slate-400 mb-2">更新复核状态:</p>
        <div className="flex gap-2">
          <button
            onClick={() => handleStatusClick('confirmed')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              record.status === 'confirmed'
                ? 'bg-[#2D6A4F] text-white'
                : 'bg-[#2D6A4F]/20 text-[#52b788] hover:bg-[#2D6A4F]/30 border border-[#2D6A4F]/50'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            已确认
          </button>
          <button
            onClick={() => handleStatusClick('pending')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              record.status === 'pending'
                ? 'bg-[#FFB627] text-deep-sea-950'
                : 'bg-[#FFB627]/20 text-[#FFB627] hover:bg-[#FFB627]/30 border border-[#FFB627]/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            待补件
          </button>
          <button
            onClick={() => handleStatusClick('returned')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              record.status === 'returned'
                ? 'bg-[#C92A2A] text-white'
                : 'bg-[#C92A2A]/20 text-[#fa5252] hover:bg-[#C92A2A]/30 border border-[#C92A2A]/50'
            }`}
          >
            <XCircle className="w-4 h-4" />
            退回
          </button>
        </div>
      </div>

      {statusDialog.open && (
        <StatusDialog
          record={record}
          targetStatus={statusDialog.targetStatus!}
          remark={statusRemark}
          onRemarkChange={setStatusRemark}
          onConfirm={handleStatusConfirm}
          onCancel={handleStatusCancel}
        />
      )}
    </div>
  );
};

interface InfoItemProps {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  valueClass?: string;
}

const InfoItem: React.FC<InfoItemProps> = ({ label, value, mono, highlight, valueClass }) => (
  <div>
    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
    <p className={`text-sm ${mono ? 'font-mono' : ''} ${highlight ? 'text-amber-400' : 'text-slate-200'} ${valueClass || ''}`}>
      {value}
    </p>
  </div>
);

const SourceChainNode: React.FC<{ item: SourceChainItem; isLast: boolean }> = ({ item, isLast }) => {
  const Icon = getSourceIcon(item.type);
  const color = getSourceColor(item.type, item.affectsConclusion);

  return (
    <div className={`source-chain-node pl-7 pb-4 ${isLast ? '' : ''}`}>
      <div className={`absolute left-0 top-0 w-6 h-6 rounded-full ${color.bg} border ${color.border} flex items-center justify-center`}>
        <Icon className={`w-3 h-3 ${color.text}`} />
      </div>
      <div className={`p-3 rounded-lg bg-deep-sea-800/60 border ${item.affectsConclusion ? 'border-anomaly-500/40' : 'border-ocean-400/10'}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-xs font-semibold ${color.text}`}>
            {getSourceTypeLabel(item.type)}
          </span>
          {item.affectsConclusion && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-anomaly-500/20 text-anomaly-400 border border-anomaly-500/40">
              ⚠ 影响结论
            </span>
          )}
        </div>
        <p className="text-sm text-slate-200 mb-2">{item.content}</p>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span>{item.operator}</span>
          <span className="font-mono">{formatDateTime(item.time)}</span>
        </div>
      </div>
    </div>
  );
};

const ReviewLogItem: React.FC<{ log: ReviewLog }> = ({ log }) => {
  const getStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case 'confirmed': return 'bg-[#2D6A4F]/30 text-[#52b788] border-[#2D6A4F]/50';
      case 'pending': return 'bg-[#FFB627]/20 text-[#FFB627] border-[#FFB627]/50';
      case 'returned': return 'bg-[#C92A2A]/30 text-[#fa5252] border-[#C92A2A]/50';
    }
  };

  return (
    <div className="p-3 rounded-lg bg-deep-sea-800/60 border border-ocean-400/10">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        {log.fromStatus && (
          <>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getStatusBadge(log.fromStatus)}`}>
              {getStatusLabel(log.fromStatus)}
            </span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
          </>
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getStatusBadge(log.toStatus)} font-medium`}>
          {getStatusLabel(log.toStatus)}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-1.5">
        <span>{log.operator}</span>
        <span className="font-mono">{formatDateTime(log.time)}</span>
      </div>
      {log.remark && (
        <p className="text-xs text-slate-300 mb-1.5">
          <span className="text-slate-400">备注：</span>{log.remark}
        </p>
      )}
      {log.conclusion && (
        <div className="p-2 rounded bg-ocean-500/10 border border-ocean-400/20">
          <p className="text-[11px] text-ocean-300 leading-relaxed">{log.conclusion}</p>
        </div>
      )}
    </div>
  );
};

interface StatusDialogProps {
  record: TidalRecord;
  targetStatus: ReviewStatus;
  remark: string;
  onRemarkChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const StatusDialog: React.FC<StatusDialogProps> = ({
  record,
  targetStatus,
  remark,
  onRemarkChange,
  onConfirm,
  onCancel,
}) => {
  const getStatusConfig = (status: ReviewStatus) => {
    switch (status) {
      case 'confirmed':
        return {
          title: '确认数据有效',
          icon: CheckCircle,
          color: 'text-[#52b788]',
          borderColor: 'border-[#2D6A4F]/50',
          bgColor: 'bg-[#2D6A4F]',
          placeholder: '请输入确认说明（可选），例如：已核对现场照片，数据有效...',
          hint: '确认后该记录将标记为已确认，结论将自动生成。',
          required: false,
        };
      case 'pending':
        return {
          title: '标记为待补件',
          icon: Clock,
          color: 'text-[#FFB627]',
          borderColor: 'border-[#FFB627]/50',
          bgColor: 'bg-[#FFB627]',
          placeholder: '请说明需要补充什么材料，例如：需补充采样瓶编号对照表、现场照片...',
          hint: '系统将根据异常类型自动列出待补清单，请补充具体说明。',
          required: true,
        };
      case 'returned':
        return {
          title: '退回修正',
          icon: XCircle,
          color: 'text-[#fa5252]',
          borderColor: 'border-[#C92A2A]/50',
          bgColor: 'bg-[#C92A2A]',
          placeholder: '请详细说明退回原因及修正要求，例如：单位未换算、编号未更新...',
          hint: '退回后数据需重新处理后提交，请明确修改要求。',
          required: true,
        };
    }
  };

  const config = getStatusConfig(targetStatus);
  const Icon = config.icon;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-[90%] max-w-md glass-panel rounded-xl border border-ocean-400/20 shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        <div className={`px-5 py-4 border-b ${config.borderColor} bg-deep-sea-800/50`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${config.bgColor}/20 flex items-center justify-center ${config.borderColor} border`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div>
              <h4 className={`font-display font-semibold ${config.color}`}>{config.title}</h4>
              <p className="text-xs text-slate-400">
                {record.bottleId} · {formatDateTime(record.timestamp)}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {record.isAnomaly && (
            <div className="p-3 rounded-lg bg-anomaly-500/10 border border-anomaly-500/30">
              <p className="text-xs text-anomaly-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  <span className="font-medium">异常类型：</span>
                  {getAnomalyTypeLabel(record.anomalyType)}
                  {record.anomalyReason && ` — ${record.anomalyReason}`}
                </span>
              </p>
            </div>
          )}

          <div>
            <label className="flex items-center gap-1 text-xs text-slate-300 mb-1.5">
              操作说明
              {config.required && <span className="text-anomaly-400">*</span>}
            </label>
            <textarea
              value={remark}
              onChange={(e) => onRemarkChange(e.target.value)}
              placeholder={config.placeholder}
              className="w-full h-24 bg-deep-sea-800/60 border border-ocean-400/20 rounded-lg p-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-ocean-400 resize-none"
              autoFocus
            />
            <p className="text-[10px] text-slate-500 mt-1">{config.hint}</p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg text-sm bg-deep-sea-700 text-slate-300 hover:bg-deep-sea-600 transition-all"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              disabled={config.required && !remark.trim()}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium text-white ${config.bgColor} hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
            >
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailDrawer;
