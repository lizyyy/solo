import { useState, useMemo } from 'react';
import {
  GitCompare,
  ArrowRight,
  Plus,
  Minus,
  Edit,
  Clock,
  FileText,
  Check,
} from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { compareData, getDiffStats, DiffItem } from '../utils/diff';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { StatusBadge } from '../components/common/StatusBadge';

export default function Compare() {
  const { versions, setCurrentVersion } = useDataStore();
  const [version1Id, setVersion1Id] = useState<string>('');
  const [version2Id, setVersion2Id] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('summary');

  const diffResult = useMemo(() => {
    if (!version1Id || !version2Id) return null;
    const v1 = versions.find((v) => v.id === version1Id);
    const v2 = versions.find((v) => v.id === version2Id);
    if (!v1 || !v2) return null;
    return compareData(v1.data, v2.data);
  }, [versions, version1Id, version2Id]);

  const stats = diffResult ? getDiffStats(diffResult) : null;

  const tabs = [
    { key: 'summary', label: '变更摘要' },
    { key: 'parts', label: `声部谱 (${diffResult?.parts.length || 0})` },
    { key: 'musicians', label: `乐手名单 (${diffResult?.musicians.length || 0})` },
    { key: 'revisions', label: `修订页 (${diffResult?.revisions.length || 0})` },
    { key: 'distributions', label: `发放记录 (${diffResult?.distributions.length || 0})` },
  ];

  const getDiffIcon = (type: string) => {
    switch (type) {
      case 'added':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'removed':
        return <Minus className="w-4 h-4 text-red-600" />;
      case 'modified':
        return <Edit className="w-4 h-4 text-yellow-600" />;
      default:
        return <Check className="w-4 h-4 text-gray-400" />;
    }
  };

  const getDiffBg = (type: string) => {
    switch (type) {
      case 'added':
        return 'bg-green-50 border-green-200';
      case 'removed':
        return 'bg-red-50 border-red-200';
      case 'modified':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const renderDiffList = (items: DiffItem[]) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <Check className="w-12 h-12 mx-auto mb-4 text-green-500" />
          <p>没有变更</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg border ${getDiffBg(item.type)}`}
          >
            <div className="flex items-start gap-3">
              {getDiffIcon(item.type)}
              <div className="flex-1">
                <div className="font-medium text-gray-800">{item.field}</div>
                {item.type === 'modified' && (
                  <div className="mt-2 text-sm">
                    <div className="text-red-600 line-through">
                      旧值: {JSON.stringify(item.oldValue).substring(0, 100)}
                    </div>
                    <div className="text-green-600">
                      新值: {JSON.stringify(item.newValue).substring(0, 100)}
                    </div>
                  </div>
                )}
              </div>
              <StatusBadge
                status={
                  item.type === 'added'
                    ? 'success'
                    : item.type === 'removed'
                    ? 'error'
                    : 'warning'
                }
              >
                {item.type === 'added'
                  ? '新增'
                  : item.type === 'removed'
                  ? '删除'
                  : item.type === 'modified'
                  ? '修改'
                  : '不变'}
              </StatusBadge>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (versions.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <GitCompare className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-gray-800 mb-2">版本不足</h2>
        <p className="text-gray-500 mb-8">至少需要2个版本才能进行对比</p>
        <p className="text-sm text-gray-400">当前版本数: {versions.length}</p>
      </div>
    );
  }

  const sortedVersions = [...versions].reverse();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-serif font-bold text-gray-800">变更对比</h2>
        <p className="text-gray-500 mt-1">对比不同版本数据的差异</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-3 gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              旧版本
            </label>
            <select
              value={version1Id}
              onChange={(e) => setVersion1Id(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">请选择</option>
              {sortedVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} - {format(new Date(v.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <ArrowRight className="w-6 h-6 text-primary-600" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              新版本
            </label>
            <select
              value={version2Id}
              onChange={(e) => setVersion2Id(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">请选择</option>
              {sortedVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} - {format(new Date(v.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats.totalChanges}</p>
                <p className="text-sm text-gray-500">总变更</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Plus className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.added}</p>
                <p className="text-sm text-gray-500">新增</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Minus className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.removed}</p>
                <p className="text-sm text-gray-500">删除</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Edit className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{stats.modified}</p>
                <p className="text-sm text-gray-500">修改</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {diffResult && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex border-b overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600 bg-primary-50'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'summary' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-800 mb-4">声部谱变更</h3>
                  {renderDiffList(diffResult.parts.filter((d) => d.type !== 'unchanged'))}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-4">乐手名单变更</h3>
                  {renderDiffList(diffResult.musicians.filter((d) => d.type !== 'unchanged'))}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-4">修订页变更</h3>
                  {renderDiffList(diffResult.revisions.filter((d) => d.type !== 'unchanged'))}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-4">发放记录变更</h3>
                  {renderDiffList(diffResult.distributions.filter((d) => d.type !== 'unchanged'))}
                </div>
              </div>
            )}

            {activeTab === 'parts' && renderDiffList(diffResult.parts)}
            {activeTab === 'musicians' && renderDiffList(diffResult.musicians)}
            {activeTab === 'revisions' && renderDiffList(diffResult.revisions)}
            {activeTab === 'distributions' && renderDiffList(diffResult.distributions)}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">历史版本</h3>
        <div className="space-y-3">
          {sortedVersions.map((version) => (
            <div
              key={version.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              onClick={() => setCurrentVersion(version.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-800">{version.name}</div>
                  <div className="text-sm text-gray-500">
                    {format(new Date(version.createdAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                  </div>
                </div>
              </div>
              {version.description && (
                <span className="text-sm text-gray-500 max-w-md truncate">
                  {version.description}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
