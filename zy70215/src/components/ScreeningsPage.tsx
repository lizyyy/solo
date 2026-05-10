import { useState } from 'react';
import { useApp } from '../context/AppContext';

export function ScreeningsPage() {
  const { data, importScreenings, generateCleaningTasks } = useApp();
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleImport = () => {
    if (!importText.trim()) {
      setMessage({ type: 'error', text: '请输入排片数据' });
      return;
    }
    const result = importScreenings(importText);
    if (result.added > 0) {
      setMessage({ type: 'success', text: `成功导入 ${result.added} 条排片${result.skipped > 0 ? `，跳过 ${result.skipped} 条重复数据` : ''}` });
      setImportText('');
    } else if (result.skipped > 0) {
      setMessage({ type: 'info', text: `跳过 ${result.skipped} 条重复数据` });
    } else {
      setMessage({ type: 'error', text: '未能解析任何有效排片数据，请检查格式' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleGenerateTasks = () => {
    generateCleaningTasks();
    setMessage({ type: 'success', text: '清洁任务生成完成' });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadSample = () => {
    const today = new Date().toISOString().slice(0, 10);
    setImportText(`
${today},1厅,流浪地球3,09:00-11:15,120人
${today},1厅,封神第二部,11:45-14:00,95人
${today},1厅,哪吒2,14:30-16:45,150人
${today},2厅,封神第二部,09:30-11:45,88人
${today},2厅,流浪地球3,12:15-14:30,110人
${today},2厅,哈利波特重置版,15:00-17:15,75人
${today},3厅,哪吒2,10:00-12:15,140人
${today},3厅,哈利波特重置版,12:45-15:00,60人
${today},3厅,流浪地球3,15:30-17:45,105人
    `.trim());
  };

  const hasTasksForAll = data.screenings.every(s =>
    data.cleaningTasks.some(t => t.screeningId === s.id)
  );

  const groupedByHall: Record<string, typeof data.screenings> = {};
  for (const s of data.screenings) {
    if (!groupedByHall[s.hallNumber]) groupedByHall[s.hallNumber] = [];
    groupedByHall[s.hallNumber].push(s);
  }
  const halls = Object.keys(groupedByHall).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
          'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">导入排片数据</h2>
            <p className="text-sm text-slate-500 mt-1">
              格式：日期,影厅,影片,开始-结束时间,观众数
            </p>
          </div>
          <button
            onClick={loadSample}
            className="px-4 py-2 text-sm text-slate-600 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
          >
            填充样例
          </button>
        </div>
        <div className="p-6">
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            className="w-full h-40 p-3 border border-slate-200 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder={`2026-05-10,1厅,流浪地球3,09:00-11:15,120人\n2026-05-10,1厅,封神第二部,11:45-14:00,95人`}
          />
          <div className="mt-4 flex justify-between items-center">
            <p className="text-xs text-slate-400">
              每行一条排片，支持 CSV/TSV/分号等分隔符
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                导入排片
              </button>
              {data.screenings.length > 0 && !hasTasksForAll && (
                <button
                  onClick={handleGenerateTasks}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  生成清洁任务
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">排片列表</h2>
            <p className="text-sm text-slate-500 mt-1">
              共 {data.screenings.length} 场排片，分布于 {halls.length} 个影厅
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {halls.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {halls.map(hall => (
                <div key={hall}>
                  <div className="px-6 py-3 bg-slate-50 font-medium text-slate-700">
                    {hall}号厅
                  </div>
                  {groupedByHall[hall]
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map(s => {
                      const hasTask = data.cleaningTasks.some(t => t.screeningId === s.id);
                      const task = data.cleaningTasks.find(t => t.screeningId === s.id);
                      return (
                        <div key={s.id} className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-slate-50">
                          <div className="col-span-2">
                            <div className="text-sm text-slate-500">日期</div>
                            <div className="font-medium text-slate-800">{s.date}</div>
                          </div>
                          <div className="col-span-3">
                            <div className="text-sm text-slate-500">影片</div>
                            <div className="font-medium text-slate-800">{s.movieName}</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-sm text-slate-500">时间</div>
                            <div className="font-medium text-slate-800">{s.startTime} - {s.endTime}</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-sm text-slate-500">观众数</div>
                            <div className="font-medium text-slate-800">{s.audienceCount} 人</div>
                          </div>
                          <div className="col-span-3 text-right">
                            {hasTask ? (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                task?.status === 'completed' ? 'bg-green-100 text-green-700' :
                                task?.status === 'in_progress' ? 'bg-cyan-100 text-cyan-700' :
                                task?.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {task?.status === 'completed' ? '已完成清洁' :
                                 task?.status === 'in_progress' ? '清洁中' :
                                 task?.status === 'pending' ? '待清洁' :
                                 '超时'}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-sm">未生成任务</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              <div className="text-4xl mb-2">🎬</div>
              <p>暂无排片数据，请先导入</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
