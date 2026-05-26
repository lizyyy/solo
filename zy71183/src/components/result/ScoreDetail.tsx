import { CheckCircle2, XCircle, AlertCircle, Clock, FileText } from 'lucide-react';
import type { ScoreDetail as ScoreDetailType } from '../../types';

interface ScoreDetailProps {
  details: ScoreDetailType[];
  totalScore: number;
  targetScore: number;
}

export function ScoreDetailComponent({ details, totalScore, targetScore }: ScoreDetailProps) {
  const getIconForType = (type: string) => {
    switch (type) {
      case 'correct':
      case 'full_completion':
      case 'report_complete':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'wrong_order':
      case 'duplicate':
        return <XCircle className="w-4 h-4 text-industrial-red" />;
      case 'skipped':
      case 'anomaly_unhandled':
      case 'anomaly_not_upgraded':
        return <AlertCircle className="w-4 h-4 text-industrial-yellow" />;
      case 'timeout':
        return <Clock className="w-4 h-4 text-industrial-red" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  const positiveScore = details.filter(d => d.points > 0).reduce((sum, d) => sum + d.points, 0);
  const negativeScore = details.filter(d => d.points < 0).reduce((sum, d) => sum + d.points, 0);

  const getGrade = () => {
    const ratio = totalScore / targetScore;
    if (ratio >= 1.2) return { grade: 'S', color: 'text-purple-400', bg: 'bg-purple-500' };
    if (ratio >= 1.0) return { grade: 'A', color: 'text-green-400', bg: 'bg-green-500' };
    if (ratio >= 0.8) return { grade: 'B', color: 'text-industrial-blue', bg: 'bg-industrial-blue' };
    if (ratio >= 0.5) return { grade: 'C', color: 'text-industrial-yellow', bg: 'bg-industrial-yellow' };
    return { grade: 'D', color: 'text-industrial-red', bg: 'bg-industrial-red' };
  };

  const gradeInfo = getGrade();

  return (
    <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">得分详情</h2>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-slate-400">目标得分</p>
            <p className="font-mono text-lg text-slate-300">{targetScore}</p>
          </div>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold ${gradeInfo.bg} text-white`}>
            {gradeInfo.grade}
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">实际得分</p>
            <p className={`font-mono text-2xl font-bold ${gradeInfo.color}`}>{totalScore}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
          <p className="text-sm text-slate-400 mb-1">获得分数</p>
          <p className="font-mono text-2xl text-green-400">+{positiveScore}</p>
        </div>
        <div className="bg-industrial-red/20 border border-industrial-red rounded-lg p-4">
          <p className="text-sm text-slate-400 mb-1">扣除分数</p>
          <p className="font-mono text-2xl text-industrial-red">{negativeScore}</p>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900">
            <tr className="text-left text-slate-400">
              <th className="pb-2">操作</th>
              <th className="pb-2">类型</th>
              <th className="pb-2 text-right">分值</th>
            </tr>
          </thead>
          <tbody>
            {details.map((detail) => (
              <tr key={detail.id} className="border-t border-slate-700">
                <td className="py-2 flex items-center gap-2">
                  {getIconForType(detail.type)}
                  <span className="text-white">{detail.description}</span>
                </td>
                <td className="py-2 text-slate-400 text-xs">
                  {detail.type === 'correct' && '正确操作'}
                  {detail.type === 'full_completion' && '流程完成'}
                  {detail.type === 'wrong_order' && '顺序错误'}
                  {detail.type === 'duplicate' && '重复记录'}
                  {detail.type === 'skipped' && '漏检项目'}
                  {detail.type === 'anomaly_unhandled' && '异常未处理'}
                  {detail.type === 'anomaly_not_upgraded' && '未上报'}
                  {detail.type === 'timeout' && '超时'}
                  {detail.type === 'report_complete' && '报告完整'}
                </td>
                <td className={`py-2 text-right font-mono ${detail.points > 0 ? 'text-green-400' : 'text-industrial-red'}`}>
                  {detail.points > 0 ? '+' : ''}{detail.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
