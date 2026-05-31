import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, FileText, AlertTriangle, Archive, Play } from 'lucide-react';
import { useClassroomStore } from '@/store/useClassroomStore';
import { formatTimestamp } from '@/utils/storage';

export const ClassroomList: React.FC = () => {
  const navigate = useNavigate();
  const { classrooms, getClassroomRecords, addClassroom } = useClassroomStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  const handleCreateClassroom = () => {
    if (!newClassName.trim()) return;
    const classroom = addClassroom(newClassName.trim());
    navigate(`/classroom/${classroom.id}`);
  };

  const getStats = (classroomId: string) => {
    const records = getClassroomRecords(classroomId);
    const anomalyCount = records.filter((r) => r.annotation?.anomalyType !== 'normal' && r.annotation).length;
    const supplementCount = records.filter((r) => r.materialType === 'supplement').length;
    const conclusionCount = records.filter((r) => r.materialType === 'conclusion_change').length;
    return { total: records.length, anomaly: anomalyCount, supplement: supplementCount, conclusion: conclusionCount };
  };

  return (
    <div className="min-h-screen bg-lab-bg p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-mono text-lab-accent mb-2">医学骨架标注</h1>
          <p className="text-sm text-lab-text-muted font-mono">课堂记录追溯系统</p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-mono text-lab-text">课堂列表</h2>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-lab-accent text-lab-bg text-sm font-mono flex items-center gap-2 hover:bg-lab-accent/90 transition-colors"
          >
            <Plus size={16} />
            创建课堂
          </button>
        </div>

        {showCreateForm && (
          <div className="mb-6 p-4 border-2 border-lab-accent bg-lab-card animate-slide-in">
            <h3 className="text-sm font-mono text-lab-accent mb-4">创建新课堂</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="输入课堂名称..."
                className="flex-1 p-2 bg-lab-bg border-2 border-lab-border text-lab-text text-sm font-mono focus:border-lab-accent focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateClassroom()}
                autoFocus
              />
              <button
                onClick={handleCreateClassroom}
                disabled={!newClassName.trim()}
                className="px-4 py-2 bg-lab-accent text-lab-bg text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border-2 border-lab-border text-lab-text text-sm font-mono hover:bg-lab-border/20"
              >
                取消
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {classrooms.length === 0 ? (
            <div className="text-center py-16 text-lab-text-muted">
              <FileText size={48} className="mx-auto mb-4 opacity-50" />
              <p className="font-mono text-sm">暂无课堂记录</p>
              <p className="font-mono text-xs mt-2">点击上方按钮创建新课堂</p>
            </div>
          ) : (
            classrooms.map((classroom) => {
              const stats = getStats(classroom.id);
              return (
                <div
                  key={classroom.id}
                  className="p-4 border-2 border-lab-border bg-lab-card hover:border-lab-accent transition-colors cursor-pointer"
                  onClick={() => navigate(`/classroom/${classroom.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-mono text-lab-text">{classroom.name}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-mono ${
                            classroom.status === 'active'
                              ? 'bg-lab-accent/20 text-lab-accent'
                              : 'bg-lab-text-muted/20 text-lab-text-muted'
                          }`}
                        >
                          {classroom.status === 'active' ? '进行中' : '已归档'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-lab-text-muted font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatTimestamp(classroom.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText size={12} />
                          {stats.total} 条记录
                        </span>
                        {stats.anomaly > 0 && (
                          <span className="flex items-center gap-1 text-lab-anomaly">
                            <AlertTriangle size={12} />
                            {stats.anomaly} 处异常
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-xs font-mono">
                        <div className="text-lab-supplement">补材料: {stats.supplement}</div>
                        <div className="text-lab-conclusion">改结论: {stats.conclusion}</div>
                      </div>
                      <div className="p-2 border-2 border-lab-border hover:border-lab-accent transition-colors">
                        <Play size={16} className="text-lab-text" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-8 p-4 border-2 border-lab-border bg-lab-card">
          <h3 className="text-sm font-mono text-lab-text-muted mb-3">图例说明</h3>
          <div className="grid grid-cols-4 gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-lab-supplement bg-lab-bg" />
              <span className="text-lab-text-muted">补材料 - 仅补充记录</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-lab-conclusion bg-lab-bg" />
              <span className="text-lab-text-muted">改结论 - 影响判定</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-lab-anomaly bg-lab-bg animate-pulse" />
              <span className="text-lab-text-muted">异常标注 - 需关注</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-lab-accent bg-lab-bg" />
              <span className="text-lab-text-muted">正常操作 - 无问题</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
