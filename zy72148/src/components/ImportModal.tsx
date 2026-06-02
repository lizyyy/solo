import { useState } from 'react';
import { X, Upload, FileText, AlertCircle } from 'lucide-react';
import { parseImportFile } from '@/utils/import';
import { useAllocationStore } from '@/store/useAllocationStore';
import type { RoomAllocation, ImportSourceInfo } from '@/types';
import { sampleAllocationsV2 } from '@/data/sampleData';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConflictsFound: (conflicts: any[], versionId: string) => void;
}

export const ImportModal = ({ isOpen, onClose, onConflictsFound }: ImportModalProps) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'conflicts'>('upload');
  const [parsedData, setParsedData] = useState<Partial<RoomAllocation>[]>([]);
  const [sourceInfo, setSourceInfo] = useState<ImportSourceInfo>({
    fileName: '',
    operator: '小孟',
    changeNote: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const importVersion = useAllocationStore(state => state.importVersion);
  const operator = useAllocationStore(state => state.operator);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsLoading(true);

    try {
      const data = await parseImportFile(file);
      if (data.length === 0) {
        setError('文件中没有解析到有效数据，请检查文件格式');
        return;
      }
      setParsedData(data);
      setSourceInfo(prev => ({ ...prev, fileName: file.name }));
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件解析失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSample = () => {
    setParsedData(sampleAllocationsV2);
    setSourceInfo(prev => ({
      ...prev,
      fileName: '舞台通道表v2.xlsx (样例)',
    }));
    setStep('preview');
  };

  const handleImport = () => {
    if (!sourceInfo.changeNote.trim()) {
      setError('请填写变更说明，方便后续追溯');
      return;
    }

    const { conflicts, newVersionId } = importVersion(parsedData, {
      ...sourceInfo,
      operator,
    });

    if (conflicts.length > 0) {
      onConflictsFound(conflicts, newVersionId);
    } else {
      useAllocationStore.getState().finalizeImport(newVersionId);
      onClose();
    }
    
    setStep('upload');
    setParsedData([]);
    setSourceInfo({ fileName: '', operator: '小孟', changeNote: '' });
  };

  const handleClose = () => {
    setStep('upload');
    setParsedData([]);
    setSourceInfo({ fileName: '', operator: '小孟', changeNote: '' });
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 animate-fade-in" onClick={handleClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl z-50 animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-serif text-lg font-semibold text-gray-800">
            {step === 'upload' ? '导入数据' : step === 'preview' ? '数据预览' : '冲突处理'}
          </h3>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-1">点击或拖拽文件到这里</p>
                <p className="text-sm text-gray-400">支持 CSV、JSON 格式</p>
              </div>

              <div className="text-center">
                <span className="text-sm text-gray-400">或者</span>
              </div>

              <button
                onClick={handleLoadSample}
                className="w-full btn-secondary flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                加载"舞台通道表v2"样例数据（用于测试冲突）
              </button>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <div className="bg-primary-50 rounded-lg p-4">
                <p className="text-sm text-primary-800">
                  共解析到 <span className="font-semibold">{parsedData.length}</span> 条记录，请确认无误后填写变更说明并导入。
                </p>
              </div>

              <div className="overflow-x-auto max-h-60 border border-gray-100 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">巡演</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">酒店</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">房型</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">入住人</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">入住</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {parsedData.slice(0, 10).map((record, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{record.tourName}</td>
                        <td className="px-3 py-2">{record.hotelName}</td>
                        <td className="px-3 py-2">{record.roomType}</td>
                        <td className="px-3 py-2">{record.personName}</td>
                        <td className="px-3 py-2">{record.checkInDate}</td>
                      </tr>
                    ))}
                    {parsedData.length > 10 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-center text-gray-400">
                          ...还有 {parsedData.length - 10} 条记录
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    来源文件
                  </label>
                  <input
                    type="text"
                    value={sourceInfo.fileName}
                    disabled
                    className="input-base bg-gray-50 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    变更说明 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={sourceInfo.changeNote}
                    onChange={(e) => setSourceInfo(prev => ({ ...prev, changeNote: e.target.value }))}
                    placeholder="比如：更新了上海站艺人的房型、新增工作人员B..."
                    className="input-base min-h-[80px]"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    写清楚改了什么，后面交接的时候一目了然
                  </p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('upload')}
                  className="btn-secondary flex-1"
                >
                  返回
                </button>
                <button
                  onClick={handleImport}
                  className="btn-primary flex-1"
                  disabled={isLoading}
                >
                  {isLoading ? '导入中...' : '确认导入'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
