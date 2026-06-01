import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileSpreadsheet, FileText, Printer, Eye, ArrowLeft, Save, History } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { saveToHistory } from '../utils/storage';
import ReportSummary from '../components/modules/ReportSummary';
import DataTable from '../components/common/DataTable';
import TracePanel from '../components/common/TracePanel';
import { formatNumber, formatDateTime } from '../utils/format';

const ReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    processedData, 
    fittingResult,
    weightClosureStatus,
    boundaryStatus,
    selectedDataId, 
    isTracePanelOpen, 
    setSelectedDataId,
    setTracePanelOpen,
    confirmDataStatus,
    setCurrentStep,
    preprocessConfig
  } = useDataStore();

  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [operator, setOperator] = useState('分析师');
  const [remark, setRemark] = useState('');

  const handleRowClick = (dataId: string) => {
    setSelectedDataId(dataId);
  };

  const handleTraceClose = () => {
    setTracePanelOpen(false);
  };

  const handleConfirm = (status: 'confirmed' | 'normal') => {
    if (selectedDataId) {
      confirmDataStatus(selectedDataId, status, '报告生成后确认', '分析师');
    }
  };

  const handleBackToFitting = () => {
    setCurrentStep('fitting');
  };

  const handleExport = () => {
    if (!fittingResult || processedData.length === 0) return;
    
    setIsExporting(true);
    
    setTimeout(() => {
      if (exportFormat === 'csv') {
        exportCSV();
      } else {
        exportJSON();
      }
      setIsExporting(false);
    }, 500);
  };

  const exportCSV = () => {
    const headers = [
      '记录ID', '材料', '原始应力', '应力单位', '换算后应力',
      '原始寿命', '寿命单位', '换算后寿命', '来源', '试验日期',
      '状态', '是否重复', '是否空值', '是否异常', '异常原因',
      '导入时间', '备注'
    ];

    const rows = processedData.map(item => [
      item.id,
      item.material,
      item.stress ?? '',
      item.stressUnit,
      item.stressConverted ?? '',
      item.life ?? '',
      item.lifeUnit,
      item.lifeConverted ?? '',
      item.source,
      item.testDate,
      item.status,
      item.isDuplicate ? '是' : '否',
      item.isNull ? '是' : '否',
      item.isAnomaly ? '是' : '否',
      item.anomalyReason,
      item.importedAt,
      item.remark
    ]);

    if (fittingResult) {
      headers.push(...['拟合模型', '拟合公式', '参数a', '参数b', 'R²', '权重闭合度']);
      rows.forEach(row => {
        row.push(
          fittingResult.model,
          fittingResult.formula,
          fittingResult.parameters.a.toExponential(6),
          fittingResult.parameters.b.toFixed(6),
          fittingResult.parameters.r2.toFixed(6),
          fittingResult.weightClosure.toFixed(4)
        );
      });
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, `疲劳分析报告_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportJSON = () => {
    const exportData = {
      exportTime: new Date().toISOString(),
      summary: {
        totalRecords: processedData.length,
        fittingModel: fittingResult?.model,
        formula: fittingResult?.formula,
        parameters: fittingResult?.parameters,
        weightClosure: fittingResult?.weightClosure,
        boundaryCheck: fittingResult?.boundaryCheck
      },
      preprocessConfig: useDataStore.getState().preprocessConfig,
      data: processedData,
      fittingPoints: fittingResult?.points
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    downloadFile(blob, `疲劳分析报告_${new Date().toISOString().slice(0, 10)}.json`);
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenSaveDialog = () => {
    const material = processedData.length > 0 ? processedData[0].material : '未知材料';
    const date = new Date().toISOString().slice(0, 10);
    setBatchName(`${material}_疲劳分析_${date}`);
    setSaveDialogOpen(true);
  };

  const handleSaveToHistory = () => {
    if (!fittingResult || processedData.length === 0 || !batchName.trim()) return;
    
    setIsSaving(true);
    
    setTimeout(() => {
      const material = processedData.length > 0 ? processedData[0].material : '未知材料';
      
      saveToHistory(
        batchName.trim(),
        material,
        processedData.length,
        fittingResult.model,
        fittingResult.parameters.r2,
        operator.trim() || '分析师',
        remark.trim(),
        processedData,
        fittingResult,
        preprocessConfig
      );
      
      setIsSaving(false);
      setSaveDialogOpen(false);
      navigate('/history');
    }, 500);
  };

  const selectedData = processedData.find(d => d.id === selectedDataId);

  const adaptedWeightClosureStatus = useMemo(() => {
    if (!weightClosureStatus || !fittingResult) return null;
    return {
      value: (weightClosureStatus.value || fittingResult.weightClosure) * 100,
      isClosed: weightClosureStatus.status === 'normal',
      threshold: 5,
      details: weightClosureStatus.message
    };
  }, [weightClosureStatus, fittingResult]);

  const adaptedBoundaryStatus = useMemo(() => {
    if (!boundaryStatus || !fittingResult) return null;
    const outOfBoundsDetails = boundaryStatus.outOfBounds.map(dataId => {
      const data = processedData.find(d => d.id === dataId);
      const stress = data?.stressConverted ?? 0;
      const direction = stress < boundaryStatus.minStress ? 'below' as const : 'above' as const;
      return { dataId, stress, direction };
    });
    return {
      minStress: boundaryStatus.minStress,
      maxStress: boundaryStatus.maxStress,
      outOfBounds: outOfBoundsDetails
    };
  }, [boundaryStatus, fittingResult, processedData]);

  return (
    <div className="min-h-screen bg-engineering-50 print:bg-white">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 print:px-0 print:py-4">
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToFitting}
              className="p-2 hover:bg-engineering-200 rounded-engineering text-engineering-500 hover:text-engineering-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-serif-cn font-bold text-engineering-800">
                分析报告
              </h1>
              <p className="text-sm text-engineering-500 mt-1">
                查看完整分析结果，支持导出和打印
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white border border-engineering-200 rounded-engineering p-1">
              <button
                onClick={() => setExportFormat('csv')}
                className={`px-3 py-1.5 text-sm rounded-engineering transition-colors flex items-center gap-1.5 ${
                  exportFormat === 'csv'
                    ? 'bg-engineering-800 text-white'
                    : 'text-engineering-600 hover:bg-engineering-100'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => setExportFormat('json')}
                className={`px-3 py-1.5 text-sm rounded-engineering transition-colors flex items-center gap-1.5 ${
                  exportFormat === 'json'
                    ? 'bg-engineering-800 text-white'
                    : 'text-engineering-600 hover:bg-engineering-100'
                }`}
              >
                <FileText className="w-4 h-4" />
                JSON
              </button>
            </div>
            <button
              onClick={handlePrint}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <Printer className="w-4 h-4" />
              打印
            </button>
            <button
              onClick={handleOpenSaveDialog}
              disabled={!fittingResult}
              className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <History className="w-4 h-4" />
              保存到历史记录
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || !fittingResult}
              className="btn-primary flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {isExporting ? '导出中...' : '导出报告'}
            </button>
          </div>
        </div>

        <div className="print:block hidden mb-8">
          <div className="text-center border-b-2 border-engineering-800 pb-4 mb-4">
            <h1 className="text-3xl font-serif-cn font-bold text-engineering-800">
              疲劳寿命拟合分析报告
            </h1>
            <p className="text-engineering-600 mt-2">
              生成时间：{formatDateTime(new Date().toISOString())}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {fittingResult && adaptedWeightClosureStatus && adaptedBoundaryStatus && (
            <ReportSummary
              fittingResult={fittingResult}
              processedData={processedData}
              weightClosureStatus={adaptedWeightClosureStatus}
              boundaryStatus={adaptedBoundaryStatus}
            />
          )}

          <div className="card">
            <div className="card-header flex items-center justify-between print:bg-transparent print:border-b print:border-engineering-200">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                <span>完整数据表</span>
              </div>
              <div className="flex items-center gap-4 text-sm print:hidden">
                <span className="text-engineering-500">
                  共 <span className="font-mono-num font-semibold text-engineering-800">{processedData.length}</span> 条记录
                </span>
                <span className="text-xs text-engineering-500 flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  点击行查看溯源明细
                </span>
              </div>
            </div>
            <div className="card-body p-0 print:p-0">
              {processedData.length > 0 ? (
                <div className="print:overflow-visible">
                  <DataTable
                    data={processedData}
                    highlightId={selectedDataId || undefined}
                    onRowClick={handleRowClick}
                  />
                </div>
              ) : (
                <div className="p-8 text-center text-engineering-500">
                  暂无数据
                </div>
              )}
            </div>
          </div>

          {fittingResult && (
            <div className="card print:break-before-page">
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  <span>拟合结果明细</span>
                </div>
              </div>
              <div className="card-body">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-engineering-100">
                        <th className="px-4 py-3 text-left font-semibold text-engineering-700 border border-engineering-200">
                          记录ID
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-engineering-700 border border-engineering-200">
                          应力 (MPa)
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-engineering-700 border border-engineering-200">
                          实测寿命
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-engineering-700 border border-engineering-200">
                          预测寿命
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-engineering-700 border border-engineering-200">
                          残差
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-engineering-700 border border-engineering-200">
                          相对误差
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-engineering-700 border border-engineering-200">
                          状态
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {fittingResult.points.map((point, index) => {
                        const data = processedData.find(d => d.id === point.dataId);
                        const relativeError = Math.abs(point.residual / point.life) * 100;
                        
                        return (
                          <tr key={point.dataId} className="hover:bg-engineering-50 print:break-inside-avoid">
                            <td className="px-4 py-2 font-mono-num text-engineering-700 border border-engineering-200">
                              {point.dataId}
                            </td>
                            <td className="px-4 py-2 text-right font-mono-num border border-engineering-200">
                              {formatNumber(point.stress)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono-num border border-engineering-200">
                              {formatNumber(point.life)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono-num border border-engineering-200">
                              {formatNumber(point.predictedLife)}
                            </td>
                            <td className={`px-4 py-2 text-right font-mono-num border border-engineering-200 ${
                              Math.abs(point.residual) > point.life * 0.2 ? 'text-danger-600' : 'text-success-600'
                            }`}>
                              {formatNumber(point.residual)}
                            </td>
                            <td className={`px-4 py-2 text-right font-mono-num border border-engineering-200 ${
                              relativeError > 20 ? 'text-danger-600' : 
                              relativeError > 10 ? 'text-warning-600' : 'text-success-600'
                            }`}>
                              {relativeError.toFixed(2)}%
                            </td>
                            <td className="px-4 py-2 border border-engineering-200">
                              {data?.status === 'normal' ? '正常' :
                               data?.status === 'pending' ? '待确认' :
                               data?.status === 'confirmed' ? '已确认' : '历史数据'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="print:block hidden mt-8 pt-4 border-t border-engineering-200">
          <div className="flex justify-between text-sm text-engineering-500">
            <div>
              <p>分析师：________________</p>
              <p>日期：________________</p>
            </div>
            <div>
              <p>审核人：________________</p>
              <p>日期：________________</p>
            </div>
          </div>
        </div>
      </div>

      {isTracePanelOpen && selectedData && (
        <TracePanel
          data={selectedData}
          onClose={handleTraceClose}
          onConfirm={handleConfirm}
        />
      )}

      {saveDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-engineering shadow-xl max-w-md w-full mx-4 animate-fade-in">
            <div className="p-6 border-b border-engineering-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-engineering-100 rounded-engineering">
                  <Save className="w-5 h-5 text-engineering-700" />
                </div>
                <div>
                  <h3 className="text-lg font-serif-cn font-semibold text-engineering-800">
                    保存到历史记录
                  </h3>
                  <p className="text-sm text-engineering-500">
                    填写分析记录信息，便于后续查看和管理
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-engineering-700 mb-1.5">
                  批次名称 <span className="text-danger-600">*</span>
                </label>
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-engineering-300 rounded-engineering bg-white focus:outline-none focus:ring-2 focus:ring-engineering-500"
                  placeholder="请输入批次名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-engineering-700 mb-1.5">
                  操作员
                </label>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-engineering-300 rounded-engineering bg-white focus:outline-none focus:ring-2 focus:ring-engineering-500"
                  placeholder="请输入操作员姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-engineering-700 mb-1.5">
                  备注
                </label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-engineering-300 rounded-engineering bg-white focus:outline-none focus:ring-2 focus:ring-engineering-500 resize-none"
                  placeholder="可填写分析说明、特殊情况等备注信息"
                />
              </div>
            </div>
            <div className="p-6 border-t border-engineering-200 flex justify-end gap-3">
              <button
                onClick={() => setSaveDialogOpen(false)}
                className="btn-secondary text-sm"
              >
                取消
              </button>
              <button
                onClick={handleSaveToHistory}
                disabled={isSaving || !batchName.trim()}
                className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {isSaving ? '保存中...' : '确认保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportPage;
