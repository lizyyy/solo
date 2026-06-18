import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import RecordCard from '@/components/common/RecordCard';
import RecordDetail from '@/components/workbench/RecordDetail';
import CleaningPipeline from '@/components/charts/CleaningPipeline';
import { Search, Filter, SlidersHorizontal, PanelRightClose, PanelRightOpen } from 'lucide-react';

export default function Workbench() {
  const { records, selectedRecordId, setSelectedRecord, getSelectedRecord, schemes, activeSchemeId } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDetail, setShowDetail] = useState(true);

  const filteredRecords = records.filter((r) => {
    const matchSearch =
      r.recordNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.shipName.includes(searchQuery) ||
      r.location.includes(searchQuery);
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const selectedRecord = getSelectedRecord();
  const activeScheme = schemes.find((s) => s.id === activeSchemeId);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="bg-ocean-900/80 backdrop-blur border-b border-ocean-700 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">数据清洗工作台</h1>
            <p className="text-sm text-ocean-400 mt-0.5">
              船上记录本原始数据 · 清洗流水线 · 单条记录详情
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDetail(!showDetail)}
              className="p-2 bg-ocean-800 hover:bg-ocean-700 rounded-lg transition-colors"
              title={showDetail ? '收起详情面板' : '展开详情面板'}
            >
              {showDetail ? (
                <PanelRightClose className="w-5 h-5 text-ocean-400" />
              ) : (
                <PanelRightOpen className="w-5 h-5 text-ocean-400" />
              )}
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-ocean-800 rounded-lg">
              <SlidersHorizontal className="w-4 h-4 text-ocean-400" />
              <span className="text-sm text-ocean-300">当前方案：</span>
              <span className="text-sm font-medium text-nautical-warning">{activeScheme?.name}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-ocean-700 flex flex-col bg-ocean-900/30 flex-shrink-0">
          <div className="p-4 border-b border-ocean-700 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ocean-500" />
              <input
                type="text"
                placeholder="搜索记录编号、船名、点位..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-ocean-800 border border-ocean-700 rounded-lg text-sm text-white placeholder-ocean-500 focus:outline-none focus:border-nautical-warning/50 focus:ring-1 focus:ring-nautical-warning/30"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-ocean-500 flex-shrink-0" />
              <div className="flex gap-1 flex-wrap">
                {['all', 'pending', 'confirmed', 'returned', 'supplement'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-2 py-1 text-xs rounded-full transition-colors ${
                      statusFilter === status
                        ? 'bg-nautical-warning/20 text-nautical-warning border border-nautical-warning/50'
                        : 'bg-ocean-800 text-ocean-400 border border-ocean-700 hover:border-ocean-600'
                    }`}
                  >
                    {status === 'all' ? '全部' : 
                     status === 'pending' ? '待处理' :
                     status === 'confirmed' ? '已确认' :
                     status === 'returned' ? '退回' : '待补件'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredRecords.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                selected={selectedRecordId === record.id}
                onClick={() => {
                  setSelectedRecord(record.id);
                  if (!showDetail) setShowDetail(true);
                }}
              />
            ))}
            {filteredRecords.length === 0 && (
              <div className="text-center py-8 text-ocean-500 text-sm">
                没有找到匹配的记录
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden min-w-0">
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="p-5 flex-shrink-0">
              {selectedRecord ? (
                <CleaningPipeline 
                  steps={selectedRecord.cleaningSteps} 
                  showAnimation={true}
                  title="清洗流水线"
                />
              ) : (
                <div className="h-48 flex items-center justify-center text-ocean-500 bg-ocean-800/30 rounded-xl border border-ocean-700 border-dashed">
                  选择左侧记录查看清洗流水线
                </div>
              )}
            </div>

            <div className="flex-1 p-5 pt-0 overflow-y-auto">
              {selectedRecord ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-ocean-800/50 rounded-xl border border-ocean-700 p-5">
                    <h3 className="text-white font-semibold mb-4">数据概览</h3>
                    <div className="space-y-4">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-ocean-400">原始值</span>
                        <span className="text-xl font-mono text-ocean-300 line-through">
                          {selectedRecord.rawValue.toFixed(2)}
                          <span className="text-xs ml-1 text-ocean-500">{selectedRecord.unit}</span>
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-ocean-400">清洗结果</span>
                        <span className="text-2xl font-bold font-mono text-white">
                          {selectedRecord.cleanedValue.toFixed(2)}
                          <span className="text-sm ml-1 text-ocean-400 font-normal">{selectedRecord.unit}</span>
                        </span>
                      </div>
                      <div className="pt-3 border-t border-ocean-700">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-ocean-500">偏差幅度</span>
                          <span className={`font-mono ${
                            selectedRecord.rawValue - selectedRecord.cleanedValue > 0 
                              ? 'text-nautical-success' 
                              : 'text-nautical-danger'
                          }`}>
                            {(selectedRecord.rawValue - selectedRecord.cleanedValue).toFixed(2)}
                            ({(((selectedRecord.rawValue - selectedRecord.cleanedValue) / selectedRecord.rawValue) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-ocean-800/50 rounded-xl border border-ocean-700 p-5">
                    <h3 className="text-white font-semibold mb-4">基本信息</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-ocean-500">记录编号</span>
                        <span className="text-white font-mono">{selectedRecord.recordNo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ocean-500">监测船舶</span>
                        <span className="text-white">{selectedRecord.shipName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ocean-500">监测点位</span>
                        <span className="text-white">{selectedRecord.location}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ocean-500">测量日期</span>
                        <span className="text-white">{selectedRecord.measureDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ocean-500">测量时间</span>
                        <span className="text-white">{selectedRecord.measureTime}</span>
                      </div>
                    </div>
                  </div>

                  {selectedRecord.hasSupplementaryNote && (
                    <div className="col-span-2 bg-nautical-warning/10 border border-nautical-warning/30 rounded-xl p-5">
                      <h3 className="text-nautical-warning font-semibold mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-nautical-warning rounded-full animate-pulse" />
                        后补备注（现场毛边）
                      </h3>
                      <p className="text-ocean-200 text-sm">{selectedRecord.supplementaryNote}</p>
                    </div>
                  )}

                  {selectedRecord.missingEvidence.length > 0 && (
                    <div className="col-span-2 bg-nautical-danger/10 border border-nautical-danger/30 rounded-xl p-5">
                      <h3 className="text-nautical-danger font-semibold mb-3">缺失证据</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedRecord.missingEvidence.map((item, idx) => (
                          <span key={idx} className="px-3 py-1 bg-nautical-danger/20 text-nautical-dangerLight text-sm rounded-full">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-ocean-500">
                    <p>请从左侧选择一条记录查看详情</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {showDetail && selectedRecord && (
            <div className="w-96 border-l border-ocean-700 bg-ocean-900/50 flex-shrink-0 animate-slide-in-right overflow-hidden">
              <RecordDetail />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
