import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, X, ChevronDown, MessageSquare, Eye, ChevronRight, ChevronLeft, RotateCcw } from 'lucide-react';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useAuditStore } from '@/stores/auditStore';
import { useMaterialStore } from '@/stores/materialStore';
import { exportSchedulesToCSV, downloadCSV } from '@/utils/csv';

const ROLES = ['全部', '舞台组', '音响组', '灯光组', '后勤组', '接待组', '安保组'];
const TIME_SLOTS = ['全部', '08:00-12:00', '12:00-16:00', '16:00-20:00', '18:00-22:00'];
const STATUSES = ['全部', '已确认', '待确认', '有冲突', '已取消'];
const DATES = ['全部', '2026-06-15', '2026-06-16', '2026-06-17'];

const STATUS_MAP: Record<string, { label: string; bg: string }> = {
  confirmed: { label: '已确认', bg: 'bg-emerald-100 text-emerald-700' },
  pending: { label: '待确认', bg: 'bg-amber-100 text-amber-700' },
  conflict: { label: '有冲突', bg: 'bg-rose-100 text-rose-700' },
  cancelled: { label: '已取消', bg: 'bg-slate-200 text-slate-500' },
};

const STATUS_VALUE_MAP: Record<string, string> = {
  '已确认': 'confirmed',
  '待确认': 'pending',
  '有冲突': 'conflict',
  '已取消': 'cancelled',
};

export default function ScheduleOverview() {
  const navigate = useNavigate();
  const { schedules, filters, setFilter, resetFilters, getFilteredSchedules, updateRemark } = useScheduleStore();
  const addLog = useAuditStore((s) => s.addLog);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = getFilteredSchedules();
  const totalCount = schedules.length;

  const handleExport = () => {
    const csv = exportSchedulesToCSV(filtered);
    downloadCSV(csv, '排班总览.csv');
  };

  const startEdit = (id: string, remark: string) => {
    setEditingId(id);
    setEditValue(remark);
  };

  const saveEdit = (id: string) => {
    const schedule = schedules.find((s) => s.id === id);
    if (schedule) {
      const oldRemark = schedule.remark ?? '';
      updateRemark(id, editValue);
      addLog({
        scheduleId: id,
        action: 'remark_edit',
        beforeValue: oldRemark,
        afterValue: editValue,
        evidence: '',
        suggestion: '',
      });
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-['Playfair_Display'] text-3xl font-bold text-slate-800">排班总览</h1>
            <p className="mt-1 text-sm text-slate-500 font-['Noto_Sans_SC']">
              显示 {filtered.length} / {totalCount} 条记录
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 transition-colors font-['Noto_Sans_SC']"
            >
              <Download size={16} />
              导出 CSV ({filtered.length}条)
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('festival-schedules');
                localStorage.removeItem('festival-materials');
                localStorage.removeItem('festival-audit-logs');
                window.location.reload();
              }}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-slate-600 border border-slate-200 hover:border-slate-300 transition-colors font-['Noto_Sans_SC']"
              title="重置为初始样例数据"
            >
              <RotateCcw size={14} />
              重置数据
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6 bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              placeholder="搜索志愿者/岗位..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 font-['Noto_Sans_SC']"
            />
          </div>
          {[
            { key: 'role' as const, label: '岗位', options: ROLES },
            { key: 'timeSlot' as const, label: '时段', options: TIME_SLOTS },
            { key: 'status' as const, label: '状态', options: STATUSES },
            { key: 'date' as const, label: '日期', options: DATES },
          ].map(({ key, label, options }) => (
            <div key={key} className="relative">
              <select
                value={filters[key]}
                onChange={(e) => setFilter(key, key === 'status' ? (STATUS_VALUE_MAP[e.target.value] ?? '') : (e.target.value === '全部' ? '' : e.target.value))}
                className="appearance-none pr-8 pl-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white font-['Noto_Sans_SC']"
              >
                {options.map((opt) => (
                  <option key={opt} value={opt === '全部' ? '' : (key === 'status' ? (STATUS_VALUE_MAP[opt] ?? '') : opt)}>
                    {label === '状态' && opt !== '全部' ? opt : opt}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          ))}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-['Noto_Sans_SC']"
            >
              <X size={14} />
              重置
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm font-['Noto_Sans_SC']">
            <thead>
              <tr className="bg-[#1e293b] text-slate-200">
                {['志愿者姓名', '岗位', '时段', '日期', '状态', '备注', '操作'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const st = STATUS_MAP[s.status];
                const isEditing = editingId === s.id;
                const isExpanded = expandedId === s.id;
                return (
                  <tr key={s.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-amber-50 transition-colors`}>
                    <td className="px-4 py-3 font-medium text-slate-800">{s.volunteerName}</td>
                    <td className="px-4 py-3 text-slate-600">{s.role}</td>
                    <td className="px-4 py-3 text-slate-600">{s.timeSlot}</td>
                    <td className="px-4 py-3 text-slate-600">{s.date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.bg}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full px-2 py-1 text-sm rounded border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <button onClick={() => saveEdit(s.id)} className="px-3 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600">保存</button>
                            <button onClick={cancelEdit} className="px-3 py-1 text-xs rounded bg-slate-200 text-slate-600 hover:bg-slate-300">取消</button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => startEdit(s.id, s.remark ?? '')}
                          className="cursor-pointer group flex items-start gap-1.5"
                        >
                          <MessageSquare size={14} className="mt-0.5 text-slate-400 group-hover:text-amber-500 shrink-0" />
                          <span className={`text-slate-600 group-hover:text-amber-700 ${!s.remark ? 'italic text-slate-400' : ''}`}>
                            {s.remark || '点击添加备注'}
                          </span>
                        </div>
                      )}
                      {s.remarkHistory && s.remarkHistory.length > 0 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          className="mt-1 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                        >
                          {isExpanded ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
                          修改记录({s.remarkHistory.length})
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/materials?scheduleId=${s.id}`)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-amber-600 transition-colors"
                      >
                        <Eye size={14} />
                        查看材料
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">暂无匹配的排班记录</td>
                </tr>
              )}
            </tbody>
          </table>
          {expandedId && (() => {
            const schedule = schedules.find((s) => s.id === expandedId);
            if (!schedule?.remarkHistory?.length) return null;
            return (
              <div className="border-t border-slate-200 bg-amber-50/50 px-6 py-3">
                <p className="text-xs font-medium text-slate-500 mb-2">备注修改记录</p>
                <div className="space-y-1.5">
                  {schedule.remarkHistory.map((h, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="text-slate-400">{new Date(h.changedAt).toLocaleString('zh-CN')}</span>
                      <span className="text-rose-400 line-through">{h.from || '(空)'}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-emerald-600">{h.to || '(空)'}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
