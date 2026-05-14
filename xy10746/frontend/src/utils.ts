import { PluginVersionStatus, ApiResponseStatus } from './types';

export const getStatusColor = (status: PluginVersionStatus): string => {
  switch (status) {
    case PluginVersionStatus.DRAFT:
      return 'bg-gray-100 text-gray-800';
    case PluginVersionStatus.SUBMITTED:
      return 'bg-blue-100 text-blue-800';
    case PluginVersionStatus.SECURITY_SCANNING:
      return 'bg-yellow-100 text-yellow-800';
    case PluginVersionStatus.SECURITY_PASSED:
      return 'bg-green-100 text-green-800';
    case PluginVersionStatus.SECURITY_FAILED:
      return 'bg-red-100 text-red-800';
    case PluginVersionStatus.PENDING_REVIEW:
      return 'bg-orange-100 text-orange-800';
    case PluginVersionStatus.REVIEW_APPROVED:
      return 'bg-emerald-100 text-emerald-800';
    case PluginVersionStatus.REVIEW_REJECTED:
      return 'bg-red-100 text-red-800';
    case PluginVersionStatus.PENDING_RECHECK:
      return 'bg-amber-100 text-amber-800';
    case PluginVersionStatus.PUBLISHED:
      return 'bg-green-100 text-green-800';
    case PluginVersionStatus.UNPUBLISHED:
      return 'bg-red-100 text-red-800';
    case PluginVersionStatus.ARCHIVED:
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusLabel = (status: PluginVersionStatus): string => {
  switch (status) {
    case PluginVersionStatus.DRAFT:
      return '草稿';
    case PluginVersionStatus.SUBMITTED:
      return '已提交';
    case PluginVersionStatus.SECURITY_SCANNING:
      return '安全扫描中';
    case PluginVersionStatus.SECURITY_PASSED:
      return '安全通过';
    case PluginVersionStatus.SECURITY_FAILED:
      return '安全失败';
    case PluginVersionStatus.PENDING_REVIEW:
      return '待审核';
    case PluginVersionStatus.REVIEW_APPROVED:
      return '审核通过';
    case PluginVersionStatus.REVIEW_REJECTED:
      return '审核驳回';
    case PluginVersionStatus.PENDING_RECHECK:
      return '待复核';
    case PluginVersionStatus.PUBLISHED:
      return '已上架';
    case PluginVersionStatus.UNPUBLISHED:
      return '已下架';
    case PluginVersionStatus.ARCHIVED:
      return '已归档';
    default:
      return status;
  }
};

export const getApiStatusColor = (status: ApiResponseStatus): string => {
  switch (status) {
    case ApiResponseStatus.SUCCESS:
      return 'bg-green-50 border-green-500 text-green-700';
    case ApiResponseStatus.PENDING_REVIEW:
      return 'bg-yellow-50 border-yellow-500 text-yellow-700';
    case ApiResponseStatus.BLOCKED:
      return 'bg-red-50 border-red-500 text-red-700';
    case ApiResponseStatus.RETRYABLE:
      return 'bg-orange-50 border-orange-500 text-orange-700';
    default:
      return 'bg-gray-50 border-gray-500 text-gray-700';
  }
};

export const getApiStatusLabel = (status: ApiResponseStatus): string => {
  switch (status) {
    case ApiResponseStatus.SUCCESS:
      return '成功';
    case ApiResponseStatus.PENDING_REVIEW:
      return '待复核';
    case ApiResponseStatus.BLOCKED:
      return '已拦截';
    case ApiResponseStatus.RETRYABLE:
      return '可重试';
    default:
      return status;
  }
};

export const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-blue-100 text-blue-800';
    case 'info':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getSeverityLabel = (severity: string): string => {
  switch (severity) {
    case 'critical':
      return '严重';
    case 'high':
      return '高危';
    case 'medium':
      return '中危';
    case 'low':
      return '低危';
    case 'info':
      return '信息';
    default:
      return severity;
  }
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};
