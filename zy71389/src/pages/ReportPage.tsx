import React, { useState, useMemo } from 'react';
import {
  FileBarChart,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PieChart,
  Activity,
  Zap
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { PageHeader, Card, EmptyState } from '../components/layout/MainLayout';
import { MetricCard, MetricsComparison } from '../components/common/MetricCard';
import { ContaminationBadge } from '../components/common/StatusBadge';
import { DataTable } from '../components/common/LogViewer';
import { useCheckStore } from '../stores/checkStore';
import { useFileStore } from '../stores/fileStore';
import { MetricRecalculationEngine } from '../engines/MetricRecalculationEngine';
import { ConsistencyCheckEngine } from '../engines/ConsistencyCheckEngine';
import { ContaminationType, ExposureLog, Metrics } from '../types';
import { formatNumber, formatPercent, formatTimestamp, formatCurrency } from '../utils/format';
import { Link } from 'react-router-dom';

export const ReportPage: React.FC = () => {
  const { checkResult, getExposuresArray } = useCheckStore();
  const { userBuckets, exposureLogs, operationChanges, conversionData } = useFileStore();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'phases' | 'groups' | 'contamination'>('overview');
  const [showPhaseDetails, setShowPhaseDetails] = useState(false);
  
  const hasResult = checkResult !== null;
  const markedExposures = getExposuresArray();
  
  const consistencyReport = useMemo(() => {
    if (!checkResult || markedExposures.length === 0) return null;
    return ConsistencyCheckEngine.performConsistencyCheck(
      markedExposures,
      conversionData,
      checkResult!
    );
  }, [checkResult, markedExposures, conversionData]);
  
  const contaminationTypeData = useMemo(() => {
    if (!checkResult) return [];
    return [
      { name: '用户串组', value: checkResult.crossGroupCount, color: '#ef4444' },
      { name: '重复曝光', value: checkResult.duplicateExposureCount, color: '#f59e0b' },
      { name: '配置变更', value: checkResult.configChangeCount, color: '#6366f1' },
      { name: '正常', value: checkResult.totalExposures - checkResult.contaminatedCount, color: '#10b981' }
    ].filter(d => d.value > 0);
  }, [checkResult]);
  
  const timeSeriesData = useMemo(() => {
    if (markedExposures.length === 0) return [];
    const timeSeries = MetricRecalculationEngine.calculateTimeSeriesMetrics(
      markedExposures,
      conversionData,
      360
    );
    return timeSeries.slice(0, 12).map((m, i) => {
      const originalMetrics = MetricRecalculationEngine.calculateMetrics(
        markedExposures.filter(e => 
          e.exposureTime >= m.timestamp && 
          e.exposureTime < m.timestamp + 360 * 60 * 1000
        ),
        conversionData,
        false
      );
      return {
        name: `T${i + 1}`,
        原始: Number((originalMetrics.conversionRate * 100).toFixed(2)),
        修正: Number((m.metrics.conversionRate * 100).toFixed(2)),
        曝光数: m.exposureCount
      };
    });
  }, [markedExposures, conversionData]);
  
  const phaseData = useMemo(() => {
    if (!checkResult?.phaseResults) return [];
    return checkResult.phaseResults.map((p, i) => ({
      name: `阶段 ${i + 1}`,
      转化率: Number((p.metrics.conversionRate * 100).toFixed(2)),
      曝光数: p.exposureCount,
      转化数: p.metrics.totalConversions,
      总金额: Math.round(p.metrics.totalValue),
      start: formatTimestamp(p.startTime, 'MM-DD HH:mm'),
      end: formatTimestamp(p.endTime, 'MM-DD HH:mm'),
      configVersion: p.configVersion
    }));
  }, [checkResult]);
  
  const contaminatedExposures = useMemo(() => {
    return markedExposures
      .filter(e => e.isContaminated)
      .slice(0, 50);
  }, [markedExposures]);
  
  const groupComparisonData = useMemo(() => {
    if (markedExposures.length === 0) return [];
    const groupIds = [...new Set(markedExposures.map(e => e.groupId))];
    
    return groupIds.map(groupId => {
      const groupExposures = markedExposures.filter(e => e.groupId === groupId);
      const original = MetricRecalculationEngine.calculateMetrics(groupExposures, conversionData, false);
      const corrected = MetricRecalculationEngine.calculateMetrics(groupExposures, conversionData, true);
      
      const userBucket = userBuckets.find(b => b.groupId === groupId);
      
      return {
        name: userBucket?.groupName || groupId,
        original,
        corrected
      };
    });
  }, [markedExposures, conversionData, userBuckets]);
  
  const experimentTimeRange = useMemo(() => {
    if (markedExposures.length === 0) return { startTime: 0, endTime: 0 };
    const sorted = [...markedExposures].sort((a, b) => a.exposureTime - b.exposureTime);
    return {
      startTime: sorted[0]?.exposureTime || 0,
      endTime: sorted[sorted.length - 1]?.exposureTime || 0
    };
  }, [markedExposures]);
  
  const duplicateAffectedUsers = useMemo(() => {
    const duplicateExposures = markedExposures.filter(e => e.contaminationType === ContaminationType.DUPLICATE_EXPOSURE);
    return new Set(duplicateExposures.map(e => e.userId)).size;
  }, [markedExposures]);
  
  const columns = [
    {
      key: 'exposureId',
      header: '曝光ID',
      width: '100px'
    },
    {
      key: 'userId',
      header: '用户ID',
      width: '100px'
    },
    {
      key: 'groupId',
      header: '分组',
      width: '80px'
    },
    {
      key: 'contaminationType',
      header: '污染类型',
      width: '120px',
      render: (row: ExposureLog) => <ContaminationBadge type={row.contaminationType} />
    },
    {
      key: 'exposureTime',
      header: '曝光时间',
      width: '160px',
      render: (row: ExposureLog) => formatTimestamp(row.exposureTime)
    },
    {
      key: 'configVersion',
      header: '配置版本',
      width: '80px'
    },
    {
      key: 'contaminationReason',
      header: '污染原因',
      render: (row: ExposureLog) => (
        <span className="text-xs text-gray-500">{row.contaminationReason || '-'}</span>
      )
    }
  ];
  
  if (!hasResult) {
    return (
      <div>
        <PageHeader
          title="报告总览"
          description="查看污染检查结果报告，包括整体统计、分阶段指标、分组对比等"
          breadcrumbs={[{ label: '首页', path: '/' }, { label: '报告总览' }]}
        />
        <Card>
          <EmptyState
            icon={<FileBarChart className="w-12 h-12" />}
            title="暂无检查结果"
            description="请先执行污染检查，检查完成后即可查看详细报告"
            action={
              <Link
                to="/check"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                <Zap className="w-4 h-4" />
                去检查
              </Link>
            }
          />
        </Card>
      </div>
    );
  }
  
  return (
    <div>
      <PageHeader
        title="报告总览"
        description="查看污染检查结果报告，包括整体统计、分阶段指标、分组对比等"
        breadcrumbs={[{ label: '首页', path: '/' }, { label: '报告总览' }]}
        actions={
          <Link
            to="/export"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            导出报告
          </Link>
        }
      />
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="总曝光数"
          value={checkResult.totalExposures}
          icon={<Eye className="w-5 h-5" />}
          color="primary"
        />
        <MetricCard
          title="污染记录"
          value={checkResult.contaminatedCount}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={checkResult.contaminatedCount > 0 ? 'danger' : 'success'}
        />
        <MetricCard
          title="污染率"
          value={checkResult.contaminationRate}
          format="percent"
          decimals={2}
          icon={<Activity className="w-5 h-5" />}
          color={checkResult.contaminationRate > 0.05 ? 'danger' : checkResult.contaminationRate > 0.01 ? 'warning' : 'success'}
        />
        <MetricCard
          title="一致性校验"
          value={consistencyReport?.isConsistent ? '通过' : '失败'}
          icon={consistencyReport?.isConsistent ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          color={consistencyReport?.isConsistent ? 'success' : 'danger'}
        />
      </div>
      
      {/* Check Info */}
      <Card className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">检查时间</p>
            <p className="text-sm font-medium text-gray-900">{formatTimestamp(checkResult.processedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">实验周期</p>
            <p className="text-sm font-medium text-gray-900">
              {formatTimestamp(experimentTimeRange.startTime, 'MM-DD')} ~ {formatTimestamp(experimentTimeRange.endTime, 'MM-DD')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">阶段数</p>
            <p className="text-sm font-medium text-gray-900">{checkResult.phaseResults?.length || 0} 个阶段</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">数据校验和</p>
            <p className="text-sm font-mono text-gray-900">{checkResult.consistencyChecksum?.substring(0, 16)}...</p>
          </div>
        </div>
      </Card>
      
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {[
            { key: 'overview', label: '总览', icon: <BarChart3 className="w-4 h-4" /> },
            { key: 'phases', label: '阶段分析', icon: <Calendar className="w-4 h-4" /> },
            { key: 'groups', label: '分组对比', icon: <Users className="w-4 h-4" /> },
            { key: 'contamination', label: '污染明细', icon: <AlertTriangle className="w-4 h-4" /> }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Metrics Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricsComparison
              title="转化率"
              originalValue={checkResult.originalMetrics.conversionRate}
              correctedValue={checkResult.recalculatedMetrics.conversionRate}
              format="percent"
              decimals={2}
            />
            <MetricsComparison
              title="平均转化值"
              originalValue={checkResult.originalMetrics.averageValue}
              correctedValue={checkResult.recalculatedMetrics.averageValue}
              format="currency"
              decimals={0}
            />
            <MetricsComparison
              title="总转化值"
              originalValue={checkResult.originalMetrics.totalValue}
              correctedValue={checkResult.recalculatedMetrics.totalValue}
              format="currency"
              decimals={0}
            />
          </div>
          
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="转化率趋势对比" subtitle="原始转化率 vs 修正转化率">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" unit="%" />
                    <Tooltip formatter={(value: number) => [`${value}%`]} />
                    <Legend />
                    <Line type="monotone" dataKey="原始" stroke="#9ca3af" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="修正" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            
            <Card title="污染类型分布" subtitle="按污染类型统计">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={contaminationTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {contaminationTypeData.map((entry, index) => (
                        <Cell key={'cell-' + index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [formatNumber(value), '数量']} />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          
          {/* Operation Changes Timeline */}
          {operationChanges.length > 0 && (
            <Card title="运营变更时间线" subtitle={`${operationChanges.length} 次配置变更`}>
              <div className="space-y-4">
                {operationChanges.map((change, index) => (
                  <div key={change.changeId} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-warning-100 text-warning-600 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      {index < operationChanges.length - 1 && (
                        <div className="w-0.5 h-full bg-gray-200 mt-1"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{change.changeDescription}</span>
                        <span className="text-xs px-2 py-0.5 bg-warning-100 text-warning-700 rounded-full">
                          {change.changeType === 'traffic' ? '流量调整' :
                           change.changeType === 'config' ? '配置变更' :
                           change.changeType === 'group' ? '分组调整' : change.changeType}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        {formatTimestamp(change.changeTime)} · 操作人: {change.operator}
                      </p>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-gray-500">
                          <span className="line-through">{change.oldValue}</span>
                          <span className="mx-2">→</span>
                          <span className="font-medium text-primary-600">{change.newValue}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
      
      {activeTab === 'phases' && (
        <div className="space-y-6">
          {/* Phase Metrics Chart */}
          <Card title="各阶段转化率对比">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={phaseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" unit="%" />
                  <Tooltip formatter={(value: number) => [`${value}%`, '转化率']} />
                  <Bar dataKey="转化率" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          
          {/* Phase Details */}
          <Card
            title="阶段详情"
            subtitle={`${phaseData.length} 个阶段`}
            actions={
              <button
                onClick={() => setShowPhaseDetails(!showPhaseDetails)}
                className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
              >
                {showPhaseDetails ? '收起' : '展开全部'}
                {showPhaseDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            }
          >
            <div className="space-y-4 mt-4">
              {(showPhaseDetails ? phaseData : phaseData.slice(0, 3)).map((phase, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{phase.name}</h4>
                      <p className="text-xs text-gray-500">
                        {phase.start} ~ {phase.end}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded">
                      {phase.configVersion}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">曝光数</p>
                      <p className="text-lg font-semibold font-mono text-gray-900">{formatNumber(phase.曝光数)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">转化数</p>
                      <p className="text-lg font-semibold font-mono text-success-600">{formatNumber(phase.转化数)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">转化率</p>
                      <p className="text-lg font-semibold font-mono text-primary-600">{formatPercent(phase.转化率 / 100, 2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">总金额</p>
                      <p className="text-lg font-semibold font-mono text-gray-900">{formatCurrency(phase.总金额)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
      
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Group Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {groupComparisonData.map((group, index) => (
              <Card key={index} title={`${group.name} - 指标对比`}>
                <div className="space-y-4">
                  <MetricsComparison
                    title="转化率"
                    originalValue={group.original.conversionRate}
                    correctedValue={group.corrected.conversionRate}
                    format="percent"
                    decimals={2}
                  />
                  <MetricsComparison
                    title="平均转化值"
                    originalValue={group.original.averageValue}
                    correctedValue={group.corrected.averageValue}
                    format="currency"
                    decimals={0}
                  />
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">曝光数</p>
                      <p className="text-lg font-semibold font-mono text-gray-900">
                        {formatNumber(group.corrected.uniqueUsers)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">转化数</p>
                      <p className="text-lg font-semibold font-mono text-success-600">
                        {formatNumber(group.corrected.totalConversions)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          
          {/* Lift Analysis */}
          {groupComparisonData.length >= 2 && (
            <Card title="组间差异分析" subtitle="实验组 vs 对照组">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['转化率', '平均转化值', '总转化值'].map((metric, i) => {
                  const expGroup = groupComparisonData[0];
                  const ctrlGroup = groupComparisonData[1];
                  
                  const getValue = (g: typeof expGroup, type: 'original' | 'corrected') => {
                    if (metric === '转化率') return type === 'original' ? g.original.conversionRate : g.corrected.conversionRate;
                    if (metric === '平均转化值') return type === 'original' ? g.original.averageValue : g.corrected.averageValue;
                    return type === 'original' ? g.original.totalValue : g.corrected.totalValue;
                  };
                  
                  const originalLift = getValue(expGroup, 'original') - getValue(ctrlGroup, 'original');
                  const correctedLift = getValue(expGroup, 'corrected') - getValue(ctrlGroup, 'corrected');
                  const isPercent = metric === '转化率';
                  
                  return (
                    <div key={i} className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-900 mb-3">{metric}</p>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">原始提升</span>
                          <span className={`text-sm font-semibold font-mono ${originalLift >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                            {originalLift >= 0 ? '+' : ''}{isPercent ? formatPercent(originalLift, 2) : formatCurrency(originalLift)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">修正提升</span>
                          <span className={`text-sm font-semibold font-mono ${correctedLift >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                            {correctedLift >= 0 ? '+' : ''}{isPercent ? formatPercent(correctedLift, 2) : formatCurrency(correctedLift)}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${correctedLift >= 0 ? 'bg-success-500' : 'bg-danger-500'}`}
                            style={{ width: `${Math.min(Math.abs(correctedLift) * 10, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}
      
      {activeTab === 'contamination' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card title="用户串组">
              <div className="text-center py-2">
                <p className="text-3xl font-bold font-mono text-danger-600">{formatNumber(checkResult.crossGroupCount)}</p>
                <p className="text-sm text-gray-500 mt-1">条串组 · 影响 {formatNumber(checkResult.crossGroupCount)} 条曝光</p>
              </div>
            </Card>
            <Card title="重复曝光">
              <div className="text-center py-2">
                <p className="text-3xl font-bold font-mono text-warning-600">{formatNumber(checkResult.duplicateExposureCount)}</p>
                <p className="text-sm text-gray-500 mt-1">条重复曝光 · 涉及 {formatNumber(duplicateAffectedUsers)} 个用户</p>
              </div>
            </Card>
            <Card title="配置变更">
              <div className="text-center py-2">
                <p className="text-3xl font-bold font-mono text-primary-600">{formatNumber(checkResult.configChangeCount)}</p>
                <p className="text-sm text-gray-500 mt-1">条受变更影响 · 切分 {checkResult.phaseResults?.length || 0} 个阶段</p>
              </div>
            </Card>
          </div>
          
          {/* Contamination List */}
          <Card
            title="污染记录明细"
            subtitle={`${contaminatedExposures.length} 条污染记录 (Top 50)`}
            actions={
              <Link
                to="/details"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                查看详情
              </Link>
            }
          >
            <DataTable
              columns={columns}
              data={contaminatedExposures}
              rowKey="exposureId"
              emptyMessage="暂无污染记录"
              rowClassName={(row) => row.isContaminated ? 'bg-danger-50/30' : ''}
            />
          </Card>
        </div>
      )}
    </div>
  );
};
