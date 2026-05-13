import React from 'react';
import { Tag } from 'antd';
import {
  LineChangeStatus,
  CheckStatus,
  KittingStatus,
  InspectionStatus
} from '../types';

export const LineChangeStatusTag: React.FC<{ status: LineChangeStatus }> = ({ status }) => {
  const statusConfig: Record<LineChangeStatus, { color: string; text: string }> = {
    DRAFT: { color: 'default', text: '草稿' },
    PENDING: { color: 'orange', text: '待审批' },
    IN_PROGRESS: { color: 'processing', text: '进行中' },
    COMPLETED: { color: 'success', text: '已完成' },
    REVIEW: { color: 'blue', text: '待复核' },
    REJECTED: { color: 'error', text: '已拒绝' },
    CANCELLED: { color: 'default', text: '已取消' }
  };

  const config = statusConfig[status] || statusConfig.DRAFT;
  return <Tag color={config.color}>{config.text}</Tag>;
};

export const CheckStatusTag: React.FC<{ status: CheckStatus }> = ({ status }) => {
  const statusConfig: Record<CheckStatus, { color: string; text: string }> = {
    NOT_STARTED: { color: 'default', text: '未开始' },
    IN_PROGRESS: { color: 'processing', text: '进行中' },
    PASSED: { color: 'success', text: '通过' },
    FAILED: { color: 'error', text: '未通过' },
    REVIEWED: { color: 'blue', text: '已复核' }
  };

  const config = statusConfig[status] || statusConfig.NOT_STARTED;
  return <Tag color={config.color}>{config.text}</Tag>;
};

export const KittingStatusTag: React.FC<{ status: KittingStatus }> = ({ status }) => {
  const statusConfig: Record<KittingStatus, { color: string; text: string }> = {
    NOT_STARTED: { color: 'default', text: '未开始' },
    IN_PROGRESS: { color: 'processing', text: '进行中' },
    PARTIAL: { color: 'orange', text: '部分齐套' },
    COMPLETE: { color: 'success', text: '完全齐套' },
    MISSING: { color: 'error', text: '缺件' }
  };

  const config = statusConfig[status] || statusConfig.NOT_STARTED;
  return <Tag color={config.color}>{config.text}</Tag>;
};

export const InspectionStatusTag: React.FC<{ status: InspectionStatus }> = ({ status }) => {
  const statusConfig: Record<InspectionStatus, { color: string; text: string }> = {
    NOT_STARTED: { color: 'default', text: '未开始' },
    IN_PROGRESS: { color: 'processing', text: '进行中' },
    PASSED: { color: 'success', text: '通过' },
    FAILED: { color: 'error', text: '未通过' },
    REWORK: { color: 'orange', text: '返工' },
    REVIEWED: { color: 'blue', text: '已复核' }
  };

  const config = statusConfig[status] || statusConfig.NOT_STARTED;
  return <Tag color={config.color}>{config.text}</Tag>;
};

export const MissingItemStatusTag: React.FC<{ status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' }> = ({ status }) => {
  const statusConfig = {
    OPEN: { color: 'error', text: '待处理' },
    IN_PROGRESS: { color: 'processing', text: '处理中' },
    RESOLVED: { color: 'success', text: '已解决' },
    CLOSED: { color: 'default', text: '已关闭' }
  };

  const config = statusConfig[status] || statusConfig.OPEN;
  return <Tag color={config.color}>{config.text}</Tag>;
};

export const MissingItemCategoryTag: React.FC<{ category: 'MOLD' | 'MATERIAL' | 'TOOL' | 'DOCUMENT' | 'OTHER' }> = ({ category }) => {
  const categoryConfig = {
    MOLD: { color: 'purple', text: '模具' },
    MATERIAL: { color: 'orange', text: '物料' },
    TOOL: { color: 'blue', text: '工具' },
    DOCUMENT: { color: 'green', text: '文档' },
    OTHER: { color: 'default', text: '其他' }
  };

  const config = categoryConfig[category] || categoryConfig.OTHER;
  return <Tag color={config.color}>{config.text}</Tag>;
};

export const QualificationStatusTag: React.FC<{ status: 'VALID' | 'EXPIRED' | 'REVOKED' }> = ({ status }) => {
  const statusConfig = {
    VALID: { color: 'success', text: '有效' },
    EXPIRED: { color: 'error', text: '过期' },
    REVOKED: { color: 'default', text: '已撤销' }
  };

  const config = statusConfig[status] || statusConfig.VALID;
  return <Tag color={config.color}>{config.text}</Tag>;
};
