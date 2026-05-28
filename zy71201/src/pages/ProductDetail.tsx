import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  History,
  Save,
  FileText,
  AlertTriangle,
  Clock,
  User,
  Calendar,
  DollarSign,
  TrendingDown,
  Ban,
  Edit3,
  PieChart,
  Database,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import type { ScriptType, AnomalyType } from '../types';

const anomalyLabels: Record<AnomalyType, { label: string; color: string; icon: React.ElementType }> = {
  date_mismatch: { label: '估值日期错位', color: 'border-danger bg-danger/5', icon: Clock },
  warning_line_changed: { label: '预警线变更', color: 'border-warning bg-warning/5', icon: Edit3 },
  redemption_suspended: { label: '暂停赎回', color: 'border-danger bg-danger/5', icon: Ban },
};

const scriptTabs: { type: ScriptType; label: string; color: string }[] = [
  { type: 'normal', label: '普通话术', color: 'bg-success' },
  { type: 'warning', label: '警示话术', color: 'bg-warning' },
  { type: 'special', label: '特殊话术', color: 'bg-danger' },
];

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const product = useStore((state) => state.getProductById(id || ''));
  const getNetValues = useStore((state) => state.getNetValues);
  const getValuations = useStore((state) => state.getValuations);
  const getScript = useStore((state) => state.getScript);
  const saveScript = useStore((state) => state.saveScript);
  const saveDraft = useStore((state) => state.saveDraft);
  const getDraft = useStore((state) => state.getDraft);
  const recordVersion = useStore((state) => state.recordVersion);
  const getProductLatestVersion = useStore((state) => state.getProductLatestVersion);
  const getProductHistory = useStore((state) => state.getProductHistory);
  const redemptions = useStore((state) => state.redemptions);

  const [activeTab, setActiveTab] = useState<ScriptType>('normal');
  const [scriptContent, setScriptContent] = useState('');
  const [note, setNote] = useState('');

  const netValues = useMemo(() => (id ? getNetValues(id) : []), [id, getNetValues]);
  const valuations = useMemo(() => (id ? getValuations(id) : []), [id, getValuations]);
  const redemption = id ? redemptions[id] : null;
  const latestVersion = id ? getProductLatestVersion(id) : 'v1.0';
  const versionHistory = id ? getProductHistory(id) : [];

  useEffect(() => {
    if (id) {
      const draft = getDraft(id);
      const script = getScript(id, activeTab);
      setScriptContent(draft?.scriptContent || script.content);
      setNote(draft?.note || '');
    }
  }, [id, activeTab, getDraft, getScript]);

  useEffect(() => {
    if (id) {
      const timer = setTimeout(() => {
        saveDraft(id, { scriptContent, note });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [scriptContent, note, id, saveDraft]);

  if (!product) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">产品不存在</p>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    if (!id) return;
    saveScript(id, activeTab, scriptContent);
    recordVersion(
      id,
      'update',
      { scriptContent: getScript(id, activeTab).content },
      { scriptContent },
      `更新了${scriptTabs.find((t) => t.type === activeTab)?.label}`
    );
    alert('保存成功！');
  };

  const formatMoney = (num: number) => {
    if (num >= 100000000) return `${(num / 100000000).toFixed(2)}亿`;
    if (num >= 10000) return `${(num / 10000).toFixed(0)}万`;
    return num.toString();
  };

  const chartData = netValues.map((nv) => ({
    date: nv.valueDate.slice(5),
    netValue: nv.netValue,
    drawdown: nv.drawdownRate,
  }));

  const getScriptType = () => {
    if (product.status === 'stop_loss') return 'special';
    if (product.status === 'warning') return 'warning';
    return 'normal';
  };

  useEffect(() => {
    setActiveTab(getScriptType());
  }, [product?.status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">{product.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {product.code} · {product.manager}
            </p>
          </div>
        </div>
        <Link
          to={`/product/${id}/history`}
          className="flex items-center gap-2 px-4 py-2 bg-navy-50 text-navy-700 rounded-lg hover:bg-navy-100 transition-colors"
        >
          <History className="w-4 h-4" />
          历史记录
        </Link>
      </div>

      {product.anomalies.length > 0 && (
        <div className="space-y-3">
          {product.anomalies.map((anomaly, idx) => {
            const config = anomalyLabels[anomaly.type];
            const Icon = config.icon;
            return (
              <div
                key={idx}
                className={cn(
                  'border-l-4 rounded-r-lg p-4 flex items-start gap-3 animate-pulse-slow',
                  config.color
                )}
              >
                <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-800">{config.label}</p>
                  <p className="text-sm text-gray-600 mt-1">{anomaly.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    检测时间：{new Date(anomaly.detectedAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <InfoCard
          icon={DollarSign}
          label="最新净值"
          value={product.latestNetValue.toFixed(4)}
          trend={product.latestDrawdownRate}
        />
        <InfoCard
          icon={TrendingDown}
          label="回撤率"
          value={`${product.latestDrawdownRate > 0 ? '+' : ''}${product.latestDrawdownRate.toFixed(2)}%`}
          trend={product.latestDrawdownRate}
          isDrawdown
        />
        <InfoCard
          icon={Calendar}
          label="预警线 / 止损线"
          value={`${product.warningLine.toFixed(2)} / ${product.stopLossLine.toFixed(2)}`}
        />
        <InfoCard
          icon={User}
          label="产品规模"
          value={formatMoney(product.scale)}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">净值走势</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                  <YAxis
                    domain={['dataMin - 0.05', 'dataMax + 0.05']}
                    tick={{ fontSize: 12 }}
                    stroke="#9CA3AF"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                    }}
                  />
                  <ReferenceLine
                    y={product.warningLine}
                    stroke="#F77F00"
                    strokeDasharray="5 5"
                    label={{ value: '预警线', position: 'right', fontSize: 12, fill: '#F77F00' }}
                  />
                  <ReferenceLine
                    y={product.stopLossLine}
                    stroke="#D62828"
                    strokeDasharray="5 5"
                    label={{ value: '止损线', position: 'right', fontSize: 12, fill: '#D62828' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="netValue"
                    stroke="#0A2463"
                    strokeWidth={2}
                    dot={{ fill: '#0A2463', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">客户话术</h3>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              {scriptTabs.map((tab) => (
                <button
                  key={tab.type}
                  onClick={() => setActiveTab(tab.type)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    activeTab === tab.type
                      ? `${tab.color} text-white shadow-md`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <textarea
              value={scriptContent}
              onChange={(e) => setScriptContent(e.target.value)}
              className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent resize-none"
              placeholder="输入客户话术..."
            />

            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">客服备注</h4>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent resize-none text-sm"
                placeholder="添加备注信息（自动保存草稿）..."
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">申赎状态</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">当前状态</span>
                <span
                  className={cn(
                    'px-3 py-1 rounded-full text-sm font-medium',
                    redemption?.status === 'normal'
                      ? 'bg-success/10 text-success'
                      : 'bg-danger/10 text-danger'
                  )}
                >
                  {redemption?.status === 'normal' ? '正常申赎' : '暂停赎回'}
                </span>
              </div>
              {redemption?.status !== 'normal' && redemption?.description && (
                <div className="p-3 bg-danger/5 rounded-lg border border-danger/20">
                  <p className="text-sm text-danger">{redemption.description}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    生效日期：{redemption.effectiveDate}
                  </p>
                </div>
              )}
              <div className="text-xs text-gray-500">
                数据来源：{redemption?.source || '申赎表'}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">产品信息</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">基金经理</span>
                <span className="text-gray-800 font-medium">{product.manager}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">成立日期</span>
                <span className="text-gray-800">{product.establishDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">产品规模</span>
                <span className="text-gray-800">{formatMoney(product.scale)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">产品代码</span>
                <span className="text-gray-800 font-mono">{product.code}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">持仓估值</h3>
              <PieChart className="w-5 h-5 text-navy-500" />
            </div>
            {valuations.length > 0 ? (
              <div className="space-y-3">
                <div className="text-xs text-gray-500 mb-2">
                  估值日期：{valuations[0]?.valuationDate || '未知'}
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {valuations.slice(0, 8).map((v, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate max-w-24">{v.holdingName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{v.holdingRatio}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                  共 {valuations.length} 条持仓
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Database className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">暂无估值数据</p>
                <p className="text-xs text-gray-400 mt-1">请先导入估值表</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">数据口径</h3>
              <Database className="w-5 h-5 text-navy-500" />
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">当前版本</span>
                <span className="text-navy-600 font-mono font-medium">{latestVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">版本记录</span>
                <span className="text-gray-800">{versionHistory.length} 条</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">最后更新</span>
                <span className="text-gray-800">
                  {new Date(product.lastUpdated).toLocaleDateString('zh-CN')}
                </span>
              </div>
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">
                  口径说明：系统导入数据 + 人工编辑备注均保留原始记录，可通过历史记录回溯
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">快速操作</h3>
            <div className="space-y-2">
              <Link
                to={`/product/${id}/history`}
                className="flex items-center gap-3 w-full px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <History className="w-5 h-5 text-navy-600" />
                <span className="text-gray-700">查看历史版本</span>
              </Link>
              <button className="flex items-center gap-3 w-full px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <FileText className="w-5 h-5 text-navy-600" />
                <span className="text-gray-700">导出周报</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  trend,
  isDrawdown,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  trend?: number;
  isDrawdown?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-navy-50 rounded-lg">
          <Icon className="w-5 h-5 text-navy-600" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-800 mt-1">{value}</p>
        </div>
      </div>
      {trend !== undefined && (
        <div
          className={cn(
            'mt-3 text-sm',
            isDrawdown
              ? trend < 0
                ? 'text-danger'
                : 'text-success'
              : trend < 0
              ? 'text-danger'
              : 'text-success'
          )}
        >
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(2)}%
        </div>
      )}
    </div>
  );
}
