import { useApp } from '../../context/AppContext';
import ScheduleRow from './ScheduleRow';

export default function ScheduleView() {
  const { residencyRecords } = useApp();

  const materialOnlyCount = residencyRecords.filter(
    (r) => r.changeType === 'material-only'
  ).length;
  const conclusionChangeCount = residencyRecords.filter(
    (r) => r.changeType === 'conclusion-change'
  ).length;
  const unitErrorCount = residencyRecords.filter((r) => r.unitError?.hasError).length;

  return (
    <div>
      <div className="mb-8">
        <h2 className="font-display text-3xl text-gray-900 mb-2">艺术驻留排期</h2>
        <p className="font-body text-gray-600 text-sm">
          智能判断每条记录的变更类型，明确区分补材料与结论变更，展示判断理由和下一步动作
        </p>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900 font-display">
            {residencyRecords.length}
          </div>
          <div className="text-sm text-gray-500 font-body">总记录数</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-700 font-display">
            {materialOnlyCount}
          </div>
          <div className="text-sm text-blue-600 font-body">补材料</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-orange-700 font-display">
            {conclusionChangeCount}
          </div>
          <div className="text-sm text-orange-600 font-body">改结论</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-700 font-display">
            {unitErrorCount}
          </div>
          <div className="text-sm text-red-600 font-body">单位冲突</div>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h4 className="font-body font-semibold text-gray-700 mb-2">判断规则说明</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>补材料</strong>：仅补充说明、附件等辅助信息，不涉及作品位置、尺寸、灯光方案等核心结论</li>
          <li>• <strong>改结论</strong>：内容涉及作品位置、尺寸、灯光方案、学术说明等核心字段的调整</li>
          <li>• 自动判断必须展示判断理由，人工判断的记录会标注「人工确认」标签</li>
          <li>• 尺寸单位错误会明确标注来源（灯光记录/策展备注）及下一步责任人</li>
        </ul>
      </div>

      <div>
        <h3 className="font-display text-xl text-gray-900 mb-4">驻留记录明细</h3>
        {residencyRecords.map((record) => (
          <ScheduleRow key={record.id} record={record} />
        ))}
      </div>
    </div>
  );
}
