import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, Info, History } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { importApi } from '../api/importApi';
import type { ImportBatch } from '../../shared/types';
import dayjs from 'dayjs';

export const ImportPage: React.FC = () => {
  const { currentUser, setImportBatches, setLoading, setError } = useAppStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [duplicateCheck, setDuplicateCheck] = useState<any>(null);
  const [forceReimport, setForceReimport] = useState(false);
  const [batches, setBatches] = useState<ImportBatch[]>([]);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      const res = await importApi.getBatches();
      setBatches(res.data);
      setImportBatches(res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.csv')) {
      setSelectedFile(files[0]);
      setImportResult(null);
      setDuplicateCheck(null);
      checkDuplicate(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      setSelectedFile(file);
      setImportResult(null);
      setDuplicateCheck(null);
      checkDuplicate(file);
    }
  };

  const checkDuplicate = async (file: File) => {
    try {
      setLoading(true);
      const res = await importApi.checkDuplicate(file);
      setDuplicateCheck(res.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    try {
      setLoading(true);
      const res = await importApi.importCSV(selectedFile, currentUser, forceReimport);
      setImportResult(res.data);
      loadBatches();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const generateSampleCSV = () => {
    const header = 'orderNo,sku,quantity,warehouseZone,distance,estimatedTime';
    const rows = [];
    for (let i = 1; i <= 10; i++) {
      rows.push([
        `ORD-${String(i).padStart(4, '0')}`,
        `SKU-${String(i).padStart(6, '0')}`,
        Math.floor(Math.random() * 50) + 1,
        ['A区', 'B区', 'C区', 'D区'][Math.floor(Math.random() * 4)],
        Math.floor(Math.random() * 500) + 50,
        Math.floor(Math.random() * 30) + 5,
      ].join(','));
    }
    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `边界值说明示例_${dayjs().format('YYYYMMDD')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-gray-900">边界值说明导入</h2>
          <p className="mt-1 text-sm text-gray-500">
            第一步：上传边界值说明CSV，系统自动记录原始行号并检测重复导入
          </p>
        </div>
        <button
          onClick={generateSampleCSV}
          className="inline-flex items-center px-4 py-2 border-2 border-primary-500 text-primary-600 font-medium hover:bg-primary-50 transition-colors"
        >
          <FileText className="w-4 h-4 mr-2" />
          下载示例CSV
        </button>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : duplicateCheck?.isDuplicate
            ? 'border-warning-400 bg-warning-50'
            : 'border-gray-300 bg-white hover:border-primary-400 hover:bg-gray-50'
        }`}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center">
          {duplicateCheck?.isDuplicate ? (
            <AlertTriangle className="w-16 h-16 text-warning-500 mb-4" />
          ) : (
            <Upload className={`w-16 h-16 mb-4 ${isDragging ? 'text-primary-500' : 'text-gray-400'}`} />
          )}
          {selectedFile ? (
            <div>
              <p className="text-lg font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-sm text-gray-500 mt-1">
                {(selectedFile.size / 1024).toFixed(2)} KB · {new Date(selectedFile.lastModified).toLocaleString()}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-lg font-medium text-gray-900">拖拽CSV文件到此处，或点击选择文件</p>
              <p className="text-sm text-gray-500 mt-1">仅支持 .csv 格式文件</p>
            </div>
          )}
        </div>
      </div>

      {duplicateCheck?.isDuplicate && (
        <div className="bg-warning-50 border-2 border-warning-400 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-warning-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-warning-800">检测到重复导入</h4>
              <p className="mt-1 text-sm text-warning-700">
                该文件已于 <span className="font-medium">{dayjs(duplicateCheck.duplicateInfo.createdAt).format('YYYY年MM月DD日 HH:mm')}</span>
                由 <span className="font-medium">{duplicateCheck.duplicateInfo.operator}</span> 导入，
                文件名：{duplicateCheck.duplicateInfo.fileName}
              </p>
              <label className="mt-3 flex items-center">
                <input
                  type="checkbox"
                  checked={forceReimport}
                  onChange={(e) => setForceReimport(e.target.checked)}
                  className="w-4 h-4 text-warning-600 border-warning-300 rounded focus:ring-warning-500"
                />
                <span className="ml-2 text-sm text-warning-700">强制重新导入（将覆盖历史数据）</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {selectedFile && (
        <div className="flex items-center justify-end space-x-4">
          <button
            onClick={() => { setSelectedFile(null); setImportResult(null); setDuplicateCheck(null); }}
            className="px-6 py-2 border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={duplicateCheck?.isDuplicate && !forceReimport}
            className={`px-6 py-2 font-medium transition-colors ${
              duplicateCheck?.isDuplicate && !forceReimport
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            }`}
          >
            {duplicateCheck?.isDuplicate ? '强制导入' : '开始导入'}
          </button>
        </div>
      )}

      {importResult && (
        <div className={`border-2 rounded-lg p-6 ${
          importResult.isDuplicate && importResult.importedRows === 0
            ? 'bg-warning-50 border-warning-300'
            : 'bg-green-50 border-green-300'
        }`}>
          <div className="flex items-start">
            {importResult.isDuplicate && importResult.importedRows === 0 ? (
              <AlertTriangle className="w-6 h-6 text-warning-600 mr-3" />
            ) : (
              <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
            )}
            <div>
              <h4 className="font-medium text-gray-900">
                {importResult.isDuplicate && importResult.importedRows === 0 ? '导入中断' : '导入完成'}
              </h4>
              <div className="mt-2 text-sm text-gray-600 space-y-1">
                <p>批次号：{importResult.batchId || '（未实际导入）'}</p>
                <p>总行数：{importResult.totalRows}</p>
                <p>成功导入：{importResult.importedRows} 行</p>
                {importResult.warnings.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-warning-700">警告信息：</p>
                    <ul className="list-disc list-inside mt-1">
                      {importResult.warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center">
          <History className="w-5 h-5 text-gray-500 mr-2" />
          <h3 className="font-serif text-lg font-bold text-gray-900">导入历史</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {batches.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Info className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>暂无导入记录</p>
            </div>
          ) : (
            batches.map((batch) => (
              <div key={batch.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{batch.fileName}</p>
                  <div className="mt-1 text-sm text-gray-500 flex items-center space-x-4">
                    <span>共 {batch.totalRows} 行</span>
                    <span>操作人：{batch.operator}</span>
                    <span>{dayjs(batch.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                    {batch.isForceReimport && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-warning-100 text-warning-800">
                        强制重导
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-400 font-mono">{batch.id.slice(0, 8)}...</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
