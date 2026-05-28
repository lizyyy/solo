import React, { useCallback, useRef } from 'react';
import { Upload, Play, RotateCcw, Eye, Box, Grid3X3, Thermometer } from 'lucide-react';
import type { EstimationParams, PrintParams, MeshData } from '@/types';
import { SimplificationAlgorithm } from '@/types';
import { parseMeshFile, validateMeshFile } from '@/utils/meshParser';

interface EstimationWorkspaceProps {
  currentMesh: MeshData | null;
  params: EstimationParams;
  printParams: PrintParams;
  isCalculating: boolean;
  progress: number;
  onMeshLoad: (mesh: MeshData) => void;
  onParamsChange: (params: Partial<EstimationParams>) => void;
  onPrintParamsChange: (params: Partial<PrintParams>) => void;
  onRun: () => void;
  onClear: () => void;
}

const algorithmOptions = [
  { value: SimplificationAlgorithm.QUADRIC_EDGE_COLLAPSE, label: '二次误差边折叠', desc: '精度最高，适合复杂模型' },
  { value: SimplificationAlgorithm.CLUSTERING, label: '聚类简化', desc: '速度快，适合大模型' },
  { value: SimplificationAlgorithm.VERTEX_CLUSTERING, label: '顶点聚类', desc: '保持拓扑，适合打印' },
  { value: SimplificationAlgorithm.MESHDECIMATOR, label: '网格抽取', desc: '均衡方案' }
];

export const EstimationWorkspace: React.FC<EstimationWorkspaceProps> = ({
  currentMesh,
  params,
  printParams,
  isCalculating,
  progress,
  onMeshLoad,
  onParamsChange,
  onPrintParamsChange,
  onRun,
  onClear
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      validateMeshFile(file);
      const mesh = await parseMeshFile(file);
      onMeshLoad(mesh);
    } catch (error) {
      alert(error instanceof Error ? error.message : '文件解析失败');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onMeshLoad]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (!file) return;

    try {
      validateMeshFile(file);
      const mesh = await parseMeshFile(file);
      onMeshLoad(mesh);
    } catch (error) {
      alert(error instanceof Error ? error.message : '文件解析失败');
    }
  }, [onMeshLoad]);

  const faceReductionPercent = currentMesh
    ? Math.round((1 - params.targetFaceCount / currentMesh.faceCount) * 100)
    : 50;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">估计工作台</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            disabled={!currentMesh || isCalculating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" />
            重置
          </button>
        </div>
      </div>

      {!currentMesh ? (
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".stl,.obj"
            onChange={handleFileChange}
            className="hidden"
          />
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-1">上传3D模型</p>
          <p className="text-sm text-gray-500 mb-2">拖拽文件到此处，或点击选择</p>
          <p className="text-xs text-gray-400">支持 STL、OBJ 格式，最大 50MB</p>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <Box className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-800">{currentMesh.name}</h4>
                <p className="text-sm text-gray-500">
                  {currentMesh.vertexCount.toLocaleString()} 顶点 · {currentMesh.faceCount.toLocaleString()} 面
                </p>
              </div>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              更换模型
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".stl,.obj"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-gray-700">
            <Grid3X3 className="w-5 h-5" />
            <h4 className="font-medium">简化参数</h4>
          </div>

          <div className="space-y-4 bg-gray-50 rounded-xl p-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">简化算法</label>
              <div className="grid grid-cols-2 gap-2">
                {algorithmOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onParamsChange({ algorithm: opt.value })}
                    disabled={isCalculating}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      params.algorithm === opt.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-800">{opt.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">目标面数</label>
                <span className="text-sm font-mono text-blue-600">
                  {params.targetFaceCount.toLocaleString()}
                  <span className="text-gray-400 mx-1">·</span>
                  <span className={faceReductionPercent > 80 ? 'text-red-500' : faceReductionPercent > 50 ? 'text-amber-500' : 'text-green-500'}>
                    -{faceReductionPercent}%
                  </span>
                </span>
              </div>
              <input
                type="range"
                min={currentMesh ? Math.max(100, Math.floor(currentMesh.faceCount * 0.01)) : 100}
                max={currentMesh ? currentMesh.faceCount : 100000}
                step={currentMesh ? Math.max(1, Math.floor(currentMesh.faceCount * 0.01)) : 100}
                value={params.targetFaceCount}
                onChange={(e) => onParamsChange({ targetFaceCount: parseInt(e.target.value) })}
                disabled={!currentMesh || isCalculating}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{currentMesh ? Math.max(100, Math.floor(currentMesh.faceCount * 0.01)).toLocaleString() : '100'}</span>
                <span>{currentMesh ? currentMesh.faceCount.toLocaleString() : '100,000'}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">误差阈值 (mm)</label>
                <span className="text-sm font-mono text-blue-600">{params.errorThreshold.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="2"
                step="0.01"
                value={params.errorThreshold}
                onChange={(e) => onParamsChange({ errorThreshold: parseFloat(e.target.value) })}
                disabled={isCalculating}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0.01 (高精度)</span>
                <span>2.0 (快速)</span>
              </div>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={params.preserveBorders}
                  onChange={(e) => onParamsChange({ preserveBorders: e.target.checked })}
                  disabled={isCalculating}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">保留边界</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={params.preserveNormals}
                  onChange={(e) => onParamsChange({ preserveNormals: e.target.checked })}
                  disabled={isCalculating}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">保持法线</span>
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-gray-700">
            <Thermometer className="w-5 h-5" />
            <h4 className="font-medium">打印参数</h4>
          </div>

          <div className="space-y-4 bg-gray-50 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">层厚 (mm)</label>
                <select
                  value={printParams.layerHeight}
                  onChange={(e) => onPrintParamsChange({ layerHeight: parseFloat(e.target.value) })}
                  disabled={isCalculating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="0.1">0.1 (超高精度)</option>
                  <option value="0.15">0.15 (高精度)</option>
                  <option value="0.2">0.2 (标准)</option>
                  <option value="0.25">0.25 (快速)</option>
                  <option value="0.3">0.3 (超快速)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">填充率 (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={printParams.infillRate}
                  onChange={(e) => onPrintParamsChange({ infillRate: parseInt(e.target.value) || 0 })}
                  disabled={isCalculating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">打印速度 (mm/s)</label>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={printParams.printSpeed}
                  onChange={(e) => onPrintParamsChange({ printSpeed: parseInt(e.target.value) || 50 })}
                  disabled={isCalculating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">壁厚 (mm)</label>
                <input
                  type="number"
                  min="0.4"
                  max="5"
                  step="0.1"
                  value={printParams.wallThickness}
                  onChange={(e) => onPrintParamsChange({ wallThickness: parseFloat(e.target.value) || 1.2 })}
                  disabled={isCalculating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">喷嘴直径 (mm)</label>
                <select
                  value={printParams.nozzleDiameter}
                  onChange={(e) => onPrintParamsChange({ nozzleDiameter: parseFloat(e.target.value) })}
                  disabled={isCalculating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="0.2">0.2 (精细)</option>
                  <option value="0.3">0.3</option>
                  <option value="0.4">0.4 (标准)</option>
                  <option value="0.6">0.6 (大流量)</option>
                  <option value="0.8">0.8 (快速)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onRun}
        disabled={!currentMesh || isCalculating}
        className={`w-full py-4 rounded-xl font-medium text-lg flex items-center justify-center gap-3 transition-all ${
          !currentMesh || isCalculating
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
        }`}
      >
        {isCalculating ? (
          <>
            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            计算中 {Math.round(progress)}%
          </>
        ) : (
          <>
            <Play className="w-6 h-6" />
            开始误差估计
          </>
        )}
      </button>

      {isCalculating && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};
