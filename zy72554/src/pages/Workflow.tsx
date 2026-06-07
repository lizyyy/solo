import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Link2,
  TrendingUp,
  Check,
  ChevronRight,
  ChevronLeft,
  FileText,
  AlertTriangle,
  Plus,
  X
} from 'lucide-react';
import { useAppStore } from '../store';
import { getHumanFriendlyError, getStepLabel, parseThresholdNote, detectAnomalies, getStatusColor } from '../utils';
import type { WorkflowStep, ThresholdItem } from '../types';

const steps: WorkflowStep[] = ['import', 'bucket', 'metric'];

export const WorkflowPage = () => {
  const navigate = useNavigate();
  const {
    currentWorkflowStep,
    setCurrentWorkflowStep,
    currentPlaybackData,
    setCurrentPlaybackData,
    selectedPlaybackId,
    setSelectedPlaybackId,
    importThresholdNote,
    addExperimentBucket,
    updateLayerMetrics,
    addToast,
    getBucketsByPlaybackId,
    getLayerMetricsByPlaybackId,
    getPlaybackById
  } = useAppStore();

  const [isDragging, setIsDragging] = useState(false);
  const [bucketName, setBucketName] = useState('');
  const [bucketUrl, setBucketUrl] = useState('');
  const [layerName, setLayerName] = useState('');
  const [metricName, setMetricName] = useState('');
  const [oldValue, setOldValue] = useState('');
  const [newValue, setNewValue] = useState('');
  const [metricsList, setMetricsList] = useState<Array<{
    layerName: string;
    metricName: string;
    oldValue: number;
    newValue: number;
  }>>([]);

  const currentStepIndex = steps.indexOf(currentWorkflowStep);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const processFile = (file: File) => {
    if (!file.name.endsWith('.json')) {
      addToast('error', getHumanFriendlyError('file_invalid'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseThresholdNote(content);
      
      if (!parsed) {
        addToast('error', getHumanFriendlyError('file_invalid'));
        return;
      }

      setCurrentPlaybackData({
        noteId: parsed.noteId,
        fileName: file.name,
        thresholds: parsed.thresholds,
        remark: parsed.remark
      });

      const result = importThresholdNote(
        parsed.noteId,
        file.name,
        parsed.thresholds,
        parsed.remark
      );

      setSelectedPlaybackId(result.playbackId);

      if (result.isDuplicate) {
        addToast('warning', getHumanFriendlyError('note_id_duplicate'));
      } else {
        addToast('success', '导入成功！请继续下一步');
      }
    };
    reader.readAsText(file);
  };

  const handleAddBucket = () => {
    if (!bucketName.trim() || !bucketUrl.trim()) {
      addToast('error', '请填写实验桶名称和链接');
      return;
    }
    if (!bucketUrl.startsWith('http')) {
      addToast('error', getHumanFriendlyError('bucket_url_invalid'));
      return;
    }
    if (selectedPlaybackId) {
      addExperimentBucket(selectedPlaybackId, bucketName, bucketUrl);
      addToast('success', '实验桶关联成功');
      setBucketName('');
      setBucketUrl('');
    }
  };

  const handleAddMetric = () => {
    if (!layerName.trim() || !metricName.trim() || !oldValue || !newValue) {
      addToast('error', '请填写完整的分层指标信息');
      return;
    }
    setMetricsList([...metricsList, {
      layerName,
      metricName,
      oldValue: parseFloat(oldValue),
      newValue: parseFloat(newValue)
    }]);
    setLayerName('');
    setMetricName('');
    setOldValue('');
    setNewValue('');
    addToast('success', '指标已添加到列表');
  };

  const handleRemoveMetric = (index: number) => {
    setMetricsList(metricsList.filter((_, i) => i !== index));
  };

  const handleSubmitMetrics = () => {
    if (metricsList.length === 0) {
      addToast('error', '请至少添加一条分层指标');
      return;
    }
    if (selectedPlaybackId) {
      updateLayerMetrics(selectedPlaybackId, metricsList);
      addToast('success', '分层指标更新完成！');
      setMetricsList([]);
    }
  };

  const goToNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      if (currentWorkflowStep === 'import' && !selectedPlaybackId) {
        addToast('error', '请先导入阈值调参笔记');
        return;
      }
      setCurrentWorkflowStep(steps[currentStepIndex + 1]);
    }
  };

  const goToPrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentWorkflowStep(steps[currentStepIndex - 1]);
    }
  };

  const currentBuckets = selectedPlaybackId ? getBucketsByPlaybackId(selectedPlaybackId) : [];
  const currentMetrics = selectedPlaybackId ? getLayerMetricsByPlaybackId(selectedPlaybackId) : [];
  const currentPlayback = selectedPlaybackId ? getPlaybackById(selectedPlaybackId) : null;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 font-display mb-2">阈值调参工作流</h1>
        <p className="text-gray-500">按照三步流程完成阈值调参笔记的导入与复核</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  index < currentStepIndex
                    ? 'bg-green-500 text-white'
                    : index === currentStepIndex
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {index < currentStepIndex ? <Check className="w-5 h-5" /> : index + 1}
                </div>
                <span className={`ml-3 font-medium ${
                  index <= currentStepIndex ? 'text-gray-800' : 'text-gray-400'
                }`}>
                  {getStepLabel(step)}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-24 h-1 mx-4 rounded ${
                  index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        {currentWorkflowStep === 'import' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 font-display mb-2">
                第一步：导入阈值调参笔记
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                支持 JSON 格式的阈值调参笔记文件，系统将自动检测阈值与报告值是否一致
              </p>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
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
                <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-primary-500' : 'text-gray-400'}`} />
                <p className="text-gray-700 font-medium mb-2">
                  拖拽文件到此处，或点击选择文件
                </p>
                <p className="text-sm text-gray-400">支持 .json 格式的阈值调参笔记</p>
              </label>
            </div>

            {currentPlaybackData && (
              <div className="animate-fade-in">
                <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-primary-500" />
                      <div>
                        <h3 className="font-medium text-gray-800">{currentPlaybackData.fileName}</h3>
                        <p className="text-sm text-gray-500">笔记ID: {currentPlaybackData.noteId}</p>
                      </div>
                    </div>
                    {currentPlayback && (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(currentPlayback.status)}`}>
                        {currentPlayback.status === 'normal' ? '正常' : currentPlayback.status === 'pending_review' ? '待复核' : '已修改'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {currentPlaybackData.thresholds.map((threshold, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${
                          !threshold.isConsistent
                            ? 'bg-orange-50 border-orange-200'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700">{threshold.metricName}</span>
                          {!threshold.isConsistent && (
                            <span className="flex items-center gap-1 text-orange-600 text-xs font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              阈值与报告值不一致
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">实际阈值：</span>
                            <span className={`font-mono ${!threshold.isConsistent ? 'text-orange-600 font-semibold' : 'text-gray-700'}`}>
                              {threshold.thresholdValue}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">报告值：</span>
                            <span className={`font-mono ${!threshold.isConsistent ? 'text-gray-600 line-through' : 'text-gray-700'}`}>
                              {threshold.reportValue}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {currentPlayback?.remark && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-500">备注：{currentPlayback.remark}</p>
                    </div>
                  )}
                </div>

                {currentPlaybackData.thresholds.some(t => !t.isConsistent) && (
                  <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-orange-800">检测到不一致项</p>
                        <p className="text-sm text-orange-600 mt-1">
                          存在阈值已修改但报告仍写旧值的情况，系统已标记为"待复核"状态，将提交给数据科学家审核，不会自动归入正常。
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {currentWorkflowStep === 'bucket' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 font-display mb-2">
                第二步：补看线上实验桶
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                关联对应的线上实验桶，方便后续点击回溯查看原始实验数据
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">实验桶名称</label>
                <input
                  type="text"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value)}
                  placeholder="如：实验桶A-CTR优化"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">实验桶链接</label>
                <input
                  type="text"
                  value={bucketUrl}
                  onChange={(e) => setBucketUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                />
              </div>
            </div>

            <button
              onClick={handleAddBucket}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加实验桶
            </button>

            {currentBuckets.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">已关联的实验桶</h3>
                <div className="space-y-2">
                  {currentBuckets.map((bucket) => (
                    <div
                      key={bucket.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <Link2 className="w-5 h-5 text-primary-500" />
                        <div>
                          <p className="font-medium text-gray-800">{bucket.bucketName}</p>
                          <a
                            href={bucket.bucketUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary-600 hover:underline"
                          >
                            {bucket.bucketUrl}
                          </a>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {bucket.addedBy} · {bucket.addedAt}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {currentWorkflowStep === 'metric' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 font-display mb-2">
                第三步：分层指标更新
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                记录各分层的指标变更情况，异常项将高亮标记待复核
              </p>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">分层名称</label>
                <input
                  type="text"
                  value={layerName}
                  onChange={(e) => setLayerName(e.target.value)}
                  placeholder="如：首屏"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">指标名称</label>
                <input
                  type="text"
                  value={metricName}
                  onChange={(e) => setMetricName(e.target.value)}
                  placeholder="如：CTR"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">原值</label>
                <input
                  type="number"
                  step="0.001"
                  value={oldValue}
                  onChange={(e) => setOldValue(e.target.value)}
                  placeholder="0.045"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">新值</label>
                <input
                  type="number"
                  step="0.001"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="0.05"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                />
              </div>
            </div>

            <button
              onClick={handleAddMetric}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加到列表
            </button>

            {(metricsList.length > 0 || currentMetrics.length > 0) && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">分层指标列表</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">分层</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">指标</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">原值</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">新值</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">变化</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {currentMetrics.map((metric) => (
                        <tr key={metric.id} className="bg-green-50">
                          <td className="px-4 py-3 text-sm text-gray-700">{metric.layerName}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{metric.metricName}</td>
                          <td className="px-4 py-3 text-sm text-right font-mono text-gray-600">{metric.oldValue}</td>
                          <td className="px-4 py-3 text-sm text-right font-mono text-gray-800 font-medium">{metric.newValue}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            <span className="text-green-600 font-medium">
                              {((metric.newValue - metric.oldValue) / metric.oldValue * 100).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs text-green-600">已保存</span>
                          </td>
                        </tr>
                      ))}
                      {metricsList.map((metric, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm text-gray-700">{metric.layerName}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{metric.metricName}</td>
                          <td className="px-4 py-3 text-sm text-right font-mono text-gray-600">{metric.oldValue}</td>
                          <td className="px-4 py-3 text-sm text-right font-mono text-gray-800 font-medium">{metric.newValue}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            <span className={metric.newValue >= metric.oldValue ? 'text-green-600' : 'text-red-600'}>
                              {((metric.newValue - metric.oldValue) / metric.oldValue * 100).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleRemoveMetric(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {metricsList.length > 0 && (
              <button
                onClick={handleSubmitMetrics}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <Check className="w-5 h-5" />
                提交分层指标更新
              </button>
            )}
          </div>
        )}

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={goToPrevStep}
            disabled={currentStepIndex === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              currentStepIndex === 0
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            上一步
          </button>

          {currentStepIndex < steps.length - 1 ? (
            <button
              onClick={goToNextStep}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              下一步
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => {
                addToast('success', '工作流已完成！可在回放列表中查看详情');
                navigate('/playbacks');
              }}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <Check className="w-5 h-5" />
              完成
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
