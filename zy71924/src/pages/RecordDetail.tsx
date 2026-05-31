import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  MapPin, 
  Tag,
  Info,
  Lightbulb,
  Edit3
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { StatusBadge, SourceBadge } from '../components/StatusBadge';
import StatusUpdateModal from '../components/StatusUpdateModal';
import { RecordStatus } from '../types';
import { getStatusDotColor, getStatusLabel } from '../utils';

const RecordDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { records, updateRecordStatus, currentUser } = useStore();
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  const record = records.find(r => r.id === id);

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Info className="w-16 h-16 text-slate-300 mb-4" />
        <p className="text-slate-500 mb-4">记录不存在</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          返回列表
        </button>
      </div>
    );
  }

  const confirmStatusUpdate = (status: RecordStatus, reason: string) => {
    if (id) {
      updateRecordStatus(id, status, reason);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-white rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Noto Serif SC, serif' }}>
            {record.name}
          </h2>
          <p className="text-slate-500">{record.materialCode}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <StatusBadge status={record.currentStatus} />
          <button
            onClick={() => setStatusModalOpen(true)}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" />
            更新状态
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">基本信息</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Tag className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">材料编号</p>
                    <p className="font-mono text-slate-900">{record.materialCode}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">展墙位置</p>
                    <p className="text-slate-900">{record.location}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Info className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">记录来源</p>
                    <SourceBadge source={record.source} />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">创建人</p>
                    <p className="text-slate-900">{record.createdBy}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">创建时间</p>
                    <p className="text-slate-900">{record.createdAt}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">最后修改人</p>
                    <p className="text-slate-900">{record.updatedBy}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">历史轨迹</h3>
            <div className="relative">
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-200"></div>
              <div className="space-y-6">
                {[...record.versions].reverse().map((version, index) => (
                  <div key={version.id} className="relative pl-10">
                    <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 border-white ${getStatusDotColor(version.status)} flex items-center justify-center`}>
                      <span className="w-2 h-2 bg-white rounded-full"></span>
                    </div>
                    <div className={`p-4 rounded-lg border ${
                      index === 0 ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            version.status === 'normal' ? 'bg-emerald-100 text-emerald-700' :
                            version.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {getStatusLabel(version.status)}
                          </span>
                          <span className="text-sm font-medium text-slate-900">v{version.versionNumber}</span>
                          {index === 0 && (
                            <span className="px-2 py-0.5 text-xs bg-slate-900 text-white rounded">当前版本</span>
                          )}
                        </div>
                        <span className="text-sm text-slate-500">{version.operatedAt}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">{version.operator}</span>
                      </div>
                      <p className="text-sm text-slate-700 mb-3">{version.reason}</p>
                      {version.lightingScheme && (
                        <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                          <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5" />
                          <div>
                            <p className="text-xs text-slate-500 mb-1">灯光方案</p>
                            <p className="text-sm text-slate-700">{version.lightingScheme}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">当前状态</h3>
            <div className="flex items-center gap-3 mb-4">
              <StatusBadge status={record.currentStatus} />
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">版本号</span>
                <span className="text-slate-900 font-medium">v{record.versions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">状态变更次数</span>
                <span className="text-slate-900 font-medium">{record.versions.length - 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">最后更新</span>
                <span className="text-slate-900">{record.updatedAt}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">操作人信息</h3>
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-500 to-slate-600 rounded-full flex items-center justify-center text-white font-medium">
                {currentUser.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-slate-900">{currentUser}</p>
                <p className="text-sm text-slate-500">当前操作用户</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" />
              操作提示
            </h3>
            <ul className="text-sm text-amber-700 space-y-2">
              <li>• 所有状态变更都会被记录到历史轨迹</li>
              <li>• 二次进场的材料不会覆盖历史记录</li>
              <li>• 异常和待处理状态需要填写原因</li>
              <li>• 导出清单前请确认所有记录状态</li>
            </ul>
          </div>
        </div>
      </div>

      <StatusUpdateModal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        onConfirm={confirmStatusUpdate}
        currentStatus={record.currentStatus}
        recordName={record.name}
      />
    </div>
  );
};

export default RecordDetail;
