import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Music,
  User,
  Clock,
  Filter,
  Tags,
  History,
  FilePlus,
  Info,
} from 'lucide-react';
import { useAppStore } from '../store';
import { Conflict } from '../types';
import { formatDateTime } from '../utils/helpers';

export default function Conflicts() {
  const { conflicts, resolveConflict, tracks } = useAppStore();
  const [filterStatus, setFilterStatus] = useState<'全部' | '待处理' | '已确认' | '已驳回'>('全部');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [remark, setRemark] = useState('');

  const filteredConflicts = conflicts.filter(
    (c) => filterStatus === '全部' || c.status === filterStatus
  );

  const getConflictTrack = (trackId: string) => tracks.find((t) => t.id === trackId);

  const handleResolve = (conflictId: string, action: 'confirm' | 'reject') => {
    const message = action === 'confirm' ? '确认这个冲突处理结果吗？' : '确定要驳回吗？';
    if (confirm(message)) {
      resolveConflict(conflictId, action, '录音师小段', remark || undefined);
      setRemark('');
    }
  };

  const getTypeColor = (type: Conflict['type']) => {
    switch (type) {
      case '名称冲突':
        return 'bg-red-100 text-red-700 border-red-200';
      case '金额矛盾':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case '别名缺失':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case '双重身份':
        return 'bg-violet-100 text-violet-700 border-violet-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: Conflict['status']) => {
    switch (status) {
      case '待处理':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case '已确认':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case '已驳回':
        return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case '正常':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case '待复核':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case '已确认':
        return 'bg-sky-100 text-sky-700 border-sky-200';
      case '已驳回':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-amber-800 mb-0.5">
              冲突处理原则
            </h4>
            <p className="text-xs text-amber-700 leading-relaxed">
              合同页截图和曲目别名表互相矛盾时，先列出冲突证据，让录音师小段选确认或驳回，不要替业务同事自动拍板。
              同一首歌有现场名和版权名时，别急着归正常，留给音乐老师复核。
              补录别名后曲目会进入"待复核"状态，需人工确认后才能计入周报。
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-slate-600" />
            冲突列表
          </h3>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            {(['全部', '待处理', '已确认', '已驳回'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  filterStatus === status
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status}
                {status === '待处理' && (
                  <span className="ml-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {conflicts.filter((c) => c.status === '待处理').length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredConflicts.map((conflict) => {
            const track = getConflictTrack(conflict.trackId);
            const isExpanded = expandedId === conflict.id;
            const 补录Evidence = conflict.evidence.alias补录Evidence;

            return (
              <div
                key={conflict.id}
                className={`border rounded-lg overflow-hidden transition-all ${
                  conflict.status === '待处理'
                    ? 'border-amber-300 bg-amber-50/30'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50/50"
                  onClick={() => setExpandedId(isExpanded ? null : conflict.id)}
                >
                  {getStatusIcon(conflict.status)}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-md border font-medium ${getTypeColor(
                      conflict.type
                    )}`}
                  >
                    {conflict.type}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Music className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-800">
                        {track?.trackName || '未知曲目'}
                      </span>
                      {track?.nameType && track.nameType !== '未知' && (
                        <span className="text-xs text-slate-500">（{track.nameType}）</span>
                      )}
                      {track?.matchedCanonicalName && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Tags className="w-3 h-3" />
                          {track.matchedCanonicalName}
                        </span>
                      )}
                    </div>
                    {track?.reviewReason && (
                      <p className="text-xs text-slate-500 mt-1 ml-6">
                        <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
                        {track.reviewReason}
                      </p>
                    )}
                  </div>
                  {track && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${getStatusBadge(
                        track.reviewStatus
                      )}`}
                    >
                      {track.reviewStatus}
                    </span>
                  )}
                  {conflict.handler && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <User className="w-3.5 h-3.5" />
                      {conflict.handler}
                    </div>
                  )}
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {formatDateTime(new Date(conflict.createdAt))}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-200 p-4 bg-white space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {conflict.evidence.contractEvidence && (
                        <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                          <h5 className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                            <FilePlus className="w-3.5 h-3.5" />
                            合同证据
                          </h5>
                          <p className="text-sm text-slate-700 leading-relaxed">
                            {conflict.evidence.contractEvidence}
                          </p>
                        </div>
                      )}
                      {conflict.evidence.aliasEvidence && (
                        <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                          <h5 className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                            <Tags className="w-3.5 h-3.5" />
                            别名表证据
                          </h5>
                          <p className="text-sm text-slate-700 leading-relaxed">
                            {conflict.evidence.aliasEvidence}
                          </p>
                        </div>
                      )}
                    </div>

                    {补录Evidence && (
                      <div className="p-3 bg-violet-50 rounded-md border border-violet-200">
                        <h5 className="text-xs font-semibold text-violet-700 mb-2 flex items-center gap-1.5">
                          <FilePlus className="w-3.5 h-3.5" />
                          补录别名证据链
                        </h5>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-violet-500">补录别名：</span>
                            <span className="text-violet-800 font-medium">
                              {补录Evidence.aliasName}
                            </span>
                          </div>
                          <div>
                            <span className="text-violet-500">标准名：</span>
                            <span className="text-violet-800 font-medium">
                              {补录Evidence.canonicalName}
                            </span>
                          </div>
                          <div>
                            <span className="text-violet-500">类型：</span>
                            <span className="text-violet-800">{补录Evidence.aliasType}</span>
                          </div>
                          <div>
                            <span className="text-violet-500">来源：</span>
                            <span className="text-violet-800">{补录Evidence.source}</span>
                          </div>
                          <div>
                            <span className="text-violet-500">补录人：</span>
                            <span className="text-violet-800">{补录Evidence.operator}</span>
                          </div>
                          <div>
                            <span className="text-violet-500">补录时间：</span>
                            <span className="text-violet-800">
                              {formatDateTime(new Date(补录Evidence.补录At))}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-violet-200">
                          <span className="text-violet-500 text-xs">是否触发双重身份：</span>
                          <span
                            className={`text-xs font-medium ${
                              补录Evidence.补录后是否触发双重身份
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {补录Evidence.补录后是否触发双重身份 ? '是 - 需音乐老师复核' : '否'}
                          </span>
                        </div>
                      </div>
                    )}

                    {track && track.statusHistory && track.statusHistory.length > 0 && (
                      <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                        <h5 className="text-xs font-semibold text-slate-600 mb-2.5 flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5" />
                          曲目状态变更历史
                        </h5>
                        <div className="relative">
                          <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-slate-200" />
                          <div className="space-y-2">
                            {track.statusHistory.map((change, idx) => (
                              <div key={idx} className="relative pl-6">
                                <div
                                  className={`absolute left-0.5 top-1.5 w-3 h-3 rounded-full border-2 border-white ${
                                    change.fromStatus === change.toStatus
                                      ? 'bg-slate-400'
                                      : 'bg-amber-500'
                                  }`}
                                />
                                <div className="text-xs">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusBadge(
                                        change.fromStatus
                                      )}`}
                                    >
                                      {change.fromStatus}
                                    </span>
                                    <span className="text-slate-400">→</span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusBadge(
                                        change.toStatus
                                      )}`}
                                    >
                                      {change.toStatus}
                                    </span>
                                    <span className="text-slate-400 ml-auto">
                                      {change.operator}
                                    </span>
                                  </div>
                                  <p className="text-slate-600 mt-0.5">{change.reason}</p>
                                  <p className="text-slate-400 text-[10px] mt-0.5">
                                    {formatDateTime(new Date(change.timestamp))}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {conflict.resolvedReason && (
                      <div className="p-3 bg-emerald-50 rounded-md border border-emerald-200">
                        <h5 className="text-xs font-semibold text-emerald-700 mb-1 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          处理结论
                        </h5>
                        <p className="text-sm text-emerald-800">{conflict.resolvedReason}</p>
                      </div>
                    )}

                    {conflict.remarks && (
                      <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                        <h5 className="text-xs font-semibold text-slate-600 mb-1">处理备注</h5>
                        <p className="text-sm text-slate-700">{conflict.remarks}</p>
                      </div>
                    )}

                    {conflict.status === '待处理' && (
                      <div className="flex items-center gap-3 pt-2">
                        <input
                          type="text"
                          value={remark}
                          onChange={(e) => setRemark(e.target.value)}
                          placeholder="输入处理备注（可选）"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                        <button
                          onClick={() => handleResolve(conflict.id, 'reject')}
                          className="px-4 py-2 bg-red-50 text-red-700 text-sm rounded-md border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4" />
                          驳回
                        </button>
                        <button
                          onClick={() => handleResolve(conflict.id, 'confirm')}
                          className="px-4 py-2 bg-emerald-50 text-emerald-700 text-sm rounded-md border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          确认
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filteredConflicts.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无{filterStatus === '全部' ? '' : filterStatus}的冲突记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
