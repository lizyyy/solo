import React, { useState } from 'react';
import { X, Info, Wrench, Camera, TrendingUp, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { STATUS_COLORS, STATUS_LABELS } from '../../types';
import { useInspectionStore } from '../../store/inspectionStore';

export const DetailPanel: React.FC = () => {
  const { cracks, selectedCrackId, setSelectedCrackId } = useInspectionStore();
  const [expandedSection, setExpandedSection] = useState<string | null>('history');

  const selectedCrack = cracks.find((c) => c.id === selectedCrackId);

  if (!selectedCrack) {
    return (
      <div className="w-72 bg-gray-900 border-l border-gray-700 flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">选择一条裂缝查看详情</p>
          <p className="text-xs mt-1">点击3D场景中的标记点</p>
        </div>
      </div>
    );
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const chartData = selectedCrack.history.map((h) => ({
    date: h.date.substring(5),
    length: h.length * 100,
    width: h.width,
  }));

  return (
    <div className="w-72 bg-gray-900 border-l border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[selectedCrack.status] }}
            />
            <span className="font-bold text-white">{selectedCrack.id}</span>
          </div>
          <button
            onClick={() => setSelectedCrackId(null)}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div
          className="inline-block px-2 py-1 rounded text-xs font-medium"
          style={{
            backgroundColor: `${STATUS_COLORS[selectedCrack.status]}20`,
            color: STATUS_COLORS[selectedCrack.status],
          }}
        >
          {STATUS_LABELS[selectedCrack.status]}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-gray-700">
          <p className="text-sm text-gray-300">{selectedCrack.description}</p>
        </div>

        <div className="p-4 border-b border-gray-700">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">裂缝长度</div>
              <div className="text-lg font-bold text-white">{selectedCrack.length.toFixed(2)} m</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">裂缝宽度</div>
              <div className="text-lg font-bold text-white">{selectedCrack.width.toFixed(1)} mm</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <MapPin className="w-3 h-3" />
              三维坐标
            </div>
            <div className="text-sm text-gray-300 font-mono">
              ({selectedCrack.position.x.toFixed(2)}, {selectedCrack.position.y.toFixed(2)}, {selectedCrack.position.z.toFixed(2)})
            </div>
          </div>
        </div>

        <div className="border-b border-gray-700">
          <div
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => toggleSection('history')}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white">历史变化</span>
            </div>
            {expandedSection === 'history' ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
          {expandedSection === 'history' && (
            <div className="px-4 pb-4">
              <div className="h-32 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      labelStyle={{ color: '#9CA3AF' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="length"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6', strokeWidth: 2 }}
                      name="长度(cm)"
                    />
                    <Line
                      type="monotone"
                      dataKey="width"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ fill: '#10B981', strokeWidth: 2 }}
                      name="宽度(mm)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedCrack.history.map((record) => (
                  <div key={record.id} className="flex items-start gap-2 text-xs">
                    <span
                      className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[record.status] }}
                    />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="text-gray-300">{record.date}</span>
                        <span className="text-gray-500">{STATUS_LABELS[record.status]}</span>
                      </div>
                      <div className="text-gray-500">
                        {record.length.toFixed(2)}m · {record.width.toFixed(1)}mm
                      </div>
                      {record.notes && (
                        <div className="text-gray-400 mt-0.5">{record.notes}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-b border-gray-700">
          <div
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => toggleSection('repair')}
          >
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-white">维修记录</span>
              {selectedCrack.repairRecords.length > 0 && (
                <span className="px-1.5 py-0.5 bg-green-500 bg-opacity-20 text-green-400 text-xs rounded">
                  {selectedCrack.repairRecords.length}
                </span>
              )}
            </div>
            {expandedSection === 'repair' ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
          {expandedSection === 'repair' && (
            <div className="px-4 pb-4">
              {selectedCrack.repairRecords.length > 0 ? (
                <div className="space-y-3">
                  {selectedCrack.repairRecords.map((record) => (
                    <div
                      key={record.id}
                      className="p-3 bg-gray-800 rounded-lg border border-gray-700"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-white">{record.method}</span>
                        <span className="text-xs text-gray-500">{record.date}</span>
                      </div>
                      <p className="text-xs text-gray-400">{record.description}</p>
                      {record.nextReviewDate && (
                        <div className="mt-2 text-xs text-yellow-400">
                          下次复查: {record.nextReviewDate}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  暂无维修记录
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => toggleSection('photos')}
          >
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-white">现场照片</span>
              {selectedCrack.photos.length > 0 && (
                <span className="px-1.5 py-0.5 bg-purple-500 bg-opacity-20 text-purple-400 text-xs rounded">
                  {selectedCrack.photos.length}
                </span>
              )}
            </div>
            {expandedSection === 'photos' ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
          {expandedSection === 'photos' && (
            <div className="px-4 pb-4">
              {selectedCrack.photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {selectedCrack.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="aspect-square bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700"
                    >
                      <Camera className="w-6 h-6 text-gray-600" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  暂无照片
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
