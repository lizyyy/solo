import { useRef, useState } from 'react';
import { X, Trophy, Frown, FileJson, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useGameStore } from '../store/useGameStore';
import { Drain, Lowland, Pump } from '../engine/types';

export function ReportModal() {
  const { state, history, simulator, resetGame } = useGameStore();
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<'pdf' | 'json' | null>(null);

  if (!state.isGameOver || state.isReplayMode) return null;

  const generateReportData = () => {
    const scoreBreakdown = simulator?.calculateScoreBreakdown() || {
      baseScore: 0,
      drainMaintenance: 0,
      pumpEfficiency: 0,
      waterPenalty: 0,
      facilityDamage: 0,
      bonus: 0,
    };

    const drains = state.facilities.filter(f => f.type === 'drain') as Drain[];
    const pumps = state.facilities.filter(f => f.type === 'pump') as Pump[];
    const lowlands = state.facilities.filter(f => f.type === 'lowland') as Lowland[];

    const scoreHistory = history.map(h => ({
      turn: h.turn,
      score: h.state.score,
    }));

    const facilityStats = {
      drains: {
        total: drains.length,
        broken: drains.filter(d => d.status === 'broken').length,
        avgEfficiency: drains.reduce((sum, d) => sum + d.efficiency, 0) / drains.length,
      },
      pumps: {
        total: pumps.length,
        broken: pumps.filter(p => p.status === 'broken').length,
        avgLoad: pumps.reduce((sum, p) => sum + p.currentLoad, 0) / pumps.length,
      },
      lowlands: {
        total: lowlands.length,
        maxLevel: Math.max(...lowlands.map(l => l.waterLevel)),
        dangerTurns: lowlands.reduce((sum, l) => sum + l.dangerCount, 0),
      },
    };

    const keyEvents: { turn: number; event: string }[] = [];
    history.forEach(h => {
      h.events.forEach(e => {
        if (e.includes('警报') || e.includes('堵塞') || e.includes('超载') || e.includes('超标') || e.includes('恭喜')) {
          keyEvents.push({ turn: h.turn, event: e });
        }
      });
    });

    return { scoreBreakdown, scoreHistory, facilityStats, keyEvents };
  };

  const { scoreBreakdown, scoreHistory, facilityStats, keyEvents } = generateReportData();

  const exportJSON = () => {
    setExporting('json');
    setTimeout(() => {
      const reportData = {
        finalScore: state.score,
        isVictory: state.isVictory,
        failReason: state.failReason,
        totalTurns: state.turn,
        scoreBreakdown,
        keyEvents,
        facilityStats,
        timeline: history.map(h => ({
          turn: h.turn,
          score: h.state.score,
          events: h.events,
        })),
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drainage-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExporting(null);
    }, 300);
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    setExporting('pdf');

    try {
      const input = reportRef.current;
      const canvas = await html2canvas(input, {
        backgroundColor: '#111827',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`drainage-report-${Date.now()}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setExporting(null);
    }
  };

  const handleClose = () => {
    resetGame();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden m-4"
        >
          <div ref={reportRef} className="overflow-y-auto max-h-[90vh]">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                {state.isVictory ? (
                  <Trophy className="text-yellow-400" size={32} />
                ) : (
                  <Frown className="text-red-400" size={32} />
                )}
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {state.isVictory ? '防涝成功!' : '防涝失败'}
                  </h2>
                  {state.failReason && (
                    <p className="text-red-400 text-sm">{state.failReason}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportPDF}
                  disabled={exporting !== null}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {exporting === 'pdf' ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
                  {exporting === 'pdf' ? '导出中...' : '导出PDF'}
                </button>
                <button
                  onClick={exportJSON}
                  disabled={exporting !== null}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {exporting === 'json' ? <Loader2 size={18} className="animate-spin" /> : <FileJson size={18} />}
                  {exporting === 'json' ? '导出中...' : '导出JSON'}
                </button>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-8">
              <div className="text-center py-8 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl">
                <div className="text-gray-400 text-sm mb-2">最终得分</div>
                <div className={`text-6xl font-bold ${state.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {state.score}
                </div>
                <div className="text-gray-500 text-sm mt-2">完成 {state.turn} / {state.maxTurns} 回合</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-xl p-6">
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <FileText size={18} className="text-blue-400" />
                    得分明细
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">基础分</span>
                      <span className="text-white">+{scoreBreakdown.baseScore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">雨水口维护</span>
                      <span className="text-green-400">+{scoreBreakdown.drainMaintenance}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">泵站效率</span>
                      <span className="text-green-400">+{scoreBreakdown.pumpEfficiency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">积水惩罚</span>
                      <span className="text-red-400">{scoreBreakdown.waterPenalty}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">设施损坏</span>
                      <span className="text-red-400">{scoreBreakdown.facilityDamage}</span>
                    </div>
                    {scoreBreakdown.bonus > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">胜利奖励</span>
                        <span className="text-yellow-400">+{scoreBreakdown.bonus}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-700 pt-3 flex justify-between font-bold">
                      <span className="text-white">总分</span>
                      <span className={state.score >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {state.score}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-6">
                  <h3 className="text-white font-bold mb-4">设施统计</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">雨水口</span>
                        <span className="text-white">{facilityStats.drains.total - facilityStats.drains.broken} / {facilityStats.drains.total} 正常</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        平均效率: {(facilityStats.drains.avgEfficiency * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">泵站</span>
                        <span className="text-white">{facilityStats.pumps.total - facilityStats.pumps.broken} / {facilityStats.pumps.total} 正常</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        平均负载: {(facilityStats.pumps.avgLoad * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">低洼点</span>
                        <span className="text-white">最高水位: {facilityStats.lowlands.maxLevel.toFixed(1)}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        危险回合数: {facilityStats.lowlands.dangerTurns}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-white font-bold mb-4">得分走势</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={scoreHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="turn" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Line type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {keyEvents.length > 0 && (
                <div className="bg-gray-800 rounded-xl p-6">
                  <h3 className="text-white font-bold mb-4">关键事件</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {keyEvents.map((event, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-2 hover:bg-gray-700/50 rounded-lg">
                        <span className="text-blue-400 font-mono text-sm">[第{event.turn}回合]</span>
                        <span className="text-gray-300 text-sm">{event.event}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-4">
                <button
                  onClick={handleClose}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors"
                >
                  重新开始
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
