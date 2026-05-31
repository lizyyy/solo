import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ZoomIn, ZoomOut, AlertTriangle, Scissors, Megaphone, Eye, EyeOff } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import Layout from '@/components/Layout';
import MultiTrackTimeline from '@/components/MultiTrackTimeline';
import PlaybackControls from '@/components/PlaybackControls';
import IssuePanel from '@/components/IssuePanel';
import EntryEditor from '@/components/EntryEditor';

const Timeline: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(1200);

  const {
    currentProject,
    tracks,
    timeline,
    rightPanel,
    openProject,
    runAlignmentCheck,
    addEditPoint,
    setTimeline,
    setRightPanel,
  } = useProjectStore();

  useEffect(() => {
    if (id) {
      openProject(id);
    }
  }, [id, openProject]);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const padding = rightPanel ? 320 + 48 : 48;
        setTimelineWidth(containerRef.current.clientWidth - padding);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [rightPanel]);

  const handleZoomIn = () => {
    setTimeline({ zoom: Math.min(10, timeline.zoom * 1.2) });
  };

  const handleZoomOut = () => {
    setTimeline({ zoom: Math.max(0.1, timeline.zoom / 1.2) });
  };

  const handleAddCutPoint = () => {
    if (!currentProject) return;
    addEditPoint({
      id: crypto.randomUUID(),
      projectId: currentProject.id,
      time: timeline.playheadPosition,
      type: 'cut',
      label: `剪辑点 ${new Date().toLocaleTimeString()}`,
      color: '#E94560',
    });
  };

  const handleAddAdCue = () => {
    if (!currentProject) return;
    addEditPoint({
      id: crypto.randomUUID(),
      projectId: currentProject.id,
      time: timeline.playheadPosition,
      type: 'ad',
      label: `广告口播 ${new Date().toLocaleTimeString()}`,
      color: '#FF6B35',
    });
  };

  if (!currentProject) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[#FF6B35] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400">加载项目中...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout projectName={currentProject.name}>
      <div className="flex flex-col h-full -m-6" style={{ height: 'calc(100vh - 80px)' }}>
        <div className="flex items-center justify-between px-4 py-3 bg-[#16213E] border-b border-[#2A2A4E]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                onClick={handleZoomOut}
                className="p-2 text-gray-400 hover:text-white hover:bg-[#1A1A2E] rounded-lg transition-colors"
                title="缩小"
              >
                <ZoomOut size={18} />
              </button>
              <span className="w-16 text-center text-sm font-mono text-gray-300">
                {Math.round(timeline.zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-2 text-gray-400 hover:text-white hover:bg-[#1A1A2E] rounded-lg transition-colors"
                title="放大"
              >
                <ZoomIn size={18} />
              </button>
            </div>

            <div className="h-6 w-px bg-[#2A2A4E]" />

            <button
              onClick={() => {
                runAlignmentCheck();
                setRightPanel('issues');
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#FF6B35] hover:bg-[#ff7a4a] text-white rounded-lg transition-colors text-sm"
            >
              <AlertTriangle size={16} />
              运行检测
            </button>

            <button
              onClick={handleAddCutPoint}
              className="flex items-center gap-2 px-3 py-1.5 border border-[#E94560] text-[#E94560] hover:bg-[#E94560]/10 rounded-lg transition-colors text-sm"
            >
              <Scissors size={16} />
              添加剪辑点
            </button>

            <button
              onClick={handleAddAdCue}
              className="flex items-center gap-2 px-3 py-1.5 border border-[#FF6B35] text-[#FF6B35] hover:bg-[#FF6B35]/10 rounded-lg transition-colors text-sm"
            >
              <Megaphone size={16} />
              添加广告口播
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 mr-2">轨道显示：</span>
            {tracks.map((track) => (
              <button
                key={track.id}
                onClick={() => {
                  const visible = timeline.visibleTracks;
                  if (visible.includes(track.id)) {
                    setTimeline({ visibleTracks: visible.filter((v) => v !== track.id) });
                  } else {
                    setTimeline({ visibleTracks: [...visible, track.id] });
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-sm ${
                  timeline.visibleTracks.length === 0 || timeline.visibleTracks.includes(track.id)
                    ? 'bg-[#2EC4B6]/20 text-[#2EC4B6]'
                    : 'bg-[#1A1A2E] text-gray-500'
                }`}
              >
                {timeline.visibleTracks.length === 0 || timeline.visibleTracks.includes(track.id) ? (
                  <Eye size={14} />
                ) : (
                  <EyeOff size={14} />
                )}
                {track.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div ref={containerRef} className="flex-1 p-4 overflow-auto">
            <MultiTrackTimeline width={timelineWidth} height={500} />
          </div>

          {rightPanel === 'issues' && (
            <div className="w-80 flex-shrink-0">
              <IssuePanel />
            </div>
          )}

          {rightPanel === 'edit' && (
            <div className="w-80 flex-shrink-0">
              <EntryEditor />
            </div>
          )}
        </div>

        <PlaybackControls />
      </div>
    </Layout>
  );
};

export default Timeline;
