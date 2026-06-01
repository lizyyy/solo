import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { exportScreenshotWithWatermark, buildFilterText } from '@/utils/screenshot';
import { Camera, Save, Home, Database, FolderOpen } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Toolbar({ glRef }: { glRef: React.RefObject<import('three').WebGLRenderer | null> }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { filter, schemes, currentSchemeId, saveScheme } = useStore();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [schemeName, setSchemeName] = useState('');
  const [schemeNote, setSchemeNote] = useState('');

  const handleScreenshot = () => {
    const canvas = glRef.current?.domElement;
    if (!canvas) return;

    const currentScheme = schemes.find((s) => s.id === currentSchemeId);
    exportScreenshotWithWatermark(canvas, {
      filterText: buildFilterText(filter),
      timestamp: new Date().toLocaleString('zh-CN'),
      schemeName: currentScheme?.name || '',
    });
  };

  const handleSaveScheme = () => {
    if (!schemeName.trim()) return;
    saveScheme(
      schemeName.trim(),
      schemeNote.trim(),
      [0, 15, 15],
      [0, 0, 0]
    );
    setSchemeName('');
    setSchemeNote('');
    setShowSaveDialog(false);
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-[#0a1628]/90 to-transparent">
      <div className="flex items-center gap-1">
        <NavButton
          icon={Home}
          label="沙盘"
          active={location.pathname === '/'}
          onClick={() => navigate('/')}
        />
        <NavButton
          icon={Database}
          label="数据"
          active={location.pathname === '/data'}
          onClick={() => navigate('/data')}
        />
        <NavButton
          icon={FolderOpen}
          label="方案"
          active={location.pathname === '/schemes'}
          onClick={() => navigate('/schemes')}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleScreenshot}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs hover:bg-cyan-500/20 transition-colors"
        >
          <Camera size={14} />
          截图导出
        </button>
        <button
          onClick={() => setShowSaveDialog(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 text-xs hover:bg-cyan-600/30 transition-colors"
        >
          <Save size={14} />
          保存方案
        </button>
      </div>

      {showSaveDialog && (
        <div className="absolute top-12 right-4 w-72 bg-[#0e1a30] border border-cyan-500/30 rounded-lg shadow-2xl p-4 z-30">
          <h4 className="text-sm font-semibold text-cyan-300 mb-3">保存方案</h4>
          <input
            type="text"
            value={schemeName}
            onChange={(e) => setSchemeName(e.target.value)}
            placeholder="方案名称"
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white mb-2 focus:outline-none focus:border-cyan-500/50 placeholder:text-zinc-600"
          />
          <textarea
            value={schemeNote}
            onChange={(e) => setSchemeNote(e.target.value)}
            placeholder="备注说明"
            rows={2}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white mb-3 resize-none focus:outline-none focus:border-cyan-500/50 placeholder:text-zinc-600"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-3 py-1 rounded text-xs text-zinc-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveScheme}
              className="px-3 py-1 rounded bg-cyan-600 text-white text-xs hover:bg-cyan-500 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors ${
        active
          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
          : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
