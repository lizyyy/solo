
import React, { useState, useRef } from 'react';
import { Search, Filter, Upload, ChevronDown, ChevronUp, Eye, History, FileText, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useAppStore, ImportResult } from '../store/appStore';
import { getStatusLabel, getStatusColor, getSourceLabel, getSourceColor, formatDate } from '../utils';
import { SampleStatus, SourceType, Sample, DetectionResult, Evidence } from '../types';

interface ParsedRow {
  sampleId?: string;
  content: string;
  originalIntent: string;
  source: SourceType;
  modelIntent?: string;
  modelConfidence?: number;
  manualIntent?: string;
  isDrift?: boolean;
  driftScore?: number;
  _lineNo?: number;
  _raw?: string;
}

interface ParseError {
  lineNo: number;
  raw: string;
  reason: string;
}

interface ParseOutcome {
  rows: ParsedRow[];
  errors: ParseError[];
}

function parseHeader(line: string): string[] {
  return line.split(',').map((h) => h.trim().toLowerCase());
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function toSource(raw: string | undefined, fallback: SourceType): SourceType {
  if (!raw) return fallback;
  const r = raw.toLowerCase();
  if (r === 'manual' || r === '人工标注' || r === '人工') return 'manual';
  if (r === 'online' || r === '线上反馈' || r === '线上') return 'online';
  return 'model';
}

function parseCSV(text: string, fileSource: SourceType): ParseOutcome {
  const rawLines = text.replace(/\r\n/g, '\n').split('\n');
  const nonEmpty = rawLines.filter((l) => l.trim().length > 0);
  const outcome: ParseOutcome = { rows: [], errors: [] };
  if (nonEmpty.length === 0) return outcome;

  const headers = parseHeader(nonEmpty[0]);
  for (let i = 1; i < nonEmpty.length; i++) {
    const lineNo = i + 1;
    const raw = nonEmpty[i];
    const vals = splitCSVLine(raw);

    const get = (aliases: string[]): string | undefined => {
      for (const a of aliases) {
        const idx = headers.indexOf(a.toLowerCase());
        if (idx >= 0 && vals[idx] !== undefined && vals[idx] !== '') return vals[idx];
      }
      return undefined;
    };

    const sampleId = get(['sample_id', '样本id', 'id']);
    const content = get(['content', '对话内容', 'text', '对话']) ?? vals[0] ?? '';
    const originalIntent = get(['original_intent', '原始意图', 'intent', '标注意图']) ?? vals[1] ?? '';
    const sourceRaw = get(['source', '来源']);
    const source = toSource(sourceRaw, fileSource);
    const modelIntent = get(['model_intent', '模型判断', '模型输出意图', '模型意图']);
    const modelConfidenceStr = get(['model_confidence', '模型置信度', '置信度', 'confidence']);
    const manualIntent = get(['manual_intent', '人工标注意图', '人工意图', '人工标注']);
    const isDriftStr = get(['is_drift', '是否漂移', '漂移']);
    const driftScoreStr = get(['drift_score', '漂移分数', '漂移值', 'score']);

    if (!content || !originalIntent) {
      outcome.errors.push({
        lineNo,
        raw,
        reason: !content ? '缺少对话内容（content）字段' : '缺少原始意图（original_intent）字段',
      });
      continue;
    }

    outcome.rows.push({
      sampleId,
      content,
      originalIntent,
      source,
      modelIntent,
      modelConfidence: modelConfidenceStr ? parseFloat(modelConfidenceStr) : undefined,
      manualIntent,
      isDrift: isDriftStr ? isDriftStr === 'true' || isDriftStr === '是' || isDriftStr === '1' : undefined,
      driftScore: driftScoreStr ? parseFloat(driftScoreStr) : undefined,
      _lineNo: lineNo,
      _raw: raw,
    });
  }
  return outcome;
}

function parseJSON(text: string, fileSource: SourceType): ParseOutcome {
  const outcome: ParseOutcome = { rows: [], errors: [] };
  try {
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : [data];
    arr.forEach((item: Record<string, unknown>, idx: number) => {
      const content = String(item.content || item['对话内容'] || item.text || '');
      const originalIntent = String(item.original_intent || item['原始意图'] || item.intent || '');
      if (!content || !originalIntent) {
        outcome.errors.push({
          lineNo: idx + 1,
          raw: JSON.stringify(item).slice(0, 120),
          reason: !content ? '缺少 content（对话内容）字段' : '缺少 original_intent（原始意图）字段',
        });
        return;
      }
      outcome.rows.push({
        sampleId: item.sample_id || item.id ? String(item.sample_id || item.id) : undefined,
        content,
        originalIntent,
        source: toSource(String(item.source || item['来源'] || ''), fileSource),
        modelIntent: item.model_intent || item['模型判断'] ? String(item.model_intent || item['模型判断']) : undefined,
        modelConfidence: item.model_confidence ?? item['模型置信度'] ? Number(item.model_confidence ?? item['模型置信度']) : undefined,
        manualIntent: item.manual_intent || item['人工标注意图'] ? String(item.manual_intent || item['人工标注意图']) : undefined,
        isDrift: item.is_drift ?? item['是否漂移'] ? Boolean(item.is_drift ?? item['是否漂移']) : undefined,
        driftScore: item.drift_score ?? item['漂移分数'] ? Number(item.drift_score ?? item['漂移分数']) : undefined,
        _lineNo: idx + 1,
        _raw: JSON.stringify(item).slice(0, 120),
      });
    });
  } catch (err) {
    outcome.errors.push({ lineNo: 0, raw: text.slice(0, 120), reason: `JSON解析失败: ${(err as Error).message}` });
  }
  return outcome;
}

function detectSourceType(filename: string): { label: string; source: SourceType } {
  const lower = filename.toLowerCase();
  if (lower.includes('model') || lower.includes('模型') || lower.includes('输出')) {
    return { label: '模型输出日志', source: 'model' };
  }
  if (lower.includes('manual') || lower.includes('人工') || lower.includes('标注') || lower.includes('改判')) {
    return { label: '人工标注/修正数据', source: 'manual' };
  }
  if (lower.includes('online') || lower.includes('线上') || lower.includes('反馈')) {
    return { label: '线上反馈数据', source: 'online' };
  }
  return { label: '通用样本数据', source: 'model' };
}

function buildSampleAndDetection(
  row: ParsedRow,
  fileSource: SourceType,
  seq: number
): { sample: Sample; detection: DetectionResult } {
  const now = new Date().toISOString();
  const baseId = row.sampleId ? `IM_${row.sampleId}` : `S${Date.now()}_${seq}`;
  const sampleKey = row.sampleId || baseId;

  const isModelSource = (row.source || fileSource) === 'model';
  const hasRealModelOutput = !!(row.modelIntent && row.modelConfidence !== undefined);
  const modelIntent = row.modelIntent || row.originalIntent;
  const modelConfidence = row.modelConfidence ?? (isModelSource ? 0.68 : 0.5);
  const manualIntent = row.manualIntent;
  const driftScore = row.driftScore ?? (row.isDrift ? 0.45 + Math.random() * 0.25 : 0.1 + Math.random() * 0.18);
  const isDrift = row.isDrift ?? driftScore > 0.3;
  const hasConflict = !!(manualIntent && modelIntent && manualIntent !== modelIntent);

  const sources: SourceType[] = [row.source || fileSource];

  const sample: Sample = {
    id: baseId,
    sampleKey,
    content: row.content,
    originalIntent: row.originalIntent,
    source: row.source || fileSource,
    sources,
    status: 'detected',
    createdAt: now,
    updatedAt: now,
  };

  const evidences: Evidence[] = [
    {
      id: `${baseId}_E_model_${seq}`,
      type: 'model_output',
      content: `模型输出：【${modelIntent}】置信度 ${Math.round(modelConfidence * 100)}%；原始标注意图：【${row.originalIntent}】`,
      highlight: [modelIntent, row.originalIntent],
    },
    {
      id: `${baseId}_E_thr_${seq}`,
      type: 'threshold_config',
      content: `阈值版本 v2.1：漂移分数 > 0.30 判定为漂移，当前分数 ${driftScore.toFixed(2)}${isDrift ? '，已超过阈值，判定为漂移' : '，未超过阈值'}`,
      highlight: [driftScore.toFixed(2), 'v2.1'],
    },
    {
      id: `${baseId}_E_src_${seq}`,
      type: 'model_output',
      content: `来源：${getSourceLabel(row.source || fileSource)}；导入时间 ${formatDate(now)}${row.sampleId ? `；业务样本ID ${row.sampleId}` : ''}`,
      highlight: [getSourceLabel(row.source || fileSource)],
    },
  ];

  if (manualIntent) {
    evidences.push({
      id: `${baseId}_E_manual_${seq}`,
      type: 'manual_label',
      content: `人工标注意图：【${manualIntent}】${hasConflict ? '，与模型判断不一致，存在冲突，请复核' : ''}`,
      highlight: [manualIntent],
    });
  }

  const detection: DetectionResult = {
    id: `D_${baseId}`,
    sampleId: baseId,
    modelIntent,
    modelConfidence,
    manualIntent,
    isDrift,
    driftScore,
    thresholdVersion: 'v2.1',
    detectedAt: now,
    evidences,
    hasConflict,
  };

  return { sample, detection };
}

export const Samples: React.FC = () => {
  const { samples, detections, setSelectedSampleId, importSamples, resetToDefault } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SampleStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceType | 'all'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<null | {
    success: boolean;
    filename: string;
    fileLabel: string;
    result: ImportResult;
    errors: ParseError[];
  }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredSamples = samples.filter((sample) => {
    const matchesSearch = sample.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sample.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sample.sampleKey || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sample.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || sample.source === sourceFilter;
    return matchesSearch && matchesStatus && matchesSource;
  });

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  const getDetectionInfo = (sampleId: string) => detections.find((d) => d.sampleId === sampleId);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadResult(null);

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      if (!text) {
        setUploadResult({
          success: false,
          filename: file.name,
          fileLabel: detectSourceType(file.name).label,
          result: { createdSamples: 0, mergedSamples: 0, createdDetections: 0, mergedDetections: 0, skippedSamples: 0 },
          errors: [{ lineNo: 0, raw: '', reason: '文件内容为空' }],
        });
        return;
      }

      const ext = file.name.split('.').pop()?.toLowerCase();
      const { label, source: fileSource } = detectSourceType(file.name);

      let outcome: ParseOutcome;
      if (ext === 'json') {
        outcome = parseJSON(text, fileSource);
      } else {
        outcome = parseCSV(text, fileSource);
      }

      if (outcome.rows.length === 0) {
        setUploadResult({
          success: false,
          filename: file.name,
          fileLabel: label,
          result: { createdSamples: 0, mergedSamples: 0, createdDetections: 0, mergedDetections: 0, skippedSamples: 0 },
          errors: outcome.errors.length > 0
            ? outcome.errors
            : [{ lineNo: 0, raw: text.slice(0, 120), reason: '未解析出有效行，请确保 CSV 包含 content, original_intent 列，或 JSON 包含对应字段' }],
        });
        return;
      }

      const newSamples: Sample[] = [];
      const newDetections: DetectionResult[] = [];
      outcome.rows.forEach((row, idx) => {
        const { sample, detection } = buildSampleAndDetection(row, fileSource, idx);
        newSamples.push(sample);
        newDetections.push(detection);
      });

      const result = importSamples(newSamples, newDetections);

      setUploadResult({
        success: outcome.errors.length === 0,
        filename: file.name,
        fileLabel: label,
        result,
        errors: outcome.errors,
      });
    };

    reader.onerror = () => {
      setUploadResult({
        success: false,
        filename: file.name,
        fileLabel: detectSourceType(file.name).label,
        result: { createdSamples: 0, mergedSamples: 0, createdDetections: 0, mergedDetections: 0, skippedSamples: 0 },
        errors: [{ lineNo: 0, raw: '', reason: '文件读取失败' }],
      });
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">样本管理</h1>
          <p className="text-gray-500 mt-1">管理所有客服意图样本数据，支持按样本ID合并多来源材料</p>
        </div>
        <button
          onClick={resetToDefault}
          className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          重置为默认数据
        </button>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">拖拽文件到此处上传</p>
        <p className="text-sm text-gray-400 mt-1">支持 模型输出日志、人工修正、线上反馈 数据（CSV / JSON）</p>
        <p className="text-xs text-gray-400 mt-2">
          推荐列：sample_id, content, original_intent, source, model_intent, model_confidence, manual_intent, is_drift, drift_score
        </p>
        <p className="text-xs text-blue-500 mt-1">
          同 sample_id 的样本会合并为一条，多来源自动合并并生成检测证据链
        </p>
        <button
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          选择文件
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json,.txt"
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {uploadResult && (
        <div className={`p-4 rounded-lg border ${
          uploadResult.errors.length === 0
            ? 'bg-green-50 border-green-200'
            : uploadResult.result.createdSamples + uploadResult.result.mergedSamples > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start">
            {uploadResult.errors.length === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
            ) : uploadResult.result.createdSamples + uploadResult.result.mergedSamples > 0 ? (
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">
                文件「{uploadResult.filename}」（{uploadResult.fileLabel}）导入完成
              </p>
              <div className="grid grid-cols-5 gap-3 mt-3 text-sm">
                <div className="bg-white rounded p-2 border border-gray-200 text-center">
                  <div className="text-xs text-gray-500">新增样本</div>
                  <div className="text-lg font-bold text-blue-600">{uploadResult.result.createdSamples}</div>
                </div>
                <div className="bg-white rounded p-2 border border-gray-200 text-center">
                  <div className="text-xs text-gray-500">合并样本</div>
                  <div className="text-lg font-bold text-purple-600">{uploadResult.result.mergedSamples}</div>
                </div>
                <div className="bg-white rounded p-2 border border-gray-200 text-center">
                  <div className="text-xs text-gray-500">新增检测</div>
                  <div className="text-lg font-bold text-emerald-600">{uploadResult.result.createdDetections}</div>
                </div>
                <div className="bg-white rounded p-2 border border-gray-200 text-center">
                  <div className="text-xs text-gray-500">合并检测</div>
                  <div className="text-lg font-bold text-indigo-600">{uploadResult.result.mergedDetections}</div>
                </div>
                <div className="bg-white rounded p-2 border border-gray-200 text-center">
                  <div className="text-xs text-gray-500">跳过/坏行</div>
                  <div className="text-lg font-bold text-red-600">
                    {uploadResult.result.skippedSamples + uploadResult.errors.length}
                  </div>
                </div>
              </div>

              {uploadResult.errors.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-amber-700 mb-2">以下行未能成功导入，请检查后重试：</div>
                  <div className="max-h-56 overflow-auto bg-white border border-amber-200 rounded divide-y divide-amber-100">
                    {uploadResult.errors.map((err, i) => (
                      <div key={i} className="p-3 flex items-start gap-3">
                        <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-gray-700 flex-1">
                          <span className="font-mono bg-gray-100 px-1 rounded mr-2">第{err.lineNo || '?'}行</span>
                          <span className="text-red-600">{err.reason}</span>
                          {err.raw && (
                            <div className="mt-1 text-gray-500 bg-gray-50 p-1 rounded font-mono truncate">
                              原数据：{err.raw}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              className="ml-3 text-gray-400 hover:text-gray-600"
              onClick={() => setUploadResult(null)}
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索样本ID、业务ID或内容..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as SampleStatus | 'all')}
              >
                <option value="all">全部状态</option>
                <option value="pending">待检测</option>
                <option value="detected">已检测</option>
                <option value="reviewing">待复核</option>
                <option value="completed">已完成</option>
              </select>
              <select
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as SourceType | 'all')}
              >
                <option value="all">全部来源</option>
                <option value="model">模型输出</option>
                <option value="manual">人工标注</option>
                <option value="online">线上反馈</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  样本ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  内容预览
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  原始意图
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  来源
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  更新时间
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSamples.map((sample) => {
                const isExpanded = expandedRows.has(sample.id);
                const detection = getDetectionInfo(sample.id);

                return (
                  <React.Fragment key={sample.id}>
                    <tr
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                    detection?.isDrift ? 'bg-orange-50/50' : ''
                  }`}
                  onClick={() => toggleRow(sample.id)}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{sample.id}</div>
                    {sample.sampleKey && sample.sampleKey !== sample.id && (
                      <div className="text-xs text-gray-400">业务ID: {sample.sampleKey}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-600 max-w-md truncate">
                      {sample.content.split('\n')[0]}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{sample.originalIntent}</span>
                    {detection?.isDrift && (
                      <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">漂移</span>
                    )}
                    {detection?.hasConflict && (
                      <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">冲突</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSourceColor(
                          sample.source
                        )}`}
                      >
                        {getSourceLabel(sample.source)}
                      </span>
                      {sample.sources && sample.sources.length > 1 && (
                        <div className="text-xs text-gray-400 mt-1">
                          多来源: {sample.sources.map((s) => getSourceLabel(s)).join(' / ')}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                        sample.status
                      )}`}
                    >
                      {getStatusLabel(sample.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(sample.updatedAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded hover:bg-blue-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSampleId(sample.id);
                          window.location.hash = '#/detection';
                        }}
                        title="查看证据"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        className="p-1.5 text-gray-400 hover:text-purple-600 transition-colors rounded hover:bg-purple-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSampleId(sample.id);
                          window.location.hash = '#/review';
                        }}
                        title="进入复核"
                      >
                        <History className="w-5 h-5" />
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={7} className="bg-gray-50 px-6 py-4">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">完整对话内容</h4>
                          <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans">
                              {sample.content}
                            </pre>
                          </div>
                        </div>
                        {detection ? (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">检测信息 &amp; 证据链</h4>
                            <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-2">
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500">模型判断</span>
                                <span className="text-sm font-medium text-blue-700">{detection.modelIntent}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500">置信度</span>
                                <span className="text-sm font-medium">{(detection.modelConfidence * 100).toFixed(0)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500">漂移分数</span>
                                <span
                                  className={`text-sm font-medium ${
                                    detection.isDrift ? 'text-orange-600' : 'text-green-600'
                                  }`}
                                >
                                  {detection.driftScore.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500">阈值版本</span>
                                <span className="text-sm font-medium">{detection.thresholdVersion}</span>
                              </div>
                              {detection.manualIntent && (
                                <div className="flex justify-between">
                                  <span className="text-sm text-gray-500">人工标注</span>
                                  <span className="text-sm font-medium text-emerald-600">{detection.manualIntent}</span>
                                </div>
                              )}
                              {detection.hasConflict && (
                                <div className="mt-1 p-2 bg-amber-50 rounded border border-amber-200 text-xs text-amber-700">
                                  ⚠ 模型与人工标注存在冲突，请在"人工改判"页面复核
                                </div>
                              )}
                              <div className="pt-2 mt-2 border-t border-gray-100">
                                <div className="text-xs text-gray-500 mb-2">证据链（{detection.evidences.length} 条）</div>
                                <div className="space-y-1.5">
                                  {detection.evidences.map((e) => (
                                    <div key={e.id} className="text-xs bg-gray-50 rounded p-2 border border-gray-100">
                                      <span className="inline-block px-1.5 py-0.5 rounded bg-white border border-gray-200 mr-2 text-gray-600">
                                        {e.type === 'model_output' ? '模型输出' : e.type === 'manual_label' ? '人工标注' : '阈值配置'}
                                      </span>
                                      <span className="text-gray-700">{e.content}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">检测信息</h4>
                            <div className="bg-white p-4 rounded-lg border border-gray-200 text-sm text-gray-400 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              尚未生成检测，请在漂移检测页面点击"运行检测"
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            共 {filteredSamples.length} 条样本（总计 {samples.length} 条）
          </span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50">
              上一页
            </button>
            <span className="px-3 py-1 bg-blue-600 text-white rounded text-sm">1</span>
            <button className="px-3 py-1 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50">
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
