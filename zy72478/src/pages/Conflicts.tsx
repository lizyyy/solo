
import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { ConflictRecord, ConflictStatus } from '../../shared/types';

const statusColors: Record<ConflictStatus, string> = {
  pending: 'bg-orange-100 text-orange-700',
  confirmed: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const statusLabels: Record<ConflictStatus, string> = {
  pending: '待处理',
  confirmed: '已确认',
  rejected: '已驳回',
};

export default function Conflicts() {
  const { conflicts, currentProject, resolveConflict, currentUser } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | ConflictStatus>('all');

  const projectConflicts = conflicts.filter((c) => c.projectId === currentProject?.id);
  const filteredConflicts = filter === 'all'
    ? projectConflicts
    : projectConflicts.filter((c) => c.status === filter);

  const pendingCount = projectConflicts.filter((c) => c.status === 'pending').length;
  const confirmedCount = projectConflicts.filter((c) => c.status === 'confirmed').length;
  const rejectedCount = projectConflicts.filter((c) => c.status === 'rejected').length;

  const handleResolve = (id: string, status: 'confirmed' | 'rejected') => {
    resolveConflict(id, status, currentUser);
    setExpandedId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">冲突处理</h1>
        <p className="text-gray-500 mt-1">公交刷卡时段与红线图备注冲突处理</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">全部冲突</p>
              <p className="text-xl font-bold text-gray-800">{projectConflicts.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">待处理</p>
              <p className="text-xl font-bold text-orange-600">{pendingCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已确认</p>
              <p className="text-xl font-bold text-green-600">{confirmedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已驳回</p>
              <p className="text-xl font-bold text-red-600">{rejectedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">冲突列表</h2>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['all', 'pending', 'confirmed', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    filter === f
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f === 'all' ? '全部' : statusLabels[f]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredConflicts.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <p className="text-gray-500">暂无{filter === 'all' ? '' : statusLabels[filter]}冲突</p>
            </div>
          ) : (
            filteredConflicts.map((conflict) => (
              <ConflictItem
                key={conflict.id}
                conflict={conflict}
                isExpanded={expandedId === conflict.id}
                onToggle={() => setExpandedId(expandedId === conflict.id ? null : conflict.id)}
                onResolve={handleResolve}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface ConflictItemProps {
  conflict: ConflictRecord;
  isExpanded: boolean;
  onToggle: () => void;
  onResolve: (id: string, status: 'confirmed' | 'rejected') => void;
}

function ConflictItem({ conflict, isExpanded, onToggle, onResolve }: ConflictItemProps) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            conflict.status === 'pending' ? 'bg-orange-100' :
            conflict.status === 'confirmed' ? 'bg-green-100' : 'bg-red-100'
          }`}>
            <AlertTriangle className={`w-5 h-5 ${
              conflict.status === 'pending' ? 'text-orange-600' :
              conflict.status === 'confirmed' ? 'text-green-600' : 'text-red-600'
            }`} />
          </div>
          <div>
            <h3 className="font-medium text-gray-800">{conflict.description}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              卡号：{conflict.evidence.busSwipe.cardId} · 区域：{conflict.evidence.redlineNote.areaName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[conflict.status]}`}>
            {statusLabels[conflict.status]}
          </span>
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">冲突证据说明</h4>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">{conflict.evidence.contradiction}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <h4 className="font-medium text-gray-800">公交刷卡数据</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">卡号</span>
                  <span className="text-gray-800 font-mono">{conflict.evidence.busSwipe.cardId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">刷卡时间</span>
                  <span className="text-gray-800">{conflict.evidence.busSwipe.swipeTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">线路</span>
                  <span className="text-gray-800">{conflict.evidence.busSwipe.route}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">站点</span>
                  <span className="text-gray-800">{conflict.evidence.busSwipe.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">数据来源</span>
                  <span className="text-gray-800">{
                    conflict.evidence.busSwipe.source === 'normal' ? '正常口径' :
                    conflict.evidence.busSwipe.source === 'wrong' ? '错口径' : '补录数据'
                  }</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-green-600" />
                <h4 className="font-medium text-gray-800">红线图备注</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">区域名称</span>
                  <span className="text-gray-800">{conflict.evidence.redlineNote.areaName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">记录日期</span>
                  <span className="text-gray-800">{conflict.evidence.redlineNote.recordDate}</span>
                </div>
                <div className="pt-2">
                  <span className="text-gray-500 block mb-1">备注内容</span>
                  <p className="text-gray-800 bg-white p-2 rounded border border-gray-200">
                    {conflict.evidence.redlineNote.remark}
                  </p>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">数据来源</span>
                  <span className="text-gray-800">{
                    conflict.evidence.redlineNote.source === 'normal' ? '正常口径' :
                    conflict.evidence.redlineNote.source === 'wrong' ? '错口径' : '补录数据'
                  }</span>
                </div>
              </div>
            </div>
          </div>

          {conflict.status === 'pending' && (
            <div className="flex items-center justify-end gap-3">
              <p className="text-sm text-gray-500 mr-2">请周姐选择：</p>
              <button
                onClick={() => onResolve(conflict.id, 'rejected')}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                驳回（以红线图为准）
              </button>
              <button
                onClick={() => onResolve(conflict.id, 'confirmed')}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                确认（以刷卡数据为准）
              </button>
            </div>
          )}

          {conflict.status !== 'pending' && (
            <div className="flex items-center justify-end text-sm text-gray-500">
              <span>处理人：{conflict.resolvedBy}</span>
              <span className="mx-2">·</span>
              <span>处理时间：{conflict.resolvedAt}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
