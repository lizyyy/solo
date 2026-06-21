import { useState } from 'react';
import { useStore } from './store/useStore';
import { MaterialList } from './components/MaterialList';
import { MaterialUpload } from './components/MaterialUpload';
import { BoundaryResultList, AnomalyList } from './components/BoundaryResultList';
import { BusinessExplanation } from './components/BusinessExplanation';
import { CaliberCompare } from './components/CaliberCompare';
import { CSVExporter } from './utils/csvExporter';
import type { CSVExportConfig, Material } from './types';

type TabType = 'review' | 'explain' | 'caliber' | 'export';

function App() {
  const store = useStore();
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('review');

  const selectedMaterial = store.getSelectedMaterial();
  const selectedRecord = store.getSelectedRecord();
  const summary = store.getReviewSummary();

  const handleCalculate = async (material?: Material) => {
    const target = material || selectedMaterial;
    if (target) {
      if (!material) {
        store.selectMaterial(target.id);
      }
      await store.calculateBoundaries(target);
    }
  };

  const handleExport = (type: 'detailed' | 'summary' | 'business') => {
    if (!selectedMaterial || store.state.boundaryRecords.length === 0) {
      alert('请先选择材料并完成复核');
      return;
    }

    const filename = `概率模拟边界复核_${selectedMaterial.title}_${new Date().toISOString().split('T')[0]}.csv`;
    
    if (type === 'business') {
      const content = CSVExporter.exportBusinessExplanation(
        store.state.boundaryRecords,
        selectedMaterial,
        store.state.activeCaliber
      );
      CSVExporter.downloadCSV(content, `业务解释_${filename}`);
    } else if (type === 'summary') {
      const content = CSVExporter.exportSummary(summary, store.state.activeCaliber);
      CSVExporter.downloadCSV(content, `汇总_${filename}`);
    } else {
      const config: CSVExportConfig = {
        ...store.state.exportConfig,
        format: 'detailed'
      };
      const content = CSVExporter.exportBoundaryRecords(
        store.state.boundaryRecords,
        selectedMaterial,
        store.state.activeCaliber,
        config,
        store.state.caliberVersions
      );
      CSVExporter.downloadCSV(content, `明细_${filename}`);
    }
  };

  const tabs = [
    { id: 'review', label: '边界复核', icon: '🔍' },
    { id: 'explain', label: '业务解释', icon: '📋' },
    { id: 'caliber', label: '口径管理', icon: '📏' },
    { id: 'export', label: '数据导出', icon: '📤' }
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="text-2xl">📊</span>
                概率模拟边界复核
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                基于口径 v{store.state.activeCaliber.version} · {store.state.activeCaliber.name}
              </p>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2"
            >
              <span>➕</span>
              上传新材料
            </button>
          </div>

          <div className="flex gap-1 mt-4 bg-gray-100 p-1 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {activeTab === 'review' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <MaterialList
                  materials={store.state.materials}
                  selectedId={store.state.selectedMaterialId}
                  onSelect={(material) => store.selectMaterial(material.id)}
                  onCalculate={handleCalculate}
                  isCalculating={store.state.isCalculating}
                />
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <BoundaryResultList
                  records={store.state.boundaryRecords}
                  selectedId={store.state.selectedRecordId}
                  onSelect={(record) => store.selectRecord(record.id)}
                  isCalculating={store.state.isCalculating}
                />
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <AnomalyList
                  record={selectedRecord}
                  onResolve={store.resolveAnomaly}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'explain' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <BusinessExplanation
                records={store.state.boundaryRecords}
                material={selectedMaterial}
                caliber={store.state.activeCaliber}
                summary={summary}
              />
            </div>
          </div>
        )}

        {activeTab === 'caliber' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <CaliberCompare
                versions={store.state.caliberVersions}
                activeVersion={store.state.activeCaliber}
                onSelectVersion={store.setActiveCaliber}
              />
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">数据导出</h2>

              <div className="space-y-4">
                <div className="p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer"
                  onClick={() => handleExport('detailed')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-800 flex items-center gap-2">
                        <span>📄</span> 导出明细数据
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        包含所有复核记录的详细信息，含公式、单位、阈值校验结果
                      </p>
                    </div>
                    <span className="text-blue-600 text-sm">导出 →</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">含口径信息</span>
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">含计算轨迹</span>
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">含异常详情</span>
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50/50 transition-all cursor-pointer"
                  onClick={() => handleExport('summary')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-800 flex items-center gap-2">
                        <span>📊</span> 导出汇总报告
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        按指标汇总的统计数据，含界内/界外数量、错误/警告数量等
                      </p>
                    </div>
                    <span className="text-green-600 text-sm">导出 →</span>
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/50 transition-all cursor-pointer"
                  onClick={() => handleExport('business')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-800 flex items-center gap-2">
                        <span>📋</span> 导出业务解释报告
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        供非技术人员阅读的报告，含数字来源线索、异常说明、处理建议
                      </p>
                    </div>
                    <span className="text-purple-600 text-sm">导出 →</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-600 rounded">月底封账专用</span>
                    <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-600 rounded">非技术友好</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <h3 className="font-medium text-gray-700 mb-3">导出选项</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={store.state.exportConfig.includeCaliberInfo}
                      onChange={(e) => store.updateExportConfig({ includeCaliberInfo: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">包含口径定义信息</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={store.state.exportConfig.includeCalculationTrace}
                      onChange={(e) => store.updateExportConfig({ includeCalculationTrace: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">包含计算轨迹</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={store.state.exportConfig.includeAnomalies}
                      onChange={(e) => store.updateExportConfig({ includeAnomalies: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">包含异常详情</span>
                  </label>
                </div>
              </div>

              {store.state.boundaryRecords.length > 0 && (
                <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <h3 className="font-medium text-blue-800 mb-2">当前数据概览</h3>
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{summary.totalRecords}</div>
                      <div className="text-blue-600">总记录</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{summary.withinBounds}</div>
                      <div className="text-green-600">界内</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
                      <div className="text-red-600">错误</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {showUpload && (
        <MaterialUpload
          onUpload={(material) => {
            store.addMaterial(material);
            setShowUpload(false);
          }}
          activeCaliberId={store.state.activeCaliber.id}
          onCancel={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}

export default App;
