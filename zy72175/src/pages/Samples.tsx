
import React, { useState, useRef } from 'react';
import { Search, Filter, Upload, ChevronDown, ChevronUp, Eye, History, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getStatusLabel, getStatusColor, getSourceLabel, getSourceColor, formatDate } from '../utils';
import { SampleStatus, SourceType, Sample, DetectionResult } from '../types';

interface ParsedRow {
  content: string;
  originalIntent: string;
  source: SourceType;
  modelIntent?: string;
  modelConfidence?: number;
  manualIntent?: string;
  isDrift?: boolean;
  driftScore?: number;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map((v) => v.trim());
    if (vals.length < 2) continue;

    const get = (name: string) => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? vals[idx] : undefined;
    };

    const content = get('content') || get('对话内容') || vals[0] || '';
    const originalIntent = get('original_intent') || get('原始意图') || get('intent') || vals[1] || '';
    const sourceRaw = get('source') || get('来源') || 'model';

    let source: SourceType = 'model';
    if (sourceRaw === 'manual' || sourceRaw === '人工标注') source = 'manual';
    else if (sourceRaw === 'online' || sourceRaw === '线上反馈') source = 'online';

    const modelIntent = get('model_intent') || get('模型判断');
    const modelConfidenceStr = get('model_confidence') || get('模型置信度');
    const manualIntent = get('manual_intent') || get('人工标注意图');
    const isDriftStr = get('is_drift') || get('是否漂移');
    const driftScoreStr = get('drift_score') || get('漂移分数');

    rows.push({
      content,
      originalIntent,
      source,
      modelIntent,
      modelConfidence: modelConfidenceStr ? parseFloat(modelConfidenceStr) : undefined,
      manualIntent,
      isDrift: isDriftStr ? isDriftStr === 'true' || isDriftStr === '是' : undefined,
      driftScore: driftScoreStr ? parseFloat(driftScoreStr) : undefined,
    });
  }

  return rows;
}

function parseJSON(text: string): ParsedRow[] {
  try {
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : [data];
    return arr.map((item: Record<string, unknown>) => {
      const sourceRaw = String(item.source || item['来源'] || 'model');
      let source: SourceType = 'model';
      if (sourceRaw === 'manual' || sourceRaw === '人工标注') source = 'manual';
      else if (sourceRaw === 'online' || sourceRaw === '线上反馈') source = 'online';

      return {
        content: String(item.content || item['对话内容'] || ''),
        originalIntent: String(item.original_intent || item['原始意图'] || item.intent || ''),
        source,
        modelIntent: item.model_intent || item['模型判断'] ? String(item.model_intent || item['模型判断']) : undefined,
        modelConfidence: item.model_confidence ?? item['模型置信度'] ? Number(item.model_confidence ?? item['模型置信度']) : undefined,
        manualIntent: item.manual_intent || item['人工标注意图'] ? String(item.manual_intent || item['人工标注意图']) : undefined,
        isDrift: item.is_drift ?? item['是否漂移'] ? Boolean(item.is_drift ?? item['是否漂移']) : undefined,
        driftScore: item.drift_score ?? item['漂移分数'] ? Number(item.drift_score ?? item['漂移分数']) : undefined,
      };
    });
  } catch {
    return [];
  }
}

function detectSourceType(filename: string): { label: string; source: SourceType } {
  const lower = filename.toLowerCase();
  if (lower.includes('model') || lower.includes('模型') || lower.includes('输出')) {
    return { label: '模型输出日志', source: 'model' };
  }
  if (lower.includes('manual') || lower.includes('人工') || lower.includes('标注')) {
    return { label: '人工标注数据', source: 'manual' };
  }
  if (lower.includes('online') || lower.includes('线上') || lower.includes('反馈')) {
    return { label: '线上反馈数据', source: 'online' };
  }
  return { label: '未知来源', source: 'model' };
}

export const Samples: React.FC = () => {
  const { samples, detections, setSelectedSampleId, importSamples } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SampleStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceType | 'all'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredSamples = samples.filter((sample) => {
    const matchesSearch = sample.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sample.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sample.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || sample.source === sourceFilter;
    return matchesSearch && matchesStatus && matchesSource;
  });

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getDetectionInfo = (sampleId: string) => {
    return detections.find((d) => d.sampleId === sampleId);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadResult(null);

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setUploadResult({ success: false, message: '文件内容为空' });
        return;
      }

      const ext = file.name.split('.').pop()?.toLowerCase();
      let parsedRows: ParsedRow[] = [];

      if (ext === 'json') {
        parsedRows = parseJSON(text);
      } else {
        parsedRows = parseCSV(text);
      }

      if (parsedRows.length === 0) {
        setUploadResult({
          success: false,
          message: `无法从文件"${file.name}"中解析出有效数据。请确保CSV包含 content,original_intent 列，或JSON包含对应字段。`,
        });
        return;
      }

      const { label, source } = detectSourceType(file.name);
      const now = new Date().toISOString();
      const newSamples: Sample[] = [];
      const newDetections: DetectionResult[] = [];

      parsedRows.forEach((row, idx) => {
        const sampleId = `S${Date.now()}_${idx}`;
        newSamples.push({
          id: sampleId,
          content: row.content,
          originalIntent: row.originalIntent,
          source: row.source || source,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        });

        const hasModelData = row.modelIntent || row.modelConfidence !== undefined;
        if (hasModelData) {
          const driftScore = row.driftScore ?? (row.isDrift ? 0.5 + Math.random() * 0.4 : Math.random() * 0.2);
          newDetections.push({
            id: `D${Date.now()}_${idx}`,
            sampleId,
            modelIntent: row.modelIntent || row.originalIntent,
            modelConfidence: row.modelConfidence ?? 0.7,
            manualIntent: row.manualIntent,
            isDrift: row.isDrift ?? driftScore > 0.3,
            driftScore,
            thresholdVersion: 'v2.1',
            detectedAt: now,
            hasConflict: !!(row.manualIntent && row.modelIntent && row.manualIntent !== row.modelIntent),
            evidences: [
              {
                id: `E${Date.now()}_${idx}_1`,
                type: 'model_output',
                content: `模型输出：【${row.modelIntent || row.originalIntent}】置信度 ${Math.round((row.modelConfidence ?? 0.7) * 100)}%`,
                highlight: [row.modelIntent || row.originalIntent],
              },
              ...(row.manualIntent
                ? [{
                    id: `E${Date.now()}_${idx}_2`,
                    type: 'manual_label' as const,
                    content: `人工标注：【${row.manualIntent}】`,
                    highlight: [row.manualIntent],
                  }]
                : []),
            ],
          });
        }
      });

      importSamples(newSamples, newDetections);
      setUploadResult({
        success: true,
        message: `成功从"${file.name}"（${label}）导入 ${newSamples.length} 条样本，${newDetections.length} 条检测结果`,
      });
    };

    reader.onerror = () => {
      setUploadResult({ success: false, message: '文件读取失败' });
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">样本管理</h1>
          <p className="text-gray-500 mt-1">管理所有客服意图样本数据</p>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">拖拽文件到此处上传</p>
        <p className="text-sm text-gray-400 mt-1">支持模型输出日志、人工标注、线上反馈数据（CSV / JSON）</p>
        <p className="text-xs text-gray-400 mt-1">
          CSV格式：content, original_intent, source, model_intent, model_confidence, manual_intent, is_drift, drift_score
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
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {uploadResult && (
        <div
          className={`flex items-start gap-3 p-4 rounded-lg border ${
            uploadResult.success
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {uploadResult.success ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-medium">{uploadResult.success ? '导入成功' : '导入失败'}</p>
            <p className="text-sm mt-1">{uploadResult.message}</p>
          </div>
          <button
            className="ml-auto text-sm opacity-70 hover:opacity-100"
            onClick={() => setUploadResult(null)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索样本ID或内容..."
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  样本ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  内容预览
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  原始意图
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  来源
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  更新时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">{sample.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 max-w-md truncate">
                      {sample.content.split('\n')[0]}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{sample.originalIntent}</span>
                    {detection?.isDrift && (
                      <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                        漂移
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSourceColor(
                        sample.source
                      )}`}
                    >
                      {getSourceLabel(sample.source)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                        sample.status
                      )}`}
                    >
                      {getStatusLabel(sample.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(sample.updatedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSampleId(sample.id);
                          window.location.hash = '#/detection';
                        }}
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
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
                            <h4 className="text-sm font-medium text-gray-700 mb-2">检测信息</h4>
                            <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-2">
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500">模型判断</span>
                                <span className="text-sm font-medium">{detection.modelIntent}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500">置信度</span>
                                <span className="text-sm font-medium">
                                  {(detection.modelConfidence * 100).toFixed(0)}%
                                </span>
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
                                <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200 text-xs text-amber-700">
                                  ⚠ 模型与人工标注存在冲突，请在"人工改判"页面复核
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">检测信息</h4>
                            <div className="bg-white p-4 rounded-lg border border-gray-200 text-sm text-gray-400 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              尚未检测，请先运行漂移检测
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
            共 {filteredSamples.length} 条样本
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
