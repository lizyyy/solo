import { useState, useEffect } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import Modal from '../common/Modal';
import TagBadge from '../common/TagBadge';
import { useStore } from '../../store/useStore';
import { EMOTION_TAGS, EXCEPTION_TYPES } from '../../types';
import type { EmotionTag, ExceptionType } from '../../types';

const EditModal = () => {
  const { editingMaterial, isEditModalOpen, closeEditModal, updateMaterial, resolveException, addToast } = useStore();
  const [emotionTag, setEmotionTag] = useState<EmotionTag>('');
  const [remark, setRemark] = useState('');

  useEffect(() => {
    if (editingMaterial) {
      setEmotionTag(editingMaterial.emotionTag);
      setRemark(editingMaterial.remark);
    }
  }, [editingMaterial]);

  const handleSave = () => {
    if (!editingMaterial) return;

    updateMaterial(editingMaterial.id, {
      emotionTag,
      remark,
      processedBy: '小温',
    });

    addToast('success', '保存成功！备注和标签已更新');
    closeEditModal();
  };

  const handleResolveException = (exceptionType: ExceptionType) => {
    if (!editingMaterial) return;
    resolveException(editingMaterial.id, exceptionType);
    addToast('info', '已标记异常为已解决');
  };

  if (!editingMaterial) return null;

  const unresolvedExceptions = editingMaterial.exceptions.filter((e) => !e.resolved);
  const resolvedExceptions = editingMaterial.exceptions.filter((e) => e.resolved);

  return (
    <Modal isOpen={isEditModalOpen} onClose={closeEditModal} title="编辑素材信息" size="lg">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">文件名</label>
            <p className="text-sm text-slate-700 font-mono bg-slate-50 px-3 py-2 rounded-lg">
              {editingMaterial.fileName}
            </p>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">曲目名称</label>
            <p className="text-sm text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">
              {editingMaterial.trackName}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-2">情绪标签</label>
          <div className="flex flex-wrap gap-2">
            {EMOTION_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setEmotionTag(tag)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                  emotionTag === tag
                    ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                }`}
              >
                {tag || '未标注'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">处理备注</label>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="在这里填写处理备注，比如：群里老张说这个音量要调小一点..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
          />
        </div>

        {unresolvedExceptions.length > 0 && (
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-red-700">⚠️ 待处理异常</span>
            </div>
            <div className="space-y-2">
              {unresolvedExceptions.map((exc, idx) => (
                <div key={idx} className="flex items-start justify-between bg-white p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <TagBadge type="exception" value={exc.type} />
                    <span className="text-sm text-slate-600">{exc.description}</span>
                  </div>
                  <button
                    onClick={() => handleResolveException(exc.type)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition-colors"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    标记解决
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {resolvedExceptions.length > 0 && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-blue-700">✅ 已解决异常</span>
            </div>
            <div className="space-y-1">
              {resolvedExceptions.map((exc, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                  <TagBadge type="exception" value={exc.type} />
                  <span className="line-through opacity-60">{exc.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
          <div>
            <label className="block text-xs text-slate-500 mb-1">来源</label>
            <TagBadge type="source" value={editingMaterial.source} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">原始来源追溯</label>
            <p className="text-xs text-slate-600">{editingMaterial.originalSource}</p>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">处理人</label>
            <p className="text-sm text-slate-700">{editingMaterial.processedBy || '未处理'}</p>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">最后处理时间</label>
            <p className="text-sm text-slate-700">
              {new Date(editingMaterial.processedAt).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={closeEditModal}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors shadow-md"
          >
            <Save className="w-4 h-4" />
            保存修改
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default EditModal;
