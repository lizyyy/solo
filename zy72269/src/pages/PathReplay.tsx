import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Map,
  List,
  ArrowRight,
  AlertTriangle,
  Database
} from 'lucide-react';
import { useAppStore } from '@/store';
import { generatePathPoints, interpolatePath, getHistoricalVersions, compareVersions } from '@/services/pathReplayService';
import type { PathPoint } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PipelineScene from '@/components/three/PipelineScene';
import MarkTable from '@/components/features/MarkTable';
import OriginalNoteDisplay from '@/components/ui/OriginalNoteDisplay';

export default function PathReplay() {
  const currentTask = useAppStore((state) => state.getCurrentTask());
  const selectedMarkId = useAppStore((state) => state.selectedMarkId);
  const selectMark = useAppStore((state) => state.selectMark);
  const pathPoints = useAppStore((state) => state.pathPoints);
  const setPathPoints = useAppStore((state) => state.setPathPoints);
  const replayTime = useAppStore((state) => state.replayTime);
  const setReplayTime = useAppStore((state) => state.setReplayTime);
  const isPlaying = useAppStore((state) => state.isPlaying);
  const setIsPlaying = useAppStore((state) => state.setIsPlaying);

  const [viewMode, setViewMode] = useState<'3d' | 'list'>('3d');
  const [compareVersion, setCompareVersion] = useState<string | null>(null);
  const [interpolatedPoints, setInterpolatedPoints] = useState<PathPoint[]>([]);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (currentTask && currentTask.marks.length > 0) {
      const points = generatePathPoints(currentTask.marks);
      setPathPoints(points);
      const interpolated = interpolatePath(points, 100);
      setInterpolatedPoints(interpolated);
    }
  }, [currentTask, setPathPoints]);

  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setReplayTime(prev => {
          const next = prev + 0.5;
          if (next > 100) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, setReplayTime, setIsPlaying]);

  const selectedMark = currentTask?.marks.find(m => m.id === selectedMarkId);

  const historicalVersions = currentTask ? getHistoricalVersions(currentTask.id) : [];

  if (!currentTask || currentTask.marks.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-mono text-2xl font-bold text-primary-100 tracking-wider">路径回放</h1>
        <Card className="text-center py-12">
          <Map size={64} className="mx-auto text-primary-500 mb-4" />
          <p className="text-primary-300 mb-6">暂无巡检数据，请先导入巡检标记</p>
          <Link to="/import">
            <Button variant="primary">前往导入</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-2xl font-bold text-primary-100 tracking-wider">路径回放</h1>
          <p className="font-mono text-sm text-primary-400 mt-1">
            共 {currentTask.marks.length} 个标记点，{pathPoints.length - 1} 段管线
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-primary-800/50 border border-primary-600">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-4 py-2 font-mono text-sm transition-colors ${
                viewMode === '3d' ? 'bg-primary-600 text-white' : 'text-primary-400 hover:text-primary-200'
              }`}
            >
              <Map size={16} className="inline mr-2" />
              3D视图
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 font-mono text-sm transition-colors ${
                viewMode === 'list' ? 'bg-primary-600 text-white' : 'text-primary-400 hover:text-primary-200'
              }`}
            >
              <List size={16} className="inline mr-2" />
              列表视图
            </button>
          </div>
          <select
            value={compareVersion || ''}
            onChange={(e) => setCompareVersion(e.target.value || null)}
            className="input-industrial text-xs max-w-[200px]"
          >
            <option value="">历史版本对比</option>
            {historicalVersions.map(v => (
              <option key={v.version} value={String(v.version)}>
                V{v.version} - {new Date(v.timestamp).toLocaleDateString('zh-CN')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {viewMode === '3d' ? (
            <Card className="p-0 overflow-hidden" style={{ height: '500px' }}>
              <PipelineScene
                pathPoints={interpolatedPoints}
                marks={currentTask.marks}
                selectedMarkId={selectedMarkId}
                onSelectMark={selectMark}
                currentTime={replayTime}
              />
            </Card>
          ) : (
            <Card>
              <MarkTable
                marks={currentTask.marks}
                selectedMarkId={selectedMarkId}
                onSelectMark={selectMark}
              />
            </Card>
          )}

          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="secondary"
                  onClick={() => { setReplayTime(0); setIsPlaying(false); }}
                >
                  <SkipBack size={16} />
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => { setReplayTime(100); setIsPlaying(false); }}
                >
                  <SkipForward size={16} />
                </Button>
              </div>
              <span className="font-mono text-sm text-primary-300">
                {Math.round(replayTime)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={replayTime}
              onChange={(e) => {
                setReplayTime(parseFloat(e.target.value));
                setIsPlaying(false);
              }}
              className="w-full h-2 bg-primary-800 rounded-none appearance-none cursor-pointer accent-primary-400"
            />
            <div className="flex justify-between mt-2">
              {currentTask.marks.sort((a, b) => a.sequenceNo - b.sequenceNo).map((mark, idx, arr) => (
                <div
                  key={mark.id}
                  className="relative"
                  style={{ left: `${(idx / (arr.length - 1)) * 100}%` }}
                >
                  <div
                    className={`absolute w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all hover:scale-150 ${
                      mark.isObstacle ? 'bg-accent-warning' : 'bg-primary-400'
                    }`}
                    onClick={() => selectMark(mark.id)}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="标记点详情">
            {selectedMark ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-mono text-xs text-primary-400 mb-1">序号</p>
                    <p className="font-mono text-xl font-bold text-primary-200">#{selectedMark.sequenceNo}</p>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-primary-400 mb-1">类型</p>
                    <Badge variant={selectedMark.isObstacle ? 'warning' : 'default'}>
                      {selectedMark.pipelineType}
                    </Badge>
                  </div>
                </div>
                <div className="bg-primary-800/50 p-4 border border-primary-700">
                  <p className="font-mono text-xs text-primary-400 mb-2">坐标</p>
                  <div className="grid grid-cols-3 gap-2 font-mono text-sm">
                    <div>
                      <span className="text-primary-400">X:</span>
                      <span className="text-primary-200 ml-1">{selectedMark.x.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-primary-400">Y:</span>
                      <span className="text-primary-200 ml-1">{selectedMark.y.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-primary-400">Z:</span>
                      <span className={`ml-1 ${selectedMark.z > 0 ? 'text-accent-warning' : 'text-primary-200'}`}>
                        {selectedMark.z.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {selectedMark.z > 0 && (
                    <p className="text-xs text-accent-warning mt-2 flex items-center gap-1">
                      <AlertTriangle size={12} /> Z轴可能按旧习惯写反
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-mono text-xs text-primary-400 mb-1">管径</p>
                    <p className="text-primary-200">{selectedMark.diameter || '-'}</p>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-primary-400 mb-1">障碍物</p>
                    <p className={selectedMark.isObstacle ? 'text-accent-warning' : 'text-primary-400'}>
                      {selectedMark.obstacleType || '无'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="font-mono text-xs text-primary-400 mb-1">材料类型</p>
                  <Badge variant={
                    selectedMark.materialType === 'normal' ? 'default' :
                    selectedMark.materialType === 'wrong_diameter' ? 'warning' : 'info'
                  }>
                    {{ normal: '正常材料', wrong_diameter: '错口径材料', supplementary: '补录材料' }[selectedMark.materialType]}
                  </Badge>
                </div>
                {selectedMark.originalNotes.length > 0 && (
                  <div>
                    <p className="font-mono text-xs text-primary-400 mb-2">原始备注</p>
                    <OriginalNoteDisplay notes={selectedMark.originalNotes} />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
              <Map size={32} className="mx-auto text-primary-500 mb-2" />
              <p className="text-primary-400">点击标记点查看详情</p>
            </div>
          )}
          </Card>

          <Card title="路径统计">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-primary-400 text-sm">总标记数</span>
                <span className="font-mono text-primary-200">{currentTask.marks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-400 text-sm">障碍物数量</span>
                <span className="font-mono text-accent-warning">{currentTask.marks.filter(m => m.isObstacle).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-400 text-sm">待处理冲突</span>
                <span className="font-mono text-accent-warning">{currentTask.conflicts.filter(c => c.status === 'pending').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-400 text-sm">待复核Z轴</span>
                <span className="font-mono text-accent-warning">{currentTask.abnormalities.filter(a => a.reviewStatus === 'pending').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-400 text-sm">自检通过</span>
                <span className="font-mono text-accent-success">{currentTask.selfCheckReports.filter(r => r.result === 'pass').length}</span>
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-primary-700">
              <Link to="/conflicts" className="block">
                <Button variant="warning" className="w-full justify-center">
                  处理冲突 <ArrowRight size={16} className="ml-2" />
                </Button>
              </Link>
            </div>
          </Card>

          {compareVersion && (
            <Card title="版本对比">
              <p className="text-sm text-primary-300 mb-3">
                当前版本与 V{compareVersion} 对比
              </p>
              {(() => {
                const currentMarks = currentTask.marks;
                const oldCount = historicalVersions.find(v => String(v.version) === compareVersion)?.markCount || 0;
                const diff = compareVersions([], currentMarks);
                return (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-primary-400">标记数变化</span>
                      <span className="font-mono text-primary-200">
                        {oldCount} → {currentMarks.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-accent-success">新增</span>
                      <span className="font-mono text-accent-success">+{diff.added.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-accent-warning">修改</span>
                      <span className="font-mono text-accent-warning">±{diff.modified.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-primary-400">删除</span>
                      <span className="font-mono text-primary-400">-{diff.removed.length}</span>
                    </div>
                  </div>
                );
              })()}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
