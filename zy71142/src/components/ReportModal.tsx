import React, { useRef } from 'react';
import { X, Download, FileText, CheckCircle, AlertTriangle, Clock, Users, Layers } from 'lucide-react';
import { useSimulationStore } from '@/store/simulationStore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const ReportModal: React.FC = () => {
  const showReport = useSimulationStore(state => state.showReport);
  const setShowReport = useSimulationStore(state => state.setShowReport);
  const selectedPlan = useSimulationStore(state => state.selectedPlan);
  const statistics = useSimulationStore(state => state.statistics);
  const conflicts = useSimulationStore(state => state.conflicts);
  const currentTime = useSimulationStore(state => state.currentTime);
  const reportRef = useRef<HTMLDivElement>(null);
  
  if (!showReport || !selectedPlan) return null;
  
  const formatTime = (seconds: number): string => {
    if (seconds === 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}分${secs}秒`;
  };
  
  const generateRecommendations = (): string[] => {
    const recommendations: string[] = [];
    
    if (conflicts.filter(c => c.type === 'stairCapacity' && !c.resolved).length > 0) {
      recommendations.push('楼梯容量不足，建议增加楼梯数量或扩大楼梯宽度');
      recommendations.push('优化班级疏散顺序，避免集中使用同一楼梯');
    }
    
    if (conflicts.filter(c => c.type === 'order' && !c.resolved).length > 0) {
      recommendations.push('调整班级疏散顺序，采用低年级优先、错时疏散策略');
    }
    
    if (conflicts.filter(c => c.type === 'assemblyCapacity' && !c.resolved).length > 0) {
      recommendations.push('集合点容量不足，建议增加集合点或扩大现有集合点面积');
    }
    
    if (statistics.maxEvacuationTime > 180) {
      recommendations.push('疏散时间过长，建议优化疏散路线或增加出口');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('当前方案疏散效率良好，建议继续保持');
      recommendations.push('可定期进行演练，确保师生熟悉疏散路线');
    }
    
    return recommendations;
  };
  
  const exportPDF = async () => {
    if (!reportRef.current) return;
    
    const canvas = await html2canvas(reportRef.current, {
      backgroundColor: '#ffffff',
      scale: 2
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    
    pdf.addImage(imgData, 'PNG', imgX, 10, imgWidth * ratio, imgHeight * ratio);
    pdf.save(`疏散报告_${selectedPlan.name}_${new Date().toLocaleDateString()}.pdf`);
  };
  
  const exportJSON = () => {
    const reportData = {
      planName: selectedPlan.name,
      generatedAt: new Date().toISOString(),
      simulationTime: currentTime,
      statistics: statistics,
      conflicts: conflicts,
      recommendations: generateRecommendations()
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `疏散报告_${selectedPlan.name}_${new Date().toLocaleDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-[800px] max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            疏散分析报告
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              导出PDF
            </button>
            <button
              onClick={exportJSON}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              导出JSON
            </button>
            <button
              onClick={() => setShowReport(false)}
              className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
        
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
          <div ref={reportRef} className="bg-white text-slate-900 p-8 rounded-lg">
            <div className="text-center mb-8 pb-4 border-b border-slate-200">
              <h1 className="text-2xl font-bold text-slate-800">校园消防疏散分析报告</h1>
              <p className="text-slate-500 mt-2">生成时间: {new Date().toLocaleString()}</p>
            </div>
            
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                方案信息
              </h2>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 text-sm">方案名称</span>
                    <p className="font-medium">{selectedPlan.name}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-sm">方案类型</span>
                    <p className="font-medium">
                      {selectedPlan.type === 'normal' && '正常方案'}
                      {selectedPlan.type === 'conflict' && '冲突方案'}
                      {selectedPlan.type === 'empty' && '空方案'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-sm">班级数量</span>
                    <p className="font-medium">{selectedPlan.classrooms.length} 个</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-sm">模拟时长</span>
                    <p className="font-medium">{formatTime(currentTime)}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                统计数据
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">{statistics.totalStudents}</div>
                  <div className="text-sm text-green-600">总人数</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">{statistics.evacuatedStudents}</div>
                  <div className="text-sm text-blue-600">已疏散</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-amber-600">
                    {statistics.totalStudents > 0 
                      ? ((statistics.evacuatedStudents / statistics.totalStudents) * 100).toFixed(1) 
                      : 0}%
                  </div>
                  <div className="text-sm text-amber-600">完成率</div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-500 text-sm">平均用时</span>
                  </div>
                  <div className="text-xl font-bold">{formatTime(statistics.avgEvacuationTime)}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-500 text-sm">最长用时</span>
                  </div>
                  <div className="text-xl font-bold">{formatTime(statistics.maxEvacuationTime)}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-500 text-sm">最大楼梯使用率</span>
                  </div>
                  <div className="text-xl font-bold">{(statistics.maxStairUsage).toFixed(0)} 人</div>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                冲突告警 ({conflicts.filter(c => !c.resolved).length})
              </h2>
              {conflicts.filter(c => !c.resolved).length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-green-700">暂无冲突，疏散方案良好</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conflicts.filter(c => !c.resolved).map(conflict => (
                    <div 
                      key={conflict.id}
                      className={`rounded-lg p-3 ${
                        conflict.severity === 'critical' 
                          ? 'bg-red-50 border border-red-200' 
                          : 'bg-amber-50 border border-amber-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                          conflict.severity === 'critical' ? 'text-red-500' : 'text-amber-500'
                        }`} />
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {conflict.location} - {
                              conflict.type === 'stairCapacity' ? '楼梯容量' :
                              conflict.type === 'order' ? '顺序冲突' : '集合点容量'
                            }
                          </div>
                          <p className="text-sm text-slate-600">{conflict.description}</p>
                          <div className="text-xs text-slate-400 mt-1">发生时间: {formatTime(conflict.time)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-500" />
                优化建议
              </h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <ul className="space-y-2">
                  {generateRecommendations().map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="text-slate-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
