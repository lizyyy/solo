import { useState } from 'react';
import html2canvas from 'html2canvas';
import { useSimulationStore } from '../store/simulationStore';
import { formatNumber } from '../utils/calculator';

export function ExportToolbar() {
  const [showHistory, setShowHistory] = useState(false);
  const { session, currentResult, recordExport, resetSession, verifyDataConsistency } = useSimulationStore((state) => ({
    session: state.session,
    currentResult: state.currentResult,
    recordExport: state.recordExport,
    resetSession: state.resetSession,
    verifyDataConsistency: state.verifyDataConsistency,
  }));

  const handleScreenshot = async () => {
    const element = document.getElementById('main-content');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#f8fafc',
        scale: 2,
      });
      
      const link = document.createElement('a');
      link.download = `电磁感应演示_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      await recordExport('screenshot');
    } catch (error) {
      console.error('截图导出失败:', error);
    }
  };

  const handleExportReport = () => {
    if (!currentResult) return;

    const report = `
电磁感应发电演示报告
====================

生成时间: ${new Date().toLocaleString('zh-CN')}
会话ID: ${session.id}

【原始输入参数】
----------------
线圈匝数 N: ${session.params.turns} 匝
磁场强度 B: ${session.params.fieldStrength} T
运动速度 v: ${session.params.velocity} m/s
线圈面积 A: ${session.params.area} m²
采样点数: ${session.params.samplePoints} 点
运动方向: ${session.params.direction === 1 ? '正向' : '反向'}

【计算过程】
----------------
公式: ε = -N · dΦ/dt

1. 最大磁通量 Φ_max = B·A
   Φ_max = ${session.params.fieldStrength} × ${session.params.area}
         = ${formatNumber(currentResult.intermediate.maxFlux, 6)} Wb

2. 磁通量变化率 dΦ/dt
   dΦ/dt = ${formatNumber(currentResult.intermediate.dFlux_dt, 6)} Wb/s

3. 感应电动势 ε
   ε_max = ${formatNumber(currentResult.result.maxVoltage, 6)} V
   ε_min = ${formatNumber(currentResult.result.minVoltage, 6)} V

【边界检测】
----------------
${session.warnings.length === 0 ? '无边界异常' : session.warnings.map(w => 
  `[${w.severity === 'to_confirm' ? '待确认' : '警告'}] ${w.type}: ${w.message}${w.confirmed ? ' (已确认)' : ''}`
).join('\n')}

【导出历史】
----------------
共导出 ${session.exportHistory.length} 次
最近导出: ${session.exportHistory.length > 0 
  ? new Date(session.exportHistory[session.exportHistory.length - 1].timestamp).toLocaleString('zh-CN')
  : '无'}

---
数据校验哈希: ${session.exportHistory.length > 0 
  ? session.exportHistory[session.exportHistory.length - 1].dataHash.slice(0, 16) + '...'
  : 'N/A'}
    `.trim();

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.download = `电磁感应报告_${new Date().toISOString().slice(0, 10)}.txt`;
    link.href = URL.createObjectURL(blob);
    link.click();
    
    recordExport('report');
  };

  const handleExportData = () => {
    if (!currentResult) return;

    const data = {
      sessionId: session.id,
      exportedAt: new Date().toISOString(),
      params: session.params,
      result: {
        timePoints: currentResult.result.timePoints,
        voltage: currentResult.result.voltage,
        maxVoltage: currentResult.result.maxVoltage,
        minVoltage: currentResult.result.minVoltage,
      },
      warnings: session.warnings,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `电磁感应数据_${new Date().toISOString().slice(0, 10)}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    
    recordExport('data');
  };

  const handleVerifyConsistency = async () => {
    const isConsistent = await verifyDataConsistency();
    alert(isConsistent ? '✓ 数据一致性验证通过' : '✗ 数据已被修改，与导出时不一致');
  };

  return (
    <div className="bg-white rounded-lg card-shadow p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={handleScreenshot}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-700 text-white text-sm rounded hover:bg-primary-800 btn-hover"
          >
            📷 截图导出
          </button>
          <button
            onClick={handleExportReport}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800 btn-hover"
          >
            📄 演示报告
          </button>
          <button
            onClick={handleExportData}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-600 text-white text-sm rounded hover:bg-slate-700 btn-hover"
          >
            📊 原始数据
          </button>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleVerifyConsistency}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 text-sm rounded hover:bg-slate-50 btn-hover"
          >
            ✓ 数据校验
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 text-sm rounded hover:bg-slate-50 btn-hover"
          >
            🕐 历史 ({session.exportHistory.length})
          </button>
          <button
            onClick={resetSession}
            className="flex items-center gap-1.5 px-3 py-2 border border-danger-300 text-danger-600 text-sm rounded hover:bg-danger-50 btn-hover"
          >
            🔄 重置
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <h4 className="text-sm font-medium text-slate-700 mb-2">导出历史</h4>
          {session.exportHistory.length === 0 ? (
            <p className="text-sm text-slate-500">暂无导出记录</p>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {session.exportHistory.slice().reverse().slice(0, 10).map((record) => (
                <div key={record.id} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded">
                  <span className="text-slate-600">
                    {record.type === 'screenshot' ? '📷' : record.type === 'report' ? '📄' : '📊'}
                    {' '}{new Date(record.timestamp).toLocaleString('zh-CN')}
                  </span>
                  <span className="font-mono text-slate-400">
                    {record.dataHash.slice(0, 8)}...
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
