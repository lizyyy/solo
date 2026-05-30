import { useDrumStore } from '../store/useDrumStore';
import { MATERIALS } from '../utils/constants';
import { validateAndCalculate } from '../utils/calculator';
import { Trash2, Eye, FileText, Clock } from 'lucide-react';

export default function HistoryList() {
  const { history, deleteFromHistory, loadFromHistory } = useDrumStore();

  if (history.length === 0) {
    return (
      <div className="bg-drum-card rounded-xl border border-drum-border p-8 flex flex-col items-center justify-center">
        <Clock className="w-10 h-10 text-drum-textDim mb-3" />
        <p className="text-drum-textDim text-sm">暂无调鼓记录</p>
        <p className="text-drum-textDim text-xs mt-1">在换算工作台保存记录后将在此显示</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map(record => {
        const mat = MATERIALS[record.material];
        const calcResult = validateAndCalculate(record);
        return (
          <div
            key={record.id}
            className="bg-drum-card rounded-xl border border-drum-border p-4 hover:border-drum-borderLight transition-all animate-fade-in"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-drum-text font-medium text-sm">
                    {record.diameter} {record.diameterUnit === 'inch' ? '英寸' : '厘米'}
                  </span>
                  <span className="text-drum-textDim text-xs">•</span>
                  <span className="text-drum-textMuted text-xs">{mat.label}</span>
                  <span className="text-drum-textDim text-xs">•</span>
                  <span className="text-drum-textMuted text-xs">
                    {record.tension} {record.tensionUnit}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-drum-copperLight font-display text-lg">
                    {calcResult.frequency.toFixed(1)} Hz
                  </span>
                  <span className="text-drum-textDim text-sm">{calcResult.noteName}</span>
                  {record.targetFreq > 0 && (
                    <span className={`text-xs ${
                      Math.abs(calcResult.deviation) <= 5 ? 'text-drum-green' :
                      Math.abs(calcResult.deviation) <= 10 ? 'text-drum-amber' : 'text-drum-red'
                    }`}>
                      {calcResult.deviation >= 0 ? '+' : ''}{calcResult.deviation.toFixed(1)}%
                    </span>
                  )}
                </div>
                {record.notes && (
                  <p className="text-drum-textDim text-xs mt-1 truncate">{record.notes}</p>
                )}
                <p className="text-drum-textDim text-xs mt-1">
                  {new Date(record.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => loadFromHistory(record.id)}
                  className="p-1.5 rounded-md text-drum-textDim hover:text-drum-copper hover:bg-drum-cardHover transition-all"
                  title="加载到工作台"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteFromHistory(record.id)}
                  className="p-1.5 rounded-md text-drum-textDim hover:text-drum-red hover:bg-drum-cardHover transition-all"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
