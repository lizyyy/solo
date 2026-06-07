import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { Upload, History, Search, MapPin, CheckCircle, AlertCircle, X, ChevronRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DateDisplay from '../components/DateDisplay';
import { ImportPreview, RedlineRemark } from '../types';

export default function RedlineList() {
  const navigate = useNavigate();
  const { redlineRemarks, batchImportRedlineRemarks, getVersionsForRemark } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importText, setImportText] = useState('');
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [selectedRemark, setSelectedRemark] = useState<RedlineRemark | null>(null);
  const [compareVersions, setCompareVersions] = useState<{v1: number; v2: number} | null>(null);

  const filteredRemarks = redlineRemarks.filter(
    (r) =>
      r.areaName.includes(searchTerm) ||
      r.code.includes(searchTerm) ||
      r.location.includes(searchTerm)
  );

  const handlePreviewImport = () => {
    try {
      const items = JSON.parse(importText);
      const preview = batchImportRedlineRemarks(items);
      setImportPreview(preview);
    } catch (e) {
      alert('导入数据格式错误，请检查JSON格式');
    }
  };

  const handleSimulateImport = () => {
    const sampleData = [
      {
        code: 'RL-2024-001',
        areaName: '阳光花园A区',
        location: '1号楼南侧绿地（更新）',
        hasPetArea: true,
        rampCount: 3,
        remark: '宠物活动区已划定，坡道基本符合要求，边缘加固完成',
        status: 'approved' as const,
      },
      {
        code: 'RL-2024-005',
        areaName: '新建小区C区',
        location: '中心花园旁',
        hasPetArea: true,
        rampCount: 2,
        remark: '新建宠物活动区，坡道已按规范建设',
        status: 'pending_review' as const,
      },
    ];
    setImportText(JSON.stringify(sampleData, null, 2));
  };

  const handleViewVersions = (remark: RedlineRemark) => {
    setSelectedRemark(remark);
    setShowVersionModal(true);
    setCompareVersions(null);
  };

  const versions = selectedRemark ? getVersionsForRemark(selectedRemark.id) : [];

  const startCompare = (v1: number, v2: number) => {
    setCompareVersions({ v1, v2 });
  };

  const getVersionData = (versionNum: number) => {
    const v = versions.find((v) => v.version === versionNum);
    return v?.data || {};
  };

  const renderDiff = () => {
    if (!compareVersions || !selectedRemark) return null;
    const data1 = getVersionData(compareVersions.v1);
    const data2 = getVersionData(compareVersions.v2);
    const allKeys = [...new Set([...Object.keys(data1), ...Object.keys(data2)])] as Array<keyof RedlineRemark>;

    return (
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="p-4 bg-red-50 rounded-lg">
          <p className="text-sm font-medium text-red-700 mb-3">版本 v{compareVersions.v1}</p>
          {allKeys.map((key) => (
            <div key={key} className="mb-2">
              <span className="text-xs text-gray-500">{key}:</span>
              <p className={`text-sm ${data1[key] !== data2[key] ? 'text-red-600 line-through' : 'text-gray-700'}`}>
                {String(data1[key] ?? '-')}
              </p>
            </div>
          ))}
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm font-medium text-green-700 mb-3">版本 v{compareVersions.v2}</p>
          {allKeys.map((key) => (
            <div key={key} className="mb-2">
              <span className="text-xs text-gray-500">{key}:</span>
              <p className={`text-sm ${data1[key] !== data2[key] ? 'text-green-600 font-medium' : 'text-gray-700'}`}>
                {String(data2[key] ?? '-')}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    draft: { label: '草稿', color: 'bg-gray-100 text-gray-700' },
    pending_review: { label: '待审核', color: 'bg-yellow-100 text-yellow-700' },
    approved: { label: '已通过', color: 'bg-green-100 text-green-700' },
    rejected: { label: '已驳回', color: 'bg-red-100 text-red-700' },
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="红线图备注"
        subtitle="管理红线图备注数据，支持批量导入、自动去重和版本追踪"
        action={
          <div className="flex gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              导入备注
            </button>
          </div>
        }
      />

      <div className="card p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索备注编号、区域名称、位置..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">备注编号</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">区域名称</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">位置</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">宠物区</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">坡道数</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">版本</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">导入时间</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredRemarks.map((remark) => (
              <tr key={remark.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-primary-700">{remark.code}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{remark.areaName}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-600">{remark.location}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {remark.hasPetArea ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <X className="w-5 h-5 text-gray-300" />
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {remark.rampCount}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`badge ${statusConfig[remark.status].color}`}>
                    {statusConfig[remark.status].label}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleViewVersions(remark)}
                    className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                  >
                    <History className="w-4 h-4" />
                    v{remark.currentVersion}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <DateDisplay date={remark.importedAt} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button
                    onClick={() => navigate(`/redline/${remark.id}`)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
                  >
                    查看
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">批量导入红线图备注</h2>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                粘贴JSON格式的备注数据。系统将自动检测重复项，避免数量翻倍。
              </p>
              <button
                onClick={handleSimulateImport}
                className="text-sm text-primary-600 hover:text-primary-700 mb-3"
              >
                → 点击加载示例数据（含重复项）
              </button>
              <textarea
                className="input h-48 font-mono text-sm"
                placeholder='[{"code": "RL-2024-001", "areaName": "..."}]'
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <button onClick={handlePreviewImport} className="btn-primary w-full mt-4">
                预览导入结果
              </button>

              {importPreview && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3">导入预览</h3>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 bg-white rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{importPreview.total}</p>
                      <p className="text-xs text-gray-500">总计</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{importPreview.newItems}</p>
                      <p className="text-xs text-gray-500">新增</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{importPreview.updatedItems}</p>
                      <p className="text-xs text-gray-500">更新</p>
                    </div>
                    <div className="text-center p-3 bg-gray-100 rounded-lg">
                      <p className="text-2xl font-bold text-gray-600">{importPreview.skippedItems}</p>
                      <p className="text-xs text-gray-500">跳过</p>
                    </div>
                  </div>
                  {importPreview.duplicates.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-orange-700 flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4" />
                        检测到 {importPreview.duplicates.length} 条重复数据，已自动合并（未翻倍）
                      </p>
                      <div className="space-y-2 max-h-32 overflow-auto">
                        {importPreview.duplicates.map((d, i) => (
                          <div key={i} className="text-xs p-2 bg-orange-50 rounded flex items-center gap-2">
                            <span className="font-mono text-orange-700">{d.code}</span>
                            <span className="text-gray-500">→</span>
                            <span className="text-gray-600">{d.existing.areaName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-center text-sm text-green-600 mt-4 font-medium">
                    ✓ 导入完成！数据已更新到列表中
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showVersionModal && selectedRemark && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">版本历史 - {selectedRemark.code}</h2>
                <p className="text-sm text-gray-500 mt-1">{selectedRemark.areaName}</p>
              </div>
              <button onClick={() => setShowVersionModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">选择两个版本进行对比，查看改前改后的差别</p>
              
              <div className="space-y-3">
                {versions.map((version, index) => (
                  <div key={version.id} className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                          v{version.version}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {version.changeReason}
                            {index === 0 && <span className="ml-2 badge bg-green-100 text-green-700">当前版本</span>}
                          </p>
                          <p className="text-sm text-gray-500">
                            修改人：{version.changedBy} · <DateDisplay date={version.changedAt} />
                          </p>
                        </div>
                      </div>
                      {versions.length >= 2 && index < versions.length - 1 && (
                        <button
                          onClick={() => startCompare(version.version, versions[0].version)}
                          className="btn-secondary text-sm"
                        >
                          与最新版本对比
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {renderDiff()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
