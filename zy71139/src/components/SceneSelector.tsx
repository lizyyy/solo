import React, { useState } from 'react';
import { FolderOpen, X, ChevronRight, Flame } from 'lucide-react';
import { Scene } from '../types';
import { sampleScenes } from '../data/sampleScenes';
import { useSimulationStore } from '../store/useSimulationStore';
import { cn } from '../utils/cn';

interface SceneSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SceneSelector: React.FC<SceneSelectorProps> = ({ isOpen, onClose }) => {
  const { selectScene, selectedScene } = useSimulationStore();

  const handleSelect = (scene: Scene) => {
    selectScene(scene);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <FolderOpen size={20} className="text-orange-400" />
            选择演练场景
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid gap-4">
            {sampleScenes.map((scene) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                isSelected={selectedScene?.id === scene.id}
                onSelect={() => handleSelect(scene)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface SceneCardProps {
  scene: Scene;
  isSelected: boolean;
  onSelect: () => void;
}

const SceneCard: React.FC<SceneCardProps> = ({ scene, isSelected, onSelect }) => {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "p-4 rounded-xl border-2 cursor-pointer transition-all",
        isSelected
          ? "border-orange-500 bg-orange-500/10"
          : "border-gray-700 bg-gray-700/30 hover:border-gray-600 hover:bg-gray-700/50"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Flame size={18} className="text-orange-400" />
            <h3 className="text-white font-semibold">{scene.name}</h3>
            {isSelected && (
              <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                已选择
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm mb-3">{scene.description}</p>
          
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 text-xs">风机</span>
              <span className="text-orange-400 text-sm font-mono">{scene.fans.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 text-xs">逃生通道</span>
              <span className="text-green-400 text-sm font-mono">{scene.escapeRoutes.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 text-xs">火源</span>
              <span className="text-red-400 text-sm font-mono">{scene.smokeSources.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 text-xs">隧道长度</span>
              <span className="text-blue-400 text-sm font-mono">{scene.tunnelLength}m</span>
            </div>
          </div>
        </div>
        
        <ChevronRight size={24} className="text-gray-500 ml-4" />
      </div>
    </div>
  );
};
