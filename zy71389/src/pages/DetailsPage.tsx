import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Info,
  Clock,
  Users,
  Eye,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  ArrowRight,
  Database,
  Link2,
  Copy,
  Download,
  RefreshCw,
  User,
  Calendar,
  Layers
} from 'lucide-react';
import { PageHeader, Card, EmptyState } from '../components/layout/MainLayout';
import { ContaminationBadge } from '../components/common/StatusBadge';
import { DataTable } from '../components/common/LogViewer';
import { useCheckStore } from '../stores/checkStore';
import { useFileStore } from '../stores/fileStore';
import { ContaminationType, ExposureLog, EvidenceChain, EvidenceItem } from '../types';
import { formatNumber, formatPercent, formatTimestamp } from '../utils/format';
import { Link } from 'react-router-dom';

export const DetailsPage: React.FC = () => {
  const { checkResult, getExposuresArray, getEvidenceChain } = useCheckStore();
  const { userBuckets, exposureLogs, operationChanges, conversionData } = useFileStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedExposure, setSelectedExposure] = useState<ExposureLog | null>(null);
  const [evidenceChain, setEvidenceChain] = useState<EvidenceChain | null>(null);
  
  const hasResult = checkResult !== null;
  const markedExposures = getExposuresArray();
  
  const filteredExposures = useMemo(() => {
    if (!markedExposures.length) return [];
    
    let result = markedExposures;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.exposureId.toLowerCase().includes(query) ||
        e.userId.toLowerCase().includes(query) ||
        e.deviceId?.toLowerCase().includes(query)
      );
    }
    
    if (filterType !== 'all') {
      result = result.filter(e => e.contaminationType === filterType);
    }
    
    return result;
  }, [markedExposures, searchQuery, filterType]);
  
  const handleExposureClick = (exposure: ExposureLog) => {
    setSelectedExposure(exposure);
    const chain = getEvidenceChain(exposure.exposureId);
    setEvidenceChain(chain);
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };
  
  const getTimelineIcon = (item: EvidenceItem) => {
    switch (item.type) {
      case 'bucket':
        return <Users className="w-4 h-4" />;
      case 'exposure':
        return <Eye className="w-4 h-4" />;
      case 'conversion':
        return <ShoppingCart className="w-4 h-4" />;
      case 'config_change':
        return <AlertTriangle className="w-4 h-4" />;
      case 'contamination':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };
  
  const getTimelineColor = (item: EvidenceItem) => {
    switch (item.type) {
      case 'bucket':
        return 'bg-primary-100 text-primary-600';
      case 'exposure':
        return 'bg-info-100 text-info-600';
      case 'conversion':
        return 'bg-success-100 text-success-600';
      case 'config_change':
        return 'bg-warning-100 text-warning-600';
      case 'contamination':
        return 'bg-danger-100 text-danger-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };
  
  const columns = [
    {
      key: 'exposureId',
      header: '曝光ID',
      width: '120px',
      render: (row: ExposureLog) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">{row.exposureId}</span>
          <button
            onClick={(e) => { e.stopPropagation(); copyToClipboard(row.exposureId); }}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      )
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
      key: 'isContaminated',
      header: '状态',
      width: '80px',
      render: (row: ExposureLog) => (
        <div className="flex items-center gap-1">
          {row.isContaminated ? (
            <AlertTriangle className="w-4 h-4 text-danger-500" />
          ) : (
            <CheckCircle className="w-4 h-4 text-success-500" />
          )}
          <span className={`text-xs ${row.isContaminated ? 'text-danger-600' : 'text-success-600'}`}>
            {row.isContaminated ? '污染' : '正常'}
          </span>
        </div>
      )
    },
    {
      key: 'contaminationType',
      header: '污染类型',
      width: '120px',
      render: (row: ExposureLog) => row.isContaminated ? (
        <ContaminationBadge type={row.contaminationType} />
      ) : (
        <span className="text-gray-400">-</span>
      )
    },
    {
      key: 'exposureTime',
      header: '曝光时间',
      width: '160px',
      render: (row: ExposureLog) => formatTimestamp(row.exposureTime, 'MM-DD HH:mm:ss')
    },
    {
      key: 'configVersion',
      header: '版本',
      width: '80px'
    },
    {
      key: 'action',
      header: '操作',
      width: '80px',
      align: 'right' as const,
      render: (row: ExposureLog) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleExposureClick(row); }}
          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
        >
          详情
          <ChevronRight className="w-3 h-3" />
        </button>
      )
    }
  ];
  
  const filterOptions = [
    { value: 'all', label: '全部', count: markedExposures.length || 0 },
    { value: ContaminationType.CROSS_GROUP, label: '用户串组', count: checkResult?.crossGroupCount || 0 },
    { value: ContaminationType.DUPLICATE_EXPOSURE, label: '重复曝光', count: checkResult?.duplicateExposureCount || 0 },
    { value: ContaminationType.CONFIG_CHANGE, label: '配置变更', count: checkResult?.configChangeCount || 0 },
    { value: ContaminationType.NONE, label: '正常', count: (checkResult?.totalExposures || 0) - (checkResult?.contaminatedCount || 0) }
  ];
  
  if (!hasResult) {
    return (
      <div>
        <PageHeader
          title="详情查询"
          description="查询单条曝光记录的完整证据链，追踪污染原因"
          breadcrumbs={[{ label: '首页', path: '/' }, { label: '详情查询' }]}
        />
        <Card>
          <EmptyState
            icon={<Search className="w-12 h-12" />}
            title="暂无检查结果"
            description="请先执行污染检查，检查完成后即可查询详细证据链"
            action={
              <Link
                to="/check"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
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
        title="详情查询"
        description="查询单条曝光记录的完整证据链，追踪污染原因"
        breadcrumbs={[{ label: '首页', path: '/' }, { label: '详情查询' }]}
      />
      
      {/* Search and Filter */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索曝光ID、用户ID、设备ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilterType(option.value)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === option.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
                <span className={`text-xs ${filterType === option.value ? 'text-primary-200' : 'text-gray-500'}`}>
                  {option.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exposure List */}
        <div className="lg:col-span-2">
          <Card
            title="曝光记录列表"
            subtitle={`${filteredExposures.length} 条记录`}
            padding="none"
          >
            <div style={{ maxHeight: '600px', overflow: 'auto' }}>
              <DataTable
                columns={columns}
                data={filteredExposures}
                rowKey="exposureId"
                emptyMessage="暂无匹配的记录"
                onRowClick={handleExposureClick}
                rowClassName={(row) =>
                  row.isContaminated
                    ? row.contaminationType === ContaminationType.CROSS_GROUP
                      ? 'bg-danger-50/50 hover:bg-danger-100/50'
                      : row.contaminationType === ContaminationType.DUPLICATE_EXPOSURE
                      ? 'bg-warning-50/50 hover:bg-warning-100/50'
                      : 'bg-primary-50/50 hover:bg-primary-100/50'
                    : 'hover:bg-gray-50'
                }
              />
            </div>
          </Card>
        </div>
        
        {/* Evidence Chain Panel */}
        <div>
          <Card
            title="证据链详情"
            subtitle={selectedExposure ? `曝光ID: ${selectedExposure.exposureId}` : '请选择一条记录'}
          >
            {!selectedExposure ? (
              <EmptyState
                icon={<Info className="w-10 h-10" />}
                title="请选择曝光记录"
                description="点击左侧列表中的任意记录，查看完整的证据链"
              />
            ) : (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">基本信息</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">曝光ID</span>
                      <span className="font-mono text-gray-900">{selectedExposure.exposureId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">用户ID</span>
                      <span className="font-mono text-gray-900">{selectedExposure.userId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">分组</span>
                      <span className="text-gray-900">{selectedExposure.groupId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">曝光时间</span>
                      <span className="text-gray-900">{formatTimestamp(selectedExposure.exposureTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">配置版本</span>
                      <span className="text-gray-900">{selectedExposure.configVersion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">页面</span>
                      <span className="text-gray-900">{selectedExposure.pageUrl}</span>
                    </div>
                  </div>
                </div>
                
                {/* Contamination Info */}
                {selectedExposure.isContaminated && (
                  <div className={`rounded-lg p-4 ${
                    selectedExposure.contaminationType === ContaminationType.CROSS_GROUP
                      ? 'bg-danger-50 border border-danger-200'
                      : selectedExposure.contaminationType === ContaminationType.DUPLICATE_EXPOSURE
                      ? 'bg-warning-50 border border-warning-200'
                      : 'bg-primary-50 border border-primary-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        selectedExposure.contaminationType === ContaminationType.CROSS_GROUP
                          ? 'bg-danger-100 text-danger-600'
                          : selectedExposure.contaminationType === ContaminationType.DUPLICATE_EXPOSURE
                          ? 'bg-warning-100 text-warning-600'
                          : 'bg-primary-100 text-primary-600'
                      }`}>
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">污染判定</h4>
                        <div className="mb-2">
                          <ContaminationBadge type={selectedExposure.contaminationType} />
                        </div>
                        <p className="text-sm text-gray-700">
                          {selectedExposure.contaminationReason}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Evidence Timeline */}
                {evidenceChain && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      证据链时间线
                    </h4>
                    <div className="relative pl-6">
                      <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                      {evidenceChain.evidenceItems.map((item, index) => (
                        <div key={index} className="relative mb-6 last:mb-0">
                          <div className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center ${getTimelineColor(item)}`}>
                            {getTimelineIcon(item)}
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-500">{item.label}</span>
                              <span className="text-xs text-gray-400">
                                {formatTimestamp(item.timestamp, 'HH:mm:ss')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 font-medium">{item.title}</p>
                            {item.description && (
                              <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                            )}
                            {item.evidence && (
                              <div className="mt-2 text-xs bg-white rounded p-2 border border-gray-200">
                                <code className="text-gray-700 break-all">
                                  {JSON.stringify(item.evidence, null, 2).slice(0, 200)}
                                  {JSON.stringify(item.evidence).length > 200 ? '...' : ''}
                                </code>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Related Conversions */}
                {evidenceChain?.relatedConversions && evidenceChain.relatedConversions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      关联转化记录
                    </h4>
                    <div className="space-y-2">
                      {evidenceChain.relatedConversions.map((conv) => (
                        <div key={conv.conversionId} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">{conv.conversionEvent}</span>
                            <span className="text-xs text-gray-500">{formatTimestamp(conv.conversionTime, 'MM-DD HH:mm')}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">转化ID</span>
                            <span className="text-xs font-mono text-gray-700">{conv.conversionId}</span>
                          </div>
                          {conv.conversionValue > 0 && (
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-gray-500">转化金额</span>
                              <span className="text-sm font-semibold text-success-600">¥{conv.conversionValue.toFixed(0)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Consistency Info */}
                {evidenceChain?.consistencyHash && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      数据校验
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">校验和:</span>
                      <code className="text-xs font-mono text-gray-700 bg-white px-2 py-1 rounded border">
                        {evidenceChain.consistencyHash.substring(0, 16)}...
                      </code>
                      <button
                        onClick={() => copyToClipboard(evidenceChain.consistencyHash)}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-white rounded transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {evidenceChain.isConsistent ? (
                        <span className="text-success-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          数据一致性校验通过
                        </span>
                      ) : (
                        <span className="text-danger-600 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          数据存在不一致
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
