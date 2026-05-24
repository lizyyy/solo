import { useEffect, useState } from 'react';
import { FireExtinguisher, Menu, X, Info } from 'lucide-react';
import { ThreeScene } from '../components/arena/ThreeScene';
import { SceneControls } from '../components/controls/SceneControls';
import { ParamsDisplay } from '../components/controls/ParamsDisplay';
import { Timeline } from '../components/controls/Timeline';
import { ReportModal } from '../components/report/ReportModal';
import { useTrainingStore } from '../store/useTrainingStore';
import { useSceneStore } from '../store/useSceneStore';
import { allBuildings } from '../data/buildings';
import type { TrainingSession } from '../types';

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const {
    path,
    params,
    result,
    mode,
    playbackIndex,
    isPlaying,
    showReport,
    currentSessionId,
    sessions,
    setMode,
    setPlaybackIndex,
    setIsPlaying,
    resetAll,
    setShowReport,
    saveSession,
  } = useTrainingStore();

  const {
    currentBuilding,
    buildings,
    settings,
    viewMode,
    setCurrentBuilding,
    setBuildings,
    setSettings,
    setViewMode,
  } = useSceneStore();

  useEffect(() => {
    setBuildings(allBuildings);
    if (allBuildings.length > 0) {
      setCurrentBuilding(allBuildings[0]);
    }
  }, [setBuildings, setCurrentBuilding]);

  const currentSession = sessions.find((s) => s.id === currentSessionId) || null;

  const handlePlay = () => {
    if (mode === 'edit') {
      setMode('playback');
      setPlaybackIndex(0);
    }
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleSeek = (index: number) => {
    if (mode === 'edit') {
      setMode('playback');
    }
    setPlaybackIndex(index);
  };

  const handleTimelineReset = () => {
    setPlaybackIndex(0);
    setIsPlaying(false);
    setMode('edit');
  };

  const handleSaveSession = () => {
    if (currentBuilding && result) {
      saveSession(currentBuilding.id, currentBuilding.name);
    }
  };

  const sessionForReport: TrainingSession | null = currentSession
    ? currentSession
    : result && currentBuilding
      ? {
          id: 'temp',
          startTime: path[0]?.timestamp || Date.now(),
          endTime: Date.now(),
          buildingId: currentBuilding.id,
          buildingName: currentBuilding.name,
          path,
          params,
          result,
        }
      : null;

  if (!currentBuilding) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center">
          <FireExtinguisher className="w-16 h-16 mx-auto mb-4 text-red-500 animate-pulse" />
          <p className="text-xl">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <header className="bg-slate-800/90 backdrop-blur-sm border-b border-slate-700 px-4 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <FireExtinguisher className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">消防水带铺设演练</h1>
            <p className="text-xs text-slate-400 hidden sm:block">交互式3D训练平台</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all"
            title="帮助"
          >
            <Info className="w-5 h-5" />
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <aside
          className={`
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
            fixed md:relative inset-y-0 left-0 z-10 w-80
            bg-slate-800/95 md:bg-transparent
            md:w-80 lg:w-96
            flex flex-col gap-4 p-4
            overflow-y-auto
            transition-transform duration-300
            top-14 md:top-0
          `}
        >
          <SceneControls
            buildings={buildings}
            currentBuilding={currentBuilding}
            onBuildingChange={(building) => {
              setCurrentBuilding(building);
              resetAll();
            }}
            settings={settings}
            onSettingsChange={setSettings}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onReset={resetAll}
          />

          <ParamsDisplay result={result} params={params} />
        </aside>

        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-5 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <main className="flex-1 flex flex-col relative">
          <div className="flex-1 relative min-h-[400px]">
            <ThreeScene building={currentBuilding} />

            {path.length === 0 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800/90 text-white px-6 py-3 rounded-xl border border-slate-600 text-center max-w-md mx-4">
                <p className="font-medium mb-1">👆 点击地面或消火栓开始铺设水带</p>
                <p className="text-sm text-slate-400">
                  拖动节点调整位置 | Delete键删除选中节点
                </p>
              </div>
            )}

            {showHelp && (
              <div className="absolute top-4 right-4 bg-slate-800/95 text-white p-4 rounded-xl border border-slate-600 max-w-xs">
                <h4 className="font-semibold mb-2 text-red-400">操作指南</h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• 左键点击地面：添加路径节点</li>
                  <li>• 左键点击消火栓：从消火栓开始</li>
                  <li>• 拖拽节点：调整节点位置</li>
                  <li>• Delete键：删除选中节点</li>
                  <li>• 鼠标滚轮：缩放场景</li>
                  <li>• 右键拖拽：旋转视角</li>
                </ul>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-800/50 border-t border-slate-700">
            <Timeline
              nodes={path}
              playbackIndex={playbackIndex}
              isPlaying={isPlaying}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeek={handleSeek}
              onReset={handleTimelineReset}
              onShowReport={() => setShowReport(true)}
              canShowReport={!!result && path.length >= 2}
            />
          </div>
        </main>
      </div>

      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        result={result}
        params={params}
        buildingName={currentBuilding.name}
        session={sessionForReport}
        onSaveSession={handleSaveSession}
      />
    </div>
  );
}
