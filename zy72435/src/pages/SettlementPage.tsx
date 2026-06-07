import React from 'react';
import {
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  ArrowLeft,
  Users,
  Music,
  Download,
  AlertTriangle,
  CheckSquare,
} from 'lucide-react';
import { useAppStore } from '../store/AppStore';
import type { NextStepOwner, ComplianceCheck } from '../types';

export const SettlementPage: React.FC = () => {
  const {
    setCurrentPage,
    previousPage,
    generateSettlementDetails,
  } = useAppStore();

  const settlementItems = generateSettlementDetails();

  const getOwnerName = (owner: NextStepOwner) => {
    switch (owner) {
      case 'tour_coordinator': return '巡演统筹阿梅';
      case 'ticket_staff': return '票务同事';
      case 'legal': return '法务同事';
      case 'artist_management': return '经纪人团队';
    }
  };

  const getStatusConfig = (check: ComplianceCheck) => {
    if (check.status === 'compliant') {
      if (check.missingMaterials.length === 0) {
        return { label: '可分账', color: 'bg-success-100 text-success-700', icon: <CheckCircle size={14} /> };
      }
      return { label: '分账进行中', color: 'bg-blue-100 text-blue-700', icon: <Clock size={14} /> };
    }
    if (check.status === 'non_compliant') {
      return { label: '暂缓分账', color: 'bg-danger-100 text-danger-700', icon: <XCircle size={14} /> };
    }
    return { label: '待确认', color: 'bg-warning-100 text-warning-700', icon: <AlertTriangle size={14} /> };
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('zh-CN');
  };

  const stats = {
    total: settlementItems.length,
    ready: settlementItems.filter(c => c.status === 'compliant' && c.missingMaterials.length === 0).length,
    inProgress: settlementItems.filter(c => c.status === 'compliant' && c.missingMaterials.length > 0).length,
    blocked: settlementItems.filter(c => c.status !== 'compliant').length,
  };

  const handleExport = () => {
    alert('分账明细已导出为 Excel 文件');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {previousPage && (
            <button
              onClick={() => {
                if (previousPage) {
                  setCurrentPage(previousPage);
                }
              }}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-slate-800">分账明细</h2>
            <p className="text-slate-500 mt-1">清晰说明每首歌的分账状态、缺什么材料、该找谁</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
        >
          <Download size={16} />
          导出分账报告
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">总分账项</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">可分账</p>
          <p className="text-2xl font-bold text-success-600 mt-1">{stats.ready}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">进行中</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.inProgress}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">暂缓/受阻</p>
          <p className="text-2xl font-bold text-warning-600 mt-1">{stats.blocked}</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <FileText className="text-primary-600 flex-shrink-0 mt-0.5" size={24} />
          <div>
            <h3 className="text-sm font-semibold text-primary-800 mb-1">分账报告说明</h3>
            <p className="text-sm text-primary-700">
              本报告不是冷冰冰的系统日志。每一项都清晰说明了：<strong>为什么被留下</strong>、
              <strong>还缺什么材料</strong>、<strong>下一步该找谁</strong>。
              所有变更都有完整的操作历史可追溯。
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {settlementItems.map(item => {
          const statusConfig = getStatusConfig(item);
          return (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center">
                      <Music size={24} className="text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 text-lg">{item.songName}</h3>
                      <p className="text-sm text-slate-500">{item.artist}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.color}`}>
                    {statusConfig.icon}
                    {statusConfig.label}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {item.keptReason && (
                    <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckSquare size={16} className="text-success-600" />
                        <span className="text-sm font-medium text-success-800">为什么被留下</span>
                      </div>
                      <p className="text-sm text-success-700">{item.keptReason}</p>
                    </div>
                  )}

                  <div className={`rounded-lg p-4 ${
                    item.missingMaterials.length > 0
                      ? 'bg-warning-50 border border-warning-200'
                      : 'bg-slate-50 border border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={16} className={item.missingMaterials.length > 0 ? 'text-warning-600' : 'text-slate-500'} />
                      <span className={`text-sm font-medium ${item.missingMaterials.length > 0 ? 'text-warning-800' : 'text-slate-700'}`}>
                        还缺什么材料
                      </span>
                    </div>
                    {item.missingMaterials.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {item.missingMaterials.map((material, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-white text-warning-700 px-2 py-1 rounded border border-warning-300"
                          >
                            {material}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">材料齐全，无缺失</p>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={16} className="text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">下一步该找谁</span>
                    </div>
                    <p className="text-sm font-medium text-blue-700 mb-1">{getOwnerName(item.nextStepOwner)}</p>
                    <p className="text-sm text-blue-600">{item.nextStep || '暂无下一步安排'}</p>
                  </div>
                </div>

                {item.issues.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-slate-700 mb-2">存在的问题:</p>
                    <div className="space-y-1.5">
                      {item.issues.map(issue => (
                        <div
                          key={issue.id}
                          className={`text-sm px-3 py-2 rounded-lg ${
                            issue.severity === 'high'
                              ? 'bg-danger-50 text-danger-700'
                              : issue.severity === 'medium'
                              ? 'bg-warning-50 text-warning-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          <span className="font-medium">
                            [{issue.severity === 'high' ? '高' : issue.severity === 'medium' ? '中' : '低'}]
                          </span>{' '}
                          {issue.description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    最后更新: {formatDate(item.updatedAt)}
                  </p>
                  <div className="flex items-center gap-3">
                    {item.isSubstitute && !item.substituteVerified && (
                      <span className="text-xs bg-warning-100 text-warning-700 px-2 py-1 rounded">
                        ⚠️ 临时替补待票务复核
                      </span>
                    )}
                    <button
                      onClick={() => setCurrentPage('compliance_check')}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      查看合规详情 →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {settlementItems.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <FileText size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">暂无分账明细</p>
            <p className="text-sm text-slate-400 mt-1">完成合规检查后，分账明细将自动生成</p>
            <button
              onClick={() => setCurrentPage('compliance_check')}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
            >
              去做合规检查
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
