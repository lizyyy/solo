import { useGameStore } from '../../store/gameStore';
import { MapPin } from 'lucide-react';

export function SceneSelector() {
  const { currentSceneId, setCurrentScene, getScenes } = useGameStore();
  const scenes = getScenes();

  const difficultyColors = {
    easy: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    hard: 'bg-red-500/20 text-red-400 border-red-500/30'
  };

  const difficultyLabels = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  };

  return (
    <div className="card-bg rounded-lg p-4 border border-tech-500/30">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-4 h-4 text-tech-400" />
        <h3 className="font-orbitron text-tech-400 text-sm font-semibold">选择地物场景</h3>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            onClick={() => setCurrentScene(scene.id)}
            className={`p-3 rounded-lg border transition-all ${
              currentSceneId === scene.id
                ? 'bg-tech-500/10 border-tech-400 shadow-lg shadow-tech-500/10'
                : 'bg-space-700/30 border-space-600 hover:border-space-500'
            }`}
          >
            <div className={`font-semibold text-sm mb-1 ${
              currentSceneId === scene.id ? 'text-tech-400' : 'text-space-200'
            }`}>
              {scene.name}
            </div>
            <div className="text-xs text-space-400 mb-2 line-clamp-2">
              {scene.description}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded border ${difficultyColors[scene.difficulty]}`}>
              {difficultyLabels[scene.difficulty]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
