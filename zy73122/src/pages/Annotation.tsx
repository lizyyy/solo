import { useMemo } from 'react';
import { useRecordStore } from '../store/useRecordStore';
import { useStatistics, useFilteredRecords } from '../hooks/useRecordQueries';
import RecordList from '../components/annotation/RecordList';
import SpatialView from '../components/annotation/SpatialView';
import StatsChart from '../components/annotation/StatsChart';
import ReviewBar from '../components/annotation/ReviewBar';
import AnomalyDrawer from '../components/annotation/AnomalyDrawer';
import { exportToCSV, exportToGeoJSON } from '../utils/export';
import { Download, BarChart3 } from 'lucide-react';

export default function Annotation() {
  const records = useRecordStore(s => s.records);
  const filteredRecords = useFilteredRecords();
  const selectedRecordId = useRecordStore(s => s.selectedRecordId);
  const setSelectedRecord = useRecordStore(s => s.setSelectedRecord);
  const stats = useStatistics();

  const selectedRecord = useMemo(
    () => records.find(r => r.id === selectedRecordId) || null,
    [records, selectedRecordId]
  );

  const handleExportCSV = () => exportToCSV(records);
  const handleExportGeoJSON = () => exportToGeoJSON(records);

  const isAnomaly = selectedRecord?.isAnomaly;

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-serif font-semibold text-slate-800">空间标注</h1>
          <p className="text-xs text-slate-500 mt-0.5">复核海况数据，处理异常点</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <p className="text-xs text-slate-500">总计</p>
              <p className="font-semibold text-slate-700">{stats.total}</p>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div className="text-center">
              <p className="text-xs text-slate-500">已复核</p>
              <p className="font-semibold text-green-600">{stats.reviewed}</p>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div className="text-center">
              <p className="text-xs text-slate-500">异常</p>
              <p className="font-semibold text-alert-500">{stats.anomaly}</p>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div className="text-center">
              <p className="text-xs text-slate-500">边界</p>
              <p className="font-semibold text-purple-600">{stats.boundary}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出 CSV
            </button>
            <button
              onClick={handleExportGeoJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-ocean-600 text-white rounded-lg hover:bg-ocean-700 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              导出 GeoJSON
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-72 border-r border-slate-200 bg-white flex flex-col">
          <RecordList
            records={filteredRecords}
            selectedId={selectedRecordId}
            onSelect={setSelectedRecord}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <SpatialView
            records={filteredRecords}
            selectedId={selectedRecordId}
            onSelect={setSelectedRecord}
          />
        </div>

        <div className="w-72 border-l border-slate-200 bg-slate-50 flex flex-col">
          <StatsChart />
        </div>
      </div>

      <ReviewBar selectedRecord={selectedRecord} />

      {isAnomaly && (
        <AnomalyDrawer
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
}
