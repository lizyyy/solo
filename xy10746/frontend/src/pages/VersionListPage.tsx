import React, { useEffect, useState } from 'react';
import { versionApi } from '../api';
import { PluginVersion, ApiResponseStatus } from '../types';
import VersionList from '../components/VersionList';
import ApiResponseAlert from '../components/ApiResponseAlert';

const VersionListPage: React.FC = () => {
  const [versions, setVersions] = useState<PluginVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ status: ApiResponseStatus; message: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await versionApi.getAll();
        if (res.data) {
          setVersions(res.data);
        }
      } catch (error) {
        setAlert({
          status: ApiResponseStatus.BLOCKED,
          message: '加载版本列表失败',
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
        <h1 className="text-2xl font-bold text-gray-900">版本列表</h1>
      </div>

      {alert && (
        <ApiResponseAlert
          status={alert.status}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <VersionList versions={versions} loading={loading} />
    </div>
  );
};

export default VersionListPage;
