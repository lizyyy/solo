import { useEffect, useState, useMemo } from 'react';
import {
  Database,
  AlertTriangle,
  CheckCircle,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
} from 'lucide-react';
import { useCanonicalStore, useAnnotationRows } from '../store/canonicalStore';
import { checkConsistency } from '../services/consistencyService';
import { Crack3DView } from '../components/Crack3DView';
import { StatusBadge } from '../components/StatusBadge';
import { TraceInfoPanel } from '../components/TraceInfoPanel';
import type { AnnotationRow } from '../types';
import { formatTimestamp } from '../utils/checksum';
import { SELF_CHECK_LABELS } from '../types';

export function Overview() {
  const {
    canonicalResult,
    loadCanonicalResult,
    isLoading,
    currentOperator,
    exportFile,
    selfCheckResults,
    loadSelfCheckResults,
  } = useCanonicalStore();

  const allRows = useAnnotationRows();
  const missingRows = useMemo(() => allRows.filter(r => r.status === 'missing_row'), [allRows]);

  const [selectedRow, setSelectedRow] = useState<AnnotationRow | null>(null);
  const [consistencyResult, setConsistencyResult] = useState<{
    pageMatchesApi: boolean;
    pageMatchesExport: boolean;
    apiMatchesExport: boolean;
    allConsistent: boolean;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCanonicalResult();
    loadSelfCheckResults();
  }, [loadCanonicalResult, loadSelfCheckResults]);

  const filteredRows = allRows.filter(
    (row) =>
      row.crackId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.photoNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCheckConsistency = async () => {
    const result = await checkConsistency(currentOperator);
    setConsistencyResult(result);
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    await exportFile(format, '桥梁裂缝三维标注结果');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">标注总览</h1>
          <p className="text-sm text-gray-500 mt-1">
            查看桥梁裂缝三维标注结果，所有展示、导出、接口读取同一份数据
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleCheckConsistency} className="btn-industrial-outline flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            一致性校验
          </button>
          <button onClick={() => handleExport('csv')} className="btn-industrial-outline flex items-center gap-2">
            <FileText className="w-4 h-4" />
            导出CSV
          </button>
          <button onClick={() => handleExport('xlsx')} className="btn-industrial flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            导出Excel
          </button>
        </div>
      </div>

      {canonicalResult && (
        <div className="grid grid-cols-4 gap-4">
          <div className="card-industrial p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 text-primary-600">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500">单一数据源版本</p>
                <p className="text-xl font-bold text-gray-800 font-mono">{canonicalResult.version}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              生成于 {formatTimestamp(canonicalResult.generatedAt)}
            </p>
          </div>

          <div className="card-industrial p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500">标注总数</p>
                <p className="text-xl font-bold text-gray-800">{canonicalResult.rowCount}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              校验和 <span className="font-mono">{canonicalResult.checksum.slice(0, 16)}...</span>
            </p>
          </div>

          <div className={`card-industrial p-4 ${missingRows.length > 0 ? 'border-warning-500' : ''}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 ${missingRows.length > 0 ? 'bg-warning-100 text-warning-500 animate-blink' : 'bg-gray-100 text-gray-500'}`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500">缺行待复核</p>
                <p className={`text-xl font-bold ${missingRows.length > 0 ? 'text-warning-500' : 'text-gray-800'}`}>
                  {canonicalResult.missingRowCount}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {missingRows.length > 0 ? '请安全员复核后再处理' : '无异常记录'}
            </p>
          </div>

          <div className="card-industrial p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 ${consistencyResult?.allConsistent ? 'bg-success-100 text-success-500' : 'bg-gray-100 text-gray-500'}`}>
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500">一致性状态</p>
                <p className={`text-xl font-bold ${consistencyResult?.allConsistent ? 'text-success-500' : 'text-gray-800'}`}>
                  {consistencyResult ? (consistencyResult.allConsistent ? '一致' : '不一致') : '未校验'}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              页面/接口/导出{consistencyResult ? (consistencyResult.allConsistent ? '完全一致' : '存在差异') : '点击按钮校验'}
            </p>
          </div>
        </div>
      )}

      {consistencyResult && (
        <div className={`card-industrial p-4 ${consistencyResult.allConsistent ? 'border-success-500' : 'border-danger-500'}`}>
          <h3 className="font-semibold text-gray-800 mb-3">一致性校验结果</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              {consistencyResult.pageMatchesApi ? (
                <CheckCircle className="w-4 h-4 text-success-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-danger-500" />
              )}
              <span className="text-gray-700">页面 ↔ 接口</span>
              <span className={consistencyResult.pageMatchesApi ? 'text-success-500' : 'text-danger-500'}>
                {consistencyResult.pageMatchesApi ? '一致' : '不一致'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {consistencyResult.pageMatchesExport ? (
                <CheckCircle className="w-4 h-4 text-success-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-danger-500" />
              )}
              <span className="text-gray-700">页面 ↔ 导出</span>
              <span className={consistencyResult.pageMatchesExport ? 'text-success-500' : 'text-danger-500'}>
                {consistencyResult.pageMatchesExport ? '一致' : '不一致'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {consistencyResult.apiMatchesExport ? (
                <CheckCircle className="w-4 h-4 text-success-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-danger-500" />
              )}
              <span className="text-gray-700">接口 ↔ 导出</span>
              <span className={consistencyResult.apiMatchesExport ? 'text-success-500' : 'text-danger-500'}>
                {consistencyResult.apiMatchesExport ? '一致' : '不一致'}
              </span>
            </div>
          </div>
        </div>
      )}

      {missingRows.length > 0 && (
        <div className="card-industrial p-4 border-warning-500 bg-orange-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-warning-500" />
            <h3 className="font-semibold text-gray-800">异常记录 - 照片有点位但坐标表缺一行</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            以下记录检测到"照片有点位但坐标表缺一行"，已标记为<span className="text-warning-500 font-medium">缺行待复核</span>，
            需安全员复核后才能继续处理，不会自动归为正常。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-orange-100">
                  <th className="table-header-cell">裂缝编号</th>
                  <th className="table-header-cell">原始行号</th>
                  <th className="table-header-cell">照片编号</th>
                  <th className="table-header-cell">三维坐标</th>
                  <th className="table-header-cell">状态</th>
                  <th className="table-header-cell">操作</th>
                </tr>
              </thead>
              <tbody>
                {missingRows.map((row) => (
                  <tr key={row.id} className="missing-row-highlight hover:bg-orange-100">
                    <td className="table-cell font-mono font-medium">{row.crackId}</td>
                    <td className="table-cell font-mono">{row.originalLineNumber}</td>
                    <td className="table-cell">{row.photoNumber}</td>
                    <td className="table-cell font-mono text-gray-500">
                      ({row.x3d.toFixed(2)}, {row.y3d.toFixed(2)}, {row.z3d.toFixed(2)})
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => setSelectedRow(row)}
                        className="text-primary-600 hover:text-primary-800 text-sm"
                      >
                        查看追溯
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allRows.length > 0 && <Crack3DView rows={allRows} onRowClick={setSelectedRow} />}

      <div className="card-industrial p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">标注明细表格</h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索裂缝编号或照片编号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-industrial pl-9 w-64"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header-cell">裂缝编号</th>
                <th className="table-header-cell">原始行号</th>
                <th className="table-header-cell">照片编号</th>
                <th className="table-header-cell">X坐标</th>
                <th className="table-header-cell">Y坐标</th>
                <th className="table-header-cell">Z坐标</th>
                <th className="table-header-cell">状态</th>
                <th className="table-header-cell">遮挡</th>
                <th className="table-header-cell">追溯</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-gray-50 ${row.status === 'missing_row' ? 'missing-row-highlight' : ''}`}
                >
                  <td className="table-cell font-mono font-medium">{row.crackId}</td>
                  <td className="table-cell font-mono">{row.originalLineNumber}</td>
                  <td className="table-cell">{row.photoNumber}</td>
                  <td className="table-cell font-mono">{row.x3d.toFixed(2)}</td>
                  <td className="table-cell font-mono">{row.y3d.toFixed(2)}</td>
                  <td className="table-cell font-mono">{row.z3d.toFixed(2)}</td>
                  <td className="table-cell">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="table-cell">
                    {row.isOccluded ? (
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5">是</span>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5">否</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() => setSelectedRow(row)}
                      className="text-primary-600 hover:text-primary-800 text-sm"
                    >
                      查看链路
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-industrial p-4">
        <h3 className="font-bold text-gray-800 mb-3">自检状态概览</h3>
        <div className="grid grid-cols-4 gap-4">
          {(Object.keys(selfCheckResults) as Array<keyof typeof selfCheckResults>).map((type) => {
            const result = selfCheckResults[type];
            return (
              <div key={type} className={`p-4 border-2 ${result?.passed ? 'border-success-500 bg-green-50' : result ? 'border-warning-500 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result?.passed ? (
                    <CheckCircle className="w-5 h-5 text-success-500" />
                  ) : result ? (
                    <AlertTriangle className="w-5 h-5 text-warning-500" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                  <span className="font-medium text-gray-700">{SELF_CHECK_LABELS[type]}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {result ? result.message : '未执行检测'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {selectedRow && (
        <TraceInfoPanel
          traceInfo={selectedRow.traceInfo}
          originalLineNumber={selectedRow.originalLineNumber}
          onClose={() => setSelectedRow(null)}
        />
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-xl">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-600">处理中...</p>
          </div>
        </div>
      )}
    </div>
  );
}
