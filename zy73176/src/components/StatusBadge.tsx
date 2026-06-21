import type { ReviewStatus, BlockType } from '../types';

interface StatusBadgeProps {
  status: ReviewStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = getStatusConfig(status);
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.class}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dotClass}`}></span>
      {config.label}
    </span>
  );
}

function getStatusConfig(status: ReviewStatus) {
  switch (status) {
    case 'completed':
      return {
        label: '已完成',
        class: 'bg-green-100 text-green-700',
        dotClass: 'bg-green-500'
      };
    case 'error':
      return {
        label: '错误',
        class: 'bg-red-100 text-red-700',
        dotClass: 'bg-red-500'
      };
    case 'warning':
      return {
        label: '警告',
        class: 'bg-yellow-100 text-yellow-700',
        dotClass: 'bg-yellow-500'
      };
    case 'calculating':
      return {
        label: '计算中',
        class: 'bg-blue-100 text-blue-700',
        dotClass: 'bg-blue-500 animate-pulse'
      };
    case 'pending':
    default:
      return {
        label: '待处理',
        class: 'bg-gray-100 text-gray-700',
        dotClass: 'bg-gray-400'
      };
  }
}

interface BlockTypeBadgeProps {
  type: BlockType;
}

export function BlockTypeBadge({ type }: BlockTypeBadgeProps) {
  const config = getBlockTypeConfig(type);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.class}`}>
      {config.icon}
      <span className="ml-1">{config.label}</span>
    </span>
  );
}

function getBlockTypeConfig(type: BlockType) {
  switch (type) {
    case 'formula':
      return {
        label: '公式',
        class: 'bg-purple-100 text-purple-700',
        icon: '📐'
      };
    case 'unit':
      return {
        label: '单位',
        class: 'bg-orange-100 text-orange-700',
        icon: '📏'
      };
    case 'threshold':
      return {
        label: '阈值',
        class: 'bg-red-100 text-red-700',
        icon: '🚨'
      };
    case 'extrapolation':
      return {
        label: '外推',
        class: 'bg-yellow-100 text-yellow-700',
        icon: '📈'
      };
    case 'alias':
      return {
        label: '别名',
        class: 'bg-blue-100 text-blue-700',
        icon: '🔄'
      };
    case 'consistency':
      return {
        label: '材料一致性',
        class: 'bg-teal-100 text-teal-700',
        icon: '🔗'
      };
    case 'caliber':
      return {
        label: '口径变更',
        class: 'bg-indigo-100 text-indigo-700',
        icon: '🔀'
      };
  }
}

interface SeverityBadgeProps {
  severity: 'error' | 'warning' | 'info';
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const config = getSeverityConfig(severity);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.class}`}>
      {config.icon}
      <span className="ml-1">{config.label}</span>
    </span>
  );
}

function getSeverityConfig(severity: 'error' | 'warning' | 'info') {
  switch (severity) {
    case 'error':
      return {
        label: '错误',
        class: 'bg-red-100 text-red-700',
        icon: '❌'
      };
    case 'warning':
      return {
        label: '警告',
        class: 'bg-yellow-100 text-yellow-700',
        icon: '⚠️'
      };
    case 'info':
      return {
        label: '提示',
        class: 'bg-blue-100 text-blue-700',
        icon: 'ℹ️'
      };
  }
}

interface SourceTypeBadgeProps {
  type: 'file' | 'remark' | 'oral';
}

export function SourceTypeBadge({ type }: SourceTypeBadgeProps) {
  const config = getSourceTypeConfig(type);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.class}`}>
      {config.icon}
      <span className="ml-1">{config.label}</span>
    </span>
  );
}

function getSourceTypeConfig(type: 'file' | 'remark' | 'oral') {
  switch (type) {
    case 'file':
      return {
        label: '文件',
        class: 'bg-blue-100 text-blue-700',
        icon: '📄'
      };
    case 'remark':
      return {
        label: '备注',
        class: 'bg-green-100 text-green-700',
        icon: '📝'
      };
    case 'oral':
      return {
        label: '口头',
        class: 'bg-purple-100 text-purple-700',
        icon: '💬'
      };
  }
}
