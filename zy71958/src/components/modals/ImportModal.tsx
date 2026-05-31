import { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, Check } from 'lucide-react';
import { useUiStore } from '../../store/useUiStore';
import { useRecordsStore } from '../../store/useRecordsStore';
import { parseImportFile, validateKML } from '../../utils/import';
import { cn } from '../../lib/utils';

export function ImportModal() {
  const { activeModal, closeModal, currentUser } = useUiStore();
  const { addRecord } = useRecordsStore();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [pilot, setPilot] = useState(currentUser);
  const [batteryCycle, setBatteryCycle] = useState(0);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (activeModal !== 'import') return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrors([]);
    setSuccess(false);

    try {
      const result = await parseImportFile(selectedFile);
      setPreview(result);

      if (result.type === 'kml') {
        const validation = validateKML(result.data);
        if (!validation.valid) {
          setErrors(validation.errors);
        }
      }

      if (result.data.name) {
        setSource(`${selectedFile.name} 导入`);
      }
    } catch (error) {
      setErrors([(error as Error).message]);
      setPreview(null);
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    setLoading(true);
    setErrors([]);

    try {
      if (preview.type === 'kml') {
        await addRecord(
          {
            source: source || `${file?.name} 导入`,
            pilot,
            batteryCycle,
          },
          preview.data,
          currentUser
        );
        setSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 1000);
      } else if (preview.type === 'csv') {
        for (const recordData of preview.data) {
          await addRecord(
            {
              source: recordData.source || source || 'CSV批量导入',
              pilot: recordData.pilot || pilot,
              batteryCycle: recordData.batteryCycle || batteryCycle,
            },
            {
              name: `航线-${recordData.pilot || pilot}`,
              coordinates: [],
            },
            currentUser
          );
        }
        setSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 1000);
      }
    } catch (error) {
      setErrors([(error as Error).message]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setErrors([]);
    setSuccess(false);
    setPilot(currentUser);
    setBatteryCycle(0);
    setSource('');
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 rounded-xl border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <h3 className="text-lg font-semibold text-slate-200">导入数据</h3>
          <button
            onClick={handleClose}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-green-400 font-medium">导入成功</p>
            </div>
          ) : (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  file
                    ? 'border-orange-500/50 bg-orange-500/10'
                    : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".kml,.kmz,.csv,.json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {file ? (
                  <div>
                    <FileText className="w-12 h-12 mx-auto mb-2 text-orange-400" />
                    <p className="text-slate-200 font-medium">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {(file.size / 1024).toFixed(1)} KB · 点击重新选择
                    </p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-12 h-12 mx-auto mb-2 text-slate-500" />
                    <p className="text-slate-400">点击或拖拽文件到此处</p>
                    <p className="text-xs text-slate-600 mt-1">支持 .kml, .kmz, .csv, .json</p>
                  </div>
                )}
              </div>

              {errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
                    <AlertCircle className="w-4 h-4" />
                    发现问题
                  </div>
                  <ul className="text-xs text-red-400 space-y-1">
                    {errors.map((err, i) => (
                      <li key={i}>· {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {preview && preview.type === 'kml' && (
                <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                  <p className="text-xs text-slate-500 mb-1">航线预览</p>
                  <p className="text-slate-200 font-medium">{preview.data.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {preview.data.coordinates.length} 个航点
                    {preview.data.description && ` · ${preview.data.description}`}
                  </p>
                </div>
              )}

              {preview && preview.type === 'csv' && (
                <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                  <p className="text-xs text-slate-500 mb-1">CSV预览</p>
                  <p className="text-slate-200 font-medium">
                    {preview.data.length} 条记录待导入
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">飞手</label>
                  <input
                    type="text"
                    value={pilot}
                    onChange={(e) => setPilot(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">电池循环</label>
                  <input
                    type="number"
                    value={batteryCycle}
                    onChange={(e) => setBatteryCycle(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">来源说明</label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="例如：飞手张三-KML导入"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-orange-500/50"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-700/50 bg-slate-900/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            取消
          </button>
          {!success && (
            <button
              onClick={handleImport}
              disabled={!preview || loading || errors.length > 0}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  导入
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
