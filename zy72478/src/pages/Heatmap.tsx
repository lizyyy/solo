
import { useState } from 'react';
import {
  Map,
  Download,
  Moon,
  Sun,
  AlertTriangle,
  X,
  Link2,
  Bus,
  FileText,
  FileCheck,
  ChevronDown,
  ChevronUp,
  CheckCircle,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { HeatmapCanvas } from '../components/HeatmapCanvas';
import type { HeatmapPoint, ExportResult } from '../../shared/types';

interface EvidenceChainConflictRef {
  id: string;
  type: string;
  status: string;
}

interface EvidenceChainChangeRef {
  id: string;
  action: string;
  operator: string;
  reason?: string;
}

interface EvidenceChainResult {
  valid: boolean;
  error?: string;
  busSwipeId?: string;
  cardId?: string;
  swipeTime?: string;
  areaName?: string;
  heatmapPoints?: number;
  heatmapVersions?: string[];
  conflicts?: EvidenceChainConflictRef[];
  changes?: EvidenceChainChangeRef[];
  evidenceCount?: number;
  summary?: string;
}

export default function Heatmap() {
  const {
    heatmapData,
    selectedHeatmapVersion,
    setSelectedHeatmapVersion,
    currentProject,
    exportHeatmap,
    verifyEvidenceChain,
    busSwipes,
    conflicts,
    redlineNotes,
    addOperationLog,
  } = useAppStore();

  const [selectedPoint, setSelectedPoint] = useState<HeatmapPoint | null>(null);
  const [evidenceResult, setEvidenceResult] = useState<EvidenceChainResult | null>(null);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [exportPreview, setExportPreview] = useState<ExportResult | null>(null);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [showNightOnly, setShowNightOnly] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  const projectHeatmaps = heatmapData.filter((h) => h.projectId === currentProject?.id);
  const selectedHeatmap = projectHeatmaps.find((h) => h.id === selectedHeatmapVersion) || projectHeatmaps[0];

  const filteredData = selectedHeatmap
    ? selectedHeatmap.points.filter((point) => (showNightOnly ? point.isNight : true))
    : [];

  const handleExport = () => {
    if (!selectedHeatmap) return;
    const result = exportHeatmap(selectedHeatmap.id);
    setExportPreview(result);
    setShowExportPreview(true);
  };

  const handlePointClick = (point: HeatmapPoint) => {
    setSelectedPoint(point);
    if (point.busSwipeId) {
      const result = verifyEvidenceChain(point.busSwipeId);
      setEvidenceResult(result);
    } else {
      setEvidenceResult({ valid: false, error: '该热力点未关联公交刷卡记录' });
    }
    setShowEvidenceModal(true);
  };

  const relatedBus = selectedPoint?.busSwipeId
    ? busSwipes.find((b) => b.id === selectedPoint.busSwipeId)
    : null;

  const relatedRedline = selectedPoint?.areaName
    ? redlineNotes.filter((r) => r.areaName === selectedPoint.areaName)
    : [];

  const relatedConflicts = selectedPoint?.busSwipeId
    ? conflicts.filter((c) => c.busSwipeId === selectedPoint.busSwipeId)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">热力图分析</h1>
          <p className="text-gray-500 mt-1">可视化展示居民出行热力分布，支持证据链追溯</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNightOnly(!showNightOnly)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showNightOnly
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {showNightOnly ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {showNightOnly ? '仅夜间' : '全部时段'}
          </button>
          <button
            onClick={handleExport}
            disabled={!selectedHeatmap}
            className="flex items-center gap-2 px-4 py-2 bg-[#f59e0b] text-white rounded-lg hover:bg-[#d97706] transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            导出热力图
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Map className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-800">
                    {selectedHeatmap?.version || '暂无热力图数据'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedHeatmap
                      ? `共 ${selectedHeatmap.points.length} 个数据点，${
                          selectedHeatmap.points.filter((p) => p.isNight).length
                        } 个夜间点`
                      : '请先导入公交刷卡数据生成热力图'}
                  </p>
                </div>
              </div>
              {selectedHeatmap?.isNightLow && (
                <span className="flex items-center gap-1 text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                  <AlertTriangle className="w-3 h-3" />
                  夜间采样不足
                </span>
              )}
            </div>

            {selectedHeatmap ? (
              <div className="flex justify-center">
                <HeatmapCanvas
                  data={filteredData}
                  onPointClick={handlePointClick}
                />
              </div>
            ) : (
              <div className="h-[500px] flex items-center justify-center bg-gray-50 rounded-xl">
                <div className="text-center">
                  <Map className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">暂无热力图数据</p>
                  <p className="text-sm text-gray-400 mt-1">请先在导入页面导入公交刷卡数据</p>
                </div>
              </div>
            )}

            {selectedHeatmap && (
              <div className="flex flex-col items-center gap-3 mt-4">
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Link2 className="w-4 h-4 text-[#f59e0b]" />
                  点击热力点可查看完整业务证据链
                </p>
                <div className="flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                  <span className="text-gray-600">低密度</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span className="text-gray-600">中低密度</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                  <span className="text-gray-600">中高密度</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <span className="text-gray-600">高密度</span>
                </div>
              </div>
            )}
          </div>

          {selectedHeatmap && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">区域统计</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(selectedHeatmap.areaStats || {}).map(([area, stats]) => {
                  const areaPoints = selectedHeatmap.points.filter((p) => p.areaName === area);
                  return (
                  <div key={area} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-800">{area}</span>
                      <span className="text-xs text-gray-500">{areaPoints.length} 个点</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, stats.avgValue)}%`,
                            backgroundColor:
                              stats.avgValue >= 70
                                ? '#ef4444'
                                : stats.avgValue >= 40
                                  ? '#eab308'
                                  : '#22c55e',
                          }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700 w-12 text-right">
                        {stats.avgValue}
                      </span>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">热力图版本</h3>
            <div className="space-y-2">
              {projectHeatmaps.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">暂无版本记录</p>
              )}
              {projectHeatmaps.map((heatmap) => {
                const isExpanded = expandedVersion === heatmap.id;
                const isSelected = selectedHeatmapVersion === heatmap.id;
                return (
                  <div
                    key={heatmap.id}
                    className={`rounded-lg border transition-colors ${
                      isSelected ? 'border-orange-300 bg-orange-50' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setSelectedHeatmapVersion(heatmap.id);
                        setExpandedVersion(isExpanded ? null : heatmap.id);
                      }}
                      className="w-full p-3 flex items-center justify-between text-left"
                    >
                      <div>
                        <p className={`font-medium text-sm ${isSelected ? 'text-orange-700' : 'text-gray-800'}`}>
                          {heatmap.version}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(heatmap.calculatedAt).toLocaleString()}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-gray-100 pt-3 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">数据来源</span>
                          <span className="text-gray-700">
                            {heatmap.source === 'supplement' ? '补录数据' : '手动重算'}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">数据点数</span>
                          <span className="text-gray-700">{heatmap.points.length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">基于刷卡记录</span>
                          <span className="text-gray-700">{heatmap.sourceBusCount} 条</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{heatmap.description}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#1e3a5f] rounded-xl p-5 text-white">
            <h3 className="font-semibold mb-3">操作提示</h3>
            <ul className="space-y-2 text-sm text-white/80">
              <li>• 点击热力图上的点可查看证据链详情</li>
              <li>• 每个热力点可追溯到原始公交刷卡记录</li>
              <li>• 切换"仅夜间"可单独查看夜间出行分布</li>
              <li>• 导出功能会包含所有关联的证据信息</li>
              <li>• 夜间采样不足的版本需要规划员复核</li>
            </ul>
          </div>
        </div>
      </div>

      {showEvidenceModal && selectedPoint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-800">业务证据链</h2>
                  <p className="text-sm text-gray-500">热力点完整数据追溯</p>
                </div>
              </div>
              <button
                onClick={() => setShowEvidenceModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Map className="w-4 h-4 text-blue-600" />
                  <h3 className="font-medium text-blue-800">热力点信息</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-600">区域名称</span>
                    <span className="text-blue-900 font-medium">{selectedPoint.areaName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">热力值</span>
                    <span className="text-blue-900 font-medium">{Math.round(selectedPoint.value)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">时段类型</span>
                    <span className="text-blue-900 font-medium">
                      {selectedPoint.isNight ? '夜间' : '日间'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">小时</span>
                    <span className="text-blue-900 font-medium">{selectedPoint.hourOfDay}:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">坐标</span>
                    <span className="text-blue-900 font-medium">
                      ({Math.round(selectedPoint.x)}, {Math.round(selectedPoint.y)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">数据口径</span>
                    <span className="text-blue-900 font-medium">
                      {selectedPoint.source === 'normal'
                        ? '正常口径'
                        : selectedPoint.source === 'supplement'
                          ? '补录数据'
                          : '错口径'}
                    </span>
                  </div>
                </div>
              </div>

              {relatedBus && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Bus className="w-4 h-4 text-green-600" />
                    <h3 className="font-medium text-gray-800">关联公交刷卡记录</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">记录ID</span>
                      <span className="text-gray-800 font-mono">{relatedBus.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">卡号</span>
                      <span className="text-gray-800 font-mono">{relatedBus.cardId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">刷卡时间</span>
                      <span className="text-gray-800">{relatedBus.swipeTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">线路</span>
                      <span className="text-gray-800">{relatedBus.route}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">站点</span>
                      <span className="text-gray-800">{relatedBus.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">数据来源</span>
                      <span className="text-gray-800">
                        {relatedBus.sourceFile || '系统导入'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {relatedRedline.length > 0 && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <h3 className="font-medium text-gray-800">
                      关联红线备注（{relatedRedline.length}）
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {relatedRedline.map((note) => (
                      <div key={note.id} className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">{note.recordDate}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                            {note.source === 'normal' ? '正常口径' : '补录数据'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{note.remark}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {relatedConflicts.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <h3 className="font-medium text-red-800">
                      关联冲突记录（{relatedConflicts.length}）
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {relatedConflicts.map((conflict) => (
                      <div key={conflict.id} className="bg-white rounded-lg p-3 border border-red-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">
                            {new Date(conflict.detectedAt).toLocaleString()}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              conflict.status === 'pending'
                                ? 'bg-orange-100 text-orange-700'
                                : conflict.status === 'confirmed'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {conflict.status === 'pending'
                              ? '待处理'
                              : conflict.status === 'confirmed'
                                ? '已确认'
                                : '已驳回'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{conflict.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {evidenceResult && (
                <div
                  className={`rounded-xl p-4 border ${
                    evidenceResult.valid
                      ? 'bg-green-50 border-green-100'
                      : 'bg-red-50 border-red-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FileCheck
                      className={`w-4 h-4 ${
                        evidenceResult.valid ? 'text-green-600' : 'text-red-600'
                      }`}
                    />
                    <h3
                      className={`font-medium ${
                        evidenceResult.valid ? 'text-green-800' : 'text-red-800'
                      }`}
                    >
                      验证结果
                    </h3>
                  </div>
                  {evidenceResult.valid ? (
                    <div className="space-y-2">
                      <p className="text-sm text-green-700">{evidenceResult.summary}</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-green-600">关联热力点</span>
                          <span className="text-green-900 font-medium">
                            {evidenceResult.heatmapPoints} 个
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-600">热力图版本</span>
                          <span className="text-green-900 font-medium">
                            {evidenceResult.heatmapVersions?.length || 0} 版
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-600">冲突记录</span>
                          <span className="text-green-900 font-medium">
                            {evidenceResult.conflicts?.length || 0} 条
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-600">变更记录</span>
                          <span className="text-green-900 font-medium">
                            {evidenceResult.changes?.length || 0} 条
                          </span>
                        </div>
                      </div>
                      {evidenceResult.heatmapVersions && evidenceResult.heatmapVersions.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-green-200">
                          <p className="text-xs text-green-600 mb-1">出现在以下版本：</p>
                          <div className="flex flex-wrap gap-1">
                            {evidenceResult.heatmapVersions.map((v, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded"
                              >
                                {v}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-green-200">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          证据链完整，共 {evidenceResult.evidenceCount} 项证据
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-red-700">{evidenceResult.error}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showExportPreview && exportPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Download className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-800">导出预览</h2>
                  <p className="text-sm text-gray-500">{exportPreview.fileName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowExportPreview(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">导出行数</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{exportPreview.rowCount}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-600">导出状态</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">成功</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">内容预览（前3行）</p>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-xs text-green-400 whitespace-pre-wrap">
                    {exportPreview.contentPreview}
                  </pre>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowExportPreview(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <a
                  href={exportPreview.downloadUrl}
                  download={exportPreview.fileName}
                  onClick={() => {
                    addOperationLog('下载热力图导出', exportPreview.fileName);
                    setShowExportPreview(false);
                  }}
                  className="flex-1 px-4 py-2.5 bg-[#f59e0b] text-white rounded-lg hover:bg-[#d97706] transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  确认下载
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
        </div>
      )}
    </div>
  );
}
