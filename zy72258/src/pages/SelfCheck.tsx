import { useEffect, useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  FileWarning,
  Copy,
  Check,
  Database,
  FileCheck,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import { useCanonicalStore } from '../store/canonicalStore';
import { SELF_CHECK_LABELS, type SelfCheckType, type SelfCheckResult, PROCESSING_STATUS_LABELS } from '../types';
import { formatTimestamp } from '../utils/checksum';

const checkIcons: Record<SelfCheckType, React.ReactNode> = {
  duplicate_import: <Copy className="w-8 h-8" />,
  missing_row: <FileWarning className="w-8 h-8" />,
  recalculation: <RefreshCw className="w-8 h-8" />,
  export_consistency: <Database className="w-8 h-8" />,
};

const checkDescriptions: Record<SelfCheckType, string> = {
  duplicate_import: '检测是否存在重复导入相同文件的情况，通过比对文件hash实现',
  missing_row: '检测照片点位与坐标表的匹配情况，标记"照片有点位但坐标表缺一行"的记录',
  recalculation: '校验补录后的重算结果是否正确，补录记录是否正确转换为重算状态',
  export_consistency: '验证页面展示、API接口、文件导出三者读取的数据是否完全一致',
};

interface RowDiff {
  originalLineNumber: number;
  crackId: string;
  inPage: boolean;
  inApi: boolean;
  inExport: boolean;
  fieldDiffs: Array<{
    field: string;
    fieldLabel: string;
    pageValue: unknown;
    apiValue: unknown;
    exportValue: unknown;
  }>;
}

function DetailSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 text-left"
      >
        <span className="font-medium text-gray-700 text-sm">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

function StatBadge({ label, value, tone = 'default' }: { label: string; value: React.ReactNode; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  const toneClass =
    tone === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
    tone === 'warning' ? 'bg-orange-50 text-orange-700 border-orange-200' :
    tone === 'danger' ? 'bg-red-50 text-red-700 border-red-200' :
    'bg-gray-50 text-gray-700 border-gray-200';
  return (
    <div className={`px-3 py-2 border rounded ${toneClass}`}>
      <div className="text-xs opacity-75">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

function ValueCell({ value, highlight = false }: { value: unknown; highlight?: boolean }) {
  const display = value === null || value === undefined ? '(空)' : String(value);
  return (
    <span className={`font-mono text-xs px-2 py-1 rounded ${highlight ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
      {display}
    </span>
  );
}

function DuplicateImportDetails({ result }: { result: SelfCheckResult }) {
  const details = result.details as Record<string, unknown>;
  const importHistory = details.importHistory as Array<{ time: number; fileName: string; fileHash: string; duplicateDetected: boolean; rowCount: number }> | undefined;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatBadge label="累计导入次数" value={String(details.importCount ?? 0)} tone="default" />
        <StatBadge label="上次导入时间" value={details.lastImportTime ? formatTimestamp(details.lastImportTime as number) : '-'} tone="default" />
        <StatBadge label="上次是否重复" value={details.lastDuplicateDetected ? '是' : '否'} tone={details.lastDuplicateDetected ? 'warning' : 'success'} />
      </div>

      <DetailSection title="导入历史记录">
        {importHistory && importHistory.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2 border-b">时间</th>
                <th className="text-left p-2 border-b">文件名</th>
                <th className="text-left p-2 border-b">行数</th>
                <th className="text-left p-2 border-b">文件Hash</th>
                <th className="text-left p-2 border-b">是否重复</th>
              </tr>
            </thead>
            <tbody>
              {importHistory.map((h, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{formatTimestamp(h.time)}</td>
                  <td className="p-2 font-medium">{String(h.fileName || '-')}</td>
                  <td className="p-2">{String(h.rowCount ?? '-')}</td>
                  <td className="p-2 font-mono text-gray-500">{String(h.fileHash || '-')}</td>
                  <td className="p-2">
                    {h.duplicateDetected ? (
                      <span className="text-warning-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />重复</span>
                    ) : (
                      <span className="text-success-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />正常</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">暂无导入记录</p>
        )}
      </DetailSection>
    </div>
  );
}

function MissingRowDetails({ result }: { result: SelfCheckResult }) {
  const details = result.details as Record<string, unknown>;
  const missingRows = details.missingRows as Array<{ originalLineNumber: number; photoPointId: string; photoNumber: string; status: string; hasCoordinate: boolean; reviewedBy: string | null }> | undefined;
  const reviewedRows = details.reviewedRows as Array<{ originalLineNumber: number; photoPointId: string; photoNumber: string; reviewedBy: string; reviewedAt: number }> | undefined;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        <StatBadge label="总行数" value={String(details.totalRows ?? 0)} tone="default" />
        <StatBadge label="缺行待复核" value={String(details.missingRowCount ?? 0)} tone={details.missingRowCount ? 'warning' : 'success'} />
        <StatBadge label="已复核待补录" value={String(details.reviewedRowCount ?? 0)} tone={details.reviewedRowCount ? 'warning' : 'default'} />
        <StatBadge label="正常记录" value={String(details.normalRowCount ?? 0)} tone="success" />
      </div>

      <DetailSection title={`缺行待复核记录 (${missingRows?.length ?? 0})`} defaultOpen={!!missingRows?.length}>
        {missingRows && missingRows.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-orange-50">
                <th className="text-left p-2 border-b">原始行号</th>
                <th className="text-left p-2 border-b">点位ID</th>
                <th className="text-left p-2 border-b">照片编号</th>
                <th className="text-left p-2 border-b">状态</th>
                <th className="text-left p-2 border-b">是否有坐标</th>
                <th className="text-left p-2 border-b">复核人</th>
              </tr>
            </thead>
            <tbody>
              {missingRows.map((r, i) => (
                <tr key={i} className="border-b bg-orange-50/30">
                  <td className="p-2 font-mono font-bold text-primary-600">{r.originalLineNumber}</td>
                  <td className="p-2 font-mono">{r.photoPointId}</td>
                  <td className="p-2">{r.photoNumber}</td>
                  <td className="p-2">
                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-medium">
                      {PROCESSING_STATUS_LABELS[r.status as keyof typeof PROCESSING_STATUS_LABELS] || r.status}
                    </span>
                  </td>
                  <td className="p-2">
                    {r.hasCoordinate ? <Check className="w-3 h-3 text-success-600" /> : <XCircle className="w-3 h-3 text-danger-600" />}
                  </td>
                  <td className="p-2">{r.reviewedBy || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" />无缺行待复核记录</p>
        )}
      </DetailSection>

      <DetailSection title={`已复核待补录记录 (${reviewedRows?.length ?? 0})`} defaultOpen={!!reviewedRows?.length}>
        {reviewedRows && reviewedRows.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-yellow-50">
                <th className="text-left p-2 border-b">原始行号</th>
                <th className="text-left p-2 border-b">点位ID</th>
                <th className="text-left p-2 border-b">照片编号</th>
                <th className="text-left p-2 border-b">复核人</th>
                <th className="text-left p-2 border-b">复核时间</th>
              </tr>
            </thead>
            <tbody>
              {reviewedRows.map((r, i) => (
                <tr key={i} className="border-b bg-yellow-50/30">
                  <td className="p-2 font-mono font-bold text-primary-600">{r.originalLineNumber}</td>
                  <td className="p-2 font-mono">{r.photoPointId}</td>
                  <td className="p-2">{r.photoNumber}</td>
                  <td className="p-2 font-medium">{r.reviewedBy}</td>
                  <td className="p-2">{formatTimestamp(r.reviewedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">暂无已复核待补录记录</p>
        )}
      </DetailSection>
    </div>
  );
}

function RecalculationDetails({ result }: { result: SelfCheckResult }) {
  const details = result.details as Record<string, unknown>;
  const statusBreakdown = details.statusBreakdown as Record<string, number> | undefined;
  const supplementedRows = details.supplementedRows as Array<{ originalLineNumber: number; photoPointId: string; photoNumber: string; coordinate: string; lastModification: unknown }> | undefined;
  const recalculatedRows = details.recalculatedRows as Array<{ originalLineNumber: number; photoPointId: string; photoNumber: string; coordinate: string; recalculatedAt: number }> | undefined;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        <StatBadge label="待重算补录" value={String(details.supplementedCount ?? 0)} tone={details.supplementedCount ? 'warning' : 'success'} />
        <StatBadge label="已重算" value={String(details.recalculatedCount ?? 0)} tone="success" />
        <StatBadge label="已复核" value={String(details.reviewedCount ?? 0)} tone="default" />
        <StatBadge label="遮挡同步新增" value={String(details.occlusionAdded ?? 0)} tone="default" />
      </div>

      {statusBreakdown && (
        <DetailSection title="状态分布">
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusBreakdown).map(([status, count]) => (
              <span key={status} className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-sm">
                {PROCESSING_STATUS_LABELS[status as keyof typeof PROCESSING_STATUS_LABELS] || status}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </DetailSection>
      )}

      <DetailSection title={`待重算补录记录 (${supplementedRows?.length ?? 0})`} defaultOpen={!!supplementedRows?.length}>
        {supplementedRows && supplementedRows.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-cyan-50">
                <th className="text-left p-2 border-b">原始行号</th>
                <th className="text-left p-2 border-b">点位ID</th>
                <th className="text-left p-2 border-b">照片编号</th>
                <th className="text-left p-2 border-b">补录坐标</th>
              </tr>
            </thead>
            <tbody>
              {supplementedRows.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2 font-mono font-bold text-primary-600">{r.originalLineNumber}</td>
                  <td className="p-2 font-mono">{r.photoPointId}</td>
                  <td className="p-2">{r.photoNumber}</td>
                  <td className="p-2 font-mono">{r.coordinate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" />无待重算补录记录</p>
        )}
      </DetailSection>

      <DetailSection title={`已重算记录 (${recalculatedRows?.length ?? 0})`}>
        {recalculatedRows && recalculatedRows.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-emerald-50">
                <th className="text-left p-2 border-b">原始行号</th>
                <th className="text-left p-2 border-b">点位ID</th>
                <th className="text-left p-2 border-b">照片编号</th>
                <th className="text-left p-2 border-b">重算坐标</th>
                <th className="text-left p-2 border-b">重算时间</th>
              </tr>
            </thead>
            <tbody>
              {recalculatedRows.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2 font-mono font-bold text-primary-600">{r.originalLineNumber}</td>
                  <td className="p-2 font-mono">{r.photoPointId}</td>
                  <td className="p-2">{r.photoNumber}</td>
                  <td className="p-2 font-mono">{r.coordinate}</td>
                  <td className="p-2">{formatTimestamp(r.recalculatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">暂无已重算记录</p>
        )}
      </DetailSection>

      {details.canonicalVersion && (
        <DetailSection title="标注结果元信息">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-500">版本：</span><span className="font-mono font-bold">{String(details.canonicalVersion)}</span></div>
            <div><span className="text-gray-500">记录数：</span><span className="font-bold">{String(details.canonicalRowCount ?? '-')}</span></div>
            <div><span className="text-gray-500">缺行数：</span><span className="font-bold">{String(details.canonicalMissingRowCount ?? '-')}</span></div>
            <div><span className="text-gray-500">校验和：</span><span className="font-mono text-xs">{String(details.canonicalChecksum || '-').slice(0, 24)}...</span></div>
          </div>
        </DetailSection>
      )}
    </div>
  );
}

function ExportConsistencyDetails({ result }: { result: SelfCheckResult }) {
  const details = result.details as Record<string, unknown>;
  const mismatchedRows = details.mismatchedRows as RowDiff[] | undefined;
  const missingExport = details.missingRowsInExport as number[] | undefined;
  const missingApi = details.missingRowsInApi as number[] | undefined;
  const missingPage = details.missingRowsInPage as number[] | undefined;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        <StatBadge label="页面行数" value={String(details.pageRowCount ?? 0)} tone="default" />
        <StatBadge label="接口行数" value={String(details.apiRowCount ?? 0)} tone="default" />
        <StatBadge label="导出行数" value={String(details.exportRowCount ?? 0)} tone="default" />
        <StatBadge label="一致记录" value={String(details.consistentCount ?? 0)} tone="success" />
        <StatBadge label="不一致记录" value={String(details.inconsistentCount ?? 0)} tone={details.inconsistentCount ? 'danger' : 'success'} />
      </div>

      {(missingExport?.length || missingApi?.length || missingPage?.length) ? (
        <div className="p-3 bg-red-50 border border-red-200 rounded space-y-1 text-sm">
          <h4 className="font-bold text-red-700 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />缺行检测</h4>
          {missingExport?.length ? <p className="text-red-600">导出文件缺失行号：{missingExport.join(', ')}</p> : null}
          {missingApi?.length ? <p className="text-red-600">接口返回缺失行号：{missingApi.join(', ')}</p> : null}
          {missingPage?.length ? <p className="text-red-600">页面展示缺失行号：{missingPage.join(', ')}</p> : null}
        </div>
      ) : (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700 flex items-center gap-1">
          <CheckCircle className="w-4 h-4" />三方行数完全一致
        </div>
      )}

      <DetailSection title={`字段级不一致详情 (${mismatchedRows?.length ?? 0})`} defaultOpen={!!mismatchedRows?.length}>
        {mismatchedRows && mismatchedRows.length > 0 ? (
          <div className="space-y-3">
            {mismatchedRows.map((row, i) => (
              <div key={i} className="border border-red-200 rounded overflow-hidden">
                <div className="bg-red-50 px-3 py-2 flex items-center justify-between">
                  <div className="font-bold text-red-700 flex items-center gap-2">
                    <span>原始行号 #{row.originalLineNumber}</span>
                    <span className="font-mono text-xs">{row.crackId}</span>
                  </div>
                  <div className="flex gap-1 text-xs">
                    {!row.inPage && <span className="bg-red-200 text-red-800 px-1.5 py-0.5 rounded">页面缺</span>}
                    {!row.inApi && <span className="bg-red-200 text-red-800 px-1.5 py-0.5 rounded">接口缺</span>}
                    {!row.inExport && <span className="bg-red-200 text-red-800 px-1.5 py-0.5 rounded">导出缺</span>}
                  </div>
                </div>
                {row.fieldDiffs.length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left p-2 border-b">字段</th>
                        <th className="text-left p-2 border-b">页面值</th>
                        <th className="text-center p-2 border-b"></th>
                        <th className="text-left p-2 border-b">接口值</th>
                        <th className="text-center p-2 border-b"></th>
                        <th className="text-left p-2 border-b">导出值</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.fieldDiffs.map((f, j) => (
                        <tr key={j} className="border-b">
                          <td className="p-2 font-medium">{f.fieldLabel}</td>
                          <td className="p-2"><ValueCell value={f.pageValue} highlight /></td>
                          <td className="p-2 text-center"><ArrowRight className="w-3 h-3 text-gray-400 inline" /></td>
                          <td className="p-2"><ValueCell value={f.apiValue} highlight /></td>
                          <td className="p-2 text-center"><ArrowRight className="w-3 h-3 text-gray-400 inline" /></td>
                          <td className="p-2"><ValueCell value={f.exportValue} highlight /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" />所有记录的裂缝编号、照片编号、坐标、状态、遮挡字段完全一致</p>
        )}
      </DetailSection>

      <DetailSection title="元信息">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500">单一数据源版本：</span><span className="font-mono font-bold">{String(details.canonicalVersion || '-')}</span></div>
          <div><span className="text-gray-500">校验和：</span><span className="font-mono text-xs">{String(details.canonicalChecksum || '-').slice(0, 24)}...</span></div>
          <div className="col-span-2">
            <span className="text-gray-500">Hash值（页面 / 接口 / 导出）：</span>
            <div className="font-mono text-xs mt-1 space-y-1">
              <div>页面：{String(details.pageDataHash || '-').slice(0, 32)}...</div>
              <div>接口：{String(details.apiDataHash || '-').slice(0, 32)}...</div>
              <div>导出：{String(details.exportDataHash || '-').slice(0, 32)}...</div>
            </div>
          </div>
        </div>
      </DetailSection>
    </div>
  );
}

function SelfCheckDetail({ type, result }: { type: SelfCheckType; result: SelfCheckResult }) {
  switch (type) {
    case 'duplicate_import':
      return <DuplicateImportDetails result={result} />;
    case 'missing_row':
      return <MissingRowDetails result={result} />;
    case 'recalculation':
      return <RecalculationDetails result={result} />;
    case 'export_consistency':
      return <ExportConsistencyDetails result={result} />;
    default:
      return <pre className="font-mono text-xs">{JSON.stringify(result.details, null, 2)}</pre>;
  }
}

export function SelfCheck() {
  const { selfCheckResults, runSelfCheck, loadSelfCheckResults, currentOperator, isLoading } =
    useCanonicalStore();
  const [selectedCheck, setSelectedCheck] = useState<SelfCheckType | null>(null);
  const [runningCheck, setRunningCheck] = useState<SelfCheckType | null>(null);

  useEffect(() => {
    loadSelfCheckResults();
  }, [loadSelfCheckResults]);

  const handleRunCheck = async (type: SelfCheckType) => {
    setRunningCheck(type);
    try {
      await runSelfCheck(type);
    } finally {
      setRunningCheck(null);
    }
  };

  const handleRunAll = async () => {
    const types: SelfCheckType[] = ['duplicate_import', 'missing_row', 'recalculation', 'export_consistency'];
    for (const type of types) {
      await handleRunCheck(type);
    }
  };

  const allPassed =
    selfCheckResults.duplicate_import?.passed &&
    selfCheckResults.missing_row?.passed &&
    selfCheckResults.recalculation?.passed &&
    selfCheckResults.export_consistency?.passed;

  const hasAnyResult = Object.values(selfCheckResults).some((r) => r !== null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">自检中心</h1>
          <p className="text-sm text-gray-500 mt-1">
            四项核心自检：重复导入、缺行检测、补录重算、导出一致
          </p>
        </div>
        <button onClick={handleRunAll} className="btn-industrial flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          执行全部自检
        </button>
      </div>

      {hasAnyResult && (
        <div
          className={`card-industrial p-4 ${
            allPassed ? 'border-success-500 bg-green-50' : 'border-warning-500 bg-orange-50'
          }`}
        >
          <div className="flex items-center gap-3">
            {allPassed ? (
              <CheckCircle className="w-8 h-8 text-success-500" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-warning-500" />
            )}
            <div>
              <h3 className="font-bold text-gray-800">
                {allPassed ? '全部自检通过 ✓' : '存在待处理项'}
              </h3>
              <p className="text-sm text-gray-600">
                {allPassed
                  ? '系统各项检测均已通过，数据一致性得到保障'
                  : '请逐项查看自检结果，处理异常项后重新检测'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {(Object.keys(selfCheckResults) as SelfCheckType[]).map((type) => {
          const result = selfCheckResults[type];
          const isRunning = runningCheck === type;

          return (
            <div
              key={type}
              className={`card-industrial p-6 cursor-pointer transition-all hover:shadow-lg ${
                result?.passed
                  ? 'border-success-500'
                  : result
                  ? 'border-warning-500'
                  : 'border-gray-200'
              } ${selectedCheck === type ? 'ring-2 ring-primary-600' : ''}`}
              onClick={() => setSelectedCheck(selectedCheck === type ? null : type)}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`p-3 ${
                    result?.passed
                      ? 'bg-green-100 text-success-500'
                      : result
                      ? 'bg-orange-100 text-warning-500'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {checkIcons[type]}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunCheck(type);
                  }}
                  disabled={isRunning}
                  className={`btn-industrial-outline text-sm px-3 py-1.5 flex items-center gap-1.5 ${
                    isRunning ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isRunning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      检测中
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      运行检测
                    </>
                  )}
                </button>
              </div>

              <h3 className="text-lg font-bold text-gray-800 mb-2">{SELF_CHECK_LABELS[type]}</h3>
              <p className="text-sm text-gray-500 mb-4">{checkDescriptions[type]}</p>

              {result ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {result.passed ? (
                      <CheckCircle className="w-5 h-5 text-success-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-warning-500" />
                    )}
                    <span
                      className={`font-medium ${
                        result.passed ? 'text-success-600' : 'text-warning-600'
                      }`}
                    >
                      {result.message}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    检测时间：{formatTimestamp(result.checkedAt)}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <FileCheck className="w-4 h-4" />
                  尚未执行检测
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedCheck && selfCheckResults[selectedCheck] && (
        <div className="card-industrial p-6 border-primary-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 text-lg">
              {SELF_CHECK_LABELS[selectedCheck]} - 详细结果
            </h3>
            <button
              onClick={() => setSelectedCheck(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              关闭
            </button>
          </div>
          <SelfCheckDetail type={selectedCheck} result={selfCheckResults[selectedCheck] as SelfCheckResult} />
        </div>
      )}

      <div className="card-industrial p-6">
        <h3 className="font-bold text-gray-800 mb-4">自检触发时机说明</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200">
            <Copy className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-gray-800">重复导入检测</span>
              <span className="text-gray-600">
                 - 每次导入坐标原点说明文件时自动触发，比对文件hash判断是否重复
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200">
            <FileWarning className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-gray-800">坐标表缺行检测</span>
              <span className="text-gray-600">
                - 导入时自动遍历照片点位与坐标表匹配，缺行记录标记为"缺行待复核"，
                <span className="font-bold text-warning-600">不自动归正常，留给安全员复核</span>
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-cyan-50 border border-cyan-200">
            <RefreshCw className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-gray-800">补录后重算校验</span>
              <span className="text-gray-600">
                - 补录完成触发重算时自动校验，验证补录记录是否正确转换为重算状态
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200">
            <Database className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-gray-800">导出一致性验证</span>
              <span className="text-gray-600">
                - 对页面、接口、导出三条数据路径做逐字段比对，给出不一致的具体行号和字段
              </span>
            </div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-xl">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-600">检测中...</p>
          </div>
        </div>
      )}
    </div>
  );
}
