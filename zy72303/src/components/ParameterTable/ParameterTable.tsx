import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../store/AppContext';
import {
  getStakeholderName,
  getStatusName,
  formatDenominatorDisplay,
  parseDenominatorInput,
  buildRecordsFromRawData,
} from '../../utils/dataUtils';
import type { RawImportItem } from '../../utils/dataUtils';
import {
  Edit2, History, AlertTriangle, CheckCircle, Clock, Save, X,
  Upload, FileJson, Trash2, RefreshCw, Plus, Download, Info,
  Sparkles,
} from 'lucide-react';
import type { ParameterRecord, Stakeholder } from '../../types';

interface ParameterTableProps {
  onSelectRecord: (recordId: string) => void;
  selectedRecordId: string | null;
  onShowHistory: (recordId: string, fromVersion: number, toVersion: number) => void;
}

const SAMPLE_JSON: RawImportItem[] = [
  { sourceNode: 'A', targetNode: 'H', numerator: 25, denominator: 20, edgeWeight: 1.25, remark: '经E到H的主路径' },
  { sourceNode: 'A', targetNode: 'F', numerator: 18, denominator: 15, edgeWeight: 1.20, remark: '常规通勤路线' },
  { sourceNode: 'B', targetNode: 'G', numerator: 30, denominator: 0, edgeWeight: 0, remark: '早高峰时段临时封路' },
  { sourceNode: 'C', targetNode: 'D', numerator: 12, denominator: 10, edgeWeight: 1.20, remark: '跨区绕行方案' },
  { sourceNode: 'D', targetNode: 'F', numerator: 22, denominator: 18, edgeWeight: 1.22, remark: '避开拥堵路段' },
  { sourceNode: 'E', targetNode: 'A', numerator: 15, denominator: 12, edgeWeight: 1.25, remark: '返程路线对比' },
  { sourceNode: 'F', targetNode: 'D', numerator: 28, denominator: 0, edgeWeight: 0, remark: '晚高峰流量异常' },
  { sourceNode: 'G', targetNode: 'B', numerator: 35, denominator: 25, edgeWeight: 1.40, remark: '周末绕行方案' },
  { sourceNode: 'H', targetNode: 'A', numerator: 40, denominator: 30, edgeWeight: 1.33, remark: '夜间备选路线' },
  { sourceNode: 'B', targetNode: 'F', numerator: 20, denominator: 16, edgeWeight: 1.25, remark: '物流配送优化路线' },
];

export function ParameterTable({ onSelectRecord, selectedRecordId, onShowHistory }: ParameterTableProps) {
  const { state, dispatch } = useAppContext();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRemark, setEditRemark] = useState('');
  const [editDenominator, setEditDenominator] = useState('');
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  useEffect(() => {
    if (selectedRecordId) {
      const el = rowRefs.current.get(selectedRecordId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedRecordId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'zero_denominator':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'needs_review':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'counterexample_provided':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'demo_ready':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'normal':
        return <CheckCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const startEdit = (record: ParameterRecord) => {
    setEditingId(record.id);
    setEditRemark(record.remark);
    setEditDenominator(formatDenominatorDisplay(record.denominator, record.denominatorDisplayEmpty));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRemark('');
    setEditDenominator('');
  };

  const saveEdit = (record: ParameterRecord) => {
    const denParsed = parseDenominatorInput(editDenominator);
    const changes: Partial<ParameterRecord> = {
      remark: editRemark,
      denominator: denParsed.value,
      denominatorDisplayEmpty: denParsed.displayEmpty,
    };
    if (denParsed.displayEmpty) {
      changes.status = 'zero_denominator';
      changes.assignedTo = 'data_reviewer';
    } else if (record.status === 'zero_denominator' && !denParsed.displayEmpty && denParsed.value !== 0) {
      changes.status = 'needs_review';
      changes.assignedTo = 'alan';
    }

    let desc = '修改参数';
    const descs: string[] = [];
    if (editRemark !== record.remark) descs.push(`备注："${record.remark}"→"${editRemark}"`);
    const oldDen = formatDenominatorDisplay(record.denominator, record.denominatorDisplayEmpty);
    if (editDenominator !== oldDen) descs.push(`分母：${oldDen || '(空)'}→${editDenominator || '(空)'}`);
    if (descs.length > 0) desc = descs.join('；');

    dispatch({
      type: 'UPDATE_PARAMETER_RECORD',
      payload: {
        id: record.id,
        changes,
        author: state.currentUser as Stakeholder,
        description: desc,
      },
    });
    dispatch({
      type: 'SET_FLOW_MESSAGE',
      payload: { text: `已更新记录 ${record.sourceNode}→${record.targetNode}，绕行比较说明同步刷新`, type: 'success' },
    });
    cancelEdit();
  };

  const zeroDenomCount = state.parameterRecords.filter(
    r => r.status === 'zero_denominator'
  ).length;

  const handleReset = () => {
    if (confirm('确定要清空所有记录和比较结果吗？此操作无法撤销。')) {
      dispatch({ type: 'RESET_ALL_DATA' });
      dispatch({
        type: 'SET_FLOW_MESSAGE',
        payload: { text: '已清空所有数据，可重新导入参数调试表', type: 'info' },
      });
    }
  };

  const handleImportSample = () => {
    const records = buildRecordsFromRawData(SAMPLE_JSON, state.currentParameterVersion);
    dispatch({ type: 'IMPORT_PARAMETER_RECORDS', payload: records });
    dispatch({
      type: 'SET_FLOW_MESSAGE',
      payload: {
        text: `首次导入样例完成：新增 ${records.length} 条（其中 ${records.filter(r=>r.status==='zero_denominator').length} 条分母为0），下一步可点击"运行绕行比较"`,
        type: 'success',
      },
    });
    setShowImportPanel(false);
  };

  const doImport = (items: RawImportItem[]) => {
    try {
      const records = buildRecordsFromRawData(items, state.currentParameterVersion);
      dispatch({ type: 'IMPORT_PARAMETER_RECORDS', payload: records });
      setTimeout(() => {
        dispatch({ type: 'RECALCULATE_EXPLANATIONS' });
      }, 30);
      dispatch({
        type: 'SET_FLOW_MESSAGE',
        payload: { text: `导入完成，可查看导入统计卡（新增/重复/跳过）`, type: 'info' },
      });
      setImportError(null);
      setShowImportPanel(false);
      setImportJson('');
    } catch (e: any) {
      setImportError(e?.message || '导入失败');
    }
  };

  const handlePasteImport = () => {
    try {
      const parsed = JSON.parse(importJson);
      if (!Array.isArray(parsed)) throw new Error('JSON 根必须是数组');
      const items: RawImportItem[] = parsed.map((x: any) => ({
        sourceNode: String(x.sourceNode || x.source || ''),
        targetNode: String(x.targetNode || x.target || ''),
        numerator: Number(x.numerator || x.num || 0),
        denominator: x.denominator === undefined ? (x.den ?? 0) : x.denominator,
        edgeWeight: Number(x.edgeWeight || x.weight || 0),
        remark: String(x.remark || ''),
      }));
      if (items.some(i => !i.sourceNode || !i.targetNode)) {
        throw new Error('每条记录必须包含 sourceNode 和 targetNode');
      }
      doImport(items);
    } catch (e: any) {
      setImportError(e?.message || 'JSON 格式错误');
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || ''));
        if (!Array.isArray(parsed)) throw new Error('JSON 根必须是数组');
        const items: RawImportItem[] = parsed.map((x: any) => ({
          sourceNode: String(x.sourceNode || x.source || ''),
          targetNode: String(x.targetNode || x.target || ''),
          numerator: Number(x.numerator || x.num || 0),
          denominator: x.denominator === undefined ? (x.den ?? 0) : x.denominator,
          edgeWeight: Number(x.edgeWeight || x.weight || 0),
          remark: String(x.remark || ''),
        }));
        doImport(items);
      } catch (e: any) {
        setImportError(e?.message || 'JSON 解析失败');
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([JSON.stringify(SAMPLE_JSON, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '参数调试表示例.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">参数调试表</h2>
            <p className="text-indigo-100 text-sm mt-1">
              共 {state.parameterRecords.length} 条记录
              {zeroDenomCount > 0 && (
                <span className="ml-3 bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs">
                  ⚠️ {zeroDenomCount} 条分母为0待复核
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-right mr-2">
              <p className="text-indigo-100 text-xs">当前用户</p>
              <p className="text-white font-semibold text-sm">
                {getStakeholderName(state.currentUser as Stakeholder)}
              </p>
            </div>
            <button
              onClick={() => setShowImportPanel(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Upload className="w-4 h-4" />
              导入
            </button>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
              title="下载JSON模板"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
              title="清空所有数据"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {state.lastImportStats && (
        <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4 text-sm">
            <Info className="w-4 h-4 text-indigo-500" />
            <span>
              上次导入：
              <span className="font-semibold text-green-700">新增 {state.lastImportStats.importedCount}</span>
              {state.lastImportStats.duplicateCount > 0 && (
                <span className="ml-3 text-amber-700">
                  重复去重 {state.lastImportStats.duplicateCount}（哈希匹配，未翻倍）
                </span>
              )}
              {state.lastImportStats.skippedCount > 0 && (
                <span className="ml-3 text-gray-600">
                  跳过 {state.lastImportStats.skippedCount}
                </span>
              )}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {new Date(state.lastImportStats.timestamp).toLocaleString()}
          </span>
        </div>
      )}

      {showImportPanel && (
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              导入参数调试表
            </h3>
            <button
              onClick={() => { setShowImportPanel(false); setImportError(null); setImportJson(''); }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={handleImportSample}
              className="p-4 border-2 border-dashed border-indigo-300 rounded-xl hover:bg-indigo-50 hover:border-indigo-400 transition-all text-left group"
            >
              <RefreshCw className="w-6 h-6 text-indigo-500 mb-2 group-hover:rotate-180 transition-transform duration-500" />
              <p className="font-semibold text-gray-800">一键导入样例</p>
              <p className="text-xs text-gray-500 mt-1">10条预置记录，含2条分母为0（适合首次导入演示）</p>
            </button>

            <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl hover:bg-slate-50 transition-all">
              <FileJson className="w-6 h-6 text-slate-500 mb-2" />
              <p className="font-semibold text-gray-800">上传 JSON 文件</p>
              <p className="text-xs text-gray-500 mt-1 mb-2">每行一条记录的数组格式</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded text-sm"
              >
                选择文件
              </button>
            </div>

            <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl">
              <Plus className="w-6 h-6 text-slate-500 mb-2" />
              <p className="font-semibold text-gray-800">粘贴 JSON</p>
              <p className="text-xs text-gray-500 mt-1 mb-2">直接粘贴数组内容</p>
              <button
                onClick={() => {
                  if (importJson.trim()) handlePasteImport();
                  else setImportError('请先在下方输入框粘贴 JSON');
                }}
                className="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm"
              >
                解析并导入
              </button>
            </div>
          </div>

          <div>
            <textarea
              value={importJson}
              onChange={e => setImportJson(e.target.value)}
              placeholder={`粘贴 JSON 数组，例如：\n[\n  {"sourceNode":"A","targetNode":"H","numerator":25,"denominator":20,"edgeWeight":1.25,"remark":"主路径"}\n]`}
              className="w-full h-24 px-3 py-2 font-mono text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
          </div>

          {importError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {importError}
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                状态
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                起点
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                终点
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                分子
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                分母
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                边权重
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                备注
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                负责人
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                版本
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {state.parameterRecords.map(record => {
              const isEditing = editingId === record.id;
              const isSelected = selectedRecordId === record.id;
              const isZeroDenom = record.status === 'zero_denominator';

              return (
                <tr
                  key={record.id}
                  ref={el => { if (el) rowRefs.current.set(record.id, el); }}
                  className={`transition-all duration-300 ${
                    isSelected
                      ? 'bg-indigo-100 ring-2 ring-indigo-400 ring-inset'
                      : isZeroDenom
                      ? 'bg-amber-50 hover:bg-amber-100'
                      : 'hover:bg-gray-50'
                  } cursor-pointer`}
                  onClick={() => !isEditing && onSelectRecord(record.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1" title={getStatusName(record.status)}>
                      {getStatusIcon(record.status)}
                      <span className="text-xs text-gray-500">
                        {getStatusName(record.status)}
                      </span>
                    </div>
                    {record.manualCounterexample && (
                      <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        已补反例
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-gray-100 rounded font-mono text-sm">
                      {record.sourceNode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-gray-100 rounded font-mono text-sm">
                      {record.targetNode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {record.numerator}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editDenominator}
                        onChange={e => setEditDenominator(e.target.value)}
                        placeholder="空或0表示异常"
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className={`font-mono ${
                          isZeroDenom ? 'text-amber-600 font-semibold' : ''
                        }`}
                        title={isZeroDenom ? '分母为0，显示为空字符串 — 点击右侧复核面板查看手算反例' : ''}
                      >
                        {formatDenominatorDisplay(
                          record.denominator,
                          record.denominatorDisplayEmpty
                        )}
                        {isZeroDenom && (
                          <span className="ml-1 text-xs text-amber-500" title="空字符串实际值为分母0">⚠️空</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {record.edgeWeight.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editRemark}
                        onChange={e => setEditRemark(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <div>
                        <span className="text-gray-700 truncate block" title={record.remark}>
                          {record.remark}
                        </span>
                        {record.counterexampleTimestamp && (
                          <span className="mt-1 inline-block text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                            反例已提供 · {new Date(record.counterexampleTimestamp).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        record.assignedTo === 'data_reviewer'
                          ? 'bg-purple-100 text-purple-700'
                          : record.assignedTo === 'alan'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {getStakeholderName(record.assignedTo as Stakeholder)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-500">
                      v{record.currentVersion}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(record)}
                            className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors"
                            title="保存"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="取消"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(record)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
                            title="编辑备注/分母"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {record.currentVersion > 1 && (
                            <button
                              onClick={() =>
                                onShowHistory(record.id, 1, record.currentVersion)
                              }
                              className="p-1.5 text-amber-600 hover:bg-amber-100 rounded transition-colors"
                              title="查看历史（改前/改后对比）"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {state.parameterRecords.length === 0 && (
        <div className="px-6 py-16 text-center">
          <div className="w-16 h-16 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-lg font-medium text-gray-800 mb-2">暂无参数记录</p>
          <p className="text-sm text-gray-500 mb-6">
            点击上方「导入」→「一键导入样例」开始走完整流程
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={handleImportSample}
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              一键导入样例（首次导入）
            </button>
            <button
              onClick={() => setShowImportPanel(true)}
              className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              打开导入面板
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
