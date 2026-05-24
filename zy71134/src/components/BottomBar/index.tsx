import React, { useState } from 'react';
import { Upload, RotateCcw, FileText, Download, HelpCircle, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export const BottomBar: React.FC = () => {
  const { resetState, importSampleData, valves, floors, wards, operationLogs } = useAppStore();
  const [showHelp, setShowHelp] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const generateReport = () => {
    const reportContent = `
================================================================================
                    医院氧气管线系统状态报告
                    生成时间: ${new Date().toLocaleString('zh-CN')}
================================================================================

一、楼层概览
--------------------------------------------------------------------------------
楼层总数: ${floors.length}
${floors.map(f => `  • ${f.name}`).join('\n')}

二、阀门状态统计
--------------------------------------------------------------------------------
阀门总数: ${valves.length}
开启数量: ${valves.filter(v => v.isOpen).length}
关闭数量: ${valves.filter(v => !v.isOpen).length}

状态分布:
  • 正常: ${valves.filter(v => v.status === 'normal').length}
  • 检修中: ${valves.filter(v => v.status === 'maintenance').length}
  • 故障: ${valves.filter(v => v.status === 'fault').length}
  • 检修过期: ${valves.filter(v => v.status === 'expired').length}

三、阀门详情列表
--------------------------------------------------------------------------------
${valves.map(v => `
${v.name}
  状态: ${v.isOpen ? '开启' : '关闭'} | 检修状态: ${
      v.status === 'normal' ? '正常' :
      v.status === 'maintenance' ? '检修中' :
      v.status === 'fault' ? '故障' : '检修过期'
    }
  位置: (${v.position.x.toFixed(1)}, ${v.position.y.toFixed(1)}, ${v.position.z.toFixed(1)})
  影响病区: ${v.affectedWards.map(id => wards.find(w => w.id === id)?.name || id).join(', ')}
  检修日期: ${v.maintenanceDate || '-'}
  到期日期: ${v.expiryDate || '-'}
  描述: ${v.description}
`).join('\n')}

四、操作日志（最近10条）
--------------------------------------------------------------------------------
${operationLogs.slice(0, 10).map(log => `
[${new Date(log.timestamp).toLocaleString('zh-CN')}] ${log.user} ${log.action === 'open' ? '开启' : '关闭'}了 ${log.valveName}
`).join('')}

================================================================================
                              报告结束
================================================================================
    `.trim();

    return reportContent;
  };

  const handleExportReport = () => {
    const report = generateReport();
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `氧气管线状态报告_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="absolute bottom-0 left-0 right-0 h-14 bg-white border-t border-gray-200 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={importSampleData}
            className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            <Upload size={16} />
            导入样例
          </button>
          <button
            onClick={resetState}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <RotateCcw size={16} />
            重置状态
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>
            阀门: <span className="font-medium text-gray-700">{valves.length}</span>
          </span>
          <span className="w-px h-4 bg-gray-300" />
          <span>
            开启: <span className="font-medium text-green-600">{valves.filter(v => v.isOpen).length}</span>
          </span>
          <span className="w-px h-4 bg-gray-300" />
          <span>
            关闭: <span className="font-medium text-red-600">{valves.filter(v => !v.isOpen).length}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
          >
            <FileText size={16} />
            查看报告
          </button>
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
          >
            <Download size={16} />
            导出报告
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <HelpCircle size={18} />
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">使用帮助</h3>
              <button
                onClick={() => setShowHelp(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">1</span>
                <p><strong>旋转视角</strong>：按住鼠标左键拖动</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">2</span>
                <p><strong>平移场景</strong>：按住鼠标右键拖动</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">3</span>
                <p><strong>缩放</strong>：滚动鼠标滚轮</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">4</span>
                <p><strong>查看阀门详情</strong>：单击阀门</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">5</span>
                <p><strong>切换阀门状态</strong>：双击阀门</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowReport(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">管线状态报告</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportReport}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                >
                  <Download size={14} />
                  导出
                </button>
                <button
                  onClick={() => setShowReport(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                {generateReport()}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BottomBar;
