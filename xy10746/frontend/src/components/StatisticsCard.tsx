import React from 'react';
import { AuditStatistics } from '../types';
import { FileText, Clock, CheckCircle, XCircle, Upload, Download, Shield, Timer } from 'lucide-react';

interface StatisticsCardProps {
  statistics: AuditStatistics;
}

const StatisticsCard: React.FC<StatisticsCardProps> = ({ statistics }) => {
  const stats = [
    {
      label: '总版本数',
      value: statistics.totalVersions,
      icon: FileText,
      color: 'bg-blue-500',
    },
    {
      label: '待审核',
      value: statistics.pendingReview,
      icon: Clock,
      color: 'bg-yellow-500',
    },
    {
      label: '已通过',
      value: statistics.approved,
      icon: CheckCircle,
      color: 'bg-green-500',
    },
    {
      label: '已驳回',
      value: statistics.rejected,
      icon: XCircle,
      color: 'bg-red-500',
    },
    {
      label: '已上架',
      value: statistics.published,
      icon: Upload,
      color: 'bg-emerald-500',
    },
    {
      label: '已下架',
      value: statistics.unpublished,
      icon: Download,
      color: 'bg-orange-500',
    },
    {
      label: '安全通过率',
      value: `${statistics.securityPassRate}%`,
      icon: Shield,
      color: 'bg-cyan-500',
    },
    {
      label: '平均审核时长',
      value: `${statistics.avgReviewTimeHours}小时`,
      icon: Timer,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
            <div className={`${stat.color} p-3 rounded-lg`}>
              <stat.icon className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatisticsCard;
