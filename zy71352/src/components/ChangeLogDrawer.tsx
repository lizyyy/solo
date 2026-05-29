import { X, Clock, User, Edit3 } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useArtworkStore } from '../store/artworkStore';
import { cn } from '../lib/utils';

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function formatFieldName(field: string): string {
  const fieldMap: Record<string, string> = {
    name: '作品名称',
    artworkNo: '作品编号',
    artist: '艺术家',
    year: '年代',
    material: '材质',
    size: '尺寸',
    status: '状态',
    created: '创建记录',
    'contract.version': '合同版本',
    'contract.lender': '出借方',
    'contract.startDate': '出借开始日期',
    'contract.endDate': '出借结束日期',
    'contract.specialTerms': '特殊条款',
    'contract': '借展合同',
    'valuation.amount': '估值金额',
    'valuation.currency': '估值币种',
    'valuation.valuationDate': '估值日期',
    'valuation.institution': '估值机构',
    'valuation': '估值信息',
    'insurance.policyType': '险种',
    'insurance.coverageAmount': '保额',
    'insurance.effectiveDate': '保险生效日期',
    'insurance.expiryDate': '保险到期日期',
    'insurance.insurer': '承保机构',
    'insurance': '保险条款',
    'transport.origin.status': '起运地状态',
    'transport.origin.timestamp': '起运时间',
    'transport.transit.status': '中转状态',
    'transport.destination.status': '目的地状态',
    'transport.destination.timestamp': '送达时间',
  };
  return fieldMap[field] || field;
}

export function ChangeLogDrawer() {
  const { changeLogDrawerOpen, closeChangeLogDrawer } = useUIStore();
  const { artworkDetail } = useArtworkStore();

  if (!changeLogDrawerOpen) return null;

  const changeLogs = artworkDetail?.changeLogs || [];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={closeChangeLogDrawer}
      />
      <div
        className={cn(
        'fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50',
        'transform transition-transform duration-300 ease-out',
        changeLogDrawerOpen ? 'translate-x-0' : 'translate-x-full'
      )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
            <div>
              <h2 className="text-lg font-bold text-stone-900" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                变更历史记录
              </h2>
              {artworkDetail && (
                <p className="text-sm text-stone-500 mt-0.5">
                  {artworkDetail.artworkNo} - {artworkDetail.name}
                </p>
              )}
            </div>
            <button
              onClick={closeChangeLogDrawer}
              className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5 text-stone-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {changeLogs.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500">暂无变更记录</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-px bg-stone-200" />
                <div className="space-y-6">
                  {changeLogs.map((log, index) => (
                    <div key={log.id} className="relative pl-12">
                      <div
                        className={cn(
                        'absolute left-3 w-5 h-5 rounded-full border-4 bg-white',
                        log.fieldName === 'status' || log.fieldName === 'created'
                          ? 'border-amber-500'
                          : 'border-stone-400'
                      )}
                      />
                      <div
                        className={cn(
                        'bg-stone-50 rounded-xl p-4 border border-stone-100',
                        'hover:border-stone-200 transition-colors'
                      )}
                        style={{
                        animation: `fadeInUp 0.3s ease-out ${index * 50}ms both`,
                      }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-stone-600">
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{formatFieldName(log.fieldName)}</span>
                          </div>
                          {log.reason && (
                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                              {log.reason}
                            </span>
                          )}
                        </div>

                        {log.oldValue !== null && log.oldValue !== undefined && (
                          <div className="mb-2">
                            <span className="text-xs text-stone-500">变更前：</span>
                            <p className="text-sm text-red-600 bg-red-50 rounded px-2 py-1 mt-0.5 line-through">
                              {formatValue(log.oldValue)}
                            </p>
                          </div>
                        )}

                        {log.newValue !== null && log.newValue !== undefined && (
                          <div>
                            <span className="text-xs text-stone-500">变更后：</span>
                            <p className="text-sm text-emerald-600 bg-emerald-50 rounded px-2 py-1 mt-0.5 font-medium">
                              {formatValue(log.newValue)}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-stone-100">
                          <div className="flex items-center gap-1 text-xs text-stone-500">
                            <User className="w-3.5 h-3.5" />
                            <span>{log.operator}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-stone-500">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {new Date(log.timestamp).toLocaleString('zh-CN')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
