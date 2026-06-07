import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { parseCorrectionCSV, parseInterviewCSV, createReviewRecord } from '../utils/business';
import type { InterviewSample, ManualCorrection } from '../types';

const ImportPage: React.FC = () => {
  const { state, dispatch } = useApp();
  const [interviewText, setInterviewText] = useState('');
  const [correctionText, setCorrectionText] = useState('');
  const [previewData, setPreviewData] = useState<{ samples: InterviewSample[]; corrections: ManualCorrection[] } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const interviewFileRef = useRef<HTMLInputElement>(null);
  const correctionFileRef = useRef<HTMLInputElement>(null);

  const handleInterviewFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setInterviewText(text);
      };
      reader.readAsText(file);
    }
  };

  const handleCorrectionFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCorrectionText(text);
      };
      reader.readAsText(file);
    }
  };

  const handlePreview = () => {
    if (!interviewText.trim()) {
      setMessage({ type: 'error', text: '请先导入面试数据' });
      return;
    }

    const samples = parseInterviewCSV(interviewText);
    const corrections = correctionText.trim() ? parseCorrectionCSV(correctionText) : [];

    if (samples.length === 0) {
      setMessage({ type: 'error', text: '未解析到有效面试数据' });
      return;
    }

    setPreviewData({ samples, corrections });
    setMessage({ type: 'info', text: `解析到 ${samples.length} 条面试数据${corrections.length > 0 ? `，${corrections.length} 条人工改判` : ''}` });
  };

  const handleImport = () => {
    if (!previewData) {
      setMessage({ type: 'error', text: '请先预览数据' });
      return;
    }

    const { samples, corrections } = previewData;
    const correctionMap = new Map(corrections.map(c => [c.sampleId, c]));

    const records = samples.map(sample => {
      const correction = correctionMap.get(sample.sampleId);
      return createReviewRecord(sample, correction, state.currentUser, state.currentRole);
    });

    dispatch({ type: 'ADD_REVIEW_RECORDS', payload: records });
    setMessage({ type: 'success', text: `成功导入 ${records.length} 条记录` });
    setPreviewData(null);
    setInterviewText('');
    setCorrectionText('');
  };

  const loadDemoData = () => {
    const demoInterview = `样本编号,模型版本,AI评分,候选人,面试日期,应聘岗位
S001,v1.0,75,张三,2024-01-15,算法工程师
S002,v1.0,58,李四,2024-01-15,产品经理
S003,v1.1,82,王五,2024-01-16,前端开发
S004,v1.0,45,赵六,2024-01-16,后端开发
S005,v1.1,90,钱七,2024-01-17,测试工程师`;

    const demoCorrection = `样本编号,人工评分,人工结论,改判理由,改判人,改判时间
S001,70,通过,按v2.0提示词标准评分,运营A,2024-01-20
S002,65,通过,表现尚可,运营A,2024-01-20
S003,75,通过,需复核模型版本,运营B,2024-01-21`;

    setInterviewText(demoInterview);
    setCorrectionText(demoCorrection);
    setMessage({ type: 'info', text: '已加载演示数据，点击预览查看' });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">数据导入</h2>

      {message && (
        <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : message.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">面试数据（必填）</h3>
          <div className="mb-3">
            <input
              type="file"
              accept=".csv,.txt"
              ref={interviewFileRef}
              onChange={handleInterviewFileUpload}
              className="hidden"
            />
            <button
              onClick={() => interviewFileRef.current?.click()}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 mr-2"
            >
              选择文件
            </button>
            <span className="text-sm text-gray-500">支持 CSV / TXT</span>
          </div>
          <textarea
            value={interviewText}
            onChange={e => setInterviewText(e.target.value)}
            placeholder="样本编号,模型版本,AI评分,候选人,面试日期,应聘岗位"
            className="w-full h-40 p-2 border rounded text-sm font-mono"
          />
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">人工改判表（可选）</h3>
          <div className="mb-3">
            <input
              type="file"
              accept=".csv,.txt"
              ref={correctionFileRef}
              onChange={handleCorrectionFileUpload}
              className="hidden"
            />
            <button
              onClick={() => correctionFileRef.current?.click()}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 mr-2"
            >
              选择文件
            </button>
            <span className="text-sm text-gray-500">支持 CSV / TXT</span>
          </div>
          <textarea
            value={correctionText}
            onChange={e => setCorrectionText(e.target.value)}
            placeholder="样本编号,人工评分,人工结论,改判理由,改判人,改判时间"
            className="w-full h-40 p-2 border rounded text-sm font-mono"
          />
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={loadDemoData}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          加载演示数据
        </button>
        <button
          onClick={handlePreview}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          预览解析结果
        </button>
        <button
          onClick={handleImport}
          disabled={!previewData}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          确认导入
        </button>
      </div>

      {previewData && (
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">数据预览</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-2 py-1 text-left">样本编号</th>
                  <th className="px-2 py-1 text-left">候选人</th>
                  <th className="px-2 py-1 text-left">模型版本</th>
                  <th className="px-2 py-1 text-right">AI评分</th>
                  <th className="px-2 py-1 text-right">人工评分</th>
                  <th className="px-2 py-1 text-left">人工结论</th>
                </tr>
              </thead>
              <tbody>
                {previewData.samples.slice(0, 10).map(sample => {
                  const correction = previewData.corrections.find(c => c.sampleId === sample.sampleId);
                  return (
                    <tr key={sample.sampleId} className="border-b">
                      <td className="px-2 py-1">{sample.sampleId}</td>
                      <td className="px-2 py-1">{sample.candidateName}</td>
                      <td className="px-2 py-1">
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                          {sample.modelVersion}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-right">{sample.aiScore}</td>
                      <td className="px-2 py-1 text-right">
                        {correction ? correction.humanScore : '-'}
                      </td>
                      <td className="px-2 py-1">
                        {correction ? (
                          <span className={`px-2 py-0.5 rounded text-xs ${correction.conclusion.includes('通过') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {correction.conclusion}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {previewData.samples.length > 10 && (
              <p className="text-sm text-gray-500 mt-2">仅显示前10条，共 {previewData.samples.length} 条</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold mb-2 text-sm">导入自检说明</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• 自动检测重复导入（同批次+同样本编号）</li>
          <li>• 自动检测模型版本与样本编号不一致</li>
          <li>• 导入后不自动覆盖结论，需人工确认流程</li>
          <li>• 所有操作记入历史，可追溯审计</li>
        </ul>
      </div>
    </div>
  );
};

export default ImportPage;
