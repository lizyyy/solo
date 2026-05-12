import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, AlertCircle, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ImportBatch, ViolationRecord } from '../types';
import { importViolations, getBatches } from '../services/violationService';
import { formatDateTime } from '../utils/format';

const ImportExport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'batches'>('import');
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [importResult, setImportResult] = useState<{
    success: number;
    duplicate: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = () => {
    setBatches(getBatches());
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      alert('请上传 Excel 或 CSV 文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      const result = importViolations(jsonData, file.name, '张三');
      setImportResult({
        success: result.batch.successfulRecords,
        duplicate: result.batch.duplicateRecords,
        total: result.batch.totalRecords,
        fileName: result.batch.fileName,
      });
      loadBatches();
    };
    reader.readAsBinaryString(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleExport = () => {
    const violations = JSON.parse(localStorage.getItem('violation_records') || '[]');
    const exportData = violations.map((v: ViolationRecord) => ({
      '违章编号': v.violationNumber,
      '车牌号': v.plateNumber,
      '违章时间': v.violationTime,
      '违章类型': v.violationType,
      '违章地点': v.location,
      '违章描述': v.description,
      '扣分': v.points,
      '罚款金额': v.fineAmount,
      '状态': v.status,
      '匹配司机': v.matchedDriverId || '',
      '导入时间': v.importedAt,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '违章记录');
    XLSX.writeFile(wb, `违章记录_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadTemplate = () => {
    const template = [
      {
        '违章编号': 'VIO001',
        '车牌号': '京A12345',
        '违章时间': '2024-01-15T08:30:00',
        '违章类型': 'speeding',
        '违章地点': '北京市朝阳区建国路',
        '违章描述': '超速10%以上未达20%',
        '扣分': 3,
        '罚款金额': 200,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '模板');
    XLSX.writeFile(wb, '违章导入模板.xlsx');
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 bg-white rounded-lg p-1 shadow-sm w-fit">
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
            activeTab === 'import'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>导入违章</span>
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
            activeTab === 'export'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>导出数据</span>
        </button>
        <button
          onClick={() => setActiveTab('batches')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
            activeTab === 'batches'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>导入记录</span>
        </button>
      </div>

      {activeTab === 'import' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">导入违章记录</h2>

          {importResult && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <Check className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">导入完成</span>
              </div>
              <div className="mt-2 text-sm text-green-700">
                <p>文件：{importResult.fileName}</p>
                <p>共 {importResult.total} 条记录，成功导入 {importResult.success} 条，{importResult.duplicate} 条重复已跳过</p>
              </div>
            </div>
          )}

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="hidden"
            />
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              拖拽文件到此处或点击上传
            </p>
            <p className="text-sm text-gray-500 mb-4">
              支持 Excel (.xlsx, .xls) 和 CSV 格式
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              选择文件
            </button>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-yellow-800 mb-2">导入说明</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• 请确保文件格式正确，建议先下载导入模板</li>
                  <li>• 违章编号、车牌号、违章时间为必填字段</li>
                  <li>• 系统会自动检测重复数据并跳过</li>
                  <li>• 系统会自动根据违章时间匹配车辆班次和司机</li>
                  <li>• 违章类型可选：speeding（超速）、red_light（闯红灯）、wrong_parking（违停）、lane_violation（不按车道行驶）、overload（超载）、other（其他）</li>
                </ul>
                <button
                  onClick={downloadTemplate}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  <Download className="w-4 h-4" />
                  <span>下载导入模板</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'export' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">导出违章数据</h2>

          <div className="space-y-4">
            <div className="p-4 border border-gray-200 rounded-lg hover:border-blue-400 transition-colors cursor-pointer" onClick={handleExport}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">导出全部违章记录</h3>
                    <p className="text-sm text-gray-500">导出所有违章记录为 Excel 文件</p>
                  </div>
                </div>
                <Download className="w-5 h-5 text-gray-400" />
              </div>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-700 mb-2">导出内容包含</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                <div>• 违章编号和车牌号</div>
                <div>• 违章时间和地点</div>
                <div>• 违章类型和描述</div>
                <div>• 扣分和罚款金额</div>
                <div>• 当前处理状态</div>
                <div>• 匹配的司机信息</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'batches' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">导入批次记录</h2>

          {batches.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>暂无导入记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      文件名
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      导入时间
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作人
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      总记录数
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      成功导入
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      重复跳过
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{batch.fileName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(batch.importedAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {batch.importedBy}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {batch.totalRecords}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-green-600 font-medium">{batch.successfulRecords}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-orange-600 font-medium">{batch.duplicateRecords}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportExport;
