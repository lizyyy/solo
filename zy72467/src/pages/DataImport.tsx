import React, { useState } from 'react';
import { useAppStore } from '@/store';
import { Upload, Plus, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

export const DataImport: React.FC = () => {
  const { importRampRecords, importSamplingRecords, loading } = useAppStore();
  const [activeTab, setActiveTab] = useState<'ramp' | 'sampling'>('ramp');
  const [message, setMessage] = useState<ImportMessage | null>(null);

  const [rampForm, setRampForm] = useState({
    location: '',
    hasRamp: 'true',
    rampCondition: '',
    residentOpinionOriginal: '',
    residentOpinionSummary: '',
    originalRowNumber: '',
    sourceFile: '手动录入',
  });

  const [samplingForm, setSamplingForm] = useState({
    location: '',
    samplingPoint: '',
    nightService: 'true',
    residentOpinionOriginal: '',
    residentOpinionSummary: '',
    originalRowNumber: '',
    sourceFile: '手动补录',
  });

  const showMessage = (type: ImportMessage['type'], text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleRampSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rampForm.location || !rampForm.residentOpinionSummary) {
      showMessage('error', '请填写位置和居民意见汇总');
      return;
    }

    const result = await importRampRecords([{
      originalRowNumber: parseInt(rampForm.originalRowNumber) || 0,
      sourceFile: rampForm.sourceFile,
      location: rampForm.location,
      hasRamp: rampForm.hasRamp === 'true',
      rampCondition: rampForm.rampCondition,
      residentOpinionOriginal: rampForm.residentOpinionOriginal || undefined,
      residentOpinionSummary: rampForm.residentOpinionSummary,
    }]);

    if (result.success) {
      showMessage('success', result.message || '导入成功');
      setRampForm({
        location: '',
        hasRamp: 'true',
        rampCondition: '',
        residentOpinionOriginal: '',
        residentOpinionSummary: '',
        originalRowNumber: '',
        sourceFile: '手动录入',
      });
    } else {
      showMessage('error', result.message || '导入失败');
    }
  };

  const handleSamplingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!samplingForm.location || !samplingForm.samplingPoint || !samplingForm.residentOpinionSummary) {
      showMessage('error', '请填写位置、采样点名称和居民意见汇总');
      return;
    }

    const result = await importSamplingRecords([{
      originalRowNumber: parseInt(samplingForm.originalRowNumber) || 0,
      sourceFile: samplingForm.sourceFile,
      location: samplingForm.location,
      samplingPoint: samplingForm.samplingPoint,
      nightService: samplingForm.nightService === 'true',
      residentOpinionOriginal: samplingForm.residentOpinionOriginal || undefined,
      residentOpinionSummary: samplingForm.residentOpinionSummary,
    }]);

    if (result.success) {
      showMessage('success', result.message || '补录成功');
      setSamplingForm({
        location: '',
        samplingPoint: '',
        nightService: 'true',
        residentOpinionOriginal: '',
        residentOpinionSummary: '',
        originalRowNumber: '',
        sourceFile: '手动补录',
      });
    } else {
      showMessage('error', result.message || '补录失败');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

      if (activeTab === 'ramp') {
        const records = jsonData.map((row, idx) => ({
          originalRowNumber: idx + 2,
          sourceFile: file.name,
          location: row['位置'] || row['location'] || '',
          hasRamp: (row['有无坡道'] || row['hasRamp'] || '是') === '是',
          rampCondition: row['坡道状况'] || row['rampCondition'] || '',
          residentOpinionOriginal: row['居民意见原文'] || row['residentOpinionOriginal'] || undefined,
          residentOpinionSummary: row['居民意见汇总'] || row['residentOpinionSummary'] || '',
        })).filter(r => r.location);

        const result = await importRampRecords(records);
        if (result.success) {
          showMessage('success', result.message || '导入成功');
        } else {
          showMessage('error', result.message || '导入失败');
        }
      } else {
        const records = jsonData.map((row, idx) => ({
          originalRowNumber: idx + 2,
          sourceFile: file.name,
          location: row['位置'] || row['location'] || '',
          samplingPoint: row['采样点名称'] || row['samplingPoint'] || '',
          nightService: (row['夜间服务'] || row['nightService'] || '是') === '是',
          residentOpinionOriginal: row['居民意见原文'] || row['residentOpinionOriginal'] || undefined,
          residentOpinionSummary: row['居民意见汇总'] || row['residentOpinionSummary'] || '',
        })).filter(r => r.location && r.samplingPoint);

        const result = await importSamplingRecords(records);
        if (result.success) {
          showMessage('success', result.message || '补录成功');
        } else {
          showMessage('error', result.message || '补录失败');
        }
      }
    } catch (err) {
      showMessage('error', '文件解析失败，请检查文件格式');
    }

    e.target.value = '';
  };

  const messageIcon = message?.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
    message?.type === 'error' ? <XCircle className="w-5 h-5" /> :
    <AlertCircle className="w-5 h-5" />;

  const messageBg = message?.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
    message?.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
    'bg-blue-50 border-blue-200 text-blue-700';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-slate-800">数据导入</h3>
        <p className="text-sm text-slate-500 mt-1">
          导入无障碍坡道记录或补录夜间采样点数据
        </p>
      </div>

      {message && (
        <div className={`${messageBg} border px-4 py-3 rounded-lg flex items-center gap-2`}>
          {messageIcon}
          <span>{message.text}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('ramp')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'ramp'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            无障碍坡道记录导入
          </button>
          <button
            onClick={() => setActiveTab('sampling')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'sampling'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            夜间采样点补录
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              上传Excel文件
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600 mb-2">拖拽文件到此处，或点击选择文件</p>
              <p className="text-xs text-slate-400 mb-4">支持 .xlsx, .xls 格式</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer transition-colors">
                <Plus className="w-4 h-4" />
                选择文件
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={loading}
                />
              </label>
            </div>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-slate-500">或手动录入</span>
            </div>
          </div>

          {activeTab === 'ramp' ? (
            <form onSubmit={handleRampSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    位置 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={rampForm.location}
                    onChange={(e) => setRampForm({ ...rampForm, location: e.target.value })}
                    placeholder="例如：幸福小区1号楼"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    原始行号
                  </label>
                  <input
                    type="number"
                    value={rampForm.originalRowNumber}
                    onChange={(e) => setRampForm({ ...rampForm, originalRowNumber: e.target.value })}
                    placeholder="Excel中的行号"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    有无障碍坡道
                  </label>
                  <select
                    value={rampForm.hasRamp}
                    onChange={(e) => setRampForm({ ...rampForm, hasRamp: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="true">是</option>
                    <option value="false">否</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    坡道状况
                  </label>
                  <input
                    type="text"
                    value={rampForm.rampCondition}
                    onChange={(e) => setRampForm({ ...rampForm, rampCondition: e.target.value })}
                    placeholder="例如：完好、轻微磨损、损坏需维修"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  居民意见汇总 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={rampForm.residentOpinionSummary}
                  onChange={(e) => setRampForm({ ...rampForm, residentOpinionSummary: e.target.value })}
                  placeholder="简短概括居民意见"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  居民意见原文
                  <span className="text-orange-500 ml-1 text-xs">（建议填写，避免后续需要复核）</span>
                </label>
                <textarea
                  value={rampForm.residentOpinionOriginal}
                  onChange={(e) => setRampForm({ ...rampForm, residentOpinionOriginal: e.target.value })}
                  placeholder="居民的原始反馈内容"
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? '导入中...' : '导入记录'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSamplingSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    位置 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={samplingForm.location}
                    onChange={(e) => setSamplingForm({ ...samplingForm, location: e.target.value })}
                    placeholder="例如：幸福小区1号楼"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    采样点名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={samplingForm.samplingPoint}
                    onChange={(e) => setSamplingForm({ ...samplingForm, samplingPoint: e.target.value })}
                    placeholder="例如：幸福小区北门岗亭"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    原始行号
                  </label>
                  <input
                    type="number"
                    value={samplingForm.originalRowNumber}
                    onChange={(e) => setSamplingForm({ ...samplingForm, originalRowNumber: e.target.value })}
                    placeholder="Excel中的行号"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    是否夜间服务
                  </label>
                  <select
                    value={samplingForm.nightService}
                    onChange={(e) => setSamplingForm({ ...samplingForm, nightService: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="true">是</option>
                    <option value="false">否</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  居民意见汇总 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={samplingForm.residentOpinionSummary}
                  onChange={(e) => setSamplingForm({ ...samplingForm, residentOpinionSummary: e.target.value })}
                  placeholder="简短概括居民意见"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  居民意见原文
                  <span className="text-orange-500 ml-1 text-xs">（建议填写，避免后续需要复核）</span>
                </label>
                <textarea
                  value={samplingForm.residentOpinionOriginal}
                  onChange={(e) => setSamplingForm({ ...samplingForm, residentOpinionOriginal: e.target.value })}
                  placeholder="居民的原始反馈内容"
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? '补录中...' : '补录采样点'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
