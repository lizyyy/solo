import { samplePacks } from '@/utils/samples';
import { useAppStore } from '@/store/useAppStore';
import DataTag from './DataTag';

export default function SamplePanel() {
  const selectedSampleId = useAppStore((s) => s.selectedSampleId);
  const loadSample = useAppStore((s) => s.loadSample);

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-sm text-[#94a3b8]">样例包</span>
      {samplePacks.map((pack) => {
        const isSelected = pack.id === selectedSampleId;
        return (
          <button
            key={pack.id}
            onClick={() => loadSample(pack.id)}
            className="w-full rounded-lg p-3 text-left transition-colors"
            style={{
              backgroundColor: isSelected ? 'rgba(0,229,199,0.1)' : 'rgba(10,14,39,0.6)',
              border: `1px solid ${
                isSelected ? 'rgba(0,229,199,0.4)' : 'rgba(148,163,184,0.1)'
              }`,
            }}
          >
            <div className="mb-1 flex items-center justify-between">
              <span
                className="text-xs font-mono"
                style={{ color: isSelected ? '#00e5c7' : '#e2e8f0' }}
              >
                {pack.name}
              </span>
            </div>
            <p className="mb-2 text-[10px] text-[#94a3b8]/70 leading-relaxed">
              {pack.description}
            </p>
            <div className="flex flex-wrap gap-1">
              {pack.items.map((item) => (
                <DataTag key={item.key} tag={item.tag} />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
