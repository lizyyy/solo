import { Download, FileJson, FileText, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { RestorationReport } from '../../types';
import { exportReport } from '../../engine/gameEngine';
import { useGameStore } from '../../store/gameStore';

interface ExportButtonsProps {
  report: RestorationReport;
}

export function ExportButtons({ report }: ExportButtonsProps) {
  const { resetGame } = useGameStore();

  const handleExport = (format: 'json' | 'text') => {
    exportReport(report, format);
  };

  return (
    <div className="card">
      <h3 className="text-lg font-serif font-bold text-museum-paper mb-4 flex items-center gap-2">
        <Download size={20} className="text-museum-patina" />
        导出报告
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleExport('json')}
          className="flex flex-col items-center gap-2 p-4 bg-museum-bronze/20 border border-museum-bronze/40 rounded-xl hover:bg-museum-bronze/30 transition-colors"
        >
          <FileJson size={32} className="text-museum-bronze" />
          <span className="text-sm font-medium text-museum-paper">JSON 格式</span>
          <span className="text-xs text-museum-paper/60">含完整数据</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleExport('text')}
          className="flex flex-col items-center gap-2 p-4 bg-museum-patina/20 border border-museum-patina/40 rounded-xl hover:bg-museum-patina/30 transition-colors"
        >
          <FileText size={32} className="text-museum-patina" />
          <span className="text-sm font-medium text-museum-paper">文本格式</span>
          <span className="text-xs text-museum-paper/60">适合打印存档</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={resetGame}
          className="flex flex-col items-center gap-2 p-4 bg-museum-ochre/20 border border-museum-ochre/40 rounded-xl hover:bg-museum-ochre/30 transition-colors"
        >
          <RotateCcw size={32} className="text-museum-ochre" />
          <span className="text-sm font-medium text-museum-paper">重新开始</span>
          <span className="text-xs text-museum-paper/60">新的修复任务</span>
        </motion.button>
      </div>

      <div className="mt-4 p-3 bg-museum-patina/10 border border-museum-patina/30 rounded-lg text-sm text-museum-patina">
        <p className="flex items-center gap-2">
          <span className="w-2 h-2 bg-museum-patina rounded-full" />
          报告已生成，包含完整的修复历史记录和评分详情。
        </p>
      </div>
    </div>
  );
}
