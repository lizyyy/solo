import { useState } from 'react';
import { FileUpload } from '../components/FileUpload';
import { SegmentList } from '../components/SegmentList';
import { Toolbar } from '../components/Toolbar';
import { MessageToast } from '../components/MessageToast';
import { useAppStore } from '../store';
import { Segment } from '../types';

export default function Home() {
  const { currentTrack, segments, confirmSegment, addMessage, showFriendlyMessage } = useAppStore();
  const [playingId, setPlayingId] = useState<string | null>(null);

  const handleBatchConfirm = async () => {
    const pendingSegments = segments.filter(s => s.status === 'pending');
    for (const seg of pendingSegments) {
      await confirmSegment(seg.id);
    }
    addMessage({
      type: 'success',
      title: '已全部确认',
      message: `${pendingSegments.length} 个分段已标记为已确认`
    });
  };

  const handleExport = () => {
    const confirmedCount = segments.filter(s => s.status === 'confirmed').length;
    if (confirmedCount === 0) {
      showFriendlyMessage('export_no_confirmed', 'warning');
      return;
    }
    window.location.href = '/export';
  };

  const handlePlaySegment = (segment: Segment) => {
    if (playingId === segment.id) {
      setPlayingId(null);
    } else {
      setPlayingId(segment.id);
      setTimeout(() => setPlayingId(null), Math.min((segment.endTime - segment.startTime) * 1000, 10000));
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-800 text-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold">采访音轨分段</h1>
              <p className="text-xs text-slate-400">播客剪辑专用工具</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="px-2 py-1 bg-slate-700 rounded text-xs">v1.0</span>
          </div>
        </div>
      </header>

      {currentTrack && (
        <Toolbar onBatchConfirm={handleBatchConfirm} onExport={handleExport} />
      )}

      <main className="p-6">
        {!currentTrack ? (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-slate-700 mb-2">开始处理音轨</h2>
              <p className="text-slate-500 text-sm">
                拖拽音频文件和字幕草稿到下方区域，系统会自动进行分段和异常检测
              </p>
            </div>
            <FileUpload />
            
            <div className="mt-8 grid grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded-xl border border-slate-200">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="font-medium text-slate-700 text-sm mb-1">智能检测</h3>
                <p className="text-xs text-slate-500">自动发现时间漂移、静音段误删等问题</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </div>
                <h3 className="font-medium text-slate-700 text-sm mb-1">随时撤回</h3>
                <p className="text-xs text-slate-500">每一步操作都可撤销，不怕手滑</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200">
                <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="font-medium text-slate-700 text-sm mb-1">证据链完整</h3>
                <p className="text-xs text-slate-500">所有操作留痕，导出时自动附带记录</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3">时间轴预览</h3>
              <div className="relative h-16 bg-slate-100 rounded-lg overflow-hidden">
                <div className="absolute inset-0 flex items-center px-2">
                  {segments.filter(s => s.status !== 'discarded').map((segment, idx, arr) => {
                    const totalDuration = arr.reduce((acc, s) => acc + (s.endTime - s.startTime), 0) || 1;
                    const width = ((segment.endTime - segment.startTime) / totalDuration) * 100;
                    const left = (arr.slice(0, idx).reduce((acc, s) => acc + (s.endTime - s.startTime), 0) / totalDuration) * 100;
                    
                    const colors: Record<string, string> = {
                      confirmed: 'bg-emerald-400',
                      pending: segment.anomalyType !== 'normal' ? 'bg-orange-400' : 'bg-amber-400',
                      discarded: 'bg-slate-300'
                    };
                    
                    return (
                      <div
                        key={segment.id}
                        className={`h-10 rounded ${colors[segment.status]} ${
                          playingId === segment.id ? 'ring-2 ring-sky-500 ring-offset-1' : ''
                        }`}
                        style={{ width: `${Math.max(width, 2)}%`, marginLeft: idx === 0 ? 0 : '2px' }}
                        title={segment.text || `分段 ${idx + 1}`}
                      />
                    );
                  })}
                </div>
                {segments.filter(s => s.status !== 'discarded').length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                    暂无分段数据
                  </div>
                )}
              </div>
            </div>

            <SegmentList onPlaySegment={handlePlaySegment} playingId={playingId} />
          </div>
        )}
      </main>

      <MessageToast />
    </div>
  );
}
