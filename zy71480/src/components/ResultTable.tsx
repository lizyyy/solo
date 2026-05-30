import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, AlertCircle, Volume2 } from 'lucide-react';
import { useStore } from '../store';
import { CalculationResult, ERROR_TYPE_LABELS, ERROR_TYPE_COLORS, ValidationErrorType } from '../types';

export function ResultTable() {
  const { results, selectedResultId, selectResult, splThreshold } = useStore();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<ValidationErrorType | 'all'>('all');
  const [sortField, setSortField] = useState<'x' | 'y' | 'totalSpl' | 'phaseCancelFactor'>('totalSpl');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const tableRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (selectedResultId && rowRefs.current.has(selectedResultId)) {
      const row = rowRefs.current.get(selectedResultId);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedResultId]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredResults = results.filter((result) => {
    if (filterType === 'all') return true;
    return result.errors.some((e) => e.type === filterType);
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    let diff = 0;
    switch (sortField) {
      case 'x':
        diff = a.x - b.x;
        break;
      case 'y':
        diff = a.y - b.y;
        break;
      case 'totalSpl':
        diff = a.totalSpl - b.totalSpl;
        break;
      case 'phaseCancelFactor':
        diff = a.phaseCancelFactor - b.phaseCancelFactor;
        break;
    }
    return sortOrder === 'asc' ? diff : -diff;
  });

  const getSplColor = (spl: number): string => {
    if (spl >= splThreshold) return 'text-accent-danger';
    if (spl >= splThreshold - 5) return 'text-accent-warning';
    return 'text-accent-success';
  };

  const getCancelFactorColor = (factor: number): string => {
    if (factor < 0.2) return 'text-accent-success';
    if (factor < 0.5) return 'text-accent-warning';
    return 'text-accent-danger';
  };

  const renderResultRow = (result: CalculationResult) => {
    const isExpanded = expandedRows.has(result.id);
    const isSelected = result.id === selectedResultId;
    const hasError = result.errors.length > 0;
    const hasCriticalError = result.errors.some((e) => e.severity === 'error');

    return (
      <div key={result.id}>
        <div
          ref={(el) => {
            if (el) rowRefs.current.set(result.id, el);
          }}
          className={`
            grid grid-cols-12 gap-2 px-3 py-2 text-xs cursor-pointer transition-colors border-b border-acoustic-700
            ${isSelected ? 'bg-accent-primary/20' : 'hover:bg-acoustic-700/50'}
            ${hasCriticalError ? 'bg-accent-danger/10' : ''}
          `}
          onClick={() => selectResult(isSelected ? null : result.id)}
        >
          <div className="col-span-1 flex items-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleRow(result.id);
              }}
              className="p-1 hover:bg-acoustic-600 rounded"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
          <div className="col-span-2 font-mono text-gray-300 flex items-center">
            ({result.x.toFixed(1)}, {result.y.toFixed(1)})
          </div>
          <div className={`col-span-2 font-mono font-medium flex items-center ${getSplColor(result.totalSpl)}`}>
            <Volume2 size={12} className="mr-1" />
            {result.totalSpl.toFixed(1)} dB
          </div>
          <div className="col-span-2 font-mono flex items-center text-gray-400">
            {result.totalIntensity.toExponential(4)}
          </div>
          <div className={`col-span-2 font-mono flex items-center ${getCancelFactorColor(result.phaseCancelFactor)}`}>
            {result.phaseCancelFactor.toFixed(3)}
          </div>
          <div className="col-span-2 font-mono flex items-center text-gray-400">
            {result.maxPhaseDiff.toFixed(0)}°
          </div>
          <div className="col-span-1 flex items-center gap-1">
            {hasError && (
              result.errors.map((err, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full ${ERROR_TYPE_COLORS[err.type]}`}
                  title={ERROR_TYPE_LABELS[err.type]}
                />
              ))
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="bg-acoustic-900 px-3 py-3 border-b border-acoustic-700">
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-accent-primary mb-2">声压叠加中间量</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-acoustic-700">
                      <th className="py-1 px-2 text-left">音箱</th>
                      <th className="py-1 px-2 text-right">距离 (m)</th>
                      <th className="py-1 px-2 text-right">声压级 (dB)</th>
                      <th className="py-1 px-2 text-right">声强 (W/m²)</th>
                      <th className="py-1 px-2 text-right">传播时间 (s)</th>
                      <th className="py-1 px-2 text-right">总时间 (s)</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {result.intermediates.map((im, idx) => (
                      <tr key={idx} className="border-b border-acoustic-800">
                        <td className="py-1 px-2 text-gray-300">{im.speakerName}</td>
                        <td className="py-1 px-2 text-right text-gray-400">{im.distance.toFixed(3)}</td>
                        <td className={`py-1 px-2 text-right ${getSplColor(im.spl)}`}>{im.spl.toFixed(2)}</td>
                        <td className="py-1 px-2 text-right text-gray-400">{im.intensity.toExponential(4)}</td>
                        <td className="py-1 px-2 text-right text-gray-400">{im.travelTime.toFixed(6)}</td>
                        <td className="py-1 px-2 text-right text-accent-primary">{im.totalTime.toFixed(6)}</td>
                      </tr>
                    ))}
                    <tr className="text-accent-success font-medium">
                      <td className="py-1 px-2">合计</td>
                      <td className="py-1 px-2 text-right">-</td>
                      <td className="py-1 px-2 text-right">{result.totalSpl.toFixed(2)}</td>
                      <td className="py-1 px-2 text-right">{result.totalIntensity.toExponential(4)}</td>
                      <td className="py-1 px-2 text-right">-</td>
                      <td className="py-1 px-2 text-right">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-xs font-semibold text-accent-primary mb-2">相位估算中间量</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-acoustic-700">
                      <th className="py-1 px-2 text-left">音箱对</th>
                      <th className="py-1 px-2 text-right">时间差 (s)</th>
                      <th className="py-1 px-2 text-right">相位差 (°)</th>
                      <th className="py-1 px-2 text-right">抵消系数</th>
                      <th className="py-1 px-2 text-left">说明</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {result.phaseIntermediates.map((pi, idx) => (
                      <tr key={idx} className="border-b border-acoustic-800">
                        <td className="py-1 px-2 text-gray-300">
                          {pi.speakerName1} ↔ {pi.speakerName2}
                        </td>
                        <td className="py-1 px-2 text-right text-gray-400">{pi.timeDiff.toFixed(6)}</td>
                        <td className={`py-1 px-2 text-right ${pi.phaseDiff >= 150 && pi.phaseDiff <= 210 ? 'text-accent-warning' : 'text-gray-400'}`}>
                          {pi.phaseDiff.toFixed(1)}
                        </td>
                        <td className={`py-1 px-2 text-right ${getCancelFactorColor(pi.cancelFactor)}`}>
                          {pi.cancelFactor.toFixed(4)}
                        </td>
                        <td className="py-1 px-2 text-xs text-gray-500">
                          {pi.cancelFactor < 0.2 ? '严重抵消' : pi.cancelFactor < 0.5 ? '部分抵消' : '轻微/无抵消'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-accent-danger mb-2">校验错误</h4>
                <div className="space-y-2">
                  {result.errors.map((err, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded border ${
                        err.severity === 'error'
                          ? 'bg-accent-danger/10 border-accent-danger/30'
                          : 'bg-accent-warning/10 border-accent-warning/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {err.severity === 'error' ? (
                          <AlertCircle size={14} className="text-accent-danger flex-shrink-0" />
                        ) : (
                          <AlertTriangle size={14} className="text-accent-warning flex-shrink-0" />
                        )}
                        <span className={`text-xs font-medium ${err.severity === 'error' ? 'text-accent-danger' : 'text-accent-warning'}`}>
                          {ERROR_TYPE_LABELS[err.type]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 pl-6">{err.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-acoustic-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-acoustic-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">计算明细</h2>
          <span className="text-sm text-gray-500">
            {filteredResults.length} / {results.length} 条记录
          </span>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs text-gray-400">筛选:</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              filterType === 'all'
                ? 'bg-accent-primary text-white'
                : 'bg-acoustic-700 text-gray-400 hover:bg-acoustic-600'
            }`}
          >
            全部 ({results.length})
          </button>
          {(['delay_direction', 'phase_missed', 'spl_overlimit'] as ValidationErrorType[]).map((type) => {
            const count = results.filter((r) => r.errors.some((e) => e.type === type)).length;
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                  filterType === type
                    ? 'bg-accent-primary text-white'
                    : 'bg-acoustic-700 text-gray-400 hover:bg-acoustic-600'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${ERROR_TYPE_COLORS[type]}`} />
                {ERROR_TYPE_LABELS[type]} ({count})
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-gray-500 border-b border-acoustic-700 bg-acoustic-900">
          <div className="col-span-1"></div>
          <div
            className="col-span-2 cursor-pointer hover:text-white flex items-center"
            onClick={() => handleSort('x')}
          >
            位置
            {sortField === 'x' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
          </div>
          <div
            className="col-span-2 cursor-pointer hover:text-white flex items-center"
            onClick={() => handleSort('totalSpl')}
          >
            声压级
            {sortField === 'totalSpl' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
          </div>
          <div className="col-span-2">总声强</div>
          <div
            className="col-span-2 cursor-pointer hover:text-white flex items-center"
            onClick={() => handleSort('phaseCancelFactor')}
          >
            抵消系数
            {sortField === 'phaseCancelFactor' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
          </div>
          <div className="col-span-2">最大相位差</div>
          <div className="col-span-1">状态</div>
        </div>
      </div>

      <div ref={tableRef} className="flex-1 overflow-y-auto">
        {results.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>暂无计算结果</p>
            <p className="text-sm mt-2">添加音箱后点击"开始计算"</p>
          </div>
        ) : sortedResults.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>没有符合筛选条件的记录</p>
          </div>
        ) : (
          sortedResults.map(renderResultRow)
        )}
      </div>
    </div>
  );
}
