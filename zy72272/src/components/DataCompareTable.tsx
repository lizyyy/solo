import React from 'react';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import type { InspectionRecord } from '../../shared/types';

interface DataCompareTableProps {
  record: InspectionRecord;
}

export const DataCompareTable: React.FC<DataCompareTableProps> = ({ record }) => {
  const hasPhotoNo = !!record.photoNo;
  const hasCad = !!record.cadLayerName;
  const hasLength = record.routeLength !== null;
  const hasCorrection = record.correctedLength !== null;

  return (
    <div>
      <h4 className="text-sm font-semibold text-industrial-text mb-3">
        数据对比 · 原始 → 计算 → 修正
      </h4>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-industrial-border">
              <th className="text-left py-2 px-3 text-industrial-muted font-medium">
                字段
              </th>
              <th className="text-left py-2 px-3 text-industrial-muted font-medium">
                原始值
              </th>
              <th className="text-center py-2 px-3 text-industrial-muted font-medium w-8"></th>
              <th className="text-left py-2 px-3 text-industrial-muted font-medium">
                计算值
              </th>
              <th className="text-center py-2 px-3 text-industrial-muted font-medium w-8"></th>
              <th className="text-left py-2 px-3 text-industrial-muted font-medium">
                修正值
              </th>
              <th className="text-center py-2 px-3 text-industrial-muted font-medium">
                状态
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-industrial-border/50 hover:bg-industrial-bg/50">
              <td className="py-3 px-3 text-industrial-muted font-mono text-xs">
                photoNo
              </td>
              <td className="py-3 px-3 font-mono text-industrial-text">
                -
              </td>
              <td className="py-3 px-3 text-center text-primary-400">
                {hasPhotoNo && <ArrowRight className="w-4 h-4 mx-auto" />}
              </td>
              <td className="py-3 px-3 font-mono text-industrial-text">
                {record.photoNo || '-'}
              </td>
              <td className="py-3 px-3"></td>
              <td className="py-3 px-3 font-mono text-industrial-text">
                {record.photoNo || '-'}
              </td>
              <td className="py-3 px-3 text-center">
                {hasPhotoNo ? (
                  <CheckCircle2 className="w-4 h-4 text-status-normal mx-auto" />
                ) : (
                  <XCircle className="w-4 h-4 text-industrial-border mx-auto" />
                )}
              </td>
            </tr>

            <tr className="border-b border-industrial-border/50 hover:bg-industrial-bg/50">
              <td className="py-3 px-3 text-industrial-muted font-mono text-xs">
                cadLayerName
              </td>
              <td className="py-3 px-3 font-mono text-industrial-text">
                -
              </td>
              <td className="py-3 px-3 text-center text-primary-400">
                {hasCad && <ArrowRight className="w-4 h-4 mx-auto" />}
              </td>
              <td className="py-3 px-3 font-mono text-industrial-text">
                {record.cadLayerName || '-'}
              </td>
              <td className="py-3 px-3"></td>
              <td className="py-3 px-3 font-mono text-industrial-text">
                {record.cadLayerName || '-'}
              </td>
              <td className="py-3 px-3 text-center">
                {hasCad ? (
                  <CheckCircle2 className="w-4 h-4 text-status-normal mx-auto" />
                ) : (
                  <XCircle className="w-4 h-4 text-industrial-border mx-auto" />
                )}
              </td>
            </tr>

            <tr className="border-b border-industrial-border/50 hover:bg-industrial-bg/50">
              <td className="py-3 px-3 text-industrial-muted font-mono text-xs">
                routeLength
              </td>
              <td className="py-3 px-3 font-mono text-industrial-text">
                -
              </td>
              <td className="py-3 px-3 text-center text-primary-400">
                {hasLength && <ArrowRight className="w-4 h-4 mx-auto" />}
              </td>
              <td className="py-3 px-3 font-mono text-industrial-text">
                {record.originalLength !== null
                  ? `${record.originalLength} m`
                  : '-'}
              </td>
              <td className="py-3 px-3 text-center text-primary-400">
                {hasCorrection && <ArrowRight className="w-4 h-4 mx-auto" />}
              </td>
              <td className="py-3 px-3 font-mono">
                {record.correctedLength !== null ? (
                  <span className="text-status-normal">
                    {record.correctedLength} m
                  </span>
                ) : (
                  <span className="text-industrial-text">
                    {record.routeLength !== null ? `${record.routeLength} m` : '-'}
                  </span>
                )}
              </td>
              <td className="py-3 px-3 text-center">
                {hasLength ? (
                  record.lengthRecalculated ? (
                    <CheckCircle2 className="w-4 h-4 text-status-normal mx-auto" />
                  ) : (
                    <span
                      className="inline-block w-4 h-4 rounded-full bg-status-pending mx-auto animate-pulse"
                      title="长度未重算"
                    />
                  )
                ) : (
                  <XCircle className="w-4 h-4 text-industrial-border mx-auto" />
                )}
              </td>
            </tr>

            <tr className="hover:bg-industrial-bg/50">
              <td className="py-3 px-3 text-industrial-muted font-mono text-xs">
                caliber
              </td>
              <td className="py-3 px-3 font-mono text-industrial-text">
                2026版新口径
              </td>
              <td className="py-3 px-3"></td>
              <td className="py-3 px-3 font-mono text-industrial-text">
                {record.caliber}
              </td>
              <td className="py-3 px-3"></td>
              <td className="py-3 px-3 font-mono text-industrial-text">
                {record.caliber}
              </td>
              <td className="py-3 px-3 text-center">
                <CheckCircle2 className="w-4 h-4 text-status-normal mx-auto" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-status-normal" />
          <span className="text-industrial-muted">已完成</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-status-pending" />
          <span className="text-industrial-muted">待复核</span>
        </div>
        <div className="flex items-center gap-1">
          <XCircle className="w-3 h-3 text-industrial-border" />
          <span className="text-industrial-muted">未完成</span>
        </div>
      </div>
    </div>
  );
};
