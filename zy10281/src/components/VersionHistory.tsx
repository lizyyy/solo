import React, { useState } from 'react';
import { BuildingVersion } from '../types';
import { ElevatorSignStore } from '../store';

interface VersionHistoryProps {
  buildingId: string;
  versions: BuildingVersion[];
  onCreateVersion: (name: string, description: string, changeLog: string) => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  buildingId,
  versions,
  onCreateVersion,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [description, setDescription] = useState('');
  const [changeLog, setChangeLog] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const handleCreate = () => {
    if (versionName.trim()) {
      onCreateVersion(versionName, description, changeLog);
      setShowCreateModal(false);
      setVersionName('');
      setDescription('');
      setChangeLog('');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">版本历史</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
        >
          + 新建版本
        </button>
      </div>

      <div className="space-y-4">
        {versions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无版本记录
          </div>
        ) : (
          versions.map(version => (
            <div
              key={version.id}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                version.isEffective
                  ? 'border-green-500 bg-green-50'
                  : selectedVersion === version.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
              onClick={() => setSelectedVersion(
                selectedVersion === version.id ? null : version.id
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    version.isEffective
                      ? 'bg-green-200 text-green-700'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    v{version.versionNumber}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-800">{version.versionName}</h3>
                    <p className="text-sm text-gray-500 mt-1">{version.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  {version.isEffective && (
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                      当前有效
                    </span>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    {version.createdBy} · {new Date(version.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {selectedVersion === version.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">变更记录:</span> {version.changeLog || '无'}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">创建新版本</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">版本名称</label>
                <input
                  type="text"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  placeholder="例如: 优化方案版"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">版本描述</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  placeholder="简要描述此版本"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">变更记录</label>
                <textarea
                  value={changeLog}
                  onChange={(e) => setChangeLog(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  rows={3}
                  placeholder="详细说明变更内容..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
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
