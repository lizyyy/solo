import { useState, useCallback } from 'react';
import { useCarbonStore } from '@/store/carbonStore';
import { parseExcel, parseCSV, generateSampleExcel } from '@/utils/excelParser';
import type { SourceType, CarbonRecord } from '@/types';
import { SOURCE_TYPE_LABELS } from '@/types';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Camera,
  FileCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Trash2,
} from 'lucide-react';
import StatusBadge from '@/components/common/StatusBadge';
import SourceBadge from '@/components/common/SourceBadge';
import type { ParsedData } from '@/utils/excelParser';

interface PendingRecord {
  data: Partial<CarbonRecord>;
  errors: string[];
  selected: boolean;
}

export default function Import() {
  const [isDragging, setIsDragging] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [pendingRecords, setPendingRecords] = useState<PendingRecord[]>([]);
  const [selectedSourceType, setSelectedSourceType] = useState<SourceType>('street_form');
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  
  const { addRecords } = useCarbonStore();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateRecord = (record: Partial<CarbonRecord>): string[] => {
    const errors: string[] = [];
    if (!record.pointName) {
      errors.push('缺少点位名称');
    }
    if (!record.address) {
      errors.push('缺少地址信息');
    }
    if (record.carbonAmount === undefined || record.carbonAmount === null) {
      errors.push('缺少碳排放量');
    } else if (record.carbonAmount <= 0) {
      errors.push('碳排放量应为正数');
    }
    return errors;
  };

  const processFile = async (file: File) => {
    try {
      let result: ParsedData;
      
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        result = await parseExcel(file);
      } else if (file.name.endsWith('.csv')) {
        result = await parseCSV(file);
      } else {
        alert('不支持的文件格式，请上传 Excel (.xlsx, .xls) 或 CSV 文件');
        return;
      }

      setParsedData(result);
      setSelectedSourceType(result.sourceType);
      
      const pending = result.records.map(record => ({
        data: { ...record, sourceType: result.sourceType },
        errors: validateRecord(record),
        selected: true,
      }));
      setPendingRecords(pending);
      setImportSuccess(false);
    } catch (error) {
      console.error('文件解析失败:', error);
      alert('文件解析失败，请检查文件格式是否正确');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleSourceTypeChange = (type: SourceType) => {
    setSelectedSourceType(type);
    setPendingRecords(prev => prev.map(r => ({
      ...r,
      data: { ...r.data, sourceType: type },
    })));
  };

  const toggleSelectAll = () => {
    const allSelected = pendingRecords.every(r => r.selected);
    setPendingRecords(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  };

  const toggleSelectRecord = (index: number) => {
    setPendingRecords(prev => prev.map((r, i) => 
      i === index ? { ...r, selected: !r.selected } : r
    ));
  };

  const removeRecord = (index: number) => {
    setPendingRecords(prev => prev.filter((_, i) => i !== index));
  };

  const handleImport = () => {
    const selectedRecords = pendingRecords
      .filter(r => r.selected)
      .map(r => r.data);
    
    if (selectedRecords.length === 0) {
      alert('请至少选择一条记录进行导入');
      return;
    }

    setImporting(true);
    setTimeout(() => {
      addRecords(selectedRecords, selectedSourceType);
      setImporting(false);
      setImportSuccess(true);
      setTimeout(() => {
        setParsedData(null);
        setPendingRecords([]);
        setImportSuccess(false);
      }, 2000);
    }, 500);
  };

  const clearAll = () => {
    setParsedData(null);
    setPendingRecords([]);
    setImportSuccess(false);
  };

  const sourceTypeOptions: { type: SourceType; icon: typeof FileText; label: string }[] = [
    { type: 'street_form', icon: FileText, label: '街道表格' },
    { type: 'inspection_photo', icon: Camera, label: '现场照片' },
    { type: 'approval_record', icon: FileCheck, label: '审批记录' },
  ];

  const validCount = pendingRecords.filter(r => r.errors.length === 0).length;
  const warningCount = pendingRecords.filter(r => r.errors.length > 0).length;
  const selectedCount = pendingRecords.filter(r => r.selected).length;

  return (
    <div className="space-y-6">
      {importSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center gap-3 animate-slide-in-right">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800">成功导入 {selectedCount} 条记录，已自动执行归并匹配</span>
        </div>
      )}

      {!parsedData && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-all duration-200 cursor-pointer ${
            isDragging
              ? 'border-primary-500 bg-primary-50 scale-[1.01]'
              : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }`}
        >
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-colors ${
            isDragging ? 'bg-primary-100' : 'bg-gray-100'
          }`}>
            <Upload className={`w-8 h-8 ${isDragging ? 'text-primary-600' : 'text-gray-400'}`} />
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">
            拖拽文件到此处或点击上传
          </h3>
          <p className="text-gray-500 mb-4">
            支持 Excel (.xlsx, .xls) 和 CSV 格式文件
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="btn-primary inline-flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            选择文件
          </label>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={generateSampleExcel}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1 mx-auto"
            >
              <Download className="w-4 h-4" />
              下载样例数据模板
            </button>
          </div>
        </div>
      )}

      {parsedData && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-semibold text-gray-800">
                导入预览：{parsedData.fileName}
              </h3>
              <p className="text-sm text-gray-500">
                共解析 {pendingRecords.length} 条记录，
                <span className="text-green-600">{validCount} 条正常</span>，
                <span className="text-warn-600">{warningCount} 条需注意</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={clearAll} className="btn-secondary flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                清空
              </button>
              <button
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {importing ? '导入中...' : `确认导入 (${selectedCount})`}
              </button>
            </div>
          </div>

          <div className="card p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">选择数据来源类型</h4>
            <div className="flex gap-3">
              {sourceTypeOptions.map((option) => (
                <button
                  key={option.type}
                  onClick={() => handleSourceTypeChange(option.type)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-all ${
                    selectedSourceType === option.type
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <option.icon className="w-4 h-4" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pendingRecords.length > 0 && pendingRecords.every(r => r.selected)}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <span className="text-sm text-gray-700">全选</span>
              </label>
              <span className="text-sm text-gray-500">
                已选择 {selectedCount} / {pendingRecords.length} 条
              </span>
            </div>
            
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {pendingRecords.map((record, index) => (
                <div
                  key={index}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    !record.selected ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={record.selected}
                      onChange={() => toggleSelectRecord(index)}
                      className="mt-1 w-4 h-4 text-primary-600 rounded"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-medium text-gray-800">
                          {record.data.pointName || '未命名点位'}
                        </p>
                        <SourceBadge
                          sourceType={record.data.sourceType || selectedSourceType}
                          className="text-xs"
                        />
                        {record.data.isOldCaliber && (
                          <span className="status-badge bg-orange-50 text-orange-700 border-orange-200 text-xs">
                            旧口径
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">地址</p>
                          <p className="text-gray-800">{record.data.address || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">碳排放量</p>
                          <p className="text-gray-800 font-medium">
                            {record.data.carbonAmount || 0} {record.data.unit || 'kgCO2e'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">记录日期</p>
                          <p className="text-gray-800">{record.data.recordDate || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">备注</p>
                          <p className="text-gray-800 truncate">{record.data.remark || '-'}</p>
                        </div>
                      </div>
                      
                      {record.errors.length > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-warn-600">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm">
                            {record.errors.join('、')}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {record.errors.length === 0 ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-warn-500" />
                      )}
                      <button
                        onClick={() => removeRecord(index)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                      >
                        <XCircle className="w-4 h-4 text-gray-400 hover:text-danger-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">导入说明</h4>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li>导入完成后系统会自动执行点位名称归并匹配</li>
              <li>匹配度 ≥85% 的记录将自动归并，60%-85% 的记录需要人工确认</li>
              <li>所有操作都会留下审核痕迹，可在导出时查看完整判断过程</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
