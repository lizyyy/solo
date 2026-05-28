import { useEffect, useState } from 'react';
import { Play, Plus, FilePlus, ChevronRight, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ParameterForm } from '../components/ParameterForm';
import { DataValidation } from '../components/DataValidation';
import { usePrintStore } from '../store/usePrintStore';
import { validateAll } from '../utils/dataValidator';
import type { ValidationError } from '../types';

export const ParameterInput = () => {
  const navigate = useNavigate();
  const {
    currentBatch,
    createNewBatch,
    runAnalysis,
    fixValidationError,
    batches,
    setCurrentBatch,
  } = usePrintStore();

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  useEffect(() => {
    if (!currentBatch) {
      createNewBatch();
    }
  }, [currentBatch, createNewBatch]);

  useEffect(() => {
    if (currentBatch) {
      const errors = validateAll(currentBatch);
      setValidationErrors(errors);
    }
  }, [currentBatch]);

  const handleRunAnalysis = () => {
    runAnalysis();
    navigate('/analysis');
  };

  const handleFixError = (type: 'temp_diff_sign' | 'material_missing' | 'unit_mixed') => {
    fixValidationError(type);
  };

  if (!currentBatch) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">参数录入</h2>
          <p className="text-gray-400 mt-1">
            输入3D打印参数，进行翘曲热应力分析
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={createNewBatch}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建批次
          </button>
          <button
            onClick={handleRunAnalysis}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            运行分析
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {batches.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <FilePlus className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-gray-300">历史批次</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {batches.slice(0, 5).map((batch) => (
              <button
                key={batch.id}
                onClick={() => setCurrentBatch(batch)}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  currentBatch?.id === batch.id
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                    : 'bg-slate-700/50 text-gray-300 border-slate-600 hover:border-slate-500'
                }`}
              >
                {batch.id}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ParameterForm batch={currentBatch} />
        </div>
        <div className="space-y-4">
          <DataValidation errors={validationErrors} onFix={handleFixError} />

          {validationErrors.length > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-orange-400 font-medium">
                  数据问题说明
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                请先修复以上数据问题，以确保分析结果准确。
              </p>
            </div>
          )}

          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">当前批次信息</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">批次号</span>
                <span className="font-mono text-gray-300">{currentBatch.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">状态</span>
                <span
                  className={
                    currentBatch.status === 'draft'
                      ? 'text-gray-400'
                      : currentBatch.status === 'analyzed'
                        ? 'text-blue-400'
                        : 'text-green-400'
                  }
                >
                  {currentBatch.status === 'draft'
                    ? '草稿'
                    : currentBatch.status === 'analyzed'
                      ? '已分析'
                      : '已确认'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">创建人</span>
                <span className="text-gray-300">{currentBatch.createdBy}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParameterInput;
