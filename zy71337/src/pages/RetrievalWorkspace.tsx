import React, { useState } from 'react';
import { Play, Search, RotateCcw, Music, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/store';
import PianoRoll from '@/components/PianoRoll';
import ScoreDisplay from '@/components/ScoreDisplay';
import { audioPlayer } from '@/utils/audioPlayer';
import { presetQueries } from '@/data/sampleData';
import { RetrievalResult } from '@/types';

const RetrievalWorkspace: React.FC = () => {
  const {
    queryNotes,
    setQueryNotes,
    params,
    setParams,
    results,
    performRetrieval,
    isRetrieving,
    clearResults,
    selectedResult,
    selectResult,
    expandedRowId,
    setExpandedRowId,
  } = useAppStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const handlePlayQuery = () => {
    if (isPlaying) {
      audioPlayer.stop();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      audioPlayer.playNotes(queryNotes, 120, () => setIsPlaying(false));
    }
  };

  const handlePlayResult = (result: RetrievalResult) => {
    audioPlayer.playNotes(result.targetSegment.notes);
  };

  const loadPreset = (presetKey: keyof typeof presetQueries, name: string) => {
    setQueryNotes(presetQueries[presetKey]);
    setActivePreset(name);
    clearResults();
  };

  const toggleRow = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h2 className="font-display text-xl font-bold text-white mb-1">检索工作台</h2>
        <p className="text-sm text-slate-400">输入旋律片段，在作品库中检索相似旋律</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200">查询旋律</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePlayQuery}
                  disabled={queryNotes.length === 0}
                  className={`p-2 rounded-lg transition-all ${
                    isPlaying
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Play className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setQueryNotes([])}
                  className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <PianoRoll
              notes={queryNotes}
              width={680}
              height={280}
              editable={true}
              onNotesChange={setQueryNotes}
            />

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">预设片段:</span>
              <button
                onClick={() => loadPreset('cMajorScale', 'C大调音阶')}
                className={`px-2 py-1 text-xs rounded transition-all ${
                  activePreset === 'C大调音阶'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                C大调音阶
              </button>
              <button
                onClick={() => loadPreset('brokenChord', '分解和弦')}
                className={`px-2 py-1 text-xs rounded transition-all ${
                  activePreset === '分解和弦'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                分解和弦
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-200">检索参数</h3>
              <button
                onClick={performRetrieval}
                disabled={queryNotes.length === 0 || isRetrieving}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium text-sm hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Search className="w-4 h-4" />
                {isRetrieving ? '检索中...' : '开始检索'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  轮廓匹配权重: {(params.contourWeight * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={params.contourWeight}
                  onChange={(e) =>
                    setParams({ contourWeight: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  节奏匹配权重: {(params.rhythmWeight * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={params.rhythmWeight}
                  onChange={(e) =>
                    setParams({ rhythmWeight: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  最低匹配分数: {(params.minMatchScore * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={params.minMatchScore}
                  onChange={(e) =>
                    setParams({ minMatchScore: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  返回结果数: {params.maxResults}
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={params.maxResults}
                  onChange={(e) =>
                    setParams({ maxResults: parseInt(e.target.value) })
                  }
                  className="w-full accent-amber-500"
                />
              </div>
            </div>
          </div>

          {results.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">
                    检索结果 ({results.length} 条)
                  </h3>
                  <button
                    onClick={clearResults}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    清除结果
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-700">
                {results.map((result, index) => (
                  <div key={result.id} className="animate-fade-in stagger-1">
                    <div
                      className={`p-4 cursor-pointer transition-all hover:bg-slate-700/30 ${
                        selectedResult?.id === result.id ? 'bg-amber-500/5' : ''
                      }`}
                      onClick={() => {
                        selectResult(result);
                        toggleRow(result.id);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            result.scores.overall >= 0.9
                              ? 'bg-rose-500/20 text-rose-400'
                              : result.scores.overall >= 0.75
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-slate-600 text-slate-400'
                          }`}
                        >
                          {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Music className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-200 truncate">
                              {result.targetWork.title}
                            </span>
                            {result.matched && (
                              <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                                匹配
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            学生: {result.targetWork.studentName} · 调号:{' '}
                            {result.targetWork.keySignature}
                          </div>
                        </div>

                        <div className="w-32">
                          <div className="text-right">
                            <span
                              className={`text-lg font-bold ${
                                result.scores.overall >= 0.9
                                  ? 'text-rose-400'
                                  : result.scores.overall >= 0.75
                                  ? 'text-amber-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {(result.scores.overall * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-1.5 mt-1 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                result.scores.overall >= 0.9
                                  ? 'bg-rose-500'
                                  : result.scores.overall >= 0.75
                                  ? 'bg-amber-500'
                                  : 'bg-slate-500'
                              }`}
                              style={{ width: `${result.scores.overall * 100}%` }}
                            />
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayResult(result);
                          }}
                          className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all"
                        >
                          <Play className="w-4 h-4" />
                        </button>

                        {expandedRowId === result.id ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {expandedRowId === result.id && (
                      <div className="px-4 pb-4 pt-0">
                        <div className="ml-12 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs text-slate-500 mb-2">匹配旋律</div>
                              <PianoRoll
                                notes={result.targetSegment.notes}
                                width={300}
                                height={120}
                                minPitch={55}
                                maxPitch={75}
                                showLabels={false}
                              />
                            </div>
                            <div>
                              <ScoreDisplay scores={result.scores} showDetails={true} />
                            </div>
                          </div>

                          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
                            <div className="text-xs text-slate-500 mb-2 flex items-center gap-2">
                              <Zap className="w-3 h-3" />
                              计算过程
                            </div>
                            <div className="text-xs text-slate-400 space-y-1">
                              <div>
                                <span className="text-slate-500">轮廓编码:</span>{' '}
                                {result.calculationDetails.contourEncoding.output}
                              </div>
                              <div>
                                <span className="text-slate-500">DTW距离:</span>{' '}
                                {result.calculationDetails.similarityCalc.contourDTW.distance.toFixed(2)}
                              </div>
                              <div>
                                <span className="text-slate-500">编辑距离:</span>{' '}
                                {result.calculationDetails.similarityCalc.rhythmEdit.distance}
                              </div>
                              <div>
                                <span className="text-slate-500">时间拉伸:</span>{' '}
                                {result.timeStretch.toFixed(2)}x
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 text-xs text-slate-500">
                            <span className="text-slate-400">作品备注:</span>{' '}
                            {result.targetWork.remarks}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-72 border-l border-slate-700 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">作品库</h3>
          <div className="space-y-2">
            {useAppStore.getState().works.map((work) => (
              <div
                key={work.id}
                className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-all"
              >
                <div className="font-medium text-slate-200 text-sm truncate">
                  {work.title}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {work.studentName} · {work.keySignature}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {work.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-400 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetrievalWorkspace;
