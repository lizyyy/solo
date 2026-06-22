import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Filter, Clock, AlertTriangle, Edit3 } from 'lucide-react';
import { SessionCard } from '@/components/history/SessionCard';
import { AuditTimeline } from '@/components/history/AuditTimeline';
import { DiffViewer } from '@/components/history/DiffViewer';
import { Button } from '@/components/common/Button';
import { useSessionStore } from '@/stores/useSessionStore';
import { useMaterialStore } from '@/stores/useMaterialStore';
import { useComputationStore } from '@/stores/useComputationStore';
import { useAuditStore } from '@/stores/useAuditStore';
import type { Session } from '@/types';

const HistoryPage: React.FC = () => {
  const { sessions, loadAllSessions, setCurrentSession } = useSessionStore();
  const { materials } = useMaterialStore();
  const { steps } = useComputationStore();
  const { logs: auditLogs, loadAllAuditLogs } = useAuditStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showDiffView, setShowDiffView] = useState<{
    materialName: string;
    versions: any[];
    fromVersion: number;
    toVersion: number;
  } | null>(null);

  useEffect(() => {
    loadAllSessions();
    loadAllAuditLogs();
  }, [loadAllSessions, loadAllAuditLogs]);

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = searchQuery
      ? session.id.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesStatus = filterStatus === 'all' || session.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getSessionStats = (sessionId: string) => {
    const sessionMaterials = materials.filter((m) => m.sessionId === sessionId);
    const sessionSteps = steps.filter((s) => s.sessionId === sessionId);
    const sessionLogs = auditLogs.filter((l) => l.sessionId === sessionId);
    const hasManualEdits = sessionLogs.some((l) => l.actionType === 'manual_edit');
    const hasSuspendedTasks = sessionLogs.some((l) => l.actionType === 'suspended_resolved' || l.actionType === 'caliber_change_detected');

    return {
      materialCount: sessionMaterials.length,
      stepCount: sessionSteps.length,
      hasManualEdits,
      hasSuspendedTasks,
    };
  };

  const handleViewSession = (session: Session) => {
    setSelectedSession(session);
    setCurrentSession(session);
  };

  const handleBackToWorkbench = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId) || null;
    setCurrentSession(session);
    window.location.href = '/';
  };

  const handleCheckCaliberChanges = (session: Session) => {
    const sessionMaterials = materials.filter((m) => m.sessionId === session.id);
    for (const material of sessionMaterials) {
      if (material.versions.length >= 2) {
        setShowDiffView({
          materialName: material.name,
          versions: material.versions,
          fromVersion: 1,
          toVersion: material.version,
        });
        break;
      }
    }
  };

  const statusFilters = [
    { value: 'all', label: '全部' },
    { value: 'draft', label: '草稿' },
    { value: 'computing', label: '计算中' },
    { value: 'suspended', label: '挂起' },
    { value: 'completed', label: '已完成' },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <div className="sticky top-0 z-40 bg-[#0d1117]/95 backdrop-blur border-b border-[#4a5568] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => (window.location.href = '/')}
            >
              返回工作台
            </Button>
            <h1 className="font-mono text-xl text-[#e2e8f0] tracking-wide">历史记录库</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#718096]" />
              <input
                type="text"
                placeholder="搜索会话ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-[#1a202c] border border-[#4a5568] rounded font-mono text-sm text-[#e2e8f0] focus:outline-none focus:border-[#3182ce] w-48"
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-[#718096]" />
              {statusFilters.map((filter) => (
                <Button
                  key={filter.value}
                  size="sm"
                  variant={filterStatus === filter.value ? 'primary' : 'ghost'}
                  onClick={() => setFilterStatus(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          {selectedSession ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ArrowLeft className="w-4 h-4" />}
                  onClick={() => setSelectedSession(null)}
                >
                  返回列表
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<AlertTriangle className="w-4 h-4" />}
                    onClick={() => handleCheckCaliberChanges(selectedSession)}
                  >
                    检查口径变更
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Edit3 className="w-4 h-4" />}
                    onClick={() => handleBackToWorkbench(selectedSession.id)}
                  >
                    继续编辑
                  </Button>
                </div>
              </div>

              <div className="p-6 bg-[#1a202c] border border-[#4a5568] rounded-lg">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-mono text-lg text-[#e2e8f0] mb-2">
                      会话详情 #{selectedSession.id.slice(0, 8)}
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-[#718096]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        创建于 {new Date(selectedSession.createdAt).toLocaleString('zh-CN')}
                      </span>
                      <span>状态: {selectedSession.status}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 bg-[#0d1117] rounded text-center">
                    <div className="font-mono text-xl text-[#63b3ed]">
                      {getSessionStats(selectedSession.id).materialCount}
                    </div>
                    <div className="text-xs text-[#718096] mt-1">材料</div>
                  </div>
                  <div className="p-3 bg-[#0d1117] rounded text-center">
                    <div className="font-mono text-xl text-[#68d391]">
                      {getSessionStats(selectedSession.id).stepCount}
                    </div>
                    <div className="text-xs text-[#718096] mt-1">计算步骤</div>
                  </div>
                  <div className="p-3 bg-[#0d1117] rounded text-center">
                    <div className="font-mono text-xl text-[#f6ad55]">
                      {selectedSession.progress.recoveryPoints}
                    </div>
                    <div className="text-xs text-[#718096] mt-1">还原点</div>
                  </div>
                  <div className="p-3 bg-[#0d1117] rounded text-center">
                    <div className="font-mono text-xl text-[#e2e8f0]">
                      {selectedSession.progress.completionPercentage.toFixed(0)}%
                    </div>
                    <div className="text-xs text-[#718096] mt-1">完成度</div>
                  </div>
                </div>
              </div>

              <AuditTimeline
                logs={auditLogs}
                sessionId={selectedSession.id}
              />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="mb-6 text-sm text-[#718096]">
                共 {filteredSessions.length} 个会话
              </div>

              {filteredSessions.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="font-mono text-[#718096]">暂无历史记录</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSessions.map((session) => {
                    const stats = getSessionStats(session.id);
                    return (
                      <SessionCard
                        key={session.id}
                        session={session}
                        materialCount={stats.materialCount}
                        stepCount={stats.stepCount}
                        hasManualEdits={stats.hasManualEdits}
                        hasSuspendedTasks={stats.hasSuspendedTasks}
                        onClick={() => handleViewSession(session)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {showDiffView && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 overflow-auto">
          <div className="w-full max-w-4xl">
            <DiffViewer
              materialName={showDiffView.materialName}
              versions={showDiffView.versions}
              fromVersion={showDiffView.fromVersion}
              toVersion={showDiffView.toVersion}
            />
            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={() => setShowDiffView(null)}>
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
