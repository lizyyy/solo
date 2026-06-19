import { FileText, Tag, Info, Clock, Users, Ticket, Shield, History, Fingerprint, Sparkles } from 'lucide-react';
import type { Batch, AttendanceRecord, CalcParams, ImportSession, NoteHistory } from '@/types';
import { formatDateTime, getTicketTypeLabel } from '@/utils';

interface ReportViewProps {
  batch: Batch;
  records: AttendanceRecord[];
  calcParams: CalcParams;
  importSessions: ImportSession[];
  noteHistories: NoteHistory[];
}

export default function ReportView({
  batch,
  records,
  calcParams,
  importSessions,
  noteHistories,
}: ReportViewProps) {
  const freeRecords = records.filter((r) => r.type === 'free');
  const paidRecords = records.filter((r) => r.type === 'paid');
  const photoSessions = importSessions.filter((s) => s.sourceType === 'photo');
  const ticketSessions = importSessions.filter((s) => s.sourceType === 'ticket');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass rounded-2xl p-6 border border-white/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-primary-500 text-white rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-primary-900">
              {batch.name} · 打卡报告
            </h2>
            <p className="text-primary-500 mt-1">
              生成时间：{formatDateTime(new Date().toISOString())}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-primary-50 rounded-xl text-center">
            <Users className="w-5 h-5 text-primary-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-primary-800">{batch.totalCount}</p>
            <p className="text-sm text-primary-600">总人次</p>
          </div>
          <div className="p-4 bg-sky-50 rounded-xl text-center">
            <Ticket className="w-5 h-5 text-sky-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-sky-800">{batch.freeTicketCount}</p>
            <p className="text-sm text-sky-600">{getTicketTypeLabel('free')}</p>
          </div>
          <div className="p-4 bg-emerald-50 rounded-xl text-center">
            <Ticket className="w-5 h-5 text-emerald-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-emerald-800">{batch.paidTicketCount}</p>
            <p className="text-sm text-emerald-600">{getTicketTypeLabel('paid')}</p>
          </div>
          <div className="p-4 bg-accent-50 rounded-xl text-center">
            <Shield className="w-5 h-5 text-accent-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-accent-800">{batch.hasMixedType ? '是' : '否'}</p>
            <p className="text-sm text-accent-600">混批</p>
          </div>
        </div>

        <div className="space-y-6 text-primary-700 leading-relaxed">
          <section>
            <h3 className="font-display text-lg font-semibold text-primary-900 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-600" />
              一、基本情况
            </h3>
            <p>
              本批次为 <strong>{batch.name}</strong>，日期为 {batch.date}。
              共计 {batch.totalCount} 人参与打卡，其中售票 {batch.paidTicketCount} 人，
              赠票 {batch.freeTicketCount} 人。
              {batch.hasMixedType && (
                <span className="text-accent-700 font-medium">
                  {' '}由于赠票与售票混合在同一批次，已按流程要求标记为待复核状态，
                  未直接归为正常，已提交录音师确认。
                </span>
              )}
            </p>
          </section>

          <section>
            <h3 className="font-display text-lg font-semibold text-primary-900 mb-3 flex items-center gap-2">
              <History className="w-5 h-5 text-primary-600" />
              二、导入链路追溯
            </h3>
            <p className="mb-3">
              共经历 {photoSessions.length} 次签到照片导入、{ticketSessions.length} 次票务导出表导入。
              每条记录均可通过记录ID、去重Key、材料指纹追溯到具体导入会话。
            </p>

            {photoSessions.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-primary-800 mb-2">签到照片导入记录：</h4>
                <div className="space-y-2">
                  {photoSessions.map((s) => (
                    <div key={s.id} className="p-3 bg-primary-50/50 rounded-lg border border-primary-100 text-sm">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-primary-400">#{s.id}</span>
                        <span className="font-medium text-primary-800">{s.fileName}</span>
                        <span className="text-primary-500">{formatDateTime(s.importedAt)}</span>
                        <span className="text-xs text-primary-400">参数 {s.calcParamsVersion}</span>
                        {s.isResameMaterialImport && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">同材料重复</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-primary-400 mb-2">
                        <Fingerprint className="w-3.5 h-3.5" />
                        <span className="font-mono">材料指纹: {s.materialFingerprint}</span>
                        {s.priorSessionId && (
                          <span className="text-amber-600">→ 首次会话 {s.priorSessionId}</span>
                        )}
                      </div>
                      <div className="flex gap-3 text-xs">
                        <span className="text-emerald-600">新增 {s.newCount}</span>
                        <span className="text-sky-600">历史重复(跳过) {s.duplicateHistoryCount}</span>
                        <span className="text-amber-600">本次内部重复 {s.duplicateThisSessionCount}</span>
                        {s.updatedCount > 0 && (
                          <span className="text-violet-600">备注更新 {s.updatedCount} (已入历史)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ticketSessions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-primary-800 mb-2">票务导出表导入记录：</h4>
                <div className="space-y-2">
                  {ticketSessions.map((s) => (
                    <div key={s.id} className="p-3 bg-violet-50/50 rounded-lg border border-violet-100 text-sm">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-primary-400">#{s.id}</span>
                        <span className="font-medium text-primary-800">{s.fileName}</span>
                        <span className="text-primary-500">{formatDateTime(s.importedAt)}</span>
                        {s.isResameMaterialImport && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">同材料重复</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-primary-400 mb-2">
                        <Fingerprint className="w-3.5 h-3.5" />
                        <span className="font-mono">材料指纹: {s.materialFingerprint}</span>
                        {s.priorSessionId && (
                          <span className="text-amber-600">→ 首次会话 {s.priorSessionId}</span>
                        )}
                      </div>
                      <div className="flex gap-3 text-xs">
                        <span className="text-emerald-600">新增 {s.newCount}</span>
                        <span className="text-sky-600">历史重复 {s.duplicateHistoryCount}</span>
                        <span className="text-amber-600">内部重复 {s.duplicateThisSessionCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section>
            <h3 className="font-display text-lg font-semibold text-primary-900 mb-3 flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-primary-600" />
              三、记录追溯ID对照
            </h3>
            <p className="mb-3 text-sm">
              以下每条记录的ID、去重Key、材料指纹与导出文件完全一致，可在CSV/JSON导出中直接搜索定位。
            </p>
            <div className="overflow-auto max-h-64 rounded-xl border border-primary-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-primary-50">
                    <th className="px-3 py-2 text-left text-primary-700">记录ID</th>
                    <th className="px-3 py-2 text-left text-primary-700">姓名</th>
                    <th className="px-3 py-2 text-left text-primary-700">类型</th>
                    <th className="px-3 py-2 text-left text-primary-700">备注</th>
                    <th className="px-3 py-2 text-left text-primary-700">去重Key</th>
                    <th className="px-3 py-2 text-left text-primary-700">导入会话</th>
                    <th className="px-3 py-2 text-left text-primary-700">材料指纹</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-50">
                  {records.map((r) => {
                    const session = importSessions.find(s => s.id === r.importSessionId);
                    return (
                      <tr key={r.id} className="hover:bg-primary-50/50">
                        <td className="px-3 py-1.5 font-mono text-primary-600">{r.id}</td>
                        <td className="px-3 py-1.5 text-primary-800">{r.name}</td>
                        <td className="px-3 py-1.5">{r.type === 'free' ? '赠票' : '售票'}</td>
                        <td className="px-3 py-1.5 text-primary-600">{r.remark || '-'}</td>
                        <td className="px-3 py-1.5 font-mono text-primary-400 break-all max-w-[200px]">{r.dedupKey}</td>
                        <td className="px-3 py-1.5 font-mono text-primary-400">{r.importSessionId || '-'}</td>
                        <td className="px-3 py-1.5 font-mono text-[10px] text-primary-400">{session?.materialFingerprint || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {noteHistories.length > 0 && (
            <section>
              <h3 className="font-display text-lg font-semibold text-primary-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent-600" />
                四、备注变更日志
              </h3>
              <p className="text-sm text-primary-600 mb-3">
                以下每条备注变更均记录操作人、操作方式（手动/导入触发）、影响记录ID及对应导入会话，可与导入历史交叉核验。
              </p>
              <div className="space-y-2">
                {noteHistories.map((h) => (
                  <div key={h.id} className="p-3 bg-accent-50/50 rounded-lg border border-accent-100 text-sm">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium text-accent-800">{h.operatorName}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        h.source === 'import' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {h.source === 'import' ? '导入触发' : '手动修改'}
                      </span>
                      <span className="text-primary-500">{formatDateTime(h.modifiedAt)}</span>
                      <span className="font-mono text-primary-400 text-xs">变更ID:{h.id}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-primary-500 mb-1">
                      <span>改了记录 <span className="font-mono text-primary-700">{h.recordId}</span> 的备注</span>
                      {h.importSessionId && (
                        <span>· 来自导入会话 <span className="font-mono text-violet-600">{h.importSessionId}</span></span>
                      )}
                    </div>
                    <p className="text-primary-600">
                      <span className="line-through text-red-500">{h.oldContent || '(空)'}</span>
                      {' → '}
                      <span className="font-medium text-emerald-700">{h.newContent}</span>
                    </p>
                    <p className="text-xs text-accent-600 mt-1">
                      影响字段：{h.affectedResultFields.join('、')}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="font-display text-lg font-semibold text-primary-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-primary-600" />
              {noteHistories.length > 0 ? '五' : '四'}、赠票明细说明
            </h3>
            <p>本批次赠票共 {freeRecords.length} 人，来源分布如下：</p>
            <ul className="mt-2 space-y-1 pl-5 list-disc">
              {Array.from(new Set(freeRecords.map((r) => r.remark || '未标注'))).map((remark, idx) => (
                <li key={idx}>
                  {remark}：{freeRecords.filter((r) => (r.remark || '未标注') === remark).length} 人
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-display text-lg font-semibold text-primary-900 mb-3 flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary-600" />
              {noteHistories.length > 0 ? '六' : '五'}、计算参数与取舍说明
              <span className="ml-2 text-xs font-sans font-normal bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                {calcParams.version}
              </span>
            </h3>
            <div className="bg-primary-50/50 rounded-xl p-4 border border-primary-100">
              <p className="text-sm mb-3"><strong>模型名称：</strong>{calcParams.modelName}</p>
              <p className="text-sm mb-3"><strong>参数配置：</strong></p>
              <ul className="text-sm space-y-1 pl-5 list-disc mb-3">
                {Object.entries(calcParams.parameters).map(([key, value]) => (
                  <li key={key}>
                    <code className="bg-white px-1.5 py-0.5 rounded text-primary-700">{key}</code>: {JSON.stringify(value)}
                  </li>
                ))}
              </ul>
              <p className="text-sm"><strong>取舍理由：</strong></p>
              <p className="text-sm mt-1 text-primary-600 leading-relaxed">{calcParams.tradeOffReason}</p>
            </div>
          </section>

          <section>
            <h3 className="font-display text-lg font-semibold text-primary-900 mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-600" />
              {noteHistories.length > 0 ? '七' : '六'}、授权结论
            </h3>
            <p>
              本批次数据经过版权运营小鹿核对、录音师复核，
              {batch.status === 'authorized' ? (
                <span className="text-emerald-700 font-medium">已完成授权。</span>
              ) : batch.status === 'reviewing' ? (
                <span className="text-accent-700 font-medium">目前处于待复核状态，请录音师在10分钟内完成复核。</span>
              ) : (
                <span className="text-primary-600">处理中。</span>
              )}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
