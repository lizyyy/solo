import type { Batch } from '../types';
import { generateSampleBatches } from '../data/sampleData';
import { importBatches, clearAllBatches, getBatches } from '../services/storage';
import { 
  exportToJSON, 
  exportToCSV, 
  exportTemperatureRecordsCSV,
  downloadFile,
  getExportFilename
} from '../services/export';

interface ToolbarProps {
  batches: Batch[];
  onRefresh: () => void;
}

export default function Toolbar({ batches, onRefresh }: ToolbarProps) {
  const handleLoadSampleData = () => {
    const sampleBatches = generateSampleBatches();
    const existingBatches = getBatches();
    const hasSampleData = existingBatches.some(b => b.batchNumber.startsWith('20240510'));
    
    if (hasSampleData) {
      const confirmed = window.confirm('样例数据已加载。是否重置并重新加载？');
      if (confirmed) {
        clearAllBatches();
        importBatches(sampleBatches, true);
      }
    } else {
      importBatches(sampleBatches);
    }
    onRefresh();
  };

  const handleExportJSON = () => {
    const content = exportToJSON(batches);
    const filename = getExportFilename('json');
    downloadFile(content, filename, 'application/json');
  };

  const handleExportCSV = () => {
    const content = exportToCSV(batches);
    const filename = getExportFilename('csv');
    downloadFile(content, filename, 'text/csv;charset=utf-8');
  };

  const handleExportTempCSV = () => {
    const content = exportTemperatureRecordsCSV(batches);
    const filename = getExportFilename('temp_csv');
    downloadFile(content, filename, 'text/csv;charset=utf-8');
  };

  const handleClearAll = () => {
    const confirmed = window.confirm('确定要清除所有数据吗？此操作不可撤销。');
    if (confirmed) {
      clearAllBatches();
      onRefresh();
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn primary" onClick={handleLoadSampleData}>
          加载样例数据
        </button>
      </div>
      
      <div className="toolbar-right">
        <button className="toolbar-btn" onClick={handleExportJSON}>
          导出 JSON
        </button>
        <button className="toolbar-btn" onClick={handleExportCSV}>
          导出批次 CSV
        </button>
        <button className="toolbar-btn" onClick={handleExportTempCSV}>
          导出温度记录
        </button>
        <button className="toolbar-btn danger" onClick={handleClearAll}>
          清除所有数据
        </button>
      </div>
    </div>
  );
}
