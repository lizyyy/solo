import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { reportApi, materialApi, changeApi, selfCheckApi } from '../utils/api';
import WaveformLoader from '../components/WaveformLoader';
import StatusBadge from '../components/StatusBadge';
import type { ReportSummary, ChangeTraceNode, Material, Track } from '../types';

export default function ReportPage() {
  const { materials, setMaterials, setLoading, loading, showNotification } = useStore();
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<(Material & { tracks: Track[] }) | null>(null);
  const [trace, setTrace] = useState<ChangeTraceNode[]>([]);
  const [activeTab, setActiveTab] = useState<'summary' | 'trace' | 'list'>('summary');

  useEffect(() => {
    loadSummary();
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const result = await materialApi.getAll();
      setMaterials(result);
    } catch (error) {
      console.error('加载素材失败:', error);
    }
  };

  const loadSummary = async () => {
    setLoading('report-summary', true);
    try {
      const result = await reportApi.getSummary();
      setSummary(result);
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading('report-summary', false);
    }
  };

  const loadTrace = async (materialId: string) => {
    setLoading('report-trace', true);
    try {
      const result = await reportApi.getTrace(materialId);
      setTrace(result);
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading('report-trace', false);
    }
  };

  const handleSelectMaterial = (material: Material & { tracks: Track[] }) => {
    setSelectedMaterial(material);
    loadTrace(material.id);
    setActiveTab('trace');
  };

  const handleExportExcel = () => {
    reportApi.exportExcel();
    showNotification('success', 'Excel报告导出中...');
  };

  const handleExportPDF = () => {
    reportApi.exportPDF();
    showNotification('success', 'PDF报告导出中...');
  };

  const fieldLabels: Record<string, string> = {
    track_remarks: '轨道备注',
    license_end_date: '授权截止日期',
    episode_count: '集数',
    license_fee: '授权费用',
    revenue_ratio: '分成比例',
    error_tolerance: '误差说明',
    status: '状态',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display text-studio-gold mb-2">结果报告</h2>
          <p className="text-studio-silver text-sm">查看入库统计、变更轨迹、导出完整报告</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportExcel} className="btn-outline">
            📊 导出Excel
          </button>
          <button onClick={handleExportPDF} className="btn-studio">
            📄 导出PDF
          </button>
        </div>
      </div>

      <div className="divider-wave" />

      {loading['report-summary'] || !summary ? (
        <WaveformLoader text="加载报告数据中..." />
      ) : (
        <>
          <div className="grid grid-cols-5 gap-4">
            <div className="card-studio p-5 text-center">
              <p className="text-3xl font-display text-status-new">{summary.total_materials}</p>
              <p className="text-sm text-studio-silver">素材总数</p>
            </div>
            <div className="card-studio p-5 text-center">
              <p className="text-3xl font-display text-status-reused">{summary.total_tracks}</p>
              <p className="text-sm text-studio-silver">轨道总数</p>
            </div>
            <div className="card-studio p-5 text-center">
              <p className="text-3xl font-display text-status-conflict">{summary.pending_conflicts}</p>
              <p className="text-sm text-studio-silver">待处理冲突</p>
            </div>
            <div className="card-studio p-5 text-center">
              <p className="text-3xl font-display text-status-rework">{summary.tracks_need_recheck}</p>
              <p className="text-sm text-studio-silver">待返工复核</p>
            </div>
            <div className="card-studio p-5 text-center">
              <p className="text-3xl font-display text-studio-gold">{summary.total_changes}</p>
              <p className="text-sm text-studio-silver">变更记录</p>
            </div>
          </div>

          <div className="card-studio p-4">
            <div className="flex border-b border-studio-gray">
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-6 py-3 font-mono text-sm transition-all ${
                  activeTab === 'summary'
                    ? 'text-studio-gold border-b-2 border-studio-gold'
                    : 'text-studio-silver hover:text-white'
                }`}
              >
                📊 汇总报告
              </button>
              <button
                onClick={() => setActiveTab('trace')}
                className={`px-6 py-3 font-mono text-sm transition-all ${
                  activeTab === 'trace'
                    ? 'text-studio-gold border-b-2 border-studio-gold'
                    : 'text-studio-silver hover:text-white'
                }`}
              >
                🔍 变更轨迹
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`px-6 py-3 font-mono text-sm transition-all ${
                  activeTab === 'list'
                    ? 'text-studio-gold border-b-2 border-studio-gold'
                    : 'text-studio-silver hover:text-white'
                }`}
              >
                📋 素材清单
              </button>
            </div>
          </div>

          {activeTab === 'summary' && (
            <div className="space-y-4">
              <div className="card-studio p-5">
                <h3 className="text-lg font-display text-white mb-4">📈 导入批次统计</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-studio-darker">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-mono text-studio-gold">批次ID</th>
                        <th className="px-4 py-3 text-left text-xs font-mono text-studio-gold">文件名</th>
                        <th className="px-4 py-3 text-center text-xs font-mono text-studio-gold">新增</th>
                        <th className="px-4 py-3 text-center text-xs font-mono text-studio-gold">复用</th>
                        <th className="px-4 py-3 text-center text-xs font-mono text-studio-gold">合计</th>
                        <th className="px-4 py-3 text-left text-xs font-mono text-studio-gold">导入人</th>
                        <th className="px-4 py-3 text-left text-xs font-mono text-studio-gold">时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.import_batches?.map((batch: any, idx: number) => (
                        <tr key={idx} className="border-t border-studio-gray hover:bg-studio-gray/30">
                          <td className="px-4 py-3 text-sm font-mono text-studio-silver">{batch.batch_id?.substring(0, 8)}...</td>
                          <td className="px-4 py-3 text-sm text-white font-mono">{batch.file_name}</td>
                          <td className="px-4 py-3 text-sm text-center text-status-new font-mono">{batch.new_count}</td>
                          <td className="px-4 py-3 text-sm text-center text-status-reused font-mono">{batch.reused_count}</td>
                          <td className="px-4 py-3 text-sm text-center text-studio-gold font-mono">{batch.total_count}</td>
                          <td className="px-4 py-3 text-sm text-studio-silver font-mono">{batch.imported_by}</td>
                          <td className="px-4 py-3 text-sm text-studio-silver font-mono">{batch.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="card-studio p-5">
                  <h3 className="text-lg font-display text-white mb-4">🏷️ 按状态分布</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-studio-silver">正常</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-studio-darker rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-status-new rounded-full"
                            style={{ width: `${summary.total_materials > 0 ? ((summary.total_materials - summary.tracks_need_recheck) / summary.total_materials * 100).toFixed(0) : 0}%` }}
                          />
                        </div>
                        <span className="text-status-new font-mono w-12 text-right">
                          {summary.total_materials - summary.tracks_need_recheck}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-studio-silver">待复核</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-studio-darker rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-status-rework rounded-full"
                            style={{ width: `${summary.total_materials > 0 ? (summary.tracks_need_recheck / summary.total_materials * 100).toFixed(0) : 0}%` }}
                          />
                        </div>
                        <span className="text-status-rework font-mono w-12 text-right">
                          {summary.tracks_need_recheck}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card-studio p-5">
                  <h3 className="text-lg font-display text-white mb-4">🔄 重复导入检测</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-studio-silver">新增记录</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-studio-darker rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-status-new rounded-full"
                            style={{ width: `${summary.total_new_imports > 0 ? (summary.total_new_imports / (summary.total_new_imports + summary.total_reused_imports) * 100).toFixed(0) : 0}%` }}
                          />
                        </div>
                        <span className="text-status-new font-mono w-12 text-right">
                          {summary.total_new_imports}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-studio-silver">复用记录</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-studio-darker rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-status-reused rounded-full"
                            style={{ width: `${summary.total_reused_imports > 0 ? (summary.total_reused_imports / (summary.total_new_imports + summary.total_reused_imports) * 100).toFixed(0) : 0}%` }}
                          />
                        </div>
                        <span className="text-status-reused font-mono w-12 text-right">
                          {summary.total_reused_imports}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-studio p-5">
                <h3 className="text-lg font-display text-white mb-4">📝 完整操作流程说明</h3>
                <div className="bg-studio-darker rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-status-new flex items-center justify-center text-xs font-bold text-studio-black flex-shrink-0">1</div>
                    <div>
                      <p className="text-white font-medium">授权期限页导入</p>
                      <p className="text-sm text-studio-silver">上传Excel，系统自动检测重复导入（3维度匹配：名称+ISRC+授权起始日期），区分复用记录和新增记录</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-status-conflict flex items-center justify-center text-xs font-bold text-studio-black flex-shrink-0">2</div>
                    <div>
                      <p className="text-white font-medium">调音师留言补录</p>
                      <p className="text-sm text-studio-silver">录入留言后系统自动检测与授权页的冲突，列出证据供许老师确认（系统不自动拍板），确认后同步更新数据</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-status-rework flex items-center justify-center text-xs font-bold text-white flex-shrink-0">3</div>
                    <div>
                      <p className="text-white font-medium">轨道备注返工处理</p>
                      <p className="text-sm text-studio-silver">轨道备注含返工原因（返工、补录、重新录制等关键词）自动标记待复核，由版权运营手动确认</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-studio-gold flex items-center justify-center text-xs font-bold text-studio-black flex-shrink-0">4</div>
                    <div>
                      <p className="text-white font-medium">补录后重算同步</p>
                      <p className="text-sm text-studio-silver">补录后触发重算，同步更新三处数据：轨道备注、排练变更记录、历史记录，保持数据一致性</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-status-new flex items-center justify-center text-xs font-bold text-studio-black flex-shrink-0">5</div>
                    <div>
                      <p className="text-white font-medium">四项自检</p>
                      <p className="text-sm text-studio-silver">执行重复导入检测、返工原因检测、补录重算检测、导出一致性检测，确保数据完整性</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-status-reused flex items-center justify-center text-xs font-bold text-white flex-shrink-0">6</div>
                    <div>
                      <p className="text-white font-medium">结果报告导出</p>
                      <p className="text-sm text-studio-silver">生成完整报告，支持Excel（3个sheet）和PDF（汇总+自检+清单）导出，可追溯所有变更轨迹</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'trace' && (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-4 space-y-4">
                <div className="card-studio p-4">
                  <h3 className="text-lg font-display text-white mb-3">📋 选择素材查看轨迹</h3>
                  {materials.length === 0 ? (
                    <p className="text-studio-silver text-sm text-center py-8">
                      暂无素材
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {materials.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleSelectMaterial(m)}
                          className={`w-full text-left p-3 rounded-lg transition-all ${
                            selectedMaterial?.id === m.id
                              ? 'bg-studio-gold text-studio-black'
                              : 'bg-studio-darker hover:bg-studio-gray'
                          }`}
                        >
                          <p className="font-mono text-sm font-medium">{m.material_name}</p>
                          <p className={`text-xs font-mono ${
                            selectedMaterial?.id === m.id ? 'text-studio-black/70' : 'text-studio-silver'
                          }`}>
                            {m.isrc_code}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="col-span-8 space-y-4">
                {!selectedMaterial ? (
                  <div className="card-studio p-12 text-center">
                    <p className="text-studio-silver">请先从左侧选择一个素材查看变更轨迹</p>
                  </div>
                ) : loading['report-trace'] ? (
                  <WaveformLoader text="加载变更轨迹中..." />
                ) : (
                  <div className="card-studio p-5">
                    <h3 className="text-lg font-display text-white mb-1">
                      {selectedMaterial.material_name} - 变更轨迹
                    </h3>
                    <p className="text-sm text-studio-silver font-mono mb-4">
                      可追溯谁改了什么、改完影响了哪条结果
                    </p>

                    {trace.length === 0 ? (
                      <p className="text-center text-studio-silver py-8">暂无变更记录</p>
                    ) : (
                      <div className="space-y-4">
                        {trace.map((node, idx) => (
                          <div key={idx} className="bg-studio-darker rounded-lg p-4 border-l-4 border-studio-gold">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <span className="text-xs px-2 py-0.5 rounded bg-studio-gold/20 text-studio-gold">
                                  {node.change_type}
                                </span>
                                <span className="font-mono text-sm text-white">
                                  {fieldLabels[node.field_name] || node.field_name}
                                </span>
                              </div>
                              <span className="text-xs text-studio-silver font-mono">
                                {node.changed_at}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-2">
                              <div className="bg-studio-black/30 rounded p-2">
                                <p className="text-xs text-status-reused mb-1">原值</p>
                                <p className="text-sm font-mono text-white">{node.old_value || '—'}</p>
                              </div>
                              <div className="bg-studio-black/30 rounded p-2 border-l-2 border-studio-gold">
                                <p className="text-xs text-studio-gold mb-1">新值</p>
                                <p className="text-sm font-mono text-white">{node.new_value || '—'}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <span className="text-studio-silver">
                                操作人: <span className="text-white">{node.operator}</span>
                              </span>
                              {node.change_reason && (
                                <span className="text-studio-silver">
                                  原因: <span className="text-white">{node.change_reason}</span>
                                </span>
                              )}
                            </div>

                            {node.affected_items && node.affected_items.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-studio-gray">
                                <p className="text-xs text-studio-silver mb-2">影响的结果项:</p>
                                <div className="flex flex-wrap gap-2">
                                  {node.affected_items.map((item, i) => (
                                    <span key={i} className="text-xs px-2 py-1 rounded bg-status-new/20 text-status-new font-mono">
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'list' && (
            <div className="card-studio p-5">
              <h3 className="text-lg font-display text-white mb-4">📋 完整素材清单</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-studio-darker">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-mono text-studio-gold">素材名称</th>
                      <th className="px-4 py-3 text-left text-xs font-mono text-studio-gold">ISRC编码</th>
                      <th className="px-4 py-3 text-left text-xs font-mono text-studio-gold">项目名称</th>
                      <th className="px-4 py-3 text-center text-xs font-mono text-studio-gold">轨道数</th>
                      <th className="px-4 py-3 text-left text-xs font-mono text-studio-gold">授权期限</th>
                      <th className="px-4 py-3 text-center text-xs font-mono text-studio-gold">状态</th>
                      <th className="px-4 py-3 text-center text-xs font-mono text-studio-gold">变更次数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m) => {
                      const hasRework = m.tracks?.some(t => t.need_recheck && !t.rework_confirmed);
                      return (
                        <tr key={m.id} className="border-t border-studio-gray hover:bg-studio-gray/30">
                          <td className="px-4 py-3 text-sm text-white font-mono">{m.material_name}</td>
                          <td className="px-4 py-3 text-sm text-studio-silver font-mono">{m.isrc_code}</td>
                          <td className="px-4 py-3 text-sm text-studio-silver font-mono">{m.project_name}</td>
                          <td className="px-4 py-3 text-sm text-center font-mono">{m.tracks?.length || 0}</td>
                          <td className="px-4 py-3 text-sm text-studio-silver font-mono">
                            {m.license_start_date} ~ {m.license_end_date}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={hasRework ? 'pending' : 'normal'} />
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-studio-gold font-mono">
                            {summary.material_change_counts?.[m.id] || 0}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
