import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { autoMapFields, updateMappingField, createNewMapping } from '@/engine/fieldMapper';
import { TARGET_FIELDS, FIELD_SYNONYMS } from '@/types';
import type { TargetField, FieldMapping } from '@/types';
import { Upload, FileText, Link2, Save, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const TARGET_FIELD_LABELS: Record<TargetField, string> = {
  id: '记录ID',
  title: '标题',
  value: '数值',
  unit: '单位',
  category: '类别',
  description: '描述',
  constraint_min: '约束最小值',
  constraint_max: '约束最大值',
  coefficient: '系数',
  base_value: '基准值',
};

export default function ImportPage() {
  const answers = useAppStore(s => s.answers);
  const mappings = useAppStore(s => s.mappings);
  const addMapping = useAppStore(s => s.addMapping);
  const addAnswers = useAppStore(s => s.addAnswers);

  const [step, setStep] = useState<'upload' | 'mapping' | 'done'>('upload');
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [rawFields, setRawFields] = useState<string[]>([]);
  const [previewSourceName, setPreviewSourceName] = useState('');
  const [activeMappingId, setActiveMappingId] = useState<string | null>(null);
  const [manualMappings, setManualMappings] = useState<Record<string, TargetField | null>>({});
  const [isModified, setIsModified] = useState(false);

  useEffect(() => {
    if (rawFields.length > 0 && Object.keys(manualMappings).length === 0) {
      setManualMappings(autoMapFields(rawFields));
    }
  }, [rawFields, manualMappings]);

  const handleLoadSample = () => {
    const sample = [
      { '编号': 'Q201', '题目': '三角形面积', '数值': 24, '单位': '', '类别': '几何', '描述': '底8高6', '约束最小值': 0, '约束最大值': 200, '系数': 1.0, '基准值': 10 },
      { '编号': 'Q202', '题目': '功率计算', '数值': 60, '单位': '瓦特', '类别': '物理', '描述': '电压12V电流5A', '约束最小值': 0, '约束最大值': 1000, '系数': 1.1, '基准值': 50 },
    ];
    setRawData(sample);
    setRawFields(Object.keys(sample[0]));
    setPreviewSourceName('样例数据第三组');
    setManualMappings(autoMapFields(Object.keys(sample[0])));
    setIsModified(false);
    setStep('mapping');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length === 0) return;

      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const values = line.split(',');
        const row: Record<string, any> = {};
        headers.forEach((h, i) => {
          const val = values[i]?.trim() || '';
          const num = Number(val);
          row[h] = val !== '' && !isNaN(num) ? num : val;
        });
        return row;
      });

      setRawData(rows);
      setRawFields(headers);
      setPreviewSourceName(file.name);
      setManualMappings(autoMapFields(headers));
      setIsModified(false);
      setStep('mapping');
    };
    reader.readAsText(file);
  };

  const activeMapping = useMemo<FieldMapping | null>(() => {
    if (activeMappingId) {
      return mappings.find(m => m.id === activeMappingId) || null;
    }
    return null;
  }, [activeMappingId, mappings]);

  const currentMappings: Record<string, TargetField | null> = manualMappings;

  const handleFieldChange = (rawField: string, target: TargetField | null) => {
    setManualMappings(prev => ({
      ...prev,
      [rawField]: target,
    }));
    setIsModified(true);

    if (activeMapping) {
      const updated = updateMappingField(activeMapping, rawField, target);
      const newMappings = mappings.map(m => m.id === updated.id ? updated : m);
      useAppStore.setState({ mappings: newMappings });
    }
  };

  const handleSaveMapping = () => {
    const newMapping = createNewMapping(`映射方案_${Date.now()}`, manualMappings);
    addMapping(newMapping);
    setActiveMappingId(newMapping.id);
    setIsModified(false);
  };

  const handleConfirmImport = () => {
    const finalMappings: Record<string, string> = {};
    for (const [rawField, target] of Object.entries(manualMappings)) {
      if (target) {
        finalMappings[rawField] = target;
      }
    }

    const mapping: FieldMapping = {
      id: `mapping_${Date.now()}`,
      name: `${previewSourceName}_映射`,
      mappings: finalMappings,
      createdAt: new Date().toISOString(),
    };
    addMapping(mapping);

    const newAnswers = rawData.map((row, index) => ({
      id: `ans_imported_${Date.now()}_${index}`,
      source: previewSourceName,
      sourceBatch: `batch_${Date.now()}`,
      rawData: { ...row },
      importedAt: new Date().toISOString(),
      fieldMappingId: mapping.id,
    }));

    addAnswers(newAnswers);

    const runCalculation = useAppStore.getState().runCalculation;
    setTimeout(() => {
      runCalculation('导入数据复算');
    }, 100);

    setStep('done');
  };

  const mappedCount = Object.values(currentMappings).filter(Boolean).length;
  const unmappedFields = rawFields.filter(f => !currentMappings[f]);

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-ink-200 px-8 py-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-md bg-ink-100 flex items-center justify-center">
            <Upload className="w-4 h-4 text-ink-600" />
          </div>
          <h1 className="font-serif text-xl font-bold text-ink-900">历史答案导入</h1>
        </div>
        <p className="text-sm text-ink-400">
          字段名不一致也能映射 · 来源与处理状态全程保留
        </p>
      </header>

      <div className="p-8 max-w-[1200px]">
        <div className="flex items-center gap-2 mb-6">
          <StepBadge num={1} label="上传数据" active={step === 'upload'} done={step !== 'upload'} />
          <div className="flex-1 h-px bg-ink-200" />
          <StepBadge num={2} label="字段映射" active={step === 'mapping'} done={step === 'done'} />
          <div className="flex-1 h-px bg-ink-200" />
          <StepBadge num={3} label="完成" active={step === 'done'} done={false} />
        </div>

        {step === 'upload' && (
          <div className="card p-8">
            <div className="border-2 border-dashed border-ink-200 rounded-lg p-12 text-center hover:border-ink-300 transition-colors">
              <Upload className="w-10 h-10 mx-auto mb-3 text-ink-300" />
              <p className="text-sm text-ink-500 mb-1">拖拽 CSV 文件到此处，或点击选择</p>
              <p className="text-xs text-ink-400 mb-4">支持 CSV 格式，首行为字段名</p>
              <label className="btn-primary cursor-pointer">
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                选择文件
              </label>
              <div className="mt-6 pt-6 border-t border-ink-100">
                <p className="text-xs text-ink-400 mb-2">或加载内置样例（含字段名不一致的真实场景）</p>
                <button onClick={handleLoadSample} className="btn-secondary">
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  加载样例数据
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-ink-400" />
                <div>
                  <div className="text-sm font-medium text-ink-800">{previewSourceName}</div>
                  <div className="text-xs text-ink-400">{rawData.length} 条记录 · {rawFields.length} 个字段</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-400">
                  已映射 <span className="font-semibold text-ink-700">{mappedCount}</span>/{rawFields.length}
                </span>
                <button onClick={handleSaveMapping} className="btn-secondary text-xs">
                  <Save className="w-3.5 h-3.5 mr-1" />
                  保存映射方案
                </button>
              </div>
            </div>

            {unmappedFields.length > 0 && (
              <div className="card p-3 bg-amber-50 border-amber-200">
                <div className="flex items-center gap-2 text-xs text-amber-700">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">以下字段未自动识别，建议手动映射：</span>
                  <span className="font-mono">{unmappedFields.join('、')}</span>
                </div>
              </div>
            )}

            <div className="card overflow-hidden">
              <div className="px-4 py-3 bg-ink-50 border-b border-ink-100 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-ink-400" />
                <span className="text-sm font-medium text-ink-700">字段映射</span>
                <span className="text-xs text-ink-400">· 原始字段 → 标准字段</span>
              </div>
              <div className="divide-y divide-ink-100">
                {rawFields.map(field => {
                  const mapped = currentMappings[field];
                  const isRecognized = !!mapped;
                  return (
                    <div key={field} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-40 flex-shrink-0">
                        <div className="text-xs font-mono font-medium text-ink-700">{field}</div>
                        <div className="text-[11px] text-ink-400">
                          {isRecognized ? '已识别' : '未识别'}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-ink-300 flex-shrink-0" />
                      <select
                        value={mapped || ''}
                        onChange={e => handleFieldChange(field, (e.target.value || null) as TargetField | null)}
                        className={cn(
                          'input py-1.5 text-xs max-w-xs',
                          !mapped && 'border-amber-300 bg-amber-50/30'
                        )}
                      >
                        <option value="">— 不映射 —</option>
                        {TARGET_FIELDS.map(tf => (
                          <option key={tf} value={tf}>{TARGET_FIELD_LABELS[tf]}</option>
                        ))}
                      </select>
                      {mapped && (
                        <span className="tag-normal">
                          <Check className="w-3 h-3 mr-0.5" />
                          {TARGET_FIELD_LABELS[mapped]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="px-4 py-3 bg-ink-50 border-b border-ink-100 text-sm font-medium text-ink-700">
                数据预览（前 5 条）
              </div>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white border-b border-ink-100">
                      {rawFields.map(f => (
                        <th key={f} className="px-3 py-2 text-left font-medium text-ink-500 whitespace-nowrap">
                          {f}
                          {currentMappings[f] && (
                            <span className="ml-1 text-[10px] text-ink-400">
                              → {TARGET_FIELD_LABELS[currentMappings[f] as TargetField]}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50">
                    {rawData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-ink-50/50">
                        {rawFields.map(f => (
                          <td key={f} className="px-3 py-2 text-ink-700 font-mono whitespace-nowrap">
                            {row[f] === '' || row[f] === null || row[f] === undefined ? (
                              <span className="text-anomaly-unit italic">空</span>
                            ) : String(row[f])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setStep('upload')} className="btn-secondary">
                返回
              </button>
              <button onClick={handleConfirmImport} className="btn-primary">
                <Check className="w-3.5 h-3.5 mr-1.5" />
                确认导入（{rawData.length} 条）
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="card p-12 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center">
              <Check className="w-7 h-7 text-anomaly-normal" />
            </div>
            <h3 className="text-lg font-serif font-bold text-ink-900 mb-1">导入成功</h3>
            <p className="text-sm text-ink-500 mb-6">
              已导入 {rawData.length} 条历史答案，来源「{previewSourceName}」
            </p>
            <div className="flex justify-center gap-2">
              <button onClick={() => { setStep('upload'); setRawData([]); setRawFields([]); }} className="btn-secondary">
                继续导入
              </button>
              <a href="/config" className="btn-primary">
                去验算配置
              </a>
            </div>
          </div>
        )}

        {answers.length > 0 && (
          <div className="mt-8 card p-4">
            <div className="text-xs font-medium text-ink-400 mb-3">已导入的历史答案来源</div>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(answers.map(a => a.source))).map(source => {
                const count = answers.filter(a => a.source === source).length;
                return (
                  <div key={source} className="tag bg-ink-50 text-ink-700 border border-ink-200">
                    {source}
                    <span className="ml-1.5 text-ink-400">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepBadge({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
        done ? 'bg-emerald-500 text-white' : active ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-400'
      )}>
        {done ? <Check className="w-3.5 h-3.5" /> : num}
      </div>
      <span className={cn('text-xs font-medium', active ? 'text-ink-800' : 'text-ink-400')}>{label}</span>
    </div>
  );
}
