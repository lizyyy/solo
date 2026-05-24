import React, { useState } from 'react';
import { Users, Layers, AlertTriangle, CheckCircle, Clock, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { useSimulationStore } from '@/store/simulationStore';
import ReactECharts from 'echarts-for-react';

const DataPanel: React.FC = () => {
  const selectedPlan = useSimulationStore(state => state.selectedPlan);
  const statistics = useSimulationStore(state => state.statistics);
  const conflicts = useSimulationStore(state => state.conflicts);
  const students = useSimulationStore(state => state.students);
  const [expandedSection, setExpandedSection] = useState<string | null>('statistics');
  
  if (!selectedPlan) return null;
  
  const waitingCount = students.filter(s => s.status === 'waiting').length;
  const movingCount = students.filter(s => s.status === 'moving').length;
  const inStairCount = students.filter(s => s.status === 'inStair').length;
  const arrivedCount = students.filter(s => s.status === 'arrived').length;
  
  const statusChartOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}人 ({d}%)'
    },
    series: [{
      type: 'pie',
      radius: ['50%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 4,
        borderColor: '#1e293b',
        borderWidth: 2
      },
      label: {
        show: false
      },
      data: [
        { value: waitingCount, name: '等待中', itemStyle: { color: '#64748b' } },
        { value: movingCount, name: '移动中', itemStyle: { color: '#3b82f6' } },
        { value: inStairCount, name: '楼梯中', itemStyle: { color: '#f59e0b' } },
        { value: arrivedCount, name: '已到达', itemStyle: { color: '#22c55e' } }
      ]
    }]
  };
  
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };
  
  const formatTime = (seconds: number): string => {
    if (seconds === 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}分${secs}秒`;
  };
  
  return (
    <div className="absolute top-14 right-0 bottom-20 w-80 bg-slate-900/90 backdrop-blur-sm border-l border-slate-700 overflow-y-auto z-10">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-white font-semibold text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          实时数据
        </h2>
        <p className="text-slate-400 text-sm mt-1">{selectedPlan.name}</p>
      </div>
      
      <div className="border-b border-slate-700">
        <button
          onClick={() => toggleSection('statistics')}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
        >
          <span className="text-white font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            统计概览
          </span>
          {expandedSection === 'statistics' ? 
            <ChevronUp className="w-4 h-4 text-slate-400" /> : 
            <ChevronDown className="w-4 h-4 text-slate-400" />
          }
        </button>
        
        {expandedSection === 'statistics' && (
          <div className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-slate-400 text-xs">总人数</div>
                <div className="text-white text-xl font-bold">{statistics.totalStudents}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-slate-400 text-xs">已疏散</div>
                <div className="text-green-400 text-xl font-bold">{statistics.evacuatedStudents}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-slate-400 text-xs">平均用时</div>
                <div className="text-white text-xl font-bold">{formatTime(statistics.avgEvacuationTime)}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-slate-400 text-xs">最长用时</div>
                <div className="text-white text-xl font-bold">{formatTime(statistics.maxEvacuationTime)}</div>
              </div>
            </div>
            
            <div className="h-40">
              <ReactECharts 
                option={statusChartOption} 
                style={{ height: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>
            
            <div className="flex justify-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-slate-500" />
                <span className="text-slate-400">等待</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span className="text-slate-400">移动</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-500" />
                <span className="text-slate-400">楼梯</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span className="text-slate-400">到达</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="border-b border-slate-700">
        <button
          onClick={() => toggleSection('stairs')}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
        >
          <span className="text-white font-medium flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            楼梯状态
          </span>
          {expandedSection === 'stairs' ? 
            <ChevronUp className="w-4 h-4 text-slate-400" /> : 
            <ChevronDown className="w-4 h-4 text-slate-400" />
          }
        </button>
        
        {expandedSection === 'stairs' && (
          <div className="px-4 pb-4 space-y-3">
            {selectedPlan.stairs.map(stair => {
              const usage = statistics.stairUtilization[stair.id] || 0;
              const usagePercentValue = usage * 100;
              const usagePercent = usagePercentValue.toFixed(0);
              let color = 'bg-green-500';
              if (usage >= 0.9) color = 'bg-red-500';
              else if (usage >= 0.7) color = 'bg-amber-500';
              
              return (
                <div key={stair.id} className="bg-slate-800 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white text-sm font-medium">{stair.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      stair.isClosed ? 'bg-slate-600 text-slate-300' : 
                      usage >= 0.9 ? 'bg-red-500/20 text-red-400' : 
                      usage >= 0.7 ? 'bg-amber-500/20 text-amber-400' : 
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {stair.isClosed ? '已关闭' : `${usagePercent}%`}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${color} transition-all duration-300`}
                      style={{ width: `${Math.min(usagePercentValue, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    容量: {stair.capacity}人
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <div className="border-b border-slate-700">
        <button
          onClick={() => toggleSection('conflicts')}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
        >
          <span className="text-white font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            冲突告警
            {conflicts.filter(c => !c.resolved).length > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {conflicts.filter(c => !c.resolved).length}
              </span>
            )}
          </span>
          {expandedSection === 'conflicts' ? 
            <ChevronUp className="w-4 h-4 text-slate-400" /> : 
            <ChevronDown className="w-4 h-4 text-slate-400" />
          }
        </button>
        
        {expandedSection === 'conflicts' && (
          <div className="px-4 pb-4 space-y-2">
            {conflicts.filter(c => !c.resolved).length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">暂无冲突告警</p>
              </div>
            ) : (
              conflicts.filter(c => !c.resolved).map(conflict => (
                <div 
                  key={conflict.id}
                  className={`rounded-lg p-3 ${
                    conflict.severity === 'critical' 
                      ? 'bg-red-500/10 border border-red-500/30' 
                      : 'bg-amber-500/10 border border-amber-500/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      conflict.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                    }`} />
                    <div>
                      <div className={`text-sm font-medium ${
                        conflict.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {conflict.location}
                      </div>
                      <p className="text-slate-300 text-xs mt-1">{conflict.description}</p>
                      <div className="text-slate-500 text-xs mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {formatTime(conflict.time)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      
      <div>
        <button
          onClick={() => toggleSection('classrooms')}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
        >
          <span className="text-white font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            班级进度
          </span>
          {expandedSection === 'classrooms' ? 
            <ChevronUp className="w-4 h-4 text-slate-400" /> : 
            <ChevronDown className="w-4 h-4 text-slate-400" />
          }
        </button>
        
        {expandedSection === 'classrooms' && (
          <div className="px-4 pb-4 space-y-2 max-h-64 overflow-y-auto">
            {selectedPlan.classrooms.map(classroom => {
              const completion = statistics.classroomCompletion[classroom.id] || 0;
              const completionPercent = (completion * 100).toFixed(0);
              
              return (
                <div key={classroom.id} className="bg-slate-800 rounded-lg p-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white text-xs">{classroom.name}</span>
                    <span className="text-slate-400 text-xs">{completionPercent}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataPanel;
