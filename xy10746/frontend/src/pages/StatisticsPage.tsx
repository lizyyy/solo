import React, { useEffect, useState } from 'react';
import { statisticsApi } from '../api';
import { AuditStatistics, ApiResponseStatus } from '../types';
import StatisticsCard from '../components/StatisticsCard';
import ApiResponseAlert from '../components/ApiResponseAlert';

const StatisticsPage: React.FC = () => {
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ status: ApiResponseStatus; message: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await statisticsApi.get();
        if (res.data) {
          setStatistics(res.data);
        }
      } catch (error) {
        setAlert({
          status: ApiResponseStatus.BLOCKED,
          message: '加载统计数据失败',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">统计概览</h1>
      </div>

      {alert && (
        <ApiResponseAlert
          status={alert.status}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      {statistics && <StatisticsCard statistics={statistics} />}

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">统计说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">审核状态说明</h4>
            <ul className="space-y-1">
              <li>• 待审核：已通过安全扫描，等待人工审核</li>
              <li>• 已通过：审核通过，可上架</li>
              <li>• 已驳回：审核不通过，需要修改</li>
              <li>• 待复核：已提交复核申请，等待重新审核</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">安全扫描说明</h4>
            <ul className="space-y-1">
              <li>• 安全通过率 = 通过扫描的版本数 / 总扫描版本数</li>
              <li>• 扫描发现严重问题将自动驳回</li>
              <li>• 失败版本可在重试次数内重新扫描</li>
              <li>• 默认最大重试次数：3次</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsPage;
