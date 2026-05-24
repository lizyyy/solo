import { X, Map, Clock, AlertTriangle } from 'lucide-react';
import { useSceneStore } from '@/store/sceneStore';
import { useAnalysisStore } from '@/store/analysisStore';
import { useUIStore } from '@/store/uiStore';
import { sampleScenes, sampleBlindSpots } from '@/data/sampleScenes';
import { cn } from '@/utils/cn';

export function SampleModal() {
  const sampleModalOpen = useUIStore(state => state.sampleModalOpen);
  const setSampleModalOpen = useUIStore(state => state.setSampleModalOpen);
  const setCurrentScene = useSceneStore(state => state.setCurrentScene);
  const setElements = useSceneStore(state => state.setElements);
  const setPaths = useSceneStore(state => state.setPaths);
  const setTotalDuration = useSceneStore(state => state.setTotalDuration);
  const setBlindSpots = useAnalysisStore(state => state.setBlindSpots);
  const resetAnalysis = useAnalysisStore(state => state.resetAnalysis);
  const resetScene = useSceneStore(state => state.resetScene);

  const handleLoadScene = (sceneId: string) => {
    const scene = sampleScenes.find(s => s.id === sceneId);
    if (!scene) return;

    resetScene();
    resetAnalysis();

    setCurrentScene(scene);
    setElements(scene.elements);
    setPaths(scene.paths);
    setTotalDuration(70);

    const blindSpotsWithIds = sampleBlindSpots.map((spot, index) => ({
      ...spot,
      id: `blindspot-${Date.now()}-${index}`,
    }));
    setBlindSpots(blindSpotsWithIds);

    setSampleModalOpen(false);
  };

  if (!sampleModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-white">选择场景样例</h2>
            <p className="text-sm text-slate-400 mt-1">选择预设场景开始导视盲区分析</p>
          </div>
          <button
            onClick={() => setSampleModalOpen(false)}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid gap-4">
            {sampleScenes.map(scene => (
              <div
                key={scene.id}
                className={cn(
                  'p-5 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg',
                  'bg-slate-800/50 border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800'
                )}
                onClick={() => handleLoadScene(scene.id)}
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center flex-shrink-0">
                    <Map className="w-8 h-8 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {scene.name}
                    </h3>
                    <p className="text-sm text-slate-400 mb-3">
                      {scene.description}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Map className="w-3.5 h-3.5" />
                        <span>{scene.elements.length} 个场景元素</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{scene.paths.length} 条人流路径</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-orange-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>预设盲区标注</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 bg-slate-800/30">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <AlertTriangle className="w-4 h-4" />
            <span>加载新场景将重置当前分析状态和场景数据</span>
          </div>
        </div>
      </div>
    </div>
  );
}
