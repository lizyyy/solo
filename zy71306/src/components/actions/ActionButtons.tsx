import { useNavigate } from 'react-router-dom';
import { useCalibrationStore } from '../../store/calibrationStore';
import { Button } from '../common/Button';
import { Camera, Save, RotateCcw, FileText, Download } from 'lucide-react';

interface ActionButtonsProps {
  sceneRef?: string;
}

export default function ActionButtons({ sceneRef = 'scene-container' }: ActionButtonsProps) {
  const navigate = useNavigate();
  const {
    takeScreenshot,
    saveRecord,
    clearAll,
    isScreenshotting,
    currentScreenshot,
    currentNote,
    records,
    generateCalibrationReport,
    selectedRecords,
  } = useCalibrationStore();

  const handleQuickReport = () => {
    if (records.length > 0) {
      const recordIds = records.slice(0, 5).map((r) => r.id);
      generateCalibrationReport(recordIds);
      navigate(`/report/${records[0].id}`);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        onClick={() => takeScreenshot(sceneRef)}
        disabled={isScreenshotting}
        loading={isScreenshotting}
      >
        <Camera size={18} />
        截图
      </Button>

      <Button onClick={saveRecord} variant="secondary" disabled={!currentScreenshot && !currentNote}>
        <Save size={18} />
        保存记录
      </Button>

      {records.length > 0 && (
        <Button onClick={handleQuickReport} variant="secondary">
          <FileText size={18} />
          快速报告
        </Button>
      )}

      <Button onClick={clearAll} variant="danger">
        <RotateCcw size={18} />
        重置
      </Button>
    </div>
  );
}
