import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { 
  ArrowLeft, Play, Pause, AlertTriangle, CheckCircle, 
  Clock, User, FileText, Thermometer, RefreshCw 
} from 'lucide-react';
import { useAppStore } from '../store';
import { formatDate, formatTime, calculateCurveStats, generateFriendlyError } from '../utils';
import StatusBadge from '../components/StatusBadge';
import { BatchStatus } from '../types';

const PlaybackPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getBatchById, reviewBatch } = useAppStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(100);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewerName, setReviewerName] = useState('');

  const batch = getBatchById(id || '');

  useEffect(() => {
    if (isPlaying && playProgress < 100) {
      const timer = setInterval(() => {
        setPlayProgress(prev => Math.min(prev + 2, 100));
      }, 50);
      return () => clearInterval(timer);
    }
  }, [isPlaying, playProgress]);

  if (!batch) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="w-16 h-16 text-warning mb-4" />
        <h3 className="text-xl font-semibold text-neutral-700 mb-2">批次未找到</h3>
        <p className="text-neutral-500 mb-6">{generateFriendlyError('batch_not_found')}</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          返回首页
        </button>
      </div>
    );
  }

  const stats = calculateCurveStats(batch.temperaturePoints);
  const visiblePoints = Math.floor(batch.temperaturePoints.length * playProgress / 100);

  const getChartOption = () => {
    const displayPoints = batch.temperaturePoints.slice(0, visiblePoints);
    
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const data = params[0];
          const point = batch.temperaturePoints[data.dataIndex];
          let html = `<div class="font-semibold mb-1">第${formatTime(point.timeIndex)}</div>`;
          html += `<div>实际温度: <span class="text-primary font-bold">${point.temperature}℃</span></div>`;
          html += `<div>目标温度: ${point.targetTemp}℃</div>`;
          if (point.isAbnormal) {
            html += `<div class="text-danger mt-1">⚠️ 温度异常</div>`;
          }
          if (point.isCorrected) {
            html += `<div class="text-warning mt-1">✏️ 已人工修正</div>`;
          }
          return html;
        }
      },
      legend: {
        data: ['实际温度', '目标温度', '异常点', '修正点'],
        bottom: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        name: '时间',
        nameLocation: 'middle',
        nameGap: 25,
        data: displayPoints.map(p => formatTime(p.timeIndex)),
        axisLabel: {
          fontSize: 11,
          rotate: 30
        }
      },
      yAxis: {
        type: 'value',
        name: '温度 (℃)',
        nameLocation: 'middle',
        nameGap: 45,
        min: 200,
        max: 1350
      },
      series: [
        {
          name: '实际温度',
          type: 'line',
          data: displayPoints.map(p => p.temperature),
          smooth: true,
          lineStyle: {
            color: '#165DFF',
            width: 3
          },
          itemStyle: {
            color: '#165DFF'
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(22, 93, 255, 0.3)' },
                { offset: 1, color: 'rgba(22, 93, 255, 0.05)' }
              ]
            }
          }
        },
        {
          name: '目标温度',
          type: 'line',
          data: displayPoints.map(p => p.targetTemp),
          smooth: true,
          lineStyle: {
            color: '#86909C',
            width: 2,
            type: 'dashed'
          },
          itemStyle: {
            color: '#86909C'
          }
        },
        {
          name: '异常点',
          type: 'scatter',
          data: displayPoints
            .filter(p => p.isAbnormal && !p.isCorrected)
            .map(p => [formatTime(p.timeIndex), p.temperature]),
          symbolSize: 15,
          itemStyle: {
            color: '#F53F3F'
          }
        },
        {
          name: '修正点',
          type: 'scatter',
          data: displayPoints
            .filter(p => p.isCorrected)
            .map(p => [formatTime(p.timeIndex), p.temperature]),
          symbolSize: 15,
          itemStyle: {
            color: '#FF7D00'
          }
        }
      ]
    };
  };

  const handleReview = () => {
    if (reviewReason && reviewerName) {
      reviewBatch(batch.id, reviewerName, reviewReason);
      setShowReviewModal(false);
    }
  };

  const getActionIcon = (action: string) => {
    const icons: Record<string, React.ReactNode> = {
      import: <FileText className="w-4 h-4" />,
      auto_parse: <RefreshCw className="w-4 h-4" />,
      manual_correction: <AlertTriangle className="w-4 h-4" />,
      threshold_check: <Thermometer className="w-4 h-4" />,
      supplement: <Clock className="w-4 h-4" />,
      review: <User className="w-4 h-4" />,
      complete: <CheckCircle className="w-4 h-4" />
    };
    return icons[action] || <FileText className="w-4 h-4" />;
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      import: 'bg-blue-100 text-blue-600',
      auto_parse: 'bg-gray-100 text-gray-600',
      manual_correction: 'bg-warning/10 text-warning',
      threshold_check: 'bg-purple-100 text-purple-600',
      supplement: 'bg-supplemented/10 text-supplemented',
      review: 'bg-green-100 text-green-600',
      complete: 'bg-success/10 text-success'
    };
    return colors[action] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-500" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-neutral-700">{batch.name}</h2>
              <StatusBadge status={batch.status as BatchStatus} />
            </div>
            <p className="text-neutral-500 mt-1">
              材料类型: {batch.materialType} · 创建时间: {formatDate(batch.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {batch.status === 'pending_review' && (
            <button
              onClick={() => setShowReviewModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-warning text-white rounded-lg hover:bg-warning/90 transition-colors font-medium"
            >
              <User className="w-4 h-4" />
              设备工程师复核
            </button>
          )}
          <button
            onClick={() => navigate('/threshold')}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Thermometer className="w-4 h-4" />
            查看安全阈值表
          </button>
        </div>
      </div>

      {batch.status === 'pending_review' && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-5 animate-fade-in">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-warning-800 mb-1">需要设备工程师复核</h4>
              <p className="text-sm text-warning-700">
                {generateFriendlyError('manual_correction_no_reason')}
              </p>
            </div>
          </div>
        </div>
      )}

      {batch.status === 'supplemented' && (
        <div className="bg-supplemented/10 border border-supplemented/30 rounded-xl p-5 animate-fade-in">
          <div className="flex items-start gap-4">
            <Clock className="w-6 h-6 text-supplemented flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-supplemented mb-1">已补录历史口径</h4>
              <p className="text-sm text-supplemented/80">
                数据来源: {batch.supplementedFrom} · 补录时间: {batch.supplementedAt && formatDate(batch.supplementedAt)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: '最高温度', value: `${stats.maxTemp}℃`, color: 'text-danger' },
          { label: '最低温度', value: `${stats.minTemp}℃`, color: 'text-primary' },
          { label: '平均温度', value: `${stats.avgTemp}℃`, color: 'text-neutral-600' },
          { label: '异常点数', value: stats.abnormalCount, color: stats.abnormalCount > 0 ? 'text-warning' : 'text-success' },
          { label: '修正点数', value: stats.correctedCount, color: stats.correctedCount > 0 ? 'text-warning' : 'text-success' }
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-5 border border-neutral-200 animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
            <div className="text-sm text-neutral-500 mb-1">{stat.label}</div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-neutral-700">升温曲线</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? '暂停' : '回放'}
            </button>
            <button
              onClick={() => setPlayProgress(0)}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-neutral-500" />
            </button>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
            <span>回放进度</span>
            <span>{playProgress}%</span>
          </div>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-100"
              style={{ width: `${playProgress}%` }}
            />
          </div>
        </div>

        <ReactECharts 
          option={getChartOption()} 
          style={{ height: '400px' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="font-semibold text-neutral-700 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            手写巡检备注
          </h3>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 font-mono text-sm text-amber-900 whitespace-pre-line">
            {batch.remark}
          </div>
          <div className="mt-4 pt-4 border-t border-neutral-100 text-sm text-neutral-500">
            <div className="flex justify-between">
              <span>数据来源</span>
              <span className="text-neutral-700">{batch.source}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="font-semibold text-neutral-700 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            处理流程
          </h3>
          <div className="relative">
            {batch.processLogs.map((log, index) => (
              <div key={log.id} className="flex gap-4 pb-6 last:pb-0">
                <div className="relative flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getActionColor(log.action)}`}>
                    {getActionIcon(log.action)}
                  </div>
                  {index < batch.processLogs.length - 1 && (
                    <div className="w-0.5 h-full bg-neutral-200 absolute top-8" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-neutral-700">{log.description}</span>
                    <span className="text-xs text-neutral-400">{formatDate(log.timestamp)}</span>
                  </div>
                  <span className="text-sm text-neutral-500">操作人: {log.operator}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-fade-in-up">
            <h3 className="text-xl font-bold text-neutral-700 mb-4">设备工程师复核</h3>
            <p className="text-sm text-neutral-500 mb-6">
              请确认人工修正的原因并完成复核
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  复核人姓名
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="请输入您的姓名"
                  className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  修正原因说明
                </label>
                <textarea
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="请说明人工修正的原因"
                  rows={4}
                  className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowReviewModal(false)}
                className="flex-1 px-5 py-2.5 border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
              >
                取消
              </button>
              <button
                onClick={handleReview}
                disabled={!reviewReason || !reviewerName}
                className={`
                  flex-1 px-5 py-2.5 rounded-lg font-medium transition-colors
                  ${reviewReason && reviewerName
                    ? 'bg-success text-white hover:bg-success/90'
                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                  }
                `}
              >
                确认复核通过
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaybackPage;
