import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  MapPin,
  FileText,
  Clock,
  Users,
  Edit3,
  Save,
  X,
  CheckCircle,
  RotateCcw,
  Bus,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/types';

export const BreakpointDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentBreakpoint, fetchBreakpoint, updateBreakpoint, markDetour, confirmBreakpoint, loading } = useAppStore();

  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (id) {
      fetchBreakpoint(id);
    }
  }, [fetchBreakpoint, id]);

  useEffect(() => {
    if (currentBreakpoint) {
      setNoteText(currentBreakpoint.redlineNote || '');
    }
  }, [currentBreakpoint]);

  const handleSaveNote = async () => {
    if (!id) return;
    await updateBreakpoint(id, { redlineNote: noteText });
    setIsEditingNote(false);
  };

  const handleMarkDetour = async () => {
    if (!id) return;
    await markDetour(id);
  };

  const handleConfirm = async () => {
    if (!id) return;
    await confirmBreakpoint(id);
  };

  if (loading.breakpoint && !currentBreakpoint) {
    return <div className="text-stone-400">加载中...</div>;
  }

  if (!currentBreakpoint) {
    return <div className="text-stone-400">找不到该断点</div>;
  }

  const bp = currentBreakpoint;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/breakpoints')}
        className="flex items-center gap-2 text-stone-500 hover:text-stone-700 text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        返回断点列表
      </button>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className={`px-6 py-4 border-b border-stone-200 flex items-center justify-between ${
          bp.hasConstructionDetour ? 'bg-amber-50' : 'bg-stone-50'
        }`}>
          <div>
            <h2 className="text-xl font-bold text-stone-800 flex items-center gap-3">
              {bp.name}
              {bp.hasConstructionDetour && (
                <span className="inline-flex items-center gap-1.5 text-orange-700 bg-orange-100 px-3 py-1 rounded-full text-xs font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  施工临时改道未同步
                </span>
              )}
            </h2>
            <div className="text-sm text-stone-500 mt-1 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {bp.location}
            </div>
          </div>
          <span
            className={`px-4 py-1.5 rounded-full text-sm font-medium ${STATUS_COLORS[bp.status]}`}
          >
            {STATUS_LABELS[bp.status]}
          </span>
        </div>

        <div className="grid grid-cols-3 divide-x divide-stone-100">
          <div className="p-6">
            <div className="text-xs text-stone-400 uppercase tracking-wider mb-2">经纬度</div>
            <div className="font-mono text-sm text-stone-700">
              {bp.lat.toFixed(4)}, {bp.lng.toFixed(4)}
            </div>
          </div>
          <div className="p-6">
            <div className="text-xs text-stone-400 uppercase tracking-wider mb-2">创建时间</div>
            <div className="text-sm text-stone-700">
              {new Date(bp.createdAt).toLocaleString('zh-CN')}
            </div>
          </div>
          <div className="p-6">
            <div className="text-xs text-stone-400 uppercase tracking-wider mb-2">更新时间</div>
            <div className="text-sm text-stone-700">
              {new Date(bp.updatedAt).toLocaleString('zh-CN')}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
            <h3 className="font-bold text-stone-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              红线图备注
            </h3>
            {!isEditingNote && (
              <button
                onClick={() => setIsEditingNote(true)}
                className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium"
              >
                <Edit3 className="w-4 h-4" />
                编辑
              </button>
            )}
          </div>
          <div className="p-6">
            {isEditingNote ? (
              <div className="space-y-3">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="输入红线图备注信息..."
                  className="w-full h-32 px-4 py-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => {
                      setNoteText(bp.redlineNote || '');
                      setIsEditingNote(false);
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    取消
                  </button>
                  <button
                    onClick={handleSaveNote}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1"
                  >
                    <Save className="w-4 h-4" />
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-700 leading-relaxed">
                {bp.redlineNote || (
                  <span className="text-stone-400 italic">暂无备注，点击右上角编辑补充</span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <div className="px-6 py-4 border-b border-stone-200">
            <h3 className="font-bold text-stone-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              快捷操作
            </h3>
          </div>
          <div className="p-6 space-y-3">
            {bp.status === 'pending_review' && (
              <button
                onClick={handleConfirm}
                className="w-full px-4 py-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 flex items-center justify-center gap-2 transition-colors"
              >
                <CheckCircle className="w-5 h-5" />
                居民代表复核确认
              </button>
            )}
            {!bp.hasConstructionDetour && bp.status !== 'completed' && (
              <button
                onClick={handleMarkDetour}
                className="w-full px-4 py-3 rounded-lg bg-orange-600 text-white font-medium hover:bg-orange-700 flex items-center justify-center gap-2 transition-colors"
              >
                <AlertTriangle className="w-5 h-5" />
                标记为施工临时改道（待复核）
              </button>
            )}
            <div className="text-xs text-stone-400 bg-stone-50 p-3 rounded-lg">
              <p className="font-medium text-stone-600 mb-1">边界规则提示：</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>施工改道必须经过居民代表复核</li>
                <li>标记后自动流转为"待复核"状态</li>
                <li>别急着归正常，留到开会确认</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="px-6 py-4 border-b border-stone-200">
          <h3 className="font-bold text-stone-800 flex items-center gap-2">
            <Bus className="w-5 h-5 text-emerald-600" />
            关联公交刷卡时段
          </h3>
        </div>
        <div className="overflow-x-auto">
          {bp.busCardTimes.length === 0 ? (
            <div className="px-6 py-8 text-center text-stone-400 text-sm">
              暂无关联的公交刷卡时段数据
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-stone-500">日期</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-stone-500">时段</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-stone-500">客流量</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-stone-500">导入时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {bp.busCardTimes.map((t) => (
                  <tr key={t.id} className="hover:bg-stone-50">
                    <td className="px-6 py-3 text-sm text-stone-700">{t.sourceDate}</td>
                    <td className="px-6 py-3 text-sm text-stone-700">{t.timeSlot}</td>
                    <td className="px-6 py-3 text-sm font-medium text-stone-800">{t.passengerCount}</td>
                    <td className="px-6 py-3 text-xs text-stone-500">
                      {new Date(t.importedAt).toLocaleString('zh-CN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="px-6 py-4 border-b border-stone-200">
          <h3 className="font-bold text-stone-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            历史变更记录
          </h3>
        </div>
        <div className="p-6">
          {bp.historyRecords.length === 0 ? (
            <div className="text-center text-stone-400 text-sm py-4">暂无变更记录</div>
          ) : (
            <div className="space-y-0">
              {bp.historyRecords.map((h, idx) => (
                <div key={h.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1.5"></div>
                    {idx < bp.historyRecords.length - 1 && (
                      <div className="w-px bg-stone-200 flex-1 min-h-[40px]"></div>
                    )}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-stone-800">
                        {h.fieldName === 'redline_note'
                          ? '修改红线图备注'
                          : h.fieldName === 'status'
                            ? '状态变更'
                            : h.fieldName === 'has_construction_detour'
                              ? '施工改道标记变更'
                              : h.fieldName}
                      </span>
                      <span className="text-xs text-stone-400">
                        {new Date(h.changedAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div className="text-xs text-stone-500 mb-2">操作人：{h.changedBy}</div>
                    {(h.oldValue !== null || h.newValue !== null) && (
                      <div className="bg-stone-50 rounded-lg p-3 text-sm space-y-1">
                        {h.oldValue !== null && (
                          <div className="flex items-start gap-2">
                            <span className="text-red-600 font-mono text-xs bg-red-50 px-1.5 py-0.5 rounded">改前</span>
                            <span className="text-stone-600">{String(h.oldValue)}</span>
                          </div>
                        )}
                        {h.newValue !== null && (
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 font-mono text-xs bg-green-50 px-1.5 py-0.5 rounded">改后</span>
                            <span className="text-stone-800">{String(h.newValue)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BreakpointDetail;
