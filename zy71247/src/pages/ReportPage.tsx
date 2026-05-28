import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { getSceneById } from '../data/scenes';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';

export function ReportPage() {
  const navigate = useNavigate();
  const { result } = useGameStore();
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const scene = result ? getSceneById(result.params.sceneId) : null;

  useEffect(() => {
    if (!result) {
      navigate('/');
    }
  }, [result, navigate]);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#0A192F',
        useCORS: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`SAR成像报告_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.pdf`);
    } catch (error) {
      console.error('导出PDF失败:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (!result || !scene) return null;

  const totalGrade = result.scores.totalScore >= 90 ? 'A' : 
                     result.scores.totalScore >= 80 ? 'B' :
                     result.scores.totalScore >= 70 ? 'C' :
                     result.scores.totalScore >= 60 ? 'D' : 'F';

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = {
      A: 'text-green-400',
      B: 'text-blue-400',
      C: 'text-yellow-400',
      D: 'text-orange-400',
      F: 'text-red-400'
    };
    return colors[grade] || 'text-white';
  };

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/review')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-space-700/50 border border-space-600 text-space-200 hover:border-space-500 hover:text-space-100 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              返回复盘
            </button>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-tech-400 text-glow">
                成像报告预览
              </h1>
              <p className="text-space-300 text-sm mt-1">
                合成孔径雷达成像实验报告
              </p>
            </div>
          </div>
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-tech-500/20 border border-tech-400 text-tech-400 hover:bg-tech-500/30 hover:shadow-lg hover:shadow-tech-500/20 transition-all disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? '导出中...' : '导出PDF'}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto">
        <div
          ref={reportRef}
          className="bg-space-500 rounded-lg p-8 border border-tech-500/30"
        >
          <div className="text-center mb-8 pb-6 border-b border-tech-500/20">
            <h1 className="font-orbitron text-3xl font-bold text-tech-400 mb-2">
              合成孔径雷达成像实验报告
            </h1>
            <p className="text-space-300">SAR Imaging Experiment Report</p>
            <div className="mt-4 text-sm text-space-400">
              <p>实验时间: {new Date(result.timestamp).toLocaleString('zh-CN')}</p>
              <p>地物场景: {scene.name}</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-orbitron text-xl text-tech-400 mb-4">一、综合评分</h2>
            <div className="bg-space-600/50 rounded-lg p-6 text-center">
              <div className={`text-8xl font-bold font-orbitron ${getGradeColor(totalGrade)}`}>
                {totalGrade}
              </div>
              <div className="text-4xl font-mono text-tech-400 mt-4">
                {result.scores.totalScore.toFixed(1)} 分
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-orbitron text-xl text-tech-400 mb-4">二、分项评分详情</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: '航迹准确度', score: result.scores.trackAccuracy },
                { name: '采样充足度', score: result.scores.samplingAdequacy },
                { name: '噪声控制', score: result.scores.noiseControl },
                { name: '成像清晰度', score: result.scores.imageClarity }
              ].map((item, idx) => (
                <div key={idx} className="bg-space-600/50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-space-200">{item.name}</span>
                    <span className={`font-mono text-lg ${getGradeColor(item.score.grade)}`}>
                      {item.score.value.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-2 bg-space-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-tech-400 transition-all"
                      style={{ width: `${item.score.value}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-space-400">
                    权重: {(item.score.weight * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-orbitron text-xl text-tech-400 mb-4">三、评分计算过程</h2>
            <div className="bg-space-600/50 rounded-lg p-4 font-mono text-sm">
              <p className="text-space-300 mb-2">总分计算公式:</p>
              <p className="text-space-100 mb-2">
                总分 = 航迹准确度×0.3 + 采样充足度×0.3 + 噪声控制×0.2 + 成像清晰度×0.2
              </p>
              <p className="text-space-300 mt-4 mb-2">代入数值:</p>
              <p className="text-space-100">
                {result.scores.trackAccuracy.value.toFixed(1)} × 0.3 + {' '}
                {result.scores.samplingAdequacy.value.toFixed(1)} × 0.3 + {' '}
                {result.scores.noiseControl.value.toFixed(1)} × 0.2 + {' '}
                {result.scores.imageClarity.value.toFixed(1)} × 0.2
              </p>
              <p className="text-tech-400 mt-2">
                = {(result.scores.trackAccuracy.value * 0.3).toFixed(2)} + {' '}
                {(result.scores.samplingAdequacy.value * 0.3).toFixed(2)} + {' '}
                {(result.scores.noiseControl.value * 0.2).toFixed(2)} + {' '}
                {(result.scores.imageClarity.value * 0.2).toFixed(2)}
              </p>
              <p className="text-tech-400 font-bold mt-2 text-lg">
                = {result.scores.totalScore.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-orbitron text-xl text-tech-400 mb-4">四、实验参数</h2>
            <div className="bg-space-600/50 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['航迹偏移 X', `${result.params.flightPath.offsetX.toFixed(1)}`],
                    ['航迹偏移 Y', `${result.params.flightPath.offsetY.toFixed(1)}`],
                    ['航迹弯曲度', `${result.params.flightPath.curvature.toFixed(0)}`],
                    ['采样间隔', `${result.params.sampling.interval} ms`],
                    ['采样点数', `${result.params.sampling.count}`],
                    ['噪声水平', `${result.params.noise.level}%`],
                    ['噪声类型', result.params.noise.type === 'gaussian' ? '高斯噪声' : 
                                result.params.noise.type === 'speckle' ? '斑点噪声' : '脉冲噪声']
                  ].map(([label, value], idx) => (
                    <tr key={idx} className="border-b border-space-500/30 last:border-0">
                      <td className="py-3 px-4 text-space-300">{label}</td>
                      <td className="py-3 px-4 text-space-100 font-mono text-right">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mb-8">
              <h2 className="font-orbitron text-xl text-tech-400 mb-4">五、误差分析</h2>
              <div className="space-y-3">
                {result.errors.map((error, idx) => (
                  <div key={idx} className={`rounded-lg p-4 border ${
                    error.severity === 'high' ? 'bg-red-500/10 border-red-500/30' :
                    error.severity === 'medium' ? 'bg-orange-500/10 border-orange-500/30' :
                    'bg-yellow-500/10 border-yellow-500/30'
                  }`}>
                    <h3 className={`font-semibold mb-2 ${
                      error.severity === 'high' ? 'text-red-400' :
                      error.severity === 'medium' ? 'text-orange-400' :
                      'text-yellow-400'
                    }`}>
                      {idx + 1}. {error.type === 'insufficient_sampling' ? '采样不足' :
                        error.type === 'track_deviation' ? '航迹偏移' : '噪声过高'}
                      <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded bg-white/10">
                        {error.severity === 'high' ? '严重' : error.severity === 'medium' ? '中等' : '轻微'}
                      </span>
                    </h3>
                    <p className="text-sm text-space-200 mb-2">影响: {error.impact}</p>
                    <p className="text-sm text-space-300">建议: {error.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-tech-500/20 text-center text-xs text-space-500">
            <p>合成孔径雷达拼图游戏 - 教育版</p>
            <p>报告生成时间: {new Date().toLocaleString('zh-CN')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
