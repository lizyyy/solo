import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, CheckCircle2, AlertTriangle, ArrowRight, Database } from 'lucide-react';
import { useAppStore } from '@/store';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ZAxisAbnormalCard from '@/components/features/ZAxisAbnormalCard';
import { getReviewStatusLabel, getZAxisExplanation, calculateZScore } from '@/services/zAxisDetectionService';
import type { ReviewStatus } from '@/types';

export default function ZAxisReview() {
  const currentTask = useAppStore((state) => state.getCurrentTask());
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | 'all'>('all');

  const explanation = getZAxisExplanation();

  if (!currentTask) {
    return (
      <div className="space-y-6">
        <h1 className="font-mono text-2xl font-bold text-primary-100 tracking-wider">Z轴异常复核</h1>
        <Card className="text-center py-12">
          <Compass size={64} className="mx-auto text-primary-500 mb-4" />
          <p className="text-primary-300 mb-6">请先选择或创建一个巡检任务</p>
          <Link to="/">
            <Button variant="primary">返回首页</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const abnormalities = currentTask.abnormalities;
  const pendingAbnormalities = abnormalities.filter(a => a.reviewStatus === 'pending');
  const reviewedAbnormalities = abnormalities.filter(a => a.reviewStatus !== 'pending');
  const zScore = calculateZScore(currentTask.marks);

  const filteredAbnormalities = filterStatus === 'all'
    ? abnormalities
    : abnormalities.filter(a => a.reviewStatus === filterStatus);

  const statusOptions: Array<{ value: ReviewStatus | 'all'; label: string }> = [
    { value: 'all', label: '全部状态' },
    { value: 'pending', label: '待复核' },
    { value: 'approved', label: '复核通过' },
    { value: 'corrected', label: '已修正' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-2xl font-bold text-primary-100 tracking-wider">Z轴异常复核</h1>
          <p className="font-mono text-sm text-primary-400 mt-1">
            共 {abnormalities.length} 条异常，{pendingAbnormalities.length} 条待现场班组复核
          </p>
        </div>
        <Badge variant="default">
          {currentTask.taskNo} - {currentTask.projectName}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 text-center">
          <p className="font-mono text-xs text-primary-400 mb-1">Z轴合格率</p>
          <p className={`font-mono text-3xl font-bold ${zScore.score >= 90 ? 'text-accent-success' : zScore.score >= 70 ? 'text-accent-warning' : 'text-accent-warning'}`}>
            {zScore.score}%
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-mono text-xs text-primary-400 mb-1">总标记数</p>
          <p className="font-mono text-3xl font-bold text-primary-200">{zScore.total}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-mono text-xs text-primary-400 mb-1">正常Z轴</p>
          <p className="font-mono text-3xl font-bold text-accent-success">{zScore.normal}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-mono text-xs text-primary-400 mb-1">可疑Z轴</p>
          <p className={`font-mono text-3xl font-bold ${zScore.suspicious > 0 ? 'text-accent-warning animate-pulse' : 'text-accent-success'}`}>
            {zScore.suspicious}
          </p>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-mono text-sm font-semibold text-primary-300 mb-3">坐标系说明</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-accent-warning/20 border border-accent-warning/50 flex items-center justify-center flex-shrink-0">
                  <span className="font-mono text-accent-warning text-xs">旧</span>
                </div>
                <div>
                  <p className="font-mono text-sm text-accent-warning">{explanation.oldConvention}</p>
                  <p className="text-xs text-primary-400">Z轴向下为正，与深度测量习惯一致</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-accent-success/20 border border-accent-success/50 flex items-center justify-center flex-shrink-0">
                  <span className="font-mono text-accent-success text-xs">新</span>
                </div>
                <div>
                  <p className="font-mono text-sm text-accent-success">{explanation.newConvention}</p>
                  <p className="text-xs text-primary-400">Z轴向上为正，与楼层标高系统一致</p>
                </div>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-mono text-sm font-semibold text-primary-300 mb-3">处理规则</h4>
            <div className="bg-accent-warning/10 border-2 border-accent-warning/30 p-4">
              <ul className="text-sm text-primary-300 space-y-2">
                <li className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-accent-warning mt-0.5 flex-shrink-0" />
                  <span>系统检测到Z轴可能写反时，<strong className="text-accent-warning">仅标记待复核</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-accent-warning mt-0.5 flex-shrink-0" />
                  <span><strong className="text-accent-warning">不自动修正</strong>坐标，必须现场确认</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-accent-warning mt-0.5 flex-shrink-0" />
                  <span>复核记录需包含：班组人员签字、现场照片、复核时间</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-accent-success mt-0.5 flex-shrink-0" />
                  <span>中间碰到Z轴写反时，别急着归正常，留给现场班组复核</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="筛选条件"
        className="mb-6"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Compass size={16} className="text-primary-400" />
            <span className="text-sm text-primary-400">状态：</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ReviewStatus | 'all')}
              className="input-industrial text-xs w-40"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {pendingAbnormalities.length > 0 && filterStatus === 'all' && (
        <div className="mb-8">
          <h3 className="font-mono text-lg font-semibold text-accent-warning mb-4 flex items-center gap-2">
            <AlertTriangle size={20} /> 待复核异常
            <span className="text-sm font-normal text-primary-400 ml-2">
              请联系现场班组到现场复核确认
            </span>
          </h3>
          {pendingAbnormalities
            .filter(a => filterStatus === 'all' || a.reviewStatus === filterStatus)
            .map(abnormal => {
              const mark = currentTask.marks.find(m => m.id === abnormal.markId);
              return (
                <ZAxisAbnormalCard
                  key={abnormal.id}
                  abnormal={abnormal}
                  mark={mark}
                />
              );
            })}
        </div>
      )}

      {reviewedAbnormalities.length > 0 && (filterStatus === 'all' || filterStatus !== 'pending') && (
        <div>
          <h3 className="font-mono text-lg font-semibold text-primary-300 mb-4 flex items-center gap-2">
            <CheckCircle2 size={20} /> 已复核记录
          </h3>
          {filteredAbnormalities
            .filter(a => a.reviewStatus !== 'pending')
            .map(abnormal => {
              const mark = currentTask.marks.find(m => m.id === abnormal.markId);
              return (
                <ZAxisAbnormalCard
                  key={abnormal.id}
                  abnormal={abnormal}
                  mark={mark}
                />
              );
            })}
        </div>
      )}

      {filteredAbnormalities.length === 0 && (
        <Card className="text-center py-12">
          <CheckCircle2 size={64} className="mx-auto text-accent-success mb-4" />
          <p className="text-primary-300 mb-2">
            {abnormalities.length === 0
              ? '系统未检测到Z轴方向异常'
              : '暂无符合条件的异常记录'
            }
          </p>
          {abnormalities.length === 0 && (
            <p className="text-sm text-primary-400">
              所有 {currentTask.marks.length} 条巡检标记的Z轴方向均符合新标准
            </p>
          )}
        </Card>
      )}

      {pendingAbnormalities.length === 0 && abnormalities.length > 0 && (
        <div className="flex justify-end mt-6">
          <Link to="/self-check">
            <Button variant="primary">
              进入自检中心 <ArrowRight size={16} className="ml-2" />
            </Button>
          </Link>
        </div>
      )}

      {abnormalities.length === 0 && currentTask.marks.length > 0 && (
        <div className="flex justify-end mt-6 gap-4">
          <Button variant="secondary" onClick={() => { /* 可添加重新检测逻辑 */ }}>
            <Database size={16} className="mr-2" /> 重新检测Z轴
          </Button>
          <Link to="/self-check">
            <Button variant="primary">
              进入自检中心 <ArrowRight size={16} className="ml-2" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
