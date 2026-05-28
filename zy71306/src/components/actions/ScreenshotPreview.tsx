import { useCalibrationStore } from '../../store/calibrationStore';
import { Card } from '../common/Card';
import { X, Image, StickyNote, Edit3 } from 'lucide-react';

export default function ScreenshotPreview() {
  const {
    currentScreenshot,
    clearCurrentScreenshot,
    currentNote,
    setCurrentNote,
    currentCorrection,
    setCurrentCorrection,
  } = useCalibrationStore();

  if (!currentScreenshot) {
    return null;
  }

  return (
    <Card
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Image size={18} className="text-brass-400" />
            <span>当前截图</span>
          </div>
          <button
            onClick={clearCurrentScreenshot}
            className="p-1 rounded hover:bg-walnut-700 text-walnut-400 hover:text-walnut-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg overflow-hidden border border-walnut-600">
          <img
            src={currentScreenshot}
            alt="校准截图"
            className="w-full h-auto"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-brass-300 mb-2">
            <StickyNote size={16} />
            备注
          </label>
          <textarea
            value={currentNote}
            onChange={(e) => setCurrentNote(e.target.value)}
            placeholder="添加备注说明..."
            className="w-full px-3 py-2 rounded bg-walnut-800 border-2 border-walnut-600 text-walnut-100
              placeholder-walnut-500 focus:outline-none focus:ring-2 focus:ring-brass-500/50
              focus:border-brass-500 transition-all duration-200 resize-none"
            rows={2}
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-brass-300 mb-2">
            <Edit3 size={16} />
            人工更正
          </label>
          <textarea
            value={currentCorrection}
            onChange={(e) => setCurrentCorrection(e.target.value)}
            placeholder="如数值有误，在此记录更正..."
            className="w-full px-3 py-2 rounded bg-walnut-800 border-2 border-amber-500/30 text-walnut-100
              placeholder-walnut-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50
              focus:border-amber-500 transition-all duration-200 resize-none"
            rows={2}
          />
          <p className="text-xs text-amber-400/70 mt-1">
            更正内容将在报告中单独列出
          </p>
        </div>
      </div>
    </Card>
  );
}
