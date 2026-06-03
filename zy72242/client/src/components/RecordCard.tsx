import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ReconciliationRecord } from '../types';
import { STATUS_CONFIG } from '../types';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  DocumentTextIcon,
  UserIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { format, parseISO, differenceInDays } from 'date-fns';


interface RecordCardProps {
  record: ReconciliationRecord;
}

export default function RecordCard({ record }: RecordCardProps) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig = STATUS_CONFIG[record.status];
  
  const isT1ToT2 = record.modificationType === 't1_to_t2';
  const delayDays = differenceInDays(parseISO(record.actualArrivalDate), parseISO(record.expectedArrivalDate));
  
  const CardClass = isT1ToT2 ? 'card-alert' : 'card';

  return (
    <div className={`${CardClass} animate-fade-in`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-3">
            <Link
              to={`/record/${record.id}`}
              className="font-serif-sc text-lg font-semibold text-gray-900 hover:text-finance-600 transition-colors"
            >
              {record.fundCode} / {record.futuresCode}
            </Link>
            {isT1ToT2 && (
              <div className="flex items-center space-x-1 px-2 py-1 bg-alert-500/10 text-alert-500 rounded">
                <ExclamationTriangleIcon className="w-4 h-4" />
                <span className="text-xs font-medium">T+1→T+2 修改</span>
              </div>
            )}
            <span className={`badge ${statusConfig.className}`}>
              {statusConfig.label}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
            <div>
              <div className="text-gray-500 mb-1">交易日</div>
              <div className="font-medium">{record.tradeDate}</div>
            </div>
            <div className="relative tooltip-trigger">
              <div className="text-gray-500 mb-1">预期到账日 (T+1)</div>
              <div className="font-medium">{record.expectedArrivalDate}</div>
              <div className="tooltip top-full mt-2 left-0 whitespace-nowrap">
                系统自动计算的T+1到账日
              </div>
            </div>
            <div className={`relative tooltip-trigger ${isT1ToT2 ? 'text-alert-500 font-semibold' : ''}`}>
              <div className="text-gray-500 mb-1">实际到账日</div>
              <div className="font-medium">{record.actualArrivalDate}</div>
              {isT1ToT2 && (
                <div className="tooltip top-full mt-2 left-0 whitespace-nowrap">
                  T+1({record.expectedArrivalDate}) → T+2({record.actualArrivalDate})，延迟{delayDays}天
                </div>
              )}
            </div>
            <div>
              <div className="text-gray-500 mb-1">金额</div>
              <div className="font-medium">¥{record.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          {isT1ToT2 && record.modifiedBy && (
            <div className="flex items-center space-x-4 mb-3 text-sm text-gray-600 bg-gray-50 p-3 rounded">
              <div className="flex items-center space-x-1">
                <UserIcon className="w-4 h-4" />
                <span>修改人: {record.modifiedBy}</span>
              </div>
              {record.modifiedAt && (
                <div className="flex items-center space-x-1">
                  <ClockIcon className="w-4 h-4" />
                  <span>修改时间: {record.modifiedAt}</span>
                </div>
              )}
              {record.modificationReason && (
                <div className="flex items-center space-x-1">
                  <DocumentTextIcon className="w-4 h-4" />
                  <span>原因: {record.modificationReason}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-4 p-2 hover:bg-gray-100 rounded transition-colors"
        >
          {expanded ? (
            <ChevronUpIcon className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-gray-500" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 animate-fade-in">
          <h4 className="font-serif-sc text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
            <BanknotesIcon className="w-4 h-4 text-finance-600" />
            <span>对账说明</span>
          </h4>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded">
              <div className="text-xs font-medium text-blue-800 mb-2">为什么被留下</div>
              <div className="text-sm text-blue-900">{record.whyKept || '暂无说明'}</div>
            </div>
            <div className="bg-amber-50 p-4 rounded">
              <div className="text-xs font-medium text-amber-800 mb-2">还缺什么材料</div>
              <div className="text-sm text-amber-900">
                {record.missingMaterials || '材料齐全'}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <div className="text-xs font-medium text-green-800 mb-2">下一步找谁</div>
              <div className="text-sm text-green-900">{record.nextAction || '无需处理'}</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
            <span>
              最后更新: {record.lastUpdatedBy} @ {record.lastUpdatedAt}
            </span>
            <Link
              to={`/record/${record.id}`}
              className="text-finance-600 hover:text-finance-700 font-medium"
            >
              查看详情 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
