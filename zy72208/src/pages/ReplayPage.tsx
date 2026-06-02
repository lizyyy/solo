import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, RefreshCw, FileText, CheckCircle, AlertTriangle, Terminal, ChevronRight } from 'lucide-react';
import { useSettlementStore } from '../store/useSettlementStore.js';
import { batchApi } from '../utils/api.js';

interface ReplayResult {
  command: string;
  status: 'pending' | 'running' | 'success' | 'error';
  output?: string;
  error?: string;
  duration?: number;
}

export const ReplayPage: React.FC = () => {
  const navigate = useNavigate();
  const { batches, loadBatches, loading } = useSettlementStore();
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [replaySteps, setReplaySteps] = useState<ReplayResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>('');

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const commands = [
    { key: 'reset', label: '重置数据库', cmd: 'npm run settlement -- reset' },
    { key: 'import', label: '导入除权日截图数据', cmd: 'npm run settlement -- import' },
    { key: 'self-check', label: '执行四类自检', cmd: 'npm run settlement -- self-check' },
    { key: 'replay-actions', label: '应用审计操作', cmd: 'npm run settlement -- replay-actions' },
    { key: 'export-report', label: '生成导出报告', cmd: 'npm run settlement -- export-report' }
  ];

  const runReplay = async () => {
    if (!selectedBatch) return;
    
    setIsRunning(true);
    setOutput('');
    setReplaySteps(commands.map(c => ({ command: c.cmd, status: 'pending' })));

    const batch = batches.find(b => b.id === selectedBatch);
    if (!batch) return;

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      setReplaySteps(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: 'running' } : s
      ));

      const startTime = Date.now();
      setOutput(prev => prev + `$ ${cmd.cmd}\n`);

      try {
        const res = await batchApi.runCommand(selectedBatch, cmd.key);
        
        setReplaySteps(prev => prev.map((s, idx) => 
          idx === i ? { 
            ...s, 
            status: 'success', 
            output: res.summary,
            duration: Date.now() - startTime
          } : s
        ));
        setOutput(prev => prev + `${res.summary || '成功'}\n\n`);
      } catch (err: any) {
        setReplaySteps(prev => prev.map((s, idx) => 
          idx === i ? { 
            ...s, 
            status: 'error', 
            error: err.message,
            duration: Date.now() - startTime
          } : s
        ));
        setOutput(prev => prev + `错误: ${err.message}\n\n`);
        break;
      }

      await new Promise(r => setTimeout(r, 500));
    }

    setIsRunning(false);
  };

  const statusConfig = {
    pending: { icon: <div className="w-4 h-4 rounded-full border-2 border-navy-300" />, color: 'text-navy-400' },
    running: { icon: <RefreshCw size={16} className="animate-spin text-navy-600" />, color: 'text-navy-600' },
    success: { icon: <CheckCircle size={16} className="text-audit-green" />, color: 'text-audit-green' },
    error: { icon: <AlertTriangle size={16} className="text-audit-red" />, color: 'text-audit-red' }
  };

  return (
    <div className="min-h-screen bg-navy-50">
      <header className="bg-white border-b border-navy-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-navy-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-navy-600" />
          </button>
          <div>
            <h1 className="font-display text-xl text-navy-800">复盘控制台</h1>
            <p className="text-sm text-navy-500">可重新跑的命令和完整操作记录</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg border border-navy-200 p-6 mb-6">
          <label className="block text-sm font-semibold text-navy-700 mb-2">选择要复盘的批次</label>
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="w-full p-3 border border-navy-300 rounded-lg text-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none"
            disabled={isRunning}
          >
            <option value="">请选择批次...</option>
            {batches.map(batch => (
              <option key={batch.id} value={batch.id}>
                {batch.batchNo} - {batch.sourceFile} ({batch.totalCount}条明细)
              </option>
            ))}
          </select>
          
          {selectedBatch && (
            <button
              onClick={runReplay}
              disabled={isRunning}
              className="mt-4 w-full py-3 bg-navy-800 text-white rounded-lg hover:bg-navy-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isRunning ? (
                <><RefreshCw size={18} className="animate-spin" /> 复盘中...</>
              ) : (
                <><Play size={18} /> 开始完整复盘</>
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-navy-800 flex items-center gap-2">
              <Terminal size={18} />
              执行步骤
            </h3>
            <div className="space-y-3">
              {replaySteps.length > 0 ? replaySteps.map((step, idx) => {
                const config = statusConfig[step.status];
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border transition-all ${
                      step.status === 'running' ? 'bg-navy-50 border-navy-300 shadow-md animate-breathe' :
                      step.status === 'success' ? 'bg-audit-green/5 border-audit-green/30' :
                      step.status === 'error' ? 'bg-audit-red/5 border-audit-red/30' :
                      'bg-white border-navy-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={config.color}>{config.icon}</div>
                        <span className="text-sm font-medium text-navy-800">{commands[idx].label}</span>
                      </div>
                      {step.duration && (
                        <span className="text-xs text-navy-400 font-mono">{step.duration}ms</span>
                      )}
                    </div>
                    <code className="text-xs font-mono text-navy-500 bg-navy-900/5 px-2 py-1 rounded block">
                      {step.command}
                    </code>
                    {step.output && (
                      <p className="text-xs text-navy-600 mt-2 flex items-center gap-1">
                        <ChevronRight size={12} className="text-audit-green" />
                        {step.output}
                      </p>
                    )}
                    {step.error && (
                      <p className="text-xs text-audit-red mt-2">{step.error}</p>
                    )}
                  </div>
                );
              }) : (
                <div className="p-12 text-center text-navy-400 border border-dashed border-navy-200 rounded-lg">
                  <FileText size={32} className="mx-auto mb-3 opacity-50" />
                  <p>选择批次后点击开始复盘</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-navy-800 flex items-center gap-2 mb-4">
              <Terminal size={18} />
              终端输出
            </h3>
            <div className="bg-navy-900 rounded-lg p-4 h-[500px] overflow-auto font-mono text-xs">
              <pre className="text-navy-100 whitespace-pre-wrap">
                {output || '# 等待复盘开始...\n\n# 保险佣金阶梯结算 - 复盘模式\n# 所有操作将记录审计日志\n'}
              </pre>
            </div>
            
            <div className="mt-4 p-4 bg-navy-50 rounded-lg border border-navy-200">
              <h4 className="text-sm font-semibold text-navy-700 mb-2">复盘说明</h4>
              <ul className="text-xs text-navy-600 space-y-1">
                <li>• 复盘会完整重现从导入到导出的所有步骤</li>
                <li>• "港币和人民币写在同一列"的记录不会自动修正</li>
                <li>• 所有操作都会生成新的审计日志</li>
                <li>• 最终结果与原始批次完全一致（单一数据源保证）</li>
                <li>• 可通过 <code className="bg-white px-1 rounded">npm run settlement -- --help</code> 查看所有命令</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
