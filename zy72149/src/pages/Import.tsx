import { useState } from 'react';
import { Upload, FileText, FileAudio, Image, MessageSquare, Plus, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { SOURCE_TYPES, EMOTION_TAGS } from '../types';
import type { SourceType, EmotionTag } from '../types';

const Import = () => {
  const { addMaterial, addToast } = useStore();
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('manual');
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

  const handleSubmit = () => {
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
          添加新的音频素材到复核清单，支持多种来源
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
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
        </div>

        <div className="p-6">
          {activeTab === 'upload' ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-700 mb-2">拖拽文件到这里上传</h3>
              <p className="text-sm text-slate-500 mb-4">支持 CSV、Excel 格式的曲目表，或直接粘贴音频文件名清单</p>
              <button className="px-4 py-2 text-sm text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors">
                选择文件
              </button>
              <p className="text-xs text-slate-400 mt-4">💡 建议：数据量不大时手动录入更方便哦</p>
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
                  onClick={handleSubmit}
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
