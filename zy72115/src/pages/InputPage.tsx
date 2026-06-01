import { useState } from 'react';
import { useVibrationStore } from '@/store/useVibrationStore';
import { DIRECTION_LABELS, VALID_DIRECTIONS, VALID_UNITS } from '@/utils/validation';
import { UNIT_LABELS } from '@/utils/unitConversion';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { Direction, AmplitudeUnit, DataSource, VibrationRecord } from '@/types';

const DATA_SOURCES: DataSource[] = ['实验表', '照片说明', '维修微信群'];
const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  '实验表': '实验表',
  '照片说明': '照片说明',
  '维修微信群': '维修微信群',
};

const STATUS_STYLE: Record<string, string> = {
  '正常': 'bg-emerald-500/15 text-emerald-400',
  '需确认': 'bg-amber-500/15 text-amber-400',
  '旧口径': 'bg-zinc-500/15 text-zinc-400',
};

const ROW_BAR_STYLE: Record<string, string> = {
  '正常': 'bg-emerald-500',
  '需确认': 'bg-amber-500',
  '旧口径': 'bg-zinc-500',
};

interface FormData {
  compressorId: string;
  direction: Direction | '';
  frequencyHz: string;
  amplitude: string;
  amplitudeUnit: AmplitudeUnit;
  rpm: string;
  dataSource: DataSource;
  recordTime: string;
}

const initialForm: FormData = {
  compressorId: '',
  direction: '',
  frequencyHz: '',
  amplitude: '',
  amplitudeUnit: 'mm/s',
  rpm: '',
  dataSource: '实验表',
  recordTime: '',
};

export default function InputPage() {
  const { compressors, records, addRecord, confirmRecord, deleteRecord, selectedCompressorId } =
    useVibrationStore();
  const [form, setForm] = useState<FormData>({
    ...initialForm,
    compressorId: selectedCompressorId || compressors[0]?.id || '',
  });
  const [lastValidation, setLastValidation] = useState<VibrationRecord | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmNote, setConfirmNote] = useState('');

  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.recordTime).getTime() - new Date(a.recordTime).getTime()
  );

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.compressorId || !form.direction || !form.frequencyHz || !form.amplitude) return;

    const newRecord = addRecord({
      compressorId: form.compressorId,
      direction: form.direction as Direction,
      frequencyHz: Number(form.frequencyHz),
      amplitude: Number(form.amplitude),
      amplitudeUnit: form.amplitudeUnit,
      rpm: Number(form.rpm) || 0,
      dataSource: form.dataSource,
      recordTime: form.recordTime || new Date().toISOString().slice(0, 16),
      confirmationNote: '',
    });

    setLastValidation(newRecord);
    setForm({ ...initialForm, compressorId: form.compressorId });
  };

  const handleConfirm = (id: string) => {
    confirmRecord(id, confirmNote);
    setConfirmingId(null);
    setConfirmNote('');
  };

  const toggleNotes = (id: string) => {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatTime = (t: string) => {
    const d = new Date(t);
    if (isNaN(d.getTime())) return t;
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-xl border border-white/5 bg-[#22262e] p-6">
        <h2 className="mb-5 text-base font-semibold text-zinc-100">数据录入</h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm text-zinc-400">压缩机</label>
            <select
              value={form.compressorId}
              onChange={(e) => handleChange('compressorId', e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#2a2e38] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500/50"
            >
              <option value="">请选择</option>
              {compressors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.model}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-zinc-400">测点方向</label>
            <select
              value={form.direction}
              onChange={(e) => handleChange('direction', e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#2a2e38] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500/50"
            >
              <option value="">请选择</option>
              {VALID_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {DIRECTION_LABELS[d]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-zinc-400">频率</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                value={form.frequencyHz}
                onChange={(e) => handleChange('frequencyHz', e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-white/10 bg-[#2a2e38] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500/50"
              />
              <span className="shrink-0 text-sm text-zinc-500">Hz</span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-zinc-400">幅值</label>
            <input
              type="number"
              step="any"
              value={form.amplitude}
              onChange={(e) => handleChange('amplitude', e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-white/10 bg-[#2a2e38] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-zinc-400">幅值单位</label>
            <select
              value={form.amplitudeUnit}
              onChange={(e) => handleChange('amplitudeUnit', e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#2a2e38] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500/50"
            >
              {VALID_UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-zinc-400">转速</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                value={form.rpm}
                onChange={(e) => handleChange('rpm', e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-white/10 bg-[#2a2e38] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500/50"
              />
              <span className="shrink-0 text-sm text-zinc-500">RPM</span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-zinc-400">数据来源</label>
            <select
              value={form.dataSource}
              onChange={(e) => handleChange('dataSource', e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#2a2e38] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500/50"
            >
              {DATA_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {DATA_SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-zinc-400">记录时间</label>
            <input
              type="datetime-local"
              value={form.recordTime}
              onChange={(e) => handleChange('recordTime', e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#2a2e38] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-amber-400"
            >
              <Plus className="h-4 w-4" />
              添加记录
            </button>
          </div>
        </form>

        {lastValidation && lastValidation.validationNotes.length > 0 && (
          <div className="mt-5 rounded-lg border border-white/5 bg-[#1a1d23] p-4">
            <h3 className="mb-2 text-sm font-medium text-zinc-300">验证结果</h3>
            <ul className="space-y-1.5">
              {lastValidation.validationNotes.map((note, i) => {
                const isError =
                  note.includes('无法识别') ||
                  note.includes('不在支持') ||
                  note.includes('无效') ||
                  note.includes('缺少');
                return (
                  <li
                    key={i}
                    className={cn(
                      'flex items-start gap-2 text-sm',
                      isError ? 'text-red-400' : 'text-amber-400'
                    )}
                  >
                    {isError ? (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    {note}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/5 bg-[#22262e] p-6">
        <h2 className="mb-4 text-base font-semibold text-zinc-100">数据列表</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-zinc-500">
                <th className="pb-3 pr-4 font-medium">时间</th>
                <th className="pb-3 pr-4 font-medium">方向</th>
                <th className="pb-3 pr-4 font-medium">频率</th>
                <th className="pb-3 pr-4 font-medium">幅值</th>
                <th className="pb-3 pr-4 font-medium">换算后(mm/s)</th>
                <th className="pb-3 pr-4 font-medium">来源</th>
                <th className="pb-3 pr-4 font-medium">状态</th>
                <th className="pb-3 font-medium">验证提示</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((rec) => (
                <tr key={rec.id} className="group relative border-b border-white/5">
                  <td
                    className={cn(
                      'absolute left-0 top-0 h-full w-1 rounded-l',
                      ROW_BAR_STYLE[rec.status]
                    )}
                  />
                  <td className="py-3 pl-3 pr-4 text-zinc-300">{formatTime(rec.recordTime)}</td>
                  <td className="py-3 pr-4 text-zinc-300">{DIRECTION_LABELS[rec.direction]}</td>
                  <td className="py-3 pr-4 text-zinc-300">
                    {rec.amplitude} {rec.amplitudeUnit}
                  </td>
                  <td className="py-3 pr-4 text-zinc-300">
                    {rec.amplitudeMmPerS.toFixed(2)}
                    {rec.isExtreme && (
                      <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-400" />
                    )}
                  </td>
                  <td className="py-3 pr-4 text-zinc-400">{rec.dataSource}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLE[rec.status]
                      )}
                    >
                      {rec.status}
                    </span>
                  </td>
                  <td className="py-3">
                    {rec.validationNotes.length > 0 && (
                      <div>
                        <button
                          onClick={() => toggleNotes(rec.id)}
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
                        >
                          {rec.validationNotes.length} 条提示
                          {expandedNotes[rec.id] ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                        {expandedNotes[rec.id] && (
                          <ul className="mt-1 space-y-0.5">
                            {rec.validationNotes.map((note, i) => (
                              <li key={i} className="text-xs text-zinc-500">
                                {note}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    {rec.confirmationNote && (
                      <p className="mt-1 text-xs text-zinc-600">
                        <CheckCircle className="mr-1 inline h-3 w-3 text-emerald-500" />
                        {rec.confirmationNote}
                      </p>
                    )}
                    {(rec.status === '需确认' || rec.status === '旧口径') &&
                      !rec.confirmationNote && (
                        <div className="mt-1">
                          {confirmingId === rec.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={confirmNote}
                                onChange={(e) => setConfirmNote(e.target.value)}
                                placeholder="输入确认备注..."
                                className="w-40 rounded border border-white/10 bg-[#2a2e38] px-2 py-1 text-xs text-zinc-300 outline-none focus:border-amber-500/50"
                              />
                              <button
                                onClick={() => handleConfirm(rec.id)}
                                className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500"
                              >
                                确定
                              </button>
                              <button
                                onClick={() => {
                                  setConfirmingId(null);
                                  setConfirmNote('');
                                }}
                                className="text-xs text-zinc-500 hover:text-zinc-300"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmingId(rec.id)}
                              className="text-xs text-amber-400 hover:text-amber-300"
                            >
                              确认
                            </button>
                          )}
                        </div>
                      )}
                  </td>
                  <td className="py-3 pl-2">
                    <button
                      onClick={() => deleteRecord(rec.id)}
                      className="text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {sortedRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-zinc-600">
                    暂无数据记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
