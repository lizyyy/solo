import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Play, PanelLeftClose, PanelRightClose } from 'lucide-react';
import { useAppStore } from '@/store';
import AudioUploader from '@/components/AudioUploader';
import WaveformDisplay from '@/components/WaveformDisplay';
import EnvelopeCurve from '@/components/EnvelopeCurve';
import ADSRPanel from '@/components/ADSRPanel';

const TABS = [
  { path: '/', label: '工作台' },
  { path: '/detail', label: '数据明细' },
  { path: '/compare', label: '历史对比' },
];

export default function Workstation() {
  const location = useLocation();
  const audioFile = useAppStore((s) => s.audioFile);
  const waveformData = useAppStore((s) => s.waveformData);
  const onsetSample = useAppStore((s) => s.onsetSample);
  const currentRecord = useAppStore((s) => s.currentRecord);
  const fitADSR = useAppStore((s) => s.fitADSR);
  const isFitting = useAppStore((s) => s.isFitting);

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const handleFit = () => {
    fitADSR('Other', '');
  };

  return (
    <div className="h-screen flex flex-col bg-synth-bg text-white font-sans">
      <header className="flex items-center justify-between px-4 h-12 border-b border-synth-border shrink-0">
        <h1 className="font-mono text-sm tracking-widest text-synth-accent">
          ENVELOPE FITTER
        </h1>
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              className={`px-3 py-1 rounded-md text-xs font-mono transition-colors ${
                location.pathname === tab.path
                  ? 'bg-synth-selected text-white'
                  : 'text-synth-muted hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="flex-1 overflow-hidden hidden lg:grid lg:grid-cols-[280px_1fr_320px] gap-0">
        <aside className="border-r border-synth-border p-4 overflow-y-auto">
          <AudioUploader />
        </aside>

        <main className="flex flex-col p-4 gap-4 overflow-y-auto">
          <WaveformDisplay waveformData={waveformData} onsetSample={onsetSample} />
          {currentRecord ? (
            <EnvelopeCurve raw={currentRecord.raw} conclusion={currentRecord.conclusion} />
          ) : (
            <div className="w-full h-40 rounded-xl bg-synth-card border border-synth-border flex items-center justify-center">
              <span className="text-synth-muted text-sm font-mono">上传音频以查看包络曲线</span>
            </div>
          )}
          {audioFile && !currentRecord && (
            <button
              onClick={handleFit}
              disabled={isFitting}
              className="self-center flex items-center gap-2 px-6 py-3 rounded-xl font-mono text-sm bg-synth-accent text-black hover:shadow-glow-green transition-shadow disabled:opacity-50"
            >
              <Play className="w-5 h-5" />
              {isFitting ? '拟合中...' : '开始拟合'}
            </button>
          )}
        </main>

        <aside className="border-l border-synth-border p-4 overflow-y-auto">
          <ADSRPanel record={currentRecord} />
        </aside>
      </div>

      <div className="flex-1 overflow-hidden lg:hidden">
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-synth-border shrink-0">
            <button
              onClick={() => setLeftOpen(!leftOpen)}
              className="p-1.5 rounded-md text-synth-muted hover:text-white transition-colors"
            >
              <PanelLeftClose className={`w-4 h-4 transition-transform ${leftOpen ? '' : 'rotate-180'}`} />
            </button>
            <span className="text-xs font-mono text-synth-muted flex-1 text-center">
              {audioFile ? audioFile.fileName : 'ENVELOPE FITTER'}
            </span>
            <button
              onClick={() => setRightOpen(!rightOpen)}
              className="p-1.5 rounded-md text-synth-muted hover:text-white transition-colors"
            >
              <PanelRightClose className={`w-4 h-4 transition-transform ${rightOpen ? '' : 'rotate-180'}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {leftOpen && <AudioUploader />}
            <WaveformDisplay waveformData={waveformData} onsetSample={onsetSample} />
            {currentRecord && (
              <EnvelopeCurve raw={currentRecord.raw} conclusion={currentRecord.conclusion} />
            )}
            {audioFile && !currentRecord && (
              <button
                onClick={handleFit}
                disabled={isFitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-mono text-sm bg-synth-accent text-black hover:shadow-glow-green transition-shadow disabled:opacity-50"
              >
                <Play className="w-5 h-5" />
                {isFitting ? '拟合中...' : '开始拟合'}
              </button>
            )}
            {rightOpen && (
              <div className="rounded-xl bg-synth-card border border-synth-border p-4">
                <ADSRPanel record={currentRecord} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
