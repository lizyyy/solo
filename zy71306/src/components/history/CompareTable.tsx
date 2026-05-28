import { useCalibrationStore } from '../../store/calibrationStore';
import { Card } from '../common/Card';
import { formatPressure, formatWearLevel, formatTorque, getWearLevelColor } from '../../utils/formatters';
import { getTrackById } from '../../data/testTracks';

export default function CompareTable() {
  const { records, selectedRecords } = useCalibrationStore();

  const selectedRecordData = records.filter((r) => selectedRecords.includes(r.id));

  if (selectedRecordData.length < 2) {
    return (
      <Card title="参数对比">
        <div className="text-center py-8 text-walnut-400">
          <p>请选择至少 2 条记录进行对比</p>
          <p className="text-sm mt-2">点击记录卡片上的"对比"按钮</p>
        </div>
      </Card>
    );
  }

  return (
    <Card title={`参数对比 (${selectedRecordData.length} 组)`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brass-500/30">
              <th className="text-left py-2 px-3 text-walnut-400 font-medium">参数</th>
              {selectedRecordData.map((record, index) => (
                <th key={record.id} className="text-center py-2 px-3 text-brass-300 font-medium">
                  #{index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-walnut-700">
              <td className="py-2 px-3 text-walnut-300">唱针压力</td>
              {selectedRecordData.map((record) => (
                <td key={record.id} className="text-center py-2 px-3 font-mono text-brass-200">
                  {formatPressure(record.stylusPressure)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-walnut-700">
              <td className="py-2 px-3 text-walnut-300">抗滑力</td>
              {selectedRecordData.map((record) => (
                <td key={record.id} className="text-center py-2 px-3 font-mono">
                  <span className={record.antiSkatingDirection === 'reverse' ? 'text-danger-400' : 'text-brass-200'}>
                    {record.antiSkating.toFixed(2)}
                  </span>
                </td>
              ))}
            </tr>
            <tr className="border-b border-walnut-700">
              <td className="py-2 px-3 text-walnut-300">唱臂长度</td>
              {selectedRecordData.map((record) => (
                <td key={record.id} className="text-center py-2 px-3 font-mono text-brass-200">
                  {Math.round(record.tonearmLength)} mm
                </td>
              ))}
            </tr>
            <tr className="border-b border-walnut-700">
              <td className="py-2 px-3 text-walnut-300">力矩</td>
              {selectedRecordData.map((record) => (
                <td key={record.id} className="text-center py-2 px-3 font-mono text-brass-200">
                  {formatTorque(record.torque)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-walnut-700">
              <td className="py-2 px-3 text-walnut-300">磨损程度</td>
              {selectedRecordData.map((record) => (
                <td key={record.id} className="text-center py-2 px-3 font-mono font-bold">
                  <span style={{ color: getWearLevelColor(record.wearLevel) }}>
                    {formatWearLevel(record.wearLevel)}
                  </span>
                </td>
              ))}
            </tr>
            <tr className="border-b border-walnut-700">
              <td className="py-2 px-3 text-walnut-300">测试曲目</td>
              {selectedRecordData.map((record) => (
                <td key={record.id} className="text-center py-2 px-3 text-brass-200">
                  {getTrackById(record.testTrack).name}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 px-3 text-walnut-300">问题数</td>
              {selectedRecordData.map((record) => (
                <td key={record.id} className="text-center py-2 px-3">
                  {record.errors.length > 0 ? (
                    <span className={record.errors.some(e => e.severity === 'high') ? 'text-danger-400' : 'text-amber-400'}>
                      {record.errors.length}
                    </span>
                  ) : (
                    <span className="text-success-400">0</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
