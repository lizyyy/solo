import { useState } from 'react';
import { FileSpreadsheet, Clock, User, ChevronDown, ChevronUp, GitCompare, Eye } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { formatDate } from '@/utils/format';
import { cn } from '@/lib/utils';

export default function AnnouncementManagement() {
  const { announcements } = useStore();
  const [expandedBond, setExpandedBond] = useState<string | null>(null);
  const [compareVersions, setCompareVersions] = useState<{
    bondCode: string;
    v1: string;
    v2: string;
  } | null>(null);

  const uniqueBonds = Array.from(new Map(announcements.map((a) => [a.bondCode, a])).values());

  const getVersionsForBond = (bondCode: string) => {
    return announcements
      .filter((a) => a.bondCode === bondCode)
      .flatMap((a) => a.versions)
      .sort((a, b) => a.publishDate.localeCompare(b.publishDate));
  };

  const getAnnouncementForBond = (bondCode: string) => {
    return announcements.find((a) => a.bondCode === bondCode);
  };

  const handleCompare = (bondCode: string, v1: string, v2: string) => {
    if (v1 === v2) return;
    setCompareVersions({ bondCode, v1, v2 });
  };

  const getVersionDiff = (bondCode: string, v1: string, v2: string) => {
    const announcement = getAnnouncementForBond(bondCode);
    if (!announcement) return [];

    const version1 = announcement.versions.find((v) => v.versionNo === v1);
    const version2 = announcement.versions.find((v) => v.versionNo === v2);

    if (!version1 || !version2) return [];

    const diffs: { field: string; old: unknown; new: unknown; changedIn: string | null }[] = [];

    const allFields = new Set([
      ...Object.keys(version1.contentDiff),
      ...Object.keys(version2.contentDiff),
    ]);

    allFields.forEach((field) => {
      const v1Diff = version1.contentDiff[field];
      const v2Diff = version2.contentDiff[field];

      if (v2Diff) {
        diffs.push({
          field,
          old: v2Diff.old,
          new: v2Diff.new,
          changedIn: v2,
        });
      } else if (v1Diff) {
        diffs.push({
          field,
          old: v1Diff.old,
          new: v1Diff.new,
          changedIn: v1,
        });
      }
    });

    return diffs;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-semibold text-primary-900">公告管理</h2>
        <p className="text-sm text-neutral-500 mt-1">管理回售公告版本，对比版本差异</p>
      </div>

      <div className="space-y-4">
        {uniqueBonds.map((announcement) => {
          const bondCode = announcement.bondCode;
          const versions = getVersionsForBond(bondCode);
          const fullAnnouncement = getAnnouncementForBond(bondCode);
          const isExpanded = expandedBond === bondCode;

          return (
            <div key={bondCode} className="card overflow-hidden">
              <div
                className="flex items-center justify-between px-5 py-4 bg-neutral-50 border-b border-neutral-200 cursor-pointer"
                onClick={() => setExpandedBond(isExpanded ? null : bondCode)}
              >
                <div className="flex items-center gap-4">
                  <FileSpreadsheet className="w-5 h-5 text-primary-600" />
                  <div>
                    <h3 className="font-medium text-neutral-800">
                      {announcement.bondName}
                      <span className="ml-2 font-mono text-sm text-neutral-500 font-normal">
                        {bondCode}
                      </span>
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      当前版本：{fullAnnouncement?.versionNo} · 共 {versions.length} 个历史版本
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-neutral-500">
                    <span className="text-accent-600 font-medium">
                      {formatDate(fullAnnouncement?.exerciseDate || '')}
                    </span>
                    <span className="mx-2">·</span>
                    <span className="font-mono">
                      {fullAnnouncement?.exercisePrice.toFixed(2)} 元
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-neutral-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-neutral-500" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="p-5">
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-neutral-700 mb-3">公告基本信息</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-neutral-50 p-3 rounded">
                        <p className="text-xs text-neutral-500 mb-1">公告编号</p>
                        <p className="font-mono text-xs">{fullAnnouncement?.announcementId}</p>
                      </div>
                      <div className="bg-neutral-50 p-3 rounded">
                        <p className="text-xs text-neutral-500 mb-1">行权日</p>
                        <p className="font-mono text-sm">
                          {formatDate(fullAnnouncement?.exerciseDate || '')}
                        </p>
                      </div>
                      <div className="bg-neutral-50 p-3 rounded">
                        <p className="text-xs text-neutral-500 mb-1">行权价格</p>
                        <p className="font-mono text-sm">
                          {fullAnnouncement?.exercisePrice.toFixed(2)} 元
                        </p>
                      </div>
                      <div className="bg-neutral-50 p-3 rounded">
                        <p className="text-xs text-neutral-500 mb-1">公告日期</p>
                        <p className="font-mono text-sm">
                          {formatDate(fullAnnouncement?.announcementDate || '')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-neutral-700">版本历史</h4>
                      {versions.length >= 2 && (
                        <button
                          onClick={() =>
                            handleCompare(
                              bondCode,
                              versions[0].versionNo,
                              versions[versions.length - 1].versionNo
                            )
                          }
                          className="btn-outline gap-1 text-xs py-1.5"
                        >
                          <GitCompare className="w-3.5 h-3.5" />
                          对比首尾版本
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      {versions.map((version, index) => (
                        <div key={version.versionId} className="flex gap-4 pb-6 last:pb-0">
                          <div className="relative flex flex-col items-center">
                            <div
                              className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white z-10',
                                index === versions.length - 1
                                  ? 'border-accent-500 bg-accent-50'
                                  : 'border-neutral-300'
                              )}
                            >
                              <Clock
                                className={cn(
                                  'w-4 h-4',
                                  index === versions.length - 1
                                    ? 'text-accent-500'
                                    : 'text-neutral-400'
                                )}
                              />
                            </div>
                            {index < versions.length - 1 && (
                              <div className="w-0.5 h-full bg-neutral-200 absolute top-8" />
                            )}
                          </div>
                          <div className="flex-1 pb-2">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-medium text-primary-700">
                                  {version.versionNo}
                                </span>
                                {index === versions.length - 1 && (
                                  <span className="tag bg-accent-100 text-accent-700 border-accent-300 text-xs">
                                    当前版本
                                  </span>
                                )}
                              </div>
                              {versions.length >= 2 && index < versions.length - 1 && (
                                <button
                                  onClick={() =>
                                    handleCompare(
                                      bondCode,
                                      version.versionNo,
                                      versions[index + 1].versionNo
                                    )
                                  }
                                  className="text-xs text-accent-600 hover:text-accent-700 flex items-center gap-1"
                                >
                                  <GitCompare className="w-3 h-3" />
                                  与下一版本对比
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-neutral-500 mb-2">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(version.publishDate)}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {version.operator}
                              </span>
                            </div>
                            {Object.keys(version.contentDiff).length > 0 ? (
                              <div className="bg-neutral-50 rounded p-3 text-xs">
                                <p className="text-neutral-500 mb-2 font-medium">变更内容：</p>
                                {Object.entries(version.contentDiff).map(([key, value]) => (
                                  <div key={key} className="text-neutral-600 mb-1 last:mb-0">
                                    <span className="font-medium">{key}：</span>
                                    <span className="line-through text-neutral-400">
                                      {String(value.old)}
                                    </span>{' '}
                                    → <span className="text-accent-600">{String(value.new)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="bg-neutral-50 rounded p-3 text-xs text-neutral-400">
                                无内容变更
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {compareVersions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <h3 className="text-lg font-medium text-neutral-900">版本对比</h3>
              <span className="text-sm text-neutral-500">
                {compareVersions.v1} → {compareVersions.v2}
              </span>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto scrollbar-thin">
              {getVersionDiff(
                compareVersions.bondCode,
                compareVersions.v1,
                compareVersions.v2
              ).length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">两个版本无差异</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getVersionDiff(
                    compareVersions.bondCode,
                    compareVersions.v1,
                    compareVersions.v2
                  ).map((diff, index) => (
                    <div key={index} className="bg-neutral-50 rounded p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-neutral-800">{diff.field}</span>
                        {diff.changedIn && (
                          <span className="text-xs text-accent-600 bg-accent-50 px-2 py-0.5 rounded">
                            在 {diff.changedIn} 变更
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-neutral-500 mb-1">变更前</p>
                          <p className="font-mono text-neutral-600 line-through">
                            {String(diff.old)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500 mb-1">变更后</p>
                          <p className="font-mono text-accent-600 font-medium">
                            {String(diff.new)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex justify-end">
              <button
                onClick={() => setCompareVersions(null)}
                className="btn-outline"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
