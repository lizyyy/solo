import { useState, useMemo } from 'react';
import { FileDown, FileText, AlertTriangle, ClipboardList } from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';

type ExportScope = 'all' | 'pending' | 'disputed';

const SCOPE_OPTIONS: { value: ExportScope; label: string; icon: typeof ClipboardList }[] = [
  { value: 'all', label: '全部记录', icon: ClipboardList },
  { value: 'pending', label: '仅待处理', icon: AlertTriangle },
  { value: 'disputed', label: '仅争议记录', icon: FileText },
];

export default function ExportPage() {
  const [scope, setScope] = useState<ExportScope>('all');
  const records = useRecordStore((s) => s.records);
  const exportInspectionSheet = useRecordStore((s) => s.exportInspectionSheet);

  const preview = useMemo(() => exportInspectionSheet(scope), [exportInspectionSheet, scope]);

  const counts = useMemo(() => {
    const all = records.length;
    const pending = records.filter((r) => r.status === 'pending').length;
    const disputed = records.filter((r) => r.isDisputed).length;
    return { all, pending, disputed };
  }, [records]);

  const handleExport = () => {
    const blob = new Blob([preview], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `巡检单_${scope}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-museum-cream p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">巡检单导出</h1>
          <p className="mt-1 text-sm text-gray-500">
            选择导出范围，预览并下载文物展柜摆位巡检单
          </p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-600">导出范围</h2>
          <div className="flex gap-3">
            {SCOPE_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setScope(value)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                  scope === value
                    ? 'border-[#c48a5a] bg-[#c48a5a]/10 text-[#c48a5a]'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                    scope === value
                      ? 'bg-[#c48a5a]/20 text-[#c48a5a]'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {counts[value]}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-gray-600">预览</h2>
            <textarea
              readOnly
              value={preview}
              className="w-full rounded-lg border border-museum-border bg-museum-cream/80 p-4 font-mono text-sm leading-relaxed text-museum-dark focus:outline-none"
              rows={16}
            />
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg bg-[#c48a5a] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#b37a4a] active:bg-[#a26b3a]"
            >
              <FileDown size={16} />
              导出巡检单
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
