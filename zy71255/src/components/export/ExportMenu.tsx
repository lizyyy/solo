import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, FileSpreadsheet, FileJson, Camera, ChevronDown } from 'lucide-react';
import { useDataStore } from '@/store/useDataStore';
import { exportToPDF, exportToExcel, exportToJSON, captureScreenshot, type ExportData } from '@/utils/exportUtils';
import Button from '@/components/ui/Button';

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => Promise<void> | void;
}

export default function ExportMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { enterprises, transactions, gaps, issues } = useDataStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buildReportData = (): ExportData => {
    return {
      enterprises,
      transactions,
      gaps,
      issues,
    };
  };

  const handleExportPDF = async () => {
    try {
      setExporting('pdf');
      const data = buildReportData();
      const filename = `碳交易流向报告_${new Date().toISOString().slice(0, 10)}`;
      await exportToPDF(data, filename);
    } catch (error) {
      console.error('导出 PDF 失败:', error);
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  };

  const handleExportExcel = () => {
    try {
      setExporting('excel');
      const data = buildReportData();
      const filename = `碳交易数据_${new Date().toISOString().slice(0, 10)}`;
      exportToExcel(data, filename);
    } catch (error) {
      console.error('导出 Excel 失败:', error);
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  };

  const handleExportJSON = () => {
    try {
      setExporting('json');
      const data = buildReportData();
      const filename = `数据快照_${new Date().toISOString().slice(0, 10)}`;
      exportToJSON(data, filename);
    } catch (error) {
      console.error('导出 JSON 失败:', error);
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  };

  const handleCaptureScreenshot = async () => {
    try {
      setExporting('screenshot');
      const filename = `场景截图_${new Date().toISOString().slice(0, 10)}`;
      await captureScreenshot('scene-container', filename);
    } catch (error) {
      console.error('截图失败:', error);
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  };

  const exportOptions: ExportOption[] = [
    {
      id: 'pdf',
      label: '导出 PDF 报告',
      description: '生成完整的流向分析报告，包含图表和表格',
      icon: <FileText className="w-5 h-5" />,
      action: handleExportPDF,
    },
    {
      id: 'excel',
      label: '导出 Excel 数据',
      description: '导出所有数据到 Excel 表格，便于进一步分析',
      icon: <FileSpreadsheet className="w-5 h-5" />,
      action: handleExportExcel,
    },
    {
      id: 'json',
      label: '导出 JSON 快照',
      description: '导出当前数据的 JSON 格式快照，用于存档或迁移',
      icon: <FileJson className="w-5 h-5" />,
      action: handleExportJSON,
    },
    {
      id: 'screenshot',
      label: '导出截图',
      description: '捕获当前 3D 场景的高清截图',
      icon: <Camera className="w-5 h-5" />,
      action: handleCaptureScreenshot,
    },
  ];

  return (
    <div ref={menuRef} className="relative">
      <Button
        variant="secondary"
        icon={<ChevronDown className="w-4 h-4" />}
        iconPosition="right"
        onClick={() => setIsOpen(!isOpen)}
      >
        导出
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-80 rounded-xl overflow-hidden z-50"
            style={{
              backgroundColor: 'rgba(10, 22, 40, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 212, 255, 0.1)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="p-2">
              {exportOptions.map((option, index) => (
                <motion.button
                  key={option.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={option.action}
                  disabled={exporting !== null}
                  className="w-full flex items-center gap-4 p-4 rounded-lg text-left transition-all duration-200 group"
                  style={{
                    backgroundColor: exporting === option.id ? 'rgba(0, 255, 157, 0.1)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = exporting === option.id ? 'rgba(0, 255, 157, 0.1)' : 'transparent';
                  }}
                >
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200"
                    style={{
                      backgroundColor: 'rgba(0, 212, 255, 0.1)',
                      color: '#00d4ff',
                    }}
                  >
                    {option.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white group-hover:text-accent-cyan transition-colors duration-200">
                      {option.label}
                    </div>
                    <div className="text-sm text-white/50 mt-0.5">
                      {option.description}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
