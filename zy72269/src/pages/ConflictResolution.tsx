import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Filter, ArrowRight, FileText } from 'lucide-react';
import { useAppStore } from '@/store';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ConflictCard from '@/components/features/ConflictCard';
import { getConflictTypeLabel, getConflictStatusLabel, filterConflicts } from '@/services/conflictDetectionService';
import type { ConflictType, ConflictStatus } from '@/types';

export default function ConflictResolution() {
  const currentTask = useAppStore((state) => state.getCurrentTask());
  const [filterStatus, setFilterStatus] = useState<ConflictStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<ConflictType | 'all'>('all');

  if (!currentTask) {
    return (
      <div className="space-y-6">
        <h1 className="font-mono text-2xl font-bold text-primary-100 tracking-wider">冲突处理</h1>
        <Card className="text-center py-12">
          <AlertTriangle size={64} className="mx-auto text-primary-500 mb-4" />
          <p className="text-primary-300 mb-6">请先选择或创建一个巡检任务</p>
          <Link to="/">
            <Button variant="primary">返回首页</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const conflicts = currentTask.conflicts;
  const pendingConflicts = conflicts.filter(c => c.status === 'pending');
  const resolvedConflicts = conflicts.filter(c => c.status !== 'pending');

  const filteredConflicts = filterConflicts(conflicts, {
    status: filterStatus === 'all' ? undefined : filterStatus,
    type: filterType === 'all' ? undefined : filterType
  });

  const conflictTypes: Array<{ value: ConflictType | 'all'; label: string }> = [
    { value: 'all', label: '全部类型' },
    { value: 'obstacle_mismatch', label: '障碍物不匹配' },
    { value: 'position_mismatch', label: '位置不匹配' },
    { value: 'diameter_mismatch', label: '管径不匹配' }
  ];

  const statusOptions: Array<{ value: ConflictStatus | 'all'; label: string }> = [
    { value: 'all', label: '全部状态' },
    { value: 'pending', label: '待处理' },
    { value: 'confirmed', label: '已确认' },
    { value: 'rejected', label: '已驳回' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-2xl font-bold text-primary-100 tracking-wider">冲突处理</h1>
          <p className="font-mono text-sm text-primary-400 mt-1">
            共 {conflicts.length} 条冲突，{pendingConflicts.length} 条待处理
          </p>
        </div>
        <Badge variant="default">
          {currentTask.taskNo} - {currentTask.projectName}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 text-center">
          <AlertTriangle size={32} className="mx-auto text-accent-warning mb-2" />
          <p className="font-mono text-2xl font-bold text-accent-warning">{pendingConflicts.length}</p>
          <p className="text-sm text-primary-400">待处理冲突</p>
        </Card>
        <Card className="p-4 text-center">
          <CheckCircle2 size={32} className="mx-auto text-accent-success mb-2" />
          <p className="font-mono text-2xl font-bold text-accent-success">{resolvedConflicts.length}</p>
          <p className="text-sm text-primary-400">已处理冲突</p>
        </Card>
        <Card className="p-4 text-center">
          <FileText size={32} className="mx-auto text-primary-400 mb-2" />
          <p className="font-mono text-2xl font-bold text-primary-200">
            {conflicts.filter(c => c.decision?.engineerName === '许工').length}
          </p>
          <p className="text-sm text-primary-400">许工已裁决</p>
        </Card>
      </div>

      <div className="bg-primary-800/30 border-2 border-accent-warning/30 p-4 mb-6">
        <h4 className="font-mono text-sm text-accent-warning mb-2 flex items-center gap-2">
          <AlertTriangle size={16} /> 重要业务规则
        </h4>
        <ul className="text-sm text-primary-300 space-y-1">
          <li>• 系统仅列示冲突证据，<span className="text-accent-warning">不自动裁决</span></li>
          <li>• 必须由<span className="text-accent-warning">设备工程师许工</span>手动选择"确认"或"驳回"</li>
          <li>• 所有裁决记录<span className="text-accent-success">永久保留</span>，可追溯操作人和操作时间</li>
          <li>• 障碍物备注和楼层剖面草图矛盾时，列出冲突证据，让许工选确认或驳回</li>
        </ul>
      </div>

      <Card
        title="筛选条件"
        className="mb-6"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-primary-400" />
            <span className="text-sm text-primary-400">状态：</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ConflictStatus | 'all')}
              className="input-industrial text-xs w-40"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-primary-400">类型：</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ConflictType | 'all')}
              className="input-industrial text-xs w-40"
            >
              {conflictTypes.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {pendingConflicts.length > 0 && filterStatus === 'all' && (
        <div className="mb-8">
          <h3 className="font-mono text-lg font-semibold text-accent-warning mb-4 flex items-center gap-2">
            <AlertTriangle size={20} /> 待处理冲突
          </h3>
          {pendingConflicts
            .filter(c => filterType === 'all' || c.conflictType === filterType)
            .map(conflict => {
              const mark = currentTask.marks.find(m => m.id === conflict.markId);
              const sketch = currentTask.sketches.find(s => s.id === conflict.sketchId);
              return (
                <ConflictCard
                  key={conflict.id}
                  conflict={conflict}
                  markSequenceNo={mark?.sequenceNo}
                  sketchFloorLevel={sketch?.floorLevel}
                />
              );
            })}
        </div>
      )}

      {resolvedConflicts.length > 0 && (filterStatus === 'all' || filterStatus !== 'pending') && (
        <div>
          <h3 className="font-mono text-lg font-semibold text-primary-300 mb-4 flex items-center gap-2">
            <CheckCircle2 size={20} /> 已处理冲突
          </h3>
          {filteredConflicts
            .filter(c => c.status !== 'pending')
            .map(conflict => {
              const mark = currentTask.marks.find(m => m.id === conflict.markId);
              const sketch = currentTask.sketches.find(s => s.id === conflict.sketchId);
              return (
                <ConflictCard
                  key={conflict.id}
                  conflict={conflict}
                  markSequenceNo={mark?.sequenceNo}
                  sketchFloorLevel={sketch?.floorLevel}
                />
              );
            })}
        </div>
      )}

      {filteredConflicts.length === 0 && (
        <Card className="text-center py-12">
          <CheckCircle2 size={64} className="mx-auto text-accent-success mb-4" />
          <p className="text-primary-300 mb-2">暂无符合条件的冲突记录</p>
          <p className="text-sm text-primary-400">
            {conflicts.length === 0
              ? '系统尚未检测到障碍物备注与楼层剖面草图的冲突'
              : '请调整筛选条件查看其他冲突'
            }
          </p>
        </Card>
      )}

      {pendingConflicts.length === 0 && conflicts.length > 0 && (
        <div className="flex justify-end mt-6">
          <Link to="/abnormal">
            <Button variant="primary">
              进入Z轴复核 <ArrowRight size={16} className="ml-2" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
