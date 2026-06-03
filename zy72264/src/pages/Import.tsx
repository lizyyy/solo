import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { generateRowKey, detectLengthMismatch, validateRowData } from '@/utils/boundaryRules';
import { BOUNDARY_RULES_DOC } from '@/utils/boundaryRules';
import type { SafetyRadiusRow } from '@/types';
import StatusBadge from '@/components/StatusBadge';

interface ParsedRow {
  data: Omit<SafetyRadiusRow, 'id' | 'status' | 'importedBatchId' | 'createdAt' | 'updatedAt'>;
  valid: boolean;
  errors: string[];
  isDuplicate: boolean;
  hasLengthMismatch: boolean;
}

export default function Import() {
  const { rows, importBatches, importRows } = useStore();
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importResult, setImportResult] = useState<{ added: number; duplicated: number; abnormal: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = (file: File) => {
    setFileName(file.name);
    setImportResult(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const mapped: ParsedRow[] = (results.data as Record<string, string>[]).map((row) => {
          const data = {
            originalRowNumber: parseInt(row['原始行号'] ?? row.originalRowNumber ?? '0', 10),
            tunnelName: row['隧道名称'] ?? row.tunnelName ?? '',
            coordinateOrigin: row['坐标原点'] ?? row.coordinateOrigin ?? '',
            radius: parseFloat(row['安全半径'] ?? row.radius ?? '0'),
            length: parseFloat(row['长度'] ?? row.length ?? '0'),
            calculatedLength: parseFloat(row['计算长度'] ?? row.calculatedLength ?? '0'),
            remark: row['备注'] ?? row.remark ?? '',
          };
          const { valid, errors } = validateRowData(data);
          const tempRow = { ...data, id: '', status: 'pending' as const, importedBatchId: '', createdAt: '', updatedAt: '' };
          const isDuplicate = rows.some((r) => generateRowKey(r) === generateRowKey(tempRow));
          const { isAbnormal } = detectLengthMismatch(tempRow);
          return { data, valid, errors, isDuplicate, hasLengthMismatch: isAbnormal };
        });
        setParsedRows(mapped);
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) parseFile(file);
  };

  const handleImport = () => {
    const batchId = `batch-${Date.now()}`;
    const validRows = parsedRows.filter((r) => r.valid).map((r) => r.data);
    const result = importRows(batchId, fileName, validRows);
    setImportResult(result);
  };

  return (
    <div className="min-h-screen bg-tunnel-bg p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Upload className="w-7 h-7 text-tunnel-accent" />
        <div>
          <h1 className="text-2xl font-bold text-tunnel-fg">导入工作台</h1>
          <p className="text-sm text-tunnel-muted">安全半径表首次导入 · 去重校验 · 异常检测</p>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
          isDragOver ? 'border-tunnel-accent bg-tunnel-accent/5' : 'border-tunnel-border bg-tunnel-surface'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload className="w-12 h-12 text-tunnel-muted" />
        <span className="text-tunnel-muted">拖拽 CSV 文件到此处，或点击选择文件</span>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
      </div>

      {parsedRows.length > 0 && (
        <div className="bg-tunnel-card rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-tunnel-fg font-semibold">
            <FileSpreadsheet className="w-5 h-5 text-tunnel-info" />
            <span>{fileName}</span>
            <span className="text-tunnel-muted text-sm">（共 {parsedRows.length} 行）</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tunnel-border text-tunnel-muted">
                  <th className="py-2 px-3 text-left">原始行号</th>
                  <th className="py-2 px-3 text-left">隧道名称</th>
                  <th className="py-2 px-3 text-left">坐标原点</th>
                  <th className="py-2 px-3 text-left">安全半径</th>
                  <th className="py-2 px-3 text-left">长度</th>
                  <th className="py-2 px-3 text-left">计算长度</th>
                  <th className="py-2 px-3 text-left">备注</th>
                  <th className="py-2 px-3 text-left">状态</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-tunnel-border ${
                      row.isDuplicate ? 'bg-yellow-900/10' : row.hasLengthMismatch ? 'bg-red-900/10' : ''
                    }`}
                  >
                    <td className="py-2 px-3 text-tunnel-fg">{row.data.originalRowNumber}</td>
                    <td className="py-2 px-3 text-tunnel-fg">{row.data.tunnelName}</td>
                    <td className="py-2 px-3 text-tunnel-fg">{row.data.coordinateOrigin}</td>
                    <td className="py-2 px-3 text-tunnel-fg">{row.data.radius}</td>
                    <td className="py-2 px-3 text-tunnel-fg">{row.data.length}</td>
                    <td className="py-2 px-3 text-tunnel-fg">{row.data.calculatedLength}</td>
                    <td className="py-2 px-3 text-tunnel-fg">{row.data.remark}</td>
                    <td className="py-2 px-3">
                      {row.isDuplicate ? (
                        <span className="inline-flex items-center gap-1 text-yellow-400 text-xs font-medium">
                          <AlertTriangle className="w-3 h-3" />重复
                        </span>
                      ) : row.hasLengthMismatch ? (
                        <StatusBadge status="review" />
                      ) : !row.valid ? (
                        <span className="inline-flex items-center gap-1 text-tunnel-danger text-xs">
                          <XCircle className="w-3 h-3" />异常
                        </span>
                      ) : (
                        <StatusBadge status="pending" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleImport}
            disabled={parsedRows.length === 0 || !!importResult}
            className="px-6 py-2 rounded-lg bg-tunnel-accent text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-tunnel-accent/90 transition-colors"
          >
            确认导入
          </button>
        </div>
      )}

      {importResult && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-tunnel-card rounded-xl p-5 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-tunnel-success" />
            <div>
              <div className="text-2xl font-bold text-tunnel-success">{importResult.added}</div>
              <div className="text-sm text-tunnel-muted">新增</div>
            </div>
          </div>
          <div className="bg-tunnel-card rounded-xl p-5 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-yellow-400" />
            <div>
              <div className="text-2xl font-bold text-yellow-400">{importResult.duplicated}</div>
              <div className="text-sm text-tunnel-muted">重复跳过</div>
            </div>
          </div>
          <div className="bg-tunnel-card rounded-xl p-5 flex items-center gap-3">
            <XCircle className="w-8 h-8 text-tunnel-danger" />
            <div>
              <div className="text-2xl font-bold text-tunnel-danger">{importResult.abnormal}</div>
              <div className="text-sm text-tunnel-muted">异常待复核</div>
            </div>
          </div>
        </div>
      )}

      {importBatches.length > 0 && (
        <div className="bg-tunnel-card rounded-xl p-5 space-y-3">
          <h2 className="text-lg font-semibold text-tunnel-fg">导入历史</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tunnel-border text-tunnel-muted">
                <th className="py-2 px-3 text-left">文件名</th>
                <th className="py-2 px-3 text-left">总行数</th>
                <th className="py-2 px-3 text-left">重复数</th>
                <th className="py-2 px-3 text-left">异常数</th>
                <th className="py-2 px-3 text-left">导入时间</th>
                <th className="py-2 px-3 text-left">操作人</th>
              </tr>
            </thead>
            <tbody>
              {importBatches.map((batch) => (
                <tr key={batch.id} className="border-b border-tunnel-border">
                  <td className="py-2 px-3 text-tunnel-fg">{batch.fileName}</td>
                  <td className="py-2 px-3 text-tunnel-fg">{batch.totalRows}</td>
                  <td className="py-2 px-3 text-yellow-400">{batch.duplicatedRows}</td>
                  <td className="py-2 px-3 text-tunnel-danger">{batch.abnormalRows}</td>
                  <td className="py-2 px-3 text-tunnel-muted">{new Date(batch.importedAt).toLocaleString('zh-CN')}</td>
                  <td className="py-2 px-3 text-tunnel-fg">{batch.importedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-tunnel-card rounded-xl overflow-hidden">
        <button
          onClick={() => setRulesOpen(!rulesOpen)}
          className="w-full flex items-center justify-between p-5 text-tunnel-fg font-semibold hover:bg-tunnel-surface/50 transition-colors"
        >
          <span className="flex items-center gap-2"><Info className="w-5 h-5 text-tunnel-info" />边界规则说明</span>
          <span className="text-tunnel-muted text-sm">{rulesOpen ? '收起' : '展开'}</span>
        </button>
        {rulesOpen && (
          <div className="px-5 pb-5 space-y-2">
            {Object.values(BOUNDARY_RULES_DOC).map((desc, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-tunnel-muted">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-tunnel-info" />
                <span>{desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
