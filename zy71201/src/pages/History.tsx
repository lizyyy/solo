import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  User,
  FileText,
  Upload,
  Edit,
  Download,
  GitCompare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import type { OperationType } from '../types';

const operationIcons: Record<OperationType, React.ElementType> = {
  create: FileText,
  update: Edit,
  import: Upload,
  export: Download,
};

const operationLabels: Record<OperationType, string> = {
  create: '创建',
  update: '更新',
  import: '导入',
  export: '导出',
};

const operationColors: Record<OperationType, string> = {
  create: 'bg-success/10 text-success',
  update: 'bg-info/10 text-info',
  import: 'bg-warning/10 text-warning',
  export: 'bg-navy-500/10 text-navy-600',
};

export default function History() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const product = useStore((state) => state.getProductById(id || ''));
  const versionHistory = useStore((state) => state.versionHistory);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);

  const history = id ? versionHistory[id] || [] : [];

  if (!product) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">产品不存在</p>
        </div>
      </div>
    );
  }

  const toggleVersion = (versionId: string) => {
    if (compareMode) {
      setSelectedVersions((prev) => {
        if (prev.includes(versionId)) {
          return prev.filter((v) => v !== versionId);
        }
        if (prev.length >= 2) {
          return [prev[1], versionId];
        }
        return [...prev, versionId];
      });
    } else {
      setExpandedId(expandedId === versionId ? null : versionId);
    }
  };

  const getVersionById = (versionId: string) => {
    return history.find((v) => v.id === versionId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/product/${id}`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">历史记录 - {product.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              共 {history.length} 条版本记录
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              setSelectedVersions([]);
              setExpandedId(null);
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              compareMode
                ? 'bg-navy-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            <GitCompare className="w-4 h-4" />
            {compareMode ? '取消对比' : '版本对比'}
          </button>
          <Link
            to="/"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            返回列表
          </Link>
        </div>
      </div>

      {compareMode && (
        <div className="bg-navy-50 border border-navy-200 rounded-lg p-4">
          <p className="text-sm text-navy-700">
            {selectedVersions.length === 0
              ? '请选择两个版本进行对比'
              : selectedVersions.length === 1
              ? '请再选择一个版本'
              : `已选择 ${selectedVersions.length} 个版本，点击下方查看对比`}
          </p>
          {selectedVersions.length === 2 && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-navy-200">
              <h4 className="font-medium text-gray-800 mb-3">版本对比结果</h4>
              <div className="grid grid-cols-2 gap-4">
                {selectedVersions.map((vid) => {
                  const v = getVersionById(vid);
                  return (
                    <div key={vid} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-navy-700">
                          {v?.versionNumber}
                        </span>
                        <span className="text-xs text-gray-500">
                          {v?.operationType === 'update' ? '更新' : v?.operationType}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{v?.diffSummary}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(v?.createdAt || '').toLocaleString('zh-CN')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">版本时间线</h3>
        </div>

        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="divide-y divide-gray-100">
            {history.map((record, index) => {
              const Icon = operationIcons[record.operationType];
              const isExpanded = expandedId === record.id;
              const isSelected = selectedVersions.includes(record.id);

              return (
                <div
                  key={record.id}
                  className={cn(
                    'relative pl-16 pr-6 py-4 transition-colors',
                    compareMode && isSelected ? 'bg-navy-50' : 'hover:bg-gray-50',
                    index === history.length - 1 ? '' : ''
                  )}
                >
                  <div
                    className={cn(
                      'absolute left-6 w-5 h-5 rounded-full border-4 flex items-center justify-center',
                      compareMode && isSelected ? 'border-navy-500 bg-navy-500' : 'border-white bg-gray-400'
                    )}
                  />

                  <div
                    className="cursor-pointer"
                    onClick={() => toggleVersion(record.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'p-2 rounded-lg',
                            operationColors[record.operationType]
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">
                              {record.versionNumber}
                            </span>
                            <span
                              className={cn(
                                'px-2 py-0.5 text-xs rounded-full',
                                operationColors[record.operationType]
                              )}
                            >
                              {operationLabels[record.operationType]}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {record.diffSummary}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {record.operator}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(record.createdAt).toLocaleString('zh-CN')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {!compareMode && (
                        <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      )}
                    </div>

                    {!compareMode && isExpanded && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">
                              变更前
                            </h5>
                            <pre className="p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                              {JSON.stringify(record.beforeData, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">
                              变更后
                            </h5>
                            <pre className="p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                              {JSON.stringify(record.afterData, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {history.length === 0 && (
            <div className="py-12 text-center">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">暂无历史记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
