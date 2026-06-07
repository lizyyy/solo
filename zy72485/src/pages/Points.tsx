import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Eye,
  MapPin,
  Package,
  User,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  X,
  FileText,
  Accessibility,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '../store';
import { labelMap } from '../data/mockData';
import type { Point } from '../types';

export default function Points() {
  const { points, updatePointDetourSync, notices, ramps } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);

  const filteredPoints = points.filter(p => {
    const matchesSearch = p.name.includes(searchTerm) || p.location.includes(searchTerm) || p.keepReason.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'pending_review': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'exception': return <XCircle className="w-4 h-4 text-rose-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'tag-emerald';
      case 'warning': return 'tag-amber';
      case 'pending_review': return 'tag-blue';
      case 'exception': return 'tag-rose';
      default: return 'tag-slate';
    }
  };

  const getHandlerIcon = (handler: string) => {
    switch (handler) {
      case 'planner': return '街道规划员小姜';
      case 'resident_rep': return '居民代表';
      case 'admin': return '系统管理员';
      default: return handler;
    }
  };

  const getRelatedNotice = (noticeId?: string) => notices.find(n => n.id === noticeId);
  const getRelatedRamp = (rampId?: string) => ramps.find(r => r.id === rampId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-slate-800">点位清单</h2>
          <p className="text-slate-500 text-sm mt-1">综合查看点位状态、保留原因、缺料情况和责任人</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜索点位名称、位置、保留原因..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          {['all', 'normal', 'warning', 'pending_review', 'exception'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                statusFilter === status
                  ? 'bg-primary text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {status === 'all' ? '全部' : labelMap.pointStatus[status as keyof typeof labelMap.pointStatus]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredPoints.map((point) => (
          <motion.div
            key={point.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-hover p-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-slate-800">{point.name}</h3>
                  <span className={getStatusColor(point.status)}>
                    {labelMap.pointStatus[point.status]}
                  </span>
                  <span className="tag-slate">
                    {labelMap.pointType[point.type]}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mb-3">📍 {point.location}</p>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      保留原因
                    </div>
                    <p className="text-sm text-slate-700">{point.keepReason}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <Package className="w-3.5 h-3.5" />
                      缺料情况
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {point.missingMaterials.length > 0 ? (
                        point.missingMaterials.map((m, i) => (
                          <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                            {m}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-emerald-600">材料齐全</span>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <User className="w-3.5 h-3.5" />
                      下一步责任人
                    </div>
                    <p className="text-sm font-medium text-primary">{getHandlerIcon(point.nextHandler)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
                  {point.noticeId && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <FileText className="w-4 h-4" />
                      <span>关联告示：</span>
                      <span className="text-primary">{getRelatedNotice(point.noticeId)?.title}</span>
                    </div>
                  )}
                  {point.rampId && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Accessibility className="w-4 h-4" />
                      <span>关联坡道：</span>
                      <span className="text-primary">{getRelatedRamp(point.rampId)?.location}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2 ml-4">
                {!point.detourSynced && (
                  <button
                    onClick={() => updatePointDetourSync(point.id, true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    标记已同步
                  </button>
                )}
                <button
                  onClick={() => setSelectedPoint(point)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {selectedPoint && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedPoint(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {getStatusIcon(selectedPoint.status)}
                <h3 className="font-serif text-xl font-semibold text-slate-800">{selectedPoint.name}</h3>
              </div>
              <button
                onClick={() => setSelectedPoint(null)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-500">位置</label>
                  <p className="text-slate-800">{selectedPoint.location}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">状态</label>
                  <p className="text-slate-800">
                    <span className={getStatusColor(selectedPoint.status)}>
                      {labelMap.pointStatus[selectedPoint.status]}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">类型</label>
                  <p className="text-slate-800">{labelMap.pointType[selectedPoint.type]}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">改道已同步</label>
                  <p className="text-slate-800">
                    {selectedPoint.detourSynced ? (
                      <span className="tag-emerald">已同步</span>
                    ) : (
                      <span className="tag-rose">未同步</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl">
                <label className="text-sm text-blue-700 font-medium">保留原因</label>
                <p className="text-blue-800 mt-1">{selectedPoint.keepReason}</p>
              </div>

              <div>
                <label className="text-sm text-slate-500 mb-2 block">缺失材料</label>
                <div className="flex flex-wrap gap-2">
                  {selectedPoint.missingMaterials.length > 0 ? (
                    selectedPoint.missingMaterials.map((m, i) => (
                      <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-sm">
                        {m}
                      </span>
                    ))
                  ) : (
                    <span className="text-emerald-600">✅ 材料齐全</span>
                  )}
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-xl">
                <label className="text-sm text-amber-700 font-medium">下一步责任人</label>
                <p className="text-amber-800 mt-1 font-medium">{getHandlerIcon(selectedPoint.nextHandler)}</p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="text-sm text-slate-500">关联信息</label>
                <div className="mt-2 space-y-2">
                  {selectedPoint.noticeId && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600">施工告示：</span>
                      <span className="text-primary">{getRelatedNotice(selectedPoint.noticeId)?.title}</span>
                    </div>
                  )}
                  {selectedPoint.rampId && (
                    <div className="flex items-center gap-2 text-sm">
                      <Accessibility className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600">坡道记录：</span>
                      <span className="text-primary">{getRelatedRamp(selectedPoint.rampId)?.location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
