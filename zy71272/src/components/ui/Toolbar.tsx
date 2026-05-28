import { useState } from 'react';
import {
  Save,
  FolderOpen,
  FileText,
  Camera,
  Thermometer,
  Plus,
  Menu,
  X,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { generateId } from '../../utils/helpers';

export default function Toolbar() {
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');

  const plan = useStore(state => state.plan);
  const sceneIssues = useStore(state => state.sceneIssues);
  const showHeatmap = useStore(state => state.showHeatmap);
  const uiState = useStore(state => state.uiState);
  const updatePlanMeta = useStore(state => state.updatePlanMeta);
  const saveCurrentPlan = useStore(state => state.saveCurrentPlan);
  const savePlanAs = useStore(state => state.savePlanAs);
  const initNewPlan = useStore(state => state.initNewPlan);
  const setShowHeatmap = useStore(state => state.setShowHeatmap);
  const setShowReportModal = useStore(state => state.setShowReportModal);
  const setShowLoadModal = useStore(state => state.setShowLoadModal);
  const setSidebarOpen = useStore(state => state.setSidebarOpen);
  const autoBalanceVolumes = useStore(state => state.autoBalanceVolumes);

  const errorCount = sceneIssues.filter(i => i.severity === 'error').length;
  const warningCount = sceneIssues.filter(i => i.severity === 'warning').length;

  const handleSave = async () => {
    if (plan?.isSaved) {
      await saveCurrentPlan();
    } else {
      setSaveAsOpen(true);
      setNewPlanName(plan?.name || '新排练方案');
    }
  };

  const handleSaveAs = async () => {
    if (newPlanName.trim()) {
      await savePlanAs(newPlanName.trim());
      setSaveAsOpen(false);
    }
  };

  const handleScreenshot = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `${plan?.name || 'rehearsal'}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-16 bg-gradient-to-r from-[#121a29] via-[#0f1520] to-[#121a29] border-b border-[#00f0ff]/30 z-50 flex items-center justify-between px-4 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!uiState.sidebarOpen)}
          className="p-2 rounded-lg text-[#00f0ff] hover:bg-[#00f0ff]/10 transition-all duration-300"
        >
          {uiState.sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00f0ff] to-[#ff3366] flex items-center justify-center text-white font-bold text-sm">
            3D
          </div>
          <div>
            <h1 className="text-[#00f0ff] text-lg font-bold tracking-wider" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              乐队排练声像系统
            </h1>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-md mx-8">
        <input
          type="text"
          value={plan?.name || ''}
          onChange={(e) => updatePlanMeta({ name: e.target.value })}
          className="w-full bg-[#0a0e17]/50 border border-[#00f0ff]/30 rounded-lg px-4 py-2 text-white placeholder-[#8899aa] focus:outline-none focus:border-[#00f0ff] transition-all duration-300"
          placeholder="方案名称"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-3 mr-4 px-3 py-1.5 bg-[#0a0e17]/50 rounded-lg border border-[#ff6b35]/30">
          {errorCount > 0 && (
            <div className="flex items-center gap-1 text-[#ff3366]">
              <AlertTriangle size={16} />
              <span className="text-sm font-bold">{errorCount}</span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-1 text-[#ff6b35]">
              <AlertTriangle size={16} className="opacity-60" />
              <span className="text-sm font-bold opacity-80">{warningCount}</span>
            </div>
          )}
          {errorCount === 0 && warningCount === 0 && (
            <span className="text-[#00ff88] text-sm">✓ 无问题</span>
          )}
        </div>

        {plan && !plan.isSaved && (
          <span className="text-[#ff6b35] text-sm animate-pulse mr-2">● 未保存</span>
        )}

        <button
          onClick={initNewPlan}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[#8899aa] hover:text-[#00f0ff] hover:bg-[#00f0ff]/10 transition-all duration-300"
          title="新建方案"
        >
          <Plus size={18} />
        </button>

        <button
          onClick={() => setShowLoadModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[#8899aa] hover:text-[#00f0ff] hover:bg-[#00f0ff]/10 transition-all duration-300"
          title="加载方案"
        >
          <FolderOpen size={18} />
        </button>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30 border border-[#00f0ff]/50 transition-all duration-300"
          title="保存方案"
        >
          <Save size={18} />
          <span className="text-sm font-medium">保存</span>
        </button>

        <div className="w-px h-8 bg-[#3a4a6b] mx-2" />

        <button
          onClick={autoBalanceVolumes}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[#8899aa] hover:text-[#00ff88] hover:bg-[#00ff88]/10 transition-all duration-300"
          title="自动音量平衡"
        >
          <Download size={18} className="rotate-90" />
        </button>

        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-300 ${
            showHeatmap
              ? 'bg-[#ff6b35]/20 text-[#ff6b35] border border-[#ff6b35]/50'
              : 'text-[#8899aa] hover:text-[#ff6b35] hover:bg-[#ff6b35]/10'
          }`}
          title="声像热力图"
        >
          <Thermometer size={18} />
        </button>

        <button
          onClick={handleScreenshot}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[#8899aa] hover:text-[#00f0ff] hover:bg-[#00f0ff]/10 transition-all duration-300"
          title="截图"
        >
          <Camera size={18} />
        </button>

        <button
          onClick={() => setShowReportModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#ff3366]/20 to-[#ff6b35]/20 text-[#ff6b35] hover:from-[#ff3366]/30 hover:to-[#ff6b35]/30 border border-[#ff6b35]/50 transition-all duration-300"
          title="生成报告"
        >
          <FileText size={18} />
          <span className="text-sm font-medium">报告</span>
        </button>
      </div>

      {saveAsOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#121a29] border border-[#00f0ff]/30 rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-[#00f0ff] text-lg font-bold mb-4">另存为</h3>
            <input
              type="text"
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              className="w-full bg-[#0a0e17] border border-[#00f0ff]/30 rounded-lg px-4 py-3 text-white mb-4 focus:outline-none focus:border-[#00f0ff]"
              placeholder="输入方案名称"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSaveAsOpen(false)}
                className="px-4 py-2 rounded-lg text-[#8899aa] hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveAs}
                className="px-4 py-2 rounded-lg bg-[#00f0ff] text-[#0a0e17] font-bold hover:bg-[#00d0e0] transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
