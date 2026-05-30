import { useState } from 'react';
import {
  Settings,
  AlertTriangle,
  GitBranch,
  ChevronDown,
  ChevronUp,
  Filter,
  ArrowRight,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  Loader,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useCollisionStore } from '../../stores/collisionStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import type { DetectionConfig, WorkflowStatus } from '../../types';
import {
  collisionTypeLabels,
  statusLabels,
  collisionColors,
} from '../../data/config';
import { cn } from '../../lib/utils';

export function RightPanel() {
  const collapsed = useUIStore((state) => state.rightPanelCollapsed);
  const activeTab = useUIStore((state) => state.rightPanelTab);
  const setActiveTab = useUIStore((state) => state.setRightPanelTab);

  if (collapsed) return null;

  return (
    <aside className="w-80 bg-slate-900/95 backdrop-blur border-l border-slate-700 flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-slate-700">
        <div className="flex bg-slate-800 rounded p-0.5">
          {[
            { key: 'config', label: '检测配置', icon: Settings },
            { key: 'results', label: '碰撞结果', icon: AlertTriangle },
            { key: 'workflow', label: '问题流转', icon: GitBranch },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium transition-all',
                activeTab === key
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              )}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'config' && <ConfigTab />}
        {activeTab === 'results' && <ResultsTab />}
        {activeTab === 'workflow' && <WorkflowTab />}
      </div>
    </aside>
  );
}

function ConfigTab() {
  const config = useCollisionStore((state) => state.config);
  const setConfig = useCollisionStore((state) => state.setConfig);
  const lastResult = useCollisionStore((state) => state.lastResult);
  const isDetecting = useCollisionStore((state) => state.isDetecting);

  const handleChange = (key: keyof DetectionConfig, value: any) => {
    setConfig({ [key]: value });
  };

  return (
    <div className="p-3 space-y-4">
      <div className="bg-slate-800/50 rounded-lg p-3">
        <h3 className="text-white text-xs font-medium mb-3 flex items-center gap-2">
          <Settings size={14} className="text-blue-400" />
          净距阈值设置 (米)
        </h3>

        <div className="space-y-3">
          {[
            { key: 'waterElectricMinDist', label: '给排水 ↔ 电缆', color: 'text-blue-400' },
            { key: 'waterGasMinDist', label: '给排水 ↔ 燃气', color: 'text-cyan-400' },
            { key: 'electricGasMinDist', label: '电缆 ↔ 燃气', color: 'text-orange-400' },
            { key: 'sameTypeMinDist', label: '同类管线', color: 'text-slate-400' },
            { key: 'elevationTolerance', label: '标高容差', color: 'text-yellow-400' },
          ].map(({ key, label, color }) => (
            <div key={key}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs ${color}`}>{label}</span>
                <span className="text-xs text-slate-300 font-mono">
                  {config[key as keyof DetectionConfig]}m
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={config[key as keyof DetectionConfig] as number}
                onChange={(e) => handleChange(key as keyof DetectionConfig, parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-3">
        <h3 className="text-white text-xs font-medium mb-3">数据处理</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.autoCorrectUnit}
            onChange={(e) => handleChange('autoCorrectUnit', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-xs text-slate-300">自动修正标高单位错误</span>
        </label>
      </div>

      {lastResult && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
          <h3 className="text-blue-400 text-xs font-medium mb-2">上次检测结果</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-800/50 rounded p-2">
              <div className="text-slate-500">检测管线</div>
              <div className="text-white font-mono">{lastResult.totalSegments} 段</div>
            </div>
            <div className="bg-slate-800/50 rounded p-2">
              <div className="text-slate-500">检测用时</div>
              <div className="text-white font-mono">{(lastResult.duration / 1000).toFixed(2)}s</div>
            </div>
            <div className="bg-slate-800/50 rounded p-2">
              <div className="text-slate-500">数据修正</div>
              <div className="text-orange-400 font-mono">{lastResult.correctedCount} 处</div>
            </div>
            <div className="bg-slate-800/50 rounded p-2">
              <div className="text-slate-500">跳过检测</div>
              <div className="text-red-400 font-mono">{lastResult.skippedCount} 处</div>
            </div>
          </div>
        </div>
      )}

      {isDetecting && (
        <div className="flex items-center justify-center gap-2 py-4 text-blue-400 text-xs">
          <Loader size={16} className="animate-spin" />
          正在执行碰撞检测...
        </div>
      )}
    </div>
  );
}

function ResultsTab() {
  const collisions = useCollisionStore((state) => state.collisions);
  const filteredCollisions = useCollisionStore((state) => state.getFilteredCollisions());
  const selectedCollision = useCollisionStore((state) => state.selectedCollision);
  const setSelectedCollision = useCollisionStore((state) => state.setSelectedCollision);
  const filterSeverity = useCollisionStore((state) => state.filterSeverity);
  const filterType = useCollisionStore((state) => state.filterType);
  const filterStatus = useCollisionStore((state) => state.filterStatus);
  const setFilterSeverity = useCollisionStore((state) => state.setFilterSeverity);
  const setFilterType = useCollisionStore((state) => state.setFilterType);
  const setFilterStatus = useCollisionStore((state) => state.setFilterStatus);
  const setShowCollisionModal = useUIStore((state) => state.setShowCollisionModal);
  const setRightPanelTab = useUIStore((state) => state.setRightPanelTab);

  const [showFilters, setShowFilters] = useState(true);

  const handleViewDetail = (collision: any) => {
    setSelectedCollision(collision);
    setShowCollisionModal(true);
  };

  const handleProcess = (collision: any) => {
    setSelectedCollision(collision);
    setRightPanelTab('workflow');
  };

  if (collisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-slate-500">
        <AlertTriangle size={40} className="mb-3 opacity-50" />
        <p className="text-sm">暂无碰撞检测结果</p>
        <p className="text-xs mt-1">点击上方"开始碰撞检测"按钮</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          共 <span className="text-white font-medium">{filteredCollisions.length}</span> 处碰撞
        </span>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
        >
          <Filter size={12} />
          筛选
          {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-3 gap-2">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">全部级别</option>
            <option value="critical">严重</option>
            <option value="warning">警告</option>
            <option value="info">提示</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">全部类型</option>
            <option value="intersect">管线交叉</option>
            <option value="distance">净距不足</option>
            <option value="duplicate">管线重叠</option>
            <option value="missing">数据缺项</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">全部状态</option>
            <option value="pending">待处理</option>
            <option value="processing">处理中</option>
            <option value="resolved">已解决</option>
            <option value="ignored">已忽略</option>
          </select>
        </div>
      )}

      <div className="space-y-2">
        {filteredCollisions.map((collision) => (
          <div
            key={collision.id}
            className={cn(
              'bg-slate-800/50 rounded-lg p-3 border transition-all cursor-pointer hover:bg-slate-800',
              selectedCollision?.id === collision.id
                ? 'border-blue-500 ring-1 ring-blue-500/30'
                : 'border-transparent'
            )}
            onClick={() => setSelectedCollision(
              selectedCollision?.id === collision.id ? null : collision
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: collisionColors[collision.severity] }}
                />
                <span className="text-xs font-medium text-white">
                  {collisionTypeLabels[collision.type] || collision.type}
                </span>
              </div>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded font-medium',
                  collision.status === 'pending' && 'bg-red-500/20 text-red-400',
                  collision.status === 'processing' && 'bg-yellow-500/20 text-yellow-400',
                  collision.status === 'resolved' && 'bg-green-500/20 text-green-400',
                  collision.status === 'ignored' && 'bg-slate-500/20 text-slate-400'
                )}
              >
                {statusLabels[collision.status]}
              </span>
            </div>

            <div className="text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-slate-500">位置:</span>
                <span className="text-slate-300">{collision.pileNo || '未知'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">净距:</span>
                <span
                  className={cn(
                    'font-mono',
                    collision.calculatedDistance < 0 ? 'text-red-400' :
                    collision.calculatedDistance < collision.requiredDistance ? 'text-orange-400' : 'text-green-400'
                  )}
                >
                  {collision.calculatedDistance.toFixed(3)}m
                </span>
                <span className="text-slate-500">/ ≥{collision.requiredDistance}m</span>
              </div>
              <div className="text-slate-500 truncate">
                {collision.segmentA.pipelineName.slice(0, 12)} ↔ {collision.segmentB.pipelineName.slice(0, 12)}
              </div>
            </div>

            {selectedCollision?.id === collision.id && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
                <button
                  onClick={(e) => { e.stopPropagation(); handleViewDetail(collision); }}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                >
                  查看详情
                  <ArrowRight size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleProcess(collision); }}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
                >
                  <GitBranch size={12} />
                  流转处理
                </button>
              </div>
            )}

            {collision.dataIssues.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <div className="text-[10px] text-orange-400 flex items-center gap-1">
                  <AlertTriangle size={10} />
                  关联 {collision.dataIssues.length} 处数据异常
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkflowTab() {
  const selectedCollision = useCollisionStore((state) => state.selectedCollision);
  const updateCollisionStatus = useCollisionStore((state) => state.updateCollisionStatus);
  const addRecord = useWorkflowStore((state) => state.addRecord);
  const getRecordsByCollision = useWorkflowStore((state) => state.getRecordsByCollision);
  const showNotification = useUIStore((state) => state.showNotification);

  const [handler, setHandler] = useState('张工');
  const [remark, setRemark] = useState('');
  const [newStatus, setNewStatus] = useState<WorkflowStatus>('processing');

  const records = selectedCollision ? getRecordsByCollision(selectedCollision.id) : [];

  const handleSubmit = () => {
    if (!selectedCollision || !remark.trim()) {
      showNotification('请填写处理意见', 'warning');
      return;
    }

    addRecord(
      selectedCollision.id,
      selectedCollision.status,
      newStatus as any,
      handler,
      remark
    );
    updateCollisionStatus(selectedCollision.id, newStatus as WorkflowStatus);

    showNotification('状态流转成功', 'success');
    setRemark('');
  };

  if (!selectedCollision) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-slate-500">
        <GitBranch size={40} className="mb-3 opacity-50" />
        <p className="text-sm">请先选择一个碰撞点</p>
        <p className="text-xs mt-1">在"碰撞结果"中点击碰撞点</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      <div className="bg-slate-800/50 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: collisionColors[selectedCollision.severity] }}
          />
          <span className="text-xs font-medium text-white">
            {collisionTypeLabels[selectedCollision.type]}
          </span>
          <span className="text-xs text-slate-500">@ {selectedCollision.pileNo}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-slate-700/50 rounded p-2">
            <div className="text-slate-500">当前状态</div>
            <div
              className={cn(
                'font-medium',
                selectedCollision.status === 'pending' && 'text-red-400',
                selectedCollision.status === 'processing' && 'text-yellow-400',
                selectedCollision.status === 'resolved' && 'text-green-400'
              )}
            >
              {statusLabels[selectedCollision.status]}
            </div>
          </div>
          <div className="bg-slate-700/50 rounded p-2">
            <div className="text-slate-500">净距</div>
            <div className="text-white font-mono">
              {selectedCollision.calculatedDistance.toFixed(3)}m
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-3">
        <h3 className="text-white text-xs font-medium mb-3">状态流转</h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">流转至</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'processing', label: '处理中', icon: Clock, color: 'text-yellow-400' },
                { value: 'resolved', label: '已解决', icon: CheckCircle2, color: 'text-green-400' },
                { value: 'ignored', label: '已忽略', icon: XCircle, color: 'text-slate-400' },
                { value: 'pending', label: '待处理', icon: AlertTriangle, color: 'text-red-400' },
              ].map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  onClick={() => setNewStatus(value as WorkflowStatus)}
                  className={cn(
                    'flex items-center justify-center gap-1 py-1.5 rounded text-xs border transition-all',
                    newStatus === value
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                      : 'bg-slate-700/50 border-transparent text-slate-400 hover:text-white'
                  )}
                >
                  <Icon size={12} className={color} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">
              <User size={12} className="inline mr-1" />
              责任人
            </label>
            <input
              type="text"
              value={handler}
              onChange={(e) => setHandler(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">处理意见</label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="请输入巡检备注和处理意见..."
              rows={3}
              className="w-full px-2.5 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!remark.trim()}
            className={cn(
              'w-full py-2 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5',
              remark.trim()
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            )}
          >
            <ArrowRight size={12} />
            确认流转
          </button>
        </div>
      </div>

      {records.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg p-3">
          <h3 className="text-white text-xs font-medium mb-3">处理记录</h3>
          <div className="space-y-3">
            {records.map((record, index) => (
              <div key={record.id} className="relative pl-4 pb-3 border-l border-slate-700 last:pb-0">
                <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-slate-600 border-2 border-slate-800" />
                <div className="text-[11px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-slate-300 font-medium">{record.handler}</span>
                    <span className="text-slate-500">→</span>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px]',
                        record.toStatus === 'processing' && 'bg-yellow-500/20 text-yellow-400',
                        record.toStatus === 'resolved' && 'bg-green-500/20 text-green-400',
                        record.toStatus === 'ignored' && 'bg-slate-500/20 text-slate-400'
                      )}
                    >
                      {statusLabels[record.toStatus]}
                    </span>
                  </div>
                  <p className="text-slate-400 mb-1">{record.remark}</p>
                  <p className="text-slate-500 text-[10px]">
                    {new Date(record.timestamp).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
