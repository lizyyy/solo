import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Upload,
  Search,
  Eye,
  History,
  X,
  Check,
  AlertCircle,
  FileText,
  Calendar,
  MapPin,
} from 'lucide-react';
import { useAppStore } from '../store';
import { labelMap } from '../data/mockData';
import type { ConstructionNotice } from '../types';

export default function Notices() {
  const { notices, importNotices, updateNotice, getNoticeVersions, noticeVersions, importResult } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<ConstructionNotice | null>(null);
  const [showVersionCompare, setShowVersionCompare] = useState(false);
  const [editRemark, setEditRemark] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const filteredNotices = notices.filter(n =>
    n.title.includes(searchTerm) ||
    n.noticeNo.includes(searchTerm) ||
    n.location.includes(searchTerm)
  );

  const handleSimulateImport = () => {
    const testData = [
      { title: '滨江步道翻新工程', noticeNo: 'SG-2024-006', location: '滨江步道 1-5 号', constructionType: 'road' as const, startDate: '2024-07-01', endDate: '2024-08-30', status: 'draft' as const },
      { title: '滨江东路人行道改造工程', noticeNo: 'SG-2024-001', location: '滨江东路 1-3 号段', constructionType: 'road' as const, startDate: '2024-06-10', endDate: '2024-07-20', status: 'active' as const },
      { title: '滨水公园二期坡道', noticeNo: 'SG-2024-007', location: '滨水公园北入口', constructionType: 'ramp' as const, startDate: '2024-07-15', endDate: '2024-07-31', status: 'draft' as const },
    ];
    importNotices(testData);
  };

  const handleViewDetail = (notice: ConstructionNotice) => {
    setSelectedNotice(notice);
    setEditRemark(notice.remark || '');
    setIsEditing(false);
    setShowDetailModal(true);
  };

  const handleSaveRemark = () => {
    if (selectedNotice) {
      updateNotice(selectedNotice.id, { remark: editRemark }, '修改备注信息');
      setSelectedNotice({ ...selectedNotice, remark: editRemark });
      setIsEditing(false);
    }
  };

  const versions = selectedNotice ? getNoticeVersions(selectedNotice.id) : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'tag-blue';
      case 'completed': return 'tag-emerald';
      case 'cancelled': return 'tag-slate';
      default: return 'tag-amber';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-slate-800">施工告示管理</h2>
          <p className="text-slate-500 text-sm mt-1">管理施工告示导入、去重和版本追踪</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            批量导入
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            新增告示
          </button>
        </div>
      </div>

      {importResult && (importResult.duplicate > 0 || importResult.success > 0) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className={`p-4 rounded-xl ${importResult.duplicate > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}
        >
          <div className="flex items-center gap-3">
            {importResult.duplicate > 0 ? (
              <AlertCircle className="w-5 h-5 text-amber-600" />
            ) : (
              <Check className="w-5 h-5 text-emerald-600" />
            )}
            <div>
              <p className={`font-medium ${importResult.duplicate > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                导入完成：成功 {importResult.success} 条，重复 {importResult.duplicate} 条
              </p>
              {importResult.duplicateItems.length > 0 && (
                <p className="text-sm text-amber-700 mt-1">
                  重复条目已自动跳过：{importResult.duplicateItems.join('、')}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <div className="card">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索告示标题、编号、位置..."
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
                <th className="table-header">告示编号</th>
                <th className="table-header">标题</th>
                <th className="table-header">类型</th>
                <th className="table-header">位置</th>
                <th className="table-header">起止日期</th>
                <th className="table-header">状态</th>
                <th className="table-header">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotices.map((notice) => (
                <tr key={notice.id} className="hover:bg-slate-50 transition-colors">
                  <td className="table-cell font-mono text-xs text-slate-500">{notice.noticeNo}</td>
                  <td className="table-cell font-medium text-slate-800">{notice.title}</td>
                  <td className="table-cell"><span className="tag-slate">{labelMap.constructionType[notice.constructionType]}</span></td>
                  <td className="table-cell text-slate-600">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {notice.location}
                    </div>
                  </td>
                  <td className="table-cell text-slate-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {notice.startDate} ~ {notice.endDate}
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={getStatusColor(notice.status)}>
                      {labelMap.noticeStatus[notice.status]}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetail(notice)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-primary"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedNotice(notice);
                          setShowVersionCompare(true);
                        }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-primary"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showImportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowImportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-xl font-semibold text-slate-800">导入施工告示</h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center mb-6 hover:border-primary/40 transition-colors">
                <Upload className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 mb-1">拖拽文件到此处，或点击上传</p>
                <p className="text-sm text-slate-400">支持 Excel、CSV 格式</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl mb-6">
                <p className="text-sm text-slate-600 mb-2">💡 系统将自动检测重复条目</p>
                <ul className="text-xs text-slate-500 space-y-1">
                  <li>• 基于标题、编号、位置生成唯一标识</li>
                  <li>• 重复条目不会重复计数</li>
                  <li>• 导入后可查看导入结果报告</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    handleSimulateImport();
                    setShowImportModal(false);
                  }}
                  className="btn-primary"
                >
                  模拟导入（演示）
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDetailModal && selectedNotice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-xl font-semibold text-slate-800">告示详情</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-500">告示编号</label>
                    <p className="font-mono text-slate-800">{selectedNotice.noticeNo}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">类型</label>
                    <p className="text-slate-800">{labelMap.constructionType[selectedNotice.constructionType]}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm text-slate-500">标题</label>
                    <p className="text-slate-800 font-medium">{selectedNotice.title}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm text-slate-500">位置</label>
                    <p className="text-slate-800">{selectedNotice.location}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">开始日期</label>
                    <p className="text-slate-800">{selectedNotice.startDate}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">结束日期</label>
                    <p className="text-slate-800">{selectedNotice.endDate}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm text-slate-500">描述</label>
                    <p className="text-slate-800">{selectedNotice.description}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-slate-500">备注</label>
                    {!isEditing ? (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-sm text-primary hover:text-primary-600"
                      >
                        编辑
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditRemark(selectedNotice.remark || '');
                            setIsEditing(false);
                          }}
                          className="text-sm text-slate-500 hover:text-slate-700"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleSaveRemark}
                          className="text-sm text-primary hover:text-primary-600"
                        >
                          保存
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <textarea
                      value={editRemark}
                      onChange={(e) => setEditRemark(e.target.value)}
                      className="input-field resize-none h-20"
                      placeholder="输入备注信息..."
                    />
                  ) : (
                    <p className="text-slate-700 bg-slate-50 p-3 rounded-lg">
                      {selectedNotice.remark || '暂无备注'}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">历史版本</p>
                      <p className="text-xs text-slate-400">共 {versions.length} 个版本</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        setShowVersionCompare(true);
                      }}
                      className="text-sm text-primary hover:text-primary-600 flex items-center gap-1"
                    >
                      <History className="w-4 h-4" />
                      查看版本对比
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVersionCompare && selectedNotice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowVersionCompare(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-4xl p-6 shadow-xl max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-serif text-xl font-semibold text-slate-800">版本对比</h3>
                  <p className="text-sm text-slate-500 mt-1">{selectedNotice.title}</p>
                </div>
                <button
                  onClick={() => setShowVersionCompare(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-4">
                {versions.length >= 2 ? (
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="tag-slate">旧版本 v{versions[1].version}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(versions[1].createdAt).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mb-1">操作人：{versions[1].operatorName}</p>
                      <p className="text-sm text-slate-500">说明：{versions[1].remark}</p>
                      <div className="mt-3 p-3 bg-white rounded-lg">
                        {Object.entries(versions[1].content).map(([key, value]) => (
                          <div key={key} className="text-sm mb-1">
                            <span className="text-slate-500">{key}：</span>
                            <span className="text-slate-800 line-through text-slate-400">{String(value || '空')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="tag-emerald">新版本 v{versions[0].version}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(versions[0].createdAt).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mb-1">操作人：{versions[0].operatorName}</p>
                      <p className="text-sm text-slate-500">说明：{versions[0].remark}</p>
                      <div className="mt-3 p-3 bg-white rounded-lg">
                        {Object.entries(versions[0].content).map(([key, value]) => (
                          <div key={key} className="text-sm mb-1">
                            <span className="text-slate-500">{key}：</span>
                            <span className="text-emerald-700 font-medium">{String(value || '空')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : versions.length === 1 ? (
                  <div className="text-center py-8 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3" />
                    <p>只有一个版本，暂无对比数据</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3" />
                    <p>暂无版本记录</p>
                  </div>
                )}

                {versions.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-sm font-medium text-slate-700 mb-3">全部版本历史</p>
                    <div className="space-y-2">
                      {versions.map((v, idx) => (
                        <div key={v.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-700">v{v.version} · {v.remark}</p>
                            <p className="text-xs text-slate-500">
                              {v.operatorName} · {new Date(v.createdAt).toLocaleString('zh-CN')}
                            </p>
                          </div>
                          {idx === 0 && <span className="tag-emerald">当前</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
