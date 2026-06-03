import React, { useState, useEffect } from 'react';
import { GitBranch, Plus, CheckCircle, AlertTriangle, Clock, User, Info, Send } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { versionApi } from '../api/versionApi';
import { StatusBadge } from '../components/StatusBadge';
import type { ParameterVersion } from '../../shared/types';
import dayjs from 'dayjs';

export const VersionsPage: React.FC = () => {
  const {
    currentUser,
    versions,
    setVersions,
    isWeightReviewed,
    setLoading,
    setError,
  } = useAppStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [versionNo, setVersionNo] = useState('');
  const [canPublishInfo, setCanPublishInfo] = useState<{ canPublish: boolean; reason?: string } | null>(null);

  useEffect(() => {
    loadVersions();
    checkCanPublish();
  }, []);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const res = await versionApi.getVersions();
      setVersions(res.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const checkCanPublish = async () => {
    try {
      const res = await versionApi.canPublish();
      setCanPublishInfo(res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCreateVersion = async () => {
    if (!versionNo.trim()) {
      alert('请输入版本号');
      return;
    }
    try {
      setLoading(true);
      await versionApi.createVersion({
        versionNo: versionNo.trim(),
        createdBy: currentUser,
      });
      setShowCreateModal(false);
      setVersionNo('');
      await loadVersions();
      await checkCanPublish();
    } catch (e: any) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (id: string) => {
    if (!confirm('确认发布此版本？发布后将不可修改。')) {
      return;
    }
    try {
      setLoading(true);
      await versionApi.publishVersion(id);
      await loadVersions();
      await checkCanPublish();
      alert('版本发布成功');
    } catch (e: any) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const generateNextVersionNo = () => {
    const today = dayjs().format('YYYYMMDD');
    const todayVersions = versions.filter((v) => v.versionNo.startsWith(`v${today}`));
    const seq = todayVersions.length + 1;
    return `v${today}.${seq}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-gray-900">参数版本</h2>
          <p className="mt-1 text-sm text-gray-500">
            第三步：创建参数版本，系统自动检测编号断档，由教研组复核后发布
          </p>
        </div>
        <button
          onClick={() => {
            setVersionNo(generateNextVersionNo());
            setShowCreateModal(true);
          }}
          disabled={!isWeightReviewed}
          className={`inline-flex items-center px-4 py-2 font-medium transition-colors ${
            !isWeightReviewed
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-primary-500 text-white hover:bg-primary-600'
          }`}
        >
          <Plus className="w-4 h-4 mr-2" />
          创建新版本
        </button>
      </div>

      {!isWeightReviewed && (
        <div className="bg-warning-50 border-2 border-warning-400 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-warning-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-warning-800">请先完成评分权重表补看</h4>
              <p className="mt-1 text-sm text-warning-700">
                需要吴老师先在"评分权重表"页面标记已补看，才能创建参数版本。
              </p>
            </div>
          </div>
        </div>
      )}

      {canPublishInfo && !canPublishInfo.canPublish && (
        <div className="bg-warning-50 border-2 border-warning-400 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-warning-600 mt-0.5 mr-3 flex-shrink-0 animate-pulse" />
            <div>
              <h4 className="font-medium text-warning-800">版本发布条件未满足</h4>
              <p className="mt-1 text-sm text-warning-700">{canPublishInfo.reason}</p>
            </div>
          </div>
        </div>
      )}

      {canPublishInfo?.canPublish && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-green-800">版本发布条件已满足</h4>
              <p className="mt-1 text-sm text-green-700">
                评分权重表已补看，且无编号断档问题，可以创建和发布版本。
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {versions.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
            <GitBranch className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无参数版本</h3>
            <p className="text-gray-500">
              {isWeightReviewed
                ? '点击右上角"创建新版本"按钮创建第一个参数版本'
                : '请先完成评分权重表补看，然后创建参数版本'}
            </p>
          </div>
        ) : (
          versions.map((version) => (
            <VersionCard
              key={version.id}
              version={version}
              onPublish={() => handlePublish(version.id)}
              canPublish={canPublishInfo?.canPublish || false}
            />
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="font-serif text-xl font-bold text-gray-900 mb-4">创建参数版本</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">版本号</label>
                <input
                  type="text"
                  value={versionNo}
                  onChange={(e) => setVersionNo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  placeholder="如：v20240101.1"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
                <p className="font-medium mb-1">创建版本时将自动执行：</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>检测编号断档情况</li>
                  <li>关联已补看的评分权重表</li>
                  <li>如存在断档，标记为"待教研组复核"</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateVersion}
                className="px-4 py-2 bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
              >
                创建版本
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface VersionCardProps {
  version: ParameterVersion;
  onPublish: () => void;
  canPublish: boolean;
}

const VersionCard: React.FC<VersionCardProps> = ({ version, onPublish, canPublish }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className={`px-6 py-4 border-b border-gray-100 ${
        version.status === 'published' ? 'bg-green-50' : version.hasGap ? 'bg-warning-50' : 'bg-gray-50'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-10 h-10 rounded flex items-center justify-center ${
              version.status === 'published' ? 'bg-green-200' : 'bg-gray-200'
            }`}>
              <GitBranch className={`w-5 h-5 ${
                version.status === 'published' ? 'text-green-700' : 'text-gray-600'
              }`} />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h3 className="font-serif text-lg font-bold text-gray-900">{version.versionNo}</h3>
                <StatusBadge status={version.status} />
                {version.hasGap && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-300">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    存在编号断档
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-gray-500 flex items-center space-x-4">
                <span className="flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  {version.createdBy}
                </span>
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {dayjs(version.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </span>
                {version.publishedAt && (
                  <span className="flex items-center text-green-600">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    发布于 {dayjs(version.publishedAt).format('YYYY-MM-DD HH:mm:ss')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {version.status === 'draft' && !version.hasGap && (
              <button
                onClick={onPublish}
                disabled={!canPublish}
                className={`inline-flex items-center px-4 py-2 font-medium transition-colors ${
                  !canPublish
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <Send className="w-4 h-4 mr-2" />
                发布版本
              </button>
            )}
            {version.status === 'pending_review' && (
              <div className="flex items-center text-warning-600 text-sm">
                <Info className="w-4 h-4 mr-1" />
                待教研组复核断档问题
              </div>
            )}
            {version.status === 'published' && (
              <div className="flex items-center text-green-600 text-sm">
                <CheckCircle className="w-4 h-4 mr-1" />
                已发布
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="px-6 py-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">关联评分权重表：</span>
            <span className="ml-1 font-medium text-gray-900">{version.weightBatchId}</span>
          </div>
          <div>
            <span className="text-gray-500">编号断档：</span>
            <span className={`ml-1 font-medium ${version.hasGap ? 'text-red-600' : 'text-green-600'}`}>
              {version.hasGap ? '存在' : '不存在'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">版本ID：</span>
            <span className="ml-1 font-mono text-gray-500 text-xs">{version.id.slice(0, 8)}...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
