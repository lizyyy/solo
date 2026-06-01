import { useState } from 'react';
import {
  Save,
  Download,
  RotateCcw,
  Play,
  Pause,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import type { Plan, PointStatus } from '../../types';

interface ActionBarProps {
  currentPlan: Plan | undefined;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  onSavePlan: () => void;
  onExportScreenshot: () => void;
  onResetView: () => void;
  onUpdatePlanName: (name: string) => void;
}

export function ActionBar({
  currentPlan,
  autoRotate,
  onToggleAutoRotate,
  onSavePlan,
  onExportScreenshot,
  onResetView,
  onUpdatePlanName,
}: ActionBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(currentPlan?.name || '');
  const [showSaveToast, setShowSaveToast] = useState(false);

  const handleSaveClick = () => {
    onSavePlan();
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 2000);
  };

  const handleNameSubmit = () => {
    if (editName.trim()) {
      onUpdatePlanName(editName.trim());
    } else {
      setEditName(currentPlan?.name || '');
    }
    setIsEditing(false);
  };

  const anomalyCount = currentPlan
    ? Object.values(currentPlan.pointStates).filter(s => s.isAnomaly).length
    : 0;

  return (
    <>
      <div
        className="absolute top-4 left-[300px] right-4 z-10 h-14 px-5 rounded-2xl flex items-center justify-between"
        style={{
          backgroundColor: 'rgba(15, 28, 54, 0.9)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            }}
          >
            <Globe size={20} className="text-white" />
          </div>
          
          <div>
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                className="text-base font-semibold text-white bg-transparent border-b border-blue-500 outline-none pr-2"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                autoFocus
              />
            ) : (
              <h1
                className="text-base font-semibold text-white cursor-pointer hover:text-blue-400 transition-colors"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                onClick={() => {
                  setEditName(currentPlan?.name || '');
                  setIsEditing(true);
                }}
                title="点击修改方案名称"
              >
                {currentPlan?.name || '未命名方案'}
              </h1>
            )}
            <div className="flex items-center gap-3 text-[11px] text-gray-400">
              <span>
                {currentPlan?.createdAt && `创建于 ${currentPlan.createdAt.slice(5, 16)}`}
              </span>
              {anomalyCount > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  {anomalyCount} 处异常待处理
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleAutoRotate}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              backgroundColor: autoRotate ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              color: autoRotate ? '#3b82f6' : '#94a3b8',
              border: `1px solid ${autoRotate ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
            }}
            title={autoRotate ? '停止自动旋转' : '开始自动旋转'}
          >
            {autoRotate ? <Pause size={14} /> : <Play size={14} />}
            <span className="hidden sm:inline">{autoRotate ? '旋转中' : '自动旋转'}</span>
          </button>

          <button
            onClick={onResetView}
            className="p-2 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all"
            style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
            title="重置视角"
          >
            <RotateCcw size={16} />
          </button>

          <div className="w-px h-6 mx-1" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

          <button
            onClick={onSavePlan}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-white transition-all hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            }}
            title="保存当前方案"
          >
            <Save size={14} />
            <span className="hidden sm:inline">保存方案</span>
          </button>

          <button
            onClick={onExportScreenshot}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.4)',
            }}
            title="导出截图"
          >
            <Download size={14} />
            <span className="hidden sm:inline">导出截图</span>
          </button>
        </div>
      </div>

      {showSaveToast && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white animate-in fade-in slide-in-from-top-2 duration-300"
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.95)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <CheckCircle2 size={16} />
          方案已保存
        </div>
      )}
    </>
  );
}
