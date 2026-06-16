import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, FileAudio, Image, MessageSquare, Plus, Check, X, FileUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { SOURCE_TYPES, EMOTION_TAGS } from '../types';
import type { SourceType, EmotionTag } from '../types';
import { parseFile, getAcceptedExtensions, type ParsedRow } from '../utils/fileParser';

const Import = () => {
  const { addMaterial, addMaterials, addToast } = useStore();
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parsedFileName, setParsedFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [importSource, setImportSource] = useState<SourceType>('曲目表');

  const [formData, setFormData] = useState({
    fileName: '',
    trackName: '',
    source: '曲目表' as SourceType,
    emotionTag: '' as EmotionTag,
    remark: '',
    originalSource: '',
    authorizationDate: '',
    timecode: '',
  });

  const handleFileParse = useCallback(async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setParsedRows([]);
    setParsedFileName(file.name);

    try {
      const rows = await parseFile(file);
      if (rows.length === 0) {
        setParseError(`文件 "${file.name}" 中没有找到可识别的数据行`);
        addToast('warning', '文件中没有可识别的数据');
      } else {
        setParsedRows(rows);
        addToast('info', `已解析 ${rows.length} 条记录，请确认后导入`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      setParseError(msg);
      addToast('error', `解析失败：${msg}`);
    } finally {
      setIsParsing(false);
    }
  }, [addToast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFileParse(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    handleFileParse(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleBatchImport = () => {
    if (parsedRows.length === 0) return;

    const sourceOverride = importSource;
    const materialsToImport = parsedRows.map((row) => ({
      fileName: row.fileName,
      trackName: row.trackName,
      emotionTag: row.emotionTag,
      remark: row.remark,
      source: sourceOverride === '音频文件' && row.source === '音频文件' ? '音频文件' as SourceType : sourceOverride,
      processedBy: '小温',
      status: 'pending' as const,
      exceptions: [],
      originalSource: row.originalSource,
      authorizationDate: row.authorizationDate || undefined,
      timecode: row.timecode || undefined,
    }));

    addMaterials(materialsToImport);
    addToast('success', `成功导入 ${materialsToImport.length} 条素材，异常检测已自动运行`);
    setParsedRows([]);
    setParsedFileName('');
    setParseError(null);
  };

  const clearParsed = () => {
    setParsedRows([]);
    setParsedFileName('');
    setParseError(null);
  };

  const handleManualSubmit = () => {
    if (!formData.fileName || !formData.trackName) {
      addToast('warning', '请填写文件名和曲目名称');
      return;
    }

    addMaterial({
      fileName: formData.fileName,
      trackName: formData.trackName,
      emotionTag: formData.emotionTag,
      remark: formData.remark,
      source: formData.source,
      processedBy: '小温',
      status: 'pending',
      exceptions: [],
      originalSource: formData.originalSource || `手动录入：${formData.source}`,
      authorizationDate: formData.authorizationDate || undefined,
      timecode: formData.timecode || undefined,
    });

    addToast('success', '素材添加成功！');
    setFormData({
      fileName: '',
      trackName: '',
      source: '曲目表',
      emotionTag: '',
      remark: '',
      originalSource: '',
      authorizationDate: '',
      timecode: '',
    });
  };

  const sourceIcons = {
    '曲目表': <FileText className="w-5 h-5" />,
    '音频文件': <FileAudio className="w-5 h-5" />,
    '合同截图': <Image className="w-5 h-5" />,
    '群聊批注': <MessageSquare className="w-5 h-5" />,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">素材导入</h1>
        <p className="text-sm text-slate-500 mt-1">
          支持文件批量导入和手动录入，导入后自动检测异常
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" />
              文件上传
            </div>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'manual'
                ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              手动录入
            </div>
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'upload' ? (
            <div className="space-y-6">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  isDragOver
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-slate-300 hover:border-orange-400 hover:bg-slate-50'
                }`}
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                  <FileUp className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-700 mb-2">拖拽文件到这里上传</h3>
                <p className="text-sm text-slate-500 mb-4">
                  支持 CSV、Excel（.xlsx/.xls）格式的曲目表，或 TXT 文本文件名清单
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  曲目表列名示例：文件名、曲目名称、情绪标签、授权日期、时码、备注<br/>
                  文件名清单每行一条，格式：文件名,曲目名称（逗号或Tab分隔）
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsing}
                  className="px-6 py-2.5 text-sm text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {isParsing ? '解析中...' : '选择文件'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={getAcceptedExtensions()}
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {parseError && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-700">解析失败</p>
                    <p className="text-sm text-red-600">{parseError}</p>
                  </div>
                </div>
              )}

              {parsedRows.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span className="text-sm font-medium text-slate-700">
                        解析结果：{parsedFileName}（共 {parsedRows.length} 条）
                      </span>
                    </div>
                    <button
                      onClick={clearParsed}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-sm text-slate-700 font-medium mb-2">导入为哪种来源？</label>
                      <div className="grid grid-cols-4 gap-2">
                        {SOURCE_TYPES.map((source) => (
                          <button
                            key={source}
                            onClick={() => setImportSource(source)}
                            className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                              importSource === source
                                ? 'border-orange-500 bg-orange-50 text-orange-700'
                                : 'border-slate-200 hover:border-slate-300 text-slate-600'
                            }`}
                          >
                            {sourceIcons[source]}
                            <span className="text-xs">{source}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">文件名</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">曲目名称</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">情绪标签</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">授权日期</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">时码</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedRows.slice(0, 50).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-mono text-xs">{row.fileName}</td>
                              <td className="px-3 py-2">{row.trackName}</td>
                              <td className="px-3 py-2">{row.emotionTag || <span className="text-slate-400">-</span>}</td>
                              <td className="px-3 py-2 text-xs">{row.authorizationDate || <span className="text-slate-400">-</span>}</td>
                              <td className="px-3 py-2 text-xs">{row.timecode || <span className="text-slate-400">-</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {parsedRows.length > 50 && (
                        <p className="text-xs text-slate-400 text-center py-2">
                          仅展示前 50 条，共 {parsedRows.length} 条
                        </p>
                      )}
                    </div>

                    <button
                      onClick={handleBatchImport}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors shadow-md"
                    >
                      <Check className="w-4 h-4" />
                      确认导入 {parsedRows.length} 条素材
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-xl mx-auto space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1">
                    文件名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.fileName}
                    onChange={(e) => setFormData({ ...formData, fileName: e.target.value })}
                    placeholder="如: TRK_001_Opening.wav"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1">
                    曲目名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.trackName}
                    onChange={(e) => setFormData({ ...formData, trackName: e.target.value })}
                    placeholder="如: 开场主题曲"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2">素材来源</label>
                <div className="grid grid-cols-4 gap-2">
                  {SOURCE_TYPES.map((source) => (
                    <button
                      key={source}
                      onClick={() => setFormData({ ...formData, source })}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                        formData.source === source
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      {sourceIcons[source]}
                      <span className="text-xs">{source}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2">情绪标签（可选）</label>
                <div className="flex flex-wrap gap-2">
                  {EMOTION_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setFormData({ ...formData, emotionTag: tag })}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                        formData.emotionTag === tag
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                      }`}
                    >
                      {tag || '暂不标注'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1">授权日期（可选）</label>
                  <input
                    type="date"
                    value={formData.authorizationDate}
                    onChange={(e) => setFormData({ ...formData, authorizationDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1">时码（可选）</label>
                  <input
                    type="text"
                    value={formData.timecode}
                    onChange={(e) => setFormData({ ...formData, timecode: e.target.value })}
                    placeholder="如: 00:00:00 - 00:02:30"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-700 font-medium mb-1">原始来源备注</label>
                <input
                  type="text"
                  value={formData.originalSource}
                  onChange={(e) => setFormData({ ...formData, originalSource: e.target.value })}
                  placeholder="如: 曲目表第5行，排练群2024-05-10截图"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-700 font-medium mb-1">处理备注</label>
                <textarea
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  placeholder="有什么需要说明的？"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm resize-none"
                />
              </div>

              <div className="pt-4">
                <button
                  onClick={handleManualSubmit}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors shadow-md"
                >
                  <Check className="w-4 h-4" />
                  添加素材
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Import;
