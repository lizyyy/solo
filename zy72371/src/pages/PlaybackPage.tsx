import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { 
  ArrowLeft, Play, Pause, AlertTriangle, CheckCircle, 
  Clock, User, FileText, Thermometer, RefreshCw,
  Edit3, Save, ArrowRightLeft, History as HistoryIcon,
  AlertOctagon, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAppStore } from '../store';
import { formatDate, formatTime, calculateCurveStats, generateFriendlyError } from '../utils';
import StatusBadge from '../components/StatusBadge';
import { BatchStatus } from '../types';

const PlaybackPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const preVersion = searchParams.get('preVersion');
  const { getBatchById, reviewBatch, supplementBatch, getThresholdVersions } = useAppStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(100);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [showRemarkDiff, setShowRemarkDiff] = useState(false);
  const [showProcessDetail, setShowProcessDetail] = useState<string | null>(null);

  const [reviewReason, setReviewReason] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [reviewNewRemark, setReviewNewRemark] = useState('');

  const [suppVersion, setSuppVersion] = useState('');
  const [suppOperator, setSuppOperator] = useState('质检员小白');
  const [suppNewRemark, setSuppNewRemark] = useState('');

  const batch = getBatchById(id || '');
  const oldVersions = getThresholdVersions().filter(v => !['v2024.01'].includes(v));

  useEffect(() => {
    if (isPlaying && playProgress < 100) {
      const timer = setInterval(() => {
        setPlayProgress(prev => Math.min(prev + 2, 100));
      }, 50);
      return () => clearInterval(timer);
    }
  }, [isPlaying, playProgress]);

  useEffect(() => {
    if (batch && batch.status === 'needs_supplement' && oldVersions.length > 0 && !suppVersion) {
      setSuppVersion(oldVersions[0]);
    }
    if (batch && (batch.status === 'pending_review' || batch.status === 'needs_supplement')) {
      setShowRemarkDiff(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch?.id]);

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
          if (point.originalTemp !== undefined) {
            html += `<div class="text-neutral-500 text-xs">改前温度: ${point.originalTemp}℃</div>`;
          }
          if (point.isAbnormal) {
            html += `<div class="text-danger mt-1">⚠️ 温度异常（超当前口径）</div>`;
          }
          if (point.isCorrected) {
            html += `<div class="text-warning mt-1">✏️ 已通过补录口径判定为正常</div>`;
          }
          return html;
        }
      },
      legend: {
        data: ['实际温度', '目标温度', '异常点(超新口径)', '补录/修正后正常点'],
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
        axisLabel: { fontSize: 11, rotate: 30 }
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
          lineStyle: { color: '#165DFF', width: 3 },
          itemStyle: { color: '#165DFF' },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
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
          lineStyle: { color: '#86909C', width: 2, type: 'dashed' },
          itemStyle: { color: '#86909C' }
        },
        {
          name: '异常点(超新口径)',
          type: 'scatter',
          data: displayPoints
            .filter(p => p.isAbnormal && !p.isCorrected)
            .map(p => [formatTime(p.timeIndex), p.temperature]),
          symbolSize: 18,
          itemStyle: { color: '#F53F3F' }
        },
        {
          name: '补录/修正后正常点',
          type: 'scatter',
          data: displayPoints
            .filter(p => p.isCorrected)
            .map(p => [formatTime(p.timeIndex), p.temperature]),
          symbolSize: 18,
          itemStyle: { color: '#722ED1' }
        }
      ]
    };
  };

  const handleReview = () => {
    if (reviewReason && reviewerName) {
      reviewBatch(batch.id, {
        reviewer: reviewerName,
        reason: reviewReason,
        newRemark: reviewNewRemark.trim() || undefined
      });
      setShowReviewModal(false);
      setReviewerName('');
      setReviewReason('');
      setReviewNewRemark('');
    }
  };

  const handleSupplement = () => {
    if (suppVersion && suppOperator) {
      supplementBatch(batch.id, {
        thresholdVersion: suppVersion,
        operator: suppOperator,
        supplementRemark: suppNewRemark
      });
      setShowSupplementModal(false);
      setSuppNewRemark('');
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
      remark_edit: <Edit3 className="w-4 h-4" />,
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
      remark_edit: 'bg-amber-100 text-amber-700',
      complete: 'bg-success/10 text-success'
    };
    return colors[action] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-neutral-500" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-neutral-700">{batch.name}</h2>
              <StatusBadge status={batch.status as BatchStatus} />
            </div>
            <p className="text-neutral-500 mt-1">
              材料类型: {batch.materialType} · 创建时间: {formatDate(batch.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {batch.status === 'pending_review' && (
            <button
              onClick={() => setShowReviewModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-warning text-white rounded-lg hover:bg-warning/90 transition-colors font-medium shadow-md shadow-warning/20"
            >
              <User className="w-4 h-4" />
              留给设备工程师复核
            </button>
          )}
          {batch.status === 'needs_supplement' && (
            <button
              onClick={() => setShowSupplementModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors font-medium shadow-md shadow-rose-500/20"
            >
              <Clock className="w-4 h-4" />
              去安全阈值表补录旧口径
            </button>
          )}
          <Link
            to="/threshold"
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Thermometer className="w-4 h-4" />
            查看安全阈值表
          </Link>
          <Link
            to="/history"
            className="flex items-center gap-2 px-5 py-2.5 border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
          >
            <HistoryIcon className="w-4 h-4" />
            核对历史记录
          </Link>
        </div>
      </div>

      {batch.status === 'pending_review' && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-5 animate-fade-in">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-warning-800 mb-1">需要设备工程师复核（未归为正常）</h4>
              <p className="text-sm text-warning-700">
                {generateFriendlyError('manual_correction_no_reason')}
              </p>
            </div>
            <button
              onClick={() => setShowReviewModal(true)}
              className="px-4 py-1.5 bg-warning text-white rounded-lg text-sm font-medium hover:bg-warning/90 transition-colors flex-shrink-0"
            >
              立即复核
            </button>
          </div>
        </div>
      )}

      {batch.status === 'needs_supplement' && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-5 animate-fade-in">
          <div className="flex items-start gap-4">
            <AlertOctagon className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-rose-800 mb-1">待补录：发现口径问题，需从安全阈值表补录旧口径</h4>
              <p className="text-sm text-rose-700">
                当前按新口径 <b>{batch.originalThresholdVersion}</b> 判定异常，但巡检备注提示为老配方产品。
                请点击下方按钮，选择旧口径（如 v2023.09）真实补录，之后状态将推进为"已补录"。
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Link
                to="/threshold"
                className="px-4 py-1.5 border border-rose-400 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-100 transition-colors"
              >
                先查阈值表
              </Link>
              <button
                onClick={() => setShowSupplementModal(true)}
                className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors"
              >
                立即补录
              </button>
            </div>
          </div>
        </div>
      )}

      {batch.status === 'supplemented' && (
        <div className="bg-supplemented/10 border border-supplemented/30 rounded-xl p-5 animate-fade-in">
          <div className="flex items-start gap-4">
            <Clock className="w-6 h-6 text-supplemented flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-supplemented mb-1">已补录历史口径 · 状态推进完成</h4>
              <p className="text-sm text-supplemented/80">
                原始口径: {batch.originalThresholdVersion} → 
                补录口径: {batch.appliedThresholdVersion} · 
                来源: {batch.supplementedFrom} · 
                操作人: {batch.supplementOperator} · 
                补录时间: {batch.supplementedAt && formatDate(batch.supplementedAt)}
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
          { label: '异常点数', value: stats.abnormalCount, color: stats.abnormalCount > 0 ? 'text-danger' : 'text-success' },
          { label: '补录判定正常点', value: stats.correctedCount, color: stats.correctedCount > 0 ? 'text-supplemented' : 'text-success' }
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-5 border border-neutral-200 animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
            <div className="text-sm text-neutral-500 mb-1">{stat.label}</div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-neutral-700">第二步 · 升温曲线（回放参数）</h3>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsPlaying(!isPlaying)} className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? '暂停' : '回放'}
            </button>
            <button onClick={() => setPlayProgress(0)} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
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
            <div className="h-full bg-primary rounded-full transition-all duration-100" style={{ width: `${playProgress}%` }} />
          </div>
        </div>

        <ReactECharts option={getChartOption()} style={{ height: '400px' }} opts={{ renderer: 'canvas' }} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-neutral-700 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              手写巡检备注 & 变更记录
            </h3>
            {(batch.remarkHistory.length > 0 || batch.originalRemark !== batch.remark) && (
              <button
                onClick={() => setShowRemarkDiff(!showRemarkDiff)}
                className="flex items-center gap-1 text-xs px-3 py-1 bg-neutral-100 rounded-lg text-neutral-600 hover:bg-neutral-200 transition-colors"
              >
                <ArrowRightLeft className="w-3 h-3" />
                {showRemarkDiff ? '收起对比' : '显示改前/改后'}
                {showRemarkDiff ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {showRemarkDiff && (batch.remarkHistory.length > 0 || batch.originalRemark !== batch.remark) ? (
            <div className="space-y-4">
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-neutral-100 text-xs font-semibold text-neutral-500 flex items-center gap-2">
                  <FileText className="w-3 h-3" />
                  改前（原始手写备注）
                </div>
                <div className="p-4 font-mono text-sm text-neutral-500 whitespace-pre-line bg-neutral-50/50 line-through opacity-80">
                  {batch.originalRemark}
                </div>
              </div>
              {batch.remarkHistory.map((h, i) => (
                <div key={h.id} className="space-y-2 animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                    <span>变更人: <b className="text-neutral-600">{h.operator}</b> · 原因: <b className="text-neutral-600">{h.reason}</b></span>
                    <span>{formatDate(h.timestamp)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-amber-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-1 bg-amber-50 text-xs font-semibold text-amber-700 flex items-center gap-1">
                        <ArrowRightLeft className="w-3 h-3" /> before
                      </div>
                      <div className="p-3 font-mono text-xs text-amber-800 whitespace-pre-line bg-amber-50/30">
                        {h.beforeRemark}
                      </div>
                    </div>
                    <div className="border border-green-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-1 bg-green-50 text-xs font-semibold text-green-700 flex items-center gap-1">
                        <Save className="w-3 h-3" /> after
                      </div>
                      <div className="p-3 font-mono text-xs text-green-800 whitespace-pre-line bg-green-50/30">
                        {h.afterRemark}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {batch.remarkHistory.length === 0 && batch.originalRemark !== batch.remark && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-amber-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-1 bg-amber-50 text-xs font-semibold text-amber-700">改前</div>
                    <div className="p-3 font-mono text-xs text-amber-800 whitespace-pre-line">{batch.originalRemark}</div>
                  </div>
                  <div className="border border-green-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-1 bg-green-50 text-xs font-semibold text-green-700">当前(改后)</div>
                    <div className="p-3 font-mono text-xs text-green-800 whitespace-pre-line">{batch.remark}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 font-mono text-sm text-amber-900 whitespace-pre-line">
              {batch.remark}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-neutral-100 text-sm text-neutral-500 space-y-1">
            <div className="flex justify-between"><span>数据来源</span><span className="text-neutral-700">{batch.source}</span></div>
            <div className="flex justify-between"><span>原始口径</span><span className="text-neutral-700">{batch.originalThresholdVersion ?? '-'}</span></div>
            <div className="flex justify-between"><span>应用口径</span><span className="text-neutral-700">{batch.appliedThresholdVersion ?? '-'}</span></div>
            {batch.reviewedBy && (
              <div className="flex justify-between"><span>复核人</span><span className="text-success font-medium">{batch.reviewedBy}</span></div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="font-semibold text-neutral-700 mb-4 flex items-center gap-2">
            <HistoryIcon className="w-5 h-5" />
            第三步 · 处理流程（状态推进时间轴）
          </h3>
          <div className="relative">
            {batch.processLogs.map((log, index) => (
              <div key={log.id} className="flex gap-4 pb-6 last:pb-0">
                <div className="relative flex flex-col items-center">
                  <button
                    onClick={() => setShowProcessDetail(showProcessDetail === log.id ? null : log.id)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${getActionColor(log.action)} transition-transform hover:scale-110`}
                  >
                    {getActionIcon(log.action)}
                  </button>
                  {index < batch.processLogs.length - 1 && (
                    <div className="w-0.5 h-full bg-neutral-200 absolute top-8" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-neutral-700 block">{log.description}</span>
                      <span className="text-xs text-neutral-500">操作人: {log.operator}</span>
                    </div>
                    <span className="text-xs text-neutral-400 whitespace-nowrap">{formatDate(log.timestamp)}</span>
                  </div>

                  {showProcessDetail === log.id && (log.beforeValue || log.afterValue) && (
                    <div className="mt-3 rounded-lg border border-neutral-200 overflow-hidden animate-fade-in">
                      <div className="px-3 py-1 bg-neutral-50 text-xs font-semibold text-neutral-500 border-b border-neutral-200">
                        字段变更审计 {log.fieldName && `· ${log.fieldName}`}
                      </div>
                      <div className="grid grid-cols-2">
                        <div className="p-3 border-r border-neutral-200 bg-rose-50/30">
                          <div className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider mb-1">Before</div>
                          <div className="text-xs text-rose-800 font-mono break-words">{log.beforeValue || '-'}</div>
                        </div>
                        <div className="p-3 bg-green-50/30">
                          <div className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">After</div>
                          <div className="text-xs text-green-800 font-mono break-words">{log.afterValue || '-'}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(log.beforeValue || log.afterValue) && showProcessDetail !== log.id && (
                    <button
                      onClick={() => setShowProcessDetail(log.id)}
                      className="mt-1 text-[11px] text-neutral-400 hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      点击查看字段改前/改后
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl animate-fade-in-up shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-neutral-700 mb-1">设备工程师复核</h3>
            <p className="text-sm text-neutral-500 mb-6">
              确认人工修正的原因，可选择同步修改巡检备注（将记录改前/改后）
            </p>

            <div className="mb-5 p-4 bg-warning/5 border border-warning/20 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-warning-700 uppercase tracking-wider mb-2">当前批次信息</div>
              <div className="text-sm text-neutral-700">
                <span className="text-neutral-500">批次名：</span><b>{batch.name}</b> · 
                <span className="text-neutral-500 ml-2">材料：</span><b>{batch.materialType}</b>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <div className="text-[10px] text-neutral-400 mb-1">当前巡检备注（可在下方修改）</div>
                  <div className="p-2 bg-white border border-warning/30 rounded-lg text-xs font-mono text-neutral-600 whitespace-pre-line h-20 overflow-y-auto">
                    {batch.remark}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 mb-1">原始手写备注（before）</div>
                  <div className="p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-mono text-neutral-500 whitespace-pre-line h-20 overflow-y-auto line-through opacity-70">
                    {batch.originalRemark}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">复核人姓名 *</label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="例如：设备工程师 张工"
                  className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">修正原因说明 *</label>
                <textarea
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="例如：因现场仪表波动，原始读数偏高，已按同批次历史数据人工下调至合理范围"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  修改巡检备注（可选，将在历史记录显示改前/改后）
                </label>
                <textarea
                  value={reviewNewRemark}
                  onChange={(e) => setReviewNewRemark(e.target.value)}
                  placeholder={`留空则不修改。建议格式：\n复核结论：已确认修正合理。原因为...  \n复核人：${reviewerName || '张工'}`}
                  rows={4}
                  className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-warning/20 focus:border-warning resize-none font-mono text-sm"
                />
                <div className="text-xs text-neutral-400 mt-1">
                  {reviewNewRemark ? (
                    <span className="text-warning">
                      ✓ 已填写，提交后将在备注变更记录中显示 before/after
                    </span>
                  ) : (
                    <span>留空则不改动巡检备注文本，只更新复核状态</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowReviewModal(false)}
                className="flex-1 px-5 py-2.5 border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
              >
                取消（不复核）
              </button>
              <button
                onClick={handleReview}
                disabled={!reviewReason || !reviewerName}
                className={`flex-1 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                  reviewReason && reviewerName
                    ? 'bg-success text-white hover:bg-success/90 shadow-md shadow-success/20'
                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                }`}
              >
                确认复核通过 · 状态→正常
              </button>
            </div>
          </div>
        </div>
      )}

      {showSupplementModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl animate-fade-in-up shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-neutral-700 mb-1">从安全阈值表补录旧口径</h3>
            <p className="text-sm text-neutral-500 mb-6">
              选择本批次老配方产品适用的历史口径版本，补录后将立即推进状态、重新判定异常点
            </p>

            <div className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-rose-700 uppercase tracking-wider mb-2">当前异常情况</div>
              <div className="text-sm text-neutral-700">
                <span className="text-neutral-500">当前口径：</span>
                <b className="text-rose-700">{batch.originalThresholdVersion}</b> · 
                <span className="text-neutral-500 ml-2">异常点：</span>
                <b className="text-rose-700">{stats.abnormalCount} 个</b> · 
                <span className="text-neutral-500 ml-2">当前状态：</span>
                <StatusBadge status={batch.status as BatchStatus} size="sm" />
              </div>
              <Link
                to="/threshold"
                target="_blank"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
              >
                打开安全阈值表（新窗口）对比温区上下限 →
              </Link>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  选择补录口径版本 *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {oldVersions.length > 0 ? oldVersions.map(v => (
                    <button
                      key={v}
                      onClick={() => setSuppVersion(v)}
                      className={`p-3 border-2 rounded-xl text-left transition-all ${
                        suppVersion === v
                          ? 'border-supplemented bg-supplemented/5 shadow-md'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-neutral-700">{v}</span>
                        {suppVersion === v && (
                          <CheckCircle className="w-4 h-4 text-supplemented" />
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">历史口径 · 老配方适用</div>
                    </button>
                  )) : (
                    <div className="col-span-2 p-3 bg-neutral-50 border border-dashed border-neutral-300 rounded-xl text-sm text-neutral-500">
                      没有历史版本，返回阈值表增加
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">补录操作人 *</label>
                <input
                  type="text"
                  value={suppOperator}
                  onChange={(e) => setSuppOperator(e.target.value)}
                  placeholder="例如：质检员小白"
                  className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-supplemented/20 focus:border-supplemented"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  更新巡检备注（可选，将在历史记录显示改前/改后）
                </label>
                <textarea
                  value={suppNewRemark}
                  onChange={(e) => setSuppNewRemark(e.target.value)}
                  placeholder={`留空则不修改。建议填写完整补录说明，如：\n经核对安全阈值表 ${suppVersion || 'v2023.09'} 旧口径，本批次为镁质瓷老配方产品，高温烧成区上限应为1260℃，原判定异常的2个温度点实际在范围内。补录人：${suppOperator}`}
                  rows={4}
                  className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-supplemented/20 focus:border-supplemented resize-none font-mono text-sm"
                />
                <div className="text-xs text-neutral-400 mt-1">
                  {suppNewRemark ? (
                    <span className="text-supplemented">
                      ✓ 已填写，提交后将在备注变更记录中显示 before/after
                    </span>
                  ) : (
                    <span>留空则不改动巡检备注文本，只补录口径信息和状态</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSupplementModal(false)}
                className="flex-1 px-5 py-2.5 border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
              >
                取消（不补录，先查阈值表）
              </button>
              <button
                onClick={handleSupplement}
                disabled={!suppVersion || !suppOperator}
                className={`flex-1 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                  suppVersion && suppOperator
                    ? 'bg-supplemented text-white hover:bg-supplemented/90 shadow-md shadow-supplemented/20'
                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                }`}
              >
                确认补录 · 状态→已补录 · 重判定异常点
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaybackPage;
