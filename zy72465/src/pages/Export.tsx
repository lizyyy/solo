import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  History,
  UserCircle2,
  ChevronDown,
  PlayCircle,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { exportToExcel, exportToCSV, exportStreetSummary, verifyConsistency } from '@/utils/export';
import { StatusTag, NameConflictTag } from '@/components/StatusTag';
import { getDisplayCommunityName, ROLE_LABELS, STATUS_LABELS, EXPORT_FIELD_MAPPINGS } from '@/types';
import type { SamplingPoint, Summary, UserRole } from '@/types';

export default function ExportPage() {
  const navigate = useNavigate();
  const {
    records,
    calculateConsistencyHash,
    addSamplingPoint,
    updateSummary,
    confirmFinalName,
    switchUser,
    currentUser,
    updateRecordStatus,
  } = useAppStore();

  const [consistencyResult, setConsistencyResult] = useState<ReturnType<typeof verifyConsistency> | null>(null);
  const [lastExport, setLastExport] = useState<{ logId: string; filename: string; msg: string; ok: boolean } | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState('');

  const completedRecords = records.filter((r) => r.summary);
  const pendingRecords = records.filter((r) => !r.summary);

  const handleVerifyConsistency = () => {
    const result = verifyConsistency(records);
    setConsistencyResult(result);
  };

  const runDemoFullFlow = async () => {
    setDemoRunning(true);
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    try {
      setDemoStep('【步骤 0】切换角色为：城更项目经理（阿宁）');
      switchUser('阿宁', 'aning');
      await sleep(600);

      const targetNew = records.find((r) => !r.hasNameConflict && r.status === 'imported');
      const targetConflict = records.find((r) => r.hasNameConflict && r.currentStep === 1);
      const targets = [targetNew, targetConflict].filter(Boolean) as typeof records;

      if (targets.length === 0) {
        setDemoStep('【演示完成】没有可以走流程的记录，请先在「数据导入」页导入一批');
        setDemoRunning(false);
        return;
      }

      for (let i = 0; i < targets.length; i++) {
        const record = targets[i];
        setDemoStep(`【步骤 1】第二步：阿宁补看夜间采样点 → 记录 ${i + 1}/${targets.length}：${getDisplayCommunityName(record)}`);
        const sampling: SamplingPoint = {
          exists: i % 2 === 0,
          location: i % 2 === 0 ? `${record.communityNewName || record.id}-南门保安亭旁` : '',
          credibility: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
          reviewedBy: '阿宁',
          reviewedAt: new Date(),
        };
        addSamplingPoint(record.id, sampling);
        await sleep(800);
      }

      setDemoStep('【步骤 2】切换角色为：市政巡检员，复核新旧名称冲突');
      switchUser('李工（巡检员）', 'inspector');
      await sleep(600);

      const needNameConfirm = useAppStore.getState().records.filter(
        (r) => r.hasNameConflict && !r.communityFinalName,
      );
      for (let i = 0; i < needNameConfirm.length; i++) {
        const record = needNameConfirm[i];
        const finalName = record.communityNewName || record.communityOldName || '已确认';
        setDemoStep(`【步骤 2-复核】巡检员确认最终名称：${getDisplayCommunityName(record)} → ${finalName}`);
        confirmFinalName(record.id, finalName);
        await sleep(700);
      }

      setDemoStep('【步骤 3】切回阿宁，第三步：给街道会看的摘要更新');
      switchUser('阿宁', 'aning');
      await sleep(500);

      const latestState = useAppStore.getState().records;
      const readyForSummary = latestState.filter(
        (r) => r.currentStep >= 2 && !r.summary,
      );
      for (let i = 0; i < readyForSummary.length; i++) {
        const record = readyForSummary[i];
        setDemoStep(`【步骤 3-摘要】更新摘要：${getDisplayCommunityName(record)}`);
        const nameConflictNote = record.hasNameConflict
          ? `（新旧名称已确认：旧称「${record.communityOldName}」新称「${record.communityNewName}」最终「${record.communityFinalName || '待确认'}」）`
          : '';
        const summary: Summary = {
          content: `该小区无障碍坡道位于${record.rampRecord.location || '指定位置'}，状况${record.rampRecord.condition || '正常'}。夜间采样点${
            record.samplingPoint?.exists ? '已设置' : '暂未设置'
          }，可信度${record.samplingPoint ? { high: '高', medium: '中', low: '低' }[record.samplingPoint.credibility] : '未核查'}。${nameConflictNote}审批结论：材料齐全，待街道会签。`,
          updatedBy: '阿宁',
          updatedAt: new Date(),
        };
        updateSummary(record.id, summary);
        await sleep(700);
      }

      setDemoStep('【步骤 4】巡检员最终复核，将已完成三步且无异议的记录标记完成');
      switchUser('王工（巡检员）', 'inspector');
      await sleep(500);

      const afterSummary = useAppStore.getState().records;
      const toComplete = afterSummary.filter((r) => r.status === 'summary_updated' && r.hasNameConflict ? !!r.communityFinalName : true);
      for (let i = 0; i < Math.min(2, toComplete.length); i++) {
        const record = toComplete[i];
        setDemoStep(`【步骤 4-完成】巡检员确认完成：${getDisplayCommunityName(record)}`);
        updateRecordStatus(record.id, 'completed', '市政巡检员现场复核通过，无障碍坡道记录与采样点一致，审批完成');
        await sleep(600);
      }

      switchUser('阿宁', 'aning');
      setDemoStep('✅ 端到端演示完成：从导入→补看→摘要→复核，同一小区新旧名称全程保留证据，状态链路完整。去下方导出试试。');
    } finally {
      setDemoRunning(false);
    }
  };

  const switchToUser = (name: string, role: UserRole) => {
    switchUser(name, role);
    setShowUserMenu(false);
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Source Han Serif SC, serif' }}>
            摘要导出 & 结果追溯
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            页面、导出、接口三处共用同一套业务字段；每次导出留痕，可一路追溯回无障碍坡道原始材料
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-end gap-3">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
            >
              <UserCircle2 className="w-4 h-4 text-gray-500" />
              <span>
                当前：{currentUser.name}（{ROLE_LABELS[currentUser.role]}）
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {showUserMenu && (
              <div className="absolute right-0 z-30 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <p className="text-xs text-gray-500 px-4 py-2 bg-gray-50 border-b border-gray-100">角色切换（用于演示流程）</p>
                <button
                  onClick={() => switchToUser('阿宁', 'aning')}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center gap-2"
                >
                  {currentUser.role === 'aning' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  <div className="ml-6">
                    <div className="font-medium text-gray-800">阿宁</div>
                    <div className="text-xs text-gray-500">城更项目经理 · 导入 / 补看 / 更摘要</div>
                  </div>
                </button>
                <button
                  onClick={() => switchToUser('李工（巡检员）', 'inspector')}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 flex items-center gap-2"
                >
                  {currentUser.role === 'inspector' && <CheckCircle2 className="w-4 h-4 text-orange-600" />}
                  <div className="ml-6">
                    <div className="font-medium text-gray-800">李工（巡检员）</div>
                    <div className="text-xs text-gray-500">市政巡检员 · 复核新旧名称、最终确认</div>
                  </div>
                </button>
                <button
                  onClick={() => switchToUser('街道-张主任', 'street')}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-teal-50 flex items-center gap-2"
                >
                  {currentUser.role === 'street' && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
                  <div className="ml-6">
                    <div className="font-medium text-gray-800">张主任（街道）</div>
                    <div className="text-xs text-gray-500">街道审批 · 查看摘要、导出明细</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={runDemoFullFlow}
            disabled={demoRunning}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
              demoRunning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            {demoRunning ? '演示中…' : '一键跑：导入→补看→摘要→复核'}
          </button>
        </div>
      </div>

      {demoStep && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${demoStep.startsWith('✅') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-indigo-50 border-indigo-200 text-indigo-800'}`}>
          <PlayCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">{demoStep}</p>
            <p className="text-xs mt-1 opacity-80">
              每一步都会产生历史操作记录，包含快照。完成后可以点「查看导出日志」去追溯。
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              数据一致性校验（页面 / 导出 / 存储三处对比）
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              避免「页面说成功、接口读不到导出明细」的情况，导出前必点
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-gray-400">当前存储哈希</p>
              <p className="font-mono text-xs text-gray-600">{calculateConsistencyHash()}</p>
            </div>
            <button
              onClick={handleVerifyConsistency}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              立即校验
            </button>
            <button
              onClick={() => navigate('/export-logs')}
              className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              查看导出日志
            </button>
          </div>
        </div>

        {consistencyResult && (
          <div
            className={`mt-4 p-4 rounded-lg border ${
              consistencyResult.consistent
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {consistencyResult.consistent ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    consistencyResult.consistent ? 'text-green-800' : 'text-red-800'
                  }`}
                >
                  {consistencyResult.message}
                </p>
                <div className="mt-2 grid grid-cols-3 gap-4 text-xs">
                  <div className="bg-white p-2 rounded border border-gray-100">
                    <p className="text-gray-400">存储哈希(store)</p>
                    <p className="font-mono text-gray-700 mt-0.5">{consistencyResult.storeHash}</p>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-100">
                    <p className="text-gray-400">页面哈希(page)</p>
                    <p className="font-mono text-gray-700 mt-0.5">{consistencyResult.pageHash}</p>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-100">
                    <p className="text-gray-400">导出哈希(export)</p>
                    <p className="font-mono text-gray-700 mt-0.5">{consistencyResult.exportHash}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {lastExport && (
        <div className={`p-5 rounded-xl border flex items-start justify-between gap-4 ${lastExport.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start gap-3">
            {lastExport.ok ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
            <div>
              <p className={`font-medium ${lastExport.ok ? 'text-green-800' : 'text-red-800'}`}>
                {lastExport.filename}
              </p>
              <p className={`text-sm mt-1 ${lastExport.ok ? 'text-green-700' : 'text-red-700'}`}>{lastExport.msg}</p>
              <p className="text-xs mt-1 opacity-70">导出日志 ID：{lastExport.logId}（在「查看导出日志」里能找到这条）</p>
            </div>
          </div>
          <button onClick={() => navigate(`/export-logs/${lastExport.logId}`)} className="shrink-0 px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg text-sm hover:bg-green-100">
            追溯这次导出的明细 →
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ExportCard
          title="Excel 明细（最完整）"
          desc={`包含 ${EXPORT_FIELD_MAPPINGS.length} 个统一字段 + 一致性校验 Sheet`}
          icon={FileSpreadsheet}
          color="green"
          disabled={false}
          onClick={() => {
            const r = exportToExcel(records);
            setLastExport({ logId: r.logId, filename: r.filename, msg: r.message, ok: r.consistencyVerified });
          }}
        />
        <ExportCard
          title="CSV 明细（通用格式）"
          desc="共用同一套业务字段编码，方便对接其他系统"
          icon={FileText}
          color="blue"
          disabled={false}
          onClick={() => {
            const r = exportToCSV(records);
            setLastExport({ logId: r.logId, filename: r.filename, msg: r.message, ok: r.consistencyVerified });
          }}
        />
        <ExportCard
          title="街道会看摘要（纯文本）"
          desc="隐藏内部操作痕迹，仅展示结论和名称说明"
          icon={FileText}
          color="indigo"
          disabled={completedRecords.length === 0}
          disabledText={completedRecords.length === 0 ? '还没有摘要，先跑演示或手动更新' : ''}
          onClick={() => {
            const r = exportStreetSummary(records);
            setLastExport({ logId: r.logId, filename: r.filename, msg: r.message, ok: r.consistencyVerified });
          }}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">街道会看摘要预览（与导出、接口同一数据）</h2>
            <p className="mt-1 text-xs text-gray-400">
              同一小区有新旧两个名字的记录也会在这里展示出来，不会一个地方异常、另一个地方消失
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>共 {records.length} 条</span>
            <span className="text-green-600">已摘要 {completedRecords.length}</span>
            <span className="text-amber-600">
              待处理 {pendingRecords.length}
            </span>
          </div>
        </div>

        <div className="divide-y divide-gray-100 max-h-[480px] overflow-auto">
          {records.length === 0 ? (
            <div className="p-12 text-center text-gray-400">还没有记录，去「数据导入」或跑上面的演示</div>
          ) : (
            records.map((record) => (
              <div key={record.id} className="p-5 hover:bg-gray-50/60 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        {getDisplayCommunityName(record)}
                        <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          原始行 #{record.originalLineNumber}
                        </span>
                      </h3>
                      <NameConflictTag hasConflict={record.hasNameConflict} />
                      <StatusTag status={record.status} />
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600">
                      <div className="flex items-start gap-1.5">
                        <span className="text-gray-400 shrink-0">坡道：</span>
                        <span>
                          {record.rampRecord.exists ? '有' : '无'}
                          {record.rampRecord.location && ` - ${record.rampRecord.location}`}
                          {record.rampRecord.condition && ` (${record.rampRecord.condition})`}
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-gray-400 shrink-0">采样点：</span>
                        <span>
                          {record.samplingPoint ? (record.samplingPoint.exists ? '有' : '无') : '待阿宁补看'}
                          {record.samplingPoint?.location && ` - ${record.samplingPoint.location}`}
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-gray-400 shrink-0">当前步骤：</span>
                        <span className="text-gray-700">
                          第{record.currentStep}步 · {STATUS_LABELS[record.status]}
                        </span>
                      </div>
                    </div>

                    {record.hasNameConflict && (
                      <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                        📌 新旧名称：旧称「{record.communityOldName || '-'}」 / 新称「{record.communityNewName || '-'}」
                        → 最终：
                        {record.communityFinalName ? (
                          <span className="text-green-700 font-medium">「{record.communityFinalName}」（已确认）</span>
                        ) : (
                          <span className="text-red-600 font-medium">待巡检员复核，不急着归正常</span>
                        )}
                      </p>
                    )}

                    {record.summary ? (
                      <div className="mt-3 p-3 bg-teal-50 border border-teal-100 rounded-lg">
                        <p className="text-xs text-teal-700 mb-1 font-medium">📋 街道会看摘要</p>
                        <p className="text-sm text-teal-900 leading-relaxed">{record.summary.content}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-gray-400 italic">还未更新街道会看摘要（第 3 步）</p>
                    )}
                  </div>

                  <button
                    onClick={() => navigate(`/record/${record.id}`)}
                    className="shrink-0 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    详情 / 证据链 →
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {pendingRecords.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800">
                还有 {pendingRecords.length} 条记录没走完三步流程
              </h3>
              <p className="mt-1 text-sm text-amber-700">
                点「一键跑：导入→补看→摘要→复核」可以自动走完；或手动点详情页逐个处理。
                重点核对同一小区新旧两个名字的记录、以及无障碍坡道原始材料。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExportCard({
  title,
  desc,
  icon: Icon,
  color,
  onClick,
  disabled,
  disabledText,
}: {
  title: string;
  desc: string;
  icon: typeof FileSpreadsheet;
  color: 'green' | 'blue' | 'indigo';
  onClick: () => void;
  disabled?: boolean;
  disabledText?: string;
}) {
  const colorMap = {
    green: { bg: 'bg-green-50', text: 'text-green-600', btn: 'bg-green-600 hover:bg-green-700' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', btn: 'bg-indigo-600 hover:bg-indigo-700' },
  }[color];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className={`w-12 h-12 ${colorMap.bg} rounded-xl flex items-center justify-center mb-4`}>
        <Icon className={`w-6 h-6 ${colorMap.text}`} />
      </div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 flex-1">{desc}</p>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`mt-4 w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 text-white ${
          disabled ? 'bg-gray-200 cursor-not-allowed' : colorMap.btn
        }`}
      >
        <Download className="w-4 h-4" />
        {disabled ? (disabledText || '暂不可用') : '立即导出'}
      </button>
    </div>
  );
}
