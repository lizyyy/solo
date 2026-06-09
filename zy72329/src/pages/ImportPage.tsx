import { useState, useEffect, useRef } from 'react';
import { Upload, FileSpreadsheet, FileText, Clock, CheckCircle, AlertCircle, X, Info, Shield, GitBranch, History } from 'lucide-react';
import { api } from '../lib/api';
import { useDataStore } from '../store/dataStore';
import { useAuthStore } from '../store/authStore';
import { cn } from '../lib/utils';

interface ImportHistoryItem {
  id: string;
  type: 'teacher_note' | 'sampling_list';
  fileName: string;
  importedAt: string;
  importedBy: string;
  count: number;
  status: 'success' | 'error' | 'processing';
  message?: string;
}

interface ImportStats {
  newRecords: number;
  gaps: number;
  supplements: number;
  conflicts: number;
}

export default function ImportPage() {
  const { user: currentUser } = useAuthStore();
  const { refreshAll, records, conflicts, gaps } = useDataStore();
  const [teacherDragActive, setTeacherDragActive] = useState(false);
  const [samplingDragActive, setSamplingDragActive] = useState(false);
  const [teacherFile, setTeacherFile] = useState<File | null>(null);
  const [samplingFile, setSamplingFile] = useState<File | null>(null);
  const [teacherUploading, setTeacherUploading] = useState(false);
  const [samplingUploading, setSamplingUploading] = useState(false);
  const [teacherResult, setTeacherResult] = useState<{ success: boolean; count: number; message: string } | null>(null);
  const [samplingResult, setSamplingResult] = useState<{ success: boolean; count: number; message: string } | null>(null);
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const teacherInputRef = useRef<HTMLInputElement>(null);
  const samplingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadImportHistory();
  }, []);

  const loadImportHistory = () => {
    const mockHistory: ImportHistoryItem[] = [
      { id: '1', type: 'teacher_note', fileName: 'teacher_notes_2024_01.csv', importedAt: '2024-01-15 10:30:00', importedBy: '系统管理员', count: 156, status: 'success' },
      { id: '2', type: 'sampling_list', fileName: 'sampling_list_2024_01.xlsx', importedAt: '2024-01-15 10:25:00', importedBy: '系统管理员', count: 148, status: 'success' },
      { id: '3', type: 'teacher_note', fileName: 'teacher_notes_2024_02.csv', importedAt: '2024-01-14 15:20:00', importedBy: '系统管理员', count: 0, status: 'error', message: '文件格式错误' },
    ];
    setImportHistory(mockHistory);
  };

  const calculateImportStats = (): ImportStats => {
    const gapCount = gaps.filter((g) => g.reviewStatus === 'pending').length;
    const supplementCount = records.filter((r) => r.status === 'supplement').length;
    const conflictCount = conflicts.filter((c) => !c.resolution).length;
    return {
      newRecords: records.length,
      gaps: gapCount,
      supplements: supplementCount,
      conflicts: conflictCount,
    };
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent, setActive: (active: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setActive(true);
    }
  };

  const handleDragOut = (e: React.DragEvent, setActive: (active: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(false);
  };

  const handleDrop = (e: React.DragEvent, setFile: (file: File | null) => void, setActive: (active: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setFile(file);
      }
    }
  };

  const validateFile = (file: File): boolean => {
    const validTypes = ['.csv', '.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValid = validTypes.some((type) => fileName.endsWith(type));
    if (!isValid) {
      alert('请上传 CSV 或 Excel 格式的文件');
    }
    return isValid;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, setFile: (file: File | null) => void) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setFile(file);
      }
    }
  };

  const handleTeacherUpload = async () => {
    if (!teacherFile) return;
    setTeacherUploading(true);
    setTeacherResult(null);
    try {
      const result = await api.importTeacherNotes(teacherFile);
      setTeacherResult({ success: result.success, count: result.importedCount, message: result.message });
      setTeacherFile(null);
      await refreshAll();
      setImportStats(calculateImportStats());
      setShowSuccessBanner(true);
      setTimeout(() => setShowSuccessBanner(false), 8000);
      loadImportHistory();
    } catch (error) {
      setTeacherResult({ success: false, count: 0, message: error instanceof Error ? error.message : '导入失败' });
    } finally {
      setTeacherUploading(false);
    }
  };

  const handleSamplingUpload = async () => {
    if (!samplingFile) return;
    setSamplingUploading(true);
    setSamplingResult(null);
    try {
      const result = await api.importSamplingList(samplingFile);
      setSamplingResult({ success: result.success, count: result.importedCount, message: result.message });
      setSamplingFile(null);
      await refreshAll();
      setImportStats(calculateImportStats());
      setShowSuccessBanner(true);
      setTimeout(() => setShowSuccessBanner(false), 8000);
      loadImportHistory();
    } catch (error) {
      setSamplingResult({ success: false, count: 0, message: error instanceof Error ? error.message : '导入失败' });
    } finally {
      setSamplingUploading(false);
    }
  };

  const UploadZone = ({
    type,
    title,
    description,
    icon: Icon,
    dragActive,
    setDragActive,
    file,
    setFile,
    uploading,
    result,
    onUpload,
    inputRef,
  }: {
    type: 'teacher' | 'sampling';
    title: string;
    description: string;
    icon: typeof FileText;
    dragActive: boolean;
    setDragActive: (active: boolean) => void;
    file: File | null;
    setFile: (file: File | null) => void;
    uploading: boolean;
    result: { success: boolean; count: number; message: string } | null;
    onUpload: () => void;
    inputRef: React.RefObject<HTMLInputElement>;
  }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-12 h-12 rounded-lg flex items-center justify-center',
            type === 'teacher' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
          )}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50',
          uploading && 'opacity-50 pointer-events-none'
        )}
        onDragEnter={(e) => handleDragIn(e, setDragActive)}
        onDragLeave={(e) => handleDragOut(e, setDragActive)}
        onDragOver={handleDrag}
        onDrop={(e) => handleDrop(e, setFile, setDragActive)}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFileSelect(e, setFile)}
        />
        <Upload className={cn(
          'w-12 h-12 mx-auto mb-4',
          dragActive ? 'text-blue-500' : 'text-gray-400'
        )} />
        <p className="text-sm font-medium text-gray-700 mb-1">
          {uploading ? '正在上传...' : '拖拽文件到此处，或点击选择文件'}
        </p>
        <p className="text-xs text-gray-500">支持 CSV、Excel（.xlsx/.xls）格式</p>
      </div>

      {file && (
        <div className="mt-4 flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm font-medium text-gray-800">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpload();
              }}
              disabled={uploading}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                type === 'teacher'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-green-600 text-white hover:bg-green-700',
                uploading && 'opacity-50 cursor-not-allowed'
              )}
            >
              {uploading ? '上传中...' : '开始导入'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={cn(
          'mt-4 p-4 rounded-lg border flex items-start gap-3',
          result.success
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        )}>
          {result.success ? (
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className={cn(
              'text-sm font-medium',
              result.success ? 'text-green-800' : 'text-red-800'
            )}>
              {result.success ? '导入成功' : '导入失败'}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {result.success
                ? `成功导入 ${result.count} 条记录`
                : result.message}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700">
            <p className="font-medium mb-1">格式说明：</p>
            <ul className="list-disc list-inside space-y-0.5">
              {type === 'teacher' ? (
                <>
                  <li>包含字段：记录编号、日期、老师姓名、金额、项目类型、批注内容</li>
                  <li>金额需为数字格式，日期格式为 YYYY-MM-DD</li>
                </>
              ) : (
                <>
                  <li>包含字段：记录编号、日期、老师姓名、金额、项目类型、场景描述</li>
                  <li>场景描述需详细说明抽样场景</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">数据导入</h1>
          <p className="text-sm text-gray-500 mt-1">导入老师批注和抽样名单数据</p>
        </div>
        {currentUser && (
          <div className="text-sm text-gray-500">
            当前操作人：<span className="font-medium text-gray-700">{currentUser.name}</span>
          </div>
        )}
      </div>

      {showSuccessBanner && importStats && (
        <div className="bg-green-50 border-2 border-green-400 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-green-900 text-base mb-2">
                🎉 导入完成！数据已同步到全系统各页面
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div className="bg-white p-3 rounded-lg border border-green-200">
                  <div className="text-xs text-gray-500">总记录数</div>
                  <div className="text-xl font-bold text-gray-800">{importStats.newRecords}</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-orange-200">
                  <div className="text-xs text-gray-500">识别断档</div>
                  <div className="text-xl font-bold text-orange-600">{importStats.gaps}</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-purple-200">
                  <div className="text-xs text-gray-500">补录记录</div>
                  <div className="text-xl font-bold text-purple-600">{importStats.supplements}</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-red-200">
                  <div className="text-xs text-gray-500">数据冲突</div>
                  <div className="text-xl font-bold text-red-600">{importStats.conflicts}</div>
                </div>
              </div>
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-800 space-y-0.5">
                    <p className="font-medium">导入完成后：</p>
                    <ul className="list-disc list-inside space-y-0.5 mt-1">
                      <li>参数版本页会自动生成新版本快照</li>
                      <li>历史记录页会记录所有操作轨迹</li>
                      <li>整合结果页立即显示最新状态统计</li>
                      <li>断档复核/冲突处理页同步最新待办</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">提示：</p>
            <p className="mt-1 text-amber-700">
              导入完成后，参数版本页会自动生成新版本快照，历史记录页会记录所有操作轨迹。
              全系统各页面（整合结果、断档复核、冲突处理等）将同步显示同一份最新数据。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UploadZone
          type="teacher"
          title="老师批注导入"
          description="导入老师提交的批注数据"
          icon={FileText}
          dragActive={teacherDragActive}
          setDragActive={setTeacherDragActive}
          file={teacherFile}
          setFile={setTeacherFile}
          uploading={teacherUploading}
          result={teacherResult}
          onUpload={handleTeacherUpload}
          inputRef={teacherInputRef}
        />
        <UploadZone
          type="sampling"
          title="抽样名单导入"
          description="导入抽样检查的名单数据"
          icon={FileSpreadsheet}
          dragActive={samplingDragActive}
          setDragActive={setSamplingDragActive}
          file={samplingFile}
          setFile={setSamplingFile}
          uploading={samplingUploading}
          result={samplingResult}
          onUpload={handleSamplingUpload}
          inputRef={samplingInputRef}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" />
            最近导入记录
          </h2>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <GitBranch className="w-3 h-3" />
              导入即生成版本快照
            </span>
            <span className="flex items-center gap-1">
              <History className="w-3 h-3" />
              所有操作记入历史
            </span>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {importHistory.length === 0 ? (
            <div className="p-8 text-center text-gray-500">暂无导入记录</div>
          ) : (
            importHistory.map((item) => (
              <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    item.type === 'teacher_note' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                  )}>
                    {item.type === 'teacher_note' ? (
                      <FileText className="w-5 h-5" />
                    ) : (
                      <FileSpreadsheet className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {item.type === 'teacher_note' ? '老师批注' : '抽样名单'} · {item.importedBy} · {item.importedAt}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800">
                      {item.status === 'success' ? `${item.count} 条` : '-'}
                    </p>
                    <p className={cn(
                      'text-xs flex items-center gap-1 justify-end',
                      item.status === 'success' ? 'text-green-600' : 'text-red-600'
                    )}>
                      {item.status === 'success' ? (
                        <><CheckCircle className="w-3 h-3" /> 成功</>
                      ) : item.status === 'error' ? (
                        <><AlertCircle className="w-3 h-3" /> 失败</>
                      ) : (
                        <><Clock className="w-3 h-3" /> 处理中</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
