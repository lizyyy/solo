import { useAppStore } from '@/store/useAppStore';
import QuaternionInput from './QuaternionInput';
import EulerInput from './EulerInput';
import InterpolationConfigPanel from './InterpolationConfigPanel';
import SamplePanel from './SamplePanel';
import ExportPanel from './ExportPanel';

const TABS = [
  { key: 'params' as const, label: '参数设置' },
  { key: 'samples' as const, label: '样例包' },
  { key: 'export' as const, label: '导出' },
];

export default function ParamPanel() {
  const activePanel = useAppStore((s) => s.activePanel);
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const currentQuaternion = useAppStore((s) => s.currentQuaternion);
  const targetQuaternion = useAppStore((s) => s.targetQuaternion);
  const eulerAngles = useAppStore((s) => s.eulerAngles);
  const interpolationConfig = useAppStore((s) => s.interpolationConfig);
  const setCurrentQuaternion = useAppStore((s) => s.setCurrentQuaternion);
  const setTargetQuaternion = useAppStore((s) => s.setTargetQuaternion);
  const setEulerAngles = useAppStore((s) => s.setEulerAngles);
  const setInterpolationConfig = useAppStore((s) => s.setInterpolationConfig);
  const normalizeCurrentQuaternion = useAppStore((s) => s.normalizeCurrentQuaternion);
  const normalizeTargetQuaternion = useAppStore((s) => s.normalizeTargetQuaternion);

  return (
    <div
      className="flex h-full flex-col rounded-lg"
      style={{
        backgroundColor: 'rgba(10,14,39,0.9)',
        border: '1px solid rgba(148,163,184,0.1)',
      }}
    >
      <div className="flex border-b" style={{ borderColor: 'rgba(148,163,184,0.1)' }}>
        {TABS.map((tab) => {
          const isActive = activePanel === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActivePanel(tab.key)}
              className="flex-1 px-3 py-2 text-xs font-mono transition-colors"
              style={{
                color: isActive ? '#00e5c7' : '#94a3b8',
                borderBottom: isActive ? '2px solid #00e5c7' : '2px solid transparent',
                backgroundColor: isActive ? 'rgba(0,229,199,0.05)' : 'transparent',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {activePanel === 'params' && (
          <div className="flex flex-col gap-3">
            <QuaternionInput
              label="当前四元数"
              quaternion={currentQuaternion}
              onChange={setCurrentQuaternion}
              onNormalize={normalizeCurrentQuaternion}
            />
            <QuaternionInput
              label="目标四元数"
              quaternion={targetQuaternion}
              onChange={setTargetQuaternion}
              onNormalize={normalizeTargetQuaternion}
            />
            <EulerInput euler={eulerAngles} onChange={setEulerAngles} />
            <InterpolationConfigPanel
              config={interpolationConfig}
              onChange={setInterpolationConfig}
            />
          </div>
        )}
        {activePanel === 'samples' && <SamplePanel />}
        {activePanel === 'export' && <ExportPanel />}
      </div>
    </div>
  );
}
