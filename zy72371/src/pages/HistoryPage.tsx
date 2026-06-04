import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Filter, Eye, ArrowRight, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { useAppStore } from '../store';
import { formatDate, getStatusColor } from '../utils';
import StatusBadge from '../components/StatusBadge';
import { BatchStatus } from '../types';

const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { batches } = useAppStore();
  const [filterStatus, setFilterStatus] = useState<BatchStatus | 'all'>('all');

  const filteredBatches = filterStatus === 'all' 
    ? batches 
    : batches.filter(b => b.status === filterStatus);

  const statusFilters: { value: BatchStatus | 'all'; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: '全部', icon: <History className="w-4 h-4" /> },
    { value: 'normal', label: '正常', icon: <CheckCircle className="w-4 h-4" /> },
    { value: 'pending_review', label: '待复核', icon: <AlertTriangle className="w-4 h-4" /> },
    { value: 'supplemented', label: '已补录', icon: <Clock className="w-4 h-4" /> }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-700">历史记录</h2>
          <p className="text-neutral-500 mt-1">查看所有批次的处理记录和结果对比</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <History className="w-4 h-4" />
          <span>共 {batches.length} 条记录</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-4">
        <div className="flex items-center gap-2">
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
              <span className="text-xs opacity-75">
                ({filter.value === 'all' ? batches.length : batches.filter(b => b.status === filter.value).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredBatches.map((batch, index) => (
          <div 
            key={batch.id}
            className="bg-white rounded-xl border border-neutral-200 p-6 hover:shadow-md transition-all animate-fade-in-up cursor-pointer group"
            style={{ animationDelay: `${index * 100}ms` }}
            onClick={() => navigate(`/playback/${batch.id}`)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-neutral-700 group-hover:text-primary transition-colors">
                    {batch.name}
                  </h3>
                  <StatusBadge status={batch.status as BatchStatus} size="sm" />
                </div>
                <p className="text-sm text-neutral-500 mb-3">
                  材料类型: {batch.materialType} · 创建时间: {formatDate(batch.createdAt)}
                </p>
                <p className="text-sm text-neutral-600 line-clamp-2 bg-neutral-50 rounded-lg p-3 border border-neutral-100">
                  {batch.remark}
                </p>
                
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <span className={`w-2 h-2 rounded-full ${getStatusColor(batch.status as BatchStatus)}`}></span>
                    <span>温度点数: {batch.temperaturePoints.length}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <span>异常点: {batch.temperaturePoints.filter(p => p.isAbnormal).length}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <span>修正点: {batch.temperaturePoints.filter(p => p.isCorrected).length}</span>
                  </div>
                  {batch.supplementedFrom && (
                    <div className="flex items-center gap-2 text-sm text-supplemented">
                      <Clock className="w-4 h-4" />
                      <span>补录来源: {batch.supplementedFrom}</span>
                    </div>
                  )}
                  {batch.reviewedBy && (
                    <div className="flex items-center gap-2 text-sm text-success">
                      <CheckCircle className="w-4 h-4" />
                      <span>复核人: {batch.reviewedBy}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-3 ml-6">
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
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h3 className="font-semibold text-neutral-700 mb-4">三种处理结果对比</h3>
        <div className="grid grid-cols-3 gap-6">
          {batches.map((batch, index) => (
            <div 
              key={batch.id}
              className="rounded-xl border-2 p-5 transition-all hover:shadow-lg cursor-pointer"
              style={{ borderColor: index === 0 ? '#00B42A' : index === 1 ? '#FF7D00' : '#722ED1' }}
              onClick={() => navigate(`/playback/${batch.id}`)}
            >
              <div className="flex items-center justify-between mb-3">
                <StatusBadge status={batch.status as BatchStatus} />
                <span className="text-xs text-neutral-400">{batch.materialType}</span>
              </div>
              <h4 className="font-semibold text-neutral-700 mb-2">{batch.name}</h4>
              <p className="text-sm text-neutral-500 line-clamp-3">{batch.remark}</p>
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
