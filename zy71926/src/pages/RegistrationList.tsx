import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { STATUS_META, ANOMALY_META } from '@/types';
import type { RegistrationStatus, AnomalyType } from '@/types';
import { exportToCSV, downloadCSV, exportAnomalyReport, type ExportFilter } from '@/utils/exportService';

export default function RegistrationList() {
  const navigate = useNavigate();
  const {
    registrations,
    statusHistories,
    anomalies,
    currentOperator,
    setCurrentOperator,
    addRegistration,
    changeStatus,
    addExportRecord,
  } = useStore();

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [anomalyFilter, setAnomalyFilter] = useState<string>('');
  const [showOnlyAnomalies, setShowOnlyAnomalies] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState<string | null>(null);
  const [swapForm, setSwapForm] = useState({ swapFrom: '', swapTo: '', reason: '' });
  const [newReg, setNewReg] = useState({
    artworkName: '',
    artist: '',
    registrant: '',
    contact: '',
    location: '',
    notes: '',
  });
  const [statusChangeModal, setStatusChangeModal] = useState<{
    id: string;
    toStatus: RegistrationStatus;
  } | null>(null);
  const [statusChangeReason, setStatusChangeReason] = useState('');

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      if (searchText) {
        const search = searchText.toLowerCase();
        const match =
          reg.artworkName.toLowerCase().includes(search) ||
          reg.artist.toLowerCase().includes(search) ||
          reg.registrant.toLowerCase().includes(search) ||
          reg.contact.includes(search) ||
          (reg.location || '').toLowerCase().includes(search);
        if (!match) return false;
      }

      if (statusFilter && reg.status !== statusFilter) return false;

      if (anomalyFilter) {
        const regAnomalies = anomalies.filter((a) => a.registrationId === reg.id);
        if (!regAnomalies.some((a) => a.type === anomalyFilter)) return false;
      }

      if (showOnlyAnomalies) {
        const regAnomalies = anomalies.filter(
          (a) => a.registrationId === reg.id && !a.resolvedAt
        );
        if (regAnomalies.length === 0) return false;
      }

      return true;
    });
  }, [registrations, anomalies, searchText, statusFilter, anomalyFilter, showOnlyAnomalies]);

  const stats = useMemo(() => {
    const unresolved = anomalies.filter((a) => !a.resolvedAt);
    return {
      total: registrations.length,
      pending: registrations.filter((r) => r.status === 'pending').length,
      confirmed: registrations.filter((r) => r.status === 'confirmed').length,
      arrived: registrations.filter((r) => r.status === 'arrived').length,
      swapped: registrations.filter((r) => r.status === 'swapped').length,
      unresolvedAnomalies: unresolved.length,
      duplicateCount: unresolved.filter((a) => a.type === 'duplicate').length,
      lateCount: unresolved.filter((a) => a.type === 'late_attachment').length,
      missingCount: unresolved.filter((a) => a.type === 'missing_info').length,
      conflictCount: unresolved.filter((a) => a.type === 'conflict').length,
      swapCount: unresolved.filter((a) => a.type === 'swap_record').length,
    };
  }, [registrations, anomalies]);

  const handleAddRegistration = () => {
    if (!newReg.artworkName || !newReg.artist || !newReg.registrant || !newReg.contact) return;
    addRegistration({
      artworkName: newReg.artworkName,
      artist: newReg.artist,
      registrant: newReg.registrant,
      contact: newReg.contact,
      status: 'pending',
      location: newReg.location || undefined,
      notes: newReg.notes || undefined,
      source: 'manual',
    });
    setNewReg({ artworkName: '', artist: '', registrant: '', contact: '', location: '', notes: '' });
    setShowAddModal(false);
  };

  const handleStatusChange = () => {
    if (!statusChangeModal || !statusChangeReason.trim()) return;
    changeStatus(
      statusChangeModal.id,
      statusChangeModal.toStatus,
      currentOperator,
      statusChangeReason
    );
    setStatusChangeModal(null);
    setStatusChangeReason('');
  };

  const handleSwap = () => {
    if (!showSwapModal || !swapForm.swapFrom || !swapForm.swapTo || !swapForm.reason) return;
    const { swapArtwork } = useStore.getState();
    swapArtwork(showSwapModal, swapForm.swapFrom, swapForm.swapTo, swapForm.reason, currentOperator);
    setShowSwapModal(null);
    setSwapForm({ swapFrom: '', swapTo: '', reason: '' });
  };

  const handleExport = () => {
    const filter: ExportFilter = {
      status: statusFilter || undefined,
      hasAnomaly: showOnlyAnomalies || undefined,
      anomalyType: anomalyFilter || undefined,
      searchText: searchText || undefined,
    };
    const result = exportToCSV(
      filteredRegistrations,
      statusHistories,
      anomalies,
      filter,
      currentOperator
    );
    downloadCSV(result.csv, result.exportId);
    addExportRecord({
      exportId: result.exportId,
      exportedAt: result.exportedAt,
      exportedBy: currentOperator,
      filterCriteria: JSON.stringify(filter),
      count: filteredRegistrations.length,
    });
  };

  const handleExportAnomalyReport = () => {
    const unresolved = anomalies.filter((a) => !a.resolvedAt);
    const result = exportAnomalyReport(unresolved, registrations, currentOperator);
    downloadCSV(result.csv, result.exportId);
  };

  const getRegAnomalies = (regId: string) =>
    anomalies.filter((a) => a.registrationId === regId);

  const getLastHistory = (regId: string) => {
    const hists = statusHistories
      .filter((h) => h.registrationId === regId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return hists[0] || null;
  };

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: zhCN });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="panel border-t-0 border-x-0 px-4 py-2 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold tracking-wide text-console-text">
            公教活动报名
          </h1>
          <span className="text-console-muted text-xs">|</span>
          <span className="text-console-muted text-xs">
            当前操作人：
          </span>
          <input
            value={currentOperator}
            onChange={(e) => setCurrentOperator(e.target.value)}
            className="input w-28 py-1 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            + 新增报名
          </button>
          <button onClick={handleExportAnomalyReport} className="btn btn-warning">
            导出异常报告
          </button>
          <button onClick={handleExport} className="btn btn-success">
            导出布展清单
          </button>
          <button
            onClick={() => navigate('/anomalies')}
            className="btn btn-danger relative"
          >
            异常面板
            {stats.unresolvedAnomalies > 0 && (
              <span className="ml-1 bg-console-danger text-white text-[10px] px-1">
                {stats.unresolvedAnomalies}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="panel border-t-0 border-x-0 px-4 py-2 flex items-center gap-3 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-console-muted">
          <span>共{stats.total}条</span>
          <span className="mx-1">|</span>
          <span style={{ color: STATUS_META.pending.color }}>
            待确认{stats.pending}
          </span>
          <span className="mx-1">|</span>
          <span style={{ color: STATUS_META.confirmed.color }}>
            已确认{stats.confirmed}
          </span>
          <span className="mx-1">|</span>
          <span style={{ color: STATUS_META.arrived.color }}>
            已到场{stats.arrived}
          </span>
          <span className="mx-1">|</span>
          <span style={{ color: STATUS_META.swapped.color }}>
            已调换{stats.swapped}
          </span>
        </div>
        <span className="text-console-border">|</span>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-console-muted">异常：</span>
          {stats.duplicateCount > 0 && (
            <span className="tag tag-danger">重×{stats.duplicateCount}</span>
          )}
          {stats.lateCount > 0 && (
            <span className="tag tag-warning">晚×{stats.lateCount}</span>
          )}
          {stats.missingCount > 0 && (
            <span className="tag tag-danger">缺×{stats.missingCount}</span>
          )}
          {stats.conflictCount > 0 && (
            <span className="tag tag-danger">冲×{stats.conflictCount}</span>
          )}
          {stats.swapCount > 0 && (
            <span className="tag tag-info">调×{stats.swapCount}</span>
          )}
        </div>
      </div>

      <div className="panel border-t-0 border-x-0 px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="搜索作品/艺术家/报名人/联系方式/展位..."
          className="input w-72 py-1 text-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-28 py-1 text-xs"
        >
          <option value="">全部状态</option>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
        <select
          value={anomalyFilter}
          onChange={(e) => setAnomalyFilter(e.target.value)}
          className="input w-28 py-1 text-xs"
        >
          <option value="">全部异常</option>
          {Object.entries(ANOMALY_META).map(([key, meta]) => (
            <option key={key} value={key}>
              [{meta.shortLabel}] {meta.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-console-muted cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyAnomalies}
            onChange={(e) => setShowOnlyAnomalies(e.target.checked)}
            className="accent-console-danger"
          />
          仅显示异常
        </label>
        <span className="text-console-muted text-xs ml-auto">
          筛选结果：{filteredRegistrations.length}条
        </span>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="table-header">
              <th className="text-left px-3 py-2 w-8">#</th>
              <th className="text-left px-3 py-2">作品名称</th>
              <th className="text-left px-3 py-2">艺术家</th>
              <th className="text-left px-3 py-2">报名人</th>
              <th className="text-left px-3 py-2">展位</th>
              <th className="text-left px-3 py-2">状态</th>
              <th className="text-left px-3 py-2">异常</th>
              <th className="text-left px-3 py-2">最近变更</th>
              <th className="text-left px-3 py-2 w-52">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredRegistrations.map((reg, idx) => {
              const regAnomalies = getRegAnomalies(reg.id);
              const hasAnomaly = regAnomalies.some((a) => !a.resolvedAt);
              const lastHist = getLastHistory(reg.id);
              const statusMeta = STATUS_META[reg.status];

              return (
                <tr
                  key={reg.id}
                  className={`border-b border-console-border/50 hover:bg-console-panel/80 transition-colors ${
                    hasAnomaly ? 'bg-console-danger/5' : idx % 2 === 1 ? 'bg-console-panel/30' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-console-muted">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium">
                    {reg.artworkName || <span className="text-console-danger italic">空</span>}
                  </td>
                  <td className="px-3 py-2">
                    {reg.artist || <span className="text-console-danger italic">空</span>}
                  </td>
                  <td className="px-3 py-2">{reg.registrant || <span className="text-console-danger italic">空</span>}</td>
                  <td className="px-3 py-2 text-console-info">{reg.location || '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`tag ${statusMeta.tagClass}`}>
                      {statusMeta.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {regAnomalies.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {[...new Set(regAnomalies.map((a) => a.type))].map((type) => {
                          const meta = ANOMALY_META[type as AnomalyType];
                          const tagClass =
                            type === 'duplicate' || type === 'missing_info' || type === 'conflict'
                              ? 'tag-danger'
                              : type === 'late_attachment'
                              ? 'tag-warning'
                              : 'tag-info';
                          return (
                            <span
                              key={type}
                              className={`tag ${tagClass}`}
                              title={meta?.label || type}
                            >
                              [{meta?.shortLabel || type}]
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-console-muted text-[10px]">
                    {lastHist ? (
                      <span title={lastHist.createdAt}>
                        {lastHist.operator} · {formatTime(lastHist.createdAt)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => navigate(`/registration/${reg.id}`)}
                        className="btn btn-secondary text-[10px] py-0.5"
                      >
                        详情
                      </button>
                      {reg.status === 'pending' && (
                        <button
                          onClick={() =>
                            setStatusChangeModal({ id: reg.id, toStatus: 'confirmed' })
                          }
                          className="btn btn-primary text-[10px] py-0.5"
                        >
                          确认
                        </button>
                      )}
                      {reg.status === 'confirmed' && (
                        <button
                          onClick={() =>
                            setStatusChangeModal({ id: reg.id, toStatus: 'arrived' })
                          }
                          className="btn btn-success text-[10px] py-0.5"
                        >
                          到场
                        </button>
                      )}
                      {(reg.status === 'pending' || reg.status === 'confirmed') && (
                        <button
                          onClick={() => setShowSwapModal(reg.id)}
                          className="btn btn-danger text-[10px] py-0.5"
                        >
                          调换
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredRegistrations.length === 0 && (
          <div className="text-center text-console-muted py-12">
            无匹配记录
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="panel w-[480px] p-4">
            <h2 className="text-sm font-bold mb-3">新增报名</h2>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-console-muted">作品名称 *</label>
                  <input
                    value={newReg.artworkName}
                    onChange={(e) => setNewReg({ ...newReg, artworkName: e.target.value })}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-console-muted">艺术家 *</label>
                  <input
                    value={newReg.artist}
                    onChange={(e) => setNewReg({ ...newReg, artist: e.target.value })}
                    className="input text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-console-muted">报名人 *</label>
                  <input
                    value={newReg.registrant}
                    onChange={(e) => setNewReg({ ...newReg, registrant: e.target.value })}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-console-muted">联系方式 *</label>
                  <input
                    value={newReg.contact}
                    onChange={(e) => setNewReg({ ...newReg, contact: e.target.value })}
                    className="input text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-console-muted">展位</label>
                  <input
                    value={newReg.location}
                    onChange={(e) => setNewReg({ ...newReg, location: e.target.value })}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-console-muted">备注</label>
                  <input
                    value={newReg.notes}
                    onChange={(e) => setNewReg({ ...newReg, notes: e.target.value })}
                    className="input text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                取消
              </button>
              <button
                onClick={handleAddRegistration}
                className="btn btn-primary"
                disabled={!newReg.artworkName || !newReg.artist || !newReg.registrant || !newReg.contact}
              >
                提交
              </button>
            </div>
          </div>
        </div>
      )}

      {showSwapModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="panel w-[480px] p-4">
            <h2 className="text-sm font-bold mb-1">作品调换</h2>
            <p className="text-[10px] text-console-danger mb-3">
              调换操作将永久留痕，三栏必填
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-console-muted">原作品名称 *</label>
                <input
                  value={swapForm.swapFrom}
                  onChange={(e) => setSwapForm({ ...swapForm, swapFrom: e.target.value })}
                  className="input text-xs"
                  placeholder="输入被调换的原作品名"
                />
              </div>
              <div>
                <label className="text-[10px] text-console-muted">新作品名称 *</label>
                <input
                  value={swapForm.swapTo}
                  onChange={(e) => setSwapForm({ ...swapForm, swapTo: e.target.value })}
                  className="input text-xs"
                  placeholder="输入调换后的新作品名"
                />
              </div>
              <div>
                <label className="text-[10px] text-console-muted">调换原因 *</label>
                <textarea
                  value={swapForm.reason}
                  onChange={(e) => setSwapForm({ ...swapForm, reason: e.target.value })}
                  className="input text-xs min-h-[60px]"
                  placeholder="必须填写调换原因，用于后续争议复核"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => { setShowSwapModal(null); setSwapForm({ swapFrom: '', swapTo: '', reason: '' }); }} className="btn btn-secondary">
                取消
              </button>
              <button
                onClick={handleSwap}
                className="btn btn-danger"
                disabled={!swapForm.swapFrom || !swapForm.swapTo || !swapForm.reason}
              >
                确认调换
              </button>
            </div>
          </div>
        </div>
      )}

      {statusChangeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="panel w-[400px] p-4">
            <h2 className="text-sm font-bold mb-1">
              状态变更：{STATUS_META[statusChangeModal.toStatus]?.label}
            </h2>
            <p className="text-[10px] text-console-muted mb-3">
              所有状态变更均留痕，原因必填
            </p>
            <div>
              <label className="text-[10px] text-console-muted">变更原因 *</label>
              <textarea
                value={statusChangeReason}
                onChange={(e) => setStatusChangeReason(e.target.value)}
                className="input text-xs min-h-[60px]"
                placeholder="填写本次状态变更的原因"
              />
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => { setStatusChangeModal(null); setStatusChangeReason(''); }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleStatusChange}
                className="btn btn-primary"
                disabled={!statusChangeReason.trim()}
              >
                确认变更
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
