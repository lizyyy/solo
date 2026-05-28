import { Download, Save, Image } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { downloadCanvasAsPng } from '@/utils/persistence';

export default function ExportPanel() {
  const exportCurrentReport = useAppStore((s) => s.exportCurrentReport);
  const saveCurrentParameters = useAppStore((s) => s.saveCurrentParameters);

  const handleExportPng = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      downloadCanvasAsPng(canvas, `quat-sphere-${Date.now()}.png`);
    }
  };

  const buttons = [
    {
      icon: Download,
      label: '导出 JSON',
      onClick: exportCurrentReport,
      color: '#00e5c7',
    },
    {
      icon: Image,
      label: '导出 PNG',
      onClick: handleExportPng,
      color: '#00e5c7',
    },
    {
      icon: Save,
      label: '保存参数',
      onClick: saveCurrentParameters,
      color: '#94a3b8',
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-sm text-[#94a3b8]">导出</span>
      {buttons.map(({ icon: Icon, label, onClick, color }) => (
        <button
          key={label}
          onClick={onClick}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:opacity-80"
          style={{
            backgroundColor: `${color}10`,
            border: `1px solid ${color}30`,
          }}
        >
          <Icon size={14} style={{ color }} />
          <span className="text-xs font-mono" style={{ color }}>
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
