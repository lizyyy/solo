import AttitudeSphere from '@/components/AttitudeSphere';
import ParamPanel from '@/components/ParamPanel';
import AnimationController from '@/components/AnimationController';
import ValidationOverlay from '@/components/ValidationOverlay';
import { useAnimation } from '@/hooks/useAnimation';
import { useValidation } from '@/hooks/useValidation';
import { useAppStore } from '@/store/useAppStore';
import { useState } from 'react';

export default function Home() {
  const validationResults = useAppStore((s) => s.validationResults);
  const animationProgress = useAppStore((s) => s.animationProgress);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const setAnimationProgress = useAppStore((s) => s.setAnimationProgress);
  const togglePlayback = useAppStore((s) => s.togglePlayback);
  const [showValidation, setShowValidation] = useState(true);
  useAnimation();
  useValidation();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: '#0a0e27' }}>
      <header className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'rgba(0,229,199,0.15)' }}>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ background: '#00e5c7', boxShadow: '0 0 8px #00e5c7' }} />
          <h1 className="font-mono text-lg tracking-wider" style={{ color: '#00e5c7' }}>
            卫星姿态四元数球
          </h1>
          <span className="text-xs font-mono" style={{ color: '#94a3b8' }}>
            Quaternion Attitude Sphere
          </span>
        </div>
        <div className="flex items-center gap-3">
          {validationResults.length > 0 && (
            <button
              onClick={() => setShowValidation(!showValidation)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono"
              style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
            >
              ⚠ {validationResults.length} 待确认
            </button>
          )}
          {validationResults.length === 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono" style={{ background: 'rgba(0,229,199,0.1)', color: '#00e5c7', border: '1px solid rgba(0,229,199,0.2)' }}>
              ✓ 校验通过
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative">
          <AttitudeSphere />
          {showValidation && validationResults.length > 0 && (
            <div className="absolute top-4 left-4 z-10">
              <ValidationOverlay results={validationResults} />
            </div>
          )}
        </div>
        <div className="w-[380px] flex-shrink-0 border-l overflow-y-auto" style={{ borderColor: 'rgba(0,229,199,0.15)', background: 'rgba(10,14,39,0.95)' }}>
          <ParamPanel />
        </div>
      </div>

      <div className="border-t" style={{ borderColor: 'rgba(0,229,199,0.15)' }}>
        <AnimationController
          progress={animationProgress}
          isPlaying={isPlaying}
          onProgressChange={setAnimationProgress}
          onTogglePlay={togglePlayback}
          onStep={() => setAnimationProgress(Math.min(animationProgress + 0.05, 1))}
        />
      </div>
    </div>
  );
}
