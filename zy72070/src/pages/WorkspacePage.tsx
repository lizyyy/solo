import { useNavigate } from 'react-router-dom';
import { useAppStore, useDevices, useConflicts } from '@/store/useAppStore';
import { FLOORS } from '@/types';
import { ParamsPanel } from '@/components/params/ParamsPanel';
import { SceneCanvas } from '@/components/canvas/SceneCanvas';
import { DeviceTable } from '@/components/table/DeviceTable';
import { ConflictList } from '@/components/conflicts/ConflictList';
import { ArrowLeft, FileText, Save, Layers } from 'lucide-react';

export function WorkspacePage() {
  const navigate = useNavigate();
  const devices = useDevices();
  const conflicts = useConflicts();
  const { project, view, setView, setProject } = useAppStore((state) => ({
    project: state.project,
    view: state.view,
    setView: state.setView,
    setProject: state.setProject,
  }));

  const floors = Array.from(new Set(devices.map(d => d.floor))).sort();

  const normalCount = devices.filter(d => d.status === 'normal').length;
  const warningCount = devices.filter(d => d.status === 'warning').length;
  const errorCount = devices.filter(d => d.status === 'error').length;
  const pendingCount = devices.filter(d => d.status === 'pending').length;
  const unresolvedConflicts = conflicts.filter(c => !c.resolved).length;

  const handleSave = () => {
    setProject({ updatedAt: new Date().toISOString() });
    alert('方案已保存！');
  };

  if (devices.length === 0) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">暂无数据，请先导入或加载样例数据</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-accent-blue text-white rounded"
          >
            返回导入页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      <header className="h-14 bg-bg-secondary border-b border-border-subtle flex items-center px-4 gap-4 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-bg-tertiary rounded transition-colors"
          title="返回"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-text-primary truncate">{project.name}</h1>
          <p className="text-xs text-text-muted truncate">
            操作人员: {project.operator} · 最后更新: {new Date(project.updatedAt).toLocaleString('zh-CN')}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent-green" />
              {normalCount} 正常
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent-yellow" />
              {warningCount} 待确认
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent-red" />
              {errorCount} 异常
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-text-muted" />
              {pendingCount} 未处理
            </span>
            <span className="text-text-muted">|</span>
            <span className="text-accent-yellow">{unresolvedConflicts} 冲突待解决</span>
          </div>
        </div>

        <div className="h-6 w-px bg-border-subtle" />

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-3 py-1.5 bg-accent-blue/20 text-accent-blue hover:bg-accent-blue/30 rounded text-sm transition-colors"
        >
          <Save className="w-4 h-4" />
          保存方案
        </button>

        <button
          onClick={() => navigate('/report')}
          className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary hover:bg-border-subtle rounded text-sm text-text-primary transition-colors"
        >
          <FileText className="w-4 h-4" />
          查看报告
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 flex-shrink-0">
          <ParamsPanel />
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="h-10 bg-bg-secondary border-b border-border-subtle flex items-center px-3 gap-2 flex-shrink-0">
            <Layers className="w-4 h-4 text-text-muted" />
            <div className="flex items-center gap-1">
              {floors.map((floor) => (
                <button
                  key={floor}
                  onClick={() => setView({ currentFloor: floor })}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    view.currentFloor === floor
                      ? 'bg-accent-blue text-white'
                      : 'bg-bg-tertiary text-text-secondary hover:bg-border-subtle'
                  }`}
                  style={{
                    borderLeft: view.currentFloor === floor ? `3px solid ${FLOORS[floor as keyof typeof FLOORS]?.color || '#64748B'}` : undefined,
                  }}
                >
                  {FLOORS[floor as keyof typeof FLOORS]?.name || floor}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <div className="text-xs text-text-muted font-mono">
              缩放: {(view.zoom * 100).toFixed(0)}% · 旋转: {view.rotation}°
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <SceneCanvas />
          </div>

          <ConflictList />
        </main>

        <aside className="w-80 flex-shrink-0">
          <DeviceTable />
        </aside>
      </div>
    </div>
  );
}
