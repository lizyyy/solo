import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClipStore } from '@/store/clipStore';
import type { SourceType, ExportMissingItem } from 'shared/types';
import { formatDate, MOCK_USERS, formatDuration } from 'shared/constants';
import SourceTag from '@/components/SourceTag';
import StatusBadge from '@/components/StatusBadge';
import {
  ArrowLeft,
  FileOutput,
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  Phone,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const ExportPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    clips,
    selectedClipIds,
    clearSelection,
    toggleClipSelection,
    exportManifest,
    checkExport,
    loading,
    fetchClips,
  } = useClipStore();

  const [expandedGroups, setExpandedGroups] = useState<Record<SourceType, boolean>>({
    edit_point: true,
    ad_script: true,
    audio_track: true,
  });

  const fetchClipsCallback = useCallback(fetchClips, [fetchClips]);
  const checkExportCallback = useCallback(checkExport, [checkExport]);

  useEffect(() => {
    fetchClipsCallback();
  }, [fetchClipsCallback]);

  useEffect(() => {
    if (selectedClipIds.length > 0) {
      checkExportCallback(selectedClipIds);
    }
  }, [selectedClipIds, checkExportCallback]);

  const selectedClips = clips.filter(c => selectedClipIds.includes(c.id));

  const groupedMissing = exportManifest?.missingItems.reduce(
    (acc, item) => {
      if (!acc[item.sourceType]) acc[item.sourceType] = [];
      acc[item.sourceType].push(item);
      return acc;
    },
    {} as Record<SourceType, ExportMissingItem[]>,
  ) || {};

  const toggleGroup = (type: SourceType) => {
    setExpandedGroups(prev => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const handleSelectAll = () => {
    if (selectedClipIds.length === clips.length) {
      clearSelection();
    } else {
      clips.forEach(c => {
        if (!selectedClipIds.includes(c.id)) {
          toggleClipSelection(c.id);
        }
      });
    }
  };

  const handleExport = async () => {
    if (!exportManifest?.canExport) return;
    // 导出逻辑
    alert('导出成功！清单已生成。');
  };

  const handleRecheck = () => {
    if (selectedClipIds.length > 0) {
      checkExport(selectedClipIds);
    }
  };

  const responsibleContacts = exportManifest
    ? [...new Set(exportManifest.missingItems.map(m => m.responsiblePerson.id))].map(
        id => MOCK_USERS.find(u => u.id === id),
      )
    : [];

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="p-2 hover:bg-studio-border rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-studio-muted" />
        </button>
        <div>
          <h1 className="font-serif text-2xl font-semibold text-slate-850">
            导出上线清单
          </h1>
          <p className="text-studio-muted">
            选择需要导出的片段，系统将自动检测缺失素材
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title mb-0">选择片段</h2>
              <button
                type="button"
                onClick={handleSelectAll}
                className="btn-ghost text-sm"
              >
                {selectedClipIds.length === clips.length ? '取消全选' : '全选'}
              </button>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {clips.map(clip => {
                const isSelected = selectedClipIds.includes(clip.id);
                const missingCount = clip.materials.filter(
                  m => m.status === 'missing',
                ).length;

                return (
                  <div
                    key={clip.id}
                    onClick={() => toggleClipSelection(clip.id)}
                    className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-studio-border hover:border-amber-300 hover:bg-studio-bg/50'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-amber-700 border-amber-700'
                          : 'border-studio-border'
                      }`}
                    >
                      {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-studio-muted">
                          {clip.episode}
                        </span>
                        <StatusBadge status={clip.status} size="sm" />
                        {missingCount > 0 && (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <XCircle className="w-3 h-3" />
                            {missingCount}项缺失
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-slate-850 truncate">
                        {clip.title}
                      </p>
                      <p className="text-xs text-studio-muted">
                        嘉宾：{clip.guest} · {formatDuration(clip.duration)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedClips.length > 0 && (
            <div className="card p-6">
              <h2 className="section-title">已选择的片段</h2>
              <div className="space-y-2">
                {selectedClips.map(clip => (
                  <div
                    key={clip.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-studio-bg"
                  >
                    <div>
                      <span className="text-xs font-mono text-studio-muted mr-2">
                        {clip.episode}
                      </span>
                      <span className="font-medium text-slate-850">{clip.title}</span>
                    </div>
                    <StatusBadge status={clip.status} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6 sticky top-8">
            <h2 className="section-title flex items-center gap-2">
              <FileOutput className="w-5 h-5 text-amber-700" />
              导出检测
            </h2>

            {selectedClipIds.length === 0 ? (
              <div className="text-center py-8 text-studio-muted">
                <FileOutput className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>请在左侧选择需要导出的片段</p>
              </div>
            ) : loading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 mx-auto mb-2 text-amber-700 animate-spin" />
                <p className="text-studio-muted">正在检测...</p>
              </div>
            ) : exportManifest ? (
              <div>
                <div
                  className={`mb-4 p-4 rounded-lg ${
                    exportManifest.canExport
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {exportManifest.canExport ? (
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-8 h-8 text-red-500" />
                    )}
                    <div>
                      <p
                        className={`font-semibold ${
                          exportManifest.canExport ? 'text-green-800' : 'text-red-800'
                        }`}
                      >
                        {exportManifest.canExport
                          ? '检测通过，可以导出'
                          : `检测发现 ${exportManifest.missingItems.length} 项缺失`}
                      </p>
                      <p
                        className={`text-sm ${
                          exportManifest.canExport ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        共选择 {selectedClipIds.length} 条记录
                      </p>
                    </div>
                  </div>
                </div>

                {!exportManifest.canExport && (
                  <div className="space-y-4 mb-4">
                    <h3 className="text-sm font-medium text-slate-850 flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500" />
                      缺失素材明细
                    </h3>

                    {(Object.keys(groupedMissing) as SourceType[]).map(type => {
                      const items = groupedMissing[type];
                      const isExpanded = expandedGroups[type];

                      return (
                        <div key={type}>
                          <button
                            type="button"
                            onClick={() => toggleGroup(type)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-studio-bg hover:bg-studio-border transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <SourceTag type={type} />
                              <span className="text-sm text-studio-muted">
                                {items.length} 项
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-studio-muted" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-studio-muted" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 space-y-2 pl-2">
                              {items.map(item => (
                                <div
                                  key={item.materialId}
                                  className="p-3 rounded-lg bg-red-50 border border-red-100"
                                >
                                  <p className="text-sm font-medium text-red-800 mb-1">
                                    {item.materialName}
                                  </p>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-red-600 flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      {item.responsiblePerson.name}
                                    </span>
                                    <button
                                      type="button"
                                      className="text-amber-700 hover:underline flex items-center gap-1"
                                    >
                                      <Phone className="w-3 h-3" />
                                      联系
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <p className="text-xs text-amber-800 font-medium mb-2">
                        需要联系的责任人
                      </p>
                      <div className="space-y-1">
                        {responsibleContacts.map(
                          person =>
                            person && (
                              <div
                                key={person.id}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="text-amber-700">
                                  {person.name}（
                                  {person.role === 'editor'
                                    ? '剪辑师'
                                    : person.role === 'operator'
                                    ? '运营'
                                    : person.role === 'producer'
                                    ? '制作人'
                                    : '管理员'}
                                  ）
                                </span>
                                <button
                                  type="button"
                                  className="text-amber-700 hover:underline"
                                >
                                  发送通知
                                </button>
                              </div>
                            ),
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-4 border-t border-studio-border">
                  <button
                    type="button"
                    onClick={handleRecheck}
                    className="w-full btn-secondary text-sm flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                    />
                    重新检测
                  </button>

                  <button
                    type="button"
                    onClick={handleExport}
                    className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!exportManifest.canExport || loading}
                  >
                    <Download className="w-4 h-4" />
                    {exportManifest.canExport
                      ? '导出上线清单'
                      : '请先补全缺失素材'}
                  </button>
                </div>

                <div className="mt-4 text-xs text-studio-muted">
                  <p>检测时间：{formatDate(exportManifest.generatedAt)}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportPage;
