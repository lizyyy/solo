import React from 'react';
import {
  ShieldAlert,
  Users,
  Eye,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  FileText,
  Upload,
  Play,
  BarChart3,
  Search,
  Download
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, Card } from '../components/layout/MainLayout';
import { MetricCard } from '../components/common/MetricCard';
import { useFileStore } from '../stores/fileStore';
import { useCheckStore } from '../stores/checkStore';
import { formatNumber, formatPercent } from '../utils/format';

export const HomePage: React.FC = () => {
  const { files, userBuckets, exposureLogs, conversionData, operationChanges } = useFileStore();
  const { checkResult } = useCheckStore();
  
  const hasData = userBuckets.length > 0 || exposureLogs.length > 0;
  const hasResult = checkResult !== null;
  
  return (
    <div>
      <PageHeader
        title="灰度实验污染检查系统"
        description="检测实验过程中的数据污染问题，确保实验结果真实可靠"
        breadcrumbs={[{ label: '首页' }]}
      />
      
      {/* Quick Actions */}
      <Card className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Link
            to="/files"
            className="flex flex-col items-center p-4 rounded-lg bg-gray-50 hover:bg-primary-50 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-900">上传文件</span>
            <span className="text-xs text-gray-500 mt-1">{files.length} 个文件</span>
          </Link>
          
          <Link
            to="/check"
            className="flex flex-col items-center p-4 rounded-lg bg-gray-50 hover:bg-success-50 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-success-100 text-success-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Play className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-900">开始检查</span>
            <span className="text-xs text-gray-500 mt-1">{hasData ? '就绪' : '缺少数据'}</span>
          </Link>
          
          <Link
            to="/report"
            className="flex flex-col items-center p-4 rounded-lg bg-gray-50 hover:bg-warning-50 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-warning-100 text-warning-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-900">查看报告</span>
            <span className="text-xs text-gray-500 mt-1">{hasResult ? '已生成' : '未生成'}</span>
          </Link>
          
          <Link
            to="/details"
            className="flex flex-col items-center p-4 rounded-lg bg-gray-50 hover:bg-primary-50 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Search className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-900">详情查询</span>
            <span className="text-xs text-gray-500 mt-1">追踪证据链</span>
          </Link>
          
          <Link
            to="/export"
            className="flex flex-col items-center p-4 rounded-lg bg-gray-50 hover:bg-primary-50 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Download className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-900">导出报告</span>
            <span className="text-xs text-gray-500 mt-1">多格式支持</span>
          </Link>
          
          <div className="flex flex-col items-center p-4 rounded-lg bg-gray-50 group">
            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center mb-2">
              <FileText className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-900">帮助文档</span>
            <span className="text-xs text-gray-500 mt-1">使用指南</span>
          </div>
        </div>
      </Card>
      
      {/* Data Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="分桶用户数"
          value={userBuckets.length}
          icon={<Users className="w-5 h-5" />}
          color="primary"
        />
        <MetricCard
          title="曝光记录数"
          value={exposureLogs.length}
          icon={<Eye className="w-5 h-5" />}
          color="primary"
        />
        <MetricCard
          title="转化记录数"
          value={conversionData.length}
          icon={<ShoppingCart className="w-5 h-5" />}
          color="success"
        />
        <MetricCard
          title="运营变更数"
          value={operationChanges.length}
          icon={<Activity className="w-5 h-5" />}
          color="warning"
        />
      </div>
      
      {/* Check Result */}
      {hasResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card title="污染检测结果" subtitle="整体污染情况">
            <div className="text-center py-4">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${checkResult.contaminationRate > 0 ? 'bg-danger-100' : 'bg-success-100'} mb-4`}>
                {checkResult.contaminationRate > 0 ? (
                  <AlertTriangle className="w-10 h-10 text-danger-600" />
                ) : (
                  <ShieldAlert className="w-10 h-10 text-success-600" />
                )}
              </div>
              <p className="text-3xl font-bold font-mono text-gray-900">
                {formatPercent(checkResult.contaminationRate, 2)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                污染率 · {formatNumber(checkResult.contaminatedCount)} 条污染记录
              </p>
            </div>
          </Card>
          
          <Card title="污染类型分布" subtitle="按类型统计">
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-danger-500"></div>
                  <span className="text-sm text-gray-700">用户串组</span>
                </div>
                <span className="text-sm font-semibold font-mono text-gray-900">
                  {formatNumber(checkResult.crossGroupCount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-warning-500"></div>
                  <span className="text-sm text-gray-700">重复曝光</span>
                </div>
                <span className="text-sm font-semibold font-mono text-gray-900">
                  {formatNumber(checkResult.duplicateExposureCount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary-500"></div>
                  <span className="text-sm text-gray-700">配置变更</span>
                </div>
                <span className="text-sm font-semibold font-mono text-gray-900">
                  {formatNumber(checkResult.configChangeCount)}
                </span>
              </div>
            </div>
          </Card>
          
          <Card title="核心指标对比" subtitle="原始 vs 修正">
            <div className="space-y-4 py-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">转化率</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 line-through">
                      {formatPercent(checkResult.originalMetrics.conversionRate, 2)}
                    </span>
                    <span className="text-sm font-semibold font-mono text-success-600">
                      {formatPercent(checkResult.recalculatedMetrics.conversionRate, 2)}
                    </span>
                    {checkResult.originalMetrics.conversionRate < checkResult.recalculatedMetrics.conversionRate ? (
                      <TrendingUp className="w-4 h-4 text-success-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-danger-600" />
                    )}
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success-500 rounded-full transition-all"
                    style={{ width: `${Math.min(checkResult.recalculatedMetrics.conversionRate * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">平均转化值</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 line-through">
                      ¥{formatNumber(checkResult.originalMetrics.averageValue, 0)}
                    </span>
                    <span className="text-sm font-semibold font-mono text-primary-600">
                      ¥{formatNumber(checkResult.recalculatedMetrics.averageValue, 0)}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: `${Math.min(checkResult.recalculatedMetrics.averageValue / 10, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {/* Feature Introduction */}
      <Card title="核心功能特性">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-1">分桶校验</h4>
              <p className="text-sm text-gray-500">
                检测用户在实验过程中是否发生组间串动，确保分桶稳定性
              </p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-warning-100 text-warning-600 flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-1">变更切片</h4>
              <p className="text-sm text-gray-500">
                根据运营配置变更自动切分实验阶段，分阶段计算指标
              </p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-danger-100 text-danger-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-1">污染标记</h4>
              <p className="text-sm text-gray-500">
                标记每条曝光记录的污染类型和优先级，提供完整证据链
              </p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-success-100 text-success-600 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-1">指标重算</h4>
              <p className="text-sm text-gray-500">
                排除污染数据后重新计算核心指标，提供修正后的实验结论
              </p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-1">一致性校验</h4>
              <p className="text-sm text-gray-500">
                三重校验确保统计数据、详情列表、导出文件完全一致
              </p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-1">报告导出</h4>
              <p className="text-sm text-gray-500">
                支持CSV、Excel、PDF多格式导出，报告可复核、可追溯
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
