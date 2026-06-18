import { CloudRain, Lightbulb, BookOpen, ExternalLink } from 'lucide-react';
import { useCloudOccludedRecords } from '../../hooks/useRecordQueries';
import { useRecordStore } from '../../store/useRecordStore';

const severityColors = {
  low: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: '轻微' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', label: '中等' },
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: '严重' },
};

export default function CloudOcclusion() {
  const cloudRecords = useCloudOccludedRecords();
  const cloudSuggestions = useRecordStore(s => s.cloudSuggestions);

  return (
    <div className="space-y-4">
      <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-200">
        <div className="flex items-start gap-3">
          <CloudRain className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-cyan-800">遥感云遮挡处理</p>
            <p className="text-xs text-cyan-600 mt-1">
              云遮挡记录单独显示，不被标注结果吞掉，附处理建议供参考。
              共 <span className="font-semibold">{cloudRecords.length}</span> 条云遮挡记录
            </p>
          </div>
        </div>
      </div>

      {cloudRecords.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <CloudRain className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">暂无云遮挡记录</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cloudRecords.map(record => {
            const suggestion = cloudSuggestions.find(s => s.recordId === record.id);
            const severity = suggestion?.severity || 'low';
            const color = severityColors[severity as keyof typeof severityColors];

            return (
              <div
                key={record.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                      <CloudRain className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-800">{record.buoyId}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${color.bg} ${color.text} ${color.border}`}>
                          {color.label}云遮挡
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(record.recordTime).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">海况 {record.seaState} 级</p>
                    <p className="text-xs text-slate-400">波高 {record.waveHeight}m</p>
                  </div>
                </div>

                {suggestion && (
                  <div className="px-5 py-4 bg-gradient-to-r from-yellow-50 to-transparent border-b border-yellow-100">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800 mb-1">处理建议</p>
                        <p className="text-sm text-yellow-700 leading-relaxed">
                          {suggestion.suggestion}
                        </p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-yellow-600">
                          <BookOpen className="w-3 h-3" />
                          <span>参考：{suggestion.referenceDoc}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="px-5 py-3 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>位置：{record.latitude.toFixed(4)}°N, {record.longitude.toFixed(4)}°E</span>
                    <span>·</span>
                    <span>船上记录：{record.rawLogEntry.latRaw}</span>
                  </div>
                  <button className="text-xs text-ocean-500 hover:text-ocean-600 flex items-center gap-1">
                    查看详情
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-medium text-slate-800 mb-3">处理方法汇总</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2 p-2 bg-green-50 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0"></span>
            <div>
              <p className="text-green-800 font-medium">轻微云遮挡（覆盖 {'<'} 30%）</p>
              <p className="text-green-600 text-xs mt-0.5">使用邻近浮标数据插值修正，标注可信度为"高"</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2 bg-yellow-50 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2 flex-shrink-0"></span>
            <div>
              <p className="text-yellow-800 font-medium">中等云遮挡（30% ~ 70%）</p>
              <p className="text-yellow-600 text-xs mt-0.5">结合历史数据趋势估算，标注可信度为"中"，需人工复核</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0"></span>
            <div>
              <p className="text-red-800 font-medium">严重云遮挡（覆盖 {'>'} 70%）</p>
              <p className="text-red-600 text-xs mt-0.5">数据不可用，标记为云遮挡，等待下一批次无云影像</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
