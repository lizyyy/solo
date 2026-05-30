import React, { useState, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useBatchStore } from '@/store/batchStore';
import { parseMaterial, parseFileContent } from '@/utils/parser/fileParser';
import { createMaterial, compareVersions, generateDiffSummary, generateFileHash } from '@/utils/version/versionCompare';
import { validateAll } from '@/utils/validation/dataValidator';
import { Material, MaterialType, MATERIAL_TYPE_LABELS, MATERIAL_TYPE_COLORS, Batch, MaterialUploadState } from '@/types';
import { Upload, FileText, CheckCircle, AlertCircle, Trash2, Eye, RefreshCw, Clock, User, FileSpreadsheet, Hash } from 'lucide-react';

const ImportCenter: React.FC = () => {
  const { 
    currentBatch, 
    materials, 
    addMaterial, 
    setHoldings, 
    setTargetWeights, 
    setPriceQuotes,
    setCurrentBatch,
    setValidationErrors,
  } = useBatchStore();

  const [uploadState, setUploadState] = useState<MaterialUploadState>({
    holding: { file: null, material: null, parsing: false, error: null },
    target: { file: null, material: null, parsing: false, error: null },
    price: { file: null, material: null, parsing: false, error: null },
  });

  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
  const [sourceName, setSourceName] = useState<string>('');
  const [uploadedBy, setUploadedBy] = useState<string>('投顾张三');
  const [showVersionInfo, setShowVersionInfo] = useState<MaterialType | null>(null);

  const getNextVersion = (type: MaterialType): number => {
    const typeMaterials = materials.filter(m => m.type === type);
    if (typeMaterials.length === 0) return 1;
    return Math.max(...typeMaterials.map(m => m.version)) + 1;
  };

  const ensureBatch = (): Batch => {
    if (currentBatch) return currentBatch;
    const newBatch: Batch = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `再平衡任务-${new Date().toLocaleDateString('zh-CN')}`,
      clientId: 'CLIENT-001',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: uploadedBy,
      currentVersion: 1,
    };
    setCurrentBatch(newBatch);
    return newBatch;
  };

  const handleFileSelect = useCallback(async (type: MaterialType, file: File) => {
    setUploadState(prev => ({
      ...prev,
      [type]: { ...prev[type], file, parsing: true, error: null },
    }));

    try {
      const batch = ensureBatch();
      const content = await parseFileContent(file);
      const nextVersion = getNextVersion(type);
      const materialId = `mat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newMaterial = createMaterial(
        batch.id,
        type,
        content,
        file.name,
        sourceName || '未知来源',
        uploadedBy,
        nextVersion
      );
      newMaterial.id = materialId;

      const sameTypeMaterials = materials.filter(m => m.type === type);
      const isDuplicate = sameTypeMaterials.some(m => m.fileHash === newMaterial.fileHash);
      newMaterial.isDuplicate = isDuplicate;

      if (!isDuplicate && sameTypeMaterials.length > 0) {
        const latestMaterial = sameTypeMaterials.reduce((latest, m) => 
          m.version > latest.version ? m : latest
        );
        const diffResult = compareVersions([latestMaterial], [newMaterial]);
        newMaterial.diffFromPrevious = diffResult;
      }

      const parseResult = await parseMaterial(file, type, materialId);
      
      if (!parseResult.success) {
        throw new Error(parseResult.errors.join('；'));
      }

      setUploadState(prev => ({
        ...prev,
        [type]: { ...prev[type], material: newMaterial, parsing: false },
      }));

    } catch (error: any) {
      setUploadState(prev => ({
        ...prev,
        [type]: { ...prev[type], parsing: false, error: error.message || '解析失败' },
      }));
    }
  }, [currentBatch, materials, sourceName, uploadedBy]);

  const handleDrop = useCallback((type: MaterialType, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(type, files[0]);
    }
  }, [handleFileSelect]);

  const handleInputChange = useCallback((type: MaterialType, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(type, files[0]);
    }
  }, [handleFileSelect]);

  const confirmUpload = async (type: MaterialType) => {
    const state = uploadState[type];
    if (!state.material) return;

    addMaterial(state.material);

    const parseResult = await parseMaterial(
      new File([state.material.rawContent], state.material.fileName),
      type,
      state.material.id
    );

    if (parseResult.success) {
      switch (type) {
        case 'holding':
          setHoldings(parseResult.data as any[]);
          break;
        case 'target':
          setTargetWeights(parseResult.data as any[]);
          break;
        case 'price':
          setPriceQuotes(parseResult.data as any[]);
          break;
      }
    }

    const batch = ensureBatch();
    const allMaterials = [...materials.filter(m => m.type !== type), state.material];
    const currentState = useBatchStore.getState();
    
    const getMaterialId = (matType: 'holding' | 'target' | 'price') => {
      const m = allMaterials.find(mat => mat.type === matType);
      return m?.id || 'unknown';
    };

    const materialIds = {
      holding: getMaterialId('holding'),
      target: getMaterialId('target'),
      price: getMaterialId('price'),
    };

    const errors = validateAll(
      type === 'holding' ? parseResult.data as any[] : currentState.holdings,
      type === 'target' ? parseResult.data as any[] : currentState.targetWeights,
      type === 'price' ? parseResult.data as any[] : currentState.priceQuotes,
      currentState.config,
      materialIds
    );
    setValidationErrors(errors);

    setUploadState(prev => ({
      ...prev,
      [type]: { file: null, material: null, parsing: false, error: null },
    }));
  };

  const removeUpload = (type: MaterialType) => {
    setUploadState(prev => ({
      ...prev,
      [type]: { file: null, material: null, parsing: false, error: null },
    }));
  };

  const renderUploadZone = (type: MaterialType) => {
    const state = uploadState[type];
    const existingMaterials = materials.filter(m => m.type === type);
    const latestMaterial = existingMaterials.length > 0 
      ? existingMaterials.reduce((latest, m) => m.version > latest.version ? m : latest)
      : null;

    return (
      <Card key={type} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${MATERIAL_TYPE_COLORS[type]}`} />
            <span className="font-medium text-white">{MATERIAL_TYPE_LABELS[type]}</span>
            {latestMaterial && (
              <Badge variant="secondary" size="sm">
                v{latestMaterial.version}
              </Badge>
            )}
          </div>
          {latestMaterial && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowVersionInfo(showVersionInfo === type ? null : type)}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              版本历史
            </Button>
          )}
        </div>

        {showVersionInfo === type && existingMaterials.length > 0 && (
          <div className="mb-4 p-3 bg-slate-800/50 rounded-md text-xs">
            <div className="font-medium text-slate-300 mb-2">版本历史</div>
            {existingMaterials.sort((a, b) => b.version - a.version).map((m) => (
              <div key={m.id} className="flex items-center justify-between py-1 border-b border-slate-700/50 last:border-0">
                <div className="flex items-center gap-2">
                  <Hash className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-400">v{m.version}</span>
                  <span className="text-slate-500">{m.fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{m.uploadedBy}</span>
                  <span className="text-slate-600">{new Date(m.uploadedAt).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {latestMaterial && !state.material && (
          <div className="mb-4 p-3 bg-slate-800/30 rounded-md">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <FileSpreadsheet className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <div className="text-sm text-white">{latestMaterial.fileName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    来源：{latestMaterial.source} · 上传：{latestMaterial.uploadedBy} · {new Date(latestMaterial.uploadedAt).toLocaleString('zh-CN')}
                  </div>
                  {latestMaterial.diffFromPrevious && latestMaterial.diffFromPrevious.changes.length > 0 && (
                    <div className="text-xs text-amber-400 mt-1">
                      {generateDiffSummary(latestMaterial.diffFromPrevious.changes)}
                    </div>
                  )}
                  {latestMaterial.isDuplicate && (
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      与上一版本内容完全相同，标记为重复提交
                    </div>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPreviewMaterial(latestMaterial)}>
                <Eye className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {!state.material && !state.parsing && !state.error && (
          <div
            className={`border-2 border-dashed rounded-md p-6 text-center transition-colors cursor-pointer hover:bg-slate-800/30 ${
              state.file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700'
            }`}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => handleDrop(type, e)}
            onClick={() => document.getElementById(`file-input-${type}`)?.click()}
          >
            <Upload className="w-6 h-6 mx-auto mb-2 text-slate-500" />
            <div className="text-sm text-slate-400 mb-1">拖拽文件到此处或点击选择</div>
            <div className="text-xs text-slate-600">支持 CSV、Excel (.xlsx, .xls) 格式</div>
            <input
              id={`file-input-${type}`}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleInputChange(type, e)}
            />
          </div>
        )}

        {state.parsing && (
          <div className="border border-slate-700 rounded-md p-6 text-center">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 text-slate-500 animate-spin" />
            <div className="text-sm text-slate-400">正在解析文件...</div>
          </div>
        )}

        {state.error && (
          <div className="border border-red-500/30 bg-red-500/5 rounded-md p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-red-400">解析失败</div>
                <div className="text-xs text-slate-400 mt-1">{state.error}</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => removeUpload(type)}>
              重新选择
            </Button>
          </div>
        )}

        {state.material && !state.parsing && !state.error && (
          <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-md p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-emerald-400">解析成功</div>
                  <div className="text-xs text-slate-400 mt-1">{state.material.fileName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    文件指纹：{state.material.fileHash.slice(0, 16)}...
                  </div>
                  {state.material.isDuplicate && (
                    <div className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      检测到重复提交，内容与现有版本完全相同
                    </div>
                  )}
                  {state.material.diffFromPrevious && state.material.diffFromPrevious.changes.length > 0 && (
                    <div className="text-xs text-blue-400 mt-1">
                      {generateDiffSummary(state.material.diffFromPrevious.changes)}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setPreviewMaterial(state.material!)}>
                  <Eye className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removeUpload(type)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button variant="primary" size="sm" onClick={() => confirmUpload(type)}>
                确认导入
              </Button>
              <Button variant="ghost" size="sm" onClick={() => removeUpload(type)}>
                取消
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">数据导入中心</h1>
            <p className="mt-1 text-sm text-slate-400">
              分别导入持仓表、目标权重、买卖报价三类材料，支持不同来源和版本管理
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={uploadedBy}
                onChange={(e) => setUploadedBy(e.target.value)}
                placeholder="上传人"
                className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600 w-28"
              />
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="材料来源（如：张三/客户邮件/系统导出）"
                className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600 w-48"
              />
            </div>
          </div>
        </div>

        <Card className="p-4 bg-slate-800/30">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
            <div className="text-sm text-slate-400">
              <div className="font-medium text-slate-300 mb-1">导入说明</div>
              <ul className="space-y-1 list-disc list-inside">
                <li>三类材料可分别导入，来自不同人员时请分别填写来源</li>
                <li>重复提交的材料将自动检测并标记，不会覆盖已有数据</li>
                <li>补传材料时系统会自动对比版本差异，记录变更内容</li>
                <li>所有原始材料完整留存，支持随时查看和导出</li>
              </ul>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {(['holding', 'target', 'price'] as const).map(type => renderUploadZone(type))}
        </div>

        {previewMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <div>
                  <h3 className="font-medium text-white">原始材料预览</h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {previewMaterial.fileName} · 版本 {previewMaterial.version} · {MATERIAL_TYPE_LABELS[previewMaterial.type]}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPreviewMaterial(null)}>
                  关闭
                </Button>
              </div>
              <div className="p-4 overflow-auto max-h-[60vh]">
                <div className="mb-3 text-xs text-slate-500 space-y-0.5">
                  <div>来源：{previewMaterial.source}</div>
                  <div>上传人：{previewMaterial.uploadedBy}</div>
                  <div>上传时间：{new Date(previewMaterial.uploadedAt).toLocaleString('zh-CN')}</div>
                  <div>文件指纹：{previewMaterial.fileHash}</div>
                </div>
                <div className="bg-slate-900 rounded-md p-4 font-mono text-xs text-slate-400 overflow-x-auto">
                  <pre>{previewMaterial.rawContent.slice(0, 5000)}</pre>
                  {previewMaterial.rawContent.length > 5000 && (
                    <div className="mt-2 text-slate-600">... 仅显示前5000字符，完整内容可导出查看</div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ImportCenter;
