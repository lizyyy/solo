import { FileText, Tag, Info, Clock, Users, Ticket, Shield } from 'lucide-react';
import type { Batch, AttendanceRecord, CalcParams } from '@/types';
import { formatDateTime, getTicketTypeLabel } from '@/utils';

interface ReportViewProps {
  batch: Batch;
  records: AttendanceRecord[];
  calcParams: CalcParams;
}

export default function ReportView({ batch, records, calcParams }: ReportViewProps) {
  const freeRecords = records.filter((r) => r.type === 'free');
  const paidRecords = records.filter((r) => r.type === 'paid');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass rounded-2xl p-6 border border-white/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-primary-500 text-white rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-primary-900">
              {batch.name} - 打卡报告
            </h2>
            <p className="text-primary-500 mt-1">
              生成时间：{formatDateTime(new Date().toISOString())}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
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
            <p className="text-2xl font-bold text-accent-800">
              {batch.hasMixedType ? '是' : '否'}
            </p>
            <p className="text-sm text-accent-600">混批</p>
          </div>
        </div>

        <div className="space-y-4 text-primary-700 leading-relaxed">
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
                  由于赠票与售票混合在同一批次，已按流程要求标记为待复核状态，
                  未直接归为正常，已提交录音师确认。
                </span>
              )}
            </p>
          </section>

          <section>
            <h3 className="font-display text-lg font-semibold text-primary-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-primary-600" />
              二、赠票明细说明
            </h3>
            <p>本批次赠票共 {freeRecords.length} 人，来源分布如下：</p>
            <ul className="mt-2 space-y-1 pl-5 list-disc">
              {Array.from(new Set(freeRecords.map((r) => r.remark || '未标注'))).map(
                (remark, idx) => (
                  <li key={idx}>
                    {remark}：{freeRecords.filter((r) => (r.remark || '未标注') === remark).length} 人
                  </li>
                )
              )}
            </ul>
          </section>

          <section>
            <h3 className="font-display text-lg font-semibold text-primary-900 mb-3 flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary-600" />
              三、计算参数与取舍说明
              <span className="ml-2 text-xs font-sans font-normal bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                {calcParams.version}
              </span>
            </h3>
            <div className="bg-primary-50/50 rounded-xl p-4 border border-primary-100">
              <p className="text-sm mb-3">
                <strong>模型名称：</strong> {calcParams.modelName}
              </p>
              <p className="text-sm mb-3">
                <strong>参数配置：</strong>
              </p>
              <ul className="text-sm space-y-1 pl-5 list-disc mb-3">
                {Object.entries(calcParams.parameters).map(([key, value]) => (
                  <li key={key}>
                    <code className="bg-white px-1.5 py-0.5 rounded text-primary-700">
                      {key}
                    </code>
                    : {JSON.stringify(value)}
                  </li>
                ))}
              </ul>
              <p className="text-sm">
                <strong>取舍理由：</strong>
              </p>
              <p className="text-sm mt-1 text-primary-600 leading-relaxed">
                {calcParams.tradeOffReason}
              </p>
            </div>
          </section>

          <section>
            <h3 className="font-display text-lg font-semibold text-primary-900 mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-600" />
              四、授权结论
            </h3>
            <p>
              本批次数据经过版权运营小鹿核对、录音师复核，
              {batch.status === 'authorized' ? (
                <span className="text-emerald-700 font-medium">已完成授权。</span>
              ) : batch.status === 'reviewing' ? (
                <span className="text-accent-700 font-medium">
                  目前处于待复核状态，请录音师在10分钟内完成复核。
                </span>
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
