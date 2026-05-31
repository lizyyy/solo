import { Upload, Download, History, Plus, AlertTriangle, Settings } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export function Toolbar() {
  const openImportModal = useAppStore(state => state.openImportModal);
  const openExportModal = useAppStore(state => state.openExportModal);
  const openHistoryModal = useAppStore(state => state.openHistoryModal);
  const toggleSidePanel = useAppStore(state => state.toggleSidePanel);
  
  const { windows, conflicts, isSidePanelOpen } = useAppStore();
  const unresolvedConflicts = conflicts.filter(c => c.status === 'DETECTED').length;

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-space-900 border-b border-tech-cyan/20">
      <div className="flex items-center gap-4">
        <h1 className="font-orbitron text-xl text-tech-cyan tracking-wider">
          卫星过境窗口
        </h1>
        <div className="h-6 w-px bg-tech-cyan/30" />
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="font-mono">窗口数: {windows.length}</span>
          {unresolvedConflicts > 0 && (
            <span className="flex items-center gap-1 text-tech-red">
              <AlertTriangle size={14} />
              {unresolvedConflicts} 个冲突
            </span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidePanel}
          className={`btn-tech ${isSidePanelOpen ? 'bg-tech-cyan/20' : ''}`}
          title="详情面板"
        >
          <Settings size={16} />
          <span className="hidden sm:inline ml-2">详情</span>
        </button>
        
        <button
          onClick={() => {}}
          className="btn-tech btn-success"
          title="新建窗口"
        >
          <Plus size={16} />
          <span className="hidden sm:inline ml-2">新建</span>
        </button>
        
        <button
          onClick={openImportModal}
          className="btn-tech btn-warning"
          title="导入数据"
        >
          <Upload size={16} />
          <span className="hidden sm:inline ml-2">导入</span>
        </button>
        
        <button
          onClick={openExportModal}
          className="btn-tech"
          title="导出简报"
        >
          <Download size={16} />
          <span className="hidden sm:inline ml-2">导出</span>
        </button>
        
        <button
          onClick={openHistoryModal}
          className="btn-tech"
          title="历史记录"
        >
          <History size={16} />
          <span className="hidden sm:inline ml-2">历史</span>
        </button>
      </div>
    </div>
  );
}
