import { Eye, View, ArrowUp, Box } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { CameraView } from '../../types';

const views: { id: CameraView; label: string; icon: React.ReactNode }[] = [
  { id: 'perspective', label: '透视', icon: <Box size={14} /> },
  { id: 'top', label: '俯视', icon: <ArrowUp size={14} /> },
  { id: 'front', label: '正视', icon: <Eye size={14} /> },
  { id: 'side', label: '侧视', icon: <View size={14} /> },
];

export const ViewControls = () => {
  const excavationData = useStore((state) => state.excavationData);
  const cameraView = useStore((state) => state.cameraView);
  const setCameraView = useStore((state) => state.setCameraView);

  if (!excavationData) return null;

  return (
    <div className="absolute top-4 left-4 bg-stone-900/90 backdrop-blur border border-stone-700 rounded-lg p-1 flex gap-1">
      {views.map((view) => (
        <button
          key={view.id}
          onClick={() => setCameraView(view.id)}
          className={`px-3 py-2 rounded text-xs flex items-center gap-1.5 transition-all ${
            cameraView === view.id
              ? 'bg-amber-600 text-white'
              : 'text-stone-400 hover:bg-stone-700 hover:text-stone-200'
          }`}
          title={view.label}
        >
          {view.icon}
          <span>{view.label}</span>
        </button>
      ))}
    </div>
  );
};
