import { Upload, FileText, AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { StatusBadge } from '@/components/StatusBadge';
import { demoDataBundle } from '@/data/mockData';

export default function ThresholdNotes() {
  const { thresholdNotes, importDemoData, dispatch, showToast } = useAppStore();
  
  const handleImportDemo = () => {
    importDemoData();
  };
  
  const handleSimulateImport = () => {
    const { normalNote, timeWindowNote } = demoDataBundle;
    dispatch({
      type: 'IMPORT_NOTES',
      payload: [normalNote, timeWindowNote],
    });
    showToast('success', '调参笔记导入成功！检测到1条时间窗穿越记录');
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-stagger">
        <div>
          <h1 className="text-2xl font-bold text-white">阈值调参笔记</h1>
          <p className="text-slate-400 mt-1">导入和管理阈值调参记录，系统自动检测时间窗穿越</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleSimulateImport} className="btn-secondary flex items-center gap-2">
            <FileText size={18} />
            模拟导入演示数据
          </button>
          <button onClick={handleImportDemo} className="btn-primary flex items-center gap-2">
            <Upload size={18} />
            一键导入演示
          </button>
        </div>
      </div>
      
      <div className="glass-card p-4 animate-stagger" style={{ animationDelay: '100ms' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center flex-shrink-0">
            <Info className="text-primary-400" size={20} />
          </div>
          <div>
            <h3 className="text-white font-medium">时间窗穿越检测说明</h3>
            <p className="text-sm text-slate-400 mt-1">
              当一条记录的统计时段跨越多个统计窗口边界时，可能会导致效果指标虚高。
              系统会自动检测这类记录，并标记为"待复核"状态，不会直接归为正常数据。
              需要实验平台负责人人工复核后才能确认。
            </p>
          </div>
        </div>
      </div>
      
      <div className="glass-card overflow-hidden animate-stagger" style={{ animationDelay: '200ms' }}>
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-white">调参记录列表</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="table-header">批次号</th>
                <th className="table-header">阈值</th>
                <th className="table-header">唤醒率</th>
                <th className="table-header">误唤醒率</th>
                <th className="table-header">时间窗</th>
                <th className="table-header">跨时间窗</th>
                <th className="table-header">来源</th>
                <th className="table-header">操作人</th>
                <th className="table-header">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {thresholdNotes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <FileText className="mx-auto mb-3 opacity-50" size={40} />
                    <p>暂无调参记录，点击上方按钮导入演示数据</p>
                  </td>
                </tr>
              ) : (
                thresholdNotes.map((note, index) => (
                  <tr 
                    key={note.id}
                    className={`transition-colors ${
                      note.crossesTimeWindow ? 'bg-warning-500/5 hover:bg-warning-500/10' : 'hover:bg-slate-700/30'
                    }`}
                    style={{ animationDelay: `${(index + 3) * 50}ms` }}
                  >
                    <td className="table-cell font-mono text-xs">{note.batchId}</td>
                    <td className="table-cell">
                      <span className="font-mono font-medium">{note.threshold}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`font-medium ${note.wakeRate > 94 ? 'text-success-400' : 'text-slate-200'}`}>
                        {note.wakeRate}%
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`font-medium ${note.falseAlarmRate < 0.2 ? 'text-success-400' : 'text-slate-200'}`}>
                        {note.falseAlarmRate}%
                      </span>
                    </td>
                    <td className="table-cell text-xs text-slate-400">
                      {note.timeWindowStart}
                      <br />
                      ~ {note.timeWindowEnd}
                    </td>
                    <td className="table-cell">
                      {note.crossesTimeWindow ? (
                        <span className="inline-flex items-center gap-1 text-warning-400">
                          <AlertTriangle size={14} />
                          <span className="text-xs">是</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-success-400">
                          <CheckCircle2 size={14} />
                          <span className="text-xs">否</span>
                        </span>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-300">
                        {note.source === 'experiment' ? '实验桶补录' : '导入'}
                      </span>
                    </td>
                    <td className="table-cell">{note.operator}</td>
                    <td className="table-cell">
                      <StatusBadge status={note.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {thresholdNotes.some(n => n.crossesTimeWindow) && (
        <div className="glass-card p-5 border-l-4 border-warning-500 animate-stagger" style={{ animationDelay: '300ms' }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-warning-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="text-white font-medium">检测到时间窗穿越记录</h3>
              <p className="text-sm text-slate-400 mt-1">
                有 <span className="text-warning-400 font-medium">{thresholdNotes.filter(n => n.crossesTimeWindow).length}</span> 条记录跨越了统计时间窗，
                效果数据可能存在虚高。这些记录已自动标记为<strong className="text-warning-400">"待复核"</strong>状态，
                请前往<strong className="text-primary-400">异常样本页</strong>查看详情，并提交给实验平台负责人复核。
              </p>
              <div className="mt-3 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-300">处理原则：</strong>
                  时间窗穿越的数据不归为正常，必须留待负责人复核确认后，才能决定是否纳入最终校准结果。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
