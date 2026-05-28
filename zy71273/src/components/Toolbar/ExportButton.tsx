import { useState } from 'react';
import { Download, FileJson, FileImage, FileText, ChevronRight } from 'lucide-react';
import { useReportExport } from '../../hooks/useReportExport';
import { GlowButton } from '../common/GlowButton';
import { Tooltip } from '../common/Tooltip';
import { GlassCard } from '../common/GlassCard';

export function ExportButton() {
  const [showMenu, setShowMenu] = useState(false);
  const { exportAsJSON, exportAsPNG, exportAsPDF } = useReportExport();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (type: 'json' | 'png' | 'pdf') => {
    setIsExporting(true);
    setShowMenu(false);
    
    try {
      if (type === 'json') {
        exportAsJSON();
      } else if (type === 'png') {
        await exportAsPNG('main-container');
      } else if (type === 'pdf') {
        await exportAsPDF();
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <Tooltip content="导出报告" position="left">
        <GlowButton 
          variant="primary" 
          size="md"
          onClick={() => setShowMenu(!showMenu)}
          active={showMenu}
          disabled={isExporting}
        >
          <Download className={`w-4 h-4 ${isExporting ? 'animate-pulse' : ''}`} />
          <ChevronRight className={`w-3 h-3 -ml-1 transition-transform ${showMenu ? 'rotate-90' : ''}`} />
        </GlowButton>
      </Tooltip>

      {showMenu && (
        <div className="absolute right-full top-0 mr-2 z-50">
          <GlassCard className="p-2 flex flex-col gap-1 min-w-40">
            <button
              onClick={() => handleExport('json')}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
            >
              <FileJson className="w-4 h-4 text-indigo-400" />
              <div>
                <div className="text-sm text-white/90">JSON 数据</div>
                <div className="text-xs text-white/50">完整分析数据</div>
              </div>
            </button>
            
            <button
              onClick={() => handleExport('png')}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
            >
              <FileImage className="w-4 h-4 text-green-400" />
              <div>
                <div className="text-sm text-white/90">PNG 截图</div>
                <div className="text-xs text-white/50">当前视图截图</div>
              </div>
            </button>
            
            <button
              onClick={() => handleExport('pdf')}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
            >
              <FileText className="w-4 h-4 text-red-400" />
              <div>
                <div className="text-sm text-white/90">PDF 报告</div>
                <div className="text-xs text-white/50">完整分析报告</div>
              </div>
            </button>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
