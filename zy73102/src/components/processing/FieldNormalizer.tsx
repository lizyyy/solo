import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

const mappingTable = [
  { original: '物料名、构件名、item、品名、排水材料名', standard: 'standardName / 材料名称', status: 'mapped', locked: false },
  { original: '类型、类别、category、type、规格分类', standard: 'materialType / 材料类型', status: 'mapped', locked: false },
  { original: '状态、处理情况、进度、status、state、处理结果', standard: 'processingStatus / 处理状态', status: 'mapped', locked: true },
  { original: '来源、纪要编号、出处、from、reference、note_ref', standard: 'source / 来源', status: 'mapped', locked: true },
  { original: '版本号、图纸版本、ver、version、rev、修订号', standard: 'drawingVersion / 图纸版本', status: 'mapped', locked: false },
  { original: '安装位置、坐标、location、position、区域', standard: 'position / 位置', status: 'pending', locked: false },
  { original: '责任人、备注、其他描述字段', standard: '（未匹配）', status: 'unmapped', locked: false },
];

export default function FieldNormalizer() {
  return (
    <div className="space-y-3 p-3">
      <div className="rounded-md bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-700">
        系统自动识别同义字段并映射到标准字段；<strong>来源</strong>与<strong>处理状态</strong>强制锁定，不被后续重跑覆盖。
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200">
        <div className="grid grid-cols-[1fr_1fr_auto] bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span>原始字段（识别）</span>
          <span>标准字段（归一化）</span>
          <span>状态</span>
        </div>
        <div className="divide-y divide-slate-100">
          {mappingTable.map((row, idx) => {
            const rowBg =
              row.status === 'unmapped' ? 'bg-amber-50/60' :
              row.locked ? 'bg-emerald-50/40' : 'bg-white';
            return (
              <div
                key={idx}
                className={cn('grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-3 py-2 text-[11px]', rowBg)}
              >
                <span className="text-slate-600 line-clamp-1" title={row.original}>
                  {row.original}
                </span>
                <span className="font-medium text-[#1F3A5F]">{row.standard}</span>
                <span className="flex items-center gap-1">
                  {row.locked && (
                    <span
                      title="强制锁定"
                      className="flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700"
                    >
                      <Lock size={9} /> 锁定
                    </span>
                  )}
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[9px] font-semibold',
                      row.status === 'mapped' && 'bg-blue-100 text-blue-700',
                      row.status === 'pending' && 'bg-slate-100 text-slate-600',
                      row.status === 'unmapped' && 'bg-amber-100 text-amber-700'
                    )}
                  >
                    {row.status === 'mapped' ? '已映射' : row.status === 'pending' ? '待匹配' : '⚠ 未匹配'}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
