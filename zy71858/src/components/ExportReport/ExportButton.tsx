import { Download, FileSpreadsheet } from 'lucide-react';
import { SunshineRecord } from '@/types';
import { exportToExcel } from '@/utils/importExport';

interface ExportButtonProps {
  records: SunshineRecord[];
}

export function ExportButton({ records }: ExportButtonProps) {
  const handleExport = () => {
    const date = new Date().toISOString().split('T')[0];
    exportToExcel(records, `建筑日照推演课堂记录_${date}.xlsx`);
  };

  const confirmedCount = records.filter((r) => r.status === 'confirmed').length;
  const supplementCount = records.filter((r) => r.status === 'to_supplement').length;
  const modifiedCount = records.filter((r) => r.status === 'modified' || r.isManualModified).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary-600" />
            导出教研报告
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            导出包含处理口径说明的完整课堂记录
          </p>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md"
        >
          <Download className="w-5 h-5" />
          导出 Excel 报告
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="text-center p-4 bg-slate-50 rounded-lg">
          <div className="text-2xl font-bold text-slate-700">{records.length}</div>
          <div className="text-sm text-slate-500">总记录数</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{confirmedCount}</div>
          <div className="text-sm text-green-600">已确认</div>
        </div>
        <div className="text-center p-4 bg-amber-50 rounded-lg">
          <div className="text-2xl font-bold text-amber-600">{supplementCount}</div>
          <div className="text-sm text-amber-600">待补充</div>
        </div>
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{modifiedCount}</div>
          <div className="text-sm text-blue-600">人工改过</div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-primary-50 rounded-lg">
        <p className="text-sm text-primary-700">
          <strong>导出格式说明：</strong>Excel 文件包含三个工作表（已确认、待补充、人工改过），
          每个表首行显示处理口径，便于教研负责人快速了解记录状态分类标准。
        </p>
      </div>
    </div>
  );
}
