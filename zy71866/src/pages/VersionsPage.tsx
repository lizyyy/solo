import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, 
  ArrowRight, 
  Plus, 
  Minus, 
  Edit3,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Eye
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { formatChangeDescription } from '@/utils/versionComparator';
import { ChangeItem } from '@/types';

export default function VersionsPage() {
  const navigate = useNavigate();
  const { versionHistory, currentPack, changes, clearChanges } = useStore();
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [selectedCompare, setSelectedCompare] = useState<number>(0);

  if (!currentPack || versionHistory.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <Clock className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-medium text-slate-600">暂无版本历史</h2>
          <p className="text-slate-500 mt-2">请先导入材料包</p>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary mt-6"
          >
            前往导入
          </button>
        </div>
      </div>
    );
  }

  const getChangeIcon = (type: ChangeItem['type']) => {
    switch (type) {
      case 'added': return Plus;
      case 'removed': return Minus;
      case 'modified': return Edit3;
    }
  };

  const getChangeColor = (type: ChangeItem['type']) => {
    switch (type) {
      case 'added': return 'text-success-600 bg-success-50';
      case 'removed': return 'text-warning-600 bg-warning-50';
      case 'modified': return 'text-pending-600 bg-pending-50';
    }
  };

  const getChangeLabel = (type: ChangeItem['type']) => {
    switch (type) {
      case 'added': return '新增';
      case 'removed': return '删除';
      case 'modified': return '修改';
    }
  };

  const significantFields = ['score', 'studentAnswer', 'knowledgePoint'];
  const hasSignificantChanges = changes.some(c => 
    c.type !== 'modified' || significantFields.includes(c.field || '')
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">版本对比</h1>
        <p className="text-slate-500 mt-1">查看材料包的版本历史和变更记录</p>
      </div>

      {hasSignificantChanges && (
        <div className="mb-6 p-4 bg-warning-50 border border-warning-200 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-warning-800">检测到重要变更</p>
              <p className="text-sm text-warning-600 mt-1">
                当前版本与上一版本相比存在 {changes.filter(c => 
                  c.type !== 'modified' || significantFields.includes(c.field || '')
                ).length} 处重要变更，请仔细核对
              </p>
            </div>
            <button
              onClick={clearChanges}
              className="ml-auto text-sm text-warning-600 hover:text-warning-800"
            >
              清除提醒
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="font-medium">版本时间线</h3>
            </div>
            <div className="card-body">
              <div className="space-y-0">
                {[...versionHistory].reverse().map((pack, index) => {
                  const realIndex = versionHistory.length - 1 - index;
                  const isExpanded = expandedVersion === realIndex;
                  const isCurrent = pack.id === currentPack.id;
                  
                  return (
                    <div key={pack.id} className="relative">
                      {index < versionHistory.length - 1 && (
                        <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-slate-200" />
                      )}
                      <div className="relative pl-16 pb-6">
                        <div className={`absolute left-0 top-1 w-12 h-12 rounded-full flex items-center justify-center ${
                          isCurrent 
                            ? 'bg-primary-500 text-white' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          <span className="font-bold text-sm">v{pack.version}</span>
                        </div>
                        <div className={`p-4 rounded-xl ${
                          isCurrent ? 'bg-primary-50 border border-primary-200' : 'bg-slate-50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-slate-800">{pack.name}</p>
                              <p className="text-sm text-slate-500">{pack.createdAt}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">
                                {pack.records.length} 条记录
                              </span>
                              {isCurrent && (
                                <span className="text-xs bg-primary-500 text-white px-2 py-0.5 rounded-full">
                                  当前
                                </span>
                              )}
                            </div>
                          </div>
                          {realIndex < versionHistory.length - 1 && (
                            <button
                              onClick={() => setSelectedCompare(realIndex)}
                              className="mt-3 text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                            >
                              <ArrowRight className="w-4 h-4" />
                              与此版本对比
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {changes.length > 0 && (
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-500" />
                  <h3 className="font-medium">
                    v{versionHistory[selectedCompare]?.version} → v{currentPack.version}
                  </h3>
                </div>
                <span className="text-sm text-slate-500">
                  {changes.length} 处变更
                </span>
              </div>
              <div className="card-body space-y-3">
                {changes.map((change, index) => {
                  const Icon = getChangeIcon(change.type);
                  const description = formatChangeDescription(change, currentPack.records);
                  const isSignificant = change.type !== 'modified' || 
                    significantFields.includes(change.field || '');
                  
                  return (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg border ${
                        isSignificant ? 'border-pending-200 bg-pending-50/50' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${getChangeColor(change.type)}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${getChangeColor(change.type)}`}>
                              {getChangeLabel(change.type)}
                            </span>
                            {isSignificant && (
                              <span className="text-xs text-pending-600 bg-pending-100 px-2 py-0.5 rounded">
                                重要
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 mt-1">{description}</p>
                          {change.type === 'modified' && change.field && (
                            <div className="mt-2 flex items-center gap-2 text-xs">
                              <span className="text-slate-500">{change.field}:</span>
                              <span className="text-warning-600 line-through">
                                {String(change.oldValue)}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className="text-success-600">
                                {String(change.newValue)}
                              </span>
                            </div>
                          )}
                        </div>
                        {change.type === 'modified' && (
                          <button
                            onClick={() => navigate(`/trace/${change.recordId}`)}
                            className="p-1.5 hover:bg-slate-200 rounded"
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4 text-slate-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h3 className="font-medium">变更类型统计</h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-success-50 rounded-xl">
                  <Plus className="w-6 h-6 text-success-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-success-600">
                    {changes.filter(c => c.type === 'added').length}
                  </p>
                  <p className="text-sm text-success-700">新增</p>
                </div>
                <div className="text-center p-4 bg-warning-50 rounded-xl">
                  <Minus className="w-6 h-6 text-warning-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-warning-600">
                    {changes.filter(c => c.type === 'removed').length}
                  </p>
                  <p className="text-sm text-warning-700">删除</p>
                </div>
                <div className="text-center p-4 bg-pending-50 rounded-xl">
                  <Edit3 className="w-6 h-6 text-pending-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-pending-600">
                    {changes.filter(c => c.type === 'modified').length}
                  </p>
                  <p className="text-sm text-pending-700">修改</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="font-medium">版本对比说明</h3>
            </div>
            <div className="card-body space-y-3 text-sm text-slate-600">
              <p>• <span className="text-success-600 font-medium">新增</span>: 记录在新版本中新增</p>
              <p>• <span className="text-warning-600 font-medium">删除</span>: 记录在新版本中被移除</p>
              <p>• <span className="text-pending-600 font-medium">修改</span>: 记录字段发生变更</p>
              <p>• <span className="text-pending-600 font-medium">重要标记</span>: 分数、答案、知识点等关键字段变更</p>
              <p className="text-slate-500 mt-4">
                点击记录右侧的眼睛图标可以查看该记录的详细溯源信息
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
