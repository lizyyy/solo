import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTaskStore } from '@/store/taskStore';
import StepNavigator from '@/components/StepNavigator';
import DataTable, { type ColumnDef } from '@/components/DataTable';
import ActionBar from '@/components/ActionBar';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { formatCurrency, formatDate, formatPercent } from '@/utils/format';
import { Upload, Play, FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { BoxOfficeRecord, ShowSession, FilmContract, SettlementResult } from '@/types';

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentTask,
    boxOfficeRecords,
    showSessions,
    filmContracts,
    settlementResults,
    currentStep,
    loading,
    fetchTaskDetail,
    saveTask,
    withdrawTask,
    importData,
    mapSessions,
    calculate,
    exportReport,
    updateNote,
    setCurrentStep,
  } = useTaskStore();

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'tickets' | 'refunds' | 'coupons' | 'shows' | 'contracts'>('tickets');
  const [importJson, setImportJson] = useState('');

  useEffect(() => {
    if (id) fetchTaskDetail(id);
  }, [id, fetchTaskDetail]);

  if (!currentTask) {
    return <div className="flex items-center justify-center h-96 text-zinc-400 text-sm">加载中...</div>;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTask();
    } finally {
      setSaving(false);
    }
  };

  const handleWithdraw = async () => {
    try {
      await withdrawTask();
      setShowWithdrawModal(false);
    } catch {}
  };

  const handleImport = (type: 'tickets' | 'refunds' | 'coupons' | 'shows' | 'contracts') => {
    setImportType(type);
    setImportJson('');
    setShowImportModal(true);
  };

  const handleImportSubmit = async () => {
    if (!id || !importJson.trim()) return;
    try {
      const data = JSON.parse(importJson);
      const arr = Array.isArray(data) ? data : [data];
      await importData(id, importType, arr);
      setShowImportModal(false);
      setImportJson('');
    } catch (e) {
      alert('JSON 格式错误，请检查输入');
    }
  };

  const handleMap = async () => {
    if (!id) return;
    await mapSessions(id);
  };

  const handleCalculate = async () => {
    if (!id) return;
    await calculate(id);
  };

  const handleExport = async () => {
    if (!id) return;
    await exportReport(id);
  };

  const startEditNote = (record: BoxOfficeRecord) => {
    setEditingNoteId(record.id);
    setNoteValue(record.diffNote || '');
  };

  const saveNote = async (recordId: string) => {
    await updateNote(recordId, noteValue);
    setEditingNoteId(null);
  };

  const abnormalRecords = boxOfficeRecords.filter((r) => r.recordStatus !== 'normal');

  return (
    <div className="flex flex-col h-full">
      <StepNavigator currentStep={currentStep} onStepChange={setCurrentStep} />

      <div className="flex-1 overflow-auto p-6 pb-24">
        {currentStep === 0 && <StepGather
          records={boxOfficeRecords}
          task={currentTask}
          onImport={handleImport}
          loading={loading}
        />}
        {currentStep === 1 && <StepMapping
          sessions={showSessions}
          records={boxOfficeRecords}
          onImport={handleImport}
          onMap={handleMap}
          loading={loading}
        />}
        {currentStep === 2 && <StepSettlement
          results={settlementResults}
          contracts={filmContracts}
          onCalculate={handleCalculate}
          loading={loading}
        />}
        {currentStep === 3 && <StepDiffNote
          records={abnormalRecords}
          editingNoteId={editingNoteId}
          noteValue={noteValue}
          onStartEdit={startEditNote}
          onSaveNote={saveNote}
          onNoteChange={setNoteValue}
          onCancelEdit={() => setEditingNoteId(null)}
        />}
        {currentStep === 4 && <StepExport
          task={currentTask}
          results={settlementResults}
          onExport={handleExport}
        />}
      </div>

      <ActionBar
        onSave={handleSave}
        onWithdraw={() => setShowWithdrawModal(true)}
        onHistory={() => navigate(`/task/${id}/history`)}
        onExport={currentStep === 4 ? handleExport : undefined}
        showExport={currentStep === 4}
        saving={saving}
      />

      <Modal
        open={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        title="确认撤回"
        footer={
          <>
            <button onClick={() => setShowWithdrawModal(false)} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50">取消</button>
            <button onClick={handleWithdraw} className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600">确认撤回</button>
          </>
        }
      >
        <p className="text-sm text-zinc-600">确认撤回到上一版本？此操作不可撤销。</p>
      </Modal>

      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title={`导入${importType === 'tickets' ? '售票流水' : importType === 'refunds' ? '退票记录' : importType === 'coupons' ? '会员券' : importType === 'shows' ? '场次表' : '影片合同'}`}
        footer={
          <>
            <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50">取消</button>
            <button onClick={handleImportSubmit} disabled={!importJson.trim()} className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60" style={{ backgroundColor: '#1e3a5f' }}>导入</button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">请粘贴 JSON 数组格式的数据，例如:</p>
          <pre className="text-xs bg-zinc-50 p-2 rounded border border-zinc-200 overflow-auto max-h-32">{importType === 'tickets' ? '[{"ticketNo":"T001","showCode":"SH001","filmName":"影片A","showTime":"2025-01-01 14:00","ticketAmount":80}]' : importType === 'refunds' ? '[{"ticketNo":"T001","refundAmount":10}]' : importType === 'coupons' ? '[{"ticketNo":"T002","couponAmount":15}]' : importType === 'shows' ? '[{"showCode":"SH001","filmName":"影片A","showTime":"2025-01-01 14:00","hallName":"1号厅"}]' : '[{"filmName":"影片A","distributor":"发行方","shareRatio":0.43}]'}</pre>
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 text-sm font-mono border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
            placeholder="粘贴 JSON 数据..."
          />
        </div>
      </Modal>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-4">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`text-lg font-mono font-semibold mt-1 ${color || 'text-zinc-800'}`}>{value}</p>
    </div>
  );
}

function StepGather({ records, task, onImport, loading }: {
  records: BoxOfficeRecord[];
  task: { totalGross: number; totalRefund: number; totalCoupon: number; netGross: number; errorCount: number };
  onImport: (type: 'tickets' | 'refunds' | 'coupons') => void;
  loading: boolean;
}) {
  const columns: ColumnDef<BoxOfficeRecord>[] = [
    { header: '票号', accessor: 'ticketNo', width: '140px' },
    { header: '场次编码', accessor: 'showCode', width: '120px' },
    { header: '影片', accessor: 'filmName' },
    { header: '放映时间', accessor: (r) => formatDate(r.showTime), width: '110px' },
    { header: '票款', accessor: (r) => formatCurrency(r.ticketAmount), align: 'right', width: '110px' },
    { header: '退票', accessor: (r) => formatCurrency(r.refundAmount), align: 'right', width: '100px' },
    { header: '券抵扣', accessor: (r) => formatCurrency(r.couponAmount), align: 'right', width: '100px' },
    { header: '净额', accessor: (r) => formatCurrency(r.netAmount), align: 'right', width: '110px' },
    { header: '状态', accessor: (r) => <StatusBadge status={r.recordStatus} type="record" />, width: '80px' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="总票房" value={formatCurrency(task.totalGross)} />
        <StatCard label="退票金额" value={formatCurrency(task.totalRefund)} color="text-red-500" />
        <StatCard label="券抵扣" value={formatCurrency(task.totalCoupon)} color="text-amber-500" />
        <StatCard label="净票房" value={formatCurrency(task.netGross)} color="text-[#1e3a5f]" />
        <StatCard label="异常记录" value={`${task.errorCount} 条`} color={task.errorCount > 0 ? 'text-red-500' : undefined} />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => onImport('tickets')} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-50">
          <Upload size={14} /> 导入售票
        </button>
        <button onClick={() => onImport('refunds')} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-50">
          <Upload size={14} /> 导入退票
        </button>
        <button onClick={() => onImport('coupons')} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-50">
          <Upload size={14} /> 导入会员券
        </button>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <DataTable columns={columns} data={records} statusAccessor="recordStatus" emptyText="暂无票房记录，请先导入数据" />
      </div>
    </div>
  );
}

function StepMapping({ sessions, records, onImport, onMap, loading }: {
  sessions: ShowSession[];
  records: BoxOfficeRecord[];
  onImport: (type: 'shows' | 'contracts') => void;
  onMap: () => void;
  loading: boolean;
}) {
  const mappedCount = records.filter((r) => r.mapped).length;
  const unmappedCount = records.length - mappedCount;

  const columns: ColumnDef<ShowSession>[] = [
    { header: '场次编码', accessor: 'showCode', width: '120px' },
    { header: '影片', accessor: 'filmName' },
    { header: '放映时间', accessor: (r) => formatDate(r.showTime), width: '110px' },
    { header: '影厅', accessor: 'hallName', width: '100px' },
    { header: '特殊场次', accessor: (r) => r.isSpecial ? (r.specialType || '是') : '否', width: '90px' },
    { header: '已绑定合同', accessor: (r) => r.contractId ? <CheckCircle2 size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-zinc-300" />, width: '100px', align: 'center' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="场次数" value={`${sessions.length}`} />
        <StatCard label="已映射" value={`${mappedCount}`} color="text-emerald-500" />
        <StatCard label="未映射" value={`${unmappedCount}`} color={unmappedCount > 0 ? 'text-red-500' : 'text-emerald-500'} />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => onImport('shows')} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-50">
          <Upload size={14} /> 导入场次表
        </button>
        <button onClick={() => onImport('contracts')} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-50">
          <Upload size={14} /> 导入合同
        </button>
        <button onClick={onMap} disabled={loading} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50" style={{ backgroundColor: '#1e3a5f' }}>
          <Play size={14} /> 执行映射
        </button>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <DataTable columns={columns} data={sessions} emptyText="暂无场次数据，请先导入场次表" />
      </div>
    </div>
  );
}

function StepSettlement({ results, contracts, onCalculate, loading }: {
  results: SettlementResult[];
  contracts: FilmContract[];
  onCalculate: () => void;
  loading: boolean;
}) {
  const columns: ColumnDef<SettlementResult>[] = [
    { header: '影片', accessor: 'filmName' },
    { header: '发行方', accessor: 'distributor' },
    { header: '票房总额', accessor: (r) => formatCurrency(r.grossAmount), align: 'right', width: '120px' },
    { header: '分账比例', accessor: (r) => formatPercent(r.shareRatio), align: 'right', width: '90px' },
    { header: '分账款', accessor: (r) => formatCurrency(r.settlementAmount), align: 'right', width: '120px' },
    { header: '保底金额', accessor: (r) => r.guaranteeAmount ? formatCurrency(r.guaranteeAmount) : '-', align: 'right', width: '110px' },
    { header: '最终金额', accessor: (r) => formatCurrency(r.finalAmount), align: 'right', width: '120px' },
    { header: '备注', accessor: (r) => r.remark || '-', width: '120px' },
  ];

  const totalFinal = results.reduce((s, r) => s + r.finalAmount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="合同数" value={`${contracts.length}`} />
        <StatCard label="分账结果数" value={`${results.length}`} />
        <StatCard label="分账总额" value={formatCurrency(totalFinal)} color="text-[#1e3a5f]" />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onCalculate} disabled={loading} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50" style={{ backgroundColor: '#1e3a5f' }}>
          <Play size={14} /> 执行计算
        </button>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <DataTable columns={columns} data={results} emptyText="暂无分账结果，请先执行计算" />
      </div>
    </div>
  );
}

function StepDiffNote({ records, editingNoteId, noteValue, onStartEdit, onSaveNote, onNoteChange, onCancelEdit }: {
  records: BoxOfficeRecord[];
  editingNoteId: string | null;
  noteValue: string;
  onStartEdit: (r: BoxOfficeRecord) => void;
  onSaveNote: (id: string) => void;
  onNoteChange: (v: string) => void;
  onCancelEdit: () => void;
}) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
        <CheckCircle2 size={48} strokeWidth={1} />
        <p className="mt-3 text-sm">所有记录正常，无需填写差异说明</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={18} className="text-amber-500" />
        <span className="text-sm font-medium text-zinc-700">{records.length} 条异常/警告记录需要说明</span>
      </div>
      {records.map((record) => (
        <div key={record.id} className="bg-white rounded-lg border border-zinc-200 p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <StatusBadge status={record.recordStatus} type="record" />
              <span className="text-sm font-mono text-zinc-600">{record.ticketNo}</span>
              <span className="text-sm text-zinc-500">{record.filmName}</span>
            </div>
            {record.errorMessage && (
              <span className="text-xs text-red-500">{record.errorMessage}</span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-3 text-xs text-zinc-500 mb-3">
            <span>票款: {formatCurrency(record.ticketAmount)}</span>
            <span>退票: {formatCurrency(record.refundAmount)}</span>
            <span>券抵扣: {formatCurrency(record.couponAmount)}</span>
            <span>净额: {formatCurrency(record.netAmount)}</span>
          </div>
          {editingNoteId === record.id ? (
            <div className="flex items-center gap-2">
              <input
                value={noteValue}
                onChange={(e) => onNoteChange(e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                placeholder="输入差异说明..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && onSaveNote(record.id)}
              />
              <button onClick={() => onSaveNote(record.id)} className="px-3 py-1.5 text-sm text-white rounded-lg" style={{ backgroundColor: '#1e3a5f' }}>保存</button>
              <button onClick={() => onCancelEdit()} className="px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50">取消</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {record.diffNote ? (
                <span className="text-sm text-zinc-600">说明：{record.diffNote}</span>
              ) : (
                <span className="text-sm text-zinc-400 italic">未填写差异说明</span>
              )}
              <button onClick={() => onStartEdit(record)} className="text-xs text-[#1e3a5f] hover:underline">
                {record.diffNote ? '编辑' : '填写'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StepExport({ task, results, onExport }: {
  task: { totalGross: number; totalRefund: number; totalCoupon: number; netGross: number; totalSettlement: number };
  results: SettlementResult[];
  onExport: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <h3 className="text-base font-semibold text-zinc-900 mb-4">分账报告预览</h3>
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="text-center">
            <p className="text-xs text-zinc-400">总票房</p>
            <p className="text-lg font-mono font-semibold text-zinc-800">{formatCurrency(task.totalGross)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-400">退票</p>
            <p className="text-lg font-mono font-semibold text-red-500">{formatCurrency(task.totalRefund)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-400">券抵扣</p>
            <p className="text-lg font-mono font-semibold text-amber-500">{formatCurrency(task.totalCoupon)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-400">净票房</p>
            <p className="text-lg font-mono font-semibold text-[#1e3a5f]">{formatCurrency(task.netGross)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-400">分账总额</p>
            <p className="text-lg font-mono font-semibold text-emerald-600">{formatCurrency(task.totalSettlement)}</p>
          </div>
        </div>

        {results.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left px-3 py-2 text-zinc-500 font-medium">影片</th>
                <th className="text-left px-3 py-2 text-zinc-500 font-medium">发行方</th>
                <th className="text-right px-3 py-2 text-zinc-500 font-medium">票房总额</th>
                <th className="text-right px-3 py-2 text-zinc-500 font-medium">分账比例</th>
                <th className="text-right px-3 py-2 text-zinc-500 font-medium">最终金额</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100">
                  <td className="px-3 py-2">{r.filmName}</td>
                  <td className="px-3 py-2 text-zinc-500">{r.distributor}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(r.grossAmount)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatPercent(r.shareRatio)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{formatCurrency(r.finalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-center">
        <button onClick={onExport} className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white rounded-lg shadow-sm hover:shadow-md transition-all" style={{ backgroundColor: '#10b981' }}>
          <FileSpreadsheet size={16} />
          导出Excel报告
        </button>
      </div>
    </div>
  );
}
