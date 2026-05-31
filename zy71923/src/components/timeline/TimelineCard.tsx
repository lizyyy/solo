import type { TimelineRecord, Artwork } from '../../data/types';
import { getUnitSourceDisplay } from '../../logic/unitValidator';

interface TimelineCardProps {
  record: TimelineRecord;
  artwork?: Artwork;
}

const sourceConfig = {
  lighting: {
    color: 'bg-orange-600',
    border: 'border-l-orange-600',
    bg: 'bg-orange-50',
    label: '灯光记录',
    text: 'text-orange-800',
  },
  note: {
    color: 'bg-blue-700',
    border: 'border-l-blue-700',
    bg: 'bg-blue-50',
    label: '策展备注',
    text: 'text-blue-800',
  },
  inventory: {
    color: 'bg-green-700',
    border: 'border-l-green-700',
    bg: 'bg-green-50',
    label: '作品清单',
    text: 'text-green-800',
  },
};

function formatDate(date: Date): string {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

export default function TimelineCard({ record, artwork }: TimelineCardProps) {
  const config = sourceConfig[record.sourceType];

  return (
    <div
      className={`relative pl-8 pb-8 transition-all duration-300 hover:translate-x-1 group`}
    >
      <div
        className={`absolute left-[-5px] top-1 w-3 h-3 rounded-full ${config.color} ring-4 ring-ivory z-10 transition-transform duration-300 group-hover:scale-125`}
      />
      <div
        className={`${config.bg} border-l-4 ${config.border} rounded-r-lg p-4 shadow-sm transition-all duration-300 hover:shadow-md`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${config.bg} ${config.text} border`}
            >
              {config.label}
            </span>
            {record.isManual && (
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-600 border border-gray-200">
                手工录入
              </span>
            )}
          </div>
          <span className="font-mono text-xs text-gray-500">
            {formatDate(record.timestamp)}
          </span>
        </div>

        <p className="font-body text-sm text-gray-700 leading-relaxed mb-2">
          {record.content}
        </p>

        {artwork && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono text-gray-500">{artwork.code}</span>
              <span className="text-gray-700 font-medium">{artwork.title}</span>
              <span className="text-gray-500">— {artwork.artist}</span>
              <span className="font-mono text-gray-600">
                {artwork.dimensions} {artwork.dimensionUnit}
              </span>
              <span className="text-gray-400">
                单位来源：{getUnitSourceDisplay(artwork.dimensionSource)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
