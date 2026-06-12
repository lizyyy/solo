import { useParams, Link, useNavigate } from 'react-router-dom';
import { useRecordsStore } from '@/store/useRecordsStore';
import {
  ArrowLeft, Clock, User, RotateCcw, ChevronRight, Layers, AlertCircle, GitBranch, FileText, MapPin, CheckCircle } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { STATUS_LABELS } from '@/types';
import { HistoryRecord } from '@/types';

const FIELD_LABELS: Record<string, string> = {
  status: '状态',
  busSwipeTime: '公交刷卡时段',
  photoDescription: '路口照片描述',
  plannerRemark: '规划员备注',
  inspectorRemark: '巡检员备注',
  communityName: '小区名称',
  stationName: '轨交站',
};

const FIELD_ICONS: Record<string, React.ReactNode> = {
  status: <CheckCircle className="w-4 h-4" />,
  plannerRemark: <FileText className="w-4 h-4" />,
  photoDescription: <MapPin className="w-4 h-4" />,
  busSwipeTime: <Clock className="w-4 h-4" />,
};

function groupByField(history: HistoryRecord[]) {
  const map = new Map<string, HistoryRecord[]>();
  for (const item of history) {
    const list = map.get(item.fieldName) || [];
    list.push(item);
    map.set(item.fieldName, list);
  }
  return Array.from(map.entries());
}

export default function HistoryPage() {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const {
    records,
    getRecordHistory,
    rollbackToHistory,
    getRollbackChain,
  } = useRecordsStore();

  const record = records.find((r) => r.id === recordId);
  const history = recordId ? getRecordHistory(recordId) : [];

  if (!record) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-6">
        <div className="text-center py-12">
          <p className="text-slate-500">记录不存在</p>
          <Link to="/workspace" className="text-blue-600 hover:underline mt-2 inline-block">
            返回工作区
          </Link>
        </div>
      </div>
    );
  }

  const groupedHistory = groupByField(history);

  const handleRollback = (historyEntry: HistoryRecord) => {
    const chain = getRollbackChain(historyEntry.id);
    const chainSummary =
      chain.length > 1
        ? `该字段共 ${chain.length} 次变更形成回滚链，还原后可再次回滚仍可追溯`
        : '回滚本身也会作为新变更记录入库';
    if (
      confirm(
        `确认回滚【${FIELD_LABELS[historyEntry.fieldName] || historyEntry.fieldName}】吗？\n\n` +
          `从：${historyEntry.newValue}\n` +
          `还原为：${historyEntry.oldValue}\n\n` +
          `操作人：${historyEntry.operatorName}\n` +
          `原时间：${new Date(historyEntry.timestamp).toLocaleString('zh-CN')}\n\n` +
          `${chainSummary}\n\n` +
          `回滚后，可再次从新的回滚入口再回到现在。`
      )
    ) {
      rollbackToHistory(
        historyEntry.id,
        `回滚至 [${new Date(historyEntry.timestamp).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}] ${historyEntry.operatorName} 的改动：从 "${historyEntry.newValue}" 改为 "${historyEntry.oldValue}"`
      );
    }
  };

  const formatValue = (field: string, value: string) => {
    if (field === 'status' && value in STATUS_LABELS) {
      return <StatusBadge status={value as any} size="sm" />;
    }
    return value || <span className="text-slate-400">(空)</span>;
  };

  const isRollbackReason = (reason?: string) => {
    return reason?.startsWith('回滚至') || reason?.includes('回滚');
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-6">
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
          {record.communityName} - {record.stationName}（原始行号：
          <span className="font-mono">{record.originalRowNumber}</span>，导入批次：
          {record.importFileName || '未知'}）
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">总变更次数</p>
          <p className="text-2xl font-bold text-slate-800">{history.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">涉及字段数</p>
          <p className="text-2xl font-bold text-blue-600">{groupedHistory.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">回滚操作次数</p>
          <p className="text-2xl font-bold text-amber-600">
            {history.filter((h) => isRollbackReason(h.changeReason)).length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">当前状态</p>
          <div className="mt-1">
            <StatusBadge status={record.status} size="sm" />
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {groupedHistory.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>暂无变更历史</p>
            <p className="text-sm mt-1">
              修改记录字段后会在此处按字段分组显示所有变更
            </p>
          </div>
        ) : (
          groupedHistory.map(([fieldName, items]) => (
            <div
              key={fieldName}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">
                    {FIELD_ICONS[fieldName] || <FileText className="w-4 h-4" />}
                  </span>
                  <h3 className="font-semibold text-slate-800">
                    {FIELD_LABELS[fieldName] || fieldName}
                  </h3>
                  <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {items.length} 次变更
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>
                    最早：
                    {new Date(
                      items[items.length - 1].timestamp
                    ).toLocaleDateString('zh-CN')}
                  </span>
                  <span>→</span>
                  <span>
                    最新：{new Date(items[0].timestamp).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </div>

              <div className="p-4">
                {items.map((h, idx) => {
                  const isLatest = idx === 0;
                  const isRollback = isRollbackReason(h.changeReason);
                  const chain = isRollback ? getRollbackChain(h.id) : [];
                  return (
                    <div
                      key={h.id}
                      className={`relative pl-6 pb-5 last:pb-0 ${
                        idx < items.length - 1
                          ? 'border-l-2 border-dashed border-slate-200 ml-2'
                          : 'ml-2'
                      }`}
                    >
                      <span
                        className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                          isRollback
                            ? 'bg-amber-500'
                            : isLatest
                            ? 'bg-green-500'
                            : 'bg-slate-400'
                        }`}
                      >
                        {isLatest && <CheckCircle className="w-3 h-3" />}
                      </span>

                    <div
                      className={`ml-3 p-4 rounded-lg border ${
                        isRollback
                          ? 'border-amber-200 bg-amber-50/50'
                          : isLatest
                          ? 'border-green-200 bg-green-50/50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(h.timestamp).toLocaleString('zh-CN')}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-slate-600">
                          <User className="w-3.5 h-3.5" />
                          {h.operatorName}
                          <span className="text-slate-400">
                            （{h.operator === 'planner' ? '规划员' : '巡检员'}）
                          </span>
                        </span>
                        {isLatest && (
                          <span className="text-[11px] text-green-700 bg-green-100 px-2 py-0.5 rounded border border-green-200">
                            当前生效值
                          </span>
                        )}
                        {isRollback && (
                          <span className="text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1">
                            <GitBranch className="w-3 h-3" />
                            回滚操作
                          </span>
                        )}
                      </div>

                      <div className="flex items-start gap-2 mb-2 flex-wrap">
                        <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-500 line-through">
                          {formatValue(h.fieldName, h.oldValue)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 mt-0.5" />
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700 border border-green-200">
                          {formatValue(h.fieldName, h.newValue)}
                        </span>
                      </div>

                      {h.changeReason && (
                        <div className="mt-2 pt-2 border-t border-dashed border-slate-200">
                          <p className="text-xs text-slate-600 flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-slate-400" />
                            <span>
                              <span className="font-medium">
                                {isRollback ? '回滚原因：' : '变更原因：'}
                              </span>
                              {h.changeReason}
                            </span>
                          </p>
                          {isRollback && chain.length > 0 && (
                            <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1 mt-1.5">
                              <Layers className="w-3 h-3" />
                              回滚链：本变更共{' '}
                              <span className="font-medium">{chain.length}</span> 次，
                              从「{chain[0].newValue}」→「{chain[0].oldValue}」
                              →……→「{chain[chain.length - 1].newValue}」
                              每次回滚都保留完整记录
                            </p>
                          )}
                        </div>
                      )}

                      {!isLatest && (
                        <div className="mt-3 pt-3 border-t border-dashed border-slate-200 flex justify-end">
                          <button
                            onClick={() => handleRollback(h)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                              isRollback
                                ? 'text-amber-700 bg-white border border-amber-300 hover:bg-amber-50'
                                : 'text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100'
                            }`}
                          >
                            <RotateCcw className="w-3 h-3" />
                            回滚到此版本（即把{' '}
                            <span className="font-medium">「{h.oldValue}」</span> 还原为字段值
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
          <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            回滚闭环说明
          </h4>
          <ul className="text-xs text-blue-700 space-y-2">
            <li>
              <span className="font-semibold">① 怎么改：</span>
              每次修改都会生成一条历史，包含改前值、改后值、操作人、时间、原因
            </li>
            <li>
              <span className="font-semibold">② 怎么回滚：</span>
              点击「回滚到此版本」按钮，把字段值还原为该历史记录的 oldValue
            </li>
            <li>
              <span className="font-semibold">③ 闭环保证：</span>
              回滚本身又作为一条「回滚至 xxx」新变更记录入库，仍可从再回滚
            </li>
            <li>
              <span className="font-semibold">④ 同一份可解释结果：</span>
              任意时点的状态都有从哪来回哪去的完整可追溯证据链
            </li>
          </ul>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
          <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            重复导入备注保护说明
          </h4>
          <ul className="text-xs text-amber-700 space-y-2">
            <li>
              <span className="font-semibold">① 不覆盖备注：</span>
              任何重复导入，规划员/巡检员备注始终保留原话
            </li>
            <li>
              <span className="font-semibold">② 历史留痕：</span>
              若选「覆盖模式」，照片描述的覆盖原因会写进历史，可回滚到之前的描述
            </li>
            <li>
              <span className="font-semibold">③ 保留修改人：</span>
              覆盖操作写当前操作人，规划员之前写的原话修改人永远是原操作人
            </li>
            <li>
              <span className="font-semibold">④ 总数不翻倍：</span>
              复用的记录按原 ID 保留，不计入新增
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
