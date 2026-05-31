import { useState } from 'react';
import { X, AlertTriangle, CheckCircle, Flag, MessageSquare, History, Music, User, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useAppStore, useSelectedDeviation, useSelectedBatch } from '../../store/useAppStore';
import { getStudentDeviationHistory, getRelatedNotes } from '../../utils/calculations';
import { getCategoryLabel, getCategoryColor, getAnomalyTypeLabel, getNoteSourceLabel } from '../../utils/classification';

export function DetailModal() {
  const { 
    batches, 
    deviations, 
    students, 
    notes,
    selectedDeviationId, 
    setSelectedDeviationId,
    markAsReviewed,
    toggleAnomaly,
    updateDeviation,
  } = useAppStore();
  
  const selectedDeviation = useSelectedDeviation();
  const selectedBatch = useSelectedBatch();
  const [annotation, setAnnotation] = useState('');

  if (!selectedDeviation || !selectedDeviationId) return null;

  const student = students.find(s => s.id === selectedDeviation.studentId);
  const batch = batches.find(b => b.id === selectedDeviation.batchId);
  const historyData = getStudentDeviationHistory(
    selectedDeviation.studentId,
    selectedDeviation.measure,
    deviations,
    batches
  );
  const relatedNotes = getRelatedNotes(
    selectedDeviation.batchId,
    selectedDeviation.measure,
    selectedDeviation.studentId,
    notes
  );

  const handleClose = () => {
    setSelectedDeviationId(null);
    setAnnotation('');
  };

  const handleMarkReviewed = () => {
    markAsReviewed(selectedDeviationId);
  };

  const handleToggleAnomaly = () => {
    toggleAnomaly(selectedDeviationId, '老师手动标记');
  };

  const handleSaveAnnotation = () => {
    if (annotation.trim()) {
      updateDeviation(selectedDeviationId, { manualAnnotation: annotation });
      setAnnotation('');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-primary to-primary-600 text-white p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-serif text-xl font-bold mb-1">偏差详情</h2>
              <div className="flex items-center gap-3 text-white/80 text-sm">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {student?.name}
                </span>
                <span className="flex items-center gap-1">
                  <Music className="w-3.5 h-3.5" />
                  第 {selectedDeviation.measure} 小节
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {batch?.rehearsalDate}
                </span>
              </div>
            </div>
            <button 
              onClick={handleClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(90vh-200px)] scrollbar-thin">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-cream-50 rounded-xl p-4 text-center">
              <div className={`text-3xl font-bold font-mono mb-1 ${
                Math.abs(selectedDeviation.deviationCents) > 50 ? 'text-deviation-severe' :
                Math.abs(selectedDeviation.deviationCents) > 30 ? 'text-deviation-mild' :
                'text-deviation-normal'
              }`}>
                {selectedDeviation.deviationCents > 0 ? '+' : ''}{selectedDeviation.deviationCents}
              </div>
              <div className="text-xs text-primary-500">音分 (cents)</div>
            </div>
            
            <div 
              className="rounded-xl p-4 text-center"
              style={{ backgroundColor: `${getCategoryColor(selectedDeviation.category)}15` }}
            >
              <div 
                className="text-lg font-bold mb-1"
                style={{ color: getCategoryColor(selectedDeviation.category) }}
              >
                {getCategoryLabel(selectedDeviation.category)}
              </div>
              <div className="text-xs text-primary-500">偏差分类</div>
            </div>
            
            <div className={`rounded-xl p-4 text-center ${
              selectedDeviation.reviewed 
                ? 'bg-green-50' 
                : selectedDeviation.isAnomaly 
                  ? 'bg-gray-50' 
                  : 'bg-yellow-50'
            }`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                {selectedDeviation.reviewed ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : selectedDeviation.isAnomaly ? (
                  <AlertTriangle className="w-5 h-5 text-gray-500" />
                ) : (
                  <Flag className="w-5 h-5 text-yellow-600" />
                )}
                <span className={`font-bold ${
                  selectedDeviation.reviewed 
                    ? 'text-green-600' 
                    : selectedDeviation.isAnomaly 
                      ? 'text-gray-600' 
                      : 'text-yellow-600'
                }`}>
                  {selectedDeviation.reviewed ? '已复核' : selectedDeviation.isAnomaly ? '异常数据' : '待复核'}
                </span>
              </div>
              <div className="text-xs text-primary-500">当前状态</div>
            </div>
          </div>

          {selectedDeviation.isAnomaly && (
            <div className="mb-6 p-4 bg-orange-50 rounded-xl border border-orange-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-orange-700 mb-1">
                    {getAnomalyTypeLabel(selectedDeviation.anomalyType)} - 此数据不参与平均值计算
                  </h4>
                  <p className="text-sm text-orange-600">
                    {selectedDeviation.anomalyReason}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="font-serif text-lg font-semibold text-primary mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-accent" />
              历史偏差趋势
            </h3>
            <div className="h-48 bg-cream-50 rounded-xl p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e0cf" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#588686', fontSize: 11 }}
                    axisLine={{ stroke: '#d4c8b0' }}
                  />
                  <YAxis 
                    tick={{ fill: '#588686', fontSize: 11 }}
                    axisLine={{ stroke: '#d4c8b0' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      borderRadius: '8px',
                      border: '1px solid #e8e0cf',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value > 0 ? '+' : ''}${value} 音分`, '偏差']}
                  />
                  <ReferenceLine y={30} stroke="#e67e22" strokeDasharray="3 3" label={{ value: '警戒线', fill: '#e67e22', fontSize: 10, position: 'right' }} />
                  <ReferenceLine y={50} stroke="#c0392b" strokeDasharray="3 3" label={{ value: '严重线', fill: '#c0392b', fontSize: 10, position: 'right' }} />
                  <Line 
                    type="monotone" 
                    dataKey="deviationCents"
                    stroke="#d4a855"
                    strokeWidth={2}
                    dot={(props: any) => {
                      const isAnomaly = props.payload?.isAnomaly;
                      const isCurrent = props.payload?.batchId === selectedDeviation.batchId;
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={isCurrent ? 6 : 4}
                          fill={isAnomaly ? '#95a5a6' : isCurrent ? '#d4a855' : '#f5d78e'}
                          stroke={isCurrent ? '#fff' : 'none'}
                          strokeWidth={isCurrent ? 2 : 0}
                        />
                      );
                    }}
                    activeDot={{ r: 8, fill: '#d4a855', stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-primary-400 mt-2 text-center">
              同一学生同一小节的历史偏差曲线（横线为30音分警戒线和50音分严重线）
            </p>
          </div>

          {relatedNotes.length > 0 && (
            <div className="mb-6">
              <h3 className="font-serif text-lg font-semibold text-primary mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-accent" />
                关联备注
              </h3>
              <div className="space-y-3">
                {relatedNotes.map(note => (
                  <div key={note.id} className="sticky-note max-w-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-200/50 px-2 py-0.5 rounded">
                        {getNoteSourceLabel(note.source)}
                      </span>
                      <span className="text-[10px] text-amber-600/70">
                        {note.createdAt.slice(0, 16)}
                      </span>
                    </div>
                    <p className="text-sm text-amber-900 leading-relaxed">{note.content}</p>
                    <p className="text-[10px] text-amber-700/70 mt-2 text-right">
                      — {note.author}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedDeviation.manualAnnotation && (
            <div className="mb-6 p-4 bg-primary/5 rounded-xl border border-primary/10">
              <h4 className="text-sm font-semibold text-primary mb-2">老师标注</h4>
              <p className="text-sm text-primary-700">{selectedDeviation.manualAnnotation}</p>
            </div>
          )}

          <div className="flex gap-3">
            {!selectedDeviation.reviewed && !selectedDeviation.isAnomaly && (
              <button
                onClick={handleMarkReviewed}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                标记已复核
              </button>
            )}
            
            <button
              onClick={handleToggleAnomaly}
              className={`flex-1 btn-ghost flex items-center justify-center gap-2 border ${
                selectedDeviation.isAnomaly 
                  ? 'border-orange-300 text-orange-600 hover:bg-orange-50' 
                  : 'border-primary/20'
              }`}
            >
              <Flag className="w-4 h-4" />
              {selectedDeviation.isAnomaly ? '取消异常标记' : '标记为异常'}
            </button>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-primary-600 mb-2">
              添加标注
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={annotation}
                onChange={e => setAnnotation(e.target.value)}
                placeholder="输入老师标注内容..."
                className="flex-1 px-3 py-2 rounded-lg border border-cream-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
              <button
                onClick={handleSaveAnnotation}
                disabled={!annotation.trim()}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
