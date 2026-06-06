import type { ImportPreviewRow } from '@/types';
import { AlertTriangle, Copy, CheckCircle } from 'lucide-react';

interface ImportPreviewProps {
  rows: ImportPreviewRow[];
}

export const ImportPreview = ({ rows }: ImportPreviewProps) => {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-3 text-left font-medium text-gray-600 w-20">原始行号</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">现场名</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">版权名</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600 w-32">检测结果</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              className={`border-t border-gray-100 ${
                row.isDuplicate || row.isNameMapping ? 'bg-amber-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              <td className="px-4 py-3 text-gray-400 font-mono text-xs">{row.originalRowNumber}</td>
              <td className="px-4 py-3 text-gray-800">{row.liveName}</td>
              <td className="px-4 py-3 text-gray-800">{row.copyrightName}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {row.isDuplicate && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                      <Copy className="w-3 h-3" />
                      重复
                    </span>
                  )}
                  {row.isNameMapping && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                      <AlertTriangle className="w-3 h-3" />
                      同名待复核
                    </span>
                  )}
                  {!row.isDuplicate && !row.isNameMapping && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                      <CheckCircle className="w-3 h-3" />
                      正常
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
