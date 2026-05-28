import { useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  FileCheck,
  FileSignature,
  Calendar,
  Phone,
  AlertTriangle,
  Link2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Download,
  RefreshCw,
} from 'lucide-react';
import Tabs from '@/components/Tabs';
import Card from '@/components/Card';
import Table from '@/components/Table';
import Loading from '@/components/Loading';
import ErrorState from '@/components/ErrorState';
import LinkGraphView from '@/components/LinkGraphView';
import { importService } from '@/services/importService';
import { businessService } from '@/services/businessService';
import { cn } from '@/lib/utils';
import type { BusinessDataType, ImportResult, LinkGraph, ApiResponse } from '../../shared/types';
import { DATA_TYPE_LABELS } from '../../shared/types';

const DATA_TABS: { key: BusinessDataType; label: string; icon: typeof FileText }[] = [
  { key: 'invoice', label: '发票', icon: FileText },
  { key: 'confirmation', label: '买方确认', icon: FileCheck },
  { key: 'contract', label: '保理合同', icon: FileSignature },
  { key: 'repayment_plan', label: '回款计划', icon: Calendar },
  { key: 'collection_note', label: '催收记录', icon: Phone },
  { key: 'risk_report', label: '风险报告', icon: AlertTriangle },
];

interface ImportPreviewData {
  previewData: any[];
  totalRows: number;
}

interface AnomalyData {
  id: string;
  businessNo: string;
  dataType: BusinessDataType;
  errorType: string;
  errorMessage: string;
  rowNumber: number;
}

export default function DataImport() {
  const [activeTab, setActiveTab] = useState<BusinessDataType>('invoice');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<LinkGraph | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const anomalyData: AnomalyData[] = [
    {
      id: '1',
      businessNo: 'BL2024001',
      dataType: 'invoice',
      errorType: '金额不匹配',
      errorMessage: '发票金额与合同金额差异超过5%',
      rowNumber: 5,
    },
    {
      id: '2',
      businessNo: 'BL2024002',
      dataType: 'confirmation',
      errorType: '缺少关键字段',
      errorMessage: '缺少确认日期字段',
      rowNumber: 12,
    },
    {
      id: '3',
      businessNo: 'BL2024003',
      dataType: 'repayment_plan',
      errorType: '日期异常',
      errorMessage: '回款日期早于合同生效日期',
      rowNumber: 8,
    },
  ];

  const loadGraphData = useCallback(async () => {
    try {
      setGraphLoading(true);
      const res = await businessService.getLinkGraph();
      if (res.success && res.data) {
        setGraphData(res.data);
      }
    } catch (err: any) {
      console.error('加载关联图谱失败:', err);
    } finally {
      setGraphLoading(false);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('请上传 Excel 文件（.xlsx 或 .xls 格式）');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setImportResult(null);

    try {
      setUploading(true);
      const res = await importService.previewFile(file, activeTab);
      if (res.success && res.data) {
        setPreviewData(res.data);
      } else {
        setError(res.error || '文件预览失败');
      }
    } catch (err: any) {
      setError(err.message || '文件预览失败');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      const res = await importService.uploadFile(selectedFile, activeTab);
      if (res.success && res.data) {
        setImportResult(res.data);
        setPreviewData(null);
        setSelectedFile(null);
        loadGraphData();
      } else {
        setError(res.error || '导入失败');
      }
    } catch (err: any) {
      setError(err.message || '导入失败');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setPreviewData(null);
    setImportResult(null);
    setSelectedFile(null);
    setError(null);
  };

  const anomalyColumns = [
    {
      key: 'businessNo',
      title: '业务编号',
      dataIndex: 'businessNo' as keyof AnomalyData,
      render: (record: AnomalyData) => (
        <span className="font-mono text-sm text-blue-600">{record.businessNo}</span>
      ),
    },
    {
      key: 'dataType',
      title: '数据类型',
      render: (record: AnomalyData) => (
        <span className="text-sm">{DATA_TYPE_LABELS[record.dataType]}</span>
      ),
    },
    {
      key: 'rowNumber',
      title: '行号',
      dataIndex: 'rowNumber' as keyof AnomalyData,
      render: (record: AnomalyData) => <span className="text-sm">第 {record.rowNumber} 行</span>,
    },
    {
      key: 'errorType',
      title: '异常类型',
      dataIndex: 'errorType' as keyof AnomalyData,
      render: (record: AnomalyData) => (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
          <AlertCircle size={12} />
          {record.errorType}
        </span>
      ),
    },
    {
      key: 'errorMessage',
      title: '异常描述',
      dataIndex: 'errorMessage' as keyof AnomalyData,
    },
  ];

  const previewColumns = previewData?.previewData.length
    ? Object.keys(previewData.previewData[0]).map((key) => ({
        key,
        title: key,
        dataIndex: key as keyof any,
      }))
    : [];

  const currentTab = DATA_TABS.find((t) => t.key === activeTab);
  const IconComponent = currentTab?.icon || FileText;

  return (
    <div className="space-y-6">
      <Card
        title="数据导入"
        subtitle="选择数据类型，上传 Excel 文件进行批量导入"
        extra={
          <button
            onClick={() => loadGraphData()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={14} className={cn(graphLoading && 'animate-spin')} />
            刷新关联
          </button>
        }
      >
        <Tabs
          items={DATA_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            icon: <tab.icon size={16} />,
          }))}
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key as BusinessDataType);
            handleReset();
          }}
          className="mb-6"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              )}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div
                  className={cn(
                    'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
                    isDragging ? 'bg-blue-100' : 'bg-slate-100'
                  )}
                >
                  <Upload className={cn('w-8 h-8', isDragging ? 'text-blue-500' : 'text-slate-400')} />
                </div>
                <p className="text-slate-800 font-medium mb-1">
                  拖拽文件到此处，或点击上传
                </p>
                <p className="text-sm text-slate-500 mb-3">
                  支持 .xlsx 和 .xls 格式，文件大小不超过 10MB
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  <Download size={14} />
                  下载导入模板
                </div>
              </label>
            </div>

            {selectedFile && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <IconComponent className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <XCircle size={18} />
                </button>
              </div>
            )}

            {uploading && (
              <div className="mt-4">
                <Loading text="正在处理文件..." />
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">导入出错</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            )}

            {importResult && (
              <div
                className={cn(
                  'mt-4 p-4 border rounded-lg flex items-start gap-3',
                  importResult.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-amber-50 border-amber-200'
                )}
              >
                {importResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      importResult.success ? 'text-green-800' : 'text-amber-800'
                    )}
                  >
                    {importResult.success ? '导入成功' : '导入完成但存在错误'}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">总计：</span>
                      <span className="font-medium text-slate-800">{importResult.total} 条</span>
                    </div>
                    <div>
                      <span className="text-slate-500">成功：</span>
                      <span className="font-medium text-green-600">{importResult.imported} 条</span>
                    </div>
                    <div>
                      <span className="text-slate-500">失败：</span>
                      <span className="font-medium text-red-600">
                        {importResult.total - importResult.imported} 条
                      </span>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 text-sm text-red-600">
                      {importResult.errors.slice(0, 3).map((err, idx) => (
                        <p key={idx} className="mt-1">
                          • {err}
                        </p>
                      ))}
                      {importResult.errors.length > 3 && (
                        <p className="mt-1">• 还有 {importResult.errors.length - 3} 条错误...</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {previewData && !importResult && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    共 {previewData.totalRows} 条数据，预览前 5 条
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={uploading}
                      className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      确认导入
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        {previewColumns.map((col) => (
                          <th
                            key={col.key}
                            className="px-3 py-2 text-left text-xs font-semibold text-slate-600 border-b"
                          >
                            {col.title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewData.previewData.slice(0, 5).map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-slate-50">
                          {previewColumns.map((col) => (
                            <td key={col.key} className="px-3 py-2 text-slate-700">
                              {row[col.key]}
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

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Link2 className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-slate-800">关联图谱</h4>
            </div>
            <LinkGraphView data={graphData || undefined} loading={graphLoading} className="h-96" />
          </div>
        </div>
      </Card>

      <Card title="异常数据" subtitle="需要关注和处理的数据异常">
        <Table<AnomalyData>
          columns={anomalyColumns}
          data={anomalyData}
          rowKey={(record) => record.id}
        />
      </Card>
    </div>
  );
}
