import { useRef, useState } from 'react';
import { api } from '@/api/client';
import type { BatchImportInput, BatchOverview } from '../../shared/types';

const normalSeed: BatchImportInput = {
  batchId: 'batch-normal-001',
  batchName: '618活动文案-正常审核批次',
  modelVersionA: 'v2.3.1',
  modelVersionB: 'v2.4.0',
  samples: [
    { id: 'S001', content: '618超值钜惠，全场5折起，限时3天，错过再等一年！', confidenceA: 0.92, confidenceB: 0.88, labelA: 'pass', labelB: 'pass', grayLabel: 'pass' },
    { id: 'S002', content: '限时秒杀，先到先得，数量有限售完即止', confidenceA: 0.55, confidenceB: 0.72, labelA: 'uncertain', labelB: 'pass', grayLabel: 'uncertain', annotatorNote: '应通过，常规营销文案' },
    { id: 'S003', content: '虚假宣传：100%中奖，绝不落空', confidenceA: 0.21, confidenceB: 0.18, labelA: 'reject', labelB: 'reject', grayLabel: 'reject' },
    { id: 'S004', content: '品质保证，正品行货，支持7天无理由退换', confidenceA: 0.85, confidenceB: 0.87, labelA: 'pass', labelB: 'pass', grayLabel: 'pass' },
    { id: 'S005', content: '全网最低价，比任何平台都便宜，买贵赔10倍', confidenceA: 0.35, confidenceB: 0.42, labelA: 'reject', labelB: 'reject', grayLabel: 'reject' },
    { id: 'S006', content: '新人专享礼包，注册即送100元优惠券', confidenceA: 0.78, confidenceB: 0.81, labelA: 'pass', labelB: 'pass', grayLabel: 'pass' },
  ],
};

const wrongSeed: BatchImportInput = {
  batchId: 'batch-wrong-001',
  batchName: '错口径-已标注样本测试',
  modelVersionA: 'v2.3.1',
  modelVersionB: 'v2.4.0',
  samples: [
    { id: 'W001', content: '医疗级功效，7天根治，无效全额退款', confidenceA: 0.58, confidenceB: 0.62, labelA: 'pass', labelB: 'pass', grayLabel: 'pass', annotatorNote: '应拒绝，含虚假医疗承诺' },
    { id: 'W002', content: '国家级认证，权威推荐，领导品牌', confidenceA: 0.48, confidenceB: 0.52, labelA: 'pass', labelB: 'uncertain', grayLabel: 'pass', annotatorNote: '应拒绝，使用国家级违禁词' },
    { id: 'W003', content: '普通保湿乳液，适合敏感肌肤使用', confidenceA: 0.82, confidenceB: 0.79, labelA: 'pass', labelB: 'pass', grayLabel: 'pass' },
  ],
};

const supplementSeed: BatchImportInput = {
  batchId: 'batch-supp-001',
  batchName: '补录材料-置信度重算测试',
  modelVersionA: 'v2.3.1',
  modelVersionB: 'v2.4.0',
  samples: [
    { id: 'P001', content: '点击链接立即参与抽奖活动', confidenceA: 0.50, confidenceB: 0.58, labelA: 'uncertain', labelB: 'pass', grayLabel: 'uncertain' },
    { id: 'P002', content: '扫描二维码关注公众号获取更多优惠', confidenceA: 0.65, confidenceB: 0.68, labelA: 'pass', labelB: 'pass', grayLabel: 'pass' },
    { id: 'P003', content: '诱导分享：转发给5个好友领取红包', confidenceA: 0.45, confidenceB: 0.40, labelA: 'reject', labelB: 'reject', grayLabel: 'reject' },
  ],
};

export default function ImportPage() {
  const [batchId, setBatchId] = useState('');
  const [batchName, setBatchName] = useState('');
  const [modelA, setModelA] = useState('v2.3.1');
  const [modelB, setModelB] = useState('v2.4.0');
  const [result, setResult] = useState<{ skipped: number; added: number; overview: BatchOverview } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport(payload: BatchImportInput) {
    setLoading(true);
    try {
      const res = await api.importBatch(payload);
      setResult({ skipped: res.skipped, added: res.added, overview: res.overview });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function submitSeed(seed: BatchImportInput) {
    const payload: BatchImportInput = {
      ...seed,
      batchId: batchId || seed.batchId,
      batchName: batchName || seed.batchName,
      modelVersionA: modelA,
      modelVersionB: modelB,
    };
    handleImport(payload);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as BatchImportInput;
        const payload: BatchImportInput = {
          ...data,
          batchId: batchId || data.batchId,
          batchName: batchName || data.batchName,
          modelVersionA: modelA || data.modelVersionA,
          modelVersionB: modelB || data.modelVersionB,
        };
        handleImport(payload);
      } catch (err) {
        console.error('JSON解析失败', err);
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-lg font-semibold text-white mb-6">灰度批次导入</h2>

      <div className="bg-slate-800/30 border border-white/10 rounded-sm p-6 mb-6">
        <h3 className="text-sm font-medium text-white mb-4">批次信息</h3>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">批次ID</label>
            <input
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="如 batch-001"
              className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-sm text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-white/20"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">批次名称</label>
            <input
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="如 618活动文案批次"
              className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-sm text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-white/20"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">模型A版本</label>
            <input
              value={modelA}
              onChange={(e) => setModelA(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:border-white/20"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">模型B版本</label>
            <input
              value={modelB}
              onChange={(e) => setModelB(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:border-white/20"
            />
          </div>
        </div>

        <h3 className="text-sm font-medium text-white mb-3">快捷导入</h3>
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => submitSeed(normalSeed)}
            disabled={loading}
            className="rounded-sm px-3 py-1.5 font-medium text-sm bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-50 transition-colors"
          >
            导入正常材料
          </button>
          <button
            onClick={() => submitSeed(wrongSeed)}
            disabled={loading}
            className="rounded-sm px-3 py-1.5 font-medium text-sm bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-50 transition-colors"
          >
            导入错口径材料
          </button>
          <button
            onClick={() => submitSeed(supplementSeed)}
            disabled={loading}
            className="rounded-sm px-3 py-1.5 font-medium text-sm bg-purple-500 hover:bg-purple-400 text-white disabled:opacity-50 transition-colors"
          >
            导入补录材料
          </button>
        </div>

        <h3 className="text-sm font-medium text-white mb-3">或上传 JSON 文件</h3>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleFile}
            disabled={loading}
            className="block text-sm text-slate-400 file:mr-3 file:rounded-sm file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium file:bg-slate-700 file:text-white hover:file:bg-slate-600 file:cursor-pointer file:transition-colors"
          />
        </div>
      </div>

      {loading && (
        <div className="text-center text-slate-400 py-8">导入中...</div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/30 border border-white/10 rounded-sm p-5">
              <div className="text-xs text-slate-400 mb-1">新增样本</div>
              <div className="text-2xl font-semibold text-emerald-400">{result.added}</div>
            </div>
            <div className="bg-slate-800/30 border border-white/10 rounded-sm p-5">
              <div className="text-xs text-slate-400 mb-1">重复跳过</div>
              <div className="text-2xl font-semibold text-slate-400">{result.skipped}</div>
            </div>
          </div>

          <div className="bg-slate-800/30 border border-white/10 rounded-sm p-5">
            <h4 className="text-sm font-medium text-white mb-4">批次概览</h4>
            <div className="grid grid-cols-3 gap-4 text-sm divide-x divide-white/10">
              <div>
                <div className="text-xs text-slate-400 mb-1">总样本数</div>
                <div className="text-white font-medium">{result.overview.totalSamples}</div>
              </div>
              <div className="px-4">
                <div className="text-xs text-slate-400 mb-1">低置信度</div>
                <div className="text-amber-400 font-medium">{result.overview.lowConfidenceCount}</div>
              </div>
              <div className="pl-4">
                <div className="text-xs text-slate-400 mb-1">冲突数</div>
                <div className="text-red-400 font-medium">{result.overview.conflictCount}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">已审核</div>
                <div className="text-white font-medium">{result.overview.reviewedCount}</div>
              </div>
              <div className="px-4">
                <div className="text-xs text-slate-400 mb-1">模型A平均置信度</div>
                <div className="text-white font-medium">{(result.overview.avgConfidenceA * 100).toFixed(1)}%</div>
              </div>
              <div className="pl-4">
                <div className="text-xs text-slate-400 mb-1">模型B平均置信度</div>
                <div className="text-white font-medium">{(result.overview.avgConfidenceB * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
