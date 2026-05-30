
import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Eye, EyeOff, Database } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { MineCell, Mineral } from '../../types';
import { MINERALS, WAVELENGTHS, getMineralById } from '../../data/minerals';
import { calculateSpectrumSimilarity, getSimilarityConfidence } from '../../logic/spectrum';

interface SpectrumAnalyzerProps {
  selectedCell: MineCell | null;
}

export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({ selectedCell }) => {
  const { makeGuess } = useGameStore();
  const [showReference, setShowReference] = useState(true);
  const [selectedReference, setSelectedReference] = useState<string | null>(null);

  const chartData = useMemo(() => {
    if (!selectedCell || selectedCell.status === 'unknown' || !selectedCell.mineral) {
      return [];
    }

    return WAVELENGTHS.map((wavelength, index) => {
      const dataPoint: Record<string, number | string> = {
        wavelength,
        '目标光谱': Number((selectedCell.mineral?.spectrum[index] || 0).toFixed(3))
      };

      if (showReference) {
        MINERALS.forEach((mineral) => {
          dataPoint[mineral.nameCn] = Number(mineral.spectrum[index].toFixed(3));
        });
      }

      if (selectedReference) {
        const refMineral = getMineralById(selectedReference);
        if (refMineral) {
          dataPoint['参考光谱'] = Number(refMineral.spectrum[index].toFixed(3));
        }
      }

      return dataPoint;
    });
  }, [selectedCell, showReference, selectedReference]);

  const similarityResults = useMemo(() => {
    if (!selectedCell || !selectedCell.mineral) return [];

    return MINERALS.map((mineral) => {
      const similarity = calculateSpectrumSimilarity(
        selectedCell.mineral!.spectrum,
        mineral.spectrum
      );
      return {
        mineral,
        similarity,
        confidence: getSimilarityConfidence(similarity)
      };
    }).sort((a, b) => b.similarity - a.similarity);
  }, [selectedCell]);

  const handleMakeGuess = (mineralId: string) => {
    if (!selectedCell) return;
    makeGuess(selectedCell.id, mineralId);
  };

  if (!selectedCell) {
    return (
      <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4 shadow-xl h-full">
        <h3 className="text-slate-200 font-semibold mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
          光谱分析仪
        </h3>
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
          <Database className="w-12 h-12 mb-2 opacity-50" />
          <p>选择一个已扫描的矿区格子</p>
          <p className="text-sm">查看光谱数据进行分析</p>
        </div>
      </div>
    );
  }

  if (selectedCell.status === 'unknown') {
    return (
      <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4 shadow-xl h-full">
        <h3 className="text-slate-200 font-semibold mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
          光谱分析仪
        </h3>
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
          <EyeOff className="w-12 h-12 mb-2 opacity-50" />
          <p>该格子尚未扫描</p>
          <p className="text-sm">请先使用扫描仪进行探测</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-slate-200 font-semibold flex items-center gap-2">
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
          光谱分析仪 - 位置 ({selectedCell.x + 1}, {selectedCell.y + 1})
        </h3>
        <button
          onClick={() => setShowReference(!showReference)}
          className={`px-3 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
            showReference
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          {showReference ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          参考光谱
        </button>
      </div>

      {selectedCell.mineral && (
        <div className="text-xs text-slate-500 mb-2 flex items-center gap-2">
          <Database className="w-3 h-3" />
          数据来源: {selectedCell.mineral.source} | 版本: {selectedCell.mineral.version}
        </div>
      )}

      <div className="h-48 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="wavelength" stroke="#64748b" fontSize={10} label={{ value: '波长 (nm)', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }} />
            <YAxis stroke="#64748b" fontSize={10} domain={[0, 1]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px' }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }} />
            <Line type="monotone" dataKey="目标光谱" stroke="#00d4ff" strokeWidth={2} dot={false} />
            {selectedReference && (
              <Line type="monotone" dataKey="参考光谱" stroke="#ff6b35" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        <h4 className="text-slate-300 text-sm font-medium">矿石类型识别</h4>
        <div className="grid grid-cols-2 gap-2">
          {similarityResults.slice(0, 4).map(({ mineral, similarity, confidence }) => (
            <button
              key={mineral.id}
              onClick={() => handleMakeGuess(mineral.id)}
              disabled={selectedCell.playerGuess !== null}
              className={`p-2 rounded-lg border text-left transition-all ${
                selectedCell.playerGuess === mineral.id
                  ? selectedCell.isCorrect
                    ? 'border-green-500 bg-green-900/30'
                    : 'border-red-500 bg-red-900/30'
                  : 'border-slate-600 bg-slate-700/50 hover:border-cyan-500 hover:bg-slate-700'
              } ${selectedCell.playerGuess !== null ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: mineral.color }}
                />
                <span className="text-slate-200 text-sm font-medium">{mineral.nameCn}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-slate-400">
                  相似度: {(similarity * 100).toFixed(1)}%
                </span>
                <span className={`text-xs ${
                  confidence === '极高' ? 'text-green-400' :
                  confidence === '高' ? 'text-cyan-400' :
                  confidence === '中等' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {confidence}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                价值: {mineral.value}/单位
              </div>
            </button>
          ))}
        </div>

        {selectedCell.playerGuess && (
          <div className={`p-3 rounded-lg text-sm ${
            selectedCell.isCorrect
              ? 'bg-green-900/30 border border-green-700 text-green-300'
              : 'bg-red-900/30 border border-red-700 text-red-300'
          }`}>
            {selectedCell.isCorrect ? (
              <span>✓ 识别正确！可以进行开采</span>
            ) : (
              <span>✗ 识别错误！该次开采收益将减半</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
