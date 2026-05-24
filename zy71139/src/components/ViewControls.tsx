import React from 'react';
import { Eye, Layers, Map, Navigation, Move3d } from 'lucide-react';
import { CameraView } from '../types';
import { useSimulationStore } from '../store/useSimulationStore';
import { cn } from '../utils/cn';

export const ViewControls: React.FC = () => {
  const { cameraView, setCameraView } = useSimulationStore();

  const views: { id: CameraView; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: '总览', icon: <Layers size={16} /> },
    { id: 'top', label: '俯视', icon: <Map size={16} /> },
    { id: 'side', label: '侧视', icon: <Eye size={16} /> },
    { id: 'escape', label: '逃生', icon: <Navigation size={16} /> },
    { id: 'free', label: '自由', icon: <Move3d size={16} /> }
  ];

  return (
    <div className="absolute bottom-24 right-4 bg-gray-800/95 backdrop-blur-sm rounded-xl border border-gray-700 shadow-xl p-2 z-10">
      <p className="text-gray-400 text-xs mb-2 px-2">视角</p>
      <div className="flex flex-col gap-1">
        {views.map((view) => (
          <button
            key={view.id}
            onClick={() => setCameraView(view.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left",
              cameraView === view.id
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                : "text-gray-300 hover:bg-gray-700 hover:text-white"
            )}
            title={view.label}
          >
            {view.icon}
            <span className="text-xs">{view.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
