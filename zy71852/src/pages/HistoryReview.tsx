import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, GitBranch, Clock, User, FileText, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useExperiments } from '@/hooks/useExperiments';
import { useScriptDiff } from '@/hooks/useDiff';
import { SideBySideDiff, DiffViewer } from '@/components/DiffViewer';
import { formatDateTime } from '@/utils/date';
import type { ScriptVersion } from '@/types';

export function HistoryReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getExperimentById, getScriptVersionsByExperimentId } = useExperiments();

  const experiment = id ? getExperimentById(id) : undefined;
  const scriptVersions = id ? getScriptVersionsByExperimentId(id) : [];

  const [selectedVersion, setSelectedVersion] = useState<string | null>(
    scriptVersions.length > 0 ? scriptVersions[0].version : null
  );
  const [compareWith, setCompareWith] = useState<string | null>(
    scriptVersions.length > 1 ? scriptVersions[1].version : null
  );
  const [viewMode, setViewMode] = useState<'single' | 'compare'>('single');

  const { getVersionDiff } = useScriptDiff(scriptVersions);

  const currentVersion = scriptVersions.find((v) => v.version === selectedVersion);
  const compareVersion = scriptVersions.find((v) => v.version === compareWith);

  const diffs = selectedVersion && compareWith
    ? getVersionDiff(compareWith, selectedVersion)
    : [];

  if (!experiment) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <p>实验不存在</p>
        <button onClick={() => navigate('/experiments')} className="mt-4 text-primary hover:underline">
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/experiments/${id}`)}
          className="flex items-center gap-1 text-neutral-600 hover:text-primary transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">返回详情</span>
        </button>
        <h2 className="text-lg font-mono font-semibold text-neutral-900">
          历史回溯 - {experiment.studentName}
        </h2>
        <GitBranch size={20} className="text-purple-600" />
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-neutral-700">演示脚本版本历史</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('single')}
              className={`px-3 py-1.5 text-xs border rounded transition-colors ${
                viewMode === 'single'
                  ? 'bg-primary text-white border-primary'
                  : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              单版本查看
            </button>
            <button
              onClick={() => setViewMode('compare')}
              className={`px-3 py-1.5 text-xs border rounded transition-colors ${
                viewMode === 'compare'
                  ? 'bg-primary text-white border-primary'
                  : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              版本对比
            </button>
          </div>
        </div>

        {scriptVersions.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            <FileText size={32} className="mx-auto mb-2 text-neutral-400" />
            <p>暂无脚本版本记录</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-4">
              <div className="text-xs font-medium text-neutral-600 mb-3">版本列表</div>
              <div className="space-y-2">
                {scriptVersions.map((version, index) => (
                  <VersionItem
                    key={version.id}
                    version={version}
                    isSelected={selectedVersion === version.version}
                    isCompare={compareWith === version.version}
                    viewMode={viewMode}
                    onClick={() => {
                      if (viewMode === 'single') {
                        setSelectedVersion(version.version);
                      } else {
                        if (selectedVersion === version.version) return;
                        if (compareWith === version.version) {
                          setCompareWith(null);
                        } else if (!compareWith) {
                          setCompareWith(version.version);
                        } else {
                          setSelectedVersion(version.version);
                        }
                      }
                    }}
                    isLatest={index === 0}
                  />
                ))}
              </div>

              {viewMode === 'compare' && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                  <div className="font-medium mb-1">对比模式说明</div>
                  <p>点击版本选择对比对象。左侧为旧版本，右侧为新版本。</p>
                  {compareWith && selectedVersion && (
                    <p className="mt-2 font-medium">
                      正在对比：{compareWith} → {selectedVersion}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="col-span-8">
              {viewMode === 'single' && currentVersion && (
                <div className="space-y-4">
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-primary">
                          {currentVersion.version}
                        </span>
                        {scriptVersions.indexOf(currentVersion) === 0 && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                            当前版本
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-neutral-500">
                        <div className="flex items-center gap-1">
                          <User size={12} />
                          {currentVersion.modifiedBy}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatDateTime(currentVersion.modifiedAt)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-neutral-700 mb-2">
                      <span className="text-neutral-500">修改原因：</span>
                      {currentVersion.changeReason}
                    </div>
                    {currentVersion.parentVersion && (
                      <div className="text-xs text-neutral-500 flex items-center gap-1">
                        <ChevronRight size={12} />
                        基于版本 {currentVersion.parentVersion} 修改
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-white border border-neutral-200 rounded-lg">
                    <pre className="font-mono text-sm text-neutral-800 whitespace-pre-wrap">
                      {currentVersion.content}
                    </pre>
                  </div>
                </div>
              )}

              {viewMode === 'compare' && selectedVersion && compareWith && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded">
                      <div className="text-xs text-neutral-600 mb-1">旧版本</div>
                      <div className="font-mono font-semibold text-neutral-800">
                        {compareWith}
                      </div>
                      {compareVersion && (
                        <div className="text-xs text-neutral-500 mt-1">
                          {compareVersion.modifiedBy} · {formatDateTime(compareVersion.modifiedAt)}
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-primary/5 border border-primary/30 rounded">
                      <div className="text-xs text-primary mb-1">新版本</div>
                      <div className="font-mono font-semibold text-primary">
                        {selectedVersion}
                      </div>
                      {currentVersion && (
                        <div className="text-xs text-neutral-500 mt-1">
                          {currentVersion.modifiedBy} · {formatDateTime(currentVersion.modifiedAt)}
                        </div>
                      )}
                    </div>
                  </div>

                  {currentVersion?.changeReason && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                      <div className="text-xs font-medium text-orange-700 mb-1">
                        本次修改原因
                      </div>
                      <div className="text-sm text-orange-800">
                        {currentVersion.changeReason}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-medium text-neutral-600 mb-2">内容差异</div>
                    {diffs.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-red-100 border border-red-200 rounded" />
                            <span className="text-neutral-600">删除内容</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-green-100 border border-green-200 rounded" />
                            <span className="text-neutral-600">新增内容</span>
                          </div>
                        </div>
                        <SideBySideDiff
                          oldText={compareVersion?.content || ''}
                          newText={currentVersion?.content || ''}
                          oldLabel={`${compareWith} - ${compareVersion?.modifiedBy || ''}`}
                          newLabel={`${selectedVersion} - ${currentVersion?.modifiedBy || ''}`}
                          diffs={diffs}
                        />
                      </div>
                    ) : (
                      <div className="p-8 bg-green-50 border border-green-200 rounded-lg text-center">
                        <CheckCircle2 size={24} className="mx-auto text-green-600 mb-2" />
                        <p className="text-sm text-green-700 font-medium">两个版本内容完全一致</p>
                      </div>
                    )}
                  </div>

                  {diffs.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-neutral-600 mb-2">差异摘要</div>
                      <div className="p-4 bg-white border border-neutral-200 rounded-lg">
                        <DiffViewer diffs={diffs} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {viewMode === 'compare' && (!selectedVersion || !compareWith) && (
                <div className="text-center py-12 text-neutral-500">
                  <GitBranch size={32} className="mx-auto mb-2 text-neutral-400" />
                  <p>请选择两个版本进行对比</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="text-sm font-medium text-neutral-700 mb-3">版本历史说明</div>
        <div className="space-y-2 text-xs text-neutral-600">
          <p>• 每次培训老师修改演示脚本时，系统自动保存修改前的版本快照</p>
          <p>• 版本对比功能可清晰展示修改内容，区分"删除"和"新增"</p>
          <p>• 所有修改记录操作人、时间和原因，确保课堂记录和明细一致</p>
          <p>• 导出报告时可选择包含完整版本历史</p>
        </div>
      </div>
    </div>
  );
}

interface VersionItemProps {
  version: ScriptVersion;
  isSelected: boolean;
  isCompare: boolean;
  viewMode: 'single' | 'compare';
  onClick: () => void;
  isLatest: boolean;
}

function VersionItem({ version, isSelected, isCompare, viewMode, onClick, isLatest }: VersionItemProps) {
  const isActive = viewMode === 'single' ? isSelected : isSelected || isCompare;

  return (
    <div
      onClick={onClick}
      className={`p-3 border rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'bg-primary/10 border-primary/30'
          : isCompare
          ? 'bg-orange-50 border-orange-200'
          : 'bg-white border-neutral-200 hover:border-primary/30 hover:bg-primary/5'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`font-mono font-semibold text-sm ${
            isSelected ? 'text-primary' : isCompare ? 'text-orange-600' : 'text-neutral-800'
          }`}>
            {version.version}
          </span>
          {isLatest && (
            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
              当前
            </span>
          )}
        </div>
        {isActive && (
          <div className={`w-2 h-2 rounded-full ${
            isSelected ? 'bg-primary' : 'bg-orange-500'
          }`} />
        )}
      </div>
      <div className="text-xs text-neutral-600 mb-1 line-clamp-1">
        {version.changeReason}
      </div>
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{version.modifiedBy}</span>
        <span>{formatDateTime(version.modifiedAt)}</span>
      </div>
    </div>
  );
}

export function HistoryOverview() {
  const navigate = useNavigate();
  const { experiments, getScriptVersionsByExperimentId } = useExperiments();

  const allVersions = experiments.flatMap((exp) => {
    const versions = getScriptVersionsByExperimentId(exp.id);
    return versions.map((v) => ({ ...v, experiment: exp }));
  }).sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-mono font-semibold text-neutral-900">历史回溯</h2>
        <div className="text-sm text-neutral-500">
          共 <span className="font-mono font-semibold text-purple-600">{allVersions.length}</span> 个版本
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg">
        {allVersions.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <GitBranch size={48} className="mx-auto mb-4 text-neutral-400" />
            <p className="text-neutral-700 font-medium">暂无脚本修改记录</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {allVersions.map((version) => (
              <div
                key={version.id}
                className="p-4 hover:bg-neutral-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/experiments/${version.experimentId}/history`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-semibold text-primary">
                        {version.version}
                      </span>
                      <span className="text-sm text-neutral-800">
                        {version.experiment?.studentName}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {version.experiment?.className}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600">{version.changeReason}</p>
                  </div>
                  <div className="text-right text-xs text-neutral-500">
                    <div>{version.modifiedBy}</div>
                    <div>{formatDateTime(version.modifiedAt)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
