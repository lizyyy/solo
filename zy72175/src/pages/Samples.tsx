
import React, { useState } from 'react';
import { Search, Filter, Upload, ChevronDown, ChevronUp, Eye, History } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getStatusLabel, getStatusColor, getSourceLabel, getSourceColor, formatDate } from '../utils';
import { SampleStatus, SourceType } from '../types';

export const Samples: React.FC = () => {
  const { samples, detections, setSelectedSampleId } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SampleStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceType | 'all'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);

  const filteredSamples = samples.filter((sample) => {
    const matchesSearch = sample.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sample.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sample.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || sample.source === sourceFilter;
    return matchesSearch && matchesStatus && matchesSource;
  });

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getDetectionInfo = (sampleId: string) => {
    return detections.find((d) => d.sampleId === sampleId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">样本管理</h1>
          <p className="text-gray-500 mt-1">管理所有客服意图样本数据</p>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          alert('文件上传功能（演示）');
        }}
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">拖拽文件到此处上传</p>
        <p className="text-sm text-gray-400 mt-1">支持模型输出日志、人工标注、线上反馈数据</p>
        <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          选择文件
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索样本ID或内容..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as SampleStatus | 'all')}
              >
                <option value="all">全部状态</option>
                <option value="pending">待检测</option>
                <option value="detected">已检测</option>
                <option value="reviewing">待复核</option>
                <option value="completed">已完成</option>
              </select>
              <select
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as SourceType | 'all')}
              >
                <option value="all">全部来源</option>
                <option value="model">模型输出</option>
                <option value="manual">人工标注</option>
                <option value="online">线上反馈</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  样本ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  内容预览
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  原始意图
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  来源
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  更新时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSamples.map((sample) => {
                const isExpanded = expandedRows.has(sample.id);
                const detection = getDetectionInfo(sample.id);

                return (
                  <React.Fragment key={sample.id}>
                    <tr
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                    detection?.isDrift ? 'bg-orange-50/50' : ''
                  }`}
                  onClick={() => toggleRow(sample.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">{sample.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 max-w-md truncate">
                      {sample.content.split('\n')[0]}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{sample.originalIntent}</span>
                    {detection?.isDrift && (
                      <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                        漂移
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSourceColor(
                        sample.source
                      )}`}
                    >
                      {getSourceLabel(sample.source)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                        sample.status
                      )}`}
                    >
                      {getStatusLabel(sample.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(sample.updatedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSampleId(sample.id);
                          window.location.hash = '#/detection';
                        }}
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                        <History className="w-5 h-5" />
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={7} className="bg-gray-50 px-6 py-4">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">完整对话内容</h4>
                          <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans">
                              {sample.content}
                            </pre>
                          </div>
                        </div>
                        {detection && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">检测信息</h4>
                            <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-2">
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500">模型判断</span>
                                <span className="text-sm font-medium">{detection.modelIntent}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500">置信度</span>
                                <span className="text-sm font-medium">
                                  {(detection.modelConfidence * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500">漂移分数</span>
                                <span
                                  className={`text-sm font-medium ${
                                    detection.isDrift ? 'text-orange-600' : 'text-green-600'
                                  }`}
                                >
                                  {detection.driftScore.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500">阈值版本</span>
                                <span className="text-sm font-medium">{detection.thresholdVersion}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            共 {filteredSamples.length} 条样本
          </span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50">
              上一页
            </button>
            <span className="px-3 py-1 bg-blue-600 text-white rounded text-sm">1</span>
            <button className="px-3 py-1 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50">
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
