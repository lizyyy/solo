import { useState } from 'react';
import { MessageSquare, Plus, User, Clock, Edit3, Save, X } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useAppStore } from '@/store';
import { generateId } from '@/utils/fileParser';
import { cn } from '@/lib/utils';
import type { Annotation } from '@/types';

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AnnotationsPage = () => {
  const { tracks, annotations, addAnnotation } = useAppStore();
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');

  const trackAnnotations = selectedTrackId
    ? annotations.filter((a) => a.trackId === selectedTrackId).sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    : [];

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);

  const handleAddAnnotation = () => {
    if (!selectedTrackId || !newContent.trim()) return;

    const prevAnnotation = trackAnnotations[0];
    let diffFromPrev = '';
    
    if (prevAnnotation) {
      diffFromPrev = `基于 v${prevAnnotation.version} 版本修改`;
    }

    const annotation: Annotation = {
      id: generateId(),
      trackId: selectedTrackId,
      content: newContent.trim(),
      author: '林老师',
      createdAt: new Date().toISOString(),
      version: trackAnnotations.length + 1,
      diffFromPrev,
    };

    addAnnotation(annotation);
    setNewContent('');
    setIsAdding(false);
  };

  return (
    <div>
      <PageHeader
        title="批注中心"
        subtitle="为曲目添加备注，记录处理过程，支持版本追踪和差异对比"
        action={
          selectedTrackId && (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
            >
              <Plus size={18} />
              添加批注
            </button>
          )
        }
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4">
          <div className="bg-white rounded-xl shadow-soft overflow-hidden">
            <div className="px-4 py-3 bg-olive-50 border-b border-olive-100">
              <h3 className="font-semibold text-olive-800">选择曲目</h3>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {tracks.length === 0 ? (
                <div className="p-8 text-center text-olive-400">
                  <MessageSquare size={32} className="mx-auto mb-2" />
                  <p>暂无曲目</p>
                </div>
              ) : (
                tracks.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => setSelectedTrackId(track.id)}
                    className={cn(
                      'w-full px-4 py-3 text-left border-b border-cream-200 last:border-b-0 transition-colors',
                      selectedTrackId === track.id
                        ? 'bg-amber-50 border-l-4 border-l-amber-500'
                        : 'hover:bg-cream-50'
                    )}
                  >
                    <p className="font-medium text-olive-900 truncate">{track.trackName}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-olive-500">{track.artist || '未知艺术家'}</span>
                      <span className="text-xs text-amber-600">
                        {annotations.filter((a) => a.trackId === track.id).length} 条批注
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-span-8">
          <div className="bg-white rounded-xl shadow-soft overflow-hidden">
            {selectedTrack ? (
              <>
                <div className="px-6 py-4 bg-olive-50 border-b border-olive-100">
                  <h3 className="font-serif text-lg font-semibold text-olive-900">
                    {selectedTrack.trackName}
                  </h3>
                  <p className="text-sm text-olive-600 mt-1">
                    {selectedTrack.artist || '未知艺术家'} · {selectedTrack.fileName}
                  </p>
                </div>

                <div className="p-6">
                  {isAdding && (
                    <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200 animate-fade-in">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <User size={16} className="text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-olive-800 mb-2">林老师</p>
                          <textarea
                            value={newContent}
                            onChange={(e) => setNewContent(e.target.value)}
                            placeholder="输入批注内容..."
                            className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none h-24"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-3">
                            <button
                              onClick={() => {
                                setIsAdding(false);
                                setNewContent('');
                              }}
                              className="px-3 py-1.5 text-sm text-olive-600 hover:bg-amber-100 rounded-lg transition-colors"
                            >
                              取消
                            </button>
                            <button
                              onClick={handleAddAnnotation}
                              disabled={!newContent.trim()}
                              className={cn(
                                'flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors font-medium',
                                newContent.trim()
                                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                                  : 'bg-amber-200 text-amber-500 cursor-not-allowed'
                              )}
                            >
                              <Save size={14} />
                              保存
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {trackAnnotations.length > 0 ? (
                    <div className="relative">
                      <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-olive-200" />
                      
                      {trackAnnotations.map((annotation, index) => (
                        <div
                          key={annotation.id}
                          className="relative pl-10 pb-8 last:pb-0 animate-slide-in"
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          <div className="absolute left-2.5 w-3 h-3 bg-amber-500 rounded-full border-2 border-white shadow" />
                          
                          <div className="bg-cream-50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-olive-600 rounded-full flex items-center justify-center">
                                  <User size={14} className="text-white" />
                                </div>
                                <div>
                                  <p className="font-medium text-olive-900 text-sm">{annotation.author}</p>
                                  <div className="flex items-center gap-2 text-xs text-olive-500">
                                    <Clock size={12} />
                                    {formatDate(annotation.createdAt)}
                                  </div>
                                </div>
                              </div>
                              <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                                v{annotation.version}
                              </span>
                            </div>
                            
                            <p className="text-olive-800 leading-relaxed">{annotation.content}</p>
                            
                            {annotation.diffFromPrev && annotation.version > 1 && (
                              <div className="mt-3 pt-3 border-t border-cream-200">
                                <p className="text-xs text-olive-500 flex items-center gap-1">
                                  <Edit3 size={12} />
                                  {annotation.diffFromPrev}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <MessageSquare size={48} className="mx-auto text-olive-300 mb-4" />
                      <p className="text-olive-500">暂无批注</p>
                      <p className="text-sm text-olive-400 mt-1">点击右上角按钮添加第一条批注</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-12 text-center">
                <MessageSquare size={48} className="mx-auto text-olive-300 mb-4" />
                <p className="text-olive-500">请从左侧选择一个曲目</p>
                <p className="text-sm text-olive-400 mt-1">查看和管理该曲目的批注记录</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
