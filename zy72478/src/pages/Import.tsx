
import { useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Check,
  AlertCircle,
  Plus,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { DataSource, BusSwipeRecord, RedlineNote } from '../../shared/types';

const sourceLabels: Record<DataSource, string> = {
  normal: '正常口径',
  wrong: '错口径（测试）',
  supplement: '补录数据',
};

const sourceColors: Record<DataSource, string> = {
  normal: 'bg-green-100 text-green-700 border-green-200',
  wrong: 'bg-red-100 text-red-700 border-red-200',
  supplement: 'bg-blue-100 text-blue-700 border-blue-200',
};

export default function Import() {
  const { busSwipes, redlineNotes, addBusSwipes, addRedlineNote, currentProject, currentUser } =
    useAppStore();
  const [activeTab, setActiveTab] = useState<'bus' | 'redline'>('bus');
  const [selectedSource, setSelectedSource] = useState<DataSource>('normal');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [redlineForm, setRedlineForm] = useState({
    areaName: '',
    remark: '',
    boundaryCoords: '',
    recordDate: '',
  });

  const handleGenerateSampleData = () => {
    if (!currentProject) return;

    const samples: Partial<BusSwipeRecord>[] = [];
    const count = selectedSource === 'wrong' ? 5 : selectedSource === 'supplement' ? 8 : 12;
    const locations = ['城西小区站', '人民广场站', '拆迁区东站', '南滨河路站'];
    const routes = ['101路', '203路', '夜1路', '305路'];

    for (let i = 0; i < count; i++) {
      const hour = selectedSource === 'wrong' ? Math.floor(Math.random() * 4) + 23 : Math.floor(Math.random() * 24);
      samples.push({
        cardId: `CARD${String(100 + i).padStart(3, '0')}`,
        swipeTime: `2026-06-07 ${hour.toString().padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
        route: routes[Math.floor(Math.random() * routes.length)],
        location: locations[Math.floor(Math.random() * locations.length)],
        source: selectedSource,
        isDuplicate: selectedSource === 'wrong' && i === 0,
      });
    }

    setPreviewData(samples);
  };

  const handleImportBusData = () => {
    if (previewData.length === 0) return;
    addBusSwipes(previewData as BusSwipeRecord[]);
    setPreviewData([]);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleRedlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;

    const note: RedlineNote = {
      ...redlineForm,
      id: '',
      projectId: currentProject.id,
      source: selectedSource,
    };

    addRedlineNote(note);
    setRedlineForm({ areaName: '', remark: '', boundaryCoords: '', recordDate: '' });
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const projectBusSwipes = busSwipes.filter((b) => b.projectId === currentProject?.id);
  const projectRedlines = redlineNotes.filter((r) => r.projectId === currentProject?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">数据导入</h1>
          <p className="text-gray-500 mt-1">导入公交刷卡数据和红线图备注信息</p>
        </div>
        {showSuccess && (
          <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg">
            <Check className="w-5 h-5" />
            <span className="font-medium">导入成功</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('bus')}
            className={`px-6 py-4 font-medium transition-colors ${
              activeTab === 'bus'
                ? 'text-[#f59e0b] border-b-2 border-[#f59e0b]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              公交刷卡时段
            </div>
          </button>
          <button
            onClick={() => setActiveTab('redline')}
            className={`px-6 py-4 font-medium transition-colors ${
              activeTab === 'redline'
                ? 'text-[#f59e0b] border-b-2 border-[#f59e0b]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              红线图备注
            </div>
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">选择数据口径</label>
            <div className="flex gap-3">
              {(['normal', 'wrong', 'supplement'] as DataSource[]).map((source) => (
                <button
                  key={source}
                  onClick={() => setSelectedSource(source)}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    selectedSource === source
                      ? sourceColors[source] + ' font-medium'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {sourceLabels[source]}
                </button>
              ))}
            </div>
            {selectedSource === 'wrong' && (
              <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                错口径数据仅用于测试系统异常检测能力
              </p>
            )}
            {selectedSource === 'supplement' && (
              <p className="text-sm text-blue-600 mt-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                补录数据导入后将自动触发热力图重算
              </p>
            )}
          </div>

          {activeTab === 'bus' ? (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-[#f59e0b]/50 transition-colors">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">拖拽文件到此处，或点击选择文件</p>
                <p className="text-sm text-gray-400 mb-4">支持 Excel (.xlsx)、CSV 格式</p>
                <button
                  onClick={handleGenerateSampleData}
                  className="px-6 py-2 bg-[#f59e0b] text-white rounded-lg hover:bg-[#d97706] transition-colors"
                >
                  生成示例数据（演示用）
                </button>
              </div>

              {previewData.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-800">数据预览（{previewData.length} 条）</h3>
                    <button
                      onClick={() => setPreviewData([])}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-gray-600 font-medium">卡号</th>
                          <th className="px-4 py-3 text-left text-gray-600 font-medium">刷卡时间</th>
                          <th className="px-4 py-3 text-left text-gray-600 font-medium">线路</th>
                          <th className="px-4 py-3 text-left text-gray-600 font-medium">站点</th>
                          <th className="px-4 py-3 text-left text-gray-600 font-medium">标记</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {previewData.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            <td className="px-4 py-3">{row.cardId}</td>
                            <td className="px-4 py-3">{row.swipeTime}</td>
                            <td className="px-4 py-3">{row.route}</td>
                            <td className="px-4 py-3">{row.location}</td>
                            <td className="px-4 py-3">
                              {row.isDuplicate && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                                  疑似重复
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex justify-end gap-3">
                    <button className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                      取消
                    </button>
                    <button
                      onClick={handleImportBusData}
                      className="px-4 py-2 bg-[#f59e0b] text-white rounded-lg hover:bg-[#d97706] flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      确认导入
                    </button>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-medium text-gray-800 mb-3">
                  已导入记录（{projectBusSwipes.length} 条）
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {projectBusSwipes.slice().reverse().slice(0, 10).map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm">{record.cardId}</span>
                        <span className="text-gray-500 text-sm">{record.swipeTime}</span>
                        <span className="text-gray-600 text-sm">
                          {record.route} - {record.location}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded border ${sourceColors[record.source]}`}>
                        {sourceLabels[record.source]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <form onSubmit={handleRedlineSubmit} className="space-y-4 max-w-2xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">区域名称</label>
                  <input
                    type="text"
                    value={redlineForm.areaName}
                    onChange={(e) => setRedlineForm({ ...redlineForm, areaName: e.target.value })}
                    placeholder="例如：城西小区A区"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">备注信息</label>
                  <textarea
                    value={redlineForm.remark}
                    onChange={(e) => setRedlineForm({ ...redlineForm, remark: e.target.value })}
                    placeholder="例如：该区域已于2026年5月完成拆迁，无居民居住"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">边界坐标</label>
                  <input
                    type="text"
                    value={redlineForm.boundaryCoords}
                    onChange={(e) => setRedlineForm({ ...redlineForm, boundaryCoords: e.target.value })}
                    placeholder="格式：经度1,纬度1;经度2,纬度2;..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">记录日期</label>
                  <input
                    type="date"
                    value={redlineForm.recordDate}
                    onChange={(e) => setRedlineForm({ ...redlineForm, recordDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/30"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#f59e0b] text-white rounded-lg hover:bg-[#d97706] flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  添加备注
                </button>
              </form>

              <div>
                <h3 className="font-medium text-gray-800 mb-3">
                  已录入备注（{projectRedlines.length} 条）
                </h3>
                <div className="space-y-3">
                  {projectRedlines.map((note) => (
                    <div
                      key={note.id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">{note.areaName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">{note.recordDate}</span>
                          <span className={`text-xs px-2 py-1 rounded border ${sourceColors[note.source]}`}>
                            {sourceLabels[note.source]}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{note.remark}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
