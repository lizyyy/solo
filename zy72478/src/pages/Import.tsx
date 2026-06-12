
import { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Check,
  AlertCircle,
  Plus,
  X,
  Edit3,
  History,
  ChevronDown,
  ChevronUp,
  Flame,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { DataSource, BusSwipeRecord, RedlineNote, ImportResult } from '../../shared/types';

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

const sourceDesc: Record<DataSource, string> = {
  normal: '日间刷卡分布均匀、站点与红线图一致的标准数据',
  wrong: '含重复记录、夜间异常刷卡、口径错乱的测试数据',
  supplement: '拆迁区东片等区域的补充采集，导入后自动重算热力图',
};

function generateSamples(source: DataSource): Partial<BusSwipeRecord>[] {
  const samples: Partial<BusSwipeRecord>[] = [];

  if (source === 'normal') {
    const normalCases = [
      { cardId: 'CARD001', hour: 7, min: 32, route: '101路', location: '城西小区站' },
      { cardId: 'CARD002', hour: 7, min: 45, route: '101路', location: '城西小区站' },
      { cardId: 'CARD003', hour: 8, min: 10, route: '203路', location: '人民广场站' },
      { cardId: 'CARD004', hour: 8, min: 22, route: '203路', location: '人民广场站' },
      { cardId: 'CARD005', hour: 8, min: 35, route: '101路', location: '城西小区站' },
      { cardId: 'CARD006', hour: 9, min: 5, route: '305路', location: '南滨河路站' },
      { cardId: 'CARD007', hour: 11, min: 40, route: '203路', location: '人民广场站' },
      { cardId: 'CARD008', hour: 12, min: 15, route: '101路', location: '城西小区站' },
      { cardId: 'CARD009', hour: 14, min: 20, route: '305路', location: '南滨河路站' },
      { cardId: 'CARD010', hour: 17, min: 30, route: '101路', location: '城西小区站' },
      { cardId: 'CARD011', hour: 17, min: 48, route: '203路', location: '人民广场站' },
      { cardId: 'CARD012', hour: 18, min: 5, route: '101路', location: '城西小区站' },
    ];
    normalCases.forEach((c) => {
      samples.push({
        cardId: c.cardId,
        swipeTime: `2026-06-07 ${String(c.hour).padStart(2, '0')}:${String(c.min).padStart(2, '0')}:00`,
        route: c.route,
        location: c.location,
        source,
      });
    });
  }

  if (source === 'wrong') {
    samples.push(
      { cardId: 'CARD001', swipeTime: '2026-06-07 07:32:00', route: '101路', location: '城西小区站', source },
      { cardId: 'CARD001', swipeTime: '2026-06-07 07:32:00', route: '101路', location: '城西小区站', source },
      { cardId: 'CARD901', swipeTime: '2026-06-07 02:15:00', route: '夜1路', location: '拆迁区东站', source },
      { cardId: 'CARD902', swipeTime: '2026-06-07 03:02:00', route: '夜1路', location: '拆迁区东站', source },
      { cardId: 'CARD903', swipeTime: '2026-06-07 23:48:00', route: '夜1路', location: '拆迁区东站', source },
    );
  }

  if (source === 'supplement') {
    samples.push(
      { cardId: 'CARD001', swipeTime: '2026-06-07 07:32:00', route: '101路', location: '城西小区站', source },
      { cardId: 'CARD501', swipeTime: '2026-06-07 06:50:00', route: '305路', location: '拆迁区东站', source },
      { cardId: 'CARD502', swipeTime: '2026-06-07 07:12:00', route: '305路', location: '拆迁区东站', source },
      { cardId: 'CARD503', swipeTime: '2026-06-07 07:55:00', route: '305路', location: '拆迁区东站', source },
      { cardId: 'CARD504', swipeTime: '2026-06-07 18:10:00', route: '305路', location: '拆迁区东站', source },
      { cardId: 'CARD505', swipeTime: '2026-06-07 18:42:00', route: '305路', location: '拆迁区东站', source },
      { cardId: 'CARD506', swipeTime: '2026-06-07 19:05:00', route: '203路', location: '南滨河路站', source },
      { cardId: 'CARD507', swipeTime: '2026-06-07 19:30:00', route: '203路', location: '南滨河路站', source },
    );
  }

  return samples;
}

function parseCsvText(text: string, source: DataSource): Partial<BusSwipeRecord>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(/[,，\t]/).map((h) => h.trim());
  const idx = (name: string) => header.findIndex((h) => h.includes(name));
  const iCard = idx('卡号');
  const iTime = idx('时间');
  const iRoute = idx('线路');
  const iLoc = idx('站点');
  const result: Partial<BusSwipeRecord>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,，\t]/).map((c) => c.trim());
    result.push({
      cardId: cols[iCard >= 0 ? iCard : 0] || '',
      swipeTime: cols[iTime >= 0 ? iTime : 1] || '',
      route: cols[iRoute >= 0 ? iRoute : 2] || '',
      location: cols[iLoc >= 0 ? iLoc : 3] || '',
      source,
    });
  }
  return result;
}

export default function Import() {
  const {
    busSwipes,
    redlineNotes,
    addBusSwipes,
    addRedlineNote,
    updateRedlineNote,
    currentProject,
    currentUser,
    dataChangeHistory,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'bus' | 'redline'>('bus');
  const [selectedSource, setSelectedSource] = useState<DataSource>('normal');
  const [previewData, setPreviewData] = useState<Partial<BusSwipeRecord>[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editingRedline, setEditingRedline] = useState<RedlineNote | null>(null);
  const [editReason, setEditReason] = useState('');
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [redlineForm, setRedlineForm] = useState({
    areaName: '',
    remark: '',
    boundaryCoords: '',
    recordDate: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateSampleData = () => {
    const samples = generateSamples(selectedSource);
    setPreviewData(samples);
    setImportResult(null);
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      const parsed = parseCsvText(text, selectedSource);
      setPreviewData(parsed);
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleImportBusData = () => {
    if (previewData.length === 0) return;
    const result = addBusSwipes(previewData);
    setImportResult(result);
    setPreviewData([]);
  };

  const handleRedlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;
    addRedlineNote({ ...redlineForm, source: selectedSource });
    setRedlineForm({ areaName: '', remark: '', boundaryCoords: '', recordDate: '' });
  };

  const handleEditRedline = () => {
    if (!editingRedline || !editReason.trim()) return;
    const updates = {
      areaName: redlineForm.areaName,
      remark: redlineForm.remark,
      boundaryCoords: redlineForm.boundaryCoords,
      recordDate: redlineForm.recordDate,
    };
    updateRedlineNote(editingRedline.id, updates, editReason.trim());
    setEditingRedline(null);
    setEditReason('');
    setRedlineForm({ areaName: '', remark: '', boundaryCoords: '', recordDate: '' });
  };

  const openEditRedline = (note: RedlineNote) => {
    setEditingRedline(note);
    setRedlineForm({
      areaName: note.areaName,
      remark: note.remark,
      boundaryCoords: note.boundaryCoords,
      recordDate: note.recordDate,
    });
    setEditReason('');
  };

  const projectBusSwipes = busSwipes.filter((b) => b.projectId === currentProject?.id);
  const projectRedlines = redlineNotes.filter((r) => r.projectId === currentProject?.id);
  const getNoteHistory = (noteId: string) =>
    dataChangeHistory.filter((c) => c.targetType === 'redline_note' && c.targetId === noteId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">数据导入</h1>
          <p className="text-gray-500 mt-1">导入公交刷卡数据和红线图备注信息，支持三种口径跑数验证</p>
        </div>
      </div>

      {importResult && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">导入处理完成</h3>
              <p className="text-sm text-gray-500">系统已对这批数据完成去重、冲突检测、热力图联动</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">提交总数</p>
              <p className="text-xl font-bold text-gray-800">{importResult.total}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">成功入库</p>
              <p className="text-xl font-bold text-green-700">{importResult.imported}</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">去重跳过</p>
              <p className="text-xl font-bold text-orange-600">{importResult.duplicates}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">检测到冲突</p>
              <p className="text-xl font-bold text-red-600">{importResult.conflictsDetected}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">热力图重算</p>
              <p className="text-sm font-bold text-blue-700">
                {importResult.heatmapRecalculated
                  ? `已重算（${importResult.newHeatmapVersion || '新版本'}）`
                  : '未触发'}
              </p>
            </div>
          </div>
          {selectedSource === 'supplement' && !importResult.heatmapRecalculated && (
            <p className="text-sm text-orange-600 mt-3 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              补录数据未触发热力图重算通常是因为全部是重复数据被跳过了
            </p>
          )}
          {selectedSource === 'supplement' && importResult.heatmapRecalculated && (
            <p className="text-sm text-blue-600 mt-3 flex items-center gap-1">
              <Info className="w-4 h-4" />
              补录数据已触发自动重算，若热力图夜间采样偏低会自动标记待街道规划员复核
            </p>
          )}
        </div>
      )}

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
            <div className="flex flex-wrap gap-3">
              {(['normal', 'wrong', 'supplement'] as DataSource[]).map((source) => (
                <button
                  key={source}
                  onClick={() => {
                    setSelectedSource(source);
                    setPreviewData([]);
                    setImportResult(null);
                  }}
                  className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                    selectedSource === source
                      ? sourceColors[source] + ' font-medium'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <div>{sourceLabels[source]}</div>
                  <div className="text-xs mt-1 opacity-80 max-w-xs">{sourceDesc[source]}</div>
                </button>
              ))}
            </div>
            {selectedSource === 'wrong' && (
              <p className="text-sm text-red-600 mt-3 flex items-start gap-1 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>错口径数据包含：1条完全重复记录、3条拆迁区深夜刷卡记录（与红线图"已拆迁无居民"矛盾），用于验证系统异常检测。</span>
              </p>
            )}
            {selectedSource === 'supplement' && (
              <p className="text-sm text-blue-600 mt-3 flex items-start gap-1 bg-blue-50 p-3 rounded-lg">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>补录数据包含：拆迁区东片新采集的5条早晚高峰刷卡 + 2条南滨河路刷卡 + 1条与正常口径重复的数据（演示去重）。导入后将自动重算热力图并与红线图备注重新比对冲突。</span>
              </p>
            )}
          </div>

          {activeTab === 'bus' ? (
            <div className="space-y-6">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-[#f59e0b] bg-[#f59e0b]/5'
                    : 'border-gray-200 hover:border-[#f59e0b]/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.xlsx"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2 font-medium">拖拽 CSV / Excel 文件到此处，或点击选择文件</p>
                <p className="text-sm text-gray-400 mb-4">
                  支持列：卡号、刷卡时间、线路、站点（可用逗号、顿号或制表符分隔）
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateSampleData();
                    }}
                    className="px-6 py-2 bg-[#f59e0b] text-white rounded-lg hover:bg-[#d97706] transition-colors flex items-center gap-2"
                  >
                    <Flame className="w-4 h-4" />
                    生成示例数据（演示用）
                  </button>
                </div>
              </div>

              {previewData.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-800">
                      数据预览（共 {previewData.length} 条）
                      <span className={`ml-2 text-xs px-2 py-1 rounded border ${sourceColors[selectedSource]}`}>
                        {sourceLabels[selectedSource]}
                      </span>
                    </h3>
                    <button
                      onClick={() => setPreviewData([])}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-gray-600 font-medium">#</th>
                          <th className="px-4 py-3 text-left text-gray-600 font-medium">卡号</th>
                          <th className="px-4 py-3 text-left text-gray-600 font-medium">刷卡时间</th>
                          <th className="px-4 py-3 text-left text-gray-600 font-medium">线路</th>
                          <th className="px-4 py-3 text-left text-gray-600 font-medium">站点</th>
                          <th className="px-4 py-3 text-left text-gray-600 font-medium">时段</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {previewData.map((row, i) => {
                          const hour = parseInt(row.swipeTime?.split(' ')[1]?.split(':')[0] || '0', 10);
                          const isNight = hour >= 22 || hour < 6;
                          return (
                            <tr key={i} className={isNight ? 'bg-orange-50/50' : ''}>
                              <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                              <td className="px-4 py-3 font-mono">{row.cardId}</td>
                              <td className="px-4 py-3">{row.swipeTime}</td>
                              <td className="px-4 py-3">{row.route}</td>
                              <td className="px-4 py-3">{row.location}</td>
                              <td className="px-4 py-3">
                                {isNight ? (
                                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">夜间</span>
                                ) : (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">日间</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      onClick={() => setPreviewData([])}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                    >
                      清空
                    </button>
                    <button
                      onClick={handleImportBusData}
                      className="px-5 py-2 bg-[#f59e0b] text-white rounded-lg hover:bg-[#d97706] flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      确认导入并跑数
                    </button>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-medium text-gray-800 mb-3">
                  已导入记录（{projectBusSwipes.length} 条）
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {projectBusSwipes.slice().reverse().slice(0, 20).map((record) => {
                    const hour = parseInt(record.swipeTime.split(' ')[1]?.split(':')[0] || '0', 10);
                    const isNight = hour >= 22 || hour < 6;
                    return (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="font-mono text-sm">{record.cardId}</span>
                          <span className={`text-sm ${isNight ? 'text-orange-600' : 'text-gray-500'}`}>
                            {record.swipeTime}
                          </span>
                          <span className="text-gray-600 text-sm">
                            {record.route} - {record.location}
                          </span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded border ${sourceColors[record.source]}`}>
                          {sourceLabels[record.source]}
                        </span>
                      </div>
                    );
                  })}
                  {projectBusSwipes.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">暂无导入记录</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {editingRedline ? (
                <div className="border-2 border-blue-200 rounded-xl p-5 bg-blue-50/30">
                  <div className="flex items-center gap-2 mb-4">
                    <Edit3 className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-800">
                      编辑红线图备注：{editingRedline.areaName}
                    </h3>
                    <button
                      onClick={() => {
                        setEditingRedline(null);
                        setEditReason('');
                      }}
                      className="ml-auto text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">区域名称</label>
                      <input
                        type="text"
                        value={redlineForm.areaName}
                        onChange={(e) => setRedlineForm({ ...redlineForm, areaName: e.target.value })}
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
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">备注信息</label>
                      <textarea
                        value={redlineForm.remark}
                        onChange={(e) => setRedlineForm({ ...redlineForm, remark: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/30"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        边界坐标
                      </label>
                      <input
                        type="text"
                        value={redlineForm.boundaryCoords}
                        onChange={(e) => setRedlineForm({ ...redlineForm, boundaryCoords: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/30"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-red-600 mb-1">
                        * 修改原因（必填，将与改前改后内容一并留痕）
                      </label>
                      <input
                        type="text"
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        placeholder="例如：周姐现场复核发现原备注拆迁时间不准确，修正为6月10日"
                        className="w-full px-4 py-2 border-2 border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setEditingRedline(null);
                        setEditReason('');
                      }}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleEditRedline}
                      disabled={!editReason.trim()}
                      className="px-5 py-2 bg-[#f59e0b] text-white rounded-lg hover:bg-[#d97706] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      保存修改并记录留痕
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRedlineSubmit} className="space-y-4 max-w-2xl">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">区域名称</label>
                    <input
                      type="text"
                      value={redlineForm.areaName}
                      onChange={(e) => setRedlineForm({ ...redlineForm, areaName: e.target.value })}
                      placeholder="例如：拆迁区东片"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/30"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">备注信息</label>
                    <textarea
                      value={redlineForm.remark}
                      onChange={(e) => setRedlineForm({ ...redlineForm, remark: e.target.value })}
                      placeholder="例如：该区域已于2026年6月10日完成拆迁，无居民居住，夜间封闭管理"
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/30"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">边界坐标</label>
                      <input
                        type="text"
                        value={redlineForm.boundaryCoords}
                        onChange={(e) => setRedlineForm({ ...redlineForm, boundaryCoords: e.target.value })}
                        placeholder="经度1,纬度1;经度2,纬度2"
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
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-[#f59e0b] text-white rounded-lg hover:bg-[#d97706] flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    添加备注
                  </button>
                </form>
              )}

              <div>
                <h3 className="font-medium text-gray-800 mb-3">
                  已录入备注（{projectRedlines.length} 条）
                </h3>
                <div className="space-y-3">
                  {projectRedlines.map((note) => {
                    const history = getNoteHistory(note.id);
                    const isOpen = expandedHistory === note.id;
                    return (
                      <div
                        key={note.id}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{note.areaName}</span>
                            <span className="text-sm text-gray-500">{note.recordDate}</span>
                            <span className={`text-xs px-2 py-1 rounded border ${sourceColors[note.source]}`}>
                              {sourceLabels[note.source]}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {history.length > 0 && (
                              <button
                                onClick={() => setExpandedHistory(isOpen ? null : note.id)}
                                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100"
                              >
                                <History className="w-3.5 h-3.5" />
                                {history.length} 次变更
                                {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <button
                              onClick={() => openEditRedline(note)}
                              className="text-xs text-[#f59e0b] hover:text-[#d97706] flex items-center gap-1 px-2 py-1 rounded hover:bg-[#f59e0b]/10"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              周姐补改
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{note.remark}</p>
                        {note.boundaryCoords && (
                          <p className="text-xs text-gray-400 mt-1">坐标：{note.boundaryCoords}</p>
                        )}

                        {isOpen && history.length > 0 && (
                          <div className="mt-4 border-t border-gray-200 pt-4 space-y-3">
                            <p className="text-xs font-medium text-gray-500">变更留痕：</p>
                            {history.map((h) => (
                              <div key={h.id} className="bg-white rounded-lg p-3 border border-gray-100">
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                                  <span>操作人：{h.operator}</span>
                                  <span>{new Date(h.createdAt).toLocaleString()}</span>
                                </div>
                                {h.reason && (
                                  <p className="text-sm text-red-600 mb-2 bg-red-50 p-2 rounded">
                                    修改原因：{h.reason}
                                  </p>
                                )}
                                <div className="space-y-2">
                                  {h.changes.map((c, idx) => (
                                    <div key={idx} className="grid grid-cols-3 gap-2 text-sm">
                                      <span className="text-gray-500">{c.fieldLabel}</span>
                                      <span className="text-red-600 bg-red-50 p-1 rounded line-through">
                                        {c.before || '(空)'}
                                      </span>
                                      <span className="text-green-700 bg-green-50 p-1 rounded">
                                        {c.after || '(空)'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {projectRedlines.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">暂无备注记录</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
