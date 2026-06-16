import React, { useState, useCallback } from 'react';
import { Upload, FileText, Database, Trash2, ChevronRight, Info, ArrowRight, Check, AlertTriangle, Sheet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { MealPoint, ColumnMapping, SYSTEM_FIELDS, SOURCE_ALIASES, PointSource } from '../types';
import { generateId } from '../utils/storage';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'done';

const AUTO_MAP_KEYS: Record<string, string[]> = {
  name: ['点位名称', '名称', 'name', '点位名', '站点名称', '食堂名称', '助餐点名称'],
  address: ['详细地址', '地址', 'address', 'addr', '位置', '点位地址'],
  lat: ['纬度', 'lat', 'latitude', 'y', 'LAT'],
  lng: ['经度', 'lng', 'longitude', 'x', 'LNG', 'lon'],
  source: ['数据来源', '来源', 'source', '来源类型'],
  notes: ['备注', 'notes', '说明', '描述', '情况说明', '备注信息'],
};

function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { name: '', address: '', lat: '', lng: '', source: '', notes: '' };
  for (const [field, aliases] of Object.entries(AUTO_MAP_KEYS)) {
    for (const header of headers) {
      const h = header.trim();
      if (aliases.includes(h) || aliases.some((a) => h.toLowerCase() === a.toLowerCase())) {
        (mapping as any)[field] = header;
        break;
      }
    }
  }
  return mapping;
}

function normalizeSource(raw: string): PointSource {
  const trimmed = raw.trim();
  if (SOURCE_ALIASES[trimmed]) return SOURCE_ALIASES[trimmed];
  const lower = trimmed.toLowerCase();
  for (const [alias, value] of Object.entries(SOURCE_ALIASES)) {
    if (alias.toLowerCase() === lower) return value;
  }
  return 'GIS';
}

function detectPointType(name: string, address: string, source: PointSource): MealPoint['type'] {
  if (!name.trim() && !address.trim()) return 'empty';
  if (!name.trim()) return 'empty';
  if (name.includes('旧') || address.includes('旧') || address.includes('前使用')) return 'legacy';
  if (address.includes('交界') || name.includes('边界')) return 'boundary';
  return 'smooth';
}

export function DataImportPage() {
  const { points, loadSampleData, clearAllData, addPoints, setCurrentStep } = useApp();
  const [step, setStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ name: '', address: '', lat: '', lng: '', source: '', notes: '' });
  const [mappedPreview, setMappedPreview] = useState<MealPoint[]>([]);
  const [importMessage, setImportMessage] = useState('');

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }, []);

  const parseFile = (file: File) => {
    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      setImportMessage('仅支持 CSV 或 Excel 格式文件（.csv/.xlsx/.xls）');
      return;
    }
    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          const rows = (results.data as Record<string, any>[]).map((r) => {
            const clean: Record<string, string> = {};
            for (const [k, v] of Object.entries(r)) clean[k] = v == null ? '' : String(v);
            return clean;
          });
          setRawHeaders(headers);
          setRawRows(rows);
          const detected = autoDetectMapping(headers);
          setMapping(detected);
          setStep('mapping');
          setImportMessage('');
        },
        error: () => {
          setImportMessage('CSV 文件解析失败，请检查文件格式');
        },
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheet];
          const json = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '', raw: false });
          if (json.length === 0) {
            setImportMessage('Excel 工作表为空，请检查文件内容');
            return;
          }
          const headers = Object.keys(json[0]);
          const rows = json.map((r: Record<string, any>) => {
            const clean: Record<string, string> = {};
            for (const [k, v] of Object.entries(r)) clean[k] = v == null ? '' : String(v);
            return clean;
          });
          setRawHeaders(headers);
          setRawRows(rows);
          const detected = autoDetectMapping(headers);
          setMapping(detected);
          setStep('mapping');
          setImportMessage('');
        } catch {
          setImportMessage('Excel 文件解析失败，请检查文件格式');
        }
      };
      reader.onerror = () => setImportMessage('读取文件失败');
      reader.readAsArrayBuffer(file);
    }
  };

  const applyMapping = () => {
    const mapped: MealPoint[] = rawRows.map((row, index) => {
      const name = mapping.name ? (row[mapping.name] || '').trim() : '';
      const address = mapping.address ? (row[mapping.address] || '').trim() : '';
      const latStr = mapping.lat ? (row[mapping.lat] || '') : '';
      const lngStr = mapping.lng ? (row[mapping.lng] || '') : '';
      const sourceRaw = mapping.source ? (row[mapping.source] || '').trim() : '';
      const notesRaw = mapping.notes ? (row[mapping.notes] || '').trim() : '';

      const lat = parseFloat(latStr) || 31.23;
      const lng = parseFloat(lngStr) || 121.47;
      const source = normalizeSource(sourceRaw);
      const type = detectPointType(name, address, source);

      return {
        id: `import-${Date.now()}-${index}`,
        name,
        address,
        lat,
        lng,
        source,
        status: 'pending' as MealPoint['status'],
        type,
        mergeHistory: [],
        notes: notesRaw,
        sourceRow: { ...row },
        fileName,
        sourceRowNumber: index + 2,
        auditTrail: [{
          id: generateId(),
          action: 'import' as const,
          operator: '系统',
          remark: `从文件 ${fileName} 第${index + 2}行导入，列映射：名称←"${mapping.name}" 地址←"${mapping.address}"`,
          timestamp: new Date(),
        }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }).filter((p) => p.name || p.address);

    setMappedPreview(mapped);
    setStep('preview');
  };

  const handleConfirmImport = () => {
    addPoints(mappedPreview);
    setImportMessage(`成功导入 ${mappedPreview.length} 条点位数据（来自 ${fileName}）`);
    setStep('done');
  };

  const unmappedRequired = SYSTEM_FIELDS.filter((f) => f.required && !mapping[f.key]);
  const mappedCount = SYSTEM_FIELDS.filter((f) => mapping[f.key]).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary-700">数据导入</h1>
          <p className="mt-1 text-sm text-gray-500">导入GIS点位、居民反馈、巡检记录和街道备注</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadSampleData}
            className="inline-flex items-center px-4 py-2 bg-warm-500 text-white rounded-lg hover:bg-warm-600 transition-colors shadow-md hover:shadow-lg"
          >
            <Database className="w-4 h-4 mr-2" />
            加载样例数据
          </button>
          {points.length > 0 && (
            <button
              onClick={clearAllData}
              className="inline-flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              清空数据
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'mapping', 'preview', 'done'] as ImportStep[]).map((s, i) => {
          const labels = ['上传文件', '列名映射', '预览确认', '导入完成'];
          const stepIdx = ['upload', 'mapping', 'preview', 'done'].indexOf(step);
          const isActive = s === step;
          const isPast = i < stepIdx;
          return (
            <React.Fragment key={s}>
              {i > 0 && <ArrowRight className="w-4 h-4 text-gray-300" />}
              <span className={`px-3 py-1 rounded-full ${isActive ? 'bg-primary-600 text-white' : isPast ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {isPast && <Check className="w-3 h-3 inline mr-1" />}
                {labels[i]}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {importMessage && (
        <div className={`p-4 rounded-lg ${step === 'done' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
          {importMessage}
        </div>
      )}

      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50/50'
            }`}
          >
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">拖拽 CSV / Excel 文件到此处</p>
            <p className="text-sm text-gray-500 mb-4">或点击下方按钮选择文件</p>
            <div className="flex items-center justify-center gap-3">
              <label className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg cursor-pointer hover:bg-primary-700 transition-colors">
                <FileText className="w-4 h-4 mr-2" />
                选择 CSV
                <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
              </label>
              <label className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg cursor-pointer hover:bg-emerald-700 transition-colors">
                <Sheet className="w-4 h-4 mr-2" />
                选择 Excel
                <input type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
              </label>
            </div>
            <p className="mt-4 text-xs text-gray-400">支持 .csv / .xlsx / .xls · 任意列名，下一步可映射</p>
          </div>

          <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl p-6 text-white">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Info className="w-5 h-5 mr-2" />
              多源台账格式说明
            </h3>
            <div className="space-y-3 text-sm text-primary-100">
              <p>• 上传 CSV 或 Excel 后进入<strong className="text-white">列名映射</strong>步骤</p>
              <p>• 系统自动识别常见列名（点位名称/地址/纬度/经度）</p>
              <p>• 未匹配的列可手动指定对应关系</p>
              <p>• 原始行数据完整保留，可在复核和报告中查看</p>
              <p>• 数据来源自动归一（GIS点位→GIS、居民反馈→feedback）</p>
              <p>• 可多次导入不同来源台账，后续在补录差异中对照</p>
            </div>
            <div className="mt-4 p-3 bg-white/10 rounded-lg space-y-2">
              <p className="text-xs text-primary-200">可下载样例文件体验完整流程：</p>
              <div className="flex flex-wrap gap-2">
                <a href="/sample.csv" download="社区养老助餐配送台账样例.csv" className="inline-flex items-center px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-white text-sm transition-colors">
                  <Download className="w-4 h-4 mr-1" />
                  下载样例CSV
                </a>
                <a href="/sample.xlsx" download="社区养老助餐配送台账样例.xlsx" className="inline-flex items-center px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-white text-sm transition-colors">
                  <Download className="w-4 h-4 mr-1" />
                  下载样例Excel
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'mapping' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">列名映射</h3>
              <span className="text-sm text-gray-500">文件：{fileName} · 共 {rawRows.length} 行 · 识别 {rawHeaders.length} 列</span>
            </div>

            {unmappedRequired.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                必填字段未映射：{unmappedRequired.map((f) => f.label).join('、')}
              </div>
            )}

            <div className="space-y-4">
              {SYSTEM_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-4">
                  <div className="w-32 text-right">
                    <span className={`text-sm font-medium ${field.required ? 'text-gray-900' : 'text-gray-500'}`}>
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <select
                    value={mapping[field.key]}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">-- 不映射 --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  {mapping[field.key] && (
                    <span className="text-xs text-green-600 flex-shrink-0">✓ {mapping[field.key]}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => { setStep('upload'); setRawHeaders([]); setRawRows([]); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
              >
                ← 重新上传
              </button>
              <button
                onClick={applyMapping}
                disabled={unmappedRequired.length > 0}
                className="inline-flex items-center px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一步：预览数据
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-700">原始数据预览（前5行）</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {rawHeaders.map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rawRows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {rawHeaders.map((h) => (
                        <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-xs truncate">{row[h] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-primary-50 border-b border-primary-200 flex items-center justify-between">
              <h3 className="font-semibold text-primary-800">映射结果预览</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-primary-600">
                  共 {mappedPreview.length} 条 · 已映射 {mappedCount} 个字段
                </span>
                <button
                  onClick={handleConfirmImport}
                  className="inline-flex items-center px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Check className="w-4 h-4 mr-2" />
                  确认导入
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">行号</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">点位名称</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">地址</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">坐标</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">来源(原始)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">来源(归一)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">类型</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">备注</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mappedPreview.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500">{p.sourceRowNumber}</td>
                      <td className="px-3 py-2 text-gray-900 font-medium">{p.name || <span className="text-rose-500">(空)</span>}</td>
                      <td className="px-3 py-2 text-gray-700">{p.address}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{mapping.source ? p.sourceRow[mapping.source] : '-'}</td>
                      <td className="px-3 py-2"><StatusBadge type="source" value={p.source} /></td>
                      <td className="px-3 py-2"><StatusBadge type="pointType" value={p.type} /></td>
                      <td className="px-3 py-2 text-gray-500 text-xs max-w-32 truncate">{p.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('mapping')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
            >
              ← 返回修改映射
            </button>
            <button
              onClick={handleConfirmImport}
              className="inline-flex items-center px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Check className="w-4 h-4 mr-2" />
              确认导入 {mappedPreview.length} 条数据
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <Check className="w-12 h-12 mx-auto text-green-500 mb-3" />
          <h3 className="text-lg font-semibold text-green-800 mb-2">导入完成</h3>
          <p className="text-green-700 mb-4">{importMessage}</p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => {
                setStep('upload');
                setRawHeaders([]);
                setRawRows([]);
                setMappedPreview([]);
                setFileName('');
                setImportMessage('');
              }}
              className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            >
              继续导入
            </button>
            <button
              onClick={() => setCurrentStep('merge')}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              前往点位归并
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {points.length > 0 && step === 'upload' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">已导入数据 ({points.length} 条)</h3>
            <button
              onClick={() => setCurrentStep('merge')}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              前往点位归并
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">点位名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">地址</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">来源文件</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">来源</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">类型</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {points.map((point) => (
                  <tr key={point.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium">{point.name || '(未命名)'}</td>
                    <td className="px-4 py-3 text-gray-600">{point.address}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{point.fileName || '样例数据'}</td>
                    <td className="px-4 py-3"><StatusBadge type="source" value={point.source} /></td>
                    <td className="px-4 py-3"><StatusBadge type="pointType" value={point.type} /></td>
                    <td className="px-4 py-3"><StatusBadge type="status" value={point.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Download(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
