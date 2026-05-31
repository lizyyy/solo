import type { ResidencyRecord } from '../../data/types';
import StatusBadge from './StatusBadge';
import { getUnitSourceDisplay } from '../../logic/unitValidator';

interface ScheduleRowProps {
  record: ResidencyRecord;
}

export default function ScheduleRow({ record }: ScheduleRowProps) {
  return (
    <div
      className={`border border-gray-200 rounded-lg mb-3 overflow-hidden transition-all duration-300 hover:shadow-md ${
        record.isAutoJudged ? 'bg-gray-50' : 'bg-white'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {record.artwork.code}
            </span>
            <h4 className="font-body font-semibold text-gray-900">
              {record.artwork.title}
            </h4>
            <span className="text-gray-500 text-sm">— {record.artwork.artist}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge type={record.changeType} />
            {record.isAutoJudged ? (
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-blue-50 text-blue-600 border border-blue-200">
                自动判断
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-amber-50 text-amber-600 border border-amber-200">
                人工确认
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 text-sm">
          <div className="col-span-3">
            <div className="text-xs font-medium text-gray-500 mb-1">判断理由</div>
            <p className="text-gray-700 leading-relaxed">{record.judgmentReason}</p>
          </div>

          <div className="col-span-3">
            <div className="text-xs font-medium text-gray-500 mb-1">问题说明</div>
            <p className="text-gray-700 leading-relaxed">
              {record.issueDescription}
              {record.unitError?.hasError && (
                <span className="block mt-1 text-red-600 font-medium">
                  ⚠️ 尺寸单位错误：来自
                  {getUnitSourceDisplay(record.unitError.source)}
                  ，应为{record.unitError.expectedUnit}，实为{record.unitError.actualUnit}
                </span>
              )}
            </p>
          </div>

          <div className="col-span-3">
            <div className="text-xs font-medium text-gray-500 mb-1">下一步</div>
            <p className="text-gray-700 leading-relaxed">{record.nextStep}</p>
          </div>

          <div className="col-span-3">
            <div className="text-xs font-medium text-gray-500 mb-1">责任人 / 状态</div>
            <p className="text-gray-700 mb-1">{record.responsiblePerson}</p>
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                record.status === '已确认'
                  ? 'bg-green-100 text-green-700'
                  : record.status === '待确认'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {record.status}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-4 text-xs text-gray-500">
          <span className="font-mono">
            尺寸：{record.artwork.dimensions} {record.artwork.dimensionUnit}
          </span>
          <span>
            单位来源：{getUnitSourceDisplay(record.artwork.dimensionSource)}
          </span>
        </div>
      </div>
    </div>
  );
}
