import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  TrendingDown,
  Users,
  DollarSign,
  FileDiff,
  ArrowRight,
  Eye,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Lightbulb,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import Card from '@/components/Card';
import Table from '@/components/Table';
import Loading from '@/components/Loading';
import ErrorState from '@/components/ErrorState';
import Modal from '@/components/Modal';
import Tabs from '@/components/Tabs';
import { RiskBadge } from '@/components/StatusBadge';
import { riskService } from '@/services/riskService';
import { caseService } from '@/services/caseService';
import { cn } from '@/lib/utils';
import type {
  RiskDashboardStats,
  RegressionAnalysis,
  VersionCompareResult,
  BusinessDataType,
  STATUS_LABELS,
} from '../../shared/types';
import { DATA_TYPE_LABELS } from '../../shared/types';

export default function RiskAnalysis() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<RiskDashboardStats | null>(null);
  const [regressionData, setRegressionData] = useState<RegressionAnalysis[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareResult, setCompareResult] = useState<VersionCompareResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareForm, setCompareForm] = useState({
    recordId: '',
    recordType: 'invoice' as BusinessDataType,
    version1: '1',
    version2: '2',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, regressionRes] = await Promise.all([
        riskService.getRiskDashboard(),
        riskService.getRegressionAnalysis(),
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }

      if (regressionRes.success && regressionRes.data) {
        setRegressionData(regressionRes.data);
      }
    } catch (err: any) {
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVersionCompare = async () => {
    if (!compareForm.recordId || !compareForm.version1 || !compareForm.version2) {
      setError('请填写完整的对比信息');
      return;
    }

    try {
      setCompareLoading(true);
      const res = await riskService.versionCompare(
        compareForm.recordId,
        compareForm.recordType,
        parseInt(compareForm.version1),
        parseInt(compareForm.version2)
      );

      if (res.success && res.data) {
        setCompareResult(res.data);
      } else {
        setError(res.error || '版本对比失败');
      }
    } catch (err: any) {
      setError(err.message || '版本对比失败');
    } finally {
      setCompareLoading(false);
    }
  };

  const riskScore = stats
    ? Math.min(
        100,
        Math.round(
          (stats.overdueCases / stats.totalCases) * 40 +
            (stats.highRiskCases / stats.totalCases) * 40 +
            (stats.inCollectionCases / stats.totalCases) * 20
        )
      )
    : 0;

  const getGaugeColor = (score: number) => {
    if (score < 30) return '#10b981';
    if (score < 60) return '#f59e0b';
    if (score < 80) return '#f97316';
    return '#ef4444';
  };

  const regressionColumns = [
    {
      key: 'businessNo',
      title: '业务编号',
      dataIndex: 'businessNo' as keyof RegressionAnalysis,
      render: (record: RegressionAnalysis) => (
        <span className="font-mono text-sm text-blue-600">{record.businessNo}</span>
      ),
    },
    {
      key: 'regressionType',
      title: '倒退类型',
      dataIndex: 'regressionType' as keyof RegressionAnalysis,
      render: (record: RegressionAnalysis) => {
        const typeLabels: Record<string, string> = {
          confirmation_withdrawn: '确权撤回',
          status_reverse: '状态倒退',
          payment_revoked: '回款撤销',
        };
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <TrendingDown size={12} />
            {typeLabels[record.regressionType] || record.regressionType}
          </span>
        );
      },
    },
    {
      key: 'affectedAmount',
      title: '影响金额',
      dataIndex: 'affectedAmount' as keyof RegressionAnalysis,
      render: (record: RegressionAnalysis) => (
        <span className="font-medium text-red-600">
          ¥{record.affectedAmount.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'analysis',
      title: '分析结论',
      dataIndex: 'analysis' as keyof RegressionAnalysis,
      render: (record: RegressionAnalysis) => (
        <p className="text-sm text-slate-600 max-w-xs truncate">{record.analysis}</p>
      ),
    },
    {
      key: 'action',
      title: '操作',
      render: (record: RegressionAnalysis) => (
        <button
          onClick={() => setExpandedId(expandedId === record.businessNo ? null : record.businessNo)}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          {expandedId === record.businessNo ? (
            <>
              <ChevronUp size={14} />
              收起
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              展开
            </>
          )}
        </button>
      ),
    },
  ];

  if (loading) {
    return <Loading size="lg" text="加载风险分析数据..." className="h-[calc(100vh-180px)]" />;
  }

  if (error && !stats) {
    return <ErrorState message={error} onRetry={loadData} className="h-[calc(100vh-180px)]" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="风险仪表盘" className="lg:col-span-1">
          <div className="flex flex-col items-center">
            <div className="w-48 h-32 relative">
              <div className="absolute inset-0 flex items-end justify-center">
                <div
                  className="text-3xl font-bold"
                  style={{ color: getGaugeColor(riskScore) }}
                >
                  {riskScore}
                </div>
              </div>
              <svg viewBox="0 0 200 120" className="w-full h-full">
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke={getGaugeColor(riskScore)}
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={`${(riskScore / 100) * 251.2} 251.2`}
                />
              </svg>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              综合风险指数：
              <span className={cn('font-bold ml-1', riskScore >= 60 ? 'text-red-600' : 'text-slate-800')}>
                {riskScore}
              </span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-slate-500">低风险 0-30</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-slate-500">中风险 30-60</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-slate-500">高风险 60-80</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-slate-500">极高 80-100</span>
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="关键指标"
          extra={
            <button
              onClick={loadData}
              className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"
            >
              <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
              刷新
            </button>
          }
        >
          <div className="space-y-4">
            {[
              {
                label: '案件总数',
                value: stats?.totalCases || 0,
                icon: Users,
                color: 'bg-blue-100 text-blue-600',
              },
              {
                label: '逾期案件',
                value: stats?.overdueCases || 0,
                icon: AlertTriangle,
                color: 'bg-amber-100 text-amber-600',
              },
              {
                label: '高风险案件',
                value: stats?.highRiskCases || 0,
                icon: XCircle,
                color: 'bg-red-100 text-red-600',
              },
              {
                label: '累计逾期金额',
                value: `¥${(stats?.overdueAmount || 0).toLocaleString()}`,
                icon: DollarSign,
                color: 'bg-rose-100 text-rose-600',
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', item.color)}>
                    <item.icon size={16} />
                  </div>
                  <span className="text-sm text-slate-600">{item.label}</span>
                </div>
                <span className="font-bold text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="确权版本对比"
          extra={
            <button
              onClick={() => setShowCompareModal(true)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <FileDiff size={14} />
              开始对比
            </button>
          }
          className="lg:col-span-2"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-500 mb-3">对比说明</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600">支持发票、买方确认、合同等六类数据的版本对比</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600">自动识别新增、删除、修改的字段</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600">高亮显示关键金额、日期等字段变更</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600">记录操作人和变更原因</span>
                </li>
              </ul>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-700 mb-3">最近对比记录</p>
              <div className="space-y-2">
                {[
                  { no: 'BL2024001', type: '买方确认', v1: 'v1', v2: 'v2', time: '2小时前' },
                  { no: 'BL2024003', type: '发票', v1: 'v2', v2: 'v3', time: '昨天' },
                  { no: 'BL2024005', type: '保理合同', v1: 'v1', v2: 'v2', time: '3天前' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded hover:bg-white transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-blue-600">{item.no}</span>
                      <span className="text-xs text-slate-500">{item.type}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">{item.v1}</span>
                      <ArrowRight size={12} className="text-slate-400" />
                      <span className="text-xs text-slate-500">{item.v2}</span>
                      <span className="text-xs text-slate-400 ml-2">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="状态倒退分析"
        subtitle="检测到的异常状态变更及其影响分析"
      >
        <Table<RegressionAnalysis>
          columns={regressionColumns}
          data={regressionData}
          rowKey={(record) => record.businessNo}
          loading={loading}
        />
        
        {expandedId && (
          <div className="mt-4">
            {regressionData
              .filter((r) => r.businessNo === expandedId)
              .map((record) => (
                <div
                  key={record.businessNo}
                  className="p-4 bg-slate-50 rounded-lg space-y-4 border border-slate-200"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2">影响范围</h4>
                      <div className="flex flex-wrap gap-2">
                        {record.impactScope.map((scope, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2">影响金额</h4>
                      <p className="text-2xl font-bold text-red-600">
                        ¥{record.affectedAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      处置建议
                    </h4>
                    <ul className="space-y-2">
                      {record.suggestions.map((suggestion, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-sm text-slate-600">{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                      标记已处理
                    </button>
                    <button className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1">
                      <Eye size={14} />
                      查看详情
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>

      <Card title="处置建议列表" subtitle="基于风险分析生成的智能处置建议">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: '立即启动催收程序',
              desc: 'BL2024001、BL2024002 等 5 个案件已逾期超过 30 天',
              priority: 'high',
              count: 5,
            },
            {
              title: '核实确权真实性',
              desc: 'BL2024003 的买方确认存在版本变更，需核实交易背景',
              priority: 'high',
              count: 2,
            },
            {
              title: '启动法律程序',
              desc: 'BL2024004 已逾期超过 90 天且催收无效',
              priority: 'high',
              count: 1,
            },
            {
              title: '协商展期方案',
              desc: 'BL2024005、BL2024006 可考虑债务重组方案',
              priority: 'medium',
              count: 3,
            },
            {
              title: '追加担保措施',
              desc: 'BL2024007 风险等级上升，建议追加抵押物',
              priority: 'medium',
              count: 2,
            },
            {
              title: '密切监控预警',
              desc: 'BL2024008、BL2024009 存在潜在风险信号',
              priority: 'low',
              count: 4,
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-slate-800">{item.title}</h4>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    item.priority === 'high'
                      ? 'bg-red-100 text-red-700'
                      : item.priority === 'medium'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                  )}
                >
                  {item.priority === 'high' ? '高优先级' : item.priority === 'medium' ? '中优先级' : '低优先级'}
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-3">{item.desc}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">涉及 {item.count} 个案件</span>
                <button className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                  查看详情 <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={showCompareModal}
        onClose={() => {
          setShowCompareModal(false);
          setCompareResult(null);
          setError(null);
        }}
        title="版本对比"
        width="max-w-3xl"
        footer={
          <>
            <button
              onClick={() => {
                setShowCompareModal(false);
                setCompareResult(null);
              }}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              关闭
            </button>
          </>
        }
      >
        <div className="space-y-6">
          {!compareResult ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">数据类型</label>
                  <select
                    value={compareForm.recordType}
                    onChange={(e) => setCompareForm({ ...compareForm, recordType: e.target.value as BusinessDataType })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.entries(DATA_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">记录ID</label>
                  <input
                    type="text"
                    value={compareForm.recordId}
                    onChange={(e) => setCompareForm({ ...compareForm, recordId: e.target.value })}
                    placeholder="请输入记录ID"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">版本 1</label>
                  <input
                    type="number"
                    value={compareForm.version1}
                    onChange={(e) => setCompareForm({ ...compareForm, version1: e.target.value })}
                    placeholder="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">版本 2</label>
                  <input
                    type="number"
                    value={compareForm.version2}
                    onChange={(e) => setCompareForm({ ...compareForm, version2: e.target.value })}
                    placeholder="2"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}
              <button
                onClick={handleVersionCompare}
                disabled={compareLoading}
                className="w-full py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {compareLoading ? '对比中...' : '开始对比'}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileDiff className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-800">
                    对比结果：{compareResult.diffs.length} 处变更
                  </span>
                </div>
                <button
                  onClick={() => setCompareResult(null)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  重新对比
                </button>
              </div>

              {compareResult.diffs.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-slate-600">两个版本完全一致，无差异</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {compareResult.diffs.map((diff, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'p-4 border rounded-lg',
                        diff.changeType === 'added'
                          ? 'border-green-200 bg-green-50'
                          : diff.changeType === 'removed'
                          ? 'border-red-200 bg-red-50'
                          : 'border-amber-200 bg-amber-50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            diff.changeType === 'added'
                              ? 'bg-green-200 text-green-800'
                              : diff.changeType === 'removed'
                              ? 'bg-red-200 text-red-800'
                              : 'bg-amber-200 text-amber-800'
                          )}
                        >
                          {diff.changeType === 'added' ? '新增' : diff.changeType === 'removed' ? '删除' : '修改'}
                        </span>
                        <span className="font-medium text-slate-800">{diff.field}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {diff.changeType !== 'added' && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">变更前</p>
                            <p
                              className={cn(
                                'p-2 rounded font-mono text-sm',
                                diff.changeType === 'removed' ? 'bg-red-100 line-through' : 'bg-slate-100'
                              )}
                            >
                              {String(diff.before)}
                            </p>
                          </div>
                        )}
                        {diff.changeType !== 'removed' && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">变更后</p>
                            <p className="p-2 rounded font-mono text-sm bg-green-100">
                              {String(diff.after)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
