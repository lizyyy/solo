import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { useReportStore } from '../store/useReportStore';
import { StepIndicator } from '../components/common/StepIndicator';

export function ImportPage() {
  const navigate = useNavigate();
  const { importBucket } = useReportStore();
  const [bucketName, setBucketName] = useState('');
  const [sampleCount, setSampleCount] = useState('');
  const [algorithm, setAlgorithm] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string; reportId?: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleSubmit = () => {
    if (!bucketName.trim()) {
      setResult({ success: false, message: '请输入实验桶名称' });
      return;
    }

    const data = {
      algorithm: algorithm || 'default',
      sampleCount: parseInt(sampleCount) || 1000,
    };

    const importResult = importBucket(bucketName, data, '推荐策略老唐');
    
    if (importResult.success) {
      setResult({
        success: true,
        message: importResult.message,
        reportId: importResult.report?.id,
      });
    } else {
      setResult({
        success: false,
        message: importResult.message,
        reportId: importResult.report?.id,
      });
    }
  };

  const handleTestDuplicate = () => {
    const existingData = { algorithm: 'v2.1', sampleCount: 10000, clickRate: 0.125 };
    const importResult = importBucket('测试重复导入-实验组A', existingData, '推荐策略老唐');
    setResult({
      success: importResult.success,
      message: importResult.message,
      reportId: importResult.report?.id,
    });
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 font-serif">导入线上实验桶</h1>
        <p className="text-sm text-slate-500 mt-1">系统将自动去重，重复导入不会创建重复报告</p>
      </div>

      <div className="mb-8 bg-white rounded-xl p-6 border border-slate-200">
        <StepIndicator
          currentStep={1}
          steps={['导入实验桶', '补看负样本', '更新异常页']}
        />
      </div>

      <div
        className={`mb-6 border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ${
          isDragging
            ? 'border-sky-400 bg-sky-50'
            : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          setBucketName('拖拽上传的实验桶-' + Date.now().toString().slice(-6));
        }}
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
          <Upload size={32} className="text-slate-400" />
        </div>
        <p className="text-slate-600 mb-2">拖拽实验桶数据文件到此处</p>
        <p className="text-sm text-slate-400">或手动填写下方信息</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            实验桶名称 <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={bucketName}
            onChange={(e) => setBucketName(e.target.value)}
            placeholder="例如：推荐算法A/B测试-2024Q2-实验组A"
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              样本量
            </label>
            <input
              type="number"
              value={sampleCount}
              onChange={(e) => setSampleCount(e.target.value)}
              placeholder="10000"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              算法版本
            </label>
            <input
              type="text"
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
              placeholder="v2.1"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all text-sm"
            />
          </div>
        </div>

        {result && (
          <div
            className={`p-4 rounded-lg flex items-start gap-3 ${
              result.success
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-amber-50 border border-amber-200'
            }`}
          >
            {result.success ? (
              <CheckCircle size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-sm font-medium ${result.success ? 'text-emerald-700' : 'text-amber-700'}`}>
                {result.success ? '导入成功' : '检测到重复'}
              </p>
              <p className={`text-sm ${result.success ? 'text-emerald-600' : 'text-amber-600'}`}>
                {result.message}
              </p>
              {result.reportId && (
                <button
                  onClick={() => navigate(`/report/${result.reportId}`)}
                  className="mt-2 inline-flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 font-medium"
                >
                  <FileText size={14} />
                  查看报告详情
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            导入并创建报告
          </button>
          <button
            onClick={handleTestDuplicate}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            测试重复导入
          </button>
        </div>
      </div>
    </div>
  );
}
