import { useParams, Link, useNavigate } from 'react-router-dom';
import { useRecordsStore } from '@/store/useRecordsStore';
import { ArrowLeft, Clock, User, RotateCcw, ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { STATUS_LABELS } from '@/types';

const FIELD_LABELS: Record<string, string> = {
  status: '状态',
  busSwipeTime: '公交刷卡时段',
  photoDescription: '路口照片描述',
  plannerRemark: '规划员备注',
  inspectorRemark: '巡检员备注',
  communityName: '小区名称',
  stationName: '轨交站',
};

export default function HistoryPage() {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const { records, getRecordHistory, rollbackToHistory } = useRecordsStore();

  const record = records.find((r) => r.id === recordId);
  const history = recordId ? getRecordHistory(recordId) : [];

  if (!record) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-6">
        <div className="text-center py-12">
          <p className="text-slate-500">记录不存在</p>
          <Link to="/workspace" className="text-blue-600 hover:underline mt-2 inline-block">
            返回工作区
          </Link>
        </div>
      </div>
    );
  }

  const handleRollback = (historyId: string) => {
    if (confirm('确定要回滚到此版本吗？此操作会记录一次新的变更历史。')) {
      rollbackToHistory(historyId);
    }
  };

  const formatValue = (field: string, value: string) => {
    if (field === 'status' && value in STATUS_LABELS) {
      return <StatusBadge status={value as any} size="sm" />;
    }
    return value || <span className="text-slate-400">（空）</span>;
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">变更历史溯源</h2>
        <p className="text-slate-600">
          {record.communityName} - {record.stationName}（原始行号：{record.originalRowNumber}）
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {history.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>暂无变更历史</p>
            <p className="text-sm mt-1">修改记录字段后会在此处显示变更记录</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((item, idx) => (
              <div key={item.id} className="p-5 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Clock className="w-4 h-4" />
                        {new Date(item.timestamp).toLocaleString('zh-CN')}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm text-slate-600">
                        <User className="w-4 h-4" />
                        {item.operatorName}
                        <span className="text-slate-400">
                          （{item.operator === 'planner' ? '规划员' : '巡检员'}）
                        </span>
                      </span>
                      {item.changeReason && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {item.changeReason}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-700">
                        {FIELD_LABELS[item.fieldName] || item.fieldName}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-slate-100 rounded text-sm text-slate-500 line-through">
                          {formatValue(item.fieldName, item.oldValue)}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-sm border border-green-200">
                          {formatValue(item.fieldName, item.newValue)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {idx !== 0 && (
                    <button
                      onClick={() => handleRollback(item.id)}
                      className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      回滚到此版本
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">回滚规则说明</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• 回滚操作本身会记录为一次新的变更历史，不会删除原有记录</li>
          <li>• 最新版本（第一条）不可回滚，因为就是当前状态</li>
          <li>• 所有回滚操作都会记录操作人和时间，便于审计</li>
        </ul>
      </div>
    </div>
  );
}
