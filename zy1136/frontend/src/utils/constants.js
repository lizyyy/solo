import React from 'react';
import {
  DesktopOutlined,
  ApartmentOutlined,
  ShareAltOutlined,
  WarningOutlined,
  ProfileOutlined,
  BellOutlined,
  ImportOutlined,
  FileTextOutlined,
  DashboardOutlined,
} from '@ant-design/icons';

export const SEVERITY_COLORS = {
  critical: '#ff4d4f',
  high: '#fa8c16',
  medium: '#faad14',
  low: '#52c41a',
  info: '#1890ff',
};

export const SEVERITY_LABELS = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
  info: '信息',
};

export const ASSET_TYPES = {
  computer: '电脑',
  server: '服务器',
  printer: '打印机',
  switch: '交换机',
  router: '路由器',
  ap: '无线AP',
  camera: '摄像头',
  firewall: '防火墙',
  other: '其他',
};

export const CHANGE_STATUS_LABELS = {
  pending_evaluation: '待评估',
  approved: '已批准',
  rejected: '已拒绝',
  executing: '执行中',
  executed: '已执行',
  rolling_back: '回滚中',
  rolled_back: '已回滚',
  completed: '已完成',
};

export const CHANGE_STATUS_COLORS = {
  pending_evaluation: 'orange',
  approved: 'blue',
  rejected: 'red',
  executing: 'cyan',
  executed: 'purple',
  rolling_back: 'gold',
  rolled_back: 'default',
  completed: 'green',
};

export const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '资产看板',
  },
  {
    key: '/network',
    icon: <ApartmentOutlined />,
    label: '网段/VLAN',
  },
  {
    key: '/topology',
    icon: <ShareAltOutlined />,
    label: '拓扑关系',
  },
  {
    key: '/risks',
    icon: <WarningOutlined />,
    label: '风险列表',
  },
  {
    key: '/changes',
    icon: <ProfileOutlined />,
    label: '变更单',
  },
  {
    key: '/alerts',
    icon: <BellOutlined />,
    label: '告警处理',
  },
  {
    key: '/import',
    icon: <ImportOutlined />,
    label: '数据导入',
  },
  {
    key: '/reports',
    icon: <FileTextOutlined />,
    label: '报告导出',
  },
];

export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const formatDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const truncateText = (text, maxLength = 50) => {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const getStatusBadge = (status) => {
  const statusMap = {
    active: { text: '在线', color: 'success' },
    inactive: { text: '离线', color: 'default' },
    maintenance: { text: '维护中', color: 'warning' },
    retired: { text: '已退役', color: 'default' },
  };
  return statusMap[status] || { text: status, color: 'default' };
};
