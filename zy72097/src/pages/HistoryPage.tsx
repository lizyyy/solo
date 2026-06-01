import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  History, 
  Clock, 
  User, 
  Trash2, 
  Eye, 
  Download, 
  TrendingUp, 
  Database,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  FileText
} from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { loadHistory, loadHistoryDetail, deleteHistoryRecord, clearAllHistory } from '../utils/storage';
import TracePanel from '../components/common/TracePanel';
import { formatDateTime, formatDate } from '../utils/format';
import type { ProcessedData, FittingResult, PreprocessConfig } from '../types';

interface HistoryRecord {
  id: string;
  batchName: string;
  material: string;
  dataCount: number;
  model: string;
  r2: number;
  savedAt: string;
  operator: string;
  remark: string;
}

const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    setProcessedData, 
    setFittingResult, 
    setPreprocessConfig,
    setSelectedDataId,
    setCurrentStep,
    setWeightClosureStatus,
    setBoundaryStatus,
    selectedDataId,
    isTracePanelOpen,
    setTracePanelOpen,
    confirmDataStatus
  } = useDataStore();

  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedHistoryData, setSelectedHistoryData] = useState<ProcessedData[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    loadHistoryData();
  }, []);

  const loadHistoryData = () => {
    const records = loadHistory();
    setHistory(records as HistoryRecord[]);
  };

  const groupByDate = (records: HistoryRecord[]) => {
    const groups: Record<string, HistoryRecord[]> = {};
    records.forEach(record => {
      const date = formatDate(record.savedAt);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(record);
    });
    return groups;
  };

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    setLoadingId(id);
    try {
      const detail = loadHistoryDetail(id);
      if (detail) {
        setSelectedHistoryData(detail.processedData);
        setExpandedId(id);
      }
    } catch (error) {
      console.error('加载历史详情失败:', error);
    } finally {
      setLoadingId(null);
    }
  };

  const handleLoadAnalysis = (id: string) => {
    const detail = loadHistoryDetail(id);
    if (detail && detail.fittingResult) {
      const historicalData = detail.processedData.map(item => ({
        ...item,
        status: 'historical' as const,
        source: `${item.source} (历史记录)`,
        processHistory: item.processHistory || [],
        judgment: item.judgment || []
      }));
      
      const weightClosure = detail.fittingResult.weightClosure;
      const weightStatus = weightClosure >= 0.8 && weightClosure <= 1.2 ? 'normal' : 
                          weightClosure >= 0.7 && weightClosure <= 1.3 ? 'warning' : 'error';
      const weightMessage = weightStatus === 'normal' ? '权重闭合度良好，模型可靠' :
                           weightStatus === 'warning' ? '权重闭合度偏离理想范围，建议检查' :
                           '权重闭合度严重偏离，模型可靠性存疑';
      
      const boundaryCheck = detail.fittingResult.boundaryCheck;
      const boundaryStatus = boundaryCheck.outOfBounds.length === 0 ? 'normal' :
                            boundaryCheck.outOfBounds.length <= 3 ? 'warning' : 'error';
      const boundaryMessage = boundaryStatus === 'normal' ? '所有数据点均在有效范围内' :
                             boundaryStatus === 'warning' ? `存在 ${boundaryCheck.outOfBounds.length} 个超界数据点` :
                             `存在 ${boundaryCheck.outOfBounds.length} 个超界数据点，建议处理`;
      
      setProcessedData(historicalData);
      setFittingResult(detail.fittingResult);
      setPreprocessConfig(detail.preprocessConfig);
      setWeightClosureStatus({
        value: weightClosure,
        status: weightStatus,
        message: weightMessage
      });
      setBoundaryStatus({
        minStress: boundaryCheck.minStress,
        maxStress: boundaryCheck.maxStress,
        outOfBounds: boundaryCheck.outOfBounds,
        status: boundaryStatus,
        message: boundaryMessage
      });
      setCurrentStep('report');
      navigate('/report');
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirm === id) {
      deleteHistoryRecord(id);
      loadHistoryData();
      setDeleteConfirm(null);
      if (expandedId === id) {
        setExpandedId(null);
      }
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const handleClearAll = () => {
    if (clearConfirm) {
      clearAllHistory();
      loadHistoryData();
      setClearConfirm(false);
      setExpandedId(null);
    } else {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 3000);
    }
  };

  const handleRowClick = (dataId: string) => {
    setSelectedDataId(dataId);
  };

  const handleTraceClose = () => {
    setTracePanelOpen(false);
  };

  const handleConfirm = (status: 'confirmed' | 'normal') => {
    if (selectedDataId) {
      confirmDataStatus(selectedDataId, status, '历史记录查看确认', '分析师');
    }
  };

  const selectedData = selectedHistoryData.find(d => d.id === selectedDataId);

  const groupedHistory = groupByDate(history);
  const dates = Object.keys(groupedHistory).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  const getR2Color = (r2: number) => {
    if (r2 >= 0.99) return 'text-success-600 bg-success-50 border-success-200';
    if (r2 >= 0.95) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (r2 >= 0.90) return 'text-warning-600 bg-warning-50 border-warning-200';
    return 'text-danger-600 bg-danger-50 border-danger-200';
  };

  const getTimelineIcon = (index: number, total: number) => {
    if (index === 0) return <CheckCircle className="w-4 h-4 text-success-600" />;
    if (index === total - 1) return <History className="w-4 h-4 text-historical-600" />;
    return <div className="w-3 h-3 rounded-full bg-engineering-400 border-2 border-white" />;
  };

  return (
    <div className="min-h-screen bg-engineering-50">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif-cn font-bold text-engineering-800">
              历史记录
            </h1>
            <p className="text-sm text-engineering-500 mt-1">
              查看和管理历史分析记录
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-engineering-500">分析记录</p>
              <p className="text-2xl font-mono-num font-bold text-engineering-800">
                {history.length} <span className="text-sm text-engineering-500">条</span>
              </p>
            </div>
            {history.length > 0 && (
              <button
                onClick={handleClearAll}
                className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-engineering transition-colors ${
                  clearConfirm 
                    ? 'bg-danger-600 text-white' 
                    : 'bg-white border border-danger-200 text-danger-600 hover:bg-danger-50'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                {clearConfirm ? '再次确认清空' : '清空全部'}
              </button>
            )}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-engineering-100 flex items-center justify-center">
              <History className="w-10 h-10 text-engineering-400" />
            </div>
            <h3 className="text-lg font-semibold text-engineering-800 mb-2">
              暂无历史记录
            </h3>
            <p className="text-engineering-500 max-w-md mx-auto">
              完成疲劳寿命拟合分析后，可在报告页面将分析结果保存到历史记录中。
              保存后可在此处查看、加载和管理所有历史分析记录。
            </p>
          </div>
        ) : (
          <div className="relative">
            {dates.map((date, dateIndex) => (
              <div key={date} className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-engineering-800 text-white flex items-center justify-center font-serif-cn font-semibold text-sm flex-shrink-0">
                    {date.slice(5)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-engineering-800">{date}</h3>
                    <p className="text-xs text-engineering-500">
                      共 {groupedHistory[date].length} 条分析记录
                    </p>
                  </div>
                </div>

                <div className="relative pl-20">
                  <div className="absolute left-[45px] top-0 bottom-0 w-0.5 bg-engineering-200" />
                  
                  <div className="space-y-4">
                    {groupedHistory[date].map((record, recordIndex) => {
                      const isExpanded = expandedId === record.id;
                      const isFirst = recordIndex === 0;
                      
                      return (
                        <div key={record.id} className="relative">
                          <div className="absolute -left-[57px] top-6 z-10">
                            {getTimelineIcon(recordIndex, groupedHistory[date].length)}
                          </div>

                          <div 
                            className={`card transition-all duration-300 ${
                              isExpanded ? 'ring-2 ring-engineering-500 ring-offset-2' : ''
                            }`}
                          >
                            <div 
                              className="p-4 cursor-pointer hover:bg-engineering-50/50 transition-colors"
                              onClick={() => handleExpand(record.id)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h4 className="font-serif-cn font-semibold text-lg text-engineering-800 truncate">
                                      {record.batchName}
                                    </h4>
                                    {isFirst && (
                                      <span className="px-2 py-0.5 bg-success-100 text-success-700 text-xs rounded-full font-medium flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        最新
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="flex flex-wrap items-center gap-4 text-sm">
                                    <div className="flex items-center gap-1.5 text-engineering-600">
                                      <Database className="w-4 h-4" />
                                      <span>{record.material}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-engineering-600">
                                      <FileText className="w-4 h-4" />
                                      <span>{record.dataCount} 条数据</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-engineering-600">
                                      <TrendingUp className="w-4 h-4" />
                                      <span>{record.model}</span>
                                    </div>
                                    <div className={`px-2 py-0.5 rounded-full text-xs font-mono-num font-semibold border ${getR2Color(record.r2)}`}>
                                      R² = {record.r2.toFixed(4)}
                                    </div>
                                  </div>

                                  {record.remark && (
                                    <p className="mt-2 text-sm text-engineering-500 truncate">
                                      备注：{record.remark}
                                    </p>
                                  )}

                                  <div className="flex items-center gap-4 mt-3 text-xs text-engineering-400">
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {formatDateTime(record.savedAt).slice(11, 16)}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      {record.operator}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 ml-4">
                                  {isExpanded ? (
                                    <ChevronUp className="w-5 h-5 text-engineering-400" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-engineering-400" />
                                  )}
                                </div>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="border-t border-engineering-100 animate-fade-in">
                                {loadingId === record.id ? (
                                  <div className="p-8 text-center text-engineering-500">
                                    加载中...
                                  </div>
                                ) : (
                                  <>
                                    <div className="p-4 bg-engineering-50 border-b border-engineering-100">
                                      <div className="flex flex-wrap items-center gap-3">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleLoadAnalysis(record.id); }}
                                          className="btn-primary flex items-center gap-1.5 text-sm"
                                        >
                                          <Download className="w-4 h-4" />
                                          加载此记录
                                        </button>
                                        <button
                                          onClick={(e) => handleDelete(record.id, e)}
                                          className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-engineering transition-colors ${
                                            deleteConfirm === record.id
                                              ? 'bg-danger-600 text-white'
                                              : 'bg-white border border-danger-200 text-danger-600 hover:bg-danger-50'
                                          }`}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                          {deleteConfirm === record.id ? '再次确认删除' : '删除记录'}
                                        </button>
                                      </div>
                                    </div>

                                    <div className="p-4">
                                      <h5 className="text-sm font-semibold text-engineering-700 mb-3 flex items-center gap-2">
                                        <Eye className="w-4 h-4" />
                                        数据预览
                                      </h5>
                                      <div className="overflow-auto max-h-[300px] scrollbar-thin rounded-engineering border border-engineering-200">
                                        <table className="w-full border-collapse text-sm">
                                          <thead className="sticky top-0 bg-engineering-100 z-10">
                                            <tr>
                                              <th className="px-3 py-2 text-left text-engineering-700 font-semibold border-b border-engineering-200">
                                                记录ID
                                              </th>
                                              <th className="px-3 py-2 text-left text-engineering-700 font-semibold border-b border-engineering-200">
                                                材料
                                              </th>
                                              <th className="px-3 py-2 text-right text-engineering-700 font-semibold border-b border-engineering-200">
                                                应力 (MPa)
                                              </th>
                                              <th className="px-3 py-2 text-right text-engineering-700 font-semibold border-b border-engineering-200">
                                                寿命 (次)
                                              </th>
                                              <th className="px-3 py-2 text-left text-engineering-700 font-semibold border-b border-engineering-200">
                                                来源
                                              </th>
                                              <th className="px-3 py-2 text-center text-engineering-700 font-semibold border-b border-engineering-200">
                                                操作
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {selectedHistoryData.slice(0, 20).map((item) => (
                                              <tr 
                                                key={item.id} 
                                                className="border-b border-engineering-100 hover:bg-engineering-50 cursor-pointer transition-colors"
                                                onClick={() => handleRowClick(item.id)}
                                              >
                                                <td className="px-3 py-2 font-mono-num text-xs text-engineering-700">
                                                  {item.id}
                                                </td>
                                                <td className="px-3 py-2 text-engineering-800 font-medium">
                                                  {item.material}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono-num">
                                                  {item.stressConverted?.toFixed(1) || '-'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono-num">
                                                  {item.lifeConverted?.toExponential(2) || '-'}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-engineering-500">
                                                  {item.source}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                  <button className="p-1 hover:bg-engineering-200 rounded text-engineering-500 hover:text-engineering-800 transition-colors">
                                                    <Eye className="w-4 h-4" />
                                                  </button>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                        {selectedHistoryData.length > 20 && (
                                          <div className="p-3 text-center text-xs text-engineering-500 bg-engineering-50">
                                            仅显示前20条，共 {selectedHistoryData.length} 条数据
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isTracePanelOpen && selectedData && (
        <TracePanel
          data={selectedData}
          onClose={handleTraceClose}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
};

export default HistoryPage;
