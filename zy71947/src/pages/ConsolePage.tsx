import React, { useEffect } from 'react';
import { Rocket, AlertOctagon, AlertTriangle, Zap, Cpu } from 'lucide-react';
import { Timeline } from '../components/timeline/Timeline';
import { PlaybackControls } from '../components/controls/PlaybackControls';
import { TimeFormatSwitch } from '../components/controls/TimeFormatSwitch';
import { CommandList } from '../components/command-list/CommandList';
import { DetailPanel } from '../components/detail-panel/DetailPanel';
import { RecalculateReport } from '../components/detail-panel/RecalculateReport';
import { ContextMenu } from '../components/controls/ContextMenu';
import { ExportButton } from '../components/export/ExportButton';
import { useSequenceStore } from '../store/useSequenceStore';
import { usePlaybackStore } from '../store/usePlaybackStore';

export const ConsolePage: React.FC = () => {
  const { sequence, detectionResult, runDetection } = useSequenceStore();
  const { isPlaying, currentTime } = usePlaybackStore();

  useEffect(() => {
    runDetection();
  }, []);

  const criticalCount = detectionResult?.anomalies.filter(a => a.severity === 'CRITICAL').length || 0;
  const warningCount = detectionResult?.anomalies.filter(a => a.severity === 'WARNING').length || 0;
  const infoCount = detectionResult?.anomalies.filter(a => a.severity === 'INFO').length || 0;

  return (
    <div className="h-screen flex flex-col bg-space-950 overflow-hidden">
      <header className="h-16 bg-space-900/80 border-b border-space-600/50 flex items-center justify-between px-6 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyber-cyan to-cyber-purple flex items-center justify-center">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white font-mono">
              航天器任务序列回放系统
            </h1>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Cpu className="w-3 h-3" />
              <span>{sequence.name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-cyber-red" />
              <span className="text-cyber-red font-mono text-sm">严重 {criticalCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-cyber-yellow" />
              <span className="text-cyber-yellow font-mono text-sm">警告 {warningCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyber-purple" />
              <span className="text-cyber-purple font-mono text-sm">调整 {infoCount}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-space-600" />

          <TimeFormatSwitch />
          <ExportButton />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <CommandList />

        <main className="flex-1 flex flex-col relative">
          <Timeline />
          <PlaybackControls />
          <DetailPanel />
        </main>
      </div>

      <ContextMenu />
      <RecalculateReport />
    </div>
  );
};
