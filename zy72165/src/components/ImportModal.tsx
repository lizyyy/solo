import { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseExcelFile, type ImportPointData, sourceToLabel } from '../utils/importExport';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (points: ImportPointData[]) => void;
}

const ImportModal = ({ isOpen, onClose, onImport }: ImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPointData[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');
    setLoading(true);

    try {
      const data = await parseExcelFile(selectedFile);
      setPreview(data);
    } catch {
      setError('文件解析失败，请检查格式');
      setPreview([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    onImport(preview);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">导入点位数据</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-amber-500 hover:bg-amber-50 transition-all"
            >
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">点击选择Excel文件</p>
              <p className="text-slate-400 text-sm mt-1">支持 .xlsx, .xls 格式</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg mb-4">
                <FileSpreadsheet className="w-8 h-8 text-green-500" />
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{file.name}</p>
                  <p className="text-sm text-slate-500">共 {preview.length} 条数据</p>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setPreview([]);
                  }}
                  className="text-sm text-red-500 hover:text-red-600"
                >
                  重新选择
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg mb-4">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {loading && (
                <div className="text-center py-8 text-slate-500">正在解析文件...</div>
              )}

              {preview.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-slate-600 font-medium">点位名称</th>
                          <th className="px-3 py-2 text-left text-slate-600 font-medium">位置</th>
                          <th className="px-3 py-2 text-left text-slate-600 font-medium">医院</th>
                          <th className="px-3 py-2 text-left text-slate-600 font-medium">来源</th>
                          <th className="px-3 py-2 text-left text-slate-600 font-medium">原始备注</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {preview.slice(0, 10).map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-800">{row.name || '-'}</td>
                            <td className="px-3 py-2 text-slate-600">{row.location || '-'}</td>
                            <td className="px-3 py-2 text-slate-600">{row.hospital || '-'}</td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                {sourceToLabel(row.source)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-600 max-w-xs truncate">{row.rawNote || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.length > 10 && (
                    <p className="text-center text-sm text-slate-500 py-2 bg-slate-50">
                      还有 {preview.length - 10} 条数据未显示
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-700">
                  <strong>提示：</strong>导入时会保留原始备注字段，不会进行清洗处理。
                  来源列会自动映射：街道表格/街道→街道表格，现场巡检/现场/巡检→现场巡检，审批记录/审批→审批记录。无法识别的来源归为"其他来源"。
                  原始来源值会保留在"来源说明"字段中。
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!file || preview.length === 0}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              file && preview.length > 0
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            )}
          >
            确认导入 ({preview.length} 条)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
