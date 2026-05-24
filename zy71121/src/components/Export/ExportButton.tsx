import { useState } from 'react';
import { Download, FileJson, FileText, ChevronDown } from 'lucide-react';
import { exportJSON, exportPDF } from '../../utils/export';

export function ExportButton() {
  const [showMenu, setShowMenu] = useState(false);
  
  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all text-sm font-medium shadow-md"
      >
        <Download className="w-4 h-4" />
        导出报告
        <ChevronDown className={`w-4 h-4 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
      </button>
      
      {showMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-100 py-1 w-48 z-50">
            <button
              onClick={() => {
                exportPDF();
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors flex items-center gap-2 text-gray-700"
            >
              <FileText className="w-4 h-4 text-red-500" />
              导出 PDF 报告
            </button>
            <button
              onClick={() => {
                exportJSON();
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors flex items-center gap-2 text-gray-700"
            >
              <FileJson className="w-4 h-4 text-blue-500" />
              导出 JSON 数据
            </button>
          </div>
        </>
      )}
    </div>
  );
}
