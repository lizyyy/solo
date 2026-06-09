import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  History, Filter, Eye, ArrowRight, CheckCircle, AlertTriangle, Clock, 
  ChevronDown, ChevronUp, RefreshCw, ShieldAlert, User, Calendar, 
  ArrowLeftRight, FileText, Search
} from 'lucide-react';
import { useAppStore } from '../store';
import { formatDate, getStatusColor, getStatusLabel } from '../utils';
import StatusBadge from '../components/StatusBadge';
import { BatchStatus } from '../types';

const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { batches } = useAppStore();
  const [filterStatus, setFilterStatus] = useState<BatchStatus | 'all'>('all');
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  const filteredBatches = filterStatus === 'all' 
    ? batches 
    : batches.filter(b => b.status === filterStatus);

  const statusFilters = [
    { value: 'all' as const, label: '全部', icon: <History className="w-4 h-4" />, dotClass: 'bg-neutral-500' },
    { value: 'normal' as const, label: '正常', icon: <CheckCircle className="w-4 h-4" />, dotClass: 'bg-success' },
    { value: 'pending_review' as const, label: '待复核', icon: <AlertTriangle className="w-4 h-4" />, dotClass: 'bg-pending_review' },
    { value: 'needs_supplement' as const, label: '待补录', icon: <ShieldAlert className="w-4 h-4" />, dotClass: 'bg-needs_supplement' },
    { value: 'supplemented' as const, label: '已补录', icon: <Clock className="w-4 h-4" />, dotClass: 'bg-supplemented' }
  ];

  const toggleExpand = (id: string) => {
    setExpandedBatchId(expandedBatchId === id ? null : id);
  };

  const renderBatchCard = (batch: typeof batches[0], index: number) => {
    const isExpanded = expandedBatchId === batch.id;
    const remarkChanges = batch.remarkHistory.length;
    const fieldLogs = batch.processLogs.filter(l => l.beforeValue && l.afterValue);
    const fieldChanges = fieldLogs.length;
    const abnormalCount = batch.temperaturePoints.filter(p => p.isAbnormal).length;
    const correctedCount = batch.temperaturePoints.filter(p => p.isCorrected).length;

    return (
      <div 
        key={batch.id}
        className="bg-white rounded-xl border border-neutral-200 overflow-hidden hover:shadow-md transition-all animate-fade-in-up"
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <div 
          className="p-6 cursor-pointer group"
          onClick={() => toggleExpand(batch.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-neutral-700 group-hover:text-primary transition-colors">
                  {batch.name}
                </h3>
                <StatusBadge status={batch.status as BatchStatus} size="sm" />
                {remarkChanges > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-xs font-medium border border-amber-100">
                    <FileText className="w-3 h-3" />
                    备注改{remarkChanges}次
                  </span>
                )}
                {fieldChanges > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 text-xs font-medium border border-violet-100">
                    <ArrowLeftRight className="w-3 h-3" />
                    字段变{fieldChanges}处
                  </span>
                )}
              </div>
              <p className="text-sm text-neutral-500 mb-3">
                材料类型: {batch.materialType} · 创建时间: {formatDate(batch.createdAt)}
              </p>
              <p className="text-sm text-neutral-600 line-clamp-2 bg-neutral-50 rounded-lg p-3 border border-neutral-100">
                {batch.remark}
              </p>
              
              <div className="flex items-center gap-6 mt-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <span className={`w-2 h-2 rounded-full ${getStatusColor(batch.status as BatchStatus)}`}></span>
                  <span>温度点数: {batch.temperaturePoints.length}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <span>异常点: <span className={abnormalCount > 0 ? 'text-danger font-medium' : ''}>{abnormalCount}</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <span>修正点: <span className={correctedCount > 0 ? 'text-supplemented font-medium' : ''}>{correctedCount}</span></span>
                </div>
                {batch.supplementedFrom && (
                  <div className="flex items-center gap-2 text-sm text-supplemented">
                    <Clock className="w-4 h-4" />
                    <span>补录来源: {batch.supplementedFrom}</span>
                  </div>
                )}
                {batch.supplementOperator && (
                  <div className="flex items-center gap-2 text-sm text-supplemented">
                    <User className="w-4 h-4" />
                    <span>补录操作人: {batch.supplementOperator}</span>
                  </div>
                )}
                {batch.reviewedBy && (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle className="w-4 h-4" />
                    <span>复核人: {batch.reviewedBy}</span>
                  </div>
                )}
                {batch.reviewedAt && (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <Calendar className="w-4 h-4" />
                    <span>复核时间: {formatDate(batch.reviewedAt)}</span>
                  </div>
                )}
                {batch.appliedThresholdVersion && batch.originalThresholdVersion && batch.appliedThresholdVersion !== batch.originalThresholdVersion && (
                  <div className="flex items-center gap-2 text-sm text-violet-600">
                    <RefreshCw className="w-4 h-4" />
                    <span>阈值: {batch.originalThresholdVersion} → {batch.appliedThresholdVersion}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-3 ml-6">
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/playback/${batch.id}`);
                  }}
                >
                  <Eye className="w-4 h-4" />
                  查看详情
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  className="flex items-center justify-center w-9 h-9 rounded-lg bg-neutral-100 text-neutral-500 hover:bg-neutral-200 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(batch.id);
                  }}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-xs text-neutral-400">
                {isExpanded ? '收起审计' : '展开审计追踪'}
              </span>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-neutral-100 bg-neutral-50/50 p-6 space-y-6 animate-fade-in">
            {batch.remarkHistory.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  巡检备注变更历史（{batch.remarkHistory.length}次）
                </h4>
                <div className="space-y-3">
                  {batch.remarkHistory.map((rh, rhIdx) => (
                    <div key={rh.id} className="bg-white rounded-lg border border-amber-100 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 text-xs text-neutral-500">
                          <User className="w-3.5 h-3.5" />
                          <span className="font-medium text-neutral-700">{rh.operator}</span>
                          <span>·</span>
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDate(rh.timestamp)}</span>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 font-medium">
                          第{rhIdx + 1}次变更
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                          <div className="text-xs text-neutral-400 mb-1 font-medium">变更前</div>
                          <div className="text-sm text-neutral-600">
                            {rh.beforeRemark || <span className="text-neutral-400 italic">（无内容）</span>}
                          </div>
                        </div>
                        <div className="rounded-lg border-2 border-amber-200 bg-amber-50/50 p-3">
                          <div className="text-xs text-amber-600 mb-1 font-medium">变更后</div>
                          <div className="text-sm text-neutral-700 font-medium">
                            {rh.afterRemark || <span className="text-neutral-400 italic">（无内容）</span>}
                          </div>
                        </div>
                      </div>
                      {rh.reason && (
                        <div className="mt-3 pt-3 border-t border-neutral-100">
                          <div className="text-xs text-neutral-400 mb-1">变更原因</div>
                          <div className="text-sm text-neutral-600 bg-white rounded p-2 border border-neutral-100">
                            {rh.reason}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-violet-500" />
                字段级变更审计（{fieldChanges}处）
              </h4>
              <div className="space-y-3">
                {fieldChanges > 0 ? fieldLogs.map((log, logIdx) => (
                  <div key={log.id} className="bg-white rounded-lg border border-violet-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="px-2 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-100 font-medium">
                          {log.fieldName}
                        </span>
                        <span className="text-neutral-500">
                          {getStatusLabel(log.action as any) || log.action}
                        </span>
                        <span>第{logIdx + 1}处</span>
                      </div>
                      <div className="flex items-center gap-2 text-neutral-500 text-xs">
                        <User className="w-3.5 h-3.5" />
                        <span className="font-medium text-neutral-700">{log.operator}</span>
                        <span>·</span>
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(log.timestamp)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                        <div className="text-xs text-neutral-400 mb-1 font-medium">变更前值</div>
                        <div className="text-sm text-neutral-600">{log.beforeValue}</div>
                      </div>
                      <div className="rounded-lg border-2 border-violet-200 bg-violet-50/50 p-3">
                        <div className="text-xs text-violet-600 mb-1 font-medium">变更后值</div>
                        <div className="text-sm text-neutral-700 font-medium">{log.afterValue}</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-neutral-100">
                      <div className="text-xs text-neutral-400 mb-1">操作说明</div>
                      <div className="text-sm text-neutral-600">{log.description}</div>
                    </div>
                  </div>
                )) : (
                  <div className="text-sm text-neutral-400 text-center py-6 bg-white rounded-lg border border-dashed border-neutral-200">
                    <Search className="w-5 h-5 mx-auto mb-2 opacity-50" />
                    暂无字段级变更记录
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-700">历史记录</h2>
          <p className="text-neutral-500 mt-1">查看所有批次的处理记录和变更对比，点击卡片可展开字段级审计追踪</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <History className="w-4 h-4" />
          <span>共 {batches.length} 条记录</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-neutral-400" />
          <span className="text-sm text-neutral-500 mr-2">筛选：</span>
          {statusFilters.map(filter => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${filterStatus === filter.value
                  ? 'bg-primary text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }
              `}
            >
              {filter.icon}
              {filter.label}
              <span className={`text-xs ${filterStatus === filter.value ? 'opacity-90' : 'opacity-60'}`}>
                ({filter.value === 'all' ? batches.length : batches.filter(b => b.status === filter.value).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredBatches.map((batch, index) => renderBatchCard(batch, index))}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h3 className="font-semibold text-neutral-700 mb-4">三种处理结果对比</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {batches.map((batch, index) => (
            <div 
              key={batch.id}
              className="rounded-xl border-2 p-5 transition-all hover:shadow-lg cursor-pointer"
              style={{ borderColor: index === 0 ? '#00B42A' : index === 1 ? '#FF7D00' : '#722ED1' }}
              onClick={() => navigate('/playback/' + batch.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <StatusBadge status={batch.status as BatchStatus} />
                <span className="text-xs text-neutral-400">{batch.materialType}</span>
              </div>
              <h4 className="font-semibold text-neutral-700 mb-2">{batch.name}</h4>
              <p className="text-sm text-neutral-500 line-clamp-3 mb-3">{batch.remark}</p>
              <div className="space-y-2 mb-4">
                {batch.remarkHistory.length > 0 && (
                  <div className="text-xs flex items-center gap-1 text-amber-600">
                    <FileText className="w-3 h-3" />
                    备注变更{batch.remarkHistory.length}次
                  </div>
                )}
                {batch.reviewedBy && (
                  <div className="text-xs flex items-center gap-1 text-success">
                    <CheckCircle className="w-3 h-3" />
                    复核人：{batch.reviewedBy}
                  </div>
                )}
                {batch.supplementedFrom && (
                  <div className="text-xs flex items-center gap-1 text-supplemented">
                    <Clock className="w-3 h-3" />
                    补录：{batch.supplementedFrom}
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-neutral-400">异常点</div>
                  <div className="font-medium text-right">{batch.temperaturePoints.filter(p => p.isAbnormal).length}</div>
                  <div className="text-neutral-400">修正点</div>
                  <div className="font-medium text-right">{batch.temperaturePoints.filter(p => p.isCorrected).length}</div>
                  <div className="text-neutral-400">流程步骤</div>
                  <div className="font-medium text-right">{batch.processLogs.length} 步</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;