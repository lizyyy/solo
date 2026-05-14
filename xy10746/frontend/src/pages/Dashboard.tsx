import React, { useEffect, useState } from 'react';
import { statisticsApi, versionApi } from '../api';
import { AuditStatistics, PluginVersion, ApiResponseStatus } from '../types';
import StatisticsCard from '../components/StatisticsCard';
import VersionList from '../components/VersionList';
import ApiResponseAlert from '../components/ApiResponseAlert';

const Dashboard: React.FC = () => {
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null);
  const [versions, setVersions] = useState<PluginVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ status: ApiResponseStatus; message: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, versionsRes] = await Promise.all([
          statisticsApi.get(),
          versionApi.getAll(),
        ]);

        if (statsRes.status === ApiResponseStatus.SUCCESS && statsRes.data) {
          setStatistics(statsRes.data);
        }

        if (versionsRes.status === ApiResponseStatus.SUCCESS && versionsRes.data) {
          setVersions(versionsRes.data.slice(0, 10));
        }
      } catch (error) {
        setAlert({
          status: ApiResponseStatus.BLOCKED,
          message: '加载数据失败，请稍后重试',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">审核概览</h1>
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">最近提交的版本</h2>
        <VersionList versions={versions} loading={loading} />
      </div>
    </div>
  );
};

export default Dashboard;
