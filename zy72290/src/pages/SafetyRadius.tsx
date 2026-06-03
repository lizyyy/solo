import { Upload, CheckCircle2, AlertTriangle, RefreshCw, ChevronRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

const statusBadge = {
  normal: { label: '✓ 正常', className: 'bg-emerald-100 text-emerald-700' },
  pending_review: { label: '⚠ 待复核', className: 'bg-amber-100 text-amber-700' },
  supplemented: { label: '↻ 已补录', className: 'bg-sky-100 text-sky-700' },
};

export default function SafetyRadius() {
  const navigate = useNavigate();
  const {
    selectedRecordId,
    pointRecords,
    selectRecord,
    getSelectedRecord,
    importRadiusTable,
    isImporting,
    stepStatus,
    setStep,
  } = useAppStore();

  const selectedRecord = getSelectedRecord();

  useEffect(() => {
    if (selectedRecordId) {
      setStep(1);
    }
  }, [selectedRecordId, setStep]);

  const handleImport = async () => {
    await importRadiusTable();
  };

  const getMissingRowNumbers = (record: typeof selectedRecord) => {
    if (!record) return [];
    const existingRows = record.coordinates.map(c => c.rowIndex);
    const missing: number[] = [];
    for (let i = 1; i <= record.photoPointCount; i++) {
      if (!existingRows.includes(i)) {
        missing.push(i);
      }
    }
    return missing;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">安全半径表</h2>
        <p className="text-slate-500 mt-1">第一步：导入安全半径表并检测数据完整性</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <p className="text-sm text-slate-600">选择点位记录：</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {pointRecords.map((record) => (
            <button
              key={record.id}
              onClick={() => selectRecord(record.id)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                selectedRecordId === record.id
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
              )}
            >
              {record.pointCode}
              <span className="ml-2">
                {record.scenarioType === 'smooth' && <CheckCircle2 size={14} className="inline text-emerald-500" />}
                {record.scenarioType === 'missing_row' && <AlertTriangle size={14} className="inline text-amber-500" />}
                {record.scenarioType === 'old_calibration' && <RefreshCw size={14} className="inline text-sky-500" />}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selectedRecord ? (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">点位 {selectedRecord.pointCode}</h3>
                <p className="text-sm text-slate-500 mt-1">安全半径：{selectedRecord.safetyRadius}m</p>
              </div>
              <span className={cn('px-3 py-1 rounded-full text-sm font-medium', statusBadge[selectedRecord.status].className)}>
                {statusBadge[selectedRecord.status].label}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500">照片点位数</p>
                <p className="text-2xl font-bold text-slate-700 mt-1">{selectedRecord.photoPointCount}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500">坐标表行数</p>
                <p className="text-2xl font-bold text-slate-700 mt-1">{selectedRecord.coordinateRowCount}</p>
              </div>
              <div className={cn(
                'rounded-lg p-4',
                selectedRecord.photoPointCount === selectedRecord.coordinateRowCount ? 'bg-emerald-50' : 'bg-amber-50'
              )}>
                <p className="text-xs text-slate-500">数据完整性</p>
                <p className={cn(
                  'text-lg font-bold mt-1',
                  selectedRecord.photoPointCount === selectedRecord.coordinateRowCount ? 'text-emerald-600' : 'text-amber-600'
                )}>
                  {selectedRecord.photoPointCount === selectedRecord.coordinateRowCount ? '✓ 完整' : '⚠ 缺失 ' + getMissingRowNumbers(selectedRecord).join(', ') + ' 行'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500">创建时间</p>
                <p className="text-sm font-medium text-slate-700 mt-1">{selectedRecord.createdAt}</p>
              </div>
            </div>

            {selectedRecord.photoPointCount !== selectedRecord.coordinateRowCount && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-medium text-amber-800">照片有点位但坐标表缺一行</p>
                    <p className="text-sm text-amber-600 mt-1">检测到缺失第 {getMissingRowNumbers(selectedRecord).join('、')} 行数据。别急着归正常，已标记为待安全员复核。</p>
                  </div>
                </div>
              </div>
            )}

            {selectedRecord.photoPointCount === selectedRecord.coordinateRowCount && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-emerald-500 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-medium text-emerald-800">数据完整</p>
                    <p className="text-sm text-emerald-600 mt-1">照片点位与坐标表行数一致，数据完整无误。</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={isImporting || stepStatus.import === 'completed'}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors',
                stepStatus.import === 'completed'
                  ? 'bg-emerald-600 text-white cursor-default'
                  : 'bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50'
              )}
            >
              {isImporting ? (
                <><Loader2 className="animate-spin" size={18} /> 导入中...</>
              ) : stepStatus.import === 'completed' ? (
                <><CheckCircle2 size={18} /> 已导入</>
              ) : (
                <><Upload size={18} /> 模拟导入安全半径表</>
              )}
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-800">坐标数据表</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">序号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">X 坐标</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Y 坐标</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">安全半径 (m)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Array.from({ length: selectedRecord.photoPointCount }, (_, i) => i + 1).map((rowNum) => {
                    const coord = selectedRecord.coordinates.find(c => c.rowIndex === rowNum);
                    const isMissing = !coord;
                    return (
                      <tr key={rowNum} className={cn(
                        isMissing && 'bg-amber-50',
                        coord?.isSupplemented && 'bg-sky-50'
                      )}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          {rowNum}
                          {isMissing && <span className="ml-2 text-amber-600 text-xs">(缺失)</span>}
                          {coord?.isSupplemented && <span className="ml-2 text-sky-600 text-xs">(补录)</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {coord ? coord.x.toFixed(1) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {coord ? coord.y.toFixed(1) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {coord ? coord.radius.toFixed(1) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isMissing ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                              数据缺失
                            </span>
                          ) : coord.isSupplemented ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-sky-100 text-sky-700">
                              已补录
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                              正常
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => navigate('/origin-spec')}
              className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
            >
              下一步：补看坐标原点说明 <ChevronRight size={18} />
            </button>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Upload className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500">请先选择一条点位记录</p>
        </div>
      )}
    </div>
  );
}
