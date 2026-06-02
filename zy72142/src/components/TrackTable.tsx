import type { Track, AnomalyType } from '../types';
import { TrackRow } from './TrackRow';

interface TrackTableProps {
  tracks: Track[];
  onUpdateRemark: (trackId: string, remark: string) => void;
  onUpdateAnomaly: (trackId: string, anomalyTypes: AnomalyType[]) => void;
  highlightedTrackId: string | null;
}

export function TrackTable({ tracks, onUpdateRemark, onUpdateAnomaly, highlightedTrackId }: TrackTableProps) {
  if (tracks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-gray-400 text-lg">暂无匹配的曲目</div>
        <div className="text-gray-400 text-sm mt-2">请尝试调整筛选条件</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-14">
                序号
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[180px]">
                曲目 / 艺术家
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                ISRC
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                时长
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                时码
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                授权
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                异常类型
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[200px]">
                备注
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
                信息
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                onUpdateRemark={onUpdateRemark}
                onUpdateAnomaly={onUpdateAnomaly}
                isHighlighted={highlightedTrackId === track.id}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
