import { useState, useMemo } from 'react';
import { GitBranch, ArrowLeft, FileDiff } from 'lucide-react';
import { useAllocationStore } from '@/store/useAllocationStore';
import { VersionTimeline } from '@/components/VersionTimeline';
import { compareVersions, getDiffStats, type VersionDiff } from '@/utils/versionCompare';
import { PERSON_TYPE_LABELS, STATUS_LABELS } from '@/types';
import { Link } from 'react-router-dom';

const FIELD_LABELS: Record<string, string> = {
  roomType: '房型',
  personName: '入住人',
  personType: '人员类型',
  checkInDate: '入住日期',
  checkOutDate: '退房日期',
  hotelName: '酒店名称',
  remarks: '备注',
  status: '状态',
};

export const VersionManage = () => {
  const versions = useAllocationStore(state => state.versions);
  const getVersionAllocations = useAllocationStore(state => state.getVersionAllocations);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);

  const sortedVersions = useMemo(() => 
    [...versions].sort((a, b) => b.versionNumber - a.versionNumber),
    [versions]
  );

  const selectedVersion = useMemo(() => 
    versions.find(v => v.id === selectedVersionId),
    [versions, selectedVersionId]
  );

  const compareVersion = useMemo(() => 
    versions.find(v => v.id === compareVersionId),
    [versions, compareVersionId]
  );

  const diff: VersionDiff[] = useMemo(() => {
    if (!selectedVersionId || !compareVersionId) return [];
    const oldRecords = getVersionAllocations(compareVersionId);
    const newRecords = getVersionAllocations(selectedVersionId);
    return compareVersions(oldRecords, newRecords);
  }, [getVersionAllocations, selectedVersionId, compareVersionId]);

  const diffStats = getDiffStats(diff);

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-900 rounded-lg">
                <GitBranch className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-serif text-xl font-bold text-gray-800">
                  版本管理
                </h1>
                <p className="text-sm text-gray-500">
                  查看历史版本、对比差异
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
          <div className="card">
            <h3 className="font-serif text-lg font-semibold text-gray-800 mb-4">
              版本历史
            </h3>
            <VersionTimeline
              versions={versions}
              selectedVersionId={selectedVersionId || undefined}
              onSelectVersion={(id) => {
                setSelectedVersionId(id);
                if (sortedVersions.length > 1) {
                  const currentIndex = sortedVersions.findIndex(v => v.id === id);
                  if (currentIndex < sortedVersions.length - 1) {
                    setCompareVersionId(sortedVersions[currentIndex + 1].id);
                  } else {
                    setCompareVersionId(null);
                  }
                }
              }}
            />
          </div>
          </div>

          <div className="lg:col-span-2">
            {selectedVersionId && (
              <div className="space-y-4">
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif text-lg font-semibold text-gray-800">
                      版本详情
                    </h3>
                    {compareVersionId && (
                      <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">对比：</span>
                      <select
                        value={compareVersionId}
                        onChange={(e) => setCompareVersionId(e.target.value || null)}
                        className="input-base text-sm py-1"
                      >
                        <option value="">选择对比版本</option>
                        {sortedVersions
                          .filter(v => v.id !== selectedVersionId)
                          .map(v => (
                            <option key={v.id} value={v.id}>{v.versionName}</option>
                          ))}
                      </select>
                    </div>
                    )}
                  </div>

                  {selectedVersion && (
                    <div className="bg-primary-50 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">版本号</div>
                          <div className="font-medium">{selectedVersion.versionName}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">记录数</div>
                          <div className="font-medium">{selectedVersion.recordCount} 条</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">操作人</div>
                          <div className="font-medium">{selectedVersion.operator}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">来源文件</div>
                          <div className="font-medium">{selectedVersion.sourceFile}</div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-primary-100">
                        <div className="text-sm text-gray-500">变更说明</div>
                        <div className="font-medium">{selectedVersion.changeNote}</div>
                      </div>
                    </div>
                  )}

                  {compareVersionId && diff.length > 0 && (
                    <>
                      <div className="flex items-center gap-4 mb-4">
                      <FileDiff className="w-5 h-5 text-primary-600" />
                      <span className="font-medium text-gray-800">版本差异</span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-green-600">+{diffStats.added} 新增</span>
                        <span className="text-red-600">-{diffStats.removed} 删除</span>
                        <span className="text-yellow-600">~{diffStats.modified} 修改</span>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {diff.map((item, index) => {
                        const borderClass = item.type === 'added'
                          ? 'border-green-200 bg-green-50'
                          : item.type === 'removed'
                          ? 'border-red-200 bg-red-50'
                          : 'border-yellow-200 bg-yellow-50';
                        return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border ${borderClass}`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`badge ${
                              item.type === 'added'
                                ? 'bg-green-100 text-green-700'
                                : item.type === 'removed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {item.type === 'added' ? '新增' : item.type === 'removed' ? '删除' : '修改'}
                            </span>
                            <span className="text-sm text-gray-600">
                              {item.record.personName || '（未填姓名）'}
                              · {item.record.hotelName}
                            </span>
                          </div>

                          {item.type === 'modified' && item.modifiedFields ? (
                            <div className="space-y-1 text-sm">
                              {item.modifiedFields.map((field, fIndex) => {
                                return (
                                  <div key={fIndex} className="flex items-center gap-2">
                                    <span className="text-gray-500">
                                      {FIELD_LABELS[field.field] || field.field}:
                                    </span>
                                    <span className="text-red-600 line-through">
                                      {field.oldValue || '(空)'}
                                    </span>
                                    <span className="text-gray-400">→</span>
                                    <span className="text-green-600">
                                      {field.newValue || '(空)'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600">
                              <div>房型：{item.record.roomType}</div>
                              <div>入住：{item.record.checkInDate}</div>
                              <div>类型：{PERSON_TYPE_LABELS[item.record.personType] || item.record.personType}</div>
                              <div>状态：{STATUS_LABELS[item.record.status] || item.record.status}</div>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {!compareVersionId && diff.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <FileDiff className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>两个版本完全一致</p>
                  </div>
                )}

                {!compareVersionId && (
                  <div className="text-center py-8 text-gray-400">
                    <p>选择一个版本进行对比</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!selectedVersionId && (
            <div className="card text-center py-12 text-gray-400">
              <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>点击左侧版本查看详情</p>
            </div>
          )}
          </div>
        </div>
      </main>
    </div>
  );
};
