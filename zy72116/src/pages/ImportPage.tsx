import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Play, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useAnalysisStore } from '../store/analysisStore';
import { parseCSV } from '../utils/csvParser';
import { generateSampleData, sampleDataCSV, dirtyDataCSV } from '../utils/sampleData';

const ImportPage: React.FC = () => {
  const navigate = useNavigate();
  const { createSession, loadData, updateMetadata, session } = useAnalysisStore();
  const [isDragging, setIsDragging] = useState(false);
  const [source, setSource] = useState('微信群记录 - 游乐设施维修群');
  const [processor, setProcessor] = useState('项目助理小宋');
  const [remarks, setRemarks] = useState('');
  const [sessionName, setSessionName] = useState('游乐设施离心力提醒');
  const [showDirtyDataInfo, setShowDirtyDataInfo] = useState(false);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const dataPoints = parseCSV(content);
      
      if (!session) {
        createSession(sessionName);
      }
      setTimeout(() => {
        loadData(dataPoints);
        updateMetadata({ 
          source: `文件上传: ${file.name}`, 
          processedAt: Date.now(),
          processor,
          remarks 
        });
        navigate('/analysis');
      }, 100);
    };
    reader.readAsText(file);
  }, [session, sessionName, processor, remarks, createSession, loadData, updateMetadata, navigate]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const loadSampleData = () => {
    if (!session) {
      createSession(sessionName);
    }
    setTimeout(() => {
      const sampleData = generateSampleData();
      loadData(sampleData);
      updateMetadata({ 
        source, 
        processedAt: Date.now(),
        processor,
        remarks: remarks || '样例数据 - 包含2个极端值，用于演示异常检测效果'
      });
      navigate('/analysis');
    }, 100);
  };

  const loadDirtyData = () => {
    if (!session) {
      createSession(sessionName + '（脏数据测试）');
    }
    setTimeout(() => {
      const dataPoints = parseCSV(dirtyDataCSV);
      loadData(dataPoints);
      updateMetadata({ 
        source: '脏数据测试 - 用于验证数据校验功能', 
        processedAt: Date.now(),
        processor,
        remarks: '包含方向缺失、无效数值、异常单位、时间间隔不均等问题'
      });
      navigate('/analysis');
    }, 100);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">🎢 游乐设施离心力提醒</h1>
        <p className="text-slate-600">导入实验数据，一键检测极端值异常，不再让风险被平均值掩盖</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              基本信息
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">分析名称</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">数据来源</label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="如：微信群记录、实验表、照片说明等"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">处理人</label>
                <input
                  type="text"
                  value={processor}
                  onChange={(e) => setProcessor(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="可选：记录工况、设备信息等"
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Play className="w-5 h-5 text-blue-600" />
              快速开始
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              没有数据？一键加载样例，体验完整分析流程
            </p>
            <button
              onClick={loadSampleData}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              加载样例数据并开始分析
            </button>
            <div className="mt-3">
              <button
                onClick={() => setShowDirtyDataInfo(!showDirtyDataInfo)}
                className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
              >
                <AlertCircle className="w-4 h-4" />
                测试脏数据处理能力
              </button>
              {showDirtyDataInfo && (
                <div className="mt-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800 mb-2">
                    这份数据包含：方向缺失、无效数值、异常单位、时间间隔不均等问题
                  </p>
                  <button
                    onClick={loadDirtyData}
                    className="text-sm bg-amber-500 text-white px-3 py-1.5 rounded hover:bg-amber-600 transition-colors"
                  >
                    加载脏数据测试
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`bg-white rounded-xl border-2 border-dashed p-8 text-center transition-all ${
              isDragging 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
            }`}
          >
            <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              {isDragging ? '松开以上传文件' : '拖拽 CSV 文件到此处'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              支持 .csv 或 .txt 格式的实验数据表
            </p>
            <label className="inline-block">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileInput}
                className="hidden"
              />
              <span className="px-6 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors inline-block">
                选择文件
              </span>
            </label>
          </div>

          <div className="mt-6 bg-slate-50 rounded-xl p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-500" />
              CSV 文件格式要求
            </h3>
            <div className="text-sm text-slate-600 space-y-2">
              <p>文件应包含以下列（列名可灵活匹配）：</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>时间</strong>：数据采集时间</li>
                <li><strong>离心力</strong>：数值，单位N</li>
                <li><strong>方向</strong>：正/负 或 positive/negative</li>
                <li><strong>单位</strong>：建议使用 N（牛顿）</li>
                <li><strong>备注</strong>：可选，人工标记说明</li>
              </ul>
              <div className="mt-3 p-3 bg-white rounded border border-slate-200 font-mono text-xs overflow-x-auto">
                <p className="text-slate-500 mb-1">示例：</p>
                <p>时间,离心力(N),方向,单位,备注</p>
                <p>08:00:00,1250,正,N,正常运行</p>
                <p>08:00:15,2850,正,N,⚠️ 极端值</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
              <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-xs text-green-700 font-medium">极端值检测</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
              <CheckCircle className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-xs text-blue-700 font-medium">图表复现</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center border border-amber-200">
              <CheckCircle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              <p className="text-xs text-amber-700 font-medium">完整导出</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportPage;
