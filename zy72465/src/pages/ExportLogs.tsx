import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  FileText,
  ArrowLeft,
  Download,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Eye,
  AlertCircle,
  Building2,
  MapPin,
  History,
  Clock,
  User,
  Hash,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
  EXPORT_FIELD_MAPPINGS,
  formatValueByCode,
  getDisplayCommunityName,
  EXPORT_FORMAT_LABELS,
  ROLE_LABELS,
} from '@/types';
import type { ExportLog } from '@/types';
import { StatusTag, NameConflictTag } from '@/components/StatusTag';

export function ExportLogsList() {
  const navigate = useNavigate();
  const { exportLogs, rollbackExportToSnapshot, currentUser } = useAppStore();
  const [rollbackMsg, setRollbackMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleRollback = (logId: string) => {
    if (!confirm('确定要从该导出快照回滚所有记录吗？回滚后无障碍坡道记录、状态、名称都将恢复到导出时的状态。')) {
      return;
    }
    const result = rollbackExportToSnapshot(logId);
    setRollbackMsg({
      type: result.success ? 'success' : 'error',
      msg: result.message,
    });
    setTimeout(() => setRollbackMsg(null), 5000);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/export')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回导出页
        </button>
      </div>

      <div>
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: 'Source Han Serif SC, serif' }}
        >
          导出明细结果（可追溯回原始材料）
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          每一次导出都留下脚印，市政巡检员追问时，能从日志一路追回到原始行号、无障碍坡道记录、完整状态链路
        </p>
      </div>

      {rollbackMsg && (
        <div className={`p-4 rounded-lg border flex items-start gap-3 ${
          rollbackMsg.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {rollbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <p className="text-sm">{rollbackMsg.msg}</p>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm text-amber-800">
            <p><strong>追溯说明：</strong></p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-700">
              <li>点「查看明细」可以看到导出那一刻的完整数据快照</li>
              <li>点某条记录的「去详情页」可以从导出结果一路追到原始行号、证据时间线</li>
              <li>点「从该快照回滚」可以把所有记录恢复到导出时的状态（包括无障碍坡道记录）</li>
              <li>当前登录角色：<span className="font-medium">{currentUser.name}（{ROLE_LABELS[currentUser.role]}）</span></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {exportLogs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FileSpreadsheet className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">还没有任何导出记录</p>
            <p className="text-sm text-gray-400 mt-1">去摘要导出页面做一次导出，这里就会留下痕迹</p>
            <Link
              to="/export"
              className="inline-block mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              去导出
            </Link>
          </div>
        ) : (
          exportLogs.map((log) => <LogCard key={log.id} log={log} onRollback={handleRollback} />)
        )}
      </div>
    </div>
  );
}

function LogCard({ log, onRollback }: { log: ExportLog; onRollback: (id: string) => void }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const getIcon = () => {
    if (log.format === 'excel') return FileSpreadsheet;
    if (log.format === 'csv') return FileText;
    return FileText;
  };
  const Icon = getIcon();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              log.format === 'excel'
                ? 'bg-green-50 text-green-600'
                : log.format === 'csv'
                ? 'bg-blue-50 text-blue-600'
                : 'bg-indigo-50 text-indigo-600'
            }`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-semibold text-gray-900 truncate">{log.filename}</h3>
                {log.consistencyVerified ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    <CheckCircle2 className="w-3 h-3" />
                    三处一致
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                    <XCircle className="w-3 h-3" />
                    一致性警告
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  日志 ID: <span className="font-mono">{log.id}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(log.exportedAt).toLocaleString('zh-CN')}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {log.exportedBy}（{ROLE_LABELS[log.exportedByRole]}）
                </span>
                <span>
                  格式: {EXPORT_FORMAT_LABELS[log.format]}
                </span>
                <span>
                  记录数: <span className="font-medium text-gray-700">{log.recordCount}</span>
                </span>
              </div>
              <div className="mt-1 text-xs text-gray-400 font-mono">
                数据快照哈希: {log.dataSnapshotHash} | 校验哈希: {log.consistencyHash}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-2 shrink-0">
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              {expanded ? '收起明细' : '查看明细'}
            </button>
            <button
              onClick={() => navigate(`/export-logs/${log.id}`)}
              className="px-3 py-2 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-1.5"
            >
              <History className="w-3.5 h-3.5" />
              追溯详情
            </button>
            <button
              onClick={() => onRollback(log.id)}
              className="px-3 py-2 text-xs bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              从该快照回滚
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100">
          <div className="bg-gray-50 px-5 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              导出这一刻的数据快照（共 {log.dataSnapshot.length} 条）：
            </p>
          </div>
          <div className="overflow-x-auto max-h-[360px]">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">原始行号</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">小区</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">冲突</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">坡道</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">采样点</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">状态</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {log.dataSnapshot.map((record) => (
                  <tr key={record.id} className="hover:bg-blue-50/30">
                    <td className="py-2.5 px-3">
                      <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                        #{record.originalLineNumber}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-medium">
                          {getDisplayCommunityName(record)}
                        </span>
                      </div>
                      {(record.communityOldName || record.communityNewName) && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {record.communityOldName} → {record.communityNewName}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <NameConflictTag hasConflict={record.hasNameConflict} />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {record.rampRecord.exists ? (
                          <>
                            <MapPin className="w-3 h-3 text-green-500" />
                            <span className="text-green-700">有</span>
                          </>
                        ) : (
                          <>
                            <Building2 className="w-3 h-3 text-red-400" />
                            <span className="text-red-500">无</span>
                          </>
                        )}
                        {record.rampRecord.location && (
                          <span className="text-gray-400">({record.rampRecord.location})</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">
                      {record.samplingPoint?.exists ? '有' : record.samplingPoint ? '无' : '未补看'}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusTag status={record.status} />
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => navigate(`/record/${record.id}`)}
                        className="text-blue-600 hover:text-blue-700 text-[11px] font-medium"
                      >
                        去详情页 →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function ExportLogDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { getExportLogById, getRecordById } = useAppStore();

  const log = getExportLogById(id || '');
  if (!log) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/export-logs')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          返回导出列表
        </button>
        <div className="p-12 text-center">导出日志不存在</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/export-logs')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回导出列表
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h1
          className="text-xl font-bold text-gray-900"
          style={{ fontFamily: 'Source Han Serif SC, serif' }}
        >
          导出追溯详情：{log.filename}
        </h1>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">导出日志 ID</p>
            <p className="font-mono font-medium text-gray-800 mt-0.5">{log.id}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">导出时间</p>
            <p className="font-medium text-gray-800 mt-0.5">{new Date(log.exportedAt).toLocaleString('zh-CN')}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">导出人</p>
            <p className="font-medium text-gray-800 mt-0.5">{log.exportedBy}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">数据快照哈希</p>
            <p className="font-mono font-medium text-gray-800 mt-0.5 truncate" title={log.dataSnapshotHash}>
              {log.dataSnapshotHash}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Hash className="w-4 h-4 text-blue-600" />
            从该导出一路追溯到每条记录的原始材料
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            同一业务字段映射（{EXPORT_FIELD_MAPPINGS.length} 个）：页面展示、导出明细、接口读取，三处用同一套字段编码
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {log.dataSnapshot.map((snapshotRecord) => {
            const currentRecord = getRecordById(snapshotRecord.id);
            return (
              <div key={snapshotRecord.id} className="p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-gray-900">
                        {getDisplayCommunityName(snapshotRecord)}
                      </h3>
                      <StatusTag status={snapshotRecord.status} />
                      <NameConflictTag hasConflict={snapshotRecord.hasNameConflict} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>
                        原始行号:{' '}
                        <span className="font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                          #{snapshotRecord.originalLineNumber}
                        </span>
                      </span>
                      <span>导入批次: {snapshotRecord.importBatchId || '未知'}</span>
                      {snapshotRecord.communityOldName && snapshotRecord.communityNewName && (
                        <span className="text-amber-600">
                          旧称「{snapshotRecord.communityOldName}」→ 新称「{snapshotRecord.communityNewName}」
                          {snapshotRecord.communityFinalName && ` → 最终「${snapshotRecord.communityFinalName}」`}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/record/${snapshotRecord.id}`)}
                    className="shrink-0 px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
                  >
                    去详情页查完整证据链 →
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-2">导出时的快照值（无障碍坡道记录 + 其他字段）</p>
                    <div className="space-y-1.5 text-xs">
                      {EXPORT_FIELD_MAPPINGS.slice(0, 9).map((mapping) => (
                        <div key={mapping.code} className="flex gap-2">
                          <span className="text-gray-400 shrink-0 w-28 truncate" title={mapping.label}>
                            {mapping.label}:
                          </span>
                          <span className="text-gray-700 flex-1 break-all">
                            {formatValueByCode(snapshotRecord, mapping.code) || '(空)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-xs font-medium text-blue-700 mb-2">
                      当前系统中的实际值（对比是否被改动过）
                    </p>
                    {currentRecord ? (
                      <div className="space-y-1.5 text-xs">
                        {EXPORT_FIELD_MAPPINGS.slice(0, 9).map((mapping) => {
                          const snap = formatValueByCode(snapshotRecord, mapping.code);
                          const curr = formatValueByCode(currentRecord, mapping.code);
                          const changed = snap !== curr;
                          return (
                            <div key={mapping.code} className="flex gap-2">
                              <span className="text-gray-400 shrink-0 w-28 truncate" title={mapping.label}>
                                {mapping.label}:
                              </span>
                              <span className={`flex-1 break-all ${
                                changed ? 'text-red-600 bg-red-50 px-1 rounded' : 'text-gray-700'
                              }`}>
                                {curr || '(空)'}
                                {changed && <span className="ml-1 text-[10px] text-red-500">（已变动）</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-red-500">该记录已从系统中删除</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
