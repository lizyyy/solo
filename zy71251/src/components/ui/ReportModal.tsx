import { X, Download, FileText, AlertTriangle, CheckCircle, Clock, TrendingUp, Box } from 'lucide-react';
import { useState } from 'react';
import jsPDF from 'jspdf';
import useStore from '../../store/useStore';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenshotData?: string;
}

export default function ReportModal({ isOpen, onClose, screenshotData }: ReportModalProps) {
  const { 
    locations, 
    tasks, 
    getFilteredLocations, 
    detectTemperatureAlerts, 
    detectHumidityAlerts,
    detectDuplicateLocations,
    operationLogs
  } = useStore();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const filteredLocations = getFilteredLocations();
  
  const tempAlerts = detectTemperatureAlerts();
  const humidAlerts = detectHumidityAlerts();
  const duplicates = detectDuplicateLocations();
  const occupiedCount = locations.filter(l => l.status === 'occupied').length;
  const emptyCount = locations.filter(l => l.status === 'empty').length;
  const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(20);
      doc.setTextColor(30, 41, 59);
      doc.text('艺术仓库库位孪生 - 仓储报告', 20, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 20, 35);
      
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.line(20, 40, 190, 40);
      
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text('一、库位统计', 20, 55);
      
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(`总库位数: ${locations.length}`, 25, 68);
      doc.text(`已占用: ${occupiedCount} (${Math.round(occupiedCount / locations.length * 100)}%)`, 25, 78);
      doc.text(`空置: ${emptyCount} (${Math.round(emptyCount / locations.length * 100)}%)`, 25, 88);
      doc.text(`当前筛选结果: ${filteredLocations.length} 个库位`, 25, 98);
      
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text('二、异常告警', 20, 115);
      
      doc.setFontSize(10);
      if (tempAlerts.length > 0) {
        doc.setTextColor(239, 68, 68);
        doc.text(`温度告警: ${tempAlerts.length} 个库位`, 25, 128);
        tempAlerts.slice(0, 5).forEach((loc, i) => {
          doc.text(`  - ${loc.code}: ${loc.sensor?.temperature}°C`, 25, 136 + i * 8);
        });
      } else {
        doc.setTextColor(16, 185, 129);
        doc.text('温度告警: 无', 25, 128);
      }
      
      if (humidAlerts.length > 0) {
        doc.setTextColor(245, 158, 11);
        doc.text(`湿度告警: ${humidAlerts.length} 个库位`, 25, 175);
      } else {
        doc.setTextColor(16, 185, 129);
        doc.text('湿度告警: 无', 25, 175);
      }
      
      if (duplicates.length > 0) {
        doc.setTextColor(239, 68, 68);
        doc.text(`库位异常: ${duplicates.length} 项`, 25, 185);
        duplicates.slice(0, 3).forEach((d, i) => {
          doc.text(`  - ${d}`, 25, 193 + i * 8);
        });
      } else {
        doc.setTextColor(16, 185, 129);
        doc.text('库位异常: 无', 25, 185);
      }
      
      doc.addPage();
      
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text('三、进行中任务', 20, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      if (activeTasks.length > 0) {
        activeTasks.forEach((task, i) => {
          const y = 38 + i * 20;
          doc.text(`任务 ${task.id}:`, 25, y);
          doc.text(`  类型: ${task.type === 'inbound' ? '入库' : task.type === 'outbound' ? '出库' : '移库'}`, 25, y + 6);
          doc.text(`  状态: ${task.status === 'pending' ? '待处理' : '进行中'}`, 25, y + 12);
          if (task.hasForbiddenCrossing) {
            doc.setTextColor(239, 68, 68);
            doc.text(`  警告: 路线穿越禁区`, 25, y + 18);
            doc.setTextColor(51, 65, 85);
          }
        });
      } else {
        doc.setTextColor(16, 185, 129);
        doc.text('暂无进行中任务', 25, 38);
      }
      
      doc.addPage();
      
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text('四、操作日志', 20, 25);
      
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      operationLogs.slice(0, 15).forEach((log, i) => {
        const time = new Date(log.time).toLocaleString('zh-CN');
        doc.text(`${time} - ${log.operator}: ${log.action}${log.remark ? ` - ${log.remark}` : ''}`, 25, 38 + i * 10);
      });
      
      if (screenshotData) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text('五、场景截图', 20, 25);
        doc.addImage(screenshotData, 'PNG', 20, 35, 170, 100);
      }
      
      doc.save(`仓储报告_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF生成失败:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl border border-slate-700/50">
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <FileText size={20} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">仓储报告</h2>
              <p className="text-sm text-slate-400">包含当前筛选结果的完整分析</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                <Box size={14} />
                总库位
              </div>
              <div className="text-2xl font-bold text-white font-mono">{locations.length}</div>
            </div>
            <div className="bg-green-900/30 rounded-xl p-4 border border-green-700/30">
              <div className="flex items-center gap-2 text-green-400 text-sm mb-2">
                <CheckCircle size={14} />
                已占用
              </div>
              <div className="text-2xl font-bold text-green-400 font-mono">{occupiedCount}</div>
            </div>
            <div className="bg-red-900/30 rounded-xl p-4 border border-red-700/30">
              <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
                <AlertTriangle size={14} />
                异常告警
              </div>
              <div className="text-2xl font-bold text-red-400 font-mono">
                {tempAlerts.length + humidAlerts.length + duplicates.length}
              </div>
            </div>
            <div className="bg-blue-900/30 rounded-xl p-4 border border-blue-700/30">
              <div className="flex items-center gap-2 text-blue-400 text-sm mb-2">
                <Clock size={14} />
                待处理任务
              </div>
              <div className="text-2xl font-bold text-blue-400 font-mono">{activeTasks.length}</div>
            </div>
          </div>

          {(tempAlerts.length > 0 || humidAlerts.length > 0 || duplicates.length > 0) && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-400" />
                异常详情
              </h3>
              <div className="space-y-2">
                {tempAlerts.length > 0 && (
                  <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                    <div className="text-red-400 text-sm font-medium mb-1">温度异常 ({tempAlerts.length})</div>
                    <div className="text-xs text-red-300/70">
                      {tempAlerts.slice(0, 5).map(l => l.code).join(', ')}
                      {tempAlerts.length > 5 && ` 等 ${tempAlerts.length} 个库位`}
                    </div>
                  </div>
                )}
                {humidAlerts.length > 0 && (
                  <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
                    <div className="text-amber-400 text-sm font-medium mb-1">湿度异常 ({humidAlerts.length})</div>
                    <div className="text-xs text-amber-300/70">
                      {humidAlerts.slice(0, 5).map(l => l.code).join(', ')}
                      {humidAlerts.length > 5 && ` 等 ${humidAlerts.length} 个库位`}
                    </div>
                  </div>
                )}
                {duplicates.length > 0 && (
                  <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                    <div className="text-red-400 text-sm font-medium mb-1">库位冲突 ({duplicates.length})</div>
                    <div className="text-xs text-red-300/70">
                      {duplicates[0]}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-400" />
              当前筛选结果 ({filteredLocations.length} 个库位)
            </h3>
            <div className="max-h-48 overflow-y-auto bg-slate-800/30 rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="text-slate-400 text-xs">
                    <th className="text-left p-2">库位编号</th>
                    <th className="text-left p-2">状态</th>
                    <th className="text-left p-2">区域</th>
                    <th className="text-left p-2">温度</th>
                    <th className="text-left p-2">湿度</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLocations.slice(0, 50).map(loc => (
                    <tr key={loc.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-2 text-white font-mono text-xs">{loc.code}</td>
                      <td className="p-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          loc.status === 'occupied' ? 'bg-green-900/50 text-green-400' :
                          loc.status === 'empty' ? 'bg-slate-700 text-slate-400' :
                          'bg-yellow-900/50 text-yellow-400'
                        }`}>
                          {loc.status === 'occupied' ? '已占用' : loc.status === 'empty' ? '空置' : '维护中'}
                        </span>
                      </td>
                      <td className="p-2 text-slate-400 text-xs">
                        {loc.zone === 'valuables' ? '贵重品' : loc.zone === 'constant_temp' ? '恒温' : '普通'}
                      </td>
                      <td className={`p-2 font-mono text-xs ${
                        loc.sensor?.temperature && loc.sensor.temperature > 25 ? 'text-red-400' :
                        loc.sensor?.temperature && loc.sensor.temperature < 18 ? 'text-blue-400' :
                        'text-green-400'
                      }`}>
                        {loc.sensor?.temperature}°C
                      </td>
                      <td className={`p-2 font-mono text-xs ${
                        loc.sensor?.humidity && loc.sensor.humidity > 60 ? 'text-amber-400' :
                        loc.sensor?.humidity && loc.sensor.humidity < 40 ? 'text-blue-400' :
                        'text-green-400'
                      }`}>
                        {loc.sensor?.humidity}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredLocations.length > 50 && (
                <div className="p-2 text-center text-xs text-slate-500 border-t border-slate-700/50">
                  仅显示前 50 条，完整数据请导出 PDF
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700/50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={generatePDF}
            disabled={isGenerating}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Download size={16} />
                导出 PDF 报告
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
