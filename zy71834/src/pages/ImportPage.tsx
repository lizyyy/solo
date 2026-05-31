import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { parseMaterialPack } from '@/utils/parser';
import { StatsCard } from '@/components/StatsCard';
import type { MaterialPack } from '@/types';
import {
  Upload, FileJson, FileText, Clock, Copy, Edit3,
  AlertTriangle, FolderOpen, Play, CheckCircle2, Database
} from 'lucide-react';

export const ImportPage = () => {
  const navigate = useNavigate();
  const { materialPacks, setCurrentMaterial, importMaterialPack } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [parsingStatus, setParsingStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [parsedStats, setParsedStats] = useState<{
    testRecords: number;
    unitEntries: number;
    terrainRules: number;
    anomalies: number;
    normalCount: number;
    lateCount: number;
    duplicateCount: number;
    manualCount: number;
  } | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
  }, []);

  const processFiles = async (files: File[]) => {
    const jsonFile = files.find(f => f.name.endsWith('.json'));
    if (!jsonFile) {
      setError('请上传JSON格式的材料包文件');
      setParsingStatus('error');
      return;
    }

    try {
      setParsingStatus('parsing');
      setError(null);

      const result = await parseMaterialPack(jsonFile);

      const sourceCounts = result.testRecords.reduce((acc, r) => {
        acc[r.sourceType] = (acc[r.sourceType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      setParsedStats({
        testRecords: result.testRecords.length,
        unitEntries: result.unitEntries.length,
        terrainRules: result.terrainRules.length,
        anomalies: result.anomalies.length,
        normalCount: sourceCounts.normal || 0,
        lateCount: sourceCounts.late_attachment || 0,
        duplicateCount: sourceCounts.duplicate || 0,
        manualCount: sourceCounts.manual_correction || 0,
      });

      const newPack: MaterialPack = {
        id: `pack-${Date.now()}`,
        name: jsonFile.name,
        importedAt: new Date(),
        rawData: {},
        stats: {
          totalRecords: result.testRecords.length,
          normalCount: sourceCounts.normal || 0,
          lateCount: sourceCounts.late_attachment || 0,
          duplicateCount: sourceCounts.duplicate || 0,
          manualCount: sourceCounts.manual_correction || 0,
          anomalyCount: result.anomalies.length,
        },
      };

      importMaterialPack(newPack, result);
      setParsingStatus('success');
    } catch (err) {
      setError(`解析失败: ${err instanceof Error ? err.message : '未知错误'}`);
      setParsingStatus('error');
    }
  };

  const loadDemoPack = (packId: string) => {
    setCurrentMaterial(packId);
    navigate('/timeline');
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary mb-1">材料导入</h1>
          <p className="text-sm text-text-secondary">上传测试材料包，系统将自动解析去重并检测异常</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          title="已导入材料包"
          value={materialPacks.length}
          icon={<Database size={20} />}
          colorClass="text-accent-military-light"
        />
        <StatsCard
          title="正常记录"
          value={materialPacks.reduce((s, p) => s + p.stats.normalCount, 0)}
          icon={<FileText size={20} />}
        />
        <StatsCard
          title="检测异常"
          value={materialPacks.reduce((s, p) => s + p.stats.anomalyCount, 0)}
          icon={<AlertTriangle size={20} />}
          colorClass="text-accent-warning-light"
        />
        <StatsCard
          title="人工更正"
          value={materialPacks.reduce((s, p) => s + p.stats.manualCount, 0)}
          icon={<Edit3 size={20} />}
          colorClass="text-green-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Upload size={16} />
            上传材料包
          </h2>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed p-8 text-center transition-all duration-200 ${
              isDragging
                ? 'border-accent-military bg-accent-military/10'
                : 'border-border-default bg-bg-secondary hover:border-text-muted'
            }`}
          >
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className={`w-16 h-16 mx-auto mb-4 flex items-center justify-center border ${
                parsingStatus === 'success' ? 'border-green-600 bg-green-900/20' :
                parsingStatus === 'error' ? 'border-red-600 bg-red-900/20' :
                'border-border-default bg-bg-tertiary'
              }`}>
                {parsingStatus === 'success' ? (
                  <CheckCircle2 size={32} className="text-green-500" />
                ) : parsingStatus === 'error' ? (
                  <AlertTriangle size={32} className="text-red-500" />
                ) : (
                  <FileJson size={32} className="text-text-muted" />
                )}
              </div>
              <div className="text-sm text-text-primary mb-2">
                {parsingStatus === 'parsing' ? '正在解析...' :
                 parsingStatus === 'success' ? '解析成功！' :
                 parsingStatus === 'error' ? '解析失败' :
                 '拖拽 JSON 文件到此处，或点击选择文件'}
              </div>
              <div className="text-xs text-text-muted">
                支持格式: .json · 最大 10MB
              </div>
            </label>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          {parsedStats && (
            <div className="mt-4 card">
              <div className="card-header">解析结果</div>
              <div className="card-body space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-bg-tertiary p-3 text-center">
                    <div className="text-2xl font-mono font-bold text-text-primary">{parsedStats.testRecords}</div>
                    <div className="text-xs text-text-muted">测试记录</div>
                  </div>
                  <div className="bg-bg-tertiary p-3 text-center">
                    <div className="text-2xl font-mono font-bold text-text-primary">{parsedStats.unitEntries}</div>
                    <div className="text-xs text-text-muted">单位条目</div>
                  </div>
                  <div className="bg-bg-tertiary p-3 text-center">
                    <div className="text-2xl font-mono font-bold text-text-primary">{parsedStats.terrainRules}</div>
                    <div className="text-xs text-text-muted">地形规则</div>
                  </div>
                  <div className="bg-bg-tertiary p-3 text-center">
                    <div className="text-2xl font-mono font-bold text-accent-warning-light">{parsedStats.anomalies}</div>
                    <div className="text-xs text-text-muted">检测异常</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-3 border-t border-border-default">
                  <span className="badge badge-normal gap-1">
                    <FileText size={12} /> 正常 {parsedStats.normalCount}
                  </span>
                  <span className="badge badge-late gap-1">
                    <Clock size={12} /> 晚到 {parsedStats.lateCount}
                  </span>
                  <span className="badge badge-duplicate gap-1">
                    <Copy size={12} /> 重复 {parsedStats.duplicateCount}
                  </span>
                  <span className="badge badge-manual gap-1">
                    <Edit3 size={12} /> 人工 {parsedStats.manualCount}
                  </span>
                </div>
                <button
                  onClick={() => navigate('/timeline')}
                  className="btn btn-primary w-full mt-4"
                >
                  <Play size={16} className="inline mr-2" />
                  查看时间线
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <FolderOpen size={16} />
            示例材料包
          </h2>
          <div className="space-y-3">
            {materialPacks.map((pack, idx) => (
              <div key={pack.id} className="card hover:border-text-muted transition-colors">
                <div className="card-body">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-medium text-text-primary mb-1">
                        {pack.name}
                      </h3>
                      <p className="text-xs text-text-muted font-mono">
                        {pack.id}
                      </p>
                    </div>
                    <span className="text-[10px] text-text-muted font-mono">
                      #{idx + 1}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    <div className="text-center">
                      <div className="text-lg font-mono font-bold text-text-primary">{pack.stats.totalRecords}</div>
                      <div className="text-[10px] text-text-muted">总数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-mono font-bold text-text-secondary">{pack.stats.normalCount}</div>
                      <div className="text-[10px] text-text-muted">正常</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-mono font-bold text-amber-400">{pack.stats.lateCount}</div>
                      <div className="text-[10px] text-text-muted">晚到</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-mono font-bold text-purple-400">{pack.stats.duplicateCount}</div>
                      <div className="text-[10px] text-text-muted">重复</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-mono font-bold text-accent-warning-light">{pack.stats.anomalyCount}</div>
                      <div className="text-[10px] text-text-muted">异常</div>
                    </div>
                  </div>
                  <button
                    onClick={() => loadDemoPack(pack.id)}
                    className="btn w-full text-sm"
                  >
                    <Play size={14} className="inline mr-2" />
                    加载此材料包
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-bg-tertiary border border-border-default">
            <h3 className="text-sm font-medium text-text-primary mb-3">材料包格式说明</h3>
            <div className="text-xs text-text-secondary space-y-2">
              <p>材料包应为 JSON 格式，包含以下字段：</p>
              <pre className="bg-bg-primary p-3 font-mono text-[11px] text-text-muted overflow-x-auto">
{`{
  "testRecords": [...],
  "unitEntries": [...],
  "terrainRules": [...]
}`}
              </pre>
              <p className="text-text-muted mt-2">
                系统会自动识别：正常记录、晚到附件（文件名含"late"或"晚到"）、
                重复项（内容哈希比对）、人工更正（含"manual"或"更正"）
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
