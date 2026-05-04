import React, { useState } from 'react';
import { History, Trash2, FolderOpen, Plus, FileJson, FileText } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { SavedExperiment } from '../types';

const SavedExperiments: React.FC = () => {
  const {
    savedExperiments,
    currentExperiment,
    setCurrentExperiment,
    setCurrentResult,
    removeSavedExperiment,
    setActiveTab,
  } = useAppStore();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const loadExperiment = (experiment: SavedExperiment) => {
    setCurrentExperiment(experiment.config);
    setCurrentResult(experiment.result || null);
    setActiveTab('config');
  };

  const handleDelete = (id: string) => {
    removeSavedExperiment(id);
    if (currentExperiment?.id === id) {
      setCurrentExperiment(null);
      setCurrentResult(null);
    }
    setShowDeleteConfirm(null);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getWinnerBadge = (experiment: SavedExperiment) => {
    if (!experiment.result) return null;
    
    const winner = experiment.result.comparison.overallWinner;
    const colors = {
      bplus: 'bg-primary-100 text-primary-800',
      hash: 'bg-accent-100 text-accent-800',
      tie: 'bg-gray-100 text-gray-800',
    };
    const labels = {
      bplus: 'B+ 树',
      hash: '哈希',
      tie: '平局',
    };

    return (
      <span className={`badge ${colors[winner]}`}>
        {labels[winner]}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">历史实验</h2>
            </div>
            <span className="text-xs text-gray-500">
              {savedExperiments.length} 个实验
            </span>
          </div>
        </div>

        <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
          {savedExperiments.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <FolderOpen className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">暂无保存的实验</p>
              <p className="text-xs text-gray-400 mt-1">创建实验后会自动保存到这里</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {savedExperiments
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((experiment) => (
                  <div
                    key={experiment.id}
                    className={`p-4 hover:bg-gray-50 transition-colors group ${
                      currentExperiment?.id === experiment.id
                        ? 'bg-primary-50 border-l-4 border-primary-500'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => loadExperiment(experiment)}
                      >
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-gray-900 truncate">
                            {experiment.name}
                          </h3>
                          {getWinnerBadge(experiment)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(experiment.createdAt)}
                        </p>
                        <div className="flex items-center space-x-3 mt-2 text-xs text-gray-400">
                          <span className="flex items-center space-x-1">
                            <FileText className="w-3 h-3" />
                            <span>{experiment.config.dataSize} 条数据</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <FileJson className="w-3 h-3" />
                            <span>{experiment.config.queries.length} 个查询</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 ml-2">
                        {showDeleteConfirm === experiment.id ? (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleDelete(experiment.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium"
                            >
                              确认
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(null)}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg text-xs"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(experiment.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            title="删除实验"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SavedExperiments;
