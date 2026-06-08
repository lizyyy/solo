import { useState, useMemo } from 'react';
import { ArrowLeft, GitCompare, Plus, Minus, Edit3, FileText, Clock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import Navbar from '../components/Navbar';
import EngCard from '../components/EngCard';
import SectionHeader from '../components/SectionHeader';
import type { DiffItem } from '../types';

export default function HistoryCompare() {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  const { historyVersions, selectedHistoryIds, toggleHistorySelection, compareVersions, clearHistorySelection } =
    useProjectStore();

  const diffs = useMemo(() => {
    if (selectedHistoryIds.length === 2) {
      return compareVersions(selectedHistoryIds[0], selectedHistoryIds[1]);
    }
    return [] as DiffItem[];
  }, [selectedHistoryIds, compareVersions]);

  const versionA = historyVersions.find((v) => v.id === selectedHistoryIds[0]);
  const versionB = historyVersions.find((v) => v.id === selectedHistoryIds[1]);

  const hasSupplementaryNotes = useMemo(() => {
    return diffs.some(
      (d) => d.path.includes('fieldNotes') && d.type === 'added' && typeof d.newValue === 'object'
    );
  }, [diffs]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDiffIcon = (type: string) => {
    switch (type) {
      case 'added':
        return <Plus size={14} className="text-safe-600" />;
      case 'removed':
        return <Minus size={14} className="text-danger-600" />;
      case 'modified':
        return <Edit3 size={14} className="text-warning-600" />;
      default:
        return null;
    }
  };

  const getDiffClass = (type: string) => {
    switch (type) {
      case 'added':
        return 'diff-added';
      case 'removed':
        return 'diff-removed';
      case 'modified':
        return 'diff-modified';
      default:
        return '';
    }
  };

  const relevantDiffs = diffs.filter(
    (d) =>
      !d.path.includes('updatedAt') &&
      !d.path.includes('createdAt') &&
      !d.path.includes('calculatedAt') &&
      !d.path.includes('decidedAt')
  );

  const fieldNoteDiffs = relevantDiffs.filter((d) => d.path.includes('fieldNotes'));
  const otherDiffs = relevantDiffs.filter((d) => !d.path.includes('fieldNotes'));

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 md:p-6 stagger-fade">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/')} className="eng-btn eng-btn-sm flex items-center gap-1">
            <ArrowLeft size={16} /> 返回工作台
          </button>
          <h1 className="text-xl font-bold text-ink-800 flex items-center gap-2">
            <GitCompare size={20} /> 历史版本对比
          </h1>
        </div>

        {historyVersions.length === 0 ? (
          <EngCard className="p-8 text-center">
            <div className="text-ink-500 mb-4">
              <Clock size={48} className="mx-auto mb-3 opacity-50" />
              <p className="text-lg mb-2">暂无历史版本</p>
              <p className="text-sm">在工作台中点击"保存版本"来创建历史快照</p>
            </div>
            <button onClick={() => navigate('/')} className="eng-btn eng-btn-primary">
              前往工作台
            </button>
          </EngCard>
        ) : (
          <div className="space-y-6">
            <EngCard>
              <div className="p-4">
                <SectionHeader
                  title="选择版本进行对比"
                  action={
                    selectedHistoryIds.length > 0 && (
                      <button onClick={clearHistorySelection} className="eng-btn eng-btn-sm">
                        清除选择
                      </button>
                    )
                  }
                />
                <p className="text-sm text-ink-500 mb-4">点击选择两个版本进行并排对比（最多2个）</p>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {historyVersions.map((version) => {
                    const isSelected = selectedHistoryIds.includes(version.id);
                    return (
                      <div
                        key={version.id}
                        onClick={() => toggleHistorySelection(version.id)}
                        className={`p-4 border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blueprint-500 bg-blueprint-50'
                            : 'border-ink-200 hover:border-blueprint-300 hover:bg-ink-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono font-bold text-blueprint-700">
                            V{version.versionNumber}
                          </span>
                          {isSelected && (
                            <span className="eng-badge eng-badge-info">已选择</span>
                          )}
                        </div>
                        <p className="text-sm text-ink-700 mb-2">{version.changeDescription}</p>
                        <div className="flex items-center gap-2 text-xs text-ink-500">
                          <User size={12} /> {version.createdBy}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-ink-500">
                          <Clock size={12} /> {formatDate(version.createdAt)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </EngCard>

            {selectedHistoryIds.length === 2 && versionA && versionB && (
              <>
                {hasSupplementaryNotes && (
                  <div className="eng-badge eng-badge-warning px-4 py-2 inline-flex items-center gap-2">
                    <FileText size={14} />
                    ⚠️ 检测到后续补充的备注，差异已特殊标记
                  </div>
                )}

                <EngCard>
                  <div className="p-4">
                    <SectionHeader title="并排对比视图" />

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <div className="bg-ink-100 p-3 mb-4 border-l-4 border-ink-400">
                          <div className="font-mono font-bold text-ink-700">
                            版本 V{versionA.versionNumber}
                          </div>
                          <div className="text-sm text-ink-600">{versionA.changeDescription}</div>
                          <div className="text-xs text-ink-500 mt-1">
                            {formatDate(versionA.createdAt)} · {versionA.createdBy}
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="font-medium">计算结果：</div>
                          {versionA.snapshot.calculationResult ? (
                            <div className="font-mono text-xs space-y-1">
                              <div>射程: {versionA.snapshot.calculationResult.range} m</div>
                              <div>能量: {versionA.snapshot.calculationResult.impactEnergy} J</div>
                              <div>等级: {versionA.snapshot.calculationResult.safetyLevel}</div>
                            </div>
                          ) : (
                            <div className="text-ink-500 italic">未计算</div>
                          )}

                          <div className="engineering-divider" />

                          <div className="font-medium">传感器记录数：</div>
                          <div className="font-mono text-xs">
                            {versionA.snapshot.sensorRecords.length} 条
                          </div>

                          <div className="font-medium">设备参数：</div>
                          <div className="font-mono text-xs">
                            {versionA.snapshot.deviceParams.length} 项
                          </div>

                          <div className="font-medium">现场备注：</div>
                          <div className="font-mono text-xs">
                            {versionA.snapshot.fieldNotes.length} 条
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="bg-blueprint-50 p-3 mb-4 border-l-4 border-blueprint-500">
                          <div className="font-mono font-bold text-blueprint-700">
                            版本 V{versionB.versionNumber}
                          </div>
                          <div className="text-sm text-blueprint-600">{versionB.changeDescription}</div>
                          <div className="text-xs text-blueprint-500 mt-1">
                            {formatDate(versionB.createdAt)} · {versionB.createdBy}
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="font-medium">计算结果：</div>
                          {versionB.snapshot.calculationResult ? (
                            <div className="font-mono text-xs space-y-1">
                              <div>射程: {versionB.snapshot.calculationResult.range} m</div>
                              <div>能量: {versionB.snapshot.calculationResult.impactEnergy} J</div>
                              <div>等级: {versionB.snapshot.calculationResult.safetyLevel}</div>
                            </div>
                          ) : (
                            <div className="text-ink-500 italic">未计算</div>
                          )}

                          <div className="engineering-divider" />

                          <div className="font-medium">传感器记录数：</div>
                          <div className="font-mono text-xs">
                            {versionB.snapshot.sensorRecords.length} 条
                          </div>

                          <div className="font-medium">设备参数：</div>
                          <div className="font-mono text-xs">
                            {versionB.snapshot.deviceParams.length} 项
                          </div>

                          <div className="font-medium">现场备注：</div>
                          <div className="font-mono text-xs">
                            {versionB.snapshot.fieldNotes.length} 条
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </EngCard>

                <EngCard>
                  <div className="p-4">
                    <SectionHeader
                      title="差异明细"
                      action={
                        <button
                          onClick={() => setShowDetails(!showDetails)}
                          className="eng-btn eng-btn-sm"
                        >
                          {showDetails ? '隐藏详情' : '显示详情'}
                        </button>
                      }
                    />

                    {fieldNoteDiffs.length > 0 && (
                      <div className="mb-6">
                        <h4 className="font-medium text-ink-700 mb-3 flex items-center gap-2">
                          <FileText size={16} className="text-blueprint-500" /> 备注变更
                          <span className="eng-badge eng-badge-warning">补录差异</span>
                        </h4>
                        <div className="space-y-2">
                          {fieldNoteDiffs.map((diff, idx) => (
                            <div
                              key={idx}
                              className={`p-3 border-l-4 ${getDiffClass(diff.type)}`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {getDiffIcon(diff.type)}
                                <span className="font-mono text-xs">{diff.path}</span>
                              </div>
                              {showDetails && (
                                <div className="text-sm space-y-1 ml-6">
                                  {diff.type === 'modified' && (
                                    <>
                                      <div className="text-danger-600 line-through">
                                        旧值: {JSON.stringify(diff.oldValue)}
                                      </div>
                                      <div className="text-safe-600">新值: {JSON.stringify(diff.newValue)}</div>
                                    </>
                                  )}
                                  {diff.type === 'added' && (
                                    <div className="text-safe-600">
                                      新增: {JSON.stringify(diff.newValue)}
                                    </div>
                                  )}
                                  {diff.type === 'removed' && (
                                    <div className="text-danger-600">
                                      删除: {JSON.stringify(diff.oldValue)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {otherDiffs.length > 0 && (
                      <div>
                        <h4 className="font-medium text-ink-700 mb-3">其他数据变更</h4>
                        <div className="space-y-2">
                          {otherDiffs.slice(0, 15).map((diff, idx) => (
                            <div
                              key={idx}
                              className={`p-2 border-l-4 text-sm ${getDiffClass(diff.type)}`}
                            >
                              <div className="flex items-center gap-2">
                                {getDiffIcon(diff.type)}
                                <span className="font-mono text-xs flex-1">{diff.path}</span>
                                {showDetails && diff.type === 'modified' && (
                                  <span className="text-xs">
                                    {String(diff.oldValue)} → {String(diff.newValue)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                          {otherDiffs.length > 15 && (
                            <div className="text-sm text-ink-500 text-center py-2">
                              ...还有 {otherDiffs.length - 15} 项次要变更
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {relevantDiffs.length === 0 && (
                      <div className="text-center py-8 text-ink-500">
                        ✅ 两个版本之间没有差异
                      </div>
                    )}
                  </div>
                </EngCard>

                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => navigate('/')}
                    className="eng-btn eng-btn-primary"
                  >
                    返回工作台继续工作
                  </button>
                </div>
              </>
            )}

            {selectedHistoryIds.length === 1 && (
              <div className="text-center text-ink-500 py-4">请再选择一个版本进行对比</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
