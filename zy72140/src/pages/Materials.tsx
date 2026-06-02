import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Music, Volume2, FileText, MessageCircle, Plus, Edit3, ExternalLink, Filter } from 'lucide-react';
import { useMaterialStore } from '@/stores/materialStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import type { Material } from '@/types';

const TYPE_CONFIG: Record<Material['type'], { icon: typeof Music; label: string }> = {
  tracklist: { icon: Music, label: '曲目表' },
  audio: { icon: Volume2, label: '音频' },
  contract_scan: { icon: FileText, label: '合同截图' },
  group_annotation: { icon: MessageCircle, label: '群批注' },
};

const TYPE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'tracklist', label: '曲目表' },
  { key: 'audio', label: '音频' },
  { key: 'contract_scan', label: '合同截图' },
  { key: 'group_annotation', label: '群批注' },
] as const;

export default function Materials() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { materials, getMaterialsByScheduleId, updateMaterial, selectedScheduleId, setSelectedScheduleId } = useMaterialStore();
  const { schedules, getScheduleById } = useScheduleStore();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    const sid = searchParams.get('scheduleId');
    if (sid) setSelectedScheduleId(sid);
  }, []);

  const filteredMaterials = selectedScheduleId
    ? getMaterialsByScheduleId(selectedScheduleId)
    : materials;

  const displayed = typeFilter === 'all'
    ? filteredMaterials
    : filteredMaterials.filter((m) => m.type === typeFilter);

  const selectedSchedule = selectedScheduleId ? getScheduleById(selectedScheduleId) : undefined;

  const handleScheduleChange = (id: string) => {
    setSelectedScheduleId(id || null);
    if (id) {
      searchParams.set('scheduleId', id);
    } else {
      searchParams.delete('scheduleId');
    }
    setSearchParams(searchParams);
  };

  const startEdit = (m: Material) => {
    setEditingId(m.id);
    setEditText(m.annotation);
  };

  const saveAnnotation = (id: string) => {
    updateMaterial(id, { annotation: editText });
    setEditingId(null);
    setEditText('');
  };

  return (
    <div className="min-h-screen bg-amber-50/40 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-indigo-900">材料管理</h1>
          <p className="mt-1 text-indigo-600/70">关联排班的曲目表、音频、合同截图和群批注</p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <select
              value={selectedScheduleId ?? ''}
              onChange={(e) => handleScheduleChange(e.target.value)}
              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-indigo-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">全部排班</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.volunteerName} - {s.role} ({s.date})
                </option>
              ))}
            </select>
          </div>
          {selectedSchedule && (
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
              {selectedSchedule.volunteerName} · {selectedSchedule.role}
            </span>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                typeFilter === f.key
                  ? 'bg-indigo-900 text-white shadow-md'
                  : 'bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {displayed.map((m) => {
            const config = TYPE_CONFIG[m.type];
            const Icon = config.icon;
            const isContract = m.type === 'contract_scan';

            return (
              <div
                key={m.id}
                className={`rounded-xl bg-white shadow-sm border transition-shadow hover:shadow-md ${
                  isContract ? 'sm:col-span-2 lg:col-span-2 border-rose-200' : 'border-indigo-100'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-lg p-1.5 ${isContract ? 'bg-rose-100' : 'bg-indigo-100'}`}>
                        <Icon className={`w-4 h-4 ${isContract ? 'text-rose-600' : 'text-indigo-600'}`} />
                      </div>
                      <span className={`text-xs font-medium ${isContract ? 'text-rose-600' : 'text-indigo-600'}`}>
                        {config.label}
                      </span>
                    </div>
                    {isContract && (
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">
                        合同证据
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-indigo-900 mb-1">{m.name}</h3>
                  <p className="text-sm text-indigo-800/60 mb-3 line-clamp-2">{m.description}</p>

                  {m.fileUrl && (
                    <div className="flex items-center gap-1 mb-3 text-xs text-amber-700">
                      <ExternalLink className="w-3 h-3" />
                      <span className="truncate">{m.fileUrl}</span>
                    </div>
                  )}

                  {m.annotation ? (
                    <div className={`rounded-lg p-3 mb-3 ${isContract ? 'bg-rose-50 border border-rose-200' : 'bg-amber-50 border border-amber-200'}`}>
                      <p className={`text-sm ${isContract ? 'text-rose-800 font-medium' : 'text-amber-900'}`}>
                        {m.annotation}
                      </p>
                    </div>
                  ) : null}

                  {editingId === m.id ? (
                    <div className="mb-3">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        rows={2}
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => saveAnnotation(m.id)}
                          className="rounded-lg bg-indigo-900 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-800"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-200"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(m)}
                      className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
                    >
                      {m.annotation ? <Edit3 className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {m.annotation ? '编辑批注' : '添加批注'}
                    </button>
                  )}

                  <p className="mt-3 text-xs text-indigo-400">
                    {new Date(m.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {displayed.length === 0 && (
          <div className="mt-16 text-center text-indigo-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>暂无材料</p>
          </div>
        )}
      </div>
    </div>
  );
}
