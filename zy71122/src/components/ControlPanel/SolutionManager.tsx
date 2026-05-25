import { useState } from 'react';
import { useNetworkStore } from '@/store/useNetworkStore';
import { generatePDFReport, downloadJSONReport } from '@/utils/reportGenerator';
import { Save, FileText, Download, Trash2, Play, CheckCircle, XCircle, GitCompare, CheckSquare, Square } from 'lucide-react';

export function SolutionManager() {
  const {
    solutions,
    currentScenario,
    network,
    saveSolution,
    deleteSolution,
    loadSolution,
    selectedSolutionId,
    selectSolution,
    comparisonSolutionIds,
    toggleComparisonSolution,
    setShowComparison,
  } = useNetworkStore();

  const [newSolutionName, setNewSolutionName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const handleSaveSolution = () => {
    if (newSolutionName.trim()) {
      saveSolution(newSolutionName.trim());
      setNewSolutionName('');
      setShowSaveDialog(false);
    }
  };

  const handleExportPDF = (solution: typeof solutions[0]) => {
    generatePDFReport(solution, currentScenario.name, network);
  };

  const handleExportJSON = (solution: typeof solutions[0]) => {
    downloadJSONReport(solution, currentScenario.name);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Save className="w-4 h-4 text-cyan-400" />
          <span>方案管理</span>
        </div>
        <div className="flex gap-2">
          {comparisonSolutionIds.length > 0 && (
            <button
              onClick={() => setShowComparison(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-all border border-purple-500/30"
            >
              <GitCompare className="w-3 h-3" />
              对比 ({comparisonSolutionIds.length})
            </button>
          )}
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-all border border-cyan-500/30"
          >
            <Save className="w-3 h-3" />
            保存方案
          </button>
        </div>
      </div>

      {showSaveDialog && (
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <input
            type="text"
            value={newSolutionName}
            onChange={(e) => setNewSolutionName(e.target.value)}
            placeholder="输入方案名称..."
            className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 mb-2"
            onKeyDown={(e) => e.key === 'Enter' && handleSaveSolution()}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveSolution}
              disabled={!newSolutionName.trim()}
              className="flex-1 py-1.5 text-xs bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              确认保存
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="flex-1 py-1.5 text-xs bg-slate-700/50 text-slate-400 rounded hover:bg-slate-600/50 transition-all"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {solutions.length > 0 && (
        <div className="text-xs text-slate-500">
          💡 勾选方案可进行多方案对比（最多3个）
        </div>
      )}

      {solutions.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm">
          暂无保存的方案
          <br />
          <span className="text-xs">操作阀门后可保存方案</span>
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {solutions.map((solution) => {
            const isSelectedForComparison = comparisonSolutionIds.includes(solution.id);
            return (
              <div
                key={solution.id}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  selectedSolutionId === solution.id
                    ? 'bg-cyan-500/10 border-cyan-500/30'
                    : isSelectedForComparison
                    ? 'bg-purple-500/10 border-purple-500/30'
                    : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50'
                }`}
                onClick={() => selectSolution(solution.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleComparisonSolution(solution.id);
                      }}
                      className="p-0.5 rounded hover:bg-slate-700/50 transition-all"
                    >
                      {isSelectedForComparison ? (
                        <CheckSquare className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                    <span className="text-sm font-medium text-slate-200">
                      {solution.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {solution.impactAnalysis.hasConflict ? (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-400 mb-2 ml-6">
                  {new Date(solution.createdAt).toLocaleString('zh-CN')}
                </div>
                <div className="flex gap-2 text-xs ml-6">
                  <span className="px-2 py-0.5 bg-slate-700/50 rounded text-slate-300">
                    {solution.valveActions.filter((a) => a.toStatus === 'closed').length} 阀门
                  </span>
                  <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded">
                    {solution.impactAnalysis.affectedCustomerCount} 户
                  </span>
                </div>
                <div className="flex gap-2 mt-2 ml-6">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      loadSolution(solution.id);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 py-1 text-xs bg-slate-700/50 text-slate-300 rounded hover:bg-slate-600/50 transition-all"
                  >
                    <Play className="w-3 h-3" />
                    加载
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportPDF(solution);
                    }}
                    className="p-1 bg-slate-700/50 text-slate-300 rounded hover:bg-slate-600/50 transition-all"
                    title="导出PDF"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportJSON(solution);
                    }}
                    className="p-1 bg-slate-700/50 text-slate-300 rounded hover:bg-slate-600/50 transition-all"
                    title="导出JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSolution(solution.id);
                    }}
                    className="p-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-all"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
