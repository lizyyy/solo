import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Eye,
  History,
  Accessibility,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useAppStore } from '../store';
import { labelMap } from '../data/mockData';
import type { RampRecord } from '../types';

export default function Ramps() {
  const { ramps, notices } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRamp, setSelectedRamp] = useState<RampRecord | null>(null);

  const filteredRamps = ramps.filter(r =>
    r.location.includes(searchTerm) ||
    r.remark.includes(searchTerm)
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'tag-emerald';
      case 'under_maintenance': return 'tag-amber';
      case 'closed': return 'tag-rose';
      default: return 'tag-slate';
    }
  };

  const getRelatedNotice = (noticeId?: string) => {
    return notices.find(n => n.id === noticeId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-slate-800">无障碍坡道记录</h2>
          <p className="text-slate-500 text-sm mt-1">管理坡道记录、关联施工告示和历史追踪</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          补录坡道
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{ramps.filter(r => r.status === 'normal').length}</p>
              <p className="text-sm text-slate-500">正常</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{ramps.filter(r => r.status === 'under_maintenance').length}</p>
              <p className="text-sm text-slate-500">维护中</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
              <X className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{ramps.filter(r => r.status === 'closed').length}</p>
              <p className="text-sm text-slate-500">已关闭</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Accessibility className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{ramps.filter(r => r.relatedNoticeId).length}</p>
              <p className="text-sm text-slate-500">已关联告示</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索坡道位置、备注..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">位置</th>
                <th className="table-header">类型</th>
                <th className="table-header">坡度</th>
                <th className="table-header">宽度</th>
                <th className="table-header">扶手</th>
                <th className="table-header">关联告示</th>
                <th className="table-header">状态</th>
                <th className="table-header">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRamps.map((ramp) => {
                const relatedNotice = getRelatedNotice(ramp.relatedNoticeId);
                return (
                  <tr key={ramp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="table-cell font-medium text-slate-800">{ramp.location}</td>
                    <td className="table-cell"><span className="tag-slate">{labelMap.rampType[ramp.rampType]}</span></td>
                    <td className="table-cell text-slate-600">{ramp.slope}</td>
                    <td className="table-cell text-slate-600">{ramp.width}</td>
                    <td className="table-cell">
                      {ramp.hasHandrail ? (
                        <span className="tag-emerald">有</span>
                      ) : (
                        <span className="tag-slate">无</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {relatedNotice ? (
                        <span className="text-sm text-primary truncate max-w-32 block">{relatedNotice.title}</span>
                      ) : (
                        <span className="text-slate-400 text-sm">未关联</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className={getStatusColor(ramp.status)}>
                        {labelMap.rampStatus[ramp.status]}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedRamp(ramp)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-primary"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-primary">
                          <History className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRamp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedRamp(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl font-semibold text-slate-800">坡道详情</h3>
              <button
                onClick={() => setSelectedRamp(null)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm text-slate-500">位置</label>
                  <p className="text-slate-800 font-medium">{selectedRamp.location}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">类型</label>
                  <p className="text-slate-800">{labelMap.rampType[selectedRamp.rampType]}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">状态</label>
                  <p className="text-slate-800">
                    <span className={getStatusColor(selectedRamp.status)}>
                      {labelMap.rampStatus[selectedRamp.status]}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">坡度</label>
                  <p className="text-slate-800">{selectedRamp.slope}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">宽度</label>
                  <p className="text-slate-800">{selectedRamp.width}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">扶手</label>
                  <p className="text-slate-800">{selectedRamp.hasHandrail ? '有' : '无'}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">关联施工告示</label>
                  <p className="text-slate-800">
                    {getRelatedNotice(selectedRamp.relatedNoticeId)?.title || '未关联'}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-500">备注</label>
                <p className="text-slate-700 bg-slate-50 p-3 rounded-lg mt-1">
                  {selectedRamp.remark || '暂无备注'}
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
