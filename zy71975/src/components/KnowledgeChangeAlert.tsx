import { AlertTriangle, X } from 'lucide-react';
import { useStore } from '@/store/useStore';

export default function KnowledgeChangeAlert() {
  const { knowledgeChanged, setKnowledgeChanged } = useStore();

  if (!knowledgeChanged) return null;

  return (
    <div className="bg-yellow-400 border-b border-yellow-500 animate-slideDown">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500 p-2 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-900" />
            </div>
            <div>
              <p className="font-medium text-yellow-900">
                检测到知识库版本变更，以下判断可能受影响
              </p>
              <p className="text-sm text-yellow-800">
                建议确认变更内容后再进行复核操作，或重新上传会议纪要进行分析
              </p>
            </div>
          </div>
          <button
            onClick={() => setKnowledgeChanged(false)}
            className="p-2 hover:bg-yellow-500 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-yellow-900" />
          </button>
        </div>
      </div>
    </div>
  );
}
