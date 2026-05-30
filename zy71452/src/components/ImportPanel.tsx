import { useState } from 'react';
import { Panel } from './ui/Panel';
import { FileDropZone } from './ui/FileDropZone';
import { Camera, ChevronDown, ChevronUp } from 'lucide-react';
import { useBridgeStore } from '@/store/useBridgeStore';
import html2canvas from 'html2canvas';

export function ImportPanel() {
  const importData = useBridgeStore(state => state.importData);
  const dataSources = useBridgeStore(state => state.dataSources);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleTakeScreenshot = async () => {
    const element = document.getElementById('screenshot-area');
    if (!element) return;
    
    const canvas = await html2canvas(element, {
      backgroundColor: '#0f172a',
      scale: 2,
    });
    
    const link = document.createElement('a');
    link.download = `bridge-mode-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-10">
      <Panel>
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            <span className="text-sm">数据导入与导出</span>
          </button>
          
          <button
            onClick={handleTakeScreenshot}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
          >
            <Camera className="w-4 h-4" />
            截图导出
          </button>
        </div>
        
        {isExpanded && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <div className="text-xs text-zinc-500 mb-2">导入数据</div>
              <FileDropZone onDrop={importData} />
            </div>
            
            <div className="col-span-2">
              <div className="text-xs text-zinc-500 mb-2">已导入数据源 ({dataSources.length})</div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {dataSources.map((source, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-zinc-800 rounded text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={
                          source.sourceType === 'original'
                            ? 'w-2 h-2 rounded-full bg-blue-500'
                            : 'w-2 h-2 rounded-full bg-emerald-500'
                        }
                      />
                      <span className="text-zinc-300">{source.fileName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={
                        source.sourceType === 'original'
                          ? 'text-blue-400'
                          : 'text-emerald-400'
                      }>
                        {source.sourceType === 'original' ? '原始材料' : '处理结果'}
                      </span>
                      <span className="text-zinc-600">
                        {new Date(source.importedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
