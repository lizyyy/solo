import { useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, Check, X, MapPin, Clipboard, File, ChevronRight, Sparkles, UploadCloud } from 'lucide-react';
import { parseExcelFile, autoDetectMapping, detectSourceType, formatDateTime } from '@/utils/data';
import { generateSampleData } from '@/utils/sampleData';
import { useAppStore } from '@/store/appStore';
import type { FieldMapping, SourceInfo, SourceType } from '@/types';

const greekFields = [
  { key: 'delta', label: 'Delta (Δ)', desc: '价格变动率' },
  { key: 'gamma', label: 'Gamma (Γ)', desc: 'Delta 变动率' },
  { key: 'theta', label: 'Theta (Θ)', desc: '时间损耗' },
  { key: 'vega', label: 'Vega (ν)', desc: '波动率敏感度' },
  { key: 'rho', label: 'Rho (ρ)', desc: '利率敏感度' },
  { key: 'label', label: '合约名称', desc: '标的/代码' },
  { key: 'strike', label: '行权价', desc: '执行价格' },
  { key: 'maturity', label: '到期日', desc: '期限' },
];

const sourceTypeLabels: Record<SourceType, { label: string; icon: typeof MapPin; color: string }> = {
  gis: { label: 'GIS 系统', icon: MapPin, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  inspection: { label: '巡检平板', icon: Clipboard, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  excel: { label: '临时 Excel', icon: FileSpreadsheet, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  manual: { label: '手动录入', icon: File, color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' },
};

export default function ImportPage() {
  const navigate = useNavigate();
  const importData = useAppStore(s => s.importData);
  const data = useAppStore(s => s.data);

  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [sourceType, setSourceType] = useState<SourceType>('excel');
  const [originalNotes, setOriginalNotes] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const headers = useMemo(() => {
    if (rawData.length === 0) return [];
    return Object.keys(rawData[0]);
  }, [rawData]);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    const parsed = await parseExcelFile(f);
    setRawData(parsed);
    const detected = autoDetectMapping(Object.keys(parsed[0] || {}));
    setMapping(detected);
    setSourceType(detectSourceType(f.name));
    setOriginalNotes(`周会截图原始备注 · ${f.name}`);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleLoadSample = () => {
    const sample = generateSampleData();
    setRawData(sample.raw);
    setMapping(sample.mapping);
    setSourceType(sample.sourceInfo.type);
    setOriginalNotes(sample.sourceInfo.originalNotes);
    setFile(new (window.File as any)([], sample.sourceInfo.fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  };

  const handleConfirm = () => {
    if (rawData.length === 0) return;
    const source: SourceInfo = {
      type: sourceType,
      fileName: file?.name || '手动导入',
      originalNotes,
      importTime: new Date().toISOString(),
    };
    importData(rawData, mapping, source);
    navigate('/cloud');
  };

  const mappedCount = Object.keys(mapping).filter(k => (mapping as Record<string, string | undefined>)[k]).length;

  return (
    <div className="h-full flex flex-col p-6 gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">导入期权希腊值数据</h2>
          <p className="text-xs text-slate-400 mt-1">支持 Excel (.xlsx) 和 CSV，保留原始字段名和备注，不强制统一命名</p>
        </div>
        {data.length > 0 && (
          <div className="text-xs text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-md border border-emerald-500/30">
            <Check size={12} />
            已导入 {data.length} 条记录
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <div className="col-span-5 flex flex-col gap-4">
          <div
            className={`flex-1 border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer ${
              isDragging
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-slate-600/50 hover:border-slate-500 bg-[#1a1f36]'
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,.xls"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center">
              <Upload className="w-8 h-8 text-cyan-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">拖拽文件到这里，或点击选择</p>
              <p className="text-xs text-slate-400 mt-1">支持 .xlsx .csv .xls，不限列顺序</p>
            </div>
            {file && (
              <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-700/40 rounded-lg border border-slate-600/30">
                <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-slate-200 font-mono">{file.name}</span>
                {file.size > 0 && (
                  <span className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setRawData([]);
                  }}
                  className="ml-2 p-1 hover:bg-slate-600/50 rounded"
                >
                  <X className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLoadSample();
              }}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 rounded-md transition-all"
            >
              <UploadCloud size={12} />
              或直接加载 12 条样例数据 →
            </button>
          </div>

          <div className="bg-[#1a1f36] rounded-xl p-5 border border-slate-700/50">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" />
              来源与备注（保留原始信息，不清洗）
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">数据来源</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(sourceTypeLabels) as SourceType[]).map(type => {
                    const info = sourceTypeLabels[type];
                    const Icon = info.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => setSourceType(type)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all ${
                          sourceType === type
                            ? info.color
                            : 'border-slate-700/50 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <Icon size={13} />
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">原始备注（保留周会截图里的信息）</label>
                <textarea
                  value={originalNotes}
                  onChange={e => setOriginalNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono resize-none focus:outline-none focus:border-cyan-500/50"
                  placeholder="不要删掉周会截图里的备注..."
                />
              </div>
              <div className="text-[10px] text-slate-500">
                导入时间：{formatDateTime(new Date().toISOString())}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-7 flex flex-col gap-4 min-h-0">
          <div className="bg-[#1a1f36] rounded-xl p-5 border border-slate-700/50 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white">字段映射（{mappedCount}/{greekFields.length} 已匹配）</h3>
              <div className="text-xs text-slate-500">自动识别，可手动修正</div>
            </div>
            <div className="space-y-2 overflow-y-auto pr-2 flex-1">
              {greekFields.map(field => {
                const mappedCol = (mapping as Record<string, string | undefined>)[field.key];
                return (
                  <div key={field.key} className="flex items-center gap-3 px-3 py-2.5 bg-slate-900/30 rounded-lg">
                    <div className="w-32 flex-shrink-0">
                      <div className="text-xs text-slate-200 font-medium">{field.label}</div>
                      <div className="text-[10px] text-slate-500">{field.desc}</div>
                    </div>
                    <div className="text-slate-600">→</div>
                    <select
                      value={mappedCol || ''}
                      onChange={e => setMapping(prev => ({ ...prev, [field.key]: e.target.value || undefined }))}
                      className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-md px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="">-- 不映射 --</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    {mappedCol ? (
                      <span className="text-emerald-400"><Check size={14} /></span>
                    ) : (
                      <span className="text-slate-600"><X size={14} /></span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {rawData.length > 0 && (
            <div className="bg-[#1a1f36] rounded-xl p-5 border border-slate-700/50 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white">数据预览（前 10 行 / 共 {rawData.length} 行）</h3>
                <button
                  onClick={handleConfirm}
                  disabled={mappedCount < 2}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-medium rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  确认导入，进入 3D 云台
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="overflow-auto flex-1 text-xs">
                <table className="w-full border-collapse font-mono">
                  <thead>
                    <tr className="sticky top-0 bg-slate-800">
                      {headers.map(h => (
                        <th key={h} className="px-2 py-2 text-left text-slate-400 font-medium border-b border-slate-700/50 whitespace-nowrap">
                          {h}
                          {(Object.values(mapping).includes(h)) && (
                            <span className="ml-1 text-[10px] text-cyan-400">✓</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawData.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        {headers.map(h => (
                          <td key={h} className="px-2 py-1.5 text-slate-300 whitespace-nowrap">
                            {String(row[h] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
